// Hoy: las citas del día en «Importante» y el aviso «¡Acuérdate!» 3 días antes. Datos sintéticos.
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
      S.events = [
        { id: "pelu", title: "Ringo: Peluquería", date: t, time: "10:00", petAppointment: "grooming", repeat: "none" },
        { id: "dentista", title: "Dentista", date: a(2), time: "17:00", repeat: "none" },
        { id: "yoga", title: "Yoga", date: a(-7), time: "19:00", repeat: "weekly" },
        { id: "lejos", title: "Boda", date: a(5), repeat: "none" },
      ];
      S.tasks = [
        { ...base, id: "itv", title: "Pasar la ITV", date: a(3) },
        { ...base, id: "plan", title: "Baño principal", date: a(1), repeat: "weekly", planKey: "bano" },
        { ...base, id: "hoy", title: "Tender", date: t },
      ];
      ui.view = "hoy"; render();
    });
    const imp = await p.locator("section.hsec.imp").innerText();
    assert.match(imp, /Ringo: Peluquería/);
    const acu = await p.locator("details.acuerdate").innerText();
    assert.match(acu, /Acuérdate/);
    assert.match(acu, /Dentista/); assert.match(acu, /Pasado mañana/);
    assert.match(acu, /Pasar la ITV/);
    assert.doesNotMatch(acu, /Baño principal|Boda|Peluquería/);
    assert.ok(await p.locator("details.acuerdate").evaluate((d) => d.open));
    await p.locator("details.acuerdate summary").click();
    assert.equal(await p.locator("details.acuerdate").evaluate((d) => d.open), false);
    await p.evaluate(() => render());
    assert.equal(await p.locator("details.acuerdate").evaluate((d) => d.open), false);
    await p.locator("details.acuerdate summary").click();
    await p.screenshot({ path: process.env.SHOT || "/tmp/acu.png", fullPage: false, scale: "device" });
    const app = await p.locator("#app").innerText();
    assert.equal((app.match(/Ringo: Peluquería/g) || []).length, 1, app);
    assert.match(app, /Tender/);
    assert.deepEqual(errors, []);
    console.log("ok acuerdate");
  } finally {
    await browser?.close();
    server.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
