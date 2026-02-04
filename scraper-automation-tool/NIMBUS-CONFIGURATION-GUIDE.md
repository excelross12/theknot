# Nimbus Automation Configuration Guide

**Date:** February 4, 2026  
**Purpose:** Configure Nimbus to properly handle webhook data and create multiple rows

## Problem

Nimbus is showing all data in a single row because the webhook sends **arrays** (lists), not individual values. You need to loop through the arrays to create one row per venue.

## Solution: Add a Loop Action

### Step 1: Webhook Trigger (Already Done)

Your webhook trigger is receiving the data correctly. The payload looks like:

```json
{
  "data": {
    "name": ["Venue 1", "Venue 2", "Venue 3", ...],
    "location": ["City 1", "City 2", "City 3", ...],
    "rating": [4.9, 4.8, 4.7, ...],
    "reviews": [245, 189, 156, ...],
    "price": ["$$$$", "$$$", "$$$", ...],
    "url": ["https://...", "https://...", "https://...", ...]
  }
}
```

### Step 2: Add Loop/Iterator Action

**Between the Webhook Trigger and Create Row action:**

1. **Delete the current "Create row" action** (we'll recreate it inside a loop)

2. **Add a "Loop" or "For Each" action** (Nimbus might call it "Iterator" or "Repeat")
   - **Loop Type:** For Each Item
   - **Array to Loop:** Use a custom expression to get the count
   - **Loop Count:** `{{1. Webhook Trigger body data name.length}}` (this gets the number of venues)

### Step 3: Inside the Loop - Create Row Action

Now add the "Create row in existing table" action **INSIDE the loop**:

**Configure the row data using array indices:**

- **Name:** `{{1. Webhook Trigger body data name[Loop.index]}}`
- **Location:** `{{1. Webhook Trigger body data location[Loop.index]}}`
- **Rating:** `{{1. Webhook Trigger body data rating[Loop.index]}}`
- **Reviews:** `{{1. Webhook Trigger body data reviews[Loop.index]}}`
- **Price:** `{{1. Webhook Trigger body data price[Loop.index]}}`
- **URL:** `{{1. Webhook Trigger body data url[Loop.index]}}`

**Note:** `Loop.index` is the current iteration number (0, 1, 2, 3, ...). This accesses each venue one at a time.

## Alternative: Use JavaScript/Code Action

If Nimbus doesn't have a good loop action, you can use a JavaScript/Code action:

### Step 1: Add JavaScript Action

After the webhook trigger, add a "JavaScript" or "Code" action:

```javascript
// Get the data from webhook
const data = input.body.data;

// Create an array of venue objects
const venues = [];

// Loop through all venues
for (let i = 0; i < data.name.length; i++) {
  venues.push({
    name: data.name[i],
    location: data.location[i],
    rating: data.rating[i],
    reviews: data.reviews[i],
    price: data.price[i],
    url: data.url[i]
  });
}

// Return the venues array
return { venues: venues };
```

### Step 2: Add Loop Action

Add a "For Each" loop that iterates over `{{JavaScript.venues}}`:

### Step 3: Create Row Inside Loop

Inside the loop, create a row with:

- **Name:** `{{Loop.item.name}}`
- **Location:** `{{Loop.item.location}}`
- **Rating:** `{{Loop.item.rating}}`
- **Reviews:** `{{Loop.item.reviews}}`
- **Price:** `{{Loop.item.price}}`
- **URL:** `{{Loop.item.url}}`

## Visual Workflow

```
┌─────────────────────┐
│ 1. Webhook Trigger  │
│ (Receives arrays)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 2. Loop/Iterator    │
│ Count: data.name.   │
│        length       │
└──────────┬──────────┘
           │
           ▼ (Repeats for each venue)
┌─────────────────────┐
│ 3. Create Row       │
│ Name: name[index]   │
│ Location: loc[index]│
│ Rating: rate[index] │
│ Reviews: rev[index] │
│ Price: price[index] │
│ URL: url[index]     │
└─────────────────────┘
```

## Expected Result

If you scraped 60 venues, the automation will:
1. Receive 1 webhook with 6 arrays (each with 60 items)
2. Loop 60 times
3. Create 60 rows in your database

Each row will have:
- Name: Single venue name
- Location: Single location
- Rating: Single rating number
- Reviews: Single review count
- Price: Single price string
- URL: Single URL

## Testing

### Test with Small Dataset

1. Go to https://theknot-production.up.railway.app
2. Set **Pages: 1** (this will give you ~30 venues)
3. Add your webhook URL
4. Start scraping
5. Check Nimbus - you should see 30 rows created

### Verify Data

Check that each row has:
- ✅ Single name (not an array)
- ✅ Single location (not an array)
- ✅ Single rating (not an array)
- ✅ Single review count (not an array)
- ✅ Single price (not an array)
- ✅ Single URL (not an array)

## Troubleshooting

### Issue: Still seeing arrays in cells

**Problem:** Loop is not configured correctly

**Solution:** Make sure you're using `[Loop.index]` or `[Loop.item]` to access individual items

### Issue: Only first venue is created

**Problem:** Loop count is wrong

**Solution:** Set loop count to `{{1. Webhook Trigger body data name.length}}`

### Issue: "undefined" in cells

**Problem:** Wrong field path

**Solution:** Check the exact field names in the webhook payload. They should be:
- `body.data.name`
- `body.data.location`
- `body.data.rating`
- `body.data.reviews`
- `body.data.price`
- `body.data.url`

## Nimbus-Specific Syntax

Nimbus might use different syntax for accessing data. Common patterns:

### Option 1: Dot Notation
```
{{1. Webhook Trigger.body.data.name[Loop.index]}}
```

### Option 2: Bracket Notation
```
{{1. Webhook Trigger.body.data.name.[Loop.index]}}
```

### Option 3: Variable Reference
```
{{Webhook.data.name[i]}}
```

**Try different syntaxes if one doesn't work!**

## Summary

The key is to **loop through the arrays** and create one row per venue. The webhook sends all data at once in arrays, so you need to iterate through them to create individual database rows.

---

**Need Help?** 
- Check Nimbus documentation for "Loop" or "Iterator" actions
- Look for "For Each" or "Repeat" actions
- Try the JavaScript/Code action if loops are confusing
