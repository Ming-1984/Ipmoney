# Test Report (Consolidated)

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
