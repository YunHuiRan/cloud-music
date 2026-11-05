# Release 1.2.1 — liquid glass layout revision

Rebuilt 2026-11-05 from the current worktree (web bundle + native Android shell).

| Platform | File | Size | SHA-256 |
| --- | --- | ---: | --- |
| Windows x64 | `release/Cloud-Music-Setup-1.2.1.exe` | 94,390,248 B | `C66134408716F7481A65C79FC046FAFE4C219D3AC832935026A9B302665FD5F7` |
| Android APK | `release/Cloud-Music-Android-1.2.1-liquid.apk` | 3,325,429 B | `CBE09BE9270980178E12C844130A153DB12393D38684D0C3A3FC3B71C4994CEB` |

Android versionCode 4, versionName 1.2.1, minSdk 24 / targetSdk 36, signed with APK Signature Scheme v2+v3; certificate SHA-256 `49DAF5A5461FBF109F0B6CFA85DABB73194DEDBA28A92F473DF9761F4DB89CB7`. The Windows installer is unsigned, so SmartScreen may prompt.

There is no matching AAB for this revision. The Android native project was lost in an earlier cleanup incident; the APK was produced by replacing the web assets inside the existing package and re-signing it (`node scripts/apk.mjs`). AAB generation is not possible until the native project is restored.

## Build

```powershell
# Desktop (NSIS installer in release/)
npm run dist

# Android (needs JDK 21 + Android SDK build-tools 36; keys/keystore.properties)
npm run build
node scripts/apk.mjs --skip-build
```

`scripts/apk.mjs` patches `release/Cloud-Music-Android-<version>-liquid.apk` in place: it swaps `assets/public` for the fresh Vite build, strips the old v1 signature files, zipaligns and re-signs with `keys/cloudmusic-liquid-2026.jks`. The base package is kept so versionCode, native plugins, resources and the manifest stay untouched. Pass `--base <old.apk>` when rebuilding from a different base.

## 1.2.1 layout revision highlights

- Removed 我喜欢的 end-to-end, including its view, sidebar entry, mobile navigation item, persistence and row/menu actions.
- Removed the 乐动由你 slogan from the sidebar and mobile brand.
- Shuffle/order are plain buttons; no mode is selected until a track is playing.
- Removed the playback progress bar and the temporary loading icon during track changes.
- Track filtering fades rows out and back in; selection checkboxes are always mounted so the checkbox does not flash when selection mode starts.
- Desktop is now wide-only, enforced by a 1200 px minimum width. The sidebar spans the full window height, and the player sits only in the main column as three separate glass islands: song information, centered transport, and volume/device/locate/repeat.
- Android uses one floating glass control island containing mode buttons plus previous/play/next/queue, and a separate floating glass navigation island with four items. The top bar, control island, and navigation island all slide away on downward scroll and return on upward scroll.
- The bottom navigation island supports drag-to-select. The control island glows on press but suppresses button activation while dragging; mode buttons have no persistent focus ring or hover pill.
- New-playlist dialog is visual-viewport aware; backdrop closing no longer leaves a page scrollbar or causes layout flicker.
- Playlist detail no longer duplicates 播放全部/随机播放; the bottom transport handles playback.
- Large-library performance: artist chips are capped, artist FLIP is disabled for large grids, list/artist filtering is deferred, and the large list surface no longer uses a full blur repaint.
- Desktop player islands align exactly with the track list: information starts at the list's left edge and utilities end at its right edge; the information island measures its title/artist width.
- The desktop player islands slide down out of view while scrolling down and return when scrolling up.
- Android places all six transport controls in one content-sized glass island; 随机/顺序 are horizontal. The separate four-item nav island remains draggable.
- All existing playback, import, queue, theme, global shortcut and media-session behavior is retained.

## Install

- Windows: run `Cloud-Music-Setup-1.2.1.exe`.
- Android: this APK uses a new signing key. Uninstall the previous Cloud Music package first, then install `Cloud-Music-Android-1.2.1-liquid.apk`.

## Verification

- `npx tsc --noEmit`
- `npm test -- --run` — 18/18
- `npm run build`
- Windows installer built with `npm run dist`; `node scripts/verify-desktop.mjs` launches the packaged app and checks it renders 343 library tracks with no console errors (`shots/packaged-desktop.png`).
- Android APK: `apksigner verify` reports v2+v3 valid with the certificate above; `aapt2 dump badging` reports package `com.shiyin.player`, versionCode 4, minSdk 24, targetSdk 36; installed on an Android 15 (API 35) emulator, imported 8 tracks through the SAF folder picker, played a track, and confirmed `MediaSession` state PLAYING plus the foreground playback notification.

Screenshots: `docs/screenshots/desktop-1.2.1.png`, `android-1.2.1-light.png`, `android-1.2.1-dark.png` (captured from these exact builds).
