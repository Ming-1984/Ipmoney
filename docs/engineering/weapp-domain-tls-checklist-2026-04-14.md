# 小程序域名/TLS/证书排查清单（2026-04-14）

## 1. 典型报错

- 开发者工具提示：`工具未校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书`
- 请求失败：`url not in domain list` / `SSL` / `TLS` / `certificate` 相关错误

## 2. 必做配置（提审与生产都必须）

1. 小程序后台 -> 开发管理 -> 开发设置  
   `request 合法域名` 必须包含 API 域名（当前为 `https://api.笋嘢.com`）。
2. 如果页面使用 `web-view`，需同时配置 `业务域名` 白名单。
3. API 证书必须有效且完整，TLS 建议仅开启 `1.2+`。
4. 小程序构建配置必须指向正式 HTTPS 域名，不能是 localhost/127.0.0.1。
5. 中文域名若平台不接受 Unicode，请使用 Punycode：`api.xn--m5rv27f.com`。

## 3. 当前项目对齐结果

- 小程序 API 基址：`TARO_APP_API_BASE_URL=https://api.笋嘢.com`
- 管理后台 API 基址：`VITE_API_BASE_URL=https://api.笋嘢.com`
- `apps/client/project.config.json` 已改为 `urlCheck=true`，开发工具默认启用域名校验

## 4. 验收步骤（真机/提审前）

1. 在微信开发者工具关闭“忽略合法域名校验”。
2. 打开首页，确认 `/config/home/landing` 能正常返回。
3. 进入登录页发送短信验证码，确认 `/auth/sms/send` 返回 200。
4. 抓包确认所有请求都是 `https://api.笋嘢.com/...`，无本地地址泄漏。

## 5. 常见漏配点

- 只配了 `request 合法域名`，漏配了 `web-view 业务域名`
- 域名证书过期或中间证书链不完整
- 构建仍使用本地 `.env.local` 的 `http://127.0.0.1` 地址
- 生产环境未配置 SMS 变量，导致短信登录不可用
