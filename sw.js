const CACHE_NAME = 'archivio-v1';

// Tutte le risorse dell'app da mettere in cache al momento dell'installazione
const ASSETS_TO_CACHE = [
  '/Archivio/',
  '/Archivio/index.html',
  '/Archivio/manifest.json',
  '/Archivio/icona-192.png',
  '/Archivio/icona-512.png'
];

// ── INSTALL: pre-caching delle risorse statiche ──────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE: pulizia vecchie cache ──────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Eliminazione vecchia cache:', key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

// ── FETCH: Cache First, poi Network, poi fallback ────────────────────────────
self.addEventListener('fetch', event => {
  // Ignora richieste non GET
  if (event.request.method !== 'GET') return;

  // Ignora richieste cross-origin che non siano le nostre (es. CDN esterni non cachati)
  const url = new URL(event.request.url);
  const isOurOrigin = url.origin === self.location.origin;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Risorsa in cache: restituisci subito e aggiorna in background (stale-while-revalidate)
        if (isOurOrigin) {
          const fetchPromise = fetch(event.request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
            }
            return networkResponse;
          }).catch(() => {/* offline, va bene — usiamo già la cache */});
        }
        return cachedResponse;
      }

      // Non in cache: prova la rete e salva nella cache
      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
          return networkResponse;
        }
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        return networkResponse;
      }).catch(() => {
        // Offline e risorsa non in cache: pagina di fallback
        if (event.request.destination === 'document') {
          return caches.match('/Archivio/');
        }
      });
    })
  );
});