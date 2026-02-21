# Permissions Matrix (Admin + Miniapp) (2026-02-19)

## Sources of truth
- Admin permission IDs + default role grants: `apps/api/src/common/permissions.ts`
- Role IDs + default role definitions: `apps/api/src/common/rbac.ts`
- Enforcement points: `requirePermission(...)` in `apps/api/src/modules/**`
- Miniapp access policies: `apps/client/src/lib/guard.ts` and per-page `usePageAccess(...)`

## Miniapp (client) access tiers

### Public pages (no login required to view)
- Tab pages: `pages/home`, `pages/tech-managers`, `pages/me` (read-only state).
- Discovery/detail: `subpackages/search`, `subpackages/listing/detail`, `subpackages/demand/detail`,
  `subpackages/achievement/detail`, `subpackages/artwork/detail`, `subpackages/patent/detail`,
  `subpackages/organizations`, `subpackages/organizations/detail`, `subpackages/inventors`,
  `subpackages/patent-map/*`, `subpackages/announcements/*`, `subpackages/cluster-picker`.
- Help/legal: `subpackages/about`, `subpackages/support/*`, `subpackages/legal/*`.
- Auth flows: `subpackages/login`, `subpackages/onboarding/*`, `subpackages/region-picker`, `subpackages/ipc-picker`.

### Login-required pages (`usePageAccess('login-required')`)
- `subpackages/addresses` (list/edit)
- `subpackages/notifications` (list/detail)

### Approved-required pages (`usePageAccess('approved-required')`)
- Publish flow: `pages/publish` + `subpackages/publish/*`
- Messages + chat: `pages/messages`, `subpackages/messages/chat`
- Favorites: `subpackages/favorites`
- Orders + detail: `subpackages/orders`, `subpackages/orders/detail`
- Contracts: `subpackages/contracts`
- Invoices: `subpackages/invoices`
- My content: `subpackages/my-listings`, `subpackages/my-demands`, `subpackages/my-achievements`, `subpackages/my-artworks`
- Checkout: `subpackages/checkout/deposit-pay`, `subpackages/checkout/final-pay`

### Action-level approved-required (guarded by `ensureApproved(...)`)
- Detail actions: favorite, consult, create conversation (listing/demand/achievement/artwork/patent detail).
- Comments create/edit/delete (public list is open; write actions require verified user).
- Publish submit + off-shelf actions.
- Order creation / payment actions.

## Admin roles (default grants)

Role IDs are stable and map to default role names:
- `role-admin` (admin): all permissions (`*`)
- `role-operator` (operator): listing/verification/review + config/report/alert/audit
- `role-cs` (cs): listing/verification read + order/case/maintenance + milestone confirm
- `role-finance` (finance): order/refund/settlement/invoice/payment + report/alert/announcement

See `apps/api/src/common/permissions.ts` for the authoritative permission list and
`apps/api/src/common/rbac.ts` for role IDs and defaults.

## Permission -> modules (admin)

This maps backend enforcement (`requirePermission`) to admin modules/pages:

- `verification.read`, `verification.review`:
  - `/admin/user-verifications` (Verifications)
- `listing.read`, `listing.audit`:
  - `/admin/listings`, `/admin/demands`, `/admin/achievements`, `/admin/artworks`
  - `/admin/patents`, `/admin/tech-managers`
- `announcement.manage`:
  - `/admin/announcements`
- `order.read`:
  - `/admin/orders`, `/admin/orders/:id`
- `payment.manual.confirm`, `milestone.*`, `settlement.read`, `payout.manual.confirm`,
  `invoice.manage`, `refund.*`:
  - Orders / Refunds / Settlements / Invoices flows
- `case.manage`:
  - `/admin/cases`
- `maintenance.manage`:
  - `/admin/patent-maintenance`
- `config.manage`:
  - `/admin/config`, `/admin/patent-map/*`, `/admin/regions`, `/admin/industry-tags`
- `report.read`, `report.export`:
  - `/admin/reports`
- `alert.manage`:
  - `/admin/alerts`
- `rbac.manage`:
  - `/admin/rbac/*` (RBAC page)
- `auditLog.read`:
  - `/admin/audit-logs`

## Admin endpoints gated by `isAdmin` (no permission ID)
- `/admin/comments` list/update requires admin login but does not check a permission ID.

## Gaps / verify before production
- `ai.manage` is used in AI admin service but is not in the default permission list.
  If AI admin endpoints are enabled, add `ai.manage` to the permission registry + roles.
