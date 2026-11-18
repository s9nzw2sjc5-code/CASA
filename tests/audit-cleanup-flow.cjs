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
    await p.waitForFunction(() => typeof ACT !== "undefined" && ACT.housePlan);
    await p.evaluate(() => {
      S = fresh(); ui.taskView = "todas"; // la vista completa de siempre (pestaña «Todas»)
      const t = today(), add = (n) => addDays(t, n), at = (d) => new Date(d + "T10:00:00").getTime();
      S.reminders = [
        { id: "r1", title: "Pagar la luz", date: add(2), time: "09:00", repeat: "monthly", notes: "Domiciliado", done: false },
        { id: "r2", title: "Comprar regalo", date: "", time: "", repeat: "none", notes: "", done: false },
        { id: "m1", kind: "maintenance", title: "Limpiar el filtro de la campana", date: add(10), repeat: "custom", every: 3, unit: "m", last: add(-80), notes: "", done: false },
        { id: "m2", kind: "maintenance", title: "Revisión anual de la caldera", date: add(5), repeat: "custom", every: 12, unit: "m", last: add(-360), applianceId: "ap1", notes: "", done: false },
      ];
      S.documents = [
        { id: "f1", title: "Factura de la luz enero", category: "Factura", docDate: "2025-01-20", mime: "application/pdf", createdAt: at(t), archived: false },
        { id: "f2", title: "Factura del agua", category: "Factura", docDate: "2026-03-02", mime: "application/pdf", createdAt: at(t), archived: false },
        { id: "f3", title: "Factura del gas", category: "Factura", mime: "application/pdf", createdAt: at("2026-06-15"), archived: false },
        { id: "g1", title: "Garantía de la lavadora", category: "Garantía", mime: "application/pdf", createdAt: at(t), archived: false },
      ];
      S.appliances = [{ id: "ap1", name: "Caldera", type: "otro", archived: false }];
      S.routines = [{ id: "clasica", title: "Limpieza de baños", steps: [{ id: "s1", title: "Lavabo" }], date: t, repeat: "weekly", days: 7, who: "ambos", cycle: 0 }];
      S.tasks = [{ id: "nd", title: "Algo sin fecha", date: "", who: "yo", repeat: "none", notes: "", done: false }];
      ui.view = "recordar";
      persistLocal();
    });
    await p.evaluate(() => render());
    const ok = () => p.locator(".overlay [data-s=ok]").last().click(),
      cancel = () => p.locator(".overlay [data-s=cancel]").last().click(),
      tab = (v) => p.locator(`#tabs [data-v="${v}"]`).click();

    // 1) Todo en Tareas: recordatorios, mantenimientos y la rutina antigua se convierten solos, con copia antes
    await p.waitForFunction(() => S.reminders.length === 0);
    const unified = await p.evaluate(() => ({
      reminders: S.reminders.length,
      routines: S.routines.length,
      tasks: S.tasks.map((t) => [t.id, t.title, t.date, t.repeat, !!t.maintenance, t.applianceId || ""]).sort(),
      backup: localBackups().some((b) => b.label === "Antes de pasar todo a Tareas" && b.data.reminders.length === 4),
    }));
    assert.equal(unified.backup, true, "copia de seguridad antes de convertir");
    assert.deepEqual([unified.reminders, unified.routines], [0, 0]);
    const titles = unified.tasks.map((t) => t[1]);
    for (const t of ["Pagar la luz", "Comprar regalo", "Limpiar el filtro de la campana", "Revisión anual de la caldera", "Limpieza de baños: Lavabo"]) assert.ok(titles.includes(t), t);
    const caldera = unified.tasks.find((t) => t[1] === "Revisión anual de la caldera");
    assert.deepEqual(caldera.slice(3), ["custom", true, "ap1"]);
    assert.match(await p.locator("#toast").innerText(), /Ahora todo está en Tareas: 5 elementos pasados/);

    // 2) Importantes: documentos, teléfonos y notas; sin recordatorios, mantenimientos ni botón +
    const imp = await p.locator("#app").innerText();
    assert.match(imp, /Documentos, teléfonos y notas/);
    assert.doesNotMatch(imp, /Mantenimiento de casa|⏰ Recordatorios/);
    assert.equal(await p.locator("#fab").isHidden(), true);
    // La ficha del aparato muestra su mantenimiento como tarea y crea otras vinculadas
    await p.locator("#app [data-act=homeHub]").click();
    await p.locator('[data-home-appliance="ap1"]').click();
    assert.match(await p.locator(".overlay").last().innerText(), /Revisión anual de la caldera/);
    await p.locator("[data-appliance-care]").click();
    await p.locator("#f_t").fill("Cambiar el ánodo");
    await ok();
    assert.deepEqual(await p.evaluate(() => { const t = S.tasks.find((t) => t.title === "Cambiar el ánodo"); return [t.applianceId, t.maintenance]; }), ["ap1", true]);
    while (await p.locator(".overlay").count()) await cancel();
    // El Calendario sigue enseñando el mantenimiento en su día
    await tab("semana");
    const day = await p.evaluate(() => addDays(today(), 5));
    if (day.slice(0, 7) !== (await p.evaluate(() => today().slice(0, 7)))) await p.locator('[data-act=month][data-v="1"]').click();
    await p.locator(`[data-act=calDay][data-v="${day}"]`).click();
    assert.match(await p.locator("section.day").innerText(), /Revisión anual de la caldera/);
    await tab("recordar");

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
    assert.equal(await p.locator('[data-act=cleaningRoutine][data-id="clasica"]').count(), 0, "la rutina antigua ya es tareas");
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

    // 5) Tareas repetidas por convertir dos veces (botón de la 109 en los dos móviles + conversión de la 110): se quedan en una
    await p.evaluate(() => {
      const base = S.tasks.find((t) => t.id === "rem-r1");
      S.tasks.push({ ...base, id: "dup109a", fromReminder: "r1" }, { ...base, id: "dup109b", fromReminder: "r1" });
      save();
    });
    await p.waitForFunction(() => S.tasks.filter((t) => t.title === "Pagar la luz").length === 1);
    assert.match(await p.locator("#toast").innerText(), /2 tareas repetidas quitadas \(hay copia de seguridad\)/);
    assert.equal(await p.evaluate(() => S.tasks.some((t) => t.title === "Comprar regalo")), true);

    // 6) Rutinas: muchas «Limpieza semanal» se juntan en una y las sugerencias van por frecuencia
    await p.evaluate(() => {
      const add = (n) => addDays(today(), n);
      S.tasks.push(
        { id: "lw1", title: "Limpiar baño grande", date: add(1), repeat: "weekly", who: "yo", notes: "", done: false },
        { id: "lw2", title: "Limpiar cocina a fondo", date: add(2), repeat: "weekly", who: "juanma", notes: "", done: false },
        { id: "lw3", title: "Fregar escaleras", date: add(3), repeat: "weekly", who: "yo", notes: "", done: false },
        { id: "lw4", title: "Barrer garaje", date: add(4), repeat: "weekly", who: "juanma", notes: "", done: false },
      );
      S.routines.push(CasaCleaningLinks.link(S, null, "sem-b", "Limpieza semanal", ["lw1"], 1));
      S.routines.push(CasaCleaningLinks.link(S, null, "sem-a", "Limpieza semanal", ["lw2"], 1));
      save();
    });
    await p.waitForFunction(() => S.routines.filter((r) => r.title === "Limpieza semanal").length === 1);
    assert.deepEqual(await p.evaluate(() => S.routines.find((r) => r.title === "Limpieza semanal").taskIds.sort()), ["lw1", "lw2"]);
    assert.match(await p.locator("#toast").innerText(), /Rutinas de limpieza agrupadas: 1 repetida unida/);
    await tab("tareas");
    await p.locator('[data-act=taskMode][data-v="routines"]').click();
    const sug = await p.evaluate(() => CasaCleaningLinks.groups(S).map((g) => g.title));
    assert.deepEqual(sug.filter((t) => t === "Limpieza semanal").length, 1, "una sola sugerencia semanal");

    assert.deepEqual(errors, [], "errores de página");
    console.log("audit-cleanup-flow: OK");
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
