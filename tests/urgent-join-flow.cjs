// Unir tareas propias al plan, colada según la casa y tareas urgentes que no se pueden posponer.
// Datos sintéticos; Open-Meteo se simula y no hay Firebase ni escrituras externas.
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
    await p.route("https://**/*", async (r) => {
      const url = new URL(r.request().url());
      if (url.hostname !== "api.open-meteo.com") return r.abort();
      const time = await p.evaluate(() => [0, 1, 2, 3, 4, 5, 6].map((n) => addDays(today(), n)));
      return r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ daily: { time, weather_code: [61, 1, 1, 1, 1, 1, 1], temperature_2m_max: [16, 18, 18, 18, 18, 18, 18], temperature_2m_min: [9, 9, 9, 9, 9, 9, 9], precipitation_probability_max: [85, 0, 0, 0, 0, 0, 0], precipitation_sum: [4, 0, 0, 0, 0, 0, 0], wind_speed_10m_max: [10, 10, 10, 10, 10, 10, 10] } }) });
    });
    await p.goto("http://127.0.0.1:" + server.address().port + "/casa/", { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof ACT !== "undefined" && ACT.houseJoin);
    await p.evaluate(() => {
      S = fresh();
      const t = today(), add = (n) => addDays(t, n);
      S.tasks = [
        { id: "plantas", title: "Revisar plantas", date: add(1), repeat: "weekly", who: "yo", notes: "", done: false },
        { id: "bano", title: "Limpiar baño", date: add(2), repeat: "weekly", who: "juanma", time: "10:00", notes: "Con guantes", done: false },
        { id: "cocina", title: "Cocina", date: add(3), repeat: "weekly", who: "yo", notes: "", done: false },
        { id: "fuente", title: "Limpiar la fuente de Ringo", date: t, repeat: "weekly", who: "yo", notes: "", done: false },
        { id: "barrer", title: "Barrer", date: add(4), repeat: "weekly", who: "yo", notes: "", done: false },
      ];
      S.pet = [{ id: "filtro", name: "Fuente: cambiar el filtro", kind: "otro", last: "", every: 0, unit: "w", next: t, time: "", notes: "", log: [] }];
      S.cook = { homeWeather: { name: "Villa de Prueba", region: "", lat: 40.12, lon: -3.68 } };
      ui.view = "tareas"; ui.taskMode = "tasks"; ui.personFilter = "all"; ui.taskFilter = "pend";
      save();
    });
    const ok = () => p.locator(".overlay [data-s=ok]").last().click(),
      cancel = () => p.locator(".overlay [data-s=cancel]").last().click(),
      task = (id) => p.evaluate((id) => S.tasks.find((t) => t.id === id), id),
      today = () => p.evaluate(() => today());

    // 1) Unir mis tareas al plan: propone las que encajan, se puede elegir y deshacer
    await p.locator(".chip[data-act=housePlan]").click();
    assert.match(await p.locator(".plan-join").innerText(), /Tienes 4 tareas tuyas que encajan/);
    assert.equal(await p.locator('[data-plan-zone="mascota"]').isChecked(), false, "ya tiene la fuente apuntada: no se duplica");
    await p.locator("[data-plan-join]").click();
    assert.equal(await p.locator(".join-row").count(), 4);
    assert.equal(await p.locator('[data-join="bano"]').inputValue(), "bano-principal");
    assert.equal(await p.locator('[data-join="plantas"]').inputValue(), "patio");
    assert.match(await p.locator(".join-row", { hasText: "Limpiar la fuente" }).innerText(), /Cada domingo · ❗ urgente/);
    await p.locator("[data-join-all]").check();
    assert.equal(await p.locator(".join-row").count(), 5);
    await p.locator('[data-join="barrer"]').selectOption("escaleras");
    assert.match(await p.locator("[data-join-count]").innerText(), /Se unirán 5 tareas/);
    if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT + "-unir.png" });
    await ok();
    const bano = await task("bano");
    assert.deepEqual([bano.title, bano.who, bano.time, bano.notes, bano.planKey, bano.repeat], ["Limpiar baño", "juanma", "10:00", "Con guantes", "bano-principal", "weekly"]);
    assert.equal(await p.evaluate((d) => (new Date(d + "T12:00:00").getDay() + 6) % 7, bano.date), 1, "el baño pasa al martes");
    assert.equal((await task("fuente")).urgent, true);
    assert.equal((await task("barrer")).planKey, "escaleras");
    await p.locator(".toast-undo").click();
    assert.equal((await task("bano")).planKey, undefined, "Deshacer devuelve todo como estaba");
    assert.equal((await task("fuente")).urgent, undefined);
    await p.locator(".chip[data-act=housePlan]").click();
    await p.locator("[data-plan-join]").click();
    await ok();
    assert.equal((await task("fuente")).date, await today(), "la urgente no se aplaza al unirla: hoy está entre lo que toca");

    // 2) Crear el plan después: no duplica lo unido y guarda lo que hay para la colada
    await p.locator(".chip[data-act=housePlan]").click();
    assert.equal(await p.locator(".plan-join").count(), 0, "ya no quedan tareas por unir");
    for (const k of ["twoWashers", "dryer", "coveredLine", "indoorLine"]) await p.locator(`[data-laundry="${k}"]`).check();
    await ok();
    assert.deepEqual(await p.evaluate(() => S.cook.houseLaundry), { twoWashers: true, dryer: true, coveredLine: true, indoorLine: true });
    for (const key of ["bano-principal", "patio", "cocina-semanal", "escaleras"]) assert.equal(await p.evaluate((k) => S.tasks.filter((t) => t.planKey === k).length, key), 1, key);
    assert.equal(await p.evaluate(() => S.tasks.filter((t) => /fuente/i.test(t.title)).length), 1, "la fuente no se duplica");
    assert.match(await p.locator(".wx").innerText(), /nada de tender al descubierto[\s\S]*tendedero cubierto sirve si no sopla viento/);
    assert.match(await p.locator(".wx-recs li").first().innerText(), /❗[\s\S]*Urgente: «Limpiar la fuente de Ringo»/);

    // 3) Urgente: marcada, primero, sin «Mañana →» y sin poder posponerse por ninguna vía
    const row = p.locator("#app .row.is-urgent", { hasText: "Limpiar la fuente de Ringo" });
    assert.equal(await row.count(), 1);
    assert.equal(await row.locator("[data-act=toTomorrow]").count(), 0);
    assert.equal(await p.evaluate(() => [...document.querySelectorAll("#app h2")].find((h) => h.textContent === "Hoy").nextElementSibling.querySelector(".row-title").textContent), "Limpiar la fuente de Ringo", "primera en Hoy");
    await p.evaluate(() => ACT.toTomorrow({ id: "fuente" }));
    assert.equal((await task("fuente")).date, await today());
    await p.locator("[data-act=reorgStart]").click();
    await p.locator(".reorg-row", { hasText: "Limpiar la fuente" }).locator(".row-main").click();
    await p.locator(".reorg-row", { hasText: "Limpiar baño" }).locator(".row-main").click();
    const banoBefore = (await task("bano")).date;
    await p.locator('[data-act=reorgMove][data-v=tomorrow]').click();
    assert.equal((await task("fuente")).date, await today(), "reorganizar no la pospone");
    assert.notEqual(banoBefore, await p.evaluate(() => addDays(today(), 1)));
    assert.equal((await task("bano")).date, await p.evaluate(() => addDays(today(), 1)), "las demás sí se mueven");
    assert.match(await p.locator("#toast").innerText(), /1 urgente ❗ sin posponer/);
    await p.locator(".toast-undo").click();
    await p.locator("[data-act=reorgStart]").click();
    await p.locator("#app .row.is-urgent .row-main").first().click();
    assert.equal(await p.locator("#f_u").isChecked(), true);
    await p.locator("#f_d").fill(await p.evaluate(() => addDays(today(), 2)));
    await ok();
    assert.equal(await p.locator(".overlay").count(), 1, "la ficha no deja guardarla más tarde");
    assert.match(await p.locator("#toast").innerText(), /no se puede posponer/);
    await cancel();
    await p.evaluate(() => answerNotice({ kind: "task", id: "fuente" }));
    assert.equal(await p.locator('.overlay [data-response="tomorrow"]').count(), 0);
    assert.match(await p.locator(".overlay").innerText(), /urgente: no se puede posponer/);
    await cancel();

    // Una rutina con una tarea urgente pendiente no se puede posponer
    const rid = await p.evaluate(() => { const r = CasaCleaningLinks.link(S, null, "rutina-u", "Rutina con urgente", ["fuente", "bano"], Date.now()); S.routines = [r]; save(); return r.id; });
    await p.evaluate((id) => routineDetail(id), rid);
    await p.locator("[data-routine-postpone]").click();
    assert.match(await p.locator(".overlay").last().innerText(), /tareas urgentes ❗: no se puede posponer/);
    assert.equal((await task("fuente")).date, await today());
    await cancel();

    // 4) Hoy: lo urgente arriba, en Importante, y sin repetirse en «Para hoy»; también un cuidado de Ringo urgente
    await p.locator('#tabs [data-v="ringo"]').click();
    await p.locator('[data-act=editPet][data-id="filtro"]').first().click();
    await p.locator("#f_urg").check();
    await ok();
    await p.locator('[data-act=editPet][data-id="filtro"]').first().click();
    await p.locator("#f_nx").fill(await p.evaluate(() => addDays(today(), 3)));
    await ok();
    assert.equal(await p.locator(".overlay").count(), 1, "el cuidado urgente tampoco se pospone");
    await cancel();
    await p.locator('#tabs [data-v="hoy"]').click();
    const imp = await p.locator(".hsec.imp").innerText();
    assert.match(imp, /Limpiar la fuente de Ringo/);
    assert.match(imp, /Fuente: cambiar el filtro/);
    const rest = await p.evaluate(() => [...document.querySelectorAll(".hsec:not(.imp)")].map((s) => s.innerText).join("\n"));
    assert.doesNotMatch(rest, /Limpiar la fuente de Ringo|Fuente: cambiar el filtro/, "no se repiten más abajo");
    if (process.env.SHOT) { await p.evaluate(() => { document.querySelector("#toast").classList.remove("show"); $("#app").scrollTop = document.querySelector(".hsec.imp").offsetTop - 60; }); await p.screenshot({ path: process.env.SHOT + "-hoy.png" }); }

    assert.deepEqual(errors, [], "errores de página");
    console.log("urgent-join-flow: OK");
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
