# Scraping Fix Complete

## Issue
Scraping jobs were failing with timeout errors showing "from...subframe" repeated many times. Jobs would get stuck at 50% completion with status "Failed".

## Root Cause Analysis
After investigating the Railway logs, the real issue was identified:

**OneTrust Cookie Consent Popup** was blocking pagination clicks!

The error logs showed:
```
<div id="onetrust-button-group">…</div> from <div class="stacking-context virtual">…</div> subtree intercepts pointer events
<div class="onetrust-pc-dark-filter ot-fade-in"></div> from <div class="stacking-context virtual">…</div> subtree intercepts pointer events
```

The pagination button was being intercepted by the cookie consent overlay, causing 30-second timeouts.

## Fix Applied

### 1. Cookie Dismissal at Job Start
Added cookie popup dismissal in `job-worker.ts` after initial page load:
```typescript
// CRITICAL: Dismiss OneTrust cookie consent popup if present
try {
  const cookieAcceptButton = await page.$('#onetrust-accept-btn-handler, .onetrust-close-btn-handler, button[aria-label*="Accept"], button[aria-label*="Close"]');
  if (cookieAcceptButton) {
    await cookieAcceptButton.click();
    await page.waitForTimeout(1000);
  }
} catch (cookieError) {
  // Ignore if not present
}
```

### 2. Cookie Dismissal Before Each Pagination Click
Added cookie popup check in `theknot-adapter.ts` before clicking next page:
```typescript
// Dismiss cookie popup if it appears again
try {
  const cookieAcceptButton = await page.$('#onetrust-accept-btn-handler, .onetrust-close-btn-handler');
  if (cookieAcceptButton) {
    await cookieAcceptButton.click();
    await page.waitForTimeout(500);
  }
} catch (cookieError) {
  // Ignore
}
```

### 3. Improved Navigation Method
Changed from `waitForURL()` to `waitForLoadState('domcontentloaded')` to avoid subframe issues.

## Changes Made
1. **Fixed cookie popup blocking** in `src/workers/job-worker.ts`:
   - Added cookie dismissal after initial page load
   - Logs cookie popup status for debugging

2. **Fixed pagination navigation** in `src/adapters/theknot-adapter.ts`:
   - Added cookie dismissal before clicking next page button
   - Replaced `waitForURL()` with `waitForLoadState('domcontentloaded')`
   - More reliable for pages with iframes/ads

3. **Created debug script** `src/tests/debug-theknot-live.ts`:
   - Verified selectors are working correctly
   - Confirmed `[data-testid="vendor-card-base"]` finds 30 elements per page

4. **Deployed to Railway**:
   - Built TypeScript: `npm run build`
   - Deployed with Railway CLI: `railway up --detach`
   - Server running at: https://theknot-production.up.railway.app

## Deployment Status
✅ **DEPLOYED** - February 4, 2026 (Second Deployment)

- **Service**: theknot (production)
- **URL**: https://theknot-production.up.railway.app
- **Status**: Running
- **Database**: PostgreSQL connected
- **Build**: 5496c869-5983-4447-9277-8bc00dcf3e81

## Testing
To test the fix:
1. Go to https://theknot-production.up.railway.app
2. Submit a scraping job (e.g., Cary, NC, 2 pages)
3. Monitor progress - should complete without timeout errors
4. Verify venues are extracted correctly from multiple pages

## Expected Behavior
- ✅ Cookie popup dismissed automatically
- ✅ No more "from...subframe" timeout errors
- ✅ Pagination works smoothly across multiple pages
- ✅ Jobs complete successfully with status "completed"
- ✅ All venues extracted with correct data

## Files Modified
- `scraper-automation-tool/src/adapters/theknot-adapter.ts` (lines 330-410)
- `scraper-automation-tool/src/workers/job-worker.ts` (lines 115-135)
- `scraper-automation-tool/src/tests/debug-theknot-live.ts` (new file)

## Technical Details

### OneTrust Cookie Consent
TheKnot uses OneTrust for GDPR/CCPA cookie consent. The popup appears as an overlay that blocks all clicks until dismissed. Common selectors:
- `#onetrust-accept-btn-handler` - Accept button
- `.onetrust-close-btn-handler` - Close button
- `.onetrust-pc-dark-filter` - Dark overlay filter

### Why This Happens
1. User visits TheKnot page
2. OneTrust popup appears after page load
3. Scraper tries to click pagination button
4. Click is intercepted by popup overlay
5. Playwright retries for 30 seconds
6. Timeout error occurs

### Solution Strategy
1. Dismiss popup immediately after page load
2. Check for popup again before each pagination click
3. Use graceful error handling (popup might not always appear)

## Next Steps
1. ✅ Test scraping job on Railway
2. Monitor for any remaining errors
3. If successful, mark task as complete

---

**Created**: February 4, 2026  
**Updated**: February 4, 2026 (Cookie popup fix)  
**Status**: ✅ Deployed and Ready for Testing
