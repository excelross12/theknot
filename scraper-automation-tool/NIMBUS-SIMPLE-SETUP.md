# Nimbus Simple Setup Guide

**Date:** February 4, 2026  
**Commit:** 32faa33  
**Status:** ✅ Code pushed to GitHub (Railway will auto-deploy)

## New Webhook Format (Venues Array)

The webhook now sends data as an array of venue objects, making it super easy to loop in Nimbus!

### New Payload Structure

```json
{
  "jobId": "abc-123",
  "status": "completed",
  "site": "theknot",
  "timestamp": "2026-02-04T16:30:00.000Z",
  "data": {
    "count": 60,
    "itemsExtracted": 60,
    "pagesScraped": 2,
    "durationMs": 45000,
    "resultFilePath": "data/abc-123.json",
    "venues": [
      {
        "name": "The Ballantyne Hotel",
        "location": "Charlotte, NC",
        "rating": 4.9,
        "reviews": 245,
        "price": "$$$$",
        "url": "https://www.theknot.com/marketplace/..."
      },
      {
        "name": "The Mint Museum",
        "location": "Charlotte, NC",
        "rating": 4.8,
        "reviews": 189,
        "price": "$$$",
        "url": "https://www.theknot.com/marketplace/..."
      },
      // ... 58 more venues
    ]
  }
}
```

## Nimbus Configuration (3 Simple Steps)

### Step 1: Webhook Trigger
- Already configured ✅
- Receives `body.data.venues` array

### Step 2: Loop on Venues
- **Action:** Add "Loop" or "For Each" action
- **Items to Loop:** `{{1. Webhook Trigger body data venues}}`
- This will loop through each venue object

### Step 3: Create Row (Inside Loop)
- **Action:** "Create row in existing table"
- **Name:** `{{Loop.item.name}}`
- **Location:** `{{Loop.item.location}}`
- **Rating:** `{{Loop.item.rating}}`
- **Reviews:** `{{Loop.item.reviews}}`
- **Price:** `{{Loop.item.price}}`
- **URL:** `{{Loop.item.url}}`

## Visual Workflow

```
┌─────────────────────────────┐
│ 1. Webhook Trigger          │
│ Receives body.data.venues   │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ 2. Loop on Venues           │
│ Items: body.data.venues     │
└──────────┬──────────────────┘
           │
           ▼ (Repeats 60 times)
┌─────────────────────────────┐
│ 3. Create Row               │
│ Name: Loop.item.name        │
│ Location: Loop.item.location│
│ Rating: Loop.item.rating    │
│ Reviews: Loop.item.reviews  │
│ Price: Loop.item.price      │
│ URL: Loop.item.url          │
└─────────────────────────────┘
```

## Example: Accessing Data

Each venue in the loop has these fields:

| Field | Type | Example | Access |
|-------|------|---------|--------|
| name | string | "The Ballantyne Hotel" | `{{Loop.item.name}}` |
| location | string | "Charlotte, NC" | `{{Loop.item.location}}` |
| rating | number or "New" | 4.9 | `{{Loop.item.rating}}` |
| reviews | number | 245 | `{{Loop.item.reviews}}` |
| price | string | "$$$$" | `{{Loop.item.price}}` |
| url | string | "https://..." | `{{Loop.item.url}}` |

## Testing

### Step 1: Wait for Railway Deployment
Railway will auto-deploy from GitHub in 2-5 minutes.

### Step 2: Run a Test Scrape
1. Go to https://theknot-production.up.railway.app
2. Fill in:
   - Location: Charlotte, NC
   - Pages: 1 (for quick test)
   - Format: JSON
   - Webhook URL: Your Nimbus URL
   - **Show Browser: UNCHECKED**
3. Click "Start Scraping"

### Step 3: Check Nimbus
You should see:
- Loop runs 30 times (1 page = ~30 venues)
- 30 rows created in your database
- Each row has individual values (not arrays)

## Troubleshooting

### Issue: "Loop.item.name" shows as text, not value

**Solution:** Make sure you're using the correct Nimbus syntax. Try:
- `{{Loop.item.name}}`
- `{{2. Loop on Venues.item.name}}`
- `{{venues[].name}}`

### Issue: Only 1 row created

**Problem:** Loop is not configured correctly

**Solution:** Make sure "Items to Loop" is set to `{{1. Webhook Trigger body data venues}}`

### Issue: "venues is undefined"

**Problem:** Railway hasn't deployed the new code yet

**Solution:** Wait 2-5 minutes for Railway to auto-deploy, then try again

## Comparison: Old vs New Format

### Old Format (Column Arrays)
```json
{
  "data": {
    "name": ["Venue 1", "Venue 2", ...],
    "location": ["City 1", "City 2", ...],
    "rating": [4.9, 4.8, ...]
  }
}
```
**Problem:** Hard to loop, need array indexing

### New Format (Venue Objects) ✅
```json
{
  "data": {
    "venues": [
      {"name": "Venue 1", "location": "City 1", "rating": 4.9},
      {"name": "Venue 2", "location": "City 2", "rating": 4.8}
    ]
  }
}
```
**Benefit:** Easy to loop, direct property access

## Summary

- ✅ Webhook now sends `body.data.venues` array
- ✅ Each venue is an object with all 6 fields
- ✅ Loop on `venues` array
- ✅ Access fields with `Loop.item.name`, `Loop.item.location`, etc.
- ✅ No JavaScript needed!

---

**Next Steps:**
1. Wait for Railway to deploy (2-5 minutes)
2. Configure Nimbus loop on `body.data.venues`
3. Test with 1 page scrape
4. Verify 30 rows are created correctly
