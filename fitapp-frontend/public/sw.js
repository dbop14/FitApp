// Icon version: Update this when icons change (must match manifest _iconVersion)
const ICON_VERSION = 2;
// Build version: Auto-injected by Vite plugin during build (timestamp-based)
// This ensures every build gets a unique version without manual updates
const SW_VERSION = '__BUILD_VERSION__'; // Will be replaced during build
const CACHE_NAME = `fitapp-cache-v${SW_VERSION}-icons-${ICON_VERSION}`;
const API_CACHE_NAME = `fitapp-api-cache-v${SW_VERSION}`;
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  console.log('📱 [iOS DEBUG] Service worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.error('Failed to cache some assets:', err);
        // Continue even if some assets fail to cache
      });
    })
  );
  self.skipWaiting(); // Activate immediately
  console.log('📱 [iOS DEBUG] Service worker installed, skipping waiting');
});

self.addEventListener('activate', (event) => {
  console.log('📱 [iOS DEBUG] Service worker activating...');
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => {
        // Delete old caches (both asset cache and API cache)
        if (key !== CACHE_NAME && key !== API_CACHE_NAME) {
          console.log('🗑️ Deleting old cache:', key);
          return caches.delete(key);
        }
      }))
    )
  );
  self.clients.claim(); // Take control of all clients immediately
  console.log('📱 [iOS DEBUG] Service worker activated and claiming clients');
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Only handle GET requests - don't cache POST/PUT/DELETE
  if (request.method !== 'GET') return;
  
  // Handle API calls with cache-first strategy
  // This ensures chat messages, challenges, and other data load from cache
  if (url.pathname.startsWith('/api/')) {
    const acceptHeader = request.headers.get('accept') || '';
    const isEventStream = acceptHeader.includes('text/event-stream');
    const isCrossOrigin = url.origin !== self.location.origin;
    const isRealtime = url.pathname.startsWith('/api/realtime/events');
    const isRefresh = url.pathname.startsWith('/api/auth/refresh-google-fit-token');
    // Skip handling cross-origin API requests in the service worker
    // iOS PWA can throw "FetchEvent.respondWith received an error" for cross-origin
    if (isCrossOrigin) {
      return;
    }
    // Bypass service worker caching for SSE/event-stream requests
    if (isRealtime || isEventStream) {
      return;
    }
    event.respondWith(
      caches.open(API_CACHE_NAME).then((cache) => {
        return cache.match(request).then((cached) => {
          // Cache-first: return cached response immediately if available
          if (cached) {
            console.log('📦 [CACHE] Serving API from cache:', url.pathname);
            // Update cache in background (stale-while-revalidate)
            fetch(request)
              .then((response) => {
                if (response.status === 200) {
                  const responseClone = response.clone();
                  cache.put(request, responseClone).catch(() => {
                    // Ignore cache errors
                  });
                }
              })
              .catch(() => {
                // Ignore network errors - we already have cached data
              });
            return cached;
          }
          
          // No cache - fetch from network and cache it
          console.log('🌐 [NETWORK] Fetching API from network:', url.pathname);
          return fetch(request)
            .then((response) => {
              // Only cache successful responses
              if (response.status === 200) {
                const responseClone = response.clone();
                cache.put(request, responseClone).catch(() => {
                  // Ignore cache errors - don't block the response
                });
              }
              return response;
            })
            .catch((error) => {
              console.error('❌ [NETWORK] Failed to fetch API:', url.pathname, error);
              throw error;
            });
        });
      })
    );
    return;
  }
  
  // Redirect /home.html to /login for PWA compatibility
  // This prevents users from getting stuck on the static home.html page
  // Use HTML redirect for maximum Safari compatibility
  if (url.pathname === '/home.html' && request.mode === 'navigate') {
    event.respondWith(
      new Response(
        `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=/login"><script>window.location.replace('/login');</script></head><body>Redirecting to login...</body></html>`,
        {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
            'Cache-Control': 'no-cache'
          }
        }
      )
    );
    return;
  }
  
  // For navigation requests (HTML), try network first, cache as fallback
  // This ensures we get the latest HTML with correct JS/CSS references
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cached) => {
          // Try network first to get latest HTML
          return fetch(request)
            .then((response) => {
              // Only cache successful responses
              if (response.status === 200 && response.type === 'basic') {
                const responseClone = response.clone();
                cache.put(request, responseClone).catch(() => {
                  // Ignore cache errors - don't block the response
                });
              }
              return response;
            })
            .catch(() => {
              // If network fails and we have cache, use it
              if (cached) {
                console.log('📦 [CACHE] Serving HTML from cache (network failed)');
                return cached;
              }
              // If no cache and network failed, try one more network request
              // This prevents white screen on iOS when cache is cleared
              return fetch(request);
            });
        });
      })
    );
    return;
  }
  
  // For static assets (JS, CSS, images, fonts, etc.), use cache-first strategy
  // This ensures fast loading when revisiting pages
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(request).then((cached) => {
        if (url.origin !== self.location.origin) {
          return fetch(request).catch(() => cached || new Response('', { status: 204 }));
        }
        // Cache-first: return cached response immediately if available
        if (cached) {
          console.log('📦 [CACHE] Serving asset from cache:', url.pathname);
          // Update cache in background (stale-while-revalidate)
          fetch(request)
            .then((response) => {
              if (response.status === 200) {
                const responseClone = response.clone();
                cache.put(request, responseClone).catch(() => {
                  // Ignore cache errors
                });
              }
            })
            .catch(() => {
              // Ignore network errors - we already have cached data
            });
          return cached;
        }
        
        // No cache - fetch from network and cache it
        console.log('🌐 [NETWORK] Fetching asset from network:', url.pathname);
        return fetch(request)
          .then((response) => {
            // Only cache successful responses
            if (response.status === 200) {
              const responseClone = response.clone();
              cache.put(request, responseClone).catch(() => {
                // Ignore cache errors - don't block the response
              });
            }
            return response;
          })
          .catch((error) => {
            console.error('❌ [NETWORK] Failed to fetch asset:', url.pathname, error);
            throw error;
          });
      });
    })
  );
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  // Handle notification requests (required for iOS PWA notifications)
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    
    event.waitUntil(
      self.registration.showNotification(title, options)
        .then(() => {
          console.log('✅ Notification shown successfully');
        })
        .catch((error) => {
          console.error('❌ Failed to show notification:', error);
        })
    );
  }
  
  // Handle skip waiting request (for immediate updates)
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('🔄 Skipping waiting phase, activating new service worker immediately');
    self.skipWaiting();
  }
});

// Handle push events - show notification when push message is received
self.addEventListener('push', (event) => {
  // Critical: iOS requires this to be synchronous and must show notification
  // iOS will not deliver push notifications if the service worker doesn't handle them immediately
  console.log('📬 [iOS DEBUG] Push event received in service worker');
  console.log('📬 [iOS DEBUG] Event data:', event.data ? 'present' : 'missing');
  
  // iOS-specific: Must use event.waitUntil to keep service worker alive
  // Without this, iOS may terminate the service worker before notification is shown
  
  let notificationData = {
    title: 'FitApp',
    body: 'You have a new message',
    icon: '/icon-192x192.png',
    badge: '/badge-icon-48x48.png?v=1',
    data: {
      url: '/chat'
    }
  };
  
  if (event.data) {
    try {
      const data = event.data.json();
      console.log('📬 [iOS DEBUG] Parsed push data:', { title: data.title, hasBody: !!data.body });
      notificationData = {
        title: data.title || 'FitApp',
        body: data.body || 'You have a new message',
        icon: data.icon || '/icon-192x192.png',
        badge: data.badge || '/badge-icon-48x48.png?v=1',
        data: data.data || { url: '/chat' }
      };
    } catch (e) {
      console.error('❌ [iOS DEBUG] Error parsing push data:', e);
      // Try text() method as fallback for iOS
      try {
        const textData = event.data.text();
        console.log('📬 [iOS DEBUG] Push data as text:', textData.substring(0, 100));
      } catch (textError) {
        console.error('❌ [iOS DEBUG] Failed to read push data as text:', textError);
      }
    }
  } else {
    console.warn('⚠️ [iOS DEBUG] Push event has no data');
  }
  
  // For iOS: If body is empty, put message in title to avoid "From FitApp"
  // This happens when the frontend sends empty body for iOS
  const notificationTitle = notificationData.body === '' ? notificationData.title : notificationData.title;
  const notificationBody = notificationData.body === '' ? '' : notificationData.body;
  
  // Enhanced notification options for locked phones
  // iOS requires specific options for notifications to show when locked
  // Note: Service workers don't have access to navigator, so we can't detect iOS here
  // Instead, we use options that work for both iOS and Android
  
  // Generate unique tag for each notification to prevent Android from collapsing them
  // Android replaces notifications with the same tag, so we need unique tags for separate notifications
  const uniqueTag = `chat_notification_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  const notificationOptions = {
    body: notificationBody,
    icon: notificationData.icon,
    badge: notificationData.badge,
    data: notificationData.data,
    vibrate: [200, 100, 200], // Works on Android, ignored on iOS
    tag: uniqueTag, // Unique tag for each notification - prevents Android from collapsing them
    requireInteraction: false, // Don't require user interaction (allows auto-dismiss)
    silent: false, // Make sure notification makes sound
    renotify: false, // Not needed since each notification has unique tag
    // iOS-specific: These options help notifications show on lock screen
    // iOS requires the app to be installed as PWA for push notifications
    dir: 'auto', // Text direction
    lang: 'en', // Language
    timestamp: Date.now() // Timestamp for iOS
  };
  
  event.waitUntil(
    self.registration.showNotification(notificationTitle, notificationOptions)
      .then(() => {
        console.log('✅ Notification shown successfully');
      })
      .catch((error) => {
        console.error('❌ Failed to show notification:', error);
      })
  );
});

// Handle notification clicks - open the app to the chat page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/chat';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to focus an existing window
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // If no matching window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});


