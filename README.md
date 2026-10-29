# Cloud Music

[中文](README.md) · [English](README.en.md)

一个干净、克制、完全离线的本地音乐播放器。文件名就是曲库信息，不显示歌词，也不做在线服务。

桌面端使用 **Electron + React + TypeScript**，Android 端使用 **Capacitor + 原生 Java 插件**。两端共享同一套界面、状态、文件名解析和播放逻辑。

![桌面端亮色](docs/screenshots/desktop-light.png)

## 功能

### 曲库与导入

- 递归扫描音乐文件夹，或直接把音频文件 / 文件夹拖进窗口
- 按文件名解析曲名与全部参与者：`歌曲名—歌手1&歌手2&歌手3.mp3`
- 大曲库导入使用后台扫描与精确去重索引，避免一次性比较所有歌曲
- 导入重复歌曲时提示，可逐首选择保留曲库版本、使用新文件，或同名不同歌手时两首都保留
- 曲库刷新：文件丢失的歌曲进入「已失效」，可清空记录
- 批量选择、批量移除或全部移除；只移出曲库，不删除本地文件

### 浏览与整理

- 按歌手筛选，歌手页可查看所有合作曲目
- 搜索、按标题 / 歌手 / 添加时间排序
- 歌手标签选中后自动移到最前，标签栏可左右拖动
- 歌单创建、重命名、删除、添加 / 移除歌曲
- 筛选后可把选中的歌曲直接建为新歌单
- 我喜欢的、播放队列

### 播放

- 顺序播放、随机播放、单曲循环、列表循环
- 播放 / 暂停、上一首 / 下一首、拖动进度、音量 / 静音
- 点击当前列表的顺序 / 随机按钮，从当前可见列表重新开始播放
- 定位当前播放歌曲，滚动到列表中央并短暂高亮
- 系统媒体控制：Windows MediaSession；Android 原生 MediaSession、锁屏卡片、通知栏和蓝牙 / 耳机按键
- 关闭窗口时可选择最小化到系统托盘或直接退出，并记住选择（设置中可修改）

### 界面

- 亮色 / 暗色主题，右上角一键切换，首次启动跟随系统
- 蓝紫主色、薄荷绿播放态、珊瑚红警示态
- 无歌词、无在线封面；封面由曲名哈希生成渐变和首字
- 列表重排使用 FLIP 动画，尊重 `prefers-reduced-motion`
- 860px 以下切换为底部导航；Android 播放条单独加大并隐藏左侧封面
- 可自定义键盘快捷键，设置保存在本机

## 快速开始

要求 Node.js 20+。

```bash
npm install
npm run dev     # Vite + Electron 开发模式
```

生产构建并启动：

```bash
npm run build
npm start
```

运行测试：

```bash
npm test
```

> 如果 Electron 下载缓慢，可先配置镜像，或把已有的
> `electron-v33.4.11-win32-x64.zip` 放进 Electron 缓存目录后重试。

## 打包

### Windows

```bash
npm run dist
```

输出：`release/Cloud-Music-Setup-1.1.0.exe`。安装包未做代码签名，首次运行时 Windows SmartScreen 可能提示，选择「更多信息 → 仍要运行」即可。

### Android

先安装 Android SDK 36、Build Tools 36 和 JDK 21，然后：

```bash
npm run build
npx cap sync android
cd android
gradlew.bat assembleRelease bundleRelease
```

当前项目使用本地 release keystore 签名（路径与密码在 `android/keystore.properties`，该文件不会提交）。产物：

```text
android/app/build/outputs/apk/release/app-release.apk
android/app/build/outputs/bundle/release/app-release.aab
```

发布包已经复制到 `release/Cloud-Music-Android-1.1.0-release.apk` 和 `release/Cloud-Music-Android-1.1.0-release.aab`。具体签名与安装说明见 [docs/RELEASE.md](docs/RELEASE.md)。

> 如果设备上装过使用其他签名的调试版，需要先卸载再安装 release 包。

## 使用

1. 首次打开点击「导入文件夹」，选择存放音乐的目录。
2. 也可以把音频文件（或文件夹）直接拖进窗口；桌面端会读取真实路径并持久化，浏览器预览使用临时 object URL。
3. 点击任意歌曲开始播放；点击歌手名即可筛选该歌手的全部歌曲。
4. 点击歌曲右侧的「+」加入歌单或新建歌单。
5. 点击「选择」可批量勾选歌曲；筛选后全选当前，可批量移除或建成新歌单。
6. 右上角切换亮色 / 暗色主题；左下角「设置」可导入音乐、刷新曲库、修改快捷键和关闭窗口行为。
7. 关闭窗口后可在设置中选择最小化到托盘；托盘菜单可重新显示窗口或退出。

快捷键（可在设置中修改）：

| 按键 | 行为 |
| --- | --- |
| `/` | 聚焦搜索框 |
| `Space` | 播放 / 暂停 |
| `Ctrl + ←` / `Ctrl + →` | 上一首 / 下一首 |
| `↑` / `↓` | 音量 + / - |
| `M` | 静音 / 取消静音 |
| `Ctrl + ,` | 打开设置 |
| `Esc` | 关闭队列或弹窗 |

## 文件命名规则

支持的扩展名：`mp3`、`flac`、`m4a`、`aac`、`ogg`、`oga`、`opus`、`wav`、`webm`、`aiff`、`aif`、`wma`、`mka`、`m4b`。

```text
潮汐来信—海边的房间&林间电台.mp3
Paper Boat—June&Nova.flac
夜行列车—北纬三十度&陈默&林间电台.wav
```

- 标准格式：`歌曲名—歌手1&歌手2&歌手3`，破折号两侧不加空格。
- 最后一个分隔符会被视为曲名与歌手的分界，因此曲名内可以保留普通连字符。
- 同时兼容旧格式的 `-`、`–`、`－` 分隔符，以及 `＆` 全角连接符。
- 参与者用 `&` 分隔，自动去重、去空白。
- 找不到歌手时归入「未知艺术家」。

## 数据与隐私

- 曲库、歌单、喜欢、主题和播放偏好全部保存在本机 `localStorage`。
- 关闭窗口行为保存在 `%APPDATA%\shiyin-player\window-prefs.json`。
- 不上传任何文件，不请求外部接口。
- 桌面端通过自定义 `aria-media://` 协议读取本地音频，只允许访问用户主动导入过的路径，并支持 HTTP Range 拖动进度。
- Android 通过 Storage Access Framework 直接读取用户选中的目录，不复制音乐文件；授权持久化，原目录失效时歌曲进入「已失效」。
- 浏览器模式下的文件使用临时 object URL，刷新后曲库为空，这是刻意设计。

## Android 说明

- 目录选择：`ACTION_OPEN_DOCUMENT_TREE` + 持久化读权限。
- 扫描：`DocumentsContract` + 每个目录一次 `ContentResolver.query`，不逐文件查询。
- 播放：WebView `<audio>` 播放，原生 `PlaybackService` 同步 MediaSession、通知栏和锁屏控制。
- 返回键：优先关闭弹窗 / 队列 / 歌单详情，最后才退出。
- 状态栏 / 导航栏颜色随主题切换；Android 15 的系统手势条仍由系统绘制，深色下可能保持白色。
- 详细架构与权限见 [docs/ANDROID.md](docs/ANDROID.md)。

| Android 亮色 | Android 暗色 |
| --- | --- |
| ![Android 亮色](docs/screenshots/android-light.png) | ![Android 暗色](docs/screenshots/android-dark.png) |

## 项目结构

```text
electron/
  main.cjs          窗口、文件夹扫描、aria-media Range 协议、托盘、截图钩子
  preload.cjs       window.shiyin 原生桥
src/
  lib/              解析、播放器、状态、去重、FLIP、虚拟列表、原生桥
  components/       侧栏、顶栏、歌曲列表、播放条、队列、弹窗
  views/            全部歌曲、歌手、歌单、歌单详情、我喜欢的
  styles.css        设计令牌与响应式布局
android/            Capacitor Android 工程
  app/src/main/java/com/shiyin/player/
                    ShiyinLibraryPlugin、ShiyinPlaybackPlugin、PlaybackService
scripts/            开发、构建、测试脚本
docs/               Android、发布说明与截图
```

## 已知边界

- 曲目信息只来自文件名，不读取 ID3 / FLAC 元数据。
- 没有歌词、封面抓取、在线搜索或云同步。
- Android release 包使用本地自签名证书；上架应用商店需要换成自己的正式签名。
- Windows 安装包未签名，SmartScreen 可能提示。
- Android 15 手势导航条为系统绘制，深色主题下不随应用变色。
