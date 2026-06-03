# 小程序 AppID 切换记录（2026-05-11）

## 背景

- 当前要发布的小程序账号已切换为 `wxbb6b465d70074c35`。
- 本地小程序工程上传配置已切换到该 AppID。
- 生产 API 域名仍为 `https://api.xn--m5rv27f.com`。

## 本地已统一项

- `apps/client/project.config.json`
- `apps/project.config.json`
- `.env.example`
- `docs/engineering/weapp-login.md`
- `docs/example/生产环境微信登录与支付配置清单.tex`

上述文件均已按 `wxbb6b465d70074c35` 口径更新。

## 服务器实查结论

生产服务器运行正常，`pm2` 中 `sunye-api` 在线，`/health` 正常，短信接口可正常返回冷却时间。

但当前生产环境文件仍为旧小程序配置：

- `WX_MP_APPID=wxa053408fad6ab1df`
- `WX_MP_ID=wxa053408fad6ab1df`
- `WX_MP_SECRET=<旧小程序 secret>`

因此：

- 短信登录链路本身可用。
- 新小程序账号的微信登录链路当前不可用。
- 根因是“前端 AppID 已切到新账号，服务端微信配置仍指向旧账号”。

## 发布前必须完成的切换

生产环境至少需要同步以下变量：

- `WX_MP_APPID=wxbb6b465d70074c35`
- `WX_MP_ID=wxbb6b465d70074c35`
- `WX_MP_SECRET=<新小程序对应 AppSecret>`

若未拿到新小程序的 `AppSecret`，不要切换生产后端微信登录配置，否则无法完成真实微信登录。

## 微信后台同步项

在 `wxbb6b465d70074c35` 对应的小程序后台确认：

- `request 合法域名` 包含 `https://api.xn--m5rv27f.com`
- 如涉及上传下载，补齐 `uploadFile` / `downloadFile` 合法域名
- 如涉及 `web-view`，补齐业务域名

## 当前状态

- 小程序代码包：可重新上传到 `wxbb6b465d70074c35`
- 服务器代码：无需因 AppID 切换而强制改动业务代码
- 服务器运行配置：仍缺新小程序 `AppSecret`，这是切换生产微信登录的唯一硬阻塞
