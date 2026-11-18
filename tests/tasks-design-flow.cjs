// Tareas con el diseño «Para hoy · Por zonas · Todas» y la ficha de cada zona.
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
        file = path.resolve(root, "." + (u.pathname.endsWith("/") ? u.pathname + "index.html" : u.pathname));
      if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
      if (u.pathname === "/casa/config.js") {
        res.setHeader("Content-Type", "application/javascript");
        return res.end("window.claude={use:async()=>null}");
      }
      fs.readFile(file, (e, data) => {
        res.setHeader("Content-Type", { ".html": "text/html", ".js": "application/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".png": "image/png" }[path.extname(file)] || "application/octet-stream");
        res.writeHead(e ? 404 : 200);
        res.end(e ? "" : data);
      });
    });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  let browser, p;
  const errors = [];
  try {
    browser = await chromium.launch({ args: ["--no-sandbox"] });
    p = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "es-ES", timezoneId: "Europe/Madrid", serviceWorkers: "block" });
    p.on("pageerror", (e) => errors.push(e.message));
    await p.route("https://**/*", (r) => r.abort());
    await p.goto("http://127.0.0.1:" + server.address().port + "/casa/", { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof ACT !== "undefined" && ACT.housePlan);
    await p.evaluate(() => {
      S = fresh();
      const t = today(), a = (n) => addDays(t, n), base = { repeat: "none", notes: "", done: false, who: "yo" };
      S.tasks = [
        { ...base, id: "bano", title: "Baño principal: inodoro, lavabo, ducha y espejo", date: t, repeat: "weekly", plan: "casa", planKey: "bano-principal" },
        { ...base, id: "espejo", title: "Limpiar el espejo", date: a(-1), who: "juanma" },
        { ...base, id: "fuente", title: "Limpiar la fuente de Ringo", date: t, urgent: true },
        { ...base, id: "luz", title: "Pagar la luz", date: t },
        { ...base, id: "cocina", title: "Cocina: encimera", date: a(-30), done: true, doneAt: t, plan: "casa", planKey: "cocina-semanal" },
        { ...base, id: "nevera", title: "Nevera: vaciar y limpiar por dentro", date: a(9), plan: "casa", planKey: "nevera" },
        { ...base, id: "sinfecha", title: "Algo sin fecha", date: "" },
      ];
      S.cook = { planDays: 2 };
      ui.view = "tareas"; ui.taskMode = "tasks"; ui.taskView = undefined; ui.taskZone = null; ui.personFilter = "all";
      save();
    });
    const rows = () => p.evaluate(() => [...document.querySelectorAll(".tz-list:not(.tz-done .tz-list) .tz-title")].map((x) => x.textContent));

    // 1) Para hoy (por defecto): lo de hoy y lo atrasado, urgentes primero, con zona y minutos
    assert.equal(await p.locator(".tz-seg .on").innerText(), "Para hoy");
    assert.match(await p.locator(".tz-count").innerText(), /4 pendientes · 1 hecha/);
    const today1 = await rows();
    assert.equal(today1[0], "Limpiar la fuente de Ringo", "lo urgente, arriba");
    assert.deepEqual([...today1].sort(), ["Baño principal: inodoro, lavabo, ducha y espejo", "Limpiar el espejo", "Limpiar la fuente de Ringo", "Pagar la luz"]);
    const banoRow = await p.locator(".tz-row", { hasText: "Baño principal" }).innerText();
    assert.match(banoRow, /Baños[\s\S]*20 min/);
    assert.match(await p.locator(".tz-row", { hasText: "Limpiar el espejo" }).innerText(), /Baños[\s\S]*Atrasada/);
    assert.doesNotMatch(await p.locator(".tz-list").first().innerText(), /Juanma|Mari|Conjunto/, "sin quién se encarga");
    assert.match(await p.locator(".tz-row", { hasText: "fuente" }).innerText(), /Ringo/);
    assert.match(await p.locator(".tz-done summary").innerText(), /Hechas hoy · 1/);
    assert.equal(await p.locator(".tz-done ~ .wx, .wx").count(), 1, "el tiempo y sus consejos siguen en Para hoy");
    // Marcar desde aquí
    await p.locator('.tz-row [data-act=toggleTask][data-id="luz"]').click();
    assert.equal(await p.evaluate(() => S.tasks.find((t) => t.id === "luz").done), true);
    assert.match(await p.locator(".tz-count").innerText(), /3 pendientes · 2 hechas/);
    await p.locator('.tz-done summary').click();
    await p.locator('.tz-done [data-act=toggleTask][data-id="luz"]').click();
    assert.equal(await p.evaluate(() => S.tasks.find((t) => t.id === "luz").done), false, "se desmarca desde Hechas hoy");
    // Tocar el nombre abre la ficha de siempre
    await p.locator('.tz-main[data-id="luz"]').click();
    assert.equal(await p.locator("#f_t").inputValue(), "Pagar la luz");
    await p.locator(".overlay [data-s=cancel]").last().click();

    // 2) Por zonas: tarjetas con lo pendiente y hecho de esta semana, y lo próximo
    await p.locator('[data-act=taskView][data-v=zonas]').click();
    const zones = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll(".tz-zone")].map((z) => [z.querySelector("b").textContent, z.querySelector("small").textContent])));
    assert.equal(zones["Baños"], "2 pendientes");
    assert.equal(zones["Cocina"], "Al día");
    assert.equal(zones["Ringo"], "1 pendiente");
    assert.equal(zones["Otras tareas"], "1 pendiente");
    assert.match(await p.locator(".tz-soon").innerText(), /Nevera/);

    // 3) Ficha de una zona: progreso, lista, «Continuar otro día» (lo urgente no se mueve) y volver
    await p.locator('.tz-zone[data-v="banos"]').click();
    assert.match(await p.locator(".tz-ptitle").innerText(), /Baños/);
    assert.match(await p.locator(".tz-page .tz-count").innerText(), /Esta semana · 0 de 2 hechas/);
    await p.locator('.tz-page [data-act=toggleTask][data-id="bano"]').click();
    assert.match(await p.locator(".tz-page .tz-count").innerText(), /Esta semana · 1 de 2 hechas/);
    await p.locator("[data-act=taskZoneLater]").click();
    const tomorrow = await p.evaluate(() => addDays(today(), 1));
    assert.equal(await p.evaluate(() => S.tasks.find((t) => t.id === "espejo").date), tomorrow);
    assert.equal(await p.evaluate(() => reorgSel), null, "no abre Reorganizar");
    assert.match(await p.locator("#toast").innerText(), /1 tarea movida a mañana/);
    await p.locator(".toast-undo").click();
    assert.notEqual(await p.evaluate(() => S.tasks.find((t) => t.id === "espejo").date), tomorrow);
    await p.locator(".tz-back").click();
    assert.equal(await p.locator(".tz-zones").count(), 1);

    // 4) Organizar limpieza reúne Reorganizar (con «Estoy fuera»), plan, rutinas, consejos y personas
    await p.locator("[data-act=taskOrganize]").click();
    assert.deepEqual(await p.evaluate(() => [...document.querySelectorAll(".tz-org b")].map((b) => b.textContent)), ["Reorganizar pendientes", "Plan de limpieza", "Limpieza por frecuencia", "Consejos de limpieza", "Personas"]);
    await p.locator('[data-org="reorg"]').click();
    assert.equal(await p.locator(".reorg-away").count(), 1);
    await p.locator("[data-act=reorgStart]").click();
    await p.locator("[data-act=taskOrganize]").click();
    await p.locator('[data-org="routines"]').click();
    assert.match(await p.locator("#app h1").first().innerText(), /Limpieza/);
    await p.locator('[data-act=taskMode][data-v=tasks]').click();

    // 5) Todas: la vista de siempre, con Sin fecha y el calendario de temporada
    await p.locator('[data-act=taskView][data-v=todas]').click();
    // Pasar a mañana: solo el icono; sin quién se encarga
    const tm = p.locator('[data-act=toTomorrow][data-id="luz"]');
    assert.equal(await tm.innerText(), "⏭️");
    assert.equal(await tm.getAttribute("title"), "Pasar a mañana");
    assert.equal(await p.locator("#app .task-row .who").count(), 0);
    assert.ok(await p.evaluate(() => [...document.querySelectorAll("#app h2")].some((h) => h.textContent === "Sin fecha")));
    assert.equal(await p.locator("#qNoDate").count(), 1);

    // Filtro de persona: se aplica también en Para hoy y avisa
    await p.locator("[data-act=taskFilters]").click(); await p.locator("#taskPerson").selectOption("juanma"); await p.locator(".overlay [data-s=ok]").last().click();
    await p.locator('[data-act=taskView][data-v=hoy]').click();
    assert.deepEqual(await rows(), ["Limpiar el espejo"]);
    assert.match(await p.locator(".tz-person").innerText(), /Viendo solo lo de Juanma/);
    await p.locator('.tz-person [data-act=pFilter]').click();
    for (const w of [390, 320]) {
      await p.setViewportSize({ width: w, height: 800 });
      for (const v of ["hoy", "zonas"]) { await p.evaluate((v) => { ui.taskView = v; ui.taskZone = null; render(); }, v); assert.equal(await p.evaluate(() => document.body.scrollWidth <= innerWidth + 2), true, v + " a " + w); }
    }
    if (process.env.SHOT) { await p.setViewportSize({ width: 390, height: 844 }); await p.evaluate(() => { ui.taskView = "hoy"; render(); }); await p.screenshot({ path: process.env.SHOT }); }

    // Modo oscuro: listas y opciones con fondo oscuro (texto claro legible) en Tareas y en Hoy; ⏭️ sin círculo
    await p.emulateMedia({ colorScheme: "dark" });
    for (const [view, tv] of [["tareas", "hoy"], ["tareas", "todas"], ["hoy", "hoy"]]) {
      await p.evaluate(([v, tv]) => { ui.view = v; ui.taskView = tv; ui.taskZone = null; render(); document.querySelectorAll("details.task-options").forEach((d) => (d.open = true)); }, [view, tv]);
      const bad = await p.evaluate(() => [...document.querySelectorAll("#app .list, #app .task-options, #app .tz-zone, #app .tz-organize")].filter((el) => {
        const m = getComputedStyle(el).backgroundColor.match(/\d+/g).map(Number); return m[0] > 200 && m[1] > 200 && m[2] > 200;
      }).map((el) => el.className));
      assert.deepEqual(bad, [], `${view}/${tv}: nada blanco en modo oscuro`);
    }
    assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector("#app .tomorrow-ic")).backgroundColor), "rgba(0, 0, 0, 0)", "⏭️ solo el icono");
    await p.emulateMedia({ colorScheme: "light" });

    // Datos de versiones antiguas (fechas en otro formato, campos que faltan): ninguna vista falla
    const odd = await p.evaluate(() => {
      const t = today();
      S.tasks.push({ id: "o1", title: "Fecha número", date: 1731900000000 }, { id: "o2", title: null, date: addDays(t, -2) }, { id: "o3", title: "Hecha sin fecha", done: true, doneAt: Date.now() }, { id: "o4", title: "Plan raro", plan: "casa", planKey: 5, date: t });
      const bad = [];
      ui.view = "tareas"; ui.taskMode = "tasks";
      for (const tv of ["hoy", "zonas", "todas"]) { ui.taskView = tv; ui.taskZone = null; render(); if (document.querySelector(".tz-error")) bad.push(tv); }
      for (const z of TASK_ZONES) { ui.taskZone = z.id; render(); if (!document.querySelector(".tz-page")) bad.push(z.id); }
      ui.taskZone = null; S.tasks = S.tasks.filter((x) => !/^o\d$/.test(x.id)); render();
      return bad;
    });
    assert.deepEqual(odd, [], "vistas que fallan con datos antiguos");
    // Y si algo fallara, Tareas no se queda en blanco: enseña la vista completa y el detalle
    await p.evaluate(() => { window._z = vTaskZonePage; vTaskZonePage = () => { throw Error("prueba"); }; ui.view = "tareas"; ui.taskZone = "banos"; render(); });
    assert.match(await p.locator(".tz-error").innerText(), /Te enseño todas las tareas\. Detalle: prueba/);
    assert.ok(await p.locator("#qNoDate").count());
    await p.evaluate(() => { vTaskZonePage = window._z; ui.taskZone = null; render(); });

    // Fecha antigua guardada como número + modo «rutinas» recordado: la pestaña Tareas se abre y se marca
    await p.evaluate(() => { S.tasks.push({ id: "num", title: "Fecha antigua", date: new Date(today() + "T10:00:00").getTime(), repeat: "weekly", done: false }); ui.taskMode = "routines"; ui.cleaningView = "frequency"; ui.view = "hoy"; save(); });
    await p.waitForFunction(() => S.tasks.find((t) => t.id === "num").date === today());
    assert.match(await p.locator("#toast").innerText(), /Arregladas las fechas antiguas de 1 tarea \(hay copia de seguridad\)/);
    for (const cv of ["frequency", "zone", "all", "today"]) {
      await p.evaluate((cv) => { ui.cleaningView = cv; ui.view = "hoy"; render(); }, cv);
      await p.locator('#tabs [data-v="tareas"]').click();
      assert.equal(await p.evaluate(() => document.body.dataset.view), "tareas", cv);
      assert.match(await p.locator("#tabs .tab.on").innerText(), /Tareas/, cv);
    }
    // Sin poder guardar el arreglo (solo lectura), tampoco se bloquea: rutinas, Reorganizar y las pestañas nuevas
    await p.evaluate(() => { S.tasks.find((t) => t.id === "num").date = 1731900000000; syncState = "ro"; ui.view = "hoy"; render(); });
    for (const setup of [() => { ui.taskMode = "routines"; ui.cleaningView = "frequency"; }, () => { ui.taskMode = "tasks"; reorgSel = new Set(); }, () => { ui.taskMode = "tasks"; reorgSel = null; ui.taskView = "zonas"; }]) {
      await p.evaluate(`(${setup})(); ui.view = "hoy"; render();`);
      await p.locator('#tabs [data-v="tareas"]').click();
      assert.equal(await p.evaluate(() => document.body.dataset.view), "tareas");
      assert.ok(await p.locator("#app h1").count());
    }
    await p.evaluate(() => { syncState = "local"; reorgSel = null; ui.taskMode = "tasks"; S.tasks = S.tasks.filter((t) => t.id !== "num"); save(); });

    // Rutinas de limpieza con las zonas del plan guardadas como {chosen, known} (lo que guarda el plan): sin error
    await p.evaluate(() => { S.cook = { ...S.cook, housePlanZones: { chosen: ["cocina", "banoPrincipal"], known: CasaHousePlan.ZONES.map((z) => z[0]) } }; ui.view = "tareas"; ui.taskMode = "tasks"; ui.taskView = "todas"; render(); });
    await p.locator('[data-act=taskMode][data-v="routines"]').click();
    for (const cv of ["today", "frequency", "zone", "all"]) {
      await p.evaluate((cv) => { ui.cleaningView = cv; render(); }, cv);
      assert.equal(await p.locator(".tz-error").count(), 0, "rutinas " + cv + " sin error");
      assert.match(await p.locator("#app h1").first().innerText(), /Limpieza/);
    }
    await p.evaluate(() => { ui.taskMode = "tasks"; render(); });

    assert.deepEqual(errors, [], "errores de página");
    console.log("tasks-design-flow: OK");
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
