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
