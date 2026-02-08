# 前端设计系统（橙色主题 +「专利点金台」理念）

> 目标：在小程序/H5/后台形成一致的品牌识别；同时把“成功/成交”与“价值点金（点金台）”做成**克制、专业**的视觉语言。

## 1. 品牌理念（对外可讲）

- **主色：橙色**——寓意成功、收获、成交，适合交易平台的“行动号召”场景（按钮/高亮/关键数据）。
- **平台隐喻：「专利点金台」**——把专利价值转化为可交易、可量化的收益；视觉用“点金火花/金光纹理/炼金线条”做轻量点缀，避免过度拟物或低俗化。

## 1.1 Logo（资源与使用）

- 多端资源路径：
  - 用户端（Taro）：`apps/client/src/assets/brand/logo.gif`
  - 后台（Admin Web）：`apps/admin-web/src/assets/brand/logo.gif`
- TabBar 图标（小程序可用 PNG）：`apps/client/src/assets/tabbar/*`（生成脚本：`scripts/generate-tabbar-icons.ps1`）

## 2. 色彩（建议 Token）

> 具体落地时以 Ant Design/NutUI 的主题变量为准；以下为推荐值。

- `colorPrimary`：`#FF6A00`（更浓厚主橙）
- `colorPrimaryHover`：`#FF7A00`
- `colorPrimaryActive`：`#E85A00`
- `colorGold`：`#FFC54D`（金豆点缀：徽标/插画/高光）
- `bgPage`：`#FFF3E6`（浅暖背景）
- `textPrimary`：`#0F172A`
- `textSecondary`：`#475569`
- `border`：`#E2E8F0`
- 状态色：
  - `success`：`#16A34A`
  - `warning`：`#F59E0B`
  - `error`：`#DC2626`

## 3. 组件风格（最低成本可复用）

- **卡片（Listing Card）**：信息密度高但留白，右上角可用“金豆/矿脉”小徽标表示“推荐/特色产业”；标签区补充转让次数标签。
- **按钮**：
  - 主按钮：橙色填充（下单/支付/提交）
  - 次按钮：描边（收藏/咨询/查看进度）
  - 危险按钮：红色（取消/退款等）
- **标签**：
  - 认证标签：企业/科研院校/政府/协会/技术经理人
  - 状态标签：审核中/已通过/已驳回（后台可见驳回原因）
  - 地域特色：同城/同省、特色产业（省/市级）
  - 转让次数：沉睡专利（transferCount=0）/转让 X 次

## 4. 交互状态（必须可演示）

统一要求：每个页面都具备并可演示以下状态（可由 Mock 场景触发）：

- **loading**：骨架屏（可用“挖矿进度条/金豆闪烁”做轻点缀）
- **empty**：空态插画 + 明确下一步（去搜索/去发布/去认证）
- **error**：错误码/提示 + 重试/联系客服；支付/退款/回调类错误优先给“可解释”文案
- **permission**：未登录/无权限/未认证 → 引导登录/提交认证/联系管理员
- **audit**：审核中/驳回（带原因）/通过（展示身份标签与机构入口）

空态插画映射（Client 小程序/H5）：
- 评论区：`empty-comments.svg`（标题：暂无评价）
- 订单列表：`empty-orders.svg`（标题：暂无订单）
- 收藏列表：`empty-favorites.svg`（标题：暂无收藏）
- 发票中心：`empty-invoices.svg`（标题：暂无发票）
- 消息列表：`empty-messages.svg`（标题：暂无消息）
- 会话详情：`empty-chat.svg`（标题：暂无会话消息）

## 5. 多端落地建议

- **Admin（React + Ant Design）**：用 AntD 主题 token 设置 `colorPrimary=#FF6A00`；重要操作页（退款/放款/配置）强化审计提示与二次确认。
- **用户端（Taro 小程序 + H5）**：优先选成熟 UI 组件库（降低开发成本），以 CSS 变量/主题变量统一橙色主色；H5 与小程序保持同构布局与交互。
