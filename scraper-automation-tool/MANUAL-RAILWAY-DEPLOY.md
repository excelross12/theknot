# Manual Railway Deployment Instructions

**Date:** February 4, 2026  
**Commit:** 32faa33  
**Issue:** Railway CLI timing out

## Automatic Deployment (Recommended)

Railway is configured to auto-deploy from GitHub. Since the code is already pushed (commit 32faa33), Railway should automatically deploy within 2-5 minutes.

### Check Auto-Deployment Status

1. Go to https://railway.app
2. Login to your account
3. Find project: "ingenious-reverence"
4. Click on service: "theknot"
5. Look at "Deployments" tab
6. You should see commit `32faa33` - "Change webhook format to venues array"

If the deployment is:
- ✅ **Active** - You're good to go!
- ⏳ **Building** - Wait a few minutes
- ❌ **Failed** - See troubleshooting below

## Manual Deployment (If Auto-Deploy Fails)

### Option 1: Redeploy from Dashboard

1. Go to https://railway.app
2. Find your project: "ingenious-reverence"
3. Click on service: "theknot"
4. Click "Deployments" tab
5. Find the latest deployment (commit 32faa33)
6. Click the three dots (⋮) menu
7. Click "Redeploy"

### Option 2: Trigger New Deployment

1. Make a small change (like adding a comment to a file)
2. Commit and push to GitHub
3. Railway will auto-deploy the new commit

### Option 3: Use Railway Dashboard Deploy

1. Go to https://railway.app
2. Find your project
3. Click "Deploy" button in the top right
4. Select "Deploy from GitHub"
5. Choose branch: "main"
6. Click "Deploy"

## Verify Deployment

### Check Deployment Status

1. Go to Railway dashboard
2. Look for green "Active" status
3. Check deployment logs for errors

### Test the New Webhook Format

1. Go to https://theknot-production.up.railway.app
2. Submit a test job with webhook URL
3. Check Railway logs for webhook payload
4. Look for `"venues": [...]` in the logs

### Expected Log Output

```
[WEBHOOK] Sending notification to https://app.nimbusweb.me/...
[WEBHOOK] Payload: {
  "jobId": "...",
  "status": "completed",
  "data": {
    "count": 30,
    "venues": [
      {
        "name": "Venue Name",
        "location": "City, State",
        "rating": 4.9,
        "reviews": 100,
        "price": "$$$$",
        "url": "https://..."
      },
      ...
    ]
  }
}
[WEBHOOK] ✅ Notification sent successfully (200)
```

## Troubleshooting

### Issue: Deployment Stuck in "Building"

**Solution:**
1. Wait 5-10 minutes
2. If still stuck, click "Cancel Build"
3. Click "Redeploy"

### Issue: Deployment Failed

**Check logs for errors:**
1. Click on the failed deployment
2. Look at "Build Logs" tab
3. Look for error messages

**Common fixes:**
- Check if all dependencies are in `package.json`
- Verify `Dockerfile` is correct
- Check environment variables are set

### Issue: Old Code Still Running

**Solution:**
1. Check deployment timestamp
2. Make sure the latest deployment is "Active"
3. If old deployment is active, click "Promote" on the new one

## Current Deployment Info

- **Project:** ingenious-reverence
- **Service:** theknot
- **Environment:** production
- **Branch:** main
- **Latest Commit:** 32faa33
- **Commit Message:** "Change webhook format to venues array - easier for Nimbus to loop (body.data.venues)"

## What Changed

The webhook payload now sends data as a `venues` array instead of column arrays:

### Old Format
```json
{
  "data": {
    "name": ["Venue 1", "Venue 2"],
    "location": ["City 1", "City 2"]
  }
}
```

### New Format ✅
```json
{
  "data": {
    "venues": [
      {"name": "Venue 1", "location": "City 1"},
      {"name": "Venue 2", "location": "City 2"}
    ]
  }
}
```

## Next Steps

1. **Wait 2-5 minutes** for auto-deployment
2. **Check Railway dashboard** for deployment status
3. **Test webhook** with a small scrape (1 page)
4. **Configure Nimbus** to loop on `body.data.venues`
5. **Verify** rows are created correctly

## Need Help?

If deployment continues to fail:
1. Check Railway status page: https://status.railway.app
2. Check Railway logs for specific errors
3. Try manual redeploy from dashboard
4. Contact Railway support if issue persists

---

**Status:** Code pushed to GitHub (32faa33)  
**Action:** Railway should auto-deploy within 2-5 minutes  
**Verify:** Check https://railway.app dashboard
