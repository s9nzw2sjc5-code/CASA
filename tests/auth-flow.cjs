// Real login/logout UI and Firebase bridge with an isolated Auth/Firestore transport.
// No real accounts, password resets, credentials or production database calls.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path");
(async () => {
  const root = path.resolve(__dirname, ".."),
    server = http.createServer((req, res) => {
      const pathname = new URL(req.url, "http://test").pathname,
        file = path.resolve(
          root,
          "." + (pathname.endsWith("/") ? pathname + "index.html" : pathname),
        );
      fs.readFile(file, (e, data) => {
        res.setHeader(
          "Content-Type",
          file.endsWith(".js") ? "application/javascript" : "text/html",
        );
        res.writeHead(e ? 404 : 200);
        res.end(e ? "" : data);
      });
    });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  let browser;
  const errors = [];
  try {
    browser = await chromium.launch({
      executablePath: "/usr/bin/chromium",
      args: ["--no-sandbox"],
    });
    const p = await browser.newPage({
      viewport: { width: 390, height: 844 },
      serviceWorkers: "block",
    });
    p.on("pageerror", (e) => errors.push(e.message));
    await p.addInitScript(() => {
      window.auditAuthCalls = { login: 0, reset: 0, signOut: 0 };
      window.auditWrites = 0;
      const callbacks = [],
        state = {
          rev: 1,
          tasks: [
            {
              id: "auth-only-fixture",
              title: "Tarea sintética protegida",
              date: "",
              done: false,
            },
          ],
          buys: [],
          pantry: [],
          items: [],
        },
        snapshot = (data) => ({
          exists: !!data,
          metadata: { fromCache: false, hasPendingWrites: false },
          data: () => structuredClone(data),
        });
      let current = JSON.parse(
        localStorage.getItem("audit-auth-user") || "null",
      );
      const ref = (path) => ({
        path,
        id: path.split("/").at(-1),
        get: async () => {
          if (path === "hogar/estado") {
            if (window.auditDeny) {
              const e = Error("denied");
              e.code = "permission-denied";
              throw e;
            }
            return snapshot(state);
          }
          return snapshot(null);
        },
        set: async () => {
          auditWrites++;
        },
        delete: async () => {},
        onSnapshot: () => () => {},
      });
      const db = {
        settings() {},
        doc: ref,
        collection: (p) => ({
          doc: (id) => ref(p + "/" + id),
          get: async () => ({ docs: [] }),
        }),
        runTransaction: async (fn) =>
          fn({
            get: (r) => r.get(),
            set: (r, data) => {
              auditWrites++;
              Object.assign(state, data);
            },
            update: (r, data) => {
              auditWrites++;
              Object.assign(state, data);
            },
          }),
      };
      const auth = {
        onAuthStateChanged: (fn) => {
          callbacks.push(fn);
          setTimeout(() => fn(current), 0);
        },
        sendPasswordResetEmail: async () => {
          auditAuthCalls.reset++;
        },
        signInWithEmailAndPassword: async (email, password) => {
          auditAuthCalls.login++;
          if (password === "wrong") {
            const e = Error("bad credential");
            e.code = "auth/invalid-credential";
            throw e;
          }
          window.auditDeny = email.startsWith("denied");
          current = { uid: "audit-only-user", email };
          localStorage.setItem("audit-auth-user", JSON.stringify(current));
          setTimeout(() => callbacks.forEach((fn) => fn(current)), 0);
        },
        signOut: async () => {
          auditAuthCalls.signOut++;
          current = null;
          localStorage.removeItem("audit-auth-user");
          callbacks.forEach((fn) => fn(null));
        },
      };
      window.firebase = {
        initializeApp() {},
        firestore: () => db,
        auth: () => auth,
      };
    });
    await p.route("https://**/*", (r) =>
      r.request().url().startsWith("https://www.gstatic.com/firebasejs/")
        ? r.fulfill({ contentType: "application/javascript", body: "" })
        : r.abort(),
    );
    await p.route("**/config.js", (r) =>
      r.fulfill({
        contentType: "application/javascript",
        body: 'window.CASA_FIREBASE={apiKey:"audit-only",projectId:"audit-only"}',
      }),
    );
    const url = "http://127.0.0.1:" + server.address().port + "/casa/";
    await p.goto(url, { waitUntil: "domcontentloaded" });
    await p.getByRole("button", { name: "Entrar", exact: true }).waitFor();
    assert.equal(await p.locator("#app").isVisible(), false);
    assert.equal(await p.evaluate(() => auditWrites), 0);
    await p.locator("[data-reset]").click();
    assert(
      (await p.locator(".casa-gate .err").innerText()).includes(
        "Escribe primero",
      ),
    );
    assert.equal(await p.evaluate(() => auditAuthCalls.reset), 0);
    await p.locator("[name=email]").fill("fixture@example.invalid");
    await p.locator("[data-reset]").click();
    assert.equal(await p.evaluate(() => auditAuthCalls.reset), 1);
    await p.locator("[name=password]").fill("wrong");
    await p.getByRole("button", { name: "Entrar", exact: true }).click();
    await p.waitForFunction(() =>
      document
        .querySelector(".casa-gate .err")
        ?.textContent.includes("incorrectos"),
    );
    assert.equal(await p.locator("#app").isVisible(), false);
    await p.locator("[name=email]").fill("denied@example.invalid");
    await p.locator("[name=password]").fill("fixture-only-password");
    await p.getByRole("button", { name: "Entrar", exact: true }).click();
    await p.waitForFunction(() =>
      document
        .querySelector(".casa-gate .err")
        ?.textContent.includes("no tiene acceso"),
    );
    assert.equal(await p.locator("#app").isVisible(), false);
    await p.locator("[name=email]").fill("allowed@example.invalid");
    await p.locator("[name=password]").fill("fixture-only-password");
    await p.getByRole("button", { name: "Entrar", exact: true }).click();
    await p.waitForFunction(
      () => !document.body.classList.contains("casa-locked") && dbRef && base,
    );
    assert.equal(await p.locator("#app").isVisible(), true);
    assert.equal(
      await p.evaluate(() => S.tasks[0].title),
      "Tarea sintética protegida",
    );
    assert.equal(await p.evaluate(() => auditWrites), 0);
    await p.locator("[data-act=backups]").click();
    const downloading = p.waitForEvent("download");
    await p.locator("#bkDown").click();
    const downloaded = await downloading;
    assert(/^casa-copia-.*\.json$/.test(downloaded.suggestedFilename()));
    assert.equal(
      JSON.parse(fs.readFileSync(await downloaded.path(), "utf8")).tasks[0]
        .title,
      "Tarea sintética protegida",
    );
    await p.locator(".overlay [data-s=cancel]").click();
    await p.locator("[data-act=logout]").click();
    assert.equal(await p.locator("#app").isVisible(), true);
    await p.locator("[data-act=logout]").click();
    await p.getByRole("button", { name: "Entrar", exact: true }).waitFor();
    assert.equal(await p.locator("#app").isVisible(), false);
    assert.equal(
      await p.evaluate(() => localStorage.getItem("casa-app-v1")),
      null,
    );
    assert.equal(
      await p.evaluate(() => localStorage.getItem("casa-app-v1-base")),
      null,
    );
    const disconnected = await browser.newPage({ serviceWorkers: "block" });
    disconnected.on("pageerror", (e) => errors.push(e.message));
    await disconnected.route("**/config.js", (r) =>
      r.fulfill({
        contentType: "application/javascript",
        body: 'window.CASA_FIREBASE={apiKey:"audit-only",projectId:"audit-only"}',
      }),
    );
    await disconnected.route("https://**/*", (r) => r.abort());
    await disconnected.goto(url, { waitUntil: "domcontentloaded" });
    await disconnected
      .getByRole("button", { name: "Reintentar", exact: true })
      .waitFor();
    assert.equal(await disconnected.locator("#app").isVisible(), false);
    assert.deepEqual(errors, []);
    console.log(
      "PASS real Auth UI: private gate, empty reset validation, simulated reset only, incorrect password, denied household and reload, authorized unlock, protected state, actual backup file download, logout confirmation and app-cache cleanup, SDK connection failure with retry. Firebase Auth and transport simulated.",
    );
  } finally {
    await browser?.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
