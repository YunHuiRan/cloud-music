"use strict";

const { contextBridge, ipcRenderer, webUtils } = require("electron");

let dropCallback = null;

// Explorer/desktop drags carry real file paths. Resolve them in the preload
// before React sees the drop, so the main process can scan and persist files.
window.addEventListener(
  "drop",
  (event) => {
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length === 0) return;

    const paths = [];
    for (const file of files) {
      try {
        const filePath = webUtils?.getPathForFile?.(file);
        if (filePath) paths.push(filePath);
      } catch {
        // A synthetic or unsupported drop has no native path.
      }
    }
    if (paths.length === 0) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    void ipcRenderer
      .invoke("library:import-paths", paths)
      .then((tracks) => {
        if (typeof dropCallback === "function") dropCallback(tracks);
      })
      .catch(() => {
        if (typeof dropCallback === "function") dropCallback([]);
      });
  },
  true,
);

let autoDemo = false;
let version = "";
try {
  autoDemo = ipcRenderer.sendSync("app:auto-demo") === true;
  version = String(ipcRenderer.sendSync("app:version") || "");
} catch {
  // The bridge is best-effort; the renderer works without these hints.
}

// The library is hydrated from localStorage during the first React paint.
// Authorize its files before any duration probe or <audio> request is made.
try {
  const raw = window.localStorage.getItem("shiyin.library.v1");
  const saved = raw ? JSON.parse(raw) : null;
  const paths = Array.isArray(saved?.state?.tracks)
    ? saved.state.tracks
        .map((track) => track?.path)
        .filter((value) => typeof value === "string" && value.length > 0)
    : [];
  if (paths.length > 0) {
    ipcRenderer.sendSync("library:authorize-sync", paths);
  }
} catch {
  // Browser storage can be unavailable before the document is ready.
}

contextBridge.exposeInMainWorld("shiyin", {
  platform: "electron",
  version,
  autoDemo,
  pickFolder: () => ipcRenderer.invoke("library:pick-folder"),
  scanFolder: (folder) => ipcRenderer.invoke("library:scan-folder", folder),
  scanDemo: () => ipcRenderer.invoke("library:scan-demo"),
  refreshLibrary: (entries) => ipcRenderer.invoke("library:refresh", entries),
  authorize: (paths) => ipcRenderer.invoke("library:authorize", paths),
  getCloseBehavior: () => ipcRenderer.invoke("window:get-close-behavior"),
  setCloseBehavior: (behavior) =>
    ipcRenderer.invoke("window:set-close-behavior", behavior),
  quit: () => ipcRenderer.invoke("app:quit"),
  onDropped: (callback) => {
    dropCallback = typeof callback === "function" ? callback : null;
  },
  offDropped: () => {
    dropCallback = null;
  },
});
