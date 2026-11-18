// Compras › Lidl: ofertas desde casa/lidl.json, filtros, búsqueda y añadir a la lista.
// El archivo se sustituye por datos sintéticos; sin Firebase ni la web de Lidl.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path");
const fixture = {
  at: "2026-11-18T05:43:00Z",
  region: "Granada",
  items: [
    { c: "1", n: "MILBONA Yogur bífidus", g: "super", s: "Postres y yogures", w: "semana", p: 1.15, o: 1.45, d: 20, k: "4x150 g", b: "En tienda", f: "2026-11-16", e: "2026-11-22", u: "/p/yogur/p1" },
    { c: "2", n: "ALESTO Cacahuetes fritos", g: "super", s: "Aperitivos", p: 0.75, k: "250 g", b: "En tienda", u: "/p/cacahuetes/p2" },
    { c: "3", n: "Naranja mesa", g: "fruta", s: "Fruta y verdura", w: "finde", p: 1.29, o: 1.89, d: 31, k: "A granel", f: "2026-11-20", e: "2026-11-22", u: "/p/naranja/p3" },
    { c: "4", n: "FORMIL Detergente Marsella", g: "limpieza", s: "Limpieza y hogar", w: "semana", p: 3.49, o: 4.29, d: 19, k: "40 lavados", u: "/p/detergente/p4" },
    { c: "6", n: "Caracola con uvas pasas", g: "super", s: "Panadería y pastelería", b: "En tienda", u: "/p/caracola/p6" },
    { c: "7", n: "Realvalle Pechuga de pollo fileteada", g: "super", s: "Carne", w: "proxima", p: 5.69, o: 7.2, d: 20, l: 5.29, k: "Aprox. 950 g", f: "2026-11-23", e: "2026-11-30", u: "/p/pollo/p7" },
    { c: "8", n: "Pan de pueblo", g: "super", s: "Panadería y pastelería", w: "finde-proxima", p: 0.99, f: "2026-11-27", e: "2026-11-29", u: "/p/pan/p8" },
  ],
};
(async () => {
  const root = path.resolve(__dirname, ".."),
    server = http.createServer((req, res) => {
      const u = new URL(req.url, "http://local"),
        file = path.resolve(root, "." + (u.pathname.endsWith("/") ? u.pathname + "index.html" : u.pathname));
      if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
      if (u.pathname === "/casa/config.js") { res.setHeader("Content-Type", "application/javascript"); return res.end("window.claude={use:async()=>null}"); }
      if (u.pathname === "/casa/lidl.json") { res.setHeader("Content-Type", "application/json"); return res.end(JSON.stringify(fixture)); }
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
    await p.waitForFunction(() => typeof ACT !== "undefined" && ACT.lidlAdd);
    await p.evaluate(() => { S = fresh(); ui.view = "compras"; ui.ckTab = "lista"; save(); });
    await p.locator('#app [data-act=ckTab][data-v="lidl"]').first().click();
    await p.waitForFunction(() => document.querySelectorAll(".lidl-card").length > 0);

    // Esta semana (por defecto), de mayor a menor descuento, con fechas y precios de Granada
    const names = () => p.evaluate(() => [...document.querySelectorAll(".lidl-card .lidl-name")].map((x) => x.textContent));
    // Agrupado por secciones (en orden alfabético, como Mercadona)
    assert.deepEqual(await names(), ["FORMIL Detergente Marsella", "MILBONA Yogur bífidus"]);
    assert.deepEqual(await p.evaluate(() => [...document.querySelectorAll(".lidl-sec")].map((h) => h.textContent)), ["Limpieza y hogar 1", "Postres y yogures 1"]);
    const yogur = await p.locator(".lidl-card", { hasText: "MILBONA" }).innerText();
    assert.match(yogur, /-20%[\s\S]*4x150 g[\s\S]*1,15 €[\s\S]*1,45 €[\s\S]*Esta semana del 16\/11 al 22\/11/);
    assert.match(await p.locator("#app").innerText(), /tiendas Lidl de Granada, con el precio Lidl Plus/);
    await p.locator('[data-act=lidlFilter][data-v="finde"]').click();
    assert.deepEqual(await names(), ["Naranja mesa"]);
    assert.match(await p.locator(".lidl-card").innerText(), /Fin de semana del 20\/11 al 22\/11/);
    await p.locator('[data-act=lidlFilter][data-v="proxima"]').click();
    assert.deepEqual(await names(), ["Realvalle Pechuga de pollo fileteada", "Pan de pueblo"]);
    assert.match(await p.locator(".lidl-card", { hasText: "Pechuga" }).innerText(), /5,69 €[\s\S]*Con Lidl Plus: 5,29 €[\s\S]*Próxima semana del 23\/11 al 30\/11/);
    assert.match(await p.locator(".lidl-card", { hasText: "Pan de pueblo" }).innerText(), /Fin de semana que viene del 27\/11 al 29\/11/);

    // Comida y limpieza; sin bazar ni droguería
    await p.locator('[data-act=lidlFilter][data-v="super"]').click();
    assert.deepEqual(await names(), ["ALESTO Cacahuetes fritos", "Realvalle Pechuga de pollo fileteada", "Caracola con uvas pasas", "Pan de pueblo", "MILBONA Yogur bífidus"]);
    assert.deepEqual(await p.evaluate(() => [...document.querySelectorAll(".lidl-sec")].map((h) => h.textContent)), ["Aperitivos 1", "Carne 1", "Panadería y pastelería 2", "Postres y yogures 1"]);
    // Botones de sección en «Comida»
    await p.locator('[data-act=lidlSec][data-v="Panadería y pastelería"]').click();
    assert.deepEqual(await names(), ["Caracola con uvas pasas", "Pan de pueblo"]);
    await p.locator('[data-act=lidlSec][data-v=""]').click();
    assert.equal(await p.locator(".lidl-card").count(), 5);
    assert.match(await p.locator(".lidl-card", { hasText: "Caracola" }).innerText(), /Precio en tienda/);
    await p.locator('[data-act=lidlFilter][data-v="limpieza"]').click();
    assert.deepEqual(await names(), ["FORMIL Detergente Marsella"]);
    assert.equal(await p.locator('[data-act=lidlFilter][data-v="bazar"], [data-act=lidlFilter][data-v="casa"]').count(), 0);

    // Búsqueda en todo el surtido, sin perder el cursor
    await p.locator("#qLidl").fill("yogur");
    await p.waitForFunction(() => [...document.querySelectorAll(".lidl-card .lidl-name")].map((x) => x.textContent).join() === "MILBONA Yogur bífidus");
    assert.equal(await p.evaluate(() => document.activeElement.id), "qLidl");

    // Añadir a la lista con precio y envase
    await p.locator(".lidl-card", { hasText: "MILBONA" }).locator("[data-act=lidlAdd]").click();
    // Va a su propia lista «Lidl», separada de la cesta de Mercadona (lista del súper)
    const item = await p.evaluate(() => S.items.find((i) => i.store === "Lidl"));
    assert.deepEqual([item.name, item.qty, item.price, item.listId, item.section], ["MILBONA Yogur bífidus", "4x150 g", 1.15, "lidl", "Frescos"]);
    assert.deepEqual(await p.evaluate(() => S.lists.filter((l) => l.id === "lidl").map((l) => l.name)), ["Lidl"]);
    assert.equal(await p.evaluate(() => cartItems().length), 0, "no entra en la cesta de Mercadona");
    assert.match(await p.locator("#toast").innerText(), /añadido a la lista Lidl/);
    // Lo que se metió antes en la lista del súper pasa solo a la lista Lidl
    await p.evaluate(() => { S.items.push({ id: "viejo", listId: "super", name: "FORMIL Detergente Marsella (Lidl)", section: "Limpieza", qty: "", by: "", done: false, units: 1, store: "Lidl" }, { id: "merca", listId: "super", name: "Leche", section: "Frescos", qty: "", by: "", done: false, units: 1 }); save(); });
    await p.waitForFunction(() => S.items.find((i) => i.id === "viejo").listId === "lidl");
    assert.deepEqual(await p.evaluate(() => [S.items.find((i) => i.id === "viejo").name, S.items.find((i) => i.id === "merca").listId, S.lists.filter((l) => l.id === "lidl").length]), ["FORMIL Detergente Marsella", "super", 1]);
    assert.match(await p.locator("#toast").innerText(), /1 producto de Lidl pasado a su lista/);
    await p.locator('#app [data-act=ckTab][data-v="lista"]').first().click();
    await p.locator('[data-act=pickList][data-v="lidl"]').click();
    const lidlList = await p.locator("#app").innerText();
    assert.match(lidlList, /MILBONA Yogur bífidus/);
    assert.match(lidlList, /FORMIL Detergente Marsella/);
    assert.doesNotMatch(lidlList, /\bLeche\b/);
    await p.locator('#app [data-act=ckTab][data-v="lidl"]').first().click();
    assert.equal(await p.evaluate(() => document.body.scrollWidth <= innerWidth + 2), true, "sin desbordar a 390 px");
    await p.setViewportSize({ width: 320, height: 800 });
    assert.equal(await p.evaluate(() => document.body.scrollWidth <= innerWidth + 2), true, "sin desbordar a 320 px");
    if (process.env.SHOT) { await p.locator("#qLidl").fill(""); await p.locator('[data-act=lidlFilter][data-v="semana"]').click(); await p.setViewportSize({ width: 390, height: 844 }); await p.screenshot({ path: process.env.SHOT }); }

    // La lista «Mercadillo» se quita (con copia de seguridad) y las demás se conservan
    await p.evaluate(() => { S.lists.push({ id: "mk", name: "Mercadillo" }); S.items.push({ id: "tom", listId: "mk", name: "Tomates", section: "Fruta y verdura", qty: "", by: "", done: false, units: 1 }); save(); });
    await p.waitForFunction(() => !S.lists.some((l) => l.name === "Mercadillo"));
    assert.deepEqual(await p.evaluate(() => [S.lists.map((l) => l.id).sort().join(), S.items.some((i) => i.id === "tom"), localBackups().some((b) => b.label === "Antes de quitar la lista Mercadillo")]), ["casa,farmacia,lidl,super", false, true]);
    // Las seis pestañas de Compras caben en una fila, en todas ellas
    await p.setViewportSize({ width: 390, height: 844 });
    for (const tab of ["lista", "productos", "lidl", "despensa"]) {
      await p.evaluate((t) => { ui.ckTab = t; render(); }, tab);
      assert.equal(await p.evaluate(() => new Set([...document.querySelectorAll(".ck-tabs .chip")].map((c) => Math.round(c.getBoundingClientRect().top))).size), 1, tab + ": una sola fila");
    }

    assert.deepEqual(errors, [], "errores de página");
    console.log("lidl-flow: OK");
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
