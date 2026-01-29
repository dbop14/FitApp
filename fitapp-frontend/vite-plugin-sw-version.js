import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export default function swVersionPlugin() {
  let buildVersion = Date.now();
  const publicSwPath = resolve(__dirname, 'public/sw.js');
  
  return {
    name: 'sw-version-plugin',
    
    // Dev server: Serve sw.js from memory with injected version
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/sw.js') {
          try {
            if (existsSync(publicSwPath)) {
              let swContent = readFileSync(publicSwPath, 'utf-8');
              const updatedContent = swContent.replace(
                /const SW_VERSION = ['"]__BUILD_VERSION__['"];?/,
                `const SW_VERSION = ${buildVersion};`
              );
              
              res.setHeader('Content-Type', 'application/javascript');
              res.end(updatedContent);
              return;
            }
          } catch (error) {
            console.warn('⚠️ Could not serve injected sw.js:', error.message);
          }
        }
        next();
      });
    },

    // Production build: Update the file in dist/
    closeBundle() {
      const distSwPath = resolve(__dirname, 'dist/sw.js');
      
      if (existsSync(distSwPath)) {
        try {
          let swContent = readFileSync(distSwPath, 'utf-8');
          // Update version
          const updatedContent = swContent.replace(
            /const SW_VERSION = ['"]__BUILD_VERSION__['"];?/,
            `const SW_VERSION = ${buildVersion};`
          );
          
          if (updatedContent !== swContent) {
            writeFileSync(distSwPath, updatedContent, 'utf-8');
            console.log(`✅ Injected build version ${buildVersion} into dist/sw.js`);
          }
        } catch (error) {
          console.warn('⚠️ Could not inject build version into dist/sw.js:', error.message);
        }
      }
    }
  };
}
