# 专利字段与页面展示交接清单（小程序 + 管理后台）

## 目录

1. 交接目标与对齐范围
2. 专利术语对照（甲方审阅版）
3. 页面展示项全量清单（小程序 + 管理后台）
4. 接口总览与字段字典（专利相关）
5. 数据库字段字典（专利相关全量）
6. 页面-接口-字段-落库映射矩阵
7. 甲方逐项确认清单
8. 核心字段逐项审阅表（字段对应页面）
9. 页面可见字段逐条清单（甲方逐项审阅）
10. 专利维保与地图字段补充（全量）

## 1. 交接目标与对齐范围

本文件用于甲乙双方就“专利相关页面展示内容、接口字段、数据库字段”做字段级交接。

本次交接范围覆盖：

- 小程序：`发布专利`、`专利详情`、`专利认领`、`专利地图`、`年费托管（维保）`
- 管理后台：`专利主数据管理`、`专利批量运营`、`专利认领审核`、`维保运营`
- 对应接口：专利主数据、挂牌发布、专利导入、专利认领、专利地图、专利维保、文件上传/临时下载
- 对应数据库：`patents` 及专利相关扩展表、`listings` 交易与地图字段、`patent_maintenance_*` 维保链路表、`files`

接口一致性核对结论（用于评审口径）：

- 接口文档声明接口数：245
- 后端控制器实现接口数：245
- 结论：文档与实现一致（无“仅文档未实现”或“仅实现未入文档”接口）

## 2. 专利术语对照（甲方审阅版）

| 英文字段/术语 | 中文口径 | 业务含义 |
|---|---|---|
| `applicationNoNorm` | 标准申请号 | 去除格式差异后的统一检索号 |
| `applicationNoDisplay` | 展示申请号 | 前台展示用申请号（含点位） |
| `patentNoDisplay` | 展示专利号 | 授权后的专利号展示值 |
| `publicationNoDisplay` | 展示公开号 | 公开公告号展示值 |
| `grantPublicationNoDisplay` | 展示授权公告号 | 授权公告号展示值 |
| `patentType` | 专利类型 | `INVENTION` 发明、`UTILITY_MODEL` 实用新型、`DESIGN` 外观设计 |
| `legalStatus` | 法律状态（标准） | 平台统一状态枚举 |
| `legalStatusRaw` | 法律状态（原文） | 原始来源状态描述 |
| `sourcePrimary` | 主数据来源 | `USER/ADMIN/PROVIDER` |
| `sourceUpdatedAt` | 来源更新时间 | 来源数据最后同步时间 |
| `ownerUserId` | 专利归属用户编号 | 当前认定权利主体 |
| `ownerClaimSource` | 归属来源 | 平台导入/用户认领/后台指定 |
| `transferCount` | 转移次数 | 历史转移或交易次数 |
| `idType` | 标识类型 | `APPLICATION/PATENT/PUBLICATION` |
| `idValueNorm` | 标识标准值 | 标识号的标准化值 |
| `system` | 分类体系 | 国际专利分类/洛迦诺分类/共同专利分类（`IPC/LOC/CPC`） |
| `consultationRouting` | 咨询路由 | `PLATFORM` 平台客服，`OWNER` 权利人 |
| `proofFileIds` | 权属证明文件编号列表 | 挂牌资料中的证明材料 |
| `evidenceFileIds` | 认领证据文件编号列表 | 认领申请中的证明材料 |
| `duplicatePolicy` | 重复处理策略 | `SKIP` 跳过，`OVERWRITE` 覆盖 |
| `PatentImportJob` | 专利导入任务 | 导入批次主表 |
| `PatentImportJobRow` | 专利导入任务行 | 导入批次逐行结果 |
| `PatentClaimRequest` | 专利认领申请 | 用户认领申请及审核结果 |
| `tradeSnapshot` | 交易快照 | 专利详情页展示的最新挂牌交易信息 |

## 3. 页面展示项全量清单（小程序 + 管理后台）

### 3.1 小程序：发布专利页 `subpackages/publish/patent/index`

| 页面模块 | 页面文案/交互 | 前端变量 | 对应请求字段 | 对应落库字段 | 说明 |
|---|---|---|---|---|---|
| 专利信息 | 专利号/申请号/公开号 * | `patentNumberRaw` | `patentNumberRaw` | `patents.application_no_norm`，`patent_identifiers.id_value_norm`，`listings.patent_id` | 作为专利关联主入口 |
| 专利信息 | 专利标题 | `title` | `title` | `listings.title`，必要时更新 `patents.title` | |
| 专利信息 | 专利类型 * | `patentType` | `patentType` | `patents.patent_type` | |
| 专利信息 | 交易方式 * | `tradeMode` | `tradeMode` | `listings.trade_mode` | |
| 专利信息 | 许可方式（交易方式=许可时） | `licenseMode` | `licenseMode` | `listings.license_mode` | |
| 专利信息 | 发明人 | `inventorNamesInput` | `inventorNames[]` | `patent_parties(role=INVENTOR)` | 多值分隔 |
| 专利信息 | 权利人/专利权人 | `assigneeNamesInput` | `assigneeNames[]` | `patent_parties(role=ASSIGNEE)` | 多值分隔 |
| 专利信息 | 申请人 | `applicantNamesInput` | `applicantNames[]` | `patent_parties(role=APPLICANT)` | 多值分隔 |
| 专利信息 | 摘要/卖点 | `summary` | `summary` | `listings.summary` | |
| 专利信息 | 可交付资料清单 | `deliverables` | 当前实现归并到 `summary` | `listings.summary` | 当前页面未单独提交 `deliverables` 字段 |
| 专利信息 | 预计周期 | `expectedCycle` | 当前实现归并到 `summary` | `listings.summary` | 当前页面未单独提交 `expectedCompletionDays` |
| 专利信息 | 可谈空间 | `negotiableSpace` | 当前实现归并到 `summary` | `listings.summary` | 当前页面未单独提交 `negotiableRange*` |
| 专利信息 | 质押/许可现状声明 | `pledgeStatus`（文本） | 当前实现归并到 `summary` | `listings.summary` | 与后台结构化 `pledgeStatus` 字段不同口径 |
| 专利信息 | 国际专利分类号（IPC） | `ipcCodesInput` | `ipcCodes[]` | `patent_classifications(system=IPC)` | |
| 专利信息 | 洛迦诺分类号（LOC） | `locCodesInput` | `locCodes[]` | `patent_classifications(system=LOC)` | |
| 专利信息 | 所在地区 | `regionCode` | `regionCode` | `listings.region_code` | |
| 专利信息 | 行业标签 | `industryTags` | `industryTags[]` | `listings.industry_tags_json` | |
| 专利信息 | 特色标签 | `listingTopics` | `listingTopics[]` | `listings.listing_topics_json` | |
| 权属证明 | 上传证明材料 | `proofFiles` | `proofFileIds[]` | `files`，`listings.proof_file_ids_json` | 先 `POST /files` 后在挂牌请求绑定 |
| 价格设置 | 价格类型 * | `priceType` | `priceType` | `listings.price_type` | |
| 价格设置 | 标价（元） | `priceYuan` | `priceAmountFen` | `listings.price_amount` | 前端元转分 |
| 价格设置 | 订金（元） | `depositYuan` | `depositAmountFen` | `listings.deposit_amount` | 前端元转分 |
| 页面状态 | 保存草稿 | `saveDraft()` | `POST /listings` 或 `PATCH /listings/{id}` | `listings.status=DRAFT` | |
| 页面状态 | 提交审核 | `submitForAudit()` | `POST /listings/{id}/submit` | `listings.status=ACTIVE`，`listings.audit_status=PENDING`，`listing_audit_logs` | |

### 3.2 小程序：专利详情页 `subpackages/patent/detail/index`

| 展示模块 | 页面文案/内容 | 响应字段 | 对应数据来源 |
|---|---|---|---|
| 头部信息 | 标题 | `Patent.title` | `patents.title` |
| 头部信息 | 类型 | `Patent.patentType` | `patents.patent_type` |
| 头部信息 | 法律状态 | `Patent.legalStatus` | `patents.legal_status` |
| 头部信息 | 申请号 | `Patent.applicationNoDisplay` / `Patent.applicationNoNorm` | `patents.application_no_display` / `application_no_norm` |
| 技术摘要 | 摘要文本 | `Patent.abstract` | `patents.abstract` |
| 附件媒体 | 封面/说明书附图 | `Patent.media[].fileId/url/type/sort` | 文件服务聚合结果 |
| 专利信息 | 专利号 | `Patent.patentNoDisplay` | `patents.patent_no_display` |
| 专利信息 | 国际专利分类（IPC） | `Patent.mainIpcCode` | 分类聚合字段 |
| 专利信息 | 洛迦诺分类 | `Patent.locCodes[]` | 分类聚合字段 |
| 专利信息 | 申请日 | `Patent.filingDate` | `patents.filing_date` |
| 专利信息 | 剩余年限 | 基于 `filingDate + patentType` 计算 | 前端计算值 |
| 权利人信息 | 发明人 | `Patent.inventorNames[]` | `patent_parties` 聚合 |
| 权利人信息 | 权利人 | `Patent.assigneeNames[]` | `patent_parties` 聚合 |
| 权利人信息 | 申请人 | `Patent.applicantNames[]` | `patent_parties` 聚合 |
| 时间信息 | 公开日 | `Patent.publicationDate` | `patents.publication_date` |
| 时间信息 | 授权日 | `Patent.grantDate` | `patents.grant_date` |
| 说明书统计 | 权利要求数 | `Patent.claimCount` | 聚合字段 |
| 说明书统计 | 说明书页数 | `Patent.specPageCount` | 聚合字段 |
| 说明书统计 | 说明书字数 | `Patent.specWordCount` | 聚合字段 |
| 说明书统计 | 附图数量 | `Patent.specFigureCount` | 聚合字段 |
| 交易信息 | 挂牌编号 | `Patent.tradeSnapshot.listingId` | `listings.id` |
| 交易信息 | 价格类型 | `Patent.tradeSnapshot.priceType` | `listings.price_type` |
| 交易信息 | 售价 | `Patent.tradeSnapshot.priceAmountFen` | `listings.price_amount` |
| 交易信息 | 订金 | `Patent.tradeSnapshot.depositAmountFen` | `listings.deposit_amount` |
| 交易信息 | 供方信息 | `Patent.tradeSnapshot.seller.*` | `users` 聚合 |
| 认领入口 | 是否可认领 | `sourcePrimary + ownerUserId` 判定 | `patents.source_primary` + `owner_user_id` |
| 数据来源 | 来源与更新时间 | `sourcePrimary`、`sourceUpdatedAt` | `patents.source_primary`、`source_updated_at` |

### 3.3 小程序：专利认领页 `subpackages/patent-claims/index`

| 页面模块 | 页面文案/交互 | 前端变量 | 对应请求/响应字段 | 对应落库字段 |
|---|---|---|---|---|
| 认领对象 | 专利标题 | `modeTitle` | `Patent.title` | `patents.title` |
| 认领对象 | 来源标签 | `sourcePrimaryLabel` | `Patent.sourcePrimary` | `patents.source_primary` |
| 认领对象 | 申请号 | 页面展示 | `Patent.applicationNoDisplay/applicationNoNorm` | `patents.application_no_display/application_no_norm` |
| 认领表单 | 认领说明（可选） | `claimReason` | `claimReason` | `patent_claim_requests.claim_reason` |
| 认领表单 | 证明材料 | `evidenceFiles` | `evidenceFileIds[]` | `files`，`patent_claim_requests.evidence_file_ids_json` |
| 认领提交 | 提交认领申请 | `submitClaim()` | `POST /me/patent-claims` | 新增 `patent_claim_requests` |
| 记录筛选 | 全部/待审核/已通过/已驳回 | `statusFilter` | `GET /me/patent-claims?status` | 查询条件 |
| 记录展示 | 认领单编号 | `item.id` | `PatentClaimRequest.id` | `patent_claim_requests.id` |
| 记录展示 | 专利编号 | `item.patentId` | `PatentClaimRequest.patentId` | `patent_claim_requests.patent_id` |
| 记录展示 | 提交时间 | `item.submittedAt` | `PatentClaimRequest.submittedAt` | `patent_claim_requests.submitted_at` |
| 记录展示 | 审核意见 | `item.reviewComment` | `PatentClaimRequest.reviewComment` | `patent_claim_requests.review_comment` |

### 3.4 管理后台：专利主数据管理页 `PatentsPage`

| 页面模块 | 页面文案/交互 | 对应接口字段 | 对应落库字段 |
|---|---|---|---|
| 筛选区 | 关键词（标题/申请号/权利人） | `q` | `patents.title/application_no_*`，`patent_parties.name` |
| 筛选区 | 专利类型 | `patentType` | `patents.patent_type` |
| 筛选区 | 法律状态 | `legalStatus` | `patents.legal_status` |
| 筛选区 | 数据来源 | `sourcePrimary` | `patents.source_primary` |
| 列表 | 专利名称 | `Patent.title` | `patents.title` |
| 列表 | 申请号展示 | `Patent.applicationNoDisplay/applicationNoNorm` | `patents.application_no_display/application_no_norm` |
| 列表 | 类型 | `Patent.patentType` | `patents.patent_type` |
| 列表 | 法律状态 | `Patent.legalStatus` | `patents.legal_status` |
| 列表 | 权利人/申请人 | `Patent.assigneeNames[]/applicantNames[]` | `patent_parties` |
| 弹窗（新建） | 申请号（规范号） | `applicationNoNorm` | `patents.application_no_norm` |
| 弹窗（新建） | 号码规范化 | `POST /patents/normalize` 返回字段 | 不直接落库 |
| 弹窗（新建/编辑） | 申请号展示值 | `applicationNoDisplay` | `patents.application_no_display` |
| 弹窗（新建/编辑） | 专利类型 | `patentType` | `patents.patent_type` |
| 弹窗（新建/编辑） | 专利名称 | `title` | `patents.title` |
| 弹窗（新建/编辑） | 摘要 | `abstract` | `patents.abstract` |
| 弹窗（新建/编辑） | 申请日/公开日/授权日 | `filingDate/publicationDate/grantDate` | `patents.filing_date/publication_date/grant_date` |
| 弹窗（新建/编辑） | 法律状态 | `legalStatus` | `patents.legal_status` |
| 弹窗（新建/编辑） | 来源 | `sourcePrimary` | `patents.source_primary` |
| 弹窗（新建/编辑） | 来源更新时间 | `sourceUpdatedAt` | `patents.source_updated_at` |
| 弹窗（新建/编辑） | 发明人/权利人/申请人 | `inventorNames[]/assigneeNames[]/applicantNames[]` | `patent_parties` |

### 3.5 管理后台：专利批量运营页 `PatentOperationsPage`

| 页面模块 | 页面文案/交互 | 对应接口字段 | 对应落库字段 |
|---|---|---|---|
| 导入模板 | 申请号 | 导入行 `normalized.applicationNoNorm` | `patents.application_no_norm` |
| 导入模板 | 发明名称 | 导入行 `normalized.title` | `patents.title` |
| 导入模板 | 专利类型 | 导入行 `normalized.patentType` | `patents.patent_type` |
| 导入模板 | 法律状态 | 导入行 `normalized.legalStatus` | `patents.legal_status` |
| 导入模板 | 申请日/授权日/公开日 | 导入行日期字段 | `patents.filing_date/grant_date/publication_date` |
| 导入模板 | 申请(专利权)人/申请人/发明人 | 导入行多值字段 | `patent_parties` |
| 导入模板 | 摘要 | 导入行 `normalized.abstract` | `patents.abstract` |
| 默认挂牌策略 | 重复策略 | `duplicatePolicy` | `patent_import_jobs.duplicate_policy` |
| 默认挂牌策略 | 咨询路由 | `listingDefaults.consultationRouting` | `listings.consultation_routing` |
| 默认挂牌策略 | 平台卖家用户编号 | `listingDefaults.sellerUserId` | `listings.seller_user_id` |
| 默认挂牌策略 | 交易模式/许可模式 | `listingDefaults.tradeMode/licenseMode` | `listings.trade_mode/license_mode` |
| 默认挂牌策略 | 价格模式/挂牌价格/保证金 | `listingDefaults.priceType/priceAmountFen/depositAmountFen` | `listings.price_type/price_amount/deposit_amount` |
| 默认挂牌策略 | 地区、特色标签、行业标签 | `listingDefaults.regionCode/listingTopics/industryTags` | `listings.region_code/listing_topics_json/industry_tags_json` |
| 导入任务列表 | 任务编号/状态/统计/失败率/校验时间 | `PatentImportJob.*` | `patent_import_jobs.*` |
| 导入任务明细 | 行号/状态/申请号/标题/专利编号/错误码/错误信息 | `PatentImportJobRow.*` | `patent_import_job_rows.*` |
| 按专利编号批量上架 | 专利编号列表 | `patentIds[]` | 读取 `patents.id` |
| 按专利编号批量上架 | 执行结果 | `PatentListingGenerateResult` | 写入 `listings` |
| 专利地图批量管理 | 区域总览 | `PatentMapOverviewResponse` | `listings` + `regions` 聚合 |
| 专利地图批量管理 | 区域挂牌明细 | `PatentMapRegionDetailResponse` | `listings` + `patents` 聚合 |
| 专利地图批量管理 | 批量补丁 | `PatentMapBatchUpdateRequest.patch.*` | `listings.region_code/featured_*` |

### 3.6 管理后台：专利认领审核页 `PatentClaimsPage`

| 页面模块 | 页面文案/交互 | 对应接口字段 | 对应落库字段 |
|---|---|---|---|
| 筛选区 | 搜索（认领理由/专利编号） | `q` | `patent_claim_requests.claim_reason/patent_id` |
| 筛选区 | 状态筛选 | `status` | `patent_claim_requests.status` |
| 列表 | 认领单编号 | `id` | `patent_claim_requests.id` |
| 列表 | 专利编号 | `patentId` | `patent_claim_requests.patent_id` |
| 列表 | 申请用户编号 | `applicantUserId` | `patent_claim_requests.applicant_user_id` |
| 列表 | 认领说明 | `claimReason` | `patent_claim_requests.claim_reason` |
| 列表 | 证据文件数 | `evidenceFileIds.length` | `patent_claim_requests.evidence_file_ids_json` |
| 列表 | 提交时间 | `submittedAt` | `patent_claim_requests.submitted_at` |
| 列表 | 审核人/审核时间/审核备注 | `reviewerUserId/reviewedAt/reviewComment` | `patent_claim_requests.reviewer_user_id/reviewed_at/review_comment` |
| 操作 | 通过认领 | `POST /admin/patent-claims/{id}/approve` | 更新 `patent_claim_requests`，并更新 `patents.owner_*`、`listings.seller_user_id`（权利人路由，枚举值 `OWNER`） |
| 操作 | 驳回认领 | `POST /admin/patent-claims/{id}/reject` | 更新 `patent_claim_requests.status=REJECTED` |

### 3.7 小程序：专利地图页 `subpackages/patent-map/index`

| 页面模块 | 页面文案/交互 | 对应接口字段 | 对应落库字段 |
|---|---|---|---|
| 数据范围 | 活跃上架/全部数据 | `filters.scope` | 聚合查询条件（`listings.status/audit_status`） |
| KPI 总览 | 专利数、挂牌数、活跃上榜、覆盖区域 | `summary.totalPatentCount/totalListingCount/activeRankedListingCount/totalRegionCount` | `patents` + `listings` + `regions` 聚合 |
| KPI 总览 | 有挂牌区域、未归属地区挂牌数 | `summary.regionsWithListingsCount/unassignedListingCount` | `listings.region_code` 聚合 |
| 区域排名 | 区域名称、挂牌数、专利数、排名 | `regions[].regionName/listingCount/patentCount/rankPosition` | `regions` + `listings` + `patents` 聚合 |
| 区域明细 | 挂牌标题 | `items[].title` | `listings.title` |
| 区域明细 | 专利标题、申请号、专利类型 | `items[].patentTitle/applicationNoDisplay/patentType` | `patents.title/application_no_display/patent_type` |
| 区域明细 | 价格类型、价格金额 | `items[].priceType/priceAmountFen` | `listings.price_type/price_amount` |
| 区域明细 | 上榜状态 | `items[].featuredLevel/featuredRank/featuredUntil/isFeaturedActive` | `listings.featured_level/featured_rank/featured_until` |

### 3.8 小程序：年费托管页 `subpackages/maintenance/index`

| 页面模块 | 页面文案/交互 | 对应接口字段 | 对应落库字段 |
|---|---|---|---|
| 汇总卡片 | 逾期排期、7天内到期、进行中任务、进行中订单 | 页面聚合统计 | `patent_maintenance_schedules/tasks/orders` 聚合 |
| 排期页签 | 专利标题、申请号、年费年度、应缴日、宽限期、状态、紧急度 | `PatentMaintenanceSchedule.*` | `patent_maintenance_schedules` + `patents` |
| 任务页签 | 任务状态、任务备注、证据文件 | `PatentMaintenanceTask.status/note/evidenceFileId` | `patent_maintenance_tasks.status/note/evidence_file_id` |
| 订单页签 | 订单号、金额、付款截止、对账状态、状态流转 | `PatentMaintenanceOrder.*` | `patent_maintenance_orders` |
| 时间线 | 事件类型、状态变更、操作人、备注 | `PatentMaintenanceOrderEvent.*` | `patent_maintenance_order_events` |
| 交互动作 | 由排期创建订单、进入会话、查看时间线 | `POST /me/patent-maintenance/orders` 等 | 订单与事件表新增/更新 |

### 3.9 管理后台：维保运营页 `MaintenancePage`

| 页面模块 | 页面文案/交互 | 对应接口字段 | 对应落库字段 |
|---|---|---|---|
| 排期管理 | 新建/编辑排期（专利ID、年度、应缴日、宽限期、状态） | `POST/PATCH /admin/patent-maintenance/schedules` | `patent_maintenance_schedules.*` |
| 任务管理 | 新建/编辑任务（排期、客服、状态、备注、证据） | `POST/PATCH /admin/patent-maintenance/tasks` | `patent_maintenance_tasks.*` |
| 订单管理 | 创建订单（按排期） | `POST /admin/patent-maintenance/orders` | `patent_maintenance_orders.*` |
| 订单动作 | 报价、付款确认、执行、上传回执、对账、关闭、取消 | `/admin/patent-maintenance/orders/{id}/*` | 订单状态字段 + 事件表 |
| 订单列表 | 专利标题、申请号、金额、支付信息、对账状态、时间字段 | `MaintenanceOrder.*` | `patent_maintenance_orders.*` + `patents` |
| 订单时间线 | 事件类型、状态变更、操作人、备注 | `GET /admin/patent-maintenance/orders/{id}/events` | `patent_maintenance_order_events.*` |

## 4. 接口总览与字段字典（专利相关）

### 4.1 接口清单（按链路）

| 链路 | 方法 | 路径 | 主要页面 |
|---|---|---|---|
| 文件上传 | `POST` | `/files` | 小程序发布专利、小程序认领、后台导入上传 |
| 文件临时下载 | `POST` | `/files/{fileId}/temporary-access` | 后台导入错误文件下载 |
| 专利号规范化 | `POST` | `/patents/normalize` | 后台专利主数据管理 |
| 专利详情查询 | `GET` | `/patents/{patentId}` | 小程序专利详情、小程序认领 |
| 挂牌创建 | `POST` | `/listings` | 小程序发布专利 |
| 挂牌更新 | `PATCH` | `/listings/{listingId}` | 小程序发布专利 |
| 挂牌提交审核 | `POST` | `/listings/{listingId}/submit` | 小程序发布专利 |
| 我的挂牌详情 | `GET` | `/listings/{listingId}` | 小程序发布专利（草稿回填） |
| 咨询事件 | `POST` | `/listings/{listingId}/consultations` | 小程序专利详情 |
| 会话创建/复用 | `POST` | `/listings/{listingId}/conversations` | 小程序专利详情 |
| 后台专利列表 | `GET` | `/admin/patents` | 后台专利主数据管理 |
| 后台新建专利 | `POST` | `/admin/patents` | 后台专利主数据管理 |
| 后台专利详情 | `GET` | `/admin/patents/{patentId}` | 后台专利主数据管理 |
| 后台更新专利 | `PATCH` | `/admin/patents/{patentId}` | 后台专利主数据管理 |
| 创建导入任务 | `POST` | `/admin/patents/jobs/import` | 后台专利批量运营 |
| 导入任务列表 | `GET` | `/admin/patents/jobs/import` | 后台专利批量运营 |
| 导入任务详情 | `GET` | `/admin/patents/jobs/import/{jobId}` | 后台专利批量运营 |
| 校验导入任务 | `POST` | `/admin/patents/jobs/import/{jobId}/validate` | 后台专利批量运营 |
| 执行导入任务 | `POST` | `/admin/patents/jobs/import/{jobId}/execute` | 后台专利批量运营 |
| 导入任务行列表 | `GET` | `/admin/patents/jobs/import/{jobId}/rows` | 后台专利批量运营 |
| 导入错误文件 | `GET` | `/admin/patents/jobs/import/{jobId}/error-file` | 后台专利批量运营 |
| 按专利批量上架 | `POST` | `/admin/patents/jobs/listings` | 后台专利批量运营 |
| 我的认领提交 | `POST` | `/me/patent-claims` | 小程序专利认领 |
| 我的认领列表 | `GET` | `/me/patent-claims` | 小程序专利认领 |
| 后台认领列表 | `GET` | `/admin/patent-claims` | 后台认领审核 |
| 后台认领通过 | `POST` | `/admin/patent-claims/{claimId}/approve` | 后台认领审核 |
| 后台认领驳回 | `POST` | `/admin/patent-claims/{claimId}/reject` | 后台认领审核 |
| 专利地图总览 | `GET` | `/search/patent-map/overview` | 后台专利批量运营 |
| 专利地图区域明细 | `GET` | `/search/patent-map/regions/{regionCode}` | 后台专利批量运营 |
| 专利地图批量更新 | `POST` | `/admin/patent-map/listings/batch` | 后台专利批量运营 |
| 我的维保排期列表 | `GET` | `/me/patent-maintenance/schedules` | 小程序年费托管 |
| 我的维保任务列表 | `GET` | `/me/patent-maintenance/tasks` | 小程序年费托管 |
| 我的维保订单列表 | `GET` | `/me/patent-maintenance/orders` | 小程序年费托管 |
| 我的维保创建订单 | `POST` | `/me/patent-maintenance/orders` | 小程序年费托管 |
| 我的维保订单时间线 | `GET` | `/me/patent-maintenance/orders/{orderId}/events` | 小程序年费托管 |
| 我的维保订单会话 | `POST` | `/patent-maintenance/orders/{orderId}/conversations` | 小程序年费托管 |
| 后台维保排期列表 | `GET` | `/admin/patent-maintenance/schedules` | 后台维保运营 |
| 后台维保排期创建 | `POST` | `/admin/patent-maintenance/schedules` | 后台维保运营 |
| 后台维保排期更新 | `PATCH` | `/admin/patent-maintenance/schedules/{scheduleId}` | 后台维保运营 |
| 后台维保任务列表 | `GET` | `/admin/patent-maintenance/tasks` | 后台维保运营 |
| 后台维保任务创建 | `POST` | `/admin/patent-maintenance/tasks` | 后台维保运营 |
| 后台维保任务更新 | `PATCH` | `/admin/patent-maintenance/tasks/{taskId}` | 后台维保运营 |
| 后台维保订单列表 | `GET` | `/admin/patent-maintenance/orders` | 后台维保运营 |
| 后台维保订单创建 | `POST` | `/admin/patent-maintenance/orders` | 后台维保运营 |
| 后台维保订单时间线 | `GET` | `/admin/patent-maintenance/orders/{orderId}/events` | 后台维保运营 |
| 后台维保订单报价 | `POST` | `/admin/patent-maintenance/orders/{orderId}/quote` | 后台维保运营 |
| 后台维保付款确认 | `POST` | `/admin/patent-maintenance/orders/{orderId}/payment-confirm` | 后台维保运营 |
| 后台维保执行确认 | `POST` | `/admin/patent-maintenance/orders/{orderId}/execution` | 后台维保运营 |
| 后台维保上传回执 | `POST` | `/admin/patent-maintenance/orders/{orderId}/receipt` | 后台维保运营 |
| 后台维保对账 | `POST` | `/admin/patent-maintenance/orders/{orderId}/reconcile` | 后台维保运营 |
| 后台维保关闭 | `POST` | `/admin/patent-maintenance/orders/{orderId}/close` | 后台维保运营 |
| 后台维保取消 | `POST` | `/admin/patent-maintenance/orders/{orderId}/cancel` | 后台维保运营 |

### 4.2 字段字典（按接口模型）

#### 4.2.1 `PatentNormalizeRequest`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `raw` | `string` | 是 | 待规范化原始号码（申请号/专利号/公开号） |

#### 4.2.2 `PatentNormalizeResponse`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `jurisdiction` | `string` | 是 | 当前支持 `CN` |
| `inputType` | `string` | 是 | 输入识别类型：申请号/专利号/公开号 |
| `applicationNoNorm` | `string` | 否 | 标准申请号 |
| `applicationNoDisplay` | `string` | 否 | 展示申请号 |
| `publicationNoNorm` | `string` | 否 | 标准公开号 |
| `publicationNoDisplay` | `string` | 否 | 展示公开号 |
| `patentNoNorm` | `string` | 否 | 标准专利号 |
| `patentNoDisplay` | `string` | 否 | 展示专利号 |
| `kindCode` | `string` | 否 | 文献种类码 |
| `patentType` | `string` | 否 | 专利类型推断结果 |
| `warnings[]` | `string[]` | 否 | 规范化提醒 |

#### 4.2.3 `Patent`（详情响应）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | `uuid` | 是 | 专利编号 |
| `jurisdiction` | `string` | 是 | 法域 |
| `applicationNoNorm` | `string` | 是 | 标准申请号 |
| `applicationNoDisplay` | `string` | 否 | 展示申请号 |
| `patentNoDisplay` | `string` | 否 | 展示专利号 |
| `publicationNoDisplay` | `string` | 否 | 展示公开号 |
| `grantPublicationNoDisplay` | `string` | 否 | 展示授权公告号 |
| `patentType` | `enum` | 是 | 专利类型 |
| `title` | `string` | 是 | 标题 |
| `abstract` | `string` | 否 | 摘要 |
| `caseStatus` | `string` | 否 | 案件状态（扩展字段） |
| `mainIpcCode` | `string` | 否 | 主国际专利分类号（IPC，扩展字段） |
| `claimCount` | `int` | 否 | 权利要求数（扩展字段） |
| `specPageCount` | `int` | 否 | 说明书页数（扩展字段） |
| `specWordCount` | `int` | 否 | 说明书字数（扩展字段） |
| `specFigureCount` | `int` | 否 | 说明书附图数（扩展字段） |
| `inventorNames[]` | `string[]` | 否 | 发明人 |
| `assigneeNames[]` | `string[]` | 否 | 权利人 |
| `applicantNames[]` | `string[]` | 否 | 申请人 |
| `filingDate` | `date` | 否 | 申请日 |
| `publicationDate` | `date` | 否 | 公开日 |
| `grantDate` | `date` | 否 | 授权日 |
| `legalStatus` | `enum` | 否 | 法律状态（标准） |
| `sourcePrimary` | `enum` | 否 | 数据来源 |
| `sourceUpdatedAt` | `datetime` | 否 | 来源更新时间 |
| `ownerUserId` | `uuid` | 否 | 归属用户 |
| `ownerClaimedAt` | `datetime` | 否 | 归属认领时间 |
| `ownerClaimSource` | `enum` | 否 | 归属来源 |
| `media[]` | `PatentMedia[]` | 否 | 附件媒体列表 |
| `tradeSnapshot` | `PatentTradeSnapshot` | 否 | 最新交易快照 |
| `createdAt` | `datetime` | 是 | 创建时间 |
| `updatedAt` | `datetime` | 否 | 更新时间 |

`PatentMedia` 子字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `fileId` | `uuid` | 文件编号 |
| `url` | `string` | 文件访问地址 |
| `type` | `enum(COVER/SPEC_FIGURE)` | 媒体类型 |
| `sort` | `int` | 排序 |

`PatentTradeSnapshot` 子字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `listingId` | `uuid` | 挂牌编号 |
| `priceType` | `enum` | 价格类型 |
| `priceAmountFen` | `int` | 挂牌价（分） |
| `depositAmountFen` | `int` | 订金（分） |
| `supplyType` | `string` | 供给方类型 |
| `seller` | `UserBrief` | 卖方用户摘要 |

#### 4.2.4 `ListingCreateRequest`（发布页提交）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `patentNumberRaw` | `string` | 否 | 专利号原始输入 |
| `patentType` | `enum` | 否 | 专利类型 |
| `title` | `string` | 否 | 标题 |
| `inventorNames[]` | `string[]` | 否 | 发明人 |
| `assigneeNames[]` | `string[]` | 否 | 权利人 |
| `applicantNames[]` | `string[]` | 否 | 申请人 |
| `legalStatus` | `enum` | 否 | 法律状态 |
| `legalStatusRaw` | `string` | 否 | 法律状态原文 |
| `filingDate` | `date` | 否 | 申请日 |
| `publicationDate` | `date` | 否 | 公开日 |
| `grantDate` | `date` | 否 | 授权日 |
| `transferCount` | `int` | 否 | 转移次数 |
| `summary` | `string` | 否 | 摘要 |
| `deliverables[]` | `string[]` | 否 | 可交付资料 |
| `expectedCompletionDays` | `int` | 否 | 预计完成天数 |
| `negotiableRangeFen` | `int` | 否 | 可谈范围（分） |
| `negotiableRangePercent` | `number` | 否 | 可谈范围（百分比） |
| `negotiableNote` | `string` | 否 | 可谈备注 |
| `pledgeStatus` | `enum` | 否 | 质押状态 |
| `existingLicenseStatus` | `enum` | 否 | 已有许可状态 |
| `encumbranceNote` | `string` | 否 | 权利负担说明 |
| `tradeMode` | `enum` | 是 | 交易方式 |
| `licenseMode` | `enum` | 否 | 许可方式 |
| `priceType` | `enum` | 是 | 价格模式 |
| `priceAmountFen` | `int` | 否 | 挂牌价格（分） |
| `depositAmountFen` | `int` | 否 | 订金（分） |
| `regionCode` | `string` | 否 | 地区编码 |
| `industryTags[]` | `string[]` | 否 | 行业标签 |
| `listingTopics[]` | `enum[]` | 否 | 特色标签 |
| `consultationRouting` | `enum` | 否 | 咨询路由 |
| `ipcCodes[]` | `string[]` | 否 | 国际专利分类号（IPC） |
| `locCodes[]` | `string[]` | 否 | 洛迦诺分类号（LOC） |
| `media[]` | `ListingMedia[]` | 否 | 挂牌媒体 |
| `proofFileIds[]` | `uuid[]` | 否 | 权属证明文件编号列表 |

#### 4.2.5 `ListingUpdateRequest`（发布页编辑）

字段结构与 `ListingCreateRequest` 基本一致，均为可选更新字段。

#### 4.2.6 `PatentCreateRequest` 与 `PatentUpdateRequest`

`PatentCreateRequest` 必填字段：`applicationNoNorm`、`patentType`、`title`。

`PatentUpdateRequest` 为增量更新，包含：

- `applicationNoDisplay`
- `patentType`
- `title`
- `abstract`
- `inventorNames[]`
- `assigneeNames[]`
- `applicantNames[]`
- `filingDate`
- `publicationDate`
- `grantDate`
- `legalStatus`
- `sourcePrimary`
- `sourceUpdatedAt`

#### 4.2.7 专利导入相关接口模型

`PatentImportListingDefaults`（导入默认挂牌策略）：

| 字段 | 中文说明 |
|---|---|
| `enabled` | 是否启用默认挂牌策略 |
| `consultationRouting` | 咨询路由（平台客服/权利人） |
| `sellerUserId` | 平台卖方用户编号 |
| `tradeMode` | 交易方式 |
| `licenseMode` | 许可方式 |
| `priceType` | 价格模式 |
| `priceAmountFen` | 挂牌价格（分） |
| `depositAmountFen` | 订金（分） |
| `regionCode` | 地区编码 |
| `listingTopics[]` | 特色标签列表 |
| `industryTags[]` | 行业标签列表 |
| `auditStatus` | 审核状态 |
| `status` | 挂牌状态 |

`PatentImportDefaults`（导入默认配置）：

| 字段 | 中文说明 |
|---|---|
| `listing` | 挂牌默认策略对象（引用 `PatentImportListingDefaults`） |

`PatentImportJobCreateRequest`（创建导入任务请求）：

| 字段 | 中文说明 |
|---|---|
| `fileId` | 导入文件编号（必填） |
| `duplicatePolicy` | 重复数据处理策略 |
| `defaults` | 默认配置对象 |

`PatentImportJob`（导入任务对象）：

| 字段 | 中文说明 |
|---|---|
| `id` | 任务编号 |
| `operatorUserId` | 操作人用户编号 |
| `fileId` | 源文件编号 |
| `duplicatePolicy` | 重复策略 |
| `defaults` | 默认策略配置 |
| `status` | 任务状态 |
| `totalCount` | 总行数 |
| `validCount` | 有效行数 |
| `invalidCount` | 无效行数 |
| `successCount` | 成功行数 |
| `failedCount` | 失败行数 |
| `skippedCount` | 跳过行数 |
| `failRate` | 失败率 |
| `validatedAt` | 校验时间 |
| `startedAt` | 开始执行时间 |
| `finishedAt` | 完成时间 |
| `pausedAt` | 暂停时间 |
| `errorFileId` | 错误文件编号 |
| `createdAt` | 创建时间 |
| `updatedAt` | 更新时间 |

`PatentImportJobRow`（导入任务行对象）：

| 字段 | 中文说明 |
|---|---|
| `id` | 行记录编号 |
| `jobId` | 所属任务编号 |
| `rowNo` | 行号 |
| `status` | 行处理状态 |
| `raw` | 原始行数据 |
| `normalized` | 规范化后行数据 |
| `patentId` | 落库专利编号 |
| `errorCode` | 错误码 |
| `errorMessage` | 错误信息 |
| `processedAt` | 处理时间 |
| `createdAt` | 创建时间 |
| `updatedAt` | 更新时间 |

`PatentListingGenerateRequest`（按专利批量生成挂牌请求）：

| 字段 | 中文说明 |
|---|---|
| `patentIds[]` | 专利编号列表（必填） |
| `duplicatePolicy` | 重复挂牌处理策略 |
| `listingDefaults` | 挂牌默认字段补丁 |

`PatentListingGenerateResult`（批量生成挂牌结果）：

| 字段 | 中文说明 |
|---|---|
| `totalCount` | 请求总数 |
| `successCount` | 成功数 |
| `failedCount` | 失败数 |
| `skippedCount` | 跳过数 |
| `rows[]` | 逐条结果（包含 `patentId/listingId/status/errorCode/errorMessage`） |

#### 4.2.8 专利认领相关接口模型

`PatentClaimCreateRequest`（提交认领请求）：

| 字段 | 中文说明 |
|---|---|
| `patentId` | 专利编号（必填） |
| `claimReason` | 认领说明 |
| `evidenceFileIds[]` | 证据文件编号列表（必填，1~20） |

`PatentClaimReviewRequest`（通过认领请求）：

| 字段 | 中文说明 |
|---|---|
| `reviewComment` | 审核备注（可选） |

`PatentClaimRejectRequest`（驳回认领请求）：

| 字段 | 中文说明 |
|---|---|
| `reviewComment` | 驳回原因（必填） |

`PatentClaimRequest`（认领单对象）：

| 字段 | 中文说明 |
|---|---|
| `id` | 认领单编号 |
| `patentId` | 专利编号 |
| `applicantUserId` | 申请人用户编号 |
| `status` | 审核状态 |
| `claimReason` | 认领说明 |
| `evidenceFileIds[]` | 证据文件编号列表 |
| `reviewerUserId` | 审核人用户编号 |
| `reviewComment` | 审核备注 |
| `submittedAt` | 提交时间 |
| `reviewedAt` | 审核时间 |
| `createdAt` | 创建时间 |
| `updatedAt` | 更新时间 |

#### 4.2.9 专利地图相关接口模型

`PatentMapOverviewResponse`（地图总览响应）：

| 字段 | 中文说明 |
|---|---|
| `generatedAt` | 生成时间 |
| `filters.regionLevel` | 聚合维度（省/市/区县） |
| `filters.top` | 排名条数上限 |
| `filters.scope` | 统计范围 |
| `summary.totalListingCount` | 挂牌总数 |
| `summary.totalPatentCount` | 专利总数 |
| `summary.totalRegionCount` | 区域总数 |
| `summary.rankedListingCount` | 已上榜挂牌数 |
| `summary.activeRankedListingCount` | 在售上榜挂牌数 |
| `summary.unassignedListingCount` | 未分配区域挂牌数 |
| `summary.mappableRegionCount` | 可映射区域数 |
| `ranking[]` | 区域排名列表 |
| `regions[]` | 区域明细列表 |

`PatentMapRegionItem`（地图区域项）：

| 字段 | 中文说明 |
|---|---|
| `regionCode` | 区域编码 |
| `regionName` | 区域名称 |
| `regionLevel` | 区域层级 |
| `centerLat` | 中心纬度 |
| `centerLng` | 中心经度 |
| `listingCount` | 挂牌数 |
| `patentCount` | 专利数 |
| `rankedListingCount` | 上榜挂牌数 |
| `activeRankedListingCount` | 在售上榜挂牌数 |
| `topActiveRank` | 当前最高上榜名次 |
| `rankPosition` | 区域排名 |

`PatentMapRegionDetailResponse`（区域明细响应）：

| 字段 | 中文说明 |
|---|---|
| `generatedAt` | 生成时间 |
| `filters.scope` | 统计范围 |
| `region.*` | 区域基础信息（编码/名称/层级/父级/中心点/下级数量） |
| `summary.*` | 区域统计汇总（挂牌、专利、上榜） |
| `items[]` | 挂牌明细列表 |
| `page` | 分页信息 |

`PatentMapRegionDetailItem`（区域挂牌明细项）：

| 字段 | 中文说明 |
|---|---|
| `listingId` | 挂牌编号 |
| `patentId` | 专利编号 |
| `title` | 挂牌标题 |
| `patentTitle` | 专利标题 |
| `patentType` | 专利类型 |
| `applicationNoDisplay` | 申请号展示值 |
| `regionCode` | 区域编码 |
| `tradeMode` | 交易方式 |
| `priceType` | 价格模式 |
| `priceAmountFen` | 挂牌价（分） |
| `depositAmountFen` | 订金（分） |
| `featuredLevel` | 上榜层级 |
| `featuredRegionCode` | 上榜区域编码 |
| `featuredRank` | 上榜名次 |
| `featuredUntil` | 上榜截止时间 |
| `isFeaturedActive` | 是否处于有效上榜期 |
| `createdAt` | 创建时间 |
| `updatedAt` | 更新时间 |

`PatentMapBatchUpdateRequest`（地图批量更新请求）：

| 字段 | 中文说明 |
|---|---|
| `listingIds[]` | 挂牌编号列表（必填，1~500） |
| `patch.regionCode` | 批量更新区域编码 |
| `patch.featuredLevel` | 批量更新上榜层级 |
| `patch.featuredRegionCode` | 批量更新上榜区域 |
| `patch.featuredRank` | 批量更新上榜名次 |
| `patch.featuredUntil` | 批量更新上榜截止时间 |
| `patch.clearRanking` | 是否清空上榜字段 |
| `reason` | 操作原因 |

`PatentMapBatchUpdateResponse`（地图批量更新响应）：

| 字段 | 中文说明 |
|---|---|
| `ok` | 操作是否成功 |
| `totalRequested` | 请求总数 |
| `updatedCount` | 实际更新数 |
| `missingListingIds[]` | 未找到的挂牌编号列表 |
| `patchApplied` | 实际应用的补丁内容 |
| `reason` | 返回说明 |

#### 4.2.10 文件相关接口模型

`FileObject`（文件对象）：

| 字段 | 中文说明 |
|---|---|
| `id` | 文件编号 |
| `url` | 文件地址 |
| `fileName` | 文件名 |
| `mimeType` | 文件类型 |
| `sizeBytes` | 文件大小（字节） |
| `createdAt` | 创建时间 |

`FileTemporaryAccessRequest`（临时访问请求）：

| 字段 | 中文说明 |
|---|---|
| `scope` | 临时访问用途（`download/preview`） |
| `expiresInSeconds` | 过期秒数 |
| `ttlSeconds` | 生存时长秒数 |

`FileTemporaryAccessResponse`（临时访问响应）：

| 字段 | 中文说明 |
|---|---|
| `url` | 临时访问地址 |
| `expiresAt` | 失效时间 |
| `scope` | 访问用途 |

## 5. 数据库字段字典（专利相关全量）

### 5.1 `patents`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `uuid` | 主键 |
| `jurisdiction` | `string` | 法域（默认 `CN`） |
| `application_no_norm` | `string` | 标准申请号 |
| `application_no_display` | `string?` | 展示申请号 |
| `patent_type` | `enum` | 专利类型 |
| `title` | `string` | 标题 |
| `abstract` | `string?` | 摘要 |
| `filing_date` | `date?` | 申请日 |
| `publication_date` | `date?` | 公开日 |
| `grant_date` | `date?` | 授权日 |
| `legal_status` | `string?` | 法律状态（标准） |
| `legal_status_raw` | `string?` | 法律状态（原文） |
| `publication_no_display` | `string?` | 展示公开号 |
| `patent_no_display` | `string?` | 展示专利号 |
| `grant_publication_no_display` | `string?` | 展示授权公告号 |
| `transfer_count` | `int` | 转移次数 |
| `source_primary` | `enum` | 数据来源 |
| `source_updated_at` | `datetime?` | 来源更新时间 |
| `owner_user_id` | `uuid?` | 归属用户 |
| `owner_claimed_at` | `datetime?` | 归属确认时间 |
| `owner_claim_source` | `enum?` | 归属来源 |
| `created_at` | `datetime` | 创建时间 |
| `updated_at` | `datetime` | 更新时间 |

### 5.2 `patent_identifiers`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `uuid` | 主键 |
| `patent_id` | `uuid` | 专利编号 |
| `id_type` | `enum` | 标识类型（申请号/专利号/公开号） |
| `id_value_norm` | `string` | 标识标准值 |
| `kind_code` | `string?` | 文献种类码 |
| `date_ref` | `date?` | 参考日期 |

### 5.3 `patent_classifications`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `uuid` | 主键 |
| `patent_id` | `uuid` | 专利编号 |
| `system` | `enum` | 分类体系（国际专利分类 `IPC` / 洛迦诺分类 `LOC` / 共同专利分类 `CPC`） |
| `code` | `string` | 分类号 |
| `is_main` | `bool` | 是否主分类 |

### 5.4 `patent_parties`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `uuid` | 主键 |
| `patent_id` | `uuid` | 专利编号 |
| `role` | `enum` | 角色（发明人/申请人/权利人） |
| `name` | `string` | 名称 |
| `country_code` | `string?` | 国家编码 |

### 5.5 `patent_legal_events`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `uuid` | 主键 |
| `patent_id` | `uuid` | 专利编号 |
| `event_date` | `date` | 事件日期 |
| `event_code` | `string` | 事件编码 |
| `event_text_raw` | `string` | 事件原文 |
| `source` | `string` | 来源 |
| `created_at` | `datetime` | 创建时间 |

### 5.6 `patent_import_jobs`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `uuid` | 主键 |
| `operator_user_id` | `uuid` | 操作人 |
| `file_id` | `uuid` | 导入文件编号 |
| `duplicate_policy` | `enum` | 重复策略 |
| `defaults_json` | `json?` | 默认挂牌策略 |
| `status` | `enum` | 任务状态 |
| `total_count` | `int` | 总行数 |
| `valid_count` | `int` | 有效行数 |
| `invalid_count` | `int` | 无效行数 |
| `success_count` | `int` | 成功数 |
| `failed_count` | `int` | 失败数 |
| `skipped_count` | `int` | 跳过数 |
| `fail_rate` | `float` | 失败率 |
| `validated_at` | `datetime?` | 校验时间 |
| `started_at` | `datetime?` | 开始时间 |
| `finished_at` | `datetime?` | 结束时间 |
| `paused_at` | `datetime?` | 暂停时间 |
| `error_file_id` | `uuid?` | 错误文件编号 |
| `created_at` | `datetime` | 创建时间 |
| `updated_at` | `datetime` | 更新时间 |

### 5.7 `patent_import_job_rows`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `uuid` | 主键 |
| `job_id` | `uuid` | 导入任务编号 |
| `row_no` | `int` | 行号 |
| `status` | `enum` | 行状态 |
| `raw_json` | `json` | 原始行数据 |
| `normalized_json` | `json?` | 规范化行数据 |
| `patent_id` | `uuid?` | 落库专利编号 |
| `error_code` | `string?` | 错误码 |
| `error_message` | `string?` | 错误信息 |
| `processed_at` | `datetime?` | 处理时间 |
| `created_at` | `datetime` | 创建时间 |
| `updated_at` | `datetime` | 更新时间 |

### 5.8 `patent_claim_requests`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `uuid` | 主键 |
| `patent_id` | `uuid` | 专利编号 |
| `applicant_user_id` | `uuid` | 申请用户 |
| `status` | `enum` | 审核状态 |
| `claim_reason` | `string?` | 认领说明 |
| `evidence_file_ids_json` | `json?` | 证据文件编号列表 |
| `reviewer_user_id` | `uuid?` | 审核人 |
| `review_comment` | `string?` | 审核备注 |
| `submitted_at` | `datetime` | 提交时间 |
| `reviewed_at` | `datetime?` | 审核时间 |
| `created_at` | `datetime` | 创建时间 |
| `updated_at` | `datetime` | 更新时间 |

### 5.9 `listings`（专利相关字段）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `uuid` | 主键 |
| `seller_user_id` | `uuid` | 卖方用户 |
| `source` | `enum` | 内容来源 |
| `patent_id` | `uuid?` | 关联专利 |
| `title` | `string` | 挂牌标题 |
| `summary` | `string?` | 摘要 |
| `trade_mode` | `enum` | 交易模式 |
| `license_mode` | `enum?` | 许可模式 |
| `price_type` | `enum` | 价格模式 |
| `price_amount` | `int?` | 挂牌价格（分） |
| `deposit_amount` | `int` | 订金（分） |
| `deliverables_json` | `json?` | 可交付资料 |
| `expected_completion_days` | `int?` | 预计完成天数 |
| `negotiable_range_fen` | `int?` | 可谈范围（分） |
| `negotiable_range_percent` | `float?` | 可谈范围（百分比） |
| `negotiable_note` | `string?` | 可谈备注 |
| `pledge_status` | `enum?` | 质押状态 |
| `existing_license_status` | `enum?` | 既有许可状态 |
| `encumbrance_note` | `string?` | 权利负担说明 |
| `region_code` | `string?` | 地区编码 |
| `industry_tags_json` | `json?` | 行业标签 |
| `listing_topics_json` | `json?` | 特色标签 |
| `proof_file_ids_json` | `json?` | 权属证明文件列表 |
| `consultation_routing` | `enum` | 咨询路由 |
| `featured_level` | `enum` | 上榜层级 |
| `featured_region_code` | `string?` | 上榜区域 |
| `featured_rank` | `int?` | 上榜排名 |
| `featured_until` | `datetime?` | 上榜截止时间 |
| `audit_status` | `enum` | 审核状态 |
| `status` | `enum` | 挂牌状态 |
| `created_at` | `datetime` | 创建时间 |
| `updated_at` | `datetime` | 更新时间 |

### 5.10 `listing_audit_logs`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `uuid` | 主键 |
| `listing_id` | `uuid` | 挂牌编号 |
| `reviewer_id` | `uuid` | 审核人 |
| `action` | `enum` | 审核动作 |
| `reason` | `string?` | 原因 |
| `created_at` | `datetime` | 创建时间 |

### 5.11 `files`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `uuid` | 主键 |
| `url` | `string` | 文件地址 |
| `file_name` | `string?` | 文件名 |
| `mime_type` | `string` | 文件类型 |
| `size_bytes` | `int` | 文件大小 |
| `owner_scope` | `enum` | 归属范围 |
| `owner_id` | `uuid` | 归属主体 |
| `created_at` | `datetime` | 创建时间 |

### 5.12 `patent_maintenance_schedules`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `uuid` | 主键 |
| `patent_id` | `uuid` | 关联专利编号 |
| `year_no` | `int` | 年费年度（第 N 年） |
| `due_date` | `date` | 应缴日期 |
| `grace_period_end` | `date?` | 宽限期截止日期 |
| `status` | `enum` | 排期状态（到期/已缴/逾期/豁免） |
| `created_at` | `datetime` | 创建时间 |
| `updated_at` | `datetime` | 更新时间 |

### 5.13 `patent_maintenance_tasks`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `uuid` | 主键 |
| `schedule_id` | `uuid` | 关联排期编号 |
| `assigned_cs_user_id` | `uuid?` | 指派客服 |
| `status` | `enum` | 任务状态（待办/处理中/完成/取消） |
| `note` | `string?` | 任务备注 |
| `evidence_file_id` | `uuid?` | 证据文件编号 |
| `created_at` | `datetime` | 创建时间 |
| `updated_at` | `datetime` | 更新时间 |

### 5.14 `patent_maintenance_orders`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `uuid` | 主键 |
| `schedule_id` | `uuid` | 关联排期编号 |
| `applicant_user_id` | `uuid` | 申请用户编号 |
| `assigned_cs_user_id` | `uuid?` | 指派客服编号 |
| `status` | `enum` | 订单状态 |
| `payment_channel` | `enum?` | 支付渠道 |
| `official_fee_fen` | `int` | 官费（分） |
| `late_fee_fen` | `int` | 滞纳金（分） |
| `service_fee_fen` | `int` | 服务费（分） |
| `total_amount_fen` | `int` | 总金额（分） |
| `payment_deadline` | `datetime?` | 付款截止时间 |
| `paid_at` | `datetime?` | 付款时间 |
| `executed_at` | `datetime?` | 执行时间 |
| `receipt_issued_at` | `datetime?` | 回执开具时间 |
| `official_submission_no` | `string?` | 官方提交号 |
| `official_receipt_no` | `string?` | 官方回执号 |
| `payment_txn_no` | `string?` | 支付流水号 |
| `official_receipt_file_id` | `uuid?` | 官方回执文件编号 |
| `reconcile_status` | `enum` | 对账状态 |
| `reconcile_note` | `string?` | 对账备注 |
| `close_note` | `string?` | 关闭备注 |
| `created_at` | `datetime` | 创建时间 |
| `updated_at` | `datetime` | 更新时间 |

### 5.15 `patent_maintenance_order_events`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `uuid` | 主键 |
| `order_id` | `uuid` | 关联订单编号 |
| `actor_user_id` | `uuid?` | 操作人编号 |
| `event_type` | `enum` | 事件类型 |
| `from_status` | `enum?` | 原状态 |
| `to_status` | `enum` | 目标状态 |
| `note` | `string?` | 事件备注 |
| `payload_json` | `json?` | 事件扩展信息 |
| `created_at` | `datetime` | 创建时间 |

### 5.16 `listing_media`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `uuid` | 主键 |
| `listing_id` | `uuid` | 关联挂牌编号 |
| `file_id` | `uuid` | 关联文件编号 |
| `type` | `enum` | 媒体类型（封面/附图等） |
| `sort` | `int` | 排序值 |

### 5.17 `listing_consult_events`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `uuid` | 主键 |
| `listing_id` | `uuid` | 关联挂牌编号 |
| `user_id` | `uuid` | 发起用户编号 |
| `channel` | `enum` | 咨询渠道 |
| `created_at` | `datetime` | 创建时间 |

## 6. 页面-接口-字段-落库映射矩阵

| 页面/动作 | 接口 | 关键请求字段 | 关键响应字段 | 关键落库字段 |
|---|---|---|---|---|
| 小程序发布页：上传权属证明 | `POST /files` | 文件二进制 | `FileObject.id/url` | `files.id/url/mime_type/size_bytes` |
| 小程序发布页：保存草稿（新建） | `POST /listings` | `patentNumberRaw, patentType, title, inventorNames, assigneeNames, applicantNames, ipcCodes, locCodes, proofFileIds, tradeMode, priceType, priceAmountFen, depositAmountFen, regionCode, listingTopics, industryTags` | `Listing.id/status/auditStatus` | `patents`、`patent_parties`、`patent_classifications`、`listings` |
| 小程序发布页：保存草稿（编辑） | `PATCH /listings/{listingId}` | 同上增量字段 | `Listing.id/status/auditStatus` | 同上 |
| 小程序发布页：提交审核 | `POST /listings/{listingId}/submit` | 无 | `Listing.status/auditStatus` | `listings.status=ACTIVE`、`listings.audit_status=PENDING`、`listing_audit_logs` |
| 小程序发布页：草稿回填 | `GET /listings/{listingId}` | `listingId` | 挂牌详情字段 | 查询 `listings` + 专利聚合字段 |
| 小程序发布页：补充专利主体信息回填 | `GET /patents/{patentId}` | `patentId` | `assigneeNames/applicantNames` | 查询 `patents` + `patent_parties` |
| 小程序专利详情：详情展示 | `GET /patents/{patentId}` | `patentId` | `Patent.*` | 查询 `patents` + 聚合信息 |
| 小程序专利详情：发起咨询 | `POST /listings/{listingId}/consultations` | `channel` | `ok/conversationId` | `listing_consult_events`、`conversations` |
| 小程序专利详情：进入会话 | `POST /listings/{listingId}/conversations` | 无 | `Conversation.id` | `conversations` |
| 小程序认领页：提交认领 | `POST /me/patent-claims` | `patentId, claimReason, evidenceFileIds[]` | `PatentClaimRequest.*` | `patent_claim_requests` |
| 小程序认领页：查询认领记录 | `GET /me/patent-claims` | `status,page,pageSize` | `PagedPatentClaimRequest` | 查询 `patent_claim_requests` |
| 后台专利页：号码规范化 | `POST /patents/normalize` | `raw` | `PatentNormalizeResponse.*` | 不落库 |
| 后台专利页：专利列表 | `GET /admin/patents` | `q, patentType, legalStatus, sourcePrimary, page, pageSize` | `PagedPatent` | 查询 `patents` + `patent_parties` |
| 后台专利页：新建专利 | `POST /admin/patents` | `applicationNoNorm, patentType, title, applicationNoDisplay, abstract, inventorNames, assigneeNames, applicantNames, filingDate, publicationDate, grantDate, legalStatus, sourcePrimary, sourceUpdatedAt` | `Patent` | `patents` + `patent_parties` |
| 后台专利页：编辑专利 | `PATCH /admin/patents/{patentId}` | 同上增量字段 | `Patent` | `patents` + `patent_parties` |
| 后台运营页：创建导入任务 | `POST /admin/patents/jobs/import` | `fileId, duplicatePolicy, defaults.listing.*` | `PatentImportJob` | `patent_import_jobs` |
| 后台运营页：校验导入任务 | `POST /admin/patents/jobs/import/{jobId}/validate` | `jobId` | `PatentImportJob` | `patent_import_job_rows`（有效/无效） |
| 后台运营页：执行导入任务 | `POST /admin/patents/jobs/import/{jobId}/execute` | `jobId` | `PatentImportJob` | `patents`、`patent_identifiers`、`patent_classifications`、`patent_parties`、`patent_legal_events`、`listings` |
| 后台运营页：导入任务行明细 | `GET /admin/patents/jobs/import/{jobId}/rows` | `status,page,pageSize` | `PagedPatentImportJobRow` | 查询 `patent_import_job_rows` |
| 后台运营页：按专利编号批量上架 | `POST /admin/patents/jobs/listings` | `patentIds[], duplicatePolicy, listingDefaults.*` | `PatentListingGenerateResult` | `listings` |
| 后台认领页：认领列表 | `GET /admin/patent-claims` | `q,status,page,pageSize` | `PagedPatentClaimRequest` | 查询 `patent_claim_requests` |
| 后台认领页：通过认领 | `POST /admin/patent-claims/{claimId}/approve` | `reviewComment` | `PatentClaimRequest` | 更新 `patent_claim_requests`，更新 `patents.owner_user_id/owner_claimed_at/owner_claim_source`，并同步 `listings.seller_user_id`（权利人路由，枚举值 `OWNER`） |
| 后台认领页：驳回认领 | `POST /admin/patent-claims/{claimId}/reject` | `reviewComment` | `PatentClaimRequest` | 更新 `patent_claim_requests.status/review_comment/reviewed_at` |
| 后台运营页：专利地图总览 | `GET /search/patent-map/overview` | `regionLevel, top, scope` | `PatentMapOverviewResponse` | `listings` + `patents` + `regions` 聚合查询 |
| 后台运营页：专利地图区域明细 | `GET /search/patent-map/regions/{regionCode}` | `regionCode, scope, page, pageSize` | `PatentMapRegionDetailResponse` | `listings` + `patents` 聚合查询 |
| 后台运营页：专利地图批量更新 | `POST /admin/patent-map/listings/batch` | `listingIds[], patch.*, reason` | `PatentMapBatchUpdateResponse` | 更新 `listings.region_code/featured_level/featured_region_code/featured_rank/featured_until` |
| 小程序年费托管：排期列表 | `GET /me/patent-maintenance/schedules` | `status,page,pageSize` | `PagedPatentMaintenanceSchedule` | 查询 `patent_maintenance_schedules` + `patents` |
| 小程序年费托管：任务列表 | `GET /me/patent-maintenance/tasks` | `status,page,pageSize` | `PagedPatentMaintenanceTask` | 查询 `patent_maintenance_tasks` + `patent_maintenance_schedules` |
| 小程序年费托管：订单列表 | `GET /me/patent-maintenance/orders` | `status,orderId,page,pageSize` | `PagedPatentMaintenanceOrder` | 查询 `patent_maintenance_orders` + 关联表 |
| 小程序年费托管：创建订单 | `POST /me/patent-maintenance/orders` | `scheduleId` | `PatentMaintenanceOrder` | 新增 `patent_maintenance_orders` |
| 小程序年费托管：订单时间线 | `GET /me/patent-maintenance/orders/{orderId}/events` | `orderId` | `items[]` | 查询 `patent_maintenance_order_events` |
| 小程序年费托管：进入维保会话 | `POST /patent-maintenance/orders/{orderId}/conversations` | `orderId` | `Conversation.id` | 查询或新增 `conversations` |
| 后台维保：排期创建/更新 | `POST/PATCH /admin/patent-maintenance/schedules*` | `patentId,yearNo,dueDate,gracePeriodEnd,status` | `PatentMaintenanceSchedule` | 写入 `patent_maintenance_schedules` |
| 后台维保：任务创建/更新 | `POST/PATCH /admin/patent-maintenance/tasks*` | `scheduleId,assignedCsUserId,status,note,evidenceFileId` | `PatentMaintenanceTask` | 写入 `patent_maintenance_tasks` |
| 后台维保：订单动作（报价/付款/执行/回执/对账/关闭/取消） | `/admin/patent-maintenance/orders/{orderId}/*` | 各动作请求字段 | `PatentMaintenanceOrder` | 更新 `patent_maintenance_orders` 并写入 `patent_maintenance_order_events` |

## 7. 甲方逐项确认清单

请按以下顺序逐项确认（可在评审会上直接逐条勾选）：

- □ 已确认小程序 `发布专利` 页面所有输入项与术语口径。
- □ 已确认小程序 `专利详情` 页面所有展示项与字段来源。
- □ 已确认小程序 `专利认领` 提交字段、审核状态字段、证据材料字段。
- □ 已确认小程序 `专利地图` 总览字段、区域排名字段、区域明细字段。
- □ 已确认小程序 `年费托管` 的排期/任务/订单/时间线字段。
- □ 已确认后台 `专利主数据管理` 的筛选字段、编辑字段、号码规范化字段。
- □ 已确认后台 `专利批量运营` 的导入模板字段、默认挂牌策略字段、任务结果字段。
- □ 已确认后台 `专利认领审核` 的审核字段与通过/驳回口径。
- □ 已确认后台 `维保运营` 的排期/任务/订单动作字段与状态流转口径。
- □ 已确认专利相关接口请求/响应字段字典。
- □ 已确认专利相关数据库字段字典。
- □ 已确认“页面-接口-字段-落库”映射矩阵。
- □ 已确认专利数据流图：`docs/architecture/rendered/new-mall-patent-data-flow.png`。

## 8. 核心字段逐项审阅表（字段对应页面）

审阅标记说明：

- `录入`：该页面可编辑并提交该字段。
- `展示`：该页面只读展示该字段。
- `间接`：页面不直接展示字段值，但业务判断依赖该字段。
- `-`：该页面当前不使用该字段。

### 8.1 `patents` 主表字段 -> 页面对应关系

| 字段 | 中文含义 | 小程序发布专利 | 小程序专利详情 | 小程序专利认领 | 后台专利主数据 | 后台专利批量运营 | 后台认领审核 | 备注 |
|---|---|---|---|---|---|---|---|---|
| `id` | 专利主键 | 间接 | 间接 | 间接 | 间接 | 间接 | 展示 | 作为详情/认领/审核主索引 |
| `jurisdiction` | 法域 | - | - | - | 录入（默认 `CN`） | 导入默认 | - | 当前口径固定为 `CN` |
| `application_no_norm` | 标准申请号 | 录入（原始号规范化后） | 展示 | 展示 | 录入 | 导入/展示 | 间接 | 专利匹配主键字段 |
| `application_no_display` | 展示申请号 | 间接 | 展示 | 展示 | 录入 | 导入/展示 | - | 供前台展示 |
| `patent_type` | 专利类型 | 录入 | 展示 | - | 录入/筛选 | 导入/展示 | - | `INVENTION/UTILITY_MODEL/DESIGN` |
| `title` | 专利标题 | 录入 | 展示 | 展示 | 录入/展示 | 导入/展示 | - | |
| `abstract` | 专利摘要 | 间接（发布摘要入挂牌） | 展示 | - | 录入 | 导入/展示 | - | |
| `filing_date` | 申请日 | - | 展示 | - | 录入 | 导入/展示 | - | 详情页用于剩余年限计算 |
| `publication_date` | 公开日 | - | 展示 | - | 录入 | 导入/展示 | - | |
| `grant_date` | 授权日 | - | 展示 | - | 录入 | 导入/展示 | - | |
| `legal_status` | 法律状态（标准） | - | 展示 | - | 录入/筛选 | 导入/展示 | - | |
| `legal_status_raw` | 法律状态（原文） | - | - | - | 间接 | 导入 | - | 当前页面不单独展示 |
| `publication_no_display` | 公开号展示值 | - | - | - | 录入 | 导入 | - | 当前详情页暂未单独展示 |
| `patent_no_display` | 专利号展示值 | 录入（原始号链路） | 展示 | - | 录入 | 导入 | - | |
| `grant_publication_no_display` | 授权公告号展示值 | - | - | - | 录入 | 导入 | - | 当前详情页暂未单独展示 |
| `transfer_count` | 转移次数 | - | - | - | 录入 | 导入 | - | 当前页面暂未单独展示 |
| `source_primary` | 数据来源 | 间接 | 展示 | 展示 | 录入/筛选 | 导入 | 间接 | 认领资格判断依赖该字段 |
| `source_updated_at` | 来源更新时间 | - | 展示 | - | 录入 | 导入 | - | |
| `owner_user_id` | 归属用户编号 | - | 间接 | 间接（已归属提示） | - | - | 展示 | 决定认领入口可用性 |
| `owner_claimed_at` | 归属确认时间 | - | - | - | - | - | 间接 | 审核通过时更新 |
| `owner_claim_source` | 归属来源 | - | - | - | - | - | 间接 | 审核通过时更新 |
| `created_at` | 创建时间 | - | - | - | - | 间接 | - | 数据审计字段 |
| `updated_at` | 更新时间 | - | - | - | 展示 | 间接 | - | 后台列表展示更新时间 |

### 8.2 `listings`（专利交易相关）字段 -> 页面对应关系

| 字段 | 中文含义 | 小程序发布专利 | 小程序专利详情 | 小程序专利认领 | 后台专利主数据 | 后台专利批量运营 | 后台认领审核 | 备注 |
|---|---|---|---|---|---|---|---|---|
| `id` | 挂牌编号 | 间接 | 展示（交易快照） | - | - | 展示 | - | 咨询会话、收藏等入口主键 |
| `seller_user_id` | 卖方用户编号 | 间接 | 间接 | - | - | 录入/展示 | 间接 | 权利人路由（枚举值 `OWNER`）下可被认领审核同步更新 |
| `source` | 内容来源 | - | - | - | - | 展示 | - | |
| `patent_id` | 关联专利编号 | 间接 | 间接 | 间接 | - | 展示 | 间接 | 连接专利主档 |
| `title` | 挂牌标题 | 录入 | 展示（交易快照上下文） | - | - | 录入/展示 | - | |
| `summary` | 挂牌摘要 | 录入 | - | - | - | 录入/展示 | - | 小程序补充信息当前归并到该字段 |
| `trade_mode` | 交易方式 | 录入 | 间接 | - | - | 录入/展示 | - | |
| `license_mode` | 许可方式 | 录入（许可时必填） | 间接 | - | - | 录入/展示 | - | |
| `price_type` | 价格模式 | 录入 | 展示 | - | - | 录入/展示 | - | |
| `price_amount` | 挂牌价格（分） | 录入 | 展示 | - | - | 录入/展示 | - | |
| `deposit_amount` | 订金（分） | 录入 | 展示 | - | - | 录入/展示 | - | |
| `deliverables_json` | 可交付资料 | 间接（归并摘要） | - | - | - | 录入 | - | 当前小程序未结构化提交 |
| `expected_completion_days` | 预计周期（天） | 间接（归并摘要） | - | - | - | 录入 | - | 当前小程序未结构化提交 |
| `negotiable_range_fen` | 可谈范围（分） | 间接（归并摘要） | - | - | - | 录入 | - | 当前小程序未结构化提交 |
| `negotiable_range_percent` | 可谈范围（百分比） | 间接（归并摘要） | - | - | - | 录入 | - | 当前小程序未结构化提交 |
| `negotiable_note` | 可谈备注 | 间接（归并摘要） | - | - | - | 录入 | - | 当前小程序未结构化提交 |
| `pledge_status` | 质押状态 | 间接（归并摘要） | - | - | - | 录入 | - | 当前小程序以文本归并 |
| `existing_license_status` | 既有许可状态 | 间接（归并摘要） | - | - | - | 录入 | - | 当前小程序未结构化提交 |
| `encumbrance_note` | 权利负担说明 | 间接（归并摘要） | - | - | - | 录入 | - | 当前小程序未结构化提交 |
| `region_code` | 地区编码 | 录入 | 间接 | - | - | 录入/展示 | - | 地图总览与区域明细依赖 |
| `industry_tags_json` | 行业标签 | 录入 | - | - | - | 录入/展示 | - | |
| `listing_topics_json` | 特色标签 | 录入 | - | - | - | 录入/展示 | - | |
| `proof_file_ids_json` | 权属证明文件编号列表 | 录入 | - | - | - | 录入/展示 | - | 与 `files` 关联 |
| `consultation_routing` | 咨询路由 | 间接 | 间接 | - | - | 录入/展示 | 间接 | 平台客服/权利人（`PLATFORM/OWNER`） |
| `featured_level` | 上榜层级 | - | - | - | - | 录入/展示 | - | 地图运营字段 |
| `featured_region_code` | 上榜区域 | - | - | - | - | 录入/展示 | - | 地图运营字段 |
| `featured_rank` | 上榜排名 | - | - | - | - | 录入/展示 | - | 地图运营字段 |
| `featured_until` | 上榜截止时间 | - | - | - | - | 录入/展示 | - | 地图运营字段 |
| `audit_status` | 审核状态 | 展示 | 间接 | - | - | 展示 | - | 发布页显示审核状态 |
| `status` | 挂牌状态 | 展示 | 间接 | - | - | 展示 | - | 发布页显示草稿/上架状态 |
| `created_at` | 创建时间 | - | - | - | - | 展示 | - | |
| `updated_at` | 更新时间 | - | - | - | - | 展示 | - | |

### 8.3 `patent_claim_requests` 字段 -> 页面对应关系

| 字段 | 中文含义 | 小程序发布专利 | 小程序专利详情 | 小程序专利认领 | 后台专利主数据 | 后台专利批量运营 | 后台认领审核 | 备注 |
|---|---|---|---|---|---|---|---|---|
| `id` | 认领单编号 | - | - | 展示 | - | - | 展示 | |
| `patent_id` | 专利编号 | - | 间接 | 展示 | - | - | 展示 | |
| `applicant_user_id` | 申请用户编号 | - | - | - | - | - | 展示 | |
| `status` | 审核状态 | - | 间接 | 展示/筛选 | - | - | 展示/筛选 | |
| `claim_reason` | 认领说明 | - | - | 录入/展示 | - | - | 展示 | |
| `evidence_file_ids_json` | 证据文件编号列表 | - | - | 录入 | - | - | 间接（数量） | 具体文件在 `files` |
| `reviewer_user_id` | 审核人 | - | - | 展示 | - | - | 展示 | |
| `review_comment` | 审核备注 | - | - | 展示 | - | - | 录入/展示 | |
| `submitted_at` | 提交时间 | - | - | 展示 | - | - | 展示 | |
| `reviewed_at` | 审核时间 | - | - | 展示 | - | - | 展示 | |
| `created_at` | 创建时间 | - | - | - | - | - | 间接 | 审计字段 |
| `updated_at` | 更新时间 | - | - | - | - | - | 间接 | 审计字段 |

### 8.4 导入与附件表字段 -> 页面对应关系（后台重点）

| 表.字段 | 中文含义 | 页面对应 | 备注 |
|---|---|---|---|
| `patent_import_jobs.id/status/*count/fail_rate` | 导入任务主状态与统计 | 后台专利批量运营：任务列表 | 任务主进度与质量指标 |
| `patent_import_jobs.duplicate_policy/defaults_json` | 重复策略与默认挂牌策略 | 后台专利批量运营：策略配置 | 对导入执行和批量上架生效 |
| `patent_import_jobs.validated_at/started_at/finished_at/paused_at` | 任务节点时间 | 后台专利批量运营：任务列表 | 用于审计导入过程 |
| `patent_import_jobs.file_id/error_file_id` | 源文件与错误文件 | 后台专利批量运营：上传/错误下载 | 关联 `files` |
| `patent_import_job_rows.row_no/status/patent_id` | 行号、行状态、落库专利编号 | 后台专利批量运营：任务行明细 | 核对单行处理结果 |
| `patent_import_job_rows.raw_json/normalized_json` | 原始行与规范化行 | 后台专利批量运营：任务行明细抽屉 | 用于字段级排错 |
| `patent_import_job_rows.error_code/error_message` | 行级错误码与错误信息 | 后台专利批量运营：任务行明细 | 用于数据修复 |
| `files.id/url/file_name/mime_type/size_bytes` | 文件主信息 | 小程序发布/认领上传；后台导入上传 | 专利证明、认领证据、导入文件共用 |
| `files.owner_scope/owner_id` | 文件归属范围/主体 | 同上 | 用于鉴权与隔离 |

## 9. 页面可见字段逐条清单（甲方逐项审阅）

本章按“页面可见内容”逐条列出，便于甲方逐项过目。每条均对应前端字段与数据库字段。

### 9.1 小程序：发布专利页 `subpackages/publish/patent/index`

| 序号 | 页面可见内容 | 前端字段/接口字段 | 对应数据库字段 |
|---|---|---|---|
| 1 | 专利号/申请号/公开号 | `patentNumberRaw` | `patents.application_no_norm`、`patent_identifiers.id_value_norm` |
| 2 | 专利标题 | `title` | `listings.title`（必要时同步 `patents.title`） |
| 3 | 专利类型 | `patentType` | `patents.patent_type` |
| 4 | 交易方式 | `tradeMode` | `listings.trade_mode` |
| 5 | 许可方式（许可模式下） | `licenseMode` | `listings.license_mode` |
| 6 | 发明人 | `inventorNames[]` | `patent_parties(role=INVENTOR)` |
| 7 | 权利人/专利权人 | `assigneeNames[]` | `patent_parties(role=ASSIGNEE)` |
| 8 | 申请人 | `applicantNames[]` | `patent_parties(role=APPLICANT)` |
| 9 | 摘要/卖点 | `summary` | `listings.summary` |
| 10 | 可交付资料清单 | 页面输入后归并到 `summary` | `listings.summary` |
| 11 | 预计周期 | 页面输入后归并到 `summary` | `listings.summary` |
| 12 | 可谈空间 | 页面输入后归并到 `summary` | `listings.summary` |
| 13 | 质押/许可现状声明 | 页面输入后归并到 `summary` | `listings.summary` |
| 14 | IPC 分类号 | `ipcCodes[]` | `patent_classifications(system=IPC)` |
| 15 | LOC 分类号 | `locCodes[]` | `patent_classifications(system=LOC)` |
| 16 | 所在地区 | `regionCode` | `listings.region_code` |
| 17 | 行业标签 | `industryTags[]` | `listings.industry_tags_json` |
| 18 | 特色标签 | `listingTopics[]` | `listings.listing_topics_json` |
| 19 | 权属证明材料 | `proofFileIds[]` | `files.id`、`listings.proof_file_ids_json` |
| 20 | 价格类型 | `priceType` | `listings.price_type` |
| 21 | 标价（元） | `priceAmountFen` | `listings.price_amount` |
| 22 | 订金（元） | `depositAmountFen` | `listings.deposit_amount` |
| 23 | 草稿状态显示 | `Listing.status` | `listings.status` |
| 24 | 审核状态显示 | `Listing.auditStatus` | `listings.audit_status` |

### 9.2 小程序：专利详情页 `subpackages/patent/detail/index`

| 序号 | 页面可见内容 | 前端字段/接口字段 | 对应数据库字段 |
|---|---|---|---|
| 1 | 专利标题 | `Patent.title` | `patents.title` |
| 2 | 专利类型 | `Patent.patentType` | `patents.patent_type` |
| 3 | 法律状态 | `Patent.legalStatus` | `patents.legal_status` |
| 4 | 申请号 | `applicationNoDisplay/applicationNoNorm` | `patents.application_no_display/application_no_norm` |
| 5 | 专利摘要 | `Patent.abstract` | `patents.abstract` |
| 6 | 说明书附件（封面/附图） | `Patent.media[]` | `listing_media` + `files`（聚合后返回） |
| 7 | 专利号 | `Patent.patentNoDisplay` | `patents.patent_no_display` |
| 8 | 国际专利分类（IPC） | `Patent.mainIpcCode` | `patent_classifications(system=IPC)` |
| 9 | 洛迦诺分类（LOC） | `Patent.locCodes[]` | `patent_classifications(system=LOC)` |
| 10 | 申请日 | `Patent.filingDate` | `patents.filing_date` |
| 11 | 公开日 | `Patent.publicationDate` | `patents.publication_date` |
| 12 | 授权日 | `Patent.grantDate` | `patents.grant_date` |
| 13 | 剩余年限 | 前端计算值 | 基于 `filing_date` 与 `patent_type` 计算 |
| 14 | 发明人 | `Patent.inventorNames[]` | `patent_parties(role=INVENTOR)` |
| 15 | 权利人 | `Patent.assigneeNames[]` | `patent_parties(role=ASSIGNEE)` |
| 16 | 申请人 | `Patent.applicantNames[]` | `patent_parties(role=APPLICANT)` |
| 17 | 权利要求数量 | `claimCount` | 聚合字段（说明书统计） |
| 18 | 说明书页数 | `specPageCount` | 聚合字段（说明书统计） |
| 19 | 说明书字数 | `specWordCount` | 聚合字段（说明书统计） |
| 20 | 附图数量 | `specFigureCount` | 聚合字段（说明书统计） |
| 21 | 挂牌编号 | `tradeSnapshot.listingId` | `listings.id` |
| 22 | 价格类型/价格/订金 | `tradeSnapshot.priceType/priceAmountFen/depositAmountFen` | `listings.price_type/price_amount/deposit_amount` |
| 23 | 供方信息 | `tradeSnapshot.seller.*` | `users`（聚合返回） |
| 24 | 数据来源与更新时间 | `sourcePrimary/sourceUpdatedAt` | `patents.source_primary/source_updated_at` |
| 25 | 认领入口可用性 | `sourcePrimary + ownerUserId` 判定 | `patents.source_primary/owner_user_id` |

### 9.3 小程序：专利认领页 `subpackages/patent-claims/index`

| 序号 | 页面可见内容 | 前端字段/接口字段 | 对应数据库字段 |
|---|---|---|---|
| 1 | 认领目标专利标题 | `Patent.title` | `patents.title` |
| 2 | 来源标签 | `Patent.sourcePrimary` | `patents.source_primary` |
| 3 | 申请号 | `applicationNoDisplay/applicationNoNorm` | `patents.application_no_display/application_no_norm` |
| 4 | 归属提示（是否已归属个人） | `Patent.ownerUserId` | `patents.owner_user_id` |
| 5 | 认领说明输入 | `claimReason` | `patent_claim_requests.claim_reason` |
| 6 | 证明材料上传 | `evidenceFileIds[]` | `patent_claim_requests.evidence_file_ids_json` + `files` |
| 7 | 提交认领按钮 | `POST /me/patent-claims` | 新增 `patent_claim_requests` |
| 8 | 状态筛选（全部/待审核/已通过/已驳回） | `statusFilter` | `patent_claim_requests.status` |
| 9 | 认领单编号 | `item.id` | `patent_claim_requests.id` |
| 10 | 专利编号 | `item.patentId` | `patent_claim_requests.patent_id` |
| 11 | 提交时间 | `item.submittedAt` | `patent_claim_requests.submitted_at` |
| 12 | 审核意见 | `item.reviewComment` | `patent_claim_requests.review_comment` |
| 13 | 审核时间 | `item.reviewedAt` | `patent_claim_requests.reviewed_at` |
| 14 | 证据文件数量 | `item.evidenceFileIds.length` | `patent_claim_requests.evidence_file_ids_json` |

### 9.4 小程序：专利地图页 `subpackages/patent-map/index`

| 序号 | 页面可见内容 | 前端字段/接口字段 | 对应数据库字段 |
|---|---|---|---|
| 1 | 数据范围切换（活跃上架/全部） | `filters.scope` | `listings.status/audit_status` |
| 2 | 总览时间 | `generatedAt` | 聚合查询时间戳 |
| 3 | KPI：专利数 | `summary.totalPatentCount` | `patents` 聚合 |
| 4 | KPI：挂牌数 | `summary.totalListingCount` | `listings` 聚合 |
| 5 | KPI：活跃上榜 | `summary.activeRankedListingCount` | `listings.featured_*` 聚合 |
| 6 | KPI：覆盖区域 | `summary.totalRegionCount` | `regions` 聚合 |
| 7 | KPI：有挂牌区域 | `summary.regionsWithListingsCount` | `listings.region_code` 聚合 |
| 8 | KPI：未归属地区挂牌数 | `summary.unassignedListingCount` | `listings.region_code is null` 聚合 |
| 9 | 区域排名（区域名/排名/挂牌数/专利数） | `regions[].regionName/rankPosition/listingCount/patentCount` | `regions` + `listings` + `patents` |
| 10 | 区域明细：挂牌标题 | `items[].title` | `listings.title` |
| 11 | 区域明细：专利标题/申请号/类型 | `items[].patentTitle/applicationNoDisplay/patentType` | `patents.title/application_no_display/patent_type` |
| 12 | 区域明细：价格与订金 | `items[].priceType/priceAmountFen/depositAmountFen` | `listings.price_type/price_amount/deposit_amount` |
| 13 | 区域明细：上榜状态 | `items[].featuredLevel/featuredRank/featuredUntil/isFeaturedActive` | `listings.featured_level/featured_rank/featured_until` |
| 14 | 区域明细：挂牌创建与更新时间 | `items[].createdAt/updatedAt` | `listings.created_at/updated_at` |

### 9.5 小程序：年费托管页 `subpackages/maintenance/index`

| 序号 | 页面可见内容（中文） | 前端字段/接口字段 | 对应数据库字段 |
|---|---|---|---|
| 1 | 页面标题“专利年费托管”（代码文案 `Patent Maintenance`） | 页面固定文案 | 无 |
| 2 | 汇总卡片“逾期排期”（代码文案 `Overdue schedules`） | `summary.overdue` | `patent_maintenance_schedules.status` 聚合 |
| 3 | 汇总卡片“7天内到期”（代码文案 `Due in 7 days`） | `summary.dueSoon` | `patent_maintenance_schedules.due_date` 聚合 |
| 4 | 汇总卡片“进行中任务”（代码文案 `Open tasks`） | `summary.openTasks` | `patent_maintenance_tasks.status` 聚合 |
| 5 | 汇总卡片“进行中订单”（代码文案 `Open orders`） | `summary.openOrders` | `patent_maintenance_orders.status` 聚合 |
| 6 | 页签“排期/任务/订单”（代码文案 `Schedules/Tasks/Orders`） | `tab` | 无 |
| 7 | 排期卡片：专利标题、申请号、年度、应缴日、宽限期、状态、紧急度 | `PatentMaintenanceSchedule.*` | `patent_maintenance_schedules.*` + `patents` |
| 8 | 排期动作：由排期创建订单 | `POST /me/patent-maintenance/orders` | 新增 `patent_maintenance_orders` |
| 9 | 任务卡片：任务状态、备注、证据文件、关联年度/应缴日 | `PatentMaintenanceTask.*` | `patent_maintenance_tasks.*` + 关联排期字段 |
| 10 | 订单卡片：订单号、金额、付款截止、对账状态、状态 | `PatentMaintenanceOrder.*` | `patent_maintenance_orders.*` |
| 11 | 订单动作：进入会话 | `POST /patent-maintenance/orders/{orderId}/conversations` | `conversations` |
| 12 | 订单动作：查看时间线 | `GET /me/patent-maintenance/orders/{orderId}/events` | `patent_maintenance_order_events.*` |
| 13 | 时间线项：事件类型、状态变更、操作人、时间、备注 | `PatentMaintenanceOrderEvent.*` | `patent_maintenance_order_events.*` |

### 9.6 管理后台：专利主数据管理页 `PatentsPage`

| 序号 | 页面可见内容 | 前端字段/接口字段 | 对应数据库字段 |
|---|---|---|---|
| 1 | 关键词筛选（标题/申请号/权利人） | `q` | `patents.title/application_no_*` + `patent_parties.name` |
| 2 | 专利类型筛选 | `patentType` | `patents.patent_type` |
| 3 | 法律状态筛选 | `legalStatus` | `patents.legal_status` |
| 4 | 来源筛选 | `sourcePrimary` | `patents.source_primary` |
| 5 | 列表：专利名称 | `title` | `patents.title` |
| 6 | 列表：申请号展示值 | `applicationNoDisplay/applicationNoNorm` | `patents.application_no_display/application_no_norm` |
| 7 | 列表：专利类型 | `patentType` | `patents.patent_type` |
| 8 | 列表：法律状态 | `legalStatus` | `patents.legal_status` |
| 9 | 列表：权利人/申请人 | `assigneeNames[]/applicantNames[]` | `patent_parties` |
| 10 | 列表：更新时间 | `updatedAt` | `patents.updated_at` |
| 11 | 新建/编辑：申请号（规范号） | `applicationNoNorm` | `patents.application_no_norm` |
| 12 | 新建/编辑：申请号展示值 | `applicationNoDisplay` | `patents.application_no_display` |
| 13 | 新建/编辑：专利类型、名称、摘要 | `patentType/title/abstract` | `patents.patent_type/title/abstract` |
| 14 | 新建/编辑：申请日/公开日/授权日 | `filingDate/publicationDate/grantDate` | `patents.filing_date/publication_date/grant_date` |
| 15 | 新建/编辑：来源与来源更新时间 | `sourcePrimary/sourceUpdatedAt` | `patents.source_primary/source_updated_at` |
| 16 | 新建/编辑：发明人/权利人/申请人 | `inventorNames[]/assigneeNames[]/applicantNames[]` | `patent_parties` |
| 17 | 号码规范化按钮 | `POST /patents/normalize` | 不落库（仅回填表单） |

### 9.7 管理后台：专利批量运营页 `PatentOperationsPage`

| 序号 | 页面可见内容 | 前端字段/接口字段 | 对应数据库字段 |
|---|---|---|---|
| 1 | 导入模板列：申请号 | 模板字段 `applicationNoNorm` | `patents.application_no_norm` |
| 2 | 导入模板列：发明名称（标题） | 模板字段 `title` | `patents.title` |
| 3 | 导入模板列：专利类型 | 模板字段 `patentType` | `patents.patent_type` |
| 4 | 导入模板列：法律状态 | 模板字段 `legalStatus` | `patents.legal_status` |
| 5 | 导入模板列：申请日/授权日/公开日 | 模板字段日期列 | `patents.filing_date/grant_date/publication_date` |
| 6 | 导入模板列：申请（专利权）人/申请人/发明人 | 模板字段多值列 | `patent_parties` |
| 7 | 导入模板列：摘要 | 模板字段 `abstract` | `patents.abstract` |
| 8 | 默认挂牌策略：交易模式/许可模式 | `listingDefaults.tradeMode/licenseMode` | `listings.trade_mode/license_mode` |
| 9 | 默认挂牌策略：价格类型/价格/订金 | `listingDefaults.priceType/priceAmountFen/depositAmountFen` | `listings.price_type/price_amount/deposit_amount` |
| 10 | 默认挂牌策略：地区/行业标签/特色标签 | `listingDefaults.regionCode/industryTags/listingTopics` | `listings.region_code/industry_tags_json/listing_topics_json` |
| 11 | 默认挂牌策略：咨询路由/卖家用户编号 | `listingDefaults.consultationRouting/sellerUserId` | `listings.consultation_routing/seller_user_id` |
| 12 | 导入任务列表：任务ID、状态、统计、失败率 | `PatentImportJob.*` | `patent_import_jobs.*` |
| 13 | 导入行明细：行号、状态、申请号、标题、专利ID、错误信息 | `PatentImportJobRow.*` | `patent_import_job_rows.*` |
| 14 | 按专利ID批量上架：专利ID输入与结果 | `patentIds[]`、`PatentListingGenerateResult` | 读取 `patents.id`，写入 `listings` |
| 15 | 专利地图总览：范围、区域榜单与统计 | `PatentMapOverviewResponse.*` | `listings` + `patents` + `regions` 聚合 |
| 16 | 专利地图区域明细：挂牌字段、价格字段、上榜字段 | `PatentMapRegionDetailResponse.items[]` | `listings.*` + `patents.*` |
| 17 | 专利地图批量补丁：区域/上榜级别/排名/过期时间 | `patch.regionCode/featuredLevel/featuredRank/featuredUntil` | `listings.region_code/featured_*` |

### 9.8 管理后台：专利认领审核页 `PatentClaimsPage`

| 序号 | 页面可见内容 | 前端字段/接口字段 | 对应数据库字段 |
|---|---|---|---|
| 1 | 筛选：关键词、状态 | `q/status` | `patent_claim_requests.claim_reason/status` |
| 2 | 列表：认领单ID | `id` | `patent_claim_requests.id` |
| 3 | 列表：专利ID | `patentId` | `patent_claim_requests.patent_id` |
| 4 | 列表：申请用户ID | `applicantUserId` | `patent_claim_requests.applicant_user_id` |
| 5 | 列表：认领说明 | `claimReason` | `patent_claim_requests.claim_reason` |
| 6 | 列表：证据文件数 | `evidenceFileIds.length` | `patent_claim_requests.evidence_file_ids_json` |
| 7 | 列表：提交时间 | `submittedAt` | `patent_claim_requests.submitted_at` |
| 8 | 列表：审核人、审核时间、审核备注 | `reviewerUserId/reviewedAt/reviewComment` | `patent_claim_requests.reviewer_user_id/reviewed_at/review_comment` |
| 9 | 操作：通过 | `POST /admin/patent-claims/{id}/approve` | 更新 `patent_claim_requests`，同步 `patents.owner_*` 与 `listings.seller_user_id` |
| 10 | 操作：驳回 | `POST /admin/patent-claims/{id}/reject` | 更新 `patent_claim_requests.status=REJECTED` |

### 9.9 管理后台：维保运营页 `MaintenancePage`

| 序号 | 页面可见内容（中文） | 前端字段/接口字段 | 对应数据库字段 |
|---|---|---|---|
| 1 | 选项卡“排期管理/任务管理/订单管理” | 页面结构 | 无 |
| 2 | 排期筛选：专利ID、状态、应缴日期区间 | `patentId/status/dueFrom/dueTo` | `patent_maintenance_schedules.patent_id/status/due_date` |
| 3 | 排期列表：专利ID、年度、应缴日、宽限期、状态、更新时间 | `Schedule.*` | `patent_maintenance_schedules.*` |
| 4 | 排期操作：新建/编辑 | `POST/PATCH /admin/patent-maintenance/schedules*` | `patent_maintenance_schedules.*` |
| 5 | 任务筛选：排期ID、客服ID、状态 | `scheduleId/assignedCsUserId/status` | `patent_maintenance_tasks.schedule_id/assigned_cs_user_id/status` |
| 6 | 任务列表：任务ID、排期ID、客服、状态、备注、证据文件、更新时间 | `Task.*` | `patent_maintenance_tasks.*` |
| 7 | 任务操作：新建/编辑 | `POST/PATCH /admin/patent-maintenance/tasks*` | `patent_maintenance_tasks.*` |
| 8 | 订单筛选：排期ID、申请人、客服、状态、对账状态 | `scheduleId/applicantUserId/assignedCsUserId/status/reconcileStatus` | `patent_maintenance_orders.*` |
| 9 | 订单列表：专利标题、申请号、年度、应缴日 | `patentTitle/applicationNoDisplay/scheduleYearNo/scheduleDueDate` | `patents` + `patent_maintenance_orders` 关联结果 |
| 10 | 订单列表：金额、支付渠道、支付流水、支付截止、支付时间 | `totalAmountFen/paymentChannel/paymentTxnNo/paymentDeadline/paidAt` | `patent_maintenance_orders.*` |
| 11 | 订单列表：执行时间、对账状态、更新时间 | `executedAt/reconcileStatus/updatedAt` | `patent_maintenance_orders.*` |
| 12 | 创建订单 | `POST /admin/patent-maintenance/orders` | 新增 `patent_maintenance_orders` |
| 13 | 订单动作：报价 | `POST /admin/patent-maintenance/orders/{id}/quote` | 更新费用字段、支付截止字段 |
| 14 | 订单动作：付款确认 | `POST /admin/patent-maintenance/orders/{id}/payment-confirm` | 更新支付渠道、流水号、付款时间 |
| 15 | 订单动作：执行确认 | `POST /admin/patent-maintenance/orders/{id}/execution` | 更新执行时间、官方提交号 |
| 16 | 订单动作：上传回执 | `POST /admin/patent-maintenance/orders/{id}/receipt` | 更新回执号、回执文件ID、回执时间 |
| 17 | 订单动作：对账/关闭/取消 | `POST /admin/patent-maintenance/orders/{id}/reconcile|close|cancel` | 更新对账状态与关闭备注 |
| 18 | 订单时间线 | `GET /admin/patent-maintenance/orders/{id}/events` | `patent_maintenance_order_events.*` |

## 10. 专利维保与地图字段补充（全量）

### 10.1 `patent_maintenance_schedules`（维保排期）

| 字段 | 类型 | 中文说明 | 页面使用位置 |
|---|---|---|---|
| `id` | `uuid` | 排期主键 | 小程序年费托管、后台维保运营 |
| `patent_id` | `uuid` | 关联专利编号 | 小程序年费托管、后台维保运营 |
| `year_no` | `int` | 年费年度（第 N 年） | 小程序年费托管、后台维保运营 |
| `due_date` | `date` | 应缴日期 | 小程序年费托管、后台维保运营 |
| `grace_period_end` | `date?` | 宽限期截止日期 | 小程序年费托管、后台维保运营 |
| `status` | `enum` | 排期状态（到期/已缴/逾期/豁免） | 小程序年费托管、后台维保运营 |
| `created_at` | `datetime` | 创建时间 | 审计字段 |
| `updated_at` | `datetime` | 更新时间 | 小程序年费托管、后台维保运营 |

### 10.2 `patent_maintenance_tasks`（维保任务）

| 字段 | 类型 | 中文说明 | 页面使用位置 |
|---|---|---|---|
| `id` | `uuid` | 任务主键 | 小程序年费托管、后台维保运营 |
| `schedule_id` | `uuid` | 关联排期编号 | 小程序年费托管、后台维保运营 |
| `assigned_cs_user_id` | `uuid?` | 指派客服编号 | 后台维保运营 |
| `status` | `enum` | 任务状态（待办/处理中/完成/取消） | 小程序年费托管、后台维保运营 |
| `note` | `string?` | 任务备注 | 小程序年费托管、后台维保运营 |
| `evidence_file_id` | `uuid?` | 任务证据文件编号 | 小程序年费托管、后台维保运营 |
| `created_at` | `datetime` | 创建时间 | 审计字段 |
| `updated_at` | `datetime` | 更新时间 | 小程序年费托管、后台维保运营 |

### 10.3 `patent_maintenance_orders`（维保订单）

| 字段 | 类型 | 中文说明 | 页面使用位置 |
|---|---|---|---|
| `id` | `uuid` | 订单主键 | 小程序年费托管、后台维保运营 |
| `schedule_id` | `uuid` | 关联排期编号 | 小程序年费托管、后台维保运营 |
| `applicant_user_id` | `uuid` | 申请用户编号 | 小程序年费托管、后台维保运营 |
| `assigned_cs_user_id` | `uuid?` | 指派客服编号 | 后台维保运营 |
| `status` | `enum` | 订单状态 | 小程序年费托管、后台维保运营 |
| `payment_channel` | `enum?` | 支付渠道 | 小程序年费托管、后台维保运营 |
| `official_fee_fen` | `int` | 官费（分） | 小程序年费托管、后台维保运营 |
| `late_fee_fen` | `int` | 滞纳金（分） | 小程序年费托管、后台维保运营 |
| `service_fee_fen` | `int` | 服务费（分） | 小程序年费托管、后台维保运营 |
| `total_amount_fen` | `int` | 总金额（分） | 小程序年费托管、后台维保运营 |
| `payment_deadline` | `datetime?` | 付款截止时间 | 小程序年费托管、后台维保运营 |
| `paid_at` | `datetime?` | 付款时间 | 小程序年费托管、后台维保运营 |
| `executed_at` | `datetime?` | 执行时间 | 小程序年费托管、后台维保运营 |
| `receipt_issued_at` | `datetime?` | 回执开具时间 | 小程序年费托管、后台维保运营 |
| `official_submission_no` | `string?` | 官方提交号 | 后台维保运营 |
| `official_receipt_no` | `string?` | 官方回执号 | 后台维保运营 |
| `payment_txn_no` | `string?` | 支付流水号 | 小程序年费托管、后台维保运营 |
| `official_receipt_file_id` | `uuid?` | 官方回执文件编号 | 后台维保运营 |
| `reconcile_status` | `enum` | 对账状态 | 小程序年费托管、后台维保运营 |
| `reconcile_note` | `string?` | 对账备注 | 后台维保运营 |
| `close_note` | `string?` | 关闭备注 | 后台维保运营 |
| `created_at` | `datetime` | 创建时间 | 审计字段 |
| `updated_at` | `datetime` | 更新时间 | 小程序年费托管、后台维保运营 |

### 10.4 `patent_maintenance_order_events`（维保订单事件）

| 字段 | 类型 | 中文说明 | 页面使用位置 |
|---|---|---|---|
| `id` | `uuid` | 事件主键 | 小程序年费托管、后台维保运营 |
| `order_id` | `uuid` | 关联订单编号 | 小程序年费托管、后台维保运营 |
| `actor_user_id` | `uuid?` | 操作人编号 | 小程序年费托管、后台维保运营 |
| `event_type` | `enum` | 事件类型（报价/付款确认/执行/回执/对账/关闭/取消等） | 小程序年费托管、后台维保运营 |
| `from_status` | `enum?` | 变更前状态 | 小程序年费托管、后台维保运营 |
| `to_status` | `enum` | 变更后状态 | 小程序年费托管、后台维保运营 |
| `note` | `string?` | 事件备注 | 小程序年费托管、后台维保运营 |
| `payload_json` | `json?` | 事件扩展信息 | 后台维保运营（排查与审计） |
| `created_at` | `datetime` | 创建时间 | 小程序年费托管、后台维保运营 |

### 10.5 专利地图接口字段补充（重点）

#### 10.5.1 `PatentMapOverviewResponse`

| 字段 | 中文说明 | 对应数据库来源 |
|---|---|---|
| `generatedAt` | 总览生成时间 | 聚合查询时间戳 |
| `filters.regionLevel` | 区域层级（省/市/区） | 查询参数 |
| `filters.top` | 榜单数量上限 | 查询参数 |
| `filters.scope` | 数据范围（活跃上架/全部） | 查询参数 |
| `summary.totalListingCount` | 挂牌总数 | `listings` 聚合 |
| `summary.totalPatentCount` | 专利总数 | `patents` 聚合 |
| `summary.totalRegionCount` | 覆盖区域数 | `regions` 聚合 |
| `summary.regionsWithListingsCount` | 有挂牌区域数 | `listings.region_code` 聚合 |
| `summary.regionsWithPatentsCount` | 有专利区域数 | `patents` 与区域映射聚合 |
| `summary.regionsWithActiveRankedCount` | 有活跃上榜区域数 | `listings.featured_*` 聚合 |
| `summary.rankedListingCount` | 上榜挂牌数 | `listings.featured_level` 聚合 |
| `summary.activeRankedListingCount` | 活跃上榜挂牌数 | `listings.featured_until` 聚合 |
| `summary.unassignedListingCount` | 未归属地区挂牌数 | `listings.region_code is null` 聚合 |
| `summary.mappableRegionCount` | 可地图定位区域数 | `regions.center_lat/center_lng` |
| `ranking[]/regions[]` | 区域榜单项 | `regions` + `listings` + `patents` 聚合 |
| `ranking[].regionCode` | 区域编码 | `regions.code` |
| `ranking[].regionName` | 区域名称 | `regions.name` |
| `ranking[].regionLevel` | 区域层级 | `regions.level` |
| `ranking[].centerLat/centerLng` | 区域中心点 | `regions.center_lat/center_lng` |
| `ranking[].listingCount` | 该区域挂牌数 | `listings` 聚合 |
| `ranking[].patentCount` | 该区域专利数 | `patents` 聚合 |
| `ranking[].rankedListingCount` | 该区域上榜挂牌数 | `listings.featured_level` 聚合 |
| `ranking[].activeRankedListingCount` | 该区域活跃上榜数 | `listings.featured_until` 聚合 |
| `ranking[].topActiveRank` | 最佳活跃名次 | `listings.featured_rank` 聚合 |
| `ranking[].rankPosition` | 当前榜单名次 | 聚合排序结果 |

#### 10.5.2 `PatentMapRegionDetailResponse`

| 字段 | 中文说明 | 对应数据库来源 |
|---|---|---|
| `generatedAt` | 明细生成时间 | 聚合查询时间戳 |
| `filters.scope` | 数据范围 | 查询参数 |
| `region.code/name/level/parentCode` | 当前区域基础信息 | `regions` |
| `region.centerLat/centerLng` | 区域中心点 | `regions.center_lat/center_lng` |
| `region.descendantRegionCodeCount` | 下级区域数量 | `regions` 聚合 |
| `summary.listingCount` | 当前区域挂牌数 | `listings` 聚合 |
| `summary.patentCount` | 当前区域专利数 | `patents` 聚合 |
| `summary.rankedListingCount` | 当前区域上榜挂牌数 | `listings.featured_level` 聚合 |
| `summary.activeRankedListingCount` | 当前区域活跃上榜数 | `listings.featured_until` 聚合 |
| `summary.topActiveRank` | 当前区域最佳活跃名次 | `listings.featured_rank` 聚合 |
| `items[].listingId` | 挂牌编号 | `listings.id` |
| `items[].patentId` | 专利编号 | `listings.patent_id` |
| `items[].title` | 挂牌标题 | `listings.title` |
| `items[].patentTitle` | 专利标题 | `patents.title` |
| `items[].patentType` | 专利类型 | `patents.patent_type` |
| `items[].applicationNoDisplay` | 申请号展示值 | `patents.application_no_display` |
| `items[].regionCode` | 地区编码 | `listings.region_code` |
| `items[].tradeMode` | 交易方式 | `listings.trade_mode` |
| `items[].priceType` | 价格类型 | `listings.price_type` |
| `items[].priceAmountFen` | 价格金额（分） | `listings.price_amount` |
| `items[].depositAmountFen` | 订金金额（分） | `listings.deposit_amount` |
| `items[].featuredLevel` | 上榜层级 | `listings.featured_level` |
| `items[].featuredRegionCode` | 上榜区域编码 | `listings.featured_region_code` |
| `items[].featuredRank` | 上榜名次 | `listings.featured_rank` |
| `items[].featuredUntil` | 上榜截止时间 | `listings.featured_until` |
| `items[].isFeaturedActive` | 是否处于活跃上榜 | 由 `featured_until` 计算 |
| `items[].createdAt/updatedAt` | 创建/更新时间 | `listings.created_at/updated_at` |
| `page.page/pageSize/total` | 分页信息 | 查询结果分页 |

### 10.6 维保页面英文字段中文对照（用于甲方评审）

| 页面英文文案 | 中文建议口径 |
|---|---|
| `Patent Maintenance` | 专利年费托管 |
| `Overdue schedules` | 逾期排期 |
| `Due in 7 days` | 7天内到期 |
| `Open tasks` | 进行中任务 |
| `Open orders` | 进行中订单 |
| `Schedules` | 排期 |
| `Tasks` | 任务 |
| `Orders` | 订单 |
| `Application No` | 申请号 |
| `Fee Year` | 年费年度 |
| `Due Date` | 应缴日期 |
| `Grace End` | 宽限期截止 |
| `Payment Deadline` | 付款截止时间 |
| `Reconcile` | 对账状态 |
| `Order Timeline` | 订单时间线 |

