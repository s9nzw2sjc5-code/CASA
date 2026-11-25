// Permite abrir la app sin conexión. Primero intenta la red (para recibir siempre
// la última versión) y, si no hay, usa la copia guardada.
const CACHE = 'casa-v177';
const OCR_CACHE = 'casa-ocr-ppocrv4-1';
const SHELL = ['cleaning-pace.js?v=177','cleaning-view.js?v=177','push.js?v=177','./', 'index.html', 'icons/icon.svg', 'config.js', 'sync.js?v=177', 'shopping-recommendations.js?v=177', 'household-insights.js?v=177', 'household-ui.js?v=177', 'document-files.js?v=177', 'document-photo.js?v=177', 'home-model.js?v=177', 'cleaning-links.js?v=177', 'home-ui.js?v=177', 'cocina.js?v=177', 'product-photo.js?v=177', 'product-photo-ui.js?v=177', 'receipts.js?v=177', 'receipt-image.js?v=177', 'receipt-layout.js?v=177', 'receipt-ocr.js?v=177', 'receipt-extras.js?v=177', 'house-plan.js?v=177', 'house-plan-ui.js?v=177', 'lidl-ui.js?v=177', 'mama.js?v=177', 'avisos.js?v=177', 'tasks-ui.js?v=177', 'lidl.json', 'mercadona.json', 'manifest.webmanifest',
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

// Avisos: el servicio «casa-avisos» envía solo un toque; aquí se pide el texto y se muestra.
const AVISOS_URL='https://casa-avisos.s9nzw2sjc5.workers.dev';
async function showPending(){
  const home=new URL('./',self.location.href).href;
  try{
    const sub=await self.registration.pushManager.getSubscription();
    const r=await fetch(AVISOS_URL+'/pending',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub&&sub.endpoint})});
    const items=((await r.json()).items||[]).slice(-5);
    if(items.length){for(const x of items)await self.registration.showNotification(String(x.title||'📬 Tienes un mensaje de Casa').slice(0,120),{body:String(x.body||'').slice(0,300),icon:'icons/icon-192.png',badge:'icons/icon-192.png',tag:String(x.tag||'casa').slice(0,80),data:{url:home}});return}
  }catch(e){}
  await self.registration.showNotification('📬 Tienes un mensaje de Casa',{body:'Toca para verlo.',icon:'icons/icon-192.png',badge:'icons/icon-192.png',tag:'casa-avisos',data:{url:home}});
}
async function showItems(items){
  const home=new URL('./',self.location.href).href;
  for(const x of items.slice(-5))await self.registration.showNotification(String(x.title||'📬 Tienes un mensaje de Casa').slice(0,120),{body:String(x.body||'').slice(0,300),icon:'icons/icon-192.png',badge:'icons/icon-192.png',tag:String(x.tag||'casa').slice(0,80),data:{url:home}});
  // Lo ya mostrado no se vuelve a mostrar: se vacía la cola del servicio (sin esperar)
  try{const sub=await self.registration.pushManager.getSubscription();fetch(AVISOS_URL+'/pending',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub&&sub.endpoint})}).catch(()=>{})}catch(e){}
}
self.addEventListener('push',event=>{
  let payload=null;try{payload=event.data?event.data.json():null}catch(e){}
  // Con el texto dentro (lo normal): se muestra directamente
  if(payload&&Array.isArray(payload.items)&&payload.items.length){event.waitUntil(showItems(payload.items));return}
  if(!payload){event.waitUntil(showPending());return}
  const url=new URL('./',self.location.href);
  if(['task','reminder'].includes(payload.kind)&&typeof payload.id==='string'&&payload.id.length<200){url.searchParams.set('noticeKind',payload.kind);url.searchParams.set('noticeId',payload.id)}
  event.waitUntil(self.registration.showNotification('📬 Tienes un mensaje de Casa',{body:'Toca para verlo y responder.',icon:'icons/icon-192.png',badge:'icons/icon-192.png',tag:typeof payload.tag==='string'?payload.tag.slice(0,120):'casa-notice',data:{url:url.href}}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||'./',self.location.href),scope=new URL('./',self.location.href);
  if(target.origin!==scope.origin||!target.pathname.startsWith(scope.pathname))return;
  event.waitUntil(clients.openWindow(target.href));
});
