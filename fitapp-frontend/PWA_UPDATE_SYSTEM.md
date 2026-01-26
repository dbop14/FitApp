# PWA Automatic Update System

## Overview

The FitApp PWA now uses a **smart automatic update system** that ensures users always get the latest version without needing to manually delete and reinstall the app.

## How It Works

### 1. Automatic Versioning
- **No manual version bumping required**: A Vite plugin automatically injects a build timestamp into the service worker during each build
- Every build gets a unique version number (based on `Date.now()`)
- The service worker cache version updates automatically with each deployment

### 2. Smart Update Strategy

The system uses **Option B: Smart Updates** which balances automatic updates with user control:

#### When User is **Active** (using the app):
- Updates are detected and a dialog prompts the user to refresh
- User can choose "Refresh Now" or "Later"
- Updates are also applied automatically when user navigates between pages

#### When User is **Inactive** (no activity for 2+ minutes):
- Updates are applied automatically in the background
- No interruption to the user experience
- User gets the latest version when they return

### 3. Update Detection

Updates are checked:
- **On page load**: Immediate check when app starts
- **Every 5 minutes**: Periodic background checks
- **On navigation**: When user navigates between routes
- **On visibility change**: When user returns to the app tab

### 4. Automatic Application

Updates are automatically applied:
- When user navigates between pages (if update is waiting)
- When user returns to the app after being away
- When user is inactive (background update)

## Technical Implementation

### Files Modified

1. **`vite-plugin-sw-version.js`** (NEW)
   - Vite plugin that injects build timestamp into service worker
   - Runs during build process

2. **`vite.config.js`**
   - Added the sw-version plugin to the plugins array

3. **`public/sw.js`**
   - Changed `SW_VERSION` from manual number to `__BUILD_VERSION__` placeholder
   - Added `SKIP_WAITING` message handler for immediate updates

4. **`src/main.jsx`**
   - Enhanced service worker registration with:
     - User activity tracking
     - Periodic update checks
     - Navigation-based update detection
     - Smart auto-update logic

### Build Process

1. When you run `npm run build`:
   - Vite plugin generates a unique build timestamp
   - Replaces `__BUILD_VERSION__` in `sw.js` with the timestamp
   - Service worker gets a new cache version automatically

2. When deployed:
   - Users' browsers detect the new service worker version
   - Update is applied based on user activity (smart strategy)

## Benefits

✅ **No manual version management**: Every build automatically gets a unique version  
✅ **Better user experience**: Updates apply automatically when appropriate  
✅ **No reinstallation needed**: Users always get latest version seamlessly  
✅ **Smart behavior**: Respects user activity - prompts when active, auto-updates when inactive  
✅ **Fast updates**: Updates detected and applied quickly (on navigation, visibility change, etc.)

## For Developers

### Deploying Updates

Simply commit and deploy your changes:
```bash
git add .
git commit -m "Your changes"
git push origin main
# Deploy to production
```

The build system will automatically:
1. Generate a new build version
2. Inject it into the service worker
3. Users will get the update automatically

### Manual Version Override (if needed)

If you ever need to manually set a version (not recommended), you can edit `public/sw.js`:
```javascript
const SW_VERSION = 1234567890; // Your custom version
```

But this is **not necessary** - the plugin handles it automatically.

## Testing Updates

To test the update system:

1. **Build the app**: `npm run build`
2. **Deploy to a test environment**
3. **Open the app in a browser**
4. **Make a change and rebuild**
5. **Redeploy**
6. **Observe**: The update should be detected and applied based on user activity

## Troubleshooting

### Updates not applying?
- Check browser console for service worker errors
- Verify the build version was injected (check `dist/sw.js`)
- Clear browser cache and service worker registration
- Check that `skipWaiting()` is being called in the service worker

### Version not updating?
- Verify the Vite plugin is running (check build logs)
- Check that `__BUILD_VERSION__` placeholder exists in `public/sw.js`
- Ensure the plugin is added to `vite.config.js`

## Future Improvements

Potential enhancements:
- Add update notification toast (less intrusive than dialog)
- Add "Update in background" option to dialog
- Track update success/failure metrics
- Add version display in app settings
