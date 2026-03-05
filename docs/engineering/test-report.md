# Test Report (Consolidated)

## Latest (2026-03-05)

### Commands & Results (dev)
- `powershell -ExecutionPolicy Bypass -File scripts/verify.ps1 -ApiBaseUrl https://staging-api.example.com -ApiPort 3200 -ReportDate 2026-03-05`
  - Result: success (all steps)
  - Port resilience: verify keeps preferred/range/random fallback and remains stable under collision scenarios.
  - Script hardening: `api-real-smoke`, `ui-http-smoke`, `ui-render-smoke`, `ui-dom-smoke` now use dynamic port selection and process-tree cleanup (no kill-by-port behavior).
  - Build resilience: verify appends `NODE_OPTIONS=--max-old-space-size=4096` and retries transient `client:build:h5` crash exits once.
  - Quality gates: `openapi:lint`, `lint`, `typecheck`, `scan:banned-words` all pass.
  - API smoke: pass (63/63) -> `.tmp/api-real-smoke-2026-03-05-summary.json`
  - API smoke write/read split: writes 36/36, reads 27/27.
  - Failure/idempotency checks now included: duplicate favorites, invalid comment/message payloads, and missing-resource delete paths.
  - DB preflight: pass (failed=0) -> `.tmp/db-preflight-2026-03-05-summary.json`
  - UI HTTP smoke: pass (28/28) -> `.tmp/ui-http-smoke-2026-03-05-summary.json`
  - UI render smoke (core): pass (3/3) -> `.tmp/ui-render-smoke-2026-03-05-summary.json`
  - UI DOM smoke (core): pass (11/11) -> `.tmp/ui-dom-smoke-2026-03-05-summary.json`
  - WeApp hard budget gate: pass -> `.tmp/weapp-bundle-budget-2026-03-05.json`
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
  - Result: fail (500 on 8 routes)
  - Root cause observed in API stderr: `audit_log.targetId` expects UUID while config controllers write string keys (`trade_rules`, `hot_search_config`, etc.).

### Risks still open
- API write-coverage phase-1 target is reached (36/135 ~= 26.7%), but write checks are still concentrated in user-side flows; `/admin` write domain coverage remains 0.
- Admin config write-path defect found during probe: `PUT /admin/config/*` currently returns 500 because audit-log persistence expects UUID `targetId` but config targets use string keys (e.g., `trade_rules`).
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
