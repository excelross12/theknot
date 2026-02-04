import type { Page } from 'playwright';
import { BaseSiteAdapter } from './base-adapter';
import type { ScrapedItem } from '../types/worker';

export class TheKnotAdapter extends BaseSiteAdapter {
  /**
   * TheKnot Rate Limiting (Story 2.5)
   *
   * Strategy: 2-4 second delays between page navigations
   * Rationale:
   * - Respectful scraping (don't overload servers)
   * - Avoid bot detection
   * - Random delays mimic human behavior
   */
  getRateLimit(): { min: number; max: number } {
    return { min: 2000, max: 4000 }; // 2-4 seconds
  }

  buildUrl(): string {
    const { location, category, page } = this.config.parameters;

    /**
     * TheKnot URL Structure (researched 2026-01-25):
     *
     * Pattern: https://www.theknot.com/marketplace/{category}-{location}
     *
     * Examples:
     * - https://www.theknot.com/marketplace/wedding-reception-venues-seattle-wa
     * - https://www.theknot.com/marketplace/wedding-reception-venues-los-angeles-ca
     * - https://www.theknot.com/marketplace/wedding-ceremony-venues-new-york-ny
     *
     * Pagination: Uses query parameter ?page={page}
     * - Page 1: No parameter (default)
     * - Page 2+: ?page=2, ?page=3, etc.
     *
     * Location Format: city-state (e.g., "seattle-wa", "los-angeles-ca")
     * Category Format: kebab-case (e.g., "wedding-reception-venues")
     */

    // Default values
    const defaultCategory = 'wedding-reception-venues';
    const defaultLocation = 'seattle-wa';

    // Use provided values or defaults
    const categorySlug = category || defaultCategory;
    const locationSlug = location || defaultLocation;

    // Build base URL: marketplace/{category}-{location}
    let url = `https://www.theknot.com/marketplace/${categorySlug}-${locationSlug}`;

    // Add pagination if page > 1
    if (page && page > 1) {
      url += `?page=${page}`;
    }

    return url;
  }

  /**
   * Get total number of pages available
   * 
   * Tested and validated on:
   * - New York, NY: 9 pages (HIGH reliability)
   * - Los Angeles, CA: 15 pages (HIGH reliability)
   * 
   * Strategy Priority:
   * 1. Text pattern "page X of Y" (MOST RELIABLE)
   * 2. Numbered page links with aria-labels
   * 3. Pagination nav with numbered links
   */
  async getTotalPages(page: Page): Promise<number> {
    try {
      console.log('[INFO] Detecting total number of pages...');
      
      // Wait for pagination to load
      await page.waitForTimeout(2000);
      
      // Try to find pagination elements
      const totalPages = await page.evaluate(() => {
        // @ts-ignore - Running in browser context
        // Strategy 1: Look for "page X of Y" text (MOST RELIABLE)
        const pageText = document.body.textContent || '';
        const pageMatch = pageText.match(/page\s+\d+\s+of\s+(\d+)/i);
        if (pageMatch) {
          const total = parseInt(pageMatch[1]);
          console.log(`[INFO] Found via text pattern: ${total} pages`);
          return total;
        }
        
        // @ts-ignore - Running in browser context
        // Strategy 2: Look for numbered page links
        const pageLinks = Array.from(document.querySelectorAll('a[aria-label*="Go to page"], button[aria-label*="Go to page"]'));
        if (pageLinks.length > 0) {
          const pageNumbers = pageLinks.map((link: any) => {
            const match = link.getAttribute('aria-label')?.match(/page (\d+)/i);
            return match ? parseInt(match[1]) : 0;
          }).filter(n => n > 0);
          
          if (pageNumbers.length > 0) {
            const total = Math.max(...pageNumbers);
            console.log(`[INFO] Found via numbered links: ${total} pages`);
            return total;
          }
        }
        
        // @ts-ignore - Running in browser context
        // Strategy 3: Look for pagination nav with numbered links
        const paginationNav = document.querySelector('nav[aria-label*="pagination"], [class*="pagination"]');
        if (paginationNav) {
          const links = Array.from(paginationNav.querySelectorAll('a, button'));
          const numbers = links.map((link: any) => {
            const text = link.textContent?.trim() || '';
            const num = parseInt(text);
            return isNaN(num) ? 0 : num;
          }).filter(n => n > 0);
          
          if (numbers.length > 0) {
            const total = Math.max(...numbers);
            console.log(`[INFO] Found via pagination nav: ${total} pages`);
            return total;
          }
        }
        
        // Default: assume at least 1 page
        console.log('[WARN] No pagination found, defaulting to 1 page');
        return 1;
      });
      
      console.log(`[INFO] Detected ${totalPages} total pages`);
      return totalPages;
    } catch (error) {
      console.warn('[WARN] Error detecting total pages:', error);
      return 1; // Default to 1 page
    }
  }

  async extractData(page: Page): Promise<ScrapedItem[]> {
    /**
     * TheKnot Data Extraction - Completely Rewritten
     * 
     * Uses page.$$eval to extract all data in one go (more reliable)
     */

    console.log('[INFO] Extracting venue data from TheKnot page...');

    // Wait for venue cards to load
    try {
      await page.waitForSelector('[data-testid="vendor-card-base"]', {
        timeout: 10000,
      });
    } catch (error) {
      console.warn('[WARN] No venue cards found on page');
      return [];
    }

    // Extract all data using page.$$eval (runs in browser context)
    const items = await page.$$eval('[data-testid="vendor-card-base"]', (cards) => {
      return cards.map((card) => {
        // Extract name from aria-labelledby attribute
        let name = '';
        const ariaLabelledBy = card.getAttribute('aria-labelledby');
        if (ariaLabelledBy) {
          // @ts-ignore - Running in browser context
          const labelElement = document.getElementById(ariaLabelledBy);
          if (labelElement) {
            name = labelElement.textContent?.trim() || '';
          }
        }

        // Extract URL from the first link with marketplace href
        const nameLink = card.querySelector('a[href*="/marketplace/"]');
        const href = nameLink?.getAttribute('href') || '';
        const url = href.startsWith('http') ? href : `https://www.theknot.com${href}`;

        // Extract location - look for text that contains city/state pattern
        const locationElements = card.querySelectorAll('[class*="location"], [class*="address"]');
        let location = '';
        for (const el of locationElements) {
          const text = el.textContent?.trim() || '';
          // Remove "Location:" prefix and clean up
          let cleanText = text.replace(/Location:/gi, '').trim();
          
          // Try pattern 1: "City, ST" (e.g., "New York, NY")
          let locationMatch = cleanText.match(/([A-Za-z\s]+),\s*([A-Z]{2})/);
          if (locationMatch) {
            const city = locationMatch[1].trim();
            const state = locationMatch[2];
            location = `${city}, ${state}`;
            break;
          }
          
          // Try pattern 2: "CityNameStateNameStateName" (e.g., "New York CityNew York City")
          // Extract just the first occurrence before duplication
          if (cleanText.length > 0 && !location) {
            // Check if text is duplicated (same text appears twice)
            const halfLength = Math.floor(cleanText.length / 2);
            const firstHalf = cleanText.substring(0, halfLength);
            const secondHalf = cleanText.substring(halfLength);
            
            if (firstHalf === secondHalf) {
              location = firstHalf;
              break;
            }
            
            // If not duplicated but has content, use it
            if (cleanText.length > 3) {
              location = cleanText;
              break;
            }
          }
        }

        // Extract rating and reviews
        let rating: number | string | undefined;
        let reviews: number | undefined;
        
        // Check if venue is marked as "New" - look for badge with "New" text
        const allElements = card.querySelectorAll('*');
        let foundNewBadge = false;
        
        for (const el of allElements) {
          const className = String(el.className || '');
          const text = el.textContent?.trim() || '';
          
          // Check for "New" badge (class contains "badge" or "new", and text is exactly "New")
          if ((className.includes('badge') || className.includes('new') || className.includes('review')) && 
              text === 'New') {
            rating = 'New';
            foundNewBadge = true;
            break;
          }
        }
        
        // If not a new venue, try to extract rating
        if (!foundNewBadge) {
          const ratingElements = card.querySelectorAll('[class*="rating"], [class*="star"]');
          for (const el of ratingElements) {
            const text = el.textContent || '';
            const ratingMatch = text.match(/([\d.]+)/);
            if (ratingMatch) {
              const ratingValue = parseFloat(ratingMatch[1]);
              // Only set rating if it's a valid number > 0
              if (ratingValue > 0) {
                rating = ratingValue;
              } else if (ratingValue === 0) {
                rating = 0; // Explicitly show 0 rating
              }
              break;
            }
          }
        }

        // Try to find review count (usually in parentheses or near "Reviews")
        const reviewElements = card.querySelectorAll('[class*="review"]');
        for (const el of reviewElements) {
          const text = el.textContent || '';
          const reviewMatch = text.match(/\((\d+)\)|(\d+)\s*Reviews?/i);
          if (reviewMatch) {
            reviews = parseInt(reviewMatch[1] || reviewMatch[2]);
            break;
          }
        }

        // Extract price
        let price: string | undefined;
        const priceElements = card.querySelectorAll('[class*="price"], [class*="starting"]');
        for (const el of priceElements) {
          const text = el.textContent?.trim() || '';
          if (text.toLowerCase().includes('starting') || text.includes('$')) {
            price = text;
            break;
          }
        }

        return {
          name,
          location: location || undefined,
          rating,
          reviews,
          price,
          url,
        };
      });
    });

    // Filter out items with missing required fields
    const validItems = items.filter(item => item.name && item.url);
    
    console.log(`[INFO] Successfully extracted ${validItems.length} venues (${items.length - validItems.length} skipped)`);
    return validItems;
  }

  async hasNextPage(page: Page): Promise<boolean> {
    /**
     * Story 2.4: Pagination Detection
     *
     * TheKnot uses pagination links with aria-label="Go to next page"
     * or "Go to page X" where X is the next page number.
     *
     * Strategy: Look for "Go to next page" link with multiple fallback selectors
     */
    try {
      // Try multiple selectors for the next page button
      const selectors = [
        'a[aria-label="Go to next page"]',
        'a[aria-label*="next"]',
        'button[aria-label="Go to next page"]',
        'button[aria-label*="next"]',
        '[data-testid*="next"]',
        '.pagination a:last-child:not(.disabled)',
        'nav[aria-label*="pagination"] a:last-child'
      ];

      for (const selector of selectors) {
        const nextLink = await page.$(selector);
        if (nextLink) {
          // Check if it's disabled
          const isDisabled = await nextLink.evaluate((el) => {
            return el.hasAttribute('disabled') || 
                   el.classList.contains('disabled') ||
                   el.getAttribute('aria-disabled') === 'true';
          });
          
          if (!isDisabled) {
            console.log(`[INFO] Found next page button with selector: ${selector}`);
            return true;
          }
        }
      }

      console.log('[INFO] No next page button found (end of results)');
      return false;
    } catch (error) {
      console.warn('[WARN] Error checking for next page:', error);
      return false;
    }
  }

  async goToNextPage(page: Page): Promise<void> {
    /**
     * Story 2.4: Pagination Navigation
     *
     * Click the "Go to next page" link and wait for new content to load.
     */
    try {
      // CRITICAL: Dismiss OneTrust cookie consent popup if present
      // This popup blocks clicks on pagination buttons
      try {
        const cookieAcceptButton = await page.$('#onetrust-accept-btn-handler, .onetrust-close-btn-handler, button[aria-label*="Accept"], button[aria-label*="Close"]');
        if (cookieAcceptButton) {
          console.log('[INFO] Dismissing cookie consent popup');
          await cookieAcceptButton.click();
          await page.waitForTimeout(500); // Wait for popup to close
        }
      } catch (cookieError) {
        // Ignore cookie popup errors - it might not be present
        console.log('[DEBUG] No cookie popup found or already dismissed');
      }

      // Try multiple selectors for the next page button
      const selectors = [
        'a[aria-label="Go to next page"]',
        'a[aria-label*="next"]',
        'button[aria-label="Go to next page"]',
        'button[aria-label*="next"]',
        '[data-testid*="next"]',
        '.pagination a:last-child:not(.disabled)',
        'nav[aria-label*="pagination"] a:last-child'
      ];

      let nextLink = null;
      let usedSelector = '';

      for (const selector of selectors) {
        nextLink = await page.$(selector);
        if (nextLink) {
          const isDisabled = await nextLink.evaluate((el) => {
            return el.hasAttribute('disabled') || 
                   el.classList.contains('disabled') ||
                   el.getAttribute('aria-disabled') === 'true';
          });
          
          if (!isDisabled) {
            usedSelector = selector;
            break;
          }
        }
      }

      if (!nextLink) {
        throw new Error('Next page link not found');
      }

      console.log(`[INFO] Navigating to next page using selector: ${usedSelector}`);

      // Get current URL to verify navigation
      const currentUrl = page.url();

      // Click the link and wait for navigation
      await Promise.all([
        page.waitForLoadState('domcontentloaded', { timeout: 15000 }),
        nextLink.click()
      ]);

      // Wait for venue cards to reload
      await page.waitForSelector('[data-testid="vendor-card-base"]', { timeout: 15000 });

      // Small delay to ensure content is stable
      await page.waitForTimeout(1000);

      console.log(`[INFO] Successfully navigated to next page: ${page.url()}`);
    } catch (error) {
      console.error('[ERROR] Failed to navigate to next page:', error);
      throw error;
    }
  }

  /**
   * Epic 7: Detail Enrichment
   * 
   * Extract detailed information from individual venue detail pages.
   * This is a two-pass approach:
   * - Pass 1: Scrape listing pages (existing extractData method)
   * - Pass 2: Enrich with details from venue pages (this method)
   * 
   * Strategy: Target the "social-links" container OR "link--mp-C2SOZ" spans
   * (TheKnot has two different page structures)
   */
  async extractDetailedData(page: Page, venueUrl: string): Promise<Partial<ScrapedItem>> {
    console.log(`[INFO] Extracting detailed data from ${venueUrl}`);

    try {
      // Navigate to venue detail page
      await page.goto(venueUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Wait for page to load
      await page.waitForTimeout(3000);

      // Debug: Check actual URL after navigation
      const actualUrl = page.url();
      console.log(`[INFO] Actual URL after navigation: ${actualUrl}`);
      
      if (actualUrl !== venueUrl) {
        console.log(`[WARN] URL changed! Expected: ${venueUrl}, Got: ${actualUrl}`);
      }

      const details: Partial<ScrapedItem> = {};

      // Strategy 1: Try social-links container (newer page structure)
      const socialLinksContainer = await page.$('[class*="social-links"]');
      
      if (socialLinksContainer) {
        console.log('[INFO] Found social-links container');
        
        // Get all links within the social-links container
        const linksInContainer = await page.$$eval('[class*="social-links"] a[href]', (elements) =>
          elements.map((el) => ({
            href: el.getAttribute('href') || '',
            text: el.textContent?.trim() || '',
            title: el.getAttribute('title') || '',
          }))
        );

        console.log(`[INFO] Found ${linksInContainer.length} links in social-links container`);
        this.extractFromLinks(linksInContainer, details);
      } else {
        console.log('[INFO] Social-links container not found, using fallback');
      }

      // Always check for phone numbers on the entire page
      if (!details.phone) {
        console.log('[INFO] Searching for phone on entire page...');
        const phoneLinks = await page.$$eval('a[href^="tel:"]', (elements) =>
          elements.map((el) => el.getAttribute('href') || '')
        );
        
        if (phoneLinks.length > 0) {
          details.phone = phoneLinks[0].replace('tel:', '').trim();
          console.log(`[INFO] Found phone: ${details.phone}`);
        }
      }

      // Always check for email on the entire page
      if (!details.email) {
        const emailLinks = await page.$$eval('a[href^="mailto:"]', (elements) =>
          elements.map((el) => el.getAttribute('href') || '')
        );
        
        if (emailLinks.length > 0) {
          details.email = emailLinks[0].replace('mailto:', '').trim();
          console.log(`[INFO] Found email: ${details.email}`);
        }
      }

      console.log(`[INFO] Extracted ${Object.keys(details).length} detail fields:`, details);
      return details;
    } catch (error) {
      console.error(`[ERROR] Failed to extract details from ${venueUrl}:`, error);
      return {};
    }
  }

  /**
   * Helper method to extract contact info from a list of links
   */
  private extractFromLinks(links: any[], details: Partial<ScrapedItem>): void {
    links.forEach((link) => {
      if (link.href.startsWith('tel:')) {
        details.phone = link.href.replace('tel:', '').trim();
      } else if (link.href.startsWith('mailto:')) {
        details.email = link.href.replace('mailto:', '').trim();
      } else if (link.href.includes('facebook.com') && !link.href.includes('facebook.com/theknot')) {
        details.facebook = link.href;
      } else if (link.href.includes('instagram.com') && !link.href.includes('instagram.com/theknot')) {
        details.instagram = link.href;
      } else if (link.href.includes('pinterest.com') && !link.href.includes('pinterest.com/theknot')) {
        details.pinterest = link.href;
      } else if ((link.href.includes('twitter.com') || link.href.includes('x.com')) && 
                 !link.href.includes('twitter.com/theknot') && !link.href.includes('x.com/theknot')) {
        details.twitter = link.href;
      } else if (link.href.startsWith('http') && 
                 !link.href.startsWith('https://www.theknot.com') && // Check domain, not URL params
                 !link.href.startsWith('http://www.theknot.com') &&
                 !link.href.startsWith('https://theknot.com') &&
                 !link.href.startsWith('http://theknot.com') &&
                 !link.href.includes('facebook.com') &&
                 !link.href.includes('instagram.com') &&
                 !link.href.includes('pinterest.com') &&
                 !link.href.includes('twitter.com') &&
                 !link.href.includes('google.com') &&
                 !link.href.includes('maps.google')) {
        details.website = link.href;
        details.website_clean = this.cleanUrl(link.href);
      }
    });
  }

  /**
   * Helper method to remove UTM and tracking parameters from URLs
   */
  private cleanUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Remove common tracking parameters
      const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref', 'source'];
      paramsToRemove.forEach(param => urlObj.searchParams.delete(param));
      return urlObj.toString();
    } catch (error) {
      // If URL parsing fails, return original
      return url;
    }
  }

  /**
   * Get rate limit for detail page scraping
   * Slower than listing pages to be more respectful
   */
  getDetailRateLimit(): { min: number; max: number } {
    return { min: 3000, max: 5000 }; // 3-5 seconds (slower than listing pages)
  }
}
