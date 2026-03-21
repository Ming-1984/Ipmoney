# OpenAPI 前端 / Mock 覆盖报告（自动生成）

> 由 `scripts/audit-coverage.mjs` 生成；用于覆盖度审计与防遗忘。

## 1. 汇总

- OpenAPI operations：156
- 前端已使用（Client）：62
- 前端已使用（Admin）：91
- fixtures 场景数：7

## 2. 关键差异（需人工确认与回填）

- 前端使用但 OpenAPI 未定义：0
- OpenAPI 定义但前端未使用：5
  - GET /admin/ai/parse-results
  - GET /admin/ai/parse-results/:param
  - PATCH /admin/ai/parse-results/:param
  - POST /ai/agent/query
  - POST /ai/parse-results/:param/feedback
- 前端已使用但 happy fixtures 未覆盖（会回落到 Prism）：150
  - DELETE /admin/orders/:param/invoice
  - DELETE /admin/rbac/roles/:param
  - DELETE /comments/:param
  - DELETE /listings/:param/favorites
  - DELETE /me/addresses/:param
  - GET /admin/alerts
  - GET /admin/audit-logs
  - GET /admin/cases
  - GET /admin/cases/:param
  - GET /admin/comments
  - GET /admin/config/alerts
  - GET /admin/config/banner
  - GET /admin/config/customer-service
  - GET /admin/config/hot-search
  - GET /admin/config/recommendation
  - GET /admin/config/sensitive-words
  - GET /admin/config/taxonomy
  - GET /admin/config/trade-rules
  - GET /admin/industry-tags
  - GET /admin/listings
  - GET /admin/listings/:param
  - GET /admin/listings/:param/audit-logs
  - GET /admin/listings/:param/materials
  - GET /admin/orders/:param
  - GET /admin/orders/:param/settlement
  - GET /admin/patent-maintenance/schedules
  - GET /admin/patent-maintenance/schedules/:param
  - GET /admin/patent-maintenance/tasks
  - GET /admin/patents
  - GET /admin/patents/:param
  - GET /admin/rbac/permissions
  - GET /admin/rbac/roles
  - GET /admin/rbac/users
  - GET /admin/regions
  - GET /admin/reports/finance/summary
  - GET /admin/tech-managers
  - GET /admin/user-verifications
  - GET /admin/user-verifications/:param/audit-logs
  - GET /admin/user-verifications/:param/materials
  - GET /contracts
  - GET /conversations/:param/messages
  - GET /files/:param
  - GET /files/:param/preview
  - GET /health
  - GET /invoices
  - GET /listings
  - GET /listings/:param
  - GET /me
  - GET /me/addresses
  - GET /me/conversations
  - ...（其余 100 条略）

## 3. 覆盖明细（按 operation）

| operationId | method | path | Client | Admin | happy | empty | error | edge | order_conflict | payment_callback_replay | refund_failed |
|---|---|---|---|---|---|---|---|---|---|---|---|
| adminDeleteOrderInvoice | DELETE | /admin/orders/:param/invoice |  | ✓ |  |  |  |  |  |  |  |
| adminDeleteRbacRole | DELETE | /admin/rbac/roles/:param |  | ✓ |  |  |  |  |  |  |  |
| deleteComment | DELETE | /comments/:param | ✓ |  |  |  |  |  |  |  |  |
| unfavoriteListing | DELETE | /listings/:param/favorites | ✓ |  |  |  |  |  |  |  |  |
| deleteMyAddress | DELETE | /me/addresses/:param | ✓ |  |  |  |  |  |  |  |  |
| adminListAiParseResults | GET | /admin/ai/parse-results |  |  |  |  |  |  |  |  |  |
| adminGetAiParseResult | GET | /admin/ai/parse-results/:param |  |  |  |  |  |  |  |  |  |
| adminListAlertEvents | GET | /admin/alerts |  | ✓ |  |  |  |  |  |  |  |
| adminListAuditLogs | GET | /admin/audit-logs |  | ✓ |  |  |  |  |  |  |  |
| adminListCases | GET | /admin/cases |  | ✓ |  |  |  |  |  |  |  |
| adminGetCaseById | GET | /admin/cases/:param |  | ✓ |  |  |  |  |  |  |  |
| adminListComments | GET | /admin/comments |  | ✓ |  |  |  |  |  |  |  |
| adminGetAlertConfig | GET | /admin/config/alerts |  | ✓ |  |  |  |  |  |  |  |
| adminGetBannerConfig | GET | /admin/config/banner |  | ✓ |  |  |  |  |  |  |  |
| adminGetCustomerServiceConfig | GET | /admin/config/customer-service |  | ✓ |  |  |  |  |  |  |  |
| adminGetHotSearchConfig | GET | /admin/config/hot-search |  | ✓ |  |  |  |  |  |  |  |
| adminGetRecommendationConfig | GET | /admin/config/recommendation |  | ✓ |  |  |  |  |  |  |  |
| adminGetSensitiveWordsConfig | GET | /admin/config/sensitive-words |  | ✓ |  |  |  |  |  |  |  |
| adminGetTaxonomyConfig | GET | /admin/config/taxonomy |  | ✓ |  |  |  |  |  |  |  |
| adminGetTradeRulesConfig | GET | /admin/config/trade-rules |  | ✓ |  |  |  |  |  |  |  |
| adminListIndustryTags | GET | /admin/industry-tags |  | ✓ |  |  |  |  |  |  |  |
| adminListListingsForAudit | GET | /admin/listings |  | ✓ |  |  |  |  |  |  |  |
| adminGetListingById | GET | /admin/listings/:param |  | ✓ |  |  |  |  |  |  |  |
| adminGetListingAuditLogs | GET | /admin/listings/:param/audit-logs |  | ✓ |  |  |  |  |  |  |  |
| adminGetListingMaterials | GET | /admin/listings/:param/materials |  | ✓ |  |  |  |  |  |  |  |
| adminGetOrderById | GET | /admin/orders/:param |  | ✓ |  |  |  |  |  |  |  |
| adminGetOrderSettlement | GET | /admin/orders/:param/settlement |  | ✓ |  |  |  |  |  |  |  |
| adminListPatentMaintenanceSchedules | GET | /admin/patent-maintenance/schedules |  | ✓ |  |  |  |  |  |  |  |
| adminGetPatentMaintenanceSchedule | GET | /admin/patent-maintenance/schedules/:param |  | ✓ |  |  |  |  |  |  |  |
| adminListPatentMaintenanceTasks | GET | /admin/patent-maintenance/tasks |  | ✓ |  |  |  |  |  |  |  |
| adminListPatents | GET | /admin/patents |  | ✓ |  |  |  |  |  |  |  |
| adminGetPatentById | GET | /admin/patents/:param |  | ✓ |  |  |  |  |  |  |  |
| adminListRbacPermissions | GET | /admin/rbac/permissions |  | ✓ |  |  |  |  |  |  |  |
| adminListRbacRoles | GET | /admin/rbac/roles |  | ✓ |  |  |  |  |  |  |  |
| adminListRbacUsers | GET | /admin/rbac/users |  | ✓ |  |  |  |  |  |  |  |
| adminListRegions | GET | /admin/regions |  | ✓ |  |  |  |  |  |  |  |
| adminGetFinanceReportSummary | GET | /admin/reports/finance/summary |  | ✓ |  |  |  |  |  |  |  |
| adminListTechManagers | GET | /admin/tech-managers |  | ✓ |  |  |  |  |  |  |  |
| adminListUserVerifications | GET | /admin/user-verifications |  | ✓ |  |  |  |  |  |  |  |
| adminGetVerificationAuditLogs | GET | /admin/user-verifications/:param/audit-logs |  | ✓ |  |  |  |  |  |  |  |
| adminGetVerificationMaterials | GET | /admin/user-verifications/:param/materials |  | ✓ |  |  |  |  |  |  |  |
| listContracts | GET | /contracts | ✓ |  |  |  |  |  |  |  |  |
| listConversationMessages | GET | /conversations/:param/messages | ✓ |  |  |  |  |  |  |  |  |
| downloadFile | GET | /files/:param | ✓ |  |  |  |  |  |  |  |  |
| previewFile | GET | /files/:param/preview | ✓ |  |  |  |  |  |  |  |  |
| getHealth | GET | /health |  | ✓ |  |  |  |  |  |  |  |
| listMyInvoices | GET | /invoices | ✓ |  |  |  |  |  |  |  |  |
| listMyListings | GET | /listings | ✓ |  |  |  |  |  |  |  |  |
| getListingById | GET | /listings/:param | ✓ |  |  |  |  |  |  |  |  |
| getMe | GET | /me | ✓ |  |  |  |  |  |  |  |  |
| listMyAddresses | GET | /me/addresses | ✓ |  |  |  |  |  |  |  |  |
| listMyConversations | GET | /me/conversations | ✓ |  |  |  |  |  |  |  |  |
| listMyFavoriteListings | GET | /me/favorites | ✓ |  |  |  |  |  |  |  |  |
| getMyRecommendedListings | GET | /me/recommendations/listings | ✓ |  |  |  |  |  |  |  |  |
| getMyVerification | GET | /me/verification | ✓ |  |  |  |  |  |  |  |  |
| listMyNotifications | GET | /notifications | ✓ |  |  |  |  |  |  |  |  |
| getNotificationById | GET | /notifications/:param | ✓ |  |  |  |  |  |  |  |  |
| listMyOrders | GET | /orders | ✓ | ✓ |  |  |  |  |  |  |  |
| getOrderById | GET | /orders/:param | ✓ |  |  |  |  |  |  |  |  |
| getOrderCase | GET | /orders/:param/case | ✓ |  |  |  |  |  |  |  |  |
| getOrderInvoice | GET | /orders/:param/invoice | ✓ | ✓ |  |  |  |  |  |  |  |
| listRefundRequestsByOrder | GET | /orders/:param/refund-requests | ✓ | ✓ |  |  |  |  |  |  |  |
| getPatentById | GET | /patents/:param | ✓ |  |  |  |  |  |  |  |  |
| getPublicCustomerServiceConfig | GET | /public/config/customer-service | ✓ |  |  |  |  |  |  |  |  |
| getPublicTradeRulesConfig | GET | /public/config/trade-rules | ✓ |  |  |  |  |  |  |  |  |
| listPublicIndustryTags | GET | /public/industry-tags | ✓ |  |  |  |  |  |  |  |  |
| getPublicListingById | GET | /public/listings/:param | ✓ |  |  |  |  |  |  |  |  |
| listPublicListingComments | GET | /public/listings/:param/comments | ✓ |  |  |  |  |  |  |  |  |
| listPublicOrganizations | GET | /public/organizations | ✓ |  |  |  |  |  |  |  |  |
| getPublicOrganizationById | GET | /public/organizations/:param | ✓ |  |  |  |  |  |  |  |  |
| getPublicTechManagerById | GET | /public/tech-managers/:param | ✓ |  |  |  |  |  |  |  |  |
| listRegions | GET | /regions | ✓ |  |  |  |  |  |  |  |  |
| searchInventorRankings | GET | /search/inventors | ✓ |  |  |  |  |  |  |  |  |
| searchListings | GET | /search/listings | ✓ |  |  |  |  |  |  |  |  |
| searchTechManagers | GET | /search/tech-managers | ✓ |  |  |  |  |  |  |  |  |
| adminUpdateAiParseResult | PATCH | /admin/ai/parse-results/:param |  |  |  |  |  |  |  |  |  |
| adminUpdateComment | PATCH | /admin/comments/:param |  | ✓ |  |  |  |  |  |  |  |
| adminUpdateListing | PATCH | /admin/listings/:param |  | ✓ |  |  |  |  |  |  |  |
| adminUpdatePatentMaintenanceSchedule | PATCH | /admin/patent-maintenance/schedules/:param |  | ✓ |  |  |  |  |  |  |  |
| adminUpdatePatentMaintenanceTask | PATCH | /admin/patent-maintenance/tasks/:param |  | ✓ |  |  |  |  |  |  |  |
| adminUpdatePatent | PATCH | /admin/patents/:param |  | ✓ |  |  |  |  |  |  |  |
| adminUpdateRbacRole | PATCH | /admin/rbac/roles/:param |  | ✓ |  |  |  |  |  |  |  |
| adminUpdateRbacUserRoles | PATCH | /admin/rbac/users/:param |  | ✓ |  |  |  |  |  |  |  |
| adminUpdateRegion | PATCH | /admin/regions/:param |  | ✓ |  |  |  |  |  |  |  |
| adminUpdateTechManager | PATCH | /admin/tech-managers/:param |  | ✓ |  |  |  |  |  |  |  |
| updateComment | PATCH | /comments/:param | ✓ |  |  |  |  |  |  |  |  |
| updateListing | PATCH | /listings/:param | ✓ |  |  |  |  |  |  |  |  |
| updateMe | PATCH | /me | ✓ |  |  |  |  |  |  |  |  |
| updateMyAddress | PATCH | /me/addresses/:param | ✓ |  |  |  |  |  |  |  |  |
| adminAcknowledgeAlertEvent | POST | /admin/alerts/:param/ack |  | ✓ |  |  |  |  |  |  |  |
| adminCreateCase | POST | /admin/cases |  | ✓ |  |  |  |  |  |  |  |
| adminAssignCase | POST | /admin/cases/:param/assign |  | ✓ |  |  |  |  |  |  |  |
| adminAddCaseEvidence | POST | /admin/cases/:param/evidence |  | ✓ |  |  |  |  |  |  |  |
| adminAddCaseNote | POST | /admin/cases/:param/notes |  | ✓ |  |  |  |  |  |  |  |
| adminUpdateCaseSla | POST | /admin/cases/:param/sla |  | ✓ |  |  |  |  |  |  |  |
| adminUpdateCaseStatus | POST | /admin/cases/:param/status |  | ✓ |  |  |  |  |  |  |  |
| adminCreateIndustryTag | POST | /admin/industry-tags |  | ✓ |  |  |  |  |  |  |  |
| adminCreateListing | POST | /admin/listings |  | ✓ |  |  |  |  |  |  |  |
| adminApproveListing | POST | /admin/listings/:param/approve |  | ✓ |  |  |  |  |  |  |  |
| adminOffShelfListing | POST | /admin/listings/:param/off-shelf |  | ✓ |  |  |  |  |  |  |  |
| adminPublishListing | POST | /admin/listings/:param/publish |  | ✓ |  |  |  |  |  |  |  |
| adminRejectListing | POST | /admin/listings/:param/reject |  | ✓ |  |  |  |  |  |  |  |
| adminIssueOrderInvoice | POST | /admin/orders/:param/invoice |  | ✓ |  |  |  |  |  |  |  |
| adminConfirmContractSigned | POST | /admin/orders/:param/milestones/contract-signed |  | ✓ |  |  |  |  |  |  |  |
| adminConfirmTransferCompleted | POST | /admin/orders/:param/milestones/transfer-completed |  | ✓ |  |  |  |  |  |  |  |
| adminManualConfirmPayment | POST | /admin/orders/:param/payments/manual |  | ✓ |  |  |  |  |  |  |  |
| adminConfirmManualPayout | POST | /admin/orders/:param/payouts/manual |  | ✓ |  |  |  |  |  |  |  |
| adminCreatePatentMaintenanceSchedule | POST | /admin/patent-maintenance/schedules |  | ✓ |  |  |  |  |  |  |  |
| adminCreatePatentMaintenanceTask | POST | /admin/patent-maintenance/tasks |  | ✓ |  |  |  |  |  |  |  |
| adminCreatePatent | POST | /admin/patents |  | ✓ |  |  |  |  |  |  |  |
| adminCreateRbacRole | POST | /admin/rbac/roles |  | ✓ |  |  |  |  |  |  |  |
| adminApproveRefundRequest | POST | /admin/refund-requests/:param/approve |  | ✓ |  |  |  |  |  |  |  |
| adminCompleteRefundRequest | POST | /admin/refund-requests/:param/complete |  | ✓ |  |  |  |  |  |  |  |
| adminRejectRefundRequest | POST | /admin/refund-requests/:param/reject |  | ✓ |  |  |  |  |  |  |  |
| adminCreateRegion | POST | /admin/regions |  | ✓ |  |  |  |  |  |  |  |
| adminExportFinanceReport | POST | /admin/reports/finance/export |  | ✓ |  |  |  |  |  |  |  |
| adminApproveUserVerification | POST | /admin/user-verifications/:param/approve |  | ✓ |  |  |  |  |  |  |  |
| adminRejectUserVerification | POST | /admin/user-verifications/:param/reject |  | ✓ |  |  |  |  |  |  |  |
| createAiAgentQuery | POST | /ai/agent/query |  |  |  |  |  |  |  |  |  |
| createAiParseFeedback | POST | /ai/parse-results/:param/feedback |  |  |  |  |  |  |  |  |  |
| authSmsSend | POST | /auth/sms/send | ✓ |  |  |  |  |  |  |  |  |
| authSmsVerify | POST | /auth/sms/verify | ✓ |  |  |  |  |  |  |  |  |
| authWechatMpLogin | POST | /auth/wechat/mp-login | ✓ |  |  |  |  |  |  |  |  |
| authWechatPhoneBind | POST | /auth/wechat/phone-bind | ✓ |  |  |  |  |  |  |  |  |
| uploadContractPdf | POST | /contracts/:param/upload | ✓ |  |  |  |  |  |  |  |  |
| sendConversationMessage | POST | /conversations/:param/messages | ✓ |  |  |  |  |  |  |  |  |
| markConversationRead | POST | /conversations/:param/read | ✓ |  |  |  |  |  |  |  |  |
| uploadFile | POST | /files |  | ✓ |  |  |  |  |  |  |  |
| createFileTemporaryAccess | POST | /files/:param/temporary-access | ✓ |  |  |  |  |  |  |  |  |
| createListing | POST | /listings | ✓ |  |  |  |  |  |  |  |  |
| createListingComment | POST | /listings/:param/comments | ✓ |  |  |  |  |  |  |  |  |
| createListingConsultation | POST | /listings/:param/consultations | ✓ |  |  |  |  |  |  |  |  |
| upsertListingConversation | POST | /listings/:param/conversations | ✓ |  |  |  |  |  |  |  |  |
| favoriteListing | POST | /listings/:param/favorites | ✓ |  |  |  |  |  |  |  |  |
| offShelfListing | POST | /listings/:param/off-shelf | ✓ |  |  |  |  |  |  |  |  |
| submitListing | POST | /listings/:param/submit | ✓ |  |  |  |  |  |  |  |  |
| createMyAddress | POST | /me/addresses | ✓ |  |  |  |  |  |  |  |  |
| submitMyVerification | POST | /me/verification | ✓ |  |  |  |  |  |  |  |  |
| createOrder | POST | /orders | ✓ |  |  |  |  |  |  |  |  |
| requestOrderInvoice | POST | /orders/:param/invoice-requests | ✓ |  |  |  |  |  |  |  |  |
| createPaymentIntent | POST | /orders/:param/payment-intents | ✓ |  |  |  |  |  |  |  |  |
| createRefundRequest | POST | /orders/:param/refund-requests | ✓ |  |  |  |  |  |  |  |  |
| normalizePatentNumber | POST | /patents/normalize |  | ✓ |  |  |  |  |  |  |  |
| upsertTechManagerConversation | POST | /tech-managers/:param/conversations | ✓ |  |  |  |  |  |  |  |  |
| wechatPayNotify | POST | /webhooks/wechatpay/notify |  |  |  |  |  |  |  |  |  |
| adminUpdateAlertConfig | PUT | /admin/config/alerts |  | ✓ |  |  |  |  |  |  |  |
| adminUpdateBannerConfig | PUT | /admin/config/banner |  | ✓ |  |  |  |  |  |  |  |
| adminUpdateCustomerServiceConfig | PUT | /admin/config/customer-service |  | ✓ |  |  |  |  |  |  |  |
| adminUpdateHotSearchConfig | PUT | /admin/config/hot-search |  | ✓ |  |  |  |  |  |  |  |
| adminUpdateRecommendationConfig | PUT | /admin/config/recommendation |  | ✓ |  |  |  |  |  |  |  |
| adminUpdateSensitiveWordsConfig | PUT | /admin/config/sensitive-words |  | ✓ |  |  |  |  |  |  |  |
| adminUpdateTaxonomyConfig | PUT | /admin/config/taxonomy |  | ✓ |  |  |  |  |  |  |  |
| adminUpdateTradeRulesConfig | PUT | /admin/config/trade-rules |  | ✓ |  |  |  |  |  |  |  |
| adminSetListingFeatured | PUT | /admin/listings/:param/featured |  | ✓ |  |  |  |  |  |  |  |
| adminUpsertOrderInvoice | PUT | /admin/orders/:param/invoice |  | ✓ |  |  |  |  |  |  |  |
| adminSetRegionIndustryTags | PUT | /admin/regions/:param/industry-tags |  | ✓ |  |  |  |  |  |  |  |

## 4. 使用说明

- 本报告只做“接口层”覆盖审计：OpenAPI -> 前端调用 -> fixtures keys。
- PRD 页面/业务规则覆盖请结合 `docs/engineering/traceability-matrix.md` 的“页面能力矩阵”。
- 若某接口未在 happy fixtures 覆盖，mock-api 会回落到 Prism 生成响应，但不保证演示数据质量。
