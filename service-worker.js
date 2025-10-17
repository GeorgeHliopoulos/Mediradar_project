/* MediRadar Service Worker - offline + fast updates + push */
const CACHE_NAME = 'mediradar-v3'; // bump όταν αλλάζεις SW/assets

// Βάλε εδώ ΜΟΝΟ όσα υπάρχουν σίγουρα στο site σου
const APP_SHELL = [
  '/',                // Netlify -> index.html (fallback)
  '/index.html',
  '/manifest.json',
  '/service-worker.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  // Αν υπάρχουν maskable icons, ξεκλείδωσέ τα:
  // '/icons/icon-maskable-192.png',
  // '/icons/icon-maskable-512.png',
  // Αν όντως έχεις pharmacy.html στο root, ξεκλείδωσέ το:
  // '/pharmacy.html',
];

/* ---------- Helpers ---------- */
async function safePrecache(list) {
  const cache = await caches.open(CACHE_NAME);
  const results = await Promise.allSettled(
    list.map((url) => fetch(url, { cache: 'no-cache' }))
  );
  await Promise.all(
    results.map((res, i) => {
      if (res.status === 'fulfilled' && res.value?.ok) {
        return cache.put(list[i], res.value.clone());
      }
      return Promise.resolve();
    })
  );
}

function isNavigationRequest(request) {
  return (
    request.mode === 'navigate' ||
    (request.method === 'GET' &&
      request.headers.get('accept')?.includes('text/html'))
  );
}

/* ---------- Install ---------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      await safePrecache(APP_SHELL);
      await self.skipWaiting();
    })()
  );
});

/* ---------- Activate ---------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve()))
      );
      await self.clients.claim();
    })()
  );
});

/* ---------- Fetch ---------- */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) HTML navigations -> network-first, fallback σε cached index.html
  if (isNavigationRequest(req)) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          // Κράτα ένα ασφαλές fallback κάτω από /index.html
          cache.put('/index.html', fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match('/index.html');
          return (
            cached ||
            new Response('Offline', { status: 503, statusText: 'Offline' })
          );
        }
      })()
    );
    return;
  }

  // 2) Same-origin static assets -> cache-first
  if (url.origin === self.location.origin) {
    if (/\.(png|jpg|jpeg|gif|svg|webp|ico|js|css|json|txt|map)$/i.test(url.pathname)) {
      event.respondWith(
        (async () => {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(req);
          if (cached) return cached;
          try {
            const fresh = await fetch(req);
            if (fresh?.ok) cache.put(req, fresh.clone());
            return fresh;
          } catch {
            return new Response('Offline asset', { status: 503 });
          }
        })()
      );
      return;
    }
  }

  // 3) Third-party (CDNs) -> stale-while-revalidate
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res?.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      return cached || network || new Response('Offline', { status: 503 });
    })()
  );
});

/* ---------- Messages (skip waiting) ---------- */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* ---------- Web Push ---------- */
self.addEventListener('push', (event) => {
  // Περιμένουμε payload σε JSON από το Edge Function
  // { title, body, url, actions? }
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {}

  const title = data.title || 'MediRadar';
  const body = data.body || 'Νέα ειδοποίηση';
  const icon = '/icons/icon-192.png';
  const badge = '/icons/icon-192.png';
  const actions = Array.isArray(data.actions) ? data.actions : [];
  const notifData = { url: data.url || '/pharmacy.html', ...data };

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      actions,
      data: notifData,
      // Android: εξασφαλίζει heads-up
      requireInteraction: false,
      // iOS/WebKit έχει περιορισμούς, αλλά δεν βλάπτει
      vibrate: [50, 50],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || '/pharmacy.html';
  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = allClients.find((c) => c.url.includes(url));
      if (existing) {
        return existing.focus();
      }
      return clients.openWindow(url);
    })()
  );
});
