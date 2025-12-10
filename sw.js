self.addEventListener('install', (e) => {
  console.log('[Service Worker] Install');
});

self.addEventListener('fetch', (e) => {
  // Απλά επιτρέπει την κίνηση δικτύου
});
