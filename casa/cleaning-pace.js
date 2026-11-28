/* Limpieza flexible: una tarea pendiente no genera copias ni cuenta como hecha al aplazarla. */
(function(root){
 const valid=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'');
 const plus=(s,n)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const protectedTask=t=>t.urgent||t.important||t.maintenance||t.fromReminder||String(t.id||'').startsWith('rem-')||t.remind||t.time||/\b(ringo|fuente|medicacion|pastilla|vacuna|veterinario)\b/.test(norm(t.title));
 const cleaning=t=>!protectedTask(t)&&(t.plan==='casa'||t.mamaKey||/limpi|recoger|ordenar|sabanas|toallas|colada|lavadora|tender|doblar|aspirar|fregar|barrer|basura|ventilar|hacer.*cama/.test(norm(t.title)));
 const basic=t=>cleaning(t)&&(t.mamaKey||t.repeat==='daily'||/recoger.*cocina|cocina.*recogida|sacar.*basura/.test(norm(t.title)));
 function earliest(t,next){if(!cleaning(t)||!valid(t.lastDone)||!t.repeat||t.repeat==='none')return '';const d=next(t.lastDone,t);return valid(d)&&d>t.lastDone?d:''}
 function repairs(tasks,today,next){return tasks.filter(t=>!t.done&&valid(t.date)&&t.lastDone<=today).flatMap(t=>{const d=earliest(t,next);return d&&t.date<d&&t.date<=today&&d>today?[{id:t.id,from:t.date,to:d}]:[]})}
 // Más margen el fin de semana: 25 min y 2 aplazadas entre semana; 60 min y 4 el sábado y el domingo.
 const weekend=d=>{const w=new Date(d+'T12:00:00Z').getUTCDay();return w===0||w===6};
 const capFor=d=>weekend(d)?{min:60,count:4}:{min:25,count:2};
 const days=(a,b)=>Math.round((new Date(b+'T12:00:00Z')-new Date(a+'T12:00:00Z'))/864e5);
 // Próxima vez que toca según su ritmo, contando desde la fecha atrasada (la primera después de «today»).
 function nextOn(t,today,next){if(!t.repeat||t.repeat==='none'||t.repeat==='daily'||!valid(t.date))return '';let d=t.date,n=0;while(d<=today&&n++<800){const nd=next(d,t);if(!valid(nd)||nd<=d)return '';d=nd}return d>today?d:''}
 const SKIP_DAYS=3;
 function plan(tasks,today,next,minutes,{keep=[],start=plus(today,1),cap=capFor}={}){
  const kept=new Set(keep),candidates=tasks.filter(t=>!t.done&&cleaning(t)&&valid(t.date)&&t.date<=today&&!kept.has(t.id));
  candidates.sort((a,b)=>String(a.date).localeCompare(b.date)||String(a.lastDone||'').localeCompare(b.lastDone||'')||String(a.id).localeCompare(String(b.id)));
  const ids=new Set(candidates.map(t=>t.id)),load={},count={},end=plus(start,365);
  // Reserva también las próximas repeticiones, no solo la primera fecha guardada.
  for(const t of tasks.filter(t=>!t.done&&valid(t.date)&&!ids.has(t.id)&&!basic(t))){let d=t.date,n=0;while(d<=end&&n++<800){if(d>=start&&!(ids.has(t.id)&&d===t.date)){load[d]=(load[d]||0)+minutes(t)}if(!t.repeat||t.repeat==='none')break;const nd=next(d,t);if(!valid(nd)||nd<=d)break;d=nd}}
  const rows=[];
  for(const t of candidates){if(basic(t)){rows.push({id:t.id,title:t.title,from:t.date,to:start,min:minutes(t),important:false});continue}
   const floor=earliest(t,next),m=minutes(t);let natural=nextOn(t,today,next);if(natural&&natural<start)natural='';if(natural&&floor&&floor>natural)natural=floor;
   // Repetida que vuelve a tocar en pocos días: se salta la vez perdida y sigue su ritmo (sin marcarla como hecha).
   if(natural&&days(start,natural)<=SKIP_DAYS){rows.push({id:t.id,title:t.title,from:t.date,to:natural,min:m,important:false,skip:true});load[natural]=(load[natural]||0)+m;continue}
   let d=start;if(floor&&floor>d)d=floor;
   while(d<=end&&(!natural||d<natural)&&((count[d]||0)>=cap(d).count||((load[d]||0)>0&&(load[d]||0)+m>cap(d).min)))d=plus(d,1);
   if(d>end)throw Error('No queda un hueco ligero en el próximo año. Revisa las fechas antes de aplicar.');
   // Nunca más tarde que su próxima vez: si no cabe antes, se salta la vez perdida.
   if(natural&&d>=natural){rows.push({id:t.id,title:t.title,from:t.date,to:natural,min:m,important:false,skip:true});load[natural]=(load[natural]||0)+m;continue}
   rows.push({id:t.id,title:t.title,from:t.date,to:d,min:m,important:false});count[d]=(count[d]||0)+1;
   load[d]=(load[d]||0)+m;
  }
  return {plan:rows,load};
 }
 const api={cleaning,basic,protectedTask,earliest,repairs,plan,nextOn,capFor};root.CasaCleaningPace=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
