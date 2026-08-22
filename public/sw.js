// Service worker de CinéPrivé.
// A incrementer a chaque deploiement touchant aux fichiers du site.
const CACHE_NAME = 'cineprive-v1';
const PRECACHE = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(PRECACHE)).catch(() => {}));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Ne jamais intercepter autre chose qu'une lecture simple.
  if (req.method !== 'GET') return;

  // 2. Ne jamais intercepter une autre origine.
  if (url.origin !== self.location.origin) return;

  // 3. CRITIQUE : ne jamais toucher a la video, a l'API, ni aux requetes
  //    partielles. Interferer ici bloque le lecteur a 00:00.
  if (
    url.pathname.startsWith('/videos/') ||
    url.pathname.startsWith('/api/') ||
    req.headers.has('range')
  ) return;

  // 4. Navigation : reseau d'abord, coquille de l'application en secours.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/index.html')));
    return;
  }

  // 5. Ressources statiques : cache d'abord.
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copie = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copie));
        }
        return res;
      });
    })
  );
});
