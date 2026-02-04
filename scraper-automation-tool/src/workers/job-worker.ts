import { chromium as playwrightChromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page } from 'playwright';
import { join } from 'path';
import { mkdir } from 'fs/promises';
import { updateJobStatus } from '../database/jobs';
import { createJobLog } from '../database/logs';
import { createScreenshot } from '../database/screenshots';
import { TheKnotAdapter } from '../adapters/theknot-adapter';
import { exportToCSV, exportToJSON } from './exporters';
import { randomDelay, isRateLimitingEnabled } from '../utils/delay';
import { retryWithBackoff, isRetryableError } from '../utils/retry';
import type { QueueJob } from '../types/queue';
import type { WorkerConfig, WorkerResult } from '../types/worker';

// Add stealth plugin to avoid bot detection
playwrightChromium.use(stealth());

export class JobWorker {
  private browser: Browser | null = null;
  private currentHeadlessMode: boolean | null = null; // Track current browser mode
  private config: WorkerConfig;

  constructor(config: Partial<WorkerConfig> = {}) {
    this.config = {
      headless: config.headless ?? true, // Back to true with stealth mode
      timeout: config.timeout ?? 30000,
      maxRetries: config.maxRetries ?? 3,
    };
  }

  async execute(job: QueueJob): Promise<WorkerResult> {
    let page: Page | null = null;

    try {
      // Use headless setting from job (allows per-job control)
      const useHeadless = job.headless ?? this.config.headless;
      
      // Close and recreate browser if headless mode changed
      if (this.browser && this.currentHeadlessMode !== null && this.currentHeadlessMode !== useHeadless) {
        await this.log(job.id, 'info', `Headless mode changed (${this.currentHeadlessMode} → ${useHeadless}), recreating browser`);
        await this.browser.close();
        this.browser = null;
        this.currentHeadlessMode = null;
      }
      
      // Initialize browser
      if (!this.browser) {
        await this.log(job.id, 'info', `Initializing browser (headless: ${useHeadless})`);
        this.browser = await playwrightChromium.launch({
          headless: useHeadless,
          args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-web-security',
          ],
        });
        this.currentHeadlessMode = useHeadless; // Remember current mode
      }

      // Create page
      page = await this.browser.newPage();
      page.setDefaultTimeout(this.config.timeout);

      // Route to appropriate handler based on job type
      const jobType = job.job_type || 'scrape';
      
      if (jobType === 'enrich') {
        return await this.executeEnrichment(job, page);
      } else {
        return await this.executeScrape(job, page);
      }
    } catch (error) {
      await this.log(
        job.id,
        'error',
        `Job failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      // Take screenshot on error
      if (page) {
        try {
          const screenshotPath = join('data', 'screenshots', `${job.id}-error.png`);
          await mkdir(join('data', 'screenshots'), { recursive: true });
          await page.screenshot({ path: screenshotPath, fullPage: true });
          await createScreenshot({
            job_id: job.id,
            file_path: screenshotPath,
            context: 'error',
          });
        } catch (screenshotError) {
          console.error('Failed to take screenshot:', screenshotError);
        }
      }

      throw error;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Execute standard scraping job (listing pages)
   */
  private async executeScrape(job: QueueJob, page: Page): Promise<WorkerResult> {
    // Get site adapter
    const adapter = this.getAdapter(job);
    const url = adapter.buildUrl();

    await this.log(job.id, 'info', `Navigating to ${url}`);

    // Navigate to URL with retry logic (Story 2.6: AC3)
    try {
      await retryWithBackoff(
        async () => {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        },
        { maxRetries: 3, initialDelay: 2000 }
      );
    } catch (error) {
      await this.log(
        job.id,
        'error',
        `Failed to navigate after retries: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }

    // CRITICAL: Dismiss OneTrust cookie consent popup if present
    // This popup blocks clicks on pagination buttons
    try {
      await this.log(job.id, 'info', 'Checking for cookie consent popup...');
      const cookieAcceptButton = await page.$('#onetrust-accept-btn-handler, .onetrust-close-btn-handler, button[aria-label*="Accept"], button[aria-label*="Close"]');
      if (cookieAcceptButton) {
        await this.log(job.id, 'info', 'Dismissing cookie consent popup');
        await cookieAcceptButton.click();
        await page.waitForTimeout(1000); // Wait for popup to close
      } else {
        await this.log(job.id, 'info', 'No cookie popup found');
      }
    } catch (cookieError) {
      // Ignore cookie popup errors - it might not be present
      await this.log(job.id, 'debug', 'Cookie popup handling skipped');
    }

    // STEP 1: Detect total number of pages BEFORE scraping
    const totalPagesAvailable = await adapter.getTotalPages(page);
    await this.log(job.id, 'info', `Total pages available: ${totalPagesAvailable}`);

    // STEP 2: Determine how many pages to scrape
    const maxPages = job.parameters.maxPages || 10; // Default to 10 pages max
    const pagesToScrape = maxPages === 999 ? totalPagesAvailable : Math.min(maxPages, totalPagesAvailable);
    
    await this.log(
      job.id,
      'info',
      `Will scrape ${pagesToScrape} pages (requested: ${maxPages === 999 ? 'ALL' : maxPages}, available: ${totalPagesAvailable})`
    );

    // Extract data
    const items: any[] = [];
    let pagesScraped = 0;
    const rateLimit = adapter.getRateLimit();
    const rateLimitingEnabled = isRateLimitingEnabled();

    if (rateLimitingEnabled) {
      await this.log(
        job.id,
        'info',
        `Rate limiting enabled: ${rateLimit.min}-${rateLimit.max}ms delays`
      );
    } else {
      await this.log(job.id, 'info', 'Rate limiting disabled (test mode)');
    }

    // STEP 3: Scrape pages until we reach the limit
    do {
      await this.log(job.id, 'info', `Scraping page ${pagesScraped + 1} of ${pagesToScrape}`);

      // Small delay before extraction (simulate human reading time)
      if (rateLimitingEnabled && pagesScraped > 0) {
        const delayMs = await randomDelay(1000, 2000);
        await this.log(
          job.id,
          'debug',
          `Waited ${delayMs}ms before extraction`
        );
      }

      const pageItems = await adapter.extractData(page);
      items.push(...pageItems);
      pagesScraped++;

      // Update progress
      await updateJobStatus(job.id, 'running', {
        pages_scraped: pagesScraped,
        items_extracted: items.length,
      });

      // Check if we've reached the target number of pages
      if (pagesScraped >= pagesToScrape) {
        await this.log(
          job.id,
          'info',
          `Reached target pages (${pagesToScrape})`
        );
        break;
      }

      // Check for next page (safety check)
      const hasNext = await adapter.hasNextPage(page);
      if (!hasNext) {
        await this.log(job.id, 'info', 'No more pages available (reached end)');
        break;
      }

      // Delay before navigating to next page (rate limiting)
      if (rateLimitingEnabled) {
        const delayMs = await randomDelay(rateLimit.min, rateLimit.max);
        await this.log(
          job.id,
          'info',
          `Waiting ${(delayMs / 1000).toFixed(1)}s before next page...`
        );
      }

      await adapter.goToNextPage(page);
    } while (true);

    // Save results
    await this.log(job.id, 'info', `Saving ${items.length} items`);
    const filePath = await this.saveResults(job, items);

    await this.log(job.id, 'info', 'Job completed successfully');

    return {
      items,
      pagesScraped,
      itemsExtracted: items.length,
    };
  }

  /**
   * Epic 7: Execute enrichment job (detail pages)
   */
  private async executeEnrichment(job: QueueJob, page: Page): Promise<WorkerResult> {
    const { venueUrls, originalData } = job.parameters;

    if (!venueUrls || !Array.isArray(venueUrls) || venueUrls.length === 0) {
      throw new Error('Enrichment job requires venueUrls parameter (array of URLs)');
    }

    await this.log(job.id, 'info', `Enriching ${venueUrls.length} venues`);

    const adapter = this.getAdapter(job);
    const rateLimit = adapter.getDetailRateLimit();
    const rateLimitingEnabled = isRateLimitingEnabled();
    const enrichedItems: any[] = [];
    let itemsEnriched = 0;

    if (rateLimitingEnabled) {
      await this.log(
        job.id,
        'info',
        `Rate limiting enabled: ${rateLimit.min}-${rateLimit.max}ms delays`
      );
    }

    // Create a map of URLs to original data for easy lookup
    const originalDataMap = new Map();
    if (originalData && Array.isArray(originalData)) {
      originalData.forEach((item: any) => {
        if (item.url) {
          originalDataMap.set(item.url, item);
        }
      });
    }

    for (let i = 0; i < venueUrls.length; i++) {
      const venueUrl = venueUrls[i];
      
      try {
        await this.log(job.id, 'info', `Enriching venue ${i + 1}/${venueUrls.length}: ${venueUrl}`);

        // Extract detailed data
        const details = await adapter.extractDetailedData(page, venueUrl);
        
        // Get original data for this venue (if available)
        const originalVenueData = originalDataMap.get(venueUrl) || {};
        
        // Merge original data with enriched details
        enrichedItems.push({
          ...originalVenueData, // Include name, location, rating, etc. from original scrape
          ...details,           // Add enriched details (website, phone, socials)
          url: venueUrl,        // Ensure URL is always present
        });
        
        itemsEnriched++;

        // Update progress
        await updateJobStatus(job.id, 'running', {
          items_extracted: itemsEnriched,
        });

        // Rate limiting between venues
        if (rateLimitingEnabled && i < venueUrls.length - 1) {
          const delayMs = await randomDelay(rateLimit.min, rateLimit.max);
          await this.log(
            job.id,
            'info',
            `Waiting ${(delayMs / 1000).toFixed(1)}s before next venue...`
          );
        }
      } catch (error) {
        await this.log(
          job.id,
          'warn',
          `Failed to enrich ${venueUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        
        // Get original data for this venue (if available)
        const originalVenueData = originalDataMap.get(venueUrl) || {};
        
        // Continue with next venue, include original data + error
        enrichedItems.push({
          ...originalVenueData,
          url: venueUrl,
          enrichment_error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Save results
    await this.log(job.id, 'info', `Saving ${enrichedItems.length} enriched items`);
    const filePath = await this.saveResults(job, enrichedItems);

    await this.log(job.id, 'info', `Enrichment completed: ${itemsEnriched}/${venueUrls.length} successful`);

    return {
      items: enrichedItems,
      pagesScraped: 0,
      itemsExtracted: enrichedItems.length,
      itemsEnriched,
    };
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private getAdapter(job: QueueJob) {
    switch (job.site) {
      case 'theknot':
        return new TheKnotAdapter({ parameters: job.parameters });
      default:
        throw new Error(`Unknown site: ${job.site}`);
    }
  }

  private async saveResults(job: QueueJob, items: any[]): Promise<string> {
    const baseFileName = job.id;
    const primaryFormat = job.format;
    const primaryFilePath = join('data', `${baseFileName}.${primaryFormat}`);

    // Ensure data directory exists
    await mkdir('data', { recursive: true });

    // Save in primary format
    if (primaryFormat === 'csv') {
      await exportToCSV(items, primaryFilePath);
    } else {
      await exportToJSON(items, primaryFilePath);
    }

    // Also save in the other format for convenience
    const secondaryFormat = primaryFormat === 'csv' ? 'json' : 'csv';
    const secondaryFilePath = join('data', `${baseFileName}.${secondaryFormat}`);
    
    if (secondaryFormat === 'csv') {
      await exportToCSV(items, secondaryFilePath);
    } else {
      await exportToJSON(items, secondaryFilePath);
    }

    return primaryFilePath;
  }

  private async log(
    jobId: string,
    level: 'info' | 'error' | 'warn' | 'debug',
    message: string
  ): Promise<void> {
    await createJobLog({
      job_id: jobId,
      level,
      message,
      context: null,
    });
    console.log(`[${level.toUpperCase()}] Job ${jobId}: ${message}`);
  }
}
