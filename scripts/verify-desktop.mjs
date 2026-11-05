// Smoke-check a packaged desktop build: launch it, attach to its DevTools
// protocol, report title/layout, console errors and uncaught exceptions.
//
// Usage: node scripts/verify-desktop.mjs [path\to\app.exe] [--port 9334]

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const portIndex = args.indexOf("--port");
const port = portIndex >= 0 ? Number(args[portIndex + 1]) : 9334;
const exe = path.resolve(
  root,
  args.find((a) => !a.startsWith("--") && a !== String(port)) || "release/win-unpacked/Cloud Music.exe",
);
const shotPath = path.join(root, "shots", "packaged-desktop.png");

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function killTree(child) {
  if (!child || child.killed) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  } else {
    child.kill("SIGTERM");
  }
}

async function findPage() {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      // not up yet
    }
    await delay(300);
  }
  throw new Error("packaged app did not expose a DevTools page");
}

if (!fs.existsSync(exe)) {
  console.error(`not found: ${exe}`);
  process.exit(1);
}

const env = { ...process.env };
// Some agent shells export this; Electron would run as plain Node and exit.
delete env.ELECTRON_RUN_AS_NODE;

const app = spawn(exe, [`--remote-debugging-port=${port}`], { stdio: "ignore", windowsHide: false, env });
app.on("error", (err) => {
  console.error(`failed to launch: ${err.message}`);
  process.exit(1);
});

let socket;
try {
  const page = await findPage();
  socket = new WebSocket(page.webSocketDebuggerUrl);

  const pending = new Map();
  const problems = [];
  let nextId = 1;

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", () => reject(new Error("DevTools socket error")), { once: true });
  });

  socket.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`));
      else resolve(msg.result);
      return;
    }
    if (msg.method === "Runtime.exceptionThrown") {
      const details = msg.params.exceptionDetails;
      problems.push(`exception: ${details.exception?.description || details.text}`);
    }
    if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
      problems.push(`log: ${msg.params.entry.text}`);
    }
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      problems.push(`console: ${msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ")}`);
    }
  });

  await send("Runtime.enable");
  await send("Log.enable");
  await send("Page.enable");
  await delay(3500);

  const { result } = await send("Runtime.evaluate", {
    expression: `(() => ({
      title: document.title,
      api: Boolean(window.shiyin || window.__SHIYIN__),
      rows: document.querySelectorAll('.track-row').length,
      nav: document.querySelectorAll('.nav-item, .sidebar-item').length,
      size: [innerWidth, innerHeight],
      theme: document.documentElement.dataset.theme || null,
      text: document.body.innerText.slice(0, 160).replace(/\\s+/g, ' '),
    }))()`,
    returnByValue: true,
  });

  fs.mkdirSync(path.dirname(shotPath), { recursive: true });
  const shot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(shotPath, Buffer.from(shot.data, "base64"));

  console.log(JSON.stringify({ exe: path.relative(root, exe), ...result.value, problems, screenshot: path.relative(root, shotPath) }, null, 2));
  if (problems.length) process.exitCode = 2;
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  if (socket) socket.close();
  killTree(app);
}
