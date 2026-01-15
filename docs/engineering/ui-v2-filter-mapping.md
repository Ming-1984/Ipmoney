# UI v2 筛选/排序参数对齐表（OpenAPI ↔ UI）

> 目的：把“页面上的筛选/排序/分类控件”与 `docs/api/openapi.yaml` 的 query 参数 **逐项对齐**，避免 UI 做了但接口不支持、或接口支持但 UI 不可用。
>
> 约定：
> - **P0**：本轮整改必须落地（对外可用）
> - **P1**：增强项（不阻塞 P0，但需在 TODO 中登记）
> - 金额输入：UI 用“元”，请求用“分（`MoneyFen`）”
> - 多选数组参数：按 OpenAPI `style=form` + `explode=true` 序列化（例如 `industryTags=a&industryTags=b`）
> - 组件形态说明：本表里的“组件形态”优先使用 v2 规范中的 `CategoryControl / SortControl / SortSheet / FilterSheet`（底层可用 NutUI Tabs/Popup/Chip 等实现），以对齐微信小程序观感与交互一致性

## 1. Search 主链路（`pages/search/index`）

### 1.1 专利交易（`GET /search/listings`）

| UI 字段 | 组件形态（推荐） | OpenAPI query | 类型 | 优先级 | 备注 |
|---|---|---|---|---|---|
| 关键词 | SearchEntry | `q` | `string` | P0 | 标题/号/发明人等综合检索（以实现为准） |
| 排序 | SortControl（Tabs line；SortSheet P1） | `sortBy` | `SortBy` | P0 | Tabs：`RECOMMENDED/NEWEST/POPULAR`；更多（SortSheet｜P1）：`PRICE_ASC/PRICE_DESC`；不提供 `INVENTOR_RANK` |
| 专利类型 | Chip（单选） | `patentType` | `PatentType` | P0 | `INVENTION/UTILITY_MODEL/DESIGN` |
| 交易方式 | Chip（单选） | `tradeMode` | `TradeMode` | P0 | `ASSIGNMENT/LICENSE` |
| 价格类型 | Chip（单选） | `priceType` | `PriceType` | P0 | `FIXED/NEGOTIABLE` |
| 价格区间（元） | RangeInput | `priceMinFen`/`priceMaxFen` | `MoneyFen` | P0 | UI 输入元 → 转分；校验 `min<=max` |
| 订金区间（元） | RangeInput | `depositMinFen`/`depositMaxFen` | `MoneyFen` | P0 | 与价格区间同校验规则 |
| 地区 | CellRow → `pages/region-picker/index` | `regionCode` | `string(6)` | P0 | adcode（6 位） |
| 产业标签（多选） | Chip（多选） | `industryTags[]` | `string[]` | P0 | 数据源：`GET /public/industry-tags`（选择 name 并作为 query 传入） |
| IPC | Input | `ipc` | `string` | P0 | 前缀匹配（如 `H04L`） |
| LOC | Input | `loc` | `string` | P0 | 如 `14-02` |
| 法律状态 | Chip（单选） | `legalStatus` | `LegalStatus` | P0 | `PENDING/GRANTED/EXPIRED/INVALIDATED/UNKNOWN` |

### 1.2 产学研需求（`GET /search/demands`）

| UI 字段 | 组件形态（推荐） | OpenAPI query | 类型 | 优先级 | 备注 |
|---|---|---|---|---|---|
| 关键词 | SearchEntry | `q` | `string` | P0 | 标题/简介等 |
| 排序 | SortControl（Tabs line） | `sortBy` | `ContentSortBy` | P0 | `RECOMMENDED/NEWEST/POPULAR` |
| 地区 | CellRow → `pages/region-picker/index` | `regionCode` | `string(6)` | P0 |  |
| 合作方式（多选） | Chip（多选） | `cooperationModes[]` | `CooperationMode[]` | P0 | `TRANSFER/LICENSE/EQUITY/JOINT_DEV/COMMISSIONED_DEV/OTHER` |
| 预算类型 | Chip（单选） | `budgetType` | `PriceType` | P0 | `FIXED/NEGOTIABLE` |
| 预算区间（元） | RangeInput | `budgetMinFen`/`budgetMaxFen` | `MoneyFen` | P0 | `budgetType=NEGOTIABLE` 时区间可隐藏或禁用 |
| 产业标签（多选） | Chip（多选） | `industryTags[]` | `string[]` | P0 | 数据源同“专利交易” |

### 1.3 成果展示（`GET /search/achievements`）

| UI 字段 | 组件形态（推荐） | OpenAPI query | 类型 | 优先级 | 备注 |
|---|---|---|---|---|---|
| 关键词 | SearchEntry | `q` | `string` | P0 | 标题/简介等 |
| 排序 | SortControl（Tabs line） | `sortBy` | `ContentSortBy` | P0 | `RECOMMENDED/NEWEST/POPULAR` |
| 地区 | CellRow → `pages/region-picker/index` | `regionCode` | `string(6)` | P0 |  |
| 合作方式（多选） | Chip（多选） | `cooperationModes[]` | `CooperationMode[]` | P0 | 同需求 |
| 成熟度 | Chip（单选） | `maturity` | `AchievementMaturity` | P0 | `CONCEPT/PROTOTYPE/PILOT/MASS_PRODUCTION/COMMERCIALIZED/OTHER` |
| 产业标签（多选） | Chip（多选） | `industryTags[]` | `string[]` | P0 | 数据源同“专利交易” |

### 1.4 机构（`GET /public/organizations`）

| UI 字段 | 组件形态（推荐） | OpenAPI query | 类型 | 优先级 | 备注 |
|---|---|---|---|---|---|
| 关键词 | SearchEntry | `q` | `string` | P0 |  |
| 机构类型（多选） | Chip（多选） | `types[]` | `VerificationType[]` | P0 | 注意 query 参数名为 `types`（不是 `organizationTypes`） |
| 地区 | CellRow → `pages/region-picker/index` | `regionCode` | `string(6)` | P0 |  |

## 2. 榜单/展示类列表页（非 Search Tab）

### 2.1 发明人榜（`pages/inventors/index` → `GET /search/inventors`）

| UI 字段 | 组件形态（推荐） | OpenAPI query | 类型 | 优先级 | 备注 |
|---|---|---|---|---|---|
| 关键词 | SearchEntry | `q` | `string` | P0 |  |
| 地区 | FilterSheet（CellRow） | `regionCode` | `string(6)` | P0 |  |
| 专利类型 | FilterSheet（Chip） | `patentType` | `PatentType` | P0 |  |

### 2.2 机构展示（`pages/organizations/index` → `GET /public/organizations`）

> 与 Search-机构一致；本页的筛选/排序控件应复用同一套 FilterSheet/Chip/CellRow 规范（见 `docs/engineering/ui-v2-spec.md` 的 4.8）。

## 3. “我的”类列表（卖家/发布方）

### 3.1 我的专利上架（`pages/my-listings/index` → `GET /listings`）

| UI 字段 | 组件形态（推荐） | OpenAPI query | 类型 | 优先级 | 备注 |
|---|---|---|---|---|---|
| 状态 | CategoryControl（Tabs line） | `status` | `ListingStatus` | P0 | `DRAFT/ACTIVE/OFF_SHELF/SOLD` |
| 审核状态 | FilterSheet（Chip） | `auditStatus` | `AuditStatus` | P0 | `PENDING/APPROVED/REJECTED` |

### 3.2 我的需求（`pages/my-demands/index` → `GET /demands`）

| UI 字段 | 组件形态（推荐） | OpenAPI query | 类型 | 优先级 | 备注 |
|---|---|---|---|---|---|
| 状态 | CategoryControl（Tabs line） | `status` | `ContentStatus` | P0 | `DRAFT/ACTIVE/OFF_SHELF` |
| 审核状态 | FilterSheet（Chip） | `auditStatus` | `AuditStatus` | P0 | `PENDING/APPROVED/REJECTED` |

### 3.3 我的成果（`pages/my-achievements/index` → `GET /achievements`）

| UI 字段 | 组件形态（推荐） | OpenAPI query | 类型 | 优先级 | 备注 |
|---|---|---|---|---|---|
| 状态 | CategoryControl（Tabs line） | `status` | `ContentStatus` | P0 | `DRAFT/ACTIVE/OFF_SHELF` |
| 审核状态 | FilterSheet（Chip） | `auditStatus` | `AuditStatus` | P0 | `PENDING/APPROVED/REJECTED` |

## 4. 订单列表（`pages/orders/index` → `GET /orders`）

| UI 字段 | 组件形态（推荐） | OpenAPI query | 类型 | 优先级 | 备注 |
|---|---|---|---|---|---|
| 身份视角 | CategoryControl（Segmented） | `asRole` | `OrderListRole` | P0 | `BUYER/SELLER`（必填） |
| 订单状态 | FilterSheet（Chip） | `status` | `OrderStatus` | P0 | 可按“进行中/已完成/退款”等分组展示 |

## 5. Admin 表格页筛选（`apps/admin-web`）

> 原则：表格筛选/排序统一用 Ant Design（`Table`/`Select`/`Form`），不自研复杂筛选 UI。

### 5.1 内容审核列表

- 专利上架审核（`GET /admin/listings`）：`auditStatus` + `status`（已支持）
- 需求审核（`GET /admin/demands`）：`auditStatus` + `status`（已支持）
- 成果审核（`GET /admin/achievements`）：`auditStatus` + `status`（已支持）

### 5.2 关键词/地区等筛选（本轮需要）

内容审核列表在后台需要支持“关键词/地区”等筛选（对齐用户侧筛选体验）。本轮改动包括：

- OpenAPI：为审核列表补齐 query（至少 `q/regionCode`），并更新 `packages/api-types/index.d.ts`
- Admin UI：统一筛选区（Input/Search + Select/Chip），避免各页自定义样式
- fixtures：补齐典型筛选场景（至少 happy/empty 两类）
