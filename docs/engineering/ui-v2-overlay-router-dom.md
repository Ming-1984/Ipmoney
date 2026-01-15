# UI v2 · H5 Overlay / Router DOM 验收

> 目标：避免「新增 Toast/Dialog/Popup/Portal 后出现白屏/闪白」这类 Taro H5 常见问题。

## 1. 背景（为何会白屏）

Taro H5 运行时会在页面根节点下生成类似 `.taro_router` / `.taro_page` 的 DOM 结构；部分版本/样式规则会对「最后一个页面节点」做显示控制（例如基于 `:last-child` 或类似选择器）。

如果某个弹层库把 DOM **插入到 `.taro_router` 内部并排在 `.taro_page` 之后**，就可能导致：

- `.taro_page` 不再是最后一个子元素 → 页面被隐藏 → 白屏/闪白
- 页面切换时 overlay 节点残留/重排 → 页面偶现不可见

## 2. 强约束（必须遵守）

- **所有 overlay（Toast/Dialog/Popup/ActionSheet 等）必须挂在 App 根部**（例如 `apps/client/src/app.tsx` 的 `AppOverlays`），不要在页面内随处渲染。
- 任何 portal/teleport/appendTo 机制：**挂载点必须在 `.taro_router` 外部**（推荐挂到 `#app` 根或 `document.body`）。
- 若引入新弹层库：必须明确其「挂载点」「层级（z-index）」「滚动锁定」「输入法/键盘」行为。

## 3. 自动检查（开发态）

在 H5 开发态，应用会安装一个轻量的 DOM guard：  
`apps/client/src/lib/h5DomGuard.ts`（由 `apps/client/src/app.tsx` 在启动时安装）会在路由切换/DOM 变更后检测 `.taro_router` / `.taro_page` 与 overlay 容器位置，如果发现高风险结构会输出控制台告警：

- `.taro_router 下未找到 .taro_page`
- `.taro_router 的最后一个子元素不是 .taro_page`
- `Overlay 容器 #app-toast/#app-dialog 位于 .taro_router 内`
- `当前页面容器可能被隐藏（display/visibility）`

出现告警时，优先排查「新增弹层/portal 是否插入了 `.taro_router`」。

## 4. 手工验收步骤（每次引入弹层库/改动 overlay 都要做）

1. 运行 `./scripts/demo.ps1`（或仅启动 client）。
2. 在浏览器打开 `http://127.0.0.1:5173/`，在控制台确认没有 `[dom-guard]` 警告。
3. 逐页跳转 10 次（Tab 切换 + 详情页/发布页/登录页互跳），确保：
   - 无白屏/闪白
   - Toast/Dialog/Popup 出现后不影响页面可见
4. 打开一个 Dialog/Toast 后，再进行路由跳转（返回/切换 Tab），确保：
   - 页面仍可见
   - 弹层不会残留遮挡

## 5. 新弹层库接入清单（Portal/Teleport）

对每个新弹层库，至少确认：

- **挂载点**：是否支持 `appendTo` / `teleport`？目标是否能设为 `body` 或 `#app`？
- **DOM 位置**：渲染后是否出现在 `.taro_router` 内部（禁止）？
- **z-index 层级**：是否覆盖 TabBar/StickyBar？是否需要分层规范？
- **滚动锁定**：弹层打开后是否锁住页面滚动？关闭是否恢复？
- **输入法行为**：输入框聚焦时是否被遮挡？是否抖动？
- **无障碍/热区**：关闭按钮热区≥44px、背景点击是否可关闭、是否有二次确认。
