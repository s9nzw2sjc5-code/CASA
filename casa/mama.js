/* Recordatorios de hoy: qué toca y cómo repartirlo, en tono neutro (sin «mamá»).
   Solo lee los datos de casa y propone; no cambia nada por su cuenta. Sin datos personales en el código. */
(function(root){
 'use strict';
 const plus=(s,n)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
 const days=(a,b)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/864e5);
 const valid=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d);
 // Cada cuántos días se repite una tarea (para saber si «lleva mucho sin hacerse»)
 function period(t){
  if(t.repeat==='daily')return 1;if(t.repeat==='weekly')return 7;if(t.repeat==='monthly')return 30;if(t.repeat==='yearly')return 365;
  if(t.repeat==='custom'&&Number(t.every)>0)return Number(t.every)*({d:1,w:7,m:30}[t.unit]||30);
  return 0;
 }
 // Rutina de mañana y de noche (al estilo FlyLady): poquito, todos los días
 const ROUTINES=[
  {key:'mama-manana',title:'Rutina de mañana: hacer las camas y ventilar 10 minutos',repeat:'daily',min:10},
  {key:'mama-noche',title:'Rutina de noche: cocina recogida y fregadero limpio',repeat:'daily',min:10},
  {key:'mama-basura',title:'Sacar la basura y el reciclaje',repeat:'custom',every:2,unit:'d',min:5},
 ];
 /* input: {today, hour, tasks, pets:[{name,due}], listPending, lowPantry, forecast:[{date,rain,mm}],
           isWash(t), isWet(day), isImportant(t), minutes(t), dayName(date), hasRoutines} */
 function nudges(input){
  const t=input.today,h=Number(input.hour)||0,tasks=(input.tasks||[]).filter(x=>x&&!x.done),out=[];
  const add=(prio,icon,text,action)=>out.push({prio,icon,text,action:action||null});
  const minutes=input.minutes||(()=>15),dated=tasks.filter(x=>valid(x.date));
  const due=dated.filter(x=>x.date<=t),late=dated.filter(x=>x.date<t),todayT=dated.filter(x=>x.date===t);
  // 1) Lo urgente, lo primero
  for(const x of due.filter(x=>x.urgent).slice(0,2))add(100,'❗',`Urgente: «${x.title}».`,{kind:'task',id:x.id});
  // 2) Se ha juntado mucho: repartirlo como haría una ama de casa
  const lateN=late.filter(x=>!x.urgent).length;
  if(lateN>=3)add(90,'🧺',`${lateN} tareas atrasadas. Se pueden repartir en los próximos días por prioridad.`,{kind:'priority'});
  else if(lateN>0)add(60,'⏰',`${lateN===1?'1 tarea atrasada':lateN+' tareas atrasadas'} en Tareas.`,{kind:'tareas'});
  // 3) Colada: poner → tender → recoger y doblar
  const washedToday=(input.tasks||[]).some(x=>x.lastDone===t&&input.isWash&&input.isWash(x));
  const fold=todayT.find(x=>/\bdoblar\b/i.test(String(x.title)));
  if(washedToday&&h<21)add(80,'👕',`Lavadora puesta hoy: tender en cuanto termine.`);
  else if(fold)add(55,'🧦',`Hoy toca doblar y guardar la ropa limpia.`,{kind:'task',id:fold.id});
  // 4) El tiempo: mañana llueve y toca colada
  const tomorrow=plus(t,1),fTom=(input.forecast||[]).find(d=>d.date===tomorrow);
  const washTom=dated.find(x=>x.date===tomorrow&&input.isWash&&input.isWash(x));
  if(fTom&&input.isWet&&input.isWet(fTom)&&washTom)add(75,'🌧️',`Mañana llueve y toca lavadora: mejor ponerla hoy.`,{kind:'task',id:washTom.id});
  // 5) Lo que lleva mucho sin hacerse (como el «nivel de suciedad» de las apps de limpieza)
  const neglected=dated.filter(x=>{const p=period(x);if(!p||p>40)return false;const last=valid(x.lastDone)?x.lastDone:null;const since=last?days(last,t):days(x.date,t)+p;return since>=2*p&&x.date<=t}).sort((a,b)=>(valid(a.lastDone)?a.lastDone:'0')<(valid(b.lastDone)?b.lastDone:'0')?-1:1);
  if(neglected.length){const x=neglected[0],d=valid(x.lastDone)?days(x.lastDone,t):null;add(65,'🧽',`«${x.title}» lleva ${d?d+' días':'mucho tiempo'} sin hacerse.`,{kind:'task',id:x.id})}
  // 6) Ringo
  for(const p of (input.pets||[]).filter(p=>valid(p.due)&&p.due<=t).slice(0,1))add(70,'🐶',`Ringo: «${p.name}»${p.due<t?' (con retraso)':''}.`,{kind:'ringo'});
  // 7) Fechas importantes cercanas
  for(const x of dated.filter(x=>input.isImportant&&input.isImportant(x)&&x.date>t&&x.date<=plus(t,3)).slice(0,1))add(68,'📅',`${input.dayName?input.dayName(x.date):x.date}: «${x.title}».`,{kind:'importantes'});
  // 8) La compra
  if((input.lowPantry||0)>=3)add(45,'🛒',`Se están acabando ${input.lowPantry} productos de casa.`,{kind:'compras'});
  else if((input.listPending||0)>=8)add(35,'🛒',`${input.listPending} productos en la lista de la compra.`,{kind:'compras'});
  // 9) Cómo viene el día (tiempo de tareas de hoy)
  const load=due.reduce((n,x)=>n+minutes(x),0);
  if(todayT.length&&!lateN)add(40,'⏱️',`Hoy: unos ${load} minutos de tareas.`);
  // 10) Mañana y noche
  if(!input.hasRoutines){
   if(h<12)add(30,'☀️',`Por la mañana: ventilar 10 minutos y hacer las camas.`,{kind:'routines'});
   else if(h>=20)add(30,'🌙',`Antes de dormir: cocina recogida y basura fuera.`,{kind:'routines'});
  }
  if(h>=19){const tm=dated.filter(x=>x.date===tomorrow);if(tm.length)add(25,'📋',`Mañana: ${tm.slice(0,3).map(x=>'«'+x.title+'»').join(', ')}${tm.length>3?' y '+(tm.length-3)+' más':''}.`)}
  if(!out.length)add(10,'✅',`Nada pendiente para hoy.`);
  return out.sort((a,b)=>b.prio-a.prio).slice(0,4);
 }
 function greeting(){return 'Recordatorios de hoy'}
 const api={nudges,greeting,ROUTINES,period};
 root.CasaMama=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
