# 需求 → OpenAPI → 前端实现 → Mock 覆盖矩阵（P0）

> 目的：把 `Ipmoney.md`（需求/页面）与 `docs/api/openapi.yaml`（接口契约）以及前端实现（`apps/client`、`apps/admin-web`）和 Mock fixtures（`packages/fixtures/scenarios/*/index.json`）对齐，快速发现遗漏与不一致。

补充（接口层自动化审计）：
- 覆盖报告：`docs/engineering/openapi-coverage.md`（由 `scripts/audit-coverage.mjs` 生成）
- 用途：快速核对“OpenAPI operation ↔ 前端是否调用 ↔ fixtures 是否覆盖”

## 0. 口径与标记

- **P0 已实现**：前端页面/交互/状态机可跑通（Mock 驱动），字段以 OpenAPI 为准。
- **P0 占位**：页面存在但仅提示/Toast/占位文案；后续补齐交互与接口对接。
- **P1**：明确后续再做（不阻塞 P0 演示与开发开工）。

Mock fixtures key 约定：
- `method + space + path`，例如：`GET /search/listings`
- 路径参数用 `:param`（例如 `GET /public/listings/:listingId`），与 OpenAPI 的 `{param}` 对应。

## 1. 用户端（小程序/H5，`apps/client`）

| 页面/能力 | 需求/说明（PRD） | 前端入口 | OpenAPI（operationId / method path） | Mock 覆盖 | 状态 |
|---|---|---|---|---|---|
| 首页推荐 + 快捷入口 | 游客可看；收藏/咨询/下单需登录且审核通过；推荐权重可调 | `apps/client/src/pages/home/index.tsx` | `searchListings` `GET /search/listings`；`upsertListingConversation` `POST /listings/{listingId}/conversations` | `GET /search/listings`；`POST /listings/:listingId/conversations` | P0 已实现 |
| 信息流（推荐/最新/热度） | 推荐结合热度/点击/收藏咨询 | `apps/client/src/pages/feeds/index.tsx` | `getMyRecommendedListings` `GET /me/recommendations/listings`；`searchListings` `GET /search/listings` | `GET /me/recommendations/listings`；`GET /search/listings` | P0 已实现 |
| 检索（筛选/排序） | 专利号/标题/发明人检索；游客可看；收藏/咨询/下单需审核通过；P1 更多筛选 | `apps/client/src/pages/search/index.tsx` | `searchListings` `GET /search/listings` | `GET /search/listings` | P0 已实现 |
| 详情页（公开可见） | 展示专利信息；咨询/支付订金（需审核通过） | `apps/client/src/pages/listing/detail/index.tsx` | `getPublicListingById` `GET /public/listings/{listingId}`；`upsertListingConversation` `POST /listings/{listingId}/conversations` | `GET /public/listings/:listingId`；`POST /listings/:listingId/conversations` | P0 已实现 |
| 发明人榜（排名） | 口径：按平台内上传专利统计（去重） | `apps/client/src/pages/inventors/index.tsx` | `searchInventorRankings` `GET /search/inventors` | `GET /search/inventors` | P0 已实现 |
| 机构展示（仅审核通过） | 企业/院校等审核通过后展示 | `apps/client/src/pages/organizations/index.tsx` | `listPublicOrganizations` `GET /public/organizations` | `GET /public/organizations` | P0 已实现（列表） |
| 机构详情 | 机构详情页（可点可看） | `apps/client/src/pages/organizations/detail/index.tsx` | `getPublicOrganizationById` `GET /public/organizations/{orgUserId}` | `GET /public/organizations/:orgUserId` | P0 已实现 |
| 专利地图（区域数量） | P0 数据由后台维护；前台展示 | `apps/client/src/pages/patent-map/index.tsx` | `listPatentMapYears` `GET /patent-map/years`；`getPatentMapSummary` `GET /patent-map/summary` | `GET /patent-map/years`；`GET /patent-map/summary` | P0 已实现（列表） |
| 地区详情（地图 drilldown） | 省/市/区 drilldown（可点可看） | `apps/client/src/pages/patent-map/region-detail/index.tsx` | `getPatentMapRegionDetail` `GET /patent-map/regions/{regionCode}` | `GET /patent-map/regions/:regionCode` | P0 已实现 |
| 登录 | 微信/短信登录 | `apps/client/src/pages/login/index.tsx` | `authWechatMpLogin` `POST /auth/wechat/mp-login`；`authSmsSend` `POST /auth/sms/send`；`authSmsVerify` `POST /auth/sms/verify` | `POST /auth/wechat/mp-login`；`POST /auth/sms/send`；`POST /auth/sms/verify` | P0 已实现 |
| 首次进入：选择身份 | 个人秒通过；其余提交资料待审核 | `apps/client/src/pages/onboarding/choose-identity/index.tsx` | `submitMyVerification` `POST /me/verification` | `POST /me/verification` | P0 已实现 |
| 认证资料提交 | 上传证明材料；进入审核中 | `apps/client/src/pages/onboarding/verification-form/index.tsx` | `uploadFile` `POST /files`；`submitMyVerification` `POST /me/verification` | `POST /files`；`POST /me/verification` | P0 已实现 |
| 消息列表 | 会话列表/未读数（会话创建需审核通过） | `apps/client/src/pages/messages/index.tsx` | `listMyConversations` `GET /me/conversations` | `GET /me/conversations` | P0 已实现 |
| 会话聊天（工单式消息） | P0 非实时；支持刷新与留痕 | `apps/client/src/pages/messages/chat/index.tsx` | `listConversationMessages` `GET /conversations/{conversationId}/messages`；`sendConversationMessage` `POST /conversations/{conversationId}/messages`；`markConversationRead` `POST /conversations/{conversationId}/read` | 对应 3 个 fixtures | P0 已实现 |
| 支付订金（演示） | 下单→订金支付意图→成功页（需审核通过） | `apps/client/src/pages/checkout/deposit-pay/index.tsx` | `createOrder` `POST /orders`；`createPaymentIntent` `POST /orders/{orderId}/payment-intents` | `POST /orders`；`POST /orders/:orderId/payment-intents` | P0 已实现（演示跳转） |
| 订金成功页 | 展示订单信息/下一步 | `apps/client/src/pages/checkout/deposit-success/index.tsx` | `getOrderById` `GET /orders/{orderId}` | `GET /orders/:orderId` | P0 已实现 |
| 支付尾款（演示） | 尾款支付意图→成功页（需审核通过） | `apps/client/src/pages/checkout/final-pay/index.tsx` | `createPaymentIntent` `POST /orders/{orderId}/payment-intents` | `POST /orders/:orderId/payment-intents` | P0 已实现（演示跳转） |
| 尾款成功页 | 展示订单信息/下一步 | `apps/client/src/pages/checkout/final-success/index.tsx` | `getOrderById` `GET /orders/{orderId}` | `GET /orders/:orderId` | P0 已实现 |
| 发布入口（卖家侧） | 发布前需登录+身份选择；非个人需审核 | `apps/client/src/pages/publish/index.tsx` | `getMyVerification` `GET /me/verification`（前置校验） | `GET /me/verification` | P0 已实现 |
| 发布专利交易（表单） | 权属/价格/地域/标签；草稿/提交审核 | `apps/client/src/pages/publish/patent/index.tsx` | `normalizePatentNumber` `POST /patents/normalize`；`uploadFile` `POST /files`；`createListing` `POST /listings`；`updateListing` `PATCH /listings/{listingId}`；`submitListing` `POST /listings/{listingId}/submit` | 对应 fixtures 已覆盖 | P0 已实现 |
| 收藏 | 收藏/取消收藏/收藏列表 | `apps/client/src/pages/favorites/index.tsx` | `favoriteListing` `POST /listings/{listingId}/favorites`；`unfavoriteListing` `DELETE /listings/{listingId}/favorites`；`listMyFavoriteListings` `GET /me/favorites` | `POST /listings/:listingId/favorites`；`DELETE /listings/:listingId/favorites`；`GET /me/favorites` | P0 已实现 |
| 退款（买家侧） | 退款申请/进度查询（入口：订单详情） | `apps/client/src/pages/orders/detail/index.tsx` | `createRefundRequest` `POST /orders/{orderId}/refund-requests`；`listRefundRequestsByOrder` `GET /orders/{orderId}/refund-requests` | `POST /orders/:orderId/refund-requests`；`GET /orders/:orderId/refund-requests` | P0 已实现 |

## 2. 管理后台（PC Web，`apps/admin-web`）

| 页面/能力 | 需求/说明（PRD） | 前端入口 | OpenAPI（operationId / method path） | Mock 覆盖 | 状态 |
|---|---|---|---|---|---|
| 登录（演示） | P0 demo token | `apps/admin-web/src/views/LoginPage.tsx` |（未接真实登录） |（无） | P0 占位 |
| 仪表盘 | 待审认证/待审上架/订单概览 | `apps/admin-web/src/views/DashboardPage.tsx` | `adminListUserVerifications`；`adminListListingsForAudit`；`listMyOrders`；`getPatentMapSummary` | fixtures 已覆盖 | P0 已实现 |
| 认证审核 | 审核通过/驳回 | `apps/admin-web/src/views/VerificationsPage.tsx` | `adminListUserVerifications`；`adminApproveUserVerification`；`adminRejectUserVerification` | fixtures 已覆盖 | P0 已实现 |
| 上架审核 | 审核通过/驳回/省市特色置顶 | `apps/admin-web/src/views/ListingsAuditPage.tsx` | `adminListListingsForAudit`；`adminApproveListing`；`adminRejectListing`；`adminSetListingFeatured` | fixtures 已覆盖 | P0 已实现 |
| 订单管理 | 里程碑：合同确认/变更完成 | `apps/admin-web/src/views/OrdersPage.tsx` | `listMyOrders`；`adminConfirmContractSigned`；`adminConfirmTransferCompleted` | fixtures 已覆盖 | P0 已实现 |
| 退款审批 | 通过/驳回；失败提示 | `apps/admin-web/src/views/RefundsPage.tsx` | `listRefundRequestsByOrder`；`adminApproveRefundRequest`；`adminRejectRefundRequest` | fixtures 已覆盖 | P0 已实现 |
| 结算/放款 | 上传凭证→确认放款 | `apps/admin-web/src/views/SettlementsPage.tsx` | `adminGetOrderSettlement`；`adminConfirmManualPayout`；`uploadFile` | fixtures 已覆盖 | P0 已实现 |
| 发票上传/删除 | 线下开票后上传附件；订单内下载 | `apps/admin-web/src/views/InvoicesPage.tsx` | `getOrderInvoice`；`adminUpsertOrderInvoice`；`adminDeleteOrderInvoice`；`uploadFile` | fixtures 已覆盖 | P0 已实现 |
| 交易规则/推荐配置 | 订金/佣金/退款窗口；推荐权重系数 | `apps/admin-web/src/views/ConfigPage.tsx` | `adminGetTradeRulesConfig`；`adminUpdateTradeRulesConfig`；`adminGetRecommendationConfig`；`adminUpdateRecommendationConfig` | fixtures 已覆盖 | P0 已实现 |
| 专利地图 CMS | 年份/区域数据维护 | `apps/admin-web/src/views/PatentMapPage.tsx` | `listPatentMapYears`；`adminGetPatentMapEntry`；`adminUpsertPatentMapEntry`；`adminImportPatentMapExcel` | fixtures 已覆盖 | P0 已实现 |
| 地区/产业标签 | 区域中心点/产业标签用于地域推荐与运营配置 | `apps/admin-web/src/views/RegionsPage.tsx` | `adminListRegions`；`adminCreateRegion`；`adminUpdateRegion`；`adminListIndustryTags`；`adminCreateIndustryTag`；`adminSetRegionIndustryTags` | fixtures 已覆盖 | P0 已实现 |

## 3. 当前“缺口清单”（建议按演示/验收优先级排）

- P0 前端骨架已收口：收藏、机构详情、地图 drilldown、登录、买家订单/退款入口、交易规则前台展示等均已对齐 OpenAPI，并补齐 happy fixtures。
- 仍属后端联调项：微信支付/退款回调验签与幂等（`POST /webhooks/wechatpay/notify`，前端不调用）。

### 3.1 OpenAPI 已有但前端暂未消费（需确认 P0/P1）

> 见 `docs/engineering/openapi-coverage.md`：当前差异为 0（支付回调为后端内部接口，已从“未消费”差异中忽略）。
