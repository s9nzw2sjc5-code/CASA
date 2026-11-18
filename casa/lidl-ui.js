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
  .finally(()=>{lidlLoading=false;if(ui.view==='compras'&&ui.ckTab==='lidl')render()});
}
const LIDL_FILTERS=[['semana','🏷️ Esta semana'],['finde','🎉 Fin de semana'],['proxima','⏭️ Próxima semana'],['super','🛒 Comida'],['fruta','🥬 Fruta y verdura'],['limpieza','🧴 Limpieza']];
const LIDL_WHEN={semana:'Esta semana',finde:'Fin de semana',proxima:'Próxima semana','finde-proxima':'Fin de semana que viene'};
const LIDL_PERIODS=new Set(['semana','finde','proxima']);
const LIDL_SECTION={super:'Despensa',fruta:'Fruta y verdura',limpieza:'Limpieza'};
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
 if(!list.length)return h+`<div class="empty">${q?'No hay productos de Lidl con ese nombre.':'No hay productos en este apartado ahora mismo.'}</div>`;
 return h+`<ul class="lidl-grid">${list.map(lidlCard).join('')}</ul>`;
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
// El mercadillo ya no se usa: su lista se quita (con sus productos), con copia de seguridad antes.
// Devuelve true si ha guardado (y, por tanto, ya se ha vuelto a pintar).
function marketListCleanup(){
 if(marketListCleanup.busy||(typeof canWrite!=='undefined'&&!canWrite)||syncState==='ro')return false;
 const gone=S.lists.filter(l=>norm(l.name)==='mercadillo');if(!gone.length||S.lists.length<=gone.length)return false;
 marketListCleanup.busy=true;
 try{
  const bid='antes-quitar-mercadillo-'+Date.now(),before=clone(S);saveLocalBackup(bid,before,'Antes de quitar la lista Mercadillo');cloudBackup(bid,before,'Antes de quitar la lista Mercadillo');
  const ids=new Set(gone.map(l=>l.id));S.lists=S.lists.filter(l=>!ids.has(l.id));S.items=S.items.filter(i=>!ids.has(i.listId));S.staples=S.staples.filter(x=>!ids.has(x.listId));
  if(ids.has(ui.list))ui.list=S.lists[0].id;
  save();setTimeout(()=>toast('Lista «Mercadillo» quitada (hay copia de seguridad)'),0);return true;
 }finally{marketListCleanup.busy=false}
}
// Buscar mientras se escribe, sin perder el cursor
document.addEventListener('input',e=>{if(e.target.id!=='qLidl')return;ui.lidlQ=e.target.value;clearTimeout(lidlLoad.t);lidlLoad.t=setTimeout(()=>{render();const el=$('#qLidl');if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length)}},250)});
const LIDL_ACT={
 lidlFilter:d=>{ui.lidlF=d.v;ui.lidlQ='';render()},
 lidlRetry:()=>{lidlLoad(true);render()},
 lidlAdd:d=>{
  const x=LIDL?.items.find(i=>i.c===d.c);if(!x)return;
  // A su propia lista «Lidl», no a la del súper (que es la cesta de Mercadona)
  if(addToList({name:x.n,qty:x.k||'',section:LIDL_SECTION[x.g]||'Otros',...(x.p!=null?{price:x.p,uprice:x.p}:{}),store:'Lidl'},lidlList()))toast('«'+x.n+'» añadido a la lista Lidl');
 }
};
