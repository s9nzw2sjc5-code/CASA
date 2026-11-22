const { test } = require('node:test'), assert = require('node:assert/strict'), M = require('../casa/mama.js');
const T = '2026-11-22', base = { today: T, hour: 10, tasks: [], pets: [], forecast: [], isWash: (t) => /lavadora/i.test(t.title), isWet: (d) => d.rain >= 50, isImportant: (t) => !!t.important, minutes: () => 15, dayName: (d) => d };
const text = (o) => M.nudges({ ...base, ...o }).map((n) => n.text).join('\n');
test('lo urgente va lo primero y con tono de madre', () => {
  const n = M.nudges({ ...base, tasks: [{ id: 'u', title: 'Fuente de Ringo', date: T, urgent: true }, { id: 'a', title: 'Barrer', date: T }] });
  assert.equal(n[0].icon, '❗'); assert.match(n[0].text, /Lo primero, .*«Fuente de Ringo»/);
});
test('si se junta mucho, ofrece repartirlo', () => {
  const tasks = [1, 2, 3, 4].map((i) => ({ id: 'l' + i, title: 'Atrasada ' + i, date: '2026-11-1' + i }));
  const n = M.nudges({ ...base, tasks });
  assert.ok(n.some((x) => x.action && x.action.kind === 'priority' && /Se te han juntado 4 cosas/.test(x.text)));
});
test('colada: tras poner la lavadora, tender', () => {
  assert.match(text({ tasks: [{ id: 'w', title: 'Poner la lavadora', date: '2026-11-25', repeat: 'weekly', lastDone: T }] }), /tiéndela en cuanto acabe/);
});
test('mañana llueve y toca lavadora: ponla hoy', () => {
  assert.match(text({ tasks: [{ id: 'w', title: 'Poner la lavadora', date: '2026-11-23', repeat: 'weekly' }], forecast: [{ date: '2026-11-23', rain: 80 }] }), /Mañana llueve y te toca lavadora/);
});
test('lo que lleva mucho sin hacerse', () => {
  assert.match(text({ tasks: [{ id: 'b', title: 'Limpiar el baño', date: '2026-11-15', repeat: 'weekly', lastDone: '2026-11-01' }] }), /Hace 21 días que no se hace «Limpiar el baño»/);
});
test('Ringo, fechas importantes y la compra', () => {
  const t = text({ pets: [{ name: 'Pipeta', due: '2026-11-20' }], tasks: [{ id: 'i', title: 'Cumpleaños', date: '2026-11-24', important: true }], lowPantry: 4 });
  assert.match(t, /A Ringo le toca «Pipeta» y ya va con retraso/);
  assert.match(t, /tienes «Cumpleaños»/);
});
test('rutina de mañana y noche según la hora, y nunca más de 4 avisos', () => {
  assert.match(text({ hour: 8 }), /abre las ventanas/);
  assert.match(text({ hour: 22 }), /cocina recogida y la basura fuera/);
  assert.doesNotMatch(text({ hour: 8, hasRoutines: true }), /abre las ventanas/);
  const many = [1, 2, 3, 4, 5].map((i) => ({ id: 'x' + i, title: 'Tarea ' + i, date: '2026-11-1' + i, urgent: i < 3 }));
  assert.ok(M.nudges({ ...base, tasks: many, pets: [{ name: 'X', due: T }], lowPantry: 5 }).length <= 4);
  assert.match(M.greeting(8, T), /^Buenos días, /); assert.match(M.greeting(22, T), /^Buenas noches, /);
});
