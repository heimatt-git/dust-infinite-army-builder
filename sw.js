// Service worker du DUST 194∞ Builder : permet l'installation et l'ouverture sans connexion.
// Principe prudent : on essaie TOUJOURS le réseau d'abord (le site reste à jour), le cache ne sert que si le réseau échoue.
const CACHE = 'dust-v1';
const MAX_ENTRIES = 500;
const NET_TIMEOUT = 5000; // réseau trop lent : on prend la copie en cache
const PAGES = ['index.html', 'shot.html', 'atelier.html', 'aide.html'];
const STATIC = [
  './', 'manifest.webmanifest',
  'data/units.json', 'data/blocs.json', 'data/skills.json', 'data/skills.fr.json', 'data/photos.json',
  'data/custom.json', 'data/pixel.json', 'data/short-format.json',
  'img/bandeau-dust.png', 'img/logo-loir.png', 'img/icon-192.png', 'img/icon-512.png',
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    const add = async (url) => { try { const r = await fetch(url, { cache: 'reload' }); if (r.ok) await c.put(url, r.clone()); return r; } catch { return null; } };
    const found = new Set();
    for (const p of PAGES) {
      const r = await add(p);
      if (!r) continue;
      const html = await r.clone().text();
      // fichiers js / css versionnés (?v=…) cités par la page et par son import map
      for (const m of html.matchAll(/(?:\.\/)?((?:js|css)\/[\w.-]+\.(?:js|css)\?v=\d+)/g)) found.add(m[1]);
    }
    await Promise.all([...found, ...STATIC].map(add));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function trim(c) {
  const keys = await c.keys();
  for (let i = 0; i < keys.length - MAX_ENTRIES; i++) await c.delete(keys[i]);
}
const keep = async (req, res) => {
  if (!res || !(res.ok || res.type === 'opaque')) return;
  const c = await caches.open(CACHE);
  await c.put(req, res.clone());
  trim(c);
};
const fromCache = (req) => caches.match(req).then((r) => r || caches.match(req, { ignoreSearch: true }));

async function networkFirst(req) {
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), NET_TIMEOUT)),
    ]);
    keep(req, res);
    return res;
  } catch (err) {
    const hit = await fromCache(req);
    if (hit) return hit;
    if (req.mode === 'navigate') { const idx = await caches.match('index.html'); if (idx) return idx; }
    return Response.error();
  }
}
async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  keep(req, res);
  return res;
}
async function staleWhileRevalidate(req) {
  const hit = await caches.match(req);
  const net = fetch(req).then((res) => { keep(req, res); return res; }).catch(() => null);
  return hit || (await net) || Response.error();
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (FONT_HOSTS.includes(url.hostname)) { e.respondWith(staleWhileRevalidate(req)); return; }
  if (url.origin !== self.location.origin) return; // GitHub, autres sites : le navigateur s'en occupe
  if (/\.(png|jpe?g|webp|gif|svg|ico)$/i.test(url.pathname)) { e.respondWith(cacheFirst(req)); return; }
  e.respondWith(networkFirst(req));
});
