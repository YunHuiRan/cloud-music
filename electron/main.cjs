"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { Readable } = require("node:stream");
const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  protocol,
  shell,
  Tray,
} = require("electron");
const { ensureDemoFiles } = require("./demo-audio.cjs");

// Keep the existing data folder so renaming the app does not orphan libraries.
app.setName("Cloud Music");
app.setPath("userData", path.join(app.getPath("appData"), "shiyin-player"));

const AUDIO_EXTENSIONS = new Set([
  "mp3",
  "flac",
  "m4a",
  "aac",
  "ogg",
  "oga",
  "opus",
  "wav",
  "wave",
  "webm",
  "aiff",
  "aif",
  "wma",
  "mka",
  "m4b",
]);

const MIME_TYPES = {
  mp3: "audio/mpeg",
  flac: "audio/flac",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  wav: "audio/wav",
  wave: "audio/wav",
  webm: "audio/webm",
  aiff: "audio/aiff",
  aif: "audio/aiff",
  wma: "audio/x-ms-wma",
  mka: "audio/x-matroska",
  m4b: "audio/mp4",
};

const SKIPPED_DIRECTORIES = new Set([
  "$RECYCLE.BIN",
  "System Volume Information",
  "node_modules",
]);

protocol.registerSchemesAsPrivileged([
  {
    scheme: "aria-media",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

const allowedFiles = new Set();
const allowedRoots = new Set();
const autoDemo = process.env.SHIYIN_AUTODEMO === "1";
const captureDirectory = process.env.SHIYIN_CAPTURE_DIR || "";
const CLOSE_BEHAVIORS = new Set(["ask", "minimize", "quit"]);
let closeBehaviorCache = null;
let closePromptOpen = false;
let isQuitting = false;
let mainWindow = null;
let tray = null;

function windowPrefsPath() {
  return path.join(app.getPath("userData"), "window-prefs.json");
}

function readCloseBehavior() {
  if (CLOSE_BEHAVIORS.has(closeBehaviorCache)) return closeBehaviorCache;
  try {
    const raw = fs.readFileSync(windowPrefsPath(), "utf8");
    const parsed = JSON.parse(raw);
    closeBehaviorCache = CLOSE_BEHAVIORS.has(parsed?.closeBehavior)
      ? parsed.closeBehavior
      : "ask";
  } catch {
    closeBehaviorCache = "ask";
  }
  return closeBehaviorCache;
}

function writeCloseBehavior(value) {
  if (!CLOSE_BEHAVIORS.has(value)) throw new Error("Invalid close behavior");
  closeBehaviorCache = value;
  const filePath = windowPrefsPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    `${JSON.stringify({ closeBehavior: value }, null, 2)}\n`,
    "utf8",
  );
  return value;
}

function canonical(filePath) {
  const resolved = path.resolve(filePath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function extensionOf(filePath) {
  return path.extname(filePath).slice(1).toLowerCase();
}

function isAudioFile(filePath) {
  return AUDIO_EXTENSIONS.has(extensionOf(filePath));
}

function allowFile(filePath) {
  if (!filePath || !isAudioFile(filePath)) return;
  allowedFiles.add(canonical(filePath));
}

function allowRoot(folder) {
  if (!folder) return;
  allowedRoots.add(canonical(folder));
}

function isAllowed(filePath) {
  if (allowedFiles.has(canonical(filePath))) return true;
  const target = canonical(filePath);
  for (const root of allowedRoots) {
    if (target === root) return true;
    const prefix = root.endsWith(path.sep) ? root : root + path.sep;
    if (target.startsWith(prefix)) return true;
  }
  return false;
}

function authorizePaths(paths) {
  if (!Array.isArray(paths)) return 0;
  let count = 0;
  for (const filePath of paths.slice(0, 20000)) {
    if (typeof filePath === "string" && isAudioFile(filePath)) {
      allowFile(filePath);
      count += 1;
    }
  }
  return count;
}

async function scanDirectory(root) {
  const results = [];
  const queue = [root];

  while (queue.length > 0) {
    const current = queue.pop();
    let entries;
    try {
      entries = await fs.promises.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
        queue.push(absolute);
      } else if (entry.isFile() && isAudioFile(entry.name)) {
        try {
          const stat = await fs.promises.stat(absolute);
          results.push({
            id: path.resolve(absolute),
            path: path.resolve(absolute),
            fileName: entry.name,
            relativePath: path.relative(root, absolute),
            size: stat.size,
          });
        } catch {
          // A file can disappear during a scan; ignore it.
        }
      }
    }
  }

  results.sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath, "zh-Hans-CN", {
      numeric: true,
      sensitivity: "base",
    }),
  );
  return results;
}

async function scanFolder(folder) {
  const resolved = path.resolve(String(folder));
  const stat = await fs.promises.stat(resolved);
  if (!stat.isDirectory()) throw new Error("Not a directory");
  allowRoot(resolved);
  const files = await scanDirectory(resolved);
  for (const file of files) allowFile(file.path);
  return files;
}

async function scanDemo() {
  const directory = path.join(app.getPath("userData"), "demo-audio");
  ensureDemoFiles(directory);
  allowRoot(directory);
  const files = await scanDirectory(directory);
  for (const file of files) allowFile(file.path);
  return files;
}

async function refreshLibraryEntries(entries) {
  const valid = [];
  const missing = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!entry || typeof entry.id !== "string" || typeof entry.path !== "string") {
      continue;
    }
    try {
      const stat = await fs.promises.stat(entry.path);
      if (stat.isFile() && isAudioFile(entry.path)) {
        allowFile(entry.path);
        valid.push(entry.id);
      } else {
        missing.push(entry.id);
      }
    } catch {
      missing.push(entry.id);
    }
  }
  return { valid, missing };
}

async function scanPaths(paths) {
  const results = [];
  const seen = new Set();

  for (const raw of paths.slice(0, 200)) {
    if (typeof raw !== "string" || raw.length === 0) continue;
    const resolved = path.resolve(raw);
    let stat;
    try {
      stat = await fs.promises.stat(resolved);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      allowRoot(resolved);
      const files = await scanDirectory(resolved);
      for (const file of files) {
        allowFile(file.path);
        if (!seen.has(file.id)) {
          seen.add(file.id);
          results.push(file);
        }
      }
      continue;
    }

    if (!stat.isFile() || !isAudioFile(resolved)) continue;
    allowFile(resolved);
    const id = path.resolve(resolved);
    if (seen.has(id)) continue;
    seen.add(id);
    results.push({
      id,
      path: id,
      fileName: path.basename(resolved),
      relativePath: path.basename(resolved),
      size: stat.size,
    });
  }

  results.sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath, "zh-Hans-CN", {
      numeric: true,
      sensitivity: "base",
    }),
  );
  return results;
}

function decodeMediaPath(requestUrl) {
  const url = new URL(requestUrl);
  if (url.host !== "local") return null;
  const encoded = url.pathname.replace(/^\/+/, "");
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

function parseRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return null;

  let start;
  let end;
  if (!rawStart) {
    const suffix = Number(rawEnd);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Number(rawEnd) : size - 1;
  }

  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start >= size ||
    end < start
  ) {
    return null;
  }
  return { start, end: Math.min(end, size - 1) };
}

function mediaResponseHeaders(filePath, length) {
  return {
    "Content-Type": MIME_TYPES[extensionOf(filePath)] || "application/octet-stream",
    "Content-Length": String(length),
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
  };
}

async function handleMediaRequest(request) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }

  const filePath = decodeMediaPath(request.url);
  if (!filePath || !path.isAbsolute(filePath)) {
    return new Response("Bad request", { status: 400 });
  }
  if (!isAllowed(filePath)) {
    return new Response("Forbidden", { status: 403 });
  }

  let stat;
  try {
    stat = await fs.promises.stat(filePath);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!stat.isFile()) return new Response("Not found", { status: 404 });

  const size = stat.size;
  const rangeHeader = request.headers.get("range");
  let start = 0;
  let end = size - 1;
  let status = 200;

  if (rangeHeader) {
    const range = parseRange(rangeHeader, size);
    if (!range) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }
    start = range.start;
    end = range.end;
    status = 206;
  }

  const length = end - start + 1;
  const headers = mediaResponseHeaders(filePath, length);
  if (status === 206) {
    headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  }

  if (request.method === "HEAD" || length === 0) {
    return new Response(null, { status, headers });
  }

  const stream = fs.createReadStream(filePath, { start, end });
  const abort = () => stream.destroy();
  request.signal.addEventListener("abort", abort, { once: true });
  stream.on("close", () => request.signal.removeEventListener("abort", abort));

  return new Response(Readable.toWeb(stream), { status, headers });
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function hideToTray() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.hide();
}

function createTray() {
  if (tray) return;
  const iconPath = path.join(__dirname, "..", "icon.png");
  if (!fs.existsSync(iconPath)) return;
  const image = nativeImage.createFromPath(iconPath).resize({ width: 32, height: 32 });
  tray = new Tray(image);
  tray.setToolTip("Cloud Music");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "显示 Cloud Music", click: showMainWindow },
      { type: "separator" },
      {
        label: "退出 Cloud Music",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("click", showMainWindow);
  tray.on("double-click", showMainWindow);
}

function createWindow() {
  const iconPath = path.join(__dirname, "..", "icon.png");
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 380,
    minHeight: 520,
    show: false,
    title: "Cloud Music",
    backgroundColor: "#f5f7fc",
    autoHideMenuBar: true,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });

  mainWindow = window;
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });
  window.once("ready-to-show", () => window.show());

  window.on("close", (event) => {
    if (isQuitting) return;

    const behavior = readCloseBehavior();
    if (behavior === "minimize") {
      event.preventDefault();
      hideToTray();
      return;
    }
    if (behavior === "quit") return;

    event.preventDefault();
    if (closePromptOpen) return;
    closePromptOpen = true;
    void dialog
      .showMessageBox(window, {
        type: "question",
        title: "关闭 Cloud Music",
        message: "要最小化到托盘，还是直接关闭？",
        detail:
          "最小化到托盘会保持播放；直接关闭会退出 Cloud Music。",
        buttons: ["最小化到托盘", "直接关闭", "取消"],
        defaultId: 0,
        cancelId: 2,
        noLink: true,
        checkboxLabel: "记住这次选择（之后可在设置中修改）",
        checkboxChecked: false,
      })
      .then(({ response, checkboxChecked }) => {
        closePromptOpen = false;
        if (response === 0) {
          if (checkboxChecked) writeCloseBehavior("minimize");
          hideToTray();
        } else if (response === 1) {
          if (checkboxChecked) writeCloseBehavior("quit");
          isQuitting = true;
          app.quit();
        }
      })
      .catch(() => {
        closePromptOpen = false;
      });
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (url !== window.webContents.getURL()) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    }
  });

  const devServer = process.env.SHIYIN_DEV_SERVER_URL;
  if (devServer) {
    void window.loadURL(devServer);
  } else {
    void window.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  if (captureDirectory) void scheduleCapture(window);

  return window;
}

async function scheduleCapture(window) {
  const delay = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));

  window.webContents.once("did-finish-load", async () => {
    try {
      fs.mkdirSync(captureDirectory, { recursive: true });
      await delay(3200);
      const initialTheme = await window.webContents.executeJavaScript(
        "document.documentElement.dataset.theme || 'light'",
      );
      const first = await window.webContents.capturePage();
      fs.writeFileSync(
        path.join(captureDirectory, `library-${initialTheme}.png`),
        first.toPNG(),
      );

      await window.webContents.executeJavaScript(
        "document.querySelector('.track-row')?.click()",
      );
      await delay(1800);
      const playing = await window.webContents.capturePage();
      fs.writeFileSync(
        path.join(captureDirectory, `playing-${initialTheme}.png`),
        playing.toPNG(),
      );

      await window.webContents.executeJavaScript(
        "document.querySelector('.theme-button')?.click()",
      );
      await delay(900);
      const nextTheme = await window.webContents.executeJavaScript(
        "document.documentElement.dataset.theme || 'light'",
      );
      const second = await window.webContents.capturePage();
      fs.writeFileSync(
        path.join(captureDirectory, `library-${nextTheme}.png`),
        second.toPNG(),
      );

      const playbackState = await window.webContents.executeJavaScript(
        "({ title: document.querySelector('.player-title')?.textContent ?? '', time: Array.from(document.querySelectorAll('.timeline .time-label')).map((node) => node.textContent).join(' / '), button: document.querySelector('.play-button')?.getAttribute('title') ?? '', current: document.querySelector('.track-row.is-current .row-title')?.textContent ?? '' })",
      );
      console.log("capture playback:", JSON.stringify(playbackState));

      await window.webContents.executeJavaScript(
        "document.querySelector('.theme-button')?.click()",
      );
      await delay(500);
    } catch (error) {
      console.error("capture failed", error);
    } finally {
      app.quit();
    }
  });
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    showMainWindow();
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);

    ipcMain.on("app:auto-demo", (event) => {
      event.returnValue = autoDemo;
    });
    ipcMain.on("app:version", (event) => {
      event.returnValue = app.getVersion();
    });
    ipcMain.on("library:authorize-sync", (event, paths) => {
      event.returnValue = authorizePaths(paths);
    });

    ipcMain.handle("library:pick-folder", async (event) => {
      const parent = BrowserWindow.fromWebContents(event.sender);
      const result = await dialog.showOpenDialog(parent ?? undefined, {
        title: "选择音乐文件夹",
        buttonLabel: "导入这个文件夹",
        properties: ["openDirectory"],
      });
      return result.canceled ? null : result.filePaths[0] ?? null;
    });

    ipcMain.handle("library:scan-folder", (_event, folder) => {
      if (typeof folder !== "string" || folder.length === 0) {
        throw new Error("Invalid folder");
      }
      return scanFolder(folder);
    });

    ipcMain.handle("library:scan-demo", () => scanDemo());

    ipcMain.handle("window:get-close-behavior", () => readCloseBehavior());

    ipcMain.handle("window:set-close-behavior", (_event, behavior) => {
      return writeCloseBehavior(behavior);
    });

    ipcMain.handle("app:quit", () => {
      isQuitting = true;
      app.quit();
    });

    ipcMain.handle("library:import-paths", (_event, paths) => {
      if (!Array.isArray(paths)) throw new Error("Invalid paths");
      return scanPaths(paths);
    });

    ipcMain.handle("library:refresh", (_event, entries) =>
      refreshLibraryEntries(entries),
    );

    ipcMain.handle("library:authorize", (_event, paths) => {
      return authorizePaths(paths);
    });

    protocol.handle("aria-media", handleMediaRequest);

    createWindow();
    createTray();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else showMainWindow();
    });
  });

  app.on("before-quit", () => {
    isQuitting = true;
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
