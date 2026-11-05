import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const electronPath = require("electron");
const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");
const outDir = path.join(root, "shots", "states");
const devUrl = "http://127.0.0.1:5173";
const debugPort = 9333;

fs.mkdirSync(outDir, { recursive: true });

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(url, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      // not ready
    }
    await delay(200);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

const vite = spawn(
  process.execPath,
  [viteBin, "--host", "127.0.0.1", "--port", "5173", "--strictPort"],
  { cwd: root, env, stdio: "ignore", windowsHide: true },
);

let electron;
let socket;

try {
  await waitFor(devUrl);
  electron = spawn(
    electronPath,
    [`--remote-debugging-port=${debugPort}`, "."],
    {
      cwd: root,
      env: {
        ...env,
        SHIYIN_DEV_SERVER_URL: devUrl,
        SHIYIN_AUTODEMO: "1",
      },
      stdio: "inherit",
      windowsHide: false,
    },
  );

  const targets = await waitFor(`http://127.0.0.1:${debugPort}/json/list`).then(
    (response) => response.json(),
  );
  const page = targets.find((target) => target.type === "page");
  if (!page) throw new Error("No page target found");

  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve);
    socket.addEventListener("error", reject);
  });

  let messageId = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const handler = pending.get(message.id);
    if (!handler) return;
    pending.delete(message.id);
    if (message.error) handler.reject(new Error(message.error.message));
    else handler.resolve(message.result);
  });

  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      messageId += 1;
      pending.set(messageId, { resolve, reject });
      socket.send(JSON.stringify({ id: messageId, method, params }));
    });

  const evaluate = async (expression) => {
    const result = await call("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ||
          result.exceptionDetails.text ||
          "Evaluation failed",
      );
    }
    return result.result.value;
  };

  const waitForSelector = async (selector, timeoutMs = 8000) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const found = await evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
      if (found) return;
      await delay(120);
    }
    throw new Error(`Selector not found: ${selector}`);
  };

  const screenshot = async (name) => {
    const result = await call("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
    });
    fs.writeFileSync(path.join(outDir, `${name}.png`), Buffer.from(result.data, "base64"));
  };

  const clickText = (selector, text) =>
    evaluate(`(() => {
      const nodes = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
      const target = nodes.find((node) => (node.textContent || '').trim().includes(${JSON.stringify(text)}));
      if (!target) return false;
      target.click();
      return true;
    })()`);

  const type = (selector, value) =>
    evaluate(`(() => {
      const input = document.querySelector(${JSON.stringify(selector)});
      if (!input) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);

  await call("Runtime.enable");
  await call("Page.enable");

  await evaluate(`(() => {
    localStorage.removeItem('shiyin.library.v1');
    localStorage.removeItem('shiyin.player.v1');
    localStorage.removeItem('cloudmusic.settings.v1');
    return true;
  })()`);
  await call("Page.reload", { ignoreCache: true });
  await delay(2300);
  await waitForSelector(".track-row");

  const dropTestDir = path.join(root, "shots", "drop-test");
  fs.mkdirSync(dropTestDir, { recursive: true });
  const nativeDropFile = path.join(dropTestDir, "原生拖拽 - 测试歌手.wav");
  const demoTrack = path.join(
    process.env.APPDATA ?? "",
    "shiyin-player",
    "demo-audio",
    "晨雾 - 林间电台.wav",
  );
  if (fs.existsSync(demoTrack)) {
    fs.copyFileSync(demoTrack, nativeDropFile);
  }

  const results = {};
  results.library = await evaluate(
    "Array.from(document.querySelectorAll('.track-row .row-title')).map((node) => node.textContent)",
  );

  await clickText(".chip", "林间电台");
  await delay(500);
  results.artistFilter = await evaluate(
    "Array.from(document.querySelectorAll('.track-row .row-title')).map((node) => node.textContent)",
  );
  await screenshot("filter-artist");

  await clickText(".chip", "全部");
  await delay(300);
  await type("[data-search-input]", "Nova");
  await delay(500);
  results.search = await evaluate(
    "Array.from(document.querySelectorAll('.track-row .row-title')).map((node) => node.textContent)",
  );
  await type("[data-search-input]", "");
  await delay(300);

  await evaluate("document.querySelector('button[aria-label=\"新建歌单\"]')?.click()");
  await waitForSelector(".dialog .text-input");
  await type(".dialog .text-input", "深夜循环");
  await delay(200);
  await evaluate("document.querySelector('.dialog .button-primary')?.click()");
  await delay(600);
  results.afterCreate = await evaluate(
    "Array.from(document.querySelectorAll('.playlist-link span')).map((node) => node.textContent)",
  );
  await screenshot("playlist-empty");

  await clickText(".nav-item", "全部歌曲");
  await delay(400);
  await evaluate("document.querySelector('.track-row button[aria-label=\"添加到歌单\"]')?.click()");
  await waitForSelector(".playlist-picker-row");
  await evaluate("document.querySelector('.playlist-picker-row')?.click()");
  await delay(350);
  await evaluate("document.querySelector('.dialog button[aria-label=\"关闭\"]')?.click()");
  await delay(300);
  await evaluate("document.querySelector('.playlist-link')?.click()");
  await delay(500);
  results.playlist = await evaluate(
    "({ name: document.querySelector('.playlist-title-row h1')?.textContent ?? '', tracks: Array.from(document.querySelectorAll('.track-row .row-title')).map((node) => node.textContent) })",
  );
  await screenshot("playlist-filled");

  await clickText(".nav-item", "歌手");
  await delay(500);
  results.artists = await evaluate(
    "Array.from(document.querySelectorAll('.artist-card')).slice(0, 4).map((node) => node.textContent.trim())",
  );
  await screenshot("artists");

  await clickText(".nav-item", "全部歌曲");
  await delay(350);
  await evaluate("document.querySelector('.track-row')?.click()");
  await delay(900);
  results.playback = await evaluate(
    "({ title: document.querySelector('.player-title')?.textContent ?? '', time: document.querySelector('.timeline .time-label')?.textContent ?? '', button: document.querySelector('.play-button')?.getAttribute('title') ?? '', current: document.querySelector('.track-row.is-current .row-title')?.textContent ?? '' })",
  );
  await screenshot("playing");

  results.playerGeometry = await evaluate(`(() => {
    const bar = document.querySelector('.player-bar')?.getBoundingClientRect();
    const volume = document.querySelector('.volume-slider')?.getBoundingClientRect();
    const play = document.querySelector('.play-button')?.getBoundingClientRect();
    const controls = Array.from(document.querySelectorAll('.transport button'));
    const hits = controls.map((button) => {
      const rect = button.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return {
        label: button.getAttribute('aria-label') || button.title,
        hit: hit === button || button.contains(hit),
      };
    });
    return {
      barWidth: Math.round(bar?.width ?? 0),
      volumeWidth: Math.round(volume?.width ?? 0),
      playCenter: Math.round((play?.left ?? 0) + (play?.width ?? 0) / 2),
      viewportCenter: Math.round(window.innerWidth / 2),
      hits,
    };
  })()`);

  await evaluate("document.querySelector('button[aria-label=\"下一首\"]')?.click()");
  await delay(600);
  results.afterNext = await evaluate(
    "document.querySelector('.player-title')?.textContent ?? ''",
  );

  await evaluate("document.querySelector('.queue-button')?.click()");
  await delay(400);
  results.queue = await evaluate(
    "({ open: Boolean(document.querySelector('.queue-drawer.is-open')), rows: document.querySelectorAll('.queue-row').length })",
  );
  await screenshot("queue");
  await evaluate(
    "document.querySelector('.queue-drawer button[aria-label=\"关闭队列\"]')?.click()",
  );
  await delay(350);

  await evaluate("window.shiyin?.setCloseBehavior?.('ask')");
  await clickText(".sidebar-action", "设置");
  await delay(350);
  await screenshot("settings");
  results.settings = await evaluate(`({
    open: Boolean(document.querySelector('.dialog')),
    rows: document.querySelectorAll('.shortcut-row').length,
    labels: Array.from(document.querySelectorAll('.shortcut-copy span')).map((node) => node.textContent),
    searchHint: document.querySelector('.search-kbd')?.textContent ?? '',
    closeOptions: Array.from(document.querySelectorAll('.close-behavior-copy strong')).map((node) => node.textContent),
  })`);
  await evaluate("window.shiyin?.setCloseBehavior?.('ask')");
  await clickText(".close-behavior", "最小化");
  await delay(250);
  results.settings.closeMinimize = await evaluate(
    "window.shiyin?.getCloseBehavior?.()",
  );
  await clickText(".close-behavior", "每次询问");
  await delay(250);
  results.settings.closeReset = await evaluate(
    "window.shiyin?.getCloseBehavior?.()",
  );
  await evaluate("document.querySelector('.shortcut-key')?.click()");
  await delay(100);
  await call("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "k",
    code: "KeyK",
    windowsVirtualKeyCode: 75,
    nativeVirtualKeyCode: 75,
  });
  await call("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "k",
    code: "KeyK",
    windowsVirtualKeyCode: 75,
    nativeVirtualKeyCode: 75,
  });
  await delay(250);
  results.settings.remapped = await evaluate(`(() => {
    const raw = localStorage.getItem('cloudmusic.settings.v1');
    const shortcuts = raw ? JSON.parse(raw).state.shortcuts : {};
    return {
      label: document.querySelector('.shortcut-key')?.textContent ?? '',
      binding: shortcuts.togglePlayback ?? null,
    };
  })()`);
  await evaluate("document.querySelector('.settings-reset')?.click()");
  await delay(150);
  results.settings.reset = await evaluate(`(() => {
    const raw = localStorage.getItem('cloudmusic.settings.v1');
    const shortcuts = raw ? JSON.parse(raw).state.shortcuts : {};
    return shortcuts.togglePlayback ?? null;
  })()`);
  await evaluate("document.querySelector('.dialog button[aria-label=\"关闭\"]')?.click()");
  await delay(350);

  await call("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await delay(500);
  await screenshot("mobile");
  await clickText(".mobile-nav button", "歌单");
  await delay(450);
  await evaluate("document.querySelector('.playlist-card')?.click()");
  await delay(550);
  await screenshot("mobile-playlist");
  await call("Emulation.clearDeviceMetricsOverride");
  await delay(400);

  await clickText(".nav-item", "全部歌曲");
  await delay(350);
  results.nativeDrag = { tested: fs.existsSync(nativeDropFile) };
  if (fs.existsSync(nativeDropFile)) {
    const dragData = {
      items: [],
      files: [nativeDropFile],
      dragOperationsMask: 1,
    };
    await call("Input.dispatchDragEvent", {
      type: "dragEnter",
      x: 600,
      y: 400,
      data: dragData,
    });
    await delay(300);
    results.nativeDrag.overlay = await evaluate(
      "Boolean(document.querySelector('.drop-veil'))",
    );
    await screenshot("native-drag-overlay");

    await call("Input.dispatchDragEvent", {
      type: "drop",
      x: 600,
      y: 400,
      data: dragData,
    });
    await delay(1100);
    results.nativeDrag.import = await evaluate(
      "({ count: document.querySelectorAll('.track-row').length, titles: Array.from(document.querySelectorAll('.track-row .row-title')).map((node) => node.textContent), toast: Array.from(document.querySelectorAll('.toast')).map((node) => node.textContent) })",
    );
    await screenshot("native-drag-imported");
  }

  await clickText(".chip", "陈默");
  await delay(300);
  await clickText(".chip", "June");
  await delay(400);
  results.chipOrder = await evaluate(`({
    first: document.querySelector('.chips-scroll .chip:nth-child(2) span')?.textContent ?? '',
    active: Array.from(document.querySelectorAll('.chips-scroll .chip.is-active span')).map((node) => node.textContent),
  })`);
  await clickText(".chip", "全部");
  await delay(300);

  await evaluate("document.querySelector('.track-row')?.click()");
  await delay(500);
  results.modes = {};
  results.modes.order = await evaluate(`({
    shuffle: document.querySelector('button[aria-label="随机播放当前列表"]')?.getAttribute('aria-pressed'),
    order: document.querySelector('button[aria-label="顺序播放当前列表"]')?.getAttribute('aria-pressed'),
  })`);
  await evaluate("document.querySelector('button[aria-label=\"随机播放当前列表\"]')?.click()");
  await delay(650);
  results.modes.shuffle = await evaluate(`({
    shuffle: document.querySelector('button[aria-label="随机播放当前列表"]')?.getAttribute('aria-pressed'),
    order: document.querySelector('button[aria-label="顺序播放当前列表"]')?.getAttribute('aria-pressed'),
    title: document.querySelector('.player-title')?.textContent ?? '',
  })`);
  await evaluate("document.querySelector('button[aria-label=\"顺序播放当前列表\"]')?.click()");
  await delay(650);
  results.modes.orderAgain = await evaluate(`({
    shuffle: document.querySelector('button[aria-label="随机播放当前列表"]')?.getAttribute('aria-pressed'),
    order: document.querySelector('button[aria-label="顺序播放当前列表"]')?.getAttribute('aria-pressed'),
    title: document.querySelector('.player-title')?.textContent ?? '',
  })`);

  await evaluate("document.querySelector('.locate-button')?.click()");
  await delay(300);
  results.locate = await evaluate(`({
    highlighted: document.querySelectorAll('.track-row.is-locating').length,
    current: document.querySelector('.track-row.is-current .row-title')?.textContent ?? '',
    top: Math.round(document.querySelector('.track-row.is-current')?.getBoundingClientRect().top ?? 0),
  })`);
  await screenshot("locate-current");
  await delay(1900);
  results.locate.after = await evaluate(
    "document.querySelectorAll('.track-row.is-locating').length",
  );

  await clickText(".view-tools .text-button", "选择");
  await delay(300);
  await evaluate(`(() => {
    const rows = Array.from(document.querySelectorAll('.track-row'));
    rows[0]?.click();
    rows[1]?.click();
    return true;
  })()`);
  await delay(300);
  results.selection = await evaluate(`({
    bar: document.querySelector('.selection-bar strong')?.textContent ?? '',
    selected: document.querySelectorAll('.track-row.is-selected').length,
  })`);
  await screenshot("selection");
  await clickText(".selection-bar .text-button", "新建歌单");
  await waitForSelector(".dialog .text-input");
  await type(".dialog .text-input", "批量歌单");
  await delay(150);
  await evaluate("document.querySelector('.dialog .button-primary')?.click()");
  await delay(700);
  results.batchPlaylist = await evaluate(`({
    name: document.querySelector('.playlist-title-row h1')?.textContent ?? '',
    tracks: Array.from(document.querySelectorAll('.track-row .row-title')).map((node) => node.textContent),
  })`);
  await screenshot("batch-playlist");

  await clickText(".nav-item", "全部歌曲");
  await delay(350);
  const duplicateDir = path.join(dropTestDir, "duplicate");
  fs.mkdirSync(duplicateDir, { recursive: true });
  const duplicateFile = path.join(duplicateDir, "晨雾 - 另一位歌手.wav");
  if (fs.existsSync(demoTrack)) {
    fs.copyFileSync(demoTrack, duplicateFile);
    const dragData = {
      items: [],
      files: [duplicateFile],
      dragOperationsMask: 1,
    };
    await call("Input.dispatchDragEvent", {
      type: "dragEnter",
      x: 600,
      y: 400,
      data: dragData,
    });
    await delay(250);
    await call("Input.dispatchDragEvent", {
      type: "drop",
      x: 600,
      y: 400,
      data: dragData,
    });
    await delay(700);
    results.duplicate = await evaluate(`({
      dialog: document.querySelector('.dialog h2')?.textContent ?? '',
      rows: document.querySelectorAll('.duplicate-row').length,
      labels: Array.from(document.querySelectorAll('.duplicate-label')).map((node) => node.textContent.trim()),
      note: document.querySelector('.duplicate-note')?.textContent?.trim() ?? '',
      choices: Array.from(document.querySelectorAll('.duplicate-choice')).map((node) => node.textContent.trim()),
    })`);
    await clickText(".duplicate-choice", "两首均保留");
    await delay(200);
    await screenshot("duplicate-dialog");
    await clickText(".dialog .button-primary", "继续导入");
    await delay(700);
    results.duplicate.after = await evaluate(`({
      count: document.querySelectorAll('.track-row').length,
      toast: Array.from(document.querySelectorAll('.toast')).map((node) => node.textContent),
    })`);
  }

  // Give Chromium a moment to flush localStorage before the forced shutdown.
  results.storage = await evaluate(
    "(() => { const raw = localStorage.getItem('shiyin.library.v1'); if (!raw) return null; const state = JSON.parse(raw).state; return { tracks: state.tracks.length, playlists: state.playlists.map((p) => ({ name: p.name, ids: p.trackIds.length })) }; })()",
  );
  console.log(JSON.stringify(results, null, 2));

  // Close the window normally so Chromium commits the last localStorage write.
  await evaluate("setTimeout(() => window.close(), 60); true");
  await delay(3000);
} finally {
  try {
    socket?.close();
  } catch {
    // ignore
  }
  killTree(electron);
  killTree(vite);
  await delay(500);
}
