const { test } = require('node:test'), assert = require('node:assert/strict');
const P = require('../casa/house-plan.js');

const TODAY = '2026-11-18'; // miércoles
const plus = (s, n) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const wd = s => (new Date(s + 'T12:00:00Z').getUTCDay() + 6) % 7;
let n = 0; const uid = () => 'id' + (++n);
const allZones = P.ZONES.map(z => z[0]);
const relDate = d => d === TODAY ? 'Hoy' : d === plus(TODAY, 1) ? 'Mañana' : d;
const item = key => P.ITEMS.find(i => i.key === key);

test('el plan completo reparte cada tarea en su día y ciclo, desde hoy', () => {
  const { tasks } = P.buildPlan({ tasks: [] }, { zones: allZones, who: 'yo', today: TODAY, uid });
  assert.equal(tasks.length, P.ITEMS.length);
  assert.equal(new Set(tasks.map(t => t.planKey)).size, tasks.length);
  for (const t of tasks) {
    const it = item(t.planKey);
    assert.ok(t.date >= TODAY, t.planKey);
    assert.equal(t.done, false);
    assert.equal(t.plan, 'casa');
    if (it.kind === 'week') { assert.equal(t.repeat, 'weekly'); assert.equal(wd(t.date), it.day); assert.ok(t.date < plus(TODAY, 7)); }
    if (it.kind === 'fortnight') { assert.deepEqual([t.repeat, t.every, t.unit], ['custom', 2, 'w']); assert.equal(wd(t.date), it.day); assert.ok(t.date < plus(TODAY, 14)); }
    if (it.kind === 'month4') { assert.deepEqual([t.repeat, t.every, t.unit], ['custom', 4, 'w']); assert.equal(wd(t.date), it.day); assert.ok(t.date < plus(TODAY, 28)); }
    if (it.kind === 'every') { assert.deepEqual([t.repeat, t.unit], ['custom', 'm']); assert.equal(t.date, plus(TODAY, it.offset)); }
    if (it.kind === 'year') assert.equal(t.repeat, 'yearly');
  }
  const by = k => tasks.find(t => t.planKey === k).date;
  // En temporada y con la fecha ideal ya pasada: pronto, repartidas en días distintos
  for (const k of ['radiadores-purgar', 'chimenea', 'canaletas', 'caldera', 'aire-invierno']) assert.ok(by(k) > TODAY && by(k) <= plus(TODAY, 10), k);
  assert.ok(new Set(['radiadores-purgar', 'chimenea', 'canaletas', 'caldera', 'aire-invierno'].map(by)).size >= 4);
  assert.equal(by('burletes'), '2026-11-25');
  assert.equal(by('cortinas'), '2027-03-15');
  assert.equal(by('aire-verano'), '2027-05-15');
  // La semana de cada «rincón» rota: no caen todos en la misma semana
  const corners = tasks.filter(t => item(t.planKey).kind === 'month4').map(t => Math.floor((Date.parse(t.date) - Date.parse(plus(TODAY, -wd(TODAY)))) / 864e5 / 7));
  assert.ok(new Set(corners).size >= 3);
});

test('solo crea las zonas marcadas, no duplica y reparte responsables', () => {
  const only = P.buildPlan({ tasks: [] }, { zones: ['cocina'], who: 'juanma', today: TODAY, uid }).tasks;
  assert.ok(only.length > 0);
  assert.ok(only.every(t => [null, 'cocina'].includes(item(t.planKey).zone)));
  assert.ok(only.every(t => t.who === 'juanma'));
  const first = P.buildPlan({ tasks: [] }, { zones: allZones, who: 'yo', today: TODAY, uid }).tasks;
  const again = P.buildPlan({ tasks: first }, { zones: allZones, who: 'yo', today: TODAY, uid });
  assert.equal(again.tasks.length, 0);
  assert.equal(again.skipped.length, first.length);
  const own = P.buildPlan({ tasks: [{ id: 'x', title: 'Lavar las cortinas', date: '', done: false }] }, { zones: ['ventanas'], who: 'yo', today: TODAY, uid });
  assert.ok(!own.tasks.some(t => t.planKey === 'cortinas'));
  const alt = P.buildPlan({ tasks: [] }, { zones: allZones, who: 'alternar', people: ['yo', 'juanma'], today: TODAY, uid }).tasks;
  assert.equal(alt.find(t => t.planKey === 'cocina-semanal').who, 'yo');
  assert.equal(alt.find(t => t.planKey === 'bano-principal').who, 'juanma');
});

test('lee la previsión de Open-Meteo y tolera valores vacíos', () => {
  const days = P.forecastDays({ daily: { time: ['2026-11-18', 'mal'], weather_code: [80, 0], temperature_2m_max: [17.4, null], temperature_2m_min: [7.3, 1], precipitation_probability_max: [78, null], precipitation_sum: [3.2, 0], wind_speed_10m_max: [12, 5] } });
  assert.deepEqual(days, [{ date: '2026-11-18', code: 80, max: 17.4, min: 7.3, rain: 78, mm: 3.2, wind: 12 }]);
  assert.deepEqual(P.forecastDays(null), []);
  assert.equal(P.isWet({ rain: 20, mm: 0 }), false);
  assert.equal(P.isWet({ rain: 60, mm: 0 }), true);
  assert.equal(P.sky(80)[1], 'Lluvia');
  assert.equal(P.isOutdoor({ title: 'Tender la ropa' }), true);
  assert.equal(P.isOutdoor({ title: 'Rieles de las ventanas: aspirar y pasar un paño' }), false);
});

const day = (date, o) => ({ date, code: 3, max: 18, min: 9, rain: 0, mm: 0, wind: 10, ...o });

test('con lluvia hoy: no tender fuera y mover lo de exterior al próximo día seco', () => {
  const state = { tasks: [
    { id: 'terraza', title: 'Terraza: barrer y revisar los desagües', date: TODAY, done: false },
    { id: 'tender', title: 'Tender la ropa', date: plus(TODAY, -1), done: false },
    { id: 'rieles', title: 'Rieles de las ventanas', date: plus(TODAY, 3), done: false, planKind: 'rincon' },
  ] };
  const days = [day(TODAY, { rain: 80, mm: 4, code: 61 }), day(plus(TODAY, 1), { rain: 70 }), day(plus(TODAY, 2)), day(plus(TODAY, 3))];
  const recs = P.recommendations(state, days, TODAY, { relDate });
  assert.match(recs[0].text, /no tiendas fuera/);
  const moves = recs.flatMap(r => r.actions);
  assert.deepEqual(moves.filter(a => a.id !== 'rieles').map(a => [a.id, a.date]).sort(), [['tender', plus(TODAY, 2)], ['terraza', plus(TODAY, 2)]]);
  assert.ok(recs.some(r => /Día de interior/.test(r.text) && r.actions[0].id === 'rieles' && r.actions[0].date === TODAY));
  assert.ok(!recs.some(r => /Buen día/.test(r.text)));
});

test('sin lluvia hoy pero sí mañana: aprovechar hoy y adelantar lo de exterior', () => {
  const state = { tasks: [{ id: 'v', title: 'Ventanas por fuera', date: plus(TODAY, 1), done: false, planKind: 'rincon' }] };
  const days = [day(TODAY), day(plus(TODAY, 1), { rain: 90, mm: 6 }), day(plus(TODAY, 2))];
  const recs = P.recommendations(state, days, TODAY, { relDate });
  assert.match(recs[0].text, /Llueve mañana .*tender fuera/);
  assert.deepEqual(recs[1].actions, [{ id: 'v', date: TODAY, label: 'Hacer hoy' }]);
  assert.equal(recs.filter(r => r.actions.some(a => a.id === 'v')).length, 1, 'no repite la misma tarea');
});

test('día templado y seco: buen día para exterior; calor, viento y helada', () => {
  assert.ok(P.recommendations({ tasks: [] }, [day(TODAY), day(plus(TODAY, 1)), day(plus(TODAY, 2))], TODAY, { relDate }).some(r => /Buen día/.test(r.text)));
  const hot = P.recommendations({ tasks: [{ id: 'a', title: 'Aire acondicionado: limpiar los filtros antes del verano', planKey: 'aire-verano', date: plus(TODAY, 5), done: false }] }, [day(TODAY, { max: 35, min: 20 }), day(plus(TODAY, 1), { wind: 55 })], TODAY, { relDate });
  assert.ok(hot.some(r => /Calor hoy .*filtros/.test(r.text) && r.actions[0].id === 'a'));
  assert.ok(hot.some(r => /Viento fuerte mañana/.test(r.text)));
  const frost = P.recommendations({ tasks: [] }, [day(TODAY, { min: -2, max: 8 })], TODAY, { relDate });
  assert.ok(frost.some(r => /helada/.test(r.text)));
});

test('cuando entra el frío pregunta por la calefacción y los radiadores', () => {
  const t = { id: 'r', title: 'Purgar los radiadores antes de encender la calefacción', planKey: 'radiadores-purgar', repeat: 'yearly', date: plus(TODAY, 4), done: false };
  const days = [day(TODAY, { min: 9 }), day(plus(TODAY, 1), { min: 4, max: 13 }), day(plus(TODAY, 2))];
  const pending = P.recommendations({ tasks: [t] }, days, TODAY, { relDate }).find(r => r.icon === '🔥');
  assert.match(pending.text, /mínima de 4 °C mañana.*¿has puesto ya la calefacción\?/);
  assert.deepEqual(pending.actions, [{ id: 'r', date: TODAY, label: 'Hacer hoy' }]);
  const done = P.recommendations({ tasks: [{ ...t, date: '2027-10-15', lastDone: plus(TODAY, -3) }] }, days, TODAY, { relDate }).find(r => r.icon === '🔥');
  assert.match(done.text, /radiadores purgados ✓/);
  assert.deepEqual(done.actions, []);
  const noTask = P.recommendations({ tasks: [] }, days, TODAY, { relDate }).find(r => r.icon === '🔥');
  assert.match(noTask.text, /purga los radiadores/);
  assert.equal(P.recommendations({ tasks: [t] }, [day(TODAY, { min: 12, max: 22 })], TODAY, { relDate }).some(r => r.icon === '🔥'), false);
});

test('sugiere un rincón al día sin repetir y no inventa recomendaciones sin previsión de hoy', () => {
  const state = { tasks: [{ id: 'c', title: 'Cintas de las persianas: pasar un paño', date: TODAY, done: false, planKind: 'rincon' }] };
  assert.ok(P.recommendations(state, [day(TODAY)], TODAY, { relDate }).some(r => r.text === 'Rincón de hoy: «Cintas de las persianas: pasar un paño».'));
  assert.deepEqual(P.recommendations(state, [day(plus(TODAY, 1))], TODAY, { relDate }), []);
});

test('cada tarea del plan trae su consejo y las tareas propias también lo encuentran', () => {
  for (const it of P.ITEMS) if (it.tip) assert.ok(P.TIPS[it.tip], it.key);
  for (const [k, tip] of Object.entries(P.TIPS)) { assert.ok(tip.title, k); assert.ok(tip.steps.length >= 3, k); }
  assert.equal(P.tipFor({ planKey: 'rieles', title: 'Cualquier título' }).key, 'rieles');
  assert.match(P.tipFor({ planKey: 'rieles' }).steps.join(' '), /cepillo de dientes/);
  assert.equal(P.tipFor({ title: 'Limpiar los rieles del salón' }).key, 'rieles');
  assert.equal(P.tipFor({ title: 'Limpiar la cinta de la persiana' }).key, 'persianas');
  assert.equal(P.tipFor({ title: 'Purgar radiadores' }).key, 'radiadores');
  assert.equal(P.tipFor({ title: 'Llamar al fontanero' }), null);
  assert.equal(P.tipFor({ planKey: 'garaje', title: 'Garaje: barrer y ordenar' }), null);
});

test('colada: dos lavadoras y dos días de doblar entre semana, sin fin de semana', () => {
  const { tasks } = P.buildPlan({ tasks: [] }, { zones: ['ropa'], who: 'yo', today: TODAY, uid });
  const by = k => tasks.find(t => t.planKey === k);
  assert.deepEqual(['lavadora-1', 'doblar-1', 'lavadora-2', 'doblar-2'].map(k => wd(by(k).date)), [0, 1, 3, 4]);
  assert.ok(['lavadora-1', 'doblar-1', 'lavadora-2', 'doblar-2'].every(k => by(k).repeat === 'weekly'));
  assert.equal(new Set(tasks.map(t => t.title)).size, tasks.length);
});

test('el plan recuerda las zonas elegidas y propone las nuevas', () => {
  assert.deepEqual(P.defaultZones(undefined), allZones);
  const z = P.defaultZones({ chosen: ['cocina'], known: allZones.filter(id => id !== 'ropa') });
  assert.ok(z.includes('cocina') && z.includes('ropa'));
  assert.ok(!z.includes('gimnasio'));
});

test('calendario de temporada: lo que toca cada mes, pendiente o hecho', () => {
  const tasks = [
    { id: 'a', title: 'Revisar burletes', repeat: 'yearly', planKind: 'temporada', date: '2026-11-25', done: false },
    { id: 'b', title: 'Purgar radiadores', repeat: 'yearly', planKind: 'temporada', date: '2027-11-10', lastDone: '2026-11-10', done: false },
    { id: 'c', title: 'Cocina', repeat: 'weekly', planKind: 'semanal', date: '2026-11-23', done: false },
    { id: 'd', title: 'Filtros del aire', repeat: 'yearly', planKind: 'temporada', date: '2027-05-15', done: false },
  ];
  assert.deepEqual(P.monthItems({ tasks }, '2026-11').map(x => [x.task.id, x.date, x.done]), [['b', '2026-11-10', true], ['a', '2026-11-25', false]]);
  assert.deepEqual(P.monthItems({ tasks }, '2027-11').map(x => [x.task.id, x.date, x.done]), [['b', '2027-11-10', false], ['a', '2027-11-25', false]]);
  assert.deepEqual(P.monthItems({ tasks }, '2027-05').map(x => x.task.id), ['d']);
  assert.deepEqual(P.nextMonths('2026-11-18', 3), ['2026-11', '2026-12', '2027-01']);
  assert.equal(P.isSeasonal(tasks[2]), false);
});

test('el día de lavadora recomienda secadora si llueve y tender fuera si no', () => {
  const wash = { id: 'w', title: 'Poner una lavadora', date: TODAY, done: false, planKey: 'lavadora-1' };
  const wet = P.recommendations({ tasks: [wash] }, [day(TODAY, { rain: 80, mm: 3 }), day(plus(TODAY, 1))], TODAY, { relDate });
  assert.ok(wet.some(r => /Poner una lavadora.*secadora/.test(r.text) && r.tip === 'w'));
  const dry = P.recommendations({ tasks: [wash] }, [day(TODAY), day(plus(TODAY, 1)), day(plus(TODAY, 2))], TODAY, { relDate });
  assert.ok(dry.some(r => /Poner una lavadora.*tiéndela fuera/.test(r.text)));
  const before = P.recommendations({ tasks: [wash] }, [day(TODAY), day(plus(TODAY, 1), { rain: 90 })], TODAY, { relDate });
  assert.ok(before.some(r => /Llueve mañana .*Poner una lavadora.*tiende fuera/.test(r.text)));
  assert.equal(before.filter(r => /lavadora/.test(r.text)).length, 1, 'un solo aviso de colada');
});

test('tus tareas programadas encuentran su sitio en el plan', () => {
  const k = title => P.suggestKey({ title });
  assert.equal(k('Revisar plantas'), 'patio');
  assert.equal(k('Limpiar baño'), 'bano-principal');
  assert.equal(k('Limpiar baño de invitados'), 'bano-invitados');
  assert.equal(k('Cuarto: barrer'), 'dormitorio');
  assert.equal(k('Entrada limpiar'), 'entrada');
  assert.equal(k('Cocina'), 'cocina-semanal');
  assert.equal(k('Limpiar la fuente de Ringo'), 'fuente-limpiar');
  assert.equal(k('Cambiar filtro fuente Ringo'), 'fuente-filtro');
  assert.equal(k('Barrer'), '', 'si no está claro, eliges tú');
});

test('unir una tarea propia: toma el día y la frecuencia del plan y conserva lo suyo', () => {
  const state = {
    tasks: [
      { id: 'mia', title: 'Limpiar baño', date: plus(TODAY, 2), repeat: 'daily', who: 'juanma', time: '10:00', notes: 'Con guantes', lastDone: plus(TODAY, -1), done: false },
      { id: 'mia2', title: 'Baño: espejo', date: plus(TODAY, 5), repeat: 'custom', every: 3, unit: 'd', who: 'yo', done: false },
      { id: 'plan', title: 'Baño principal: inodoro, lavabo, ducha y espejo', planKey: 'bano-principal', plan: 'casa', planKind: 'semanal', date: plus(TODAY, 6), repeat: 'weekly', who: 'yo', done: false },
      { id: 'fuente', title: 'Limpiar la fuente de Ringo', date: plus(TODAY, 1), repeat: 'weekly', who: 'yo', done: false },
      { id: 'enrutina', title: 'Cocina: encimera, frente de los muebles y fregadero', planKey: 'cocina-semanal', plan: 'casa', date: TODAY, repeat: 'weekly', done: false },
      { id: 'cocina', title: 'Cocina', date: plus(TODAY, 3), repeat: 'weekly', who: 'yo', done: false },
    ],
    routines: [{ id: 'r', linkedTasks: true, taskIds: ['enrutina'] }],
  };
  const res = P.integrate(state, [{ id: 'mia', key: 'bano-principal' }, { id: 'mia2', key: 'bano-principal' }, { id: 'fuente', key: 'fuente-limpiar' }, { id: 'cocina', key: 'cocina-semanal' }], TODAY);
  const by = id => res.tasks.find(t => t.id === id);
  assert.deepEqual(res.removed, ['plan'], 'la del plan se quita para no tener dos; la que está en una rutina, no');
  assert.ok(by('enrutina'));
  const mia = by('mia');
  assert.deepEqual([mia.title, mia.who, mia.time, mia.notes, mia.lastDone], ['Limpiar baño', 'juanma', '10:00', 'Con guantes', plus(TODAY, -1)]);
  assert.deepEqual([mia.date, mia.repeat, mia.planKey, mia.planJoined, 'every' in mia], [plus(TODAY, 6), 'weekly', 'bano-principal', true, false]);
  assert.deepEqual([by('mia2').date, by('mia2').repeat, 'unit' in by('mia2')], [plus(TODAY, 6), 'weekly', false]);
  assert.equal(by('fuente').urgent, true, 'la fuente de Ringo pasa a urgente');
  assert.equal(wd(by('fuente').date), 6);
  assert.equal(by('cocina').date, TODAY, 'toma la fecha de la del plan aunque no se pueda quitar');
  const due = P.integrate({ tasks: [{ id: 'f', title: 'Limpiar la fuente de Ringo', date: TODAY, repeat: 'weekly', done: false }] }, [{ id: 'f', key: 'fuente-limpiar' }], TODAY).tasks[0];
  assert.deepEqual([due.date, due.urgent, due.planKey], [TODAY, true, 'fuente-limpiar'], 'una urgente que ya toca no se aplaza al unirla');
  assert.equal(P.integrate({ tasks: res.tasks }, [{ id: 'mia', key: 'salon' }], TODAY).changed.length, 0, 'una tarea ya unida no se vuelve a unir');
  assert.deepEqual(P.joinCandidates({ tasks: res.tasks }).map(t => t.id), []);
});

test('el plan trae la fuente de Ringo como urgente y renombra la colada antigua', () => {
  const { tasks } = P.buildPlan({ tasks: [] }, { zones: ['mascota', 'entrada'], who: 'yo', today: TODAY, uid });
  assert.deepEqual(tasks.filter(t => t.urgent).map(t => t.planKey).sort(), ['fuente-filtro', 'fuente-limpiar']);
  assert.ok(tasks.some(t => t.planKey === 'entrada'));
  assert.equal(P.tipFor({ title: 'Limpiar la fuente de Ringo' }).key, 'fuente');
  const old = { tasks: [{ id: 'a', title: 'Poner una lavadora', plan: 'casa', planKey: 'lavadora-1' }, { id: 'b', title: 'Mi colada', plan: 'casa', planKey: 'lavadora-2' }] };
  assert.deepEqual(P.legacyTitles(old), [{ id: 'a', title: 'Día de colada: poner lavadoras' }]);
  assert.equal(P.buildPlan(old, { zones: ['ropa'], who: 'yo', today: TODAY, uid }).tasks.some(t => t.planKey === 'lavadora-1'), false);
});

test('lo urgente no se puede posponer y sale primero', () => {
  const t = { id: 'u', title: 'Fuente de Ringo: cambiar el filtro', urgent: true, date: TODAY, done: false };
  assert.equal(P.blocksPostpone(t, plus(TODAY, 1), TODAY), true);
  assert.equal(P.blocksPostpone(t, TODAY, TODAY), false);
  assert.equal(P.blocksPostpone({ ...t, date: plus(TODAY, -3) }, TODAY, TODAY), false, 'pasar a hoy una atrasada sí');
  assert.equal(P.blocksPostpone({ ...t, date: plus(TODAY, 5) }, plus(TODAY, 2), TODAY), false, 'adelantar sí');
  assert.equal(P.blocksPostpone({ ...t, urgent: false }, plus(TODAY, 1), TODAY), false);
  const out = { id: 'o', title: 'Terraza: barrer', urgent: true, date: TODAY, done: false };
  const recs = P.recommendations({ tasks: [t, out] }, [day(TODAY, { rain: 90, mm: 5 }), day(plus(TODAY, 1))], TODAY, { relDate });
  assert.equal(recs[0].icon, '❗');
  assert.ok(!recs.some(r => r.actions.some(a => a.id === 'o')), 'no propone pasar lo urgente a otro día');
});

test('la colada se adapta a lo que hay en casa', () => {
  const wash = { id: 'w', title: 'Día de colada: poner lavadoras', date: TODAY, done: false };
  const L = { twoWashers: true, dryer: true, coveredLine: true, indoorLine: true };
  const rec = (d, extra = []) => P.recommendations({ tasks: [wash, ...extra] }, d, TODAY, { relDate, laundry: L });
  const wetCalm = rec([day(TODAY, { rain: 80, mm: 2, wind: 10 }), day(plus(TODAY, 1))]);
  const w1 = wetCalm.find(r => r.tip === 'w').text;
  assert.match(w1, /Pon la lavadora de arriba y la lavadora de abajo a la vez/);
  assert.match(w1, /tendedero cubierto sirve si no sopla viento/);
  assert.match(w1, /tendedero de dentro/);
  assert.match(wetCalm[0].text, /nada de tender al descubierto/);
  assert.match(rec([day(TODAY, { rain: 80, mm: 2, wind: 45 }), day(plus(TODAY, 1))]).find(r => r.tip === 'w').text, /no uses el tendedero de fuera/);
  assert.match(rec([day(TODAY), day(plus(TODAY, 1)), day(plus(TODAY, 2))]).find(r => r.tip === 'w').text, /tendedero de fuera .* al aire se seca antes/);
  // Con tendedero cubierto y poco viento, tender no se manda a otro día por la lluvia
  const tender = { id: 't', title: 'Tender la ropa', date: TODAY, done: false };
  assert.ok(!rec([day(TODAY, { rain: 80, mm: 2, wind: 10 }), day(plus(TODAY, 1))], [tender]).some(r => r.actions.some(a => a.id === 't')));
  assert.ok(P.recommendations({ tasks: [tender] }, [day(TODAY, { rain: 80, mm: 2 }), day(plus(TODAY, 1))], TODAY, { relDate }).some(r => r.actions.some(a => a.id === 't')), 'sin tendedero cubierto, sí');
});

test('dos lavadoras con nombre: una tarea por lavadora y sin duplicar las que ya había', () => {
  const L = { twoWashers: true };
  const { tasks } = P.buildPlan({ tasks: [] }, { zones: ['ropa', 'lavadero'], who: 'yo', today: TODAY, uid, laundry: L });
  const by = k => tasks.find(t => t.planKey === k);
  assert.deepEqual(['lavadora-1:1', 'lavadora-1:2', 'lavadora-2:1', 'lavadora-2:2'].map(k => by(k).title), ['Día de colada: lavadora de arriba', 'Día de colada: lavadora de abajo', 'Segundo día de colada: lavadora de arriba', 'Segundo día de colada: lavadora de abajo']);
  assert.equal(by('lavadora-1:1').date, by('lavadora-1:2').date, 'las dos el mismo día de colada');
  assert.equal(by('lavadora-filtro:1').title, 'Lavadora de arriba: limpiar el filtro y la goma de la puerta');
  assert.notEqual(by('lavadora-filtro:1').date, by('lavadora-filtro:2').date, 'el filtro de cada una, en semanas distintas');
  assert.equal(P.tipFor(by('lavadora-filtro:2')).key, 'lavadoraFiltro');
  assert.equal(P.tipFor(by('lavadora-1:2')).key, 'lavar');
  // Con una sola lavadora, como antes
  assert.ok(P.buildPlan({ tasks: [] }, { zones: ['ropa'], who: 'yo', today: TODAY, uid }).tasks.some(t => t.planKey === 'lavadora-1' && t.title === 'Día de colada: poner lavadoras'));
  // Si ya había una tarea de colada, cuenta como la de la primera lavadora: solo se crea la segunda
  const old = [{ id: 'a', title: 'Día de colada: poner lavadoras', plan: 'casa', planKey: 'lavadora-1', date: TODAY, done: false }, { id: 'b', title: 'Mi colada de los jueves', plan: 'casa', planKey: 'lavadora-2', date: TODAY, done: false }];
  const more = P.buildPlan({ tasks: old }, { zones: ['ropa'], who: 'yo', today: TODAY, uid, laundry: L }).tasks.map(t => t.planKey).sort();
  assert.deepEqual(more.filter(k => k.startsWith('lavadora')), ['lavadora-1:2', 'lavadora-2:2']);
  assert.deepEqual(P.washerUpdates({ tasks: old }, {}, L), [{ id: 'a', planKey: 'lavadora-1:1', title: 'Día de colada: lavadora de arriba' }, { id: 'b', planKey: 'lavadora-2:1' }]);
  // Cambiar los nombres renombra las tareas que no se habían cambiado a mano
  const named = [{ id: 'c', title: 'Día de colada: lavadora de abajo', plan: 'casa', planKey: 'lavadora-1:2' }];
  assert.deepEqual(P.washerUpdates({ tasks: named }, L, { twoWashers: true, names: ['Lavadora del lavadero', 'Lavadora del sótano'] }), [{ id: 'c', planKey: 'lavadora-1:2', title: 'Día de colada: lavadora del sótano' }]);
  assert.deepEqual(P.washerUpdates({ tasks: old }, {}, {}), [], 'con una sola lavadora no se toca nada');
});

test('el día de colada con dos lavadoras hay un solo aviso con las dos', () => {
  const L = { twoWashers: true, coveredLine: true };
  const tasks = [{ id: 'x', title: 'Día de colada: lavadora de arriba', planKey: 'lavadora-1:1', date: TODAY, done: false }, { id: 'y', title: 'Día de colada: lavadora de abajo', planKey: 'lavadora-1:2', date: TODAY, done: false }];
  const recs = P.recommendations({ tasks }, [day(TODAY), day(plus(TODAY, 1)), day(plus(TODAY, 2))], TODAY, { relDate, laundry: L }).filter(r => /colada/.test(r.text));
  assert.equal(recs.length, 1);
  assert.match(recs[0].text, /Hoy toca colada \(lavadora de arriba y lavadora de abajo\) y no llueve: Pon la lavadora de arriba y la lavadora de abajo a la vez\. Tiéndela en el tendedero de fuera/);
});
