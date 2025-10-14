/* MediRadar Service Worker - simple offline + fast updates */
const CACHE_NAME = 'mediradar-v1';
const APP_SHELL = [
  '/',               // Netlify θα σερβίρει index.html
  '/index.html',
  '/manifest.json',
  '/service-worker.js',
  '/pharmacy.html',  // αν δεν υπάρχει, βγάλ' το
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png'
];

// Install: προ-κάνε cache τα βασικά assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate: καθάρισε παλιές cache
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve()))
    );
    await self.clients.claim();
  })());
});

// Utility: HTML navigation detection
function isNavigationRequest(request) {
  return request.mode === 'navigate' ||
         (request.method === 'GET' &&
          request.headers.get('accept') &&
          request.headers.get('accept').includes('text/html'));
}

// Fetch strategy:
// - HTML navigations: network-first, fallback σε cache (index.html) αν offline
// - Same-origin static (png, js, css): cache-first
// - Third-party (CDN Tailwind/Fonts): stale-while-revalidate
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // HTML pages
  if (isNavigationRequest(req)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        // Optional: put a copy in cache
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        // Fallback σε cached index.html
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match('/index.html');
        return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })());
    return;
  }

  // Same-origin static assets -> cache-first
  if (url.origin === self.location.origin) {
    if (/\.(png|jpg|jpeg|gif|svg|webp|ico|js|css|json|txt)$/i.test(url.pathname)) {
      event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const fresh = await fetch(req);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (e) {
          return new Response('Offline asset', { status: 503 });
        }
      })());
      return;
    }
  }

  // Third-party (CDN) -> stale-while-revalidate
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    const networkFetch = fetch(req).then((res) => {
      cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    return cached || networkFetch || new Response('Offline', { status: 503 });
  })());
});

// (Optional) Message handler για skipWaiting από την εφαρμογή
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
