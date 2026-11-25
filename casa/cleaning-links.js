/* Rutinas vinculadas a tareas reales: conserva IDs, fechas y responsables. */
(function(root){
 'use strict';
 const MAX=60; // tareas por rutina
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
 const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&Number.isFinite(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
 const repeated=t=>!!t.repeat&&t.repeat!=='none';
 const stamp=t=>t.lastDoneAt?'at:'+t.lastDoneAt:t.lastDone?'day:'+t.lastDone:'';
 const key=(r,t)=>'routineLinked:'+r.id+':'+(r.cycle||0)+':'+t;
 const fields=['date','done','doneAt','doneBy','lastDone','lastDoneAt','lastDoneBy'];
 const schedule=t=>Object.fromEntries(fields.filter(k=>t[k]!==undefined).map(k=>[k,t[k]]));
 const same=(a,b)=>fields.every(k=>a[k]===b[k]);
 function isCleaning(task){const s=norm(task.title);return !/\b(ringo|perro|gato|mascota|veterinario|pastilla|vacuna|desparasitacion)\b/.test(s)&&/\b(limpiar|limpieza|repaso|aspirar|aspiradora|barrer|fregar|mopa|polvo|sabanas?|toallas?|colada|lavadora|tender|desinfectar|ordenar|cristales?|ventanas?|lavabo|inodoro|banos?|escalera|escaleras|reciclaje|basura)\b/.test(s)}
 function candidates(state,routineId=''){const used=new Set((state.routines||[]).filter(r=>r.linkedTasks&&!r.archived&&r.id!==routineId).flatMap(r=>r.taskIds||[]));const own=(state.routines||[]).find(r=>r.id===routineId)?.taskIds||[];return (state.tasks||[]).filter(t=>!used.has(t.id)&&((!t.done&&validDate(t.date))||own.includes(t.id)))}
 // Nombre de la rutina según cada cuánto se repite
 function title(t){const r=t.repeat;if(r==='daily')return 'Repaso diario';if(r==='weekly')return 'Limpieza semanal';if(r==='every2')return 'Limpieza cada 2 días';if(r==='every3')return 'Limpieza cada 3 días';if(r==='monthly')return 'Limpieza mensual';if(r==='yearly')return 'Limpieza anual';if(r==='custom'&&Number(t.every)>0){const n=Number(t.every),u=t.unit||'m';if(u==='w'&&n===2)return 'Limpieza quincenal';if(u==='m'&&n===3)return 'Limpieza trimestral';if(u==='m'&&n===6)return 'Limpieza semestral';return 'Limpieza cada '+n+' '+(u==='d'?'días':u==='w'?'semanas':'meses')}return 'Limpieza puntual'}
 // Sugerencias: una por frecuencia (semanal, quincenal, mensual…). Cada tarea conserva su día y su responsable.
 function groups(state){const result=new Map();for(const t of candidates(state).filter(isCleaning)){const k=JSON.stringify([t.repeat||'none',Number(t.every)||0,t.unit||'']);if(!result.has(k))result.set(k,{title:title(t),date:t.date,whos:new Set(),taskIds:[],names:[]});const g=result.get(k);if(t.date<g.date)g.date=t.date;g.whos.add(t.who||'yo');g.taskIds.push(t.id);g.names.push(t.title)}return [...result.values()].flatMap(g=>Array.from({length:Math.ceil(g.taskIds.length/MAX)},(_,i)=>({title:g.title,date:g.date,who:g.whos.size===1?[...g.whos][0]:'ambos',taskIds:g.taskIds.slice(i*MAX,i*MAX+MAX),names:g.names.slice(i*MAX,i*MAX+MAX)}))).sort((a,b)=>a.date.localeCompare(b.date))}
 function baseline(task){return {stamp:stamp(task),date:task.date||''}}
 function link(state,existing,id,title,ids,at){
  if(!title||title.length>100||!Array.isArray(ids)||!ids.length||ids.length>MAX||new Set(ids).size!==ids.length)throw Error('Elige de 1 a '+MAX+' tareas y escribe un nombre para la rutina.');
  const allowed=new Map(candidates(state,existing?.id).map(t=>[t.id,t]));if(ids.some(id=>!allowed.has(id)))throw Error('Una tarea ha cambiado, ya está en otra rutina o no está programada. Revisa la selección.');
  const tasks=ids.map(id=>allowed.get(id)),sourceBaseline={};for(const t of tasks)sourceBaseline[t.id]=existing?.linkedTasks&&existing.sourceBaseline?.[t.id]||baseline(t);
  const who=new Set(tasks.map(t=>t.who||'yo')),r={...(existing||{}),id,title,linkedTasks:true,taskIds:ids.slice(),sourceBaseline,repeat:'linked',steps:[],cycle:existing?.cycle||0,archived:false,who:who.size===1?[...who][0]:'ambos',updatedAt:at};r.date=effectiveDate(state,r);return r;
 }
 function progress(state,r){const checks=(r.taskIds||[]).map(id=>{const t=(state.tasks||[]).find(t=>t.id===id),initial=r.sourceBaseline?.[id]||{stamp:''},marker=t&&stamp(t),done=!!t&&(!!t.done||!!marker&&marker!==initial.stamp);return {step:{id,title:t?.title||'Tarea eliminada: revisa los vínculos'},task:t,missing:!t,check:{done,by:t?.lastDoneBy||t?.doneBy||''}}});return {checks,total:checks.length,done:checks.filter(c=>c.check.done).length,missing:checks.filter(c=>c.missing).length}}
 function effectiveDate(state,r){const p=progress(state,r),dates=p.checks.filter(c=>!c.check.done&&!c.missing).map(c=>c.task.date).filter(validDate).sort();return dates[0]||(p.done===p.total?r.date||'':'')}
 function advanceTask(task,day,at,by,nextOcc){
  if(!validDate(day))throw Error('La fecha de realización no es válida.');const out={...task};if(!task.done&&repeated(task)){const flexible=typeof CasaCleaningPace!=='undefined'?CasaCleaningPace.cleaning(task):isCleaning(task)&&!task.urgent&&!task.important&&!task.maintenance;const anchor=flexible?day:task.date||day;let next=nextOcc(anchor,task),guard=0;if(!validDate(next)||next<=anchor)throw Error('La repetición de esta tarea no avanza.');while(next<=day&&task.date<day){if(++guard>20000)throw Error('La repetición de esta tarea no es válida.');const following=nextOcc(next,task);if(!validDate(following)||following<=next)throw Error('La repetición de esta tarea no avanza.');next=following}Object.assign(out,{date:next,lastDone:day,lastDoneAt:Math.max(at,Number(task.lastDoneAt||0)+1),lastDoneBy:by||''})}else Object.assign(out,{done:!task.done,doneAt:!task.done?day:null,doneBy:!task.done?by||'':''});return out;
 }
 function toggle(state,r,taskId,done,day,at,by,nextOcc){
  const live=(state.routines||[]).find(x=>x.id===r.id&&!x.archived);if(!live||String(live.cycle||0)!==String(r.cycle||0))throw Error('La ronda ha cambiado. Abre la rutina de nuevo.');const row=progress(state,live).checks.find(c=>c.step.id===taskId);if(!row||row.missing)throw Error('Esta tarea ya no está disponible. Revisa los vínculos.');if(row.check.done===!!done)return {};
  const t=row.task,journalKey=key(live,t.id),cook={...(state.cook||{})};let changed;
  if(done){changed=advanceTask(t,day,at,by,nextOcc);cook[journalKey]={before:schedule(t),after:schedule(changed)}}else if(repeated(t)){const journal=cook[journalKey];if(!journal||!same(schedule(t),journal.after))throw Error('La tarea cambió fuera de esta rutina. Revísala en Tareas antes de deshacerla.');changed={...t};for(const field of fields){if(!Object.hasOwn(journal.before,field))delete changed[field];else changed[field]=journal.before[field]}delete cook[journalKey]}else{changed=advanceTask(t,day,at,by,nextOcc);delete cook[journalKey]}
  return {tasks:(state.tasks||[]).map(x=>x.id===t.id?changed:x),cook};
 }
 function postpone(state,r,day,at,by,expectedDate){
  const current=effectiveDate(state,r);if(!validDate(day)||expectedDate!==undefined&&current!==expectedDate)throw Error('La fecha de las tareas ha cambiado. Revisa la rutina.');const pending=progress(state,r).checks.filter(c=>!c.check.done&&!c.missing);if(!pending.length)throw Error('Las tareas de esta ronda ya están hechas. Termina la rutina.');const ids=new Set(pending.map(c=>c.step.id));
  const tasks=(state.tasks||[]).map(t=>{if(!ids.has(t.id))return t;const anchor=validDate(t.date)&&t.date>day?t.date:day,d=new Date(anchor+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return {...t,date:d.toISOString().slice(0,10)}}),next=effectiveDate({...state,tasks},r);
  return {tasks,routines:(state.routines||[]).map(x=>x.id===r.id?{...x,date:next,postponedAt:at,postponedBy:by||'',postponements:[...(x.postponements||[]),{from:current,to:next,at,by:by||''}].slice(-12)}:x)};
 }
 function finishRoutine(state,r,day){const sourceBaseline={};for(const id of r.taskIds||[]){const t=(state.tasks||[]).find(t=>t.id===id);if(!t)throw Error('Falta una tarea. Revisa los vínculos antes de terminar.');sourceBaseline[id]=baseline(t)}const next={...r,sourceBaseline,cycle:Number(r.cycle||0)+1,last:day},canRepeat=(r.taskIds||[]).some(id=>repeated(state.tasks.find(t=>t.id===id)));next.date=canRepeat?effectiveDate(state,next):'';next.archived=!canRepeat;return next}
 // Rutinas con el mismo nombre (p. ej. veinte «Limpieza semanal») se juntan en una: se queda la de menor id
 // con todas las tareas y lo que ya estaba marcado. Igual en los dos móviles.
 function mergeSameTitle(state){
  const live=(state.routines||[]).filter(r=>r.linkedTasks&&!r.archived),byTitle=new Map();
  for(const r of live){const k=norm(r.title);if(!byTitle.has(k))byTitle.set(k,[]);byTitle.get(k).push(r)}
  let routines=state.routines||[],merged=0;
  for(const g of byTitle.values()){
   if(g.length<2)continue;
   const ordered=g.slice().sort((a,b)=>String(a.id).localeCompare(String(b.id))),keep=ordered[0],ids=[...new Set(ordered.flatMap(r=>r.taskIds||[]))];
   if(ids.length>MAX)continue;
   const sourceBaseline=Object.assign({},...ordered.slice().reverse().map(r=>r.sourceBaseline||{}));
   const owners=new Set(ids.map(id=>(state.tasks||[]).find(t=>t.id===id)).filter(Boolean).map(t=>t.who||'yo'));
   const next={...keep,taskIds:ids,sourceBaseline,who:owners.size===1?[...owners][0]:'ambos'};next.date=effectiveDate(state,next);
   const drop=new Set(ordered.slice(1).map(r=>r.id));routines=routines.filter(r=>!drop.has(r.id)).map(r=>r.id===keep.id?next:r);merged+=drop.size;
  }
  return {routines,merged};
 }
 const api={isCleaning,mergeSameTitle,candidates,groups,link,progress,effectiveDate,advanceTask,toggle,postpone,finishRoutine};root.CasaCleaningLinks=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
