const CACHE_NAME = 'mediradar-public-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

async function precache() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(
    APP_SHELL.map(async (url) => {
      try {
        const response = await fetch(url, { cache: 'no-cache' });
        if (response && response.ok) {
          await cache.put(url, response.clone());
        }
      } catch (error) {
        console.warn('Precache failed for', url, error);
      }
    })
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      await precache();
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      );
      await self.clients.claim();
    })()
  );
});

function isNavigation(request) {
  return (
    request.mode === 'navigate' ||
    (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'))
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname === '/pharmacy.html' || url.pathname.startsWith('/js/pharmacyApp.js')) {
      event.respondWith(
        (async () => {
          try {
            return await fetch(request, { cache: 'no-store' });
          } catch (error) {
            console.warn('Network fetch failed for pharmacy asset', error);
            return new Response('Offline', { status: 503, statusText: 'Offline' });
          }
        })()
      );
      return;
    }

    if (isNavigation(request)) {
      event.respondWith(
        (async () => {
          try {
            const response = await fetch(request);
            const cache = await caches.open(CACHE_NAME);
            cache.put('/index.html', response.clone());
            return response;
          } catch (error) {
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

    if (/\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|json|txt|map)$/i.test(url.pathname)) {
      event.respondWith(
        (async () => {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(request);
          if (cached) return cached;
          try {
            const response = await fetch(request);
            if (response && response.ok) {
              await cache.put(request, response.clone());
            }
            return response;
          } catch (error) {
            return new Response('Offline asset', { status: 503, statusText: 'Offline' });
          }
        })()
      );
      return;
    }
  }

  event.respondWith(
    (async () => {
      try {
        return await fetch(request);
      } catch (error) {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        return (
          cached ||
          new Response('Offline', { status: 503, statusText: 'Offline' })
        );
      }
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
