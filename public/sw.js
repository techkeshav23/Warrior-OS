// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Service Worker (hand-written, no build step)
//
// • /_next/static/*  → cache-first (content-hashed, immutable)
// • navigations      → network-first, cached shell, offline page
// • /icons, /cursors, manifest, favicon → stale-while-revalidate
// • /api/*           → never touched (always network, never cached)
// • everything else  → default browser behaviour
//
// Registered only in production by components/pwa.
// Bump VERSION to drop every old cache on the next activation.
// ═══════════════════════════════════════════════════════════

const VERSION = 'v1';
const STATIC_CACHE = `warrior-static-${VERSION}`;
const PAGES_CACHE = `warrior-pages-${VERSION}`;
const ASSET_CACHE = `warrior-assets-${VERSION}`;
const CURRENT_CACHES = [STATIC_CACHE, PAGES_CACHE, ASSET_CACHE];

const STATIC_MAX_ENTRIES = 250;
const PAGES_MAX_ENTRIES = 8;
const ASSET_MAX_ENTRIES = 60;

/** The whole OS lives on "/", so the cached shell doubles as the fallback. */
const SHELL_URL = '/';

// ─── Lifecycle ───

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGES_CACHE)
      .then((cache) => cache.add(new Request(SHELL_URL, { cache: 'reload' })))
      .catch(() => undefined) // installing while offline is fine; the shell is cached on first visit
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('warrior-') && !CURRENT_CACHES.includes(name))
          .map((name) => caches.delete(name))
      );
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable().catch(() => undefined);
      }
      await self.clients.claim();
    })()
  );
});

// ─── Routing ───

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // live data only, never cached
  if (url.pathname.startsWith('/_next/webpack-hmr') || url.pathname.startsWith('/__nextjs')) return;
  if (request.headers.get('RSC') === '1' || url.searchParams.has('_rsc')) return; // RSC payloads
  if (request.headers.has('range')) return; // partial media requests

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(event));
    return;
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(event, STATIC_CACHE, STATIC_MAX_ENTRIES));
    return;
  }

  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/cursors/') ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/favicon.ico'
  ) {
    event.respondWith(staleWhileRevalidate(event, ASSET_CACHE, ASSET_MAX_ENTRIES));
  }
});

// ─── Strategies ───

function isCacheable(response) {
  return Boolean(response) && response.ok && response.type === 'basic';
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  // Oldest entries come first; drop the overflow.
  for (let i = 0; i < keys.length - maxEntries; i++) {
    await cache.delete(keys[i]);
  }
}

function store(event, cacheName, request, response, maxEntries) {
  event.waitUntil(
    caches
      .open(cacheName)
      .then((cache) => cache.put(request, response))
      .then(() => trimCache(cacheName, maxEntries))
      .catch(() => undefined)
  );
}

async function networkFirstPage(event) {
  const request = event.request;
  try {
    const preloaded = await event.preloadResponse;
    const response = preloaded || (await fetch(request));
    if (isCacheable(response)) {
      store(event, PAGES_CACHE, request, response.clone(), PAGES_MAX_ENTRIES);
    }
    return response;
  } catch {
    const cache = await caches.open(PAGES_CACHE);
    const cached =
      (await cache.match(request, { ignoreSearch: true })) || (await cache.match(SHELL_URL));
    return cached || offlinePage();
  }
}

async function cacheFirst(event, cacheName, maxEntries) {
  const request = event.request;
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (isCacheable(response)) {
    store(event, cacheName, request, response.clone(), maxEntries);
  }
  return response;
}

async function staleWhileRevalidate(event, cacheName, maxEntries) {
  const request = event.request;
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const network = fetch(request).then((response) => {
    if (isCacheable(response)) {
      store(event, cacheName, request, response.clone(), maxEntries);
    }
    return response;
  });

  if (cached) {
    event.waitUntil(network.catch(() => undefined));
    return cached;
  }
  return network;
}

function offlinePage() {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#050508">
<title>WARRIOR OS — Offline</title>
<style>
  html, body { height: 100%; margin: 0; }
  body {
    display: flex; align-items: center; justify-content: center;
    background: radial-gradient(circle at center, #0c1a26 0%, #050508 70%);
    color: #e4e4ef; font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  main { text-align: center; padding: 24px; max-width: 420px; }
  h1 { font-size: 20px; letter-spacing: 0.2em; color: #00f0ff; margin: 16px 0 8px;
       text-shadow: 0 0 12px rgba(0, 240, 255, 0.6); }
  p { color: #8888a0; font-size: 14px; line-height: 1.6; margin: 0 0 20px; }
  button { background: rgba(0, 240, 255, 0.12); color: #00f0ff; border: 1px solid rgba(0, 240, 255, 0.4);
           border-radius: 999px; padding: 10px 22px; font-size: 13px; cursor: pointer; }
  button:hover { background: rgba(0, 240, 255, 0.2); }
  img { width: 72px; height: 72px; }
</style>
</head>
<body>
<main>
  <img src="/icons/icon-192.png" alt="">
  <h1>SIGNAL LOST</h1>
  <p>WARRIOR OS could not reach the network and has no saved copy of the desktop yet. Reconnect and try again.</p>
  <button type="button" onclick="location.reload()">Retry</button>
</main>
</body>
</html>`;
  return new Response(html, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
