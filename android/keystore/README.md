# Android release keystore

本目录用于本地 release 签名，**不要提交或公开**。

- Keystore: `cloudmusic-release.jks`
- Alias: `cloudmusic`
- 证书 DN: `CN=Cloud Music, OU=Local, O=Cloud Music, L=Local, ST=Local, C=CN`
- 证书 SHA-256: `e8946958be5e56663ee80abadcbce4da8102177287ab81bcc617bd9eb436440c`
- 密码与路径: `android/keystore.properties`（已被 `.gitignore` 忽略）

请把 `cloudmusic-release.jks` 和 `keystore.properties` 备份到安全位置。后续升级必须使用同一份 keystore，否则已安装用户需要先卸载才能安装新包。

上架 Google Play 前，请替换为你自己的正式签名，并更新 `android/app/build.gradle` 中的 signingConfig。
