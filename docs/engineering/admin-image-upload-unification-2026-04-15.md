# 管理后台图片上传交互统一（2026-04-15）

## 目标
- 将“可编辑图片位”统一为同一上传交互：上传 + URL 兜底输入 + 预览（含内置图选择）。
- 避免“前端可填但后端不落库”的假实现，补齐端到端打通。

## 本次新增与修复

### 1) 统一组件覆盖范围（已完成）
- 首页运营配置：
  - `apps/admin-web/src/views/HomeLandingConfigPage.tsx`
  - 特色专区卡片 `imageUrl` 使用 `ImageUrlUploadField`。
- 配置中心 Banner：
  - `apps/admin-web/src/views/ConfigPage.tsx`
  - Banner 封面 `posterUrl/imageUrl` 使用 `ImageUrlUploadField`。
- 技术经理人管理：
  - `apps/admin-web/src/views/TechManagersPage.tsx`
  - 编辑抽屉新增“头像”上传，字段为 `avatarUrl`，使用 `ImageUrlUploadField`。
- 认证审核（机构主体）：
  - `apps/admin-web/src/views/VerificationsPage.tsx`
  - 认证详情新增“机构 Logo”上传/清除入口，替代纯链接不可管控状态。

### 2) 后端真实打通（已完成）
- 文件：`apps/api/src/modules/tech-managers/tech-managers.service.ts`
- `PATCH /admin/tech-managers/:techManagerId` 新增 `avatarUrl` 处理：
  - 支持设置 URL（自动 trim）
  - 支持清空（`''`/`null` -> `users.avatar_url = null`）
  - 增加长度校验（`<= 1000`）
  - 审计日志同步记录 `avatarUrl`
- 同时修正：仅更新头像时不再强制 `upsert tech_manager_profiles`，避免无关写入与潜在异常。
- 新增认证 Logo 管理接口（管理员）：
  - `PATCH /admin/user-verifications/{verificationId}/logo`
  - 支持设置/清空 `logoFileId`，并记录审计日志 `VERIFICATION_LOGO_UPDATE`。

### 3) 契约同步（已完成）
- OpenAPI：`docs/api/openapi.yaml`
  - `TechManagerUpdateRequest` 新增 `avatarUrl`（`string(uri) | null`）。
  - 新增 `/admin/user-verifications/{verificationId}/logo`。
- 类型：`packages/api-types/index.d.ts`
  - 已由 `pnpm openapi:types` 重新生成。

## 验证结果
- API 单测：
  - `pnpm -C apps/api test -- tech-managers.update-admin.spec.ts` 通过。
  - 覆盖新增场景：头像设置、头像清空、长度非法。
- API 类型检查：
  - `pnpm -C apps/api typecheck` 通过。
- API 单测（认证 Logo）：
  - `pnpm -C apps/api test -- admin-user-verifications.controller.spec.ts users.admin-verifications-review.spec.ts` 通过。
- Admin 类型检查：
  - `pnpm -C apps/admin-web typecheck` 通过。
- Admin 构建：
  - `VITE_API_BASE_URL=https://api.example.com pnpm -C apps/admin-web build` 通过。

## 当前统一状态清单

### 已统一（可编辑）
- 首页特色专区卡片图
- Banner 封面图
- 技术经理头像
- 机构 Logo（认证审核详情）

### 仅展示（非编辑入口，未改）
- 评论/会话等列表中的 `avatarUrl/logoUrl` 展示位
- 各类附件 URL 展示位（发票、证据、回执、导入文件下载链接等）

## 下一步建议（继续全量统一）
- 当前 `VerificationsPage` 已改为 `ImageUrlUploadField`，与首页/技术经理页交互一致。
- 仍存在大量“文件附件上传”页面（发票/回执/证据/导入）使用原生 `Upload`，这类是“文件流”而非“图片 URL 配置”，可在下一阶段抽象为 `FileUploadField` 统一风格与错误处理。
