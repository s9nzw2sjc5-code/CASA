// Pestaña Tareas: ubicación, tiempo con recomendaciones y plan de limpieza.
// Datos sintéticos; Open-Meteo se simula y no hay Firebase ni escrituras externas.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path");
const P = require("../casa/house-plan.js");
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
  let browser, p, forecastCalls = 0, forecastUp = true;
  const errors = [];
  try {
    browser = await chromium.launch({ args: ["--no-sandbox"] });
    p = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "es-ES", timezoneId: "Europe/Madrid", serviceWorkers: "block" });
    p.on("pageerror", (e) => errors.push(e.message));
    const base = "http://127.0.0.1:" + server.address().port + "/casa/";
    await p.route("https://**/*", async (r) => {
      const url = new URL(r.request().url());
      const json = (body) => r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });
      if (url.hostname === "geocoding-api.open-meteo.com")
        return json({ results: [{ name: "Villa de Prueba", latitude: 40.12345, longitude: -3.6789, admin1: "Provincia de Ejemplo", country: "España" }] });
      if (url.hostname === "api.open-meteo.com") {
        forecastCalls++;
        if (!forecastUp) return r.abort();
        const t = await p.evaluate(() => today()), add = (n) => p.evaluate((n) => addDays(today(), n), n);
        const time = [t, await add(1), await add(2), await add(3), await add(4), await add(5), await add(6)];
        // Hoy lluvia; mañana seco y frío; después, seco y templado
        return json({ daily: { time, weather_code: [61, 1, 0, 3, 2, 0, 1], temperature_2m_max: [16, 12, 18, 19, 20, 18, 17], temperature_2m_min: [9, 3, 6, 7, 8, 7, 6], precipitation_probability_max: [85, 5, 0, 10, 0, 0, 5], precipitation_sum: [5.2, 0, 0, 0, 0, 0, 0], wind_speed_10m_max: [15, 10, 8, 12, 9, 7, 10] } });
      }
      return r.abort();
    });
    await p.goto(base, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof ACT !== "undefined" && typeof CasaHousePlan !== "undefined" && ACT.housePlan);
    await p.evaluate(() => {
      S = fresh(); ui.taskView = "todas"; // la vista completa de siempre (pestaña «Todas»)
      S.tasks = [{ id: "tender", title: "Tender la ropa", date: today(), who: "yo", repeat: "none", notes: "", done: false }];
      ui.view = "tareas"; ui.taskMode = "tasks"; ui.personFilter = "all"; ui.taskFilter = "pend";
      save();
    });
    const ok = () => p.locator(".overlay [data-s=ok]").last().click();

    // 1) Ubicación: se busca, se elige y queda en los datos de la casa (redondeada)
    await p.evaluate(() => { ui.taskView = "todas"; ui.taskOptsOpen = true; render(); }); // el tiempo está en Todas › Más opciones
    assert.match(await p.locator(".wx").innerText(), /Indica dónde está la casa/);
    assert.equal(forecastCalls, 0);
    await p.locator("[data-act=wxPlace]").click();
    await p.locator("#wxQ").fill("Villa");
    await p.locator("[data-wx-search]").click();
    await p.locator("[data-wx-pick]").first().click();
    await p.waitForFunction(() => document.querySelectorAll(".wx-day").length === 5);
    assert.deepEqual(await p.evaluate(() => S.cook.homeWeather), { name: "Villa de Prueba", region: "Provincia de Ejemplo", lat: 40.12, lon: -3.68 });
    const card = await p.locator(".wx").innerText();
    assert.match(card, /Villa de Prueba/);
    assert.match(card, /no tiendas fuera/);
    assert.match(card, /Ver en eltiempo\.es/);
    assert.equal(await p.locator(".wx a", { hasText: "eltiempo.es" }).getAttribute("href"), "https://www.eltiempo.es/villa-de-prueba.html");

    // 2) La tarea de tender pasa al próximo día seco y se puede deshacer
    const tomorrow = await p.evaluate(() => addDays(today(), 1));
    await p.locator(".wx-recs li", { hasText: "Tender la ropa" }).locator("[data-act=wxMove]").click();
    assert.equal(await p.evaluate(() => S.tasks.find((t) => t.id === "tender").date), tomorrow);
    await p.locator(".toast-undo").click();
    assert.equal(await p.evaluate(() => S.tasks.find((t) => t.id === "tender").date), await p.evaluate(() => today()));

    // 3) Plan de limpieza: zonas, recuento, creación, deshacer y sin duplicados
    await p.evaluate(() => { ui.taskView = "todas"; render(); });
    await p.evaluate(() => document.querySelectorAll("details.task-options").forEach((d) => (d.open = true))); await p.locator("#app [data-act=housePlan]:visible").first().click();
    assert.match(await p.locator("[data-plan-count]").innerText(), new RegExp("Se crearán " + P.ITEMS.length + " tareas"));
    await p.locator('[data-plan-zone="gimnasio"]').uncheck();
    const expected = P.ITEMS.length - P.ITEMS.filter((i) => i.zone === "gimnasio").length;
    assert.match(await p.locator("[data-plan-count]").innerText(), new RegExp("Se crearán " + expected + " tareas"));
    await ok();
    const planCount = () => p.evaluate(() => S.tasks.filter((t) => t.plan === "casa").length);
    assert.equal(await planCount(), expected);
    await p.locator(".toast-undo").click();
    assert.equal(await planCount(), 0);
    await p.evaluate(() => document.querySelectorAll("details.task-options").forEach((d) => (d.open = true))); await p.locator("#app [data-act=housePlan]:visible").first().click();
    await p.locator('[data-plan-zone="gimnasio"]').uncheck();
    await p.locator("#planWho").selectOption("alternar");
    await ok();
    assert.equal(await planCount(), expected);
    assert.deepEqual(await p.evaluate(() => [...new Set(S.tasks.filter((t) => t.plan === "casa").map((t) => t.who))].sort()), ["juanma", "yo"]);
    await p.evaluate(() => document.querySelectorAll("details.task-options").forEach((d) => (d.open = true))); await p.locator("#app [data-act=housePlan]:visible").first().click();
    assert.match(await p.locator(".overlay").innerText(), new RegExp("Ya tienes " + expected + " tareas del plan"));
    // Recuerda las zonas elegidas: el gimnasio sigue desmarcado y no hay nada nuevo que crear
    assert.equal(await p.locator('[data-plan-zone="gimnasio"]').isChecked(), false);
    assert.equal(await p.locator('[data-plan-zone="ropa"]').isChecked(), true);
    assert.match(await p.locator("[data-plan-count]").innerText(), /No hay tareas nuevas/);
    await p.locator(".overlay [data-s=cancel]").click();
    const titles = await p.evaluate(() => [...document.querySelectorAll("#app .row-title")].map((x) => x.textContent));
    assert.equal(new Set(titles).size, titles.length, "cada tarea aparece una sola vez");
    for (const t of ["Purgar los radiadores antes de encender la calefacción", "Día de colada: poner lavadoras", "Segundo día de colada: poner lavadoras", "Doblar y guardar la ropa limpia", "Doblar y guardar la ropa limpia (2.ª vez)"]) assert.ok(titles.includes(t), t);

    // Consejos: desde la propia tarea, en su ficha y en la biblioteca
    await p.locator(".row", { hasText: "Rieles de las ventanas" }).locator(".tip-inline").click();
    assert.match(await p.locator(".overlay").last().innerText(), /Rieles de las ventanas[\s\S]*cepillo de dientes/);
    await p.locator(".overlay [data-tips-all]").click();
    assert.equal(await p.locator(".overlay .tips-lib details").count(), Object.keys(P.TIPS).length);
    await p.locator(".overlay [data-s=cancel]").click();
    await p.locator(".row", { hasText: "Cintas de las persianas" }).locator(".row-main").click();
    assert.match(await p.locator(".overlay .tipbox summary").innerText(), /Cómo hacerlo: Cintas de las persianas/);
    await p.locator(".overlay [data-s=cancel]").click();
    await p.evaluate(() => document.querySelectorAll("details.task-options").forEach((d) => (d.open = true))); await p.locator("#app [data-act=tipsLibrary]:visible").first().click();
    assert.equal(await p.locator(".overlay .tips-lib details").count(), Object.keys(P.TIPS).length);
    await p.locator(".overlay [data-s=cancel]").click();

    // Calendario de temporada al final de Tareas: 3 meses o todo el año
    assert.equal(await p.locator(".season .season-m").count(), 3);
    assert.match(await p.locator(".season .season-m").first().innerText(), /^Este mes/);
    await p.locator("[data-act=seasonAll]").click();
    assert.equal(await p.locator(".season .season-m").count(), 12);
    await p.locator("[data-act=seasonAll]").click();

    // 4) Frío mañana: pregunta por la calefacción y adelanta la purga de radiadores
    await p.evaluate(() => { ui.taskView = "todas"; ui.taskOptsOpen = true; render(); }); // el tiempo está en Todas › Más opciones
    const heat = p.locator(".wx-recs li", { hasText: "¿has puesto ya la calefacción?" });
    assert.equal(await heat.count(), 1);
    await heat.locator("[data-act=wxMove]").click();
    assert.equal(await p.evaluate(() => S.tasks.find((t) => t.planKey === "radiadores-purgar").date), await p.evaluate(() => today()));
    assert.match(await p.locator(".wx").innerText(), /Día de interior: puedes adelantar|Rincón de hoy/);
    await p.evaluate(() => { ui.taskView = "todas"; render(); });
    assert.match(await p.locator(".season").innerText(), /Purgar los radiadores/);

    // En el Calendario (vista de mes) las tareas de temporada aparecen en su día y abajo, en «toca»
    await p.locator('#tabs [data-v="semana"]').click();
    assert.match(await p.locator("section.day").innerText(), /Purgar los radiadores/);
    assert.ok(await p.locator('.mcell.today .dots i[style*="c-tareas"]').count());
    assert.match(await p.locator(".season").innerText(), /toca[\s\S]*Purgar los radiadores/);
    assert.doesNotMatch(await p.locator("section.day").innerText(), /Rieles de las ventanas|Poner una lavadora/, "el resto de tareas sigue solo en Tareas");
    await p.evaluate(() => { document.querySelector("#toast").classList.remove("show"); const box = $("#app"), sec = box.querySelector(".season"); box.scrollTop = sec.offsetTop - 80; });
    await p.screenshot({ path: (process.env.SHOT || path.join(require("node:os").tmpdir(), "casa-tareas-tiempo.png")).replace(/\.png$/, "-calendario.png"), fullPage: true });
    await p.locator('#tabs [data-v="tareas"]').click();
    await p.screenshot({ path: process.env.SHOT || path.join(require("node:os").tmpdir(), "casa-tareas-tiempo.png"), fullPage: false });

    // 5) Sin conexión, al volver a abrir se ve la última previsión guardada sin pedirla otra vez
    forecastUp = false;
    const callsBefore = forecastCalls;
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof ACT !== "undefined");
    await p.evaluate(() => { ui.view = "tareas"; ui.taskMode = "tasks"; ui.taskView = "todas"; ui.taskOptsOpen = true; render(); });
    assert.equal(await p.locator(".wx-day").count(), 5);
    assert.equal(forecastCalls, callsBefore, "la previsión reciente no se vuelve a pedir");
    assert.ok(forecastCalls <= 2, "sin bucles de peticiones: " + forecastCalls);

    // Reparto por días (una sola vez): lo largo que había caído entre semana pasa al domingo, con copia y aviso;
    // si luego se mueve a mano, ya no se vuelve a tocar
    await p.evaluate(() => {
      const t = today(), mon = addDays(t, 7 - ((new Date(t + "T12:00:00").getDay() + 6) % 7)); // lunes que viene
      S.tasks = [{ id: "nev", title: "Nevera: vaciar y limpiar por dentro", date: mon, repeat: "custom", every: 4, unit: "w", who: "yo", notes: "", done: false, plan: "casa", planKey: "nevera" }];
      S.cook = { ...(S.cook || {}) }; delete S.cook.planDays; S.routines = []; save();
    });
    await p.waitForFunction(() => S.cook.planDays === 2);
    const nev = await p.evaluate(() => S.tasks.find((t) => t.id === "nev").date);
    assert.equal(await p.evaluate((d) => new Date(d + "T12:00:00").getDay(), nev), 0, "la nevera pasa al domingo");
    assert.match(await p.locator("#toast").innerText(), /lo largo el fin de semana · 1 tarea cambiada de día/);
    assert.equal(await p.evaluate(() => localBackups().some((b) => b.label === "Antes de repartir el plan por días")), true);
    await p.evaluate(() => { const t = S.tasks.find((t) => t.id === "nev"); t.date = addDays(t.date, 1); save(); });
    await p.evaluate(() => render());
    assert.equal(await p.evaluate((d) => S.tasks.find((t) => t.id === "nev").date === addDays(d, 1), nev), true, "lo movido a mano se respeta");
    await p.evaluate(() => { ui.view = "tareas"; ui.taskMode = "tasks"; ui.taskView = "todas"; ui.personFilter = "all"; ui.taskFilter = "pend"; render(); });
    assert.match(await p.locator("#app").innerText(), /⏱ 40 min/);
    // Calendario de temporada: se puede marcar como hecho desde la propia lista
    await p.evaluate(() => {
      const t = today();
      S.tasks.push({ id: "temp1", title: "Burletes de prueba", date: addDays(t, 2), repeat: "none", who: "yo", notes: "", done: false, plan: "casa", planKey: "burletes", planKind: "temporada" });
      ui.view = "tareas"; ui.taskMode = "tasks"; ui.personFilter = "all"; render();
    });
    await p.locator('section.season [data-act=toggleTask][data-id="temp1"]').click();
    assert.equal(await p.evaluate(() => S.tasks.find((t) => t.id === "temp1").done), true);
    assert.match(await p.locator("section.season li.is-done", { hasText: "Burletes de prueba" }).innerText(), /Hecho el/);
    await p.locator('section.season [data-act=toggleTask][data-id="temp1"]').click();
    assert.equal(await p.evaluate(() => S.tasks.find((t) => t.id === "temp1").done), false, "y desmarcarlo");
    assert.deepEqual(errors, [], "errores de página");
    console.log("house-plan-flow: OK");
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
