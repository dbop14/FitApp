# Icon Versioning System

This project uses an automatic cache-busting system for app icons to ensure users always see the latest icons when you update them.

## How It Works

1. **Version Query Parameters**: All icon URLs include a `?v=X` parameter that changes when icons are updated
2. **Service Worker Cache**: The cache name includes the icon version, forcing cache invalidation
3. **Automatic Updates**: When you update icons, run the version update script to increment all version numbers

## Updating Icons

When you replace the PNG icon files (`icon-180x180.png`, `icon-192x192.png`, `icon-512x512.png`), follow these steps:

### Step 1: Replace the Icon Files
Replace the icon files in `/public/`:
- `icon-180x180.png` (iOS)
- `icon-192x192.png` (Android)
- `icon-512x512.png` (Android)

### Step 2: Update the Version
Run the update script to increment the version number:

```bash
npm run update-icons
```

This script will:
- ✅ Increment the version number in `manifest.webmanifest`
- ✅ Update all icon URLs with the new version query parameter
- ✅ Update `apple-touch-icon` in `index.html`
- ✅ Update the service worker cache name

### Step 3: Deploy
Deploy your changes. Users will automatically get the new icons on their next visit because:
- The new version query parameter (`?v=2`, `?v=3`, etc.) bypasses browser cache
- The service worker cache name changes, forcing a cache refresh

## Manual Update (Alternative)

If you prefer to update manually:

1. **manifest.webmanifest**: 
   - Increment `_iconVersion` (e.g., `1` → `2`)
   - Update all `?v=X` parameters in icon `src` fields

2. **index.html**:
   - Update `apple-touch-icon` href: `/icon-180x180.png?v=X`

3. **public/sw.js**:
   - Update `ICON_VERSION` constant
   - The cache name will automatically update

## Current Version

Check `manifest.webmanifest` for the current `_iconVersion` value.

