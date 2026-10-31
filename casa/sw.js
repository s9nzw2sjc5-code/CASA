// Permite abrir la app sin conexión. Primero intenta la red (para recibir siempre
// la última versión) y, si no hay, usa la copia guardada.
const CACHE = 'casa-v47';
const OCR_CACHE = 'casa-ocr-ppocrv4-1';
const SHELL = ['./', 'index.html', 'icons/icon.svg', 'config.js', 'sync.js?v=47', 'cocina.js?v=47', 'receipts.js?v=47', 'receipt-image.js?v=47', 'receipt-layout.js?v=47', 'receipt-ocr.js?v=47', 'mercadona.json', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== OCR_CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Modelos y runtimes solo al leer la primera foto; se reutilizan entre versiones.
  if(url.origin===location.origin&&url.pathname.includes('/ocr/')&&!url.pathname.endsWith('/worker.js')){
    e.respondWith(caches.open(OCR_CACHE).then(async cache=>{
      const saved=await cache.match(req);if(saved)return saved;
      const res=await fetch(req);if(res.ok)e.waitUntil(cache.put(req,res.clone()).catch(()=>{}));return res;
    }));return;
  }
  // Las fotos de productos no cambian: reutiliza la copia antes de pedir otra.
  if(url.hostname === 'prod-mercadona.imgix.net'){
    e.respondWith(caches.open(CACHE).then(async cache=>{
      const saved=await cache.match(req);if(saved)return saved;
      const res=await fetch(req);
      if(res.ok||res.type==='opaque')await cache.put(req,res.clone());
      return res;
    }));
    return;
  }
  const cacheable = url.origin === location.origin ||
    url.hostname === 'www.gstatic.com' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!cacheable) return; // Firestore y la autenticación van siempre por red
  // Lo de la propia app se pide sin la caché del navegador (GitHub Pages la guarda 10 min)
  const net = url.origin === location.origin ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req);
  e.respondWith(
    net.then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
