// Exploratory audit of daily flows not covered by shopping/receipt suites.
// Synthetic data only; config is served locally without Firebase or external writes.
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
          "." +
            (u.pathname.endsWith("/") ? u.pathname + "index.html" : u.pathname),
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
            ".mjs": "application/javascript",
            ".wasm": "application/wasm",
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
    browser = await chromium.launch({
      executablePath: "/usr/bin/chromium",
      args: ["--no-sandbox"],
    });
    p = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      locale: "es-ES",
      timezoneId: "Europe/Madrid",
      serviceWorkers: "block",
    });
    p.on("pageerror", (e) => errors.push(e.message));
    await p.addInitScript(() =>
      localStorage.setItem("casa-ai-key", "sk-ant-audit-legacy-placeholder"),
    );
    await p.route("https://**/*", (r) =>
      r.request().url().startsWith("https://prod-mercadona.imgix.net/")
        ? r.fulfill({
            contentType: "image/svg+xml",
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="100"><rect x="20" y="4" width="40" height="90" fill="green"/></svg>',
          })
        : r.abort(),
    );
    await p.goto("http://127.0.0.1:" + server.address().port + "/casa/", {
      waitUntil: "domcontentloaded",
    });
    await p.waitForFunction(() => typeof ACT !== "undefined");
    assert.equal(
      await p.evaluate(() => localStorage.getItem("casa-ai-key")),
      null,
    );
    await p.evaluate(async () => {
      await loadMC();
      S = fresh();
      ui.view = "hoy";
      ui.me = "yo";
      save();
    });
    const tab = async (name) =>
        p.locator('#tabs [data-v="' + name + '"]').click(),
      close = async () => {
        while (await p.locator(".overlay").count())
          await p.locator(".overlay").last().locator("[data-s=cancel]").click();
      },
      ok = () => p.locator(".overlay [data-s=ok]").last().click();
    // Quick add, recurring overdue task, postponement and reversible deletion.
    await p.locator("#qTask").fill("Tarea rápida de auditoría");
    await p.locator("#qTask").press("Enter");
    assert.equal(await p.evaluate(() => S.tasks.length), 1);
    await tab("tareas");
    await p.locator("#fab").click();
    await p.locator("#f_t").fill("Limpieza periódica de auditoría");
    await p.locator("#f_d").fill(await p.evaluate(() => addDays(today(), -2)));
    await p.locator("#f_w").selectOption("juanma");
    await p.locator("#f_r").selectOption("custom");
    await p.locator("#f_ce").fill("0");
    await ok();
    assert.equal(await p.evaluate(() => S.tasks.length), 1);
    assert.equal(await p.locator(".overlay").count(), 1);
    await p.locator("#f_ce").fill("7");
    await p.locator("#f_cu").selectOption("d");
    await p.locator("#f_n").fill("Nota con acentos: revisión\nSegunda línea");
    await ok();
    const repeating = await p.evaluate(() =>
      S.tasks.find((t) => t.title === "Limpieza periódica de auditoría"),
    );
    await p
      .locator(
        '[data-act=answerNotice][data-kind=task][data-id="' +
          repeating.id +
          '"]',
      )
      .click();
    assert.equal(await p.locator("[data-response]").count(), 2);
    await p.locator("[data-response=tomorrow]").click();
    assert.equal(
      await p.evaluate(
        (id) => S.tasks.find((t) => t.id === id).date,
        repeating.id,
      ),
      await p.evaluate(() => addDays(today(), 1)),
    );
    assert.equal(
      await p.evaluate(
        (id) => S.tasks.find((t) => t.id === id).done,
        repeating.id,
      ),
      false,
    );
    await p.locator("#toast .toast-undo").click();
    assert.equal(
      await p.evaluate(
        (id) => S.tasks.find((t) => t.id === id).date,
        repeating.id,
      ),
      repeating.date,
    );
    await p
      .locator('[data-act=toggleTask][data-id="' + repeating.id + '"]')
      .click();
    assert.equal(
      await p.evaluate(
        (id) => S.tasks.find((t) => t.id === id).date,
        repeating.id,
      ),
      await p.evaluate(() => addDays(today(), 5)),
    );
    await p.locator("[data-act=pFilter][data-v=juanma]").click();
    assert.equal(await p.locator("#app [data-act=toggleTask]").count(), 1);
    await p.locator("[data-act=pFilter][data-v=all]").click();
    await p
      .locator('[data-act=editTask][data-id="' + repeating.id + '"]')
      .click();
    assert.equal(
      await p.locator("#f_n").inputValue(),
      "Nota con acentos: revisión\nSegunda línea",
    );
    await p.locator(".overlay [data-s=del]").click();
    assert.equal(await p.evaluate(() => S.tasks.length), 1);
    await p.locator("#toast .toast-undo").click();
    assert.equal(await p.evaluate(() => S.tasks.length), 2);
    await p.waitForFunction(
      () => !document.querySelector("#toast").classList.contains("show"),
      null,
      { timeout: 4000 },
    );
    console.log(
      "PASS daily tasks, recurrence, postpone/undo, filter, notes and toast expiry",
    );
    // Calendar validation, month/day navigation and Google export of a dated event.
    await tab("semana");
    await p.locator("#fab").click();
    await p.locator("#f_t").fill("Evento de auditoría");
    const eventDate = await p.evaluate(() => addDays(today(), 3));
    await p.locator("#f_d").fill(eventDate);
    await p.locator("#f_h").fill("18:00");
    await p.locator("#f_he").fill("17:00");
    await ok();
    assert.equal(await p.evaluate(() => S.events.length), 0);
    await p.locator("#f_he").fill("19:00");
    await p.locator("#f_pl").fill("Lugar de prueba");
    await p.locator("#f_r").selectOption("weekly");
    await ok();
    const event = await p.evaluate(() =>
      S.events.find((e) => e.title === "Evento de auditoría"),
    );
    await p.locator('[data-act=calDay][data-v="' + eventDate + '"]').click();
    await p
      .locator('[data-act=editEvent][data-id="' + event.id + '"]')
      .first()
      .click();
    const calendar = new URL(
      await p
        .getByRole("link", { name: "Añadir a Google Calendar", exact: true })
        .getAttribute("href"),
    );
    assert.equal(calendar.searchParams.get("text"), "Evento de auditoría");
    assert.equal(calendar.searchParams.get("recur"), "RRULE:FREQ=WEEKLY");
    assert.equal(calendar.searchParams.get("location"), "Lugar de prueba");
    assert(calendar.searchParams.get("dates").includes("T180000/"));
    await p.locator(".overlay [data-s=del]").click();
    assert.equal(await p.evaluate(() => S.events.length), 0);
    await p.locator("#toast .toast-undo").click();
    assert.equal(await p.evaluate(() => S.events.length), 1);
    console.log(
      "PASS calendar event validation, month/day navigation, recurrence export and delete/undo",
    );
    // Grooming appointments stay in Calendar and never create the removed top duplicate.
    await tab("ringo");
    assert.equal(
      await p.locator('[data-act=petHygiene][data-v="Peluquería"]').count(),
      0,
    );
    await p.locator("[data-act=newGrooming]").click();
    const groomingDate = await p.evaluate(() => addDays(today(), 7));
    await p.locator("#f_d").fill(groomingDate);
    await p.locator("#f_h").fill("11:30");
    await ok();
    await p.locator("[data-act=newGrooming]").click();
    await p.locator("#f_d").fill(groomingDate);
    await p.locator("#f_h").fill("11:30");
    await ok();
    assert.equal(
      await p.evaluate(
        () => S.events.filter((e) => e.petAppointment === "grooming").length,
      ),
      1,
    );
    await close();
    assert.equal(
      await p.evaluate(
        (date) =>
          dayData(date).es.filter((e) => e.petAppointment === "grooming")
            .length,
        groomingDate,
      ),
      1,
    );
    await p.locator("#fab").click();
    await p.locator("#f_t").fill("Cuidado periódico de auditoría");
    await p
      .locator("#f_last")
      .fill(await p.evaluate(() => addDays(today(), -16)));
    await p.locator("#f_e").fill("14");
    await p.locator("#f_u").selectOption("d");
    await ok();
    const care = await p.evaluate(() =>
      S.pet.find((x) => x.name === "Cuidado periódico de auditoría"),
    );
    await p.locator('[data-act=petDone][data-id="' + care.id + '"]').click();
    const completed = await p.evaluate(
      (id) => petHistory().find((e) => e.careId === id && e.src === "log"),
      care.id,
    );
    assert.equal(
      await p.evaluate((id) => petDue(S.pet.find((x) => x.id === id)), care.id),
      await p.evaluate(() => addDays(today(), 14)),
    );
    await p.locator("[data-act=ringoTab][data-v=hist]").click();
    await p
      .locator('[data-act=editHist][data-id="' + completed.id + '"]')
      .click();
    const corrected = await p.evaluate(() => addDays(today(), -1));
    await p.locator("#f_d").fill(await p.evaluate(() => addDays(today(), 1)));
    await ok();
    assert.equal(await p.locator(".overlay").count(), 1);
    assert.equal(
      await p.evaluate((id) => S.pet.find((x) => x.id === id).last, care.id),
      await p.evaluate(() => today()),
    );
    await p.locator("#f_d").fill(corrected);
    await ok();
    const history = await p.evaluate(
      (id) =>
        petHistory()
          .filter((e) => e.careId === id)
          .map((e) => e.date)
          .sort(),
      care.id,
    );
    assert.deepEqual(
      history,
      [care.last, corrected].sort(),
      "Correcting a care record must remove its old generated date",
    );
    assert.equal(
      await p.evaluate((id) => S.pet.find((x) => x.id === id).last, care.id),
      corrected,
      "The care schedule must follow the corrected latest completion",
    );
    await p
      .locator('[data-act=editHist][data-id="' + completed.id + '"]')
      .click();
    await p.locator(".overlay [data-s=del]").click();
    assert.equal(
      await p.evaluate(
        (id) => petHistory().filter((e) => e.careId === id).length,
        care.id,
      ),
      1,
      "Deleted care history must not reappear from care.log",
    );
    assert.equal(
      await p.evaluate((id) => S.pet.find((x) => x.id === id).last, care.id),
      care.last,
    );
    await p.locator("#toast .toast-undo").click();
    assert.equal(
      await p.evaluate((id) => S.pet.find((x) => x.id === id).last, care.id),
      corrected,
    );
    const legacy = await p.evaluate(
      (id) => petHistory().find((e) => e.careId === id && e.src === "care"),
      care.id,
    );
    await p.locator('[data-act=editHist][data-id="' + legacy.id + '"]').click();
    const legacyCorrected = await p.evaluate(() => addDays(today(), -18));
    await p.locator("#f_d").fill(legacyCorrected);
    await ok();
    assert.equal(
      await p.evaluate(
        (d) => petHistory().some((e) => e.date === d),
        legacy.date,
      ),
      false,
    );
    const migrated = await p.evaluate(
      (d) => petHistory().find((e) => e.date === d),
      legacyCorrected,
    );
    assert.equal(migrated.src, "log");
    assert.equal(
      await p.evaluate((id) => S.pet.find((x) => x.id === id).last, care.id),
      corrected,
    );
    await p
      .locator('[data-act=editHist][data-id="' + migrated.id + '"]')
      .click();
    await p.locator(".overlay [data-s=del]").click();
    assert.equal(
      await p.evaluate(
        (d) => petHistory().some((e) => e.date === d),
        legacyCorrected,
      ),
      false,
    );
    await p.locator("#toast .toast-undo").click();
    assert.equal(
      await p.evaluate(
        (d) => petHistory().some((e) => e.date === d),
        legacyCorrected,
      ),
      true,
    );
    console.log(
      "PASS Ringo appointment deduplication, care completion, history correction/deletion and coherent next date",
    );
    // Reminders, notes and board messages, still inside Important after the rename.
    await tab("hoy");
    await p.locator("#qNote").fill("Nota de auditoría con acentos");
    await p.locator("[data-act=saveNote][data-v=qNote]").click();
    await p.locator("#qNote").fill("Mensaje de auditoría");
    await p.locator("[data-act=sendMsg]").click();
    assert.equal(
      await p.evaluate(() => S.board.cur.text),
      "Mensaje de auditoría",
    );
    await tab("recordar");
    assert.equal(await p.locator("#app h1").innerText(), "Importantes");
    assert(
      await p
        .getByText("Nota de auditoría con acentos", { exact: true })
        .isVisible(),
    );
    await p.locator("#qRemNoDate").fill("Recordatorio sin fecha de auditoría");
    await p.locator("#qRemNoDate").press("Enter");
    const reminder = await p.evaluate(() =>
      S.reminders.find(
        (r) => r.title === "Recordatorio sin fecha de auditoría",
      ),
    );
    assert.equal(reminder.date, "");
    await p
      .locator('[data-act=editRem][data-id="' + reminder.id + '"]')
      .click();
    await p.locator("#f_d").fill(await p.evaluate(() => addDays(today(), 2)));
    await p.locator("#f_h").fill("09:00");
    await p.locator("#f_r").selectOption("monthly");
    await ok();
    assert.equal(
      await p.evaluate(
        (id) => S.reminders.find((r) => r.id === id).repeat,
        reminder.id,
      ),
      "monthly",
    );
    console.log(
      "PASS Important reminders, quick notes and board message without external messaging",
    );
    // All spending views must use the same verified, non-duplicated purchase set.
    await p.evaluate(() => {
      const base = { date: today(), store: "Tienda de auditoría", items: [] };
      S.buys = [
        {
          ...base,
          id: "spend-a",
          ticket: true,
          total: 4.15,
          imageHash: "audit-image",
          receiptKey: "audit-receipt",
          lineFingerprint: "audit-lines",
        },
        {
          ...base,
          id: "spend-copy",
          ticket: true,
          total: 4.15,
          imageHash: "audit-image",
          receiptKey: "audit-receipt",
          lineFingerprint: "audit-lines",
        },
        { ...base, id: "voided", ticket: true, total: 9, voided: true },
        { ...base, id: "manual-spend", manual: true, total: 0.1 },
        { ...base, id: "pending-spend", receiptPending: true, total: 0.2 },
        {
          ...base,
          id: "future-spend",
          date: addDays(today(), 1),
          manual: true,
          total: 8,
        },
      ];
      save();
    });
    const monthly = await p.evaluate(
      () =>
        CasaInsights.spending(S, monthKey(), { today: today() }).totalCents /
        100,
    );
    assert.equal(monthly, 4.45);
    assert.equal(
      await p.evaluate(() => spentIn(monthKey())),
      monthly,
      "Monthly summary must exclude voided, duplicate and future purchases",
    );
    assert.equal(
      await p.evaluate(() => spentWeek()),
      monthly,
      "Weekly summary must agree with the same purchase filter",
    );
    await tab("compras");
    await p.locator("#app [data-act=ckTab][data-v=ajustes]").first().click();
    await p.locator("#ckBudgetW").fill("65");
    await p.locator("#ckBudgetW").dispatchEvent("change");
    assert.equal(await p.evaluate(() => budgetW()), 65);
    await p.locator("#ckBudgetM").fill("250");
    await p.locator("#ckBudgetM").dispatchEvent("change");
    assert.equal(await p.evaluate(() => S.cook.budgetM), 250);
    assert.equal(
      await p.locator("[data-act=aiKey],[data-act=aiPhoto]").count(),
      0,
    );
    assert(
      !(await p.locator("#app").innerText()).includes(
        "Inteligencia artificial",
      ),
    );
    await p.evaluate(() => {
      S.buys = [];
      save();
    });
    await tab("recordar");
    console.log(
      "PASS consistent spending summaries, duplicate/void/future exclusion, budgets and paid AI removal",
    );
    // Safari-like taps can keep the search input focused while cart controls are used.
    await tab("compras");
    await p.locator("#app [data-act=ckTab][data-v=productos]").first().click();
    await p.locator("#qProd").fill("arroz redondo");
    await p
      .locator(
        '#ckProductResults [data-act=cartStep][data-id="5044"][data-v="1"]',
      )
      .first()
      .waitFor();
    await p.evaluate(
      () => (window.auditSearchInput = document.querySelector("#qProd")),
    );
    const cartControl = p
      .locator(
        '#ckProductResults [data-act=cartStep][data-id="5044"][data-v="1"]',
      )
      .first();
    await cartControl.evaluate((el) =>
      el.addEventListener("mousedown", (e) => e.preventDefault()),
    );
    await cartControl.click();
    assert.equal(
      await p.evaluate(() => document.activeElement === auditSearchInput),
      true,
    );
    assert.equal(
      await p.evaluate(() => S.items.find((i) => i.mid === "5044").units),
      1,
    );
    assert.equal(
      await p.locator(".ck-cartbar .ck-cb-ic b").innerText(),
      "1",
      "Cart summary must refresh while product search stays focused",
    );
    assert.equal(await p.locator("#qProd").inputValue(), "arroz redondo");
    await p
      .locator("[data-act=prodClear]")
      .evaluate((el) =>
        el.addEventListener("mousedown", (e) => e.preventDefault()),
      );
    await p.locator("[data-act=prodClear]").click();
    assert.equal(await p.locator("#qProd").inputValue(), "");
    assert.equal(
      await p.evaluate(
        () => document.querySelector("#qProd") === auditSearchInput,
      ),
      true,
    );
    await tab("recordar");
    console.log(
      "PASS focused product search updates cart and clear without replacing the input",
    );
    // Manual expenses and street-market purchases use decimal commas and optional inventory.
    await tab("compras");
    await p.locator("#app [data-act=ckTab][data-v=lista]").first().click();
    await p.locator("[data-act=ckSpend]").evaluate((el) => {
      for (let n = el.parentElement; n; n = n.parentElement)
        if (n.tagName === "DETAILS") n.open = true;
    });
    await p.locator("[data-act=ckSpend]").click();
    await p.locator("#f_a").fill("0");
    await ok();
    assert.equal(await p.evaluate(() => S.buys.length), 0);
    await p.locator("#f_a").fill("3,50");
    await ok();
    assert.equal(await p.evaluate(() => spentWeek()), 3.5);
    const cartBeforeMarket = await p.evaluate(() => JSON.stringify(S.items));
    await p.locator("[data-act=ckMarket]").evaluate((el) => {
      for (let n = el.parentElement; n; n = n.parentElement)
        if (n.tagName === "DETAILS") n.open = true;
    });
    await p.locator("[data-act=ckMarket]").click();
    await p.locator("#f_a").fill("5,25");
    await p.locator("#f_v [data-v=Tomates]").click();
    await p.locator("#f_h").check();
    assert.equal(
      await p.locator(".overlay [data-s=ok]").innerText(),
      "Guardar compra",
    );
    await ok();
    assert.equal(await p.evaluate(() => spentWeek()), 8.75);
    assert.equal(await p.evaluate(() => spentIn(monthKey())), 8.75);
    assert.equal(
      await p.evaluate(() => JSON.stringify(S.items)),
      cartBeforeMarket,
    );
    assert.equal(
      await p.evaluate(() => S.pantry.some((x) => x.name === "Tomates")),
      true,
    );
    await tab("recordar");
    console.log(
      "PASS manual expense and street-market UI, decimal commas, exact totals and optional stock without changing the cart",
    );
    // Full JSON roundtrip through the actual backup UI; production adapters are not used.
    await p.locator("[data-act=backups]").click();
    await p.locator("#bkNow").click();
    assert(
      await p.evaluate(() =>
        localBackups().some((b) => b.label === "Copia manual"),
      ),
    );
    await p.evaluate(
      () =>
        (claude.use = async (name) =>
          name === "downloads"
            ? {
                save: async (value) => {
                  window.auditDownload = value;
                },
              }
            : null),
    );
    await p.locator("#bkDown").click();
    await p.waitForFunction(() => !!window.auditDownload);
    const backup = await p.evaluate(() => auditDownload);
    const restored = JSON.parse(backup.data);
    assert(Array.isArray(restored.contacts));
    assert.equal(restored.tasks.length, 2);
    await close();
    await p.evaluate(() => {
      S.tasks = [];
      save();
    });
    await p.locator("[data-act=backups]").click();
    const beforeInvalid = await p.evaluate(() => JSON.stringify(S));
    await p.locator("#bkFile").setInputFiles({
      name: "invalid-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ tasks: [], items: [], pet: null })),
    });
    await p.waitForFunction(
      () =>
        !!document.querySelector("#bkImpOk") ||
        document
          .querySelector("#toast span")
          ?.textContent.includes("copia válida"),
    );
    assert.equal(
      await p.locator("#bkImpOk").count(),
      0,
      "An incompatible backup must never offer restoration",
    );
    assert.equal(await p.evaluate(() => JSON.stringify(S)), beforeInvalid);
    await p.locator("#bkFile").setInputFiles({
      name: "synthetic-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(backup.data),
    });
    await p.locator("#bkImpOk").click();
    assert.equal(await p.evaluate(() => S.tasks.length), 2);
    assert(
      await p.evaluate(() =>
        localBackups().some(
          (b) => b.label === "Antes de restaurar" && b.data.tasks.length === 0,
        ),
      ),
    );
    console.log(
      "PASS backup creation, JSON export, real file import, restore and automatic restore point",
    );
    // Exercise every visible navigation section and registered action on mobile/desktop.
    const panels = ["lista", "productos", "novedades", "despensa", "ajustes"];
    for (const width of [320, 390, 1280]) {
      await p.setViewportSize({ width, height: 844 });
      for (const theme of ["light", "dark"]) {
        await p.evaluate(
          (theme) => (document.documentElement.dataset.theme = theme),
          theme,
        );
        for (const view of [
          "hoy",
          "tareas",
          "compras",
          "semana",
          "ringo",
          "recordar",
        ]) {
          await tab(view);
          if (view === "compras") {
            for (const panel of panels) {
              await p
                .locator('#app [data-act=ckTab][data-v="' + panel + '"]')
                .first()
                .click();
              assert.deepEqual(
                await p.evaluate(() =>
                  [...document.querySelectorAll("#app [data-act]")]
                    .map((b) => b.dataset.act)
                    .filter((x) => typeof ACT[x] !== "function"),
                ),
                [],
              );
              assert.equal(
                await p
                  .locator("#app")
                  .evaluate((el) => el.scrollWidth <= el.clientWidth + 2),
                true,
                panel + " must not overflow horizontally",
              );
              if (panel === "lista") {
                const tools = p.locator("[data-shop-money]");
                await tools.locator(":scope > summary").click();
                assert.equal(await tools.evaluate((el) => el.open), true);
                assert.equal(
                  await p
                    .locator("#app")
                    .evaluate((el) => el.scrollWidth <= el.clientWidth + 2),
                  true,
                  "Expanded money tools must fit the viewport",
                );
                await tools.locator(":scope > summary").click();
              }
            }
          }
          assert.equal(await p.locator("#tabs").isVisible(), true);
          assert.equal(
            await p.evaluate(() => document.body.scrollWidth <= innerWidth + 2),
            true,
            view + " must fit viewport",
          );
          await p.evaluate(
            () => (document.querySelector("#app").scrollTop = 0),
          );
          await p.screenshot({
            path: `/tmp/casa-audit-${view}-${width}-${theme}.png`,
            animations: "disabled",
          });
        }
      }
    }
    assert(
      !(await p
        .locator("#tabs")
        .innerText()
        .then((t) => /Recetas/.test(t))),
    );
    assert.equal(
      await p.locator("[data-act=ckTab][data-v=recetas]").count(),
      0,
    );
    console.log(
      "PASS all six main views, all five Shopping panels, registered actions and responsive light/dark navigation",
    );
    // Use the real service worker and cache to reload and add a task without a connection.
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        serviceWorkers: "allow",
      }),
      offline = await context.newPage();
    offline.on("pageerror", (e) => errors.push(e.message));
    await offline.goto("http://127.0.0.1:" + server.address().port + "/casa/", {
      waitUntil: "domcontentloaded",
    });
    await offline.evaluate(() => navigator.serviceWorker.ready);
    await offline.reload({ waitUntil: "domcontentloaded" });
    await offline.waitForFunction(() => !!navigator.serviceWorker.controller);
    await offline.locator("#qTask").fill("Tarea para probar sin conexión");
    await offline.locator("#qTask").press("Enter");
    await context.setOffline(true);
    await offline.reload({ waitUntil: "domcontentloaded" });
    assert(
      await offline
        .getByText("Tarea para probar sin conexión", { exact: true })
        .isVisible(),
    );
    await offline.locator("#qTask").fill("Tarea añadida sin conexión");
    await offline.locator("#qTask").press("Enter");
    await context.setOffline(false);
    await offline.reload({ waitUntil: "domcontentloaded" });
    assert(
      await offline
        .getByText("Tarea añadida sin conexión", { exact: true })
        .isVisible(),
    );
    assert(
      await offline.evaluate(async () =>
        (await caches.keys()).includes("casa-v" + APP_VERSION),
      ),
    );
    await context.close();
    assert.deepEqual(errors, []);
    console.log(
      "PASS actual service worker, offline reload/write, reconnect and version cache. Local fixtures only, no live Firebase or native iPhone hardware.",
    );
  } catch (e) {
    if (p) {
      await p
        .screenshot({
          path: "/tmp/casa-audit-daily-failure.png",
          animations: "disabled",
        })
        .catch(() => {});
      console.error(
        "LAYOUT",
        await p
          .evaluate(() => {
            const app = document.querySelector("#app"),
              bounds = app.getBoundingClientRect();
            return {
              width: innerWidth,
              client: app.clientWidth,
              scroll: app.scrollWidth,
              overflows: [...app.querySelectorAll("*")]
                .filter((el) => el.scrollWidth > el.clientWidth + 2)
                .slice(0, 20)
                .map((el) => ({
                  tag: el.tagName,
                  class: el.className,
                  text: el.textContent.slice(0, 90),
                  client: el.clientWidth,
                  scroll: el.scrollWidth,
                  rect: el.getBoundingClientRect().toJSON(),
                  display: getComputedStyle(el).display,
                })),
              elements: [...app.querySelectorAll("*")]
                .filter((el) => {
                  const r = el.getBoundingClientRect();
                  return r.width && r.right > bounds.right + 2;
                })
                .slice(0, 20)
                .map((el) => ({
                  tag: el.tagName,
                  class: el.className,
                  text: el.textContent.slice(0, 120),
                  rect: el.getBoundingClientRect().toJSON(),
                })),
            };
          })
          .catch(() => null),
      );
    }
    throw e;
  } finally {
    await browser?.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
