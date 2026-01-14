# 甲方演示运行手册（P0 骨架 + Mock 驱动）

## 1. 一键启动

前置：Node 20 + pnpm（建议执行仓库根目录的快速开始：`README.md`）。

- 单终端启动（推荐）：
  - `powershell -ExecutionPolicy Bypass -File scripts/demo.ps1`
- 演示/调试：显示「场景切换」入口（可选）：
  - `powershell -ExecutionPolicy Bypass -File scripts/demo.ps1 -EnableMockTools`
- 同时打开 OpenAPI 预览（可选）：
  - `powershell -ExecutionPolicy Bypass -File scripts/demo.ps1 -OpenApiPreview`
- 分窗口启动（可选）：
  - `powershell -ExecutionPolicy Bypass -File scripts/demo.ps1 -SplitWindows -OpenApiPreview`

启动后地址：

- 默认端口：
  - Mock API：`http://127.0.0.1:4010`
  - 用户端 H5：`http://127.0.0.1:5173`
  - 管理后台：`http://127.0.0.1:5174`
  - OpenAPI（可选）：`http://127.0.0.1:8080`
- 若端口被占用：`scripts/demo.ps1` 会自动寻找可用端口，并在控制台输出实际地址（以输出为准）

## 2. 场景切换（最省时间的“难场景覆盖”）

> 默认隐藏「场景切换」入口（更接近生产展示）。如需演示/调试：启动时加 `-EnableMockTools`（或手动设置环境变量 `TARO_APP_ENABLE_MOCK_TOOLS=1`、`VITE_ENABLE_MOCK_TOOLS=1`）。

- 用户端（小程序/H5）：进入「我的」页 → 切换 Mock 场景
- 管理后台：顶部右侧「场景」下拉切换
- 演示说明：`happy` 场景下 Mock API 含少量“内存态”用于演示链路闭环（如：支付后订单状态变化、后台审核通过后前台可检索、消息发送后会话列表预览更新）；重启 Mock API 可重置

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
3. 检索：游客可看列表/详情；收藏/咨询/下单需登录且审核通过
4. 发明人榜：按平台内上传专利统计
5. 详情页：进入咨询（会话）/支付订金
6. 订金支付链路：创建订单 → 创建支付意图 → 成功页（演示）
7. 咨询/消息：会话列表 → 进入会话 → 发送/刷新（非实时，P0）
8. 发布：选择发布类型（专利/需求/成果）→ 专利发布表单（分组/校验/材料上传）→ 保存草稿/提交审核（演示）

### B. 管理后台（PC Web）

1. 认证审核：通过/驳回（演示）
2. 上架审核：通过/驳回（演示；通过后回到用户端检索/详情可看到新上架）
3. 订单：合同确认/变更完成（里程碑，演示）
4. 退款：审批通过/驳回；切 `refund_failed` 演示失败提示
5. 放款/结算：上传凭证 → 确认放款（演示）
6. 发票：上传/删除（演示；P0 为线下开票后上传附件）
7. 配置：交易规则 + 推荐权重（演示）
8. 专利地图 CMS：录入/更新区域专利数量结构（演示）

## 4. 常见问题（快速排错）

- 端口被占用（4010/5173/5174 等）导致启动失败：先运行 `powershell -ExecutionPolicy Bypass -File scripts/clean-dev.ps1` 清理旧 dev 进程，再重启 `scripts/demo.ps1`（必要时用 `scripts/clean-dev.ps1 -Force`）
- 用户端 H5 打开空白：先重启一键启动（或重启 `apps/client`），再访问输出的“用户端 H5”地址；规范入口为 `/#/pages/home/index`（Tab 页为 `/#/pages/home/index`、`/#/pages/search/index`、`/#/pages/publish/index`、`/#/pages/messages/index`、`/#/pages/me/index`；直接访问 `/#/`/`/#/pages` 会自动跳转；旧短链 `/#/home` 等在刷新时也会自动重定向）
- 桌面浏览器看起来“字号变大/留白很松”：H5 在 ≥768px 会自动 **居中手机宽度并锁定字号**；如需看移动端实际效果建议用浏览器设备模拟或直接预览小程序
- 检索页提示“加载失败 / Failed to fetch”：确认 Mock API 已启动且地址与前端一致（默认 `http://127.0.0.1:4010`）
- 控制台出现 `content-script.js` 报错：通常是浏览器扩展脚本导致，可忽略或用无痕窗口验证
