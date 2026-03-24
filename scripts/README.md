# Scripts Catalog

This directory contains local engineering automation scripts.

## Release Gate (must stay green)
- `verify.ps1`: full quality gate (lint/typecheck/build/smoke/preflight).
  - Supports `-UiSmokeMode core|full` and optional `-RunWeappRouteSmoke` for mini-program route smoke (`noauth` + `auth` when token is available).
  - Includes H5/WeApp bundle budget gates (`check-h5-bundle-budget.mjs`, `check-weapp-bundle-budget.mjs`) during build stage.
  - WeApp route smoke is retried once on transient non-zero exit.
  - Optional `-RunVulnerabilityAudit` generates `pnpm audit` snapshot + vulnerability ledger, then enforces baseline guard (`check-vulnerability-baseline.mjs`) for new critical/high advisories.
- `api-real-smoke.ps1`: real API smoke coverage baseline.
- `ui-http-smoke.ps1`: HTTP-level page smoke.
- `ui-render-smoke.ps1`: visual render smoke.
- `ui-dom-smoke.ps1`: semantic DOM smoke assertions.
- `db-preflight-check.ps1`: DB integrity checks.
- `check-doc-links.mjs`: active docs internal link validation.

## API / Contract Audits
- `audit-openapi-backend.mjs`: OpenAPI vs backend route diff.
- `audit-coverage.mjs`: OpenAPI test coverage report.
- `check-api-smoke-openapi-coverage.mjs`: smoke coverage gate.
- `check-api-smoke-quality-floor.mjs`: smoke quality floor gate.

## Build / Env Checks
- `check-weapp-dist-pages.mjs`: verify dist page artifacts.
- `check-h5-bundle-budget.mjs`: h5 entrypoint and key asset budget checks (requires fresh `apps/client/dist/h5` from `build:h5`).
- `check-weapp-bundle-budget.mjs`: weapp bundle budget checks.
- `check-prod-env.mjs`: production env hard checks.
- `run-with-env.mjs`: run command with `.env`.
- `scan-banned-words.mjs`: forbidden word scan.
- `check-vulnerability-baseline.mjs`: fail on newly introduced critical/high advisories vs baseline.
- `update-vulnerability-baseline.mjs`: refresh baseline from current vulnerability ledger when risk acceptance changes.

## Developer Utilities (non-gate)
- `start-dev.ps1`, `clean-dev.ps1`, `dev-reset.ps1`: local dev lifecycle.
- `weapp-route-smoke.ps1` / `weapp-route-smoke.js`: WeChat route smoke.
- `capture-ui.ps1`, `capture-weapp-ui.js`: screenshot capture.
- `render-diagrams.ps1`, `merge-ui-screenshots.py`, `normalize-rendered-images.py`: documentation media processing.
- `db-backup.ps1`, `db-restore.ps1`: local DB operations.
