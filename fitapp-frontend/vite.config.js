import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: ['fitapp.herringm.com', 'fitappdev.herringm.com', 'localhost', '127.0.0.1', '0.0.0.0'],
    // HMR configuration - completely disable HMR to prevent WebSocket errors through Cloudflare tunnel
    // Cloudflare tunnel doesn't support WebSocket upgrades, so HMR won't work anyway
    // Set VITE_HMR_HOST environment variable if you need HMR for local development
    hmr: process.env.VITE_HMR_HOST ? {
      host: process.env.VITE_HMR_HOST,
      protocol: process.env.VITE_HMR_PROTOCOL || 'wss',
      clientPort: process.env.VITE_HMR_PORT ? parseInt(process.env.VITE_HMR_PORT) : 443
    } : false, // Completely disable HMR when no explicit host is set
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      }
    }
  },
  css: {
    postcss: './postcss.config.js'
  }
})
