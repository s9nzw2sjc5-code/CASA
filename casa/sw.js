// Permite abrir la app sin conexión. Primero intenta la red (para recibir siempre
// la última versión) y, si no hay, usa la copia guardada.
const CACHE = 'casa-v62';
const OCR_CACHE = 'casa-ocr-ppocrv4-1';
const SHELL = ['push.js?v=62','./', 'index.html', 'icons/icon.svg', 'config.js', 'sync.js?v=62', 'cocina.js?v=62', 'receipts.js?v=62', 'receipt-image.js?v=62', 'receipt-layout.js?v=62', 'receipt-ocr.js?v=62', 'receipt-extras.js?v=62', 'mercadona.json', 'manifest.webmanifest',
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

// El servidor envía solo una referencia; las respuestas se confirman dentro de CASA.
self.addEventListener('push',event=>{
  let payload={};try{payload=event.data?event.data.json():{}}catch(e){}
  const url=new URL('./',self.location.href);
  if(['task','reminder'].includes(payload.kind)&&typeof payload.id==='string'&&payload.id.length<200){url.searchParams.set('noticeKind',payload.kind);url.searchParams.set('noticeId',payload.id)}
  event.waitUntil(self.registration.showNotification('CASA',{body:'Tienes un aviso pendiente. Toca para verlo y responder.',icon:'icons/icon-192.png',badge:'icons/icon-192.png',tag:typeof payload.tag==='string'?payload.tag.slice(0,120):'casa-notice',data:{url:url.href}}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||'./',self.location.href),scope=new URL('./',self.location.href);
  if(target.origin!==scope.origin||!target.pathname.startsWith(scope.pathname))return;
  event.waitUntil(clients.openWindow(target.href));
});
