# Demo Rendered（PNG/PDF/SVG）

本目录为 `docs/demo/diagrams/*.mmd` 与 `docs/demo/pages/**/*.mmd` 的导出产物，主要用于甲方演示与评审。

推荐：优先使用 `*.svg`（矢量放大不糊）；需要位图时使用 `*.png`；打印/对外发版可使用 `*.pdf`。

## 演示图（docs/demo/diagrams/*.mmd）

- 业务主链路泳道：`business-core-swimlane.*`
- 退款/争议泳道：`business-refund-dispute-swimlane.*`
- P0 逻辑架构（模块化单体，可拆分）：`architecture-p0-logical.*`
- 目标微服务架构（长期演进）：`architecture-target-microservices.*`
- 生产部署图：`deployment-prod.*`
- 资金/数据流与安全边界：`dataflow-money-pii-security.*`
- 事件模型（幂等/重试/对账）：`event-model.*`

## 页面功能图（docs/demo/pages/**）

- 小程序 01–15：`01-login.*` ... `15-publish-achievement.*`
- 后台页面：`01-dashboard.*` ... `08-system-settings.*`
- 小程序 01–15 合成单图：`miniapp-pages-01-15.png`
  - 如需预览小文件：可使用 `miniapp-pages-01-15-preview.jpg`（低清预览用）

## 生成方式

- 一键导出：`powershell -ExecutionPolicy Bypass -File scripts/render-diagrams.ps1`
- 只要 PNG/PDF：`powershell -ExecutionPolicy Bypass -File scripts/render-diagrams.ps1 -NoSvg`
- 合成小程序 01–15：`python scripts/merge-miniapp-pages.py --mode grid --columns 5 --margin 6 --max-total-pixels 170000000`

