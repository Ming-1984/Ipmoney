# UI v2 滚动/弹层滚动审计与优化计划（Client + Admin）

> 目标：系统性梳理页面与弹层的滚动行为，避免“无法滚动/滚动穿透/内容被遮挡”等问题。  
> 关联文档：`docs/engineering/ui-v2-overlay-router-dom.md`、`docs/engineering/ui-v2-qa-checklist.md`、`docs/engineering/ui-v2-spec.md`

## 1. 系统扫描结果（基于代码检索）

### 1.1 Client（Taro H5/WeApp）

- 全局 overlay：`apps/client/src/ui/nutui/AppOverlays.tsx`（`Dialog/Toast` + H5 portal 到 `body`）
- Popup/Sheet：`apps/client/src/ui/filters/FilterSheet.tsx`、`apps/client/src/ui/filters/SortSheet.tsx`、`apps/client/src/pages/orders/detail/index.tsx`
- 滚动容器：`ScrollView` 仅在 `pages/messages/chat/index.tsx` 使用；`PullToRefresh` 用于 `pages/messages/index.tsx` 和 `pages/messages/chat/index.tsx`
- 样式提示：`.chat-scroll` 已使用；`.filter-popup-scroll` 仅定义未使用；`.container` 默认 `min-height: 100vh`（在 Popup 内复用时可能撑高）

### 1.2 Admin（React + Ant Design）

- `Modal.confirm`：`apps/admin-web/src/ui/confirm.tsx`，以及 `apps/admin-web/src/views/RegionsPage.tsx`
- 普通 `Modal`：`apps/admin-web/src/views/ListingsAuditPage.tsx`、`apps/admin-web/src/views/RegionsPage.tsx`
- 当前未统一 `Modal` 的 `bodyStyle/maxHeight/overflow` 规则

### 1.3 组件能力（本地类型定义）

- NutUI Popup/Overlay 具备 `lockScroll`、`closeOnOverlayClick`、`zIndex` 等能力（`@nutui/nutui-react-taro` types）
- Popup 支持 `minHeight`、`resizable`、`destroyOnClose` 等属性，可用于弹层滚动与安全区适配

## 2. 成熟组件策略（不引入新弹层库）

- Client：优先使用 `@nutui/nutui-react-taro` 的 `Popup/Dialog/ActionSheet/Toast/PullToRefresh`，必要滚动使用 Taro `ScrollView`
- Admin：优先使用 Ant Design `Modal/Drawer/Table`，通过统一封装处理滚动与遮罩行为

## 3. P0 滚动规则（待对齐后落地）

- **单一滚动根**：页面仅保留一个主滚动容器（`page/body/.taro_page` 或 `ScrollView`），避免嵌套滚动导致手势冲突
- **弹层锁滚**：弹层开启时锁定背景滚动（NutUI `lockScroll` / AntD `mask`），关闭后恢复
- **弹层内滚动**：内容超出视口时，弹层内部必须可滚动（`max-height + overflow-y: auto`），并预留安全区
- **避免复用 `.container`**：Popup 内避免直接复用 `min-height: 100vh` 的容器类，改用专用弹层内容容器
- **列表/聊天特例**：聊天页保留 `ScrollView` + 输入框固定；列表页尽量使用页面滚动 + `PullToRefresh`（避免双滚）
- **桌面 H5**：保持“居中手机宽度”策略，弹层宽度与内容区一致，避免全屏溢出造成滚动错乱

## 4. 风险点与待验证项

- FilterSheet/SortSheet/OrderDetail Popup 复用 `.container`，可能导致弹层高度异常与滚动失效
- `PullToRefresh` + `ScrollView` 组合需验证滚动容器高度/手势优先级
- Admin `Modal` 未限定 body 高度，长内容可能溢出视口
- H5 弹层锁滚/解锁在不同浏览器表现需实测（WeChat/iOS/Safari）

## 5. 计划任务映射

详见 `docs/ui-v2-todo.md` 中 “UI-STD-P0-013：页面滚动/弹层滚动统一”。
