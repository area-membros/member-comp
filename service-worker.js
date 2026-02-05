const VERSION = 'v1';
const STATIC_CACHE = `member-static-${VERSION}`;
const PDF_CACHE = `member-pdfs-${VERSION}`;

// Cache mínimo para o app abrir offline.
// Se quiser, você pode adicionar mais arquivos aqui depois.
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/style.css',
  '/js/app.js',
  '/images/icons/icon-192.png',
  '/images/icons/icon-512.png',
  '/images/01.png',
  '/images/02.png',
  // se você tiver mais imagens, pode incluir aqui também
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);

    // Importante: não usar addAll puro (se 1 falhar, quebra tudo).
    // Fazemos um por um e ignoramos falhas.
    await Promise.allSettled(
      STATIC_ASSETS.map(async (path) => {
        try {
          const req = new Request(path, { cache: 'reload' });
          const res = await fetch(req);
          if (res.ok) await cache.put(req, res.clone());
        } catch (_) {}
      })
    );

    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((k) => {
        if (k !== STATIC_CACHE && k !== PDF_CACHE) return caches.delete(k);
      })
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;
  if (url.origin !== location.origin) return;

  // PDFs: network-first + cache (sob demanda)
  if (url.pathname.endsWith('.pdf')) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) {
          const cache = await caches.open(PDF_CACHE);
          await cache.put(req, res.clone());
        }
        return res;
      } catch (e) {
        const cached = await caches.match(req);
        if (cached) return cached;
        return new Response('Offline', { status: 200, headers: { 'Content-Type': 'text/plain' } });
      }
    })());
    return;
  }

  // Navegação (abrir o app): network-first, fallback para cache do index
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        // cacheia qualquer navegação que der certo
        if (res.ok) {
          const cache = await caches.open(STATIC_CACHE);
          await cache.put('/index.html', res.clone());
        }
        return res;
      } catch (e) {
        const cachedIndex = await caches.match('/index.html');
        if (cachedIndex) return cachedIndex;

        // fallback final (igual ao outro)
        return new Response(`
          <!doctype html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>Offline</title>
              <style>
                body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#000;color:#fff;font-family:Arial}
                .box{max-width:420px;padding:24px;text-align:center}
                p{opacity:.65;line-height:1.5}
                button{margin-top:16px;background:#f97316;color:#fff;border:0;padding:12px 16px;border-radius:12px;font-weight:800}
              </style>
            </head>
            <body>
              <div class="box">
                <h2>Você está offline</h2>
                <p>Verifique sua conexão e tente novamente. Alguns conteúdos podem estar disponíveis em cache.</p>
                <button onclick="location.reload()">Tentar novamente</button>
              </div>
            </body>
          </html>
        `, { status: 200, headers: { 'Content-Type': 'text/html' } });
      }
    })());
    return;
  }

  // Assets (css/js/imagens): network-first + cache, fallback cache
  event.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok) {
        const cache = await caches.open(STATIC_CACHE);
        await cache.put(req, res.clone());
      }
      return res;
    } catch (e) {
      const cached = await caches.match(req);
      return cached || Response.error();
    }
  })());
});
