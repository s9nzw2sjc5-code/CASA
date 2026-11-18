/* Pestaña Tareas: plan de limpieza de la casa, consejos, calendario de temporada y tiempo con recomendaciones.
   La previsión viene de Open-Meteo (eltiempo.es no ofrece datos que la app pueda leer);
   la ubicación se guarda en los datos privados de la casa y la previsión, solo en este móvil. */
const HOUSE_WX_CACHE='casa-weather-v1';
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
 if(!force&&c&&Date.now()-c.at<3*3600e3&&c.days.some(d=>d.date===today()))return;
 if(!force&&houseWx.failedAt&&Date.now()-houseWx.failedAt<10*60e3)return;
 houseWx.busy=true;houseWx.error='';
 houseWxFetch(place).then(days=>{try{localStorage.setItem(HOUSE_WX_CACHE,JSON.stringify({lat:place.lat,lon:place.lon,at:Date.now(),days}))}catch(e){}houseWx.failedAt=0})
  .catch(()=>{houseWx.failedAt=Date.now();houseWx.error='No se ha podido actualizar el tiempo. Revisa la conexión.'})
  .finally(()=>{houseWx.busy=false;if(ui.view==='tareas'&&ui.taskMode!=='routines')render()});
}
const houseWxLink=place=>'https://www.eltiempo.es/'+(CasaHousePlan.norm(place.name).replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'')+'.html';
const houseTipButton=(id,label='💡 Cómo hacerlo')=>`<button class="btn sec" data-act="taskTip" data-id="${esc(id)}">${esc(label)}</button>`;
function houseWxCard(){
 const place=houseWxPlace();
 if(!place)return`<section class="wx"><div class="wx-h"><b>🌦️ Tiempo y recomendaciones</b></div><p class="hint">Indica dónde está la casa para ver la previsión y qué conviene hacer cada día: no tender si va a llover, preparar la calefacción cuando llega el frío…</p><button class="btn sec" data-act="wxPlace">Añadir ubicación</button></section>`;
 houseWxRefresh(false);
 const c=houseWxFor(place),t=today(),days=c?c.days.filter(d=>d.date>=t).slice(0,5):[],temp=v=>v===null?'–':Math.round(v)+'°';
 let h=`<section class="wx" aria-label="Tiempo y recomendaciones"><div class="wx-h"><b>🌦️ ${esc(place.name)}</b><button class="link" data-act="wxPlace">Cambiar</button></div>`;
 if(!days.length)h+=`<p class="hint">${houseWx.busy?'Cargando la previsión…':esc(houseWx.error||'Todavía no hay previsión.')}</p>${houseWx.busy?'':'<button class="btn sec" data-act="wxRetry">Reintentar</button>'}`;
 else{
  h+=`<div class="wx-days">${days.map(d=>{const[ic,label]=CasaHousePlan.sky(d.code);return`<div class="wx-day${CasaHousePlan.isWet(d)?' wet':''}"><small>${d.date===t?'Hoy':esc(parse(d.date).toLocaleDateString('es-ES',{weekday:'short'}))}</small><span role="img" aria-label="${esc(label)}">${ic}</span><b>${temp(d.max)}</b><small>${temp(d.min)} · ${d.rain??0}%</small></div>`}).join('')}</div>`;
  const recs=CasaHousePlan.recommendations(S,c.days,t,{relDate});
  if(recs.length)h+=`<ul class="wx-recs">${recs.map(r=>{const tipTask=r.tip&&S.tasks.find(x=>x.id===r.tip);return`<li><span aria-hidden="true">${r.icon}</span><div><p>${esc(r.text)}</p>${r.actions.map(a=>`<button class="btn sec" data-act="wxMove" data-id="${esc(a.id)}" data-date="${esc(a.date)}">${esc(a.label)}</button>`).join('')}${tipTask&&CasaHousePlan.tipFor(tipTask)?houseTipButton(tipTask.id):''}</div></li>`}).join('')}</ul>`;
  if(houseWx.error)h+=`<p class="hint">${esc(houseWx.error)}</p>`;
 }
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
function housePlanSheet(){
 const who=[...S.people.map(p=>[p.id,p.name]),[BOTH.id,BOTH.name],['alternar','Repartir entre personas por días']],existing=S.tasks.filter(t=>t.plan==='casa').length,on=new Set(CasaHousePlan.defaultZones(S.cook?.housePlanZones));
 const ov=sheet('Plan de limpieza de la casa',`<p class="hint">Crea tareas repetidas para que la casa se limpie poco a poco: algo breve cada día, dos lavadoras y dos días de doblar ropa entre semana, un «rincón» que rota cada semana (rieles, cintas de las persianas, campana…) y los mantenimientos de cada temporada (radiadores, aire acondicionado, secadora, canaletas…). Cada una trae su consejo 💡. Después puedes editarlas o moverlas como cualquier tarea.</p>${existing?`<p class="hint">Ya tienes ${existing} tareas del plan: solo se añadirán las que falten.</p>`:''}<label>Zonas que tiene la casa</label><div class="home-checklist plan-zones">${CasaHousePlan.ZONES.map(([id,l])=>`<label><input type="checkbox" data-plan-zone="${id}" ${on.has(id)?'checked':''}><span>${esc(l)}</span></label>`).join('')}</div><label for="planWho">Responsable</label><select class="field" id="planWho">${opt(who,S.people[0]?.id||'yo')}</select><p class="plan-count" data-plan-count role="status" aria-live="polite"></p>`,{saveLabel:'Crear tareas',autoFocus:false,onSave:o=>{
  const plan=build(),zones=checked();
  // Recuerda las zonas para que, al volver a abrir el plan, solo se propongan las nuevas
  S.cook={...(S.cook||{}),housePlanZones:{chosen:zones,known:CasaHousePlan.ZONES.map(z=>z[0])}};
  if(!plan.tasks.length){save();toast('No hay tareas nuevas que crear');return}
  S.tasks.push(...plan.tasks);save();toastUndo(plan.tasks.length+' tareas del plan creadas',6000);
 }});
 const checked=()=>[...ov.querySelectorAll('[data-plan-zone]:checked')].map(x=>x.dataset.planZone);
 function build(){return CasaHousePlan.buildPlan(S,{zones:checked(),who:val(ov,'planWho'),people:S.people.map(p=>p.id),today:today(),uid})}
 function draw(){const p=build(),n=k=>p.tasks.filter(t=>t.planKind===k).length;ov.querySelector('[data-plan-count]').textContent=p.tasks.length?`Se crearán ${p.tasks.length} tareas: ${n('semanal')} de cada semana, ${n('rincon')} rincones que rotan y ${n('temporada')} de temporada.`:'No hay tareas nuevas que crear con estas zonas.'}
 ov.addEventListener('change',draw);draw();return ov;
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
 return items.length?`<ul class="season-list">${items.map(x=>{const p=person(x.task.who);return`<li class="${x.done?'is-done':''}"><button type="button" data-act="editTask" data-id="${esc(x.task.id)}"><span>${x.done?'✓':'○'}</span><span><b>${esc(x.task.title)}</b><small>${x.done?'Hecho el '+esc(parse(x.date).toLocaleDateString('es-ES',{day:'numeric',month:'long'})):esc(relDate(x.date))}${p?' · '+esc(p.name):''}</small></span></button>${CasaHousePlan.tipFor(x.task)?`<button type="button" class="tipbtn" data-act="taskTip" data-id="${esc(x.task.id)}" aria-label="Cómo hacer ${esc(x.task.title)}">💡</button>`:''}</li>`}).join('')}</ul>`:'<p class="hint">Este mes no hay mantenimientos de temporada.</p>';
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
 tipsLibrary:()=>houseTipsLibrary(),
 taskTip:d=>{const t=S.tasks.find(x=>x.id===d.id);if(t)houseTipSheet(t)},
 seasonAll:()=>{ui.seasonAll=!ui.seasonAll;render()},
 wxPlace:()=>houseWxPlaceSheet(),
 wxRetry:()=>{houseWx.failedAt=0;houseWxRefresh(true);render()},
 wxMove:d=>{const t=S.tasks.find(x=>x.id===d.id);if(!t||!shiftTasks([d.id],d.date))return;save();toastUndo(`«${t.title}» pasada a ${relDate(d.date).toLowerCase()}`)}
};
