# Release 1.1.0

## 产物

| 平台 | 文件 | 大小 | SHA-256 |
| --- | --- | ---: | --- |
| Windows x64 | `release/Cloud-Music-Setup-1.1.0.exe` | 102,834,049 B | `07976D8EFEC4BE8613FDFE88E785D7D1E5BBF3E07B3B8A3400BCA3D471DC19F5` |
| Android APK | `release/Cloud-Music-Android-1.1.0-release.apk` | 3,281,018 B | `0F7BEFB7885F324C51DF201B07725FE9D5FE4464F515FADEC7ACB85BDFC8D34A` |
| Android AAB | `release/Cloud-Music-Android-1.1.0-release.aab` | 3,121,322 B | `4385D2A48A1FE1CF1F5D469A3BEFD7C081EC17FC6F23F7FB9CEA1327118AC641` |

版本：桌面端 / Android 均为 `1.1.0`；Android `versionCode=2`。

## Windows

构建：

```bash
npm run dist
```

输出 `release/Cloud-Music-Setup-1.1.0.exe`。未使用代码签名证书，首次运行可能触发 SmartScreen；选择「更多信息 → 仍要运行」即可。

安装包会创建桌面和开始菜单快捷方式，支持自选安装目录。托盘常驻和关闭行为在应用设置中调整。

## Android

### 签名

当前 release 使用本地自签名证书：

```text
android/keystore/cloudmusic-release.jks
alias: cloudmusic
证书 DN: CN=Cloud Music, OU=Local, O=Cloud Music, L=Local, ST=Local, C=CN
证书 SHA-256: e8946958be5e56663ee80abadcbce4da8102177287ab81bcc617bd9eb436440c
```

密码与路径在 `android/keystore.properties`。这两个文件都被 `.gitignore` 忽略。**请备份 keystore**；后续升级必须使用同一签名，否则用户需要卸载重装。

如果要在应用商店发布，请替换为你自己的正式 keystore，并更新 `android/app/build.gradle` 的 signingConfig。

### 构建

```powershell
npm run build
npx cap sync android

$env:JAVA_HOME = "D:\Code\toolchain\jdk-21"
$env:ANDROID_HOME = "D:\Code\toolchain\android-sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME

cd android
& "D:\Code\toolchain\gradle-8.14.3\bin\gradle.bat" assembleRelease bundleRelease --no-daemon
```

原生产物：

```text
android/app/build/outputs/apk/release/app-release.apk
android/app/build/outputs/bundle/release/app-release.aab
```

### 安装

```bash
adb install -r release/Cloud-Music-Android-1.1.0-release.apk
```

如果设备上已有使用其他签名的包（例如旧 debug 包），先卸载：

```bash
adb uninstall com.shiyin.player
adb install release/Cloud-Music-Android-1.1.0-release.apk
```

### 验证

```powershell
$env:JAVA_HOME = "D:\Code\toolchain\jdk-21"
& "D:\Code\toolchain\android-sdk\build-tools\36.0.0\apksigner.bat" verify --print-certs `
  release\Cloud-Music-Android-1.1.0-release.apk
```

已在 Android 15 / API 35 模拟器（Pixel 6）上安装并启动 release 包；媒体会话、锁屏、通知栏、蓝牙按键、可见列表顺序 / 随机播放和 Android 播放条布局均已验证。

## 构建环境

- Node.js 20+
- JDK 21
- Android SDK Platform 36
- Build Tools 36.0.0
- Gradle 8.14.3（项目 wrapper 或本机安装均可）
- Windows 10/11 x64

## 备注

- Windows 安装包未签名；Android release 为本地自签名。
- Android 15 的系统手势条由系统绘制，深色主题下可能仍为白色。
- 曲目信息只来自文件名，不读取 ID3 / FLAC 标签。
