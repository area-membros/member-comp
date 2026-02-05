/*
Arquivo: service-worker.js
Local: /service-worker.js
Descrição: Offline robusto (app shell pré-cache + PDFs sob demanda)
*/

const CACHE_VERSION = 'v5';
const APP_SHELL_CACHE = `tribo-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `tribo-runtime-${CACHE_VERSION}`;

const APP_SHELL = [
  '/',                 // importante para navegação
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/manifest.json',

  // Ícones do PWA
  '/images/icons/icon-192.png',
  '/images/icons/icon-512.png',

  // Imagens dos cards
  '/images/capa-davi.jpg',
  '/images/capa-golias.jpg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (![APP_SHELL_CACHE, RUNTIME_CACHE].includes(key)) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) Navegação (abrir o app): fallback pro index.html do cache quando offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Só trata arquivos do seu domínio
  if (url.origin !== location.origin) return;

  // 2) PDFs: cache sob demanda (abriu 1x online -> depois abre offline)
  if (url.pathname.endsWith('.pdf')) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;

        try {
          const fresh = await fetch(req);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (e) {
          // Se nunca abriu online, não vai existir no cache
          return cached || Response.error();
        }
      })
    );
    return;
  }

  // 3) Assets (CSS/JS/imagens): cache-first, com fallback
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((fresh) =>
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(req, fresh.clone());
            return fresh;
          })
        )
        .catch(() => cached);
    })
  );
});
