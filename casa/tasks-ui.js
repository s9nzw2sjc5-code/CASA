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
const taskNorm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
function taskZone(t){
 const item=t&&t.plan==='casa'&&t.planKey&&CasaHousePlan.ITEMS.find(i=>i.key===String(t.planKey).split(':')[0]);
 if(item){const z=TASK_ZONES.find(z=>z.plan.includes(item.zone));if(z)return z}
 const title=taskNorm(t&&t.title);
 return TASK_ZONES.find(z=>z.re&&z.re.test(title))||TASK_ZONES[TASK_ZONES.length-1];
}
const taskDoneDay=t=>t.done?t.doneAt:t.lastDone;
const taskWeekday=d=>(new Date(d+'T12:00:00').getDay()+6)%7;
function taskWeek(){const t=today(),start=addDays(t,-taskWeekday(t));return{t,start,end:addDays(start,6)}}
const taskMine=()=>S.tasks.filter(forPerson);
const plural=(n,a,b)=>n+' '+(n===1?a:b);
const progressBar=(done,total,label)=>`<div class="tz-bar" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><span style="width:${total?Math.round(done/total*100):100}%"></span></div>`;

// Fila con casilla: hecha, por hacer o solo informativa (lo repetido ya hecho no se desmarca desde aquí)
function tzRow(t,{done=false,showDate=false}={}){
 const z=taskZone(t),min=CasaHousePlan.minutesFor(t),late=!done&&t.date&&t.date<today(),canToggle=done?!!t.done:true,p=person(t.who);
 const meta=[t.urgent&&!done?'<span class="urgent-tag" title="Urgente">❗</span>':'',`<span>${esc(z.name)}</span>`,min?`<span class="tz-min">${min} min</span>`:'',
  late?`<span class="late">Atrasada · ${esc(relDate(t.date))}</span>`:showDate&&t.date&&!done?`<span>${esc(relDate(t.date))}</span>`:'',
  done?`<span>Hecha ${taskDoneDay(t)===today()?'hoy':esc(relDate(taskDoneDay(t)).toLowerCase())}</span>`:'',
  ui.personFilter==='all'&&p?`<span class="who">${esc(p.name)}</span>`:''].filter(Boolean).join('<i aria-hidden="true">·</i>');
 const check=`<button class="check round ${done?'on':''}" ${canToggle?`data-act="toggleTask" data-id="${esc(t.id)}" aria-label="${esc((done?'Desmarcar ':'Completar ')+t.title)}"`:`disabled aria-label="Hecha"`}></button>`;
 return`<li class="row tz-row ${done?'is-done':''} ${t.urgent&&!done?'is-urgent':''}">${check}<button class="tz-main" data-act="editTask" data-id="${esc(t.id)}"><span class="tz-title">${esc(t.title)}</span><span class="tz-meta">${meta}</span></button><span class="tz-go" aria-hidden="true">›</span></li>`;
}
const tzList=rows=>`<ul class="list tz-list">${rows.join('')}</ul>`;
const organizeButton=()=>`<button class="tz-organize" data-act="taskOrganize"><span>Organizar limpieza</span><span aria-hidden="true">›</span></button>`;
const personNote=()=>ui.personFilter==='all'?'':`<p class="hint tz-person">Viendo solo lo de ${esc((person(ui.personFilter)||{name:'Conjunto'}).name)} · <button class="link" data-act="pFilter" data-v="all">Ver de todos</button></p>`;

// 1 · Qué toca: lo de hoy y lo atrasado, con lo hecho hoy plegado
function vTasksToday(){
 const t=today(),mine=taskMine(),due=mine.filter(x=>!x.done&&x.date&&x.date<=t).sort(byDateTime),doneToday=mine.filter(x=>taskDoneDay(x)===t);
 const urgentFirst=due.filter(x=>x.urgent).concat(due.filter(x=>!x.urgent));
 let h=personNote()+`<p class="tz-count">${plural(due.length,'pendiente','pendientes')} · ${plural(doneToday.length,'hecha','hechas')}</p>${progressBar(doneToday.length,due.length+doneToday.length,'Hecho hoy')}`;
 h+=`<h2>Para hoy</h2>`;
 if(urgentFirst.length)h+=tzList(urgentFirst.map(x=>tzRow(x)));
 else{const next=mine.filter(x=>!x.done&&x.date>t).sort(byDateTime)[0];h+=`<div class="empty tz-empty">Nada pendiente para hoy 🎉${next?`<br><small>Lo próximo: ${esc(next.title)} · ${esc(relDate(next.date).toLowerCase())}</small>`:''}</div>`}
 if(doneToday.length)h+=`<details class="tz-done"${ui.tzDoneOpen?' open':''}><summary data-act="tzDoneToggle">Hechas hoy · ${doneToday.length}</summary>${tzList(doneToday.map(x=>tzRow(x,{done:true})))}</details>`;
 return h+houseWxCard()+organizeButton();
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
 let h=personNote()+`<p class="tz-count">Toda la casa, de un vistazo · esta semana</p>`;
 if(!stats.length)h+=`<div class="empty tz-empty">Todavía no hay tareas. Crea el plan de limpieza desde «Organizar limpieza».</div>`;
 h+=`<div class="tz-zones">${stats.map(s=>{const p=s.pending.length,d=s.done.length,status=p?`${plural(p,'pendiente','pendientes')}${d?' · '+plural(d,'hecha','hechas'):''}`:d?'Al día':'Nada esta semana';
  return`<button class="tz-zone" data-act="taskZone" data-v="${s.zone.id}"><span class="tz-ic" aria-hidden="true">${s.zone.icon}</span><span class="tz-zbody"><b>${esc(s.zone.name)}</b><small>${status}</small>${p||d?progressBar(d,p+d,s.zone.name):''}</span><span class="tz-go" aria-hidden="true">›</span></button>`}).join('')}</div>`;
 const soon=taskMine().filter(x=>!x.done&&x.date>t&&x.date<=addDays(end,7)).sort(byDateTime).slice(0,4);
 if(soon.length)h+=`<h2>Próximamente</h2><div class="tz-soon">${soon.map(x=>`<button class="tz-soon-row" data-act="editTask" data-id="${esc(x.id)}"><span aria-hidden="true">${taskZone(x).icon}</span><span><b>${esc(x.title)}</b> · ${esc(relDate(x.date))}</span><span class="tz-go" aria-hidden="true">›</span></button>`).join('')}</div>`;
 return h+organizeButton();
}
// 3 · Una zona, como una rutina: lo de esta semana, lo que viene y «Continuar otro día»
function vTaskZonePage(id){
 const s=zoneStats().find(s=>s.zone.id===id),z=TASK_ZONES.find(z=>z.id===id);
 if(!z){ui.taskZone=null;return vTareas()}
 const pend=(s?s.pending:[]).sort(byDateTime),done=(s?s.done:[]),later=(s?s.later:[]).sort(byDateTime),total=pend.length+done.length,t=today();
 const canWait=pend.some(x=>x.date<=t&&!x.urgent);
 let h=`<div class="tz-page"><button class="tz-back" data-act="taskZone" data-v=""><span aria-hidden="true">←</span> Tareas</button>
  <h1 class="tz-ptitle"><span aria-hidden="true">${z.icon}</span> ${esc(z.name)}</h1><p class="tz-count">Esta semana · ${done.length} de ${total} hechas</p>${progressBar(done.length,total,z.name)}`;
 h+=total?tzList([...pend.map(x=>tzRow(x,{showDate:true})),...done.map(x=>tzRow(x,{done:true}))]):`<div class="empty tz-empty">Nada para esta semana en ${esc(z.name.toLowerCase())}.</div>`;
 if(later.length)h+=`<h2>Más adelante</h2>`+tzList(later.slice(0,6).map(x=>tzRow(x,{showDate:true})));
 h+=`<p class="hint tz-center">Puedes parar y continuar después.</p><button class="btn sec tz-wide" data-act="taskZoneLater" data-v="${z.id}"${canWait?'':' disabled'}>Continuar otro día</button>`;
 h+=z.id==='otras'?'':`<button class="link tz-center tz-edit" data-act="housePlan">Editar el plan de limpieza</button>`;
 return h+'</div>';
}
// Pantalla de Tareas: pestañas arriba y su contenido (la vista completa de antes queda en «Todas»)
function vTareas(){
 if(ui.taskMode==='routines')return vCleaning();
 if(reorgSel!==null)return vTareasAll();
 if(ui.taskZone)return vTaskZonePage(ui.taskZone);
 const view=['hoy','zonas','todas'].includes(ui.taskView)?ui.taskView:'hoy';
 const head=`<h1>Tareas</h1><p class="sub">Paso a paso, a tu ritmo</p><div class="tz-seg" role="tablist">${[['hoy','Para hoy'],['zonas','Por zonas'],['todas','Todas']].map(([k,l])=>`<button role="tab" aria-selected="${view===k}" class="${view===k?'on':''}" data-act="taskView" data-v="${k}">${l}</button>`).join('')}</div>`;
 if(view==='todas')return head+vTareasAll(true);
 return head+(view==='zonas'?vTasksZones():vTasksToday());
}
// «Organizar limpieza»: todo lo que había arriba de Tareas, reunido en un sitio
function taskOrganizeSheet(){
 const opts=[['reorg','↕','Reorganizar pendientes','Mover varias a la vez o «Estoy fuera»'],['plan','🧽','Plan de limpieza','Zonas, días y unir tus tareas'],['routines','🧹','Limpieza por frecuencia','Diarias, semanales, por estación y tus rutinas'],['tips','💡','Consejos de limpieza','Cómo hacer cada tarea'],['people','👥','Personas','Quién hace cada cosa']];
 const ov=sheet('Organizar limpieza',`<div class="tz-org">${opts.map(([k,i,t,d])=>`<button type="button" data-org="${k}"><span aria-hidden="true">${i}</span><span><b>${t}</b><small>${d}</small></span><span aria-hidden="true">›</span></button>`).join('')}</div>`,{autoFocus:false});
 ov.querySelector('[data-s=ok]')?.remove();ov.querySelector('[data-s=cancel]').textContent='Cerrar';
 ov.addEventListener('click',e=>{const b=e.target.closest('[data-org]');if(!b)return;ov.remove();const k=b.dataset.org;
  if(k==='reorg'){ui.taskZone=null;reorgSel=new Set();render();$('#app').scrollTop=0}
  else if(k==='plan')ACT.housePlan();else if(k==='routines')ACT.taskMode({v:'routines'});else if(k==='tips')ACT.tipsLibrary();else if(k==='people')ACT.people()});
 return ov;
}
const TASKS_ACT={
 taskView:d=>{ui.taskView=d.v;ui.taskZone=null;render();$('#app').scrollTop=0},
 taskZone:d=>{ui.taskZone=d.v||null;render();$('#app').scrollTop=0},
 taskOrganize:()=>taskOrganizeSheet(),
 tzDoneToggle:()=>{ui.tzDoneOpen=!ui.tzDoneOpen},
 // Lo de hoy y atrasado de esta zona pasa a mañana (las urgentes ❗ no se posponen); se puede deshacer
 taskZoneLater:d=>{const t=today(),ids=taskMine().filter(x=>!x.done&&x.date&&x.date<=t&&taskZone(x).id===d.v).map(x=>x.id);if(!ids.length)return;const was=reorgSel;moveTasks(ids,addDays(t,1));if(was===null&&reorgSel!==null){reorgSel=null;render()}},
};
