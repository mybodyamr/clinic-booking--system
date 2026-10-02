// Progressive Web App Service Worker for Sharaya Clinics (v24 - Network-First & Auto-Update)
const CACHE_NAME = 'sharaya-clinics-v24';

// Static icons and manifest to cache for offline fallback only
const STATIC_ASSETS = [
  '/manifest.webmanifest',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/icon-192.svg',
  '/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Precache error on static assets:', err);
      });
    })
  );
  // Activate the new service worker immediately without waiting for tabs to close
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Purge ALL old caches (v1, v2, v3, v4, v5, etc.) immediately
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          // Also purge any accidentally cached /api/ entries inside current cache
          return caches.open(key).then((cache) =>
            cache.keys().then((requests) =>
              Promise.all(
                requests.map((req) => {
                  if (req.url.includes('/api/') || req.url.includes('/rest/v1') || req.url.includes('/auth/v1')) {
                    return cache.delete(req);
                  }
                  return Promise.resolve(false);
                })
              )
            )
          );
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_ALL_CACHES') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    );
  }
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Do not intercept external requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // CRITICAL: NEVER intercept or cache API, Supabase bridge, REST, Auth, or RPC requests!
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/supabase-bridge') ||
    url.pathname.includes('/rest/v1') ||
    url.pathname.includes('/auth/v1') ||
    url.pathname.includes('/rpc/')
  ) {
    return;
  }

  // 1. Navigation requests (HTML documents, page loads, refreshes) -> Strict Network-First
  const isNavigation =
    event.request.mode === 'navigate' ||
    (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'));

  if (isNavigation) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('/index.html', responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match('/index.html').then((cached) => {
            return cached || caches.match('/');
          });
        })
    );
    return;
  }

  // 2. Static Assets (JS, CSS, SVGs, images) -> Network-First with Offline Cache Fallback
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
