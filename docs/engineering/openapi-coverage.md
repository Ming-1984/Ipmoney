# OpenAPI × 前端 × Mock 覆盖报告（自动生成）

> 由 `scripts/audit-coverage.mjs` 生成；用于 #14 覆盖度审计与防遗漏。

## 1. 汇总

- OpenAPI operations：178
- 前端已使用（Client）：93
- 前端已使用（Admin）：47
- fixtures 场景数：7

## 2. 关键差异（需要人工确认/回填）

- 前端使用但 OpenAPI 未定义：0
- OpenAPI 定义但前端未使用：43
  - GET /admin/achievements/:param
  - GET /admin/ai/parse-results
  - GET /admin/ai/parse-results/:param
  - GET /admin/alerts
  - GET /admin/artworks/:param
  - GET /admin/config/ai
  - GET /admin/config/alerts
  - GET /admin/demands/:param
  - GET /admin/listings/:param
  - GET /admin/patent-maintenance/schedules
  - GET /admin/patent-maintenance/schedules/:param
  - GET /admin/patent-maintenance/tasks
  - GET /admin/patents
  - GET /admin/patents/:param
  - GET /me/recommendations/listings
  - PATCH /admin/achievements/:param
  - PATCH /admin/ai/parse-results/:param
  - PATCH /admin/artworks/:param
  - PATCH /admin/demands/:param
  - PATCH /admin/listings/:param
  - PATCH /admin/patent-maintenance/schedules/:param
  - PATCH /admin/patent-maintenance/tasks/:param
  - PATCH /admin/patents/:param
  - POST /admin/achievements
  - POST /admin/achievements/:param/off-shelf
  - POST /admin/achievements/:param/publish
  - POST /admin/alerts/:param/ack
  - POST /admin/artworks
  - POST /admin/artworks/:param/off-shelf
  - POST /admin/artworks/:param/publish
  - POST /admin/demands
  - POST /admin/demands/:param/off-shelf
  - POST /admin/demands/:param/publish
  - POST /admin/listings
  - POST /admin/listings/:param/off-shelf
  - POST /admin/listings/:param/publish
  - POST /admin/patent-maintenance/schedules
  - POST /admin/patent-maintenance/tasks
  - POST /admin/patents
  - POST /ai/agent/query
  - POST /ai/parse-results/:param/feedback
  - PUT /admin/config/ai
  - PUT /admin/config/alerts
- 前端已使用但 happy fixtures 未覆盖（会回落到 Prism）：0

## 3. 覆盖明细（按 operation）

| operationId | method | path | Client | Admin | happy | empty | error | edge | order_conflict | payment_callback_replay | refund_failed |
|---|---|---|---|---|---|---|---|---|---|---|---|
| unfavoriteAchievement | DELETE | /achievements/:param/favorites | ✓ |  | ✓ |  |  |  |  |  |  |
| adminDeleteOrderInvoice | DELETE | /admin/orders/:param/invoice |  | ✓ | ✓ |  | ✓ |  |  |  |  |
| unfavoriteArtwork | DELETE | /artworks/:param/favorites | ✓ |  | ✓ |  |  |  |  |  |  |
| deleteComment | DELETE | /comments/:param | ✓ |  | ✓ | ✓ | ✓ | ✓ |  |  |  |
| unfavoriteDemand | DELETE | /demands/:param/favorites | ✓ |  | ✓ |  |  |  |  |  |  |
| unfavoriteListing | DELETE | /listings/:param/favorites | ✓ |  | ✓ |  |  |  |  |  |  |
| listMyAchievements | GET | /achievements | ✓ |  | ✓ |  |  |  |  |  |  |
| getAchievementById | GET | /achievements/:param | ✓ |  | ✓ |  |  |  |  |  |  |
| adminListAchievementsForAudit | GET | /admin/achievements |  | ✓ | ✓ |  |  |  |  |  |  |
| adminGetAchievementById | GET | /admin/achievements/:param |  |  |  |  |  |  |  |  |  |
| adminListAiParseResults | GET | /admin/ai/parse-results |  |  |  |  |  |  |  |  |  |
| adminGetAiParseResult | GET | /admin/ai/parse-results/:param |  |  |  |  |  |  |  |  |  |
| adminListAlertEvents | GET | /admin/alerts |  |  |  |  |  |  |  |  |  |
| adminListArtworksForAudit | GET | /admin/artworks |  | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |  |
| adminGetArtworkById | GET | /admin/artworks/:param |  |  |  |  |  |  |  |  |  |
| adminListComments | GET | /admin/comments |  | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |  |
| adminGetAiConfig | GET | /admin/config/ai |  |  |  |  |  |  |  |  |  |
| adminGetAlertConfig | GET | /admin/config/alerts |  |  |  |  |  |  |  |  |  |
| adminGetRecommendationConfig | GET | /admin/config/recommendation |  | ✓ | ✓ | ✓ | ✓ |  |  |  |  |
| adminGetTradeRulesConfig | GET | /admin/config/trade-rules |  | ✓ | ✓ | ✓ | ✓ |  |  |  |  |
| adminListDemandsForAudit | GET | /admin/demands |  | ✓ | ✓ |  |  |  |  |  |  |
| adminGetDemandById | GET | /admin/demands/:param |  |  |  |  |  |  |  |  |  |
| adminListIndustryTags | GET | /admin/industry-tags |  | ✓ | ✓ |  |  |  |  |  |  |
| adminListListingsForAudit | GET | /admin/listings |  | ✓ | ✓ | ✓ | ✓ |  |  |  |  |
| adminGetListingById | GET | /admin/listings/:param |  |  |  |  |  |  |  |  |  |
| adminGetOrderSettlement | GET | /admin/orders/:param/settlement |  | ✓ | ✓ | ✓ | ✓ |  |  |  |  |
| adminListPatentMaintenanceSchedules | GET | /admin/patent-maintenance/schedules |  |  |  |  |  |  |  |  |  |
| adminGetPatentMaintenanceSchedule | GET | /admin/patent-maintenance/schedules/:param |  |  |  |  |  |  |  |  |  |
| adminListPatentMaintenanceTasks | GET | /admin/patent-maintenance/tasks |  |  |  |  |  |  |  |  |  |
| adminGetPatentMapEntry | GET | /admin/patent-map/regions/:param/years/:param |  | ✓ | ✓ | ✓ | ✓ |  |  |  |  |
| adminListPatents | GET | /admin/patents |  |  |  |  |  |  |  |  |  |
| adminGetPatentById | GET | /admin/patents/:param |  |  |  |  |  |  |  |  |  |
| adminListRegions | GET | /admin/regions |  | ✓ | ✓ |  |  |  |  |  |  |
| adminListTechManagers | GET | /admin/tech-managers |  | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |  |
| adminListUserVerifications | GET | /admin/user-verifications |  | ✓ | ✓ | ✓ | ✓ |  |  |  |  |
| listMyArtworks | GET | /artworks | ✓ |  | ✓ |  |  |  |  |  |  |
| getArtworkById | GET | /artworks/:param | ✓ |  | ✓ |  |  |  |  |  |  |
| listConversationMessages | GET | /conversations/:param/messages | ✓ |  | ✓ | ✓ | ✓ |  |  |  |  |
| listMyDemands | GET | /demands | ✓ |  | ✓ |  |  |  |  |  |  |
| getDemandById | GET | /demands/:param | ✓ |  | ✓ |  |  |  |  |  |  |
| listMyListings | GET | /listings | ✓ |  | ✓ |  |  |  |  |  |  |
| getListingById | GET | /listings/:param | ✓ |  | ✓ |  |  |  |  |  |  |
| getMe | GET | /me | ✓ |  | ✓ |  | ✓ |  |  |  |  |
| listMyConversations | GET | /me/conversations | ✓ |  | ✓ | ✓ | ✓ |  |  |  |  |
| listMyFavoriteListings | GET | /me/favorites | ✓ |  | ✓ |  |  |  |  |  |  |
| listMyFavoriteAchievements | GET | /me/favorites/achievements | ✓ |  | ✓ |  |  |  |  |  |  |
| listMyFavoriteArtworks | GET | /me/favorites/artworks | ✓ |  | ✓ |  |  |  |  |  |  |
| listMyFavoriteDemands | GET | /me/favorites/demands | ✓ |  | ✓ |  |  |  |  |  |  |
| getMyRecommendedListings | GET | /me/recommendations/listings |  |  | ✓ | ✓ | ✓ |  |  |  |  |
| getMyVerification | GET | /me/verification | ✓ |  | ✓ |  |  |  |  |  |  |
| listMyOrders | GET | /orders | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |  |  |
| getOrderById | GET | /orders/:param | ✓ |  | ✓ |  |  |  |  |  |  |
| getOrderCase | GET | /orders/:param/case | ✓ |  | ✓ |  |  |  |  |  |  |
| getOrderInvoice | GET | /orders/:param/invoice | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |  |  |
| listRefundRequestsByOrder | GET | /orders/:param/refund-requests | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |  |  |
| getPatentMapRegionDetail | GET | /patent-map/regions/:param | ✓ |  | ✓ |  |  |  |  |  |  |
| getPatentMapSummary | GET | /patent-map/summary | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |  |  |
| listPatentMapYears | GET | /patent-map/years | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |  |  |
| getPatentById | GET | /patents/:param | ✓ |  | ✓ |  |  |  |  |  |  |
| getPublicAchievementById | GET | /public/achievements/:param | ✓ |  | ✓ |  |  |  |  |  |  |
| listPublicAchievementComments | GET | /public/achievements/:param/comments | ✓ |  | ✓ | ✓ | ✓ |  |  |  |  |
| getPublicArtworkById | GET | /public/artworks/:param | ✓ |  | ✓ |  |  |  |  |  |  |
| listPublicArtworkComments | GET | /public/artworks/:param/comments | ✓ |  | ✓ | ✓ | ✓ | ✓ |  |  |  |
| getPublicTradeRulesConfig | GET | /public/config/trade-rules | ✓ |  | ✓ |  |  |  |  |  |  |
| getPublicDemandById | GET | /public/demands/:param | ✓ |  | ✓ |  |  |  |  |  |  |
| listPublicDemandComments | GET | /public/demands/:param/comments | ✓ |  | ✓ | ✓ | ✓ |  |  |  |  |
| listPublicIndustryTags | GET | /public/industry-tags | ✓ |  | ✓ |  |  |  |  |  |  |
| getPublicListingById | GET | /public/listings/:param | ✓ |  | ✓ |  |  | ✓ |  |  |  |
| listPublicListingComments | GET | /public/listings/:param/comments | ✓ |  | ✓ | ✓ | ✓ | ✓ |  |  |  |
| listPublicOrganizations | GET | /public/organizations | ✓ |  | ✓ | ✓ | ✓ |  |  |  |  |
| getPublicOrganizationById | GET | /public/organizations/:param | ✓ |  | ✓ |  |  |  |  |  |  |
| getPublicTechManagerById | GET | /public/tech-managers/:param | ✓ |  | ✓ |  |  |  |  |  |  |
| listRegions | GET | /regions | ✓ |  | ✓ |  |  |  |  |  |  |
| searchAchievements | GET | /search/achievements | ✓ |  | ✓ | ✓ | ✓ | ✓ |  |  |  |
| searchArtworks | GET | /search/artworks | ✓ |  | ✓ | ✓ | ✓ | ✓ |  |  |  |
| searchDemands | GET | /search/demands | ✓ |  | ✓ | ✓ | ✓ | ✓ |  |  |  |
| searchInventorRankings | GET | /search/inventors | ✓ |  | ✓ | ✓ | ✓ |  |  |  |  |
| searchListings | GET | /search/listings | ✓ |  | ✓ | ✓ | ✓ | ✓ |  |  |  |
| searchTechManagers | GET | /search/tech-managers | ✓ |  | ✓ | ✓ | ✓ | ✓ |  |  |  |
| updateAchievement | PATCH | /achievements/:param | ✓ |  | ✓ |  |  |  |  |  |  |
| adminUpdateAchievement | PATCH | /admin/achievements/:param |  |  |  |  |  |  |  |  |  |
| adminUpdateAiParseResult | PATCH | /admin/ai/parse-results/:param |  |  |  |  |  |  |  |  |  |
| adminUpdateArtwork | PATCH | /admin/artworks/:param |  |  |  |  |  |  |  |  |  |
| adminUpdateComment | PATCH | /admin/comments/:param |  | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |  |
| adminUpdateDemand | PATCH | /admin/demands/:param |  |  |  |  |  |  |  |  |  |
| adminUpdateListing | PATCH | /admin/listings/:param |  |  |  |  |  |  |  |  |  |
| adminUpdatePatentMaintenanceSchedule | PATCH | /admin/patent-maintenance/schedules/:param |  |  |  |  |  |  |  |  |  |
| adminUpdatePatentMaintenanceTask | PATCH | /admin/patent-maintenance/tasks/:param |  |  |  |  |  |  |  |  |  |
| adminUpdatePatent | PATCH | /admin/patents/:param |  |  |  |  |  |  |  |  |  |
| adminUpdateRegion | PATCH | /admin/regions/:param |  | ✓ | ✓ |  |  |  |  |  |  |
| adminUpdateTechManager | PATCH | /admin/tech-managers/:param |  | ✓ | ✓ |  |  |  |  |  |  |
| updateArtwork | PATCH | /artworks/:param | ✓ |  | ✓ |  |  |  |  |  |  |
| updateComment | PATCH | /comments/:param | ✓ |  | ✓ | ✓ | ✓ | ✓ |  |  |  |
| updateDemand | PATCH | /demands/:param | ✓ |  | ✓ |  |  |  |  |  |  |
| updateListing | PATCH | /listings/:param | ✓ |  | ✓ |  |  |  |  |  |  |
| updateMe | PATCH | /me | ✓ |  | ✓ |  |  |  |  |  |  |
| createAchievement | POST | /achievements | ✓ |  | ✓ |  |  |  |  |  |  |
| createAchievementComment | POST | /achievements/:param/comments | ✓ |  | ✓ | ✓ | ✓ |  |  |  |  |
| upsertAchievementConversation | POST | /achievements/:param/conversations | ✓ |  | ✓ |  |  |  |  |  |  |
| favoriteAchievement | POST | /achievements/:param/favorites | ✓ |  | ✓ |  |  |  |  |  |  |
| offShelfAchievement | POST | /achievements/:param/off-shelf | ✓ |  | ✓ |  |  |  |  |  |  |
| submitAchievement | POST | /achievements/:param/submit | ✓ |  | ✓ |  |  |  |  |  |  |
| adminCreateAchievement | POST | /admin/achievements |  |  |  |  |  |  |  |  |  |
| adminApproveAchievement | POST | /admin/achievements/:param/approve |  | ✓ | ✓ |  |  |  |  |  |  |
| adminOffShelfAchievement | POST | /admin/achievements/:param/off-shelf |  |  |  |  |  |  |  |  |  |
| adminPublishAchievement | POST | /admin/achievements/:param/publish |  |  |  |  |  |  |  |  |  |
| adminRejectAchievement | POST | /admin/achievements/:param/reject |  | ✓ | ✓ |  |  |  |  |  |  |
| adminAcknowledgeAlertEvent | POST | /admin/alerts/:param/ack |  |  |  |  |  |  |  |  |  |
| adminCreateArtwork | POST | /admin/artworks |  |  |  |  |  |  |  |  |  |
| adminApproveArtwork | POST | /admin/artworks/:param/approve |  | ✓ | ✓ |  |  |  |  |  |  |
| adminOffShelfArtwork | POST | /admin/artworks/:param/off-shelf |  |  |  |  |  |  |  |  |  |
| adminPublishArtwork | POST | /admin/artworks/:param/publish |  |  |  |  |  |  |  |  |  |
| adminRejectArtwork | POST | /admin/artworks/:param/reject |  | ✓ | ✓ |  |  |  |  |  |  |
| adminCreateDemand | POST | /admin/demands |  |  |  |  |  |  |  |  |  |
| adminApproveDemand | POST | /admin/demands/:param/approve |  | ✓ | ✓ |  |  |  |  |  |  |
| adminOffShelfDemand | POST | /admin/demands/:param/off-shelf |  |  |  |  |  |  |  |  |  |
| adminPublishDemand | POST | /admin/demands/:param/publish |  |  |  |  |  |  |  |  |  |
| adminRejectDemand | POST | /admin/demands/:param/reject |  | ✓ | ✓ |  |  |  |  |  |  |
| adminCreateIndustryTag | POST | /admin/industry-tags |  | ✓ | ✓ |  |  |  |  |  |  |
| adminCreateListing | POST | /admin/listings |  |  |  |  |  |  |  |  |  |
| adminApproveListing | POST | /admin/listings/:param/approve |  | ✓ | ✓ |  |  |  |  |  |  |
| adminOffShelfListing | POST | /admin/listings/:param/off-shelf |  |  |  |  |  |  |  |  |  |
| adminPublishListing | POST | /admin/listings/:param/publish |  |  |  |  |  |  |  |  |  |
| adminRejectListing | POST | /admin/listings/:param/reject |  | ✓ | ✓ |  |  |  |  |  |  |
| adminConfirmContractSigned | POST | /admin/orders/:param/milestones/contract-signed |  | ✓ | ✓ |  |  |  | ✓ |  |  |
| adminConfirmTransferCompleted | POST | /admin/orders/:param/milestones/transfer-completed |  | ✓ | ✓ |  |  |  | ✓ |  |  |
| adminConfirmManualPayout | POST | /admin/orders/:param/payouts/manual |  | ✓ | ✓ |  | ✓ |  |  |  |  |
| adminCreatePatentMaintenanceSchedule | POST | /admin/patent-maintenance/schedules |  |  |  |  |  |  |  |  |  |
| adminCreatePatentMaintenanceTask | POST | /admin/patent-maintenance/tasks |  |  |  |  |  |  |  |  |  |
| adminImportPatentMapExcel | POST | /admin/patent-map/import |  | ✓ | ✓ |  |  |  |  |  |  |
| adminCreatePatent | POST | /admin/patents |  |  |  |  |  |  |  |  |  |
| adminApproveRefundRequest | POST | /admin/refund-requests/:param/approve |  | ✓ | ✓ |  |  |  |  |  | ✓ |
| adminRejectRefundRequest | POST | /admin/refund-requests/:param/reject |  | ✓ | ✓ |  |  |  |  |  |  |
| adminCreateRegion | POST | /admin/regions |  | ✓ | ✓ |  |  |  |  |  |  |
| adminApproveUserVerification | POST | /admin/user-verifications/:param/approve |  | ✓ | ✓ |  |  |  |  |  |  |
| adminRejectUserVerification | POST | /admin/user-verifications/:param/reject |  | ✓ | ✓ |  |  |  |  |  |  |
| createAiAgentQuery | POST | /ai/agent/query |  |  |  |  |  |  |  |  |  |
| createAiParseFeedback | POST | /ai/parse-results/:param/feedback |  |  |  |  |  |  |  |  |  |
| createArtwork | POST | /artworks | ✓ |  | ✓ |  |  |  |  |  |  |
| createArtworkComment | POST | /artworks/:param/comments | ✓ |  | ✓ | ✓ | ✓ | ✓ |  |  |  |
| upsertArtworkConversation | POST | /artworks/:param/conversations | ✓ |  | ✓ |  | ✓ |  |  |  |  |
| favoriteArtwork | POST | /artworks/:param/favorites | ✓ |  | ✓ |  |  |  |  |  |  |
| offShelfArtwork | POST | /artworks/:param/off-shelf | ✓ |  | ✓ |  |  |  |  |  |  |
| submitArtwork | POST | /artworks/:param/submit | ✓ |  | ✓ |  |  |  |  |  |  |
| authSmsSend | POST | /auth/sms/send | ✓ |  | ✓ |  |  |  |  |  |  |
| authSmsVerify | POST | /auth/sms/verify | ✓ |  | ✓ |  |  |  |  |  |  |
| authWechatMpLogin | POST | /auth/wechat/mp-login | ✓ |  | ✓ |  |  |  |  |  |  |
| sendConversationMessage | POST | /conversations/:param/messages | ✓ |  | ✓ |  | ✓ |  |  |  |  |
| markConversationRead | POST | /conversations/:param/read | ✓ |  | ✓ |  | ✓ |  |  |  |  |
| createDemand | POST | /demands | ✓ |  | ✓ |  |  |  |  |  |  |
| createDemandComment | POST | /demands/:param/comments | ✓ |  | ✓ | ✓ | ✓ |  |  |  |  |
| upsertDemandConversation | POST | /demands/:param/conversations | ✓ |  | ✓ |  |  |  |  |  |  |
| favoriteDemand | POST | /demands/:param/favorites | ✓ |  | ✓ |  |  |  |  |  |  |
| offShelfDemand | POST | /demands/:param/off-shelf | ✓ |  | ✓ |  |  |  |  |  |  |
| submitDemand | POST | /demands/:param/submit | ✓ |  | ✓ |  |  |  |  |  |  |
| uploadFile | POST | /files | ✓ | ✓ | ✓ |  | ✓ |  |  |  |  |
| createListing | POST | /listings | ✓ |  | ✓ |  |  |  |  |  |  |
| createListingComment | POST | /listings/:param/comments | ✓ |  | ✓ | ✓ | ✓ | ✓ |  |  |  |
| createListingConsultation | POST | /listings/:param/consultations | ✓ |  | ✓ |  |  |  |  |  |  |
| upsertListingConversation | POST | /listings/:param/conversations | ✓ |  | ✓ |  | ✓ |  |  |  |  |
| favoriteListing | POST | /listings/:param/favorites | ✓ |  | ✓ |  |  |  |  |  |  |
| offShelfListing | POST | /listings/:param/off-shelf | ✓ |  | ✓ |  |  |  |  |  |  |
| submitListing | POST | /listings/:param/submit | ✓ |  | ✓ |  |  |  |  |  |  |
| submitMyVerification | POST | /me/verification | ✓ |  | ✓ |  |  |  |  |  |  |
| createOrder | POST | /orders | ✓ |  | ✓ |  |  |  |  |  |  |
| createPaymentIntent | POST | /orders/:param/payment-intents | ✓ |  | ✓ |  |  |  |  | ✓ |  |
| createRefundRequest | POST | /orders/:param/refund-requests | ✓ |  | ✓ |  |  |  |  |  |  |
| normalizePatentNumber | POST | /patents/normalize | ✓ |  | ✓ | ✓ | ✓ |  |  |  |  |
| upsertTechManagerConversation | POST | /tech-managers/:param/conversations | ✓ |  | ✓ |  | ✓ |  |  |  |  |
| wechatPayNotify | POST | /webhooks/wechatpay/notify |  |  |  |  |  |  |  |  |  |
| adminUpdateAiConfig | PUT | /admin/config/ai |  |  |  |  |  |  |  |  |  |
| adminUpdateAlertConfig | PUT | /admin/config/alerts |  |  |  |  |  |  |  |  |  |
| adminUpdateRecommendationConfig | PUT | /admin/config/recommendation |  | ✓ | ✓ | ✓ | ✓ |  |  |  |  |
| adminUpdateTradeRulesConfig | PUT | /admin/config/trade-rules |  | ✓ | ✓ | ✓ | ✓ |  |  |  |  |
| adminSetListingFeatured | PUT | /admin/listings/:param/featured |  | ✓ | ✓ |  |  |  |  |  |  |
| adminUpsertOrderInvoice | PUT | /admin/orders/:param/invoice |  | ✓ | ✓ |  | ✓ |  |  |  |  |
| adminUpsertPatentMapEntry | PUT | /admin/patent-map/regions/:param/years/:param |  | ✓ | ✓ |  | ✓ |  |  |  |  |
| adminSetRegionIndustryTags | PUT | /admin/regions/:param/industry-tags |  | ✓ | ✓ |  |  |  |  |  |  |

## 4. 使用说明

- 本报告只做“接口层”覆盖审计：OpenAPI ↔ 前端调用 ↔ fixtures keys。
- PRD 页面/业务规则覆盖请结合 `docs/engineering/traceability-matrix.md` 的“页面能力矩阵”。
- 若某接口未在 happy fixtures 覆盖，mock-api 会回落到 Prism 生成响应，但不保证演示数据质量。
