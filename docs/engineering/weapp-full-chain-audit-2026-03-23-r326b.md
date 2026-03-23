# 小程序全链路重点审计与优化计划（r326b，2026-03-23）

## 1. 审计范围与执行结果

本轮聚焦小程序关键业务链路：登录、咨询会话、订单、年费托管（计划/任务/订单/会话）、后台运营联动、支付回调处理规范。

已执行并通过：

- `powershell -ExecutionPolicy Bypass -File scripts/verify.ps1 -ReportDate r326b`
  - 结果：全绿通过
  - 核心指标：
    - `api-real-smoke` `1304/1304`
    - OpenAPI 覆盖 `225/225`
    - quality-floor `violations=[]`
    - `db-preflight-check` `9/9`
    - `ui-http-smoke` 通过
    - `ui-render-smoke(core)` `3/3`
    - `ui-dom-smoke(core)` `11/11`

- `powershell -ExecutionPolicy Bypass -File scripts/weapp-route-smoke.ps1 -Scenario happy -NoAuth -KillStaleDevtools`
  - 结果：通过（`12/12` 路由，无 runtime exception）

## 2. 本轮发现的生产级问题

### M01. 年费托管订单域数据库迁移缺失

现象：调用 `/admin/patent-maintenance/orders` 与 `/admin/patent-maintenance/orders/*` 返回 500。  
根因：数据库缺少 `patent_maintenance_orders` 与 `patent_maintenance_order_events` 表及关联 enum。  
影响：年费托管订单链路在生产不可用。

### M02. API 冒烟与 OpenAPI 覆盖断裂

现象：`check-api-smoke-openapi-coverage` 报告 18 个未覆盖操作（集中在年费托管 order/me/conversation）。  
影响：接口虽在 OpenAPI 暴露，但未进入真实链路门禁，发布风险不可控。

## 3. 已完成重构与优化

### 3.1 数据层修复（无兼容兜底）

新增 Prisma migration：

- `apps/api/prisma/migrations/20260323170000_add_patent_maintenance_order_tables/migration.sql`

内容：

- 新增 enum：
  - `PatentMaintenanceOrderStatus`
  - `PatentMaintenancePaymentChannel`
  - `PatentMaintenanceReconcileStatus`
  - `PatentMaintenanceOrderEventType`
- 新增表：
  - `patent_maintenance_orders`
  - `patent_maintenance_order_events`
- 新增索引与外键，完整对齐 `schema.prisma` 领域模型。

### 3.2 冒烟脚本重构（全链路覆盖）

更新：`scripts/api-real-smoke.ps1`

新增并验证：

- Admin 年费订单全链路：
  - 列表/创建/详情/事件
  - `quote -> payment-confirm -> execution -> receipt -> reconcile -> close`
  - `cancel`
- User（`/me`）侧链路：
  - `schedules/tasks/orders` 列表
  - `order detail/events`
  - `POST /me/patent-maintenance/orders`
- 会话链路：
  - `POST /patent-maintenance/orders/{orderId}/conversations`

关键稳定性优化：

- 年费订单冒烟使用“专用且唯一 schedule”构造，避免历史脏数据导致冲突，减少假失败。

结果：

- OpenAPI 覆盖恢复到 `225/225`。
- 质量门禁重新全绿。

## 4. 联网最佳实践对照（用于后续持续优化）

### 4.1 分包治理与小程序运行稳定性

依据：

- Taro 独立分包文档（`independent: true`）
- Taro 分包依赖提取插件（`mini.optimizeMainPackage.enable`）

对齐建议：

- 对业务隔离强且首屏无主包依赖的模块采用独立分包。
- 开启分包依赖提取，减少主包耦合，降低“跨分包依赖导致运行时缺模块”风险。

### 4.2 登录安全（code2Session + secret/session_key 边界）

依据：

- 腾讯云超级应用服务文档中的小程序登录流程：`wx.login -> code -> jscode2Session`，并强调 `session_key` 不下发前端。
- CCS 2023 论文（arXiv:2306.08151）对 AppSecret 泄露风险的实证分析。

对齐建议：

- 继续坚持：`session_key` 和 `AppSecret` 仅后端使用。
- 前端只保存业务 token，不暴露微信主密钥。
- 登录态校验与续期统一在服务端执行。

### 4.3 支付回调处理规范（真实生产要求）

依据：

- 微信支付 JSAPI 回调文档（商户版、合作伙伴版）。

关键要求：

- 5 秒内完成验签并应答。
- 验签通过返回 `200/204`，业务逻辑建议异步处理。
- 不可仅依赖回调，需结合查询接口兜底最终状态。
- 回调可能重试，必须保证幂等与可重入。

## 5. 下一步执行清单（P0/P1）

### P0（建议立即执行）

- 配置可用 `DEMO_USER_TOKEN`，把 `weapp-route-smoke` 从 no-auth 升级为 auth 场景自动冒烟。
- 将“客服中心单条提交”统一改为持续会话入口（与订单争议、年费托管会话模型一致）。
- 在管理后台会话工作台增加 `MAINTENANCE` 快筛与 SLA 视图（超时、待回复、升级）。

### P1（优化体验与运营效率）

- 批量运营入口增加“模板下载 + 字段校验报告 + 错行定位 + 可重放导入任务”。
- 对会话引入标准动作（转派、内部备注、标签、解决码），减少运营人工分拣成本。

## 6. 参考资料

- Taro 微信小程序独立分包：<https://docs.taro.zone/docs/independent-subpackage>
- Taro 智能提取分包依赖（miniSplitChunksPlugin）：<https://docs.taro.zone/docs/3.x/mini-split-chunks-plugin>
- 微信支付（商户）JSAPI 支付成功回调通知：<https://pay.wechatpay.cn/doc/v3/merchant/4012791861>
- 微信支付（合作伙伴）JSAPI 支付成功回调通知：<https://pay.wechatpay.cn/doc/v3/partner/4012085146>
- AppSecret 泄露研究（CCS 2023 预印本）：<https://arxiv.org/abs/2306.08151>
- 腾讯云超级应用服务：小程序登录实践（含 `wx.login` / `jscode2Session` / `session_key` 边界）：<https://staticintl.cloudcachetci.com/doc/pdf/product/pdf/1219_68262_zh.pdf>
