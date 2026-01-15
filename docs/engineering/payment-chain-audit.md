# 支付链路审计（现状 vs 正确接入）

## 1. 范围

- 订金支付（小程序 / H5）
- 尾款支付（小程序 / H5）
- 微信支付 v3 回调（`POST /webhooks/wechatpay/notify`）
- 订单状态推进（`DEPOSIT_PENDING → DEPOSIT_PAID → WAIT_FINAL_PAYMENT → FINAL_PAID_ESCROW → ...`）

## 2. 现状（代码实际行为）

### 2.1 用户端（`apps/client`）

- 小程序订金页：`POST /orders` → `POST /orders/{orderId}/payment-intents` → 跳转成功页；目前**未调用** `Taro.requestPayment` 拉起微信收银台。
  - `apps/client/src/pages/checkout/deposit-pay/index.tsx`
- 小程序尾款页：`POST /orders/{orderId}/payment-intents` → 跳转成功页；目前**未调用** `Taro.requestPayment`。
  - `apps/client/src/pages/checkout/final-pay/index.tsx`
- H5：订金/尾款页已禁用发起支付，统一展示“去小程序支付”引导：
  - 微信内：`wx-open-launch-weapp`（openTag）
  - 微信外/桌面：二维码 + 复制链接
  - `apps/client/src/pages/checkout/components/MiniProgramPayGuide.tsx`
- 订单详情：已补充状态驱动入口：`WAIT_FINAL_PAYMENT` 显示“支付尾款”（跳转到尾款支付页）。
  - `apps/client/src/pages/orders/detail/index.tsx`

### 2.2 Mock API（`apps/mock-api`）

- `POST /orders/:orderId/payment-intents` 仅用于演示：根据 `payType` **直接覆盖订单状态**：
  - `DEPOSIT` → `DEPOSIT_PAID`
  - `FINAL` → `FINAL_PAID_ESCROW`
  - `apps/mock-api/src/server.js`
- `GET /orders/:orderId` 若命中覆盖，会返回被覆盖后的 `status`（用于成功页/详情页展示）。
- 目前**不会**同步覆盖 `GET /orders` 列表中的订单状态（列表可能仍显示旧状态）。

### 2.3 OpenAPI / 真后端（`apps/api`）

- OpenAPI 已定义微信支付回调入口：`POST /webhooks/wechatpay/notify`（要求 `Wechatpay-*` 头 + 验签解密 + 幂等）。
  - `docs/api/openapi.yaml`
- 但目前 `apps/api` 中尚无 `orders/payments/webhooks` 等实现模块；回调与真实支付链路仍属后端待落地项。

**结论**：当前“支付”属于 **Mock 演示链路**，并非“正确接入微信支付”的完整闭环。

## 3. 正确接入（微信支付 v3 JSAPI）的最小闭环（P0 建议）

### 3.1 后端

- `createPaymentIntent`：校验订单状态/金额 → 调用微信支付 v3 JSAPI 预下单 → 落库 payment → 返回 `wechatPayParams`。
- `wechatPayNotify`：验签 + 解密 `resource` → 幂等（防重放）→ 推进订单状态（订金/尾款/退款）→ 返回 `204`。
- 幂等/对账：至少需要 `Idempotency-Key` 落库、支付回调去重键、退款回调去重键（对齐 `docs/architecture/*` 时序图）。

### 3.2 小程序前端

- 拿到 `wechatPayParams` 后调用 `Taro.requestPayment`。
- 支付成功后建议：刷新订单状态（或显示“支付处理中”直到回调推进），避免“跳成功但未支付”。

### 3.3 H5

- 继续保持不在 H5 发起支付；仅做“回小程序支付”的引导。
- 若要微信内一键跳转小程序生效：需要补 JS-SDK `openTagList` 配置 + 安全域名白名单 + 小程序原始 ID（`wx-open-launch-weapp` 相关前置）。

## 4. 待你确认的决策点（用于下一步排期/开工）

- 现在继续保持“演示支付”，还是进入“真实微信支付 v3 接入”（后端 + 小程序收银台 + 回调）？
- 若接真实：是否接受“统一回调入口（支付+退款）”的方案（对应 OpenAPI 的 `/webhooks/wechatpay/notify`）？

## 5. 本轮已完成（按你确认的两项改造）

- H5 支付策略：H5 不发起支付，微信内 `wx-open-launch-weapp`；微信外/桌面二维码 + 复制链接。
  - `apps/client/src/pages/checkout/deposit-pay/index.tsx`
  - `apps/client/src/pages/checkout/final-pay/index.tsx`
  - `apps/client/src/pages/checkout/components/MiniProgramPayGuide.tsx`
- 订单详情：补 `WAIT_FINAL_PAYMENT` → “支付尾款”入口。
  - `apps/client/src/pages/orders/detail/index.tsx`