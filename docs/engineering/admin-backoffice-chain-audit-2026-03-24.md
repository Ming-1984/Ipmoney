# 管理后台全链路审计（2026-03-24）

## 1. 审计范围
- 前端：`apps/admin-web`
- 后端：`apps/api`
- 契约与质量门禁：`docs/api/openapi.yaml`、`scripts/verify.ps1`、`scripts/audit-*.mjs`

## 2. 本次核验结果（当前快照）
- `scripts/verify.ps1 -UiSmokeMode core -ReportDate r326-user-audit-rerun`：通过（含 lint/typecheck/build/api-real-smoke/openapi-coverage/quality-floor/ui-smoke）
- `pnpm -C apps/api test`：`550/550` 通过
- `pnpm -C apps/api test:e2e`：`2/2` 通过
- `pnpm openapi:lint`：通过
- `node scripts/audit-openapi-backend.mjs`：OpenAPI 与 Controller 对齐（`231/231`）

## 3. 主要问题清单（按严重级别）

### P0（高）订单“后台总览链路”不闭环
**现象**
- 后台订单页从用户侧接口取数：`/orders?asRole=BUYER`，不是后台专用列表。
- 服务端 `listOrders` 强制按当前登录用户 buyer/seller 过滤，没有 admin 全量视角。
- 后端仅有 `GET /admin/orders/:orderId`（详情），缺少 `GET /admin/orders`（列表）。

**证据**
- `apps/admin-web/src/views/OrdersPage.tsx:54`
- `apps/api/src/modules/orders/orders.service.ts:592`
- `apps/api/src/modules/orders/orders.service.ts:594`
- `apps/api/src/modules/orders/orders.controller.ts:77`

**影响**
- 运营/客服/财务无法在后台直接做平台级订单盘点与待办分发，依赖已知订单号，易漏单。

**建议**
- 新增 `GET /admin/orders`（按状态、时间、退款状态、结算状态、关键字分页筛选）。
- 仪表盘订单统计改用后台汇总口径接口，避免用户口径污染。

---

### P0（高）真实生产交易链路尚未收口
**现象**
- 当前项目口径明确为 dev/staging 演示，不接入真实微信登录/支付/AI。
- 上线检查中登录、支付、退款回调、对账等关键项仍标记“暂缓”。

**证据**
- `docs/engineering/project-status.md:6`
- `docs/engineering/release-checklist.md:7`
- `docs/engineering/release-checklist.md:14`

**影响**
- 目前可用于演示联调，不可直接按真实资金闭环上线。

**建议**
- 将“生产 gating”拆分为独立里程碑，先收口真实登录与支付回调验签，再放开发布窗口。

---

### P1（中）退款/结算/发票运营入口以“订单号单查”为主，缺少队列化工作台
**现象**
- 三个页面都要求先输入订单号再加载。
- 接口设计也以按订单查询为主（缺全量待办列表）。

**证据**
- `apps/admin-web/src/views/RefundsPage.tsx:38`
- `apps/admin-web/src/views/SettlementsPage.tsx:37`
- `apps/admin-web/src/views/InvoicesPage.tsx:41`
- `apps/api/src/modules/orders/orders.controller.ts:47`
- `apps/api/src/modules/orders/orders.controller.ts:105`

**影响**
- 运营效率低，不适合“批量待办处理、跨班交接、漏斗监控”。

**建议**
- 新增待办列表接口（如 `/admin/refund-requests`、`/admin/invoices`、`/admin/settlements`）并支持状态分页筛选。

---

### P1（中）评论运营存在权限与业务覆盖缺口
**现象**
- 后端 `/admin/comments` 仅检查 `isAdmin`，未绑定独立 permission ID。
- 前端评论管理只支持 `LISTING`，未覆盖 `ACHIEVEMENT`。

**证据**
- `apps/api/src/modules/comments/comments.controller.ts:46`
- `apps/api/src/modules/comments/comments.service.ts:47`
- `docs/engineering/permissions-matrix.md:84`
- `apps/admin-web/src/views/CommentsPage.tsx:10`
- `apps/admin-web/src/views/CommentsPage.tsx:139`

**影响**
- 权限最小化原则不完整；成果类留言无法统一后台运营。

**建议**
- 增加 `comment.manage` 权限点并在角色中显式授权。
- 评论页补齐 `ACHIEVEMENT` 类型筛选与展示文案。

---

### P1（中）Mock 回归对前端真实调用覆盖不足
**现象**
- Frontend-used but missing in happy fixtures 数量高（`190`）。

**证据**
- `docs/engineering/openapi-coverage.md:56`

**影响**
- 纯 fixtures 模式下，部分回归依赖 Prism fallback，稳定性与可重复性下降。

**建议**
- 优先补齐高频运营链路 fixtures：会话分配、订单里程碑、退款审批、发票上传、结算确认。

---

### P2（低）部分列表页缺分页控件，不利于大体量运营
**现象**
- 认证页固定 `page=1&pageSize=10` 且前端不提供分页控件。

**证据**
- `apps/admin-web/src/views/VerificationsPage.tsx:74`
- `apps/admin-web/src/views/VerificationsPage.tsx:111`

**建议**
- 统一接入分页组件与筛选保留（与会话页一致的“查询参数可回放”模式）。

## 4. 结论
- 当前代码质量门禁总体通过，契约对齐良好，核心演示链路可运行。
- 主要短板集中在“后台运营规模化能力”和“生产级真实资金链路收口”，建议优先修复 P0/P1 项后再进入正式生产投放。
