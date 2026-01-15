# UI v2 逐页对照表（落实到页面｜只做规划）

> 对照目标：`docs/engineering/ui-v2-spec.md`  
> 说明：本文件是“逐页任务拆解 + 验收口径”，不做任何代码改动。
>
> 补充：筛选/排序/分类的参数对齐表见 `docs/engineering/ui-v2-filter-mapping.md`（OpenAPI ↔ UI 逐项对齐）。

## 0. 先修的硬风险（P0，影响全局体验）

### RISK-P0-01：权限校验导致页面“卡在 Loading”

现状模式（多页存在）：

- `load()` 内第一行 `if (!ensureApproved()) return;`
- 页面初始 `loading=true`
- 结果：未审核通过时页面停留在 LoadingCard（用户感知为“空白/卡死”）

涉及页面（按当前实现快速扫描）：

- `apps/client/src/pages/favorites/index.tsx`
- `apps/client/src/pages/orders/index.tsx`
- `apps/client/src/pages/orders/detail/index.tsx`
- `apps/client/src/pages/my-listings/index.tsx`

v2 规范要求：

- 页面级 `approved-required` 必须显式渲染 `Permission/Audit` 状态（而不是在请求前 return）
- loading/error/empty 只能用于“数据状态”，不能承担“权限状态”

验收：

- 未登录/未选择身份/审核未通过时，上述页面不出现 LoadingCard 卡死；有明确的下一步按钮

### RISK-P0-02：GET 参数污染（`q=undefined`）

现状：

- 部分页面把 `undefined` 作为 data 传入 GET，请求会变成 `q=undefined`

涉及页面（已复现）：

- `apps/client/src/pages/inventors/index.tsx`
- `apps/client/src/pages/organizations/index.tsx`

v2 规范要求：

- 参数清洗：禁止 `undefined/null/''` 进入 query（除非字段明确允许）

验收：

- 抓包中不再出现 `q=undefined`

## 1. Client（apps/client）逐页任务拆解

> 页面路径：`apps/client/src/pages/**/index.tsx`  
> 模板定义：见 `docs/engineering/ui-v2-spec.md`

### 1.1 Tab 页

#### Home（`pages/home/index`）

- 模板：A（Tab Landing）
- 页面策略：public；动作（收藏/咨询/下单）= approved-required
- P0（必须）
  - 入口卡片渐变统一为“渐变 token”（禁止散落硬编码渐变）
  - Home 顶部品牌区（Logo/标语/高度/留白）固化为模板规则，避免后续页面随意改
  - 列表区域的 Loading/Error/Empty 统一用 v2 状态机口径（文案与按钮位置一致）
- P1（建议）
  - ≥768px 桌面宽度：按“居中手机宽度”展示（锁定字号/内容区居中/吸底对齐）；双列作为 P2 可选

#### Search（`pages/search/index`）

- 模板：A + B（Tab + Filter List）
- 页面策略：public；动作（收藏/咨询）= approved-required
- P0（必须）
  - 筛选 Popup：统一“打开/关闭/重置/应用”的交互与按钮顺序（与 v2 模板一致）
  - Chip 组件：选中态/禁用态/密度统一（避免筛选区后续扩展发散）
  - 文案与字段 label 全部走统一术语（收藏/咨询/价格类型等）
- P1（建议）
  - 搜索请求并发控制：筛选快速切换时丢弃过期请求结果（避免“回跳旧结果”）

#### Publish（`pages/publish/index`）

- 模板：A（Tab Landing）
- 页面策略：login-required；发布动作 = approved-required
- P0（必须）
  - 去除用户可见“P0/演示”文案（仅 dev-only 可见）
  - 权限分支（未登录/未选身份/未审核）统一使用 v2 的 Permission/Audit 组件规范（标题、说明、按钮文案）
- P1（建议）
  - 发布入口卡片：为 Demand/Achievement 补齐“占位状态”规范（见对应页面）

  - PullToRefresh (NutUI) for conversation list; keep manual refresh button for desktop/H5
#### Messages（`pages/messages/index`）

- 模板：A（Tab Landing + 会话列表）
- 页面策略：login-required；进入会话 = approved-required
- P0（必须）
  - 空态文案去“演示”字样；空态必须给“怎么产生会话”的可行动引导（去详情页咨询/去搜索）
  - 会话列表 cell 的密度/头像/时间展示统一（配合时间格式化）
  - 会话列表优先用 NutUI 现成组件收口：`Avatar` + `Badge` + `Tag` + `Cell`（更像微信，减少自绘样式）
- P1（建议）
  - 刷新策略：下拉刷新/进入页面自动刷新节流（避免频繁请求）

#### Me（`pages/me/index`）

- 模板：A（Tab Landing）
- 页面策略：public；资料/退出/调试 = login-required
- P0（必须）
  - 调试区（Mock 场景）必须严格 dev-only（已有开关，但需规范：UI 不与正式区混排，且文案不影响演示观感）
  - 资料卡片的布局（昵称/手机号/认证 tag）统一 token 与间距（减少 inline style）
- P1（建议）
  - “认证状态”展示标准化：APPROVED/PENDING/REJECTED 的解释文案与下一步动作一致

### 1.2 非 Tab：列表与详情

#### Inventors（`pages/inventors/index`）

- 模板：B（List + Search）
- 页面策略：public
- P0（必须）
  - 修复 GET 参数污染：禁止出现 `q=undefined`（参数清洗）
  - SearchEntry 的“清空/提交/回车”行为与 Search 页一致
- P1（建议）
  - Top3/排名标签：统一 Tag 视觉与语义（TOP/排名口径）

#### Organizations（`pages/organizations/index`）

- 模板：B（List + Search）
- 页面策略：public
- P0（必须）
  - 修复 GET 参数污染：禁止出现 `q=undefined`
  - 列表卡片信息层级统一（名称/类型 tag/地区/统计/简介行数）
- P1（建议）
  - 支持“筛选：地区/类型/热门”等（与 Search 的筛选体系复用）

#### Patent Map（`pages/patent-map/index`）

- 模板：B（List）
- 页面策略：public
- P0（必须）
  - “暂无数据”文案去 P0 字样；空态必须给下一步动作（刷新/联系后台维护）
  - 年份 Segmented：选中态/滚动策略与其它 Segmented 一致
- P1（建议）
  - 地图层级（省/市）与筛选策略（后续扩展的模板预留）

#### Patent Map Region Detail（`pages/patent-map/region-detail/index`）

- 模板：C（Detail）
- 页面策略：public
- P0（必须）
  - 顶部信息区收口：用 NutUI `Tag`/`Space` 展示 年份/专利数/更新时间（避免 MetaPills 与自绘 tag 混排）
  - 详情分块（产业分布/重点单位）统一 list-item 视觉与空态文案（“（暂无）”统一为 v2 空态样式）
- P1（建议）
  - 增加“返回/切换年份”一致的顶部操作区（避免用户迷路）

#### Organization Detail（`pages/organizations/detail/index`）

- 模板：C（Detail）
- 页面策略：public
- P0（必须）
  - PageHeader 副标题去 P0 字样；说明文案缩短并可扫读
  - 详情信息布局统一：头像/名称/标签/统计信息的对齐与断行规则
  - 顶部信息区收口：用 NutUI `Avatar` + `Tag` + `Space` 展示 机构类型/地区/上架数/专利数（避免 MetaPills 与自绘 tag 混排）
- P1（建议）
  - 增加“联系/咨询”入口（如果产品需要），并统一权限策略

#### Listing Detail（`pages/listing/detail/index`）

- 模板：C（Detail + Sticky CTA）
- 页面策略：public；动作（收藏/咨询/订金）= approved-required
- P0（必须）
  - 详情首屏信息层级固化：标题/类型/价格/订金/卖家/热度的展示顺序与密度
  - 首屏「分类/标签」区分层级：关键标签（类型/交易/价格类型/特色）+ 次要标签（地区/行业）；用 NutUI `Tag`/`Space` 收口，避免 MetaPills 堆满一屏
  - 卖家信息用 NutUI `Avatar` + `Tag`（认证类型），热度（浏览/收藏/咨询）也用 `Tag` 统一（避免首屏 MetaPills/自绘混用）
  - StickyBar：三按钮主次规则统一（最多 1 个 primary；其余 ghost）
  - 缺参兜底已存在，但文案需统一术语（参数缺失 → 返回）
- P1（建议）
  - 价格/订金/统计/时间统一格式化（金额两位小数、时间可读）

#### Demand Detail (`pages/demand/detail/index`)

- Template: C (Detail + Sticky CTA)
- Page policy: public; actions (favorite/consult) = approved-required
- P0 (must)
  - Detail hero: cover/title/meta density aligned with Listing Detail
  - ?????coverUrl ??/??????????? IMAGE ????????????
  - 顶部信息区用成熟组件收口：NutUI `Tag`/`Space`（预算/合作方式/行业/地区/发布时间/热度）；发布方用 `Avatar` + 认证类型 label
  - Meta formatting: createdAt uses formatTimeSmart; region/time/stats are scannable
  - Media section: reuse shared MediaSection (IMAGE/VIDEO/FILE) with preview + copy link
  - VIDEO 兜底：播放失败不应白屏/抛异常；增加 `onError` toast + 复制链接；fixtures 里的视频 URL 不用 `example.com`（可改为可播放示例，如 MDN `cc0-videos/flower.mp4`）
  - Reduce inline styles: prefer shared components (Surface/SectionHeader/Spacer)
- P1 (suggest)
  - Long text UX: expand/collapse for description when too long

#### Achievement Detail (`pages/achievement/detail/index`)

- Template: C (Detail + Sticky CTA)
- Page policy: public; actions (favorite/consult) = approved-required
- P0 (must)
  - Detail hero: cover/title/meta density aligned with Listing Detail
  - ?????coverUrl ??/??????????? IMAGE ????????????
  - 顶部信息区用成熟组件收口：NutUI `Tag`/`Space`（成熟度/合作方式/行业/地区/发布时间/热度）；发布方用 `Avatar` + 认证类型 label
  - Meta formatting: createdAt uses formatTimeSmart; region/time/stats are scannable
  - Media section: reuse shared MediaSection (IMAGE/VIDEO/FILE) with preview + copy link
  - VIDEO 兜底：播放失败不应白屏/抛异常；增加 `onError` toast + 复制链接；fixtures 里的视频 URL 不用 `example.com`（可改为可播放示例，如 MDN `cc0-videos/flower.mp4`）
  - Reduce inline styles: prefer shared components (Surface/SectionHeader/Spacer)
- P1 (suggest)
  - Add share entry if product needs it

#### Patent Detail（`pages/patent/detail/index`）

- Template: C (Detail)
- Page policy: public
- P0 (must)
  - Map legalStatus to readable label + tone (avoid showing UNKNOWN/raw enum)
  - Key info uses consistent blocks (MetaPills/SectionHeader) and avoids redundant separators
  - Dates are formatted consistently (no raw ISO)
  - 顶部信息区收口：用 NutUI `Tag`/`Space` 展示 类型/法律状态/申请号，并提供“复制申请号”动作（避免信息散落）
- P1 (suggest)
  - Add quick actions (copy applicationNo, share) if product needs

#### Trade Rules（`pages/trade-rules/index`）

- 模板：G（Policy）
- 页面策略：public
- P0（必须）
  - PageHeader 副标题去 P0 字样
  - 规则页必须“可扫读”：分节标题 + 要点列表 + 关键数字强调（避免长段落）
  - 关键数字/参数展示用 NutUI `Tag`/`Space` 收口（避免 MetaPills 与自绘 tag 混排）
- P1（建议）
  - 增加“示例/FAQ”折叠区（减少误解与客服成本）

### 1.3 需要审核的“我的”类页面（重点修复 Loading 卡死）

#### Favorites（`pages/favorites/index`）

- 模板：B（List）
- 页面策略：approved-required（页面级）
- P0（必须）
  - 修复 RISK-P0-01：未通过审核时不能卡 Loading，必须显示 Audit/Permission 状态并给跳转
  - 空态引导：无收藏时给“去搜索”入口（不只刷新）
- P1（建议）
  - 支持分页与批量操作（如需要）

#### Orders（`pages/orders/index`）

- 模板：B（List）
- 页面策略：approved-required（页面级）
- P0（必须）
  - 修复 RISK-P0-01：审核未通过时不能卡 Loading
  - 订单状态（status）必须有用户可读映射（不直接展示枚举值）
  - PageHeader 副标题去 P0 字样
- P1（建议）
  - 筛选与分页：按状态筛选、分页加载、下拉刷新

#### Order Detail（`pages/orders/detail/index`）

- 模板：C（Detail + 操作）
- 页面策略：approved-required（页面级）
- P0（必须）
  - 修复 RISK-P0-01：审核未通过时不能卡 Loading
  - 退款 Popup：原因选择/输入框/确认按钮规范化（文案模板 + 危险操作提示）
  - 发票/退款/跟单多个子请求：错误态需统一（不能静默失败导致用户误判）
- P1（建议）
  - 时间/金额/步骤节点展示统一（与支付成功页 Steps 口径对齐）

#### My Listings（`pages/my-listings/index`）

- 模板：B（List）
- 页面策略：approved-required（页面级）
- P0（必须）
  - 修复 RISK-P0-01：审核未通过时不能卡 Loading
  - 状态标签（上架/下架/成交 + 审核状态）颜色语义统一（success/warn/danger）
  - PageHeader 副标题去 P0 字样
- P1（建议）
  - 支持“编辑草稿/复制发布/下架原因提示”等（产品确认后）

### 1.4 发布与表单

#### Publish Patent（`pages/publish/patent/index`）

- 模板：D（Form + Sticky）
- 页面策略：approved-required（页面级）
- P0（必须）
  - 页面级权限：即使从深链进入，也必须先显示 Permission/Audit 状态（而不是只在提交时失败）
  - 文案去 P0/演示；表单说明改为用户可读的“为什么要填/怎么填”
  - 上传列表：文件项展示、删除确认、失败重试统一规范（并且不暴露内部 id）
- P1（建议）
  - 长表单防丢：自动保存草稿 + 离开提示（产品确认后）

#### Publish Demand（`pages/publish/demand/index`）

- 模板：D（Form 简版，占位）
- 页面策略：approved-required（页面级）
- P0（必须）
  - 页面级权限：未通过审核时不要让用户填写到一半才失败
  - 补齐状态机：loading/empty/error/permission/audit（哪怕当前无后端接口，也要有占位规则）
- P1（建议）
  - 字段/校验/提交结果页：与 OpenAPI/PRD 对齐后补全

#### Publish Achievement（`pages/publish/achievement/index`）

- 同 Publish Demand（同级占位页）

#### Profile Edit（`pages/profile/edit/index`）

- 模板：D（Form）
- 页面策略：login-required（页面级）
- P0（必须）
  - 页面级权限：未登录时用 PermissionCard（而不是仅 navigateTo 跳走）以保证一致性
  - PageHeader 副标题去 P0 字样
  - 地区选择器回填：交互与 RegionPicker 模板一致
- P1（建议）
  - 输入校验（昵称长度、地区码格式）与错误展示统一（优先 inline）

#### Region Picker（`pages/region-picker/index`）

- 模板：D（Utility Picker）
- 页面策略：public
- P0（必须）
  - PageHeader 副标题去 P0 字样
  - SearchEntry “actionText=清空” 的语义与交互统一（避免误解为“搜索”）
- P1（建议）
  - 支持层级选择（省→市→区）与返回值结构（产品确认）

### 1.5 登录与引导

#### Login（`pages/login/index`）

- 模板：D（Auth）
- 页面策略：public
- P0（必须）
  - 去除用户可见的 P0/Mock/演示文案；保留 dev-only 说明
  - 登录方式文案统一（小程序 vs H5）且不暴露实现细节（code→token 等）
  - 成功后跳转策略标准化：优先回到来源页，否则去 Home；若未完成身份选择则进入 Onboarding
- P1（建议）
  - 短信登录 UX：手机号格式校验、倒计时按钮状态、错误提示更精确

#### Choose Identity（`pages/onboarding/choose-identity/index`）

- 模板：D（Wizard）
- 页面策略：login-required
- P0（必须）
  - 渐变硬编码改为 token；icon 白色硬编码改为 token
  - 身份卡片信息密度与 Tag 规则统一（秒通过/需审核）
  - 个人身份“秒通过”流程：成功/失败反馈文案去演示味
- P1（建议）
  - 增加“为什么需要认证”的解释折叠区（减少跳出）

#### Verification Form（`pages/onboarding/verification-form/index`）

- 模板：D（Wizard Form）
- 页面策略：login-required
- P0（必须）
  - 上传证据：删除需二次确认；文件项展示不可暴露内部 id（至少显示“材料 1/2/3”）
  - 表单校验从 toast 逐步升级为 inline（关键字段）
  - 提交成功后统一落地到“审核中”状态页（或回 Me/Publish 并提示）
- P1（建议）
  - OCR/自动填充（如果要做），与 API 对齐后规划

### 1.6 支付链路

#### Deposit Pay（`pages/checkout/deposit-pay/index`）

- 模板：E（Payment）
- 页面策略：public（可浏览）+ 支付动作 approved-required
- P0（必须）
  - 支付说明文案标准化（避免过长/不可扫读）
  - StickyBar 主次按钮规则统一（返回 ghost、支付 primary）
- P1（建议）
  - H5/桌面支付方案（二维码/跳转小程序）产品与 UI 明确化

#### Final Pay（`pages/checkout/final-pay/index`）

- 同 Deposit Pay（并补齐 PageHeader/说明模板一致性）

#### Deposit Success / Final Success（`pages/checkout/*-success/index`）

- 模板：E（Payment Result）
- 页面策略：login-required（建议补齐 audit 分支）
- P0（必须）
  - 成功页模板统一：信息摘要、下一步 Steps、主 CTA（进入消息/订单）
  - PermissionCard 之外补齐 AuditPending（避免“已登录但未审核”的尴尬状态）
  - “订单摘要”用 NutUI `Tag`/`Space` 收口（避免 MetaPills 与业务 Tag 混排）
- P1（建议）
  - 订单详情跳转入口（如果产品需要）

### 1.7 聊天

#### Chat（`pages/messages/chat/index`）

- Template: F (Chat)
- Page policy: approved-required (page-level)
- P0 (must)
  - createdAt uses formatTimeSmart (no raw ISO strings)
  - ScrollView message list + auto scroll to latest; keep input fixed with safe-area padding
  - Render message types: TEXT/IMAGE/FILE/SYSTEM (image preview, file copy link)
  - Cursor pagination for history (pull-to-refresh / load more) without jumping scroll position
  - Sending state: optimistic bubble -> replace with server message; failure keeps bubble with retry
- P1 (suggest)
  - Unread divider / day grouping
  - Attachment upload (image/file)
  - Read receipt (if backend supports)

## 2. Admin（apps/admin-web）逐页任务拆解（规划级）

> 后台页面普遍为 Table/Form/CMS，v2 的重点是：**危险操作确认、错误提示统一、文案去演示、审计留痕入口清晰**。

#### AppLayout（`apps/admin-web/src/ui/AppLayout.tsx`）

- P0：左侧 Logo 区的颜色硬编码（#fff 等）纳入 token 或白名单
- P0：Mock 场景切换必须 dev-only，并避免影响正式演示观感

#### Dashboard（`apps/admin-web/src/views/DashboardPage.tsx`）

- P0：去“演示/Mock fixtures”文案；错误汇总提示标准化（可重试、可定位）

#### Verifications / Listings / Orders / Refunds / Settlements

- P0：所有“通过/驳回/确认里程碑/退款”等不可逆操作统一二次确认（原因输入 + 审计提示）
- P0：错误提示统一组件（RequestErrorAlert 规范化：用户可读 + debug 可展开）
- P1：筛选区/表格密度/导出能力统一（提升运营效率）

#### Config（`apps/admin-web/src/views/ConfigPage.tsx`）

- P0：配置变更必须二次确认 + 变更摘要（对比 old/new）+ 审计留痕入口
- P0：去 P0 文案（仅 dev-only）
