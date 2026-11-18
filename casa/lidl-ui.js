/* Compras › Lidl: ofertas y productos de tienda.
   Los datos vienen de casa/lidl.json, que una tarea de GitHub descarga cada día de la web de Lidl.
   Lidl publica los mismos precios para toda España (no cambian por código postal). */
let LIDL=null,lidlLoading=false,lidlError='';
function lidlLoad(force){
 if(lidlLoading||(LIDL&&!force))return;lidlLoading=true;lidlError='';
 fetch('lidl.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()})
  .then(d=>{LIDL={at:d.at||'',items:Array.isArray(d.items)?d.items:[]}})
  .catch(()=>{lidlError='No se han podido cargar las ofertas de Lidl. Revisa la conexión.'})
  .finally(()=>{lidlLoading=false;if(ui.view==='compras'&&ui.ckTab==='lidl')render()});
}
const LIDL_FILTERS=[['ofertas','🏷️ Ofertas'],['super','🛒 Súper'],['fruta','🥬 Fruta y verdura'],['casa','🧴 Droguería'],['bazar','🛍️ Bazar']];
const LIDL_SECTION={super:'Despensa',fruta:'Fruta y verdura',casa:'Limpieza',bazar:'Otros'};
const lidlEur=v=>typeof v==='number'?v.toFixed(2).replace('.',',')+' €':'';
const lidlDay=d=>{const x=new Date(d+'T12:00:00');return x.getDate()+'/'+(x.getMonth()+1)};
const lidlMatch=(x,f)=>f==='ofertas'?x.d>0:x.g===f;
function lidlCard(x){
 const when=[x.b,x.e?'hasta el '+lidlDay(x.e):''].filter(Boolean).join(' · ');
 return`<li class="lidl-card"><a class="lidl-img" href="https://www.lidl.es${esc(x.u||'')}" target="_blank" rel="noopener" aria-label="Ver ${esc(x.n)} en lidl.es">${x.i?`<img src="${esc(x.i)}" alt="" loading="lazy" decoding="async">`:'<span aria-hidden="true">🛒</span>'}${x.d?`<b class="lidl-pct">-${esc(x.d)}%</b>`:''}</a><div class="lidl-info"><span class="lidl-name">${esc(x.n)}</span>${x.k?`<small>${esc(x.k)}</small>`:''}<span class="lidl-price">${x.p!=null?`<b>${lidlEur(x.p)}</b>`:'<small>Precio en tienda</small>'}${x.o&&x.o>x.p?`<s>${lidlEur(x.o)}</s>`:''}</span>${when?`<small class="lidl-when">${esc(when)}</small>`:''}<button class="btn sec" data-act="lidlAdd" data-c="${esc(x.c)}" aria-label="Añadir ${esc(x.n)} a la lista">+ Lista</button></div></li>`;
}
function vCkLidl(){
 lidlLoad();
 if(!LIDL)return`<p class="hint">${esc(lidlError||'Cargando las ofertas de Lidl…')}</p>${lidlError?'<button class="btn sec" data-act="lidlRetry">Reintentar</button>':''}`;
 const all=LIDL.items,f=ui.lidlF||'ofertas',q=norm(ui.lidlQ||'');
 let list=q?all.filter(x=>norm(x.n+' '+(x.s||'')).includes(q)):all.filter(x=>lidlMatch(x,f));
 list=list.slice().sort(f==='ofertas'&&!q?(a,b)=>(b.d||0)-(a.d||0)||a.n.localeCompare(b.n,'es'):(a,b)=>(a.s||'').localeCompare(b.s||'','es')||a.n.localeCompare(b.n,'es'));
 const updated=LIDL.at?relDate(LIDL.at.slice(0,10)).toLowerCase():'';
 let h=`<p class="hint">Ofertas y productos de las tiendas Lidl. Los precios son los mismos en toda España${updated?` · actualizado ${esc(updated)}`:''}.</p>`;
 h+=`<input class="field" id="qLidl" type="search" autocomplete="off" placeholder="Buscar en Lidl (yogur, aceite, detergente…)" value="${esc(ui.lidlQ||'')}">`;
 h+=`<div class="chips lidl-filters">${LIDL_FILTERS.map(([k,l])=>`<button class="chip ${!q&&f===k?'on':''}" data-act="lidlFilter" data-v="${k}">${l} <small>${all.filter(x=>lidlMatch(x,k)).length}</small></button>`).join('')}</div>`;
 if(!list.length)return h+`<div class="empty">${q?'No hay productos de Lidl con ese nombre.':'No hay productos en este apartado ahora mismo.'}</div>`;
 // En el bazar, agrupados por tipo (ropa, cocina, bricolaje…)
 if(f==='bazar'&&!q){let cur='';h+='<div class="lidl-groups">';for(const x of list){if(x.s!==cur){if(cur)h+='</ul>';cur=x.s;h+=`<h4>${esc(cur)}</h4><ul class="lidl-grid">`}h+=lidlCard(x)}return h+'</ul></div>'}
 return h+`<ul class="lidl-grid">${list.map(lidlCard).join('')}</ul>`;
}
// Buscar mientras se escribe, sin perder el cursor
document.addEventListener('input',e=>{if(e.target.id!=='qLidl')return;ui.lidlQ=e.target.value;clearTimeout(lidlLoad.t);lidlLoad.t=setTimeout(()=>{render();const el=$('#qLidl');if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length)}},250)});
const LIDL_ACT={
 lidlFilter:d=>{ui.lidlF=d.v;ui.lidlQ='';render()},
 lidlRetry:()=>{lidlLoad(true);render()},
 lidlAdd:d=>{
  const x=LIDL?.items.find(i=>i.c===d.c);if(!x)return;
  if(addToList({name:x.n+' (Lidl)',qty:x.k||'',section:LIDL_SECTION[x.g]||'Otros',...(x.p!=null?{price:x.p,uprice:x.p}:{}),store:'Lidl'},cartList()))toast('«'+x.n+'» añadido a la lista');
 }
};
