# 支付链路审计（生产链路）

## 范围

- 订金支付：`POST /orders` -> `POST /orders/{orderId}/payment-intents` -> `requestPayment`
- 尾款支付：`POST /orders/{orderId}/payment-intents` -> `requestPayment`
- 微信回调：`POST /webhooks/wechatpay/notify`
- 支付与退款状态推进、回调幂等、通知落库

## 当前实现状态

### 小程序前端

- 支付意图创建成功后，调用 `Taro.requestPayment` 拉起微信收银台。
- 用户取消支付时不再误跳“支付成功”页。
- H5 端继续不发起支付，仅展示“去小程序支付”引导。

实现位置：

- `apps/client/src/subpackages/checkout/deposit-pay/index.tsx`
- `apps/client/src/subpackages/checkout/final-pay/index.tsx`

### API 服务

- `createPaymentIntent`：
  - 校验订单状态与金额
  - 读取买家 `wechat_openid`
  - 调微信支付 JSAPI 预下单并返回 `wechatPayParams`
- `wechatpay/notify`：
  - 使用 `rawBody` + `Wechatpay-*` 头验签
  - 解密 `resource`
  - 幂等去重（事件键）
  - 更新 payment / order / refund 状态并记录 webhook 事件

实现位置：

- `apps/api/src/modules/orders/orders.service.ts`
- `apps/api/src/common/wechat-pay.client.ts`
- `apps/api/src/modules/webhooks/webhooks.controller.ts`
- `apps/api/src/modules/webhooks/webhooks.service.ts`
- `apps/api/src/main.ts`（`rawBody: true`）

## 生产配置要求

支付必填：

- `WX_MP_APPID`
- `WX_PAY_MCHID`
- `WX_PAY_MCH_CERT_SERIAL_NO`
- `WX_PAY_API_V3_KEY`
- `WX_PAY_MCH_PRIVATE_KEY`
- `WX_PAY_NOTIFY_URL`

回调验签建议同时配置：

- `WX_PAY_PLATFORM_CERT_SERIAL_NO`
- `WX_PAY_PLATFORM_CERT` 或 `WX_PAY_PLATFORM_CERTS`

## 联调检查清单

1. 小程序下单后能正常拉起微信收银台。
2. 支付完成后微信回调能命中 `/webhooks/wechatpay/notify` 并验签通过。
3. 回调重复投递时不会重复推进订单状态（幂等生效）。
4. 订金与尾款状态分别正确推进：
   - `DEPOSIT_PENDING -> DEPOSIT_PAID`
   - `WAIT_FINAL_PAYMENT -> FINAL_PAID_ESCROW`
5. 退款回调可更新 `refundRequest/payment/order` 相关状态。

## 残余风险（需生产联调确认）

- 微信平台证书轮换策略需要在生产运维中定期核验（或启用自动拉取并落盘管理）。
- 若历史账号不是微信登录创建，可能缺少 `wechat_openid`，支付会被拒绝，需要先完成微信登录绑定。
