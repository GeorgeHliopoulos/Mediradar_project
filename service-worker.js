
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open('mediradar-cache').then(function(cache) {
      return cache.addAll([
        './mediradar_pwa_enhanced.html',
        './manifest.json'
      ]);
    })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request).then(function(response) {
      return response || fetch(event.request);
    })
  );
});
