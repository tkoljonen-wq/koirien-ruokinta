const CACHE = 'koirat-v16';
const FILES = [
  './index.html',
  './manifest.json',
  './icon.svg'
];
// Firebase-skriptit välimuistiin, jotta sovellus käynnistyy myös offline-tilassa
const CDN_FILES = [
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      c.addAll(FILES).then(() =>
        Promise.all(CDN_FILES.map(u =>
          // cache.put eikä cache.add: add() hylkää opaque-vastaukset (status 0)
          fetch(u, { mode: 'no-cors' })
            .then(res => c.put(u, res))
            .catch(() => {})
        ))
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll())
      .then(clients => clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' })))
  );
});

self.addEventListener('fetch', e => {
  if (e.request.mode === 'navigate' || e.request.url.endsWith('.html')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  // Firebase-skriptit: cache first + varmuuden vuoksi ajonaikainen talletus,
  // jos install-vaiheen lataus epäonnistui
  if (e.request.url.startsWith('https://www.gstatic.com/firebasejs/')) {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
