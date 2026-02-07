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
| 首页推荐 + 快捷入口 + 公告条 + 特色专区 | 游客可看；收藏/咨询/下单需登录且审核通过；快捷入口 5 个一排（发明人榜/专利地图/书画专区/产学研需求/成果转化）；公告条默认展示最新 3 条且点击任意条进入公告列表页；Banner 当前为单张静态图（无切换圆点）；特色专区为 2×2 海报卡（本地图片背景，无 NEW 角标） | `apps/client/src/pages/home/index.tsx` | `searchListings` `GET /search/listings`；`upsertListingConversation` `POST /listings/{listingId}/conversations`；`listPublicAnnouncements` `GET /public/announcements` | `GET /search/listings`；`POST /listings/:listingId/conversations`；`GET /public/announcements` | P0 已实现 |
| 微信登录 + 手机号授权弹窗 + 身份选择 | 微信登录成功后：若手机号为空，弹窗提示“授权手机号”（可跳过）；随后进入身份选择页（个人/机构等）。 | `apps/client/src/pages/login/index.tsx`<br/>`apps/client/src/pages/me/index.tsx` | `authWechatMpLogin` `POST /auth/wechat/mp-login`；`authWechatPhoneBind` `POST /auth/wechat/phone-bind`；`submitMyVerification` `POST /me/verification` | `POST /auth/wechat/mp-login`；`POST /auth/wechat/phone-bind`；`POST /me/verification` | P0 已实现 |
| 检索（筛选/排序 + 分类切换） | 进入搜索主链路：专利交易｜产学研需求｜成果展示｜书画专区｜机构；搜索条下新增排序 Chip 行（综合推荐/价格升序/价格降序/最新发布）；游客可看；关键动作需登录且审核通过 | `apps/client/src/pages/search/index.tsx` | `searchListings` `GET /search/listings`；`searchDemands` `GET /search/demands`；`searchAchievements` `GET /search/achievements`；`searchArtworks` `GET /search/artworks`；`listPublicOrganizations` `GET /public/organizations` | `GET /search/listings`；`GET /search/demands`；`GET /search/achievements`；`GET /search/artworks`；`GET /public/organizations` | P0 已实现 |
| 检索（更多筛选对齐） | Search 主链路更多筛选（专利/需求/成果/机构/书画专区：类别/书体/题材/作者/创作年份/价格/订金/地区等）统一 `FilterSheet`；参数见 `docs/engineering/ui-v2-filter-mapping.md` | `apps/client/src/pages/search/index.tsx` | 同上（仅增加 query 参数） | 同上（补齐更多筛选场景 fixtures） | P0 已实现 |
| 详情页（公开可见） | 展示挂牌信息 + 专利详情模块（摘要/附图/专利信息/权利人/说明书统计）；咨询/支付订金（需审核通过） | `apps/client/src/pages/listing/detail/index.tsx` | `getPublicListingById` `GET /public/listings/{listingId}`；`upsertListingConversation` `POST /listings/{listingId}/conversations`；`getPatentById` `GET /patents/{patentId}` | `GET /public/listings/:listingId`；`GET /patents/:patentId`；`POST /listings/:listingId/conversations` | P0 已实现 |
| 专利主数据详情页（公开可见） | 展示专利号段/案件状态/主分类号/说明书统计；展示封面图 + 说明书附图；如有关联上架，展示价格与供给方类型；概览/摘要/信息/评论合并为单页展示；挂牌详情不再提供“点击查看专利详情”跳转 | `apps/client/src/pages/patent/detail/index.tsx` | `getPatentById` `GET /patents/{patentId}` | `GET /patents/:patentId` | P0 已实现 |
| 需求详情页（公开可见） | 展示需求详情；咨询需登录且审核通过（站内 IM） | `apps/client/src/pages/demand/detail/index.tsx` | `getPublicDemandById` `GET /public/demands/{demandId}`；`upsertDemandConversation` `POST /demands/{demandId}/conversations` | `GET /public/demands/:demandId`；`POST /demands/:demandId/conversations` | P0 已实现 |
| 成果详情页（公开可见） | 展示成果详情；咨询需登录且审核通过（站内 IM） | `apps/client/src/pages/achievement/detail/index.tsx` | `getPublicAchievementById` `GET /public/achievements/{achievementId}`；`upsertAchievementConversation` `POST /achievements/{achievementId}/conversations` | `GET /public/achievements/:achievementId`；`POST /achievements/:achievementId/conversations` | P0 已实现 |
| 书画详情页（公开可见） | 展示书画作品详情；咨询/订金需登录且审核通过 | `apps/client/src/pages/artwork/detail/index.tsx` | `getPublicArtworkById` `GET /public/artworks/{artworkId}`；`upsertArtworkConversation` `POST /artworks/{artworkId}/conversations` | `GET /public/artworks/:artworkId`；`POST /artworks/:artworkId/conversations` | P0 已实现 |
| 留言区（公开） | 专利/需求/成果/书画页面底部：公开留言列表 + 互动回复；留言/回复/编辑/删除需登录且审核通过（编辑/删除仅本人）；短按评论默认回复并滚动至输入栏，长按弹出“回复/编辑/删除”；未聚焦显示头像 + 占位文本“写下你的留言，共同讨论”，聚焦后在键盘上方显示输入栏 + 发布按钮（无内容灰色不可点，有内容点亮） | `apps/client/src/pages/listing/detail/index.tsx`<br/>`apps/client/src/pages/demand/detail/index.tsx`<br/>`apps/client/src/pages/achievement/detail/index.tsx`<br/>`apps/client/src/pages/artwork/detail/index.tsx` | `listPublicListingComments` `GET /public/listings/{listingId}/comments`；`createListingComment` `POST /listings/{listingId}/comments`；`listPublicDemandComments` `GET /public/demands/{demandId}/comments`；`createDemandComment` `POST /demands/{demandId}/comments`；`listPublicAchievementComments` `GET /public/achievements/{achievementId}/comments`；`createAchievementComment` `POST /achievements/{achievementId}/comments`；`listPublicArtworkComments` `GET /public/artworks/{artworkId}/comments`；`createArtworkComment` `POST /artworks/{artworkId}/comments`；`updateComment` `PATCH /comments/{commentId}`；`deleteComment` `DELETE /comments/{commentId}` | fixtures 已覆盖（happy/empty/error/edge） | P0 已实现 |
| 发明人榜（排名） | 口径：按平台内上传专利统计（去重） | `apps/client/src/pages/inventors/index.tsx` | `searchInventorRankings` `GET /search/inventors` | `GET /search/inventors` | P0 已实现 |
| 技术经理人栏目（排名/检索） | 展示审核通过技术经理人；支持检索与咨询入口 | `apps/client/src/pages/tech-managers/index.tsx` | `searchTechManagers` `GET /search/tech-managers` | `GET /search/tech-managers` | P0 已实现 |
| 技术经理人详情 | 展示简介/资质/服务范围；提供在线咨询 | `apps/client/src/pages/tech-managers/detail/index.tsx` | `getPublicTechManagerById` `GET /public/tech-managers/{techManagerId}`；`upsertTechManagerConversation` `POST /tech-managers/{techManagerId}/conversations` | `GET /public/tech-managers/:techManagerId`；`POST /tech-managers/:techManagerId/conversations` | P0 已实现 |
| 机构展示（仅审核通过） | 企业/院校等审核通过后展示 | `apps/client/src/pages/organizations/index.tsx` | `listPublicOrganizations` `GET /public/organizations` | `GET /public/organizations` | P0 已实现（列表） |
| 机构详情 | 机构详情页（可点可看） | `apps/client/src/pages/organizations/detail/index.tsx` | `getPublicOrganizationById` `GET /public/organizations/{orgUserId}` | `GET /public/organizations/:orgUserId` | P0 已实现 |
| 专利地图（区域数量/真实地图） | P0 数据由后台维护；前台展示（列表）；P0.1（最快）小程序真实地图：marker 展示省级专利数（不引入外部地图 key） | `apps/client/src/pages/patent-map/index.tsx` | `listPatentMapYears` `GET /patent-map/years`；`getPatentMapSummary` `GET /patent-map/summary`；`listRegions` `GET /regions` | `GET /patent-map/years`；`GET /patent-map/summary`；`GET /regions` | P0 已实现（列表）；P0.1 待实现（真实地图 markers） |
| 地区详情（地图 drilldown） | 省/市/区 drilldown（可点可看） | `apps/client/src/pages/patent-map/region-detail/index.tsx` | `getPatentMapRegionDetail` `GET /patent-map/regions/{regionCode}` | `GET /patent-map/regions/:regionCode` | P0 已实现 |
| 登录 | 微信/短信登录 | `apps/client/src/pages/login/index.tsx` | `authWechatMpLogin` `POST /auth/wechat/mp-login`；`authSmsSend` `POST /auth/sms/send`；`authSmsVerify` `POST /auth/sms/verify` | `POST /auth/wechat/mp-login`；`POST /auth/sms/send`；`POST /auth/sms/verify` | P0 已实现 |
| 首次进入：选择身份 | 个人秒通过；其余提交资料待审核 | `apps/client/src/pages/onboarding/choose-identity/index.tsx` | `submitMyVerification` `POST /me/verification` | `POST /me/verification` | P0 已实现 |
| 认证资料提交 | 上传证明材料；进入审核中 | `apps/client/src/pages/onboarding/verification-form/index.tsx` | `uploadFile` `POST /files`；`submitMyVerification` `POST /me/verification` | `POST /files`；`POST /me/verification` | P0 已实现 |
| 消息列表 | 会话列表/未读数（会话创建需审核通过） | `apps/client/src/pages/messages/index.tsx` | `listMyConversations` `GET /me/conversations` | `GET /me/conversations` | P0 已实现 |
| 会话聊天（工单式消息） | P0 非实时；支持刷新与留痕 | `apps/client/src/pages/messages/chat/index.tsx` | `listConversationMessages` `GET /conversations/{conversationId}/messages`；`sendConversationMessage` `POST /conversations/{conversationId}/messages`；`markConversationRead` `POST /conversations/{conversationId}/read` | 对应 3 个 fixtures | P0 已实现 |
| 支付订金（演示） | 小程序：下单→订金支付意图→成功页（专利/书画）；H5：仅引导回小程序（需审核通过） | `apps/client/src/pages/checkout/deposit-pay/index.tsx` | `createOrder` `POST /orders`；`createPaymentIntent` `POST /orders/{orderId}/payment-intents` | `POST /orders`；`POST /orders/:orderId/payment-intents` | P0 已实现（演示跳转） |
| 订金成功页 | 展示订单信息/下一步 | `apps/client/src/pages/checkout/deposit-success/index.tsx` | `getOrderById` `GET /orders/{orderId}` | `GET /orders/:orderId` | P0 已实现 |
| 支付尾款（演示） | 小程序：尾款支付意图→成功页；H5：仅引导回小程序（需审核通过） | `apps/client/src/pages/checkout/final-pay/index.tsx` | `createPaymentIntent` `POST /orders/{orderId}/payment-intents` | `POST /orders/:orderId/payment-intents` | P0 已实现（演示跳转） |
| 尾款成功页 | 展示订单信息/下一步 | `apps/client/src/pages/checkout/final-success/index.tsx` | `getOrderById` `GET /orders/{orderId}` | `GET /orders/:orderId` | P0 已实现 |
| 订单详情（下一步入口） | 状态驱动：WAIT_FINAL_PAYMENT → 支付尾款（跳转尾款支付页） | `apps/client/src/pages/orders/detail/index.tsx` | - | - | P0 已实现 |
| 发布入口（卖家侧） | 发布前需登录+身份选择；非个人需审核（专利/书画/需求/成果） | `apps/client/src/pages/publish/index.tsx` | `getMyVerification` `GET /me/verification`（前置校验） | `GET /me/verification` | P0 已实现 |
| 发布专利交易（表单） | 权属/价格/地域/标签；草稿/提交审核 | `apps/client/src/pages/publish/patent/index.tsx` | `normalizePatentNumber` `POST /patents/normalize`；`uploadFile` `POST /files`；`createListing` `POST /listings`；`updateListing` `PATCH /listings/{listingId}`；`submitListing` `POST /listings/{listingId}/submit` | 对应 fixtures 已覆盖 | P0 已实现 |
| 发布产学研需求（表单） | 字段/附件/草稿/提交审核；支持视频 + 封面 | `apps/client/src/pages/publish/demand/index.tsx` | `uploadFile` `POST /files`；`createDemand` `POST /demands`；`updateDemand` `PATCH /demands/{demandId}`；`submitDemand` `POST /demands/{demandId}/submit`；`offShelfDemand` `POST /demands/{demandId}/off-shelf` | 对应 fixtures 已覆盖 | P0 已实现 |
| 发布成果展示（表单） | 字段/多媒体/草稿/提交审核；支持视频 + 封面 | `apps/client/src/pages/publish/achievement/index.tsx` | `uploadFile` `POST /files`；`createAchievement` `POST /achievements`；`updateAchievement` `PATCH /achievements/{achievementId}`；`submitAchievement` `POST /achievements/{achievementId}/submit`；`offShelfAchievement` `POST /achievements/{achievementId}/off-shelf` | 对应 fixtures 已覆盖 | P0 已实现 |
| 发布书画专区（表单） | 字段/多媒体/证书/草稿/提交审核；支持图片 | `apps/client/src/pages/publish/artwork/index.tsx` | `uploadFile` `POST /files`；`createArtwork` `POST /artworks`；`updateArtwork` `PATCH /artworks/{artworkId}`；`submitArtwork` `POST /artworks/{artworkId}/submit`；`offShelfArtwork` `POST /artworks/{artworkId}/off-shelf` | 对应 fixtures 已覆盖 | P0 已实现 |
| 我的专利上架 | 发布方查看/编辑/下架 | `apps/client/src/pages/my-listings/index.tsx` | `listMyListings` `GET /listings`；`offShelfListing` `POST /listings/{listingId}/off-shelf` | `GET /listings`；`POST /listings/:listingId/off-shelf` | P0 已实现 |
| 我的需求 | 发布方查看/编辑/下架 | `apps/client/src/pages/my-demands/index.tsx` | `listMyDemands` `GET /demands`；`offShelfDemand` `POST /demands/{demandId}/off-shelf` | `GET /demands`；`POST /demands/:demandId/off-shelf` | P0 已实现 |
| 我的成果 | 发布方查看/编辑/下架 | `apps/client/src/pages/my-achievements/index.tsx` | `listMyAchievements` `GET /achievements`；`offShelfAchievement` `POST /achievements/{achievementId}/off-shelf` | `GET /achievements`；`POST /achievements/:achievementId/off-shelf` | P0 已实现 |
| 我的书画 | 发布方查看/编辑/下架 | `apps/client/src/pages/my-artworks/index.tsx` | `listMyArtworks` `GET /artworks`；`offShelfArtwork` `POST /artworks/{artworkId}/off-shelf` | `GET /artworks`；`POST /artworks/:artworkId/off-shelf` | P0 已实现 |
| 收藏 | 收藏/取消收藏/收藏列表（专利/需求/成果/书画） | `apps/client/src/pages/favorites/index.tsx` | `favoriteListing` `POST /listings/{listingId}/favorites`；`unfavoriteListing` `DELETE /listings/{listingId}/favorites`；`listMyFavoriteListings` `GET /me/favorites`；`favoriteDemand` `POST /demands/{demandId}/favorites`；`unfavoriteDemand` `DELETE /demands/{demandId}/favorites`；`listMyFavoriteDemands` `GET /me/favorites/demands`；`favoriteAchievement` `POST /achievements/{achievementId}/favorites`；`unfavoriteAchievement` `DELETE /achievements/{achievementId}/favorites`；`listMyFavoriteAchievements` `GET /me/favorites/achievements`；`favoriteArtwork` `POST /artworks/{artworkId}/favorites`；`unfavoriteArtwork` `DELETE /artworks/{artworkId}/favorites`；`listMyFavoriteArtworks` `GET /me/favorites/artworks` | `POST /listings/:listingId/favorites`；`DELETE /listings/:listingId/favorites`；`GET /me/favorites`；`POST /demands/:demandId/favorites`；`DELETE /demands/:demandId/favorites`；`GET /me/favorites/demands`；`POST /achievements/:achievementId/favorites`；`DELETE /achievements/:achievementId/favorites`；`GET /me/favorites/achievements`；`POST /artworks/:artworkId/favorites`；`DELETE /artworks/:artworkId/favorites`；`GET /me/favorites/artworks` | P0 已实现 |
| 退款（买家侧） | 退款申请/进度查询（入口：订单详情） | `apps/client/src/pages/orders/detail/index.tsx` | `createRefundRequest` `POST /orders/{orderId}/refund-requests`；`listRefundRequestsByOrder` `GET /orders/{orderId}/refund-requests` | `POST /orders/:orderId/refund-requests`；`GET /orders/:orderId/refund-requests` | P0 已实现 |

## 2. 管理后台（PC Web，`apps/admin-web`）

| 页面/能力 | 需求/说明（PRD） | 前端入口 | OpenAPI（operationId / method path） | Mock 覆盖 | 状态 |
|---|---|---|---|---|---|
| 登录（演示） | P0 demo token | `apps/admin-web/src/views/LoginPage.tsx` |（未接真实登录） |（无） | P0 占位 |
| 仪表盘 | 待审认证/待审上架/订单概览 | `apps/admin-web/src/views/DashboardPage.tsx` | `adminListUserVerifications`；`adminListListingsForAudit`；`listMyOrders`；`getPatentMapSummary` | fixtures 已覆盖 | P0 已实现 |
| 认证审核 | 审核通过/驳回 | `apps/admin-web/src/views/VerificationsPage.tsx` | `adminListUserVerifications`；`adminApproveUserVerification`；`adminRejectUserVerification` | fixtures 已覆盖 | P0 已实现 |
| 技术经理人栏目管理 | 展示开关/推荐配置/服务标签维护 | `apps/admin-web/src/views/TechManagersPage.tsx` | `adminListTechManagers` `GET /admin/tech-managers`；`adminUpdateTechManager` `PATCH /admin/tech-managers/{techManagerId}` | fixtures 已覆盖 | P0 已实现 |
| 上架审核 | 审核通过/驳回/省市特色置顶 | `apps/admin-web/src/views/ListingsAuditPage.tsx` | `adminListListingsForAudit`；`adminApproveListing`；`adminRejectListing`；`adminSetListingFeatured` | fixtures 已覆盖 | P0 已实现 |
| 需求审核 | 审核通过/驳回（对齐专利审核口径） | `apps/admin-web/src/views/DemandsAuditPage.tsx` | `adminListDemandsForAudit`；`adminApproveDemand`；`adminRejectDemand` | `GET /admin/demands`（fixtures 默认空，发布后可在此审核） | P0 已实现 |
| 成果审核 | 审核通过/驳回（对齐专利审核口径） | `apps/admin-web/src/views/AchievementsAuditPage.tsx` | `adminListAchievementsForAudit`；`adminApproveAchievement`；`adminRejectAchievement` | `GET /admin/achievements`（fixtures 默认空，发布后可在此审核） | P0 已实现 |
| 书画审核 | 审核通过/驳回（对齐专利审核口径） | `apps/admin-web/src/views/ArtworksAuditPage.tsx` | `adminListArtworksForAudit`；`adminApproveArtwork`；`adminRejectArtwork` | `GET /admin/artworks`（fixtures 已覆盖） | P0 已实现 |
| 留言管理 | 留言列表 + 搜索/筛选 + 隐藏/恢复/删除 | `apps/admin-web/src/views/CommentsPage.tsx` | `adminListComments`；`adminUpdateComment` | `GET /admin/comments`；`PATCH /admin/comments/:commentId`（fixtures 已覆盖） | P0 已实现 |
| 订单管理 | 里程碑：合同确认/变更完成 | `apps/admin-web/src/views/OrdersPage.tsx` | `listMyOrders`；`adminConfirmContractSigned`；`adminConfirmTransferCompleted` | fixtures 已覆盖 | P0 已实现 |
| 退款审批 | 通过/驳回；失败提示 | `apps/admin-web/src/views/RefundsPage.tsx` | `listRefundRequestsByOrder`；`adminApproveRefundRequest`；`adminRejectRefundRequest` | fixtures 已覆盖 | P0 已实现 |
| 结算/放款 | 上传凭证→确认放款 | `apps/admin-web/src/views/SettlementsPage.tsx` | `adminGetOrderSettlement`；`adminConfirmManualPayout`；`uploadFile` | fixtures 已覆盖 | P0 已实现 |
| 发票上传/删除 | 线下开票后上传附件；订单内下载 | `apps/admin-web/src/views/InvoicesPage.tsx` | `getOrderInvoice`；`adminUpsertOrderInvoice`；`adminDeleteOrderInvoice`；`uploadFile` | fixtures 已覆盖 | P0 已实现 |
| 交易规则/推荐配置 | 订金/佣金/退款窗口；推荐权重系数 | `apps/admin-web/src/views/ConfigPage.tsx` | `adminGetTradeRulesConfig`；`adminUpdateTradeRulesConfig`；`adminGetRecommendationConfig`；`adminUpdateRecommendationConfig` | fixtures 已覆盖 | P0 已实现 |
| 专利地图 CMS | 年份/区域数据维护 | `apps/admin-web/src/views/PatentMapPage.tsx` | `listPatentMapYears`；`adminGetPatentMapEntry`；`adminUpsertPatentMapEntry`；`adminImportPatentMapExcel` | fixtures 已覆盖 | P0 已实现 |
| 地区/产业标签 | 区域中心点/产业标签用于地域推荐与运营配置 | `apps/admin-web/src/views/RegionsPage.tsx` | `adminListRegions`；`adminCreateRegion`；`adminUpdateRegion`；`adminListIndustryTags`；`adminCreateIndustryTag`；`adminSetRegionIndustryTags` | fixtures 已覆盖 | P0 已实现 |

## 3. 当前“缺口清单”（建议按演示/验收优先级排）

- P0 前端骨架已收口：收藏、机构详情、地图 drilldown、登录、买家订单/退款入口、交易规则前台展示等均已对齐 OpenAPI，并补齐 happy fixtures；书画专区与技术经理人栏目已补齐并进入 P0 已实现。
- 仍属后端联调项：微信支付/退款回调验签与幂等（`POST /webhooks/wechatpay/notify`，前端不调用）。

### 3.1 OpenAPI 已有但前端暂未消费（需确认 P0/P1）

> 见 `docs/engineering/openapi-coverage.md`：Demand/Achievement 新增 operations 目前尚未被前端消费（属计划内差异）；支付回调为后端内部接口，前端不调用。

### 3.2 P1 预留能力（AI/托管/告警/平台内容）

| 页面/能力 | 需求/说明（PRD） | 前端入口 | OpenAPI（operationId / method path） | Mock 覆盖 | 状态 |
|---|---|---|---|---|---|
| 智能体语音检索 | 自然语言/语音 → 结构化检索条件；H5 提示去小程序 | `apps/client/src/pages/home/index.tsx`<br/>`apps/client/src/pages/search/index.tsx` | `createAiAgentQuery` `POST /ai/agent/query` | - | P1 |
| AI 解析卡片 + 评分 | 专利/需求/成果详情展示 AI 解析并评分纠错 | `apps/client/src/pages/listing/detail/index.tsx`<br/>`apps/client/src/pages/demand/detail/index.tsx`<br/>`apps/client/src/pages/achievement/detail/index.tsx` | `createAiParseFeedback` `POST /ai/parse-results/{parseResultId}/feedback` | - | P1 |
| 平台自有内容 CMS | 后台管理平台自有专利/需求/成果 | `apps/admin-web/src/views/PlaceholderPage.tsx`（待补） | `adminCreatePatent` `POST /admin/patents`；`adminCreateListing` `POST /admin/listings`；`adminCreateDemand` `POST /admin/demands`；`adminCreateAchievement` `POST /admin/achievements` | - | P1 |
| AI 解析复核池 | 低评分/低置信度进入后台复核池 | `apps/admin-web/src/views/PlaceholderPage.tsx`（待补） | `adminListAiParseResults` `GET /admin/ai/parse-results` | - | P1 |
| 专利托管任务 | 年费日程 + 托管任务指派 | `apps/admin-web/src/views/PlaceholderPage.tsx`（待补） | `adminListPatentMaintenanceSchedules` `GET /admin/patent-maintenance/schedules`；`adminListPatentMaintenanceTasks` `GET /admin/patent-maintenance/tasks` | - | P1 |
| 告警中心 | 短信/邮件/站内告警，支持确认 | `apps/admin-web/src/views/PlaceholderPage.tsx`（待补） | `adminListAlertEvents` `GET /admin/alerts`；`adminAcknowledgeAlertEvent` `POST /admin/alerts/{alertId}/ack` | - | P1 |
| 数据地图扩展 | 技术经理人/科学家/书画成果地图 | `apps/client/src/pages/patent-map/index.tsx` | - | - | P1 |
| 大数据分析中心 | 交易库/成果库/产学研库指标看板与导出 | `apps/admin-web/src/views/PlaceholderPage.tsx`（待补） | - | - | P1 |
