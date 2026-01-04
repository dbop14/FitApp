#!/usr/bin/env node

/**
 * Script to increment icon version for cache-busting
 * Usage: node scripts/update-icon-version.js
 * 
 * This script:
 * 1. Reads the current icon version from manifest.webmanifest
 * 2. Increments it by 1
 * 3. Updates all icon URLs in manifest.webmanifest
 * 4. Updates apple-touch-icon in index.html
 * 5. Updates ICON_VERSION in sw.js
 */

const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '../public/manifest.webmanifest');
const indexHtmlPath = path.join(__dirname, '../index.html');
const swPath = path.join(__dirname, '../public/sw.js');

// Read files
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const sw = fs.readFileSync(swPath, 'utf8');

// Get current version
const currentVersion = manifest._iconVersion || 1;
const newVersion = currentVersion + 1;

console.log(`Updating icon version from ${currentVersion} to ${newVersion}...`);

// Update manifest
manifest._iconVersion = newVersion;
manifest.icons.forEach(icon => {
  if (icon.src.includes('?')) {
    icon.src = icon.src.replace(/v=\d+/, `v=${newVersion}`);
  } else {
    icon.src = `${icon.src}?v=${newVersion}`;
  }
});

// Write updated manifest
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n\n');

// Update index.html
const updatedIndexHtml = indexHtml.replace(
  /href="\/icon-180x180\.png(\?v=\d+)?"/,
  `href="/icon-180x180.png?v=${newVersion}"`
);
fs.writeFileSync(indexHtmlPath, updatedIndexHtml);

// Update service worker
const updatedSw = sw.replace(
  /const ICON_VERSION = \d+;/,
  `const ICON_VERSION = ${newVersion};`
);
fs.writeFileSync(swPath, updatedSw);

console.log(`✅ Icon version updated to ${newVersion}`);
console.log(`📝 Updated files:`);
console.log(`   - ${manifestPath}`);
console.log(`   - ${indexHtmlPath}`);
console.log(`   - ${swPath}`);
console.log(`\n💡 Remember to replace the PNG icon files in /public/ before deploying!`);

