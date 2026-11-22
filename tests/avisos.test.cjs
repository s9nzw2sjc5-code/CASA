const { test } = require('node:test'), assert = require('node:assert/strict'), A = require('../casa/avisos.js');
const add = (s, n) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
// Un día futuro para que todas las horas estén por venir
const D = add(new Date().toISOString().slice(0, 10), 5), D1 = add(D, 1);
const ctx = {
  today: D, addDays: add,
  tasks: [
    { id: 'a', title: 'Barrer entrada', date: D, repeat: 'weekly' },
    { id: 'u', title: 'Fuente de Ringo', date: D, urgent: true },
    { id: 'h', title: 'Llamar al fontanero', date: D, time: '17:30' },
    { id: 'm', title: 'Poner la lavadora', date: D1 },
    { id: 'x', title: 'Hecha', date: D, done: true },
  ],
  events: [{ id: 'e', title: 'Dentista', date: D, time: '11:00', place: 'Centro' }],
  pets: [{ id: 'p', name: 'Pipeta', due: D1, time: '' }],
  nudges: () => [{ text: 'Urgente: «Fuente de Ringo».' }], minutes: () => 15,
};
const local = (iso) => { const d = new Date(iso); return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); };
test('avisos del día: resumen, urgente, a su hora, citas 30 min antes y lo de mañana', () => {
  const items = A.build(ctx), of = (re) => items.filter((x) => re.test(x.title + ' ' + x.body));
  const morning = items.find((x) => x.tag === 'casa-manana-' + D);
  assert.ok(morning && local(morning.at) === '9:00' && /Urgente/.test(morning.body), 'resumen a las 9');
  assert.equal(local(items.find((x) => x.tag === 'casa-urgente-' + D).at), '13:00');
  assert.equal(local(of(/Llamar al fontanero/)[0].at), '17:30');
  assert.equal(local(of(/Dentista/)[0].at), '10:30');
  const night = items.find((x) => x.tag === 'casa-noche-' + D);
  assert.ok(night && local(night.at) === '21:00' && /Poner la lavadora/.test(night.body));
  assert.ok(of(/Pipeta/).length === 1);
  assert.equal(of(/Hecha/).length, 0, 'lo hecho no avisa');
  assert.ok(items.every((x, i) => i === 0 || items[i - 1].at <= x.at), 'en orden');
});
test('no programa nada del pasado', () => {
  const past = { ...ctx, today: '2020-01-01', tasks: [{ id: 'a', title: 'Vieja', date: '2020-01-01', time: '10:00' }], events: [], pets: [] };
  assert.deepEqual(A.build(past), []);
});
test('preferencias del móvil: tipos apagados, solo lo mío y temporizadores', () => {
  const store = {}; globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const c = { ...ctx, me: 'yo', tasks: [...ctx.tasks, { id: 'j', title: 'Tarea de Juanma', date: D, time: '18:00', who: 'juanma' }, { id: 'b', title: 'De los dos', date: D, time: '19:00', who: 'ambos' }], timers: [{ id: 't1', label: 'Lavadora de arriba', end: Date.now() + 90 * 60e3, by: 'juanma' }] };
  let items = A.build(c);
  assert.ok(!items.some((x) => /Tarea de Juanma/.test(x.title)), 'solo lo mío y lo de los dos');
  assert.ok(items.some((x) => /De los dos/.test(x.title)));
  const tm = items.find((x) => x.tag === 'casa-timer-t1');
  assert.ok(tm && /Lavadora de arriba lista/.test(tm.title) && /tender/.test(tm.body));
  A.setPrefs({ types: { resumen: false, timers: true }, timersAll: false });
  items = A.build(c);
  assert.ok(!items.some((x) => /^casa-manana-/.test(x.tag)), 'sin resumen');
  assert.ok(!items.some((x) => x.tag === 'casa-timer-t1'), 'temporizador del otro, fuera');
  A.setPrefs({ mine: false, types: { resumen: true }, timersAll: true });
  assert.ok(A.build(c).some((x) => /Tarea de Juanma/.test(x.title)), 'todo');
  assert.match(A.timerBody('Secadora'), /Saca la ropa/);
  delete globalThis.localStorage;
});
