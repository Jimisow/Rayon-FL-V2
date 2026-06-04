const CACHE_NAME = 'rayon-frais-v19';
const ASSETS = [
  './index.html',
  './produits.json',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js',
  'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js'
];

// Installation : mise en cache
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()) // Active immÃÂÃÂ©diatement sans attendre
  );
});

// Activation : supprime les vieux caches et prend le contrÃÂÃÂ´le immÃÂÃÂ©diatement
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim()) // Prend le contrÃÂÃÂ´le de tous les onglets ouverts
  );
});

// StratÃÂÃÂ©gie Network-First pour les fichiers locaux (index, json, manifest)
// Cache-First pour les CDN externes (pas besoin de re-tÃÂÃÂ©lÃÂÃÂ©charger ÃÂÃÂ  chaque fois)
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const isLocal = url.origin === self.location.origin;

  if (isLocal) {
    // Network-First : essaie le rÃÂÃÂ©seau, met ÃÂÃÂ  jour le cache, fallback sur cache si offline
    e.respondWith(
      fetch(e.request)
        .then(networkRes => {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, resClone));
          return networkRes;
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    // Cache-First pour les CDN
    e.respondWith(
      caches.match(e.request).then(res => res || fetch(e.request))
    );
  }
});

// Notifie les clients qu'une nouvelle version est disponible
self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
