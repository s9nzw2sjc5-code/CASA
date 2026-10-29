/*
 * Cocina: menú semanal con presupuesto, recetas guardadas (también de Instagram,
 * TikTok o webs), despensa con cantidades y precios de Mercadona.
 *
 * Se carga antes del script principal de index.html y usa sus utilidades
 * (S, ui, save, sheet, esc, norm, uid…) cuando se llama a cada función.
 * Los precios salen de mercadona.json, que GitHub Actions actualiza cada día.
 */

/* ---------- ajustes ---------- */
const MEALS={comida:'Comida',cena:'Cena'};
const CK_APPL=[['horno','Horno'],['airfryer','Freidora de aire'],['robot','Robot de cocina'],['olla','Olla rápida / programable'],['micro','Microondas'],['fuego','Vitro / inducción / gas'],['lenta','Olla lenta'],['plancha','Plancha / grill'],['batidora','Batidora'],['vapor','Vaporera']];
// Si no tienes el electrodoméstico de la receta, con cuál se puede hacer igual
const CK_ALT={horno:['airfryer'],airfryer:['horno'],olla:['fuego','lenta','robot'],robot:['fuego','batidora'],lenta:['olla','fuego'],vapor:['micro','olla','robot','fuego'],plancha:['fuego','airfryer'],micro:['fuego'],batidora:['robot'],fuego:['robot','olla']};
const CK_LOCS=['Despensa','Nevera','Congelador'];
const ck=()=>Object.assign({people:2,budget:50,vetoes:[],appl:['horno','fuego','micro'],meals:['comida','cena'],rej:{}},S.cook||{});
function ckSet(k,v){S.cook=Object.assign({},S.cook||{});S.cook[k]=v;save()}
const applName=k=>(CK_APPL.find(a=>a[0]===k)||[k,k])[1];
const eur=n=>(Math.round(n*100)/100).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
const eur0=n=>Math.round(n).toLocaleString('es-ES')+' €';
const weekStart=off=>{const b=new Date();b.setDate(b.getDate()+off*7);b.setDate(b.getDate()-((b.getDay()+6)%7));return ds(b)};
const recipeByName=n=>S.recipes.find(r=>norm(r.name)===norm(n));
const recOf=e=>e&&(S.recipes.find(x=>x.id===e.recipeId)||(e.name&&recipeByName(e.name)));
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
    d.byId=new Map(d.p.map(p=>[p[0],p]));d.w=d.p.map(p=>words(p[1]));MC=d;mcCache.clear();
    if(ui.view==='menu'&&!document.querySelector('.overlay'))render();
  }).catch(()=>{mcLoading=null});
  return mcLoading;
}
// Producto: [id, nombre, envase, precio, tamaño, unidad, precio_ref, unidad_ref, categoría, imagen, aprox]
const prod=p=>p&&{id:p[0],name:p[1],pack:p[2],price:p[3],size:(p[5]==='ud'?p[4]:p[4]*1000)||(p[5]==='ud'?1:500),d:p[5]==='ud'?'ud':'m',fmt:p[5],ref:p[6],refFmt:p[7],cat:MC.cats[p[8]],img:p[9]};
const prodSize=p=>p.d==='ud'?(p.size+' ud'):p.size>=1000?(p.size/1000).toLocaleString('es-ES')+(p.fmt==='l'?' L':' kg'):Math.round(p.size)+(p.fmt==='l'?' ml':' g');
const prodImg=p=>p.img?`https://prod-mercadona.imgix.net/images/${p.img}?fit=crop&h=96&w=96`:'';
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
function matchProduct(name){
  if(!MC)return null;
  const k=norm(name),pm=S.prodMap||{};
  if(pm[k]){const p=MC.byId.get(pm[k]);if(p)return prod(p)}
  if(mcCache.has(k))return mcCache.get(k);
  // De los que más se parecen, el envase más barato: compras solo lo que necesitas
  const a=searchMC(name,8),best=a[0];
  const p=best?a.filter(x=>x.s>=best.s-1).sort((x,y)=>x.price-y.price)[0]:null;
  mcCache.set(k,p);return p;
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
const pantryLow=x=>x.min>0&&x.n<=x.min;
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
  const x=pantryFind(i.name);if(!x)return false;
  let n=i.pq&&i.pq.d===pUnit(x)?i.pq.n:null;
  if(n==null){const q=parseQty(i.qty);n=q?toDim(q,i.name,pUnit(x)):null}
  if(n==null){const p=x.mid&&MC&&MC.byId.get(x.mid);n=p?prod(p).size:(x.u==='ud'?1:0)}
  if(!n)return false;x.n=Math.round((x.n+n)*10)/10;x.at=today();return true;
}
function autoPantry(){
  let c=0;const L=S.lists.find(l=>l.id==='super')||S.lists[0];
  (S.pantry||[]).forEach(x=>{if(x.auto&&pantryLow(x)&&x.snooze!==today()&&!S.items.some(i=>!i.done&&norm(i.name)===norm(x.name))){S.items.push(pantryItem(x,L.id));c++}});
  if(c)save();return c;
}
function pantryItem(x,lid){
  const p=x.mid&&MC&&MC.byId.get(x.mid)?prod(MC.byId.get(x.mid)):matchProduct(x.name);
  return{id:uid(),listId:lid,name:x.name,qty:p?'1 × '+prodSize(p):'',section:ckSection(p,x.name),by:'Despensa',done:false,auto:true,price:p?p.price:0,mid:p?p.id:'',pq:p?{n:p.size,d:p.d}:null};
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

/* ---------- menú: qué hace falta comprar ---------- */
function weekSlots(start){const o=[];for(let i=0;i<7;i++){const d=addDays(start,i);ck().meals.forEach(m=>o.push([d,m,d+'|'+m]))}return o}
function weekNeeds(start){
  const c=ck(),agg=new Map();
  weekSlots(start).forEach(([d,m,k])=>{const e=S.menu[k];const r=recOf(e);if(!r||e.made)return;
    const f=(e.ppl||c.people)/(r.servings||2);
    r.ingredients.forEach(g=>{
      const p=matchProduct(g.name),key=p?'p'+p.id:'n'+norm(g.name);
      let a=agg.get(key);if(!a){a={name:g.name,p,n:0,unk:false,qtys:[],from:[]};agg.set(key,a)}
      const q=parseQty(g.qty);const n=q&&(p?toDim(q,g.name,p.d,p.size):q.n);
      if(n!=null)a.n+=n*f;else a.unk=true;
      if(g.qty)a.qtys.push(g.qty);if(!a.from.includes(r.name))a.from.push(r.name);
    });
  });
  return[...agg.values()].map(a=>{
    const d=a.p?a.p.d:'m';const have=pantryAmount(a.name,d);
    let need=a.n-(have||0);
    const covered=have!=null&&(have===Infinity||(a.n>0?need<=0:have>0));
    let packs=0,cost=0;
    if(!covered&&a.p){packs=a.n>0&&need>0?Math.max(1,Math.ceil(need/a.p.size-1e-6)):1;cost=packs*a.p.price}
    return Object.assign(a,{have,covered,packs,cost,need:Math.max(0,need)});
  }).sort((x,y)=>x.covered-y.covered||x.name.localeCompare(y.name,'es'));
}
function weekCost(start){return weekNeeds(start).reduce((s,a)=>s+a.cost,0)}

/* ---------- sugerencias ---------- */
function vetoed(r,vetoes){
  const all=[r.name,...r.ingredients.map(g=>g.name)].map(words);
  return vetoes.some(v=>{const vw=words(v);return vw.length&&all.some(w=>allIn(vw,w))});
}
function applOk(r,mine){return(r.appl||[]).every(a=>mine.includes(a)||(CK_ALT[a]||[]).some(b=>mine.includes(b)))}
function suggestable(r,meal,c){
  if(r.noSug||!r.ingredients.length)return false;
  const m=r.meal||'ambas';if(m==='otro'||(m!=='ambas'&&m!==meal))return false;
  return!vetoed(r,c.vetoes)&&applOk(r,c.appl);
}
function lastMade(r){const a=r.made||[];return a.length?a[a.length-1]:''}
function score(r,meal,used,rej,target,c){
  let s=(r.rating||0)*1.2+(r.again?4:0)+(r.fav?2:0)+(r.status==='probar'?1:0)+pantryShare(r)*5+Math.random()*3;
  if(used.has(r.id))s-=30;if(rej.includes(r.id))s-=100;
  const lm=lastMade(r);if(lm&&diff(lm,today())<8)s-=4;
  const rc=recipeCost(r,c.people);if(rc){s-=rc.per*.8;if(target>0&&rc.total>target)s-=(rc.total-target)*1.5}
  return s;
}
function suggestWeek(start,onlyKey){
  const c=ck(),rej=(c.rej||{})[start]||[];
  const slots=weekSlots(start).filter(([d,m,k])=>onlyKey?k===onlyKey:!S.menu[k]&&d>=today());
  const used=new Set(weekSlots(start).map(([,,k])=>S.menu[k]&&S.menu[k].recipeId).filter(Boolean));
  let spent=weekSlots(start).reduce((s,[,,k])=>{const r=recOf(S.menu[k]);const rc=r&&recipeCost(r,c.people);return s+(rc?rc.total:0)},0);
  let n=0,left=slots.length;
  slots.forEach(([d,m,k])=>{
    const target=c.budget>0?Math.max(0,(c.budget-spent)/Math.max(1,left)):0;left--;
    const cands=S.recipes.filter(r=>suggestable(r,m,c));
    if(!cands.length)return;
    const best=cands.map(r=>[score(r,m,used,rej,target,c),r]).sort((a,b)=>b[0]-a[0])[0];
    if(!best||best[0]<-50)return;
    const r=best[1];used.add(r.id);S.menu[k]={name:r.name,recipeId:r.id,sug:true};n++;
    const rc=recipeCost(r,c.people);if(rc)spent+=rc.total;
  });
  return n;
}
function rejectInWeek(start,id){
  if(!id)return;const c=ck();const rej=Object.assign({},c.rej||{});
  Object.keys(rej).forEach(k=>{if(k<weekStart(-2))delete rej[k]});
  rej[start]=[...new Set([...(rej[start]||[]),id])];ckSet('rej',rej);
}

/* ---------- vistas ---------- */
function vCocina(){
  loadMC();
  const tab=ui.ckTab||'menu';
  const c=ck(),low=(S.pantry||[]).filter(pantryLow).length;
  const start=weekStart(ui.menuWeek||0);
  const cost=MC?weekCost(start):null;
  const sub={menu:'Menú de la semana',recetas:S.recipes.length+' receta'+(S.recipes.length===1?'':'s')+' guardada'+(S.recipes.length===1?'':'s'),despensa:(S.pantry||[]).length+' producto'+((S.pantry||[]).length===1?'':'s')+' en casa',ajustes:'Personas, presupuesto y electrodomésticos'}[tab];
  let h=`<h1>Cocina</h1><p class="sub">${sub}</p>${heroStats([[c.people,'personas'],[eur0(c.budget),'presupuesto'],[cost==null?'…':eur0(cost),'compra est.'],[low,'se acaban']])}`;
  h+=`<div class="chips ck-tabs">${[['menu','🗓️ Menú'],['recetas','📖 Recetas'],['despensa','🥫 Despensa'],['ajustes','⚙️ Ajustes']].map(([k,l])=>`<button class="chip ${tab===k?'on':''}" data-act="ckTab" data-v="${k}">${l}${k==='despensa'&&low?` <span class="ck-n">${low}</span>`:''}</button>`).join('')}</div>`;
  return h+({menu:vCkMenu,recetas:vCkRecetas,despensa:vCkDespensa,ajustes:vCkAjustes}[tab]||vCkMenu)();
}

function vCkMenu(){
  const c=ck(),w=ui.menuWeek||0,start=weekStart(w),end=addDays(start,6),t=today();
  const lbl=w===0?'Esta semana':w===1?'La semana que viene':w===-1?'La semana pasada':`${parse(start).toLocaleDateString('es-ES',{day:'numeric',month:'short'})} – ${parse(end).toLocaleDateString('es-ES',{day:'numeric',month:'short'})}`;
  const slots=weekSlots(start),planned=slots.filter(([,,k])=>S.menu[k]).length;
  let h=`<div class="week-nav" style="margin-top:12px"><button class="iconbtn" data-act="menuWeek" data-v="-1" aria-label="Semana anterior">‹</button><span class="lbl">${lbl}</span>${w!==0?`<button class="chip" data-act="menuWeek" data-v="0">Hoy</button>`:''}<button class="iconbtn" data-act="menuWeek" data-v="1" aria-label="Semana siguiente">›</button></div>`;
  if(MC){
    const cost=weekCost(start),pct=c.budget>0?Math.min(100,cost/c.budget*100):0,over=c.budget>0&&cost>c.budget;
    h+=`<div class="ck-budget ${over?'over':''}"><div class="ck-bl"><b>${eur(cost)}</b><span>de ${eur0(c.budget)} · compra para ${c.people} persona${c.people>1?'s':''}</span></div><div class="ck-bar"><i style="width:${pct}%"></i></div><small>${over?'Te pasas del presupuesto: cambia algún plato por otro más barato (↻)':planned?'Ya descontado lo que tienes en la despensa':'Pulsa «Sugerir menú» o elige tus platos'}</small></div>`;
  }else h+=`<p class="hint">Cargando precios de Mercadona…</p>`;
  h+=`<div class="ck-actions"><button class="btn" data-act="ckSuggest">✨ Sugerir menú</button><button class="btn sec" data-act="ckShop" ${planned?'':'disabled'}>🛒 Lista de la compra</button></div>`;
  if(slots.some(([,,k])=>S.menu[k]&&S.menu[k].sug))h+=`<div style="text-align:right;margin-top:6px"><button class="link" data-act="ckClearSug">Quitar todas las sugerencias</button></div>`;
  if(!S.recipes.length)h+=`<div class="empty" style="margin-top:12px">Aún no tienes recetas. Guarda las tuyas en «Recetas» o <button class="link" data-act="ckSeed">carga 24 recetas básicas</button> para que la app te pueda sugerir menús.</div>`;
  for(let i=0;i<7;i++){
    const d=addDays(start,i),dt=parse(d);
    h+=`<section class="day ${d===t?'is-today':''}"><div class="day-h"><b>${dt.toLocaleDateString('es-ES',{weekday:'long'})}</b><span>${dt.getDate()}</span></div><div class="list">`+
      c.meals.map(m=>{const k=d+'|'+m,e=S.menu[k],r=recOf(e);const rc=r&&MC?recipeCost(r,e.ppl||c.people):null;
        return`<div class="meal ck-meal ${e&&e.made?'made':''}"><button class="ck-mm" data-act="ckSlot" data-k="${k}"><span class="meal-k">${MEALS[m]}</span><span class="meal-v ${e?'':'empty-slot'}">${e?esc(e.name)+(e.sug?' <span class="tag">Sugerido</span>':'')+(e.made?' <span class="tag">Hecho</span>':''):'Elegir plato'}</span>${rc?`<span class="row-side">≈ ${eur(rc.total)}</span>`:''}</button>${e&&d>=t&&!e.made?`<button class="ck-ib" data-act="ckSwap" data-k="${k}" aria-label="Otro plato" title="Otro plato">↻</button><button class="ck-ib" data-act="ckDrop" data-k="${k}" aria-label="Quitar" title="Quitar">✕</button>`:''}</div>`}).join('')+`</div></section>`;
  }
  return h;
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
  let h=`<div class="ck-actions" style="margin-top:12px"><button class="btn" data-act="ckNewRec">+ Nueva receta</button><button class="btn sec" data-act="ckLinkRec">🔗 Desde enlace</button></div>
  <div class="quick"><input class="field" id="qRec" placeholder="Buscar receta o ingrediente" value="${esc(ui.recQ||'')}" autocomplete="off"><select class="field" id="ckSort" style="flex:none;width:auto">${opt([['recientes','Recientes'],['az','A-Z'],['valoradas','Mejor valoradas'],['hechas','Más hechas'],['baratas','Más baratas'],['rapidas','Más rápidas']],so)}</select></div>
  <div class="chips" style="margin-top:10px">${[['todas','Todas'],['fav','❤️ Favoritas'],['again','🔁 Repetiría'],['hechas','✅ Hechas'],['probar','🆕 Por probar'],['casa','🥫 Con lo que tengo'],['instagram','📸 Instagram'],['tiktok','🎵 TikTok'],['web','🌐 Web']].map(([k,l])=>`<button class="chip ${f===k?'on':''}" data-act="recF" data-v="${k}">${l}</button>`).join('')}</div>`;
  if(!S.recipes.length)return h+`<div class="empty" style="margin-top:14px">Guarda aquí tus recetas y las que veas en Instagram, TikTok o cualquier web.<br><br><button class="btn sec" data-act="ckSeed">Cargar 24 recetas básicas</button></div>`;
  if(!a.length)return h+`<div class="empty" style="margin-top:14px">Ninguna receta coincide.</div>`;
  h+=`<div style="margin-top:12px">`+ul(a.map(r=>{const rc=recipeCost(r,c.people),[ic]=CK_SRC[srcOf(r.url)],n=(r.made||[]).length;
    const meta=[r.time?'⏱ '+r.time+' min':'',rc?'≈ '+eur(rc.per)+'/ración':'',n?'✅ '+n+(n>1?' veces':' vez'):'',r.rating?'★'.repeat(r.rating):'',r.again?'🔁':'',vetoed(r,c.vetoes)?'<span style="color:var(--danger)">Ingrediente vetado</span>':''].filter(Boolean);
    return`<li class="row"><span class="ck-src" aria-hidden="true">${ic}</span><div class="row-main" data-act="ckRec" data-id="${r.id}"><div class="row-title">${r.fav?'❤️ ':''}${esc(r.name)}</div><div class="row-meta">${meta.map(m=>`<span>${m}</span>`).join('')}</div></div></li>`}))+`</div>`;
  return h;
}

function vCkDespensa(){
  const f=ui.panF||'todo',all=S.pantry||[];
  let a=all.slice();
  if(f==='low')a=a.filter(pantryLow);else if(f!=='todo')a=a.filter(x=>(x.loc||'Despensa')===f);
  const low=all.filter(pantryLow);
  let h=`<div class="ck-actions" style="margin-top:12px"><button class="btn" data-act="ckNewPan">+ Producto</button><button class="btn sec" data-act="ckLowShop" ${low.length?'':'disabled'}>🛒 Lo que se acaba (${low.length})</button></div>
  <div class="chips" style="margin-top:10px">${[['todo','Todo'],['low','⚠️ Se acaba'],...CK_LOCS.map(l=>[l,l])].map(([k,l])=>`<button class="chip ${f===k?'on':''}" data-act="panF" data-v="${k}">${l}</button>`).join('')}</div>`;
  if(!all.length)return h+`<div class="empty" style="margin-top:14px">Apunta lo que tienes en casa y cuánto queda. La app lo descuenta al cocinar, lo suma al comprar y te avisa antes de que se acabe.<br><br><button class="btn sec" data-act="ckSeedPan">Empezar con los básicos</button></div>`;
  if(!a.length)return h+`<div class="empty" style="margin-top:14px">Nada por aquí.</div>`;
  const locs=f==='todo'||f==='low'?CK_LOCS:[f];
  locs.forEach(l=>{const b=a.filter(x=>(x.loc||'Despensa')===l).sort((x,y)=>pantryLow(y)-pantryLow(x)||x.name.localeCompare(y.name,'es'));if(!b.length)return;
    h+=`<h2>${esc(l)}</h2>`+ul(b.map(x=>{const lw=pantryLow(x),pct=x.min>0?Math.min(100,x.n/(x.min*3)*100):Math.min(100,x.n>0?100:0);
      return`<li class="row ck-pan ${lw?'low':''}"><div class="row-main" data-act="ckPan" data-id="${x.id}"><div class="row-title">${esc(x.name)}${x.auto?' <span class="tag">Auto</span>':''}</div><div class="ck-lvl"><i style="width:${pct}%"></i></div><div class="row-meta"><span>${x.n>0?'Quedan '+fmtAmt(x.n,x.u):'Agotado'}</span>${x.min>0?`<span>mín. ${fmtAmt(x.min,x.u)}</span>`:''}${x.exp?`<span>${x.exp<today()?'⚠️ Caducado':'Cad. '+relDate(x.exp)}</span>`:''}</div></div>
        <button class="ck-ib" data-act="panStep" data-id="${x.id}" data-v="-1" aria-label="Quitar">−</button><button class="ck-ib" data-act="panStep" data-id="${x.id}" data-v="1" aria-label="Añadir">+</button></li>`}));
  });
  return h;
}

function vCkAjustes(){
  const c=ck();
  let h=`<h2>Para cuántos cocino</h2><div class="list ck-set"><div class="row"><div class="row-main">Personas</div><button class="ck-ib" data-act="ckPeople" data-v="-1">−</button><b class="ck-num">${c.people}</b><button class="ck-ib" data-act="ckPeople" data-v="1">+</button></div>
  <div class="row"><div class="row-main">Presupuesto semanal</div><input class="field" id="ckBudget" type="number" inputmode="decimal" min="0" step="5" value="${c.budget}" style="width:96px;text-align:right"> €</div>
  <div class="row"><div class="row-main">Planificar</div>${Object.entries(MEALS).map(([k,l])=>`<button class="chip ${c.meals.includes(k)?'on':''}" data-act="ckMeal" data-v="${k}">${l}</button>`).join('')}</div></div>
  <h2>Mis electrodomésticos</h2><p class="hint" style="margin-top:-4px">Solo te sugiero recetas que puedas hacer y te digo cómo adaptarlas.</p><div class="ck-wrap">${[...CK_APPL,...(c.applX||[]).map(x=>[x,x])].map(([k,l])=>`<button class="chip ${c.appl.includes(k)?'on':''}" data-act="ckAppl" data-v="${esc(k)}">${esc(l)}</button>`).join('')}<button class="chip add" data-act="ckApplNew">+ Otro</button></div>
  <h2>Ingredientes vetados</h2><p class="hint" style="margin-top:-4px">No se sugerirá ninguna receta que los lleve.</p><div class="ck-wrap">${c.vetoes.map((v,i)=>`<button class="chip on" data-act="ckVetoDel" data-v="${i}">${esc(v)} ✕</button>`).join('')||'<span class="hint">Ninguno</span>'}</div>
  <div class="quick"><input class="field" id="qVeto" placeholder="Ej.: cilantro, setas, marisco" enterkeyhint="done"><button class="btn" data-act="ckVetoAdd">Vetar</button></div>
  <h2>Precios de Mercadona</h2><div class="empty" style="text-align:left">${MC?`${MC.p.length.toLocaleString('es-ES')} productos con precios de la tienda online de Mercadona del <b>${parse(MC.at).toLocaleDateString('es-ES',{day:'numeric',month:'long'})}</b>. Se actualizan solos cada día.`:'Cargando precios…'}<br><br>Para afinar una receta, abre un ingrediente y elige el producto exacto que compras: la app lo recordará siempre.</div>
  <h2>Recetario</h2><button class="btn sec" style="width:100%" data-act="ckSeed">Añadir recetas básicas que falten</button>`;
  return h;
}

/* ---------- hojas ---------- */
function slotSheet(k){
  const [date,meal]=k.split('|'),c=ck(),e=S.menu[k],r0=recOf(e);
  const ov=sheet(`${MEALS[meal]} del ${parse(date).toLocaleDateString('es-ES',{weekday:'long',day:'numeric'})}`,`
    <input class="field" id="f_q" placeholder="Buscar en mis recetas o escribir un plato" value="${esc(e?e.name:'')}" autocomplete="off">
    <div id="ckPick" class="ck-pick"></div>
    <label for="f_p">Personas</label><input class="field" id="f_p" type="number" min="1" value="${e&&e.ppl||c.people}">
    ${r0?`<div class="ck-actions" style="margin-top:12px"><button type="button" class="btn sec" data-k="ver">Ver receta</button>${e.made?'':`<button type="button" class="btn sec" data-k="hecho">✅ Lo he cocinado</button>`}</div>`:''}`,
  {onSave:ov=>{
    const name=val(ov,'f_q');if(!name){delete S.menu[k];save();return}
    const r=recipeByName(name),ppl=+val(ov,'f_p')||c.people;
    S.menu[k]={name:r?r.name:name,recipeId:r?r.id:null};if(ppl!==c.people)S.menu[k].ppl=ppl;
    if(e&&e.made)S.menu[k].made=e.made;save();
  },onDelete:e?()=>{rejectInWeek(weekStart(ui.menuWeek||0),e.recipeId);delete S.menu[k];save()}:null});
  const inp=ov.querySelector('#f_q'),box=ov.querySelector('#ckPick');
  const draw=()=>{const q=norm(inp.value);const start=weekStart(ui.menuWeek||0);const used=new Set();
    let a=S.recipes.filter(r=>!q||norm(r.name).includes(q)||(r0&&r0.id===r.id&&norm(inp.value)===norm(r0.name)));
    if(r0&&norm(inp.value)===norm(r0.name))a=S.recipes.slice();
    a=a.map(r=>[suggestable(r,meal,c)?score(r,meal,used,(c.rej||{})[start]||[],0,c):-200+Math.random(),r]).sort((x,y)=>y[0]-x[0]).slice(0,30).map(x=>x[1]);
    box.innerHTML=a.map(r=>{const rc=recipeCost(r,c.people);const v=vetoed(r,c.vetoes);
      return`<button type="button" class="ck-opt ${r0&&r0.id===r.id?'on':''}" data-pick="${esc(r.name)}"><b>${esc(r.name)}</b><small>${[r.time?r.time+' min':'',rc?'≈ '+eur(rc.total):'',pantryShare(r)>=.5?'🥫 tienes '+Math.round(pantryShare(r)*100)+'%':'',v?'⚠️ vetado':'',!applOk(r,c.appl)?'⚠️ sin electrodoméstico':''].filter(Boolean).join(' · ')}</small></button>`}).join('')||`<p class="hint">Ninguna receta con ese nombre: se guardará solo el nombre del plato.</p>`};
  draw();inp.addEventListener('input',draw);
  ov.addEventListener('click',ev=>{
    const p=ev.target.closest('[data-pick]');if(p){inp.value=p.dataset.pick;draw();return}
    const b=ev.target.closest('[data-k]');if(!b)return;
    if(b.dataset.k==='ver'){recipeView(r0);return}
    if(b.dataset.k==='hecho'){ov.remove();cookedSheet(r0,e.ppl||c.people,k)}
  });
}

function cookedSheet(r,ppl,k){
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
    if(k&&S.menu[k]){S.menu[k].made=today();delete S.menu[k].sug}
    save();toastUndo('Apuntado'+(c?' y descontado de la despensa':''));
  }}).addEventListener('click',ev=>{
    const a=ev.target.closest('[data-again]');if(a){a.parentNode.querySelectorAll('[data-again]').forEach(b=>b.classList.toggle('on',b===a));return}
    const s=ev.target.closest('[data-star]');if(s){const n=+s.dataset.star;s.parentNode.querySelectorAll('[data-star]').forEach(b=>b.classList.toggle('on',+b.dataset.star<=n))}
  });
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
      return`<button type="button" class="ck-ing" data-ing="${i}"><span class="ck-dot ${x&&x.n>0?'ok':''}" aria-label="${x&&x.n>0?'En la despensa':'No está en la despensa'}"></span><span><b>${esc(g.name)}</b>${qty?' · '+esc(qty):''}<br><small>${ic2?esc(ic2.p.name)+' · '+eur(ic2.p.price)+(x&&x.n>0?' · en casa: '+fmtAmt(x.n,x.u):''):MC?'Sin producto: toca para elegirlo':''}</small></span></button>`}).join('')||'<p class="hint">Sin ingredientes</p>'}</div>
    ${r.steps?`<h4>Preparación</h4><div class="ck-steps">${esc(r.steps).replace(/\n/g,'<br>')}</div>`:''}
    ${(()=>{const t=adaptTips(r);return t.length?`<h4>Con tus electrodomésticos</h4>${t.map(([a,b])=>`<div class="ck-tip"><b>${esc(a)}</b><br>${esc(b)}</div>`).join('')}`:''})()}
    ${r.notes?`<h4>Notas</h4><div class="ck-steps">${esc(r.notes).replace(/\n/g,'<br>')}</div>`:''}
    <div class="ck-actions" style="margin-top:14px"><button type="button" class="btn" data-r="cook">✅ La he hecho</button><button type="button" class="btn sec" data-r="plan">🗓️ Al menú</button></div>
    <div class="ck-actions" style="margin-top:8px"><button type="button" class="btn sec" data-r="edit">Editar</button></div>`;
  };
  draw();
  box.addEventListener('click',ev=>{
    const x=find(S.recipes,r.id);if(!x)return;
    const s=ev.target.closest('[data-star]');if(s){x.rating=x.rating===+s.dataset.star?0:+s.dataset.star;save();r=x;draw();return}
    const g=ev.target.closest('[data-ing]');if(g){productPicker(x.ingredients[+g.dataset.ing].name,p=>{S.prodMap=Object.assign({},S.prodMap||{});S.prodMap[norm(x.ingredients[+g.dataset.ing].name)]=p.id;mcCache.clear();save();draw()});return}
    const b=ev.target.closest('[data-r]');if(!b)return;const k=b.dataset.r;
    if(k==='fav')x.fav=!x.fav;
    if(k==='again')x.again=!x.again;
    if(k==='nosug'){x.noSug=!x.noSug;toast(x.noSug?'No te la volveré a sugerir':'Se puede volver a sugerir')}
    if(k==='ppl-'){ppl=Math.max(1,ppl-1);draw();return}
    if(k==='ppl+'){ppl++;draw();return}
    if(k==='cook'){ov.remove();cookedSheet(x,ppl);return}
    if(k==='edit'){ov.remove();recipeEdit(x);return}
    if(k==='plan'){ov.remove();planSheet(x);return}
    save();r=x;draw();
  });
}

function planSheet(r){
  const c=ck(),start=weekStart(ui.menuWeek||0);
  const opts=[];for(let w=0;w<2;w++){const s=weekStart((ui.menuWeek||0)+w);for(let i=0;i<7;i++){const d=addDays(s,i);if(d<today())continue;c.meals.forEach(m=>{const e=S.menu[d+'|'+m];opts.push([d+'|'+m,parse(d).toLocaleDateString('es-ES',{weekday:'long',day:'numeric'})+' · '+MEALS[m]+(e?' (ahora: '+e.name+')':'')])})}}
  sheet('Añadir «'+r.name+'» al menú',`<label for="f_s">¿Cuándo?</label><select class="field" id="f_s">${opt(opts,(opts.find(o=>!S.menu[o[0]])||opts[0]||[])[0])}</select>`,
  {saveLabel:'Añadir',onSave:ov=>{const k=val(ov,'f_s');if(!k)return false;S.menu[k]={name:r.name,recipeId:r.id};save();toast('Añadida al menú')}});
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

function productPicker(q,onPick){
  const ov=sheet('Producto de Mercadona',`<input class="field" id="f_q" value="${esc(q)}" placeholder="Buscar producto" autocomplete="off"><div id="ckPP" class="ck-pick" style="max-height:52vh"></div><p class="hint">Precios de la tienda online de Mercadona${MC?' del '+parse(MC.at).toLocaleDateString('es-ES',{day:'numeric',month:'short'}):''}.</p>`,{});
  const inp=ov.querySelector('#f_q'),box=ov.querySelector('#ckPP');
  const draw=()=>{if(!MC){box.innerHTML='<p class="hint">Cargando precios…</p>';loadMC().then(draw);return}
    const a=searchMC(inp.value,40);
    box.innerHTML=a.map(p=>`<button type="button" class="ck-opt ck-prod" data-id="${p.id}">${p.img?`<img src="${prodImg(p)}" alt="" loading="lazy">`:''}<span><b>${esc(p.name)}</b><small>${esc(p.pack)} ${prodSize(p)} · <b>${eur(p.price)}</b> · ${eur(p.ref)}/${esc(p.refFmt)}</small></span></button>`).join('')||'<p class="hint">Sin resultados</p>'};
  draw();let t;inp.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(draw,150)});
  box.addEventListener('click',ev=>{const b=ev.target.closest('[data-id]');if(!b)return;const p=prod(MC.byId.get(b.dataset.id));ov.remove();onPick(p)});
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
  },onDelete:n?null:()=>{S.pantry=S.pantry.filter(p=>p.id!==x.id);save();toastUndo('Quitado de la despensa')}});
  ov.addEventListener('click',ev=>{if(!ev.target.closest('[data-k="mc"]'))return;
    productPicker(val(ov,'f_t'),p=>{ov.dataset.mid=p.id;const t=ov.querySelector('#f_t');if(!t.value)t.value=p.name.replace(/ Hacendado.*$/,'');
      ov.querySelector('#f_mc').textContent=p.name+' · '+prodSize(p)+' · '+eur(p.price);
      const us=ov.querySelector('#f_u');if(p.d==='ud')us.value='ud';else if(us.value==='ud')us.value=p.fmt==='l'?'ml':'g';
      if(n&&!+val(ov,'f_n'))ov.querySelector('#f_n').value=p.d==='ud'?p.size:(us.value==='kg'||us.value==='l'?p.size/1000:p.size)});
  });
}

function shopSheet(){
  const start=weekStart(ui.menuWeek||0),needs=weekNeeds(start),c=ck();
  const L0=S.lists.find(l=>l.id==='super')||S.lists[0];
  const inList=a=>S.items.some(i=>!i.done&&norm(i.name)===norm(a.name));
  const ov=sheet('Compra del menú',`
    <label for="f_l">Añadir a la lista</label><select class="field" id="f_l">${opt(S.lists.map(l=>[l.id,l.name]),L0.id)}</select>
    <div class="ck-total" id="ckTot"></div>
    <div class="ck-box" id="ingBox">${needs.map((a,i)=>{const dis=a.covered||inList(a);
      return`<label class="ing-row" style="display:flex;margin:0;color:var(--ink);font-weight:400;font-size:1rem"><input type="checkbox" data-ing="${i}" ${dis?'':'checked'}><span><b>${esc(a.name)}</b>${a.p&&!a.covered?` <small>${a.packs} × ${esc(a.p.name)} ${prodSize(a.p)}</small>`:''}<br><small>${a.covered?'🥫 Ya lo tienes en la despensa':inList(a)?'Ya está en la lista':a.p?'':'Sin precio'}${a.from.length?' · '+esc(a.from.join(', ')):''}</small></span><b class="ck-pr">${a.cost?eur(a.cost):''}</b></label>`}).join('')}</div>
    <p class="hint">Desmarca lo que ya tengas. Al marcar «comprado» en Compras y quitarlo, se suma a tu despensa.</p>`,
  {saveLabel:'Añadir a Compras',onSave:ov=>{
    const lid=val(ov,'f_l');let n=0;
    ov.querySelectorAll('[data-ing]').forEach(cb=>{if(!cb.checked)return;const a=needs[+cb.dataset.ing];
      S.items.push({id:uid(),listId:lid,name:a.name,qty:a.p?`${a.packs} × ${prodSize(a.p)}`:a.qtys.join(' + '),section:ckSection(a.p,a.name),by:'Menú',done:false,price:a.cost||0,mid:a.p?a.p.id:'',pq:a.p?{n:a.packs*a.p.size,d:a.p.d}:null});n++});
    if(!n){toast('No has marcado nada');return false}
    ui.list=lid;save();toast(n+' producto'+(n>1?'s':'')+' añadido'+(n>1?'s':'')+' a Compras');
  }});
  const tot=()=>{let t=0;ov.querySelectorAll('[data-ing]').forEach(cb=>{if(cb.checked)t+=needs[+cb.dataset.ing].cost});
    ov.querySelector('#ckTot').innerHTML=`<span>Total estimado</span><b>${eur(t)}</b><small>${c.budget?(t<=c.budget?'Te sobran '+eur(c.budget-t)+' del presupuesto':'Te pasas '+eur(t-c.budget)):''}</small>`};
  tot();ov.querySelector('#ingBox').addEventListener('change',tot);
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
  ckTab:d=>{ui.ckTab=d.v;render();$('#app').scrollTop=0},
  menuWeek:d=>{const v=+d.v;ui.menuWeek=v===0?0:(ui.menuWeek||0)+v;render()},
  ckSlot:d=>slotSheet(d.k),
  ckSuggest:()=>{if(!S.recipes.length){toast('Primero guarda o carga algunas recetas');return}
    const go=()=>{const n=suggestWeek(weekStart(ui.menuWeek||0));save();toast(n?n+' plato'+(n>1?'s':'')+' sugerido'+(n>1?'s':''):'No quedan huecos libres (o ninguna receta encaja con tus vetos y electrodomésticos)')};
    MC?go():loadMC().then(go)},
  ckSwap:d=>{const e=S.menu[d.k];const start=weekStart(ui.menuWeek||0);if(e)rejectInWeek(start,e.recipeId);const old=S.menu[d.k];delete S.menu[d.k];
    if(!suggestWeek(start,d.k)){S.menu[d.k]=old;toast('No hay otra receta que encaje')}save()},
  ckDrop:d=>{const e=S.menu[d.k];if(!e)return;rejectInWeek(weekStart(ui.menuWeek||0),e.recipeId);delete S.menu[d.k];save();toastUndo('Quitado del menú')},
  ckClearSug:()=>{const start=weekStart(ui.menuWeek||0);let n=0;weekSlots(start).forEach(([,,k])=>{if(S.menu[k]&&S.menu[k].sug){delete S.menu[k];n++}});save();toastUndo(n+' sugerencias quitadas')},
  ckShop:()=>MC?shopSheet():loadMC().then(shopSheet),
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
    (S.pantry||[]).filter(pantryLow).forEach(x=>{if(S.items.some(i=>!i.done&&norm(i.name)===norm(x.name)))return;S.items.push(Object.assign(pantryItem(x,L.id),{auto:false}));n++});
    save();toast(n?n+' añadido'+(n>1?'s':'')+' a '+L.name:'Ya estaba todo en la lista')},
  ckPeople:d=>ckSet('people',Math.max(1,ck().people+(+d.v))),
  ckMeal:d=>{const m=ck().meals;const nm=m.includes(d.v)?m.filter(x=>x!==d.v):[...m,d.v];if(!nm.length){toast('Elige al menos una comida');return}ckSet('meals',['comida','cena'].filter(x=>nm.includes(x)))},
  ckAppl:d=>{const a=ck().appl;ckSet('appl',a.includes(d.v)?a.filter(x=>x!==d.v):[...a,d.v])},
  ckApplNew:()=>{sheet('Otro electrodoméstico',`<input class="field" id="f_t" placeholder="Ej.: Panificadora">`,{onSave:ov=>{const v=val(ov,'f_t');if(!v)return false;const c=ck();S.cook=Object.assign({},S.cook,{applX:[...new Set([...(c.applX||[]),v])],appl:[...new Set([...c.appl,v])]});save()}})},
  ckVetoAdd:()=>{const el=$('#qVeto');const vs=el.value.split(',').map(s=>s.trim()).filter(Boolean);if(!vs.length)return;const c=ck();ckSet('vetoes',[...new Set([...c.vetoes,...vs])]);toast('Vetado: '+vs.join(', '))},
  ckVetoDel:d=>{const v=ck().vetoes.slice();v.splice(+d.v,1);ckSet('vetoes',v)}
};

document.addEventListener('input',e=>{
  if(e.target.id==='qRec'){ui.recQ=e.target.value;clearTimeout(ui._rt);ui._rt=setTimeout(()=>{render();const f=$('#qRec');if(f){f.focus();f.setSelectionRange(f.value.length,f.value.length)}},250)}
});
document.addEventListener('change',e=>{
  if(e.target.id==='ckSort'){ui.recSort=e.target.value;render()}
  if(e.target.id==='ckBudget'){ckSet('budget',Math.max(0,+e.target.value||0))}
});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='qVeto')CK_ACT.ckVetoAdd()});

// Recetas compartidas desde otra app (Android: Compartir → Casa)
function ckShared(){
  try{
    const q=new URLSearchParams(location.search);if(!q.has('url')&&!q.has('text'))return;
    const text=q.get('text')||'',url=q.get('url')||(text.match(/https?:\/\/\S+/)||[''])[0],title=q.get('title')||'';
    history.replaceState(null,'',location.pathname);
    ui.view='menu';ui.ckTab='recetas';render();
    linkSheet({url,title,text:text.replace(url,'').trim()});
  }catch(e){}
}
