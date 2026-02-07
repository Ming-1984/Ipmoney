# 小程序登录与用户资料（头像/昵称）落地方案

相关：
- Checklist：`docs/TODO.md` → 7.3 登录鉴权与用户
- 预览/排错：`docs/demo/runbook.md` → 1.1 小程序预览（微信开发者工具）

## 目标（仅小程序端，最快实现）

- 在微信小程序环境完成登录，并能在“我的”页顶部稳定展示头像 + 昵称（缺省有兜底）。
- 头像/昵称支持用户主动授权/填写后写入服务端（`/files` + `PATCH /me`），再次进入可回显。
- 登录链路与微信官方能力对齐（`wx.login` + “用户点击触发的资料补全”）。
- 微信登录成功后，先弹窗提示“授权手机号”（`getPhoneNumber`，可跳过），再进入身份选择（个人/机构等）。

## 微信侧能力与限制（官方口径）

- 登录：`wx.login` 获取 `code`，交给服务端换取登录态（`code2Session`）。
- 手机号：按钮 `open-type="getPhoneNumber"`（用户点击触发，得到动态 `code`，供服务端换取手机号并绑定）。
- 头像：推荐按钮 `open-type="chooseAvatar"`（用户点击触发，拿到临时头像文件路径）。
- 昵称：推荐 `<input type="nickname">`（用户输入/系统联想）。
- 备注：`wx.login` 不返回头像/昵称；头像/昵称必须走“用户主动操作”的链路。

对应官方文档（用于实现时对齐）：

- `wx.login`：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.login.html
- `<button open-type="chooseAvatar">`：https://developers.weixin.qq.com/miniprogram/dev/component/button.html
- `<input type="nickname">`：https://developers.weixin.qq.com/miniprogram/dev/component/input.html
- `code2Session`：https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-login/code2Session.html

## 现状（代码快速盘点）

- 小程序登录页：`apps/client/src/pages/login/index.tsx`
  - 已调用 `Taro.login()` 获取 `code` 并请求 `POST /auth/wechat/mp-login`。
  - 微信登录成功后：若 `user.phone` 为空，会弹出“授权手机号”弹窗；授权/跳过后进入身份选择页。
  - 目前后端为“演示用户”占位，不会调用微信 `code2Session`。
- 我的页头部：`apps/client/src/pages/me/index.tsx`
  - 当前仅展示昵称/手机号/认证标签；未展示头像；昵称来源为 `/me`。
- 后端登录：`apps/api/src/modules/auth/auth.service.ts`
  - `wechatMpLogin` 目前仅校验 `code` 非空，然后返回 `demo-token` + 演示用户。
- 后端手机号绑定：`POST /auth/wechat/phone-bind`
  - P0 为演示实现：暂不接微信 `phonenumber.getPhoneNumber`，仅模拟写入手机号（避免 unique 冲突）。
- 后端资料更新：`apps/api/src/modules/users/users.service.ts`
  - `PATCH /me` 支持更新 `nickname/avatarUrl/regionCode` 并可回显。
- 数据库：`apps/api/prisma/schema.prisma`
  - `User` 已包含 `avatarUrl/wechatOpenid/phone` 等字段（手机号允许为空）。

## 推荐实现（P0：小程序优先，先跑通演示）

### A. 登录（先跑通，不强依赖外接）

1. 小程序端：`wx.login` → 得到 `code`
2. 请求：`POST /auth/wechat/mp-login { code }`
3. 服务端返回：`AuthTokenResponse`（`accessToken` + `user`）

P0 允许两种模式共存（便于最快落地与后续升级）：

- Demo 模式（默认）：未配置 `WX_MP_APPID/WX_MP_SECRET` 时，继续返回 demo 用户（仅本地/演示）。
- Real 模式（可切换）：配置 `WX_MP_APPID/WX_MP_SECRET` 后，服务端走 `code2Session` → openid 映射用户。

### A2. 登录后手机号授权绑定（P0：弹窗，可跳过）

目标：把“绑定手机号”放在身份选择之前做一次轻提示，提升咨询/交易触达率；允许用户跳过。

1. 微信登录成功后，若 `user.phone` 为空：
   - 弹窗展示“授权手机号”（按钮 `open-type="getPhoneNumber"`）+ “暂不授权”。
2. 用户授权成功：
   - 小程序拿到 `phoneCode` → 调用 `POST /auth/wechat/phone-bind { phoneCode }` 绑定手机号。
3. 授权失败/拒绝/点击暂不授权：
   - 直接进入身份选择页；后续可在资料设置继续绑定。

### B. 头像/昵称资料补全（微信合规、最快）

1. 用户在登录后/资料设置页点击：
   - 头像：`<button open-type="chooseAvatar">` 获取临时路径 `avatarUrlTemp`
   - 昵称：`<input type="nickname">` 获取 `nickname`
2. 上传头像到服务端：
   - 小程序用 `Taro.uploadFile` 上传到 `POST /files`（`purpose=AVATAR`）
   - 得到 `FileObject.url`
3. 写入资料：
   - `PATCH /me { avatarUrl, nickname }`
4. “我的”页重新拉取 `GET /me`，顶部展示更新后的头像/昵称

## 页面 UI（“我的”顶部区域，使用成熟组件）

优先用 NutUI（Taro 版）现成组件收口（减少自绘样式/兼容问题）：

- `Avatar`：展示头像（无头像时展示首字母/默认图）
- `Cell`/`CellGroup`：承载“昵称/手机号/认证状态”信息区块
- `Tag`：认证类型/状态

目标效果：更接近微信“个人中心”顶部卡片布局，信息层级清晰、点击区域一致。

## 需要后端/DB配合的最小改动（P0 必需）

- `User` 增加字段：
  - `avatarUrl`（string, nullable）
  - （可选，P1）`wechatOpenid`（string, unique, nullable）
- `PATCH /me` 支持真正写入 `avatarUrl`
- `GET /me` 返回 `avatarUrl`

## 需要你确认的关键点（确认后再开始改代码）

1. 真实微信登录要不要现在接入？
   - 现在接入：需要你提供 `WX_MP_APPID/WX_MP_SECRET`，并在微信开发者工具里使用对应 AppID 预览。
   - 暂不接入：先保持 demo 登录，但把“头像/昵称资料链路 + 顶部 UI”做完整。
2. 手机号策略（影响 DB 结构）
   - 维持当前 `User.phone` 必填：则“真实微信登录”必须配合 `getPhoneNumber`（会多一个后端换号流程）。
   - 调整为 `phone` 可空：先用 openid 建用户，后续再补手机号（更符合微信登录常见模型）。
