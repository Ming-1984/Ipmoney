# Ipmoney Full Quality Remediation TODO (Complete)

> Updated: 2026-03-07
> Scope: `apps/api`, `apps/client`, `apps/admin-web`, `scripts`, CI/CD, engineering docs
> Constraint: Real login/payment integrations are out of scope for this phase.

## 1. Current Baseline (for planning)

### 1.1 Quality gates status
- `typecheck`: pass (api/client/admin-web).
- `build`: pass (api/admin-web/client h5/weapp); WeApp severe regression has been fixed in this batch, and bundle gate is now enforced.
- `smoke`: pass (API 1180/1180, UI HTTP 86/86, UI Render full 83/83, UI Render core 3/3, UI DOM core 11/11, UI DOM full-83 83/83).
- `verify`: pass on 2026-03-07 (now includes `api-smoke-openapi-coverage` + `api-smoke-quality-floor` + `ui-dom-smoke(core)` in pipeline); port/process hardening has been applied to core smoke scripts.
- `weapp-route-smoke`: local fail due DevTools HTTP port availability (environment issue).

### 1.2 Coverage and test capability
- OpenAPI operations: 243 (GET 108 / POST 93 / PUT 12 / PATCH 21 / DELETE 9).
- API smoke covers 1180 checks (including semantic read-back/state assertions).
- OpenAPI smoke alignment (excluding login/payment integrations): 238/238 operations covered, and this is now regression-gated in `verify`.
- API smoke quality floor gate (coverage intensity): active in `verify` with minimum thresholds on total assertions, write/read counts, negative-path count, key error-code distribution, and admin negative density.
- Write operations total 135; smoke now executes 866 write assertions plus 93 read-back semantic checks (state transitions, persistence, cross-module link integrity, same-key replay invariants, selected concurrency race outcomes, percentile-based chaos stability guard, cross-run trend-threshold capability, and AI/industry-tag/region/featured/file-temporary-access/admin-listings-write/user-listings-write/admin-cases-create-enum/patent-strict-negative/patent-maintenance-create-status/ai-query-strict-enum/order-payment-intent-strict-pay-type/RBAC-401-403-write-boundary/user-write-401-boundary-expanded/admin-settlement-refund-full-lifecycle-auth-boundary/admin-case-maintenance-verification-reject-auth-boundary/admin-config-write-401-403-convergence/admin-domain-write-401-403-convergence-round2/admin-content-write-401-403-convergence-round3/admin-residual-write-401-403-convergence-round4/admin-alert-comment-write-convergence-round5/admin-patent-map-entry-upsert-and-patents-normalize-write-convergence-round6/patent-map-year-strict-integer-round7/reports-days-strict-round8/ai-feedback-score-strict-round9/file-temp-ttl-strict-round10/contract-signed-deal-amount-strict-round11/search-listings-numeric-filter-strict-round12/listing-featured-empty-rank-strict-round13/maintenance-schedule-year-strict-round14/tech-manager-featured-rank-strict-round15 assertions), while unique write-operation coverage remains at least prior 132/135 baseline.
- Non-admin secured write-path 401 boundary: fully covered in smoke except `/auth/wechat/phone-bind` (login-scope, intentionally out of current phase).
- Admin secured config write-path boundary (`PUT /admin/config/*`): all 8 endpoints now include unauthorized/custom-role/after-clear forbidden convergence checks.
- Additional admin write-path boundary closure: `industry-tags / regions / region-industry-tags / listings-featured / tech-managers / patent-map-import / rbac-role-create / order-issue-invoice` now include unauthorized/custom-role/after-clear forbidden checks.
- Additional admin content write-path boundary closure: `listings / demands / achievements / artworks` create+update+approve+publish+off-shelf+reject now include unauthorized/custom-role/after-clear forbidden checks.
- Remaining admin write-path closure completed: `announcements / patents / cases-notes / rbac role-user mutation(custom-role)`, and `admin ai parse-result update` now uses unauthorized/forbidden checks with missing-id `404` compatibility (resource check may precede auth).
- Highest uncovered write concentration remains in `/admin` (77 write operations; still the largest uncovered write domain).
- No `.test` / `.spec` business tests under `apps` and `packages`.

### 1.3 Code rigor
- `apps/api/src`: ~750 `any` usages (74 files).
- `apps/client/src`: ~302 `any` usages (56 files).
- `apps/admin-web/src`: ~125 `any` usages (24 files).
- `@Body() ...: any` appears ~65 times.
- `apps/api/src/main.ts` lacks global `ValidationPipe`.

### 1.4 WeApp bundle/perf risk
- `apps/client/dist/weapp/app-origin.wxss`: 286,492 bytes (~279.8 KiB) after fix (was 2,690,716 bytes).
- `apps/client/dist/weapp/pages/home/index.wxss`: 118,115 bytes (~115.3 KiB) after fix (was 2,586,679 bytes).
- `apps/client/dist/weapp/pages/me/index.wxss`: 69,236 bytes (~67.6 KiB) after fix (was 1,271,348 bytes).
- `apps/client/dist/weapp/subpackages/login/index.wxss`: 64,541 bytes (~63.0 KiB) after fix (was 1,266,653 bytes).
- Current values are back under the phase budget guard (`app-origin` < 500 KB, key pages < 200 KB).

### 1.5 UI coverage blind spots
- Client configured pages: 58 (`apps/client/src/app.config.ts`); render smoke full covers 58 (100%), gap 0.
- Admin routes: 25 (including `/login` and `/`); render smoke full covers 25 (100%), gap 0.
- Page/API/test matrix has been established for all 83 pages: `docs/engineering/page-api-test-matrix-2026-03-05.md`.
- DOM assertions now cover all 83 pages (`ui-dom-smoke` mode `full-83`), including all client/admin routes in current matrix.
- Remaining blind spots: `ui-http-smoke` route reachability now covers all 83 configured page routes plus app root (86 checks including 2 mock endpoints), and now also checks content-type/body-length semantics, but still needs deeper page-business semantics; DOM assertions also need continued semantic hardening on some pages.
- E2E path automation is still pending for critical client/admin journeys.

### 1.6 Dependency/security baseline
- `pnpm audit --prod`: 42 vulns (critical 2 / high 21 / moderate 14 / low 5).
- Notable hot packages: `axios`(5), `follow-redirects`(4), `fast-xml-parser`(3), `multer`(3), `swiper`(1), `xlsx`(2).
- CI currently has no vulnerability gate.

### 1.7 Engineering consistency
- Tracked files with UTF-8 BOM: ~145 (`apps` 116 / `docs` 25 / `packages` 3 / root 1).
- BOM in generated JSON artifacts causes cross-tool parsing noise.

### 1.8 Script robustness
- `verify` port fallback was fixed in this batch; remaining auxiliary scripts (for example WeApp route smoke) still need the same resilience pattern.
- `api-real-smoke` / `ui-http-smoke` / `ui-render-smoke` / `ui-dom-smoke` now avoid kill-by-port and use child-process cleanup + dynamic port fallback.
- `api-real-smoke` now disables local rate-limit (`RATE_LIMIT_ENABLED=false`) during run to reduce false 429 flakiness while validating business paths.
- `api-real-smoke` now keeps a larger response truncation ceiling (64 KB) to prevent false JSON-assert failures on large list payloads.
- `verify` now appends `NODE_OPTIONS=--max-old-space-size=4096` and retries transient `client:build:h5` crash exit codes once.
- `verify` now passes configurable chaos history path into `api-real-smoke` and writes per-report snapshots (`.tmp/api-real-smoke-chaos-history-<ReportDate>.json`) for trend reproducibility.
- `verify` now runs `api-smoke-openapi-coverage` immediately after `api-real-smoke` to block non-auth/non-payment OpenAPI coverage regressions.
- `verify` now runs `api-smoke-quality-floor` immediately after coverage gate to block major regressions in negative/semantic assertion density.

---

## 2. Execution strategy

- **P0 close-out first**: A + D + H + N.
- **P1 hardening**: B/C/E/F/G/J/M first-stage items.
- **P2 institutionalize**: K/L and long-term process controls.
- Every task must have acceptance criteria, artifacts, and script-reproducible steps.

---

## 3. Full TODO

## A. Quality gates and build stability (P0)
- [x] A01 Fix current lint blocker (Inventors unused variable).
  - Acceptance: full repo `pnpm lint` passes.
- [x] A02 Run `scripts/verify.ps1` to full green baseline (excluding real login/payment).
  - Acceptance: openapi lint, lint, typecheck, build, api smoke, api smoke openapi coverage, api smoke quality floor, db preflight, ui http smoke, ui render smoke(core) all pass.
- [x] A03 Improve `verify` port resilience for OS reserved-port scenarios.
  - Acceptance: auto fallback works even when `ApiPort..ApiPort+30` is unavailable.
- [x] A04 Fix admin config write-path 500 regression (`/admin/config/*`).
  - Acceptance: `PUT /admin/config/trade-rules|customer-service|recommendation|alerts|banner|taxonomy|sensitive-words|hot-search` all return 200 and create audit logs successfully.

## B. Test system completion (P0-P1)
- [ ] B01 Introduce API unit/integration test framework (Vitest/Jest + Supertest + test DB).
  - Acceptance: executable `test` scripts in `apps/api`; CI can run minimal set.
- [ ] B02 Build write-first API test inventory (orders/refunds/invoices/comments/favorites/addresses/audit flow).
  - Acceptance: first batch covers >=30 key write APIs with success/failure/idempotency assertions.
  - Progress: smoke batch now executes 866 write assertions (favorites/comments/addresses/conversations/consultations + auth + admin-config writes + admin order/refund negative paths + order/admin happy-path state transitions + file-dependent payout/invoice paths + refund approve/complete/reject lifecycle checks + admin case workflows + admin case-create strict invalid type/status/priority negatives + patent-maintenance schedules/tasks workflows + rbac role/user workflows + reports export + patent-map import + patent-map entry upsert + patents normalize + AI parse/feedback + admin industry-tag create/duplicate-invalid + admin patents create/update happy-path + patents strict-validation negatives (including invalid sourcePrimary/legalStatus create/update) + admin announcements create/update/delete happy-path + announcements strict-validation negatives + admin demands create/update/publish/off-shelf/approve/reject happy-path + strict invalid-enum negatives + admin achievements create/update/publish/off-shelf/approve/reject happy-path + strict invalid-enum negatives + admin artworks create/update/publish/off-shelf/approve/reject happy-path + strict invalid-enum negatives + admin listings create/update/publish/off-shelf/approve/reject happy-path + strict invalid-enum-and-amount negatives + user listings create/update happy-path + strict invalid-enum-and-amount negatives + region create/update happy-path + region create/update strict-validation negatives + region industry-tags success/invalid-body/missing-field/invalid-code/missing paths + listing featured CITY/NONE success + listing featured validation negatives (missing region/invalid level/rank/until/missing listing) + listing featured empty-rank strict negatives + listing/demand/achievement/artwork approve/reject missing-id 404 negatives + admin listing/demand/achievement/artwork/announcement publish/off-shelf missing-id 404 negatives + admin tech-manager update missing-id/invalid-rank/empty-rank/invalid-until/invalid-service-tags negatives + tech-manager update happy-path assertion + admin order manual-payment/contract/transfer/payout/invoice invalid-datetime negatives + admin order contract-signed strict deal-amount negatives + admin maintenance schedule year strict negatives + file temporary-access create + comment empty-text create/update strict-400 negatives + user-verification approve/reject missing-id 404 + reject-missing-reason 400 negatives + same-key replay probes for order/payment/invoice/refund/AI feedback + concurrency race matrices including mixed payout/invoice/refund overlap + repeated mixed bursts on same aggregate + cross-order parallel payouts + staggered mixed-tail overlap + jittered repeated overlap loops + randomized multi-iteration seeded overlap harness + randomized multi-order/multi-aggregate overlap harness + larger-seed chaos overlap harness with percentile + trend guards + order-flow precondition hardening + maintenance create-status strict negatives + ai-query strict negatives + order-payment-intent payType strict negatives + search-enum strict negatives + search-listings numeric-filter strict negatives + public detail read-path assertions + rbac privilege-boundary assertions (including minimal-permission `report.read` allow + multi-admin-forbidden matrix + critical admin write-forbidden checks + expanded admin read-surface forbidden checks + unauthenticated 401 boundary checks + critical admin write-path unauthorized/post-clear convergence checks including report-export and rbac role/user mutation endpoints + admin settlement/refund full-lifecycle write-path unauthorized and convergence checks + admin case/maintenance/verifications-reject write-path unauthorized and convergence checks + admin config write-path unauthorized/custom-role/post-clear convergence checks across all 8 `PUT /admin/config/*` endpoints + admin industry-tags/regions/region-industry-tags/listing-featured/tech-manager/patent-map-import/rbac-role-create/order-issue-invoice unauthorized-custom-role-post-clear convergence checks + admin listings/demands/achievements/artworks full write-surface unauthorized-custom-role-post-clear convergence checks + admin announcements/patents/case-notes/rbac-mutation(custom-role) convergence checks + ai-parse-result update 404-compatible boundary checks + admin alerts ack/admin comments update write-surface (happy/missing/invalid + unauthorized/custom-role/post-clear + status transition read-back) checks + admin patent-map entry upsert and patents-normalize convergence checks + patent-map year integer strict-negatives + reports days strict-invalid negatives + ai-parse-feedback score strict-invalid negatives + file-temporary-access ttl strict-invalid negatives + contract-signed dealAmountFen strict-invalid negatives + search-listings numeric-filter strict-invalid negatives + listing-featured empty-rank strict-invalid negatives + maintenance-schedule year strict-invalid negatives + tech-manager featuredRank empty strict-invalid negatives) + user-side critical write-path unauthorized checks (order create/payment-intent/refund/invoice-request + favorites add/remove + comments update/delete + address update/delete + conversation upsert/read + message send + listing create/update + listing consultations create + AI parse feedback create(existing-id) + file temporary-access create/missing + file upload + me patch + me verification + listing submit/off-shelf + demand/achievement/artwork create/update/submit/off-shelf + demand/achievement/artwork comment create/delete + contract upload) + me-verification strict enum negatives + pagination strict negatives for order/invoice/search/announcements/organizations/audit-logs/contracts/cases/alerts/notifications/comments/favorites/conversations/ai/maintenance/patents/user-verifications endpoints), plus 93 semantic read-back checks for state continuity/persistence integrity, with failure/idempotency assertions, targeted regression checks, mixed-race invoice consistency closure, randomized outcome-distribution assertions, percentile-based stability thresholding, and cross-run trend baseline support added.
- [ ] B03 Add frontend E2E for key H5/admin paths (excluding real login/payment).
  - Acceptance: homepage/search/detail/publish/order/audit flows are script-regressible.
- [x] B04 Upgrade `api-real-smoke` from read-heavy to read-write balanced.
  - Acceptance: write coverage raised from 1.48% to >=20% (phase 1). (done: >=132/135 unique operations covered, currently 866 write assertions executed in smoke)
- [ ] B05 Define per-domain write coverage targets (`admin`, `listings`, `demands`, `achievements`, `artworks`, `me`, `orders`).
  - Acceptance: each domain has target + template assertions.

## C. API rigor and typing governance (P0-P2)
- [ ] C01 Introduce DTO validation (`class-validator` + `class-transformer` + global `ValidationPipe`).
  - Acceptance: all updated/new endpoints have DTOs; invalid input returns normalized 400.
- [ ] C02 Reduce Controller `any` (priority: orders/listing/audit/ticket modules).
  - Acceptance: `@Body() ...: any` drops from ~65 to <=20.
- [ ] C03 Reduce Service-layer `any` hotspots.
  - Acceptance: `apps/api/src` `any` count down >=40% (phase target).
- [ ] C04 Add state-machine assertions (order/refund/invoice transitions).
  - Acceptance: illegal transitions are blocked with automated positive/negative tests.

## D. WeApp bundle and frontend performance (P0)
- [x] D01 Identify WeApp style bloat root causes (NutUI imports/global injection/duplication).
  - Acceptance: root-cause report with file-level contribution and fix plan. (done: `docs/engineering/weapp-bundle-root-cause-2026-03-05.md`)
- [x] D02 Reduce `app-origin.wxss` and core page wxss size.
  - Acceptance: `app-origin.wxss` first target <500 KB, then continuous reduction. (done: 286,492 bytes)
- [x] D03 Add hard WeApp bundle budget gate (fail, not warning).
  - Acceptance: CI/local verify fails when threshold exceeded. (done: `scripts/check-weapp-bundle-budget.mjs` + CI/verify integration)
- [x] D04 Track bundle trend by day/PR.
  - Acceptance: trend section added to `docs/engineering/test-report.md`. (done)

## E. Security surface and authorization (P1)
- [ ] E01 Review `/uploads` direct exposure vs controlled download risk.
  - Acceptance: production policy defined + regression tests.
- [ ] E02 Upgrade memory rate-limit to scalable distributed limit (Redis).
  - Acceptance: consistent behavior across multi-instance with stress validation.
- [ ] E03 Add security tests for high-risk APIs (IDOR/guessing/replay/duplicate submit).
  - Acceptance: automated privilege/abuse tests for admin/order/file APIs.
  - Progress: RBAC privilege-boundary smoke matrix landed (`report.read` allow + forbidden checks on listings/audit-logs/cases/maintenance/user-verifications/config/rbac/report-export and admin order/case/maintenance/verification write endpoints, plus unauthorized 401 checks and post-role-clear 403 convergence checks on critical admin write paths including report-export, RBAC role/user mutation, settlement/refund full-lifecycle, and admin case/maintenance/verifications-reject write endpoints), `requirePermission` deny path is normalized to 403 (not 500), and `BearerAuthGuard` no longer elevates `isAdmin` by arbitrary custom role assignment.

## F. Data consistency and DB quality (P1)
- [ ] F01 Expand `db-preflight` to post-write validation scenarios.
  - Acceptance: flow tests auto-run consistency checks and archive results.
- [ ] F02 Build staging snapshot replay workflow.
  - Acceptance: migration + preflight + replay before release with unified report.
- [ ] F03 Add slow-query baseline and index review report.
  - Acceptance: top SQL latency baseline with optimization actions.

## G. CI/CD and observability (P1)
- [ ] G01 Add test stage in CI (API integration + minimal frontend e2e).
  - Acceptance: PR must pass business tests, not only lint/typecheck/build.
- [ ] G02 Run smoke scripts in reproducible environment.
  - Acceptance: local and CI parity with actionable failure logs.
- [ ] G03 Improve metrics baseline (error rate, latency, key flow success).
  - Acceptance: metric catalog + alert thresholds + dashboard/config artifact.
- [ ] G04 Add vulnerability gate in CI (at least block critical).
  - Acceptance: new critical vulns fail PR/main build.

## H. Documentation and release governance (P0-P1)
- [x] H01 Update `docs/engineering/test-report.md` with latest results and risk notes.
  - Acceptance: commands/results/failures/fix-status traceable.
- [ ] H02 Sync `docs/engineering/overall-todo.md` with this file as single source.
  - Acceptance: no conflicting dual-track TODOs.
- [ ] H03 Maintain execution board fields (owner/plan/completion/blocker).
  - Acceptance: all active tasks have owner and timebox.

## I. Deferred (out of current execution)
- [ ] I01 Real WeChat login.
- [ ] I02 Real WeChat payment/refund/callback verification.
- [ ] I03 AI production integration.

## J. Page coverage and regression matrix completion (P0-P1)
- [x] J01 Build 3D matrix: page-api-test (client/admin).
  - Acceptance: each page maps to HTTP/render/e2e/manual coverage + owner. (done: `docs/engineering/page-api-test-matrix-2026-03-05.md`, generated by `scripts/build-page-api-test-matrix.mjs`)
- [x] J02 Extend `ui-render-smoke` to missing admin core routes.
  - Acceptance: admin coverage from 48% to >=80% (phase 1). (done: 25/25 = 100%)
- [x] J03 Extend `ui-render-smoke` to key client subpackage pages.
  - Acceptance: client coverage from 24.1% to >=60% (phase 1). (done: 58/58 = 100%)
- [x] J04 Upgrade UI smoke from status-only to DOM assertion based.
  - Acceptance: each page has 1-2 stable business DOM assertions. (done for core 11 pages via `scripts/ui-dom-smoke.ps1` + `scripts/dump-dom-cdp.mjs`)
- [x] J05 Execute gap closure in batches (>=8 pages per batch).
  - Acceptance: each batch updates coverage stats and remaining gap list. (done in 2026-03-05 batch: full-mode 83/83)
- [x] J06 Expand DOM assertions to first full-mode batch.
  - Acceptance: DOM assertions cover >=30 pages with stable pass. (done: `ui-dom-smoke -Mode full` -> 36/36, mode `full-batch1`)
- [x] J07 Continue DOM expansion from 36/83 to full 83/83.
  - Acceptance: each new batch adds >=8 pages and updates matrix/risk notes. (done: `ui-dom-smoke -Mode full` -> 83/83, mode `full-83`)
- [x] J08 Expand `ui-http-smoke` route reachability to full client/admin page set.
  - Acceptance: checks include all 83 configured client/admin page routes (plus mock endpoints), with script-generated client route list from app config. (done: `ui-http-smoke` 86/86)
- [x] J09 Add response-shape assertions to `ui-http-smoke`.
  - Acceptance: every HTTP smoke probe asserts expected content type and minimum response body length in addition to status code.

## K. Dependency security and version governance (P0-P2)
- [x] K01 Build vulnerability ledger (severity + business impact + upgradeability).
  - Acceptance: prioritized remediation strategy per issue. (done: `docs/engineering/vulnerability-ledger-2026-03-05.md`, generated by `scripts/audit-vulnerability-ledger.mjs`)
- [ ] K02 Resolve critical/high fixable issues first.
  - Acceptance: critical to 0, high significantly reduced.
- [ ] K03 Add vulnerability gate to CI.
  - Acceptance: new critical blocked in PR/mainline.
- [ ] K04 Define periodic dependency upgrade cadence (weekly/monthly) + regression scripts.
  - Acceptance: fixed upgrade windows and rollback/testing playbook.

## L. Engineering consistency and maintainability (P1)
- [ ] L01 Standardize encoding (remove BOM, enforce UTF-8 no-BOM policy).
  - Acceptance: tracked BOM count reduced from ~145 toward 0 (phase-based cleanup).
- [ ] L02 Standardize script output encoding (PowerShell/Python/Node).
  - Acceptance: logs and reports parse consistently cross-platform.
- [ ] L03 Script key quality metrics (coverage/any count/bundle trend/vuln count).
  - Acceptance: one-command weekly quality report generation.

## M. Feature-level usability closure (P0-P1)
- [ ] M01 Build client feature closure matrix (exclude real login/payment).
  - Acceptance: all major client areas have reproducible validation paths.
- [ ] M02 Build admin feature closure matrix.
  - Acceptance: each admin module has at least one happy-path + one failure-path check.
- [ ] M03 Validate demo auth/payment boundary behavior (dev enabled, staging/prod blocked).
  - Acceptance: script-enforced checks for both usability and safety boundaries.

## N. Script resilience and environment compatibility (P0-P1)
- [x] N01 Upgrade `verify` port selection (preferred + extended scan + random fallback).
  - Acceptance: stable execution on Windows excluded-port scenarios.
- [x] N02 Refactor smoke process cleanup (kill only spawned child processes).
  - Acceptance: no accidental termination of unrelated local services.
- [x] N03 Add collision self-healing and clear diagnostics to smoke scripts.
  - Acceptance: conflicts auto-resolve or fail with explicit retry guidance.
- [x] N04 Add memory/process hardening for long smoke/verify runs.
  - Acceptance: no leaked process trees after smoke runs; verify survives transient `client:build:h5` crashes with bounded retry.
- [x] N05 Add OpenAPI-to-smoke coverage gate in `verify` (excluding real login/payment integrations).
  - Acceptance: `verify` fails if any non-auth/non-WeChatPay webhook OpenAPI operation is missing from `api-real-smoke`.
- [x] N06 Add API smoke quality-floor gate in `verify`.
  - Acceptance: `verify` fails when API smoke total/write/read/negative-depth or key error-code distribution regresses below minimum baseline.

---

## 4. Milestones and exit criteria

### M1 (P0 close-out)
- Condition: P0 items in A + D + H + N completed.
- Exit:
  - full lint/typecheck/build/verify green;
  - WeApp bundle significantly reduced with hard gate;
  - test report and TODO synchronized.

### M2 (P1 hardening)
- Condition: first-stage B/C/E/F/G/J/M completed.
- Exit:
  - write API automation reaches phase target;
  - security/permission/data consistency have regression automation;
  - CI has business-test + vulnerability gates;
  - page automation coverage reaches phase target.

### M3 (P2 institutionalization)
- Condition: K/L and release process institutionalized.
- Exit:
  - rigor metrics stay stable;
  - release checks are templated and traceable;
  - supply-chain risk handled in recurring governance cadence.

---

## 5. Execution board (2026-03-07)

| ID | Status | Owner | Planned | Completed | Blocker / Notes |
| --- | --- | --- | --- | --- | --- |
| A01 | done | Codex | 2026-03-05 | 2026-03-05 | full repo lint passed in verify |
| A02 | done | Codex | 2026-03-05 | 2026-03-05 | full verify passed |
| A03 | done | Codex | 2026-03-05 | 2026-03-05 | fallback validated (`3200` unavailable -> `3302`) |
| A04 | done | Codex | 2026-03-06 | 2026-03-06 | `/admin/config/*` PUT now passes with UUID audit targets; smoke asserts audit-log increment |
| H01 | done | Codex | 2026-03-05 | 2026-03-06 | test report refreshed with latest run |
| N01 | done | Codex | 2026-03-05 | 2026-03-05 | preferred+range+random fallback implemented |
| N02 | done | Codex | 2026-03-06 | 2026-03-05 | `api-real`/`ui-http`/`ui-render`/`ui-dom` now clean up spawned process trees |
| N03 | done | Codex | 2026-03-06 | 2026-03-05 | dynamic fallback validated via forced collision (`4010` blocker) |
| N04 | done | Codex | 2026-03-06 | 2026-03-05 | verify heap/retry hardening + smoke leak cleanup validated in repeated runs |
| N05 | done | Codex | 2026-03-07 | 2026-03-07 | `verify` now runs `api-smoke-openapi-coverage`; non-auth/non-payment OpenAPI coverage is gated at 238/238 |
| N06 | done | Codex | 2026-03-07 | 2026-03-07 | `verify` now runs `api-smoke-quality-floor`; API smoke intensity is gated (total/write/read/negative depth + status distribution + admin density) |
| D01 | done | Codex | 2026-03-06 | 2026-03-05 | root cause report completed and documented |
| D02 | done | Codex | 2026-03-06 | 2026-03-05 | wxss size reduced below phase targets |
| D03 | done | Codex | 2026-03-06 | 2026-03-05 | hard budget gate enabled in verify + CI |
| D04 | done | Codex | 2026-03-06 | 2026-03-05 | trend section added to test report |
| J01 | done | Codex | 2026-03-06 | 2026-03-05 | page-api-test matrix completed for 83 pages |
| J02 | done | Codex | 2026-03-06 | 2026-03-05 | admin render coverage reached 25/25 (100%) |
| J03 | done | Codex | 2026-03-06 | 2026-03-05 | client render coverage reached 58/58 (100%) |
| J04 | done | Codex | 2026-03-06 | 2026-03-05 | core DOM assertions landed and green (11/11) |
| J05 | done | Codex | 2026-03-06 | 2026-03-05 | coverage gap closure batch executed (83/83 pass) |
| J06 | done | Codex | 2026-03-06 | 2026-03-05 | DOM full-mode batch-1 landed (36/36 pass, matrix 36/83) |
| J07 | done | Codex | 2026-03-06 | 2026-03-05 | DOM full-mode expanded to full 83/83 with matrix sync |
| J08 | done | Codex | 2026-03-07 | 2026-03-07 | `ui-http-smoke` now auto-parses client app routes and reaches 86/86 (83 page routes + app root + 2 mock checks) |
| J09 | done | Codex | 2026-03-07 | 2026-03-07 | `ui-http-smoke` now validates `content-type` + minimum body length for all 86 probes (not only status code) |
| K01 | done | Codex | 2026-03-06 | 2026-03-05 | vulnerability ledger + generator script completed |
| B04 | done | Codex | 2026-03-06 | 2026-03-07 | `api-real-smoke` expanded to 1180/1180 (writes 866/866 + reads 314/314 including 93 semantic read-back assertions), with unique write-operation coverage already near-full baseline |
| B02 | in_progress | Codex | 2026-03-06 | - | write batch now includes same-key replay invariants + semantic read-back checks (order/refund/case/maintenance/rbac/report/import/ai) + duplicate-maintenance-schedule 409 regression guard + concurrency race matrices (maintenance create, refund approve/reject, order payout pair/triple, transfer-vs-refund overlap, mixed payout/invoice/refund triple-write, repeated mixed bursts on same order aggregate, cross-order parallel payout, staggered mixed tail overlap, jittered repeated overlap loops, randomized seeded multi-iteration overlap harness with distribution assertions, randomized multi-order/multi-aggregate overlap harness, larger-seed chaos overlap harness with p50/p95/max percentile stats, `p95<=3000ms` stability threshold, and persisted cross-run trend baseline/threshold logic) + invoice consistency closure for mixed-race `invoice_without_file` risk + region/listing-featured strict validation/file-temporary-access deepening + search/public-read strictness and RBAC privilege-boundary regression checks (including role-clear immediate convergence checks) + read-detail closure for `GET /files/{id}`, `GET /files/{id}/preview`, `GET /patent-map/regions/{regionCode}?year=...`, `GET /conversations/{conversationId}/messages`; remaining depth is deeper transaction-isolation windows |

### Current execution batch (Batch-1)
- Scope: A01 / A02 / A03 / N01 / N02 / N03 / N04 / H01 / D01 / D02 / D03 / D04 (completed).
- Deliverables:
  1) resilient `scripts/verify.ps1` port fallback (done),
  2) fresh verify run result (done),
  3) TODO board status refresh (done),
  4) 2026-03-05 test report update (done),
  5) smoke scripts migrated to dynamic-port + child-process cleanup (done),
  6) WeApp bundle regression fixed and gated (done).

### Current execution batch (Batch-2)
- Scope: J01 / J02 / J03 / J04 / J05 / J06 / J07 / K01 (completed), K02 pending.
- Deliverables:
  1) full page coverage run (`ui-render-smoke -Mode full`) with 83/83 pass (done),
  2) page-api-test matrix for all pages (done),
  3) vulnerability ledger generated from latest audit report (done),
  4) core DOM assertion smoke completed and integrated into `verify` (done),
  5) DOM full-mode batch-1 completed (`ui-dom-smoke -Mode full`: 36/36; matrix DOM 36/83) (done),
  6) DOM full-mode expanded to all pages (`ui-dom-smoke -Mode full`: 83/83; matrix DOM 83/83) (done),
  7) remaining focus narrowed to critical/high dependency remediation + semantic-strengthening of DOM assertions (pending).

### Current execution batch (Batch-3)
- Scope: B04 close-out + B02 first write batch (in progress).
- Deliverables:
  1) `api-real-smoke` expanded from 17 to 1180 checks (done),
  2) write checks expanded from 2 to 866 assertions and read-back checks expanded to 93 semantic assertions (favorites/comments/addresses/conversations/consultations/auth/admin-config/admin-order-refund-negative/order-admin-happy-path/file-dependent payout-invoice/refund lifecycle/admin-case workflows/admin case-create invalid-enum negatives/patent-maintenance workflows/rbac workflows/reports export/patent-map import/patent-map entry upsert/patents normalize/ai parse feedback/admin industry-tag create+list/public list/admin patents create+update happy+negative/admin announcements create+update+delete happy+negative/admin demands create+update+publish+off-shelf+approve+reject happy+negative/admin achievements create+update+publish+off-shelf+approve+reject happy+negative/admin artworks create+update+publish+off-shelf+approve+reject happy+negative/admin listings create+update+publish+off-shelf+approve+reject happy+negative/user listings create+update happy+negative/admin region create+update happy+negative/region industry-tags success+invalid-body+missing-field+invalid-code+missing/listing featured success+validation negatives+empty-rank strict negatives/listing+demand+achievement+artwork approve+reject missing-id 404/admin listing+demand+achievement+artwork+announcement publish+off-shelf missing-id 404/admin tech-manager update missing+invalid+empty-rank+happy-path assertions/admin order manual-payment+contract+transfer+payout+invoice invalid-datetime negatives/admin order contract-signed dealAmountFen strict-invalid negatives/admin maintenance schedule year strict-invalid negatives/search-listings numeric-filter strict-invalid negatives/file temporary-access/comment create+update empty-text strict-400 negatives/user-verification approve+reject missing-id 404 + reject-missing-reason 400 + same-key replay probes + concurrency race probes + larger-seed chaos percentile/trend harness + listing precondition hardening + patent strict negatives for sourcePrimary/legalStatus + maintenance strict negatives for create status + ai-query strict negatives for contentScope/contentType + order payment-intent strict negatives for payType + search enum strict negatives + public detail reads + RBAC privilege-boundary assertions + critical admin write-path unauthorized/post-clear convergence assertions (including report-export, rbac role/user mutation, settlement/refund full-lifecycle, case/maintenance/verifications-reject endpoints, all 8 admin-config PUT endpoints, industry-tags/regions/region-industry-tags/listing-featured/tech-manager/patent-map-import/rbac-role-create/order-issue-invoice endpoints, listings/demands/achievements/artworks full write endpoints, announcements/patents/case-notes/rbac-mutation+ai-parse-update-404-compatible endpoints, and newly closed admin alerts ack + admin comments update + admin patent-map entry upsert + patents normalize write surfaces + patent-map year decimal strict negatives) + expanded user-side critical write unauthorized assertions (favorites add/remove, comments update/delete, address update/delete, conversation upsert/read, message send, listing create/update, listing consultations create, AI parse feedback create(existing-id), file temporary-access create/missing + file upload + me patch + me verification + listing submit/off-shelf + demand/achievement/artwork create/update/submit/off-shelf + demand/achievement/artwork comment create/delete + contract upload) + me-verification strict enum negatives + pagination strict negatives) (done),
  3) first failure-path/idempotency assertions added (duplicate favorites, invalid comment/message, missing-address delete) (done),
  4) `verify` rerun full green with new API smoke baseline (done),
  5) admin config write-path defect fixed (`PUT /admin/config/*` now passes with audit-log increment assertions) (done),
  6) admin issue-invoice missing-order defect fixed (`POST /admin/orders/:orderId/invoice` no longer returns Prisma 500, now 404) (done),
  7) order/admin happy-path state transitions added (order create, deposit/final paid, contract/transfer milestones, settlement) with conflict-path assertions (done),
  8) file-dependent happy paths (`invoiceFileId`, `payoutEvidenceFileId`) landed with `/files` upload + payout/invoice assertions (done),
  9) refund lifecycle deepening landed (approve/reject/complete happy+conflict paths) (done),
  10) admin case workflow deepening landed (`/admin/cases` create/assign/status/note/evidence/sla happy+negative paths) (done),
  11) patent-maintenance schedules/tasks deepening landed (happy+negative paths for create/update/detail/list) (done),
  12) RBAC role/user deepening landed (create/update/delete role + user role assignment happy+negative paths) (done),
  13) reports export/patent-map import checks landed (including invalid-range and missing-file guards) (done),
  14) semantic read-back/state continuity checks deepened (order/refund/case/maintenance/rbac/report/import) and single-failure summary counting edge fixed (done),
  15) same-idempotency replay invariants landed for order create/payment-intents/invoice-request/refund-create (done),
  16) duplicate maintenance-schedule create defect fixed (`patentId + yearNo` unique collision now returns 409 instead of 500) with regression assertion (done),
  17) first concurrency/state-race matrices landed (maintenance schedule duplicate create race + refund approve/reject race, both asserting one success + one conflict and converged final state) (done),
  18) cross-domain high-contention race landed for order settlement (`/admin/orders/:id/payouts/manual` concurrent writes -> one success + one conflict + post-state convergence assertions) (done),
  19) overlap race between settlement and refund landed (user refund-create vs admin transfer-completed on same order, with branch convergence assertions) (done),
  20) higher fan-out (3 concurrent writes) transaction race landed for order payout (one success + two conflicts + converged settlement/order state) (done),
  21) multi-endpoint 3+ fan-out race landed for same-order mixed writes (`payout + invoice-request + refund-request`) with convergence assertions and post-race conflict guards (done),
  22) mixed-race invoice consistency closure landed (`admin invoice upsert` with file link) to prevent `invoice_without_file` preflight drift (done),
  23) repeated mixed overlap bursts landed on same order aggregate (post-terminal repeated concurrent `payout + invoice-request + refund-request` with bounded outcomes and terminal-state re-checks) (done),
  24) mixed overlap expansion landed to multi-order and staggered-start bursts (cross-order parallel payout success guarantees + post-payout staggered invoice/refund overlap guarantees) (done),
  25) jittered repeated race loops landed (same aggregate sampled across delayed overlap bursts with per-loop bounded outcomes + terminal-state re-check) (done),
  26) randomized multi-iteration race harness landed (batched seeds + per-seed outcomes + aggregated distribution summary assertions) (done),
  27) randomized multi-order/multi-aggregate harness landed (seeded cross-order overlap bursts + per-run outcome capture + distribution assertions) (done),
  28) larger-seed chaos sampling + percentile-based stability thresholding landed (done: `chaos-randomized-outcome-distribution`, `p50/p95/max`, `p95<=3000ms` guard).
  29) expanded seed space + cross-run trend-threshold baseline landed (done: 30 seeded runs, persisted trend history `.tmp/api-real-smoke-chaos-history.json`, rolling baseline window, and activation validated at `priorSamples=6` with `trendThresholdP95=1893ms` and observed `p95=753ms`).
  30) AI/industry-tag/region/featured/file-temporary-access coverage landed (done: `POST /ai/agent/query`, `/admin/ai/parse-results` list/get/update branch coverage, `/ai/parse-results/:id/feedback` create + replay/missing checks, `POST /admin/industry-tags` create+duplicate-invalid checks + admin/public list visibility checks, `POST/PATCH /admin/regions` create+update success and strict input negatives, `PUT /admin/regions/:code/industry-tags` success + invalid-body/missing-field/invalid-code/missing-region checks, `PUT /admin/listings/:id/featured` CITY/NONE success + missing-id 404 + invalid-input guards, and `POST /files/:id/temporary-access` success + missing guards).
  31) featured endpoint validation hardening landed (done: backend now rejects invalid enum/missing region/invalid rank/invalid datetime with 400, matching OpenAPI contract intent).
  32) listings admin validation hardening + coverage landed (done: `POST/PATCH /admin/listings` now strictly validate `source/status/auditStatus/tradeMode/licenseMode/priceType/pledgeStatus/existingLicenseStatus/priceAmountFen/depositAmountFen`; smoke now covers create/update happy+negative + publish/off-shelf/approve/reject happy + update-missing 404).
  33) case create validation hardening + coverage landed (done: `POST /admin/cases` now strictly validates explicit `type/status/priority`; smoke adds invalid-enum create negatives and keeps default behavior when fields are absent).
  34) user listing validation hardening + coverage landed (done: `POST/PATCH /listings` now strictly validate `tradeMode/licenseMode/priceType/pledgeStatus/existingLicenseStatus/priceAmountFen/depositAmountFen`; smoke now covers create/update happy+negative + update-missing 404).
  35) patent strict-negative expansion + order precondition hardening landed (done: smoke adds `admin-patent-create-invalid-source-primary`, `admin-patent-create-invalid-legal-status`, `admin-patent-update-invalid-legal-status`; listing selection now gracefully falls back and auto-prepares audit status before order flow).
  36) maintenance create-status validation hardening + coverage landed (done: `POST /admin/patent-maintenance/schedules|tasks` now strictly reject explicit invalid `status` with 400; smoke adds create-invalid-status negatives for both resources).
  37) AI query enum validation hardening + coverage landed (done: `POST /ai/agent/query` now strictly rejects explicit invalid `contentScope/contentType` with 400; smoke adds invalid-scope and invalid-content-type negatives, while preserving environment-compatible 404 branch).
  38) payment-intent enum validation hardening + coverage landed (done: `POST /orders/:id/payment-intents` now strictly rejects explicit invalid `payType` with 400 and keeps missing-field default path to `DEPOSIT`; smoke adds `order-payment-intent-invalid-pay-type`).
  39) RBAC privilege matrix deepening + permission deny-path normalization landed (done: custom role `report.read` now has explicit allow assertion on finance summary, forbidden assertions on high-risk admin read/write endpoints, unauthenticated 401 boundary checks are now explicit for key protected endpoints, role-clear immediate-convergence checks now assert post-clear 403 on admin listings/report summary and critical write endpoints, and `requirePermission` now returns consistent 403 instead of internal 500 on deny path).
  40) user listing + AI/file unauthorized boundary deepening landed (done: added explicit 401 assertions for `POST /listings`, `PATCH /listings/:id`, `POST /listings/:id/consultations`, `POST /ai/parse-results/:id/feedback` on existing-id, and `POST /files/:id/temporary-access` create/missing paths).
  41) demand/achievement/artwork comment unauthorized boundary deepening landed (done: added explicit 401 assertions for `POST /demands/:id/comments`, `POST /achievements/:id/comments`, `POST /artworks/:id/comments`, and corresponding `DELETE /comments/:id` paths).
  42) user write unauthorized boundary deepening landed for profile/content lifecycle (done: added explicit 401 assertions for `PATCH /me`, `POST /me/verification`, `POST /files` upload, `POST /{listings|demands|achievements|artworks}/:id/{submit|off-shelf}`, and `POST/PATCH /{demands|achievements|artworks}` paths).
  43) contract upload unauthorized boundary landed (done: added explicit 401 assertion for `POST /contracts/:id/upload`).
  44) organizations detail defect fixed (done: `GET /public/organizations/:orgUserId` no longer triggers Prisma `uuid = text` 500; distinct patent count now uses Prisma query path, and smoke includes detail-read regression coverage).
  45) `ui-http-smoke` route coverage expanded and automated (done: client routes now parsed from `apps/client/src/app.config.ts`, HTTP smoke rose from 28 to 86 checks, and full verify remained green).
  46) OpenAPI alignment gate landed in verify (done: `scripts/check-api-smoke-openapi-coverage.mjs` enforces 238/238 non-auth/non-payment operation coverage and fails on any regression).
  47) API smoke quality-floor gate landed in verify (done: `scripts/check-api-smoke-quality-floor.mjs` enforces minimum depth floors for total/write/read/negative checks, key error-code counts, and admin negative density).
  48) `ui-http-smoke` semantic hardening landed (done: all 86 probes now include content-type + minimum body-length assertions, preventing status-only false positives on empty/wrong-type responses).
  49) patent-map year strict-integer hardening landed (done: `year` now rejects decimal input on public/admin patent-map endpoints with 400; regression checks added for summary/detail/admin get/admin upsert).
  50) patent-clusters query strictness hardening landed (done: `/public/patent-clusters` now returns 400 for invalid `page/pageSize` inputs instead of silent fallback; smoke adds `invalid-page` and `empty-page-size` regressions).
  51) reports days strict-parse hardening landed (done: `GET /admin/reports/finance/summary` and `POST /admin/reports/finance/export` now reject invalid/empty `days` with 400; smoke adds `summary-invalid-days`, `summary-empty-days`, `export-invalid-days`, `export-empty-days` regressions).
  52) AI parse feedback score strictness hardening landed (done: `POST /ai/parse-results/:id/feedback` now rejects non-integer/empty `score`; smoke adds `ai-parse-feedback-create-invalid-score-decimal` and `ai-parse-feedback-create-empty-score` regressions).
  53) file temporary-access ttl strictness hardening landed (done: `POST /files/:fileId/temporary-access` now strictly rejects non-integer/empty ttl params and preserves explicit `0` semantics; smoke adds `file-temporary-access-invalid-ttl-decimal` and `file-temporary-access-empty-ttl` regressions).
  54) admin order contract-signed `dealAmountFen` strictness hardening landed (done: `POST /admin/orders/:id/milestones/contract-signed` now rejects empty/non-finite/decimal/non-integer `dealAmountFen`; smoke adds `admin-order-contract-signed-invalid-deal-amount-decimal` regression).
  55) search-listings numeric filters strictness hardening landed (done: `GET /search/listings` now strictly rejects invalid/empty/decimal numeric filters for `priceMin/priceMax/depositMin/depositMax/transferCountMin/transferCountMax`; smoke adds `search-listings-invalid-price-min`, `search-listings-empty-deposit-max-fen`, and `search-listings-invalid-transfer-count-min-decimal` regressions).
  56) listing-featured empty-rank strictness hardening landed (done: `PUT /admin/listings/:id/featured` now rejects empty `featuredRank` instead of silently coercing to `0`; smoke adds `admin-listing-featured-set-city-empty-rank` regression).
  57) maintenance schedule `yearNo` strictness hardening landed (done: `POST /admin/patent-maintenance/schedules` now rejects decimal `yearNo`; smoke adds `admin-maintenance-schedule-create-invalid-year-decimal` regression).
  58) tech-manager update `featuredRank` strictness hardening landed (done: `PATCH /admin/tech-managers/:id` now rejects empty `featuredRank` instead of silently coercing to `0`; smoke adds `admin-tech-manager-update-empty-featured-rank` regression).
  59) next step: carry trend history across daily/CI runs and calibrate threshold factors using broader variance data (pending).



