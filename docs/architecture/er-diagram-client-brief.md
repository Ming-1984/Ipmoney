# ER 图专项讲解（甲方评审版）

## 1. 图文件说明

- 图文件：`docs/architecture/er-diagram-cn.mmd`
- 渲染图：`docs/architecture/rendered/er-diagram.png`
- 目标：用于甲乙双方对齐“核心数据对象、字段口径、关系边界、交易与资金闭环”。

## 2. 先讲结论（评审开场可直接使用）

1. 本图覆盖用户、挂牌、订单、支付、合同、结算、售后、会话、通知、审计、维保的核心数据闭环。
2. 交易主链路为：`用户 -> 挂牌 -> 订单 -> 支付 -> 合同 -> 结算 -> 售后`。
3. 平台治理能力（幂等键、审计日志、系统配置）已独立建模，可支撑合规留痕与稳定性保障。

## 3. 实体总览（中英对照）

| 英文表名 | 中文表名 | 业务域 | 说明 |
|---|---|---|---|
| `USERS` | 用户表 | 用户与权限域 | 账户、权限与身份认证 |
| `RBAC_ROLES` | 权限角色表 | 用户与权限域 | 账户、权限与身份认证 |
| `RBAC_USER_ROLES` | 用户角色关联表 | 用户与权限域 | 账户、权限与身份认证 |
| `USER_VERIFICATIONS` | 用户认证表 | 用户与权限域 | 账户、权限与身份认证 |
| `REGIONS` | 地区字典表 | 基础字典域 | 业务支撑表 |
| `INDUSTRY_TAGS` | 行业标签表 | 基础字典域 | 业务支撑表 |
| `PATENTS` | 专利主表 | 专利与挂牌域 | 业务支撑表 |
| `FILES` | 文件资源表 | 文件中心域 | 业务支撑表 |
| `LISTINGS` | 挂牌主表 | 专利与挂牌域 | 交易资金主链路核心表 |
| `LISTING_MEDIA` | 挂牌媒体表 | 专利与挂牌域 | 业务支撑表 |
| `LISTING_AUDIT_LOGS` | 挂牌审核日志表 | 专利与挂牌域 | 业务支撑表 |
| `LISTING_FAVORITES` | 挂牌收藏表 | 专利与挂牌域 | 业务支撑表 |
| `LISTING_STATS` | 挂牌统计表 | 专利与挂牌域 | 业务支撑表 |
| `ORDERS` | 订单主表 | 交易资金域 | 交易资金主链路核心表 |
| `PAYMENTS` | 支付流水表 | 交易资金域 | 交易资金主链路核心表 |
| `REFUND_REQUESTS` | 退款申请表 | 交易资金域 | 业务支撑表 |
| `CONTRACTS` | 合同表 | 交易资金域 | 交易资金主链路核心表 |
| `SETTLEMENTS` | 结算表 | 交易资金域 | 交易资金主链路核心表 |
| `CS_CASES` | 客服工单表 | 客服与风控域 | 客服协同与沟通留痕 |
| `CS_MILESTONES` | 工单里程碑表 | 客服与风控域 | 客服协同与沟通留痕 |
| `CS_CASE_NOTES` | 工单备注表 | 客服与风控域 | 客服协同与沟通留痕 |
| `CS_CASE_EVIDENCES` | 工单凭证表 | 客服与风控域 | 客服协同与沟通留痕 |
| `CONVERSATIONS` | 会话表 | 客服与风控域 | 客服协同与沟通留痕 |
| `CONVERSATION_PARTICIPANTS` | 会话参与人表 | 客服与风控域 | 客服协同与沟通留痕 |
| `CONVERSATION_MESSAGES` | 会话消息表 | 客服与风控域 | 客服协同与沟通留痕 |
| `NOTIFICATIONS` | 通知表 | 平台治理域 | 业务支撑表 |
| `SYSTEM_CONFIGS` | 系统配置表 | 平台治理域 | 治理、审计与稳定性保障 |
| `IDEMPOTENCY_KEYS` | 幂等键表 | 平台治理域 | 治理、审计与稳定性保障 |
| `AUDIT_LOGS` | 审计日志表 | 平台治理域 | 治理、审计与稳定性保障 |
| `PATENT_MAINTENANCE_SCHEDULES` | 专利维保日程表 | 专利维保域 | 专利维保计划与执行闭环 |
| `PATENT_MAINTENANCE_TASKS` | 专利维保任务表 | 专利维保域 | 专利维保计划与执行闭环 |
| `PATENT_MAINTENANCE_ORDERS` | 专利维保订单表 | 专利维保域 | 专利维保计划与执行闭环 |

## 4. 关系总览（中文翻译）

| 左表 | 右表 | 基数关系 | 关系标签（原文） | 中文释义 |
|---|---|---|---|---|
| `USERS`（用户表） | `RBAC_USER_ROLES`（用户角色关联表） | 一对多（左一右多） | `has` | 拥有 |
| `RBAC_ROLES`（权限角色表） | `RBAC_USER_ROLES`（用户角色关联表） | 一对多（左一右多） | `assigned_to` | 分配给 |
| `USERS`（用户表） | `USER_VERIFICATIONS`（用户认证表） | 一对多（左一右多） | `submits` | 提交 |
| `USERS`（用户表） | `USER_VERIFICATIONS`（用户认证表） | 一对多（左一右多） | `reviews` | 审核 |
| `REGIONS`（地区字典表） | `USERS`（用户表） | 一对多（左一右多） | `belongs_to` | 归属 |
| `REGIONS`（地区字典表） | `USER_VERIFICATIONS`（用户认证表） | 一对多（左一右多） | `applies_in` | 适用地区 |
| `USERS`（用户表） | `FILES`（文件资源表） | 一对多（左一右多） | `owns` | 拥有 |
| `PATENTS`（专利主表） | `LISTINGS`（挂牌主表） | 一对多（左一右多） | `referenced_by` | 被引用 |
| `USERS`（用户表） | `LISTINGS`（挂牌主表） | 一对多（左一右多） | `publishes` | 发布 |
| `REGIONS`（地区字典表） | `LISTINGS`（挂牌主表） | 一对多（左一右多） | `located_in` | 所在地区 |
| `LISTINGS`（挂牌主表） | `LISTING_MEDIA`（挂牌媒体表） | 一对多（左一右多） | `has` | 拥有 |
| `FILES`（文件资源表） | `LISTING_MEDIA`（挂牌媒体表） | 一对多（左一右多） | `attached_as` | 挂载文件 |
| `LISTINGS`（挂牌主表） | `LISTING_AUDIT_LOGS`（挂牌审核日志表） | 一对多（左一右多） | `audited_by` | 审核记录 |
| `USERS`（用户表） | `LISTING_AUDIT_LOGS`（挂牌审核日志表） | 一对多（左一右多） | `reviews` | 审核 |
| `LISTINGS`（挂牌主表） | `LISTING_STATS`（挂牌统计表） | 一对一 | `aggregates` | 统计聚合 |
| `LISTINGS`（挂牌主表） | `LISTING_FAVORITES`（挂牌收藏表） | 一对多（左一右多） | `favored` | 被收藏 |
| `USERS`（用户表） | `LISTING_FAVORITES`（挂牌收藏表） | 一对多（左一右多） | `favorites` | 收藏 |
| `LISTINGS`（挂牌主表） | `ORDERS`（订单主表） | 一对多（左一右多） | `traded_as` | 形成交易 |
| `USERS`（用户表） | `ORDERS`（订单主表） | 一对多（左一右多） | `buys` | 购买 |
| `USERS`（用户表） | `ORDERS`（订单主表） | 一对多（左一右多） | `assigned_cs` | 分配客服 |
| `FILES`（文件资源表） | `ORDERS`（订单主表） | 一对多（左一右多） | `invoice_file` | 发票附件 |
| `ORDERS`（订单主表） | `PAYMENTS`（支付流水表） | 一对多（左一右多） | `paid_by` | 支付记录 |
| `ORDERS`（订单主表） | `REFUND_REQUESTS`（退款申请表） | 一对多（左一右多） | `requests` | 发起申请 |
| `ORDERS`（订单主表） | `CONTRACTS`（合同表） | 一对多（左一右多） | `signs` | 签署合同 |
| `ORDERS`（订单主表） | `SETTLEMENTS`（结算表） | 一对一 | `settles` | 结算 |
| `FILES`（文件资源表） | `CONTRACTS`（合同表） | 一对多（左一右多） | `contract_file` | 合同附件 |
| `FILES`（文件资源表） | `SETTLEMENTS`（结算表） | 一对多（左一右多） | `payout_evidence` | 放款凭证 |
| `ORDERS`（订单主表） | `CS_CASES`（客服工单表） | 一对多（左一右多） | `follows` | 跟进工单 |
| `USERS`（用户表） | `CS_CASES`（客服工单表） | 一对多（左一右多） | `handles` | 处理 |
| `CS_CASES`（客服工单表） | `CS_MILESTONES`（工单里程碑表） | 一对多（左一右多） | `includes` | 包含 |
| `CS_CASES`（客服工单表） | `CS_CASE_NOTES`（工单备注表） | 一对多（左一右多） | `notes` | 备注记录 |
| `CS_CASES`（客服工单表） | `CS_CASE_EVIDENCES`（工单凭证表） | 一对多（左一右多） | `evidences` | 凭证记录 |
| `USERS`（用户表） | `CS_CASE_NOTES`（工单备注表） | 一对多（左一右多） | `writes` | 撰写 |
| `FILES`（文件资源表） | `CS_CASE_EVIDENCES`（工单凭证表） | 一对多（左一右多） | `uploads` | 上传 |
| `ORDERS`（订单主表） | `CONVERSATIONS`（会话表） | 一对多（左一右多） | `discusses` | 关联会话 |
| `CONVERSATIONS`（会话表） | `CONVERSATION_PARTICIPANTS`（会话参与人表） | 一对多（左一右多） | `contains` | 包含 |
| `CONVERSATIONS`（会话表） | `CONVERSATION_MESSAGES`（会话消息表） | 一对多（左一右多） | `contains` | 包含 |
| `USERS`（用户表） | `CONVERSATION_PARTICIPANTS`（会话参与人表） | 一对多（左一右多） | `joins` | 参与 |
| `USERS`（用户表） | `CONVERSATION_MESSAGES`（会话消息表） | 一对多（左一右多） | `sends` | 发送 |
| `USERS`（用户表） | `NOTIFICATIONS`（通知表） | 一对多（左一右多） | `receives` | 接收 |
| `USERS`（用户表） | `IDEMPOTENCY_KEYS`（幂等键表） | 一对多（左一右多） | `uses` | 使用 |
| `USERS`（用户表） | `AUDIT_LOGS`（审计日志表） | 一对多（左一右多） | `acts` | 操作 |
| `PATENTS`（专利主表） | `PATENT_MAINTENANCE_SCHEDULES`（专利维保日程表） | 一对多（左一右多） | `maintains` | 维保计划 |
| `USERS`（用户表） | `PATENT_MAINTENANCE_SCHEDULES`（专利维保日程表） | 一对多（左一右多） | `owns` | 拥有 |
| `PATENT_MAINTENANCE_SCHEDULES`（专利维保日程表） | `PATENT_MAINTENANCE_TASKS`（专利维保任务表） | 一对多（左一右多） | `generates` | 生成任务 |
| `USERS`（用户表） | `PATENT_MAINTENANCE_TASKS`（专利维保任务表） | 一对多（左一右多） | `assigned_to` | 分配给 |
| `PATENT_MAINTENANCE_TASKS`（专利维保任务表） | `PATENT_MAINTENANCE_ORDERS`（专利维保订单表） | 一对多（左一右多） | `creates` | 生成订单 |
| `USERS`（用户表） | `PATENT_MAINTENANCE_ORDERS`（专利维保订单表） | 一对多（左一右多） | `purchases` | 下单购买 |

## 5. 重点链路讲解（甲方重点关注）

### 5.1 交易与资金闭环

1. `LISTINGS` 记录可交易标的及挂牌状态。
2. `ORDERS` 在挂牌基础上形成交易单，沉淀买卖双方、金额、发票信息。
3. `PAYMENTS` 记录支付流水，区分支付类型、渠道、状态与交易流水号。
4. `CONTRACTS` 记录合同文件与签署状态，作为交易履约依据。
5. `SETTLEMENTS` 记录佣金、放款金额、放款状态与凭证，完成资金闭环。

### 5.2 售后与客服闭环

1. `REFUND_REQUESTS` 记录退款申请与状态流转。
2. `CS_CASES` + `CS_MILESTONES` + `CS_CASE_NOTES` + `CS_CASE_EVIDENCES` 形成工单处理全链路留痕。
3. `CONVERSATIONS` + `CONVERSATION_PARTICIPANTS` + `CONVERSATION_MESSAGES` 记录沟通过程与责任边界。

### 5.3 合规与平台治理

1. `AUDIT_LOGS` 记录操作前后快照，可用于审计追溯。
2. `IDEMPOTENCY_KEYS` 防止重复提交，保障支付/下单等关键操作幂等。
3. `SYSTEM_CONFIGS` 管理可配置项，支撑线上策略调节。

## 6. 全量字段中文注释（按表）

> 说明：以下字段来自 `er-diagram-cn.mmd`，用于甲乙双方字段级对齐。

### 6.1 `USERS`（用户表）

| 字段名 | 类型 | 键属性 | 中文注释 |
|---|---|---|---|
| `id` | `uuid` | PK | ID |
| `phone` | `string` | - | 手机号 |
| `nickname` | `string` | - | 昵称 |
| `role` | `string` | - | 角色 |
| `region_code` | `string` | - | 地区编码 |
| `created_at` | `datetime` | - | 创建时间 |
| `updated_at` | `datetime` | - | 更新时间 |

### 6.2 `RBAC_ROLES`（权限角色表）

| 字段名 | 类型 | 键属性 | 中文注释 |
|---|---|---|---|
| `id` | `string` | PK | ID |
| `name` | `string` | - | 名称 |
| `description` | `string` | - | 说明 |
| `created_at` | `datetime` | - | 创建时间 |
| `updated_at` | `datetime` | - | 更新时间 |

### 6.3 `RBAC_USER_ROLES`（用户角色关联表）

| 字段名 | 类型 | 键属性 | 中文注释 |
|---|---|---|---|
| `user_id` | `uuid` | PK | 用户ID |
| `role_id` | `string` | PK | 角色ID |
| `created_at` | `datetime` | - | 创建时间 |

### 6.4 `USER_VERIFICATIONS`（用户认证表）

| 字段名 | 类型 | 键属性 | 中文注释 |
|---|---|---|---|
| `id` | `uuid` | PK | ID |
| `user_id` | `uuid` | FK | 用户ID |
| `type` | `string` | - | 类型 |
| `status` | `string` | - | 状态 |
| `display_name` | `string` | - | 展示名称 |
| `region_code` | `string` | - | 地区编码 |
| `submitted_at` | `datetime` | - | 提交时间 |
| `reviewed_at` | `datetime` | - | 审核时间 |
| `reviewed_by` | `uuid` | FK | 审核人用户ID |
| `created_at` | `datetime` | - | 创建时间 |
| `updated_at` | `datetime` | - | 更新时间 |

### 6.5 `REGIONS`（地区字典表）

| 字段名 | 类型 | 键属性 | 中文注释 |
|---|---|---|---|
| `code` | `string` | PK | 编码 |
| `name` | `string` | - | 名称 |
| `level` | `string` | - | 层级 |
| `parent_code` | `string` | - | 上级地区编码 |
| `updated_at` | `datetime` | - | 更新时间 |

### 6.6 `INDUSTRY_TAGS`（行业标签表）

| 字段名 | 类型 | 键属性 | 中文注释 |
|---|---|---|---|
| `id` | `uuid` | PK | ID |
| `name` | `string` | - | 名称 |
| `created_at` | `datetime` | - | 创建时间 |
| `updated_at` | `datetime` | - | 更新时间 |

### 6.7 `PATENTS`（专利主表）

| 字段名 | 类型 | 键属性 | 中文注释 |
|---|---|---|---|
| `id` | `uuid` | PK | ID |
| `application_no_norm` | `string` | - | 申请号（标准化） |
| `patent_type` | `string` | - | 专利类型 |
| `title` | `string` | - | 标题 |
| `legal_status` | `string` | - | 法律状态 |
| `source_primary` | `string` | - | 主数据来源 |
| `source_updated_at` | `datetime` | - | 来源更新时间 |
| `created_at` | `datetime` | - | 创建时间 |
| `updated_at` | `datetime` | - | 更新时间 |

### 6.8 `FILES`（文件资源表）

| 字段名 | 类型 | 键属性 | 中文注释 |
|---|---|---|---|
| `id` | `uuid` | PK | ID |
| `url` | `string` | - | 地址 |
| `mime_type` | `string` | - | 媒体类型 |
| `size_bytes` | `int` | - | 文件大小（字节） |
| `owner_id` | `uuid` | FK | 归属人ID |
| `created_at` | `datetime` | - | 创建时间 |

### 6.9 `LISTINGS`（挂牌主表）

| 字段名 | 类型 | 键属性 | 中文注释 |
|---|---|---|---|
| `id` | `uuid` | PK | ID |
| `seller_user_id` | `uuid` | FK | 卖方用户ID |
| `patent_id` | `uuid` | FK | 专利ID |
| `title` | `string` | - | 标题 |
| `trade_mode` | `string` | - | 交易模式 |
| `price_type` | `string` | - | 价格类型 |
| `price_amount` | `int` | - | 挂牌价格（分） |
| `deposit_amount` | `int` | - | 订金金额（分） |
| `region_code` | `string` | - | 地区编码 |
| `audit_status` | `string` | - | 审核状态 |
| `status` | `string` | - | 状态 |
| `created_at` | `datetime` | - | 创建时间 |
| `updated_at` | `datetime` | - | 更新时间 |

### 6.10 `LISTING_MEDIA`（挂牌媒体表）

| 字段名 | 类型 | 键属性 | 中文注释 |
|---|---|---|---|
| `id` | `uuid` | PK | ID |
| `listing_id` | `uuid` | FK | 挂牌ID |
| `file_id` | `uuid` | FK | 文件ID |
| `type` | `string` | - | 类型 |
| `sort` | `int` | - | 排序 |

### 6.11 `LISTING_AUDIT_LOGS`（挂牌审核日志表）

| 字段名 | 类型 | 键属性 | 中文注释 |
|---|---|---|---|
| `id` | `uuid` | PK | ID |
| `listing_id` | `uuid` | FK | 挂牌ID |
| `reviewer_id` | `uuid` | FK | 审核人用户ID |
| `action` | `string` | - | 动作 |
| `reason` | `string` | - | 原因 |
| `created_at` | `datetime` | - | 创建时间 |

### 6.12 `LISTING_FAVORITES`（挂牌收藏表）

| 字段名 | 类型 | 键属性 | 中文注释 |
|---|---|---|---|
| `id` | `uuid` | PK | ID |
| `listing_id` | `uuid` | FK | 挂牌ID |
| `user_id` | `uuid` | FK | 用户ID |
| `created_at` | `datetime` | - | 创建时间 |

### 6.13 `LISTING_STATS`（挂牌统计表）

| 字段名 | 类型 | 键属性 | 中文注释 |
|---|---|---|---|
| `listing_id` | `uuid` | PK | 挂牌ID |
| `view_count` | `int` | - | 浏览次数 |
| `favorite_count` | `int` | - | 收藏次数 |
| `consult_count` | `int` | - | 咨询次数 |
| `comment_count` | `int` | - | 评论次数 |
| `updated_at` | `datetime` | - | 更新时间 |

### 6.14 `ORDERS`（订单主表）

| 字段名 | 类型 | 键属性 | 中文注释 |
|---|---|---|---|
| `id` | `uuid` | PK | ID |
| `listing_id` | `uuid` | FK | 挂牌ID |
| `buyer_user_id` | `uuid` | FK | 买方用户ID |
| `assigned_cs_user_id` | `uuid` | FK | 分配客服用户ID |
| `status` | `string` | - | 状态 |
| `deposit_amount` | `int` | - | 订金金额（分） |
| `deal_amount` | `int` | - | 成交金额（分） |
| `final_amount` | `int` | - | 尾款金额（分） |
| `commission_amount` | `int` | - | 佣金金额（分） |
| `invoice_no` | `string` | - | 发票号 |
| `invoice_file_id` | `uuid` | FK | 发票文件ID |
| `invoice_issued_at` | `datetime` | - | 发票开具时间 |
| `created_at` | `datetime` | - | 创建时间 |
| `updated_at` | `datetime` | - | 更新时间 |

### 6.15 `PAYMENTS`（支付流水表）

| 字段名 | 类型 | 键属性 | 中文注释 |
|---|---|---|---|
| `id` | `uuid` | PK | ID |
| `order_id` | `uuid` | FK | 订单ID |
| `pay_type` | `string` | - | 支付类型 |
| `channel` | `string` | - | 渠道 |
| `amount` | `int` | - | 金额 |
| `status` | `string` | - | 状态 |
| `transaction_no` | `string` | - | 交易流水号 |
| `paid_at` | `datetime` | - | 支付完成时间 |
| `created_at` | `datetime` | - | 创建时间 |

### 6.16 `REFUND_REQUESTS`（退款申请表）

| 字段名 | 类型 | 键属性 | 中文注释 |
|---|---|---|---|
| `id` | `uuid` | PK | ID |
| `order_id` | `uuid` | FK | 订单ID |
| `reason_code` | `string` | - | 退款原因编码 |
| `reason_text` | `string` | - | 退款原因说明 |
| `status` | `string` | - | 状态 |
| `created_at` | `datetime` | - | 创建时间 |
| `updated_at` | `datetime` | - | 更新时间 |

### 6.17 `CONTRACTS`（合同表）

| 字段名 | 类型 | 键属性 | 中文注释 |
|---|---|---|---|
| `id` | `uuid` | PK | ID |
| `order_id` | `uuid` | FK | 订单ID |
| `buyer_user_id` | `uuid` | FK | 买方用户ID |
| `seller_user_id` | `uuid` | FK | 卖方用户ID |
| `status` | `string` | - | 状态 |
| `contract_file_id` | `uuid` | FK | 合同文件ID |
| `signed_at` | `datetime` | - | 签署时间 |
| `created_at` | `datetime` | - | 创建时间 |
| `updated_at` | `datetime` | - | 更新时间 |

### 6.18 `SETTLEMENTS`（结算表）

| 字段名 | 类型 | 键属性 | 中文注释 |
|---|---|---|---|
| `id` | `uuid` | PK | ID |
| `order_id` | `uuid` | FK | 订单ID |
| `gross_amount` | `int` | - | 结算毛额（分） |
| `commission_amount` | `int` | - | 佣金金额（分） |
| `payout_amount` | `int` | - | 放款金额（分） |
| `payout_status` | `string` | - | 放款状态 |
| `payout_ref` | `string` | - | 放款参考号 |
| `payout_evidence_file_id` | `uuid` | FK | 放款凭证文件ID |
| `payout_at` | `datetime` | - | 放款时间 |
| `created_at` | `datetime` | - | 创建时间 |
| `updated_at` | `datetime` | - | 更新时间 |

### 6.19 `CS_CASES`（客服工单表）

| 字段名 | 类型 | 键属性 | 中文注释 |
|---|---|---|---|
| `id` | `uuid` | PK | ID |
| `order_id` | `uuid` | FK | 订单ID |
| `cs_user_id` | `uuid` | FK | 客服用户ID |
| `type` | `string` | - | 类型 |
| `status` | `string` | - | 状态 |
| `priority` | `string` | - | 优先级 |
| `due_at` | `datetime` | - | 工单截止时间 |
| `created_at` | `datetime` | - | 创建时间 |
| `updated_at` | `datetime` | - | 更新时间 |

### 6.20 `CS_MILESTONES`（工单里程碑表）

| 字段名 | 类型 | 键属性 | 中文注释 |
|---|---|---|---|
| `id` | `uuid` | PK | ID |
| `case_id` | `uuid` | FK | 工单ID |
| `name` | `string` | - | 名称 |
| `status` | `string` | - | 状态 |
| `created_at` | `datetime` | - | 创建时间 |
| `updated_at` | `datetime` | - | 更新时间 |

### 6.21 `CS_CASE_NOTES`（工单备注表）

| 字段名 | 类型 | 键属性 | 中文注释 |
|---|---|---|---|
| `id` | `uuid` | PK | ID |
| `case_id` | `uuid` | FK | 工单ID |
| `author_user_id` | `uuid` | FK | 备注作者用户ID |
| `content` | `string` | - | 内容 |
| `created_at` | `datetime` | - | 创建时间 |

### 6.22 `CS_CASE_EVIDENCES`（工单凭证表）

| 字段名 | 类型 | 键属性 | 中文注释 |
|---|---|---|---|
| `id` | `uuid` | PK | ID |
| `case_id` | `uuid` | FK | 工单ID |
| `file_id` | `uuid` | FK | 文件ID |
| `note` | `string` | - | 备注 |
| `created_at` | `datetime` | - | 创建时间 |

### 6.23 `CONVERSATIONS`（会话表）

| 字段名 | 类型 | 键属性 | 中文注释 |
|---|---|---|---|
| `id` | `uuid` | PK | ID |
| `order_id` | `uuid` | FK | 订单ID |
| `channel` | `string` | - | 渠道 |
| `status` | `string` | - | 状态 |
| `created_at` | `datetime` | - | 创建时间 |
| `updated_at` | `datetime` | - | 更新时间 |

### 6.24 `CONVERSATION_PARTICIPANTS`（会话参与人表）

| 字段名 | 类型 | 键属性 | 中文注释 |
|---|---|---|---|
| `id` | `uuid` | PK | ID |
| `conversation_id` | `uuid` | FK | 会话ID |
| `user_id` | `uuid` | FK | 用户ID |
| `role` | `string` | - | 角色 |
| `joined_at` | `datetime` | - | 加入时间 |

### 6.25 `CONVERSATION_MESSAGES`（会话消息表）

| 字段名 | 类型 | 键属性 | 中文注释 |
|---|---|---|---|
| `id` | `uuid` | PK | ID |
| `conversation_id` | `uuid` | FK | 会话ID |
| `sender_user_id` | `uuid` | FK | 消息发送用户ID |
| `content_type` | `string` | - | 内容类型 |
| `content` | `string` | - | 内容 |
| `created_at` | `datetime` | - | 创建时间 |

### 6.26 `NOTIFICATIONS`（通知表）

| 字段名 | 类型 | 键属性 | 中文注释 |
|---|---|---|---|
| `id` | `uuid` | PK | ID |
| `user_id` | `uuid` | FK | 用户ID |
| `kind` | `string` | - | 类别 |
| `title` | `string` | - | 标题 |
| `summary` | `string` | - | 摘要 |
| `read_at` | `datetime` | - | 阅读时间 |
| `created_at` | `datetime` | - | 创建时间 |

### 6.27 `SYSTEM_CONFIGS`（系统配置表）

| 字段名 | 类型 | 键属性 | 中文注释 |
|---|---|---|---|
| `key` | `string` | PK | 键 |
| `scope` | `string` | PK | 作用域 |
| `value_type` | `string` | - | 配置值类型 |
| `value_json` | `string` | - | 配置值（JSON） |
| `updated_at` | `datetime` | - | 更新时间 |

### 6.28 `IDEMPOTENCY_KEYS`（幂等键表）

| 字段名 | 类型 | 键属性 | 中文注释 |
|---|---|---|---|
| `id` | `uuid` | PK | ID |
| `key` | `string` | - | 键 |
| `scope` | `string` | - | 作用域 |
| `user_id` | `uuid` | FK | 用户ID |
| `status` | `string` | - | 状态 |
| `created_at` | `datetime` | - | 创建时间 |
| `updated_at` | `datetime` | - | 更新时间 |

### 6.29 `AUDIT_LOGS`（审计日志表）

| 字段名 | 类型 | 键属性 | 中文注释 |
|---|---|---|---|
| `id` | `uuid` | PK | ID |
| `actor_user_id` | `uuid` | FK | 操作人用户ID |
| `action` | `string` | - | 动作 |
| `target_type` | `string` | - | 目标对象类型 |
| `target_id` | `string` | - | 目标对象ID |
| `before_json` | `string` | - | 变更前快照（JSON） |
| `after_json` | `string` | - | 变更后快照（JSON） |
| `created_at` | `datetime` | - | 创建时间 |

### 6.30 `PATENT_MAINTENANCE_SCHEDULES`（专利维保日程表）

| 字段名 | 类型 | 键属性 | 中文注释 |
|---|---|---|---|
| `id` | `uuid` | PK | ID |
| `patent_id` | `uuid` | FK | 专利ID |
| `owner_user_id` | `uuid` | FK | 维保归属用户ID |
| `status` | `string` | - | 状态 |
| `due_date` | `date` | - | 维保到期日期 |
| `created_at` | `datetime` | - | 创建时间 |
| `updated_at` | `datetime` | - | 更新时间 |

### 6.31 `PATENT_MAINTENANCE_TASKS`（专利维保任务表）

| 字段名 | 类型 | 键属性 | 中文注释 |
|---|---|---|---|
| `id` | `uuid` | PK | ID |
| `schedule_id` | `uuid` | FK | 维保日程ID |
| `status` | `string` | - | 状态 |
| `assignee_user_id` | `uuid` | FK | 执行人用户ID |
| `created_at` | `datetime` | - | 创建时间 |
| `updated_at` | `datetime` | - | 更新时间 |

### 6.32 `PATENT_MAINTENANCE_ORDERS`（专利维保订单表）

| 字段名 | 类型 | 键属性 | 中文注释 |
|---|---|---|---|
| `id` | `uuid` | PK | ID |
| `task_id` | `uuid` | FK | 维保任务ID |
| `buyer_user_id` | `uuid` | FK | 买方用户ID |
| `status` | `string` | - | 状态 |
| `amount` | `int` | - | 金额 |
| `payment_channel` | `string` | - | 支付渠道 |
| `created_at` | `datetime` | - | 创建时间 |
| `updated_at` | `datetime` | - | 更新时间 |

## 7. 评审讲解建议（可直接念）

1. 先指向图中央交易链路：`LISTINGS -> ORDERS -> PAYMENTS/CONTRACTS -> SETTLEMENTS`。
2. 再讲两条保障链：一条是“售后客服链”（退款、工单、会话），一条是“治理合规链”（幂等、审计、配置）。
3. 最后落到字段：重点确认金额、状态、时间、责任人四类字段在双方口径一致。

## 8. 对接注意事项

- 本文档用于讲解与对齐，不替代接口文档与 Prisma Schema 的精确约束。
- 如果后续有模型新增/字段变更，请同步更新 `er-diagram-cn.mmd` 并重新生成本文件。
