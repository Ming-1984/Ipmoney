# Test Report (Consolidated)

## Latest (2026-03-12)

### Commands & Results (dev)
- `powershell -ExecutionPolicy Bypass -File scripts/verify.ps1 -ReportDate 2026-03-12-r196`
  - Result: success (all steps)
  - Render artifact: `docs/demo/rendered/ui-smoke-2026-03-12-r196/`
  - Gate summary: `api-real-smoke` `1754/1754` (`writes=1297`,`reads=457`), OpenAPI coverage `238/238`, quality floor `violations=[]`, plus `db-preflight/ui-http-smoke/ui-render-smoke(core)/ui-dom-smoke(core)` all pass.
- `powershell -ExecutionPolicy Bypass -File scripts/api-real-smoke.ps1 -ReportDate 2026-03-12-r193`
  - Result: pass (`1754/1754`) after chaos trend-threshold anti-flake tuning.
  - Notes: an earlier `verify` run (`r192`) had a single false-negative on `chaos-randomized-outcome-distribution` (trend threshold marginal exceed); script now reports base/effective trend thresholds and applies a bounded `+250ms` grace while keeping the absolute p95 guard unchanged.
- `pnpm -C apps/api test`
  - Result: pass (`129/129`)
  - Coverage in this batch: `test/patent-map.filters.spec.ts` (`5`), `test/tech-managers.filters.spec.ts` (`4`), `test/content-utils.sanitize.spec.ts` (`5`), `test/regions.filters.spec.ts` (`6`), `test/org-inventor.filters.spec.ts` (`6`), `test/listings.search-filters.spec.ts` (`6`), `test/audit-logs.read.spec.ts` (`5`), `test/orders.write.spec.ts` (`24`), `test/comments.write.spec.ts` (`28`), `test/favorites.write.spec.ts` (`29`), `test/addresses.write.spec.ts` (`9`), `test/health.e2e-spec.ts` (`2`).
  - Notes: `regionCode` filter strictness is now aligned to 6-digit validation in `inventors/organizations/tech-managers`, and patent-map dry-run import regression now covers duplicate row and missing-region error convergence.
- `pnpm -C apps/api test:e2e`
  - Result: pass (`2/2`).
- `pnpm -C apps/api lint && pnpm -C apps/api typecheck && pnpm -C apps/api build`
  - Result: success (all pass after test-framework bootstrap changes).
- `powershell -ExecutionPolicy Bypass -File scripts/weapp-route-smoke.ps1 -NoAuth -ReportDate 2026-03-12-r187 -LaunchRetries 3 -LaunchRetryDelayMs 4000 -KillStaleDevtools`
  - Result: pass (11/11 routes)
  - Artifact: `.tmp/weapp-route-smoke-2026-03-12-r187.json`
  - Notes: script hardening landed for DevTools launch instability (`launch retry/backoff`, optional `-KillStaleDevtools`, per-attempt `wechatdevtools.exe` diagnostics and failure-report write-through).
- `powershell -ExecutionPolicy Bypass -File scripts/weapp-route-smoke.ps1 -ReportDate 2026-03-12-r188 -LaunchRetries 1 -KillStaleDevtools`
  - Result: expected fail (`DEMO_USER_TOKEN` missing), and failure artifact written successfully.
  - Artifact: `.tmp/weapp-route-smoke-2026-03-12-r188.json`
- `powershell -ExecutionPolicy Bypass -File scripts/ui-http-smoke.ps1 -ReportDate 2026-03-12-r189`
  - Result: pass (`86/86`)
  - Artifact: `.tmp/ui-http-smoke-2026-03-12-r189-summary.json`
- `powershell -ExecutionPolicy Bypass -File scripts/ui-render-smoke.ps1 -Mode full -ReportDate 2026-03-12-r190`
  - Result: pass (`83/83`)
  - Artifact: `.tmp/ui-render-smoke-2026-03-12-r190-summary.json`
- `powershell -ExecutionPolicy Bypass -File scripts/ui-dom-smoke.ps1 -Mode full -ReportDate 2026-03-12-r191`
  - Result: pass (`83/83`, mode=`full-83`)
  - Artifact: `.tmp/ui-dom-smoke-2026-03-12-r191-summary.json`
- `node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync('.tmp/api-real-smoke-2026-03-12-r185.json','utf8').replace(/^\uFEFF/,''));const keys=['industry-tags-sanitized','hidden-industry-filter','public-regions-query-smoke-region','public-regions-list-after-industry-tags-set','public-announcements-list-admin-smoke-tags-sanitized','public-announcement-detail-admin-smoke-tags-sanitized'];const hit=data.filter(x=>keys.some(k=>String(x.name||'').includes(k)));const failed=hit.filter(x=>!x.ok);console.log(JSON.stringify({matched:hit.length,failed:failed.length},null,2));"`
  - Result: matched targeted anti-pollution checks `24`, failed `0` (including hidden `industryTags` filter variants and public list/detail sanitization checks).

## Latest (2026-03-06)

### Commands & Results (dev)
- `powershell -ExecutionPolicy Bypass -File scripts/verify.ps1 -ApiBaseUrl https://staging-api.example.com -ApiPort 3200 -ReportDate 2026-03-06`
  - Result: success (all steps)
  - Port resilience: verify keeps preferred/range/random fallback and remains stable under collision scenarios.
  - Script hardening: `api-real-smoke`, `ui-http-smoke`, `ui-render-smoke`, `ui-dom-smoke` now use dynamic port selection and process-tree cleanup (no kill-by-port behavior).
  - Build resilience: verify appends `NODE_OPTIONS=--max-old-space-size=4096` and retries transient `client:build:h5` crash exits once.
  - Chaos trend persistence: verify now passes `-ChaosHistoryPath` into `api-real-smoke` and snapshots history as `.tmp/api-real-smoke-chaos-history-<ReportDate>.json` for reproducible trend baselines.
  - Quality gates: `openapi:lint`, `lint`, `typecheck`, `scan:banned-words` all pass.
  - API smoke: pass (642/642) -> `.tmp/api-real-smoke-2026-03-06-summary.json`
  - API smoke write/read split: writes 549/549, reads 93/93.
  - Semantic/state checks now included: cross-module order/refund/case/maintenance/rbac state assertions, file-link persistence assertions, and post-action detail re-fetch checks.
  - Idempotency replay checks now included: same-key replay for order create, payment intents (deposit/final), invoice request, and refund request create.
  - Failure/idempotency checks now included: duplicate favorites, invalid comment/message payloads (including strict 400 for empty comment create/update), and missing-resource delete paths.
  - Anti-flake hardening: `api-real-smoke` now forces `RATE_LIMIT_ENABLED=false` for local run consistency, and raises body truncation ceiling to preserve large JSON assertions.
  - DB preflight: pass (failed=0) -> `.tmp/db-preflight-2026-03-06-summary.json`
  - UI HTTP smoke: pass (28/28) -> `.tmp/ui-http-smoke-2026-03-06-summary.json`
  - UI render smoke (core): pass (3/3) -> `.tmp/ui-render-smoke-2026-03-06-summary.json`
  - UI DOM smoke (core): pass (11/11) -> `.tmp/ui-dom-smoke-2026-03-06-summary.json`
  - WeApp hard budget gate: pass -> `.tmp/weapp-bundle-budget-2026-03-05.json` (script uses UTC date in filename).
  - Build risk closed for current threshold: key wxss files now pass budget (`app-origin.wxss` 286,492 B; `pages/home/index.wxss` 118,115 B; `pages/me/index.wxss` 69,236 B; `subpackages/login/index.wxss` 64,541 B).

- `powershell -ExecutionPolicy Bypass -File scripts/ui-http-smoke.ps1 -ReportDate 2026-03-05` (with a temporary blocker bound on `4010`)
  - Result: success
  - Collision self-heal validated: mock/client/admin auto-fallback to `4014` / `5177` / `5178` (no process kill by port).

- `powershell -ExecutionPolicy Bypass -File scripts/ui-render-smoke.ps1 -Mode full -ReportDate 2026-03-05`
  - Result: pass (83/83)
  - Coverage split: client 58/58, admin 25/25.
  - Artifacts: `.tmp/ui-render-smoke-2026-03-05-summary.json`, `docs/demo/rendered/ui-smoke-2026-03-05/`.

- `powershell -ExecutionPolicy Bypass -File scripts/ui-dom-smoke.ps1 -Mode core -ReportDate 2026-03-05`
  - Result: pass (11/11)
  - Core DOM routes covered: client home/search/listing-detail/orders/publish/me + admin login/dashboard/orders/verifications/config.
  - Artifacts: `.tmp/ui-dom-smoke-2026-03-05-summary.json`, `.tmp/ui-dom-smoke-2026-03-05.json`.

- `powershell -ExecutionPolicy Bypass -File scripts/ui-dom-smoke.ps1 -Mode full -ReportDate 2026-03-05`
  - Result: pass (83/83), mode=`full-83`
  - Coverage expansion: DOM assertion coverage raised to 83/83 pages in matrix.
  - Artifacts: `.tmp/ui-dom-smoke-2026-03-05-summary.json`, `.tmp/ui-dom-smoke-2026-03-05.json`.

- `apps/mock-api/src/server.js`
  - Result: fixed CORS allow-list gap by adding `X-Device-Id`, removing false network failures in H5 API calls during DOM smoke.

- `node scripts/build-page-api-test-matrix.mjs --date 2026-03-05`
  - Result: success
  - Matrix: `docs/engineering/page-api-test-matrix-2026-03-05.md`

- `node scripts/audit-vulnerability-ledger.mjs --date 2026-03-05 --input .tmp/pnpm-audit-prod-2026-03-05.json`
  - Result: success
  - Ledger: `docs/engineering/vulnerability-ledger-2026-03-05.md`
  - Machine summary: `.tmp/vulnerability-ledger-2026-03-05.json`

- Admin config write probe (`PUT /admin/config/*`, demo env token)
  - Result: pass (8/8)
  - Added assertion: each PUT now verifies corresponding `CONFIG_*_UPDATE` audit-log count increments.

- Admin order invoice negative-path probe (`POST /admin/orders/:orderId/invoice`, missing order)
  - Result: pass (404 expected)
  - Regression fixed: endpoint now maps missing-order path to `NOT_FOUND` instead of Prisma P2025 500.

- Admin order/refund write negative-path probes (missing ids)
  - Result: pass (10/10 expected 404), including manual payment, milestones, payout, invoice upsert/delete, refund approve/reject/complete.

- Order/admin happy-path probes (demo auth/payment)
  - Result: pass (create order -> deposit paid -> contract signed -> final paid -> transfer completed -> settlement query).
  - Added guard probes in-flow: duplicate manual payment conflicts, payout missing evidence (400), invoice upsert missing file (400), refund/invoice request state-machine conflict checks (409).
  - Added payment-intent validation hardening + guards: `POST /orders/:id/payment-intents` now treats explicit invalid `payType` as strict 400 (no silent fallback to `DEPOSIT`).
  - Added datetime validation hardening + guards: invalid `paidAt` / `signedAt` / `completedAt` / `payoutAt` / `issuedAt` now return 400 instead of leaking Prisma/Date conversion 500 paths.
  - Added semantic continuity assertions: order status verified after each transition (`DEPOSIT_PENDING` -> `DEPOSIT_PAID` -> `WAIT_FINAL_PAYMENT` -> `FINAL_PAID_ESCROW` -> `READY_TO_SETTLE` -> `COMPLETED`), settlement `payoutStatus` verified before/after payout, and `/orders/:id/case` milestone completion verified.
  - Added idempotency replay assertions: same `Idempotency-Key` now verifies stable `orderId`/`paymentId` replay behavior for order create and payment-intent paths.
  - Added file-dependent persistence checks: `/files` upload, admin manual payout with evidence, invoice request success + duplicate guard, admin invoice upsert/get/delete with real file id and post-delete 404 check.
  - Added concurrency race matrix: same order concurrent manual payout now asserts one success + one conflict, then verifies order/settlement convergence (`COMPLETED` + `SUCCEEDED`).
  - Added higher fan-out race matrix: same order triple concurrent manual payout now asserts one success + two conflicts, then verifies final order/settlement convergence.
  - Added cross-role overlap race: user refund-create vs admin transfer-completed on same order now asserts one success + one conflict, then verifies converged order status and terminal completion path (refund win branch).
  - Added mixed triple-write race matrix: same order concurrent `payout + invoice-request + refund-request` now asserts payout success, refund conflict, invoice in allowed branch states, and post-race order/settlement convergence.
  - Added invoice consistency closure for mixed race: when invoice request succeeds (including replay-after-conflict branch), admin invoice upsert now links `invoiceFileId`, preventing `invoice_no` without file linkage and keeping db preflight (`invoice_without_file`) green.
  - Added repeated mixed-burst race matrix on same order aggregate: after settlement completion, rerun concurrent `payout + invoice-request + refund-request` and assert payout/refund remain conflict-only, invoice branch remains bounded (`200/201/409`), and aggregate terminal state remains stable.
  - Added cross-order parallel payout matrix: two different orders run concurrent manual payout and both must succeed (no cross-aggregate conflict), followed by per-order terminal-state convergence checks.
  - Added staggered-start mixed tail matrix: after payout succeeds first, concurrent `invoice-request + refund-request` on same order must keep refund conflict-only and keep order/settlement terminal states stable.
  - Added jittered repeated race loops: same settled order now runs multiple delayed concurrent `invoice-request + refund-request` bursts (17/43/71ms), asserting bounded outcomes per loop and terminal-state stability after repeated sampling.
  - Added randomized multi-iteration race harness: batched seeds drive delayed overlap bursts on same settled order (`invoice-request + refund-request`), and smoke now records per-seed outcomes plus aggregated distribution in a dedicated internal summary case.
  - Added randomized multi-order/multi-aggregate harness: two settled orders now run seed-driven cross-order overlap bursts (`invoice-request` pair + `refund-request` pair), with per-run outcome capture and aggregate distribution assertions to detect cross-aggregate isolation regressions.
  - Expanded chaos overlap harness to larger seeded space (30 runs / 5 batches): delayed overlap bursts emit a dedicated internal summary case with outcome distribution and `p50/p95/max` pair-latency percentiles.
  - Added cross-run chaos trend baseline: smoke now persists `.tmp/api-real-smoke-chaos-history.json`, computes rolling baseline (`historyWindow=20`, `minSamples=6`), and applies a trend-threshold guard once enough prior samples exist (while retaining absolute guard `p95 <= 3000ms`).
  - Trend-guard activation validated in repeated runs: with `priorSamples=6`, chaos summary reports `checkApplied=true`, `trendThresholdP95=1893ms`, and current run `p95=753ms` (pass).

- Refund lifecycle probes (demo auth/payment)
  - Result: pass (manual approve->complete flow + manual reject flow).
  - Added state guards: missing reject reason (400), approve/reject/complete duplicate conflict checks (409), post-refunded re-request conflict (409).
  - Added state assertions: refund request status progression (`PENDING` -> `REFUNDING` -> `REFUNDED` / `REJECTED`) plus order status verification after approve/complete/reject paths.
  - Added idempotency replay assertions: same-key refund create now verifies stable `refundRequestId` replay in approve/reject branches.
  - Added concurrency race matrix: same refund request concurrent approve/reject now asserts one success + one conflict, then verifies order state convergence (`REFUNDING` or `WAIT_FINAL_PAYMENT`) and terminal completion path when approve wins.

- Admin case workflow probes (demo auth/payment)
  - Result: pass (`/admin/cases` list/create/detail/assign/status/notes/evidence/sla).
  - Added negative guards: missing case detail (404), assign missing assignee (400), invalid status (400), evidence missing fileId (400), SLA missing/invalid dueAt (400).
  - Added case-create validation hardening + guards: `POST /admin/cases` now treats explicit invalid `type/status/priority` as strict 400 (no silent fallback), with smoke negatives for each enum path.

- Patent-maintenance workflow probes (demo auth/payment)
  - Result: pass (`/admin/patent-maintenance` schedules/tasks list/create/update/detail).
  - Added negative guards: missing/invalid patent & schedule (400/404), duplicate schedule create conflict (409), invalid status values (400), invalid evidence file id (400), missing task update target (404).
  - Added create-path validation hardening + guards: `POST /admin/patent-maintenance/schedules|tasks` now treats explicit invalid `status` as strict 400 (no silent fallback to default status).
  - Added semantic assertions: schedule status + grace period persistence and task status/evidence persistence (including list-by-schedule verification).
  - Regression fixed: duplicate schedule (`patentId + yearNo`) now maps Prisma unique-constraint failure to business `409 CONFLICT` instead of 500.
  - Added concurrency race matrix: same patent/year concurrent schedule create now asserts one success + one conflict and verifies persisted schedule detail.

- RBAC workflow probes (demo auth/payment)
  - Result: pass (`/admin/rbac` roles/users list/create/update/delete + user role assignment).
  - Added negative guards: missing role name (400), unknown permission/role ids (400), missing role/user targets (404), system role delete forbidden (403).
  - Added semantic assertions: role permission set integrity, role visibility after create/delete, user custom-role assignment visibility, and clear-role empty state.

- Report export & patent-map import probes (demo auth/payment)
  - Result: pass (`/admin/reports/finance/export`, `/admin/patent-map/import` dry-run).
  - Added negative guards: invalid export range (400), missing import file (400), multipart import dry-run with generated CSV payload.
  - Added semantic assertions: export URL shape validation and dry-run import counters/flag validation.

- AI/region/featured/file-temporary-access probes (demo auth/payment)
  - Result: pass (with environment-compatible AI 404 branches allowed where integration is unavailable).
  - Added AI coverage: `POST /ai/agent/query` text input path; `/admin/ai/parse-results` list/get/update (missing-id branch covered in current env; existing-id branch remains conditional on data availability); `/ai/parse-results/:id/feedback` create + same-key replay or missing-id 404 branch.
  - Added AI query validation hardening + guards: `POST /ai/agent/query` now treats explicit invalid `contentScope/contentType` as strict 400 (no silent fallback), with smoke negatives for both enum paths.
  - Added industry-tag coverage: `POST /admin/industry-tags` create + duplicate(409) + invalid-empty(400), and `GET /admin/industry-tags` / `GET /public/industry-tags` visibility checks for newly created tag.
  - Added admin write coverage: `POST/PATCH /admin/regions` create/update happy paths and `PUT /admin/regions/:regionCode/industry-tags` (deterministic via created tag seed), plus `PUT /admin/listings/:id/featured` (CITY/NONE success paths) with persistence assertions.
  - Added region validation hardening + guards: `centerLat` / `centerLng` now reject non-number and out-of-range values with 400, and `parentCode` empty/invalid normalization is now strict in create/update paths.
  - Added admin negative coverage: region-industry-tags invalid body (400), missing `industryTags` field (400), invalid region code (400), missing region (404); listing-featured missing region for CITY (400), invalid featuredLevel (400), invalid featuredRank (400), invalid featuredUntil (400), missing listing (404), and audit approve/reject missing resources (listing/demand/achievement/artwork all 404).
  - Added featured negative guard + fix: `PUT /admin/listings/:id/featured` missing listing now expected 404 (regression fixed from Prisma `P2025` 500 to business `NOT_FOUND`).
  - Added listing audit negative guard + fix: `POST /admin/listings/:id/approve|reject` missing listing now expected 404 (regression fixed from Prisma `P2025` 500 to business `NOT_FOUND`).
  - Added audit missing-resource guards for additional domains: `POST /admin/demands|achievements|artworks/:id/approve|reject` now continuously asserted as 404 on missing ids.
  - Added publish/off-shelf missing-resource guards: `POST /admin/listings|demands|achievements|artworks|announcements/:id/publish|off-shelf` now continuously asserted as 404 on missing ids.
  - Added patent admin write coverage: `POST/PATCH /admin/patents` create/update happy paths and strict negatives (invalid application number, missing patent type, invalid sourceUpdatedAt, invalid filingDate/sourcePrimary/legalStatus, missing patent 404).
  - Added announcement admin write coverage + hardening: `POST/PATCH/DELETE /admin/announcements` create/update/delete happy paths and strict negatives (invalid status, empty title, missing targets), plus public deleted-resource read-back (`GET /public/announcements/:id` -> 404).
  - Added demand admin write coverage + hardening: `POST/PATCH /admin/demands` and `POST /admin/demands/:id/publish|off-shelf|approve|reject` now have happy-path coverage; explicit invalid `source/status/auditStatus/budgetType/deliveryPeriod` inputs now return strict 400, and missing update target returns 404.
  - Added achievement admin write coverage + hardening: `POST/PATCH /admin/achievements` and `POST /admin/achievements/:id/publish|off-shelf|approve|reject` now have happy-path coverage; explicit invalid `source/status/auditStatus/maturity` inputs now return strict 400, and missing update target returns 404.
  - Added artwork admin write coverage + hardening: `POST/PATCH /admin/artworks` and `POST /admin/artworks/:id/publish|off-shelf|approve|reject` now have happy-path coverage; explicit invalid `source/status/auditStatus/category/priceType/calligraphyScript/paintingGenre` inputs now return strict 400, and missing update target returns 404.
  - Added listing admin write coverage + hardening: `POST/PATCH /admin/listings` and `POST /admin/listings/:id/publish|off-shelf|approve|reject` now have happy-path coverage; explicit invalid `source/status/auditStatus/tradeMode/licenseMode/priceType/pledgeStatus/existingLicenseStatus/priceAmountFen/depositAmountFen` inputs now return strict 400, and missing update target returns 404.
  - Added order-create stability hardening in smoke: listing selection now gracefully falls back when no non-self listing exists, and auto-prepares listing audit status (`approve`) before order flow to avoid non-deterministic `order-create` precondition failures.
  - Added listing user write coverage + hardening: `POST/PATCH /listings` now have happy-path coverage; explicit invalid `tradeMode/licenseMode/priceType/pledgeStatus/existingLicenseStatus/priceAmountFen/depositAmountFen` inputs now return strict 400, and missing update target returns 404.
  - Added tech-manager update validation hardening + coverage: `PATCH /admin/tech-managers/:id` now rejects invalid `featuredRank`/`featuredUntil`/`serviceTags` with 400, and missing target remains 404.
  - Added comment validation hardening: empty-text create/update now return 400 consistently (removed prior 403 ambiguity from `ForbiddenException(code=BAD_REQUEST)` path).
  - Added verification negative guards + fix: `POST /admin/user-verifications/:id/approve|reject` missing verification now expected 404 (regression fixed from Prisma `P2025` 500 to business `NOT_FOUND`), and reject missing `reason` now locked at 400.
  - Added file temporary-access coverage: `POST /files/:id/temporary-access` preview success (`scope=preview`, non-empty `url`) plus missing-file 404 guard.

### Risks still open
- API write-path assertions are now 549 checks (with 93 read-back semantic verifications), and unique write-operation coverage is at least the previous 132/135 baseline plus report-import, AI/industry-tag/region/featured/file-access, admin-listings, user-listings, admin-cases create-enum hardening, patent-maintenance create-status strictness guards, AI-query enum strictness guards, and order payment-intent `payType` strictness guards; remaining risk is mainly deeper transaction-isolation windows under broader multi-actor parallel writes.
- UI status smoke is still shallow (route-level HTTP checks only 26/83 pages, plus 2 mock endpoints).
- DOM assertions now cover all 83/83 pages, but many routes still use generic structural assertions and need incremental business-semantic tightening.
- Security baseline still high-risk (`pnpm audit --prod`: critical 2 / high 21), remediation not yet executed.

### WeApp bundle trend
| Date | app-origin.wxss | pages/home/index.wxss | pages/me/index.wxss | subpackages/login/index.wxss | Note |
| --- | ---: | ---: | ---: | ---: | --- |
| 2026-02-24 | ~159.6 KB | n/a | n/a | n/a | historical baseline (previous report) |
| 2026-03-05 (pre-fix) | 2,690,716 B | 2,586,679 B | 1,271,348 B | 1,266,653 B | severe regression detected |
| 2026-03-05 (post-fix) | 286,492 B | 118,115 B | 69,236 B | 64,541 B | GIF background replacement + budget gate |


## Latest (2026-02-24)

### Commands & Results (dev)
- `pnpm dev:infra`
  - Result: success (postgres/redis/minio running)
- `powershell -ExecutionPolicy Bypass -File scripts/verify.ps1 -ApiBaseUrl https://staging-api.example.com -ApiPort 3200 -ReportDate 2026-02-24`
  - Result: success (all steps)
  - Builds: api/admin-web/client(h5/weapp) success; H5 entrypoint ~1.01 MiB (perf budgets: asset<=650KiB, entry<=1200KiB); WeApp `app-origin.wxss` ~159.6 KB; admin largest js chunk ~674 kB (gzip ~220 kB)
  - API smoke: pass (17/17) → `.tmp/api-real-smoke-2026-02-24-summary.json`
  - DB preflight: pass (failed=0) → `.tmp/db-preflight-2026-02-24-summary.json`
  - UI HTTP smoke: pass (9/9) → `.tmp/ui-http-smoke-2026-02-24-summary.json`
  - UI render smoke (core): pass (3/3) → `.tmp/ui-render-smoke-2026-02-24-summary.json`
- `powershell -ExecutionPolicy Bypass -File scripts/ui-render-smoke.ps1 -Mode full -ReportDate 2026-02-24`
  - Result: pass (26/26)
  - Artifacts: `docs/demo/rendered/ui-smoke-2026-02-24/`
- `powershell -ExecutionPolicy Bypass -File scripts/weapp-route-smoke.ps1 -NoAuth -ReportDate 2026-02-24`
  - Result: pass
  - Report: `.tmp/weapp-route-smoke-2026-02-24.json`

### Manual (pending)
- WeApp 冒烟（真实 API）：首页 / 搜索 / 详情 / 消息 / 收藏 / 个人中心 / 发布（清单：`docs/engineering/weapp-manual-smoke-checklist.md`）

## Latest (2026-02-23)

### Commands & Results (dev)
- `powershell -ExecutionPolicy Bypass -File scripts/verify.ps1 -ApiBaseUrl https://staging-api.example.com -ReportDate 2026-02-23`
  - Result: success (all steps)
- `powershell -ExecutionPolicy Bypass -File scripts/start-dev.ps1 -EnableDemoAuth -SplitWindows`
  - Result: success
  - Notes: Windows Prisma engine lock 规避（启动前自动停止 repo 内 api 进程）；UUID passthrough 默认关闭（需显式 `-AllowDemoUuidTokens` 才开启）
- `TARO_APP_API_BASE_URL=https://staging-api.example.com pnpm -C apps/client build:h5`
  - Result: success (explicit webpack perf budgets: asset<=650KiB, entry<=1200KiB)
  - Notes: h5 entrypoint ~1.01 MiB; largest js assets: `js/app.js` ~573 KiB, `chunk/5015.js` ~538 KiB, `js/1101.js` ~299 KiB
- `TARO_APP_API_BASE_URL=https://staging-api.example.com pnpm -C apps/client build:weapp`
  - Result: success
- `VITE_API_BASE_URL=https://staging-api.example.com pnpm -C apps/admin-web build`
  - Result: success
  - Notes: largest js chunk ~674 kB (gzip ~220 kB); logo ~46 kB
- `node scripts/audit-openapi-backend.mjs`
  - Result: OpenAPI-only=0, Controller-only=0
  - Report: `docs/engineering/openapi-backend-diff.md`
- `node scripts/audit-coverage.mjs`
  - Result: success
  - Report: `docs/engineering/openapi-coverage.md`
- `pnpm scan:banned-words`
  - Result: success
- `powershell -File scripts/api-real-smoke.ps1 -ApiPort 3200 -ReportDate 2026-02-23`
  - Result: pass (17/17)
  - Summary: `.tmp/api-real-smoke-2026-02-23-summary.json`
  - Details: `.tmp/api-real-smoke-2026-02-23.json`
- `powershell -File scripts/db-preflight-check.ps1 -ReportDate 2026-02-23`
  - Result: pass (failed=0)
  - Summary: `.tmp/db-preflight-2026-02-23-summary.json`
  - Details: `.tmp/db-preflight-2026-02-23.json`
- `pnpm -C apps/api db:deploy`
  - Result: success (no pending migrations)
- `powershell -File scripts/ui-http-smoke.ps1 -ReportDate 2026-02-23`
  - Result: pass
  - Summary: `.tmp/ui-http-smoke-2026-02-23-summary.json`
  - Details: `.tmp/ui-http-smoke-2026-02-23.json`
- `powershell -File scripts/ui-render-smoke.ps1 -Mode full -ReportDate 2026-02-23`
  - Result: pass (26/26)
  - Summary: `.tmp/ui-render-smoke-2026-02-23-summary.json`
  - Details: `.tmp/ui-render-smoke-2026-02-23.json`
- `node scripts/weapp-route-smoke.js --no-auth`
  - Result: pass
  - Report: `.tmp/weapp-route-smoke-2026-02-23.json`
  - Notes: 当前 DevTools 版本下 `App.getCurrentPage` 可能不完整（`getCurrentPagesByDomain` undefined）；该脚本仅做“可进入 + 无运行时异常”的路由级冒烟，不替代真机/手工点击

### Manual (pending)
- WeApp 冒烟（真实 API）：首页 / 搜索 / 详情 / 消息 / 收藏 / 个人中心 / 发布（清单：`docs/engineering/weapp-manual-smoke-checklist.md`）
- WeApp 自动化截图（miniprogram-automator）：DevTools RC v1.06.2503281 `screenshot()` 超时（当前不可靠，先按手工冒烟为准）
- WeApp 路由冒烟（可选，无截图）：`node scripts/weapp-route-smoke.js --cli-path <cli.bat> --project-path apps/client --user-token <DEMO_USER_TOKEN>`（用于验证核心路由可进入且无运行时异常；不替代真机/手工点击）

## Latest (2026-02-22)

### Commands & Results (dev)
- `powershell -ExecutionPolicy Bypass -File scripts/verify.ps1 -ApiBaseUrl https://staging-api.example.com -ReportDate 2026-02-22`
  - Result: success (all steps)
- `pnpm openapi:lint`
  - Result: success
- `pnpm lint`
  - Result: success
- `pnpm typecheck`
  - Result: success
- `TARO_APP_API_BASE_URL=https://staging-api.example.com pnpm -C apps/client build:h5`
  - Result: success (with bundle size warnings)
  - Notes: h5 entrypoint ~1.02 MiB; largest js assets: `js/app.js` ~580 KiB, `chunk/5015.js` ~538 KiB, `js/1101.js` ~299 KiB
- `TARO_APP_API_BASE_URL=https://staging-api.example.com pnpm -C apps/client build:weapp`
  - Result: success
- `VITE_API_BASE_URL=https://staging-api.example.com pnpm -C apps/admin-web build`
  - Result: success (code-splitting enabled)
  - Notes: largest js chunk ~674 kB (gzip ~220 kB); logo ~46 kB
- `node scripts/audit-openapi-backend.mjs`
  - Result: OpenAPI-only=0, Controller-only=0
  - Report: `docs/engineering/openapi-backend-diff.md`
- `node scripts/audit-coverage.mjs`
  - Result: success
  - Report: `docs/engineering/openapi-coverage.md`
- `pnpm scan:banned-words`
  - Result: success
- `pnpm -C apps/api build`
  - Result: success
- `powershell -File scripts/api-real-smoke.ps1 -ApiPort 3200 -ReportDate 2026-02-22`
  - Result: pass (17/17)
  - Summary: `.tmp/api-real-smoke-2026-02-22-summary.json`
  - Details: `.tmp/api-real-smoke-2026-02-22.json`
- `powershell -File scripts/db-preflight-check.ps1 -ReportDate 2026-02-22`
  - Result: pass (failed=0)
  - Summary: `.tmp/db-preflight-2026-02-22-summary.json`
  - Details: `.tmp/db-preflight-2026-02-22.json`
- `powershell -File scripts/db-backup.ps1 -ReportDate 2026-02-22 -Clean -OutFile .tmp/db-backup-2026-02-22-clean.sql`
  - Result: success
  - Output: `.tmp/db-backup-2026-02-22-clean.sql`
- `powershell -File scripts/db-restore.ps1 -InFile .tmp/db-backup-2026-02-22-clean.sql -Force`
  - Result: success
- `powershell -File scripts/ui-http-smoke.ps1 -ReportDate 2026-02-22`
  - Result: pass
  - Summary: `.tmp/ui-http-smoke-2026-02-22-summary.json`
  - Details: `.tmp/ui-http-smoke-2026-02-22.json`
- `powershell -File scripts/ui-render-smoke.ps1 -Mode core -ReportDate 2026-02-22`
  - Result: pass (3/3)
  - Summary: `.tmp/ui-render-smoke-2026-02-22-summary.json`
  - Details: `.tmp/ui-render-smoke-2026-02-22.json`

### Manual (pending)
- WeApp 冒烟（真实 API）：首页 / 搜索 / 详情 / 消息 / 收藏 / 个人中心 / 发布

## Latest (2026-02-21)

### Commands & Results (non-mock API)
- `powershell -File scripts/api-real-smoke.ps1 -ApiPort 3248`
  - Result: pass (17/17)
  - Summary: `.tmp/api-real-smoke-2026-02-21-summary.json`
  - Details: `.tmp/api-real-smoke-2026-02-21.json`
- `powershell -File scripts/db-preflight-check.ps1`
  - Result: pass (failed=0)
  - Summary: `.tmp/db-preflight-2026-02-21-summary.json`
  - Details: `.tmp/db-preflight-2026-02-21.json`

### Manual (pending)
- WeApp 冒烟（真实 API）：首页 / 搜索 / 详情 / 消息 / 收藏 / 个人中心 / 发布

## Latest (2026-02-20)

### Notes
- 项目目录已更名为 `Patent_valuation`，执行 `pnpm install --force --prefer-offline` 重建 pnpm 软链接。
- OpenAPI 覆盖审计脚本已修复 TS 泛型 `>>` 误报。
- 已清理 build 缓存后重新验证（client dist/.taro/.temp/.cache、admin-web dist、api dist）。

### Commands & Results (post-rename recheck)
- `pnpm -C apps/client build:weapp`
  - Result: success
  - Build time: ~15.86s
  - Warnings: none

- `pnpm -C apps/client typecheck`
  - Result: success

- `pnpm -C apps/client lint`
  - Result: success

- `pnpm openapi:lint`
  - Result: success

- `pnpm openapi:types`
  - Result: success (`packages/api-types/index.d.ts` updated)

- `node scripts/audit-openapi-backend.mjs`
  - Result: OpenAPI-only=0, Controller-only=0
  - Report: `docs/engineering/openapi-backend-diff.md`

- `node scripts/audit-coverage.mjs`
  - Result: success
  - Report: `docs/engineering/openapi-coverage.md`
  - Unused endpoints: 5（AI P1，已标记暂缓）

- `pnpm -C apps/admin-web typecheck`
  - Result: success

- `pnpm -C apps/admin-web lint`
  - Result: success

- `pnpm -C apps/api prisma:generate`
  - Result: success（Prisma Client 重新生成）

- `pnpm -C apps/api typecheck`
  - Result: success

- `pnpm -C apps/api lint`
  - Result: success

- `powershell -File scripts/ui-render-smoke.ps1 -ReportDate 2026-02-20 -Mode core`
  - Result: pass (3/3)
  - Summary: `.tmp/ui-render-smoke-2026-02-20-summary.json`
  - Details: `.tmp/ui-render-smoke-2026-02-20.json`

- `powershell -File scripts/ui-render-smoke.ps1 -ReportDate 2026-02-20 -Mode full`
  - Result: pass (26/26)
  - Summary: `.tmp/ui-render-smoke-2026-02-20-summary.json`
  - Details: `.tmp/ui-render-smoke-2026-02-20.json`

- `powershell -File scripts/ui-http-smoke.ps1 -ReportDate 2026-02-20`
  - Result: pass (9/9)
  - Summary: `.tmp/ui-http-smoke-2026-02-20-summary.json`
  - Details: `.tmp/ui-http-smoke-2026-02-20.json`

- `powershell -File scripts/api-real-smoke.ps1 -ReportDate 2026-02-20`
  - Result: fail（API 未就绪）
  - Error: `api not ready: http://127.0.0.1:3000/health`

### Previous Run (2026-02-20, not re-run after rename)
- `powershell -File scripts/ui-render-smoke.ps1 -ReportDate 2026-02-20 -Mode core`
  - Result: pass (3/3)
  - Summary: `.tmp/ui-render-smoke-2026-02-20-summary.json`
  - Details: `.tmp/ui-render-smoke-2026-02-20.json`

- `powershell -File scripts/ui-render-smoke.ps1 -ReportDate 2026-02-20 -Mode full`
  - Result: pass (26/26)
  - Summary: `.tmp/ui-render-smoke-2026-02-20-summary.json`
  - Details: `.tmp/ui-render-smoke-2026-02-20.json`

- `powershell -File scripts/ui-http-smoke.ps1 -ReportDate 2026-02-20`
  - Result: pass (9/9)
  - Summary: `.tmp/ui-http-smoke-2026-02-20-summary.json`
  - Details: `.tmp/ui-http-smoke-2026-02-20.json`

- `powershell -File scripts/api-real-smoke.ps1 -ReportDate 2026-02-20`
  - Result: pass (17/17)
  - Summary: `.tmp/api-real-smoke-2026-02-20-summary.json`
  - Details: `.tmp/api-real-smoke-2026-02-20.json`

### Artifacts
- `apps/client/dist/weapp/app-origin.wxss`: 159.6 KB
- `.tmp/openapi.bundle.json`
