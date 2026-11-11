const CACHE_NAME = 'progress-planner-static-v2';
const APP_SHELL = [
  '/manifest.webmanifest',
  '/icons/app-192.png',
  '/icons/app-512.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const page = await fetch('/');
    if (!page.ok) throw new Error('App-Shell konnte nicht geladen werden.');
    await cache.put('/', page.clone());

    // Vite generates hashed JS/CSS filenames. Read them from the built HTML
    // so the first installed version can also open without a network connection.
    const html = await page.text();
    const assets = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))(?:\?[^"']*)?["']/g)]
      .map((match) => match[1])
      .filter((path) => path.startsWith('/') && !path.startsWith('//'));

    await cache.addAll([...APP_SHELL, ...assets]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('progress-planner-') && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
          if (url.pathname === '/') await cache.put('/', response.clone());
        }
        return response;
      } catch {
        return (await caches.match(request)) || (await caches.match('/')) || Response.error();
      }
    })());
    return;
  }

  const isStatic = /\.(?:js|css|woff2?|png|svg|webp|ico)$/i.test(url.pathname);
  if (!isStatic && url.pathname !== '/manifest.webmanifest') return;

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
