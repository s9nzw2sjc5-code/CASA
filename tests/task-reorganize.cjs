// Pruebas de Tareas: secciones por fecha y «Reorganizar pendientes».
// Datos sintéticos; sin Firebase ni escrituras externas.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path");
(async () => {
  const root = path.resolve(__dirname, ".."),
    server = http.createServer((req, res) => {
      const u = new URL(req.url, "http://local"),
        file = path.resolve(
          root,
          "." + (u.pathname.endsWith("/") ? u.pathname + "index.html" : u.pathname),
        );
      if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
      if (u.pathname === "/casa/config.js") {
        res.setHeader("Content-Type", "application/javascript");
        return res.end("window.claude={use:async()=>null}");
      }
      fs.readFile(file, (e, data) => {
        res.setHeader(
          "Content-Type",
          {
            ".html": "text/html",
            ".js": "application/javascript",
            ".json": "application/json",
            ".svg": "image/svg+xml",
            ".webmanifest": "application/manifest+json",
            ".png": "image/png",
          }[path.extname(file)] || "application/octet-stream",
        );
        res.writeHead(e ? 404 : 200);
        res.end(e ? "" : data);
      });
    });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  let browser, p;
  const errors = [];
  try {
    browser = await chromium.launch({ args: ["--no-sandbox"] });
    p = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      locale: "es-ES",
      timezoneId: "Europe/Madrid",
      serviceWorkers: "block",
    });
    p.on("pageerror", (e) => errors.push(e.message));
    await p.route("https://**/*", (r) => r.abort());
    await p.goto("http://127.0.0.1:" + server.address().port + "/casa/", {
      waitUntil: "domcontentloaded",
    });
    await p.waitForFunction(() => typeof ACT !== "undefined" && typeof CasaCleaningLinks !== "undefined");

    // Estado sintético: una tarea por sección, varias de la misma rutina vinculada y una hecha.
    await p.evaluate(() => {
      S = fresh();
      const t = today(), add = (n) => addDays(t, n);
      S.tasks = [
        { id: "late", title: "Pasar la aspiradora", date: add(-2), who: "yo", repeat: "none", notes: "Salón y pasillo", done: false },
        { id: "today", title: "Poner la lavadora", date: t, time: "09:00", who: "juanma", repeat: "none", notes: "", done: false },
        { id: "tomorrow", title: "Comprar pilas", date: add(1), who: "yo", repeat: "none", notes: "", done: false },
        { id: "weekly", title: "Revisar la caldera", date: add(5), who: "yo", repeat: "weekly", notes: "Llamar antes", done: false },
        { id: "nodate", title: "Llamar al fontanero", date: "", who: "yo", repeat: "none", notes: "", done: false },
        { id: "bath", title: "Limpiar baño", date: add(3), who: "juanma", repeat: "none", notes: "", done: false },
        { id: "shower", title: "Limpiar ducha", date: add(3), who: "juanma", repeat: "none", notes: "", done: false },
        { id: "finished", title: "Tarea ya hecha", date: t, who: "yo", repeat: "none", notes: "", done: true, doneAt: t },
      ];
      S.routines = [CasaCleaningLinks.link(S, null, "routine-bath", "Baño y ducha", ["bath", "shower"], Date.now())];
      ui.view = "tareas";
      ui.taskMode = "tasks";
      ui.personFilter = "all";
      ui.taskFilter = "pend";
      save();
    });

    const sections = () =>
        p.evaluate(() =>
          // Solo las secciones de tareas (no el calendario de temporada ni la tarjeta del tiempo)
          [...document.querySelectorAll("#app h2")].filter((h) => !h.closest(".season, .wx")).map((h) => ({
            h: h.textContent.trim(),
            t: [...(h.nextElementSibling?.querySelectorAll(".row-title") || [])].map((x) => x.textContent.trim()),
          })),
        ),
      snap = () =>
        p.evaluate(() =>
          S.tasks.map((t) => ({ id: t.id, date: t.date, time: t.time || "", who: t.who, repeat: t.repeat, notes: t.notes, done: t.done })),
        ),
      routineDates = () => p.evaluate(() => S.routines.map((r) => [r.id, r.date])),
      pick = (title) => p.locator(".reorg-row", { hasText: title }).locator(".row-main").click(),
      counter = () => p.locator(".reorg-top span").innerText();

    // 1) Secciones: orden fijo, una sola vez por tarea, filtros y consulta de hechas.
    let secs = await sections();
    assert.deepEqual(secs.map((s) => s.h), ["Atrasadas", "Hoy", "Mañana", "Próximos días", "Sin fecha"]);
    const titles = Object.fromEntries(secs.map((s) => [s.h, s.t]));
    assert.deepEqual(titles.Atrasadas, ["Pasar la aspiradora"]);
    assert.deepEqual(titles.Hoy, ["Poner la lavadora"]);
    assert.deepEqual(titles.Mañana, ["Comprar pilas"]);
    assert.deepEqual(titles["Próximos días"], ["Limpiar baño", "Limpiar ducha", "Revisar la caldera"]);
    assert.deepEqual(titles["Sin fecha"], ["Llamar al fontanero"]);
    const allRows = secs.flatMap((s) => s.t);
    assert.equal(allRows.length, 7);
    assert.equal(new Set(allRows).size, 7);

    await p.locator('[data-act=pFilter][data-v="juanma"]').click();
    assert.deepEqual((await sections()).flatMap((s) => s.t).sort(), ["Limpiar baño", "Limpiar ducha", "Poner la lavadora"]);
    await p.locator('[data-act=pFilter][data-v="all"]').click();
    await p.locator('[data-act=tFilter][data-v="done"]').click();
    assert.ok((await sections()).some((s) => s.h === "Hechas" && s.t.includes("Tarea ya hecha")));
    await p.locator('[data-act=tFilter][data-v="pend"]').click();

    // 2) Reorganizar pendientes: selección, mover en bloque y deshacer de una vez.
    await p.locator("[data-act=reorgStart]").click();
    assert.equal(await p.locator(".reorg-row").count(), 7);
    assert.equal(await p.locator("#fab").isHidden(), true);
    const lavadora = await p.locator(".reorg-row", { hasText: "Poner la lavadora" }).innerText();
    assert.match(lavadora, /Juanma/);
    assert.match(lavadora, /09:00/);
    assert.match(await counter(), /0 de 7/);
    await p.locator('[data-act=reorgAll]').click();
    assert.match(await counter(), /7 de 7/);
    await p.locator('[data-act=reorgAll]').click();
    assert.match(await counter(), /0 de 7/);

    await pick("Pasar la aspiradora");
    await pick("Llamar al fontanero");
    await pick("Revisar la caldera");
    assert.match(await counter(), /3 de 7/);
    const before = await snap(), routinesBefore = await routineDates();
    await p.locator('[data-act=reorgMove][data-v=tomorrow]').click();
    const afterMove = await snap();
    const moved = new Set(["late", "nodate", "weekly"]);
    for (const b of before) {
      const a = afterMove.find((x) => x.id === b.id);
      const expected = moved.has(b.id) ? { ...b, date: await p.evaluate(() => addDays(today(), 1)) } : b;
      assert.deepEqual(a, expected, "tarea " + b.id);
    }
    assert.match(await p.locator(".toast-undo").innerText().catch(() => ""), /Deshacer/);
    assert.match(await p.locator("#toast").innerText(), /3 tareas movidas/);
    await p.locator(".toast-undo").click();
    assert.deepEqual(await snap(), before, "un solo «Deshacer» revierte el lote entero");
    assert.deepEqual(await routineDates(), routinesBefore);

    // Mover todas a una fecha concreta: la rutina vinculada y el calendario la siguen.
    const target = await p.evaluate(() => addDays(today(), 10));
    await p.locator("[data-act=reorgAll]").click();
    await p.locator("#reorgDate").fill(target);
    await p.locator('[data-act=reorgMove][data-v=date]').click();
    assert.ok((await snap()).filter((x) => !x.done).every((x) => x.date === target));
    assert.deepEqual(await routineDates(), [["routine-bath", target]]);
    const onCalendar = await p.evaluate((d) => {
      const rows = homeCalendarItems(d).map((x) => x.id);
      const tasks = S.tasks.filter((t) => !t.done && occursOn(t, d)).map((t) => t.title);
      return { routine: rows.includes("routine-bath"), tasks: tasks.length, html: dayRows(d, false).join("") };
    }, target);
    assert.equal(onCalendar.routine, true);
    assert.equal(onCalendar.tasks, 7);
    assert.match(onCalendar.html, /Limpiar baño/);
    await p.locator(".toast-undo").click();
    assert.deepEqual(await snap(), before);
    assert.deepEqual(await routineDates(), routinesBefore);

    // Mover solo una tarea de la rutina a hoy: la rutina toma la fecha más próxima de sus tareas pendientes.
    await p.locator("[data-act=reorgAll]").click();
    await p.locator("[data-act=reorgAll]").click();
    await pick("Limpiar baño");
    await p.locator('[data-act=reorgMove][data-v=today]').click();
    const bath = (await snap()).find((x) => x.id === "bath");
    assert.equal(bath.date, await p.evaluate(() => today()));
    // La ronda muestra la fecha más próxima entre sus tareas pendientes (hoy, la de la ducha sigue en 3 días)
    assert.deepEqual(await routineDates(), [["routine-bath", await p.evaluate(() => today())]]);
    await p.locator(".toast-undo").click();
    assert.deepEqual(await snap(), before);

    // Salir del modo: vuelven los filtros, el botón de tarea nueva y la vista normal.
    await p.locator("[data-act=reorgStart]").click();
    assert.equal(await p.locator(".reorg").count(), 0);
    assert.equal(await p.locator("#fab").isHidden(), false);
    assert.ok((await sections()).some((s) => s.h === "Atrasadas"));

    // Rutinas de limpieza siguen accesibles.
    await p.locator('[data-act=taskMode][data-v=routines]').click();
    assert.ok(await p.locator("text=Baño y ducha").count());
    await p.locator('[data-act=taskMode][data-v=tasks]').click();

    // «Estoy fuera N días»: lo de esos días se corre N días, lo atrasado va al día de la vuelta,
    // lo de después y lo sin fecha no se toca, las urgentes ❗ se quedan y «Deshacer» lo revierte todo.
    await p.evaluate(() => {
      const t = today(), add = (n) => addDays(t, n), base = { who: "yo", repeat: "none", notes: "", done: false };
      S.tasks = [
        { ...base, id: "a-late", title: "Atrasada", date: add(-2) },
        { ...base, id: "a-today", title: "De hoy", date: t },
        { ...base, id: "a-mid", title: "A mitad", date: add(3) },
        { ...base, id: "a-after", title: "Después", date: add(6) },
        { ...base, id: "a-nodate", title: "Sin fecha", date: "" },
        { ...base, id: "a-urgent", title: "Fuente", date: t, urgent: true },
        { ...base, id: "a-done", title: "Hecha", date: add(1), done: true },
      ];
      S.routines = []; save(); render();
    });
    const awayBefore = await p.evaluate(() => JSON.stringify(S.tasks));
    await p.locator("[data-act=reorgStart]").click();
    await p.locator("#reorgAway").fill("5");
    await p.locator("[data-act=reorgAway]").click();
    const away = await p.evaluate(() => Object.fromEntries(S.tasks.map((x) => [x.id, x.date])));
    const d = (n) => p.evaluate((n) => addDays(today(), n), n);
    assert.deepEqual(away, { "a-late": await d(5), "a-today": await d(5), "a-mid": await d(8), "a-after": await d(6), "a-nodate": "", "a-urgent": await d(0), "a-done": await d(1) });
    assert.match(await p.locator("#toast").innerText(), /3 tareas reprogramadas · vuelves .* · 1 urgente ❗ sin posponer/);
    await p.locator(".toast-undo").click();
    assert.equal(await p.evaluate(() => JSON.stringify(S.tasks)), awayBefore);
    assert.equal(await p.evaluate(() => document.body.scrollWidth <= innerWidth + 2), true, "sin desbordar");
    if (process.env.SHOT) { await p.locator(".reorg-away").scrollIntoViewIfNeeded(); await p.screenshot({ path: process.env.SHOT }); }
    await p.locator("[data-act=reorgStart]").click();

    assert.deepEqual(errors, [], "errores de página");
    console.log("task-reorganize: OK");
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
