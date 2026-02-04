import { chromium } from 'playwright';

async function debugTheKnot() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('Navigating to TheKnot...');
    await page.goto('https://www.theknot.com/marketplace/wedding-reception-venues-charlotte-nc', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    console.log('Waiting for page to load...');
    await page.waitForTimeout(5000);

    // Check for different possible selectors
    const selectors = [
      '[data-testid="vendor-card-base"]',
      '[data-testid="vendor-card"]',
      '[class*="vendor-card"]',
      '[class*="VendorCard"]',
      'article',
      '[role="article"]',
      'a[href*="/marketplace/"]',
    ];

    console.log('\nChecking selectors:');
    for (const selector of selectors) {
      const count = await page.locator(selector).count();
      console.log(`${selector}: ${count} elements`);
      
      if (count > 0) {
        // Get the HTML of the first element
        const html = await page.locator(selector).first().innerHTML();
        console.log(`\nFirst element HTML (truncated):`);
        console.log(html.substring(0, 500));
        break;
      }
    }

    // Check page title
    const title = await page.title();
    console.log(`\nPage title: ${title}`);

    // Check if there's any error message
    const bodyText = await page.textContent('body');
    if (bodyText?.includes('no results') || bodyText?.includes('No results')) {
      console.log('\n⚠️  Page shows "no results"');
    }

    console.log('\nPress Ctrl+C to exit...');
    await page.waitForTimeout(60000);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugTheKnot();
