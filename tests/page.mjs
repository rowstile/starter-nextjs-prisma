// The page in a headless browser (Chrome or Edge, over the DevTools protocol): the README's walk, clicked.
//   node tests/page.mjs [http://localhost:3000/]        (the app must be running; skipped when there is no browser)
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PAGE = process.argv[2] ?? "http://localhost:3000/";
const BROWSERS = ["C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"];
const browser = BROWSERS.find((b) => existsSync(b));
if (!browser) { console.log("skip  no Chrome or Edge"); process.exit(0); }

let fails = 0;
const check = (what, ok, got) => {
  if (ok) console.log(`ok    ${what}`);
  else { fails += 1; console.log(`FAIL  ${what}${got === undefined ? "" : `: ${JSON.stringify(got).slice(0, 500)}`}`); }
};

const profile = mkdtempSync(join(tmpdir(), "rowstile-starter-"));
const chrome = spawn(browser, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
const wsUrl = await new Promise((resolve, reject) => {
  let text = "";
  chrome.stderr.on("data", (d) => {
    text += d;
    const m = text.match(/DevTools listening on (ws:\/\/\S+)/);
    if (m) resolve(m[1]);
  });
  setTimeout(() => reject(new Error("the browser didn't start")), 20000);
});

const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let next = 0;
const waiting = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
});
const send = (method, params = {}, sessionId) => new Promise((resolve) => {
  const id = ++next;
  waiting.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params, sessionId }));
});
const { result: { targetId } } = await send("Target.createTarget", { url: "about:blank" });
const { result: { sessionId } } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId);
const js = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
  if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
  return r.result.result.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Waits until the page says something (a JS expression that becomes truthy). */
const until = async (expression, what) => {
  for (let i = 0; i < 80; i++) {
    if (await js(expression).catch(() => false)) return true;
    await sleep(150);
  }
  console.log(`      (waited for: ${what})`);
  return false;
};
const text = () => js("document.body.innerText");
const item = (title) => `[...document.querySelectorAll('li')].find((li) => li.querySelector('input[name=title]')?.value === ${JSON.stringify(title)})`;
const signIn = async (id, name) => {
  await js(`(() => { const s = document.querySelector('select[name=user]'); s.value = ${JSON.stringify(id)}; s.form.requestSubmit(); })()`);
  await until(`document.querySelector('form[data-user]')?.dataset.user === ${JSON.stringify(id)}`, `signed in as ${name}`);
  await sleep(400);
};

try {
  await send("Page.navigate", { url: PAGE }, sessionId);
  check("the page loads", await until("document.querySelector('h1')?.innerText === 'Shared documents'", "the heading"));
  check("nobody signed in sees no document", (await text()).includes("No documents you may see"), await text());

  await signIn("1", "ann");
  await js(`(() => { const i = document.querySelector('input[placeholder]'); i.value = 'Roadmap'; i.form.requestSubmit(); })()`);
  check("ann makes a document", await until(`!!${item("Roadmap")}`, "Roadmap in the list"), await text());
  check("... and may share it", await js(`${item("Roadmap")}.innerText.includes('share') && !!${item("Roadmap")}.querySelector('select[name=with]')`), await text());

  await js(`(() => { const li = ${item("Roadmap")}; li.querySelector('select[name=with]').value = 'user:2'; li.querySelector('select[name=relation]').value = 'viewer'; li.querySelector('select[name=with]').form.requestSubmit(); })()`);
  await sleep(1200);
  await signIn("2", "bo");
  check("shared with bo as a viewer: he sees it, and may only view", await until(`${item("Roadmap")}?.innerText.includes('you can: view')`, "bo's view"), await text());
  await js(`(() => { const li = ${item("Roadmap")}; const i = li.querySelector('input[name=title]'); i.value = 'mine'; i.form.requestSubmit(); })()`);
  check("bo's rename is refused, and the page says why", await until("document.querySelector('pre[role=alert]')?.innerText.includes('permission denied')", "the refusal"), await text());
  console.log("      " + (await js("document.querySelector('pre[role=alert]')?.innerText ?? ''")).split("\n").slice(0, 4).join(" | "));

  await signIn("1", "ann");
  await js(`(() => { const li = ${item("Roadmap")}; li.querySelector('select[name=with]').value = 'team:10'; li.querySelector('select[name=relation]').value = 'editor'; li.querySelector('select[name=with]').form.requestSubmit(); })()`);
  await sleep(1200);
  await signIn("3", "cy");
  check("shared with the writers as editors: cy, a member, may edit", await until(`${item("Roadmap")}?.innerText.includes('edit')`, "cy's edit"), await text());
  await js(`(() => { const li = ${item("Roadmap")}; const i = li.querySelector('input[name=title]'); i.value = 'Roadmap 2'; i.form.requestSubmit(); })()`);
  check("... and renames it", await until(`!!${item("Roadmap 2")} && !document.querySelector('pre[role=alert]')`, "the new title"), await text());
  await js(`(() => { const li = ${item("Roadmap 2")}; [...li.querySelectorAll('button')].find((b) => b.innerText === 'Delete').form.requestSubmit(); })()`);
  check("cy, an editor, deletes it: who may share may delete", await until(`!${item("Roadmap 2")}`, "the document gone"), await text());
} finally {
  ws.close();
  chrome.kill();
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* the browser may still hold it */ }
}
console.log(fails ? `ui: ${fails} failed` : "ui: all passed");
process.exit(fails ? 1 : 0);
