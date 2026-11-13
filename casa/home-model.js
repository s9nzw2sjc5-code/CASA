/* Electrodomésticos y rutinas: transformaciones pequeñas del estado del hogar. */
(function(root){
 'use strict';
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
 const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&Number.isFinite(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
 const date=d=>d.toISOString().slice(0,10);
 function nextDate(day,routine){if(!validDate(day)||!['none','weekly','fortnightly','monthly','custom'].includes(routine.repeat)||routine.repeat==='custom'&&(!Number.isInteger(Number(routine.days))||Number(routine.days)<1||Number(routine.days)>365))throw Error('El plazo de la rutina no es válido.');const d=new Date(day+'T12:00:00Z');if(routine.repeat==='none')return '';if(routine.repeat==='monthly'){const n=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+1);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0,12)).getUTCDate();d.setUTCDate(Math.min(n,last));return date(d)}d.setUTCDate(d.getUTCDate()+(routine.repeat==='weekly'?7:routine.repeat==='fortnightly'?14:Number(routine.days)));return date(d)}
 const checkKey=(id,cycle,step)=>'routineStep:'+id+':'+cycle+':'+step;
 function progress(state,routine){if(routine.linkedTasks)return root.CasaCleaningLinks.progress(state,routine);const checks=(routine.steps||[]).map(step=>({step,check:state.cook?.[checkKey(routine.id,routine.cycle||0,step.id)]||{done:false}}));return {checks,done:checks.filter(x=>x.check.done).length,total:checks.length}}
 function requireRoutine(state,id,cycle){const r=(state.routines||[]).find(r=>r.id===id&&!r.archived);if(!r||String(r.cycle||0)!==String(cycle))throw Error('La rutina ha cambiado o ya se terminó. Ábrela de nuevo.');return r}
 function toggleStep(state,id,cycle,stepId,done,at,by){const r=requireRoutine(state,id,cycle);if(!r.steps.some(s=>s.id===stepId))throw Error('Esta tarea ya no está en la rutina.');return {cook:{...(state.cook||{}),[checkKey(id,cycle,stepId)]:{done:!!done,at,by:by||''}}}}
 function postpone(state,id,cycle,day,at,by,expectedDate){
  const r=requireRoutine(state,id,cycle);if(r.linkedTasks)return root.CasaCleaningLinks.postpone(state,r,day,at,by,expectedDate);if(!validDate(day)||expectedDate!==undefined&&r.date!==expectedDate)throw Error('La fecha de la rutina ha cambiado. Revisa el día actual.');
  const anchor=validDate(r.date)&&r.date>day?r.date:day,d=new Date(anchor+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);const next=date(d);
  return {routines:(state.routines||[]).map(x=>x.id===id?{...x,date:next,postponedAt:at,postponedBy:by||'',postponements:[...(x.postponements||[]),{from:x.date||'',to:next,at,by:by||''}].slice(-12)}:x)};
 }
 function finish(state,id,cycle,day,at,by){
  const r=requireRoutine(state,id,cycle);if(!validDate(day))throw Error('Indica una fecha válida.');const p=progress(state,r);if(!p.total||p.done!==p.total||p.missing)throw Error('Marca las tareas realizadas antes de terminar la rutina.');
  const runs=(state.routineRuns||[]).filter(run=>!(run.routineId===id&&String(run.cycle)===String(cycle))),run={id:id+'-'+cycle,routineId:id,cycle:Number(cycle),date:day,at,by:by||'',count:p.total};
  const same=[...runs.filter(x=>x.routineId===id),run].sort((a,b)=>b.at-a.at).slice(0,24),cook={...(state.cook||{})};for(const key of Object.keys(cook)){for(const prefix of ['routineStep:'+id+':','routineLinked:'+id+':'])if(key.startsWith(prefix)&&Number(key.slice(prefix.length).split(':')[0])<=Number(cycle))delete cook[key]}
  const next=r.linkedTasks?null:nextDate(day,r),updated=r.linkedTasks?root.CasaCleaningLinks.finishRoutine(state,r,day):{...r,cycle:Number(cycle)+1,last:day,date:next,archived:!next};return {routines:(state.routines||[]).map(x=>x.id===id?updated:x),routineRuns:[...runs.filter(x=>x.routineId!==id),...same],cook};
 }
 function stepsFromText(text,previous,uid){const titles=String(text||'').split(/\r?\n/).map(s=>s.replace(/^\s*(?:[-*•]|\d+[.)])\s*/,'').trim()).filter(Boolean);if(!titles.length||titles.length>30||titles.some(t=>t.length>160))throw Error('Escribe de 1 a 30 tareas, una por línea y de hasta 160 caracteres.');if(new Set(titles.map(norm)).size!==titles.length)throw Error('Hay tareas repetidas en la rutina.');return titles.map(title=>({id:(previous||[]).find(s=>norm(s.title)===norm(title))?.id||uid(),title}))}
 const api={norm,validDate,nextDate,checkKey,progress,toggleStep,postpone,finish,stepsFromText};root.CasaHome=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
