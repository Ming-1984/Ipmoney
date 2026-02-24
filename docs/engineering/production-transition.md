# Production Transition Runbook (Dev / Staging / Prod)

Purpose: make the dev -> staging -> prod handoff predictable, repeatable, and safe.

## 1) Environment layering

Recommended model:
- **Dev**: local `.env` copied from `.env.example` (no real secrets in repo).
- **Staging**: `.env.staging` (or CI secrets) injected at deploy time.
- **Prod**: secrets in KMS / Secrets Manager (never committed, never stored on disk).

Use `docs/engineering/environments.md` as the source of truth for variable definitions.

Key deltas to enforce per environment:
- `NODE_ENV`: `development` / `test` / `production`
- `BASE_URL`: must be public in staging/prod (used in callbacks and file URLs)
- `PUBLIC_HOST_WHITELIST`: restrict to expected hosts in staging/prod
- `CORS_ORIGINS`: explicitly set allowed web origins in staging/prod (avoid "*")
- `TRUST_PROXY`: enable when running behind ingress / reverse proxy
- `JWT_SECRET`: unique per environment
- `DATABASE_URL` / `REDIS_URL`: dedicated env per tier
- `S3_*`: staging/prod buckets and credentials
- WeChat login / pay keys: staging/prod credentials only in secure stores

## 2) Switch matrix (dev vs staging vs prod)

| Flag | Dev | Staging | Prod | Notes |
| --- | --- | --- | --- | --- |
| `DEMO_AUTH_ENABLED` | true | false | false | Demo auth must be OFF outside dev |
| `DEMO_PAYMENT_ENABLED` | true | false | false | Demo payment only in dev |
| `DEMO_AUTH_ALLOW_UUID_TOKENS` | false (default) | false | false | UUID token passthrough is for local debugging only; keep OFF by default |
| `TARO_APP_ENABLE_MOCK_TOOLS` | 1 | 0 | 0 | Mock tools only in dev |
| `VITE_ENABLE_MOCK_TOOLS` | 1 | 0 | 0 | Mock tools only in dev |
| `ENABLE_H5_PAYMENT` | false | (decision) | (decision) | Keep false until payment is ready |
| `ENABLE_AUTO_PAYOUT` | false | false | (decision) | Enable only with finance approval |

## 3) Staging with fixtures (recommended)

Goal: keep UI predictable while validating real API incrementally.

- Run `mock-api` and route selected prefixes to real API:
  - `UPSTREAM_API_BASE_URL=https://staging-api.example.com`
  - `UPSTREAM_PATH_PREFIXES=/files,/patents`
- Keep the rest served by fixtures for stable demos/regression.
- You can force source per request: `X-Mock-Source: fixture|upstream`.

## 4) Monitoring & alerting

Minimum SLOs to wire:
- API availability, p95 latency, error rate (5xx / 4xx)
- Login failure rate
- Payment failure / refund failure rate
- Order state transition failures (milestones)
- Client first-screen time (Taro) and JS error rate

Recommended telemetry:
- Structured logs with `traceId/requestId`, `userId`, `orderId`
- Audit logs for admin actions (already enforced in code)
- Alert thresholds tied to business KPIs

Note:
- API now enforces `x-request-id` via middleware (dev/staging); ensure log pipeline captures it.

## 5) Rollout & rollback

Miniapp:
- Use platform gray release percentage; verify core flow metrics before 100%
- Maintain previous version for quick rollback

Backend:
- Prefer blue/green or canary
- Run `scripts/db-preflight-check.ps1` on staging with prod snapshot
- Apply migrations via `pnpm -C apps/api db:deploy` (Prisma migrate deploy)
- Take backups with `scripts/db-backup.ps1`; restore via `scripts/db-restore.ps1`

## 6) Security & compliance

- PII redaction in logs (phone numbers, ID numbers, payment fields)
- Least privilege: assign only required admin permissions
- Key rotation: schedule for JWT secret, S3, WeChat pay, database
- Secrets never committed; use secure stores in staging/prod

## 7) Pre-prod checklist (quick)

- Demo switches disabled
- Run `pnpm check:prod-env` in staging/prod to validate env flags
- Env variables layered and injected
- Mock tools disabled in client/admin
- Observability wired (logs/metrics/alerts)
- Gray release plan + rollback ready
