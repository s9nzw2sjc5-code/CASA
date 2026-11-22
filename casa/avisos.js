/* Avisos en el móvil (aunque Casa esté cerrada).
   Cada móvil calcula sus avisos de las próximas 48 h y los sube al servicio «casa-avisos» (Cloudflare),
   que los envía a su hora. Solo viajan los textos de los avisos; se borran al entregarse. */
(function(root){
 'use strict';
 const URL_AVISOS='https://casa-avisos.s9nzw2sjc5.workers.dev';
 const VAPID_PUBLIC='BBDg3erlCBsJ-_5HoF097o0zREX5rAiYY0I-IqXhHGg75q1X29q0El9wWlyopl-BhlAZy7JldNf7WHhilvqUPY4';
 const LSK='casa-avisos',hoursKey='casa-avisos-horas';
 const post=(path,body)=>fetch(URL_AVISOS+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||('Error '+r.status));return d});
 const on=()=>{try{return localStorage.getItem(LSK)==='1'&&'Notification' in root&&Notification.permission==='granted'}catch(e){return false}};
 function hours(){try{return Object.assign({morning:'09:00',noon:'13:00',evening:'21:00'},JSON.parse(localStorage.getItem(hoursKey)||'{}'))}catch(e){return{morning:'09:00',noon:'13:00',evening:'21:00'}}}
 // Preferencias de este móvil (cada persona en el suyo): qué tipos de aviso y si solo lo suyo
 const prefsKey='casa-avisos-prefs',TYPES=['resumen','urgente','hora','citas','ringo','manana','timers'];
 function prefs(){const d={types:Object.fromEntries(TYPES.map(k=>[k,true])),mine:true,timersAll:true};try{const p=JSON.parse(localStorage.getItem(prefsKey)||'{}');return{...d,...p,types:{...d.types,...(p.types||{})}}}catch(e){return d}}
 // Texto del aviso al terminar un temporizador
 const timerBody=l=>/lavadora/i.test(l)?'Ya ha terminado. A tender antes de que coja olor.':/secadora/i.test(l)?'Ya ha terminado. Saca la ropa y dóblala ahora, que se arruga menos.':/lavavajillas/i.test(l)?'Ya ha terminado. Ábrelo para que se sequen los platos.':/horno/i.test(l)?'Ya está. Cuidado al sacarlo.':'Tiempo cumplido.';
 const at=(day,hm)=>{const [h,m]=String(hm||'09:00').split(':').map(Number);const d=new Date(day+'T00:00:00');d.setHours(h||0,m||0,0,0);return d};
 /* Avisos de hoy y mañana a partir de los datos de casa (sin cambiar nada) */
 function build(ctx){
  const out=[],now=Date.now(),H=hours(),P=prefs(),on=k=>P.types[k]!==false,days=[ctx.today,ctx.addDays(ctx.today,1)];
  const push=(d,title,body,tag,kind)=>{if(on(kind)&&d.getTime()>now+60e3)out.push({at:d.toISOString(),title,body:body||'',tag})};
  // «Solo lo mío»: las tareas de esta persona y las de los dos
  const mine=t=>!P.mine||!ctx.me||!t.who||t.who===ctx.me||t.who==='ambos';
  const pending=(ctx.tasks||[]).filter(t=>t&&!t.done&&typeof t.date==='string'&&mine(t));
  // Temporizadores (lavadora, secadora…): aviso justo al terminar
  for(const tm of (ctx.timers||[]))if(tm&&tm.end>now&&(P.timersAll||!ctx.me||tm.by===ctx.me)&&on('timers'))out.push({at:new Date(tm.end).toISOString(),title:'⏲️ '+String(tm.label||'Temporizador')+' lista',body:timerBody(String(tm.label||'')),tag:'casa-timer-'+tm.id});
  for(const day of days){
   const dayTasks=pending.filter(t=>t.date===day),late=pending.filter(t=>t.date<day),urgent=pending.filter(t=>t.urgent&&t.date<=day);
   // Mañana: resumen del día (lo mismo que «Recordatorios de hoy»)
   const n=(ctx.nudges?ctx.nudges(day):[]).slice(0,3).map(x=>x.text);
   const min=dayTasks.concat(late).reduce((s,t)=>s+(ctx.minutes?ctx.minutes(t):15),0);
   if(dayTasks.length||late.length||n.length)push(at(day,H.morning),'Casa · Hoy',(n.length?n.join(' · '):'')+(n.length?'':(dayTasks.length+' tareas · unos '+min+' min')),'casa-manana-'+day,'resumen');
   // Mediodía: lo urgente que siga sin hacer
   if(urgent.length)push(at(day,H.noon),'❗ Urgente',urgent.slice(0,3).map(t=>t.title).join(' · '),'casa-urgente-'+day,'urgente');
   // A su hora: tareas con hora y citas (30 min antes)
   for(const t of dayTasks.filter(t=>t.time))push(at(day,t.time),'⏰ '+t.title,'Ahora: '+t.time,'casa-t-'+t.id+'-'+day,'hora');
   for(const e of (ctx.events||[]).filter(e=>e.date===day&&e.time)){const d=at(day,e.time);d.setMinutes(d.getMinutes()-30);push(d,'📅 '+e.title,'A las '+e.time+(e.place?' · '+e.place:''),'casa-e-'+e.id+'-'+day,'citas')}
   for(const p of (ctx.pets||[]).filter(p=>p.due===day))push(at(day,p.time||H.morning),'🐶 Ringo: '+p.name,p.time?'A las '+p.time:'Toca hoy','casa-p-'+p.id+'-'+day,'ringo');
   // Noche: lo de mañana
   const next=pending.filter(t=>t.date===ctx.addDays(day,1));
   if(next.length)push(at(day,H.evening),'Casa · Mañana',next.slice(0,4).map(t=>t.title).join(' · ')+(next.length>4?' y '+(next.length-4)+' más':''),'casa-noche-'+day,'manana');
  }
  return out.sort((a,b)=>a.at.localeCompare(b.at)).slice(0,80);
 }
 async function subscription(){const sw=await navigator.serviceWorker.ready;return sw.pushManager.getSubscription()}
 let timer=null,lastSent='';
 async function sync(ctx,force){
  if(!on())return;const sub=await subscription();if(!sub)return;
  const items=build(ctx),sig=JSON.stringify(items);if(!force&&sig===lastSent)return;
  await post('/schedule',{sub:sub.toJSON(),items});lastSent=sig;
 }
 const api={
  URL:URL_AVISOS,on,hours,build,prefs,TYPES,timerBody,
  setPrefs(p){try{localStorage.setItem(prefsKey,JSON.stringify({...prefs(),...p}))}catch(e){}lastSent=''},
  // Subir ya (al poner o quitar un temporizador, o al cambiar preferencias)
  async syncNow(ctx){await sync(ctx,true)},
  setHours(h){try{localStorage.setItem(hoursKey,JSON.stringify(Object.assign(hours(),h)))}catch(e){}lastSent=''},
  async enable(ctx){
   await root.CasaPush.enable({publicKey:VAPID_PUBLIC,register:sub=>post('/subscribe',{sub,items:build(ctx)})});
   localStorage.setItem(LSK,'1');lastSent='';
  },
  async disable(){await root.CasaPush.disable(sub=>post('/unsubscribe',{endpoint:sub.endpoint})).catch(()=>{});try{localStorage.removeItem(LSK)}catch(e){}},
  async test(){const sub=await subscription();if(!sub)throw Error('Activa primero los avisos en este móvil.');const r=await post('/test',{endpoint:sub.endpoint});if(!r.ok)throw Error('El servicio de avisos no ha podido llegar a este móvil.');},
  // Se llama al pintar la app: sube los avisos un rato después del último cambio
  schedule(ctxFn){if(!on())return;clearTimeout(timer);timer=setTimeout(()=>{sync(ctxFn()).catch(e=>console.warn('avisos',e))},8000)},
 };
 root.CasaAvisos=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
