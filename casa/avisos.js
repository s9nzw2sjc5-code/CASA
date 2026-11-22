/* Avisos en el móvil (aunque Casa esté cerrada).
   Cada móvil calcula sus avisos de las próximas 48 h y los sube al servicio «casa-avisos» (Cloudflare),
   que los envía a su hora. Solo viajan los textos de los avisos; se borran al entregarse. */
(function(root){
 'use strict';
 const URL_AVISOS='https://casa-avisos.s9nzw2sjc5.workers.dev';
 const VAPID_PUBLIC='BBDg3erlCBsJ-_5HoF097o0zREX5rAiYY0I-IqXhHGg75q1X29q0El9wWlyopl-BhlAZy7JldNf7WHhilvqUPY4';
 const LSK='casa-avisos',hoursKey='casa-avisos-horas',pendKey='casa-avisos-pendiente';
 const post=(path,body)=>fetch(URL_AVISOS+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||('Error '+r.status));return d});
 const on=()=>{try{return localStorage.getItem(LSK)==='1'&&'Notification' in root&&Notification.permission==='granted'}catch(e){return false}};
 function hours(){try{return Object.assign({morning:'09:00',noon:'13:00',evening:'21:00'},JSON.parse(localStorage.getItem(hoursKey)||'{}'))}catch(e){return{morning:'09:00',noon:'13:00',evening:'21:00'}}}
 // Preferencias de este móvil (cada persona en el suyo): qué tipos de aviso y si solo lo suyo
 const prefsKey='casa-avisos-prefs',TYPES=['resumen','urgente','hora','citas','ringo','manana','timers','alarma','mensaje'];
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

  for(const day of days){
   const dayTasks=pending.filter(t=>t.date===day),late=pending.filter(t=>t.date<day),urgent=pending.filter(t=>t.urgent&&t.date<=day);
   // Mañana: resumen del día (lo mismo que «Recordatorios de hoy»)
   const n=(ctx.nudges?ctx.nudges(day):[]).slice(0,3).map(x=>x.text);
   const min=dayTasks.concat(late).reduce((s,t)=>s+(ctx.minutes?ctx.minutes(t):15),0);
   if(dayTasks.length||late.length||n.length)push(at(day,H.morning),'☀️ Hoy toca',(n.length?n.join(' · '):'')+(n.length?'':(dayTasks.length+' tareas · unos '+min+' min')),'casa-manana-'+day,'resumen');
   // Mediodía: lo urgente que siga sin hacer
   if(urgent.length)push(at(day,H.noon),'❗ Urgente',urgent.slice(0,3).map(t=>t.title).join(' · '),'casa-urgente-'+day,'urgente');
   // A su hora: tareas con hora y citas (30 min antes)
   for(const t of dayTasks.filter(t=>t.time))push(at(day,t.time),'⏰ '+t.title,'Ahora: '+t.time,'casa-t-'+t.id+'-'+day,'hora');
   for(const e of (ctx.events||[]).filter(e=>e.date===day&&e.time)){const d=at(day,e.time);d.setMinutes(d.getMinutes()-30);push(d,'📅 '+e.title,'A las '+e.time+(e.place?' · '+e.place:''),'casa-e-'+e.id+'-'+day,'citas')}
   for(const p of (ctx.pets||[]).filter(p=>p.due===day))push(at(day,p.time||H.morning),'🐶 Ringo: '+p.name,p.time?'A las '+p.time:'Toca hoy','casa-p-'+p.id+'-'+day,'ringo');
   // Noche: lo de mañana
   const next=pending.filter(t=>t.date===ctx.addDays(day,1));
   if(next.length)push(at(day,H.evening),'🌙 Mañana toca',next.slice(0,4).map(t=>t.title).join(' · ')+(next.length>4?' y '+(next.length-4)+' más':''),'casa-noche-'+day,'manana');
  }
  return out.sort((a,b)=>a.at.localeCompare(b.at)).slice(0,80);
 }
 async function subscription(){const sw=await navigator.serviceWorker.ready;return sw.pushManager.getSubscription()}
 let timer=null,lastSent='';
 // Lo que el servicio necesita saber de este móvil: de quién es, de qué casa y qué avisos no quiere
 const meta=ctx=>({person:ctx.me||'',houseKey:ctx.houseKey||'',mute:TYPES.filter(k=>prefs().types[k]===false)});
 async function sync(ctx,force){
  if(!on())return;let sub=await subscription();
  // Si el móvil perdió la suscripción (pasa en iPhone), se renueva sola; si no se puede, se muestra otra vez el botón de activar
  if(!sub){try{await root.CasaPush.enable({publicKey:VAPID_PUBLIC,register:s=>post('/subscribe',{sub:s,items:build(ctx),...meta(ctx)})});lastSent='';sub=await subscription()}catch(e){try{localStorage.removeItem(LSK)}catch(_){}return}}
  if(!sub)return;
  const items=build(ctx),body={sub:sub.toJSON(),items,...meta(ctx)},sig=JSON.stringify(body);if(!force&&sig===lastSent)return;
  await post('/schedule',body);lastSent=sig;
  try{if(localStorage.getItem(pendKey)==='1'){localStorage.removeItem(pendKey);if(root.render)root.render()}}catch(e){}
 }
 const api={
  URL:URL_AVISOS,on,hours,build,prefs,TYPES,timerBody,
  setPrefs(p){try{localStorage.setItem(prefsKey,JSON.stringify({...prefs(),...p}))}catch(e){}lastSent=''},
  // Subir ya (al poner o quitar un temporizador, o al cambiar preferencias)
  async syncNow(ctx){await sync(ctx,true)},
  setHours(h){try{localStorage.setItem(hoursKey,JSON.stringify(Object.assign(hours(),h)))}catch(e){}lastSent=''},
  async enable(ctx){
   try{await root.CasaPush.enable({publicKey:VAPID_PUBLIC,register:sub=>post('/subscribe',{sub,items:build(ctx),...meta(ctx)})})}
   catch(e){if(e&&e.pending){localStorage.setItem(LSK,'1');localStorage.setItem(pendKey,'1');lastSent='';return {pending:true}}throw e}
   localStorage.setItem(LSK,'1');localStorage.removeItem(pendKey);lastSent='';return {pending:false};
  },
  // ¿Falta completar el alta en el servicio? (se reintenta sola)
  pending(){try{return localStorage.getItem(pendKey)==='1'}catch(e){return false}},
  async disable(){await root.CasaPush.disable(sub=>post('/unsubscribe',{endpoint:sub.endpoint})).catch(()=>{});try{localStorage.removeItem(LSK)}catch(e){}},
  // Avisos para una persona (o las dos): a una hora, «Mari dice…» o el fin de un temporizador
  send(ctx,o){if(!ctx.houseKey)return Promise.reject(Error('Activa los avisos en algún móvil primero.'));return post('/send',{houseKey:ctx.houseKey,...o})},
  // Qué personas de la casa tienen los avisos activados ({yo:1, juanma:1})
  status(ctx){if(!ctx.houseKey)return Promise.resolve({people:{}});return post('/status',{houseKey:ctx.houseKey}).catch(()=>({people:{}}))},
  cancel(ctx,id){if(!ctx.houseKey)return Promise.resolve();return post('/cancel',{houseKey:ctx.houseKey,id}).catch(()=>{})},
  async test(){const sub=await subscription();if(!sub)throw Error('Activa primero los avisos en este móvil.');const r=await post('/test',{endpoint:sub.endpoint});if(!r.ok)throw Error('El servicio de avisos no ha podido llegar a este móvil.');},
  // Al abrir Casa: volver a dar de alta este móvil en el servicio (por si se perdió) y subir sus avisos
  heal(ctxFn){if(!on()||api._healed)return;api._healed=true;setTimeout(()=>{sync(ctxFn(),true).catch(e=>console.warn('avisos',e))},3000);
   // Si el alta quedó pendiente (sin conexión con el servicio), se reintenta cada 2 minutos mientras Casa esté abierta
   setInterval(()=>{if(on()&&api.pending())sync(ctxFn(),true).catch(()=>{})},120000)},
  // Se llama al pintar la app: sube los avisos un rato después del último cambio
  schedule(ctxFn){if(!on())return;clearTimeout(timer);timer=setTimeout(()=>{sync(ctxFn()).catch(e=>console.warn('avisos',e))},8000)},
 };
 root.CasaAvisos=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
