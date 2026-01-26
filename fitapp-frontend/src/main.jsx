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
    let isUserActive = true; // Track if user is actively using the app
    let lastUserActivity = Date.now();

    // Track user activity to determine if we should auto-update or prompt
    const updateActivity = () => {
      lastUserActivity = Date.now();
      isUserActive = true;
    };
    ['mousedown', 'keydown', 'touchstart', 'scroll'].forEach(event => {
      window.addEventListener(event, updateActivity, { passive: true });
    });

    // Check if user has been inactive (no activity for 2 minutes)
    const checkUserActivity = () => {
      const inactiveTime = Date.now() - lastUserActivity;
      isUserActive = inactiveTime < 120000; // 2 minutes
    };

    navigator.serviceWorker.register(swUrl)
      .then((reg) => {
        registration = reg;
        console.log('✅ Service Worker registered successfully:', reg.scope);

        // Guard to avoid multiple reloads
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          refreshing = true;
          console.log('🔄 Controller changed, reloading to latest version...');
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
        // This ensures updates are applied quickly when user is actively using the app
        let navigationCheckTimeout = null;
        const checkOnNavigation = () => {
          // Debounce navigation checks
          if (navigationCheckTimeout) clearTimeout(navigationCheckTimeout);
          navigationCheckTimeout = setTimeout(() => {
            checkUserActivity();
            if (registration && registration.waiting) {
              // Update is waiting - apply it if user is active, otherwise prompt
              if (isUserActive) {
                console.log('🔄 Update available, applying automatically on navigation');
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
              } else {
                console.log('🆕 Update available: user inactive, will prompt on next activity');
              }
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
            checkUserActivity();
            checkForUpdates();
            // If update is waiting and user just returned, apply it
            if (registration && registration.waiting && isUserActive) {
              console.log('🔄 Update available, applying automatically after visibility change');
              registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
          }
        });

        // Show "update available" prompt when a new SW is installed
        // Only show if user is actively using the app (otherwise auto-update in background)
        registration.onupdatefound = () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              checkUserActivity();
              
              // If user is inactive, auto-update in background
              if (!isUserActive) {
                console.log('🔄 Update available, applying automatically (user inactive)');
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                return;
              }

              // If user is active, show prompt
              console.log('🆕 Update available: prompting user to refresh');
              window.__FITAPP_SW_UPDATE__ = newWorker;
              window.dispatchEvent(
                new CustomEvent('fitapp:sw-update', { detail: { worker: newWorker } })
              );
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
          // If there's already a waiting worker, apply it if user is inactive
          checkUserActivity();
          if (!isUserActive) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
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