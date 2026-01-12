import React from 'react';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// Create a query client with default options
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes - data is fresh for 2 min (reduced for better freshness)
      gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache for 30 min (renamed from cacheTime in v5)
      refetchOnWindowFocus: true, // Smart refetch when window regains focus (only if data is stale)
      refetchOnMount: true, // Refetch on mount if data is stale (but use cache if fresh)
      refetchOnReconnect: true, // Refetch when network reconnects
      retry: 1, // Only retry once on failure
      // Note: refetchInterval is set per-query in hooks for different polling rates
    },
  },
})

console.log('🧪 React version:', React.version)
console.log('🧪 Environment:', process.env.NODE_ENV)
console.log('🧪 User Agent:', navigator.userAgent)
console.log('🧪 Current URL:', window.location.href)
console.log('🧪 Service Worker support:', 'serviceWorker' in navigator)

// Add global error handler to catch unhandled errors
window.addEventListener('error', (event) => {
  console.error('❌ Global error:', event.error, event.message, event.filename, event.lineno)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Unhandled promise rejection:', event.reason)
})

// Ensure root element exists before rendering
// This prevents white screen if service worker serves cached HTML before DOM is ready
const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('❌ Root element not found! Creating it...');
  // Create root element if it doesn't exist (shouldn't happen, but safety check)
  const newRoot = document.createElement('div');
  newRoot.id = 'root';
  document.body.appendChild(newRoot);
  try {
    createRoot(newRoot).render(
      <StrictMode>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>
        </ErrorBoundary>
      </StrictMode>
    );
    console.log('✅ App rendered successfully (created root element)');
  } catch (error) {
    console.error('❌ Failed to render app:', error);
  }
} else {
  try {
    createRoot(rootElement).render(
      <StrictMode>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>
        </ErrorBoundary>
      </StrictMode>
    );
    console.log('✅ App rendered successfully');
  } catch (error) {
    console.error('❌ Failed to render app:', error);
    // Show error message to user
    rootElement.innerHTML = `
      <div style="padding: 20px; text-align: center;">
        <h1 style="color: red;">Failed to load app</h1>
        <p>Please refresh the page or <a href="/login">go to login</a></p>
      </div>
    `;
  }
}

// Register service worker for PWA notifications + update prompt
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = '/sw.js';
    navigator.serviceWorker.register(swUrl)
      .then((registration) => {
        console.log('✅ Service Worker registered successfully:', registration.scope);

        // Guard to avoid multiple reloads
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          refreshing = true;
          console.log('🔄 Controller changed, reloading to latest version...');
          window.location.reload();
        });

        // Show "update available" prompt when a new SW is installed
        registration.onupdatefound = () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('🆕 Update available: prompting user to refresh');
              const shouldRefresh = window.confirm('A new version of FitApp is available. Refresh now?');
              if (shouldRefresh) {
                // Ask the waiting worker to activate immediately; controllerchange will reload.
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              } else {
                console.log('⏭️ User chose to stay on current version until next load.');
              }
            }
          });
        };

        // Check if service worker is active
        if (registration.active) {
          console.log('✅ Service Worker is active');
        } else if (registration.installing) {
          console.log('⏳ Service Worker is installing...');
          registration.installing.addEventListener('statechange', (e) => {
            if (e.target.state === 'activated') {
              console.log('✅ Service Worker activated');
            }
          });
        } else if (registration.waiting) {
          console.log('⏳ Service Worker is waiting...');
        }
      })
      .catch((err) => {
        console.error('❌ Service Worker registration failed:', err);
      });
  });
}