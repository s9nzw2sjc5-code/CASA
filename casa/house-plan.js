/* Plan de limpieza por zonas y recomendaciones según el tiempo.
   Funciones puras: no guardan nada ni contienen datos de ninguna casa concreta.
   Las zonas las marca cada hogar en la app y la ubicación se guarda en sus datos privados. */
(function(root){
 'use strict';
 const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
 const pad=n=>String(n).padStart(2,'0');
 const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&Number.isFinite(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
 const plus=(s,n)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
 const weekday=s=>(new Date(s+'T12:00:00Z').getUTCDay()+6)%7; // 0 = lunes
 const byDate=(a,b)=>(a.date||'9').localeCompare(b.date||'9');

 const ZONES=[
  ['cocina','Cocina'],['banoPrincipal','Baño principal'],['banoInvitados','Baño de invitados'],['aseo','Aseo o baño de la entrada'],
  ['dormitorio','Dormitorio principal'],['invitados','Cuarto de invitados'],['salon','Salón'],['estarSotano','Zona de estar del sótano'],
  ['patio','Patio'],['terraza','Terraza'],['gimnasio','Gimnasio'],['escaleras','Escaleras'],['taller','Taller'],
  ['lavadero','Lavadero'],['secadora','Secadora'],['garaje','Garaje'],['almacen','Almacén'],
  ['ventanas','Ventanas y persianas'],['radiadores','Radiadores y caldera'],['aire','Aire acondicionado'],['chimenea','Chimenea']
 ];

 // kind: week = cada semana · fortnight = cada 2 semanas · month4 = cada 4 semanas (rincón que rota)
 //       every = cada N meses desde hoy · year = una vez al año, en su temporada
 // day: 0 = lunes … 6 = domingo · week: semana del ciclo en la que toca · zone null = cualquier casa
 const ITEMS=[
  {key:'cocina-semanal',zone:'cocina',kind:'week',day:0,title:'Cocina: encimera, frente de los muebles y fregadero',notes:'10–15 minutos. Termina secando el grifo para que no queden marcas de cal.'},
  {key:'bano-principal',zone:'banoPrincipal',kind:'week',day:1,title:'Baño principal: inodoro, lavabo, ducha y espejo',notes:'Deja actuar el producto en el inodoro mientras limpias el lavabo.'},
  {key:'aseo-entrada',zone:'aseo',kind:'week',day:1,title:'Aseo de la entrada: repaso rápido',notes:'Lavabo, inodoro y espejo: 5 minutos.'},
  {key:'dormitorio',zone:'dormitorio',kind:'week',day:2,title:'Dormitorio principal: polvo, ventilar y cambiar las sábanas',notes:'Ventila 10 minutos mientras quitas el polvo.'},
  {key:'salon',zone:'salon',kind:'week',day:3,title:'Salón: aspirar el sofá y bajo los muebles'},
  {key:'lavadero',zone:'lavadero',kind:'week',day:4,title:'Lavadero: limpiar la pila y el suelo'},
  {key:'secadora-filtro',zone:'secadora',kind:'week',day:4,title:'Secadora: vaciar el filtro de pelusa y el depósito',notes:'Lo ideal es hacerlo después de cada secado: seca mejor, gasta menos y evita riesgo de incendio.'},
  {key:'escaleras',zone:'escaleras',kind:'week',day:5,title:'Escaleras: barrer y fregar',notes:'De arriba abajo. El pasamanos, con un paño húmedo.'},
  {key:'repaso-semana',zone:null,kind:'week',day:6,title:'Repaso de la semana: mirar pendientes y reorganizar',notes:'5 minutos: en Tareas → Reorganizar pendientes, pasa lo atrasado a días con hueco.'},

  {key:'bano-invitados',zone:'banoInvitados',kind:'fortnight',day:1,week:1,title:'Baño de invitados: repaso, abrir grifos y tirar de la cadena',notes:'Si casi no se usa, correr el agua evita que el sifón huela.'},
  {key:'cuarto-invitados',zone:'invitados',kind:'fortnight',day:2,week:1,title:'Cuarto de invitados: ventilar y quitar el polvo'},
  {key:'patio',zone:'patio',kind:'fortnight',day:3,week:0,title:'Patio: barrer y regar las plantas'},
  {key:'estar-sotano',zone:'estarSotano',kind:'fortnight',day:3,week:1,title:'Zona de estar del sótano: polvo y aspirar'},
  {key:'garaje',zone:'garaje',kind:'fortnight',day:4,week:1,title:'Garaje: barrer y ordenar'},
  {key:'terraza',zone:'terraza',kind:'fortnight',day:5,week:0,title:'Terraza: barrer y revisar los desagües',notes:'Las hojas y la tierra atascan los desagües. Mejor con el suelo seco.'},

  {key:'nevera',zone:'cocina',kind:'month4',day:0,week:0,title:'Nevera: vaciar y limpiar por dentro',notes:'Aprovecha antes de hacer la compra, cuando está más vacía.'},
  {key:'juntas-bano',zone:'banoPrincipal',kind:'month4',day:1,week:0,title:'Baños: juntas, mampara y desagüe de la ducha'},
  {key:'interruptores',zone:null,kind:'month4',day:2,week:0,title:'Interruptores, pomos y mandos: desinfectar'},
  {key:'lamparas',zone:null,kind:'month4',day:3,week:0,title:'Lámparas y ventiladores: quitar el polvo'},
  {key:'lavadora-filtro',zone:'lavadero',kind:'month4',day:4,week:0,title:'Lavadora: limpiar el filtro y la goma de la puerta'},
  {key:'gimnasio',zone:'gimnasio',kind:'month4',day:5,week:0,title:'Gimnasio: ventilar, quitar el polvo y limpiar las máquinas'},
  {key:'rieles',zone:'ventanas',kind:'month4',day:0,week:1,title:'Rieles de las ventanas: aspirar y pasar un paño',notes:'Primero aspira la arena con la boquilla estrecha. Después, un cepillo de dientes o un bastoncillo con agua y un poco de vinagre, y seca.'},
  {key:'radiadores-polvo',zone:'radiadores',kind:'month4',day:3,week:1,title:'Radiadores y rejillas: quitar el polvo'},
  {key:'almacen',zone:'almacen',kind:'month4',day:4,week:1,title:'Almacén: ordenar y barrer'},
  {key:'taller',zone:'taller',kind:'month4',day:5,week:1,title:'Taller: ordenar y barrer'},
  {key:'campana',zone:'cocina',kind:'month4',day:0,week:2,title:'Campana: lavar los filtros',notes:'En el lavavajillas o en agua caliente con desengrasante.'},
  {key:'cintas-persianas',zone:'ventanas',kind:'month4',day:2,week:2,title:'Cintas de las persianas: pasar un paño',notes:'Paño apenas húmedo con jabón neutro. Sube y baja la persiana para llegar a toda la cinta. No la empapes.'},
  {key:'zocalos',zone:null,kind:'month4',day:3,week:2,title:'Zócalos y marcos de las puertas'},
  {key:'ventanas-fuera',zone:'ventanas',kind:'month4',day:5,week:2,title:'Ventanas por fuera',notes:'Solo en día seco y sin viento.'},
  {key:'horno',zone:'cocina',kind:'month4',day:0,week:3,title:'Horno y microondas por dentro'},
  {key:'cristales-dentro',zone:'ventanas',kind:'month4',day:2,week:3,title:'Cristales y marcos de las ventanas por dentro'},
  {key:'cubos-basura',zone:null,kind:'month4',day:4,week:3,title:'Cubos de basura: lavar'},

  {key:'secadora-condensador',zone:'secadora',kind:'every',every:3,offset:10,title:'Secadora: limpiar el condensador',notes:'Mira el manual: suele sacarse por la parte de abajo. Se aclara con agua y se deja secar antes de volver a ponerlo.'},
  {key:'secadora-goma',zone:'secadora',kind:'every',every:6,offset:24,title:'Secadora: revisar la goma de la puerta y el tubo de desagüe'},
  {key:'humedades',zone:null,kind:'every',every:3,offset:17,title:'Revisar humedades y moho en esquinas y armarios'},
  {key:'colchones',zone:'dormitorio',kind:'every',every:3,offset:31,title:'Colchones: aspirar y darles la vuelta'},

  {key:'radiadores-purgar',zone:'radiadores',kind:'year',month:10,mday:15,window:[10,11],title:'Purgar los radiadores antes de encender la calefacción',notes:'Con la calefacción apagada y fría, abre la llave de purga con un trapo debajo hasta que salga agua sin aire. Después comprueba la presión de la caldera.'},
  {key:'caldera',zone:'radiadores',kind:'year',month:10,mday:1,window:[9,11],title:'Caldera: comprobar la presión y pedir la revisión anual',notes:'La presión en frío suele ir entre 1 y 1,5 bar. Mira la de tu caldera en el manual.'},
  {key:'chimenea',zone:'chimenea',kind:'year',month:9,mday:20,window:[9,11],title:'Chimenea: deshollinar y revisar el tiro',notes:'Antes de la primera lumbre del año. La ceniza, siempre fría y en un cubo metálico.'},
  {key:'canaletas',zone:'terraza',kind:'year',month:10,mday:20,window:[10,11],title:'Terraza: limpiar canaletas y desagües antes de las lluvias'},
  {key:'burletes',zone:'ventanas',kind:'year',month:11,mday:25,window:[11,12],title:'Revisar burletes de puertas y ventanas antes del frío'},
  {key:'aire-invierno',zone:'aire',kind:'year',month:11,mday:5,window:[11,11],title:'Aire acondicionado: limpiar los filtros antes del invierno (si calienta con él)'},
  {key:'cortinas',zone:'ventanas',kind:'year',month:3,mday:15,window:[3,4],title:'Lavar las cortinas'},
  {key:'terraza-primavera',zone:'terraza',kind:'year',month:4,mday:10,window:[3,4],title:'Terraza: limpieza general tras el invierno'},
  {key:'aire-exterior',zone:'aire',kind:'year',month:4,mday:25,window:[4,5],title:'Aire acondicionado: limpiar la unidad exterior'},
  {key:'persianas-revision',zone:'ventanas',kind:'year',month:5,mday:5,window:[5,5],title:'Persianas y toldos: revisar antes del verano'},
  {key:'aire-verano',zone:'aire',kind:'year',month:5,mday:15,window:[5,6],title:'Aire acondicionado: limpiar los filtros antes del verano',notes:'Desenchúfalo, saca los filtros, lávalos con agua tibia y déjalos secar a la sombra.'},
  {key:'aire-mitad',zone:'aire',kind:'year',month:7,mday:20,window:[7,8],title:'Aire acondicionado: limpiar los filtros a mitad del verano'}
 ];

 // Primera fecha del ciclo a partir de hoy, alineada con el día de la semana y la semana del ciclo
 function cycleDate(today,day,week,period){let d=plus(plus(today,-weekday(today)),7*(week||0)+day);while(d<today)d=plus(d,7*period);return d}
 // Fecha de temporada: si estamos dentro de su temporada y la fecha ideal ya pasó, pronto (sin amontonar);
 // si no, la próxima fecha ideal
 function seasonDate(item,today,n){
  const y=Number(today.slice(0,4)),m=Number(today.slice(5,7)),ideal=y+'-'+pad(item.month)+'-'+pad(item.mday);
  if(ideal>=today)return ideal;
  if(m>=item.window[0]&&m<=item.window[1])return plus(today,2+(n%5)*2);
  return (y+1)+'-'+pad(item.month)+'-'+pad(item.mday);
 }
 function whoFor(opt,item,i){if(opt.who!=='alternar')return opt.who||'yo';const ids=(opt.people||[]).length?opt.people:['yo'];return ids[(item.day??i)%ids.length]}
 const KIND={week:'semanal',fortnight:'semanal',month4:'rincon',every:'rincon',year:'temporada'};

 function buildPlan(state,opt){
  const zones=new Set(opt.zones||[]),today=opt.today,existing=state.tasks||[];if(!validDate(today))throw Error('Fecha no válida.');
  const has=item=>existing.some(t=>t.planKey===item.key||norm(t.title)===norm(item.title));
  const tasks=[],skipped=[];let inSeason=0;
  ITEMS.forEach((item,i)=>{
   if(item.zone&&!zones.has(item.zone))return;
   if(has(item)){skipped.push(item.key);return}
   const t={id:opt.uid(),title:item.title,date:'',time:'',who:whoFor(opt,item,i),repeat:'weekly',notes:item.notes||'',done:false,plan:'casa',planKey:item.key,planKind:KIND[item.kind]};
   if(item.kind==='week')t.date=cycleDate(today,item.day,0,1);
   else if(item.kind==='fortnight')Object.assign(t,{repeat:'custom',every:2,unit:'w',date:cycleDate(today,item.day,item.week,2)});
   else if(item.kind==='month4')Object.assign(t,{repeat:'custom',every:4,unit:'w',date:cycleDate(today,item.day,item.week,4)});
   else if(item.kind==='every')Object.assign(t,{repeat:'custom',every:item.every,unit:'m',date:plus(today,item.offset)});
   else{const d=seasonDate(item,today,inSeason);if(d<plus(today,30))inSeason++;Object.assign(t,{repeat:'yearly',date:d})}
   tasks.push(t);
  });
  return {tasks,skipped};
 }

 /* ---------- tiempo ---------- */
 const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
 function forecastDays(json){const d=json&&json.daily;if(!d||!Array.isArray(d.time))return [];return d.time.map((date,i)=>({date,code:num(d.weather_code?.[i]),max:num(d.temperature_2m_max?.[i]),min:num(d.temperature_2m_min?.[i]),rain:num(d.precipitation_probability_max?.[i]),mm:num(d.precipitation_sum?.[i]),wind:num(d.wind_speed_10m_max?.[i])})).filter(x=>validDate(x.date))}
 const isWet=d=>(d.rain??0)>=50||(d.mm??0)>=1;
 function sky(c){if(c===0)return['☀️','Despejado'];if(c===1||c===2)return['🌤️','Poco nuboso'];if(c===3)return['☁️','Nublado'];if(c===45||c===48)return['🌫️','Niebla'];if(c>=51&&c<=57)return['🌦️','Llovizna'];if(c>=61&&c<=67||c>=80&&c<=82)return['🌧️','Lluvia'];if(c>=71&&c<=77||c===85||c===86)return['🌨️','Nieve'];if(c>=95)return['⛈️','Tormenta'];return['🌡️','Previsión']}
 const OUTDOOR=/\b(tender|terraza|patio|por fuera|exterior|toldos?|canaletas?|jardin|balcon|fachada)\b/;
 const isOutdoor=t=>OUTDOOR.test(norm(t.title));
 const deg=v=>Math.round(v)+' °C';
 function findTask(state,key,re){const all=(state.tasks||[]).filter(t=>t.planKey===key||re.test(norm(t.title)));return all.find(t=>!t.done)||all[0]||null}

 // Recomendaciones del día: texto + acciones opcionales para mover una tarea a otra fecha
 function recommendations(state,days,today,h){
  const fmt=d=>h.relDate(d).toLowerCase(),recs=[],tasks=(state.tasks||[]).filter(t=>!t.done&&validDate(t.date));
  const i0=days.findIndex(d=>d.date===today);if(i0<0)return recs;
  const d0=days[i0],soon=days.slice(i0,i0+3),wetDays=new Set(days.filter(isWet).map(d=>d.date)),nextDry=days.slice(i0+1).find(d=>!isWet(d));
  const used=new Set(),act=(t,date,label)=>{used.add(t.id);return {id:t.id,date,label}};
  if(isWet(d0)){
   recs.push({icon:'🌧️',text:`Hoy hay un ${d0.rain??0} % de probabilidad de lluvia: no tiendas fuera. Usa la secadora y vacía el filtro al terminar.`,actions:[]});
   for(const t of tasks.filter(t=>t.date<=today&&isOutdoor(t)).sort(byDate).slice(0,3))recs.push({icon:'↪️',text:`«${t.title}» mejor en un día seco.`,actions:nextDry?[act(t,nextDry.date,'Pasar a '+fmt(nextDry.date))]:[]});
  }else{
   const rainSoon=days.slice(i0+1,i0+3).find(isWet);
   if(rainSoon){
    recs.push({icon:'🧺',text:`Llueve ${fmt(rainSoon.date)} (${rainSoon.rain??0} %): aprovecha hoy para tender fuera.`,actions:[]});
    for(const t of tasks.filter(t=>isOutdoor(t)&&t.date>today&&wetDays.has(t.date)).sort(byDate).slice(0,3))recs.push({icon:'☀️',text:`«${t.title}» cae en día de lluvia (${fmt(t.date)}): mejor hoy.`,actions:[act(t,today,'Hacer hoy')]});
   }else if(d0.max!==null&&d0.max>=12&&d0.max<=30&&(d0.wind??0)<30)recs.push({icon:'🪟',text:'Buen día para ventanas por fuera, la terraza y tender la ropa.',actions:[]});
  }
  const cold=soon.filter(d=>d.min!==null).sort((a,b)=>a.min-b.min)[0];
  if(cold&&(cold.min<=6||(cold.max!==null&&cold.max<=14))){
   const t=findTask(state,'radiadores-purgar',/purgar.*radiador/),purged=t&&(t.done||(t.lastDone&&t.lastDone>=plus(today,-150)));
   const when=`Entra el frío (mínima de ${deg(cold.min)} ${fmt(cold.date)})`;
   if(purged)recs.push({icon:'🔥',text:`${when}: radiadores purgados ✓. Comprueba que la caldera marca su presión habitual antes de encenderla.`,actions:[]});
   else recs.push({icon:'🔥',text:`${when}: ¿has puesto ya la calefacción? Antes, purga los radiadores y revisa la presión de la caldera.`,actions:t&&!t.done&&t.date>today?[act(t,today,'Hacer hoy')]:[]});
  }
  const frost=soon.find(d=>d.min!==null&&d.min<=0);
  if(frost)recs.push({icon:'❄️',text:`Riesgo de helada ${fmt(frost.date)} (${deg(frost.min)}): protege las plantas del patio y la terraza y no friegues fuera.`,actions:[]});
  const hot=soon.find(d=>d.max!==null&&d.max>=32);
  if(hot){const t=findTask(state,'aire-verano',/filtros? del aire/),clean=t&&t.lastDone&&t.lastDone>=plus(today,-60);recs.push({icon:'🥵',text:`Calor ${fmt(hot.date)} (${deg(hot.max)}): ventila temprano y baja las persianas al mediodía.${clean?'':' ¿Están limpios los filtros del aire acondicionado?'}`,actions:t&&!clean&&!t.done&&t.date>today?[act(t,today,'Hacer hoy')]:[]})}
  const windy=days.slice(i0,i0+2).find(d=>(d.wind??0)>=40);
  if(windy)recs.push({icon:'💨',text:`Viento fuerte ${fmt(windy.date)} (${Math.round(windy.wind)} km/h): recoge lo suelto de la terraza y no tiendas sábanas fuera.`,actions:[]});
  // Un «rincón» al día para que no se acumule la limpieza a fondo
  const corner=tasks.find(t=>t.planKind==='rincon'&&t.date===today);
  if(corner)recs.push({icon:'✨',text:`Rincón de hoy: «${corner.title}».`,actions:[]});
  else{
   const next=tasks.filter(t=>t.planKind==='rincon'&&t.date>today&&t.date<=plus(today,7)&&!used.has(t.id)&&!(isOutdoor(t)&&isWet(d0))).sort(byDate)[0];
   if(next)recs.push({icon:'✨',text:isWet(d0)?`Día de interior: puedes adelantar «${next.title}» (toca ${fmt(next.date)}).`:`Si te sobran 10 minutos: «${next.title}» (toca ${fmt(next.date)}).`,actions:[act(next,today,'Hacer hoy')]});
  }
  return recs.slice(0,7);
 }

 const api={norm,ZONES,ITEMS,buildPlan,forecastDays,isWet,isOutdoor,sky,recommendations};root.CasaHousePlan=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
