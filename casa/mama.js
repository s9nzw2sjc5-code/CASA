/* «Mamá dice»: recordatorios como los de una madre y reparto del día como el de una ama de casa.
   Solo lee los datos de casa y propone; no cambia nada por su cuenta. Sin datos personales en el código. */
(function(root){
 'use strict';
 const plus=(s,n)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
 const days=(a,b)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/864e5);
 const valid=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d);
 // Cariños según el día, para que no suene siempre igual
 const PET=['cariño','cielo','hija','mi vida','corazón'];
 const pick=(arr,seed)=>arr[Math.abs(seed)%arr.length];
 const seedOf=s=>[...String(s)].reduce((n,c)=>n*31+c.charCodeAt(0)|0,7);
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
  const seed=seedOf(t),pet=pick(PET,seed),add=(prio,icon,text,action)=>out.push({prio,icon,text,action:action||null});
  const minutes=input.minutes||(()=>15),dated=tasks.filter(x=>valid(x.date));
  const due=dated.filter(x=>x.date<=t),late=dated.filter(x=>x.date<t),todayT=dated.filter(x=>x.date===t);
  // 1) Lo urgente, lo primero
  for(const x of due.filter(x=>x.urgent).slice(0,2))add(100,'❗',`Lo primero, ${pet}: «${x.title}». Esto no se deja para luego.`,{kind:'task',id:x.id});
  // 2) Se ha juntado mucho: repartirlo como haría una ama de casa
  const lateN=late.filter(x=>!x.urgent).length;
  if(lateN>=3)add(90,'🧺',`Se te han juntado ${lateN} cosas atrasadas. No te agobies, que te las reparto en unos días, poquito a poco.`,{kind:'priority'});
  else if(lateN>0)add(60,'⏰',`Tienes ${lateN===1?'una cosa atrasada':lateN+' cosas atrasadas'} en Tareas. Si hoy no puedes, pásala a otro día, pero no la dejes ahí.`,{kind:'tareas'});
  // 3) Colada: poner → tender → recoger y doblar
  const washedToday=(input.tasks||[]).some(x=>x.lastDone===t&&input.isWash&&input.isWash(x));
  const fold=todayT.find(x=>/\bdoblar\b/i.test(String(x.title)));
  if(washedToday&&h<21)add(80,'👕',`Has puesto la lavadora: tiéndela en cuanto acabe, que si se queda dentro huele a humedad.`);
  else if(fold)add(55,'🧦',`Dobla y guarda la ropa limpia hoy, ${pet}, que si se queda en la silla se arruga.`,{kind:'task',id:fold.id});
  // 4) El tiempo: mañana llueve y toca colada
  const tomorrow=plus(t,1),fTom=(input.forecast||[]).find(d=>d.date===tomorrow);
  const washTom=dated.find(x=>x.date===tomorrow&&input.isWash&&input.isWash(x));
  if(fTom&&input.isWet&&input.isWet(fTom)&&washTom)add(75,'🌧️',`Mañana llueve y te toca lavadora: si puedes, ponla hoy y así tiendes al sol.`,{kind:'task',id:washTom.id});
  // 5) Lo que lleva mucho sin hacerse (como el «nivel de suciedad» de las apps de limpieza)
  const neglected=dated.filter(x=>{const p=period(x);if(!p||p>40)return false;const last=valid(x.lastDone)?x.lastDone:null;const since=last?days(last,t):days(x.date,t)+p;return since>=2*p&&x.date<=t}).sort((a,b)=>(valid(a.lastDone)?a.lastDone:'0')<(valid(b.lastDone)?b.lastDone:'0')?-1:1);
  if(neglected.length){const x=neglected[0],d=valid(x.lastDone)?days(x.lastDone,t):null;add(65,'🧽',`${d?`Hace ${d} días que no se hace`:'Hace mucho que no se hace'} «${x.title}». Un ratito hoy y te quitas el peso de encima.`,{kind:'task',id:x.id})}
  // 6) Ringo
  for(const p of (input.pets||[]).filter(p=>valid(p.due)&&p.due<=t).slice(0,1))add(70,'🐶',`A Ringo le toca «${p.name}»${p.due<t?' y ya va con retraso':''}. Pobrecito, que él no se queja.`,{kind:'ringo'});
  // 7) Fechas importantes cercanas
  for(const x of dated.filter(x=>input.isImportant&&input.isImportant(x)&&x.date>t&&x.date<=plus(t,3)).slice(0,1))add(68,'📅',`${input.dayName?input.dayName(x.date):x.date} tienes «${x.title}». Que no te pille el toro.`,{kind:'importantes'});
  // 8) La compra
  if((input.lowPantry||0)>=3)add(45,'🛒',`Se están acabando ${input.lowPantry} cosas de casa. Apúntalas antes de que te quedes sin nada.`,{kind:'compras'});
  else if((input.listPending||0)>=8)add(35,'🛒',`Tienes ${input.listPending} cosas en la lista de la compra: si pasas por el súper, aprovecha.`,{kind:'compras'});
  // 9) Cómo viene el día (tiempo de tareas de hoy)
  const load=due.reduce((n,x)=>n+minutes(x),0);
  if(todayT.length&&!lateN)add(40,'⏱️',load<=45?`Hoy tienes unos ${load} minutos de tareas. Poquito a poco, que cunde.`:`Hoy tienes unos ${load} minutos de tareas: empieza por lo que más pereza te dé y lo demás va solo.`);
  // 10) Mañana y noche
  if(!input.hasRoutines){
   if(h<12)add(30,'☀️',`Buenos días, ${pet}: abre las ventanas diez minutos y haz las camas, que la casa luce otra cosa.`,{kind:'routines'});
   else if(h>=20)add(30,'🌙',`Antes de acostarte: deja la cocina recogida y la basura fuera. Mañana me lo agradecerás.`,{kind:'routines'});
  }
  if(h>=19){const tm=dated.filter(x=>x.date===tomorrow);if(tm.length)add(25,'📋',`Mañana te toca: ${tm.slice(0,3).map(x=>'«'+x.title+'»').join(', ')}${tm.length>3?' y '+(tm.length-3)+' más':''}.`)}
  if(!out.length)add(10,'💛',pick([`Todo en orden por aquí, ${pet}. Descansa un poco, que te lo has ganado.`,`Hoy no hay nada pendiente. Así da gusto, ${pet}.`],seed));
  return out.sort((a,b)=>b.prio-a.prio).slice(0,4);
 }
 function greeting(hour,today){const p=pick(PET,seedOf(today));return hour<13?`Buenos días, ${p}`:hour<20?`Buenas tardes, ${p}`:`Buenas noches, ${p}`}
 const api={nudges,greeting,ROUTINES,period};
 root.CasaMama=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
