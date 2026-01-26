// Vite plugin to inject build version into service worker
// This ensures every build gets a unique version without manual updates
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { resolve } from 'path';

export default function swVersionPlugin() {
  let buildVersion = null;
  const originalSwPath = resolve(__dirname, 'public/sw.js');
  
  return {
    name: 'sw-version-plugin',
    buildStart() {
      // Generate build version based on timestamp
      // This ensures every build is unique
      buildVersion = Date.now();
      
      // Process the service worker file in public/ directory
      // This runs before Vite copies it to dist/
      if (!existsSync(originalSwPath)) {
        console.warn('⚠️ Service worker file not found at:', originalSwPath);
        return;
      }
      
      try {
        // Read the service worker file
        let swContent = readFileSync(originalSwPath, 'utf-8');
        
        // Replace the placeholder with the actual build version
        const updatedContent = swContent.replace(
          /const SW_VERSION = ['"]__BUILD_VERSION__['"];?/,
          `const SW_VERSION = ${buildVersion};`
        );
        
        // Only write if content changed
        if (updatedContent !== swContent) {
          writeFileSync(originalSwPath, updatedContent, 'utf-8');
          console.log(`✅ Injected build version ${buildVersion} into service worker`);
        }
      } catch (error) {
        console.warn('⚠️ Could not inject build version into service worker:', error.message);
        // Don't fail the build if this fails
      }
    },
    closeBundle() {
      // After build, also update the file in dist/ if it exists
      // This ensures the built version has the correct version
      const distSwPath = resolve(__dirname, 'dist/sw.js');
      
      if (existsSync(distSwPath) && buildVersion) {
        try {
          let swContent = readFileSync(distSwPath, 'utf-8');
          const updatedContent = swContent.replace(
            /const SW_VERSION = ['"]__BUILD_VERSION__['"];?/,
            `const SW_VERSION = ${buildVersion};`
          );
          
          if (updatedContent !== swContent) {
            writeFileSync(distSwPath, updatedContent, 'utf-8');
          }
        } catch (error) {
          // Ignore errors in dist/ - the public/ version should already be updated
        }
      }
    }
  };
}
