# Permissions Matrix (Admin + Miniapp) (2026-03-21)

## Sources of truth
- Admin permission IDs + default role grants: `apps/api/src/common/permissions.ts`
- Role IDs + default role definitions: `apps/api/src/common/rbac.ts`
- Enforcement points: `requirePermission(...)` in `apps/api/src/modules/**`
- Miniapp access policies: `apps/client/src/lib/guard.ts` and per-page `usePageAccess(...)`

## Miniapp (client) access tiers

### Public pages (no login required to view)
- Tab pages: `pages/home`, `pages/tech-managers`, `pages/me` (read-only state)
- Public subpackages: `subpackages/organizations`, `subpackages/organizations/detail`, `subpackages/inventors`
- Help/legal: `subpackages/about`, `subpackages/support/*`, `subpackages/legal/*`
- Auth flows: `subpackages/login`, `subpackages/onboarding/*`, `subpackages/ipc-picker`

### Login-required pages (`usePageAccess('login-required')`)
- `subpackages/addresses` (list/edit)
- `subpackages/notifications` (list/detail)

### Approved-required pages (`usePageAccess('approved-required')`)
- Publish flow: `pages/publish` + `subpackages/publish/*`
- Messages/chat: `pages/messages`, `subpackages/messages/chat`
- Favorites: `subpackages/favorites`
- Orders/detail: `subpackages/orders`, `subpackages/orders/detail`
- Contracts: `subpackages/contracts`
- Invoices: `subpackages/invoices`
- Checkout: `subpackages/checkout/deposit-pay`, `subpackages/checkout/final-pay`

### Action-level approved-required (guarded by `ensureApproved(...)`)
- Comments create/edit/delete (public list remains open)
- Publish submit + off-shelf
- Order creation / payment actions

## Admin roles (default grants)

Role IDs are stable and map to default role names:
- `role-admin` (admin): all permissions (`*`)
- `role-operator` (operator): verification/listing review + listing batch/import + patent import + claim review + platform conversation management + operations reporting/config
- `role-cs` (cs): verification/listing read + platform conversation management + order/case/maintenance + milestone confirm
- `role-finance` (finance): payment/refund/settlement/invoice + reporting

See `apps/api/src/common/permissions.ts` for the authoritative permission list and
`apps/api/src/common/rbac.ts` for role IDs and defaults.

## Permission -> modules (admin)

This maps backend enforcement (`requirePermission`) to admin modules/pages:

- `verification.read`, `verification.review`:
  - `/admin/user-verifications`
- `listing.read`, `listing.audit`:
  - `/admin/listings`, `/admin/patents`, `/admin/achievements`, `/admin/tech-managers`
- `listing.batchPublish`:
  - `/admin/listings/jobs/batch*`
- `listing.import`:
  - `/admin/listings/jobs/import*`
- `patent.import`:
  - `/admin/patents/jobs/import*`, `/admin/patents/jobs/listings`
- `patent.claim.review`:
  - `/admin/patent-claims`, `/admin/patent-claims/:claimId/approve`, `/admin/patent-claims/:claimId/reject`
- `conversation.platform.manage`:
  - `/admin/conversations/platform`, `/admin/conversations/:conversationId/agents*`
- `order.read`:
  - `/admin/orders`, `/admin/orders/:id`
- `payment.manual.confirm`, `milestone.*`, `settlement.read`, `payout.manual.confirm`, `invoice.manage`, `refund.*`:
  - Orders / Refunds / Settlements / Invoices flows
- `case.manage`:
  - `/admin/cases`
- `maintenance.manage`:
  - `/admin/patent-maintenance`
- `config.manage`:
  - `/admin/config`
- `report.read`, `report.export`:
  - `/admin/reports`
- `alert.manage`:
  - `/admin/alerts`
- `rbac.manage`:
  - `/admin/rbac/*` (role/permission/user management, staff onboarding)
- `auditLog.read`:
  - `/admin/audit-logs`

## Admin endpoints gated by `isAdmin` (no permission ID)
- `/admin/comments` list/update currently requires admin login but does not check a dedicated permission ID

## Admin login + staff onboarding baseline
- Admin login is SMS-first (`POST /auth/sms/send` + `POST /auth/sms/verify`), then session check (`GET /auth/session`).
- Backoffice access must pass both checks:
  - `isAdmin=true`
  - permission-based route gating in admin web (menu + page access)
- Staff onboarding is centralized in RBAC:
  - `POST /admin/rbac/users` creates employee account with phone + roleIds
  - `GET /admin/rbac/users` defaults to `scope=STAFF` and supports `q` search
  - `PATCH /admin/rbac/users/{userId}` updates role assignments

## Notes
- `ai.manage` is used by AI admin service but is still not in default permission grants.
  If AI admin endpoints are enabled, add it to permission registry and role defaults.
