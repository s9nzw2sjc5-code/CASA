/* Vistas de las tareas existentes. No escribe ni transforma los datos del hogar. */
(function(root){
 function frequency(t,template){
  if(t.planKind==='temporada'||template?.kind==='year'){
   const m=Number(template?.month||String(t.date||'').slice(5,7));
   return 'Por estación · '+(m>=3&&m<=5?'Primavera':m>=6&&m<=8?'Verano':m>=9&&m<=11?'Otoño':m===12||m===1||m===2?'Invierno':'Sin clasificar');
  }
  if(t.repeat==='daily')return 'Diarias';if(t.repeat==='weekly')return 'Semanales';
  if(t.repeat==='fortnightly'||t.repeat==='custom'&&((Number(t.every)===2&&t.unit==='w')||(Number(t.every)===14&&t.unit==='d')))return 'Quincenales';
  if(t.repeat==='monthly')return 'Mensuales';if(t.repeat==='yearly')return 'Anuales';
  if(t.repeat==='every2')return 'Cada 2 días';if(t.repeat==='every3')return 'Cada 3 días';
  if(t.repeat==='custom'&&Number(t.every)>0)return 'Cada '+t.every+' '+({d:'días',w:'semanas',m:'meses'}[t.unit]||'periodos');
  return t.date?'Puntuales':'Sin clasificar';
 }
 function build(state,plan,today){
  const templates=plan.ITEMS||[],zones=new Map(plan.ZONES||[]);
  const entries=(state.tasks||[]).map(task=>{
   const key=String(task.planKey||'').replace(/:\d+$/,''),template=templates.find(x=>x.key===key);
   const explicit=task.planZone||task.zone,picked=task.tzZone&&typeof TASK_ZONES!=='undefined'&&TASK_ZONES.find(z=>z.id===task.tzZone);
   const zone=picked?picked.name:explicit?(zones.get(explicit)||String(explicit)):template?(template.zone?zones.get(template.zone)||template.zone:'Toda la casa'):'Sin clasificar';
   return {task,zone,frequency:frequency(task,template),due:!task.done&&!!task.date&&task.date<=today,doneToday:task.doneAt===today||task.lastDone===today};
  });
  const group=field=>{const groups=new Map();for(const e of entries){if(!groups.has(e[field]))groups.set(e[field],[]);groups.get(e[field]).push(e)}return groups};
  const byZone=group('zone');const hz=state.cook?.housePlanZones,planZones=Array.isArray(hz)?hz:hz&&Array.isArray(hz.chosen)?hz.chosen:[];/* el plan guarda {chosen,known} */for(const id of planZones){const name=zones.get(id);if(name&&!byZone.has(name))byZone.set(name,[])}
  return {entries,byZone,byFrequency:group('frequency'),due:entries.filter(e=>e.due),doneToday:entries.filter(e=>e.doneToday)};
 }
 const api={build,frequency};root.CasaCleaningView=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
