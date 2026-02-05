/**
 * Webhook Notification Utility
 * 
 * Sends HTTP POST notifications to webhook URLs when jobs complete or fail.
 */

interface WebhookPayload {
  jobId: string;
  status: 'completed' | 'failed';
  site: string;
  timestamp: string;
  data?: {
    count?: number;
    itemsExtracted?: number;
    pagesScraped?: number;
    durationMs?: number;
    resultFilePath?: string;
    venues?: Array<{
      name: string;
      location: string;
      rating: number | string;
      reviews: number;
      price: string;
      url: string;
    }>;
    columns?: {
      count: number;
      name: string[];
      location: string[];
      rating: (number | string)[];
      reviews: number[];
      price: string[];
      url: string[];
    };
  };
  error?: {
    message: string;
  };
}

/**
 * Send webhook notification
 * 
 * @param webhookUrl - The URL to send the notification to
 * @param payload - The notification payload
 * @returns Promise<boolean> - True if successful, false otherwise
 */
export async function sendWebhookNotification(
  webhookUrl: string,
  payload: WebhookPayload
): Promise<boolean> {
  try {
    console.log(`[WEBHOOK] Sending notification to ${webhookUrl}`);
    console.log(`[WEBHOOK] Payload:`, JSON.stringify(payload, null, 2));

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ScraperAutomationTool/1.0',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log(`[WEBHOOK] ✅ Notification sent successfully (${response.status})`);
      return true;
    } else {
      const errorText = await response.text();
      console.error(
        `[WEBHOOK] ❌ Notification failed (${response.status}): ${errorText}`
      );
      return false;
    }
  } catch (error) {
    console.error(
      `[WEBHOOK] ❌ Notification error:`,
      error instanceof Error ? error.message : 'Unknown error'
    );
    return false;
  }
}

/**
 * Create webhook payload for completed job
 */
export function createCompletedPayload(
  jobId: string,
  site: string,
  result: {
    itemsExtracted: number;
    pagesScraped: number;
    durationMs: number;
    resultFilePath: string;
    items: any[];
  }
): WebhookPayload {
  // Transform items into venue objects (easier for automation tools)
  const venues = result.items.map((item) => ({
    name: item.name || '',
    location: item.location || '',
    rating: item.rating || 'New',
    reviews: item.reviews || 0,
    price: item.price || '',
    url: item.url || '',
  }));

  // Also provide column arrays for bulk operations
  const columnData = {
    count: result.items.length,
    name: venues.map(v => v.name),
    location: venues.map(v => v.location),
    rating: venues.map(v => v.rating),
    reviews: venues.map(v => v.reviews),
    price: venues.map(v => v.price),
    url: venues.map(v => v.url),
  };

  return {
    jobId,
    status: 'completed',
    site,
    timestamp: new Date().toISOString(),
    data: {
      // Summary info
      count: result.items.length,
      itemsExtracted: result.itemsExtracted,
      pagesScraped: result.pagesScraped,
      durationMs: result.durationMs,
      resultFilePath: result.resultFilePath,
      
      // Individual venue objects for easy looping
      venues,
      
      // Column arrays for bulk operations
      columns: columnData,
    },
  };
}

/**
 * Create webhook payload for failed job
 */
export function createFailedPayload(
  jobId: string,
  site: string,
  errorMessage: string
): WebhookPayload {
  return {
    jobId,
    status: 'failed',
    site,
    timestamp: new Date().toISOString(),
    error: {
      message: errorMessage,
    },
  };
}
