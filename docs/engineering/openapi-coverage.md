# OpenAPI × 前端 × Mock 覆盖报告（自动生成）

> 由 `scripts/audit-coverage.mjs` 生成；用于 #14 覆盖度审计与防遗漏。

## 1. 汇总

- OpenAPI operations：73
- 前端已使用（Client）：44
- 前端已使用（Admin）：34
- fixtures 场景数：7

## 2. 关键差异（需要人工确认/回填）

- 前端使用但 OpenAPI 未定义：0
- OpenAPI 定义但前端未使用：0
- 前端已使用但 happy fixtures 未覆盖（会回落到 Prism）：0

## 3. 覆盖明细（按 operation）

| operationId | method | path | Client | Admin | happy | empty | error | edge | order_conflict | payment_callback_replay | refund_failed |
|---|---|---|---|---|---|---|---|---|---|---|---|
| adminDeleteOrderInvoice | DELETE | /admin/orders/:param/invoice |  | ✓ | ✓ |  | ✓ |  |  |  |  |
| unfavoriteListing | DELETE | /listings/:param/favorites | ✓ |  | ✓ |  |  |  |  |  |  |
| adminGetRecommendationConfig | GET | /admin/config/recommendation |  | ✓ | ✓ | ✓ | ✓ |  |  |  |  |
| adminGetTradeRulesConfig | GET | /admin/config/trade-rules |  | ✓ | ✓ | ✓ | ✓ |  |  |  |  |
| adminListIndustryTags | GET | /admin/industry-tags |  | ✓ | ✓ |  |  |  |  |  |  |
| adminListListingsForAudit | GET | /admin/listings |  | ✓ | ✓ | ✓ | ✓ |  |  |  |  |
| adminGetOrderSettlement | GET | /admin/orders/:param/settlement |  | ✓ | ✓ | ✓ | ✓ |  |  |  |  |
| adminGetPatentMapEntry | GET | /admin/patent-map/regions/:param/years/:param |  | ✓ | ✓ | ✓ | ✓ |  |  |  |  |
| adminListRegions | GET | /admin/regions |  | ✓ | ✓ |  |  |  |  |  |  |
| adminListUserVerifications | GET | /admin/user-verifications |  | ✓ | ✓ | ✓ | ✓ |  |  |  |  |
| listConversationMessages | GET | /conversations/:param/messages | ✓ |  | ✓ | ✓ | ✓ |  |  |  |  |
| listMyListings | GET | /listings | ✓ |  | ✓ |  |  |  |  |  |  |
| getListingById | GET | /listings/:param | ✓ |  | ✓ |  |  |  |  |  |  |
| getMe | GET | /me | ✓ |  | ✓ |  | ✓ |  |  |  |  |
| listMyConversations | GET | /me/conversations | ✓ |  | ✓ | ✓ | ✓ |  |  |  |  |
| listMyFavoriteListings | GET | /me/favorites | ✓ |  | ✓ |  |  |  |  |  |  |
| getMyRecommendedListings | GET | /me/recommendations/listings | ✓ |  | ✓ | ✓ | ✓ |  |  |  |  |
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
| getPublicTradeRulesConfig | GET | /public/config/trade-rules | ✓ |  | ✓ |  |  |  |  |  |  |
| getPublicListingById | GET | /public/listings/:param | ✓ |  | ✓ |  |  | ✓ |  |  |  |
| listPublicOrganizations | GET | /public/organizations | ✓ |  | ✓ | ✓ | ✓ |  |  |  |  |
| getPublicOrganizationById | GET | /public/organizations/:param | ✓ |  | ✓ |  |  |  |  |  |  |
| listRegions | GET | /regions | ✓ |  | ✓ |  |  |  |  |  |  |
| searchInventorRankings | GET | /search/inventors | ✓ |  | ✓ | ✓ | ✓ |  |  |  |  |
| searchListings | GET | /search/listings | ✓ |  | ✓ | ✓ | ✓ | ✓ |  |  |  |
| adminUpdateRegion | PATCH | /admin/regions/:param |  | ✓ | ✓ |  |  |  |  |  |  |
| updateListing | PATCH | /listings/:param | ✓ |  | ✓ |  |  |  |  |  |  |
| updateMe | PATCH | /me | ✓ |  | ✓ |  |  |  |  |  |  |
| adminCreateIndustryTag | POST | /admin/industry-tags |  | ✓ | ✓ |  |  |  |  |  |  |
| adminApproveListing | POST | /admin/listings/:param/approve |  | ✓ | ✓ |  |  |  |  |  |  |
| adminRejectListing | POST | /admin/listings/:param/reject |  | ✓ | ✓ |  |  |  |  |  |  |
| adminConfirmContractSigned | POST | /admin/orders/:param/milestones/contract-signed |  | ✓ | ✓ |  |  |  | ✓ |  |  |
| adminConfirmTransferCompleted | POST | /admin/orders/:param/milestones/transfer-completed |  | ✓ | ✓ |  |  |  | ✓ |  |  |
| adminConfirmManualPayout | POST | /admin/orders/:param/payouts/manual |  | ✓ | ✓ |  | ✓ |  |  |  |  |
| adminImportPatentMapExcel | POST | /admin/patent-map/import |  | ✓ | ✓ |  |  |  |  |  |  |
| adminApproveRefundRequest | POST | /admin/refund-requests/:param/approve |  | ✓ | ✓ |  |  |  |  |  | ✓ |
| adminRejectRefundRequest | POST | /admin/refund-requests/:param/reject |  | ✓ | ✓ |  |  |  |  |  |  |
| adminCreateRegion | POST | /admin/regions |  | ✓ | ✓ |  |  |  |  |  |  |
| adminApproveUserVerification | POST | /admin/user-verifications/:param/approve |  | ✓ | ✓ |  |  |  |  |  |  |
| adminRejectUserVerification | POST | /admin/user-verifications/:param/reject |  | ✓ | ✓ |  |  |  |  |  |  |
| authSmsSend | POST | /auth/sms/send | ✓ |  | ✓ |  |  |  |  |  |  |
| authSmsVerify | POST | /auth/sms/verify | ✓ |  | ✓ |  |  |  |  |  |  |
| authWechatMpLogin | POST | /auth/wechat/mp-login | ✓ |  | ✓ |  |  |  |  |  |  |
| sendConversationMessage | POST | /conversations/:param/messages | ✓ |  | ✓ |  | ✓ |  |  |  |  |
| markConversationRead | POST | /conversations/:param/read | ✓ |  | ✓ |  | ✓ |  |  |  |  |
| uploadFile | POST | /files | ✓ | ✓ | ✓ |  | ✓ |  |  |  |  |
| createListing | POST | /listings | ✓ |  | ✓ |  |  |  |  |  |  |
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
| wechatPayNotify | POST | /webhooks/wechatpay/notify |  |  |  |  |  |  |  |  |  |
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
