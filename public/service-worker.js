// minimal no-op service worker to avoid 404 and to allow clients to update
self.addEventListener('install', event => {
  // activate immediately
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  // take control of clients immediately
  event.waitUntil(self.clients.claim());
});
// do not cache anything here — keep it minimal to avoid stale caches
