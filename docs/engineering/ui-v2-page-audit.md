# UI v2 页面审计与改造规划（Client + Admin）

> 目标：把“页面现状”映射到 `UI Spec v2` 的模板/状态/Token/文案规范上，输出可执行的改造清单（P0/P1/P2）。  
> 本文只做规划，不改代码。

## 0. 读法

每个页面给出：

- **模板**：对应 `docs/engineering/ui-v2-spec.md` 的模板 A–G
- **访问策略**：`public | login-required | approved-required`（页面级；动作级另行说明）
- **现状状态覆盖**：是否实现 `loading/empty/error/permission/audit`
- **差距**：与 v2 规范相比缺什么
- **任务**：拆成可验收的 P0/P1

## 1. 跨页面 P0 任务（所有页面共用）

> 这些是“体系级任务”，不做会导致全局不统一或隐性故障。

### UI-STD-P0-001 Token 去硬编码

- 范围：Client/Admin 所有页面与 UI 组件
- 规则：颜色/字号/间距/圆角/阴影/动效时长/z-index 禁止直接硬编码（除白名单）
- 验收：搜索全仓硬编码命中降到白名单范围内（并有登记）

### UI-STD-P0-002 用户可见文案去“P0/演示/Mock”

- 范围：Client/Admin 用户可见区域
- 规则：禁用词不得出现（见 `ui-v2-spec`）
- 验收：逐页巡检无禁用词；调试信息仅 dev-only 区域可见

### UI-STD-P0-003 页面状态机统一

- 范围：Client 全页面
- 内容：固化 `loading/empty/error/permission/audit` 的触发条件、优先级与 UI 结构
- 验收：任意页面切换场景都能稳定落在某个状态，不出现“橙色背景但无内容”等空态

### UI-STD-P0-004 请求参数清洗与错误归一化

- 范围：Client/Admin 的 `apiGet/apiPost/...`
- 目标：禁止出现 `q=undefined` 等请求；错误信息用户可读
- 验收：抓包/日志中 query/body 无 `undefined/null`；错误提示可解释且可重试

### UI-STD-P0-005 路由参数缺参兜底标准化

- 范围：所有 `?xxxId` 页面
- 规则：缺参统一 ErrorCard（或后台 Alert）+ 返回动作
- 验收：任意缺参深链访问可自恢复

### UI-STD-P0-006 DOM/Overlay 结构约束验收

- 背景：Taro H5 曾出现 overlay 影响 `.taro_page` 渲染（白屏/内容隐藏）
- 规则：新增弹层/portal 必须通过“路由 DOM 结构”验收用例

## 2. Client 页面清单（apps/client）

> 页面来源：`apps/client/src/app.config.ts` 的 pages 数组（共 31 个）。

### 2.1 页面总览表（模板 + 访问策略）

| 页面 | 模板 | 页面访问策略 | 动作访问策略（典型） | 现状要点 |
|---|---|---|---|---|
| `pages/home/index` | A Tab Landing | public | 收藏/咨询/下单：approved-required | 入口丰富；存在渐变硬编码；未使用 PageHeader 属合理但需模板化 |
| `pages/search/index` | A/B（Tab + 筛选列表） | public | 收藏/咨询：approved-required | 结构较完整；筛选 Popup 需统一交互与 token |
| `pages/publish/index` | A Tab Landing | login-required（页面级已做引导） | 发布：approved-required | 权限/审核分支已覆盖；文案含 P0/演示需清理 |
| `pages/messages/index` | A Tab Landing | login-required（页面级分支） | 进入会话：approved-required | 分支较完整；空态/引导文案需统一 |
| `pages/me/index` | A Tab Landing | public | 退出/调试：login-required（调试 dev-only） | 调试区已有开关；文案与按钮规范需统一 |
| `pages/feeds/index` | B List + Filter | public | 收藏/咨询：approved-required | 状态覆盖较完整；间距与文案需收敛 |
| `pages/favorites/index` | B List | approved-required（页面级） | 取消收藏：approved-required | 需核对 permission/audit 覆盖口径与空态引导 |
| `pages/orders/index` | B List | approved-required | 支付/退款：approved-required | 文案/时间/金额格式需统一；列表密度可优化 |
| `pages/my-listings/index` | B List | approved-required | 编辑/下架：approved-required | 标题/状态标签规范化；空态引导需统一 |
| `pages/inventors/index` | B List + Search | public | N/A | **存在 `q=undefined` 风险**（需参数清洗）；空态/加载已实现 |
| `pages/organizations/index` | B List + Search | public | N/A | **存在 `q=undefined` 风险**；列表卡片信息密度需标准化 |
| `pages/patent-map/index` | B List（地图入口） | public | 进入 region：public | 年份/区域列表 OK；“暂无数据”文案含 P0 需清理 |
| `pages/patent-map/region-detail/index` | C Detail | public | N/A | 需统一“返回/筛选年”规则与错误态 |
| `pages/listing/detail/index` | C Detail + Sticky CTA | public | 收藏/咨询/订金：approved-required | 缺 PageHeader（可接受但需模板标准）；吸底按钮需统一主次 |
| `pages/patent/detail/index` | C Detail | public | N/A | 状态覆盖完整；文案与信息层级需统一 |
| `pages/organizations/detail/index` | C Detail | public | N/A | PageHeader 副标题含 P0；信息布局需标准化 |
| `pages/orders/detail/index` | C Detail | approved-required | 操作：approved-required | 状态覆盖较全；时间/金额/步骤展示需标准化 |
| `pages/profile/edit/index` | D Form | login-required（建议） | 保存：login-required | 表单校验/错误展示需规范化 |
| `pages/onboarding/choose-identity/index` | D Wizard | login-required | 提交资料：login-required | 视觉渐变硬编码；步骤说明与文案需 v2 统一 |
| `pages/onboarding/verification-form/index` | D Wizard Form | login-required | 提交：login-required | 表单分段/校验/上传规范需固化 |
| `pages/region-picker/index` | D Utility Picker | public（建议 login 也可） | 选择后回填：N/A | 需要统一“选择器”模板与搜索体验 |
| `pages/login/index` | D Auth | public | 登录：public | 文案含 P0/Mock；成功后跳转策略需规范化 |
| `pages/publish/patent/index` | D Form + Sticky | approved-required | 保存/提交：approved-required | 已较完整；硬编码样式/文案含 P0；上传/校验标准化 |
| `pages/publish/demand/index` | D（占位） | approved-required | N/A | 需要补齐页面状态机与表单契约 |
| `pages/publish/achievement/index` | D（占位） | approved-required | N/A | 同上 |
| `pages/checkout/deposit-pay/index` | E Payment | approved-required | 支付：approved-required | 建议加统一 PageHeader/说明模板；H5 支付策略定义 |
| `pages/checkout/deposit-success/index` | E Payment Result | approved-required | 继续：approved-required | 需要统一“成功页”模板与下一步 CTA |
| `pages/checkout/final-pay/index` | E Payment | approved-required | 支付：approved-required | 缺 PageHeader；说明文案与 CTA 需统一 |
| `pages/checkout/final-success/index` | E Payment Result | approved-required | 查看订单：approved-required | 成功页模板统一 |
| `pages/trade-rules/index` | G Policy | public | N/A | 结构 OK；文案/排版需“可扫读”强化 |
| `pages/messages/chat/index` | F Chat | approved-required（页面级） | 发送消息：approved-required | 模板较完整；时间展示/滚动体验需标准化 |

### 2.2 按页面拆解任务（P0 优先）

> 说明：下面每页只列“本页独有/差异化”的任务；体系级任务见第 1 节。

#### Home（`pages/home/index`）

- P0：将入口卡片渐变纳入“语义 token/渐变 token 白名单”（避免散落硬编码）
- P0：定义 Home 模板的“品牌区高度、Logo 使用、入口网格密度”固定规则（避免后续改版发散）
- P1：桌面 H5（≥768px）按“居中手机宽度”展示（锁定字号/内容区居中/吸底对齐）；双列作为 P2 可选

#### Inventors（`pages/inventors/index`）

- P0：请求参数清洗（禁止出现 `q=undefined`）
- P0：搜索交互标准化：清空、提交、回车、loading 触发时机一致

#### Organizations（`pages/organizations/index`）

- P0：请求参数清洗（禁止出现 `q=undefined`）
- P1：列表卡片信息密度规范化（头像/标签/摘要行数）

#### Listing Detail（`pages/listing/detail/index`）

- P0：详情模板固化：首屏信息层级（标题/类型/价格/订金/卖家/热度）与吸底 CTA 主次规则
- P1：关键字段格式化统一（金额/时间/枚举 label）

#### Publish Patent（`pages/publish/patent/index`）

- P0：去除用户可见的 “P0/演示” 文案；保留在 dev-only 说明中（如需要）
- P0：上传/删除/提交确认统一交互（confirm 文案模板 + 失败兜底）
- P1：长表单的“自动保存草稿/恢复”策略（避免误操作丢失）

#### Checkout（`pages/checkout/*`）

- P0：支付页模板统一：PageHeader + 金额摘要 + 规则说明 + 吸底 CTA
- P1：H5/桌面支付策略：二维码/跳转小程序的产品方案与 UI（避免“只能展示一段说明”）

#### Publish Demand / Achievement（占位页）

- P0：补齐页面模板与状态机（至少 loading/empty/error/permission/audit 的合理表现）
- P1：定义表单字段与校验（与 OpenAPI 对齐后再落地）

## 3. Admin 页面审计（apps/admin-web）

### 3.1 页面总览

| 路由 | 类型 | 访问策略 | 现状要点 |
|---|---|---|---|
| `/login` | Auth | public | 需要统一登录错误提示与跳转回原页策略 |
| `/` Dashboard | Dashboard | login-required（后台） | 文案含“演示”；统计卡片 OK；错误汇总需标准化 |
| `/verifications` | Table + Drawer/Modal | login-required | 需要统一“通过/驳回”二次确认与审计提示 |
| `/listings` | Table + Modal | login-required | 已有 confirmAction/RequestState；文案含演示；字段格式化需统一 |
| `/orders` | Table | login-required | 需统一筛选区/表格密度/导出能力（P1） |
| `/refunds` | Table | login-required | 需明确风控提示/不可逆操作二次确认（P0） |
| `/settlements` | Table | login-required | 同上；并强化审计留痕入口（P0） |
| `/invoices` | Table | login-required | 需定义发票下载/上传状态与错误提示（P1） |
| `/config` | Form | login-required | 配置变更必须二次确认 + 变更摘要（P0） |
| `/regions` | CRUD | login-required | 需定义标签/地区的命名规则与冲突校验（P1） |
| `/patent-map` | CMS | login-required | 需定义数据录入校验与发布预览（P1） |

### 3.2 Admin 跨页面 P0

- ADM-P0-001：危险操作统一二次确认（含原因输入/审计提示）
- ADM-P0-002：错误提示统一（RequestErrorAlert 规范化：用户可读 + 可重试 + debug 可展开）
- ADM-P0-003：文案去“演示/Mock”（只留 dev-only）

## 4. 建议交付顺序（只做规划）

1. 先做体系级 P0（UI-STD-P0-001~006），否则逐页改造会反复返工
2. 再按模板推进（先 B 列表、再 C 详情、再 D 表单、最后 E 支付与 F 聊天）
3. 最后做 P1（缓存/响应式/格式化/可访问性）
