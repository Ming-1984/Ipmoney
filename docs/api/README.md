# OpenAPI

规范文件：`docs/api/openapi.yaml`

## 预览

前置：本机已安装 Node.js（含 `npx`）。

- 本地预览（Redocly）：
  - `npx -y @redocly/cli preview-docs docs/api/openapi.yaml --port 8080`

## Mock

- 启动 Mock Server（推荐，含场景能力）：
  - `pnpm mock`（`http://127.0.0.1:4010`）
- 仅启动 Prism：
  - `npx -y @stoplight/prism-cli mock docs/api/openapi.yaml --port 4011 --cors`

场景化 fixtures 见：`docs/engineering/mocking.md`。

## 校验与类型

- Lint：
  - `pnpm openapi:lint`
- 生成前端/管理台共享类型：
  - `pnpm openapi:types`

## 专利特色标签（统一口径）

- `ListingTopic` 枚举：
  - `HIGH_TECH_RETIRED`（退役专利）
  - `SLEEPING`（沉睡专利）
  - `AWARD_WINNING`（获奖专利）
  - `OPEN_LICENSE`（开放许可）
  - `FIVE_STAR`（五星专利）
- 统一适用范围：
  - 首页特色专区跳转搜索页：通过 `listingTopic` 预填
  - 搜索筛选：支持按 `listingTopic` 直接筛选
  - 发布专利：支持写入 `listingTopics`（数组）

## 管理后台批量与归属能力（统一口径）

- Listing 维度批量作业（保留）：
  - `POST /admin/listings/jobs/batch`
  - `GET /admin/listings/jobs/batch`
  - `GET /admin/listings/jobs/batch/{jobId}`
  - `GET /admin/listings/jobs/batch/{jobId}/items`
  - `GET /admin/listings/jobs/batch/{jobId}/error-file`
  - `POST /admin/listings/jobs/import`
  - `POST /admin/listings/jobs/import/{jobId}/validate`
  - `POST /admin/listings/jobs/import/{jobId}/execute`
  - `GET /admin/listings/jobs/import`
  - `GET /admin/listings/jobs/import/{jobId}`
  - `GET /admin/listings/jobs/import/{jobId}/rows`
  - `GET /admin/listings/jobs/import/{jobId}/error-file`
- Patent 主数据导入与批量上架（新增）：
  - `POST /admin/patents/jobs/import`
  - `POST /admin/patents/jobs/import/{jobId}/validate`
  - `POST /admin/patents/jobs/import/{jobId}/execute`
  - `GET /admin/patents/jobs/import`
  - `GET /admin/patents/jobs/import/{jobId}`
  - `GET /admin/patents/jobs/import/{jobId}/rows`
  - `GET /admin/patents/jobs/import/{jobId}/error-file`
  - `POST /admin/patents/jobs/listings`
- 专利归属认领与审核（新增）：
  - `POST /me/patent-claims`
  - `GET /me/patent-claims`
  - `GET /admin/patent-claims`
  - `POST /admin/patent-claims/{claimId}/approve`
  - `POST /admin/patent-claims/{claimId}/reject`
- 平台咨询会话分配（新增）：
  - `GET /admin/conversations/platform`
  - `POST /admin/conversations/{conversationId}/agents`
  - `DELETE /admin/conversations/{conversationId}/agents/{userId}`

## 咨询路由规则（统一口径）

- `ConsultationRouting`：
  - `PLATFORM`：用户咨询进入平台客服会话
  - `OWNER`：用户咨询进入专利归属人会话
- 生效点：
  - `Listing.consultationRouting`
  - 管理后台批量上架默认项（`listingDefaults.consultationRouting`）
  - 用户咨询接口返回 `conversationId`，用于直达聊天入口
