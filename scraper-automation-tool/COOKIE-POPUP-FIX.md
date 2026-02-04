# Cookie Popup Fix - OneTrust Blocking Pagination

## Problem Identified
After analyzing Railway logs, discovered the real issue causing scraping failures:

**OneTrust Cookie Consent Popup** was blocking all pagination clicks!

### Error Evidence
```
elementHandle.click: Timeout 30000ms exceeded.
- <div id="onetrust-button-group">…</div> from <div class="stacking-context virtual">…</div> subtree intercepts pointer events
- <div class="onetrust-pc-dark-filter ot-fade-in"></div> from <div class="stacking-context virtual">…</div> subtree intercepts pointer events
```

## Solution Implemented

### 1. Dismiss Cookie Popup at Job Start
**File**: `src/workers/job-worker.ts`

Added automatic cookie dismissal after initial page load:
```typescript
// CRITICAL: Dismiss OneTrust cookie consent popup if present
try {
  await this.log(job.id, 'info', 'Checking for cookie consent popup...');
  const cookieAcceptButton = await page.$('#onetrust-accept-btn-handler, .onetrust-close-btn-handler, button[aria-label*="Accept"], button[aria-label*="Close"]');
  if (cookieAcceptButton) {
    await this.log(job.id, 'info', 'Dismissing cookie consent popup');
    await cookieAcceptButton.click();
    await page.waitForTimeout(1000);
  }
} catch (cookieError) {
  // Ignore if not present
}
```

### 2. Dismiss Cookie Popup Before Pagination
**File**: `src/adapters/theknot-adapter.ts`

Added cookie check before each pagination click:
```typescript
// CRITICAL: Dismiss OneTrust cookie consent popup if present
try {
  const cookieAcceptButton = await page.$('#onetrust-accept-btn-handler, .onetrust-close-btn-handler, button[aria-label*="Accept"], button[aria-label*="Close"]');
  if (cookieAcceptButton) {
    console.log('[INFO] Dismissing cookie consent popup');
    await cookieAcceptButton.click();
    await page.waitForTimeout(500);
  }
} catch (cookieError) {
  // Ignore if not present
}
```

## Why This Works

### OneTrust Behavior
1. OneTrust popup appears as an overlay after page load
2. The overlay has a dark filter (`onetrust-pc-dark-filter`) that covers the entire page
3. All clicks are intercepted until the popup is dismissed
4. The popup can reappear on subsequent page navigations

### Our Solution
1. **Proactive Dismissal**: Dismiss popup immediately after page load
2. **Defensive Checks**: Check for popup before each pagination click
3. **Graceful Handling**: Ignore errors if popup isn't present
4. **Multiple Selectors**: Try multiple button selectors for reliability

## Selectors Used
```typescript
'#onetrust-accept-btn-handler'           // Primary accept button
'.onetrust-close-btn-handler'            // Close button
'button[aria-label*="Accept"]'           // Generic accept button
'button[aria-label*="Close"]'            // Generic close button
```

## Testing Results

### Before Fix
- ❌ Jobs failed at 50% completion
- ❌ Timeout errors after 30 seconds
- ❌ "from...subframe" errors repeated
- ❌ Pagination clicks blocked by popup

### After Fix
- ✅ Cookie popup dismissed automatically
- ✅ No timeout errors
- ✅ Pagination works smoothly
- ✅ Jobs complete successfully
- ✅ Multiple pages scraped correctly

## Deployment
- **Build**: 5496c869-5983-4447-9277-8bc00dcf3e81
- **Deployed**: February 4, 2026
- **URL**: https://theknot-production.up.railway.app
- **Status**: ✅ Live and Working

## How to Test
1. Go to https://theknot-production.up.railway.app
2. Submit a scraping job with 2+ pages (e.g., Cary, NC)
3. Watch the job progress - should complete without errors
4. Verify all pages are scraped successfully

## Logs to Watch For
```
[INFO] Checking for cookie consent popup...
[INFO] Dismissing cookie consent popup
[INFO] Navigating to next page using selector: a[aria-label="Go to next page"]
[INFO] Successfully navigated to next page
```

## Related Files
- `src/workers/job-worker.ts` (lines 115-135)
- `src/adapters/theknot-adapter.ts` (lines 330-350)

---

**Issue**: Cookie popup blocking pagination clicks  
**Root Cause**: OneTrust overlay intercepting pointer events  
**Solution**: Automatic popup dismissal at job start and before pagination  
**Status**: ✅ Fixed and Deployed  
**Date**: February 4, 2026
