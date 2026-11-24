/* Le Carnet de Fred — service worker
   Garde toute l'appli en cache pour qu'elle s'ouvre sans réseau.
   À CHAQUE MISE EN LIGNE : change VERSION ici ET dans app.js. */
const VERSION = '1.6.0';
const CACHE = 'carnet-' + VERSION;
const ASSETS = [
  './', './index.html', './app.css', './coast.css', './coastline.svg', './fraicheur.css', './ciel.jpg', './ciel-bas.jpg', './lora.woff', './lora-italic.woff', './app.js', './config.js', './manifest.webmanifest',
  './icons/icon-192-leonard.png', './icons/icon-512-leonard.png', './icons/maskable-512-leonard.png',
  './icons/apple-touch-icon-leonard.png', './icons/favicon-leonard.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('carnet-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html').then(r => r || fetch(req)));
    return;
  }
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});
