import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...process.env };

// Running Electron as plain Node would make the launcher exit immediately.
delete env.ELECTRON_RUN_AS_NODE;

const sevenZip = path.join(root, "node_modules", "7zip-bin", "win", "x64", "7za.exe");
if (existsSync(sevenZip)) {
  env.ELECTRON_BUILDER_7ZIP_PATH = sevenZip;
}

// Prefer the locally cached NSIS 3 toolset when present. This keeps offline builds
// working even though electron-builder 26 defaults to a newer downloadable bundle.
const nsisRoot = path.join(process.env.LOCALAPPDATA ?? "", "electron-builder", "Cache", "nsis");
const nsisDir = path.join(nsisRoot, "nsis-3.0.4.1");
const nsisResources = path.join(nsisRoot, "nsis-resources-3.4.1");

if (existsSync(path.join(nsisDir, "Bin", "makensis.exe"))) {
  env.ELECTRON_BUILDER_NSIS_DIR = nsisDir;
}
if (existsSync(path.join(nsisResources, "plugins"))) {
  env.ELECTRON_BUILDER_NSIS_RESOURCES_DIR = nsisResources;
}

const cli = path.join(root, "node_modules", "electron-builder", "cli.js");
const child = spawn(process.execPath, [cli, "--win", ...process.argv.slice(2)], {
  cwd: root,
  env,
  stdio: "inherit",
  windowsHide: false,
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
