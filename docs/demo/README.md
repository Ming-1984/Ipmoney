# 甲方演示包（Demo）

本目录面向甲方演示与评审，输出“可讲清楚业务、可证明可落地”的图表与说明。

## 文件清单

- 一页定位与关键规则：`docs/demo/platform-onepager.md`
- 演示顺序（建议话术顺序）：`docs/demo/presentation-order.md`
- 高端图表（代码生成，Mermaid）：`docs/demo/diagrams/`
  - 业务主链路泳道：`docs/demo/diagrams/business-core-swimlane.mmd`
  - 退款/争议泳道：`docs/demo/diagrams/business-refund-dispute-swimlane.mmd`
  - P0 逻辑架构（模块化单体，可拆分）：`docs/demo/diagrams/architecture-p0-logical.mmd`
  - 目标微服务架构：`docs/demo/diagrams/architecture-target-microservices.mmd`
  - 生产部署图：`docs/demo/diagrams/deployment-prod.mmd`
  - 资金/数据流与安全边界：`docs/demo/diagrams/dataflow-money-pii-security.mmd`
  - 事件模型：`docs/demo/diagrams/event-model.mmd`
- FAQ：`docs/demo/faq.md`
- 页面功能图（从 PRD 提炼）：`docs/demo/pages/README.md`

## 导出 PNG/PDF（用于 PPT/标书）

前置：本机已安装 Node.js（含 `npx`）。

- 一键导出（架构图 + 演示图，PNG/PDF/SVG）：`powershell -ExecutionPolicy Bypass -File scripts/render-diagrams.ps1`

输出目录：
- 工程图：`docs/architecture/rendered/`
- 演示图：`docs/demo/rendered/`
