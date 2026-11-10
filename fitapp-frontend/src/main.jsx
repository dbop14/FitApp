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

// Add platform class for Android-specific styling
if (typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent || '')) {
  document.documentElement.classList.add('platform-android')
}

// Add platform class for desktop styling
if (typeof navigator !== 'undefined') {
  const ua = navigator.userAgent || ''
  const isMobile = /android|iphone|ipad|ipod/i.test(ua)
  if (!isMobile) {
    document.documentElement.classList.add('platform-desktop')
  }
}

// Load diagnostics (read by Settings on the dev site): keep the last 20 page
// loads with their navigation type and whether a service-worker update caused them.
try {
  const nav = performance.getEntriesByType?.('navigation')?.[0]
  const log = JSON.parse(localStorage.getItem('fitapp_load_log') || '[]')
  const swReload = sessionStorage.getItem('fitapp_sw_reload_pending') === '1'
  sessionStorage.removeItem('fitapp_sw_reload_pending')
  log.push({ t: Date.now(), type: nav?.type || 'unknown', reason: swReload ? 'service-worker-update' : (nav?.type === 'reload' ? 'reload' : 'open') })
  localStorage.setItem('fitapp_load_log', JSON.stringify(log.slice(-20)))
} catch {
  // storage unavailable
}

// iOS Home Screen app: iOS 26.1+ paints a blurred scrim over the top of
// black-translucent web apps. index.css pushes header text below it.
if (typeof navigator !== 'undefined' && navigator.standalone === true) {
  document.documentElement.classList.add('ios-standalone')
}

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

// Register service worker for PWA notifications + smart automatic updates
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = '/sw.js';
    let registration = null;
    let updateCheckInterval = null;

    navigator.serviceWorker.register(swUrl)
      .then((reg) => {
        registration = reg;
        console.log('✅ Service Worker registered successfully:', reg.scope);

        // Guard to avoid multiple reloads, and never reload more than once per
        // 30 seconds (prevents a reload loop if the browser keeps swapping workers)
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          try {
            const last = Number(sessionStorage.getItem('fitapp_sw_reload_at') || 0);
            if (Date.now() - last < 30000) {
              console.log('Controller changed again within 30s, not reloading');
              return;
            }
            sessionStorage.setItem('fitapp_sw_reload_at', String(Date.now()));
            sessionStorage.setItem('fitapp_sw_reload_pending', '1');
          } catch {
            // storage unavailable: fall through to a single reload
          }
          refreshing = true;
          console.log('Controller changed, reloading to latest version...');
          window.location.reload();
        });

        // Check for updates periodically (every 5 minutes)
        const checkForUpdates = () => {
          if (registration) {
            registration.update().catch(() => {});
          }
        };
        
        // Initial update check
        checkForUpdates();
        
        // Set up periodic update checks (every 5 minutes)
        updateCheckInterval = setInterval(checkForUpdates, 5 * 60 * 1000);

        // Check for updates when user navigates (route changes)
        let navigationCheckTimeout = null;
        const checkOnNavigation = () => {
          if (navigationCheckTimeout) clearTimeout(navigationCheckTimeout);
          navigationCheckTimeout = setTimeout(() => {
            if (registration && registration.waiting) {
              console.log('🔄 Update available, applying on navigation...');
              registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            } else {
              checkForUpdates();
            }
          }, 1000);
        };

        // Listen for route changes (React Router navigation)
        window.addEventListener('popstate', checkOnNavigation);
        
        // Also check when visibility changes (user returns to tab)
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) {
            checkForUpdates();
            if (registration && registration.waiting) {
              console.log('🔄 Update available, applying after visibility change...');
              registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
          }
        });

        // When a new SW is installed, apply it immediately so controllerchange triggers reload
        registration.onupdatefound = () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('🔄 Update available, applying and refreshing...');
              newWorker.postMessage({ type: 'SKIP_WAITING' });
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
          console.log('⏳ Service Worker is waiting, applying and refreshing...');
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
          if (updateCheckInterval) {
            clearInterval(updateCheckInterval);
          }
        });
      })
      .catch((err) => {
        console.error('❌ Service Worker registration failed:', err);
      });
  });
}