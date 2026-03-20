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
| 首页推荐 + 快捷入口 + 特色专区 | 游客可看；收藏/咨询/下单需登录且审核通过；快捷入口 3×2（外观专利/发明专利/实用专利/发明人榜/技术经理/五星专利）；Banner 当前为单张静态图（无切换圆点）；特色专区为 2×2 海报卡（本地图片背景，无 NEW 角标） | `apps/client/src/pages/home/index.tsx` | `searchListings` `GET /search/listings`；`upsertListingConversation` `POST /listings/{listingId}/conversations` | `GET /search/listings`；`POST /listings/:listingId/conversations` | P0 已实现 |
| 微信登录 + 手机号授权弹窗 + 身份选择 | 微信登录成功后：若手机号为空，弹窗提示“授权手机号”（可跳过）；随后进入身份选择页（个人/机构等）。 | `apps/client/src/subpackages/login/index.tsx`<br/>`apps/client/src/pages/me/index.tsx` | `authWechatMpLogin` `POST /auth/wechat/mp-login`；`authWechatPhoneBind` `POST /auth/wechat/phone-bind`；`submitMyVerification` `POST /me/verification` | `POST /auth/wechat/mp-login`；`POST /auth/wechat/phone-bind`；`POST /me/verification` | P0 已实现 |
| 检索（筛选/排序） | 进入搜索主链路：专利交易；搜索条下新增排序 Chip 行（综合推荐/价格升序/价格降序/最新发布）；游客可看；关键动作需登录且审核通过 | `apps/client/src/subpackages/search/index.tsx` | `searchListings` `GET /search/listings` | `GET /search/listings` | P0 已实现 |
| 检索（更多筛选对齐） | Search 主链路更多筛选（专利：类型/交易方式/价格/订金/地区/IPC/LOC/行业标签/转让次数/法律状态等）统一 `FilterSheet`；参数见 `docs/engineering/ui-guidelines.md` | `apps/client/src/subpackages/search/index.tsx` | 同上（仅增加 query 参数） | 同上（补齐更多筛选场景 fixtures） | P0 已实现 |
| 详情页（公开可见） | 展示挂牌信息 + 专利详情模块（摘要/附图/专利信息/权利人/说明书统计）；**交易补充字段（可交付清单/预计周期/可谈空间/质押与许可现状）**；咨询/支付订金（需审核通过） | `apps/client/src/pages/listing/detail/index.tsx` | `getPublicListingById` `GET /public/listings/{listingId}`；`upsertListingConversation` `POST /listings/{listingId}/conversations`；`getPatentById` `GET /patents/{patentId}` | `GET /public/listings/:listingId`；`GET /patents/:patentId`；`POST /listings/:listingId/conversations` | P0 已实现 |
| 专利主数据详情页（公开可见） | 展示专利号段/案件状态/主分类号/说明书统计；展示封面图 + 说明书附图；如有关联上架，展示价格与供给方类型；概览/摘要/信息/评论合并为单页展示；挂牌详情不再提供“点击查看专利详情”跳转 | `apps/client/src/pages/patent/detail/index.tsx` | `getPatentById` `GET /patents/{patentId}` | `GET /patents/:patentId` | P0 已实现 |
| 留言区（公开） | 专利详情页底部：公开留言列表 + 互动回复；留言/回复/编辑/删除需登录且审核通过（编辑/删除仅本人）；短按评论默认回复并滚动至输入栏，长按弹出“回复/编辑/删除”；未聚焦显示头像 + 占位文本“写下你的留言，共同讨论”，聚焦后在键盘上方显示输入栏 + 发布按钮（无内容灰色不可点，有内容点亮） | `apps/client/src/pages/listing/detail/index.tsx` | `listPublicListingComments` `GET /public/listings/{listingId}/comments`；`createListingComment` `POST /listings/{listingId}/comments`；`updateComment` `PATCH /comments/{commentId}`；`deleteComment` `DELETE /comments/{commentId}` | fixtures 已覆盖（happy/empty/error/edge） | P0 已实现 |
| 发明人榜（排名） | 口径：按平台内上传专利统计（去重） | `apps/client/src/pages/inventors/index.tsx` | `searchInventorRankings` `GET /search/inventors` | `GET /search/inventors` | P0 已实现 |
| 技术经理人栏目（排名/检索） | 展示审核通过技术经理人；支持检索与咨询入口 | `apps/client/src/pages/tech-managers/index.tsx` | `searchTechManagers` `GET /search/tech-managers` | `GET /search/tech-managers` | P0 已实现 |
| 技术经理人详情 | 展示简介/资质/服务范围；提供在线咨询 | `apps/client/src/pages/tech-managers/detail/index.tsx` | `getPublicTechManagerById` `GET /public/tech-managers/{techManagerId}`；`upsertTechManagerConversation` `POST /tech-managers/{techManagerId}/conversations` | `GET /public/tech-managers/:techManagerId`；`POST /tech-managers/:techManagerId/conversations` | P0 已实现 |
| 机构展示（仅审核通过） | 企业/院校等审核通过后展示 | `apps/client/src/pages/organizations/index.tsx` | `listPublicOrganizations` `GET /public/organizations` | `GET /public/organizations` | P0 已实现（列表） |
| 机构详情 | 机构详情页（可点可看） | `apps/client/src/pages/organizations/detail/index.tsx` | `getPublicOrganizationById` `GET /public/organizations/{orgUserId}` | `GET /public/organizations/:orgUserId` | P0 已实现 |
| 登录 | 微信/短信登录 | `apps/client/src/subpackages/login/index.tsx` | `authWechatMpLogin` `POST /auth/wechat/mp-login`；`authSmsSend` `POST /auth/sms/send`；`authSmsVerify` `POST /auth/sms/verify` | `POST /auth/wechat/mp-login`；`POST /auth/sms/send`；`POST /auth/sms/verify` | P0 已实现 |
| 首次进入：选择身份 | 个人秒通过；其余提交资料待审核 | `apps/client/src/pages/onboarding/choose-identity/index.tsx` | `submitMyVerification` `POST /me/verification` | `POST /me/verification` | P0 已实现 |
| 认证资料提交 | 上传证明材料；进入审核中 | `apps/client/src/pages/onboarding/verification-form/index.tsx` | `uploadFile` `POST /files`；`submitMyVerification` `POST /me/verification` | `POST /files`；`POST /me/verification` | P0 已实现 |
| 消息列表 | 会话列表/未读数（会话创建需审核通过） | `apps/client/src/pages/messages/index.tsx` | `listMyConversations` `GET /me/conversations` | `GET /me/conversations` | P0 已实现 |
| 会话聊天（工单式消息） | P0 非实时；支持刷新与留痕 | `apps/client/src/pages/messages/chat/index.tsx` | `listConversationMessages` `GET /conversations/{conversationId}/messages`；`sendConversationMessage` `POST /conversations/{conversationId}/messages`；`markConversationRead` `POST /conversations/{conversationId}/read` | 对应 3 个 fixtures | P0 已实现 |
| 支付订金（演示） | 小程序：下单→订金支付意图→结果页（待确认，专利）；H5：仅引导回小程序（需审核通过） | `apps/client/src/pages/checkout/deposit-pay/index.tsx` | `createOrder` `POST /orders`；`createPaymentIntent` `POST /orders/{orderId}/payment-intents` | `POST /orders`；`POST /orders/:orderId/payment-intents` | P0 已实现（演示跳转） |
| 订金结果页（待确认） | 展示订单信息/下一步 | `apps/client/src/pages/checkout/deposit-success/index.tsx` | `getOrderById` `GET /orders/{orderId}` | `GET /orders/:orderId` | P0 已实现 |
| 支付尾款（演示） | 小程序：尾款支付意图→结果页（待确认）；H5：仅引导回小程序（需审核通过） | `apps/client/src/pages/checkout/final-pay/index.tsx` | `createPaymentIntent` `POST /orders/{orderId}/payment-intents` | `POST /orders/:orderId/payment-intents` | P0 已实现（演示跳转） |
| 尾款结果页（待确认） | 展示订单信息/下一步 | `apps/client/src/pages/checkout/final-success/index.tsx` | `getOrderById` `GET /orders/{orderId}` | `GET /orders/:orderId` | P0 已实现 |
| 订单详情（下一步入口） | 状态驱动：WAIT_FINAL_PAYMENT → 支付尾款（跳转尾款支付页） | `apps/client/src/pages/orders/detail/index.tsx` | - | - | P0 已实现 |
| 发布入口（卖家侧） | 发布前需登录+身份选择；非个人需审核（专利） | `apps/client/src/pages/publish/index.tsx` | `getMyVerification` `GET /me/verification`（前置校验） | `GET /me/verification` | P0 已实现 |
| 发布专利交易（表单） | 权属/价格/地域/标签；**可交付清单/预计周期/可谈空间/质押与许可现状声明**；草稿/提交审核 | `apps/client/src/pages/publish/patent/index.tsx` | `normalizePatentNumber` `POST /patents/normalize`；`uploadFile` `POST /files`；`createListing` `POST /listings`；`updateListing` `PATCH /listings/{listingId}`；`submitListing` `POST /listings/{listingId}/submit` | 对应 fixtures 已覆盖 | P0 已实现 |
| 我的专利上架 | 发布方查看/编辑/下架 | `apps/client/src/pages/my-listings/index.tsx` | `listMyListings` `GET /listings`；`offShelfListing` `POST /listings/{listingId}/off-shelf` | `GET /listings`；`POST /listings/:listingId/off-shelf` | P0 已实现 |
| 收藏 | 收藏/取消收藏/收藏列表（专利） | `apps/client/src/pages/favorites/index.tsx` | `favoriteListing` `POST /listings/{listingId}/favorites`；`unfavoriteListing` `DELETE /listings/{listingId}/favorites`；`listMyFavoriteListings` `GET /me/favorites` | `POST /listings/:listingId/favorites`；`DELETE /listings/:listingId/favorites`；`GET /me/favorites` | P0 已实现 |
| 退款（买家侧） | 退款申请/进度查询（入口：订单详情） | `apps/client/src/pages/orders/detail/index.tsx` | `createRefundRequest` `POST /orders/{orderId}/refund-requests`；`listRefundRequestsByOrder` `GET /orders/{orderId}/refund-requests` | `POST /orders/:orderId/refund-requests`；`GET /orders/:orderId/refund-requests` | P0 已实现 |

## 2. 管理后台（PC Web，`apps/admin-web`）

| 页面/能力 | 需求/说明（PRD） | 前端入口 | OpenAPI（operationId / method path） | Mock 覆盖 | 状态 |
|---|---|---|---|---|---|
| 登录（演示） | P0 demo token | `apps/admin-web/src/views/LoginPage.tsx` |（未接真实登录） |（无） | P0 占位 |
| 仪表盘 | 待审认证/待审上架/订单概览 | `apps/admin-web/src/views/DashboardPage.tsx` | `adminListUserVerifications`；`adminListListingsForAudit`；`listMyOrders` | fixtures 已覆盖 | P0 已实现 |
| 认证审核 | 审核通过/驳回 | `apps/admin-web/src/views/VerificationsPage.tsx` | `adminListUserVerifications`；`adminApproveUserVerification`；`adminRejectUserVerification` | fixtures 已覆盖 | P0 已实现 |
| 技术经理人栏目管理 | 展示开关/推荐配置/服务标签维护 | `apps/admin-web/src/views/TechManagersPage.tsx` | `adminListTechManagers` `GET /admin/tech-managers`；`adminUpdateTechManager` `PATCH /admin/tech-managers/{techManagerId}` | fixtures 已覆盖 | P0 已实现 |
| 上架审核 | 审核通过/驳回/省市特色置顶 | `apps/admin-web/src/views/ListingsAuditPage.tsx` | `adminListListingsForAudit`；`adminApproveListing`；`adminRejectListing`；`adminSetListingFeatured` | fixtures 已覆盖 | P0 已实现 |
| 留言管理 | 留言列表 + 搜索/筛选 + 隐藏/恢复/删除 | `apps/admin-web/src/views/CommentsPage.tsx` | `adminListComments`；`adminUpdateComment` | `GET /admin/comments`；`PATCH /admin/comments/:commentId`（fixtures 已覆盖） | P0 已实现 |
| 订单管理 | 里程碑：合同确认/变更完成 | `apps/admin-web/src/views/OrdersPage.tsx` | `listMyOrders`；`adminConfirmContractSigned`；`adminConfirmTransferCompleted` | fixtures 已覆盖 | P0 已实现 |
| 支付确认（手工） | 订金/尾款支付待确认 → 已入账（演示） | `apps/admin-web/src/views/OrderDetailPage.tsx` | `adminManualConfirmPayment` `POST /admin/orders/{orderId}/payments/manual` | fixtures 已覆盖 | P0 已实现 |
| 退款审批 | 通过/驳回；失败提示 | `apps/admin-web/src/views/RefundsPage.tsx` | `listRefundRequestsByOrder`；`adminApproveRefundRequest`；`adminRejectRefundRequest` | fixtures 已覆盖 | P0 已实现 |
| 退款完成（手工） | 退款通过后手工完成（演示） | `apps/admin-web/src/views/RefundsPage.tsx` | `adminCompleteRefundRequest` `POST /admin/refund-requests/{refundRequestId}/complete` | fixtures 已覆盖 | P0 已实现 |
| 结算/放款 | 上传凭证→确认放款 | `apps/admin-web/src/views/SettlementsPage.tsx` | `adminGetOrderSettlement`；`adminConfirmManualPayout`；`uploadFile` | fixtures 已覆盖 | P0 已实现 |
| 发票上传/删除 | 线下开票后上传附件；订单内下载 | `apps/admin-web/src/views/InvoicesPage.tsx` | `getOrderInvoice`；`adminUpsertOrderInvoice`；`adminDeleteOrderInvoice`；`uploadFile` | fixtures 已覆盖 | P0 已实现 |
| 交易规则/推荐配置 | 订金/佣金/退款窗口；推荐权重系数 | `apps/admin-web/src/views/ConfigPage.tsx` | `adminGetTradeRulesConfig`；`adminUpdateTradeRulesConfig`；`adminGetRecommendationConfig`；`adminUpdateRecommendationConfig` | fixtures 已覆盖 | P0 已实现 |
| 地区/产业标签 | 区域中心点/产业标签用于地域推荐与运营配置 | `apps/admin-web/src/views/RegionsPage.tsx` | `adminListRegions`；`adminCreateRegion`；`adminUpdateRegion`；`adminListIndustryTags`；`adminCreateIndustryTag`；`adminSetRegionIndustryTags` | fixtures 已覆盖 | P0 已实现 |

## 3. 当前“缺口清单”（建议按演示/验收优先级排）

- P0 前端骨架已收口：收藏、机构详情、登录、买家订单/退款入口、交易规则前台展示等均已对齐 OpenAPI，并补齐 happy fixtures；技术经理人栏目已进入 P0 已实现。
- 仍属后端联调项：微信支付/退款回调验签与幂等（`POST /webhooks/wechatpay/notify`，前端不调用）。

### 3.1 OpenAPI 已有但前端暂未消费（需确认 P0/P1）


### 3.2 P1 预留能力（AI/托管/告警/平台内容）

| 页面/能力 | 需求/说明（PRD） | 前端入口 | OpenAPI（operationId / method path） | Mock 覆盖 | 状态 |
|---|---|---|---|---|---|
| 智能体语义检索（文本入口） | 自然语言 → 结构化检索条件；语音入口仍为 P1 | `apps/client/src/pages/home/index.tsx`<br/>`apps/client/src/pages/search/index.tsx` | `createAiAgentQuery` `POST /ai/agent/query` | `POST /ai/agent/query` | P1（已落地基础版） |
| AI 解析卡片 + 评分 | 专利详情展示 AI 解析并评分纠错 | `apps/client/src/pages/listing/detail/index.tsx` | `createAiParseFeedback` `POST /ai/parse-results/{parseResultId}/feedback` | `POST /ai/parse-results/:parseResultId/feedback` | P1（已落地基础版） |
| 平台自有内容 CMS | 后台创建/编辑/发布/下架挂牌（专利） | `apps/admin-web/src/views/ListingsAuditPage.tsx` | `adminCreateListing`/`adminUpdateListing`/`adminPublishListing`/`adminOffShelfListing` | fixtures 已覆盖（happy） | P1（已落地基础版） |
| AI 解析复核池 | 低评分/低置信度进入后台复核池 | `apps/admin-web/src/views/AiParseResultsPage.tsx` | `adminListAiParseResults` `GET /admin/ai/parse-results` | - | P1（已落地基础版） |
| 专利托管任务 | 年费日程 + 托管任务指派 | `apps/admin-web/src/views/MaintenancePage.tsx` | `adminListPatentMaintenanceSchedules` `GET /admin/patent-maintenance/schedules`；`adminListPatentMaintenanceTasks` `GET /admin/patent-maintenance/tasks` | - | P1（已落地基础版） |
| 告警中心 | 短信/邮件/站内告警，支持确认 | `apps/admin-web/src/views/AlertsPage.tsx` | `adminListAlertEvents` `GET /admin/alerts`；`adminAcknowledgeAlertEvent` `POST /admin/alerts/{alertId}/ack` | - | P1（已落地基础版） |
| 大数据分析中心 | 交易库/专利库指标看板与导出 | `apps/admin-web/src/views/PlaceholderPage.tsx`（待补） | - | - | P1 |
