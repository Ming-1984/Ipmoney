# 小程序登录链路（生产版）

## 目标

- 小程序登录使用微信官方 `wx.login` + 服务端 `code2Session`。
- 服务端用 `openid` 建立/定位用户，签发平台 `accessToken`。
- 登录后可执行手机号绑定：`open-type="getPhoneNumber"` -> 服务端换取真实手机号并绑定。
- 与支付链路打通：订单支付时从当前买家读取 `wechat_openid` 发起 JSAPI 支付。

## 当前实现

### 1. 登录

- 客户端（小程序）：
  - `Taro.login()` 获取 `code`
  - `POST /auth/wechat/mp-login { code }`
- 服务端：
  - 调微信 `GET /sns/jscode2session`
  - 读取 `openid`
  - `User.wechat_openid` upsert
  - 签发平台 access token（`atk1.*`）

实现位置：

- `apps/client/src/subpackages/login/index.tsx`
- `apps/client/src/pages/me/index.tsx`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/common/wechat-mp.client.ts`

### 2. 手机号绑定

- 客户端按钮：`open-type="getPhoneNumber"`。
- 服务端：
  - 获取小程序 `access_token`
  - 调微信 `POST /wxa/business/getuserphonenumber`
  - 规范化手机号并写入 `User.phone`
  - 若手机号已被其他账号绑定，返回 `409 CONFLICT`

实现位置：

- `apps/client/src/ui/WechatPhoneBindPopup.tsx`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/common/wechat-mp.client.ts`

### 3. Demo 入口（仅非生产）

- `code = "demo"` 仍保留，仅用于本地/演示环境工具链。
- 生产环境应禁用 Demo Auth，并使用真实微信配置。

## 环境变量

必填：

- `WX_MP_APPID`
- `WX_MP_SECRET`
- `ACCESS_TOKEN_SECRET`（或 `JWT_SECRET`）

当前项目默认示例：

- `.env.example` 中 `WX_MP_APPID=wxa053408fad6ab1df`
- `apps/project.config.json` 中 `appid` 已设置为 `wxa053408fad6ab1df`

## 生产联调检查

1. 小程序调用 `wx.login` 拿到 `code`，`/auth/wechat/mp-login` 返回 200 且 `user.id` 稳定复用。
2. 同一微信号重复登录，返回同一平台用户。
3. 首次未绑定手机号时，弹窗可触发 `/auth/wechat/phone-bind` 成功写入手机号。
4. 已被他人占用手机号返回 409，前端提示用户改用其他方式处理。
5. 登录后创建订单并发起支付意图，服务端不再报 `buyer wechat openid is required`。

## 常见失败码

- `NOT_IMPLEMENTED`: 未配置微信小程序环境变量。
- `WECHAT_MP_CODE2SESSION_FAILED`: 微信 `code` 无效或过期。
- `WECHAT_MP_PHONE_NUMBER_FAILED`: 微信手机号授权 `phoneCode` 无效或过期。
- `CONFLICT`: 手机号已绑定到其他账号。
