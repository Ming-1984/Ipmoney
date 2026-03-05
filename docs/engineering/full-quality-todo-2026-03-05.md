# Ipmoney Full Quality Remediation TODO (Complete)

> Updated: 2026-03-05
> Scope: `apps/api`, `apps/client`, `apps/admin-web`, `scripts`, CI/CD, engineering docs
> Constraint: Real login/payment integrations are out of scope for this phase.

## 1. Current Baseline (for planning)

### 1.1 Quality gates status
- `typecheck`: pass (api/client/admin-web).
- `build`: pass (api/admin-web/client h5/weapp); WeApp severe regression has been fixed in this batch, and bundle gate is now enforced.
- `smoke`: pass (API 63/63, UI HTTP 28/28, UI Render full 83/83, UI Render core 3/3, UI DOM core 11/11, UI DOM full-83 83/83).
- `verify`: pass on 2026-03-05 (now includes `ui-dom-smoke(core)` in pipeline); port/process hardening has been applied to core smoke scripts.
- `weapp-route-smoke`: local fail due DevTools HTTP port availability (environment issue).

### 1.2 Coverage and test capability
- OpenAPI operations: 243 (GET 108 / POST 93 / PUT 12 / PATCH 21 / DELETE 9).
- API smoke covers 63 operations (~25.9%).
- Write operations total 135; smoke now covers 36 (~26.7%).
- Highest uncovered write concentration remains in `/admin` (77 write operations, still 0 covered in smoke).
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
- Remaining blind spots: `ui-http-smoke` is still shallow (26/83 page routes + 2 mock endpoints), and DOM assertions still need semantic hardening (many pages currently use generic structural checks).
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
- `verify` now appends `NODE_OPTIONS=--max-old-space-size=4096` and retries transient `client:build:h5` crash exit codes once.

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
  - Acceptance: openapi lint, lint, typecheck, build, api smoke, db preflight, ui http smoke, ui render smoke(core) all pass.
- [x] A03 Improve `verify` port resilience for OS reserved-port scenarios.
  - Acceptance: auto fallback works even when `ApiPort..ApiPort+30` is unavailable.
- [ ] A04 Fix admin config write-path 500 regression (`/admin/config/*`).
  - Acceptance: `PUT /admin/config/trade-rules|customer-service|recommendation|alerts|banner|taxonomy|sensitive-words|hot-search` all return 200 and create audit logs successfully.

## B. Test system completion (P0-P1)
- [ ] B01 Introduce API unit/integration test framework (Vitest/Jest + Supertest + test DB).
  - Acceptance: executable `test` scripts in `apps/api`; CI can run minimal set.
- [ ] B02 Build write-first API test inventory (orders/refunds/invoices/comments/favorites/addresses/audit flow).
  - Acceptance: first batch covers >=30 key write APIs with success/failure/idempotency assertions.
  - Progress: smoke batch now covers 36 write operations (favorites/comments/addresses/conversations/consultations + auth), with first failure/idempotency assertions added.
- [ ] B03 Add frontend E2E for key H5/admin paths (excluding real login/payment).
  - Acceptance: homepage/search/detail/publish/order/audit flows are script-regressible.
- [x] B04 Upgrade `api-real-smoke` from read-heavy to read-write balanced.
  - Acceptance: write coverage raised from 1.48% to >=20% (phase 1). (done: 36/135 = 26.7%)
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
- [x] H01 Update `docs/engineering/test-report.md` with 2026-03-05 results and risk notes.
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

## 5. Execution board (2026-03-05)

| ID | Status | Owner | Planned | Completed | Blocker / Notes |
| --- | --- | --- | --- | --- | --- |
| A01 | done | Codex | 2026-03-05 | 2026-03-05 | full repo lint passed in verify |
| A02 | done | Codex | 2026-03-05 | 2026-03-05 | full verify passed |
| A03 | done | Codex | 2026-03-05 | 2026-03-05 | fallback validated (`3200` unavailable -> `3302`) |
| A04 | in_progress | Codex | 2026-03-06 | - | admin config write probe currently hits 500 (`audit_logs.targetId` UUID mismatch with string config ids) |
| H01 | done | Codex | 2026-03-05 | 2026-03-05 | test report backfilled with latest run |
| N01 | done | Codex | 2026-03-05 | 2026-03-05 | preferred+range+random fallback implemented |
| N02 | done | Codex | 2026-03-06 | 2026-03-05 | `api-real`/`ui-http`/`ui-render`/`ui-dom` now clean up spawned process trees |
| N03 | done | Codex | 2026-03-06 | 2026-03-05 | dynamic fallback validated via forced collision (`4010` blocker) |
| N04 | done | Codex | 2026-03-06 | 2026-03-05 | verify heap/retry hardening + smoke leak cleanup validated in repeated runs |
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
| K01 | done | Codex | 2026-03-06 | 2026-03-05 | vulnerability ledger + generator script completed |
| B04 | done | Codex | 2026-03-06 | 2026-03-05 | `api-real-smoke` expanded to 63/63 (writes 36/36), write coverage 26.7% |
| B02 | in_progress | Codex | 2026-03-06 | - | write batch reached 36 ops and added first failure/idempotency checks; admin/orders depth pending |

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
  1) `api-real-smoke` expanded from 17 to 63 checks (done),
  2) write checks expanded from 2 to 36 (favorites/comments/addresses/conversations/consultations/auth) (done),
  3) first failure-path/idempotency assertions added (duplicate favorites, invalid comment/message, missing-address delete) (done),
  4) `verify` rerun full green with new API smoke baseline (done),
  5) admin config write probe exposed server-side defect (`PUT /admin/config/*` returns 500 due audit-log UUID constraint mismatch) (new blocker),
  6) next step: extend failure/idempotency depth into orders/admin write flows after blocker fix (pending).
