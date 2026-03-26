# OpenAPI

Spec file: `docs/api/openapi.yaml`

## Preview

Prerequisite: local Node.js with `npx`.

- Redoc preview:
  - `npx -y @redocly/cli preview-docs docs/api/openapi.yaml --port 8080`

## Mock

- Scenario mock server:
  - `pnpm mock` (`http://127.0.0.1:4010`)
- Prism only:
  - `npx -y @stoplight/prism-cli mock docs/api/openapi.yaml --port 4011 --cors`

See `docs/engineering/mocking.md` for scenario fixtures.

## Validate And Generate Types

- Lint:
  - `pnpm openapi:lint`
- Generate shared API types:
  - `pnpm openapi:types`

## Listing Topic Enum (Unified)

- `HIGH_TECH_RETIRED` (retired patent)
- `SLEEPING` (sleeping patent)
- `AWARD_WINNING` (award-winning patent)
- `FIVE_STAR` (five-star patent)
- `OPEN_LICENSE` (open license)

Use the same enum in:
- home page quick entry
- search filters
- publish payload (`listingTopics`)

## Core Admin Surfaces (Unified)

- Admin login/session:
  - `POST /auth/sms/send`
  - `POST /auth/sms/verify`
  - `GET /auth/session`
- Listing batch jobs:
  - `POST /admin/listings/jobs/batch`
  - `GET /admin/listings/jobs/batch`
  - `GET /admin/listings/jobs/batch/{jobId}`
  - `GET /admin/listings/jobs/batch/{jobId}/items`
  - `GET /admin/listings/jobs/batch/{jobId}/error-file`
- Listing import jobs:
  - `POST /admin/listings/jobs/import`
  - `POST /admin/listings/jobs/import/{jobId}/validate`
  - `POST /admin/listings/jobs/import/{jobId}/execute`
  - `GET /admin/listings/jobs/import`
  - `GET /admin/listings/jobs/import/{jobId}`
  - `GET /admin/listings/jobs/import/{jobId}/rows`
  - `GET /admin/listings/jobs/import/{jobId}/error-file`
- Patent master import and listing generation:
  - `POST /admin/patents/jobs/import`
  - `POST /admin/patents/jobs/import/{jobId}/validate`
  - `POST /admin/patents/jobs/import/{jobId}/execute`
  - `GET /admin/patents/jobs/import`
  - `GET /admin/patents/jobs/import/{jobId}`
  - `GET /admin/patents/jobs/import/{jobId}/rows`
  - `GET /admin/patents/jobs/import/{jobId}/error-file`
  - `POST /admin/patents/jobs/listings`
  - Import guardrails:
    - validate/execute reject running jobs with `409 CONFLICT`
    - import row limit is `5000` per file
- Patent ownership claim workflow:
  - `POST /me/patent-claims`
  - `GET /me/patent-claims`
  - `GET /admin/patent-claims`
  - `POST /admin/patent-claims/{claimId}/approve`
  - `POST /admin/patent-claims/{claimId}/reject`
- Patent maintenance workflow:
  - `GET /me/patent-maintenance/schedules`
  - `GET /me/patent-maintenance/tasks`
  - `GET /me/patent-maintenance/orders`
    - Query options: `orderId` / `scheduleId` / `status` / `reconcileStatus` / `page` / `pageSize`
  - `POST /me/patent-maintenance/orders`
  - `GET /me/patent-maintenance/orders/{orderId}`
  - `GET /me/patent-maintenance/orders/{orderId}/events`
  - `GET /admin/patent-maintenance/schedules`
  - `POST /admin/patent-maintenance/schedules`
  - `PATCH /admin/patent-maintenance/schedules/{scheduleId}`
  - `GET /admin/patent-maintenance/tasks`
  - `POST /admin/patent-maintenance/tasks`
  - `PATCH /admin/patent-maintenance/tasks/{taskId}`
  - `GET /admin/patent-maintenance/orders`
  - `POST /admin/patent-maintenance/orders`
  - `GET /admin/patent-maintenance/orders/{orderId}`
  - `GET /admin/patent-maintenance/orders/{orderId}/events`
  - `POST /admin/patent-maintenance/orders/{orderId}/quote`
  - `POST /admin/patent-maintenance/orders/{orderId}/payment-confirm`
  - `POST /admin/patent-maintenance/orders/{orderId}/execution`
  - `POST /admin/patent-maintenance/orders/{orderId}/receipt`
  - `POST /admin/patent-maintenance/orders/{orderId}/reconcile`
  - `POST /admin/patent-maintenance/orders/{orderId}/close`
  - `POST /admin/patent-maintenance/orders/{orderId}/cancel`
- Platform conversation management:
  - `POST /support/conversations`
  - `POST /orders/{orderId}/dispute-conversations`
  - `POST /patent-maintenance/orders/{orderId}/conversations`
  - `GET /admin/conversations/platform`
  - `POST /admin/conversations/{conversationId}/agents`
  - `DELETE /admin/conversations/{conversationId}/agents/{userId}`
  - Query options on `GET /admin/conversations/platform`:
    - `q`
    - `channel=ALL|CONSULTATION|SUPPORT|DISPUTE|MAINTENANCE`
    - `assigned=ALL|MINE|ASSIGNED|UNASSIGNED`
    - `listingTopic`
    - `updatedFrom` / `updatedTo`
    - `page` / `pageSize`
- Achievement workflow:
  - `GET /search/achievements`
  - `POST /achievements`
  - `PATCH /achievements/{achievementId}`
  - `POST /achievements/{achievementId}/submit`
  - `POST /achievements/{achievementId}/off-shelf`
  - `POST /achievements/{achievementId}/consultations`
  - `POST /achievements/{achievementId}/conversations`
  - `POST /admin/achievements/{achievementId}/approve`
  - `POST /admin/achievements/{achievementId}/reject`
- RBAC + staff onboarding:
  - `GET /admin/rbac/permissions`
  - `GET /admin/rbac/roles`
  - `POST /admin/rbac/roles`
  - `PATCH /admin/rbac/roles/{roleId}`
  - `DELETE /admin/rbac/roles/{roleId}`
  - `GET /admin/rbac/users` (`scope=STAFF|ALL`, `q`; default `scope=STAFF`)
  - `POST /admin/rbac/users` (create staff account with phone + roleIds)
  - `PATCH /admin/rbac/users/{userId}`

## Consultation Routing

- `ConsultationRouting = PLATFORM | OWNER`
- Main usage:
  - `Listing.consultationRouting`
  - batch listing defaults (`listingDefaults.consultationRouting`)
  - consultation API returns `conversationId` for direct chat entry

## Admin Filter Baseline

- For list-style admin pages, keep filters and backend queries aligned, and avoid client-side post-filtering for primary fields.
- For filter UX, use draft inputs + apply action (`查询`/`重置`) so requests are sent only on explicit apply.
- Recommended common query shape:
  - `q`
  - core enums (`status`, `auditStatus`, `source`, `listingTopic`, etc.)
  - time range (`updatedFrom` / `updatedTo` or `createdFrom` / `createdTo`)
  - `page` / `pageSize`
- Current examples:
  - `GET /admin/listings` supports `q`, `regionCode`, `auditStatus`, `status`, `source`, `listingTopic`, `page`, `pageSize`
  - `GET /admin/patents` supports `q`, `patentType`, `legalStatus`, `sourcePrimary`, `page`, `pageSize`
