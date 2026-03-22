# 专利主数据批量导入 / 归属认领 / 咨询路由重构 TODO（2026-03-21）

## 目标与约束
- 直接按最新需求重构，不做兜底与兼容分支。
- 后台支持 Excel 批量导入专利主数据，并支持按专利批量生成上架 Listing。
- 小程序咨询路由统一：平台发布走平台会话；归属用户后走归属用户会话。
- 增加专利归属认领审核闭环（提交、审核、通过/驳回、审计追踪）。
- OpenAPI、权限矩阵、管理后台菜单/页面、API 类型、测试报告保持一致。

## 重构原则（最佳实践）
- 异步批处理统一 Job 模型（创建、校验、执行、分页、错误文件）。
- 写接口保持幂等（支持 `Idempotency-Key`），便于运营重试。
- 核心状态机单向流转，拒绝跨状态写入。
- 所有关键动作可审计（导入、批量上架、认领审核、坐席分配）。

## 执行清单

### A. 数据模型与迁移
- [x] A01 新增 `ConsultationRouting`（`PLATFORM` / `OWNER`）。
- [x] A02 `Listing` 增加 `consultationRouting` 字段。
- [x] A03 `Patent` 增加 `ownerUserId` / `ownerClaimedAt` / `ownerClaimSource`。
- [x] A04 新增 `PatentImportJob` / `PatentImportJobRow` 模型。
- [x] A05 新增 `PatentClaimRequest` 模型。
- [x] A06 新增 `ConversationAgent` 模型。
- [x] A07 Prisma migration 落地（索引、外键、唯一约束）。

### B. 权限与 RBAC
- [x] B01 新增权限 `patent.import`。
- [x] B02 新增权限 `patent.claim.review`。
- [x] B03 新增权限 `conversation.platform.manage`。
- [x] B04 默认角色授予同步（operator/cs）并更新权限矩阵文档。

### C. 后端 API（专利导入与批量上架）
- [x] C01 `POST /admin/patents/jobs/import`
- [x] C02 `POST /admin/patents/jobs/import/{jobId}/validate`
- [x] C03 `POST /admin/patents/jobs/import/{jobId}/execute`
- [x] C04 `GET /admin/patents/jobs/import`
- [x] C05 `GET /admin/patents/jobs/import/{jobId}`
- [x] C06 `GET /admin/patents/jobs/import/{jobId}/rows`
- [x] C07 `GET /admin/patents/jobs/import/{jobId}/error-file`
- [x] C08 `POST /admin/patents/jobs/listings`

### D. 后端 API（专利归属认领）
- [x] D01 `POST /me/patent-claims`
- [x] D02 `GET /me/patent-claims`
- [x] D03 `GET /admin/patent-claims`
- [x] D04 `POST /admin/patent-claims/{claimId}/approve`
- [x] D05 `POST /admin/patent-claims/{claimId}/reject`
- [x] D06 审核通过前阻断进行中交易（未终态订单）。
- [x] D07 审核通过后同步 OWNER 路由 Listing 的卖家归属。

### E. 后端 API（平台咨询会话）
- [x] E01 `GET /admin/conversations/platform`
- [x] E02 `POST /admin/conversations/{conversationId}/agents`
- [x] E03 `DELETE /admin/conversations/{conversationId}/agents/{userId}`
- [x] E04 会话访问权限扩展：`buyer/seller/assigned-agent`。
- [x] E05 咨询接口统一返回 `conversationId` 作为聊天入口。

### F. 管理后台（Admin Web）
- [x] F01 增加“专利运营（导入任务 + 批量生成上架）”页面。
- [x] F02 增加“归属认领审核”页面。
- [x] F03 增加“平台咨询会话（分配坐席/回复）”页面。
- [x] F04 路由、菜单、入口统一到新页面。
- [x] F05 专利列表页增加跳转入口，避免批量能力隐藏。

### G. OpenAPI / API 类型 / 文档
- [x] G01 `docs/api/openapi.yaml` 补齐全部新增路由（审计 `Controller-only=0`）。
- [x] G02 同步 schema 变更：
  - `Listing.consultationRouting`
  - `Patent.ownerUserId/ownerClaimedAt/ownerClaimSource`
  - `ConversationSummary.assignedAgentUserIds`
  - 咨询接口返回 `conversationId`
- [x] G03 生成 `packages/api-types/index.d.ts`。
- [x] G04 更新 `docs/api/README.md`。
- [x] G05 更新 `docs/engineering/permissions-matrix.md`。

### H. 测试与验证
- [x] H01 `pnpm -C apps/api run typecheck`
- [x] H02 `pnpm -C apps/api run test`（89 文件 / 509 用例通过）
- [x] H03 `pnpm -C apps/admin-web run typecheck`
- [x] H04 `VITE_API_BASE_URL=http://localhost:3200 pnpm -C apps/admin-web build`
- [x] H05 `pnpm openapi:lint`
- [x] H06 `node scripts/audit-openapi-backend.mjs`
- [ ] H07 真实联调 smoke（导入 -> 上架 -> 咨询 -> 认领 -> 再咨询）需在联调环境执行

## 验收标准
- 运营可在后台用 Excel 批量导入专利主数据并追踪任务结果。
- 可按专利 ID 批量生成上架，且咨询路由可按 `PLATFORM/OWNER` 统一控制。
- 平台发布专利咨询可进入后台平台会话，并支持坐席分配。
- 用户认领通过后，新咨询路由到归属用户；历史会话不迁移。
- OpenAPI、权限矩阵、管理后台页面与实际后端实现一致。
