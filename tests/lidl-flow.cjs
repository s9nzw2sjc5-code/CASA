// Compras › Lidl: ofertas desde casa/lidl.json, filtros, búsqueda y añadir a la lista.
// El archivo se sustituye por datos sintéticos; sin Firebase ni la web de Lidl.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path");
const fixture = {
  at: "2026-11-18T05:43:00Z",
  items: [
    { c: "1", n: "MILBONA Yogur bífidus", g: "super", s: "Alimentación", p: 1.15, o: 1.45, d: 20, k: "4x150 g", b: "En tienda", u: "/p/yogur/p1" },
    { c: "2", n: "ALESTO Cacahuetes fritos", g: "super", s: "Alimentación", p: 0.75, k: "250 g", b: "En tienda", u: "/p/cacahuetes/p2" },
    { c: "3", n: "Mandarina nacional", g: "fruta", s: "Fruta y verdura", p: 1.99, o: 2.49, d: 20, k: "1 kg", u: "/p/mandarina/p3" },
    { c: "4", n: "FORMIL Detergente Marsella", g: "casa", s: "Droguería y hogar", p: 3.49, o: 4.29, d: 19, k: "40 lavados", u: "/p/detergente/p4" },
    { c: "5", n: "SILVERCREST Yogurtera", g: "bazar", s: "Hogar y cocina", p: 24.99, o: 26.99, d: 7, b: "Desde 23.11 también en tienda", e: "2026-11-29", u: "/p/yogurtera/p5" },
    { c: "6", n: "Caracola con uvas pasas", g: "super", s: "Alimentación", b: "En tienda", u: "/p/caracola/p6" },
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

    // Ofertas: solo con descuento, de mayor a menor
    const names = () => p.evaluate(() => [...document.querySelectorAll(".lidl-card .lidl-name")].map((x) => x.textContent));
    assert.deepEqual(await names(), ["Mandarina nacional", "MILBONA Yogur bífidus", "FORMIL Detergente Marsella", "SILVERCREST Yogurtera"]);
    const yogur = await p.locator(".lidl-card", { hasText: "MILBONA" }).innerText();
    assert.match(yogur, /-20%[\s\S]*4x150 g[\s\S]*1,15 €[\s\S]*1,45 €/);
    assert.match(await p.locator(".lidl-card", { hasText: "Yogurtera" }).innerText(), /Desde 23\.11 también en tienda · hasta el 29\/11/);
    assert.match(await p.locator("#app").innerText(), /mismos en toda España/);

    // Filtros y bazar agrupado
    await p.locator('[data-act=lidlFilter][data-v="super"]').click();
    assert.deepEqual(await names(), ["ALESTO Cacahuetes fritos", "Caracola con uvas pasas", "MILBONA Yogur bífidus"]);
    assert.match(await p.locator(".lidl-card", { hasText: "Caracola" }).innerText(), /Precio en tienda/);
    await p.locator('[data-act=lidlFilter][data-v="bazar"]').click();
    assert.equal(await p.locator(".lidl-groups h4").innerText(), "Hogar y cocina");

    // Búsqueda en todo el surtido, sin perder el cursor
    await p.locator("#qLidl").fill("yogur");
    await p.waitForFunction(() => document.querySelectorAll(".lidl-card").length === 2);
    assert.deepEqual((await names()).sort(), ["MILBONA Yogur bífidus", "SILVERCREST Yogurtera"]);
    assert.equal(await p.evaluate(() => document.activeElement.id), "qLidl");

    // Añadir a la lista con precio y envase
    await p.locator(".lidl-card", { hasText: "MILBONA" }).locator("[data-act=lidlAdd]").click();
    const item = await p.evaluate(() => S.items.find((i) => /Lidl/.test(i.name)));
    assert.deepEqual([item.name, item.qty, item.price, item.store, item.listId], ["MILBONA Yogur bífidus (Lidl)", "4x150 g", 1.15, "Lidl", "super"]);
    assert.equal(await p.evaluate(() => document.body.scrollWidth <= innerWidth + 2), true, "sin desbordar a 390 px");
    await p.setViewportSize({ width: 320, height: 800 });
    assert.equal(await p.evaluate(() => document.body.scrollWidth <= innerWidth + 2), true, "sin desbordar a 320 px");
    if (process.env.SHOT) { await p.locator("#qLidl").fill(""); await p.locator('[data-act=lidlFilter][data-v="ofertas"]').click(); await p.setViewportSize({ width: 390, height: 844 }); await p.screenshot({ path: process.env.SHOT }); }

    assert.deepEqual(errors, [], "errores de página");
    console.log("lidl-flow: OK");
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
