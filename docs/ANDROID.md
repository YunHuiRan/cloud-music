# Android notes

- appId `com.shiyin.player`
- versionCode 4 / versionName 1.2.1
- minSdk 24, compileSdk 36, targetSdk 36
- Native bridge: `ShiyinLibraryPlugin` (SAF folder import / refresh)
- Playback: `PlaybackService` + `ShiyinPlaybackPlugin` (MediaSession + foreground notification)
- Current build: `release/Cloud-Music-Android-1.2.1-liquid.apk`
- Signing certificate SHA-256: `49DAF5A5461FBF109F0B6CFA85DABB73194DEDBA28A92F473DF9761F4DB89CB7`
- Signature schemes: v2 + v3 (API 24+; JAR/v1 not used)
- The APK uses a new signing key. Uninstall the previous package before installing this one.
- Install: `adb install -r release/Cloud-Music-Android-1.2.1-liquid.apk` (or uninstall first if signature differs).
- Native source status: the `android/` project was deleted in the 2026-10-30 cleanup incident. The APK was built by replacing `assets/public` in the existing package, zipaligning and re-signing; the source must be restored before a normal Gradle build or AAB can be produced.

## Verified on this build

Android 15 (API 35) emulator, `sdk_gphone64_x86_64`, 1080×2400: `adb install -r` succeeds, SAF folder import loaded 8 tracks through `ShiyinLibraryPlugin`, playback started, and `dumpsys media_session` reported `state=PLAYING(3)` with metadata for the current track while the `cloudmusic-playback` foreground notification was posted.

## Signing key

The old `keys/cloudmusic-liquid.jks` was made with a lost password, so 1.2.1 packaging uses a new key:

| Item | Value |
| --- | --- |
| Keystore | `keys/cloudmusic-liquid-2026.jks` (PKCS12) |
| Alias | `cloudmusic` |
| Store / key password | `ShiyinLiquid2026` |
| Validity | 2026-11-05 → 2056-10-28 |
| Certificate SHA-256 | `49DAF5A5461FBF109F0B6CFA85DABB73194DEDBA28A92F473DF9761F4DB89CB7` |

The same values live in `keys/keystore.properties` (read by `scripts/apk.mjs`; override with `APK_KEYSTORE`, `APK_KEY_ALIAS`, `APK_KEYSTORE_PASSWORD`, `APK_KEY_PASSWORD`). Keep the keystore and password backed up: losing them again means every future update needs a new application identity.

## Rebuilding the APK

```powershell
# JDK 21 + Android SDK (build-tools 36, platform-tools)
$env:JAVA_HOME = "D:\Code\toolchain\jdk-21"
$env:ANDROID_HOME = "D:\Code\toolchain\android-sdk"
node scripts/apk.mjs --skip-build
```

The script runs `scripts/patch-apk.py` (Python 3) to replace `assets/public` inside the existing signed APK while preserving every other entry and its compression, then zipaligns and signs with `apksigner.jar`. Without `--skip-build` it builds the web bundle first. Use `--base <apk>` to start from another package and `--out <apk>` to write elsewhere.
