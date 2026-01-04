# Safari PWA Fix - Deployment Checklist

## Changes Made

The following fixes have been applied to resolve Safari PWA issues:

1. **Manifest start_url**: Changed from `/index.html` to `/` for proper SPA routing
2. **home.html redirect**: Added meta refresh and JavaScript redirect for Safari compatibility
3. **Service worker**: 
   - Added redirect for `/home.html` → `/login`
   - Incremented cache version to force update (v5)
   - Improved Safari compatibility
4. **Error handling**: Added ErrorBoundary component to catch React errors
5. **Debugging**: Added comprehensive error logging

## Deployment Steps

### 1. Commit and Push Changes to GitHub

```bash
# Make sure you're in the fitapp-frontend directory or root
git add fitapp-frontend/public/manifest.webmanifest
git add fitapp-frontend/public/home.html
git add fitapp-frontend/public/sw.js
git add fitapp-frontend/src/main.jsx
git add fitapp-frontend/src/App.jsx
git add fitapp-frontend/src/components/ErrorBoundary.jsx

git commit -m "Fix Safari PWA: redirect home.html to login, update manifest, add error handling"

# Push to main branch (production pulls from main)
git push origin main
```

### 2. Rebuild Production Container

```bash
cd production

# Windows
.\deploy.ps1

# Linux/Mac
./deploy.sh
```

This will:
- Pull latest code from GitHub main branch
- Rebuild the frontend Docker image with new changes
- Restart the frontend container

### 3. Clear Safari Cache (Important!)

After deployment, users need to clear Safari's cache:

**On iOS:**
1. Settings → Safari → Clear History and Website Data
2. OR: Long-press the app icon → Delete → Re-add to home screen

**On macOS Safari:**
1. Safari → Preferences → Advanced → Show Develop menu
2. Develop → Empty Caches
3. Or: Safari → Clear History → All History

### 4. Verify Deployment

1. Open the production URL in Safari
2. Check browser console for any errors
3. Add to home screen
4. Open from home screen - should redirect to `/login`
5. After login - should show dashboard (not white page)

## Troubleshooting

### If still seeing old behavior:

1. **Service worker not updating:**
   - The cache version was incremented to v5
   - Safari may take a few minutes to update
   - Try clearing Safari cache completely

2. **Still stuck on home.html:**
   - Check that `home.html` has the redirect code
   - Verify service worker is active (check console)
   - Try uninstalling and re-adding the PWA

3. **White page after login:**
   - Check browser console for JavaScript errors
   - Verify ErrorBoundary is catching errors
   - Check network tab for failed requests

### Debug Commands

```bash
# Check if frontend container is running
docker ps | grep fitapp-prod-frontend

# View frontend logs
docker logs fitapp-prod-frontend

# Rebuild just the frontend
docker-compose build --no-cache frontend
docker-compose up -d frontend
```

## Files Changed

- `fitapp-frontend/public/manifest.webmanifest` - start_url changed to `/`
- `fitapp-frontend/public/home.html` - Added redirects
- `fitapp-frontend/public/sw.js` - Added redirect, incremented cache version
- `fitapp-frontend/src/main.jsx` - Added ErrorBoundary, error handling
- `fitapp-frontend/src/App.jsx` - Updated catch-all route
- `fitapp-frontend/src/components/ErrorBoundary.jsx` - New file

All changes are in the repository and ready to be deployed.

