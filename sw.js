// Hardened Service Worker: scope-aware, static-only caching, safe strategies
const STATIC_CACHE = 'tp-admin-static-v2';
const PAGE_CACHE = 'tp-admin-pages-v1';

// Use scope-relative URLs to work under subpaths
const ASSETS = [
  '.',
  'index.html',
  'dist/output.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const allow = new Set([STATIC_CACHE, PAGE_CACHE]);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !allow.has(k)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isStaticAsset(pathname) {
  return (
    /\.(?:css|js|mjs|png|jpe?g|svg|gif|webp|ico|ttf|otf|woff2?|json)$/i.test(pathname) ||
    pathname.startsWith('/dist/')
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;

  // Navigation requests: network-first, fallback to cached index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(PAGE_CACHE).then((c) => c.put('index.html', clone));
          return res;
        })
        .catch(() => caches.match('index.html'))
    );
    return;
  }

  // Only static same-origin assets are cached. No API caching.
  if (sameOrigin && isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) =>
        hit || fetch(req).then((res) => {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(req, clone));
          return res;
        })
      )
    );
  }
});
