# Ipmoney 甲方交付总册（唯一对接版，小程序 + 管理后台，字段级）

> 文档日期：2026-04-02
>
> 生成时间：2026-04-02 12:54:16
>
> 数据基线：`apps/client/src/app.config.ts`、`apps/admin-web/src/router.tsx`、`docs/api/openapi.yaml`、`apps/api/prisma/schema.prisma`、`docs/engineering/openapi-backend-diff.md`
>
> 阅读建议：先看第 1-2 章（范围与一致性），再按第 3-7 章查看页面、接口与数据库字段明细。

## 1. 文档说明（给甲方）

- 本文档用于甲乙双方字段级交接，覆盖：小程序页面范围、管理后台路由范围、接口字段范围、数据库字段范围。
- 口径目标：做到“页面-接口-数据”可追溯，并与当前代码实现保持一致。
- 交付形式：Markdown（可编辑）+ PDF（评审归档）。

## 2. 一致性结论（文档-实现）

- 小程序页面：**52**（main 5, subpackage 47）
- 管理后台路由：**25**
- OpenAPI 接口：**245**（Admin 146, Mini/H5 99）
- OpenAPI 引用 Schema：**297**
- Prisma 模型：**59**
- OpenAPI 与后端实现审计：OpenAPI **245** / Controller **245**，OpenAPI-only **0**，Controller-only **0**。

编制依据（实践参考）：

- C4 架构图分层表达（Context/Container/Component）：<https://c4model.com/>
- OpenAPI 推荐使用 3.1.1（官方补丁发布说明）：<https://www.openapis.org/blog/2024/10/25/announcing-openapi-specification-patch-releases>
- 需求工程标准（ISO/IEC/IEEE 29148）：<https://standards.ieee.org/content/ieee-standards/en/standard/29148-2018.html>
- IEEE 830-1998 已被 29148 取代（IEEE 页面）：<https://standards.ieee.org/ieee/830/1222/>
- RTM 模板实践（Texas DIR）：<https://dir.texas.gov/resource-library-item/requirements-traceability-matrix-template>

## 3. 小程序页面清单（全量）

| 页面编号 | 包名 | 页面路径 | 完整路径 |
|---|---|---|---|
| MP-001 | main | `pages/home/index` | `pages/home/index` |
| MP-002 | main | `pages/tech-managers/index` | `pages/tech-managers/index` |
| MP-003 | main | `pages/publish/index` | `pages/publish/index` |
| MP-004 | main | `pages/messages/index` | `pages/messages/index` |
| MP-005 | main | `pages/me/index` | `pages/me/index` |
| MP-006 | subpackages/search | `index` | `subpackages/search/index` |
| MP-007 | subpackages/patent | `detail/index` | `subpackages/patent/detail/index` |
| MP-008 | subpackages/orders | `index` | `subpackages/orders/index` |
| MP-009 | subpackages/orders | `detail/index` | `subpackages/orders/detail/index` |
| MP-010 | subpackages/checkout | `deposit-pay/index` | `subpackages/checkout/deposit-pay/index` |
| MP-011 | subpackages/checkout | `deposit-success/index` | `subpackages/checkout/deposit-success/index` |
| MP-012 | subpackages/checkout | `final-pay/index` | `subpackages/checkout/final-pay/index` |
| MP-013 | subpackages/checkout | `final-success/index` | `subpackages/checkout/final-success/index` |
| MP-014 | subpackages/publish | `patent/index` | `subpackages/publish/patent/index` |
| MP-015 | subpackages/publish | `achievement/index` | `subpackages/publish/achievement/index` |
| MP-016 | subpackages/messages | `chat/index` | `subpackages/messages/chat/index` |
| MP-017 | subpackages/support | `index` | `subpackages/support/index` |
| MP-018 | subpackages/support | `faq/index` | `subpackages/support/faq/index` |
| MP-019 | subpackages/support | `faq/detail/index` | `subpackages/support/faq/detail/index` |
| MP-020 | subpackages/support | `contact/index` | `subpackages/support/contact/index` |
| MP-021 | subpackages/legal | `privacy/index` | `subpackages/legal/privacy/index` |
| MP-022 | subpackages/legal | `terms/index` | `subpackages/legal/terms/index` |
| MP-023 | subpackages/legal | `privacy-guide/index` | `subpackages/legal/privacy-guide/index` |
| MP-024 | subpackages/onboarding | `choose-identity/index` | `subpackages/onboarding/choose-identity/index` |
| MP-025 | subpackages/onboarding | `verification-form/index` | `subpackages/onboarding/verification-form/index` |
| MP-026 | subpackages/notifications | `index` | `subpackages/notifications/index` |
| MP-027 | subpackages/notifications | `detail/index` | `subpackages/notifications/detail/index` |
| MP-028 | subpackages/home-announcements | `index` | `subpackages/home-announcements/index` |
| MP-029 | subpackages/home-announcements | `detail/index` | `subpackages/home-announcements/detail/index` |
| MP-030 | subpackages/listing | `detail/index` | `subpackages/listing/detail/index` |
| MP-031 | subpackages/achievement | `detail/index` | `subpackages/achievement/detail/index` |
| MP-032 | subpackages/favorites | `index` | `subpackages/favorites/index` |
| MP-033 | subpackages/organizations | `index` | `subpackages/organizations/index` |
| MP-034 | subpackages/organizations | `detail/index` | `subpackages/organizations/detail/index` |
| MP-035 | subpackages/inventors | `index` | `subpackages/inventors/index` |
| MP-036 | subpackages/patent-map | `index` | `subpackages/patent-map/index` |
| MP-037 | subpackages/tech-managers | `detail/index` | `subpackages/tech-managers/detail/index` |
| MP-038 | subpackages/trade-rules | `index` | `subpackages/trade-rules/index` |
| MP-039 | subpackages/contracts | `index` | `subpackages/contracts/index` |
| MP-040 | subpackages/invoices | `index` | `subpackages/invoices/index` |
| MP-041 | subpackages/addresses | `index` | `subpackages/addresses/index` |
| MP-042 | subpackages/addresses | `edit/index` | `subpackages/addresses/edit/index` |
| MP-043 | subpackages/my-listings | `index` | `subpackages/my-listings/index` |
| MP-044 | subpackages/my-achievements | `index` | `subpackages/my-achievements/index` |
| MP-045 | subpackages/patent-claims | `index` | `subpackages/patent-claims/index` |
| MP-046 | subpackages/maintenance | `index` | `subpackages/maintenance/index` |
| MP-047 | subpackages/settings | `notifications/index` | `subpackages/settings/notifications/index` |
| MP-048 | subpackages/about | `index` | `subpackages/about/index` |
| MP-049 | subpackages/profile | `edit/index` | `subpackages/profile/edit/index` |
| MP-050 | subpackages/login | `index` | `subpackages/login/index` |
| MP-051 | subpackages/ipc-picker | `index` | `subpackages/ipc-picker/index` |
| MP-052 | subpackages/media | `video-preview/index` | `subpackages/media/video-preview/index` |

## 4. 管理后台路由清单（全量）

| 路由编号 | 类型 | 路由路径 |
|---|---|---|
| ADM-001 | path | `/login` |
| ADM-002 | path | `/` |
| ADM-003 | path | `verifications` |
| ADM-004 | path | `listings` |
| ADM-005 | path | `tech-managers` |
| ADM-006 | path | `orders` |
| ADM-007 | path | `orders/:orderId` |
| ADM-008 | path | `cases` |
| ADM-009 | path | `refunds` |
| ADM-010 | path | `settlements` |
| ADM-011 | path | `invoices` |
| ADM-012 | path | `reports` |
| ADM-013 | path | `comments` |
| ADM-014 | path | `alerts` |
| ADM-015 | path | `audit-logs` |
| ADM-016 | path | `rbac` |
| ADM-017 | path | `config` |
| ADM-018 | path | `home-announcements` |
| ADM-019 | path | `maintenance` |
| ADM-020 | path | `regions` |
| ADM-021 | path | `patents` |
| ADM-022 | path | `patents/operations` |
| ADM-023 | path | `patents/claims` |
| ADM-024 | path | `conversations/platform` |
| ADM-025 | index | `/` |

## 5. 接口清单（小程序 + 管理后台）

| 端别 | 方法 | 路径 | OperationId | 鉴权 | 标签 | 关联 Schema |
|---|---|---|---|---|---|---|
| Admin | GET | `/admin/achievements` | `adminListAchievements` | Y | Admin, Achievements | AuditStatus, BadRequest, ContentSource, ContentStatusParam, Forbidden, Page, PageSize, PagedAchievementSummary, Q, RegionCode, Unauthorized, Uuid |
| Admin | POST | `/admin/achievements` | `adminCreateAchievement` | Y | Admin, Achievements | AchievementAdminCreateRequest, AchievementEdit, BadRequest, Forbidden, Unauthorized |
| Admin | GET | `/admin/achievements/{achievementId}` | `adminGetAchievementById` | Y | Admin, Achievements | AchievementEdit, AchievementId, Forbidden, NotFound, Unauthorized |
| Admin | PATCH | `/admin/achievements/{achievementId}` | `adminUpdateAchievement` | Y | Admin, Achievements | AchievementAdminUpdateRequest, AchievementEdit, AchievementId, BadRequest, Forbidden, NotFound, Unauthorized |
| Admin | POST | `/admin/achievements/{achievementId}/approve` | `adminApproveAchievement` | Y | Admin, Achievements | AchievementId, AchievementRecord, BadRequest, Forbidden, NotFound, Unauthorized |
| Admin | GET | `/admin/achievements/{achievementId}/audit-logs` | `adminGetAchievementAuditLogs` | Y | Admin, Achievements | AchievementId, AuditLogList, Forbidden, NotFound, Unauthorized |
| Admin | GET | `/admin/achievements/{achievementId}/materials` | `adminGetAchievementMaterials` | Y | Admin, Achievements | AchievementId, AuditMaterialList, Forbidden, NotFound, Unauthorized |
| Admin | POST | `/admin/achievements/{achievementId}/off-shelf` | `adminOffShelfAchievement` | Y | Admin, Achievements | AchievementId, AchievementRecord, Forbidden, NotFound, Unauthorized |
| Admin | POST | `/admin/achievements/{achievementId}/publish` | `adminPublishAchievement` | Y | Admin, Achievements | AchievementId, AchievementRecord, Forbidden, NotFound, Unauthorized |
| Admin | POST | `/admin/achievements/{achievementId}/reject` | `adminRejectAchievement` | Y | Admin, Achievements | AchievementId, AchievementRecord, BadRequest, Forbidden, NotFound, Unauthorized |
| Admin | GET | `/admin/ai/parse-results` | `adminListAiParseResults` | Y | Admin, AI | AiContentType, AiParseStatus, BadRequest, Forbidden, Page, PageSize, PagedAiParseResult, Unauthorized |
| Admin | GET | `/admin/ai/parse-results/{parseResultId}` | `adminGetAiParseResult` | Y | Admin, AI | AiParseResult, Forbidden, NotFound, ParseResultId, Unauthorized |
| Admin | PATCH | `/admin/ai/parse-results/{parseResultId}` | `adminUpdateAiParseResult` | Y | Admin, AI | AiParseResult, AiParseResultUpdateRequest, BadRequest, Forbidden, NotFound, ParseResultId, Unauthorized |
| Admin | GET | `/admin/alerts` | `adminListAlertEvents` | Y | Admin, Alerts | AlertChannel, AlertSeverity, AlertStatus, AlertTargetType, BadRequest, Forbidden, Page, PageSize, PagedAlertEvent, Unauthorized, Uuid |
| Admin | POST | `/admin/alerts/{alertId}/ack` | `adminAcknowledgeAlertEvent` | Y | Admin, Alerts | AlertEvent, AlertId, Forbidden, NotFound, Unauthorized |
| Admin | GET | `/admin/audit-logs` | `adminListAuditLogs` | Y | Admin | Forbidden, Page, PageSize, PagedAuditLog, Unauthorized |
| Admin | GET | `/admin/cases` | `adminListCases` | Y | Admin, Cases | BadRequest, CaseStatus, CaseType, Forbidden, Page, PageSize, PagedCase, Unauthorized |
| Admin | POST | `/admin/cases` | `adminCreateCase` | Y | Admin, Cases | BadRequest, CaseCreateRequest, CaseRecord, Forbidden, Unauthorized |
| Admin | GET | `/admin/cases/{caseId}` | `adminGetCaseById` | Y | Admin, Cases | CaseId, CaseRecord, Forbidden, NotFound, Unauthorized |
| Admin | POST | `/admin/cases/{caseId}/assign` | `adminAssignCase` | Y | Admin, Cases | BadRequest, CaseId, CaseRecord, Forbidden, NotFound, Unauthorized |
| Admin | POST | `/admin/cases/{caseId}/evidence` | `adminAddCaseEvidence` | Y | Admin, Cases | BadRequest, CaseId, CaseRecord, Forbidden, NotFound, Unauthorized, Uuid |
| Admin | POST | `/admin/cases/{caseId}/notes` | `adminAddCaseNote` | Y | Admin, Cases | BadRequest, CaseId, CaseRecord, Forbidden, NotFound, Unauthorized |
| Admin | POST | `/admin/cases/{caseId}/sla` | `adminUpdateCaseSla` | Y | Admin, Cases | BadRequest, CaseId, CaseRecord, Forbidden, NotFound, Unauthorized |
| Admin | POST | `/admin/cases/{caseId}/status` | `adminUpdateCaseStatus` | Y | Admin, Cases | BadRequest, CaseId, CaseRecord, CaseStatus, Forbidden, NotFound, Unauthorized |
| Admin | GET | `/admin/comments` | `adminListComments` | Y | Admin | BadRequest, CommentContentId, CommentContentType, CommentStatus, Forbidden, Page, PageSize, PagedComment, Q, Unauthorized |
| Admin | PATCH | `/admin/comments/{commentId}` | `adminUpdateComment` | Y | Admin | AdminCommentUpdateRequest, BadRequest, Comment, CommentId, Conflict, Forbidden, NotFound, Unauthorized |
| Admin | GET | `/admin/config/alerts` | `adminGetAlertConfig` | Y | Admin, Config, Alerts | AlertConfig, Forbidden, Unauthorized |
| Admin | PUT | `/admin/config/alerts` | `adminUpdateAlertConfig` | Y | Admin, Config, Alerts | AlertConfig, AlertConfigUpdateRequest, BadRequest, Forbidden, Unauthorized |
| Admin | GET | `/admin/config/banner` | `adminGetBannerConfig` | Y | Admin, Config | BannerConfig, Forbidden, Unauthorized |
| Admin | PUT | `/admin/config/banner` | `adminUpdateBannerConfig` | Y | Admin, Config | BadRequest, BannerConfig, Forbidden, Unauthorized |
| Admin | GET | `/admin/config/customer-service` | `adminGetCustomerServiceConfig` | Y | Admin, Config | CustomerServiceConfig, Forbidden, Unauthorized |
| Admin | PUT | `/admin/config/customer-service` | `adminUpdateCustomerServiceConfig` | Y | Admin, Config | BadRequest, CustomerServiceConfig, CustomerServiceConfigUpdateRequest, Unauthorized |
| Admin | GET | `/admin/config/home-announcements` | `adminGetHomeAnnouncementsConfig` | Y | Admin, Config | Forbidden, HomeAnnouncementConfig, Unauthorized |
| Admin | POST | `/admin/config/home-announcements/items` | `adminCreateHomeAnnouncementItem` | Y | Admin, Config | BadRequest, Forbidden, HomeAnnouncementItem, HomeAnnouncementItemCreateRequest, Unauthorized |
| Admin | DELETE | `/admin/config/home-announcements/items/{itemId}` | `adminDeleteHomeAnnouncementItem` | Y | Admin, Config | BadRequest, Forbidden, HomeAnnouncementItemDeleteResult, NotFound, Unauthorized |
| Admin | PUT | `/admin/config/home-announcements/items/{itemId}` | `adminUpdateHomeAnnouncementItem` | Y | Admin, Config | BadRequest, Forbidden, HomeAnnouncementItem, HomeAnnouncementItemUpdateRequest, NotFound, Unauthorized |
| Admin | POST | `/admin/config/home-announcements/items/{itemId}/offline` | `adminOfflineHomeAnnouncementItem` | Y | Admin, Config | Forbidden, HomeAnnouncementItem, NotFound, Unauthorized |
| Admin | POST | `/admin/config/home-announcements/items/{itemId}/publish` | `adminPublishHomeAnnouncementItem` | Y | Admin, Config | Forbidden, HomeAnnouncementItem, NotFound, Unauthorized |
| Admin | POST | `/admin/config/home-announcements/templates` | `adminCreateHomeAnnouncementTemplate` | Y | Admin, Config | BadRequest, Forbidden, HomeAnnouncementTemplate, HomeAnnouncementTemplateCreateRequest, Unauthorized |
| Admin | DELETE | `/admin/config/home-announcements/templates/{templateId}` | `adminDeleteHomeAnnouncementTemplate` | Y | Admin, Config | BadRequest, Forbidden, HomeAnnouncementTemplateDeleteResult, NotFound, Unauthorized |
| Admin | PUT | `/admin/config/home-announcements/templates/{templateId}` | `adminUpdateHomeAnnouncementTemplate` | Y | Admin, Config | BadRequest, Forbidden, HomeAnnouncementTemplate, HomeAnnouncementTemplateUpdateRequest, NotFound, Unauthorized |
| Admin | GET | `/admin/config/hot-search` | `adminGetHotSearchConfig` | Y | Admin, Config | Forbidden, HotSearchConfig, Unauthorized |
| Admin | PUT | `/admin/config/hot-search` | `adminUpdateHotSearchConfig` | Y | Admin, Config | BadRequest, Forbidden, HotSearchConfig, Unauthorized |
| Admin | GET | `/admin/config/recommendation` | `adminGetRecommendationConfig` | Y | Admin, Config | Forbidden, RecommendationConfig, Unauthorized |
| Admin | PUT | `/admin/config/recommendation` | `adminUpdateRecommendationConfig` | Y | Admin, Config | BadRequest, Forbidden, RecommendationConfig, RecommendationConfigUpdateRequest, Unauthorized |
| Admin | GET | `/admin/config/sensitive-words` | `adminGetSensitiveWordsConfig` | Y | Admin, Config | Forbidden, SensitiveWordsConfig, Unauthorized |
| Admin | PUT | `/admin/config/sensitive-words` | `adminUpdateSensitiveWordsConfig` | Y | Admin, Config | BadRequest, Forbidden, SensitiveWordsConfig, Unauthorized |
| Admin | GET | `/admin/config/taxonomy` | `adminGetTaxonomyConfig` | Y | Admin, Config | Forbidden, TaxonomyConfig, Unauthorized |
| Admin | PUT | `/admin/config/taxonomy` | `adminUpdateTaxonomyConfig` | Y | Admin, Config | BadRequest, Forbidden, TaxonomyConfig, Unauthorized |
| Admin | GET | `/admin/config/trade-rules` | `adminGetTradeRulesConfig` | Y | Admin, Config | Forbidden, TradeRulesConfig, Unauthorized |
| Admin | PUT | `/admin/config/trade-rules` | `adminUpdateTradeRulesConfig` | Y | Admin, Config | BadRequest, Forbidden, TradeRulesConfig, TradeRulesConfigUpdateRequest, Unauthorized |
| Admin | GET | `/admin/conversations/platform` | `adminListPlatformConversations` | Y | Admin, Messaging | BadRequest, Forbidden, ListingTopic, Page, PageSize, PagedConversationSummary, Q, Unauthorized |
| Admin | POST | `/admin/conversations/{conversationId}/agents` | `adminAssignPlatformConversationAgent` | Y | Admin, Messaging | BadRequest, ConversationAgentAssignment, ConversationAgentAssignmentRequest, ConversationId, Forbidden, NotFound, Unauthorized |
| Admin | DELETE | `/admin/conversations/{conversationId}/agents/{userId}` | `adminRemovePlatformConversationAgent` | Y | Admin, Messaging | BadRequest, ConversationAgentAssignment, ConversationAgentUserId, ConversationId, Forbidden, NotFound, Unauthorized |
| Admin | GET | `/admin/industry-tags` | `adminListIndustryTags` | Y | Admin, Regions | Forbidden, IndustryTag, Unauthorized |
| Admin | POST | `/admin/industry-tags` | `adminCreateIndustryTag` | Y | Admin, Regions | BadRequest, Conflict, Forbidden, IndustryTag, IndustryTagCreateRequest, Unauthorized |
| Admin | GET | `/admin/listings` | `adminListListingsForAudit` | Y | Admin | AuditStatus, BadRequest, ContentSource, Forbidden, ListingStatus, ListingTopic, Page, PageSize, PagedListing, Q, RegionCode, Unauthorized |
| Admin | POST | `/admin/listings` | `adminCreateListing` | Y | Admin | AdminListingCreateRequest, BadRequest, Forbidden, Listing, Unauthorized |
| Admin | GET | `/admin/listings/jobs/batch` | `adminListListingBatchJobs` | Y | Admin | BadRequest, Forbidden, ListingBatchActionParam, ListingJobStatusParam, Page, PageSize, PagedListingBatchJob, Unauthorized |
| Admin | POST | `/admin/listings/jobs/batch` | `adminCreateListingBatchJob` | Y | Admin | BadRequest, Conflict, Forbidden, IdempotencyKey, ListingBatchJob, ListingBatchJobCreateRequest, Unauthorized |
| Admin | GET | `/admin/listings/jobs/batch/{jobId}` | `adminGetListingBatchJob` | Y | Admin | BatchJobId, Forbidden, ListingBatchJob, NotFound, Unauthorized |
| Admin | GET | `/admin/listings/jobs/batch/{jobId}/error-file` | `adminGetListingBatchJobErrorFile` | Y | Admin | BatchJobId, Forbidden, ListingJobErrorFile, NotFound, Unauthorized |
| Admin | GET | `/admin/listings/jobs/batch/{jobId}/items` | `adminListListingBatchJobItems` | Y | Admin | BadRequest, BatchJobId, Forbidden, ListingBatchItemStatusParam, NotFound, Page, PageSize, PagedListingBatchJobItem, Unauthorized |
| Admin | GET | `/admin/listings/jobs/import` | `adminListListingImportJobs` | Y | Admin | BadRequest, Forbidden, ListingImportDuplicatePolicyParam, ListingJobStatusParam, Page, PageSize, PagedListingImportJob, Unauthorized |
| Admin | POST | `/admin/listings/jobs/import` | `adminCreateListingImportJob` | Y | Admin | BadRequest, Conflict, Forbidden, IdempotencyKey, ListingImportJob, ListingImportJobCreateRequest, Unauthorized |
| Admin | GET | `/admin/listings/jobs/import/{jobId}` | `adminGetListingImportJob` | Y | Admin | Forbidden, ImportJobId, ListingImportJob, NotFound, Unauthorized |
| Admin | GET | `/admin/listings/jobs/import/{jobId}/error-file` | `adminGetListingImportJobErrorFile` | Y | Admin | Forbidden, ImportJobId, ListingJobErrorFile, NotFound, Unauthorized |
| Admin | POST | `/admin/listings/jobs/import/{jobId}/execute` | `adminExecuteListingImportJob` | Y | Admin | BadRequest, Forbidden, ImportJobId, ListingImportJob, NotFound, Unauthorized |
| Admin | GET | `/admin/listings/jobs/import/{jobId}/rows` | `adminListListingImportJobRows` | Y | Admin | BadRequest, Forbidden, ImportJobId, ListingImportRowStatusParam, NotFound, Page, PageSize, PagedListingImportJobRow, Unauthorized |
| Admin | POST | `/admin/listings/jobs/import/{jobId}/validate` | `adminValidateListingImportJob` | Y | Admin | BadRequest, Forbidden, ImportJobId, ListingImportJob, NotFound, Unauthorized |
| Admin | GET | `/admin/listings/{listingId}` | `adminGetListingById` | Y | Admin | Forbidden, Listing, ListingId, NotFound, Unauthorized |
| Admin | PATCH | `/admin/listings/{listingId}` | `adminUpdateListing` | Y | Admin | AdminListingUpdateRequest, BadRequest, Forbidden, Listing, ListingId, NotFound, Unauthorized |
| Admin | POST | `/admin/listings/{listingId}/approve` | `adminApproveListing` | Y | Admin | Conflict, Forbidden, Listing, ListingId, NotFound, Unauthorized |
| Admin | GET | `/admin/listings/{listingId}/audit-logs` | `adminGetListingAuditLogs` | Y | Admin | AuditLogList, Forbidden, ListingId, NotFound, Unauthorized |
| Admin | PUT | `/admin/listings/{listingId}/featured` | `adminSetListingFeatured` | Y | Admin | BadRequest, Conflict, Forbidden, IdempotencyKey, Listing, ListingFeaturedUpdateRequest, ListingId, NotFound, Unauthorized |
| Admin | GET | `/admin/listings/{listingId}/materials` | `adminGetListingMaterials` | Y | Admin | AuditMaterialList, Forbidden, ListingId, NotFound, Unauthorized |
| Admin | POST | `/admin/listings/{listingId}/off-shelf` | `adminOffShelfListing` | Y | Admin | Forbidden, Listing, ListingId, NotFound, Unauthorized |
| Admin | POST | `/admin/listings/{listingId}/publish` | `adminPublishListing` | Y | Admin | Conflict, Forbidden, Listing, ListingId, NotFound, Unauthorized |
| Admin | POST | `/admin/listings/{listingId}/reject` | `adminRejectListing` | Y | Admin | Conflict, Forbidden, Listing, ListingId, NotFound, Unauthorized |
| Admin | GET | `/admin/orders/{orderId}` | `adminGetOrderById` | Y | Admin | Forbidden, NotFound, Order, OrderId, Unauthorized |
| Admin | DELETE | `/admin/orders/{orderId}/invoice` | `adminDeleteOrderInvoice` | Y | Admin | Conflict, Forbidden, IdempotencyKey, NotFound, OrderId, Unauthorized |
| Admin | POST | `/admin/orders/{orderId}/invoice` | `adminIssueOrderInvoice` | Y | Admin | BadRequest, Conflict, Forbidden, IdempotencyKey, NotFound, OrderId, OrderInvoiceIssueResponse, Unauthorized |
| Admin | PUT | `/admin/orders/{orderId}/invoice` | `adminUpsertOrderInvoice` | Y | Admin | BadRequest, Conflict, Forbidden, IdempotencyKey, NotFound, OrderId, OrderInvoice, OrderInvoiceUpsertRequest, Unauthorized |
| Admin | POST | `/admin/orders/{orderId}/milestones/contract-signed` | `adminConfirmContractSigned` | Y | Admin | Conflict, Forbidden, MoneyFen, NotFound, Order, OrderId, Unauthorized, Uuid |
| Admin | POST | `/admin/orders/{orderId}/milestones/transfer-completed` | `adminConfirmTransferCompleted` | Y | Admin | Conflict, Forbidden, NotFound, Order, OrderId, Unauthorized, Uuid |
| Admin | POST | `/admin/orders/{orderId}/payments/manual` | `adminManualConfirmPayment` | Y | Admin, Payments | BadRequest, Conflict, Forbidden, ManualPaymentConfirmRequest, ManualPaymentConfirmResponse, NotFound, OrderId, Unauthorized |
| Admin | POST | `/admin/orders/{orderId}/payouts/manual` | `adminConfirmManualPayout` | Y | Admin | BadRequest, Conflict, Forbidden, IdempotencyKey, ManualPayoutConfirmRequest, NotFound, OrderId, Settlement, Unauthorized |
| Admin | GET | `/admin/orders/{orderId}/settlement` | `adminGetOrderSettlement` | Y | Admin | Forbidden, NotFound, OrderId, Settlement, Unauthorized |
| Admin | GET | `/admin/patent-claims` | `adminListPatentClaims` | Y | Admin, Patents | BadRequest, Forbidden, Page, PageSize, PagedPatentClaimRequest, PatentClaimStatusParam, Q, Unauthorized |
| Admin | POST | `/admin/patent-claims/{claimId}/approve` | `adminApprovePatentClaim` | Y | Admin, Patents | BadRequest, Conflict, Forbidden, NotFound, PatentClaimId, PatentClaimRequest, PatentClaimReviewRequest, Unauthorized |
| Admin | POST | `/admin/patent-claims/{claimId}/reject` | `adminRejectPatentClaim` | Y | Admin, Patents | BadRequest, Conflict, Forbidden, NotFound, PatentClaimId, PatentClaimRejectRequest, PatentClaimRequest, Unauthorized |
| Admin | GET | `/admin/patent-maintenance/orders` | `adminListPatentMaintenanceOrders` | Y | Admin, Maintenance | BadRequest, Forbidden, MaintenanceOrderStatus, MaintenanceReconcileStatus, Page, PageSize, PagedPatentMaintenanceOrder, Unauthorized, Uuid |
| Admin | POST | `/admin/patent-maintenance/orders` | `adminCreatePatentMaintenanceOrder` | Y | Admin, Maintenance | BadRequest, Conflict, Forbidden, PatentMaintenanceOrder, PatentMaintenanceOrderCreateRequest, Unauthorized |
| Admin | GET | `/admin/patent-maintenance/orders/{orderId}` | `adminGetPatentMaintenanceOrder` | Y | Admin, Maintenance | BadRequest, Forbidden, MaintenanceOrderId, NotFound, PatentMaintenanceOrder, Unauthorized |
| Admin | POST | `/admin/patent-maintenance/orders/{orderId}/cancel` | `adminCancelPatentMaintenanceOrder` | Y | Admin, Maintenance | BadRequest, Forbidden, MaintenanceOrderId, NotFound, PatentMaintenanceOrder, PatentMaintenanceOrderCancelRequest, Unauthorized |
| Admin | POST | `/admin/patent-maintenance/orders/{orderId}/close` | `adminClosePatentMaintenanceOrder` | Y | Admin, Maintenance | BadRequest, Forbidden, MaintenanceOrderId, NotFound, PatentMaintenanceOrder, PatentMaintenanceOrderCloseRequest, Unauthorized |
| Admin | GET | `/admin/patent-maintenance/orders/{orderId}/events` | `adminListPatentMaintenanceOrderEvents` | Y | Admin, Maintenance | BadRequest, Forbidden, MaintenanceOrderId, NotFound, PatentMaintenanceOrderEventList, Unauthorized |
| Admin | POST | `/admin/patent-maintenance/orders/{orderId}/execution` | `adminSubmitPatentMaintenanceOrderExecution` | Y | Admin, Maintenance | BadRequest, Forbidden, MaintenanceOrderId, NotFound, PatentMaintenanceOrder, PatentMaintenanceOrderExecutionRequest, Unauthorized |
| Admin | POST | `/admin/patent-maintenance/orders/{orderId}/payment-confirm` | `adminConfirmPatentMaintenanceOrderPayment` | Y | Admin, Maintenance | BadRequest, Forbidden, MaintenanceOrderId, NotFound, PatentMaintenanceOrder, PatentMaintenanceOrderPaymentConfirmRequest, Unauthorized |
| Admin | POST | `/admin/patent-maintenance/orders/{orderId}/quote` | `adminQuotePatentMaintenanceOrder` | Y | Admin, Maintenance | BadRequest, Forbidden, MaintenanceOrderId, NotFound, PatentMaintenanceOrder, PatentMaintenanceOrderQuoteRequest, Unauthorized |
| Admin | POST | `/admin/patent-maintenance/orders/{orderId}/receipt` | `adminUploadPatentMaintenanceOrderReceipt` | Y | Admin, Maintenance | BadRequest, Forbidden, MaintenanceOrderId, NotFound, PatentMaintenanceOrder, PatentMaintenanceOrderReceiptRequest, Unauthorized |
| Admin | POST | `/admin/patent-maintenance/orders/{orderId}/reconcile` | `adminReconcilePatentMaintenanceOrder` | Y | Admin, Maintenance | BadRequest, Forbidden, MaintenanceOrderId, NotFound, PatentMaintenanceOrder, PatentMaintenanceOrderReconcileRequest, Unauthorized |
| Admin | GET | `/admin/patent-maintenance/schedules` | `adminListPatentMaintenanceSchedules` | Y | Admin, Maintenance | BadRequest, Forbidden, MaintenanceStatus, Page, PageSize, PagedPatentMaintenanceSchedule, Unauthorized, Uuid |
| Admin | POST | `/admin/patent-maintenance/schedules` | `adminCreatePatentMaintenanceSchedule` | Y | Admin, Maintenance | BadRequest, Forbidden, PatentMaintenanceSchedule, PatentMaintenanceScheduleCreateRequest, Unauthorized |
| Admin | GET | `/admin/patent-maintenance/schedules/{scheduleId}` | `adminGetPatentMaintenanceSchedule` | Y | Admin, Maintenance | Forbidden, MaintenanceScheduleId, NotFound, PatentMaintenanceSchedule, Unauthorized |
| Admin | PATCH | `/admin/patent-maintenance/schedules/{scheduleId}` | `adminUpdatePatentMaintenanceSchedule` | Y | Admin, Maintenance | BadRequest, Forbidden, MaintenanceScheduleId, NotFound, PatentMaintenanceSchedule, PatentMaintenanceScheduleUpdateRequest, Unauthorized |
| Admin | GET | `/admin/patent-maintenance/tasks` | `adminListPatentMaintenanceTasks` | Y | Admin, Maintenance | BadRequest, Forbidden, MaintenanceTaskStatus, Page, PageSize, PagedPatentMaintenanceTask, Unauthorized, Uuid |
| Admin | POST | `/admin/patent-maintenance/tasks` | `adminCreatePatentMaintenanceTask` | Y | Admin, Maintenance | BadRequest, Forbidden, PatentMaintenanceTask, PatentMaintenanceTaskCreateRequest, Unauthorized |
| Admin | PATCH | `/admin/patent-maintenance/tasks/{taskId}` | `adminUpdatePatentMaintenanceTask` | Y | Admin, Maintenance | BadRequest, Forbidden, MaintenanceTaskId, NotFound, PatentMaintenanceTask, PatentMaintenanceTaskUpdateRequest, Unauthorized |
| Admin | POST | `/admin/patent-map/listings/batch` | `adminBatchUpdatePatentMapListings` | Y | Admin, Listings | BadRequest, Forbidden, IdempotencyKey, PatentMapBatchUpdateRequest, PatentMapBatchUpdateResponse, Unauthorized |
| Admin | GET | `/admin/patents` | `adminListPatents` | Y | Admin, Patents | BadRequest, Forbidden, LegalStatus, Page, PageSize, PagedPatent, PatentSourcePrimary, PatentType, Q, Unauthorized |
| Admin | POST | `/admin/patents` | `adminCreatePatent` | Y | Admin, Patents | BadRequest, Forbidden, Patent, PatentCreateRequest, Unauthorized |
| Admin | GET | `/admin/patents/jobs/import` | `adminListPatentImportJobs` | Y | Admin, Patents | BadRequest, Forbidden, Page, PageSize, PagedPatentImportJob, PatentImportDuplicatePolicyParam, PatentJobStatusParam, Unauthorized |
| Admin | POST | `/admin/patents/jobs/import` | `adminCreatePatentImportJob` | Y | Admin, Patents | BadRequest, Conflict, Forbidden, IdempotencyKey, NotFound, PatentImportJob, PatentImportJobCreateRequest, Unauthorized |
| Admin | GET | `/admin/patents/jobs/import/{jobId}` | `adminGetPatentImportJob` | Y | Admin, Patents | Forbidden, NotFound, PatentImportJob, PatentImportJobId, Unauthorized |
| Admin | GET | `/admin/patents/jobs/import/{jobId}/error-file` | `adminGetPatentImportJobErrorFile` | Y | Admin, Patents | Forbidden, ListingJobErrorFile, NotFound, PatentImportJobId, Unauthorized |
| Admin | POST | `/admin/patents/jobs/import/{jobId}/execute` | `adminExecutePatentImportJob` | Y | Admin, Patents | BadRequest, Conflict, Forbidden, NotFound, PatentImportJob, PatentImportJobId, Unauthorized |
| Admin | GET | `/admin/patents/jobs/import/{jobId}/rows` | `adminListPatentImportJobRows` | Y | Admin, Patents | BadRequest, Forbidden, NotFound, Page, PageSize, PagedPatentImportJobRow, PatentImportJobId, PatentImportRowStatusParam, Unauthorized |
| Admin | POST | `/admin/patents/jobs/import/{jobId}/validate` | `adminValidatePatentImportJob` | Y | Admin, Patents | BadRequest, Conflict, Forbidden, NotFound, PatentImportJob, PatentImportJobId, Unauthorized |
| Admin | POST | `/admin/patents/jobs/listings` | `adminGeneratePatentListings` | Y | Admin, Patents | BadRequest, Conflict, Forbidden, IdempotencyKey, NotFound, PatentListingGenerateRequest, PatentListingGenerateResult, Unauthorized |
| Admin | GET | `/admin/patents/{patentId}` | `adminGetPatentById` | Y | Admin, Patents | Forbidden, NotFound, Patent, PatentId, Unauthorized |
| Admin | PATCH | `/admin/patents/{patentId}` | `adminUpdatePatent` | Y | Admin, Patents | BadRequest, Forbidden, NotFound, Patent, PatentId, PatentUpdateRequest, Unauthorized |
| Admin | GET | `/admin/rbac/permissions` | `adminListRbacPermissions` | Y | Admin | Forbidden, RbacPermissionList, Unauthorized |
| Admin | GET | `/admin/rbac/roles` | `adminListRbacRoles` | Y | Admin | Forbidden, RbacRoleList, Unauthorized |
| Admin | POST | `/admin/rbac/roles` | `adminCreateRbacRole` | Y | Admin | BadRequest, Forbidden, RbacRole, RbacRoleCreateRequest, Unauthorized |
| Admin | DELETE | `/admin/rbac/roles/{roleId}` | `adminDeleteRbacRole` | Y | Admin | Forbidden, IdempotencyKey, NotFound, OkResponse, RoleId, Unauthorized |
| Admin | PATCH | `/admin/rbac/roles/{roleId}` | `adminUpdateRbacRole` | Y | Admin | BadRequest, Forbidden, NotFound, RbacRole, RbacRoleUpdateRequest, RoleId, Unauthorized |
| Admin | GET | `/admin/rbac/users` | `adminListRbacUsers` | Y | Admin | Forbidden, RbacUserList, Unauthorized |
| Admin | POST | `/admin/rbac/users` | `adminCreateRbacUser` | Y | Admin | BadRequest, Conflict, Forbidden, RbacUser, RbacUserCreateRequest, Unauthorized |
| Admin | PATCH | `/admin/rbac/users/{userId}` | `adminUpdateRbacUserRoles` | Y | Admin | BadRequest, Forbidden, NotFound, RbacUser, RbacUserRoleUpdateRequest, Unauthorized, UserId |
| Admin | POST | `/admin/refund-requests/{refundRequestId}/approve` | `adminApproveRefundRequest` | Y | Admin | Conflict, Forbidden, IdempotencyKey, NotFound, RefundRequest, RefundRequestId, Unauthorized |
| Admin | POST | `/admin/refund-requests/{refundRequestId}/complete` | `adminCompleteRefundRequest` | Y | Admin | BadRequest, Conflict, Forbidden, IdempotencyKey, NotFound, RefundRequest, RefundRequestCompleteRequest, RefundRequestId, Unauthorized |
| Admin | POST | `/admin/refund-requests/{refundRequestId}/reject` | `adminRejectRefundRequest` | Y | Admin | Conflict, Forbidden, IdempotencyKey, NotFound, RefundRequest, RefundRequestId, Unauthorized |
| Admin | GET | `/admin/regions` | `adminListRegions` | Y | Admin, Regions | Forbidden, RegionLevel, RegionNode, Unauthorized |
| Admin | POST | `/admin/regions` | `adminCreateRegion` | Y | Admin, Regions | BadRequest, Conflict, Forbidden, RegionCreateRequest, RegionNode, Unauthorized |
| Admin | PATCH | `/admin/regions/{regionCode}` | `adminUpdateRegion` | Y | Admin, Regions | BadRequest, Conflict, Forbidden, NotFound, RegionCodePath, RegionNode, RegionUpdateRequest, Unauthorized |
| Admin | PUT | `/admin/regions/{regionCode}/industry-tags` | `adminSetRegionIndustryTags` | Y | Admin, Regions | BadRequest, Conflict, Forbidden, IdempotencyKey, NotFound, RegionCodePath, RegionNode, Unauthorized |
| Admin | POST | `/admin/reports/finance/export` | `adminExportFinanceReport` | Y | Admin | FinanceReportExportResponse, Forbidden, Unauthorized |
| Admin | GET | `/admin/reports/finance/summary` | `adminGetFinanceReportSummary` | Y | Admin | FinanceReportSummary, Forbidden, Unauthorized |
| Admin | GET | `/admin/tech-managers` | `adminListTechManagers` | Y | Admin, TechManagers | BadRequest, Forbidden, Page, PageSize, PagedTechManagerSummary, Q, RegionCode, Unauthorized, VerificationStatus |
| Admin | PATCH | `/admin/tech-managers/{techManagerId}` | `adminUpdateTechManager` | Y | Admin, TechManagers | BadRequest, Conflict, Forbidden, NotFound, TechManagerId, TechManagerPublic, TechManagerUpdateRequest, Unauthorized |
| Admin | GET | `/admin/user-verifications` | `adminListUserVerifications` | Y | Admin | BadRequest, Forbidden, Page, PageSize, PagedUserVerification, Unauthorized, VerificationStatus, VerificationType |
| Admin | POST | `/admin/user-verifications/{verificationId}/approve` | `adminApproveUserVerification` | Y | Admin | Forbidden, NotFound, Unauthorized, UserVerification, VerificationId |
| Admin | GET | `/admin/user-verifications/{verificationId}/audit-logs` | `adminGetVerificationAuditLogs` | Y | Admin | AuditLogList, Forbidden, NotFound, Unauthorized, VerificationId |
| Admin | GET | `/admin/user-verifications/{verificationId}/materials` | `adminGetVerificationMaterials` | Y | Admin | AuditMaterialList, Forbidden, NotFound, Unauthorized, VerificationId |
| Admin | POST | `/admin/user-verifications/{verificationId}/reject` | `adminRejectUserVerification` | Y | Admin | Forbidden, NotFound, Unauthorized, UserVerification, VerificationId |
| Mini/H5 | GET | `/achievements` | `listMyAchievements` | Y | Achievements | AuditStatus, ContentStatusParam, Page, PageSize, PagedAchievementSummary, Unauthorized |
| Mini/H5 | POST | `/achievements` | `createAchievement` | Y | Achievements | AchievementCreateRequest, AchievementEdit, BadRequest, Forbidden, Unauthorized |
| Mini/H5 | GET | `/achievements/{achievementId}` | `getMyAchievementById` | Y | Achievements | AchievementEdit, AchievementId, NotFound, Unauthorized |
| Mini/H5 | PATCH | `/achievements/{achievementId}` | `updateMyAchievement` | Y | Achievements | AchievementEdit, AchievementId, AchievementUpdateRequest, BadRequest, Forbidden, NotFound, Unauthorized |
| Mini/H5 | POST | `/achievements/{achievementId}/comments` | `createAchievementComment` | Y | Comments, Achievements | AchievementId, BadRequest, Comment, CommentCreateRequest, IdempotencyKey, NotFound, Unauthorized |
| Mini/H5 | POST | `/achievements/{achievementId}/consultations` | `createAchievementConsultation` | Y | Achievements | AchievementId, BadRequest, IdempotencyKey, NotFound, OkResponse, Unauthorized |
| Mini/H5 | POST | `/achievements/{achievementId}/conversations` | `upsertAchievementConversation` | Y | Messaging, Achievements | AchievementId, Conflict, Conversation, IdempotencyKey, NotFound, Unauthorized |
| Mini/H5 | DELETE | `/achievements/{achievementId}/favorites` | `unfavoriteAchievement` | Y | Achievements | AchievementId, IdempotencyKey, NotFound, OkResponse, Unauthorized |
| Mini/H5 | POST | `/achievements/{achievementId}/favorites` | `favoriteAchievement` | Y | Achievements | AchievementId, IdempotencyKey, NotFound, OkResponse, Unauthorized |
| Mini/H5 | POST | `/achievements/{achievementId}/off-shelf` | `offShelfAchievement` | Y | Achievements | AchievementId, AchievementRecord, Forbidden, NotFound, Unauthorized |
| Mini/H5 | POST | `/achievements/{achievementId}/submit` | `submitAchievement` | Y | Achievements | AchievementId, AchievementRecord, Forbidden, NotFound, Unauthorized |
| Mini/H5 | POST | `/ai/agent/query` | `createAiAgentQuery` | N | AI | AiAgentQueryRequest, AiAgentQueryResult, BadRequest |
| Mini/H5 | POST | `/ai/parse-results/{parseResultId}/feedback` | `createAiParseFeedback` | Y | AI | AiParseFeedback, AiParseFeedbackRequest, BadRequest, Conflict, IdempotencyKey, NotFound, ParseResultId, Unauthorized |
| Mini/H5 | GET | `/auth/session` | `authGetSession` | Y | Auth | AuthSession, Unauthorized |
| Mini/H5 | POST | `/auth/sms/send` | `authSmsSend` | N | Auth | BadRequest, PhoneNumber, SmsPurpose |
| Mini/H5 | POST | `/auth/sms/verify` | `authSmsVerify` | N | Auth | AuthTokenResponse, BadRequest, PhoneNumber |
| Mini/H5 | POST | `/auth/wechat/mp-login` | `authWechatMpLogin` | N | Auth | AuthTokenResponse, BadRequest |
| Mini/H5 | POST | `/auth/wechat/phone-bind` | `authWechatPhoneBind` | Y | Auth | BadRequest, Conflict, PhoneNumber, Unauthorized |
| Mini/H5 | DELETE | `/comments/{commentId}` | `deleteComment` | Y | Comments | CommentId, Conflict, Forbidden, IdempotencyKey, NotFound, Unauthorized |
| Mini/H5 | PATCH | `/comments/{commentId}` | `updateComment` | Y | Comments | BadRequest, Comment, CommentId, CommentUpdateRequest, Conflict, Forbidden, IdempotencyKey, NotFound, Unauthorized |
| Mini/H5 | GET | `/contracts` | `listContracts` | Y | Contracts | BadRequest, ContractStatus, Page, PageSize, PagedContract, Unauthorized |
| Mini/H5 | POST | `/contracts/{contractId}/upload` | `uploadContractPdf` | Y | Contracts | BadRequest, ContractItem, ContractUploadRequest, Forbidden, IdempotencyKey, NotFound, Unauthorized |
| Mini/H5 | GET | `/conversations/{conversationId}/messages` | `listConversationMessages` | Y | Messaging | ConversationId, NotFound, PagedConversationMessage, Unauthorized |
| Mini/H5 | POST | `/conversations/{conversationId}/messages` | `sendConversationMessage` | Y | Messaging | BadRequest, Conflict, ConversationId, ConversationMessage, ConversationMessageSendRequest, IdempotencyKey, NotFound, Unauthorized |
| Mini/H5 | POST | `/conversations/{conversationId}/read` | `markConversationRead` | Y | Messaging | Conflict, ConversationId, IdempotencyKey, NotFound, Unauthorized |
| Mini/H5 | POST | `/files` | `uploadFile` | Y | Files | BadRequest, FileObject, FilePurpose, Unauthorized |
| Mini/H5 | GET | `/files/{fileId}` | `downloadFile` | Y | Files | Forbidden, NotFound, Unauthorized, Uuid |
| Mini/H5 | GET | `/files/{fileId}/preview` | `previewFile` | Y | Files | Forbidden, NotFound, Unauthorized, Uuid |
| Mini/H5 | POST | `/files/{fileId}/temporary-access` | `createFileTemporaryAccess` | Y | Files | BadRequest, FileTemporaryAccessRequest, FileTemporaryAccessResponse, Forbidden, NotFound, Unauthorized, Uuid |
| Mini/H5 | GET | `/health` | `getHealth` | N | System | BadRequest, NotImplemented |
| Mini/H5 | GET | `/invoices` | `listMyInvoices` | Y | Invoices | BadRequest, InvoiceStatus, Page, PageSize, PagedInvoiceItem, Unauthorized |
| Mini/H5 | GET | `/listings` | `listMyListings` | Y | Listings | AuditStatus, ListingStatus, Page, PageSize, PagedListing, Unauthorized |
| Mini/H5 | POST | `/listings` | `createListing` | Y | Listings | BadRequest, Forbidden, Listing, ListingCreateRequest, Unauthorized |
| Mini/H5 | GET | `/listings/{listingId}` | `getListingById` | Y | Listings | Listing, ListingId, NotFound, Unauthorized |
| Mini/H5 | PATCH | `/listings/{listingId}` | `updateListing` | Y | Listings | BadRequest, Forbidden, Listing, ListingId, ListingUpdateRequest, NotFound, Unauthorized |
| Mini/H5 | POST | `/listings/{listingId}/comments` | `createListingComment` | Y | Comments | BadRequest, Comment, CommentCreateRequest, Conflict, IdempotencyKey, ListingId, NotFound, Unauthorized |
| Mini/H5 | POST | `/listings/{listingId}/consultations` | `createListingConsultation` | Y | Listings | BadRequest, Conflict, IdempotencyKey, ListingConsultationCreated, ListingId, NotFound, Unauthorized |
| Mini/H5 | POST | `/listings/{listingId}/conversations` | `upsertListingConversation` | Y | Messaging | Conflict, Conversation, IdempotencyKey, ListingId, NotFound, Unauthorized |
| Mini/H5 | DELETE | `/listings/{listingId}/favorites` | `unfavoriteListing` | Y | Listings | Conflict, IdempotencyKey, ListingId, NotFound, Unauthorized |
| Mini/H5 | POST | `/listings/{listingId}/favorites` | `favoriteListing` | Y | Listings | Conflict, IdempotencyKey, ListingId, NotFound, Unauthorized |
| Mini/H5 | POST | `/listings/{listingId}/off-shelf` | `offShelfListing` | Y | Listings | Forbidden, Listing, ListingId, NotFound, Unauthorized |
| Mini/H5 | POST | `/listings/{listingId}/submit` | `submitListing` | Y | Listings | Forbidden, Listing, ListingId, NotFound, Unauthorized |
| Mini/H5 | GET | `/me` | `getMe` | Y | Users | Unauthorized, UserProfile |
| Mini/H5 | PATCH | `/me` | `updateMe` | Y | Users | Unauthorized, UserProfile |
| Mini/H5 | GET | `/me/addresses` | `listMyAddresses` | Y | Users | Address, Unauthorized |
| Mini/H5 | POST | `/me/addresses` | `createMyAddress` | Y | Users | Address, AddressCreateRequest, BadRequest, Unauthorized |
| Mini/H5 | DELETE | `/me/addresses/{addressId}` | `deleteMyAddress` | Y | Users | AddressId, NotFound, OkResponse, Unauthorized |
| Mini/H5 | PATCH | `/me/addresses/{addressId}` | `updateMyAddress` | Y | Users | Address, AddressId, AddressUpdateRequest, BadRequest, NotFound, Unauthorized |
| Mini/H5 | GET | `/me/conversations` | `listMyConversations` | Y | Messaging | Page, PageSize, PagedConversationSummary, Unauthorized |
| Mini/H5 | GET | `/me/favorites` | `listMyFavoriteListings` | Y | Listings | Page, PageSize, PagedListingSummary, Unauthorized |
| Mini/H5 | GET | `/me/favorites/achievements` | `listMyFavoriteAchievements` | Y | Achievements | Page, PageSize, PagedAchievementSummary, Unauthorized |
| Mini/H5 | GET | `/me/patent-claims` | `listMyPatentClaims` | Y | Patents | BadRequest, Page, PageSize, PagedPatentClaimRequest, PatentClaimStatusParam, Unauthorized |
| Mini/H5 | POST | `/me/patent-claims` | `createMyPatentClaim` | Y | Patents | BadRequest, Conflict, Forbidden, IdempotencyKey, NotFound, PatentClaimCreateRequest, PatentClaimRequest, Unauthorized |
| Mini/H5 | GET | `/me/patent-maintenance/orders` | `listMyPatentMaintenanceOrders` | Y | Maintenance | BadRequest, Forbidden, MaintenanceOrderStatus, MaintenanceReconcileStatus, Page, PageSize, PagedMyPatentMaintenanceOrder, Unauthorized, Uuid |
| Mini/H5 | POST | `/me/patent-maintenance/orders` | `createMyPatentMaintenanceOrder` | Y | Maintenance | BadRequest, Conflict, Forbidden, PatentMaintenanceOrder, PatentMaintenanceOrderMyCreateRequest, Unauthorized |
| Mini/H5 | GET | `/me/patent-maintenance/orders/{orderId}` | `getMyPatentMaintenanceOrder` | Y | Maintenance | BadRequest, Forbidden, MaintenanceOrderId, NotFound, PatentMaintenanceOrder, Unauthorized |
| Mini/H5 | GET | `/me/patent-maintenance/orders/{orderId}/events` | `listMyPatentMaintenanceOrderEvents` | Y | Maintenance | BadRequest, Forbidden, MaintenanceOrderId, NotFound, PatentMaintenanceOrderEventList, Unauthorized |
| Mini/H5 | GET | `/me/patent-maintenance/schedules` | `listMyPatentMaintenanceSchedules` | Y | Maintenance | BadRequest, Forbidden, MaintenanceStatus, Page, PageSize, PagedMyPatentMaintenanceSchedule, Unauthorized, Uuid |
| Mini/H5 | GET | `/me/patent-maintenance/tasks` | `listMyPatentMaintenanceTasks` | Y | Maintenance | BadRequest, Forbidden, MaintenanceTaskStatus, Page, PageSize, PagedMyPatentMaintenanceTask, Unauthorized, Uuid |
| Mini/H5 | GET | `/me/recommendations/listings` | `getMyRecommendedListings` | Y | Search | Page, PageSize, PagedListingSummary, RegionCode, Unauthorized |
| Mini/H5 | GET | `/me/verification` | `getMyVerification` | Y | Users | NotFound, Unauthorized, UserVerification |
| Mini/H5 | POST | `/me/verification` | `submitMyVerification` | Y | Users | BadRequest, Conflict, Unauthorized, UserVerification, UserVerificationSubmitRequest |
| Mini/H5 | GET | `/notifications` | `listMyNotifications` | Y | Notifications | Page, PageSize, PagedNotification, Unauthorized |
| Mini/H5 | GET | `/notifications/{notificationId}` | `getNotificationById` | Y | Notifications | NotFound, Notification, NotificationId, Unauthorized |
| Mini/H5 | GET | `/orders` | `listMyOrders` | Y | Orders | BadRequest, OrderListRole, OrderStatus, OrderStatusGroup, Page, PageSize, PagedOrder, Unauthorized |
| Mini/H5 | POST | `/orders` | `createOrder` | Y | Orders | BadRequest, Conflict, NotFound, Order, Unauthorized, Uuid |
| Mini/H5 | GET | `/orders/{orderId}` | `getOrderById` | Y | Orders | NotFound, Order, OrderId, Unauthorized |
| Mini/H5 | GET | `/orders/{orderId}/case` | `getOrderCase` | Y | Cases | CaseWithMilestones, NotFound, OrderId, Unauthorized |
| Mini/H5 | POST | `/orders/{orderId}/dispute-conversations` | `upsertOrderDisputeConversation` | Y | Messaging, Orders | Conversation, Forbidden, IdempotencyKey, NotFound, OrderId, Unauthorized |
| Mini/H5 | GET | `/orders/{orderId}/invoice` | `getOrderInvoice` | Y | Invoices | NotFound, OrderId, OrderInvoice, Unauthorized |
| Mini/H5 | POST | `/orders/{orderId}/invoice-requests` | `requestOrderInvoice` | Y | Invoices | Forbidden, IdempotencyKey, InvoiceRequestResult, NotFound, OrderId, Unauthorized |
| Mini/H5 | POST | `/orders/{orderId}/payment-intents` | `createPaymentIntent` | Y | Payments | BadRequest, Conflict, IdempotencyKey, OrderId, PayType, PaymentIntentResponse, Unauthorized |
| Mini/H5 | GET | `/orders/{orderId}/refund-requests` | `listRefundRequestsByOrder` | Y | Refunds | NotFound, OrderId, RefundRequest, Unauthorized |
| Mini/H5 | POST | `/orders/{orderId}/refund-requests` | `createRefundRequest` | Y | Refunds | BadRequest, Conflict, IdempotencyKey, NotFound, OrderId, RefundRequest, RefundRequestCreate, Unauthorized |
| Mini/H5 | POST | `/patent-maintenance/orders/{orderId}/conversations` | `upsertMaintenanceOrderConversation` | Y | Messaging, Maintenance | Conversation, Forbidden, IdempotencyKey, MaintenanceOrderId, NotFound, Unauthorized |
| Mini/H5 | POST | `/patents/normalize` | `normalizePatentNumber` | N | Patents | BadRequest, PatentNormalizeRequest, PatentNormalizeResponse |
| Mini/H5 | GET | `/patents/{patentId}` | `getPatentById` | Y | Patents | NotFound, Patent, PatentId, Unauthorized |
| Mini/H5 | GET | `/public/achievements/{achievementId}` | `getPublicAchievementById` | N | Achievements | AchievementDetail, AchievementId, NotFound |
| Mini/H5 | GET | `/public/achievements/{achievementId}/comments` | `listPublicAchievementComments` | N | Comments, Achievements | AchievementId, BadRequest, NotFound, Page, PageSize, PagedCommentThread |
| Mini/H5 | GET | `/public/config/banner` | `getPublicBannerConfig` | N | Config | BadRequest, BannerConfig |
| Mini/H5 | GET | `/public/config/customer-service` | `getPublicCustomerServiceConfig` | N | Config | BadRequest, CustomerServiceConfig |
| Mini/H5 | GET | `/public/config/home-announcements` | `getPublicHomeAnnouncementsFeed` | N | Config | BadRequest, PublicHomeAnnouncementFeed |
| Mini/H5 | GET | `/public/config/trade-rules` | `getPublicTradeRulesConfig` | N | Config | BadRequest, TradeRulesConfig |
| Mini/H5 | GET | `/public/industry-tags` | `listPublicIndustryTags` | N | Regions | BadRequest, IndustryTag |
| Mini/H5 | GET | `/public/listings/{listingId}` | `getPublicListingById` | N | Listings | ListingId, ListingPublic, NotFound |
| Mini/H5 | GET | `/public/listings/{listingId}/comments` | `listPublicListingComments` | N | Comments | BadRequest, ListingId, NotFound, Page, PageSize, PagedCommentThread |
| Mini/H5 | GET | `/public/organizations` | `listPublicOrganizations` | N | Organizations | BadRequest, OrganizationTypes, Page, PageSize, PagedOrganizationSummary, Q, RegionCode |
| Mini/H5 | GET | `/public/organizations/{orgUserId}` | `getPublicOrganizationById` | N | Organizations | NotFound, OrgUserId, OrganizationSummary |
| Mini/H5 | GET | `/public/tech-managers/{techManagerId}` | `getPublicTechManagerById` | N | TechManagers | NotFound, TechManagerId, TechManagerPublic |
| Mini/H5 | GET | `/regions` | `listRegions` | N | Regions | BadRequest, RegionLevel, RegionNode |
| Mini/H5 | GET | `/search/achievements` | `searchAchievements` | N | Search, Achievements | AchievementMaturity, AchievementSortBy, BadRequest, IndustryTags, Page, PageSize, PagedAchievementSummary, Q, RegionCode |
| Mini/H5 | GET | `/search/inventors` | `searchInventorRankings` | N | Search | BadRequest, Page, PageSize, PagedInventorRanking, PatentType, Q, RegionCode |
| Mini/H5 | GET | `/search/listings` | `searchListings` | N | Search | Applicant, Assignee, BadRequest, CreatedFrom, CreatedTo, DepositMax, DepositMin, FilingDateFrom, FilingDateTo, GrantDateFrom, GrantDateTo, IndustryTags, Inventor, Ipc, LegalStatus, LicenseMode, ListingTopic, Loc, Page, PageSize, PagedListingSummary, PatentType, PriceMax, PriceMin, PriceType, PublicationDateFrom, PublicationDateTo, Q, QType, RegionCode, SellerUserId, SortBy, TradeMode, TransferCountMax, TransferCountMin |
| Mini/H5 | GET | `/search/patent-map/overview` | `searchPatentMapOverview` | N | Search | BadRequest, PatentMapDataScope, PatentMapOverviewRegionLevel, PatentMapOverviewResponse |
| Mini/H5 | GET | `/search/patent-map/regions/{regionCode}` | `searchPatentMapRegionDetail` | N | Search | BadRequest, NotFound, Page, PageSize, PatentMapDataScope, PatentMapRegionDetailResponse, RegionCodePath |
| Mini/H5 | GET | `/search/tech-managers` | `searchTechManagers` | N | Search, TechManagers | BadRequest, Page, PageSize, PagedTechManagerSummary, Q, RegionCode, TechManagerSortBy |
| Mini/H5 | POST | `/support/conversations` | `upsertSupportConversation` | Y | Messaging | Conflict, Conversation, IdempotencyKey, Unauthorized |
| Mini/H5 | POST | `/tech-managers/{techManagerId}/conversations` | `upsertTechManagerConversation` | Y | Messaging, TechManagers | Conflict, Conversation, IdempotencyKey, NotFound, TechManagerId, Unauthorized |
| Mini/H5 | POST | `/webhooks/wechatpay/notify` | `wechatPayNotify` | N | Payments | BadRequest, WechatpayNonce, WechatpaySerial, WechatpaySignature, WechatpaySignatureType, WechatpayTimestamp |

## 6. 接口字段字典（OpenAPI Schema，全量）

说明：为保证可读性，字段展开深度限制为 2 层。

### 6.1 `AchievementAdminCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `auditStatus` | `ref:AuditStatus` | N | - | - |
| `cooperationModes` | `array<string>` | N | - | - |
| `coverFileId` | `ref:Uuid` | N | - | - |
| `description` | `string` | N | - | - |
| `industryTags` | `array<string>` | N | - | - |
| `keywords` | `array<string>` | N | - | - |
| `maturity` | `ref:AchievementMaturity` | N | - | - |
| `media` | `array<ref:ContentMediaInput>` | N | - | - |
| `media[].fileId` | `ref:Uuid` | Y | - | - |
| `media[].sort` | `integer` | N | - | - |
| `media[].type` | `ref:ContentMediaType` | Y | - | - |
| `publisherUserId` | `ref:Uuid` | N | - | - |
| `regionCode` | `string` | N | - | - |
| `source` | `ref:ContentSource` | N | - | - |
| `status` | `ref:ContentStatus` | N | - | - |
| `summary` | `string` | N | - | - |
| `title` | `string` | Y | - | - |

### 6.2 `AchievementAdminUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `auditStatus` | `ref:AuditStatus` | N | - | - |
| `cooperationModes` | `array<string>` | N | - | - |
| `coverFileId` | `ref:Uuid` | N | - | - |
| `description` | `string` | N | - | - |
| `industryTags` | `array<string>` | N | - | - |
| `keywords` | `array<string>` | N | - | - |
| `maturity` | `ref:AchievementMaturity` | N | - | - |
| `media` | `array<ref:ContentMediaInput>` | N | - | - |
| `media[].fileId` | `ref:Uuid` | Y | - | - |
| `media[].sort` | `integer` | N | - | - |
| `media[].type` | `ref:ContentMediaType` | Y | - | - |
| `publisherUserId` | `ref:Uuid` | N | - | - |
| `regionCode` | `string` | N | - | - |
| `source` | `ref:ContentSource` | N | - | - |
| `status` | `ref:ContentStatus` | N | - | - |
| `summary` | `string` | N | - | - |
| `title` | `string` | N | - | - |

### 6.3 `AchievementCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `cooperationModes` | `array<string>` | N | - | - |
| `coverFileId` | `ref:Uuid` | N | - | - |
| `description` | `string` | N | - | - |
| `industryTags` | `array<string>` | N | - | - |
| `keywords` | `array<string>` | N | - | - |
| `maturity` | `ref:AchievementMaturity` | N | - | - |
| `media` | `array<ref:ContentMediaInput>` | N | - | - |
| `media[].fileId` | `ref:Uuid` | Y | - | - |
| `media[].sort` | `integer` | N | - | - |
| `media[].type` | `ref:ContentMediaType` | Y | - | - |
| `regionCode` | `string` | N | - | - |
| `summary` | `string` | N | - | - |
| `title` | `string` | Y | - | - |

### 6.4 `AchievementDetail`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `aiParse` | `object` | N | - | - |
| `auditStatus` | `ref:AuditStatus` | Y | - | - |
| `cooperationModes` | `array<string>` | N | - | - |
| `coverUrl` | `string` | N | - | - |
| `createdAt` | `string` | Y | - | - |
| `description` | `string` | N | - | - |
| `id` | `ref:Uuid` | Y | - | - |
| `industryTags` | `array<string>` | N | - | - |
| `keywords` | `array<string>` | N | - | - |
| `maturity` | `ref:AchievementMaturity` | N | - | - |
| `media` | `array<ref:ContentMedia>` | N | - | - |
| `media[].fileId` | `ref:Uuid` | Y | - | - |
| `media[].fileName` | `string` | N | - | - |
| `media[].mimeType` | `string` | N | - | - |
| `media[].sizeBytes` | `integer` | N | - | - |
| `media[].sort` | `integer` | Y | - | - |
| `media[].type` | `ref:ContentMediaType` | Y | - | - |
| `media[].url` | `string` | N | - | - |
| `publisher` | `ref:OrganizationSummary` | N | - | - |
| `publisher.displayName` | `string` | Y | - | - |
| `publisher.intro` | `string` | N | - | - |
| `publisher.logoUrl` | `string` | N | - | - |
| `publisher.orgCategory` | `ref:SupplyType` | N | - | - |
| `publisher.regionCode` | `string` | N | - | - |
| `publisher.stats` | `ref:OrganizationStats` | N | - | - |
| `publisher.stats.listingCount` | `integer` | Y | - | - |
| `publisher.stats.patentCount` | `integer` | Y | - | - |
| `publisher.userId` | `ref:Uuid` | Y | - | - |
| `publisher.verificationStatus` | `ref:VerificationStatus` | Y | - | - |
| `publisher.verificationType` | `ref:VerificationType` | Y | - | - |
| `publisher.verifiedAt` | `string` | N | - | - |
| `regionCode` | `string` | N | - | - |
| `source` | `ref:ContentSource` | N | - | - |
| `stats` | `ref:ListingStats` | N | - | - |
| `stats.commentCount` | `integer` | N | - | - |
| `stats.consultCount` | `integer` | Y | - | - |
| `stats.favoriteCount` | `integer` | Y | - | - |
| `stats.viewCount` | `integer` | Y | - | - |
| `status` | `ref:ContentStatus` | Y | - | - |
| `summary` | `string` | N | - | - |
| `title` | `string` | Y | - | - |

### 6.5 `AchievementEdit`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `auditStatus` | `ref:AuditStatus` | Y | - | - |
| `cooperationModes` | `array<string>` | N | - | - |
| `coverFileId` | `ref:Uuid` | N | - | - |
| `coverUrl` | `string` | N | - | - |
| `createdAt` | `string` | Y | - | - |
| `description` | `string` | N | - | - |
| `id` | `ref:Uuid` | Y | - | - |
| `industryTags` | `array<string>` | N | - | - |
| `keywords` | `array<string>` | N | - | - |
| `maturity` | `ref:AchievementMaturity` | N | - | - |
| `media` | `array<ref:ContentMedia>` | N | - | - |
| `media[].fileId` | `ref:Uuid` | Y | - | - |
| `media[].fileName` | `string` | N | - | - |
| `media[].mimeType` | `string` | N | - | - |
| `media[].sizeBytes` | `integer` | N | - | - |
| `media[].sort` | `integer` | Y | - | - |
| `media[].type` | `ref:ContentMediaType` | Y | - | - |
| `media[].url` | `string` | N | - | - |
| `publisher` | `ref:OrganizationSummary` | N | - | - |
| `publisher.displayName` | `string` | Y | - | - |
| `publisher.intro` | `string` | N | - | - |
| `publisher.logoUrl` | `string` | N | - | - |
| `publisher.orgCategory` | `ref:SupplyType` | N | - | - |
| `publisher.regionCode` | `string` | N | - | - |
| `publisher.stats` | `ref:OrganizationStats` | N | - | - |
| `publisher.stats.listingCount` | `integer` | Y | - | - |
| `publisher.stats.patentCount` | `integer` | Y | - | - |
| `publisher.userId` | `ref:Uuid` | Y | - | - |
| `publisher.verificationStatus` | `ref:VerificationStatus` | Y | - | - |
| `publisher.verificationType` | `ref:VerificationType` | Y | - | - |
| `publisher.verifiedAt` | `string` | N | - | - |
| `regionCode` | `string` | N | - | - |
| `source` | `ref:ContentSource` | N | - | - |
| `stats` | `ref:ListingStats` | N | - | - |
| `stats.commentCount` | `integer` | N | - | - |
| `stats.consultCount` | `integer` | Y | - | - |
| `stats.favoriteCount` | `integer` | Y | - | - |
| `stats.viewCount` | `integer` | Y | - | - |
| `status` | `ref:ContentStatus` | Y | - | - |
| `summary` | `string` | N | - | - |
| `title` | `string` | Y | - | - |

### 6.6 `AchievementMaturity`

- No flattenable fields in this schema.

### 6.7 `AchievementRecord`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `auditStatus` | `ref:AuditStatus` | Y | - | - |
| `cooperationModesJson` | `array<string>` | N | - | - |
| `coverFileId` | `ref:Uuid` | N | - | - |
| `createdAt` | `string` | Y | - | - |
| `description` | `string` | N | - | - |
| `id` | `ref:Uuid` | Y | - | - |
| `industryTagsJson` | `array<string>` | N | - | - |
| `keywordsJson` | `array<string>` | N | - | - |
| `maturity` | `ref:AchievementMaturity` | N | - | - |
| `publisherUserId` | `ref:Uuid` | Y | - | - |
| `regionCode` | `string` | N | - | - |
| `source` | `ref:ContentSource` | Y | - | - |
| `status` | `ref:ContentStatus` | Y | - | - |
| `summary` | `string` | N | - | - |
| `title` | `string` | Y | - | - |
| `updatedAt` | `string` | Y | - | - |

### 6.8 `AchievementSortBy`

- No flattenable fields in this schema.

### 6.9 `AchievementUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `cooperationModes` | `array<string>` | N | - | - |
| `coverFileId` | `ref:Uuid` | N | - | - |
| `description` | `string` | N | - | - |
| `industryTags` | `array<string>` | N | - | - |
| `keywords` | `array<string>` | N | - | - |
| `maturity` | `ref:AchievementMaturity` | N | - | - |
| `media` | `array<ref:ContentMediaInput>` | N | - | - |
| `media[].fileId` | `ref:Uuid` | Y | - | - |
| `media[].sort` | `integer` | N | - | - |
| `media[].type` | `ref:ContentMediaType` | Y | - | - |
| `regionCode` | `string` | N | - | - |
| `summary` | `string` | N | - | - |
| `title` | `string` | N | - | - |

### 6.10 `Address`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `addressLine` | `string` | Y | - | - |
| `createdAt` | `string` | Y | - | - |
| `id` | `ref:Uuid` | Y | - | - |
| `isDefault` | `boolean` | Y | - | - |
| `name` | `string` | Y | - | - |
| `phone` | `ref:PhoneNumber` | Y | - | - |
| `regionCode` | `string` | N | - | - |
| `updatedAt` | `string` | Y | - | - |
| `userId` | `ref:Uuid` | Y | - | - |

### 6.11 `AddressCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `addressLine` | `string` | N | - | - |
| `isDefault` | `boolean` | N | - | - |
| `name` | `string` | N | - | - |
| `phone` | `ref:PhoneNumber` | N | - | - |
| `regionCode` | `string` | N | - | - |

### 6.12 `AddressUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `addressLine` | `string` | N | - | - |
| `isDefault` | `boolean` | N | - | - |
| `name` | `string` | N | - | - |
| `phone` | `ref:PhoneNumber` | N | - | - |
| `regionCode` | `string` | N | - | - |

### 6.13 `AdminCommentUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `status` | `ref:CommentStatus` | Y | - | - |

### 6.14 `AdminListingCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `applicantNames` | `array<string>` | N | - | - |
| `assigneeNames` | `array<string>` | N | - | - |
| `auditStatus` | `ref:AuditStatus` | N | - | - |
| `consultationRouting` | `ref:ConsultationRouting` | N | - | - |
| `deliverables` | `array<string>` | N | - | - |
| `depositAmountFen` | `ref:MoneyFen` | N | - | - |
| `encumbranceNote` | `string` | N | - | - |
| `existingLicenseStatus` | `ref:ExistingLicenseStatus` | N | - | - |
| `expectedCompletionDays` | `integer` | N | - | - |
| `filingDate` | `string` | N | - | - |
| `grantDate` | `string` | N | - | - |
| `industryTags` | `array<string>` | N | - | - |
| `inventorNames` | `array<string>` | N | - | - |
| `ipcCodes` | `array<string>` | N | - | - |
| `legalStatus` | `ref:LegalStatus` | N | - | - |
| `legalStatusRaw` | `string` | N | - | - |
| `licenseMode` | `ref:LicenseMode` | N | - | - |
| `listingTopics` | `array<ref:ListingTopic>` | N | - | - |
| `locCodes` | `array<string>` | N | - | - |
| `media` | `array<ref:ListingMedia>` | N | - | - |
| `media[].fileId` | `ref:Uuid` | Y | - | - |
| `media[].sort` | `integer` | Y | - | - |
| `media[].type` | `string` | Y | IMAGE/FILE | - |
| `negotiableNote` | `string` | N | - | - |
| `negotiableRangeFen` | `ref:MoneyFen` | N | - | - |
| `negotiableRangePercent` | `number` | N | - | - |
| `patentNumberRaw` | `string` | N | - | - |
| `patentType` | `ref:PatentType` | N | - | - |
| `pledgeStatus` | `ref:PledgeStatus` | N | - | - |
| `priceAmountFen` | `ref:MoneyFen` | N | - | - |
| `priceType` | `ref:PriceType` | Y | - | - |
| `proofFileIds` | `array<ref:Uuid>` | N | - | - |
| `publicationDate` | `string` | N | - | - |
| `regionCode` | `string` | N | - | - |
| `sellerUserId` | `ref:Uuid` | N | - | - |
| `source` | `ref:ContentSource` | N | - | - |
| `status` | `ref:ListingStatus` | N | - | - |
| `summary` | `string` | N | - | - |
| `title` | `string` | N | - | - |
| `tradeMode` | `ref:TradeMode` | Y | - | - |
| `transferCount` | `integer` | N | - | - |

### 6.15 `AdminListingUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `applicantNames` | `array<string>` | N | - | - |
| `assigneeNames` | `array<string>` | N | - | - |
| `auditStatus` | `ref:AuditStatus` | N | - | - |
| `consultationRouting` | `ref:ConsultationRouting` | N | - | - |
| `deliverables` | `array<string>` | N | - | - |
| `depositAmountFen` | `ref:MoneyFen` | N | - | - |
| `encumbranceNote` | `string` | N | - | - |
| `existingLicenseStatus` | `ref:ExistingLicenseStatus` | N | - | - |
| `expectedCompletionDays` | `integer` | N | - | - |
| `filingDate` | `string` | N | - | - |
| `grantDate` | `string` | N | - | - |
| `industryTags` | `array<string>` | N | - | - |
| `inventorNames` | `array<string>` | N | - | - |
| `ipcCodes` | `array<string>` | N | - | - |
| `legalStatus` | `ref:LegalStatus` | N | - | - |
| `legalStatusRaw` | `string` | N | - | - |
| `licenseMode` | `ref:LicenseMode` | N | - | - |
| `listingTopics` | `array<ref:ListingTopic>` | N | - | - |
| `locCodes` | `array<string>` | N | - | - |
| `media` | `array<ref:ListingMedia>` | N | - | - |
| `media[].fileId` | `ref:Uuid` | Y | - | - |
| `media[].sort` | `integer` | Y | - | - |
| `media[].type` | `string` | Y | IMAGE/FILE | - |
| `negotiableNote` | `string` | N | - | - |
| `negotiableRangeFen` | `ref:MoneyFen` | N | - | - |
| `negotiableRangePercent` | `number` | N | - | - |
| `patentNumberRaw` | `string` | N | - | - |
| `pledgeStatus` | `ref:PledgeStatus` | N | - | - |
| `priceAmountFen` | `ref:MoneyFen` | N | - | - |
| `priceType` | `ref:PriceType` | N | - | - |
| `proofFileIds` | `array<ref:Uuid>` | N | - | - |
| `publicationDate` | `string` | N | - | - |
| `regionCode` | `string` | N | - | - |
| `sellerUserId` | `ref:Uuid` | N | - | - |
| `source` | `ref:ContentSource` | N | - | - |
| `status` | `ref:ListingStatus` | N | - | - |
| `summary` | `string` | N | - | - |
| `title` | `string` | N | - | - |
| `tradeMode` | `ref:TradeMode` | N | - | - |
| `transferCount` | `integer` | N | - | - |

### 6.16 `AiAgentQueryRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `audioFileId` | `ref:Uuid` | N | - | - |
| `contentScope` | `ref:AiContentScope` | N | - | - |
| `extraContext` | `object` | N | - | - |
| `industryTags` | `array<string>` | N | - | - |
| `inputText` | `string` | N | - | - |
| `inputType` | `ref:AiAgentInputType` | Y | - | - |
| `regionCode` | `string` | N | - | - |

### 6.17 `AiAgentQueryResult`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `confidence` | `number` | N | - | - |
| `contentScope` | `ref:AiContentScope` | N | - | - |
| `createdAt` | `string` | N | - | - |
| `matchSummary` | `string` | N | - | - |
| `normalizedText` | `string` | N | - | - |
| `parsedQuery` | `ref:AiAgentParsedQuery` | Y | - | - |
| `parsedQuery.applicationScenario` | `string` | N | - | - |
| `parsedQuery.contentType` | `ref:AiContentType` | N | - | - |
| `parsedQuery.filters` | `ref:AiSearchFilters` | N | - | - |
| `parsedQuery.filters.cooperationModes` | `array<ref:CooperationMode>` | N | - | - |
| `parsedQuery.filters.depositMax` | `ref:MoneyFen` | N | - | - |
| `parsedQuery.filters.depositMin` | `ref:MoneyFen` | N | - | - |
| `parsedQuery.filters.industryTags` | `array<string>` | N | - | - |
| `parsedQuery.filters.patentType` | `ref:PatentType` | N | - | - |
| `parsedQuery.filters.priceMax` | `ref:MoneyFen` | N | - | - |
| `parsedQuery.filters.priceMin` | `ref:MoneyFen` | N | - | - |
| `parsedQuery.filters.priceType` | `ref:PriceType` | N | - | - |
| `parsedQuery.filters.q` | `string` | N | - | - |
| `parsedQuery.filters.regionCode` | `string` | N | - | - |
| `parsedQuery.filters.tradeMode` | `ref:TradeMode` | N | - | - |
| `parsedQuery.keywords` | `array<string>` | N | - | - |
| `queryId` | `ref:Uuid` | Y | - | - |
| `recognizedText` | `string` | N | - | - |
| `topMatches` | `array<ref:AiAgentMatchSummary>` | N | - | - |
| `topMatches[].contentId` | `ref:Uuid` | Y | - | - |
| `topMatches[].contentType` | `ref:AiContentType` | Y | - | - |
| `topMatches[].reason` | `string` | N | - | - |
| `topMatches[].score` | `number` | N | - | - |
| `topMatches[].title` | `string` | Y | - | - |

### 6.18 `AiContentType`

- No flattenable fields in this schema.

### 6.19 `AiParseFeedback`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `actorType` | `ref:AiParseFeedbackActorType` | Y | - | - |
| `actorUserId` | `ref:Uuid` | N | - | - |
| `comment` | `string` | N | - | - |
| `createdAt` | `string` | Y | - | - |
| `id` | `ref:Uuid` | Y | - | - |
| `parseResultId` | `ref:Uuid` | Y | - | - |
| `reasonTags` | `array<string>` | N | - | - |
| `score` | `integer` | Y | - | - |

### 6.20 `AiParseFeedbackRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `comment` | `string` | N | - | - |
| `reasonTags` | `array<string>` | N | - | - |
| `score` | `integer` | Y | - | - |

### 6.21 `AiParseResult`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `confidence` | `number` | Y | - | - |
| `contentId` | `ref:Uuid` | Y | - | - |
| `contentType` | `ref:AiContentType` | Y | - | - |
| `createdAt` | `string` | Y | - | - |
| `featuresPlain` | `string` | N | - | - |
| `id` | `ref:Uuid` | Y | - | - |
| `keywords` | `array<string>` | N | - | - |
| `modelVersion` | `string` | N | - | - |
| `status` | `ref:AiParseStatus` | Y | - | - |
| `summaryPlain` | `string` | N | - | - |
| `updatedAt` | `string` | N | - | - |

### 6.22 `AiParseResultUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `featuresPlain` | `string` | N | - | - |
| `keywords` | `array<string>` | N | - | - |
| `note` | `string` | N | - | - |
| `status` | `ref:AiParseStatus` | N | - | - |
| `summaryPlain` | `string` | N | - | - |

### 6.23 `AiParseStatus`

- No flattenable fields in this schema.

### 6.24 `AlertChannel`

- No flattenable fields in this schema.

### 6.25 `AlertConfig`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `defaultChannels` | `array<ref:AlertChannel>` | N | - | - |
| `enabled` | `boolean` | Y | - | - |
| `rules` | `array<ref:AlertRule>` | Y | - | - |
| `rules[].channels` | `array<ref:AlertChannel>` | Y | - | - |
| `rules[].cooldownMinutes` | `integer` | N | - | - |
| `rules[].enabled` | `boolean` | Y | - | - |
| `rules[].severity` | `ref:AlertSeverity` | Y | - | - |
| `rules[].threshold` | `number` | N | - | - |
| `rules[].type` | `string` | Y | - | - |

### 6.26 `AlertConfigUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `defaultChannels` | `array<ref:AlertChannel>` | N | - | - |
| `enabled` | `boolean` | N | - | - |
| `rules` | `array<ref:AlertRule>` | N | - | - |
| `rules[].channels` | `array<ref:AlertChannel>` | Y | - | - |
| `rules[].cooldownMinutes` | `integer` | N | - | - |
| `rules[].enabled` | `boolean` | Y | - | - |
| `rules[].severity` | `ref:AlertSeverity` | Y | - | - |
| `rules[].threshold` | `number` | N | - | - |
| `rules[].type` | `string` | Y | - | - |

### 6.27 `AlertEvent`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `channel` | `ref:AlertChannel` | Y | - | - |
| `id` | `ref:Uuid` | Y | - | - |
| `message` | `string` | N | - | - |
| `sentAt` | `string` | N | - | - |
| `severity` | `ref:AlertSeverity` | Y | - | - |
| `status` | `ref:AlertStatus` | Y | - | - |
| `targetId` | `ref:Uuid` | N | - | - |
| `targetType` | `ref:AlertTargetType` | N | - | - |
| `triggeredAt` | `string` | Y | - | - |
| `type` | `string` | Y | - | - |

### 6.28 `AlertSeverity`

- No flattenable fields in this schema.

### 6.29 `AlertStatus`

- No flattenable fields in this schema.

### 6.30 `AlertTargetType`

- No flattenable fields in this schema.

### 6.31 `AuditLogList`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:AuditLog>` | Y | - | - |
| `items[].action` | `string` | Y | - | - |
| `items[].createdAt` | `string` | Y | - | - |
| `items[].id` | `ref:Uuid` | Y | - | - |
| `items[].operatorId` | `ref:Uuid` | N | - | - |
| `items[].operatorName` | `string` | N | - | - |
| `items[].reason` | `string` | N | - | - |

### 6.32 `AuditMaterialList`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:AuditMaterial>` | Y | - | - |
| `items[].id` | `ref:Uuid` | Y | - | - |
| `items[].kind` | `string` | N | - | - |
| `items[].name` | `string` | Y | - | - |
| `items[].uploadedAt` | `string` | Y | - | - |
| `items[].url` | `string` | N | - | - |

### 6.33 `AuditStatus`

- No flattenable fields in this schema.

### 6.34 `AuthSession`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `isAdmin` | `boolean` | Y | - | - |
| `nickname` | `string` | N | - | - |
| `permissions` | `array<string>` | Y | - | - |
| `role` | `string` | N | - | - |
| `roleIds` | `array<string>` | Y | - | - |
| `roleNames` | `array<string>` | Y | - | - |
| `userId` | `ref:Uuid` | Y | - | - |
| `verificationStatus` | `string` | N | - | - |
| `verificationType` | `string` | N | - | - |

### 6.35 `AuthTokenResponse`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `accessToken` | `string` | Y | - | - |
| `expiresInSeconds` | `integer` | Y | - | - |
| `refreshToken` | `string` | N | - | - |
| `user` | `ref:UserProfile` | Y | - | - |
| `user.avatarUrl` | `string` | N | - | - |
| `user.createdAt` | `string` | Y | - | - |
| `user.id` | `ref:Uuid` | Y | - | - |
| `user.nickname` | `string` | N | - | - |
| `user.orgCategory` | `ref:SupplyType` | N | - | - |
| `user.phone` | `ref:PhoneNumber` | N | - | - |
| `user.regionCode` | `string` | N | - | - |
| `user.role` | `ref:UserRole` | Y | - | - |
| `user.updatedAt` | `string` | N | - | - |
| `user.verificationStatus` | `ref:VerificationStatus` | N | - | - |
| `user.verificationType` | `ref:VerificationType` | N | - | - |

### 6.36 `BannerConfig`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:BannerItem>` | Y | - | - |
| `items[].enabled` | `boolean` | Y | - | - |
| `items[].id` | `string` | Y | - | - |
| `items[].imageUrl` | `string` | Y | - | - |
| `items[].linkUrl` | `string` | N | - | - |
| `items[].order` | `integer` | Y | - | - |
| `items[].title` | `string` | Y | - | - |

### 6.37 `CaseCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `assigneeId` | `ref:Uuid` | N | - | - |
| `description` | `string` | N | - | - |
| `dueAt` | `string` | N | - | - |
| `orderId` | `ref:Uuid` | N | - | - |
| `priority` | `ref:CasePriority` | N | - | - |
| `requesterName` | `string` | N | - | - |
| `status` | `ref:CaseStatus` | N | - | - |
| `title` | `string` | N | - | - |
| `type` | `ref:CaseType` | N | - | - |

### 6.38 `CaseRecord`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `assigneeId` | `string` | N | - | - |
| `assigneeName` | `string` | N | - | - |
| `createdAt` | `string` | Y | - | - |
| `description` | `string` | N | - | - |
| `dueAt` | `string` | N | - | - |
| `evidenceFiles` | `array<ref:CaseEvidence>` | N | - | - |
| `evidenceFiles[].id` | `string` | Y | - | - |
| `evidenceFiles[].name` | `string` | Y | - | - |
| `evidenceFiles[].url` | `string` | N | - | - |
| `id` | `ref:Uuid` | Y | - | - |
| `notes` | `array<ref:CaseNote>` | Y | - | - |
| `notes[].authorId` | `string` | Y | - | - |
| `notes[].authorName` | `string` | Y | - | - |
| `notes[].content` | `string` | Y | - | - |
| `notes[].createdAt` | `string` | Y | - | - |
| `notes[].id` | `ref:Uuid` | Y | - | - |
| `orderId` | `ref:Uuid` | N | - | - |
| `priority` | `ref:CasePriority` | N | - | - |
| `requesterName` | `string` | N | - | - |
| `slaStatus` | `ref:CaseSlaStatus` | N | - | - |
| `status` | `ref:CaseStatus` | Y | - | - |
| `title` | `string` | Y | - | - |
| `type` | `ref:CaseType` | Y | - | - |
| `updatedAt` | `string` | N | - | - |

### 6.39 `CaseStatus`

- No flattenable fields in this schema.

### 6.40 `CaseType`

- No flattenable fields in this schema.

### 6.41 `CaseWithMilestones`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `caseId` | `ref:Uuid` | Y | - | - |
| `csUserId` | `ref:Uuid` | N | - | - |
| `milestones` | `array<ref:Milestone>` | Y | - | - |
| `milestones[].evidenceFileId` | `ref:Uuid` | N | - | - |
| `milestones[].name` | `ref:MilestoneName` | Y | - | - |
| `milestones[].occurredAt` | `string` | N | - | - |
| `milestones[].status` | `ref:MilestoneStatus` | Y | - | - |
| `orderId` | `ref:Uuid` | Y | - | - |
| `status` | `ref:CaseStatus` | Y | - | - |
| `type` | `ref:CaseType` | Y | - | - |

### 6.42 `Comment`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `contentId` | `ref:Uuid` | Y | - | - |
| `contentType` | `ref:CommentContentType` | Y | - | - |
| `createdAt` | `string` | Y | - | - |
| `id` | `ref:Uuid` | Y | - | - |
| `parentCommentId` | `ref:Uuid` | N | - | - |
| `status` | `ref:CommentStatus` | N | - | - |
| `text` | `string` | Y | - | - |
| `updatedAt` | `string` | N | - | - |
| `user` | `ref:UserBrief` | Y | - | - |
| `user.avatarUrl` | `string` | N | - | - |
| `user.id` | `ref:Uuid` | Y | - | - |
| `user.nickname` | `string` | N | - | - |
| `user.orgCategory` | `ref:SupplyType` | N | - | - |
| `user.role` | `ref:UserRole` | N | - | - |
| `user.verificationStatus` | `ref:VerificationStatus` | N | - | - |
| `user.verificationType` | `ref:VerificationType` | N | - | - |

### 6.43 `CommentContentType`

- No flattenable fields in this schema.

### 6.44 `CommentCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `parentCommentId` | `ref:Uuid` | N | - | - |
| `text` | `string` | Y | - | - |

### 6.45 `CommentStatus`

- No flattenable fields in this schema.

### 6.46 `CommentUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `text` | `string` | Y | - | - |

### 6.47 `ContentSource`

- No flattenable fields in this schema.

### 6.48 `ContractItem`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `canUpload` | `boolean` | N | - | - |
| `counterpartName` | `string` | N | - | - |
| `createdAt` | `string` | Y | - | - |
| `fileUrl` | `string` | N | - | - |
| `id` | `string` | Y | - | - |
| `listingTitle` | `string` | N | - | - |
| `orderId` | `ref:Uuid` | Y | - | - |
| `signedAt` | `string` | N | - | - |
| `status` | `ref:ContractStatus` | Y | - | - |
| `uploadedAt` | `string` | N | - | - |
| `watermarkOwner` | `string` | N | - | - |

### 6.49 `ContractStatus`

- No flattenable fields in this schema.

### 6.50 `ContractUploadRequest`

- No flattenable fields in this schema.

### 6.51 `Conversation`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `buyerUserId` | `ref:Uuid` | Y | - | - |
| `contentId` | `ref:Uuid` | Y | - | - |
| `contentTitle` | `string` | N | - | - |
| `contentType` | `ref:ConversationContentType` | Y | - | - |
| `createdAt` | `string` | Y | - | - |
| `id` | `ref:Uuid` | Y | - | - |
| `lastMessageAt` | `string` | N | - | - |
| `listingId` | `ref:Uuid` | N | - | - |
| `listingTitle` | `string` | N | - | - |
| `orderId` | `ref:Uuid` | N | - | - |
| `sellerUserId` | `ref:Uuid` | Y | - | - |
| `updatedAt` | `string` | Y | - | - |

### 6.52 `ConversationAgentAssignment`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `active` | `boolean` | Y | - | - |
| `assignedAt` | `string` | Y | - | - |
| `conversationId` | `ref:Uuid` | Y | - | - |
| `id` | `ref:Uuid` | Y | - | - |
| `userId` | `ref:Uuid` | Y | - | - |

### 6.53 `ConversationAgentAssignmentRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `userId` | `ref:Uuid` | N | - | - |

### 6.54 `ConversationMessage`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `conversationId` | `ref:Uuid` | Y | - | - |
| `createdAt` | `string` | Y | - | - |
| `fileId` | `ref:Uuid` | N | - | - |
| `fileUrl` | `string` | N | - | - |
| `id` | `ref:Uuid` | Y | - | - |
| `senderUserId` | `ref:Uuid` | Y | - | - |
| `text` | `string` | N | - | - |
| `type` | `ref:ConversationMessageType` | Y | - | - |

### 6.55 `ConversationMessageSendRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `text` | `string` | Y | - | - |
| `type` | `ref:ConversationMessageType` | Y | - | - |

### 6.56 `CustomerServiceConfig`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `defaultReply` | `string` | Y | - | - |
| `phone` | `string` | Y | - | - |

### 6.57 `CustomerServiceConfigUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `assignStrategy` | `ref:CustomerServiceAssignStrategy` | Y | - | - |
| `defaultReply` | `string` | Y | - | - |
| `phone` | `string` | Y | - | - |

### 6.58 `FileObject`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `createdAt` | `string` | Y | - | - |
| `fileName` | `string` | N | - | - |
| `id` | `ref:Uuid` | Y | - | - |
| `mimeType` | `string` | Y | - | - |
| `sizeBytes` | `integer` | Y | - | - |
| `url` | `string` | Y | - | - |

### 6.59 `FilePurpose`

- No flattenable fields in this schema.

### 6.60 `FileTemporaryAccessRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `expiresInSeconds` | `integer` | N | - | - |
| `scope` | `ref:FileTemporaryAccessScope` | N | - | - |
| `ttlSeconds` | `integer` | N | - | - |

### 6.61 `FileTemporaryAccessResponse`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `expiresAt` | `string` | Y | - | - |
| `scope` | `ref:FileTemporaryAccessScope` | Y | - | - |
| `url` | `string` | Y | - | - |

### 6.62 `FinanceReportExportResponse`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `exportUrl` | `string` | Y | - | - |

### 6.63 `FinanceReportSummary`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `commissionAmountFen` | `ref:MoneyFen` | Y | - | - |
| `dealAmountFen` | `ref:MoneyFen` | Y | - | - |
| `ordersTotal` | `integer` | Y | - | - |
| `payoutSuccessRate` | `number` | Y | - | - |
| `range` | `ref:FinanceReportRange` | Y | - | - |
| `range.end` | `string` | Y | - | - |
| `range.start` | `string` | Y | - | - |
| `refundRate` | `number` | Y | - | - |

### 6.64 `HomeAnnouncementConfig`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:HomeAnnouncementItem>` | Y | - | - |
| `items[].content` | `string` | Y | - | - |
| `items[].createdAt` | `string` | Y | - | - |
| `items[].endAt` | `string` | N | - | - |
| `items[].id` | `string` | Y | - | - |
| `items[].linkUrl` | `string` | N | - | - |
| `items[].order` | `integer` | Y | - | - |
| `items[].pinned` | `boolean` | Y | - | - |
| `items[].publishedAt` | `string` | N | - | - |
| `items[].startAt` | `string` | N | - | - |
| `items[].status` | `ref:HomeAnnouncementStatus` | Y | - | - |
| `items[].tag` | `string` | N | - | - |
| `items[].templateId` | `string` | N | - | - |
| `items[].title` | `string` | Y | - | - |
| `items[].updatedAt` | `string` | Y | - | - |
| `schemaVersion` | `integer` | Y | - | - |
| `templates` | `array<ref:HomeAnnouncementTemplate>` | Y | - | - |
| `templates[].content` | `string` | Y | - | - |
| `templates[].createdAt` | `string` | Y | - | - |
| `templates[].enabled` | `boolean` | Y | - | - |
| `templates[].id` | `string` | Y | - | - |
| `templates[].linkUrl` | `string` | N | - | - |
| `templates[].name` | `string` | Y | - | - |
| `templates[].tag` | `string` | N | - | - |
| `templates[].title` | `string` | Y | - | - |
| `templates[].updatedAt` | `string` | Y | - | - |

### 6.65 `HomeAnnouncementItem`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `content` | `string` | Y | - | - |
| `createdAt` | `string` | Y | - | - |
| `endAt` | `string` | N | - | - |
| `id` | `string` | Y | - | - |
| `linkUrl` | `string` | N | - | - |
| `order` | `integer` | Y | - | - |
| `pinned` | `boolean` | Y | - | - |
| `publishedAt` | `string` | N | - | - |
| `startAt` | `string` | N | - | - |
| `status` | `ref:HomeAnnouncementStatus` | Y | - | - |
| `tag` | `string` | N | - | - |
| `templateId` | `string` | N | - | - |
| `title` | `string` | Y | - | - |
| `updatedAt` | `string` | Y | - | - |

### 6.66 `HomeAnnouncementItemCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `content` | `string` | N | - | - |
| `endAt` | `string` | N | - | - |
| `linkUrl` | `string` | N | - | - |
| `order` | `integer` | N | - | - |
| `pinned` | `boolean` | N | - | - |
| `startAt` | `string` | N | - | - |
| `status` | `ref:HomeAnnouncementStatus` | N | - | - |
| `tag` | `string` | N | - | - |
| `templateId` | `string` | N | - | - |
| `title` | `string` | N | - | - |

### 6.67 `HomeAnnouncementItemDeleteResult`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `deletedItemId` | `string` | Y | - | - |
| `ok` | `boolean` | Y | - | - |

### 6.68 `HomeAnnouncementItemUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `content` | `string` | N | - | - |
| `endAt` | `string` | N | - | - |
| `linkUrl` | `string` | N | - | - |
| `order` | `integer` | N | - | - |
| `pinned` | `boolean` | N | - | - |
| `startAt` | `string` | N | - | - |
| `status` | `ref:HomeAnnouncementStatus` | N | - | - |
| `tag` | `string` | N | - | - |
| `templateId` | `string` | N | - | - |
| `title` | `string` | N | - | - |

### 6.69 `HomeAnnouncementTemplate`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `content` | `string` | Y | - | - |
| `createdAt` | `string` | Y | - | - |
| `enabled` | `boolean` | Y | - | - |
| `id` | `string` | Y | - | - |
| `linkUrl` | `string` | N | - | - |
| `name` | `string` | Y | - | - |
| `tag` | `string` | N | - | - |
| `title` | `string` | Y | - | - |
| `updatedAt` | `string` | Y | - | - |

### 6.70 `HomeAnnouncementTemplateCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `content` | `string` | Y | - | - |
| `enabled` | `boolean` | N | - | - |
| `linkUrl` | `string` | N | - | - |
| `name` | `string` | Y | - | - |
| `tag` | `string` | N | - | - |
| `title` | `string` | Y | - | - |

### 6.71 `HomeAnnouncementTemplateDeleteResult`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `deletedTemplateId` | `string` | Y | - | - |
| `ok` | `boolean` | Y | - | - |

### 6.72 `HomeAnnouncementTemplateUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `content` | `string` | N | - | - |
| `enabled` | `boolean` | N | - | - |
| `linkUrl` | `string` | N | - | - |
| `name` | `string` | N | - | - |
| `tag` | `string` | N | - | - |
| `title` | `string` | N | - | - |

### 6.73 `HotSearchConfig`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `keywords` | `array<string>` | Y | - | - |

### 6.74 `IndustryTag`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `createdAt` | `string` | N | - | - |
| `id` | `ref:Uuid` | Y | - | - |
| `name` | `string` | Y | - | - |
| `updatedAt` | `string` | N | - | - |

### 6.75 `IndustryTagCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `name` | `string` | Y | - | - |

### 6.76 `InvoiceRequestResult`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `orderId` | `ref:Uuid` | Y | - | - |
| `status` | `ref:InvoiceStatus` | Y | - | - |

### 6.77 `InvoiceStatus`

- No flattenable fields in this schema.

### 6.78 `LegalStatus`

- No flattenable fields in this schema.

### 6.79 `LicenseMode`

- No flattenable fields in this schema.

### 6.80 `Listing`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `aiParse` | `ref:AiParseResult` | N | - | - |
| `aiParse.confidence` | `number` | Y | - | - |
| `aiParse.contentId` | `ref:Uuid` | Y | - | - |
| `aiParse.contentType` | `ref:AiContentType` | Y | - | - |
| `aiParse.createdAt` | `string` | Y | - | - |
| `aiParse.featuresPlain` | `string` | N | - | - |
| `aiParse.id` | `ref:Uuid` | Y | - | - |
| `aiParse.keywords` | `array<string>` | N | - | - |
| `aiParse.modelVersion` | `string` | N | - | - |
| `aiParse.status` | `ref:AiParseStatus` | Y | - | - |
| `aiParse.summaryPlain` | `string` | N | - | - |
| `aiParse.updatedAt` | `string` | N | - | - |
| `applicantNames` | `array<string>` | N | - | - |
| `applicationNoDisplay` | `string` | N | - | - |
| `assigneeNames` | `array<string>` | N | - | - |
| `auditStatus` | `ref:AuditStatus` | Y | - | - |
| `consultationRouting` | `ref:ConsultationRouting` | N | - | - |
| `coverUrl` | `string` | N | - | - |
| `createdAt` | `string` | Y | - | - |
| `deliverables` | `array<string>` | N | - | - |
| `depositAmountFen` | `ref:MoneyFen` | Y | - | - |
| `encumbranceNote` | `string` | N | - | - |
| `existingLicenseStatus` | `ref:ExistingLicenseStatus` | N | - | - |
| `expectedCompletionDays` | `integer` | N | - | - |
| `featuredLevel` | `ref:FeaturedLevel` | N | - | - |
| `featuredRank` | `integer` | N | - | - |
| `featuredRegionCode` | `string` | N | - | - |
| `featuredUntil` | `string` | N | - | - |
| `filingDate` | `string` | N | - | - |
| `grantDate` | `string` | N | - | - |
| `grantPublicationNoDisplay` | `string` | N | - | - |
| `id` | `ref:Uuid` | Y | - | - |
| `industryTags` | `array<string>` | N | - | - |
| `inventorNames` | `array<string>` | N | - | - |
| `ipcCodes` | `array<string>` | N | - | - |
| `legalStatus` | `ref:LegalStatus` | N | - | - |
| `licenseMode` | `ref:LicenseMode` | N | - | - |
| `listingTopics` | `array<ref:ListingTopic>` | N | - | - |
| `locCodes` | `array<string>` | N | - | - |
| `media` | `array<ref:ListingMedia>` | N | - | - |
| `media[].fileId` | `ref:Uuid` | Y | - | - |
| `media[].sort` | `integer` | Y | - | - |
| `media[].type` | `string` | Y | IMAGE/FILE | - |
| `negotiableNote` | `string` | N | - | - |
| `negotiableRangeFen` | `ref:MoneyFen` | N | - | - |
| `negotiableRangePercent` | `number` | N | - | - |
| `patentId` | `ref:Uuid` | N | - | - |
| `patentNoDisplay` | `string` | N | - | - |
| `patentTermYears` | `integer` | N | - | - |
| `patentType` | `ref:PatentType` | N | - | - |
| `patentTypeDefinition` | `string` | N | - | - |
| `patentTypeDefinitionSource` | `string` | N | - | - |
| `pledgeStatus` | `ref:PledgeStatus` | N | - | - |
| `priceAmountFen` | `ref:MoneyFen` | N | - | - |
| `priceType` | `ref:PriceType` | Y | - | - |
| `proofFileIds` | `array<ref:Uuid>` | N | - | - |
| `publicationDate` | `string` | N | - | - |
| `publicationNoDisplay` | `string` | N | - | - |
| `recommendationScore` | `number` | N | - | - |
| `regionCode` | `string` | N | - | - |
| `sellerUserId` | `ref:Uuid` | N | - | - |
| `source` | `ref:ContentSource` | N | - | - |
| `stats` | `ref:ListingStats` | N | - | - |
| `stats.commentCount` | `integer` | N | - | - |
| `stats.consultCount` | `integer` | Y | - | - |
| `stats.favoriteCount` | `integer` | Y | - | - |
| `stats.viewCount` | `integer` | Y | - | - |
| `status` | `ref:ListingStatus` | Y | - | - |
| `summary` | `string` | N | - | - |
| `title` | `string` | Y | - | - |
| `tradeMode` | `ref:TradeMode` | Y | - | - |
| `transferCount` | `integer` | N | - | - |
| `updatedAt` | `string` | Y | - | - |

### 6.81 `ListingBatchJob`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `action` | `ref:ListingBatchAction` | Y | - | - |
| `createdAt` | `string` | Y | - | - |
| `errorFileId` | `ref:Uuid` | N | - | - |
| `failRate` | `number` | Y | - | - |
| `failedCount` | `integer` | Y | - | - |
| `finishedAt` | `string` | N | - | - |
| `id` | `ref:Uuid` | Y | - | - |
| `operatorUserId` | `ref:Uuid` | Y | - | - |
| `pausedAt` | `string` | N | - | - |
| `reason` | `string` | N | - | - |
| `skippedCount` | `integer` | Y | - | - |
| `startedAt` | `string` | N | - | - |
| `status` | `ref:ListingJobStatus` | Y | - | - |
| `successCount` | `integer` | Y | - | - |
| `totalCount` | `integer` | Y | - | - |
| `updatedAt` | `string` | Y | - | - |

### 6.82 `ListingBatchJobCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `action` | `ref:ListingBatchAction` | Y | - | - |
| `listingIds` | `array<ref:Uuid>` | Y | - | - |
| `reason` | `string` | N | - | - |

### 6.83 `ListingConsultationCreated`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `conversationId` | `ref:Uuid` | Y | - | - |
| `ok` | `boolean` | Y | - | - |

### 6.84 `ListingCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `applicantNames` | `array<string>` | N | - | - |
| `assigneeNames` | `array<string>` | N | - | - |
| `consultationRouting` | `ref:ConsultationRouting` | N | - | - |
| `deliverables` | `array<string>` | N | - | - |
| `depositAmountFen` | `ref:MoneyFen` | N | - | - |
| `encumbranceNote` | `string` | N | - | - |
| `existingLicenseStatus` | `ref:ExistingLicenseStatus` | N | - | - |
| `expectedCompletionDays` | `integer` | N | - | - |
| `filingDate` | `string` | N | - | - |
| `grantDate` | `string` | N | - | - |
| `industryTags` | `array<string>` | N | - | - |
| `inventorNames` | `array<string>` | N | - | - |
| `ipcCodes` | `array<string>` | N | - | - |
| `legalStatus` | `ref:LegalStatus` | N | - | - |
| `legalStatusRaw` | `string` | N | - | - |
| `licenseMode` | `ref:LicenseMode` | N | - | - |
| `listingTopics` | `array<ref:ListingTopic>` | N | - | - |
| `locCodes` | `array<string>` | N | - | - |
| `media` | `array<ref:ListingMedia>` | N | - | - |
| `media[].fileId` | `ref:Uuid` | Y | - | - |
| `media[].sort` | `integer` | Y | - | - |
| `media[].type` | `string` | Y | IMAGE/FILE | - |
| `negotiableNote` | `string` | N | - | - |
| `negotiableRangeFen` | `ref:MoneyFen` | N | - | - |
| `negotiableRangePercent` | `number` | N | - | - |
| `patentNumberRaw` | `string` | N | - | - |
| `patentType` | `ref:PatentType` | N | - | - |
| `pledgeStatus` | `ref:PledgeStatus` | N | - | - |
| `priceAmountFen` | `ref:MoneyFen` | N | - | - |
| `priceType` | `ref:PriceType` | Y | - | - |
| `proofFileIds` | `array<ref:Uuid>` | N | - | - |
| `publicationDate` | `string` | N | - | - |
| `regionCode` | `string` | N | - | - |
| `summary` | `string` | N | - | - |
| `title` | `string` | N | - | - |
| `tradeMode` | `ref:TradeMode` | Y | - | - |
| `transferCount` | `integer` | N | - | - |

### 6.85 `ListingFeaturedUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `featuredLevel` | `ref:FeaturedLevel` | Y | - | - |
| `featuredRank` | `integer` | N | - | - |
| `featuredRegionCode` | `string` | N | - | - |
| `featuredUntil` | `string` | N | - | - |

### 6.86 `ListingImportJob`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `createdAt` | `string` | Y | - | - |
| `defaults` | `ref:ListingImportDefaults` | N | - | - |
| `defaults.auditStatus` | `ref:AuditStatus` | N | - | - |
| `defaults.consultationRouting` | `ref:ConsultationRouting` | N | - | - |
| `defaults.depositAmountFen` | `ref:MoneyFen` | N | - | - |
| `defaults.industryTags` | `array<string>` | N | - | - |
| `defaults.licenseMode` | `ref:LicenseMode` | N | - | - |
| `defaults.listingTopics` | `array<ref:ListingTopic>` | N | - | - |
| `defaults.priceAmountFen` | `ref:MoneyFen` | N | - | - |
| `defaults.priceType` | `ref:PriceType` | N | - | - |
| `defaults.regionCode` | `string` | N | - | - |
| `defaults.sellerUserId` | `ref:Uuid` | N | - | - |
| `defaults.source` | `ref:ContentSource` | N | - | - |
| `defaults.status` | `ref:ListingStatus` | N | - | - |
| `defaults.tradeMode` | `ref:TradeMode` | N | - | - |
| `duplicatePolicy` | `ref:ListingImportDuplicatePolicy` | Y | - | - |
| `errorFileId` | `ref:Uuid` | N | - | - |
| `failRate` | `number` | Y | - | - |
| `failedCount` | `integer` | Y | - | - |
| `fileId` | `ref:Uuid` | Y | - | - |
| `finishedAt` | `string` | N | - | - |
| `id` | `ref:Uuid` | Y | - | - |
| `invalidCount` | `integer` | Y | - | - |
| `operatorUserId` | `ref:Uuid` | Y | - | - |
| `pausedAt` | `string` | N | - | - |
| `skippedCount` | `integer` | Y | - | - |
| `startedAt` | `string` | N | - | - |
| `status` | `ref:ListingJobStatus` | Y | - | - |
| `successCount` | `integer` | Y | - | - |
| `totalCount` | `integer` | Y | - | - |
| `updatedAt` | `string` | Y | - | - |
| `validCount` | `integer` | Y | - | - |
| `validatedAt` | `string` | N | - | - |

### 6.87 `ListingImportJobCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `defaults` | `ref:ListingImportDefaults` | N | - | - |
| `defaults.auditStatus` | `ref:AuditStatus` | N | - | - |
| `defaults.consultationRouting` | `ref:ConsultationRouting` | N | - | - |
| `defaults.depositAmountFen` | `ref:MoneyFen` | N | - | - |
| `defaults.industryTags` | `array<string>` | N | - | - |
| `defaults.licenseMode` | `ref:LicenseMode` | N | - | - |
| `defaults.listingTopics` | `array<ref:ListingTopic>` | N | - | - |
| `defaults.priceAmountFen` | `ref:MoneyFen` | N | - | - |
| `defaults.priceType` | `ref:PriceType` | N | - | - |
| `defaults.regionCode` | `string` | N | - | - |
| `defaults.sellerUserId` | `ref:Uuid` | N | - | - |
| `defaults.source` | `ref:ContentSource` | N | - | - |
| `defaults.status` | `ref:ListingStatus` | N | - | - |
| `defaults.tradeMode` | `ref:TradeMode` | N | - | - |
| `duplicatePolicy` | `ref:ListingImportDuplicatePolicy` | N | - | - |
| `fileId` | `ref:Uuid` | Y | - | - |

### 6.88 `ListingJobErrorFile`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `fileId` | `ref:Uuid` | Y | - | - |
| `url` | `string` | Y | - | - |

### 6.89 `ListingPublic`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `aiParse` | `ref:AiParseResult` | N | - | - |
| `aiParse.confidence` | `number` | Y | - | - |
| `aiParse.contentId` | `ref:Uuid` | Y | - | - |
| `aiParse.contentType` | `ref:AiContentType` | Y | - | - |
| `aiParse.createdAt` | `string` | Y | - | - |
| `aiParse.featuresPlain` | `string` | N | - | - |
| `aiParse.id` | `ref:Uuid` | Y | - | - |
| `aiParse.keywords` | `array<string>` | N | - | - |
| `aiParse.modelVersion` | `string` | N | - | - |
| `aiParse.status` | `ref:AiParseStatus` | Y | - | - |
| `aiParse.summaryPlain` | `string` | N | - | - |
| `aiParse.updatedAt` | `string` | N | - | - |
| `applicantNames` | `array<string>` | N | - | - |
| `applicationNoDisplay` | `string` | N | - | - |
| `assigneeNames` | `array<string>` | N | - | - |
| `auditStatus` | `ref:AuditStatus` | Y | - | - |
| `consultationRouting` | `ref:ConsultationRouting` | N | - | - |
| `coverUrl` | `string` | N | - | - |
| `createdAt` | `string` | Y | - | - |
| `deliverables` | `array<string>` | N | - | - |
| `depositAmountFen` | `ref:MoneyFen` | Y | - | - |
| `encumbranceNote` | `string` | N | - | - |
| `existingLicenseStatus` | `ref:ExistingLicenseStatus` | N | - | - |
| `expectedCompletionDays` | `integer` | N | - | - |
| `featuredLevel` | `ref:FeaturedLevel` | N | - | - |
| `featuredRank` | `integer` | N | - | - |
| `featuredRegionCode` | `string` | N | - | - |
| `featuredUntil` | `string` | N | - | - |
| `filingDate` | `string` | N | - | - |
| `grantDate` | `string` | N | - | - |
| `grantPublicationNoDisplay` | `string` | N | - | - |
| `id` | `ref:Uuid` | Y | - | - |
| `industryTags` | `array<string>` | N | - | - |
| `inventorNames` | `array<string>` | N | - | - |
| `ipcCodes` | `array<string>` | N | - | - |
| `legalStatus` | `ref:LegalStatus` | N | - | - |
| `licenseMode` | `ref:LicenseMode` | N | - | - |
| `listingTopics` | `array<ref:ListingTopic>` | N | - | - |
| `locCodes` | `array<string>` | N | - | - |
| `media` | `array<ref:ListingMedia>` | N | - | - |
| `media[].fileId` | `ref:Uuid` | Y | - | - |
| `media[].sort` | `integer` | Y | - | - |
| `media[].type` | `string` | Y | IMAGE/FILE | - |
| `negotiableNote` | `string` | N | - | - |
| `negotiableRangeFen` | `ref:MoneyFen` | N | - | - |
| `negotiableRangePercent` | `number` | N | - | - |
| `patentId` | `ref:Uuid` | N | - | - |
| `patentNoDisplay` | `string` | N | - | - |
| `patentTermYears` | `integer` | N | - | - |
| `patentType` | `ref:PatentType` | N | - | - |
| `patentTypeDefinition` | `string` | N | - | - |
| `patentTypeDefinitionSource` | `string` | N | - | - |
| `pledgeStatus` | `ref:PledgeStatus` | N | - | - |
| `priceAmountFen` | `ref:MoneyFen` | N | - | - |
| `priceType` | `ref:PriceType` | Y | - | - |
| `publicationDate` | `string` | N | - | - |
| `publicationNoDisplay` | `string` | N | - | - |
| `recommendationScore` | `number` | N | - | - |
| `regionCode` | `string` | N | - | - |
| `seller` | `ref:UserBrief` | N | - | - |
| `seller.avatarUrl` | `string` | N | - | - |
| `seller.id` | `ref:Uuid` | Y | - | - |
| `seller.nickname` | `string` | N | - | - |
| `seller.orgCategory` | `ref:SupplyType` | N | - | - |
| `seller.role` | `ref:UserRole` | N | - | - |
| `seller.verificationStatus` | `ref:VerificationStatus` | N | - | - |
| `seller.verificationType` | `ref:VerificationType` | N | - | - |
| `source` | `ref:ContentSource` | N | - | - |
| `stats` | `ref:ListingStats` | N | - | - |
| `stats.commentCount` | `integer` | N | - | - |
| `stats.consultCount` | `integer` | Y | - | - |
| `stats.favoriteCount` | `integer` | Y | - | - |
| `stats.viewCount` | `integer` | Y | - | - |
| `status` | `ref:ListingStatus` | Y | - | - |
| `summary` | `string` | N | - | - |
| `title` | `string` | Y | - | - |
| `tradeMode` | `ref:TradeMode` | Y | - | - |
| `transferCount` | `integer` | N | - | - |
| `updatedAt` | `string` | Y | - | - |

### 6.90 `ListingStatus`

- No flattenable fields in this schema.

### 6.91 `ListingTopic`

- No flattenable fields in this schema.

### 6.92 `ListingUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `applicantNames` | `array<string>` | N | - | - |
| `assigneeNames` | `array<string>` | N | - | - |
| `consultationRouting` | `ref:ConsultationRouting` | N | - | - |
| `deliverables` | `array<string>` | N | - | - |
| `depositAmountFen` | `ref:MoneyFen` | N | - | - |
| `encumbranceNote` | `string` | N | - | - |
| `existingLicenseStatus` | `ref:ExistingLicenseStatus` | N | - | - |
| `expectedCompletionDays` | `integer` | N | - | - |
| `filingDate` | `string` | N | - | - |
| `grantDate` | `string` | N | - | - |
| `industryTags` | `array<string>` | N | - | - |
| `inventorNames` | `array<string>` | N | - | - |
| `ipcCodes` | `array<string>` | N | - | - |
| `legalStatus` | `ref:LegalStatus` | N | - | - |
| `legalStatusRaw` | `string` | N | - | - |
| `licenseMode` | `ref:LicenseMode` | N | - | - |
| `listingTopics` | `array<ref:ListingTopic>` | N | - | - |
| `locCodes` | `array<string>` | N | - | - |
| `media` | `array<ref:ListingMedia>` | N | - | - |
| `media[].fileId` | `ref:Uuid` | Y | - | - |
| `media[].sort` | `integer` | Y | - | - |
| `media[].type` | `string` | Y | IMAGE/FILE | - |
| `negotiableNote` | `string` | N | - | - |
| `negotiableRangeFen` | `ref:MoneyFen` | N | - | - |
| `negotiableRangePercent` | `number` | N | - | - |
| `patentNumberRaw` | `string` | N | - | - |
| `pledgeStatus` | `ref:PledgeStatus` | N | - | - |
| `priceAmountFen` | `ref:MoneyFen` | N | - | - |
| `priceType` | `ref:PriceType` | N | - | - |
| `proofFileIds` | `array<ref:Uuid>` | N | - | - |
| `publicationDate` | `string` | N | - | - |
| `regionCode` | `string` | N | - | - |
| `summary` | `string` | N | - | - |
| `title` | `string` | N | - | - |
| `tradeMode` | `ref:TradeMode` | N | - | - |
| `transferCount` | `integer` | N | - | - |

### 6.93 `ManualPaymentConfirmRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `amountFen` | `ref:MoneyFen` | N | - | - |
| `paidAt` | `string` | N | - | - |
| `payType` | `ref:PayType` | Y | - | - |
| `tradeNo` | `string` | N | - | - |

### 6.94 `ManualPaymentConfirmResponse`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `amountFen` | `ref:MoneyFen` | Y | - | - |
| `orderId` | `ref:Uuid` | Y | - | - |
| `paidAt` | `string` | N | - | - |
| `payType` | `ref:PayType` | Y | - | - |
| `paymentId` | `ref:Uuid` | Y | - | - |
| `status` | `ref:PaymentStatus` | Y | - | - |
| `tradeNo` | `string` | N | - | - |

### 6.95 `ManualPayoutConfirmRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `payoutAt` | `string` | N | - | - |
| `payoutEvidenceFileId` | `ref:Uuid` | Y | - | - |
| `payoutRef` | `string` | N | - | - |
| `remark` | `string` | N | - | - |

### 6.96 `MoneyFen`

- No flattenable fields in this schema.

### 6.97 `Notification`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | - |
| `kind` | `ref:NotificationKind` | Y | - | - |
| `source` | `string` | Y | - | - |
| `summary` | `string` | Y | - | - |
| `time` | `string` | Y | - | - |
| `title` | `string` | Y | - | - |

### 6.98 `OkResponse`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `ok` | `boolean` | Y | - | - |

### 6.99 `Order`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `assignedCsUserId` | `ref:Uuid` | N | - | - |
| `buyerUserId` | `ref:Uuid` | Y | - | - |
| `commissionAmountFen` | `ref:MoneyFen` | N | - | - |
| `createdAt` | `string` | Y | - | - |
| `dealAmountFen` | `ref:MoneyFen` | N | - | - |
| `depositAmountFen` | `ref:MoneyFen` | Y | - | - |
| `finalAmountFen` | `ref:MoneyFen` | N | - | - |
| `id` | `ref:Uuid` | Y | - | - |
| `invoice` | `ref:OrderInvoice` | N | - | - |
| `invoice.amountFen` | `ref:MoneyFen` | N | - | - |
| `invoice.attachedAt` | `string` | N | - | - |
| `invoice.invoiceFile` | `ref:FileObject` | Y | - | - |
| `invoice.invoiceFile.createdAt` | `string` | Y | - | - |
| `invoice.invoiceFile.fileName` | `string` | N | - | - |
| `invoice.invoiceFile.id` | `ref:Uuid` | Y | - | - |
| `invoice.invoiceFile.mimeType` | `string` | Y | - | - |
| `invoice.invoiceFile.sizeBytes` | `integer` | Y | - | - |
| `invoice.invoiceFile.url` | `string` | Y | - | - |
| `invoice.invoiceNo` | `string` | N | - | - |
| `invoice.issuedAt` | `string` | N | - | - |
| `invoice.itemName` | `string` | N | - | - |
| `invoice.orderId` | `ref:Uuid` | Y | - | - |
| `invoice.updatedAt` | `string` | N | - | - |
| `listingId` | `ref:Uuid` | N | - | - |
| `patentId` | `ref:Uuid` | N | - | - |
| `sellerUserId` | `ref:Uuid` | N | - | - |
| `status` | `ref:OrderStatus` | Y | - | - |
| `updatedAt` | `string` | N | - | - |

### 6.100 `OrderInvoice`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `amountFen` | `ref:MoneyFen` | N | - | - |
| `attachedAt` | `string` | N | - | - |
| `invoiceFile` | `ref:FileObject` | Y | - | - |
| `invoiceFile.createdAt` | `string` | Y | - | - |
| `invoiceFile.fileName` | `string` | N | - | - |
| `invoiceFile.id` | `ref:Uuid` | Y | - | - |
| `invoiceFile.mimeType` | `string` | Y | - | - |
| `invoiceFile.sizeBytes` | `integer` | Y | - | - |
| `invoiceFile.url` | `string` | Y | - | - |
| `invoiceNo` | `string` | N | - | - |
| `issuedAt` | `string` | N | - | - |
| `itemName` | `string` | N | - | - |
| `orderId` | `ref:Uuid` | Y | - | - |
| `updatedAt` | `string` | N | - | - |

### 6.101 `OrderInvoiceIssueResponse`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `invoiceNo` | `string` | Y | - | - |
| `orderId` | `ref:Uuid` | Y | - | - |

### 6.102 `OrderInvoiceUpsertRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `invoiceFileId` | `ref:Uuid` | Y | - | - |
| `invoiceNo` | `string` | N | - | - |
| `issuedAt` | `string` | N | - | - |

### 6.103 `OrderListRole`

- No flattenable fields in this schema.

### 6.104 `OrderStatus`

- No flattenable fields in this schema.

### 6.105 `OrderStatusGroup`

- No flattenable fields in this schema.

### 6.106 `OrganizationSummary`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `displayName` | `string` | Y | - | - |
| `intro` | `string` | N | - | - |
| `logoUrl` | `string` | N | - | - |
| `orgCategory` | `ref:SupplyType` | N | - | - |
| `regionCode` | `string` | N | - | - |
| `stats` | `ref:OrganizationStats` | N | - | - |
| `stats.listingCount` | `integer` | Y | - | - |
| `stats.patentCount` | `integer` | Y | - | - |
| `userId` | `ref:Uuid` | Y | - | - |
| `verificationStatus` | `ref:VerificationStatus` | Y | - | - |
| `verificationType` | `ref:VerificationType` | Y | - | - |
| `verifiedAt` | `string` | N | - | - |

### 6.107 `PagedAchievementSummary`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:AchievementSummary>` | Y | - | - |
| `items[].auditStatus` | `ref:AuditStatus` | Y | - | - |
| `items[].cooperationModes` | `array<string>` | N | - | - |
| `items[].coverUrl` | `string` | N | - | - |
| `items[].createdAt` | `string` | Y | - | - |
| `items[].id` | `ref:Uuid` | Y | - | - |
| `items[].industryTags` | `array<string>` | N | - | - |
| `items[].keywords` | `array<string>` | N | - | - |
| `items[].maturity` | `ref:AchievementMaturity` | N | - | - |
| `items[].publisher` | `ref:OrganizationSummary` | N | - | - |
| `items[].publisher.displayName` | `string` | Y | - | - |
| `items[].publisher.intro` | `string` | N | - | - |
| `items[].publisher.logoUrl` | `string` | N | - | - |
| `items[].publisher.orgCategory` | `ref:SupplyType` | N | - | - |
| `items[].publisher.regionCode` | `string` | N | - | - |
| `items[].publisher.stats` | `ref:OrganizationStats` | N | - | - |
| `items[].publisher.userId` | `ref:Uuid` | Y | - | - |
| `items[].publisher.verificationStatus` | `ref:VerificationStatus` | Y | - | - |
| `items[].publisher.verificationType` | `ref:VerificationType` | Y | - | - |
| `items[].publisher.verifiedAt` | `string` | N | - | - |
| `items[].regionCode` | `string` | N | - | - |
| `items[].source` | `ref:ContentSource` | N | - | - |
| `items[].stats` | `ref:ListingStats` | N | - | - |
| `items[].stats.commentCount` | `integer` | N | - | - |
| `items[].stats.consultCount` | `integer` | Y | - | - |
| `items[].stats.favoriteCount` | `integer` | Y | - | - |
| `items[].stats.viewCount` | `integer` | Y | - | - |
| `items[].status` | `ref:ContentStatus` | Y | - | - |
| `items[].summary` | `string` | N | - | - |
| `items[].title` | `string` | Y | - | - |
| `page` | `ref:PageMeta` | Y | - | - |
| `page.page` | `integer` | Y | - | - |
| `page.pageSize` | `integer` | Y | - | - |
| `page.total` | `integer` | Y | - | - |

### 6.108 `PagedAiParseResult`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:AiParseResult>` | Y | - | - |
| `items[].confidence` | `number` | Y | - | - |
| `items[].contentId` | `ref:Uuid` | Y | - | - |
| `items[].contentType` | `ref:AiContentType` | Y | - | - |
| `items[].createdAt` | `string` | Y | - | - |
| `items[].featuresPlain` | `string` | N | - | - |
| `items[].id` | `ref:Uuid` | Y | - | - |
| `items[].keywords` | `array<string>` | N | - | - |
| `items[].modelVersion` | `string` | N | - | - |
| `items[].status` | `ref:AiParseStatus` | Y | - | - |
| `items[].summaryPlain` | `string` | N | - | - |
| `items[].updatedAt` | `string` | N | - | - |
| `page` | `ref:PageMeta` | Y | - | - |
| `page.page` | `integer` | Y | - | - |
| `page.pageSize` | `integer` | Y | - | - |
| `page.total` | `integer` | Y | - | - |

### 6.109 `PagedAlertEvent`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:AlertEvent>` | Y | - | - |
| `items[].channel` | `ref:AlertChannel` | Y | - | - |
| `items[].id` | `ref:Uuid` | Y | - | - |
| `items[].message` | `string` | N | - | - |
| `items[].sentAt` | `string` | N | - | - |
| `items[].severity` | `ref:AlertSeverity` | Y | - | - |
| `items[].status` | `ref:AlertStatus` | Y | - | - |
| `items[].targetId` | `ref:Uuid` | N | - | - |
| `items[].targetType` | `ref:AlertTargetType` | N | - | - |
| `items[].triggeredAt` | `string` | Y | - | - |
| `items[].type` | `string` | Y | - | - |
| `page` | `ref:PageMeta` | Y | - | - |
| `page.page` | `integer` | Y | - | - |
| `page.pageSize` | `integer` | Y | - | - |
| `page.total` | `integer` | Y | - | - |

### 6.110 `PagedAuditLog`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:AuditLog>` | Y | - | - |
| `items[].action` | `string` | Y | - | - |
| `items[].createdAt` | `string` | Y | - | - |
| `items[].id` | `ref:Uuid` | Y | - | - |
| `items[].operatorId` | `ref:Uuid` | N | - | - |
| `items[].operatorName` | `string` | N | - | - |
| `items[].reason` | `string` | N | - | - |
| `page` | `ref:PageMeta` | Y | - | - |
| `page.page` | `integer` | Y | - | - |
| `page.pageSize` | `integer` | Y | - | - |
| `page.total` | `integer` | Y | - | - |

### 6.111 `PagedCase`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:CaseRecord>` | Y | - | - |
| `items[].assigneeId` | `string` | N | - | - |
| `items[].assigneeName` | `string` | N | - | - |
| `items[].createdAt` | `string` | Y | - | - |
| `items[].description` | `string` | N | - | - |
| `items[].dueAt` | `string` | N | - | - |
| `items[].evidenceFiles` | `array<ref:CaseEvidence>` | N | - | - |
| `items[].evidenceFiles[].id` | `string` | Y | - | - |
| `items[].evidenceFiles[].name` | `string` | Y | - | - |
| `items[].evidenceFiles[].url` | `string` | N | - | - |
| `items[].id` | `ref:Uuid` | Y | - | - |
| `items[].notes` | `array<ref:CaseNote>` | Y | - | - |
| `items[].notes[].authorId` | `string` | Y | - | - |
| `items[].notes[].authorName` | `string` | Y | - | - |
| `items[].notes[].content` | `string` | Y | - | - |
| `items[].notes[].createdAt` | `string` | Y | - | - |
| `items[].notes[].id` | `ref:Uuid` | Y | - | - |
| `items[].orderId` | `ref:Uuid` | N | - | - |
| `items[].priority` | `ref:CasePriority` | N | - | - |
| `items[].requesterName` | `string` | N | - | - |
| `items[].slaStatus` | `ref:CaseSlaStatus` | N | - | - |
| `items[].status` | `ref:CaseStatus` | Y | - | - |
| `items[].title` | `string` | Y | - | - |
| `items[].type` | `ref:CaseType` | Y | - | - |
| `items[].updatedAt` | `string` | N | - | - |
| `page` | `ref:PageMeta` | Y | - | - |
| `page.page` | `integer` | Y | - | - |
| `page.pageSize` | `integer` | Y | - | - |
| `page.total` | `integer` | Y | - | - |

### 6.112 `PagedComment`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:Comment>` | Y | - | - |
| `items[].contentId` | `ref:Uuid` | Y | - | - |
| `items[].contentType` | `ref:CommentContentType` | Y | - | - |
| `items[].createdAt` | `string` | Y | - | - |
| `items[].id` | `ref:Uuid` | Y | - | - |
| `items[].parentCommentId` | `ref:Uuid` | N | - | - |
| `items[].status` | `ref:CommentStatus` | N | - | - |
| `items[].text` | `string` | Y | - | - |
| `items[].updatedAt` | `string` | N | - | - |
| `items[].user` | `ref:UserBrief` | Y | - | - |
| `items[].user.avatarUrl` | `string` | N | - | - |
| `items[].user.id` | `ref:Uuid` | Y | - | - |
| `items[].user.nickname` | `string` | N | - | - |
| `items[].user.orgCategory` | `ref:SupplyType` | N | - | - |
| `items[].user.role` | `ref:UserRole` | N | - | - |
| `items[].user.verificationStatus` | `ref:VerificationStatus` | N | - | - |
| `items[].user.verificationType` | `ref:VerificationType` | N | - | - |
| `page` | `ref:PageMeta` | Y | - | - |
| `page.page` | `integer` | Y | - | - |
| `page.pageSize` | `integer` | Y | - | - |
| `page.total` | `integer` | Y | - | - |

### 6.113 `PagedCommentThread`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:CommentThread>` | Y | - | - |
| `items[].replies` | `array<ref:Comment>` | Y | - | - |
| `items[].root` | `ref:Comment` | Y | - | - |
| `items[].root.contentId` | `ref:Uuid` | Y | - | - |
| `items[].root.contentType` | `ref:CommentContentType` | Y | - | - |
| `items[].root.createdAt` | `string` | Y | - | - |
| `items[].root.id` | `ref:Uuid` | Y | - | - |
| `items[].root.parentCommentId` | `ref:Uuid` | N | - | - |
| `items[].root.status` | `ref:CommentStatus` | N | - | - |
| `items[].root.text` | `string` | Y | - | - |
| `items[].root.updatedAt` | `string` | N | - | - |
| `items[].root.user` | `ref:UserBrief` | Y | - | - |
| `page` | `ref:PageMeta` | Y | - | - |
| `page.page` | `integer` | Y | - | - |
| `page.pageSize` | `integer` | Y | - | - |
| `page.total` | `integer` | Y | - | - |

### 6.114 `PagedContract`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:ContractItem>` | Y | - | - |
| `items[].canUpload` | `boolean` | N | - | - |
| `items[].counterpartName` | `string` | N | - | - |
| `items[].createdAt` | `string` | Y | - | - |
| `items[].fileUrl` | `string` | N | - | - |
| `items[].id` | `string` | Y | - | - |
| `items[].listingTitle` | `string` | N | - | - |
| `items[].orderId` | `ref:Uuid` | Y | - | - |
| `items[].signedAt` | `string` | N | - | - |
| `items[].status` | `ref:ContractStatus` | Y | - | - |
| `items[].uploadedAt` | `string` | N | - | - |
| `items[].watermarkOwner` | `string` | N | - | - |
| `page` | `ref:PageMeta` | Y | - | - |
| `page.page` | `integer` | Y | - | - |
| `page.pageSize` | `integer` | Y | - | - |
| `page.total` | `integer` | Y | - | - |

### 6.115 `PagedConversationMessage`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:ConversationMessage>` | Y | - | - |
| `items[].conversationId` | `ref:Uuid` | Y | - | - |
| `items[].createdAt` | `string` | Y | - | - |
| `items[].fileId` | `ref:Uuid` | N | - | - |
| `items[].fileUrl` | `string` | N | - | - |
| `items[].id` | `ref:Uuid` | Y | - | - |
| `items[].senderUserId` | `ref:Uuid` | Y | - | - |
| `items[].text` | `string` | N | - | - |
| `items[].type` | `ref:ConversationMessageType` | Y | - | - |
| `nextCursor` | `string` | N | - | - |

### 6.116 `PagedConversationSummary`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:ConversationSummary>` | Y | - | - |
| `items[].assignedAgentUserIds` | `array<ref:Uuid>` | N | - | - |
| `items[].contentId` | `ref:Uuid` | Y | - | - |
| `items[].contentTitle` | `string` | Y | - | - |
| `items[].contentType` | `ref:ConversationContentType` | Y | - | - |
| `items[].counterpart` | `ref:UserBrief` | Y | - | - |
| `items[].counterpart.avatarUrl` | `string` | N | - | - |
| `items[].counterpart.id` | `ref:Uuid` | Y | - | - |
| `items[].counterpart.nickname` | `string` | N | - | - |
| `items[].counterpart.orgCategory` | `ref:SupplyType` | N | - | - |
| `items[].counterpart.role` | `ref:UserRole` | N | - | - |
| `items[].counterpart.verificationStatus` | `ref:VerificationStatus` | N | - | - |
| `items[].counterpart.verificationType` | `ref:VerificationType` | N | - | - |
| `items[].id` | `ref:Uuid` | Y | - | - |
| `items[].lastMessageAt` | `string` | Y | - | - |
| `items[].lastMessagePreview` | `string` | N | - | - |
| `items[].listingId` | `ref:Uuid` | N | - | - |
| `items[].listingTitle` | `string` | N | - | - |
| `items[].listingTopics` | `array<ref:ListingTopic>` | N | - | - |
| `items[].unreadCount` | `integer` | Y | - | - |
| `page` | `ref:PageMeta` | Y | - | - |
| `page.page` | `integer` | Y | - | - |
| `page.pageSize` | `integer` | Y | - | - |
| `page.total` | `integer` | Y | - | - |

### 6.117 `PagedInventorRanking`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:InventorRankingItem>` | Y | - | - |
| `items[].avatarUrl` | `string` | N | - | - |
| `items[].inventorName` | `string` | Y | - | - |
| `items[].listingCount` | `integer` | Y | - | - |
| `items[].patentCount` | `integer` | Y | - | - |
| `page` | `ref:PageMeta` | Y | - | - |
| `page.page` | `integer` | Y | - | - |
| `page.pageSize` | `integer` | Y | - | - |
| `page.total` | `integer` | Y | - | - |

### 6.118 `PagedInvoiceItem`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:InvoiceItem>` | Y | - | - |
| `items[].amountFen` | `ref:MoneyFen` | N | - | - |
| `items[].assignedCsUserId` | `ref:Uuid` | N | - | - |
| `items[].buyerUserId` | `ref:Uuid` | Y | - | - |
| `items[].commissionAmountFen` | `ref:MoneyFen` | N | - | - |
| `items[].createdAt` | `string` | Y | - | - |
| `items[].dealAmountFen` | `ref:MoneyFen` | N | - | - |
| `items[].depositAmountFen` | `ref:MoneyFen` | Y | - | - |
| `items[].finalAmountFen` | `ref:MoneyFen` | N | - | - |
| `items[].id` | `ref:Uuid` | Y | - | - |
| `items[].invoice` | `ref:OrderInvoice` | N | - | - |
| `items[].invoice.amountFen` | `ref:MoneyFen` | N | - | - |
| `items[].invoice.attachedAt` | `string` | N | - | - |
| `items[].invoice.invoiceFile` | `ref:FileObject` | Y | - | - |
| `items[].invoice.invoiceNo` | `string` | N | - | - |
| `items[].invoice.issuedAt` | `string` | N | - | - |
| `items[].invoice.itemName` | `string` | N | - | - |
| `items[].invoice.orderId` | `ref:Uuid` | Y | - | - |
| `items[].invoice.updatedAt` | `string` | N | - | - |
| `items[].invoiceFileUrl` | `string` | N | - | - |
| `items[].invoiceNo` | `string` | N | - | - |
| `items[].invoiceStatus` | `ref:InvoiceStatus` | Y | - | - |
| `items[].issuedAt` | `string` | N | - | - |
| `items[].itemName` | `string` | N | - | - |
| `items[].listingId` | `ref:Uuid` | N | - | - |
| `items[].patentId` | `ref:Uuid` | N | - | - |
| `items[].requestedAt` | `string` | N | - | - |
| `items[].sellerUserId` | `ref:Uuid` | N | - | - |
| `items[].status` | `ref:OrderStatus` | Y | - | - |
| `items[].updatedAt` | `string` | N | - | - |
| `page` | `ref:PageMeta` | Y | - | - |
| `page.page` | `integer` | Y | - | - |
| `page.pageSize` | `integer` | Y | - | - |
| `page.total` | `integer` | Y | - | - |

### 6.119 `PagedListing`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:Listing>` | Y | - | - |
| `items[].aiParse` | `ref:AiParseResult` | N | - | - |
| `items[].aiParse.confidence` | `number` | Y | - | - |
| `items[].aiParse.contentId` | `ref:Uuid` | Y | - | - |
| `items[].aiParse.contentType` | `ref:AiContentType` | Y | - | - |
| `items[].aiParse.createdAt` | `string` | Y | - | - |
| `items[].aiParse.featuresPlain` | `string` | N | - | - |
| `items[].aiParse.id` | `ref:Uuid` | Y | - | - |
| `items[].aiParse.keywords` | `array<string>` | N | - | - |
| `items[].aiParse.modelVersion` | `string` | N | - | - |
| `items[].aiParse.status` | `ref:AiParseStatus` | Y | - | - |
| `items[].aiParse.summaryPlain` | `string` | N | - | - |
| `items[].aiParse.updatedAt` | `string` | N | - | - |
| `items[].applicantNames` | `array<string>` | N | - | - |
| `items[].applicationNoDisplay` | `string` | N | - | - |
| `items[].assigneeNames` | `array<string>` | N | - | - |
| `items[].auditStatus` | `ref:AuditStatus` | Y | - | - |
| `items[].consultationRouting` | `ref:ConsultationRouting` | N | - | - |
| `items[].coverUrl` | `string` | N | - | - |
| `items[].createdAt` | `string` | Y | - | - |
| `items[].deliverables` | `array<string>` | N | - | - |
| `items[].depositAmountFen` | `ref:MoneyFen` | Y | - | - |
| `items[].encumbranceNote` | `string` | N | - | - |
| `items[].existingLicenseStatus` | `ref:ExistingLicenseStatus` | N | - | - |
| `items[].expectedCompletionDays` | `integer` | N | - | - |
| `items[].featuredLevel` | `ref:FeaturedLevel` | N | - | - |
| `items[].featuredRank` | `integer` | N | - | - |
| `items[].featuredRegionCode` | `string` | N | - | - |
| `items[].featuredUntil` | `string` | N | - | - |
| `items[].filingDate` | `string` | N | - | - |
| `items[].grantDate` | `string` | N | - | - |
| `items[].grantPublicationNoDisplay` | `string` | N | - | - |
| `items[].id` | `ref:Uuid` | Y | - | - |
| `items[].industryTags` | `array<string>` | N | - | - |
| `items[].inventorNames` | `array<string>` | N | - | - |
| `items[].ipcCodes` | `array<string>` | N | - | - |
| `items[].legalStatus` | `ref:LegalStatus` | N | - | - |
| `items[].licenseMode` | `ref:LicenseMode` | N | - | - |
| `items[].listingTopics` | `array<ref:ListingTopic>` | N | - | - |
| `items[].locCodes` | `array<string>` | N | - | - |
| `items[].media` | `array<ref:ListingMedia>` | N | - | - |
| `items[].media[].fileId` | `ref:Uuid` | Y | - | - |
| `items[].media[].sort` | `integer` | Y | - | - |
| `items[].media[].type` | `string` | Y | IMAGE/FILE | - |
| `items[].negotiableNote` | `string` | N | - | - |
| `items[].negotiableRangeFen` | `ref:MoneyFen` | N | - | - |
| `items[].negotiableRangePercent` | `number` | N | - | - |
| `items[].patentId` | `ref:Uuid` | N | - | - |
| `items[].patentNoDisplay` | `string` | N | - | - |
| `items[].patentTermYears` | `integer` | N | - | - |
| `items[].patentType` | `ref:PatentType` | N | - | - |
| `items[].patentTypeDefinition` | `string` | N | - | - |
| `items[].patentTypeDefinitionSource` | `string` | N | - | - |
| `items[].pledgeStatus` | `ref:PledgeStatus` | N | - | - |
| `items[].priceAmountFen` | `ref:MoneyFen` | N | - | - |
| `items[].priceType` | `ref:PriceType` | Y | - | - |
| `items[].proofFileIds` | `array<ref:Uuid>` | N | - | - |
| `items[].publicationDate` | `string` | N | - | - |
| `items[].publicationNoDisplay` | `string` | N | - | - |
| `items[].recommendationScore` | `number` | N | - | - |
| `items[].regionCode` | `string` | N | - | - |
| `items[].sellerUserId` | `ref:Uuid` | N | - | - |
| `items[].source` | `ref:ContentSource` | N | - | - |
| `items[].stats` | `ref:ListingStats` | N | - | - |
| `items[].stats.commentCount` | `integer` | N | - | - |
| `items[].stats.consultCount` | `integer` | Y | - | - |
| `items[].stats.favoriteCount` | `integer` | Y | - | - |
| `items[].stats.viewCount` | `integer` | Y | - | - |
| `items[].status` | `ref:ListingStatus` | Y | - | - |
| `items[].summary` | `string` | N | - | - |
| `items[].title` | `string` | Y | - | - |
| `items[].tradeMode` | `ref:TradeMode` | Y | - | - |
| `items[].transferCount` | `integer` | N | - | - |
| `items[].updatedAt` | `string` | Y | - | - |
| `page` | `ref:PageMeta` | Y | - | - |
| `page.page` | `integer` | Y | - | - |
| `page.pageSize` | `integer` | Y | - | - |
| `page.total` | `integer` | Y | - | - |

### 6.120 `PagedListingBatchJob`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:ListingBatchJob>` | Y | - | - |
| `items[].action` | `ref:ListingBatchAction` | Y | - | - |
| `items[].createdAt` | `string` | Y | - | - |
| `items[].errorFileId` | `ref:Uuid` | N | - | - |
| `items[].failRate` | `number` | Y | - | - |
| `items[].failedCount` | `integer` | Y | - | - |
| `items[].finishedAt` | `string` | N | - | - |
| `items[].id` | `ref:Uuid` | Y | - | - |
| `items[].operatorUserId` | `ref:Uuid` | Y | - | - |
| `items[].pausedAt` | `string` | N | - | - |
| `items[].reason` | `string` | N | - | - |
| `items[].skippedCount` | `integer` | Y | - | - |
| `items[].startedAt` | `string` | N | - | - |
| `items[].status` | `ref:ListingJobStatus` | Y | - | - |
| `items[].successCount` | `integer` | Y | - | - |
| `items[].totalCount` | `integer` | Y | - | - |
| `items[].updatedAt` | `string` | Y | - | - |
| `page` | `ref:PageMeta` | Y | - | - |
| `page.page` | `integer` | Y | - | - |
| `page.pageSize` | `integer` | Y | - | - |
| `page.total` | `integer` | Y | - | - |

### 6.121 `PagedListingBatchJobItem`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:ListingBatchJobItem>` | Y | - | - |
| `items[].createdAt` | `string` | Y | - | - |
| `items[].errorCode` | `string` | N | - | - |
| `items[].errorMessage` | `string` | N | - | - |
| `items[].id` | `ref:Uuid` | Y | - | - |
| `items[].jobId` | `ref:Uuid` | Y | - | - |
| `items[].listingId` | `ref:Uuid` | Y | - | - |
| `items[].processedAt` | `string` | N | - | - |
| `items[].status` | `ref:ListingBatchItemStatus` | Y | - | - |
| `items[].updatedAt` | `string` | Y | - | - |
| `page` | `ref:PageMeta` | Y | - | - |
| `page.page` | `integer` | Y | - | - |
| `page.pageSize` | `integer` | Y | - | - |
| `page.total` | `integer` | Y | - | - |

### 6.122 `PagedListingImportJob`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:ListingImportJob>` | Y | - | - |
| `items[].createdAt` | `string` | Y | - | - |
| `items[].defaults` | `ref:ListingImportDefaults` | N | - | - |
| `items[].defaults.auditStatus` | `ref:AuditStatus` | N | - | - |
| `items[].defaults.consultationRouting` | `ref:ConsultationRouting` | N | - | - |
| `items[].defaults.depositAmountFen` | `ref:MoneyFen` | N | - | - |
| `items[].defaults.industryTags` | `array<string>` | N | - | - |
| `items[].defaults.licenseMode` | `ref:LicenseMode` | N | - | - |
| `items[].defaults.listingTopics` | `array<ref:ListingTopic>` | N | - | - |
| `items[].defaults.priceAmountFen` | `ref:MoneyFen` | N | - | - |
| `items[].defaults.priceType` | `ref:PriceType` | N | - | - |
| `items[].defaults.regionCode` | `string` | N | - | - |
| `items[].defaults.sellerUserId` | `ref:Uuid` | N | - | - |
| `items[].defaults.source` | `ref:ContentSource` | N | - | - |
| `items[].defaults.status` | `ref:ListingStatus` | N | - | - |
| `items[].defaults.tradeMode` | `ref:TradeMode` | N | - | - |
| `items[].duplicatePolicy` | `ref:ListingImportDuplicatePolicy` | Y | - | - |
| `items[].errorFileId` | `ref:Uuid` | N | - | - |
| `items[].failRate` | `number` | Y | - | - |
| `items[].failedCount` | `integer` | Y | - | - |
| `items[].fileId` | `ref:Uuid` | Y | - | - |
| `items[].finishedAt` | `string` | N | - | - |
| `items[].id` | `ref:Uuid` | Y | - | - |
| `items[].invalidCount` | `integer` | Y | - | - |
| `items[].operatorUserId` | `ref:Uuid` | Y | - | - |
| `items[].pausedAt` | `string` | N | - | - |
| `items[].skippedCount` | `integer` | Y | - | - |
| `items[].startedAt` | `string` | N | - | - |
| `items[].status` | `ref:ListingJobStatus` | Y | - | - |
| `items[].successCount` | `integer` | Y | - | - |
| `items[].totalCount` | `integer` | Y | - | - |
| `items[].updatedAt` | `string` | Y | - | - |
| `items[].validCount` | `integer` | Y | - | - |
| `items[].validatedAt` | `string` | N | - | - |
| `page` | `ref:PageMeta` | Y | - | - |
| `page.page` | `integer` | Y | - | - |
| `page.pageSize` | `integer` | Y | - | - |
| `page.total` | `integer` | Y | - | - |

### 6.123 `PagedListingImportJobRow`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:ListingImportJobRow>` | Y | - | - |
| `items[].createdAt` | `string` | Y | - | - |
| `items[].errorCode` | `string` | N | - | - |
| `items[].errorMessage` | `string` | N | - | - |
| `items[].id` | `ref:Uuid` | Y | - | - |
| `items[].jobId` | `ref:Uuid` | Y | - | - |
| `items[].listingId` | `ref:Uuid` | N | - | - |
| `items[].normalized` | `object` | N | - | - |
| `items[].processedAt` | `string` | N | - | - |
| `items[].raw` | `object` | N | - | - |
| `items[].rowNo` | `integer` | Y | - | - |
| `items[].status` | `ref:ListingImportRowStatus` | Y | - | - |
| `items[].updatedAt` | `string` | Y | - | - |
| `page` | `ref:PageMeta` | Y | - | - |
| `page.page` | `integer` | Y | - | - |
| `page.pageSize` | `integer` | Y | - | - |
| `page.total` | `integer` | Y | - | - |

### 6.124 `PagedListingSummary`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:ListingSummary>` | Y | - | - |
| `items[].applicantNames` | `array<string>` | N | - | - |
| `items[].applicationNoDisplay` | `string` | N | - | - |
| `items[].assigneeNames` | `array<string>` | N | - | - |
| `items[].auditStatus` | `ref:AuditStatus` | Y | - | - |
| `items[].consultationRouting` | `ref:ConsultationRouting` | N | - | - |
| `items[].coverUrl` | `string` | N | - | - |
| `items[].createdAt` | `string` | Y | - | - |
| `items[].depositAmountFen` | `ref:MoneyFen` | Y | - | - |
| `items[].featuredLevel` | `ref:FeaturedLevel` | N | - | - |
| `items[].featuredRank` | `integer` | N | - | - |
| `items[].featuredRegionCode` | `string` | N | - | - |
| `items[].featuredUntil` | `string` | N | - | - |
| `items[].filingDate` | `string` | N | - | - |
| `items[].grantDate` | `string` | N | - | - |
| `items[].grantPublicationNoDisplay` | `string` | N | - | - |
| `items[].id` | `ref:Uuid` | Y | - | - |
| `items[].industryTags` | `array<string>` | N | - | - |
| `items[].inventorNames` | `array<string>` | N | - | - |
| `items[].legalStatus` | `ref:LegalStatus` | N | - | - |
| `items[].licenseMode` | `ref:LicenseMode` | N | - | - |
| `items[].listingTopics` | `array<ref:ListingTopic>` | N | - | - |
| `items[].patentId` | `ref:Uuid` | N | - | - |
| `items[].patentNoDisplay` | `string` | N | - | - |
| `items[].patentTermYears` | `integer` | N | - | - |
| `items[].patentType` | `ref:PatentType` | N | - | - |
| `items[].patentTypeDefinition` | `string` | N | - | - |
| `items[].patentTypeDefinitionSource` | `string` | N | - | - |
| `items[].priceAmountFen` | `ref:MoneyFen` | N | - | - |
| `items[].priceType` | `ref:PriceType` | Y | - | - |
| `items[].publicationDate` | `string` | N | - | - |
| `items[].publicationNoDisplay` | `string` | N | - | - |
| `items[].recommendationScore` | `number` | N | - | - |
| `items[].regionCode` | `string` | N | - | - |
| `items[].source` | `ref:ContentSource` | N | - | - |
| `items[].stats` | `ref:ListingStats` | N | - | - |
| `items[].stats.commentCount` | `integer` | N | - | - |
| `items[].stats.consultCount` | `integer` | Y | - | - |
| `items[].stats.favoriteCount` | `integer` | Y | - | - |
| `items[].stats.viewCount` | `integer` | Y | - | - |
| `items[].status` | `ref:ListingStatus` | Y | - | - |
| `items[].title` | `string` | Y | - | - |
| `items[].tradeMode` | `ref:TradeMode` | Y | - | - |
| `items[].transferCount` | `integer` | N | - | - |
| `items[].updatedAt` | `string` | Y | - | - |
| `page` | `ref:PageMeta` | Y | - | - |
| `page.page` | `integer` | Y | - | - |
| `page.pageSize` | `integer` | Y | - | - |
| `page.total` | `integer` | Y | - | - |

### 6.125 `PagedMyPatentMaintenanceOrder`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:PatentMaintenanceOrder>` | Y | - | - |
| `items[].applicantUserId` | `ref:Uuid` | Y | - | - |
| `items[].applicationNoDisplay` | `string` | N | - | - |
| `items[].assignedCsUserId` | `ref:Uuid` | N | - | - |
| `items[].canContactSupport` | `boolean` | N | - | - |
| `items[].closeNote` | `string` | N | - | - |
| `items[].createdAt` | `string` | Y | - | - |
| `items[].executedAt` | `string` | N | - | - |
| `items[].id` | `ref:Uuid` | Y | - | - |
| `items[].lateFeeFen` | `integer` | Y | - | - |
| `items[].officialFeeFen` | `integer` | Y | - | - |
| `items[].officialReceiptFileId` | `ref:Uuid` | N | - | - |
| `items[].officialReceiptNo` | `string` | N | - | - |
| `items[].officialSubmissionNo` | `string` | N | - | - |
| `items[].paidAt` | `string` | N | - | - |
| `items[].patentId` | `ref:Uuid` | N | - | - |
| `items[].patentTitle` | `string` | N | - | - |
| `items[].paymentChannel` | `ref:PatentMaintenancePaymentChannel` | N | - | - |
| `items[].paymentDeadline` | `string` | N | - | - |
| `items[].paymentTxnNo` | `string` | N | - | - |
| `items[].receiptIssuedAt` | `string` | N | - | - |
| `items[].reconcileNote` | `string` | N | - | - |
| `items[].reconcileStatus` | `ref:PatentMaintenanceReconcileStatus` | Y | - | - |
| `items[].scheduleDueDate` | `string` | N | - | - |
| `items[].scheduleId` | `ref:Uuid` | Y | - | - |
| `items[].scheduleYearNo` | `integer` | N | - | - |
| `items[].serviceFeeFen` | `integer` | Y | - | - |
| `items[].status` | `ref:PatentMaintenanceOrderStatus` | Y | - | - |
| `items[].totalAmountFen` | `integer` | Y | - | - |
| `items[].updatedAt` | `string` | N | - | - |
| `page` | `ref:PageMeta` | Y | - | - |
| `page.page` | `integer` | Y | - | - |
| `page.pageSize` | `integer` | Y | - | - |
| `page.total` | `integer` | Y | - | - |

### 6.126 `PagedMyPatentMaintenanceSchedule`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:MyPatentMaintenanceSchedule>` | Y | - | - |
| `items[].applicationNoDisplay` | `string` | N | - | - |
| `items[].canContactSupport` | `boolean` | N | - | - |
| `items[].createdAt` | `string` | Y | - | - |
| `items[].dueDate` | `string` | Y | - | - |
| `items[].gracePeriodEnd` | `string` | N | - | - |
| `items[].id` | `ref:Uuid` | Y | - | - |
| `items[].patentId` | `ref:Uuid` | Y | - | - |
| `items[].patentTitle` | `string` | N | - | - |
| `items[].status` | `ref:PatentMaintenanceStatus` | Y | - | - |
| `items[].updatedAt` | `string` | N | - | - |
| `items[].urgency` | `ref:MaintenanceUrgency` | N | - | - |
| `items[].yearNo` | `integer` | Y | - | - |
| `page` | `ref:PageMeta` | Y | - | - |
| `page.page` | `integer` | Y | - | - |
| `page.pageSize` | `integer` | Y | - | - |
| `page.total` | `integer` | Y | - | - |

### 6.127 `PagedMyPatentMaintenanceTask`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:MyPatentMaintenanceTask>` | Y | - | - |
| `items[].applicationNoDisplay` | `string` | N | - | - |
| `items[].assignedCsUserId` | `ref:Uuid` | N | - | - |
| `items[].canContactSupport` | `boolean` | N | - | - |
| `items[].createdAt` | `string` | Y | - | - |
| `items[].evidenceFileId` | `ref:Uuid` | N | - | - |
| `items[].id` | `ref:Uuid` | Y | - | - |
| `items[].note` | `string` | N | - | - |
| `items[].patentId` | `ref:Uuid` | N | - | - |
| `items[].patentTitle` | `string` | N | - | - |
| `items[].scheduleDueDate` | `string` | N | - | - |
| `items[].scheduleId` | `ref:Uuid` | Y | - | - |
| `items[].scheduleStatus` | `ref:PatentMaintenanceStatus` | N | - | - |
| `items[].scheduleYearNo` | `integer` | N | - | - |
| `items[].status` | `ref:PatentMaintenanceTaskStatus` | Y | - | - |
| `items[].updatedAt` | `string` | N | - | - |
| `items[].urgency` | `ref:MaintenanceUrgency` | N | - | - |
| `page` | `ref:PageMeta` | Y | - | - |
| `page.page` | `integer` | Y | - | - |
| `page.pageSize` | `integer` | Y | - | - |
| `page.total` | `integer` | Y | - | - |

### 6.128 `PagedNotification`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:Notification>` | Y | - | - |
| `items[].id` | `ref:Uuid` | Y | - | - |
| `items[].kind` | `ref:NotificationKind` | Y | - | - |
| `items[].source` | `string` | Y | - | - |
| `items[].summary` | `string` | Y | - | - |
| `items[].time` | `string` | Y | - | - |
| `items[].title` | `string` | Y | - | - |
| `page` | `ref:PageMeta` | Y | - | - |
| `page.page` | `integer` | Y | - | - |
| `page.pageSize` | `integer` | Y | - | - |
| `page.total` | `integer` | Y | - | - |

### 6.129 `PagedOrder`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:Order>` | Y | - | - |
| `items[].assignedCsUserId` | `ref:Uuid` | N | - | - |
| `items[].buyerUserId` | `ref:Uuid` | Y | - | - |
| `items[].commissionAmountFen` | `ref:MoneyFen` | N | - | - |
| `items[].createdAt` | `string` | Y | - | - |
| `items[].dealAmountFen` | `ref:MoneyFen` | N | - | - |
| `items[].depositAmountFen` | `ref:MoneyFen` | Y | - | - |
| `items[].finalAmountFen` | `ref:MoneyFen` | N | - | - |
| `items[].id` | `ref:Uuid` | Y | - | - |
| `items[].invoice` | `ref:OrderInvoice` | N | - | - |
| `items[].invoice.amountFen` | `ref:MoneyFen` | N | - | - |
| `items[].invoice.attachedAt` | `string` | N | - | - |
| `items[].invoice.invoiceFile` | `ref:FileObject` | Y | - | - |
| `items[].invoice.invoiceNo` | `string` | N | - | - |
| `items[].invoice.issuedAt` | `string` | N | - | - |
| `items[].invoice.itemName` | `string` | N | - | - |
| `items[].invoice.orderId` | `ref:Uuid` | Y | - | - |
| `items[].invoice.updatedAt` | `string` | N | - | - |
| `items[].listingId` | `ref:Uuid` | N | - | - |
| `items[].patentId` | `ref:Uuid` | N | - | - |
| `items[].sellerUserId` | `ref:Uuid` | N | - | - |
| `items[].status` | `ref:OrderStatus` | Y | - | - |
| `items[].updatedAt` | `string` | N | - | - |
| `page` | `ref:PageMeta` | Y | - | - |
| `page.page` | `integer` | Y | - | - |
| `page.pageSize` | `integer` | Y | - | - |
| `page.total` | `integer` | Y | - | - |

### 6.130 `PagedOrganizationSummary`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:OrganizationSummary>` | Y | - | - |
| `items[].displayName` | `string` | Y | - | - |
| `items[].intro` | `string` | N | - | - |
| `items[].logoUrl` | `string` | N | - | - |
| `items[].orgCategory` | `ref:SupplyType` | N | - | - |
| `items[].regionCode` | `string` | N | - | - |
| `items[].stats` | `ref:OrganizationStats` | N | - | - |
| `items[].stats.listingCount` | `integer` | Y | - | - |
| `items[].stats.patentCount` | `integer` | Y | - | - |
| `items[].userId` | `ref:Uuid` | Y | - | - |
| `items[].verificationStatus` | `ref:VerificationStatus` | Y | - | - |
| `items[].verificationType` | `ref:VerificationType` | Y | - | - |
| `items[].verifiedAt` | `string` | N | - | - |
| `page` | `ref:PageMeta` | Y | - | - |
| `page.page` | `integer` | Y | - | - |
| `page.pageSize` | `integer` | Y | - | - |
| `page.total` | `integer` | Y | - | - |

### 6.131 `PagedPatent`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:Patent>` | Y | - | - |
| `items[].abstract` | `string` | N | - | - |
| `items[].applicantNames` | `array<string>` | N | - | - |
| `items[].applicationNoDisplay` | `string` | N | - | - |
| `items[].applicationNoNorm` | `string` | Y | - | - |
| `items[].assigneeNames` | `array<string>` | N | - | - |
| `items[].caseStatus` | `string` | N | - | - |
| `items[].claimCount` | `integer` | N | - | - |
| `items[].createdAt` | `string` | Y | - | - |
| `items[].filingDate` | `string` | N | - | - |
| `items[].grantDate` | `string` | N | - | - |
| `items[].grantPublicationNoDisplay` | `string` | N | - | - |
| `items[].id` | `ref:Uuid` | Y | - | - |
| `items[].inventorNames` | `array<string>` | N | - | - |
| `items[].jurisdiction` | `ref:Jurisdiction` | Y | - | - |
| `items[].legalStatus` | `ref:LegalStatus` | N | - | - |
| `items[].mainIpcCode` | `string` | N | - | - |
| `items[].media` | `array<ref:PatentMedia>` | N | - | - |
| `items[].media[].fileId` | `ref:Uuid` | Y | - | - |
| `items[].media[].sort` | `integer` | Y | - | - |
| `items[].media[].type` | `string` | Y | COVER/SPEC_FIGURE | - |
| `items[].media[].url` | `string` | N | - | - |
| `items[].ownerClaimSource` | `ref:PatentOwnerClaimSource` | N | - | - |
| `items[].ownerClaimedAt` | `string` | N | - | - |
| `items[].ownerUserId` | `ref:Uuid` | N | - | - |
| `items[].patentNoDisplay` | `string` | N | - | - |
| `items[].patentType` | `ref:PatentType` | Y | - | - |
| `items[].publicationDate` | `string` | N | - | - |
| `items[].publicationNoDisplay` | `string` | N | - | - |
| `items[].sourcePrimary` | `string` | N | USER/ADMIN/PROVIDER | - |
| `items[].sourceUpdatedAt` | `string` | N | - | - |
| `items[].specFigureCount` | `integer` | N | - | - |
| `items[].specPageCount` | `integer` | N | - | - |
| `items[].specWordCount` | `integer` | N | - | - |
| `items[].title` | `string` | Y | - | - |
| `items[].tradeSnapshot` | `ref:PatentTradeSnapshot` | N | - | - |
| `items[].tradeSnapshot.depositAmountFen` | `integer` | N | - | - |
| `items[].tradeSnapshot.listingId` | `ref:Uuid` | N | - | - |
| `items[].tradeSnapshot.priceAmountFen` | `integer` | N | - | - |
| `items[].tradeSnapshot.priceType` | `ref:PriceType` | N | - | - |
| `items[].tradeSnapshot.seller` | `ref:UserBrief` | N | - | - |
| `items[].tradeSnapshot.supplyType` | `ref:SupplyType` | N | - | - |
| `items[].updatedAt` | `string` | N | - | - |
| `page` | `ref:PageMeta` | Y | - | - |
| `page.page` | `integer` | Y | - | - |
| `page.pageSize` | `integer` | Y | - | - |
| `page.total` | `integer` | Y | - | - |

### 6.132 `PagedPatentClaimRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:PatentClaimRequest>` | Y | - | - |
| `items[].applicantUserId` | `ref:Uuid` | Y | - | - |
| `items[].claimReason` | `string` | N | - | - |
| `items[].createdAt` | `string` | Y | - | - |
| `items[].evidenceFileIds` | `array<ref:Uuid>` | Y | - | - |
| `items[].id` | `ref:Uuid` | Y | - | - |
| `items[].patentId` | `ref:Uuid` | Y | - | - |
| `items[].reviewComment` | `string` | N | - | - |
| `items[].reviewedAt` | `string` | N | - | - |
| `items[].reviewerUserId` | `ref:Uuid` | N | - | - |
| `items[].status` | `ref:PatentClaimStatus` | Y | - | - |
| `items[].submittedAt` | `string` | Y | - | - |
| `items[].updatedAt` | `string` | Y | - | - |
| `page` | `ref:PageMeta` | Y | - | - |
| `page.page` | `integer` | Y | - | - |
| `page.pageSize` | `integer` | Y | - | - |
| `page.total` | `integer` | Y | - | - |

### 6.133 `PagedPatentImportJob`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:PatentImportJob>` | Y | - | - |
| `items[].createdAt` | `string` | Y | - | - |
| `items[].defaults` | `ref:PatentImportDefaults` | N | - | - |
| `items[].defaults.listing` | `ref:PatentImportListingDefaults` | N | - | - |
| `items[].duplicatePolicy` | `ref:PatentImportDuplicatePolicy` | Y | - | - |
| `items[].errorFileId` | `ref:Uuid` | N | - | - |
| `items[].failRate` | `number` | Y | - | - |
| `items[].failedCount` | `integer` | Y | - | - |
| `items[].fileId` | `ref:Uuid` | Y | - | - |
| `items[].finishedAt` | `string` | N | - | - |
| `items[].id` | `ref:Uuid` | Y | - | - |
| `items[].invalidCount` | `integer` | Y | - | - |
| `items[].operatorUserId` | `ref:Uuid` | Y | - | - |
| `items[].pausedAt` | `string` | N | - | - |
| `items[].skippedCount` | `integer` | Y | - | - |
| `items[].startedAt` | `string` | N | - | - |
| `items[].status` | `ref:PatentJobStatus` | Y | - | - |
| `items[].successCount` | `integer` | Y | - | - |
| `items[].totalCount` | `integer` | Y | - | - |
| `items[].updatedAt` | `string` | Y | - | - |
| `items[].validCount` | `integer` | Y | - | - |
| `items[].validatedAt` | `string` | N | - | - |
| `page` | `ref:PageMeta` | Y | - | - |
| `page.page` | `integer` | Y | - | - |
| `page.pageSize` | `integer` | Y | - | - |
| `page.total` | `integer` | Y | - | - |

### 6.134 `PagedPatentImportJobRow`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:PatentImportJobRow>` | Y | - | - |
| `items[].createdAt` | `string` | Y | - | - |
| `items[].errorCode` | `string` | N | - | - |
| `items[].errorMessage` | `string` | N | - | - |
| `items[].id` | `ref:Uuid` | Y | - | - |
| `items[].jobId` | `ref:Uuid` | Y | - | - |
| `items[].normalized` | `object` | N | - | - |
| `items[].patentId` | `ref:Uuid` | N | - | - |
| `items[].processedAt` | `string` | N | - | - |
| `items[].raw` | `object` | N | - | - |
| `items[].rowNo` | `integer` | Y | - | - |
| `items[].status` | `ref:PatentImportRowStatus` | Y | - | - |
| `items[].updatedAt` | `string` | Y | - | - |
| `page` | `ref:PageMeta` | Y | - | - |
| `page.page` | `integer` | Y | - | - |
| `page.pageSize` | `integer` | Y | - | - |
| `page.total` | `integer` | Y | - | - |

### 6.135 `PagedPatentMaintenanceOrder`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:PatentMaintenanceOrder>` | Y | - | - |
| `items[].applicantUserId` | `ref:Uuid` | Y | - | - |
| `items[].applicationNoDisplay` | `string` | N | - | - |
| `items[].assignedCsUserId` | `ref:Uuid` | N | - | - |
| `items[].canContactSupport` | `boolean` | N | - | - |
| `items[].closeNote` | `string` | N | - | - |
| `items[].createdAt` | `string` | Y | - | - |
| `items[].executedAt` | `string` | N | - | - |
| `items[].id` | `ref:Uuid` | Y | - | - |
| `items[].lateFeeFen` | `integer` | Y | - | - |
| `items[].officialFeeFen` | `integer` | Y | - | - |
| `items[].officialReceiptFileId` | `ref:Uuid` | N | - | - |
| `items[].officialReceiptNo` | `string` | N | - | - |
| `items[].officialSubmissionNo` | `string` | N | - | - |
| `items[].paidAt` | `string` | N | - | - |
| `items[].patentId` | `ref:Uuid` | N | - | - |
| `items[].patentTitle` | `string` | N | - | - |
| `items[].paymentChannel` | `ref:PatentMaintenancePaymentChannel` | N | - | - |
| `items[].paymentDeadline` | `string` | N | - | - |
| `items[].paymentTxnNo` | `string` | N | - | - |
| `items[].receiptIssuedAt` | `string` | N | - | - |
| `items[].reconcileNote` | `string` | N | - | - |
| `items[].reconcileStatus` | `ref:PatentMaintenanceReconcileStatus` | Y | - | - |
| `items[].scheduleDueDate` | `string` | N | - | - |
| `items[].scheduleId` | `ref:Uuid` | Y | - | - |
| `items[].scheduleYearNo` | `integer` | N | - | - |
| `items[].serviceFeeFen` | `integer` | Y | - | - |
| `items[].status` | `ref:PatentMaintenanceOrderStatus` | Y | - | - |
| `items[].totalAmountFen` | `integer` | Y | - | - |
| `items[].updatedAt` | `string` | N | - | - |
| `page` | `ref:PageMeta` | Y | - | - |
| `page.page` | `integer` | Y | - | - |
| `page.pageSize` | `integer` | Y | - | - |
| `page.total` | `integer` | Y | - | - |

### 6.136 `PagedPatentMaintenanceSchedule`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:PatentMaintenanceSchedule>` | Y | - | - |
| `items[].createdAt` | `string` | Y | - | - |
| `items[].dueDate` | `string` | Y | - | - |
| `items[].gracePeriodEnd` | `string` | N | - | - |
| `items[].id` | `ref:Uuid` | Y | - | - |
| `items[].patentId` | `ref:Uuid` | Y | - | - |
| `items[].status` | `ref:PatentMaintenanceStatus` | Y | - | - |
| `items[].updatedAt` | `string` | N | - | - |
| `items[].yearNo` | `integer` | Y | - | - |
| `page` | `ref:PageMeta` | Y | - | - |
| `page.page` | `integer` | Y | - | - |
| `page.pageSize` | `integer` | Y | - | - |
| `page.total` | `integer` | Y | - | - |

### 6.137 `PagedPatentMaintenanceTask`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:PatentMaintenanceTask>` | Y | - | - |
| `items[].assignedCsUserId` | `ref:Uuid` | N | - | - |
| `items[].createdAt` | `string` | Y | - | - |
| `items[].evidenceFileId` | `ref:Uuid` | N | - | - |
| `items[].id` | `ref:Uuid` | Y | - | - |
| `items[].note` | `string` | N | - | - |
| `items[].scheduleId` | `ref:Uuid` | Y | - | - |
| `items[].status` | `ref:PatentMaintenanceTaskStatus` | Y | - | - |
| `items[].updatedAt` | `string` | N | - | - |
| `page` | `ref:PageMeta` | Y | - | - |
| `page.page` | `integer` | Y | - | - |
| `page.pageSize` | `integer` | Y | - | - |
| `page.total` | `integer` | Y | - | - |

### 6.138 `PagedTechManagerSummary`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:TechManagerSummary>` | Y | - | - |
| `items[].avatarUrl` | `string` | N | - | - |
| `items[].displayName` | `string` | Y | - | - |
| `items[].intro` | `string` | N | - | - |
| `items[].regionCode` | `string` | N | - | - |
| `items[].serviceTags` | `array<string>` | N | - | - |
| `items[].stats` | `ref:TechManagerStats` | N | - | - |
| `items[].stats.consultCount` | `integer` | N | - | - |
| `items[].stats.dealCount` | `integer` | N | - | - |
| `items[].stats.ratingCount` | `integer` | N | - | - |
| `items[].stats.ratingScore` | `number` | N | - | - |
| `items[].userId` | `ref:Uuid` | Y | - | - |
| `items[].verificationStatus` | `ref:VerificationStatus` | Y | - | - |
| `items[].verificationType` | `ref:VerificationType` | Y | - | - |
| `items[].verifiedAt` | `string` | N | - | - |
| `page` | `ref:PageMeta` | Y | - | - |
| `page.page` | `integer` | Y | - | - |
| `page.pageSize` | `integer` | Y | - | - |
| `page.total` | `integer` | Y | - | - |

### 6.139 `PagedUserVerification`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:UserVerification>` | Y | - | - |
| `items[].contactName` | `string` | N | - | - |
| `items[].contactPhoneMasked` | `string` | N | - | - |
| `items[].displayName` | `string` | N | - | - |
| `items[].evidenceFileIds` | `array<ref:Uuid>` | N | - | - |
| `items[].id` | `ref:Uuid` | Y | - | - |
| `items[].idNumberMasked` | `string` | N | - | - |
| `items[].intro` | `string` | N | - | - |
| `items[].logoFileId` | `ref:Uuid` | N | - | - |
| `items[].logoUrl` | `string` | N | - | - |
| `items[].regionCode` | `string` | N | - | - |
| `items[].reviewComment` | `string` | N | - | - |
| `items[].reviewedAt` | `string` | N | - | - |
| `items[].serviceTags` | `array<string>` | N | - | - |
| `items[].status` | `ref:VerificationStatus` | Y | - | - |
| `items[].submittedAt` | `string` | Y | - | - |
| `items[].type` | `ref:VerificationType` | Y | - | - |
| `items[].unifiedSocialCreditCodeMasked` | `string` | N | - | - |
| `items[].userId` | `ref:Uuid` | Y | - | - |
| `page` | `ref:PageMeta` | Y | - | - |
| `page.page` | `integer` | Y | - | - |
| `page.pageSize` | `integer` | Y | - | - |
| `page.total` | `integer` | Y | - | - |

### 6.140 `Patent`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `abstract` | `string` | N | - | - |
| `applicantNames` | `array<string>` | N | - | - |
| `applicationNoDisplay` | `string` | N | - | - |
| `applicationNoNorm` | `string` | Y | - | - |
| `assigneeNames` | `array<string>` | N | - | - |
| `caseStatus` | `string` | N | - | - |
| `claimCount` | `integer` | N | - | - |
| `createdAt` | `string` | Y | - | - |
| `filingDate` | `string` | N | - | - |
| `grantDate` | `string` | N | - | - |
| `grantPublicationNoDisplay` | `string` | N | - | - |
| `id` | `ref:Uuid` | Y | - | - |
| `inventorNames` | `array<string>` | N | - | - |
| `jurisdiction` | `ref:Jurisdiction` | Y | - | - |
| `legalStatus` | `ref:LegalStatus` | N | - | - |
| `mainIpcCode` | `string` | N | - | - |
| `media` | `array<ref:PatentMedia>` | N | - | - |
| `media[].fileId` | `ref:Uuid` | Y | - | - |
| `media[].sort` | `integer` | Y | - | - |
| `media[].type` | `string` | Y | COVER/SPEC_FIGURE | - |
| `media[].url` | `string` | N | - | - |
| `ownerClaimSource` | `ref:PatentOwnerClaimSource` | N | - | - |
| `ownerClaimedAt` | `string` | N | - | - |
| `ownerUserId` | `ref:Uuid` | N | - | - |
| `patentNoDisplay` | `string` | N | - | - |
| `patentType` | `ref:PatentType` | Y | - | - |
| `publicationDate` | `string` | N | - | - |
| `publicationNoDisplay` | `string` | N | - | - |
| `sourcePrimary` | `string` | N | USER/ADMIN/PROVIDER | - |
| `sourceUpdatedAt` | `string` | N | - | - |
| `specFigureCount` | `integer` | N | - | - |
| `specPageCount` | `integer` | N | - | - |
| `specWordCount` | `integer` | N | - | - |
| `title` | `string` | Y | - | - |
| `tradeSnapshot` | `ref:PatentTradeSnapshot` | N | - | - |
| `tradeSnapshot.depositAmountFen` | `integer` | N | - | - |
| `tradeSnapshot.listingId` | `ref:Uuid` | N | - | - |
| `tradeSnapshot.priceAmountFen` | `integer` | N | - | - |
| `tradeSnapshot.priceType` | `ref:PriceType` | N | - | - |
| `tradeSnapshot.seller` | `ref:UserBrief` | N | - | - |
| `tradeSnapshot.seller.avatarUrl` | `string` | N | - | - |
| `tradeSnapshot.seller.id` | `ref:Uuid` | Y | - | - |
| `tradeSnapshot.seller.nickname` | `string` | N | - | - |
| `tradeSnapshot.seller.orgCategory` | `ref:SupplyType` | N | - | - |
| `tradeSnapshot.seller.role` | `ref:UserRole` | N | - | - |
| `tradeSnapshot.seller.verificationStatus` | `ref:VerificationStatus` | N | - | - |
| `tradeSnapshot.seller.verificationType` | `ref:VerificationType` | N | - | - |
| `tradeSnapshot.supplyType` | `ref:SupplyType` | N | - | - |
| `updatedAt` | `string` | N | - | - |

### 6.141 `PatentClaimCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `claimReason` | `string` | N | - | - |
| `evidenceFileIds` | `array<ref:Uuid>` | Y | - | - |
| `patentId` | `ref:Uuid` | Y | - | - |

### 6.142 `PatentClaimRejectRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `reviewComment` | `string` | Y | - | - |

### 6.143 `PatentClaimRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `applicantUserId` | `ref:Uuid` | Y | - | - |
| `claimReason` | `string` | N | - | - |
| `createdAt` | `string` | Y | - | - |
| `evidenceFileIds` | `array<ref:Uuid>` | Y | - | - |
| `id` | `ref:Uuid` | Y | - | - |
| `patentId` | `ref:Uuid` | Y | - | - |
| `reviewComment` | `string` | N | - | - |
| `reviewedAt` | `string` | N | - | - |
| `reviewerUserId` | `ref:Uuid` | N | - | - |
| `status` | `ref:PatentClaimStatus` | Y | - | - |
| `submittedAt` | `string` | Y | - | - |
| `updatedAt` | `string` | Y | - | - |

### 6.144 `PatentClaimReviewRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `reviewComment` | `string` | N | - | - |

### 6.145 `PatentCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `abstract` | `string` | N | - | - |
| `applicantNames` | `array<string>` | N | - | - |
| `applicationNoDisplay` | `string` | N | - | - |
| `applicationNoNorm` | `string` | Y | - | - |
| `assigneeNames` | `array<string>` | N | - | - |
| `filingDate` | `string` | N | - | - |
| `grantDate` | `string` | N | - | - |
| `inventorNames` | `array<string>` | N | - | - |
| `jurisdiction` | `ref:Jurisdiction` | N | - | - |
| `legalStatus` | `ref:LegalStatus` | N | - | - |
| `patentType` | `ref:PatentType` | Y | - | - |
| `publicationDate` | `string` | N | - | - |
| `sourcePrimary` | `string` | N | USER/ADMIN/PROVIDER | - |
| `sourceUpdatedAt` | `string` | N | - | - |
| `title` | `string` | Y | - | - |

### 6.146 `PatentImportJob`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `createdAt` | `string` | Y | - | - |
| `defaults` | `ref:PatentImportDefaults` | N | - | - |
| `defaults.listing` | `ref:PatentImportListingDefaults` | N | - | - |
| `defaults.listing.auditStatus` | `ref:AuditStatus` | N | - | - |
| `defaults.listing.consultationRouting` | `ref:ConsultationRouting` | N | - | - |
| `defaults.listing.depositAmountFen` | `ref:MoneyFen` | N | - | - |
| `defaults.listing.enabled` | `boolean` | N | - | - |
| `defaults.listing.industryTags` | `array<string>` | N | - | - |
| `defaults.listing.licenseMode` | `ref:LicenseMode` | N | - | - |
| `defaults.listing.listingTopics` | `array<ref:ListingTopic>` | N | - | - |
| `defaults.listing.priceAmountFen` | `ref:MoneyFen` | N | - | - |
| `defaults.listing.priceType` | `ref:PriceType` | N | - | - |
| `defaults.listing.regionCode` | `string` | N | - | - |
| `defaults.listing.sellerUserId` | `ref:Uuid` | N | - | - |
| `defaults.listing.status` | `ref:ListingStatus` | N | - | - |
| `defaults.listing.tradeMode` | `ref:TradeMode` | N | - | - |
| `duplicatePolicy` | `ref:PatentImportDuplicatePolicy` | Y | - | - |
| `errorFileId` | `ref:Uuid` | N | - | - |
| `failRate` | `number` | Y | - | - |
| `failedCount` | `integer` | Y | - | - |
| `fileId` | `ref:Uuid` | Y | - | - |
| `finishedAt` | `string` | N | - | - |
| `id` | `ref:Uuid` | Y | - | - |
| `invalidCount` | `integer` | Y | - | - |
| `operatorUserId` | `ref:Uuid` | Y | - | - |
| `pausedAt` | `string` | N | - | - |
| `skippedCount` | `integer` | Y | - | - |
| `startedAt` | `string` | N | - | - |
| `status` | `ref:PatentJobStatus` | Y | - | - |
| `successCount` | `integer` | Y | - | - |
| `totalCount` | `integer` | Y | - | - |
| `updatedAt` | `string` | Y | - | - |
| `validCount` | `integer` | Y | - | - |
| `validatedAt` | `string` | N | - | - |

### 6.147 `PatentImportJobCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `defaults` | `ref:PatentImportDefaults` | N | - | - |
| `defaults.listing` | `ref:PatentImportListingDefaults` | N | - | - |
| `defaults.listing.auditStatus` | `ref:AuditStatus` | N | - | - |
| `defaults.listing.consultationRouting` | `ref:ConsultationRouting` | N | - | - |
| `defaults.listing.depositAmountFen` | `ref:MoneyFen` | N | - | - |
| `defaults.listing.enabled` | `boolean` | N | - | - |
| `defaults.listing.industryTags` | `array<string>` | N | - | - |
| `defaults.listing.licenseMode` | `ref:LicenseMode` | N | - | - |
| `defaults.listing.listingTopics` | `array<ref:ListingTopic>` | N | - | - |
| `defaults.listing.priceAmountFen` | `ref:MoneyFen` | N | - | - |
| `defaults.listing.priceType` | `ref:PriceType` | N | - | - |
| `defaults.listing.regionCode` | `string` | N | - | - |
| `defaults.listing.sellerUserId` | `ref:Uuid` | N | - | - |
| `defaults.listing.status` | `ref:ListingStatus` | N | - | - |
| `defaults.listing.tradeMode` | `ref:TradeMode` | N | - | - |
| `duplicatePolicy` | `ref:PatentImportDuplicatePolicy` | N | - | - |
| `fileId` | `ref:Uuid` | Y | - | - |

### 6.148 `PatentListingGenerateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `duplicatePolicy` | `ref:PatentImportDuplicatePolicy` | N | - | - |
| `listingDefaults` | `ref:PatentImportListingDefaults` | N | - | - |
| `listingDefaults.auditStatus` | `ref:AuditStatus` | N | - | - |
| `listingDefaults.consultationRouting` | `ref:ConsultationRouting` | N | - | - |
| `listingDefaults.depositAmountFen` | `ref:MoneyFen` | N | - | - |
| `listingDefaults.enabled` | `boolean` | N | - | - |
| `listingDefaults.industryTags` | `array<string>` | N | - | - |
| `listingDefaults.licenseMode` | `ref:LicenseMode` | N | - | - |
| `listingDefaults.listingTopics` | `array<ref:ListingTopic>` | N | - | - |
| `listingDefaults.priceAmountFen` | `ref:MoneyFen` | N | - | - |
| `listingDefaults.priceType` | `ref:PriceType` | N | - | - |
| `listingDefaults.regionCode` | `string` | N | - | - |
| `listingDefaults.sellerUserId` | `ref:Uuid` | N | - | - |
| `listingDefaults.status` | `ref:ListingStatus` | N | - | - |
| `listingDefaults.tradeMode` | `ref:TradeMode` | N | - | - |
| `patentIds` | `array<ref:Uuid>` | Y | - | - |

### 6.149 `PatentListingGenerateResult`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `failedCount` | `integer` | Y | - | - |
| `rows` | `array<ref:PatentListingGenerateResultRow>` | Y | - | - |
| `rows[].errorCode` | `string` | N | - | - |
| `rows[].errorMessage` | `string` | N | - | - |
| `rows[].listingId` | `ref:Uuid` | N | - | - |
| `rows[].patentId` | `ref:Uuid` | Y | - | - |
| `rows[].status` | `string` | Y | SUCCEEDED/FAILED/SKIPPED | - |
| `skippedCount` | `integer` | Y | - | - |
| `successCount` | `integer` | Y | - | - |
| `totalCount` | `integer` | Y | - | - |

### 6.150 `PatentMaintenanceOrder`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `applicantUserId` | `ref:Uuid` | Y | - | - |
| `applicationNoDisplay` | `string` | N | - | - |
| `assignedCsUserId` | `ref:Uuid` | N | - | - |
| `canContactSupport` | `boolean` | N | - | - |
| `closeNote` | `string` | N | - | - |
| `createdAt` | `string` | Y | - | - |
| `executedAt` | `string` | N | - | - |
| `id` | `ref:Uuid` | Y | - | - |
| `lateFeeFen` | `integer` | Y | - | - |
| `officialFeeFen` | `integer` | Y | - | - |
| `officialReceiptFileId` | `ref:Uuid` | N | - | - |
| `officialReceiptNo` | `string` | N | - | - |
| `officialSubmissionNo` | `string` | N | - | - |
| `paidAt` | `string` | N | - | - |
| `patentId` | `ref:Uuid` | N | - | - |
| `patentTitle` | `string` | N | - | - |
| `paymentChannel` | `ref:PatentMaintenancePaymentChannel` | N | - | - |
| `paymentDeadline` | `string` | N | - | - |
| `paymentTxnNo` | `string` | N | - | - |
| `receiptIssuedAt` | `string` | N | - | - |
| `reconcileNote` | `string` | N | - | - |
| `reconcileStatus` | `ref:PatentMaintenanceReconcileStatus` | Y | - | - |
| `scheduleDueDate` | `string` | N | - | - |
| `scheduleId` | `ref:Uuid` | Y | - | - |
| `scheduleYearNo` | `integer` | N | - | - |
| `serviceFeeFen` | `integer` | Y | - | - |
| `status` | `ref:PatentMaintenanceOrderStatus` | Y | - | - |
| `totalAmountFen` | `integer` | Y | - | - |
| `updatedAt` | `string` | N | - | - |

### 6.151 `PatentMaintenanceOrderCancelRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `closeNote` | `string` | Y | - | - |

### 6.152 `PatentMaintenanceOrderCloseRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `closeNote` | `string` | N | - | - |

### 6.153 `PatentMaintenanceOrderCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `applicantUserId` | `ref:Uuid` | N | - | - |
| `assignedCsUserId` | `ref:Uuid` | N | - | - |
| `scheduleId` | `ref:Uuid` | Y | - | - |

### 6.154 `PatentMaintenanceOrderEventList`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:PatentMaintenanceOrderEvent>` | Y | - | - |
| `items[].actorNickname` | `string` | N | - | - |
| `items[].actorRole` | `string` | N | - | - |
| `items[].actorUserId` | `ref:Uuid` | N | - | - |
| `items[].createdAt` | `string` | Y | - | - |
| `items[].eventType` | `ref:PatentMaintenanceOrderEventType` | Y | - | - |
| `items[].fromStatus` | `ref:PatentMaintenanceOrderStatus` | N | - | - |
| `items[].id` | `ref:Uuid` | Y | - | - |
| `items[].note` | `string` | N | - | - |
| `items[].orderId` | `ref:Uuid` | Y | - | - |
| `items[].payloadJson` | `object` | N | - | - |
| `items[].toStatus` | `ref:PatentMaintenanceOrderStatus` | Y | - | - |

### 6.155 `PatentMaintenanceOrderExecutionRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `executedAt` | `string` | N | - | - |
| `officialSubmissionNo` | `string` | Y | - | - |

### 6.156 `PatentMaintenanceOrderMyCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `scheduleId` | `ref:Uuid` | Y | - | - |

### 6.157 `PatentMaintenanceOrderPaymentConfirmRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `paidAt` | `string` | N | - | - |
| `paymentChannel` | `ref:PatentMaintenancePaymentChannel` | Y | - | - |
| `paymentTxnNo` | `string` | Y | - | - |

### 6.158 `PatentMaintenanceOrderQuoteRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `assignedCsUserId` | `ref:Uuid` | N | - | - |
| `lateFeeFen` | `integer` | N | - | - |
| `officialFeeFen` | `integer` | Y | - | - |
| `paymentDeadline` | `string` | Y | - | - |
| `serviceFeeFen` | `integer` | Y | - | - |

### 6.159 `PatentMaintenanceOrderReceiptRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `officialReceiptFileId` | `ref:Uuid` | Y | - | - |
| `officialReceiptNo` | `string` | Y | - | - |
| `receiptIssuedAt` | `string` | N | - | - |

### 6.160 `PatentMaintenanceOrderReconcileRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `reconcileNote` | `string` | N | - | - |
| `reconcileStatus` | `ref:PatentMaintenanceReconcileStatus` | Y | - | - |

### 6.161 `PatentMaintenanceSchedule`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `createdAt` | `string` | Y | - | - |
| `dueDate` | `string` | Y | - | - |
| `gracePeriodEnd` | `string` | N | - | - |
| `id` | `ref:Uuid` | Y | - | - |
| `patentId` | `ref:Uuid` | Y | - | - |
| `status` | `ref:PatentMaintenanceStatus` | Y | - | - |
| `updatedAt` | `string` | N | - | - |
| `yearNo` | `integer` | Y | - | - |

### 6.162 `PatentMaintenanceScheduleCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `dueDate` | `string` | Y | - | - |
| `gracePeriodEnd` | `string` | N | - | - |
| `patentId` | `ref:Uuid` | Y | - | - |
| `status` | `ref:PatentMaintenanceStatus` | N | - | - |
| `yearNo` | `integer` | Y | - | - |

### 6.163 `PatentMaintenanceScheduleUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `dueDate` | `string` | N | - | - |
| `gracePeriodEnd` | `string` | N | - | - |
| `status` | `ref:PatentMaintenanceStatus` | N | - | - |

### 6.164 `PatentMaintenanceTask`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `assignedCsUserId` | `ref:Uuid` | N | - | - |
| `createdAt` | `string` | Y | - | - |
| `evidenceFileId` | `ref:Uuid` | N | - | - |
| `id` | `ref:Uuid` | Y | - | - |
| `note` | `string` | N | - | - |
| `scheduleId` | `ref:Uuid` | Y | - | - |
| `status` | `ref:PatentMaintenanceTaskStatus` | Y | - | - |
| `updatedAt` | `string` | N | - | - |

### 6.165 `PatentMaintenanceTaskCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `assignedCsUserId` | `ref:Uuid` | N | - | - |
| `note` | `string` | N | - | - |
| `scheduleId` | `ref:Uuid` | Y | - | - |

### 6.166 `PatentMaintenanceTaskUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `assignedCsUserId` | `ref:Uuid` | N | - | - |
| `evidenceFileId` | `ref:Uuid` | N | - | - |
| `note` | `string` | N | - | - |
| `status` | `ref:PatentMaintenanceTaskStatus` | N | - | - |

### 6.167 `PatentMapBatchUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `listingIds` | `array<ref:Uuid>` | Y | - | - |
| `patch` | `ref:PatentMapListingPatch` | Y | - | - |
| `patch.clearRanking` | `boolean` | N | - | - |
| `patch.featuredLevel` | `ref:FeaturedLevel` | N | - | - |
| `patch.featuredRank` | `integer` | N | - | - |
| `patch.featuredRegionCode` | `string` | N | - | - |
| `patch.featuredUntil` | `string` | N | - | - |
| `patch.regionCode` | `string` | N | - | - |
| `reason` | `string` | N | - | - |

### 6.168 `PatentMapBatchUpdateResponse`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `missingListingIds` | `array<ref:Uuid>` | Y | - | - |
| `ok` | `boolean` | Y | - | - |
| `patchApplied` | `object` | Y | - | - |
| `reason` | `string` | Y | - | - |
| `totalRequested` | `integer` | Y | - | - |
| `updatedCount` | `integer` | Y | - | - |

### 6.169 `PatentMapDataScope`

- No flattenable fields in this schema.

### 6.170 `PatentMapOverviewRegionLevel`

- No flattenable fields in this schema.

### 6.171 `PatentMapOverviewResponse`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `filters` | `object` | Y | - | - |
| `filters.regionLevel` | `ref:PatentMapOverviewRegionLevel` | Y | - | - |
| `filters.scope` | `ref:PatentMapDataScope` | Y | - | - |
| `filters.top` | `integer` | Y | - | - |
| `generatedAt` | `string` | Y | - | - |
| `ranking` | `array<ref:PatentMapRegionItem>` | Y | - | - |
| `ranking[].activeRankedListingCount` | `integer` | Y | - | - |
| `ranking[].centerLat` | `number` | N | - | - |
| `ranking[].centerLng` | `number` | N | - | - |
| `ranking[].listingCount` | `integer` | Y | - | - |
| `ranking[].patentCount` | `integer` | Y | - | - |
| `ranking[].rankPosition` | `integer` | Y | - | - |
| `ranking[].rankedListingCount` | `integer` | Y | - | - |
| `ranking[].regionCode` | `string` | Y | - | - |
| `ranking[].regionLevel` | `ref:PatentMapRegionLevel` | Y | - | - |
| `ranking[].regionName` | `string` | Y | - | - |
| `ranking[].topActiveRank` | `integer` | N | - | - |
| `regions` | `array<ref:PatentMapRegionItem>` | Y | - | - |
| `summary` | `ref:PatentMapOverviewSummary` | Y | - | - |
| `summary.activeRankedListingCount` | `integer` | Y | - | - |
| `summary.mappableRegionCount` | `integer` | Y | - | - |
| `summary.rankedListingCount` | `integer` | Y | - | - |
| `summary.totalListingCount` | `integer` | Y | - | - |
| `summary.totalPatentCount` | `integer` | Y | - | - |
| `summary.totalRegionCount` | `integer` | Y | - | - |
| `summary.unassignedListingCount` | `integer` | Y | - | - |

### 6.172 `PatentMapRegionDetailResponse`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `filters` | `object` | Y | - | - |
| `filters.scope` | `ref:PatentMapDataScope` | Y | - | - |
| `generatedAt` | `string` | Y | - | - |
| `items` | `array<ref:PatentMapRegionDetailItem>` | Y | - | - |
| `items[].applicationNoDisplay` | `string` | N | - | - |
| `items[].createdAt` | `string` | Y | - | - |
| `items[].depositAmountFen` | `integer` | Y | - | - |
| `items[].featuredLevel` | `ref:FeaturedLevel` | Y | - | - |
| `items[].featuredRank` | `integer` | N | - | - |
| `items[].featuredRegionCode` | `string` | N | - | - |
| `items[].featuredUntil` | `string` | N | - | - |
| `items[].isFeaturedActive` | `boolean` | Y | - | - |
| `items[].listingId` | `ref:Uuid` | Y | - | - |
| `items[].patentId` | `ref:Uuid` | N | - | - |
| `items[].patentTitle` | `string` | Y | - | - |
| `items[].patentType` | `ref:PatentType` | N | - | - |
| `items[].priceAmountFen` | `integer` | N | - | - |
| `items[].priceType` | `ref:PriceType` | Y | - | - |
| `items[].regionCode` | `string` | N | - | - |
| `items[].title` | `string` | Y | - | - |
| `items[].tradeMode` | `ref:TradeMode` | Y | - | - |
| `items[].updatedAt` | `string` | Y | - | - |
| `page` | `ref:PageMeta` | Y | - | - |
| `page.page` | `integer` | Y | - | - |
| `page.pageSize` | `integer` | Y | - | - |
| `page.total` | `integer` | Y | - | - |
| `region` | `ref:PatentMapRegionDetailRegion` | Y | - | - |
| `region.centerLat` | `number` | N | - | - |
| `region.centerLng` | `number` | N | - | - |
| `region.code` | `string` | Y | - | - |
| `region.descendantRegionCodeCount` | `integer` | Y | - | - |
| `region.level` | `ref:PatentMapOverviewRegionLevel` | Y | - | - |
| `region.name` | `string` | Y | - | - |
| `region.parentCode` | `string` | N | - | - |
| `summary` | `ref:PatentMapRegionDetailSummary` | Y | - | - |
| `summary.activeRankedListingCount` | `integer` | Y | - | - |
| `summary.listingCount` | `integer` | Y | - | - |
| `summary.patentCount` | `integer` | Y | - | - |
| `summary.rankedListingCount` | `integer` | Y | - | - |
| `summary.topActiveRank` | `integer` | N | - | - |

### 6.173 `PatentNormalizeRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `raw` | `string` | Y | - | - |

### 6.174 `PatentNormalizeResponse`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `applicationNoDisplay` | `string` | N | - | - |
| `applicationNoNorm` | `string` | N | - | - |
| `inputType` | `ref:PatentNumberInputType` | Y | - | - |
| `jurisdiction` | `ref:Jurisdiction` | Y | - | - |
| `kindCode` | `string` | N | - | - |
| `patentNoDisplay` | `string` | N | - | - |
| `patentNoNorm` | `string` | N | - | - |
| `patentType` | `ref:PatentType` | N | - | - |
| `publicationNoDisplay` | `string` | N | - | - |
| `publicationNoNorm` | `string` | N | - | - |
| `warnings` | `array<string>` | N | - | - |

### 6.175 `PatentType`

- No flattenable fields in this schema.

### 6.176 `PatentUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `abstract` | `string` | N | - | - |
| `applicantNames` | `array<string>` | N | - | - |
| `applicationNoDisplay` | `string` | N | - | - |
| `assigneeNames` | `array<string>` | N | - | - |
| `filingDate` | `string` | N | - | - |
| `grantDate` | `string` | N | - | - |
| `inventorNames` | `array<string>` | N | - | - |
| `legalStatus` | `ref:LegalStatus` | N | - | - |
| `patentType` | `ref:PatentType` | N | - | - |
| `publicationDate` | `string` | N | - | - |
| `sourcePrimary` | `string` | N | USER/ADMIN/PROVIDER | - |
| `sourceUpdatedAt` | `string` | N | - | - |
| `title` | `string` | N | - | - |

### 6.177 `PayType`

- No flattenable fields in this schema.

### 6.178 `PaymentIntentResponse`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `amountFen` | `ref:MoneyFen` | Y | - | - |
| `channel` | `string` | Y | WECHAT | - |
| `payType` | `ref:PayType` | Y | - | - |
| `paymentId` | `ref:Uuid` | Y | - | - |
| `wechatPayParams` | `object` | Y | - | - |
| `wechatPayParams.nonceStr` | `string` | Y | - | - |
| `wechatPayParams.package` | `string` | Y | - | - |
| `wechatPayParams.paySign` | `string` | Y | - | - |
| `wechatPayParams.signType` | `string` | Y | - | - |
| `wechatPayParams.timeStamp` | `string` | Y | - | - |

### 6.179 `PhoneNumber`

- No flattenable fields in this schema.

### 6.180 `PriceType`

- No flattenable fields in this schema.

### 6.181 `PublicHomeAnnouncementFeed`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `generatedAt` | `string` | Y | - | - |
| `items` | `array<ref:PublicHomeAnnouncementItem>` | Y | - | - |
| `items[].content` | `string` | Y | - | - |
| `items[].id` | `string` | Y | - | - |
| `items[].linkUrl` | `string` | N | - | - |
| `items[].order` | `integer` | Y | - | - |
| `items[].pinned` | `boolean` | Y | - | - |
| `items[].publishedAt` | `string` | N | - | - |
| `items[].tag` | `string` | N | - | - |
| `items[].title` | `string` | Y | - | - |

### 6.182 `RbacPermissionList`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:RbacPermission>` | Y | - | - |
| `items[].description` | `string` | N | - | - |
| `items[].id` | `string` | Y | - | - |
| `items[].name` | `string` | Y | - | - |

### 6.183 `RbacRole`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `description` | `string` | N | - | - |
| `id` | `ref:Uuid` | Y | - | - |
| `name` | `string` | Y | - | - |
| `permissionIds` | `array<string>` | Y | - | - |
| `updatedAt` | `string` | N | - | - |

### 6.184 `RbacRoleCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `description` | `string` | N | - | - |
| `name` | `string` | Y | - | - |
| `permissionIds` | `array<string>` | N | - | - |
| `reason` | `string` | N | - | - |

### 6.185 `RbacRoleList`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:RbacRole>` | Y | - | - |
| `items[].description` | `string` | N | - | - |
| `items[].id` | `ref:Uuid` | Y | - | - |
| `items[].name` | `string` | Y | - | - |
| `items[].permissionIds` | `array<string>` | Y | - | - |
| `items[].updatedAt` | `string` | N | - | - |

### 6.186 `RbacRoleUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `description` | `string` | N | - | - |
| `name` | `string` | N | - | - |
| `permissionIds` | `array<string>` | N | - | - |
| `reason` | `string` | N | - | - |

### 6.187 `RbacUser`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `email` | `string` | N | - | - |
| `id` | `ref:Uuid` | Y | - | - |
| `name` | `string` | Y | - | - |
| `roleIds` | `array<string>` | Y | - | - |

### 6.188 `RbacUserCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `name` | `string` | Y | - | - |
| `phone` | `ref:PhoneNumber` | Y | - | - |
| `reason` | `string` | N | - | - |
| `roleIds` | `array<string>` | Y | - | - |

### 6.189 `RbacUserList`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:RbacUser>` | Y | - | - |
| `items[].email` | `string` | N | - | - |
| `items[].id` | `ref:Uuid` | Y | - | - |
| `items[].name` | `string` | Y | - | - |
| `items[].roleIds` | `array<string>` | Y | - | - |

### 6.190 `RbacUserRoleUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `reason` | `string` | N | - | - |
| `roleIds` | `array<string>` | Y | - | - |

### 6.191 `RecommendationConfig`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `dedupeWindowHours` | `integer` | Y | - | - |
| `enabled` | `boolean` | Y | - | - |
| `featuredBoost` | `ref:RecommendationFeaturedBoost` | Y | - | - |
| `featuredBoost.city` | `number` | Y | - | - |
| `featuredBoost.province` | `number` | Y | - | - |
| `timeDecayHalfLifeHours` | `integer` | Y | - | - |
| `updatedAt` | `string` | N | - | - |
| `weights` | `ref:RecommendationWeights` | Y | - | - |
| `weights.consult` | `number` | Y | - | - |
| `weights.favorite` | `number` | Y | - | - |
| `weights.region` | `number` | Y | - | - |
| `weights.time` | `number` | Y | - | - |
| `weights.user` | `number` | Y | - | - |
| `weights.view` | `number` | Y | - | - |

### 6.192 `RecommendationConfigUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `dedupeWindowHours` | `integer` | Y | - | - |
| `enabled` | `boolean` | Y | - | - |
| `featuredBoost` | `ref:RecommendationFeaturedBoost` | Y | - | - |
| `featuredBoost.city` | `number` | Y | - | - |
| `featuredBoost.province` | `number` | Y | - | - |
| `timeDecayHalfLifeHours` | `integer` | Y | - | - |
| `updatedAt` | `string` | N | - | - |
| `weights` | `ref:RecommendationWeights` | Y | - | - |
| `weights.consult` | `number` | Y | - | - |
| `weights.favorite` | `number` | Y | - | - |
| `weights.region` | `number` | Y | - | - |
| `weights.time` | `number` | Y | - | - |
| `weights.user` | `number` | Y | - | - |
| `weights.view` | `number` | Y | - | - |

### 6.193 `RefundRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `createdAt` | `string` | Y | - | - |
| `id` | `ref:Uuid` | Y | - | - |
| `orderId` | `ref:Uuid` | Y | - | - |
| `reasonCode` | `ref:RefundReasonCode` | N | - | - |
| `reasonText` | `string` | N | - | - |
| `status` | `ref:RefundRequestStatus` | Y | - | - |
| `updatedAt` | `string` | N | - | - |

### 6.194 `RefundRequestCompleteRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `remark` | `string` | N | - | - |

### 6.195 `RefundRequestCreate`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `evidenceFileIds` | `array<ref:Uuid>` | N | - | - |
| `reasonCode` | `ref:RefundReasonCode` | Y | - | - |
| `reasonText` | `string` | N | - | - |

### 6.196 `RegionCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `centerLat` | `number` | N | - | - |
| `centerLng` | `number` | N | - | - |
| `code` | `string` | Y | - | - |
| `level` | `ref:RegionLevel` | Y | - | - |
| `name` | `string` | Y | - | - |
| `parentCode` | `string` | N | - | - |

### 6.197 `RegionLevel`

- No flattenable fields in this schema.

### 6.198 `RegionNode`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `centerLat` | `number` | N | - | - |
| `centerLng` | `number` | N | - | - |
| `code` | `string` | Y | - | - |
| `industryTags` | `array<string>` | N | - | - |
| `level` | `ref:RegionLevel` | Y | - | - |
| `name` | `string` | Y | - | - |
| `parentCode` | `string` | N | - | - |
| `updatedAt` | `string` | N | - | - |

### 6.199 `RegionUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `centerLat` | `number` | N | - | - |
| `centerLng` | `number` | N | - | - |
| `level` | `ref:RegionLevel` | N | - | - |
| `name` | `string` | N | - | - |
| `parentCode` | `string` | N | - | - |

### 6.200 `SensitiveWordsConfig`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `words` | `array<string>` | Y | - | - |

### 6.201 `Settlement`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `commissionAmountFen` | `ref:MoneyFen` | Y | - | - |
| `createdAt` | `string` | Y | - | - |
| `grossAmountFen` | `ref:MoneyFen` | Y | - | - |
| `id` | `ref:Uuid` | Y | - | - |
| `orderId` | `ref:Uuid` | Y | - | - |
| `payoutAmountFen` | `ref:MoneyFen` | Y | - | - |
| `payoutAt` | `string` | N | - | - |
| `payoutEvidenceFileId` | `ref:Uuid` | N | - | - |
| `payoutMethod` | `ref:PayoutMethod` | Y | - | - |
| `payoutRef` | `string` | N | - | - |
| `payoutStatus` | `ref:PayoutStatus` | Y | - | - |
| `updatedAt` | `string` | N | - | - |

### 6.202 `SmsPurpose`

- No flattenable fields in this schema.

### 6.203 `SortBy`

- No flattenable fields in this schema.

### 6.204 `TaxonomyConfig`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `industries` | `array<string>` | Y | - | - |
| `ipcMappings` | `array<string>` | Y | - | - |
| `locMappings` | `array<string>` | Y | - | - |

### 6.205 `TechManagerPublic`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `avatarUrl` | `string` | N | - | - |
| `displayName` | `string` | Y | - | - |
| `evidenceFileIds` | `array<ref:Uuid>` | N | - | - |
| `intro` | `string` | N | - | - |
| `regionCode` | `string` | N | - | - |
| `serviceTags` | `array<string>` | N | - | - |
| `stats` | `ref:TechManagerStats` | N | - | - |
| `stats.consultCount` | `integer` | N | - | - |
| `stats.dealCount` | `integer` | N | - | - |
| `stats.ratingCount` | `integer` | N | - | - |
| `stats.ratingScore` | `number` | N | - | - |
| `userId` | `ref:Uuid` | Y | - | - |
| `verificationStatus` | `ref:VerificationStatus` | Y | - | - |
| `verificationType` | `ref:VerificationType` | Y | - | - |
| `verifiedAt` | `string` | N | - | - |

### 6.206 `TechManagerSortBy`

- No flattenable fields in this schema.

### 6.207 `TechManagerUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `featuredRank` | `integer` | N | - | - |
| `featuredUntil` | `string` | N | - | - |
| `intro` | `string` | N | - | - |
| `serviceTags` | `array<string>` | N | - | - |

### 6.208 `TradeMode`

- No flattenable fields in this schema.

### 6.209 `TradeRulesConfig`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `autoPayoutOnTimeout` | `boolean` | Y | - | - |
| `autoRefundWindowMinutes` | `integer` | Y | - | - |
| `commissionMaxFen` | `ref:MoneyFen` | Y | - | - |
| `commissionMinFen` | `ref:MoneyFen` | Y | - | - |
| `commissionRate` | `number` | Y | - | - |
| `contractSignedDeadlineBusinessDays` | `integer` | Y | - | - |
| `depositFixedForNegotiableFen` | `ref:MoneyFen` | Y | - | - |
| `depositMaxFen` | `ref:MoneyFen` | Y | - | - |
| `depositMinFen` | `ref:MoneyFen` | Y | - | - |
| `depositRate` | `number` | Y | - | - |
| `payoutCondition` | `ref:PayoutCondition` | Y | - | - |
| `payoutMethodDefault` | `ref:PayoutMethod` | Y | - | - |
| `sellerMaterialDeadlineBusinessDays` | `integer` | Y | - | - |
| `transferCompletedSlaDays` | `integer` | Y | - | - |
| `version` | `integer` | Y | - | - |

### 6.210 `TradeRulesConfigUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `autoPayoutOnTimeout` | `boolean` | Y | - | - |
| `autoRefundWindowMinutes` | `integer` | Y | - | - |
| `commissionMaxFen` | `ref:MoneyFen` | Y | - | - |
| `commissionMinFen` | `ref:MoneyFen` | Y | - | - |
| `commissionRate` | `number` | Y | - | - |
| `contractSignedDeadlineBusinessDays` | `integer` | Y | - | - |
| `depositFixedForNegotiableFen` | `ref:MoneyFen` | Y | - | - |
| `depositMaxFen` | `ref:MoneyFen` | Y | - | - |
| `depositMinFen` | `ref:MoneyFen` | Y | - | - |
| `depositRate` | `number` | Y | - | - |
| `payoutCondition` | `ref:PayoutCondition` | Y | - | - |
| `payoutMethodDefault` | `ref:PayoutMethod` | Y | - | - |
| `sellerMaterialDeadlineBusinessDays` | `integer` | Y | - | - |
| `transferCompletedSlaDays` | `integer` | Y | - | - |

### 6.211 `UserProfile`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `avatarUrl` | `string` | N | - | - |
| `createdAt` | `string` | Y | - | - |
| `id` | `ref:Uuid` | Y | - | - |
| `nickname` | `string` | N | - | - |
| `orgCategory` | `ref:SupplyType` | N | - | - |
| `phone` | `ref:PhoneNumber` | N | - | - |
| `regionCode` | `string` | N | - | - |
| `role` | `ref:UserRole` | Y | - | - |
| `updatedAt` | `string` | N | - | - |
| `verificationStatus` | `ref:VerificationStatus` | N | - | - |
| `verificationType` | `ref:VerificationType` | N | - | - |

### 6.212 `UserVerification`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `contactName` | `string` | N | - | - |
| `contactPhoneMasked` | `string` | N | - | - |
| `displayName` | `string` | N | - | - |
| `evidenceFileIds` | `array<ref:Uuid>` | N | - | - |
| `id` | `ref:Uuid` | Y | - | - |
| `idNumberMasked` | `string` | N | - | - |
| `intro` | `string` | N | - | - |
| `logoFileId` | `ref:Uuid` | N | - | - |
| `logoUrl` | `string` | N | - | - |
| `regionCode` | `string` | N | - | - |
| `reviewComment` | `string` | N | - | - |
| `reviewedAt` | `string` | N | - | - |
| `serviceTags` | `array<string>` | N | - | - |
| `status` | `ref:VerificationStatus` | Y | - | - |
| `submittedAt` | `string` | Y | - | - |
| `type` | `ref:VerificationType` | Y | - | - |
| `unifiedSocialCreditCodeMasked` | `string` | N | - | - |
| `userId` | `ref:Uuid` | Y | - | - |

### 6.213 `UserVerificationSubmitRequest`

- No flattenable fields in this schema.

### 6.214 `Uuid`

- No flattenable fields in this schema.

### 6.215 `VerificationStatus`

- No flattenable fields in this schema.

### 6.216 `VerificationType`

- No flattenable fields in this schema.
## 7. 数据库字段字典（Prisma Models，全量）

说明：包含模型字段、可空性、枚举候选值及 Prisma 属性。

### 7.1 `User`

- 表级属性：
  - `@@map("users")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `phone` | `String?` | N | - | `@unique` |
| `nickname` | `String?` | N | - | `-` |
| `avatarUrl` | `String?` | N | - | `@map("avatar_url")` |
| `wechatOpenid` | `String?` | N | - | `@unique @map("wechat_openid")` |
| `role` | `UserRole` | Y | buyer/seller/cs/operator/finance/admin | `-` |
| `regionCode` | `String?` | N | - | `@map("region_code")` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `region` | `Region?` | N | - | `@relation(fields: [regionCode], references: [code])` |
| `verifications` | `UserVerification[]` | Y | - | `@relation("UserVerification_User")` |
| `reviewedVerifications` | `UserVerification[]` | Y | - | `@relation("UserVerification_Reviewer")` |
| `techManagerProfile` | `TechManagerProfile?` | N | - | `-` |
| `listings` | `Listing[]` | Y | - | `@relation("Listing_Seller")` |
| `achievements` | `Achievement[]` | Y | - | `@relation("Achievement_Publisher")` |
| `orders` | `Order[]` | Y | - | `@relation("Order_Buyer")` |
| `assignedOrders` | `Order[]` | Y | - | `@relation("Order_AssignedCs")` |
| `listingAuditLogs` | `ListingAuditLog[]` | Y | - | `@relation("ListingAuditLog_Reviewer")` |
| `listingFavorites` | `ListingFavorite[]` | Y | - | `-` |
| `achievementFavorites` | `AchievementFavorite[]` | Y | - | `-` |
| `listingConsultEvents` | `ListingConsultEvent[]` | Y | - | `-` |
| `listingBatchJobs` | `ListingBatchJob[]` | Y | - | `@relation("ListingBatchJob_Operator")` |
| `listingImportJobs` | `ListingImportJob[]` | Y | - | `@relation("ListingImportJob_Operator")` |
| `userTagScores` | `UserTagScore[]` | Y | - | `-` |
| `conversationsAsBuyer` | `Conversation[]` | Y | - | `@relation("Conversation_Buyer")` |
| `conversationsAsSeller` | `Conversation[]` | Y | - | `@relation("Conversation_Seller")` |
| `conversationParticipants` | `ConversationParticipant[]` | Y | - | `-` |
| `sentMessages` | `ConversationMessage[]` | Y | - | `@relation("ConversationMessage_Sender")` |
| `notifications` | `Notification[]` | Y | - | `-` |
| `addresses` | `Address[]` | Y | - | `-` |
| `comments` | `Comment[]` | Y | - | `-` |
| `csCases` | `CsCase[]` | Y | - | `@relation("CsCase_Cs")` |
| `caseNotes` | `CsCaseNote[]` | Y | - | `@relation("CsCaseNote_Author")` |
| `systemConfigsUpdated` | `SystemConfig[]` | Y | - | `@relation("SystemConfig_UpdatedBy")` |
| `auditLogs` | `AuditLog[]` | Y | - | `@relation("AuditLog_Actor")` |
| `idempotencyKeys` | `IdempotencyKey[]` | Y | - | `-` |
| `rbacRoles` | `RbacUserRole[]` | Y | - | `-` |
| `aiParseFeedbacks` | `AiParseFeedback[]` | Y | - | `@relation("AiParseFeedback_Actor")` |
| `assignedMaintenanceTasks` | `PatentMaintenanceTask[]` | Y | - | `@relation("PatentMaintenanceTask_Assignee")` |
| `maintenanceOrdersAsApplicant` | `PatentMaintenanceOrder[]` | Y | - | `@relation("PatentMaintenanceOrder_Applicant")` |
| `assignedMaintenanceOrders` | `PatentMaintenanceOrder[]` | Y | - | `@relation("PatentMaintenanceOrder_Assignee")` |
| `maintenanceOrderEvents` | `PatentMaintenanceOrderEvent[]` | Y | - | `@relation("PatentMaintenanceOrderEvent_Actor")` |
| `patentsOwned` | `Patent[]` | Y | - | `@relation("Patent_Owner")` |
| `patentImportJobs` | `PatentImportJob[]` | Y | - | `@relation("PatentImportJob_Operator")` |
| `patentClaimRequests` | `PatentClaimRequest[]` | Y | - | `@relation("PatentClaimRequest_Applicant")` |
| `reviewedPatentClaimRequests` | `PatentClaimRequest[]` | Y | - | `@relation("PatentClaimRequest_Reviewer")` |
| `conversationAgentAssignments` | `ConversationAgent[]` | Y | - | `@relation("ConversationAgent_Operator")` |
| `conversationAgentAssignedBy` | `ConversationAgent[]` | Y | - | `@relation("ConversationAgent_AssignedBy")` |

### 7.2 `TechManagerProfile`

- 表级属性：
  - `@@index([featuredRank])`
  - `@@map("tech_manager_profiles")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `userId` | `String` | Y | - | `@id @map("user_id") @db.Uuid` |
| `intro` | `String?` | N | - | `-` |
| `serviceTagsJson` | `Json?` | N | - | `@map("service_tags_json")` |
| `featuredRank` | `Int?` | N | - | `@map("featured_rank")` |
| `featuredUntil` | `DateTime?` | N | - | `@map("featured_until")` |
| `consultCount` | `Int` | Y | - | `@default(0) @map("consult_count")` |
| `dealCount` | `Int` | Y | - | `@default(0) @map("deal_count")` |
| `ratingScore` | `Float` | Y | - | `@default(0) @map("rating_score")` |
| `ratingCount` | `Int` | Y | - | `@default(0) @map("rating_count")` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `user` | `User` | Y | - | `@relation(fields: [userId], references: [id])` |

### 7.3 `Notification`

- 表级属性：
  - `@@index([userId, createdAt])`
  - `@@map("notifications")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `userId` | `String` | Y | - | `@map("user_id") @db.Uuid` |
| `kind` | `NotificationKind` | Y | system/cs | `-` |
| `title` | `String` | Y | - | `-` |
| `summary` | `String` | Y | - | `-` |
| `source` | `String` | Y | - | `-` |
| `readAt` | `DateTime?` | N | - | `@map("read_at")` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `user` | `User` | Y | - | `@relation(fields: [userId], references: [id])` |

### 7.4 `Address`

- 表级属性：
  - `@@index([userId, createdAt])`
  - `@@map("addresses")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `userId` | `String` | Y | - | `@map("user_id") @db.Uuid` |
| `name` | `String` | Y | - | `-` |
| `phone` | `String` | Y | - | `-` |
| `regionCode` | `String?` | N | - | `@map("region_code")` |
| `addressLine` | `String` | Y | - | `@map("address_line")` |
| `isDefault` | `Boolean` | Y | - | `@default(false) @map("is_default")` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `user` | `User` | Y | - | `@relation(fields: [userId], references: [id])` |

### 7.5 `Comment`

- 表级属性：
  - `@@index([contentType, contentId, createdAt])`
  - `@@index([userId, createdAt])`
  - `@@index([status, createdAt])`
  - `@@map("comments")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `contentType` | `CommentContentType` | Y | LISTING/ACHIEVEMENT | `@map("content_type")` |
| `contentId` | `String` | Y | - | `@map("content_id") @db.Uuid` |
| `parentCommentId` | `String?` | N | - | `@map("parent_comment_id") @db.Uuid` |
| `userId` | `String` | Y | - | `@map("user_id") @db.Uuid` |
| `text` | `String` | Y | - | `-` |
| `status` | `CommentStatus` | Y | VISIBLE/HIDDEN/DELETED | `@default(VISIBLE)` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `user` | `User` | Y | - | `@relation(fields: [userId], references: [id])` |
| `parent` | `Comment?` | N | - | `@relation("CommentParent", fields: [parentCommentId], references: [id])` |
| `replies` | `Comment[]` | Y | - | `@relation("CommentParent")` |

### 7.6 `Region`

- 表级属性：
  - `@@map("regions")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `code` | `String` | Y | - | `@id` |
| `name` | `String` | Y | - | `-` |
| `level` | `RegionLevel` | Y | PROVINCE/CITY/DISTRICT | `-` |
| `parentCode` | `String?` | N | - | `@map("parent_code")` |
| `centerLat` | `Float?` | N | - | `@map("center_lat")` |
| `centerLng` | `Float?` | N | - | `@map("center_lng")` |
| `industryTagsJson` | `Json?` | N | - | `@map("industry_tags_json")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `parent` | `Region?` | N | - | `@relation("Region_Parent", fields: [parentCode], references: [code])` |
| `children` | `Region[]` | Y | - | `@relation("Region_Parent")` |
| `users` | `User[]` | Y | - | `-` |
| `listings` | `Listing[]` | Y | - | `-` |
| `achievements` | `Achievement[]` | Y | - | `-` |
| `verifications` | `UserVerification[]` | Y | - | `-` |

### 7.7 `IndustryTag`

- 表级属性：
  - `@@map("industry_tags")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `name` | `String` | Y | - | `@unique` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |

### 7.8 `UserVerification`

- 表级属性：
  - `@@index([userId, verificationStatus])`
  - `@@map("user_verifications")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `userId` | `String` | Y | - | `@map("user_id") @db.Uuid` |
| `verificationType` | `VerificationType` | Y | PERSON/COMPANY/ACADEMY/GOVERNMENT/ASSOCIATION/TECH_MANAGER | `@map("type")` |
| `verificationStatus` | `VerificationStatus` | Y | PENDING/APPROVED/REJECTED | `@map("status")` |
| `displayName` | `String` | Y | - | `@map("display_name")` |
| `unifiedSocialCreditCodeEnc` | `String?` | N | - | `@map("unified_social_credit_code_enc")` |
| `contactName` | `String?` | N | - | `@map("contact_name")` |
| `contactPhone` | `String?` | N | - | `@map("contact_phone")` |
| `regionCode` | `String?` | N | - | `@map("region_code")` |
| `intro` | `String?` | N | - | `-` |
| `logoFileId` | `String?` | N | - | `@map("logo_file_id") @db.Uuid` |
| `evidenceFileIdsJson` | `Json?` | N | - | `@map("evidence_file_ids_json")` |
| `submittedAt` | `DateTime` | Y | - | `@map("submitted_at")` |
| `reviewedAt` | `DateTime?` | N | - | `@map("reviewed_at")` |
| `reviewedById` | `String?` | N | - | `@map("reviewed_by") @db.Uuid` |
| `reviewComment` | `String?` | N | - | `@map("review_comment")` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `user` | `User` | Y | - | `@relation("UserVerification_User", fields: [userId], references: [id])` |
| `reviewedBy` | `User?` | N | - | `@relation("UserVerification_Reviewer", fields: [reviewedById], references: [id])` |
| `logoFile` | `File?` | N | - | `@relation("UserVerification_LogoFile", fields: [logoFileId], references: [id])` |
| `region` | `Region?` | N | - | `@relation(fields: [regionCode], references: [code])` |

### 7.9 `Patent`

- 表级属性：
  - `@@unique([jurisdiction, applicationNoNorm])`
  - `@@index([jurisdiction, applicationNoNorm])`
  - `@@index([ownerUserId])`
  - `@@map("patents")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `jurisdiction` | `String` | Y | - | `@default("CN")` |
| `applicationNoNorm` | `String` | Y | - | `@map("application_no_norm")` |
| `applicationNoDisplay` | `String?` | N | - | `@map("application_no_display")` |
| `patentType` | `PatentType` | Y | INVENTION/UTILITY_MODEL/DESIGN | `@map("patent_type")` |
| `title` | `String` | Y | - | `-` |
| `abstract` | `String?` | N | - | `-` |
| `filingDate` | `DateTime?` | N | - | `@map("filing_date") @db.Date` |
| `publicationDate` | `DateTime?` | N | - | `@map("publication_date") @db.Date` |
| `grantDate` | `DateTime?` | N | - | `@map("grant_date") @db.Date` |
| `legalStatus` | `String?` | N | - | `@map("legal_status")` |
| `legalStatusRaw` | `String?` | N | - | `@map("legal_status_raw")` |
| `publicationNoDisplay` | `String?` | N | - | `@map("publication_no_display")` |
| `patentNoDisplay` | `String?` | N | - | `@map("patent_no_display")` |
| `grantPublicationNoDisplay` | `String?` | N | - | `@map("grant_publication_no_display")` |
| `transferCount` | `Int` | Y | - | `@default(0) @map("transfer_count")` |
| `sourcePrimary` | `PatentSourcePrimary` | Y | USER/ADMIN/PROVIDER | `@default(USER) @map("source_primary")` |
| `sourceUpdatedAt` | `DateTime?` | N | - | `@map("source_updated_at")` |
| `ownerUserId` | `String?` | N | - | `@map("owner_user_id") @db.Uuid` |
| `ownerClaimedAt` | `DateTime?` | N | - | `@map("owner_claimed_at")` |
| `ownerClaimSource` | `PatentOwnerClaimSource?` | N | PLATFORM_IMPORT/USER_CLAIM/ADMIN_ASSIGN | `@map("owner_claim_source")` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `identifiers` | `PatentIdentifier[]` | Y | - | `-` |
| `classifications` | `PatentClassification[]` | Y | - | `-` |
| `parties` | `PatentParty[]` | Y | - | `-` |
| `listings` | `Listing[]` | Y | - | `-` |
| `legalEvents` | `PatentLegalEvent[]` | Y | - | `-` |
| `maintenanceSchedules` | `PatentMaintenanceSchedule[]` | Y | - | `-` |
| `owner` | `User?` | N | - | `@relation("Patent_Owner", fields: [ownerUserId], references: [id])` |
| `importRows` | `PatentImportJobRow[]` | Y | - | `-` |
| `claimRequests` | `PatentClaimRequest[]` | Y | - | `-` |

### 7.10 `PatentIdentifier`

- 表级属性：
  - `@@unique([idType, idValueNorm])`
  - `@@unique([idValueNorm])`
  - `@@map("patent_identifiers")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `patentId` | `String` | Y | - | `@map("patent_id") @db.Uuid` |
| `idType` | `PatentIdentifierType` | Y | APPLICATION/PATENT/PUBLICATION | `@map("id_type")` |
| `idValueNorm` | `String` | Y | - | `@map("id_value_norm")` |
| `kindCode` | `String?` | N | - | `@map("kind_code")` |
| `dateRef` | `DateTime?` | N | - | `@map("date_ref") @db.Date` |
| `patent` | `Patent` | Y | - | `@relation(fields: [patentId], references: [id])` |

### 7.11 `PatentClassification`

- 表级属性：
  - `@@unique([patentId, system, code])`
  - `@@map("patent_classifications")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `patentId` | `String` | Y | - | `@map("patent_id") @db.Uuid` |
| `system` | `ClassificationSystem` | Y | IPC/LOC/CPC | `-` |
| `code` | `String` | Y | - | `-` |
| `isMain` | `Boolean` | Y | - | `@default(false) @map("is_main")` |
| `patent` | `Patent` | Y | - | `@relation(fields: [patentId], references: [id])` |

### 7.12 `PatentParty`

- 表级属性：
  - `@@index([patentId, role])`
  - `@@map("patent_parties")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `patentId` | `String` | Y | - | `@map("patent_id") @db.Uuid` |
| `role` | `PatentPartyRole` | Y | APPLICANT/INVENTOR/ASSIGNEE | `-` |
| `name` | `String` | Y | - | `-` |
| `countryCode` | `String?` | N | - | `@map("country_code")` |
| `patent` | `Patent` | Y | - | `@relation(fields: [patentId], references: [id])` |

### 7.13 `PatentLegalEvent`

- 表级属性：
  - `@@index([patentId, eventDate])`
  - `@@map("patent_legal_events")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `patentId` | `String` | Y | - | `@map("patent_id") @db.Uuid` |
| `eventDate` | `DateTime` | Y | - | `@map("event_date") @db.Date` |
| `eventCode` | `String` | Y | - | `@map("event_code")` |
| `eventTextRaw` | `String` | Y | - | `@map("event_text_raw")` |
| `source` | `String` | Y | - | `-` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `patent` | `Patent` | Y | - | `@relation(fields: [patentId], references: [id])` |

### 7.14 `File`

- 表级属性：
  - `@@index([ownerScope, ownerId])`
  - `@@map("files")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `url` | `String` | Y | - | `-` |
| `fileName` | `String?` | N | - | `@map("file_name")` |
| `mimeType` | `String` | Y | - | `@map("mime_type")` |
| `sizeBytes` | `Int` | Y | - | `@map("size_bytes")` |
| `ownerScope` | `FileOwnerScope` | Y | LISTING/ACHIEVEMENT/CASE/REFUND_REQUEST/INVOICE/USER/USER_VERIFICATION/MESSAGE | `@map("owner_scope")` |
| `ownerId` | `String` | Y | - | `@map("owner_id") @db.Uuid` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `listingMedia` | `ListingMedia[]` | Y | - | `-` |
| `achievementMedia` | `AchievementMedia[]` | Y | - | `-` |
| `messageAttachments` | `ConversationMessage[]` | Y | - | `-` |
| `milestoneEvidence` | `CsMilestone[]` | Y | - | `-` |
| `caseEvidences` | `CsCaseEvidence[]` | Y | - | `-` |
| `settlementEvidence` | `Settlement[]` | Y | - | `-` |
| `invoiceOrders` | `Order[]` | Y | - | `-` |
| `contractFiles` | `Contract[]` | Y | - | `@relation("Contract_File")` |
| `maintenanceEvidenceTasks` | `PatentMaintenanceTask[]` | Y | - | `@relation("PatentMaintenanceTask_Evidence")` |
| `maintenanceReceiptOrders` | `PatentMaintenanceOrder[]` | Y | - | `@relation("PatentMaintenanceOrder_ReceiptFile")` |
| `verificationLogos` | `UserVerification[]` | Y | - | `@relation("UserVerification_LogoFile")` |
| `listingBatchJobErrorFiles` | `ListingBatchJob[]` | Y | - | `@relation("ListingBatchJob_ErrorFile")` |
| `listingImportJobSourceFiles` | `ListingImportJob[]` | Y | - | `@relation("ListingImportJob_SourceFile")` |
| `listingImportJobErrorFiles` | `ListingImportJob[]` | Y | - | `@relation("ListingImportJob_ErrorFile")` |
| `patentImportJobSourceFiles` | `PatentImportJob[]` | Y | - | `@relation("PatentImportJob_SourceFile")` |
| `patentImportJobErrorFiles` | `PatentImportJob[]` | Y | - | `@relation("PatentImportJob_ErrorFile")` |
| `achievementCovers` | `Achievement[]` | Y | - | `@relation("Achievement_CoverFile")` |

### 7.15 `Listing`

- 表级属性：
  - `@@index([auditStatus, status])`
  - `@@index([status, auditStatus, createdAt])`
  - `@@index([regionCode])`
  - `@@map("listings")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `sellerUserId` | `String` | Y | - | `@map("seller_user_id") @db.Uuid` |
| `source` | `ContentSource` | Y | USER/PLATFORM/ADMIN | `@default(USER) @map("source")` |
| `patentId` | `String?` | N | - | `@map("patent_id") @db.Uuid` |
| `title` | `String` | Y | - | `-` |
| `summary` | `String?` | N | - | `-` |
| `tradeMode` | `ListingTradeMode` | Y | ASSIGNMENT/LICENSE | `@map("trade_mode")` |
| `licenseMode` | `LicenseMode?` | N | EXCLUSIVE/SOLE/NON_EXCLUSIVE | `@map("license_mode")` |
| `priceType` | `PriceType` | Y | FIXED/NEGOTIABLE | `@map("price_type")` |
| `priceAmount` | `Int?` | N | - | `@map("price_amount")` |
| `depositAmount` | `Int` | Y | - | `@map("deposit_amount")` |
| `deliverablesJson` | `Json?` | N | - | `@map("deliverables_json")` |
| `expectedCompletionDays` | `Int?` | N | - | `@map("expected_completion_days")` |
| `negotiableRangeFen` | `Int?` | N | - | `@map("negotiable_range_fen")` |
| `negotiableRangePercent` | `Float?` | N | - | `@map("negotiable_range_percent")` |
| `negotiableNote` | `String?` | N | - | `@map("negotiable_note")` |
| `pledgeStatus` | `PledgeStatus?` | N | NONE/PLEDGED/UNKNOWN | `@map("pledge_status")` |
| `existingLicenseStatus` | `ExistingLicenseStatus?` | N | NONE/EXCLUSIVE/SOLE/NON_EXCLUSIVE/UNKNOWN | `@map("existing_license_status")` |
| `encumbranceNote` | `String?` | N | - | `@map("encumbrance_note")` |
| `regionCode` | `String?` | N | - | `@map("region_code")` |
| `industryTagsJson` | `Json?` | N | - | `@map("industry_tags_json")` |
| `listingTopicsJson` | `Json?` | N | - | `@map("listing_topics_json")` |
| `proofFileIdsJson` | `Json?` | N | - | `@map("proof_file_ids_json")` |
| `consultationRouting` | `ConsultationRouting` | Y | PLATFORM/OWNER | `@default(PLATFORM) @map("consultation_routing")` |
| `featuredLevel` | `FeaturedLevel` | Y | NONE/CITY/PROVINCE | `@default(NONE) @map("featured_level")` |
| `featuredRegionCode` | `String?` | N | - | `@map("featured_region_code")` |
| `featuredRank` | `Int?` | N | - | `@map("featured_rank")` |
| `featuredUntil` | `DateTime?` | N | - | `@map("featured_until")` |
| `auditStatus` | `AuditStatus` | Y | PENDING/APPROVED/REJECTED | `@default(PENDING) @map("audit_status")` |
| `status` | `ListingStatus` | Y | DRAFT/ACTIVE/OFF_SHELF/SOLD | `@default(DRAFT)` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `seller` | `User` | Y | - | `@relation("Listing_Seller", fields: [sellerUserId], references: [id])` |
| `patent` | `Patent?` | N | - | `@relation(fields: [patentId], references: [id])` |
| `region` | `Region?` | N | - | `@relation(fields: [regionCode], references: [code])` |
| `media` | `ListingMedia[]` | Y | - | `-` |
| `auditLogs` | `ListingAuditLog[]` | Y | - | `-` |
| `stats` | `ListingStats?` | N | - | `-` |
| `favorites` | `ListingFavorite[]` | Y | - | `-` |
| `consultEvents` | `ListingConsultEvent[]` | Y | - | `-` |
| `orders` | `Order[]` | Y | - | `-` |
| `conversations` | `Conversation[]` | Y | - | `-` |
| `batchJobItems` | `ListingBatchJobItem[]` | Y | - | `-` |
| `importJobRows` | `ListingImportJobRow[]` | Y | - | `-` |

### 7.16 `Achievement`

- 表级属性：
  - `@@index([publisherUserId, createdAt])`
  - `@@index([auditStatus, status])`
  - `@@index([status, auditStatus, createdAt])`
  - `@@index([regionCode])`
  - `@@map("achievements")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `publisherUserId` | `String` | Y | - | `@map("publisher_user_id") @db.Uuid` |
| `source` | `ContentSource` | Y | USER/PLATFORM/ADMIN | `@default(USER)` |
| `title` | `String` | Y | - | `-` |
| `summary` | `String?` | N | - | `-` |
| `description` | `String?` | N | - | `-` |
| `keywordsJson` | `Json?` | N | - | `@map("keywords_json")` |
| `maturity` | `AchievementMaturity?` | N | CONCEPT/PROTOTYPE/PILOT/MASS_PRODUCTION/COMMERCIALIZED/OTHER | `-` |
| `cooperationModesJson` | `Json?` | N | - | `@map("cooperation_modes_json")` |
| `coverFileId` | `String?` | N | - | `@map("cover_file_id") @db.Uuid` |
| `regionCode` | `String?` | N | - | `@map("region_code")` |
| `industryTagsJson` | `Json?` | N | - | `@map("industry_tags_json")` |
| `auditStatus` | `AuditStatus` | Y | PENDING/APPROVED/REJECTED | `@default(PENDING) @map("audit_status")` |
| `status` | `ContentStatus` | Y | DRAFT/ACTIVE/OFF_SHELF | `@default(DRAFT)` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `publisher` | `User` | Y | - | `@relation("Achievement_Publisher", fields: [publisherUserId], references: [id])` |
| `coverFile` | `File?` | N | - | `@relation("Achievement_CoverFile", fields: [coverFileId], references: [id])` |
| `region` | `Region?` | N | - | `@relation(fields: [regionCode], references: [code])` |
| `media` | `AchievementMedia[]` | Y | - | `-` |
| `stats` | `AchievementStats?` | N | - | `-` |
| `favorites` | `AchievementFavorite[]` | Y | - | `-` |

### 7.17 `AchievementMedia`

- 表级属性：
  - `@@index([achievementId, sort])`
  - `@@map("achievement_media")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `achievementId` | `String` | Y | - | `@map("achievement_id") @db.Uuid` |
| `fileId` | `String` | Y | - | `@map("file_id") @db.Uuid` |
| `type` | `ContentMediaType` | Y | IMAGE/VIDEO/FILE | `-` |
| `sort` | `Int` | Y | - | `@default(0)` |
| `achievement` | `Achievement` | Y | - | `@relation(fields: [achievementId], references: [id])` |
| `file` | `File` | Y | - | `@relation(fields: [fileId], references: [id])` |

### 7.18 `AchievementFavorite`

- 表级属性：
  - `@@unique([achievementId, userId])`
  - `@@map("achievement_favorites")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `achievementId` | `String` | Y | - | `@map("achievement_id") @db.Uuid` |
| `userId` | `String` | Y | - | `@map("user_id") @db.Uuid` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `achievement` | `Achievement` | Y | - | `@relation(fields: [achievementId], references: [id])` |
| `user` | `User` | Y | - | `@relation(fields: [userId], references: [id])` |

### 7.19 `AchievementStats`

- 表级属性：
  - `@@map("achievement_stats")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `achievementId` | `String` | Y | - | `@id @map("achievement_id") @db.Uuid` |
| `viewCount` | `Int` | Y | - | `@default(0) @map("view_count")` |
| `favoriteCount` | `Int` | Y | - | `@default(0) @map("favorite_count")` |
| `consultCount` | `Int` | Y | - | `@default(0) @map("consult_count")` |
| `commentCount` | `Int` | Y | - | `@default(0) @map("comment_count")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `achievement` | `Achievement` | Y | - | `@relation(fields: [achievementId], references: [id])` |

### 7.20 `ListingMedia`

- 表级属性：
  - `@@index([listingId, sort])`
  - `@@map("listing_media")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `listingId` | `String` | Y | - | `@map("listing_id") @db.Uuid` |
| `fileId` | `String` | Y | - | `@map("file_id") @db.Uuid` |
| `type` | `ListingMediaType` | Y | IMAGE/FILE | `-` |
| `sort` | `Int` | Y | - | `@default(0)` |
| `listing` | `Listing` | Y | - | `@relation(fields: [listingId], references: [id])` |
| `file` | `File` | Y | - | `@relation(fields: [fileId], references: [id])` |

### 7.21 `ListingAuditLog`

- 表级属性：
  - `@@index([listingId, createdAt])`
  - `@@map("listing_audit_logs")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `listingId` | `String` | Y | - | `@map("listing_id") @db.Uuid` |
| `reviewerId` | `String` | Y | - | `@map("reviewer_id") @db.Uuid` |
| `action` | `ListingAuditAction` | Y | APPROVE/REJECT | `-` |
| `reason` | `String?` | N | - | `-` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `listing` | `Listing` | Y | - | `@relation(fields: [listingId], references: [id])` |
| `reviewer` | `User` | Y | - | `@relation("ListingAuditLog_Reviewer", fields: [reviewerId], references: [id])` |

### 7.22 `ListingBatchJob`

- 表级属性：
  - `@@index([operatorUserId, createdAt])`
  - `@@index([status, createdAt])`
  - `@@map("listing_batch_jobs")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `operatorUserId` | `String` | Y | - | `@map("operator_user_id") @db.Uuid` |
| `action` | `ListingBatchAction` | Y | APPROVE/REJECT/PUBLISH/OFF_SHELF | `-` |
| `reason` | `String?` | N | - | `-` |
| `status` | `ListingJobStatus` | Y | PENDING/RUNNING/PAUSED/SUCCEEDED/FAILED | `@default(PENDING)` |
| `totalCount` | `Int` | Y | - | `@default(0) @map("total_count")` |
| `successCount` | `Int` | Y | - | `@default(0) @map("success_count")` |
| `failedCount` | `Int` | Y | - | `@default(0) @map("failed_count")` |
| `skippedCount` | `Int` | Y | - | `@default(0) @map("skipped_count")` |
| `failRate` | `Float` | Y | - | `@default(0) @map("fail_rate")` |
| `startedAt` | `DateTime?` | N | - | `@map("started_at")` |
| `finishedAt` | `DateTime?` | N | - | `@map("finished_at")` |
| `pausedAt` | `DateTime?` | N | - | `@map("paused_at")` |
| `errorFileId` | `String?` | N | - | `@map("error_file_id") @db.Uuid` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `operator` | `User` | Y | - | `@relation("ListingBatchJob_Operator", fields: [operatorUserId], references: [id])` |
| `errorFile` | `File?` | N | - | `@relation("ListingBatchJob_ErrorFile", fields: [errorFileId], references: [id])` |
| `items` | `ListingBatchJobItem[]` | Y | - | `-` |

### 7.23 `ListingBatchJobItem`

- 表级属性：
  - `@@unique([jobId, listingId])`
  - `@@index([jobId, status])`
  - `@@index([listingId, createdAt])`
  - `@@map("listing_batch_job_items")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `jobId` | `String` | Y | - | `@map("job_id") @db.Uuid` |
| `listingId` | `String` | Y | - | `@map("listing_id") @db.Uuid` |
| `status` | `ListingBatchItemStatus` | Y | PENDING/SUCCEEDED/FAILED/SKIPPED | `@default(PENDING)` |
| `errorCode` | `String?` | N | - | `@map("error_code")` |
| `errorMessage` | `String?` | N | - | `@map("error_message")` |
| `processedAt` | `DateTime?` | N | - | `@map("processed_at")` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `job` | `ListingBatchJob` | Y | - | `@relation(fields: [jobId], references: [id])` |
| `listing` | `Listing` | Y | - | `@relation(fields: [listingId], references: [id])` |

### 7.24 `ListingImportJob`

- 表级属性：
  - `@@index([operatorUserId, createdAt])`
  - `@@index([status, createdAt])`
  - `@@index([fileId])`
  - `@@map("listing_import_jobs")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `operatorUserId` | `String` | Y | - | `@map("operator_user_id") @db.Uuid` |
| `fileId` | `String` | Y | - | `@map("file_id") @db.Uuid` |
| `duplicatePolicy` | `ListingImportDuplicatePolicy` | Y | SKIP/OVERWRITE | `@default(SKIP) @map("duplicate_policy")` |
| `defaultsJson` | `Json?` | N | - | `@map("defaults_json")` |
| `status` | `ListingJobStatus` | Y | PENDING/RUNNING/PAUSED/SUCCEEDED/FAILED | `@default(PENDING)` |
| `totalCount` | `Int` | Y | - | `@default(0) @map("total_count")` |
| `validCount` | `Int` | Y | - | `@default(0) @map("valid_count")` |
| `invalidCount` | `Int` | Y | - | `@default(0) @map("invalid_count")` |
| `successCount` | `Int` | Y | - | `@default(0) @map("success_count")` |
| `failedCount` | `Int` | Y | - | `@default(0) @map("failed_count")` |
| `skippedCount` | `Int` | Y | - | `@default(0) @map("skipped_count")` |
| `failRate` | `Float` | Y | - | `@default(0) @map("fail_rate")` |
| `validatedAt` | `DateTime?` | N | - | `@map("validated_at")` |
| `startedAt` | `DateTime?` | N | - | `@map("started_at")` |
| `finishedAt` | `DateTime?` | N | - | `@map("finished_at")` |
| `pausedAt` | `DateTime?` | N | - | `@map("paused_at")` |
| `errorFileId` | `String?` | N | - | `@map("error_file_id") @db.Uuid` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `operator` | `User` | Y | - | `@relation("ListingImportJob_Operator", fields: [operatorUserId], references: [id])` |
| `sourceFile` | `File` | Y | - | `@relation("ListingImportJob_SourceFile", fields: [fileId], references: [id])` |
| `errorFile` | `File?` | N | - | `@relation("ListingImportJob_ErrorFile", fields: [errorFileId], references: [id])` |
| `rows` | `ListingImportJobRow[]` | Y | - | `-` |

### 7.25 `ListingImportJobRow`

- 表级属性：
  - `@@unique([jobId, rowNo])`
  - `@@index([jobId, status])`
  - `@@index([listingId, createdAt])`
  - `@@map("listing_import_job_rows")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `jobId` | `String` | Y | - | `@map("job_id") @db.Uuid` |
| `rowNo` | `Int` | Y | - | `@map("row_no")` |
| `status` | `ListingImportRowStatus` | Y | PENDING/VALID/INVALID/SUCCEEDED/FAILED/SKIPPED | `@default(PENDING)` |
| `rawJson` | `Json` | Y | - | `@map("raw_json")` |
| `normalizedJson` | `Json?` | N | - | `@map("normalized_json")` |
| `listingId` | `String?` | N | - | `@map("listing_id") @db.Uuid` |
| `errorCode` | `String?` | N | - | `@map("error_code")` |
| `errorMessage` | `String?` | N | - | `@map("error_message")` |
| `processedAt` | `DateTime?` | N | - | `@map("processed_at")` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `job` | `ListingImportJob` | Y | - | `@relation(fields: [jobId], references: [id])` |
| `listing` | `Listing?` | N | - | `@relation(fields: [listingId], references: [id])` |

### 7.26 `ListingStats`

- 表级属性：
  - `@@map("listing_stats")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `listingId` | `String` | Y | - | `@id @map("listing_id") @db.Uuid` |
| `viewCount` | `Int` | Y | - | `@default(0) @map("view_count")` |
| `favoriteCount` | `Int` | Y | - | `@default(0) @map("favorite_count")` |
| `consultCount` | `Int` | Y | - | `@default(0) @map("consult_count")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `listing` | `Listing` | Y | - | `@relation(fields: [listingId], references: [id])` |

### 7.27 `ListingFavorite`

- 表级属性：
  - `@@unique([listingId, userId])`
  - `@@map("listing_favorites")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `listingId` | `String` | Y | - | `@map("listing_id") @db.Uuid` |
| `userId` | `String` | Y | - | `@map("user_id") @db.Uuid` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `listing` | `Listing` | Y | - | `@relation(fields: [listingId], references: [id])` |
| `user` | `User` | Y | - | `@relation(fields: [userId], references: [id])` |

### 7.28 `ListingConsultEvent`

- 表级属性：
  - `@@index([listingId, createdAt])`
  - `@@map("listing_consult_events")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `listingId` | `String` | Y | - | `@map("listing_id") @db.Uuid` |
| `userId` | `String` | Y | - | `@map("user_id") @db.Uuid` |
| `channel` | `ConsultChannel` | Y | WECHAT_CS/PHONE/FORM | `-` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `listing` | `Listing` | Y | - | `@relation(fields: [listingId], references: [id])` |
| `user` | `User` | Y | - | `@relation(fields: [userId], references: [id])` |

### 7.29 `ContentEvent`

- 表级属性：
  - `@@index([contentType, contentId, eventType, actorKey, createdAt])`
  - `@@map("content_events")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `contentType` | `CommentContentType` | Y | LISTING/ACHIEVEMENT | `@map("content_type")` |
| `contentId` | `String` | Y | - | `@map("content_id") @db.Uuid` |
| `eventType` | `ContentEventType` | Y | VIEW/FAVORITE/CONSULT | `@map("event_type")` |
| `actorKey` | `String` | Y | - | `@map("actor_key")` |
| `actorUserId` | `String?` | N | - | `@map("actor_user_id") @db.Uuid` |
| `deviceId` | `String?` | N | - | `@map("device_id")` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |

### 7.30 `UserTagScore`

- 表级属性：
  - `@@unique([userId, tag])`
  - `@@map("user_tag_scores")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `userId` | `String` | Y | - | `@map("user_id") @db.Uuid` |
| `tag` | `String` | Y | - | `-` |
| `score` | `Int` | Y | - | `@default(0)` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `user` | `User` | Y | - | `@relation(fields: [userId], references: [id])` |

### 7.31 `Order`

- 表级属性：
  - `@@index([status, createdAt])`
  - `@@map("orders")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `listingId` | `String` | Y | - | `@map("listing_id") @db.Uuid` |
| `buyerUserId` | `String` | Y | - | `@map("buyer_user_id") @db.Uuid` |
| `assignedCsUserId` | `String?` | N | - | `@map("assigned_cs_user_id") @db.Uuid` |
| `status` | `String` | Y | - | `-` |
| `dealAmount` | `Int?` | N | - | `@map("deal_amount")` |
| `depositAmount` | `Int` | Y | - | `@map("deposit_amount")` |
| `finalAmount` | `Int?` | N | - | `@map("final_amount")` |
| `commissionAmount` | `Int?` | N | - | `@map("commission_amount")` |
| `invoiceNo` | `String?` | N | - | `@map("invoice_no")` |
| `invoiceFileId` | `String?` | N | - | `@map("invoice_file_id") @db.Uuid` |
| `invoiceIssuedAt` | `DateTime?` | N | - | `@map("invoice_issued_at")` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `listing` | `Listing` | Y | - | `@relation(fields: [listingId], references: [id])` |
| `buyer` | `User` | Y | - | `@relation("Order_Buyer", fields: [buyerUserId], references: [id])` |
| `assignedCs` | `User?` | N | - | `@relation("Order_AssignedCs", fields: [assignedCsUserId], references: [id])` |
| `invoiceFile` | `File?` | N | - | `@relation(fields: [invoiceFileId], references: [id])` |
| `payments` | `Payment[]` | Y | - | `-` |
| `paymentWebhookEvents` | `PaymentWebhookEvent[]` | Y | - | `-` |
| `refundRequests` | `RefundRequest[]` | Y | - | `-` |
| `csCases` | `CsCase[]` | Y | - | `-` |
| `settlement` | `Settlement?` | N | - | `-` |
| `conversations` | `Conversation[]` | Y | - | `-` |
| `contract` | `Contract?` | N | - | `-` |

### 7.32 `Contract`

- 表级属性：
  - `@@map("contracts")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `orderId` | `String` | Y | - | `@id @map("order_id") @db.Uuid` |
| `status` | `ContractStatus` | Y | WAIT_UPLOAD/WAIT_CONFIRM/AVAILABLE | `@default(WAIT_UPLOAD)` |
| `contractFileId` | `String?` | N | - | `@map("contract_file_id") @db.Uuid` |
| `fileUrl` | `String?` | N | - | `@map("file_url")` |
| `uploadedAt` | `DateTime?` | N | - | `@map("uploaded_at")` |
| `signedAt` | `DateTime?` | N | - | `@map("signed_at")` |
| `watermarkOwner` | `String?` | N | - | `@map("watermark_owner")` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `order` | `Order` | Y | - | `@relation(fields: [orderId], references: [id])` |
| `contractFile` | `File?` | N | - | `@relation("Contract_File", fields: [contractFileId], references: [id])` |

### 7.33 `Conversation`

- 表级属性：
  - `@@index([listingId, updatedAt])`
  - `@@index([contentType, contentId, updatedAt])`
  - `@@map("conversations")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `contentType` | `ConversationContentType` | Y | LISTING/ACHIEVEMENT/TECH_MANAGER/SUPPORT/DISPUTE/MAINTENANCE | `@map("content_type")` |
| `contentId` | `String` | Y | - | `@map("content_id") @db.Uuid` |
| `listingId` | `String?` | N | - | `@map("listing_id") @db.Uuid` |
| `orderId` | `String?` | N | - | `@map("order_id") @db.Uuid` |
| `buyerUserId` | `String` | Y | - | `@map("buyer_user_id") @db.Uuid` |
| `sellerUserId` | `String` | Y | - | `@map("seller_user_id") @db.Uuid` |
| `lastMessageAt` | `DateTime?` | N | - | `@map("last_message_at")` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `listing` | `Listing?` | N | - | `@relation(fields: [listingId], references: [id])` |
| `order` | `Order?` | N | - | `@relation(fields: [orderId], references: [id])` |
| `buyer` | `User` | Y | - | `@relation("Conversation_Buyer", fields: [buyerUserId], references: [id])` |
| `seller` | `User` | Y | - | `@relation("Conversation_Seller", fields: [sellerUserId], references: [id])` |
| `participants` | `ConversationParticipant[]` | Y | - | `-` |
| `messages` | `ConversationMessage[]` | Y | - | `-` |
| `agents` | `ConversationAgent[]` | Y | - | `-` |

### 7.34 `ConversationParticipant`

- 表级属性：
  - `@@unique([conversationId, userId])`
  - `@@map("conversation_participants")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `conversationId` | `String` | Y | - | `@map("conversation_id") @db.Uuid` |
| `userId` | `String` | Y | - | `@map("user_id") @db.Uuid` |
| `lastReadAt` | `DateTime?` | N | - | `@map("last_read_at")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `conversation` | `Conversation` | Y | - | `@relation(fields: [conversationId], references: [id])` |
| `user` | `User` | Y | - | `@relation(fields: [userId], references: [id])` |

### 7.35 `ConversationMessage`

- 表级属性：
  - `@@index([conversationId, createdAt])`
  - `@@map("conversation_messages")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `conversationId` | `String` | Y | - | `@map("conversation_id") @db.Uuid` |
| `senderUserId` | `String` | Y | - | `@map("sender_user_id") @db.Uuid` |
| `type` | `ConversationMessageType` | Y | TEXT/EMOJI/IMAGE/FILE/SYSTEM | `-` |
| `text` | `String?` | N | - | `-` |
| `fileId` | `String?` | N | - | `@map("file_id") @db.Uuid` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `conversation` | `Conversation` | Y | - | `@relation(fields: [conversationId], references: [id])` |
| `sender` | `User` | Y | - | `@relation("ConversationMessage_Sender", fields: [senderUserId], references: [id])` |
| `file` | `File?` | N | - | `@relation(fields: [fileId], references: [id])` |

### 7.36 `ConversationAgent`

- 表级属性：
  - `@@unique([conversationId, operatorUserId])`
  - `@@index([operatorUserId, active, assignedAt])`
  - `@@index([conversationId, active, assignedAt])`
  - `@@map("conversation_agents")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `conversationId` | `String` | Y | - | `@map("conversation_id") @db.Uuid` |
| `operatorUserId` | `String` | Y | - | `@map("operator_user_id") @db.Uuid` |
| `assignedByUserId` | `String?` | N | - | `@map("assigned_by_user_id") @db.Uuid` |
| `active` | `Boolean` | Y | - | `@default(true)` |
| `assignedAt` | `DateTime` | Y | - | `@default(now()) @map("assigned_at")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `conversation` | `Conversation` | Y | - | `@relation(fields: [conversationId], references: [id])` |
| `operator` | `User` | Y | - | `@relation("ConversationAgent_Operator", fields: [operatorUserId], references: [id])` |
| `assignedBy` | `User?` | N | - | `@relation("ConversationAgent_AssignedBy", fields: [assignedByUserId], references: [id])` |

### 7.37 `PatentImportJob`

- 表级属性：
  - `@@index([operatorUserId, createdAt])`
  - `@@index([status, createdAt])`
  - `@@index([fileId])`
  - `@@map("patent_import_jobs")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `operatorUserId` | `String` | Y | - | `@map("operator_user_id") @db.Uuid` |
| `fileId` | `String` | Y | - | `@map("file_id") @db.Uuid` |
| `duplicatePolicy` | `PatentImportDuplicatePolicy` | Y | SKIP/OVERWRITE | `@default(SKIP) @map("duplicate_policy")` |
| `defaultsJson` | `Json?` | N | - | `@map("defaults_json")` |
| `status` | `PatentJobStatus` | Y | PENDING/RUNNING/PAUSED/SUCCEEDED/FAILED | `@default(PENDING)` |
| `totalCount` | `Int` | Y | - | `@default(0) @map("total_count")` |
| `validCount` | `Int` | Y | - | `@default(0) @map("valid_count")` |
| `invalidCount` | `Int` | Y | - | `@default(0) @map("invalid_count")` |
| `successCount` | `Int` | Y | - | `@default(0) @map("success_count")` |
| `failedCount` | `Int` | Y | - | `@default(0) @map("failed_count")` |
| `skippedCount` | `Int` | Y | - | `@default(0) @map("skipped_count")` |
| `failRate` | `Float` | Y | - | `@default(0) @map("fail_rate")` |
| `validatedAt` | `DateTime?` | N | - | `@map("validated_at")` |
| `startedAt` | `DateTime?` | N | - | `@map("started_at")` |
| `finishedAt` | `DateTime?` | N | - | `@map("finished_at")` |
| `pausedAt` | `DateTime?` | N | - | `@map("paused_at")` |
| `errorFileId` | `String?` | N | - | `@map("error_file_id") @db.Uuid` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `operator` | `User` | Y | - | `@relation("PatentImportJob_Operator", fields: [operatorUserId], references: [id])` |
| `sourceFile` | `File` | Y | - | `@relation("PatentImportJob_SourceFile", fields: [fileId], references: [id])` |
| `errorFile` | `File?` | N | - | `@relation("PatentImportJob_ErrorFile", fields: [errorFileId], references: [id])` |
| `rows` | `PatentImportJobRow[]` | Y | - | `-` |

### 7.38 `PatentImportJobRow`

- 表级属性：
  - `@@unique([jobId, rowNo])`
  - `@@index([jobId, status])`
  - `@@index([patentId, createdAt])`
  - `@@map("patent_import_job_rows")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `jobId` | `String` | Y | - | `@map("job_id") @db.Uuid` |
| `rowNo` | `Int` | Y | - | `@map("row_no")` |
| `status` | `PatentImportRowStatus` | Y | PENDING/VALID/INVALID/SUCCEEDED/FAILED/SKIPPED | `@default(PENDING)` |
| `rawJson` | `Json` | Y | - | `@map("raw_json")` |
| `normalizedJson` | `Json?` | N | - | `@map("normalized_json")` |
| `patentId` | `String?` | N | - | `@map("patent_id") @db.Uuid` |
| `errorCode` | `String?` | N | - | `@map("error_code")` |
| `errorMessage` | `String?` | N | - | `@map("error_message")` |
| `processedAt` | `DateTime?` | N | - | `@map("processed_at")` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `job` | `PatentImportJob` | Y | - | `@relation(fields: [jobId], references: [id])` |
| `patent` | `Patent?` | N | - | `@relation(fields: [patentId], references: [id])` |

### 7.39 `PatentClaimRequest`

- 表级属性：
  - `@@index([patentId, status, createdAt])`
  - `@@index([applicantUserId, status, createdAt])`
  - `@@index([status, submittedAt])`
  - `@@map("patent_claim_requests")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `patentId` | `String` | Y | - | `@map("patent_id") @db.Uuid` |
| `applicantUserId` | `String` | Y | - | `@map("applicant_user_id") @db.Uuid` |
| `status` | `PatentClaimStatus` | Y | PENDING/APPROVED/REJECTED | `@default(PENDING)` |
| `claimReason` | `String?` | N | - | `@map("claim_reason")` |
| `evidenceFileIdsJson` | `Json?` | N | - | `@map("evidence_file_ids_json")` |
| `reviewerUserId` | `String?` | N | - | `@map("reviewer_user_id") @db.Uuid` |
| `reviewComment` | `String?` | N | - | `@map("review_comment")` |
| `submittedAt` | `DateTime` | Y | - | `@default(now()) @map("submitted_at")` |
| `reviewedAt` | `DateTime?` | N | - | `@map("reviewed_at")` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `patent` | `Patent` | Y | - | `@relation(fields: [patentId], references: [id])` |
| `applicant` | `User` | Y | - | `@relation("PatentClaimRequest_Applicant", fields: [applicantUserId], references: [id])` |
| `reviewer` | `User?` | N | - | `@relation("PatentClaimRequest_Reviewer", fields: [reviewerUserId], references: [id])` |

### 7.40 `Payment`

- 表级属性：
  - `@@index([orderId, payType])`
  - `@@map("payments")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `orderId` | `String` | Y | - | `@map("order_id") @db.Uuid` |
| `payType` | `PaymentType` | Y | DEPOSIT/FINAL/REFUND/PAYOUT | `@map("pay_type")` |
| `channel` | `PaymentChannel` | Y | WECHAT | `@default(WECHAT)` |
| `tradeNo` | `String` | Y | - | `@map("trade_no")` |
| `amount` | `Int` | Y | - | `-` |
| `status` | `String` | Y | - | `-` |
| `paidAt` | `DateTime?` | N | - | `@map("paid_at")` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `order` | `Order` | Y | - | `@relation(fields: [orderId], references: [id])` |

### 7.41 `PaymentWebhookEvent`

- 表级属性：
  - `@@unique([provider, eventId])`
  - `@@index([orderId])`
  - `@@index([refundRequestId])`
  - `@@map("payment_webhook_events")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `provider` | `String` | Y | - | `-` |
| `eventId` | `String` | Y | - | `@map("event_id")` |
| `eventType` | `String?` | N | - | `@map("event_type")` |
| `orderId` | `String?` | N | - | `@map("order_id") @db.Uuid` |
| `refundRequestId` | `String?` | N | - | `@map("refund_request_id") @db.Uuid` |
| `payType` | `PaymentType?` | N | DEPOSIT/FINAL/REFUND/PAYOUT | `@map("pay_type")` |
| `tradeNo` | `String?` | N | - | `@map("trade_no")` |
| `amount` | `Int?` | N | - | `-` |
| `status` | `String` | Y | - | `-` |
| `payloadJson` | `Json?` | N | - | `@map("payload_json")` |
| `processedAt` | `DateTime?` | N | - | `@map("processed_at")` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `order` | `Order?` | N | - | `@relation(fields: [orderId], references: [id])` |
| `refundRequest` | `RefundRequest?` | N | - | `@relation(fields: [refundRequestId], references: [id])` |

### 7.42 `RefundRequest`

- 表级属性：
  - `@@index([orderId, status])`
  - `@@map("refund_requests")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `orderId` | `String` | Y | - | `@map("order_id") @db.Uuid` |
| `reasonCode` | `String` | Y | - | `@map("reason_code")` |
| `reasonText` | `String?` | N | - | `@map("reason_text")` |
| `status` | `RefundStatus` | Y | PENDING/APPROVED/REJECTED/REFUNDING/REFUNDED | `@default(PENDING)` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `order` | `Order` | Y | - | `@relation(fields: [orderId], references: [id])` |
| `paymentWebhookEvents` | `PaymentWebhookEvent[]` | Y | - | `-` |

### 7.43 `CsCase`

- 表级属性：
  - `@@index([orderId, type])`
  - `@@index([csUserId])`
  - `@@map("cs_cases")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `orderId` | `String?` | N | - | `@map("order_id") @db.Uuid` |
| `csUserId` | `String?` | N | - | `@map("cs_user_id") @db.Uuid` |
| `title` | `String` | Y | - | `@default("")` |
| `type` | `CaseType` | Y | FOLLOWUP/REFUND/DISPUTE | `-` |
| `status` | `CaseStatus` | Y | OPEN/IN_PROGRESS/CLOSED | `@default(OPEN)` |
| `requesterName` | `String?` | N | - | `@map("requester_name")` |
| `priority` | `CasePriority?` | N | LOW/MEDIUM/HIGH | `-` |
| `description` | `String?` | N | - | `-` |
| `dueAt` | `DateTime?` | N | - | `@map("due_at")` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `order` | `Order?` | N | - | `@relation(fields: [orderId], references: [id])` |
| `csUser` | `User?` | N | - | `@relation("CsCase_Cs", fields: [csUserId], references: [id])` |
| `milestones` | `CsMilestone[]` | Y | - | `-` |
| `notes` | `CsCaseNote[]` | Y | - | `-` |
| `evidences` | `CsCaseEvidence[]` | Y | - | `-` |

### 7.44 `CsMilestone`

- 表级属性：
  - `@@index([caseId, name])`
  - `@@map("cs_milestones")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `caseId` | `String` | Y | - | `@map("case_id") @db.Uuid` |
| `name` | `MilestoneName` | Y | CONTRACT_SIGNED/TRANSFER_SUBMITTED/TRANSFER_COMPLETED | `-` |
| `status` | `String` | Y | - | `-` |
| `evidenceFileId` | `String?` | N | - | `@map("evidence_file_id") @db.Uuid` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `case` | `CsCase` | Y | - | `@relation(fields: [caseId], references: [id])` |
| `evidenceFile` | `File?` | N | - | `@relation(fields: [evidenceFileId], references: [id])` |

### 7.45 `CsCaseNote`

- 表级属性：
  - `@@index([caseId, createdAt])`
  - `@@map("cs_case_notes")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `caseId` | `String` | Y | - | `@map("case_id") @db.Uuid` |
| `authorId` | `String` | Y | - | `@map("author_id") @db.Uuid` |
| `authorName` | `String` | Y | - | `@map("author_name")` |
| `content` | `String` | Y | - | `-` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `case` | `CsCase` | Y | - | `@relation(fields: [caseId], references: [id])` |
| `author` | `User?` | N | - | `@relation("CsCaseNote_Author", fields: [authorId], references: [id])` |

### 7.46 `CsCaseEvidence`

- 表级属性：
  - `@@index([caseId, createdAt])`
  - `@@index([fileId])`
  - `@@map("cs_case_evidences")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `caseId` | `String` | Y | - | `@map("case_id") @db.Uuid` |
| `fileId` | `String` | Y | - | `@map("file_id") @db.Uuid` |
| `fileName` | `String?` | N | - | `@map("file_name")` |
| `url` | `String?` | N | - | `-` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `case` | `CsCase` | Y | - | `@relation(fields: [caseId], references: [id])` |
| `file` | `File?` | N | - | `@relation(fields: [fileId], references: [id])` |

### 7.47 `Settlement`

- 表级属性：
  - `@@index([payoutStatus])`
  - `@@map("settlements")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `orderId` | `String` | Y | - | `@unique @map("order_id") @db.Uuid` |
| `grossAmount` | `Int` | Y | - | `@map("gross_amount")` |
| `commissionAmount` | `Int` | Y | - | `@map("commission_amount")` |
| `payoutAmount` | `Int` | Y | - | `@map("payout_amount")` |
| `payoutMethod` | `SettlementPayoutMethod` | Y | MANUAL/WECHAT | `@map("payout_method")` |
| `payoutStatus` | `SettlementPayoutStatus` | Y | PENDING/SUCCEEDED/FAILED | `@map("payout_status")` |
| `payoutRef` | `String?` | N | - | `@map("payout_ref")` |
| `payoutEvidenceFileId` | `String?` | N | - | `@map("payout_evidence_file_id") @db.Uuid` |
| `payoutAt` | `DateTime?` | N | - | `@map("payout_at")` |
| `status` | `String` | Y | - | `-` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `order` | `Order` | Y | - | `@relation(fields: [orderId], references: [id])` |
| `payoutEvidenceFile` | `File?` | N | - | `@relation(fields: [payoutEvidenceFileId], references: [id])` |

### 7.48 `SystemConfig`

- 表级属性：
  - `@@map("system_configs")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `key` | `String` | Y | - | `@unique` |
| `valueType` | `SystemConfigValueType` | Y | INT/DECIMAL/STRING/JSON/BOOL | `@map("value_type")` |
| `value` | `String` | Y | - | `-` |
| `scope` | `SystemConfigScope` | Y | GLOBAL/TENANT | `-` |
| `version` | `Int` | Y | - | `@default(1)` |
| `updatedById` | `String?` | N | - | `@map("updated_by") @db.Uuid` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `updatedBy` | `User?` | N | - | `@relation("SystemConfig_UpdatedBy", fields: [updatedById], references: [id])` |

### 7.49 `IdempotencyKey`

- 表级属性：
  - `@@unique([key, scope, userId])`
  - `@@index([scope])`
  - `@@map("idempotency_keys")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `key` | `String` | Y | - | `@map("idempotency_key")` |
| `scope` | `String` | Y | - | `-` |
| `userId` | `String` | Y | - | `@map("user_id") @db.Uuid` |
| `requestHash` | `String?` | N | - | `@map("request_hash")` |
| `status` | `String` | Y | - | `-` |
| `responseJson` | `Json?` | N | - | `@map("response_json")` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `user` | `User` | Y | - | `@relation(fields: [userId], references: [id])` |

### 7.50 `AuditLog`

- 表级属性：
  - `@@index([targetType, targetId])`
  - `@@map("audit_logs")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `actorUserId` | `String` | Y | - | `@map("actor_user_id") @db.Uuid` |
| `action` | `String` | Y | - | `-` |
| `targetType` | `String` | Y | - | `@map("target_type")` |
| `targetId` | `String` | Y | - | `@map("target_id") @db.Uuid` |
| `beforeJson` | `Json?` | N | - | `@map("before_json")` |
| `afterJson` | `Json?` | N | - | `@map("after_json")` |
| `requestId` | `String?` | N | - | `@map("request_id")` |
| `ip` | `String?` | N | - | `-` |
| `userAgent` | `String?` | N | - | `@map("user_agent")` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `actor` | `User` | Y | - | `@relation("AuditLog_Actor", fields: [actorUserId], references: [id])` |

### 7.51 `RbacRole`

- 表级属性：
  - `@@map("rbac_roles")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id` |
| `name` | `String` | Y | - | `-` |
| `description` | `String?` | N | - | `-` |
| `permissionIds` | `Json?` | N | - | `@map("permission_ids_json")` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `userRoles` | `RbacUserRole[]` | Y | - | `-` |

### 7.52 `RbacUserRole`

- 表级属性：
  - `@@id([userId, roleId])`
  - `@@index([roleId])`
  - `@@map("rbac_user_roles")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `userId` | `String` | Y | - | `@map("user_id") @db.Uuid` |
| `roleId` | `String` | Y | - | `@map("role_id")` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `user` | `User` | Y | - | `@relation(fields: [userId], references: [id])` |
| `role` | `RbacRole` | Y | - | `@relation(fields: [roleId], references: [id])` |

### 7.53 `AiParseResult`

- 表级属性：
  - `@@index([contentType, contentId])`
  - `@@index([status, createdAt])`
  - `@@map("ai_parse_results")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `contentType` | `AiContentType` | Y | LISTING/ACHIEVEMENT | `@map("content_type")` |
| `contentId` | `String` | Y | - | `@map("content_id") @db.Uuid` |
| `summaryPlain` | `String?` | N | - | `@map("summary_plain")` |
| `featuresPlain` | `String?` | N | - | `@map("features_plain")` |
| `keywordsJson` | `Json?` | N | - | `@map("keywords_json")` |
| `confidence` | `Float` | Y | - | `@default(0)` |
| `modelVersion` | `String?` | N | - | `@map("model_version")` |
| `status` | `AiParseStatus` | Y | ACTIVE/REVIEW_REQUIRED/REPLACED | `@default(ACTIVE)` |
| `note` | `String?` | N | - | `-` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `feedbacks` | `AiParseFeedback[]` | Y | - | `-` |

### 7.54 `AiParseFeedback`

- 表级属性：
  - `@@index([parseResultId, createdAt])`
  - `@@map("ai_parse_feedbacks")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `parseResultId` | `String` | Y | - | `@map("parse_result_id") @db.Uuid` |
| `actorUserId` | `String?` | N | - | `@map("actor_user_id") @db.Uuid` |
| `actorType` | `AiParseFeedbackActorType` | Y | USER/ADMIN | `@map("actor_type")` |
| `score` | `Int` | Y | - | `-` |
| `reasonTagsJson` | `Json?` | N | - | `@map("reason_tags_json")` |
| `comment` | `String?` | N | - | `-` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `parseResult` | `AiParseResult` | Y | - | `@relation(fields: [parseResultId], references: [id])` |
| `actor` | `User?` | N | - | `@relation("AiParseFeedback_Actor", fields: [actorUserId], references: [id])` |

### 7.55 `AlertEvent`

- 表级属性：
  - `@@index([status, triggeredAt])`
  - `@@index([targetType, targetId])`
  - `@@map("alert_events")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `type` | `String` | Y | - | `-` |
| `severity` | `AlertSeverity` | Y | LOW/MEDIUM/HIGH | `-` |
| `channel` | `AlertChannel` | Y | SMS/EMAIL/IN_APP | `-` |
| `status` | `AlertStatus` | Y | PENDING/SENT/ACKED/SUPPRESSED | `-` |
| `targetType` | `AlertTargetType?` | N | PATENT/ORDER/LISTING/ACHIEVEMENT/AI_PARSE/IMPORT/PAYMENT/REFUND/SYSTEM | `@map("target_type")` |
| `targetId` | `String?` | N | - | `@map("target_id") @db.Uuid` |
| `message` | `String?` | N | - | `-` |
| `triggeredAt` | `DateTime` | Y | - | `@map("triggered_at")` |
| `sentAt` | `DateTime?` | N | - | `@map("sent_at")` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |

### 7.56 `PatentMaintenanceSchedule`

- 表级属性：
  - `@@unique([patentId, yearNo])`
  - `@@index([status, dueDate])`
  - `@@map("patent_maintenance_schedules")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `patentId` | `String` | Y | - | `@map("patent_id") @db.Uuid` |
| `yearNo` | `Int` | Y | - | `@map("year_no")` |
| `dueDate` | `DateTime` | Y | - | `@map("due_date") @db.Date` |
| `gracePeriodEnd` | `DateTime?` | N | - | `@map("grace_period_end") @db.Date` |
| `status` | `PatentMaintenanceStatus` | Y | DUE/PAID/OVERDUE/WAIVED | `@default(DUE)` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `patent` | `Patent` | Y | - | `@relation(fields: [patentId], references: [id])` |
| `tasks` | `PatentMaintenanceTask[]` | Y | - | `-` |
| `orders` | `PatentMaintenanceOrder[]` | Y | - | `-` |

### 7.57 `PatentMaintenanceTask`

- 表级属性：
  - `@@index([scheduleId, status])`
  - `@@index([assignedCsUserId])`
  - `@@map("patent_maintenance_tasks")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `scheduleId` | `String` | Y | - | `@map("schedule_id") @db.Uuid` |
| `assignedCsUserId` | `String?` | N | - | `@map("assigned_cs_user_id") @db.Uuid` |
| `status` | `PatentMaintenanceTaskStatus` | Y | OPEN/IN_PROGRESS/DONE/CANCELLED | `@default(OPEN)` |
| `note` | `String?` | N | - | `-` |
| `evidenceFileId` | `String?` | N | - | `@map("evidence_file_id") @db.Uuid` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `schedule` | `PatentMaintenanceSchedule` | Y | - | `@relation(fields: [scheduleId], references: [id])` |
| `assignedCsUser` | `User?` | N | - | `@relation("PatentMaintenanceTask_Assignee", fields: [assignedCsUserId], references: [id])` |
| `evidenceFile` | `File?` | N | - | `@relation("PatentMaintenanceTask_Evidence", fields: [evidenceFileId], references: [id])` |

### 7.58 `PatentMaintenanceOrder`

- 表级属性：
  - `@@index([scheduleId, status])`
  - `@@index([applicantUserId, createdAt])`
  - `@@index([assignedCsUserId, status])`
  - `@@map("patent_maintenance_orders")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `scheduleId` | `String` | Y | - | `@map("schedule_id") @db.Uuid` |
| `applicantUserId` | `String` | Y | - | `@map("applicant_user_id") @db.Uuid` |
| `assignedCsUserId` | `String?` | N | - | `@map("assigned_cs_user_id") @db.Uuid` |
| `status` | `PatentMaintenanceOrderStatus` | Y | REQUESTED/QUOTED/AWAITING_PAYMENT/PAID/EXECUTING/RECEIPT_UPLOADED/RECONCILED/CLOSED/CANCELLED | `@default(REQUESTED)` |
| `paymentChannel` | `PatentMaintenancePaymentChannel?` | N | WECHAT/OFFLINE_BANK/OFFLINE_OTHER | `@map("payment_channel")` |
| `officialFeeFen` | `Int` | Y | - | `@default(0) @map("official_fee_fen")` |
| `lateFeeFen` | `Int` | Y | - | `@default(0) @map("late_fee_fen")` |
| `serviceFeeFen` | `Int` | Y | - | `@default(0) @map("service_fee_fen")` |
| `totalAmountFen` | `Int` | Y | - | `@default(0) @map("total_amount_fen")` |
| `paymentDeadline` | `DateTime?` | N | - | `@map("payment_deadline")` |
| `paidAt` | `DateTime?` | N | - | `@map("paid_at")` |
| `executedAt` | `DateTime?` | N | - | `@map("executed_at")` |
| `receiptIssuedAt` | `DateTime?` | N | - | `@map("receipt_issued_at")` |
| `officialSubmissionNo` | `String?` | N | - | `@map("official_submission_no")` |
| `officialReceiptNo` | `String?` | N | - | `@map("official_receipt_no")` |
| `paymentTxnNo` | `String?` | N | - | `@map("payment_txn_no")` |
| `officialReceiptFileId` | `String?` | N | - | `@map("official_receipt_file_id") @db.Uuid` |
| `reconcileStatus` | `PatentMaintenanceReconcileStatus` | Y | PENDING/MATCHED/MISMATCHED | `@default(PENDING) @map("reconcile_status")` |
| `reconcileNote` | `String?` | N | - | `@map("reconcile_note")` |
| `closeNote` | `String?` | N | - | `@map("close_note")` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` |
| `schedule` | `PatentMaintenanceSchedule` | Y | - | `@relation(fields: [scheduleId], references: [id])` |
| `applicantUser` | `User` | Y | - | `@relation("PatentMaintenanceOrder_Applicant", fields: [applicantUserId], references: [id])` |
| `assignedCsUser` | `User?` | N | - | `@relation("PatentMaintenanceOrder_Assignee", fields: [assignedCsUserId], references: [id])` |
| `officialReceiptFile` | `File?` | N | - | `@relation("PatentMaintenanceOrder_ReceiptFile", fields: [officialReceiptFileId], references: [id])` |
| `events` | `PatentMaintenanceOrderEvent[]` | Y | - | `-` |

### 7.59 `PatentMaintenanceOrderEvent`

- 表级属性：
  - `@@index([orderId, createdAt])`
  - `@@index([actorUserId, createdAt])`
  - `@@map("patent_maintenance_order_events")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 |
|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` |
| `orderId` | `String` | Y | - | `@map("order_id") @db.Uuid` |
| `actorUserId` | `String?` | N | - | `@map("actor_user_id") @db.Uuid` |
| `eventType` | `PatentMaintenanceOrderEventType` | Y | CREATED/QUOTE_UPDATED/PAYMENT_CONFIRMED/EXECUTION_SUBMITTED/RECEIPT_UPLOADED/RECONCILED/CLOSED/CANCELLED/UPDATED | `@map("event_type")` |
| `fromStatus` | `PatentMaintenanceOrderStatus?` | N | REQUESTED/QUOTED/AWAITING_PAYMENT/PAID/EXECUTING/RECEIPT_UPLOADED/RECONCILED/CLOSED/CANCELLED | `@map("from_status")` |
| `toStatus` | `PatentMaintenanceOrderStatus` | Y | REQUESTED/QUOTED/AWAITING_PAYMENT/PAID/EXECUTING/RECEIPT_UPLOADED/RECONCILED/CLOSED/CANCELLED | `@map("to_status")` |
| `note` | `String?` | N | - | `-` |
| `payloadJson` | `Json?` | N | - | `@map("payload_json")` |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` |
| `order` | `PatentMaintenanceOrder` | Y | - | `@relation(fields: [orderId], references: [id])` |
| `actorUser` | `User?` | N | - | `@relation("PatentMaintenanceOrderEvent_Actor", fields: [actorUserId], references: [id])` |

## 8. 交接使用说明（评审建议）

- 架构评审时，建议先按“C4 上下文 -> C4 容器 -> 交易主链路 -> 资金与安全 -> 订单组件”顺序讲解，再进入字段明细。
- 联调时，以第 5 章为接口总览索引，第 6 章为请求/响应字段字典，第 7 章为落库字段核对依据。
- 如果后续版本变更了页面、接口或 Prisma 模型，请重新生成本文件并同步更新 PDF 归档。
