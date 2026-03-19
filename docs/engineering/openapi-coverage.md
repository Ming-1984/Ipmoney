# OpenAPI 鍓嶇 / Mock 瑕嗙洊鎶ュ憡锛堣嚜鍔ㄧ敓鎴愶級

> 鐢?`scripts/audit-coverage.mjs` 鐢熸垚锛涚敤浜庤鐩栧害瀹¤涓庨槻閬楀繕銆?
## 1. 姹囨€?
- OpenAPI operations锛?43
- 鍓嶇宸蹭娇鐢紙Client锛夛細110
- 鍓嶇宸蹭娇鐢紙Admin锛夛細132
- fixtures 鍦烘櫙鏁帮細7

## 2. 鍏抽敭宸紓锛堥渶浜哄伐纭涓庡洖濉級

- 鍓嶇浣跨敤浣?OpenAPI 鏈畾涔夛細0
- OpenAPI 瀹氫箟浣嗗墠绔湭浣跨敤锛?
  - GET /admin/ai/parse-results
  - GET /admin/ai/parse-results/:param
  - PATCH /admin/ai/parse-results/:param
  - POST /ai/agent/query
  - POST /ai/parse-results/:param/feedback
- 鍓嶇宸蹭娇鐢ㄤ絾 happy fixtures 鏈鐩栵紙浼氬洖钀藉埌 Prism锛夛細0

## 3. 瑕嗙洊鏄庣粏锛堟寜 operation锛?
| operationId | method | path | Client | Admin | happy | empty | error | edge | order_conflict | payment_callback_replay | refund_failed |
|---|---|---|---|---|---|---|---|---|---|---|---|
| unfavoriteAchievement | DELETE | /achievements/:param/favorites | 鉁?|  | 鉁?|  |  |  |  |  |  |
| adminDeleteAnnouncement | DELETE | /admin/announcements/:param |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminDeleteOrderInvoice | DELETE | /admin/orders/:param/invoice |  | 鉁?| 鉁?|  | 鉁?|  |  |  |  |
| adminDeleteRbacRole | DELETE | /admin/rbac/roles/:param |  | 鉁?| 鉁?|  |  |  |  |  |  |
| unfavoriteArtwork | DELETE | /artworks/:param/favorites | 鉁?|  | 鉁?|  |  |  |  |  |  |
| deleteComment | DELETE | /comments/:param | 鉁?|  | 鉁?| 鉁?| 鉁?| 鉁?|  |  |  |
| unfavoriteDemand | DELETE | /demands/:param/favorites | 鉁?|  | 鉁?|  |  |  |  |  |  |
| unfavoriteListing | DELETE | /listings/:param/favorites | 鉁?|  | 鉁?|  |  |  |  |  |  |
| deleteMyAddress | DELETE | /me/addresses/:param | 鉁?|  | 鉁?|  |  |  |  |  |  |
| listMyAchievements | GET | /achievements | 鉁?|  | 鉁?|  |  |  |  |  |  |
| getAchievementById | GET | /achievements/:param | 鉁?|  | 鉁?|  |  |  |  |  |  |
| adminListAchievementsForAudit | GET | /admin/achievements |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminGetAchievementById | GET | /admin/achievements/:param |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminGetAchievementAuditLogs | GET | /admin/achievements/:param/audit-logs |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminGetAchievementMaterials | GET | /admin/achievements/:param/materials |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminListAiParseResults | GET | /admin/ai/parse-results |  |  | 鉁?|  |  |  |  |  |  |
| adminGetAiParseResult | GET | /admin/ai/parse-results/:param |  |  |  |  |  |  |  |  |  |
| adminListAlertEvents | GET | /admin/alerts |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminListAnnouncements | GET | /admin/announcements |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminListArtworksForAudit | GET | /admin/artworks |  | 鉁?| 鉁?| 鉁?| 鉁?| 鉁?|  |  |  |
| adminGetArtworkById | GET | /admin/artworks/:param |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminGetArtworkAuditLogs | GET | /admin/artworks/:param/audit-logs |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminGetArtworkMaterials | GET | /admin/artworks/:param/materials |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminListAuditLogs | GET | /admin/audit-logs |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminListCases | GET | /admin/cases |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminGetCaseById | GET | /admin/cases/:param |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminListComments | GET | /admin/comments |  | 鉁?| 鉁?| 鉁?| 鉁?| 鉁?|  |  |  |
| adminGetAlertConfig | GET | /admin/config/alerts |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminGetBannerConfig | GET | /admin/config/banner |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminGetCustomerServiceConfig | GET | /admin/config/customer-service |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminGetHotSearchConfig | GET | /admin/config/hot-search |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminGetRecommendationConfig | GET | /admin/config/recommendation |  | 鉁?| 鉁?| 鉁?| 鉁?|  |  |  |  |
| adminGetSensitiveWordsConfig | GET | /admin/config/sensitive-words |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminGetTaxonomyConfig | GET | /admin/config/taxonomy |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminGetTradeRulesConfig | GET | /admin/config/trade-rules |  | 鉁?| 鉁?| 鉁?| 鉁?|  |  |  |  |
| adminListDemandsForAudit | GET | /admin/demands |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminGetDemandById | GET | /admin/demands/:param |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminGetDemandAuditLogs | GET | /admin/demands/:param/audit-logs |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminGetDemandMaterials | GET | /admin/demands/:param/materials |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminListIndustryTags | GET | /admin/industry-tags |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminListListingsForAudit | GET | /admin/listings |  | 鉁?| 鉁?| 鉁?| 鉁?|  |  |  |  |
| adminGetListingById | GET | /admin/listings/:param |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminGetListingAuditLogs | GET | /admin/listings/:param/audit-logs |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminGetListingMaterials | GET | /admin/listings/:param/materials |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminGetOrderById | GET | /admin/orders/:param |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminGetOrderSettlement | GET | /admin/orders/:param/settlement |  | 鉁?| 鉁?| 鉁?| 鉁?|  |  |  |  |
| adminListPatentMaintenanceSchedules | GET | /admin/patent-maintenance/schedules |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminGetPatentMaintenanceSchedule | GET | /admin/patent-maintenance/schedules/:param |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminListPatentMaintenanceTasks | GET | /admin/patent-maintenance/tasks |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminGetPatentMapEntry | GET | /admin/patent-map/regions/:param/years/:param |  | 鉁?| 鉁?| 鉁?| 鉁?|  |  |  |  |
| adminListPatents | GET | /admin/patents |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminGetPatentById | GET | /admin/patents/:param |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminListRbacPermissions | GET | /admin/rbac/permissions |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminListRbacRoles | GET | /admin/rbac/roles |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminListRbacUsers | GET | /admin/rbac/users |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminListRegions | GET | /admin/regions |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminGetFinanceReportSummary | GET | /admin/reports/finance/summary |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminListTechManagers | GET | /admin/tech-managers |  | 鉁?| 鉁?| 鉁?| 鉁?| 鉁?|  |  |  |
| adminListUserVerifications | GET | /admin/user-verifications |  | 鉁?| 鉁?| 鉁?| 鉁?|  |  |  |  |
| adminGetVerificationAuditLogs | GET | /admin/user-verifications/:param/audit-logs |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminGetVerificationMaterials | GET | /admin/user-verifications/:param/materials |  | 鉁?| 鉁?|  |  |  |  |  |  |
| listMyArtworks | GET | /artworks | 鉁?|  | 鉁?|  |  |  |  |  |  |
| getArtworkById | GET | /artworks/:param | 鉁?|  | 鉁?|  |  |  |  |  |  |
| listContracts | GET | /contracts | 鉁?|  | 鉁?|  |  |  |  |  |  |
| listConversationMessages | GET | /conversations/:param/messages | 鉁?|  | 鉁?| 鉁?| 鉁?|  |  |  |  |
| listMyDemands | GET | /demands | 鉁?|  | 鉁?|  |  |  |  |  |  |
| getDemandById | GET | /demands/:param | 鉁?|  | 鉁?|  |  |  |  |  |  |
| downloadFile | GET | /files/:param | 鉁?|  | 鉁?|  |  |  |  |  |  |
| previewFile | GET | /files/:param/preview | 鉁?|  | 鉁?|  |  |  |  |  |  |
| getHealth | GET | /health |  | 鉁?| 鉁?|  |  |  |  |  |  |
| listMyInvoices | GET | /invoices | 鉁?|  | 鉁?|  |  |  |  |  |  |
| listMyListings | GET | /listings | 鉁?|  | 鉁?|  |  |  |  |  |  |
| getListingById | GET | /listings/:param | 鉁?|  | 鉁?|  |  |  |  |  |  |
| getMe | GET | /me | 鉁?|  | 鉁?|  | 鉁?|  |  |  |  |
| listMyAddresses | GET | /me/addresses | 鉁?|  | 鉁?|  |  |  |  |  |  |
| listMyConversations | GET | /me/conversations | 鉁?|  | 鉁?| 鉁?| 鉁?|  |  |  |  |
| listMyFavoriteListings | GET | /me/favorites | 鉁?|  | 鉁?|  |  |  |  |  |  |
| listMyFavoriteAchievements | GET | /me/favorites/achievements | 鉁?|  | 鉁?|  |  |  |  |  |  |
| listMyFavoriteArtworks | GET | /me/favorites/artworks | 鉁?|  | 鉁?|  |  |  |  |  |  |
| listMyFavoriteDemands | GET | /me/favorites/demands | 鉁?|  | 鉁?|  |  |  |  |  |  |
| getMyRecommendedListings | GET | /me/recommendations/listings | 鉁?|  | 鉁?| 鉁?| 鉁?|  |  |  |  |
| getMyVerification | GET | /me/verification | 鉁?|  | 鉁?|  |  |  |  |  |  |
| listMyNotifications | GET | /notifications | 鉁?|  | 鉁?|  |  |  |  |  |  |
| getNotificationById | GET | /notifications/:param | 鉁?|  | 鉁?|  |  |  |  |  |  |
| listMyOrders | GET | /orders | 鉁?| 鉁?| 鉁?| 鉁?| 鉁?|  |  |  |  |
| getOrderById | GET | /orders/:param | 鉁?|  | 鉁?|  |  |  |  |  |  |
| getOrderCase | GET | /orders/:param/case | 鉁?|  | 鉁?|  |  |  |  |  |  |
| getOrderInvoice | GET | /orders/:param/invoice | 鉁?| 鉁?| 鉁?| 鉁?| 鉁?|  |  |  |  |
| listRefundRequestsByOrder | GET | /orders/:param/refund-requests | 鉁?| 鉁?| 鉁?| 鉁?| 鉁?|  |  |  |  |
| getPatentMapRegionDetail | GET | /patent-map/regions/:param | 鉁?|  | 鉁?|  |  |  |  |  |  |
| getPatentMapSummary | GET | /patent-map/summary | 鉁?| 鉁?| 鉁?| 鉁?| 鉁?|  |  |  |  |
| listPatentMapYears | GET | /patent-map/years | 鉁?| 鉁?| 鉁?| 鉁?| 鉁?|  |  |  |  |
| getPatentById | GET | /patents/:param | 鉁?|  | 鉁?|  |  |  |  |  |  |
| getPublicAchievementById | GET | /public/achievements/:param | 鉁?|  | 鉁?|  |  |  |  |  |  |
| listPublicAchievementComments | GET | /public/achievements/:param/comments | 鉁?|  | 鉁?| 鉁?| 鉁?|  |  |  |  |
| listPublicAnnouncements | GET | /public/announcements | 鉁?|  | 鉁?|  |  |  |  |  |  |
| getPublicAnnouncementById | GET | /public/announcements/:param | 鉁?|  | 鉁?|  |  |  |  |  |  |
| getPublicArtworkById | GET | /public/artworks/:param | 鉁?|  | 鉁?|  |  |  |  |  |  |
| listPublicArtworkComments | GET | /public/artworks/:param/comments | 鉁?|  | 鉁?| 鉁?| 鉁?| 鉁?|  |  |  |
| getPublicCustomerServiceConfig | GET | /public/config/customer-service | 鉁?|  | 鉁?|  |  |  |  |  |  |
| getPublicTradeRulesConfig | GET | /public/config/trade-rules | 鉁?|  | 鉁?|  |  |  |  |  |  |
| getPublicDemandById | GET | /public/demands/:param | 鉁?|  | 鉁?|  |  |  |  |  |  |
| listPublicDemandComments | GET | /public/demands/:param/comments | 鉁?|  | 鉁?| 鉁?| 鉁?|  |  |  |  |
| listPublicIndustryTags | GET | /public/industry-tags | 鉁?|  | 鉁?|  |  |  |  |  |  |
| getPublicListingById | GET | /public/listings/:param | 鉁?|  | 鉁?|  |  | 鉁?|  |  |  |
| listPublicListingComments | GET | /public/listings/:param/comments | 鉁?|  | 鉁?| 鉁?| 鉁?| 鉁?|  |  |  |
| listPublicOrganizations | GET | /public/organizations | 鉁?|  | 鉁?| 鉁?| 鉁?|  |  |  |  |
| getPublicOrganizationById | GET | /public/organizations/:param | 鉁?|  | 鉁?|  |  |  |  |  |  |
| getPublicTechManagerById | GET | /public/tech-managers/:param | 鉁?|  | 鉁?|  |  |  |  |  |  |
| listRegions | GET | /regions | 鉁?|  | 鉁?|  |  | 鉁?|  |  |  |
| searchAchievements | GET | /search/achievements | 鉁?|  | 鉁?| 鉁?| 鉁?| 鉁?|  |  |  |
| searchArtworks | GET | /search/artworks | 鉁?|  | 鉁?| 鉁?| 鉁?| 鉁?|  |  |  |
| searchDemands | GET | /search/demands | 鉁?|  | 鉁?| 鉁?| 鉁?| 鉁?|  |  |  |
| searchInventorRankings | GET | /search/inventors | 鉁?|  | 鉁?| 鉁?| 鉁?|  |  |  |  |
| searchListings | GET | /search/listings | 鉁?|  | 鉁?| 鉁?| 鉁?| 鉁?|  |  |  |
| searchTechManagers | GET | /search/tech-managers | 鉁?|  | 鉁?| 鉁?| 鉁?| 鉁?|  |  |  |
| updateAchievement | PATCH | /achievements/:param | 鉁?|  | 鉁?|  |  |  |  |  |  |
| adminUpdateAchievement | PATCH | /admin/achievements/:param |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminUpdateAiParseResult | PATCH | /admin/ai/parse-results/:param |  |  | 鉁?|  |  |  |  |  |  |
| adminUpdateAnnouncement | PATCH | /admin/announcements/:param |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminUpdateArtwork | PATCH | /admin/artworks/:param |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminUpdateComment | PATCH | /admin/comments/:param |  | 鉁?| 鉁?| 鉁?| 鉁?| 鉁?|  |  |  |
| adminUpdateDemand | PATCH | /admin/demands/:param |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminUpdateListing | PATCH | /admin/listings/:param |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminUpdatePatentMaintenanceSchedule | PATCH | /admin/patent-maintenance/schedules/:param |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminUpdatePatentMaintenanceTask | PATCH | /admin/patent-maintenance/tasks/:param |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminUpdatePatent | PATCH | /admin/patents/:param |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminUpdateRbacRole | PATCH | /admin/rbac/roles/:param |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminUpdateRbacUserRoles | PATCH | /admin/rbac/users/:param |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminUpdateRegion | PATCH | /admin/regions/:param |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminUpdateTechManager | PATCH | /admin/tech-managers/:param |  | 鉁?| 鉁?|  |  |  |  |  |  |
| updateArtwork | PATCH | /artworks/:param | 鉁?|  | 鉁?|  |  |  |  |  |  |
| updateComment | PATCH | /comments/:param | 鉁?|  | 鉁?| 鉁?| 鉁?| 鉁?|  |  |  |
| updateDemand | PATCH | /demands/:param | 鉁?|  | 鉁?|  |  |  |  |  |  |
| updateListing | PATCH | /listings/:param | 鉁?|  | 鉁?|  |  |  |  |  |  |
| updateMe | PATCH | /me | 鉁?|  | 鉁?|  |  |  |  |  |  |
| updateMyAddress | PATCH | /me/addresses/:param | 鉁?|  | 鉁?|  |  |  |  |  |  |
| createAchievement | POST | /achievements | 鉁?|  | 鉁?|  |  |  |  |  |  |
| createAchievementComment | POST | /achievements/:param/comments | 鉁?|  | 鉁?| 鉁?| 鉁?|  |  |  |  |
| upsertAchievementConversation | POST | /achievements/:param/conversations | 鉁?|  | 鉁?|  |  |  |  |  |  |
| favoriteAchievement | POST | /achievements/:param/favorites | 鉁?|  | 鉁?|  |  |  |  |  |  |
| offShelfAchievement | POST | /achievements/:param/off-shelf | 鉁?|  | 鉁?|  |  |  |  |  |  |
| submitAchievement | POST | /achievements/:param/submit | 鉁?|  | 鉁?|  |  |  |  |  |  |
| adminCreateAchievement | POST | /admin/achievements |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminApproveAchievement | POST | /admin/achievements/:param/approve |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminOffShelfAchievement | POST | /admin/achievements/:param/off-shelf |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminPublishAchievement | POST | /admin/achievements/:param/publish |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminRejectAchievement | POST | /admin/achievements/:param/reject |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminAcknowledgeAlertEvent | POST | /admin/alerts/:param/ack |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminCreateAnnouncement | POST | /admin/announcements |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminOffShelfAnnouncement | POST | /admin/announcements/:param/off-shelf |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminPublishAnnouncement | POST | /admin/announcements/:param/publish |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminCreateArtwork | POST | /admin/artworks |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminApproveArtwork | POST | /admin/artworks/:param/approve |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminOffShelfArtwork | POST | /admin/artworks/:param/off-shelf |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminPublishArtwork | POST | /admin/artworks/:param/publish |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminRejectArtwork | POST | /admin/artworks/:param/reject |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminCreateCase | POST | /admin/cases |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminAssignCase | POST | /admin/cases/:param/assign |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminAddCaseEvidence | POST | /admin/cases/:param/evidence |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminAddCaseNote | POST | /admin/cases/:param/notes |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminUpdateCaseSla | POST | /admin/cases/:param/sla |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminUpdateCaseStatus | POST | /admin/cases/:param/status |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminCreateDemand | POST | /admin/demands |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminApproveDemand | POST | /admin/demands/:param/approve |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminOffShelfDemand | POST | /admin/demands/:param/off-shelf |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminPublishDemand | POST | /admin/demands/:param/publish |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminRejectDemand | POST | /admin/demands/:param/reject |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminCreateIndustryTag | POST | /admin/industry-tags |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminCreateListing | POST | /admin/listings |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminApproveListing | POST | /admin/listings/:param/approve |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminOffShelfListing | POST | /admin/listings/:param/off-shelf |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminPublishListing | POST | /admin/listings/:param/publish |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminRejectListing | POST | /admin/listings/:param/reject |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminIssueOrderInvoice | POST | /admin/orders/:param/invoice |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminConfirmContractSigned | POST | /admin/orders/:param/milestones/contract-signed |  | 鉁?| 鉁?|  |  |  | 鉁?|  |  |
| adminConfirmTransferCompleted | POST | /admin/orders/:param/milestones/transfer-completed |  | 鉁?| 鉁?|  |  |  | 鉁?|  |  |
| adminManualConfirmPayment | POST | /admin/orders/:param/payments/manual |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminConfirmManualPayout | POST | /admin/orders/:param/payouts/manual |  | 鉁?| 鉁?|  | 鉁?|  |  |  |  |
| adminCreatePatentMaintenanceSchedule | POST | /admin/patent-maintenance/schedules |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminCreatePatentMaintenanceTask | POST | /admin/patent-maintenance/tasks |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminImportPatentMapExcel | POST | /admin/patent-map/import |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminCreatePatent | POST | /admin/patents |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminCreateRbacRole | POST | /admin/rbac/roles |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminApproveRefundRequest | POST | /admin/refund-requests/:param/approve |  | 鉁?| 鉁?|  |  |  |  |  | 鉁?|
| adminCompleteRefundRequest | POST | /admin/refund-requests/:param/complete |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminRejectRefundRequest | POST | /admin/refund-requests/:param/reject |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminCreateRegion | POST | /admin/regions |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminExportFinanceReport | POST | /admin/reports/finance/export |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminApproveUserVerification | POST | /admin/user-verifications/:param/approve |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminRejectUserVerification | POST | /admin/user-verifications/:param/reject |  | 鉁?| 鉁?|  |  |  |  |  |  |
| createAiAgentQuery | POST | /ai/agent/query |  |  | 鉁?|  |  |  |  |  |  |
| createAiParseFeedback | POST | /ai/parse-results/:param/feedback |  |  | 鉁?|  |  |  |  |  |  |
| createArtwork | POST | /artworks | 鉁?|  | 鉁?|  |  |  |  |  |  |
| createArtworkComment | POST | /artworks/:param/comments | 鉁?|  | 鉁?| 鉁?| 鉁?| 鉁?|  |  |  |
| upsertArtworkConversation | POST | /artworks/:param/conversations | 鉁?|  | 鉁?|  | 鉁?|  |  |  |  |
| favoriteArtwork | POST | /artworks/:param/favorites | 鉁?|  | 鉁?|  |  |  |  |  |  |
| offShelfArtwork | POST | /artworks/:param/off-shelf | 鉁?|  | 鉁?|  |  |  |  |  |  |
| submitArtwork | POST | /artworks/:param/submit | 鉁?|  | 鉁?|  |  |  |  |  |  |
| authSmsSend | POST | /auth/sms/send | 鉁?|  | 鉁?|  |  |  |  |  |  |
| authSmsVerify | POST | /auth/sms/verify | 鉁?|  | 鉁?|  |  |  |  |  |  |
| authWechatMpLogin | POST | /auth/wechat/mp-login | 鉁?|  | 鉁?|  |  |  |  |  |  |
| authWechatPhoneBind | POST | /auth/wechat/phone-bind | 鉁?|  | 鉁?|  |  |  |  |  |  |
| uploadContractPdf | POST | /contracts/:param/upload | 鉁?|  | 鉁?|  |  |  |  |  |  |
| sendConversationMessage | POST | /conversations/:param/messages | 鉁?|  | 鉁?|  | 鉁?|  |  |  |  |
| markConversationRead | POST | /conversations/:param/read | 鉁?|  | 鉁?|  | 鉁?|  |  |  |  |
| createDemand | POST | /demands | 鉁?|  | 鉁?|  |  |  |  |  |  |
| createDemandComment | POST | /demands/:param/comments | 鉁?|  | 鉁?| 鉁?| 鉁?|  |  |  |  |
| upsertDemandConversation | POST | /demands/:param/conversations | 鉁?|  | 鉁?|  |  |  |  |  |  |
| favoriteDemand | POST | /demands/:param/favorites | 鉁?|  | 鉁?|  |  |  |  |  |  |
| offShelfDemand | POST | /demands/:param/off-shelf | 鉁?|  | 鉁?|  |  |  |  |  |  |
| submitDemand | POST | /demands/:param/submit | 鉁?|  | 鉁?|  |  |  |  |  |  |
| uploadFile | POST | /files |  | 鉁?| 鉁?|  | 鉁?|  |  |  |  |
| createFileTemporaryAccess | POST | /files/:param/temporary-access | 鉁?|  | 鉁?|  |  |  |  |  |  |
| createListing | POST | /listings | 鉁?|  | 鉁?|  |  |  |  |  |  |
| createListingComment | POST | /listings/:param/comments | 鉁?|  | 鉁?| 鉁?| 鉁?| 鉁?|  |  |  |
| createListingConsultation | POST | /listings/:param/consultations | 鉁?|  | 鉁?|  |  |  |  |  |  |
| upsertListingConversation | POST | /listings/:param/conversations | 鉁?|  | 鉁?|  | 鉁?|  |  |  |  |
| favoriteListing | POST | /listings/:param/favorites | 鉁?|  | 鉁?|  |  |  |  |  |  |
| offShelfListing | POST | /listings/:param/off-shelf | 鉁?|  | 鉁?|  |  |  |  |  |  |
| submitListing | POST | /listings/:param/submit | 鉁?|  | 鉁?|  |  |  |  |  |  |
| createMyAddress | POST | /me/addresses | 鉁?|  | 鉁?|  |  |  |  |  |  |
| submitMyVerification | POST | /me/verification | 鉁?|  | 鉁?|  |  |  |  |  |  |
| createOrder | POST | /orders | 鉁?|  | 鉁?|  |  |  |  |  |  |
| requestOrderInvoice | POST | /orders/:param/invoice-requests | 鉁?|  | 鉁?|  |  |  |  |  |  |
| createPaymentIntent | POST | /orders/:param/payment-intents | 鉁?|  | 鉁?|  |  |  |  | 鉁?|  |
| createRefundRequest | POST | /orders/:param/refund-requests | 鉁?|  | 鉁?|  |  |  |  |  |  |
| normalizePatentNumber | POST | /patents/normalize |  | 鉁?| 鉁?| 鉁?| 鉁?|  |  |  |  |
| upsertTechManagerConversation | POST | /tech-managers/:param/conversations | 鉁?|  | 鉁?|  | 鉁?|  |  |  |  |
| wechatPayNotify | POST | /webhooks/wechatpay/notify |  |  | 鉁?|  |  |  |  |  |  |
| adminUpdateAlertConfig | PUT | /admin/config/alerts |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminUpdateBannerConfig | PUT | /admin/config/banner |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminUpdateCustomerServiceConfig | PUT | /admin/config/customer-service |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminUpdateHotSearchConfig | PUT | /admin/config/hot-search |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminUpdateRecommendationConfig | PUT | /admin/config/recommendation |  | 鉁?| 鉁?| 鉁?| 鉁?|  |  |  |  |
| adminUpdateSensitiveWordsConfig | PUT | /admin/config/sensitive-words |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminUpdateTaxonomyConfig | PUT | /admin/config/taxonomy |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminUpdateTradeRulesConfig | PUT | /admin/config/trade-rules |  | 鉁?| 鉁?| 鉁?| 鉁?|  |  |  |  |
| adminSetListingFeatured | PUT | /admin/listings/:param/featured |  | 鉁?| 鉁?|  |  |  |  |  |  |
| adminUpsertOrderInvoice | PUT | /admin/orders/:param/invoice |  | 鉁?| 鉁?|  | 鉁?|  |  |  |  |
| adminUpsertPatentMapEntry | PUT | /admin/patent-map/regions/:param/years/:param |  | 鉁?| 鉁?|  | 鉁?|  |  |  |  |
| adminSetRegionIndustryTags | PUT | /admin/regions/:param/industry-tags |  | 鉁?| 鉁?|  |  |  |  |  |  |

## 4. 浣跨敤璇存槑

- 鏈姤鍛婂彧鍋氣€滄帴鍙ｅ眰鈥濊鐩栧璁★細OpenAPI -> 鍓嶇璋冪敤 -> fixtures keys銆?- PRD 椤甸潰/涓氬姟瑙勫垯瑕嗙洊璇风粨鍚?`docs/engineering/traceability-matrix.md` 鐨勨€滈〉闈㈣兘鍔涚煩闃碘€濄€?- 鑻ユ煇鎺ュ彛鏈湪 happy fixtures 瑕嗙洊锛宮ock-api 浼氬洖钀藉埌 Prism 鐢熸垚鍝嶅簲锛屼絾涓嶄繚璇佹紨绀烘暟鎹川閲忋€?
