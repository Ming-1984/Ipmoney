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
- [ ] 定义 Action 级访问策略（按钮/入口级）：同上（用于 Home/Search/Feeds 等“可看但不可操作”页面）
- [x] 产出“页面状态机接入指南”：`docs/engineering/ui-v2-state-machine-guide.md`
- [ ] 验收：未登录/未选身份/审核未通过时，不出现“卡 Loading/空白”

### 1.3 UI-STD-P0-005：路由参数缺参兜底标准化（Client + Admin）

- [ ] 定义统一缺参文案模板（参数缺失/返回/刷新）
- [ ] 定义参数解析规则：string/number/uuid 校验（不合格进入缺参兜底）
- [ ] 验收：任意 `?xxxId=` 深链缺参访问可自恢复，不白屏

### 1.4 UI-STD-P0-006：Overlay/Router DOM 结构验收用例（Client H5）

- [x] H5 入口兜底：根路径/空 hash 自动跳转到首页（避免直接访问根 URL 白屏）
- [ ] 固化“路由 DOM 结构”验收脚本/检查项（避免 overlay 影响 `.taro_page` 展示）
- [ ] 固化“新增弹层库接入清单”（portal/teleport 的挂载点与层级）
- [ ] 验收：新增弹层/Toast/Dialog 后，页面切换不闪白、不被隐藏

### 1.5 UI-STD-P0-002：文案治理（Client + Admin）

- [ ] 建立“禁用词扫描清单”（P0/演示/Mock/HTTP/undefined 等）
- [ ] 统一术语表（收藏/咨询/订金/尾款/认证/审核等）并替换全站
- [ ] 统一状态文案模板（loading/empty/error/permission/audit）
- [ ] 验收：用户可见区域 0 禁用词；空态/错误态都有下一步动作

### 1.6 UI-STD-P0-001：Token 去硬编码（Client + Admin）

- [ ] 产出 Token 映射表（语义 token → Client CSS 变量 / Admin AntD token）
- [ ] 建立硬编码白名单（允许的例外：Logo 渐变/第三方组件必要值等，必须登记）
- [ ] 验收：页面/组件层面硬编码颜色/字号/间距显著收敛，新增代码禁止再引入

### 1.7 UI-STD-P0-007：密度与桌面（Client H5）【你已确认：居中手机宽度】

> 目标：在桌面浏览器访问 H5 时，不出现“组件被放大/留白过松/TabBar 与内容不对齐”等观感问题；同时不影响小程序端。

- [x] ≥768px：锁定 `html` 根字号（不随屏幕放大），保持与手机端一致的视觉比例
- [x] ≥768px：将 `#app/.taro-tabbar__container` 限制为手机宽度并居中（max 430px），页面背景铺满但内容区居中
- [x] ≥768px：固定层对齐（StickyBar/底部 TabBar/ChatInput）必须与内容区同宽同中心（不允许全屏铺开）
- [x] 密度：整体字号/图标/间距做一次“克制缩放”，信息密度提升但不牺牲可读性
- [x] 组件：NutUI 基础字号与 Cell/CellGroup 的 padding/margin 统一收紧（避免“过松/过大”）
- [x] 修正 H5 全局缩放：将 `apps/client/config/index.ts` 的 `designWidth` 调整为 `750`（对齐微信 rpx 语义：`88rpx≈44px`），并回归验证 H5/小程序的视觉与热区一致性
- [ ] 验收：同一页面在手机与桌面 H5 展示的字号/间距观感一致；桌面端不再“巨字/巨控件”

### 1.8 模板化 A–G（Client）

- [ ] 定义并固化模板：A Tab / B List / C Detail+Sticky / D Form / E Payment / F Chat / G Policy
- [ ] 固化“每模板的必备插槽与禁用项”（例如同屏只能 1 个 primary CTA）
- [ ] 验收：任意新页面按模板开发，不需要重新讨论布局与状态机

## 2. P1（体系级）— 强体验与效率（在 P0 之后）

### 2.1 统一请求缓存/分页/刷新（Client）

- [ ] 决策：TanStack Query / 继续现有 hooks / 自研最小缓存层
- [ ] 列表页标准：首屏骨架 + 分页加载 + 下拉刷新 + 过期请求丢弃

### 2.2 统一格式化（Client + Admin）

- [ ] 金额（分/元）、时间（ISO → 可读）、枚举 label、地区码→名称 的统一工具与口径

### 2.3 响应式与可访问性（Client H5）

- [ ] ≥768px 布局规则（**居中手机宽度**、固定层对齐、避免字体随屏幕放大；双列/宽屏响应式作为 P2 可选）
- [ ] A11y 基线（触控热区、对比度、focus-visible、键盘回车）

## 3. P0 页面接入（在 1.x 公共能力就绪后批量推进）

> 本阶段不再“各页自由发挥”，而是按模板批量接入并走统一验收。

### 3.1 模板 A（Tab 页）接入

- [ ] `pages/home/index`：接入 token/文案/动作级权限态（收藏/咨询/下单）
- [x] `pages/home/index`：快捷入口从 2×2 改为 **4 个一排**（更像微信服务栅格）；图标与文字整体缩小一档（保留 ≥44px 热区）
- [x] `pages/home/index`：快捷入口不保留副标题（只保留标题；副标题移到二级页/详情说明）
- [ ] `pages/search/index`：筛选 Popup 交互标准化 + 参数清洗接入
- [ ] `pages/publish/index`：去禁用词 + 权限/审核分支统一
- [ ] `pages/messages/index`：空态去禁用词 + 会话列表密度/时间格式化
- [ ] `pages/me/index`：调试区 dev-only 隔离 + 术语/文案统一

### 3.2 模板 B（List）接入

- [ ] `pages/feeds/index`：PageHeader 文案可扫读 + 列表状态机统一
- [x] `pages/favorites/index`：修复“审核未通过卡 Loading”并接入 Permission/Audit 状态
- [x] `pages/orders/index`：修复“审核未通过卡 Loading”并接入 Permission/Audit 状态
- [ ] `pages/orders/index`：订单状态 label 映射（STATUS → 中文）
- [x] `pages/my-listings/index`：修复“审核未通过卡 Loading”+ 状态标签语义统一
- [x] `pages/inventors/index`：修复 `q=undefined`（参数清洗）
- [ ] `pages/inventors/index`：搜索交互统一（对齐 SearchEntry/清空/回车行为）
- [x] `pages/organizations/index`：修复 `q=undefined`（参数清洗）
- [ ] `pages/organizations/index`：卡片信息密度规范化
- [ ] `pages/patent-map/index`：空态去禁用词 + 年份切换交互统一

### 3.3 模板 C（Detail）接入

- [ ] `pages/listing/detail/index`：首屏信息层级固化 + StickyBar 主次规则
- [x] `pages/orders/detail/index`：修复“审核未通过卡 Loading”并接入 Permission/Audit 状态
- [ ] `pages/orders/detail/index`：子请求错误态统一（case/refund/invoice）
- [ ] `pages/patent/detail/index`：去禁用词 + 枚举可读映射
- [ ] `pages/organizations/detail/index`：去禁用词 + 详情布局规范化
- [ ] `pages/patent-map/region-detail/index`：分块空态规范化 + 缺参兜底口径

### 3.4 模板 D（Form/Wizard）接入

- [ ] `pages/login/index`：去禁用词 + 登录文案去技术细节 + 跳转策略标准化
- [ ] `pages/onboarding/choose-identity/index`：渐变 token 化 + “秒通过/需审核”文案规范化
- [ ] `pages/onboarding/verification-form/index`：上传删除二次确认 + 不暴露内部 fileId
- [ ] `pages/profile/edit/index`：去禁用词 + 校验/错误展示口径统一
- [ ] `pages/region-picker/index`：去禁用词 + SearchEntry 行为语义统一
- [ ] `pages/publish/patent/index`：去禁用词 + 上传/确认/提交态统一 + 长表单防丢（P1）
- [ ] `pages/publish/demand/index`：占位页也按状态机/权限态规范呈现
- [ ] `pages/publish/achievement/index`：占位页同上

### 3.5 模板 E（Payment）接入

- [ ] `pages/checkout/deposit-pay/index`：说明文案可扫读 + CTA 主次统一
- [ ] `pages/checkout/final-pay/index`：补齐 PageHeader/说明模板一致性
- [ ] `pages/checkout/deposit-success/index`：成功页模板统一（摘要+Steps+下一步）
- [ ] `pages/checkout/final-success/index`：同上

### 3.6 模板 F（Chat）接入

- [ ] `pages/messages/chat/index`：时间格式化 + 失败反馈文案/交互统一

### 3.7 模板 G（Policy）接入

- [ ] `pages/trade-rules/index`：去禁用词 + 可扫读排版（要点化/关键数字强调）

## 4. Admin 接入（P0）

- [ ] 去禁用词（“演示/Mock fixtures”等）只保留 dev-only
- [ ] 危险操作统一二次确认（含原因输入/审计提示）：认证审核、上架审核、订单里程碑、退款、放款、配置变更
- [ ] 错误提示统一：可重试 + debug 可展开（与 `RequestErrorAlert` 规范对齐）
