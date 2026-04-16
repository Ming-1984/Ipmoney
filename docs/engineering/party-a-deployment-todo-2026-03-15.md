# 甲方部署与联调 TODO（2026-03-23 对齐版）

> 目标：基于当前代码与生产域名配置，输出可直接执行的甲方部署与联调清单。
> 范围：真实微信登录、微信支付、回调链路、生产环境变量、上线闸门。

## 0. 前置结论（已对齐）

- 真实微信登录链路已支持：`wx.login -> /auth/wechat/mp-login -> code2Session`。
- 手机号绑定链路已支持：`getPhoneNumber -> /auth/wechat/phone-bind`。
- 微信支付下单/回调接口已接入，回调地址已固定为：`https://api.笋嘢.com/webhooks/wechatpay/notify`。
- 当前上线阻塞点主要是生产密钥与域名白名单配置（非代码缺口）。

## 1. 线下交付物（不入仓库）

- [ ] 商户私钥：`apiclient_key.pem`
- [ ] 商户证书：`apiclient_cert.pem`
- [ ] 商户证书包：`apiclient_cert.p12`（如甲方要求）
- [ ] 微信支付参数清单（商户号、证书序列号、APIv3 Key、平台证书）
- [ ] 证书使用与轮换说明（证书更新窗口、回滚策略、责任人）

## 2. 甲方需提供字段（必须）

### 2.1 微信登录

- [x] `WX_MP_APPID=wxa053408fad6ab1df`
- [ ] `WX_MP_SECRET`

### 2.2 微信支付

- [ ] `WX_PAY_MCHID`
- [ ] `WX_PAY_MCH_CERT_SERIAL_NO`
- [ ] `WX_PAY_API_V3_KEY`
- [ ] `WX_PAY_MCH_PRIVATE_KEY`
- [ ] `WX_PAY_PLATFORM_CERT_SERIAL_NO`
- [ ] `WX_PAY_PLATFORM_CERT` 或 `WX_PAY_PLATFORM_CERTS`（二选一）
- [x] `WX_PAY_NOTIFY_URL=https://api.笋嘢.com/webhooks/wechatpay/notify`

### 2.3 生产域名与安全

- [ ] `CORS_ORIGINS` 最终名单（前台域名、后台域名）
- [ ] `BASE_URL=https://api.笋嘢.com`
- [ ] `PUBLIC_HOST_WHITELIST`（公网域名）
- [ ] `JWT_SECRET`（强密钥）
- [ ] `FILE_TEMP_TOKEN_SECRET`（强密钥）
- [ ] `TRUST_PROXY=true`（有网关/反向代理时）

### 2.4 短信登录（阿里云）

- [ ] `SMS_PROVIDER=ALIYUN`
- [ ] `SMS_SIGN_NAME`
- [ ] `SMS_TEMPLATE_ID`（推荐，兼容 `SMS_TEMPLATE_ID_LOGIN`）
- [ ] `SMS_ACCESS_KEY`（推荐，需配对 `SMS_SECRET_KEY`）
- [ ] `SMS_SECRET_KEY`
- [ ] （兼容）`SMS_ACCESS_KEY_ID` / `SMS_ACCESS_KEY_SECRET`
- [ ] （可选）`SMS_TEMPLATE_ID_BIND_PHONE`

## 3. 项目内已固定配置（当前仓库）

- 小程序 AppID：`wxa053408fad6ab1df`
- 小程序生产 API 基址：`https://api.笋嘢.com`
- 管理后台生产 API 基址：`https://api.笋嘢.com`
- 微信支付回调路径：`/webhooks/wechatpay/notify`

## 4. 甲方部署步骤（执行方：甲方，我方配合）

- [ ] 注入生产环境变量（不写入代码仓）
- [ ] 执行数据库迁移：`pnpm -C apps/api db:deploy`
- [ ] 启动后端并完成反向代理/TLS
- [ ] 微信商户平台配置回调地址
- [ ] 小程序后台确认域名白名单（request/socket/upload/download）
- [ ] 如使用 web-view，补齐业务域名白名单
- [ ] 执行生产门禁：`STAGE=prod node scripts/run-with-env.mjs -- node scripts/check-prod-env.mjs`

## 5. 联调验收（甲方环境）

### 5.1 登录链路

- [ ] 小程序 `wx.login` 可成功换取平台 token
- [ ] 同一微信号重复登录映射同一平台用户
- [ ] 手机号绑定成功并写入用户档案

### 5.2 支付链路

- [ ] 创建订金支付意图并拉起支付
- [ ] 支付完成后回调命中并验签通过
- [ ] 订单状态正确推进到订金已付
- [ ] 尾款支付同样完整通过

### 5.3 回调与幂等

- [ ] 重复回调不重复入账
- [ ] 非法签名回调被拒绝
- [ ] 金额不一致回调被拒绝

## 6. 上线闸门（Go/No-Go）

- [ ] 第 2 节字段全部到位
- [ ] 第 5 节联调用例全部通过并留痕
- [ ] 证书/密钥轮换方案已确认
- [ ] 回滚方案与数据库备份方案已确认
