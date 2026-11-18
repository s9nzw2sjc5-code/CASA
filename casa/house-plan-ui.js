/* Pestaña Tareas: plan de limpieza de la casa, consejos, calendario de temporada y tiempo con recomendaciones.
   La previsión viene de Open-Meteo (eltiempo.es no ofrece datos que la app pueda leer);
   la ubicación se guarda en los datos privados de la casa y la previsión, solo en este móvil. */
const HOUSE_WX_CACHE='casa-weather-v1';
// La previsión se pide de nuevo cada hora (al abrir o refrescar Hoy o Tareas) y al tocar 🔄
const HOUSE_WX_EVERY=3600e3;
const houseWx={busy:false,failedAt:0,error:''};
function houseWxPlace(){const p=S.cook&&S.cook.homeWeather;return p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)?p:null}
function houseWxFor(place){try{const c=JSON.parse(localStorage.getItem(HOUSE_WX_CACHE)||'null');return c&&Array.isArray(c.days)&&place&&c.lat===place.lat&&c.lon===place.lon?c:null}catch(e){return null}}
async function houseWxFetch(place){
 const url='https://api.open-meteo.com/v1/forecast?latitude='+place.lat+'&longitude='+place.lon+'&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max&timezone=auto&forecast_days=7';
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),10000);
 try{const res=await fetch(url,{signal:ctl.signal});if(!res.ok)throw Error('HTTP '+res.status);const days=CasaHousePlan.forecastDays(await res.json());if(!days.length)throw Error('Sin datos');return days}finally{clearTimeout(timer)}
}
// Pide la previsión si no hay una de hoy de hace menos de 3 horas; tras un fallo espera 10 minutos
function houseWxRefresh(force){
 const place=houseWxPlace();if(!place||houseWx.busy)return;
 const c=houseWxFor(place);
 if(!force&&c&&Date.now()-c.at<HOUSE_WX_EVERY&&c.days.some(d=>d.date===today()))return;
 if(!force&&houseWx.failedAt&&Date.now()-houseWx.failedAt<10*60e3)return;
 houseWx.busy=true;houseWx.error='';
 houseWxFetch(place).then(days=>{try{localStorage.setItem(HOUSE_WX_CACHE,JSON.stringify({lat:place.lat,lon:place.lon,at:Date.now(),days}))}catch(e){}houseWx.failedAt=0})
  .then(()=>{if(force)toast('Tiempo actualizado')})
  .catch(()=>{houseWx.failedAt=Date.now();houseWx.error='No se ha podido actualizar el tiempo. Revisa la conexión.';if(force)toast(houseWx.error)})
  .finally(()=>{houseWx.busy=false;if(ui.view==='hoy'||ui.view==='tareas'&&ui.taskMode!=='routines')render()});
}
// «hace 5 min», «hace 2 h»…
const houseWxAge=at=>{const m=Math.max(0,Math.round((Date.now()-at)/60000));return m<1?'ahora':m<60?'hace '+m+' min':'hace '+Math.round(m/60)+' h'};
const houseWxLink=place=>'https://www.eltiempo.es/'+(CasaHousePlan.norm(place.name).replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'')+'.html';
const houseTipButton=id=>`<button class="tip-inline" data-act="taskTip" data-id="${esc(id)}" aria-label="Cómo hacerlo" title="Cómo hacerlo">💡</button>`;
// mode: 'forecast' = solo la previsión (Hoy) · 'tips' = solo los consejos de tareas según el tiempo (Tareas) · sin mode = todo
function houseWxCard(mode){
 const place=houseWxPlace();
 if(!place)return`<section class="wx"><div class="wx-h"><b>🌦️ Tiempo y recomendaciones</b></div><p class="hint">Indica dónde está la casa para ver la previsión y qué conviene hacer cada día: no tender si va a llover, preparar la calefacción cuando llega el frío…</p><button class="btn sec" data-act="wxPlace">Añadir ubicación</button></section>`;
 houseWxRefresh(false);
 const c=houseWxFor(place),t=today(),days=c?c.days.filter(d=>d.date>=t).slice(0,5):[],temp=v=>v===null?'–':Math.round(v)+'°';
 let h=mode==='tips'?`<section class="wx wx-tips" aria-label="Consejos según el tiempo"><div class="wx-h"><b>🌦️ Consejos según el tiempo</b></div>`:`<section class="wx" aria-label="Tiempo y recomendaciones"><div class="wx-h"><b>🌦️ ${esc(place.name)}</b><button class="wx-sync${houseWx.busy?' spin':''}" data-act="wxRetry" aria-label="Actualizar el tiempo" title="Actualizar el tiempo"${houseWx.busy?' disabled':''}>🔄</button><small class="wx-age">${houseWx.busy?'Actualizando…':c?esc(houseWxAge(c.at)):''}</small><button class="link" data-act="wxPlace">Cambiar</button></div>`;
 if(!days.length)h+=`<p class="hint">${houseWx.busy?'Cargando la previsión…':esc(houseWx.error||'Todavía no hay previsión.')}</p>${houseWx.busy?'':'<button class="btn sec" data-act="wxRetry">Reintentar</button>'}`;
 else{
  if(mode!=='tips')h+=`<div class="wx-days">${days.map(d=>{const[ic,label]=CasaHousePlan.sky(d.code);return`<div class="wx-day${CasaHousePlan.isWet(d)?' wet':''}"><small>${d.date===t?'Hoy':esc(parse(d.date).toLocaleDateString('es-ES',{weekday:'short'}))}</small><span role="img" aria-label="${esc(label)}">${ic}</span><b>${temp(d.max)}</b><small>${temp(d.min)} · ${d.rain??0}%</small></div>`}).join('')}</div>`;
  const recs=CasaHousePlan.recommendations(S,c.days,t,{relDate,laundry:S.cook?.houseLaundry});
  if(mode==='tips'&&!recs.length)h+=`<p class="hint">Hoy el tiempo no cambia nada de tus tareas.</p>`;
  if(recs.length&&mode!=='forecast')h+=`<ul class="wx-recs">${recs.map(r=>{const tipTask=r.tip&&S.tasks.find(x=>x.id===r.tip);return`<li><span aria-hidden="true">${r.icon}</span><div><p>${esc(r.text)}</p>${r.actions.map(a=>`<button class="btn sec" data-act="wxMove" data-id="${esc(a.id)}" data-date="${esc(a.date)}">${esc(a.label)}</button>`).join('')}${tipTask&&CasaHousePlan.tipFor(tipTask)?houseTipButton(tipTask.id):''}</div></li>`}).join('')}</ul>`;
  if(houseWx.error)h+=`<p class="hint">${esc(houseWx.error)}</p>`;
 }
 if(mode==='tips')return h+'</section>';
 return h+`<p class="wx-src">Previsión de <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a> · <a href="${esc(houseWxLink(place))}" target="_blank" rel="noopener">Ver en eltiempo.es</a></p></section>`;
}
function houseWxPlaceSheet(){
 const cur=houseWxPlace();
 const ov=sheet('¿Dónde está la casa?',`<p class="hint">Solo se usa para pedir la previsión del tiempo. Se guarda en los datos privados de la casa, para los dos móviles.</p><label for="wxQ">Ciudad o pueblo</label><div style="display:flex;gap:8px"><input class="field" id="wxQ" value="${esc(cur?.name||'')}" placeholder="Escribe el nombre" enterkeyhint="search" autocomplete="off"><button type="button" class="btn" data-wx-search>Buscar</button></div><div class="wx-results" data-wx-results role="status" aria-live="polite"></div>`,{});
 const box=ov.querySelector('[data-wx-results]');let results=[];
 async function search(){
  const q=ov.querySelector('#wxQ').value.trim();if(q.length<2){box.innerHTML='<p class="hint">Escribe al menos dos letras.</p>';return}
  box.innerHTML='<p class="hint">Buscando…</p>';
  try{const res=await fetch('https://geocoding-api.open-meteo.com/v1/search?count=6&language=es&format=json&name='+encodeURIComponent(q));if(!res.ok)throw Error();results=((await res.json()).results||[]).filter(r=>Number.isFinite(r.latitude)&&Number.isFinite(r.longitude));
   box.innerHTML=results.length?results.map((r,i)=>`<button type="button" class="wx-pick" data-wx-pick="${i}"><b>${esc(r.name)}</b><small>${esc([r.admin2,r.admin1,r.country].filter(Boolean).join(' · '))}</small></button>`).join(''):'<p class="hint">No se ha encontrado. Prueba con otro nombre.</p>'}
  catch(e){box.innerHTML='<p class="hint">No hay conexión para buscar. Inténtalo más tarde.</p>'}
 }
 ov.querySelector('[data-wx-search]').onclick=search;
 ov.querySelector('#wxQ').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();search()}});
 box.addEventListener('click',e=>{
  const b=e.target.closest('[data-wx-pick]');if(!b)return;const r=results[Number(b.dataset.wxPick)];if(!r)return;
  // Dos decimales (≈1 km) bastan para la previsión
  S.cook={...(S.cook||{}),homeWeather:{name:String(r.name).slice(0,80),region:String(r.admin1||'').slice(0,80),lat:Math.round(r.latitude*100)/100,lon:Math.round(r.longitude*100)/100}};
  ov.remove();houseWx.failedAt=0;save();houseWxRefresh(true);toast('Ubicación guardada');
 });
 return ov;
}
// Tareas propias que ya existen para la fuente de Ringo (en Tareas o en los cuidados de Ringo)
const houseHasFountain=()=>[...S.tasks.filter(t=>!t.planKey).map(t=>t.title),...(S.pet||[]).map(x=>x.name)].some(s=>/fuente/.test(CasaHousePlan.norm(s)));
function housePlanSheet(){
 const who=[...S.people.map(p=>[p.id,p.name]),[BOTH.id,BOTH.name],['alternar','Repartir entre personas por días']],existing=S.tasks.filter(t=>t.plan==='casa').length,saved=S.cook?.housePlanZones,on=new Set(CasaHousePlan.defaultZones(saved));
 // Si ya tiene la fuente de Ringo apuntada, no se propone por defecto para no duplicarla
 if(!saved&&houseHasFountain())on.delete('mascota');
 const joinable=CasaHousePlan.joinCandidates(S).filter(t=>CasaHousePlan.suggestKey(t)).length,laundry=S.cook?.houseLaundry||{},washers=CasaHousePlan.washerNames(laundry);
 const ov=sheet('Plan de limpieza de la casa',`<p class="hint">Crea tareas repetidas para que la casa se limpie poco a poco: algo breve cada día, dos días de colada y dos de doblar ropa entre semana, un «rincón» que rota cada semana (rieles, cintas de las persianas, campana…) y los mantenimientos de cada temporada (radiadores, aire acondicionado, secadora, canaletas…). Cada una trae su consejo 💡. Después puedes editarlas o moverlas como cualquier tarea.</p>${joinable?`<div class="plan-join"><p><b>Tienes ${joinable} tarea${joinable===1?'':'s'} tuya${joinable===1?'':'s'} que encaja${joinable===1?'':'n'} en el plan.</b> Únelas primero: se reparten como el plan y no se duplican.</p><button type="button" class="btn sec" data-plan-join>🔗 Unir mis tareas al plan</button></div>`:''}${existing?`<p class="hint">Ya tienes ${existing} tareas del plan: solo se añadirán las que falten.</p>`:''}<label>Zonas que tiene la casa</label><div class="home-checklist plan-zones">${CasaHousePlan.ZONES.map(([id,l])=>`<label><input type="checkbox" data-plan-zone="${id}" ${on.has(id)?'checked':''}><span>${esc(l)}${id==='mascota'?'<small>Limpieza semanal y filtro cada 4 semanas, marcadas como urgentes ❗</small>':''}</span></label>`).join('')}</div>${houseHasFountain()?'<p class="hint">Ya tienes apuntada la fuente de Ringo. Si no la añades aquí, márcala como urgente ❗ en su tarea o cuidado.</p>':''}<label>Para la colada tenéis</label><div class="home-checklist plan-laundry">${CasaHousePlan.LAUNDRY.map(([k,l])=>`<label><input type="checkbox" data-laundry="${k}" ${laundry[k]?'checked':''}><span>${esc(l)}</span></label>`).join('')}</div><div class="plan-washers" data-washer-names ${laundry.twoWashers?'':'hidden'}><label for="washer1">Nombre de cada lavadora</label><input class="field" id="washer1" maxlength="40" value="${esc(washers[0])}" aria-label="Primera lavadora"><input class="field" id="washer2" maxlength="40" value="${esc(washers[1])}" aria-label="Segunda lavadora"><p class="hint">Cada una tendrá sus días de colada y su limpieza de filtro.</p></div><p class="hint">Con esto, la tarjeta del tiempo te dice dónde tender cada día.</p><label for="planWho">Responsable</label><select class="field" id="planWho">${opt(who,S.people[0]?.id||'yo')}</select><p class="plan-count" data-plan-count role="status" aria-live="polite"></p>`,{saveLabel:'Crear tareas',autoFocus:false,onSave:o=>{
  const plan=build(),zones=checked(),before=S.cook?.houseLaundry,after=laundryNow(),renamed=CasaHousePlan.legacyTitles(S);
  // Recuerda zonas y colada para que, al volver a abrir el plan, solo se propongan las nuevas
  S.cook={...(S.cook||{}),housePlanZones:{chosen:zones,known:CasaHousePlan.ZONES.map(z=>z[0])},houseLaundry:after};
  for(const r of renamed){const t=S.tasks.find(x=>x.id===r.id);if(t)t.title=r.title}
  // Con dos lavadoras, las tareas de colada que ya había pasan a la primera; si cambian los nombres, se renombran
  const washerChanges=CasaHousePlan.washerUpdates(S,before,after);
  for(const u of washerChanges){const t=S.tasks.find(x=>x.id===u.id);if(t){t.planKey=u.planKey;if(u.title)t.title=u.title}}
  renamed.push(...washerChanges);
  if(!plan.tasks.length){save();toast(renamed.length?'Plan actualizado':'No hay tareas nuevas que crear');return}
  S.tasks.push(...plan.tasks);save();toastUndo(plan.tasks.length+' tareas del plan creadas',6000);
 }});
 ov.querySelector('[data-plan-join]')?.addEventListener('click',()=>{ov.remove();houseJoinSheet()});
 const checked=()=>[...ov.querySelectorAll('[data-plan-zone]:checked')].map(x=>x.dataset.planZone);
 function laundryNow(){const o=Object.fromEntries([...ov.querySelectorAll('[data-laundry]')].map(x=>[x.dataset.laundry,x.checked]));o.names=[val(ov,'washer1')||CasaHousePlan.WASHER_NAMES[0],val(ov,'washer2')||CasaHousePlan.WASHER_NAMES[1]];return o}
 function build(){return CasaHousePlan.buildPlan(S,{zones:checked(),who:val(ov,'planWho'),people:S.people.map(p=>p.id),today:today(),uid,laundry:laundryNow()})}
 function draw(){ov.querySelector('[data-washer-names]').hidden=!ov.querySelector('[data-laundry="twoWashers"]').checked;const p=build(),n=k=>p.tasks.filter(t=>t.planKind===k).length;ov.querySelector('[data-plan-count]').textContent=p.tasks.length?`Se crearán ${p.tasks.length} tareas: ${n('semanal')} de cada semana, ${n('rincon')} rincones que rotan y ${n('temporada')} de temporada.`:'No hay tareas nuevas que crear con estas zonas.'}
 ov.addEventListener('change',draw);draw();return ov;
}
/* ---------- unir tareas propias al plan ---------- */
const HOUSE_WD=['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
function houseItemWhen(item){
 if(item.kind==='week')return'Cada '+HOUSE_WD[item.day];
 if(item.kind==='fortnight')return'Cada 2 semanas, el '+HOUSE_WD[item.day];
 if(item.kind==='month4')return'Cada 4 semanas, el '+HOUSE_WD[item.day];
 if(item.kind==='every')return'Cada '+item.every+' meses';
 return'Cada año, en '+new Date(2000,item.month-1,1).toLocaleDateString('es-ES',{month:'long'});
}
function houseJoinSheet(){
 const all=CasaHousePlan.joinCandidates(S).sort((a,b)=>(CasaHousePlan.suggestKey(a)?0:1)-(CasaHousePlan.suggestKey(b)?0:1)||a.title.localeCompare(b.title,'es'));
 if(!all.length){toast('No tienes tareas programadas para unir al plan');return}
 const picks=new Map(all.map(t=>[t.id,CasaHousePlan.suggestKey(t)]));let showAll=false;
 const groups=[['week','Cada semana'],['fortnight','Cada 2 semanas'],['month4','Rincones (cada 4 semanas)'],['every','Cada pocos meses'],['year','De temporada']];
 const options=sel=>`<option value="">No unir: dejarla como está</option>${groups.map(([k,l])=>`<optgroup label="${esc(l)}">${CasaHousePlan.ITEMS.filter(i=>i.kind===k).map(i=>`<option value="${esc(i.key)}" ${i.key===sel?'selected':''}>${esc(i.title)}</option>`).join('')}</optgroup>`).join('')}`;
 const ov=sheet('Unir mis tareas al plan',`<p class="hint">Cada tarea que unas pasa al día y la frecuencia del plan. Conserva su nombre, responsable, hora, notas, historial y rutinas. Si el plan ya tenía esa tarea, se quita la del plan para que no haya dos.</p><label class="home-show-all"><input type="checkbox" data-join-all> Ver también las que no encajan</label><div class="join-list" data-join-list></div><p class="plan-count" data-join-count role="status" aria-live="polite"></p>`,{saveLabel:'Unir al plan',autoFocus:false,onSave:()=>{
  const chosen=[...picks].filter(([,k])=>k).map(([id,key])=>({id,key}));if(!chosen.length){toast('Elige al menos una tarea');return false}
  const res=CasaHousePlan.integrate(S,chosen,today());if(!res.changed.length){toast('Las tareas han cambiado. Ábrelo de nuevo.');return false}
  S.tasks=res.tasks;
  // Las rutinas vinculadas siguen la nueva fecha de sus tareas
  const ids=new Set(res.changed);(S.routines||[]).forEach(r=>{if(r.linkedTasks&&!r.archived&&(r.taskIds||[]).some(id=>ids.has(id)))r.date=CasaCleaningLinks.effectiveDate(S,r)});
  save();toastUndo(`${res.changed.length} tarea${res.changed.length===1?' unida':'s unidas'} al plan${res.removed.length?` · ${res.removed.length} repetida${res.removed.length===1?'':'s'} quitada${res.removed.length===1?'':'s'}`:''}`,6000);
 }});
 function draw(){
  const rows=all.filter(t=>showAll||CasaHousePlan.suggestKey(t)||picks.get(t.id));
  ov.querySelector('[data-join-list]').innerHTML=rows.map(t=>{const key=picks.get(t.id),item=CasaHousePlan.ITEMS.find(i=>i.key===key),p=person(t.who);return`<div class="join-row"><b>${esc(t.title)}</b><small>Ahora: ${esc(relDate(t.date))}${t.repeat&&t.repeat!=='none'?' · '+esc(repLabel(t)):''}${p?' · '+esc(p.name):''}</small><label class="sr-only" for="join-${esc(t.id)}">Unir «${esc(t.title)}» con</label><select class="field" id="join-${esc(t.id)}" data-join="${esc(t.id)}">${options(key)}</select>${item?`<small class="join-to">→ ${esc(houseItemWhen(item))}${item.urgent?' · ❗ urgente':''}${(item.urgent||t.urgent)&&t.date<=today()?' · como ya toca, se queda para '+esc(relDate(t.date).toLowerCase()):''}</small>`:''}</div>`}).join('')||'<p class="hint">Ninguna de tus tareas encaja con el plan. Marca «Ver también las que no encajan» para elegir tú.</p>';
  const n=[...picks.values()].filter(Boolean).length;ov.querySelector('[data-join-count]').textContent=n?`Se unirán ${n} tarea${n===1?'':'s'} al plan.`:'No hay ninguna tarea elegida.';
 }
 ov.addEventListener('change',e=>{if(e.target.matches('[data-join]')){picks.set(e.target.dataset.join,e.target.value);draw()}else if(e.target.matches('[data-join-all]')){showAll=e.target.checked;draw()}});
 draw();return ov;
}
/* ---------- todo en Tareas ---------- */
// Recordatorios, mantenimientos y rutinas antiguas pasan a Tareas una sola vez, con copia de seguridad antes.
// Devuelve true si ha guardado (y, por tanto, ya se ha vuelto a pintar).
function houseUnify(){
 if(houseUnify.busy||!CasaHousePlan.needsUnify(S)||(typeof canWrite!=='undefined'&&!canWrite)||syncState==='ro')return false;
 houseUnify.busy=true;
 try{
  const id='antes-de-tareas-'+Date.now(),before=clone(S);saveLocalBackup(id,before,'Antes de pasar todo a Tareas');cloudBackup(id,before,'Antes de pasar todo a Tareas');
  const r=CasaHousePlan.unifyTasks(S,today());S.tasks=r.tasks;S.reminders=r.reminders;S.routines=r.routines;save();
  const n=r.moved.reminders+r.moved.steps,d=r.moved.duplicates;
  if(n||d)setTimeout(()=>toast([n?`Ahora todo está en Tareas: ${n} ${n===1?'elemento pasado':'elementos pasados'}`:'',d?`${d} ${d===1?'tarea repetida quitada':'tareas repetidas quitadas'}`:''].filter(Boolean).join(' · ')+' (hay copia de seguridad)'),0);
  return true;
 }finally{houseUnify.busy=false}
}
// Rutinas con el mismo nombre (p. ej. muchas «Limpieza semanal») se juntan en una, con copia antes.
// Devuelve true si ha guardado (y, por tanto, ya se ha vuelto a pintar).
function houseMergeRoutines(){
 if(houseMergeRoutines.busy||(typeof canWrite!=='undefined'&&!canWrite)||syncState==='ro')return false;
 const r=CasaCleaningLinks.mergeSameTitle(S);if(!r.merged)return false;
 houseMergeRoutines.busy=true;
 try{const id='antes-de-juntar-rutinas-'+Date.now(),before=clone(S);saveLocalBackup(id,before,'Antes de juntar rutinas');cloudBackup(id,before,'Antes de juntar rutinas');
  S.routines=r.routines;save();setTimeout(()=>toast(`Rutinas de limpieza agrupadas: ${r.merged} repetida${r.merged===1?'':'s'} unida${r.merged===1?'':'s'} (hay copia de seguridad)`),0);return true}
 finally{houseMergeRoutines.busy=false}
}
// Una sola vez: las tareas del plan ya creadas pasan a su nuevo día (lo corto entre semana, lo largo el fin de semana).
// Queda marcado en S.cook para no volver a mover lo que se cambie luego a mano.
const PLAN_DAYS_V=2;
function housePlanRebalance(){
 if(housePlanRebalance.busy||(typeof canWrite!=='undefined'&&!canWrite)||syncState==='ro')return false;
 if((S.cook?.planDays||0)>=PLAN_DAYS_V||!(S.tasks||[]).some(t=>t.plan==='casa'&&!t.done))return false;
 S.cook=S.cook||{};
 const ups=CasaHousePlan.rebalance(S,today());
 // Si ya está todo en su día, solo se apunta (se guarda con el siguiente cambio) para no estorbar a «Deshacer»
 if(!ups.length){S.cook.planDays=PLAN_DAYS_V;return false}
 housePlanRebalance.busy=true;
 try{
  if(ups.length){const id='antes-de-repartir-por-dias-'+Date.now(),before=clone(S);saveLocalBackup(id,before,'Antes de repartir el plan por días');cloudBackup(id,before,'Antes de repartir el plan por días');
   const by=new Map(ups.map(u=>[u.id,u.date]));S.tasks.forEach(t=>{if(by.has(t.id))t.date=by.get(t.id)});
   (S.routines||[]).forEach(r=>{if(r.linkedTasks&&!r.archived&&(r.taskIds||[]).some(id=>by.has(id)))r.date=CasaCleaningLinks.effectiveDate(S,r)})}
  S.cook.planDays=PLAN_DAYS_V;save();
  if(ups.length)setTimeout(()=>toast(`Plan de la casa repartido: entre semana lo corto y lo largo el fin de semana · ${ups.length} tarea${ups.length===1?'':'s'} cambiada${ups.length===1?'':'s'} de día (hay copia de seguridad)`,null,7000),0);
  return true;
 }finally{housePlanRebalance.busy=false}
}
/* ---------- consejos ---------- */
const houseTipSteps=tip=>`<ol class="tip-steps">${tip.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>`;
function houseTipSheet(task){const tip=CasaHousePlan.tipFor(task);if(!tip)return;const ov=sheet('💡 '+tip.title,`<p class="hint">${esc(task.title)}</p>${houseTipSteps(tip)}<button type="button" class="link" data-tips-all>Ver todos los consejos</button>`,{autoFocus:false});ov.querySelector('[data-s=cancel]').textContent='Cerrar';ov.querySelector('[data-tips-all]').onclick=()=>{ov.remove();houseTipsLibrary()};return ov}
function houseTipsLibrary(){
 const tips=Object.entries(CasaHousePlan.TIPS).sort((a,b)=>a[1].title.localeCompare(b[1].title,'es'));
 const ov=sheet('💡 Consejos de limpieza',`<p class="hint">Cómo hacer cada tarea sin esfuerzo de más. Toca una para verla.</p><div class="tips-lib">${tips.map(([k,tip])=>`<details data-tip="${esc(k)}"><summary>${esc(tip.title)}</summary>${houseTipSteps(tip)}</details>`).join('')}</div>`,{autoFocus:false});
 ov.querySelector('[data-s=cancel]').textContent='Cerrar';return ov;
}
/* ---------- calendario de temporada ---------- */
const houseMonthName=ym=>{const s=new Date(Number(ym.slice(0,4)),Number(ym.slice(5,7))-1,1).toLocaleDateString('es-ES',{month:'long',year:'numeric'});return s.charAt(0).toUpperCase()+s.slice(1)};
function houseMonthList(ym){
 const items=CasaHousePlan.monthItems(S,ym).filter(x=>forPerson(x.task));
 return items.length?`<ul class="season-list">${items.map(x=>{const p=person(x.task.who);// Casilla para marcarla hecha (o desmarcar una tarea suelta ya hecha); lo hecho en años anteriores o previsto para otro año solo se muestra
  const canToggle=x.done?!!x.task.done:x.date===x.task.date,label=x.done?'Desmarcar '+x.task.title:'Marcar hecha: '+x.task.title;
  const check=`<button type="button" class="check round season-check ${x.done?'on':''}" ${canToggle?`data-act="toggleTask" data-id="${esc(x.task.id)}" aria-label="${esc(label)}"`:`disabled aria-label="${x.done?'Hecha':'Prevista'}"`}></button>`;
  return`<li class="${x.done?'is-done':''}">${check}<button type="button" class="season-main" data-act="editTask" data-id="${esc(x.task.id)}"><span><b>${esc(x.task.title)}</b><small>${x.done?'Hecho el '+esc(parse(x.date).toLocaleDateString('es-ES',{day:'numeric',month:'long'})):esc(relDate(x.date))}</small></span></button>${CasaHousePlan.tipFor(x.task)?`<button type="button" class="tipbtn" data-act="taskTip" data-id="${esc(x.task.id)}" aria-label="Cómo hacer ${esc(x.task.title)}">💡</button>`:''}</li>`}).join('')}</ul>`:'<p class="hint">Este mes no hay mantenimientos de temporada.</p>';
}
// Tareas: resumen por meses, como una guía del año (las tareas siguen en su sección por fecha)
function houseSeasonSection(){
 if(!S.tasks.some(CasaHousePlan.isSeasonal))return`<section class="season"><div class="head-row"><h2>🗓️ Calendario de temporada</h2></div><p class="hint">Crea el plan de limpieza para ver aquí lo que toca cada mes: radiadores antes del frío, filtros del aire antes del verano…</p><button class="btn sec" data-act="housePlan">🧽 Crear el plan de limpieza</button></section>`;
 const months=CasaHousePlan.nextMonths(today(),ui.seasonAll?12:3);
 return`<section class="season"><div class="head-row"><h2>🗓️ Calendario de temporada</h2><button class="link" data-act="seasonAll">${ui.seasonAll?'Ver menos':'Todo el año'}</button></div><p class="hint">Lo que toca cada mes. También aparece en el Calendario.</p>${months.map((ym,i)=>`<h3 class="season-m">${i===0?'Este mes · ':''}${esc(houseMonthName(ym))}</h3>${houseMonthList(ym)}`).join('')}</section>`;
}
// Calendario (vista de mes): lo que toca en el mes que se está viendo
function houseMonthSection(ym){
 if(!S.tasks.some(CasaHousePlan.isSeasonal))return'';
 return`<section class="season"><div class="head-row"><h2>🗓️ En ${esc(houseMonthName(ym).toLowerCase())} toca</h2></div>${houseMonthList(ym)}</section>`;
}
const HOUSE_ACT={
 housePlan:()=>housePlanSheet(),
 houseJoin:()=>houseJoinSheet(),
 tipsLibrary:()=>houseTipsLibrary(),
 taskTip:d=>{const t=S.tasks.find(x=>x.id===d.id);if(t)houseTipSheet(t)},
 seasonAll:()=>{ui.seasonAll=!ui.seasonAll;render()},
 wxPlace:()=>houseWxPlaceSheet(),
 wxRetry:()=>{houseWx.failedAt=0;houseWxRefresh(true);render()},
 wxMove:d=>{const t=S.tasks.find(x=>x.id===d.id);if(!t)return;const r=shiftTasks([d.id],d.date);if(r.blocked){toast('Es urgente ❗: no se puede posponer');return}if(!r.moved)return;save();toastUndo(`«${t.title}» pasada a ${relDate(d.date).toLowerCase()}`)}
};
