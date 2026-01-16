# UI v2 落地 TODO（体系优先 A｜待你确认后再实施）

> 本 TODO 负责把“最高标准 UI 规划”落到**可执行、可验收、可排期**的任务列表。  
> 规范基准：`docs/engineering/ui-v2-spec.md`  
> 页面审计：`docs/engineering/ui-v2-page-audit.md`、`docs/engineering/ui-v2-page-by-page.md`  
> 验收口径：`docs/engineering/ui-v2-qa-checklist.md`

## 0. 待你确认（确认后才开始写代码）

- [x] 0.1 确认采用“体系优先 A”路线（先公共能力，再批量接入页面）
- [x] 0.2 确认禁用词策略：用户可见区域 0 “P0/演示/Mock/技术细节”（dev-only 可保留）
- [x] 0.3 确认页面权限策略口径：**页面级 + 动作级并存**
  - 页面级：对 `approved-required` 页面直接展示 Permission/Audit 状态（不发请求、不卡 Loading）
  - 动作级：对 `public` 页面保留“可看不可操作”（收藏/咨询/下单等动作拦截）
- [x] 0.4 确认 H5 桌面策略：≥768px **居中手机宽度**（不做双列响应式），避免“被放大/太松/太大”
- [x] 0.5 确认 P1 技术选型：P0 不引入 TanStack Query（最低成本，先维持现有请求方式；P1 再评估）
- [x] 0.6【Sizing 专项】确认 H5 字号一致性方案（微信内｜手机）：主字号对齐 WeChat/WeUI（≈17px）；禁用 iOS/微信自动字体调整；H5 root clamp `18–22`；NutUI 与页面单位统一（不再出现同屏“有的偏小/有的正常”）
- [x] 0.7【Background 专项】确认页面背景方案：A（上半屏浅橙渐变）+ C（点金火花/矿脉感轻纹理），允许少量页面例外 `plain`，并对齐 WeApp + H5

## 1. P0（体系级）— 必须先落地的公共能力

### 1.1 UI-STD-P0-004：请求参数清洗 + 错误归一化（Client + Admin）

- [x] 定义 `cleanParams()` 规则：去掉 `undefined/null/''`，保留白名单字段（避免 `q=undefined`）
- [x] 定义 `normalizeError()` 规则：network/auth/business/unknown → 用户可读 message + 可选 debug
- [x] 统一错误映射表：鉴权失效/超时/404/500/业务错误码 → 文案模板（与 `ui-v2-spec` 文案一致）
- [x] 统一“可重试”判定：哪些错误显示 Retry，哪些引导登录/认证
- [x] 验收：抓包/日志中 query/body 不出现 `undefined/null`；错误态文案可解释且有下一步

### 1.2 UI-STD-P0-003：页面状态机统一（Client）

- [x] 固化状态优先级：`permission → audit → loading → error → empty → content`
- [x] 定义 Page 级访问策略（页面级）：`public | login-required | approved-required`
- [x] 定义 Action 级访问策略（按钮/入口级）：同上（用于 Home/Search/Feeds 等“可看但不可操作”页面）
- [x] 产出“页面状态机接入指南”：`docs/engineering/ui-v2-state-machine-guide.md`
- [x] 验收：未登录/未选身份/审核未通过时，不出现“卡 Loading/空白”

### 1.3 UI-STD-P0-005：路由参数缺参兜底标准化（Client + Admin）

- [x] 定义统一缺参文案模板（参数缺失/返回/刷新）
- [x] 定义参数解析规则：string/number/uuid 校验（不合格进入缺参兜底）
- [x] Mock/fixtures sample data: all `Uuid` fields use valid UUID v4 (avoid deep-link "link invalid")
- [x] Provide script: `node scripts/fixture-uuids.mjs --check|--write`
- [x] Sync demo/capture SAMPLE IDs (`scripts/capture-ui.ps1`, `scripts/capture-weapp-ui.js`)
- [x] 验收：任意 `?xxxId=` 深链缺参访问可自恢复，不白屏

### 1.4 UI-STD-P0-006：Overlay/Router DOM 结构验收用例（Client H5）

- [x] H5 入口兜底：根路径/空 hash 自动跳转到首页（避免直接访问根 URL 白屏）
- [x] 固化“路由 DOM 结构”验收脚本/检查项（避免 overlay 影响 `.taro_page` 展示）
- [x] 固化“新增弹层库接入清单”（portal/teleport 的挂载点与层级）
- [x] 验收：新增弹层/Toast/Dialog 后，页面切换不闪白、不被隐藏

### 1.5 UI-STD-P0-002：文案治理（Client + Admin）

- [x] 建立“禁用词扫描清单”（P0/演示/Mock/HTTP/undefined 等）
- [x] 统一术语表（收藏/咨询/订金/尾款/认证/审核等）并替换全站
- [x] 统一状态文案模板（loading/empty/error/permission/audit）
- [x] 验收：用户可见区域 0 禁用词；空态/错误态都有下一步动作

### 1.6 UI-STD-P0-001：Token 去硬编码（Client + Admin）

- [x] 产出 Token 映射表（语义 token → Client CSS 变量 / Admin AntD token）
- [x] 建立硬编码白名单（允许的例外：Logo 渐变/第三方组件必要值等，必须登记）
- [x] 全局补齐 NutUI Tag 尺寸 token（`--nutui-tag-font-size/--nutui-tag-padding/--nutui-tag-height`），对齐页面字号
- [ ] 验收：页面/组件层面硬编码颜色/字号/间距显著收敛，新增代码禁止再引入

### 1.6A UI-STD-P0-012：页面背景系统（A+C + 例外变体｜WeApp + H5）

- [x] 在 `apps/client/src/app.scss` 增加背景实现层 token：`--bg-page-gradient/--bg-page-texture/--bg-page/--bg-page-plain`（并同步 `docs/engineering/token-mapping.md`）
- [x] 全局背景落点统一：WeApp `page` + H5 `:root/body/.taro_page`；避免滚动/固定层露白
- [x] app 级配置补齐：`apps/client/src/app.config.ts` 设置 `window.backgroundColor`（对齐 `color.bg.page`），避免下拉回弹露底色
- [x] 提供统一“背景变体 API”（class 或 `PageShell` 封装）并落到页面（首批 `plain`：`pages/messages/chat/index`、`pages/patent-map/index`、`pages/patent-map/region-detail/index`）
- [x] 清理会破坏背景一致性的背景硬编码（只处理背景相关）：`apps/client/src/ui/ErrorBoundary.tsx`、`apps/client/src/pages/checkout/components/MiniProgramPayGuide.tsx` 等
- [x] 验收：任意页面切换/下拉回弹不露白、不露突兀底色；默认页有轻纹理但内容可读；plain 页无渐变干扰

### 1.7 UI-STD-P0-007：密度与桌面（Client H5）【你已确认：居中手机宽度】

> 目标：在桌面浏览器访问 H5 时，不出现“组件被放大/留白过松/TabBar 与内容不对齐”等观感问题；同时不影响小程序端。

- [x] ≥768px：根字号收敛：不手写 `html font-size`，改用 `pxtransform` root clamp 控制比例（避免桌面端随屏幕放大）
- [x] ≥768px：将 `#app/.taro-tabbar__container` 限制为手机宽度并居中（max 430px），页面背景铺满但内容区居中
- [x] ≥768px：固定层对齐（StickyBar/底部 TabBar/ChatInput）必须与内容区同宽同中心（不允许全屏铺开）
- [x] 密度：整体字号/图标/间距做一次“克制缩放”，信息密度提升但不牺牲可读性
- [x] 组件：NutUI 基础字号与 Cell/CellGroup 的 padding/margin 统一收紧（避免“过松/过大”）
- [x] 修正 H5 全局缩放：将 `apps/client/config/index.ts` 的 `designWidth` 调整为 `750`（对齐微信 rpx 语义：`88rpx≈44px`），并回归验证 H5/小程序的视觉与热区一致性
- [ ] 验收：同一页面在手机与桌面 H5 展示的字号/间距观感一致；桌面端不再“巨字/巨控件”


### 1.7A UI-STD-P0-007A：H5 字号一致性与基线（微信内｜手机）【已执行（防回退）】

> 对照基线（微信官方）：WeUI 默认主字号 17px（Cell/按钮）、tips 14px、desc 12px；最小热区 44px；并显式设置 `-webkit-text-size-adjust: 100%`。
>
> 目标口径（对齐 WeUI）：主字号 `34rpx≈17px`；次级 `28rpx≈14px`；说明 `24rpx≈12px`；最小热区 `88rpx≈44px`；主按钮高 `96rpx≈48px`；Cell padding `32rpx≈16px`；H5 root clamp `18–22`。

- [x] 全局关闭微信/iOS 自动字体调整：`apps/client/src/app.scss` 增加 `text-size-adjust: 100%`
- [x] 基线位置调整：不在 `html/:root` 写 `font-size`；统一在 `page, body` 设置主字号 `34rpx` 基线，并让 `#app/.taro_page` 继承
- [x] 排版梯度对齐 WeUI：`44/40/36/34/28/24`（display/hero/title/body/subtitle/caption），用户可见文本最小字号≥`24rpx`
- [x] NutUI 单位统一：`--nutui-font-size-*`、button/cell 尺寸等改为 rpx，并对齐 WeUI（按钮高 `96rpx≈48px`、cell padding `32rpx≈16px`）
- [x] H5 root 收敛：`apps/client/config/index.ts` 配置 `baseFontSize=20, minRootSize=18, maxRootSize=22`
- [x] 验收：同屏不出现“部分字体偏小”；微信内置浏览器（iOS + Android）+ Safari/Chrome；覆盖 320/360/375/390/414/430 宽度与横竖屏切换

### 1.8 模板化 A–G（Client）

- [x] 定义并固化模板：A Tab / B List / C Detail+Sticky / D Form / E Payment / F Chat / G Policy
- [x] 固化“每模板的必备插槽与禁用项”（例如同屏只能 1 个 primary CTA）
- [x] 验收：任意新页面按模板开发，不需要重新讨论布局与状态机

### 1.9 UI-STD-P0-009：导航与返回策略（Client + Admin）

> 依据：微信小程序设计指南（导航明确，来去自如）+ `docs/engineering/ui-v2-qa-checklist.md`（导航与路由 P0）。

- [x] 定义 `safeNavigateBack()`：优先返回上一页；无历史栈时 fallback 到指定页面（默认回 `Home`；发布流程可回 `Publish`）
- [x] 统一返回入口样式：`PageHeader` 支持 Back 变体（或新增 `PageNav`），全站复用同一套文案与交互
- [x] 关键页面覆盖：Detail/Form/Payment/Chat/Policy 等所有非 Tab 页（避免用户“只能靠系统返回/浏览器返回”）
- [x] 验收：H5 深链直接打开非 Tab 页也不迷路；任何页面都能通过可见的“返回”回到上一级或首页

### 1.10 UI-STD-P0-010：顶部栏系统化（Client）

> 目标：WeApp 使用原生导航栏（避免双顶栏/双返回）；H5 使用 `NavBar` 作为顶栏（标题 + 返回 + 右侧动作），简约美观；首页保留品牌区。

- [x] H5：`PageHeader` 使用 NutUI `NavBar` 风格（系统顶栏组件）
- [x] H5：`PageHeader` 默认不展示 Logo/副标题；非 Tab 页自动 Back，Tab 页不显示 Back
- [x] WeApp：`PageHeader` 不渲染 UI（仅同步系统标题），顶部栏交给原生导航栏（避免“两个顶部栏/两个返回按钮”）
- [x] 如确需自定义右侧动作：仅对该页启用 `navigationStyle: custom`，并补齐 safe-area 与返回策略验收（P0 暂无页面需要 custom nav；仅固化规则）
- [x] Home 品牌副标题文案：`专利变金豆矿` → `专利点金台`
- [x] 验收：WeApp 端无双顶栏/双返回；H5 端顶栏对齐、标题不挤压、触控热区 ≥ 44px 等效

### 1.11 UI-STD-P0-011：筛选/排序/分类系统收敛（Client + Admin）

> 目标：系统所有页面的“排序/分类/筛选”统一为成熟组件形态，交互一致、样式一致、参数对齐 OpenAPI。  
> 规范：`docs/engineering/ui-v2-spec.md`（4.8）  
> 参数对齐表：`docs/engineering/ui-v2-filter-mapping.md`

- [x] 补齐 UI 规范（排序/分类/筛选 + FilterSheet 交互约束）
- [x] 补齐 OpenAPI ↔ UI 参数对齐表（Search/榜单/我的/订单/后台审核列表）
- [x] Client：抽象统一组件（P0）
  - [x] `FilterSheet`：Popup + 重置/应用 + Draft/Applied 规则固化
  - [x] `ChipGroup`：单选/多选统一（含 disabled/选中态）
  - [x] `RangeInput`：元↔分转换 + min/max 校验（价格/订金/预算等）
  - [x] `TagInput`：产业标签“手动输入+添加/删除”（P1）；P0 再接公共标签源 (GET /public/industry-tags)
  - [x] `FilterSummary`：工具区展示已选筛选摘要（1–3 个 + `+N`）
- [x] Client：分类/排序控件收口（P0｜对齐小程序观感）
  - [x] `CategoryControl`：主分类优先 Tabs(line)，小范围切换可用 Segmented；>3 可滚动；统一字号/高度/active 线条
  - [x] `SortControl`：统一 Tabs(line)（推荐/最新/热度/发明人），顺序固定；切换即重载并回到第 1 页
  - [x] `SortSheet`：更多排序项（如价格升/降等）进入 Popup(sheet)，点选即应用并关闭
  - [x] 验收：Search/Feeds/Favorites/Orders/My* 等页面的分类/排序控件样式一致（像微信小程序），且参数严格对齐 `ui-v2-filter-mapping.md`
- [x] Admin：表格筛选/排序统一（P0）
  - [x] 统一审核列表筛选区：`auditStatus/status`（AntD `Select`/`Tabs`/`Table` filters）
  - [x] Keyword/region filters (q + regionCode) are confirmed P0: OpenAPI + api-types + fixtures done; implement Admin UI + mock (+ api if needed).

### 1.12 UI-STD-P0-013：页面滚动/弹层滚动统一（Client + Admin）

- [x] 完成现状审计文档：`docs/engineering/ui-v2-scroll-audit.md`
- [x] QA Checklist 增补滚动验收项：`docs/engineering/ui-v2-qa-checklist.md`
- [ ] 统一页面滚动根规则：`page/.taro_page` 与 `ScrollView` 边界清晰，禁止“双滚动”
- [x] 建立弹层内容容器规范（Popup/Modal body）：`max-height + overflow-y + safe-area`，禁止复用 `.container`
- [x] Client：统一 Popup/Sheet 的 `lockScroll/closeOnOverlayClick/zIndex` 默认值，并覆盖 FilterSheet/SortSheet/订单退款 Popup
- [x] Admin：统一 Modal/confirm 的可滚动 body（`maxHeight/overflow`）并落地到 Regions/Listings/confirmAction
- [ ] 验收：H5/WeApp/桌面端弹层与页面滚动不穿透、不遮挡、关闭后滚动恢复


### 1.13 UI-STD-P0-014：视觉层次与聊天/会话样式收敛（Client）

- [x] 卡片/Surface 默认轻边框 + 柔和阴影，容器层次清晰
- [x] Messages 会话列表背景/容器/按压反馈统一（NutUI Cell + Surface）
- [x] Chat 气泡/系统消息/输入条视觉优化（圆角、边框、阴影、对齐）
- [x] 字段展示字号收敛：Cell description/extra 不低于 `font.size.body`
- [x] 验收：会话页与聊天页不再“平铺”，字段字号清晰可读

## 2. P1（体系级）— 强体验与效率（在 P0 之后）

### 2.1 统一请求缓存/分页/刷新（Client）

- [ ] 决策：TanStack Query / 继续现有 hooks / 自研最小缓存层
- [ ] 列表页标准：首屏骨架 + 分页加载 + 下拉刷新 + 过期请求丢弃

### 2.2 统一格式化（Client + Admin）

- [x] 金额（分/元）、时间（ISO → 可读）、枚举 label、地区码→名称 的统一工具与口径
  - [x] 金额：Client 收口到 `apps/client/src/lib/money.ts`；Admin 收口到 `apps/admin-web/src/lib/format.ts`
  - [x] 时间：Client/Admin 均收口到 `formatTimeSmart()`（表格/详情禁止直接输出 ISO）
  - [x] 枚举 label：Client 收口到 `apps/client/src/lib/labels.ts`；Admin 收口到 `apps/admin-web/src/lib/labels.ts`
  - [x] 地区码→名称：Client 增加 `apps/client/src/lib/regions.ts`（RegionPicker 自动缓存），页面用 `regionDisplayName()`（无 name 时 fallback code）

### 2.3 响应式与可访问性（Client H5）

- [ ] ≥768px 布局规则（**居中手机宽度**、固定层对齐、避免字体随屏幕放大；双列/宽屏响应式作为 P2 可选）
- [ ] A11y 基线（触控热区、对比度、focus-visible、键盘回车）

### 2.4 AI/智能体与告警相关 UI（Client + Admin）

- [ ] Home/Search：智能体入口（小程序）；H5 显示“去小程序体验语音搜索”
- [ ] Detail：AI 解析卡片（专利/需求/成果）+ 评分/纠错入口
- [ ] Admin：AI 解析复核池（列表/详情/编辑）
- [ ] Admin：平台自有内容 CMS（专利/需求/成果）
- [ ] Admin：专利托管任务看板（年费日程/托管任务）
- [ ] Admin：告警中心（列表/筛选/确认）

## 3. P0 页面接入（在 1.x 公共能力就绪后批量推进）

> 本阶段不再“各页自由发挥”，而是按模板批量接入并走统一验收。

### 3.1 模板 A（Tab 页）接入

- [x] `pages/home/index`：接入 token/文案/动作级权限态（收藏/咨询/下单）
- [x] `pages/home/index`：快捷入口从 2×2 改为 **4 个一排**（更像微信服务栅格）；图标与文字整体缩小一档（保留 ≥44px 热区）
- [x] `pages/home/index`：快捷入口不保留副标题（只保留标题；副标题移到二级页/详情说明）
- [x] `pages/home/index`：优化 4 个入口按钮（沉睡专利/发明人榜/专利地图/机构展示）的排版与尺寸（优先用 NutUI `Grid` 收口样式）
- [x] `pages/home/index`：品牌副标题文案统一为 `专利点金台`（替换旧文案）
- [x] `pages/home/index`：推荐区标题改为最新专利，移除副标题与右侧更多入口
- [x] `pages/home/index`：入口沉睡专利点击跳转搜索；移除首页对信息流/猜你喜欢入口曝光
- [x] `pages/search/index`：筛选 Popup 交互标准化 + 参数清洗接入
- [x] `pages/search/index`：分类 Tab 扩展：专利交易｜产学研需求｜成果展示｜机构（进入搜索主链路，对齐 `Ipmoney.md` 4）
- [x] `pages/search/index`: Demands/Achievements filters + sort fully aligned (incl. industryTags from GET /public/industry-tags).
- [x] `pages/search/index`: Listing advanced filters (deposit/ipc/loc/legalStatus + industryTags from GET /public/industry-tags) and sort PRICE_ASC/DESC; keep FilterSheet/ChipGroup/FilterSummary aligned with ui-v2-filter-mapping.md.
- [x] `pages/publish/index`：去禁用词 + 权限/审核分支统一
- [x] `pages/messages/index`：空态去禁用词 + 会话列表密度/时间格式化
- [x] `pages/messages/index`: PullToRefresh + conversation cell polish (avatar/title/preview/unread)
- [x] `pages/messages/index`: v2.1 会话列表视觉重做：用 NutUI `Avatar/Badge/Tag/Cell` 收口（更像微信，减少自绘样式）
- [x] `pages/messages/index`: v2.2 会话列表视觉优化：背景/头像/时间/预览统一语义 token，去硬编码，细化密度与对齐
- [x] `pages/me/index`：调试区 dev-only 隔离 + 术语/文案统一

### 3.2 模板 B（List）接入

- [x] `pages/feeds/index`：PageHeader 文案可扫读 + 列表状态机统一
- [x] `pages/favorites/index`：修复“审核未通过卡 Loading”并接入 Permission/Audit 状态
- [x] `pages/orders/index`：修复“审核未通过卡 Loading”并接入 Permission/Audit 状态
- [x] `pages/orders/index`：订单状态 label 映射（STATUS → 中文）
- [x] `pages/orders/index`: Status filter UI refactor to shared FilterSheet/ChipGroup + FilterSummary (align GET /orders?status=).
- [x] `pages/my-listings/index`：修复“审核未通过卡 Loading”+ 状态标签语义统一
- [x] `pages/my-demands/index`：我的需求列表（状态筛选/编辑/下架）
- [x] `pages/my-achievements/index`：我的成果列表（状态筛选/编辑/下架）
- [x] `pages/my-listings/index`：补齐“审核状态筛选”（对齐 `GET /listings?auditStatus=`）
- [x] `pages/my-demands/index`：补齐“审核状态筛选”（对齐 `GET /demands?auditStatus=`）
- [x] `pages/my-achievements/index`：补齐“审核状态筛选”（对齐 `GET /achievements?auditStatus=`）
- [x] `pages/inventors/index`：修复 `q=undefined`（参数清洗）
- [x] `pages/inventors/index`：搜索交互统一（对齐 SearchEntry/清空/回车行为）
- [x] `pages/inventors/index`: Filters UI refactor to shared FilterSheet/ChipGroup + FilterSummary (regionCode + patentType; align GET /search/inventors).
- [x] `pages/organizations/index`：修复 `q=undefined`（参数清洗）
- [x] `pages/organizations/index`：卡片信息密度规范化
- [x] `pages/organizations/index`: Filters UI refactor to shared FilterSheet/ChipGroup + FilterSummary (regionCode + types; align GET /public/organizations).
- [x] `pages/patent-map/index`：空态去禁用词 + 年份切换交互统一

### 3.3 模板 C（Detail）接入

- [x] `pages/listing/detail/index`：首屏信息层级固化 + StickyBar 主次规则
- [x] `pages/listing/detail/index`: v2.1 顶部「分类/标签」区重排（类型/交易/价格类型/特色/地区/行业）用 NutUI `Tag/Space`，避免 MetaPills 堆叠
- [x] `pages/listing/detail/index`: v2.3 顶部卖家/热度信息收口（NutUI `Avatar/Tag/Space`；避免 MetaPills 混用）
- [x] `pages/demand/detail/index`：需求详情页（公开可见；咨询走 IM；对齐 `UI-STD-P0-009` 返回策略 + 状态机）
- [x] `pages/achievement/detail/index`：成果详情页（公开可见；支持图/视频/附件；咨询走 IM；对齐 `UI-STD-P0-009` 返回策略 + 状态机）
- [x] `pages/demand/detail/index`: v2.2 顶部信息区重排（封面/标题/预算/合作方式/行业/地区/发布时间/热度/发布方）优先用 NutUI `Tag/Space/Avatar`
- [x] `pages/achievement/detail/index`: v2.2 顶部信息区重排（封面/标题/成熟度/合作方式/行业/地区/发布时间/热度/发布方）优先用 NutUI `Tag/Space/Avatar`
- [x] `ui/MediaList.tsx`: VIDEO 播放失败兜底（`onError` toast + 复制链接/提示）
- [x] `packages/fixtures/scenarios/happy/index.json`: Demand/Achievement 的视频 URL 去 `example.com`（替换为可播放示例，如 MDN `cc0-videos/flower.mp4`）
- [x] `pages/orders/detail/index`：修复“审核未通过卡 Loading”并接入 Permission/Audit 状态
- [x] `pages/orders/detail/index`：子请求错误态统一（case/refund/invoice）
- [x] `pages/patent/detail/index`：去禁用词 + 枚举可读映射
- [x] `pages/patent/detail/index`: layout polish (MetaPills/SectionHeader) + legalStatus mapping
- [x] `pages/patent/detail/index`: v2.3 顶部信息区收口（NutUI `Tag/Space` + “复制申请号”）
- [x] `pages/patent/detail/index`/`pages/demand/detail/index`/`pages/achievement/detail/index`: 顶部信息栏标签尺寸对齐整体字号（NutUI Tag size token override）
- [x] `pages/demand/detail/index`: UI polish (MetaPills/time formatting) + MediaSection reuse
- [x] `pages/achievement/detail/index`: UI polish (MetaPills/time formatting) + MediaSection reuse
- [x] `pages/organizations/detail/index`：去禁用词 + 详情布局规范化
- [x] `pages/patent-map/region-detail/index`：分块空态规范化 + 缺参兜底口径
- [x] `pages/organizations/detail/index`: v2.4 顶部信息区收口（NutUI `Avatar/Tag/Space`；地区/统计可扫读；移除 MetaPills）
- [x] `pages/patent-map/region-detail/index`: v2.4 顶部信息区收口（NutUI `Tag/Space`；年份/专利数/更新时间；移除 MetaPills）

### 3.4 模板 D（Form/Wizard）接入

- [x] `pages/login/index`：去禁用词 + 登录文案去技术细节 + 跳转策略标准化
- [x] `pages/onboarding/choose-identity/index`：渐变 token 化 + “秒通过/需审核”文案规范化
- [x] `pages/onboarding/verification-form/index`：上传删除二次确认 + 不暴露内部 fileId
- [x] `pages/profile/edit/index`：去禁用词 + 校验/错误展示口径统一
- [x] `pages/region-picker/index`：去禁用词 + SearchEntry 行为语义统一
- [x] `pages/publish/patent/index`：去禁用词 + 上传/确认/提交态统一 + 长表单防丢（P1）
- [x] `pages/publish/demand/index`：需求发布页完整实现（草稿/提交审核/审核中锁定/下架；支持多媒体）
- [x] `pages/publish/achievement/index`：成果发布页完整实现（草稿/提交审核/审核中锁定/下架；支持多媒体）

### 3.5 模板 E（Payment）接入

- [x] `pages/checkout/deposit-pay/index`：H5 不发起支付 + 引导回小程序（微信内 openTag；微信外/桌面 QR+复制链接）
- [x] `pages/checkout/final-pay/index`：补齐 PageHeader；H5 不发起支付 + 引导回小程序（微信内 openTag；微信外/桌面 QR+复制链接）
- [x] `pages/checkout/deposit-success/index`：成功页模板统一（摘要+Steps+下一步）
- [x] `pages/checkout/final-success/index`：同上
- [x] `pages/checkout/deposit-success/index`: v2.4 “订单摘要”用 NutUI `Tag/Space` 收口（移除 MetaPills）
- [x] `pages/checkout/final-success/index`: v2.4 “订单摘要”用 NutUI `Tag/Space` 收口（移除 MetaPills）

### 3.6 模板 F（Chat）接入

- [x] `pages/messages/chat/index`: ScrollView message list + auto scroll to latest
- [x] `pages/messages/chat/index`: createdAt time formatting via `formatTimeSmart()`
- [x] `pages/messages/chat/index`: cursor pagination (load history) + PullToRefresh/load-more UX
- [x] `pages/messages/chat/index`: render message types (TEXT/IMAGE/FILE/SYSTEM) with preview/copy
- [x] `pages/messages/chat/index`: sending state (sending/failed) + retry without losing draft
- [x] `pages/messages/chat/index`: v2.1 UI polish：头像用 NutUI `Avatar`；气泡/时间条密度与配色更接近微信
- [x] `pages/messages/chat/index`: 背景/气泡/系统消息视觉对齐 v2 规范，统一语义 token，去硬编码
- [x] `pages/messages/chat/index`: 吸底输入条背景/分割线使用 `color.bg.page` + `color.border.divider`，H5/WeApp 一致

### 3.7 模板 G（Policy）接入

- [x] `pages/trade-rules/index`：去禁用词 + 可扫读排版（要点化/关键数字强调）
- [x] `pages/trade-rules/index`: v2.4 关键数字/参数展示用 NutUI `Tag/Space` 收口（移除 MetaPills）

## 4. Admin 接入（P0）

- [x] 去禁用词（“演示/Mock fixtures”等）只保留 dev-only
- [x] 危险操作统一二次确认（含原因输入/审计提示）：认证审核、上架审核、订单里程碑、退款、放款、配置变更
- [x] 错误提示统一：可重试 + debug 可展开（与 `RequestErrorAlert` 规范对齐）
- [x] 内容审核范围扩展：支持“需求/成果”审核（接口对齐 OpenAPI：`GET /admin/demands`、`GET /admin/achievements` + approve/reject）
