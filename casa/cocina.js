/*
 * Cocina: menú semanal con presupuesto, recetas guardadas (también de Instagram,
 * TikTok o webs), despensa con cantidades y precios de Mercadona.
 *
 * Se carga antes del script principal de index.html y usa sus utilidades
 * (S, ui, save, sheet, esc, norm, uid…) cuando se llama a cada función.
 * Los precios salen de mercadona.json, que GitHub Actions actualiza cada día.
 */

/* ---------- ajustes ---------- */
const CK_APPL=[['horno','Horno'],['airfryer','Freidora de aire'],['robot','Robot de cocina'],['olla','Olla rápida / programable'],['micro','Microondas'],['fuego','Vitro / inducción / gas'],['lenta','Olla lenta'],['plancha','Plancha / grill'],['batidora','Batidora'],['vapor','Vaporera']];
// Si no tienes el electrodoméstico de la receta, con cuál se puede hacer igual
const CK_ALT={horno:['airfryer'],airfryer:['horno'],olla:['fuego','lenta','robot'],robot:['fuego','batidora'],lenta:['olla','fuego'],vapor:['micro','olla','robot','fuego'],plancha:['fuego','airfryer'],micro:['fuego'],batidora:['robot'],fuego:['robot','olla']};
const CK_LOCS=['Despensa','Nevera','Congelador'];
const CK_STORES=['Mercadona','Mercadillo','Lidl','Carrefour','Dia','Aldi','Mercado / frutería'];
const ck=()=>{const c=Object.assign({people:2,budget:50,vetoes:[],appl:['horno','fuego','micro'],meals:['comida','cena'],rej:{},stores:CK_STORES},S.cook||{});
  // El mercadillo siempre está entre los sitios de compra
  if(!c.stores.includes('Mercadillo'))c.stores=[c.stores[0],'Mercadillo',...c.stores.slice(1)];return c};
function ckSet(k,v){S.cook=Object.assign({},S.cook||{});S.cook[k]=v;save()}
const applName=k=>(CK_APPL.find(a=>a[0]===k)||[k,k])[1];
const eur=n=>(Math.round(n*100)/100).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
const eur0=n=>Math.round(n).toLocaleString('es-ES')+' €';
const weekStart=off=>{const b=new Date();b.setDate(b.getDate()+off*7);b.setDate(b.getDate()-((b.getDay()+6)%7));return ds(b)};
const recipeByName=n=>S.recipes.find(r=>norm(r.name)===norm(n));
function parseIngs(txt){return txt.split('\n').map(l=>l.replace(/^[\s\-•*▪·✔️✅👉🔸🔹]+/u,'').trim()).filter(Boolean).map(l=>{const i=l.indexOf(',');return i<0?{name:l,qty:''}:{name:l.slice(0,i).trim(),qty:l.slice(i+1).trim()}}).filter(x=>x.name)}
const ingsText=r=>(r&&r.ingredients||[]).map(i=>i.name+(i.qty?', '+i.qty:'')).join('\n');

/* ---------- palabras y coincidencias ---------- */
const CK_STOP=new Set(['de','del','la','el','los','las','en','con','y','para','al','a','un','una','o','sin','fresco','fresca','frescos','frescas','natural','grande','grandes','pequeno','pequena','picado','picada','troceado','troceada','al','gusto']);
const words=s=>norm(s).replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>w&&!CK_STOP.has(w));
const same=(a,b)=>a===b||a+'s'===b||b+'s'===a||a+'es'===b||b+'es'===a;
const hasWord=(arr,w)=>arr.some(x=>same(x,w));
const allIn=(need,have)=>need.length&&need.every(w=>hasWord(have,w));

/* ---------- catálogo de Mercadona ---------- */
let MC=null,mcLoading=null;const mcCache=new Map();
function loadMC(){
  if(MC||mcLoading)return mcLoading;
  mcLoading=fetch('mercadona.json').then(r=>{if(!r.ok)throw 0;return r.json()}).then(d=>{
    d.p.forEach(p=>p[0]=String(p[0]));d.byId=new Map(d.p.map(p=>[p[0],p]));d.w=d.p.map(p=>words(p[1]));d.subs=d.subs||[];buildVocab(d);MC=d;mcCache.clear();
    if(ui.view==='compras'&&!document.querySelector('.overlay'))render();
  }).catch(()=>{mcLoading=null});
  return mcLoading;
}
// Producto: [id, nombre, envase, precio, tamaño, unidad, precio_ref, unidad_ref, categoría, imagen, aprox]
const prod=p=>p&&{id:p[0],name:p[1],pack:p[2],price:p[3],size:(p[5]==='ud'?p[4]:p[4]*1000)||(p[5]==='ud'?1:500),d:p[5]==='ud'?'ud':'m',fmt:p[5],ref:p[6],refFmt:p[7],cat:MC.cats[p[8]],img:p[9]};
const prodSize=p=>p.user&&!p.size?'':p.d==='ud'?(p.size+' ud'):p.size>=1000?(p.size/1000).toLocaleString('es-ES')+(p.fmt==='l'?' L':' kg'):Math.round(p.size)+(p.fmt==='l'?' ml':' g');
const prodImg=p=>p.img?`https://prod-mercadona.imgix.net/images/${p.img}?fit=contain&h=96&w=96`:'';
const prodUrl=id=>'https://tienda.mercadona.es/product/'+id;
const CK_BADCAT=/Mascotas|Bebé|Cuidado|Maquillaje|Fitoterapia|Limpieza|Pizzas|Aperitivos|Bodega/;
// Nombres de receta que en Mercadona se llaman de otra forma
const CK_ALIAS={espagueti:'spaghetti',espaguetis:'spaghetti',quesitos:'queso porciones','carne picada mixta':'carne picada vacuno cerdo','carne picada':'carne picada vacuno cerdo','especias fajitas':'fajitas',morcillo:'ternera guisar','pan de hamburguesa':'pan hamburguesa',gambas:'gamba pelada','gambas peladas':'gamba pelada',lentejas:'lenteja pardina','lentejas pardinas':'lenteja pardina','garbanzos secos':'garbanzo lechoso',calabaza:'calabaza troceada','queso parmesano':'grana padano',parmesano:'grana padano','lomo de cerdo':'filetes lomo cerdo',gallina:'gallina',ajo:'ajos morados',ajos:'ajos morados','diente de ajo':'ajos morados'};
// Productos ya elaborados: solo si la receta los pide
const CK_PROC=['rebozada','rebozado','empanada','empanadas','empanado','croquetas','papilla','asado','adobado','adobada','fingers','figuritas','elaborado','rellenas','relleno','sabor','snack','crema','salsa','mortadela','limonada','refresco','listo','preparado','cocinado','precocinado','sopa','patatas','polvo','frita','caramelizada','crujiente','deshidratada','encurtidos'];
const CK_PROC2=['granulado','ultracongelado','ultracongelada','ultracongelados','ultracongeladas','troceado','troceada','laminados','laminado'];
function scoreMC(qw){
  const out=[];
  for(let i=0;i<MC.p.length;i++){
    const pw=MC.w[i];if(!qw.every(w=>pw.some(x=>same(x,w)||(w.length>3&&x.startsWith(w)&&x.length-w.length<=2))))continue;
    const at=pw.findIndex(x=>same(x,qw[0])||(qw[0].length>3&&x.startsWith(qw[0])&&x.length-qw[0].length<=2));
    let s=at===0?4:at===1?1.5:-2;
    qw.forEach(w=>{if(hasWord(pw,w))s+=1});
    s-=pw.length*.35;if(CK_BADCAT.test(MC.cats[MC.p[i][8]]))s-=6;
    pw.forEach(x=>{if(CK_PROC.includes(x)&&!hasWord(qw,x))s-=5});
    pw.forEach(x=>{if(CK_PROC2.includes(x)&&!hasWord(qw,x))s-=1.5});
    out.push([s,i]);
  }
  return out.sort((a,b)=>b[0]-a[0]||MC.p[a[1]][6]-MC.p[b[1]][6]);
}
function searchMC(q,limit){
  if(!MC)return[];
  let qw=words(CK_ALIAS[norm(q)]||q),out=[];
  // Si nada lleva todas las palabras, se prueba quitando las últimas («carne picada mixta» → «carne picada»)
  while(qw.length&&!(out=scoreMC(qw)).length)qw=qw.slice(0,-1);
  return out.slice(0,limit||20).map(x=>Object.assign(prod(MC.p[x[1]]),{s:x[0]}));
}
// Precio apuntado al comprar en otro supermercado (S.prices): manda sobre Mercadona
function userPrice(name){
  const e=(S.prices||{})[norm(name)];
  if(!e||e.use===false||!(e.price>0))return null;
  const size=e.n>0?e.n:(e.d==='ud'?1:1000);
  return{id:'',user:true,store:e.store,at:e.at,name:e.label||e.name,pack:'',price:e.price,size,d:e.d||'m',fmt:e.d==='ud'?'ud':'kg',ref:e.d==='ud'?e.price/size:e.price/size*1000,refFmt:e.d==='ud'?'ud':'kg',cat:'',img:''};
}
function savePrice(name,o){
  const k=norm(name),old=(S.prices||{})[k]||{};
  const hist=[...(old.hist||[]).map(CasaReceipts.historyEntry),{date:o.at||today(),store:o.store,price:o.price,n:o.n||0,d:o.d||'m'}].slice(-12);
  S.prices=Object.assign({},S.prices||{});
  S.prices[k]=Object.assign({},old,{name,store:o.store,price:o.price,n:o.n||0,d:o.d||'m',label:o.label||old.label||'',qtxt:o.qtxt||'',at:o.at||today(),use:o.store!=='Mercadona',hist});
}
const priceSrc=p=>p&&p.user?p.store:'Mercadona';
function matchProduct(name){
  const up=userPrice(name);if(up)return up;
  if(!MC)return null;
  const k=norm(name),pm=S.prodMap||{};
  if(pm[k]){const p=MC.byId.get(pm[k]);if(p)return prod(p)}
  if(mcCache.has(k))return mcCache.get(k);
  // De los que más se parecen, el envase más barato: compras solo lo que necesitas
  const a=searchMC(name,8),best=a[0];
  const p=best?a.filter(x=>x.s>=best.s-1).sort((x,y)=>x.price-y.price)[0]:null;
  mcCache.set(k,p);return p;
}

/* ---------- buscador de productos ---------- */
// Palabras del catálogo con cuántos productos las llevan (para corregir y sugerir)
function buildVocab(d){const v=new Map();d.w.forEach(ws=>new Set(ws).forEach(w=>{if(w.length>1)v.set(w,(v.get(w)||0)+1)}));d.vocab=[...v.entries()].sort((a,b)=>b[1]-a[1])}
// Distancia de edición (con límite, para errores al escribir)
function lev(a,b,max){
  if(Math.abs(a.length-b.length)>max)return max+1;
  let prev=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){const cur=[i];let best=i;
    for(let j=1;j<=b.length;j++){cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
      if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])cur[j]=Math.min(cur[j],prev[j-2]+1);best=Math.min(best,cur[j])}
    if(best>max)return max+1;prev=cur}
  return prev[b.length];
}
const typoMax=w=>w.length>=7?2:w.length>=4?1:0;
// Qué tal casa una palabra buscada con una palabra del producto (0 = nada)
function wordHit(q,w){
  if(same(q,w))return 4;
  if(w.startsWith(q))return q.length>=3?3:2;
  if(q.length>=4&&w.includes(q))return 1.5;
  const m=typoMax(q);if(!m)return 0;
  if(lev(q,w,m)<=m)return 1.8;
  if(w.length>q.length&&lev(q,w.slice(0,q.length),m)<=m)return 1.2;
  return 0;
}
const qWords=q=>{const all=norm(q).replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(Boolean);const w=all.filter(x=>!CK_STOP.has(x));return w.length?w:all};
// Busca por trozos de palabra, en cualquier orden, sin tildes y con pequeños errores; ordena por relevancia
function searchProducts(q,limit,minHits){
  if(!MC)return[];
  q=norm(q).replace(/\bpasta(?:s)? (?:de )?dientes\b/g,'dentifrico').replace(/\bpasta dental\b/g,'dentifrico');
  const qw=qWords(q);if(!qw.length)return[];
  const nq=norm(q).trim(),fav=new Set(favKeys(cartList())),usual=new Set((ck().usual||[]).slice(0,60)),out=[];
  for(let i=0;i<MC.p.length;i++){
    const pw=MC.w[i];let sc=0,hits=0;
    qw.forEach((q2,k)=>{let b=0,at=-1;pw.forEach((w,j)=>{const h=wordHit(q2,w);if(h>b){b=h;at=j}});if(b){hits++;sc+=b;if(at===k)sc+=.6;if(at===0)sc+=1}});
    if(hits<(minHits||qw.length))continue;
    const name=norm(MC.p[i][1]);
    if(name.startsWith(nq))sc+=3;else if(name.includes(nq))sc+=1.5;
    if(fav.has(MC.p[i][0]))sc+=2.5;else if(usual.has(MC.p[i][0]))sc+=1.2;
    sc-=pw.length*.12;
    out.push([sc,i]);
  }
  return out.sort((a,b)=>b[0]-a[0]||MC.p[a[1]][3]-MC.p[b[1]][3]).slice(0,limit||60).map(x=>prod(MC.p[x[1]]));
}
// «¿Querías decir…?»: cada palabra cambiada por la más parecida del catálogo
function didYouMean(q){
  if(!MC)return'';const qw=qWords(q);let changed=false;
  const fixed=qw.map(w=>{if(MC.vocab.some(([v])=>v===w))return w;const m=Math.max(1,typoMax(w));let best=null;
    for(const[v,n]of MC.vocab){if(Math.abs(v.length-w.length)>m)continue;const d=lev(w,v,m);if(d<=m&&(!best||d<best[1]||(d===best[1]&&n>best[2])))best=[v,d,n]}
    if(best){changed=true;return best[0]}return w});
  return changed?fixed.join(' '):'';
}
// Sugerencias mientras se escribe: cómo terminan las palabras y nombres de productos
function suggestTerms(q){
  if(!MC)return[];const all=qWords(q);if(!all.length)return[];
  const last=all[all.length-1],head=all.slice(0,-1).join(' ');
  const comp=MC.vocab.filter(([v])=>v!==last&&v.startsWith(last)).slice(0,4).map(([v])=>(head?head+' ':'')+v);
  const names=[...new Set(searchProducts(q,12).map(p=>p.name.replace(/ (Hacendado|Deliplus|Bosque Verde)\b.*$/,'')))].slice(0,5);
  return[...new Set([...comp,...names])].filter(x=>norm(x)!==norm(q)).slice(0,6);
}

/* ---------- cantidades ---------- */
// Peso aproximado de una unidad, para pasar «2 cebollas» a gramos
const CK_UW={cebolla:150,patata:200,tomate:150,zanahoria:80,pimiento:180,ajo:6,diente:6,limon:120,lima:80,manzana:180,platano:120,calabacin:300,berenjena:300,pepino:250,aguacate:200,puerro:150,naranja:200,pera:180,pechuga:220,lechuga:400,brocoli:400,coliflor:800,calabaza:1200,pan:250,muslo:150,contramuslo:120,filete:150,salchicha:60,hamburguesa:110,yogur:125,tortilla:40,lomo:150,solomillo:400,dorada:400,lubina:400,merluza:150,salmon:150};
const CK_UNITS={kg:['m',1000],kilo:['m',1000],kilos:['m',1000],g:['m',1],gr:['m',1],grs:['m',1],gramo:['m',1],gramos:['m',1],l:['m',1000],litro:['m',1000],litros:['m',1000],ml:['m',1],cl:['m',10],dl:['m',100],cucharada:['m',15],cucharadas:['m',15],cda:['m',15],cdas:['m',15],cucharadita:['m',5],cucharaditas:['m',5],cdta:['m',5],cdtas:['m',5],taza:['m',240],tazas:['m',240],vaso:['m',200],vasos:['m',200],chorro:['m',15],chorrito:['m',10],pizca:['m',1],pizcas:['m',1],puñado:['m',30],punado:['m',30],loncha:['m',20],lonchas:['m',20],rebanada:['m',35],rebanadas:['m',35],diente:['ud',1],dientes:['ud',1],ud:['ud',1],uds:['ud',1],unidad:['ud',1],unidades:['ud',1],lata:['ud',1],latas:['ud',1],bote:['ud',1],botes:['ud',1],sobre:['ud',1],sobres:['ud',1],paquete:['ud',1],paquetes:['ud',1],bandeja:['ud',1],brick:['ud',1],tarro:['ud',1]};
function parseQty(s){
  let t=norm(s).replace(/½/g,'1/2').replace(/¼/g,'1/4').replace(/(\d),(\d)/g,'$1.$2').trim();
  if(!t)return null;
  t=t.replace(/^(medio|media)\b/,'0.5').replace(/^(un|una|uno)\b/,'1');
  const m=t.match(/^(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+))?(?:\s*(?:-|a)\s*\d+(?:\.\d+)?)?\s*([a-zñ]*)/);
  if(!m)return null;
  let n=+m[1];if(m[2])n=n/+m[2];
  const u=CK_UNITS[m[3]];
  return u?{n:n*u[1],d:u[0],raw:m[3],pack:/^(lata|bote|sobre|paquete|bandeja|brick|tarro)/.test(m[3])}:{n,d:'ud',raw:''};
}
const unitW=name=>{const w=words(name);for(const x of w){for(const k in CK_UW)if(same(x,k))return CK_UW[k]}return 0};
// Cantidad que necesita la receta en la misma medida que el producto o la despensa
function toDim(q,name,d,psize){
  if(!q)return null;
  if(q.pack&&psize)return q.n*psize;
  if(q.d===d)return q.n;
  const w=unitW(name)||(q.raw==='diente'||q.raw==='dientes'?6:0);
  if(q.d==='ud'&&d==='m'&&w)return q.n*w;
  if(q.d==='m'&&d==='ud'&&w)return q.n/w;
  return null;
}
const fmtAmt=(n,u)=>u==='ud'?(Math.round(n*10)/10).toLocaleString('es-ES')+' ud':n>=1000?(Math.round(n/100)/10).toLocaleString('es-ES')+(u==='ml'?' L':' kg'):Math.round(n)+' '+(u||'g');

/* ---------- costes ---------- */
// Lo que cuesta la parte que se usa de cada ingrediente (para comparar platos)
function ingCost(g,f){
  const p=matchProduct(g.name);if(!p)return null;
  const q=parseQty(g.qty);
  if(!q)return{p,cost:p.price*.12*Math.min(f,3),packs:1};
  const n=toDim(q,g.name,p.d,p.size);
  const frac=n==null?.3*f:n*f/p.size;
  return{p,cost:Math.max(.02,p.price*frac),packs:Math.max(1,Math.ceil(frac-1e-6))};
}
function recipeCost(r,people){
  if(!MC||!r||!r.ingredients.length)return null;
  const f=(people||r.servings||2)/(r.servings||2);
  let t=0,miss=0;r.ingredients.forEach(g=>{const c=ingCost(g,f);if(c)t+=c.cost;else miss++});
  return{total:t,per:t/(people||r.servings||2),miss};
}

/* ---------- despensa ---------- */
const pUnit=x=>x.u==='ud'?'ud':x.u==='ml'?'m':'m';
function pantryFind(name){
  const k=norm(name),w=words(name);
  return(S.pantry||[]).find(x=>norm(x.name)===k)||(S.pantry||[]).find(x=>{const pw=words(x.name);return allIn(pw,w)||allIn(w,pw)});
}
const pantryLow=x=>!(x.n>0);
function setPantryPresent(x,packs=1){
  const p=x.mid&&MC?.byId.get(String(x.mid)),units=Math.max(1,Number(packs)||1);
  if(p){const product=prod(p);x.n=product.size*units;x.u=product.d==='ud'?'ud':product.fmt==='l'?'ml':'g'}
  else{x.n=units;x.u='ud'}
  x.full=x.n;x.at=today();
}
// Cuánto hay en casa de un ingrediente, en la medida d; null si no está
function pantryAmount(name,d){
  const x=pantryFind(name);if(!x)return null;
  if(pUnit(x)===d)return x.n;
  const w=unitW(name);if(!w)return x.n>0?Infinity:0;
  return d==='m'?x.n*w:x.n/w;
}
function pantryShare(r){
  if(!r.ingredients.length)return 0;
  return r.ingredients.filter(g=>{const x=pantryFind(g.name);return x&&x.n>0}).length/r.ingredients.length;
}
// Al cocinar: se descuenta lo usado
function useFromPantry(r,people){
  const f=(people||r.servings||2)/(r.servings||2);let c=0;
  r.ingredients.forEach(g=>{const x=pantryFind(g.name);if(!x)return;const q=parseQty(g.qty);if(!q)return;
    const n=toDim(q,g.name,pUnit(x));if(n==null)return;x.n=Math.max(0,Math.round((x.n-n*f)*10)/10);x.at=today();c++});
  return c;
}
// Lo comprado entra en la despensa
function addToPantry(i){
  const p0=i.mid&&MC&&MC.byId.get(i.mid);
  if(p0&&(pantryOf(i.mid)||!pantryFind(i.name))){pantryAddProd(prod(p0),i.units||1);return true}
  const x=pantryFind(i.name);
  if(!x){
    if(i.listId!==cartList()||!i.name?.trim())return false;
    const entry={id:uid(),name:i.name,n:0,u:'ud',min:0,loc:'Despensa',mid:i.mid||'',auto:false};setPantryPresent(entry,i.units||1);S.pantry=[...(S.pantry||[]),entry];return true;
  }
  let n=i.pq&&i.pq.d===pUnit(x)?i.pq.n:null;
  if(n==null){const q=parseQty(i.qty);n=q?toDim(q,i.name,pUnit(x)):null}
  if(n==null){const p=x.mid&&MC&&MC.byId.get(x.mid);n=p?prod(p).size*(i.units||1):(x.u==='ud'?i.units||1:0)}
  if(!n){if(!(x.n>0))setPantryPresent(x,i.units||1);else x.at=today();return true}x.n=Math.round((x.n+n)*10)/10;x.full=Math.max(x.full||0,x.n);x.at=today();return true;
}
function autoPantry(){
  let c=0;const L=S.lists.find(l=>l.id==='super')||S.lists[0];
  (S.pantry||[]).forEach(x=>{if(x.auto&&pantryLow(x)&&x.snooze!==today()&&!pantryShoppingItem(x,L.id)){S.items.push(pantryItem(x,L.id));c++}});
  if(c)save();return c;
}
function pantryShoppingItem(x,lid){
  return S.items.find(i=>i.listId===lid&&((x.mid&&String(i.mid)===String(x.mid))||norm(i.name)===norm(x.name)));
}
function finishedPantryQuery(text){
  return String(text||'').trim().replace(/^(?:(?:ya\s+)?(?:se\s+(?:(?:ha|han)\s+(?:acabado|terminado)|acab[oó])|no\s+(?:queda|quedan))|(?:he|hemos)\s+(?:acabado|terminado))(?:\s+|$)(?:(?:el|la|los|las)(?:\s+|$))?/i,'').trim();
}
function finishedPantryBatch(text){return /[,;\n]/.test(String(text).replace(/(\d),(\d)/g,'$1.$2'))}
function finishedPantryTerms(text){return norm(text).replace(/(\d)([a-z])/g,'$1 $2').replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>w&&!['de','del','la','el','los','las','en','y','para','al','a','un','una','o'].includes(w))}
function finishedPantryMatches(query){
  const terms=finishedPantryTerms;
  const q=norm(query),w=terms(query);if(!q)return [];
  return (S.pantry||[]).filter(x=>{const have=terms(x.name);return norm(x.name)===q||(w.length&&w.every(need=>have.some(word=>same(word,need)||(!['sin','con'].includes(need)&&need.length>=3&&word.startsWith(need)))))}).sort((a,b)=>(norm(b.name)===q)-(norm(a.name)===q)||a.name.localeCompare(b.name,'es'));
}
function finishedCatalogMatches(query){
  if(!MC?.p||query.length<2||finishedPantryBatch(query))return [];
  const measure=query.match(/\b(\d+(?:[.,]\d+)?)\s*(kg|gr|g|ml|cl|l)\b/i),search=measure?query.replace(measure[0],' '):query,need=finishedPantryTerms(search);
  return searchProducts(search,40).filter(p=>{
    if(!p.img)return false;
    if(measure){const u=measure[2].toLowerCase(),volume=/^(ml|cl|l)$/.test(u),amount=Number(measure[1].replace(',','.'))*(/^(kg|l)$/.test(u)?1000:u==='cl'?10:1);if(volume!==(p.fmt==='l')||Math.abs(amount-p.size)>.5)return false}
    const have=finishedPantryTerms(p.name);
    return need.length&&need.every(w=>have.some(t=>same(t,w)||(!['sin','con'].includes(w)&&(t.startsWith(w)||(w.length>=5&&t.length>=5&&Math.abs(w.length-t.length)<=1&&lev(w,t,1)<=1)))));
  }).slice(0,8);
}
function finishedProductTargets(p,query){
  const all=S.pantry||[],direct=all.filter(x=>String(x.mid||(S.prodMap||{})[norm(x.name)]||'')===p.id);if(direct.length)return direct;
  const have=finishedPantryTerms(p.name+' '+prodSize(p));
  const nameQuery=query.replace(/\b\d+(?:[.,]\d+)?\s*(kg|gr|g|ml|cl|l)\b/gi,' ').trim();
  return finishedPantryMatches(nameQuery).filter(x=>{const need=finishedPantryTerms(x.name);return !x.mid&&need.length&&same(need[0],have[0])&&need.every(w=>have.some(t=>same(t,w)||(!['sin','con'].includes(w)&&w.length>=3&&t.startsWith(w))))});
}
function markPantryFinished(id,name,product){
  const x=id?find(S.pantry||[],id):null;
  if(id&&!x)throw Error('Ese producto ya no está en casa. Vuelve a escribir su nombre.');
  const label=product?product.name:x?x.name:finishedPantryQuery(name);
  if(!label||(!product&&finishedPantryBatch(label)))throw Error('Escribe un producto cada vez.');
  const lid=cartList();if(!S.lists.some(l=>l.id===lid))throw Error('No se encuentra la lista de la compra.');
  const raw=x?.mid&&MC?.byId.get(String(x.mid)),p=product||(raw?prod(raw):null);
  if(product&&(!MC?.byId.has(product.id)||(x?.mid&&String(x.mid)!==product.id)))throw Error('La referencia ha cambiado. Vuelve a elegir el producto.');
  if(product&&x&&!x.mid&&(S.pantry||[]).some(other=>other.id!==x.id&&String(other.mid||'')===product.id))throw Error('Ya hay otro registro de este producto en casa. Elige ese registro.');
  const existing=p?(S.items.find(i=>i.listId===lid&&String(i.mid||'')===p.id)||S.items.find(i=>i.listId===lid&&!i.mid&&[label,x?.name,name].filter(Boolean).some(n=>norm(i.name)===norm(n)||finishedPantryTerms(i.name).join(' ')===finishedPantryTerms(n).join(' ')))):pantryShoppingItem(x||{name:label},lid);
  if(x){x.full=pantryFull(x);x.n=0;x.at=today();if(p){x.mid=p.id;x.section=p.cat||'Otros'}}
  if(p&&existing&&!existing.mid){Object.assign(existing,{mid:p.id,name:p.name,section:ckSection(p,p.name),store:'Mercadona'});setUnits(existing,existing.units||1)}
  if(!existing){
    if(p)cartSet(p,1,lid);
    else S.items.push({id:uid(),listId:lid,name:label,mid:x?.mid?String(x.mid):'',qty:'',units:1,section:ckSection(null,label),by:'',done:false,added:Date.now()});
  }
  if(p)rememberHabit(p.id);
  return {name:label,added:!existing,matched:!!x};
}
function finishedPantrySheet(){
  let selected='',target='',loading=!MC,timer;
  const ov=sheet('¿Qué se ha acabado?',`<p class="hint">Escribe el nombre y elige el producto de Mercadona para añadirlo con foto a «${esc((S.lists.find(l=>l.id===cartList())||{}).name||'Compras')}». Si está apuntado en casa, lo marcaremos como agotado.</p><label for="finishedPantryName">Producto que se ha acabado</label><input id="finishedPantryName" class="field" type="search" autocomplete="off" enterkeyhint="done" placeholder="Ej.: leche semidesnatada"><p class="hint" id="finishedPantryHint"></p><div id="finishedPantryMatches"></div><div id="finishedPantryTargets"></div><p class="hint" id="finishedPantryStatus" role="status" aria-live="polite"></p>`,{saveLabel:'Se ha acabado',onSave:()=>{submit();return false}});
  ov.classList.add('finished-pantry-sheet');
  const input=ov.querySelector('#finishedPantryName'),box=ov.querySelector('#finishedPantryMatches'),destinations=ov.querySelector('#finishedPantryTargets'),hint=ov.querySelector('#finishedPantryHint'),status=ov.querySelector('#finishedPantryStatus'),button=ov.querySelector('[data-s="ok"]');
  const choose=()=>{
    destinations.innerHTML='';target='';button.disabled=!selected;
    if(!selected.startsWith('mc:'))return;
    const raw=MC?.byId.get(selected.slice(3));if(!raw){button.disabled=true;return}
    const targets=finishedProductTargets(prod(raw),finishedPantryQuery(input.value));
    if(targets.length===1)target=targets[0].id;
    if(targets.length>1){button.disabled=true;destinations.innerHTML='<p class="hint">¿Cuál de estos artículos se ha acabado en casa?</p>'+targets.map(x=>`<label class="finished-pantry-option"><input type="radio" name="finishedPantryTarget" value="${esc(x.id)}"><span><b>${esc(x.name)}</b><small>${esc(x.loc||'Despensa')}</small></span></label>`).join('')}
  };
  const draw=(keep=false)=>{
    const q=finishedPantryQuery(input.value),invalid=finishedPantryBatch(q),matches=finishedPantryMatches(q),catalog=invalid?[]:finishedCatalogMatches(q),exact=matches.filter(x=>norm(x.name)===norm(q)),home=exact.length===1?exact[0]:matches.length===1?matches[0]:null;
    const choices=new Set([...matches.map(x=>x.id),...catalog.map(p=>'mc:'+p.id),...(!matches.length?['new']:[])]);
    selected=keep&&choices.has(selected)?selected:home&&(home.mid||!catalog.length)?home.id:!matches.length&&!catalog.length&&!loading?'new':'';
    status.textContent='';button.disabled=!q||invalid||!selected;
    hint.textContent=!q?'':invalid?'Escribe un producto cada vez.':loading?'Cargando el catálogo de Mercadona…':catalog.length?'Elige la referencia para añadirla con su foto.':matches.length?'Elige lo que se ha acabado en casa.':'No encuentro coincidencias. Puedes añadirlo por su nombre, sin foto: '+q;
    const photo=(path,label)=>path?`<img class="finished-pantry-photo" src="${esc(imgUrl(path,96))}" alt="" title="${esc(label)}" loading="eager">`:'';
    box.innerHTML=!q||invalid?'':(matches.length?'<h4>En casa</h4>'+matches.slice(0,8).map(x=>{const img=pantryPhoto(x);return `<label class="finished-pantry-option"><input type="radio" name="finishedPantryChoice" value="${esc(x.id)}" ${selected===x.id?'checked':''}>${photo(img?.path,x.name)}<span><b>${esc(x.name)}</b><small>${esc(x.loc||'Despensa')} · ${x.n>0?'En casa':'Agotado'}${x.mid?'':' · Sin referencia de Mercadona'}</small></span></label>`}).join(''):'')+(catalog.length?'<h4>Mercadona · con foto</h4>'+catalog.map(p=>`<label class="finished-pantry-option"><input type="radio" name="finishedPantryChoice" value="mc:${esc(p.id)}" ${selected==='mc:'+p.id?'checked':''}>${photo(p.img,p.name)}<span><b>${esc(p.name)}</b><small>${esc([p.pack,prodSize(p)].filter(Boolean).join(' · '))} · ${eur(p.price)}</small></span></label>`).join(''):'')+(!matches.length?`<label class="finished-pantry-option"><input type="radio" name="finishedPantryChoice" value="new" ${selected==='new'?'checked':''}><span>Añadir solo el nombre: <b>${esc(q)}</b><small>Sin foto de Mercadona</small></span></label>`:'');
    box.setAttribute('aria-busy','false');
    if(q&&!invalid&&selected)choose();
  };
  const submit=()=>{
    clearTimeout(timer);const q=finishedPantryQuery(input.value),matches=finishedPantryMatches(q);
    if(!q||!selected){status.textContent='Escribe o elige el producto que se ha acabado.';return}
    if(finishedPantryBatch(q)){status.textContent='Escribe un producto cada vez.';return}
    let product;
    if(selected.startsWith('mc:')){
      product=finishedCatalogMatches(q).find(p=>'mc:'+p.id===selected);if(!product){draw();status.textContent='La referencia ha cambiado. Vuelve a elegirla.';return}
      const targets=finishedProductTargets(product,q);if((targets.length>1&&!targets.some(x=>x.id===target))||(target&&!targets.some(x=>x.id===target))){choose();status.textContent='Elige qué artículo se ha acabado en casa.';return}
    }else if((selected==='new'&&matches.length)||(selected!=='new'&&!matches.some(x=>x.id===selected))){draw();status.textContent='La información ha cambiado. Elige de nuevo el producto.';return}
    try{const result=markPantryFinished(product?target:selected==='new'?'':selected,q,product);save();input.value='';draw();status.textContent=(result.matched?result.name+': marcado como agotado. ':result.name+': ')+(result.added?'Añadido a Compras.':'Ya estaba en la lista de la compra.');input.focus();toastUndo(result.name+' · '+(result.added?'añadido a Compras':'ya estaba en Compras'))}
    catch(e){status.textContent=e.message||'No se ha podido apuntar el producto.'}
  };
  const edit=()=>{clearTimeout(timer);selected='';target='';button.disabled=true;destinations.innerHTML='';box.setAttribute('aria-busy','true');timer=setTimeout(()=>{timer=null;draw()},150)};
  input.addEventListener('input',e=>{if(!e.isComposing)edit()});input.addEventListener('compositionstart',()=>{clearTimeout(timer);timer=null;selected='';button.disabled=true});input.addEventListener('compositionend',edit);
  input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();if(timer){clearTimeout(timer);timer=null;draw()}submit()}});
  box.addEventListener('change',e=>{if(e.target.name!=='finishedPantryChoice')return;selected=e.target.value;choose()});
  destinations.addEventListener('change',e=>{if(e.target.name==='finishedPantryTarget'){target=e.target.value;button.disabled=false}});
  box.addEventListener('error',e=>{if(e.target.matches?.('.finished-pantry-photo'))e.target.hidden=true},true);
  if(!MC)loadMC().then(()=>{loading=false;if(ov.isConnected)draw(true)});
  draw();return ov;
}
function pantryItem(x,lid){
  const p=x.mid&&MC&&MC.byId.get(x.mid)?prod(MC.byId.get(x.mid)):matchProduct(x.name);
  return{id:uid(),listId:lid,name:x.name,qty:p?'1 × '+prodSize(p):'',section:ckSection(p,x.name),by:'Despensa',done:false,auto:true,price:p?p.price:0,mid:p?p.id:'',store:p&&p.user?p.store:'',pq:p?{n:p.size,d:p.d}:null};
}
function ckSection(p,name){
  const k=norm(name);if(S.secMem[k])return S.secMem[k];
  const c=p&&p.cat||'';
  if(/Fruta y verdura/.test(c))return'Fruta y verdura';
  if(/Congelados/.test(c))return'Congelados';
  if(/Carne|Marisco|Charcuter|Huevos|Postres|Panader/.test(c))return'Frescos';
  if(/Limpieza/.test(c))return'Limpieza';
  if(/Cuidado|Maquillaje|Fitoterapia/.test(c))return'Higiene';
  return S.sections.includes('Despensa')?'Despensa':'Otros';
}

/* ---------- recetas: vetos y electrodomésticos ---------- */
function vetoed(r,vetoes){
  const all=[r.name,...r.ingredients.map(g=>g.name)].map(words);
  return vetoes.some(v=>{const vw=words(v);return vw.length&&all.some(w=>allIn(vw,w))});
}
function applOk(r,mine){return(r.appl||[]).every(a=>mine.includes(a)||(CK_ALT[a]||[]).some(b=>mine.includes(b)))}
function lastMade(r){const a=r.made||[];return a.length?a[a.length-1]:''}

/* ---------- cesta (lista «Súper» de Compras) ---------- */
const cartList=()=>(S.lists.find(l=>l.id==='super')||S.lists[0]).id;
const cartItems=()=>S.items.filter(i=>i.listId===cartList()&&!i.done);
const cartOf=mid=>cartItems().find(i=>i.mid===mid);
const cartTotal=()=>cartItems().reduce((a,i)=>a+(i.price||0),0);
function cartSet(p,units,lid){
  const L=lid||cartList();let i=S.items.find(x=>x.listId===L&&!x.done&&x.mid===p.id);
  if(units<=0){if(i)S.items=S.items.filter(x=>x.id!==i.id);return}
  if(!i){i={id:uid(),listId:L,name:p.name,section:ckSection(p,p.name),by:'',done:false,mid:p.id,added:Date.now()};S.items.push(i);usual(p.id)}
  setUnits(i,units);
}
// Cambia las unidades de una línea y recalcula su precio estimado
function setUnits(i,units){
  const p=i.mid&&MC&&MC.byId.get(i.mid);i.units=units;
  if(p){const q=prod(p);Object.assign(i,{qty:units+' × '+prodSize(q),price:Math.round(q.price*units*100)/100,pq:{n:q.size*units,d:q.d}})}
  else if(i.uprice||i.price){if(!i.uprice)i.uprice=i.price;i.price=Math.round(i.uprice*units*100)/100}
}
// Los favoritos existentes pertenecen a Súper. Cada otra lista guarda su propio
// campo en cook, que se sincroniza por claves sin sustituir las demás listas.
const favStorageKey=lid=>lid===cartList()?'fav':'favList:'+lid;
const favKeys=(lid=curList().id)=>{const keys=ck()[favStorageKey(lid)];return Array.isArray(keys)?keys.map(String):[]};
const isFav=(k,lid=curList().id)=>favKeys(lid).includes(String(k));
function toggleFav(k,lid=curList().id){k=String(k);const f=favKeys(lid);if(!f.includes(k))rememberHabit(k);ckSet(favStorageKey(lid),f.includes(k)?f.filter(x=>x!==k):[k,...f])}
function rememberHabit(key){
  const p=MC?.byId.get(String(key));if(!p)return;
  S.cook={...S.cook,['favInfo:'+key]:{name:p[1],img:p[9]||'',pack:p[2]||''}};
}
function habitInfo(key){
  key=String(key);const manual=key.startsWith('n:'),p=!manual&&MC?.byId.get(key),saved=S.cook?.['favInfo:'+key],old=MC?.retired?.[key];
  const records=[...(S.items||[]),...(S.pantry||[]),...(S.staples||[]),...(S.buys||[]).flatMap(b=>b.items||[])];
  const record=records.find(x=>x&&String(x.mid)===key&&typeof x.name==='string'&&/[^\d\s]/.test(x.name));
  const name=[manual?key.slice(2):'',p?.[1],saved?.name,old?.name,record?.name].find(n=>typeof n==='string'&&n.trim()&&/[^\d\s]/.test(n))||'';
  const img=[p?.[9],saved?.img,old?.img].find(i=>typeof i==='string'&&/^[a-z0-9_/-]+\.(jpe?g|png|webp)$/i.test(i))||'';
  return {key,p,name:name||(!MC&&!manual?'Cargando producto…':'Producto por identificar'),known:!!name,img,manual};
}
// Productos que sueles comprar o tener (para «Habituales»)
function usual(mid){const u=(ck().usual||[]).filter(x=>x!==mid);u.unshift(mid);S.cook=Object.assign({},S.cook,{usual:u.slice(0,150)})}

/* ---------- despensa desde un producto ---------- */
function defLoc(p){
  const c=p.cat||'',n=norm(p.name);
  if(/Congelados/.test(c)||/ultracongelad|helado/.test(n))return'Congelador';
  if(/Carne|Marisco|Charcuter|Postres|Fruta y verdura|Pizzas/.test(c)||/yogur|mantequilla|nata|queso fresco/.test(n))return'Nevera';
  return'Despensa';
}
const pantryOf=mid=>(S.pantry||[]).find(x=>x.mid===mid);
function pantryAddProd(p,packs){
  let x=pantryOf(p.id);
  if(!x){x={id:uid(),name:p.name,n:0,u:p.d==='ud'?'ud':p.fmt==='l'?'ml':'g',min:0,loc:defLoc(p),mid:p.id,auto:false};S.pantry=[...(S.pantry||[]),x]}
  const perPack=x.u==='ud'&&p.d!=='ud'?1:p.size;
  x.n=Math.round((x.n+perPack*(packs||1))*10)/10;x.full=Math.max(x.full||0,x.n,perPack);x.at=today();usual(p.id);
  return x;
}
// Conserva la referencia del envase al marcar un producto como agotado.
const pantryFull=x=>{const p=x.mid&&MC&&MC.byId.get(x.mid);return Math.max(x.full||0,x.n,p?prod(p).size:0,x.min*2||0,x.u==='ud'?1:100)};

/* ---------- vistas ---------- */
const CK_CATEMO={'Aceite, especias y salsas':'🫒','Agua y refrescos':'🥤','Aperitivos':'🥨','Arroz, legumbres y pasta':'🍝','Azúcar, caramelos y chocolate':'🍫','Bebé':'🍼','Bodega':'🍷','Cacao, café e infusiones':'☕','Carne':'🥩','Cereales y galletas':'🥣','Charcutería y quesos':'🧀','Congelados':'🧊','Conservas, caldos y cremas':'🥫','Cuidado del cabello':'💇','Cuidado facial y corporal':'🧴','Fitoterapia y parafarmacia':'🌿','Fruta y verdura':'🥦','Huevos, leche y mantequilla':'🥚','Limpieza y hogar':'🧽','Maquillaje':'💄','Marisco y pescado':'🐟','Mascotas':'🐾','Panadería y pastelería':'🥖','Pizzas y platos preparados':'🍕','Postres y yogures':'🍮','Zumos':'🧃'};
function vCocina(){
  loadMC();
  let tab=ui.ckTab||'productos';if(tab==='menu'||tab==='lista'||tab==='recetas')tab='productos';
  const low=(S.pantry||[]).filter(pantryLow).length,ci=cartItems();
  const sub={novedades:'Lo nuevo de Mercadona en tu código postal',productos:'Elige qué va a la cesta y qué tienes en casa',despensa:'Tus productos de un vistazo',ajustes:'Presupuesto y supermercados'}[tab];
  let h=`<h1>${tab==='despensa'?'En casa':'Compras'}</h1><p class="sub">${sub}</p>${tab==='despensa'?'':heroStats([[ci.length,'en la cesta'],[eur0(cartTotal()),'cesta'],[(S.pantry||[]).filter(x=>x.n>0).length,'en casa'],[low,'por reponer']])}`;
  h+=ckSubTabs();
  h+=({novedades:vCkNovedades,productos:vCkProductos,despensa:vCkDespensa,ajustes:vCkAjustes}[tab]||vCkProductos)();
  return h+cartBar();
}
// Pestañas dentro de Compras
function ckSubTabs(){
  const tab=ui.ckTab||'lista';
  return`<div class="chips ck-tabs">${[['lista','📝 Lista'],['productos','🛍️ Productos'],['novedades','🆕 Novedades'],['despensa','🏠 En casa'],['ajustes','⚙️ Ajustes']].map(([k,l])=>{const n=k==='novedades'?novUnseen():0;return`<button class="chip ${tab===k?'on':''}" data-act="ckTab" data-v="${k}"><span class="ck-tab-icon" aria-hidden="true">${l.split(' ')[0]}</span><span>${l.split(' ').slice(1).join(' ')}</span>${n?` <span class="ck-n">${n}</span>`:''}</button>`}).join('')}</div>`;
}
function cartBar(){
  const ci=cartItems(),t=cartTotal();
  return`<div class="ck-cartbar"><button data-act="ckTab" data-v="lista"><span class="ck-cb-ic">🛒<b>${ci.length}</b></span><span class="ck-cb-t"><small>Cesta (estimación)</small><b>≈ ${eur(t)}</b></span><span class="ck-cb-go">Lista ›</span></button></div>`;
}
// Tarjeta de producto, como en la app de Mercadona
function prodCard(p){
  const ic=cartOf(p.id),u=ic?ic.units||1:0,x=pantryOf(p.id),prev=mcFresh()?MC.byId.get(p.id)[11]:0,fv=isFav(p.id,cartList());
  return`<div class="ck-card ${u?'in':''}">${prev?`<span class="ck-offer">Bajada</span>`:isNew(p.id)?`<span class="ck-offer ck-new">Nuevo</span>`:''}<button class="ck-fav ${fv?'on':''}" data-act="favToggle" data-id="${p.id}" aria-label="${fv?'Quitar de habituales':'Marcar como habitual'}">${fv?'★':'☆'}</button>
    <div class="ck-ci">${fv?`<button class="link" style="width:100%;height:100%" data-act="habitSchedule" data-v="${p.id}" data-lid="${esc(cartList())}" aria-label="Ver habitual ${esc(p.name)}">`:''}${p.img?`<img src="https://prod-mercadona.imgix.net/images/${p.img}?fit=contain&h=480&w=480" alt="" loading="eager">`:''}${fv?'</button>':''}</div>
    <div class="ck-cp">${prev?`<s>${eur(prev)}</s> `:''}<b class="${prev?'red':''}">${eur(p.price)}</b><small>/${p.d==='ud'&&p.size>1?'pack':'ud'}</small></div>
    <div class="ck-cn">${esc(p.name)}</div><small class="ck-cs">${esc(p.pack)} ${prodSize(p)}${p.ref?' · '+eur(p.ref)+'/'+esc(p.refFmt):''}</small>
    ${x?`<small class="ck-home">🏠 En casa: ${x.n>0?fmtAmt(x.n,x.u):'agotado'}</small>`:''}
    <div class="ck-ca">${u?`<button class="ck-st" data-act="cartStep" data-id="${p.id}" data-v="-1" aria-label="Quitar uno">${u>1?'−':'🗑'}</button><b class="ck-u">${u}</b><button class="ck-st plus" data-act="cartStep" data-id="${p.id}" data-v="1" aria-label="Añadir otro">+</button>`
      :`<button class="ck-add" data-act="cartStep" data-id="${p.id}" data-v="1">🛒 Cesta</button>`}<button class="ck-home-b" data-act="homeAdd" data-id="${p.id}" aria-label="Lo tengo en casa" title="Lo tengo en casa">🏠+</button></div></div>`;
}
const CK_HIDECAT=/Mascotas|Maquillaje|Bebé/;
// Novedades: lo que Mercadona marca como nuevo en el almacén de nuestro código postal
const isNew=id=>{const p=MC&&MC.byId.get(id);return!!(p&&p[13])};
const novIds=()=>MC?MC.p.filter(p=>p[13]).sort((a,b)=>String(MC.newSince?.[b[0]]||'').localeCompare(String(MC.newSince?.[a[0]]||''))||a[1].localeCompare(b[1],'es')||String(a[0]).localeCompare(String(b[0]))).map(p=>p[0]):[];
// Cuántas novedades no se han visto aún en este móvil
function novUnseen(){if(!MC)return 0;const seen=new Set(ui.novSeen||[]);return novIds().filter(id=>!seen.has(id)).length}
function vCkNovedades(){
  if(!MC)return`<p class="hint" style="margin-top:14px">Cargando productos de Mercadona…</p>`;
  const ids=novIds(),seen=new Set(ui.novSeen||[]),fresh=ids.filter(id=>!seen.has(id));
  if(fresh.length)setTimeout(()=>{ui.novSeen=ids;try{localStorage.setItem(LS+'-ui',JSON.stringify(ui))}catch(e){}},0);
  let h=mcNotice()+`<p class="hint ck-help">Productos que Mercadona marca como <b>novedad</b> en su tienda online para el CP ${esc(MC.cp||'18210')}, a fecha de ${mcDate()}. Las detectadas más recientemente aparecen primero.${fresh.length&&seen.size?` Hay <b>${fresh.length}</b> nueva${fresh.length>1?'s':''} desde la última vez.`:''}</p>`;
  if(!ids.length)return h+`<div class="empty" style="margin-top:12px">Ahora mismo Mercadona no marca ninguna novedad.</div>`;
  const cats=[...new Set(ids.map(id=>MC.byId.get(id)[8]))].sort((a,b)=>a-b),cat=ui.novCat!=null&&cats.includes(ui.novCat)?ui.novCat:null;
  h+=`<div class="chips ck-subs"><button class="chip ${cat==null?'on':''}" data-act="novCat" data-v="">Todo · ${ids.length}</button>${cats.map(c=>`<button class="chip ${cat===c?'on':''}" data-act="novCat" data-v="${c}">${CK_CATEMO[MC.cats[c]]||''} ${esc(MC.cats[c])}</button>`).join('')}</div>`;
  const a=ids.filter(id=>cat==null||MC.byId.get(id)[8]===cat).map(id=>prod(MC.byId.get(id)));
  return h+`<div class="ck-grid" style="margin-top:10px">${a.map(prodCard).join('')}</div>`;
}

function vCkProductos(){
  const html=productSearchHTML(),end=html.indexOf('</div>');
  return html.includes('id="qProd"')?html.slice(0,end+6)+'<div id="ckProductResults">'+html.slice(end+6)+'</div>':html;
}
function updateProductSearch(){
  const field=$('#qProd'),results=$('#ckProductResults');if(!field||!results)return;
  const next=document.createElement('template');next.innerHTML=vCkProductos();
  const content=next.content.querySelector('#ckProductResults');if(!content)return;
  results.replaceChildren(...content.childNodes);
  const clear=document.querySelector('[data-act="prodClear"]');if(clear)clear.hidden=!field.value;
}
function scheduleProductSearch(e){
  ui.prodQ=e.target.value;ui.prodN=40;clearTimeout(ui._pt);
  if(e.isComposing)return;
  ui._pt=setTimeout(updateProductSearch,300);
}
function productSearchHTML(){
  if(!MC)return`<p class="hint" style="margin-top:14px">Cargando productos de Mercadona…</p>`;
  const q=ui.prodQ||'',cat=ui.prodCat||'hab',sub=ui.prodSub;
  let a,title='',h='';
  h+=`<div class="ck-search"><input class="field" id="qProd" type="search" placeholder="🔍 Buscar en Mercadona (leche, pollo, tomate…)" value="${esc(q)}" autocomplete="off" enterkeyhint="search"><button class="ck-ib" data-act="prodClear" aria-label="Borrar búsqueda" ${q?'':'hidden'}>✕</button></div>`;
  h+=mcNotice();
  if(q.trim()){
    const sug=suggestTerms(q);
    if(sug.length)h+=`<div class="chips ck-sug">${sug.map(x=>`<button class="chip" data-act="prodQ" data-v="${esc(x)}">🔍 ${esc(x)}</button>`).join('')}</div>`;
    a=searchProducts(q,120);title=a.length+' resultado'+(a.length===1?'':'s');
    if(!a.length){
      const dy=didYouMean(q),alt=searchProducts(q,24,1);
      h+=`<div class="empty" style="margin-top:12px">No hay productos con «${esc(q)}».${dy?`<br><br>¿Querías decir <button class="link" data-act="prodQ" data-v="${esc(dy)}">${esc(dy)}</button>?`:''}</div>`;
      if(alt.length)h+=`<h2>Productos parecidos</h2><div class="ck-grid">${alt.map(prodCard).join('')}</div>`;
      return h;
    }
  }else{
    h+=`<div class="chips ck-cats">${[['hab','⭐ Habituales'],['bajadas','🏷️ Bajadas de precio'],...MC.cats.filter(c=>!CK_HIDECAT.test(c)).map(c=>[c,(CK_CATEMO[c]||'')+' '+c]),['higiene','🪥 Higiene']].map(([k,l])=>`<button class="chip ${cat===k?'on':''}" data-act="prodCat" data-v="${esc(k)}">${esc(l)}</button>`).join('')}</div>`;
    if(cat==='hab'){
      const fv=favKeys(cartList()).filter(k=>MC.byId.has(k)),rec=[...new Set([...cartItems().map(i=>i.mid),...(ck().usual||[]),...(S.pantry||[]).map(x=>x.mid)].filter(id=>id&&MC.byId.has(id)&&!fv.includes(id)))];
      if(fv.length)h+=`<h2>⭐ Tus habituales</h2><div class="ck-grid">${fv.map(id=>prodCard(prod(MC.byId.get(id)))).join('')}</div>`;
      else h+=`<p class="hint ck-help">Marca con <b>☆</b> los productos que compras siempre y los tendrás aquí y en la lista de Compras.</p>`;
      a=rec.map(id=>prod(MC.byId.get(id)));title=a.length?'Recientes y en casa':'';
      if(!fv.length&&!a.length)return h+`<div class="empty" style="margin-top:12px">Busca arriba o elige una sección para empezar.</div>`;
    }else if(cat==='higiene'){
      a=MC.p.filter(p=>/Cuidado|Fitoterapia|Maquillaje/.test(MC.cats[p[8]]||'')).map(prod);title='Higiene y cuidado personal';
    }else if(cat==='bajadas'){
      if(!mcFresh())return h+`<div class="empty" style="margin-top:12px">Los precios son del ${mcDate()}. No muestro bajadas de precio con datos de días anteriores porque podrían no estar vigentes.</div>`;
      a=MC.p.filter(p=>p[11]).map(prod);title='Bajadas de precio en tu código postal';
      h+=`<p class="hint">Mercadona no tiene ofertas ni promociones: estos son los productos que su tienda online muestra con el precio anterior tachado (bajadas de precio) a fecha de ${mcDate()}.</p>`;
    }else{
      const ci=MC.cats.indexOf(cat),subs=MC.subs.map((x,i)=>[i,x]).filter(([,x])=>x[0]===ci);
      if(subs.length>1)h+=`<div class="chips ck-subs"><button class="chip ${sub==null?'on':''}" data-act="prodSub" data-v="">Todo</button>${subs.map(([i,x])=>`<button class="chip ${sub===i?'on':''}" data-act="prodSub" data-v="${i}">${esc(x[1])}</button>`).join('')}</div>`;
      a=MC.p.filter(p=>sub!=null?(p[12]||[]).includes(sub):p[8]===ci||(p[12]||[]).some(s2=>MC.subs[s2]&&MC.subs[s2][0]===ci)).map(prod);
    }
  }
  h+=`<p class="hint ck-help">🛒 a la lista de Compras · 🏠+ ya lo tengo en casa · ☆ habitual</p>`;
  if(title)h+=`<h2>${esc(title)}</h2>`;
  if(!a.length)return h+`<div class="empty" style="margin-top:12px">Nada por aquí.</div>`;
  const n=ui.prodN||40;
  h+=`<div class="ck-grid">${a.slice(0,n).map(prodCard).join('')}</div>`;
  if(a.length>n)h+=`<button class="btn sec" style="width:100%;margin-top:12px" data-act="prodMore">Ver más (${a.length-n})</button>`;
  return h;
}
// Fecha y vigencia de los precios
const mcAgeH=()=>MC&&MC.at?(Date.now()-Date.parse(MC.at.length>10?MC.at+'Z':MC.at+'T05:00Z'))/36e5:999;
const mcFresh=()=>mcAgeH()<36;
const mcDate=()=>MC&&MC.at?new Date(Date.parse(MC.at.length>10?MC.at+'Z':MC.at+'T05:00Z')).toLocaleDateString('es-ES',{day:'numeric',month:'long'}):'';
function mcNotice(){
  if(!MC)return'';
  if(!mcFresh())return`<div class="ck-warn">⚠️ Precios del ${mcDate()}: pueden haber cambiado. Se actualizan solos cada mañana.</div>`;
  return'';
}

// Clasificación para mostrar el inventario; no cambia los productos guardados.
function pantryCategory(x){
  const key=norm(x.name),mapped=(S.prodMap||{})[key];
  const p=MC&&(MC.byId.get(x.mid)||MC.byId.get(mapped));
  if(p&&MC.cats[p[8]])return MC.cats[p[8]];
  const saved=x.section||(S.secMem||{})[key];if(saved)return saved;
  const query=words(CK_ALIAS[key]||x.name);
  const candidate=query.length&&searchMC(x.name,8).find(p=>p.s>0&&allIn(query,words(p.name)));
  return candidate&&candidate.cat||'Otros';
}

function vCkDespensa(){
  const f=ui.panF||'todo',all=S.pantry||[];
  let a=all.slice();
  if(f==='low')a=a.filter(pantryLow);else if(f!=='todo')a=a.filter(x=>(x.loc||'Despensa')===f);
  let h=`<button class="btn sec" data-act="pantryFinished" style="width:100%;margin-top:12px">🛒 ¿Qué se ha acabado?</button><div class="ck-actions" style="margin-top:12px"><button class="btn" data-act="aiPhoto">📸 Foto de la nevera o despensa</button></div>
  <div class="ck-actions" style="margin-top:8px"><button class="btn sec" data-act="ckTab" data-v="productos">+ Añadir productos</button><button class="btn sec" data-act="ckTicket">🧾 Subir tique</button></div>
  <div class="chips" style="margin-top:10px">${[['todo','Todo'],['low','🛒 Agotados'],['Despensa','🥫 Despensa'],['Nevera','❄️ Nevera'],['Congelador','🧊 Congelador']].map(([k,l])=>`<button class="chip ${f===k?'on':''}" data-act="panF" data-v="${k}">${l}</button>`).join('')}</div>
  <p class="hint">Toca la foto o el nombre para ver los detalles y la última compra.</p>`;
  if(!all.length)return h+`<div class="empty" style="margin-top:14px">Aún no hay nada. Haz una <b>📸 foto</b> de la nevera o la despensa, pulsa <b>🏠+</b> en <b>Productos</b> o sube un tique.<br><br><button class="btn sec" data-act="ckSeedPan">Empezar con los básicos</button></div>`;
  if(!a.length)return h+`<div class="empty" style="margin-top:14px">Nada por aquí.</div>`;
  const groups=new Map();
  a.forEach(x=>{const cat=pantryCategory(x);if(!groups.has(cat))groups.set(cat,[]);groups.get(cat).push(x)});
  [...groups.keys()].sort((a,b)=>(a==='Otros')-(b==='Otros')||a.localeCompare(b,'es')).forEach(cat=>{
    const b=groups.get(cat).sort((x,y)=>x.name.localeCompare(y.name,'es'));
    h+=`<h2>${CK_CATEMO[cat]||'📦'} ${esc(cat)}</h2><div class="pantry-grid">`+b.map(panRow).join('')+`</div>`;
  });
  return h;
}
// Foto orientativa para artículos genéricos; no vincula ni cambia sus datos.
function pantryPhoto(x){
  const saved=x.mid&&habitInfo(x.mid);if(saved?.img)return{path:saved.img,label:x.name};
  if(!MC)return null;
  const exact=x.mid&&MC.byId.get(x.mid);if(exact&&exact[9])return{path:exact[9],label:x.name};
  const mapped=(S.prodMap||{})[norm(x.name)],selected=mapped&&MC.byId.get(mapped);
  if(selected&&selected[9])return{path:selected[9],label:selected[1]};
  const query=words(CK_ALIAS[norm(x.name)]||x.name);
  if(!query.length)return null;
  const candidate=searchMC(x.name,8).find(p=>p.img&&p.s>0&&allIn(query,words(p.name)));
  return candidate?{path:candidate.img,label:'Imagen orientativa: '+candidate.name}:null;
}
const pantryPhotoFailures=new Set();
function pantryImage(x,size,photo=pantryPhoto(x)){
  const icon=CK_CATEMO[pantryCategory(x)]||'🥫';
  return`${photo?`<img data-pantry-img data-pantry-path="${esc(photo.path)}" src="${esc(imgUrl(photo.path,size))}" alt="" title="${esc(photo.label)}" loading="eager">`:''}<span class="pantry-icon" ${photo?'hidden':''} aria-hidden="true">${icon}</span>`;
}
function panRow(x){
  const empty=pantryLow(x),inShopping=pantryShoppingItem(x,cartList()),candidate=pantryPhoto(x),photo=candidate&&!pantryPhotoFailures.has(candidate.path)?candidate:null;
  return`<article class="pantry-card ${empty?'is-empty':''} ${photo?'':'is-text'}" data-pantry-card="${esc(x.id)}"><button type="button" class="pantry-picture" data-act="ckPan" data-id="${esc(x.id)}" title="${esc(x.name)}" aria-label="Ver ${esc(x.name)}${empty?' · agotado':''}">${pantryImage(x,160,photo)}<span class="pantry-name" ${photo?'hidden':''}>${esc(x.name)}</span></button><div class="pantry-card-actions"><button type="button" class="ck-ib" data-act="panRemove" data-id="${esc(x.id)}" aria-label="Eliminar ${esc(x.name)} de la despensa">🗑️</button><button type="button" class="pantry-finish" data-act="panFinished" data-id="${esc(x.id)}" aria-label="Se ha acabado ${esc(x.name)}" title="Se ha acabado: añadir a Compras" ${empty&&inShopping?'disabled':''}><span aria-hidden="true">🛒</span></button></div></article>`;
}
function pantryLastPurchase(x){
  const matches=i=>(x.id&&i.inventoryId===x.id)||(x.mid&&i.mid?String(i.mid)===String(x.mid):norm(i.name||'')===norm(x.name));
  return(S.buys||[]).filter(b=>!b.voided&&CasaReceipts.validDate(b.date)&&((b.items||[]).some(matches)||(b.pendingInventory||[]).some(p=>p.pantryId===x.id)))
    .sort((a,b)=>b.date.localeCompare(a.date)||(Number(b.at)||0)-(Number(a.at)||0))[0]||null;
}
// Evidence for photo association comes from recorded purchases, never cart estimates.
function purchaseNameScore(requested,actual){
  const measure=s=>{const m=String(s||'').match(/\b(\d+(?:[.,]\d+)?)\s*(kg|gr|g|ml|cl|l)\b/i);if(!m)return null;const u=m[2].toLowerCase();return {kind:/^(kg|g|gr)$/.test(u)?'mass':'volume',n:Number(m[1].replace(',','.'))*(/^(kg|l)$/.test(u)?1000:u==='cl'?10:1)}};
  const ma=measure(requested),mb=measure(actual);if(ma&&mb&&(ma.kind!==mb.kind||Math.abs(ma.n-mb.n)>.01))return 0;
  const clean=s=>CasaReceipts.norm(String(s||'').replace(/\b\d+(?:[.,]\d+)?\s*(kg|gr|g|ml|cl|l)\b/gi,' ')).replace(/(\d)([a-z])/g,'$1 $2').replace(/\b(hacendado|deliplus|bosque verde)\b/g,'').trim();
  const stop=new Set(['de','del','la','el','los','las','en','con','y','para','al','a','un','una','o','bipack','pack','paquete','botella','brick','bote']);
  const tokens=s=>{const words=clean(s).split(/\s+/).filter(w=>w&&!stop.has(w));return words.some(w=>w==='caf'||w==='cafe')?words.map(w=>({caf:'cafe',mol:'molido',nat:'natural'}[w]||w)):words},a=tokens(requested),b=tokens(actual);
  if(!a.some(w=>/[a-z]/.test(w))||!b.length)return 0;
  const rawA=CasaReceipts.norm(requested),rawB=CasaReceipts.norm(actual);
  const attribute=w=>w.startsWith('azucar')?'azucar(?:es)?':w;
  for(const m of rawA.matchAll(/\bsin\s+(lactosa|gluten|azucar(?:es)?|sal|alcohol|cafeina)\b/g))if(!new RegExp('\\bsin\\s+'+attribute(m[1])+'\\b').test(rawB))return 0;
  for(const m of rawA.matchAll(/\bcon\s+(lactosa|gluten|azucar(?:es)?|sal|alcohol|cafeina)\b/g))if(new RegExp('\\bsin\\s+'+attribute(m[1])+'\\b').test(rawB))return 0;
  const milk=s=>/\bsemi\s*desnatad[oa]/.test(s)?'semi':/\bdesnatad[oa]/.test(s)?'skim':/\benter[oa]/.test(s)?'whole':'';
  if(milk(rawA)&&milk(rawA)!==milk(rawB))return 0;
  for(const w of ['natural','mezcla','torrefacto','descafeinado','integral','molido','grano','soluble'])if(a.includes(w)&&!b.some(t=>same(w,t)))return 0;
  const hit=(w,t)=>same(w,t)||(w.length>=4&&w!=='cafe'&&t.startsWith(w));
  if(a.filter(w=>/^\d+$/.test(w)).some(w=>!b.includes(w)))return 0;
  if(!b.some(w=>hit(a[0],w)))return 0;
  const hits=a.filter(w=>b.some(t=>hit(w,t))).length,coverage=hits/a.length;
  if(coverage<.8)return 0;
  const score=coverage-Math.max(0,b.length-a.length)*.015;
  return a.length===1&&b.length>1?Math.min(.7,score):score;
}
function purchaseLinePrice(line){
  const total=Number(line.price),unit=Number(line.unitPrice);
  if(!(total>0)||!Number.isFinite(total))return null;
  const weightText=String(line.qty||'').match(/^\s*(\d+(?:[.,]\d+)?)\s*kg\s*$/i),weighted=Object.hasOwn(line,'kg')||!!weightText,qty=Number(weighted?(Object.hasOwn(line,'kg')?line.kg:weightText[1].replace(',','.')):line.units),basis=weighted?'kg':'ud';
  if(!(qty>0)||!Number.isFinite(qty))return !weighted&&line.units===undefined&&unit>0&&Number.isFinite(unit)?{price:unit,basis}:null;
  if(line.unitPrice!==undefined){if(!(unit>0)||!Number.isFinite(unit)||Math.abs(CasaReceipts.cents(unit*qty)-CasaReceipts.cents(total))>1)return null;return {price:unit,basis}}
  return {price:total/qty,basis};
}
function pantryPriceHistory(x){
  const out=[];
  for(const buy of (S.buys||[]).filter(b=>!b.voided&&CasaReceipts.norm(b.store)==='mercadona'&&CasaReceipts.validDate(b.date)).sort((a,b)=>b.date.localeCompare(a.date)||(Number(b.at)||0)-(Number(a.at)||0))){
    for(const line of buy.items||[]){
      const price=purchaseLinePrice(line);if(!price)continue;
      if(x.mid&&line.mid&&String(x.mid)!==String(line.mid))continue;
      const alias=S.cook?.receiptAliases?.['mercadona|'+CasaReceipts.norm(line.name)],known=line.mid&&MC?.byId.get(String(line.mid));
      const names=[line.name,alias?.name,known?.[1]].filter(n=>typeof n==='string'&&n.trim());
      const linked=(x.id&&line.inventoryId===x.id)||!!(x.mid&&String(line.mid)===String(x.mid))||(buy.pendingInventory||[]).some(p=>p.pantryId===x.id&&((p.mid&&String(p.mid)===String(line.mid))||norm(p.name||'')===norm(line.name||'')));
      if(!linked&&!names.some(n=>purchaseNameScore(x.name,n)>=.65))continue;
      const id=String(line.mid||''),key=(id||norm(names[0]))+'|'+price.basis+'|'+CasaReceipts.cents(price.price);
      if(!out.some(h=>h.key===key))out.push({...price,key,mid:id,names,date:buy.date,store:buy.store,linked});
    }
  }
  return out.slice(0,12);
}
function pantryProductMatches(x){
  const history=pantryPriceHistory(x),pool=new Map();if(!MC||!history.length)return {history,matches:[]};
  const searches=new Map(),search=q=>{const key=norm(q);if(!searches.has(key))searches.set(key,searchProducts(q,120));return searches.get(key)};
  const add=p=>{if(p?.img&&p.price>0)pool.set(p.id,p)};
  for(const h of history){
    if(h.mid){add(prod(MC.byId.get(h.mid)));continue}
    for(const name of new Set([x.name,...h.names])){
      let results=search(name);
      if(!results.length){const tokens=qWords(name);results=search(tokens.slice(0,2).join(' '));if(!results.length)results=search(tokens[0]||'')}
      results.forEach(add);
    }
  }
  const matches=[];
  for(const p of pool.values()){
    let best=null;
    for(const h of history){
      if(h.mid&&h.mid!==p.id)continue;
      const identified=h.mid===p.id,nameScore=Math.max(...[x.name,...h.names].map(n=>purchaseNameScore(n,p.name+' '+p.pack+' '+prodSize(p))));
      if(!identified&&nameScore<.65)continue;
      const current=h.basis==='kg'?(p.refFmt==='kg'?p.ref:NaN):p.price;
      if(!(current>0)||!Number.isFinite(current))continue;
      const equal=CasaReceipts.cents(current)===CasaReceipts.cents(h.price);
      if(!identified&&!equal&&(nameScore<.9||!h.names.some(n=>CasaReceipts.norm(n)===CasaReceipts.norm(p.name))))continue;
      const score=(identified?10:0)+(equal?4:0)+nameScore;
      if(!best||score>best.score||(score===best.score&&h.date>best.history.date))best={product:p,history:h,current,equal,identified,score};
    }
    if(best)matches.push(best);
  }
  matches.sort((a,b)=>b.score-a.score||b.history.date.localeCompare(a.history.date)||a.product.name.localeCompare(b.product.name,'es'));
  return {history,matches:matches.slice(0,4)};
}

const CK_SRC={instagram:['📸','Instagram'],tiktok:['🎵','TikTok'],youtube:['▶️','YouTube'],web:['🌐','Web'],propia:['🏠','Propia']};
const srcOf=u=>!u?'propia':/instagram\./i.test(u)?'instagram':/tiktok\./i.test(u)?'tiktok':/youtu\.?be/i.test(u)?'youtube':'web';
function vCkRecetas(){
  const f=ui.recF||'todas',q=norm(ui.recQ||''),c=ck();
  let a=S.recipes.slice();
  if(q)a=a.filter(r=>norm(r.name+' '+(r.tags||'')+' '+r.ingredients.map(g=>g.name).join(' ')).includes(q));
  const F={fav:r=>r.fav,again:r=>r.again,hechas:r=>(r.made||[]).length,probar:r=>!(r.made||[]).length,instagram:r=>srcOf(r.url)==='instagram',tiktok:r=>srcOf(r.url)==='tiktok',web:r=>['web','youtube'].includes(srcOf(r.url)),casa:r=>pantryShare(r)>=.6};
  if(F[f])a=a.filter(F[f]);
  const so=ui.recSort||'recientes';
  const cost=r=>{const x=recipeCost(r,c.people);return x?x.per:99};
  const S2={recientes:(x,y)=>(y.added||'').localeCompare(x.added||''),az:(x,y)=>x.name.localeCompare(y.name,'es'),hechas:(x,y)=>(y.made||[]).length-(x.made||[]).length,valoradas:(x,y)=>(y.rating||0)-(x.rating||0)||(y.again?1:0)-(x.again?1:0),baratas:(x,y)=>cost(x)-cost(y),rapidas:(x,y)=>(x.time||999)-(y.time||999)};
  a.sort(S2[so]||S2.recientes);
  let h=`<div class="ck-actions" style="margin-top:8px"><button class="btn sec" data-act="ckNewRec">+ Nueva receta</button></div>
  <div class="quick"><input class="field" id="qRec" placeholder="Buscar receta o ingrediente" value="${esc(ui.recQ||'')}" autocomplete="off"><select class="field" id="ckSort" style="flex:none;width:auto">${opt([['recientes','Recientes'],['az','A-Z'],['valoradas','Mejor valoradas'],['hechas','Más hechas'],['baratas','Más baratas'],['rapidas','Más rápidas']],so)}</select></div>
  <div class="chips" style="margin-top:10px">${[['todas','Todas'],['fav','❤️ Favoritas'],['again','🔁 Repetiría'],['hechas','✅ Hechas'],['probar','🆕 Por probar'],['casa','🥫 Con lo que tengo'],['instagram','📸 Instagram'],['tiktok','🎵 TikTok'],['web','🌐 Web']].map(([k,l])=>`<button class="chip ${f===k?'on':''}" data-act="recF" data-v="${k}">${l}</button>`).join('')}</div>`;
  if(!S.recipes.length)return h+`<div class="empty" style="margin-top:14px">Guarda aquí tus recetas y las que veas en Instagram, TikTok o cualquier web.<br><br><button class="btn sec" data-act="ckSeed">Cargar 24 recetas básicas</button></div>`;
  if(!a.length)return h+`<div class="empty" style="margin-top:14px">Ninguna receta coincide.</div>`;
  h+=`<div style="margin-top:12px">`+ul(a.map(r=>{const rc=recipeCost(r,c.people),[ic]=CK_SRC[srcOf(r.url)],n=(r.made||[]).length;
    const meta=[r.time?'⏱ '+r.time+' min':'',rc?'≈ '+eur(rc.per)+'/ración':'',n?'✅ '+n+(n>1?' veces':' vez'):'',r.rating?'★'.repeat(r.rating):'',r.again?'🔁':'',vetoed(r,c.vetoes)?'<span style="color:var(--danger)">Ingrediente vetado</span>':''].filter(Boolean);
    return`<li class="row"><span class="ck-src" aria-hidden="true">${ic}</span><div class="row-main" data-act="ckRec" data-id="${r.id}"><div class="row-title">${r.fav?'❤️ ':''}${esc(r.name)}</div><div class="row-meta">${meta.map(m=>`<span>${m}</span>`).join('')}</div></div></li>`}))+`</div>`;
  return h;
}

function vCkAjustes(){
  const c=ck();
  let h=`<h2>Presupuesto de compra</h2><div class="list ck-set">
  <div class="row"><div class="row-main">Presupuesto semanal de compra<br><small class="hint">Opcional. De lunes a domingo.</small></div><input class="field" id="ckBudgetW" type="number" inputmode="decimal" min="0" step="5" value="${budgetW()||''}" placeholder="—" style="width:96px;text-align:right"> €</div>
  <div class="row"><div class="row-main">Presupuesto mensual de compra<br><small class="hint">Opcional. Déjalo vacío para ver solo lo gastado.</small></div><input class="field" id="ckBudgetM" type="number" inputmode="decimal" min="0" step="10" value="${c.budgetM||''}" placeholder="—" style="width:96px;text-align:right"> €</div>
  <div class="row"><div class="row-main">Código postal de los precios de Mercadona</div><b>${esc((MC&&MC.cp)||'18210')}</b></div>
</div>
  <h2>Inteligencia artificial</h2><div class="list ck-set"><div class="row"><div class="row-main">${aiKey()?'✅ Activada en este móvil':'Reconocer alimentos en fotos de la nevera'}</div><button class="btn sec" data-act="aiKey">${aiKey()?'Cambiar clave':'Activar'}</button></div></div>
  <h2>Precios de Mercadona</h2><div class="empty" style="text-align:left">${MC?`${MC.p.length.toLocaleString('es-ES')} productos con los precios de la tienda online de Mercadona para el CP <b>${esc(MC.cp||'18210')}</b> (almacén ${esc(MC.wh)}), del <b>${mcDate()}</b>. Se actualizan solos cada mañana.${mcFresh()?'':' <b>⚠️ Están desactualizados.</b>'}<br><br>Precios con «≈» = estimación. Lo gastado de verdad solo sale de lo que apuntáis o de los tiques.`:'Cargando precios…'}</div>
  <h2>Dónde compro</h2><p class="hint" style="margin-top:-4px">Al terminar la compra eliges dónde habéis comprado y lo que habéis pagado: se guardará en el historial de compras.</p><div class="ck-wrap">${c.stores.map((x,i)=>`<button class="chip ${/^(Mercadona|Mercadillo)$/.test(x)?'on':''}" data-act="ckStoreDel" data-v="${i}">${esc(x)}${/^(Mercadona|Mercadillo)$/.test(x)?'':' ✕'}</button>`).join('')}<button class="chip add" data-act="ckStoreNew">+ Supermercado</button></div>
  ${(S.buys||[]).length?`<button class="btn sec" style="width:100%;margin-top:10px" data-act="ckBuys">🧾 Historial de compras</button>`:''}
  ${Object.values(S.prices||{}).filter(e=>e.use!==false).length?`<h2>Precios de otros súper</h2>`+ul(Object.values(S.prices).filter(e=>e.use!==false).sort((a,b)=>a.name.localeCompare(b.name,'es')).map(e=>`<li class="row"><div class="row-main" data-act="ckPrice" data-v="${esc(e.name)}"><div class="row-title">${esc(e.name)}</div><div class="row-meta"><span>🏪 ${esc(e.store)}</span><span>${parse(e.at).toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</span></div></div><span class="row-side">${eur(e.price)}${e.qtxt?' / '+esc(e.qtxt):e.n?' / '+(e.d==='ud'?e.n+' ud':fmtAmt(e.n,'g')):''}</span></li>`)):''}
`;
  return h;
}

/* ---------- hojas ---------- */
function cookedSheet(r,ppl){
  const f=(ppl||r.servings||2)/(r.servings||2);
  const rows=r.ingredients.map((g,i)=>{const x=pantryFind(g.name);const q=parseQty(g.qty);const n=x&&q?toDim(q,g.name,pUnit(x)):null;
    return x&&n!=null?`<label class="ing-row" style="display:flex;margin:0;color:var(--ink);font-weight:400;font-size:1rem"><input type="checkbox" data-i="${i}" checked><span>${esc(x.name)} <small>−${fmtAmt(n*f,x.u)} (quedan ${fmtAmt(Math.max(0,x.n-n*f),x.u)})</small></span></label>`:''}).join('');
  sheet('¡Cocinado! '+r.name,`<p class="hint" style="margin-top:0">Se apunta en tu historial de recetas hechas${rows?' y se descuenta de la despensa':''}.</p>${rows?`<div class="ck-box">${rows}</div>`:''}
    <label>¿La repetirías?</label><div class="chips"><button type="button" class="chip ${r.again?'on':''}" data-again="1">🔁 Sí, la repetiría</button><button type="button" class="chip ${r.again===false?'on':''}" data-again="0">No</button></div>
    <label>Valoración</label><div class="ck-stars">${[1,2,3,4,5].map(n=>`<button type="button" data-star="${n}" class="${(r.rating||0)>=n?'on':''}" aria-label="${n} estrellas">★</button>`).join('')}</div>`,
  {saveLabel:'Guardar',onSave:ov=>{
    const x=find(S.recipes,r.id);if(!x)return;
    x.made=[...(x.made||[]),today()];x.status='hecha';
    const ag=ov.querySelector('[data-again].on');if(ag)x.again=ag.dataset.again==='1';
    const st=ov.querySelectorAll('[data-star].on').length;if(st)x.rating=st;
    let c=0;ov.querySelectorAll('[data-i]').forEach(cb=>{if(!cb.checked)return;const g=r.ingredients[+cb.dataset.i];const p=pantryFind(g.name);const q=parseQty(g.qty);const n=p&&q?toDim(q,g.name,pUnit(p)):null;if(n!=null){p.n=Math.max(0,Math.round((p.n-n*f)*10)/10);p.at=today();c++}});
    save();toastUndo('Apuntado'+(c?' y descontado de la despensa':''));
  }}).addEventListener('click',ev=>{
    const a=ev.target.closest('[data-again]');if(a){a.parentNode.querySelectorAll('[data-again]').forEach(b=>b.classList.toggle('on',b===a));return}
    const s=ev.target.closest('[data-star]');if(s){const n=+s.dataset.star;s.parentNode.querySelectorAll('[data-star]').forEach(b=>b.classList.toggle('on',+b.dataset.star<=n))}
  });
}

// Lo que falta de una receta (según la despensa) va a la cesta
function recipeToCart(r,ppl){
  const f=(ppl||r.servings||2)/(r.servings||2);let n=0;
  r.ingredients.forEach(g=>{const p=matchProduct(g.name);if(!p)return;const q=parseQty(g.qty);
    const need=q?toDim(q,g.name,p.d,p.size):null,have=pantryAmount(g.name,p.d);
    if(have!=null&&(have===Infinity||need==null?have>0:have>=need*f))return;
    const packs=need!=null?Math.max(1,Math.ceil((need*f-(have||0))/p.size-1e-6)):1;
    if(p.user){if(!cartItems().some(i=>norm(i.name)===norm(g.name))){S.items.push({id:uid(),listId:cartList(),name:g.name,qty:p.qtxt||'',section:ckSection(null,g.name),by:'',done:false,price:p.price*packs,store:p.store});n++}return}
    const cur=cartOf(p.id);if(cur&&(cur.units||1)>=packs)return;cartSet(p,packs);n++});
  if(n)save();return n;
}
// Consejos para hacer la receta con los electrodomésticos que tienes
function adaptTips(r){
  const c=ck(),txt=norm((r.steps||'')+' '+r.name),tips=[];
  const tm=txt.match(/(\d{3})\s*(?:º|°|grados|c\b)/),mn=txt.match(/(\d{1,3})\s*(?:min|minutos)/);
  const T=tm?+tm[1]:180,M=mn?+mn[1]:0;
  const uses=k=>(r.appl||[]).includes(k)||({horno:/horno|hornea|gratin/,fuego:/sarten|cazo|cazuela|olla|hervir|sofri/,olla:/olla (rapida|express|programable)/,micro:/microondas/}[k]||/^$/).test(txt);
  if(uses('horno')&&c.appl.includes('airfryer'))tips.push(['Freidora de aire',`En vez de horno: ${T-20} °C${M?' durante unos '+Math.max(5,Math.round(M*.8))+' min':' y un 20 % menos de tiempo'}. Sin precalentar (o 3 min), no llenes la cesta y dale la vuelta a mitad.`]);
  if(uses('horno')&&!c.appl.includes('horno')&&!c.appl.includes('airfryer')&&c.appl.includes('micro'))tips.push(['Microondas','Si tu microondas tiene grill o convección, úsalo a la misma temperatura; si no, mejor elige otra receta.']);
  if(/legumbre|lenteja|garbanzo|alubia|judion|cocido|guiso|estofado|ternera|rabo|carrillada/.test(txt)&&c.appl.includes('olla'))tips.push(['Olla rápida / programable','Pon un tercio menos de agua. Lentejas: 8-10 min a presión; garbanzos remojados: 18-20 min; carne de guiso: 25-30 min. Deja salir la presión sola.']);
  if(/legumbre|lenteja|garbanzo|guiso|estofado|crema|caldo/.test(txt)&&c.appl.includes('lenta'))tips.push(['Olla lenta','Sofríe aparte, pon todo con la mitad de líquido: 6-8 h en LOW o 3-4 h en HIGH.']);
  if(/crema|pure|salsa|sofrito|bechamel|masa|bizcocho|hummus|gazpacho|salmorejo/.test(txt)&&c.appl.includes('robot'))tips.push(['Robot de cocina','Sofrito: 7 min/120 °C/vel. 1. Cremas: cocina 20-25 min/100 °C y tritura 1 min subiendo a vel. 10. Bechamel: 10 min/90 °C/vel. 4.']);
  if(/verdura|brocoli|coliflor|judia|pescado|merluza|patata cocida/.test(txt)&&c.appl.includes('vapor'))tips.push(['Vaporera','Verdura troceada 8-12 min; pescado en filetes 8-10 min; patata en dados 15 min.']);
  if(/pechuga|filete|pescado|salmon|hamburguesa|verdura a la plancha/.test(txt)&&c.appl.includes('airfryer')&&!uses('horno'))tips.push(['Freidora de aire','Filetes y pechugas: 180 °C 10-12 min dándoles la vuelta. Salmón: 180 °C 8-10 min. Verduras: 190 °C 12-15 min.']);
  (r.appl||[]).forEach(a=>{if(!c.appl.includes(a)){const alt=(CK_ALT[a]||[]).find(b=>c.appl.includes(b));tips.push([applName(a),alt?'No lo tienes: hazla con '+applName(alt).toLowerCase()+'.':'⚠️ No lo tienes y no hay alternativa clara.'])}});
  if(r.adapt)tips.unshift(['Tus notas',r.adapt]);
  return tips;
}

function recipeView(r){
  if(!r)return;
  const c=ck();let ppl=c.people;
  const ov=sheet(r.name,`<div id="ckRV"></div>`,{});
  const box=ov.querySelector('#ckRV');
  const draw=()=>{
    const f=ppl/(r.servings||2),rc=recipeCost(r,ppl),[ic,src]=CK_SRC[srcOf(r.url)],n=(r.made||[]).length;
    box.innerHTML=`<div class="row-meta" style="margin:-8px 0 10px">${[ic+' '+src,r.time?'⏱ '+r.time+' min':'',rc?'≈ '+eur(rc.total)+' ('+eur(rc.per)+'/ración)':'',n?'✅ hecha '+n+(n>1?' veces':' vez')+' · última '+relDate(lastMade(r)):'Por probar'].filter(Boolean).map(x=>`<span>${x}</span>`).join('')}</div>
    ${/^https?:\/\//i.test(r.url||'')?`<a class="btn sec" style="display:block;text-align:center;margin-bottom:10px" href="${esc(r.url)}" target="_blank" rel="noopener">Abrir en ${esc(src)} ↗</a>`:''}
    <div class="ck-actions"><button type="button" class="chip ${r.fav?'on':''}" data-r="fav">❤️ Favorita</button><button type="button" class="chip ${r.again?'on':''}" data-r="again">🔁 Repetiría</button><button type="button" class="chip ${r.noSug?'on':''}" data-r="nosug">🚫 No sugerir</button></div>
    <div class="ck-stars">${[1,2,3,4,5].map(n=>`<button type="button" data-star="${n}" class="${(r.rating||0)>=n?'on':''}" aria-label="${n} estrellas">★</button>`).join('')}</div>
    <div class="head-row"><h4>Ingredientes</h4><span class="ck-ppl"><button type="button" class="ck-ib" data-r="ppl-">−</button><b>${ppl}</b> pers.<button type="button" class="ck-ib" data-r="ppl+">+</button></span></div>
    <div class="ck-box">${r.ingredients.map((g,i)=>{const q=parseQty(g.qty);const x=pantryFind(g.name);const ic2=ingCost(g,f);
      const qty=q&&f!==1?(q.d==='m'&&!q.raw.startsWith('cuchar')&&!['cda','cdas','cdta','cdtas','pizca','pizcas','chorro','chorrito'].includes(q.raw)?fmtAmt(q.n*f,'g'):(Math.round(q.n*f*10)/10).toLocaleString('es-ES')+(q.raw?' '+q.raw:'')):g.qty;
      return`<button type="button" class="ck-ing" data-ing="${i}"><span class="ck-dot ${x&&x.n>0?'ok':''}" aria-label="${x&&x.n>0?'En la despensa':'No está en la despensa'}"></span><span><b>${esc(g.name)}</b>${qty?' · '+esc(qty):''}<br><small>${ic2?(ic2.p.user?'🏪 '+esc(ic2.p.store)+' · ':'')+esc(ic2.p.name)+' · '+eur(ic2.p.price)+(x&&x.n>0?' · en casa: '+fmtAmt(x.n,x.u):''):MC?'Sin producto: toca para elegirlo':''}</small></span></button>`}).join('')||'<p class="hint">Sin ingredientes</p>'}</div>
    ${r.steps?`<h4>Preparación</h4><div class="ck-steps">${esc(r.steps).replace(/\n/g,'<br>')}</div>`:''}
    ${(()=>{const t=adaptTips(r);return t.length?`<h4>Con tus electrodomésticos</h4>${t.map(([a,b])=>`<div class="ck-tip"><b>${esc(a)}</b><br>${esc(b)}</div>`).join('')}`:''})()}
    ${r.notes?`<h4>Notas</h4><div class="ck-steps">${esc(r.notes).replace(/\n/g,'<br>')}</div>`:''}
    <div class="ck-actions" style="margin-top:14px"><button type="button" class="btn" data-r="cook">✅ La he hecho</button><button type="button" class="btn sec" data-r="cart">🛒 Lo que falta, a la cesta</button></div>
    <div class="ck-actions" style="margin-top:8px"><button type="button" class="btn sec" data-r="edit">Editar</button></div>`;
  };
  draw();
  box.addEventListener('click',ev=>{
    const x=find(S.recipes,r.id);if(!x)return;
    const s=ev.target.closest('[data-star]');if(s){x.rating=x.rating===+s.dataset.star?0:+s.dataset.star;save();r=x;draw();return}
    const g=ev.target.closest('[data-ing]');if(g){const nm=x.ingredients[+g.dataset.ing].name;productPicker(nm,p=>{if(!p.user){S.prodMap=Object.assign({},S.prodMap||{});S.prodMap[norm(nm)]=p.id}mcCache.clear();save();draw()},nm);return}
    const b=ev.target.closest('[data-r]');if(!b)return;const k=b.dataset.r;
    if(k==='fav')x.fav=!x.fav;
    if(k==='again')x.again=!x.again;
    if(k==='nosug'){x.noSug=!x.noSug;toast(x.noSug?'No te la volveré a sugerir':'Se puede volver a sugerir')}
    if(k==='ppl-'){ppl=Math.max(1,ppl-1);draw();return}
    if(k==='ppl+'){ppl++;draw();return}
    if(k==='cook'){ov.remove();cookedSheet(x,ppl);return}
    if(k==='edit'){ov.remove();recipeEdit(x);return}
    if(k==='cart'){const n=recipeToCart(x,ppl);toast(n?n+' producto'+(n>1?'s':'')+' a la cesta':'Ya tienes todo en casa o en la cesta');return}
    save();r=x;draw();
  });
}

function recipeEdit(r,pre){
  const n=!r,c=ck();r=r||Object.assign({name:'',ingredients:[],servings:c.people,meal:'ambas'},pre||{});
  const ov=sheet(n?'Nueva receta':'Editar receta',`
    <label for="f_u">Enlace (Instagram, TikTok, web…)</label><input class="field" id="f_u" type="url" inputmode="url" value="${esc(r.url||'')}" placeholder="Pega aquí el enlace">
    <label for="f_t">Nombre</label><input class="field" id="f_t" value="${esc(r.name)}" placeholder="Ej.: Pollo al limón en freidora de aire">
    <details ${pre&&pre.caption?'open':''}><summary class="link" style="margin-top:12px">📋 Pegar la descripción del vídeo o la web</summary>
      <textarea class="field" id="f_cap" rows="4" placeholder="Copia el texto de la publicación (ingredientes y pasos) y pégalo aquí">${esc(pre&&pre.caption||'')}</textarea>
      <button type="button" class="btn sec" data-k="parse" style="margin-top:8px;width:100%">Sacar ingredientes y pasos</button></details>
    <div class="grid2"><div><label for="f_m">Para</label><select class="field" id="f_m">${opt([['ambas','Comida o cena'],['comida','Comida'],['cena','Cena'],['otro','Otro (desayuno, postre…)']],r.meal||'ambas')}</select></div>
    <div><label for="f_sv">Raciones</label><input class="field" id="f_sv" type="number" min="1" value="${r.servings||2}"></div></div>
    <div class="grid2"><div><label for="f_tm">Tiempo (min)</label><input class="field" id="f_tm" type="number" min="0" value="${r.time||''}"></div>
    <div><label for="f_tg">Etiquetas</label><input class="field" id="f_tg" value="${esc(r.tags||'')}" placeholder="pasta, rápida…"></div></div>
    <label>Electrodomésticos que usa</label><div class="ck-wrap" id="f_ap">${[...CK_APPL,...(c.applX||[]).map(x=>[x,x])].map(([k,l])=>`<button type="button" class="chip ${(r.appl||[]).includes(k)?'on':''}" data-ap="${esc(k)}">${esc(l)}</button>`).join('')}</div>
    <label for="f_i">Ingredientes (uno por línea: nombre, cantidad)</label><textarea class="field" id="f_i" rows="6" placeholder="Lentejas, 250 g&#10;Zanahoria, 2&#10;Cebolla, 1&#10;Aceite de oliva, 2 cucharadas">${esc(ingsText(r))}</textarea>
    <label for="f_st">Preparación</label><textarea class="field" id="f_st" rows="5" placeholder="Pasos…">${esc(r.steps||'')}</textarea>
    <label for="f_ad">Notas para mis electrodomésticos</label><textarea class="field" id="f_ad" rows="2" placeholder="Ej.: en la airfryer 15 min a 180 °C">${esc(r.adapt||'')}</textarea>
    <label for="f_no">Notas</label><textarea class="field" id="f_no" rows="2">${esc(r.notes||'')}</textarea>`,
  {onSave:ov=>{
    const name=val(ov,'f_t');if(!name){toast('Escribe el nombre de la receta');return false}
    const o={name,url:val(ov,'f_u'),meal:val(ov,'f_m'),servings:Math.max(1,+val(ov,'f_sv')||2),time:+val(ov,'f_tm')||0,tags:val(ov,'f_tg'),
      appl:[...ov.querySelectorAll('[data-ap].on')].map(b=>b.dataset.ap),ingredients:parseIngs(ov.querySelector('#f_i').value),steps:ov.querySelector('#f_st').value.trim(),adapt:ov.querySelector('#f_ad').value.trim(),notes:ov.querySelector('#f_no').value.trim()};
    if(n){const dup=recipeByName(name);if(dup){toast('Ya tienes una receta con ese nombre');return false}S.recipes.push(Object.assign({id:uid(),added:today(),made:[],status:'probar'},o))}
    else{const x=find(S.recipes,r.id);if(x){Object.assign(x,o);Object.values(S.menu).forEach(e=>{if(e.recipeId===x.id)e.name=x.name})}}
    save();toast(n?'Receta guardada':'Receta actualizada');
  },onDelete:n?null:()=>{S.recipes=S.recipes.filter(x=>x.id!==r.id);Object.values(S.menu).forEach(e=>{if(e.recipeId===r.id)e.recipeId=null});save();toastUndo('Receta eliminada')}});
  ov.addEventListener('click',ev=>{
    const a=ev.target.closest('[data-ap]');if(a){a.classList.toggle('on');return}
    const b=ev.target.closest('[data-k="parse"]');if(!b)return;
    const p=parseCaption(ov.querySelector('#f_cap').value);
    if(!p.ingredients.length&&!p.steps){toast('No he encontrado ingredientes en el texto');return}
    if(p.title&&!val(ov,'f_t'))ov.querySelector('#f_t').value=p.title;
    if(p.ingredients.length)ov.querySelector('#f_i').value=p.ingredients.map(i=>i.name+(i.qty?', '+i.qty:'')).join('\n');
    if(p.steps)ov.querySelector('#f_st').value=p.steps;
    if(p.servings)ov.querySelector('#f_sv').value=p.servings;
    if(p.time)ov.querySelector('#f_tm').value=p.time;
    CK_APPL.forEach(([k])=>{if(p.appl.includes(k)){const c2=ov.querySelector(`[data-ap="${k}"]`);if(c2)c2.classList.add('on')}});
    toast(p.ingredients.length+' ingredientes encontrados');
  });
  const u=ov.querySelector('#f_u');
  u.addEventListener('change',()=>fetchLinkTitle(u.value).then(t=>{const f=ov.querySelector('#f_t');if(t&&!f.value)f.value=t}));
  if(pre&&pre.caption&&!r.ingredients.length)ov.querySelector('[data-k="parse"]').click();
  return ov;
}

// TikTok y YouTube dicen el título del vídeo; Instagram y la mayoría de webs no lo permiten desde el navegador
function fetchLinkTitle(url){
  const s=srcOf(url);
  const ep=s==='tiktok'?'https://www.tiktok.com/oembed?url=':s==='youtube'?'https://www.youtube.com/oembed?format=json&url=':'';
  if(!ep||!/^https?:\/\//.test(url))return Promise.resolve('');
  return fetch(ep+encodeURIComponent(url)).then(r=>r.ok?r.json():{}).then(d=>(d.title||'').split('\n')[0].replace(/#\S+/g,'').trim().slice(0,90)).catch(()=>'');
}

// Saca ingredientes y pasos de la descripción de una publicación
function parseCaption(txt){
  const lines=String(txt||'').split(/\n/).map(l=>l.trim()).filter(Boolean);
  const out={title:'',ingredients:[],steps:'',servings:0,time:0,appl:[]};
  let mode='',steps=[];
  const isHead=(l,re)=>re.test(norm(l).replace(/[^a-z ]/g,'').trim())&&norm(l).length<40;
  const QTY=/^(\d+[.,/]?\d*\s*(kg|g|gr|grs|gramos|ml|l|cl|litros?|cucharadas?|cucharaditas?|cdas?|cdtas?|tazas?|vasos?|dientes?|latas?|botes?|sobres?|uds?|unidades?|lonchas?|pizcas?)?\b|medi[oa]|una?|½|¼)\s+(de\s+)?/i;
  lines.forEach((l,i)=>{
    const n=norm(l);
    if(isHead(l,/^(ingredientes?|necesitas|lista)\b/)){mode='i';return}
    if(isHead(l,/^(preparacion|elaboracion|pasos|instrucciones|modo de preparacion|como se hace|receta)\b/)){mode='s';return}
    const sv=n.match(/(\d+)\s*(personas|raciones|porciones|comensales)/);if(sv&&!out.servings)out.servings=+sv[1];
    const tm=n.match(/(\d+)\s*(min|minutos)\b/);if(tm&&!out.time&&/tiempo|total|listo/.test(n))out.time=+tm[1];
    const bullet=/^[\-•*▪·✔✅👉🔸🔹➡️▫️◽️]/u.test(l);
    const clean=l.replace(/^[\s\-•*▪·✔️✅👉🔸🔹➡️▫️◽️]+/u,'').replace(/^\d+[.)]\s+/,'').trim();
    if(!out.title&&i===0&&!bullet&&!QTY.test(clean)&&mode===''){out.title=clean.replace(/#\S+/g,'').replace(/[^\p{L}\p{N} ,.'¡!¿?()-]/gu,'').trim().slice(0,90);return}
    if(mode==='s'||(/^\d+[.)]\s/.test(l)&&mode!=='i')||(mode===''&&clean.length>60)){if(!/^#/.test(clean))steps.push(clean);return}
    if(mode==='i'||bullet||QTY.test(clean)){
      if(/^#/.test(clean))return;
      const m=clean.match(QTY);let name=clean,qty='';
      if(m){qty=m[1].trim();name=clean.slice(m[0].length).trim()}
      else{const c=clean.match(/^(.*?)[\s:,(-]+(\d+[.,/]?\d*\s*[a-zñ]*\.?)\)?$/i);if(c){name=c[1].trim();qty=c[2].trim()}}
      name=name.replace(/[:(]$/,'').trim();
      if(name&&name.length<60)out.ingredients.push({name:name[0].toUpperCase()+name.slice(1),qty});
    }
  });
  out.steps=steps.join('\n');
  const all=norm(txt);
  if(/air ?fryer|freidora de aire/.test(all))out.appl.push('airfryer');
  if(/\bhorno\b/.test(all))out.appl.push('horno');
  if(/thermomix|mambo|robot de cocina|\bvel(ocidad)?\.? ?\d/.test(all))out.appl.push('robot');
  if(/olla (rapida|express|programable)|presion/.test(all))out.appl.push('olla');
  if(/microondas/.test(all))out.appl.push('micro');
  return out;
}

function productPicker(q,onPick,key,context){
  const c=ck(),e=key&&(S.prices||{})[norm(key)],catalogDate=String(MC?.at||'').slice(0,10);
  const ov=sheet(key?'¿Dónde compras '+key.toLowerCase()+'?':'Producto de Mercadona',`${key?`<details ${e&&e.use!==false?'open':''}><summary class="link">🏪 Lo compro en otro supermercado</summary>
    <div class="grid2"><div><label for="f_st">Supermercado</label><select class="field" id="f_st">${opt(c.stores.filter(x=>x!=='Mercadona').map(x=>[x,x]),e&&e.store!=='Mercadona'?e.store:'')}</select></div>
    <div><label for="f_pr">Precio (€)</label><input class="field" id="f_pr" type="number" inputmode="decimal" step="0.01" min="0" value="${e&&e.price||''}"></div></div>
    <label for="f_en">Envase (opcional)</label><input class="field" id="f_en" value="${e?esc(e.qtxt||(e.n?(e.d==='ud'?e.n+' ud':fmtAmt(e.n,'g')):'')):''}" placeholder="Ej.: 1 kg, 500 g, 6 ud">
    <button type="button" class="btn" data-k="own" style="width:100%;margin-top:10px">Usar este precio</button>
    ${e&&e.hist&&e.hist.length?`<p class="hint">Has pagado: ${e.hist.slice(-4).reverse().map(CasaReceipts.historyEntry).map(h=>esc(h.store)+' '+eur(h.price)+' ('+parse(h.date).toLocaleDateString('es-ES',{day:'numeric',month:'short'})+')').join(' · ')}</p>`:''}</details>
    <h4>O elige el de Mercadona</h4>`:''}<input class="field" id="f_q" value="${esc(q)}" placeholder="Buscar producto" autocomplete="off"><div id="ckPP" class="ck-pick" style="max-height:52vh"></div><p class="hint">Precios de la tienda online de Mercadona (CP 18210)${CasaReceipts.validDate(catalogDate)?' del '+parse(catalogDate).toLocaleDateString('es-ES',{day:'numeric',month:'short'}):''}.</p>`,{});
  ov.addEventListener('click',ev=>{if(!ev.target.closest('[data-k="own"]'))return;
    const pr=parseFloat(String(val(ov,'f_pr')).replace(',','.'));if(!(pr>0)){toast('Escribe el precio');return}
    const q2=parseQty(val(ov,'f_en'));savePrice(key,{store:val(ov,'f_st'),price:pr,n:q2?q2.n:0,d:q2?q2.d:'m',qtxt:val(ov,'f_en')});mcCache.clear();
    ov.remove();onPick(userPrice(key))});
  const inp=ov.querySelector('#f_q'),box=ov.querySelector('#ckPP');
  const draw=()=>{if(!MC){box.innerHTML='<p class="hint">Cargando precios…</p>';loadMC().then(draw);return}
    if(context?.pantry&&!ov.priceMatches)ov.priceMatches=pantryProductMatches(context.pantry);
    const evidence=ov.priceMatches,suggestions=norm(inp.value)===norm(q)?evidence?.matches||[]:[],ids=new Set(suggestions.map(m=>m.product.id)),a=searchProducts(inp.value,40).filter(p=>!ids.has(p.id));
    const option=(p,extra='')=>`<button type="button" class="ck-opt ck-prod" data-id="${p.id}">${p.img?`<img src="${prodImg(p)}" alt="" loading="eager">`:''}<span><b>${esc(p.name)}</b><small>${esc(p.pack)} ${prodSize(p)} · <b>${eur(p.price)}</b> · ${eur(p.ref)}/${esc(p.refFmt)}</small>${extra}</span></button>`;
    const previous=norm(inp.value)===norm(q)?evidence?.history[0]:null,summary=previous?`<p class="hint" data-picker-paid>En tus compras: ${eur(previous.price)}/${previous.basis==='kg'?'kg':'envase'} · ${esc(previous.date)}.</p>`:'';
    box.innerHTML=summary+(suggestions.length?`<h4>Coincidencias con tus compras</h4><p class="hint">${suggestions.length>1?'Hay varias posibilidades. ':''}Confirma el producto antes de asociarlo.</p>`+suggestions.map(m=>option(m.product,`<small data-price-match>${m.identified?'Identificado en tu historial':'Nombre similar'} · ${m.equal?'mismo precio':'precio distinto'}<br>Pagaste ${eur(m.history.price)}/${m.history.basis==='kg'?'kg':'envase'} el ${esc(m.history.date)} · Ahora ${eur(m.current)}/${m.history.basis==='kg'?'kg':'envase'}</small>`)).join('')+(a.length?'<h4>Otros resultados</h4>':''):previous?'<p class="hint">Puedes buscar otra referencia por su nombre.</p>':'')+a.map(p=>option(p)).join('')||'<p class="hint">Sin resultados</p>'};
  draw();let t;inp.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(draw,150)});
  box.addEventListener('click',ev=>{const b=ev.target.closest('[data-id]');if(!b)return;const p=prod(MC.byId.get(b.dataset.id));
    if(key&&(S.prices||{})[norm(key)]){S.prices=Object.assign({},S.prices);S.prices[norm(key)]=Object.assign({},S.prices[norm(key)],{use:false})}
    ov.remove();onPick(p)});
}

function removePantryItem(id){
  if(!(S.pantry||[]).some(x=>x.id===id))return;
  S.pantry=S.pantry.filter(x=>x.id!==id);save();toastUndo('Quitado de la despensa');
}
function confirmRemovePantry(id){
  const x=find(S.pantry||[],id);if(!x)return;
  sheet('Eliminar de la despensa',`<p>¿Quieres quitar <b>${esc(x.name)}</b> de lo que tienes en casa?</p><p class="hint">La lista de la compra y el historial de gastos se conservan.</p>`,{saveLabel:'Eliminar artículo',onSave:()=>removePantryItem(id)});
}

function productSheetPhoto(path,name){
  return path?`<img class="product-sheet-photo" src="${imgUrl(path,240)}" alt="${esc(name)}">`:'';
}

function panSheet(x){
  const n=!x;x=x||{name:'',n:1,u:'ud',min:0,loc:'Despensa',auto:false};
  let available=x.n>0;
  const last=n?null:pantryLastPurchase(x),lastDate=last?new Date(last.date+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'}):'';
  const ov=sheet(n?'Añadir a En casa':x.name,`<div class="pantry-detail-picture" id="pantryPhotoPreview" ${n?'hidden':''}>${n?'':pantryImage(x,480)}</div>${n?'':`<dl class="pantry-facts"><div><dt>Última compra</dt><dd data-last-purchase>${last?esc(lastDate):'Sin compra registrada'}</dd></div>${last?.store?`<div><dt>Comercio</dt><dd>${esc(last.store)}</dd></div>`:''}<div><dt>Categoría</dt><dd data-pantry-category>${esc(pantryCategory(x))}</dd></div><div><dt>Ubicación</dt><dd>${esc(x.loc||'Despensa')}</dd></div>${x.exp?`<div><dt>Caducidad</dt><dd>${esc(relDate(x.exp))}</dd></div>`:''}</dl>`}
    ${n?'':`<details class="house-price-fold"><summary>Precios anteriores</summary>${housePriceHTML(x)}</details>`}<button type="button" class="btn sec" data-k="mc" style="width:100%">🖼️ ${x.mid?'Cambiar':'Asociar'} foto y categoría</button><p class="hint" id="f_mc">${x.mid&&MC?.byId.has(String(x.mid))?esc(MC.byId.get(String(x.mid))[1]):'Busca el producto para ponerle su foto y colocarlo en su categoría.'}</p>
    <label>Estado</label><div class="chips"><button type="button" class="chip ${available?'on':''}" data-home-state="available" aria-pressed="${available}">✅ En casa</button><button type="button" class="chip ${available?'':'on'}" data-home-state="empty" aria-pressed="${!available}">🛒 Se ha acabado</button></div>
    <details class="product-more" ${n?'open':''}><summary>Editar datos del producto</summary>
    <label for="f_t">Producto</label><input class="field" id="f_t" value="${esc(x.name)}" placeholder="Ej.: Arroz">
    <label for="f_l">Dónde está</label><select class="field" id="f_l">${opt(CK_LOCS.map(l=>[l,l]),x.loc||'Despensa')}</select>
    <label for="f_e">Caduca (opcional)</label><input class="field" id="f_e" type="date" value="${esc(x.exp||'')}">
    <p class="hint">Al marcar «Se ha acabado», se añadirá a Compras. Al registrar la compra volverá a estar en casa.</p></details>`,
  {autoFocus:false,onSave:ov=>{
    let name=val(ov,'f_t');if(!name){toast('Escribe el producto');return false}name=name[0].toUpperCase()+name.slice(1);
    if(n&&(S.pantry||[]).some(p=>norm(p.name)===norm(name))){toast('Ya está en casa');return false}
    const target=n?{...x,id:uid()}:find(S.pantry,x.id);if(!target){toast('Este artículo ya no está en casa');return false}
    const mid=ov.dataset.mid||x.mid||'',selected=ov.dataset.mid&&prod(MC?.byId.get(mid));
    if(ov.dataset.mid&&!selected?.img){toast('Elige un producto con foto');return false}
    if(ov.dataset.mid&&mid!==x.mid&&(S.pantry||[]).some(p=>p.id!==x.id&&String(p.mid)===mid)){toast('Ese producto ya está en casa. Elige otra referencia para evitar duplicarlo.');return false}
    Object.assign(target,{name,loc:val(ov,'f_l'),exp:val(ov,'f_e'),mid,at:today()});
    if(selected){target.section=selected.cat||'Otros';rememberHabit(mid);pantryPhotoFailures.delete(selected.img)}
    if(n)S.pantry=[...(S.pantry||[]),target];
    if(!available){if(n||target.n>0)markPantryFinished(target.id,target.name)}
    else if(n||!(target.n>0))setPantryPresent(target);
    save();
  },onDelete:n?null:()=>removePantryItem(x.id)});
  ov.classList.add('pantry-detail');
  ov.addEventListener('click',ev=>{
    const state=ev.target.closest('[data-home-state]');if(state){available=state.dataset.homeState==='available';ov.querySelectorAll('[data-home-state]').forEach(b=>{const on=(b.dataset.homeState==='available')===available;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on))});return}
    if(!ev.target.closest('[data-k="mc"]'))return;
    productPicker(val(ov,'f_t'),p=>{
      if(!p.img){toast('Ese producto no tiene foto. Elige otra referencia.');return}
      ov.dataset.mid=p.id;const t=ov.querySelector('#f_t');if(!t.value)t.value=p.name.replace(/ Hacendado.*$/,'');
      ov.querySelector('#f_mc').textContent=p.name;ov.querySelector('[data-k="mc"]').textContent='🖼️ Cambiar foto y categoría';
      const preview=ov.querySelector('#pantryPhotoPreview');preview.hidden=false;preview.innerHTML=pantryImage({...x,mid:p.id,name:t.value},480);
      const category=ov.querySelector('[data-pantry-category]');if(category)category.textContent=p.cat;
    },undefined,{pantry:x});
  });
}

/* ---------- Compras: lista con fotos, cantidades y tachado ---------- */
const imgUrl=(img,s)=>img?`https://prod-mercadona.imgix.net/images/${img}?fit=contain&h=${s}&w=${s}`:'';
const itemImg=i=>{const p=i.mid&&MC&&MC.byId.get(String(i.mid));return p?p[9]:i.mid?habitInfo(i.mid).img:''};
const monthKey=d=>(d||today()).slice(0,7);
const spentIn=m=>(S.buys||[]).filter(b=>monthKey(b.date)===m).reduce((a,b)=>a+(+b.total||0),0);
const monthName=m=>new Date(+m.slice(0,4),+m.slice(5,7)-1,1).toLocaleDateString('es-ES',{month:'long',year:'numeric'});
const hhmm=t=>t?new Date(t).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}):'';
const sameItem=(i,o)=>o.mid?i.mid===o.mid:!i.mid&&norm(i.name)===norm(o.name);
// Resumen de dinero: lo que vamos a gastar (estimado) y lo ya gastado este mes (real)
// Semana de lunes a domingo: lo gastado y el presupuesto semanal (opcional)
const budgetW=()=>{const c=S.cook||{};return c.budgetW!=null?+c.budgetW||0:c.budget!=null?+c.budget||0:0};
function spentWeek(){const a=weekStart(0),z=addDays(a,6);return(S.buys||[]).filter(b=>b.date>=a&&b.date<=z).reduce((s,b)=>s+(+b.total||0),0)}
function weekRow(){
  const w=spentWeek(),b=budgetW(),pct=b?w/b*100:0,st=!b?'':pct>100?'over':pct>=85?'near':'ok';
  return`<button class="ck-week ${st}" data-act="ckBuys"><span class="ck-wk-t"><small>📅 Gastado esta semana</small><b>${eur(w)}</b></span><span class="ck-wk-r">${b?(w<=b?'Quedan '+eur(b-w)+'<br>de '+eur0(b):'Te has pasado<br>'+eur(w-b)):'Sin presupuesto<br>semanal'}</span>${b?`<span class="ck-mbar ${st}"><i style="width:${Math.min(100,pct)}%"></i></span>`:''}${st==='near'?'<small class="ck-mwarn">⚠️ Cerca del presupuesto de la semana</small>':st==='over'?'<small class="ck-mwarn">⛔ Presupuesto de la semana superado</small>':''}</button>`;
}
function moneyCard(pend){
  const c=ck(),m=monthKey(),spent=spentIn(m),est=pend.reduce((a,i)=>a+(i.price||0),0),noPrice=pend.filter(i=>!i.price).length,b=+c.budgetM||0;
  const pct=b?spent/b*100:0,st=!b?'':pct>100?'over':pct>=85?'near':'ok';
  return`<div class="ck-money">
    <div class="ck-mc"><small>🛒 Cesta actual · estimación</small><b>≈ ${eur(est)}</b><span>${pend.length} producto${pend.length===1?'':'s'}${noPrice?` · ${noPrice} sin precio`:''}</span></div>
    <button class="ck-mc ${st}" data-act="ckBuys"><small>💶 Gastado este mes</small><b>${eur(spent)}</b><span>${b?(spent<=b?'Quedan '+eur(b-spent)+' de '+eur0(b):'Te has pasado '+eur(spent-b)):monthName(m)}</span></button>
    ${b?`<div class="ck-mbar ${st}"><i style="width:${Math.min(100,pct)}%"></i></div>${st==='near'?'<small class="ck-mwarn">⚠️ Os acercáis al presupuesto del mes</small>':st==='over'?'<small class="ck-mwarn">⛔ Presupuesto del mes superado</small>':''}`:''}
    ${weekRow()}
    <div class="ck-mbtns"><button class="btn sec" data-act="ckMarket">🧺 Mercadillo</button><button class="btn sec" data-act="ckSpend">+ Gasto de compra</button><button class="btn sec" data-act="ckTicket">🧾 Tique</button></div>
  </div>`;
}
function itemRow(i){
  const img=itemImg(i),u=i.units||1;
  const meta=[!i.mid&&i.qty?esc(i.qty):'',i.mid&&i.qty?esc(i.qty.replace(/^\d+ × /,'')):'',i.store?'🏪 '+esc(i.store):'',i.by&&!/^(Menú|Despensa)$/.test(i.by)?'pidió '+esc(i.by):'',i.done&&i.doneAt?'✓ '+(i.doneBy?esc(i.doneBy)+' ':'')+hhmm(i.doneAt):''].filter(Boolean);
  return`<li class="row ck-it ${i.done?'is-done':''}">
    <button class="check sq ${i.done?'on':''}" data-act="toggleItem" data-id="${i.id}" aria-label="${i.done?'Desmarcar':'Tachar'} ${esc(i.name)}"></button>
    ${img?`<img class="ck-ith" src="${imgUrl(img,96)}" alt="" loading="eager">`:`<span class="ck-ith ck-ith0">${i.auto?'🔁':'🛒'}</span>`}
    <div class="row-main" data-act="editItem" data-id="${i.id}"><div class="row-title">${esc(i.name)}${isFav(i.mid||'n:'+i.name,i.listId)?' <span class="ck-star">★</span>':''}</div>${meta.length?`<div class="row-meta">${meta.map(m=>`<span>${m}</span>`).join('')}</div>`:''}
      <div class="ck-irow">${i.done?`<span class="ck-u2">${u} ud</span>`:`<button class="ck-st sm" data-act="itemStep" data-id="${i.id}" data-v="-1" aria-label="${u>1?'Uno menos':'Quitar'}">${u>1?'−':'🗑'}</button><b class="ck-u2">${u}</b><button class="ck-st sm plus" data-act="itemStep" data-id="${i.id}" data-v="1" aria-label="Uno más">+</button>`}<span class="ck-ipr">${i.price?'≈ '+eur(i.price):''}</span></div></div></li>`;
}
// Habituales: los marcados con ☆ (con foto) y los de «cada X días»
function habitSchedule(key,lid=curList().id,item){
  key=String(key);const info=habitInfo(key),p=info.p,name=p?p[1]:item?.name||(info.known?info.name:'');
  if(!name){repairHabit(key,lid);return}
  return replenishmentSheet({name,mid:p?key:item?.mid||(!key.startsWith('n:')?key:''),listId:lid});
}
function repairHabit(key,lid){
  key=String(key);
  const info=habitInfo(key),ov=sheet('Recuperar habitual',`<p>${info.known?esc(info.name)+' ya no aparece en el catálogo actual.':'No se ha podido recuperar el nombre de este habitual.'}</p><p class="hint">Elige el producto para volver a asociarlo a esta lista.</p><div class="ck-actions"><button type="button" class="btn" data-repair-search>Buscar producto</button><button type="button" class="btn sec" data-repair-remove>Quitar de Habituales</button></div><p class="hint" data-repair-status role="status"></p>`,{autoFocus:false});
  ov.querySelector('[data-repair-remove]').onclick=()=>{if(isFav(key,lid))toggleFav(key,lid);ov.remove()};
  ov.querySelector('[data-repair-search]').onclick=async()=>{
    if(!MC)await loadMC();if(!ov.isConnected)return;
    if(!MC){ov.querySelector('[data-repair-status]').textContent='No se puede cargar el catálogo. Revisa la conexión e inténtalo de nuevo.';return}
    ov.remove();productPicker(info.known?info.name:'',p=>{
      const f=favKeys(lid);if(!f.includes(key))return;
      rememberHabit(p.id);
      S.staples.forEach(s=>{if(s.listId===lid&&(String(s.mid)===key||(key.startsWith('n:')&&norm(s.name)===norm(key.slice(2))))){s.mid=p.id;s.name=p.name;s.basePrice=p.price;s.packQty=prodSize(p)}});
      ckSet(favStorageKey(lid),[...new Set(f.map(k=>k===key?p.id:k))]);toast('Habitual recuperado');
    });
  };
}
function habitAdd(key,lid){
  key=String(key);
  const info=habitInfo(key);
  if(!info.known){repairHabit(key,lid);return}
  if(addToList(info.p?{mid:String(key),name:info.p[1],units:1}:{name:info.name,mid:info.manual?'':String(key),units:1},lid))toast('Añadido a la lista');
}
function habSection(L){
  const fv=favKeys(L.id),cards=fv.map(k=>{
    const info=habitInfo(k),p=info.p,name=info.name,inL=info.known&&S.items.find(i=>i.listId===L.id&&!i.done&&(sameItem(i,{mid:p?k:'',name})||String(i.mid)===k));
    return`<div class="ck-hab ${inL?'in':''}"><button type="button" class="link" style="width:100%" data-act="habitSchedule" data-v="${esc(k)}" data-lid="${esc(L.id)}" aria-label="Ver habitual ${esc(name)}">${info.img?`<img data-habit-img src="${imgUrl(info.img,120)}" alt="" loading="eager">`:''}<span class="ck-hab0" role="img" aria-label="Sin imagen" ${info.img?'hidden':''}>🛍️</span></button><button class="link" data-act="habitSchedule" data-v="${esc(k)}" data-lid="${esc(L.id)}" aria-label="Configurar reposición de ${esc(name)}"><b>${esc(name)}</b></button>${p?`<small>${eur(p[3])}</small>`:!info.manual?`<small>${info.known?'Fuera del catálogo actual':'Toca para identificarlo'}</small>`:''}${!p&&info.known&&!info.manual?`<button class="link" data-act="repairHabit" data-v="${esc(k)}" data-lid="${esc(L.id)}">Buscar sustituto</button>`:''}
      ${inL?`<button class="ck-hb on" data-act="itemStep" data-id="${inL.id}" data-v="1" aria-label="Uno más de ${esc(name)}">✓ ${inL.units||1} · +</button>`:`<button class="ck-hb" data-act="habAdd" data-v="${esc(k)}" data-lid="${esc(L.id)}">${info.known?'+ Añadir':'Identificar'}</button>`}</div>`});
  const st=S.staples.filter(s=>s.listId===L.id&&!fv.some(k=>matchesStaple(s,{listId:L.id,mid:k.startsWith('n:')?'':k,name:k.startsWith('n:')?k.slice(2):MC?.byId.get(k)?.[1]||''}))).sort((a,b)=>stapleLeft(a)-stapleLeft(b));
  if(!cards.length&&!st.length)return`<div class="head-row"><h2>⭐ Habituales</h2></div><p class="hint">${L.id===cartList()?'Marca con ☆ los productos que compras siempre (en 🛍️ Productos o tocando un producto de la lista) y aparecerán aquí para añadirlos de un toque.':'Marca con ☆ un producto de «'+esc(L.name)+'» para guardarlo entre los habituales de esta lista.'}</p>`;
  return`<div class="head-row"><h2>⭐ Habituales</h2>${L.id===cartList()?'<button class="link" data-act="ckTab" data-v="productos">+ Buscar</button>':''}</div><div class="staples ck-habs">${cards.join('')}${st.map(stapleCard).join('')}<button class="staple new" data-act="newStaple">+ Habitual</button></div>`;
}
function shopLaterSection(L){
  const entries=(S.shopLater||[]).filter(x=>x.listId===L.id);
  return `<section style="margin-top:18px"><div class="head-row"><h2>📌 Para tener en cuenta</h2><button class="link" data-act="laterEdit">+ Apuntar</button></div><p class="hint">Cosas que quizá queráis comprar más adelante. No cuentan en la cesta ni en los gastos.</p>${entries.length?ul(entries.map(x=>`<li class="row"><button class="row-main" data-act="laterEdit" data-id="${esc(x.id)}" aria-label="Editar ${esc(x.name)}"><span class="row-title">${esc(x.name)}</span>${x.notes?`<span class="row-meta">${esc(x.notes)}</span>`:''}</button><button class="btn sec" data-act="laterMove" data-id="${esc(x.id)}" aria-label="Pasar ${esc(x.name)} a la compra">A la compra</button></li>`)):'<div class="empty">Apunta aquí lo que quieras valorar o comprar en otra ocasión.</div>'}</section>`;
}
function laterEdit(id){
  const entry=(S.shopLater||[]).find(x=>x.id===id),L=curList();
  sheet(entry?'Editar compra para más adelante':'Para tener en cuenta',`<label for="laterName">Qué quieres comprar</label><input class="field" id="laterName" value="${esc(entry?.name||'')}" placeholder="Ej.: Una sartén"><label for="laterNotes">Notas (opcional)</label><textarea class="field" id="laterNotes" placeholder="Medidas, dónde mirarlo, esperar a una oferta…">${esc(entry?.notes||'')}</textarea>`,{onSave:ov=>{
    const name=val(ov,'laterName'),notes=val(ov,'laterNotes');if(!name){toast('Escribe qué quieres comprar');return false}
    if((S.shopLater||[]).some(x=>x.id!==id&&x.listId===L.id&&norm(x.name)===norm(name))){toast('Ya lo tienes apuntado');return false}
    const item={id:entry?entry.id:uid(),listId:entry?entry.listId:L.id,name,notes};S.shopLater=[...(S.shopLater||[]).filter(x=>x.id!==item.id),item];save();toast('Guardado para más adelante');
  },onDelete:entry?()=>{S.shopLater=(S.shopLater||[]).filter(x=>x.id!==id);save();toastUndo('Quitado de Para tener en cuenta')}:null});
}
function laterMove(id){
  const x=(S.shopLater||[]).find(x=>x.id===id);if(!x)return;
  const exists=S.items.some(i=>i.listId===x.listId&&!i.done&&norm(i.name)===norm(x.name));
  if(!exists)S.items.push({id:uid(),listId:x.listId,name:x.name,notes:x.notes,section:S.secMem[norm(x.name)]||'Otros',qty:'',units:1,done:false,added:Date.now()});
  S.shopLater=(S.shopLater||[]).filter(i=>i.id!==id);save();toastUndo(exists?'Ya estaba en la compra; quitado de Para tener en cuenta':'Pasado a la compra');
}

// El historial se calcula al abrir Compras; las preferencias se guardan por
// producto en cook para conservar lo que ajuste cada móvil.
function shoppingModel(){return CasaShoppingRecommendations.build(S,{today:today(),listId:cartList()})}
function shoppingSuggestions(){return shoppingModel().suggestions}
function shoppingSuggestionInfo(x){
  const p=x.mid&&MC?.byId.get(String(x.mid)),stored=!p&&x.mid?habitInfo(x.mid):null;
  return {name:p?.[1]||(stored?.known?stored.name:'')||x.name,img:p?.[9]||stored?.img||'',p:p?prod(p):null};
}
function shoppingSuggestionPhoto(info){return `<span class="shopping-suggestion-photo">${info.img?`<img data-habit-img src="${imgUrl(info.img,96)}" alt="" loading="eager">`:''}<span ${info.img?'hidden':''} aria-hidden="true">🛍️</span></span>`}
function shoppingReminderCard(){
  if(curList().id!==cartList())return '';
  const model=shoppingModel(),{suggestions,stats}=model;
  const open=$('#app [data-shopping-suggestions]')?.open;
  const title=`<summary class="shopping-suggestion-toggle"><h2>¿No se te olvida…?</h2><span class="shopping-suggestion-chevron" aria-hidden="true">⌄</span></summary><div class="shopping-suggestion-content"><div class="shopping-suggestion-heading"><button type="button" class="link" data-act="ckSuggestLearn">Afinar</button></div>`;
  if(!suggestions.length){const upcoming=model.upcoming[0],learning=model.profiles.some(x=>x.status==='learning');return `<details class="card shopping-suggestions" data-shopping-suggestions ${open?'open':''}>${title}<p class="hint">${stats.products?upcoming?'Por ahora no hay nuevas sugerencias. '+esc(shoppingSuggestionInfo(upcoming).name)+' podría tocar en '+upcoming.daysUntil+' día'+(upcoming.daysUntil===1?'':'s')+'.':learning?'Ya hay '+stats.products+' productos en el historial. Puedes indicar cuánto suelen duraros mientras se aprende la frecuencia.':'Las sugerencias se actualizarán con las próximas compras y con tus respuestas.':'Se irá aprendiendo de los tickets que guardes. No hace falta volver a subir los anteriores.'}</p><button type="button" class="shopping-learning-link" data-act="ckSuggestLearn">Ver lo que está aprendiendo${stats.products?' · '+stats.products+' productos':''}</button></div></details>`}
  return `<details class="card shopping-suggestions" data-shopping-suggestions ${open?'open':''}>${title}<p class="hint">Según tus tickets y las compras guardadas. Comprueba si te queda.</p><div class="shopping-suggestion-list">${suggestions.map(x=>{
    const info=shoppingSuggestionInfo(x);return `<article class="shopping-suggestion" data-suggestion-card="${esc(x.key)}"><button type="button" class="shopping-suggestion-main" data-act="ckSuggest" data-v="settings" data-key="${esc(x.key)}" data-lid="${esc(cartList())}" aria-label="Ajustar recomendación de ${esc(info.name)}">${shoppingSuggestionPhoto(info)}<span><strong>${esc(info.name)}</strong><small>${x.custom?'Recordatorio cada':'Lo compras aproximadamente cada'} ${x.interval} días · ${x.referenceOnly?'fecha de referencia':'última compra'} hace ${x.elapsed} días</small><em>${x.inInventory?'Figura en casa: comprueba si queda':x.confidence==='initial'?'Primer patrón: aún hay pocas compras':x.count+' compras en días distintos'}</em></span></button><div class="shopping-suggestion-actions"><button type="button" class="btn" data-act="ckSuggest" data-v="add" data-key="${esc(x.key)}" data-lid="${esc(cartList())}">+ Añadir${x.suggestedUnits>1?' '+x.suggestedUnits:''}</button><button type="button" class="btn sec" data-act="ckSuggest" data-v="have" data-key="${esc(x.key)}" data-lid="${esc(cartList())}">Todavía tengo</button><button type="button" class="link" data-act="ckSuggest" data-v="skip" data-key="${esc(x.key)}" data-lid="${esc(cartList())}">Hoy no</button></div></article>`
  }).join('')}</div><button type="button" class="shopping-learning-link" data-act="ckSuggestLearn">Aprendiendo de ${stats.purchases} compras · ver y ajustar</button></div></details>`;
}
function shoppingSuggestionPreference(x,patch){
  ckSet(CasaShoppingRecommendations.prefKey(x.key),{...x.preference,...patch,updatedAt:Date.now()});
}
function shoppingSuggest(d){
  if(d.lid!==cartList()||curList().id!==cartList())return;
  const x=shoppingModel().profiles.find(p=>p.key===d.key);if(!x)return toast('La sugerencia se ha actualizado.');
  if(d.v==='settings'){shoppingSuggestionDetails(x.key);return}
  if(d.v==='add'){
    if(x.status==='listed')return toast('Ya está en la lista de Súper.');
    if(x.status!=='due')return toast('La sugerencia se ha actualizado.');
    const info=shoppingSuggestionInfo(x),item=info.p?{mid:info.p.id,name:info.p.name,units:x.suggestedUnits}:{name:info.name,mid:x.mid||'',units:x.suggestedUnits,...(x.lastUnitPrice>0?{uprice:x.lastUnitPrice,price:Math.round(x.lastUnitPrice*x.suggestedUnits*100)/100}:{}),store:x.store||'',section:ckSection(null,info.name)};
    // Revalidar por nombre también: un artículo manual ya apuntado no debe
    // duplicarse al quedar identificado con una referencia del catálogo.
    if(S.items.some(i=>i.listId===cartList()&&((x.mid&&String(i.mid||'')===x.mid)||x.names.some(n=>CasaShoppingRecommendations.nameKey(n)===CasaShoppingRecommendations.nameKey(i.name)))))return toast('Ya está en la lista de Súper.');
    if(addToList(item,cartList())){shoppingSuggestionPreference(x,{answer:'add',until:today(),basedOn:x.last});toast('Añadido a Súper'+(x.suggestedUnits>1?' · '+x.suggestedUnits+' envases':''))}return;
  }
  if(!['have','skip'].includes(d.v))return;
  const days=d.v==='have'?Math.max(2,Math.round(x.interval/2)):1;
  shoppingSuggestionPreference(x,{answer:d.v,until:addDays(today(),days-1),basedOn:x.last});
  toast(d.v==='have'?'Lo revisaré dentro de '+days+' días.':'No volverá a aparecer hoy.');
}
function shoppingCoachLayout(ov){
  ov.classList.add('shopping-coach-sheet');const container=ov.querySelector('.sheet'),actions=ov.querySelector('.actions'),body=document.createElement('div');body.className='shopping-coach-body';for(const child of [...container.children])if(child.tagName!=='H3'&&child!==actions)body.append(child);container.insertBefore(body,actions);return ov;
}
function shoppingSuggestionDetails(key,onChange=()=>{}){
  const x=shoppingModel().profiles.find(p=>p.key===key);if(!x)return toast('Este producto ya no está en el historial.');
  return replenishmentSheet({...x,listId:cartList()},onChange);
}

function shoppingLearningSheet(){
  let filter='all';
  const ov=sheet('Aprender de tus compras',`<p class="hint">Los tickets guardados ya cuentan. Aquí puedes ajustar cuánto suele duraros cada producto o recuperar una sugerencia oculta.</p><label for="shoppingLearningSearch">Buscar en tu historial</label><input class="field" id="shoppingLearningSearch" type="search" autocomplete="off" placeholder="Ej.: café"><div class="chips shopping-learning-filters"><button type="button" class="chip on" data-learning-filter="all">Todos</button><button type="button" class="chip" data-learning-filter="muted">Ocultos</button></div><p class="hint" id="shoppingLearningStats"></p><div id="shoppingLearningRows"></div>`,{autoFocus:false});shoppingCoachLayout(ov);
  const labels={due:'Puede tocar reponer',upcoming:'Próximamente',listed:'Ya está en Súper',snoozed:'Lo tienes: recordatorio aplazado',muted:'No se recomienda',learning:'Aprendiendo la frecuencia',dormant:'Hace tiempo que no se compra'};
  function draw(){
    const model=shoppingModel(),q=CasaShoppingRecommendations.nameKey(val(ov,'shoppingLearningSearch')),all=model.profiles.filter(x=>(filter!=='muted'||x.preference.muted)&&(!q||[...x.names,shoppingSuggestionInfo(x).name].some(name=>CasaShoppingRecommendations.nameKey(name).includes(q))));all.sort((a,b)=>b.last.localeCompare(a.last)||a.name.localeCompare(b.name));
    ov.querySelector('#shoppingLearningStats').textContent=model.stats.purchases+' compras guardadas · '+model.stats.products+' productos'+(all.length>40?' · se muestran 40: afina la búsqueda':'');
    ov.querySelector('#shoppingLearningRows').innerHTML=all.slice(0,40).map(x=>{const info=shoppingSuggestionInfo(x);return `<button type="button" class="shopping-learning-row" data-learning-product="${esc(x.key)}">${shoppingSuggestionPhoto(info)}<span><strong>${esc(info.name)}</strong><small>${labels[x.status]} · ${x.count} compra${x.count===1?'':'s'}${x.interval?' · '+x.interval+' días':''}</small></span><b aria-hidden="true">›</b></button>`}).join('')||'<p class="hint">'+(filter==='muted'?'No hay productos ocultos.':q?'No hay coincidencias en las compras guardadas.':'Aparecerán productos al guardar tickets con artículos.')+'</p>';
  }
  ov.querySelector('#shoppingLearningSearch').addEventListener('input',draw);
  ov.addEventListener('click',e=>{const option=e.target.closest('[data-learning-filter]');if(option){filter=option.dataset.learningFilter;ov.querySelectorAll('[data-learning-filter]').forEach(b=>b.classList.toggle('on',b===option));draw();return}const product=e.target.closest('[data-learning-product]');if(product)shoppingSuggestionDetails(product.dataset.learningProduct,draw)});
  draw();return ov;
}

function vCompras(){
  loadMC();
  const L=curList(),items=S.items.filter(i=>i.listId===L.id),pend=items.filter(i=>!i.done),dn=items.filter(i=>i.done),total=items.reduce((n,i)=>n+(Number(i.price)||0),0);
  let h=`<h1>Compras</h1><p class="sub">${esc(L.name)}: ${pend.length} por comprar${dn.length?' · '+dn.length+' en el carro':''}</p>`+ckSubTabs();
  h+=`<div class="chips shop-lists">${S.lists.map(l=>`<button class="chip ${l.id===L.id?'on':''}" data-act="pickList" data-v="${l.id}">${esc(l.name)}</button>`).join('')}</div>`;
  h+=`<div class="shop-current"><div><small>Cesta actual · estimación</small><strong>≈ ${eur(total)}</strong>${dn.length?`<small>En el carro: ${eur(dn.reduce((n,i)=>n+(Number(i.price)||0),0))}</small>`:''}</div><button type="button" class="link" data-act="shopAddFocus">+ Añadir</button>${dn.length?`<button class="btn" data-act="clearDone">Terminar (${dn.length})</button>`:''}</div>`;
  const secs=[...S.sections,...new Set(items.map(i=>i.section).filter(s=>s&&!S.sections.includes(s)))],rows=[];
  secs.forEach(sec=>{const group=items.filter(i=>(i.section||'Otros')===sec);if(group.length){rows.push(`<li class="sec-head">${esc(sec)} · ${group.length}</li>`);rows.push(...group.map(itemRow))}});
  h+=rows.length?`<div class="shop-product-list">${ul(rows)}</div>`:'<div class="empty">Lista vacía. Añade productos o elige tus habituales.</div>';
  if(dn.length)h+='<p class="hint">Al terminar, puedes subir el ticket para comprobar la compra y actualizar lo que hay en casa.</p>';
  h+=`<div class="ck-add2"><div class="quick" style="margin-top:12px"><input class="field" id="qItem" placeholder="Añadir producto (busca en Mercadona)" enterkeyhint="done" autocomplete="off" style="flex:2"><input class="field" id="qQty" placeholder="Cant." style="flex:.7"><button class="btn" data-act="quickItem" aria-label="Añadir producto">+</button></div>
    <div id="qSug" class="ck-qsug"></div>
    <select class="field" id="qSec" style="margin-top:8px">${S.sections.map(s=>`<option ${s===ui.lastSec?'selected':''}>${esc(s)}</option>`).join('')}</select></div>`;
  h+=`<button class="btn sec" style="margin-top:12px" data-act="shopPhoto">📷 Añadir producto con foto</button>`;
  h+=habSection(L);

  h+=shoppingReminderCard();
  const expanded=$('#app [data-shop-money]')?.open;
  h+=`<details class="shop-money" data-shop-money ${expanded?'open':''}><summary>Gastos, tickets y herramientas</summary>${moneyCard(pend)}<button class="btn sec" data-act="newList">+ Lista</button><button class="btn sec" data-act="editList" data-id="${L.id}">Editar lista</button></details>`;
  return h+shopLaterSection(L)+histLink();
}
const histLink=()=>pendingReceiptsHTML()+((S.buys||[]).length?`<button class="btn sec" style="width:100%;margin-top:12px" data-act="ckBuys">🧾 Historial de compras · repetir una compra</button>`:'');
// Añadir a la lista sin duplicar: si ya está, ofrece sumar una unidad
function addToList(o,lid){
  const L=lid||curList().id,ex=S.items.find(i=>i.listId===L&&!i.done&&sameItem(i,o));
  if(ex){sheet('Ya está en la lista',`<p>«${esc(ex.name)}» ya está en la lista (${ex.units||1} ud).</p>`,{saveLabel:'Sumar una más',onSave:()=>{const x=find(S.items,ex.id);if(!x)return;setUnits(x,(x.units||1)+1);save();toast(x.name+': '+x.units+' ud')}});return false}
  if(o.mid&&MC&&MC.byId.get(o.mid)){cartSet(prod(MC.byId.get(o.mid)),o.units||1,L)}
  else S.items.push(Object.assign({id:uid(),listId:L,section:S.secMem[norm(o.name)]||'Otros',qty:'',by:'',done:false,units:1,added:Date.now()},o));
  save();return true;
}
function quickItem(){
  const el=$('#qItem');if(!el)return;const v=el.value.trim();if(!v)return;
  const sec=$('#qSec').value;ui.lastSec=sec;
  if(addToList({name:v,qty:$('#qQty').value.trim(),section:sec})){S.secMem[norm(v)]=sec;const current=$('#qItem');if(current)current.value='';$('#qQty').value='';const b=$('#qSug');if(b)b.innerHTML='';save()}
}
// Sugerencias de Mercadona mientras se escribe en «Añadir producto»
function drawQSug(){
  const el=$('#qItem'),box=$('#qSug');if(!el||!box)return;const q=el.value.trim();
  if(q.length<2||!MC){box.innerHTML='';return}
  const a=searchProducts(q,5);
  box.innerHTML=a.map(p=>`<button type="button" class="ck-qs" data-act="sugAdd" data-id="${p.id}"><img src="${imgUrl(p.img,72)}" alt="" loading="eager"><span><b>${esc(p.name)}</b><small>${prodSize(p)} · ${eur(p.price)}</small></span><span class="ck-qs-b">+</span></button>`).join('')+
    `<button type="button" class="ck-qs" data-act="quickItem"><span class="ck-ith0">✏️</span><span><b>Añadir «${esc(q)}» tal cual</b></span></button>`;
}

/* ---------- gasto: compras registradas, gastos a mano e historial ---------- */
// Compra en el mercadillo: importe y, si queréis, qué habéis comprado (cuenta en el gasto de la semana y del mes)
const CK_MARKET=['Tomates','Pimientos','Calabacín','Berenjena','Cebollas','Patatas','Lechuga','Pepino','Zanahorias','Judías verdes','Ajos','Fruta'];
function marketSheet(){
  const recent=[...new Set((S.buys||[]).filter(b=>b.store==='Mercadillo').flatMap(b=>buyItems(b).map(x=>x.name)))].filter(x=>!CK_MARKET.includes(x)).slice(0,8);
  const ov=sheet('🧺 Compra en el mercadillo',`<label for="f_a">Importe total (€)</label><input class="field" id="f_a" type="text" inputmode="decimal" placeholder="0,00" autocomplete="off">
    <label for="f_d">Fecha</label><input class="field" id="f_d" type="date" value="${today()}" max="${today()}">
    <label>¿Qué habéis comprado? (opcional)</label><div class="ck-wrap" id="f_v">${[...CK_MARKET,...recent].map(v=>`<button type="button" class="chip" data-v="${esc(v)}">${esc(v)}</button>`).join('')}</div>
    <input class="field" id="f_o" style="margin-top:8px" placeholder="Otras cosas, separadas por comas">
    <label class="ing-row" style="display:flex;margin-top:12px;color:var(--ink);font-weight:500;font-size:.95rem"><input type="checkbox" id="f_h"><span>Apuntarlo también en 🏠 En casa (nevera)</span></label>
    <p class="hint">Se resta del presupuesto de la semana y del mes. Lo podéis editar o borrar desde el historial.</p>`,
  {saveLabel:'Guardar y recordar el ticket',onSave:ov=>{
    const a=parseFloat(String(val(ov,'f_a')).replace(',','.'));if(!(a>0)){toast('Escribe el importe');return false}
    const names=[...new Set([...[...ov.querySelectorAll('#f_v .chip.on')].map(b=>b.dataset.v),...val(ov,'f_o').split(',').map(x=>x.trim()).filter(Boolean).map(x=>x[0].toUpperCase()+x.slice(1))])];
    S.buys=[...(S.buys||[]),{id:uid(),at:Date.now(),manual:true,market:true,date:val(ov,'f_d')||today(),store:'Mercadillo',total:Math.round(a*100)/100,n:names.length,items:names.map(name=>({name,units:1})),note:'',by:meName()}];
    let h=0;if(ov.querySelector('#f_h').checked)names.forEach(name=>{const x=pantryFind(name);if(x){if(!(x.n>0))x.n=x.u==='ud'?1:500;x.at=today();h++}else{S.pantry=[...(S.pantry||[]),{id:uid(),name,n:1,u:'ud',min:0,loc:'Nevera',mid:'',auto:false,at:today()}];h++}});
    save();toast('🧺 Mercadillo: '+eur(a)+(h?' · '+h+' en casa':''));
  }});
  ov.querySelector('#f_v').addEventListener('click',e=>{const b=e.target.closest('[data-v]');if(b)b.classList.toggle('on')});
}
function spendSheet(b){
  const n=!b,c=ck();b=b||{date:today(),store:ui.store||'Mercadona',total:'',note:''};
  sheet(n?'Añadir gasto de compra':'Editar gasto',`<p class="hint" style="margin-top:0">Para cuando habéis comprado sin apuntar los productos. No cambia la lista ni lo que hay en casa.</p>
    <label for="f_a">Importe total (€)</label><input class="field" id="f_a" type="text" inputmode="decimal" value="${b.total?String(b.total).replace('.',','):''}" placeholder="0,00" autocomplete="off">
    <div class="grid2"><div><label for="f_d">Fecha</label><input class="field" id="f_d" type="date" value="${esc(b.date)}" max="${today()}"></div>
    <div><label for="f_s">Supermercado</label><select class="field" id="f_s">${opt([...new Set([...c.stores,b.store])].map(x=>[x,x]),b.store)}</select></div></div>
    <label for="f_n">Nota (opcional)</label><input class="field" id="f_n" value="${esc(b.note||'')}" placeholder="Ej.: compra del finde">`,
  {saveLabel:n?'Añadir gasto':'Guardar',onSave:ov=>{
    const a=parseFloat(String(val(ov,'f_a')).replace(',','.'));if(!(a>0)){toast('Escribe el importe');return false}
    const o={date:val(ov,'f_d')||today(),store:val(ov,'f_s'),total:Math.round(a*100)/100,note:val(ov,'f_n')};
    if(n)S.buys=[...(S.buys||[]),Object.assign({id:uid(),at:Date.now(),manual:true,n:0,items:[],by:meName()},o)];
    else{const x=find(S.buys,b.id);if(x)Object.assign(x,o)}
    save();toast(n?'Gasto añadido: '+eur(o.total):'Gasto actualizado');
  },onDelete:n?null:()=>{S.buys=S.buys.filter(x=>x.id!==b.id);save();toastUndo('Gasto eliminado')}});
}
const buyItems=b=>(b.items||[]).map(x=>typeof x==='string'?{name:x}:x);
const repeatableBuyItem=x=>!!x&&typeof x.name==='string'&&!!x.name.trim()&&!(x.price<0||x.unitPrice<0||x.units<0);
const repeatBuyItem=(x,units=1)=>({name:x.name,mid:x.mid&&MC?.byId.has(x.mid)?x.mid:'',units,qty:x.qty||''});
const buyFavKey=x=>x.mid&&MC?.byId.has(x.mid)?x.mid:'n:'+x.name;
function buyProductSheet(x,list,onChange=()=>{}){
  if(!repeatableBuyItem(x))return;
  const p=x.mid&&MC?.byId.get(x.mid),key=buyFavKey(x);
  const inList=()=>S.items.some(i=>i.listId===list.id&&!i.done&&sameItem(i,repeatBuyItem(x)));
  const ov=sheet('Producto del ticket',`${p?productSheetPhoto(p[9],x.name):''}<p><b>${esc(x.name)}</b></p><p class="hint">${x.price!==undefined?eur(x.price)+' pagado en aquel ticket. ':''}${p?eur(p[3])+' por envase hoy. ':''}Se añadirá a «${esc(list.name)}».</p><label for="historyProductUnits">Cantidad para la cesta</label><input class="field" id="historyProductUnits" type="number" inputmode="numeric" min="1" max="99" step="1" value="1"><div class="ck-actions" style="margin-top:12px"><button type="button" class="btn" data-history-add>🛒 Añadir a la cesta</button><button type="button" class="btn sec" data-history-fav></button></div><p class="hint" data-history-status role="status" aria-live="polite"></p>`,{autoFocus:false});
  ov.querySelector('[data-s="cancel"]').textContent='Volver al ticket';
  ov.querySelector('[data-history-status]').insertAdjacentHTML('beforebegin',`<details class="house-price-fold"><summary>Precios anteriores</summary>${housePriceHTML({name:x.name,mid:x.mid||''})}</details>`);
  const update=()=>{const add=ov.querySelector('[data-history-add]'),fav=ov.querySelector('[data-history-fav]');add.disabled=inList();add.textContent=add.disabled?'✓ Ya está en la cesta':'🛒 Añadir a la cesta';fav.textContent=isFav(key,list.id)?'★ Quitar de Habituales':'☆ Guardar en Habituales';fav.setAttribute('aria-pressed',String(isFav(key,list.id)))};
  ov.querySelector('[data-history-add]').addEventListener('click',()=>{
    const quantity=Number(ov.querySelector('#historyProductUnits').value),status=ov.querySelector('[data-history-status]');
    if(!Number.isInteger(quantity)||quantity<1||quantity>99){status.textContent='Indica de 1 a 99 unidades.';return}
    if(!S.lists.some(l=>l.id===list.id)){status.textContent='Esta lista ya no existe. Vuelve a Compras para elegir otra.';return}
    if(inList()){update();return}
    if(addToList(repeatBuyItem(x,quantity),list.id)){status.textContent='Añadido a «'+list.name+'».';toast('Producto añadido a la cesta')}
    update();onChange();
  });
  ov.querySelector('[data-history-fav]').addEventListener('click',()=>{toggleFav(key,list.id);update();onChange();ov.querySelector('[data-history-status]').textContent=isFav(key,list.id)?'Guardado en Habituales de «'+list.name+'».':'Quitado de Habituales de «'+list.name+'».'});
  update();
  return ov;
}
function buysSheet(){
  const all=(S.buys||[]).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.at||0)-(a.at||0));
  const months=[...new Set(all.map(b=>monthKey(b.date)))];
  const ov=sheet('Historial de compras',`${houseSpendingHTML(monthKey())}<button type="button" class="btn sec" data-k="add" style="width:100%">+ Añadir gasto de compra</button>
    ${months.map(m=>{const bs=all.filter(b=>monthKey(b.date)===m);return`${m===monthKey()?'':houseSpendingHTML(m)}<h4>${esc(monthName(m))} · ${eur(spentIn(m))}</h4><div class="ck-box">${bs.map(b=>`<button type="button" class="ck-buy ck-bh" data-b="${b.id}"><span><b>${b.store==='Mercadillo'?'🧺 ':''}${esc(b.store||'—')}</b> · ${relDate(b.date)}${b.receiptPending?' · <small>📷 Ticket pendiente</small>':b.voided?' · <small>Anulada</small>':b.market?'':b.manual?' · <small>a mano</small>':b.ticket?' · <small>🧾 tique</small>':''}<br><small>${b.note?esc(b.note)+' · ':''}${buyItems(b).length?buyItems(b).length+' producto'+(buyItems(b).length>1?'s':''):'sin productos'}</small></span><b>${b.total?eur(b.total):'<small>sin importe</small>'}</b></button>`).join('')}</div>`}).join('')||'<p class="hint">Aún no hay compras registradas.</p>'}`,{});
  ov.addEventListener('click',e=>{if(e.target.closest('[data-k="add"]')){ov.remove();spendSheet();return}
    const b=e.target.closest('[data-b]');if(b){ov.remove();buyDetail(find(S.buys,b.dataset.b))}});
}
// Una compra del historial: ver, editar, borrar o repetir productos (sin volver a contar el gasto)
function buyDetail(b){
  if(!b)return;const its=buyItems(b),L=curList();
  const inList=x=>S.items.some(i=>i.listId===L.id&&!i.done&&sameItem(i,repeatBuyItem(x)));
  const ov=sheet((b.store||'Compra')+' · '+parse(b.date).toLocaleDateString('es-ES',{day:'numeric',month:'long'}),`
    <div class="ck-total"><span>Pagado</span><b>${b.total?eur(b.total):'sin importe'}</b><small>${b.manual?'Gasto añadido a mano':b.ticket?'Registrado con tique':'Registrado al terminar la compra'}${b.by?' · '+esc(b.by):''}${b.note?' · '+esc(b.note):''}</small></div>
    ${its.length?`<h4>Productos de la compra</h4><p class="hint" style="margin-top:0">Toca un producto para añadirlo a la cesta o guardarlo en Habituales. Usa las casillas para repetir varios en «${esc(L.name)}».</p>
      <div class="ck-box">${its.map((x,k)=>{const p=x.mid&&MC&&MC.byId.get(x.mid),dup=inList(x),canRepeat=repeatableBuyItem(x);return`<div class="ing-row history-product-row">${canRepeat?`<input type="checkbox" data-r="${k}" aria-label="Repetir ${esc(x.name)}" ${dup?'disabled':'checked'}>`:''}<${canRepeat?'button type="button"':'div'} class="history-product-pick" ${canRepeat?`data-history-product="${k}" aria-label="Ver opciones de ${esc(x.name)}"`:''}>${p?`<img class="ck-th" src="${imgUrl(p[9],72)}" alt="">`:''}<span>${esc(x.name)}${x.units>1?' <small>× '+x.units+'</small>':''}<br><small>${x.price!==undefined?eur(x.price)+' pagado · ':''}<span data-history-meta="${k}">${dup?'Ya está en la cesta':canRepeat?(p?eur(p[3])+' hoy':''):'Ajuste del ticket'}</span></small></span>${canRepeat?'<b aria-hidden="true">›</b>':''}</${canRepeat?'button':'div'}></div>`}).join('')}</div>`:'<p class="hint">Esta compra no tiene productos apuntados.</p>'}
    ${b.receiptPending?'<button type="button" class="btn" data-k="receipt">📷 Comprobar con el ticket</button>':''}${b.ticket?`<details><summary>Ver foto del ticket</summary><p class="hint">Guardada en el dispositivo donde se subió.</p><div data-receipt-photo>Cargando foto…</div></details>${b.voided?'<p>Compra anulada: no cuenta como gasto.</p>':''}`:''}<div class="ck-actions" style="margin-top:12px">${!b.voided?'<button type="button" class="btn sec" data-k="edit">✏️ Editar gasto</button>':''}${b.ticket&&b.undoJournal&&!b.voided?'<button type="button" class="btn sec" data-k="undo">Deshacer importación</button>':''}${its.length?`<button type="button" class="btn" data-k="again">🔁 Añadir a la lista</button>`:''}</div>`,{});
  if(b.ticket)receiptHistoryPhoto(b,ov);
  const refresh=()=>{its.forEach((x,index)=>{const cb=ov.querySelector(`[data-r="${index}"]`),meta=ov.querySelector(`[data-history-meta="${index}"]`);if(!cb)return;const dup=inList(x),p=x.mid&&MC?.byId.get(x.mid);cb.disabled=dup;if(dup)cb.checked=false;if(meta)meta.textContent=[dup?'Ya está en la cesta':p?eur(p[3])+' hoy':'',isFav(buyFavKey(x),L.id)?'★ Habitual':''].filter(Boolean).join(' · ')})};
  refresh();
  ov.addEventListener('click',e=>{const product=e.target.closest('[data-history-product]');if(product){buyProductSheet(its[+product.dataset.historyProduct],L,refresh);return}const k=e.target.closest('[data-k]');if(!k)return;
    if(k.dataset.k==='receipt'){ov.remove();ticketFlow({pendingId:b.id});return}
    if(k.dataset.k==='undo'){undoReceipt(b,ov);return}
    if(k.dataset.k==='edit'){ov.remove();spendSheet(b);return}
    if(k.dataset.k==='again'){let n=0;ov.querySelectorAll('[data-r]').forEach(cb=>{if(!cb.checked||cb.disabled)return;const x=its[+cb.dataset.r];if(!repeatableBuyItem(x)||inList(x))return;
      if(x.mid&&MC&&MC.byId.get(x.mid))cartSet(prod(MC.byId.get(x.mid)),x.units||1,L.id);else S.items.push({id:uid(),listId:L.id,name:x.name,mid:repeatBuyItem(x).mid,qty:x.qty||'',section:S.secMem[norm(x.name)]||'Otros',by:'',done:false,units:x.units||1,added:Date.now()});n++});
      ov.remove();save();toast(n?n+' producto'+(n>1?'s':'')+' añadido'+(n>1?'s':'')+' a la lista':'Nada nuevo que añadir')}});
}
// Productos de una compra para el historial (sirven para repetirla)
const buyLines=items=>items.slice(0,80).map(i=>({name:i.name,mid:i.mid||'',units:i.units||1,qty:i.mid?'':i.qty||''}));

// Al quitar lo comprado: dónde y cuánto se ha pagado
function buySheet(items,done){
  const cartItemIds=items.map(i=>i.id),draft=(S.buys||[]).find(b=>b.receiptPending&&b.cartItemIds?.length===cartItemIds.length&&cartItemIds.every(id=>b.cartItemIds.includes(id)));
  const c=ck();let store=ui.store&&c.stores.includes(ui.store)?ui.store:'Mercadona';
  const est=()=>'';const hint=i=>{const up=(S.prices||{})[norm(i.name)];return up&&up.store===store&&up.price?'pagaste '+eur(up.price):i.price?'≈ '+eur(i.price):''};
  const ov=sheet('Terminar la compra',`<p>Haz una foto del ticket para comprobar todos los productos, también los que añadiste al carro sin apuntarlos.</p><p class="hint">Si lo dejas para después, quedará un aviso pendiente en Casa.</p><button type="button" class="btn" data-k="tk" style="width:100%;margin-bottom:12px">📷 Subir foto o PDF del tique</button><div class="chips ck-wrap" id="f_sto">${c.stores.map(x=>`<button type="button" class="chip ${x===store?'on':''}" data-sto="${esc(x)}">${esc(x)}</button>`).join('')}</div>
    <p class="hint">Apunta lo que habéis pagado (opcional): el total del tique abajo o cada cosa. Lo que no apuntes no cuenta como gastado; las cifras «≈» son solo estimaciones.</p>
    <div class="ck-box" id="f_its">${items.map((i,n)=>`<div class="ck-buy"><span><b>${esc(i.name)}</b><br><small>${esc([i.qty,hint(i)].filter(Boolean).join(' · '))}</small></span><input class="field" data-pr="${n}" type="number" inputmode="decimal" step="0.01" min="0" placeholder="€"></div>`).join('')}</div>
    <div class="ck-total"><span>Total</span><b id="f_tot"></b></div>
    <label for="f_tk">Total pagado (si no apuntas cada cosa)</label><input class="field" id="f_tk" type="number" inputmode="decimal" step="0.01" min="0" placeholder="€">`,
  {saveLabel:'Guardar y recordar el ticket',onSave:ov=>{
    let tot=0,priced=0;
    ov.querySelectorAll('[data-pr]').forEach(inp=>{const i=items[+inp.dataset.pr],pr=parseFloat(inp.value);if(!(pr>0))return;tot+=pr;priced++;
      const q=parseQty(i.qty);let n=i.pq&&i.pq.n||0,d=i.pq&&i.pq.d||'m';
      if(q&&!(i.pq&&i.qty&&/×/.test(i.qty))){n=q.n;d=q.d}
      if(store!=='Mercadona'||(S.prices||{})[norm(i.name)])savePrice(i.name,{store,price:pr,n,d,qtxt:i.qty})});
    const tk=parseFloat(val(ov,'f_tk'));if(tk>0)tot=tk;
    // Solo cuenta como gasto lo que se apunta como pagado (nunca la estimación)
    const record=Object.assign(draft||{id:uid(),date:today(),at:Date.now()},{store,total:Math.round(tot*100)/100,n:items.length,items:buyLines(items),by:meName(),receiptPending:true,pendingInventory:[],cartItemIds});if(!draft)S.buys=[...(S.buys||[]),record];
    ui.store=store;mcCache.clear();done(store,false,record);toast('Compra guardada. Ticket pendiente de comprobar.');
  }});
  const sum=()=>{let t=0;ov.querySelectorAll('[data-pr]').forEach(i=>{t+=parseFloat(i.value)||0});ov.querySelector('#f_tot').textContent=eur(t)};
  sum();ov.querySelector('#f_its').addEventListener('input',sum);
  ov.querySelector('[data-k="tk"]').addEventListener('click',()=>{const record=draft||{id:uid(),date:today(),at:Date.now(),store,total:0,n:items.length,items:buyLines(items),by:meName(),receiptPending:true,pendingInventory:[],cartItemIds};if(!draft)S.buys=[...(S.buys||[]),record];save();ov.remove();ticketFlow({pendingId:record.id})});
  ov.querySelector('#f_sto').addEventListener('click',ev=>{const b=ev.target.closest('[data-sto]');if(!b)return;store=b.dataset.sto;
    ov.querySelectorAll('[data-sto]').forEach(x=>x.classList.toggle('on',x===b));
    ov.querySelectorAll('[data-pr]').forEach(inp=>{inp.value=est(items[+inp.dataset.pr])});sum()});
  const skip=document.createElement('button');skip.type='button';
  skip.className='link';skip.textContent='Terminar sin apuntar lo pagado';skip.style.cssText='display:block;margin:14px auto 0';
  skip.onclick=()=>{ov.remove();done('')};ov.querySelector('.actions').after(skip);
}

/* ---------- IA (Claude): fotos de la nevera ---------- */
// La clave se guarda solo en este móvil (no va a la nube ni a las copias de seguridad)
const AI_MODEL='claude-opus-5-5',AI_LS='casa-ai-key';
const aiKey=()=>{try{return localStorage.getItem(AI_LS)||''}catch(e){return''}};
function aiKeySheet(then){
  sheet('Activar la IA',`<p class="hint" style="margin-top:0">Para reconocer alimentos en fotos, la app usa Claude, la IA de Anthropic. Necesita una clave de API:</p>
    <ol class="hint" style="padding-left:18px;line-height:1.5"><li>Entra en <a href="https://platform.claude.com" target="_blank" rel="noopener">platform.claude.com</a> y crea una cuenta.</li><li>Añade saldo (con 5 € hay para cientos de fotos y recetas).</li><li>En «API Keys» crea una clave y pégala aquí.</li></ol>
    <label for="f_k">Clave de API</label><input class="field" id="f_k" type="password" autocomplete="off" placeholder="sk-ant-…" value="${esc(aiKey())}">
    <p class="hint">Se guarda solo en este móvil. El reconocimiento de fotos consume saldo de la API.</p>`,
  {saveLabel:'Guardar',onSave:ov=>{const k=val(ov,'f_k');if(k&&!/^sk-ant-/.test(k)){toast('La clave empieza por «sk-ant-»');return false}
    try{k?localStorage.setItem(AI_LS,k):localStorage.removeItem(AI_LS)}catch(e){}toast(k?'IA activada en este móvil':'IA desactivada');render();if(k&&then)then()}});
}
// Una llamada a Claude que devuelve un objeto JSON
async function askClaude(content){
  const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':aiKey(),'anthropic-version':'2026-10-21','anthropic-beta':'server-side-fallback-2026-07-01','anthropic-dangerous-direct-browser-access':'true'},
    body:JSON.stringify({model:AI_MODEL,max_tokens:16000,fallbacks:'default',output_config:{effort:'low'},messages:[{role:'user',content}]})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(r.status===401?'La clave de la IA no es válida (revísala en Ajustes)':r.status===429?'Demasiadas peticiones seguidas: espera un minuto':/credit|balance/i.test(d.error&&d.error.message||'')?'No queda saldo en tu cuenta de Claude':'Error de la IA ('+r.status+')');
  if(d.stop_reason==='refusal')throw new Error('La IA no ha podido responder a esto');
  const t=(d.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
  const m=t.match(/\{[\s\S]*\}/);if(!m)throw new Error('La IA no ha devuelto datos');
  return JSON.parse(m[0]);
}
// Foto reducida a 1568 px en JPEG (más rápida y más barata)
function photoB64(file){return new Promise((ok,ko)=>{const img=new Image();const u=URL.createObjectURL(file);
  img.onload=()=>{const k=Math.min(1,1568/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
    c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);ok(c.toDataURL('image/jpeg',.85).split(',')[1])};
  img.onerror=()=>{URL.revokeObjectURL(u);ko(new Error('No se ha podido abrir la foto'))};img.src=u})}
function pickPhotos(){return new Promise(ok=>{const i=document.createElement('input');i.type='file';i.accept='image/*';i.multiple=true;i.style.display='none';
  i.onchange=()=>{ok([...i.files]);i.remove()};document.body.appendChild(i);i.click()})}
function aiWait(title,msg){return sheet(title,`<div class="ck-ai-wait"><span class="ck-spin"></span><p class="hint">${esc(msg)}</p></div>`,{})}

async function photoFlow(){
  if(!aiKey()){aiKeySheet(photoFlow);return}
  const loc=await new Promise(ok=>{const ov=sheet('¿Qué vas a fotografiar?',`<div class="ck-actions">${[['Nevera','❄️ Nevera'],['Despensa','🥫 Despensa'],['Congelador','🧊 Congelador']].map(([k,l])=>`<button type="button" class="btn sec" data-l="${k}">${l}</button>`).join('')}</div><p class="hint">Puedes elegir varias fotos a la vez (por ejemplo, una por estante).</p>`,{});
    ov.addEventListener('click',e=>{const b=e.target.closest('[data-l]');if(b){ov.remove();ok(b.dataset.l)}})});
  const files=await pickPhotos();if(!files.length)return;
  const w=aiWait('Mirando las fotos…','La IA está buscando los alimentos. Tarda unos segundos.');
  let res;
  try{
    const imgs=await Promise.all(files.slice(0,6).map(photoB64));
    res=await askClaude([...imgs.map(data=>({type:'image',source:{type:'base64',media_type:'image/jpeg',data}})),{type:'text',text:
`Estas fotos son de la ${loc.toLowerCase()} de una casa en España. Haz inventario de los alimentos y productos de cocina que se ven.
Para cada uno: nombre corto en español como se llamaría en el súper (p. ej. «Leche semidesnatada», «Yogur natural», «Pimiento rojo»), cuántas unidades o envases se ven, y si es un envase empezado, cuánto queda aproximadamente.
Devuelve solo un JSON con esta forma, sin texto alrededor:
{"items":[{"name":"Leche semidesnatada","count":2,"size":"1 l","unit":"ml","amount":1500,"loc":"${loc}","search":"leche semidesnatada","note":"una está empezada"}]}
- "unit" es "g", "ml" o "ud". "amount" es la cantidad total que hay en esa unidad (suma de todos los envases, contando lo que queda en los empezados).
- "loc" es "Nevera", "Despensa" o "Congelador".
- No inventes lo que no se ve con claridad; si dudas de la marca, no la pongas.`}]);
  }catch(e){w.remove();toast(e.message||'No se ha podido analizar la foto');return}
  w.remove();
  const items=(res.items||[]).filter(x=>x&&x.name);
  if(!items.length){toast('No he reconocido alimentos en la foto');return}
  photoReview(items);
}
function photoReview(items){
  const pans=(S.pantry||[]).slice().sort((a,b)=>a.name.localeCompare(b.name,'es'));
  const rows=items.map((a,i)=>{const x=pantryFind(a.name),p=searchMC(a.search||a.name,1)[0];const u=['g','ml','ud'].includes(a.unit)?a.unit:'ud';
    return`<div class="ck-tl"><div class="ck-tl-h"><input type="checkbox" data-on="${i}" aria-label="Incluir artículo ${i+1}" checked><input class="field" data-nm="${i}" aria-label="Nombre del artículo ${i+1}" value="${esc(a.name)}"><input class="field" data-am="${i}" type="number" min="0" step="any" value="${Math.round((+a.amount||+a.count||1)*10)/10}" style="width:76px;flex:none;text-align:right"><select class="field" data-un="${i}" style="width:66px;flex:none;padding-left:6px">${opt([['g','g'],['ml','ml'],['ud','ud']],u)}</select></label>
      <small>${a.count?a.count+' × '+esc(a.size||''):''}${a.note?' · '+esc(a.note):''}${p?' · '+esc(p.name):''}</small>
      <select class="field" data-pn="${i}"><option value="new">➕ Nuevo en ${esc(a.loc||'Despensa')}</option>${pans.map(y=>`<option value="${y.id}" ${x&&x.id===y.id?'selected':''}>🔄 Actualizar: ${esc(y.name)}</option>`).join('')}</select></div>`});
  sheet('He encontrado '+items.length+' producto'+(items.length>1?'s':''),`<p class="hint" style="margin-top:0">Revisa lo que ha visto la IA: corrige nombres o cantidades y desmarca lo que no sea. Lo que ya tenías se actualiza con la cantidad de la foto.</p><div id="f_tl">${rows.join('')}</div>`,
  {saveLabel:'Guardar en casa',onSave:ov=>{let nu=0,up=0;
    ov.querySelectorAll('[data-on]').forEach(cb=>{if(!cb.checked)return;const i=+cb.dataset.on,a=items[i];
      const nm=ov.querySelector(`[data-nm="${i}"]`).value.trim()||a.name,am=parseFloat(ov.querySelector(`[data-am="${i}"]`).value)||0,u=ov.querySelector(`[data-un="${i}"]`).value,pv=ov.querySelector(`[data-pn="${i}"]`).value;
      const p=searchMC(a.search||nm,1)[0];
      if(pv!=='new'){const x=find(S.pantry||[],pv);if(x){const n=pUnit(x)===(u==='ud'?'ud':'m')?am:(()=>{const w=unitW(x.name);return w?(u==='ud'?am*w:am/w):am})();x.n=Math.round(n*10)/10;x.full=Math.max(x.full||0,x.n);x.at=today();up++}}
      else{S.pantry=[...(S.pantry||[]),{id:uid(),name:nm,n:am,u,full:Math.max(am,p&&prod(p).d===(u==='ud'?'ud':'m')?prod(p).size:0),min:0,loc:['Nevera','Despensa','Congelador'].includes(a.loc)?a.loc:'Despensa',mid:p?p.id:'',auto:false,at:today()}];nu++}
    });
    save();toastUndo(`En casa: ${nu} nuevo${nu===1?'':'s'}, ${up} actualizado${up===1?'':'s'}`);
  }});
}

/* ---------- tique: foto o PDF → precios, despensa y gasto ---------- */
const loadJS=src=>new Promise((ok,ko)=>{if(document.querySelector(`script[src="${src}"]`)){ok();return}const x=document.createElement('script');x.src=src;x.onload=ok;x.onerror=ko;document.head.appendChild(x)});
function pickFile(accept){return new Promise(ok=>{const i=document.createElement('input');i.type='file';i.accept=accept;i.style.display='none';
  i.onchange=()=>{ok(i.files[0]||null);i.remove()};document.body.appendChild(i);i.click()})}
async function pdfText(file){
  await loadJS('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;const out=[];
  for(let n=1;n<=pdf.numPages;n++){
    const items=(await (await pdf.getPage(n)).getTextContent()).items.filter(t=>t.str.trim());
    const rows=[];items.forEach(t=>{const y=t.transform[5];let r=rows.find(r=>Math.abs(r.y-y)<3);if(!r){r={y,a:[]};rows.push(r)}r.a.push(t)});
    rows.sort((a,b)=>b.y-a.y).forEach(r=>out.push(r.a.sort((a,b)=>a.transform[4]-b.transform[4]).map(t=>t.str.trim()).join('   ')));
  }
  return out.join('\n');
}
// Recorte local: la foto no se envía a un servicio externo.
async function cropTicketImage(file,{kind='ticket'}={}){
  const image=new Image(),url=URL.createObjectURL(file);
  try{await new Promise((ok,fail)=>{image.onload=ok;image.onerror=()=>fail(new Error('No se puede abrir esta imagen. Prueba una foto en JPEG o PNG.'));image.src=url})}finally{URL.revokeObjectURL(url)}
  return new Promise(resolve=>{
    const product=kind==='product';
    const ov=sheet(product?'Acerca la etiqueta':'Encuadra solo el papel',`<p class="hint">${product?'Arrastra las esquinas para dejar solo la etiqueta de un envase. Incluye el nombre, la variedad y el tamaño si se ven.':'Arrastra las esquinas para quitar el fondo. Incluye la cabecera, la fecha y el total si aparecen en la foto.'}</p><canvas class="ticket-crop" aria-label="${product?'Vista previa del recorte del producto':'Vista previa del recorte del tique'}"></canvas><details><summary>Ajustar con controles</summary>${[['left','Izquierda',0],['top','Arriba',0],['right','Derecha',100],['bottom','Abajo',100]].map(([k,label,n])=>`<label for="crop-${k}">${label}</label><input id="crop-${k}" data-crop="${k}" type="range" min="0" max="100" value="${n}" aria-label="Borde ${label.toLowerCase()}">`).join('')}</details>`,{autoFocus:false,saveLabel:'Volver a leer',onSave:()=>{finish();return false}});
    let done=false,drag=null,rect={left:0,top:0,right:1,bottom:1};
    const canvas=ov.querySelector('canvas'),scale=Math.min(1,480/image.naturalWidth);canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);
    const ctx=canvas.getContext('2d');
    function draw(){
      const x=rect.left*canvas.width,y=rect.top*canvas.height,w=(rect.right-rect.left)*canvas.width,h=(rect.bottom-rect.top)*canvas.height;
      ctx.drawImage(image,0,0,canvas.width,canvas.height);ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.drawImage(image,0,0,canvas.width,canvas.height);ctx.restore();ctx.strokeStyle='#00a86b';ctx.lineWidth=3;ctx.strokeRect(x,y,w,h);
      for(const [cx,cy] of [[x,y],[x+w,y],[x,y+h],[x+w,y+h]]){ctx.beginPath();ctx.arc(cx,cy,9,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.stroke()}
      ov.querySelectorAll('[data-crop]').forEach(el=>el.value=String(Math.round(rect[el.dataset.crop]*100)));
    }
    const clamp=n=>Math.max(0,Math.min(1,n));
    function point(e){const box=canvas.getBoundingClientRect();return{x:clamp((e.clientX-box.left)/box.width),y:clamp((e.clientY-box.top)/box.height)}}
    canvas.style.touchAction='none';
    canvas.addEventListener('pointerdown',e=>{
      const p=point(e),corners=[['left','top'],['right','top'],['left','bottom'],['right','bottom']],box=canvas.getBoundingClientRect();
      const nearest=corners.map(([x,y])=>({x,y,d:Math.hypot((p.x-rect[x])*box.width,(p.y-rect[y])*box.height)})).sort((a,b)=>a.d-b.d)[0];
      drag=nearest.d<38?nearest:{start:p};canvas.setPointerCapture(e.pointerId);e.preventDefault();
    });
    canvas.addEventListener('pointermove',e=>{if(!drag)return;const p=point(e);if(drag.start){rect={left:Math.min(drag.start.x,p.x),top:Math.min(drag.start.y,p.y),right:Math.max(drag.start.x,p.x),bottom:Math.max(drag.start.y,p.y)}}else{rect[drag.x]=drag.x==='left'?Math.min(p.x,rect.right-.02):Math.max(p.x,rect.left+.02);rect[drag.y]=drag.y==='top'?Math.min(p.y,rect.bottom-.02):Math.max(p.y,rect.top+.02)}draw()});
    for(const name of ['pointerup','pointercancel'])canvas.addEventListener(name,()=>{drag=null});
    ov.addEventListener('input',e=>{const k=e.target.dataset.crop;if(!k)return;const value=+e.target.value/100;if(k==='left')rect.left=Math.min(value,rect.right-.01);if(k==='right')rect.right=Math.max(value,rect.left+.01);if(k==='top')rect.top=Math.min(value,rect.bottom-.01);if(k==='bottom')rect.bottom=Math.max(value,rect.top+.01);draw()});
    const observer=new MutationObserver(()=>{if(!ov.isConnected&&!done){done=true;observer.disconnect();resolve(null)}});observer.observe(document.body,{childList:true,subtree:true});
    function finish(){
      if(done)return;
      const width=Math.round((rect.right-rect.left)*image.naturalWidth),height=Math.round((rect.bottom-rect.top)*image.naturalHeight);if(width<40||height<40){toast(product?'Selecciona una zona más grande de la etiqueta':'Selecciona una zona más grande del tique');return}
      const output=document.createElement('canvas');output.width=width;output.height=height;output.getContext('2d').drawImage(image,rect.left*image.naturalWidth,rect.top*image.naturalHeight,width,height,0,0,width,height);
      ov.querySelector('[data-s="ok"]').disabled=true;
      output.toBlob(blob=>{if(!blob){ov.querySelector('[data-s="ok"]').disabled=false;toast('No se ha podido recortar la imagen');return}if(!ov.isConnected)return;done=true;observer.disconnect();ov.remove();resolve(blob)},'image/png');
    }
    draw();
  });
}

async function ocrText(file,prog,options={}){
  return CasaReceiptOCR.read(file,prog,options);
}

const tNum=s=>parseFloat(String(s).replace(/\s/g,'').replace(',','.'));
const T_SKIP=/^(total|subtotal|iva\b|base(?=\s+(?:imponible\b|\d)|\s*[:.]|$)|cuota|tarjeta|entrega|efectivo|cambio|importe|descuento|ahorro|cupon|nif|cif|factura|fecha|hora|op[:.]|tienda|telefono|tel[.:]|c\/|avda|calle|mercadona|lidl|carrefour|aldi|dia\b|gracias|devolucion|n[ºo°](?=[\s.:#\d]|$)|caja|cajer|ticket|tique|art[ií]culos|descripci|p\.? ?unit|aut|visa|mastercard|contactless|forma de pago|venta|copia|www|http|s\.a\.|s\.l\.|%)/;
// Saca de un tique: supermercado, fecha, total y cada línea (nombre, unidades, precio unidad, importe, kilos)
function parseTicket(txt){
  const L=String(txt||'').split('\n').map(l=>l.replace(/[€|]/g,' ').replace(/(\d)\s*([.,])\s*(\d{2})(?!\d)/g,'$1$2$3').replace(/\s+/g,' ').trim()).filter(Boolean);
  const all=norm(L.join(' ')),mentions=label=>all.split(/[^a-z0-9]+/).includes(norm(label).split(/[ /]/)[0]);
  const st=ck().stores.find(mentions)||(mentions('coviran')?'Covirán':mentions('eroski')?'Eroski':mentions('alcampo')?'Alcampo':'');
  const dm=all.match(/(\d{2})[\/\-.](\d{2})[\/\-.](\d{2,4})/);
  let date='';if(dm){const y=dm[3].length===2?'20'+dm[3]:dm[3],d=`${y}-${dm[2]}-${dm[1]}`;if(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(d)&&d<=today())date=d}
  const tm=L.map(l=>l.match(/^total\b[^0-9]{0,12}(\d+[.,]\d{2})/i)).find(Boolean),total=tm?tNum(tm[1]):0;
  const lines=[];let pend=null,inItems=false,ended=false;
  const flush=()=>{if(pend){if(inItems)lines.push({...pend,price:NaN,unit:NaN,reviewRequired:true});pend=null}};
  for(const l of L){
    const n=norm(l);
    if(/^total\b/.test(n)){flush();ended=true;continue}
    if(ended)continue;
    if(/^descripci/.test(n)){pend=null;inItems=true;continue}
    const w=n.match(/(\d+[.,]\d{1,3})\s*kg\s*[x×]?\s*(\d+[.,]\d{2})\s*(?:\/\s*kg|eur\/kg|e\/kg)?\s+(\d+[.,]\d{2})(?:\s+[a-e])?$/);
    if(w&&pend){lines.push({...pend,units:1,kg:tNum(w[1]),unit:tNum(w[2]),unitObserved:true,price:tNum(w[3]),quantityObserved:true,sourceText:pend.sourceText+'\n'+l});pend=null;inItems=true;continue}
    const x=n.match(/^(\d+)\s*[x×*]\s*(\d+[.,]\d{2})(?:\s+(\d+[.,]\d{2}))?/);
    if(x&&lines.length&&!pend){const line=lines.at(-1);line.units=+x[1];line.unit=tNum(x[2]);line.unitObserved=true;line.quantityObserved=true;if(x[3])line.price=tNum(x[3]);line.sourceText+='\n'+l;continue}
    const discount=l.match(/^((?:DESCUENTO|CUPON|DTO)[^\d]*?)\s+(-\d+[.,]\d{2})$/i);
    if(discount){flush();lines.push({name:discount[1].trim(),units:1,unit:tNum(discount[2]),unitObserved:false,price:tNum(discount[2]),quantityObserved:true,sourceText:l});inItems=true;continue}
    if(T_SKIP.test(n)||/^\d+[.,]\d+\s*kg\b/.test(n)){if(!inItems)pend=null;continue;}
    let m=l.match(/^(\d{1,2})\s+(.*?[A-Za-zÁÉÍÓÚÑáéíóúñ].*?)\s+(-?\d+[.,]\d{2})(?:\s+(-?\d+[.,]\d{2}))?(?:\s+[A-E])?$/);
    if(m){flush();const u=+m[1],price=tNum(m[4]||m[3]);lines.push({name:m[2],units:u,unit:m[4]?tNum(m[3]):price/u,unitObserved:!!m[4],price,quantityObserved:true,sourceText:l});inItems=true;continue}
    m=l.match(/^(.*?[A-Za-zÁÉÍÓÚÑáéíóúñ]{2}.*?)\s+(-?\d+[.,]\d{2})(?:\s+[A-E])?$/);
    if(m){const price=tNum(m[2]),continuation=pend?.quantityObserved;
      if(pend&&!continuation)flush();
      lines.push({name:continuation?pend.name+' '+m[1]:m[1],units:continuation?pend.units:1,unit:price/(continuation?pend.units:1),unitObserved:false,price,quantityObserved:!!continuation,sourceText:continuation?pend.sourceText+'\n'+l:l});pend=null;inItems=true;continue}
    m=l.match(/^(?:(\d{1,2})\s+)?([A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9 .,%/'-]{2,})$/);
    if(m){flush();pend={name:m[2],units:m[1]?+m[1]:1,quantityObserved:!!m[1],sourceText:l}}
  }
  flush();
  for(const line of lines){line.name=line.name.replace(/\s+/g,' ').trim();line.nice=line.name.toLowerCase().replace(/^./,c=>c.toUpperCase())}
  return {store:st,date,total,storeObserved:!!st,dateObserved:!!date,totalObserved:!!tm,lines:lines.filter(a=>a.name.length>1)};
}
// Producto de Mercadona de una línea del tique: el que cuesta exactamente lo mismo
function ticketProduct(a,name){
  if(!MC)return null;const r=searchMC(name||a.name,40);if(!r.length)return null;
  const hit=r.find(p=>a.kg?Math.abs(p.ref-a.unit)<.011:Math.abs(p.price-a.unit)<.011);
  if(hit||a.kg)return hit||r[0];
  // En tienda se vende suelto lo que online va en pack (leche, yogures…): se calcula el tamaño por el precio
  const p=r[0],k=a.unit/p.price;if(k>0&&k<.9){const sz=p.d==='ud'?Math.max(1,Math.round(p.size*k)):Math.round(p.size*k/50)*50||Math.round(p.size*k);return Object.assign({},p,{size:sz,approx:true})}
  return p;
}
// Producto de la despensa que corresponde a una línea del tique
function ticketPantry(name){
  const tw=words(name);if(!tw.length)return null;
  const pref=(a,b)=>a.some(x=>b.some(y=>same(x,y)||(y.length>=3&&x.startsWith(y))||(x.length>=3&&y.startsWith(x))));
  return(S.pantry||[]).find(x=>{const pw=words(x.name);return pw.length&&pw.every(w=>pref([w],tw))})||null;
}
// Preparar las mismas cantidades, precios y destinos que usa el importador de tiques.
function receiptNameMatches(requested,actual){
  const tokens=s=>CasaReceipts.norm(s).split(' ').filter(w=>w&&!['de','del','el','la','los','las','y'].includes(w));
  const want=tokens(requested),have=tokens(actual);return want.length>0&&want.every(w=>have.some(x=>same(w,x)));
}
function ticketShoppingMatches(a,plan){
  const all=S.items||[],exact=all.filter(i=>(plan.mid&&i.mid===plan.mid)||norm(i.name)===norm(a.name));
  return exact.length?exact:all.filter(i=>receiptNameMatches(i.name,a.name)||(plan.mid&&receiptNameMatches(i.name,plan.label)));
}
function ticketLinePlan(a,store,inventory){
  const candidates=store==='Mercadona'?searchMC(a.name,40).filter(x=>Math.abs((a.kg?x.ref:x.price)-a.unit)<.011):[];
  // Una coincidencia aproximada no autoriza inventar el peso de un envase.
  const p=candidates.length===1?candidates[0]:null;
  const sameName=(S.pantry||[]).filter(x=>(p&&x.mid===p.id)||norm(x.name)===norm(a.name));
  const possible=sameName.length?sameName:(S.pantry||[]).filter(x=>receiptNameMatches(x.name,a.name)||(p&&receiptNameMatches(x.name,p.name)));
  const existing=possible.length===1?possible[0]:null;
  const q=parseQty(a.name.match(/(?:^|[\s(])(\d+(?:[.,]\d+)?\s*(?:kg|gr|g|ml|cl|l|ud))\b/i)?.[1]||'');
  const amount=a.kg?a.kg*1000:p?p.size*a.units:q?q.n*a.units:a.units;
  const unit=a.kg?'g':p?p.d==='ud'?'ud':p.fmt==='l'?'ml':'g':q?q.d==='ud'?'ud':/^(l|ml|cl)$/.test(q.raw)?'ml':'g':'ud';
  const nonFood=/\b(bolsa(s)? plastico|bolsa(s)? papel|descuento|cupon)\b/.test(norm(a.name))||a.price<=0;
  return {mid:p?p.id:'',amount,unit,packSize:p?p.size:1,packLabel:p?prodSize(p):'1 ud',category:p?p.cat:'',packUnit:p?(p.d==='ud'?'ud':p.fmt==='l'?'ml':'g'):'',loc:p?defLoc(p):'Despensa',weight:existing?unitW(existing.name)||0:0,inventory:nonFood?'':inventory===undefined?existing?existing.id:possible.length>1?'':'new':inventory,confident:nonFood||(!!p&&sameName.length<=1&&(!existing||sameName.length===1)),ambiguous:possible.length>1,label:p?p.name:'Producto sin envase identificado: confirmar cantidad'};
}
function prepareTicket(t){return {...t,lines:t.lines.map(l=>{const alias=S.cook?.receiptAliases?.[CasaReceipts.norm(t.store)+'|'+CasaReceipts.norm(l.originalName||l.name)],name=alias?.name||l.name;return {...l,originalName:l.originalName||l.name,name,nice:alias?name:l.nice||name,plan:ticketLinePlan({...l,name},t.store,l.plan?.inventory)}})}}
async function receiptRemoteState(){
  if(!docRef?.getServer||!dbRef?.transactPatch||!canWrite)throw new Error('Necesitas iniciar sesión y tener conexión con la casa para guardar un tique. No se ha guardado nada.');
  const snap=await docRef.getServer();if(!snap.exists)throw new Error('No se encuentra el documento de la casa. No se ha creado ni sobrescrito nada.');
  const state=snap.data();if(!['buys','pantry','items'].every(k=>Array.isArray(state[k])))throw new Error('El documento no tiene la estructura esperada de CASA. No se ha modificado.');
  return state;
}
async function commitTicket(t,options={},progress=()=>{}){
  if(CasaReceipts.version!==52)throw new Error('Casa tiene una versión antigua abierta. Cierra esta revisión y pulsa Actualizar Casa.');
  const check=CasaReceipts.validate(t);if(!check.ok)throw new Error(check.reasons.join('. '));
  if(t.date>today())throw new Error('La fecha del tique no puede ser futura.');
  progress('Conectando con la casa…');
  await receiptDeadline(receiptRemoteState(),10000,'La casa no ha respondido a tiempo. Comprueba la conexión y reintenta el guardado.');
  // Una lectura de servidor correcta permite recuperarse de un aviso antiguo
  // de desconexión. Las reglas de Firestore siguen comprobando la escritura.
  if(syncState==='err'){syncState='ok';updSync()}
  // No reemplazar el hogar para vaciar la cola: esperar a su sincronización normal.
  progress('Preparando la compra y los cambios pendientes…');
  if(dirty()&&!pushing){clearTimeout(saveTimer);await receiptDeadline(pushCloud(),12000,'La sincronización no ha respondido a tiempo. Conservamos el ticket para reintentar.')}
  const deadline=Date.now()+15000;
  while((pushing||dirty())&&syncState!=='err'&&Date.now()<deadline)await new Promise(r=>setTimeout(r,100));
  if(pushing||dirty()||syncState==='err')throw new Error('Espera a que la casa termine de sincronizar e inténtalo otra vez. El tique no se ha enviado.');
  clearTimeout(saveTimer);
  const identity=await CasaReceipts.identify(t);
  progress('Guardando compra, despensa y lista de la compra…');
  const saved=await receiptDeadline(dbRef.transactPatch('hogar/estado',data=>CasaReceipts.patch(data,t,identity,{...options,by:meName(),defaultStores:CK_STORES})),20000,'El guardado no ha respondido a tiempo. Reintenta este ticket: se comprobará si llegó a guardarse para no duplicarlo.');
  // No afirmar que se guardó hasta releer desde Firestore, incluso si el cliente perdió la respuesta.
  let verified;
  progress('Comprobando que la compra ha quedado guardada…');
  try{verified=await receiptDeadline(docRef.getServer(),10000,'Verificación sin respuesta')}catch(e){throw new Error('La operación se ha enviado, pero falta confirmar el guardado. Reintenta este mismo ticket: su huella evita duplicarlo.')}
  const record=verified.exists&&(verified.data().buys||[]).find(b=>b.id===saved.result.id);
  if(!record||record.date!==t.date||norm(record.store)!==norm(t.store)||CasaReceipts.cents(record.total)!==CasaReceipts.cents(t.total)||(!saved.result.duplicate&&record.receiptKey!==identity.key))throw new Error('No se ha podido verificar la compra. Reintenta el mismo tique antes de crear otro gasto.');
  applyRemote(verified);mcCache.clear();
  return {...saved.result,weekly:spentWeek()};
}
function receiptMessage(result){return result.duplicate?'Este tique ya estaba guardado. No se han duplicado el gasto ni los productos.':`Tique guardado y verificado${result.enriched?' · completa el gasto anterior':''} · ${result.added||0} productos actualizados en casa · ${result.removed||0} quitados de Compras. Gastado esta semana: ${eur(result.weekly)}`}
function receiptFromText(text,meta={}){
  const t=parseTicket(text),clean=s=>String(s).replace(/[€|]/g,' ').replace(/(\d)\s*([.,])\s*(\d{2})(?!\d)/g,'$1$2$3').replace(/\s+/g,' ').trim();
  for(const line of t.lines){
    const parts=String(line.sourceText||'').split('\n').map(clean),sources=(meta.lines||[]).filter(row=>parts.includes(clean(row.text)));
    if(sources.some(s=>s.moneyNormalized)){line.reviewRequired=true;line.readCorrection='decimal';line.ocrRawText=sources.map(s=>s.rawText||s.text).join('\n')}
    if(sources.length){const confidence=sources.map(s=>s.confidence).filter(Number.isFinite);if(confidence.length)line.readConfidence=Math.min(...confidence);const boxes=sources.map(s=>s.box).filter(b=>Array.isArray(b)&&b.length===4);if(boxes.length)line.readBox=[Math.min(...boxes.map(b=>b[0])),Math.min(...boxes.map(b=>b[1])),Math.max(...boxes.map(b=>b[2])),Math.max(...boxes.map(b=>b[3]))]}
  }
  // Si varias filas demuestran dónde están P.Unit e Importe, una cifra leída
  // solo en P.Unit no se convierte silenciosamente en el importe de la línea.
  const moneyWords=row=>(row?.words||[]).filter(w=>/^-?\d+[.,]\d{2}$/.test(clean(w.text))&&Array.isArray(w.box)&&w.box.length===4),center=w=>w.box.reduce((n,p)=>n+p[0],0)/4;
  const columns=t.lines.filter(l=>l.unitObserved&&!l.kg).map(l=>moneyWords((meta.lines||[]).find(row=>clean(row.text)===clean(l.sourceText)))).filter(words=>words.length===2).map(words=>words.sort((a,b)=>center(a)-center(b)));
  if(columns.length>=2){const median=values=>values.slice().sort((a,b)=>a-b)[Math.floor(values.length/2)],unitColumn=median(columns.map(w=>center(w[0]))),amountColumn=median(columns.map(w=>center(w[1]))),gap=amountColumn-unitColumn;
    const ys=columns.flatMap(pair=>pair.map(w=>w.box.reduce((n,p)=>n+p[1],0)/4)),stable=columns.every(pair=>Math.abs(center(pair[0])-unitColumn)<gap*.3&&Math.abs(center(pair[1])-amountColumn)<gap*.3);
    if(gap>.04&&stable)for(const line of t.lines){if(line.unitObserved||!Number.isFinite(line.price))continue;const words=moneyWords((meta.lines||[]).find(row=>clean(row.text)===clean(line.sourceText))),y=words.length===1?words[0].box.reduce((n,p)=>n+p[1],0)/4:NaN;if(words.length===1&&y>=Math.min(...ys)-.05&&y<=Math.max(...ys)+.05&&Math.abs(center(words[0])-unitColumn)<gap*.3){line.unit=tNum(clean(words[0].text));line.unitObserved=true;line.price=NaN;line.reviewRequired=true}}
  }
  return prepareTicket({...t,imageHash:meta.imageHash||'',ocrConfidence:meta.confidence||0,ocrEngine:meta.engine||'',ocrLines:meta.lines||[],pendingBuyId:meta.pendingId||''});
}
function receiptReadOptions(ov){
  const controller=new AbortController(),observer=new MutationObserver(()=>{if(!ov.isConnected){controller.abort();observer.disconnect()}});
  observer.observe(document.body,{childList:true,subtree:true});return {signal:controller.signal,dispose:()=>observer.disconnect()};
}
function ticketTranscription(text,meta={}){
  const originalParsed=parseTicket(text);
  const ov=sheet('Transcripción del tique',`<p class="hint" id="tkIntro">Todavía no se ha guardado ninguna compra.</p>${meta.file&&(/image/.test(meta.file.type)||/\.(heic|jpe?g|png|webp)$/i.test(meta.file.name||''))?'<details><summary>Ver foto original</summary><img id="tkOriginalImage" style="display:block;width:100%;height:auto" alt="Foto original del ticket para comprobar la transcripción"></details>':''}<div class="tk-read-total" id="tkReadTotal" role="status" aria-live="polite" aria-atomic="true"><span>Total del ticket leído</span><strong id="tkReadAmount"></strong><small id="tkReadTotalHint"></small></div><button type="button" class="link" id="tkEditReading">Corregir lectura</button><div id="tkTextEditor"><label for="tkTranscript">Texto del ticket</label><textarea class="field" id="tkTranscript" rows="14" spellcheck="false">${esc(text)}</textarea></div><p id="tkTranscriptStatus" class="hint" role="status"></p>${meta.file&&(/image/.test(meta.file.type)||/\.(heic|jpe?g|png|webp)$/i.test(meta.file.name||''))?'<button type="button" class="btn sec" id="tkTranscriptCrop">✂️ Recortar y volver a leer</button>':''}`,{autoFocus:false,saveLabel:'Guardar compra',onSave:()=>{proceed();return false}});ov.classList.add('receipt-save-sheet');
  const original=ov.querySelector('#tkOriginalImage');
  if(original){const url=URL.createObjectURL(meta.file);original.src=url;const observer=new MutationObserver(()=>{if(!ov.isConnected){URL.revokeObjectURL(url);observer.disconnect()}});observer.observe(document.body,{childList:true,subtree:true})}
  let busy=false;
  const status=ov.querySelector('#tkTranscriptStatus'),field=ov.querySelector('#tkTranscript');
  const summary=()=>{const t=parseTicket(field.value),check=CasaReceipts.validate(t),unknown=meta.engine?t.lines.filter(l=>!l.quantityObserved).length:0,doubtful=(meta.lines||[]).filter(l=>l.confidence<.9).length;const hasTotal=t.totalObserved&&t.total>0,totalBox=ov.querySelector('#tkReadTotal');ov.querySelector('#tkReadAmount').textContent=hasTotal?eur(t.total):'Sin identificar';totalBox.classList.toggle('needs-review',!hasTotal||check.sumCents!==CasaReceipts.cents(t.total));ov.querySelector('#tkReadTotalHint').textContent=!hasTotal?'No se ha podido leer el total. Comprueba la foto o corrige el texto.':check.sumCents===CasaReceipts.cents(t.total)?'Coincide con la suma de artículos.':'La suma de artículos no coincide con este total.';status.textContent=t.lines.length+' líneas interpretadas · suma '+eur(check.sumCents/100)+(t.total?' · total leído '+eur(t.total):' · total no identificado')+(unknown?' · '+unknown+' cantidades sin leer: tendrás que confirmarlas.':'')+(doubtful||meta.confidence<85?' · Hay texto dudoso: comprueba los nombres con la foto.':'')+(check.ok?'':' · '+check.reasons.join('. '))};
  const ready=()=>receiptQuickPlan(receiptFromText(field.value,meta));
  const updateSummary=()=>{summary();const plan=ready();ov.querySelector('[data-s="ok"]').textContent=plan.ok?(plan.confirmationRequired?'Confirmar lectura y guardar':'Guardar compra'):'Revisar datos pendientes';ov.querySelector('#tkIntro').textContent=plan.ok?(plan.confirmationRequired?'El total coincide. Comprueba la transcripción y confirma todos los artículos de una vez al guardar.':'El total leído coincide con la suma de artículos. Puedes guardar la compra.'):'Solo necesitas corregir los datos señalados. Después podrás confirmar todos los artículos al guardar.'};
  field.addEventListener('input',updateSummary);updateSummary();ov.querySelector('#tkTextEditor').hidden=ready().ok;
  ov.querySelector('#tkEditReading').addEventListener('click',()=>{ov.querySelector('#tkTextEditor').hidden=false;field.focus({preventScroll:true})});
  async function proceed(){
    if(busy)return;busy=true;const button=ov.querySelector('[data-s="ok"]');button.disabled=true;
    try{
      const edited=field.value.trim();if(!edited)throw Error('No se ha leído texto. Recorta el papel o vuelve a hacer la foto.');
      const t=receiptFromText(edited,meta);if(t.lines.length===originalParsed.lines.length)t.lines.forEach((l,i)=>{if(CasaReceipts.cents(l.price)===CasaReceipts.cents(originalParsed.lines[i].price))l.originalName=originalParsed.lines[i].name});
      const prepared=receiptQuickPlan(t);
      if(!prepared.ok){ov.remove();ticketReview(t,edited,{file:meta.file,draftKey:meta.draftKey,reasons:prepared.reasons});return}
      receiptSaving(ov,true);receiptSaveStatus(ov,'Guardando compra…');const result=await saveReceiptPurchase(receiptConfirmReading(prepared.ticket),meta.file,{removePurchased:true},message=>receiptSaveStatus(ov,message),meta.draftKey);
      ov.remove();toast(receiptMessage(result)+(result.photoWarning?' · '+result.photoWarning:''));
    }catch(e){
      if(e.code==='receipt_review'){const t=receiptFromText(field.value,meta);ov.remove();ticketReview(t,field.value,{file:meta.file,draftKey:meta.draftKey,reasons:[e.message]});return}
      receiptSaveStatus(ov,receiptSaveError(e),true);
    }finally{receiptSaving(ov,false);busy=false;button.disabled=false}
  }
  ov.querySelector('#tkTranscriptCrop')?.addEventListener('click',async()=>{
    if(busy)return;busy=true;
    const readOptions=receiptReadOptions(ov);
    try{const crop=await cropTicketImage(meta.file);if(!crop||!ov.isConnected)return;ov.querySelector('[data-s="ok"]').disabled=true;status.textContent='Volviendo a leer el papel…';const result=await ocrText(crop,(n,stage)=>{if(ov.isConnected)status.textContent=(stage||'Volviendo a leer')+'… '+n+' %'},readOptions);if(!ov.isConnected)return;field.value=result.text;meta.confidence=result.confidence;meta.lines=result.lines;meta.engine=result.engine;updateSummary()}
    catch(e){if(ov.isConnected)status.textContent=e.message||'No se pudo volver a leer la foto.'}
    finally{readOptions.dispose();busy=false;if(ov.isConnected)ov.querySelector('[data-s="ok"]').disabled=false}
  });
  return ov;
}
async function ticketFlow(context={}){
  const file=await pickFile('image/*,application/pdf,text/plain,.txt');if(!file)return;
  const ov=sheet('Leyendo el tique…',`<p class="hint" id="tkP">Preparando…</p><p class="hint">Primero verás una transcripción editable. Nada se guarda hasta que confirmes la compra. La primera lectura puede tardar mientras se descarga el lector; la foto se procesa en este dispositivo.</p>`,{}),progress=ov.querySelector('#tkP');
  let text='',confidence=0,imageHash='',reading={};const readOptions=receiptReadOptions(ov);
  try{
    const raw=await file.arrayBuffer();imageHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw))).map(b=>b.toString(16).padStart(2,'0')).join('');
    if(file.type==='text/plain'||/\.txt$/i.test(file.name)){progress.textContent='Leyendo el texto del tique…';text=await file.text();confidence=100}
    else if(/pdf/i.test(file.type)||/\.pdf$/i.test(file.name)){progress.textContent='Leyendo el PDF…';text=await pdfText(file);confidence=100}
    else{progress.textContent='Leyendo la foto…';reading=await ocrText(file,(n,stage)=>{if(ov.isConnected)progress.textContent=(stage||'Leyendo la foto')+'… '+n+' %'},readOptions);text=reading.text;confidence=reading.confidence}
    if(!ov.isConnected)return;
    if(!MC)await loadMC();
    if(!ov.isConnected)return;
    readOptions.dispose();ov.remove();const meta={file,imageHash,confidence,engine:reading.engine,lines:reading.lines,pendingId:context.pendingId},draft=receiptDrafts().find(d=>d.ticket.imageHash===imageHash);
    if(draft){const ov=ticketReview(receiptMergeCorrections(draft.ticket,receiptFromText(text,meta)),text,{file,draftKey:draft.key,filter:draft.options?.filter||'all'});ov.querySelector('#f_rm').checked=draft.options?.removePurchased!==false;const choice=draft.options?.confirmNew?'__new':draft.options?.matchId||'';if([...ov.querySelector('#f_as').options].some(o=>o.value===choice))ov.querySelector('#f_as').value=choice}
    else ticketTranscription(text,meta);
  }catch(e){if(!ov.isConnected||e.name==='AbortError')return;ov.remove();sheet('No se ha podido completar el tique',`<p>${esc(e.message||'Revisa la conexión o prueba con una foto más nítida.')}</p><p class="hint">No se creará un gasto distinto al reintentar el mismo archivo.</p>`,{})}
  finally{readOptions.dispose()}
}
function receiptLineDefaults(a,t,pending){
  const plan={...(a.plan||ticketLinePlan(a,t.store))},credits=pending?.pendingInventory||[],candidates=credits.filter(p=>(plan.mid&&p.mid===plan.mid)||receiptNameMatches(p.name,a.name)),prior=candidates.length===1?candidates[0]:null;if(prior&&!a.reviewForm){plan.inventory=prior.pantryId;if(!plan.mid){const originalUnits=(pending.items||[]).filter(i=>(prior.mid&&i.mid===prior.mid)||norm(i.name)===norm(prior.name)).reduce((n,i)=>n+(i.units||1),0);plan.amount=prior.amount/(originalUnits||1)*a.units;plan.unit=prior.unit}}const matches=ticketShoppingMatches(a,plan),selected=Array.isArray(a.plan?.shoppingIds)?a.plan.shoppingIds.find(id=>(S.items||[]).some(i=>i.id===id))||'':matches.length===1?matches[0].id:'',unknown=(a.quantityObserved===false&&(!!t.ocrEngine||a.editedFields?.includes('units')))||!Number.isFinite(a.units)||(a.kg!==undefined&&!Number.isFinite(a.kg));
  plan.shoppingIds=selected?[selected]:[];plan.shoppingAmount=a.kg?0:a.units;
  const item=matches.find(x=>x.id===selected);plan.shoppingNames=item?{[item.id]:item.name}:{};
  if(pending&&!Object.hasOwn(plan,'creditedId'))plan.creditedId=prior?.id||'';
  return {plan,credits,prior,matches,selected,unknown};
}
function ticketReview(t,text,opts={}){
  const stores=[...new Set([...ck().stores,...(t.store?[t.store]:[])])],pans=S.pantry||[];
  const pending=(S.buys||[]).find(b=>b.id===t.pendingBuyId&&b.receiptPending);
  const candidates=(opts.candidates||S.buys||[]).filter(b=>b.date===t.date&&CasaReceipts.cents(b.total)===CasaReceipts.cents(t.total)&&(!t.store||!b.store||norm(b.store)===norm(t.store)));
  const rows=t.lines.map((a,i)=>{
    const {plan,credits,prior,matches,selected,unknown}=receiptLineDefaults(a,t,pending),chooseShopping=matches.length>1&&!Array.isArray(a.plan?.shoppingIds),hasKg=a.reviewForm?.measure?a.reviewForm.measure==='kg':a.kg!==undefined,unitObserved=a.unitObserved===undefined?hasKg:a.unitObserved===true,stockScale=a.reviewForm?.perUnit??plan.amount/((hasKg?a.kg:a.units)||1);
    return `<details class="ck-tl receipt-product" data-receipt-row="${i}" data-validation-required="${!!(a.reviewRequired||unknown||a.readConfidence<.9)}" data-line-validated="${!!a.lineValidated}" data-read-confirmed="${!!a.lineValidated}" data-edited-fields="${esc(JSON.stringify(a.editedFields||[]))}" data-unit-observed="${unitObserved}" data-unmatched-correction="${!!a.unmatchedCorrection}" data-confirmed-key="${esc(a.confirmedKey||'')}" data-default-measure="${a.reviewForm?.defaultMeasure||(hasKg?'kg':'ud')}" data-default-stock-scale="${a.reviewForm?.defaultStockScale??stockScale}" data-default-stock-unit="${a.reviewForm?.defaultStockUnit||plan.unit}">
      <summary><span class="receipt-row-index">${i+1}</span><span class="receipt-row-copy"><span data-row-name="${i}">${esc(a.nice||a.name||'Artículo sin nombre')}</span><small data-review-label="${i}"></small></span><span class="receipt-row-amount"><span class="receipt-quick-price"><input class="field" data-pr="${i}" id="tkLinePrice${i}" type="text" inputmode="decimal" autocomplete="off" aria-label="Importe de la línea ${i+1}" placeholder="Sin leer" value="${Number.isFinite(a.price)?String(a.price).replace('.',','):''}"><span>€</span></span><strong data-row-price="${i}" hidden></strong><small data-row-quantity="${i}"></small></span><span class="receipt-row-chevron" aria-hidden="true">⌄</span></summary>
      <div class="receipt-product-editor"><p class="receipt-line-issue" id="tkLineIssue${i}" data-line-issue="${i}" hidden></p>
      <label for="tkName${i}">Producto</label><input class="field" id="tkName${i}" data-nm="${i}" value="${esc(a.nice||a.name)}" autocomplete="off">
      <div class="receipt-line-fields"><div><label for="tkQuantity${i}" data-quantity-label="${i}">${unknown?'Cantidad sin leer':'Cantidad'}</label><input class="field" id="tkQuantity${i}" data-units="${i}" type="number" inputmode="decimal" min="0.001" step="any" placeholder="Ej.: 1" value="${unknown?'':hasKg?a.kg??'':a.units??''}"></div><div><label for="tkMeasure${i}">Medida</label><select class="field" id="tkMeasure${i}" data-measure="${i}">${opt([['ud','unidades'],['kg','kg']],hasKg?'kg':'ud')}</select></div></div>
      <div class="receipt-unit-price" ${unitObserved?'':'hidden'}><label for="tkUnitPrice${i}">${hasKg?'Precio por kg':'Precio por unidad'}</label><input class="field" id="tkUnitPrice${i}" data-unitpr="${i}" type="text" inputmode="decimal" value="${Number.isFinite(a.unit)?String(a.unit).replace('.',','):''}"><p class="hint" data-line-math="${i}"></p><button type="button" class="receipt-inline-action" data-use-calculated="${i}" hidden></button></div>
      <details class="receipt-line-source"><summary>Ver esta línea del ticket</summary><blockquote class="receipt-source-line" data-read-line="${i}">${esc(a.ocrRawText||a.sourceText||'Texto original no disponible. Comprueba la foto.')}</blockquote>${a.readBox?`<canvas data-doubt-preview="${i}" aria-label="Línea ${i+1} del ticket"></canvas>`:''}</details>
      <details class="receipt-line-options"><summary>Inventario y lista de la compra</summary><label class="receipt-include"><input type="checkbox" data-on="${i}" aria-label="Incluir artículo ${i+1}" ${a.excluded?'':'checked'}> Incluir este artículo</label>
        ${pending?`<label>Ya añadido al terminar la compra</label><select class="field" data-credit="${i}">${opt([['','Todavía no se añadió'],...credits.map(p=>[p.id,p.name+' · '+fmtAmt(p.amount,p.unit)])],plan.creditedId||'')}</select>`:''}
        <label>Destino en casa</label><select class="field" data-pn="${i}">${opt([...(plan.ambiguous&&!plan.inventory?[['__choose','Selecciona el destino…']]:[]),['','No va a la despensa'],['new','Nuevo / buscar coincidencia en casa'],...pans.map(x=>[x.id,x.name])],plan.ambiguous&&!plan.inventory?'__choose':plan.inventory)}</select>
        <div class="grid2"><div><label>Cantidad para casa</label><input class="field" data-stockqty="${i}" data-per-unit="${stockScale}" type="number" min="0.001" step="any" value="${plan.amount}"></div><div><label>Unidad en casa</label><select class="field" data-stockunit="${i}">${opt([['ud','unidades'],['g','g'],['ml','ml']],plan.unit)}</select></div></div>
        <label>Producto que quitar de Compras</label><select class="field" data-shopping="${i}">${opt([...(chooseShopping?[['__choose','Selecciona qué quitar…']]:[]),['','No quitar ninguno'],...(S.items||[]).map(x=>[x.id,x.name])],chooseShopping?'__choose':selected)}</select>
        <div ${hasKg?'':'hidden'}><label>Unidades para descontar de Compras</label><input class="field" data-purchased="${i}" type="number" min="0" step="any" value="${a.plan?.shoppingAmount??(hasKg?0:a.units)}"></div>
      </details>
      <div class="receipt-row-done"><span data-line-validation="${i}" role="status"></span><button type="button" class="btn sec" data-validate-line="${i}">Listo</button></div></div>
    </details>`;
  }).join('');
  const ov=sheet('Revisar compra',`
    <div class="receipt-editor-intro"><span>🧾 Tu ticket</span><p>Corrige solo lo que falte. Tus cambios se conservan.</p></div>
    <section class="receipt-balance" id="tkBalance" aria-live="polite"><div class="receipt-balance-title"><span>Total del ticket</span><span id="tkBalanceState" class="receipt-balance-state"></span></div><strong id="tkTotalDisplay" class="receipt-total-display"></strong><div class="receipt-balance-breakdown"><div><span>Artículos leídos</span><b id="tkSumDisplay"></b></div><div><span id="tkDeltaLabel">Diferencia</span><b id="tkDeltaDisplay"></b></div></div><p id="f_sum" class="hint"></p></section>
    <details class="receipt-meta"><summary><span id="tkStoreLabel">${esc(t.store||'Añade el comercio')}</span><span id="tkDateLabel"></span><small>Editar</small></summary><div class="grid2"><div><label for="f_sto">Comercio</label><select class="field" id="f_sto"><option value="">Seleccionar…</option>${opt(stores.map(x=>[x,x]),t.store)}</select></div><div><label for="f_dt">Fecha</label><input class="field" id="f_dt" type="date" max="${today()}" value="${t.date}"></div></div><label for="f_tot">Total que aparece en la foto (€)</label><input class="field" id="f_tot" type="text" inputmode="decimal" value="${t.total?String(t.total).replace('.',','):''}"></details>
    ${opts.file?'<div class="receipt-photo-actions"><button type="button" class="btn sec" id="tkPhoto">Ver foto del ticket</button><button type="button" class="receipt-inline-action" id="tkCrop">Recortar y releer</button></div>':''}
    <div id="tkIssues" class="receipt-issues" aria-live="polite"></div>
    <div class="receipt-difference-help" id="tkDifferenceHelp" hidden><strong>Hay una diferencia en los importes</strong><p>Comprueba la foto: puede faltar un artículo o tener otro precio. Marcarlo como revisado no cambia la suma.</p><div><button type="button" class="receipt-inline-action" data-receipt-add>Añadir artículo</button><button type="button" class="receipt-inline-action" id="tkCheckTotal">Editar total</button></div></div>
    <div class="receipt-product-heading"><h4>Artículos <span id="tkLineCount"></span></h4><button type="button" class="receipt-inline-action" id="tkAddLine">+ Añadir</button></div>
    <div class="receipt-filters"><button type="button" class="on" data-receipt-filter="all" aria-pressed="true">Todos <span id="tkAllCount"></span></button><button type="button" data-receipt-filter="issues" aria-pressed="false">Por revisar <span id="tkIssueCount"></span></button></div><p id="tkFilterEmpty" class="hint" hidden>Los campos están completos. Comprueba los importes con la foto para resolver la diferencia.</p>
    <div class="receipt-products">${rows}</div>
    <details class="receipt-final-options"><summary>Opciones de la compra</summary><label class="receipt-include"><input type="checkbox" id="f_rm" checked> Quitar de Compras los productos identificados</label><label for="f_as">¿Ya habíais apuntado este gasto?</label><select class="field" id="f_as"><option value="">Comprobar automáticamente</option>${candidates.map(b=>`<option value="${esc(b.id)}">${b.ticket?'Ya guardado:':'Completar'} ${esc(b.store||'compra')} · ${esc(b.date)} · ${eur(b.total)}</option>`).join('')}<option value="__new">Es una compra distinta</option></select><p class="hint">Se comprueba si el ticket ya existe para evitar duplicar el gasto y los productos.</p></details>
    <details class="receipt-final-options"><summary>Texto leído y otras herramientas</summary><button type="button" class="receipt-inline-action" id="tkBackToText">Editar transcripción</button><pre class="ck-pre">${esc(text)}</pre></details><p id="tkStatus" role="status" class="hint" hidden></p>`,{autoFocus:false,saveLabel:'Guardar compra',onSave:()=>{run();return false}});
  ov.classList.add('receipt-save-sheet','receipt-review-sheet');
  const sheetBody=ov.querySelector('.sheet'),actions=ov.querySelector('.actions'),content=document.createElement('div');content.className='receipt-review-body';
  for(const child of [...sheetBody.children])if(child.tagName!=='H3'&&child!==actions)content.append(child);sheetBody.insertBefore(content,actions);
  const actionHint=document.createElement('p');actionHint.id='tkActionHint';actionHint.className='receipt-action-hint';actions.prepend(actionHint);actions.style.flexWrap='wrap';ov.querySelector('[data-s="cancel"]').textContent='Después';
  receiptDoubtPreviews(t,opts.file,ov);
  let busy=false,draftTimer;
  function collect(includeExcluded=false){
    const lines=[];
    for(const cb of ov.querySelectorAll('[data-on]')){
      if(!cb.checked&&!includeExcluded)continue;
      const i=Number(cb.dataset.on),row=ov.querySelector(`[data-receipt-row="${i}"]`),name=ov.querySelector(`[data-nm="${i}"]`).value.trim(),price=receiptFieldNumber(ov.querySelector(`[data-pr="${i}"]`)),amount=receiptFieldNumber(ov.querySelector(`[data-units="${i}"]`)),kg=ov.querySelector(`[data-measure="${i}"]`).value==='kg',unitObserved=row.dataset.unitObserved==='true';
      const line={...t.lines[i],name,nice:name,reviewRequired:row.dataset.validationRequired==='true',lineValidated:row.dataset.lineValidated==='true',quantityObserved:Number.isFinite(amount)&&amount>0,originalName:t.lines[i]?.originalName||t.lines[i]?.name||name,price,units:kg?1:amount,unit:unitObserved?receiptFieldNumber(ov.querySelector(`[data-unitpr="${i}"]`)):price/amount,unitObserved,editedFields:JSON.parse(row.dataset.editedFields),confirmedKey:row.dataset.confirmedKey||'',unmatchedCorrection:row.dataset.unmatchedCorrection==='true',excluded:!cb.checked,...(kg?{kg:amount}:{})};
      if(!kg)delete line.kg;
      line.plan=ticketLinePlan(line,val(ov,'f_sto'),ov.querySelector(`[data-pn="${i}"]`).value.replace(/^__choose$/,''));
      if(pending)line.plan.creditedId=ov.querySelector(`[data-credit="${i}"]`).value;
      line.plan.amount=receiptFieldNumber(ov.querySelector(`[data-stockqty="${i}"]`));line.plan.unit=ov.querySelector(`[data-stockunit="${i}"]`).value;
      const shopping=ov.querySelector(`[data-shopping="${i}"]`).value,matched=(S.items||[]).find(x=>x.id===shopping);line.plan.shoppingIds=matched?[matched.id]:[];line.plan.shoppingAmount=receiptFieldNumber(ov.querySelector(`[data-purchased="${i}"]`));line.plan.shoppingNames=matched?{[matched.id]:matched.name}:{};
      line.reviewForm={measure:kg?'kg':'ud',perUnit:ov.querySelector(`[data-stockqty="${i}"]`).dataset.perUnit,defaultMeasure:row.dataset.defaultMeasure,defaultStockScale:row.dataset.defaultStockScale,defaultStockUnit:row.dataset.defaultStockUnit};lines.push(line);
    }
    return {...t,date:val(ov,'f_dt'),store:val(ov,'f_sto'),total:receiptFieldNumber(ov.querySelector('#f_tot')),editedHeaderFields:[...new Set([...(t.editedHeaderFields||[]),...['store','date','total'].filter((key,i)=>String([val(ov,'f_sto'),val(ov,'f_dt'),receiptFieldNumber(ov.querySelector('#f_tot'))][i])!==String(t[key]))])],lines};
  }
  function persistReview(){if(ov.dataset.receiptComplete==='true')return;try{const result=receiptKeepReviewDraft(collect(true),text,{...opts,removePurchased:ov.querySelector('#f_rm').checked,matchId:val(ov,'f_as'),filter:ov.dataset.receiptFilter||'all'});if(result)opts.draftKey=result}catch(e){/* Los campos siguen abiertos para corregirlos. */}}
  function scheduleDraft(){clearTimeout(draftTimer);draftTimer=setTimeout(persistReview,180)}
  function sum(){return receiptReviewIssues(ov,collect(),t)}
  ov.dataset.receiptFilter=opts.filter||'all';
  for(const row of ov.querySelectorAll('[data-receipt-row]'))if(row.dataset.lineValidated==='true')row.dataset.confirmedKey=receiptRowFingerprint(ov,row);
  function changed(e){
    const row=e.target.closest('[data-receipt-row]');
    if(row){
      const fields=JSON.parse(row.dataset.editedFields),field=Object.keys(e.target.dataset).find(k=>['nm','pr','units','measure','unitpr','pn','stockqty','stockunit','shopping','purchased','credit','on'].includes(k));if(field&&!fields.includes(field))fields.push(field);row.dataset.editedFields=JSON.stringify(fields);
      row.dataset.validationRequired='true';
    }
    if(e.target.dataset.units!==undefined){const i=e.target.dataset.units;if(ov.querySelector(`[data-measure="${i}"]`).value==='ud')ov.querySelector(`[data-purchased="${i}"]`).value=e.target.value;const stock=ov.querySelector(`[data-stockqty="${i}"]`);stock.value=Number(e.target.value)*Number(stock.dataset.perUnit)}
    if(e.target.dataset.stockqty!==undefined){const i=e.target.dataset.stockqty,units=receiptFieldNumber(ov.querySelector(`[data-units="${i}"]`));if(units>0&&receiptFieldNumber(e.target)>0)e.target.dataset.perUnit=String(receiptFieldNumber(e.target)/units)}
    if(e.target.dataset.measure!==undefined){const i=e.target.dataset.measure,stock=ov.querySelector(`[data-stockqty="${i}"]`),qty=receiptFieldNumber(ov.querySelector(`[data-units="${i}"]`));stock.dataset.perUnit=e.target.value===row.dataset.defaultMeasure?row.dataset.defaultStockScale:e.target.value==='kg'?'1000':'1';stock.value=qty*Number(stock.dataset.perUnit);ov.querySelector(`[data-stockunit="${i}"]`).value=e.target.value===row.dataset.defaultMeasure?row.dataset.defaultStockUnit:e.target.value==='kg'?'g':'ud'}
    if(e.target.dataset.credit!==undefined){const prior=pending?.pendingInventory.find(p=>p.id===e.target.value);if(prior)ov.querySelector(`[data-pn="${e.target.dataset.credit}"]`).value=prior.pantryId}
    if(row){
      const i=row.dataset.receiptRow;if(ov.querySelector(`[data-measure="${i}"]`).value===row.dataset.defaultMeasure){if(e.target.dataset.stockqty!==undefined)row.dataset.defaultStockScale=ov.querySelector(`[data-stockqty="${i}"]`).dataset.perUnit;if(e.target.dataset.stockunit!==undefined)row.dataset.defaultStockUnit=e.target.value}
      row.dataset.lineValidated=String(row.dataset.confirmedKey===receiptRowFingerprint(ov,row));
    }
    sum();scheduleDraft();
  }
  ov.addEventListener('input',changed);ov.addEventListener('change',changed);
  ov.addEventListener('click',e=>{
    const filter=e.target.closest('button[data-receipt-filter]');if(filter){ov.dataset.receiptFilter=filter.dataset.receiptFilter;sum();scheduleDraft();return}
    const calculated=e.target.closest('[data-use-calculated]');if(calculated){const i=calculated.dataset.useCalculated,qty=receiptFieldNumber(ov.querySelector(`[data-units="${i}"]`)),unit=receiptFieldNumber(ov.querySelector(`[data-unitpr="${i}"]`)),field=ov.querySelector(`[data-pr="${i}"]`);field.value=(Math.round(qty*unit*100)/100).toFixed(2).replace('.',',');field.dispatchEvent(new Event('input',{bubbles:true}));return}
    const button=e.target.closest('[data-validate-line]');if(!button)return;const i=Number(button.dataset.validateLine),row=ov.querySelector(`[data-receipt-row="${i}"]`),check=sum(),errors=check.issues.filter(x=>x.row===i&&!x.message.startsWith('Esta corrección anterior'));if(row.dataset.unmatchedCorrection==='true'&&!errors.length){row.dataset.unmatchedCorrection='false';}if(errors.length){receiptFocusIssue(ov,errors[0]);return}row.dataset.lineValidated='true';row.dataset.confirmedKey=receiptRowFingerprint(ov,row);row.open=false;sum();persistReview();
  });
  ov.querySelector('#tkPhoto')?.addEventListener('click',()=>receiptShowPhoto(opts.file));
  ov.querySelector('#tkCheckTotal').onclick=()=>receiptFocusIssue(ov,{field:'total'});
  function addLine(){const current=collect(true);current.lines.push({name:'',nice:'',units:1,unit:NaN,price:NaN,quantityObserved:true,editedFields:['nm','pr']});persistReview();ov.remove();ticketReview(current,text,{...opts,focusLast:true})}
  ov.querySelector('#tkAddLine').onclick=addLine;ov.querySelector('[data-receipt-add]').onclick=addLine;
  ov.querySelector('#tkBackToText').onclick=()=>{persistReview();ov.remove();ticketTranscription(receiptTextForEdit(collect(true)),{file:opts.file,imageHash:t.imageHash,confidence:t.ocrConfidence,engine:t.ocrEngine,lines:t.ocrLines,pendingId:t.pendingBuyId,draftKey:opts.draftKey})};
  ov.querySelector('#tkCrop')?.addEventListener('click',async()=>{
    if(busy)return;persistReview();const current=collect(true),cropped=await cropTicketImage(opts.file);if(!cropped||!ov.isConnected)return;busy=true;receiptSaving(ov,true);ov.querySelector('[data-s="ok"]').disabled=true;const readOptions=receiptReadOptions(ov);
    try{receiptSaveStatus(ov,'Volviendo a leer la foto…');const result=await ocrText(cropped,n=>{if(ov.isConnected)receiptSaveStatus(ov,'Volviendo a leer la foto… '+n+' %')},readOptions);if(!ov.isConnected)return;const parsed=receiptFromText(result.text,{...result,imageHash:t.imageHash,pendingId:t.pendingBuyId}),updated=receiptMergeCorrections(current,parsed);ov.remove();ticketReview(updated,result.text,{...opts,file:cropped})}
    catch(e){if(ov.isConnected)receiptSaveStatus(ov,e.message||'No se pudo releer. Tus cambios se conservan.',true)}finally{readOptions.dispose();busy=false;receiptSaving(ov,false);if(ov.isConnected)ov.querySelector('[data-s="ok"]').disabled=false}
  });
  ov.addEventListener('click',e=>{if(!busy&&(e.target===ov||e.target.closest('[data-s="cancel"]')))persistReview()},true);
  const visibility=()=>{if(document.hidden&&!busy)persistReview()};document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',persistReview);
  const observer=new MutationObserver(()=>{if(!ov.isConnected){clearTimeout(draftTimer);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',persistReview);observer.disconnect();if(ov.dataset.receiptComplete!=='true')render()}});observer.observe(document.body,{childList:true,subtree:true});
  ov.addEventListener('keydown',e=>{if(e.key==='Escape'&&!busy)persistReview()},true);
  if(opts.file&&t.imageHash)receiptDeadline(ReceiptArchive.put(t.imageHash,opts.file),2500,'Archivo local no disponible').catch(()=>{});
  sum();persistReview();
  if(opts.focusLast)receiptFocusIssue(ov,{row:t.lines.length-1,field:'name'});
  async function run(){
    if(busy)return;
    try{const check=sum();if(!check.ok){if(check.issues.length)receiptFocusIssue(ov,check.issues[0]);else{ov.dataset.receiptFilter='all';sum();if(opts.file)receiptShowPhoto(opts.file);else{const price=ov.querySelector('[data-pr]');if(price){price.focus({preventScroll:true});price.scrollIntoView({block:'center'})}else ov.querySelector('#tkBalance').scrollIntoView({block:'start'})}}return}}
    catch(e){receiptSaveStatus(ov,e.message||'No se pueden leer los datos. Tus cambios se conservan.',true);return}
    const button=ov.querySelector('[data-s="ok"]');busy=true;button.disabled=true;
    try{clearTimeout(draftTimer);persistReview();receiptSaving(ov,true);const receipt=receiptConfirmReading(collect()),choice=val(ov,'f_as');const result=await saveReceiptPurchase(receipt,opts.file,{removePurchased:ov.querySelector('#f_rm').checked,matchId:choice&&choice!=='__new'?choice:'',confirmNew:choice==='__new'},message=>receiptSaveStatus(ov,message),opts.draftKey);ov.dataset.receiptComplete='true';clearTimeout(draftTimer);ov.remove();toast(receiptMessage(result)+(result.photoWarning?' · '+result.photoWarning:''))}
    catch(e){receiptSaveStatus(ov,receiptSaveError(e),true)}finally{receiptSaving(ov,false);busy=false;button.disabled=false}
  }
  return ov;
}

/* ---------- recetas y despensa de ejemplo ---------- */
const CK_SEED=[
['Lentejas con verduras','comida',4,45,['fuego'],'Lentejas pardinas, 400 g|Zanahoria, 2|Patata, 2|Cebolla, 1|Pimiento verde, 1|Ajo, 2 dientes|Chorizo, 100 g|Pimentón dulce, 1 cucharadita|Aceite de oliva, 2 cucharadas|Sal, 1 pizca','Sofríe la cebolla, el pimiento y el ajo picados. Añade el chorizo y el pimentón.\nIncorpora las lentejas lavadas, la zanahoria y la patata en trozos y cubre con agua.\nCuece 35-40 min a fuego medio hasta que estén tiernas.'],
['Tortilla de patatas','ambas',4,40,['fuego'],'Patata, 4|Huevos, 6|Cebolla, 1|Aceite de oliva, 200 ml|Sal, 1 pizca','Pela y corta las patatas y la cebolla finas. Pocha en abundante aceite 20 min.\nEscurre y mezcla con los huevos batidos y sal.\nCuaja en la sartén 3 min por cada lado.'],
['Pollo al horno con patatas','comida',4,60,['horno'],'Muslos de pollo, 1 kg|Patata, 4|Cebolla, 1|Limón, 1|Ajo, 4 dientes|Aceite de oliva, 3 cucharadas|Tomillo, 1 cucharadita|Sal, 1 pizca','Corta las patatas y la cebolla en rodajas y ponlas en la bandeja.\nColoca encima el pollo salpimentado con ajo, limón, tomillo y aceite.\nHornea a 200 °C durante 50 min dándole la vuelta a mitad.'],
['Macarrones con tomate y atún','comida',4,25,['fuego'],'Macarrones, 400 g|Tomate frito, 400 g|Atún en aceite, 3 latas|Cebolla, 1|Queso rallado, 80 g|Aceite de oliva, 1 cucharada','Cuece la pasta según el paquete.\nSofríe la cebolla, añade el tomate y el atún escurrido.\nMezcla con la pasta y sirve con queso rallado.'],
['Merluza en salsa verde','cena',2,25,['fuego'],'Merluza, 400 g|Ajo, 3 dientes|Perejil, 1 cucharada|Harina de trigo, 1 cucharada|Caldo de pescado, 250 ml|Aceite de oliva, 3 cucharadas|Sal, 1 pizca','Dora el ajo laminado en aceite, añade la harina y el caldo poco a poco.\nIncorpora la merluza y el perejil y cuece 6-8 min moviendo la cazuela.'],
['Crema de calabacín','cena',4,30,['fuego','batidora'],'Calabacín, 3|Patata, 1|Cebolla, 1|Quesitos, 4|Aceite de oliva, 2 cucharadas|Sal, 1 pizca','Pocha la cebolla, añade el calabacín y la patata troceados y cubre de agua.\nCuece 20 min, añade los quesitos y tritura.'],
['Arroz con pollo','comida',4,45,['fuego'],'Arroz redondo, 320 g|Contramuslos de pollo, 500 g|Pimiento rojo, 1|Tomate triturado, 200 g|Ajo, 2 dientes|Caldo de pollo, 1 l|Pimentón dulce, 1 cucharadita|Aceite de oliva, 3 cucharadas','Dora el pollo troceado, añade el pimiento y el ajo, luego el tomate y el pimentón.\nIncorpora el arroz, nácaralo y añade el caldo caliente.\nCuece 18 min y deja reposar 5.'],
['Salmón al horno con verduras','cena',2,25,['horno'],'Salmón, 2 lomos|Calabacín, 1|Pimiento rojo, 1|Cebolla, 1|Limón, 1|Aceite de oliva, 2 cucharadas|Sal, 1 pizca','Hornea las verduras en tiras 10 min a 200 °C.\nAñade el salmón con limón y aceite y hornea 12 min más.'],
['Garbanzos con espinacas','comida',4,25,['fuego'],'Garbanzos cocidos, 2 botes|Espinacas, 300 g|Ajo, 3 dientes|Pan, 2 rebanadas|Comino, 1 cucharadita|Pimentón dulce, 1 cucharadita|Aceite de oliva, 3 cucharadas','Fríe el pan y el ajo, májalos con comino y pimentón.\nSaltea las espinacas, añade los garbanzos escurridos, el majado y un poco de agua. Cuece 10 min.'],
['Pechuga a la plancha con ensalada','cena',2,15,['plancha'],'Pechuga de pollo, 400 g|Lechuga, 1|Tomate, 2|Pepino, 1|Aceite de oliva, 2 cucharadas|Vinagre, 1 cucharada|Sal, 1 pizca','Haz la pechuga fileteada a la plancha 3-4 min por lado.\nPrepara la ensalada y alíñala.'],
['Espaguetis a la carbonara','ambas',4,20,['fuego'],'Espaguetis, 400 g|Bacon, 200 g|Huevos, 3|Queso parmesano, 80 g|Pimienta negra, 1 pizca','Cuece la pasta. Dora el bacon en tiras.\nMezcla huevos y queso; fuera del fuego, únelo a la pasta caliente con el bacon y un poco de agua de cocción.'],
['Albóndigas en salsa','comida',4,50,['fuego'],'Carne picada mixta, 500 g|Huevos, 1|Pan rallado, 50 g|Cebolla, 1|Zanahoria, 1|Tomate triturado, 400 g|Ajo, 2 dientes|Harina de trigo, 2 cucharadas|Aceite de oliva, 4 cucharadas','Mezcla la carne con huevo, ajo y pan rallado; forma bolas, enharina y dora.\nSofríe cebolla y zanahoria, añade tomate y las albóndigas. Cuece 20 min.'],
['Pisto con huevo','cena',4,40,['fuego'],'Calabacín, 1|Berenjena, 1|Pimiento rojo, 1|Pimiento verde, 1|Cebolla, 1|Tomate triturado, 400 g|Huevos, 4|Aceite de oliva, 4 cucharadas','Pocha las verduras en dados por orden de dureza.\nAñade el tomate y cuece 20 min. Sirve con un huevo frito o escalfado.'],
['Ensalada de pasta','ambas',4,20,[],'Pasta espirales, 300 g|Atún en aceite, 2 latas|Maíz dulce, 1 lata|Tomate cherry, 250 g|Huevos, 2|Aceitunas, 100 g|Aceite de oliva, 3 cucharadas','Cuece la pasta y los huevos y enfría.\nMezcla todo y aliña.'],
['Fajitas de pollo','cena',4,25,['fuego'],'Tortillas de trigo, 8|Pechuga de pollo, 500 g|Pimiento rojo, 1|Pimiento verde, 1|Cebolla, 1|Especias fajitas, 1 sobre|Queso rallado, 100 g|Aceite de oliva, 2 cucharadas','Saltea el pollo en tiras con las verduras y las especias.\nRellena las tortillas calientes con queso.'],
['Sopa de fideos','cena',4,20,['fuego'],'Caldo de pollo, 1.5 l|Fideos, 120 g|Huevos, 2|Jamón serrano, 80 g','Hierve el caldo, añade los fideos y cuece 5 min.\nSirve con huevo cocido y jamón picados.'],
['Lomo con pimientos','comida',4,30,['fuego'],'Lomo de cerdo, 600 g|Pimiento rojo, 2|Pimiento verde, 2|Ajo, 3 dientes|Aceite de oliva, 4 cucharadas|Sal, 1 pizca','Fríe los pimientos en tiras a fuego lento 20 min.\nHaz el lomo en filetes a la plancha con ajo.'],
['Revuelto de setas y gambas','cena',2,15,['fuego'],'Champiñones, 250 g|Gambas peladas, 200 g|Huevos, 4|Ajo, 2 dientes|Aceite de oliva, 2 cucharadas','Saltea ajo, champiñones y gambas.\nAñade los huevos batidos y cuaja suave.'],
['Patatas con costillas','comida',4,60,['fuego'],'Costillas de cerdo, 600 g|Patata, 5|Pimiento verde, 1|Cebolla, 1|Tomate triturado, 200 g|Pimentón dulce, 1 cucharadita|Laurel, 2 hojas|Aceite de oliva, 3 cucharadas','Dora las costillas, sofríe cebolla y pimiento, añade tomate y pimentón.\nIncorpora las patatas chascadas, cubre de agua y cuece 35 min.'],
['Gazpacho','ambas',4,15,['batidora'],'Tomate, 1 kg|Pepino, 1|Pimiento verde, 1|Ajo, 1 diente|Pan, 1 rebanada|Aceite de oliva, 100 ml|Vinagre, 2 cucharadas|Sal, 1 pizca','Tritura todo muy bien, cuela si quieres y enfría.'],
['Hamburguesas caseras','cena',4,20,['plancha'],'Carne picada de vacuno, 500 g|Pan de hamburguesa, 4|Queso en lonchas, 4 lonchas|Lechuga, 1|Tomate, 2|Cebolla, 1','Forma 4 hamburguesas y hazlas a la plancha 3-4 min por lado.\nMonta con queso, lechuga, tomate y cebolla.'],
['Dorada a la espalda','cena',2,25,['horno'],'Dorada, 2|Ajo, 4 dientes|Patata, 2|Vinagre, 1 cucharada|Aceite de oliva, 5 cucharadas|Perejil, 1 cucharada','Hornea las patatas en rodajas 15 min a 200 °C.\nPon encima la dorada abierta y hornea 12-15 min. Riega con ajo frito, vinagre y perejil.'],
['Coliflor gratinada','cena',4,35,['horno','fuego'],'Coliflor, 1|Leche, 500 ml|Harina de trigo, 40 g|Mantequilla, 40 g|Queso rallado, 100 g|Nuez moscada, 1 pizca','Cuece la coliflor en ramilletes 10 min.\nHaz una bechamel, cubre la coliflor, pon queso y gratina 10 min.'],
['Cocido de garbanzos','comida',6,150,['olla'],'Garbanzos secos, 500 g|Morcillo de ternera, 400 g|Gallina, 1/4|Tocino, 150 g|Chorizo, 1|Hueso de jamón, 1|Zanahoria, 2|Patata, 3|Repollo, 1/2|Fideos, 100 g','Pon los garbanzos en remojo la noche antes.\nCuece las carnes y huesos, añade los garbanzos y cuece 2 h (25 min en olla rápida).\nAñade patata y zanahoria al final y haz la sopa con el caldo y los fideos.']
];
function seedRecipes(){
  let n=0;CK_SEED.forEach(([name,meal,servings,time,appl,ings,steps])=>{if(recipeByName(name))return;
    S.recipes.push({id:uid(),name,meal,servings,time,appl,ingredients:ings.split('|').map(l=>{const i=l.indexOf(',');return{name:l.slice(0,i).trim(),qty:l.slice(i+1).trim()}}),steps,added:'2000-01-01',made:[],status:'probar',seed:true});n++});
  save();toast(n?n+' recetas añadidas':'Ya las tenías todas');
}
const CK_SEEDPAN=[['Aceite de oliva',1000,'ml',500],['Sal',1000,'g',200],['Arroz',1000,'g',500],['Pasta',500,'g',250],['Huevos',6,'ud',4,'Nevera'],['Leche',3000,'ml',1000,'Despensa'],['Tomate frito',400,'g',400],['Cebolla',3,'ud',1],['Ajo',10,'ud',3],['Patata',2000,'g',500]];
function seedPantry(){
  CK_SEEDPAN.forEach(([name,n,u,min,loc])=>{if(pantryFind(name))return;S.pantry=[...(S.pantry||[]),{id:uid(),name,n,u,min,loc:loc||'Despensa',auto:true,at:today()}]});
  save();toast('Despensa preparada: ajusta las cantidades con − y +');
}

/* ---------- acciones ---------- */
const CK_ACT={
  shopAddFocus:()=>{const input=$('#qItem');input?.scrollIntoView({block:'center'});input?.focus({preventScroll:true})},
  habitSchedule:d=>habitSchedule(d.v,d.lid||curList().id),
  repairHabit:d=>repairHabit(d.v,d.lid||curList().id),
  laterEdit:d=>laterEdit(d.id), laterMove:d=>laterMove(d.id),
  panRemove:d=>confirmRemovePantry(d.id),
  ckTab:d=>{ui.ckTab=d.v==='recetas'?'lista':d.v;if(ui.ckTab==='novedades')ui.novCat=null;render();$('#app').scrollTop=0},
  prodCat:d=>{ui.prodCat=d.v;ui.prodSub=null;ui.prodN=40;render();const g=document.querySelector('.ck-cats');if(g)g.querySelector('.on')?.scrollIntoView({inline:'center',block:'nearest'})},
  novCat:d=>{ui.novCat=d.v===''?null:+d.v;render()},
  prodMore:()=>{ui.prodN=(ui.prodN||40)+40;render()},
  prodClear:()=>{const f=$('#qProd');ui.prodQ='';ui.prodN=40;clearTimeout(ui._pt);if(f){f.value='';updateProductSearch();f.focus()}else render()},
  prodQ:d=>{ui.prodQ=d.v;ui.prodN=40;render();const f=$('#qProd');if(f){f.focus();f.setSelectionRange(f.value.length,f.value.length)}},
  prodSub:d=>{ui.prodSub=d.v===''?null:+d.v;ui.prodN=40;render()},
  favToggle:d=>{const was=isFav(d.id,cartList());toggleFav(d.id,cartList());toast(was?'Quitado de habituales':'⭐ Añadido a habituales')},
  cartStep:d=>{if(!MC)return;const p=prod(MC.byId.get(d.id));const i=cartOf(d.id);cartSet(p,(i?i.units||1:0)+(+d.v));save()},
  homeAdd:d=>{if(!MC)return;const p=prod(MC.byId.get(d.id));const x=pantryAddProd(p,1);save();toastUndo('🏠 '+x.loc+': '+fmtAmt(x.n,x.u)+' de '+p.name)},
  panCart:d=>{const x=find(S.pantry||[],d.id);if(!x)return;const p=x.mid&&MC&&MC.byId.get(x.mid);
    if(p){const i=cartOf(x.mid);if(i){toast('Ya está en la cesta');return}cartSet(prod(p),1)}else{if(cartItems().some(i=>norm(i.name)===norm(x.name))){toast('Ya está en la cesta');return}S.items.push(pantryItem(x,cartList()))}
    save();toast(x.name+' a la cesta')},
  ckSeed:seedRecipes,ckSeedPan:seedPantry,
  ckNewRec:()=>recipeEdit(null),
  ckRec:d=>recipeView(find(S.recipes,d.id)),
  recF:d=>{ui.recF=d.v;render()},
  panF:d=>{ui.panF=d.v;render()},
  pantryFinished:()=>finishedPantrySheet(),
  ckNewPan:()=>panSheet(null),
  ckPan:d=>panSheet(find(S.pantry||[],d.id)),
  panFinished:d=>{try{const result=markPantryFinished(d.id,'');save();toastUndo(result.name+' · agotado'+(result.added?' y añadido a Compras':''))}catch(e){toast(e.message)}},
  panPresent:d=>{const x=find(S.pantry||[],d.id);if(!x)return;setPantryPresent(x);save();toastUndo(x.name+' · en casa')},
  ckPeople:d=>ckSet('people',Math.max(1,ck().people+(+d.v))),
  ckAppl:d=>{const a=ck().appl;ckSet('appl',a.includes(d.v)?a.filter(x=>x!==d.v):[...a,d.v])},
  ckApplNew:()=>{sheet('Otro electrodoméstico',`<input class="field" id="f_t" placeholder="Ej.: Panificadora">`,{onSave:ov=>{const v=val(ov,'f_t');if(!v)return false;const c=ck();S.cook=Object.assign({},S.cook,{applX:[...new Set([...(c.applX||[]),v])],appl:[...new Set([...c.appl,v])]});save()}})},
  ckVetoAdd:()=>{const el=$('#qVeto');const vs=el.value.split(',').map(s=>s.trim()).filter(Boolean);if(!vs.length)return;const c=ck();ckSet('vetoes',[...new Set([...c.vetoes,...vs])]);toast('Vetado: '+vs.join(', '))},
  ckSuggest:d=>shoppingSuggest(d),
  ckSuggestLearn:()=>shoppingLearningSheet(),
  ckBuys:()=>buysSheet(),
  ckPendingReceipt:d=>ticketFlow({pendingId:d.id}),
  ckReceiptDraft:d=>resumeReceiptDraft(d.id),
  ckSpend:()=>spendSheet(),
  ckMarket:()=>marketSheet(),
  toggleItem:d=>{const i=find(S.items,d.id);if(!i)return;
    if(!i.done&&!ui.me){whoAmI(()=>CK_ACT.toggleItem(d));return}
    i.done=!i.done;
    if(i.done){i.doneBy=meName();i.doneAt=Date.now();noteStaplePurchase(i)}
    else{delete i.doneBy;delete i.doneAt}
    save();toastUndo(i.done?'✓ '+i.name+' al carro':i.name+' vuelve a pendientes')},
  itemStep:d=>{const i=find(S.items,d.id);if(!i)return;const u=(i.units||1)+(+d.v);
    if(u<=0){S.items=S.items.filter(x=>x.id!==i.id);save();toastUndo(i.name+' quitado de la lista');return}
    setUnits(i,u);save()},
  habAdd:d=>habitAdd(d.v,d.lid||curList().id),
  sugAdd:d=>{if(!MC)return;const p=MC.byId.get(d.id);if(!p)return;if(addToList({mid:d.id,name:p[1],units:1})){const el=$('#qItem');if(el){el.value='';drawQSug()}toast(p[1]+' a la lista')}},
  clearDone:()=>{const L=curList();const dn=S.items.filter(i=>i.listId===L.id&&i.done);const n=dn.length;if(!n)return;
    buySheet(dn,(store,fromTicket,record)=>{let p=0;if(!fromTicket)for(const item of dn){const before=new Map(S.pantry.map(x=>[x.id,Number(x.n||0)]));if(addToPantry(item)){p++;for(const x of S.pantry){const amount=Number(x.n||0)-(before.get(x.id)||0);if(amount>0&&record){const prior=record.pendingInventory.find(p=>p.pantryId===x.id&&p.unit===x.u);if(prior)prior.amount+=amount;else record.pendingInventory.push({id:uid(),name:item.name,mid:item.mid||'',pantryId:x.id,amount,unit:x.u})}}}}dn.forEach(i=>noteStaplePurchase(i));S.items=S.items.filter(i=>!(i.listId===L.id&&i.done));save();toastUndo('Compra terminada: '+n+' producto'+(n>1?'s':'')+(store?' · '+store:'')+(p?' · '+p+' a casa':''))})},
  shopPhoto:()=>shoppingProductPhoto(),
  aiPhoto:()=>{MC?photoFlow():loadMC().then(photoFlow)},
  aiKey:()=>aiKeySheet(),
  ckTicket:()=>ticketFlow(),
  ckStoreNew:()=>{sheet('Otro supermercado',`<input class="field" id="f_t" placeholder="Ej.: Covirán">`,{onSave:ov=>{const v=val(ov,'f_t');if(!v)return false;ckSet('stores',[...new Set([...ck().stores,v])])}})},
  ckStoreDel:d=>{const a=ck().stores.slice();if(/^(Mercadona|Mercadillo)$/.test(a[+d.v]))return;const x=a.splice(+d.v,1)[0];ckSet('stores',a);toastUndo(x+' quitado')},
  ckPrice:d=>productPicker(d.v,()=>{save()},d.v),
  ckVetoDel:d=>{const v=ck().vetoes.slice();v.splice(+d.v,1);ckSet('vetoes',v)}
};

document.addEventListener('input',e=>{
  if(e.target.id==='qRec'){ui.recQ=e.target.value;clearTimeout(ui._rt);ui._rt=setTimeout(()=>{render();const f=$('#qRec');if(f){f.focus();f.setSelectionRange(f.value.length,f.value.length)}},250)}
});
document.addEventListener('compositionstart',e=>{if(e.target.id==='qProd')clearTimeout(ui._pt)});
document.addEventListener('compositionend',e=>{if(e.target.id==='qProd')scheduleProductSearch(e)});
document.addEventListener('input',e=>{
  if(e.target.id==='qProd')scheduleProductSearch(e);
});
document.addEventListener('input',e=>{if(e.target.id==='qItem'){clearTimeout(ui._qs);ui._qs=setTimeout(drawQSug,200)}});
document.addEventListener('change',e=>{
  if(e.target.id==='ckBudgetW'){const v=parseFloat(e.target.value);ckSet('budgetW',v>0?Math.round(v*100)/100:0)}
  if(e.target.id==='ckBudgetM'){const v=parseFloat(e.target.value);ckSet('budgetM',v>0?Math.round(v*100)/100:0)}
  if(e.target.id==='ckSort'){ui.recSort=e.target.value;render()}
});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='qVeto')CK_ACT.ckVetoAdd()});

// Si falla una foto del inventario, mostrar su nombre en una fila estable.
document.addEventListener('error',e=>{const img=e.target;if(img.matches?.('[data-habit-img],[data-pantry-img]')){img.hidden=true;if(img.nextElementSibling)img.nextElementSibling.hidden=false;if(img.matches('[data-pantry-img]')){pantryPhotoFailures.add(img.dataset.pantryPath);const card=img.closest('[data-pantry-card]');if(card){card.classList.add('is-text');card.querySelector('.pantry-name').hidden=false}}}},true);
