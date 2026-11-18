/* Compras › Lidl: ofertas y productos de tienda con los precios de la provincia de la tienda.
   Los datos vienen de casa/lidl.json, que una tarea de GitHub descarga cada día de la web de Lidl
   (provincia en tools/lidl-region.txt). Cada oferta dice si es de esta semana, del fin de semana
   o de la próxima, con sus fechas y el precio con Lidl Plus. Solo comida y limpieza. */
let LIDL=null,lidlLoading=false,lidlError='';
function lidlLoad(force){
 if(lidlLoading||(LIDL&&!force))return;lidlLoading=true;lidlError='';
 fetch('lidl.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()})
  .then(d=>{LIDL={at:d.at||'',region:d.region||'',items:Array.isArray(d.items)?d.items:[]}})
  .catch(()=>{lidlError='No se han podido cargar las ofertas de Lidl. Revisa la conexión.'})
  .finally(()=>{lidlLoading=false;if(ui.view==='compras')render()});
}
const LIDL_FILTERS=[['semana','🏷️ Esta semana'],['finde','🎉 Fin de semana'],['proxima','⏭️ Próxima semana'],['super','🛒 Comida'],['fruta','🥬 Fruta y verdura'],['limpieza','🧴 Limpieza']];
const LIDL_WHEN={semana:'Esta semana',finde:'Fin de semana',proxima:'Próxima semana','finde-proxima':'Fin de semana que viene'};
const LIDL_PERIODS=new Set(['semana','finde','proxima']);
// Sección de la lista de la compra según la sección del producto (las mismas que en Mercadona)
const LIDL_FRESH=new Set(['Carne','Marisco y pescado','Charcutería y quesos','Huevos, leche y mantequilla','Postres y yogures','Pizzas y platos preparados','Panadería y pastelería']);
const lidlListSection=x=>x.s==='Congelados'?'Congelados':x.g==='fruta'||x.s==='Fruta y verdura'?'Fruta y verdura':x.g==='limpieza'?'Limpieza':LIDL_FRESH.has(x.s)?'Frescos':'Despensa';
// Orden de las secciones: como en Mercadona (alfabético) y «Otros» al final
const lidlSecOrder=(a,b)=>(a==='Otros')-(b==='Otros')||a.localeCompare(b,'es');
const lidlEur=v=>typeof v==='number'?v.toFixed(2).replace('.',',')+' €':'';
const lidlDay=d=>{const x=new Date(d+'T12:00:00');return x.getDate()+'/'+(x.getMonth()+1)};
const lidlMatch=(x,f)=>f==='proxima'?x.w==='proxima'||x.w==='finde-proxima':LIDL_PERIODS.has(f)?x.w===f:x.g===f;
// Del 20/11 al 22/11, desde el 23/11 o hasta el 29/11
const lidlDates=x=>x.f&&x.e?(x.f===x.e?'el '+lidlDay(x.f):'del '+lidlDay(x.f)+' al '+lidlDay(x.e)):x.f?'desde el '+lidlDay(x.f):x.e?'hasta el '+lidlDay(x.e):'';
function lidlCard(x){
 const when=[LIDL_WHEN[x.w],lidlDates(x)].filter(Boolean).join(' ')||x.b||'';
 return`<li class="lidl-card"><a class="lidl-img" href="https://www.lidl.es${esc(x.u||'')}" target="_blank" rel="noopener" aria-label="Ver ${esc(x.n)} en lidl.es">${x.i?`<img src="${esc(x.i)}" alt="" loading="lazy" decoding="async">`:'<span aria-hidden="true">🛒</span>'}${x.d?`<b class="lidl-pct">-${esc(x.d)}%</b>`:''}</a><div class="lidl-info"><span class="lidl-name">${esc(x.n)}</span>${x.k?`<small>${esc(x.k)}</small>`:''}<span class="lidl-price">${x.p!=null?`<b>${lidlEur(x.p)}</b>`:'<small>Precio en tienda</small>'}${x.o&&x.o>x.p?`<s>${lidlEur(x.o)}</s>`:''}</span>${x.l!=null?`<small class="lidl-plus">Con Lidl Plus: <b>${lidlEur(x.l)}</b></small>`:''}${when?`<small class="lidl-when">${esc(when)}</small>`:''}<button class="btn sec" data-act="lidlAdd" data-c="${esc(x.c)}" aria-label="Añadir ${esc(x.n)} a la lista">+ Lista</button></div></li>`;
}
function vCkLidl(){
 lidlLoad();
 if(!LIDL)return`<p class="hint">${esc(lidlError||'Cargando las ofertas de Lidl…')}</p>${lidlError?'<button class="btn sec" data-act="lidlRetry">Reintentar</button>':''}`;
 const all=LIDL.items,f=LIDL_FILTERS.some(([k])=>k===ui.lidlF)?ui.lidlF:'semana',q=norm(ui.lidlQ||'');
 let list=q?all.filter(x=>norm(x.n+' '+(x.s||'')).includes(q)):all.filter(x=>lidlMatch(x,f));
 list=list.slice().sort(LIDL_PERIODS.has(f)&&!q?(a,b)=>(b.d||0)-(a.d||0)||a.n.localeCompare(b.n,'es'):(a,b)=>(a.s||'').localeCompare(b.s||'','es')||a.n.localeCompare(b.n,'es'));
 const updated=LIDL.at?relDate(LIDL.at.slice(0,10)).toLowerCase():'';
 let h=`<p class="hint">Ofertas y precios de las tiendas Lidl${LIDL.region?' de '+esc(LIDL.region):''}, con el precio Lidl Plus cuando es distinto${updated?` · actualizado ${esc(updated)}`:''}.</p>`;
 h+=`<input class="field" id="qLidl" type="search" autocomplete="off" placeholder="Buscar comida o limpieza (yogur, aceite, detergente…)" value="${esc(ui.lidlQ||'')}">`;
 h+=`<div class="chips lidl-filters">${LIDL_FILTERS.map(([k,l])=>`<button class="chip ${!q&&f===k?'on':''}" data-act="lidlFilter" data-v="${k}">${l} <small>${all.filter(x=>lidlMatch(x,k)).length}</small></button>`).join('')}</div>`;
 // En «Comida», botones para ver una sola sección
 if(f==='super'&&!q){
  const secs=[...new Set(list.map(x=>x.s||'Otros'))].sort(lidlSecOrder),sec=secs.includes(ui.lidlSec)?ui.lidlSec:'';
  h+=`<div class="chips lidl-secs"><button class="chip ${sec?'':'on'}" data-act="lidlSec" data-v="">Todas</button>${secs.map(x=>`<button class="chip ${sec===x?'on':''}" data-act="lidlSec" data-v="${esc(x)}">${esc(x)} <small>${list.filter(y=>(y.s||'Otros')===x).length}</small></button>`).join('')}</div>`;
  if(sec)list=list.filter(x=>(x.s||'Otros')===sec);
 }
 if(!list.length)return h+`<div class="empty">${q?'No hay productos de Lidl con ese nombre.':'No hay productos en este apartado ahora mismo.'}</div>`;
 // Agrupado por secciones, como en Mercadona (congelados, carne, pescado…)
 const groups=new Map();for(const x of list){const k=x.s||'Otros';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(x)}
 return h+[...groups.keys()].sort(lidlSecOrder).map(k=>`<h4 class="lidl-sec">${esc(k)} <small>${groups.get(k).length}</small></h4><ul class="lidl-grid">${groups.get(k).map(lidlCard).join('')}</ul>`).join('');
}
// Lista propia para Lidl (id fijo: si los dos móviles la crean a la vez, es la misma)
const LIDL_LIST={id:'lidl',name:'Lidl'};
function lidlList(){if(!S.lists.some(l=>l.id===LIDL_LIST.id))S.lists.push({...LIDL_LIST});return LIDL_LIST.id}
const lidlMisplaced=()=>S.items.filter(i=>i.listId!==LIDL_LIST.id&&(i.store==='Lidl'||/ \(Lidl\)$/.test(i.name||'')));
// Lo que se añadió de Lidl a la lista del súper (antes de la 115) pasa a la lista Lidl.
// Devuelve true si ha guardado (y, por tanto, ya se ha vuelto a pintar).
function lidlSeparate(){
 if(lidlSeparate.busy||(typeof canWrite!=='undefined'&&!canWrite)||syncState==='ro')return false;
 const wrong=lidlMisplaced();if(!wrong.length)return false;
 lidlSeparate.busy=true;
 try{const id=lidlList();for(const i of wrong){i.listId=id;i.name=String(i.name).replace(/ \(Lidl\)$/,'');i.store='Lidl'}save();setTimeout(()=>toast(`${wrong.length} ${wrong.length===1?'producto de Lidl pasado':'productos de Lidl pasados'} a su lista`),0);return true}
 finally{lidlSeparate.busy=false}
}
// El mercadillo ya no se usa: se quita cualquier lista que lo lleve en el nombre (aunque tenga emoji u
// otras palabras), con sus productos, y una sección «Mercadillo» si la hay. Con copia de seguridad antes.
// Devuelve true si ha guardado (y, por tanto, ya se ha vuelto a pintar).
const isMarket=name=>/mercadillo/.test(norm(name));
function marketListCleanup(){
 if(marketListCleanup.busy||(typeof canWrite!=='undefined'&&!canWrite)||syncState==='ro')return false;
 const gone=S.lists.filter(l=>isMarket(l.name)),secs=(S.sections||[]).filter(isMarket);
 if(!secs.length&&(!gone.length||S.lists.length<=gone.length))return false;
 marketListCleanup.busy=true;
 try{
  const bid='antes-quitar-mercadillo-'+Date.now(),before=clone(S);saveLocalBackup(bid,before,'Antes de quitar la lista Mercadillo');cloudBackup(bid,before,'Antes de quitar la lista Mercadillo');
  if(gone.length&&S.lists.length>gone.length){const ids=new Set(gone.map(l=>l.id));S.lists=S.lists.filter(l=>!ids.has(l.id));S.items=S.items.filter(i=>!ids.has(i.listId));S.staples=S.staples.filter(x=>!ids.has(x.listId));if(ids.has(ui.list))ui.list=S.lists[0].id}
  if(secs.length){const to=(S.sections||[]).includes('Fruta y verdura')?'Fruta y verdura':'Otros';S.sections=S.sections.filter(x=>!isMarket(x));for(const i of S.items)if(isMarket(i.section))i.section=to}
  save();setTimeout(()=>toast('Mercadillo quitado de Compras (hay copia de seguridad)'),0);return true;
 }finally{marketListCleanup.busy=false}
}
// Productos de Lidl de la lista sin foto (añadidos antes de la 118): se busca la suya en las ofertas
function lidlFillImages(){
 const missing=S.items.filter(i=>i.listId===LIDL_LIST.id&&!i.img&&!i.mid);if(!missing.length||(typeof canWrite!=='undefined'&&!canWrite)||syncState==='ro')return false;
 if(!LIDL){lidlLoad();return false}
 let n=0;for(const i of missing){const x=LIDL.items.find(x=>x.c===i.lidlCode)||LIDL.items.find(x=>norm(x.n)===norm(i.name));if(x&&x.i){i.img=x.i;i.lidlCode=x.c;n++}}
 if(!n||lidlFillImages.done===n+':'+missing.length)return false;
 lidlFillImages.done=n+':'+missing.length;save();return true;
}
// Buscar mientras se escribe, sin perder el cursor
document.addEventListener('input',e=>{if(e.target.id!=='qLidl')return;ui.lidlQ=e.target.value;clearTimeout(lidlLoad.t);lidlLoad.t=setTimeout(()=>{render();const el=$('#qLidl');if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length)}},250)});
const LIDL_ACT={
 lidlFilter:d=>{ui.lidlF=d.v;ui.lidlQ='';ui.lidlSec='';render()},
 lidlSec:d=>{ui.lidlSec=d.v;render()},
 lidlRetry:()=>{lidlLoad(true);render()},
 lidlAdd:d=>{
  const x=LIDL?.items.find(i=>i.c===d.c);if(!x)return;
  // A su propia lista «Lidl», no a la del súper (que es la cesta de Mercadona)
  if(addToList({name:x.n,qty:x.k||'',section:lidlListSection(x),...(x.p!=null?{price:x.p,uprice:x.p}:{}),...(x.i?{img:x.i}:{}),lidlCode:x.c,store:'Lidl'},lidlList()))toast('«'+x.n+'» añadido a la lista Lidl');
 }
};
