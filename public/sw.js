const CACHE_NAME = 'nightingale-v2';

// Resolve every path against the service worker's scope so the app also works
// from a subpath — GitHub Pages serves it at /entrax/, not the domain root.
const assetUrl = (path) => new URL(path, self.registration.scope).href;

const STATIC_ASSETS = [
  '',
  'student.html',
  'exam.html',
  'exam-results.html',
  'index.html',
  'terms.html',
  'privacy.html',
  'contact.html',
  'admin-login.html',
  'admin-dashboard.html',
  'create-exam.html',
  'study.html',
  'style.css',
  'favicon.svg',
  'manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS.map(assetUrl)))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // Firebase / external requests (different origin, including the emulator
  // ports in dev): never cached, always network.
  if (url.origin !== self.location.origin) return;

  // Documents and code: network first, so a deploy is picked up on the next
  // load instead of serving the previous release from the cache. The cache is
  // only the offline fallback.
  if (
    request.mode === 'navigate' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css')
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => {
            if (cached) return cached;
            return request.mode === 'navigate' ? caches.match(assetUrl('student.html')) : Response.error();
          })
        )
    );
    return;
  }

  // Icons, images, manifest: cache first, refresh in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
