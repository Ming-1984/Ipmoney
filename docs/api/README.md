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
- `OPEN_LICENSE` (open license)
- `FIVE_STAR` (five-star patent)

Use the same enum in:
- home page quick entry
- search filters
- publish payload (`listingTopics`)

## Core Admin Surfaces (Unified)

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
- Patent ownership claim workflow:
  - `POST /me/patent-claims`
  - `GET /me/patent-claims`
  - `GET /admin/patent-claims`
  - `POST /admin/patent-claims/{claimId}/approve`
  - `POST /admin/patent-claims/{claimId}/reject`
- Platform conversation management:
  - `GET /admin/conversations/platform`
  - `POST /admin/conversations/{conversationId}/agents`
  - `DELETE /admin/conversations/{conversationId}/agents/{userId}`
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

## Consultation Routing

- `ConsultationRouting = PLATFORM | OWNER`
- Main usage:
  - `Listing.consultationRouting`
  - batch listing defaults (`listingDefaults.consultationRouting`)
  - consultation API returns `conversationId` for direct chat entry
