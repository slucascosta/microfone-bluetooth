const CACHE = 'mic-v2';
const ASSETS = [
  '/microfone-bluetooth/',
  '/microfone-bluetooth/index.html',
  '/microfone-bluetooth/app.js',
  '/microfone-bluetooth/manifest.json',
  '/microfone-bluetooth/components/mic-button.js',
  '/microfone-bluetooth/components/audio-visualizer.js',
  '/microfone-bluetooth/components/volume-control.js',
  '/microfone-bluetooth/components/settings-sheet.js',
];

// Instala e cacheia os arquivos
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Limpa caches antigos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Serve do cache, atualiza em background
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fresh = fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
