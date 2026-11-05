import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const electronPath = require("electron");
const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");
const devUrl = "http://127.0.0.1:5173";

const cleanEnv = { ...process.env };
delete cleanEnv.ELECTRON_RUN_AS_NODE;

function killTree(child) {
  if (!child || child.killed) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
  } else {
    child.kill("SIGTERM");
  }
}

async function waitForServer(timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(devUrl);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 220));
  }
  throw new Error("Vite dev server did not start in time.");
}

console.log("\n  Cloud Music · 开发模式\n");

const vite = spawn(
  process.execPath,
  [viteBin, "--host", "127.0.0.1", "--port", "5173", "--strictPort"],
  { cwd: root, env: cleanEnv, stdio: "inherit", windowsHide: false },
);

let electron;
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  killTree(electron);
  killTree(vite);
  setTimeout(() => process.exit(code), 140);
}

vite.on("exit", (code) => {
  if (!shuttingDown && code !== 0) {
    console.error("Vite 已退出，无法启动开发窗口。");
    shutdown(code ?? 1);
  }
});

try {
  await waitForServer();
  console.log("  界面已就绪，正在打开桌面窗口…\n");
  electron = spawn(electronPath, ["."], {
    cwd: root,
    env: {
      ...cleanEnv,
      SHIYIN_DEV_SERVER_URL: devUrl,
      ...(process.env.SHIYIN_AUTODEMO ? { SHIYIN_AUTODEMO: "1" } : {}),
      ...(process.env.SHIYIN_CAPTURE_DIR
        ? { SHIYIN_CAPTURE_DIR: process.env.SHIYIN_CAPTURE_DIR }
        : {}),
    },
    stdio: "inherit",
    windowsHide: false,
  });

  electron.on("exit", (code) => {
    shutdown(code ?? 0);
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  shutdown(1);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
