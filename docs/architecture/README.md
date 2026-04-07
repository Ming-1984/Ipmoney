# 架构图与流程图（Mermaid）

本目录是项目对外对齐的架构源文件目录，统一使用 `.mmd`（Mermaid）维护。

## 一、图表索引（按用途）

### 1) 总体架构（对甲方主讲）
- `c4-context.mmd`：系统上下文图（角色、终端、平台、外部系统）
- `c4-container.mmd`：容器图（客户端、API、数据层、第三方）
- `c4-component-api-core.mmd`：API 核心模块分层图（按领域模块）
- `c4-component-order.mmd`：订单域组件图（状态机、退款、结算、发票）
- `deployment-p0-runtime.mmd`：P0 运行部署拓扑图
- `dataflow-funds-security.mmd`：资金与安全控制数据流图

### 2) 业务流程图
- `flow-trade-end2end.mmd`：交易主链路（上架 -> 订金 -> 合同 -> 尾款 -> 过户 -> 结算）
- `flow-refund-dispute.mmd`：退款与争议处理流程
- `flow-listing-publish.mmd`：上架发布流程
- `flow-user-center.mmd`：用户中心流程
- `flow-support.mmd`：客服中心与会话协作流程
- `flow-order-list-tabs.mmd`：订单列表分组过滤流程
- `flow-contract-invoice-upload.mmd`：合同与发票上传流程
- `home-banner-local-media.mmd`：首页本地视频资源加载流程

### 3) 时序/状态/数据模型
- `sequence-deposit-payment.mmd`：订金支付时序
- `sequence-refund.mmd`：退款时序
- `sequence-settlement.mmd`：结算与放款时序
- `sequence-wechat-login-onboarding.mmd`：微信登录与新手引导时序
- `sequence-wechat-phone-bind.mmd`：微信手机号绑定时序
- `state-order.mmd`：订单状态机
- `er-diagram-cn.mmd`：核心域 ER 图（中文对外版，统一对接口径）
- `er-diagram-client-brief.md`：ER 图甲方讲解文档（含中英实体对照、关系翻译、全量字段中文注释）

## 二、中文显示与换行规范

- 所有 `.mmd` 文件统一 `UTF-8` 编码。
- 每个文件第一行均带 `%%{init: ...}%%`，统一中文字体链，避免乱码。
- 需要强制换行时，使用 `<br/>`，避免依赖自动换行导致不同环境展示漂移。
- 节点文案尽量控制在“短语 + 1 行说明”，减少图形过宽。

## 三、预览与编辑

- Cursor / VS Code 安装 Mermaid 插件可直接预览 `.mmd`。
- 也可使用 Mermaid Live Editor 临时预览。

## 四、导出图片（推荐）

### 单图导出

```bash
npx -y @mermaid-js/mermaid-cli -i docs/architecture/c4-context.mmd -o docs/architecture/rendered/c4-context.svg -b white
```

### 批量导出（架构目录）

```bash
powershell -ExecutionPolicy Bypass -File scripts/render-diagrams.ps1
```

导出产物默认在：`docs/architecture/rendered/`（`png` / `pdf` / `svg`）。

## 五、甲方对接文档（唯一版本）

- Markdown：`docs/architecture/client-handover-mini-program-admin.md`
- PDF：`docs/architecture/client-handover-mini-program-admin.pdf`
- 说明：上述 `md` 与 `pdf` 属于同一份文档的两种格式，请仅以这组文件作为对外对接版本。

### 重新导出 PDF

```bash
powershell -ExecutionPolicy Bypass -File scripts/build-client-handover.ps1
```
