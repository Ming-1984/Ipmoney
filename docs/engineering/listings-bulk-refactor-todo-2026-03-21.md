# Listings Batch/Import Refactor TODO (2026-03-21)

## Scope and principles
- No compatibility fallback or dual-path logic.
- Directly align to the latest operation workflow and API contract.
- Use asynchronous job-based batch handling for traceability and recoverability.
- Enforce strict status transitions (especially publish semantics).
- Keep mini-program search/filter/publish tag semantics and admin operations consistent.
- Keep OpenAPI as source of truth for newly added endpoints and schemas.
- Keep RBAC and permission matrix aligned with actual enforcement.
- Run real verification steps (typecheck/test/build/openapi lint) before closing.

## External best-practice references (checked: 2026-03-21)
- Asynchronous request-reply for long-running operations:
  https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design#implement-asynchronous-methods
- Consistent operation polling model:
  https://docs.cloud.google.com/service-infrastructure/docs/service-management/reference/rpc/google.longrunning
- Idempotent retry semantics for write requests:
  https://docs.stripe.com/error-low-level#idempotency
- File upload hardening baseline:
  https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html

## Data model refactor
- [x] Add listing batch/import job enums in Prisma.
- [x] Add `ListingBatchJob` and `ListingBatchJobItem` models.
- [x] Add `ListingImportJob` and `ListingImportJobRow` models.
- [x] Add user/listing/file relations for new job models.
- [x] Add SQL migration for new enums/tables/indexes/foreign keys.

## Backend API and domain logic
- [x] Add RBAC permissions: `listing.batchPublish`, `listing.import`.
- [x] Add admin listing controller routes for batch jobs:
  - `POST /admin/listings/jobs/batch`
  - `GET /admin/listings/jobs/batch`
  - `GET /admin/listings/jobs/batch/{jobId}`
  - `GET /admin/listings/jobs/batch/{jobId}/items`
  - `GET /admin/listings/jobs/batch/{jobId}/error-file`
- [x] Add admin listing controller routes for import jobs:
  - `POST /admin/listings/jobs/import`
  - `POST /admin/listings/jobs/import/{jobId}/validate`
  - `POST /admin/listings/jobs/import/{jobId}/execute`
  - `GET /admin/listings/jobs/import`
  - `GET /admin/listings/jobs/import/{jobId}`
  - `GET /admin/listings/jobs/import/{jobId}/rows`
  - `GET /admin/listings/jobs/import/{jobId}/error-file`
- [x] Add batch job service orchestration:
  - async processing
  - per-item status
  - fail-rate pause rule
  - error csv generation
- [x] Add import job service orchestration:
  - xlsx parse and normalization
  - row-level validation and status
  - duplicate policy (`SKIP` / `OVERWRITE`)
  - async execution and error csv
- [x] Harden publish semantics:
  - publish requires `auditStatus=APPROVED`
  - publish only updates `status=ACTIVE`
- [x] Add idempotency handling for batch/import job creation.

## Admin web refactor
- [x] Replace listing audit page with unified operation console:
  - listing filter + selection
  - one-click batch action submission
  - import task submission with defaults
  - task center for batch/import jobs
  - drawer details for item/row-level results
  - error file quick download

## Contract and docs sync
- [x] Add OpenAPI paths for all batch/import endpoints.
- [x] Add OpenAPI parameters for job ids and status/action filters.
- [x] Add OpenAPI schemas for batch/import enums, requests, DTOs, and paged responses.
- [x] Update engineering permission matrix for new permissions and routes.

## Test and verification
- [x] Update controller tests to cover new batch/import endpoints and permission gates.
- [x] Run prisma generate against updated schema.
- [x] Run API typecheck.
- [x] Run API unit tests.
- [x] Run admin-web typecheck.
- [x] Run admin-web build.
- [x] Run OpenAPI lint.
- [x] (Optional high-bar) run real smoke/verify scripts if environment is ready.
  - `scripts/api-real-smoke.ps1` passed with `total=1222, passed=1222, failed=0, writesTotal=893, readsTotal=329` on local dockerized Postgres/Redis/MinIO environment.
  - `node scripts/check-api-smoke-quality-floor.mjs --report-date 2026-03-21` passed with `violations=[]`.

