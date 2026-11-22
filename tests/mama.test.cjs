const { test } = require('node:test'), assert = require('node:assert/strict'), M = require('../casa/mama.js');
const T = '2026-11-22', base = { today: T, hour: 10, tasks: [], pets: [], forecast: [], isWash: (t) => /lavadora/i.test(t.title), isWet: (d) => d.rain >= 50, isImportant: (t) => !!t.important, minutes: () => 15, dayName: (d) => d };
const text = (o) => M.nudges({ ...base, ...o }).map((n) => n.text).join('\n');
test('lo urgente va lo primero', () => {
  const n = M.nudges({ ...base, tasks: [{ id: 'u', title: 'Fuente de Ringo', date: T, urgent: true }, { id: 'a', title: 'Barrer', date: T }] });
  assert.equal(n[0].icon, '❗'); assert.equal(n[0].text, 'Urgente: «Fuente de Ringo».');
});
test('si se junta mucho, ofrece repartirlo', () => {
  const tasks = [1, 2, 3, 4].map((i) => ({ id: 'l' + i, title: 'Atrasada ' + i, date: '2026-11-1' + i }));
  const n = M.nudges({ ...base, tasks });
  assert.ok(n.some((x) => x.action && x.action.kind === 'priority' && /4 tareas atrasadas\. Se pueden repartir/.test(x.text)));
});
test('colada: tras poner la lavadora, tender', () => {
  assert.match(text({ tasks: [{ id: 'w', title: 'Poner la lavadora', date: '2026-11-25', repeat: 'weekly', lastDone: T }] }), /Lavadora puesta hoy: tender en cuanto termine/);
});
test('mañana llueve y toca lavadora: ponla hoy', () => {
  assert.match(text({ tasks: [{ id: 'w', title: 'Poner la lavadora', date: '2026-11-23', repeat: 'weekly' }], forecast: [{ date: '2026-11-23', rain: 80 }] }), /Mañana llueve y toca lavadora: mejor ponerla hoy/);
});
test('lo que lleva mucho sin hacerse', () => {
  assert.match(text({ tasks: [{ id: 'b', title: 'Limpiar el baño', date: '2026-11-15', repeat: 'weekly', lastDone: '2026-11-01' }] }), /«Limpiar el baño» lleva 21 días sin hacerse/);
});
test('Ringo, fechas importantes y la compra', () => {
  const t = text({ pets: [{ name: 'Pipeta', due: '2026-11-20' }], tasks: [{ id: 'i', title: 'Cumpleaños', date: '2026-11-24', important: true }], lowPantry: 4 });
  assert.match(t, /Ringo: «Pipeta» \(con retraso\)/);
  assert.match(t, /: «Cumpleaños»/);
});
test('rutina de mañana y noche según la hora, y nunca más de 4 avisos', () => {
  assert.match(text({ hour: 8 }), /ventilar 10 minutos y hacer las camas/);
  assert.match(text({ hour: 22 }), /cocina recogida y basura fuera/);
  assert.doesNotMatch(text({ hour: 8, hasRoutines: true }), /ventilar/);
  const many = [1, 2, 3, 4, 5].map((i) => ({ id: 'x' + i, title: 'Tarea ' + i, date: '2026-11-1' + i, urgent: i < 3 }));
  assert.ok(M.nudges({ ...base, tasks: many, pets: [{ name: 'X', due: T }], lowPantry: 5 }).length <= 4);
  assert.equal(M.greeting(), 'Recordatorios de hoy');
});

test('tono neutro: sin apelativos ni frases de madre', () => {
  const tasks = [{ id: 'u', title: 'X', date: T, urgent: true }, ...[1, 2, 3].map((i) => ({ id: 'l' + i, title: 'L' + i, date: '2026-11-1' + i }))];
  for (const h of [8, 15, 22]) assert.doesNotMatch(text({ hour: h, tasks, lowPantry: 5, pets: [{ name: 'P', due: T }] }) + text({ hour: h }), /cariño|cielo|hija|mi vida|corazón|toro|pereza|Pobrecito|agobies|te lo has ganado|agradecerás/i);
});
