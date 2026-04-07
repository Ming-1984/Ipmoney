# Ipmoney 甲方交接文档（小程序 + 管理后台）

## 目录

1. 小程序页面清单
2. 管理后台页面清单
3. 页面-接口-字段对应关系
4. 接口清单（全量）
5. 接口字段字典（全量递归展开）
6. 数据库字段字典（Prisma）

## 1. 小程序页面清单

| 页面编号 | 页面路径 | 页面名称 | 所属包 | 业务域 |
|---|---|---|---|---|
| MP-001 | `pages/home/index` | 首页 | main（主包） | public discovery/search（公共浏览与检索） |
| MP-002 | `pages/tech-managers/index` | 技术经理 | main（主包） | public discovery/search（公共浏览与检索） |
| MP-003 | `pages/publish/index` | 发布 | main（主包） | my-content create/update/submit（我的内容创建、编辑与提交） |
| MP-004 | `pages/messages/index` | 消息 | main（主包） | conversations + notifications（会话消息与通知） |
| MP-005 | `pages/me/index` | 我的 | main（主包） | auth/me/verification（登录态、个人中心与认证） |
| MP-006 | `subpackages/search/index` | 搜索 | subpackages/search（分包：检索） | public discovery/search（公共浏览与检索） |
| MP-007 | `subpackages/patent/detail/index` | 专利详情 | subpackages/patent（分包：专利） | public discovery/search（公共浏览与检索） |
| MP-008 | `subpackages/orders/index` | 订单 | subpackages/orders（分包：订单） | orders/payment/address/invoice（订单、支付、地址与发票） |
| MP-009 | `subpackages/orders/detail/index` | 订单详情 | subpackages/orders（分包：订单） | orders/payment/address/invoice（订单、支付、地址与发票） |
| MP-010 | `subpackages/checkout/deposit-pay/index` | 订金支付 | subpackages/checkout（分包：支付） | orders/payment/address/invoice（订单、支付、地址与发票） |
| MP-011 | `subpackages/checkout/deposit-success/index` | 订金支付成功 | subpackages/checkout（分包：支付） | orders/payment/address/invoice（订单、支付、地址与发票） |
| MP-012 | `subpackages/checkout/final-pay/index` | 尾款支付 | subpackages/checkout（分包：支付） | orders/payment/address/invoice（订单、支付、地址与发票） |
| MP-013 | `subpackages/checkout/final-success/index` | 尾款支付成功 | subpackages/checkout（分包：支付） | orders/payment/address/invoice（订单、支付、地址与发票） |
| MP-014 | `subpackages/publish/patent/index` | 发布专利 | subpackages/publish（分包：发布） | public discovery/search（公共浏览与检索） |
| MP-015 | `subpackages/publish/achievement/index` | 发布成果 | subpackages/publish（分包：发布） | my-content create/update/submit（我的内容创建、编辑与提交） |
| MP-016 | `subpackages/messages/chat/index` | 消息会话 | subpackages/messages（分包：消息） | conversations + notifications（会话消息与通知） |
| MP-017 | `subpackages/support/index` | 客服 | subpackages/support（分包：客服） | static/config (no critical API write)（静态配置展示（无关键写接口）） |
| MP-018 | `subpackages/support/faq/index` | 客服常见问题 | subpackages/support（分包：客服） | static/config (no critical API write)（静态配置展示（无关键写接口）） |
| MP-019 | `subpackages/support/faq/detail/index` | 客服常见问题详情 | subpackages/support（分包：客服） | static/config (no critical API write)（静态配置展示（无关键写接口）） |
| MP-020 | `subpackages/support/contact/index` | 联系客服 | subpackages/support（分包：客服） | static/config (no critical API write)（静态配置展示（无关键写接口）） |
| MP-021 | `subpackages/legal/privacy/index` | 法律隐私 | subpackages/legal（分包：法律） | static/config (no critical API write)（静态配置展示（无关键写接口）） |
| MP-022 | `subpackages/legal/terms/index` | 法律条款 | subpackages/legal（分包：法律） | static/config (no critical API write)（静态配置展示（无关键写接口）） |
| MP-023 | `subpackages/legal/privacy-guide/index` | 法律隐私指引 | subpackages/legal（分包：法律） | static/config (no critical API write)（静态配置展示（无关键写接口）） |
| MP-024 | `subpackages/onboarding/choose-identity/index` | 引导选择身份 | subpackages/onboarding（分包：引导） | auth/me/verification（登录态、个人中心与认证） |
| MP-025 | `subpackages/onboarding/verification-form/index` | 引导认证表单 | subpackages/onboarding（分包：引导） | auth/me/verification（登录态、个人中心与认证） |
| MP-026 | `subpackages/notifications/index` | 通知 | subpackages/notifications（分包：通知） | conversations + notifications（会话消息与通知） |
| MP-027 | `subpackages/notifications/detail/index` | 通知详情 | subpackages/notifications（分包：通知） | conversations + notifications（会话消息与通知） |
| MP-028 | `subpackages/home-announcements/index` | 首页公告 | subpackages/home-announcements（分包：首页公告） | public discovery/search（公共浏览与检索） |
| MP-029 | `subpackages/home-announcements/detail/index` | 首页公告详情 | subpackages/home-announcements（分包：首页公告） | public discovery/search（公共浏览与检索） |
| MP-030 | `subpackages/listing/detail/index` | 挂牌详情 | subpackages/listing（分包：挂牌） | public discovery/search（公共浏览与检索） |
| MP-031 | `subpackages/achievement/detail/index` | 成果详情 | subpackages/achievement（分包：成果） | client/misc（小程序通用能力） |
| MP-032 | `subpackages/favorites/index` | 收藏 | subpackages/favorites（分包：收藏） | favorites（收藏能力） |
| MP-033 | `subpackages/organizations/index` | 机构 | subpackages/organizations（分包：机构） | public discovery/search（公共浏览与检索） |
| MP-034 | `subpackages/organizations/detail/index` | 机构详情 | subpackages/organizations（分包：机构） | public discovery/search（公共浏览与检索） |
| MP-035 | `subpackages/inventors/index` | 发明人 | subpackages/inventors（分包：发明人） | public discovery/search（公共浏览与检索） |
| MP-036 | `subpackages/patent-map/index` | 专利地图 | subpackages/patent-map（分包：专利地图） | public discovery/patent-map（公共浏览与专利地图） |
| MP-037 | `subpackages/tech-managers/detail/index` | 技术经理详情 | subpackages/tech-managers（分包：技术经理） | public discovery/search（公共浏览与检索） |
| MP-038 | `subpackages/trade-rules/index` | trade规则（交易规则） | subpackages/trade-rules（分包：交易规则） | static/config (no critical API write)（静态配置展示（无关键写接口）） |
| MP-039 | `subpackages/contracts/index` | 合同 | subpackages/contracts（分包：合同） | orders/payment/address/invoice（订单、支付、地址与发票） |
| MP-040 | `subpackages/invoices/index` | 发票 | subpackages/invoices（分包：发票） | orders/payment/address/invoice（订单、支付、地址与发票） |
| MP-041 | `subpackages/addresses/index` | 地址 | subpackages/addresses（分包：地址） | orders/payment/address/invoice（订单、支付、地址与发票） |
| MP-042 | `subpackages/addresses/edit/index` | 地址编辑 | subpackages/addresses（分包：地址） | orders/payment/address/invoice（订单、支付、地址与发票） |
| MP-043 | `subpackages/my-listings/index` | 我的挂牌 | subpackages/my-listings（分包：我的挂牌） | public discovery/search（公共浏览与检索） |
| MP-044 | `subpackages/my-achievements/index` | 我的成果 | subpackages/my-achievements（分包：我的成果） | my-content create/update/submit（我的内容创建、编辑与提交） |
| MP-045 | `subpackages/patent-claims/index` | 专利认领 | subpackages/patent-claims（分包：专利认领） | public discovery/search（公共浏览与检索） |
| MP-046 | `subpackages/maintenance/index` | 维保 | subpackages/maintenance（分包：维保） | client/misc（小程序通用能力） |
| MP-047 | `subpackages/settings/notifications/index` | 设置通知 | subpackages/settings（分包：设置） | auth/me/verification（登录态、个人中心与认证） |
| MP-048 | `subpackages/about/index` | 关于 | subpackages/about（分包：关于） | static/config (no critical API write)（静态配置展示（无关键写接口）） |
| MP-049 | `subpackages/profile/edit/index` | 资料编辑 | subpackages/profile（分包：资料） | auth/me/verification（登录态、个人中心与认证） |
| MP-050 | `subpackages/login/index` | 登录 | subpackages/login（分包：登录） | auth/me/verification（登录态、个人中心与认证） |
| MP-051 | `subpackages/ipc-picker/index` | IPC选择器 | subpackages/ipc-picker（分包：IPC选择器） | static/config (no critical API write)（静态配置展示（无关键写接口）） |
| MP-052 | `subpackages/media/video-preview/index` | 媒体视频preview（媒体视频预览） | subpackages/media（分包：媒体） | client/misc（小程序通用能力） |

## 2. 管理后台页面清单

| 页面编号 | 路由类型 | 路由路径 | 页面名称 | 业务域 |
|---|---|---|---|---|
| ADM-001 | path（路径路由） | `/login` | 登录 | admin/misc（管理后台通用能力） |
| ADM-002 | path（路径路由） | `/` | 页面 | admin/misc（管理后台通用能力） |
| ADM-003 | path（路径路由） | `verifications` | verifications（认证审核） | admin/verifications（认证审核） |
| ADM-004 | path（路径路由） | `listings` | 挂牌 | admin/listings-audit（挂牌审核） |
| ADM-005 | path（路径路由） | `tech-managers` | 技术经理 | admin/tech-managers（技术经理管理） |
| ADM-006 | path（路径路由） | `orders` | 订单 | admin/orders（订单管理） |
| ADM-007 | path（路径路由） | `orders/:orderId` | 订单 | admin/orders（订单管理） |
| ADM-008 | path（路径路由） | `cases` | cases（工单） | admin/misc（管理后台通用能力） |
| ADM-009 | path（路径路由） | `refunds` | refunds（退款） | admin/refunds（退款管理） |
| ADM-010 | path（路径路由） | `settlements` | settlements（结算） | admin/settlements（结算管理） |
| ADM-011 | path（路径路由） | `invoices` | 发票 | admin/invoices（发票管理） |
| ADM-012 | path（路径路由） | `reports` | reports（报表） | admin/reports（报表管理） |
| ADM-013 | path（路径路由） | `comments` | comments（评论） | admin/comments（评论管理） |
| ADM-014 | path（路径路由） | `alerts` | alerts（告警） | admin/alerts（告警管理） |
| ADM-015 | path（路径路由） | `audit-logs` | 审计logs（审计日志） | admin/audit-logs（审计日志） |
| ADM-016 | path（路径路由） | `rbac` | 权限 | admin/rbac（权限管理） |
| ADM-017 | path（路径路由） | `config` | 配置 | admin/config（系统配置） |
| ADM-018 | path（路径路由） | `home-announcements` | 首页公告 | admin/config-home-announcements（首页公告配置） |
| ADM-019 | path（路径路由） | `maintenance` | 维保 | admin/patent-maintenance（专利维保管理） |
| ADM-020 | path（路径路由） | `regions` | regions（地区） | admin/regions（地区字典管理） |
| ADM-021 | path（路径路由） | `patents` | patents（专利） | admin/patents（专利与认领管理） |
| ADM-022 | path（路径路由） | `patents/operations` | patentsoperations（专利操作） | admin/patents（专利与认领管理） |
| ADM-023 | path（路径路由） | `patents/claims` | patents认领（专利认领） | admin/patents（专利与认领管理） |
| ADM-024 | path（路径路由） | `conversations/platform` | conversationsplatform（平台会话） | admin/misc（管理后台通用能力） |
| ADM-025 | index（默认首页路由） | `/` | 首页 | admin/dashboard（后台首页看板） |

## 3. 页面-接口-字段对应关系

| 页面编号 | 页面名称 | 关联接口数 | 关联 Schema 数 | 关联字段总数 |
|---|---|---|---|---|
| MP-001 | 首页 | 35 | 92 | 1088 |
| MP-002 | 技术经理 | 35 | 92 | 1088 |
| MP-003 | 发布 | 31 | 61 | 842 |
| MP-004 | 消息 | 9 | 12 | 57 |
| MP-005 | 我的 | 13 | 35 | 280 |
| MP-006 | 搜索 | 35 | 92 | 1088 |
| MP-007 | 专利详情 | 35 | 92 | 1088 |
| MP-008 | 订单 | 12 | 31 | 230 |
| MP-009 | 订单详情 | 12 | 31 | 230 |
| MP-010 | 订金支付 | 12 | 31 | 230 |
| MP-011 | 订金支付成功 | 12 | 31 | 230 |
| MP-012 | 尾款支付 | 12 | 31 | 230 |
| MP-013 | 尾款支付成功 | 12 | 31 | 230 |
| MP-014 | 发布专利 | 35 | 92 | 1088 |
| MP-015 | 发布成果 | 31 | 61 | 842 |
| MP-016 | 消息会话 | 9 | 12 | 57 |
| MP-017 | 客服 | 1 | 5 | 18 |
| MP-018 | 客服常见问题 | 1 | 5 | 18 |
| MP-019 | 客服常见问题详情 | 1 | 5 | 18 |
| MP-020 | 联系客服 | 1 | 5 | 18 |
| MP-021 | 法律隐私 | 1 | 5 | 18 |
| MP-022 | 法律条款 | 1 | 5 | 18 |
| MP-023 | 法律隐私指引 | 1 | 5 | 18 |
| MP-024 | 引导选择身份 | 13 | 35 | 280 |
| MP-025 | 引导认证表单 | 13 | 35 | 280 |
| MP-026 | 通知 | 9 | 12 | 57 |
| MP-027 | 通知详情 | 9 | 12 | 57 |
| MP-028 | 首页公告 | 35 | 92 | 1088 |
| MP-029 | 首页公告详情 | 35 | 92 | 1088 |
| MP-030 | 挂牌详情 | 35 | 92 | 1088 |
| MP-031 | 成果详情 | 25 | 62 | 496 |
| MP-032 | 收藏 | 2 | 3 | 4 |
| MP-033 | 机构 | 35 | 92 | 1088 |
| MP-034 | 机构详情 | 35 | 92 | 1088 |
| MP-035 | 发明人 | 35 | 92 | 1088 |
| MP-036 | 专利地图 | 2 | 17 | 134 |
| MP-037 | 技术经理详情 | 35 | 92 | 1088 |
| MP-038 | trade规则（交易规则） | 1 | 5 | 18 |
| MP-039 | 合同 | 12 | 31 | 230 |
| MP-040 | 发票 | 12 | 31 | 230 |
| MP-041 | 地址 | 12 | 31 | 230 |
| MP-042 | 地址编辑 | 12 | 31 | 230 |
| MP-043 | 我的挂牌 | 35 | 92 | 1088 |
| MP-044 | 我的成果 | 15 | 35 | 365 |
| MP-045 | 专利认领 | 35 | 92 | 1088 |
| MP-046 | 维保 | 25 | 62 | 496 |
| MP-047 | 设置通知 | 13 | 35 | 280 |
| MP-048 | 关于 | 1 | 5 | 18 |
| MP-049 | 资料编辑 | 13 | 35 | 280 |
| MP-050 | 登录 | 13 | 35 | 280 |
| MP-051 | IPC选择器 | 1 | 5 | 18 |
| MP-052 | 媒体视频preview（媒体视频预览） | 25 | 62 | 496 |
| ADM-001 | 登录 | 5 | 11 | 41 |
| ADM-002 | 页面 | 56 | 93 | 729 |
| ADM-003 | verifications（认证审核） | 0 | 0 | 0 |
| ADM-004 | 挂牌 | 23 | 51 | 679 |
| ADM-005 | 技术经理 | 2 | 10 | 68 |
| ADM-006 | 订单 | 9 | 17 | 83 |
| ADM-007 | 订单 | 9 | 17 | 83 |
| ADM-008 | cases（工单） | 8 | 12 | 81 |
| ADM-009 | refunds（退款） | 0 | 0 | 0 |
| ADM-010 | settlements（结算） | 0 | 0 | 0 |
| ADM-011 | 发票 | 0 | 0 | 0 |
| ADM-012 | reports（报表） | 2 | 5 | 14 |
| ADM-013 | comments（评论） | 2 | 13 | 52 |
| ADM-014 | alerts（告警） | 2 | 9 | 32 |
| ADM-015 | 审计logs（审计日志） | 1 | 5 | 24 |
| ADM-016 | 权限 | 8 | 14 | 56 |
| ADM-017 | 配置 | 25 | 33 | 215 |
| ADM-018 | 首页公告 | 9 | 11 | 90 |
| ADM-019 | 维保 | 0 | 0 | 0 |
| ADM-020 | regions（地区） | 4 | 5 | 23 |
| ADM-021 | patents（专利） | 12 | 40 | 371 |
| ADM-022 | patentsoperations（专利操作） | 12 | 40 | 371 |
| ADM-023 | patents认领（专利认领） | 12 | 40 | 371 |
| ADM-024 | conversationsplatform（平台会话） | 1 | 12 | 61 |
| ADM-025 | 首页 | 0 | 0 | 0 |

### 3.1 页面对应接口清单

#### MP-001 `pages/home/index` 首页

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/listings` | `listMyListings` | Y | Listings（挂牌） | 小程序端挂牌查询列表 |
| POST | `/listings` | `createListing` | Y | Listings（挂牌） | 小程序端挂牌提交 |
| GET | `/listings/{listingId}` | `getListingById` | Y | Listings（挂牌） | 小程序端挂牌查询详情 |
| PATCH | `/listings/{listingId}` | `updateListing` | Y | Listings（挂牌） | 小程序端挂牌更新 |
| POST | `/listings/{listingId}/comments` | `createListingComment` | Y | Comments（评论） | 小程序端挂牌/评论提交 |
| POST | `/listings/{listingId}/consultations` | `createListingConsultation` | Y | Listings（挂牌） | 小程序端挂牌/咨询提交 |
| POST | `/listings/{listingId}/conversations` | `upsertListingConversation` | Y | Messaging（消息会话） | 小程序端挂牌/会话提交 |
| POST | `/listings/{listingId}/favorites` | `favoriteListing` | Y | Listings（挂牌） | 小程序端挂牌/收藏提交 |
| DELETE | `/listings/{listingId}/favorites` | `unfavoriteListing` | Y | Listings（挂牌） | 小程序端挂牌/收藏删除 |
| POST | `/listings/{listingId}/off-shelf` | `offShelfListing` | Y | Listings（挂牌） | 小程序端挂牌/下架提交 |
| POST | `/listings/{listingId}/submit` | `submitListing` | Y | Listings（挂牌） | 小程序端挂牌提交 |
| GET | `/me/favorites` | `listMyFavoriteListings` | Y | Listings（挂牌） | 小程序端收藏查询列表 |
| GET | `/me/patent-claims` | `listMyPatentClaims` | Y | Patents（专利） | 小程序端专利认领查询列表 |
| POST | `/me/patent-claims` | `createMyPatentClaim` | Y | Patents（专利） | 小程序端专利认领提交 |
| GET | `/me/patent-maintenance/orders` | `listMyPatentMaintenanceOrders` | Y | Maintenance（专利维保） | 小程序端专利维保/订单查询列表 |
| POST | `/me/patent-maintenance/orders` | `createMyPatentMaintenanceOrder` | Y | Maintenance（专利维保） | 小程序端专利维保/订单提交 |
| GET | `/me/patent-maintenance/orders/{orderId}` | `getMyPatentMaintenanceOrder` | Y | Maintenance（专利维保） | 小程序端专利维保/订单查询详情 |
| GET | `/me/patent-maintenance/orders/{orderId}/events` | `listMyPatentMaintenanceOrderEvents` | Y | Maintenance（专利维保） | 小程序端专利维保/订单/事件查询列表 |
| GET | `/me/patent-maintenance/schedules` | `listMyPatentMaintenanceSchedules` | Y | Maintenance（专利维保） | 小程序端专利维保/日程查询列表 |
| GET | `/me/patent-maintenance/tasks` | `listMyPatentMaintenanceTasks` | Y | Maintenance（专利维保） | 小程序端专利维保/任务查询列表 |
| GET | `/me/recommendations/listings` | `getMyRecommendedListings` | Y | Search（检索） | 小程序端推荐/挂牌查询列表 |
| POST | `/patent-maintenance/orders/{orderId}/conversations` | `upsertMaintenanceOrderConversation` | Y | Messaging（消息会话）, Maintenance（专利维保） | 小程序端专利维保/订单/会话提交 |
| POST | `/patents/normalize` | `normalizePatentNumber` | N | Patents（专利） | 小程序端专利/规范化提交 |
| GET | `/patents/{patentId}` | `getPatentById` | Y | Patents（专利） | 小程序端专利查询详情 |
| GET | `/public/config/home-announcements` | `getPublicHomeAnnouncementsFeed` | N | Config（配置） | 小程序端配置/首页公告查询列表 |
| GET | `/public/listings/{listingId}` | `getPublicListingById` | N | Listings（挂牌） | 小程序端挂牌查询详情 |
| GET | `/public/listings/{listingId}/comments` | `listPublicListingComments` | N | Comments（评论） | 小程序端挂牌/评论查询列表 |
| GET | `/public/organizations` | `listPublicOrganizations` | N | Organizations（机构） | 小程序端机构查询列表 |
| GET | `/public/organizations/{orgUserId}` | `getPublicOrganizationById` | N | Organizations（机构） | 小程序端机构查询详情 |
| GET | `/public/tech-managers/{techManagerId}` | `getPublicTechManagerById` | N | TechManagers（技术经理） | 小程序端技术经理查询详情 |
| GET | `/search/achievements` | `searchAchievements` | N | Search（检索）, Achievements（成果） | 小程序端成果查询列表 |
| GET | `/search/inventors` | `searchInventorRankings` | N | Search（检索） | 小程序端发明人查询列表 |
| GET | `/search/listings` | `searchListings` | N | Search（检索） | 小程序端挂牌查询列表 |
| GET | `/search/tech-managers` | `searchTechManagers` | N | Search（检索）, TechManagers（技术经理） | 小程序端技术经理查询列表 |
| POST | `/tech-managers/{techManagerId}/conversations` | `upsertTechManagerConversation` | Y | Messaging（消息会话）, TechManagers（技术经理） | 小程序端技术经理/会话提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `AchievementMaturity` | 0 |
| `AchievementSortBy` | 0 |
| `AchievementSummary` | 46 |
| `AiContentType` | 0 |
| `AiParseResult` | 16 |
| `AiParseStatus` | 0 |
| `AuditStatus` | 0 |
| `Comment` | 27 |
| `CommentContentType` | 0 |
| `CommentCreateRequest` | 3 |
| `CommentStatus` | 0 |
| `CommentThread` | 59 |
| `ConsultationRouting` | 0 |
| `ContentSource` | 0 |
| `ContentStatus` | 0 |
| `Conversation` | 19 |
| `ConversationContentType` | 0 |
| `ErrorResponse` | 3 |
| `ExistingLicenseStatus` | 0 |
| `FeaturedLevel` | 0 |
| `InventorRankingItem` | 4 |
| `Jurisdiction` | 0 |
| `LegalStatus` | 0 |
| `LicenseMode` | 0 |
| `Listing` | 112 |
| `ListingConsultationCreated` | 3 |
| `ListingCreateRequest` | 62 |
| `ListingMedia` | 4 |
| `ListingPublic` | 121 |
| `ListingStats` | 4 |
| `ListingStatus` | 0 |
| `ListingSummary` | 65 |
| `ListingTopic` | 0 |
| `ListingUpdateRequest` | 60 |
| `MaintenanceUrgency` | 0 |
| `MoneyFen` | 0 |
| `MyPatentMaintenanceSchedule` | 16 |
| `MyPatentMaintenanceTask` | 24 |
| `OrganizationStats` | 2 |
| `OrganizationSummary` | 17 |
| `PageMeta` | 3 |
| `PagedAchievementSummary` | 54 |
| `PagedCommentThread` | 67 |
| `PagedInventorRanking` | 12 |
| `PagedListing` | 121 |
| `PagedListingSummary` | 73 |
| `PagedMyPatentMaintenanceOrder` | 46 |
| `PagedMyPatentMaintenanceSchedule` | 25 |
| `PagedMyPatentMaintenanceTask` | 33 |
| `PagedOrganizationSummary` | 25 |
| `PagedPatentClaimRequest` | 27 |
| `PagedTechManagerSummary` | 27 |
| `Patent` | 71 |
| `PatentClaimCreateRequest` | 6 |
| `PatentClaimRequest` | 19 |
| `PatentClaimStatus` | 0 |
| `PatentMaintenanceOrder` | 38 |
| `PatentMaintenanceOrderEvent` | 17 |
| `PatentMaintenanceOrderEventList` | 20 |
| `PatentMaintenanceOrderEventType` | 0 |
| `PatentMaintenanceOrderMyCreateRequest` | 2 |
| `PatentMaintenanceOrderStatus` | 0 |
| `PatentMaintenancePaymentChannel` | 0 |
| `PatentMaintenanceReconcileStatus` | 0 |
| `PatentMaintenanceSchedule` | 11 |
| `PatentMaintenanceStatus` | 0 |
| `PatentMaintenanceTask` | 13 |
| `PatentMaintenanceTaskStatus` | 0 |
| `PatentMedia` | 5 |
| `PatentNormalizeRequest` | 1 |
| `PatentNormalizeResponse` | 15 |
| `PatentNumberInputType` | 0 |
| `PatentOwnerClaimSource` | 0 |
| `PatentTradeSnapshot` | 22 |
| `PatentType` | 0 |
| `PledgeStatus` | 0 |
| `PriceType` | 0 |
| `PublicHomeAnnouncementFeed` | 12 |
| `PublicHomeAnnouncementItem` | 8 |
| `SearchQType` | 0 |
| `SortBy` | 0 |
| `SupplyType` | 0 |
| `TechManagerPublic` | 22 |
| `TechManagerSortBy` | 0 |
| `TechManagerStats` | 4 |
| `TechManagerSummary` | 19 |
| `TradeMode` | 0 |
| `UserBrief` | 12 |
| `UserRole` | 0 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### MP-002 `pages/tech-managers/index` 技术经理

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/listings` | `listMyListings` | Y | Listings（挂牌） | 小程序端挂牌查询列表 |
| POST | `/listings` | `createListing` | Y | Listings（挂牌） | 小程序端挂牌提交 |
| GET | `/listings/{listingId}` | `getListingById` | Y | Listings（挂牌） | 小程序端挂牌查询详情 |
| PATCH | `/listings/{listingId}` | `updateListing` | Y | Listings（挂牌） | 小程序端挂牌更新 |
| POST | `/listings/{listingId}/comments` | `createListingComment` | Y | Comments（评论） | 小程序端挂牌/评论提交 |
| POST | `/listings/{listingId}/consultations` | `createListingConsultation` | Y | Listings（挂牌） | 小程序端挂牌/咨询提交 |
| POST | `/listings/{listingId}/conversations` | `upsertListingConversation` | Y | Messaging（消息会话） | 小程序端挂牌/会话提交 |
| POST | `/listings/{listingId}/favorites` | `favoriteListing` | Y | Listings（挂牌） | 小程序端挂牌/收藏提交 |
| DELETE | `/listings/{listingId}/favorites` | `unfavoriteListing` | Y | Listings（挂牌） | 小程序端挂牌/收藏删除 |
| POST | `/listings/{listingId}/off-shelf` | `offShelfListing` | Y | Listings（挂牌） | 小程序端挂牌/下架提交 |
| POST | `/listings/{listingId}/submit` | `submitListing` | Y | Listings（挂牌） | 小程序端挂牌提交 |
| GET | `/me/favorites` | `listMyFavoriteListings` | Y | Listings（挂牌） | 小程序端收藏查询列表 |
| GET | `/me/patent-claims` | `listMyPatentClaims` | Y | Patents（专利） | 小程序端专利认领查询列表 |
| POST | `/me/patent-claims` | `createMyPatentClaim` | Y | Patents（专利） | 小程序端专利认领提交 |
| GET | `/me/patent-maintenance/orders` | `listMyPatentMaintenanceOrders` | Y | Maintenance（专利维保） | 小程序端专利维保/订单查询列表 |
| POST | `/me/patent-maintenance/orders` | `createMyPatentMaintenanceOrder` | Y | Maintenance（专利维保） | 小程序端专利维保/订单提交 |
| GET | `/me/patent-maintenance/orders/{orderId}` | `getMyPatentMaintenanceOrder` | Y | Maintenance（专利维保） | 小程序端专利维保/订单查询详情 |
| GET | `/me/patent-maintenance/orders/{orderId}/events` | `listMyPatentMaintenanceOrderEvents` | Y | Maintenance（专利维保） | 小程序端专利维保/订单/事件查询列表 |
| GET | `/me/patent-maintenance/schedules` | `listMyPatentMaintenanceSchedules` | Y | Maintenance（专利维保） | 小程序端专利维保/日程查询列表 |
| GET | `/me/patent-maintenance/tasks` | `listMyPatentMaintenanceTasks` | Y | Maintenance（专利维保） | 小程序端专利维保/任务查询列表 |
| GET | `/me/recommendations/listings` | `getMyRecommendedListings` | Y | Search（检索） | 小程序端推荐/挂牌查询列表 |
| POST | `/patent-maintenance/orders/{orderId}/conversations` | `upsertMaintenanceOrderConversation` | Y | Messaging（消息会话）, Maintenance（专利维保） | 小程序端专利维保/订单/会话提交 |
| POST | `/patents/normalize` | `normalizePatentNumber` | N | Patents（专利） | 小程序端专利/规范化提交 |
| GET | `/patents/{patentId}` | `getPatentById` | Y | Patents（专利） | 小程序端专利查询详情 |
| GET | `/public/config/home-announcements` | `getPublicHomeAnnouncementsFeed` | N | Config（配置） | 小程序端配置/首页公告查询列表 |
| GET | `/public/listings/{listingId}` | `getPublicListingById` | N | Listings（挂牌） | 小程序端挂牌查询详情 |
| GET | `/public/listings/{listingId}/comments` | `listPublicListingComments` | N | Comments（评论） | 小程序端挂牌/评论查询列表 |
| GET | `/public/organizations` | `listPublicOrganizations` | N | Organizations（机构） | 小程序端机构查询列表 |
| GET | `/public/organizations/{orgUserId}` | `getPublicOrganizationById` | N | Organizations（机构） | 小程序端机构查询详情 |
| GET | `/public/tech-managers/{techManagerId}` | `getPublicTechManagerById` | N | TechManagers（技术经理） | 小程序端技术经理查询详情 |
| GET | `/search/achievements` | `searchAchievements` | N | Search（检索）, Achievements（成果） | 小程序端成果查询列表 |
| GET | `/search/inventors` | `searchInventorRankings` | N | Search（检索） | 小程序端发明人查询列表 |
| GET | `/search/listings` | `searchListings` | N | Search（检索） | 小程序端挂牌查询列表 |
| GET | `/search/tech-managers` | `searchTechManagers` | N | Search（检索）, TechManagers（技术经理） | 小程序端技术经理查询列表 |
| POST | `/tech-managers/{techManagerId}/conversations` | `upsertTechManagerConversation` | Y | Messaging（消息会话）, TechManagers（技术经理） | 小程序端技术经理/会话提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `AchievementMaturity` | 0 |
| `AchievementSortBy` | 0 |
| `AchievementSummary` | 46 |
| `AiContentType` | 0 |
| `AiParseResult` | 16 |
| `AiParseStatus` | 0 |
| `AuditStatus` | 0 |
| `Comment` | 27 |
| `CommentContentType` | 0 |
| `CommentCreateRequest` | 3 |
| `CommentStatus` | 0 |
| `CommentThread` | 59 |
| `ConsultationRouting` | 0 |
| `ContentSource` | 0 |
| `ContentStatus` | 0 |
| `Conversation` | 19 |
| `ConversationContentType` | 0 |
| `ErrorResponse` | 3 |
| `ExistingLicenseStatus` | 0 |
| `FeaturedLevel` | 0 |
| `InventorRankingItem` | 4 |
| `Jurisdiction` | 0 |
| `LegalStatus` | 0 |
| `LicenseMode` | 0 |
| `Listing` | 112 |
| `ListingConsultationCreated` | 3 |
| `ListingCreateRequest` | 62 |
| `ListingMedia` | 4 |
| `ListingPublic` | 121 |
| `ListingStats` | 4 |
| `ListingStatus` | 0 |
| `ListingSummary` | 65 |
| `ListingTopic` | 0 |
| `ListingUpdateRequest` | 60 |
| `MaintenanceUrgency` | 0 |
| `MoneyFen` | 0 |
| `MyPatentMaintenanceSchedule` | 16 |
| `MyPatentMaintenanceTask` | 24 |
| `OrganizationStats` | 2 |
| `OrganizationSummary` | 17 |
| `PageMeta` | 3 |
| `PagedAchievementSummary` | 54 |
| `PagedCommentThread` | 67 |
| `PagedInventorRanking` | 12 |
| `PagedListing` | 121 |
| `PagedListingSummary` | 73 |
| `PagedMyPatentMaintenanceOrder` | 46 |
| `PagedMyPatentMaintenanceSchedule` | 25 |
| `PagedMyPatentMaintenanceTask` | 33 |
| `PagedOrganizationSummary` | 25 |
| `PagedPatentClaimRequest` | 27 |
| `PagedTechManagerSummary` | 27 |
| `Patent` | 71 |
| `PatentClaimCreateRequest` | 6 |
| `PatentClaimRequest` | 19 |
| `PatentClaimStatus` | 0 |
| `PatentMaintenanceOrder` | 38 |
| `PatentMaintenanceOrderEvent` | 17 |
| `PatentMaintenanceOrderEventList` | 20 |
| `PatentMaintenanceOrderEventType` | 0 |
| `PatentMaintenanceOrderMyCreateRequest` | 2 |
| `PatentMaintenanceOrderStatus` | 0 |
| `PatentMaintenancePaymentChannel` | 0 |
| `PatentMaintenanceReconcileStatus` | 0 |
| `PatentMaintenanceSchedule` | 11 |
| `PatentMaintenanceStatus` | 0 |
| `PatentMaintenanceTask` | 13 |
| `PatentMaintenanceTaskStatus` | 0 |
| `PatentMedia` | 5 |
| `PatentNormalizeRequest` | 1 |
| `PatentNormalizeResponse` | 15 |
| `PatentNumberInputType` | 0 |
| `PatentOwnerClaimSource` | 0 |
| `PatentTradeSnapshot` | 22 |
| `PatentType` | 0 |
| `PledgeStatus` | 0 |
| `PriceType` | 0 |
| `PublicHomeAnnouncementFeed` | 12 |
| `PublicHomeAnnouncementItem` | 8 |
| `SearchQType` | 0 |
| `SortBy` | 0 |
| `SupplyType` | 0 |
| `TechManagerPublic` | 22 |
| `TechManagerSortBy` | 0 |
| `TechManagerStats` | 4 |
| `TechManagerSummary` | 19 |
| `TradeMode` | 0 |
| `UserBrief` | 12 |
| `UserRole` | 0 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### MP-003 `pages/publish/index` 发布

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/achievements` | `listMyAchievements` | Y | Achievements（成果） | 小程序端成果查询列表 |
| POST | `/achievements` | `createAchievement` | Y | Achievements（成果） | 小程序端成果提交 |
| GET | `/achievements/{achievementId}` | `getMyAchievementById` | Y | Achievements（成果） | 小程序端成果查询详情 |
| PATCH | `/achievements/{achievementId}` | `updateMyAchievement` | Y | Achievements（成果） | 小程序端成果更新 |
| POST | `/achievements/{achievementId}/comments` | `createAchievementComment` | Y | Comments（评论）, Achievements（成果） | 小程序端成果/评论提交 |
| POST | `/achievements/{achievementId}/consultations` | `createAchievementConsultation` | Y | Achievements（成果） | 小程序端成果/咨询提交 |
| POST | `/achievements/{achievementId}/conversations` | `upsertAchievementConversation` | Y | Messaging（消息会话）, Achievements（成果） | 小程序端成果/会话提交 |
| POST | `/achievements/{achievementId}/favorites` | `favoriteAchievement` | Y | Achievements（成果） | 小程序端成果/收藏提交 |
| DELETE | `/achievements/{achievementId}/favorites` | `unfavoriteAchievement` | Y | Achievements（成果） | 小程序端成果/收藏删除 |
| POST | `/achievements/{achievementId}/off-shelf` | `offShelfAchievement` | Y | Achievements（成果） | 小程序端成果/下架提交 |
| POST | `/achievements/{achievementId}/submit` | `submitAchievement` | Y | Achievements（成果） | 小程序端成果提交 |
| GET | `/listings` | `listMyListings` | Y | Listings（挂牌） | 小程序端挂牌查询列表 |
| POST | `/listings` | `createListing` | Y | Listings（挂牌） | 小程序端挂牌提交 |
| GET | `/listings/{listingId}` | `getListingById` | Y | Listings（挂牌） | 小程序端挂牌查询详情 |
| PATCH | `/listings/{listingId}` | `updateListing` | Y | Listings（挂牌） | 小程序端挂牌更新 |
| POST | `/listings/{listingId}/comments` | `createListingComment` | Y | Comments（评论） | 小程序端挂牌/评论提交 |
| POST | `/listings/{listingId}/consultations` | `createListingConsultation` | Y | Listings（挂牌） | 小程序端挂牌/咨询提交 |
| POST | `/listings/{listingId}/conversations` | `upsertListingConversation` | Y | Messaging（消息会话） | 小程序端挂牌/会话提交 |
| POST | `/listings/{listingId}/favorites` | `favoriteListing` | Y | Listings（挂牌） | 小程序端挂牌/收藏提交 |
| DELETE | `/listings/{listingId}/favorites` | `unfavoriteListing` | Y | Listings（挂牌） | 小程序端挂牌/收藏删除 |
| POST | `/listings/{listingId}/off-shelf` | `offShelfListing` | Y | Listings（挂牌） | 小程序端挂牌/下架提交 |
| POST | `/listings/{listingId}/submit` | `submitListing` | Y | Listings（挂牌） | 小程序端挂牌提交 |
| GET | `/me/favorites` | `listMyFavoriteListings` | Y | Listings（挂牌） | 小程序端收藏查询列表 |
| GET | `/me/favorites/achievements` | `listMyFavoriteAchievements` | Y | Achievements（成果） | 小程序端收藏/成果查询列表 |
| GET | `/me/recommendations/listings` | `getMyRecommendedListings` | Y | Search（检索） | 小程序端推荐/挂牌查询列表 |
| GET | `/public/achievements/{achievementId}` | `getPublicAchievementById` | N | Achievements（成果） | 小程序端成果查询详情 |
| GET | `/public/achievements/{achievementId}/comments` | `listPublicAchievementComments` | N | Comments（评论）, Achievements（成果） | 小程序端成果/评论查询列表 |
| GET | `/public/listings/{listingId}` | `getPublicListingById` | N | Listings（挂牌） | 小程序端挂牌查询详情 |
| GET | `/public/listings/{listingId}/comments` | `listPublicListingComments` | N | Comments（评论） | 小程序端挂牌/评论查询列表 |
| GET | `/search/achievements` | `searchAchievements` | N | Search（检索）, Achievements（成果） | 小程序端成果查询列表 |
| GET | `/search/listings` | `searchListings` | N | Search（检索） | 小程序端挂牌查询列表 |

| Schema | 字段数（全量展开） |
|---|---|
| `AchievementCreateRequest` | 22 |
| `AchievementDetail` | 60 |
| `AchievementEdit` | 61 |
| `AchievementMaturity` | 0 |
| `AchievementRecord` | 26 |
| `AchievementSortBy` | 0 |
| `AchievementSummary` | 46 |
| `AchievementUpdateRequest` | 22 |
| `AiContentType` | 0 |
| `AiParseResult` | 16 |
| `AiParseStatus` | 0 |
| `AuditStatus` | 0 |
| `Comment` | 27 |
| `CommentContentType` | 0 |
| `CommentCreateRequest` | 3 |
| `CommentStatus` | 0 |
| `CommentThread` | 59 |
| `ConsultationRouting` | 0 |
| `ContentMedia` | 9 |
| `ContentMediaInput` | 5 |
| `ContentMediaType` | 0 |
| `ContentSource` | 0 |
| `ContentStatus` | 0 |
| `Conversation` | 19 |
| `ConversationContentType` | 0 |
| `ErrorResponse` | 3 |
| `ExistingLicenseStatus` | 0 |
| `FeaturedLevel` | 0 |
| `LegalStatus` | 0 |
| `LicenseMode` | 0 |
| `Listing` | 112 |
| `ListingConsultationCreated` | 3 |
| `ListingCreateRequest` | 62 |
| `ListingMedia` | 4 |
| `ListingPublic` | 121 |
| `ListingStats` | 4 |
| `ListingStatus` | 0 |
| `ListingSummary` | 65 |
| `ListingTopic` | 0 |
| `ListingUpdateRequest` | 60 |
| `MoneyFen` | 0 |
| `OkResponse` | 1 |
| `OrganizationStats` | 2 |
| `OrganizationSummary` | 17 |
| `PageMeta` | 3 |
| `PagedAchievementSummary` | 54 |
| `PagedCommentThread` | 67 |
| `PagedListing` | 121 |
| `PagedListingSummary` | 73 |
| `PatentType` | 0 |
| `PledgeStatus` | 0 |
| `PriceType` | 0 |
| `SearchQType` | 0 |
| `SortBy` | 0 |
| `SupplyType` | 0 |
| `TradeMode` | 0 |
| `UserBrief` | 12 |
| `UserRole` | 0 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### MP-004 `pages/messages/index` 消息

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| POST | `/achievements/{achievementId}/conversations` | `upsertAchievementConversation` | Y | Messaging（消息会话）, Achievements（成果） | 小程序端成果/会话提交 |
| GET | `/conversations/{conversationId}/messages` | `listConversationMessages` | Y | Messaging（消息会话） | 小程序端会话/消息查询列表 |
| POST | `/conversations/{conversationId}/messages` | `sendConversationMessage` | Y | Messaging（消息会话） | 小程序端会话/消息提交 |
| POST | `/conversations/{conversationId}/read` | `markConversationRead` | Y | Messaging（消息会话） | 小程序端会话/已读提交 |
| GET | `/notifications` | `listMyNotifications` | Y | Notifications（通知） | 小程序端通知查询列表 |
| GET | `/notifications/{notificationId}` | `getNotificationById` | Y | Notifications（通知） | 小程序端通知查询详情 |
| POST | `/orders/{orderId}/dispute-conversations` | `upsertOrderDisputeConversation` | Y | Messaging（消息会话）, Orders（订单） | 小程序端订单/纠纷会话提交 |
| POST | `/support/conversations` | `upsertSupportConversation` | Y | Messaging（消息会话） | 小程序端客服/会话提交 |
| POST | `/webhooks/wechatpay/notify` | `wechatPayNotify` | N | Payments（支付） | 小程序端微信支付/通知回调提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `Conversation` | 19 |
| `ConversationContentType` | 0 |
| `ConversationMessage` | 13 |
| `ConversationMessageSendRequest` | 3 |
| `ConversationMessageType` | 0 |
| `ErrorResponse` | 3 |
| `Notification` | 8 |
| `NotificationKind` | 0 |
| `PageMeta` | 3 |
| `PagedConversationMessage` | 17 |
| `PagedNotification` | 16 |
| `Uuid` | 0 |

#### MP-005 `pages/me/index` 我的

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/auth/session` | `authGetSession` | Y | Auth（认证） | 小程序端会话查询列表 |
| POST | `/auth/sms/send` | `authSmsSend` | N | Auth（认证） | 小程序端短信/发送提交 |
| POST | `/auth/sms/verify` | `authSmsVerify` | N | Auth（认证） | 小程序端短信/验证提交 |
| POST | `/auth/wechat/mp-login` | `authWechatMpLogin` | N | Auth（认证） | 小程序端微信/小程序登录提交 |
| POST | `/auth/wechat/phone-bind` | `authWechatPhoneBind` | Y | Auth（认证） | 小程序端微信/手机号绑定提交 |
| GET | `/me/addresses` | `listMyAddresses` | Y | Users（用户） | 小程序端地址查询列表 |
| POST | `/me/addresses` | `createMyAddress` | Y | Users（用户） | 小程序端地址提交 |
| PATCH | `/me/addresses/{addressId}` | `updateMyAddress` | Y | Users（用户） | 小程序端地址更新 |
| DELETE | `/me/addresses/{addressId}` | `deleteMyAddress` | Y | Users（用户） | 小程序端地址删除 |
| GET | `/me/conversations` | `listMyConversations` | Y | Messaging（消息会话） | 小程序端会话查询列表 |
| GET | `/me/favorites/achievements` | `listMyFavoriteAchievements` | Y | Achievements（成果） | 小程序端收藏/成果查询列表 |
| GET | `/me/verification` | `getMyVerification` | Y | Users（用户） | 小程序端认证查询列表 |
| POST | `/me/verification` | `submitMyVerification` | Y | Users（用户） | 小程序端认证提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `AchievementMaturity` | 0 |
| `AchievementSummary` | 46 |
| `Address` | 12 |
| `AddressCreateRequest` | 6 |
| `AddressUpdateRequest` | 6 |
| `AuditStatus` | 0 |
| `AuthSession` | 13 |
| `AuthTokenResponse` | 22 |
| `ContentSource` | 0 |
| `ContentStatus` | 0 |
| `ConversationContentType` | 0 |
| `ConversationSummary` | 33 |
| `ErrorResponse` | 3 |
| `ListingStats` | 4 |
| `ListingTopic` | 0 |
| `OkResponse` | 1 |
| `OrganizationStats` | 2 |
| `OrganizationSummary` | 17 |
| `PageMeta` | 3 |
| `PagedAchievementSummary` | 54 |
| `PagedConversationSummary` | 41 |
| `PhoneNumber` | 0 |
| `SmsPurpose` | 0 |
| `SupplyType` | 0 |
| `UserBrief` | 12 |
| `UserProfile` | 17 |
| `UserRole` | 0 |
| `UserVerification` | 26 |
| `UserVerificationSubmitOrganizationRequest` | 13 |
| `UserVerificationSubmitPersonRequest` | 3 |
| `UserVerificationSubmitRequest` | 34 |
| `UserVerificationSubmitTechManagerRequest` | 12 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### MP-006 `subpackages/search/index` 搜索

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/listings` | `listMyListings` | Y | Listings（挂牌） | 小程序端挂牌查询列表 |
| POST | `/listings` | `createListing` | Y | Listings（挂牌） | 小程序端挂牌提交 |
| GET | `/listings/{listingId}` | `getListingById` | Y | Listings（挂牌） | 小程序端挂牌查询详情 |
| PATCH | `/listings/{listingId}` | `updateListing` | Y | Listings（挂牌） | 小程序端挂牌更新 |
| POST | `/listings/{listingId}/comments` | `createListingComment` | Y | Comments（评论） | 小程序端挂牌/评论提交 |
| POST | `/listings/{listingId}/consultations` | `createListingConsultation` | Y | Listings（挂牌） | 小程序端挂牌/咨询提交 |
| POST | `/listings/{listingId}/conversations` | `upsertListingConversation` | Y | Messaging（消息会话） | 小程序端挂牌/会话提交 |
| POST | `/listings/{listingId}/favorites` | `favoriteListing` | Y | Listings（挂牌） | 小程序端挂牌/收藏提交 |
| DELETE | `/listings/{listingId}/favorites` | `unfavoriteListing` | Y | Listings（挂牌） | 小程序端挂牌/收藏删除 |
| POST | `/listings/{listingId}/off-shelf` | `offShelfListing` | Y | Listings（挂牌） | 小程序端挂牌/下架提交 |
| POST | `/listings/{listingId}/submit` | `submitListing` | Y | Listings（挂牌） | 小程序端挂牌提交 |
| GET | `/me/favorites` | `listMyFavoriteListings` | Y | Listings（挂牌） | 小程序端收藏查询列表 |
| GET | `/me/patent-claims` | `listMyPatentClaims` | Y | Patents（专利） | 小程序端专利认领查询列表 |
| POST | `/me/patent-claims` | `createMyPatentClaim` | Y | Patents（专利） | 小程序端专利认领提交 |
| GET | `/me/patent-maintenance/orders` | `listMyPatentMaintenanceOrders` | Y | Maintenance（专利维保） | 小程序端专利维保/订单查询列表 |
| POST | `/me/patent-maintenance/orders` | `createMyPatentMaintenanceOrder` | Y | Maintenance（专利维保） | 小程序端专利维保/订单提交 |
| GET | `/me/patent-maintenance/orders/{orderId}` | `getMyPatentMaintenanceOrder` | Y | Maintenance（专利维保） | 小程序端专利维保/订单查询详情 |
| GET | `/me/patent-maintenance/orders/{orderId}/events` | `listMyPatentMaintenanceOrderEvents` | Y | Maintenance（专利维保） | 小程序端专利维保/订单/事件查询列表 |
| GET | `/me/patent-maintenance/schedules` | `listMyPatentMaintenanceSchedules` | Y | Maintenance（专利维保） | 小程序端专利维保/日程查询列表 |
| GET | `/me/patent-maintenance/tasks` | `listMyPatentMaintenanceTasks` | Y | Maintenance（专利维保） | 小程序端专利维保/任务查询列表 |
| GET | `/me/recommendations/listings` | `getMyRecommendedListings` | Y | Search（检索） | 小程序端推荐/挂牌查询列表 |
| POST | `/patent-maintenance/orders/{orderId}/conversations` | `upsertMaintenanceOrderConversation` | Y | Messaging（消息会话）, Maintenance（专利维保） | 小程序端专利维保/订单/会话提交 |
| POST | `/patents/normalize` | `normalizePatentNumber` | N | Patents（专利） | 小程序端专利/规范化提交 |
| GET | `/patents/{patentId}` | `getPatentById` | Y | Patents（专利） | 小程序端专利查询详情 |
| GET | `/public/config/home-announcements` | `getPublicHomeAnnouncementsFeed` | N | Config（配置） | 小程序端配置/首页公告查询列表 |
| GET | `/public/listings/{listingId}` | `getPublicListingById` | N | Listings（挂牌） | 小程序端挂牌查询详情 |
| GET | `/public/listings/{listingId}/comments` | `listPublicListingComments` | N | Comments（评论） | 小程序端挂牌/评论查询列表 |
| GET | `/public/organizations` | `listPublicOrganizations` | N | Organizations（机构） | 小程序端机构查询列表 |
| GET | `/public/organizations/{orgUserId}` | `getPublicOrganizationById` | N | Organizations（机构） | 小程序端机构查询详情 |
| GET | `/public/tech-managers/{techManagerId}` | `getPublicTechManagerById` | N | TechManagers（技术经理） | 小程序端技术经理查询详情 |
| GET | `/search/achievements` | `searchAchievements` | N | Search（检索）, Achievements（成果） | 小程序端成果查询列表 |
| GET | `/search/inventors` | `searchInventorRankings` | N | Search（检索） | 小程序端发明人查询列表 |
| GET | `/search/listings` | `searchListings` | N | Search（检索） | 小程序端挂牌查询列表 |
| GET | `/search/tech-managers` | `searchTechManagers` | N | Search（检索）, TechManagers（技术经理） | 小程序端技术经理查询列表 |
| POST | `/tech-managers/{techManagerId}/conversations` | `upsertTechManagerConversation` | Y | Messaging（消息会话）, TechManagers（技术经理） | 小程序端技术经理/会话提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `AchievementMaturity` | 0 |
| `AchievementSortBy` | 0 |
| `AchievementSummary` | 46 |
| `AiContentType` | 0 |
| `AiParseResult` | 16 |
| `AiParseStatus` | 0 |
| `AuditStatus` | 0 |
| `Comment` | 27 |
| `CommentContentType` | 0 |
| `CommentCreateRequest` | 3 |
| `CommentStatus` | 0 |
| `CommentThread` | 59 |
| `ConsultationRouting` | 0 |
| `ContentSource` | 0 |
| `ContentStatus` | 0 |
| `Conversation` | 19 |
| `ConversationContentType` | 0 |
| `ErrorResponse` | 3 |
| `ExistingLicenseStatus` | 0 |
| `FeaturedLevel` | 0 |
| `InventorRankingItem` | 4 |
| `Jurisdiction` | 0 |
| `LegalStatus` | 0 |
| `LicenseMode` | 0 |
| `Listing` | 112 |
| `ListingConsultationCreated` | 3 |
| `ListingCreateRequest` | 62 |
| `ListingMedia` | 4 |
| `ListingPublic` | 121 |
| `ListingStats` | 4 |
| `ListingStatus` | 0 |
| `ListingSummary` | 65 |
| `ListingTopic` | 0 |
| `ListingUpdateRequest` | 60 |
| `MaintenanceUrgency` | 0 |
| `MoneyFen` | 0 |
| `MyPatentMaintenanceSchedule` | 16 |
| `MyPatentMaintenanceTask` | 24 |
| `OrganizationStats` | 2 |
| `OrganizationSummary` | 17 |
| `PageMeta` | 3 |
| `PagedAchievementSummary` | 54 |
| `PagedCommentThread` | 67 |
| `PagedInventorRanking` | 12 |
| `PagedListing` | 121 |
| `PagedListingSummary` | 73 |
| `PagedMyPatentMaintenanceOrder` | 46 |
| `PagedMyPatentMaintenanceSchedule` | 25 |
| `PagedMyPatentMaintenanceTask` | 33 |
| `PagedOrganizationSummary` | 25 |
| `PagedPatentClaimRequest` | 27 |
| `PagedTechManagerSummary` | 27 |
| `Patent` | 71 |
| `PatentClaimCreateRequest` | 6 |
| `PatentClaimRequest` | 19 |
| `PatentClaimStatus` | 0 |
| `PatentMaintenanceOrder` | 38 |
| `PatentMaintenanceOrderEvent` | 17 |
| `PatentMaintenanceOrderEventList` | 20 |
| `PatentMaintenanceOrderEventType` | 0 |
| `PatentMaintenanceOrderMyCreateRequest` | 2 |
| `PatentMaintenanceOrderStatus` | 0 |
| `PatentMaintenancePaymentChannel` | 0 |
| `PatentMaintenanceReconcileStatus` | 0 |
| `PatentMaintenanceSchedule` | 11 |
| `PatentMaintenanceStatus` | 0 |
| `PatentMaintenanceTask` | 13 |
| `PatentMaintenanceTaskStatus` | 0 |
| `PatentMedia` | 5 |
| `PatentNormalizeRequest` | 1 |
| `PatentNormalizeResponse` | 15 |
| `PatentNumberInputType` | 0 |
| `PatentOwnerClaimSource` | 0 |
| `PatentTradeSnapshot` | 22 |
| `PatentType` | 0 |
| `PledgeStatus` | 0 |
| `PriceType` | 0 |
| `PublicHomeAnnouncementFeed` | 12 |
| `PublicHomeAnnouncementItem` | 8 |
| `SearchQType` | 0 |
| `SortBy` | 0 |
| `SupplyType` | 0 |
| `TechManagerPublic` | 22 |
| `TechManagerSortBy` | 0 |
| `TechManagerStats` | 4 |
| `TechManagerSummary` | 19 |
| `TradeMode` | 0 |
| `UserBrief` | 12 |
| `UserRole` | 0 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### MP-007 `subpackages/patent/detail/index` 专利详情

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/listings` | `listMyListings` | Y | Listings（挂牌） | 小程序端挂牌查询列表 |
| POST | `/listings` | `createListing` | Y | Listings（挂牌） | 小程序端挂牌提交 |
| GET | `/listings/{listingId}` | `getListingById` | Y | Listings（挂牌） | 小程序端挂牌查询详情 |
| PATCH | `/listings/{listingId}` | `updateListing` | Y | Listings（挂牌） | 小程序端挂牌更新 |
| POST | `/listings/{listingId}/comments` | `createListingComment` | Y | Comments（评论） | 小程序端挂牌/评论提交 |
| POST | `/listings/{listingId}/consultations` | `createListingConsultation` | Y | Listings（挂牌） | 小程序端挂牌/咨询提交 |
| POST | `/listings/{listingId}/conversations` | `upsertListingConversation` | Y | Messaging（消息会话） | 小程序端挂牌/会话提交 |
| POST | `/listings/{listingId}/favorites` | `favoriteListing` | Y | Listings（挂牌） | 小程序端挂牌/收藏提交 |
| DELETE | `/listings/{listingId}/favorites` | `unfavoriteListing` | Y | Listings（挂牌） | 小程序端挂牌/收藏删除 |
| POST | `/listings/{listingId}/off-shelf` | `offShelfListing` | Y | Listings（挂牌） | 小程序端挂牌/下架提交 |
| POST | `/listings/{listingId}/submit` | `submitListing` | Y | Listings（挂牌） | 小程序端挂牌提交 |
| GET | `/me/favorites` | `listMyFavoriteListings` | Y | Listings（挂牌） | 小程序端收藏查询列表 |
| GET | `/me/patent-claims` | `listMyPatentClaims` | Y | Patents（专利） | 小程序端专利认领查询列表 |
| POST | `/me/patent-claims` | `createMyPatentClaim` | Y | Patents（专利） | 小程序端专利认领提交 |
| GET | `/me/patent-maintenance/orders` | `listMyPatentMaintenanceOrders` | Y | Maintenance（专利维保） | 小程序端专利维保/订单查询列表 |
| POST | `/me/patent-maintenance/orders` | `createMyPatentMaintenanceOrder` | Y | Maintenance（专利维保） | 小程序端专利维保/订单提交 |
| GET | `/me/patent-maintenance/orders/{orderId}` | `getMyPatentMaintenanceOrder` | Y | Maintenance（专利维保） | 小程序端专利维保/订单查询详情 |
| GET | `/me/patent-maintenance/orders/{orderId}/events` | `listMyPatentMaintenanceOrderEvents` | Y | Maintenance（专利维保） | 小程序端专利维保/订单/事件查询列表 |
| GET | `/me/patent-maintenance/schedules` | `listMyPatentMaintenanceSchedules` | Y | Maintenance（专利维保） | 小程序端专利维保/日程查询列表 |
| GET | `/me/patent-maintenance/tasks` | `listMyPatentMaintenanceTasks` | Y | Maintenance（专利维保） | 小程序端专利维保/任务查询列表 |
| GET | `/me/recommendations/listings` | `getMyRecommendedListings` | Y | Search（检索） | 小程序端推荐/挂牌查询列表 |
| POST | `/patent-maintenance/orders/{orderId}/conversations` | `upsertMaintenanceOrderConversation` | Y | Messaging（消息会话）, Maintenance（专利维保） | 小程序端专利维保/订单/会话提交 |
| POST | `/patents/normalize` | `normalizePatentNumber` | N | Patents（专利） | 小程序端专利/规范化提交 |
| GET | `/patents/{patentId}` | `getPatentById` | Y | Patents（专利） | 小程序端专利查询详情 |
| GET | `/public/config/home-announcements` | `getPublicHomeAnnouncementsFeed` | N | Config（配置） | 小程序端配置/首页公告查询列表 |
| GET | `/public/listings/{listingId}` | `getPublicListingById` | N | Listings（挂牌） | 小程序端挂牌查询详情 |
| GET | `/public/listings/{listingId}/comments` | `listPublicListingComments` | N | Comments（评论） | 小程序端挂牌/评论查询列表 |
| GET | `/public/organizations` | `listPublicOrganizations` | N | Organizations（机构） | 小程序端机构查询列表 |
| GET | `/public/organizations/{orgUserId}` | `getPublicOrganizationById` | N | Organizations（机构） | 小程序端机构查询详情 |
| GET | `/public/tech-managers/{techManagerId}` | `getPublicTechManagerById` | N | TechManagers（技术经理） | 小程序端技术经理查询详情 |
| GET | `/search/achievements` | `searchAchievements` | N | Search（检索）, Achievements（成果） | 小程序端成果查询列表 |
| GET | `/search/inventors` | `searchInventorRankings` | N | Search（检索） | 小程序端发明人查询列表 |
| GET | `/search/listings` | `searchListings` | N | Search（检索） | 小程序端挂牌查询列表 |
| GET | `/search/tech-managers` | `searchTechManagers` | N | Search（检索）, TechManagers（技术经理） | 小程序端技术经理查询列表 |
| POST | `/tech-managers/{techManagerId}/conversations` | `upsertTechManagerConversation` | Y | Messaging（消息会话）, TechManagers（技术经理） | 小程序端技术经理/会话提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `AchievementMaturity` | 0 |
| `AchievementSortBy` | 0 |
| `AchievementSummary` | 46 |
| `AiContentType` | 0 |
| `AiParseResult` | 16 |
| `AiParseStatus` | 0 |
| `AuditStatus` | 0 |
| `Comment` | 27 |
| `CommentContentType` | 0 |
| `CommentCreateRequest` | 3 |
| `CommentStatus` | 0 |
| `CommentThread` | 59 |
| `ConsultationRouting` | 0 |
| `ContentSource` | 0 |
| `ContentStatus` | 0 |
| `Conversation` | 19 |
| `ConversationContentType` | 0 |
| `ErrorResponse` | 3 |
| `ExistingLicenseStatus` | 0 |
| `FeaturedLevel` | 0 |
| `InventorRankingItem` | 4 |
| `Jurisdiction` | 0 |
| `LegalStatus` | 0 |
| `LicenseMode` | 0 |
| `Listing` | 112 |
| `ListingConsultationCreated` | 3 |
| `ListingCreateRequest` | 62 |
| `ListingMedia` | 4 |
| `ListingPublic` | 121 |
| `ListingStats` | 4 |
| `ListingStatus` | 0 |
| `ListingSummary` | 65 |
| `ListingTopic` | 0 |
| `ListingUpdateRequest` | 60 |
| `MaintenanceUrgency` | 0 |
| `MoneyFen` | 0 |
| `MyPatentMaintenanceSchedule` | 16 |
| `MyPatentMaintenanceTask` | 24 |
| `OrganizationStats` | 2 |
| `OrganizationSummary` | 17 |
| `PageMeta` | 3 |
| `PagedAchievementSummary` | 54 |
| `PagedCommentThread` | 67 |
| `PagedInventorRanking` | 12 |
| `PagedListing` | 121 |
| `PagedListingSummary` | 73 |
| `PagedMyPatentMaintenanceOrder` | 46 |
| `PagedMyPatentMaintenanceSchedule` | 25 |
| `PagedMyPatentMaintenanceTask` | 33 |
| `PagedOrganizationSummary` | 25 |
| `PagedPatentClaimRequest` | 27 |
| `PagedTechManagerSummary` | 27 |
| `Patent` | 71 |
| `PatentClaimCreateRequest` | 6 |
| `PatentClaimRequest` | 19 |
| `PatentClaimStatus` | 0 |
| `PatentMaintenanceOrder` | 38 |
| `PatentMaintenanceOrderEvent` | 17 |
| `PatentMaintenanceOrderEventList` | 20 |
| `PatentMaintenanceOrderEventType` | 0 |
| `PatentMaintenanceOrderMyCreateRequest` | 2 |
| `PatentMaintenanceOrderStatus` | 0 |
| `PatentMaintenancePaymentChannel` | 0 |
| `PatentMaintenanceReconcileStatus` | 0 |
| `PatentMaintenanceSchedule` | 11 |
| `PatentMaintenanceStatus` | 0 |
| `PatentMaintenanceTask` | 13 |
| `PatentMaintenanceTaskStatus` | 0 |
| `PatentMedia` | 5 |
| `PatentNormalizeRequest` | 1 |
| `PatentNormalizeResponse` | 15 |
| `PatentNumberInputType` | 0 |
| `PatentOwnerClaimSource` | 0 |
| `PatentTradeSnapshot` | 22 |
| `PatentType` | 0 |
| `PledgeStatus` | 0 |
| `PriceType` | 0 |
| `PublicHomeAnnouncementFeed` | 12 |
| `PublicHomeAnnouncementItem` | 8 |
| `SearchQType` | 0 |
| `SortBy` | 0 |
| `SupplyType` | 0 |
| `TechManagerPublic` | 22 |
| `TechManagerSortBy` | 0 |
| `TechManagerStats` | 4 |
| `TechManagerSummary` | 19 |
| `TradeMode` | 0 |
| `UserBrief` | 12 |
| `UserRole` | 0 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### MP-008 `subpackages/orders/index` 订单

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/contracts` | `listContracts` | Y | Contracts（合同） | 小程序端合同查询列表 |
| POST | `/contracts/{contractId}/upload` | `uploadContractPdf` | Y | Contracts（合同） | 小程序端合同/上传提交 |
| GET | `/invoices` | `listMyInvoices` | Y | Invoices（发票） | 小程序端发票查询列表 |
| GET | `/orders` | `listMyOrders` | Y | Orders（订单） | 小程序端订单查询列表 |
| POST | `/orders` | `createOrder` | Y | Orders（订单） | 小程序端订单提交 |
| GET | `/orders/{orderId}` | `getOrderById` | Y | Orders（订单） | 小程序端订单查询详情 |
| GET | `/orders/{orderId}/case` | `getOrderCase` | Y | Cases（工单） | 小程序端订单/工单查询列表 |
| GET | `/orders/{orderId}/invoice` | `getOrderInvoice` | Y | Invoices（发票） | 小程序端订单/发票查询列表 |
| POST | `/orders/{orderId}/invoice-requests` | `requestOrderInvoice` | Y | Invoices（发票） | 小程序端订单/发票请求提交 |
| POST | `/orders/{orderId}/payment-intents` | `createPaymentIntent` | Y | Payments（支付） | 小程序端订单/支付支付意图提交 |
| GET | `/orders/{orderId}/refund-requests` | `listRefundRequestsByOrder` | Y | Refunds（退款） | 小程序端订单/退款请求查询列表 |
| POST | `/orders/{orderId}/refund-requests` | `createRefundRequest` | Y | Refunds（退款） | 小程序端订单/退款请求提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `CaseStatus` | 0 |
| `CaseType` | 0 |
| `CaseWithMilestones` | 20 |
| `ContractItem` | 13 |
| `ContractStatus` | 0 |
| `ContractUploadRequest` | 0 |
| `ErrorResponse` | 3 |
| `FileObject` | 7 |
| `InvoiceItem` | 53 |
| `InvoiceRequestResult` | 4 |
| `InvoiceStatus` | 0 |
| `Milestone` | 7 |
| `MilestoneName` | 0 |
| `MilestoneStatus` | 0 |
| `MoneyFen` | 0 |
| `Order` | 44 |
| `OrderInvoice` | 18 |
| `OrderListRole` | 0 |
| `OrderStatus` | 0 |
| `OrderStatusGroup` | 0 |
| `PageMeta` | 3 |
| `PagedContract` | 21 |
| `PagedInvoiceItem` | 62 |
| `PagedOrder` | 52 |
| `PayType` | 0 |
| `PaymentIntentResponse` | 13 |
| `RefundReasonCode` | 0 |
| `RefundRequest` | 11 |
| `RefundRequestCreate` | 6 |
| `RefundRequestStatus` | 0 |
| `Uuid` | 0 |

#### MP-009 `subpackages/orders/detail/index` 订单详情

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/contracts` | `listContracts` | Y | Contracts（合同） | 小程序端合同查询列表 |
| POST | `/contracts/{contractId}/upload` | `uploadContractPdf` | Y | Contracts（合同） | 小程序端合同/上传提交 |
| GET | `/invoices` | `listMyInvoices` | Y | Invoices（发票） | 小程序端发票查询列表 |
| GET | `/orders` | `listMyOrders` | Y | Orders（订单） | 小程序端订单查询列表 |
| POST | `/orders` | `createOrder` | Y | Orders（订单） | 小程序端订单提交 |
| GET | `/orders/{orderId}` | `getOrderById` | Y | Orders（订单） | 小程序端订单查询详情 |
| GET | `/orders/{orderId}/case` | `getOrderCase` | Y | Cases（工单） | 小程序端订单/工单查询列表 |
| GET | `/orders/{orderId}/invoice` | `getOrderInvoice` | Y | Invoices（发票） | 小程序端订单/发票查询列表 |
| POST | `/orders/{orderId}/invoice-requests` | `requestOrderInvoice` | Y | Invoices（发票） | 小程序端订单/发票请求提交 |
| POST | `/orders/{orderId}/payment-intents` | `createPaymentIntent` | Y | Payments（支付） | 小程序端订单/支付支付意图提交 |
| GET | `/orders/{orderId}/refund-requests` | `listRefundRequestsByOrder` | Y | Refunds（退款） | 小程序端订单/退款请求查询列表 |
| POST | `/orders/{orderId}/refund-requests` | `createRefundRequest` | Y | Refunds（退款） | 小程序端订单/退款请求提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `CaseStatus` | 0 |
| `CaseType` | 0 |
| `CaseWithMilestones` | 20 |
| `ContractItem` | 13 |
| `ContractStatus` | 0 |
| `ContractUploadRequest` | 0 |
| `ErrorResponse` | 3 |
| `FileObject` | 7 |
| `InvoiceItem` | 53 |
| `InvoiceRequestResult` | 4 |
| `InvoiceStatus` | 0 |
| `Milestone` | 7 |
| `MilestoneName` | 0 |
| `MilestoneStatus` | 0 |
| `MoneyFen` | 0 |
| `Order` | 44 |
| `OrderInvoice` | 18 |
| `OrderListRole` | 0 |
| `OrderStatus` | 0 |
| `OrderStatusGroup` | 0 |
| `PageMeta` | 3 |
| `PagedContract` | 21 |
| `PagedInvoiceItem` | 62 |
| `PagedOrder` | 52 |
| `PayType` | 0 |
| `PaymentIntentResponse` | 13 |
| `RefundReasonCode` | 0 |
| `RefundRequest` | 11 |
| `RefundRequestCreate` | 6 |
| `RefundRequestStatus` | 0 |
| `Uuid` | 0 |

#### MP-010 `subpackages/checkout/deposit-pay/index` 订金支付

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/contracts` | `listContracts` | Y | Contracts（合同） | 小程序端合同查询列表 |
| POST | `/contracts/{contractId}/upload` | `uploadContractPdf` | Y | Contracts（合同） | 小程序端合同/上传提交 |
| GET | `/invoices` | `listMyInvoices` | Y | Invoices（发票） | 小程序端发票查询列表 |
| GET | `/orders` | `listMyOrders` | Y | Orders（订单） | 小程序端订单查询列表 |
| POST | `/orders` | `createOrder` | Y | Orders（订单） | 小程序端订单提交 |
| GET | `/orders/{orderId}` | `getOrderById` | Y | Orders（订单） | 小程序端订单查询详情 |
| GET | `/orders/{orderId}/case` | `getOrderCase` | Y | Cases（工单） | 小程序端订单/工单查询列表 |
| GET | `/orders/{orderId}/invoice` | `getOrderInvoice` | Y | Invoices（发票） | 小程序端订单/发票查询列表 |
| POST | `/orders/{orderId}/invoice-requests` | `requestOrderInvoice` | Y | Invoices（发票） | 小程序端订单/发票请求提交 |
| POST | `/orders/{orderId}/payment-intents` | `createPaymentIntent` | Y | Payments（支付） | 小程序端订单/支付支付意图提交 |
| GET | `/orders/{orderId}/refund-requests` | `listRefundRequestsByOrder` | Y | Refunds（退款） | 小程序端订单/退款请求查询列表 |
| POST | `/orders/{orderId}/refund-requests` | `createRefundRequest` | Y | Refunds（退款） | 小程序端订单/退款请求提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `CaseStatus` | 0 |
| `CaseType` | 0 |
| `CaseWithMilestones` | 20 |
| `ContractItem` | 13 |
| `ContractStatus` | 0 |
| `ContractUploadRequest` | 0 |
| `ErrorResponse` | 3 |
| `FileObject` | 7 |
| `InvoiceItem` | 53 |
| `InvoiceRequestResult` | 4 |
| `InvoiceStatus` | 0 |
| `Milestone` | 7 |
| `MilestoneName` | 0 |
| `MilestoneStatus` | 0 |
| `MoneyFen` | 0 |
| `Order` | 44 |
| `OrderInvoice` | 18 |
| `OrderListRole` | 0 |
| `OrderStatus` | 0 |
| `OrderStatusGroup` | 0 |
| `PageMeta` | 3 |
| `PagedContract` | 21 |
| `PagedInvoiceItem` | 62 |
| `PagedOrder` | 52 |
| `PayType` | 0 |
| `PaymentIntentResponse` | 13 |
| `RefundReasonCode` | 0 |
| `RefundRequest` | 11 |
| `RefundRequestCreate` | 6 |
| `RefundRequestStatus` | 0 |
| `Uuid` | 0 |

#### MP-011 `subpackages/checkout/deposit-success/index` 订金支付成功

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/contracts` | `listContracts` | Y | Contracts（合同） | 小程序端合同查询列表 |
| POST | `/contracts/{contractId}/upload` | `uploadContractPdf` | Y | Contracts（合同） | 小程序端合同/上传提交 |
| GET | `/invoices` | `listMyInvoices` | Y | Invoices（发票） | 小程序端发票查询列表 |
| GET | `/orders` | `listMyOrders` | Y | Orders（订单） | 小程序端订单查询列表 |
| POST | `/orders` | `createOrder` | Y | Orders（订单） | 小程序端订单提交 |
| GET | `/orders/{orderId}` | `getOrderById` | Y | Orders（订单） | 小程序端订单查询详情 |
| GET | `/orders/{orderId}/case` | `getOrderCase` | Y | Cases（工单） | 小程序端订单/工单查询列表 |
| GET | `/orders/{orderId}/invoice` | `getOrderInvoice` | Y | Invoices（发票） | 小程序端订单/发票查询列表 |
| POST | `/orders/{orderId}/invoice-requests` | `requestOrderInvoice` | Y | Invoices（发票） | 小程序端订单/发票请求提交 |
| POST | `/orders/{orderId}/payment-intents` | `createPaymentIntent` | Y | Payments（支付） | 小程序端订单/支付支付意图提交 |
| GET | `/orders/{orderId}/refund-requests` | `listRefundRequestsByOrder` | Y | Refunds（退款） | 小程序端订单/退款请求查询列表 |
| POST | `/orders/{orderId}/refund-requests` | `createRefundRequest` | Y | Refunds（退款） | 小程序端订单/退款请求提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `CaseStatus` | 0 |
| `CaseType` | 0 |
| `CaseWithMilestones` | 20 |
| `ContractItem` | 13 |
| `ContractStatus` | 0 |
| `ContractUploadRequest` | 0 |
| `ErrorResponse` | 3 |
| `FileObject` | 7 |
| `InvoiceItem` | 53 |
| `InvoiceRequestResult` | 4 |
| `InvoiceStatus` | 0 |
| `Milestone` | 7 |
| `MilestoneName` | 0 |
| `MilestoneStatus` | 0 |
| `MoneyFen` | 0 |
| `Order` | 44 |
| `OrderInvoice` | 18 |
| `OrderListRole` | 0 |
| `OrderStatus` | 0 |
| `OrderStatusGroup` | 0 |
| `PageMeta` | 3 |
| `PagedContract` | 21 |
| `PagedInvoiceItem` | 62 |
| `PagedOrder` | 52 |
| `PayType` | 0 |
| `PaymentIntentResponse` | 13 |
| `RefundReasonCode` | 0 |
| `RefundRequest` | 11 |
| `RefundRequestCreate` | 6 |
| `RefundRequestStatus` | 0 |
| `Uuid` | 0 |

#### MP-012 `subpackages/checkout/final-pay/index` 尾款支付

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/contracts` | `listContracts` | Y | Contracts（合同） | 小程序端合同查询列表 |
| POST | `/contracts/{contractId}/upload` | `uploadContractPdf` | Y | Contracts（合同） | 小程序端合同/上传提交 |
| GET | `/invoices` | `listMyInvoices` | Y | Invoices（发票） | 小程序端发票查询列表 |
| GET | `/orders` | `listMyOrders` | Y | Orders（订单） | 小程序端订单查询列表 |
| POST | `/orders` | `createOrder` | Y | Orders（订单） | 小程序端订单提交 |
| GET | `/orders/{orderId}` | `getOrderById` | Y | Orders（订单） | 小程序端订单查询详情 |
| GET | `/orders/{orderId}/case` | `getOrderCase` | Y | Cases（工单） | 小程序端订单/工单查询列表 |
| GET | `/orders/{orderId}/invoice` | `getOrderInvoice` | Y | Invoices（发票） | 小程序端订单/发票查询列表 |
| POST | `/orders/{orderId}/invoice-requests` | `requestOrderInvoice` | Y | Invoices（发票） | 小程序端订单/发票请求提交 |
| POST | `/orders/{orderId}/payment-intents` | `createPaymentIntent` | Y | Payments（支付） | 小程序端订单/支付支付意图提交 |
| GET | `/orders/{orderId}/refund-requests` | `listRefundRequestsByOrder` | Y | Refunds（退款） | 小程序端订单/退款请求查询列表 |
| POST | `/orders/{orderId}/refund-requests` | `createRefundRequest` | Y | Refunds（退款） | 小程序端订单/退款请求提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `CaseStatus` | 0 |
| `CaseType` | 0 |
| `CaseWithMilestones` | 20 |
| `ContractItem` | 13 |
| `ContractStatus` | 0 |
| `ContractUploadRequest` | 0 |
| `ErrorResponse` | 3 |
| `FileObject` | 7 |
| `InvoiceItem` | 53 |
| `InvoiceRequestResult` | 4 |
| `InvoiceStatus` | 0 |
| `Milestone` | 7 |
| `MilestoneName` | 0 |
| `MilestoneStatus` | 0 |
| `MoneyFen` | 0 |
| `Order` | 44 |
| `OrderInvoice` | 18 |
| `OrderListRole` | 0 |
| `OrderStatus` | 0 |
| `OrderStatusGroup` | 0 |
| `PageMeta` | 3 |
| `PagedContract` | 21 |
| `PagedInvoiceItem` | 62 |
| `PagedOrder` | 52 |
| `PayType` | 0 |
| `PaymentIntentResponse` | 13 |
| `RefundReasonCode` | 0 |
| `RefundRequest` | 11 |
| `RefundRequestCreate` | 6 |
| `RefundRequestStatus` | 0 |
| `Uuid` | 0 |

#### MP-013 `subpackages/checkout/final-success/index` 尾款支付成功

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/contracts` | `listContracts` | Y | Contracts（合同） | 小程序端合同查询列表 |
| POST | `/contracts/{contractId}/upload` | `uploadContractPdf` | Y | Contracts（合同） | 小程序端合同/上传提交 |
| GET | `/invoices` | `listMyInvoices` | Y | Invoices（发票） | 小程序端发票查询列表 |
| GET | `/orders` | `listMyOrders` | Y | Orders（订单） | 小程序端订单查询列表 |
| POST | `/orders` | `createOrder` | Y | Orders（订单） | 小程序端订单提交 |
| GET | `/orders/{orderId}` | `getOrderById` | Y | Orders（订单） | 小程序端订单查询详情 |
| GET | `/orders/{orderId}/case` | `getOrderCase` | Y | Cases（工单） | 小程序端订单/工单查询列表 |
| GET | `/orders/{orderId}/invoice` | `getOrderInvoice` | Y | Invoices（发票） | 小程序端订单/发票查询列表 |
| POST | `/orders/{orderId}/invoice-requests` | `requestOrderInvoice` | Y | Invoices（发票） | 小程序端订单/发票请求提交 |
| POST | `/orders/{orderId}/payment-intents` | `createPaymentIntent` | Y | Payments（支付） | 小程序端订单/支付支付意图提交 |
| GET | `/orders/{orderId}/refund-requests` | `listRefundRequestsByOrder` | Y | Refunds（退款） | 小程序端订单/退款请求查询列表 |
| POST | `/orders/{orderId}/refund-requests` | `createRefundRequest` | Y | Refunds（退款） | 小程序端订单/退款请求提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `CaseStatus` | 0 |
| `CaseType` | 0 |
| `CaseWithMilestones` | 20 |
| `ContractItem` | 13 |
| `ContractStatus` | 0 |
| `ContractUploadRequest` | 0 |
| `ErrorResponse` | 3 |
| `FileObject` | 7 |
| `InvoiceItem` | 53 |
| `InvoiceRequestResult` | 4 |
| `InvoiceStatus` | 0 |
| `Milestone` | 7 |
| `MilestoneName` | 0 |
| `MilestoneStatus` | 0 |
| `MoneyFen` | 0 |
| `Order` | 44 |
| `OrderInvoice` | 18 |
| `OrderListRole` | 0 |
| `OrderStatus` | 0 |
| `OrderStatusGroup` | 0 |
| `PageMeta` | 3 |
| `PagedContract` | 21 |
| `PagedInvoiceItem` | 62 |
| `PagedOrder` | 52 |
| `PayType` | 0 |
| `PaymentIntentResponse` | 13 |
| `RefundReasonCode` | 0 |
| `RefundRequest` | 11 |
| `RefundRequestCreate` | 6 |
| `RefundRequestStatus` | 0 |
| `Uuid` | 0 |

#### MP-014 `subpackages/publish/patent/index` 发布专利

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/listings` | `listMyListings` | Y | Listings（挂牌） | 小程序端挂牌查询列表 |
| POST | `/listings` | `createListing` | Y | Listings（挂牌） | 小程序端挂牌提交 |
| GET | `/listings/{listingId}` | `getListingById` | Y | Listings（挂牌） | 小程序端挂牌查询详情 |
| PATCH | `/listings/{listingId}` | `updateListing` | Y | Listings（挂牌） | 小程序端挂牌更新 |
| POST | `/listings/{listingId}/comments` | `createListingComment` | Y | Comments（评论） | 小程序端挂牌/评论提交 |
| POST | `/listings/{listingId}/consultations` | `createListingConsultation` | Y | Listings（挂牌） | 小程序端挂牌/咨询提交 |
| POST | `/listings/{listingId}/conversations` | `upsertListingConversation` | Y | Messaging（消息会话） | 小程序端挂牌/会话提交 |
| POST | `/listings/{listingId}/favorites` | `favoriteListing` | Y | Listings（挂牌） | 小程序端挂牌/收藏提交 |
| DELETE | `/listings/{listingId}/favorites` | `unfavoriteListing` | Y | Listings（挂牌） | 小程序端挂牌/收藏删除 |
| POST | `/listings/{listingId}/off-shelf` | `offShelfListing` | Y | Listings（挂牌） | 小程序端挂牌/下架提交 |
| POST | `/listings/{listingId}/submit` | `submitListing` | Y | Listings（挂牌） | 小程序端挂牌提交 |
| GET | `/me/favorites` | `listMyFavoriteListings` | Y | Listings（挂牌） | 小程序端收藏查询列表 |
| GET | `/me/patent-claims` | `listMyPatentClaims` | Y | Patents（专利） | 小程序端专利认领查询列表 |
| POST | `/me/patent-claims` | `createMyPatentClaim` | Y | Patents（专利） | 小程序端专利认领提交 |
| GET | `/me/patent-maintenance/orders` | `listMyPatentMaintenanceOrders` | Y | Maintenance（专利维保） | 小程序端专利维保/订单查询列表 |
| POST | `/me/patent-maintenance/orders` | `createMyPatentMaintenanceOrder` | Y | Maintenance（专利维保） | 小程序端专利维保/订单提交 |
| GET | `/me/patent-maintenance/orders/{orderId}` | `getMyPatentMaintenanceOrder` | Y | Maintenance（专利维保） | 小程序端专利维保/订单查询详情 |
| GET | `/me/patent-maintenance/orders/{orderId}/events` | `listMyPatentMaintenanceOrderEvents` | Y | Maintenance（专利维保） | 小程序端专利维保/订单/事件查询列表 |
| GET | `/me/patent-maintenance/schedules` | `listMyPatentMaintenanceSchedules` | Y | Maintenance（专利维保） | 小程序端专利维保/日程查询列表 |
| GET | `/me/patent-maintenance/tasks` | `listMyPatentMaintenanceTasks` | Y | Maintenance（专利维保） | 小程序端专利维保/任务查询列表 |
| GET | `/me/recommendations/listings` | `getMyRecommendedListings` | Y | Search（检索） | 小程序端推荐/挂牌查询列表 |
| POST | `/patent-maintenance/orders/{orderId}/conversations` | `upsertMaintenanceOrderConversation` | Y | Messaging（消息会话）, Maintenance（专利维保） | 小程序端专利维保/订单/会话提交 |
| POST | `/patents/normalize` | `normalizePatentNumber` | N | Patents（专利） | 小程序端专利/规范化提交 |
| GET | `/patents/{patentId}` | `getPatentById` | Y | Patents（专利） | 小程序端专利查询详情 |
| GET | `/public/config/home-announcements` | `getPublicHomeAnnouncementsFeed` | N | Config（配置） | 小程序端配置/首页公告查询列表 |
| GET | `/public/listings/{listingId}` | `getPublicListingById` | N | Listings（挂牌） | 小程序端挂牌查询详情 |
| GET | `/public/listings/{listingId}/comments` | `listPublicListingComments` | N | Comments（评论） | 小程序端挂牌/评论查询列表 |
| GET | `/public/organizations` | `listPublicOrganizations` | N | Organizations（机构） | 小程序端机构查询列表 |
| GET | `/public/organizations/{orgUserId}` | `getPublicOrganizationById` | N | Organizations（机构） | 小程序端机构查询详情 |
| GET | `/public/tech-managers/{techManagerId}` | `getPublicTechManagerById` | N | TechManagers（技术经理） | 小程序端技术经理查询详情 |
| GET | `/search/achievements` | `searchAchievements` | N | Search（检索）, Achievements（成果） | 小程序端成果查询列表 |
| GET | `/search/inventors` | `searchInventorRankings` | N | Search（检索） | 小程序端发明人查询列表 |
| GET | `/search/listings` | `searchListings` | N | Search（检索） | 小程序端挂牌查询列表 |
| GET | `/search/tech-managers` | `searchTechManagers` | N | Search（检索）, TechManagers（技术经理） | 小程序端技术经理查询列表 |
| POST | `/tech-managers/{techManagerId}/conversations` | `upsertTechManagerConversation` | Y | Messaging（消息会话）, TechManagers（技术经理） | 小程序端技术经理/会话提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `AchievementMaturity` | 0 |
| `AchievementSortBy` | 0 |
| `AchievementSummary` | 46 |
| `AiContentType` | 0 |
| `AiParseResult` | 16 |
| `AiParseStatus` | 0 |
| `AuditStatus` | 0 |
| `Comment` | 27 |
| `CommentContentType` | 0 |
| `CommentCreateRequest` | 3 |
| `CommentStatus` | 0 |
| `CommentThread` | 59 |
| `ConsultationRouting` | 0 |
| `ContentSource` | 0 |
| `ContentStatus` | 0 |
| `Conversation` | 19 |
| `ConversationContentType` | 0 |
| `ErrorResponse` | 3 |
| `ExistingLicenseStatus` | 0 |
| `FeaturedLevel` | 0 |
| `InventorRankingItem` | 4 |
| `Jurisdiction` | 0 |
| `LegalStatus` | 0 |
| `LicenseMode` | 0 |
| `Listing` | 112 |
| `ListingConsultationCreated` | 3 |
| `ListingCreateRequest` | 62 |
| `ListingMedia` | 4 |
| `ListingPublic` | 121 |
| `ListingStats` | 4 |
| `ListingStatus` | 0 |
| `ListingSummary` | 65 |
| `ListingTopic` | 0 |
| `ListingUpdateRequest` | 60 |
| `MaintenanceUrgency` | 0 |
| `MoneyFen` | 0 |
| `MyPatentMaintenanceSchedule` | 16 |
| `MyPatentMaintenanceTask` | 24 |
| `OrganizationStats` | 2 |
| `OrganizationSummary` | 17 |
| `PageMeta` | 3 |
| `PagedAchievementSummary` | 54 |
| `PagedCommentThread` | 67 |
| `PagedInventorRanking` | 12 |
| `PagedListing` | 121 |
| `PagedListingSummary` | 73 |
| `PagedMyPatentMaintenanceOrder` | 46 |
| `PagedMyPatentMaintenanceSchedule` | 25 |
| `PagedMyPatentMaintenanceTask` | 33 |
| `PagedOrganizationSummary` | 25 |
| `PagedPatentClaimRequest` | 27 |
| `PagedTechManagerSummary` | 27 |
| `Patent` | 71 |
| `PatentClaimCreateRequest` | 6 |
| `PatentClaimRequest` | 19 |
| `PatentClaimStatus` | 0 |
| `PatentMaintenanceOrder` | 38 |
| `PatentMaintenanceOrderEvent` | 17 |
| `PatentMaintenanceOrderEventList` | 20 |
| `PatentMaintenanceOrderEventType` | 0 |
| `PatentMaintenanceOrderMyCreateRequest` | 2 |
| `PatentMaintenanceOrderStatus` | 0 |
| `PatentMaintenancePaymentChannel` | 0 |
| `PatentMaintenanceReconcileStatus` | 0 |
| `PatentMaintenanceSchedule` | 11 |
| `PatentMaintenanceStatus` | 0 |
| `PatentMaintenanceTask` | 13 |
| `PatentMaintenanceTaskStatus` | 0 |
| `PatentMedia` | 5 |
| `PatentNormalizeRequest` | 1 |
| `PatentNormalizeResponse` | 15 |
| `PatentNumberInputType` | 0 |
| `PatentOwnerClaimSource` | 0 |
| `PatentTradeSnapshot` | 22 |
| `PatentType` | 0 |
| `PledgeStatus` | 0 |
| `PriceType` | 0 |
| `PublicHomeAnnouncementFeed` | 12 |
| `PublicHomeAnnouncementItem` | 8 |
| `SearchQType` | 0 |
| `SortBy` | 0 |
| `SupplyType` | 0 |
| `TechManagerPublic` | 22 |
| `TechManagerSortBy` | 0 |
| `TechManagerStats` | 4 |
| `TechManagerSummary` | 19 |
| `TradeMode` | 0 |
| `UserBrief` | 12 |
| `UserRole` | 0 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### MP-015 `subpackages/publish/achievement/index` 发布成果

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/achievements` | `listMyAchievements` | Y | Achievements（成果） | 小程序端成果查询列表 |
| POST | `/achievements` | `createAchievement` | Y | Achievements（成果） | 小程序端成果提交 |
| GET | `/achievements/{achievementId}` | `getMyAchievementById` | Y | Achievements（成果） | 小程序端成果查询详情 |
| PATCH | `/achievements/{achievementId}` | `updateMyAchievement` | Y | Achievements（成果） | 小程序端成果更新 |
| POST | `/achievements/{achievementId}/comments` | `createAchievementComment` | Y | Comments（评论）, Achievements（成果） | 小程序端成果/评论提交 |
| POST | `/achievements/{achievementId}/consultations` | `createAchievementConsultation` | Y | Achievements（成果） | 小程序端成果/咨询提交 |
| POST | `/achievements/{achievementId}/conversations` | `upsertAchievementConversation` | Y | Messaging（消息会话）, Achievements（成果） | 小程序端成果/会话提交 |
| POST | `/achievements/{achievementId}/favorites` | `favoriteAchievement` | Y | Achievements（成果） | 小程序端成果/收藏提交 |
| DELETE | `/achievements/{achievementId}/favorites` | `unfavoriteAchievement` | Y | Achievements（成果） | 小程序端成果/收藏删除 |
| POST | `/achievements/{achievementId}/off-shelf` | `offShelfAchievement` | Y | Achievements（成果） | 小程序端成果/下架提交 |
| POST | `/achievements/{achievementId}/submit` | `submitAchievement` | Y | Achievements（成果） | 小程序端成果提交 |
| GET | `/listings` | `listMyListings` | Y | Listings（挂牌） | 小程序端挂牌查询列表 |
| POST | `/listings` | `createListing` | Y | Listings（挂牌） | 小程序端挂牌提交 |
| GET | `/listings/{listingId}` | `getListingById` | Y | Listings（挂牌） | 小程序端挂牌查询详情 |
| PATCH | `/listings/{listingId}` | `updateListing` | Y | Listings（挂牌） | 小程序端挂牌更新 |
| POST | `/listings/{listingId}/comments` | `createListingComment` | Y | Comments（评论） | 小程序端挂牌/评论提交 |
| POST | `/listings/{listingId}/consultations` | `createListingConsultation` | Y | Listings（挂牌） | 小程序端挂牌/咨询提交 |
| POST | `/listings/{listingId}/conversations` | `upsertListingConversation` | Y | Messaging（消息会话） | 小程序端挂牌/会话提交 |
| POST | `/listings/{listingId}/favorites` | `favoriteListing` | Y | Listings（挂牌） | 小程序端挂牌/收藏提交 |
| DELETE | `/listings/{listingId}/favorites` | `unfavoriteListing` | Y | Listings（挂牌） | 小程序端挂牌/收藏删除 |
| POST | `/listings/{listingId}/off-shelf` | `offShelfListing` | Y | Listings（挂牌） | 小程序端挂牌/下架提交 |
| POST | `/listings/{listingId}/submit` | `submitListing` | Y | Listings（挂牌） | 小程序端挂牌提交 |
| GET | `/me/favorites` | `listMyFavoriteListings` | Y | Listings（挂牌） | 小程序端收藏查询列表 |
| GET | `/me/favorites/achievements` | `listMyFavoriteAchievements` | Y | Achievements（成果） | 小程序端收藏/成果查询列表 |
| GET | `/me/recommendations/listings` | `getMyRecommendedListings` | Y | Search（检索） | 小程序端推荐/挂牌查询列表 |
| GET | `/public/achievements/{achievementId}` | `getPublicAchievementById` | N | Achievements（成果） | 小程序端成果查询详情 |
| GET | `/public/achievements/{achievementId}/comments` | `listPublicAchievementComments` | N | Comments（评论）, Achievements（成果） | 小程序端成果/评论查询列表 |
| GET | `/public/listings/{listingId}` | `getPublicListingById` | N | Listings（挂牌） | 小程序端挂牌查询详情 |
| GET | `/public/listings/{listingId}/comments` | `listPublicListingComments` | N | Comments（评论） | 小程序端挂牌/评论查询列表 |
| GET | `/search/achievements` | `searchAchievements` | N | Search（检索）, Achievements（成果） | 小程序端成果查询列表 |
| GET | `/search/listings` | `searchListings` | N | Search（检索） | 小程序端挂牌查询列表 |

| Schema | 字段数（全量展开） |
|---|---|
| `AchievementCreateRequest` | 22 |
| `AchievementDetail` | 60 |
| `AchievementEdit` | 61 |
| `AchievementMaturity` | 0 |
| `AchievementRecord` | 26 |
| `AchievementSortBy` | 0 |
| `AchievementSummary` | 46 |
| `AchievementUpdateRequest` | 22 |
| `AiContentType` | 0 |
| `AiParseResult` | 16 |
| `AiParseStatus` | 0 |
| `AuditStatus` | 0 |
| `Comment` | 27 |
| `CommentContentType` | 0 |
| `CommentCreateRequest` | 3 |
| `CommentStatus` | 0 |
| `CommentThread` | 59 |
| `ConsultationRouting` | 0 |
| `ContentMedia` | 9 |
| `ContentMediaInput` | 5 |
| `ContentMediaType` | 0 |
| `ContentSource` | 0 |
| `ContentStatus` | 0 |
| `Conversation` | 19 |
| `ConversationContentType` | 0 |
| `ErrorResponse` | 3 |
| `ExistingLicenseStatus` | 0 |
| `FeaturedLevel` | 0 |
| `LegalStatus` | 0 |
| `LicenseMode` | 0 |
| `Listing` | 112 |
| `ListingConsultationCreated` | 3 |
| `ListingCreateRequest` | 62 |
| `ListingMedia` | 4 |
| `ListingPublic` | 121 |
| `ListingStats` | 4 |
| `ListingStatus` | 0 |
| `ListingSummary` | 65 |
| `ListingTopic` | 0 |
| `ListingUpdateRequest` | 60 |
| `MoneyFen` | 0 |
| `OkResponse` | 1 |
| `OrganizationStats` | 2 |
| `OrganizationSummary` | 17 |
| `PageMeta` | 3 |
| `PagedAchievementSummary` | 54 |
| `PagedCommentThread` | 67 |
| `PagedListing` | 121 |
| `PagedListingSummary` | 73 |
| `PatentType` | 0 |
| `PledgeStatus` | 0 |
| `PriceType` | 0 |
| `SearchQType` | 0 |
| `SortBy` | 0 |
| `SupplyType` | 0 |
| `TradeMode` | 0 |
| `UserBrief` | 12 |
| `UserRole` | 0 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### MP-016 `subpackages/messages/chat/index` 消息会话

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| POST | `/achievements/{achievementId}/conversations` | `upsertAchievementConversation` | Y | Messaging（消息会话）, Achievements（成果） | 小程序端成果/会话提交 |
| GET | `/conversations/{conversationId}/messages` | `listConversationMessages` | Y | Messaging（消息会话） | 小程序端会话/消息查询列表 |
| POST | `/conversations/{conversationId}/messages` | `sendConversationMessage` | Y | Messaging（消息会话） | 小程序端会话/消息提交 |
| POST | `/conversations/{conversationId}/read` | `markConversationRead` | Y | Messaging（消息会话） | 小程序端会话/已读提交 |
| GET | `/notifications` | `listMyNotifications` | Y | Notifications（通知） | 小程序端通知查询列表 |
| GET | `/notifications/{notificationId}` | `getNotificationById` | Y | Notifications（通知） | 小程序端通知查询详情 |
| POST | `/orders/{orderId}/dispute-conversations` | `upsertOrderDisputeConversation` | Y | Messaging（消息会话）, Orders（订单） | 小程序端订单/纠纷会话提交 |
| POST | `/support/conversations` | `upsertSupportConversation` | Y | Messaging（消息会话） | 小程序端客服/会话提交 |
| POST | `/webhooks/wechatpay/notify` | `wechatPayNotify` | N | Payments（支付） | 小程序端微信支付/通知回调提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `Conversation` | 19 |
| `ConversationContentType` | 0 |
| `ConversationMessage` | 13 |
| `ConversationMessageSendRequest` | 3 |
| `ConversationMessageType` | 0 |
| `ErrorResponse` | 3 |
| `Notification` | 8 |
| `NotificationKind` | 0 |
| `PageMeta` | 3 |
| `PagedConversationMessage` | 17 |
| `PagedNotification` | 16 |
| `Uuid` | 0 |

#### MP-017 `subpackages/support/index` 客服

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/public/config/trade-rules` | `getPublicTradeRulesConfig` | N | Config（配置） | 小程序端配置/交易规则查询列表 |

| Schema | 字段数（全量展开） |
|---|---|
| `ErrorResponse` | 3 |
| `MoneyFen` | 0 |
| `PayoutCondition` | 0 |
| `PayoutMethod` | 0 |
| `TradeRulesConfig` | 22 |

#### MP-018 `subpackages/support/faq/index` 客服常见问题

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/public/config/trade-rules` | `getPublicTradeRulesConfig` | N | Config（配置） | 小程序端配置/交易规则查询列表 |

| Schema | 字段数（全量展开） |
|---|---|
| `ErrorResponse` | 3 |
| `MoneyFen` | 0 |
| `PayoutCondition` | 0 |
| `PayoutMethod` | 0 |
| `TradeRulesConfig` | 22 |

#### MP-019 `subpackages/support/faq/detail/index` 客服常见问题详情

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/public/config/trade-rules` | `getPublicTradeRulesConfig` | N | Config（配置） | 小程序端配置/交易规则查询列表 |

| Schema | 字段数（全量展开） |
|---|---|
| `ErrorResponse` | 3 |
| `MoneyFen` | 0 |
| `PayoutCondition` | 0 |
| `PayoutMethod` | 0 |
| `TradeRulesConfig` | 22 |

#### MP-020 `subpackages/support/contact/index` 联系客服

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/public/config/trade-rules` | `getPublicTradeRulesConfig` | N | Config（配置） | 小程序端配置/交易规则查询列表 |

| Schema | 字段数（全量展开） |
|---|---|
| `ErrorResponse` | 3 |
| `MoneyFen` | 0 |
| `PayoutCondition` | 0 |
| `PayoutMethod` | 0 |
| `TradeRulesConfig` | 22 |

#### MP-021 `subpackages/legal/privacy/index` 法律隐私

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/public/config/trade-rules` | `getPublicTradeRulesConfig` | N | Config（配置） | 小程序端配置/交易规则查询列表 |

| Schema | 字段数（全量展开） |
|---|---|
| `ErrorResponse` | 3 |
| `MoneyFen` | 0 |
| `PayoutCondition` | 0 |
| `PayoutMethod` | 0 |
| `TradeRulesConfig` | 22 |

#### MP-022 `subpackages/legal/terms/index` 法律条款

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/public/config/trade-rules` | `getPublicTradeRulesConfig` | N | Config（配置） | 小程序端配置/交易规则查询列表 |

| Schema | 字段数（全量展开） |
|---|---|
| `ErrorResponse` | 3 |
| `MoneyFen` | 0 |
| `PayoutCondition` | 0 |
| `PayoutMethod` | 0 |
| `TradeRulesConfig` | 22 |

#### MP-023 `subpackages/legal/privacy-guide/index` 法律隐私指引

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/public/config/trade-rules` | `getPublicTradeRulesConfig` | N | Config（配置） | 小程序端配置/交易规则查询列表 |

| Schema | 字段数（全量展开） |
|---|---|
| `ErrorResponse` | 3 |
| `MoneyFen` | 0 |
| `PayoutCondition` | 0 |
| `PayoutMethod` | 0 |
| `TradeRulesConfig` | 22 |

#### MP-024 `subpackages/onboarding/choose-identity/index` 引导选择身份

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/auth/session` | `authGetSession` | Y | Auth（认证） | 小程序端会话查询列表 |
| POST | `/auth/sms/send` | `authSmsSend` | N | Auth（认证） | 小程序端短信/发送提交 |
| POST | `/auth/sms/verify` | `authSmsVerify` | N | Auth（认证） | 小程序端短信/验证提交 |
| POST | `/auth/wechat/mp-login` | `authWechatMpLogin` | N | Auth（认证） | 小程序端微信/小程序登录提交 |
| POST | `/auth/wechat/phone-bind` | `authWechatPhoneBind` | Y | Auth（认证） | 小程序端微信/手机号绑定提交 |
| GET | `/me/addresses` | `listMyAddresses` | Y | Users（用户） | 小程序端地址查询列表 |
| POST | `/me/addresses` | `createMyAddress` | Y | Users（用户） | 小程序端地址提交 |
| PATCH | `/me/addresses/{addressId}` | `updateMyAddress` | Y | Users（用户） | 小程序端地址更新 |
| DELETE | `/me/addresses/{addressId}` | `deleteMyAddress` | Y | Users（用户） | 小程序端地址删除 |
| GET | `/me/conversations` | `listMyConversations` | Y | Messaging（消息会话） | 小程序端会话查询列表 |
| GET | `/me/favorites/achievements` | `listMyFavoriteAchievements` | Y | Achievements（成果） | 小程序端收藏/成果查询列表 |
| GET | `/me/verification` | `getMyVerification` | Y | Users（用户） | 小程序端认证查询列表 |
| POST | `/me/verification` | `submitMyVerification` | Y | Users（用户） | 小程序端认证提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `AchievementMaturity` | 0 |
| `AchievementSummary` | 46 |
| `Address` | 12 |
| `AddressCreateRequest` | 6 |
| `AddressUpdateRequest` | 6 |
| `AuditStatus` | 0 |
| `AuthSession` | 13 |
| `AuthTokenResponse` | 22 |
| `ContentSource` | 0 |
| `ContentStatus` | 0 |
| `ConversationContentType` | 0 |
| `ConversationSummary` | 33 |
| `ErrorResponse` | 3 |
| `ListingStats` | 4 |
| `ListingTopic` | 0 |
| `OkResponse` | 1 |
| `OrganizationStats` | 2 |
| `OrganizationSummary` | 17 |
| `PageMeta` | 3 |
| `PagedAchievementSummary` | 54 |
| `PagedConversationSummary` | 41 |
| `PhoneNumber` | 0 |
| `SmsPurpose` | 0 |
| `SupplyType` | 0 |
| `UserBrief` | 12 |
| `UserProfile` | 17 |
| `UserRole` | 0 |
| `UserVerification` | 26 |
| `UserVerificationSubmitOrganizationRequest` | 13 |
| `UserVerificationSubmitPersonRequest` | 3 |
| `UserVerificationSubmitRequest` | 34 |
| `UserVerificationSubmitTechManagerRequest` | 12 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### MP-025 `subpackages/onboarding/verification-form/index` 引导认证表单

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/auth/session` | `authGetSession` | Y | Auth（认证） | 小程序端会话查询列表 |
| POST | `/auth/sms/send` | `authSmsSend` | N | Auth（认证） | 小程序端短信/发送提交 |
| POST | `/auth/sms/verify` | `authSmsVerify` | N | Auth（认证） | 小程序端短信/验证提交 |
| POST | `/auth/wechat/mp-login` | `authWechatMpLogin` | N | Auth（认证） | 小程序端微信/小程序登录提交 |
| POST | `/auth/wechat/phone-bind` | `authWechatPhoneBind` | Y | Auth（认证） | 小程序端微信/手机号绑定提交 |
| GET | `/me/addresses` | `listMyAddresses` | Y | Users（用户） | 小程序端地址查询列表 |
| POST | `/me/addresses` | `createMyAddress` | Y | Users（用户） | 小程序端地址提交 |
| PATCH | `/me/addresses/{addressId}` | `updateMyAddress` | Y | Users（用户） | 小程序端地址更新 |
| DELETE | `/me/addresses/{addressId}` | `deleteMyAddress` | Y | Users（用户） | 小程序端地址删除 |
| GET | `/me/conversations` | `listMyConversations` | Y | Messaging（消息会话） | 小程序端会话查询列表 |
| GET | `/me/favorites/achievements` | `listMyFavoriteAchievements` | Y | Achievements（成果） | 小程序端收藏/成果查询列表 |
| GET | `/me/verification` | `getMyVerification` | Y | Users（用户） | 小程序端认证查询列表 |
| POST | `/me/verification` | `submitMyVerification` | Y | Users（用户） | 小程序端认证提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `AchievementMaturity` | 0 |
| `AchievementSummary` | 46 |
| `Address` | 12 |
| `AddressCreateRequest` | 6 |
| `AddressUpdateRequest` | 6 |
| `AuditStatus` | 0 |
| `AuthSession` | 13 |
| `AuthTokenResponse` | 22 |
| `ContentSource` | 0 |
| `ContentStatus` | 0 |
| `ConversationContentType` | 0 |
| `ConversationSummary` | 33 |
| `ErrorResponse` | 3 |
| `ListingStats` | 4 |
| `ListingTopic` | 0 |
| `OkResponse` | 1 |
| `OrganizationStats` | 2 |
| `OrganizationSummary` | 17 |
| `PageMeta` | 3 |
| `PagedAchievementSummary` | 54 |
| `PagedConversationSummary` | 41 |
| `PhoneNumber` | 0 |
| `SmsPurpose` | 0 |
| `SupplyType` | 0 |
| `UserBrief` | 12 |
| `UserProfile` | 17 |
| `UserRole` | 0 |
| `UserVerification` | 26 |
| `UserVerificationSubmitOrganizationRequest` | 13 |
| `UserVerificationSubmitPersonRequest` | 3 |
| `UserVerificationSubmitRequest` | 34 |
| `UserVerificationSubmitTechManagerRequest` | 12 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### MP-026 `subpackages/notifications/index` 通知

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| POST | `/achievements/{achievementId}/conversations` | `upsertAchievementConversation` | Y | Messaging（消息会话）, Achievements（成果） | 小程序端成果/会话提交 |
| GET | `/conversations/{conversationId}/messages` | `listConversationMessages` | Y | Messaging（消息会话） | 小程序端会话/消息查询列表 |
| POST | `/conversations/{conversationId}/messages` | `sendConversationMessage` | Y | Messaging（消息会话） | 小程序端会话/消息提交 |
| POST | `/conversations/{conversationId}/read` | `markConversationRead` | Y | Messaging（消息会话） | 小程序端会话/已读提交 |
| GET | `/notifications` | `listMyNotifications` | Y | Notifications（通知） | 小程序端通知查询列表 |
| GET | `/notifications/{notificationId}` | `getNotificationById` | Y | Notifications（通知） | 小程序端通知查询详情 |
| POST | `/orders/{orderId}/dispute-conversations` | `upsertOrderDisputeConversation` | Y | Messaging（消息会话）, Orders（订单） | 小程序端订单/纠纷会话提交 |
| POST | `/support/conversations` | `upsertSupportConversation` | Y | Messaging（消息会话） | 小程序端客服/会话提交 |
| POST | `/webhooks/wechatpay/notify` | `wechatPayNotify` | N | Payments（支付） | 小程序端微信支付/通知回调提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `Conversation` | 19 |
| `ConversationContentType` | 0 |
| `ConversationMessage` | 13 |
| `ConversationMessageSendRequest` | 3 |
| `ConversationMessageType` | 0 |
| `ErrorResponse` | 3 |
| `Notification` | 8 |
| `NotificationKind` | 0 |
| `PageMeta` | 3 |
| `PagedConversationMessage` | 17 |
| `PagedNotification` | 16 |
| `Uuid` | 0 |

#### MP-027 `subpackages/notifications/detail/index` 通知详情

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| POST | `/achievements/{achievementId}/conversations` | `upsertAchievementConversation` | Y | Messaging（消息会话）, Achievements（成果） | 小程序端成果/会话提交 |
| GET | `/conversations/{conversationId}/messages` | `listConversationMessages` | Y | Messaging（消息会话） | 小程序端会话/消息查询列表 |
| POST | `/conversations/{conversationId}/messages` | `sendConversationMessage` | Y | Messaging（消息会话） | 小程序端会话/消息提交 |
| POST | `/conversations/{conversationId}/read` | `markConversationRead` | Y | Messaging（消息会话） | 小程序端会话/已读提交 |
| GET | `/notifications` | `listMyNotifications` | Y | Notifications（通知） | 小程序端通知查询列表 |
| GET | `/notifications/{notificationId}` | `getNotificationById` | Y | Notifications（通知） | 小程序端通知查询详情 |
| POST | `/orders/{orderId}/dispute-conversations` | `upsertOrderDisputeConversation` | Y | Messaging（消息会话）, Orders（订单） | 小程序端订单/纠纷会话提交 |
| POST | `/support/conversations` | `upsertSupportConversation` | Y | Messaging（消息会话） | 小程序端客服/会话提交 |
| POST | `/webhooks/wechatpay/notify` | `wechatPayNotify` | N | Payments（支付） | 小程序端微信支付/通知回调提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `Conversation` | 19 |
| `ConversationContentType` | 0 |
| `ConversationMessage` | 13 |
| `ConversationMessageSendRequest` | 3 |
| `ConversationMessageType` | 0 |
| `ErrorResponse` | 3 |
| `Notification` | 8 |
| `NotificationKind` | 0 |
| `PageMeta` | 3 |
| `PagedConversationMessage` | 17 |
| `PagedNotification` | 16 |
| `Uuid` | 0 |

#### MP-028 `subpackages/home-announcements/index` 首页公告

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/listings` | `listMyListings` | Y | Listings（挂牌） | 小程序端挂牌查询列表 |
| POST | `/listings` | `createListing` | Y | Listings（挂牌） | 小程序端挂牌提交 |
| GET | `/listings/{listingId}` | `getListingById` | Y | Listings（挂牌） | 小程序端挂牌查询详情 |
| PATCH | `/listings/{listingId}` | `updateListing` | Y | Listings（挂牌） | 小程序端挂牌更新 |
| POST | `/listings/{listingId}/comments` | `createListingComment` | Y | Comments（评论） | 小程序端挂牌/评论提交 |
| POST | `/listings/{listingId}/consultations` | `createListingConsultation` | Y | Listings（挂牌） | 小程序端挂牌/咨询提交 |
| POST | `/listings/{listingId}/conversations` | `upsertListingConversation` | Y | Messaging（消息会话） | 小程序端挂牌/会话提交 |
| POST | `/listings/{listingId}/favorites` | `favoriteListing` | Y | Listings（挂牌） | 小程序端挂牌/收藏提交 |
| DELETE | `/listings/{listingId}/favorites` | `unfavoriteListing` | Y | Listings（挂牌） | 小程序端挂牌/收藏删除 |
| POST | `/listings/{listingId}/off-shelf` | `offShelfListing` | Y | Listings（挂牌） | 小程序端挂牌/下架提交 |
| POST | `/listings/{listingId}/submit` | `submitListing` | Y | Listings（挂牌） | 小程序端挂牌提交 |
| GET | `/me/favorites` | `listMyFavoriteListings` | Y | Listings（挂牌） | 小程序端收藏查询列表 |
| GET | `/me/patent-claims` | `listMyPatentClaims` | Y | Patents（专利） | 小程序端专利认领查询列表 |
| POST | `/me/patent-claims` | `createMyPatentClaim` | Y | Patents（专利） | 小程序端专利认领提交 |
| GET | `/me/patent-maintenance/orders` | `listMyPatentMaintenanceOrders` | Y | Maintenance（专利维保） | 小程序端专利维保/订单查询列表 |
| POST | `/me/patent-maintenance/orders` | `createMyPatentMaintenanceOrder` | Y | Maintenance（专利维保） | 小程序端专利维保/订单提交 |
| GET | `/me/patent-maintenance/orders/{orderId}` | `getMyPatentMaintenanceOrder` | Y | Maintenance（专利维保） | 小程序端专利维保/订单查询详情 |
| GET | `/me/patent-maintenance/orders/{orderId}/events` | `listMyPatentMaintenanceOrderEvents` | Y | Maintenance（专利维保） | 小程序端专利维保/订单/事件查询列表 |
| GET | `/me/patent-maintenance/schedules` | `listMyPatentMaintenanceSchedules` | Y | Maintenance（专利维保） | 小程序端专利维保/日程查询列表 |
| GET | `/me/patent-maintenance/tasks` | `listMyPatentMaintenanceTasks` | Y | Maintenance（专利维保） | 小程序端专利维保/任务查询列表 |
| GET | `/me/recommendations/listings` | `getMyRecommendedListings` | Y | Search（检索） | 小程序端推荐/挂牌查询列表 |
| POST | `/patent-maintenance/orders/{orderId}/conversations` | `upsertMaintenanceOrderConversation` | Y | Messaging（消息会话）, Maintenance（专利维保） | 小程序端专利维保/订单/会话提交 |
| POST | `/patents/normalize` | `normalizePatentNumber` | N | Patents（专利） | 小程序端专利/规范化提交 |
| GET | `/patents/{patentId}` | `getPatentById` | Y | Patents（专利） | 小程序端专利查询详情 |
| GET | `/public/config/home-announcements` | `getPublicHomeAnnouncementsFeed` | N | Config（配置） | 小程序端配置/首页公告查询列表 |
| GET | `/public/listings/{listingId}` | `getPublicListingById` | N | Listings（挂牌） | 小程序端挂牌查询详情 |
| GET | `/public/listings/{listingId}/comments` | `listPublicListingComments` | N | Comments（评论） | 小程序端挂牌/评论查询列表 |
| GET | `/public/organizations` | `listPublicOrganizations` | N | Organizations（机构） | 小程序端机构查询列表 |
| GET | `/public/organizations/{orgUserId}` | `getPublicOrganizationById` | N | Organizations（机构） | 小程序端机构查询详情 |
| GET | `/public/tech-managers/{techManagerId}` | `getPublicTechManagerById` | N | TechManagers（技术经理） | 小程序端技术经理查询详情 |
| GET | `/search/achievements` | `searchAchievements` | N | Search（检索）, Achievements（成果） | 小程序端成果查询列表 |
| GET | `/search/inventors` | `searchInventorRankings` | N | Search（检索） | 小程序端发明人查询列表 |
| GET | `/search/listings` | `searchListings` | N | Search（检索） | 小程序端挂牌查询列表 |
| GET | `/search/tech-managers` | `searchTechManagers` | N | Search（检索）, TechManagers（技术经理） | 小程序端技术经理查询列表 |
| POST | `/tech-managers/{techManagerId}/conversations` | `upsertTechManagerConversation` | Y | Messaging（消息会话）, TechManagers（技术经理） | 小程序端技术经理/会话提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `AchievementMaturity` | 0 |
| `AchievementSortBy` | 0 |
| `AchievementSummary` | 46 |
| `AiContentType` | 0 |
| `AiParseResult` | 16 |
| `AiParseStatus` | 0 |
| `AuditStatus` | 0 |
| `Comment` | 27 |
| `CommentContentType` | 0 |
| `CommentCreateRequest` | 3 |
| `CommentStatus` | 0 |
| `CommentThread` | 59 |
| `ConsultationRouting` | 0 |
| `ContentSource` | 0 |
| `ContentStatus` | 0 |
| `Conversation` | 19 |
| `ConversationContentType` | 0 |
| `ErrorResponse` | 3 |
| `ExistingLicenseStatus` | 0 |
| `FeaturedLevel` | 0 |
| `InventorRankingItem` | 4 |
| `Jurisdiction` | 0 |
| `LegalStatus` | 0 |
| `LicenseMode` | 0 |
| `Listing` | 112 |
| `ListingConsultationCreated` | 3 |
| `ListingCreateRequest` | 62 |
| `ListingMedia` | 4 |
| `ListingPublic` | 121 |
| `ListingStats` | 4 |
| `ListingStatus` | 0 |
| `ListingSummary` | 65 |
| `ListingTopic` | 0 |
| `ListingUpdateRequest` | 60 |
| `MaintenanceUrgency` | 0 |
| `MoneyFen` | 0 |
| `MyPatentMaintenanceSchedule` | 16 |
| `MyPatentMaintenanceTask` | 24 |
| `OrganizationStats` | 2 |
| `OrganizationSummary` | 17 |
| `PageMeta` | 3 |
| `PagedAchievementSummary` | 54 |
| `PagedCommentThread` | 67 |
| `PagedInventorRanking` | 12 |
| `PagedListing` | 121 |
| `PagedListingSummary` | 73 |
| `PagedMyPatentMaintenanceOrder` | 46 |
| `PagedMyPatentMaintenanceSchedule` | 25 |
| `PagedMyPatentMaintenanceTask` | 33 |
| `PagedOrganizationSummary` | 25 |
| `PagedPatentClaimRequest` | 27 |
| `PagedTechManagerSummary` | 27 |
| `Patent` | 71 |
| `PatentClaimCreateRequest` | 6 |
| `PatentClaimRequest` | 19 |
| `PatentClaimStatus` | 0 |
| `PatentMaintenanceOrder` | 38 |
| `PatentMaintenanceOrderEvent` | 17 |
| `PatentMaintenanceOrderEventList` | 20 |
| `PatentMaintenanceOrderEventType` | 0 |
| `PatentMaintenanceOrderMyCreateRequest` | 2 |
| `PatentMaintenanceOrderStatus` | 0 |
| `PatentMaintenancePaymentChannel` | 0 |
| `PatentMaintenanceReconcileStatus` | 0 |
| `PatentMaintenanceSchedule` | 11 |
| `PatentMaintenanceStatus` | 0 |
| `PatentMaintenanceTask` | 13 |
| `PatentMaintenanceTaskStatus` | 0 |
| `PatentMedia` | 5 |
| `PatentNormalizeRequest` | 1 |
| `PatentNormalizeResponse` | 15 |
| `PatentNumberInputType` | 0 |
| `PatentOwnerClaimSource` | 0 |
| `PatentTradeSnapshot` | 22 |
| `PatentType` | 0 |
| `PledgeStatus` | 0 |
| `PriceType` | 0 |
| `PublicHomeAnnouncementFeed` | 12 |
| `PublicHomeAnnouncementItem` | 8 |
| `SearchQType` | 0 |
| `SortBy` | 0 |
| `SupplyType` | 0 |
| `TechManagerPublic` | 22 |
| `TechManagerSortBy` | 0 |
| `TechManagerStats` | 4 |
| `TechManagerSummary` | 19 |
| `TradeMode` | 0 |
| `UserBrief` | 12 |
| `UserRole` | 0 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### MP-029 `subpackages/home-announcements/detail/index` 首页公告详情

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/listings` | `listMyListings` | Y | Listings（挂牌） | 小程序端挂牌查询列表 |
| POST | `/listings` | `createListing` | Y | Listings（挂牌） | 小程序端挂牌提交 |
| GET | `/listings/{listingId}` | `getListingById` | Y | Listings（挂牌） | 小程序端挂牌查询详情 |
| PATCH | `/listings/{listingId}` | `updateListing` | Y | Listings（挂牌） | 小程序端挂牌更新 |
| POST | `/listings/{listingId}/comments` | `createListingComment` | Y | Comments（评论） | 小程序端挂牌/评论提交 |
| POST | `/listings/{listingId}/consultations` | `createListingConsultation` | Y | Listings（挂牌） | 小程序端挂牌/咨询提交 |
| POST | `/listings/{listingId}/conversations` | `upsertListingConversation` | Y | Messaging（消息会话） | 小程序端挂牌/会话提交 |
| POST | `/listings/{listingId}/favorites` | `favoriteListing` | Y | Listings（挂牌） | 小程序端挂牌/收藏提交 |
| DELETE | `/listings/{listingId}/favorites` | `unfavoriteListing` | Y | Listings（挂牌） | 小程序端挂牌/收藏删除 |
| POST | `/listings/{listingId}/off-shelf` | `offShelfListing` | Y | Listings（挂牌） | 小程序端挂牌/下架提交 |
| POST | `/listings/{listingId}/submit` | `submitListing` | Y | Listings（挂牌） | 小程序端挂牌提交 |
| GET | `/me/favorites` | `listMyFavoriteListings` | Y | Listings（挂牌） | 小程序端收藏查询列表 |
| GET | `/me/patent-claims` | `listMyPatentClaims` | Y | Patents（专利） | 小程序端专利认领查询列表 |
| POST | `/me/patent-claims` | `createMyPatentClaim` | Y | Patents（专利） | 小程序端专利认领提交 |
| GET | `/me/patent-maintenance/orders` | `listMyPatentMaintenanceOrders` | Y | Maintenance（专利维保） | 小程序端专利维保/订单查询列表 |
| POST | `/me/patent-maintenance/orders` | `createMyPatentMaintenanceOrder` | Y | Maintenance（专利维保） | 小程序端专利维保/订单提交 |
| GET | `/me/patent-maintenance/orders/{orderId}` | `getMyPatentMaintenanceOrder` | Y | Maintenance（专利维保） | 小程序端专利维保/订单查询详情 |
| GET | `/me/patent-maintenance/orders/{orderId}/events` | `listMyPatentMaintenanceOrderEvents` | Y | Maintenance（专利维保） | 小程序端专利维保/订单/事件查询列表 |
| GET | `/me/patent-maintenance/schedules` | `listMyPatentMaintenanceSchedules` | Y | Maintenance（专利维保） | 小程序端专利维保/日程查询列表 |
| GET | `/me/patent-maintenance/tasks` | `listMyPatentMaintenanceTasks` | Y | Maintenance（专利维保） | 小程序端专利维保/任务查询列表 |
| GET | `/me/recommendations/listings` | `getMyRecommendedListings` | Y | Search（检索） | 小程序端推荐/挂牌查询列表 |
| POST | `/patent-maintenance/orders/{orderId}/conversations` | `upsertMaintenanceOrderConversation` | Y | Messaging（消息会话）, Maintenance（专利维保） | 小程序端专利维保/订单/会话提交 |
| POST | `/patents/normalize` | `normalizePatentNumber` | N | Patents（专利） | 小程序端专利/规范化提交 |
| GET | `/patents/{patentId}` | `getPatentById` | Y | Patents（专利） | 小程序端专利查询详情 |
| GET | `/public/config/home-announcements` | `getPublicHomeAnnouncementsFeed` | N | Config（配置） | 小程序端配置/首页公告查询列表 |
| GET | `/public/listings/{listingId}` | `getPublicListingById` | N | Listings（挂牌） | 小程序端挂牌查询详情 |
| GET | `/public/listings/{listingId}/comments` | `listPublicListingComments` | N | Comments（评论） | 小程序端挂牌/评论查询列表 |
| GET | `/public/organizations` | `listPublicOrganizations` | N | Organizations（机构） | 小程序端机构查询列表 |
| GET | `/public/organizations/{orgUserId}` | `getPublicOrganizationById` | N | Organizations（机构） | 小程序端机构查询详情 |
| GET | `/public/tech-managers/{techManagerId}` | `getPublicTechManagerById` | N | TechManagers（技术经理） | 小程序端技术经理查询详情 |
| GET | `/search/achievements` | `searchAchievements` | N | Search（检索）, Achievements（成果） | 小程序端成果查询列表 |
| GET | `/search/inventors` | `searchInventorRankings` | N | Search（检索） | 小程序端发明人查询列表 |
| GET | `/search/listings` | `searchListings` | N | Search（检索） | 小程序端挂牌查询列表 |
| GET | `/search/tech-managers` | `searchTechManagers` | N | Search（检索）, TechManagers（技术经理） | 小程序端技术经理查询列表 |
| POST | `/tech-managers/{techManagerId}/conversations` | `upsertTechManagerConversation` | Y | Messaging（消息会话）, TechManagers（技术经理） | 小程序端技术经理/会话提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `AchievementMaturity` | 0 |
| `AchievementSortBy` | 0 |
| `AchievementSummary` | 46 |
| `AiContentType` | 0 |
| `AiParseResult` | 16 |
| `AiParseStatus` | 0 |
| `AuditStatus` | 0 |
| `Comment` | 27 |
| `CommentContentType` | 0 |
| `CommentCreateRequest` | 3 |
| `CommentStatus` | 0 |
| `CommentThread` | 59 |
| `ConsultationRouting` | 0 |
| `ContentSource` | 0 |
| `ContentStatus` | 0 |
| `Conversation` | 19 |
| `ConversationContentType` | 0 |
| `ErrorResponse` | 3 |
| `ExistingLicenseStatus` | 0 |
| `FeaturedLevel` | 0 |
| `InventorRankingItem` | 4 |
| `Jurisdiction` | 0 |
| `LegalStatus` | 0 |
| `LicenseMode` | 0 |
| `Listing` | 112 |
| `ListingConsultationCreated` | 3 |
| `ListingCreateRequest` | 62 |
| `ListingMedia` | 4 |
| `ListingPublic` | 121 |
| `ListingStats` | 4 |
| `ListingStatus` | 0 |
| `ListingSummary` | 65 |
| `ListingTopic` | 0 |
| `ListingUpdateRequest` | 60 |
| `MaintenanceUrgency` | 0 |
| `MoneyFen` | 0 |
| `MyPatentMaintenanceSchedule` | 16 |
| `MyPatentMaintenanceTask` | 24 |
| `OrganizationStats` | 2 |
| `OrganizationSummary` | 17 |
| `PageMeta` | 3 |
| `PagedAchievementSummary` | 54 |
| `PagedCommentThread` | 67 |
| `PagedInventorRanking` | 12 |
| `PagedListing` | 121 |
| `PagedListingSummary` | 73 |
| `PagedMyPatentMaintenanceOrder` | 46 |
| `PagedMyPatentMaintenanceSchedule` | 25 |
| `PagedMyPatentMaintenanceTask` | 33 |
| `PagedOrganizationSummary` | 25 |
| `PagedPatentClaimRequest` | 27 |
| `PagedTechManagerSummary` | 27 |
| `Patent` | 71 |
| `PatentClaimCreateRequest` | 6 |
| `PatentClaimRequest` | 19 |
| `PatentClaimStatus` | 0 |
| `PatentMaintenanceOrder` | 38 |
| `PatentMaintenanceOrderEvent` | 17 |
| `PatentMaintenanceOrderEventList` | 20 |
| `PatentMaintenanceOrderEventType` | 0 |
| `PatentMaintenanceOrderMyCreateRequest` | 2 |
| `PatentMaintenanceOrderStatus` | 0 |
| `PatentMaintenancePaymentChannel` | 0 |
| `PatentMaintenanceReconcileStatus` | 0 |
| `PatentMaintenanceSchedule` | 11 |
| `PatentMaintenanceStatus` | 0 |
| `PatentMaintenanceTask` | 13 |
| `PatentMaintenanceTaskStatus` | 0 |
| `PatentMedia` | 5 |
| `PatentNormalizeRequest` | 1 |
| `PatentNormalizeResponse` | 15 |
| `PatentNumberInputType` | 0 |
| `PatentOwnerClaimSource` | 0 |
| `PatentTradeSnapshot` | 22 |
| `PatentType` | 0 |
| `PledgeStatus` | 0 |
| `PriceType` | 0 |
| `PublicHomeAnnouncementFeed` | 12 |
| `PublicHomeAnnouncementItem` | 8 |
| `SearchQType` | 0 |
| `SortBy` | 0 |
| `SupplyType` | 0 |
| `TechManagerPublic` | 22 |
| `TechManagerSortBy` | 0 |
| `TechManagerStats` | 4 |
| `TechManagerSummary` | 19 |
| `TradeMode` | 0 |
| `UserBrief` | 12 |
| `UserRole` | 0 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### MP-030 `subpackages/listing/detail/index` 挂牌详情

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/listings` | `listMyListings` | Y | Listings（挂牌） | 小程序端挂牌查询列表 |
| POST | `/listings` | `createListing` | Y | Listings（挂牌） | 小程序端挂牌提交 |
| GET | `/listings/{listingId}` | `getListingById` | Y | Listings（挂牌） | 小程序端挂牌查询详情 |
| PATCH | `/listings/{listingId}` | `updateListing` | Y | Listings（挂牌） | 小程序端挂牌更新 |
| POST | `/listings/{listingId}/comments` | `createListingComment` | Y | Comments（评论） | 小程序端挂牌/评论提交 |
| POST | `/listings/{listingId}/consultations` | `createListingConsultation` | Y | Listings（挂牌） | 小程序端挂牌/咨询提交 |
| POST | `/listings/{listingId}/conversations` | `upsertListingConversation` | Y | Messaging（消息会话） | 小程序端挂牌/会话提交 |
| POST | `/listings/{listingId}/favorites` | `favoriteListing` | Y | Listings（挂牌） | 小程序端挂牌/收藏提交 |
| DELETE | `/listings/{listingId}/favorites` | `unfavoriteListing` | Y | Listings（挂牌） | 小程序端挂牌/收藏删除 |
| POST | `/listings/{listingId}/off-shelf` | `offShelfListing` | Y | Listings（挂牌） | 小程序端挂牌/下架提交 |
| POST | `/listings/{listingId}/submit` | `submitListing` | Y | Listings（挂牌） | 小程序端挂牌提交 |
| GET | `/me/favorites` | `listMyFavoriteListings` | Y | Listings（挂牌） | 小程序端收藏查询列表 |
| GET | `/me/patent-claims` | `listMyPatentClaims` | Y | Patents（专利） | 小程序端专利认领查询列表 |
| POST | `/me/patent-claims` | `createMyPatentClaim` | Y | Patents（专利） | 小程序端专利认领提交 |
| GET | `/me/patent-maintenance/orders` | `listMyPatentMaintenanceOrders` | Y | Maintenance（专利维保） | 小程序端专利维保/订单查询列表 |
| POST | `/me/patent-maintenance/orders` | `createMyPatentMaintenanceOrder` | Y | Maintenance（专利维保） | 小程序端专利维保/订单提交 |
| GET | `/me/patent-maintenance/orders/{orderId}` | `getMyPatentMaintenanceOrder` | Y | Maintenance（专利维保） | 小程序端专利维保/订单查询详情 |
| GET | `/me/patent-maintenance/orders/{orderId}/events` | `listMyPatentMaintenanceOrderEvents` | Y | Maintenance（专利维保） | 小程序端专利维保/订单/事件查询列表 |
| GET | `/me/patent-maintenance/schedules` | `listMyPatentMaintenanceSchedules` | Y | Maintenance（专利维保） | 小程序端专利维保/日程查询列表 |
| GET | `/me/patent-maintenance/tasks` | `listMyPatentMaintenanceTasks` | Y | Maintenance（专利维保） | 小程序端专利维保/任务查询列表 |
| GET | `/me/recommendations/listings` | `getMyRecommendedListings` | Y | Search（检索） | 小程序端推荐/挂牌查询列表 |
| POST | `/patent-maintenance/orders/{orderId}/conversations` | `upsertMaintenanceOrderConversation` | Y | Messaging（消息会话）, Maintenance（专利维保） | 小程序端专利维保/订单/会话提交 |
| POST | `/patents/normalize` | `normalizePatentNumber` | N | Patents（专利） | 小程序端专利/规范化提交 |
| GET | `/patents/{patentId}` | `getPatentById` | Y | Patents（专利） | 小程序端专利查询详情 |
| GET | `/public/config/home-announcements` | `getPublicHomeAnnouncementsFeed` | N | Config（配置） | 小程序端配置/首页公告查询列表 |
| GET | `/public/listings/{listingId}` | `getPublicListingById` | N | Listings（挂牌） | 小程序端挂牌查询详情 |
| GET | `/public/listings/{listingId}/comments` | `listPublicListingComments` | N | Comments（评论） | 小程序端挂牌/评论查询列表 |
| GET | `/public/organizations` | `listPublicOrganizations` | N | Organizations（机构） | 小程序端机构查询列表 |
| GET | `/public/organizations/{orgUserId}` | `getPublicOrganizationById` | N | Organizations（机构） | 小程序端机构查询详情 |
| GET | `/public/tech-managers/{techManagerId}` | `getPublicTechManagerById` | N | TechManagers（技术经理） | 小程序端技术经理查询详情 |
| GET | `/search/achievements` | `searchAchievements` | N | Search（检索）, Achievements（成果） | 小程序端成果查询列表 |
| GET | `/search/inventors` | `searchInventorRankings` | N | Search（检索） | 小程序端发明人查询列表 |
| GET | `/search/listings` | `searchListings` | N | Search（检索） | 小程序端挂牌查询列表 |
| GET | `/search/tech-managers` | `searchTechManagers` | N | Search（检索）, TechManagers（技术经理） | 小程序端技术经理查询列表 |
| POST | `/tech-managers/{techManagerId}/conversations` | `upsertTechManagerConversation` | Y | Messaging（消息会话）, TechManagers（技术经理） | 小程序端技术经理/会话提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `AchievementMaturity` | 0 |
| `AchievementSortBy` | 0 |
| `AchievementSummary` | 46 |
| `AiContentType` | 0 |
| `AiParseResult` | 16 |
| `AiParseStatus` | 0 |
| `AuditStatus` | 0 |
| `Comment` | 27 |
| `CommentContentType` | 0 |
| `CommentCreateRequest` | 3 |
| `CommentStatus` | 0 |
| `CommentThread` | 59 |
| `ConsultationRouting` | 0 |
| `ContentSource` | 0 |
| `ContentStatus` | 0 |
| `Conversation` | 19 |
| `ConversationContentType` | 0 |
| `ErrorResponse` | 3 |
| `ExistingLicenseStatus` | 0 |
| `FeaturedLevel` | 0 |
| `InventorRankingItem` | 4 |
| `Jurisdiction` | 0 |
| `LegalStatus` | 0 |
| `LicenseMode` | 0 |
| `Listing` | 112 |
| `ListingConsultationCreated` | 3 |
| `ListingCreateRequest` | 62 |
| `ListingMedia` | 4 |
| `ListingPublic` | 121 |
| `ListingStats` | 4 |
| `ListingStatus` | 0 |
| `ListingSummary` | 65 |
| `ListingTopic` | 0 |
| `ListingUpdateRequest` | 60 |
| `MaintenanceUrgency` | 0 |
| `MoneyFen` | 0 |
| `MyPatentMaintenanceSchedule` | 16 |
| `MyPatentMaintenanceTask` | 24 |
| `OrganizationStats` | 2 |
| `OrganizationSummary` | 17 |
| `PageMeta` | 3 |
| `PagedAchievementSummary` | 54 |
| `PagedCommentThread` | 67 |
| `PagedInventorRanking` | 12 |
| `PagedListing` | 121 |
| `PagedListingSummary` | 73 |
| `PagedMyPatentMaintenanceOrder` | 46 |
| `PagedMyPatentMaintenanceSchedule` | 25 |
| `PagedMyPatentMaintenanceTask` | 33 |
| `PagedOrganizationSummary` | 25 |
| `PagedPatentClaimRequest` | 27 |
| `PagedTechManagerSummary` | 27 |
| `Patent` | 71 |
| `PatentClaimCreateRequest` | 6 |
| `PatentClaimRequest` | 19 |
| `PatentClaimStatus` | 0 |
| `PatentMaintenanceOrder` | 38 |
| `PatentMaintenanceOrderEvent` | 17 |
| `PatentMaintenanceOrderEventList` | 20 |
| `PatentMaintenanceOrderEventType` | 0 |
| `PatentMaintenanceOrderMyCreateRequest` | 2 |
| `PatentMaintenanceOrderStatus` | 0 |
| `PatentMaintenancePaymentChannel` | 0 |
| `PatentMaintenanceReconcileStatus` | 0 |
| `PatentMaintenanceSchedule` | 11 |
| `PatentMaintenanceStatus` | 0 |
| `PatentMaintenanceTask` | 13 |
| `PatentMaintenanceTaskStatus` | 0 |
| `PatentMedia` | 5 |
| `PatentNormalizeRequest` | 1 |
| `PatentNormalizeResponse` | 15 |
| `PatentNumberInputType` | 0 |
| `PatentOwnerClaimSource` | 0 |
| `PatentTradeSnapshot` | 22 |
| `PatentType` | 0 |
| `PledgeStatus` | 0 |
| `PriceType` | 0 |
| `PublicHomeAnnouncementFeed` | 12 |
| `PublicHomeAnnouncementItem` | 8 |
| `SearchQType` | 0 |
| `SortBy` | 0 |
| `SupplyType` | 0 |
| `TechManagerPublic` | 22 |
| `TechManagerSortBy` | 0 |
| `TechManagerStats` | 4 |
| `TechManagerSummary` | 19 |
| `TradeMode` | 0 |
| `UserBrief` | 12 |
| `UserRole` | 0 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### MP-031 `subpackages/achievement/detail/index` 成果详情

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/achievements` | `listMyAchievements` | Y | Achievements（成果） | 小程序端成果查询列表 |
| POST | `/achievements` | `createAchievement` | Y | Achievements（成果） | 小程序端成果提交 |
| GET | `/achievements/{achievementId}` | `getMyAchievementById` | Y | Achievements（成果） | 小程序端成果查询详情 |
| PATCH | `/achievements/{achievementId}` | `updateMyAchievement` | Y | Achievements（成果） | 小程序端成果更新 |
| POST | `/achievements/{achievementId}/comments` | `createAchievementComment` | Y | Comments（评论）, Achievements（成果） | 小程序端成果/评论提交 |
| POST | `/achievements/{achievementId}/consultations` | `createAchievementConsultation` | Y | Achievements（成果） | 小程序端成果/咨询提交 |
| POST | `/achievements/{achievementId}/off-shelf` | `offShelfAchievement` | Y | Achievements（成果） | 小程序端成果/下架提交 |
| POST | `/achievements/{achievementId}/submit` | `submitAchievement` | Y | Achievements（成果） | 小程序端成果提交 |
| POST | `/ai/agent/query` | `createAiAgentQuery` | N | AI（智能解析） | 小程序端智能/坐席/查询提交 |
| POST | `/ai/parse-results/{parseResultId}/feedback` | `createAiParseFeedback` | Y | AI（智能解析） | 小程序端智能/解析结果/反馈提交 |
| PATCH | `/comments/{commentId}` | `updateComment` | Y | Comments（评论） | 小程序端评论更新 |
| DELETE | `/comments/{commentId}` | `deleteComment` | Y | Comments（评论） | 小程序端评论删除 |
| POST | `/files` | `uploadFile` | Y | Files（文件） | 小程序端文件提交 |
| GET | `/files/{fileId}` | `downloadFile` | Y | Files（文件） | 小程序端文件查询详情 |
| GET | `/files/{fileId}/preview` | `previewFile` | Y | Files（文件） | 小程序端文件/预览查询列表 |
| POST | `/files/{fileId}/temporary-access` | `createFileTemporaryAccess` | Y | Files（文件） | 小程序端文件/临时访问提交 |
| GET | `/health` | `getHealth` | N | System（系统） | 小程序端健康查询列表 |
| GET | `/me` | `getMe` | Y | Users（用户） | 小程序端我的查询列表 |
| PATCH | `/me` | `updateMe` | Y | Users（用户） | 小程序端我的更新 |
| GET | `/public/achievements/{achievementId}` | `getPublicAchievementById` | N | Achievements（成果） | 小程序端成果查询详情 |
| GET | `/public/achievements/{achievementId}/comments` | `listPublicAchievementComments` | N | Comments（评论）, Achievements（成果） | 小程序端成果/评论查询列表 |
| GET | `/public/config/banner` | `getPublicBannerConfig` | N | Config（配置） | 小程序端配置/横幅查询列表 |
| GET | `/public/config/customer-service` | `getPublicCustomerServiceConfig` | N | Config（配置） | 小程序端配置/客户服务查询列表 |
| GET | `/public/industry-tags` | `listPublicIndustryTags` | N | Regions（地区） | 小程序端行业标签查询列表 |
| GET | `/regions` | `listRegions` | N | Regions（地区） | 小程序端地区查询列表 |

| Schema | 字段数（全量展开） |
|---|---|
| `AchievementCreateRequest` | 22 |
| `AchievementDetail` | 60 |
| `AchievementEdit` | 61 |
| `AchievementMaturity` | 0 |
| `AchievementRecord` | 26 |
| `AchievementSummary` | 46 |
| `AchievementUpdateRequest` | 22 |
| `AiAgentInputType` | 0 |
| `AiAgentMatchSummary` | 7 |
| `AiAgentParsedQuery` | 28 |
| `AiAgentQueryRequest` | 11 |
| `AiAgentQueryResult` | 49 |
| `AiContentScope` | 0 |
| `AiContentType` | 0 |
| `AiParseFeedback` | 13 |
| `AiParseFeedbackActorType` | 0 |
| `AiParseFeedbackRequest` | 4 |
| `AiSearchFilters` | 21 |
| `AuditStatus` | 0 |
| `BannerConfig` | 9 |
| `BannerItem` | 6 |
| `Comment` | 27 |
| `CommentContentType` | 0 |
| `CommentCreateRequest` | 3 |
| `CommentStatus` | 0 |
| `CommentThread` | 59 |
| `CommentUpdateRequest` | 1 |
| `ContentMedia` | 9 |
| `ContentMediaInput` | 5 |
| `ContentMediaType` | 0 |
| `ContentSource` | 0 |
| `ContentStatus` | 0 |
| `CooperationMode` | 0 |
| `CustomerServiceConfig` | 2 |
| `ErrorResponse` | 3 |
| `FileObject` | 7 |
| `FilePurpose` | 0 |
| `FileTemporaryAccessRequest` | 4 |
| `FileTemporaryAccessResponse` | 4 |
| `FileTemporaryAccessScope` | 0 |
| `IndustryTag` | 5 |
| `ListingStats` | 4 |
| `MoneyFen` | 0 |
| `OkResponse` | 1 |
| `OrganizationStats` | 2 |
| `OrganizationSummary` | 17 |
| `PageMeta` | 3 |
| `PagedAchievementSummary` | 54 |
| `PagedCommentThread` | 67 |
| `PatentType` | 0 |
| `PhoneNumber` | 0 |
| `PriceType` | 0 |
| `RegionLevel` | 0 |
| `RegionNode` | 10 |
| `SupplyType` | 0 |
| `TradeMode` | 0 |
| `UserBrief` | 12 |
| `UserProfile` | 17 |
| `UserRole` | 0 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### MP-032 `subpackages/favorites/index` 收藏

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| POST | `/achievements/{achievementId}/favorites` | `favoriteAchievement` | Y | Achievements（成果） | 小程序端成果/收藏提交 |
| DELETE | `/achievements/{achievementId}/favorites` | `unfavoriteAchievement` | Y | Achievements（成果） | 小程序端成果/收藏删除 |

| Schema | 字段数（全量展开） |
|---|---|
| `ErrorResponse` | 3 |
| `OkResponse` | 1 |
| `Uuid` | 0 |

#### MP-033 `subpackages/organizations/index` 机构

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/listings` | `listMyListings` | Y | Listings（挂牌） | 小程序端挂牌查询列表 |
| POST | `/listings` | `createListing` | Y | Listings（挂牌） | 小程序端挂牌提交 |
| GET | `/listings/{listingId}` | `getListingById` | Y | Listings（挂牌） | 小程序端挂牌查询详情 |
| PATCH | `/listings/{listingId}` | `updateListing` | Y | Listings（挂牌） | 小程序端挂牌更新 |
| POST | `/listings/{listingId}/comments` | `createListingComment` | Y | Comments（评论） | 小程序端挂牌/评论提交 |
| POST | `/listings/{listingId}/consultations` | `createListingConsultation` | Y | Listings（挂牌） | 小程序端挂牌/咨询提交 |
| POST | `/listings/{listingId}/conversations` | `upsertListingConversation` | Y | Messaging（消息会话） | 小程序端挂牌/会话提交 |
| POST | `/listings/{listingId}/favorites` | `favoriteListing` | Y | Listings（挂牌） | 小程序端挂牌/收藏提交 |
| DELETE | `/listings/{listingId}/favorites` | `unfavoriteListing` | Y | Listings（挂牌） | 小程序端挂牌/收藏删除 |
| POST | `/listings/{listingId}/off-shelf` | `offShelfListing` | Y | Listings（挂牌） | 小程序端挂牌/下架提交 |
| POST | `/listings/{listingId}/submit` | `submitListing` | Y | Listings（挂牌） | 小程序端挂牌提交 |
| GET | `/me/favorites` | `listMyFavoriteListings` | Y | Listings（挂牌） | 小程序端收藏查询列表 |
| GET | `/me/patent-claims` | `listMyPatentClaims` | Y | Patents（专利） | 小程序端专利认领查询列表 |
| POST | `/me/patent-claims` | `createMyPatentClaim` | Y | Patents（专利） | 小程序端专利认领提交 |
| GET | `/me/patent-maintenance/orders` | `listMyPatentMaintenanceOrders` | Y | Maintenance（专利维保） | 小程序端专利维保/订单查询列表 |
| POST | `/me/patent-maintenance/orders` | `createMyPatentMaintenanceOrder` | Y | Maintenance（专利维保） | 小程序端专利维保/订单提交 |
| GET | `/me/patent-maintenance/orders/{orderId}` | `getMyPatentMaintenanceOrder` | Y | Maintenance（专利维保） | 小程序端专利维保/订单查询详情 |
| GET | `/me/patent-maintenance/orders/{orderId}/events` | `listMyPatentMaintenanceOrderEvents` | Y | Maintenance（专利维保） | 小程序端专利维保/订单/事件查询列表 |
| GET | `/me/patent-maintenance/schedules` | `listMyPatentMaintenanceSchedules` | Y | Maintenance（专利维保） | 小程序端专利维保/日程查询列表 |
| GET | `/me/patent-maintenance/tasks` | `listMyPatentMaintenanceTasks` | Y | Maintenance（专利维保） | 小程序端专利维保/任务查询列表 |
| GET | `/me/recommendations/listings` | `getMyRecommendedListings` | Y | Search（检索） | 小程序端推荐/挂牌查询列表 |
| POST | `/patent-maintenance/orders/{orderId}/conversations` | `upsertMaintenanceOrderConversation` | Y | Messaging（消息会话）, Maintenance（专利维保） | 小程序端专利维保/订单/会话提交 |
| POST | `/patents/normalize` | `normalizePatentNumber` | N | Patents（专利） | 小程序端专利/规范化提交 |
| GET | `/patents/{patentId}` | `getPatentById` | Y | Patents（专利） | 小程序端专利查询详情 |
| GET | `/public/config/home-announcements` | `getPublicHomeAnnouncementsFeed` | N | Config（配置） | 小程序端配置/首页公告查询列表 |
| GET | `/public/listings/{listingId}` | `getPublicListingById` | N | Listings（挂牌） | 小程序端挂牌查询详情 |
| GET | `/public/listings/{listingId}/comments` | `listPublicListingComments` | N | Comments（评论） | 小程序端挂牌/评论查询列表 |
| GET | `/public/organizations` | `listPublicOrganizations` | N | Organizations（机构） | 小程序端机构查询列表 |
| GET | `/public/organizations/{orgUserId}` | `getPublicOrganizationById` | N | Organizations（机构） | 小程序端机构查询详情 |
| GET | `/public/tech-managers/{techManagerId}` | `getPublicTechManagerById` | N | TechManagers（技术经理） | 小程序端技术经理查询详情 |
| GET | `/search/achievements` | `searchAchievements` | N | Search（检索）, Achievements（成果） | 小程序端成果查询列表 |
| GET | `/search/inventors` | `searchInventorRankings` | N | Search（检索） | 小程序端发明人查询列表 |
| GET | `/search/listings` | `searchListings` | N | Search（检索） | 小程序端挂牌查询列表 |
| GET | `/search/tech-managers` | `searchTechManagers` | N | Search（检索）, TechManagers（技术经理） | 小程序端技术经理查询列表 |
| POST | `/tech-managers/{techManagerId}/conversations` | `upsertTechManagerConversation` | Y | Messaging（消息会话）, TechManagers（技术经理） | 小程序端技术经理/会话提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `AchievementMaturity` | 0 |
| `AchievementSortBy` | 0 |
| `AchievementSummary` | 46 |
| `AiContentType` | 0 |
| `AiParseResult` | 16 |
| `AiParseStatus` | 0 |
| `AuditStatus` | 0 |
| `Comment` | 27 |
| `CommentContentType` | 0 |
| `CommentCreateRequest` | 3 |
| `CommentStatus` | 0 |
| `CommentThread` | 59 |
| `ConsultationRouting` | 0 |
| `ContentSource` | 0 |
| `ContentStatus` | 0 |
| `Conversation` | 19 |
| `ConversationContentType` | 0 |
| `ErrorResponse` | 3 |
| `ExistingLicenseStatus` | 0 |
| `FeaturedLevel` | 0 |
| `InventorRankingItem` | 4 |
| `Jurisdiction` | 0 |
| `LegalStatus` | 0 |
| `LicenseMode` | 0 |
| `Listing` | 112 |
| `ListingConsultationCreated` | 3 |
| `ListingCreateRequest` | 62 |
| `ListingMedia` | 4 |
| `ListingPublic` | 121 |
| `ListingStats` | 4 |
| `ListingStatus` | 0 |
| `ListingSummary` | 65 |
| `ListingTopic` | 0 |
| `ListingUpdateRequest` | 60 |
| `MaintenanceUrgency` | 0 |
| `MoneyFen` | 0 |
| `MyPatentMaintenanceSchedule` | 16 |
| `MyPatentMaintenanceTask` | 24 |
| `OrganizationStats` | 2 |
| `OrganizationSummary` | 17 |
| `PageMeta` | 3 |
| `PagedAchievementSummary` | 54 |
| `PagedCommentThread` | 67 |
| `PagedInventorRanking` | 12 |
| `PagedListing` | 121 |
| `PagedListingSummary` | 73 |
| `PagedMyPatentMaintenanceOrder` | 46 |
| `PagedMyPatentMaintenanceSchedule` | 25 |
| `PagedMyPatentMaintenanceTask` | 33 |
| `PagedOrganizationSummary` | 25 |
| `PagedPatentClaimRequest` | 27 |
| `PagedTechManagerSummary` | 27 |
| `Patent` | 71 |
| `PatentClaimCreateRequest` | 6 |
| `PatentClaimRequest` | 19 |
| `PatentClaimStatus` | 0 |
| `PatentMaintenanceOrder` | 38 |
| `PatentMaintenanceOrderEvent` | 17 |
| `PatentMaintenanceOrderEventList` | 20 |
| `PatentMaintenanceOrderEventType` | 0 |
| `PatentMaintenanceOrderMyCreateRequest` | 2 |
| `PatentMaintenanceOrderStatus` | 0 |
| `PatentMaintenancePaymentChannel` | 0 |
| `PatentMaintenanceReconcileStatus` | 0 |
| `PatentMaintenanceSchedule` | 11 |
| `PatentMaintenanceStatus` | 0 |
| `PatentMaintenanceTask` | 13 |
| `PatentMaintenanceTaskStatus` | 0 |
| `PatentMedia` | 5 |
| `PatentNormalizeRequest` | 1 |
| `PatentNormalizeResponse` | 15 |
| `PatentNumberInputType` | 0 |
| `PatentOwnerClaimSource` | 0 |
| `PatentTradeSnapshot` | 22 |
| `PatentType` | 0 |
| `PledgeStatus` | 0 |
| `PriceType` | 0 |
| `PublicHomeAnnouncementFeed` | 12 |
| `PublicHomeAnnouncementItem` | 8 |
| `SearchQType` | 0 |
| `SortBy` | 0 |
| `SupplyType` | 0 |
| `TechManagerPublic` | 22 |
| `TechManagerSortBy` | 0 |
| `TechManagerStats` | 4 |
| `TechManagerSummary` | 19 |
| `TradeMode` | 0 |
| `UserBrief` | 12 |
| `UserRole` | 0 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### MP-034 `subpackages/organizations/detail/index` 机构详情

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/listings` | `listMyListings` | Y | Listings（挂牌） | 小程序端挂牌查询列表 |
| POST | `/listings` | `createListing` | Y | Listings（挂牌） | 小程序端挂牌提交 |
| GET | `/listings/{listingId}` | `getListingById` | Y | Listings（挂牌） | 小程序端挂牌查询详情 |
| PATCH | `/listings/{listingId}` | `updateListing` | Y | Listings（挂牌） | 小程序端挂牌更新 |
| POST | `/listings/{listingId}/comments` | `createListingComment` | Y | Comments（评论） | 小程序端挂牌/评论提交 |
| POST | `/listings/{listingId}/consultations` | `createListingConsultation` | Y | Listings（挂牌） | 小程序端挂牌/咨询提交 |
| POST | `/listings/{listingId}/conversations` | `upsertListingConversation` | Y | Messaging（消息会话） | 小程序端挂牌/会话提交 |
| POST | `/listings/{listingId}/favorites` | `favoriteListing` | Y | Listings（挂牌） | 小程序端挂牌/收藏提交 |
| DELETE | `/listings/{listingId}/favorites` | `unfavoriteListing` | Y | Listings（挂牌） | 小程序端挂牌/收藏删除 |
| POST | `/listings/{listingId}/off-shelf` | `offShelfListing` | Y | Listings（挂牌） | 小程序端挂牌/下架提交 |
| POST | `/listings/{listingId}/submit` | `submitListing` | Y | Listings（挂牌） | 小程序端挂牌提交 |
| GET | `/me/favorites` | `listMyFavoriteListings` | Y | Listings（挂牌） | 小程序端收藏查询列表 |
| GET | `/me/patent-claims` | `listMyPatentClaims` | Y | Patents（专利） | 小程序端专利认领查询列表 |
| POST | `/me/patent-claims` | `createMyPatentClaim` | Y | Patents（专利） | 小程序端专利认领提交 |
| GET | `/me/patent-maintenance/orders` | `listMyPatentMaintenanceOrders` | Y | Maintenance（专利维保） | 小程序端专利维保/订单查询列表 |
| POST | `/me/patent-maintenance/orders` | `createMyPatentMaintenanceOrder` | Y | Maintenance（专利维保） | 小程序端专利维保/订单提交 |
| GET | `/me/patent-maintenance/orders/{orderId}` | `getMyPatentMaintenanceOrder` | Y | Maintenance（专利维保） | 小程序端专利维保/订单查询详情 |
| GET | `/me/patent-maintenance/orders/{orderId}/events` | `listMyPatentMaintenanceOrderEvents` | Y | Maintenance（专利维保） | 小程序端专利维保/订单/事件查询列表 |
| GET | `/me/patent-maintenance/schedules` | `listMyPatentMaintenanceSchedules` | Y | Maintenance（专利维保） | 小程序端专利维保/日程查询列表 |
| GET | `/me/patent-maintenance/tasks` | `listMyPatentMaintenanceTasks` | Y | Maintenance（专利维保） | 小程序端专利维保/任务查询列表 |
| GET | `/me/recommendations/listings` | `getMyRecommendedListings` | Y | Search（检索） | 小程序端推荐/挂牌查询列表 |
| POST | `/patent-maintenance/orders/{orderId}/conversations` | `upsertMaintenanceOrderConversation` | Y | Messaging（消息会话）, Maintenance（专利维保） | 小程序端专利维保/订单/会话提交 |
| POST | `/patents/normalize` | `normalizePatentNumber` | N | Patents（专利） | 小程序端专利/规范化提交 |
| GET | `/patents/{patentId}` | `getPatentById` | Y | Patents（专利） | 小程序端专利查询详情 |
| GET | `/public/config/home-announcements` | `getPublicHomeAnnouncementsFeed` | N | Config（配置） | 小程序端配置/首页公告查询列表 |
| GET | `/public/listings/{listingId}` | `getPublicListingById` | N | Listings（挂牌） | 小程序端挂牌查询详情 |
| GET | `/public/listings/{listingId}/comments` | `listPublicListingComments` | N | Comments（评论） | 小程序端挂牌/评论查询列表 |
| GET | `/public/organizations` | `listPublicOrganizations` | N | Organizations（机构） | 小程序端机构查询列表 |
| GET | `/public/organizations/{orgUserId}` | `getPublicOrganizationById` | N | Organizations（机构） | 小程序端机构查询详情 |
| GET | `/public/tech-managers/{techManagerId}` | `getPublicTechManagerById` | N | TechManagers（技术经理） | 小程序端技术经理查询详情 |
| GET | `/search/achievements` | `searchAchievements` | N | Search（检索）, Achievements（成果） | 小程序端成果查询列表 |
| GET | `/search/inventors` | `searchInventorRankings` | N | Search（检索） | 小程序端发明人查询列表 |
| GET | `/search/listings` | `searchListings` | N | Search（检索） | 小程序端挂牌查询列表 |
| GET | `/search/tech-managers` | `searchTechManagers` | N | Search（检索）, TechManagers（技术经理） | 小程序端技术经理查询列表 |
| POST | `/tech-managers/{techManagerId}/conversations` | `upsertTechManagerConversation` | Y | Messaging（消息会话）, TechManagers（技术经理） | 小程序端技术经理/会话提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `AchievementMaturity` | 0 |
| `AchievementSortBy` | 0 |
| `AchievementSummary` | 46 |
| `AiContentType` | 0 |
| `AiParseResult` | 16 |
| `AiParseStatus` | 0 |
| `AuditStatus` | 0 |
| `Comment` | 27 |
| `CommentContentType` | 0 |
| `CommentCreateRequest` | 3 |
| `CommentStatus` | 0 |
| `CommentThread` | 59 |
| `ConsultationRouting` | 0 |
| `ContentSource` | 0 |
| `ContentStatus` | 0 |
| `Conversation` | 19 |
| `ConversationContentType` | 0 |
| `ErrorResponse` | 3 |
| `ExistingLicenseStatus` | 0 |
| `FeaturedLevel` | 0 |
| `InventorRankingItem` | 4 |
| `Jurisdiction` | 0 |
| `LegalStatus` | 0 |
| `LicenseMode` | 0 |
| `Listing` | 112 |
| `ListingConsultationCreated` | 3 |
| `ListingCreateRequest` | 62 |
| `ListingMedia` | 4 |
| `ListingPublic` | 121 |
| `ListingStats` | 4 |
| `ListingStatus` | 0 |
| `ListingSummary` | 65 |
| `ListingTopic` | 0 |
| `ListingUpdateRequest` | 60 |
| `MaintenanceUrgency` | 0 |
| `MoneyFen` | 0 |
| `MyPatentMaintenanceSchedule` | 16 |
| `MyPatentMaintenanceTask` | 24 |
| `OrganizationStats` | 2 |
| `OrganizationSummary` | 17 |
| `PageMeta` | 3 |
| `PagedAchievementSummary` | 54 |
| `PagedCommentThread` | 67 |
| `PagedInventorRanking` | 12 |
| `PagedListing` | 121 |
| `PagedListingSummary` | 73 |
| `PagedMyPatentMaintenanceOrder` | 46 |
| `PagedMyPatentMaintenanceSchedule` | 25 |
| `PagedMyPatentMaintenanceTask` | 33 |
| `PagedOrganizationSummary` | 25 |
| `PagedPatentClaimRequest` | 27 |
| `PagedTechManagerSummary` | 27 |
| `Patent` | 71 |
| `PatentClaimCreateRequest` | 6 |
| `PatentClaimRequest` | 19 |
| `PatentClaimStatus` | 0 |
| `PatentMaintenanceOrder` | 38 |
| `PatentMaintenanceOrderEvent` | 17 |
| `PatentMaintenanceOrderEventList` | 20 |
| `PatentMaintenanceOrderEventType` | 0 |
| `PatentMaintenanceOrderMyCreateRequest` | 2 |
| `PatentMaintenanceOrderStatus` | 0 |
| `PatentMaintenancePaymentChannel` | 0 |
| `PatentMaintenanceReconcileStatus` | 0 |
| `PatentMaintenanceSchedule` | 11 |
| `PatentMaintenanceStatus` | 0 |
| `PatentMaintenanceTask` | 13 |
| `PatentMaintenanceTaskStatus` | 0 |
| `PatentMedia` | 5 |
| `PatentNormalizeRequest` | 1 |
| `PatentNormalizeResponse` | 15 |
| `PatentNumberInputType` | 0 |
| `PatentOwnerClaimSource` | 0 |
| `PatentTradeSnapshot` | 22 |
| `PatentType` | 0 |
| `PledgeStatus` | 0 |
| `PriceType` | 0 |
| `PublicHomeAnnouncementFeed` | 12 |
| `PublicHomeAnnouncementItem` | 8 |
| `SearchQType` | 0 |
| `SortBy` | 0 |
| `SupplyType` | 0 |
| `TechManagerPublic` | 22 |
| `TechManagerSortBy` | 0 |
| `TechManagerStats` | 4 |
| `TechManagerSummary` | 19 |
| `TradeMode` | 0 |
| `UserBrief` | 12 |
| `UserRole` | 0 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### MP-035 `subpackages/inventors/index` 发明人

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/listings` | `listMyListings` | Y | Listings（挂牌） | 小程序端挂牌查询列表 |
| POST | `/listings` | `createListing` | Y | Listings（挂牌） | 小程序端挂牌提交 |
| GET | `/listings/{listingId}` | `getListingById` | Y | Listings（挂牌） | 小程序端挂牌查询详情 |
| PATCH | `/listings/{listingId}` | `updateListing` | Y | Listings（挂牌） | 小程序端挂牌更新 |
| POST | `/listings/{listingId}/comments` | `createListingComment` | Y | Comments（评论） | 小程序端挂牌/评论提交 |
| POST | `/listings/{listingId}/consultations` | `createListingConsultation` | Y | Listings（挂牌） | 小程序端挂牌/咨询提交 |
| POST | `/listings/{listingId}/conversations` | `upsertListingConversation` | Y | Messaging（消息会话） | 小程序端挂牌/会话提交 |
| POST | `/listings/{listingId}/favorites` | `favoriteListing` | Y | Listings（挂牌） | 小程序端挂牌/收藏提交 |
| DELETE | `/listings/{listingId}/favorites` | `unfavoriteListing` | Y | Listings（挂牌） | 小程序端挂牌/收藏删除 |
| POST | `/listings/{listingId}/off-shelf` | `offShelfListing` | Y | Listings（挂牌） | 小程序端挂牌/下架提交 |
| POST | `/listings/{listingId}/submit` | `submitListing` | Y | Listings（挂牌） | 小程序端挂牌提交 |
| GET | `/me/favorites` | `listMyFavoriteListings` | Y | Listings（挂牌） | 小程序端收藏查询列表 |
| GET | `/me/patent-claims` | `listMyPatentClaims` | Y | Patents（专利） | 小程序端专利认领查询列表 |
| POST | `/me/patent-claims` | `createMyPatentClaim` | Y | Patents（专利） | 小程序端专利认领提交 |
| GET | `/me/patent-maintenance/orders` | `listMyPatentMaintenanceOrders` | Y | Maintenance（专利维保） | 小程序端专利维保/订单查询列表 |
| POST | `/me/patent-maintenance/orders` | `createMyPatentMaintenanceOrder` | Y | Maintenance（专利维保） | 小程序端专利维保/订单提交 |
| GET | `/me/patent-maintenance/orders/{orderId}` | `getMyPatentMaintenanceOrder` | Y | Maintenance（专利维保） | 小程序端专利维保/订单查询详情 |
| GET | `/me/patent-maintenance/orders/{orderId}/events` | `listMyPatentMaintenanceOrderEvents` | Y | Maintenance（专利维保） | 小程序端专利维保/订单/事件查询列表 |
| GET | `/me/patent-maintenance/schedules` | `listMyPatentMaintenanceSchedules` | Y | Maintenance（专利维保） | 小程序端专利维保/日程查询列表 |
| GET | `/me/patent-maintenance/tasks` | `listMyPatentMaintenanceTasks` | Y | Maintenance（专利维保） | 小程序端专利维保/任务查询列表 |
| GET | `/me/recommendations/listings` | `getMyRecommendedListings` | Y | Search（检索） | 小程序端推荐/挂牌查询列表 |
| POST | `/patent-maintenance/orders/{orderId}/conversations` | `upsertMaintenanceOrderConversation` | Y | Messaging（消息会话）, Maintenance（专利维保） | 小程序端专利维保/订单/会话提交 |
| POST | `/patents/normalize` | `normalizePatentNumber` | N | Patents（专利） | 小程序端专利/规范化提交 |
| GET | `/patents/{patentId}` | `getPatentById` | Y | Patents（专利） | 小程序端专利查询详情 |
| GET | `/public/config/home-announcements` | `getPublicHomeAnnouncementsFeed` | N | Config（配置） | 小程序端配置/首页公告查询列表 |
| GET | `/public/listings/{listingId}` | `getPublicListingById` | N | Listings（挂牌） | 小程序端挂牌查询详情 |
| GET | `/public/listings/{listingId}/comments` | `listPublicListingComments` | N | Comments（评论） | 小程序端挂牌/评论查询列表 |
| GET | `/public/organizations` | `listPublicOrganizations` | N | Organizations（机构） | 小程序端机构查询列表 |
| GET | `/public/organizations/{orgUserId}` | `getPublicOrganizationById` | N | Organizations（机构） | 小程序端机构查询详情 |
| GET | `/public/tech-managers/{techManagerId}` | `getPublicTechManagerById` | N | TechManagers（技术经理） | 小程序端技术经理查询详情 |
| GET | `/search/achievements` | `searchAchievements` | N | Search（检索）, Achievements（成果） | 小程序端成果查询列表 |
| GET | `/search/inventors` | `searchInventorRankings` | N | Search（检索） | 小程序端发明人查询列表 |
| GET | `/search/listings` | `searchListings` | N | Search（检索） | 小程序端挂牌查询列表 |
| GET | `/search/tech-managers` | `searchTechManagers` | N | Search（检索）, TechManagers（技术经理） | 小程序端技术经理查询列表 |
| POST | `/tech-managers/{techManagerId}/conversations` | `upsertTechManagerConversation` | Y | Messaging（消息会话）, TechManagers（技术经理） | 小程序端技术经理/会话提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `AchievementMaturity` | 0 |
| `AchievementSortBy` | 0 |
| `AchievementSummary` | 46 |
| `AiContentType` | 0 |
| `AiParseResult` | 16 |
| `AiParseStatus` | 0 |
| `AuditStatus` | 0 |
| `Comment` | 27 |
| `CommentContentType` | 0 |
| `CommentCreateRequest` | 3 |
| `CommentStatus` | 0 |
| `CommentThread` | 59 |
| `ConsultationRouting` | 0 |
| `ContentSource` | 0 |
| `ContentStatus` | 0 |
| `Conversation` | 19 |
| `ConversationContentType` | 0 |
| `ErrorResponse` | 3 |
| `ExistingLicenseStatus` | 0 |
| `FeaturedLevel` | 0 |
| `InventorRankingItem` | 4 |
| `Jurisdiction` | 0 |
| `LegalStatus` | 0 |
| `LicenseMode` | 0 |
| `Listing` | 112 |
| `ListingConsultationCreated` | 3 |
| `ListingCreateRequest` | 62 |
| `ListingMedia` | 4 |
| `ListingPublic` | 121 |
| `ListingStats` | 4 |
| `ListingStatus` | 0 |
| `ListingSummary` | 65 |
| `ListingTopic` | 0 |
| `ListingUpdateRequest` | 60 |
| `MaintenanceUrgency` | 0 |
| `MoneyFen` | 0 |
| `MyPatentMaintenanceSchedule` | 16 |
| `MyPatentMaintenanceTask` | 24 |
| `OrganizationStats` | 2 |
| `OrganizationSummary` | 17 |
| `PageMeta` | 3 |
| `PagedAchievementSummary` | 54 |
| `PagedCommentThread` | 67 |
| `PagedInventorRanking` | 12 |
| `PagedListing` | 121 |
| `PagedListingSummary` | 73 |
| `PagedMyPatentMaintenanceOrder` | 46 |
| `PagedMyPatentMaintenanceSchedule` | 25 |
| `PagedMyPatentMaintenanceTask` | 33 |
| `PagedOrganizationSummary` | 25 |
| `PagedPatentClaimRequest` | 27 |
| `PagedTechManagerSummary` | 27 |
| `Patent` | 71 |
| `PatentClaimCreateRequest` | 6 |
| `PatentClaimRequest` | 19 |
| `PatentClaimStatus` | 0 |
| `PatentMaintenanceOrder` | 38 |
| `PatentMaintenanceOrderEvent` | 17 |
| `PatentMaintenanceOrderEventList` | 20 |
| `PatentMaintenanceOrderEventType` | 0 |
| `PatentMaintenanceOrderMyCreateRequest` | 2 |
| `PatentMaintenanceOrderStatus` | 0 |
| `PatentMaintenancePaymentChannel` | 0 |
| `PatentMaintenanceReconcileStatus` | 0 |
| `PatentMaintenanceSchedule` | 11 |
| `PatentMaintenanceStatus` | 0 |
| `PatentMaintenanceTask` | 13 |
| `PatentMaintenanceTaskStatus` | 0 |
| `PatentMedia` | 5 |
| `PatentNormalizeRequest` | 1 |
| `PatentNormalizeResponse` | 15 |
| `PatentNumberInputType` | 0 |
| `PatentOwnerClaimSource` | 0 |
| `PatentTradeSnapshot` | 22 |
| `PatentType` | 0 |
| `PledgeStatus` | 0 |
| `PriceType` | 0 |
| `PublicHomeAnnouncementFeed` | 12 |
| `PublicHomeAnnouncementItem` | 8 |
| `SearchQType` | 0 |
| `SortBy` | 0 |
| `SupplyType` | 0 |
| `TechManagerPublic` | 22 |
| `TechManagerSortBy` | 0 |
| `TechManagerStats` | 4 |
| `TechManagerSummary` | 19 |
| `TradeMode` | 0 |
| `UserBrief` | 12 |
| `UserRole` | 0 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### MP-036 `subpackages/patent-map/index` 专利地图

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/search/patent-map/overview` | `searchPatentMapOverview` | N | Search（检索） | 小程序端专利地图/概览查询列表 |
| GET | `/search/patent-map/regions/{regionCode}` | `searchPatentMapRegionDetail` | N | Search（检索） | 小程序端专利地图/地区查询详情 |

| Schema | 字段数（全量展开） |
|---|---|
| `ErrorResponse` | 3 |
| `FeaturedLevel` | 0 |
| `PageMeta` | 3 |
| `PatentMapDataScope` | 0 |
| `PatentMapOverviewRegionLevel` | 0 |
| `PatentMapOverviewResponse` | 46 |
| `PatentMapOverviewSummary` | 7 |
| `PatentMapRegionDetailItem` | 24 |
| `PatentMapRegionDetailRegion` | 8 |
| `PatentMapRegionDetailResponse` | 53 |
| `PatentMapRegionDetailSummary` | 5 |
| `PatentMapRegionItem` | 12 |
| `PatentMapRegionLevel` | 0 |
| `PatentType` | 0 |
| `PriceType` | 0 |
| `TradeMode` | 0 |
| `Uuid` | 0 |

#### MP-037 `subpackages/tech-managers/detail/index` 技术经理详情

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/listings` | `listMyListings` | Y | Listings（挂牌） | 小程序端挂牌查询列表 |
| POST | `/listings` | `createListing` | Y | Listings（挂牌） | 小程序端挂牌提交 |
| GET | `/listings/{listingId}` | `getListingById` | Y | Listings（挂牌） | 小程序端挂牌查询详情 |
| PATCH | `/listings/{listingId}` | `updateListing` | Y | Listings（挂牌） | 小程序端挂牌更新 |
| POST | `/listings/{listingId}/comments` | `createListingComment` | Y | Comments（评论） | 小程序端挂牌/评论提交 |
| POST | `/listings/{listingId}/consultations` | `createListingConsultation` | Y | Listings（挂牌） | 小程序端挂牌/咨询提交 |
| POST | `/listings/{listingId}/conversations` | `upsertListingConversation` | Y | Messaging（消息会话） | 小程序端挂牌/会话提交 |
| POST | `/listings/{listingId}/favorites` | `favoriteListing` | Y | Listings（挂牌） | 小程序端挂牌/收藏提交 |
| DELETE | `/listings/{listingId}/favorites` | `unfavoriteListing` | Y | Listings（挂牌） | 小程序端挂牌/收藏删除 |
| POST | `/listings/{listingId}/off-shelf` | `offShelfListing` | Y | Listings（挂牌） | 小程序端挂牌/下架提交 |
| POST | `/listings/{listingId}/submit` | `submitListing` | Y | Listings（挂牌） | 小程序端挂牌提交 |
| GET | `/me/favorites` | `listMyFavoriteListings` | Y | Listings（挂牌） | 小程序端收藏查询列表 |
| GET | `/me/patent-claims` | `listMyPatentClaims` | Y | Patents（专利） | 小程序端专利认领查询列表 |
| POST | `/me/patent-claims` | `createMyPatentClaim` | Y | Patents（专利） | 小程序端专利认领提交 |
| GET | `/me/patent-maintenance/orders` | `listMyPatentMaintenanceOrders` | Y | Maintenance（专利维保） | 小程序端专利维保/订单查询列表 |
| POST | `/me/patent-maintenance/orders` | `createMyPatentMaintenanceOrder` | Y | Maintenance（专利维保） | 小程序端专利维保/订单提交 |
| GET | `/me/patent-maintenance/orders/{orderId}` | `getMyPatentMaintenanceOrder` | Y | Maintenance（专利维保） | 小程序端专利维保/订单查询详情 |
| GET | `/me/patent-maintenance/orders/{orderId}/events` | `listMyPatentMaintenanceOrderEvents` | Y | Maintenance（专利维保） | 小程序端专利维保/订单/事件查询列表 |
| GET | `/me/patent-maintenance/schedules` | `listMyPatentMaintenanceSchedules` | Y | Maintenance（专利维保） | 小程序端专利维保/日程查询列表 |
| GET | `/me/patent-maintenance/tasks` | `listMyPatentMaintenanceTasks` | Y | Maintenance（专利维保） | 小程序端专利维保/任务查询列表 |
| GET | `/me/recommendations/listings` | `getMyRecommendedListings` | Y | Search（检索） | 小程序端推荐/挂牌查询列表 |
| POST | `/patent-maintenance/orders/{orderId}/conversations` | `upsertMaintenanceOrderConversation` | Y | Messaging（消息会话）, Maintenance（专利维保） | 小程序端专利维保/订单/会话提交 |
| POST | `/patents/normalize` | `normalizePatentNumber` | N | Patents（专利） | 小程序端专利/规范化提交 |
| GET | `/patents/{patentId}` | `getPatentById` | Y | Patents（专利） | 小程序端专利查询详情 |
| GET | `/public/config/home-announcements` | `getPublicHomeAnnouncementsFeed` | N | Config（配置） | 小程序端配置/首页公告查询列表 |
| GET | `/public/listings/{listingId}` | `getPublicListingById` | N | Listings（挂牌） | 小程序端挂牌查询详情 |
| GET | `/public/listings/{listingId}/comments` | `listPublicListingComments` | N | Comments（评论） | 小程序端挂牌/评论查询列表 |
| GET | `/public/organizations` | `listPublicOrganizations` | N | Organizations（机构） | 小程序端机构查询列表 |
| GET | `/public/organizations/{orgUserId}` | `getPublicOrganizationById` | N | Organizations（机构） | 小程序端机构查询详情 |
| GET | `/public/tech-managers/{techManagerId}` | `getPublicTechManagerById` | N | TechManagers（技术经理） | 小程序端技术经理查询详情 |
| GET | `/search/achievements` | `searchAchievements` | N | Search（检索）, Achievements（成果） | 小程序端成果查询列表 |
| GET | `/search/inventors` | `searchInventorRankings` | N | Search（检索） | 小程序端发明人查询列表 |
| GET | `/search/listings` | `searchListings` | N | Search（检索） | 小程序端挂牌查询列表 |
| GET | `/search/tech-managers` | `searchTechManagers` | N | Search（检索）, TechManagers（技术经理） | 小程序端技术经理查询列表 |
| POST | `/tech-managers/{techManagerId}/conversations` | `upsertTechManagerConversation` | Y | Messaging（消息会话）, TechManagers（技术经理） | 小程序端技术经理/会话提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `AchievementMaturity` | 0 |
| `AchievementSortBy` | 0 |
| `AchievementSummary` | 46 |
| `AiContentType` | 0 |
| `AiParseResult` | 16 |
| `AiParseStatus` | 0 |
| `AuditStatus` | 0 |
| `Comment` | 27 |
| `CommentContentType` | 0 |
| `CommentCreateRequest` | 3 |
| `CommentStatus` | 0 |
| `CommentThread` | 59 |
| `ConsultationRouting` | 0 |
| `ContentSource` | 0 |
| `ContentStatus` | 0 |
| `Conversation` | 19 |
| `ConversationContentType` | 0 |
| `ErrorResponse` | 3 |
| `ExistingLicenseStatus` | 0 |
| `FeaturedLevel` | 0 |
| `InventorRankingItem` | 4 |
| `Jurisdiction` | 0 |
| `LegalStatus` | 0 |
| `LicenseMode` | 0 |
| `Listing` | 112 |
| `ListingConsultationCreated` | 3 |
| `ListingCreateRequest` | 62 |
| `ListingMedia` | 4 |
| `ListingPublic` | 121 |
| `ListingStats` | 4 |
| `ListingStatus` | 0 |
| `ListingSummary` | 65 |
| `ListingTopic` | 0 |
| `ListingUpdateRequest` | 60 |
| `MaintenanceUrgency` | 0 |
| `MoneyFen` | 0 |
| `MyPatentMaintenanceSchedule` | 16 |
| `MyPatentMaintenanceTask` | 24 |
| `OrganizationStats` | 2 |
| `OrganizationSummary` | 17 |
| `PageMeta` | 3 |
| `PagedAchievementSummary` | 54 |
| `PagedCommentThread` | 67 |
| `PagedInventorRanking` | 12 |
| `PagedListing` | 121 |
| `PagedListingSummary` | 73 |
| `PagedMyPatentMaintenanceOrder` | 46 |
| `PagedMyPatentMaintenanceSchedule` | 25 |
| `PagedMyPatentMaintenanceTask` | 33 |
| `PagedOrganizationSummary` | 25 |
| `PagedPatentClaimRequest` | 27 |
| `PagedTechManagerSummary` | 27 |
| `Patent` | 71 |
| `PatentClaimCreateRequest` | 6 |
| `PatentClaimRequest` | 19 |
| `PatentClaimStatus` | 0 |
| `PatentMaintenanceOrder` | 38 |
| `PatentMaintenanceOrderEvent` | 17 |
| `PatentMaintenanceOrderEventList` | 20 |
| `PatentMaintenanceOrderEventType` | 0 |
| `PatentMaintenanceOrderMyCreateRequest` | 2 |
| `PatentMaintenanceOrderStatus` | 0 |
| `PatentMaintenancePaymentChannel` | 0 |
| `PatentMaintenanceReconcileStatus` | 0 |
| `PatentMaintenanceSchedule` | 11 |
| `PatentMaintenanceStatus` | 0 |
| `PatentMaintenanceTask` | 13 |
| `PatentMaintenanceTaskStatus` | 0 |
| `PatentMedia` | 5 |
| `PatentNormalizeRequest` | 1 |
| `PatentNormalizeResponse` | 15 |
| `PatentNumberInputType` | 0 |
| `PatentOwnerClaimSource` | 0 |
| `PatentTradeSnapshot` | 22 |
| `PatentType` | 0 |
| `PledgeStatus` | 0 |
| `PriceType` | 0 |
| `PublicHomeAnnouncementFeed` | 12 |
| `PublicHomeAnnouncementItem` | 8 |
| `SearchQType` | 0 |
| `SortBy` | 0 |
| `SupplyType` | 0 |
| `TechManagerPublic` | 22 |
| `TechManagerSortBy` | 0 |
| `TechManagerStats` | 4 |
| `TechManagerSummary` | 19 |
| `TradeMode` | 0 |
| `UserBrief` | 12 |
| `UserRole` | 0 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### MP-038 `subpackages/trade-rules/index` trade规则（交易规则）

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/public/config/trade-rules` | `getPublicTradeRulesConfig` | N | Config（配置） | 小程序端配置/交易规则查询列表 |

| Schema | 字段数（全量展开） |
|---|---|
| `ErrorResponse` | 3 |
| `MoneyFen` | 0 |
| `PayoutCondition` | 0 |
| `PayoutMethod` | 0 |
| `TradeRulesConfig` | 22 |

#### MP-039 `subpackages/contracts/index` 合同

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/contracts` | `listContracts` | Y | Contracts（合同） | 小程序端合同查询列表 |
| POST | `/contracts/{contractId}/upload` | `uploadContractPdf` | Y | Contracts（合同） | 小程序端合同/上传提交 |
| GET | `/invoices` | `listMyInvoices` | Y | Invoices（发票） | 小程序端发票查询列表 |
| GET | `/orders` | `listMyOrders` | Y | Orders（订单） | 小程序端订单查询列表 |
| POST | `/orders` | `createOrder` | Y | Orders（订单） | 小程序端订单提交 |
| GET | `/orders/{orderId}` | `getOrderById` | Y | Orders（订单） | 小程序端订单查询详情 |
| GET | `/orders/{orderId}/case` | `getOrderCase` | Y | Cases（工单） | 小程序端订单/工单查询列表 |
| GET | `/orders/{orderId}/invoice` | `getOrderInvoice` | Y | Invoices（发票） | 小程序端订单/发票查询列表 |
| POST | `/orders/{orderId}/invoice-requests` | `requestOrderInvoice` | Y | Invoices（发票） | 小程序端订单/发票请求提交 |
| POST | `/orders/{orderId}/payment-intents` | `createPaymentIntent` | Y | Payments（支付） | 小程序端订单/支付支付意图提交 |
| GET | `/orders/{orderId}/refund-requests` | `listRefundRequestsByOrder` | Y | Refunds（退款） | 小程序端订单/退款请求查询列表 |
| POST | `/orders/{orderId}/refund-requests` | `createRefundRequest` | Y | Refunds（退款） | 小程序端订单/退款请求提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `CaseStatus` | 0 |
| `CaseType` | 0 |
| `CaseWithMilestones` | 20 |
| `ContractItem` | 13 |
| `ContractStatus` | 0 |
| `ContractUploadRequest` | 0 |
| `ErrorResponse` | 3 |
| `FileObject` | 7 |
| `InvoiceItem` | 53 |
| `InvoiceRequestResult` | 4 |
| `InvoiceStatus` | 0 |
| `Milestone` | 7 |
| `MilestoneName` | 0 |
| `MilestoneStatus` | 0 |
| `MoneyFen` | 0 |
| `Order` | 44 |
| `OrderInvoice` | 18 |
| `OrderListRole` | 0 |
| `OrderStatus` | 0 |
| `OrderStatusGroup` | 0 |
| `PageMeta` | 3 |
| `PagedContract` | 21 |
| `PagedInvoiceItem` | 62 |
| `PagedOrder` | 52 |
| `PayType` | 0 |
| `PaymentIntentResponse` | 13 |
| `RefundReasonCode` | 0 |
| `RefundRequest` | 11 |
| `RefundRequestCreate` | 6 |
| `RefundRequestStatus` | 0 |
| `Uuid` | 0 |

#### MP-040 `subpackages/invoices/index` 发票

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/contracts` | `listContracts` | Y | Contracts（合同） | 小程序端合同查询列表 |
| POST | `/contracts/{contractId}/upload` | `uploadContractPdf` | Y | Contracts（合同） | 小程序端合同/上传提交 |
| GET | `/invoices` | `listMyInvoices` | Y | Invoices（发票） | 小程序端发票查询列表 |
| GET | `/orders` | `listMyOrders` | Y | Orders（订单） | 小程序端订单查询列表 |
| POST | `/orders` | `createOrder` | Y | Orders（订单） | 小程序端订单提交 |
| GET | `/orders/{orderId}` | `getOrderById` | Y | Orders（订单） | 小程序端订单查询详情 |
| GET | `/orders/{orderId}/case` | `getOrderCase` | Y | Cases（工单） | 小程序端订单/工单查询列表 |
| GET | `/orders/{orderId}/invoice` | `getOrderInvoice` | Y | Invoices（发票） | 小程序端订单/发票查询列表 |
| POST | `/orders/{orderId}/invoice-requests` | `requestOrderInvoice` | Y | Invoices（发票） | 小程序端订单/发票请求提交 |
| POST | `/orders/{orderId}/payment-intents` | `createPaymentIntent` | Y | Payments（支付） | 小程序端订单/支付支付意图提交 |
| GET | `/orders/{orderId}/refund-requests` | `listRefundRequestsByOrder` | Y | Refunds（退款） | 小程序端订单/退款请求查询列表 |
| POST | `/orders/{orderId}/refund-requests` | `createRefundRequest` | Y | Refunds（退款） | 小程序端订单/退款请求提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `CaseStatus` | 0 |
| `CaseType` | 0 |
| `CaseWithMilestones` | 20 |
| `ContractItem` | 13 |
| `ContractStatus` | 0 |
| `ContractUploadRequest` | 0 |
| `ErrorResponse` | 3 |
| `FileObject` | 7 |
| `InvoiceItem` | 53 |
| `InvoiceRequestResult` | 4 |
| `InvoiceStatus` | 0 |
| `Milestone` | 7 |
| `MilestoneName` | 0 |
| `MilestoneStatus` | 0 |
| `MoneyFen` | 0 |
| `Order` | 44 |
| `OrderInvoice` | 18 |
| `OrderListRole` | 0 |
| `OrderStatus` | 0 |
| `OrderStatusGroup` | 0 |
| `PageMeta` | 3 |
| `PagedContract` | 21 |
| `PagedInvoiceItem` | 62 |
| `PagedOrder` | 52 |
| `PayType` | 0 |
| `PaymentIntentResponse` | 13 |
| `RefundReasonCode` | 0 |
| `RefundRequest` | 11 |
| `RefundRequestCreate` | 6 |
| `RefundRequestStatus` | 0 |
| `Uuid` | 0 |

#### MP-041 `subpackages/addresses/index` 地址

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/contracts` | `listContracts` | Y | Contracts（合同） | 小程序端合同查询列表 |
| POST | `/contracts/{contractId}/upload` | `uploadContractPdf` | Y | Contracts（合同） | 小程序端合同/上传提交 |
| GET | `/invoices` | `listMyInvoices` | Y | Invoices（发票） | 小程序端发票查询列表 |
| GET | `/orders` | `listMyOrders` | Y | Orders（订单） | 小程序端订单查询列表 |
| POST | `/orders` | `createOrder` | Y | Orders（订单） | 小程序端订单提交 |
| GET | `/orders/{orderId}` | `getOrderById` | Y | Orders（订单） | 小程序端订单查询详情 |
| GET | `/orders/{orderId}/case` | `getOrderCase` | Y | Cases（工单） | 小程序端订单/工单查询列表 |
| GET | `/orders/{orderId}/invoice` | `getOrderInvoice` | Y | Invoices（发票） | 小程序端订单/发票查询列表 |
| POST | `/orders/{orderId}/invoice-requests` | `requestOrderInvoice` | Y | Invoices（发票） | 小程序端订单/发票请求提交 |
| POST | `/orders/{orderId}/payment-intents` | `createPaymentIntent` | Y | Payments（支付） | 小程序端订单/支付支付意图提交 |
| GET | `/orders/{orderId}/refund-requests` | `listRefundRequestsByOrder` | Y | Refunds（退款） | 小程序端订单/退款请求查询列表 |
| POST | `/orders/{orderId}/refund-requests` | `createRefundRequest` | Y | Refunds（退款） | 小程序端订单/退款请求提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `CaseStatus` | 0 |
| `CaseType` | 0 |
| `CaseWithMilestones` | 20 |
| `ContractItem` | 13 |
| `ContractStatus` | 0 |
| `ContractUploadRequest` | 0 |
| `ErrorResponse` | 3 |
| `FileObject` | 7 |
| `InvoiceItem` | 53 |
| `InvoiceRequestResult` | 4 |
| `InvoiceStatus` | 0 |
| `Milestone` | 7 |
| `MilestoneName` | 0 |
| `MilestoneStatus` | 0 |
| `MoneyFen` | 0 |
| `Order` | 44 |
| `OrderInvoice` | 18 |
| `OrderListRole` | 0 |
| `OrderStatus` | 0 |
| `OrderStatusGroup` | 0 |
| `PageMeta` | 3 |
| `PagedContract` | 21 |
| `PagedInvoiceItem` | 62 |
| `PagedOrder` | 52 |
| `PayType` | 0 |
| `PaymentIntentResponse` | 13 |
| `RefundReasonCode` | 0 |
| `RefundRequest` | 11 |
| `RefundRequestCreate` | 6 |
| `RefundRequestStatus` | 0 |
| `Uuid` | 0 |

#### MP-042 `subpackages/addresses/edit/index` 地址编辑

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/contracts` | `listContracts` | Y | Contracts（合同） | 小程序端合同查询列表 |
| POST | `/contracts/{contractId}/upload` | `uploadContractPdf` | Y | Contracts（合同） | 小程序端合同/上传提交 |
| GET | `/invoices` | `listMyInvoices` | Y | Invoices（发票） | 小程序端发票查询列表 |
| GET | `/orders` | `listMyOrders` | Y | Orders（订单） | 小程序端订单查询列表 |
| POST | `/orders` | `createOrder` | Y | Orders（订单） | 小程序端订单提交 |
| GET | `/orders/{orderId}` | `getOrderById` | Y | Orders（订单） | 小程序端订单查询详情 |
| GET | `/orders/{orderId}/case` | `getOrderCase` | Y | Cases（工单） | 小程序端订单/工单查询列表 |
| GET | `/orders/{orderId}/invoice` | `getOrderInvoice` | Y | Invoices（发票） | 小程序端订单/发票查询列表 |
| POST | `/orders/{orderId}/invoice-requests` | `requestOrderInvoice` | Y | Invoices（发票） | 小程序端订单/发票请求提交 |
| POST | `/orders/{orderId}/payment-intents` | `createPaymentIntent` | Y | Payments（支付） | 小程序端订单/支付支付意图提交 |
| GET | `/orders/{orderId}/refund-requests` | `listRefundRequestsByOrder` | Y | Refunds（退款） | 小程序端订单/退款请求查询列表 |
| POST | `/orders/{orderId}/refund-requests` | `createRefundRequest` | Y | Refunds（退款） | 小程序端订单/退款请求提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `CaseStatus` | 0 |
| `CaseType` | 0 |
| `CaseWithMilestones` | 20 |
| `ContractItem` | 13 |
| `ContractStatus` | 0 |
| `ContractUploadRequest` | 0 |
| `ErrorResponse` | 3 |
| `FileObject` | 7 |
| `InvoiceItem` | 53 |
| `InvoiceRequestResult` | 4 |
| `InvoiceStatus` | 0 |
| `Milestone` | 7 |
| `MilestoneName` | 0 |
| `MilestoneStatus` | 0 |
| `MoneyFen` | 0 |
| `Order` | 44 |
| `OrderInvoice` | 18 |
| `OrderListRole` | 0 |
| `OrderStatus` | 0 |
| `OrderStatusGroup` | 0 |
| `PageMeta` | 3 |
| `PagedContract` | 21 |
| `PagedInvoiceItem` | 62 |
| `PagedOrder` | 52 |
| `PayType` | 0 |
| `PaymentIntentResponse` | 13 |
| `RefundReasonCode` | 0 |
| `RefundRequest` | 11 |
| `RefundRequestCreate` | 6 |
| `RefundRequestStatus` | 0 |
| `Uuid` | 0 |

#### MP-043 `subpackages/my-listings/index` 我的挂牌

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/listings` | `listMyListings` | Y | Listings（挂牌） | 小程序端挂牌查询列表 |
| POST | `/listings` | `createListing` | Y | Listings（挂牌） | 小程序端挂牌提交 |
| GET | `/listings/{listingId}` | `getListingById` | Y | Listings（挂牌） | 小程序端挂牌查询详情 |
| PATCH | `/listings/{listingId}` | `updateListing` | Y | Listings（挂牌） | 小程序端挂牌更新 |
| POST | `/listings/{listingId}/comments` | `createListingComment` | Y | Comments（评论） | 小程序端挂牌/评论提交 |
| POST | `/listings/{listingId}/consultations` | `createListingConsultation` | Y | Listings（挂牌） | 小程序端挂牌/咨询提交 |
| POST | `/listings/{listingId}/conversations` | `upsertListingConversation` | Y | Messaging（消息会话） | 小程序端挂牌/会话提交 |
| POST | `/listings/{listingId}/favorites` | `favoriteListing` | Y | Listings（挂牌） | 小程序端挂牌/收藏提交 |
| DELETE | `/listings/{listingId}/favorites` | `unfavoriteListing` | Y | Listings（挂牌） | 小程序端挂牌/收藏删除 |
| POST | `/listings/{listingId}/off-shelf` | `offShelfListing` | Y | Listings（挂牌） | 小程序端挂牌/下架提交 |
| POST | `/listings/{listingId}/submit` | `submitListing` | Y | Listings（挂牌） | 小程序端挂牌提交 |
| GET | `/me/favorites` | `listMyFavoriteListings` | Y | Listings（挂牌） | 小程序端收藏查询列表 |
| GET | `/me/patent-claims` | `listMyPatentClaims` | Y | Patents（专利） | 小程序端专利认领查询列表 |
| POST | `/me/patent-claims` | `createMyPatentClaim` | Y | Patents（专利） | 小程序端专利认领提交 |
| GET | `/me/patent-maintenance/orders` | `listMyPatentMaintenanceOrders` | Y | Maintenance（专利维保） | 小程序端专利维保/订单查询列表 |
| POST | `/me/patent-maintenance/orders` | `createMyPatentMaintenanceOrder` | Y | Maintenance（专利维保） | 小程序端专利维保/订单提交 |
| GET | `/me/patent-maintenance/orders/{orderId}` | `getMyPatentMaintenanceOrder` | Y | Maintenance（专利维保） | 小程序端专利维保/订单查询详情 |
| GET | `/me/patent-maintenance/orders/{orderId}/events` | `listMyPatentMaintenanceOrderEvents` | Y | Maintenance（专利维保） | 小程序端专利维保/订单/事件查询列表 |
| GET | `/me/patent-maintenance/schedules` | `listMyPatentMaintenanceSchedules` | Y | Maintenance（专利维保） | 小程序端专利维保/日程查询列表 |
| GET | `/me/patent-maintenance/tasks` | `listMyPatentMaintenanceTasks` | Y | Maintenance（专利维保） | 小程序端专利维保/任务查询列表 |
| GET | `/me/recommendations/listings` | `getMyRecommendedListings` | Y | Search（检索） | 小程序端推荐/挂牌查询列表 |
| POST | `/patent-maintenance/orders/{orderId}/conversations` | `upsertMaintenanceOrderConversation` | Y | Messaging（消息会话）, Maintenance（专利维保） | 小程序端专利维保/订单/会话提交 |
| POST | `/patents/normalize` | `normalizePatentNumber` | N | Patents（专利） | 小程序端专利/规范化提交 |
| GET | `/patents/{patentId}` | `getPatentById` | Y | Patents（专利） | 小程序端专利查询详情 |
| GET | `/public/config/home-announcements` | `getPublicHomeAnnouncementsFeed` | N | Config（配置） | 小程序端配置/首页公告查询列表 |
| GET | `/public/listings/{listingId}` | `getPublicListingById` | N | Listings（挂牌） | 小程序端挂牌查询详情 |
| GET | `/public/listings/{listingId}/comments` | `listPublicListingComments` | N | Comments（评论） | 小程序端挂牌/评论查询列表 |
| GET | `/public/organizations` | `listPublicOrganizations` | N | Organizations（机构） | 小程序端机构查询列表 |
| GET | `/public/organizations/{orgUserId}` | `getPublicOrganizationById` | N | Organizations（机构） | 小程序端机构查询详情 |
| GET | `/public/tech-managers/{techManagerId}` | `getPublicTechManagerById` | N | TechManagers（技术经理） | 小程序端技术经理查询详情 |
| GET | `/search/achievements` | `searchAchievements` | N | Search（检索）, Achievements（成果） | 小程序端成果查询列表 |
| GET | `/search/inventors` | `searchInventorRankings` | N | Search（检索） | 小程序端发明人查询列表 |
| GET | `/search/listings` | `searchListings` | N | Search（检索） | 小程序端挂牌查询列表 |
| GET | `/search/tech-managers` | `searchTechManagers` | N | Search（检索）, TechManagers（技术经理） | 小程序端技术经理查询列表 |
| POST | `/tech-managers/{techManagerId}/conversations` | `upsertTechManagerConversation` | Y | Messaging（消息会话）, TechManagers（技术经理） | 小程序端技术经理/会话提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `AchievementMaturity` | 0 |
| `AchievementSortBy` | 0 |
| `AchievementSummary` | 46 |
| `AiContentType` | 0 |
| `AiParseResult` | 16 |
| `AiParseStatus` | 0 |
| `AuditStatus` | 0 |
| `Comment` | 27 |
| `CommentContentType` | 0 |
| `CommentCreateRequest` | 3 |
| `CommentStatus` | 0 |
| `CommentThread` | 59 |
| `ConsultationRouting` | 0 |
| `ContentSource` | 0 |
| `ContentStatus` | 0 |
| `Conversation` | 19 |
| `ConversationContentType` | 0 |
| `ErrorResponse` | 3 |
| `ExistingLicenseStatus` | 0 |
| `FeaturedLevel` | 0 |
| `InventorRankingItem` | 4 |
| `Jurisdiction` | 0 |
| `LegalStatus` | 0 |
| `LicenseMode` | 0 |
| `Listing` | 112 |
| `ListingConsultationCreated` | 3 |
| `ListingCreateRequest` | 62 |
| `ListingMedia` | 4 |
| `ListingPublic` | 121 |
| `ListingStats` | 4 |
| `ListingStatus` | 0 |
| `ListingSummary` | 65 |
| `ListingTopic` | 0 |
| `ListingUpdateRequest` | 60 |
| `MaintenanceUrgency` | 0 |
| `MoneyFen` | 0 |
| `MyPatentMaintenanceSchedule` | 16 |
| `MyPatentMaintenanceTask` | 24 |
| `OrganizationStats` | 2 |
| `OrganizationSummary` | 17 |
| `PageMeta` | 3 |
| `PagedAchievementSummary` | 54 |
| `PagedCommentThread` | 67 |
| `PagedInventorRanking` | 12 |
| `PagedListing` | 121 |
| `PagedListingSummary` | 73 |
| `PagedMyPatentMaintenanceOrder` | 46 |
| `PagedMyPatentMaintenanceSchedule` | 25 |
| `PagedMyPatentMaintenanceTask` | 33 |
| `PagedOrganizationSummary` | 25 |
| `PagedPatentClaimRequest` | 27 |
| `PagedTechManagerSummary` | 27 |
| `Patent` | 71 |
| `PatentClaimCreateRequest` | 6 |
| `PatentClaimRequest` | 19 |
| `PatentClaimStatus` | 0 |
| `PatentMaintenanceOrder` | 38 |
| `PatentMaintenanceOrderEvent` | 17 |
| `PatentMaintenanceOrderEventList` | 20 |
| `PatentMaintenanceOrderEventType` | 0 |
| `PatentMaintenanceOrderMyCreateRequest` | 2 |
| `PatentMaintenanceOrderStatus` | 0 |
| `PatentMaintenancePaymentChannel` | 0 |
| `PatentMaintenanceReconcileStatus` | 0 |
| `PatentMaintenanceSchedule` | 11 |
| `PatentMaintenanceStatus` | 0 |
| `PatentMaintenanceTask` | 13 |
| `PatentMaintenanceTaskStatus` | 0 |
| `PatentMedia` | 5 |
| `PatentNormalizeRequest` | 1 |
| `PatentNormalizeResponse` | 15 |
| `PatentNumberInputType` | 0 |
| `PatentOwnerClaimSource` | 0 |
| `PatentTradeSnapshot` | 22 |
| `PatentType` | 0 |
| `PledgeStatus` | 0 |
| `PriceType` | 0 |
| `PublicHomeAnnouncementFeed` | 12 |
| `PublicHomeAnnouncementItem` | 8 |
| `SearchQType` | 0 |
| `SortBy` | 0 |
| `SupplyType` | 0 |
| `TechManagerPublic` | 22 |
| `TechManagerSortBy` | 0 |
| `TechManagerStats` | 4 |
| `TechManagerSummary` | 19 |
| `TradeMode` | 0 |
| `UserBrief` | 12 |
| `UserRole` | 0 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### MP-044 `subpackages/my-achievements/index` 我的成果

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/achievements` | `listMyAchievements` | Y | Achievements（成果） | 小程序端成果查询列表 |
| POST | `/achievements` | `createAchievement` | Y | Achievements（成果） | 小程序端成果提交 |
| GET | `/achievements/{achievementId}` | `getMyAchievementById` | Y | Achievements（成果） | 小程序端成果查询详情 |
| PATCH | `/achievements/{achievementId}` | `updateMyAchievement` | Y | Achievements（成果） | 小程序端成果更新 |
| POST | `/achievements/{achievementId}/comments` | `createAchievementComment` | Y | Comments（评论）, Achievements（成果） | 小程序端成果/评论提交 |
| POST | `/achievements/{achievementId}/consultations` | `createAchievementConsultation` | Y | Achievements（成果） | 小程序端成果/咨询提交 |
| POST | `/achievements/{achievementId}/conversations` | `upsertAchievementConversation` | Y | Messaging（消息会话）, Achievements（成果） | 小程序端成果/会话提交 |
| POST | `/achievements/{achievementId}/favorites` | `favoriteAchievement` | Y | Achievements（成果） | 小程序端成果/收藏提交 |
| DELETE | `/achievements/{achievementId}/favorites` | `unfavoriteAchievement` | Y | Achievements（成果） | 小程序端成果/收藏删除 |
| POST | `/achievements/{achievementId}/off-shelf` | `offShelfAchievement` | Y | Achievements（成果） | 小程序端成果/下架提交 |
| POST | `/achievements/{achievementId}/submit` | `submitAchievement` | Y | Achievements（成果） | 小程序端成果提交 |
| GET | `/me/favorites/achievements` | `listMyFavoriteAchievements` | Y | Achievements（成果） | 小程序端收藏/成果查询列表 |
| GET | `/public/achievements/{achievementId}` | `getPublicAchievementById` | N | Achievements（成果） | 小程序端成果查询详情 |
| GET | `/public/achievements/{achievementId}/comments` | `listPublicAchievementComments` | N | Comments（评论）, Achievements（成果） | 小程序端成果/评论查询列表 |
| GET | `/search/achievements` | `searchAchievements` | N | Search（检索）, Achievements（成果） | 小程序端成果查询列表 |

| Schema | 字段数（全量展开） |
|---|---|
| `AchievementCreateRequest` | 22 |
| `AchievementDetail` | 60 |
| `AchievementEdit` | 61 |
| `AchievementMaturity` | 0 |
| `AchievementRecord` | 26 |
| `AchievementSortBy` | 0 |
| `AchievementSummary` | 46 |
| `AchievementUpdateRequest` | 22 |
| `AuditStatus` | 0 |
| `Comment` | 27 |
| `CommentContentType` | 0 |
| `CommentCreateRequest` | 3 |
| `CommentStatus` | 0 |
| `CommentThread` | 59 |
| `ContentMedia` | 9 |
| `ContentMediaInput` | 5 |
| `ContentMediaType` | 0 |
| `ContentSource` | 0 |
| `ContentStatus` | 0 |
| `Conversation` | 19 |
| `ConversationContentType` | 0 |
| `ErrorResponse` | 3 |
| `ListingStats` | 4 |
| `OkResponse` | 1 |
| `OrganizationStats` | 2 |
| `OrganizationSummary` | 17 |
| `PageMeta` | 3 |
| `PagedAchievementSummary` | 54 |
| `PagedCommentThread` | 67 |
| `SupplyType` | 0 |
| `UserBrief` | 12 |
| `UserRole` | 0 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### MP-045 `subpackages/patent-claims/index` 专利认领

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/listings` | `listMyListings` | Y | Listings（挂牌） | 小程序端挂牌查询列表 |
| POST | `/listings` | `createListing` | Y | Listings（挂牌） | 小程序端挂牌提交 |
| GET | `/listings/{listingId}` | `getListingById` | Y | Listings（挂牌） | 小程序端挂牌查询详情 |
| PATCH | `/listings/{listingId}` | `updateListing` | Y | Listings（挂牌） | 小程序端挂牌更新 |
| POST | `/listings/{listingId}/comments` | `createListingComment` | Y | Comments（评论） | 小程序端挂牌/评论提交 |
| POST | `/listings/{listingId}/consultations` | `createListingConsultation` | Y | Listings（挂牌） | 小程序端挂牌/咨询提交 |
| POST | `/listings/{listingId}/conversations` | `upsertListingConversation` | Y | Messaging（消息会话） | 小程序端挂牌/会话提交 |
| POST | `/listings/{listingId}/favorites` | `favoriteListing` | Y | Listings（挂牌） | 小程序端挂牌/收藏提交 |
| DELETE | `/listings/{listingId}/favorites` | `unfavoriteListing` | Y | Listings（挂牌） | 小程序端挂牌/收藏删除 |
| POST | `/listings/{listingId}/off-shelf` | `offShelfListing` | Y | Listings（挂牌） | 小程序端挂牌/下架提交 |
| POST | `/listings/{listingId}/submit` | `submitListing` | Y | Listings（挂牌） | 小程序端挂牌提交 |
| GET | `/me/favorites` | `listMyFavoriteListings` | Y | Listings（挂牌） | 小程序端收藏查询列表 |
| GET | `/me/patent-claims` | `listMyPatentClaims` | Y | Patents（专利） | 小程序端专利认领查询列表 |
| POST | `/me/patent-claims` | `createMyPatentClaim` | Y | Patents（专利） | 小程序端专利认领提交 |
| GET | `/me/patent-maintenance/orders` | `listMyPatentMaintenanceOrders` | Y | Maintenance（专利维保） | 小程序端专利维保/订单查询列表 |
| POST | `/me/patent-maintenance/orders` | `createMyPatentMaintenanceOrder` | Y | Maintenance（专利维保） | 小程序端专利维保/订单提交 |
| GET | `/me/patent-maintenance/orders/{orderId}` | `getMyPatentMaintenanceOrder` | Y | Maintenance（专利维保） | 小程序端专利维保/订单查询详情 |
| GET | `/me/patent-maintenance/orders/{orderId}/events` | `listMyPatentMaintenanceOrderEvents` | Y | Maintenance（专利维保） | 小程序端专利维保/订单/事件查询列表 |
| GET | `/me/patent-maintenance/schedules` | `listMyPatentMaintenanceSchedules` | Y | Maintenance（专利维保） | 小程序端专利维保/日程查询列表 |
| GET | `/me/patent-maintenance/tasks` | `listMyPatentMaintenanceTasks` | Y | Maintenance（专利维保） | 小程序端专利维保/任务查询列表 |
| GET | `/me/recommendations/listings` | `getMyRecommendedListings` | Y | Search（检索） | 小程序端推荐/挂牌查询列表 |
| POST | `/patent-maintenance/orders/{orderId}/conversations` | `upsertMaintenanceOrderConversation` | Y | Messaging（消息会话）, Maintenance（专利维保） | 小程序端专利维保/订单/会话提交 |
| POST | `/patents/normalize` | `normalizePatentNumber` | N | Patents（专利） | 小程序端专利/规范化提交 |
| GET | `/patents/{patentId}` | `getPatentById` | Y | Patents（专利） | 小程序端专利查询详情 |
| GET | `/public/config/home-announcements` | `getPublicHomeAnnouncementsFeed` | N | Config（配置） | 小程序端配置/首页公告查询列表 |
| GET | `/public/listings/{listingId}` | `getPublicListingById` | N | Listings（挂牌） | 小程序端挂牌查询详情 |
| GET | `/public/listings/{listingId}/comments` | `listPublicListingComments` | N | Comments（评论） | 小程序端挂牌/评论查询列表 |
| GET | `/public/organizations` | `listPublicOrganizations` | N | Organizations（机构） | 小程序端机构查询列表 |
| GET | `/public/organizations/{orgUserId}` | `getPublicOrganizationById` | N | Organizations（机构） | 小程序端机构查询详情 |
| GET | `/public/tech-managers/{techManagerId}` | `getPublicTechManagerById` | N | TechManagers（技术经理） | 小程序端技术经理查询详情 |
| GET | `/search/achievements` | `searchAchievements` | N | Search（检索）, Achievements（成果） | 小程序端成果查询列表 |
| GET | `/search/inventors` | `searchInventorRankings` | N | Search（检索） | 小程序端发明人查询列表 |
| GET | `/search/listings` | `searchListings` | N | Search（检索） | 小程序端挂牌查询列表 |
| GET | `/search/tech-managers` | `searchTechManagers` | N | Search（检索）, TechManagers（技术经理） | 小程序端技术经理查询列表 |
| POST | `/tech-managers/{techManagerId}/conversations` | `upsertTechManagerConversation` | Y | Messaging（消息会话）, TechManagers（技术经理） | 小程序端技术经理/会话提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `AchievementMaturity` | 0 |
| `AchievementSortBy` | 0 |
| `AchievementSummary` | 46 |
| `AiContentType` | 0 |
| `AiParseResult` | 16 |
| `AiParseStatus` | 0 |
| `AuditStatus` | 0 |
| `Comment` | 27 |
| `CommentContentType` | 0 |
| `CommentCreateRequest` | 3 |
| `CommentStatus` | 0 |
| `CommentThread` | 59 |
| `ConsultationRouting` | 0 |
| `ContentSource` | 0 |
| `ContentStatus` | 0 |
| `Conversation` | 19 |
| `ConversationContentType` | 0 |
| `ErrorResponse` | 3 |
| `ExistingLicenseStatus` | 0 |
| `FeaturedLevel` | 0 |
| `InventorRankingItem` | 4 |
| `Jurisdiction` | 0 |
| `LegalStatus` | 0 |
| `LicenseMode` | 0 |
| `Listing` | 112 |
| `ListingConsultationCreated` | 3 |
| `ListingCreateRequest` | 62 |
| `ListingMedia` | 4 |
| `ListingPublic` | 121 |
| `ListingStats` | 4 |
| `ListingStatus` | 0 |
| `ListingSummary` | 65 |
| `ListingTopic` | 0 |
| `ListingUpdateRequest` | 60 |
| `MaintenanceUrgency` | 0 |
| `MoneyFen` | 0 |
| `MyPatentMaintenanceSchedule` | 16 |
| `MyPatentMaintenanceTask` | 24 |
| `OrganizationStats` | 2 |
| `OrganizationSummary` | 17 |
| `PageMeta` | 3 |
| `PagedAchievementSummary` | 54 |
| `PagedCommentThread` | 67 |
| `PagedInventorRanking` | 12 |
| `PagedListing` | 121 |
| `PagedListingSummary` | 73 |
| `PagedMyPatentMaintenanceOrder` | 46 |
| `PagedMyPatentMaintenanceSchedule` | 25 |
| `PagedMyPatentMaintenanceTask` | 33 |
| `PagedOrganizationSummary` | 25 |
| `PagedPatentClaimRequest` | 27 |
| `PagedTechManagerSummary` | 27 |
| `Patent` | 71 |
| `PatentClaimCreateRequest` | 6 |
| `PatentClaimRequest` | 19 |
| `PatentClaimStatus` | 0 |
| `PatentMaintenanceOrder` | 38 |
| `PatentMaintenanceOrderEvent` | 17 |
| `PatentMaintenanceOrderEventList` | 20 |
| `PatentMaintenanceOrderEventType` | 0 |
| `PatentMaintenanceOrderMyCreateRequest` | 2 |
| `PatentMaintenanceOrderStatus` | 0 |
| `PatentMaintenancePaymentChannel` | 0 |
| `PatentMaintenanceReconcileStatus` | 0 |
| `PatentMaintenanceSchedule` | 11 |
| `PatentMaintenanceStatus` | 0 |
| `PatentMaintenanceTask` | 13 |
| `PatentMaintenanceTaskStatus` | 0 |
| `PatentMedia` | 5 |
| `PatentNormalizeRequest` | 1 |
| `PatentNormalizeResponse` | 15 |
| `PatentNumberInputType` | 0 |
| `PatentOwnerClaimSource` | 0 |
| `PatentTradeSnapshot` | 22 |
| `PatentType` | 0 |
| `PledgeStatus` | 0 |
| `PriceType` | 0 |
| `PublicHomeAnnouncementFeed` | 12 |
| `PublicHomeAnnouncementItem` | 8 |
| `SearchQType` | 0 |
| `SortBy` | 0 |
| `SupplyType` | 0 |
| `TechManagerPublic` | 22 |
| `TechManagerSortBy` | 0 |
| `TechManagerStats` | 4 |
| `TechManagerSummary` | 19 |
| `TradeMode` | 0 |
| `UserBrief` | 12 |
| `UserRole` | 0 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### MP-046 `subpackages/maintenance/index` 维保

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/achievements` | `listMyAchievements` | Y | Achievements（成果） | 小程序端成果查询列表 |
| POST | `/achievements` | `createAchievement` | Y | Achievements（成果） | 小程序端成果提交 |
| GET | `/achievements/{achievementId}` | `getMyAchievementById` | Y | Achievements（成果） | 小程序端成果查询详情 |
| PATCH | `/achievements/{achievementId}` | `updateMyAchievement` | Y | Achievements（成果） | 小程序端成果更新 |
| POST | `/achievements/{achievementId}/comments` | `createAchievementComment` | Y | Comments（评论）, Achievements（成果） | 小程序端成果/评论提交 |
| POST | `/achievements/{achievementId}/consultations` | `createAchievementConsultation` | Y | Achievements（成果） | 小程序端成果/咨询提交 |
| POST | `/achievements/{achievementId}/off-shelf` | `offShelfAchievement` | Y | Achievements（成果） | 小程序端成果/下架提交 |
| POST | `/achievements/{achievementId}/submit` | `submitAchievement` | Y | Achievements（成果） | 小程序端成果提交 |
| POST | `/ai/agent/query` | `createAiAgentQuery` | N | AI（智能解析） | 小程序端智能/坐席/查询提交 |
| POST | `/ai/parse-results/{parseResultId}/feedback` | `createAiParseFeedback` | Y | AI（智能解析） | 小程序端智能/解析结果/反馈提交 |
| PATCH | `/comments/{commentId}` | `updateComment` | Y | Comments（评论） | 小程序端评论更新 |
| DELETE | `/comments/{commentId}` | `deleteComment` | Y | Comments（评论） | 小程序端评论删除 |
| POST | `/files` | `uploadFile` | Y | Files（文件） | 小程序端文件提交 |
| GET | `/files/{fileId}` | `downloadFile` | Y | Files（文件） | 小程序端文件查询详情 |
| GET | `/files/{fileId}/preview` | `previewFile` | Y | Files（文件） | 小程序端文件/预览查询列表 |
| POST | `/files/{fileId}/temporary-access` | `createFileTemporaryAccess` | Y | Files（文件） | 小程序端文件/临时访问提交 |
| GET | `/health` | `getHealth` | N | System（系统） | 小程序端健康查询列表 |
| GET | `/me` | `getMe` | Y | Users（用户） | 小程序端我的查询列表 |
| PATCH | `/me` | `updateMe` | Y | Users（用户） | 小程序端我的更新 |
| GET | `/public/achievements/{achievementId}` | `getPublicAchievementById` | N | Achievements（成果） | 小程序端成果查询详情 |
| GET | `/public/achievements/{achievementId}/comments` | `listPublicAchievementComments` | N | Comments（评论）, Achievements（成果） | 小程序端成果/评论查询列表 |
| GET | `/public/config/banner` | `getPublicBannerConfig` | N | Config（配置） | 小程序端配置/横幅查询列表 |
| GET | `/public/config/customer-service` | `getPublicCustomerServiceConfig` | N | Config（配置） | 小程序端配置/客户服务查询列表 |
| GET | `/public/industry-tags` | `listPublicIndustryTags` | N | Regions（地区） | 小程序端行业标签查询列表 |
| GET | `/regions` | `listRegions` | N | Regions（地区） | 小程序端地区查询列表 |

| Schema | 字段数（全量展开） |
|---|---|
| `AchievementCreateRequest` | 22 |
| `AchievementDetail` | 60 |
| `AchievementEdit` | 61 |
| `AchievementMaturity` | 0 |
| `AchievementRecord` | 26 |
| `AchievementSummary` | 46 |
| `AchievementUpdateRequest` | 22 |
| `AiAgentInputType` | 0 |
| `AiAgentMatchSummary` | 7 |
| `AiAgentParsedQuery` | 28 |
| `AiAgentQueryRequest` | 11 |
| `AiAgentQueryResult` | 49 |
| `AiContentScope` | 0 |
| `AiContentType` | 0 |
| `AiParseFeedback` | 13 |
| `AiParseFeedbackActorType` | 0 |
| `AiParseFeedbackRequest` | 4 |
| `AiSearchFilters` | 21 |
| `AuditStatus` | 0 |
| `BannerConfig` | 9 |
| `BannerItem` | 6 |
| `Comment` | 27 |
| `CommentContentType` | 0 |
| `CommentCreateRequest` | 3 |
| `CommentStatus` | 0 |
| `CommentThread` | 59 |
| `CommentUpdateRequest` | 1 |
| `ContentMedia` | 9 |
| `ContentMediaInput` | 5 |
| `ContentMediaType` | 0 |
| `ContentSource` | 0 |
| `ContentStatus` | 0 |
| `CooperationMode` | 0 |
| `CustomerServiceConfig` | 2 |
| `ErrorResponse` | 3 |
| `FileObject` | 7 |
| `FilePurpose` | 0 |
| `FileTemporaryAccessRequest` | 4 |
| `FileTemporaryAccessResponse` | 4 |
| `FileTemporaryAccessScope` | 0 |
| `IndustryTag` | 5 |
| `ListingStats` | 4 |
| `MoneyFen` | 0 |
| `OkResponse` | 1 |
| `OrganizationStats` | 2 |
| `OrganizationSummary` | 17 |
| `PageMeta` | 3 |
| `PagedAchievementSummary` | 54 |
| `PagedCommentThread` | 67 |
| `PatentType` | 0 |
| `PhoneNumber` | 0 |
| `PriceType` | 0 |
| `RegionLevel` | 0 |
| `RegionNode` | 10 |
| `SupplyType` | 0 |
| `TradeMode` | 0 |
| `UserBrief` | 12 |
| `UserProfile` | 17 |
| `UserRole` | 0 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### MP-047 `subpackages/settings/notifications/index` 设置通知

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/auth/session` | `authGetSession` | Y | Auth（认证） | 小程序端会话查询列表 |
| POST | `/auth/sms/send` | `authSmsSend` | N | Auth（认证） | 小程序端短信/发送提交 |
| POST | `/auth/sms/verify` | `authSmsVerify` | N | Auth（认证） | 小程序端短信/验证提交 |
| POST | `/auth/wechat/mp-login` | `authWechatMpLogin` | N | Auth（认证） | 小程序端微信/小程序登录提交 |
| POST | `/auth/wechat/phone-bind` | `authWechatPhoneBind` | Y | Auth（认证） | 小程序端微信/手机号绑定提交 |
| GET | `/me/addresses` | `listMyAddresses` | Y | Users（用户） | 小程序端地址查询列表 |
| POST | `/me/addresses` | `createMyAddress` | Y | Users（用户） | 小程序端地址提交 |
| PATCH | `/me/addresses/{addressId}` | `updateMyAddress` | Y | Users（用户） | 小程序端地址更新 |
| DELETE | `/me/addresses/{addressId}` | `deleteMyAddress` | Y | Users（用户） | 小程序端地址删除 |
| GET | `/me/conversations` | `listMyConversations` | Y | Messaging（消息会话） | 小程序端会话查询列表 |
| GET | `/me/favorites/achievements` | `listMyFavoriteAchievements` | Y | Achievements（成果） | 小程序端收藏/成果查询列表 |
| GET | `/me/verification` | `getMyVerification` | Y | Users（用户） | 小程序端认证查询列表 |
| POST | `/me/verification` | `submitMyVerification` | Y | Users（用户） | 小程序端认证提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `AchievementMaturity` | 0 |
| `AchievementSummary` | 46 |
| `Address` | 12 |
| `AddressCreateRequest` | 6 |
| `AddressUpdateRequest` | 6 |
| `AuditStatus` | 0 |
| `AuthSession` | 13 |
| `AuthTokenResponse` | 22 |
| `ContentSource` | 0 |
| `ContentStatus` | 0 |
| `ConversationContentType` | 0 |
| `ConversationSummary` | 33 |
| `ErrorResponse` | 3 |
| `ListingStats` | 4 |
| `ListingTopic` | 0 |
| `OkResponse` | 1 |
| `OrganizationStats` | 2 |
| `OrganizationSummary` | 17 |
| `PageMeta` | 3 |
| `PagedAchievementSummary` | 54 |
| `PagedConversationSummary` | 41 |
| `PhoneNumber` | 0 |
| `SmsPurpose` | 0 |
| `SupplyType` | 0 |
| `UserBrief` | 12 |
| `UserProfile` | 17 |
| `UserRole` | 0 |
| `UserVerification` | 26 |
| `UserVerificationSubmitOrganizationRequest` | 13 |
| `UserVerificationSubmitPersonRequest` | 3 |
| `UserVerificationSubmitRequest` | 34 |
| `UserVerificationSubmitTechManagerRequest` | 12 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### MP-048 `subpackages/about/index` 关于

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/public/config/trade-rules` | `getPublicTradeRulesConfig` | N | Config（配置） | 小程序端配置/交易规则查询列表 |

| Schema | 字段数（全量展开） |
|---|---|
| `ErrorResponse` | 3 |
| `MoneyFen` | 0 |
| `PayoutCondition` | 0 |
| `PayoutMethod` | 0 |
| `TradeRulesConfig` | 22 |

#### MP-049 `subpackages/profile/edit/index` 资料编辑

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/auth/session` | `authGetSession` | Y | Auth（认证） | 小程序端会话查询列表 |
| POST | `/auth/sms/send` | `authSmsSend` | N | Auth（认证） | 小程序端短信/发送提交 |
| POST | `/auth/sms/verify` | `authSmsVerify` | N | Auth（认证） | 小程序端短信/验证提交 |
| POST | `/auth/wechat/mp-login` | `authWechatMpLogin` | N | Auth（认证） | 小程序端微信/小程序登录提交 |
| POST | `/auth/wechat/phone-bind` | `authWechatPhoneBind` | Y | Auth（认证） | 小程序端微信/手机号绑定提交 |
| GET | `/me/addresses` | `listMyAddresses` | Y | Users（用户） | 小程序端地址查询列表 |
| POST | `/me/addresses` | `createMyAddress` | Y | Users（用户） | 小程序端地址提交 |
| PATCH | `/me/addresses/{addressId}` | `updateMyAddress` | Y | Users（用户） | 小程序端地址更新 |
| DELETE | `/me/addresses/{addressId}` | `deleteMyAddress` | Y | Users（用户） | 小程序端地址删除 |
| GET | `/me/conversations` | `listMyConversations` | Y | Messaging（消息会话） | 小程序端会话查询列表 |
| GET | `/me/favorites/achievements` | `listMyFavoriteAchievements` | Y | Achievements（成果） | 小程序端收藏/成果查询列表 |
| GET | `/me/verification` | `getMyVerification` | Y | Users（用户） | 小程序端认证查询列表 |
| POST | `/me/verification` | `submitMyVerification` | Y | Users（用户） | 小程序端认证提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `AchievementMaturity` | 0 |
| `AchievementSummary` | 46 |
| `Address` | 12 |
| `AddressCreateRequest` | 6 |
| `AddressUpdateRequest` | 6 |
| `AuditStatus` | 0 |
| `AuthSession` | 13 |
| `AuthTokenResponse` | 22 |
| `ContentSource` | 0 |
| `ContentStatus` | 0 |
| `ConversationContentType` | 0 |
| `ConversationSummary` | 33 |
| `ErrorResponse` | 3 |
| `ListingStats` | 4 |
| `ListingTopic` | 0 |
| `OkResponse` | 1 |
| `OrganizationStats` | 2 |
| `OrganizationSummary` | 17 |
| `PageMeta` | 3 |
| `PagedAchievementSummary` | 54 |
| `PagedConversationSummary` | 41 |
| `PhoneNumber` | 0 |
| `SmsPurpose` | 0 |
| `SupplyType` | 0 |
| `UserBrief` | 12 |
| `UserProfile` | 17 |
| `UserRole` | 0 |
| `UserVerification` | 26 |
| `UserVerificationSubmitOrganizationRequest` | 13 |
| `UserVerificationSubmitPersonRequest` | 3 |
| `UserVerificationSubmitRequest` | 34 |
| `UserVerificationSubmitTechManagerRequest` | 12 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### MP-050 `subpackages/login/index` 登录

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/auth/session` | `authGetSession` | Y | Auth（认证） | 小程序端会话查询列表 |
| POST | `/auth/sms/send` | `authSmsSend` | N | Auth（认证） | 小程序端短信/发送提交 |
| POST | `/auth/sms/verify` | `authSmsVerify` | N | Auth（认证） | 小程序端短信/验证提交 |
| POST | `/auth/wechat/mp-login` | `authWechatMpLogin` | N | Auth（认证） | 小程序端微信/小程序登录提交 |
| POST | `/auth/wechat/phone-bind` | `authWechatPhoneBind` | Y | Auth（认证） | 小程序端微信/手机号绑定提交 |
| GET | `/me/addresses` | `listMyAddresses` | Y | Users（用户） | 小程序端地址查询列表 |
| POST | `/me/addresses` | `createMyAddress` | Y | Users（用户） | 小程序端地址提交 |
| PATCH | `/me/addresses/{addressId}` | `updateMyAddress` | Y | Users（用户） | 小程序端地址更新 |
| DELETE | `/me/addresses/{addressId}` | `deleteMyAddress` | Y | Users（用户） | 小程序端地址删除 |
| GET | `/me/conversations` | `listMyConversations` | Y | Messaging（消息会话） | 小程序端会话查询列表 |
| GET | `/me/favorites/achievements` | `listMyFavoriteAchievements` | Y | Achievements（成果） | 小程序端收藏/成果查询列表 |
| GET | `/me/verification` | `getMyVerification` | Y | Users（用户） | 小程序端认证查询列表 |
| POST | `/me/verification` | `submitMyVerification` | Y | Users（用户） | 小程序端认证提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `AchievementMaturity` | 0 |
| `AchievementSummary` | 46 |
| `Address` | 12 |
| `AddressCreateRequest` | 6 |
| `AddressUpdateRequest` | 6 |
| `AuditStatus` | 0 |
| `AuthSession` | 13 |
| `AuthTokenResponse` | 22 |
| `ContentSource` | 0 |
| `ContentStatus` | 0 |
| `ConversationContentType` | 0 |
| `ConversationSummary` | 33 |
| `ErrorResponse` | 3 |
| `ListingStats` | 4 |
| `ListingTopic` | 0 |
| `OkResponse` | 1 |
| `OrganizationStats` | 2 |
| `OrganizationSummary` | 17 |
| `PageMeta` | 3 |
| `PagedAchievementSummary` | 54 |
| `PagedConversationSummary` | 41 |
| `PhoneNumber` | 0 |
| `SmsPurpose` | 0 |
| `SupplyType` | 0 |
| `UserBrief` | 12 |
| `UserProfile` | 17 |
| `UserRole` | 0 |
| `UserVerification` | 26 |
| `UserVerificationSubmitOrganizationRequest` | 13 |
| `UserVerificationSubmitPersonRequest` | 3 |
| `UserVerificationSubmitRequest` | 34 |
| `UserVerificationSubmitTechManagerRequest` | 12 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### MP-051 `subpackages/ipc-picker/index` IPC选择器

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/public/config/trade-rules` | `getPublicTradeRulesConfig` | N | Config（配置） | 小程序端配置/交易规则查询列表 |

| Schema | 字段数（全量展开） |
|---|---|
| `ErrorResponse` | 3 |
| `MoneyFen` | 0 |
| `PayoutCondition` | 0 |
| `PayoutMethod` | 0 |
| `TradeRulesConfig` | 22 |

#### MP-052 `subpackages/media/video-preview/index` 媒体视频preview（媒体视频预览）

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/achievements` | `listMyAchievements` | Y | Achievements（成果） | 小程序端成果查询列表 |
| POST | `/achievements` | `createAchievement` | Y | Achievements（成果） | 小程序端成果提交 |
| GET | `/achievements/{achievementId}` | `getMyAchievementById` | Y | Achievements（成果） | 小程序端成果查询详情 |
| PATCH | `/achievements/{achievementId}` | `updateMyAchievement` | Y | Achievements（成果） | 小程序端成果更新 |
| POST | `/achievements/{achievementId}/comments` | `createAchievementComment` | Y | Comments（评论）, Achievements（成果） | 小程序端成果/评论提交 |
| POST | `/achievements/{achievementId}/consultations` | `createAchievementConsultation` | Y | Achievements（成果） | 小程序端成果/咨询提交 |
| POST | `/achievements/{achievementId}/off-shelf` | `offShelfAchievement` | Y | Achievements（成果） | 小程序端成果/下架提交 |
| POST | `/achievements/{achievementId}/submit` | `submitAchievement` | Y | Achievements（成果） | 小程序端成果提交 |
| POST | `/ai/agent/query` | `createAiAgentQuery` | N | AI（智能解析） | 小程序端智能/坐席/查询提交 |
| POST | `/ai/parse-results/{parseResultId}/feedback` | `createAiParseFeedback` | Y | AI（智能解析） | 小程序端智能/解析结果/反馈提交 |
| PATCH | `/comments/{commentId}` | `updateComment` | Y | Comments（评论） | 小程序端评论更新 |
| DELETE | `/comments/{commentId}` | `deleteComment` | Y | Comments（评论） | 小程序端评论删除 |
| POST | `/files` | `uploadFile` | Y | Files（文件） | 小程序端文件提交 |
| GET | `/files/{fileId}` | `downloadFile` | Y | Files（文件） | 小程序端文件查询详情 |
| GET | `/files/{fileId}/preview` | `previewFile` | Y | Files（文件） | 小程序端文件/预览查询列表 |
| POST | `/files/{fileId}/temporary-access` | `createFileTemporaryAccess` | Y | Files（文件） | 小程序端文件/临时访问提交 |
| GET | `/health` | `getHealth` | N | System（系统） | 小程序端健康查询列表 |
| GET | `/me` | `getMe` | Y | Users（用户） | 小程序端我的查询列表 |
| PATCH | `/me` | `updateMe` | Y | Users（用户） | 小程序端我的更新 |
| GET | `/public/achievements/{achievementId}` | `getPublicAchievementById` | N | Achievements（成果） | 小程序端成果查询详情 |
| GET | `/public/achievements/{achievementId}/comments` | `listPublicAchievementComments` | N | Comments（评论）, Achievements（成果） | 小程序端成果/评论查询列表 |
| GET | `/public/config/banner` | `getPublicBannerConfig` | N | Config（配置） | 小程序端配置/横幅查询列表 |
| GET | `/public/config/customer-service` | `getPublicCustomerServiceConfig` | N | Config（配置） | 小程序端配置/客户服务查询列表 |
| GET | `/public/industry-tags` | `listPublicIndustryTags` | N | Regions（地区） | 小程序端行业标签查询列表 |
| GET | `/regions` | `listRegions` | N | Regions（地区） | 小程序端地区查询列表 |

| Schema | 字段数（全量展开） |
|---|---|
| `AchievementCreateRequest` | 22 |
| `AchievementDetail` | 60 |
| `AchievementEdit` | 61 |
| `AchievementMaturity` | 0 |
| `AchievementRecord` | 26 |
| `AchievementSummary` | 46 |
| `AchievementUpdateRequest` | 22 |
| `AiAgentInputType` | 0 |
| `AiAgentMatchSummary` | 7 |
| `AiAgentParsedQuery` | 28 |
| `AiAgentQueryRequest` | 11 |
| `AiAgentQueryResult` | 49 |
| `AiContentScope` | 0 |
| `AiContentType` | 0 |
| `AiParseFeedback` | 13 |
| `AiParseFeedbackActorType` | 0 |
| `AiParseFeedbackRequest` | 4 |
| `AiSearchFilters` | 21 |
| `AuditStatus` | 0 |
| `BannerConfig` | 9 |
| `BannerItem` | 6 |
| `Comment` | 27 |
| `CommentContentType` | 0 |
| `CommentCreateRequest` | 3 |
| `CommentStatus` | 0 |
| `CommentThread` | 59 |
| `CommentUpdateRequest` | 1 |
| `ContentMedia` | 9 |
| `ContentMediaInput` | 5 |
| `ContentMediaType` | 0 |
| `ContentSource` | 0 |
| `ContentStatus` | 0 |
| `CooperationMode` | 0 |
| `CustomerServiceConfig` | 2 |
| `ErrorResponse` | 3 |
| `FileObject` | 7 |
| `FilePurpose` | 0 |
| `FileTemporaryAccessRequest` | 4 |
| `FileTemporaryAccessResponse` | 4 |
| `FileTemporaryAccessScope` | 0 |
| `IndustryTag` | 5 |
| `ListingStats` | 4 |
| `MoneyFen` | 0 |
| `OkResponse` | 1 |
| `OrganizationStats` | 2 |
| `OrganizationSummary` | 17 |
| `PageMeta` | 3 |
| `PagedAchievementSummary` | 54 |
| `PagedCommentThread` | 67 |
| `PatentType` | 0 |
| `PhoneNumber` | 0 |
| `PriceType` | 0 |
| `RegionLevel` | 0 |
| `RegionNode` | 10 |
| `SupplyType` | 0 |
| `TradeMode` | 0 |
| `UserBrief` | 12 |
| `UserProfile` | 17 |
| `UserRole` | 0 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### ADM-001 `/login` 登录

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/auth/session` | `authGetSession` | Y | Auth（认证） | 小程序端会话查询列表 |
| POST | `/auth/sms/send` | `authSmsSend` | N | Auth（认证） | 小程序端短信/发送提交 |
| POST | `/auth/sms/verify` | `authSmsVerify` | N | Auth（认证） | 小程序端短信/验证提交 |
| POST | `/auth/wechat/mp-login` | `authWechatMpLogin` | N | Auth（认证） | 小程序端微信/小程序登录提交 |
| POST | `/auth/wechat/phone-bind` | `authWechatPhoneBind` | Y | Auth（认证） | 小程序端微信/手机号绑定提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `AuthSession` | 13 |
| `AuthTokenResponse` | 22 |
| `ErrorResponse` | 3 |
| `PhoneNumber` | 0 |
| `SmsPurpose` | 0 |
| `SupplyType` | 0 |
| `UserProfile` | 17 |
| `UserRole` | 0 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### ADM-002 `/` 页面

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/admin/achievements` | `adminListAchievements` | Y | Admin（管理后台）, Achievements（成果） | 管理后台成果查询列表 |
| POST | `/admin/achievements` | `adminCreateAchievement` | Y | Admin（管理后台）, Achievements（成果） | 管理后台成果提交 |
| GET | `/admin/achievements/{achievementId}` | `adminGetAchievementById` | Y | Admin（管理后台）, Achievements（成果） | 管理后台成果查询详情 |
| PATCH | `/admin/achievements/{achievementId}` | `adminUpdateAchievement` | Y | Admin（管理后台）, Achievements（成果） | 管理后台成果更新 |
| POST | `/admin/achievements/{achievementId}/approve` | `adminApproveAchievement` | Y | Admin（管理后台）, Achievements（成果） | 管理后台成果/通过提交 |
| GET | `/admin/achievements/{achievementId}/audit-logs` | `adminGetAchievementAuditLogs` | Y | Admin（管理后台）, Achievements（成果） | 管理后台成果/审计日志查询列表 |
| GET | `/admin/achievements/{achievementId}/materials` | `adminGetAchievementMaterials` | Y | Admin（管理后台）, Achievements（成果） | 管理后台成果/材料查询列表 |
| POST | `/admin/achievements/{achievementId}/off-shelf` | `adminOffShelfAchievement` | Y | Admin（管理后台）, Achievements（成果） | 管理后台成果/下架提交 |
| POST | `/admin/achievements/{achievementId}/publish` | `adminPublishAchievement` | Y | Admin（管理后台）, Achievements（成果） | 管理后台成果/发布提交 |
| POST | `/admin/achievements/{achievementId}/reject` | `adminRejectAchievement` | Y | Admin（管理后台）, Achievements（成果） | 管理后台成果/驳回提交 |
| GET | `/admin/ai/parse-results` | `adminListAiParseResults` | Y | Admin（管理后台）, AI（智能解析） | 管理后台智能/解析结果查询列表 |
| GET | `/admin/ai/parse-results/{parseResultId}` | `adminGetAiParseResult` | Y | Admin（管理后台）, AI（智能解析） | 管理后台智能/解析结果查询详情 |
| PATCH | `/admin/ai/parse-results/{parseResultId}` | `adminUpdateAiParseResult` | Y | Admin（管理后台）, AI（智能解析） | 管理后台智能/解析结果更新 |
| GET | `/admin/cases` | `adminListCases` | Y | Admin（管理后台）, Cases（工单） | 管理后台工单查询列表 |
| POST | `/admin/cases` | `adminCreateCase` | Y | Admin（管理后台）, Cases（工单） | 管理后台工单提交 |
| GET | `/admin/cases/{caseId}` | `adminGetCaseById` | Y | Admin（管理后台）, Cases（工单） | 管理后台工单查询详情 |
| POST | `/admin/cases/{caseId}/assign` | `adminAssignCase` | Y | Admin（管理后台）, Cases（工单） | 管理后台工单/分配提交 |
| POST | `/admin/cases/{caseId}/evidence` | `adminAddCaseEvidence` | Y | Admin（管理后台）, Cases（工单） | 管理后台工单/凭证提交 |
| POST | `/admin/cases/{caseId}/notes` | `adminAddCaseNote` | Y | Admin（管理后台）, Cases（工单） | 管理后台工单/备注提交 |
| POST | `/admin/cases/{caseId}/sla` | `adminUpdateCaseSla` | Y | Admin（管理后台）, Cases（工单） | 管理后台工单/服务时效提交 |
| POST | `/admin/cases/{caseId}/status` | `adminUpdateCaseStatus` | Y | Admin（管理后台）, Cases（工单） | 管理后台工单/状态提交 |
| GET | `/admin/conversations/platform` | `adminListPlatformConversations` | Y | Admin（管理后台）, Messaging（消息会话） | 管理后台会话/平台查询列表 |
| POST | `/admin/conversations/{conversationId}/agents` | `adminAssignPlatformConversationAgent` | Y | Admin（管理后台）, Messaging（消息会话） | 管理后台会话/坐席提交 |
| DELETE | `/admin/conversations/{conversationId}/agents/{userId}` | `adminRemovePlatformConversationAgent` | Y | Admin（管理后台）, Messaging（消息会话） | 管理后台会话/坐席删除 |
| GET | `/admin/industry-tags` | `adminListIndustryTags` | Y | Admin（管理后台）, Regions（地区） | 管理后台行业标签查询列表 |
| POST | `/admin/industry-tags` | `adminCreateIndustryTag` | Y | Admin（管理后台）, Regions（地区） | 管理后台行业标签提交 |
| GET | `/admin/patent-claims` | `adminListPatentClaims` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利认领查询列表 |
| POST | `/admin/patent-claims/{claimId}/approve` | `adminApprovePatentClaim` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利认领/通过提交 |
| POST | `/admin/patent-claims/{claimId}/reject` | `adminRejectPatentClaim` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利认领/驳回提交 |
| GET | `/admin/patent-maintenance/orders` | `adminListPatentMaintenanceOrders` | Y | Admin（管理后台）, Maintenance（专利维保） | 管理后台专利维保/订单查询列表 |
| POST | `/admin/patent-maintenance/orders` | `adminCreatePatentMaintenanceOrder` | Y | Admin（管理后台）, Maintenance（专利维保） | 管理后台专利维保/订单提交 |
| GET | `/admin/patent-maintenance/orders/{orderId}` | `adminGetPatentMaintenanceOrder` | Y | Admin（管理后台）, Maintenance（专利维保） | 管理后台专利维保/订单查询详情 |
| POST | `/admin/patent-maintenance/orders/{orderId}/cancel` | `adminCancelPatentMaintenanceOrder` | Y | Admin（管理后台）, Maintenance（专利维保） | 管理后台专利维保/订单/取消提交 |
| POST | `/admin/patent-maintenance/orders/{orderId}/close` | `adminClosePatentMaintenanceOrder` | Y | Admin（管理后台）, Maintenance（专利维保） | 管理后台专利维保/订单/关闭提交 |
| GET | `/admin/patent-maintenance/orders/{orderId}/events` | `adminListPatentMaintenanceOrderEvents` | Y | Admin（管理后台）, Maintenance（专利维保） | 管理后台专利维保/订单/事件查询列表 |
| POST | `/admin/patent-maintenance/orders/{orderId}/execution` | `adminSubmitPatentMaintenanceOrderExecution` | Y | Admin（管理后台）, Maintenance（专利维保） | 管理后台专利维保/订单/执行提交 |
| POST | `/admin/patent-maintenance/orders/{orderId}/payment-confirm` | `adminConfirmPatentMaintenanceOrderPayment` | Y | Admin（管理后台）, Maintenance（专利维保） | 管理后台专利维保/订单/支付确认提交 |
| POST | `/admin/patent-maintenance/orders/{orderId}/quote` | `adminQuotePatentMaintenanceOrder` | Y | Admin（管理后台）, Maintenance（专利维保） | 管理后台专利维保/订单/报价提交 |
| POST | `/admin/patent-maintenance/orders/{orderId}/receipt` | `adminUploadPatentMaintenanceOrderReceipt` | Y | Admin（管理后台）, Maintenance（专利维保） | 管理后台专利维保/订单/回执提交 |
| POST | `/admin/patent-maintenance/orders/{orderId}/reconcile` | `adminReconcilePatentMaintenanceOrder` | Y | Admin（管理后台）, Maintenance（专利维保） | 管理后台专利维保/订单/对账提交 |
| GET | `/admin/patent-maintenance/schedules` | `adminListPatentMaintenanceSchedules` | Y | Admin（管理后台）, Maintenance（专利维保） | 管理后台专利维保/日程查询列表 |
| POST | `/admin/patent-maintenance/schedules` | `adminCreatePatentMaintenanceSchedule` | Y | Admin（管理后台）, Maintenance（专利维保） | 管理后台专利维保/日程提交 |
| GET | `/admin/patent-maintenance/schedules/{scheduleId}` | `adminGetPatentMaintenanceSchedule` | Y | Admin（管理后台）, Maintenance（专利维保） | 管理后台专利维保/日程查询详情 |
| PATCH | `/admin/patent-maintenance/schedules/{scheduleId}` | `adminUpdatePatentMaintenanceSchedule` | Y | Admin（管理后台）, Maintenance（专利维保） | 管理后台专利维保/日程更新 |
| GET | `/admin/patent-maintenance/tasks` | `adminListPatentMaintenanceTasks` | Y | Admin（管理后台）, Maintenance（专利维保） | 管理后台专利维保/任务查询列表 |
| POST | `/admin/patent-maintenance/tasks` | `adminCreatePatentMaintenanceTask` | Y | Admin（管理后台）, Maintenance（专利维保） | 管理后台专利维保/任务提交 |
| PATCH | `/admin/patent-maintenance/tasks/{taskId}` | `adminUpdatePatentMaintenanceTask` | Y | Admin（管理后台）, Maintenance（专利维保） | 管理后台专利维保/任务更新 |
| POST | `/admin/patent-map/listings/batch` | `adminBatchUpdatePatentMapListings` | Y | Admin（管理后台）, Listings（挂牌） | 管理后台专利地图/挂牌/批次提交 |
| POST | `/admin/refund-requests/{refundRequestId}/approve` | `adminApproveRefundRequest` | Y | Admin（管理后台） | 管理后台退款请求/通过提交 |
| POST | `/admin/refund-requests/{refundRequestId}/complete` | `adminCompleteRefundRequest` | Y | Admin（管理后台） | 管理后台退款请求/完成提交 |
| POST | `/admin/refund-requests/{refundRequestId}/reject` | `adminRejectRefundRequest` | Y | Admin（管理后台） | 管理后台退款请求/驳回提交 |
| GET | `/admin/user-verifications` | `adminListUserVerifications` | Y | Admin（管理后台） | 管理后台用户认证查询列表 |
| POST | `/admin/user-verifications/{verificationId}/approve` | `adminApproveUserVerification` | Y | Admin（管理后台） | 管理后台用户认证/通过提交 |
| GET | `/admin/user-verifications/{verificationId}/audit-logs` | `adminGetVerificationAuditLogs` | Y | Admin（管理后台） | 管理后台用户认证/审计日志查询列表 |
| GET | `/admin/user-verifications/{verificationId}/materials` | `adminGetVerificationMaterials` | Y | Admin（管理后台） | 管理后台用户认证/材料查询列表 |
| POST | `/admin/user-verifications/{verificationId}/reject` | `adminRejectUserVerification` | Y | Admin（管理后台） | 管理后台用户认证/驳回提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `AchievementAdminCreateRequest` | 30 |
| `AchievementAdminUpdateRequest` | 30 |
| `AchievementCreateRequest` | 22 |
| `AchievementEdit` | 61 |
| `AchievementMaturity` | 0 |
| `AchievementRecord` | 26 |
| `AchievementSummary` | 46 |
| `AchievementUpdateRequest` | 22 |
| `AiContentType` | 0 |
| `AiParseResult` | 16 |
| `AiParseResultUpdateRequest` | 7 |
| `AiParseStatus` | 0 |
| `AuditLog` | 8 |
| `AuditLogList` | 11 |
| `AuditMaterial` | 6 |
| `AuditMaterialList` | 9 |
| `AuditStatus` | 0 |
| `CaseCreateRequest` | 14 |
| `CaseEvidence` | 3 |
| `CaseNote` | 6 |
| `CasePriority` | 0 |
| `CaseRecord` | 35 |
| `CaseSlaStatus` | 0 |
| `CaseStatus` | 0 |
| `CaseType` | 0 |
| `ContentMedia` | 9 |
| `ContentMediaInput` | 5 |
| `ContentMediaType` | 0 |
| `ContentSource` | 0 |
| `ContentStatus` | 0 |
| `ConversationAgentAssignment` | 8 |
| `ConversationAgentAssignmentRequest` | 2 |
| `ConversationContentType` | 0 |
| `ConversationSummary` | 33 |
| `ErrorResponse` | 3 |
| `FeaturedLevel` | 0 |
| `IndustryTag` | 5 |
| `IndustryTagCreateRequest` | 1 |
| `ListingStats` | 4 |
| `ListingTopic` | 0 |
| `OrganizationStats` | 2 |
| `OrganizationSummary` | 17 |
| `PageMeta` | 3 |
| `PagedAchievementSummary` | 54 |
| `PagedAiParseResult` | 24 |
| `PagedCase` | 43 |
| `PagedConversationSummary` | 41 |
| `PagedPatentClaimRequest` | 27 |
| `PagedPatentMaintenanceOrder` | 46 |
| `PagedPatentMaintenanceSchedule` | 19 |
| `PagedPatentMaintenanceTask` | 21 |
| `PagedUserVerification` | 34 |
| `PatentClaimRejectRequest` | 1 |
| `PatentClaimRequest` | 19 |
| `PatentClaimReviewRequest` | 1 |
| `PatentClaimStatus` | 0 |
| `PatentMaintenanceOrder` | 38 |
| `PatentMaintenanceOrderCancelRequest` | 1 |
| `PatentMaintenanceOrderCloseRequest` | 1 |
| `PatentMaintenanceOrderCreateRequest` | 6 |
| `PatentMaintenanceOrderEvent` | 17 |
| `PatentMaintenanceOrderEventList` | 20 |
| `PatentMaintenanceOrderEventType` | 0 |
| `PatentMaintenanceOrderExecutionRequest` | 2 |
| `PatentMaintenanceOrderPaymentConfirmRequest` | 4 |
| `PatentMaintenanceOrderQuoteRequest` | 6 |
| `PatentMaintenanceOrderReceiptRequest` | 4 |
| `PatentMaintenanceOrderReconcileRequest` | 3 |
| `PatentMaintenanceOrderStatus` | 0 |
| `PatentMaintenancePaymentChannel` | 0 |
| `PatentMaintenanceReconcileStatus` | 0 |
| `PatentMaintenanceSchedule` | 11 |
| `PatentMaintenanceScheduleCreateRequest` | 7 |
| `PatentMaintenanceScheduleUpdateRequest` | 4 |
| `PatentMaintenanceStatus` | 0 |
| `PatentMaintenanceTask` | 13 |
| `PatentMaintenanceTaskCreateRequest` | 5 |
| `PatentMaintenanceTaskStatus` | 0 |
| `PatentMaintenanceTaskUpdateRequest` | 7 |
| `PatentMapBatchUpdateRequest` | 13 |
| `PatentMapBatchUpdateResponse` | 8 |
| `PatentMapListingPatch` | 7 |
| `RefundReasonCode` | 0 |
| `RefundRequest` | 11 |
| `RefundRequestCompleteRequest` | 1 |
| `RefundRequestStatus` | 0 |
| `SupplyType` | 0 |
| `UserBrief` | 12 |
| `UserRole` | 0 |
| `UserVerification` | 26 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### ADM-003 `verifications` verifications（认证审核）

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| - | - | - | - | - | - |

| Schema | 字段数（全量展开） |
|---|---|
| - | 0 |

#### ADM-004 `listings` 挂牌

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/admin/listings` | `adminListListingsForAudit` | Y | Admin（管理后台） | 管理后台挂牌查询列表 |
| POST | `/admin/listings` | `adminCreateListing` | Y | Admin（管理后台） | 管理后台挂牌提交 |
| GET | `/admin/listings/jobs/batch` | `adminListListingBatchJobs` | Y | Admin（管理后台） | 管理后台挂牌/任务/批次查询列表 |
| POST | `/admin/listings/jobs/batch` | `adminCreateListingBatchJob` | Y | Admin（管理后台） | 管理后台挂牌/任务/批次提交 |
| GET | `/admin/listings/jobs/batch/{jobId}` | `adminGetListingBatchJob` | Y | Admin（管理后台） | 管理后台挂牌/任务/批次查询详情 |
| GET | `/admin/listings/jobs/batch/{jobId}/error-file` | `adminGetListingBatchJobErrorFile` | Y | Admin（管理后台） | 管理后台挂牌/任务/批次/错误文件查询列表 |
| GET | `/admin/listings/jobs/batch/{jobId}/items` | `adminListListingBatchJobItems` | Y | Admin（管理后台） | 管理后台挂牌/任务/批次/条目查询列表 |
| GET | `/admin/listings/jobs/import` | `adminListListingImportJobs` | Y | Admin（管理后台） | 管理后台挂牌/任务/导入查询列表 |
| POST | `/admin/listings/jobs/import` | `adminCreateListingImportJob` | Y | Admin（管理后台） | 管理后台挂牌/任务/导入提交 |
| GET | `/admin/listings/jobs/import/{jobId}` | `adminGetListingImportJob` | Y | Admin（管理后台） | 管理后台挂牌/任务/导入查询详情 |
| GET | `/admin/listings/jobs/import/{jobId}/error-file` | `adminGetListingImportJobErrorFile` | Y | Admin（管理后台） | 管理后台挂牌/任务/导入/错误文件查询列表 |
| POST | `/admin/listings/jobs/import/{jobId}/execute` | `adminExecuteListingImportJob` | Y | Admin（管理后台） | 管理后台挂牌/任务/导入/执行提交 |
| GET | `/admin/listings/jobs/import/{jobId}/rows` | `adminListListingImportJobRows` | Y | Admin（管理后台） | 管理后台挂牌/任务/导入/行查询列表 |
| POST | `/admin/listings/jobs/import/{jobId}/validate` | `adminValidateListingImportJob` | Y | Admin（管理后台） | 管理后台挂牌/任务/导入/校验提交 |
| GET | `/admin/listings/{listingId}` | `adminGetListingById` | Y | Admin（管理后台） | 管理后台挂牌查询详情 |
| PATCH | `/admin/listings/{listingId}` | `adminUpdateListing` | Y | Admin（管理后台） | 管理后台挂牌更新 |
| POST | `/admin/listings/{listingId}/approve` | `adminApproveListing` | Y | Admin（管理后台） | 管理后台挂牌/通过提交 |
| GET | `/admin/listings/{listingId}/audit-logs` | `adminGetListingAuditLogs` | Y | Admin（管理后台） | 管理后台挂牌/审计日志查询列表 |
| PUT | `/admin/listings/{listingId}/featured` | `adminSetListingFeatured` | Y | Admin（管理后台） | 管理后台挂牌/推荐更新 |
| GET | `/admin/listings/{listingId}/materials` | `adminGetListingMaterials` | Y | Admin（管理后台） | 管理后台挂牌/材料查询列表 |
| POST | `/admin/listings/{listingId}/off-shelf` | `adminOffShelfListing` | Y | Admin（管理后台） | 管理后台挂牌/下架提交 |
| POST | `/admin/listings/{listingId}/publish` | `adminPublishListing` | Y | Admin（管理后台） | 管理后台挂牌/发布提交 |
| POST | `/admin/listings/{listingId}/reject` | `adminRejectListing` | Y | Admin（管理后台） | 管理后台挂牌/驳回提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `AdminListingCreateRequest` | 70 |
| `AdminListingUpdateRequest` | 68 |
| `AiContentType` | 0 |
| `AiParseResult` | 16 |
| `AiParseStatus` | 0 |
| `AuditLog` | 8 |
| `AuditLogList` | 11 |
| `AuditMaterial` | 6 |
| `AuditMaterialList` | 9 |
| `AuditStatus` | 0 |
| `ConsultationRouting` | 0 |
| `ContentSource` | 0 |
| `ErrorResponse` | 3 |
| `ExistingLicenseStatus` | 0 |
| `FeaturedLevel` | 0 |
| `LegalStatus` | 0 |
| `LicenseMode` | 0 |
| `Listing` | 112 |
| `ListingBatchAction` | 0 |
| `ListingBatchItemStatus` | 0 |
| `ListingBatchJob` | 21 |
| `ListingBatchJobCreateRequest` | 6 |
| `ListingBatchJobItem` | 13 |
| `ListingCreateRequest` | 62 |
| `ListingFeaturedUpdateRequest` | 5 |
| `ListingImportDefaults` | 26 |
| `ListingImportDuplicatePolicy` | 0 |
| `ListingImportJob` | 53 |
| `ListingImportJobCreateRequest` | 32 |
| `ListingImportJobRow` | 16 |
| `ListingImportRowStatus` | 0 |
| `ListingJobErrorFile` | 3 |
| `ListingJobStatus` | 0 |
| `ListingMedia` | 4 |
| `ListingStats` | 4 |
| `ListingStatus` | 0 |
| `ListingSummary` | 65 |
| `ListingTopic` | 0 |
| `ListingUpdateRequest` | 60 |
| `MoneyFen` | 0 |
| `PageMeta` | 3 |
| `PagedListing` | 121 |
| `PagedListingBatchJob` | 29 |
| `PagedListingBatchJobItem` | 21 |
| `PagedListingImportJob` | 61 |
| `PagedListingImportJobRow` | 24 |
| `PatentType` | 0 |
| `PledgeStatus` | 0 |
| `PriceType` | 0 |
| `TradeMode` | 0 |
| `Uuid` | 0 |

#### ADM-005 `tech-managers` 技术经理

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/admin/tech-managers` | `adminListTechManagers` | Y | Admin（管理后台）, TechManagers（技术经理） | 管理后台技术经理查询列表 |
| PATCH | `/admin/tech-managers/{techManagerId}` | `adminUpdateTechManager` | Y | Admin（管理后台）, TechManagers（技术经理） | 管理后台技术经理更新 |

| Schema | 字段数（全量展开） |
|---|---|
| `ErrorResponse` | 3 |
| `PageMeta` | 3 |
| `PagedTechManagerSummary` | 27 |
| `TechManagerPublic` | 22 |
| `TechManagerStats` | 4 |
| `TechManagerSummary` | 19 |
| `TechManagerUpdateRequest` | 5 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### ADM-006 `orders` 订单

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/admin/orders/{orderId}` | `adminGetOrderById` | Y | Admin（管理后台） | 管理后台订单查询详情 |
| POST | `/admin/orders/{orderId}/invoice` | `adminIssueOrderInvoice` | Y | Admin（管理后台） | 管理后台订单/发票提交 |
| PUT | `/admin/orders/{orderId}/invoice` | `adminUpsertOrderInvoice` | Y | Admin（管理后台） | 管理后台订单/发票更新 |
| DELETE | `/admin/orders/{orderId}/invoice` | `adminDeleteOrderInvoice` | Y | Admin（管理后台） | 管理后台订单/发票删除 |
| POST | `/admin/orders/{orderId}/milestones/contract-signed` | `adminConfirmContractSigned` | Y | Admin（管理后台） | 管理后台订单/里程碑/合同签署提交 |
| POST | `/admin/orders/{orderId}/milestones/transfer-completed` | `adminConfirmTransferCompleted` | Y | Admin（管理后台） | 管理后台订单/里程碑/转让完成提交 |
| POST | `/admin/orders/{orderId}/payments/manual` | `adminManualConfirmPayment` | Y | Admin（管理后台）, Payments（支付） | 管理后台订单/支付/手动提交 |
| POST | `/admin/orders/{orderId}/payouts/manual` | `adminConfirmManualPayout` | Y | Admin（管理后台） | 管理后台订单/放款/手动提交 |
| GET | `/admin/orders/{orderId}/settlement` | `adminGetOrderSettlement` | Y | Admin（管理后台） | 管理后台订单/结算查询列表 |

| Schema | 字段数（全量展开） |
|---|---|
| `ErrorResponse` | 3 |
| `FileObject` | 7 |
| `ManualPaymentConfirmRequest` | 6 |
| `ManualPaymentConfirmResponse` | 12 |
| `ManualPayoutConfirmRequest` | 5 |
| `MoneyFen` | 0 |
| `Order` | 44 |
| `OrderInvoice` | 18 |
| `OrderInvoiceIssueResponse` | 3 |
| `OrderInvoiceUpsertRequest` | 4 |
| `OrderStatus` | 0 |
| `PayType` | 0 |
| `PaymentStatus` | 0 |
| `PayoutMethod` | 0 |
| `PayoutStatus` | 0 |
| `Settlement` | 20 |
| `Uuid` | 0 |

#### ADM-007 `orders/:orderId` 订单

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/admin/orders/{orderId}` | `adminGetOrderById` | Y | Admin（管理后台） | 管理后台订单查询详情 |
| POST | `/admin/orders/{orderId}/invoice` | `adminIssueOrderInvoice` | Y | Admin（管理后台） | 管理后台订单/发票提交 |
| PUT | `/admin/orders/{orderId}/invoice` | `adminUpsertOrderInvoice` | Y | Admin（管理后台） | 管理后台订单/发票更新 |
| DELETE | `/admin/orders/{orderId}/invoice` | `adminDeleteOrderInvoice` | Y | Admin（管理后台） | 管理后台订单/发票删除 |
| POST | `/admin/orders/{orderId}/milestones/contract-signed` | `adminConfirmContractSigned` | Y | Admin（管理后台） | 管理后台订单/里程碑/合同签署提交 |
| POST | `/admin/orders/{orderId}/milestones/transfer-completed` | `adminConfirmTransferCompleted` | Y | Admin（管理后台） | 管理后台订单/里程碑/转让完成提交 |
| POST | `/admin/orders/{orderId}/payments/manual` | `adminManualConfirmPayment` | Y | Admin（管理后台）, Payments（支付） | 管理后台订单/支付/手动提交 |
| POST | `/admin/orders/{orderId}/payouts/manual` | `adminConfirmManualPayout` | Y | Admin（管理后台） | 管理后台订单/放款/手动提交 |
| GET | `/admin/orders/{orderId}/settlement` | `adminGetOrderSettlement` | Y | Admin（管理后台） | 管理后台订单/结算查询列表 |

| Schema | 字段数（全量展开） |
|---|---|
| `ErrorResponse` | 3 |
| `FileObject` | 7 |
| `ManualPaymentConfirmRequest` | 6 |
| `ManualPaymentConfirmResponse` | 12 |
| `ManualPayoutConfirmRequest` | 5 |
| `MoneyFen` | 0 |
| `Order` | 44 |
| `OrderInvoice` | 18 |
| `OrderInvoiceIssueResponse` | 3 |
| `OrderInvoiceUpsertRequest` | 4 |
| `OrderStatus` | 0 |
| `PayType` | 0 |
| `PaymentStatus` | 0 |
| `PayoutMethod` | 0 |
| `PayoutStatus` | 0 |
| `Settlement` | 20 |
| `Uuid` | 0 |

#### ADM-008 `cases` cases（工单）

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/admin/cases` | `adminListCases` | Y | Admin（管理后台）, Cases（工单） | 管理后台工单查询列表 |
| POST | `/admin/cases` | `adminCreateCase` | Y | Admin（管理后台）, Cases（工单） | 管理后台工单提交 |
| GET | `/admin/cases/{caseId}` | `adminGetCaseById` | Y | Admin（管理后台）, Cases（工单） | 管理后台工单查询详情 |
| POST | `/admin/cases/{caseId}/assign` | `adminAssignCase` | Y | Admin（管理后台）, Cases（工单） | 管理后台工单/分配提交 |
| POST | `/admin/cases/{caseId}/evidence` | `adminAddCaseEvidence` | Y | Admin（管理后台）, Cases（工单） | 管理后台工单/凭证提交 |
| POST | `/admin/cases/{caseId}/notes` | `adminAddCaseNote` | Y | Admin（管理后台）, Cases（工单） | 管理后台工单/备注提交 |
| POST | `/admin/cases/{caseId}/sla` | `adminUpdateCaseSla` | Y | Admin（管理后台）, Cases（工单） | 管理后台工单/服务时效提交 |
| POST | `/admin/cases/{caseId}/status` | `adminUpdateCaseStatus` | Y | Admin（管理后台）, Cases（工单） | 管理后台工单/状态提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `CaseCreateRequest` | 14 |
| `CaseEvidence` | 3 |
| `CaseNote` | 6 |
| `CasePriority` | 0 |
| `CaseRecord` | 35 |
| `CaseSlaStatus` | 0 |
| `CaseStatus` | 0 |
| `CaseType` | 0 |
| `ErrorResponse` | 3 |
| `PageMeta` | 3 |
| `PagedCase` | 43 |
| `Uuid` | 0 |

#### ADM-009 `refunds` refunds（退款）

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| - | - | - | - | - | - |

| Schema | 字段数（全量展开） |
|---|---|
| - | 0 |

#### ADM-010 `settlements` settlements（结算）

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| - | - | - | - | - | - |

| Schema | 字段数（全量展开） |
|---|---|
| - | 0 |

#### ADM-011 `invoices` 发票

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| - | - | - | - | - | - |

| Schema | 字段数（全量展开） |
|---|---|
| - | 0 |

#### ADM-012 `reports` reports（报表）

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| POST | `/admin/reports/finance/export` | `adminExportFinanceReport` | Y | Admin（管理后台） | 管理后台报表/财务/导出提交 |
| GET | `/admin/reports/finance/summary` | `adminGetFinanceReportSummary` | Y | Admin（管理后台） | 管理后台报表/财务/摘要查询列表 |

| Schema | 字段数（全量展开） |
|---|---|
| `ErrorResponse` | 3 |
| `FinanceReportExportResponse` | 1 |
| `FinanceReportRange` | 2 |
| `FinanceReportSummary` | 11 |
| `MoneyFen` | 0 |

#### ADM-013 `comments` comments（评论）

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/admin/comments` | `adminListComments` | Y | Admin（管理后台） | 管理后台评论查询列表 |
| PATCH | `/admin/comments/{commentId}` | `adminUpdateComment` | Y | Admin（管理后台） | 管理后台评论更新 |

| Schema | 字段数（全量展开） |
|---|---|
| `AdminCommentUpdateRequest` | 2 |
| `Comment` | 27 |
| `CommentContentType` | 0 |
| `CommentStatus` | 0 |
| `ErrorResponse` | 3 |
| `PageMeta` | 3 |
| `PagedComment` | 35 |
| `SupplyType` | 0 |
| `UserBrief` | 12 |
| `UserRole` | 0 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### ADM-014 `alerts` alerts（告警）

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/admin/alerts` | `adminListAlertEvents` | Y | Admin（管理后台）, Alerts（告警） | 管理后台告警查询列表 |
| POST | `/admin/alerts/{alertId}/ack` | `adminAcknowledgeAlertEvent` | Y | Admin（管理后台）, Alerts（告警） | 管理后台告警/确认提交 |

| Schema | 字段数（全量展开） |
|---|---|
| `AlertChannel` | 0 |
| `AlertEvent` | 16 |
| `AlertSeverity` | 0 |
| `AlertStatus` | 0 |
| `AlertTargetType` | 0 |
| `ErrorResponse` | 3 |
| `PageMeta` | 3 |
| `PagedAlertEvent` | 24 |
| `Uuid` | 0 |

#### ADM-015 `audit-logs` 审计logs（审计日志）

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/admin/audit-logs` | `adminListAuditLogs` | Y | Admin（管理后台） | 管理后台审计日志查询列表 |

| Schema | 字段数（全量展开） |
|---|---|
| `AuditLog` | 8 |
| `ErrorResponse` | 3 |
| `PageMeta` | 3 |
| `PagedAuditLog` | 16 |
| `Uuid` | 0 |

#### ADM-016 `rbac` 权限

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/admin/rbac/permissions` | `adminListRbacPermissions` | Y | Admin（管理后台） | 管理后台权限/权限查询列表 |
| GET | `/admin/rbac/roles` | `adminListRbacRoles` | Y | Admin（管理后台） | 管理后台权限/角色查询列表 |
| POST | `/admin/rbac/roles` | `adminCreateRbacRole` | Y | Admin（管理后台） | 管理后台权限/角色提交 |
| PATCH | `/admin/rbac/roles/{roleId}` | `adminUpdateRbacRole` | Y | Admin（管理后台） | 管理后台权限/角色更新 |
| DELETE | `/admin/rbac/roles/{roleId}` | `adminDeleteRbacRole` | Y | Admin（管理后台） | 管理后台权限/角色删除 |
| GET | `/admin/rbac/users` | `adminListRbacUsers` | Y | Admin（管理后台） | 管理后台权限/用户查询列表 |
| POST | `/admin/rbac/users` | `adminCreateRbacUser` | Y | Admin（管理后台） | 管理后台权限/用户提交 |
| PATCH | `/admin/rbac/users/{userId}` | `adminUpdateRbacUserRoles` | Y | Admin（管理后台） | 管理后台权限/用户更新 |

| Schema | 字段数（全量展开） |
|---|---|
| `ErrorResponse` | 3 |
| `OkResponse` | 1 |
| `PhoneNumber` | 0 |
| `RbacPermission` | 3 |
| `RbacPermissionList` | 6 |
| `RbacRole` | 7 |
| `RbacRoleCreateRequest` | 5 |
| `RbacRoleList` | 10 |
| `RbacRoleUpdateRequest` | 5 |
| `RbacUser` | 6 |
| `RbacUserCreateRequest` | 6 |
| `RbacUserList` | 9 |
| `RbacUserRoleUpdateRequest` | 3 |
| `Uuid` | 0 |

#### ADM-017 `config` 配置

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/admin/config/alerts` | `adminGetAlertConfig` | Y | Admin（管理后台）, Config（配置）, Alerts（告警） | 管理后台配置/告警查询列表 |
| PUT | `/admin/config/alerts` | `adminUpdateAlertConfig` | Y | Admin（管理后台）, Config（配置）, Alerts（告警） | 管理后台配置/告警更新 |
| GET | `/admin/config/banner` | `adminGetBannerConfig` | Y | Admin（管理后台）, Config（配置） | 管理后台配置/横幅查询列表 |
| PUT | `/admin/config/banner` | `adminUpdateBannerConfig` | Y | Admin（管理后台）, Config（配置） | 管理后台配置/横幅更新 |
| GET | `/admin/config/customer-service` | `adminGetCustomerServiceConfig` | Y | Admin（管理后台）, Config（配置） | 管理后台配置/客户服务查询列表 |
| PUT | `/admin/config/customer-service` | `adminUpdateCustomerServiceConfig` | Y | Admin（管理后台）, Config（配置） | 管理后台配置/客户服务更新 |
| GET | `/admin/config/home-announcements` | `adminGetHomeAnnouncementsConfig` | Y | Admin（管理后台）, Config（配置） | 管理后台配置/首页公告查询列表 |
| POST | `/admin/config/home-announcements/items` | `adminCreateHomeAnnouncementItem` | Y | Admin（管理后台）, Config（配置） | 管理后台配置/首页公告/条目提交 |
| PUT | `/admin/config/home-announcements/items/{itemId}` | `adminUpdateHomeAnnouncementItem` | Y | Admin（管理后台）, Config（配置） | 管理后台配置/首页公告/条目更新 |
| DELETE | `/admin/config/home-announcements/items/{itemId}` | `adminDeleteHomeAnnouncementItem` | Y | Admin（管理后台）, Config（配置） | 管理后台配置/首页公告/条目删除 |
| POST | `/admin/config/home-announcements/items/{itemId}/offline` | `adminOfflineHomeAnnouncementItem` | Y | Admin（管理后台）, Config（配置） | 管理后台配置/首页公告/条目/下线提交 |
| POST | `/admin/config/home-announcements/items/{itemId}/publish` | `adminPublishHomeAnnouncementItem` | Y | Admin（管理后台）, Config（配置） | 管理后台配置/首页公告/条目/发布提交 |
| POST | `/admin/config/home-announcements/templates` | `adminCreateHomeAnnouncementTemplate` | Y | Admin（管理后台）, Config（配置） | 管理后台配置/首页公告/模板提交 |
| PUT | `/admin/config/home-announcements/templates/{templateId}` | `adminUpdateHomeAnnouncementTemplate` | Y | Admin（管理后台）, Config（配置） | 管理后台配置/首页公告/模板更新 |
| DELETE | `/admin/config/home-announcements/templates/{templateId}` | `adminDeleteHomeAnnouncementTemplate` | Y | Admin（管理后台）, Config（配置） | 管理后台配置/首页公告/模板删除 |
| GET | `/admin/config/hot-search` | `adminGetHotSearchConfig` | Y | Admin（管理后台）, Config（配置） | 管理后台配置/热门搜索查询列表 |
| PUT | `/admin/config/hot-search` | `adminUpdateHotSearchConfig` | Y | Admin（管理后台）, Config（配置） | 管理后台配置/热门搜索更新 |
| GET | `/admin/config/recommendation` | `adminGetRecommendationConfig` | Y | Admin（管理后台）, Config（配置） | 管理后台配置/推荐查询列表 |
| PUT | `/admin/config/recommendation` | `adminUpdateRecommendationConfig` | Y | Admin（管理后台）, Config（配置） | 管理后台配置/推荐更新 |
| GET | `/admin/config/sensitive-words` | `adminGetSensitiveWordsConfig` | Y | Admin（管理后台）, Config（配置） | 管理后台配置/敏感词查询列表 |
| PUT | `/admin/config/sensitive-words` | `adminUpdateSensitiveWordsConfig` | Y | Admin（管理后台）, Config（配置） | 管理后台配置/敏感词更新 |
| GET | `/admin/config/taxonomy` | `adminGetTaxonomyConfig` | Y | Admin（管理后台）, Config（配置） | 管理后台配置/分类查询列表 |
| PUT | `/admin/config/taxonomy` | `adminUpdateTaxonomyConfig` | Y | Admin（管理后台）, Config（配置） | 管理后台配置/分类更新 |
| GET | `/admin/config/trade-rules` | `adminGetTradeRulesConfig` | Y | Admin（管理后台）, Config（配置） | 管理后台配置/交易规则查询列表 |
| PUT | `/admin/config/trade-rules` | `adminUpdateTradeRulesConfig` | Y | Admin（管理后台）, Config（配置） | 管理后台配置/交易规则更新 |

| Schema | 字段数（全量展开） |
|---|---|
| `AlertChannel` | 0 |
| `AlertConfig` | 16 |
| `AlertConfigUpdateRequest` | 16 |
| `AlertRule` | 9 |
| `AlertSeverity` | 0 |
| `BannerConfig` | 9 |
| `BannerItem` | 6 |
| `CustomerServiceAssignStrategy` | 0 |
| `CustomerServiceConfig` | 2 |
| `CustomerServiceConfigUpdateRequest` | 4 |
| `ErrorResponse` | 3 |
| `HomeAnnouncementConfig` | 31 |
| `HomeAnnouncementItem` | 15 |
| `HomeAnnouncementItemCreateRequest` | 11 |
| `HomeAnnouncementItemDeleteResult` | 2 |
| `HomeAnnouncementItemUpdateRequest` | 11 |
| `HomeAnnouncementStatus` | 0 |
| `HomeAnnouncementTemplate` | 9 |
| `HomeAnnouncementTemplateCreateRequest` | 6 |
| `HomeAnnouncementTemplateDeleteResult` | 2 |
| `HomeAnnouncementTemplateUpdateRequest` | 6 |
| `HotSearchConfig` | 2 |
| `MoneyFen` | 0 |
| `PayoutCondition` | 0 |
| `PayoutMethod` | 0 |
| `RecommendationConfig` | 16 |
| `RecommendationConfigUpdateRequest` | 16 |
| `RecommendationFeaturedBoost` | 2 |
| `RecommendationWeights` | 6 |
| `SensitiveWordsConfig` | 2 |
| `TaxonomyConfig` | 6 |
| `TradeRulesConfig` | 22 |
| `TradeRulesConfigUpdateRequest` | 21 |

#### ADM-018 `home-announcements` 首页公告

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/admin/config/home-announcements` | `adminGetHomeAnnouncementsConfig` | Y | Admin（管理后台）, Config（配置） | 管理后台配置/首页公告查询列表 |
| POST | `/admin/config/home-announcements/items` | `adminCreateHomeAnnouncementItem` | Y | Admin（管理后台）, Config（配置） | 管理后台配置/首页公告/条目提交 |
| PUT | `/admin/config/home-announcements/items/{itemId}` | `adminUpdateHomeAnnouncementItem` | Y | Admin（管理后台）, Config（配置） | 管理后台配置/首页公告/条目更新 |
| DELETE | `/admin/config/home-announcements/items/{itemId}` | `adminDeleteHomeAnnouncementItem` | Y | Admin（管理后台）, Config（配置） | 管理后台配置/首页公告/条目删除 |
| POST | `/admin/config/home-announcements/items/{itemId}/offline` | `adminOfflineHomeAnnouncementItem` | Y | Admin（管理后台）, Config（配置） | 管理后台配置/首页公告/条目/下线提交 |
| POST | `/admin/config/home-announcements/items/{itemId}/publish` | `adminPublishHomeAnnouncementItem` | Y | Admin（管理后台）, Config（配置） | 管理后台配置/首页公告/条目/发布提交 |
| POST | `/admin/config/home-announcements/templates` | `adminCreateHomeAnnouncementTemplate` | Y | Admin（管理后台）, Config（配置） | 管理后台配置/首页公告/模板提交 |
| PUT | `/admin/config/home-announcements/templates/{templateId}` | `adminUpdateHomeAnnouncementTemplate` | Y | Admin（管理后台）, Config（配置） | 管理后台配置/首页公告/模板更新 |
| DELETE | `/admin/config/home-announcements/templates/{templateId}` | `adminDeleteHomeAnnouncementTemplate` | Y | Admin（管理后台）, Config（配置） | 管理后台配置/首页公告/模板删除 |

| Schema | 字段数（全量展开） |
|---|---|
| `ErrorResponse` | 3 |
| `HomeAnnouncementConfig` | 31 |
| `HomeAnnouncementItem` | 15 |
| `HomeAnnouncementItemCreateRequest` | 11 |
| `HomeAnnouncementItemDeleteResult` | 2 |
| `HomeAnnouncementItemUpdateRequest` | 11 |
| `HomeAnnouncementStatus` | 0 |
| `HomeAnnouncementTemplate` | 9 |
| `HomeAnnouncementTemplateCreateRequest` | 6 |
| `HomeAnnouncementTemplateDeleteResult` | 2 |
| `HomeAnnouncementTemplateUpdateRequest` | 6 |

#### ADM-019 `maintenance` 维保

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| - | - | - | - | - | - |

| Schema | 字段数（全量展开） |
|---|---|
| - | 0 |

#### ADM-020 `regions` regions（地区）

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/admin/regions` | `adminListRegions` | Y | Admin（管理后台）, Regions（地区） | 管理后台地区查询列表 |
| POST | `/admin/regions` | `adminCreateRegion` | Y | Admin（管理后台）, Regions（地区） | 管理后台地区提交 |
| PATCH | `/admin/regions/{regionCode}` | `adminUpdateRegion` | Y | Admin（管理后台）, Regions（地区） | 管理后台地区更新 |
| PUT | `/admin/regions/{regionCode}/industry-tags` | `adminSetRegionIndustryTags` | Y | Admin（管理后台）, Regions（地区） | 管理后台地区/行业标签更新 |

| Schema | 字段数（全量展开） |
|---|---|
| `ErrorResponse` | 3 |
| `RegionCreateRequest` | 7 |
| `RegionLevel` | 0 |
| `RegionNode` | 10 |
| `RegionUpdateRequest` | 6 |

#### ADM-021 `patents` patents（专利）

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/admin/patents` | `adminListPatents` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利查询列表 |
| POST | `/admin/patents` | `adminCreatePatent` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利提交 |
| GET | `/admin/patents/jobs/import` | `adminListPatentImportJobs` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利/任务/导入查询列表 |
| POST | `/admin/patents/jobs/import` | `adminCreatePatentImportJob` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利/任务/导入提交 |
| GET | `/admin/patents/jobs/import/{jobId}` | `adminGetPatentImportJob` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利/任务/导入查询详情 |
| GET | `/admin/patents/jobs/import/{jobId}/error-file` | `adminGetPatentImportJobErrorFile` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利/任务/导入/错误文件查询列表 |
| POST | `/admin/patents/jobs/import/{jobId}/execute` | `adminExecutePatentImportJob` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利/任务/导入/执行提交 |
| GET | `/admin/patents/jobs/import/{jobId}/rows` | `adminListPatentImportJobRows` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利/任务/导入/行查询列表 |
| POST | `/admin/patents/jobs/import/{jobId}/validate` | `adminValidatePatentImportJob` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利/任务/导入/校验提交 |
| POST | `/admin/patents/jobs/listings` | `adminGeneratePatentListings` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利/任务/挂牌提交 |
| GET | `/admin/patents/{patentId}` | `adminGetPatentById` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利查询详情 |
| PATCH | `/admin/patents/{patentId}` | `adminUpdatePatent` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利更新 |

| Schema | 字段数（全量展开） |
|---|---|
| `AuditStatus` | 0 |
| `ConsultationRouting` | 0 |
| `ErrorResponse` | 3 |
| `Jurisdiction` | 0 |
| `LegalStatus` | 0 |
| `LicenseMode` | 0 |
| `ListingJobErrorFile` | 3 |
| `ListingStatus` | 0 |
| `ListingTopic` | 0 |
| `MoneyFen` | 0 |
| `PageMeta` | 3 |
| `PagedPatent` | 79 |
| `PagedPatentImportJob` | 62 |
| `PagedPatentImportJobRow` | 24 |
| `Patent` | 71 |
| `PatentCreateRequest` | 21 |
| `PatentImportDefaults` | 27 |
| `PatentImportDuplicatePolicy` | 0 |
| `PatentImportJob` | 54 |
| `PatentImportJobCreateRequest` | 33 |
| `PatentImportJobRow` | 16 |
| `PatentImportListingDefaults` | 25 |
| `PatentImportRowStatus` | 0 |
| `PatentJobStatus` | 0 |
| `PatentListingGenerateRequest` | 32 |
| `PatentListingGenerateResult` | 14 |
| `PatentListingGenerateResultRow` | 7 |
| `PatentMedia` | 5 |
| `PatentOwnerClaimSource` | 0 |
| `PatentTradeSnapshot` | 22 |
| `PatentType` | 0 |
| `PatentUpdateRequest` | 18 |
| `PriceType` | 0 |
| `SupplyType` | 0 |
| `TradeMode` | 0 |
| `UserBrief` | 12 |
| `UserRole` | 0 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### ADM-022 `patents/operations` patentsoperations（专利操作）

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/admin/patents` | `adminListPatents` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利查询列表 |
| POST | `/admin/patents` | `adminCreatePatent` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利提交 |
| GET | `/admin/patents/jobs/import` | `adminListPatentImportJobs` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利/任务/导入查询列表 |
| POST | `/admin/patents/jobs/import` | `adminCreatePatentImportJob` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利/任务/导入提交 |
| GET | `/admin/patents/jobs/import/{jobId}` | `adminGetPatentImportJob` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利/任务/导入查询详情 |
| GET | `/admin/patents/jobs/import/{jobId}/error-file` | `adminGetPatentImportJobErrorFile` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利/任务/导入/错误文件查询列表 |
| POST | `/admin/patents/jobs/import/{jobId}/execute` | `adminExecutePatentImportJob` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利/任务/导入/执行提交 |
| GET | `/admin/patents/jobs/import/{jobId}/rows` | `adminListPatentImportJobRows` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利/任务/导入/行查询列表 |
| POST | `/admin/patents/jobs/import/{jobId}/validate` | `adminValidatePatentImportJob` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利/任务/导入/校验提交 |
| POST | `/admin/patents/jobs/listings` | `adminGeneratePatentListings` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利/任务/挂牌提交 |
| GET | `/admin/patents/{patentId}` | `adminGetPatentById` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利查询详情 |
| PATCH | `/admin/patents/{patentId}` | `adminUpdatePatent` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利更新 |

| Schema | 字段数（全量展开） |
|---|---|
| `AuditStatus` | 0 |
| `ConsultationRouting` | 0 |
| `ErrorResponse` | 3 |
| `Jurisdiction` | 0 |
| `LegalStatus` | 0 |
| `LicenseMode` | 0 |
| `ListingJobErrorFile` | 3 |
| `ListingStatus` | 0 |
| `ListingTopic` | 0 |
| `MoneyFen` | 0 |
| `PageMeta` | 3 |
| `PagedPatent` | 79 |
| `PagedPatentImportJob` | 62 |
| `PagedPatentImportJobRow` | 24 |
| `Patent` | 71 |
| `PatentCreateRequest` | 21 |
| `PatentImportDefaults` | 27 |
| `PatentImportDuplicatePolicy` | 0 |
| `PatentImportJob` | 54 |
| `PatentImportJobCreateRequest` | 33 |
| `PatentImportJobRow` | 16 |
| `PatentImportListingDefaults` | 25 |
| `PatentImportRowStatus` | 0 |
| `PatentJobStatus` | 0 |
| `PatentListingGenerateRequest` | 32 |
| `PatentListingGenerateResult` | 14 |
| `PatentListingGenerateResultRow` | 7 |
| `PatentMedia` | 5 |
| `PatentOwnerClaimSource` | 0 |
| `PatentTradeSnapshot` | 22 |
| `PatentType` | 0 |
| `PatentUpdateRequest` | 18 |
| `PriceType` | 0 |
| `SupplyType` | 0 |
| `TradeMode` | 0 |
| `UserBrief` | 12 |
| `UserRole` | 0 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### ADM-023 `patents/claims` patents认领（专利认领）

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/admin/patents` | `adminListPatents` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利查询列表 |
| POST | `/admin/patents` | `adminCreatePatent` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利提交 |
| GET | `/admin/patents/jobs/import` | `adminListPatentImportJobs` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利/任务/导入查询列表 |
| POST | `/admin/patents/jobs/import` | `adminCreatePatentImportJob` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利/任务/导入提交 |
| GET | `/admin/patents/jobs/import/{jobId}` | `adminGetPatentImportJob` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利/任务/导入查询详情 |
| GET | `/admin/patents/jobs/import/{jobId}/error-file` | `adminGetPatentImportJobErrorFile` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利/任务/导入/错误文件查询列表 |
| POST | `/admin/patents/jobs/import/{jobId}/execute` | `adminExecutePatentImportJob` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利/任务/导入/执行提交 |
| GET | `/admin/patents/jobs/import/{jobId}/rows` | `adminListPatentImportJobRows` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利/任务/导入/行查询列表 |
| POST | `/admin/patents/jobs/import/{jobId}/validate` | `adminValidatePatentImportJob` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利/任务/导入/校验提交 |
| POST | `/admin/patents/jobs/listings` | `adminGeneratePatentListings` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利/任务/挂牌提交 |
| GET | `/admin/patents/{patentId}` | `adminGetPatentById` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利查询详情 |
| PATCH | `/admin/patents/{patentId}` | `adminUpdatePatent` | Y | Admin（管理后台）, Patents（专利） | 管理后台专利更新 |

| Schema | 字段数（全量展开） |
|---|---|
| `AuditStatus` | 0 |
| `ConsultationRouting` | 0 |
| `ErrorResponse` | 3 |
| `Jurisdiction` | 0 |
| `LegalStatus` | 0 |
| `LicenseMode` | 0 |
| `ListingJobErrorFile` | 3 |
| `ListingStatus` | 0 |
| `ListingTopic` | 0 |
| `MoneyFen` | 0 |
| `PageMeta` | 3 |
| `PagedPatent` | 79 |
| `PagedPatentImportJob` | 62 |
| `PagedPatentImportJobRow` | 24 |
| `Patent` | 71 |
| `PatentCreateRequest` | 21 |
| `PatentImportDefaults` | 27 |
| `PatentImportDuplicatePolicy` | 0 |
| `PatentImportJob` | 54 |
| `PatentImportJobCreateRequest` | 33 |
| `PatentImportJobRow` | 16 |
| `PatentImportListingDefaults` | 25 |
| `PatentImportRowStatus` | 0 |
| `PatentJobStatus` | 0 |
| `PatentListingGenerateRequest` | 32 |
| `PatentListingGenerateResult` | 14 |
| `PatentListingGenerateResultRow` | 7 |
| `PatentMedia` | 5 |
| `PatentOwnerClaimSource` | 0 |
| `PatentTradeSnapshot` | 22 |
| `PatentType` | 0 |
| `PatentUpdateRequest` | 18 |
| `PriceType` | 0 |
| `SupplyType` | 0 |
| `TradeMode` | 0 |
| `UserBrief` | 12 |
| `UserRole` | 0 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### ADM-024 `conversations/platform` conversationsplatform（平台会话）

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| GET | `/admin/conversations/platform` | `adminListPlatformConversations` | Y | Admin（管理后台）, Messaging（消息会话） | 管理后台会话/平台查询列表 |

| Schema | 字段数（全量展开） |
|---|---|
| `ConversationContentType` | 0 |
| `ConversationSummary` | 33 |
| `ErrorResponse` | 3 |
| `ListingTopic` | 0 |
| `PageMeta` | 3 |
| `PagedConversationSummary` | 41 |
| `SupplyType` | 0 |
| `UserBrief` | 12 |
| `UserRole` | 0 |
| `Uuid` | 0 |
| `VerificationStatus` | 0 |
| `VerificationType` | 0 |

#### ADM-025 `/` 首页

| 方法 | 路径 | OperationId | 鉴权 | 标签 | 接口说明 |
|---|---|---|---|---|---|
| - | - | - | - | - | - |

| Schema | 字段数（全量展开） |
|---|---|
| - | 0 |

## 4. 接口清单（全量）

| 端别 | 方法 | 路径 | OperationId | 鉴权 | 标签 | 关联 Schema | 接口说明 |
|---|---|---|---|---|---|---|---|
| Client（小程序端） | GET | `/achievements` | `listMyAchievements` | Y | Achievements（成果） | AchievementMaturity, AchievementSummary, AuditStatus, ContentSource, ContentStatus, ErrorResponse, ListingStats, OrganizationStats, OrganizationSummary, PageMeta, PagedAchievementSummary, SupplyType, Uuid, VerificationStatus, VerificationType | 小程序端成果查询列表 |
| Client（小程序端） | POST | `/achievements` | `createAchievement` | Y | Achievements（成果） | AchievementCreateRequest, AchievementEdit, AchievementMaturity, AchievementSummary, AuditStatus, ContentMedia, ContentMediaInput, ContentMediaType, ContentSource, ContentStatus, ErrorResponse, ListingStats, OrganizationStats, OrganizationSummary, SupplyType, Uuid, VerificationStatus, VerificationType | 小程序端成果提交 |
| Client（小程序端） | GET | `/achievements/{achievementId}` | `getMyAchievementById` | Y | Achievements（成果） | AchievementEdit, AchievementMaturity, AchievementSummary, AuditStatus, ContentMedia, ContentMediaType, ContentSource, ContentStatus, ErrorResponse, ListingStats, OrganizationStats, OrganizationSummary, SupplyType, Uuid, VerificationStatus, VerificationType | 小程序端成果查询详情 |
| Client（小程序端） | PATCH | `/achievements/{achievementId}` | `updateMyAchievement` | Y | Achievements（成果） | AchievementEdit, AchievementMaturity, AchievementSummary, AchievementUpdateRequest, AuditStatus, ContentMedia, ContentMediaInput, ContentMediaType, ContentSource, ContentStatus, ErrorResponse, ListingStats, OrganizationStats, OrganizationSummary, SupplyType, Uuid, VerificationStatus, VerificationType | 小程序端成果更新 |
| Client（小程序端） | POST | `/achievements/{achievementId}/comments` | `createAchievementComment` | Y | Comments（评论）, Achievements（成果） | Comment, CommentContentType, CommentCreateRequest, CommentStatus, ErrorResponse, SupplyType, UserBrief, UserRole, Uuid, VerificationStatus, VerificationType | 小程序端成果/评论提交 |
| Client（小程序端） | POST | `/achievements/{achievementId}/consultations` | `createAchievementConsultation` | Y | Achievements（成果） | ErrorResponse, OkResponse, Uuid | 小程序端成果/咨询提交 |
| Client（小程序端） | POST | `/achievements/{achievementId}/conversations` | `upsertAchievementConversation` | Y | Messaging（消息会话）, Achievements（成果） | Conversation, ConversationContentType, ErrorResponse, Uuid | 小程序端成果/会话提交 |
| Client（小程序端） | POST | `/achievements/{achievementId}/favorites` | `favoriteAchievement` | Y | Achievements（成果） | ErrorResponse, OkResponse, Uuid | 小程序端成果/收藏提交 |
| Client（小程序端） | DELETE | `/achievements/{achievementId}/favorites` | `unfavoriteAchievement` | Y | Achievements（成果） | ErrorResponse, OkResponse, Uuid | 小程序端成果/收藏删除 |
| Client（小程序端） | POST | `/achievements/{achievementId}/off-shelf` | `offShelfAchievement` | Y | Achievements（成果） | AchievementMaturity, AchievementRecord, AuditStatus, ContentSource, ContentStatus, ErrorResponse, Uuid | 小程序端成果/下架提交 |
| Client（小程序端） | POST | `/achievements/{achievementId}/submit` | `submitAchievement` | Y | Achievements（成果） | AchievementMaturity, AchievementRecord, AuditStatus, ContentSource, ContentStatus, ErrorResponse, Uuid | 小程序端成果提交 |
| Admin（管理后台） | GET | `/admin/achievements` | `adminListAchievements` | Y | Admin（管理后台）, Achievements（成果） | AchievementMaturity, AchievementSummary, AuditStatus, ContentSource, ContentStatus, ErrorResponse, ListingStats, OrganizationStats, OrganizationSummary, PageMeta, PagedAchievementSummary, SupplyType, Uuid, VerificationStatus, VerificationType | 管理后台成果查询列表 |
| Admin（管理后台） | POST | `/admin/achievements` | `adminCreateAchievement` | Y | Admin（管理后台）, Achievements（成果） | AchievementAdminCreateRequest, AchievementCreateRequest, AchievementEdit, AchievementMaturity, AchievementSummary, AuditStatus, ContentMedia, ContentMediaInput, ContentMediaType, ContentSource, ContentStatus, ErrorResponse, ListingStats, OrganizationStats, OrganizationSummary, SupplyType, Uuid, VerificationStatus, VerificationType | 管理后台成果提交 |
| Admin（管理后台） | GET | `/admin/achievements/{achievementId}` | `adminGetAchievementById` | Y | Admin（管理后台）, Achievements（成果） | AchievementEdit, AchievementMaturity, AchievementSummary, AuditStatus, ContentMedia, ContentMediaType, ContentSource, ContentStatus, ErrorResponse, ListingStats, OrganizationStats, OrganizationSummary, SupplyType, Uuid, VerificationStatus, VerificationType | 管理后台成果查询详情 |
| Admin（管理后台） | PATCH | `/admin/achievements/{achievementId}` | `adminUpdateAchievement` | Y | Admin（管理后台）, Achievements（成果） | AchievementAdminUpdateRequest, AchievementEdit, AchievementMaturity, AchievementSummary, AchievementUpdateRequest, AuditStatus, ContentMedia, ContentMediaInput, ContentMediaType, ContentSource, ContentStatus, ErrorResponse, ListingStats, OrganizationStats, OrganizationSummary, SupplyType, Uuid, VerificationStatus, VerificationType | 管理后台成果更新 |
| Admin（管理后台） | POST | `/admin/achievements/{achievementId}/approve` | `adminApproveAchievement` | Y | Admin（管理后台）, Achievements（成果） | AchievementMaturity, AchievementRecord, AuditStatus, ContentSource, ContentStatus, ErrorResponse, Uuid | 管理后台成果/通过提交 |
| Admin（管理后台） | GET | `/admin/achievements/{achievementId}/audit-logs` | `adminGetAchievementAuditLogs` | Y | Admin（管理后台）, Achievements（成果） | AuditLog, AuditLogList, ErrorResponse, Uuid | 管理后台成果/审计日志查询列表 |
| Admin（管理后台） | GET | `/admin/achievements/{achievementId}/materials` | `adminGetAchievementMaterials` | Y | Admin（管理后台）, Achievements（成果） | AuditMaterial, AuditMaterialList, ErrorResponse, Uuid | 管理后台成果/材料查询列表 |
| Admin（管理后台） | POST | `/admin/achievements/{achievementId}/off-shelf` | `adminOffShelfAchievement` | Y | Admin（管理后台）, Achievements（成果） | AchievementMaturity, AchievementRecord, AuditStatus, ContentSource, ContentStatus, ErrorResponse, Uuid | 管理后台成果/下架提交 |
| Admin（管理后台） | POST | `/admin/achievements/{achievementId}/publish` | `adminPublishAchievement` | Y | Admin（管理后台）, Achievements（成果） | AchievementMaturity, AchievementRecord, AuditStatus, ContentSource, ContentStatus, ErrorResponse, Uuid | 管理后台成果/发布提交 |
| Admin（管理后台） | POST | `/admin/achievements/{achievementId}/reject` | `adminRejectAchievement` | Y | Admin（管理后台）, Achievements（成果） | AchievementMaturity, AchievementRecord, AuditStatus, ContentSource, ContentStatus, ErrorResponse, Uuid | 管理后台成果/驳回提交 |
| Admin（管理后台） | GET | `/admin/ai/parse-results` | `adminListAiParseResults` | Y | Admin（管理后台）, AI（智能解析） | AiContentType, AiParseResult, AiParseStatus, ErrorResponse, PageMeta, PagedAiParseResult, Uuid | 管理后台智能/解析结果查询列表 |
| Admin（管理后台） | GET | `/admin/ai/parse-results/{parseResultId}` | `adminGetAiParseResult` | Y | Admin（管理后台）, AI（智能解析） | AiContentType, AiParseResult, AiParseStatus, ErrorResponse, Uuid | 管理后台智能/解析结果查询详情 |
| Admin（管理后台） | PATCH | `/admin/ai/parse-results/{parseResultId}` | `adminUpdateAiParseResult` | Y | Admin（管理后台）, AI（智能解析） | AiContentType, AiParseResult, AiParseResultUpdateRequest, AiParseStatus, ErrorResponse, Uuid | 管理后台智能/解析结果更新 |
| Admin（管理后台） | GET | `/admin/alerts` | `adminListAlertEvents` | Y | Admin（管理后台）, Alerts（告警） | AlertChannel, AlertEvent, AlertSeverity, AlertStatus, AlertTargetType, ErrorResponse, PageMeta, PagedAlertEvent, Uuid | 管理后台告警查询列表 |
| Admin（管理后台） | POST | `/admin/alerts/{alertId}/ack` | `adminAcknowledgeAlertEvent` | Y | Admin（管理后台）, Alerts（告警） | AlertChannel, AlertEvent, AlertSeverity, AlertStatus, AlertTargetType, ErrorResponse, Uuid | 管理后台告警/确认提交 |
| Admin（管理后台） | GET | `/admin/audit-logs` | `adminListAuditLogs` | Y | Admin（管理后台） | AuditLog, ErrorResponse, PageMeta, PagedAuditLog, Uuid | 管理后台审计日志查询列表 |
| Admin（管理后台） | GET | `/admin/cases` | `adminListCases` | Y | Admin（管理后台）, Cases（工单） | CaseEvidence, CaseNote, CasePriority, CaseRecord, CaseSlaStatus, CaseStatus, CaseType, ErrorResponse, PageMeta, PagedCase, Uuid | 管理后台工单查询列表 |
| Admin（管理后台） | POST | `/admin/cases` | `adminCreateCase` | Y | Admin（管理后台）, Cases（工单） | CaseCreateRequest, CaseEvidence, CaseNote, CasePriority, CaseRecord, CaseSlaStatus, CaseStatus, CaseType, ErrorResponse, Uuid | 管理后台工单提交 |
| Admin（管理后台） | GET | `/admin/cases/{caseId}` | `adminGetCaseById` | Y | Admin（管理后台）, Cases（工单） | CaseEvidence, CaseNote, CasePriority, CaseRecord, CaseSlaStatus, CaseStatus, CaseType, ErrorResponse, Uuid | 管理后台工单查询详情 |
| Admin（管理后台） | POST | `/admin/cases/{caseId}/assign` | `adminAssignCase` | Y | Admin（管理后台）, Cases（工单） | CaseEvidence, CaseNote, CasePriority, CaseRecord, CaseSlaStatus, CaseStatus, CaseType, ErrorResponse, Uuid | 管理后台工单/分配提交 |
| Admin（管理后台） | POST | `/admin/cases/{caseId}/evidence` | `adminAddCaseEvidence` | Y | Admin（管理后台）, Cases（工单） | CaseEvidence, CaseNote, CasePriority, CaseRecord, CaseSlaStatus, CaseStatus, CaseType, ErrorResponse, Uuid | 管理后台工单/凭证提交 |
| Admin（管理后台） | POST | `/admin/cases/{caseId}/notes` | `adminAddCaseNote` | Y | Admin（管理后台）, Cases（工单） | CaseEvidence, CaseNote, CasePriority, CaseRecord, CaseSlaStatus, CaseStatus, CaseType, ErrorResponse, Uuid | 管理后台工单/备注提交 |
| Admin（管理后台） | POST | `/admin/cases/{caseId}/sla` | `adminUpdateCaseSla` | Y | Admin（管理后台）, Cases（工单） | CaseEvidence, CaseNote, CasePriority, CaseRecord, CaseSlaStatus, CaseStatus, CaseType, ErrorResponse, Uuid | 管理后台工单/服务时效提交 |
| Admin（管理后台） | POST | `/admin/cases/{caseId}/status` | `adminUpdateCaseStatus` | Y | Admin（管理后台）, Cases（工单） | CaseEvidence, CaseNote, CasePriority, CaseRecord, CaseSlaStatus, CaseStatus, CaseType, ErrorResponse, Uuid | 管理后台工单/状态提交 |
| Admin（管理后台） | GET | `/admin/comments` | `adminListComments` | Y | Admin（管理后台） | Comment, CommentContentType, CommentStatus, ErrorResponse, PageMeta, PagedComment, SupplyType, UserBrief, UserRole, Uuid, VerificationStatus, VerificationType | 管理后台评论查询列表 |
| Admin（管理后台） | PATCH | `/admin/comments/{commentId}` | `adminUpdateComment` | Y | Admin（管理后台） | AdminCommentUpdateRequest, Comment, CommentContentType, CommentStatus, ErrorResponse, SupplyType, UserBrief, UserRole, Uuid, VerificationStatus, VerificationType | 管理后台评论更新 |
| Admin（管理后台） | GET | `/admin/config/alerts` | `adminGetAlertConfig` | Y | Admin（管理后台）, Config（配置）, Alerts（告警） | AlertChannel, AlertConfig, AlertRule, AlertSeverity, ErrorResponse | 管理后台配置/告警查询列表 |
| Admin（管理后台） | PUT | `/admin/config/alerts` | `adminUpdateAlertConfig` | Y | Admin（管理后台）, Config（配置）, Alerts（告警） | AlertChannel, AlertConfig, AlertConfigUpdateRequest, AlertRule, AlertSeverity, ErrorResponse | 管理后台配置/告警更新 |
| Admin（管理后台） | GET | `/admin/config/banner` | `adminGetBannerConfig` | Y | Admin（管理后台）, Config（配置） | BannerConfig, BannerItem, ErrorResponse | 管理后台配置/横幅查询列表 |
| Admin（管理后台） | PUT | `/admin/config/banner` | `adminUpdateBannerConfig` | Y | Admin（管理后台）, Config（配置） | BannerConfig, BannerItem, ErrorResponse | 管理后台配置/横幅更新 |
| Admin（管理后台） | GET | `/admin/config/customer-service` | `adminGetCustomerServiceConfig` | Y | Admin（管理后台）, Config（配置） | CustomerServiceConfig, ErrorResponse | 管理后台配置/客户服务查询列表 |
| Admin（管理后台） | PUT | `/admin/config/customer-service` | `adminUpdateCustomerServiceConfig` | Y | Admin（管理后台）, Config（配置） | CustomerServiceAssignStrategy, CustomerServiceConfig, CustomerServiceConfigUpdateRequest, ErrorResponse | 管理后台配置/客户服务更新 |
| Admin（管理后台） | GET | `/admin/config/home-announcements` | `adminGetHomeAnnouncementsConfig` | Y | Admin（管理后台）, Config（配置） | ErrorResponse, HomeAnnouncementConfig, HomeAnnouncementItem, HomeAnnouncementStatus, HomeAnnouncementTemplate | 管理后台配置/首页公告查询列表 |
| Admin（管理后台） | POST | `/admin/config/home-announcements/items` | `adminCreateHomeAnnouncementItem` | Y | Admin（管理后台）, Config（配置） | ErrorResponse, HomeAnnouncementItem, HomeAnnouncementItemCreateRequest, HomeAnnouncementStatus | 管理后台配置/首页公告/条目提交 |
| Admin（管理后台） | PUT | `/admin/config/home-announcements/items/{itemId}` | `adminUpdateHomeAnnouncementItem` | Y | Admin（管理后台）, Config（配置） | ErrorResponse, HomeAnnouncementItem, HomeAnnouncementItemUpdateRequest, HomeAnnouncementStatus | 管理后台配置/首页公告/条目更新 |
| Admin（管理后台） | DELETE | `/admin/config/home-announcements/items/{itemId}` | `adminDeleteHomeAnnouncementItem` | Y | Admin（管理后台）, Config（配置） | ErrorResponse, HomeAnnouncementItemDeleteResult | 管理后台配置/首页公告/条目删除 |
| Admin（管理后台） | POST | `/admin/config/home-announcements/items/{itemId}/offline` | `adminOfflineHomeAnnouncementItem` | Y | Admin（管理后台）, Config（配置） | ErrorResponse, HomeAnnouncementItem, HomeAnnouncementStatus | 管理后台配置/首页公告/条目/下线提交 |
| Admin（管理后台） | POST | `/admin/config/home-announcements/items/{itemId}/publish` | `adminPublishHomeAnnouncementItem` | Y | Admin（管理后台）, Config（配置） | ErrorResponse, HomeAnnouncementItem, HomeAnnouncementStatus | 管理后台配置/首页公告/条目/发布提交 |
| Admin（管理后台） | POST | `/admin/config/home-announcements/templates` | `adminCreateHomeAnnouncementTemplate` | Y | Admin（管理后台）, Config（配置） | ErrorResponse, HomeAnnouncementTemplate, HomeAnnouncementTemplateCreateRequest | 管理后台配置/首页公告/模板提交 |
| Admin（管理后台） | PUT | `/admin/config/home-announcements/templates/{templateId}` | `adminUpdateHomeAnnouncementTemplate` | Y | Admin（管理后台）, Config（配置） | ErrorResponse, HomeAnnouncementTemplate, HomeAnnouncementTemplateUpdateRequest | 管理后台配置/首页公告/模板更新 |
| Admin（管理后台） | DELETE | `/admin/config/home-announcements/templates/{templateId}` | `adminDeleteHomeAnnouncementTemplate` | Y | Admin（管理后台）, Config（配置） | ErrorResponse, HomeAnnouncementTemplateDeleteResult | 管理后台配置/首页公告/模板删除 |
| Admin（管理后台） | GET | `/admin/config/hot-search` | `adminGetHotSearchConfig` | Y | Admin（管理后台）, Config（配置） | ErrorResponse, HotSearchConfig | 管理后台配置/热门搜索查询列表 |
| Admin（管理后台） | PUT | `/admin/config/hot-search` | `adminUpdateHotSearchConfig` | Y | Admin（管理后台）, Config（配置） | ErrorResponse, HotSearchConfig | 管理后台配置/热门搜索更新 |
| Admin（管理后台） | GET | `/admin/config/recommendation` | `adminGetRecommendationConfig` | Y | Admin（管理后台）, Config（配置） | ErrorResponse, RecommendationConfig, RecommendationFeaturedBoost, RecommendationWeights | 管理后台配置/推荐查询列表 |
| Admin（管理后台） | PUT | `/admin/config/recommendation` | `adminUpdateRecommendationConfig` | Y | Admin（管理后台）, Config（配置） | ErrorResponse, RecommendationConfig, RecommendationConfigUpdateRequest, RecommendationFeaturedBoost, RecommendationWeights | 管理后台配置/推荐更新 |
| Admin（管理后台） | GET | `/admin/config/sensitive-words` | `adminGetSensitiveWordsConfig` | Y | Admin（管理后台）, Config（配置） | ErrorResponse, SensitiveWordsConfig | 管理后台配置/敏感词查询列表 |
| Admin（管理后台） | PUT | `/admin/config/sensitive-words` | `adminUpdateSensitiveWordsConfig` | Y | Admin（管理后台）, Config（配置） | ErrorResponse, SensitiveWordsConfig | 管理后台配置/敏感词更新 |
| Admin（管理后台） | GET | `/admin/config/taxonomy` | `adminGetTaxonomyConfig` | Y | Admin（管理后台）, Config（配置） | ErrorResponse, TaxonomyConfig | 管理后台配置/分类查询列表 |
| Admin（管理后台） | PUT | `/admin/config/taxonomy` | `adminUpdateTaxonomyConfig` | Y | Admin（管理后台）, Config（配置） | ErrorResponse, TaxonomyConfig | 管理后台配置/分类更新 |
| Admin（管理后台） | GET | `/admin/config/trade-rules` | `adminGetTradeRulesConfig` | Y | Admin（管理后台）, Config（配置） | ErrorResponse, MoneyFen, PayoutCondition, PayoutMethod, TradeRulesConfig | 管理后台配置/交易规则查询列表 |
| Admin（管理后台） | PUT | `/admin/config/trade-rules` | `adminUpdateTradeRulesConfig` | Y | Admin（管理后台）, Config（配置） | ErrorResponse, MoneyFen, PayoutCondition, PayoutMethod, TradeRulesConfig, TradeRulesConfigUpdateRequest | 管理后台配置/交易规则更新 |
| Admin（管理后台） | GET | `/admin/conversations/platform` | `adminListPlatformConversations` | Y | Admin（管理后台）, Messaging（消息会话） | ConversationContentType, ConversationSummary, ErrorResponse, ListingTopic, PageMeta, PagedConversationSummary, SupplyType, UserBrief, UserRole, Uuid, VerificationStatus, VerificationType | 管理后台会话/平台查询列表 |
| Admin（管理后台） | POST | `/admin/conversations/{conversationId}/agents` | `adminAssignPlatformConversationAgent` | Y | Admin（管理后台）, Messaging（消息会话） | ConversationAgentAssignment, ConversationAgentAssignmentRequest, ErrorResponse, Uuid | 管理后台会话/坐席提交 |
| Admin（管理后台） | DELETE | `/admin/conversations/{conversationId}/agents/{userId}` | `adminRemovePlatformConversationAgent` | Y | Admin（管理后台）, Messaging（消息会话） | ConversationAgentAssignment, ErrorResponse, Uuid | 管理后台会话/坐席删除 |
| Admin（管理后台） | GET | `/admin/industry-tags` | `adminListIndustryTags` | Y | Admin（管理后台）, Regions（地区） | ErrorResponse, IndustryTag, Uuid | 管理后台行业标签查询列表 |
| Admin（管理后台） | POST | `/admin/industry-tags` | `adminCreateIndustryTag` | Y | Admin（管理后台）, Regions（地区） | ErrorResponse, IndustryTag, IndustryTagCreateRequest, Uuid | 管理后台行业标签提交 |
| Admin（管理后台） | GET | `/admin/listings` | `adminListListingsForAudit` | Y | Admin（管理后台） | AiContentType, AiParseResult, AiParseStatus, AuditStatus, ConsultationRouting, ContentSource, ErrorResponse, ExistingLicenseStatus, FeaturedLevel, LegalStatus, LicenseMode, Listing, ListingMedia, ListingStats, ListingStatus, ListingSummary, ListingTopic, MoneyFen, PageMeta, PagedListing, PatentType, PledgeStatus, PriceType, TradeMode, Uuid | 管理后台挂牌查询列表 |
| Admin（管理后台） | POST | `/admin/listings` | `adminCreateListing` | Y | Admin（管理后台） | AdminListingCreateRequest, AiContentType, AiParseResult, AiParseStatus, AuditStatus, ConsultationRouting, ContentSource, ErrorResponse, ExistingLicenseStatus, FeaturedLevel, LegalStatus, LicenseMode, Listing, ListingCreateRequest, ListingMedia, ListingStats, ListingStatus, ListingSummary, ListingTopic, MoneyFen, PatentType, PledgeStatus, PriceType, TradeMode, Uuid | 管理后台挂牌提交 |
| Admin（管理后台） | GET | `/admin/listings/jobs/batch` | `adminListListingBatchJobs` | Y | Admin（管理后台） | ErrorResponse, ListingBatchAction, ListingBatchJob, ListingJobStatus, PageMeta, PagedListingBatchJob, Uuid | 管理后台挂牌/任务/批次查询列表 |
| Admin（管理后台） | POST | `/admin/listings/jobs/batch` | `adminCreateListingBatchJob` | Y | Admin（管理后台） | ErrorResponse, ListingBatchAction, ListingBatchJob, ListingBatchJobCreateRequest, ListingJobStatus, Uuid | 管理后台挂牌/任务/批次提交 |
| Admin（管理后台） | GET | `/admin/listings/jobs/batch/{jobId}` | `adminGetListingBatchJob` | Y | Admin（管理后台） | ErrorResponse, ListingBatchAction, ListingBatchJob, ListingJobStatus, Uuid | 管理后台挂牌/任务/批次查询详情 |
| Admin（管理后台） | GET | `/admin/listings/jobs/batch/{jobId}/error-file` | `adminGetListingBatchJobErrorFile` | Y | Admin（管理后台） | ErrorResponse, ListingJobErrorFile, Uuid | 管理后台挂牌/任务/批次/错误文件查询列表 |
| Admin（管理后台） | GET | `/admin/listings/jobs/batch/{jobId}/items` | `adminListListingBatchJobItems` | Y | Admin（管理后台） | ErrorResponse, ListingBatchItemStatus, ListingBatchJobItem, PageMeta, PagedListingBatchJobItem, Uuid | 管理后台挂牌/任务/批次/条目查询列表 |
| Admin（管理后台） | GET | `/admin/listings/jobs/import` | `adminListListingImportJobs` | Y | Admin（管理后台） | AuditStatus, ConsultationRouting, ContentSource, ErrorResponse, LicenseMode, ListingImportDefaults, ListingImportDuplicatePolicy, ListingImportJob, ListingJobStatus, ListingStatus, ListingTopic, MoneyFen, PageMeta, PagedListingImportJob, PriceType, TradeMode, Uuid | 管理后台挂牌/任务/导入查询列表 |
| Admin（管理后台） | POST | `/admin/listings/jobs/import` | `adminCreateListingImportJob` | Y | Admin（管理后台） | AuditStatus, ConsultationRouting, ContentSource, ErrorResponse, LicenseMode, ListingImportDefaults, ListingImportDuplicatePolicy, ListingImportJob, ListingImportJobCreateRequest, ListingJobStatus, ListingStatus, ListingTopic, MoneyFen, PriceType, TradeMode, Uuid | 管理后台挂牌/任务/导入提交 |
| Admin（管理后台） | GET | `/admin/listings/jobs/import/{jobId}` | `adminGetListingImportJob` | Y | Admin（管理后台） | AuditStatus, ConsultationRouting, ContentSource, ErrorResponse, LicenseMode, ListingImportDefaults, ListingImportDuplicatePolicy, ListingImportJob, ListingJobStatus, ListingStatus, ListingTopic, MoneyFen, PriceType, TradeMode, Uuid | 管理后台挂牌/任务/导入查询详情 |
| Admin（管理后台） | GET | `/admin/listings/jobs/import/{jobId}/error-file` | `adminGetListingImportJobErrorFile` | Y | Admin（管理后台） | ErrorResponse, ListingJobErrorFile, Uuid | 管理后台挂牌/任务/导入/错误文件查询列表 |
| Admin（管理后台） | POST | `/admin/listings/jobs/import/{jobId}/execute` | `adminExecuteListingImportJob` | Y | Admin（管理后台） | AuditStatus, ConsultationRouting, ContentSource, ErrorResponse, LicenseMode, ListingImportDefaults, ListingImportDuplicatePolicy, ListingImportJob, ListingJobStatus, ListingStatus, ListingTopic, MoneyFen, PriceType, TradeMode, Uuid | 管理后台挂牌/任务/导入/执行提交 |
| Admin（管理后台） | GET | `/admin/listings/jobs/import/{jobId}/rows` | `adminListListingImportJobRows` | Y | Admin（管理后台） | ErrorResponse, ListingImportJobRow, ListingImportRowStatus, PageMeta, PagedListingImportJobRow, Uuid | 管理后台挂牌/任务/导入/行查询列表 |
| Admin（管理后台） | POST | `/admin/listings/jobs/import/{jobId}/validate` | `adminValidateListingImportJob` | Y | Admin（管理后台） | AuditStatus, ConsultationRouting, ContentSource, ErrorResponse, LicenseMode, ListingImportDefaults, ListingImportDuplicatePolicy, ListingImportJob, ListingJobStatus, ListingStatus, ListingTopic, MoneyFen, PriceType, TradeMode, Uuid | 管理后台挂牌/任务/导入/校验提交 |
| Admin（管理后台） | GET | `/admin/listings/{listingId}` | `adminGetListingById` | Y | Admin（管理后台） | AiContentType, AiParseResult, AiParseStatus, AuditStatus, ConsultationRouting, ContentSource, ErrorResponse, ExistingLicenseStatus, FeaturedLevel, LegalStatus, LicenseMode, Listing, ListingMedia, ListingStats, ListingStatus, ListingSummary, ListingTopic, MoneyFen, PatentType, PledgeStatus, PriceType, TradeMode, Uuid | 管理后台挂牌查询详情 |
| Admin（管理后台） | PATCH | `/admin/listings/{listingId}` | `adminUpdateListing` | Y | Admin（管理后台） | AdminListingUpdateRequest, AiContentType, AiParseResult, AiParseStatus, AuditStatus, ConsultationRouting, ContentSource, ErrorResponse, ExistingLicenseStatus, FeaturedLevel, LegalStatus, LicenseMode, Listing, ListingMedia, ListingStats, ListingStatus, ListingSummary, ListingTopic, ListingUpdateRequest, MoneyFen, PatentType, PledgeStatus, PriceType, TradeMode, Uuid | 管理后台挂牌更新 |
| Admin（管理后台） | POST | `/admin/listings/{listingId}/approve` | `adminApproveListing` | Y | Admin（管理后台） | AiContentType, AiParseResult, AiParseStatus, AuditStatus, ConsultationRouting, ContentSource, ErrorResponse, ExistingLicenseStatus, FeaturedLevel, LegalStatus, LicenseMode, Listing, ListingMedia, ListingStats, ListingStatus, ListingSummary, ListingTopic, MoneyFen, PatentType, PledgeStatus, PriceType, TradeMode, Uuid | 管理后台挂牌/通过提交 |
| Admin（管理后台） | GET | `/admin/listings/{listingId}/audit-logs` | `adminGetListingAuditLogs` | Y | Admin（管理后台） | AuditLog, AuditLogList, ErrorResponse, Uuid | 管理后台挂牌/审计日志查询列表 |
| Admin（管理后台） | PUT | `/admin/listings/{listingId}/featured` | `adminSetListingFeatured` | Y | Admin（管理后台） | AiContentType, AiParseResult, AiParseStatus, AuditStatus, ConsultationRouting, ContentSource, ErrorResponse, ExistingLicenseStatus, FeaturedLevel, LegalStatus, LicenseMode, Listing, ListingFeaturedUpdateRequest, ListingMedia, ListingStats, ListingStatus, ListingSummary, ListingTopic, MoneyFen, PatentType, PledgeStatus, PriceType, TradeMode, Uuid | 管理后台挂牌/推荐更新 |
| Admin（管理后台） | GET | `/admin/listings/{listingId}/materials` | `adminGetListingMaterials` | Y | Admin（管理后台） | AuditMaterial, AuditMaterialList, ErrorResponse, Uuid | 管理后台挂牌/材料查询列表 |
| Admin（管理后台） | POST | `/admin/listings/{listingId}/off-shelf` | `adminOffShelfListing` | Y | Admin（管理后台） | AiContentType, AiParseResult, AiParseStatus, AuditStatus, ConsultationRouting, ContentSource, ErrorResponse, ExistingLicenseStatus, FeaturedLevel, LegalStatus, LicenseMode, Listing, ListingMedia, ListingStats, ListingStatus, ListingSummary, ListingTopic, MoneyFen, PatentType, PledgeStatus, PriceType, TradeMode, Uuid | 管理后台挂牌/下架提交 |
| Admin（管理后台） | POST | `/admin/listings/{listingId}/publish` | `adminPublishListing` | Y | Admin（管理后台） | AiContentType, AiParseResult, AiParseStatus, AuditStatus, ConsultationRouting, ContentSource, ErrorResponse, ExistingLicenseStatus, FeaturedLevel, LegalStatus, LicenseMode, Listing, ListingMedia, ListingStats, ListingStatus, ListingSummary, ListingTopic, MoneyFen, PatentType, PledgeStatus, PriceType, TradeMode, Uuid | 管理后台挂牌/发布提交 |
| Admin（管理后台） | POST | `/admin/listings/{listingId}/reject` | `adminRejectListing` | Y | Admin（管理后台） | AiContentType, AiParseResult, AiParseStatus, AuditStatus, ConsultationRouting, ContentSource, ErrorResponse, ExistingLicenseStatus, FeaturedLevel, LegalStatus, LicenseMode, Listing, ListingMedia, ListingStats, ListingStatus, ListingSummary, ListingTopic, MoneyFen, PatentType, PledgeStatus, PriceType, TradeMode, Uuid | 管理后台挂牌/驳回提交 |
| Admin（管理后台） | GET | `/admin/orders/{orderId}` | `adminGetOrderById` | Y | Admin（管理后台） | ErrorResponse, FileObject, MoneyFen, Order, OrderInvoice, OrderStatus, Uuid | 管理后台订单查询详情 |
| Admin（管理后台） | POST | `/admin/orders/{orderId}/invoice` | `adminIssueOrderInvoice` | Y | Admin（管理后台） | ErrorResponse, OrderInvoiceIssueResponse, Uuid | 管理后台订单/发票提交 |
| Admin（管理后台） | PUT | `/admin/orders/{orderId}/invoice` | `adminUpsertOrderInvoice` | Y | Admin（管理后台） | ErrorResponse, FileObject, MoneyFen, OrderInvoice, OrderInvoiceUpsertRequest, Uuid | 管理后台订单/发票更新 |
| Admin（管理后台） | DELETE | `/admin/orders/{orderId}/invoice` | `adminDeleteOrderInvoice` | Y | Admin（管理后台） | ErrorResponse, Uuid | 管理后台订单/发票删除 |
| Admin（管理后台） | POST | `/admin/orders/{orderId}/milestones/contract-signed` | `adminConfirmContractSigned` | Y | Admin（管理后台） | ErrorResponse, FileObject, MoneyFen, Order, OrderInvoice, OrderStatus, Uuid | 管理后台订单/里程碑/合同签署提交 |
| Admin（管理后台） | POST | `/admin/orders/{orderId}/milestones/transfer-completed` | `adminConfirmTransferCompleted` | Y | Admin（管理后台） | ErrorResponse, FileObject, MoneyFen, Order, OrderInvoice, OrderStatus, Uuid | 管理后台订单/里程碑/转让完成提交 |
| Admin（管理后台） | POST | `/admin/orders/{orderId}/payments/manual` | `adminManualConfirmPayment` | Y | Admin（管理后台）, Payments（支付） | ErrorResponse, ManualPaymentConfirmRequest, ManualPaymentConfirmResponse, MoneyFen, PayType, PaymentStatus, Uuid | 管理后台订单/支付/手动提交 |
| Admin（管理后台） | POST | `/admin/orders/{orderId}/payouts/manual` | `adminConfirmManualPayout` | Y | Admin（管理后台） | ErrorResponse, ManualPayoutConfirmRequest, MoneyFen, PayoutMethod, PayoutStatus, Settlement, Uuid | 管理后台订单/放款/手动提交 |
| Admin（管理后台） | GET | `/admin/orders/{orderId}/settlement` | `adminGetOrderSettlement` | Y | Admin（管理后台） | ErrorResponse, MoneyFen, PayoutMethod, PayoutStatus, Settlement, Uuid | 管理后台订单/结算查询列表 |
| Admin（管理后台） | GET | `/admin/patent-claims` | `adminListPatentClaims` | Y | Admin（管理后台）, Patents（专利） | ErrorResponse, PageMeta, PagedPatentClaimRequest, PatentClaimRequest, PatentClaimStatus, Uuid | 管理后台专利认领查询列表 |
| Admin（管理后台） | POST | `/admin/patent-claims/{claimId}/approve` | `adminApprovePatentClaim` | Y | Admin（管理后台）, Patents（专利） | ErrorResponse, PatentClaimRequest, PatentClaimReviewRequest, PatentClaimStatus, Uuid | 管理后台专利认领/通过提交 |
| Admin（管理后台） | POST | `/admin/patent-claims/{claimId}/reject` | `adminRejectPatentClaim` | Y | Admin（管理后台）, Patents（专利） | ErrorResponse, PatentClaimRejectRequest, PatentClaimRequest, PatentClaimStatus, Uuid | 管理后台专利认领/驳回提交 |
| Admin（管理后台） | GET | `/admin/patent-maintenance/orders` | `adminListPatentMaintenanceOrders` | Y | Admin（管理后台）, Maintenance（专利维保） | ErrorResponse, PageMeta, PagedPatentMaintenanceOrder, PatentMaintenanceOrder, PatentMaintenanceOrderStatus, PatentMaintenancePaymentChannel, PatentMaintenanceReconcileStatus, Uuid | 管理后台专利维保/订单查询列表 |
| Admin（管理后台） | POST | `/admin/patent-maintenance/orders` | `adminCreatePatentMaintenanceOrder` | Y | Admin（管理后台）, Maintenance（专利维保） | ErrorResponse, PatentMaintenanceOrder, PatentMaintenanceOrderCreateRequest, PatentMaintenanceOrderStatus, PatentMaintenancePaymentChannel, PatentMaintenanceReconcileStatus, Uuid | 管理后台专利维保/订单提交 |
| Admin（管理后台） | GET | `/admin/patent-maintenance/orders/{orderId}` | `adminGetPatentMaintenanceOrder` | Y | Admin（管理后台）, Maintenance（专利维保） | ErrorResponse, PatentMaintenanceOrder, PatentMaintenanceOrderStatus, PatentMaintenancePaymentChannel, PatentMaintenanceReconcileStatus, Uuid | 管理后台专利维保/订单查询详情 |
| Admin（管理后台） | POST | `/admin/patent-maintenance/orders/{orderId}/cancel` | `adminCancelPatentMaintenanceOrder` | Y | Admin（管理后台）, Maintenance（专利维保） | ErrorResponse, PatentMaintenanceOrder, PatentMaintenanceOrderCancelRequest, PatentMaintenanceOrderStatus, PatentMaintenancePaymentChannel, PatentMaintenanceReconcileStatus, Uuid | 管理后台专利维保/订单/取消提交 |
| Admin（管理后台） | POST | `/admin/patent-maintenance/orders/{orderId}/close` | `adminClosePatentMaintenanceOrder` | Y | Admin（管理后台）, Maintenance（专利维保） | ErrorResponse, PatentMaintenanceOrder, PatentMaintenanceOrderCloseRequest, PatentMaintenanceOrderStatus, PatentMaintenancePaymentChannel, PatentMaintenanceReconcileStatus, Uuid | 管理后台专利维保/订单/关闭提交 |
| Admin（管理后台） | GET | `/admin/patent-maintenance/orders/{orderId}/events` | `adminListPatentMaintenanceOrderEvents` | Y | Admin（管理后台）, Maintenance（专利维保） | ErrorResponse, PatentMaintenanceOrderEvent, PatentMaintenanceOrderEventList, PatentMaintenanceOrderEventType, PatentMaintenanceOrderStatus, Uuid | 管理后台专利维保/订单/事件查询列表 |
| Admin（管理后台） | POST | `/admin/patent-maintenance/orders/{orderId}/execution` | `adminSubmitPatentMaintenanceOrderExecution` | Y | Admin（管理后台）, Maintenance（专利维保） | ErrorResponse, PatentMaintenanceOrder, PatentMaintenanceOrderExecutionRequest, PatentMaintenanceOrderStatus, PatentMaintenancePaymentChannel, PatentMaintenanceReconcileStatus, Uuid | 管理后台专利维保/订单/执行提交 |
| Admin（管理后台） | POST | `/admin/patent-maintenance/orders/{orderId}/payment-confirm` | `adminConfirmPatentMaintenanceOrderPayment` | Y | Admin（管理后台）, Maintenance（专利维保） | ErrorResponse, PatentMaintenanceOrder, PatentMaintenanceOrderPaymentConfirmRequest, PatentMaintenanceOrderStatus, PatentMaintenancePaymentChannel, PatentMaintenanceReconcileStatus, Uuid | 管理后台专利维保/订单/支付确认提交 |
| Admin（管理后台） | POST | `/admin/patent-maintenance/orders/{orderId}/quote` | `adminQuotePatentMaintenanceOrder` | Y | Admin（管理后台）, Maintenance（专利维保） | ErrorResponse, PatentMaintenanceOrder, PatentMaintenanceOrderQuoteRequest, PatentMaintenanceOrderStatus, PatentMaintenancePaymentChannel, PatentMaintenanceReconcileStatus, Uuid | 管理后台专利维保/订单/报价提交 |
| Admin（管理后台） | POST | `/admin/patent-maintenance/orders/{orderId}/receipt` | `adminUploadPatentMaintenanceOrderReceipt` | Y | Admin（管理后台）, Maintenance（专利维保） | ErrorResponse, PatentMaintenanceOrder, PatentMaintenanceOrderReceiptRequest, PatentMaintenanceOrderStatus, PatentMaintenancePaymentChannel, PatentMaintenanceReconcileStatus, Uuid | 管理后台专利维保/订单/回执提交 |
| Admin（管理后台） | POST | `/admin/patent-maintenance/orders/{orderId}/reconcile` | `adminReconcilePatentMaintenanceOrder` | Y | Admin（管理后台）, Maintenance（专利维保） | ErrorResponse, PatentMaintenanceOrder, PatentMaintenanceOrderReconcileRequest, PatentMaintenanceOrderStatus, PatentMaintenancePaymentChannel, PatentMaintenanceReconcileStatus, Uuid | 管理后台专利维保/订单/对账提交 |
| Admin（管理后台） | GET | `/admin/patent-maintenance/schedules` | `adminListPatentMaintenanceSchedules` | Y | Admin（管理后台）, Maintenance（专利维保） | ErrorResponse, PageMeta, PagedPatentMaintenanceSchedule, PatentMaintenanceSchedule, PatentMaintenanceStatus, Uuid | 管理后台专利维保/日程查询列表 |
| Admin（管理后台） | POST | `/admin/patent-maintenance/schedules` | `adminCreatePatentMaintenanceSchedule` | Y | Admin（管理后台）, Maintenance（专利维保） | ErrorResponse, PatentMaintenanceSchedule, PatentMaintenanceScheduleCreateRequest, PatentMaintenanceStatus, Uuid | 管理后台专利维保/日程提交 |
| Admin（管理后台） | GET | `/admin/patent-maintenance/schedules/{scheduleId}` | `adminGetPatentMaintenanceSchedule` | Y | Admin（管理后台）, Maintenance（专利维保） | ErrorResponse, PatentMaintenanceSchedule, PatentMaintenanceStatus, Uuid | 管理后台专利维保/日程查询详情 |
| Admin（管理后台） | PATCH | `/admin/patent-maintenance/schedules/{scheduleId}` | `adminUpdatePatentMaintenanceSchedule` | Y | Admin（管理后台）, Maintenance（专利维保） | ErrorResponse, PatentMaintenanceSchedule, PatentMaintenanceScheduleUpdateRequest, PatentMaintenanceStatus, Uuid | 管理后台专利维保/日程更新 |
| Admin（管理后台） | GET | `/admin/patent-maintenance/tasks` | `adminListPatentMaintenanceTasks` | Y | Admin（管理后台）, Maintenance（专利维保） | ErrorResponse, PageMeta, PagedPatentMaintenanceTask, PatentMaintenanceTask, PatentMaintenanceTaskStatus, Uuid | 管理后台专利维保/任务查询列表 |
| Admin（管理后台） | POST | `/admin/patent-maintenance/tasks` | `adminCreatePatentMaintenanceTask` | Y | Admin（管理后台）, Maintenance（专利维保） | ErrorResponse, PatentMaintenanceTask, PatentMaintenanceTaskCreateRequest, PatentMaintenanceTaskStatus, Uuid | 管理后台专利维保/任务提交 |
| Admin（管理后台） | PATCH | `/admin/patent-maintenance/tasks/{taskId}` | `adminUpdatePatentMaintenanceTask` | Y | Admin（管理后台）, Maintenance（专利维保） | ErrorResponse, PatentMaintenanceTask, PatentMaintenanceTaskStatus, PatentMaintenanceTaskUpdateRequest, Uuid | 管理后台专利维保/任务更新 |
| Admin（管理后台） | POST | `/admin/patent-map/listings/batch` | `adminBatchUpdatePatentMapListings` | Y | Admin（管理后台）, Listings（挂牌） | ErrorResponse, FeaturedLevel, PatentMapBatchUpdateRequest, PatentMapBatchUpdateResponse, PatentMapListingPatch, Uuid | 管理后台专利地图/挂牌/批次提交 |
| Admin（管理后台） | GET | `/admin/patents` | `adminListPatents` | Y | Admin（管理后台）, Patents（专利） | ErrorResponse, Jurisdiction, LegalStatus, PageMeta, PagedPatent, Patent, PatentMedia, PatentOwnerClaimSource, PatentTradeSnapshot, PatentType, PriceType, SupplyType, UserBrief, UserRole, Uuid, VerificationStatus, VerificationType | 管理后台专利查询列表 |
| Admin（管理后台） | POST | `/admin/patents` | `adminCreatePatent` | Y | Admin（管理后台）, Patents（专利） | ErrorResponse, Jurisdiction, LegalStatus, Patent, PatentCreateRequest, PatentMedia, PatentOwnerClaimSource, PatentTradeSnapshot, PatentType, PriceType, SupplyType, UserBrief, UserRole, Uuid, VerificationStatus, VerificationType | 管理后台专利提交 |
| Admin（管理后台） | GET | `/admin/patents/jobs/import` | `adminListPatentImportJobs` | Y | Admin（管理后台）, Patents（专利） | AuditStatus, ConsultationRouting, ErrorResponse, LicenseMode, ListingStatus, ListingTopic, MoneyFen, PageMeta, PagedPatentImportJob, PatentImportDefaults, PatentImportDuplicatePolicy, PatentImportJob, PatentImportListingDefaults, PatentJobStatus, PriceType, TradeMode, Uuid | 管理后台专利/任务/导入查询列表 |
| Admin（管理后台） | POST | `/admin/patents/jobs/import` | `adminCreatePatentImportJob` | Y | Admin（管理后台）, Patents（专利） | AuditStatus, ConsultationRouting, ErrorResponse, LicenseMode, ListingStatus, ListingTopic, MoneyFen, PatentImportDefaults, PatentImportDuplicatePolicy, PatentImportJob, PatentImportJobCreateRequest, PatentImportListingDefaults, PatentJobStatus, PriceType, TradeMode, Uuid | 管理后台专利/任务/导入提交 |
| Admin（管理后台） | GET | `/admin/patents/jobs/import/{jobId}` | `adminGetPatentImportJob` | Y | Admin（管理后台）, Patents（专利） | AuditStatus, ConsultationRouting, ErrorResponse, LicenseMode, ListingStatus, ListingTopic, MoneyFen, PatentImportDefaults, PatentImportDuplicatePolicy, PatentImportJob, PatentImportListingDefaults, PatentJobStatus, PriceType, TradeMode, Uuid | 管理后台专利/任务/导入查询详情 |
| Admin（管理后台） | GET | `/admin/patents/jobs/import/{jobId}/error-file` | `adminGetPatentImportJobErrorFile` | Y | Admin（管理后台）, Patents（专利） | ErrorResponse, ListingJobErrorFile, Uuid | 管理后台专利/任务/导入/错误文件查询列表 |
| Admin（管理后台） | POST | `/admin/patents/jobs/import/{jobId}/execute` | `adminExecutePatentImportJob` | Y | Admin（管理后台）, Patents（专利） | AuditStatus, ConsultationRouting, ErrorResponse, LicenseMode, ListingStatus, ListingTopic, MoneyFen, PatentImportDefaults, PatentImportDuplicatePolicy, PatentImportJob, PatentImportListingDefaults, PatentJobStatus, PriceType, TradeMode, Uuid | 管理后台专利/任务/导入/执行提交 |
| Admin（管理后台） | GET | `/admin/patents/jobs/import/{jobId}/rows` | `adminListPatentImportJobRows` | Y | Admin（管理后台）, Patents（专利） | ErrorResponse, PageMeta, PagedPatentImportJobRow, PatentImportJobRow, PatentImportRowStatus, Uuid | 管理后台专利/任务/导入/行查询列表 |
| Admin（管理后台） | POST | `/admin/patents/jobs/import/{jobId}/validate` | `adminValidatePatentImportJob` | Y | Admin（管理后台）, Patents（专利） | AuditStatus, ConsultationRouting, ErrorResponse, LicenseMode, ListingStatus, ListingTopic, MoneyFen, PatentImportDefaults, PatentImportDuplicatePolicy, PatentImportJob, PatentImportListingDefaults, PatentJobStatus, PriceType, TradeMode, Uuid | 管理后台专利/任务/导入/校验提交 |
| Admin（管理后台） | POST | `/admin/patents/jobs/listings` | `adminGeneratePatentListings` | Y | Admin（管理后台）, Patents（专利） | AuditStatus, ConsultationRouting, ErrorResponse, LicenseMode, ListingStatus, ListingTopic, MoneyFen, PatentImportDuplicatePolicy, PatentImportListingDefaults, PatentListingGenerateRequest, PatentListingGenerateResult, PatentListingGenerateResultRow, PriceType, TradeMode, Uuid | 管理后台专利/任务/挂牌提交 |
| Admin（管理后台） | GET | `/admin/patents/{patentId}` | `adminGetPatentById` | Y | Admin（管理后台）, Patents（专利） | ErrorResponse, Jurisdiction, LegalStatus, Patent, PatentMedia, PatentOwnerClaimSource, PatentTradeSnapshot, PatentType, PriceType, SupplyType, UserBrief, UserRole, Uuid, VerificationStatus, VerificationType | 管理后台专利查询详情 |
| Admin（管理后台） | PATCH | `/admin/patents/{patentId}` | `adminUpdatePatent` | Y | Admin（管理后台）, Patents（专利） | ErrorResponse, Jurisdiction, LegalStatus, Patent, PatentMedia, PatentOwnerClaimSource, PatentTradeSnapshot, PatentType, PatentUpdateRequest, PriceType, SupplyType, UserBrief, UserRole, Uuid, VerificationStatus, VerificationType | 管理后台专利更新 |
| Admin（管理后台） | GET | `/admin/rbac/permissions` | `adminListRbacPermissions` | Y | Admin（管理后台） | ErrorResponse, RbacPermission, RbacPermissionList | 管理后台权限/权限查询列表 |
| Admin（管理后台） | GET | `/admin/rbac/roles` | `adminListRbacRoles` | Y | Admin（管理后台） | ErrorResponse, RbacRole, RbacRoleList, Uuid | 管理后台权限/角色查询列表 |
| Admin（管理后台） | POST | `/admin/rbac/roles` | `adminCreateRbacRole` | Y | Admin（管理后台） | ErrorResponse, RbacRole, RbacRoleCreateRequest, Uuid | 管理后台权限/角色提交 |
| Admin（管理后台） | PATCH | `/admin/rbac/roles/{roleId}` | `adminUpdateRbacRole` | Y | Admin（管理后台） | ErrorResponse, RbacRole, RbacRoleUpdateRequest, Uuid | 管理后台权限/角色更新 |
| Admin（管理后台） | DELETE | `/admin/rbac/roles/{roleId}` | `adminDeleteRbacRole` | Y | Admin（管理后台） | ErrorResponse, OkResponse, Uuid | 管理后台权限/角色删除 |
| Admin（管理后台） | GET | `/admin/rbac/users` | `adminListRbacUsers` | Y | Admin（管理后台） | ErrorResponse, RbacUser, RbacUserList, Uuid | 管理后台权限/用户查询列表 |
| Admin（管理后台） | POST | `/admin/rbac/users` | `adminCreateRbacUser` | Y | Admin（管理后台） | ErrorResponse, PhoneNumber, RbacUser, RbacUserCreateRequest, Uuid | 管理后台权限/用户提交 |
| Admin（管理后台） | PATCH | `/admin/rbac/users/{userId}` | `adminUpdateRbacUserRoles` | Y | Admin（管理后台） | ErrorResponse, RbacUser, RbacUserRoleUpdateRequest, Uuid | 管理后台权限/用户更新 |
| Admin（管理后台） | POST | `/admin/refund-requests/{refundRequestId}/approve` | `adminApproveRefundRequest` | Y | Admin（管理后台） | ErrorResponse, RefundReasonCode, RefundRequest, RefundRequestStatus, Uuid | 管理后台退款请求/通过提交 |
| Admin（管理后台） | POST | `/admin/refund-requests/{refundRequestId}/complete` | `adminCompleteRefundRequest` | Y | Admin（管理后台） | ErrorResponse, RefundReasonCode, RefundRequest, RefundRequestCompleteRequest, RefundRequestStatus, Uuid | 管理后台退款请求/完成提交 |
| Admin（管理后台） | POST | `/admin/refund-requests/{refundRequestId}/reject` | `adminRejectRefundRequest` | Y | Admin（管理后台） | ErrorResponse, RefundReasonCode, RefundRequest, RefundRequestStatus, Uuid | 管理后台退款请求/驳回提交 |
| Admin（管理后台） | GET | `/admin/regions` | `adminListRegions` | Y | Admin（管理后台）, Regions（地区） | ErrorResponse, RegionLevel, RegionNode | 管理后台地区查询列表 |
| Admin（管理后台） | POST | `/admin/regions` | `adminCreateRegion` | Y | Admin（管理后台）, Regions（地区） | ErrorResponse, RegionCreateRequest, RegionLevel, RegionNode | 管理后台地区提交 |
| Admin（管理后台） | PATCH | `/admin/regions/{regionCode}` | `adminUpdateRegion` | Y | Admin（管理后台）, Regions（地区） | ErrorResponse, RegionLevel, RegionNode, RegionUpdateRequest | 管理后台地区更新 |
| Admin（管理后台） | PUT | `/admin/regions/{regionCode}/industry-tags` | `adminSetRegionIndustryTags` | Y | Admin（管理后台）, Regions（地区） | ErrorResponse, RegionLevel, RegionNode | 管理后台地区/行业标签更新 |
| Admin（管理后台） | POST | `/admin/reports/finance/export` | `adminExportFinanceReport` | Y | Admin（管理后台） | ErrorResponse, FinanceReportExportResponse | 管理后台报表/财务/导出提交 |
| Admin（管理后台） | GET | `/admin/reports/finance/summary` | `adminGetFinanceReportSummary` | Y | Admin（管理后台） | ErrorResponse, FinanceReportRange, FinanceReportSummary, MoneyFen | 管理后台报表/财务/摘要查询列表 |
| Admin（管理后台） | GET | `/admin/tech-managers` | `adminListTechManagers` | Y | Admin（管理后台）, TechManagers（技术经理） | ErrorResponse, PageMeta, PagedTechManagerSummary, TechManagerStats, TechManagerSummary, Uuid, VerificationStatus, VerificationType | 管理后台技术经理查询列表 |
| Admin（管理后台） | PATCH | `/admin/tech-managers/{techManagerId}` | `adminUpdateTechManager` | Y | Admin（管理后台）, TechManagers（技术经理） | ErrorResponse, TechManagerPublic, TechManagerStats, TechManagerSummary, TechManagerUpdateRequest, Uuid, VerificationStatus, VerificationType | 管理后台技术经理更新 |
| Admin（管理后台） | GET | `/admin/user-verifications` | `adminListUserVerifications` | Y | Admin（管理后台） | ErrorResponse, PageMeta, PagedUserVerification, UserVerification, Uuid, VerificationStatus, VerificationType | 管理后台用户认证查询列表 |
| Admin（管理后台） | POST | `/admin/user-verifications/{verificationId}/approve` | `adminApproveUserVerification` | Y | Admin（管理后台） | ErrorResponse, UserVerification, Uuid, VerificationStatus, VerificationType | 管理后台用户认证/通过提交 |
| Admin（管理后台） | GET | `/admin/user-verifications/{verificationId}/audit-logs` | `adminGetVerificationAuditLogs` | Y | Admin（管理后台） | AuditLog, AuditLogList, ErrorResponse, Uuid | 管理后台用户认证/审计日志查询列表 |
| Admin（管理后台） | GET | `/admin/user-verifications/{verificationId}/materials` | `adminGetVerificationMaterials` | Y | Admin（管理后台） | AuditMaterial, AuditMaterialList, ErrorResponse, Uuid | 管理后台用户认证/材料查询列表 |
| Admin（管理后台） | POST | `/admin/user-verifications/{verificationId}/reject` | `adminRejectUserVerification` | Y | Admin（管理后台） | ErrorResponse, UserVerification, Uuid, VerificationStatus, VerificationType | 管理后台用户认证/驳回提交 |
| Client（小程序端） | POST | `/ai/agent/query` | `createAiAgentQuery` | N | AI（智能解析） | AiAgentInputType, AiAgentMatchSummary, AiAgentParsedQuery, AiAgentQueryRequest, AiAgentQueryResult, AiContentScope, AiContentType, AiSearchFilters, CooperationMode, ErrorResponse, MoneyFen, PatentType, PriceType, TradeMode, Uuid | 小程序端智能/坐席/查询提交 |
| Client（小程序端） | POST | `/ai/parse-results/{parseResultId}/feedback` | `createAiParseFeedback` | Y | AI（智能解析） | AiParseFeedback, AiParseFeedbackActorType, AiParseFeedbackRequest, ErrorResponse, Uuid | 小程序端智能/解析结果/反馈提交 |
| Client（小程序端） | GET | `/auth/session` | `authGetSession` | Y | Auth（认证） | AuthSession, ErrorResponse, Uuid | 小程序端会话查询列表 |
| Client（小程序端） | POST | `/auth/sms/send` | `authSmsSend` | N | Auth（认证） | ErrorResponse, PhoneNumber, SmsPurpose | 小程序端短信/发送提交 |
| Client（小程序端） | POST | `/auth/sms/verify` | `authSmsVerify` | N | Auth（认证） | AuthTokenResponse, ErrorResponse, PhoneNumber, SupplyType, UserProfile, UserRole, Uuid, VerificationStatus, VerificationType | 小程序端短信/验证提交 |
| Client（小程序端） | POST | `/auth/wechat/mp-login` | `authWechatMpLogin` | N | Auth（认证） | AuthTokenResponse, ErrorResponse, PhoneNumber, SupplyType, UserProfile, UserRole, Uuid, VerificationStatus, VerificationType | 小程序端微信/小程序登录提交 |
| Client（小程序端） | POST | `/auth/wechat/phone-bind` | `authWechatPhoneBind` | Y | Auth（认证） | ErrorResponse, PhoneNumber | 小程序端微信/手机号绑定提交 |
| Client（小程序端） | PATCH | `/comments/{commentId}` | `updateComment` | Y | Comments（评论） | Comment, CommentContentType, CommentStatus, CommentUpdateRequest, ErrorResponse, SupplyType, UserBrief, UserRole, Uuid, VerificationStatus, VerificationType | 小程序端评论更新 |
| Client（小程序端） | DELETE | `/comments/{commentId}` | `deleteComment` | Y | Comments（评论） | ErrorResponse, Uuid | 小程序端评论删除 |
| Client（小程序端） | GET | `/contracts` | `listContracts` | Y | Contracts（合同） | ContractItem, ContractStatus, ErrorResponse, PageMeta, PagedContract, Uuid | 小程序端合同查询列表 |
| Client（小程序端） | POST | `/contracts/{contractId}/upload` | `uploadContractPdf` | Y | Contracts（合同） | ContractItem, ContractStatus, ContractUploadRequest, ErrorResponse, Uuid | 小程序端合同/上传提交 |
| Client（小程序端） | GET | `/conversations/{conversationId}/messages` | `listConversationMessages` | Y | Messaging（消息会话） | ConversationMessage, ConversationMessageType, ErrorResponse, PagedConversationMessage, Uuid | 小程序端会话/消息查询列表 |
| Client（小程序端） | POST | `/conversations/{conversationId}/messages` | `sendConversationMessage` | Y | Messaging（消息会话） | ConversationMessage, ConversationMessageSendRequest, ConversationMessageType, ErrorResponse, Uuid | 小程序端会话/消息提交 |
| Client（小程序端） | POST | `/conversations/{conversationId}/read` | `markConversationRead` | Y | Messaging（消息会话） | ErrorResponse, Uuid | 小程序端会话/已读提交 |
| Client（小程序端） | POST | `/files` | `uploadFile` | Y | Files（文件） | ErrorResponse, FileObject, FilePurpose, Uuid | 小程序端文件提交 |
| Client（小程序端） | GET | `/files/{fileId}` | `downloadFile` | Y | Files（文件） | ErrorResponse, Uuid | 小程序端文件查询详情 |
| Client（小程序端） | GET | `/files/{fileId}/preview` | `previewFile` | Y | Files（文件） | ErrorResponse, Uuid | 小程序端文件/预览查询列表 |
| Client（小程序端） | POST | `/files/{fileId}/temporary-access` | `createFileTemporaryAccess` | Y | Files（文件） | ErrorResponse, FileTemporaryAccessRequest, FileTemporaryAccessResponse, FileTemporaryAccessScope, Uuid | 小程序端文件/临时访问提交 |
| Client（小程序端） | GET | `/health` | `getHealth` | N | System（系统） | ErrorResponse | 小程序端健康查询列表 |
| Client（小程序端） | GET | `/invoices` | `listMyInvoices` | Y | Invoices（发票） | ErrorResponse, FileObject, InvoiceItem, InvoiceStatus, MoneyFen, Order, OrderInvoice, OrderStatus, PageMeta, PagedInvoiceItem, Uuid | 小程序端发票查询列表 |
| Client（小程序端） | GET | `/listings` | `listMyListings` | Y | Listings（挂牌） | AiContentType, AiParseResult, AiParseStatus, AuditStatus, ConsultationRouting, ContentSource, ErrorResponse, ExistingLicenseStatus, FeaturedLevel, LegalStatus, LicenseMode, Listing, ListingMedia, ListingStats, ListingStatus, ListingSummary, ListingTopic, MoneyFen, PageMeta, PagedListing, PatentType, PledgeStatus, PriceType, TradeMode, Uuid | 小程序端挂牌查询列表 |
| Client（小程序端） | POST | `/listings` | `createListing` | Y | Listings（挂牌） | AiContentType, AiParseResult, AiParseStatus, AuditStatus, ConsultationRouting, ContentSource, ErrorResponse, ExistingLicenseStatus, FeaturedLevel, LegalStatus, LicenseMode, Listing, ListingCreateRequest, ListingMedia, ListingStats, ListingStatus, ListingSummary, ListingTopic, MoneyFen, PatentType, PledgeStatus, PriceType, TradeMode, Uuid | 小程序端挂牌提交 |
| Client（小程序端） | GET | `/listings/{listingId}` | `getListingById` | Y | Listings（挂牌） | AiContentType, AiParseResult, AiParseStatus, AuditStatus, ConsultationRouting, ContentSource, ErrorResponse, ExistingLicenseStatus, FeaturedLevel, LegalStatus, LicenseMode, Listing, ListingMedia, ListingStats, ListingStatus, ListingSummary, ListingTopic, MoneyFen, PatentType, PledgeStatus, PriceType, TradeMode, Uuid | 小程序端挂牌查询详情 |
| Client（小程序端） | PATCH | `/listings/{listingId}` | `updateListing` | Y | Listings（挂牌） | AiContentType, AiParseResult, AiParseStatus, AuditStatus, ConsultationRouting, ContentSource, ErrorResponse, ExistingLicenseStatus, FeaturedLevel, LegalStatus, LicenseMode, Listing, ListingMedia, ListingStats, ListingStatus, ListingSummary, ListingTopic, ListingUpdateRequest, MoneyFen, PatentType, PledgeStatus, PriceType, TradeMode, Uuid | 小程序端挂牌更新 |
| Client（小程序端） | POST | `/listings/{listingId}/comments` | `createListingComment` | Y | Comments（评论） | Comment, CommentContentType, CommentCreateRequest, CommentStatus, ErrorResponse, SupplyType, UserBrief, UserRole, Uuid, VerificationStatus, VerificationType | 小程序端挂牌/评论提交 |
| Client（小程序端） | POST | `/listings/{listingId}/consultations` | `createListingConsultation` | Y | Listings（挂牌） | ErrorResponse, ListingConsultationCreated, Uuid | 小程序端挂牌/咨询提交 |
| Client（小程序端） | POST | `/listings/{listingId}/conversations` | `upsertListingConversation` | Y | Messaging（消息会话） | Conversation, ConversationContentType, ErrorResponse, Uuid | 小程序端挂牌/会话提交 |
| Client（小程序端） | POST | `/listings/{listingId}/favorites` | `favoriteListing` | Y | Listings（挂牌） | ErrorResponse, Uuid | 小程序端挂牌/收藏提交 |
| Client（小程序端） | DELETE | `/listings/{listingId}/favorites` | `unfavoriteListing` | Y | Listings（挂牌） | ErrorResponse, Uuid | 小程序端挂牌/收藏删除 |
| Client（小程序端） | POST | `/listings/{listingId}/off-shelf` | `offShelfListing` | Y | Listings（挂牌） | AiContentType, AiParseResult, AiParseStatus, AuditStatus, ConsultationRouting, ContentSource, ErrorResponse, ExistingLicenseStatus, FeaturedLevel, LegalStatus, LicenseMode, Listing, ListingMedia, ListingStats, ListingStatus, ListingSummary, ListingTopic, MoneyFen, PatentType, PledgeStatus, PriceType, TradeMode, Uuid | 小程序端挂牌/下架提交 |
| Client（小程序端） | POST | `/listings/{listingId}/submit` | `submitListing` | Y | Listings（挂牌） | AiContentType, AiParseResult, AiParseStatus, AuditStatus, ConsultationRouting, ContentSource, ErrorResponse, ExistingLicenseStatus, FeaturedLevel, LegalStatus, LicenseMode, Listing, ListingMedia, ListingStats, ListingStatus, ListingSummary, ListingTopic, MoneyFen, PatentType, PledgeStatus, PriceType, TradeMode, Uuid | 小程序端挂牌提交 |
| Client（小程序端） | GET | `/me` | `getMe` | Y | Users（用户） | ErrorResponse, PhoneNumber, SupplyType, UserProfile, UserRole, Uuid, VerificationStatus, VerificationType | 小程序端我的查询列表 |
| Client（小程序端） | PATCH | `/me` | `updateMe` | Y | Users（用户） | ErrorResponse, PhoneNumber, SupplyType, UserProfile, UserRole, Uuid, VerificationStatus, VerificationType | 小程序端我的更新 |
| Client（小程序端） | GET | `/me/addresses` | `listMyAddresses` | Y | Users（用户） | Address, ErrorResponse, PhoneNumber, Uuid | 小程序端地址查询列表 |
| Client（小程序端） | POST | `/me/addresses` | `createMyAddress` | Y | Users（用户） | Address, AddressCreateRequest, ErrorResponse, PhoneNumber, Uuid | 小程序端地址提交 |
| Client（小程序端） | PATCH | `/me/addresses/{addressId}` | `updateMyAddress` | Y | Users（用户） | Address, AddressUpdateRequest, ErrorResponse, PhoneNumber, Uuid | 小程序端地址更新 |
| Client（小程序端） | DELETE | `/me/addresses/{addressId}` | `deleteMyAddress` | Y | Users（用户） | ErrorResponse, OkResponse, Uuid | 小程序端地址删除 |
| Client（小程序端） | GET | `/me/conversations` | `listMyConversations` | Y | Messaging（消息会话） | ConversationContentType, ConversationSummary, ErrorResponse, ListingTopic, PageMeta, PagedConversationSummary, SupplyType, UserBrief, UserRole, Uuid, VerificationStatus, VerificationType | 小程序端会话查询列表 |
| Client（小程序端） | GET | `/me/favorites` | `listMyFavoriteListings` | Y | Listings（挂牌） | AuditStatus, ConsultationRouting, ContentSource, ErrorResponse, FeaturedLevel, LegalStatus, LicenseMode, ListingStats, ListingStatus, ListingSummary, ListingTopic, MoneyFen, PageMeta, PagedListingSummary, PatentType, PriceType, TradeMode, Uuid | 小程序端收藏查询列表 |
| Client（小程序端） | GET | `/me/favorites/achievements` | `listMyFavoriteAchievements` | Y | Achievements（成果） | AchievementMaturity, AchievementSummary, AuditStatus, ContentSource, ContentStatus, ErrorResponse, ListingStats, OrganizationStats, OrganizationSummary, PageMeta, PagedAchievementSummary, SupplyType, Uuid, VerificationStatus, VerificationType | 小程序端收藏/成果查询列表 |
| Client（小程序端） | GET | `/me/patent-claims` | `listMyPatentClaims` | Y | Patents（专利） | ErrorResponse, PageMeta, PagedPatentClaimRequest, PatentClaimRequest, PatentClaimStatus, Uuid | 小程序端专利认领查询列表 |
| Client（小程序端） | POST | `/me/patent-claims` | `createMyPatentClaim` | Y | Patents（专利） | ErrorResponse, PatentClaimCreateRequest, PatentClaimRequest, PatentClaimStatus, Uuid | 小程序端专利认领提交 |
| Client（小程序端） | GET | `/me/patent-maintenance/orders` | `listMyPatentMaintenanceOrders` | Y | Maintenance（专利维保） | ErrorResponse, PageMeta, PagedMyPatentMaintenanceOrder, PatentMaintenanceOrder, PatentMaintenanceOrderStatus, PatentMaintenancePaymentChannel, PatentMaintenanceReconcileStatus, Uuid | 小程序端专利维保/订单查询列表 |
| Client（小程序端） | POST | `/me/patent-maintenance/orders` | `createMyPatentMaintenanceOrder` | Y | Maintenance（专利维保） | ErrorResponse, PatentMaintenanceOrder, PatentMaintenanceOrderMyCreateRequest, PatentMaintenanceOrderStatus, PatentMaintenancePaymentChannel, PatentMaintenanceReconcileStatus, Uuid | 小程序端专利维保/订单提交 |
| Client（小程序端） | GET | `/me/patent-maintenance/orders/{orderId}` | `getMyPatentMaintenanceOrder` | Y | Maintenance（专利维保） | ErrorResponse, PatentMaintenanceOrder, PatentMaintenanceOrderStatus, PatentMaintenancePaymentChannel, PatentMaintenanceReconcileStatus, Uuid | 小程序端专利维保/订单查询详情 |
| Client（小程序端） | GET | `/me/patent-maintenance/orders/{orderId}/events` | `listMyPatentMaintenanceOrderEvents` | Y | Maintenance（专利维保） | ErrorResponse, PatentMaintenanceOrderEvent, PatentMaintenanceOrderEventList, PatentMaintenanceOrderEventType, PatentMaintenanceOrderStatus, Uuid | 小程序端专利维保/订单/事件查询列表 |
| Client（小程序端） | GET | `/me/patent-maintenance/schedules` | `listMyPatentMaintenanceSchedules` | Y | Maintenance（专利维保） | ErrorResponse, MaintenanceUrgency, MyPatentMaintenanceSchedule, PageMeta, PagedMyPatentMaintenanceSchedule, PatentMaintenanceSchedule, PatentMaintenanceStatus, Uuid | 小程序端专利维保/日程查询列表 |
| Client（小程序端） | GET | `/me/patent-maintenance/tasks` | `listMyPatentMaintenanceTasks` | Y | Maintenance（专利维保） | ErrorResponse, MaintenanceUrgency, MyPatentMaintenanceTask, PageMeta, PagedMyPatentMaintenanceTask, PatentMaintenanceStatus, PatentMaintenanceTask, PatentMaintenanceTaskStatus, Uuid | 小程序端专利维保/任务查询列表 |
| Client（小程序端） | GET | `/me/recommendations/listings` | `getMyRecommendedListings` | Y | Search（检索） | AuditStatus, ConsultationRouting, ContentSource, ErrorResponse, FeaturedLevel, LegalStatus, LicenseMode, ListingStats, ListingStatus, ListingSummary, ListingTopic, MoneyFen, PageMeta, PagedListingSummary, PatentType, PriceType, TradeMode, Uuid | 小程序端推荐/挂牌查询列表 |
| Client（小程序端） | GET | `/me/verification` | `getMyVerification` | Y | Users（用户） | ErrorResponse, UserVerification, Uuid, VerificationStatus, VerificationType | 小程序端认证查询列表 |
| Client（小程序端） | POST | `/me/verification` | `submitMyVerification` | Y | Users（用户） | ErrorResponse, PhoneNumber, UserVerification, UserVerificationSubmitOrganizationRequest, UserVerificationSubmitPersonRequest, UserVerificationSubmitRequest, UserVerificationSubmitTechManagerRequest, Uuid, VerificationStatus, VerificationType | 小程序端认证提交 |
| Client（小程序端） | GET | `/notifications` | `listMyNotifications` | Y | Notifications（通知） | ErrorResponse, Notification, NotificationKind, PageMeta, PagedNotification, Uuid | 小程序端通知查询列表 |
| Client（小程序端） | GET | `/notifications/{notificationId}` | `getNotificationById` | Y | Notifications（通知） | ErrorResponse, Notification, NotificationKind, Uuid | 小程序端通知查询详情 |
| Client（小程序端） | GET | `/orders` | `listMyOrders` | Y | Orders（订单） | ErrorResponse, FileObject, MoneyFen, Order, OrderInvoice, OrderListRole, OrderStatus, OrderStatusGroup, PageMeta, PagedOrder, Uuid | 小程序端订单查询列表 |
| Client（小程序端） | POST | `/orders` | `createOrder` | Y | Orders（订单） | ErrorResponse, FileObject, MoneyFen, Order, OrderInvoice, OrderStatus, Uuid | 小程序端订单提交 |
| Client（小程序端） | GET | `/orders/{orderId}` | `getOrderById` | Y | Orders（订单） | ErrorResponse, FileObject, MoneyFen, Order, OrderInvoice, OrderStatus, Uuid | 小程序端订单查询详情 |
| Client（小程序端） | GET | `/orders/{orderId}/case` | `getOrderCase` | Y | Cases（工单） | CaseStatus, CaseType, CaseWithMilestones, ErrorResponse, Milestone, MilestoneName, MilestoneStatus, Uuid | 小程序端订单/工单查询列表 |
| Client（小程序端） | POST | `/orders/{orderId}/dispute-conversations` | `upsertOrderDisputeConversation` | Y | Messaging（消息会话）, Orders（订单） | Conversation, ConversationContentType, ErrorResponse, Uuid | 小程序端订单/纠纷会话提交 |
| Client（小程序端） | GET | `/orders/{orderId}/invoice` | `getOrderInvoice` | Y | Invoices（发票） | ErrorResponse, FileObject, MoneyFen, OrderInvoice, Uuid | 小程序端订单/发票查询列表 |
| Client（小程序端） | POST | `/orders/{orderId}/invoice-requests` | `requestOrderInvoice` | Y | Invoices（发票） | ErrorResponse, InvoiceRequestResult, InvoiceStatus, Uuid | 小程序端订单/发票请求提交 |
| Client（小程序端） | POST | `/orders/{orderId}/payment-intents` | `createPaymentIntent` | Y | Payments（支付） | ErrorResponse, MoneyFen, PayType, PaymentIntentResponse, Uuid | 小程序端订单/支付支付意图提交 |
| Client（小程序端） | GET | `/orders/{orderId}/refund-requests` | `listRefundRequestsByOrder` | Y | Refunds（退款） | ErrorResponse, RefundReasonCode, RefundRequest, RefundRequestStatus, Uuid | 小程序端订单/退款请求查询列表 |
| Client（小程序端） | POST | `/orders/{orderId}/refund-requests` | `createRefundRequest` | Y | Refunds（退款） | ErrorResponse, RefundReasonCode, RefundRequest, RefundRequestCreate, RefundRequestStatus, Uuid | 小程序端订单/退款请求提交 |
| Client（小程序端） | POST | `/patent-maintenance/orders/{orderId}/conversations` | `upsertMaintenanceOrderConversation` | Y | Messaging（消息会话）, Maintenance（专利维保） | Conversation, ConversationContentType, ErrorResponse, Uuid | 小程序端专利维保/订单/会话提交 |
| Client（小程序端） | POST | `/patents/normalize` | `normalizePatentNumber` | N | Patents（专利） | ErrorResponse, Jurisdiction, PatentNormalizeRequest, PatentNormalizeResponse, PatentNumberInputType, PatentType | 小程序端专利/规范化提交 |
| Client（小程序端） | GET | `/patents/{patentId}` | `getPatentById` | Y | Patents（专利） | ErrorResponse, Jurisdiction, LegalStatus, Patent, PatentMedia, PatentOwnerClaimSource, PatentTradeSnapshot, PatentType, PriceType, SupplyType, UserBrief, UserRole, Uuid, VerificationStatus, VerificationType | 小程序端专利查询详情 |
| Client（小程序端） | GET | `/public/achievements/{achievementId}` | `getPublicAchievementById` | N | Achievements（成果） | AchievementDetail, AchievementMaturity, AchievementSummary, AuditStatus, ContentMedia, ContentMediaType, ContentSource, ContentStatus, ErrorResponse, ListingStats, OrganizationStats, OrganizationSummary, SupplyType, Uuid, VerificationStatus, VerificationType | 小程序端成果查询详情 |
| Client（小程序端） | GET | `/public/achievements/{achievementId}/comments` | `listPublicAchievementComments` | N | Comments（评论）, Achievements（成果） | Comment, CommentContentType, CommentStatus, CommentThread, ErrorResponse, PageMeta, PagedCommentThread, SupplyType, UserBrief, UserRole, Uuid, VerificationStatus, VerificationType | 小程序端成果/评论查询列表 |
| Client（小程序端） | GET | `/public/config/banner` | `getPublicBannerConfig` | N | Config（配置） | BannerConfig, BannerItem, ErrorResponse | 小程序端配置/横幅查询列表 |
| Client（小程序端） | GET | `/public/config/customer-service` | `getPublicCustomerServiceConfig` | N | Config（配置） | CustomerServiceConfig, ErrorResponse | 小程序端配置/客户服务查询列表 |
| Client（小程序端） | GET | `/public/config/home-announcements` | `getPublicHomeAnnouncementsFeed` | N | Config（配置） | ErrorResponse, PublicHomeAnnouncementFeed, PublicHomeAnnouncementItem | 小程序端配置/首页公告查询列表 |
| Client（小程序端） | GET | `/public/config/trade-rules` | `getPublicTradeRulesConfig` | N | Config（配置） | ErrorResponse, MoneyFen, PayoutCondition, PayoutMethod, TradeRulesConfig | 小程序端配置/交易规则查询列表 |
| Client（小程序端） | GET | `/public/industry-tags` | `listPublicIndustryTags` | N | Regions（地区） | ErrorResponse, IndustryTag, Uuid | 小程序端行业标签查询列表 |
| Client（小程序端） | GET | `/public/listings/{listingId}` | `getPublicListingById` | N | Listings（挂牌） | AiContentType, AiParseResult, AiParseStatus, AuditStatus, ConsultationRouting, ContentSource, ErrorResponse, ExistingLicenseStatus, FeaturedLevel, LegalStatus, LicenseMode, ListingMedia, ListingPublic, ListingStats, ListingStatus, ListingSummary, ListingTopic, MoneyFen, PatentType, PledgeStatus, PriceType, SupplyType, TradeMode, UserBrief, UserRole, Uuid, VerificationStatus, VerificationType | 小程序端挂牌查询详情 |
| Client（小程序端） | GET | `/public/listings/{listingId}/comments` | `listPublicListingComments` | N | Comments（评论） | Comment, CommentContentType, CommentStatus, CommentThread, ErrorResponse, PageMeta, PagedCommentThread, SupplyType, UserBrief, UserRole, Uuid, VerificationStatus, VerificationType | 小程序端挂牌/评论查询列表 |
| Client（小程序端） | GET | `/public/organizations` | `listPublicOrganizations` | N | Organizations（机构） | ErrorResponse, OrganizationStats, OrganizationSummary, PageMeta, PagedOrganizationSummary, SupplyType, Uuid, VerificationStatus, VerificationType | 小程序端机构查询列表 |
| Client（小程序端） | GET | `/public/organizations/{orgUserId}` | `getPublicOrganizationById` | N | Organizations（机构） | ErrorResponse, OrganizationStats, OrganizationSummary, SupplyType, Uuid, VerificationStatus, VerificationType | 小程序端机构查询详情 |
| Client（小程序端） | GET | `/public/tech-managers/{techManagerId}` | `getPublicTechManagerById` | N | TechManagers（技术经理） | ErrorResponse, TechManagerPublic, TechManagerStats, TechManagerSummary, Uuid, VerificationStatus, VerificationType | 小程序端技术经理查询详情 |
| Client（小程序端） | GET | `/regions` | `listRegions` | N | Regions（地区） | ErrorResponse, RegionLevel, RegionNode | 小程序端地区查询列表 |
| Client（小程序端） | GET | `/search/achievements` | `searchAchievements` | N | Search（检索）, Achievements（成果） | AchievementMaturity, AchievementSortBy, AchievementSummary, AuditStatus, ContentSource, ContentStatus, ErrorResponse, ListingStats, OrganizationStats, OrganizationSummary, PageMeta, PagedAchievementSummary, SupplyType, Uuid, VerificationStatus, VerificationType | 小程序端成果查询列表 |
| Client（小程序端） | GET | `/search/inventors` | `searchInventorRankings` | N | Search（检索） | ErrorResponse, InventorRankingItem, PageMeta, PagedInventorRanking, PatentType | 小程序端发明人查询列表 |
| Client（小程序端） | GET | `/search/listings` | `searchListings` | N | Search（检索） | AuditStatus, ConsultationRouting, ContentSource, ErrorResponse, FeaturedLevel, LegalStatus, LicenseMode, ListingStats, ListingStatus, ListingSummary, ListingTopic, MoneyFen, PageMeta, PagedListingSummary, PatentType, PriceType, SearchQType, SortBy, TradeMode, Uuid | 小程序端挂牌查询列表 |
| Client（小程序端） | GET | `/search/patent-map/overview` | `searchPatentMapOverview` | N | Search（检索） | ErrorResponse, PatentMapDataScope, PatentMapOverviewRegionLevel, PatentMapOverviewResponse, PatentMapOverviewSummary, PatentMapRegionItem, PatentMapRegionLevel | 小程序端专利地图/概览查询列表 |
| Client（小程序端） | GET | `/search/patent-map/regions/{regionCode}` | `searchPatentMapRegionDetail` | N | Search（检索） | ErrorResponse, FeaturedLevel, PageMeta, PatentMapDataScope, PatentMapOverviewRegionLevel, PatentMapRegionDetailItem, PatentMapRegionDetailRegion, PatentMapRegionDetailResponse, PatentMapRegionDetailSummary, PatentType, PriceType, TradeMode, Uuid | 小程序端专利地图/地区查询详情 |
| Client（小程序端） | GET | `/search/tech-managers` | `searchTechManagers` | N | Search（检索）, TechManagers（技术经理） | ErrorResponse, PageMeta, PagedTechManagerSummary, TechManagerSortBy, TechManagerStats, TechManagerSummary, Uuid, VerificationStatus, VerificationType | 小程序端技术经理查询列表 |
| Client（小程序端） | POST | `/support/conversations` | `upsertSupportConversation` | Y | Messaging（消息会话） | Conversation, ConversationContentType, ErrorResponse, Uuid | 小程序端客服/会话提交 |
| Client（小程序端） | POST | `/tech-managers/{techManagerId}/conversations` | `upsertTechManagerConversation` | Y | Messaging（消息会话）, TechManagers（技术经理） | Conversation, ConversationContentType, ErrorResponse, Uuid | 小程序端技术经理/会话提交 |
| Client（小程序端） | POST | `/webhooks/wechatpay/notify` | `wechatPayNotify` | N | Payments（支付） | ErrorResponse | 小程序端微信支付/通知回调提交 |

## 5. 接口字段字典（全量递归展开）

### 5.1 `AchievementAdminCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `title` | `string` | Y | - | 标题 |
| `summary` | `string` | N | - | 摘要 |
| `description` | `string` | N | - | 描述 |
| `maturity` | `ref:AchievementMaturity` | N | - | 成熟度 |
| `maturity` | `string` | N | CONCEPT/PROTOTYPE/PILOT/MASS_PRODUCTION/COMMERCIALIZED/OTHER | 成熟度 |
| `regionCode` | `string` | N | - | 地区编码 |
| `industryTags` | `array<string>` | N | - | 行业标签 |
| `industryTags[]` | `string` | N | - | 行业标签 |
| `keywords` | `array<string>` | N | - | 关键词 |
| `keywords[]` | `string` | N | - | 关键词 |
| `cooperationModes` | `array<string>` | N | - | 合作模式 |
| `cooperationModes[]` | `string` | N | - | 合作模式 |
| `coverFileId` | `ref:Uuid` | N | - | 封面文件ID |
| `coverFileId` | `string` | N | - | 封面文件ID |
| `media` | `array<ref:ContentMediaInput>` | N | - | 媒体 |
| `media[]` | `ref:ContentMediaInput` | N | - | 媒体 |
| `media[]` | `object` | N | - | 媒体 |
| `media[].fileId` | `ref:Uuid` | Y | - | 文件ID |
| `media[].fileId` | `string` | Y | - | 文件ID |
| `media[].type` | `ref:ContentMediaType` | Y | - | 类型 |
| `media[].type` | `string` | Y | IMAGE/VIDEO/FILE | 类型 |
| `media[].sort` | `integer` | N | - | 排序 |
| `source` | `ref:ContentSource` | N | - | 来源 |
| `source` | `string` | N | USER/PLATFORM/ADMIN | 来源 |
| `publisherUserId` | `ref:Uuid` | N | - | 发布者用户ID |
| `publisherUserId` | `string` | N | - | 发布者用户ID |
| `auditStatus` | `ref:AuditStatus` | N | - | 审计状态 |
| `auditStatus` | `string` | N | PENDING/APPROVED/REJECTED | 审计状态 |
| `status` | `ref:ContentStatus` | N | - | 状态 |
| `status` | `string` | N | DRAFT/ACTIVE/OFF_SHELF | 状态 |

### 5.2 `AchievementAdminUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `title` | `string` | N | - | 标题 |
| `summary` | `string` | N | - | 摘要 |
| `description` | `string` | N | - | 描述 |
| `maturity` | `ref:AchievementMaturity` | N | - | 成熟度 |
| `maturity` | `string` | N | CONCEPT/PROTOTYPE/PILOT/MASS_PRODUCTION/COMMERCIALIZED/OTHER | 成熟度 |
| `regionCode` | `string` | N | - | 地区编码 |
| `industryTags` | `array<string>` | N | - | 行业标签 |
| `industryTags[]` | `string` | N | - | 行业标签 |
| `keywords` | `array<string>` | N | - | 关键词 |
| `keywords[]` | `string` | N | - | 关键词 |
| `cooperationModes` | `array<string>` | N | - | 合作模式 |
| `cooperationModes[]` | `string` | N | - | 合作模式 |
| `coverFileId` | `ref:Uuid` | N | - | 封面文件ID |
| `coverFileId` | `string` | N | - | 封面文件ID |
| `media` | `array<ref:ContentMediaInput>` | N | - | 媒体 |
| `media[]` | `ref:ContentMediaInput` | N | - | 媒体 |
| `media[]` | `object` | N | - | 媒体 |
| `media[].fileId` | `ref:Uuid` | Y | - | 文件ID |
| `media[].fileId` | `string` | Y | - | 文件ID |
| `media[].type` | `ref:ContentMediaType` | Y | - | 类型 |
| `media[].type` | `string` | Y | IMAGE/VIDEO/FILE | 类型 |
| `media[].sort` | `integer` | N | - | 排序 |
| `source` | `ref:ContentSource` | N | - | 来源 |
| `source` | `string` | N | USER/PLATFORM/ADMIN | 来源 |
| `publisherUserId` | `ref:Uuid` | N | - | 发布者用户ID |
| `publisherUserId` | `string` | N | - | 发布者用户ID |
| `auditStatus` | `ref:AuditStatus` | N | - | 审计状态 |
| `auditStatus` | `string` | N | PENDING/APPROVED/REJECTED | 审计状态 |
| `status` | `ref:ContentStatus` | N | - | 状态 |
| `status` | `string` | N | DRAFT/ACTIVE/OFF_SHELF | 状态 |

### 5.3 `AchievementCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `title` | `string` | Y | - | 标题 |
| `summary` | `string` | N | - | 摘要 |
| `description` | `string` | N | - | 描述 |
| `maturity` | `ref:AchievementMaturity` | N | - | 成熟度 |
| `maturity` | `string` | N | CONCEPT/PROTOTYPE/PILOT/MASS_PRODUCTION/COMMERCIALIZED/OTHER | 成熟度 |
| `regionCode` | `string` | N | - | 地区编码 |
| `industryTags` | `array<string>` | N | - | 行业标签 |
| `industryTags[]` | `string` | N | - | 行业标签 |
| `keywords` | `array<string>` | N | - | 关键词 |
| `keywords[]` | `string` | N | - | 关键词 |
| `cooperationModes` | `array<string>` | N | - | 合作模式 |
| `cooperationModes[]` | `string` | N | - | 合作模式 |
| `coverFileId` | `ref:Uuid` | N | - | 封面文件ID |
| `coverFileId` | `string` | N | - | 封面文件ID |
| `media` | `array<ref:ContentMediaInput>` | N | - | 媒体 |
| `media[]` | `ref:ContentMediaInput` | N | - | 媒体 |
| `media[]` | `object` | N | - | 媒体 |
| `media[].fileId` | `ref:Uuid` | Y | - | 文件ID |
| `media[].fileId` | `string` | Y | - | 文件ID |
| `media[].type` | `ref:ContentMediaType` | Y | - | 类型 |
| `media[].type` | `string` | Y | IMAGE/VIDEO/FILE | 类型 |
| `media[].sort` | `integer` | N | - | 排序 |

### 5.4 `AchievementDetail`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `source` | `ref:ContentSource` | N | - | 来源 |
| `source` | `string` | N | USER/PLATFORM/ADMIN | 来源 |
| `title` | `string` | Y | - | 标题 |
| `summary` | `string` | N | - | 摘要 |
| `maturity` | `ref:AchievementMaturity` | N | - | 成熟度 |
| `maturity` | `string` | N | CONCEPT/PROTOTYPE/PILOT/MASS_PRODUCTION/COMMERCIALIZED/OTHER | 成熟度 |
| `cooperationModes` | `array<string>` | N | - | 合作模式 |
| `cooperationModes[]` | `string` | N | - | 合作模式 |
| `regionCode` | `string` | N | - | 地区编码 |
| `industryTags` | `array<string>` | N | - | 行业标签 |
| `industryTags[]` | `string` | N | - | 行业标签 |
| `keywords` | `array<string>` | N | - | 关键词 |
| `keywords[]` | `string` | N | - | 关键词 |
| `publisher` | `ref:OrganizationSummary` | N | - | 发布者 |
| `publisher` | `object` | N | - | 发布者 |
| `publisher.userId` | `ref:Uuid` | Y | - | 用户ID |
| `publisher.userId` | `string` | Y | - | 用户ID |
| `publisher.displayName` | `string` | Y | - | 显示名称 |
| `publisher.verificationType` | `ref:VerificationType` | Y | - | 认证类型 |
| `publisher.verificationType` | `string` | Y | PERSON/COMPANY/ACADEMY/GOVERNMENT/ASSOCIATION/TECH_MANAGER | 认证类型 |
| `publisher.verificationStatus` | `ref:VerificationStatus` | Y | - | 认证状态 |
| `publisher.verificationStatus` | `string` | Y | PENDING/APPROVED/REJECTED | 认证状态 |
| `publisher.orgCategory` | `ref:SupplyType` | N | - | 机构分类 |
| `publisher.orgCategory` | `string` | N | UNIVERSITY/UNIVERSITY_985/UNIVERSITY_211/RESEARCH_INSTITUTE/OTHER | 机构分类 |
| `publisher.regionCode` | `string` | N | - | 地区编码 |
| `publisher.logoUrl` | `string` | N | - | 标识链接 |
| `publisher.intro` | `string` | N | - | 简介 |
| `publisher.stats` | `ref:OrganizationStats` | N | - | 统计 |
| `publisher.stats` | `object` | N | - | 统计 |
| `publisher.stats.listingCount` | `integer` | Y | - | 挂牌数量 |
| `publisher.stats.patentCount` | `integer` | Y | - | 专利数量 |
| `publisher.verifiedAt` | `string` | N | - | 已核验时间 |
| `stats` | `ref:ListingStats` | N | - | 统计 |
| `stats` | `object` | N | - | 统计 |
| `stats.viewCount` | `integer` | Y | - | 浏览数量 |
| `stats.favoriteCount` | `integer` | Y | - | 收藏数量 |
| `stats.consultCount` | `integer` | Y | - | 咨询数量 |
| `stats.commentCount` | `integer` | N | - | 评论数量 |
| `auditStatus` | `ref:AuditStatus` | Y | - | 审计状态 |
| `auditStatus` | `string` | Y | PENDING/APPROVED/REJECTED | 审计状态 |
| `status` | `ref:ContentStatus` | Y | - | 状态 |
| `status` | `string` | Y | DRAFT/ACTIVE/OFF_SHELF | 状态 |
| `coverUrl` | `string` | N | - | 封面链接 |
| `createdAt` | `string` | Y | - | 创建时间 |
| `description` | `string` | N | - | 描述 |
| `media` | `array<ref:ContentMedia>` | N | - | 媒体 |
| `media[]` | `ref:ContentMedia` | N | - | 媒体 |
| `media[]` | `object` | N | - | 媒体 |
| `media[].fileId` | `ref:Uuid` | Y | - | 文件ID |
| `media[].fileId` | `string` | Y | - | 文件ID |
| `media[].type` | `ref:ContentMediaType` | Y | - | 类型 |
| `media[].type` | `string` | Y | IMAGE/VIDEO/FILE | 类型 |
| `media[].sort` | `integer` | Y | - | 排序 |
| `media[].url` | `string` | N | - | 链接 |
| `media[].mimeType` | `string` | N | - | 媒体类型 |
| `media[].sizeBytes` | `integer` | N | - | 大小字节 |
| `media[].fileName` | `string` | N | - | 文件名称 |
| `aiParse` | `object` | N | - | 智能解析 |

### 5.5 `AchievementEdit`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `source` | `ref:ContentSource` | N | - | 来源 |
| `source` | `string` | N | USER/PLATFORM/ADMIN | 来源 |
| `title` | `string` | Y | - | 标题 |
| `summary` | `string` | N | - | 摘要 |
| `maturity` | `ref:AchievementMaturity` | N | - | 成熟度 |
| `maturity` | `string` | N | CONCEPT/PROTOTYPE/PILOT/MASS_PRODUCTION/COMMERCIALIZED/OTHER | 成熟度 |
| `cooperationModes` | `array<string>` | N | - | 合作模式 |
| `cooperationModes[]` | `string` | N | - | 合作模式 |
| `regionCode` | `string` | N | - | 地区编码 |
| `industryTags` | `array<string>` | N | - | 行业标签 |
| `industryTags[]` | `string` | N | - | 行业标签 |
| `keywords` | `array<string>` | N | - | 关键词 |
| `keywords[]` | `string` | N | - | 关键词 |
| `publisher` | `ref:OrganizationSummary` | N | - | 发布者 |
| `publisher` | `object` | N | - | 发布者 |
| `publisher.userId` | `ref:Uuid` | Y | - | 用户ID |
| `publisher.userId` | `string` | Y | - | 用户ID |
| `publisher.displayName` | `string` | Y | - | 显示名称 |
| `publisher.verificationType` | `ref:VerificationType` | Y | - | 认证类型 |
| `publisher.verificationType` | `string` | Y | PERSON/COMPANY/ACADEMY/GOVERNMENT/ASSOCIATION/TECH_MANAGER | 认证类型 |
| `publisher.verificationStatus` | `ref:VerificationStatus` | Y | - | 认证状态 |
| `publisher.verificationStatus` | `string` | Y | PENDING/APPROVED/REJECTED | 认证状态 |
| `publisher.orgCategory` | `ref:SupplyType` | N | - | 机构分类 |
| `publisher.orgCategory` | `string` | N | UNIVERSITY/UNIVERSITY_985/UNIVERSITY_211/RESEARCH_INSTITUTE/OTHER | 机构分类 |
| `publisher.regionCode` | `string` | N | - | 地区编码 |
| `publisher.logoUrl` | `string` | N | - | 标识链接 |
| `publisher.intro` | `string` | N | - | 简介 |
| `publisher.stats` | `ref:OrganizationStats` | N | - | 统计 |
| `publisher.stats` | `object` | N | - | 统计 |
| `publisher.stats.listingCount` | `integer` | Y | - | 挂牌数量 |
| `publisher.stats.patentCount` | `integer` | Y | - | 专利数量 |
| `publisher.verifiedAt` | `string` | N | - | 已核验时间 |
| `stats` | `ref:ListingStats` | N | - | 统计 |
| `stats` | `object` | N | - | 统计 |
| `stats.viewCount` | `integer` | Y | - | 浏览数量 |
| `stats.favoriteCount` | `integer` | Y | - | 收藏数量 |
| `stats.consultCount` | `integer` | Y | - | 咨询数量 |
| `stats.commentCount` | `integer` | N | - | 评论数量 |
| `auditStatus` | `ref:AuditStatus` | Y | - | 审计状态 |
| `auditStatus` | `string` | Y | PENDING/APPROVED/REJECTED | 审计状态 |
| `status` | `ref:ContentStatus` | Y | - | 状态 |
| `status` | `string` | Y | DRAFT/ACTIVE/OFF_SHELF | 状态 |
| `coverUrl` | `string` | N | - | 封面链接 |
| `createdAt` | `string` | Y | - | 创建时间 |
| `description` | `string` | N | - | 描述 |
| `coverFileId` | `ref:Uuid` | N | - | 封面文件ID |
| `coverFileId` | `string` | N | - | 封面文件ID |
| `media` | `array<ref:ContentMedia>` | N | - | 媒体 |
| `media[]` | `ref:ContentMedia` | N | - | 媒体 |
| `media[]` | `object` | N | - | 媒体 |
| `media[].fileId` | `ref:Uuid` | Y | - | 文件ID |
| `media[].fileId` | `string` | Y | - | 文件ID |
| `media[].type` | `ref:ContentMediaType` | Y | - | 类型 |
| `media[].type` | `string` | Y | IMAGE/VIDEO/FILE | 类型 |
| `media[].sort` | `integer` | Y | - | 排序 |
| `media[].url` | `string` | N | - | 链接 |
| `media[].mimeType` | `string` | N | - | 媒体类型 |
| `media[].sizeBytes` | `integer` | N | - | 大小字节 |
| `media[].fileName` | `string` | N | - | 文件名称 |

### 5.6 `AchievementMaturity`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.7 `AchievementRecord`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `publisherUserId` | `ref:Uuid` | Y | - | 发布者用户ID |
| `publisherUserId` | `string` | Y | - | 发布者用户ID |
| `source` | `ref:ContentSource` | Y | - | 来源 |
| `source` | `string` | Y | USER/PLATFORM/ADMIN | 来源 |
| `title` | `string` | Y | - | 标题 |
| `summary` | `string` | N | - | 摘要 |
| `description` | `string` | N | - | 描述 |
| `keywordsJson` | `array<string>` | N | - | 关键词JSON |
| `keywordsJson[]` | `string` | N | - | 关键词JSON |
| `maturity` | `ref:AchievementMaturity` | N | - | 成熟度 |
| `maturity` | `string` | N | CONCEPT/PROTOTYPE/PILOT/MASS_PRODUCTION/COMMERCIALIZED/OTHER | 成熟度 |
| `cooperationModesJson` | `array<string>` | N | - | 合作模式JSON |
| `cooperationModesJson[]` | `string` | N | - | 合作模式JSON |
| `coverFileId` | `ref:Uuid` | N | - | 封面文件ID |
| `coverFileId` | `string` | N | - | 封面文件ID |
| `regionCode` | `string` | N | - | 地区编码 |
| `industryTagsJson` | `array<string>` | N | - | 行业标签JSON |
| `industryTagsJson[]` | `string` | N | - | 行业标签JSON |
| `auditStatus` | `ref:AuditStatus` | Y | - | 审计状态 |
| `auditStatus` | `string` | Y | PENDING/APPROVED/REJECTED | 审计状态 |
| `status` | `ref:ContentStatus` | Y | - | 状态 |
| `status` | `string` | Y | DRAFT/ACTIVE/OFF_SHELF | 状态 |
| `createdAt` | `string` | Y | - | 创建时间 |
| `updatedAt` | `string` | Y | - | 更新时间 |

### 5.8 `AchievementSortBy`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.9 `AchievementSummary`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `source` | `ref:ContentSource` | N | - | 来源 |
| `source` | `string` | N | USER/PLATFORM/ADMIN | 来源 |
| `title` | `string` | Y | - | 标题 |
| `summary` | `string` | N | - | 摘要 |
| `maturity` | `ref:AchievementMaturity` | N | - | 成熟度 |
| `maturity` | `string` | N | CONCEPT/PROTOTYPE/PILOT/MASS_PRODUCTION/COMMERCIALIZED/OTHER | 成熟度 |
| `cooperationModes` | `array<string>` | N | - | 合作模式 |
| `cooperationModes[]` | `string` | N | - | 合作模式 |
| `regionCode` | `string` | N | - | 地区编码 |
| `industryTags` | `array<string>` | N | - | 行业标签 |
| `industryTags[]` | `string` | N | - | 行业标签 |
| `keywords` | `array<string>` | N | - | 关键词 |
| `keywords[]` | `string` | N | - | 关键词 |
| `publisher` | `ref:OrganizationSummary` | N | - | 发布者 |
| `publisher` | `object` | N | - | 发布者 |
| `publisher.userId` | `ref:Uuid` | Y | - | 用户ID |
| `publisher.userId` | `string` | Y | - | 用户ID |
| `publisher.displayName` | `string` | Y | - | 显示名称 |
| `publisher.verificationType` | `ref:VerificationType` | Y | - | 认证类型 |
| `publisher.verificationType` | `string` | Y | PERSON/COMPANY/ACADEMY/GOVERNMENT/ASSOCIATION/TECH_MANAGER | 认证类型 |
| `publisher.verificationStatus` | `ref:VerificationStatus` | Y | - | 认证状态 |
| `publisher.verificationStatus` | `string` | Y | PENDING/APPROVED/REJECTED | 认证状态 |
| `publisher.orgCategory` | `ref:SupplyType` | N | - | 机构分类 |
| `publisher.orgCategory` | `string` | N | UNIVERSITY/UNIVERSITY_985/UNIVERSITY_211/RESEARCH_INSTITUTE/OTHER | 机构分类 |
| `publisher.regionCode` | `string` | N | - | 地区编码 |
| `publisher.logoUrl` | `string` | N | - | 标识链接 |
| `publisher.intro` | `string` | N | - | 简介 |
| `publisher.stats` | `ref:OrganizationStats` | N | - | 统计 |
| `publisher.stats` | `object` | N | - | 统计 |
| `publisher.stats.listingCount` | `integer` | Y | - | 挂牌数量 |
| `publisher.stats.patentCount` | `integer` | Y | - | 专利数量 |
| `publisher.verifiedAt` | `string` | N | - | 已核验时间 |
| `stats` | `ref:ListingStats` | N | - | 统计 |
| `stats` | `object` | N | - | 统计 |
| `stats.viewCount` | `integer` | Y | - | 浏览数量 |
| `stats.favoriteCount` | `integer` | Y | - | 收藏数量 |
| `stats.consultCount` | `integer` | Y | - | 咨询数量 |
| `stats.commentCount` | `integer` | N | - | 评论数量 |
| `auditStatus` | `ref:AuditStatus` | Y | - | 审计状态 |
| `auditStatus` | `string` | Y | PENDING/APPROVED/REJECTED | 审计状态 |
| `status` | `ref:ContentStatus` | Y | - | 状态 |
| `status` | `string` | Y | DRAFT/ACTIVE/OFF_SHELF | 状态 |
| `coverUrl` | `string` | N | - | 封面链接 |
| `createdAt` | `string` | Y | - | 创建时间 |

### 5.10 `AchievementUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `title` | `string` | N | - | 标题 |
| `summary` | `string` | N | - | 摘要 |
| `description` | `string` | N | - | 描述 |
| `maturity` | `ref:AchievementMaturity` | N | - | 成熟度 |
| `maturity` | `string` | N | CONCEPT/PROTOTYPE/PILOT/MASS_PRODUCTION/COMMERCIALIZED/OTHER | 成熟度 |
| `regionCode` | `string` | N | - | 地区编码 |
| `industryTags` | `array<string>` | N | - | 行业标签 |
| `industryTags[]` | `string` | N | - | 行业标签 |
| `keywords` | `array<string>` | N | - | 关键词 |
| `keywords[]` | `string` | N | - | 关键词 |
| `cooperationModes` | `array<string>` | N | - | 合作模式 |
| `cooperationModes[]` | `string` | N | - | 合作模式 |
| `coverFileId` | `ref:Uuid` | N | - | 封面文件ID |
| `coverFileId` | `string` | N | - | 封面文件ID |
| `media` | `array<ref:ContentMediaInput>` | N | - | 媒体 |
| `media[]` | `ref:ContentMediaInput` | N | - | 媒体 |
| `media[]` | `object` | N | - | 媒体 |
| `media[].fileId` | `ref:Uuid` | Y | - | 文件ID |
| `media[].fileId` | `string` | Y | - | 文件ID |
| `media[].type` | `ref:ContentMediaType` | Y | - | 类型 |
| `media[].type` | `string` | Y | IMAGE/VIDEO/FILE | 类型 |
| `media[].sort` | `integer` | N | - | 排序 |

### 5.11 `Address`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `userId` | `ref:Uuid` | Y | - | 用户ID |
| `userId` | `string` | Y | - | 用户ID |
| `name` | `string` | Y | - | 名称 |
| `phone` | `ref:PhoneNumber` | Y | - | 手机号 |
| `phone` | `string` | Y | - | 手机号 |
| `regionCode` | `string` | N | - | 地区编码 |
| `addressLine` | `string` | Y | - | 地址行 |
| `isDefault` | `boolean` | Y | - | 是否默认 |
| `createdAt` | `string` | Y | - | 创建时间 |
| `updatedAt` | `string` | Y | - | 更新时间 |

### 5.12 `AddressCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `name` | `string` | N | - | 名称 |
| `phone` | `ref:PhoneNumber` | N | - | 手机号 |
| `phone` | `string` | N | - | 手机号 |
| `regionCode` | `string` | N | - | 地区编码 |
| `addressLine` | `string` | N | - | 地址行 |
| `isDefault` | `boolean` | N | - | 是否默认 |

### 5.13 `AddressUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `name` | `string` | N | - | 名称 |
| `phone` | `ref:PhoneNumber` | N | - | 手机号 |
| `phone` | `string` | N | - | 手机号 |
| `regionCode` | `string` | N | - | 地区编码 |
| `addressLine` | `string` | N | - | 地址行 |
| `isDefault` | `boolean` | N | - | 是否默认 |

### 5.14 `AdminCommentUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `status` | `ref:CommentStatus` | Y | - | 状态 |
| `status` | `string` | Y | VISIBLE/HIDDEN/DELETED | 状态 |

### 5.15 `AdminListingCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `patentNumberRaw` | `string` | N | - | 专利编号原始 |
| `patentType` | `ref:PatentType` | N | - | 专利类型 |
| `patentType` | `string` | N | INVENTION/UTILITY_MODEL/DESIGN | 专利类型 |
| `title` | `string` | N | - | 标题 |
| `inventorNames` | `array<string>` | N | - | 发明人名称 |
| `inventorNames[]` | `string` | N | - | 发明人名称 |
| `assigneeNames` | `array<string>` | N | - | 受让方名称 |
| `assigneeNames[]` | `string` | N | - | 受让方名称 |
| `applicantNames` | `array<string>` | N | - | 申请人名称 |
| `applicantNames[]` | `string` | N | - | 申请人名称 |
| `legalStatus` | `ref:LegalStatus` | N | - | 法律状态 |
| `legalStatus` | `string` | N | PENDING/GRANTED/EXPIRED/INVALIDATED/UNKNOWN | 法律状态 |
| `legalStatusRaw` | `string` | N | - | 法律状态原始 |
| `filingDate` | `string` | N | - | 申请日期 |
| `publicationDate` | `string` | N | - | 公开日期 |
| `grantDate` | `string` | N | - | 授权日期 |
| `transferCount` | `integer` | N | - | 转让数量 |
| `summary` | `string` | N | - | 摘要 |
| `deliverables` | `array<string>` | N | - | 交付物 |
| `deliverables[]` | `string` | N | - | 交付物 |
| `expectedCompletionDays` | `integer` | N | - | 预计完成天 |
| `negotiableRangeFen` | `ref:MoneyFen` | N | - | 可议价范围分 |
| `negotiableRangeFen` | `integer` | N | - | 可议价范围分 |
| `negotiableRangePercent` | `number` | N | - | 可议价范围百分比 |
| `negotiableNote` | `string` | N | - | 可议价备注 |
| `pledgeStatus` | `ref:PledgeStatus` | N | - | 质押状态 |
| `pledgeStatus` | `string` | N | NONE/PLEDGED/UNKNOWN | 质押状态 |
| `existingLicenseStatus` | `ref:ExistingLicenseStatus` | N | - | 既有许可状态 |
| `existingLicenseStatus` | `string` | N | NONE/EXCLUSIVE/SOLE/NON_EXCLUSIVE/UNKNOWN | 既有许可状态 |
| `encumbranceNote` | `string` | N | - | 权利负担备注 |
| `tradeMode` | `ref:TradeMode` | Y | - | 交易模式 |
| `tradeMode` | `string` | Y | ASSIGNMENT/LICENSE | 交易模式 |
| `licenseMode` | `ref:LicenseMode` | N | - | 许可模式 |
| `licenseMode` | `string` | N | EXCLUSIVE/SOLE/NON_EXCLUSIVE | 许可模式 |
| `priceType` | `ref:PriceType` | Y | - | 价格类型 |
| `priceType` | `string` | Y | FIXED/NEGOTIABLE | 价格类型 |
| `priceAmountFen` | `ref:MoneyFen` | N | - | 价格金额分 |
| `priceAmountFen` | `integer` | N | - | 价格金额分 |
| `depositAmountFen` | `ref:MoneyFen` | N | - | 订金金额分 |
| `depositAmountFen` | `integer` | N | - | 订金金额分 |
| `regionCode` | `string` | N | - | 地区编码 |
| `industryTags` | `array<string>` | N | - | 行业标签 |
| `industryTags[]` | `string` | N | - | 行业标签 |
| `listingTopics` | `array<ref:ListingTopic>` | N | - | 挂牌主题 |
| `listingTopics[]` | `ref:ListingTopic` | N | - | 挂牌主题 |
| `listingTopics[]` | `string` | N | HIGH_TECH_RETIRED/SLEEPING/AWARD_WINNING/FIVE_STAR/OPEN_LICENSE | 挂牌主题 |
| `consultationRouting` | `ref:ConsultationRouting` | N | - | 咨询路由 |
| `consultationRouting` | `string` | N | PLATFORM/OWNER | 咨询路由 |
| `ipcCodes` | `array<string>` | N | - | IPC编码 |
| `ipcCodes[]` | `string` | N | - | IPC编码 |
| `locCodes` | `array<string>` | N | - | 位置编码 |
| `locCodes[]` | `string` | N | - | 位置编码 |
| `media` | `array<ref:ListingMedia>` | N | - | 媒体 |
| `media[]` | `ref:ListingMedia` | N | - | 媒体 |
| `media[]` | `object` | N | - | 媒体 |
| `media[].fileId` | `ref:Uuid` | Y | - | 文件ID |
| `media[].fileId` | `string` | Y | - | 文件ID |
| `media[].type` | `string` | Y | IMAGE/FILE | 类型 |
| `media[].sort` | `integer` | Y | - | 排序 |
| `proofFileIds` | `array<ref:Uuid>` | N | - | 凭证文件ID |
| `proofFileIds[]` | `ref:Uuid` | N | - | 凭证文件ID |
| `proofFileIds[]` | `string` | N | - | 凭证文件ID |
| `source` | `ref:ContentSource` | N | - | 来源 |
| `source` | `string` | N | USER/PLATFORM/ADMIN | 来源 |
| `sellerUserId` | `ref:Uuid` | N | - | 卖方用户ID |
| `sellerUserId` | `string` | N | - | 卖方用户ID |
| `auditStatus` | `ref:AuditStatus` | N | - | 审计状态 |
| `auditStatus` | `string` | N | PENDING/APPROVED/REJECTED | 审计状态 |
| `status` | `ref:ListingStatus` | N | - | 状态 |
| `status` | `string` | N | DRAFT/ACTIVE/OFF_SHELF/SOLD | 状态 |

### 5.16 `AdminListingUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `patentNumberRaw` | `string` | N | - | 专利编号原始 |
| `title` | `string` | N | - | 标题 |
| `inventorNames` | `array<string>` | N | - | 发明人名称 |
| `inventorNames[]` | `string` | N | - | 发明人名称 |
| `assigneeNames` | `array<string>` | N | - | 受让方名称 |
| `assigneeNames[]` | `string` | N | - | 受让方名称 |
| `applicantNames` | `array<string>` | N | - | 申请人名称 |
| `applicantNames[]` | `string` | N | - | 申请人名称 |
| `legalStatus` | `ref:LegalStatus` | N | - | 法律状态 |
| `legalStatus` | `string` | N | PENDING/GRANTED/EXPIRED/INVALIDATED/UNKNOWN | 法律状态 |
| `legalStatusRaw` | `string` | N | - | 法律状态原始 |
| `filingDate` | `string` | N | - | 申请日期 |
| `publicationDate` | `string` | N | - | 公开日期 |
| `grantDate` | `string` | N | - | 授权日期 |
| `transferCount` | `integer` | N | - | 转让数量 |
| `summary` | `string` | N | - | 摘要 |
| `deliverables` | `array<string>` | N | - | 交付物 |
| `deliverables[]` | `string` | N | - | 交付物 |
| `expectedCompletionDays` | `integer` | N | - | 预计完成天 |
| `negotiableRangeFen` | `ref:MoneyFen` | N | - | 可议价范围分 |
| `negotiableRangeFen` | `integer` | N | - | 可议价范围分 |
| `negotiableRangePercent` | `number` | N | - | 可议价范围百分比 |
| `negotiableNote` | `string` | N | - | 可议价备注 |
| `pledgeStatus` | `ref:PledgeStatus` | N | - | 质押状态 |
| `pledgeStatus` | `string` | N | NONE/PLEDGED/UNKNOWN | 质押状态 |
| `existingLicenseStatus` | `ref:ExistingLicenseStatus` | N | - | 既有许可状态 |
| `existingLicenseStatus` | `string` | N | NONE/EXCLUSIVE/SOLE/NON_EXCLUSIVE/UNKNOWN | 既有许可状态 |
| `encumbranceNote` | `string` | N | - | 权利负担备注 |
| `tradeMode` | `ref:TradeMode` | N | - | 交易模式 |
| `tradeMode` | `string` | N | ASSIGNMENT/LICENSE | 交易模式 |
| `licenseMode` | `ref:LicenseMode` | N | - | 许可模式 |
| `licenseMode` | `string` | N | EXCLUSIVE/SOLE/NON_EXCLUSIVE | 许可模式 |
| `priceType` | `ref:PriceType` | N | - | 价格类型 |
| `priceType` | `string` | N | FIXED/NEGOTIABLE | 价格类型 |
| `priceAmountFen` | `ref:MoneyFen` | N | - | 价格金额分 |
| `priceAmountFen` | `integer` | N | - | 价格金额分 |
| `depositAmountFen` | `ref:MoneyFen` | N | - | 订金金额分 |
| `depositAmountFen` | `integer` | N | - | 订金金额分 |
| `regionCode` | `string` | N | - | 地区编码 |
| `industryTags` | `array<string>` | N | - | 行业标签 |
| `industryTags[]` | `string` | N | - | 行业标签 |
| `listingTopics` | `array<ref:ListingTopic>` | N | - | 挂牌主题 |
| `listingTopics[]` | `ref:ListingTopic` | N | - | 挂牌主题 |
| `listingTopics[]` | `string` | N | HIGH_TECH_RETIRED/SLEEPING/AWARD_WINNING/FIVE_STAR/OPEN_LICENSE | 挂牌主题 |
| `consultationRouting` | `ref:ConsultationRouting` | N | - | 咨询路由 |
| `consultationRouting` | `string` | N | PLATFORM/OWNER | 咨询路由 |
| `ipcCodes` | `array<string>` | N | - | IPC编码 |
| `ipcCodes[]` | `string` | N | - | IPC编码 |
| `locCodes` | `array<string>` | N | - | 位置编码 |
| `locCodes[]` | `string` | N | - | 位置编码 |
| `media` | `array<ref:ListingMedia>` | N | - | 媒体 |
| `media[]` | `ref:ListingMedia` | N | - | 媒体 |
| `media[]` | `object` | N | - | 媒体 |
| `media[].fileId` | `ref:Uuid` | Y | - | 文件ID |
| `media[].fileId` | `string` | Y | - | 文件ID |
| `media[].type` | `string` | Y | IMAGE/FILE | 类型 |
| `media[].sort` | `integer` | Y | - | 排序 |
| `proofFileIds` | `array<ref:Uuid>` | N | - | 凭证文件ID |
| `proofFileIds[]` | `ref:Uuid` | N | - | 凭证文件ID |
| `proofFileIds[]` | `string` | N | - | 凭证文件ID |
| `source` | `ref:ContentSource` | N | - | 来源 |
| `source` | `string` | N | USER/PLATFORM/ADMIN | 来源 |
| `sellerUserId` | `ref:Uuid` | N | - | 卖方用户ID |
| `sellerUserId` | `string` | N | - | 卖方用户ID |
| `auditStatus` | `ref:AuditStatus` | N | - | 审计状态 |
| `auditStatus` | `string` | N | PENDING/APPROVED/REJECTED | 审计状态 |
| `status` | `ref:ListingStatus` | N | - | 状态 |
| `status` | `string` | N | DRAFT/ACTIVE/OFF_SHELF/SOLD | 状态 |

### 5.17 `AiAgentInputType`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.18 `AiAgentMatchSummary`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `contentType` | `ref:AiContentType` | Y | - | 内容类型 |
| `contentType` | `string` | Y | LISTING | 内容类型 |
| `contentId` | `ref:Uuid` | Y | - | 内容ID |
| `contentId` | `string` | Y | - | 内容ID |
| `title` | `string` | Y | - | 标题 |
| `reason` | `string` | N | - | 原因 |
| `score` | `number` | N | - | 分值 |

### 5.19 `AiAgentParsedQuery`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `contentType` | `ref:AiContentType` | N | - | 内容类型 |
| `contentType` | `string` | N | LISTING | 内容类型 |
| `keywords` | `array<string>` | N | - | 关键词 |
| `keywords[]` | `string` | N | - | 关键词 |
| `applicationScenario` | `string` | N | - | 申请场景 |
| `filters` | `ref:AiSearchFilters` | N | - | 筛选 |
| `filters` | `object` | N | - | 筛选 |
| `filters.q` | `string` | N | - | 查询词 |
| `filters.patentType` | `ref:PatentType` | N | - | 专利类型 |
| `filters.patentType` | `string` | N | INVENTION/UTILITY_MODEL/DESIGN | 专利类型 |
| `filters.tradeMode` | `ref:TradeMode` | N | - | 交易模式 |
| `filters.tradeMode` | `string` | N | ASSIGNMENT/LICENSE | 交易模式 |
| `filters.priceType` | `ref:PriceType` | N | - | 价格类型 |
| `filters.priceType` | `string` | N | FIXED/NEGOTIABLE | 价格类型 |
| `filters.priceMin` | `ref:MoneyFen` | N | - | 价格最小 |
| `filters.priceMin` | `integer` | N | - | 价格最小 |
| `filters.priceMax` | `ref:MoneyFen` | N | - | 价格最大 |
| `filters.priceMax` | `integer` | N | - | 价格最大 |
| `filters.depositMin` | `ref:MoneyFen` | N | - | 订金最小 |
| `filters.depositMin` | `integer` | N | - | 订金最小 |
| `filters.depositMax` | `ref:MoneyFen` | N | - | 订金最大 |
| `filters.depositMax` | `integer` | N | - | 订金最大 |
| `filters.regionCode` | `string` | N | - | 地区编码 |
| `filters.industryTags` | `array<string>` | N | - | 行业标签 |
| `filters.industryTags[]` | `string` | N | - | 行业标签 |
| `filters.cooperationModes` | `array<ref:CooperationMode>` | N | - | 合作模式 |
| `filters.cooperationModes[]` | `ref:CooperationMode` | N | - | 合作模式 |
| `filters.cooperationModes[]` | `string` | N | TRANSFER/TECH_CONSULTING/COMMISSIONED_DEV/PLATFORM_CO_BUILD | 合作模式 |

### 5.20 `AiAgentQueryRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `inputType` | `ref:AiAgentInputType` | Y | - | 输入类型 |
| `inputType` | `string` | Y | TEXT/VOICE | 输入类型 |
| `inputText` | `string` | N | - | 输入文本 |
| `audioFileId` | `ref:Uuid` | N | - | 音频文件ID |
| `audioFileId` | `string` | N | - | 音频文件ID |
| `contentScope` | `ref:AiContentScope` | N | - | 内容范围 |
| `contentScope` | `string` | N | LISTING/ALL | 内容范围 |
| `regionCode` | `string` | N | - | 地区编码 |
| `industryTags` | `array<string>` | N | - | 行业标签 |
| `industryTags[]` | `string` | N | - | 行业标签 |
| `extraContext` | `object` | N | - | 扩展上下文 |

### 5.21 `AiAgentQueryResult`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `queryId` | `ref:Uuid` | Y | - | 查询ID |
| `queryId` | `string` | Y | - | 查询ID |
| `recognizedText` | `string` | N | - | 识别文本 |
| `normalizedText` | `string` | N | - | 规范化文本 |
| `contentScope` | `ref:AiContentScope` | N | - | 内容范围 |
| `contentScope` | `string` | N | LISTING/ALL | 内容范围 |
| `parsedQuery` | `ref:AiAgentParsedQuery` | Y | - | 解析查询 |
| `parsedQuery` | `object` | Y | - | 解析查询 |
| `parsedQuery.contentType` | `ref:AiContentType` | N | - | 内容类型 |
| `parsedQuery.contentType` | `string` | N | LISTING | 内容类型 |
| `parsedQuery.keywords` | `array<string>` | N | - | 关键词 |
| `parsedQuery.keywords[]` | `string` | N | - | 关键词 |
| `parsedQuery.applicationScenario` | `string` | N | - | 申请场景 |
| `parsedQuery.filters` | `ref:AiSearchFilters` | N | - | 筛选 |
| `parsedQuery.filters` | `object` | N | - | 筛选 |
| `parsedQuery.filters.q` | `string` | N | - | 查询词 |
| `parsedQuery.filters.patentType` | `ref:PatentType` | N | - | 专利类型 |
| `parsedQuery.filters.patentType` | `string` | N | INVENTION/UTILITY_MODEL/DESIGN | 专利类型 |
| `parsedQuery.filters.tradeMode` | `ref:TradeMode` | N | - | 交易模式 |
| `parsedQuery.filters.tradeMode` | `string` | N | ASSIGNMENT/LICENSE | 交易模式 |
| `parsedQuery.filters.priceType` | `ref:PriceType` | N | - | 价格类型 |
| `parsedQuery.filters.priceType` | `string` | N | FIXED/NEGOTIABLE | 价格类型 |
| `parsedQuery.filters.priceMin` | `ref:MoneyFen` | N | - | 价格最小 |
| `parsedQuery.filters.priceMin` | `integer` | N | - | 价格最小 |
| `parsedQuery.filters.priceMax` | `ref:MoneyFen` | N | - | 价格最大 |
| `parsedQuery.filters.priceMax` | `integer` | N | - | 价格最大 |
| `parsedQuery.filters.depositMin` | `ref:MoneyFen` | N | - | 订金最小 |
| `parsedQuery.filters.depositMin` | `integer` | N | - | 订金最小 |
| `parsedQuery.filters.depositMax` | `ref:MoneyFen` | N | - | 订金最大 |
| `parsedQuery.filters.depositMax` | `integer` | N | - | 订金最大 |
| `parsedQuery.filters.regionCode` | `string` | N | - | 地区编码 |
| `parsedQuery.filters.industryTags` | `array<string>` | N | - | 行业标签 |
| `parsedQuery.filters.industryTags[]` | `string` | N | - | 行业标签 |
| `parsedQuery.filters.cooperationModes` | `array<ref:CooperationMode>` | N | - | 合作模式 |
| `parsedQuery.filters.cooperationModes[]` | `ref:CooperationMode` | N | - | 合作模式 |
| `parsedQuery.filters.cooperationModes[]` | `string` | N | TRANSFER/TECH_CONSULTING/COMMISSIONED_DEV/PLATFORM_CO_BUILD | 合作模式 |
| `matchSummary` | `string` | N | - | 匹配摘要 |
| `topMatches` | `array<ref:AiAgentMatchSummary>` | N | - | 最高匹配 |
| `topMatches[]` | `ref:AiAgentMatchSummary` | N | - | 最高匹配 |
| `topMatches[]` | `object` | N | - | 最高匹配 |
| `topMatches[].contentType` | `ref:AiContentType` | Y | - | 内容类型 |
| `topMatches[].contentType` | `string` | Y | LISTING | 内容类型 |
| `topMatches[].contentId` | `ref:Uuid` | Y | - | 内容ID |
| `topMatches[].contentId` | `string` | Y | - | 内容ID |
| `topMatches[].title` | `string` | Y | - | 标题 |
| `topMatches[].reason` | `string` | N | - | 原因 |
| `topMatches[].score` | `number` | N | - | 分值 |
| `confidence` | `number` | N | - | 置信度 |
| `createdAt` | `string` | N | - | 创建时间 |

### 5.22 `AiContentScope`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.23 `AiContentType`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.24 `AiParseFeedback`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `parseResultId` | `ref:Uuid` | Y | - | 解析结果ID |
| `parseResultId` | `string` | Y | - | 解析结果ID |
| `actorUserId` | `ref:Uuid` | N | - | 操作人用户ID |
| `actorUserId` | `string` | N | - | 操作人用户ID |
| `actorType` | `ref:AiParseFeedbackActorType` | Y | - | 操作人类型 |
| `actorType` | `string` | Y | USER/ADMIN | 操作人类型 |
| `score` | `integer` | Y | - | 分值 |
| `reasonTags` | `array<string>` | N | - | 原因标签 |
| `reasonTags[]` | `string` | N | - | 原因标签 |
| `comment` | `string` | N | - | 评论 |
| `createdAt` | `string` | Y | - | 创建时间 |

### 5.25 `AiParseFeedbackActorType`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.26 `AiParseFeedbackRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `score` | `integer` | Y | - | 分值 |
| `reasonTags` | `array<string>` | N | - | 原因标签 |
| `reasonTags[]` | `string` | N | - | 原因标签 |
| `comment` | `string` | N | - | 评论 |

### 5.27 `AiParseResult`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `contentType` | `ref:AiContentType` | Y | - | 内容类型 |
| `contentType` | `string` | Y | LISTING | 内容类型 |
| `contentId` | `ref:Uuid` | Y | - | 内容ID |
| `contentId` | `string` | Y | - | 内容ID |
| `summaryPlain` | `string` | N | - | 摘要纯文本 |
| `featuresPlain` | `string` | N | - | 特征纯文本 |
| `keywords` | `array<string>` | N | - | 关键词 |
| `keywords[]` | `string` | N | - | 关键词 |
| `confidence` | `number` | Y | - | 置信度 |
| `modelVersion` | `string` | N | - | 模型版本 |
| `status` | `ref:AiParseStatus` | Y | - | 状态 |
| `status` | `string` | Y | ACTIVE/REVIEW_REQUIRED/REPLACED | 状态 |
| `createdAt` | `string` | Y | - | 创建时间 |
| `updatedAt` | `string` | N | - | 更新时间 |

### 5.28 `AiParseResultUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `summaryPlain` | `string` | N | - | 摘要纯文本 |
| `featuresPlain` | `string` | N | - | 特征纯文本 |
| `keywords` | `array<string>` | N | - | 关键词 |
| `keywords[]` | `string` | N | - | 关键词 |
| `status` | `ref:AiParseStatus` | N | - | 状态 |
| `status` | `string` | N | ACTIVE/REVIEW_REQUIRED/REPLACED | 状态 |
| `note` | `string` | N | - | 备注 |

### 5.29 `AiParseStatus`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.30 `AiSearchFilters`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `q` | `string` | N | - | 查询词 |
| `patentType` | `ref:PatentType` | N | - | 专利类型 |
| `patentType` | `string` | N | INVENTION/UTILITY_MODEL/DESIGN | 专利类型 |
| `tradeMode` | `ref:TradeMode` | N | - | 交易模式 |
| `tradeMode` | `string` | N | ASSIGNMENT/LICENSE | 交易模式 |
| `priceType` | `ref:PriceType` | N | - | 价格类型 |
| `priceType` | `string` | N | FIXED/NEGOTIABLE | 价格类型 |
| `priceMin` | `ref:MoneyFen` | N | - | 价格最小 |
| `priceMin` | `integer` | N | - | 价格最小 |
| `priceMax` | `ref:MoneyFen` | N | - | 价格最大 |
| `priceMax` | `integer` | N | - | 价格最大 |
| `depositMin` | `ref:MoneyFen` | N | - | 订金最小 |
| `depositMin` | `integer` | N | - | 订金最小 |
| `depositMax` | `ref:MoneyFen` | N | - | 订金最大 |
| `depositMax` | `integer` | N | - | 订金最大 |
| `regionCode` | `string` | N | - | 地区编码 |
| `industryTags` | `array<string>` | N | - | 行业标签 |
| `industryTags[]` | `string` | N | - | 行业标签 |
| `cooperationModes` | `array<ref:CooperationMode>` | N | - | 合作模式 |
| `cooperationModes[]` | `ref:CooperationMode` | N | - | 合作模式 |
| `cooperationModes[]` | `string` | N | TRANSFER/TECH_CONSULTING/COMMISSIONED_DEV/PLATFORM_CO_BUILD | 合作模式 |

### 5.31 `AlertChannel`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.32 `AlertConfig`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `enabled` | `boolean` | Y | - | 启用 |
| `defaultChannels` | `array<ref:AlertChannel>` | N | - | 默认渠道 |
| `defaultChannels[]` | `ref:AlertChannel` | N | - | 默认渠道 |
| `defaultChannels[]` | `string` | N | SMS/EMAIL/IN_APP | 默认渠道 |
| `rules` | `array<ref:AlertRule>` | Y | - | 规则 |
| `rules[]` | `ref:AlertRule` | N | - | 规则 |
| `rules[]` | `object` | N | - | 规则 |
| `rules[].type` | `string` | Y | - | 类型 |
| `rules[].severity` | `ref:AlertSeverity` | Y | - | 严重级别 |
| `rules[].severity` | `string` | Y | LOW/MEDIUM/HIGH | 严重级别 |
| `rules[].channels` | `array<ref:AlertChannel>` | Y | - | 渠道 |
| `rules[].channels[]` | `ref:AlertChannel` | N | - | 渠道 |
| `rules[].channels[]` | `string` | N | SMS/EMAIL/IN_APP | 渠道 |
| `rules[].enabled` | `boolean` | Y | - | 启用 |
| `rules[].threshold` | `number` | N | - | 阈值 |
| `rules[].cooldownMinutes` | `integer` | N | - | 冷却分钟 |

### 5.33 `AlertConfigUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `enabled` | `boolean` | N | - | 启用 |
| `defaultChannels` | `array<ref:AlertChannel>` | N | - | 默认渠道 |
| `defaultChannels[]` | `ref:AlertChannel` | N | - | 默认渠道 |
| `defaultChannels[]` | `string` | N | SMS/EMAIL/IN_APP | 默认渠道 |
| `rules` | `array<ref:AlertRule>` | N | - | 规则 |
| `rules[]` | `ref:AlertRule` | N | - | 规则 |
| `rules[]` | `object` | N | - | 规则 |
| `rules[].type` | `string` | Y | - | 类型 |
| `rules[].severity` | `ref:AlertSeverity` | Y | - | 严重级别 |
| `rules[].severity` | `string` | Y | LOW/MEDIUM/HIGH | 严重级别 |
| `rules[].channels` | `array<ref:AlertChannel>` | Y | - | 渠道 |
| `rules[].channels[]` | `ref:AlertChannel` | N | - | 渠道 |
| `rules[].channels[]` | `string` | N | SMS/EMAIL/IN_APP | 渠道 |
| `rules[].enabled` | `boolean` | Y | - | 启用 |
| `rules[].threshold` | `number` | N | - | 阈值 |
| `rules[].cooldownMinutes` | `integer` | N | - | 冷却分钟 |

### 5.34 `AlertEvent`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `type` | `string` | Y | - | 类型 |
| `severity` | `ref:AlertSeverity` | Y | - | 严重级别 |
| `severity` | `string` | Y | LOW/MEDIUM/HIGH | 严重级别 |
| `channel` | `ref:AlertChannel` | Y | - | 渠道 |
| `channel` | `string` | Y | SMS/EMAIL/IN_APP | 渠道 |
| `status` | `ref:AlertStatus` | Y | - | 状态 |
| `status` | `string` | Y | PENDING/SENT/ACKED/SUPPRESSED | 状态 |
| `targetType` | `ref:AlertTargetType` | N | - | 目标类型 |
| `targetType` | `string` | N | PATENT/ORDER/LISTING/AI_PARSE/IMPORT/PAYMENT/REFUND/SYSTEM | 目标类型 |
| `targetId` | `ref:Uuid` | N | - | 目标ID |
| `targetId` | `string` | N | - | 目标ID |
| `message` | `string` | N | - | 消息 |
| `triggeredAt` | `string` | Y | - | 触发时间 |
| `sentAt` | `string` | N | - | 已发送时间 |

### 5.35 `AlertRule`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `type` | `string` | Y | - | 类型 |
| `severity` | `ref:AlertSeverity` | Y | - | 严重级别 |
| `severity` | `string` | Y | LOW/MEDIUM/HIGH | 严重级别 |
| `channels` | `array<ref:AlertChannel>` | Y | - | 渠道 |
| `channels[]` | `ref:AlertChannel` | N | - | 渠道 |
| `channels[]` | `string` | N | SMS/EMAIL/IN_APP | 渠道 |
| `enabled` | `boolean` | Y | - | 启用 |
| `threshold` | `number` | N | - | 阈值 |
| `cooldownMinutes` | `integer` | N | - | 冷却分钟 |

### 5.36 `AlertSeverity`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.37 `AlertStatus`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.38 `AlertTargetType`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.39 `AuditLog`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `action` | `string` | Y | - | 操作 |
| `reason` | `string` | N | - | 原因 |
| `operatorId` | `ref:Uuid` | N | - | 操作人ID |
| `operatorId` | `string` | N | - | 操作人ID |
| `operatorName` | `string` | N | - | 操作人名称 |
| `createdAt` | `string` | Y | - | 创建时间 |

### 5.40 `AuditLogList`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:AuditLog>` | Y | - | 条目 |
| `items[]` | `ref:AuditLog` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `ref:Uuid` | Y | - | ID |
| `items[].id` | `string` | Y | - | ID |
| `items[].action` | `string` | Y | - | 操作 |
| `items[].reason` | `string` | N | - | 原因 |
| `items[].operatorId` | `ref:Uuid` | N | - | 操作人ID |
| `items[].operatorId` | `string` | N | - | 操作人ID |
| `items[].operatorName` | `string` | N | - | 操作人名称 |
| `items[].createdAt` | `string` | Y | - | 创建时间 |

### 5.41 `AuditMaterial`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `name` | `string` | Y | - | 名称 |
| `url` | `string` | N | - | 链接 |
| `kind` | `string` | N | - | 类别 |
| `uploadedAt` | `string` | Y | - | 上传时间 |

### 5.42 `AuditMaterialList`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:AuditMaterial>` | Y | - | 条目 |
| `items[]` | `ref:AuditMaterial` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `ref:Uuid` | Y | - | ID |
| `items[].id` | `string` | Y | - | ID |
| `items[].name` | `string` | Y | - | 名称 |
| `items[].url` | `string` | N | - | 链接 |
| `items[].kind` | `string` | N | - | 类别 |
| `items[].uploadedAt` | `string` | Y | - | 上传时间 |

### 5.43 `AuditStatus`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.44 `AuthSession`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `userId` | `ref:Uuid` | Y | - | 用户ID |
| `userId` | `string` | Y | - | 用户ID |
| `isAdmin` | `boolean` | Y | - | 是否后台 |
| `role` | `string` | N | - | 角色 |
| `roleNames` | `array<string>` | Y | - | 角色名称 |
| `roleNames[]` | `string` | N | - | 角色名称 |
| `roleIds` | `array<string>` | Y | - | 角色ID |
| `roleIds[]` | `string` | N | - | 角色ID |
| `permissions` | `array<string>` | Y | - | 权限 |
| `permissions[]` | `string` | N | - | 权限 |
| `nickname` | `string` | N | - | 昵称 |
| `verificationStatus` | `string` | N | - | 认证状态 |
| `verificationType` | `string` | N | - | 认证类型 |

### 5.45 `AuthTokenResponse`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `accessToken` | `string` | Y | - | 访问令牌 |
| `refreshToken` | `string` | N | - | 刷新令牌 |
| `expiresInSeconds` | `integer` | Y | - | 过期内秒 |
| `user` | `ref:UserProfile` | Y | - | 用户 |
| `user` | `object` | Y | - | 用户 |
| `user.id` | `ref:Uuid` | Y | - | ID |
| `user.id` | `string` | Y | - | ID |
| `user.phone` | `ref:PhoneNumber` | N | - | 手机号 |
| `user.phone` | `string` | N | - | 手机号 |
| `user.nickname` | `string` | N | - | 昵称 |
| `user.avatarUrl` | `string` | N | - | 头像链接 |
| `user.role` | `ref:UserRole` | Y | - | 角色 |
| `user.role` | `string` | Y | buyer/seller/cs/admin | 角色 |
| `user.verificationStatus` | `ref:VerificationStatus` | N | - | 认证状态 |
| `user.verificationStatus` | `string` | N | PENDING/APPROVED/REJECTED | 认证状态 |
| `user.verificationType` | `ref:VerificationType` | N | - | 认证类型 |
| `user.verificationType` | `string` | N | PERSON/COMPANY/ACADEMY/GOVERNMENT/ASSOCIATION/TECH_MANAGER | 认证类型 |
| `user.orgCategory` | `ref:SupplyType` | N | - | 机构分类 |
| `user.orgCategory` | `string` | N | UNIVERSITY/UNIVERSITY_985/UNIVERSITY_211/RESEARCH_INSTITUTE/OTHER | 机构分类 |
| `user.regionCode` | `string` | N | - | 地区编码 |
| `user.createdAt` | `string` | Y | - | 创建时间 |
| `user.updatedAt` | `string` | N | - | 更新时间 |

### 5.46 `BannerConfig`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:BannerItem>` | Y | - | 条目 |
| `items[]` | `ref:BannerItem` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `string` | Y | - | ID |
| `items[].title` | `string` | Y | - | 标题 |
| `items[].imageUrl` | `string` | Y | - | 图片链接 |
| `items[].linkUrl` | `string` | N | - | 链接链接 |
| `items[].enabled` | `boolean` | Y | - | 启用 |
| `items[].order` | `integer` | Y | - | 订单 |

### 5.47 `BannerItem`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `string` | Y | - | ID |
| `title` | `string` | Y | - | 标题 |
| `imageUrl` | `string` | Y | - | 图片链接 |
| `linkUrl` | `string` | N | - | 链接链接 |
| `enabled` | `boolean` | Y | - | 启用 |
| `order` | `integer` | Y | - | 订单 |

### 5.48 `CaseCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `title` | `string` | N | - | 标题 |
| `type` | `ref:CaseType` | N | - | 类型 |
| `type` | `string` | N | FOLLOWUP/REFUND/DISPUTE | 类型 |
| `status` | `ref:CaseStatus` | N | - | 状态 |
| `status` | `string` | N | OPEN/IN_PROGRESS/CLOSED | 状态 |
| `priority` | `ref:CasePriority` | N | - | 优先级 |
| `priority` | `string` | N | LOW/MEDIUM/HIGH | 优先级 |
| `requesterName` | `string` | N | - | 申请人名称 |
| `description` | `string` | N | - | 描述 |
| `orderId` | `ref:Uuid` | N | - | 订单ID |
| `orderId` | `string` | N | - | 订单ID |
| `assigneeId` | `ref:Uuid` | N | - | 受让方ID |
| `assigneeId` | `string` | N | - | 受让方ID |
| `dueAt` | `string` | N | - | 到期时间 |

### 5.49 `CaseEvidence`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `string` | Y | - | ID |
| `name` | `string` | Y | - | 名称 |
| `url` | `string` | N | - | 链接 |

### 5.50 `CaseNote`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `authorId` | `string` | Y | - | 作者ID |
| `authorName` | `string` | Y | - | 作者名称 |
| `content` | `string` | Y | - | 内容 |
| `createdAt` | `string` | Y | - | 创建时间 |

### 5.51 `CasePriority`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.52 `CaseRecord`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `title` | `string` | Y | - | 标题 |
| `type` | `ref:CaseType` | Y | - | 类型 |
| `type` | `string` | Y | FOLLOWUP/REFUND/DISPUTE | 类型 |
| `status` | `ref:CaseStatus` | Y | - | 状态 |
| `status` | `string` | Y | OPEN/IN_PROGRESS/CLOSED | 状态 |
| `orderId` | `ref:Uuid` | N | - | 订单ID |
| `orderId` | `string` | N | - | 订单ID |
| `requesterName` | `string` | N | - | 申请人名称 |
| `assigneeId` | `string` | N | - | 受让方ID |
| `assigneeName` | `string` | N | - | 受让方名称 |
| `priority` | `ref:CasePriority` | N | - | 优先级 |
| `priority` | `string` | N | LOW/MEDIUM/HIGH | 优先级 |
| `description` | `string` | N | - | 描述 |
| `createdAt` | `string` | Y | - | 创建时间 |
| `updatedAt` | `string` | N | - | 更新时间 |
| `notes` | `array<ref:CaseNote>` | Y | - | 备注 |
| `notes[]` | `ref:CaseNote` | N | - | 备注 |
| `notes[]` | `object` | N | - | 备注 |
| `notes[].id` | `ref:Uuid` | Y | - | ID |
| `notes[].id` | `string` | Y | - | ID |
| `notes[].authorId` | `string` | Y | - | 作者ID |
| `notes[].authorName` | `string` | Y | - | 作者名称 |
| `notes[].content` | `string` | Y | - | 内容 |
| `notes[].createdAt` | `string` | Y | - | 创建时间 |
| `evidenceFiles` | `array<ref:CaseEvidence>` | N | - | 凭证文件 |
| `evidenceFiles[]` | `ref:CaseEvidence` | N | - | 凭证文件 |
| `evidenceFiles[]` | `object` | N | - | 凭证文件 |
| `evidenceFiles[].id` | `string` | Y | - | ID |
| `evidenceFiles[].name` | `string` | Y | - | 名称 |
| `evidenceFiles[].url` | `string` | N | - | 链接 |
| `dueAt` | `string` | N | - | 到期时间 |
| `slaStatus` | `ref:CaseSlaStatus` | N | - | 服务时效状态 |
| `slaStatus` | `string` | N | ON_TIME/OVERDUE | 服务时效状态 |

### 5.53 `CaseSlaStatus`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.54 `CaseStatus`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.55 `CaseType`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.56 `CaseWithMilestones`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `caseId` | `ref:Uuid` | Y | - | 工单ID |
| `caseId` | `string` | Y | - | 工单ID |
| `orderId` | `ref:Uuid` | Y | - | 订单ID |
| `orderId` | `string` | Y | - | 订单ID |
| `type` | `ref:CaseType` | Y | - | 类型 |
| `type` | `string` | Y | FOLLOWUP/REFUND/DISPUTE | 类型 |
| `status` | `ref:CaseStatus` | Y | - | 状态 |
| `status` | `string` | Y | OPEN/IN_PROGRESS/CLOSED | 状态 |
| `csUserId` | `ref:Uuid` | N | - | 客服用户ID |
| `csUserId` | `string` | N | - | 客服用户ID |
| `milestones` | `array<ref:Milestone>` | Y | - | 里程碑 |
| `milestones[]` | `ref:Milestone` | N | - | 里程碑 |
| `milestones[]` | `object` | N | - | 里程碑 |
| `milestones[].name` | `ref:MilestoneName` | Y | - | 名称 |
| `milestones[].name` | `string` | Y | CONTRACT_SIGNED/TRANSFER_SUBMITTED/TRANSFER_COMPLETED | 名称 |
| `milestones[].status` | `ref:MilestoneStatus` | Y | - | 状态 |
| `milestones[].status` | `string` | Y | PENDING/DONE | 状态 |
| `milestones[].evidenceFileId` | `ref:Uuid` | N | - | 凭证文件ID |
| `milestones[].evidenceFileId` | `string` | N | - | 凭证文件ID |
| `milestones[].occurredAt` | `string` | N | - | 发生时间 |

### 5.57 `Comment`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `contentType` | `ref:CommentContentType` | Y | - | 内容类型 |
| `contentType` | `string` | Y | LISTING/ACHIEVEMENT | 内容类型 |
| `contentId` | `ref:Uuid` | Y | - | 内容ID |
| `contentId` | `string` | Y | - | 内容ID |
| `parentCommentId` | `ref:Uuid` | N | - | 父级评论ID |
| `parentCommentId` | `string` | N | - | 父级评论ID |
| `status` | `ref:CommentStatus` | N | - | 状态 |
| `status` | `string` | N | VISIBLE/HIDDEN/DELETED | 状态 |
| `user` | `ref:UserBrief` | Y | - | 用户 |
| `user` | `object` | Y | - | 用户 |
| `user.id` | `ref:Uuid` | Y | - | ID |
| `user.id` | `string` | Y | - | ID |
| `user.nickname` | `string` | N | - | 昵称 |
| `user.avatarUrl` | `string` | N | - | 头像链接 |
| `user.role` | `ref:UserRole` | N | - | 角色 |
| `user.role` | `string` | N | buyer/seller/cs/admin | 角色 |
| `user.verificationStatus` | `ref:VerificationStatus` | N | - | 认证状态 |
| `user.verificationStatus` | `string` | N | PENDING/APPROVED/REJECTED | 认证状态 |
| `user.verificationType` | `ref:VerificationType` | N | - | 认证类型 |
| `user.verificationType` | `string` | N | PERSON/COMPANY/ACADEMY/GOVERNMENT/ASSOCIATION/TECH_MANAGER | 认证类型 |
| `user.orgCategory` | `ref:SupplyType` | N | - | 机构分类 |
| `user.orgCategory` | `string` | N | UNIVERSITY/UNIVERSITY_985/UNIVERSITY_211/RESEARCH_INSTITUTE/OTHER | 机构分类 |
| `text` | `string` | Y | - | 文本 |
| `createdAt` | `string` | Y | - | 创建时间 |
| `updatedAt` | `string` | N | - | 更新时间 |

### 5.58 `CommentContentType`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.59 `CommentCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `text` | `string` | Y | - | 文本 |
| `parentCommentId` | `ref:Uuid` | N | - | 父级评论ID |
| `parentCommentId` | `string` | N | - | 父级评论ID |

### 5.60 `CommentStatus`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.61 `CommentThread`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `root` | `ref:Comment` | Y | - | 根 |
| `root` | `object` | Y | - | 根 |
| `root.id` | `ref:Uuid` | Y | - | ID |
| `root.id` | `string` | Y | - | ID |
| `root.contentType` | `ref:CommentContentType` | Y | - | 内容类型 |
| `root.contentType` | `string` | Y | LISTING/ACHIEVEMENT | 内容类型 |
| `root.contentId` | `ref:Uuid` | Y | - | 内容ID |
| `root.contentId` | `string` | Y | - | 内容ID |
| `root.parentCommentId` | `ref:Uuid` | N | - | 父级评论ID |
| `root.parentCommentId` | `string` | N | - | 父级评论ID |
| `root.status` | `ref:CommentStatus` | N | - | 状态 |
| `root.status` | `string` | N | VISIBLE/HIDDEN/DELETED | 状态 |
| `root.user` | `ref:UserBrief` | Y | - | 用户 |
| `root.user` | `object` | Y | - | 用户 |
| `root.user.id` | `ref:Uuid` | Y | - | ID |
| `root.user.id` | `string` | Y | - | ID |
| `root.user.nickname` | `string` | N | - | 昵称 |
| `root.user.avatarUrl` | `string` | N | - | 头像链接 |
| `root.user.role` | `ref:UserRole` | N | - | 角色 |
| `root.user.role` | `string` | N | buyer/seller/cs/admin | 角色 |
| `root.user.verificationStatus` | `ref:VerificationStatus` | N | - | 认证状态 |
| `root.user.verificationStatus` | `string` | N | PENDING/APPROVED/REJECTED | 认证状态 |
| `root.user.verificationType` | `ref:VerificationType` | N | - | 认证类型 |
| `root.user.verificationType` | `string` | N | PERSON/COMPANY/ACADEMY/GOVERNMENT/ASSOCIATION/TECH_MANAGER | 认证类型 |
| `root.user.orgCategory` | `ref:SupplyType` | N | - | 机构分类 |
| `root.user.orgCategory` | `string` | N | UNIVERSITY/UNIVERSITY_985/UNIVERSITY_211/RESEARCH_INSTITUTE/OTHER | 机构分类 |
| `root.text` | `string` | Y | - | 文本 |
| `root.createdAt` | `string` | Y | - | 创建时间 |
| `root.updatedAt` | `string` | N | - | 更新时间 |
| `replies` | `array<ref:Comment>` | Y | - | 回复 |
| `replies[]` | `ref:Comment` | N | - | 回复 |
| `replies[]` | `object` | N | - | 回复 |
| `replies[].id` | `ref:Uuid` | Y | - | ID |
| `replies[].id` | `string` | Y | - | ID |
| `replies[].contentType` | `ref:CommentContentType` | Y | - | 内容类型 |
| `replies[].contentType` | `string` | Y | LISTING/ACHIEVEMENT | 内容类型 |
| `replies[].contentId` | `ref:Uuid` | Y | - | 内容ID |
| `replies[].contentId` | `string` | Y | - | 内容ID |
| `replies[].parentCommentId` | `ref:Uuid` | N | - | 父级评论ID |
| `replies[].parentCommentId` | `string` | N | - | 父级评论ID |
| `replies[].status` | `ref:CommentStatus` | N | - | 状态 |
| `replies[].status` | `string` | N | VISIBLE/HIDDEN/DELETED | 状态 |
| `replies[].user` | `ref:UserBrief` | Y | - | 用户 |
| `replies[].user` | `object` | Y | - | 用户 |
| `replies[].user.id` | `ref:Uuid` | Y | - | ID |
| `replies[].user.id` | `string` | Y | - | ID |
| `replies[].user.nickname` | `string` | N | - | 昵称 |
| `replies[].user.avatarUrl` | `string` | N | - | 头像链接 |
| `replies[].user.role` | `ref:UserRole` | N | - | 角色 |
| `replies[].user.role` | `string` | N | buyer/seller/cs/admin | 角色 |
| `replies[].user.verificationStatus` | `ref:VerificationStatus` | N | - | 认证状态 |
| `replies[].user.verificationStatus` | `string` | N | PENDING/APPROVED/REJECTED | 认证状态 |
| `replies[].user.verificationType` | `ref:VerificationType` | N | - | 认证类型 |
| `replies[].user.verificationType` | `string` | N | PERSON/COMPANY/ACADEMY/GOVERNMENT/ASSOCIATION/TECH_MANAGER | 认证类型 |
| `replies[].user.orgCategory` | `ref:SupplyType` | N | - | 机构分类 |
| `replies[].user.orgCategory` | `string` | N | UNIVERSITY/UNIVERSITY_985/UNIVERSITY_211/RESEARCH_INSTITUTE/OTHER | 机构分类 |
| `replies[].text` | `string` | Y | - | 文本 |
| `replies[].createdAt` | `string` | Y | - | 创建时间 |
| `replies[].updatedAt` | `string` | N | - | 更新时间 |

### 5.62 `CommentUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `text` | `string` | Y | - | 文本 |

### 5.63 `ConsultationRouting`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.64 `ContentMedia`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `fileId` | `ref:Uuid` | Y | - | 文件ID |
| `fileId` | `string` | Y | - | 文件ID |
| `type` | `ref:ContentMediaType` | Y | - | 类型 |
| `type` | `string` | Y | IMAGE/VIDEO/FILE | 类型 |
| `sort` | `integer` | Y | - | 排序 |
| `url` | `string` | N | - | 链接 |
| `mimeType` | `string` | N | - | 媒体类型 |
| `sizeBytes` | `integer` | N | - | 大小字节 |
| `fileName` | `string` | N | - | 文件名称 |

### 5.65 `ContentMediaInput`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `fileId` | `ref:Uuid` | Y | - | 文件ID |
| `fileId` | `string` | Y | - | 文件ID |
| `type` | `ref:ContentMediaType` | Y | - | 类型 |
| `type` | `string` | Y | IMAGE/VIDEO/FILE | 类型 |
| `sort` | `integer` | N | - | 排序 |

### 5.66 `ContentMediaType`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.67 `ContentSource`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.68 `ContentStatus`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.69 `ContractItem`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `string` | Y | - | ID |
| `orderId` | `ref:Uuid` | Y | - | 订单ID |
| `orderId` | `string` | Y | - | 订单ID |
| `listingTitle` | `string` | N | - | 挂牌标题 |
| `counterpartName` | `string` | N | - | 对方名称 |
| `status` | `ref:ContractStatus` | Y | - | 状态 |
| `status` | `string` | Y | WAIT_UPLOAD/WAIT_CONFIRM/AVAILABLE | 状态 |
| `createdAt` | `string` | Y | - | 创建时间 |
| `uploadedAt` | `string` | N | - | 上传时间 |
| `signedAt` | `string` | N | - | 签署时间 |
| `fileUrl` | `string` | N | - | 文件链接 |
| `watermarkOwner` | `string` | N | - | 水印所有者 |
| `canUpload` | `boolean` | N | - | 可上传 |

### 5.70 `ContractStatus`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.71 `ContractUploadRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.72 `Conversation`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `contentType` | `ref:ConversationContentType` | Y | - | 内容类型 |
| `contentType` | `string` | Y | LISTING/ACHIEVEMENT/TECH_MANAGER/SUPPORT/DISPUTE/MAINTENANCE | 内容类型 |
| `contentId` | `ref:Uuid` | Y | - | 内容ID |
| `contentId` | `string` | Y | - | 内容ID |
| `contentTitle` | `string` | N | - | 内容标题 |
| `listingId` | `ref:Uuid` | N | - | 挂牌ID |
| `listingId` | `string` | N | - | 挂牌ID |
| `listingTitle` | `string` | N | - | 挂牌标题 |
| `orderId` | `ref:Uuid` | N | - | 订单ID |
| `orderId` | `string` | N | - | 订单ID |
| `buyerUserId` | `ref:Uuid` | Y | - | 买方用户ID |
| `buyerUserId` | `string` | Y | - | 买方用户ID |
| `sellerUserId` | `ref:Uuid` | Y | - | 卖方用户ID |
| `sellerUserId` | `string` | Y | - | 卖方用户ID |
| `lastMessageAt` | `string` | N | - | 最近消息时间 |
| `createdAt` | `string` | Y | - | 创建时间 |
| `updatedAt` | `string` | Y | - | 更新时间 |

### 5.73 `ConversationAgentAssignment`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `conversationId` | `ref:Uuid` | Y | - | 会话ID |
| `conversationId` | `string` | Y | - | 会话ID |
| `userId` | `ref:Uuid` | Y | - | 用户ID |
| `userId` | `string` | Y | - | 用户ID |
| `active` | `boolean` | Y | - | 有效 |
| `assignedAt` | `string` | Y | - | 已分配时间 |

### 5.74 `ConversationAgentAssignmentRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `userId` | `ref:Uuid` | N | - | 用户ID |
| `userId` | `string` | N | - | 用户ID |

### 5.75 `ConversationContentType`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.76 `ConversationMessage`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `conversationId` | `ref:Uuid` | Y | - | 会话ID |
| `conversationId` | `string` | Y | - | 会话ID |
| `senderUserId` | `ref:Uuid` | Y | - | 发送方用户ID |
| `senderUserId` | `string` | Y | - | 发送方用户ID |
| `type` | `ref:ConversationMessageType` | Y | - | 类型 |
| `type` | `string` | Y | TEXT/EMOJI/SYSTEM | 类型 |
| `text` | `string` | N | - | 文本 |
| `fileId` | `ref:Uuid` | N | - | 文件ID |
| `fileId` | `string` | N | - | 文件ID |
| `fileUrl` | `string` | N | - | 文件链接 |
| `createdAt` | `string` | Y | - | 创建时间 |

### 5.77 `ConversationMessageSendRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `type` | `ref:ConversationMessageType` | Y | - | 类型 |
| `type` | `string` | Y | TEXT/EMOJI/SYSTEM | 类型 |
| `text` | `string` | Y | - | 文本 |

### 5.78 `ConversationMessageType`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.79 `ConversationSummary`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `contentType` | `ref:ConversationContentType` | Y | - | 内容类型 |
| `contentType` | `string` | Y | LISTING/ACHIEVEMENT/TECH_MANAGER/SUPPORT/DISPUTE/MAINTENANCE | 内容类型 |
| `contentId` | `ref:Uuid` | Y | - | 内容ID |
| `contentId` | `string` | Y | - | 内容ID |
| `contentTitle` | `string` | Y | - | 内容标题 |
| `listingId` | `ref:Uuid` | N | - | 挂牌ID |
| `listingId` | `string` | N | - | 挂牌ID |
| `listingTitle` | `string` | N | - | 挂牌标题 |
| `listingTopics` | `array<ref:ListingTopic>` | N | - | 挂牌主题 |
| `listingTopics[]` | `ref:ListingTopic` | N | - | 挂牌主题 |
| `listingTopics[]` | `string` | N | HIGH_TECH_RETIRED/SLEEPING/AWARD_WINNING/FIVE_STAR/OPEN_LICENSE | 挂牌主题 |
| `lastMessagePreview` | `string` | N | - | 最近消息预览 |
| `lastMessageAt` | `string` | Y | - | 最近消息时间 |
| `unreadCount` | `integer` | Y | - | 未读数量 |
| `counterpart` | `ref:UserBrief` | Y | - | 对方 |
| `counterpart` | `object` | Y | - | 对方 |
| `counterpart.id` | `ref:Uuid` | Y | - | ID |
| `counterpart.id` | `string` | Y | - | ID |
| `counterpart.nickname` | `string` | N | - | 昵称 |
| `counterpart.avatarUrl` | `string` | N | - | 头像链接 |
| `counterpart.role` | `ref:UserRole` | N | - | 角色 |
| `counterpart.role` | `string` | N | buyer/seller/cs/admin | 角色 |
| `counterpart.verificationStatus` | `ref:VerificationStatus` | N | - | 认证状态 |
| `counterpart.verificationStatus` | `string` | N | PENDING/APPROVED/REJECTED | 认证状态 |
| `counterpart.verificationType` | `ref:VerificationType` | N | - | 认证类型 |
| `counterpart.verificationType` | `string` | N | PERSON/COMPANY/ACADEMY/GOVERNMENT/ASSOCIATION/TECH_MANAGER | 认证类型 |
| `counterpart.orgCategory` | `ref:SupplyType` | N | - | 机构分类 |
| `counterpart.orgCategory` | `string` | N | UNIVERSITY/UNIVERSITY_985/UNIVERSITY_211/RESEARCH_INSTITUTE/OTHER | 机构分类 |
| `assignedAgentUserIds` | `array<ref:Uuid>` | N | - | 已分配坐席用户ID |
| `assignedAgentUserIds[]` | `ref:Uuid` | N | - | 已分配坐席用户ID |
| `assignedAgentUserIds[]` | `string` | N | - | 已分配坐席用户ID |

### 5.80 `CooperationMode`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.81 `CustomerServiceAssignStrategy`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.82 `CustomerServiceConfig`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `phone` | `string` | Y | - | 手机号 |
| `defaultReply` | `string` | Y | - | 默认回复 |

### 5.83 `CustomerServiceConfigUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `phone` | `string` | Y | - | 手机号 |
| `defaultReply` | `string` | Y | - | 默认回复 |
| `assignStrategy` | `ref:CustomerServiceAssignStrategy` | Y | - | 分配策略 |
| `assignStrategy` | `string` | Y | AUTO/MANUAL | 分配策略 |

### 5.84 `ErrorResponse`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `code` | `string` | Y | - | 编码 |
| `message` | `string` | Y | - | 消息 |
| `details` | `object` | N | - | 详情 |

### 5.85 `ExistingLicenseStatus`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.86 `FeaturedLevel`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.87 `FileObject`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `url` | `string` | Y | - | 链接 |
| `fileName` | `string` | N | - | 文件名称 |
| `mimeType` | `string` | Y | - | 媒体类型 |
| `sizeBytes` | `integer` | Y | - | 大小字节 |
| `createdAt` | `string` | Y | - | 创建时间 |

### 5.88 `FilePurpose`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.89 `FileTemporaryAccessRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `scope` | `ref:FileTemporaryAccessScope` | N | - | 范围 |
| `scope` | `string` | N | download/preview | 范围 |
| `expiresInSeconds` | `integer` | N | - | 过期内秒 |
| `ttlSeconds` | `integer` | N | - | 存活期秒 |

### 5.90 `FileTemporaryAccessResponse`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `url` | `string` | Y | - | 链接 |
| `expiresAt` | `string` | Y | - | 过期时间 |
| `scope` | `ref:FileTemporaryAccessScope` | Y | - | 范围 |
| `scope` | `string` | Y | download/preview | 范围 |

### 5.91 `FileTemporaryAccessScope`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.92 `FinanceReportExportResponse`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `exportUrl` | `string` | Y | - | 导出链接 |

### 5.93 `FinanceReportRange`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `start` | `string` | Y | - | 开始 |
| `end` | `string` | Y | - | 结束 |

### 5.94 `FinanceReportSummary`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `range` | `ref:FinanceReportRange` | Y | - | 范围 |
| `range` | `object` | Y | - | 范围 |
| `range.start` | `string` | Y | - | 开始 |
| `range.end` | `string` | Y | - | 结束 |
| `dealAmountFen` | `ref:MoneyFen` | Y | - | 成交金额分 |
| `dealAmountFen` | `integer` | Y | - | 成交金额分 |
| `commissionAmountFen` | `ref:MoneyFen` | Y | - | 佣金金额分 |
| `commissionAmountFen` | `integer` | Y | - | 佣金金额分 |
| `refundRate` | `number` | Y | - | 退款费率 |
| `payoutSuccessRate` | `number` | Y | - | 放款成功费率 |
| `ordersTotal` | `integer` | Y | - | 订单总 |

### 5.95 `HomeAnnouncementConfig`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `schemaVersion` | `integer` | Y | - | 结构版本 |
| `templates` | `array<ref:HomeAnnouncementTemplate>` | Y | - | 模板 |
| `templates[]` | `ref:HomeAnnouncementTemplate` | N | - | 模板 |
| `templates[]` | `object` | N | - | 模板 |
| `templates[].id` | `string` | Y | - | ID |
| `templates[].name` | `string` | Y | - | 名称 |
| `templates[].title` | `string` | Y | - | 标题 |
| `templates[].content` | `string` | Y | - | 内容 |
| `templates[].tag` | `string` | N | - | 标签 |
| `templates[].linkUrl` | `string` | N | - | 链接链接 |
| `templates[].enabled` | `boolean` | Y | - | 启用 |
| `templates[].createdAt` | `string` | Y | - | 创建时间 |
| `templates[].updatedAt` | `string` | Y | - | 更新时间 |
| `items` | `array<ref:HomeAnnouncementItem>` | Y | - | 条目 |
| `items[]` | `ref:HomeAnnouncementItem` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `string` | Y | - | ID |
| `items[].templateId` | `string` | N | - | 模板ID |
| `items[].title` | `string` | Y | - | 标题 |
| `items[].content` | `string` | Y | - | 内容 |
| `items[].tag` | `string` | N | - | 标签 |
| `items[].linkUrl` | `string` | N | - | 链接链接 |
| `items[].pinned` | `boolean` | Y | - | 置顶 |
| `items[].order` | `integer` | Y | - | 订单 |
| `items[].status` | `ref:HomeAnnouncementStatus` | Y | - | 状态 |
| `items[].status` | `string` | Y | DRAFT/PUBLISHED/OFFLINE | 状态 |
| `items[].startAt` | `string` | N | - | 开始时间 |
| `items[].endAt` | `string` | N | - | 结束时间 |
| `items[].publishedAt` | `string` | N | - | 已发布时间 |
| `items[].createdAt` | `string` | Y | - | 创建时间 |
| `items[].updatedAt` | `string` | Y | - | 更新时间 |

### 5.96 `HomeAnnouncementItem`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `string` | Y | - | ID |
| `templateId` | `string` | N | - | 模板ID |
| `title` | `string` | Y | - | 标题 |
| `content` | `string` | Y | - | 内容 |
| `tag` | `string` | N | - | 标签 |
| `linkUrl` | `string` | N | - | 链接链接 |
| `pinned` | `boolean` | Y | - | 置顶 |
| `order` | `integer` | Y | - | 订单 |
| `status` | `ref:HomeAnnouncementStatus` | Y | - | 状态 |
| `status` | `string` | Y | DRAFT/PUBLISHED/OFFLINE | 状态 |
| `startAt` | `string` | N | - | 开始时间 |
| `endAt` | `string` | N | - | 结束时间 |
| `publishedAt` | `string` | N | - | 已发布时间 |
| `createdAt` | `string` | Y | - | 创建时间 |
| `updatedAt` | `string` | Y | - | 更新时间 |

### 5.97 `HomeAnnouncementItemCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `templateId` | `string` | N | - | 模板ID |
| `title` | `string` | N | - | 标题 |
| `content` | `string` | N | - | 内容 |
| `tag` | `string` | N | - | 标签 |
| `linkUrl` | `string` | N | - | 链接链接 |
| `pinned` | `boolean` | N | - | 置顶 |
| `order` | `integer` | N | - | 订单 |
| `startAt` | `string` | N | - | 开始时间 |
| `endAt` | `string` | N | - | 结束时间 |
| `status` | `ref:HomeAnnouncementStatus` | N | - | 状态 |
| `status` | `string` | N | DRAFT/PUBLISHED/OFFLINE | 状态 |

### 5.98 `HomeAnnouncementItemDeleteResult`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `ok` | `boolean` | Y | - | 成功 |
| `deletedItemId` | `string` | Y | - | 已删除条目ID |

### 5.99 `HomeAnnouncementItemUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `templateId` | `string` | N | - | 模板ID |
| `title` | `string` | N | - | 标题 |
| `content` | `string` | N | - | 内容 |
| `tag` | `string` | N | - | 标签 |
| `linkUrl` | `string` | N | - | 链接链接 |
| `pinned` | `boolean` | N | - | 置顶 |
| `order` | `integer` | N | - | 订单 |
| `startAt` | `string` | N | - | 开始时间 |
| `endAt` | `string` | N | - | 结束时间 |
| `status` | `ref:HomeAnnouncementStatus` | N | - | 状态 |
| `status` | `string` | N | DRAFT/PUBLISHED/OFFLINE | 状态 |

### 5.100 `HomeAnnouncementStatus`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.101 `HomeAnnouncementTemplate`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `string` | Y | - | ID |
| `name` | `string` | Y | - | 名称 |
| `title` | `string` | Y | - | 标题 |
| `content` | `string` | Y | - | 内容 |
| `tag` | `string` | N | - | 标签 |
| `linkUrl` | `string` | N | - | 链接链接 |
| `enabled` | `boolean` | Y | - | 启用 |
| `createdAt` | `string` | Y | - | 创建时间 |
| `updatedAt` | `string` | Y | - | 更新时间 |

### 5.102 `HomeAnnouncementTemplateCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `name` | `string` | Y | - | 名称 |
| `title` | `string` | Y | - | 标题 |
| `content` | `string` | Y | - | 内容 |
| `tag` | `string` | N | - | 标签 |
| `linkUrl` | `string` | N | - | 链接链接 |
| `enabled` | `boolean` | N | - | 启用 |

### 5.103 `HomeAnnouncementTemplateDeleteResult`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `ok` | `boolean` | Y | - | 成功 |
| `deletedTemplateId` | `string` | Y | - | 已删除模板ID |

### 5.104 `HomeAnnouncementTemplateUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `name` | `string` | N | - | 名称 |
| `title` | `string` | N | - | 标题 |
| `content` | `string` | N | - | 内容 |
| `tag` | `string` | N | - | 标签 |
| `linkUrl` | `string` | N | - | 链接链接 |
| `enabled` | `boolean` | N | - | 启用 |

### 5.105 `HotSearchConfig`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `keywords` | `array<string>` | Y | - | 关键词 |
| `keywords[]` | `string` | N | - | 关键词 |

### 5.106 `IndustryTag`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `name` | `string` | Y | - | 名称 |
| `createdAt` | `string` | N | - | 创建时间 |
| `updatedAt` | `string` | N | - | 更新时间 |

### 5.107 `IndustryTagCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `name` | `string` | Y | - | 名称 |

### 5.108 `InventorRankingItem`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `inventorName` | `string` | Y | - | 发明人名称 |
| `patentCount` | `integer` | Y | - | 专利数量 |
| `listingCount` | `integer` | Y | - | 挂牌数量 |
| `avatarUrl` | `string` | N | - | 头像链接 |

### 5.109 `InvoiceItem`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `listingId` | `ref:Uuid` | N | - | 挂牌ID |
| `listingId` | `string` | N | - | 挂牌ID |
| `patentId` | `ref:Uuid` | N | - | 专利ID |
| `patentId` | `string` | N | - | 专利ID |
| `buyerUserId` | `ref:Uuid` | Y | - | 买方用户ID |
| `buyerUserId` | `string` | Y | - | 买方用户ID |
| `sellerUserId` | `ref:Uuid` | N | - | 卖方用户ID |
| `sellerUserId` | `string` | N | - | 卖方用户ID |
| `assignedCsUserId` | `ref:Uuid` | N | - | 已分配客服用户ID |
| `assignedCsUserId` | `string` | N | - | 已分配客服用户ID |
| `status` | `ref:OrderStatus` | Y | - | 状态 |
| `status` | `string` | Y | DEPOSIT_PENDING/DEPOSIT_PAID/WAIT_FINAL_PAYMENT/FINAL_PAID_ESCROW/READY_TO_SETTLE/COMPLETED/CANCELLED/REFUNDING/REFUNDED | 状态 |
| `dealAmountFen` | `ref:MoneyFen` | N | - | 成交金额分 |
| `dealAmountFen` | `integer` | N | - | 成交金额分 |
| `depositAmountFen` | `ref:MoneyFen` | Y | - | 订金金额分 |
| `depositAmountFen` | `integer` | Y | - | 订金金额分 |
| `finalAmountFen` | `ref:MoneyFen` | N | - | 尾款金额分 |
| `finalAmountFen` | `integer` | N | - | 尾款金额分 |
| `commissionAmountFen` | `ref:MoneyFen` | N | - | 佣金金额分 |
| `commissionAmountFen` | `integer` | N | - | 佣金金额分 |
| `invoice` | `ref:OrderInvoice` | N | - | 发票 |
| `invoice` | `object` | N | - | 发票 |
| `invoice.orderId` | `ref:Uuid` | Y | - | 订单ID |
| `invoice.orderId` | `string` | Y | - | 订单ID |
| `invoice.amountFen` | `ref:MoneyFen` | N | - | 金额分 |
| `invoice.amountFen` | `integer` | N | - | 金额分 |
| `invoice.itemName` | `string` | N | - | 条目名称 |
| `invoice.invoiceNo` | `string` | N | - | 发票编号 |
| `invoice.issuedAt` | `string` | N | - | 发放时间 |
| `invoice.invoiceFile` | `ref:FileObject` | Y | - | 发票文件 |
| `invoice.invoiceFile` | `object` | Y | - | 发票文件 |
| `invoice.invoiceFile.id` | `ref:Uuid` | Y | - | ID |
| `invoice.invoiceFile.id` | `string` | Y | - | ID |
| `invoice.invoiceFile.url` | `string` | Y | - | 链接 |
| `invoice.invoiceFile.fileName` | `string` | N | - | 文件名称 |
| `invoice.invoiceFile.mimeType` | `string` | Y | - | 媒体类型 |
| `invoice.invoiceFile.sizeBytes` | `integer` | Y | - | 大小字节 |
| `invoice.invoiceFile.createdAt` | `string` | Y | - | 创建时间 |
| `invoice.attachedAt` | `string` | N | - | 附加时间 |
| `invoice.updatedAt` | `string` | N | - | 更新时间 |
| `createdAt` | `string` | Y | - | 创建时间 |
| `updatedAt` | `string` | N | - | 更新时间 |
| `invoiceStatus` | `ref:InvoiceStatus` | Y | - | 发票状态 |
| `invoiceStatus` | `string` | Y | WAIT_APPLY/APPLYING/ISSUED | 发票状态 |
| `amountFen` | `ref:MoneyFen` | N | - | 金额分 |
| `amountFen` | `integer` | N | - | 金额分 |
| `itemName` | `string` | N | - | 条目名称 |
| `invoiceNo` | `string` | N | - | 发票编号 |
| `issuedAt` | `string` | N | - | 发放时间 |
| `invoiceFileUrl` | `string` | N | - | 发票文件链接 |
| `requestedAt` | `string` | N | - | 请求时间 |

### 5.110 `InvoiceRequestResult`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `orderId` | `ref:Uuid` | Y | - | 订单ID |
| `orderId` | `string` | Y | - | 订单ID |
| `status` | `ref:InvoiceStatus` | Y | - | 状态 |
| `status` | `string` | Y | WAIT_APPLY/APPLYING/ISSUED | 状态 |

### 5.111 `InvoiceStatus`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.112 `Jurisdiction`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.113 `LegalStatus`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.114 `LicenseMode`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.115 `Listing`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `patentId` | `ref:Uuid` | N | - | 专利ID |
| `patentId` | `string` | N | - | 专利ID |
| `source` | `ref:ContentSource` | N | - | 来源 |
| `source` | `string` | N | USER/PLATFORM/ADMIN | 来源 |
| `applicationNoDisplay` | `string` | N | - | 申请编号显示 |
| `publicationNoDisplay` | `string` | N | - | 公开编号显示 |
| `patentNoDisplay` | `string` | N | - | 专利编号显示 |
| `grantPublicationNoDisplay` | `string` | N | - | 授权公开编号显示 |
| `patentType` | `ref:PatentType` | N | - | 专利类型 |
| `patentType` | `string` | N | INVENTION/UTILITY_MODEL/DESIGN | 专利类型 |
| `patentTypeDefinition` | `string` | N | - | 专利类型定义 |
| `patentTypeDefinitionSource` | `string` | N | - | 专利类型定义来源 |
| `patentTermYears` | `integer` | N | - | 专利期限年 |
| `title` | `string` | Y | - | 标题 |
| `inventorNames` | `array<string>` | N | - | 发明人名称 |
| `inventorNames[]` | `string` | N | - | 发明人名称 |
| `assigneeNames` | `array<string>` | N | - | 受让方名称 |
| `assigneeNames[]` | `string` | N | - | 受让方名称 |
| `applicantNames` | `array<string>` | N | - | 申请人名称 |
| `applicantNames[]` | `string` | N | - | 申请人名称 |
| `filingDate` | `string` | N | - | 申请日期 |
| `publicationDate` | `string` | N | - | 公开日期 |
| `grantDate` | `string` | N | - | 授权日期 |
| `legalStatus` | `ref:LegalStatus` | N | - | 法律状态 |
| `legalStatus` | `string` | N | PENDING/GRANTED/EXPIRED/INVALIDATED/UNKNOWN | 法律状态 |
| `tradeMode` | `ref:TradeMode` | Y | - | 交易模式 |
| `tradeMode` | `string` | Y | ASSIGNMENT/LICENSE | 交易模式 |
| `licenseMode` | `ref:LicenseMode` | N | - | 许可模式 |
| `licenseMode` | `string` | N | EXCLUSIVE/SOLE/NON_EXCLUSIVE | 许可模式 |
| `priceType` | `ref:PriceType` | Y | - | 价格类型 |
| `priceType` | `string` | Y | FIXED/NEGOTIABLE | 价格类型 |
| `priceAmountFen` | `ref:MoneyFen` | N | - | 价格金额分 |
| `priceAmountFen` | `integer` | N | - | 价格金额分 |
| `depositAmountFen` | `ref:MoneyFen` | Y | - | 订金金额分 |
| `depositAmountFen` | `integer` | Y | - | 订金金额分 |
| `regionCode` | `string` | N | - | 地区编码 |
| `industryTags` | `array<string>` | N | - | 行业标签 |
| `industryTags[]` | `string` | N | - | 行业标签 |
| `listingTopics` | `array<ref:ListingTopic>` | N | - | 挂牌主题 |
| `listingTopics[]` | `ref:ListingTopic` | N | - | 挂牌主题 |
| `listingTopics[]` | `string` | N | HIGH_TECH_RETIRED/SLEEPING/AWARD_WINNING/FIVE_STAR/OPEN_LICENSE | 挂牌主题 |
| `consultationRouting` | `ref:ConsultationRouting` | N | - | 咨询路由 |
| `consultationRouting` | `string` | N | PLATFORM/OWNER | 咨询路由 |
| `featuredLevel` | `ref:FeaturedLevel` | N | - | 推荐级别 |
| `featuredLevel` | `string` | N | NONE/CITY/PROVINCE | 推荐级别 |
| `featuredRegionCode` | `string` | N | - | 推荐地区编码 |
| `featuredRank` | `integer` | N | - | 推荐排名 |
| `featuredUntil` | `string` | N | - | 推荐截止 |
| `stats` | `ref:ListingStats` | N | - | 统计 |
| `stats` | `object` | N | - | 统计 |
| `stats.viewCount` | `integer` | Y | - | 浏览数量 |
| `stats.favoriteCount` | `integer` | Y | - | 收藏数量 |
| `stats.consultCount` | `integer` | Y | - | 咨询数量 |
| `stats.commentCount` | `integer` | N | - | 评论数量 |
| `transferCount` | `integer` | N | - | 转让数量 |
| `recommendationScore` | `number` | N | - | 推荐分值 |
| `auditStatus` | `ref:AuditStatus` | Y | - | 审计状态 |
| `auditStatus` | `string` | Y | PENDING/APPROVED/REJECTED | 审计状态 |
| `status` | `ref:ListingStatus` | Y | - | 状态 |
| `status` | `string` | Y | DRAFT/ACTIVE/OFF_SHELF/SOLD | 状态 |
| `coverUrl` | `string` | N | - | 封面链接 |
| `createdAt` | `string` | Y | - | 创建时间 |
| `updatedAt` | `string` | Y | - | 更新时间 |
| `sellerUserId` | `ref:Uuid` | N | - | 卖方用户ID |
| `sellerUserId` | `string` | N | - | 卖方用户ID |
| `summary` | `string` | N | - | 摘要 |
| `deliverables` | `array<string>` | N | - | 交付物 |
| `deliverables[]` | `string` | N | - | 交付物 |
| `expectedCompletionDays` | `integer` | N | - | 预计完成天 |
| `negotiableRangeFen` | `ref:MoneyFen` | N | - | 可议价范围分 |
| `negotiableRangeFen` | `integer` | N | - | 可议价范围分 |
| `negotiableRangePercent` | `number` | N | - | 可议价范围百分比 |
| `negotiableNote` | `string` | N | - | 可议价备注 |
| `pledgeStatus` | `ref:PledgeStatus` | N | - | 质押状态 |
| `pledgeStatus` | `string` | N | NONE/PLEDGED/UNKNOWN | 质押状态 |
| `existingLicenseStatus` | `ref:ExistingLicenseStatus` | N | - | 既有许可状态 |
| `existingLicenseStatus` | `string` | N | NONE/EXCLUSIVE/SOLE/NON_EXCLUSIVE/UNKNOWN | 既有许可状态 |
| `encumbranceNote` | `string` | N | - | 权利负担备注 |
| `ipcCodes` | `array<string>` | N | - | IPC编码 |
| `ipcCodes[]` | `string` | N | - | IPC编码 |
| `locCodes` | `array<string>` | N | - | 位置编码 |
| `locCodes[]` | `string` | N | - | 位置编码 |
| `media` | `array<ref:ListingMedia>` | N | - | 媒体 |
| `media[]` | `ref:ListingMedia` | N | - | 媒体 |
| `media[]` | `object` | N | - | 媒体 |
| `media[].fileId` | `ref:Uuid` | Y | - | 文件ID |
| `media[].fileId` | `string` | Y | - | 文件ID |
| `media[].type` | `string` | Y | IMAGE/FILE | 类型 |
| `media[].sort` | `integer` | Y | - | 排序 |
| `aiParse` | `ref:AiParseResult` | N | - | 智能解析 |
| `aiParse` | `object` | N | - | 智能解析 |
| `aiParse.id` | `ref:Uuid` | Y | - | ID |
| `aiParse.id` | `string` | Y | - | ID |
| `aiParse.contentType` | `ref:AiContentType` | Y | - | 内容类型 |
| `aiParse.contentType` | `string` | Y | LISTING | 内容类型 |
| `aiParse.contentId` | `ref:Uuid` | Y | - | 内容ID |
| `aiParse.contentId` | `string` | Y | - | 内容ID |
| `aiParse.summaryPlain` | `string` | N | - | 摘要纯文本 |
| `aiParse.featuresPlain` | `string` | N | - | 特征纯文本 |
| `aiParse.keywords` | `array<string>` | N | - | 关键词 |
| `aiParse.keywords[]` | `string` | N | - | 关键词 |
| `aiParse.confidence` | `number` | Y | - | 置信度 |
| `aiParse.modelVersion` | `string` | N | - | 模型版本 |
| `aiParse.status` | `ref:AiParseStatus` | Y | - | 状态 |
| `aiParse.status` | `string` | Y | ACTIVE/REVIEW_REQUIRED/REPLACED | 状态 |
| `aiParse.createdAt` | `string` | Y | - | 创建时间 |
| `aiParse.updatedAt` | `string` | N | - | 更新时间 |
| `proofFileIds` | `array<ref:Uuid>` | N | - | 凭证文件ID |
| `proofFileIds[]` | `ref:Uuid` | N | - | 凭证文件ID |
| `proofFileIds[]` | `string` | N | - | 凭证文件ID |

### 5.116 `ListingBatchAction`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.117 `ListingBatchItemStatus`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.118 `ListingBatchJob`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `operatorUserId` | `ref:Uuid` | Y | - | 操作人用户ID |
| `operatorUserId` | `string` | Y | - | 操作人用户ID |
| `action` | `ref:ListingBatchAction` | Y | - | 操作 |
| `action` | `string` | Y | APPROVE/REJECT/PUBLISH/OFF_SHELF | 操作 |
| `reason` | `string` | N | - | 原因 |
| `status` | `ref:ListingJobStatus` | Y | - | 状态 |
| `status` | `string` | Y | PENDING/RUNNING/PAUSED/SUCCEEDED/FAILED | 状态 |
| `totalCount` | `integer` | Y | - | 总数量 |
| `successCount` | `integer` | Y | - | 成功数量 |
| `failedCount` | `integer` | Y | - | 失败数量 |
| `skippedCount` | `integer` | Y | - | 跳过数量 |
| `failRate` | `number` | Y | - | 失败费率 |
| `startedAt` | `string` | N | - | 开始时间 |
| `finishedAt` | `string` | N | - | 完成时间 |
| `pausedAt` | `string` | N | - | 暂停时间 |
| `errorFileId` | `ref:Uuid` | N | - | 错误文件ID |
| `errorFileId` | `string` | N | - | 错误文件ID |
| `createdAt` | `string` | Y | - | 创建时间 |
| `updatedAt` | `string` | Y | - | 更新时间 |

### 5.119 `ListingBatchJobCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `action` | `ref:ListingBatchAction` | Y | - | 操作 |
| `action` | `string` | Y | APPROVE/REJECT/PUBLISH/OFF_SHELF | 操作 |
| `listingIds` | `array<ref:Uuid>` | Y | - | 挂牌ID |
| `listingIds[]` | `ref:Uuid` | N | - | 挂牌ID |
| `listingIds[]` | `string` | N | - | 挂牌ID |
| `reason` | `string` | N | - | 原因 |

### 5.120 `ListingBatchJobItem`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `jobId` | `ref:Uuid` | Y | - | 任务ID |
| `jobId` | `string` | Y | - | 任务ID |
| `listingId` | `ref:Uuid` | Y | - | 挂牌ID |
| `listingId` | `string` | Y | - | 挂牌ID |
| `status` | `ref:ListingBatchItemStatus` | Y | - | 状态 |
| `status` | `string` | Y | PENDING/SUCCEEDED/FAILED/SKIPPED | 状态 |
| `errorCode` | `string` | N | - | 错误编码 |
| `errorMessage` | `string` | N | - | 错误消息 |
| `processedAt` | `string` | N | - | 处理时间 |
| `createdAt` | `string` | Y | - | 创建时间 |
| `updatedAt` | `string` | Y | - | 更新时间 |

### 5.121 `ListingConsultationCreated`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `ok` | `boolean` | Y | - | 成功 |
| `conversationId` | `ref:Uuid` | Y | - | 会话ID |
| `conversationId` | `string` | Y | - | 会话ID |

### 5.122 `ListingCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `patentNumberRaw` | `string` | N | - | 专利编号原始 |
| `patentType` | `ref:PatentType` | N | - | 专利类型 |
| `patentType` | `string` | N | INVENTION/UTILITY_MODEL/DESIGN | 专利类型 |
| `title` | `string` | N | - | 标题 |
| `inventorNames` | `array<string>` | N | - | 发明人名称 |
| `inventorNames[]` | `string` | N | - | 发明人名称 |
| `assigneeNames` | `array<string>` | N | - | 受让方名称 |
| `assigneeNames[]` | `string` | N | - | 受让方名称 |
| `applicantNames` | `array<string>` | N | - | 申请人名称 |
| `applicantNames[]` | `string` | N | - | 申请人名称 |
| `legalStatus` | `ref:LegalStatus` | N | - | 法律状态 |
| `legalStatus` | `string` | N | PENDING/GRANTED/EXPIRED/INVALIDATED/UNKNOWN | 法律状态 |
| `legalStatusRaw` | `string` | N | - | 法律状态原始 |
| `filingDate` | `string` | N | - | 申请日期 |
| `publicationDate` | `string` | N | - | 公开日期 |
| `grantDate` | `string` | N | - | 授权日期 |
| `transferCount` | `integer` | N | - | 转让数量 |
| `summary` | `string` | N | - | 摘要 |
| `deliverables` | `array<string>` | N | - | 交付物 |
| `deliverables[]` | `string` | N | - | 交付物 |
| `expectedCompletionDays` | `integer` | N | - | 预计完成天 |
| `negotiableRangeFen` | `ref:MoneyFen` | N | - | 可议价范围分 |
| `negotiableRangeFen` | `integer` | N | - | 可议价范围分 |
| `negotiableRangePercent` | `number` | N | - | 可议价范围百分比 |
| `negotiableNote` | `string` | N | - | 可议价备注 |
| `pledgeStatus` | `ref:PledgeStatus` | N | - | 质押状态 |
| `pledgeStatus` | `string` | N | NONE/PLEDGED/UNKNOWN | 质押状态 |
| `existingLicenseStatus` | `ref:ExistingLicenseStatus` | N | - | 既有许可状态 |
| `existingLicenseStatus` | `string` | N | NONE/EXCLUSIVE/SOLE/NON_EXCLUSIVE/UNKNOWN | 既有许可状态 |
| `encumbranceNote` | `string` | N | - | 权利负担备注 |
| `tradeMode` | `ref:TradeMode` | Y | - | 交易模式 |
| `tradeMode` | `string` | Y | ASSIGNMENT/LICENSE | 交易模式 |
| `licenseMode` | `ref:LicenseMode` | N | - | 许可模式 |
| `licenseMode` | `string` | N | EXCLUSIVE/SOLE/NON_EXCLUSIVE | 许可模式 |
| `priceType` | `ref:PriceType` | Y | - | 价格类型 |
| `priceType` | `string` | Y | FIXED/NEGOTIABLE | 价格类型 |
| `priceAmountFen` | `ref:MoneyFen` | N | - | 价格金额分 |
| `priceAmountFen` | `integer` | N | - | 价格金额分 |
| `depositAmountFen` | `ref:MoneyFen` | N | - | 订金金额分 |
| `depositAmountFen` | `integer` | N | - | 订金金额分 |
| `regionCode` | `string` | N | - | 地区编码 |
| `industryTags` | `array<string>` | N | - | 行业标签 |
| `industryTags[]` | `string` | N | - | 行业标签 |
| `listingTopics` | `array<ref:ListingTopic>` | N | - | 挂牌主题 |
| `listingTopics[]` | `ref:ListingTopic` | N | - | 挂牌主题 |
| `listingTopics[]` | `string` | N | HIGH_TECH_RETIRED/SLEEPING/AWARD_WINNING/FIVE_STAR/OPEN_LICENSE | 挂牌主题 |
| `consultationRouting` | `ref:ConsultationRouting` | N | - | 咨询路由 |
| `consultationRouting` | `string` | N | PLATFORM/OWNER | 咨询路由 |
| `ipcCodes` | `array<string>` | N | - | IPC编码 |
| `ipcCodes[]` | `string` | N | - | IPC编码 |
| `locCodes` | `array<string>` | N | - | 位置编码 |
| `locCodes[]` | `string` | N | - | 位置编码 |
| `media` | `array<ref:ListingMedia>` | N | - | 媒体 |
| `media[]` | `ref:ListingMedia` | N | - | 媒体 |
| `media[]` | `object` | N | - | 媒体 |
| `media[].fileId` | `ref:Uuid` | Y | - | 文件ID |
| `media[].fileId` | `string` | Y | - | 文件ID |
| `media[].type` | `string` | Y | IMAGE/FILE | 类型 |
| `media[].sort` | `integer` | Y | - | 排序 |
| `proofFileIds` | `array<ref:Uuid>` | N | - | 凭证文件ID |
| `proofFileIds[]` | `ref:Uuid` | N | - | 凭证文件ID |
| `proofFileIds[]` | `string` | N | - | 凭证文件ID |

### 5.123 `ListingFeaturedUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `featuredLevel` | `ref:FeaturedLevel` | Y | - | 推荐级别 |
| `featuredLevel` | `string` | Y | NONE/CITY/PROVINCE | 推荐级别 |
| `featuredRegionCode` | `string` | N | - | 推荐地区编码 |
| `featuredRank` | `integer` | N | - | 推荐排名 |
| `featuredUntil` | `string` | N | - | 推荐截止 |

### 5.124 `ListingImportDefaults`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `sellerUserId` | `ref:Uuid` | N | - | 卖方用户ID |
| `sellerUserId` | `string` | N | - | 卖方用户ID |
| `consultationRouting` | `ref:ConsultationRouting` | N | - | 咨询路由 |
| `consultationRouting` | `string` | N | PLATFORM/OWNER | 咨询路由 |
| `source` | `ref:ContentSource` | N | - | 来源 |
| `source` | `string` | N | USER/PLATFORM/ADMIN | 来源 |
| `tradeMode` | `ref:TradeMode` | N | - | 交易模式 |
| `tradeMode` | `string` | N | ASSIGNMENT/LICENSE | 交易模式 |
| `licenseMode` | `ref:LicenseMode` | N | - | 许可模式 |
| `licenseMode` | `string` | N | EXCLUSIVE/SOLE/NON_EXCLUSIVE | 许可模式 |
| `priceType` | `ref:PriceType` | N | - | 价格类型 |
| `priceType` | `string` | N | FIXED/NEGOTIABLE | 价格类型 |
| `priceAmountFen` | `ref:MoneyFen` | N | - | 价格金额分 |
| `priceAmountFen` | `integer` | N | - | 价格金额分 |
| `depositAmountFen` | `ref:MoneyFen` | N | - | 订金金额分 |
| `depositAmountFen` | `integer` | N | - | 订金金额分 |
| `regionCode` | `string` | N | - | 地区编码 |
| `listingTopics` | `array<ref:ListingTopic>` | N | - | 挂牌主题 |
| `listingTopics[]` | `ref:ListingTopic` | N | - | 挂牌主题 |
| `listingTopics[]` | `string` | N | HIGH_TECH_RETIRED/SLEEPING/AWARD_WINNING/FIVE_STAR/OPEN_LICENSE | 挂牌主题 |
| `industryTags` | `array<string>` | N | - | 行业标签 |
| `industryTags[]` | `string` | N | - | 行业标签 |
| `status` | `ref:ListingStatus` | N | - | 状态 |
| `status` | `string` | N | DRAFT/ACTIVE/OFF_SHELF/SOLD | 状态 |
| `auditStatus` | `ref:AuditStatus` | N | - | 审计状态 |
| `auditStatus` | `string` | N | PENDING/APPROVED/REJECTED | 审计状态 |

### 5.125 `ListingImportDuplicatePolicy`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.126 `ListingImportJob`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `operatorUserId` | `ref:Uuid` | Y | - | 操作人用户ID |
| `operatorUserId` | `string` | Y | - | 操作人用户ID |
| `fileId` | `ref:Uuid` | Y | - | 文件ID |
| `fileId` | `string` | Y | - | 文件ID |
| `duplicatePolicy` | `ref:ListingImportDuplicatePolicy` | Y | - | 重复策略 |
| `duplicatePolicy` | `string` | Y | SKIP/OVERWRITE | 重复策略 |
| `defaults` | `ref:ListingImportDefaults` | N | - | 默认 |
| `defaults` | `object` | N | - | 默认 |
| `defaults.sellerUserId` | `ref:Uuid` | N | - | 卖方用户ID |
| `defaults.sellerUserId` | `string` | N | - | 卖方用户ID |
| `defaults.consultationRouting` | `ref:ConsultationRouting` | N | - | 咨询路由 |
| `defaults.consultationRouting` | `string` | N | PLATFORM/OWNER | 咨询路由 |
| `defaults.source` | `ref:ContentSource` | N | - | 来源 |
| `defaults.source` | `string` | N | USER/PLATFORM/ADMIN | 来源 |
| `defaults.tradeMode` | `ref:TradeMode` | N | - | 交易模式 |
| `defaults.tradeMode` | `string` | N | ASSIGNMENT/LICENSE | 交易模式 |
| `defaults.licenseMode` | `ref:LicenseMode` | N | - | 许可模式 |
| `defaults.licenseMode` | `string` | N | EXCLUSIVE/SOLE/NON_EXCLUSIVE | 许可模式 |
| `defaults.priceType` | `ref:PriceType` | N | - | 价格类型 |
| `defaults.priceType` | `string` | N | FIXED/NEGOTIABLE | 价格类型 |
| `defaults.priceAmountFen` | `ref:MoneyFen` | N | - | 价格金额分 |
| `defaults.priceAmountFen` | `integer` | N | - | 价格金额分 |
| `defaults.depositAmountFen` | `ref:MoneyFen` | N | - | 订金金额分 |
| `defaults.depositAmountFen` | `integer` | N | - | 订金金额分 |
| `defaults.regionCode` | `string` | N | - | 地区编码 |
| `defaults.listingTopics` | `array<ref:ListingTopic>` | N | - | 挂牌主题 |
| `defaults.listingTopics[]` | `ref:ListingTopic` | N | - | 挂牌主题 |
| `defaults.listingTopics[]` | `string` | N | HIGH_TECH_RETIRED/SLEEPING/AWARD_WINNING/FIVE_STAR/OPEN_LICENSE | 挂牌主题 |
| `defaults.industryTags` | `array<string>` | N | - | 行业标签 |
| `defaults.industryTags[]` | `string` | N | - | 行业标签 |
| `defaults.status` | `ref:ListingStatus` | N | - | 状态 |
| `defaults.status` | `string` | N | DRAFT/ACTIVE/OFF_SHELF/SOLD | 状态 |
| `defaults.auditStatus` | `ref:AuditStatus` | N | - | 审计状态 |
| `defaults.auditStatus` | `string` | N | PENDING/APPROVED/REJECTED | 审计状态 |
| `status` | `ref:ListingJobStatus` | Y | - | 状态 |
| `status` | `string` | Y | PENDING/RUNNING/PAUSED/SUCCEEDED/FAILED | 状态 |
| `totalCount` | `integer` | Y | - | 总数量 |
| `validCount` | `integer` | Y | - | 有效数量 |
| `invalidCount` | `integer` | Y | - | 无效数量 |
| `successCount` | `integer` | Y | - | 成功数量 |
| `failedCount` | `integer` | Y | - | 失败数量 |
| `skippedCount` | `integer` | Y | - | 跳过数量 |
| `failRate` | `number` | Y | - | 失败费率 |
| `validatedAt` | `string` | N | - | 已校验时间 |
| `startedAt` | `string` | N | - | 开始时间 |
| `finishedAt` | `string` | N | - | 完成时间 |
| `pausedAt` | `string` | N | - | 暂停时间 |
| `errorFileId` | `ref:Uuid` | N | - | 错误文件ID |
| `errorFileId` | `string` | N | - | 错误文件ID |
| `createdAt` | `string` | Y | - | 创建时间 |
| `updatedAt` | `string` | Y | - | 更新时间 |

### 5.127 `ListingImportJobCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `fileId` | `ref:Uuid` | Y | - | 文件ID |
| `fileId` | `string` | Y | - | 文件ID |
| `duplicatePolicy` | `ref:ListingImportDuplicatePolicy` | N | - | 重复策略 |
| `duplicatePolicy` | `string` | N | SKIP/OVERWRITE | 重复策略 |
| `defaults` | `ref:ListingImportDefaults` | N | - | 默认 |
| `defaults` | `object` | N | - | 默认 |
| `defaults.sellerUserId` | `ref:Uuid` | N | - | 卖方用户ID |
| `defaults.sellerUserId` | `string` | N | - | 卖方用户ID |
| `defaults.consultationRouting` | `ref:ConsultationRouting` | N | - | 咨询路由 |
| `defaults.consultationRouting` | `string` | N | PLATFORM/OWNER | 咨询路由 |
| `defaults.source` | `ref:ContentSource` | N | - | 来源 |
| `defaults.source` | `string` | N | USER/PLATFORM/ADMIN | 来源 |
| `defaults.tradeMode` | `ref:TradeMode` | N | - | 交易模式 |
| `defaults.tradeMode` | `string` | N | ASSIGNMENT/LICENSE | 交易模式 |
| `defaults.licenseMode` | `ref:LicenseMode` | N | - | 许可模式 |
| `defaults.licenseMode` | `string` | N | EXCLUSIVE/SOLE/NON_EXCLUSIVE | 许可模式 |
| `defaults.priceType` | `ref:PriceType` | N | - | 价格类型 |
| `defaults.priceType` | `string` | N | FIXED/NEGOTIABLE | 价格类型 |
| `defaults.priceAmountFen` | `ref:MoneyFen` | N | - | 价格金额分 |
| `defaults.priceAmountFen` | `integer` | N | - | 价格金额分 |
| `defaults.depositAmountFen` | `ref:MoneyFen` | N | - | 订金金额分 |
| `defaults.depositAmountFen` | `integer` | N | - | 订金金额分 |
| `defaults.regionCode` | `string` | N | - | 地区编码 |
| `defaults.listingTopics` | `array<ref:ListingTopic>` | N | - | 挂牌主题 |
| `defaults.listingTopics[]` | `ref:ListingTopic` | N | - | 挂牌主题 |
| `defaults.listingTopics[]` | `string` | N | HIGH_TECH_RETIRED/SLEEPING/AWARD_WINNING/FIVE_STAR/OPEN_LICENSE | 挂牌主题 |
| `defaults.industryTags` | `array<string>` | N | - | 行业标签 |
| `defaults.industryTags[]` | `string` | N | - | 行业标签 |
| `defaults.status` | `ref:ListingStatus` | N | - | 状态 |
| `defaults.status` | `string` | N | DRAFT/ACTIVE/OFF_SHELF/SOLD | 状态 |
| `defaults.auditStatus` | `ref:AuditStatus` | N | - | 审计状态 |
| `defaults.auditStatus` | `string` | N | PENDING/APPROVED/REJECTED | 审计状态 |

### 5.128 `ListingImportJobRow`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `jobId` | `ref:Uuid` | Y | - | 任务ID |
| `jobId` | `string` | Y | - | 任务ID |
| `rowNo` | `integer` | Y | - | 行编号 |
| `status` | `ref:ListingImportRowStatus` | Y | - | 状态 |
| `status` | `string` | Y | PENDING/VALID/INVALID/SUCCEEDED/FAILED/SKIPPED | 状态 |
| `raw` | `object` | N | - | 原始 |
| `normalized` | `object` | N | - | 规范化 |
| `listingId` | `ref:Uuid` | N | - | 挂牌ID |
| `listingId` | `string` | N | - | 挂牌ID |
| `errorCode` | `string` | N | - | 错误编码 |
| `errorMessage` | `string` | N | - | 错误消息 |
| `processedAt` | `string` | N | - | 处理时间 |
| `createdAt` | `string` | Y | - | 创建时间 |
| `updatedAt` | `string` | Y | - | 更新时间 |

### 5.129 `ListingImportRowStatus`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.130 `ListingJobErrorFile`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `fileId` | `ref:Uuid` | Y | - | 文件ID |
| `fileId` | `string` | Y | - | 文件ID |
| `url` | `string` | Y | - | 链接 |

### 5.131 `ListingJobStatus`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.132 `ListingMedia`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `fileId` | `ref:Uuid` | Y | - | 文件ID |
| `fileId` | `string` | Y | - | 文件ID |
| `type` | `string` | Y | IMAGE/FILE | 类型 |
| `sort` | `integer` | Y | - | 排序 |

### 5.133 `ListingPublic`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `patentId` | `ref:Uuid` | N | - | 专利ID |
| `patentId` | `string` | N | - | 专利ID |
| `source` | `ref:ContentSource` | N | - | 来源 |
| `source` | `string` | N | USER/PLATFORM/ADMIN | 来源 |
| `applicationNoDisplay` | `string` | N | - | 申请编号显示 |
| `publicationNoDisplay` | `string` | N | - | 公开编号显示 |
| `patentNoDisplay` | `string` | N | - | 专利编号显示 |
| `grantPublicationNoDisplay` | `string` | N | - | 授权公开编号显示 |
| `patentType` | `ref:PatentType` | N | - | 专利类型 |
| `patentType` | `string` | N | INVENTION/UTILITY_MODEL/DESIGN | 专利类型 |
| `patentTypeDefinition` | `string` | N | - | 专利类型定义 |
| `patentTypeDefinitionSource` | `string` | N | - | 专利类型定义来源 |
| `patentTermYears` | `integer` | N | - | 专利期限年 |
| `title` | `string` | Y | - | 标题 |
| `inventorNames` | `array<string>` | N | - | 发明人名称 |
| `inventorNames[]` | `string` | N | - | 发明人名称 |
| `assigneeNames` | `array<string>` | N | - | 受让方名称 |
| `assigneeNames[]` | `string` | N | - | 受让方名称 |
| `applicantNames` | `array<string>` | N | - | 申请人名称 |
| `applicantNames[]` | `string` | N | - | 申请人名称 |
| `filingDate` | `string` | N | - | 申请日期 |
| `publicationDate` | `string` | N | - | 公开日期 |
| `grantDate` | `string` | N | - | 授权日期 |
| `legalStatus` | `ref:LegalStatus` | N | - | 法律状态 |
| `legalStatus` | `string` | N | PENDING/GRANTED/EXPIRED/INVALIDATED/UNKNOWN | 法律状态 |
| `tradeMode` | `ref:TradeMode` | Y | - | 交易模式 |
| `tradeMode` | `string` | Y | ASSIGNMENT/LICENSE | 交易模式 |
| `licenseMode` | `ref:LicenseMode` | N | - | 许可模式 |
| `licenseMode` | `string` | N | EXCLUSIVE/SOLE/NON_EXCLUSIVE | 许可模式 |
| `priceType` | `ref:PriceType` | Y | - | 价格类型 |
| `priceType` | `string` | Y | FIXED/NEGOTIABLE | 价格类型 |
| `priceAmountFen` | `ref:MoneyFen` | N | - | 价格金额分 |
| `priceAmountFen` | `integer` | N | - | 价格金额分 |
| `depositAmountFen` | `ref:MoneyFen` | Y | - | 订金金额分 |
| `depositAmountFen` | `integer` | Y | - | 订金金额分 |
| `regionCode` | `string` | N | - | 地区编码 |
| `industryTags` | `array<string>` | N | - | 行业标签 |
| `industryTags[]` | `string` | N | - | 行业标签 |
| `listingTopics` | `array<ref:ListingTopic>` | N | - | 挂牌主题 |
| `listingTopics[]` | `ref:ListingTopic` | N | - | 挂牌主题 |
| `listingTopics[]` | `string` | N | HIGH_TECH_RETIRED/SLEEPING/AWARD_WINNING/FIVE_STAR/OPEN_LICENSE | 挂牌主题 |
| `consultationRouting` | `ref:ConsultationRouting` | N | - | 咨询路由 |
| `consultationRouting` | `string` | N | PLATFORM/OWNER | 咨询路由 |
| `featuredLevel` | `ref:FeaturedLevel` | N | - | 推荐级别 |
| `featuredLevel` | `string` | N | NONE/CITY/PROVINCE | 推荐级别 |
| `featuredRegionCode` | `string` | N | - | 推荐地区编码 |
| `featuredRank` | `integer` | N | - | 推荐排名 |
| `featuredUntil` | `string` | N | - | 推荐截止 |
| `stats` | `ref:ListingStats` | N | - | 统计 |
| `stats` | `object` | N | - | 统计 |
| `stats.viewCount` | `integer` | Y | - | 浏览数量 |
| `stats.favoriteCount` | `integer` | Y | - | 收藏数量 |
| `stats.consultCount` | `integer` | Y | - | 咨询数量 |
| `stats.commentCount` | `integer` | N | - | 评论数量 |
| `transferCount` | `integer` | N | - | 转让数量 |
| `recommendationScore` | `number` | N | - | 推荐分值 |
| `auditStatus` | `ref:AuditStatus` | Y | - | 审计状态 |
| `auditStatus` | `string` | Y | PENDING/APPROVED/REJECTED | 审计状态 |
| `status` | `ref:ListingStatus` | Y | - | 状态 |
| `status` | `string` | Y | DRAFT/ACTIVE/OFF_SHELF/SOLD | 状态 |
| `coverUrl` | `string` | N | - | 封面链接 |
| `createdAt` | `string` | Y | - | 创建时间 |
| `updatedAt` | `string` | Y | - | 更新时间 |
| `seller` | `ref:UserBrief` | N | - | 卖方 |
| `seller` | `object` | N | - | 卖方 |
| `seller.id` | `ref:Uuid` | Y | - | ID |
| `seller.id` | `string` | Y | - | ID |
| `seller.nickname` | `string` | N | - | 昵称 |
| `seller.avatarUrl` | `string` | N | - | 头像链接 |
| `seller.role` | `ref:UserRole` | N | - | 角色 |
| `seller.role` | `string` | N | buyer/seller/cs/admin | 角色 |
| `seller.verificationStatus` | `ref:VerificationStatus` | N | - | 认证状态 |
| `seller.verificationStatus` | `string` | N | PENDING/APPROVED/REJECTED | 认证状态 |
| `seller.verificationType` | `ref:VerificationType` | N | - | 认证类型 |
| `seller.verificationType` | `string` | N | PERSON/COMPANY/ACADEMY/GOVERNMENT/ASSOCIATION/TECH_MANAGER | 认证类型 |
| `seller.orgCategory` | `ref:SupplyType` | N | - | 机构分类 |
| `seller.orgCategory` | `string` | N | UNIVERSITY/UNIVERSITY_985/UNIVERSITY_211/RESEARCH_INSTITUTE/OTHER | 机构分类 |
| `summary` | `string` | N | - | 摘要 |
| `deliverables` | `array<string>` | N | - | 交付物 |
| `deliverables[]` | `string` | N | - | 交付物 |
| `expectedCompletionDays` | `integer` | N | - | 预计完成天 |
| `negotiableRangeFen` | `ref:MoneyFen` | N | - | 可议价范围分 |
| `negotiableRangeFen` | `integer` | N | - | 可议价范围分 |
| `negotiableRangePercent` | `number` | N | - | 可议价范围百分比 |
| `negotiableNote` | `string` | N | - | 可议价备注 |
| `pledgeStatus` | `ref:PledgeStatus` | N | - | 质押状态 |
| `pledgeStatus` | `string` | N | NONE/PLEDGED/UNKNOWN | 质押状态 |
| `existingLicenseStatus` | `ref:ExistingLicenseStatus` | N | - | 既有许可状态 |
| `existingLicenseStatus` | `string` | N | NONE/EXCLUSIVE/SOLE/NON_EXCLUSIVE/UNKNOWN | 既有许可状态 |
| `encumbranceNote` | `string` | N | - | 权利负担备注 |
| `ipcCodes` | `array<string>` | N | - | IPC编码 |
| `ipcCodes[]` | `string` | N | - | IPC编码 |
| `locCodes` | `array<string>` | N | - | 位置编码 |
| `locCodes[]` | `string` | N | - | 位置编码 |
| `media` | `array<ref:ListingMedia>` | N | - | 媒体 |
| `media[]` | `ref:ListingMedia` | N | - | 媒体 |
| `media[]` | `object` | N | - | 媒体 |
| `media[].fileId` | `ref:Uuid` | Y | - | 文件ID |
| `media[].fileId` | `string` | Y | - | 文件ID |
| `media[].type` | `string` | Y | IMAGE/FILE | 类型 |
| `media[].sort` | `integer` | Y | - | 排序 |
| `aiParse` | `ref:AiParseResult` | N | - | 智能解析 |
| `aiParse` | `object` | N | - | 智能解析 |
| `aiParse.id` | `ref:Uuid` | Y | - | ID |
| `aiParse.id` | `string` | Y | - | ID |
| `aiParse.contentType` | `ref:AiContentType` | Y | - | 内容类型 |
| `aiParse.contentType` | `string` | Y | LISTING | 内容类型 |
| `aiParse.contentId` | `ref:Uuid` | Y | - | 内容ID |
| `aiParse.contentId` | `string` | Y | - | 内容ID |
| `aiParse.summaryPlain` | `string` | N | - | 摘要纯文本 |
| `aiParse.featuresPlain` | `string` | N | - | 特征纯文本 |
| `aiParse.keywords` | `array<string>` | N | - | 关键词 |
| `aiParse.keywords[]` | `string` | N | - | 关键词 |
| `aiParse.confidence` | `number` | Y | - | 置信度 |
| `aiParse.modelVersion` | `string` | N | - | 模型版本 |
| `aiParse.status` | `ref:AiParseStatus` | Y | - | 状态 |
| `aiParse.status` | `string` | Y | ACTIVE/REVIEW_REQUIRED/REPLACED | 状态 |
| `aiParse.createdAt` | `string` | Y | - | 创建时间 |
| `aiParse.updatedAt` | `string` | N | - | 更新时间 |

### 5.134 `ListingStats`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `viewCount` | `integer` | Y | - | 浏览数量 |
| `favoriteCount` | `integer` | Y | - | 收藏数量 |
| `consultCount` | `integer` | Y | - | 咨询数量 |
| `commentCount` | `integer` | N | - | 评论数量 |

### 5.135 `ListingStatus`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.136 `ListingSummary`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `patentId` | `ref:Uuid` | N | - | 专利ID |
| `patentId` | `string` | N | - | 专利ID |
| `source` | `ref:ContentSource` | N | - | 来源 |
| `source` | `string` | N | USER/PLATFORM/ADMIN | 来源 |
| `applicationNoDisplay` | `string` | N | - | 申请编号显示 |
| `publicationNoDisplay` | `string` | N | - | 公开编号显示 |
| `patentNoDisplay` | `string` | N | - | 专利编号显示 |
| `grantPublicationNoDisplay` | `string` | N | - | 授权公开编号显示 |
| `patentType` | `ref:PatentType` | N | - | 专利类型 |
| `patentType` | `string` | N | INVENTION/UTILITY_MODEL/DESIGN | 专利类型 |
| `patentTypeDefinition` | `string` | N | - | 专利类型定义 |
| `patentTypeDefinitionSource` | `string` | N | - | 专利类型定义来源 |
| `patentTermYears` | `integer` | N | - | 专利期限年 |
| `title` | `string` | Y | - | 标题 |
| `inventorNames` | `array<string>` | N | - | 发明人名称 |
| `inventorNames[]` | `string` | N | - | 发明人名称 |
| `assigneeNames` | `array<string>` | N | - | 受让方名称 |
| `assigneeNames[]` | `string` | N | - | 受让方名称 |
| `applicantNames` | `array<string>` | N | - | 申请人名称 |
| `applicantNames[]` | `string` | N | - | 申请人名称 |
| `filingDate` | `string` | N | - | 申请日期 |
| `publicationDate` | `string` | N | - | 公开日期 |
| `grantDate` | `string` | N | - | 授权日期 |
| `legalStatus` | `ref:LegalStatus` | N | - | 法律状态 |
| `legalStatus` | `string` | N | PENDING/GRANTED/EXPIRED/INVALIDATED/UNKNOWN | 法律状态 |
| `tradeMode` | `ref:TradeMode` | Y | - | 交易模式 |
| `tradeMode` | `string` | Y | ASSIGNMENT/LICENSE | 交易模式 |
| `licenseMode` | `ref:LicenseMode` | N | - | 许可模式 |
| `licenseMode` | `string` | N | EXCLUSIVE/SOLE/NON_EXCLUSIVE | 许可模式 |
| `priceType` | `ref:PriceType` | Y | - | 价格类型 |
| `priceType` | `string` | Y | FIXED/NEGOTIABLE | 价格类型 |
| `priceAmountFen` | `ref:MoneyFen` | N | - | 价格金额分 |
| `priceAmountFen` | `integer` | N | - | 价格金额分 |
| `depositAmountFen` | `ref:MoneyFen` | Y | - | 订金金额分 |
| `depositAmountFen` | `integer` | Y | - | 订金金额分 |
| `regionCode` | `string` | N | - | 地区编码 |
| `industryTags` | `array<string>` | N | - | 行业标签 |
| `industryTags[]` | `string` | N | - | 行业标签 |
| `listingTopics` | `array<ref:ListingTopic>` | N | - | 挂牌主题 |
| `listingTopics[]` | `ref:ListingTopic` | N | - | 挂牌主题 |
| `listingTopics[]` | `string` | N | HIGH_TECH_RETIRED/SLEEPING/AWARD_WINNING/FIVE_STAR/OPEN_LICENSE | 挂牌主题 |
| `consultationRouting` | `ref:ConsultationRouting` | N | - | 咨询路由 |
| `consultationRouting` | `string` | N | PLATFORM/OWNER | 咨询路由 |
| `featuredLevel` | `ref:FeaturedLevel` | N | - | 推荐级别 |
| `featuredLevel` | `string` | N | NONE/CITY/PROVINCE | 推荐级别 |
| `featuredRegionCode` | `string` | N | - | 推荐地区编码 |
| `featuredRank` | `integer` | N | - | 推荐排名 |
| `featuredUntil` | `string` | N | - | 推荐截止 |
| `stats` | `ref:ListingStats` | N | - | 统计 |
| `stats` | `object` | N | - | 统计 |
| `stats.viewCount` | `integer` | Y | - | 浏览数量 |
| `stats.favoriteCount` | `integer` | Y | - | 收藏数量 |
| `stats.consultCount` | `integer` | Y | - | 咨询数量 |
| `stats.commentCount` | `integer` | N | - | 评论数量 |
| `transferCount` | `integer` | N | - | 转让数量 |
| `recommendationScore` | `number` | N | - | 推荐分值 |
| `auditStatus` | `ref:AuditStatus` | Y | - | 审计状态 |
| `auditStatus` | `string` | Y | PENDING/APPROVED/REJECTED | 审计状态 |
| `status` | `ref:ListingStatus` | Y | - | 状态 |
| `status` | `string` | Y | DRAFT/ACTIVE/OFF_SHELF/SOLD | 状态 |
| `coverUrl` | `string` | N | - | 封面链接 |
| `createdAt` | `string` | Y | - | 创建时间 |
| `updatedAt` | `string` | Y | - | 更新时间 |

### 5.137 `ListingTopic`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.138 `ListingUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `patentNumberRaw` | `string` | N | - | 专利编号原始 |
| `title` | `string` | N | - | 标题 |
| `inventorNames` | `array<string>` | N | - | 发明人名称 |
| `inventorNames[]` | `string` | N | - | 发明人名称 |
| `assigneeNames` | `array<string>` | N | - | 受让方名称 |
| `assigneeNames[]` | `string` | N | - | 受让方名称 |
| `applicantNames` | `array<string>` | N | - | 申请人名称 |
| `applicantNames[]` | `string` | N | - | 申请人名称 |
| `legalStatus` | `ref:LegalStatus` | N | - | 法律状态 |
| `legalStatus` | `string` | N | PENDING/GRANTED/EXPIRED/INVALIDATED/UNKNOWN | 法律状态 |
| `legalStatusRaw` | `string` | N | - | 法律状态原始 |
| `filingDate` | `string` | N | - | 申请日期 |
| `publicationDate` | `string` | N | - | 公开日期 |
| `grantDate` | `string` | N | - | 授权日期 |
| `transferCount` | `integer` | N | - | 转让数量 |
| `summary` | `string` | N | - | 摘要 |
| `deliverables` | `array<string>` | N | - | 交付物 |
| `deliverables[]` | `string` | N | - | 交付物 |
| `expectedCompletionDays` | `integer` | N | - | 预计完成天 |
| `negotiableRangeFen` | `ref:MoneyFen` | N | - | 可议价范围分 |
| `negotiableRangeFen` | `integer` | N | - | 可议价范围分 |
| `negotiableRangePercent` | `number` | N | - | 可议价范围百分比 |
| `negotiableNote` | `string` | N | - | 可议价备注 |
| `pledgeStatus` | `ref:PledgeStatus` | N | - | 质押状态 |
| `pledgeStatus` | `string` | N | NONE/PLEDGED/UNKNOWN | 质押状态 |
| `existingLicenseStatus` | `ref:ExistingLicenseStatus` | N | - | 既有许可状态 |
| `existingLicenseStatus` | `string` | N | NONE/EXCLUSIVE/SOLE/NON_EXCLUSIVE/UNKNOWN | 既有许可状态 |
| `encumbranceNote` | `string` | N | - | 权利负担备注 |
| `tradeMode` | `ref:TradeMode` | N | - | 交易模式 |
| `tradeMode` | `string` | N | ASSIGNMENT/LICENSE | 交易模式 |
| `licenseMode` | `ref:LicenseMode` | N | - | 许可模式 |
| `licenseMode` | `string` | N | EXCLUSIVE/SOLE/NON_EXCLUSIVE | 许可模式 |
| `priceType` | `ref:PriceType` | N | - | 价格类型 |
| `priceType` | `string` | N | FIXED/NEGOTIABLE | 价格类型 |
| `priceAmountFen` | `ref:MoneyFen` | N | - | 价格金额分 |
| `priceAmountFen` | `integer` | N | - | 价格金额分 |
| `depositAmountFen` | `ref:MoneyFen` | N | - | 订金金额分 |
| `depositAmountFen` | `integer` | N | - | 订金金额分 |
| `regionCode` | `string` | N | - | 地区编码 |
| `industryTags` | `array<string>` | N | - | 行业标签 |
| `industryTags[]` | `string` | N | - | 行业标签 |
| `listingTopics` | `array<ref:ListingTopic>` | N | - | 挂牌主题 |
| `listingTopics[]` | `ref:ListingTopic` | N | - | 挂牌主题 |
| `listingTopics[]` | `string` | N | HIGH_TECH_RETIRED/SLEEPING/AWARD_WINNING/FIVE_STAR/OPEN_LICENSE | 挂牌主题 |
| `consultationRouting` | `ref:ConsultationRouting` | N | - | 咨询路由 |
| `consultationRouting` | `string` | N | PLATFORM/OWNER | 咨询路由 |
| `ipcCodes` | `array<string>` | N | - | IPC编码 |
| `ipcCodes[]` | `string` | N | - | IPC编码 |
| `locCodes` | `array<string>` | N | - | 位置编码 |
| `locCodes[]` | `string` | N | - | 位置编码 |
| `media` | `array<ref:ListingMedia>` | N | - | 媒体 |
| `media[]` | `ref:ListingMedia` | N | - | 媒体 |
| `media[]` | `object` | N | - | 媒体 |
| `media[].fileId` | `ref:Uuid` | Y | - | 文件ID |
| `media[].fileId` | `string` | Y | - | 文件ID |
| `media[].type` | `string` | Y | IMAGE/FILE | 类型 |
| `media[].sort` | `integer` | Y | - | 排序 |
| `proofFileIds` | `array<ref:Uuid>` | N | - | 凭证文件ID |
| `proofFileIds[]` | `ref:Uuid` | N | - | 凭证文件ID |
| `proofFileIds[]` | `string` | N | - | 凭证文件ID |

### 5.139 `MaintenanceUrgency`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.140 `ManualPaymentConfirmRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `payType` | `ref:PayType` | Y | - | 支付类型 |
| `payType` | `string` | Y | DEPOSIT/FINAL | 支付类型 |
| `amountFen` | `ref:MoneyFen` | N | - | 金额分 |
| `amountFen` | `integer` | N | - | 金额分 |
| `paidAt` | `string` | N | - | 已支付时间 |
| `tradeNo` | `string` | N | - | 交易编号 |

### 5.141 `ManualPaymentConfirmResponse`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `paymentId` | `ref:Uuid` | Y | - | 支付ID |
| `paymentId` | `string` | Y | - | 支付ID |
| `orderId` | `ref:Uuid` | Y | - | 订单ID |
| `orderId` | `string` | Y | - | 订单ID |
| `payType` | `ref:PayType` | Y | - | 支付类型 |
| `payType` | `string` | Y | DEPOSIT/FINAL | 支付类型 |
| `status` | `ref:PaymentStatus` | Y | - | 状态 |
| `status` | `string` | Y | PENDING/PAID/FAILED | 状态 |
| `amountFen` | `ref:MoneyFen` | Y | - | 金额分 |
| `amountFen` | `integer` | Y | - | 金额分 |
| `paidAt` | `string` | N | - | 已支付时间 |
| `tradeNo` | `string` | N | - | 交易编号 |

### 5.142 `ManualPayoutConfirmRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `payoutRef` | `string` | N | - | 放款参考 |
| `payoutEvidenceFileId` | `ref:Uuid` | Y | - | 放款凭证文件ID |
| `payoutEvidenceFileId` | `string` | Y | - | 放款凭证文件ID |
| `payoutAt` | `string` | N | - | 放款时间 |
| `remark` | `string` | N | - | 备注 |

### 5.143 `Milestone`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `name` | `ref:MilestoneName` | Y | - | 名称 |
| `name` | `string` | Y | CONTRACT_SIGNED/TRANSFER_SUBMITTED/TRANSFER_COMPLETED | 名称 |
| `status` | `ref:MilestoneStatus` | Y | - | 状态 |
| `status` | `string` | Y | PENDING/DONE | 状态 |
| `evidenceFileId` | `ref:Uuid` | N | - | 凭证文件ID |
| `evidenceFileId` | `string` | N | - | 凭证文件ID |
| `occurredAt` | `string` | N | - | 发生时间 |

### 5.144 `MilestoneName`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.145 `MilestoneStatus`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.146 `MoneyFen`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.147 `MyPatentMaintenanceSchedule`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `patentId` | `ref:Uuid` | Y | - | 专利ID |
| `patentId` | `string` | Y | - | 专利ID |
| `yearNo` | `integer` | Y | - | 年编号 |
| `dueDate` | `string` | Y | - | 到期日期 |
| `gracePeriodEnd` | `string` | N | - | 宽限期间结束 |
| `status` | `ref:PatentMaintenanceStatus` | Y | - | 状态 |
| `status` | `string` | Y | DUE/PAID/OVERDUE/WAIVED | 状态 |
| `createdAt` | `string` | Y | - | 创建时间 |
| `updatedAt` | `string` | N | - | 更新时间 |
| `patentTitle` | `string` | N | - | 专利标题 |
| `applicationNoDisplay` | `string` | N | - | 申请编号显示 |
| `urgency` | `ref:MaintenanceUrgency` | N | - | 紧急程度 |
| `urgency` | `string` | N | OVERDUE/DUE_SOON/UPCOMING/NORMAL/SETTLED | 紧急程度 |
| `canContactSupport` | `boolean` | N | - | 可联系客服 |

### 5.148 `MyPatentMaintenanceTask`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `scheduleId` | `ref:Uuid` | Y | - | 日程ID |
| `scheduleId` | `string` | Y | - | 日程ID |
| `assignedCsUserId` | `ref:Uuid` | N | - | 已分配客服用户ID |
| `assignedCsUserId` | `string` | N | - | 已分配客服用户ID |
| `status` | `ref:PatentMaintenanceTaskStatus` | Y | - | 状态 |
| `status` | `string` | Y | OPEN/IN_PROGRESS/DONE/CANCELLED | 状态 |
| `note` | `string` | N | - | 备注 |
| `evidenceFileId` | `ref:Uuid` | N | - | 凭证文件ID |
| `evidenceFileId` | `string` | N | - | 凭证文件ID |
| `createdAt` | `string` | Y | - | 创建时间 |
| `updatedAt` | `string` | N | - | 更新时间 |
| `patentId` | `ref:Uuid` | N | - | 专利ID |
| `patentId` | `string` | N | - | 专利ID |
| `patentTitle` | `string` | N | - | 专利标题 |
| `applicationNoDisplay` | `string` | N | - | 申请编号显示 |
| `scheduleYearNo` | `integer` | N | - | 日程年编号 |
| `scheduleDueDate` | `string` | N | - | 日程到期日期 |
| `scheduleStatus` | `ref:PatentMaintenanceStatus` | N | - | 日程状态 |
| `scheduleStatus` | `string` | N | DUE/PAID/OVERDUE/WAIVED | 日程状态 |
| `urgency` | `ref:MaintenanceUrgency` | N | - | 紧急程度 |
| `urgency` | `string` | N | OVERDUE/DUE_SOON/UPCOMING/NORMAL/SETTLED | 紧急程度 |
| `canContactSupport` | `boolean` | N | - | 可联系客服 |

### 5.149 `Notification`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `kind` | `ref:NotificationKind` | Y | - | 类别 |
| `kind` | `string` | Y | system/cs | 类别 |
| `title` | `string` | Y | - | 标题 |
| `summary` | `string` | Y | - | 摘要 |
| `source` | `string` | Y | - | 来源 |
| `time` | `string` | Y | - | 时间 |

### 5.150 `NotificationKind`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.151 `OkResponse`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `ok` | `boolean` | Y | - | 成功 |

### 5.152 `Order`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `listingId` | `ref:Uuid` | N | - | 挂牌ID |
| `listingId` | `string` | N | - | 挂牌ID |
| `patentId` | `ref:Uuid` | N | - | 专利ID |
| `patentId` | `string` | N | - | 专利ID |
| `buyerUserId` | `ref:Uuid` | Y | - | 买方用户ID |
| `buyerUserId` | `string` | Y | - | 买方用户ID |
| `sellerUserId` | `ref:Uuid` | N | - | 卖方用户ID |
| `sellerUserId` | `string` | N | - | 卖方用户ID |
| `assignedCsUserId` | `ref:Uuid` | N | - | 已分配客服用户ID |
| `assignedCsUserId` | `string` | N | - | 已分配客服用户ID |
| `status` | `ref:OrderStatus` | Y | - | 状态 |
| `status` | `string` | Y | DEPOSIT_PENDING/DEPOSIT_PAID/WAIT_FINAL_PAYMENT/FINAL_PAID_ESCROW/READY_TO_SETTLE/COMPLETED/CANCELLED/REFUNDING/REFUNDED | 状态 |
| `dealAmountFen` | `ref:MoneyFen` | N | - | 成交金额分 |
| `dealAmountFen` | `integer` | N | - | 成交金额分 |
| `depositAmountFen` | `ref:MoneyFen` | Y | - | 订金金额分 |
| `depositAmountFen` | `integer` | Y | - | 订金金额分 |
| `finalAmountFen` | `ref:MoneyFen` | N | - | 尾款金额分 |
| `finalAmountFen` | `integer` | N | - | 尾款金额分 |
| `commissionAmountFen` | `ref:MoneyFen` | N | - | 佣金金额分 |
| `commissionAmountFen` | `integer` | N | - | 佣金金额分 |
| `invoice` | `ref:OrderInvoice` | N | - | 发票 |
| `invoice` | `object` | N | - | 发票 |
| `invoice.orderId` | `ref:Uuid` | Y | - | 订单ID |
| `invoice.orderId` | `string` | Y | - | 订单ID |
| `invoice.amountFen` | `ref:MoneyFen` | N | - | 金额分 |
| `invoice.amountFen` | `integer` | N | - | 金额分 |
| `invoice.itemName` | `string` | N | - | 条目名称 |
| `invoice.invoiceNo` | `string` | N | - | 发票编号 |
| `invoice.issuedAt` | `string` | N | - | 发放时间 |
| `invoice.invoiceFile` | `ref:FileObject` | Y | - | 发票文件 |
| `invoice.invoiceFile` | `object` | Y | - | 发票文件 |
| `invoice.invoiceFile.id` | `ref:Uuid` | Y | - | ID |
| `invoice.invoiceFile.id` | `string` | Y | - | ID |
| `invoice.invoiceFile.url` | `string` | Y | - | 链接 |
| `invoice.invoiceFile.fileName` | `string` | N | - | 文件名称 |
| `invoice.invoiceFile.mimeType` | `string` | Y | - | 媒体类型 |
| `invoice.invoiceFile.sizeBytes` | `integer` | Y | - | 大小字节 |
| `invoice.invoiceFile.createdAt` | `string` | Y | - | 创建时间 |
| `invoice.attachedAt` | `string` | N | - | 附加时间 |
| `invoice.updatedAt` | `string` | N | - | 更新时间 |
| `createdAt` | `string` | Y | - | 创建时间 |
| `updatedAt` | `string` | N | - | 更新时间 |

### 5.153 `OrderInvoice`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `orderId` | `ref:Uuid` | Y | - | 订单ID |
| `orderId` | `string` | Y | - | 订单ID |
| `amountFen` | `ref:MoneyFen` | N | - | 金额分 |
| `amountFen` | `integer` | N | - | 金额分 |
| `itemName` | `string` | N | - | 条目名称 |
| `invoiceNo` | `string` | N | - | 发票编号 |
| `issuedAt` | `string` | N | - | 发放时间 |
| `invoiceFile` | `ref:FileObject` | Y | - | 发票文件 |
| `invoiceFile` | `object` | Y | - | 发票文件 |
| `invoiceFile.id` | `ref:Uuid` | Y | - | ID |
| `invoiceFile.id` | `string` | Y | - | ID |
| `invoiceFile.url` | `string` | Y | - | 链接 |
| `invoiceFile.fileName` | `string` | N | - | 文件名称 |
| `invoiceFile.mimeType` | `string` | Y | - | 媒体类型 |
| `invoiceFile.sizeBytes` | `integer` | Y | - | 大小字节 |
| `invoiceFile.createdAt` | `string` | Y | - | 创建时间 |
| `attachedAt` | `string` | N | - | 附加时间 |
| `updatedAt` | `string` | N | - | 更新时间 |

### 5.154 `OrderInvoiceIssueResponse`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `orderId` | `ref:Uuid` | Y | - | 订单ID |
| `orderId` | `string` | Y | - | 订单ID |
| `invoiceNo` | `string` | Y | - | 发票编号 |

### 5.155 `OrderInvoiceUpsertRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `invoiceFileId` | `ref:Uuid` | Y | - | 发票文件ID |
| `invoiceFileId` | `string` | Y | - | 发票文件ID |
| `invoiceNo` | `string` | N | - | 发票编号 |
| `issuedAt` | `string` | N | - | 发放时间 |

### 5.156 `OrderListRole`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.157 `OrderStatus`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.158 `OrderStatusGroup`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.159 `OrganizationStats`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `listingCount` | `integer` | Y | - | 挂牌数量 |
| `patentCount` | `integer` | Y | - | 专利数量 |

### 5.160 `OrganizationSummary`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `userId` | `ref:Uuid` | Y | - | 用户ID |
| `userId` | `string` | Y | - | 用户ID |
| `displayName` | `string` | Y | - | 显示名称 |
| `verificationType` | `ref:VerificationType` | Y | - | 认证类型 |
| `verificationType` | `string` | Y | PERSON/COMPANY/ACADEMY/GOVERNMENT/ASSOCIATION/TECH_MANAGER | 认证类型 |
| `verificationStatus` | `ref:VerificationStatus` | Y | - | 认证状态 |
| `verificationStatus` | `string` | Y | PENDING/APPROVED/REJECTED | 认证状态 |
| `orgCategory` | `ref:SupplyType` | N | - | 机构分类 |
| `orgCategory` | `string` | N | UNIVERSITY/UNIVERSITY_985/UNIVERSITY_211/RESEARCH_INSTITUTE/OTHER | 机构分类 |
| `regionCode` | `string` | N | - | 地区编码 |
| `logoUrl` | `string` | N | - | 标识链接 |
| `intro` | `string` | N | - | 简介 |
| `stats` | `ref:OrganizationStats` | N | - | 统计 |
| `stats` | `object` | N | - | 统计 |
| `stats.listingCount` | `integer` | Y | - | 挂牌数量 |
| `stats.patentCount` | `integer` | Y | - | 专利数量 |
| `verifiedAt` | `string` | N | - | 已核验时间 |

### 5.161 `PageMeta`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `page` | `integer` | Y | - | 页码 |
| `pageSize` | `integer` | Y | - | 页码大小 |
| `total` | `integer` | Y | - | 总 |

### 5.162 `PagedAchievementSummary`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:AchievementSummary>` | Y | - | 条目 |
| `items[]` | `ref:AchievementSummary` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `ref:Uuid` | Y | - | ID |
| `items[].id` | `string` | Y | - | ID |
| `items[].source` | `ref:ContentSource` | N | - | 来源 |
| `items[].source` | `string` | N | USER/PLATFORM/ADMIN | 来源 |
| `items[].title` | `string` | Y | - | 标题 |
| `items[].summary` | `string` | N | - | 摘要 |
| `items[].maturity` | `ref:AchievementMaturity` | N | - | 成熟度 |
| `items[].maturity` | `string` | N | CONCEPT/PROTOTYPE/PILOT/MASS_PRODUCTION/COMMERCIALIZED/OTHER | 成熟度 |
| `items[].cooperationModes` | `array<string>` | N | - | 合作模式 |
| `items[].cooperationModes[]` | `string` | N | - | 合作模式 |
| `items[].regionCode` | `string` | N | - | 地区编码 |
| `items[].industryTags` | `array<string>` | N | - | 行业标签 |
| `items[].industryTags[]` | `string` | N | - | 行业标签 |
| `items[].keywords` | `array<string>` | N | - | 关键词 |
| `items[].keywords[]` | `string` | N | - | 关键词 |
| `items[].publisher` | `ref:OrganizationSummary` | N | - | 发布者 |
| `items[].publisher` | `object` | N | - | 发布者 |
| `items[].publisher.userId` | `ref:Uuid` | Y | - | 用户ID |
| `items[].publisher.userId` | `string` | Y | - | 用户ID |
| `items[].publisher.displayName` | `string` | Y | - | 显示名称 |
| `items[].publisher.verificationType` | `ref:VerificationType` | Y | - | 认证类型 |
| `items[].publisher.verificationType` | `string` | Y | PERSON/COMPANY/ACADEMY/GOVERNMENT/ASSOCIATION/TECH_MANAGER | 认证类型 |
| `items[].publisher.verificationStatus` | `ref:VerificationStatus` | Y | - | 认证状态 |
| `items[].publisher.verificationStatus` | `string` | Y | PENDING/APPROVED/REJECTED | 认证状态 |
| `items[].publisher.orgCategory` | `ref:SupplyType` | N | - | 机构分类 |
| `items[].publisher.orgCategory` | `string` | N | UNIVERSITY/UNIVERSITY_985/UNIVERSITY_211/RESEARCH_INSTITUTE/OTHER | 机构分类 |
| `items[].publisher.regionCode` | `string` | N | - | 地区编码 |
| `items[].publisher.logoUrl` | `string` | N | - | 标识链接 |
| `items[].publisher.intro` | `string` | N | - | 简介 |
| `items[].publisher.stats` | `ref:OrganizationStats` | N | - | 统计 |
| `items[].publisher.stats` | `object` | N | - | 统计 |
| `items[].publisher.stats.listingCount` | `integer` | Y | - | 挂牌数量 |
| `items[].publisher.stats.patentCount` | `integer` | Y | - | 专利数量 |
| `items[].publisher.verifiedAt` | `string` | N | - | 已核验时间 |
| `items[].stats` | `ref:ListingStats` | N | - | 统计 |
| `items[].stats` | `object` | N | - | 统计 |
| `items[].stats.viewCount` | `integer` | Y | - | 浏览数量 |
| `items[].stats.favoriteCount` | `integer` | Y | - | 收藏数量 |
| `items[].stats.consultCount` | `integer` | Y | - | 咨询数量 |
| `items[].stats.commentCount` | `integer` | N | - | 评论数量 |
| `items[].auditStatus` | `ref:AuditStatus` | Y | - | 审计状态 |
| `items[].auditStatus` | `string` | Y | PENDING/APPROVED/REJECTED | 审计状态 |
| `items[].status` | `ref:ContentStatus` | Y | - | 状态 |
| `items[].status` | `string` | Y | DRAFT/ACTIVE/OFF_SHELF | 状态 |
| `items[].coverUrl` | `string` | N | - | 封面链接 |
| `items[].createdAt` | `string` | Y | - | 创建时间 |
| `page` | `ref:PageMeta` | Y | - | 页码 |
| `page` | `object` | Y | - | 页码 |
| `page.page` | `integer` | Y | - | 页码 |
| `page.pageSize` | `integer` | Y | - | 页码大小 |
| `page.total` | `integer` | Y | - | 总 |

### 5.163 `PagedAiParseResult`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:AiParseResult>` | Y | - | 条目 |
| `items[]` | `ref:AiParseResult` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `ref:Uuid` | Y | - | ID |
| `items[].id` | `string` | Y | - | ID |
| `items[].contentType` | `ref:AiContentType` | Y | - | 内容类型 |
| `items[].contentType` | `string` | Y | LISTING | 内容类型 |
| `items[].contentId` | `ref:Uuid` | Y | - | 内容ID |
| `items[].contentId` | `string` | Y | - | 内容ID |
| `items[].summaryPlain` | `string` | N | - | 摘要纯文本 |
| `items[].featuresPlain` | `string` | N | - | 特征纯文本 |
| `items[].keywords` | `array<string>` | N | - | 关键词 |
| `items[].keywords[]` | `string` | N | - | 关键词 |
| `items[].confidence` | `number` | Y | - | 置信度 |
| `items[].modelVersion` | `string` | N | - | 模型版本 |
| `items[].status` | `ref:AiParseStatus` | Y | - | 状态 |
| `items[].status` | `string` | Y | ACTIVE/REVIEW_REQUIRED/REPLACED | 状态 |
| `items[].createdAt` | `string` | Y | - | 创建时间 |
| `items[].updatedAt` | `string` | N | - | 更新时间 |
| `page` | `ref:PageMeta` | Y | - | 页码 |
| `page` | `object` | Y | - | 页码 |
| `page.page` | `integer` | Y | - | 页码 |
| `page.pageSize` | `integer` | Y | - | 页码大小 |
| `page.total` | `integer` | Y | - | 总 |

### 5.164 `PagedAlertEvent`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:AlertEvent>` | Y | - | 条目 |
| `items[]` | `ref:AlertEvent` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `ref:Uuid` | Y | - | ID |
| `items[].id` | `string` | Y | - | ID |
| `items[].type` | `string` | Y | - | 类型 |
| `items[].severity` | `ref:AlertSeverity` | Y | - | 严重级别 |
| `items[].severity` | `string` | Y | LOW/MEDIUM/HIGH | 严重级别 |
| `items[].channel` | `ref:AlertChannel` | Y | - | 渠道 |
| `items[].channel` | `string` | Y | SMS/EMAIL/IN_APP | 渠道 |
| `items[].status` | `ref:AlertStatus` | Y | - | 状态 |
| `items[].status` | `string` | Y | PENDING/SENT/ACKED/SUPPRESSED | 状态 |
| `items[].targetType` | `ref:AlertTargetType` | N | - | 目标类型 |
| `items[].targetType` | `string` | N | PATENT/ORDER/LISTING/AI_PARSE/IMPORT/PAYMENT/REFUND/SYSTEM | 目标类型 |
| `items[].targetId` | `ref:Uuid` | N | - | 目标ID |
| `items[].targetId` | `string` | N | - | 目标ID |
| `items[].message` | `string` | N | - | 消息 |
| `items[].triggeredAt` | `string` | Y | - | 触发时间 |
| `items[].sentAt` | `string` | N | - | 已发送时间 |
| `page` | `ref:PageMeta` | Y | - | 页码 |
| `page` | `object` | Y | - | 页码 |
| `page.page` | `integer` | Y | - | 页码 |
| `page.pageSize` | `integer` | Y | - | 页码大小 |
| `page.total` | `integer` | Y | - | 总 |

### 5.165 `PagedAuditLog`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:AuditLog>` | Y | - | 条目 |
| `items[]` | `ref:AuditLog` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `ref:Uuid` | Y | - | ID |
| `items[].id` | `string` | Y | - | ID |
| `items[].action` | `string` | Y | - | 操作 |
| `items[].reason` | `string` | N | - | 原因 |
| `items[].operatorId` | `ref:Uuid` | N | - | 操作人ID |
| `items[].operatorId` | `string` | N | - | 操作人ID |
| `items[].operatorName` | `string` | N | - | 操作人名称 |
| `items[].createdAt` | `string` | Y | - | 创建时间 |
| `page` | `ref:PageMeta` | Y | - | 页码 |
| `page` | `object` | Y | - | 页码 |
| `page.page` | `integer` | Y | - | 页码 |
| `page.pageSize` | `integer` | Y | - | 页码大小 |
| `page.total` | `integer` | Y | - | 总 |

### 5.166 `PagedCase`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:CaseRecord>` | Y | - | 条目 |
| `items[]` | `ref:CaseRecord` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `ref:Uuid` | Y | - | ID |
| `items[].id` | `string` | Y | - | ID |
| `items[].title` | `string` | Y | - | 标题 |
| `items[].type` | `ref:CaseType` | Y | - | 类型 |
| `items[].type` | `string` | Y | FOLLOWUP/REFUND/DISPUTE | 类型 |
| `items[].status` | `ref:CaseStatus` | Y | - | 状态 |
| `items[].status` | `string` | Y | OPEN/IN_PROGRESS/CLOSED | 状态 |
| `items[].orderId` | `ref:Uuid` | N | - | 订单ID |
| `items[].orderId` | `string` | N | - | 订单ID |
| `items[].requesterName` | `string` | N | - | 申请人名称 |
| `items[].assigneeId` | `string` | N | - | 受让方ID |
| `items[].assigneeName` | `string` | N | - | 受让方名称 |
| `items[].priority` | `ref:CasePriority` | N | - | 优先级 |
| `items[].priority` | `string` | N | LOW/MEDIUM/HIGH | 优先级 |
| `items[].description` | `string` | N | - | 描述 |
| `items[].createdAt` | `string` | Y | - | 创建时间 |
| `items[].updatedAt` | `string` | N | - | 更新时间 |
| `items[].notes` | `array<ref:CaseNote>` | Y | - | 备注 |
| `items[].notes[]` | `ref:CaseNote` | N | - | 备注 |
| `items[].notes[]` | `object` | N | - | 备注 |
| `items[].notes[].id` | `ref:Uuid` | Y | - | ID |
| `items[].notes[].id` | `string` | Y | - | ID |
| `items[].notes[].authorId` | `string` | Y | - | 作者ID |
| `items[].notes[].authorName` | `string` | Y | - | 作者名称 |
| `items[].notes[].content` | `string` | Y | - | 内容 |
| `items[].notes[].createdAt` | `string` | Y | - | 创建时间 |
| `items[].evidenceFiles` | `array<ref:CaseEvidence>` | N | - | 凭证文件 |
| `items[].evidenceFiles[]` | `ref:CaseEvidence` | N | - | 凭证文件 |
| `items[].evidenceFiles[]` | `object` | N | - | 凭证文件 |
| `items[].evidenceFiles[].id` | `string` | Y | - | ID |
| `items[].evidenceFiles[].name` | `string` | Y | - | 名称 |
| `items[].evidenceFiles[].url` | `string` | N | - | 链接 |
| `items[].dueAt` | `string` | N | - | 到期时间 |
| `items[].slaStatus` | `ref:CaseSlaStatus` | N | - | 服务时效状态 |
| `items[].slaStatus` | `string` | N | ON_TIME/OVERDUE | 服务时效状态 |
| `page` | `ref:PageMeta` | Y | - | 页码 |
| `page` | `object` | Y | - | 页码 |
| `page.page` | `integer` | Y | - | 页码 |
| `page.pageSize` | `integer` | Y | - | 页码大小 |
| `page.total` | `integer` | Y | - | 总 |

### 5.167 `PagedComment`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:Comment>` | Y | - | 条目 |
| `items[]` | `ref:Comment` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `ref:Uuid` | Y | - | ID |
| `items[].id` | `string` | Y | - | ID |
| `items[].contentType` | `ref:CommentContentType` | Y | - | 内容类型 |
| `items[].contentType` | `string` | Y | LISTING/ACHIEVEMENT | 内容类型 |
| `items[].contentId` | `ref:Uuid` | Y | - | 内容ID |
| `items[].contentId` | `string` | Y | - | 内容ID |
| `items[].parentCommentId` | `ref:Uuid` | N | - | 父级评论ID |
| `items[].parentCommentId` | `string` | N | - | 父级评论ID |
| `items[].status` | `ref:CommentStatus` | N | - | 状态 |
| `items[].status` | `string` | N | VISIBLE/HIDDEN/DELETED | 状态 |
| `items[].user` | `ref:UserBrief` | Y | - | 用户 |
| `items[].user` | `object` | Y | - | 用户 |
| `items[].user.id` | `ref:Uuid` | Y | - | ID |
| `items[].user.id` | `string` | Y | - | ID |
| `items[].user.nickname` | `string` | N | - | 昵称 |
| `items[].user.avatarUrl` | `string` | N | - | 头像链接 |
| `items[].user.role` | `ref:UserRole` | N | - | 角色 |
| `items[].user.role` | `string` | N | buyer/seller/cs/admin | 角色 |
| `items[].user.verificationStatus` | `ref:VerificationStatus` | N | - | 认证状态 |
| `items[].user.verificationStatus` | `string` | N | PENDING/APPROVED/REJECTED | 认证状态 |
| `items[].user.verificationType` | `ref:VerificationType` | N | - | 认证类型 |
| `items[].user.verificationType` | `string` | N | PERSON/COMPANY/ACADEMY/GOVERNMENT/ASSOCIATION/TECH_MANAGER | 认证类型 |
| `items[].user.orgCategory` | `ref:SupplyType` | N | - | 机构分类 |
| `items[].user.orgCategory` | `string` | N | UNIVERSITY/UNIVERSITY_985/UNIVERSITY_211/RESEARCH_INSTITUTE/OTHER | 机构分类 |
| `items[].text` | `string` | Y | - | 文本 |
| `items[].createdAt` | `string` | Y | - | 创建时间 |
| `items[].updatedAt` | `string` | N | - | 更新时间 |
| `page` | `ref:PageMeta` | Y | - | 页码 |
| `page` | `object` | Y | - | 页码 |
| `page.page` | `integer` | Y | - | 页码 |
| `page.pageSize` | `integer` | Y | - | 页码大小 |
| `page.total` | `integer` | Y | - | 总 |

### 5.168 `PagedCommentThread`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:CommentThread>` | Y | - | 条目 |
| `items[]` | `ref:CommentThread` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].root` | `ref:Comment` | Y | - | 根 |
| `items[].root` | `object` | Y | - | 根 |
| `items[].root.id` | `ref:Uuid` | Y | - | ID |
| `items[].root.id` | `string` | Y | - | ID |
| `items[].root.contentType` | `ref:CommentContentType` | Y | - | 内容类型 |
| `items[].root.contentType` | `string` | Y | LISTING/ACHIEVEMENT | 内容类型 |
| `items[].root.contentId` | `ref:Uuid` | Y | - | 内容ID |
| `items[].root.contentId` | `string` | Y | - | 内容ID |
| `items[].root.parentCommentId` | `ref:Uuid` | N | - | 父级评论ID |
| `items[].root.parentCommentId` | `string` | N | - | 父级评论ID |
| `items[].root.status` | `ref:CommentStatus` | N | - | 状态 |
| `items[].root.status` | `string` | N | VISIBLE/HIDDEN/DELETED | 状态 |
| `items[].root.user` | `ref:UserBrief` | Y | - | 用户 |
| `items[].root.user` | `object` | Y | - | 用户 |
| `items[].root.user.id` | `ref:Uuid` | Y | - | ID |
| `items[].root.user.id` | `string` | Y | - | ID |
| `items[].root.user.nickname` | `string` | N | - | 昵称 |
| `items[].root.user.avatarUrl` | `string` | N | - | 头像链接 |
| `items[].root.user.role` | `ref:UserRole` | N | - | 角色 |
| `items[].root.user.role` | `string` | N | buyer/seller/cs/admin | 角色 |
| `items[].root.user.verificationStatus` | `ref:VerificationStatus` | N | - | 认证状态 |
| `items[].root.user.verificationStatus` | `string` | N | PENDING/APPROVED/REJECTED | 认证状态 |
| `items[].root.user.verificationType` | `ref:VerificationType` | N | - | 认证类型 |
| `items[].root.user.verificationType` | `string` | N | PERSON/COMPANY/ACADEMY/GOVERNMENT/ASSOCIATION/TECH_MANAGER | 认证类型 |
| `items[].root.user.orgCategory` | `ref:SupplyType` | N | - | 机构分类 |
| `items[].root.user.orgCategory` | `string` | N | UNIVERSITY/UNIVERSITY_985/UNIVERSITY_211/RESEARCH_INSTITUTE/OTHER | 机构分类 |
| `items[].root.text` | `string` | Y | - | 文本 |
| `items[].root.createdAt` | `string` | Y | - | 创建时间 |
| `items[].root.updatedAt` | `string` | N | - | 更新时间 |
| `items[].replies` | `array<ref:Comment>` | Y | - | 回复 |
| `items[].replies[]` | `ref:Comment` | N | - | 回复 |
| `items[].replies[]` | `object` | N | - | 回复 |
| `items[].replies[].id` | `ref:Uuid` | Y | - | ID |
| `items[].replies[].id` | `string` | Y | - | ID |
| `items[].replies[].contentType` | `ref:CommentContentType` | Y | - | 内容类型 |
| `items[].replies[].contentType` | `string` | Y | LISTING/ACHIEVEMENT | 内容类型 |
| `items[].replies[].contentId` | `ref:Uuid` | Y | - | 内容ID |
| `items[].replies[].contentId` | `string` | Y | - | 内容ID |
| `items[].replies[].parentCommentId` | `ref:Uuid` | N | - | 父级评论ID |
| `items[].replies[].parentCommentId` | `string` | N | - | 父级评论ID |
| `items[].replies[].status` | `ref:CommentStatus` | N | - | 状态 |
| `items[].replies[].status` | `string` | N | VISIBLE/HIDDEN/DELETED | 状态 |
| `items[].replies[].user` | `ref:UserBrief` | Y | - | 用户 |
| `items[].replies[].user` | `object` | Y | - | 用户 |
| `items[].replies[].user.id` | `ref:Uuid` | Y | - | ID |
| `items[].replies[].user.id` | `string` | Y | - | ID |
| `items[].replies[].user.nickname` | `string` | N | - | 昵称 |
| `items[].replies[].user.avatarUrl` | `string` | N | - | 头像链接 |
| `items[].replies[].user.role` | `ref:UserRole` | N | - | 角色 |
| `items[].replies[].user.role` | `string` | N | buyer/seller/cs/admin | 角色 |
| `items[].replies[].user.verificationStatus` | `ref:VerificationStatus` | N | - | 认证状态 |
| `items[].replies[].user.verificationStatus` | `string` | N | PENDING/APPROVED/REJECTED | 认证状态 |
| `items[].replies[].user.verificationType` | `ref:VerificationType` | N | - | 认证类型 |
| `items[].replies[].user.verificationType` | `string` | N | PERSON/COMPANY/ACADEMY/GOVERNMENT/ASSOCIATION/TECH_MANAGER | 认证类型 |
| `items[].replies[].user.orgCategory` | `ref:SupplyType` | N | - | 机构分类 |
| `items[].replies[].user.orgCategory` | `string` | N | UNIVERSITY/UNIVERSITY_985/UNIVERSITY_211/RESEARCH_INSTITUTE/OTHER | 机构分类 |
| `items[].replies[].text` | `string` | Y | - | 文本 |
| `items[].replies[].createdAt` | `string` | Y | - | 创建时间 |
| `items[].replies[].updatedAt` | `string` | N | - | 更新时间 |
| `page` | `ref:PageMeta` | Y | - | 页码 |
| `page` | `object` | Y | - | 页码 |
| `page.page` | `integer` | Y | - | 页码 |
| `page.pageSize` | `integer` | Y | - | 页码大小 |
| `page.total` | `integer` | Y | - | 总 |

### 5.169 `PagedContract`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:ContractItem>` | Y | - | 条目 |
| `items[]` | `ref:ContractItem` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `string` | Y | - | ID |
| `items[].orderId` | `ref:Uuid` | Y | - | 订单ID |
| `items[].orderId` | `string` | Y | - | 订单ID |
| `items[].listingTitle` | `string` | N | - | 挂牌标题 |
| `items[].counterpartName` | `string` | N | - | 对方名称 |
| `items[].status` | `ref:ContractStatus` | Y | - | 状态 |
| `items[].status` | `string` | Y | WAIT_UPLOAD/WAIT_CONFIRM/AVAILABLE | 状态 |
| `items[].createdAt` | `string` | Y | - | 创建时间 |
| `items[].uploadedAt` | `string` | N | - | 上传时间 |
| `items[].signedAt` | `string` | N | - | 签署时间 |
| `items[].fileUrl` | `string` | N | - | 文件链接 |
| `items[].watermarkOwner` | `string` | N | - | 水印所有者 |
| `items[].canUpload` | `boolean` | N | - | 可上传 |
| `page` | `ref:PageMeta` | Y | - | 页码 |
| `page` | `object` | Y | - | 页码 |
| `page.page` | `integer` | Y | - | 页码 |
| `page.pageSize` | `integer` | Y | - | 页码大小 |
| `page.total` | `integer` | Y | - | 总 |

### 5.170 `PagedConversationMessage`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:ConversationMessage>` | Y | - | 条目 |
| `items[]` | `ref:ConversationMessage` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `ref:Uuid` | Y | - | ID |
| `items[].id` | `string` | Y | - | ID |
| `items[].conversationId` | `ref:Uuid` | Y | - | 会话ID |
| `items[].conversationId` | `string` | Y | - | 会话ID |
| `items[].senderUserId` | `ref:Uuid` | Y | - | 发送方用户ID |
| `items[].senderUserId` | `string` | Y | - | 发送方用户ID |
| `items[].type` | `ref:ConversationMessageType` | Y | - | 类型 |
| `items[].type` | `string` | Y | TEXT/EMOJI/SYSTEM | 类型 |
| `items[].text` | `string` | N | - | 文本 |
| `items[].fileId` | `ref:Uuid` | N | - | 文件ID |
| `items[].fileId` | `string` | N | - | 文件ID |
| `items[].fileUrl` | `string` | N | - | 文件链接 |
| `items[].createdAt` | `string` | Y | - | 创建时间 |
| `nextCursor` | `string` | N | - | 下一条游标 |

### 5.171 `PagedConversationSummary`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:ConversationSummary>` | Y | - | 条目 |
| `items[]` | `ref:ConversationSummary` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `ref:Uuid` | Y | - | ID |
| `items[].id` | `string` | Y | - | ID |
| `items[].contentType` | `ref:ConversationContentType` | Y | - | 内容类型 |
| `items[].contentType` | `string` | Y | LISTING/ACHIEVEMENT/TECH_MANAGER/SUPPORT/DISPUTE/MAINTENANCE | 内容类型 |
| `items[].contentId` | `ref:Uuid` | Y | - | 内容ID |
| `items[].contentId` | `string` | Y | - | 内容ID |
| `items[].contentTitle` | `string` | Y | - | 内容标题 |
| `items[].listingId` | `ref:Uuid` | N | - | 挂牌ID |
| `items[].listingId` | `string` | N | - | 挂牌ID |
| `items[].listingTitle` | `string` | N | - | 挂牌标题 |
| `items[].listingTopics` | `array<ref:ListingTopic>` | N | - | 挂牌主题 |
| `items[].listingTopics[]` | `ref:ListingTopic` | N | - | 挂牌主题 |
| `items[].listingTopics[]` | `string` | N | HIGH_TECH_RETIRED/SLEEPING/AWARD_WINNING/FIVE_STAR/OPEN_LICENSE | 挂牌主题 |
| `items[].lastMessagePreview` | `string` | N | - | 最近消息预览 |
| `items[].lastMessageAt` | `string` | Y | - | 最近消息时间 |
| `items[].unreadCount` | `integer` | Y | - | 未读数量 |
| `items[].counterpart` | `ref:UserBrief` | Y | - | 对方 |
| `items[].counterpart` | `object` | Y | - | 对方 |
| `items[].counterpart.id` | `ref:Uuid` | Y | - | ID |
| `items[].counterpart.id` | `string` | Y | - | ID |
| `items[].counterpart.nickname` | `string` | N | - | 昵称 |
| `items[].counterpart.avatarUrl` | `string` | N | - | 头像链接 |
| `items[].counterpart.role` | `ref:UserRole` | N | - | 角色 |
| `items[].counterpart.role` | `string` | N | buyer/seller/cs/admin | 角色 |
| `items[].counterpart.verificationStatus` | `ref:VerificationStatus` | N | - | 认证状态 |
| `items[].counterpart.verificationStatus` | `string` | N | PENDING/APPROVED/REJECTED | 认证状态 |
| `items[].counterpart.verificationType` | `ref:VerificationType` | N | - | 认证类型 |
| `items[].counterpart.verificationType` | `string` | N | PERSON/COMPANY/ACADEMY/GOVERNMENT/ASSOCIATION/TECH_MANAGER | 认证类型 |
| `items[].counterpart.orgCategory` | `ref:SupplyType` | N | - | 机构分类 |
| `items[].counterpart.orgCategory` | `string` | N | UNIVERSITY/UNIVERSITY_985/UNIVERSITY_211/RESEARCH_INSTITUTE/OTHER | 机构分类 |
| `items[].assignedAgentUserIds` | `array<ref:Uuid>` | N | - | 已分配坐席用户ID |
| `items[].assignedAgentUserIds[]` | `ref:Uuid` | N | - | 已分配坐席用户ID |
| `items[].assignedAgentUserIds[]` | `string` | N | - | 已分配坐席用户ID |
| `page` | `ref:PageMeta` | Y | - | 页码 |
| `page` | `object` | Y | - | 页码 |
| `page.page` | `integer` | Y | - | 页码 |
| `page.pageSize` | `integer` | Y | - | 页码大小 |
| `page.total` | `integer` | Y | - | 总 |

### 5.172 `PagedInventorRanking`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:InventorRankingItem>` | Y | - | 条目 |
| `items[]` | `ref:InventorRankingItem` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].inventorName` | `string` | Y | - | 发明人名称 |
| `items[].patentCount` | `integer` | Y | - | 专利数量 |
| `items[].listingCount` | `integer` | Y | - | 挂牌数量 |
| `items[].avatarUrl` | `string` | N | - | 头像链接 |
| `page` | `ref:PageMeta` | Y | - | 页码 |
| `page` | `object` | Y | - | 页码 |
| `page.page` | `integer` | Y | - | 页码 |
| `page.pageSize` | `integer` | Y | - | 页码大小 |
| `page.total` | `integer` | Y | - | 总 |

### 5.173 `PagedInvoiceItem`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:InvoiceItem>` | Y | - | 条目 |
| `items[]` | `ref:InvoiceItem` | N | - | 条目 |
| `items[]` | `ref:Order` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `ref:Uuid` | Y | - | ID |
| `items[].id` | `string` | Y | - | ID |
| `items[].listingId` | `ref:Uuid` | N | - | 挂牌ID |
| `items[].listingId` | `string` | N | - | 挂牌ID |
| `items[].patentId` | `ref:Uuid` | N | - | 专利ID |
| `items[].patentId` | `string` | N | - | 专利ID |
| `items[].buyerUserId` | `ref:Uuid` | Y | - | 买方用户ID |
| `items[].buyerUserId` | `string` | Y | - | 买方用户ID |
| `items[].sellerUserId` | `ref:Uuid` | N | - | 卖方用户ID |
| `items[].sellerUserId` | `string` | N | - | 卖方用户ID |
| `items[].assignedCsUserId` | `ref:Uuid` | N | - | 已分配客服用户ID |
| `items[].assignedCsUserId` | `string` | N | - | 已分配客服用户ID |
| `items[].status` | `ref:OrderStatus` | Y | - | 状态 |
| `items[].status` | `string` | Y | DEPOSIT_PENDING/DEPOSIT_PAID/WAIT_FINAL_PAYMENT/FINAL_PAID_ESCROW/READY_TO_SETTLE/COMPLETED/CANCELLED/REFUNDING/REFUNDED | 状态 |
| `items[].dealAmountFen` | `ref:MoneyFen` | N | - | 成交金额分 |
| `items[].dealAmountFen` | `integer` | N | - | 成交金额分 |
| `items[].depositAmountFen` | `ref:MoneyFen` | Y | - | 订金金额分 |
| `items[].depositAmountFen` | `integer` | Y | - | 订金金额分 |
| `items[].finalAmountFen` | `ref:MoneyFen` | N | - | 尾款金额分 |
| `items[].finalAmountFen` | `integer` | N | - | 尾款金额分 |
| `items[].commissionAmountFen` | `ref:MoneyFen` | N | - | 佣金金额分 |
| `items[].commissionAmountFen` | `integer` | N | - | 佣金金额分 |
| `items[].invoice` | `ref:OrderInvoice` | N | - | 发票 |
| `items[].invoice` | `object` | N | - | 发票 |
| `items[].invoice.orderId` | `ref:Uuid` | Y | - | 订单ID |
| `items[].invoice.orderId` | `string` | Y | - | 订单ID |
| `items[].invoice.amountFen` | `ref:MoneyFen` | N | - | 金额分 |
| `items[].invoice.amountFen` | `integer` | N | - | 金额分 |
| `items[].invoice.itemName` | `string` | N | - | 条目名称 |
| `items[].invoice.invoiceNo` | `string` | N | - | 发票编号 |
| `items[].invoice.issuedAt` | `string` | N | - | 发放时间 |
| `items[].invoice.invoiceFile` | `ref:FileObject` | Y | - | 发票文件 |
| `items[].invoice.invoiceFile` | `object` | Y | - | 发票文件 |
| `items[].invoice.invoiceFile.id` | `ref:Uuid` | Y | - | ID |
| `items[].invoice.invoiceFile.id` | `string` | Y | - | ID |
| `items[].invoice.invoiceFile.url` | `string` | Y | - | 链接 |
| `items[].invoice.invoiceFile.fileName` | `string` | N | - | 文件名称 |
| `items[].invoice.invoiceFile.mimeType` | `string` | Y | - | 媒体类型 |
| `items[].invoice.invoiceFile.sizeBytes` | `integer` | Y | - | 大小字节 |
| `items[].invoice.invoiceFile.createdAt` | `string` | Y | - | 创建时间 |
| `items[].invoice.attachedAt` | `string` | N | - | 附加时间 |
| `items[].invoice.updatedAt` | `string` | N | - | 更新时间 |
| `items[].createdAt` | `string` | Y | - | 创建时间 |
| `items[].updatedAt` | `string` | N | - | 更新时间 |
| `items[].invoiceStatus` | `ref:InvoiceStatus` | Y | - | 发票状态 |
| `items[].invoiceStatus` | `string` | Y | WAIT_APPLY/APPLYING/ISSUED | 发票状态 |
| `items[].amountFen` | `ref:MoneyFen` | N | - | 金额分 |
| `items[].amountFen` | `integer` | N | - | 金额分 |
| `items[].itemName` | `string` | N | - | 条目名称 |
| `items[].invoiceNo` | `string` | N | - | 发票编号 |
| `items[].issuedAt` | `string` | N | - | 发放时间 |
| `items[].invoiceFileUrl` | `string` | N | - | 发票文件链接 |
| `items[].requestedAt` | `string` | N | - | 请求时间 |
| `page` | `ref:PageMeta` | Y | - | 页码 |
| `page` | `object` | Y | - | 页码 |
| `page.page` | `integer` | Y | - | 页码 |
| `page.pageSize` | `integer` | Y | - | 页码大小 |
| `page.total` | `integer` | Y | - | 总 |

### 5.174 `PagedListing`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:Listing>` | Y | - | 条目 |
| `items[]` | `ref:Listing` | N | - | 条目 |
| `items[]` | `ref:ListingSummary` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `ref:Uuid` | Y | - | ID |
| `items[].id` | `string` | Y | - | ID |
| `items[].patentId` | `ref:Uuid` | N | - | 专利ID |
| `items[].patentId` | `string` | N | - | 专利ID |
| `items[].source` | `ref:ContentSource` | N | - | 来源 |
| `items[].source` | `string` | N | USER/PLATFORM/ADMIN | 来源 |
| `items[].applicationNoDisplay` | `string` | N | - | 申请编号显示 |
| `items[].publicationNoDisplay` | `string` | N | - | 公开编号显示 |
| `items[].patentNoDisplay` | `string` | N | - | 专利编号显示 |
| `items[].grantPublicationNoDisplay` | `string` | N | - | 授权公开编号显示 |
| `items[].patentType` | `ref:PatentType` | N | - | 专利类型 |
| `items[].patentType` | `string` | N | INVENTION/UTILITY_MODEL/DESIGN | 专利类型 |
| `items[].patentTypeDefinition` | `string` | N | - | 专利类型定义 |
| `items[].patentTypeDefinitionSource` | `string` | N | - | 专利类型定义来源 |
| `items[].patentTermYears` | `integer` | N | - | 专利期限年 |
| `items[].title` | `string` | Y | - | 标题 |
| `items[].inventorNames` | `array<string>` | N | - | 发明人名称 |
| `items[].inventorNames[]` | `string` | N | - | 发明人名称 |
| `items[].assigneeNames` | `array<string>` | N | - | 受让方名称 |
| `items[].assigneeNames[]` | `string` | N | - | 受让方名称 |
| `items[].applicantNames` | `array<string>` | N | - | 申请人名称 |
| `items[].applicantNames[]` | `string` | N | - | 申请人名称 |
| `items[].filingDate` | `string` | N | - | 申请日期 |
| `items[].publicationDate` | `string` | N | - | 公开日期 |
| `items[].grantDate` | `string` | N | - | 授权日期 |
| `items[].legalStatus` | `ref:LegalStatus` | N | - | 法律状态 |
| `items[].legalStatus` | `string` | N | PENDING/GRANTED/EXPIRED/INVALIDATED/UNKNOWN | 法律状态 |
| `items[].tradeMode` | `ref:TradeMode` | Y | - | 交易模式 |
| `items[].tradeMode` | `string` | Y | ASSIGNMENT/LICENSE | 交易模式 |
| `items[].licenseMode` | `ref:LicenseMode` | N | - | 许可模式 |
| `items[].licenseMode` | `string` | N | EXCLUSIVE/SOLE/NON_EXCLUSIVE | 许可模式 |
| `items[].priceType` | `ref:PriceType` | Y | - | 价格类型 |
| `items[].priceType` | `string` | Y | FIXED/NEGOTIABLE | 价格类型 |
| `items[].priceAmountFen` | `ref:MoneyFen` | N | - | 价格金额分 |
| `items[].priceAmountFen` | `integer` | N | - | 价格金额分 |
| `items[].depositAmountFen` | `ref:MoneyFen` | Y | - | 订金金额分 |
| `items[].depositAmountFen` | `integer` | Y | - | 订金金额分 |
| `items[].regionCode` | `string` | N | - | 地区编码 |
| `items[].industryTags` | `array<string>` | N | - | 行业标签 |
| `items[].industryTags[]` | `string` | N | - | 行业标签 |
| `items[].listingTopics` | `array<ref:ListingTopic>` | N | - | 挂牌主题 |
| `items[].listingTopics[]` | `ref:ListingTopic` | N | - | 挂牌主题 |
| `items[].listingTopics[]` | `string` | N | HIGH_TECH_RETIRED/SLEEPING/AWARD_WINNING/FIVE_STAR/OPEN_LICENSE | 挂牌主题 |
| `items[].consultationRouting` | `ref:ConsultationRouting` | N | - | 咨询路由 |
| `items[].consultationRouting` | `string` | N | PLATFORM/OWNER | 咨询路由 |
| `items[].featuredLevel` | `ref:FeaturedLevel` | N | - | 推荐级别 |
| `items[].featuredLevel` | `string` | N | NONE/CITY/PROVINCE | 推荐级别 |
| `items[].featuredRegionCode` | `string` | N | - | 推荐地区编码 |
| `items[].featuredRank` | `integer` | N | - | 推荐排名 |
| `items[].featuredUntil` | `string` | N | - | 推荐截止 |
| `items[].stats` | `ref:ListingStats` | N | - | 统计 |
| `items[].stats` | `object` | N | - | 统计 |
| `items[].stats.viewCount` | `integer` | Y | - | 浏览数量 |
| `items[].stats.favoriteCount` | `integer` | Y | - | 收藏数量 |
| `items[].stats.consultCount` | `integer` | Y | - | 咨询数量 |
| `items[].stats.commentCount` | `integer` | N | - | 评论数量 |
| `items[].transferCount` | `integer` | N | - | 转让数量 |
| `items[].recommendationScore` | `number` | N | - | 推荐分值 |
| `items[].auditStatus` | `ref:AuditStatus` | Y | - | 审计状态 |
| `items[].auditStatus` | `string` | Y | PENDING/APPROVED/REJECTED | 审计状态 |
| `items[].status` | `ref:ListingStatus` | Y | - | 状态 |
| `items[].status` | `string` | Y | DRAFT/ACTIVE/OFF_SHELF/SOLD | 状态 |
| `items[].coverUrl` | `string` | N | - | 封面链接 |
| `items[].createdAt` | `string` | Y | - | 创建时间 |
| `items[].updatedAt` | `string` | Y | - | 更新时间 |
| `items[].sellerUserId` | `ref:Uuid` | N | - | 卖方用户ID |
| `items[].sellerUserId` | `string` | N | - | 卖方用户ID |
| `items[].summary` | `string` | N | - | 摘要 |
| `items[].deliverables` | `array<string>` | N | - | 交付物 |
| `items[].deliverables[]` | `string` | N | - | 交付物 |
| `items[].expectedCompletionDays` | `integer` | N | - | 预计完成天 |
| `items[].negotiableRangeFen` | `ref:MoneyFen` | N | - | 可议价范围分 |
| `items[].negotiableRangeFen` | `integer` | N | - | 可议价范围分 |
| `items[].negotiableRangePercent` | `number` | N | - | 可议价范围百分比 |
| `items[].negotiableNote` | `string` | N | - | 可议价备注 |
| `items[].pledgeStatus` | `ref:PledgeStatus` | N | - | 质押状态 |
| `items[].pledgeStatus` | `string` | N | NONE/PLEDGED/UNKNOWN | 质押状态 |
| `items[].existingLicenseStatus` | `ref:ExistingLicenseStatus` | N | - | 既有许可状态 |
| `items[].existingLicenseStatus` | `string` | N | NONE/EXCLUSIVE/SOLE/NON_EXCLUSIVE/UNKNOWN | 既有许可状态 |
| `items[].encumbranceNote` | `string` | N | - | 权利负担备注 |
| `items[].ipcCodes` | `array<string>` | N | - | IPC编码 |
| `items[].ipcCodes[]` | `string` | N | - | IPC编码 |
| `items[].locCodes` | `array<string>` | N | - | 位置编码 |
| `items[].locCodes[]` | `string` | N | - | 位置编码 |
| `items[].media` | `array<ref:ListingMedia>` | N | - | 媒体 |
| `items[].media[]` | `ref:ListingMedia` | N | - | 媒体 |
| `items[].media[]` | `object` | N | - | 媒体 |
| `items[].media[].fileId` | `ref:Uuid` | Y | - | 文件ID |
| `items[].media[].fileId` | `string` | Y | - | 文件ID |
| `items[].media[].type` | `string` | Y | IMAGE/FILE | 类型 |
| `items[].media[].sort` | `integer` | Y | - | 排序 |
| `items[].aiParse` | `ref:AiParseResult` | N | - | 智能解析 |
| `items[].aiParse` | `object` | N | - | 智能解析 |
| `items[].aiParse.id` | `ref:Uuid` | Y | - | ID |
| `items[].aiParse.id` | `string` | Y | - | ID |
| `items[].aiParse.contentType` | `ref:AiContentType` | Y | - | 内容类型 |
| `items[].aiParse.contentType` | `string` | Y | LISTING | 内容类型 |
| `items[].aiParse.contentId` | `ref:Uuid` | Y | - | 内容ID |
| `items[].aiParse.contentId` | `string` | Y | - | 内容ID |
| `items[].aiParse.summaryPlain` | `string` | N | - | 摘要纯文本 |
| `items[].aiParse.featuresPlain` | `string` | N | - | 特征纯文本 |
| `items[].aiParse.keywords` | `array<string>` | N | - | 关键词 |
| `items[].aiParse.keywords[]` | `string` | N | - | 关键词 |
| `items[].aiParse.confidence` | `number` | Y | - | 置信度 |
| `items[].aiParse.modelVersion` | `string` | N | - | 模型版本 |
| `items[].aiParse.status` | `ref:AiParseStatus` | Y | - | 状态 |
| `items[].aiParse.status` | `string` | Y | ACTIVE/REVIEW_REQUIRED/REPLACED | 状态 |
| `items[].aiParse.createdAt` | `string` | Y | - | 创建时间 |
| `items[].aiParse.updatedAt` | `string` | N | - | 更新时间 |
| `items[].proofFileIds` | `array<ref:Uuid>` | N | - | 凭证文件ID |
| `items[].proofFileIds[]` | `ref:Uuid` | N | - | 凭证文件ID |
| `items[].proofFileIds[]` | `string` | N | - | 凭证文件ID |
| `page` | `ref:PageMeta` | Y | - | 页码 |
| `page` | `object` | Y | - | 页码 |
| `page.page` | `integer` | Y | - | 页码 |
| `page.pageSize` | `integer` | Y | - | 页码大小 |
| `page.total` | `integer` | Y | - | 总 |

### 5.175 `PagedListingBatchJob`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:ListingBatchJob>` | Y | - | 条目 |
| `items[]` | `ref:ListingBatchJob` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `ref:Uuid` | Y | - | ID |
| `items[].id` | `string` | Y | - | ID |
| `items[].operatorUserId` | `ref:Uuid` | Y | - | 操作人用户ID |
| `items[].operatorUserId` | `string` | Y | - | 操作人用户ID |
| `items[].action` | `ref:ListingBatchAction` | Y | - | 操作 |
| `items[].action` | `string` | Y | APPROVE/REJECT/PUBLISH/OFF_SHELF | 操作 |
| `items[].reason` | `string` | N | - | 原因 |
| `items[].status` | `ref:ListingJobStatus` | Y | - | 状态 |
| `items[].status` | `string` | Y | PENDING/RUNNING/PAUSED/SUCCEEDED/FAILED | 状态 |
| `items[].totalCount` | `integer` | Y | - | 总数量 |
| `items[].successCount` | `integer` | Y | - | 成功数量 |
| `items[].failedCount` | `integer` | Y | - | 失败数量 |
| `items[].skippedCount` | `integer` | Y | - | 跳过数量 |
| `items[].failRate` | `number` | Y | - | 失败费率 |
| `items[].startedAt` | `string` | N | - | 开始时间 |
| `items[].finishedAt` | `string` | N | - | 完成时间 |
| `items[].pausedAt` | `string` | N | - | 暂停时间 |
| `items[].errorFileId` | `ref:Uuid` | N | - | 错误文件ID |
| `items[].errorFileId` | `string` | N | - | 错误文件ID |
| `items[].createdAt` | `string` | Y | - | 创建时间 |
| `items[].updatedAt` | `string` | Y | - | 更新时间 |
| `page` | `ref:PageMeta` | Y | - | 页码 |
| `page` | `object` | Y | - | 页码 |
| `page.page` | `integer` | Y | - | 页码 |
| `page.pageSize` | `integer` | Y | - | 页码大小 |
| `page.total` | `integer` | Y | - | 总 |

### 5.176 `PagedListingBatchJobItem`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:ListingBatchJobItem>` | Y | - | 条目 |
| `items[]` | `ref:ListingBatchJobItem` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `ref:Uuid` | Y | - | ID |
| `items[].id` | `string` | Y | - | ID |
| `items[].jobId` | `ref:Uuid` | Y | - | 任务ID |
| `items[].jobId` | `string` | Y | - | 任务ID |
| `items[].listingId` | `ref:Uuid` | Y | - | 挂牌ID |
| `items[].listingId` | `string` | Y | - | 挂牌ID |
| `items[].status` | `ref:ListingBatchItemStatus` | Y | - | 状态 |
| `items[].status` | `string` | Y | PENDING/SUCCEEDED/FAILED/SKIPPED | 状态 |
| `items[].errorCode` | `string` | N | - | 错误编码 |
| `items[].errorMessage` | `string` | N | - | 错误消息 |
| `items[].processedAt` | `string` | N | - | 处理时间 |
| `items[].createdAt` | `string` | Y | - | 创建时间 |
| `items[].updatedAt` | `string` | Y | - | 更新时间 |
| `page` | `ref:PageMeta` | Y | - | 页码 |
| `page` | `object` | Y | - | 页码 |
| `page.page` | `integer` | Y | - | 页码 |
| `page.pageSize` | `integer` | Y | - | 页码大小 |
| `page.total` | `integer` | Y | - | 总 |

### 5.177 `PagedListingImportJob`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:ListingImportJob>` | Y | - | 条目 |
| `items[]` | `ref:ListingImportJob` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `ref:Uuid` | Y | - | ID |
| `items[].id` | `string` | Y | - | ID |
| `items[].operatorUserId` | `ref:Uuid` | Y | - | 操作人用户ID |
| `items[].operatorUserId` | `string` | Y | - | 操作人用户ID |
| `items[].fileId` | `ref:Uuid` | Y | - | 文件ID |
| `items[].fileId` | `string` | Y | - | 文件ID |
| `items[].duplicatePolicy` | `ref:ListingImportDuplicatePolicy` | Y | - | 重复策略 |
| `items[].duplicatePolicy` | `string` | Y | SKIP/OVERWRITE | 重复策略 |
| `items[].defaults` | `ref:ListingImportDefaults` | N | - | 默认 |
| `items[].defaults` | `object` | N | - | 默认 |
| `items[].defaults.sellerUserId` | `ref:Uuid` | N | - | 卖方用户ID |
| `items[].defaults.sellerUserId` | `string` | N | - | 卖方用户ID |
| `items[].defaults.consultationRouting` | `ref:ConsultationRouting` | N | - | 咨询路由 |
| `items[].defaults.consultationRouting` | `string` | N | PLATFORM/OWNER | 咨询路由 |
| `items[].defaults.source` | `ref:ContentSource` | N | - | 来源 |
| `items[].defaults.source` | `string` | N | USER/PLATFORM/ADMIN | 来源 |
| `items[].defaults.tradeMode` | `ref:TradeMode` | N | - | 交易模式 |
| `items[].defaults.tradeMode` | `string` | N | ASSIGNMENT/LICENSE | 交易模式 |
| `items[].defaults.licenseMode` | `ref:LicenseMode` | N | - | 许可模式 |
| `items[].defaults.licenseMode` | `string` | N | EXCLUSIVE/SOLE/NON_EXCLUSIVE | 许可模式 |
| `items[].defaults.priceType` | `ref:PriceType` | N | - | 价格类型 |
| `items[].defaults.priceType` | `string` | N | FIXED/NEGOTIABLE | 价格类型 |
| `items[].defaults.priceAmountFen` | `ref:MoneyFen` | N | - | 价格金额分 |
| `items[].defaults.priceAmountFen` | `integer` | N | - | 价格金额分 |
| `items[].defaults.depositAmountFen` | `ref:MoneyFen` | N | - | 订金金额分 |
| `items[].defaults.depositAmountFen` | `integer` | N | - | 订金金额分 |
| `items[].defaults.regionCode` | `string` | N | - | 地区编码 |
| `items[].defaults.listingTopics` | `array<ref:ListingTopic>` | N | - | 挂牌主题 |
| `items[].defaults.listingTopics[]` | `ref:ListingTopic` | N | - | 挂牌主题 |
| `items[].defaults.listingTopics[]` | `string` | N | HIGH_TECH_RETIRED/SLEEPING/AWARD_WINNING/FIVE_STAR/OPEN_LICENSE | 挂牌主题 |
| `items[].defaults.industryTags` | `array<string>` | N | - | 行业标签 |
| `items[].defaults.industryTags[]` | `string` | N | - | 行业标签 |
| `items[].defaults.status` | `ref:ListingStatus` | N | - | 状态 |
| `items[].defaults.status` | `string` | N | DRAFT/ACTIVE/OFF_SHELF/SOLD | 状态 |
| `items[].defaults.auditStatus` | `ref:AuditStatus` | N | - | 审计状态 |
| `items[].defaults.auditStatus` | `string` | N | PENDING/APPROVED/REJECTED | 审计状态 |
| `items[].status` | `ref:ListingJobStatus` | Y | - | 状态 |
| `items[].status` | `string` | Y | PENDING/RUNNING/PAUSED/SUCCEEDED/FAILED | 状态 |
| `items[].totalCount` | `integer` | Y | - | 总数量 |
| `items[].validCount` | `integer` | Y | - | 有效数量 |
| `items[].invalidCount` | `integer` | Y | - | 无效数量 |
| `items[].successCount` | `integer` | Y | - | 成功数量 |
| `items[].failedCount` | `integer` | Y | - | 失败数量 |
| `items[].skippedCount` | `integer` | Y | - | 跳过数量 |
| `items[].failRate` | `number` | Y | - | 失败费率 |
| `items[].validatedAt` | `string` | N | - | 已校验时间 |
| `items[].startedAt` | `string` | N | - | 开始时间 |
| `items[].finishedAt` | `string` | N | - | 完成时间 |
| `items[].pausedAt` | `string` | N | - | 暂停时间 |
| `items[].errorFileId` | `ref:Uuid` | N | - | 错误文件ID |
| `items[].errorFileId` | `string` | N | - | 错误文件ID |
| `items[].createdAt` | `string` | Y | - | 创建时间 |
| `items[].updatedAt` | `string` | Y | - | 更新时间 |
| `page` | `ref:PageMeta` | Y | - | 页码 |
| `page` | `object` | Y | - | 页码 |
| `page.page` | `integer` | Y | - | 页码 |
| `page.pageSize` | `integer` | Y | - | 页码大小 |
| `page.total` | `integer` | Y | - | 总 |

### 5.178 `PagedListingImportJobRow`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:ListingImportJobRow>` | Y | - | 条目 |
| `items[]` | `ref:ListingImportJobRow` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `ref:Uuid` | Y | - | ID |
| `items[].id` | `string` | Y | - | ID |
| `items[].jobId` | `ref:Uuid` | Y | - | 任务ID |
| `items[].jobId` | `string` | Y | - | 任务ID |
| `items[].rowNo` | `integer` | Y | - | 行编号 |
| `items[].status` | `ref:ListingImportRowStatus` | Y | - | 状态 |
| `items[].status` | `string` | Y | PENDING/VALID/INVALID/SUCCEEDED/FAILED/SKIPPED | 状态 |
| `items[].raw` | `object` | N | - | 原始 |
| `items[].normalized` | `object` | N | - | 规范化 |
| `items[].listingId` | `ref:Uuid` | N | - | 挂牌ID |
| `items[].listingId` | `string` | N | - | 挂牌ID |
| `items[].errorCode` | `string` | N | - | 错误编码 |
| `items[].errorMessage` | `string` | N | - | 错误消息 |
| `items[].processedAt` | `string` | N | - | 处理时间 |
| `items[].createdAt` | `string` | Y | - | 创建时间 |
| `items[].updatedAt` | `string` | Y | - | 更新时间 |
| `page` | `ref:PageMeta` | Y | - | 页码 |
| `page` | `object` | Y | - | 页码 |
| `page.page` | `integer` | Y | - | 页码 |
| `page.pageSize` | `integer` | Y | - | 页码大小 |
| `page.total` | `integer` | Y | - | 总 |

### 5.179 `PagedListingSummary`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:ListingSummary>` | Y | - | 条目 |
| `items[]` | `ref:ListingSummary` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `ref:Uuid` | Y | - | ID |
| `items[].id` | `string` | Y | - | ID |
| `items[].patentId` | `ref:Uuid` | N | - | 专利ID |
| `items[].patentId` | `string` | N | - | 专利ID |
| `items[].source` | `ref:ContentSource` | N | - | 来源 |
| `items[].source` | `string` | N | USER/PLATFORM/ADMIN | 来源 |
| `items[].applicationNoDisplay` | `string` | N | - | 申请编号显示 |
| `items[].publicationNoDisplay` | `string` | N | - | 公开编号显示 |
| `items[].patentNoDisplay` | `string` | N | - | 专利编号显示 |
| `items[].grantPublicationNoDisplay` | `string` | N | - | 授权公开编号显示 |
| `items[].patentType` | `ref:PatentType` | N | - | 专利类型 |
| `items[].patentType` | `string` | N | INVENTION/UTILITY_MODEL/DESIGN | 专利类型 |
| `items[].patentTypeDefinition` | `string` | N | - | 专利类型定义 |
| `items[].patentTypeDefinitionSource` | `string` | N | - | 专利类型定义来源 |
| `items[].patentTermYears` | `integer` | N | - | 专利期限年 |
| `items[].title` | `string` | Y | - | 标题 |
| `items[].inventorNames` | `array<string>` | N | - | 发明人名称 |
| `items[].inventorNames[]` | `string` | N | - | 发明人名称 |
| `items[].assigneeNames` | `array<string>` | N | - | 受让方名称 |
| `items[].assigneeNames[]` | `string` | N | - | 受让方名称 |
| `items[].applicantNames` | `array<string>` | N | - | 申请人名称 |
| `items[].applicantNames[]` | `string` | N | - | 申请人名称 |
| `items[].filingDate` | `string` | N | - | 申请日期 |
| `items[].publicationDate` | `string` | N | - | 公开日期 |
| `items[].grantDate` | `string` | N | - | 授权日期 |
| `items[].legalStatus` | `ref:LegalStatus` | N | - | 法律状态 |
| `items[].legalStatus` | `string` | N | PENDING/GRANTED/EXPIRED/INVALIDATED/UNKNOWN | 法律状态 |
| `items[].tradeMode` | `ref:TradeMode` | Y | - | 交易模式 |
| `items[].tradeMode` | `string` | Y | ASSIGNMENT/LICENSE | 交易模式 |
| `items[].licenseMode` | `ref:LicenseMode` | N | - | 许可模式 |
| `items[].licenseMode` | `string` | N | EXCLUSIVE/SOLE/NON_EXCLUSIVE | 许可模式 |
| `items[].priceType` | `ref:PriceType` | Y | - | 价格类型 |
| `items[].priceType` | `string` | Y | FIXED/NEGOTIABLE | 价格类型 |
| `items[].priceAmountFen` | `ref:MoneyFen` | N | - | 价格金额分 |
| `items[].priceAmountFen` | `integer` | N | - | 价格金额分 |
| `items[].depositAmountFen` | `ref:MoneyFen` | Y | - | 订金金额分 |
| `items[].depositAmountFen` | `integer` | Y | - | 订金金额分 |
| `items[].regionCode` | `string` | N | - | 地区编码 |
| `items[].industryTags` | `array<string>` | N | - | 行业标签 |
| `items[].industryTags[]` | `string` | N | - | 行业标签 |
| `items[].listingTopics` | `array<ref:ListingTopic>` | N | - | 挂牌主题 |
| `items[].listingTopics[]` | `ref:ListingTopic` | N | - | 挂牌主题 |
| `items[].listingTopics[]` | `string` | N | HIGH_TECH_RETIRED/SLEEPING/AWARD_WINNING/FIVE_STAR/OPEN_LICENSE | 挂牌主题 |
| `items[].consultationRouting` | `ref:ConsultationRouting` | N | - | 咨询路由 |
| `items[].consultationRouting` | `string` | N | PLATFORM/OWNER | 咨询路由 |
| `items[].featuredLevel` | `ref:FeaturedLevel` | N | - | 推荐级别 |
| `items[].featuredLevel` | `string` | N | NONE/CITY/PROVINCE | 推荐级别 |
| `items[].featuredRegionCode` | `string` | N | - | 推荐地区编码 |
| `items[].featuredRank` | `integer` | N | - | 推荐排名 |
| `items[].featuredUntil` | `string` | N | - | 推荐截止 |
| `items[].stats` | `ref:ListingStats` | N | - | 统计 |
| `items[].stats` | `object` | N | - | 统计 |
| `items[].stats.viewCount` | `integer` | Y | - | 浏览数量 |
| `items[].stats.favoriteCount` | `integer` | Y | - | 收藏数量 |
| `items[].stats.consultCount` | `integer` | Y | - | 咨询数量 |
| `items[].stats.commentCount` | `integer` | N | - | 评论数量 |
| `items[].transferCount` | `integer` | N | - | 转让数量 |
| `items[].recommendationScore` | `number` | N | - | 推荐分值 |
| `items[].auditStatus` | `ref:AuditStatus` | Y | - | 审计状态 |
| `items[].auditStatus` | `string` | Y | PENDING/APPROVED/REJECTED | 审计状态 |
| `items[].status` | `ref:ListingStatus` | Y | - | 状态 |
| `items[].status` | `string` | Y | DRAFT/ACTIVE/OFF_SHELF/SOLD | 状态 |
| `items[].coverUrl` | `string` | N | - | 封面链接 |
| `items[].createdAt` | `string` | Y | - | 创建时间 |
| `items[].updatedAt` | `string` | Y | - | 更新时间 |
| `page` | `ref:PageMeta` | Y | - | 页码 |
| `page` | `object` | Y | - | 页码 |
| `page.page` | `integer` | Y | - | 页码 |
| `page.pageSize` | `integer` | Y | - | 页码大小 |
| `page.total` | `integer` | Y | - | 总 |

### 5.180 `PagedMyPatentMaintenanceOrder`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:PatentMaintenanceOrder>` | Y | - | 条目 |
| `items[]` | `ref:PatentMaintenanceOrder` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `ref:Uuid` | Y | - | ID |
| `items[].id` | `string` | Y | - | ID |
| `items[].scheduleId` | `ref:Uuid` | Y | - | 日程ID |
| `items[].scheduleId` | `string` | Y | - | 日程ID |
| `items[].applicantUserId` | `ref:Uuid` | Y | - | 申请人用户ID |
| `items[].applicantUserId` | `string` | Y | - | 申请人用户ID |
| `items[].assignedCsUserId` | `ref:Uuid` | N | - | 已分配客服用户ID |
| `items[].assignedCsUserId` | `string` | N | - | 已分配客服用户ID |
| `items[].status` | `ref:PatentMaintenanceOrderStatus` | Y | - | 状态 |
| `items[].status` | `string` | Y | REQUESTED/QUOTED/AWAITING_PAYMENT/PAID/EXECUTING/RECEIPT_UPLOADED/RECONCILED/CLOSED/CANCELLED | 状态 |
| `items[].paymentChannel` | `ref:PatentMaintenancePaymentChannel` | N | - | 支付渠道 |
| `items[].paymentChannel` | `string` | N | WECHAT/OFFLINE_BANK/OFFLINE_OTHER | 支付渠道 |
| `items[].officialFeeFen` | `integer` | Y | - | 官方费用分 |
| `items[].lateFeeFen` | `integer` | Y | - | 延迟费用分 |
| `items[].serviceFeeFen` | `integer` | Y | - | 服务费用分 |
| `items[].totalAmountFen` | `integer` | Y | - | 总金额分 |
| `items[].paymentDeadline` | `string` | N | - | 支付截止时间 |
| `items[].paidAt` | `string` | N | - | 已支付时间 |
| `items[].executedAt` | `string` | N | - | 执行时间 |
| `items[].receiptIssuedAt` | `string` | N | - | 回执发放时间 |
| `items[].officialSubmissionNo` | `string` | N | - | 官方提交编号 |
| `items[].officialReceiptNo` | `string` | N | - | 官方回执编号 |
| `items[].paymentTxnNo` | `string` | N | - | 支付交易编号 |
| `items[].officialReceiptFileId` | `ref:Uuid` | N | - | 官方回执文件ID |
| `items[].officialReceiptFileId` | `string` | N | - | 官方回执文件ID |
| `items[].reconcileStatus` | `ref:PatentMaintenanceReconcileStatus` | Y | - | 对账状态 |
| `items[].reconcileStatus` | `string` | Y | PENDING/MATCHED/MISMATCHED | 对账状态 |
| `items[].reconcileNote` | `string` | N | - | 对账备注 |
| `items[].closeNote` | `string` | N | - | 关闭备注 |
| `items[].patentId` | `ref:Uuid` | N | - | 专利ID |
| `items[].patentId` | `string` | N | - | 专利ID |
| `items[].patentTitle` | `string` | N | - | 专利标题 |
| `items[].applicationNoDisplay` | `string` | N | - | 申请编号显示 |
| `items[].scheduleYearNo` | `integer` | N | - | 日程年编号 |
| `items[].scheduleDueDate` | `string` | N | - | 日程到期日期 |
| `items[].canContactSupport` | `boolean` | N | - | 可联系客服 |
| `items[].createdAt` | `string` | Y | - | 创建时间 |
| `items[].updatedAt` | `string` | N | - | 更新时间 |
| `page` | `ref:PageMeta` | Y | - | 页码 |
| `page` | `object` | Y | - | 页码 |
| `page.page` | `integer` | Y | - | 页码 |
| `page.pageSize` | `integer` | Y | - | 页码大小 |
| `page.total` | `integer` | Y | - | 总 |

### 5.181 `PagedMyPatentMaintenanceSchedule`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:MyPatentMaintenanceSchedule>` | Y | - | 条目 |
| `items[]` | `ref:MyPatentMaintenanceSchedule` | N | - | 条目 |
| `items[]` | `ref:PatentMaintenanceSchedule` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `ref:Uuid` | Y | - | ID |
| `items[].id` | `string` | Y | - | ID |
| `items[].patentId` | `ref:Uuid` | Y | - | 专利ID |
| `items[].patentId` | `string` | Y | - | 专利ID |
| `items[].yearNo` | `integer` | Y | - | 年编号 |
| `items[].dueDate` | `string` | Y | - | 到期日期 |
| `items[].gracePeriodEnd` | `string` | N | - | 宽限期间结束 |
| `items[].status` | `ref:PatentMaintenanceStatus` | Y | - | 状态 |
| `items[].status` | `string` | Y | DUE/PAID/OVERDUE/WAIVED | 状态 |
| `items[].createdAt` | `string` | Y | - | 创建时间 |
| `items[].updatedAt` | `string` | N | - | 更新时间 |
| `items[].patentTitle` | `string` | N | - | 专利标题 |
| `items[].applicationNoDisplay` | `string` | N | - | 申请编号显示 |
| `items[].urgency` | `ref:MaintenanceUrgency` | N | - | 紧急程度 |
| `items[].urgency` | `string` | N | OVERDUE/DUE_SOON/UPCOMING/NORMAL/SETTLED | 紧急程度 |
| `items[].canContactSupport` | `boolean` | N | - | 可联系客服 |
| `page` | `ref:PageMeta` | Y | - | 页码 |
| `page` | `object` | Y | - | 页码 |
| `page.page` | `integer` | Y | - | 页码 |
| `page.pageSize` | `integer` | Y | - | 页码大小 |
| `page.total` | `integer` | Y | - | 总 |

### 5.182 `PagedMyPatentMaintenanceTask`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:MyPatentMaintenanceTask>` | Y | - | 条目 |
| `items[]` | `ref:MyPatentMaintenanceTask` | N | - | 条目 |
| `items[]` | `ref:PatentMaintenanceTask` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `ref:Uuid` | Y | - | ID |
| `items[].id` | `string` | Y | - | ID |
| `items[].scheduleId` | `ref:Uuid` | Y | - | 日程ID |
| `items[].scheduleId` | `string` | Y | - | 日程ID |
| `items[].assignedCsUserId` | `ref:Uuid` | N | - | 已分配客服用户ID |
| `items[].assignedCsUserId` | `string` | N | - | 已分配客服用户ID |
| `items[].status` | `ref:PatentMaintenanceTaskStatus` | Y | - | 状态 |
| `items[].status` | `string` | Y | OPEN/IN_PROGRESS/DONE/CANCELLED | 状态 |
| `items[].note` | `string` | N | - | 备注 |
| `items[].evidenceFileId` | `ref:Uuid` | N | - | 凭证文件ID |
| `items[].evidenceFileId` | `string` | N | - | 凭证文件ID |
| `items[].createdAt` | `string` | Y | - | 创建时间 |
| `items[].updatedAt` | `string` | N | - | 更新时间 |
| `items[].patentId` | `ref:Uuid` | N | - | 专利ID |
| `items[].patentId` | `string` | N | - | 专利ID |
| `items[].patentTitle` | `string` | N | - | 专利标题 |
| `items[].applicationNoDisplay` | `string` | N | - | 申请编号显示 |
| `items[].scheduleYearNo` | `integer` | N | - | 日程年编号 |
| `items[].scheduleDueDate` | `string` | N | - | 日程到期日期 |
| `items[].scheduleStatus` | `ref:PatentMaintenanceStatus` | N | - | 日程状态 |
| `items[].scheduleStatus` | `string` | N | DUE/PAID/OVERDUE/WAIVED | 日程状态 |
| `items[].urgency` | `ref:MaintenanceUrgency` | N | - | 紧急程度 |
| `items[].urgency` | `string` | N | OVERDUE/DUE_SOON/UPCOMING/NORMAL/SETTLED | 紧急程度 |
| `items[].canContactSupport` | `boolean` | N | - | 可联系客服 |
| `page` | `ref:PageMeta` | Y | - | 页码 |
| `page` | `object` | Y | - | 页码 |
| `page.page` | `integer` | Y | - | 页码 |
| `page.pageSize` | `integer` | Y | - | 页码大小 |
| `page.total` | `integer` | Y | - | 总 |

### 5.183 `PagedNotification`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:Notification>` | Y | - | 条目 |
| `items[]` | `ref:Notification` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `ref:Uuid` | Y | - | ID |
| `items[].id` | `string` | Y | - | ID |
| `items[].kind` | `ref:NotificationKind` | Y | - | 类别 |
| `items[].kind` | `string` | Y | system/cs | 类别 |
| `items[].title` | `string` | Y | - | 标题 |
| `items[].summary` | `string` | Y | - | 摘要 |
| `items[].source` | `string` | Y | - | 来源 |
| `items[].time` | `string` | Y | - | 时间 |
| `page` | `ref:PageMeta` | Y | - | 页码 |
| `page` | `object` | Y | - | 页码 |
| `page.page` | `integer` | Y | - | 页码 |
| `page.pageSize` | `integer` | Y | - | 页码大小 |
| `page.total` | `integer` | Y | - | 总 |

### 5.184 `PagedOrder`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:Order>` | Y | - | 条目 |
| `items[]` | `ref:Order` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `ref:Uuid` | Y | - | ID |
| `items[].id` | `string` | Y | - | ID |
| `items[].listingId` | `ref:Uuid` | N | - | 挂牌ID |
| `items[].listingId` | `string` | N | - | 挂牌ID |
| `items[].patentId` | `ref:Uuid` | N | - | 专利ID |
| `items[].patentId` | `string` | N | - | 专利ID |
| `items[].buyerUserId` | `ref:Uuid` | Y | - | 买方用户ID |
| `items[].buyerUserId` | `string` | Y | - | 买方用户ID |
| `items[].sellerUserId` | `ref:Uuid` | N | - | 卖方用户ID |
| `items[].sellerUserId` | `string` | N | - | 卖方用户ID |
| `items[].assignedCsUserId` | `ref:Uuid` | N | - | 已分配客服用户ID |
| `items[].assignedCsUserId` | `string` | N | - | 已分配客服用户ID |
| `items[].status` | `ref:OrderStatus` | Y | - | 状态 |
| `items[].status` | `string` | Y | DEPOSIT_PENDING/DEPOSIT_PAID/WAIT_FINAL_PAYMENT/FINAL_PAID_ESCROW/READY_TO_SETTLE/COMPLETED/CANCELLED/REFUNDING/REFUNDED | 状态 |
| `items[].dealAmountFen` | `ref:MoneyFen` | N | - | 成交金额分 |
| `items[].dealAmountFen` | `integer` | N | - | 成交金额分 |
| `items[].depositAmountFen` | `ref:MoneyFen` | Y | - | 订金金额分 |
| `items[].depositAmountFen` | `integer` | Y | - | 订金金额分 |
| `items[].finalAmountFen` | `ref:MoneyFen` | N | - | 尾款金额分 |
| `items[].finalAmountFen` | `integer` | N | - | 尾款金额分 |
| `items[].commissionAmountFen` | `ref:MoneyFen` | N | - | 佣金金额分 |
| `items[].commissionAmountFen` | `integer` | N | - | 佣金金额分 |
| `items[].invoice` | `ref:OrderInvoice` | N | - | 发票 |
| `items[].invoice` | `object` | N | - | 发票 |
| `items[].invoice.orderId` | `ref:Uuid` | Y | - | 订单ID |
| `items[].invoice.orderId` | `string` | Y | - | 订单ID |
| `items[].invoice.amountFen` | `ref:MoneyFen` | N | - | 金额分 |
| `items[].invoice.amountFen` | `integer` | N | - | 金额分 |
| `items[].invoice.itemName` | `string` | N | - | 条目名称 |
| `items[].invoice.invoiceNo` | `string` | N | - | 发票编号 |
| `items[].invoice.issuedAt` | `string` | N | - | 发放时间 |
| `items[].invoice.invoiceFile` | `ref:FileObject` | Y | - | 发票文件 |
| `items[].invoice.invoiceFile` | `object` | Y | - | 发票文件 |
| `items[].invoice.invoiceFile.id` | `ref:Uuid` | Y | - | ID |
| `items[].invoice.invoiceFile.id` | `string` | Y | - | ID |
| `items[].invoice.invoiceFile.url` | `string` | Y | - | 链接 |
| `items[].invoice.invoiceFile.fileName` | `string` | N | - | 文件名称 |
| `items[].invoice.invoiceFile.mimeType` | `string` | Y | - | 媒体类型 |
| `items[].invoice.invoiceFile.sizeBytes` | `integer` | Y | - | 大小字节 |
| `items[].invoice.invoiceFile.createdAt` | `string` | Y | - | 创建时间 |
| `items[].invoice.attachedAt` | `string` | N | - | 附加时间 |
| `items[].invoice.updatedAt` | `string` | N | - | 更新时间 |
| `items[].createdAt` | `string` | Y | - | 创建时间 |
| `items[].updatedAt` | `string` | N | - | 更新时间 |
| `page` | `ref:PageMeta` | Y | - | 页码 |
| `page` | `object` | Y | - | 页码 |
| `page.page` | `integer` | Y | - | 页码 |
| `page.pageSize` | `integer` | Y | - | 页码大小 |
| `page.total` | `integer` | Y | - | 总 |

### 5.185 `PagedOrganizationSummary`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:OrganizationSummary>` | Y | - | 条目 |
| `items[]` | `ref:OrganizationSummary` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].userId` | `ref:Uuid` | Y | - | 用户ID |
| `items[].userId` | `string` | Y | - | 用户ID |
| `items[].displayName` | `string` | Y | - | 显示名称 |
| `items[].verificationType` | `ref:VerificationType` | Y | - | 认证类型 |
| `items[].verificationType` | `string` | Y | PERSON/COMPANY/ACADEMY/GOVERNMENT/ASSOCIATION/TECH_MANAGER | 认证类型 |
| `items[].verificationStatus` | `ref:VerificationStatus` | Y | - | 认证状态 |
| `items[].verificationStatus` | `string` | Y | PENDING/APPROVED/REJECTED | 认证状态 |
| `items[].orgCategory` | `ref:SupplyType` | N | - | 机构分类 |
| `items[].orgCategory` | `string` | N | UNIVERSITY/UNIVERSITY_985/UNIVERSITY_211/RESEARCH_INSTITUTE/OTHER | 机构分类 |
| `items[].regionCode` | `string` | N | - | 地区编码 |
| `items[].logoUrl` | `string` | N | - | 标识链接 |
| `items[].intro` | `string` | N | - | 简介 |
| `items[].stats` | `ref:OrganizationStats` | N | - | 统计 |
| `items[].stats` | `object` | N | - | 统计 |
| `items[].stats.listingCount` | `integer` | Y | - | 挂牌数量 |
| `items[].stats.patentCount` | `integer` | Y | - | 专利数量 |
| `items[].verifiedAt` | `string` | N | - | 已核验时间 |
| `page` | `ref:PageMeta` | Y | - | 页码 |
| `page` | `object` | Y | - | 页码 |
| `page.page` | `integer` | Y | - | 页码 |
| `page.pageSize` | `integer` | Y | - | 页码大小 |
| `page.total` | `integer` | Y | - | 总 |

### 5.186 `PagedPatent`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:Patent>` | Y | - | 条目 |
| `items[]` | `ref:Patent` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `ref:Uuid` | Y | - | ID |
| `items[].id` | `string` | Y | - | ID |
| `items[].jurisdiction` | `ref:Jurisdiction` | Y | - | 法域 |
| `items[].jurisdiction` | `string` | Y | CN | 法域 |
| `items[].applicationNoNorm` | `string` | Y | - | 申请编号规范 |
| `items[].applicationNoDisplay` | `string` | N | - | 申请编号显示 |
| `items[].patentNoDisplay` | `string` | N | - | 专利编号显示 |
| `items[].publicationNoDisplay` | `string` | N | - | 公开编号显示 |
| `items[].grantPublicationNoDisplay` | `string` | N | - | 授权公开编号显示 |
| `items[].patentType` | `ref:PatentType` | Y | - | 专利类型 |
| `items[].patentType` | `string` | Y | INVENTION/UTILITY_MODEL/DESIGN | 专利类型 |
| `items[].title` | `string` | Y | - | 标题 |
| `items[].abstract` | `string` | N | - | 摘要 |
| `items[].caseStatus` | `string` | N | - | 工单状态 |
| `items[].mainIpcCode` | `string` | N | - | 主IPC编码 |
| `items[].claimCount` | `integer` | N | - | 认领数量 |
| `items[].specPageCount` | `integer` | N | - | 规格页码数量 |
| `items[].specWordCount` | `integer` | N | - | 规格词条数量 |
| `items[].specFigureCount` | `integer` | N | - | 规格图数量 |
| `items[].inventorNames` | `array<string>` | N | - | 发明人名称 |
| `items[].inventorNames[]` | `string` | N | - | 发明人名称 |
| `items[].assigneeNames` | `array<string>` | N | - | 受让方名称 |
| `items[].assigneeNames[]` | `string` | N | - | 受让方名称 |
| `items[].applicantNames` | `array<string>` | N | - | 申请人名称 |
| `items[].applicantNames[]` | `string` | N | - | 申请人名称 |
| `items[].filingDate` | `string` | N | - | 申请日期 |
| `items[].publicationDate` | `string` | N | - | 公开日期 |
| `items[].grantDate` | `string` | N | - | 授权日期 |
| `items[].legalStatus` | `ref:LegalStatus` | N | - | 法律状态 |
| `items[].legalStatus` | `string` | N | PENDING/GRANTED/EXPIRED/INVALIDATED/UNKNOWN | 法律状态 |
| `items[].sourcePrimary` | `string` | N | USER/ADMIN/PROVIDER | 来源主要 |
| `items[].sourceUpdatedAt` | `string` | N | - | 来源更新时间 |
| `items[].ownerUserId` | `ref:Uuid` | N | - | 所有者用户ID |
| `items[].ownerUserId` | `string` | N | - | 所有者用户ID |
| `items[].ownerClaimedAt` | `string` | N | - | 所有者已认领时间 |
| `items[].ownerClaimSource` | `ref:PatentOwnerClaimSource` | N | - | 所有者认领来源 |
| `items[].ownerClaimSource` | `string` | N | PLATFORM_IMPORT/USER_CLAIM/ADMIN_ASSIGN | 所有者认领来源 |
| `items[].media` | `array<ref:PatentMedia>` | N | - | 媒体 |
| `items[].media[]` | `ref:PatentMedia` | N | - | 媒体 |
| `items[].media[]` | `object` | N | - | 媒体 |
| `items[].media[].fileId` | `ref:Uuid` | Y | - | 文件ID |
| `items[].media[].fileId` | `string` | Y | - | 文件ID |
| `items[].media[].url` | `string` | N | - | 链接 |
| `items[].media[].type` | `string` | Y | COVER/SPEC_FIGURE | 类型 |
| `items[].media[].sort` | `integer` | Y | - | 排序 |
| `items[].tradeSnapshot` | `ref:PatentTradeSnapshot` | N | - | 交易快照 |
| `items[].tradeSnapshot` | `object` | N | - | 交易快照 |
| `items[].tradeSnapshot.listingId` | `ref:Uuid` | N | - | 挂牌ID |
| `items[].tradeSnapshot.listingId` | `string` | N | - | 挂牌ID |
| `items[].tradeSnapshot.priceType` | `ref:PriceType` | N | - | 价格类型 |
| `items[].tradeSnapshot.priceType` | `string` | N | FIXED/NEGOTIABLE | 价格类型 |
| `items[].tradeSnapshot.priceAmountFen` | `integer` | N | - | 价格金额分 |
| `items[].tradeSnapshot.depositAmountFen` | `integer` | N | - | 订金金额分 |
| `items[].tradeSnapshot.seller` | `ref:UserBrief` | N | - | 卖方 |
| `items[].tradeSnapshot.seller` | `object` | N | - | 卖方 |
| `items[].tradeSnapshot.seller.id` | `ref:Uuid` | Y | - | ID |
| `items[].tradeSnapshot.seller.id` | `string` | Y | - | ID |
| `items[].tradeSnapshot.seller.nickname` | `string` | N | - | 昵称 |
| `items[].tradeSnapshot.seller.avatarUrl` | `string` | N | - | 头像链接 |
| `items[].tradeSnapshot.seller.role` | `ref:UserRole` | N | - | 角色 |
| `items[].tradeSnapshot.seller.role` | `string` | N | buyer/seller/cs/admin | 角色 |
| `items[].tradeSnapshot.seller.verificationStatus` | `ref:VerificationStatus` | N | - | 认证状态 |
| `items[].tradeSnapshot.seller.verificationStatus` | `string` | N | PENDING/APPROVED/REJECTED | 认证状态 |
| `items[].tradeSnapshot.seller.verificationType` | `ref:VerificationType` | N | - | 认证类型 |
| `items[].tradeSnapshot.seller.verificationType` | `string` | N | PERSON/COMPANY/ACADEMY/GOVERNMENT/ASSOCIATION/TECH_MANAGER | 认证类型 |
| `items[].tradeSnapshot.seller.orgCategory` | `ref:SupplyType` | N | - | 机构分类 |
| `items[].tradeSnapshot.seller.orgCategory` | `string` | N | UNIVERSITY/UNIVERSITY_985/UNIVERSITY_211/RESEARCH_INSTITUTE/OTHER | 机构分类 |
| `items[].tradeSnapshot.supplyType` | `ref:SupplyType` | N | - | 供给类型 |
| `items[].tradeSnapshot.supplyType` | `string` | N | UNIVERSITY/UNIVERSITY_985/UNIVERSITY_211/RESEARCH_INSTITUTE/OTHER | 供给类型 |
| `items[].createdAt` | `string` | Y | - | 创建时间 |
| `items[].updatedAt` | `string` | N | - | 更新时间 |
| `page` | `ref:PageMeta` | Y | - | 页码 |
| `page` | `object` | Y | - | 页码 |
| `page.page` | `integer` | Y | - | 页码 |
| `page.pageSize` | `integer` | Y | - | 页码大小 |
| `page.total` | `integer` | Y | - | 总 |

### 5.187 `PagedPatentClaimRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:PatentClaimRequest>` | Y | - | 条目 |
| `items[]` | `ref:PatentClaimRequest` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `ref:Uuid` | Y | - | ID |
| `items[].id` | `string` | Y | - | ID |
| `items[].patentId` | `ref:Uuid` | Y | - | 专利ID |
| `items[].patentId` | `string` | Y | - | 专利ID |
| `items[].applicantUserId` | `ref:Uuid` | Y | - | 申请人用户ID |
| `items[].applicantUserId` | `string` | Y | - | 申请人用户ID |
| `items[].status` | `ref:PatentClaimStatus` | Y | - | 状态 |
| `items[].status` | `string` | Y | PENDING/APPROVED/REJECTED | 状态 |
| `items[].claimReason` | `string` | N | - | 认领原因 |
| `items[].evidenceFileIds` | `array<ref:Uuid>` | Y | - | 凭证文件ID |
| `items[].evidenceFileIds[]` | `ref:Uuid` | N | - | 凭证文件ID |
| `items[].evidenceFileIds[]` | `string` | N | - | 凭证文件ID |
| `items[].reviewerUserId` | `ref:Uuid` | N | - | 审核人用户ID |
| `items[].reviewerUserId` | `string` | N | - | 审核人用户ID |
| `items[].reviewComment` | `string` | N | - | 审核评论 |
| `items[].submittedAt` | `string` | Y | - | 已提交时间 |
| `items[].reviewedAt` | `string` | N | - | 已审核时间 |
| `items[].createdAt` | `string` | Y | - | 创建时间 |
| `items[].updatedAt` | `string` | Y | - | 更新时间 |
| `page` | `ref:PageMeta` | Y | - | 页码 |
| `page` | `object` | Y | - | 页码 |
| `page.page` | `integer` | Y | - | 页码 |
| `page.pageSize` | `integer` | Y | - | 页码大小 |
| `page.total` | `integer` | Y | - | 总 |

### 5.188 `PagedPatentImportJob`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:PatentImportJob>` | Y | - | 条目 |
| `items[]` | `ref:PatentImportJob` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `ref:Uuid` | Y | - | ID |
| `items[].id` | `string` | Y | - | ID |
| `items[].operatorUserId` | `ref:Uuid` | Y | - | 操作人用户ID |
| `items[].operatorUserId` | `string` | Y | - | 操作人用户ID |
| `items[].fileId` | `ref:Uuid` | Y | - | 文件ID |
| `items[].fileId` | `string` | Y | - | 文件ID |
| `items[].duplicatePolicy` | `ref:PatentImportDuplicatePolicy` | Y | - | 重复策略 |
| `items[].duplicatePolicy` | `string` | Y | SKIP/OVERWRITE | 重复策略 |
| `items[].defaults` | `ref:PatentImportDefaults` | N | - | 默认 |
| `items[].defaults` | `object` | N | - | 默认 |
| `items[].defaults.listing` | `ref:PatentImportListingDefaults` | N | - | 挂牌 |
| `items[].defaults.listing` | `object` | N | - | 挂牌 |
| `items[].defaults.listing.enabled` | `boolean` | N | - | 启用 |
| `items[].defaults.listing.consultationRouting` | `ref:ConsultationRouting` | N | - | 咨询路由 |
| `items[].defaults.listing.consultationRouting` | `string` | N | PLATFORM/OWNER | 咨询路由 |
| `items[].defaults.listing.sellerUserId` | `ref:Uuid` | N | - | 卖方用户ID |
| `items[].defaults.listing.sellerUserId` | `string` | N | - | 卖方用户ID |
| `items[].defaults.listing.tradeMode` | `ref:TradeMode` | N | - | 交易模式 |
| `items[].defaults.listing.tradeMode` | `string` | N | ASSIGNMENT/LICENSE | 交易模式 |
| `items[].defaults.listing.licenseMode` | `ref:LicenseMode` | N | - | 许可模式 |
| `items[].defaults.listing.licenseMode` | `string` | N | EXCLUSIVE/SOLE/NON_EXCLUSIVE | 许可模式 |
| `items[].defaults.listing.priceType` | `ref:PriceType` | N | - | 价格类型 |
| `items[].defaults.listing.priceType` | `string` | N | FIXED/NEGOTIABLE | 价格类型 |
| `items[].defaults.listing.priceAmountFen` | `ref:MoneyFen` | N | - | 价格金额分 |
| `items[].defaults.listing.priceAmountFen` | `integer` | N | - | 价格金额分 |
| `items[].defaults.listing.depositAmountFen` | `ref:MoneyFen` | N | - | 订金金额分 |
| `items[].defaults.listing.depositAmountFen` | `integer` | N | - | 订金金额分 |
| `items[].defaults.listing.regionCode` | `string` | N | - | 地区编码 |
| `items[].defaults.listing.listingTopics` | `array<ref:ListingTopic>` | N | - | 挂牌主题 |
| `items[].defaults.listing.listingTopics[]` | `ref:ListingTopic` | N | - | 挂牌主题 |
| `items[].defaults.listing.listingTopics[]` | `string` | N | HIGH_TECH_RETIRED/SLEEPING/AWARD_WINNING/FIVE_STAR/OPEN_LICENSE | 挂牌主题 |
| `items[].defaults.listing.industryTags` | `array<string>` | N | - | 行业标签 |
| `items[].defaults.listing.industryTags[]` | `string` | N | - | 行业标签 |
| `items[].defaults.listing.auditStatus` | `ref:AuditStatus` | N | - | 审计状态 |
| `items[].defaults.listing.auditStatus` | `string` | N | PENDING/APPROVED/REJECTED | 审计状态 |
| `items[].defaults.listing.status` | `ref:ListingStatus` | N | - | 状态 |
| `items[].defaults.listing.status` | `string` | N | DRAFT/ACTIVE/OFF_SHELF/SOLD | 状态 |
| `items[].status` | `ref:PatentJobStatus` | Y | - | 状态 |
| `items[].status` | `string` | Y | PENDING/RUNNING/PAUSED/SUCCEEDED/FAILED | 状态 |
| `items[].totalCount` | `integer` | Y | - | 总数量 |
| `items[].validCount` | `integer` | Y | - | 有效数量 |
| `items[].invalidCount` | `integer` | Y | - | 无效数量 |
| `items[].successCount` | `integer` | Y | - | 成功数量 |
| `items[].failedCount` | `integer` | Y | - | 失败数量 |
| `items[].skippedCount` | `integer` | Y | - | 跳过数量 |
| `items[].failRate` | `number` | Y | - | 失败费率 |
| `items[].validatedAt` | `string` | N | - | 已校验时间 |
| `items[].startedAt` | `string` | N | - | 开始时间 |
| `items[].finishedAt` | `string` | N | - | 完成时间 |
| `items[].pausedAt` | `string` | N | - | 暂停时间 |
| `items[].errorFileId` | `ref:Uuid` | N | - | 错误文件ID |
| `items[].errorFileId` | `string` | N | - | 错误文件ID |
| `items[].createdAt` | `string` | Y | - | 创建时间 |
| `items[].updatedAt` | `string` | Y | - | 更新时间 |
| `page` | `ref:PageMeta` | Y | - | 页码 |
| `page` | `object` | Y | - | 页码 |
| `page.page` | `integer` | Y | - | 页码 |
| `page.pageSize` | `integer` | Y | - | 页码大小 |
| `page.total` | `integer` | Y | - | 总 |

### 5.189 `PagedPatentImportJobRow`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:PatentImportJobRow>` | Y | - | 条目 |
| `items[]` | `ref:PatentImportJobRow` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `ref:Uuid` | Y | - | ID |
| `items[].id` | `string` | Y | - | ID |
| `items[].jobId` | `ref:Uuid` | Y | - | 任务ID |
| `items[].jobId` | `string` | Y | - | 任务ID |
| `items[].rowNo` | `integer` | Y | - | 行编号 |
| `items[].status` | `ref:PatentImportRowStatus` | Y | - | 状态 |
| `items[].status` | `string` | Y | PENDING/VALID/INVALID/SUCCEEDED/FAILED/SKIPPED | 状态 |
| `items[].raw` | `object` | N | - | 原始 |
| `items[].normalized` | `object` | N | - | 规范化 |
| `items[].patentId` | `ref:Uuid` | N | - | 专利ID |
| `items[].patentId` | `string` | N | - | 专利ID |
| `items[].errorCode` | `string` | N | - | 错误编码 |
| `items[].errorMessage` | `string` | N | - | 错误消息 |
| `items[].processedAt` | `string` | N | - | 处理时间 |
| `items[].createdAt` | `string` | Y | - | 创建时间 |
| `items[].updatedAt` | `string` | Y | - | 更新时间 |
| `page` | `ref:PageMeta` | Y | - | 页码 |
| `page` | `object` | Y | - | 页码 |
| `page.page` | `integer` | Y | - | 页码 |
| `page.pageSize` | `integer` | Y | - | 页码大小 |
| `page.total` | `integer` | Y | - | 总 |

### 5.190 `PagedPatentMaintenanceOrder`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:PatentMaintenanceOrder>` | Y | - | 条目 |
| `items[]` | `ref:PatentMaintenanceOrder` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `ref:Uuid` | Y | - | ID |
| `items[].id` | `string` | Y | - | ID |
| `items[].scheduleId` | `ref:Uuid` | Y | - | 日程ID |
| `items[].scheduleId` | `string` | Y | - | 日程ID |
| `items[].applicantUserId` | `ref:Uuid` | Y | - | 申请人用户ID |
| `items[].applicantUserId` | `string` | Y | - | 申请人用户ID |
| `items[].assignedCsUserId` | `ref:Uuid` | N | - | 已分配客服用户ID |
| `items[].assignedCsUserId` | `string` | N | - | 已分配客服用户ID |
| `items[].status` | `ref:PatentMaintenanceOrderStatus` | Y | - | 状态 |
| `items[].status` | `string` | Y | REQUESTED/QUOTED/AWAITING_PAYMENT/PAID/EXECUTING/RECEIPT_UPLOADED/RECONCILED/CLOSED/CANCELLED | 状态 |
| `items[].paymentChannel` | `ref:PatentMaintenancePaymentChannel` | N | - | 支付渠道 |
| `items[].paymentChannel` | `string` | N | WECHAT/OFFLINE_BANK/OFFLINE_OTHER | 支付渠道 |
| `items[].officialFeeFen` | `integer` | Y | - | 官方费用分 |
| `items[].lateFeeFen` | `integer` | Y | - | 延迟费用分 |
| `items[].serviceFeeFen` | `integer` | Y | - | 服务费用分 |
| `items[].totalAmountFen` | `integer` | Y | - | 总金额分 |
| `items[].paymentDeadline` | `string` | N | - | 支付截止时间 |
| `items[].paidAt` | `string` | N | - | 已支付时间 |
| `items[].executedAt` | `string` | N | - | 执行时间 |
| `items[].receiptIssuedAt` | `string` | N | - | 回执发放时间 |
| `items[].officialSubmissionNo` | `string` | N | - | 官方提交编号 |
| `items[].officialReceiptNo` | `string` | N | - | 官方回执编号 |
| `items[].paymentTxnNo` | `string` | N | - | 支付交易编号 |
| `items[].officialReceiptFileId` | `ref:Uuid` | N | - | 官方回执文件ID |
| `items[].officialReceiptFileId` | `string` | N | - | 官方回执文件ID |
| `items[].reconcileStatus` | `ref:PatentMaintenanceReconcileStatus` | Y | - | 对账状态 |
| `items[].reconcileStatus` | `string` | Y | PENDING/MATCHED/MISMATCHED | 对账状态 |
| `items[].reconcileNote` | `string` | N | - | 对账备注 |
| `items[].closeNote` | `string` | N | - | 关闭备注 |
| `items[].patentId` | `ref:Uuid` | N | - | 专利ID |
| `items[].patentId` | `string` | N | - | 专利ID |
| `items[].patentTitle` | `string` | N | - | 专利标题 |
| `items[].applicationNoDisplay` | `string` | N | - | 申请编号显示 |
| `items[].scheduleYearNo` | `integer` | N | - | 日程年编号 |
| `items[].scheduleDueDate` | `string` | N | - | 日程到期日期 |
| `items[].canContactSupport` | `boolean` | N | - | 可联系客服 |
| `items[].createdAt` | `string` | Y | - | 创建时间 |
| `items[].updatedAt` | `string` | N | - | 更新时间 |
| `page` | `ref:PageMeta` | Y | - | 页码 |
| `page` | `object` | Y | - | 页码 |
| `page.page` | `integer` | Y | - | 页码 |
| `page.pageSize` | `integer` | Y | - | 页码大小 |
| `page.total` | `integer` | Y | - | 总 |

### 5.191 `PagedPatentMaintenanceSchedule`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:PatentMaintenanceSchedule>` | Y | - | 条目 |
| `items[]` | `ref:PatentMaintenanceSchedule` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `ref:Uuid` | Y | - | ID |
| `items[].id` | `string` | Y | - | ID |
| `items[].patentId` | `ref:Uuid` | Y | - | 专利ID |
| `items[].patentId` | `string` | Y | - | 专利ID |
| `items[].yearNo` | `integer` | Y | - | 年编号 |
| `items[].dueDate` | `string` | Y | - | 到期日期 |
| `items[].gracePeriodEnd` | `string` | N | - | 宽限期间结束 |
| `items[].status` | `ref:PatentMaintenanceStatus` | Y | - | 状态 |
| `items[].status` | `string` | Y | DUE/PAID/OVERDUE/WAIVED | 状态 |
| `items[].createdAt` | `string` | Y | - | 创建时间 |
| `items[].updatedAt` | `string` | N | - | 更新时间 |
| `page` | `ref:PageMeta` | Y | - | 页码 |
| `page` | `object` | Y | - | 页码 |
| `page.page` | `integer` | Y | - | 页码 |
| `page.pageSize` | `integer` | Y | - | 页码大小 |
| `page.total` | `integer` | Y | - | 总 |

### 5.192 `PagedPatentMaintenanceTask`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:PatentMaintenanceTask>` | Y | - | 条目 |
| `items[]` | `ref:PatentMaintenanceTask` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `ref:Uuid` | Y | - | ID |
| `items[].id` | `string` | Y | - | ID |
| `items[].scheduleId` | `ref:Uuid` | Y | - | 日程ID |
| `items[].scheduleId` | `string` | Y | - | 日程ID |
| `items[].assignedCsUserId` | `ref:Uuid` | N | - | 已分配客服用户ID |
| `items[].assignedCsUserId` | `string` | N | - | 已分配客服用户ID |
| `items[].status` | `ref:PatentMaintenanceTaskStatus` | Y | - | 状态 |
| `items[].status` | `string` | Y | OPEN/IN_PROGRESS/DONE/CANCELLED | 状态 |
| `items[].note` | `string` | N | - | 备注 |
| `items[].evidenceFileId` | `ref:Uuid` | N | - | 凭证文件ID |
| `items[].evidenceFileId` | `string` | N | - | 凭证文件ID |
| `items[].createdAt` | `string` | Y | - | 创建时间 |
| `items[].updatedAt` | `string` | N | - | 更新时间 |
| `page` | `ref:PageMeta` | Y | - | 页码 |
| `page` | `object` | Y | - | 页码 |
| `page.page` | `integer` | Y | - | 页码 |
| `page.pageSize` | `integer` | Y | - | 页码大小 |
| `page.total` | `integer` | Y | - | 总 |

### 5.193 `PagedTechManagerSummary`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:TechManagerSummary>` | Y | - | 条目 |
| `items[]` | `ref:TechManagerSummary` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].userId` | `ref:Uuid` | Y | - | 用户ID |
| `items[].userId` | `string` | Y | - | 用户ID |
| `items[].displayName` | `string` | Y | - | 显示名称 |
| `items[].verificationType` | `ref:VerificationType` | Y | - | 认证类型 |
| `items[].verificationType` | `string` | Y | PERSON/COMPANY/ACADEMY/GOVERNMENT/ASSOCIATION/TECH_MANAGER | 认证类型 |
| `items[].verificationStatus` | `ref:VerificationStatus` | Y | - | 认证状态 |
| `items[].verificationStatus` | `string` | Y | PENDING/APPROVED/REJECTED | 认证状态 |
| `items[].regionCode` | `string` | N | - | 地区编码 |
| `items[].avatarUrl` | `string` | N | - | 头像链接 |
| `items[].intro` | `string` | N | - | 简介 |
| `items[].serviceTags` | `array<string>` | N | - | 服务标签 |
| `items[].serviceTags[]` | `string` | N | - | 服务标签 |
| `items[].stats` | `ref:TechManagerStats` | N | - | 统计 |
| `items[].stats` | `object` | N | - | 统计 |
| `items[].stats.consultCount` | `integer` | N | - | 咨询数量 |
| `items[].stats.dealCount` | `integer` | N | - | 成交数量 |
| `items[].stats.ratingScore` | `number` | N | - | 评分分值 |
| `items[].stats.ratingCount` | `integer` | N | - | 评分数量 |
| `items[].verifiedAt` | `string` | N | - | 已核验时间 |
| `page` | `ref:PageMeta` | Y | - | 页码 |
| `page` | `object` | Y | - | 页码 |
| `page.page` | `integer` | Y | - | 页码 |
| `page.pageSize` | `integer` | Y | - | 页码大小 |
| `page.total` | `integer` | Y | - | 总 |

### 5.194 `PagedUserVerification`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:UserVerification>` | Y | - | 条目 |
| `items[]` | `ref:UserVerification` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `ref:Uuid` | Y | - | ID |
| `items[].id` | `string` | Y | - | ID |
| `items[].userId` | `ref:Uuid` | Y | - | 用户ID |
| `items[].userId` | `string` | Y | - | 用户ID |
| `items[].type` | `ref:VerificationType` | Y | - | 类型 |
| `items[].type` | `string` | Y | PERSON/COMPANY/ACADEMY/GOVERNMENT/ASSOCIATION/TECH_MANAGER | 类型 |
| `items[].status` | `ref:VerificationStatus` | Y | - | 状态 |
| `items[].status` | `string` | Y | PENDING/APPROVED/REJECTED | 状态 |
| `items[].displayName` | `string` | N | - | 显示名称 |
| `items[].unifiedSocialCreditCodeMasked` | `string` | N | - | 统一社会信用编码脱敏 |
| `items[].contactName` | `string` | N | - | 联系名称 |
| `items[].contactPhoneMasked` | `string` | N | - | 联系手机号脱敏 |
| `items[].idNumberMasked` | `string` | N | - | ID编号脱敏 |
| `items[].regionCode` | `string` | N | - | 地区编码 |
| `items[].intro` | `string` | N | - | 简介 |
| `items[].serviceTags` | `array<string>` | N | - | 服务标签 |
| `items[].serviceTags[]` | `string` | N | - | 服务标签 |
| `items[].logoFileId` | `ref:Uuid` | N | - | 标识文件ID |
| `items[].logoFileId` | `string` | N | - | 标识文件ID |
| `items[].logoUrl` | `string` | N | - | 标识链接 |
| `items[].evidenceFileIds` | `array<ref:Uuid>` | N | - | 凭证文件ID |
| `items[].evidenceFileIds[]` | `ref:Uuid` | N | - | 凭证文件ID |
| `items[].evidenceFileIds[]` | `string` | N | - | 凭证文件ID |
| `items[].submittedAt` | `string` | Y | - | 已提交时间 |
| `items[].reviewedAt` | `string` | N | - | 已审核时间 |
| `items[].reviewComment` | `string` | N | - | 审核评论 |
| `page` | `ref:PageMeta` | Y | - | 页码 |
| `page` | `object` | Y | - | 页码 |
| `page.page` | `integer` | Y | - | 页码 |
| `page.pageSize` | `integer` | Y | - | 页码大小 |
| `page.total` | `integer` | Y | - | 总 |

### 5.195 `Patent`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `jurisdiction` | `ref:Jurisdiction` | Y | - | 法域 |
| `jurisdiction` | `string` | Y | CN | 法域 |
| `applicationNoNorm` | `string` | Y | - | 申请编号规范 |
| `applicationNoDisplay` | `string` | N | - | 申请编号显示 |
| `patentNoDisplay` | `string` | N | - | 专利编号显示 |
| `publicationNoDisplay` | `string` | N | - | 公开编号显示 |
| `grantPublicationNoDisplay` | `string` | N | - | 授权公开编号显示 |
| `patentType` | `ref:PatentType` | Y | - | 专利类型 |
| `patentType` | `string` | Y | INVENTION/UTILITY_MODEL/DESIGN | 专利类型 |
| `title` | `string` | Y | - | 标题 |
| `abstract` | `string` | N | - | 摘要 |
| `caseStatus` | `string` | N | - | 工单状态 |
| `mainIpcCode` | `string` | N | - | 主IPC编码 |
| `claimCount` | `integer` | N | - | 认领数量 |
| `specPageCount` | `integer` | N | - | 规格页码数量 |
| `specWordCount` | `integer` | N | - | 规格词条数量 |
| `specFigureCount` | `integer` | N | - | 规格图数量 |
| `inventorNames` | `array<string>` | N | - | 发明人名称 |
| `inventorNames[]` | `string` | N | - | 发明人名称 |
| `assigneeNames` | `array<string>` | N | - | 受让方名称 |
| `assigneeNames[]` | `string` | N | - | 受让方名称 |
| `applicantNames` | `array<string>` | N | - | 申请人名称 |
| `applicantNames[]` | `string` | N | - | 申请人名称 |
| `filingDate` | `string` | N | - | 申请日期 |
| `publicationDate` | `string` | N | - | 公开日期 |
| `grantDate` | `string` | N | - | 授权日期 |
| `legalStatus` | `ref:LegalStatus` | N | - | 法律状态 |
| `legalStatus` | `string` | N | PENDING/GRANTED/EXPIRED/INVALIDATED/UNKNOWN | 法律状态 |
| `sourcePrimary` | `string` | N | USER/ADMIN/PROVIDER | 来源主要 |
| `sourceUpdatedAt` | `string` | N | - | 来源更新时间 |
| `ownerUserId` | `ref:Uuid` | N | - | 所有者用户ID |
| `ownerUserId` | `string` | N | - | 所有者用户ID |
| `ownerClaimedAt` | `string` | N | - | 所有者已认领时间 |
| `ownerClaimSource` | `ref:PatentOwnerClaimSource` | N | - | 所有者认领来源 |
| `ownerClaimSource` | `string` | N | PLATFORM_IMPORT/USER_CLAIM/ADMIN_ASSIGN | 所有者认领来源 |
| `media` | `array<ref:PatentMedia>` | N | - | 媒体 |
| `media[]` | `ref:PatentMedia` | N | - | 媒体 |
| `media[]` | `object` | N | - | 媒体 |
| `media[].fileId` | `ref:Uuid` | Y | - | 文件ID |
| `media[].fileId` | `string` | Y | - | 文件ID |
| `media[].url` | `string` | N | - | 链接 |
| `media[].type` | `string` | Y | COVER/SPEC_FIGURE | 类型 |
| `media[].sort` | `integer` | Y | - | 排序 |
| `tradeSnapshot` | `ref:PatentTradeSnapshot` | N | - | 交易快照 |
| `tradeSnapshot` | `object` | N | - | 交易快照 |
| `tradeSnapshot.listingId` | `ref:Uuid` | N | - | 挂牌ID |
| `tradeSnapshot.listingId` | `string` | N | - | 挂牌ID |
| `tradeSnapshot.priceType` | `ref:PriceType` | N | - | 价格类型 |
| `tradeSnapshot.priceType` | `string` | N | FIXED/NEGOTIABLE | 价格类型 |
| `tradeSnapshot.priceAmountFen` | `integer` | N | - | 价格金额分 |
| `tradeSnapshot.depositAmountFen` | `integer` | N | - | 订金金额分 |
| `tradeSnapshot.seller` | `ref:UserBrief` | N | - | 卖方 |
| `tradeSnapshot.seller` | `object` | N | - | 卖方 |
| `tradeSnapshot.seller.id` | `ref:Uuid` | Y | - | ID |
| `tradeSnapshot.seller.id` | `string` | Y | - | ID |
| `tradeSnapshot.seller.nickname` | `string` | N | - | 昵称 |
| `tradeSnapshot.seller.avatarUrl` | `string` | N | - | 头像链接 |
| `tradeSnapshot.seller.role` | `ref:UserRole` | N | - | 角色 |
| `tradeSnapshot.seller.role` | `string` | N | buyer/seller/cs/admin | 角色 |
| `tradeSnapshot.seller.verificationStatus` | `ref:VerificationStatus` | N | - | 认证状态 |
| `tradeSnapshot.seller.verificationStatus` | `string` | N | PENDING/APPROVED/REJECTED | 认证状态 |
| `tradeSnapshot.seller.verificationType` | `ref:VerificationType` | N | - | 认证类型 |
| `tradeSnapshot.seller.verificationType` | `string` | N | PERSON/COMPANY/ACADEMY/GOVERNMENT/ASSOCIATION/TECH_MANAGER | 认证类型 |
| `tradeSnapshot.seller.orgCategory` | `ref:SupplyType` | N | - | 机构分类 |
| `tradeSnapshot.seller.orgCategory` | `string` | N | UNIVERSITY/UNIVERSITY_985/UNIVERSITY_211/RESEARCH_INSTITUTE/OTHER | 机构分类 |
| `tradeSnapshot.supplyType` | `ref:SupplyType` | N | - | 供给类型 |
| `tradeSnapshot.supplyType` | `string` | N | UNIVERSITY/UNIVERSITY_985/UNIVERSITY_211/RESEARCH_INSTITUTE/OTHER | 供给类型 |
| `createdAt` | `string` | Y | - | 创建时间 |
| `updatedAt` | `string` | N | - | 更新时间 |

### 5.196 `PatentClaimCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `patentId` | `ref:Uuid` | Y | - | 专利ID |
| `patentId` | `string` | Y | - | 专利ID |
| `claimReason` | `string` | N | - | 认领原因 |
| `evidenceFileIds` | `array<ref:Uuid>` | Y | - | 凭证文件ID |
| `evidenceFileIds[]` | `ref:Uuid` | N | - | 凭证文件ID |
| `evidenceFileIds[]` | `string` | N | - | 凭证文件ID |

### 5.197 `PatentClaimRejectRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `reviewComment` | `string` | Y | - | 审核评论 |

### 5.198 `PatentClaimRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `patentId` | `ref:Uuid` | Y | - | 专利ID |
| `patentId` | `string` | Y | - | 专利ID |
| `applicantUserId` | `ref:Uuid` | Y | - | 申请人用户ID |
| `applicantUserId` | `string` | Y | - | 申请人用户ID |
| `status` | `ref:PatentClaimStatus` | Y | - | 状态 |
| `status` | `string` | Y | PENDING/APPROVED/REJECTED | 状态 |
| `claimReason` | `string` | N | - | 认领原因 |
| `evidenceFileIds` | `array<ref:Uuid>` | Y | - | 凭证文件ID |
| `evidenceFileIds[]` | `ref:Uuid` | N | - | 凭证文件ID |
| `evidenceFileIds[]` | `string` | N | - | 凭证文件ID |
| `reviewerUserId` | `ref:Uuid` | N | - | 审核人用户ID |
| `reviewerUserId` | `string` | N | - | 审核人用户ID |
| `reviewComment` | `string` | N | - | 审核评论 |
| `submittedAt` | `string` | Y | - | 已提交时间 |
| `reviewedAt` | `string` | N | - | 已审核时间 |
| `createdAt` | `string` | Y | - | 创建时间 |
| `updatedAt` | `string` | Y | - | 更新时间 |

### 5.199 `PatentClaimReviewRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `reviewComment` | `string` | N | - | 审核评论 |

### 5.200 `PatentClaimStatus`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.201 `PatentCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `jurisdiction` | `ref:Jurisdiction` | N | - | 法域 |
| `jurisdiction` | `string` | N | CN | 法域 |
| `applicationNoNorm` | `string` | Y | - | 申请编号规范 |
| `applicationNoDisplay` | `string` | N | - | 申请编号显示 |
| `patentType` | `ref:PatentType` | Y | - | 专利类型 |
| `patentType` | `string` | Y | INVENTION/UTILITY_MODEL/DESIGN | 专利类型 |
| `title` | `string` | Y | - | 标题 |
| `abstract` | `string` | N | - | 摘要 |
| `inventorNames` | `array<string>` | N | - | 发明人名称 |
| `inventorNames[]` | `string` | N | - | 发明人名称 |
| `assigneeNames` | `array<string>` | N | - | 受让方名称 |
| `assigneeNames[]` | `string` | N | - | 受让方名称 |
| `applicantNames` | `array<string>` | N | - | 申请人名称 |
| `applicantNames[]` | `string` | N | - | 申请人名称 |
| `filingDate` | `string` | N | - | 申请日期 |
| `publicationDate` | `string` | N | - | 公开日期 |
| `grantDate` | `string` | N | - | 授权日期 |
| `legalStatus` | `ref:LegalStatus` | N | - | 法律状态 |
| `legalStatus` | `string` | N | PENDING/GRANTED/EXPIRED/INVALIDATED/UNKNOWN | 法律状态 |
| `sourcePrimary` | `string` | N | USER/ADMIN/PROVIDER | 来源主要 |
| `sourceUpdatedAt` | `string` | N | - | 来源更新时间 |

### 5.202 `PatentImportDefaults`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `listing` | `ref:PatentImportListingDefaults` | N | - | 挂牌 |
| `listing` | `object` | N | - | 挂牌 |
| `listing.enabled` | `boolean` | N | - | 启用 |
| `listing.consultationRouting` | `ref:ConsultationRouting` | N | - | 咨询路由 |
| `listing.consultationRouting` | `string` | N | PLATFORM/OWNER | 咨询路由 |
| `listing.sellerUserId` | `ref:Uuid` | N | - | 卖方用户ID |
| `listing.sellerUserId` | `string` | N | - | 卖方用户ID |
| `listing.tradeMode` | `ref:TradeMode` | N | - | 交易模式 |
| `listing.tradeMode` | `string` | N | ASSIGNMENT/LICENSE | 交易模式 |
| `listing.licenseMode` | `ref:LicenseMode` | N | - | 许可模式 |
| `listing.licenseMode` | `string` | N | EXCLUSIVE/SOLE/NON_EXCLUSIVE | 许可模式 |
| `listing.priceType` | `ref:PriceType` | N | - | 价格类型 |
| `listing.priceType` | `string` | N | FIXED/NEGOTIABLE | 价格类型 |
| `listing.priceAmountFen` | `ref:MoneyFen` | N | - | 价格金额分 |
| `listing.priceAmountFen` | `integer` | N | - | 价格金额分 |
| `listing.depositAmountFen` | `ref:MoneyFen` | N | - | 订金金额分 |
| `listing.depositAmountFen` | `integer` | N | - | 订金金额分 |
| `listing.regionCode` | `string` | N | - | 地区编码 |
| `listing.listingTopics` | `array<ref:ListingTopic>` | N | - | 挂牌主题 |
| `listing.listingTopics[]` | `ref:ListingTopic` | N | - | 挂牌主题 |
| `listing.listingTopics[]` | `string` | N | HIGH_TECH_RETIRED/SLEEPING/AWARD_WINNING/FIVE_STAR/OPEN_LICENSE | 挂牌主题 |
| `listing.industryTags` | `array<string>` | N | - | 行业标签 |
| `listing.industryTags[]` | `string` | N | - | 行业标签 |
| `listing.auditStatus` | `ref:AuditStatus` | N | - | 审计状态 |
| `listing.auditStatus` | `string` | N | PENDING/APPROVED/REJECTED | 审计状态 |
| `listing.status` | `ref:ListingStatus` | N | - | 状态 |
| `listing.status` | `string` | N | DRAFT/ACTIVE/OFF_SHELF/SOLD | 状态 |

### 5.203 `PatentImportDuplicatePolicy`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.204 `PatentImportJob`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `operatorUserId` | `ref:Uuid` | Y | - | 操作人用户ID |
| `operatorUserId` | `string` | Y | - | 操作人用户ID |
| `fileId` | `ref:Uuid` | Y | - | 文件ID |
| `fileId` | `string` | Y | - | 文件ID |
| `duplicatePolicy` | `ref:PatentImportDuplicatePolicy` | Y | - | 重复策略 |
| `duplicatePolicy` | `string` | Y | SKIP/OVERWRITE | 重复策略 |
| `defaults` | `ref:PatentImportDefaults` | N | - | 默认 |
| `defaults` | `object` | N | - | 默认 |
| `defaults.listing` | `ref:PatentImportListingDefaults` | N | - | 挂牌 |
| `defaults.listing` | `object` | N | - | 挂牌 |
| `defaults.listing.enabled` | `boolean` | N | - | 启用 |
| `defaults.listing.consultationRouting` | `ref:ConsultationRouting` | N | - | 咨询路由 |
| `defaults.listing.consultationRouting` | `string` | N | PLATFORM/OWNER | 咨询路由 |
| `defaults.listing.sellerUserId` | `ref:Uuid` | N | - | 卖方用户ID |
| `defaults.listing.sellerUserId` | `string` | N | - | 卖方用户ID |
| `defaults.listing.tradeMode` | `ref:TradeMode` | N | - | 交易模式 |
| `defaults.listing.tradeMode` | `string` | N | ASSIGNMENT/LICENSE | 交易模式 |
| `defaults.listing.licenseMode` | `ref:LicenseMode` | N | - | 许可模式 |
| `defaults.listing.licenseMode` | `string` | N | EXCLUSIVE/SOLE/NON_EXCLUSIVE | 许可模式 |
| `defaults.listing.priceType` | `ref:PriceType` | N | - | 价格类型 |
| `defaults.listing.priceType` | `string` | N | FIXED/NEGOTIABLE | 价格类型 |
| `defaults.listing.priceAmountFen` | `ref:MoneyFen` | N | - | 价格金额分 |
| `defaults.listing.priceAmountFen` | `integer` | N | - | 价格金额分 |
| `defaults.listing.depositAmountFen` | `ref:MoneyFen` | N | - | 订金金额分 |
| `defaults.listing.depositAmountFen` | `integer` | N | - | 订金金额分 |
| `defaults.listing.regionCode` | `string` | N | - | 地区编码 |
| `defaults.listing.listingTopics` | `array<ref:ListingTopic>` | N | - | 挂牌主题 |
| `defaults.listing.listingTopics[]` | `ref:ListingTopic` | N | - | 挂牌主题 |
| `defaults.listing.listingTopics[]` | `string` | N | HIGH_TECH_RETIRED/SLEEPING/AWARD_WINNING/FIVE_STAR/OPEN_LICENSE | 挂牌主题 |
| `defaults.listing.industryTags` | `array<string>` | N | - | 行业标签 |
| `defaults.listing.industryTags[]` | `string` | N | - | 行业标签 |
| `defaults.listing.auditStatus` | `ref:AuditStatus` | N | - | 审计状态 |
| `defaults.listing.auditStatus` | `string` | N | PENDING/APPROVED/REJECTED | 审计状态 |
| `defaults.listing.status` | `ref:ListingStatus` | N | - | 状态 |
| `defaults.listing.status` | `string` | N | DRAFT/ACTIVE/OFF_SHELF/SOLD | 状态 |
| `status` | `ref:PatentJobStatus` | Y | - | 状态 |
| `status` | `string` | Y | PENDING/RUNNING/PAUSED/SUCCEEDED/FAILED | 状态 |
| `totalCount` | `integer` | Y | - | 总数量 |
| `validCount` | `integer` | Y | - | 有效数量 |
| `invalidCount` | `integer` | Y | - | 无效数量 |
| `successCount` | `integer` | Y | - | 成功数量 |
| `failedCount` | `integer` | Y | - | 失败数量 |
| `skippedCount` | `integer` | Y | - | 跳过数量 |
| `failRate` | `number` | Y | - | 失败费率 |
| `validatedAt` | `string` | N | - | 已校验时间 |
| `startedAt` | `string` | N | - | 开始时间 |
| `finishedAt` | `string` | N | - | 完成时间 |
| `pausedAt` | `string` | N | - | 暂停时间 |
| `errorFileId` | `ref:Uuid` | N | - | 错误文件ID |
| `errorFileId` | `string` | N | - | 错误文件ID |
| `createdAt` | `string` | Y | - | 创建时间 |
| `updatedAt` | `string` | Y | - | 更新时间 |

### 5.205 `PatentImportJobCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `fileId` | `ref:Uuid` | Y | - | 文件ID |
| `fileId` | `string` | Y | - | 文件ID |
| `duplicatePolicy` | `ref:PatentImportDuplicatePolicy` | N | - | 重复策略 |
| `duplicatePolicy` | `string` | N | SKIP/OVERWRITE | 重复策略 |
| `defaults` | `ref:PatentImportDefaults` | N | - | 默认 |
| `defaults` | `object` | N | - | 默认 |
| `defaults.listing` | `ref:PatentImportListingDefaults` | N | - | 挂牌 |
| `defaults.listing` | `object` | N | - | 挂牌 |
| `defaults.listing.enabled` | `boolean` | N | - | 启用 |
| `defaults.listing.consultationRouting` | `ref:ConsultationRouting` | N | - | 咨询路由 |
| `defaults.listing.consultationRouting` | `string` | N | PLATFORM/OWNER | 咨询路由 |
| `defaults.listing.sellerUserId` | `ref:Uuid` | N | - | 卖方用户ID |
| `defaults.listing.sellerUserId` | `string` | N | - | 卖方用户ID |
| `defaults.listing.tradeMode` | `ref:TradeMode` | N | - | 交易模式 |
| `defaults.listing.tradeMode` | `string` | N | ASSIGNMENT/LICENSE | 交易模式 |
| `defaults.listing.licenseMode` | `ref:LicenseMode` | N | - | 许可模式 |
| `defaults.listing.licenseMode` | `string` | N | EXCLUSIVE/SOLE/NON_EXCLUSIVE | 许可模式 |
| `defaults.listing.priceType` | `ref:PriceType` | N | - | 价格类型 |
| `defaults.listing.priceType` | `string` | N | FIXED/NEGOTIABLE | 价格类型 |
| `defaults.listing.priceAmountFen` | `ref:MoneyFen` | N | - | 价格金额分 |
| `defaults.listing.priceAmountFen` | `integer` | N | - | 价格金额分 |
| `defaults.listing.depositAmountFen` | `ref:MoneyFen` | N | - | 订金金额分 |
| `defaults.listing.depositAmountFen` | `integer` | N | - | 订金金额分 |
| `defaults.listing.regionCode` | `string` | N | - | 地区编码 |
| `defaults.listing.listingTopics` | `array<ref:ListingTopic>` | N | - | 挂牌主题 |
| `defaults.listing.listingTopics[]` | `ref:ListingTopic` | N | - | 挂牌主题 |
| `defaults.listing.listingTopics[]` | `string` | N | HIGH_TECH_RETIRED/SLEEPING/AWARD_WINNING/FIVE_STAR/OPEN_LICENSE | 挂牌主题 |
| `defaults.listing.industryTags` | `array<string>` | N | - | 行业标签 |
| `defaults.listing.industryTags[]` | `string` | N | - | 行业标签 |
| `defaults.listing.auditStatus` | `ref:AuditStatus` | N | - | 审计状态 |
| `defaults.listing.auditStatus` | `string` | N | PENDING/APPROVED/REJECTED | 审计状态 |
| `defaults.listing.status` | `ref:ListingStatus` | N | - | 状态 |
| `defaults.listing.status` | `string` | N | DRAFT/ACTIVE/OFF_SHELF/SOLD | 状态 |

### 5.206 `PatentImportJobRow`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `jobId` | `ref:Uuid` | Y | - | 任务ID |
| `jobId` | `string` | Y | - | 任务ID |
| `rowNo` | `integer` | Y | - | 行编号 |
| `status` | `ref:PatentImportRowStatus` | Y | - | 状态 |
| `status` | `string` | Y | PENDING/VALID/INVALID/SUCCEEDED/FAILED/SKIPPED | 状态 |
| `raw` | `object` | N | - | 原始 |
| `normalized` | `object` | N | - | 规范化 |
| `patentId` | `ref:Uuid` | N | - | 专利ID |
| `patentId` | `string` | N | - | 专利ID |
| `errorCode` | `string` | N | - | 错误编码 |
| `errorMessage` | `string` | N | - | 错误消息 |
| `processedAt` | `string` | N | - | 处理时间 |
| `createdAt` | `string` | Y | - | 创建时间 |
| `updatedAt` | `string` | Y | - | 更新时间 |

### 5.207 `PatentImportListingDefaults`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `enabled` | `boolean` | N | - | 启用 |
| `consultationRouting` | `ref:ConsultationRouting` | N | - | 咨询路由 |
| `consultationRouting` | `string` | N | PLATFORM/OWNER | 咨询路由 |
| `sellerUserId` | `ref:Uuid` | N | - | 卖方用户ID |
| `sellerUserId` | `string` | N | - | 卖方用户ID |
| `tradeMode` | `ref:TradeMode` | N | - | 交易模式 |
| `tradeMode` | `string` | N | ASSIGNMENT/LICENSE | 交易模式 |
| `licenseMode` | `ref:LicenseMode` | N | - | 许可模式 |
| `licenseMode` | `string` | N | EXCLUSIVE/SOLE/NON_EXCLUSIVE | 许可模式 |
| `priceType` | `ref:PriceType` | N | - | 价格类型 |
| `priceType` | `string` | N | FIXED/NEGOTIABLE | 价格类型 |
| `priceAmountFen` | `ref:MoneyFen` | N | - | 价格金额分 |
| `priceAmountFen` | `integer` | N | - | 价格金额分 |
| `depositAmountFen` | `ref:MoneyFen` | N | - | 订金金额分 |
| `depositAmountFen` | `integer` | N | - | 订金金额分 |
| `regionCode` | `string` | N | - | 地区编码 |
| `listingTopics` | `array<ref:ListingTopic>` | N | - | 挂牌主题 |
| `listingTopics[]` | `ref:ListingTopic` | N | - | 挂牌主题 |
| `listingTopics[]` | `string` | N | HIGH_TECH_RETIRED/SLEEPING/AWARD_WINNING/FIVE_STAR/OPEN_LICENSE | 挂牌主题 |
| `industryTags` | `array<string>` | N | - | 行业标签 |
| `industryTags[]` | `string` | N | - | 行业标签 |
| `auditStatus` | `ref:AuditStatus` | N | - | 审计状态 |
| `auditStatus` | `string` | N | PENDING/APPROVED/REJECTED | 审计状态 |
| `status` | `ref:ListingStatus` | N | - | 状态 |
| `status` | `string` | N | DRAFT/ACTIVE/OFF_SHELF/SOLD | 状态 |

### 5.208 `PatentImportRowStatus`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.209 `PatentJobStatus`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.210 `PatentListingGenerateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `patentIds` | `array<ref:Uuid>` | Y | - | 专利ID |
| `patentIds[]` | `ref:Uuid` | N | - | 专利ID |
| `patentIds[]` | `string` | N | - | 专利ID |
| `duplicatePolicy` | `ref:PatentImportDuplicatePolicy` | N | - | 重复策略 |
| `duplicatePolicy` | `string` | N | SKIP/OVERWRITE | 重复策略 |
| `listingDefaults` | `ref:PatentImportListingDefaults` | N | - | 挂牌默认 |
| `listingDefaults` | `object` | N | - | 挂牌默认 |
| `listingDefaults.enabled` | `boolean` | N | - | 启用 |
| `listingDefaults.consultationRouting` | `ref:ConsultationRouting` | N | - | 咨询路由 |
| `listingDefaults.consultationRouting` | `string` | N | PLATFORM/OWNER | 咨询路由 |
| `listingDefaults.sellerUserId` | `ref:Uuid` | N | - | 卖方用户ID |
| `listingDefaults.sellerUserId` | `string` | N | - | 卖方用户ID |
| `listingDefaults.tradeMode` | `ref:TradeMode` | N | - | 交易模式 |
| `listingDefaults.tradeMode` | `string` | N | ASSIGNMENT/LICENSE | 交易模式 |
| `listingDefaults.licenseMode` | `ref:LicenseMode` | N | - | 许可模式 |
| `listingDefaults.licenseMode` | `string` | N | EXCLUSIVE/SOLE/NON_EXCLUSIVE | 许可模式 |
| `listingDefaults.priceType` | `ref:PriceType` | N | - | 价格类型 |
| `listingDefaults.priceType` | `string` | N | FIXED/NEGOTIABLE | 价格类型 |
| `listingDefaults.priceAmountFen` | `ref:MoneyFen` | N | - | 价格金额分 |
| `listingDefaults.priceAmountFen` | `integer` | N | - | 价格金额分 |
| `listingDefaults.depositAmountFen` | `ref:MoneyFen` | N | - | 订金金额分 |
| `listingDefaults.depositAmountFen` | `integer` | N | - | 订金金额分 |
| `listingDefaults.regionCode` | `string` | N | - | 地区编码 |
| `listingDefaults.listingTopics` | `array<ref:ListingTopic>` | N | - | 挂牌主题 |
| `listingDefaults.listingTopics[]` | `ref:ListingTopic` | N | - | 挂牌主题 |
| `listingDefaults.listingTopics[]` | `string` | N | HIGH_TECH_RETIRED/SLEEPING/AWARD_WINNING/FIVE_STAR/OPEN_LICENSE | 挂牌主题 |
| `listingDefaults.industryTags` | `array<string>` | N | - | 行业标签 |
| `listingDefaults.industryTags[]` | `string` | N | - | 行业标签 |
| `listingDefaults.auditStatus` | `ref:AuditStatus` | N | - | 审计状态 |
| `listingDefaults.auditStatus` | `string` | N | PENDING/APPROVED/REJECTED | 审计状态 |
| `listingDefaults.status` | `ref:ListingStatus` | N | - | 状态 |
| `listingDefaults.status` | `string` | N | DRAFT/ACTIVE/OFF_SHELF/SOLD | 状态 |

### 5.211 `PatentListingGenerateResult`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `totalCount` | `integer` | Y | - | 总数量 |
| `successCount` | `integer` | Y | - | 成功数量 |
| `failedCount` | `integer` | Y | - | 失败数量 |
| `skippedCount` | `integer` | Y | - | 跳过数量 |
| `rows` | `array<ref:PatentListingGenerateResultRow>` | Y | - | 行 |
| `rows[]` | `ref:PatentListingGenerateResultRow` | N | - | 行 |
| `rows[]` | `object` | N | - | 行 |
| `rows[].patentId` | `ref:Uuid` | Y | - | 专利ID |
| `rows[].patentId` | `string` | Y | - | 专利ID |
| `rows[].listingId` | `ref:Uuid` | N | - | 挂牌ID |
| `rows[].listingId` | `string` | N | - | 挂牌ID |
| `rows[].status` | `string` | Y | SUCCEEDED/FAILED/SKIPPED | 状态 |
| `rows[].errorCode` | `string` | N | - | 错误编码 |
| `rows[].errorMessage` | `string` | N | - | 错误消息 |

### 5.212 `PatentListingGenerateResultRow`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `patentId` | `ref:Uuid` | Y | - | 专利ID |
| `patentId` | `string` | Y | - | 专利ID |
| `listingId` | `ref:Uuid` | N | - | 挂牌ID |
| `listingId` | `string` | N | - | 挂牌ID |
| `status` | `string` | Y | SUCCEEDED/FAILED/SKIPPED | 状态 |
| `errorCode` | `string` | N | - | 错误编码 |
| `errorMessage` | `string` | N | - | 错误消息 |

### 5.213 `PatentMaintenanceOrder`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `scheduleId` | `ref:Uuid` | Y | - | 日程ID |
| `scheduleId` | `string` | Y | - | 日程ID |
| `applicantUserId` | `ref:Uuid` | Y | - | 申请人用户ID |
| `applicantUserId` | `string` | Y | - | 申请人用户ID |
| `assignedCsUserId` | `ref:Uuid` | N | - | 已分配客服用户ID |
| `assignedCsUserId` | `string` | N | - | 已分配客服用户ID |
| `status` | `ref:PatentMaintenanceOrderStatus` | Y | - | 状态 |
| `status` | `string` | Y | REQUESTED/QUOTED/AWAITING_PAYMENT/PAID/EXECUTING/RECEIPT_UPLOADED/RECONCILED/CLOSED/CANCELLED | 状态 |
| `paymentChannel` | `ref:PatentMaintenancePaymentChannel` | N | - | 支付渠道 |
| `paymentChannel` | `string` | N | WECHAT/OFFLINE_BANK/OFFLINE_OTHER | 支付渠道 |
| `officialFeeFen` | `integer` | Y | - | 官方费用分 |
| `lateFeeFen` | `integer` | Y | - | 延迟费用分 |
| `serviceFeeFen` | `integer` | Y | - | 服务费用分 |
| `totalAmountFen` | `integer` | Y | - | 总金额分 |
| `paymentDeadline` | `string` | N | - | 支付截止时间 |
| `paidAt` | `string` | N | - | 已支付时间 |
| `executedAt` | `string` | N | - | 执行时间 |
| `receiptIssuedAt` | `string` | N | - | 回执发放时间 |
| `officialSubmissionNo` | `string` | N | - | 官方提交编号 |
| `officialReceiptNo` | `string` | N | - | 官方回执编号 |
| `paymentTxnNo` | `string` | N | - | 支付交易编号 |
| `officialReceiptFileId` | `ref:Uuid` | N | - | 官方回执文件ID |
| `officialReceiptFileId` | `string` | N | - | 官方回执文件ID |
| `reconcileStatus` | `ref:PatentMaintenanceReconcileStatus` | Y | - | 对账状态 |
| `reconcileStatus` | `string` | Y | PENDING/MATCHED/MISMATCHED | 对账状态 |
| `reconcileNote` | `string` | N | - | 对账备注 |
| `closeNote` | `string` | N | - | 关闭备注 |
| `patentId` | `ref:Uuid` | N | - | 专利ID |
| `patentId` | `string` | N | - | 专利ID |
| `patentTitle` | `string` | N | - | 专利标题 |
| `applicationNoDisplay` | `string` | N | - | 申请编号显示 |
| `scheduleYearNo` | `integer` | N | - | 日程年编号 |
| `scheduleDueDate` | `string` | N | - | 日程到期日期 |
| `canContactSupport` | `boolean` | N | - | 可联系客服 |
| `createdAt` | `string` | Y | - | 创建时间 |
| `updatedAt` | `string` | N | - | 更新时间 |

### 5.214 `PatentMaintenanceOrderCancelRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `closeNote` | `string` | Y | - | 关闭备注 |

### 5.215 `PatentMaintenanceOrderCloseRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `closeNote` | `string` | N | - | 关闭备注 |

### 5.216 `PatentMaintenanceOrderCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `scheduleId` | `ref:Uuid` | Y | - | 日程ID |
| `scheduleId` | `string` | Y | - | 日程ID |
| `applicantUserId` | `ref:Uuid` | N | - | 申请人用户ID |
| `applicantUserId` | `string` | N | - | 申请人用户ID |
| `assignedCsUserId` | `ref:Uuid` | N | - | 已分配客服用户ID |
| `assignedCsUserId` | `string` | N | - | 已分配客服用户ID |

### 5.217 `PatentMaintenanceOrderEvent`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `orderId` | `ref:Uuid` | Y | - | 订单ID |
| `orderId` | `string` | Y | - | 订单ID |
| `actorUserId` | `ref:Uuid` | N | - | 操作人用户ID |
| `actorUserId` | `string` | N | - | 操作人用户ID |
| `actorNickname` | `string` | N | - | 操作人昵称 |
| `actorRole` | `string` | N | - | 操作人角色 |
| `eventType` | `ref:PatentMaintenanceOrderEventType` | Y | - | 事件类型 |
| `eventType` | `string` | Y | CREATED/QUOTE_UPDATED/PAYMENT_CONFIRMED/EXECUTION_SUBMITTED/RECEIPT_UPLOADED/RECONCILED/CLOSED/CANCELLED | 事件类型 |
| `fromStatus` | `ref:PatentMaintenanceOrderStatus` | N | - | 来源状态 |
| `fromStatus` | `string` | N | REQUESTED/QUOTED/AWAITING_PAYMENT/PAID/EXECUTING/RECEIPT_UPLOADED/RECONCILED/CLOSED/CANCELLED | 来源状态 |
| `toStatus` | `ref:PatentMaintenanceOrderStatus` | Y | - | 至状态 |
| `toStatus` | `string` | Y | REQUESTED/QUOTED/AWAITING_PAYMENT/PAID/EXECUTING/RECEIPT_UPLOADED/RECONCILED/CLOSED/CANCELLED | 至状态 |
| `note` | `string` | N | - | 备注 |
| `payloadJson` | `object` | N | - | 载荷JSON |
| `createdAt` | `string` | Y | - | 创建时间 |

### 5.218 `PatentMaintenanceOrderEventList`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:PatentMaintenanceOrderEvent>` | Y | - | 条目 |
| `items[]` | `ref:PatentMaintenanceOrderEvent` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `ref:Uuid` | Y | - | ID |
| `items[].id` | `string` | Y | - | ID |
| `items[].orderId` | `ref:Uuid` | Y | - | 订单ID |
| `items[].orderId` | `string` | Y | - | 订单ID |
| `items[].actorUserId` | `ref:Uuid` | N | - | 操作人用户ID |
| `items[].actorUserId` | `string` | N | - | 操作人用户ID |
| `items[].actorNickname` | `string` | N | - | 操作人昵称 |
| `items[].actorRole` | `string` | N | - | 操作人角色 |
| `items[].eventType` | `ref:PatentMaintenanceOrderEventType` | Y | - | 事件类型 |
| `items[].eventType` | `string` | Y | CREATED/QUOTE_UPDATED/PAYMENT_CONFIRMED/EXECUTION_SUBMITTED/RECEIPT_UPLOADED/RECONCILED/CLOSED/CANCELLED | 事件类型 |
| `items[].fromStatus` | `ref:PatentMaintenanceOrderStatus` | N | - | 来源状态 |
| `items[].fromStatus` | `string` | N | REQUESTED/QUOTED/AWAITING_PAYMENT/PAID/EXECUTING/RECEIPT_UPLOADED/RECONCILED/CLOSED/CANCELLED | 来源状态 |
| `items[].toStatus` | `ref:PatentMaintenanceOrderStatus` | Y | - | 至状态 |
| `items[].toStatus` | `string` | Y | REQUESTED/QUOTED/AWAITING_PAYMENT/PAID/EXECUTING/RECEIPT_UPLOADED/RECONCILED/CLOSED/CANCELLED | 至状态 |
| `items[].note` | `string` | N | - | 备注 |
| `items[].payloadJson` | `object` | N | - | 载荷JSON |
| `items[].createdAt` | `string` | Y | - | 创建时间 |

### 5.219 `PatentMaintenanceOrderEventType`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.220 `PatentMaintenanceOrderExecutionRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `officialSubmissionNo` | `string` | Y | - | 官方提交编号 |
| `executedAt` | `string` | N | - | 执行时间 |

### 5.221 `PatentMaintenanceOrderMyCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `scheduleId` | `ref:Uuid` | Y | - | 日程ID |
| `scheduleId` | `string` | Y | - | 日程ID |

### 5.222 `PatentMaintenanceOrderPaymentConfirmRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `paymentChannel` | `ref:PatentMaintenancePaymentChannel` | Y | - | 支付渠道 |
| `paymentChannel` | `string` | Y | WECHAT/OFFLINE_BANK/OFFLINE_OTHER | 支付渠道 |
| `paymentTxnNo` | `string` | Y | - | 支付交易编号 |
| `paidAt` | `string` | N | - | 已支付时间 |

### 5.223 `PatentMaintenanceOrderQuoteRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `officialFeeFen` | `integer` | Y | - | 官方费用分 |
| `lateFeeFen` | `integer` | N | - | 延迟费用分 |
| `serviceFeeFen` | `integer` | Y | - | 服务费用分 |
| `paymentDeadline` | `string` | Y | - | 支付截止时间 |
| `assignedCsUserId` | `ref:Uuid` | N | - | 已分配客服用户ID |
| `assignedCsUserId` | `string` | N | - | 已分配客服用户ID |

### 5.224 `PatentMaintenanceOrderReceiptRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `officialReceiptNo` | `string` | Y | - | 官方回执编号 |
| `officialReceiptFileId` | `ref:Uuid` | Y | - | 官方回执文件ID |
| `officialReceiptFileId` | `string` | Y | - | 官方回执文件ID |
| `receiptIssuedAt` | `string` | N | - | 回执发放时间 |

### 5.225 `PatentMaintenanceOrderReconcileRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `reconcileStatus` | `ref:PatentMaintenanceReconcileStatus` | Y | - | 对账状态 |
| `reconcileStatus` | `string` | Y | PENDING/MATCHED/MISMATCHED | 对账状态 |
| `reconcileNote` | `string` | N | - | 对账备注 |

### 5.226 `PatentMaintenanceOrderStatus`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.227 `PatentMaintenancePaymentChannel`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.228 `PatentMaintenanceReconcileStatus`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.229 `PatentMaintenanceSchedule`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `patentId` | `ref:Uuid` | Y | - | 专利ID |
| `patentId` | `string` | Y | - | 专利ID |
| `yearNo` | `integer` | Y | - | 年编号 |
| `dueDate` | `string` | Y | - | 到期日期 |
| `gracePeriodEnd` | `string` | N | - | 宽限期间结束 |
| `status` | `ref:PatentMaintenanceStatus` | Y | - | 状态 |
| `status` | `string` | Y | DUE/PAID/OVERDUE/WAIVED | 状态 |
| `createdAt` | `string` | Y | - | 创建时间 |
| `updatedAt` | `string` | N | - | 更新时间 |

### 5.230 `PatentMaintenanceScheduleCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `patentId` | `ref:Uuid` | Y | - | 专利ID |
| `patentId` | `string` | Y | - | 专利ID |
| `yearNo` | `integer` | Y | - | 年编号 |
| `dueDate` | `string` | Y | - | 到期日期 |
| `gracePeriodEnd` | `string` | N | - | 宽限期间结束 |
| `status` | `ref:PatentMaintenanceStatus` | N | - | 状态 |
| `status` | `string` | N | DUE/PAID/OVERDUE/WAIVED | 状态 |

### 5.231 `PatentMaintenanceScheduleUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `dueDate` | `string` | N | - | 到期日期 |
| `gracePeriodEnd` | `string` | N | - | 宽限期间结束 |
| `status` | `ref:PatentMaintenanceStatus` | N | - | 状态 |
| `status` | `string` | N | DUE/PAID/OVERDUE/WAIVED | 状态 |

### 5.232 `PatentMaintenanceStatus`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.233 `PatentMaintenanceTask`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `scheduleId` | `ref:Uuid` | Y | - | 日程ID |
| `scheduleId` | `string` | Y | - | 日程ID |
| `assignedCsUserId` | `ref:Uuid` | N | - | 已分配客服用户ID |
| `assignedCsUserId` | `string` | N | - | 已分配客服用户ID |
| `status` | `ref:PatentMaintenanceTaskStatus` | Y | - | 状态 |
| `status` | `string` | Y | OPEN/IN_PROGRESS/DONE/CANCELLED | 状态 |
| `note` | `string` | N | - | 备注 |
| `evidenceFileId` | `ref:Uuid` | N | - | 凭证文件ID |
| `evidenceFileId` | `string` | N | - | 凭证文件ID |
| `createdAt` | `string` | Y | - | 创建时间 |
| `updatedAt` | `string` | N | - | 更新时间 |

### 5.234 `PatentMaintenanceTaskCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `scheduleId` | `ref:Uuid` | Y | - | 日程ID |
| `scheduleId` | `string` | Y | - | 日程ID |
| `assignedCsUserId` | `ref:Uuid` | N | - | 已分配客服用户ID |
| `assignedCsUserId` | `string` | N | - | 已分配客服用户ID |
| `note` | `string` | N | - | 备注 |

### 5.235 `PatentMaintenanceTaskStatus`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.236 `PatentMaintenanceTaskUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `assignedCsUserId` | `ref:Uuid` | N | - | 已分配客服用户ID |
| `assignedCsUserId` | `string` | N | - | 已分配客服用户ID |
| `status` | `ref:PatentMaintenanceTaskStatus` | N | - | 状态 |
| `status` | `string` | N | OPEN/IN_PROGRESS/DONE/CANCELLED | 状态 |
| `note` | `string` | N | - | 备注 |
| `evidenceFileId` | `ref:Uuid` | N | - | 凭证文件ID |
| `evidenceFileId` | `string` | N | - | 凭证文件ID |

### 5.237 `PatentMapBatchUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `listingIds` | `array<ref:Uuid>` | Y | - | 挂牌ID |
| `listingIds[]` | `ref:Uuid` | N | - | 挂牌ID |
| `listingIds[]` | `string` | N | - | 挂牌ID |
| `patch` | `ref:PatentMapListingPatch` | Y | - | 补丁 |
| `patch` | `object` | Y | - | 补丁 |
| `patch.regionCode` | `string` | N | - | 地区编码 |
| `patch.featuredLevel` | `ref:FeaturedLevel` | N | - | 推荐级别 |
| `patch.featuredLevel` | `string` | N | NONE/CITY/PROVINCE | 推荐级别 |
| `patch.featuredRegionCode` | `string` | N | - | 推荐地区编码 |
| `patch.featuredRank` | `integer` | N | - | 推荐排名 |
| `patch.featuredUntil` | `string` | N | - | 推荐截止 |
| `patch.clearRanking` | `boolean` | N | - | 清除排名 |
| `reason` | `string` | N | - | 原因 |

### 5.238 `PatentMapBatchUpdateResponse`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `ok` | `boolean` | Y | - | 成功 |
| `totalRequested` | `integer` | Y | - | 总请求 |
| `updatedCount` | `integer` | Y | - | 更新数量 |
| `missingListingIds` | `array<ref:Uuid>` | Y | - | 缺失挂牌ID |
| `missingListingIds[]` | `ref:Uuid` | N | - | 缺失挂牌ID |
| `missingListingIds[]` | `string` | N | - | 缺失挂牌ID |
| `patchApplied` | `object` | Y | - | 补丁已应用 |
| `reason` | `string` | Y | - | 原因 |

### 5.239 `PatentMapDataScope`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.240 `PatentMapListingPatch`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `regionCode` | `string` | N | - | 地区编码 |
| `featuredLevel` | `ref:FeaturedLevel` | N | - | 推荐级别 |
| `featuredLevel` | `string` | N | NONE/CITY/PROVINCE | 推荐级别 |
| `featuredRegionCode` | `string` | N | - | 推荐地区编码 |
| `featuredRank` | `integer` | N | - | 推荐排名 |
| `featuredUntil` | `string` | N | - | 推荐截止 |
| `clearRanking` | `boolean` | N | - | 清除排名 |

### 5.241 `PatentMapOverviewRegionLevel`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.242 `PatentMapOverviewResponse`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `generatedAt` | `string` | Y | - | 生成时间 |
| `filters` | `object` | Y | - | 筛选 |
| `filters.regionLevel` | `ref:PatentMapOverviewRegionLevel` | Y | - | 地区级别 |
| `filters.regionLevel` | `string` | Y | PROVINCE/CITY/DISTRICT | 地区级别 |
| `filters.top` | `integer` | Y | - | 最高 |
| `filters.scope` | `ref:PatentMapDataScope` | Y | - | 范围 |
| `filters.scope` | `string` | Y | ACTIVE_APPROVED/ALL | 范围 |
| `summary` | `ref:PatentMapOverviewSummary` | Y | - | 摘要 |
| `summary` | `object` | Y | - | 摘要 |
| `summary.totalListingCount` | `integer` | Y | - | 总挂牌数量 |
| `summary.totalPatentCount` | `integer` | Y | - | 总专利数量 |
| `summary.totalRegionCount` | `integer` | Y | - | 总地区数量 |
| `summary.rankedListingCount` | `integer` | Y | - | 排名挂牌数量 |
| `summary.activeRankedListingCount` | `integer` | Y | - | 有效排名挂牌数量 |
| `summary.unassignedListingCount` | `integer` | Y | - | 未分配挂牌数量 |
| `summary.mappableRegionCount` | `integer` | Y | - | 可映射地区数量 |
| `ranking` | `array<ref:PatentMapRegionItem>` | Y | - | 排名 |
| `ranking[]` | `ref:PatentMapRegionItem` | N | - | 排名 |
| `ranking[]` | `object` | N | - | 排名 |
| `ranking[].regionCode` | `string` | Y | - | 地区编码 |
| `ranking[].regionName` | `string` | Y | - | 地区名称 |
| `ranking[].regionLevel` | `ref:PatentMapRegionLevel` | Y | - | 地区级别 |
| `ranking[].regionLevel` | `string` | Y | PROVINCE/CITY/DISTRICT/UNKNOWN | 地区级别 |
| `ranking[].centerLat` | `number` | N | - | 中心纬度 |
| `ranking[].centerLng` | `number` | N | - | 中心经度 |
| `ranking[].listingCount` | `integer` | Y | - | 挂牌数量 |
| `ranking[].patentCount` | `integer` | Y | - | 专利数量 |
| `ranking[].rankedListingCount` | `integer` | Y | - | 排名挂牌数量 |
| `ranking[].activeRankedListingCount` | `integer` | Y | - | 有效排名挂牌数量 |
| `ranking[].topActiveRank` | `integer` | N | - | 最高有效排名 |
| `ranking[].rankPosition` | `integer` | Y | - | 排名位置 |
| `regions` | `array<ref:PatentMapRegionItem>` | Y | - | 地区 |
| `regions[]` | `ref:PatentMapRegionItem` | N | - | 地区 |
| `regions[]` | `object` | N | - | 地区 |
| `regions[].regionCode` | `string` | Y | - | 地区编码 |
| `regions[].regionName` | `string` | Y | - | 地区名称 |
| `regions[].regionLevel` | `ref:PatentMapRegionLevel` | Y | - | 地区级别 |
| `regions[].regionLevel` | `string` | Y | PROVINCE/CITY/DISTRICT/UNKNOWN | 地区级别 |
| `regions[].centerLat` | `number` | N | - | 中心纬度 |
| `regions[].centerLng` | `number` | N | - | 中心经度 |
| `regions[].listingCount` | `integer` | Y | - | 挂牌数量 |
| `regions[].patentCount` | `integer` | Y | - | 专利数量 |
| `regions[].rankedListingCount` | `integer` | Y | - | 排名挂牌数量 |
| `regions[].activeRankedListingCount` | `integer` | Y | - | 有效排名挂牌数量 |
| `regions[].topActiveRank` | `integer` | N | - | 最高有效排名 |
| `regions[].rankPosition` | `integer` | Y | - | 排名位置 |

### 5.243 `PatentMapOverviewSummary`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `totalListingCount` | `integer` | Y | - | 总挂牌数量 |
| `totalPatentCount` | `integer` | Y | - | 总专利数量 |
| `totalRegionCount` | `integer` | Y | - | 总地区数量 |
| `rankedListingCount` | `integer` | Y | - | 排名挂牌数量 |
| `activeRankedListingCount` | `integer` | Y | - | 有效排名挂牌数量 |
| `unassignedListingCount` | `integer` | Y | - | 未分配挂牌数量 |
| `mappableRegionCount` | `integer` | Y | - | 可映射地区数量 |

### 5.244 `PatentMapRegionDetailItem`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `listingId` | `ref:Uuid` | Y | - | 挂牌ID |
| `listingId` | `string` | Y | - | 挂牌ID |
| `patentId` | `ref:Uuid` | N | - | 专利ID |
| `patentId` | `string` | N | - | 专利ID |
| `title` | `string` | Y | - | 标题 |
| `patentTitle` | `string` | Y | - | 专利标题 |
| `patentType` | `ref:PatentType` | N | - | 专利类型 |
| `patentType` | `string` | N | INVENTION/UTILITY_MODEL/DESIGN | 专利类型 |
| `applicationNoDisplay` | `string` | N | - | 申请编号显示 |
| `regionCode` | `string` | N | - | 地区编码 |
| `tradeMode` | `ref:TradeMode` | Y | - | 交易模式 |
| `tradeMode` | `string` | Y | ASSIGNMENT/LICENSE | 交易模式 |
| `priceType` | `ref:PriceType` | Y | - | 价格类型 |
| `priceType` | `string` | Y | FIXED/NEGOTIABLE | 价格类型 |
| `priceAmountFen` | `integer` | N | - | 价格金额分 |
| `depositAmountFen` | `integer` | Y | - | 订金金额分 |
| `featuredLevel` | `ref:FeaturedLevel` | Y | - | 推荐级别 |
| `featuredLevel` | `string` | Y | NONE/CITY/PROVINCE | 推荐级别 |
| `featuredRegionCode` | `string` | N | - | 推荐地区编码 |
| `featuredRank` | `integer` | N | - | 推荐排名 |
| `featuredUntil` | `string` | N | - | 推荐截止 |
| `isFeaturedActive` | `boolean` | Y | - | 是否推荐有效 |
| `createdAt` | `string` | Y | - | 创建时间 |
| `updatedAt` | `string` | Y | - | 更新时间 |

### 5.245 `PatentMapRegionDetailRegion`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `code` | `string` | Y | - | 编码 |
| `name` | `string` | Y | - | 名称 |
| `level` | `ref:PatentMapOverviewRegionLevel` | Y | - | 级别 |
| `level` | `string` | Y | PROVINCE/CITY/DISTRICT | 级别 |
| `parentCode` | `string` | N | - | 父级编码 |
| `centerLat` | `number` | N | - | 中心纬度 |
| `centerLng` | `number` | N | - | 中心经度 |
| `descendantRegionCodeCount` | `integer` | Y | - | 子级地区编码数量 |

### 5.246 `PatentMapRegionDetailResponse`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `generatedAt` | `string` | Y | - | 生成时间 |
| `filters` | `object` | Y | - | 筛选 |
| `filters.scope` | `ref:PatentMapDataScope` | Y | - | 范围 |
| `filters.scope` | `string` | Y | ACTIVE_APPROVED/ALL | 范围 |
| `region` | `ref:PatentMapRegionDetailRegion` | Y | - | 地区 |
| `region` | `object` | Y | - | 地区 |
| `region.code` | `string` | Y | - | 编码 |
| `region.name` | `string` | Y | - | 名称 |
| `region.level` | `ref:PatentMapOverviewRegionLevel` | Y | - | 级别 |
| `region.level` | `string` | Y | PROVINCE/CITY/DISTRICT | 级别 |
| `region.parentCode` | `string` | N | - | 父级编码 |
| `region.centerLat` | `number` | N | - | 中心纬度 |
| `region.centerLng` | `number` | N | - | 中心经度 |
| `region.descendantRegionCodeCount` | `integer` | Y | - | 子级地区编码数量 |
| `summary` | `ref:PatentMapRegionDetailSummary` | Y | - | 摘要 |
| `summary` | `object` | Y | - | 摘要 |
| `summary.listingCount` | `integer` | Y | - | 挂牌数量 |
| `summary.patentCount` | `integer` | Y | - | 专利数量 |
| `summary.rankedListingCount` | `integer` | Y | - | 排名挂牌数量 |
| `summary.activeRankedListingCount` | `integer` | Y | - | 有效排名挂牌数量 |
| `summary.topActiveRank` | `integer` | N | - | 最高有效排名 |
| `items` | `array<ref:PatentMapRegionDetailItem>` | Y | - | 条目 |
| `items[]` | `ref:PatentMapRegionDetailItem` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].listingId` | `ref:Uuid` | Y | - | 挂牌ID |
| `items[].listingId` | `string` | Y | - | 挂牌ID |
| `items[].patentId` | `ref:Uuid` | N | - | 专利ID |
| `items[].patentId` | `string` | N | - | 专利ID |
| `items[].title` | `string` | Y | - | 标题 |
| `items[].patentTitle` | `string` | Y | - | 专利标题 |
| `items[].patentType` | `ref:PatentType` | N | - | 专利类型 |
| `items[].patentType` | `string` | N | INVENTION/UTILITY_MODEL/DESIGN | 专利类型 |
| `items[].applicationNoDisplay` | `string` | N | - | 申请编号显示 |
| `items[].regionCode` | `string` | N | - | 地区编码 |
| `items[].tradeMode` | `ref:TradeMode` | Y | - | 交易模式 |
| `items[].tradeMode` | `string` | Y | ASSIGNMENT/LICENSE | 交易模式 |
| `items[].priceType` | `ref:PriceType` | Y | - | 价格类型 |
| `items[].priceType` | `string` | Y | FIXED/NEGOTIABLE | 价格类型 |
| `items[].priceAmountFen` | `integer` | N | - | 价格金额分 |
| `items[].depositAmountFen` | `integer` | Y | - | 订金金额分 |
| `items[].featuredLevel` | `ref:FeaturedLevel` | Y | - | 推荐级别 |
| `items[].featuredLevel` | `string` | Y | NONE/CITY/PROVINCE | 推荐级别 |
| `items[].featuredRegionCode` | `string` | N | - | 推荐地区编码 |
| `items[].featuredRank` | `integer` | N | - | 推荐排名 |
| `items[].featuredUntil` | `string` | N | - | 推荐截止 |
| `items[].isFeaturedActive` | `boolean` | Y | - | 是否推荐有效 |
| `items[].createdAt` | `string` | Y | - | 创建时间 |
| `items[].updatedAt` | `string` | Y | - | 更新时间 |
| `page` | `ref:PageMeta` | Y | - | 页码 |
| `page` | `object` | Y | - | 页码 |
| `page.page` | `integer` | Y | - | 页码 |
| `page.pageSize` | `integer` | Y | - | 页码大小 |
| `page.total` | `integer` | Y | - | 总 |

### 5.247 `PatentMapRegionDetailSummary`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `listingCount` | `integer` | Y | - | 挂牌数量 |
| `patentCount` | `integer` | Y | - | 专利数量 |
| `rankedListingCount` | `integer` | Y | - | 排名挂牌数量 |
| `activeRankedListingCount` | `integer` | Y | - | 有效排名挂牌数量 |
| `topActiveRank` | `integer` | N | - | 最高有效排名 |

### 5.248 `PatentMapRegionItem`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `regionCode` | `string` | Y | - | 地区编码 |
| `regionName` | `string` | Y | - | 地区名称 |
| `regionLevel` | `ref:PatentMapRegionLevel` | Y | - | 地区级别 |
| `regionLevel` | `string` | Y | PROVINCE/CITY/DISTRICT/UNKNOWN | 地区级别 |
| `centerLat` | `number` | N | - | 中心纬度 |
| `centerLng` | `number` | N | - | 中心经度 |
| `listingCount` | `integer` | Y | - | 挂牌数量 |
| `patentCount` | `integer` | Y | - | 专利数量 |
| `rankedListingCount` | `integer` | Y | - | 排名挂牌数量 |
| `activeRankedListingCount` | `integer` | Y | - | 有效排名挂牌数量 |
| `topActiveRank` | `integer` | N | - | 最高有效排名 |
| `rankPosition` | `integer` | Y | - | 排名位置 |

### 5.249 `PatentMapRegionLevel`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.250 `PatentMedia`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `fileId` | `ref:Uuid` | Y | - | 文件ID |
| `fileId` | `string` | Y | - | 文件ID |
| `url` | `string` | N | - | 链接 |
| `type` | `string` | Y | COVER/SPEC_FIGURE | 类型 |
| `sort` | `integer` | Y | - | 排序 |

### 5.251 `PatentNormalizeRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `raw` | `string` | Y | - | 原始 |

### 5.252 `PatentNormalizeResponse`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `jurisdiction` | `ref:Jurisdiction` | Y | - | 法域 |
| `jurisdiction` | `string` | Y | CN | 法域 |
| `inputType` | `ref:PatentNumberInputType` | Y | - | 输入类型 |
| `inputType` | `string` | Y | APPLICATION_NO/PATENT_NO/PUBLICATION_NO | 输入类型 |
| `applicationNoNorm` | `string` | N | - | 申请编号规范 |
| `applicationNoDisplay` | `string` | N | - | 申请编号显示 |
| `publicationNoNorm` | `string` | N | - | 公开编号规范 |
| `publicationNoDisplay` | `string` | N | - | 公开编号显示 |
| `patentNoNorm` | `string` | N | - | 专利编号规范 |
| `patentNoDisplay` | `string` | N | - | 专利编号显示 |
| `kindCode` | `string` | N | - | 类别编码 |
| `patentType` | `ref:PatentType` | N | - | 专利类型 |
| `patentType` | `string` | N | INVENTION/UTILITY_MODEL/DESIGN | 专利类型 |
| `warnings` | `array<string>` | N | - | 警告 |
| `warnings[]` | `string` | N | - | 警告 |

### 5.253 `PatentNumberInputType`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.254 `PatentOwnerClaimSource`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.255 `PatentTradeSnapshot`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `listingId` | `ref:Uuid` | N | - | 挂牌ID |
| `listingId` | `string` | N | - | 挂牌ID |
| `priceType` | `ref:PriceType` | N | - | 价格类型 |
| `priceType` | `string` | N | FIXED/NEGOTIABLE | 价格类型 |
| `priceAmountFen` | `integer` | N | - | 价格金额分 |
| `depositAmountFen` | `integer` | N | - | 订金金额分 |
| `seller` | `ref:UserBrief` | N | - | 卖方 |
| `seller` | `object` | N | - | 卖方 |
| `seller.id` | `ref:Uuid` | Y | - | ID |
| `seller.id` | `string` | Y | - | ID |
| `seller.nickname` | `string` | N | - | 昵称 |
| `seller.avatarUrl` | `string` | N | - | 头像链接 |
| `seller.role` | `ref:UserRole` | N | - | 角色 |
| `seller.role` | `string` | N | buyer/seller/cs/admin | 角色 |
| `seller.verificationStatus` | `ref:VerificationStatus` | N | - | 认证状态 |
| `seller.verificationStatus` | `string` | N | PENDING/APPROVED/REJECTED | 认证状态 |
| `seller.verificationType` | `ref:VerificationType` | N | - | 认证类型 |
| `seller.verificationType` | `string` | N | PERSON/COMPANY/ACADEMY/GOVERNMENT/ASSOCIATION/TECH_MANAGER | 认证类型 |
| `seller.orgCategory` | `ref:SupplyType` | N | - | 机构分类 |
| `seller.orgCategory` | `string` | N | UNIVERSITY/UNIVERSITY_985/UNIVERSITY_211/RESEARCH_INSTITUTE/OTHER | 机构分类 |
| `supplyType` | `ref:SupplyType` | N | - | 供给类型 |
| `supplyType` | `string` | N | UNIVERSITY/UNIVERSITY_985/UNIVERSITY_211/RESEARCH_INSTITUTE/OTHER | 供给类型 |

### 5.256 `PatentType`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.257 `PatentUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `applicationNoDisplay` | `string` | N | - | 申请编号显示 |
| `patentType` | `ref:PatentType` | N | - | 专利类型 |
| `patentType` | `string` | N | INVENTION/UTILITY_MODEL/DESIGN | 专利类型 |
| `title` | `string` | N | - | 标题 |
| `abstract` | `string` | N | - | 摘要 |
| `inventorNames` | `array<string>` | N | - | 发明人名称 |
| `inventorNames[]` | `string` | N | - | 发明人名称 |
| `assigneeNames` | `array<string>` | N | - | 受让方名称 |
| `assigneeNames[]` | `string` | N | - | 受让方名称 |
| `applicantNames` | `array<string>` | N | - | 申请人名称 |
| `applicantNames[]` | `string` | N | - | 申请人名称 |
| `filingDate` | `string` | N | - | 申请日期 |
| `publicationDate` | `string` | N | - | 公开日期 |
| `grantDate` | `string` | N | - | 授权日期 |
| `legalStatus` | `ref:LegalStatus` | N | - | 法律状态 |
| `legalStatus` | `string` | N | PENDING/GRANTED/EXPIRED/INVALIDATED/UNKNOWN | 法律状态 |
| `sourcePrimary` | `string` | N | USER/ADMIN/PROVIDER | 来源主要 |
| `sourceUpdatedAt` | `string` | N | - | 来源更新时间 |

### 5.258 `PayType`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.259 `PaymentIntentResponse`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `paymentId` | `ref:Uuid` | Y | - | 支付ID |
| `paymentId` | `string` | Y | - | 支付ID |
| `payType` | `ref:PayType` | Y | - | 支付类型 |
| `payType` | `string` | Y | DEPOSIT/FINAL | 支付类型 |
| `channel` | `string` | Y | WECHAT | 渠道 |
| `amountFen` | `ref:MoneyFen` | Y | - | 金额分 |
| `amountFen` | `integer` | Y | - | 金额分 |
| `wechatPayParams` | `object` | Y | - | 微信支付参数 |
| `wechatPayParams.timeStamp` | `string` | Y | - | 时间戳 |
| `wechatPayParams.nonceStr` | `string` | Y | - | 随机串串 |
| `wechatPayParams.package` | `string` | Y | - | 参数包 |
| `wechatPayParams.signType` | `string` | Y | - | 签名类型 |
| `wechatPayParams.paySign` | `string` | Y | - | 支付签名 |

### 5.260 `PaymentStatus`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.261 `PayoutCondition`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.262 `PayoutMethod`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.263 `PayoutStatus`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.264 `PhoneNumber`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.265 `PledgeStatus`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.266 `PriceType`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.267 `PublicHomeAnnouncementFeed`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `generatedAt` | `string` | Y | - | 生成时间 |
| `items` | `array<ref:PublicHomeAnnouncementItem>` | Y | - | 条目 |
| `items[]` | `ref:PublicHomeAnnouncementItem` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `string` | Y | - | ID |
| `items[].title` | `string` | Y | - | 标题 |
| `items[].content` | `string` | Y | - | 内容 |
| `items[].tag` | `string` | N | - | 标签 |
| `items[].linkUrl` | `string` | N | - | 链接链接 |
| `items[].pinned` | `boolean` | Y | - | 置顶 |
| `items[].order` | `integer` | Y | - | 订单 |
| `items[].publishedAt` | `string` | N | - | 已发布时间 |

### 5.268 `PublicHomeAnnouncementItem`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `string` | Y | - | ID |
| `title` | `string` | Y | - | 标题 |
| `content` | `string` | Y | - | 内容 |
| `tag` | `string` | N | - | 标签 |
| `linkUrl` | `string` | N | - | 链接链接 |
| `pinned` | `boolean` | Y | - | 置顶 |
| `order` | `integer` | Y | - | 订单 |
| `publishedAt` | `string` | N | - | 已发布时间 |

### 5.269 `RbacPermission`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `string` | Y | - | ID |
| `name` | `string` | Y | - | 名称 |
| `description` | `string` | N | - | 描述 |

### 5.270 `RbacPermissionList`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:RbacPermission>` | Y | - | 条目 |
| `items[]` | `ref:RbacPermission` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `string` | Y | - | ID |
| `items[].name` | `string` | Y | - | 名称 |
| `items[].description` | `string` | N | - | 描述 |

### 5.271 `RbacRole`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `name` | `string` | Y | - | 名称 |
| `description` | `string` | N | - | 描述 |
| `permissionIds` | `array<string>` | Y | - | 权限ID |
| `permissionIds[]` | `string` | N | - | 权限ID |
| `updatedAt` | `string` | N | - | 更新时间 |

### 5.272 `RbacRoleCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `name` | `string` | Y | - | 名称 |
| `description` | `string` | N | - | 描述 |
| `permissionIds` | `array<string>` | N | - | 权限ID |
| `permissionIds[]` | `string` | N | - | 权限ID |
| `reason` | `string` | N | - | 原因 |

### 5.273 `RbacRoleList`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:RbacRole>` | Y | - | 条目 |
| `items[]` | `ref:RbacRole` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `ref:Uuid` | Y | - | ID |
| `items[].id` | `string` | Y | - | ID |
| `items[].name` | `string` | Y | - | 名称 |
| `items[].description` | `string` | N | - | 描述 |
| `items[].permissionIds` | `array<string>` | Y | - | 权限ID |
| `items[].permissionIds[]` | `string` | N | - | 权限ID |
| `items[].updatedAt` | `string` | N | - | 更新时间 |

### 5.274 `RbacRoleUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `name` | `string` | N | - | 名称 |
| `description` | `string` | N | - | 描述 |
| `permissionIds` | `array<string>` | N | - | 权限ID |
| `permissionIds[]` | `string` | N | - | 权限ID |
| `reason` | `string` | N | - | 原因 |

### 5.275 `RbacUser`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `name` | `string` | Y | - | 名称 |
| `email` | `string` | N | - | 邮箱 |
| `roleIds` | `array<string>` | Y | - | 角色ID |
| `roleIds[]` | `string` | N | - | 角色ID |

### 5.276 `RbacUserCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `phone` | `ref:PhoneNumber` | Y | - | 手机号 |
| `phone` | `string` | Y | - | 手机号 |
| `name` | `string` | Y | - | 名称 |
| `roleIds` | `array<string>` | Y | - | 角色ID |
| `roleIds[]` | `string` | N | - | 角色ID |
| `reason` | `string` | N | - | 原因 |

### 5.277 `RbacUserList`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `items` | `array<ref:RbacUser>` | Y | - | 条目 |
| `items[]` | `ref:RbacUser` | N | - | 条目 |
| `items[]` | `object` | N | - | 条目 |
| `items[].id` | `ref:Uuid` | Y | - | ID |
| `items[].id` | `string` | Y | - | ID |
| `items[].name` | `string` | Y | - | 名称 |
| `items[].email` | `string` | N | - | 邮箱 |
| `items[].roleIds` | `array<string>` | Y | - | 角色ID |
| `items[].roleIds[]` | `string` | N | - | 角色ID |

### 5.278 `RbacUserRoleUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `roleIds` | `array<string>` | Y | - | 角色ID |
| `roleIds[]` | `string` | N | - | 角色ID |
| `reason` | `string` | N | - | 原因 |

### 5.279 `RecommendationConfig`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `enabled` | `boolean` | Y | - | 启用 |
| `timeDecayHalfLifeHours` | `integer` | Y | - | 时间衰减半衰周期小时 |
| `dedupeWindowHours` | `integer` | Y | - | 去重窗口小时 |
| `weights` | `ref:RecommendationWeights` | Y | - | 权重 |
| `weights` | `object` | Y | - | 权重 |
| `weights.time` | `number` | Y | - | 时间 |
| `weights.view` | `number` | Y | - | 浏览 |
| `weights.favorite` | `number` | Y | - | 收藏 |
| `weights.consult` | `number` | Y | - | 咨询 |
| `weights.region` | `number` | Y | - | 地区 |
| `weights.user` | `number` | Y | - | 用户 |
| `featuredBoost` | `ref:RecommendationFeaturedBoost` | Y | - | 推荐提升 |
| `featuredBoost` | `object` | Y | - | 推荐提升 |
| `featuredBoost.province` | `number` | Y | - | 省 |
| `featuredBoost.city` | `number` | Y | - | 市 |
| `updatedAt` | `string` | N | - | 更新时间 |

### 5.280 `RecommendationConfigUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `enabled` | `boolean` | Y | - | 启用 |
| `timeDecayHalfLifeHours` | `integer` | Y | - | 时间衰减半衰周期小时 |
| `dedupeWindowHours` | `integer` | Y | - | 去重窗口小时 |
| `weights` | `ref:RecommendationWeights` | Y | - | 权重 |
| `weights` | `object` | Y | - | 权重 |
| `weights.time` | `number` | Y | - | 时间 |
| `weights.view` | `number` | Y | - | 浏览 |
| `weights.favorite` | `number` | Y | - | 收藏 |
| `weights.consult` | `number` | Y | - | 咨询 |
| `weights.region` | `number` | Y | - | 地区 |
| `weights.user` | `number` | Y | - | 用户 |
| `featuredBoost` | `ref:RecommendationFeaturedBoost` | Y | - | 推荐提升 |
| `featuredBoost` | `object` | Y | - | 推荐提升 |
| `featuredBoost.province` | `number` | Y | - | 省 |
| `featuredBoost.city` | `number` | Y | - | 市 |
| `updatedAt` | `string` | N | - | 更新时间 |

### 5.281 `RecommendationFeaturedBoost`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `province` | `number` | Y | - | 省 |
| `city` | `number` | Y | - | 市 |

### 5.282 `RecommendationWeights`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `time` | `number` | Y | - | 时间 |
| `view` | `number` | Y | - | 浏览 |
| `favorite` | `number` | Y | - | 收藏 |
| `consult` | `number` | Y | - | 咨询 |
| `region` | `number` | Y | - | 地区 |
| `user` | `number` | Y | - | 用户 |

### 5.283 `RefundReasonCode`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.284 `RefundRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `orderId` | `ref:Uuid` | Y | - | 订单ID |
| `orderId` | `string` | Y | - | 订单ID |
| `reasonCode` | `ref:RefundReasonCode` | N | - | 原因编码 |
| `reasonCode` | `string` | N | BUYER_CHANGED_MIND/SELLER_MISSING_MATERIALS/MUTUAL_AGREEMENT/RISK_CONTROL/OTHER | 原因编码 |
| `reasonText` | `string` | N | - | 原因文本 |
| `status` | `ref:RefundRequestStatus` | Y | - | 状态 |
| `status` | `string` | Y | PENDING/APPROVED/REJECTED/REFUNDING/REFUNDED | 状态 |
| `createdAt` | `string` | Y | - | 创建时间 |
| `updatedAt` | `string` | N | - | 更新时间 |

### 5.285 `RefundRequestCompleteRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `remark` | `string` | N | - | 备注 |

### 5.286 `RefundRequestCreate`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `reasonCode` | `ref:RefundReasonCode` | Y | - | 原因编码 |
| `reasonCode` | `string` | Y | BUYER_CHANGED_MIND/SELLER_MISSING_MATERIALS/MUTUAL_AGREEMENT/RISK_CONTROL/OTHER | 原因编码 |
| `reasonText` | `string` | N | - | 原因文本 |
| `evidenceFileIds` | `array<ref:Uuid>` | N | - | 凭证文件ID |
| `evidenceFileIds[]` | `ref:Uuid` | N | - | 凭证文件ID |
| `evidenceFileIds[]` | `string` | N | - | 凭证文件ID |

### 5.287 `RefundRequestStatus`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.288 `RegionCreateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `code` | `string` | Y | - | 编码 |
| `name` | `string` | Y | - | 名称 |
| `level` | `ref:RegionLevel` | Y | - | 级别 |
| `level` | `string` | Y | PROVINCE/CITY/DISTRICT | 级别 |
| `parentCode` | `string` | N | - | 父级编码 |
| `centerLat` | `number` | N | - | 中心纬度 |
| `centerLng` | `number` | N | - | 中心经度 |

### 5.289 `RegionLevel`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.290 `RegionNode`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `code` | `string` | Y | - | 编码 |
| `name` | `string` | Y | - | 名称 |
| `level` | `ref:RegionLevel` | Y | - | 级别 |
| `level` | `string` | Y | PROVINCE/CITY/DISTRICT | 级别 |
| `parentCode` | `string` | N | - | 父级编码 |
| `centerLat` | `number` | N | - | 中心纬度 |
| `centerLng` | `number` | N | - | 中心经度 |
| `industryTags` | `array<string>` | N | - | 行业标签 |
| `industryTags[]` | `string` | N | - | 行业标签 |
| `updatedAt` | `string` | N | - | 更新时间 |

### 5.291 `RegionUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `name` | `string` | N | - | 名称 |
| `level` | `ref:RegionLevel` | N | - | 级别 |
| `level` | `string` | N | PROVINCE/CITY/DISTRICT | 级别 |
| `parentCode` | `string` | N | - | 父级编码 |
| `centerLat` | `number` | N | - | 中心纬度 |
| `centerLng` | `number` | N | - | 中心经度 |

### 5.292 `SearchQType`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.293 `SensitiveWordsConfig`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `words` | `array<string>` | Y | - | 词条 |
| `words[]` | `string` | N | - | 词条 |

### 5.294 `Settlement`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `orderId` | `ref:Uuid` | Y | - | 订单ID |
| `orderId` | `string` | Y | - | 订单ID |
| `grossAmountFen` | `ref:MoneyFen` | Y | - | 总额金额分 |
| `grossAmountFen` | `integer` | Y | - | 总额金额分 |
| `commissionAmountFen` | `ref:MoneyFen` | Y | - | 佣金金额分 |
| `commissionAmountFen` | `integer` | Y | - | 佣金金额分 |
| `payoutAmountFen` | `ref:MoneyFen` | Y | - | 放款金额分 |
| `payoutAmountFen` | `integer` | Y | - | 放款金额分 |
| `payoutMethod` | `ref:PayoutMethod` | Y | - | 放款方式 |
| `payoutMethod` | `string` | Y | MANUAL/WECHAT | 放款方式 |
| `payoutStatus` | `ref:PayoutStatus` | Y | - | 放款状态 |
| `payoutStatus` | `string` | Y | PENDING/SUCCEEDED/FAILED | 放款状态 |
| `payoutRef` | `string` | N | - | 放款参考 |
| `payoutEvidenceFileId` | `ref:Uuid` | N | - | 放款凭证文件ID |
| `payoutEvidenceFileId` | `string` | N | - | 放款凭证文件ID |
| `payoutAt` | `string` | N | - | 放款时间 |
| `createdAt` | `string` | Y | - | 创建时间 |
| `updatedAt` | `string` | N | - | 更新时间 |

### 5.295 `SmsPurpose`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.296 `SortBy`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.297 `SupplyType`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.298 `TaxonomyConfig`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `industries` | `array<string>` | Y | - | 行业 |
| `industries[]` | `string` | N | - | 行业 |
| `ipcMappings` | `array<string>` | Y | - | IPC映射 |
| `ipcMappings[]` | `string` | N | - | IPC映射 |
| `locMappings` | `array<string>` | Y | - | 位置映射 |
| `locMappings[]` | `string` | N | - | 位置映射 |

### 5.299 `TechManagerPublic`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `userId` | `ref:Uuid` | Y | - | 用户ID |
| `userId` | `string` | Y | - | 用户ID |
| `displayName` | `string` | Y | - | 显示名称 |
| `verificationType` | `ref:VerificationType` | Y | - | 认证类型 |
| `verificationType` | `string` | Y | PERSON/COMPANY/ACADEMY/GOVERNMENT/ASSOCIATION/TECH_MANAGER | 认证类型 |
| `verificationStatus` | `ref:VerificationStatus` | Y | - | 认证状态 |
| `verificationStatus` | `string` | Y | PENDING/APPROVED/REJECTED | 认证状态 |
| `regionCode` | `string` | N | - | 地区编码 |
| `avatarUrl` | `string` | N | - | 头像链接 |
| `intro` | `string` | N | - | 简介 |
| `serviceTags` | `array<string>` | N | - | 服务标签 |
| `serviceTags[]` | `string` | N | - | 服务标签 |
| `stats` | `ref:TechManagerStats` | N | - | 统计 |
| `stats` | `object` | N | - | 统计 |
| `stats.consultCount` | `integer` | N | - | 咨询数量 |
| `stats.dealCount` | `integer` | N | - | 成交数量 |
| `stats.ratingScore` | `number` | N | - | 评分分值 |
| `stats.ratingCount` | `integer` | N | - | 评分数量 |
| `verifiedAt` | `string` | N | - | 已核验时间 |
| `evidenceFileIds` | `array<ref:Uuid>` | N | - | 凭证文件ID |
| `evidenceFileIds[]` | `ref:Uuid` | N | - | 凭证文件ID |
| `evidenceFileIds[]` | `string` | N | - | 凭证文件ID |

### 5.300 `TechManagerSortBy`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.301 `TechManagerStats`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `consultCount` | `integer` | N | - | 咨询数量 |
| `dealCount` | `integer` | N | - | 成交数量 |
| `ratingScore` | `number` | N | - | 评分分值 |
| `ratingCount` | `integer` | N | - | 评分数量 |

### 5.302 `TechManagerSummary`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `userId` | `ref:Uuid` | Y | - | 用户ID |
| `userId` | `string` | Y | - | 用户ID |
| `displayName` | `string` | Y | - | 显示名称 |
| `verificationType` | `ref:VerificationType` | Y | - | 认证类型 |
| `verificationType` | `string` | Y | PERSON/COMPANY/ACADEMY/GOVERNMENT/ASSOCIATION/TECH_MANAGER | 认证类型 |
| `verificationStatus` | `ref:VerificationStatus` | Y | - | 认证状态 |
| `verificationStatus` | `string` | Y | PENDING/APPROVED/REJECTED | 认证状态 |
| `regionCode` | `string` | N | - | 地区编码 |
| `avatarUrl` | `string` | N | - | 头像链接 |
| `intro` | `string` | N | - | 简介 |
| `serviceTags` | `array<string>` | N | - | 服务标签 |
| `serviceTags[]` | `string` | N | - | 服务标签 |
| `stats` | `ref:TechManagerStats` | N | - | 统计 |
| `stats` | `object` | N | - | 统计 |
| `stats.consultCount` | `integer` | N | - | 咨询数量 |
| `stats.dealCount` | `integer` | N | - | 成交数量 |
| `stats.ratingScore` | `number` | N | - | 评分分值 |
| `stats.ratingCount` | `integer` | N | - | 评分数量 |
| `verifiedAt` | `string` | N | - | 已核验时间 |

### 5.303 `TechManagerUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `intro` | `string` | N | - | 简介 |
| `serviceTags` | `array<string>` | N | - | 服务标签 |
| `serviceTags[]` | `string` | N | - | 服务标签 |
| `featuredRank` | `integer` | N | - | 推荐排名 |
| `featuredUntil` | `string` | N | - | 推荐截止 |

### 5.304 `TradeMode`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.305 `TradeRulesConfig`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `version` | `integer` | Y | - | 版本 |
| `depositRate` | `number` | Y | - | 订金费率 |
| `depositMinFen` | `ref:MoneyFen` | Y | - | 订金最小分 |
| `depositMinFen` | `integer` | Y | - | 订金最小分 |
| `depositMaxFen` | `ref:MoneyFen` | Y | - | 订金最大分 |
| `depositMaxFen` | `integer` | Y | - | 订金最大分 |
| `depositFixedForNegotiableFen` | `ref:MoneyFen` | Y | - | 订金固定对应可议价分 |
| `depositFixedForNegotiableFen` | `integer` | Y | - | 订金固定对应可议价分 |
| `autoRefundWindowMinutes` | `integer` | Y | - | 自动退款窗口分钟 |
| `sellerMaterialDeadlineBusinessDays` | `integer` | Y | - | 卖方材料截止时间工作日天 |
| `contractSignedDeadlineBusinessDays` | `integer` | Y | - | 合同签署截止时间工作日天 |
| `transferCompletedSlaDays` | `integer` | Y | - | 转让完成服务时效天 |
| `commissionRate` | `number` | Y | - | 佣金费率 |
| `commissionMinFen` | `ref:MoneyFen` | Y | - | 佣金最小分 |
| `commissionMinFen` | `integer` | Y | - | 佣金最小分 |
| `commissionMaxFen` | `ref:MoneyFen` | Y | - | 佣金最大分 |
| `commissionMaxFen` | `integer` | Y | - | 佣金最大分 |
| `payoutCondition` | `ref:PayoutCondition` | Y | - | 放款条件 |
| `payoutCondition` | `string` | Y | TRANSFER_COMPLETED_CONFIRMED | 放款条件 |
| `payoutMethodDefault` | `ref:PayoutMethod` | Y | - | 放款方式默认 |
| `payoutMethodDefault` | `string` | Y | MANUAL/WECHAT | 放款方式默认 |
| `autoPayoutOnTimeout` | `boolean` | Y | - | 自动放款当超时 |

### 5.306 `TradeRulesConfigUpdateRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `depositRate` | `number` | Y | - | 订金费率 |
| `depositMinFen` | `ref:MoneyFen` | Y | - | 订金最小分 |
| `depositMinFen` | `integer` | Y | - | 订金最小分 |
| `depositMaxFen` | `ref:MoneyFen` | Y | - | 订金最大分 |
| `depositMaxFen` | `integer` | Y | - | 订金最大分 |
| `depositFixedForNegotiableFen` | `ref:MoneyFen` | Y | - | 订金固定对应可议价分 |
| `depositFixedForNegotiableFen` | `integer` | Y | - | 订金固定对应可议价分 |
| `autoRefundWindowMinutes` | `integer` | Y | - | 自动退款窗口分钟 |
| `sellerMaterialDeadlineBusinessDays` | `integer` | Y | - | 卖方材料截止时间工作日天 |
| `contractSignedDeadlineBusinessDays` | `integer` | Y | - | 合同签署截止时间工作日天 |
| `transferCompletedSlaDays` | `integer` | Y | - | 转让完成服务时效天 |
| `commissionRate` | `number` | Y | - | 佣金费率 |
| `commissionMinFen` | `ref:MoneyFen` | Y | - | 佣金最小分 |
| `commissionMinFen` | `integer` | Y | - | 佣金最小分 |
| `commissionMaxFen` | `ref:MoneyFen` | Y | - | 佣金最大分 |
| `commissionMaxFen` | `integer` | Y | - | 佣金最大分 |
| `payoutCondition` | `ref:PayoutCondition` | Y | - | 放款条件 |
| `payoutCondition` | `string` | Y | TRANSFER_COMPLETED_CONFIRMED | 放款条件 |
| `payoutMethodDefault` | `ref:PayoutMethod` | Y | - | 放款方式默认 |
| `payoutMethodDefault` | `string` | Y | MANUAL/WECHAT | 放款方式默认 |
| `autoPayoutOnTimeout` | `boolean` | Y | - | 自动放款当超时 |

### 5.307 `UserBrief`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `nickname` | `string` | N | - | 昵称 |
| `avatarUrl` | `string` | N | - | 头像链接 |
| `role` | `ref:UserRole` | N | - | 角色 |
| `role` | `string` | N | buyer/seller/cs/admin | 角色 |
| `verificationStatus` | `ref:VerificationStatus` | N | - | 认证状态 |
| `verificationStatus` | `string` | N | PENDING/APPROVED/REJECTED | 认证状态 |
| `verificationType` | `ref:VerificationType` | N | - | 认证类型 |
| `verificationType` | `string` | N | PERSON/COMPANY/ACADEMY/GOVERNMENT/ASSOCIATION/TECH_MANAGER | 认证类型 |
| `orgCategory` | `ref:SupplyType` | N | - | 机构分类 |
| `orgCategory` | `string` | N | UNIVERSITY/UNIVERSITY_985/UNIVERSITY_211/RESEARCH_INSTITUTE/OTHER | 机构分类 |

### 5.308 `UserProfile`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `phone` | `ref:PhoneNumber` | N | - | 手机号 |
| `phone` | `string` | N | - | 手机号 |
| `nickname` | `string` | N | - | 昵称 |
| `avatarUrl` | `string` | N | - | 头像链接 |
| `role` | `ref:UserRole` | Y | - | 角色 |
| `role` | `string` | Y | buyer/seller/cs/admin | 角色 |
| `verificationStatus` | `ref:VerificationStatus` | N | - | 认证状态 |
| `verificationStatus` | `string` | N | PENDING/APPROVED/REJECTED | 认证状态 |
| `verificationType` | `ref:VerificationType` | N | - | 认证类型 |
| `verificationType` | `string` | N | PERSON/COMPANY/ACADEMY/GOVERNMENT/ASSOCIATION/TECH_MANAGER | 认证类型 |
| `orgCategory` | `ref:SupplyType` | N | - | 机构分类 |
| `orgCategory` | `string` | N | UNIVERSITY/UNIVERSITY_985/UNIVERSITY_211/RESEARCH_INSTITUTE/OTHER | 机构分类 |
| `regionCode` | `string` | N | - | 地区编码 |
| `createdAt` | `string` | Y | - | 创建时间 |
| `updatedAt` | `string` | N | - | 更新时间 |

### 5.309 `UserRole`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.310 `UserVerification`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `id` | `ref:Uuid` | Y | - | ID |
| `id` | `string` | Y | - | ID |
| `userId` | `ref:Uuid` | Y | - | 用户ID |
| `userId` | `string` | Y | - | 用户ID |
| `type` | `ref:VerificationType` | Y | - | 类型 |
| `type` | `string` | Y | PERSON/COMPANY/ACADEMY/GOVERNMENT/ASSOCIATION/TECH_MANAGER | 类型 |
| `status` | `ref:VerificationStatus` | Y | - | 状态 |
| `status` | `string` | Y | PENDING/APPROVED/REJECTED | 状态 |
| `displayName` | `string` | N | - | 显示名称 |
| `unifiedSocialCreditCodeMasked` | `string` | N | - | 统一社会信用编码脱敏 |
| `contactName` | `string` | N | - | 联系名称 |
| `contactPhoneMasked` | `string` | N | - | 联系手机号脱敏 |
| `idNumberMasked` | `string` | N | - | ID编号脱敏 |
| `regionCode` | `string` | N | - | 地区编码 |
| `intro` | `string` | N | - | 简介 |
| `serviceTags` | `array<string>` | N | - | 服务标签 |
| `serviceTags[]` | `string` | N | - | 服务标签 |
| `logoFileId` | `ref:Uuid` | N | - | 标识文件ID |
| `logoFileId` | `string` | N | - | 标识文件ID |
| `logoUrl` | `string` | N | - | 标识链接 |
| `evidenceFileIds` | `array<ref:Uuid>` | N | - | 凭证文件ID |
| `evidenceFileIds[]` | `ref:Uuid` | N | - | 凭证文件ID |
| `evidenceFileIds[]` | `string` | N | - | 凭证文件ID |
| `submittedAt` | `string` | Y | - | 已提交时间 |
| `reviewedAt` | `string` | N | - | 已审核时间 |
| `reviewComment` | `string` | N | - | 审核评论 |

### 5.311 `UserVerificationSubmitOrganizationRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `type` | `string` | Y | COMPANY/ACADEMY/GOVERNMENT/ASSOCIATION | 类型 |
| `displayName` | `string` | Y | - | 显示名称 |
| `unifiedSocialCreditCode` | `string` | N | - | 统一社会信用编码 |
| `contactName` | `string` | N | - | 联系名称 |
| `contactPhone` | `ref:PhoneNumber` | N | - | 联系手机号 |
| `contactPhone` | `string` | N | - | 联系手机号 |
| `regionCode` | `string` | N | - | 地区编码 |
| `intro` | `string` | N | - | 简介 |
| `logoFileId` | `ref:Uuid` | N | - | 标识文件ID |
| `logoFileId` | `string` | N | - | 标识文件ID |
| `evidenceFileIds` | `array<ref:Uuid>` | Y | - | 凭证文件ID |
| `evidenceFileIds[]` | `ref:Uuid` | N | - | 凭证文件ID |
| `evidenceFileIds[]` | `string` | N | - | 凭证文件ID |

### 5.312 `UserVerificationSubmitPersonRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `type` | `string` | Y | PERSON | 类型 |
| `displayName` | `string` | Y | - | 显示名称 |
| `idNumber` | `string` | N | - | ID编号 |

### 5.313 `UserVerificationSubmitRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `oneOf1` | `ref:UserVerificationSubmitPersonRequest` | N | - | 候选类型1 |
| `oneOf1` | `object` | N | - | 候选类型1 |
| `oneOf1.type` | `string` | Y | PERSON | 类型 |
| `oneOf1.displayName` | `string` | Y | - | 显示名称 |
| `oneOf1.idNumber` | `string` | N | - | ID编号 |
| `oneOf2` | `ref:UserVerificationSubmitOrganizationRequest` | N | - | 候选类型2 |
| `oneOf2` | `object` | N | - | 候选类型2 |
| `oneOf2.type` | `string` | Y | COMPANY/ACADEMY/GOVERNMENT/ASSOCIATION | 类型 |
| `oneOf2.displayName` | `string` | Y | - | 显示名称 |
| `oneOf2.unifiedSocialCreditCode` | `string` | N | - | 统一社会信用编码 |
| `oneOf2.contactName` | `string` | N | - | 联系名称 |
| `oneOf2.contactPhone` | `ref:PhoneNumber` | N | - | 联系手机号 |
| `oneOf2.contactPhone` | `string` | N | - | 联系手机号 |
| `oneOf2.regionCode` | `string` | N | - | 地区编码 |
| `oneOf2.intro` | `string` | N | - | 简介 |
| `oneOf2.logoFileId` | `ref:Uuid` | N | - | 标识文件ID |
| `oneOf2.logoFileId` | `string` | N | - | 标识文件ID |
| `oneOf2.evidenceFileIds` | `array<ref:Uuid>` | Y | - | 凭证文件ID |
| `oneOf2.evidenceFileIds[]` | `ref:Uuid` | N | - | 凭证文件ID |
| `oneOf2.evidenceFileIds[]` | `string` | N | - | 凭证文件ID |
| `oneOf3` | `ref:UserVerificationSubmitTechManagerRequest` | N | - | 候选类型3 |
| `oneOf3` | `object` | N | - | 候选类型3 |
| `oneOf3.type` | `string` | Y | TECH_MANAGER | 类型 |
| `oneOf3.displayName` | `string` | Y | - | 显示名称 |
| `oneOf3.idNumber` | `string` | N | - | ID编号 |
| `oneOf3.contactPhone` | `ref:PhoneNumber` | N | - | 联系手机号 |
| `oneOf3.contactPhone` | `string` | N | - | 联系手机号 |
| `oneOf3.regionCode` | `string` | N | - | 地区编码 |
| `oneOf3.intro` | `string` | N | - | 简介 |
| `oneOf3.serviceTags` | `array<string>` | N | - | 服务标签 |
| `oneOf3.serviceTags[]` | `string` | N | - | 服务标签 |
| `oneOf3.evidenceFileIds` | `array<ref:Uuid>` | Y | - | 凭证文件ID |
| `oneOf3.evidenceFileIds[]` | `ref:Uuid` | N | - | 凭证文件ID |
| `oneOf3.evidenceFileIds[]` | `string` | N | - | 凭证文件ID |

### 5.314 `UserVerificationSubmitTechManagerRequest`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| `type` | `string` | Y | TECH_MANAGER | 类型 |
| `displayName` | `string` | Y | - | 显示名称 |
| `idNumber` | `string` | N | - | ID编号 |
| `contactPhone` | `ref:PhoneNumber` | N | - | 联系手机号 |
| `contactPhone` | `string` | N | - | 联系手机号 |
| `regionCode` | `string` | N | - | 地区编码 |
| `intro` | `string` | N | - | 简介 |
| `serviceTags` | `array<string>` | N | - | 服务标签 |
| `serviceTags[]` | `string` | N | - | 服务标签 |
| `evidenceFileIds` | `array<ref:Uuid>` | Y | - | 凭证文件ID |
| `evidenceFileIds[]` | `ref:Uuid` | N | - | 凭证文件ID |
| `evidenceFileIds[]` | `string` | N | - | 凭证文件ID |

### 5.315 `Uuid`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.316 `VerificationStatus`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

### 5.317 `VerificationType`

| 字段路径 | 类型 | 必填 | 枚举 | 说明 |
|---|---|---|---|---|
| - | - | - | - | - |

## 6. 数据库字段字典（Prisma）

### 6.1 `Achievement`

表级属性：
- `@@index([publisherUserId, createdAt])`
- `@@index([auditStatus, status])`
- `@@index([status, auditStatus, createdAt])`
- `@@index([regionCode])`
- `@@map("achievements")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `publisherUserId` | `String` | Y | - | `@map("publisher_user_id") @db.Uuid` | 发布者用户ID |
| `source` | `ContentSource` | Y | USER/PLATFORM/ADMIN | `@default(USER)` | 来源 |
| `title` | `String` | Y | - | `-` | 标题 |
| `summary` | `String?` | N | - | `-` | 摘要 |
| `description` | `String?` | N | - | `-` | 描述 |
| `keywordsJson` | `Json?` | N | - | `@map("keywords_json")` | 关键词JSON |
| `maturity` | `AchievementMaturity?` | N | CONCEPT/PROTOTYPE/PILOT/MASS_PRODUCTION/COMMERCIALIZED/OTHER | `-` | 成熟度 |
| `cooperationModesJson` | `Json?` | N | - | `@map("cooperation_modes_json")` | 合作模式JSON |
| `coverFileId` | `String?` | N | - | `@map("cover_file_id") @db.Uuid` | 封面文件ID |
| `regionCode` | `String?` | N | - | `@map("region_code")` | 地区编码 |
| `industryTagsJson` | `Json?` | N | - | `@map("industry_tags_json")` | 行业标签JSON |
| `auditStatus` | `AuditStatus` | Y | PENDING/APPROVED/REJECTED | `@default(PENDING) @map("audit_status")` | 审计状态 |
| `status` | `ContentStatus` | Y | DRAFT/ACTIVE/OFF_SHELF | `@default(DRAFT)` | 状态 |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `publisher` | `User` | Y | - | `@relation("Achievement_Publisher", fields: [publisherUserId], references: [id])` | 发布者 |
| `coverFile` | `File?` | N | - | `@relation("Achievement_CoverFile", fields: [coverFileId], references: [id])` | 封面文件 |
| `region` | `Region?` | N | - | `@relation(fields: [regionCode], references: [code])` | 地区 |
| `media` | `AchievementMedia[]` | Y | - | `-` | 媒体 |
| `stats` | `AchievementStats?` | N | - | `-` | 统计 |
| `favorites` | `AchievementFavorite[]` | Y | - | `-` | 收藏 |

### 6.2 `AchievementFavorite`

表级属性：
- `@@unique([achievementId, userId])`
- `@@map("achievement_favorites")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `achievementId` | `String` | Y | - | `@map("achievement_id") @db.Uuid` | 成果ID |
| `userId` | `String` | Y | - | `@map("user_id") @db.Uuid` | 用户ID |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `achievement` | `Achievement` | Y | - | `@relation(fields: [achievementId], references: [id])` | 成果 |
| `user` | `User` | Y | - | `@relation(fields: [userId], references: [id])` | 用户 |

### 6.3 `AchievementMedia`

表级属性：
- `@@index([achievementId, sort])`
- `@@map("achievement_media")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `achievementId` | `String` | Y | - | `@map("achievement_id") @db.Uuid` | 成果ID |
| `fileId` | `String` | Y | - | `@map("file_id") @db.Uuid` | 文件ID |
| `type` | `ContentMediaType` | Y | IMAGE/VIDEO/FILE | `-` | 类型 |
| `sort` | `Int` | Y | - | `@default(0)` | 排序 |
| `achievement` | `Achievement` | Y | - | `@relation(fields: [achievementId], references: [id])` | 成果 |
| `file` | `File` | Y | - | `@relation(fields: [fileId], references: [id])` | 文件 |

### 6.4 `AchievementStats`

表级属性：
- `@@map("achievement_stats")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `achievementId` | `String` | Y | - | `@id @map("achievement_id") @db.Uuid` | 成果ID |
| `viewCount` | `Int` | Y | - | `@default(0) @map("view_count")` | 浏览数量 |
| `favoriteCount` | `Int` | Y | - | `@default(0) @map("favorite_count")` | 收藏数量 |
| `consultCount` | `Int` | Y | - | `@default(0) @map("consult_count")` | 咨询数量 |
| `commentCount` | `Int` | Y | - | `@default(0) @map("comment_count")` | 评论数量 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `achievement` | `Achievement` | Y | - | `@relation(fields: [achievementId], references: [id])` | 成果 |

### 6.5 `Address`

表级属性：
- `@@index([userId, createdAt])`
- `@@map("addresses")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `userId` | `String` | Y | - | `@map("user_id") @db.Uuid` | 用户ID |
| `name` | `String` | Y | - | `-` | 名称 |
| `phone` | `String` | Y | - | `-` | 手机号 |
| `regionCode` | `String?` | N | - | `@map("region_code")` | 地区编码 |
| `addressLine` | `String` | Y | - | `@map("address_line")` | 地址行 |
| `isDefault` | `Boolean` | Y | - | `@default(false) @map("is_default")` | 是否默认 |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `user` | `User` | Y | - | `@relation(fields: [userId], references: [id])` | 用户 |

### 6.6 `AiParseFeedback`

表级属性：
- `@@index([parseResultId, createdAt])`
- `@@map("ai_parse_feedbacks")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `parseResultId` | `String` | Y | - | `@map("parse_result_id") @db.Uuid` | 解析结果ID |
| `actorUserId` | `String?` | N | - | `@map("actor_user_id") @db.Uuid` | 操作人用户ID |
| `actorType` | `AiParseFeedbackActorType` | Y | USER/ADMIN | `@map("actor_type")` | 操作人类型 |
| `score` | `Int` | Y | - | `-` | 分值 |
| `reasonTagsJson` | `Json?` | N | - | `@map("reason_tags_json")` | 原因标签JSON |
| `comment` | `String?` | N | - | `-` | 评论 |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `parseResult` | `AiParseResult` | Y | - | `@relation(fields: [parseResultId], references: [id])` | 解析结果 |
| `actor` | `User?` | N | - | `@relation("AiParseFeedback_Actor", fields: [actorUserId], references: [id])` | 操作人 |

### 6.7 `AiParseResult`

表级属性：
- `@@index([contentType, contentId])`
- `@@index([status, createdAt])`
- `@@map("ai_parse_results")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `contentType` | `AiContentType` | Y | LISTING/ACHIEVEMENT | `@map("content_type")` | 内容类型 |
| `contentId` | `String` | Y | - | `@map("content_id") @db.Uuid` | 内容ID |
| `summaryPlain` | `String?` | N | - | `@map("summary_plain")` | 摘要纯文本 |
| `featuresPlain` | `String?` | N | - | `@map("features_plain")` | 特征纯文本 |
| `keywordsJson` | `Json?` | N | - | `@map("keywords_json")` | 关键词JSON |
| `confidence` | `Float` | Y | - | `@default(0)` | 置信度 |
| `modelVersion` | `String?` | N | - | `@map("model_version")` | 模型版本 |
| `status` | `AiParseStatus` | Y | ACTIVE/REVIEW_REQUIRED/REPLACED | `@default(ACTIVE)` | 状态 |
| `note` | `String?` | N | - | `-` | 备注 |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `feedbacks` | `AiParseFeedback[]` | Y | - | `-` | 反馈 |

### 6.8 `AlertEvent`

表级属性：
- `@@index([status, triggeredAt])`
- `@@index([targetType, targetId])`
- `@@map("alert_events")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `type` | `String` | Y | - | `-` | 类型 |
| `severity` | `AlertSeverity` | Y | LOW/MEDIUM/HIGH | `-` | 严重级别 |
| `channel` | `AlertChannel` | Y | SMS/EMAIL/IN_APP | `-` | 渠道 |
| `status` | `AlertStatus` | Y | PENDING/SENT/ACKED/SUPPRESSED | `-` | 状态 |
| `targetType` | `AlertTargetType?` | N | PATENT/ORDER/LISTING/ACHIEVEMENT/AI_PARSE/IMPORT/PAYMENT/REFUND/SYSTEM | `@map("target_type")` | 目标类型 |
| `targetId` | `String?` | N | - | `@map("target_id") @db.Uuid` | 目标ID |
| `message` | `String?` | N | - | `-` | 消息 |
| `triggeredAt` | `DateTime` | Y | - | `@map("triggered_at")` | 触发时间 |
| `sentAt` | `DateTime?` | N | - | `@map("sent_at")` | 已发送时间 |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |

### 6.9 `AuditLog`

表级属性：
- `@@index([targetType, targetId])`
- `@@map("audit_logs")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `actorUserId` | `String` | Y | - | `@map("actor_user_id") @db.Uuid` | 操作人用户ID |
| `action` | `String` | Y | - | `-` | 操作 |
| `targetType` | `String` | Y | - | `@map("target_type")` | 目标类型 |
| `targetId` | `String` | Y | - | `@map("target_id") @db.Uuid` | 目标ID |
| `beforeJson` | `Json?` | N | - | `@map("before_json")` | 变更前JSON |
| `afterJson` | `Json?` | N | - | `@map("after_json")` | 变更后JSON |
| `requestId` | `String?` | N | - | `@map("request_id")` | 请求ID |
| `ip` | `String?` | N | - | `-` | IP |
| `userAgent` | `String?` | N | - | `@map("user_agent")` | 用户坐席 |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `actor` | `User` | Y | - | `@relation("AuditLog_Actor", fields: [actorUserId], references: [id])` | 操作人 |

### 6.10 `Comment`

表级属性：
- `@@index([contentType, contentId, createdAt])`
- `@@index([userId, createdAt])`
- `@@index([status, createdAt])`
- `@@map("comments")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `contentType` | `CommentContentType` | Y | LISTING/ACHIEVEMENT | `@map("content_type")` | 内容类型 |
| `contentId` | `String` | Y | - | `@map("content_id") @db.Uuid` | 内容ID |
| `parentCommentId` | `String?` | N | - | `@map("parent_comment_id") @db.Uuid` | 父级评论ID |
| `userId` | `String` | Y | - | `@map("user_id") @db.Uuid` | 用户ID |
| `text` | `String` | Y | - | `-` | 文本 |
| `status` | `CommentStatus` | Y | VISIBLE/HIDDEN/DELETED | `@default(VISIBLE)` | 状态 |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `user` | `User` | Y | - | `@relation(fields: [userId], references: [id])` | 用户 |
| `parent` | `Comment?` | N | - | `@relation("CommentParent", fields: [parentCommentId], references: [id])` | 父级 |
| `replies` | `Comment[]` | Y | - | `@relation("CommentParent")` | 回复 |

### 6.11 `ContentEvent`

表级属性：
- `@@index([contentType, contentId, eventType, actorKey, createdAt])`
- `@@map("content_events")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `contentType` | `CommentContentType` | Y | LISTING/ACHIEVEMENT | `@map("content_type")` | 内容类型 |
| `contentId` | `String` | Y | - | `@map("content_id") @db.Uuid` | 内容ID |
| `eventType` | `ContentEventType` | Y | VIEW/FAVORITE/CONSULT | `@map("event_type")` | 事件类型 |
| `actorKey` | `String` | Y | - | `@map("actor_key")` | 操作人键 |
| `actorUserId` | `String?` | N | - | `@map("actor_user_id") @db.Uuid` | 操作人用户ID |
| `deviceId` | `String?` | N | - | `@map("device_id")` | 设备ID |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |

### 6.12 `Contract`

表级属性：
- `@@map("contracts")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `orderId` | `String` | Y | - | `@id @map("order_id") @db.Uuid` | 订单ID |
| `status` | `ContractStatus` | Y | WAIT_UPLOAD/WAIT_CONFIRM/AVAILABLE | `@default(WAIT_UPLOAD)` | 状态 |
| `contractFileId` | `String?` | N | - | `@map("contract_file_id") @db.Uuid` | 合同文件ID |
| `fileUrl` | `String?` | N | - | `@map("file_url")` | 文件链接 |
| `uploadedAt` | `DateTime?` | N | - | `@map("uploaded_at")` | 上传时间 |
| `signedAt` | `DateTime?` | N | - | `@map("signed_at")` | 签署时间 |
| `watermarkOwner` | `String?` | N | - | `@map("watermark_owner")` | 水印所有者 |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `order` | `Order` | Y | - | `@relation(fields: [orderId], references: [id])` | 订单 |
| `contractFile` | `File?` | N | - | `@relation("Contract_File", fields: [contractFileId], references: [id])` | 合同文件 |

### 6.13 `Conversation`

表级属性：
- `@@index([listingId, updatedAt])`
- `@@index([contentType, contentId, updatedAt])`
- `@@map("conversations")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `contentType` | `ConversationContentType` | Y | LISTING/ACHIEVEMENT/TECH_MANAGER/SUPPORT/DISPUTE/MAINTENANCE | `@map("content_type")` | 内容类型 |
| `contentId` | `String` | Y | - | `@map("content_id") @db.Uuid` | 内容ID |
| `listingId` | `String?` | N | - | `@map("listing_id") @db.Uuid` | 挂牌ID |
| `orderId` | `String?` | N | - | `@map("order_id") @db.Uuid` | 订单ID |
| `buyerUserId` | `String` | Y | - | `@map("buyer_user_id") @db.Uuid` | 买方用户ID |
| `sellerUserId` | `String` | Y | - | `@map("seller_user_id") @db.Uuid` | 卖方用户ID |
| `lastMessageAt` | `DateTime?` | N | - | `@map("last_message_at")` | 最近消息时间 |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `listing` | `Listing?` | N | - | `@relation(fields: [listingId], references: [id])` | 挂牌 |
| `order` | `Order?` | N | - | `@relation(fields: [orderId], references: [id])` | 订单 |
| `buyer` | `User` | Y | - | `@relation("Conversation_Buyer", fields: [buyerUserId], references: [id])` | 买方 |
| `seller` | `User` | Y | - | `@relation("Conversation_Seller", fields: [sellerUserId], references: [id])` | 卖方 |
| `participants` | `ConversationParticipant[]` | Y | - | `-` | 参与者 |
| `messages` | `ConversationMessage[]` | Y | - | `-` | 消息 |
| `agents` | `ConversationAgent[]` | Y | - | `-` | 坐席 |

### 6.14 `ConversationAgent`

表级属性：
- `@@unique([conversationId, operatorUserId])`
- `@@index([operatorUserId, active, assignedAt])`
- `@@index([conversationId, active, assignedAt])`
- `@@map("conversation_agents")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `conversationId` | `String` | Y | - | `@map("conversation_id") @db.Uuid` | 会话ID |
| `operatorUserId` | `String` | Y | - | `@map("operator_user_id") @db.Uuid` | 操作人用户ID |
| `assignedByUserId` | `String?` | N | - | `@map("assigned_by_user_id") @db.Uuid` | 已分配由用户ID |
| `active` | `Boolean` | Y | - | `@default(true)` | 有效 |
| `assignedAt` | `DateTime` | Y | - | `@default(now()) @map("assigned_at")` | 已分配时间 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `conversation` | `Conversation` | Y | - | `@relation(fields: [conversationId], references: [id])` | 会话 |
| `operator` | `User` | Y | - | `@relation("ConversationAgent_Operator", fields: [operatorUserId], references: [id])` | 操作人 |
| `assignedBy` | `User?` | N | - | `@relation("ConversationAgent_AssignedBy", fields: [assignedByUserId], references: [id])` | 已分配由 |

### 6.15 `ConversationMessage`

表级属性：
- `@@index([conversationId, createdAt])`
- `@@map("conversation_messages")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `conversationId` | `String` | Y | - | `@map("conversation_id") @db.Uuid` | 会话ID |
| `senderUserId` | `String` | Y | - | `@map("sender_user_id") @db.Uuid` | 发送方用户ID |
| `type` | `ConversationMessageType` | Y | TEXT/EMOJI/IMAGE/FILE/SYSTEM | `-` | 类型 |
| `text` | `String?` | N | - | `-` | 文本 |
| `fileId` | `String?` | N | - | `@map("file_id") @db.Uuid` | 文件ID |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `conversation` | `Conversation` | Y | - | `@relation(fields: [conversationId], references: [id])` | 会话 |
| `sender` | `User` | Y | - | `@relation("ConversationMessage_Sender", fields: [senderUserId], references: [id])` | 发送方 |
| `file` | `File?` | N | - | `@relation(fields: [fileId], references: [id])` | 文件 |

### 6.16 `ConversationParticipant`

表级属性：
- `@@unique([conversationId, userId])`
- `@@map("conversation_participants")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `conversationId` | `String` | Y | - | `@map("conversation_id") @db.Uuid` | 会话ID |
| `userId` | `String` | Y | - | `@map("user_id") @db.Uuid` | 用户ID |
| `lastReadAt` | `DateTime?` | N | - | `@map("last_read_at")` | 最近已读时间 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `conversation` | `Conversation` | Y | - | `@relation(fields: [conversationId], references: [id])` | 会话 |
| `user` | `User` | Y | - | `@relation(fields: [userId], references: [id])` | 用户 |

### 6.17 `CsCase`

表级属性：
- `@@index([orderId, type])`
- `@@index([csUserId])`
- `@@map("cs_cases")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `orderId` | `String?` | N | - | `@map("order_id") @db.Uuid` | 订单ID |
| `csUserId` | `String?` | N | - | `@map("cs_user_id") @db.Uuid` | 客服用户ID |
| `title` | `String` | Y | - | `@default("")` | 标题 |
| `type` | `CaseType` | Y | FOLLOWUP/REFUND/DISPUTE | `-` | 类型 |
| `status` | `CaseStatus` | Y | OPEN/IN_PROGRESS/CLOSED | `@default(OPEN)` | 状态 |
| `requesterName` | `String?` | N | - | `@map("requester_name")` | 申请人名称 |
| `priority` | `CasePriority?` | N | LOW/MEDIUM/HIGH | `-` | 优先级 |
| `description` | `String?` | N | - | `-` | 描述 |
| `dueAt` | `DateTime?` | N | - | `@map("due_at")` | 到期时间 |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `order` | `Order?` | N | - | `@relation(fields: [orderId], references: [id])` | 订单 |
| `csUser` | `User?` | N | - | `@relation("CsCase_Cs", fields: [csUserId], references: [id])` | 客服用户 |
| `milestones` | `CsMilestone[]` | Y | - | `-` | 里程碑 |
| `notes` | `CsCaseNote[]` | Y | - | `-` | 备注 |
| `evidences` | `CsCaseEvidence[]` | Y | - | `-` | 凭证 |

### 6.18 `CsCaseEvidence`

表级属性：
- `@@index([caseId, createdAt])`
- `@@index([fileId])`
- `@@map("cs_case_evidences")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `caseId` | `String` | Y | - | `@map("case_id") @db.Uuid` | 工单ID |
| `fileId` | `String` | Y | - | `@map("file_id") @db.Uuid` | 文件ID |
| `fileName` | `String?` | N | - | `@map("file_name")` | 文件名称 |
| `url` | `String?` | N | - | `-` | 链接 |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `case` | `CsCase` | Y | - | `@relation(fields: [caseId], references: [id])` | 工单 |
| `file` | `File?` | N | - | `@relation(fields: [fileId], references: [id])` | 文件 |

### 6.19 `CsCaseNote`

表级属性：
- `@@index([caseId, createdAt])`
- `@@map("cs_case_notes")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `caseId` | `String` | Y | - | `@map("case_id") @db.Uuid` | 工单ID |
| `authorId` | `String` | Y | - | `@map("author_id") @db.Uuid` | 作者ID |
| `authorName` | `String` | Y | - | `@map("author_name")` | 作者名称 |
| `content` | `String` | Y | - | `-` | 内容 |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `case` | `CsCase` | Y | - | `@relation(fields: [caseId], references: [id])` | 工单 |
| `author` | `User?` | N | - | `@relation("CsCaseNote_Author", fields: [authorId], references: [id])` | 作者 |

### 6.20 `CsMilestone`

表级属性：
- `@@index([caseId, name])`
- `@@map("cs_milestones")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `caseId` | `String` | Y | - | `@map("case_id") @db.Uuid` | 工单ID |
| `name` | `MilestoneName` | Y | CONTRACT_SIGNED/TRANSFER_SUBMITTED/TRANSFER_COMPLETED | `-` | 名称 |
| `status` | `String` | Y | - | `-` | 状态 |
| `evidenceFileId` | `String?` | N | - | `@map("evidence_file_id") @db.Uuid` | 凭证文件ID |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `case` | `CsCase` | Y | - | `@relation(fields: [caseId], references: [id])` | 工单 |
| `evidenceFile` | `File?` | N | - | `@relation(fields: [evidenceFileId], references: [id])` | 凭证文件 |

### 6.21 `File`

表级属性：
- `@@index([ownerScope, ownerId])`
- `@@map("files")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `url` | `String` | Y | - | `-` | 链接 |
| `fileName` | `String?` | N | - | `@map("file_name")` | 文件名称 |
| `mimeType` | `String` | Y | - | `@map("mime_type")` | 媒体类型 |
| `sizeBytes` | `Int` | Y | - | `@map("size_bytes")` | 大小字节 |
| `ownerScope` | `FileOwnerScope` | Y | LISTING/ACHIEVEMENT/CASE/REFUND_REQUEST/INVOICE/USER/USER_VERIFICATION/MESSAGE | `@map("owner_scope")` | 所有者范围 |
| `ownerId` | `String` | Y | - | `@map("owner_id") @db.Uuid` | 所有者ID |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `listingMedia` | `ListingMedia[]` | Y | - | `-` | 挂牌媒体 |
| `achievementMedia` | `AchievementMedia[]` | Y | - | `-` | 成果媒体 |
| `messageAttachments` | `ConversationMessage[]` | Y | - | `-` | 消息附件 |
| `milestoneEvidence` | `CsMilestone[]` | Y | - | `-` | 里程碑凭证 |
| `caseEvidences` | `CsCaseEvidence[]` | Y | - | `-` | 工单凭证 |
| `settlementEvidence` | `Settlement[]` | Y | - | `-` | 结算凭证 |
| `invoiceOrders` | `Order[]` | Y | - | `-` | 发票订单 |
| `contractFiles` | `Contract[]` | Y | - | `@relation("Contract_File")` | 合同文件 |
| `maintenanceEvidenceTasks` | `PatentMaintenanceTask[]` | Y | - | `@relation("PatentMaintenanceTask_Evidence")` | 维保凭证任务 |
| `maintenanceReceiptOrders` | `PatentMaintenanceOrder[]` | Y | - | `@relation("PatentMaintenanceOrder_ReceiptFile")` | 维保回执订单 |
| `verificationLogos` | `UserVerification[]` | Y | - | `@relation("UserVerification_LogoFile")` | 认证标识 |
| `listingBatchJobErrorFiles` | `ListingBatchJob[]` | Y | - | `@relation("ListingBatchJob_ErrorFile")` | 挂牌批次任务错误文件 |
| `listingImportJobSourceFiles` | `ListingImportJob[]` | Y | - | `@relation("ListingImportJob_SourceFile")` | 挂牌导入任务来源文件 |
| `listingImportJobErrorFiles` | `ListingImportJob[]` | Y | - | `@relation("ListingImportJob_ErrorFile")` | 挂牌导入任务错误文件 |
| `patentImportJobSourceFiles` | `PatentImportJob[]` | Y | - | `@relation("PatentImportJob_SourceFile")` | 专利导入任务来源文件 |
| `patentImportJobErrorFiles` | `PatentImportJob[]` | Y | - | `@relation("PatentImportJob_ErrorFile")` | 专利导入任务错误文件 |
| `achievementCovers` | `Achievement[]` | Y | - | `@relation("Achievement_CoverFile")` | 成果封面 |

### 6.22 `IdempotencyKey`

表级属性：
- `@@unique([key, scope, userId])`
- `@@index([scope])`
- `@@map("idempotency_keys")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `key` | `String` | Y | - | `@map("idempotency_key")` | 键 |
| `scope` | `String` | Y | - | `-` | 范围 |
| `userId` | `String` | Y | - | `@map("user_id") @db.Uuid` | 用户ID |
| `requestHash` | `String?` | N | - | `@map("request_hash")` | 请求哈希 |
| `status` | `String` | Y | - | `-` | 状态 |
| `responseJson` | `Json?` | N | - | `@map("response_json")` | 响应JSON |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `user` | `User` | Y | - | `@relation(fields: [userId], references: [id])` | 用户 |

### 6.23 `IndustryTag`

表级属性：
- `@@map("industry_tags")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `name` | `String` | Y | - | `@unique` | 名称 |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |

### 6.24 `Listing`

表级属性：
- `@@index([auditStatus, status])`
- `@@index([status, auditStatus, createdAt])`
- `@@index([regionCode])`
- `@@map("listings")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `sellerUserId` | `String` | Y | - | `@map("seller_user_id") @db.Uuid` | 卖方用户ID |
| `source` | `ContentSource` | Y | USER/PLATFORM/ADMIN | `@default(USER) @map("source")` | 来源 |
| `patentId` | `String?` | N | - | `@map("patent_id") @db.Uuid` | 专利ID |
| `title` | `String` | Y | - | `-` | 标题 |
| `summary` | `String?` | N | - | `-` | 摘要 |
| `tradeMode` | `ListingTradeMode` | Y | ASSIGNMENT/LICENSE | `@map("trade_mode")` | 交易模式 |
| `licenseMode` | `LicenseMode?` | N | EXCLUSIVE/SOLE/NON_EXCLUSIVE | `@map("license_mode")` | 许可模式 |
| `priceType` | `PriceType` | Y | FIXED/NEGOTIABLE | `@map("price_type")` | 价格类型 |
| `priceAmount` | `Int?` | N | - | `@map("price_amount")` | 价格金额 |
| `depositAmount` | `Int` | Y | - | `@map("deposit_amount")` | 订金金额 |
| `deliverablesJson` | `Json?` | N | - | `@map("deliverables_json")` | 交付物JSON |
| `expectedCompletionDays` | `Int?` | N | - | `@map("expected_completion_days")` | 预计完成天 |
| `negotiableRangeFen` | `Int?` | N | - | `@map("negotiable_range_fen")` | 可议价范围分 |
| `negotiableRangePercent` | `Float?` | N | - | `@map("negotiable_range_percent")` | 可议价范围百分比 |
| `negotiableNote` | `String?` | N | - | `@map("negotiable_note")` | 可议价备注 |
| `pledgeStatus` | `PledgeStatus?` | N | NONE/PLEDGED/UNKNOWN | `@map("pledge_status")` | 质押状态 |
| `existingLicenseStatus` | `ExistingLicenseStatus?` | N | NONE/EXCLUSIVE/SOLE/NON_EXCLUSIVE/UNKNOWN | `@map("existing_license_status")` | 既有许可状态 |
| `encumbranceNote` | `String?` | N | - | `@map("encumbrance_note")` | 权利负担备注 |
| `regionCode` | `String?` | N | - | `@map("region_code")` | 地区编码 |
| `industryTagsJson` | `Json?` | N | - | `@map("industry_tags_json")` | 行业标签JSON |
| `listingTopicsJson` | `Json?` | N | - | `@map("listing_topics_json")` | 挂牌主题JSON |
| `proofFileIdsJson` | `Json?` | N | - | `@map("proof_file_ids_json")` | 凭证文件IDJSON |
| `consultationRouting` | `ConsultationRouting` | Y | PLATFORM/OWNER | `@default(PLATFORM) @map("consultation_routing")` | 咨询路由 |
| `featuredLevel` | `FeaturedLevel` | Y | NONE/CITY/PROVINCE | `@default(NONE) @map("featured_level")` | 推荐级别 |
| `featuredRegionCode` | `String?` | N | - | `@map("featured_region_code")` | 推荐地区编码 |
| `featuredRank` | `Int?` | N | - | `@map("featured_rank")` | 推荐排名 |
| `featuredUntil` | `DateTime?` | N | - | `@map("featured_until")` | 推荐截止 |
| `auditStatus` | `AuditStatus` | Y | PENDING/APPROVED/REJECTED | `@default(PENDING) @map("audit_status")` | 审计状态 |
| `status` | `ListingStatus` | Y | DRAFT/ACTIVE/OFF_SHELF/SOLD | `@default(DRAFT)` | 状态 |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `seller` | `User` | Y | - | `@relation("Listing_Seller", fields: [sellerUserId], references: [id])` | 卖方 |
| `patent` | `Patent?` | N | - | `@relation(fields: [patentId], references: [id])` | 专利 |
| `region` | `Region?` | N | - | `@relation(fields: [regionCode], references: [code])` | 地区 |
| `media` | `ListingMedia[]` | Y | - | `-` | 媒体 |
| `auditLogs` | `ListingAuditLog[]` | Y | - | `-` | 审计日志 |
| `stats` | `ListingStats?` | N | - | `-` | 统计 |
| `favorites` | `ListingFavorite[]` | Y | - | `-` | 收藏 |
| `consultEvents` | `ListingConsultEvent[]` | Y | - | `-` | 咨询事件 |
| `orders` | `Order[]` | Y | - | `-` | 订单 |
| `conversations` | `Conversation[]` | Y | - | `-` | 会话 |
| `batchJobItems` | `ListingBatchJobItem[]` | Y | - | `-` | 批次任务条目 |
| `importJobRows` | `ListingImportJobRow[]` | Y | - | `-` | 导入任务行 |

### 6.25 `ListingAuditLog`

表级属性：
- `@@index([listingId, createdAt])`
- `@@map("listing_audit_logs")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `listingId` | `String` | Y | - | `@map("listing_id") @db.Uuid` | 挂牌ID |
| `reviewerId` | `String` | Y | - | `@map("reviewer_id") @db.Uuid` | 审核人ID |
| `action` | `ListingAuditAction` | Y | APPROVE/REJECT | `-` | 操作 |
| `reason` | `String?` | N | - | `-` | 原因 |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `listing` | `Listing` | Y | - | `@relation(fields: [listingId], references: [id])` | 挂牌 |
| `reviewer` | `User` | Y | - | `@relation("ListingAuditLog_Reviewer", fields: [reviewerId], references: [id])` | 审核人 |

### 6.26 `ListingBatchJob`

表级属性：
- `@@index([operatorUserId, createdAt])`
- `@@index([status, createdAt])`
- `@@map("listing_batch_jobs")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `operatorUserId` | `String` | Y | - | `@map("operator_user_id") @db.Uuid` | 操作人用户ID |
| `action` | `ListingBatchAction` | Y | APPROVE/REJECT/PUBLISH/OFF_SHELF | `-` | 操作 |
| `reason` | `String?` | N | - | `-` | 原因 |
| `status` | `ListingJobStatus` | Y | PENDING/RUNNING/PAUSED/SUCCEEDED/FAILED | `@default(PENDING)` | 状态 |
| `totalCount` | `Int` | Y | - | `@default(0) @map("total_count")` | 总数量 |
| `successCount` | `Int` | Y | - | `@default(0) @map("success_count")` | 成功数量 |
| `failedCount` | `Int` | Y | - | `@default(0) @map("failed_count")` | 失败数量 |
| `skippedCount` | `Int` | Y | - | `@default(0) @map("skipped_count")` | 跳过数量 |
| `failRate` | `Float` | Y | - | `@default(0) @map("fail_rate")` | 失败费率 |
| `startedAt` | `DateTime?` | N | - | `@map("started_at")` | 开始时间 |
| `finishedAt` | `DateTime?` | N | - | `@map("finished_at")` | 完成时间 |
| `pausedAt` | `DateTime?` | N | - | `@map("paused_at")` | 暂停时间 |
| `errorFileId` | `String?` | N | - | `@map("error_file_id") @db.Uuid` | 错误文件ID |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `operator` | `User` | Y | - | `@relation("ListingBatchJob_Operator", fields: [operatorUserId], references: [id])` | 操作人 |
| `errorFile` | `File?` | N | - | `@relation("ListingBatchJob_ErrorFile", fields: [errorFileId], references: [id])` | 错误文件 |
| `items` | `ListingBatchJobItem[]` | Y | - | `-` | 条目 |

### 6.27 `ListingBatchJobItem`

表级属性：
- `@@unique([jobId, listingId])`
- `@@index([jobId, status])`
- `@@index([listingId, createdAt])`
- `@@map("listing_batch_job_items")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `jobId` | `String` | Y | - | `@map("job_id") @db.Uuid` | 任务ID |
| `listingId` | `String` | Y | - | `@map("listing_id") @db.Uuid` | 挂牌ID |
| `status` | `ListingBatchItemStatus` | Y | PENDING/SUCCEEDED/FAILED/SKIPPED | `@default(PENDING)` | 状态 |
| `errorCode` | `String?` | N | - | `@map("error_code")` | 错误编码 |
| `errorMessage` | `String?` | N | - | `@map("error_message")` | 错误消息 |
| `processedAt` | `DateTime?` | N | - | `@map("processed_at")` | 处理时间 |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `job` | `ListingBatchJob` | Y | - | `@relation(fields: [jobId], references: [id])` | 任务 |
| `listing` | `Listing` | Y | - | `@relation(fields: [listingId], references: [id])` | 挂牌 |

### 6.28 `ListingConsultEvent`

表级属性：
- `@@index([listingId, createdAt])`
- `@@map("listing_consult_events")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `listingId` | `String` | Y | - | `@map("listing_id") @db.Uuid` | 挂牌ID |
| `userId` | `String` | Y | - | `@map("user_id") @db.Uuid` | 用户ID |
| `channel` | `ConsultChannel` | Y | WECHAT_CS/PHONE/FORM | `-` | 渠道 |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `listing` | `Listing` | Y | - | `@relation(fields: [listingId], references: [id])` | 挂牌 |
| `user` | `User` | Y | - | `@relation(fields: [userId], references: [id])` | 用户 |

### 6.29 `ListingFavorite`

表级属性：
- `@@unique([listingId, userId])`
- `@@map("listing_favorites")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `listingId` | `String` | Y | - | `@map("listing_id") @db.Uuid` | 挂牌ID |
| `userId` | `String` | Y | - | `@map("user_id") @db.Uuid` | 用户ID |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `listing` | `Listing` | Y | - | `@relation(fields: [listingId], references: [id])` | 挂牌 |
| `user` | `User` | Y | - | `@relation(fields: [userId], references: [id])` | 用户 |

### 6.30 `ListingImportJob`

表级属性：
- `@@index([operatorUserId, createdAt])`
- `@@index([status, createdAt])`
- `@@index([fileId])`
- `@@map("listing_import_jobs")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `operatorUserId` | `String` | Y | - | `@map("operator_user_id") @db.Uuid` | 操作人用户ID |
| `fileId` | `String` | Y | - | `@map("file_id") @db.Uuid` | 文件ID |
| `duplicatePolicy` | `ListingImportDuplicatePolicy` | Y | SKIP/OVERWRITE | `@default(SKIP) @map("duplicate_policy")` | 重复策略 |
| `defaultsJson` | `Json?` | N | - | `@map("defaults_json")` | 默认JSON |
| `status` | `ListingJobStatus` | Y | PENDING/RUNNING/PAUSED/SUCCEEDED/FAILED | `@default(PENDING)` | 状态 |
| `totalCount` | `Int` | Y | - | `@default(0) @map("total_count")` | 总数量 |
| `validCount` | `Int` | Y | - | `@default(0) @map("valid_count")` | 有效数量 |
| `invalidCount` | `Int` | Y | - | `@default(0) @map("invalid_count")` | 无效数量 |
| `successCount` | `Int` | Y | - | `@default(0) @map("success_count")` | 成功数量 |
| `failedCount` | `Int` | Y | - | `@default(0) @map("failed_count")` | 失败数量 |
| `skippedCount` | `Int` | Y | - | `@default(0) @map("skipped_count")` | 跳过数量 |
| `failRate` | `Float` | Y | - | `@default(0) @map("fail_rate")` | 失败费率 |
| `validatedAt` | `DateTime?` | N | - | `@map("validated_at")` | 已校验时间 |
| `startedAt` | `DateTime?` | N | - | `@map("started_at")` | 开始时间 |
| `finishedAt` | `DateTime?` | N | - | `@map("finished_at")` | 完成时间 |
| `pausedAt` | `DateTime?` | N | - | `@map("paused_at")` | 暂停时间 |
| `errorFileId` | `String?` | N | - | `@map("error_file_id") @db.Uuid` | 错误文件ID |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `operator` | `User` | Y | - | `@relation("ListingImportJob_Operator", fields: [operatorUserId], references: [id])` | 操作人 |
| `sourceFile` | `File` | Y | - | `@relation("ListingImportJob_SourceFile", fields: [fileId], references: [id])` | 来源文件 |
| `errorFile` | `File?` | N | - | `@relation("ListingImportJob_ErrorFile", fields: [errorFileId], references: [id])` | 错误文件 |
| `rows` | `ListingImportJobRow[]` | Y | - | `-` | 行 |

### 6.31 `ListingImportJobRow`

表级属性：
- `@@unique([jobId, rowNo])`
- `@@index([jobId, status])`
- `@@index([listingId, createdAt])`
- `@@map("listing_import_job_rows")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `jobId` | `String` | Y | - | `@map("job_id") @db.Uuid` | 任务ID |
| `rowNo` | `Int` | Y | - | `@map("row_no")` | 行编号 |
| `status` | `ListingImportRowStatus` | Y | PENDING/VALID/INVALID/SUCCEEDED/FAILED/SKIPPED | `@default(PENDING)` | 状态 |
| `rawJson` | `Json` | Y | - | `@map("raw_json")` | 原始JSON |
| `normalizedJson` | `Json?` | N | - | `@map("normalized_json")` | 规范化JSON |
| `listingId` | `String?` | N | - | `@map("listing_id") @db.Uuid` | 挂牌ID |
| `errorCode` | `String?` | N | - | `@map("error_code")` | 错误编码 |
| `errorMessage` | `String?` | N | - | `@map("error_message")` | 错误消息 |
| `processedAt` | `DateTime?` | N | - | `@map("processed_at")` | 处理时间 |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `job` | `ListingImportJob` | Y | - | `@relation(fields: [jobId], references: [id])` | 任务 |
| `listing` | `Listing?` | N | - | `@relation(fields: [listingId], references: [id])` | 挂牌 |

### 6.32 `ListingMedia`

表级属性：
- `@@index([listingId, sort])`
- `@@map("listing_media")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `listingId` | `String` | Y | - | `@map("listing_id") @db.Uuid` | 挂牌ID |
| `fileId` | `String` | Y | - | `@map("file_id") @db.Uuid` | 文件ID |
| `type` | `ListingMediaType` | Y | IMAGE/FILE | `-` | 类型 |
| `sort` | `Int` | Y | - | `@default(0)` | 排序 |
| `listing` | `Listing` | Y | - | `@relation(fields: [listingId], references: [id])` | 挂牌 |
| `file` | `File` | Y | - | `@relation(fields: [fileId], references: [id])` | 文件 |

### 6.33 `ListingStats`

表级属性：
- `@@map("listing_stats")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `listingId` | `String` | Y | - | `@id @map("listing_id") @db.Uuid` | 挂牌ID |
| `viewCount` | `Int` | Y | - | `@default(0) @map("view_count")` | 浏览数量 |
| `favoriteCount` | `Int` | Y | - | `@default(0) @map("favorite_count")` | 收藏数量 |
| `consultCount` | `Int` | Y | - | `@default(0) @map("consult_count")` | 咨询数量 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `listing` | `Listing` | Y | - | `@relation(fields: [listingId], references: [id])` | 挂牌 |

### 6.34 `Notification`

表级属性：
- `@@index([userId, createdAt])`
- `@@map("notifications")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `userId` | `String` | Y | - | `@map("user_id") @db.Uuid` | 用户ID |
| `kind` | `NotificationKind` | Y | system/cs | `-` | 类别 |
| `title` | `String` | Y | - | `-` | 标题 |
| `summary` | `String` | Y | - | `-` | 摘要 |
| `source` | `String` | Y | - | `-` | 来源 |
| `readAt` | `DateTime?` | N | - | `@map("read_at")` | 已读时间 |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `user` | `User` | Y | - | `@relation(fields: [userId], references: [id])` | 用户 |

### 6.35 `Order`

表级属性：
- `@@index([status, createdAt])`
- `@@map("orders")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `listingId` | `String` | Y | - | `@map("listing_id") @db.Uuid` | 挂牌ID |
| `buyerUserId` | `String` | Y | - | `@map("buyer_user_id") @db.Uuid` | 买方用户ID |
| `assignedCsUserId` | `String?` | N | - | `@map("assigned_cs_user_id") @db.Uuid` | 已分配客服用户ID |
| `status` | `String` | Y | - | `-` | 状态 |
| `dealAmount` | `Int?` | N | - | `@map("deal_amount")` | 成交金额 |
| `depositAmount` | `Int` | Y | - | `@map("deposit_amount")` | 订金金额 |
| `finalAmount` | `Int?` | N | - | `@map("final_amount")` | 尾款金额 |
| `commissionAmount` | `Int?` | N | - | `@map("commission_amount")` | 佣金金额 |
| `invoiceNo` | `String?` | N | - | `@map("invoice_no")` | 发票编号 |
| `invoiceFileId` | `String?` | N | - | `@map("invoice_file_id") @db.Uuid` | 发票文件ID |
| `invoiceIssuedAt` | `DateTime?` | N | - | `@map("invoice_issued_at")` | 发票发放时间 |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `listing` | `Listing` | Y | - | `@relation(fields: [listingId], references: [id])` | 挂牌 |
| `buyer` | `User` | Y | - | `@relation("Order_Buyer", fields: [buyerUserId], references: [id])` | 买方 |
| `assignedCs` | `User?` | N | - | `@relation("Order_AssignedCs", fields: [assignedCsUserId], references: [id])` | 已分配客服 |
| `invoiceFile` | `File?` | N | - | `@relation(fields: [invoiceFileId], references: [id])` | 发票文件 |
| `payments` | `Payment[]` | Y | - | `-` | 支付 |
| `paymentWebhookEvents` | `PaymentWebhookEvent[]` | Y | - | `-` | 支付回调事件 |
| `refundRequests` | `RefundRequest[]` | Y | - | `-` | 退款请求 |
| `csCases` | `CsCase[]` | Y | - | `-` | 客服工单 |
| `settlement` | `Settlement?` | N | - | `-` | 结算 |
| `conversations` | `Conversation[]` | Y | - | `-` | 会话 |
| `contract` | `Contract?` | N | - | `-` | 合同 |

### 6.36 `Patent`

表级属性：
- `@@unique([jurisdiction, applicationNoNorm])`
- `@@index([jurisdiction, applicationNoNorm])`
- `@@index([ownerUserId])`
- `@@map("patents")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `jurisdiction` | `String` | Y | - | `@default("CN")` | 法域 |
| `applicationNoNorm` | `String` | Y | - | `@map("application_no_norm")` | 申请编号规范 |
| `applicationNoDisplay` | `String?` | N | - | `@map("application_no_display")` | 申请编号显示 |
| `patentType` | `PatentType` | Y | INVENTION/UTILITY_MODEL/DESIGN | `@map("patent_type")` | 专利类型 |
| `title` | `String` | Y | - | `-` | 标题 |
| `abstract` | `String?` | N | - | `-` | 摘要 |
| `filingDate` | `DateTime?` | N | - | `@map("filing_date") @db.Date` | 申请日期 |
| `publicationDate` | `DateTime?` | N | - | `@map("publication_date") @db.Date` | 公开日期 |
| `grantDate` | `DateTime?` | N | - | `@map("grant_date") @db.Date` | 授权日期 |
| `legalStatus` | `String?` | N | - | `@map("legal_status")` | 法律状态 |
| `legalStatusRaw` | `String?` | N | - | `@map("legal_status_raw")` | 法律状态原始 |
| `publicationNoDisplay` | `String?` | N | - | `@map("publication_no_display")` | 公开编号显示 |
| `patentNoDisplay` | `String?` | N | - | `@map("patent_no_display")` | 专利编号显示 |
| `grantPublicationNoDisplay` | `String?` | N | - | `@map("grant_publication_no_display")` | 授权公开编号显示 |
| `transferCount` | `Int` | Y | - | `@default(0) @map("transfer_count")` | 转让数量 |
| `sourcePrimary` | `PatentSourcePrimary` | Y | USER/ADMIN/PROVIDER | `@default(USER) @map("source_primary")` | 来源主要 |
| `sourceUpdatedAt` | `DateTime?` | N | - | `@map("source_updated_at")` | 来源更新时间 |
| `ownerUserId` | `String?` | N | - | `@map("owner_user_id") @db.Uuid` | 所有者用户ID |
| `ownerClaimedAt` | `DateTime?` | N | - | `@map("owner_claimed_at")` | 所有者已认领时间 |
| `ownerClaimSource` | `PatentOwnerClaimSource?` | N | PLATFORM_IMPORT/USER_CLAIM/ADMIN_ASSIGN | `@map("owner_claim_source")` | 所有者认领来源 |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `identifiers` | `PatentIdentifier[]` | Y | - | `-` | 标识 |
| `classifications` | `PatentClassification[]` | Y | - | `-` | 分类 |
| `parties` | `PatentParty[]` | Y | - | `-` | 参与方 |
| `listings` | `Listing[]` | Y | - | `-` | 挂牌 |
| `legalEvents` | `PatentLegalEvent[]` | Y | - | `-` | 法律事件 |
| `maintenanceSchedules` | `PatentMaintenanceSchedule[]` | Y | - | `-` | 维保日程 |
| `owner` | `User?` | N | - | `@relation("Patent_Owner", fields: [ownerUserId], references: [id])` | 所有者 |
| `importRows` | `PatentImportJobRow[]` | Y | - | `-` | 导入行 |
| `claimRequests` | `PatentClaimRequest[]` | Y | - | `-` | 认领请求 |

### 6.37 `PatentClaimRequest`

表级属性：
- `@@index([patentId, status, createdAt])`
- `@@index([applicantUserId, status, createdAt])`
- `@@index([status, submittedAt])`
- `@@map("patent_claim_requests")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `patentId` | `String` | Y | - | `@map("patent_id") @db.Uuid` | 专利ID |
| `applicantUserId` | `String` | Y | - | `@map("applicant_user_id") @db.Uuid` | 申请人用户ID |
| `status` | `PatentClaimStatus` | Y | PENDING/APPROVED/REJECTED | `@default(PENDING)` | 状态 |
| `claimReason` | `String?` | N | - | `@map("claim_reason")` | 认领原因 |
| `evidenceFileIdsJson` | `Json?` | N | - | `@map("evidence_file_ids_json")` | 凭证文件IDJSON |
| `reviewerUserId` | `String?` | N | - | `@map("reviewer_user_id") @db.Uuid` | 审核人用户ID |
| `reviewComment` | `String?` | N | - | `@map("review_comment")` | 审核评论 |
| `submittedAt` | `DateTime` | Y | - | `@default(now()) @map("submitted_at")` | 已提交时间 |
| `reviewedAt` | `DateTime?` | N | - | `@map("reviewed_at")` | 已审核时间 |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `patent` | `Patent` | Y | - | `@relation(fields: [patentId], references: [id])` | 专利 |
| `applicant` | `User` | Y | - | `@relation("PatentClaimRequest_Applicant", fields: [applicantUserId], references: [id])` | 申请人 |
| `reviewer` | `User?` | N | - | `@relation("PatentClaimRequest_Reviewer", fields: [reviewerUserId], references: [id])` | 审核人 |

### 6.38 `PatentClassification`

表级属性：
- `@@unique([patentId, system, code])`
- `@@map("patent_classifications")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `patentId` | `String` | Y | - | `@map("patent_id") @db.Uuid` | 专利ID |
| `system` | `ClassificationSystem` | Y | IPC/LOC/CPC | `-` | 系统 |
| `code` | `String` | Y | - | `-` | 编码 |
| `isMain` | `Boolean` | Y | - | `@default(false) @map("is_main")` | 是否主 |
| `patent` | `Patent` | Y | - | `@relation(fields: [patentId], references: [id])` | 专利 |

### 6.39 `PatentIdentifier`

表级属性：
- `@@unique([idType, idValueNorm])`
- `@@unique([idValueNorm])`
- `@@map("patent_identifiers")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `patentId` | `String` | Y | - | `@map("patent_id") @db.Uuid` | 专利ID |
| `idType` | `PatentIdentifierType` | Y | APPLICATION/PATENT/PUBLICATION | `@map("id_type")` | ID类型 |
| `idValueNorm` | `String` | Y | - | `@map("id_value_norm")` | ID数值规范 |
| `kindCode` | `String?` | N | - | `@map("kind_code")` | 类别编码 |
| `dateRef` | `DateTime?` | N | - | `@map("date_ref") @db.Date` | 日期参考 |
| `patent` | `Patent` | Y | - | `@relation(fields: [patentId], references: [id])` | 专利 |

### 6.40 `PatentImportJob`

表级属性：
- `@@index([operatorUserId, createdAt])`
- `@@index([status, createdAt])`
- `@@index([fileId])`
- `@@map("patent_import_jobs")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `operatorUserId` | `String` | Y | - | `@map("operator_user_id") @db.Uuid` | 操作人用户ID |
| `fileId` | `String` | Y | - | `@map("file_id") @db.Uuid` | 文件ID |
| `duplicatePolicy` | `PatentImportDuplicatePolicy` | Y | SKIP/OVERWRITE | `@default(SKIP) @map("duplicate_policy")` | 重复策略 |
| `defaultsJson` | `Json?` | N | - | `@map("defaults_json")` | 默认JSON |
| `status` | `PatentJobStatus` | Y | PENDING/RUNNING/PAUSED/SUCCEEDED/FAILED | `@default(PENDING)` | 状态 |
| `totalCount` | `Int` | Y | - | `@default(0) @map("total_count")` | 总数量 |
| `validCount` | `Int` | Y | - | `@default(0) @map("valid_count")` | 有效数量 |
| `invalidCount` | `Int` | Y | - | `@default(0) @map("invalid_count")` | 无效数量 |
| `successCount` | `Int` | Y | - | `@default(0) @map("success_count")` | 成功数量 |
| `failedCount` | `Int` | Y | - | `@default(0) @map("failed_count")` | 失败数量 |
| `skippedCount` | `Int` | Y | - | `@default(0) @map("skipped_count")` | 跳过数量 |
| `failRate` | `Float` | Y | - | `@default(0) @map("fail_rate")` | 失败费率 |
| `validatedAt` | `DateTime?` | N | - | `@map("validated_at")` | 已校验时间 |
| `startedAt` | `DateTime?` | N | - | `@map("started_at")` | 开始时间 |
| `finishedAt` | `DateTime?` | N | - | `@map("finished_at")` | 完成时间 |
| `pausedAt` | `DateTime?` | N | - | `@map("paused_at")` | 暂停时间 |
| `errorFileId` | `String?` | N | - | `@map("error_file_id") @db.Uuid` | 错误文件ID |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `operator` | `User` | Y | - | `@relation("PatentImportJob_Operator", fields: [operatorUserId], references: [id])` | 操作人 |
| `sourceFile` | `File` | Y | - | `@relation("PatentImportJob_SourceFile", fields: [fileId], references: [id])` | 来源文件 |
| `errorFile` | `File?` | N | - | `@relation("PatentImportJob_ErrorFile", fields: [errorFileId], references: [id])` | 错误文件 |
| `rows` | `PatentImportJobRow[]` | Y | - | `-` | 行 |

### 6.41 `PatentImportJobRow`

表级属性：
- `@@unique([jobId, rowNo])`
- `@@index([jobId, status])`
- `@@index([patentId, createdAt])`
- `@@map("patent_import_job_rows")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `jobId` | `String` | Y | - | `@map("job_id") @db.Uuid` | 任务ID |
| `rowNo` | `Int` | Y | - | `@map("row_no")` | 行编号 |
| `status` | `PatentImportRowStatus` | Y | PENDING/VALID/INVALID/SUCCEEDED/FAILED/SKIPPED | `@default(PENDING)` | 状态 |
| `rawJson` | `Json` | Y | - | `@map("raw_json")` | 原始JSON |
| `normalizedJson` | `Json?` | N | - | `@map("normalized_json")` | 规范化JSON |
| `patentId` | `String?` | N | - | `@map("patent_id") @db.Uuid` | 专利ID |
| `errorCode` | `String?` | N | - | `@map("error_code")` | 错误编码 |
| `errorMessage` | `String?` | N | - | `@map("error_message")` | 错误消息 |
| `processedAt` | `DateTime?` | N | - | `@map("processed_at")` | 处理时间 |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `job` | `PatentImportJob` | Y | - | `@relation(fields: [jobId], references: [id])` | 任务 |
| `patent` | `Patent?` | N | - | `@relation(fields: [patentId], references: [id])` | 专利 |

### 6.42 `PatentLegalEvent`

表级属性：
- `@@index([patentId, eventDate])`
- `@@map("patent_legal_events")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `patentId` | `String` | Y | - | `@map("patent_id") @db.Uuid` | 专利ID |
| `eventDate` | `DateTime` | Y | - | `@map("event_date") @db.Date` | 事件日期 |
| `eventCode` | `String` | Y | - | `@map("event_code")` | 事件编码 |
| `eventTextRaw` | `String` | Y | - | `@map("event_text_raw")` | 事件文本原始 |
| `source` | `String` | Y | - | `-` | 来源 |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `patent` | `Patent` | Y | - | `@relation(fields: [patentId], references: [id])` | 专利 |

### 6.43 `PatentMaintenanceOrder`

表级属性：
- `@@index([scheduleId, status])`
- `@@index([applicantUserId, createdAt])`
- `@@index([assignedCsUserId, status])`
- `@@map("patent_maintenance_orders")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `scheduleId` | `String` | Y | - | `@map("schedule_id") @db.Uuid` | 日程ID |
| `applicantUserId` | `String` | Y | - | `@map("applicant_user_id") @db.Uuid` | 申请人用户ID |
| `assignedCsUserId` | `String?` | N | - | `@map("assigned_cs_user_id") @db.Uuid` | 已分配客服用户ID |
| `status` | `PatentMaintenanceOrderStatus` | Y | REQUESTED/QUOTED/AWAITING_PAYMENT/PAID/EXECUTING/RECEIPT_UPLOADED/RECONCILED/CLOSED/CANCELLED | `@default(REQUESTED)` | 状态 |
| `paymentChannel` | `PatentMaintenancePaymentChannel?` | N | WECHAT/OFFLINE_BANK/OFFLINE_OTHER | `@map("payment_channel")` | 支付渠道 |
| `officialFeeFen` | `Int` | Y | - | `@default(0) @map("official_fee_fen")` | 官方费用分 |
| `lateFeeFen` | `Int` | Y | - | `@default(0) @map("late_fee_fen")` | 延迟费用分 |
| `serviceFeeFen` | `Int` | Y | - | `@default(0) @map("service_fee_fen")` | 服务费用分 |
| `totalAmountFen` | `Int` | Y | - | `@default(0) @map("total_amount_fen")` | 总金额分 |
| `paymentDeadline` | `DateTime?` | N | - | `@map("payment_deadline")` | 支付截止时间 |
| `paidAt` | `DateTime?` | N | - | `@map("paid_at")` | 已支付时间 |
| `executedAt` | `DateTime?` | N | - | `@map("executed_at")` | 执行时间 |
| `receiptIssuedAt` | `DateTime?` | N | - | `@map("receipt_issued_at")` | 回执发放时间 |
| `officialSubmissionNo` | `String?` | N | - | `@map("official_submission_no")` | 官方提交编号 |
| `officialReceiptNo` | `String?` | N | - | `@map("official_receipt_no")` | 官方回执编号 |
| `paymentTxnNo` | `String?` | N | - | `@map("payment_txn_no")` | 支付交易编号 |
| `officialReceiptFileId` | `String?` | N | - | `@map("official_receipt_file_id") @db.Uuid` | 官方回执文件ID |
| `reconcileStatus` | `PatentMaintenanceReconcileStatus` | Y | PENDING/MATCHED/MISMATCHED | `@default(PENDING) @map("reconcile_status")` | 对账状态 |
| `reconcileNote` | `String?` | N | - | `@map("reconcile_note")` | 对账备注 |
| `closeNote` | `String?` | N | - | `@map("close_note")` | 关闭备注 |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `schedule` | `PatentMaintenanceSchedule` | Y | - | `@relation(fields: [scheduleId], references: [id])` | 日程 |
| `applicantUser` | `User` | Y | - | `@relation("PatentMaintenanceOrder_Applicant", fields: [applicantUserId], references: [id])` | 申请人用户 |
| `assignedCsUser` | `User?` | N | - | `@relation("PatentMaintenanceOrder_Assignee", fields: [assignedCsUserId], references: [id])` | 已分配客服用户 |
| `officialReceiptFile` | `File?` | N | - | `@relation("PatentMaintenanceOrder_ReceiptFile", fields: [officialReceiptFileId], references: [id])` | 官方回执文件 |
| `events` | `PatentMaintenanceOrderEvent[]` | Y | - | `-` | 事件 |

### 6.44 `PatentMaintenanceOrderEvent`

表级属性：
- `@@index([orderId, createdAt])`
- `@@index([actorUserId, createdAt])`
- `@@map("patent_maintenance_order_events")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `orderId` | `String` | Y | - | `@map("order_id") @db.Uuid` | 订单ID |
| `actorUserId` | `String?` | N | - | `@map("actor_user_id") @db.Uuid` | 操作人用户ID |
| `eventType` | `PatentMaintenanceOrderEventType` | Y | CREATED/QUOTE_UPDATED/PAYMENT_CONFIRMED/EXECUTION_SUBMITTED/RECEIPT_UPLOADED/RECONCILED/CLOSED/CANCELLED/UPDATED | `@map("event_type")` | 事件类型 |
| `fromStatus` | `PatentMaintenanceOrderStatus?` | N | REQUESTED/QUOTED/AWAITING_PAYMENT/PAID/EXECUTING/RECEIPT_UPLOADED/RECONCILED/CLOSED/CANCELLED | `@map("from_status")` | 来源状态 |
| `toStatus` | `PatentMaintenanceOrderStatus` | Y | REQUESTED/QUOTED/AWAITING_PAYMENT/PAID/EXECUTING/RECEIPT_UPLOADED/RECONCILED/CLOSED/CANCELLED | `@map("to_status")` | 至状态 |
| `note` | `String?` | N | - | `-` | 备注 |
| `payloadJson` | `Json?` | N | - | `@map("payload_json")` | 载荷JSON |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `order` | `PatentMaintenanceOrder` | Y | - | `@relation(fields: [orderId], references: [id])` | 订单 |
| `actorUser` | `User?` | N | - | `@relation("PatentMaintenanceOrderEvent_Actor", fields: [actorUserId], references: [id])` | 操作人用户 |

### 6.45 `PatentMaintenanceSchedule`

表级属性：
- `@@unique([patentId, yearNo])`
- `@@index([status, dueDate])`
- `@@map("patent_maintenance_schedules")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `patentId` | `String` | Y | - | `@map("patent_id") @db.Uuid` | 专利ID |
| `yearNo` | `Int` | Y | - | `@map("year_no")` | 年编号 |
| `dueDate` | `DateTime` | Y | - | `@map("due_date") @db.Date` | 到期日期 |
| `gracePeriodEnd` | `DateTime?` | N | - | `@map("grace_period_end") @db.Date` | 宽限期间结束 |
| `status` | `PatentMaintenanceStatus` | Y | DUE/PAID/OVERDUE/WAIVED | `@default(DUE)` | 状态 |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `patent` | `Patent` | Y | - | `@relation(fields: [patentId], references: [id])` | 专利 |
| `tasks` | `PatentMaintenanceTask[]` | Y | - | `-` | 任务 |
| `orders` | `PatentMaintenanceOrder[]` | Y | - | `-` | 订单 |

### 6.46 `PatentMaintenanceTask`

表级属性：
- `@@index([scheduleId, status])`
- `@@index([assignedCsUserId])`
- `@@map("patent_maintenance_tasks")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `scheduleId` | `String` | Y | - | `@map("schedule_id") @db.Uuid` | 日程ID |
| `assignedCsUserId` | `String?` | N | - | `@map("assigned_cs_user_id") @db.Uuid` | 已分配客服用户ID |
| `status` | `PatentMaintenanceTaskStatus` | Y | OPEN/IN_PROGRESS/DONE/CANCELLED | `@default(OPEN)` | 状态 |
| `note` | `String?` | N | - | `-` | 备注 |
| `evidenceFileId` | `String?` | N | - | `@map("evidence_file_id") @db.Uuid` | 凭证文件ID |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `schedule` | `PatentMaintenanceSchedule` | Y | - | `@relation(fields: [scheduleId], references: [id])` | 日程 |
| `assignedCsUser` | `User?` | N | - | `@relation("PatentMaintenanceTask_Assignee", fields: [assignedCsUserId], references: [id])` | 已分配客服用户 |
| `evidenceFile` | `File?` | N | - | `@relation("PatentMaintenanceTask_Evidence", fields: [evidenceFileId], references: [id])` | 凭证文件 |

### 6.47 `PatentParty`

表级属性：
- `@@index([patentId, role])`
- `@@map("patent_parties")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `patentId` | `String` | Y | - | `@map("patent_id") @db.Uuid` | 专利ID |
| `role` | `PatentPartyRole` | Y | APPLICANT/INVENTOR/ASSIGNEE | `-` | 角色 |
| `name` | `String` | Y | - | `-` | 名称 |
| `countryCode` | `String?` | N | - | `@map("country_code")` | 国家编码 |
| `patent` | `Patent` | Y | - | `@relation(fields: [patentId], references: [id])` | 专利 |

### 6.48 `Payment`

表级属性：
- `@@index([orderId, payType])`
- `@@map("payments")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `orderId` | `String` | Y | - | `@map("order_id") @db.Uuid` | 订单ID |
| `payType` | `PaymentType` | Y | DEPOSIT/FINAL/REFUND/PAYOUT | `@map("pay_type")` | 支付类型 |
| `channel` | `PaymentChannel` | Y | WECHAT | `@default(WECHAT)` | 渠道 |
| `tradeNo` | `String` | Y | - | `@map("trade_no")` | 交易编号 |
| `amount` | `Int` | Y | - | `-` | 金额 |
| `status` | `String` | Y | - | `-` | 状态 |
| `paidAt` | `DateTime?` | N | - | `@map("paid_at")` | 已支付时间 |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `order` | `Order` | Y | - | `@relation(fields: [orderId], references: [id])` | 订单 |

### 6.49 `PaymentWebhookEvent`

表级属性：
- `@@unique([provider, eventId])`
- `@@index([orderId])`
- `@@index([refundRequestId])`
- `@@map("payment_webhook_events")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `provider` | `String` | Y | - | `-` | 服务商 |
| `eventId` | `String` | Y | - | `@map("event_id")` | 事件ID |
| `eventType` | `String?` | N | - | `@map("event_type")` | 事件类型 |
| `orderId` | `String?` | N | - | `@map("order_id") @db.Uuid` | 订单ID |
| `refundRequestId` | `String?` | N | - | `@map("refund_request_id") @db.Uuid` | 退款请求ID |
| `payType` | `PaymentType?` | N | DEPOSIT/FINAL/REFUND/PAYOUT | `@map("pay_type")` | 支付类型 |
| `tradeNo` | `String?` | N | - | `@map("trade_no")` | 交易编号 |
| `amount` | `Int?` | N | - | `-` | 金额 |
| `status` | `String` | Y | - | `-` | 状态 |
| `payloadJson` | `Json?` | N | - | `@map("payload_json")` | 载荷JSON |
| `processedAt` | `DateTime?` | N | - | `@map("processed_at")` | 处理时间 |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `order` | `Order?` | N | - | `@relation(fields: [orderId], references: [id])` | 订单 |
| `refundRequest` | `RefundRequest?` | N | - | `@relation(fields: [refundRequestId], references: [id])` | 退款请求 |

### 6.50 `RbacRole`

表级属性：
- `@@map("rbac_roles")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id` | ID |
| `name` | `String` | Y | - | `-` | 名称 |
| `description` | `String?` | N | - | `-` | 描述 |
| `permissionIds` | `Json?` | N | - | `@map("permission_ids_json")` | 权限ID |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `userRoles` | `RbacUserRole[]` | Y | - | `-` | 用户角色 |

### 6.51 `RbacUserRole`

表级属性：
- `@@id([userId, roleId])`
- `@@index([roleId])`
- `@@map("rbac_user_roles")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `userId` | `String` | Y | - | `@map("user_id") @db.Uuid` | 用户ID |
| `roleId` | `String` | Y | - | `@map("role_id")` | 角色ID |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `user` | `User` | Y | - | `@relation(fields: [userId], references: [id])` | 用户 |
| `role` | `RbacRole` | Y | - | `@relation(fields: [roleId], references: [id])` | 角色 |

### 6.52 `RefundRequest`

表级属性：
- `@@index([orderId, status])`
- `@@map("refund_requests")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `orderId` | `String` | Y | - | `@map("order_id") @db.Uuid` | 订单ID |
| `reasonCode` | `String` | Y | - | `@map("reason_code")` | 原因编码 |
| `reasonText` | `String?` | N | - | `@map("reason_text")` | 原因文本 |
| `status` | `RefundStatus` | Y | PENDING/APPROVED/REJECTED/REFUNDING/REFUNDED | `@default(PENDING)` | 状态 |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `order` | `Order` | Y | - | `@relation(fields: [orderId], references: [id])` | 订单 |
| `paymentWebhookEvents` | `PaymentWebhookEvent[]` | Y | - | `-` | 支付回调事件 |

### 6.53 `Region`

表级属性：
- `@@map("regions")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `code` | `String` | Y | - | `@id` | 编码 |
| `name` | `String` | Y | - | `-` | 名称 |
| `level` | `RegionLevel` | Y | PROVINCE/CITY/DISTRICT | `-` | 级别 |
| `parentCode` | `String?` | N | - | `@map("parent_code")` | 父级编码 |
| `centerLat` | `Float?` | N | - | `@map("center_lat")` | 中心纬度 |
| `centerLng` | `Float?` | N | - | `@map("center_lng")` | 中心经度 |
| `industryTagsJson` | `Json?` | N | - | `@map("industry_tags_json")` | 行业标签JSON |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `parent` | `Region?` | N | - | `@relation("Region_Parent", fields: [parentCode], references: [code])` | 父级 |
| `children` | `Region[]` | Y | - | `@relation("Region_Parent")` | 子项 |
| `users` | `User[]` | Y | - | `-` | 用户 |
| `listings` | `Listing[]` | Y | - | `-` | 挂牌 |
| `achievements` | `Achievement[]` | Y | - | `-` | 成果 |
| `verifications` | `UserVerification[]` | Y | - | `-` | 认证审核 |

### 6.54 `Settlement`

表级属性：
- `@@index([payoutStatus])`
- `@@map("settlements")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `orderId` | `String` | Y | - | `@unique @map("order_id") @db.Uuid` | 订单ID |
| `grossAmount` | `Int` | Y | - | `@map("gross_amount")` | 总额金额 |
| `commissionAmount` | `Int` | Y | - | `@map("commission_amount")` | 佣金金额 |
| `payoutAmount` | `Int` | Y | - | `@map("payout_amount")` | 放款金额 |
| `payoutMethod` | `SettlementPayoutMethod` | Y | MANUAL/WECHAT | `@map("payout_method")` | 放款方式 |
| `payoutStatus` | `SettlementPayoutStatus` | Y | PENDING/SUCCEEDED/FAILED | `@map("payout_status")` | 放款状态 |
| `payoutRef` | `String?` | N | - | `@map("payout_ref")` | 放款参考 |
| `payoutEvidenceFileId` | `String?` | N | - | `@map("payout_evidence_file_id") @db.Uuid` | 放款凭证文件ID |
| `payoutAt` | `DateTime?` | N | - | `@map("payout_at")` | 放款时间 |
| `status` | `String` | Y | - | `-` | 状态 |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `order` | `Order` | Y | - | `@relation(fields: [orderId], references: [id])` | 订单 |
| `payoutEvidenceFile` | `File?` | N | - | `@relation(fields: [payoutEvidenceFileId], references: [id])` | 放款凭证文件 |

### 6.55 `SystemConfig`

表级属性：
- `@@map("system_configs")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `key` | `String` | Y | - | `@unique` | 键 |
| `valueType` | `SystemConfigValueType` | Y | INT/DECIMAL/STRING/JSON/BOOL | `@map("value_type")` | 数值类型 |
| `value` | `String` | Y | - | `-` | 数值 |
| `scope` | `SystemConfigScope` | Y | GLOBAL/TENANT | `-` | 范围 |
| `version` | `Int` | Y | - | `@default(1)` | 版本 |
| `updatedById` | `String?` | N | - | `@map("updated_by") @db.Uuid` | 更新由ID |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `updatedBy` | `User?` | N | - | `@relation("SystemConfig_UpdatedBy", fields: [updatedById], references: [id])` | 更新由 |

### 6.56 `TechManagerProfile`

表级属性：
- `@@index([featuredRank])`
- `@@map("tech_manager_profiles")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `userId` | `String` | Y | - | `@id @map("user_id") @db.Uuid` | 用户ID |
| `intro` | `String?` | N | - | `-` | 简介 |
| `serviceTagsJson` | `Json?` | N | - | `@map("service_tags_json")` | 服务标签JSON |
| `featuredRank` | `Int?` | N | - | `@map("featured_rank")` | 推荐排名 |
| `featuredUntil` | `DateTime?` | N | - | `@map("featured_until")` | 推荐截止 |
| `consultCount` | `Int` | Y | - | `@default(0) @map("consult_count")` | 咨询数量 |
| `dealCount` | `Int` | Y | - | `@default(0) @map("deal_count")` | 成交数量 |
| `ratingScore` | `Float` | Y | - | `@default(0) @map("rating_score")` | 评分分值 |
| `ratingCount` | `Int` | Y | - | `@default(0) @map("rating_count")` | 评分数量 |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `user` | `User` | Y | - | `@relation(fields: [userId], references: [id])` | 用户 |

### 6.57 `User`

表级属性：
- `@@map("users")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `phone` | `String?` | N | - | `@unique` | 手机号 |
| `nickname` | `String?` | N | - | `-` | 昵称 |
| `avatarUrl` | `String?` | N | - | `@map("avatar_url")` | 头像链接 |
| `wechatOpenid` | `String?` | N | - | `@unique @map("wechat_openid")` | 微信开放ID |
| `role` | `UserRole` | Y | buyer/seller/cs/operator/finance/admin | `-` | 角色 |
| `regionCode` | `String?` | N | - | `@map("region_code")` | 地区编码 |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `region` | `Region?` | N | - | `@relation(fields: [regionCode], references: [code])` | 地区 |
| `verifications` | `UserVerification[]` | Y | - | `@relation("UserVerification_User")` | 认证审核 |
| `reviewedVerifications` | `UserVerification[]` | Y | - | `@relation("UserVerification_Reviewer")` | 已审核认证 |
| `techManagerProfile` | `TechManagerProfile?` | N | - | `-` | 技术经理资料 |
| `listings` | `Listing[]` | Y | - | `@relation("Listing_Seller")` | 挂牌 |
| `achievements` | `Achievement[]` | Y | - | `@relation("Achievement_Publisher")` | 成果 |
| `orders` | `Order[]` | Y | - | `@relation("Order_Buyer")` | 订单 |
| `assignedOrders` | `Order[]` | Y | - | `@relation("Order_AssignedCs")` | 已分配订单 |
| `listingAuditLogs` | `ListingAuditLog[]` | Y | - | `@relation("ListingAuditLog_Reviewer")` | 挂牌审计日志 |
| `listingFavorites` | `ListingFavorite[]` | Y | - | `-` | 挂牌收藏 |
| `achievementFavorites` | `AchievementFavorite[]` | Y | - | `-` | 成果收藏 |
| `listingConsultEvents` | `ListingConsultEvent[]` | Y | - | `-` | 挂牌咨询事件 |
| `listingBatchJobs` | `ListingBatchJob[]` | Y | - | `@relation("ListingBatchJob_Operator")` | 挂牌批次任务 |
| `listingImportJobs` | `ListingImportJob[]` | Y | - | `@relation("ListingImportJob_Operator")` | 挂牌导入任务 |
| `userTagScores` | `UserTagScore[]` | Y | - | `-` | 用户标签分值 |
| `conversationsAsBuyer` | `Conversation[]` | Y | - | `@relation("Conversation_Buyer")` | 会话作为买方 |
| `conversationsAsSeller` | `Conversation[]` | Y | - | `@relation("Conversation_Seller")` | 会话作为卖方 |
| `conversationParticipants` | `ConversationParticipant[]` | Y | - | `-` | 会话参与者 |
| `sentMessages` | `ConversationMessage[]` | Y | - | `@relation("ConversationMessage_Sender")` | 已发送消息 |
| `notifications` | `Notification[]` | Y | - | `-` | 通知 |
| `addresses` | `Address[]` | Y | - | `-` | 地址 |
| `comments` | `Comment[]` | Y | - | `-` | 评论 |
| `csCases` | `CsCase[]` | Y | - | `@relation("CsCase_Cs")` | 客服工单 |
| `caseNotes` | `CsCaseNote[]` | Y | - | `@relation("CsCaseNote_Author")` | 工单备注 |
| `systemConfigsUpdated` | `SystemConfig[]` | Y | - | `@relation("SystemConfig_UpdatedBy")` | 系统配置更新 |
| `auditLogs` | `AuditLog[]` | Y | - | `@relation("AuditLog_Actor")` | 审计日志 |
| `idempotencyKeys` | `IdempotencyKey[]` | Y | - | `-` | 幂等键 |
| `rbacRoles` | `RbacUserRole[]` | Y | - | `-` | 权限角色 |
| `aiParseFeedbacks` | `AiParseFeedback[]` | Y | - | `@relation("AiParseFeedback_Actor")` | 智能解析反馈 |
| `assignedMaintenanceTasks` | `PatentMaintenanceTask[]` | Y | - | `@relation("PatentMaintenanceTask_Assignee")` | 已分配维保任务 |
| `maintenanceOrdersAsApplicant` | `PatentMaintenanceOrder[]` | Y | - | `@relation("PatentMaintenanceOrder_Applicant")` | 维保订单作为申请人 |
| `assignedMaintenanceOrders` | `PatentMaintenanceOrder[]` | Y | - | `@relation("PatentMaintenanceOrder_Assignee")` | 已分配维保订单 |
| `maintenanceOrderEvents` | `PatentMaintenanceOrderEvent[]` | Y | - | `@relation("PatentMaintenanceOrderEvent_Actor")` | 维保订单事件 |
| `patentsOwned` | `Patent[]` | Y | - | `@relation("Patent_Owner")` | 专利已拥有 |
| `patentImportJobs` | `PatentImportJob[]` | Y | - | `@relation("PatentImportJob_Operator")` | 专利导入任务 |
| `patentClaimRequests` | `PatentClaimRequest[]` | Y | - | `@relation("PatentClaimRequest_Applicant")` | 专利认领请求 |
| `reviewedPatentClaimRequests` | `PatentClaimRequest[]` | Y | - | `@relation("PatentClaimRequest_Reviewer")` | 已审核专利认领请求 |
| `conversationAgentAssignments` | `ConversationAgent[]` | Y | - | `@relation("ConversationAgent_Operator")` | 会话坐席分配 |
| `conversationAgentAssignedBy` | `ConversationAgent[]` | Y | - | `@relation("ConversationAgent_AssignedBy")` | 会话坐席已分配由 |

### 6.58 `UserTagScore`

表级属性：
- `@@unique([userId, tag])`
- `@@map("user_tag_scores")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `userId` | `String` | Y | - | `@map("user_id") @db.Uuid` | 用户ID |
| `tag` | `String` | Y | - | `-` | 标签 |
| `score` | `Int` | Y | - | `@default(0)` | 分值 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `user` | `User` | Y | - | `@relation(fields: [userId], references: [id])` | 用户 |

### 6.59 `UserVerification`

表级属性：
- `@@index([userId, verificationStatus])`
- `@@map("user_verifications")`

| 字段 | 类型 | 必填 | 枚举 | Prisma 属性 | 字段说明 |
|---|---|---|---|---|---|
| `id` | `String` | Y | - | `@id @default(uuid()) @db.Uuid` | ID |
| `userId` | `String` | Y | - | `@map("user_id") @db.Uuid` | 用户ID |
| `verificationType` | `VerificationType` | Y | PERSON/COMPANY/ACADEMY/GOVERNMENT/ASSOCIATION/TECH_MANAGER | `@map("type")` | 认证类型 |
| `verificationStatus` | `VerificationStatus` | Y | PENDING/APPROVED/REJECTED | `@map("status")` | 认证状态 |
| `displayName` | `String` | Y | - | `@map("display_name")` | 显示名称 |
| `unifiedSocialCreditCodeEnc` | `String?` | N | - | `@map("unified_social_credit_code_enc")` | 统一社会信用编码加密 |
| `contactName` | `String?` | N | - | `@map("contact_name")` | 联系名称 |
| `contactPhone` | `String?` | N | - | `@map("contact_phone")` | 联系手机号 |
| `regionCode` | `String?` | N | - | `@map("region_code")` | 地区编码 |
| `intro` | `String?` | N | - | `-` | 简介 |
| `logoFileId` | `String?` | N | - | `@map("logo_file_id") @db.Uuid` | 标识文件ID |
| `evidenceFileIdsJson` | `Json?` | N | - | `@map("evidence_file_ids_json")` | 凭证文件IDJSON |
| `submittedAt` | `DateTime` | Y | - | `@map("submitted_at")` | 已提交时间 |
| `reviewedAt` | `DateTime?` | N | - | `@map("reviewed_at")` | 已审核时间 |
| `reviewedById` | `String?` | N | - | `@map("reviewed_by") @db.Uuid` | 已审核由ID |
| `reviewComment` | `String?` | N | - | `@map("review_comment")` | 审核评论 |
| `createdAt` | `DateTime` | Y | - | `@default(now()) @map("created_at")` | 创建时间 |
| `updatedAt` | `DateTime` | Y | - | `@updatedAt @map("updated_at")` | 更新时间 |
| `user` | `User` | Y | - | `@relation("UserVerification_User", fields: [userId], references: [id])` | 用户 |
| `reviewedBy` | `User?` | N | - | `@relation("UserVerification_Reviewer", fields: [reviewedById], references: [id])` | 已审核由 |
| `logoFile` | `File?` | N | - | `@relation("UserVerification_LogoFile", fields: [logoFileId], references: [id])` | 标识文件 |
| `region` | `Region?` | N | - | `@relation(fields: [regionCode], references: [code])` | 地区 |
