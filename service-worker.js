/* MediRadar Service Worker - offline + fast updates */
const CACHE_NAME = 'mediradar-v2'; // bump when αλλάζεις assets

// Βάλε εδώ ΜΟΝΟ όσα ξέρεις ότι υπάρχουν σίγουρα.
const APP_SHELL = [
  '/',                // Netlify -> index.html
  '/index.html',
  '/manifest.json',
  '/service-worker.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  // Βάλε τα maskable ΜΟΝΟ αν υπάρχουν όντως:
  // '/icons/icon-maskable-192.png',
  // '/icons/icon-maskable-512.png',
  // Αν έχεις pharmacy.html στο root, ξεκλείδωσέ το:
  // '/pharmacy.html',
];

// --- Helpers ---
async function safePrecache(list) {
  const cache = await caches.open(CACHE_NAME);
  // Προσπάθησε να κατεβάσεις όλα, αλλά ΜΗ ρίχνεις error αν λείπει κάτι
  const results = await Promise.allSettled(list.map(url => fetch(url, {cache: 'no-cache'})));
  await Promise.all(
    results.map((res, i) => {
      if (res.status === 'fulfilled' && res.value && res.value.ok) {
        return cache.put(list[i], res.value.clone());
      }
      // Προαιρετικά log για debug:
      // console.warn('[SW] skipped precache:', list[i], res.reason || res.value && res.value.status);
      return Promise.resolve();
    })
  );
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' ||
    (request.method === 'GET' &&
     request.headers.get('accept') &&
     request.headers.get('accept').includes('text/html'));
}

// --- Install ---
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    await safePrecache(APP_SHELL);
    await self.skipWaiting();
  })());
});

// --- Activate ---
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())));
    await self.clients.claim();
  })());
});

// --- Fetch ---
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) HTML navigations -> network-first with index.html fallback
  if (isNavigationRequest(req)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        // Cache a copy under '/index.html' για σταθερό fallback
        const cache = await caches.open(CACHE_NAME);
        cache.put('/index.html', fresh.clone());
        return fresh;
      } catch (err) {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match('/index.html');
        return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })());
    return;
  }

  // 2) Same-origin static assets -> cache-first
  if (url.origin === self.location.origin) {
    if (/\.(png|jpg|jpeg|gif|svg|webp|ico|js|css|json|txt|map)$/i.test(url.pathname)) {
      event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const fresh = await fetch(req);
          // Μη βάζεις στο cache αν είναι opaque/error
          if (fresh && fresh.ok) cache.put(req, fresh.clone());
          return fresh;
        } catch {
          return new Response('Offline asset', { status: 503 });
        }
      })());
      return;
    }
  }

  // 3) Third-party (CDNs) -> stale-while-revalidate
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    const network = fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    return cached || network || new Response('Offline', { status: 503 });
  })());
});

// Λήψη μηνύματος για άμεσο update
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
