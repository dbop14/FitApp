import React from 'react';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'

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

// Ensure root element exists before rendering
// This prevents white screen if service worker serves cached HTML before DOM is ready
const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('❌ Root element not found! Creating it...');
  // Create root element if it doesn't exist (shouldn't happen, but safety check)
  const newRoot = document.createElement('div');
  newRoot.id = 'root';
  document.body.appendChild(newRoot);
  createRoot(newRoot).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>
  );
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>
  );
}

// Register service worker for PWA notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = '/sw.js';
    navigator.serviceWorker.register(swUrl)
      .then((registration) => {
        console.log('✅ Service Worker registered successfully:', registration.scope);
        
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