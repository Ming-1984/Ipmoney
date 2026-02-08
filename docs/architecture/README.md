# 架构与流程图（Mermaid）

本目录下的 `.mmd` 文件均为 Mermaid 图（C4 / 时序 / ER / 业务流程）。

## 预览方式（推荐）

- Cursor / VS Code：安装 Mermaid 预览插件后，打开 `.mmd` 文件进行预览。
- 在线：复制内容到 Mermaid Live Editor（适合临时查看，不适合含敏感信息的图）。

## 导出 PNG/PDF（用于 PPT/标书）

前置：本机已安装 Node.js（含 `npx`）。

- 导出单个 PNG：
  - `npx -y @mermaid-js/mermaid-cli -i docs/architecture/c4-context.mmd -o docs/architecture/rendered/c4-context.png -b white`
- 导出单个 PDF：
  - `npx -y @mermaid-js/mermaid-cli -i docs/architecture/c4-context.mmd -o docs/architecture/rendered/c4-context.pdf`
- 导出单个 SVG（矢量，适合放大不糊）：
  - `npx -y @mermaid-js/mermaid-cli -i docs/architecture/c4-context.mmd -o docs/architecture/rendered/c4-context.svg -b white`
- 批量导出（推荐）：
  - `powershell -ExecutionPolicy Bypass -File scripts/render-diagrams.ps1`
  - 如需透明底 PNG（用于叠加到 PPT）：`powershell -ExecutionPolicy Bypass -File scripts/render-diagrams.ps1 -PngBackground transparent`
  - 高清 PNG（默认 `-PngScale 6`；更大可设 8/10）：`powershell -ExecutionPolicy Bypass -File scripts/render-diagrams.ps1 -PngScale 8`
  - 图较大导致文字偏小：可增大画布（配合裁切居中）：`powershell -ExecutionPolicy Bypass -File scripts/render-diagrams.ps1 -PngWidth 2400 -PngHeight 2400`
  - 默认会对 PNG 做“居中排版”（裁切空白 + 等边距留白）；如需关闭：`powershell -ExecutionPolicy Bypass -File scripts/render-diagrams.ps1 -NoNormalizePng`
  - PDF 默认 `fit` 适配页面（更适合打印/预览）；如需关闭：`powershell -ExecutionPolicy Bypass -File scripts/render-diagrams.ps1 -NoPdfFit`
  - 默认同时导出 SVG（矢量）；如需关闭：`powershell -ExecutionPolicy Bypass -File scripts/render-diagrams.ps1 -NoSvg`

输出目录：
- 工程图：`docs/architecture/rendered/`
- 演示图：`docs/demo/rendered/`

说明：
- 第一次运行 `@mermaid-js/mermaid-cli` 可能会下载 Chromium，耗时较长属正常现象。


## 新增
- `flow-user-center.mmd`：用户中心（我的）导航与分区流程图
- `flow-order-list-tabs.mmd`：订单列表 Tab（聚合筛选）与 statusGroup 映射
- `flow-support.mmd`：客服中心（帮助与反馈）FAQ/电话客服流程
- `flow-contract-invoice-upload.mmd`：合同/发票上传流程（卖家/财务权限）
- `sequence-wechat-phone-bind.mmd`：微信手机号授权绑定时序
- `sequence-wechat-login-onboarding.mmd`：微信登录 → 手机号授权弹窗 → 身份选择时序
