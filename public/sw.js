self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  return self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Pass-through fetch for the prototype
  event.respondWith(fetch(event.request));
});
