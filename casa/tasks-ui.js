/* Tareas con el diseño «Qué toca · Por zonas · Todas»: las mismas tareas de siempre, más fáciles de encontrar.
   Nada se guarda aparte: solo cambia cómo se enseñan. «Todas» es la vista completa de antes. */
'use strict';
// Zonas agrupadas como en casa (las del plan de limpieza) y, para las tareas propias, por su título
const TASK_ZONES=[
 {id:'banos',icon:'🛁',name:'Baños',plan:['banoPrincipal','banoInvitados','aseo'],re:/\b(bano|banos|aseo|inodoro|ducha|lavabo|mampara|espejo|vater|water)\b/},
 {id:'cocina',icon:'🍳',name:'Cocina',plan:['cocina'],re:/\b(cocina|nevera|frigorifico|horno|microondas|campana|vitro|vitroceramica|fregadero|lavavajillas|encimera)\b/},
 {id:'salon',icon:'🛋️',name:'Salón y entrada',plan:['salon','estarSotano','entrada'],re:/\b(salon|sofa|recibidor|entrada|sotano)\b/},
 {id:'dormitorios',icon:'🛏️',name:'Dormitorios',plan:['dormitorio','invitados'],re:/\b(dormitorio|habitacion|sabanas|cama|colchon|colchones|invitados)\b/},
 {id:'colada',icon:'🧺',name:'Colada',plan:['ropa','lavadero','secadora'],re:/\b(ropa|lavadora|lavadoras|colada|tender|doblar|plancha|planchar|secadora|lavadero)\b/},
 {id:'ventanas',icon:'🪟',name:'Ventanas y persianas',plan:['ventanas'],re:/\b(ventana|ventanas|cristal|cristales|persiana|persianas|cortina|cortinas|rieles)\b/},
 {id:'exterior',icon:'🌿',name:'Patio y terraza',plan:['patio','terraza'],re:/\b(patio|terraza|plantas|jardin|regar|canaletas)\b/},
 {id:'estancias',icon:'🧰',name:'Escaleras, garaje y almacén',plan:['escaleras','garaje','almacen','taller','gimnasio'],re:/\b(escalera|escaleras|garaje|almacen|taller|gimnasio|trastero)\b/},
 {id:'ringo',icon:'🐶',name:'Ringo',plan:['mascota'],re:/\b(ringo|fuente|perro|pienso)\b/},
 {id:'casa',icon:'🏠',name:'Toda la casa',plan:['radiadores','aire','chimenea',null],re:/\b(radiador|radiadores|caldera|aire acondicionado|chimenea|polvo|aspirar|fregar|barrer|limpiar|limpieza|humedad|humedades|interruptores|zocalos|lamparas)\b/},
 {id:'otras',icon:'📋',name:'Otras tareas',plan:[],re:null},
];
// Iconos de línea para las zonas (como en la maqueta); heredan el color del texto
const TZ_SVG={
 banos:'<path d="M4 12h16v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M6 12V6a2 2 0 0 1 4 0"/><path d="M8 19l-1 2M16 19l1 2"/>',
 cocina:'<path d="M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M2 10h2M20 10h2M9 6c0-1 1-1 1-2M13 6c0-1 1-1 1-2"/>',
 salon:'<path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/><path d="M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v4H3z"/><path d="M5 17v2M19 17v2"/>',
 dormitorios:'<path d="M3 18V7M3 14h18v4M21 18v-4a3 3 0 0 0-3-3h-7v3"/><circle cx="7" cy="11" r="1.6"/>',
 colada:'<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="13" r="4"/><path d="M8 6.5h.01M11 6.5h4"/>',
 ventanas:'<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M12 4v16M4 12h16"/>',
 exterior:'<path d="M12 21v-8"/><path d="M12 13c-4 0-6-3-6-7 4 0 6 3 6 7z"/><path d="M12 13c4 0 6-3 6-7-4 0-6 3-6 7z"/><path d="M7 21h10"/>',
 estancias:'<path d="M4 20h4v-4h4v-4h4V8h4"/><path d="M4 20h16"/>',
 ringo:'<circle cx="7" cy="9" r="1.6"/><circle cx="17" cy="9" r="1.6"/><circle cx="10" cy="5.5" r="1.6"/><circle cx="14" cy="5.5" r="1.6"/><path d="M12 12c-3 0-5 3-5 5a2 2 0 0 0 3 2h4a2 2 0 0 0 3-2c0-2-2-5-5-5z"/>',
 casa:'<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
 otras:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',
};
const tzIcon=id=>`<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TZ_SVG[id]||TZ_SVG.otras}</svg>`;
const taskNorm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
function taskZone(t){
 // Zona elegida a mano en la ficha («Vincular a»): manda sobre la automática
 if(t&&t.tzZone){const z=TASK_ZONES.find(z=>z.id===t.tzZone);if(z)return z}
 const item=t&&t.plan==='casa'&&t.planKey&&CasaHousePlan.ITEMS.find(i=>i.key===String(t.planKey).split(':')[0]);
 if(item){const z=TASK_ZONES.find(z=>z.plan.includes(item.zone));if(z)return z}
 const title=taskNorm(t&&t.title);
 return TASK_ZONES.find(z=>z.re&&z.re.test(title))||TASK_ZONES[TASK_ZONES.length-1];
}
// Solo fechas «AAAA-MM-DD» válidas: lo guardado en otros formatos (versiones antiguas) cuenta como sin fecha
const tzDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d+'T12:00:00Z'))?d:'';
const taskDoneDay=t=>tzDate(t.done?t.doneAt:t.lastDone);
const taskWeekday=d=>(new Date(d+'T12:00:00').getDay()+6)%7;
function taskWeek(){const t=today(),start=addDays(t,-taskWeekday(t));return{t,start,end:addDays(start,6)}}
const taskMine=()=>(S.tasks||[]).filter(x=>x&&forPerson(x)).map(x=>x.date&&!tzDate(x.date)?{...x,date:''}:x);
// «Mañana», «Sábado»… para lo de esta semana y la próxima; si no, la fecha
const tzDay=d=>{const n=Math.round((new Date(d+'T12:00:00')-new Date(today()+'T12:00:00'))/864e5);if(n===0)return'Hoy';if(n===1)return'Mañana';if(n>1&&n<7){const w=new Date(d+'T12:00:00').toLocaleDateString('es-ES',{weekday:'long'});return w.charAt(0).toUpperCase()+w.slice(1)}return relDate(d)};
// ¿Llueve hoy según la última previsión guardada?
const tzWetToday=()=>{try{const pl=houseWxPlace(),c=pl&&houseWxFor(pl),d=c&&c.days.find(d=>d.date===today());return !!(d&&CasaHousePlan.isWet(d))}catch(e){return false}};
const plural=(n,a,b)=>n+' '+(n===1?a:b);
const progressBar=(done,total,label)=>`<div class="tz-bar" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><span style="width:${total?Math.round(done/total*100):100}%"></span></div>`;

// Fila con casilla: hecha, por hacer o solo informativa (lo repetido ya hecho no se desmarca desde aquí)
function tzRow(t,{done=false,showDate=false,simple=false}={}){
 const z=taskZone(t),min=CasaHousePlan.minutesFor(t),late=!done&&t.date&&t.date<today(),canToggle=done?canUndoDone(t):true;
 const wet=!done&&!t.urgent&&t.date&&t.date<=today()&&CasaHousePlan.isOutdoor(t)&&tzWetToday();
 const meta=[t.urgent&&!done?'<span class="urgent-tag" title="Urgente">❗</span>':'',wet?'<span class="tz-wet">🌧️ mejor en día seco</span>':'',`<span>${esc(z.name)}</span>`,min?`<span class="tz-min">${min} min</span>`:'',
  late?`<span class="late">Atrasada · ${esc(relDate(t.date))}</span>`:showDate&&t.date&&!done?`<span>${esc(relDate(t.date))}</span>`:'',
  done?`<span>Hecha ${taskDoneDay(t)===today()?'hoy':esc(relDate(taskDoneDay(t)).toLowerCase())}</span>`:'',
  ].filter(Boolean).join('<i aria-hidden="true">·</i>');
 const check=`<button class="check round ${done?'on':''}" ${canToggle?`data-act="${done&&!t.done?'undoDone':'toggleTask'}" data-id="${esc(t.id)}" aria-label="${esc((done?'Desmarcar ':'Completar ')+t.title)}"`:`disabled aria-label="Hecha"`}></button>`;
 return`<li class="row tz-row ${done?'is-done':''} ${t.urgent&&!done?'is-urgent':''}">${check}<button class="tz-main" data-act="editTask" data-id="${esc(t.id)}"><span class="tz-title">${esc(t.title)}</span>${simple&&!(t.urgent&&!done)&&!late?'':`<span class="tz-meta">${meta}</span>`}</button><span class="tz-go" aria-hidden="true">›</span></li>`;
}
const tzList=rows=>`<ul class="list tz-list">${rows.join('')}</ul>`;
const organizeButton=()=>`<button class="tz-organize" data-act="taskOrganize"><span>Organizar limpieza</span><span aria-hidden="true">›</span></button>`;
const personNote=()=>ui.personFilter==='all'?'':`<p class="hint tz-person">Viendo solo lo de ${esc((person(ui.personFilter)||{name:'Conjunto'}).name)} · <button class="link" data-act="pFilter" data-v="all">Ver de todos</button></p>`;

// 1 · Qué toca: lo de hoy y lo atrasado, con lo hecho hoy plegado
function vTasksToday(){
 const t=today(),mine=taskMine(),due=mine.filter(x=>!x.done&&x.date&&x.date<=t).sort(byDateTime),doneToday=mine.filter(x=>taskDoneDay(x)===t);
 const urgentFirst=due.filter(x=>x.urgent).concat(due.filter(x=>!x.urgent));
 let h=personNote()+`<p class="tz-count">${plural(due.length,'pendiente','pendientes')} · ${plural(doneToday.length,'hecha','hechas')}</p>${progressBar(doneToday.length,due.length+doneToday.length,'Hecho hoy')}`;
 if(due.filter(x=>!x.urgent).length>=4||due.some(x=>x.date<t&&!x.urgent))h+=`<button class="btn sec tz-prio" data-act="taskPriority">⚡ Reorganizar por prioridad</button>`;
 h+=`<h2 class="tz-h2">Para hoy</h2>`;
 if(urgentFirst.length)h+=tzList(urgentFirst.map(x=>tzRow(x)));
 else{const next=mine.filter(x=>!x.done&&x.date>t).sort(byDateTime)[0];h+=`<div class="empty tz-empty">Nada pendiente para hoy 🎉${next?`<br><small>Lo próximo: ${esc(next.title)} · ${esc(relDate(next.date).toLowerCase())}</small>`:''}</div>`}
 if(doneToday.length)h+=`<details class="tz-done"${ui.tzDoneOpen?' open':''}><summary data-act="tzDoneToggle"><span>Hechas hoy · ${doneToday.length}</span><span class="tz-caret" aria-hidden="true">⌄</span></summary>${tzList(doneToday.map(x=>tzRow(x,{done:true})))}</details>`;
 return h+organizeButton();
}
// Estado de cada zona en esta semana (de lunes a domingo; lo atrasado cuenta como pendiente)
function zoneStats(){
 const {t,start,end}=taskWeek(),by=new Map(TASK_ZONES.map(z=>[z.id,{zone:z,pending:[],done:[],later:[]}]));
 for(const x of taskMine()){
  const s=by.get(taskZone(x).id),d=taskDoneDay(x);
  if(d&&d>=start&&d<=t)s.done.push(x);
  if(x.done)continue;
  if(x.date&&x.date<=end)s.pending.push(x);else if(x.date)s.later.push(x);
 }
 return [...by.values()].filter(s=>s.pending.length||s.done.length||s.later.length);
}
// 2 · Por zonas: toda la casa de un vistazo
function vTasksZones(){
 const stats=zoneStats(),t=today(),{end}=taskWeek();
 let h=personNote()+`<p class="tz-count">Toda la casa, de un vistazo</p>`;
 if(!stats.length)h+=`<div class="empty tz-empty">Todavía no hay tareas. Crea el plan de limpieza desde «Organizar limpieza».</div>`;
 h+=`<div class="tz-zones">${stats.map(s=>{const p=s.pending.length,d=s.done.length,status=p?`${plural(p,'pendiente','pendientes')}${d?' · '+plural(d,'hecha','hechas'):''}`:d?'Al día':'Nada esta semana';
  return`<button class="tz-zone" data-act="taskZone" data-v="${s.zone.id}"><span class="tz-ic">${tzIcon(s.zone.id)}</span><span class="tz-zbody"><b>${esc(s.zone.name)}</b><small>${status}</small>${p||d?progressBar(d,p+d,s.zone.name):''}</span><span class="tz-go" aria-hidden="true">›</span></button>`}).join('')}</div>`;
 const soon=taskMine().filter(x=>!x.done&&x.date>t&&x.date<=addDays(end,7)).sort(byDateTime).slice(0,4);
 if(soon.length)h+=`<h2 class="tz-h2">Próximamente</h2><div class="tz-soon">${soon.map(x=>`<button class="tz-soon-row" data-act="editTask" data-id="${esc(x.id)}"><span class="tz-ic sm">${tzIcon(taskZone(x).id)}</span><span><b>${esc(x.title)}</b> · ${esc(tzDay(x.date))}</span><span class="tz-go" aria-hidden="true">›</span></button>`).join('')}</div>`;
 return h+organizeButton();
}
// 3 · Una zona, como una rutina: lo de esta semana, lo que viene y «Continuar otro día»
function vTaskZonePage(id){
 const s=zoneStats().find(s=>s.zone.id===id),z=TASK_ZONES.find(z=>z.id===id);
 if(!z){ui.taskZone=null;return vTareas()}
 const pend=(s?s.pending:[]).sort(byDateTime),done=(s?s.done:[]),doneIds=new Set(done.map(x=>x.id)),later=(s?s.later:[]).filter(x=>!doneIds.has(x.id)).sort(byDateTime),total=pend.length+done.length,t=today();
 const canWait=pend.some(x=>x.date<=t&&!x.urgent);
 let h=`<div class="tz-page"><button class="tz-back" data-act="taskZone" data-v=""><span aria-hidden="true">←</span> Limpieza</button>
  <h1 class="tz-ptitle">${esc(z.name)}</h1><p class="tz-count">Esta semana · ${done.length} de ${total} hechas</p>${progressBar(done.length,total,z.name)}`;
 h+=total?tzList([...pend.map(x=>tzRow(x,{simple:true})),...done.map(x=>tzRow(x,{done:true,simple:true}))]):`<div class="empty tz-empty">Nada para esta semana en ${esc(z.name.toLowerCase())}.</div>`;
 if(later.length)h+=`<h2 class="tz-h2">Más adelante</h2>`+tzList(later.slice(0,6).map(x=>tzRow(x,{showDate:true})));
 h+=`<p class="hint tz-center">Puedes parar y continuar después.</p><button class="btn sec tz-wide" data-act="taskZoneLater" data-v="${z.id}"${canWait?'':' disabled'}>Continuar otro día</button>`;
 h+=z.id==='otras'?'':`<button class="link tz-center tz-edit" data-act="housePlan">Editar rutina</button>`;
 return h+'</div>';
}
// Pantalla de Tareas: pestañas arriba y su contenido (la vista completa de antes queda en «Todas»)
function vTareas(){
 // Rutinas y Reorganizar: si fallaran, se vuelve a la vista nueva en lugar de dejar la pestaña sin abrir
 if(ui.taskMode==='routines'||reorgSel!==null){
  try{return ui.taskMode==='routines'?vCleaning():vTareasAll()}catch(e){console.error(e);ui.taskMode='tasks';reorgSel=null;taskErrorNote=String(e&&e.message||e)}
 }
 // Si algo de la vista nueva fallara con los datos de casa, Tareas sigue funcionando con la vista completa de siempre
 try{const h=vTareasNew();if(taskErrorNote){const n=taskErrorNote;taskErrorNote='';return h.replace('<div class="tz-seg"',`<p class="hint tz-error">No se ha podido abrir esa parte de Tareas. Detalle: ${esc(n.slice(0,140))}</p><div class="tz-seg"`)}return h}
 catch(e){console.error(e);ui.taskZone=null;try{return`<h1>Limpieza</h1><p class="sub">Paso a paso, a tu ritmo</p><p class="hint tz-error">No se ha podido mostrar «${esc(ui.taskView==='zonas'?'Por zonas':'Para hoy')}». Te enseño todas las tareas. Detalle: ${esc(String(e&&e.message||e).slice(0,140))}</p>`+vTareasAll(true)}catch(e2){console.error(e2);return`<h1>Limpieza</h1><p class="hint tz-error">No se pueden mostrar las tareas. Detalle: ${esc(String(e2&&e2.message||e2).slice(0,140))}</p>`}}
}
let taskErrorNote='';
function vTareasNew(){
 if(ui.taskZone)return vTaskZonePage(ui.taskZone);
 const view=['hoy','zonas','todas'].includes(ui.taskView)?ui.taskView:'hoy';
 // Los consejos según el tiempo (no tender ni barrer fuera si llueve, calefacción, radiadores…), justo debajo del título
 const head=`<h1>Limpieza</h1><p class="sub">Paso a paso, a tu ritmo</p>${houseWxCard('tips')}<div class="tz-seg" role="tablist">${[['hoy','Para hoy'],['zonas','Por zonas'],['todas','Todas']].map(([k,l])=>`<button role="tab" aria-selected="${view===k}" class="${view===k?'on':''}" data-act="taskView" data-v="${k}">${l}</button>`).join('')}</div>`;
 if(view==='todas')return head+vTareasAll(true);
 return head+(view==='zonas'?vTasksZones():vTasksToday());
}
// «Organizar limpieza»: todo lo que había arriba de Tareas, reunido en un sitio
function taskOrganizeSheet(){
 const opts=[['prio','⚡','Reorganizar por prioridad','Repartir lo acumulado en los próximos días'],['reorg','↕','Reorganizar pendientes','Mover varias a la vez o «Estoy fuera»'],['plan','🧽','Plan de limpieza','Zonas, días y unir tus tareas'],['routines','🧹','Limpieza por frecuencia','Diarias, semanales, por estación y tus rutinas'],['tips','💡','Consejos de limpieza','Cómo hacer cada tarea'],['people','👥','Personas','Quién hace cada cosa']];
 const ov=sheet('Organizar limpieza',`<div class="tz-org">${opts.map(([k,i,t,d])=>`<button type="button" data-org="${k}"><span aria-hidden="true">${i}</span><span><b>${t}</b><small>${d}</small></span><span aria-hidden="true">›</span></button>`).join('')}</div>`,{autoFocus:false});
 ov.querySelector('[data-s=ok]')?.remove();ov.querySelector('[data-s=cancel]').textContent='Cerrar';
 ov.addEventListener('click',e=>{const b=e.target.closest('[data-org]');if(!b)return;ov.remove();const k=b.dataset.org;
  if(k==='prio')taskPrioritySheet();
  else if(k==='reorg'){ui.taskZone=null;reorgSel=new Set();render();$('#app').scrollTop=0}
  else if(k==='plan')ACT.housePlan();else if(k==='routines')ACT.taskMode({v:'routines'});else if(k==='tips')ACT.tipsLibrary();else if(k==='people')ACT.people()});
 return ov;
}
const TASKS_ACT={
 taskView:d=>{ui.taskView=d.v;ui.taskZone=null;render();$('#app').scrollTop=0},
 taskZone:d=>{ui.taskZone=d.v||null;render();$('#app').scrollTop=0},
 taskOrganize:()=>taskOrganizeSheet(),
 taskPriority:()=>taskPrioritySheet(),
 tzDoneToggle:()=>{ui.tzDoneOpen=!ui.tzDoneOpen},
 // Lo de hoy y atrasado de esta zona pasa a mañana (las urgentes ❗ no se posponen); se puede deshacer
 taskZoneLater:d=>{const t=today(),ids=taskMine().filter(x=>!x.done&&x.date&&x.date<=t&&taskZone(x).id===d.v).map(x=>x.id);if(!ids.length)return;const was=reorgSel;moveTasks(ids,addDays(t,1));if(was===null&&reorgSel!==null){reorgSel=null;render()}},
};
// «Más opciones» de Todas se queda abierto o cerrado al volver a pintar la pantalla
document.addEventListener('toggle',e=>{if(e.target.matches&&e.target.matches('details.task-options'))ui.taskOptsOpen=e.target.open},true);

// Fechas de tareas guardadas como número (versiones antiguas): se pasan a «AAAA-MM-DD», con copia antes.
// Sin esto, ordenar por fecha fallaba y la pestaña Tareas no se abría.
function taskDatesRepair(){
 if(taskDatesRepair.busy||(typeof canWrite!=='undefined'&&!canWrite)||syncState==='ro')return false;
 const fix=v=>{if(v==null||v===''||typeof v==='string')return undefined;if(typeof v==='number'&&v>1e11&&v<1e14){const d=new Date(v);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}return ''};
 const changes=[];for(const t of S.tasks||[])for(const k of ['date','doneAt','lastDone','time']){const v=k==='time'?(t.time==null||typeof t.time==='string'?undefined:''):fix(t[k]);if(v!==undefined)changes.push([t,k,v])}
 if(!changes.length)return false;
 taskDatesRepair.busy=true;
 try{const id='antes-de-arreglar-fechas-'+Date.now(),before=clone(S);saveLocalBackup(id,before,'Antes de arreglar fechas de tareas');cloudBackup(id,before,'Antes de arreglar fechas de tareas');
  for(const [t,k,v] of changes)t[k]=v;save();
  const n=new Set(changes.map(c=>c[0].id)).size;setTimeout(()=>toast(`Arregladas las fechas antiguas de ${n} tarea${n===1?'':'s'} (hay copia de seguridad)`),0);return true}
 finally{taskDatesRepair.busy=false}
}

/* ---------- Al añadir una tarea: ¿se parece a alguna que ya tienes? ---------- */
// Palabras que cuentan para comparar (sin artículos ni preposiciones); se compara por la raíz (5 primeras letras)
const TZ_STOP=new Set(['de','la','el','los','las','del','al','y','a','en','con','por','para','un','una','que','mi','tu','su','lo','le','se','o','todo','toda','todos','todas','hacer','poner','bien','muy','hoy','otra','otro']);
const tzWords=s=>taskNorm(s).split(/[^a-z0-9ñ]+/).filter(w=>w.length>=3&&!TZ_STOP.has(w)).map(w=>w.slice(0,5));
// Zona concreta de lo escrito (salón, baños, cocina, colada…); «Toda la casa» y «Otras» no cuentan como zona
const tzSpecificZone=t=>{const z=taskZone(t);return z.id==='otras'||z.id==='casa'?null:z.id};
// Parecidas: por palabras o, si lo escrito es de una zona, las tareas de esa misma zona
function taskSimilar(q,limit=5){
 const qw=new Set(tzWords(q));if(!qw.size)return[];
 const qz=tzSpecificZone({title:q});
 return (S.tasks||[]).filter(t=>t&&!t.done&&t.title).map(t=>{const tw=tzWords(t.title);const hits=tw.filter(w=>qw.has(w)).length;const words=hits/Math.max(1,Math.min(qw.size,tw.length));const zone=qz&&tzSpecificZone(t)===qz;return{t,hits,score:Math.max(words,zone?.5:0)}})
  .filter(x=>x.score>=.5).sort((a,b)=>b.hits-a.hits||b.score-a.score||String(a.t.date||'9').localeCompare(String(b.t.date||'9'))).slice(0,limit).map(x=>x.t);
}
// Rutinas de limpieza que encajan con lo escrito: por su nombre o porque tienen tareas de esa zona
function tzRoutinesFor(q){
 const qw=new Set(tzWords(q)),qz=tzSpecificZone({title:q});if(!qw.size)return[];
 return (S.routines||[]).filter(r=>r.linkedTasks&&!r.archived).map(r=>{const ts=(r.taskIds||[]).map(id=>find(S.tasks,id)).filter(Boolean);const byName=tzWords(r.title).some(w=>qw.has(w));const zoneN=qz?ts.filter(t=>tzSpecificZone(t)===qz).length:0;return{r,n:(byName?100:0)+zoneN}}).filter(x=>x.n>0).sort((a,b)=>b.n-a.n).slice(0,2).map(x=>x.r);
}
const tzRoutineOf=t=>(S.routines||[]).find(r=>r.linkedTasks&&!r.archived&&(r.taskIds||[]).includes(t.id));
// Marcar hecha hoy una tarea que estaba para otro día: queda en «Hechas hoy»; si se repite, la siguiente vez cuenta desde aquí
function taskDoneToday(id){
 const x=find(S.tasks,id);if(!x||x.done)return false;
 markTaskDone(x);
 save();toastUndo(`«${x.title}» hecha hoy${x.done?'':' · próxima: '+relDate(x.date).toLowerCase()}`,6000);return true;
}
// Añadir la tarea nueva a la rutina de la parecida (con su misma repetición, desde hoy)
function taskAddToRoutineId(title,routineId){
 const r=(S.routines||[]).find(x=>x.id===routineId&&x.linkedTasks&&!x.archived);if(!r)return false;
 const model=(r.taskIds||[]).map(id=>find(S.tasks,id)).find(t=>t&&!t.done&&t.repeat&&t.repeat!=='none');
 return taskAddToRoutine(title,null,r,model);
}
function taskAddToRoutine(title,similarId,rIn,modelIn){
 const sim=modelIn||find(S.tasks,similarId)||{repeat:'none'},r=rIn||(sim.id&&tzRoutineOf(sim));if(!r)return false;
 // Si ya hay una tarea pendiente con ese mismo nombre (fuera de rutinas), se usa esa en vez de crear otra igual
 const same=(S.tasks||[]).find(x=>!x.done&&taskNorm(x.title)===taskNorm(title)&&!tzRoutineOf(x));
 const rep=sim.repeat&&sim.repeat!=='none'?{repeat:sim.repeat,...(sim.repeat==='custom'?{every:sim.every,unit:sim.unit}:{})}:{};
 let nt,created=false,backup=null;
 if(same){backup={...same};nt=same;Object.assign(nt,{date:nt.date||today()},nt.repeat&&nt.repeat!=='none'?{}:rep)}
 else{nt={id:uid(),title,date:today(),who:'ambos',repeat:'none',notes:'',done:false,...rep};S.tasks.push(nt);created=true}
 try{const next=CasaCleaningLinks.link(S,r,r.id,r.title,[...r.taskIds,nt.id],Date.now());S.routines=S.routines.map(x=>x.id===r.id?next:x)}
 catch(e){if(created)S.tasks=S.tasks.filter(x=>x.id!==nt.id);else Object.keys(nt).forEach(k=>{if(!(k in backup))delete nt[k]}),Object.assign(nt,backup);toast(String(e.message||e));return false}
 save();toastUndo(`Añadida a la rutina «${r.title}»`,6000);return true;
}
function tzSuggestHtml(q,list,routines){
 return`<div class="tz-sug" role="listbox" aria-label="Tareas parecidas">${routines.length?`<p class="tz-sug-h">🧹 Rutinas de limpieza</p>${routines.map(r=>`<div class="tz-sug-row"><span class="tz-sug-t"><b>${esc(r.title)}</b><small>${(r.taskIds||[]).length} tareas</small></span><span class="tz-sug-b"><button type="button" class="btn sec" data-sug="toRoutine" data-id="${esc(r.id)}">+ Añadir a esta rutina</button></span></div>`).join('')}`:''}${list.length?'<p class="tz-sug-h">¿Es alguna de estas?</p>':''}${list.map(t=>{const r=tzRoutineOf(t),when=t.date?relDate(t.date)+(t.repeat&&t.repeat!=='none'?' · '+repLabel(t).toLowerCase():''):'Sin fecha';
  return`<div class="tz-sug-row"><span class="tz-sug-t"><b>${esc(t.title)}</b><small>${esc(when)}${r?' · rutina «'+esc(r.title)+'»':''}</small></span><span class="tz-sug-b">${t.date!==today()||t.repeat!=='none'?`<button type="button" class="btn sec" data-sug="done" data-id="${esc(t.id)}">✓ Hecha hoy</button>`:''}${r?`<button type="button" class="btn sec" data-sug="routine" data-id="${esc(t.id)}">+ A su rutina</button>`:''}</span></div>`}).join('')}
  <button type="button" class="tz-sug-apart" data-sug="apart">➕ Añadir «${esc(q)}» aparte</button></div>`;
}
// Cuadros donde se escribe una tarea nueva: Hoy (para hoy), Sin fecha y la ficha de tarea nueva
const TZ_ADD_INPUTS={qTask:{add:()=>quickTask()},qNoDate:{add:()=>quickNoDate()},f_t:{sheet:true}};
function tzSuggestFor(input){
 const cfg=TZ_ADD_INPUTS[input.id];if(!cfg)return;
 const ov=input.closest('.overlay');if(cfg.sheet&&!(ov&&ov.dataset.newTask))return;
 const anchor=cfg.sheet?input:(input.closest('.quick')||input);
 let box=anchor.nextElementSibling&&anchor.nextElementSibling.matches('.tz-sug-box')?anchor.nextElementSibling:null;
 const q=input.value.trim(),list=q.length>=3?taskSimilar(q):[],routines=q.length>=3?tzRoutinesFor(q):[];
 if(!list.length&&!routines.length){if(box)box.remove();return}
 if(!box){box=document.createElement('div');box.className='tz-sug-box';anchor.after(box);
  box.addEventListener('click',e=>{const b=e.target.closest('[data-sug]');if(!b)return;e.stopPropagation();const title=input.value.trim();let ok=false;
   if(b.dataset.sug==='done')ok=taskDoneToday(b.dataset.id);
   else if(b.dataset.sug==='routine')ok=title&&taskAddToRoutine(title,b.dataset.id);
   else if(b.dataset.sug==='toRoutine')ok=title&&taskAddToRoutineId(title,b.dataset.id);
   else{box.remove();if(cfg.add)cfg.add();return}
   if(ok){input.value='';box.remove();if(cfg.sheet&&ov)ov.remove()}})}
 box.innerHTML=tzSuggestHtml(q,list,routines);
}
document.addEventListener('input',e=>{if(e.target&&TZ_ADD_INPUTS[e.target.id])tzSuggestFor(e.target)});

// Desplegable «Vincular a» de la ficha: Automático (según el nombre) o una zona; la tarea entra en la rutina de esa zona (Por zonas)
function tzZoneSelectHtml(t){
 const auto=taskZone({...t,tzZone:''});
 return`<div class="ts-full"><label for="f_zone">Vincular a</label><select class="field" id="f_zone"><option value="">Automático · ${esc(auto.name)}</option>${TASK_ZONES.map(z=>`<option value="${z.id}" ${t.tzZone===z.id?'selected':''}>${z.icon} ${esc(z.name)}</option>`).join('')}</select></div>`;
}

/* ---------- Reorganizar por prioridad: repartir lo acumulado sin sobrecargar ningún día ---------- */
// Minutos por día: entre semana poco, el fin de semana más (como el plan de limpieza)
const PRIO_CAP=d=>{const w=taskWeekday(d);return w<5?50:w===5?90:120};
const prioMinutes=x=>CasaHousePlan.minutesFor(x)||(x&&x.mamaKey&&(CasaMama.ROUTINES.find(r=>r.key===x.mamaKey)||{}).min)||15;
const prioFreq=x=>x.repeat==='daily'?0:x.repeat==='weekly'?1:x.repeat==='custom'&&x.unit==='w'&&Number(x.every)<=2?2:x.repeat==='custom'&&x.unit==='d'?1:x.repeat&&x.repeat!=='none'?3:4;
function priorityPlan(){
 const t=today(),mine=taskMine(),movable=mine.filter(x=>!x.done&&x.date&&x.date<=t&&!x.urgent);
 // Orden: 📅 importantes, más atrasadas, más frecuentes, más cortas
 movable.sort((a,b)=>(isImportantTask(b)?1:0)-(isImportantTask(a)?1:0)||a.date.localeCompare(b.date)||prioFreq(a)-prioFreq(b)||prioMinutes(a)-prioMinutes(b)||String(a.title).localeCompare(String(b.title),'es'));
 const ids=new Set(movable.map(x=>x.id)),load={};
 // Lo que ya hay cada día (y lo urgente de hoy) ocupa su sitio
 for(const x of mine)if(!x.done&&x.date&&!ids.has(x.id)){const d=x.date<t?t:x.date;load[d]=(load[d]||0)+prioMinutes(x)}
 const plan=[];
 for(const x of movable){const m=prioMinutes(x);let d=t,guard=0;while((load[d]||0)>0&&(load[d]||0)+m>PRIO_CAP(d)&&guard++<60)d=addDays(d,1);load[d]=(load[d]||0)+m;plan.push({id:x.id,title:x.title,from:x.date,to:d,min:m,important:isImportantTask(x)})}
 return {plan,load};
}
function taskPrioritySheet(){
 const {plan,load}=priorityPlan(),t=today();
 if(!plan.length){toast('No hay tareas acumuladas que reorganizar');return}
 const days=[...new Set(plan.map(p=>p.to))].sort(),moved=plan.filter(p=>p.to!==p.from).length;
 const body=`<p class="hint">Lo importante y lo más atrasado, primero. Cada día, como mucho unos ${PRIO_CAP(t)} min entre semana y más el fin de semana. Las urgentes ❗ se quedan hoy.</p>
  <div class="prio-days">${days.map(d=>`<div class="prio-day"><h4>${esc(tzDay(d))} <small>· ${load[d]||0} min</small></h4><ul>${plan.filter(p=>p.to===d).map(p=>`<li>${p.important?'📅 ':''}${esc(p.title)} <small>${p.min} min${p.from<t?' · atrasada':''}</small></li>`).join('')}</ul></div>`).join('')}</div>`;
 const ov=sheet('⚡ Reorganizar por prioridad',body,{saveLabel:moved?`Aplicar (${moved})`:'Aplicar',autoFocus:false,onSave:()=>{
  const by=new Map(plan.map(p=>[p.id,p.to]));let n=0;
  for(const x of S.tasks)if(by.has(x.id)&&x.date!==by.get(x.id)){x.date=by.get(x.id);n++}
  (S.routines||[]).forEach(r=>{if(r.linkedTasks&&!r.archived&&(r.taskIds||[]).some(id=>by.has(id)))r.date=CasaCleaningLinks.effectiveDate(S,r)});
  save();toastUndo(n?`${n} ${n===1?'tarea reorganizada':'tareas reorganizadas'} por prioridad`:'Ya estaba todo en su sitio',7000);
 }});
 return ov;
}

/* ---------- Recordatorios de hoy (en Hoy): qué toca, en tono neutro ---------- */
function mamaCard(){
 let list=[];
 try{
  const place=houseWxPlace(),c=place&&houseWxFor(place);
  list=CasaMama.nudges({today:today(),hour:new Date().getHours(),tasks:taskMine(),
   pets:(S.pet||[]).map(x=>({name:x.name,due:petDue(x)})),
   listPending:(S.items||[]).filter(i=>!i.done&&i.listId===cartList()).length,
   lowPantry:typeof pantryLow==='function'?(S.pantry||[]).filter(pantryLow).length:0,
   forecast:c?c.days:[],isWash:CasaHousePlan.isWash,isWet:CasaHousePlan.isWet,isImportant:isImportantTask,minutes:prioMinutes,dayName:tzDay,
   hasRoutines:(S.tasks||[]).some(t=>t.mamaKey)||!!(S.cook&&S.cook.mamaNoRoutines)});
 }catch(e){console.error(e);return''}
 if(!list.length)return'';
 const btn=a=>!a?'':a.kind==='task'?`<button class="btn sec" data-act="toggleTask" data-id="${esc(a.id)}">✓ Hecho</button>`:a.kind==='priority'?`<button class="btn sec" data-act="taskPriority">⚡ Repartir por prioridad</button>`:a.kind==='routines'?`<button class="btn sec" data-act="mamaRoutines">Añadir rutina de mañana y noche</button>`:`<button class="btn sec" data-act="tab" data-v="${{tareas:'tareas',ringo:'ringo',importantes:'recordar',compras:'compras'}[a.kind]||'tareas'}">Ver</button>`;
 return`<details class="mama"${ui.mamaOpen===false?'':' open'}><summary><b>🔔 Recordatorios de hoy</b><span class="tz-caret" aria-hidden="true">⌄</span></summary><ul>${list.map(n=>`<li><span aria-hidden="true">${n.icon}</span><div><p>${esc(n.text)}</p>${btn(n.action)}</div></li>`).join('')}</ul></details>`;
}
// Rutina de mañana y noche: tareas diarias cortas (se pueden borrar o cambiar como cualquier tarea)
function mamaAddRoutines(){
 const have=new Set((S.tasks||[]).filter(t=>t.mamaKey).map(t=>t.mamaKey)),add=CasaMama.ROUTINES.filter(r=>!have.has(r.key));
 if(!add.length){toast('Ya tienes la rutina de mañana y noche');return}
 for(const r of add)S.tasks.push({id:uid(),title:r.title,date:today(),who:'ambos',repeat:r.repeat,...(r.every?{every:r.every,unit:r.unit}:{}),notes:'',done:false,mamaKey:r.key});
 save();toastUndo(`Añadida la rutina de mañana y noche (${add.length} tareas cortas)`,7000);
}
Object.assign(TASKS_ACT,{mamaRoutines:()=>mamaAddRoutines()});
document.addEventListener('toggle',e=>{if(e.target.matches&&e.target.matches('details.mama')){ui.mamaOpen=e.target.open;try{localStorage.setItem(LS+'-ui',JSON.stringify(ui))}catch(err){}}},true);
