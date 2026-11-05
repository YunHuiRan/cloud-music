// Build the Android release APK.
//
// The native Android project (and its Java plugin sources) was lost in the
// 2026-10-30 cleanup, so the APK is produced by patching the existing signed
// package: replace assets/public with the fresh Vite build, zipalign, sign with
// keys/cloudmusic-liquid-2026.jks, verify. See docs/ANDROID.md.
//
// Usage: node scripts/apk.mjs [--base <apk>] [--out <apk>] [--skip-build]
//
// Toolchain comes from ANDROID_HOME / ANDROID_SDK_ROOT (build-tools;36.0.0 and
// platform-tools) and JAVA_HOME; local fallbacks:
//   D:\Code\toolchain\android-sdk, D:\Code\toolchain\jdk-21
// Keystore settings come from keys/keystore.properties (JSON-ish key=value),
// overridable with APK_KEYSTORE / APK_KEY_ALIAS / APK_KEYSTORE_PASSWORD.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const version = pkg.version;

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const skipBuild = args.includes("--skip-build");

const work = path.join(root, "build", "apk-work");
const dist = path.join(root, "dist");
const out = path.resolve(root, opt("--out", `release/Cloud-Music-Android-${version}-liquid.apk`));
const base = path.resolve(root, opt("--base", `release/Cloud-Music-Android-${version}-liquid.apk`));

const firstExisting = (candidates) => candidates.find((p) => p && fs.existsSync(p));

const sdk =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  firstExisting([path.join("D:", "Code", "toolchain", "android-sdk")]);
if (!sdk) die("Android SDK not found; set ANDROID_HOME.");

const buildToolsRoot = path.join(sdk, "build-tools");
const buildTools =
  firstExisting([path.join(buildToolsRoot, "36.0.0")]) ||
  (fs.existsSync(buildToolsRoot)
    ? fs
        .readdirSync(buildToolsRoot)
        .sort()
        .reverse()
        .map((v) => path.join(buildToolsRoot, v))
        .find((p) => fs.existsSync(path.join(p, "zipalign.exe")) || fs.existsSync(path.join(p, "zipalign")))
    : undefined);
if (!buildTools) die("Android build-tools with zipalign not found; install build-tools;36.0.0.");

const javaExe = process.platform === "win32" ? "java.exe" : "java";
const java =
  firstExisting([
    process.env.JAVA_HOME && path.join(process.env.JAVA_HOME, "bin", javaExe),
    path.join("D:", "Code", "toolchain", "jdk-21", "bin", javaExe),
  ]) || "java";
const exe = process.platform === "win32" ? ".exe" : "";

const zipalign = path.join(buildTools, `zipalign${exe}`);
const apksignerJar = path.join(buildTools, "lib", "apksigner.jar");
const python =
  firstExisting([
    process.env.PYTHON,
    path.join(process.env.USERPROFILE || "", ".dsh", "dsh-runtimes", "dsh-primary-runtime", "dependencies", "python", "python.exe"),
  ]) || "python";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function run(cmd, argv, label) {
  console.log(`> ${label}`);
  const res = spawnSync(cmd, argv, { cwd: root, stdio: "inherit" });
  if (res.error) die(`${label} failed: ${res.error.message}`);
  if (res.status !== 0) die(`${label} failed with exit code ${res.status}`);
}

function properties() {
  const file = path.join(root, "keys", "keystore.properties");
  const values = {};
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_.-]+)\s*=\s*(.*)\s*$/);
      if (m && !line.trim().startsWith("#")) values[m[1]] = m[2];
    }
  }
  return values;
}

const props = properties();
const keystore = path.resolve(root, process.env.APK_KEYSTORE || props.storeFile || "keys/cloudmusic-liquid-2026.jks");
const alias = process.env.APK_KEY_ALIAS || props.keyAlias || "cloudmusic";
const storePass = process.env.APK_KEYSTORE_PASSWORD || props.storePassword;
const keyPass = process.env.APK_KEY_PASSWORD || props.keyPassword || storePass;

if (!fs.existsSync(base)) die(`base APK not found: ${base} (pass --base <apk>)`);
if (!fs.existsSync(keystore)) die(`keystore not found: ${keystore}`);
if (!storePass) die("keystore password missing: set keys/keystore.properties or APK_KEYSTORE_PASSWORD.");

if (!skipBuild) run(process.execPath, [path.join(root, "node_modules", "vite", "bin", "vite.js"), "build"], "vite build");

fs.mkdirSync(work, { recursive: true });
const patched = path.join(work, "patched.apk");
const aligned = path.join(work, "aligned.apk");
const signed = path.join(work, "signed.apk");
run(python, [path.join(root, "scripts", "patch-apk.py"), base, dist, path.join(work, "extract"), patched], "patch apk");
run(zipalign, ["-p", "-f", "4", patched, aligned], "zipalign");
run(
  java,
  [
    "-jar",
    apksignerJar,
    "sign",
    "--ks",
    keystore,
    "--ks-key-alias",
    alias,
    `--ks-pass`,
    `pass:${storePass}`,
    `--key-pass`,
    `pass:${keyPass}`,
    "--out",
    signed,
    aligned,
  ],
  "apksigner sign",
);
fs.copyFileSync(signed, out);
run(java, ["-jar", apksignerJar, "verify", "--verbose", "--print-certs", out], "apksigner verify");

const size = fs.statSync(out).size;
const sha = crypto.createHash("sha256").update(fs.readFileSync(out)).digest("hex").toUpperCase();
console.log(`\n${path.relative(root, out)}  ${size.toLocaleString("en-US")} B\nSHA-256 ${sha}`);
