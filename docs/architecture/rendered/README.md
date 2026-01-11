# Rendered Diagrams（PNG/PDF/SVG）

本目录为 Mermaid 图的导出产物（用于 PPT/标书/评审）。

推荐：优先使用 `*.svg`（矢量放大不糊）；需要位图时使用 `*.png`；打印/对外发版可使用 `*.pdf`。

## 工程图（docs/architecture/*.mmd）

- C4-Context：`c4-context.svg` / `c4-context.png` / `c4-context.pdf`
- C4-Container：`c4-container.svg` / `c4-container.png` / `c4-container.pdf`
- C4-Component（Order）：`c4-component-order.svg` / `c4-component-order.png` / `c4-component-order.pdf`
- 时序-支付订金：`sequence-deposit-payment.svg` / `sequence-deposit-payment.png` / `sequence-deposit-payment.pdf`
- 时序-退款：`sequence-refund.svg` / `sequence-refund.png` / `sequence-refund.pdf`
- 时序-结算放款：`sequence-settlement.svg` / `sequence-settlement.png` / `sequence-settlement.pdf`
- 业务流程-发布上架：`flow-listing-publish.svg` / `flow-listing-publish.png` / `flow-listing-publish.pdf`
- 业务流程-交易主链路：`flow-trade-end2end.svg` / `flow-trade-end2end.png` / `flow-trade-end2end.pdf`
- 业务流程-退款/争议：`flow-refund-dispute.svg` / `flow-refund-dispute.png` / `flow-refund-dispute.pdf`
- 状态机-订单：`state-order.svg` / `state-order.png` / `state-order.pdf`
- ER：`er-diagram.svg` / `er-diagram.png` / `er-diagram.pdf`

## 生成方式

- 一键导出：`powershell -ExecutionPolicy Bypass -File scripts/render-diagrams.ps1`
- 只要 PNG/PDF：`powershell -ExecutionPolicy Bypass -File scripts/render-diagrams.ps1 -NoSvg`

