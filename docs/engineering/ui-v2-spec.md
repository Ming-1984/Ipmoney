# UI Spec v2（生产级规范｜Client + Admin）

> 目标：把当前“可演示的骨架”升级为“可持续迭代的生产级 UI 体系”，做到**一致、可维护、可扩展、可验收**。  
> 本文只定义规范与验收口径，不包含代码改动。

## 0. 适用范围

- 用户端：`apps/client`（Taro 小程序 + H5 同构）
- 后台：`apps/admin-web`（React + Ant Design）

## 1. 核心原则（必须遵守）

1. **Token 驱动**：颜色/字号/间距/圆角/阴影/z-index/动效时间，不允许散落硬编码；例外必须在规范中登记并给出原因。
2. **组件契约优先**：组件不是“长得像”，而是“行为一致 + 状态一致 + 可复用”。
3. **页面模板化**：页面从“随手拼”升级为“模板 + 插槽”，提升一致性与交付效率。
4. **状态机不缩水**：所有页面必须覆盖 `loading/empty/error/permission/audit`（允许某页某态为 N/A，但必须明确写在页面审计里）。
5. **可观测可回溯**：白屏/错误必须能定位（最少：错误提示可导出、关键请求可追踪）。
6. **多端一致**：Client（rpx）与 Admin（px）在视觉 token 上一致，单位换算由实现层负责，规范只定义语义与比例。

## 2. 术语定义

- **Token**：设计变量（颜色、排版、间距等）的语义化命名，禁止用“#FF6A00”直接表达“主色”。
- **组件契约**：组件必须公开的变体（variants）、尺寸（sizes）、状态（states）、交互规则（interaction rules）。
- **页面模板**：页面骨架的固定结构（Header/Body/Sticky/Popup），页面只填充内容与行为。
- **访问策略（Access Policy）**：页面或页面内动作的权限要求：`public | login-required | approved-required`。

## 3. Token 体系（v2：补齐并固化）

### 3.1 颜色（语义 Token）

> 现状：Client 已有 `--c-*`（`apps/client/src/app.scss`），Admin 有 AntD token（`apps/admin-web/src/main.tsx`）。  
> v2 要求：补齐“语义层”，并为 overlay/disabled/selected/hover 提供标准值。

**基础语义**

- `color.brand.primary / hover / active`
- `color.brand.gold`（强调/徽标/点缀）
- `color.text.primary / secondary / muted / inverse`
- `color.bg.page / page-strong / surface / surface-elevated`
- `color.border.default / divider`
- `color.state.success / warning / danger / info`

**交互语义**

- `color.action.primary.bg / text / border`
- `color.action.secondary.bg / text / border`
- `color.action.danger.bg / text / border`
- `color.action.disabled.bg / text / border`
- `color.focus.ring`

**图层语义**

- `color.overlay.scrim`（遮罩层）
- `color.overlay.surface`（弹层背景）

> 映射建议：  
> - Client：继续以 `--c-primary` 等为实现层变量，但必须补齐“语义层映射表”（见本节末）。  
> - Admin：AntD token 与语义 token 统一映射（例如 `token.colorPrimary` 对应 `color.brand.primary`）。

**页面背景（Client｜WeApp + H5）**

目标：保留“上半屏浅橙渐变”（A），叠加“点金火花/矿脉感”轻纹理（C），并允许少量页面选择 `plain` 变体。

- 语义色（实现层映射见 `docs/engineering/token-mapping.md`）：
  - `color.bg.page`：页面底色（浅暖）
  - `color.bg.page-strong`：页面强调底（更偏橙，用于渐变上半屏）
  - `color.bg.surface`：内容容器底（白底）
  - `color.bg.surface-elevated`：弹层/浮层底（玻璃态/overlay）
- 背景合成 token（实现层允许用 CSS 变量承载 `background-image` 值）：
  - `bg.page.gradient`：默认页面渐变（上半屏）
  - `bg.page.texture`：默认轻纹理（必须低对比度、低透明度，不影响可读性）
  - `bg.page`：最终背景（`texture` 叠在 `gradient` 之上）
- 页面背景变体（Page Background Variant）：
  - `default`：`bg.page`（gradient + texture）
  - `plain`：仅 `color.bg.page`（适用于 Chat/地图等沉浸内容页）
  - `strong`（P1）：更强调的 `page-strong`，仍需克制（避免“活动页观感”）
- 多端落地规则：
  - WeApp：以 `page {}` 为主；`window.backgroundColor` 必须与 `color.bg.page` 一致，避免下拉回弹露底色。
  - H5：同时覆盖 `:root/body/.taro_page`，避免滚动/固定层露白；不允许依赖 overlay DOM 顺序（参见 UI-STD-P0-006）。
  - 例外：允许按页选择背景变体，但必须用统一 API（class/封装组件），禁止散落硬编码。

### 3.2 排版（Typography Token）

> 现状：Client 已有 `text-display/text-hero/text-title/text-subtitle/text-caption` 等 class（`apps/client/src/app.scss`）。  
> v2 要求：把“字号/字重/行高”变成显式 token，并规定页面使用规范。

**字号等级（语义）**

- `font.size.display`（大标题/品牌区）
- `font.size.hero`（页头 hero）
- `font.size.title`（页面标题/卡片标题）
- `font.size.body`（正文）
- `font.size.subtitle`（次级说明/元信息）
- `font.size.caption`（说明/辅助）

**字重**

- `font.weight.bold`（800）
- `font.weight.semibold`（600–700）
- `font.weight.regular`（400）

**行高**

- `font.line.tight`（1.12–1.25）
- `font.line.normal`（1.5–1.6）

**Client 推荐数值（对齐 WeUI）**

- `font.size.display = 44rpx`
- `font.size.hero = 40rpx`
- `font.size.title = 36rpx`
- `font.size.body = 34rpx`（主字号）
- `font.size.subtitle = 28rpx`（次级说明/元信息）
- `font.size.caption = 24rpx`（说明；用户可见文本最小字号）
- 禁止用户可见文本 < `24rpx`（例如 `22rpx`/`20rpx` 这类微小字号）

**H5 字号一致性（微信内）**

- 禁用自动字体调整：`text-size-adjust: 100%`（实现：`apps/client/src/app.scss`）
- Root clamp：`baseFontSize=20, minRootSize=18, maxRootSize=22`（实现：`apps/client/config/index.ts`）
- 不要在 `html/:root` 手写 `font-size`（避免与 rpx→rem 转换脚本叠加）

**交互尺寸基线（对齐 WeUI）**

- 最小热区：`88rpx≈44px`
- 主按钮高：`96rpx≈48px`
- Cell padding：`32rpx≈16px`

**规定**

- 任何页面不得用“全加粗大字”制造层级；必须通过 token 化层级表达。
- 文案最多 2 行说明，超出需折叠或跳转。

### 3.3 间距（Spacing Token）

> 现状：Client 有 `--space-1..6`（8/16/24/32/48/64 rpx）。  
> v2 要求：把“页面节奏”固化：分组间距、卡片内间距、列表密度。

**基础刻度**

- `space.0 = 0`
- `space.1 = 8`
- `space.2 = 16`
- `space.3 = 24`
- `space.4 = 32`
- `space.5 = 48`
- `space.6 = 64`

**语义间距**

- `space.page.padding`
- `space.section.gap`（卡片间/区块间）
- `space.card.padding`
- `space.list.item.padding`

**规定**

- 禁止在页面里大量写 `style={{ height: '12rpx' }}` 作为分隔（统一用 `Spacer` 或模板默认间距）。

### 3.4 圆角、阴影、边框

> v2 规定：同一层级只允许 1–2 种圆角与阴影组合（减少“看起来不统一”）。

- `radius.sm/md/lg/xl`
- `shadow.sm/md`
- `border.width.default`（Hairline 规则：小程序与 H5 一致策略）

### 3.5 Z-Index（必须定义）

> 白屏问题曾与 overlay DOM 顺序相关；z-index 体系必须明确，避免“靠猜”。

- `z.base = 0`
- `z.sticky = 10`（吸底/悬浮条）
- `z.popup = 100`
- `z.dialog = 200`
- `z.toast = 300`

### 3.6 Motion（动效与时长）

- `motion.duration.fast = 120ms`
- `motion.duration.normal = 200ms`
- `motion.duration.slow = 320ms`
- `motion.easing.standard = cubic-bezier(0.2, 0, 0, 1)`

规定：页面切换/弹层/按钮反馈必须使用统一时长与 easing，避免“每个组件一个速度”。

### 3.7 Token 映射表（必须产出）

- Client：语义 token → `apps/client/src/app.scss` 的 `--c-* / --space-* / text-*` 的映射表
- Admin：语义 token → AntD `ThemeConfig.token/components` 的映射表

> 交付物：见 `docs/engineering/ui-v2-page-audit.md` 中的“跨页面 P0 任务”。

## 4. 组件契约（Client）

> 说明：本节定义“必须具备的变体/状态/交互”，不是实现细节。

### 4.1 PageHeader（页头）

**变体**

- `header`：普通页头（标题 + 可选副标题 + 右侧动作）
- `hero`：主视觉页头（更强强调，允许品牌/流程说明）

**规则**

- 每页最多 1 个主标题；副标题最多 2 行。
- 右侧动作最多 1 个（更多动作进入二级菜单/Popup）。
- WeApp（微信小程序）：默认使用原生导航栏（`navigationStyle: default`），页面内不再渲染自定义顶栏，避免“两个顶部栏/两个返回按钮”。如确需自定义右侧动作，再按页启用 `navigationStyle: custom`。
- H5：使用 NutUI `NavBar` 作为顶栏，默认展示 `Back + Title (+ Right)`；不展示动图 Logo/副标题。
- 首页：品牌区使用圆形动图 Logo + 统一副标题「专利点金台」（替换旧文案「专利变金豆矿」）。

### 4.2 Card / Surface（容器）

**用途**

- `Card`：内容块（有内边距）
- `Surface`：承载列表/组合内容（允许 `padding=none/sm/md`）

**规则**

- 同屏容器圆角一致；避免 Card/Surface 混用导致“圆角不齐”。
- 默认提供轻边框 + 柔和阴影的层级（来自 token：`color.border.default` + `shadow.sm`），避免容器“平铺”。

### 4.3 Button（按钮）

**变体（语义）**

- `primary`：唯一主操作（提交/支付/确认）
- `ghost`：次操作（返回/刷新/查看规则）
- `danger`：危险操作（取消/驳回/删除）
- `default`：中性操作

**规则**

- 同屏只允许 1 个 `primary`（吸底除外，但也只能 1 个主 CTA）。
- 必须定义 `loading/disabled` 展示规范（不可只禁用无反馈）。

### 4.4 Tag / Chip（标签/筛选项）

- `Tag`：信息标签（类型/级别/状态）
- `Chip`：交互筛选项（可选中）

规则：Tag 不可点击（除非明确设计）；Chip 可点击且必须有选中态/禁用态。

尺寸规范（P0）：

- Tag 字号与页面正文对齐，默认 `font.size.base`（通过 `--nutui-tag-font-size` 统一）
- Tag 高度使用内容自适应（`--nutui-tag-height: auto`），padding 使用 `space-1/space-2`
- 圆角统一 `--nutui-tag-round-border-radius`，避免默认 2px 过小

字段展示建议（P0）：

- 短字段/状态：用 Tag
- 长文本/说明：用 `CellRow`/`description`，不要塞进 Tag

### 4.5 列表组件（ListingCard / ListItem）

规则：

- 标题最多 2 行；次信息 1–2 行；关键指标必须可扫读。
- 行点击热区完整覆盖，且有 active 态反馈。

### 4.6 页面状态组件（StateCards）

必须覆盖：

- `Loading`：骨架或 LoadingCard（不得白屏）
- `Empty`：必须给“下一步动作”（刷新/去搜索/去发布/去登录）
- `Error`：必须可重试，并给“可解释文案”
- `Permission`：引导到登录/身份选择
- `Audit`：显示审核状态与下一步

### 4.7 Popup / Dialog / Toast（反馈体系）

规则：

- 全局统一出口（避免多处挂载导致 DOM/样式问题）。
- confirm 必须返回 Promise 并有默认文案模板（确定/取消）。

> 注：Client 已有统一出口（`AppOverlays + Feedback`），规范要求“所有确认/提示必须走统一出口”。

### 4.8 Sort / Category / Filter（排序/分类/筛选）

> 目标：全站“排序/分类/筛选”交互与样式一致，且参数严格对齐 OpenAPI（避免页面各自实现导致发散）。

**成熟组件优先**

- Client：NutUI Taro（`Segmented`/`Popup`/`CellGroup`/`Input`/`InputNumber` 等）+ 自研适配层（`apps/client/src/ui/nutui/*`）
- Admin：Ant Design（`Table`/`Form`/`Select`/`DatePicker` 等），避免自研表格筛选 UI

**统一控件形态（Client）**

- `CategoryControl`（分类）：
  - 顶部主分类（如：专利/需求/成果/机构）：用 `Tabs(activeType="line")`，风格对齐微信小程序（下划线指示器 + 单行）。
  - 小范围切换（如：买家/卖家；我的列表状态）：≤3 个选项可用 `Segmented`；>3 个选项用可滚动 `Tabs(activeType="line")` 或移入筛选弹层。
- `SortControl`（排序）：
  - 默认展示 3 个短标签：`推荐 / 最新 / 热度`（顺序固定），用 `Tabs(activeType="line")`。
  - 本轮不提供 `发明人` 排序；如后续需要更多排序项，进入 `SortSheet`（P1）。
  - 不同内容类型分别对齐对应枚举：专利交易用 `SortBy`；需求/成果用 `ContentSortBy`。
- `SortSheet`（更多排序｜P1）：用底部 `Popup`（sheet）展示完整排序枚举（含“价格升/降”等扩展项），点击即应用并关闭。
- `FilterTrigger`（筛选入口）：统一用 `Button variant="ghost"` + 文案 `筛选`；建议展示“已选数量”（如 `筛选·3`），与 `FilterSummary` 一致

**统一筛选弹层（Client）**

- 形态：底部 `Popup`（sheet），标题为“筛选”，支持 `onClose`/`onOverlayClick`
- 必备动作：`重置`（ghost）+ `应用`（primary），顺序固定（左重置/右应用）
- Draft 与 Applied：
  - 打开弹层：Draft=Applied 的快照
  - 关闭弹层：不改变 Applied（丢弃 Draft）
  - 点击“应用”：Applied=Draft（并触发 reload）
  - 点击“重置”：Draft 还原为“默认值”（不自动应用，需再点“应用”）
- 字段形态：
  - 枚举/多选：优先 `Chip`（选中态/禁用态统一）
  - 文本：`Input`（IPC/LOC/关键词等）
  - 金额范围：输入单位为“元”，内部转换为“分”（`MoneyFen`）；需校验 `min<=max`
  - 地区：统一走 `pages/region-picker/index`（CellRow 入口 + 回填展示），避免各页自己实现地区树
- “更多筛选”：同一弹层内用分组/折叠承载（不另起页面、不用纯文案占位），逐步披露不常用字段

**筛选结果可见性**

- Tool 区必须给出“当前筛选是否生效”的反馈：未生效显示“未设置筛选”，生效时至少展示 1–3 个摘要 Chip（超出折叠为 `+N`）
- 必须支持“一键清空”（重置并应用）或“重置→应用”两步，且文案一致

**数据与并发**

- 请求参数必须走 `cleanParams()`（禁止 `undefined/null/''` 进入 query）
- 切换排序/筛选/分类触发 reload；P1：快速切换时丢弃过期请求结果（避免回跳旧结果）

## 5. 页面模板（Client）

> 目标：页面只做业务编排，骨架由模板保证一致。

### 模板 A：Tab Landing（Home / Search / Publish / Messages / Me）

结构：

- 顶部：`Header/Hero`
- 中部：核心功能区（搜索/入口/列表）
- 底部：TabBar（由框架提供）

状态：

- 页面可 public，但“动作”可能需要登录/审核（用 Permission/Audit 作为动作级拦截，不强制全页拦截）。

必备插槽（P0）：

- 顶部区块：标题 + 一句解释（可选品牌点缀/徽标）
- 核心功能区：搜索/入口/列表之一（同屏信息层级清晰）
- 反馈：点击/加载/错误/空态都有可见反馈（至少提示下一步）

禁用项（P0）：

- 同屏出现多个 `primary` CTA（最多 1 个主动作）
- 同屏多个“强元素”（大渐变/重阴影/高饱和块）堆叠

补充：Messages 会话列表（Tab 消息）视觉规范（P0）：

- 结构：`PageHeader` + `PullToRefresh` + `Surface` + `CellGroup`
- 列表行：优先 NutUI `Cell/CellRow` + `Avatar/Tag/Badge` 组合；标题/摘要最多两行
- 容器层级：列表容器使用轻边框 + 柔和阴影；行点击有轻微按压反馈
- 时间/未读：时间使用 `font.size.caption`；`unreadCount > 0` 才显示 `Badge`
- 颜色：背景默认 `bg.page`；列表容器 `color.bg.surface`；分隔/文字均用语义 token，禁硬编码

### 模板 B：List + Filter（Feeds / Favorites / Orders / MyListings 等）

结构：

- 页头：`PageHeader(header)`
- 功能区：筛选/排序（Segmented/Popup）
- 内容区：列表（Surface + 行组件）

状态：

- 必须覆盖 loading/error/empty

必备插槽（P0）：

- `PageHeader`（非 Tab 页自动显示返回）
- 工具区：排序（Segmented）+ 筛选入口（FilterSheet）+ 已选摘要（FilterSummary）
- 内容区：列表行组件（Surface + 行点击态）

禁用项（P0）：

- 页面内散落多个筛选弹层（必须收敛到统一 FilterSheet）
- 列表项不可点/缺少 active 态

### 模板 C：Detail + Sticky CTA（Listing/Order/Patent/Org Detail）

结构：

- 详情卡片若干（Surface/Card）
- 吸底：`StickyBar`（最多 3 个按钮，但只有 1 个 primary）

状态：

- 缺参必须兜底（ErrorCard + 返回）

必备插槽（P0）：

- `PageHeader` + 关键字段区块（MetaPills/标签）
- `StickyBar`：最多 3 个按钮，但只有 1 个 primary（其余为 ghost/secondary）

视觉规范（P0）：

- 关键字段标签（MetaPills/Tag）字号不低于 `font.size.s`；通过 `--nutui-tag-font-size/--nutui-tag-height` 统一，避免“过小标签”
- 字段值（CellRow description/extra）字号不低于 `font.size.body`；必要时用 `text-strong/muted` 拉开层级

禁用项（P0）：

- 吸底出现多个 primary（容易产生误操作）
- 关键规则/风险提示只用大段文字堆叠（必须结构化为要点）

### 模板 D：Form / Wizard（Publish Patent / Onboarding / Profile）

结构：

- `PageHeader(hero)`
- 分段卡片（步骤编号/分组）
- 吸底提交（StickyBar）

状态：

- 提交态必须防重复（loading + disable + toast）
- 校验错误必须可解释（优先 inline，必要时 toast）

必备插槽（P0）：

- 顶部：`PageHeader(hero)`（标题 + 一句说明）
- 表单区：分段卡片（字段分组清晰，错误可解释）
- 吸底：提交按钮（StickyBar）

禁用项（P0）：

- 多处重复提交入口（保持单一主提交）
- 用技术字段名/内部 ID 作为用户可见文案

### 模板 E：Payment Flow（Deposit/Final Pay + Success）

结构：

- 清晰的“金额摘要 + 规则说明 + CTA”
- H5/PC 端策略：提示“去小程序支付”或展示二维码（P1）

必备插槽（P0）：

- 金额摘要（订金/尾款/总额）与订单状态提示
- 规则说明（托管/退款/放款条件）可扫读
- 成功页：明确下一步（查看订单/继续办理/返回首页）

### 模板 F：Chat（Messages Chat）

结构：

- Header + 消息列表 + 吸底输入条

状态：

- permission/audit 必须优先渲染（不可让输入框在无权限时可用）

必备插槽（P0）：

- Header + 消息列表 + 吸底输入条（与 safe-area 对齐）
- 失败可重试（发送失败/加载失败）

视觉规范（P0）：

- 背景：Chat 使用 `plain` 变体（无纹理），页面底色为 `color.bg.page`，避免渐变/纹理干扰阅读。
- 气泡：对方气泡使用 `color.bg.surface` + `color.border.default` + `shadow.sm`；己方气泡使用 `color.action.primary.bg`（可用品牌渐变），文字使用 `color.text.inverse`。
- 气泡排版：最大宽度 70–78%；内边距使用 `space-2/space-3`；圆角用 `radius.lg`，收/发气泡底角略有区分以形成尾感。
- 系统消息：胶囊式提示，字号为 `font.size.caption`，不做大块色面。
- 吸底输入条：背景 `color.bg.page`，上边框 `color.border.divider`；按钮统一用 NutUI `Button`，输入框优先复用 NutUI `Input`（需保留小程序 `confirm/send` 行为）；视觉上输入框/按钮圆角一致、同高度。

### 模板 G：Policy/Rules（Trade Rules）

结构：

- PageHeader + 分节卡片
- 内容必须可扫读（标题/要点/例外）

必备插槽（P0）：

- 分节标题（SectionHeader）+ 要点列表（MetaPills/列表）
- 关键例外与争议处理路径明确（用户看得懂下一步）

## 6. 页面状态机（统一口径）

### 6.1 状态优先级

1. `permission`（未登录/缺身份）
2. `audit`（未审核通过）
3. `loading`
4. `error`
5. `empty`
6. `content`

> 说明：若页面为 public，但某些动作需要权限，则页面仍可展示 `content`，动作触发时才弹出 Permission/Audit 指引。

### 6.2 触发条件（规范）

- `permission`：Access Policy = login-required 且 token 缺失；或需要 onboarding 且未完成
- `audit`：Access Policy = approved-required 且 status != APPROVED
- `loading`：首屏/切换筛选/分页加载中
- `error`：请求失败（需归一化 message）
- `empty`：请求成功但数据为空

### 6.3 错误文案（必须可解释）

禁止直接展示：

- `HTTP 500`
- `undefined/null`
- 后端堆栈/原始错误

必须转换为“用户可理解 + 可行动”的句式（见 `Copywriting`）。

## 7. 导航与路由（Client）

### 7.1 Tab vs Stack

- Tab 页只能用 `switchTab`
- 非 Tab 页用 `navigateTo`
- 需要清空栈时用 `reLaunch`（如登出回首页）

### 7.2 参数校验

- 所有 `?xxxId=` 必须校验非空；缺参统一用 ErrorCard（“参数缺失”）并给“返回”动作。
- 参数类型：字符串统一 `String()`，数字统一 `Number()` 并校验 `isFinite`。

### 7.3 H5 深链规则

- 约定唯一入口：`/#/pages/<pagePath>`（如 `/#/pages/home/index`）
- 所有页面必须能从深链打开并自恢复（缺参/无权限时给出下一步）。

## 8. 数据层规范（Client/Admin 通用）

### 8.1 参数清洗（必须）

规则：

- 请求参数中不得出现 `undefined` / `null` / 空字符串（除非明确允许）
- GET query 必须省略无效字段（避免出现 `q=undefined`）

### 8.2 错误归一化（必须）

输出统一形态：

- `type`：`network | auth | business | unknown`
- `message`：用户可读
- `debug`：可选（仅 dev 或“导出诊断”里可见）

### 8.3 幂等（必须定义）

对“创建/提交/支付意图”等操作必须带 idempotency key，并制定生成规则（同一用户同一动作同一 key）。

### 8.4 并发与取消（P1）

- 搜索/筛选切换必须取消上一次请求或丢弃过期结果（避免闪烁与错乱）

## 9. 文案规范（Copywriting）

### 9.1 禁用词（用户可见区域）

- “P0 / 演示 / Mock / undefined / HTTP xxx / error stack”

### 9.2 统一术语表（示例）

- 收藏：统一用“收藏”（不混用“关注/喜欢”）
- 咨询：统一用“咨询”（不混用“联系/沟通”）
- 订金/尾款：统一用“订金”“尾款”
- 认证/审核：用户侧“认证”，后台侧“审核”

### 9.3 提示语模板（示例）

- Loading：`正在加载…`
- Empty：`暂无数据` + `刷新` / `去搜索` / `去发布`
- Error：`加载失败，请稍后重试` + `重试`
- Permission：`需要登录后继续` + `去登录`
- Audit：`资料审核中` / `已驳回，请重新提交`

## 10. 质量门槛（验收口径）

> 详细清单见 `docs/engineering/ui-v2-qa-checklist.md`

- 0 白屏：任何异常必须可见错误态或兜底页
- 0 硬编码 Token（除非白名单）
- 0 禁用词出现在用户可见文案
- 交互热区 ≥ 44px（等效）
- H5 桌面宽度下布局不崩（**居中手机宽度**，容器/TabBar/吸底对齐，字号不随屏幕放大）

## 11. 备注：已知关键风险

- **Taro H5 Router DOM 约束**：overlay/portal 若插入 `.taro_router` 且影响 `.taro_page` 的 last-child 规则，可能导致页面被隐藏。任何新增弹层库需通过“路由 DOM 结构验收”。
