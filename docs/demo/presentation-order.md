# 甲方演示顺序（建议）

## 1) 先讲清楚“做什么/不做什么”

- 一页说明：`docs/demo/platform-onepager.md`
- FAQ（可选，用于现场答疑）：`docs/demo/faq.md`

## 2) 再讲“业务怎么跑”

- 业务主链路泳道逻辑图（推荐）：`docs/demo/diagrams/business-core-swimlane.mmd`
- 退款/争议泳道逻辑图（推荐）：`docs/demo/diagrams/business-refund-dispute-swimlane.mmd`
-（工程细节补充，可选）端到端主链路：`docs/architecture/flow-trade-end2end.mmd`
-（工程细节补充，可选）上架发布/审核：`docs/architecture/flow-listing-publish.mmd`
-（工程细节补充，可选）退款/争议工单：`docs/architecture/flow-refund-dispute.mmd`
-（工程细节补充，可选）订单状态机：`docs/architecture/state-order.mmd`

## 3) 最后讲“系统怎么做（可拆微服务）”

- P0 逻辑架构（模块化单体，可拆分）：`docs/demo/diagrams/architecture-p0-logical.mmd`
- 目标微服务架构（长期演进）：`docs/demo/diagrams/architecture-target-microservices.mmd`
-（C4 补充，可选）C4-Context：`docs/architecture/c4-context.mmd`
-（C4 补充，可选）C4-Container：`docs/architecture/c4-container.mmd`
-（C4 补充，可选）C4-Component（订单域示例）：`docs/architecture/c4-component-order.mmd`

## 3.5) 部署与安全边界（甲方常问）

- 生产部署图：`docs/demo/diagrams/deployment-prod.mmd`
- 资金流/数据流与安全边界：`docs/demo/diagrams/dataflow-money-pii-security.mmd`
- 事件模型（幂等/重试/对账）：`docs/demo/diagrams/event-model.mmd`

## 4) 关键资金链路（最容易产生争议的部分）

- 支付订金：`docs/architecture/sequence-deposit-payment.mmd`
- 退款：`docs/architecture/sequence-refund.mmd`
- 结算/放款：`docs/architecture/sequence-settlement.mmd`

## 5) 数据结构与接口

- ER：`docs/architecture/er-diagram.mmd`
- OpenAPI：`docs/api/openapi.yaml`（预览见 `docs/api/README.md`）
