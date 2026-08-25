// Basic Service Worker for PWA Installation Requirements
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // We don't cache anything aggressively because this is a live trading app.
  // We just let the network handle it, but the SW existence allows the PWA install prompt.
  event.respondWith(fetch(event.request));
});
