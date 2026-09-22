// Progressive Web App Service Worker for Sharaya Clinics (v3)
const CACHE_NAME = 'sharaya-clinics-v3';

// Static icons and manifest to cache for offline support
const STATIC_ASSETS = [
  '/manifest.webmanifest',
  '/icon-192.svg',
  '/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Precache error on some static assets:', err);
      });
    })
  );
  // Activate the new service worker immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Purge all old caches (including sharaya-clinics-v1, v2)
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Clearing obsolete cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Do not intercept external requests (Supabase, Google Fonts, etc.)
  if (url.origin !== self.location.origin) {
    return;
  }

  // 1. Navigation requests (HTML documents, page loads, refreshes)
  // CRITICAL: Network-First Strategy!
  // When a new build is deployed to Vercel, the browser MUST fetch the fresh HTML containing the new JS/CSS chunk hashes.
  const isNavigation = event.request.mode === 'navigate' || 
                       (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'));

  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // If valid response from Vercel/server, update the offline fallback in cache
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('/index.html', responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If network is completely unreachable (offline mode), fallback to cached index.html
          return caches.match('/index.html').then((cached) => {
            return cached || caches.match('/');
          });
        })
    );
    return;
  }

  // 2. Static Assets (JS, CSS, SVGs, images)
  // Try network first, then cache, or cache then network
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        return cachedResponse;
      });
    })
  );
});
