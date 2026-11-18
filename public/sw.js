// SKYWEAR PWA & Web Push Service Worker
const CACHE_VERSION = 'skywear-v1.0.1';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline';

const PRECACHE_ASSETS = [
  '/',
  OFFLINE_URL,
  '/favicon.ico',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/favicon-48x48.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/apple-touch-icon.png',
  '/icon.svg',
  '/manifest.json'
];

// Install: precache offline fallback and essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache non-critical warning:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean up outdated caches and take control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE && key !== DYNAMIC_CACHE) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Strategy depending on request type
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests with http/https schemes
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Bypass cache for dynamic API routes, admin portals, and auth
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/portal') ||
    url.pathname.includes('/checkout') ||
    url.pathname.includes('/webhook')
  ) {
    return; // Pass through to network
  }

  // 1. Navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          // If offline, check if page is already cached
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Otherwise fall back to offline page
          const offlineFallback = await caches.match(OFFLINE_URL);
          if (offlineFallback) {
            return offlineFallback;
          }
          return new Response('Network disconnected. Please check your internet connection.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          });
        })
    );
    return;
  }

  // 2. Static assets (JS, CSS, Images, Fonts, Icons)
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.match(/\.(png|jpg|jpeg|webp|svg|ico|css|js|woff|woff2)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        // Stale-While-Revalidate
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }
});

// -------------------------------------------------------------
// Web Push Notifications
// -------------------------------------------------------------
self.addEventListener('push', function (event) {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (err) {
      payload = {
        title: 'SKYWEAR // ZENIN',
        body: event.data.text(),
      };
    }
  } else {
    payload = {
      title: 'SKYWEAR // ZENIN',
      body: 'New update from Skywear',
    };
  }

  const title = payload.title || 'SKYWEAR // ZENIN';
  // Forceful distinctive haptic vibration pattern for push notifications:
  // If coins/wallet: powerful double pulse [200, 80, 300, 80, 200]
  const isCoinAlert = (payload.title && (payload.title.includes('Coin') || payload.title.includes('🪙') || payload.title.includes('Cashback'))) ||
                      (payload.body && (payload.body.includes('coin') || payload.body.includes('Cashback')));
  const vibePattern = isCoinAlert
    ? [200, 70, 250, 70, 350]
    : [150, 60, 200];

  const options = {
    body: payload.body || 'New live drop & update from Skywear',
    icon: payload.icon || '/android-chrome-192x192.png',
    badge: payload.badge || '/favicon-32x32.png',
    image: payload.image || undefined,
    tag: payload.tag || `skywear-${Date.now()}`,
    renotify: true,
    vibrate: vibePattern,
    data: payload.data || { url: payload.url || '/' },
    actions: [
      { action: 'view', title: 'Open App' },
      { action: 'close', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  if (event.action === 'close') return;

  const rawUrl = event.notification.data?.url || '/';
  // Support both internal relative routes ('/wallet', '/shop') and full external URLs ('https://google.com', 'https://instagram.com/...')
  const targetUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
    ? rawUrl
    : new URL(rawUrl, self.location.origin).href;

  const isInternal = targetUrl.startsWith(self.location.origin);

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (clientList) {
        if (isInternal) {
          for (let i = 0; i < clientList.length; i++) {
            const client = clientList[i];
            if (client.url && 'focus' in client) {
              client.navigate(targetUrl);
              return client.focus();
            }
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
