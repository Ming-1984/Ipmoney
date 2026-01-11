# 甲方演示运行手册（P0 骨架 + Mock 驱动）

## 1. 一键启动

前置：Node 20 + pnpm（建议执行仓库根目录的快速开始：`README.md`）。

- 单终端启动（推荐）：
  - `powershell -ExecutionPolicy Bypass -File scripts/demo.ps1`
- 同时打开 OpenAPI 预览（可选）：
  - `powershell -ExecutionPolicy Bypass -File scripts/demo.ps1 -OpenApiPreview`
- 分窗口启动（可选）：
  - `powershell -ExecutionPolicy Bypass -File scripts/demo.ps1 -SplitWindows -OpenApiPreview`

启动后地址：

- Mock API：`http://127.0.0.1:4010`
- 用户端 H5：`http://127.0.0.1:5173`
- 管理后台：`http://127.0.0.1:5174`
- OpenAPI（可选）：`http://127.0.0.1:8080`

## 2. 场景切换（最省时间的“难场景覆盖”）

- 用户端（小程序/H5）：进入「我的」页 → 切换 Mock 场景
- 管理后台：顶部右侧「场景」下拉切换

可用场景（以当前 fixtures 为准）：

- `happy`：正常数据
- `empty`：空数据
- `edge`：边界数据
- `error`：服务异常
- `payment_callback_replay`：支付意图幂等冲突（409）
- `refund_failed`：退款审批通过失败（409）
- `order_conflict`：订单里程碑非法跳转（409）

## 3. 演示顺序（建议）

### A. 用户端（H5/小程序同构）

1. 首页：`专利变金豆矿` → 进入信息流/地图/检索
2. 信息流（猜你喜欢）：展示推荐分、热度、地域特色置顶字段（演示）
3. 检索：游客可看列表/详情；收藏/咨询/下单需登录
4. 发明人榜：按平台内上传专利统计
5. 详情页：进入咨询（会话）/支付订金
6. 订金支付链路：创建订单 → 创建支付意图 → 成功页（演示）
7. 咨询/消息：会话列表 → 进入会话 → 发送/刷新（非实时，P0）
8. 发布：选择发布类型（专利/需求/成果）→ 表单占位 → 提交审核（演示）

### B. 管理后台（PC Web）

1. 认证审核：通过/驳回（演示）
2. 上架审核：通过/驳回（演示）
3. 订单：合同确认/变更完成（里程碑，演示）
4. 退款：审批通过/驳回；切 `refund_failed` 演示失败提示
5. 放款/结算：上传凭证 → 确认放款（演示）
6. 发票：上传/删除（演示；P0 为线下开票后上传附件）
7. 配置：交易规则 + 推荐权重（演示）
8. 专利地图 CMS：录入/更新区域专利数量结构（演示）
