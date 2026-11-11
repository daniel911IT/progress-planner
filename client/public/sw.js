const CACHE_NAME = 'progress-planner-static-v3';
const APP_BASE = new URL('./', self.location.href);
const APP_SHELL_URL = APP_BASE.href;
const APP_SHELL = [
  new URL('manifest.webmanifest', APP_BASE).href,
  new URL('icons/app-192.png', APP_BASE).href,
  new URL('icons/app-512.png', APP_BASE).href,
  new URL('icons/apple-touch-icon.png', APP_BASE).href
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const page = await fetch(APP_SHELL_URL, { cache: 'reload' });
    if (!page.ok) throw new Error('App-Shell konnte nicht geladen werden.');
    await cache.put(APP_SHELL_URL, page.clone());

    // Vite generates hashed JS/CSS filenames. Resolve them against this site's
    // base path so a GitHub Pages project site stays inside its repository scope.
    const html = await page.text();
    const assets = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))(?:\?[^"']*)?["']/g)]
      .map((match) => new URL(match[1], self.location.origin))
      .filter((url) => url.origin === self.location.origin && url.pathname.startsWith(APP_BASE.pathname))
      .map((url) => url.href);

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
  if (url.origin !== self.location.origin || !url.pathname.startsWith(APP_BASE.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        return (await caches.match(request)) || (await caches.match(APP_SHELL_URL)) || Response.error();
      }
    })());
    return;
  }

  const isStatic = /\.(?:js|css|woff2?|png|svg|webp|ico)$/i.test(url.pathname)
    || url.href === new URL('manifest.webmanifest', APP_BASE).href;
  if (!isStatic) return;

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
