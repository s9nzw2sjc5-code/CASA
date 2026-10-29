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
const CK_STORES=['Mercadona','Lidl','Carrefour','Dia','Aldi','Mercado / frutería'];
const ck=()=>Object.assign({people:2,budget:50,vetoes:[],appl:['horno','fuego','micro'],meals:['comida','cena'],rej:{},stores:CK_STORES},S.cook||{});
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
    d.byId=new Map(d.p.map(p=>[p[0],p]));d.w=d.p.map(p=>words(p[1]));d.subs=d.subs||[];buildVocab(d);MC=d;mcCache.clear();
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
  const hist=[...(old.hist||[]),[o.at||today(),o.store,o.price,o.n||0,o.d||'m']].slice(-12);
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
  const qw=qWords(q);if(!qw.length)return[];
  const nq=norm(q).trim(),fav=new Set(ck().fav||[]),usual=new Set((ck().usual||[]).slice(0,60)),out=[];
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
const pantryLow=x=>x.min>0?x.n<=x.min:x.full>0&&x.n<=x.full*.2;
function pantryStep(x){if(x.u==='ud')return 1;const p=x.mid&&MC&&MC.byId.get(x.mid);return p?prod(p).size:x.n>=1000?250:100}
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
  const x=pantryFind(i.name);if(!x)return false;
  let n=i.pq&&i.pq.d===pUnit(x)?i.pq.n:null;
  if(n==null){const q=parseQty(i.qty);n=q?toDim(q,i.name,pUnit(x)):null}
  if(n==null){const p=x.mid&&MC&&MC.byId.get(x.mid);n=p?prod(p).size:(x.u==='ud'?1:0)}
  if(!n)return false;x.n=Math.round((x.n+n)*10)/10;x.full=Math.max(x.full||0,x.n);x.at=today();return true;
}
function autoPantry(){
  let c=0;const L=S.lists.find(l=>l.id==='super')||S.lists[0];
  (S.pantry||[]).forEach(x=>{if(x.auto&&pantryLow(x)&&x.snooze!==today()&&!S.items.some(i=>!i.done&&norm(i.name)===norm(x.name))){S.items.push(pantryItem(x,L.id));c++}});
  if(c)save();return c;
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
// Habituales marcados con estrella: códigos de Mercadona o «n:nombre» para los demás
const isFav=k=>(ck().fav||[]).includes(k);
function toggleFav(k){const f=ck().fav||[];ckSet('fav',f.includes(k)?f.filter(x=>x!==k):[k,...f])}
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
  x.n=Math.round((x.n+p.size*(packs||1))*10)/10;x.full=Math.max(x.full||0,x.n,p.size);x.at=today();usual(p.id);
  return x;
}
// Lo que vale «lleno» en la barra
const pantryFull=x=>{const p=x.mid&&MC&&MC.byId.get(x.mid);return Math.max(x.full||0,x.n,p?prod(p).size:0,x.min*2||0,x.u==='ud'?1:100)};
const pantryPct=x=>Math.round(x.n/pantryFull(x)*100);

/* ---------- vistas ---------- */
const CK_CATEMO={'Aceite, especias y salsas':'🫒','Agua y refrescos':'🥤','Aperitivos':'🥨','Arroz, legumbres y pasta':'🍝','Azúcar, caramelos y chocolate':'🍫','Bebé':'🍼','Bodega':'🍷','Cacao, café e infusiones':'☕','Carne':'🥩','Cereales y galletas':'🥣','Charcutería y quesos':'🧀','Congelados':'🧊','Conservas, caldos y cremas':'🥫','Cuidado del cabello':'💇','Cuidado facial y corporal':'🧴','Fitoterapia y parafarmacia':'🌿','Fruta y verdura':'🥦','Huevos, leche y mantequilla':'🥚','Limpieza y hogar':'🧽','Maquillaje':'💄','Marisco y pescado':'🐟','Mascotas':'🐾','Panadería y pastelería':'🥖','Pizzas y platos preparados':'🍕','Postres y yogures':'🍮','Zumos':'🧃'};
function vCocina(){
  loadMC();
  let tab=ui.ckTab||'productos';if(tab==='menu'||tab==='lista')tab='productos';
  const low=(S.pantry||[]).filter(pantryLow).length,ci=cartItems();
  const sub={productos:'Elige qué va a la cesta y qué tienes en casa',recetas:S.recipes.length+' receta'+(S.recipes.length===1?'':'s')+' guardada'+(S.recipes.length===1?'':'s'),despensa:'Lo que tienes en casa y cuánto queda',ajustes:'Presupuesto, supermercados y electrodomésticos'}[tab];
  let h=`<h1>Compras</h1><p class="sub">${sub}</p>${heroStats([[ci.length,'en la cesta'],[eur0(cartTotal()),'cesta'],[(S.pantry||[]).filter(x=>x.n>0).length,'en casa'],[low,'se acaban']])}`;
  h+=ckSubTabs();
  h+=({productos:vCkProductos,recetas:vCkRecetas,despensa:vCkDespensa,ajustes:vCkAjustes}[tab]||vCkProductos)();
  return h+cartBar();
}
// Pestañas dentro de Compras
function ckSubTabs(){
  const tab=ui.ckTab||'lista',inStock=(S.pantry||[]).filter(x=>x.n>0).length;
  return`<div class="chips ck-tabs">${[['lista','📝 Lista'],['productos','🛍️ Productos'],['despensa','🏠 En casa'],['recetas','📖 Recetas'],['ajustes','⚙️ Ajustes']].map(([k,l])=>`<button class="chip ${tab===k?'on':''}" data-act="ckTab" data-v="${k}">${l}${k==='despensa'?` <span class="ck-n" aria-label="${inStock} productos con existencias">${inStock}</span>`:''}</button>`).join('')}</div>`;
}
function cartBar(){
  const ci=cartItems(),t=cartTotal();
  return`<div class="ck-cartbar"><button data-act="ckTab" data-v="lista"><span class="ck-cb-ic">🛒<b>${ci.length}</b></span><span class="ck-cb-t"><small>Cesta (estimación)</small><b>≈ ${eur(t)}</b></span><span class="ck-cb-go">Lista ›</span></button></div>`;
}
// Tarjeta de producto, como en la app de Mercadona
function prodCard(p){
  const ic=cartOf(p.id),u=ic?ic.units||1:0,x=pantryOf(p.id),prev=mcFresh()?MC.byId.get(p.id)[11]:0,fv=isFav(p.id);
  return`<div class="ck-card ${u?'in':''}">${prev?`<span class="ck-offer">Bajada</span>`:''}<button class="ck-fav ${fv?'on':''}" data-act="favToggle" data-id="${p.id}" aria-label="${fv?'Quitar de habituales':'Marcar como habitual'}">${fv?'★':'☆'}</button>
    <div class="ck-ci">${p.img?`<img src="https://prod-mercadona.imgix.net/images/${p.img}?fit=contain&h=480&w=480" alt="" loading="eager">`:''}</div>
    <div class="ck-cp">${prev?`<s>${eur(prev)}</s> `:''}<b class="${prev?'red':''}">${eur(p.price)}</b><small>/${p.d==='ud'&&p.size>1?'pack':'ud'}</small></div>
    <div class="ck-cn">${esc(p.name)}</div><small class="ck-cs">${esc(p.pack)} ${prodSize(p)}${p.ref?' · '+eur(p.ref)+'/'+esc(p.refFmt):''}</small>
    ${x?`<small class="ck-home">🏠 En casa: ${x.n>0?fmtAmt(x.n,x.u):'agotado'}</small>`:''}
    <div class="ck-ca">${u?`<button class="ck-st" data-act="cartStep" data-id="${p.id}" data-v="-1" aria-label="Quitar uno">${u>1?'−':'🗑'}</button><b class="ck-u">${u}</b><button class="ck-st plus" data-act="cartStep" data-id="${p.id}" data-v="1" aria-label="Añadir otro">+</button>`
      :`<button class="ck-add" data-act="cartStep" data-id="${p.id}" data-v="1">🛒 Cesta</button>`}<button class="ck-home-b" data-act="homeAdd" data-id="${p.id}" aria-label="Lo tengo en casa" title="Lo tengo en casa">🏠+</button></div></div>`;
}
const CK_HIDECAT=/Mascotas|Maquillaje|Bebé/;
function vCkProductos(){
  if(!MC)return`<p class="hint" style="margin-top:14px">Cargando productos de Mercadona…</p>`;
  const q=ui.prodQ||'',cat=ui.prodCat||'hab',sub=ui.prodSub;
  let a,title='',h='';
  h+=`<div class="ck-search"><input class="field" id="qProd" type="search" placeholder="🔍 Buscar en Mercadona (leche, pollo, tomate…)" value="${esc(q)}" autocomplete="off" enterkeyhint="search">${q?`<button class="ck-ib" data-act="prodClear" aria-label="Borrar búsqueda">✕</button>`:''}</div>`;
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
    h+=`<div class="chips ck-cats">${[['hab','⭐ Habituales'],['bajadas','🏷️ Bajadas de precio'],...MC.cats.filter(c=>!CK_HIDECAT.test(c)).map(c=>[c,(CK_CATEMO[c]||'')+' '+c])].map(([k,l])=>`<button class="chip ${cat===k?'on':''}" data-act="prodCat" data-v="${esc(k)}">${esc(l)}</button>`).join('')}</div>`;
    if(cat==='hab'){
      const fv=(ck().fav||[]).filter(k=>MC.byId.has(k)),rec=[...new Set([...cartItems().map(i=>i.mid),...(ck().usual||[]),...(S.pantry||[]).map(x=>x.mid)].filter(id=>id&&MC.byId.has(id)&&!fv.includes(id)))];
      if(fv.length)h+=`<h2>⭐ Tus habituales</h2><div class="ck-grid">${fv.map(id=>prodCard(prod(MC.byId.get(id)))).join('')}</div>`;
      else h+=`<p class="hint ck-help">Marca con <b>☆</b> los productos que compras siempre y los tendrás aquí y en la lista de Compras.</p>`;
      a=rec.map(id=>prod(MC.byId.get(id)));title=a.length?'Recientes y en casa':'';
      if(!fv.length&&!a.length)return h+`<div class="empty" style="margin-top:12px">Busca arriba o elige una sección para empezar.</div>`;
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
// Cambiar el código postal: lo hace la descarga diaria (GitHub), no el móvil
function cpNotice(){
  const want=ck().cp;if(!MC||!want||want===MC.cp)return'';
  return`<div class="ck-warn">⚠️ Has puesto el código postal <b>${esc(want)}</b>, pero los precios siguen siendo del <b>${esc(MC.cp)}</b>. Mercadona no deja leer sus precios desde el móvil, así que se descargan cada mañana en GitHub. Para cambiarlo ya:<ol style="margin:8px 0 0;padding-left:18px"><li>Abre <a href="https://github.com/s9nzw2sjc5-code/CASA/actions/workflows/mercadona.yml" target="_blank" rel="noopener">Precios de Mercadona en GitHub</a>.</li><li>Pulsa <b>Run workflow</b>, escribe ${esc(want)} y vuelve a pulsar <b>Run workflow</b>.</li><li>En unos 5 minutos la app tendrá los precios y bajadas de ese código postal (y los mantendrá cada día).</li></ol></div>`;
}
// Fecha y vigencia de los precios
const mcAgeH=()=>MC&&MC.at?(Date.now()-Date.parse(MC.at.length>10?MC.at+'Z':MC.at+'T05:00Z'))/36e5:999;
const mcFresh=()=>mcAgeH()<36;
const mcDate=()=>MC&&MC.at?new Date(Date.parse(MC.at.length>10?MC.at+'Z':MC.at+'T05:00Z')).toLocaleDateString('es-ES',{day:'numeric',month:'long'}):'';
function mcNotice(){
  if(!MC)return'';const want=ck().cp;
  if(want&&MC.cp&&want!==MC.cp)return`<div class="ck-warn">⚠️ Los precios son del código postal <b>${esc(MC.cp)}</b>, no del ${esc(want)}. <button class="link" data-act="ckTab" data-v="ajustes">Cómo cambiarlo</button></div>`;
  if(!mcFresh())return`<div class="ck-warn">⚠️ Precios del ${mcDate()}: pueden haber cambiado. Se actualizan solos cada mañana.</div>`;
  return'';
}

function vCkDespensa(){
  const f=ui.panF||'todo',all=S.pantry||[];
  let a=all.slice();
  if(f==='low')a=a.filter(pantryLow);else if(f!=='todo')a=a.filter(x=>(x.loc||'Despensa')===f);
  const low=all.filter(pantryLow);
  let h=`<div class="ck-actions" style="margin-top:12px"><button class="btn" data-act="aiPhoto">📸 Foto de la nevera o despensa</button></div>
  <div class="ck-actions" style="margin-top:8px"><button class="btn sec" data-act="ckTab" data-v="productos">+ Añadir productos</button><button class="btn sec" data-act="ckTicket">🧾 Subir tique</button></div>
  ${all.some(x=>x.n>0)?`<button class="btn sec ck-aibtn" data-act="aiRecipe">✨ Crear una receta con lo que tengo</button>`:''}
  ${low.length?`<button class="btn sec ck-lowbtn" data-act="ckLowShop">🛒 Pasar a la cesta lo que se acaba (${low.length})</button>`:''}
  <div class="chips" style="margin-top:10px">${[['todo','Todo'],['low','⚠️ Se acaba'],['Despensa','🥫 Despensa'],['Nevera','❄️ Nevera'],['Congelador','🧊 Congelador']].map(([k,l])=>`<button class="chip ${f===k?'on':''}" data-act="panF" data-v="${k}">${l}</button>`).join('')}</div>
  <p class="hint">Desliza la barra para decir cuánto queda. Para quitar un artículo, pulsa su papelera.</p>`;
  if(!all.length)return h+`<div class="empty" style="margin-top:14px">Aún no hay nada. Haz una <b>📸 foto</b> de la nevera o la despensa, pulsa <b>🏠+</b> en <b>Productos</b> o sube un tique.<br><br><button class="btn sec" data-act="ckSeedPan">Empezar con los básicos</button></div>`;
  if(!a.length)return h+`<div class="empty" style="margin-top:14px">Nada por aquí.</div>`;
  const locs=f==='todo'||f==='low'?CK_LOCS:[f];
  locs.forEach(l=>{const b=a.filter(x=>(x.loc||'Despensa')===l).sort((x,y)=>pantryLow(y)-pantryLow(x)||x.name.localeCompare(y.name,'es'));if(!b.length)return;
    h+=`<h2>${{Despensa:'🥫',Nevera:'❄️',Congelador:'🧊'}[l]} ${esc(l)}</h2><div class="list">`+b.map(panRow).join('')+`</div>`;
  });
  return h;
}
function panRow(x){
  const lw=pantryLow(x),full=pantryFull(x),pct=pantryPct(x),p=x.mid&&MC&&MC.byId.get(x.mid),inC=x.mid?cartOf(x.mid):cartItems().find(i=>norm(i.name)===norm(x.name));
  const step=x.u==='ud'?1:full>=2000?50:full>=500?25:5;
  return`<div class="ck-pan ${lw?'low':''}">${p&&p[9]?`<img src="https://prod-mercadona.imgix.net/images/${p[9]}?fit=contain&h=96&w=96" alt="" loading="eager">`:'<span class="ck-noimg">🥫</span>'}
    <div class="ck-pm"><button class="ck-pt" data-act="ckPan" data-id="${x.id}">${esc(x.name)}</button>
    <input class="ck-range" type="range" min="0" max="${full}" step="${step}" value="${x.n}" data-pid="${x.id}" style="--p:${pct}%" aria-label="Cuánto queda de ${esc(x.name)}">
    <small class="ck-pl" data-pl="${x.id}">${x.n>0?'Queda '+fmtAmt(x.n,x.u)+' · '+pct+' %':'Agotado'}${x.exp?` · ${x.exp<today()?'⚠️ caducado':'cad. '+relDate(x.exp)}`:''}</small></div>
    <button class="ck-ib ${inC?'on':''}" data-act="panCart" data-id="${x.id}" aria-label="${inC?'Ya está en la cesta':'Añadir a la cesta'}">${inC?'✓':'🛒'}</button><button class="ck-ib" data-act="panRemove" data-id="${x.id}" aria-label="Eliminar ${esc(x.name)} de la despensa" title="Eliminar de la despensa">🗑️</button></div>`;
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
  let h=`<button class="btn ck-aibtn" style="margin-top:12px" data-act="aiRecipe">✨ Crear una receta con lo que tengo</button>
  <div class="ck-actions" style="margin-top:8px"><button class="btn sec" data-act="ckNewRec">+ Nueva receta</button><button class="btn sec" data-act="ckLinkRec">🔗 Desde enlace</button></div>
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
  let h=`<h2>Cocina y presupuesto</h2><div class="list ck-set"><div class="row"><div class="row-main">Personas</div><button class="ck-ib" data-act="ckPeople" data-v="-1">−</button><b class="ck-num">${c.people}</b><button class="ck-ib" data-act="ckPeople" data-v="1">+</button></div>
  <div class="row"><div class="row-main">Presupuesto mensual de compra<br><small class="hint">Opcional. Déjalo vacío para ver solo lo gastado.</small></div><input class="field" id="ckBudgetM" type="number" inputmode="decimal" min="0" step="10" value="${c.budgetM||''}" placeholder="—" style="width:96px;text-align:right"> €</div>
  <div class="row"><div class="row-main">Código postal (precios de Mercadona)</div><input class="field" id="ckCP" inputmode="numeric" maxlength="5" value="${esc(c.cp||(MC&&MC.cp)||'')}" style="width:96px;text-align:right"></div>
</div>
  <h2>Mis electrodomésticos</h2><p class="hint" style="margin-top:-4px">Cada receta te dice cómo adaptarla a lo que tienes.</p><div class="ck-wrap">${[...CK_APPL,...(c.applX||[]).map(x=>[x,x])].map(([k,l])=>`<button class="chip ${c.appl.includes(k)?'on':''}" data-act="ckAppl" data-v="${esc(k)}">${esc(l)}</button>`).join('')}<button class="chip add" data-act="ckApplNew">+ Otro</button></div>
  <h2>Ingredientes vetados</h2><p class="hint" style="margin-top:-4px">Las recetas que los llevan se marcan en rojo.</p><div class="ck-wrap">${c.vetoes.map((v,i)=>`<button class="chip on" data-act="ckVetoDel" data-v="${i}">${esc(v)} ✕</button>`).join('')||'<span class="hint">Ninguno</span>'}</div>
  <div class="quick"><input class="field" id="qVeto" placeholder="Ej.: cilantro, setas, marisco" enterkeyhint="done"><button class="btn" data-act="ckVetoAdd">Vetar</button></div>
  <h2>Inteligencia artificial</h2><div class="list ck-set"><div class="row"><div class="row-main">${aiKey()?'✅ Activada en este móvil':'Fotos de la nevera y recetas con lo que tienes'}</div><button class="btn sec" data-act="aiKey">${aiKey()?'Cambiar clave':'Activar'}</button></div></div>
  <h2>Precios de Mercadona</h2>${cpNotice()}<div class="empty" style="text-align:left">${MC?`${MC.p.length.toLocaleString('es-ES')} productos con los precios de la tienda online de Mercadona para el CP <b>${esc(MC.cp||'18210')}</b> (almacén ${esc(MC.wh)}), del <b>${mcDate()}</b>. Se actualizan solos cada mañana.${mcFresh()?'':' <b>⚠️ Están desactualizados.</b>'}<br><br>Precios con «≈» = estimación. Lo gastado de verdad solo sale de lo que apuntáis o de los tiques.`:'Cargando precios…'}<br><br>Para afinar una receta, abre un ingrediente y elige el producto exacto que compras: la app lo recordará siempre.</div>
  <h2>Dónde compro</h2><p class="hint" style="margin-top:-4px">Al terminar la compra eliges dónde habéis comprado y lo que habéis pagado: ese precio se usará en tus recetas.</p><div class="ck-wrap">${c.stores.map((x,i)=>`<button class="chip ${x==='Mercadona'?'on':''}" data-act="ckStoreDel" data-v="${i}">${esc(x)}${x==='Mercadona'?'':' ✕'}</button>`).join('')}<button class="chip add" data-act="ckStoreNew">+ Supermercado</button></div>
  ${(S.buys||[]).length?`<button class="btn sec" style="width:100%;margin-top:10px" data-act="ckBuys">🧾 Historial de compras</button>`:''}
  ${Object.values(S.prices||{}).filter(e=>e.use!==false).length?`<h2>Precios de otros súper</h2>`+ul(Object.values(S.prices).filter(e=>e.use!==false).sort((a,b)=>a.name.localeCompare(b.name,'es')).map(e=>`<li class="row"><div class="row-main" data-act="ckPrice" data-v="${esc(e.name)}"><div class="row-title">${esc(e.name)}</div><div class="row-meta"><span>🏪 ${esc(e.store)}</span><span>${parse(e.at).toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</span></div></div><span class="row-side">${eur(e.price)}${e.qtxt?' / '+esc(e.qtxt):e.n?' / '+(e.d==='ud'?e.n+' ud':fmtAmt(e.n,'g')):''}</span></li>`)):''}
  <h2>Recetario</h2><button class="btn sec" style="width:100%" data-act="ckSeed">Añadir recetas básicas que falten</button>`;
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

function linkSheet(pre){
  const ov=sheet('Guardar receta desde enlace',`
    <label for="f_u">Enlace</label><input class="field" id="f_u" type="url" inputmode="url" value="${esc(pre&&pre.url||'')}" placeholder="https://www.instagram.com/reel/…">
    <label for="f_cap">Descripción (opcional)</label><textarea class="field" id="f_cap" rows="5" placeholder="En Instagram o TikTok: abre la publicación, mantén pulsado el texto, «Copiar» y pégalo aquí. Así la app saca los ingredientes.">${esc(pre&&pre.text||'')}</textarea>
    <p class="hint">Consejo: en Android puedes usar «Compartir → Casa» desde Instagram o TikTok si tienes la app instalada en la pantalla de inicio.</p>`,
  {saveLabel:'Seguir',onSave:ov=>{
    const url=val(ov,'f_u'),cap=ov.querySelector('#f_cap').value;
    if(!url&&!cap.trim()){toast('Pega un enlace o la descripción');return false}
    const old=url&&S.recipes.find(r=>r.url===url);if(old){toast('Ya la tenías guardada');recipeView(old);return}
    fetchLinkTitle(url).then(t=>recipeEdit(null,{url,name:t||(pre&&pre.title)||'',caption:cap}));
  }});
  return ov;
}

function productPicker(q,onPick,key){
  const c=ck(),e=key&&(S.prices||{})[norm(key)];
  const ov=sheet(key?'¿Dónde compras '+key.toLowerCase()+'?':'Producto de Mercadona',`${key?`<details ${e&&e.use!==false?'open':''}><summary class="link">🏪 Lo compro en otro supermercado</summary>
    <div class="grid2"><div><label for="f_st">Supermercado</label><select class="field" id="f_st">${opt(c.stores.filter(x=>x!=='Mercadona').map(x=>[x,x]),e&&e.store!=='Mercadona'?e.store:'')}</select></div>
    <div><label for="f_pr">Precio (€)</label><input class="field" id="f_pr" type="number" inputmode="decimal" step="0.01" min="0" value="${e&&e.price||''}"></div></div>
    <label for="f_en">Envase (opcional)</label><input class="field" id="f_en" value="${e?esc(e.qtxt||(e.n?(e.d==='ud'?e.n+' ud':fmtAmt(e.n,'g')):'')):''}" placeholder="Ej.: 1 kg, 500 g, 6 ud">
    <button type="button" class="btn" data-k="own" style="width:100%;margin-top:10px">Usar este precio</button>
    ${e&&e.hist&&e.hist.length?`<p class="hint">Has pagado: ${e.hist.slice(-4).reverse().map(h=>esc(h[1])+' '+eur(h[2])+' ('+parse(h[0]).toLocaleDateString('es-ES',{day:'numeric',month:'short'})+')').join(' · ')}</p>`:''}</details>
    <h4>O elige el de Mercadona</h4>`:''}<input class="field" id="f_q" value="${esc(q)}" placeholder="Buscar producto" autocomplete="off"><div id="ckPP" class="ck-pick" style="max-height:52vh"></div><p class="hint">Precios de la tienda online de Mercadona (CP 18210)${MC?' del '+parse(MC.at).toLocaleDateString('es-ES',{day:'numeric',month:'short'}):''}.</p>`,{});
  ov.addEventListener('click',ev=>{if(!ev.target.closest('[data-k="own"]'))return;
    const pr=parseFloat(String(val(ov,'f_pr')).replace(',','.'));if(!(pr>0)){toast('Escribe el precio');return}
    const q2=parseQty(val(ov,'f_en'));savePrice(key,{store:val(ov,'f_st'),price:pr,n:q2?q2.n:0,d:q2?q2.d:'m',qtxt:val(ov,'f_en')});mcCache.clear();
    ov.remove();onPick(userPrice(key))});
  const inp=ov.querySelector('#f_q'),box=ov.querySelector('#ckPP');
  const draw=()=>{if(!MC){box.innerHTML='<p class="hint">Cargando precios…</p>';loadMC().then(draw);return}
    const a=searchProducts(inp.value,40);
    box.innerHTML=a.map(p=>`<button type="button" class="ck-opt ck-prod" data-id="${p.id}">${p.img?`<img src="${prodImg(p)}" alt="" loading="eager">`:''}<span><b>${esc(p.name)}</b><small>${esc(p.pack)} ${prodSize(p)} · <b>${eur(p.price)}</b> · ${eur(p.ref)}/${esc(p.refFmt)}</small></span></button>`).join('')||'<p class="hint">Sin resultados</p>'};
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

function panSheet(x){
  const n=!x;x=x||{name:'',n:0,u:'g',min:0,loc:'Despensa',auto:true};
  const ov=sheet(n?'Añadir a la despensa':x.name,`
    <label for="f_t">Producto</label><div class="quick" style="margin:0"><input class="field" id="f_t" value="${esc(x.name)}" placeholder="Ej.: Arroz" style="flex:1"><button type="button" class="btn sec" data-k="mc">Mercadona</button></div>
    <p class="hint" id="f_mc">${x.mid&&MC&&MC.byId.get(x.mid)?(p=>esc(p.name)+' · '+prodSize(p)+' · '+eur(p.price))(prod(MC.byId.get(x.mid))):'Elige el producto de Mercadona para saber el precio y el tamaño del envase.'}</p>
    <div class="grid2"><div><label for="f_n">Cuánto queda</label><input class="field" id="f_n" type="number" min="0" step="any" value="${x.u==='ud'?x.n:(x.n>=1000&&x.n%100===0?x.n/1000:x.n)}"></div>
    <div><label for="f_u">Medida</label><select class="field" id="f_u">${opt([['g','g'],['kg','kg'],['ml','ml'],['l','L'],['ud','unidades']],x.u==='ud'?'ud':x.n>=1000&&x.n%100===0?(x.u==='ml'?'l':'kg'):x.u)}</select></div></div>
    <div class="grid2"><div><label for="f_mn">Avisar al bajar de</label><input class="field" id="f_mn" type="number" min="0" step="any" value="${x.min?(x.u!=='ud'&&x.n>=1000&&x.n%100===0?x.min/1000:x.min):''}" placeholder="0"></div>
    <div><label for="f_l">Dónde</label><select class="field" id="f_l">${opt(CK_LOCS.map(l=>[l,l]),x.loc||'Despensa')}</select></div></div>
    <label for="f_e">Caduca (opcional)</label><input class="field" id="f_e" type="date" value="${esc(x.exp||'')}">
    <label class="ing-row" style="display:flex;margin-top:12px;color:var(--ink);font-weight:500;font-size:.95rem"><input type="checkbox" id="f_a" ${x.auto?'checked':''}><span>Añadir solo a Compras cuando se acabe</span></label>`,
  {onSave:ov=>{
    let name=val(ov,'f_t');if(!name){toast('Escribe el producto');return false}
    name=name[0].toUpperCase()+name.slice(1);
    let u=val(ov,'f_u'),q=+val(ov,'f_n')||0,mn=+val(ov,'f_mn')||0;
    if(u==='kg'||u==='l'){q*=1000;mn*=1000;u=u==='kg'?'g':'ml'}
    const o={name,n:q,u,min:mn,loc:val(ov,'f_l'),exp:val(ov,'f_e'),auto:ov.querySelector('#f_a').checked,mid:ov.dataset.mid||x.mid||'',at:today()};
    if(n){if(pantryFind(name)&&norm(pantryFind(name).name)===norm(name)){toast('Ya está en la despensa');return false}S.pantry=[...(S.pantry||[]),Object.assign({id:uid()},o)]}
    else Object.assign(find(S.pantry,x.id),o);
    save();
  },onDelete:n?null:()=>removePantryItem(x.id)});
  ov.addEventListener('click',ev=>{if(!ev.target.closest('[data-k="mc"]'))return;
    productPicker(val(ov,'f_t'),p=>{ov.dataset.mid=p.id;const t=ov.querySelector('#f_t');if(!t.value)t.value=p.name.replace(/ Hacendado.*$/,'');
      ov.querySelector('#f_mc').textContent=p.name+' · '+prodSize(p)+' · '+eur(p.price);
      const us=ov.querySelector('#f_u');if(p.d==='ud')us.value='ud';else if(us.value==='ud')us.value=p.fmt==='l'?'ml':'g';
      if(n&&!+val(ov,'f_n'))ov.querySelector('#f_n').value=p.d==='ud'?p.size:(us.value==='kg'||us.value==='l'?p.size/1000:p.size)});
  });
}

/* ---------- Compras: lista con fotos, cantidades y tachado ---------- */
const imgUrl=(img,s)=>img?`https://prod-mercadona.imgix.net/images/${img}?fit=contain&h=${s}&w=${s}`:'';
const itemImg=i=>{const p=i.mid&&MC&&MC.byId.get(i.mid);return p?p[9]:''};
const monthKey=d=>(d||today()).slice(0,7);
const spentIn=m=>(S.buys||[]).filter(b=>monthKey(b.date)===m).reduce((a,b)=>a+(+b.total||0),0);
const monthName=m=>new Date(+m.slice(0,4),+m.slice(5,7)-1,1).toLocaleDateString('es-ES',{month:'long',year:'numeric'});
const hhmm=t=>t?new Date(t).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}):'';
const sameItem=(i,o)=>o.mid?i.mid===o.mid:!i.mid&&norm(i.name)===norm(o.name);
// Resumen de dinero: lo que vamos a gastar (estimado) y lo ya gastado este mes (real)
function moneyCard(pend){
  const c=ck(),m=monthKey(),spent=spentIn(m),est=pend.reduce((a,i)=>a+(i.price||0),0),noPrice=pend.filter(i=>!i.price).length,b=+c.budgetM||0;
  const pct=b?spent/b*100:0,st=!b?'':pct>100?'over':pct>=85?'near':'ok';
  return`<div class="ck-money">
    <div class="ck-mc"><small>🛒 Cesta actual · estimación</small><b>≈ ${eur(est)}</b><span>${pend.length} producto${pend.length===1?'':'s'}${noPrice?` · ${noPrice} sin precio`:''}</span></div>
    <button class="ck-mc ${st}" data-act="ckBuys"><small>💶 Gastado este mes</small><b>${eur(spent)}</b><span>${b?(spent<=b?'Quedan '+eur(b-spent)+' de '+eur0(b):'Te has pasado '+eur(spent-b)):monthName(m)}</span></button>
    ${b?`<div class="ck-mbar ${st}"><i style="width:${Math.min(100,pct)}%"></i></div>${st==='near'?'<small class="ck-mwarn">⚠️ Os acercáis al presupuesto del mes</small>':st==='over'?'<small class="ck-mwarn">⛔ Presupuesto del mes superado</small>':''}`:''}
    <div class="ck-mbtns"><button class="btn sec" data-act="ckSpend">+ Añadir gasto de compra</button><button class="btn sec" data-act="ckTicket">🧾 Subir tique</button></div>
  </div>`;
}
function itemRow(i){
  const img=itemImg(i),u=i.units||1;
  const meta=[!i.mid&&i.qty?esc(i.qty):'',i.mid&&i.qty?esc(i.qty.replace(/^\d+ × /,'')):'',i.store?'🏪 '+esc(i.store):'',i.by&&!/^(Menú|Despensa)$/.test(i.by)?'pidió '+esc(i.by):'',i.done&&i.doneAt?'✓ '+(i.doneBy?esc(i.doneBy)+' ':'')+hhmm(i.doneAt):''].filter(Boolean);
  return`<li class="row ck-it ${i.done?'is-done':''}">
    <button class="check sq ${i.done?'on':''}" data-act="toggleItem" data-id="${i.id}" aria-label="${i.done?'Desmarcar':'Tachar'} ${esc(i.name)}"></button>
    ${img?`<img class="ck-ith" src="${imgUrl(img,96)}" alt="" loading="eager">`:`<span class="ck-ith ck-ith0">${i.auto?'🔁':'🛒'}</span>`}
    <div class="row-main" data-act="editItem" data-id="${i.id}"><div class="row-title">${esc(i.name)}${isFav(i.mid||'n:'+i.name)?' <span class="ck-star">★</span>':''}</div>${meta.length?`<div class="row-meta">${meta.map(m=>`<span>${m}</span>`).join('')}</div>`:''}
      <div class="ck-irow">${i.done?`<span class="ck-u2">${u} ud</span>`:`<button class="ck-st sm" data-act="itemStep" data-id="${i.id}" data-v="-1" aria-label="${u>1?'Uno menos':'Quitar'}">${u>1?'−':'🗑'}</button><b class="ck-u2">${u}</b><button class="ck-st sm plus" data-act="itemStep" data-id="${i.id}" data-v="1" aria-label="Uno más">+</button>`}<span class="ck-ipr">${i.price?'≈ '+eur(i.price):''}</span></div></div></li>`;
}
// Habituales: los marcados con ☆ (con foto) y los de «cada X días»
function habSection(L){
  const fv=(ck().fav||[]),cards=fv.map(k=>{
    const p=!k.startsWith('n:')&&MC&&MC.byId.get(k),name=p?p[1]:k.slice(2),inL=S.items.find(i=>i.listId===L.id&&!i.done&&sameItem(i,{mid:p?k:'',name}));
    return`<div class="ck-hab ${inL?'in':''}">${p?`<img src="${imgUrl(p[9],120)}" alt="" loading="eager">`:'<span class="ck-hab0">⭐</span>'}<b>${esc(name)}</b>${p?`<small>${eur(p[3])}</small>`:''}
      ${inL?`<button class="ck-hb on" data-act="itemStep" data-id="${inL.id}" data-v="1" aria-label="Uno más de ${esc(name)}">✓ ${inL.units||1} · +</button>`:`<button class="ck-hb" data-act="habAdd" data-v="${esc(k)}">+ Añadir</button>`}</div>`});
  const st=S.staples.filter(s=>s.listId===L.id).sort((a,b)=>stapleLeft(a)-stapleLeft(b));
  if(!cards.length&&!st.length)return`<div class="head-row"><h2>⭐ Habituales</h2></div><p class="hint">Marca con ☆ los productos que compras siempre (en 🛍️ Productos o tocando un producto de la lista) y aparecerán aquí para añadirlos de un toque.</p>`;
  return`<div class="head-row"><h2>⭐ Habituales</h2><button class="link" data-act="ckTab" data-v="productos">+ Buscar</button></div><div class="staples ck-habs">${cards.join('')}${st.map(stapleCard).join('')}<button class="staple new" data-act="newStaple">+ Cada X días</button></div>`;
}
function vCompras(){
  loadMC();
  const L=curList(),items=S.items.filter(i=>i.listId===L.id),pend=items.filter(i=>!i.done),dn=items.filter(i=>i.done);
  let h=`<h1>Compras</h1><p class="sub">${esc(L.name)}: ${pend.length} por comprar${dn.length?' · '+dn.length+' en el carro':''}</p>`+ckSubTabs();
  h+=moneyCard(pend);
  h+=`<div class="chips" style="margin-top:12px">${S.lists.map(l=>`<button class="chip ${l.id===L.id?'on':''}" data-act="pickList" data-v="${l.id}">${esc(l.name)}</button>`).join('')}<button class="chip add" data-act="newList">+ Lista</button><button class="chip add" data-act="editList" data-id="${L.id}">Editar lista</button></div>`;
  h+=`<div class="ck-add2"><div class="quick" style="margin-top:12px"><input class="field" id="qItem" placeholder="Añadir producto (busca en Mercadona)" enterkeyhint="done" autocomplete="off" style="flex:2"><input class="field" id="qQty" placeholder="Cant." style="flex:.7"><button class="btn" data-act="quickItem" aria-label="Añadir producto">+</button></div>
    <div id="qSug" class="ck-qsug"></div>
    <select class="field" id="qSec" style="margin-top:8px">${S.sections.map(s=>`<option ${s===ui.lastSec?'selected':''}>${esc(s)}</option>`).join('')}</select></div>`;
  h+=habSection(L);
  if(!items.length)return h+`<div class="empty" style="margin-top:16px">Lista vacía. Añade productos arriba, desde ⭐ Habituales o en 🛍️ Productos.</div>${histLink()}`;
  const secs=[...S.sections,...new Set(items.map(i=>i.section).filter(s=>s&&!S.sections.includes(s)))];
  const rows=[];
  secs.forEach(sec=>{const a=pend.filter(i=>(i.section||'Otros')===sec);if(a.length){rows.push(`<li class="sec-head">${esc(sec)} · ${a.length}</li>`);rows.push(...a.map(itemRow))}});
  const lost=pend.filter(i=>!secs.includes(i.section||'Otros'));if(lost.length){rows.push(`<li class="sec-head">Otros</li>`);rows.push(...lost.map(itemRow))}
  if(dn.length){rows.push(`<li class="sec-head ck-done-h">✓ En el carro · ${dn.length}</li>`);rows.push(...dn.sort((a,b)=>(b.doneAt||0)-(a.doneAt||0)).map(itemRow))}
  h+=`<div style="margin-top:14px">${ul(rows)}</div>`;
  if(dn.length)h+=`<div class="ck-actions" style="margin-top:12px"><button class="btn" data-act="clearDone">✅ Terminar compra (${dn.length})</button></div><p class="hint">Al terminar, lo tachado sale de la lista y pasa a casa. Puedes apuntar lo que habéis pagado o subir el tique.</p>`;
  return h+histLink();
}
const histLink=()=>(S.buys||[]).length?`<button class="btn sec" style="width:100%;margin-top:12px" data-act="ckBuys">🧾 Historial de compras · repetir una compra</button>`:'';
// Añadir a la lista sin duplicar: si ya está, ofrece sumar una unidad
function addToList(o,lid){
  const L=lid||curList().id,ex=S.items.find(i=>i.listId===L&&!i.done&&sameItem(i,o));
  if(ex){sheet('Ya está en la lista',`<p>«${esc(ex.name)}» ya está en la lista (${ex.units||1} ud).</p>`,{saveLabel:'Sumar una más',onSave:()=>{const x=find(S.items,ex.id);if(!x)return;setUnits(x,(x.units||1)+1);save();toast(x.name+': '+x.units+' ud')}});return false}
  if(o.mid&&MC&&MC.byId.get(o.mid)){cartSet(prod(MC.byId.get(o.mid)),o.units||1,L)}
  else S.items.push(Object.assign({id:uid(),listId:L,section:S.secMem[norm(o.name)]||'Otros',qty:'',by:'',done:false,units:1,added:Date.now()},o));
  save();return true;
}
function quickItem(){
  const el=$('#qItem');const v=el.value.trim();if(!v)return;
  const sec=$('#qSec').value;ui.lastSec=sec;
  if(addToList({name:v,qty:$('#qQty').value.trim(),section:sec})){S.secMem[norm(v)]=sec;el.value='';$('#qQty').value='';const b=$('#qSug');if(b)b.innerHTML='';save()}
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
function buysSheet(){
  const all=(S.buys||[]).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.at||0)-(a.at||0));
  const months=[...new Set(all.map(b=>monthKey(b.date)))];
  const ov=sheet('Historial de compras',`<button type="button" class="btn sec" data-k="add" style="width:100%">+ Añadir gasto de compra</button>
    ${months.map(m=>{const bs=all.filter(b=>monthKey(b.date)===m);return`<h4>${esc(monthName(m))} · ${eur(spentIn(m))}</h4><div class="ck-box">${bs.map(b=>`<button type="button" class="ck-buy ck-bh" data-b="${b.id}"><span><b>${esc(b.store||'—')}</b> · ${relDate(b.date)}${b.manual?' · <small>a mano</small>':b.ticket?' · <small>🧾 tique</small>':''}<br><small>${b.note?esc(b.note)+' · ':''}${buyItems(b).length?buyItems(b).length+' producto'+(buyItems(b).length>1?'s':''):'sin productos'}</small></span><b>${b.total?eur(b.total):'<small>sin importe</small>'}</b></button>`).join('')}</div>`}).join('')||'<p class="hint">Aún no hay compras registradas.</p>'}`,{});
  ov.addEventListener('click',e=>{if(e.target.closest('[data-k="add"]')){ov.remove();spendSheet();return}
    const b=e.target.closest('[data-b]');if(b){ov.remove();buyDetail(find(S.buys,b.dataset.b))}});
}
// Una compra del historial: ver, editar, borrar o repetir productos (sin volver a contar el gasto)
function buyDetail(b){
  if(!b)return;const its=buyItems(b),L=curList();
  const inList=x=>S.items.some(i=>i.listId===L.id&&!i.done&&sameItem(i,x));
  const ov=sheet((b.store||'Compra')+' · '+parse(b.date).toLocaleDateString('es-ES',{day:'numeric',month:'long'}),`
    <div class="ck-total"><span>Pagado</span><b>${b.total?eur(b.total):'sin importe'}</b><small>${b.manual?'Gasto añadido a mano':b.ticket?'Registrado con tique':'Registrado al terminar la compra'}${b.by?' · '+esc(b.by):''}${b.note?' · '+esc(b.note):''}</small></div>
    ${its.length?`<h4>Repetir productos</h4><p class="hint" style="margin-top:0">Elige qué volver a añadir a «${esc(L.name)}». No cuenta otra vez el gasto.</p>
      <div class="ck-box">${its.map((x,k)=>{const p=x.mid&&MC&&MC.byId.get(x.mid),dup=inList(x);return`<label class="ing-row" style="display:flex;margin:0;color:var(--ink);font-weight:400;font-size:.95rem"><input type="checkbox" data-r="${k}" ${dup?'disabled':'checked'}>${p?`<img class="ck-th" src="${imgUrl(p[9],72)}" alt="">`:''}<span>${esc(x.name)}${x.units>1?' <small>× '+x.units+'</small>':''}<br><small>${dup?'Ya está en la lista':p?eur(p[3])+' hoy':''}</small></span></label>`}).join('')}</div>`:'<p class="hint">Esta compra no tiene productos apuntados.</p>'}
    <div class="ck-actions" style="margin-top:12px"><button type="button" class="btn sec" data-k="edit">✏️ Editar gasto</button>${its.length?`<button type="button" class="btn" data-k="again">🔁 Añadir a la lista</button>`:''}</div>`,{});
  ov.addEventListener('click',e=>{const k=e.target.closest('[data-k]');if(!k)return;
    if(k.dataset.k==='edit'){ov.remove();spendSheet(b);return}
    if(k.dataset.k==='again'){let n=0;ov.querySelectorAll('[data-r]').forEach(cb=>{if(!cb.checked||cb.disabled)return;const x=its[+cb.dataset.r];if(inList(x))return;
      if(x.mid&&MC&&MC.byId.get(x.mid))cartSet(prod(MC.byId.get(x.mid)),x.units||1,L.id);else S.items.push({id:uid(),listId:L.id,name:x.name,qty:x.qty||'',section:S.secMem[norm(x.name)]||'Otros',by:'',done:false,units:x.units||1,added:Date.now()});n++});
      ov.remove();save();toast(n?n+' producto'+(n>1?'s':'')+' añadido'+(n>1?'s':'')+' a la lista':'Nada nuevo que añadir')}});
}
// Productos de una compra para el historial (sirven para repetirla)
const buyLines=items=>items.slice(0,80).map(i=>({name:i.name,mid:i.mid||'',units:i.units||1,qty:i.mid?'':i.qty||''}));

// Al quitar lo comprado: dónde y cuánto se ha pagado
function buySheet(items,done){
  const c=ck();let store=ui.store&&c.stores.includes(ui.store)?ui.store:'Mercadona';
  const est=()=>'';const hint=i=>{const up=(S.prices||{})[norm(i.name)];return up&&up.store===store&&up.price?'pagaste '+eur(up.price):i.price?'≈ '+eur(i.price):''};
  const ov=sheet('¿Dónde has comprado?',`<button type="button" class="btn" data-k="tk" style="width:100%;margin-bottom:12px">📷 Subir foto o PDF del tique</button><div class="chips ck-wrap" id="f_sto">${c.stores.map(x=>`<button type="button" class="chip ${x===store?'on':''}" data-sto="${esc(x)}">${esc(x)}</button>`).join('')}</div>
    <p class="hint">Apunta lo que habéis pagado (opcional): el total del tique abajo o cada cosa. Lo que no apuntes no cuenta como gastado; las cifras «≈» son solo estimaciones.</p>
    <div class="ck-box" id="f_its">${items.map((i,n)=>`<div class="ck-buy"><span><b>${esc(i.name)}</b><br><small>${esc([i.qty,hint(i)].filter(Boolean).join(' · '))}</small></span><input class="field" data-pr="${n}" type="number" inputmode="decimal" step="0.01" min="0" placeholder="€"></div>`).join('')}</div>
    <div class="ck-total"><span>Total</span><b id="f_tot"></b></div>
    <label for="f_tk">Total pagado (si no apuntas cada cosa)</label><input class="field" id="f_tk" type="number" inputmode="decimal" step="0.01" min="0" placeholder="€">`,
  {saveLabel:'Guardar compra',onSave:ov=>{
    let tot=0,priced=0;
    ov.querySelectorAll('[data-pr]').forEach(inp=>{const i=items[+inp.dataset.pr],pr=parseFloat(inp.value);if(!(pr>0))return;tot+=pr;priced++;
      const q=parseQty(i.qty);let n=i.pq&&i.pq.n||0,d=i.pq&&i.pq.d||'m';
      if(q&&!(i.pq&&i.qty&&/×/.test(i.qty))){n=q.n;d=q.d}
      if(store!=='Mercadona'||(S.prices||{})[norm(i.name)])savePrice(i.name,{store,price:pr,n,d,qtxt:i.qty})});
    const tk=parseFloat(val(ov,'f_tk'));if(tk>0)tot=tk;
    // Solo cuenta como gasto lo que se apunta como pagado (nunca la estimación)
    S.buys=[...(S.buys||[]),{id:uid(),date:today(),at:Date.now(),store,total:Math.round(tot*100)/100,n:items.length,items:buyLines(items),by:meName()}];
    ui.store=store;mcCache.clear();done(store);
  }});
  const sum=()=>{let t=0;ov.querySelectorAll('[data-pr]').forEach(i=>{t+=parseFloat(i.value)||0});ov.querySelector('#f_tot').textContent=eur(t)};
  sum();ov.querySelector('#f_its').addEventListener('input',sum);
  ov.querySelector('[data-k="tk"]').addEventListener('click',()=>{ov.remove();ticketFlow({done:st=>done(st,true)})});
  ov.querySelector('#f_sto').addEventListener('click',ev=>{const b=ev.target.closest('[data-sto]');if(!b)return;store=b.dataset.sto;
    ov.querySelectorAll('[data-sto]').forEach(x=>x.classList.toggle('on',x===b));
    ov.querySelectorAll('[data-pr]').forEach(inp=>{inp.value=est(items[+inp.dataset.pr])});sum()});
  const skip=document.createElement('button');skip.type='button';
  skip.className='link';skip.textContent='Terminar sin apuntar lo pagado';skip.style.cssText='display:block;margin:14px auto 0';
  skip.onclick=()=>{ov.remove();done('')};ov.querySelector('.actions').after(skip);
}
function buysSheet(){
  const b=(S.buys||[]).slice().reverse(),m=today().slice(0,7);
  const per={};(S.buys||[]).filter(x=>x.date.startsWith(m)).forEach(x=>{per[x.store]=(per[x.store]||0)+x.total});
  const ov=sheet('Historial de compras',`${Object.keys(per).length?`<div class="ck-box">${Object.entries(per).map(([k,v])=>`<div class="ck-buy"><span>${esc(k)}</span><b>${eur(v)}</b></div>`).join('')}<div class="ck-buy"><span><b>Este mes</b></span><b>${eur(Object.values(per).reduce((a,v)=>a+v,0))}</b></div></div>`:''}
    <div class="ck-box">${b.slice(0,40).map(x=>`<div class="ck-buy"><span><b>${esc(x.store)}</b> · ${relDate(x.date)}<br><small>${x.n} producto${x.n>1?'s':''}: ${esc((x.items||[]).slice(0,6).join(', '))}${(x.items||[]).length>6?'…':''}</small></span><b>${x.total?eur(x.total):'—'}</b><button type="button" class="ck-ib" data-del="${x.id}" aria-label="Borrar">✕</button></div>`).join('')||'<p class="hint">Aún no hay compras.</p>'}</div>`,{});
  ov.addEventListener('click',ev=>{const d=ev.target.closest('[data-del]');if(!d)return;S.buys=S.buys.filter(x=>x.id!==d.dataset.del);save();ov.remove();buysSheet()});
}

/* ---------- IA (Claude): fotos de la nevera y recetas con lo que hay ---------- */
// La clave se guarda solo en este móvil (no va a la nube ni a las copias de seguridad)
const AI_MODEL='claude-opus-5-5',AI_LS='casa-ai-key';
const aiKey=()=>{try{return localStorage.getItem(AI_LS)||''}catch(e){return''}};
function aiKeySheet(then){
  sheet('Activar la IA',`<p class="hint" style="margin-top:0">Para reconocer alimentos en fotos y crear recetas, la app usa Claude, la IA de Anthropic. Necesita una clave de API:</p>
    <ol class="hint" style="padding-left:18px;line-height:1.5"><li>Entra en <a href="https://platform.claude.com" target="_blank" rel="noopener">platform.claude.com</a> y crea una cuenta.</li><li>Añade saldo (con 5 € hay para cientos de fotos y recetas).</li><li>En «API Keys» crea una clave y pégala aquí.</li></ol>
    <label for="f_k">Clave de API</label><input class="field" id="f_k" type="password" autocomplete="off" placeholder="sk-ant-…" value="${esc(aiKey())}">
    <p class="hint">Se guarda solo en este móvil. Cada foto o receta cuesta unos céntimos.</p>`,
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
    return`<div class="ck-tl"><label class="ck-tl-h"><input type="checkbox" data-on="${i}" checked><input class="field" data-nm="${i}" value="${esc(a.name)}"><input class="field" data-am="${i}" type="number" min="0" step="any" value="${Math.round((+a.amount||+a.count||1)*10)/10}" style="width:76px;flex:none;text-align:right"><select class="field" data-un="${i}" style="width:66px;flex:none;padding-left:6px">${opt([['g','g'],['ml','ml'],['ud','ud']],u)}</select></label>
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

async function aiRecipeFlow(pre){
  if(!aiKey()){aiKeySheet(()=>aiRecipeFlow(pre));return}
  if(!(S.pantry||[]).some(x=>x.n>0)){toast('Primero apunta lo que tienes en casa (🏠 En casa)');return}
  const c=ck();
  const ov=sheet('✨ Receta con lo que tengo',`<label for="f_w">¿Qué te apetece? (opcional)</label><input class="field" id="f_w" value="${esc(pre&&pre.wish||'')}" placeholder="Ej.: cena ligera, algo rápido, con pollo…">
    <div class="grid2"><div><label for="f_p">Personas</label><input class="field" id="f_p" type="number" min="1" value="${pre&&pre.ppl||c.people}"></div>
    <div><label for="f_t">Tiempo máximo</label><select class="field" id="f_t">${opt([['','Sin prisa'],['20','20 min'],['30','30 min'],['45','45 min'],['60','1 hora']],pre&&pre.time||'')}</select></div></div>
    <label class="ing-row" style="display:flex;margin-top:12px;color:var(--ink);font-weight:500;font-size:.95rem"><input type="checkbox" id="f_o" ${pre&&pre.only?'checked':''}><span>Solo con lo que tengo (sin comprar nada)</span></label>`,
  {saveLabel:'Crear receta',onSave:ov=>{aiRecipe({wish:val(ov,'f_w'),ppl:+val(ov,'f_p')||c.people,time:val(ov,'f_t'),only:ov.querySelector('#f_o').checked})}});
}
async function aiRecipe(o,avoid){
  const c=ck(),t=today();
  const pan=(S.pantry||[]).filter(x=>x.n>0).map(x=>`- ${x.name}: ${fmtAmt(x.n,x.u)} (${x.loc||'Despensa'})${x.exp?` caduca ${x.exp<=addDays(t,3)?'PRONTO ':''}${x.exp}`:''}`).join('\n');
  const w=aiWait('Pensando una receta…','La IA está mirando lo que tienes en casa.');
  let r;
  try{r=await askClaude([{type:'text',text:
`Eres cocinero/a de cocina casera española. Propón UNA receta para ${o.ppl} persona${o.ppl>1?'s':''} aprovechando lo que hay en casa, sobre todo lo que caduca pronto.
Lo que hay en casa:
${pan}
${o.wish?'Le apetece: '+o.wish+'\n':''}${o.time?'Tiempo máximo: '+o.time+' minutos.\n':''}${o.only?'Usa SOLO lo que hay en casa (puedes suponer sal, aceite, agua y especias básicas).\n':'Puede faltar como mucho 2 o 3 ingredientes fáciles de comprar en Mercadona.\n'}Electrodomésticos disponibles: ${c.appl.map(applName).join(', ')}.
${c.vetoes.length?'Nunca uses: '+c.vetoes.join(', ')+'.\n':''}${avoid&&avoid.length?'No repitas estas ideas: '+avoid.join(', ')+'.\n':''}Devuelve solo un JSON con esta forma, sin texto alrededor:
{"name":"…","servings":${o.ppl},"time":25,"appl":["fuego"],"ingredients":[{"name":"Pechuga de pollo","qty":"400 g","have":true}],"steps":"1. …\\n2. …","tip":"consejo corto"}
"appl" usa estas claves: ${CK_APPL.map(a=>a[0]).join(', ')}. "have" es true si está en la lista de casa. Cantidades en g, ml, ud o cucharadas.`}])}
  catch(e){w.remove();toast(e.message||'No se ha podido crear la receta');return}
  w.remove();
  if(!r||!r.name||!Array.isArray(r.ingredients)){toast('La IA no ha devuelto una receta');return}
  const rec={name:String(r.name).slice(0,90),servings:+r.servings||o.ppl,time:+r.time||0,appl:(r.appl||[]).filter(a=>CK_APPL.some(x=>x[0]===a)),
    ingredients:r.ingredients.filter(g=>g&&g.name).map(g=>({name:String(g.name),qty:String(g.qty||'')})),steps:String(r.steps||''),notes:r.tip?String(r.tip):'',meal:'ambas',tags:'IA'};
  const ov=sheet('✨ '+rec.name,`<div class="row-meta" style="margin:-8px 0 10px"><span>⏱ ${rec.time||'?'} min</span><span>👥 ${rec.servings} pers.</span><span>🤖 Hecha por IA</span></div>
    <div class="ck-box">${rec.ingredients.map(g=>{const x=pantryFind(g.name);return`<div class="ck-ing"><span class="ck-dot ${x&&x.n>0?'ok':''}"></span><span><b>${esc(g.name)}</b>${g.qty?' · '+esc(g.qty):''}<br><small>${x&&x.n>0?'En casa: '+fmtAmt(x.n,x.u):'Hay que comprarlo'}</small></span></div>`}).join('')}</div>
    <h4>Preparación</h4><div class="ck-steps">${esc(rec.steps).replace(/\n/g,'<br>')}</div>${rec.notes?`<div class="ck-tip">💡 ${esc(rec.notes)}</div>`:''}
    <div class="ck-actions" style="margin-top:14px"><button type="button" class="btn sec" data-k="other">🔄 Otra idea</button><button type="button" class="btn sec" data-k="cart">🛒 Lo que falta</button></div>`,
  {saveLabel:'Guardar receta',onSave:()=>{if(recipeByName(rec.name)){toast('Ya tienes una receta con ese nombre');return}S.recipes.push(Object.assign({id:uid(),added:today(),made:[],status:'probar'},rec));save();toast('Receta guardada en 📖 Recetas')}});
  ov.addEventListener('click',e=>{const b=e.target.closest('[data-k]');if(!b)return;
    if(b.dataset.k==='other'){ov.remove();aiRecipe(o,[...(avoid||[]),rec.name])}
    if(b.dataset.k==='cart'){const n=recipeToCart(Object.assign({id:''},rec),o.ppl);toast(n?n+' producto'+(n>1?'s':'')+' a la cesta':'Tienes todo en casa')}});
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
async function ocrText(file,prog){
  await loadJS('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js');
  const w=await Tesseract.createWorker('spa',1,{logger:m=>{if(m.status==='recognizing text')prog(Math.round(m.progress*100))}});
  try{return(await w.recognize(file)).data.text}finally{w.terminate()}
}
const tNum=s=>parseFloat(String(s).replace(/\s/g,'').replace(',','.'));
const T_SKIP=/^(total|subtotal|iva|base|cuota|tarjeta|entrega|efectivo|cambio|importe|descuento|ahorro|cupon|nif|cif|factura|fecha|hora|op[:.]|tienda|telefono|tel[.:]|c\/|avda|calle|mercadona|lidl|carrefour|aldi|dia\b|gracias|devolucion|n[ºo°]|caja|cajer|ticket|tique|art[ií]culos|descripci|p\.? ?unit|aut|visa|mastercard|contactless|forma de pago|venta|copia|www|http|s\.a\.|s\.l\.|%)/;
// Saca de un tique: supermercado, fecha, total y cada línea (nombre, unidades, precio unidad, importe, kilos)
function parseTicket(txt){
  const L=String(txt||'').split('\n').map(l=>l.replace(/[€|]/g,' ').replace(/\s+/g,' ').trim()).filter(Boolean);
  const all=norm(L.join(' '));
  const st=ck().stores.find(x=>all.includes(norm(x).split(/[ /]/)[0]))||(/coviran/.test(all)?'Covirán':/eroski/.test(all)?'Eroski':/alcampo/.test(all)?'Alcampo':'');
  const dm=all.match(/(\d{2})[\/\-.](\d{2})[\/\-.](\d{2,4})/);
  let date=today();if(dm){const y=dm[3].length===2?'20'+dm[3]:dm[3];const d=`${y}-${dm[2]}-${dm[1]}`;if(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(d)&&d<=today())date=d}
  let total=0;const tm=all.match(/total[^0-9\n]{0,12}(\d+[.,]\d{2})/);if(tm)total=tNum(tm[1]);
  const lines=[];let pend=null;
  L.forEach(l=>{
    const n=norm(l);
    // Línea de peso: «0,856 kg 2,30 €/kg 1,97»
    const w=n.match(/(\d+[.,]\d{1,3})\s*kg\s*[x×]?\s*(\d+[.,]\d{2})\s*(?:\/\s*kg|eur\/kg|e\/kg)?\s+(\d+[.,]\d{2})(?:\s+[a-e])?$/);
    if(w&&pend){lines.push({name:pend,units:1,kg:tNum(w[1]),unit:tNum(w[2]),price:tNum(w[3])});pend=null;return}
    // «2 x 0,89» debajo del nombre (Lidl, Carrefour…)
    const x=n.match(/^(\d+)\s*[x×*]\s*(\d+[.,]\d{2})(?:\s+(\d+[.,]\d{2}))?/);
    if(x&&lines.length&&!pend){const a=lines[lines.length-1];a.units=+x[1];a.unit=tNum(x[2]);if(x[3])a.price=tNum(x[3]);return}
    if(T_SKIP.test(n)||/^\d+[.,]\d+\s*kg\b/.test(n)){pend=null;return}
    // «3 HUEVOS GRANDES L 3,05 9,15» o «1 LECHE ENTERA 0,89»
    let m=l.match(/^(\d{1,2})\s+(.*?[A-Za-zÁÉÍÓÚÑáéíóúñ].*?)\s+(-?\d+[.,]\d{2})(?:\s+(-?\d+[.,]\d{2}))?(?:\s+[A-E])?$/);
    if(m){const u=+m[1],a=tNum(m[3]),b=m[4]?tNum(m[4]):null;lines.push({name:m[2],units:u,unit:b!=null?a:a/u,price:b!=null?b:a});pend=null;return}
    // «LECHE ENTERA 0,89 A» (sin unidades delante)
    m=l.match(/^(.*?[A-Za-zÁÉÍÓÚÑáéíóúñ]{2}.*?)\s+(-?\d+[.,]\d{2})(?:\s+[A-E])?$/);
    if(m){const pr=tNum(m[2]);if(pr<0)return;lines.push({name:m[1],units:1,unit:pr,price:pr});pend=null;return}
    // Nombre solo (lo de peso viene en la línea siguiente)
    m=l.match(/^(?:\d{1,2}\s+)?([A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9 .,%/'-]{2,})$/);
    pend=m?m[1]:null;
  });
  lines.forEach(a=>{a.name=a.name.replace(/\s+/g,' ').trim();a.nice=a.name.toLowerCase().replace(/^./,c=>c.toUpperCase())});
  return{store:st,date,total:total||Math.round(lines.reduce((s,a)=>s+a.price,0)*100)/100,lines:lines.filter(a=>a.price>0&&a.name.length>1)};
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
async function ticketFlow(opts){
  opts=opts||{};
  const f=await pickFile('image/*,application/pdf');if(!f)return;
  const ov=sheet('Leyendo el tique…',`<p class="hint" id="tkP">Preparando…</p><p class="hint">La primera vez tarda un poco más: se descarga el lector de texto.</p>`,{});
  const P=ov.querySelector('#tkP');let txt='';
  try{
    if(/pdf/i.test(f.type)||/\.pdf$/i.test(f.name)){P.textContent='Leyendo el PDF…';txt=await pdfText(f)}
    else{P.textContent='Leyendo la foto…';txt=await ocrText(f,n=>{P.textContent='Leyendo la foto… '+n+' %'})}
  }catch(e){ov.remove();toast('No he podido leer el tique. Revisa la conexión e inténtalo otra vez');return}
  ov.remove();
  if(!MC)await loadMC();
  const t=parseTicket(txt);
  if(!t.lines.length){sheet('No he encontrado productos',`<p class="hint">Prueba con una foto más cerca, recta y con buena luz, o con el PDF del tique digital.</p><details><summary class="link">Ver el texto leído</summary><pre class="ck-pre">${esc(txt)}</pre></details>`,{});return}
  ticketReview(t,txt,opts);
}
// Gastos ya apuntados que podrían ser la misma compra que el tique (para no contarla dos veces)
function ticketCandidates(t){
  const near=(S.buys||[]).filter(b=>!b.ticket&&Math.abs(diff(b.date,t.date||today()))<=7).sort((a,b)=>Math.abs(diff(a.date,t.date))-Math.abs(diff(b.date,t.date)));
  const best=near.find(b=>(!t.store||b.store===t.store)&&Math.abs(diff(b.date,t.date))<=1&&(!b.total||Math.abs(b.total-t.total)<=Math.max(1,t.total*.05)));
  return near.slice(0,6).map(b=>[b,b===best]);
}
function ticketReview(t,txt,opts){
  const c=ck(),stores=[...c.stores,...(t.store&&!c.stores.includes(t.store)?[t.store]:[])];
  const pans=(S.pantry||[]).slice().sort((a,b)=>a.name.localeCompare(b.name,'es'));
  const rows=t.lines.map((a,i)=>{const x=ticketPantry(a.name);const p=t.store==='Mercadona'||!t.store?ticketProduct(a):null;
    return`<div class="ck-tl"><label class="ck-tl-h"><input type="checkbox" data-on="${i}" checked><input class="field" data-nm="${i}" value="${esc(a.nice)}"><input class="field" data-pr="${i}" type="number" inputmode="decimal" step="0.01" value="${a.price.toFixed(2)}"></label>
      <small>${a.kg?a.kg.toLocaleString('es-ES')+' kg':a.units+' ud'}${a.units>1?' × '+eur(a.unit):''}${p?' · '+esc(p.name)+' '+prodSize(p):''}</small>
      <select class="field" data-pn="${i}"><option value="">No va a la despensa</option><option value="new" ${x?'':''}>➕ Nuevo en la despensa</option>${pans.map(y=>`<option value="${y.id}" ${x&&x.id===y.id?'selected':''}>🥫 ${esc(y.name)}</option>`).join('')}</select></div>`});
  const ov=sheet('Tique'+(t.store?' de '+t.store:''),`
    <div class="grid2"><div><label for="f_sto">Supermercado</label><select class="field" id="f_sto">${opt(stores.map(x=>[x,x]),t.store||ui.store||'Mercadona')}</select></div>
    <div><label for="f_dt">Fecha</label><input class="field" id="f_dt" type="date" value="${t.date}"></div></div>
    <div class="ck-total"><span>Total del tique</span><input class="field" id="f_tot" type="number" inputmode="decimal" step="0.01" value="${t.total.toFixed(2)}" style="width:110px"><small id="f_sum"></small></div>
    <p class="hint">Revisa lo leído: corrige nombres o precios, desmarca lo que sobre y elige a qué producto de la despensa va cada línea.</p>
    <div id="f_tl">${rows.join('')}</div>
    <label class="ing-row" style="display:flex;margin-top:12px;color:var(--ink);font-weight:500;font-size:.95rem"><input type="checkbox" id="f_rm" checked><span>Quitar de la lista de la compra lo que aparece en el tique</span></label>
    ${(()=>{const c2=ticketCandidates(t);return c2.length?`<label for="f_as">¿Ya habíais apuntado este gasto?</label><select class="field" id="f_as"><option value="">No: es una compra nueva</option>${c2.map(([b,sel])=>`<option value="${b.id}" ${sel?'selected':''}>Sí: ${esc(b.store)} · ${relDate(b.date)} · ${b.total?eur(b.total):'sin importe'}${b.manual?' (a mano)':''}</option>`).join('')}</select><p class="hint">Si es la misma compra, se completa ese registro en vez de sumar otro gasto.</p>`:''})()}
    <details><summary class="link" style="margin-top:10px">Ver el texto leído</summary><pre class="ck-pre">${esc(txt)}</pre></details>`,
  {saveLabel:'Guardar tique',onSave:ov=>{
    const store=val(ov,'f_sto'),date=val(ov,'f_dt')||today();let np=0,nq=0,rm=0;const names=[],lines=[];
    ov.querySelectorAll('[data-on]').forEach(cb=>{if(!cb.checked)return;const i=+cb.dataset.on,a=t.lines[i];
      const nm=ov.querySelector(`[data-nm="${i}"]`).value.trim()||a.nice,price=parseFloat(ov.querySelector(`[data-pr="${i}"]`).value)||0;names.push(nm);lines.push({name:nm,units:a.kg?1:a.units||1,qty:a.kg?a.kg+' kg':'',price});
      const pv=ov.querySelector(`[data-pn="${i}"]`).value;let x=pv==='new'?null:pv?find(S.pantry||[],pv):null;
      const mp=store==='Mercadona'?ticketProduct(a,nm):null;
      if(mp&&!mp.approx&&!a.kg)lines[lines.length-1].mid=mp.id;
      // Cantidad comprada en la medida de la despensa
      let amt=null,d='ud';
      if(a.kg){amt=a.kg*1000;d='m'}
      else if(mp){amt=mp.size*a.units;d=mp.d}
      else{const q=parseQty(nm.match(/\d+[.,]?\d*\s*(kg|g|gr|l|ml|cl|ud)\b/i)?.[0]||'');if(q){amt=q.n*a.units;d=q.d}else{amt=a.units;d='ud'}}
      if(pv==='new'){x={id:uid(),name:nm.replace(/\s+\d.*$/,''),n:0,u:d==='ud'?'ud':'g',min:0,loc:mp&&/Congelados/.test(mp.cat)?'Congelador':mp&&/Carne|Marisco|Charcuter|Huevos|Postres/.test(mp.cat)?'Nevera':'Despensa',auto:false,mid:mp?mp.id:'',at:date};S.pantry=[...(S.pantry||[]),x]}
      if(x){let add=amt;if(d!==pUnit(x)){const w=unitW(x.name);add=w?(d==='ud'?amt*w:amt/w):(pUnit(x)==='ud'?a.units:null)}
        if(add!=null){x.n=Math.round((x.n+add)*10)/10;x.at=date;np++}}
      // Precio: el de otros supermercados se usa en las recetas; el de Mercadona queda en el historial
      if(price>0){const key=x?x.name:nm;const per=a.kg?price/a.kg:price/(a.units||1);
        savePrice(key,{store,price:Math.round(per*100)/100,n:a.kg?1000:(mp&&!a.kg?mp.size:(d==='ud'?1:0)),d:a.kg?'m':d,at:date,qtxt:a.kg?'1 kg':mp?prodSize(mp):'1 ud',label:nm});nq++}
      if(ov.querySelector('#f_rm').checked){const k1=words(nm),k2=x?words(x.name):[];
        const before=S.items.length;S.items=S.items.filter(i=>{const iw=words(i.name);return!(iw.length&&(allIn(iw,k1)||(k2.length&&allIn(iw,k2))))});rm+=before-S.items.length}
    });
    const tot=parseFloat(val(ov,'f_tot'))||0;
    const asId=ov.querySelector('#f_as')&&ov.querySelector('#f_as').value,rec={date,store,total:Math.round(tot*100)/100,n:names.length,items:lines.slice(0,80),ticket:true,manual:false};
    const old=asId&&find(S.buys||[],asId);
    if(old)Object.assign(old,rec);else S.buys=[...(S.buys||[]),Object.assign({id:uid(),at:Date.now(),by:meName()},rec)];
    if(!c.stores.includes(store))S.cook=Object.assign({},S.cook,{stores:[...c.stores,store]});
    ui.store=store;mcCache.clear();
    if(opts.done)opts.done(store);else save();
    toastUndo(`Tique guardado${old?' (completa el gasto ya apuntado)':''}: ${np} a casa, ${nq} precios${rm?', '+rm+' quitados de la lista':''}`);
  }});
  const sum=()=>{let s2=0;ov.querySelectorAll('[data-on]').forEach(cb=>{if(cb.checked)s2+=parseFloat(ov.querySelector(`[data-pr="${cb.dataset.on}"]`).value)||0});
    const tt=parseFloat(val(ov,'f_tot'))||0;ov.querySelector('#f_sum').textContent='Suma de líneas: '+eur(s2)+(Math.abs(s2-tt)>.05?' (no cuadra: revisa algún precio)':' ✓')};
  sum();ov.addEventListener('input',sum);ov.addEventListener('change',sum);
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
  panRemove:d=>confirmRemovePantry(d.id),
  ckTab:d=>{ui.ckTab=d.v;render();$('#app').scrollTop=0},
  prodCat:d=>{ui.prodCat=d.v;ui.prodSub=null;ui.prodN=40;render();const g=document.querySelector('.ck-cats');if(g)g.querySelector('.on')?.scrollIntoView({inline:'center',block:'nearest'})},
  prodMore:()=>{ui.prodN=(ui.prodN||40)+40;render()},
  prodClear:()=>{ui.prodQ='';render()},
  prodQ:d=>{ui.prodQ=d.v;ui.prodN=40;render();const f=$('#qProd');if(f){f.focus();f.setSelectionRange(f.value.length,f.value.length)}},
  prodSub:d=>{ui.prodSub=d.v===''?null:+d.v;ui.prodN=40;render()},
  favToggle:d=>{const was=isFav(d.id);toggleFav(d.id);toast(was?'Quitado de habituales':'⭐ Añadido a habituales')},
  cartStep:d=>{if(!MC)return;const p=prod(MC.byId.get(d.id));const i=cartOf(d.id);cartSet(p,(i?i.units||1:0)+(+d.v));save()},
  homeAdd:d=>{if(!MC)return;const p=prod(MC.byId.get(d.id));const x=pantryAddProd(p,1);save();toastUndo('🏠 '+x.loc+': '+fmtAmt(x.n,x.u)+' de '+p.name)},
  panCart:d=>{const x=find(S.pantry||[],d.id);if(!x)return;const p=x.mid&&MC&&MC.byId.get(x.mid);
    if(p){const i=cartOf(x.mid);if(i){toast('Ya está en la cesta');return}cartSet(prod(p),1)}else{if(cartItems().some(i=>norm(i.name)===norm(x.name))){toast('Ya está en la cesta');return}S.items.push(pantryItem(x,cartList()))}
    save();toast(x.name+' a la cesta')},
  ckSeed:seedRecipes,ckSeedPan:seedPantry,
  ckNewRec:()=>recipeEdit(null),
  ckLinkRec:()=>linkSheet(),
  ckRec:d=>recipeView(find(S.recipes,d.id)),
  recF:d=>{ui.recF=d.v;render()},
  panF:d=>{ui.panF=d.v;render()},
  ckNewPan:()=>panSheet(null),
  ckPan:d=>panSheet(find(S.pantry||[],d.id)),
  panStep:d=>{const x=find(S.pantry||[],d.id);if(!x)return;x.n=Math.max(0,Math.round((x.n+(+d.v)*pantryStep(x))*10)/10);x.at=today();save()},
  ckLowShop:()=>{const L=S.lists.find(l=>l.id==='super')||S.lists[0];let n=0;
    (S.pantry||[]).filter(pantryLow).forEach(x=>{if(S.items.some(i=>!i.done&&(x.mid?i.mid===x.mid:norm(i.name)===norm(x.name))))return;const p=x.mid&&MC&&MC.byId.get(x.mid);if(p)cartSet(prod(p),1);else S.items.push(Object.assign(pantryItem(x,L.id),{auto:false}));n++});
    save();toast(n?n+' añadido'+(n>1?'s':'')+' a '+L.name:'Ya estaba todo en la lista')},
  ckPeople:d=>ckSet('people',Math.max(1,ck().people+(+d.v))),
  ckAppl:d=>{const a=ck().appl;ckSet('appl',a.includes(d.v)?a.filter(x=>x!==d.v):[...a,d.v])},
  ckApplNew:()=>{sheet('Otro electrodoméstico',`<input class="field" id="f_t" placeholder="Ej.: Panificadora">`,{onSave:ov=>{const v=val(ov,'f_t');if(!v)return false;const c=ck();S.cook=Object.assign({},S.cook,{applX:[...new Set([...(c.applX||[]),v])],appl:[...new Set([...c.appl,v])]});save()}})},
  ckVetoAdd:()=>{const el=$('#qVeto');const vs=el.value.split(',').map(s=>s.trim()).filter(Boolean);if(!vs.length)return;const c=ck();ckSet('vetoes',[...new Set([...c.vetoes,...vs])]);toast('Vetado: '+vs.join(', '))},
  ckBuys:()=>buysSheet(),
  ckSpend:()=>spendSheet(),
  toggleItem:d=>{const i=find(S.items,d.id);if(!i)return;
    if(!i.done&&!ui.me){whoAmI(()=>CK_ACT.toggleItem(d));return}
    i.done=!i.done;
    if(i.done){i.doneBy=meName();i.doneAt=Date.now();const s=S.staples.find(s=>s.listId===i.listId&&norm(s.name)===norm(i.name));if(s){s.last=today();delete s.snooze}}
    else{delete i.doneBy;delete i.doneAt}
    save();toastUndo(i.done?'✓ '+i.name+' al carro':i.name+' vuelve a pendientes')},
  itemStep:d=>{const i=find(S.items,d.id);if(!i)return;const u=(i.units||1)+(+d.v);
    if(u<=0){S.items=S.items.filter(x=>x.id!==i.id);save();toastUndo(i.name+' quitado de la lista');return}
    setUnits(i,u);save()},
  habAdd:d=>{const k=d.v,p=!k.startsWith('n:')&&MC&&MC.byId.get(k);if(addToList(p?{mid:k,name:p[1],units:1}:{name:k.slice(2)}))toast('Añadido a la lista')},
  sugAdd:d=>{if(!MC)return;const p=MC.byId.get(d.id);if(!p)return;if(addToList({mid:d.id,name:p[1],units:1})){const el=$('#qItem');if(el){el.value='';drawQSug()}toast(p[1]+' a la lista')}},
  clearDone:()=>{const L=curList();const dn=S.items.filter(i=>i.listId===L.id&&i.done);const n=dn.length;if(!n)return;
    buySheet(dn,(store,fromTicket)=>{const p=fromTicket?0:dn.filter(addToPantry).length;S.items=S.items.filter(i=>!(i.listId===L.id&&i.done));save();toastUndo('Compra terminada: '+n+' producto'+(n>1?'s':'')+(store?' · '+store:'')+(p?' · '+p+' a casa':''))})},
  aiPhoto:()=>{MC?photoFlow():loadMC().then(photoFlow)},
  aiRecipe:()=>aiRecipeFlow(),
  aiKey:()=>aiKeySheet(),
  ckTicket:()=>ticketFlow(),
  ckStoreNew:()=>{sheet('Otro supermercado',`<input class="field" id="f_t" placeholder="Ej.: Covirán">`,{onSave:ov=>{const v=val(ov,'f_t');if(!v)return false;ckSet('stores',[...new Set([...ck().stores,v])])}})},
  ckStoreDel:d=>{const a=ck().stores.slice();if(a[+d.v]==='Mercadona')return;const x=a.splice(+d.v,1)[0];ckSet('stores',a);toastUndo(x+' quitado')},
  ckPrice:d=>productPicker(d.v,()=>{save()},d.v),
  ckVetoDel:d=>{const v=ck().vetoes.slice();v.splice(+d.v,1);ckSet('vetoes',v)}
};

document.addEventListener('input',e=>{
  if(e.target.id==='qRec'){ui.recQ=e.target.value;clearTimeout(ui._rt);ui._rt=setTimeout(()=>{render();const f=$('#qRec');if(f){f.focus();f.setSelectionRange(f.value.length,f.value.length)}},250)}
});
document.addEventListener('input',e=>{
  if(e.target.id==='qProd'){ui.prodQ=e.target.value;ui.prodN=40;clearTimeout(ui._pt);ui._pt=setTimeout(()=>{render();const f=$('#qProd');if(f){f.focus();f.setSelectionRange(f.value.length,f.value.length)}},300)}
  if(e.target.classList.contains('ck-range')){const x=find(S.pantry||[],e.target.dataset.pid);if(!x)return;const v=+e.target.value,full=pantryFull(x),pct=Math.round(v/full*100);
    e.target.style.setProperty('--p',pct+'%');const l=document.querySelector(`[data-pl="${x.id}"]`);if(l)l.textContent=v>0?'Queda '+fmtAmt(v,x.u)+' · '+pct+' %':'Agotado'}
});
document.addEventListener('input',e=>{if(e.target.id==='qItem'){clearTimeout(ui._qs);ui._qs=setTimeout(drawQSug,200)}});
document.addEventListener('change',e=>{
  if(e.target.id==='ckBudgetM'){const v=parseFloat(e.target.value);ckSet('budgetM',v>0?Math.round(v*100)/100:0)}
  if(e.target.id==='ckCP'){const v=e.target.value.trim();if(v&&!/^\d{5}$/.test(v)){toast('El código postal tiene 5 cifras');return}ckSet('cp',v)}
  if(e.target.classList.contains('ck-range')){const x=find(S.pantry||[],e.target.dataset.pid);if(!x)return;x.full=pantryFull(x);x.n=+e.target.value;x.at=today();save();if(pantryLow(x))toast(x.name+': se está acabando. Pulsa 🛒 para añadirlo a la cesta')}
  if(e.target.id==='ckSort'){ui.recSort=e.target.value;render()}
});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='qVeto')CK_ACT.ckVetoAdd()});

// Recetas compartidas desde otra app (Android: Compartir → Casa)
function ckShared(){
  try{
    const q=new URLSearchParams(location.search);if(!q.has('url')&&!q.has('text'))return;
    const text=q.get('text')||'',url=q.get('url')||(text.match(/https?:\/\/\S+/)||[''])[0],title=q.get('title')||'';
    history.replaceState(null,'',location.pathname);
    ui.view='compras';ui.ckTab='recetas';render();
    linkSheet({url,title,text:text.replace(url,'').trim()});
  }catch(e){}
}
