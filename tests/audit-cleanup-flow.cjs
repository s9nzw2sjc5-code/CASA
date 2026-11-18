// Auditoría de noviembre: Importantes como archivo de la casa, recordatorios a Tareas,
// mantenimiento técnico, documentos ordenados y apartados retirados (rutinas antiguas, vista semanal, mercadillo).
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
    await p.waitForFunction(() => typeof ACT !== "undefined" && ACT.remindersToTasks);
    await p.evaluate(() => {
      S = fresh();
      const t = today(), add = (n) => addDays(t, n), at = (d) => new Date(d + "T10:00:00").getTime();
      S.reminders = [
        { id: "r1", title: "Pagar la luz", date: add(2), time: "09:00", repeat: "monthly", notes: "Domiciliado", done: false },
        { id: "r2", title: "Comprar regalo", date: "", time: "", repeat: "none", notes: "", done: false },
        { id: "m1", kind: "maintenance", title: "Limpiar el filtro de la campana", date: add(10), repeat: "custom", every: 3, unit: "m", last: add(-80), notes: "", done: false },
        { id: "m2", kind: "maintenance", title: "Revisión anual de la caldera", date: add(40), repeat: "custom", every: 12, unit: "m", last: "", notes: "", done: false },
      ];
      S.documents = [
        { id: "f1", title: "Factura de la luz enero", category: "Factura", docDate: "2025-01-20", mime: "application/pdf", createdAt: at(t), archived: false },
        { id: "f2", title: "Factura del agua", category: "Factura", docDate: "2026-03-02", mime: "application/pdf", createdAt: at(t), archived: false },
        { id: "f3", title: "Factura del gas", category: "Factura", mime: "application/pdf", createdAt: at("2026-06-15"), archived: false },
        { id: "g1", title: "Garantía de la lavadora", category: "Garantía", mime: "application/pdf", createdAt: at(t), archived: false },
      ];
      S.routines = [{ id: "clasica", title: "Limpieza de baños", steps: [{ id: "s1", title: "Lavabo" }], date: t, repeat: "weekly", days: 7, who: "ambos", cycle: 0 }];
      S.tasks = [{ id: "nd", title: "Algo sin fecha", date: "", who: "yo", repeat: "none", notes: "", done: false }];
      ui.view = "recordar";
      save();
    });
    const ok = () => p.locator(".overlay [data-s=ok]").last().click(),
      cancel = () => p.locator(".overlay [data-s=cancel]").last().click(),
      tab = (v) => p.locator(`#tabs [data-v="${v}"]`).click();

    // 1) Importantes: archivo de la casa, sin botón + ni alta de recordatorios
    const imp = await p.locator("#app").innerText();
    assert.match(imp, /Documentos, mantenimientos, teléfonos y notas/);
    assert.match(imp, /Electrodomésticos y documentos[\s\S]*Mantenimiento de casa[\s\S]*Notas guardadas/);
    assert.match(imp, /Solo revisiones técnicas y garantías/);
    assert.equal(await p.locator("#fab").isHidden(), true);
    assert.equal(await p.locator("#qRemNoDate").count(), 0);
    assert.match(await p.locator("#app").innerText(), /1 mantenimiento es de limpieza: mejor en Tareas/);

    // 2) Pasar recordatorios (y el mantenimiento de limpieza) a Tareas, con Deshacer
    await p.locator(".move-banner [data-act=remindersToTasks]", { hasText: "Pasar 3 a Tareas" }).click();
    assert.equal(await p.locator(".move-list input[data-move]").count(), 3);
    assert.match(await p.locator("[data-move-count]").innerText(), /Se pasarán 3 a Tareas/);
    await p.locator('[data-move="r2"]').uncheck();
    await ok();
    const after = await p.evaluate(() => ({ reminders: S.reminders.map((r) => r.id).sort(), tasks: S.tasks.filter((t) => t.fromReminder).map((t) => [t.fromReminder, t.date, t.time, t.repeat, t.who]) }));
    assert.deepEqual(after.reminders, ["m2", "r2"]);
    assert.deepEqual(after.tasks.map((x) => x[0]).sort(), ["m1", "r1"]);
    const luz = after.tasks.find((x) => x[0] === "r1");
    assert.deepEqual(luz.slice(1), [await p.evaluate(() => addDays(today(), 2)), "09:00", "monthly", "ambos"]);
    await p.locator(".toast-undo").click();
    assert.equal(await p.evaluate(() => S.reminders.length), 4, "Deshacer devuelve los recordatorios");
    await p.locator(".move-banner [data-act=remindersToTasks]").first().click();
    await ok();
    assert.deepEqual(await p.evaluate(() => S.reminders.map((r) => r.id)), ["m2"], "solo queda la revisión técnica");
    assert.doesNotMatch(await p.locator("#app").innerText(), /⏰ Recordatorios/);

    // 3) Documentos: por tipo, facturas primero y por año (de la más reciente a la más antigua)
    await p.locator("#app [data-act=homeHub]").click();
    await p.locator('[data-home-tab="documents"]').click();
    const docs = await p.evaluate(() => [...document.querySelectorAll("#homeArchiveRows > *")].map((el) => el.matches(".doc-group") ? "# " + el.childNodes[0].textContent.trim() : el.matches(".doc-year") ? "- " + el.textContent : el.querySelector("strong").textContent));
    assert.deepEqual(docs, ["# Facturas", "- 2026", "Factura del gas", "Factura del agua", "- 2025", "Factura de la luz enero", "# Garantías", "Garantía de la lavadora"]);
    await p.locator('[data-home-document="f3"]').click();
    await p.locator("[data-document-edit]").first().click();
    await p.locator("#documentDate").fill("2024-12-30");
    await ok();
    assert.equal(await p.evaluate(() => S.documents.find((d) => d.id === "f3").docDate), "2024-12-30");
    while (await p.locator(".overlay").count()) await cancel();

    // 4) Apartados retirados
    await tab("semana");
    assert.equal(await p.locator("#app [data-act=week], #app [data-act=calMode]").count(), 0);
    await tab("tareas");
    await p.locator('[data-act=taskMode][data-v="routines"]').click();
    assert.equal(await p.locator(".home-other-routine, [data-act=newRoutine]").count(), 0);
    await p.locator('[data-act=cleaningRoutine][data-id="clasica"]').click();
    assert.match(await p.locator(".overlay").last().innerText(), /Limpieza de baños/, "una rutina antigua sigue abriéndose");
    await cancel();
    await p.locator('[data-act=taskMode][data-v="tasks"]').click();
    assert.ok(await p.evaluate(() => [...document.querySelectorAll("#app h2")].some((h) => h.textContent === "Sin fecha")));
    assert.equal(await p.locator("#qNoDate").getAttribute("placeholder"), "Añadir algo sin fecha");
    await tab("hoy");
    assert.match(await p.locator("#app").innerText(), /Sin fecha/);
    assert.doesNotMatch(await p.locator("#app").innerText(), /Para tener en cuenta/);
    await tab("compras");
    assert.equal(await p.locator("[data-act=ckMarket]").count(), 0);
    assert.doesNotMatch(await p.evaluate(() => ck().stores.join(",")), /Mercadillo/);
    assert.match(await p.evaluate(() => ck().stores.join(",")), /Lidl/);

    assert.deepEqual(errors, [], "errores de página");
    console.log("audit-cleanup-flow: OK");
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
