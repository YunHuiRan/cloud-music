# Android / Capacitor 说明

Cloud Music 的 Android 端不是把 Electron 直接移植过去，而是复用 `src/` 的 React 界面和播放逻辑，用 Capacitor 提供 WebView 壳，再通过本地 Capacitor 插件补齐目录选择、扫描、媒体会话和系统栏主题。

## 工程概览

```text
android/
  app/src/main/java/com/shiyin/player/
    MainActivity.java            注册插件、通知权限
    ShiyinLibraryPlugin.java     SAF 目录选择、递归扫描、刷新
    ShiyinPlaybackPlugin.java     JS ↔ 原生播放状态桥
    PlaybackService.java         前台服务 + MediaSession + 通知
    ShiyinThemePlugin.java       状态栏 / 导航栏颜色
  app/src/main/assets/public/     Vite 构建产物（cap sync 写入）
```

包名 `com.shiyin.player`，minSdk 24，compileSdk / targetSdk 36，Java 21。Capacitor 8。

## 目录与扫描

`ShiyinLibraryPlugin.pickFolder()` 使用 `ACTION_OPEN_DOCUMENT_TREE`，并对返回的 tree URI 调用 `takePersistableUriPermission`。
`scanFolder(folder)` 接收 tree URI，不复制音频文件，直接扫描原目录：

- `DocumentsContract.getTreeDocumentId()` 取得根 document id；
- 每个目录通过 `ContentResolver.query(buildChildDocumentsUriUsingTree(...))` 一次取回 id / name / mime / size；
- 递归子目录，按扩展名过滤音频；
- 生成稳定 id：`android:${relativePath}:${size}:${uri}`；
- 返回 `{ tracks }`，字段与 Electron 扫描结果一致。

不逐文件调用 `DocumentFile`，避免大目录下每个文件一次 provider 往返。查询失败时回退到旧 `DocumentFile` 遍历。

`refreshLibrary(entries)` 对持久化 URI 做一次 cursor 查询，返回 `{ valid, missing }`；缺失文件在设置中进入「已失效」。

## 播放与系统媒体会话

Web 层仍然使用 `HTMLAudioElement` 播放；`src/lib/player.ts` 在播放、暂停、切歌、进度变化时调用 `window.shiyin.updateMediaSession(state)`。

`PlaybackService`：

- 前台服务类型 `mediaPlayback`，通知渠道 `cloudmusic-playback`，通知 id `4201`；
- 平台 `MediaSession`，注册播放 / 暂停 / 上一首 / 下一首 / seek 回调；
- 同步标题、歌手、时长、播放位置、播放状态；
- 锁屏、通知栏、蓝牙 / 耳机按键都走同一套 `MediaSession` action；
- action 通过 `ShiyinPlaybackPlugin.dispatchAction()` 发回 Web 层，由 `player.ts` 执行真正的播放操作。

需要权限：`FOREGROUND_SERVICE`、`FOREGROUND_SERVICE_MEDIA_PLAYBACK`、`POST_NOTIFICATIONS`、`WAKE_LOCK`。Android 13+ 首次启动会请求通知权限。

## 主题与系统栏

`ShiyinThemePlugin.setSystemBarsColor()` 设置窗口背景、状态栏和导航栏颜色。JS 在主题变化时调用：

- 亮色：`#F5F7FC`
- 暗色：`#171C26`

Android 15 的系统手势条由系统绘制，深色主题下可能仍是白色；这是当前已知限制，不影响应用内容。

## 构建

要求：

- JDK 21
- Android SDK Platform 36
- Build Tools 36.0.0
- Gradle 8.14.3（项目自带 wrapper 也可以）

```bash
npm run build
npx cap sync android
cd android

# Windows
gradlew.bat assembleRelease bundleRelease

# macOS / Linux
./gradlew assembleRelease bundleRelease
```

如果 `JAVA_HOME` / `ANDROID_HOME` 未全局配置，先在当前终端设置：

```powershell
$env:JAVA_HOME = "C:\path\to\jdk-21"
$env:ANDROID_HOME = "C:\path\to\android-sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
```

## Release 签名

`android/app/build.gradle` 会读取 `android/keystore.properties`：

```properties
storeFile=keystore/cloudmusic-release.jks
storePassword=...
keyAlias=cloudmusic
keyPassword=...
```

`android/keystore/` 与 `keystore.properties` 已被 `.gitignore` 忽略。当前发布包使用本地自签名证书；如果要上架应用商店，请替换为自己的正式 keystore，并妥善备份。

```bash
# 检查签名
$env:JAVA_HOME="C:\path\to\jdk-21"
& "$env:ANDROID_HOME\build-tools\36.0.0\apksigner.bat" verify --print-certs `
  app\build\outputs\apk\release\app-release.apk
```

## 安装

```bash
adb install -r release/Cloud-Music-Android-1.1.0-release.apk
```

如果设备上已有使用其他签名（例如 debug 包）的同包名应用，需要先卸载：

```bash
adb uninstall com.shiyin.player
adb install release/Cloud-Music-Android-1.1.0-release.apk
```

## 已知限制

- 不读取 ID3 / FLAC 标签，信息来自文件名。
- 不复制音频到沙箱；原目录被删除或授权失效后，歌曲会进入「已失效」。
- 通知栏使用系统媒体样式，不提供应用内自定义布局。
- Android 15 手势条颜色由系统控制。
- 当前 release 使用本地自签名证书。
