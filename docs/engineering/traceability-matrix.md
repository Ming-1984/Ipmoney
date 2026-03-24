# PRD -> API -> Implementation Traceability Matrix (P0 Baseline)

> Last updated: 2026-03-24
> Source of truth: `Ipmoney.md`, `docs/api/openapi.yaml`, `apps/client/src`, `apps/admin-web/src`, `apps/api/src`
> This file tracks active scope only. Removed domains are listed in section 4.

## 1. Scope Definition

### 1.1 Active P0 scope
- Mobile (client): home/search/listing detail/patent detail/patent map/chat/orders/checkout/me/publish/favorites/organizations/inventors/tech managers/maintenance
- Admin web: dashboard/verifications/listings audit/orders/refunds/settlements/invoices/comments/reports/rbac/config/maintenance/regions/patents
- API: OpenAPI operations and backend controller routes are aligned by path+method (see section 5 audit result)

### 1.2 P1 reserved scope
- AI parse review and feedback
- Alert center
- Expanded analytics

## 2. Client Matrix (`apps/client`)

| Capability | PRD reference (`Ipmoney.md`) | Client entry | API contract (OpenAPI) | Status |
| --- | --- | --- | --- | --- |
| Home recommendations and quick entries | Home / Search / Featured zones | `pages/home/index` | `GET /search/listings` | Aligned |
| Search and advanced filters | Search Results | `subpackages/search/index` | `GET /search/listings` | Aligned |
| Listing detail and consultation | Detail Page / Message | `subpackages/listing/detail/index` | `GET /public/listings/{listingId}`, `POST /listings/{listingId}/conversations` | Aligned |
| Patent detail single-page tabs | Detail Page best-practice section | `subpackages/patent/detail/index` | `GET /patents/{patentId}` | Aligned |
| Messaging and chat | Message | `pages/messages/index`, `subpackages/messages/chat/index` | `/me/conversations`, `/conversations/{conversationId}/messages`, `/conversations/{conversationId}/read`, `/support/conversations`, `/orders/{orderId}/dispute-conversations` | Aligned |
| Orders and checkout | Checkout | `subpackages/orders/*`, `subpackages/checkout/*` | `/orders`, `/orders/{orderId}`, `/orders/{orderId}/payment-intents` | Aligned |
| Me/profile/verification | User Center | `pages/me/index`, onboarding/profile/settings subpackages | `/me`, `/me/verification`, `/me/addresses` | Aligned |
| My patent maintenance | User Center | `subpackages/maintenance/index` | `/me/patent-maintenance/schedules`, `/me/patent-maintenance/tasks` | Aligned |
| Publish listing | Publish | `pages/publish/index`, `subpackages/publish/patent/index` | `/patents/normalize`, `/files`, `/listings`, `/listings/{listingId}` | Aligned |
| Favorites | User Center | `subpackages/favorites/index` | `/me/favorites`, `/listings/{listingId}/favorites` | Aligned |
| Organizations / inventors / tech managers | Home + Search extension | `subpackages/organizations/*`, `subpackages/inventors/index`, `pages/tech-managers/index` | `/public/organizations*`, `/search/inventors`, `/search/tech-managers` | Aligned |

## 3. Admin Matrix (`apps/admin-web`)

| Capability | PRD reference (`Ipmoney.md`) | Admin route | API contract (OpenAPI) | Status |
| --- | --- | --- | --- | --- |
| Dashboard | Dashboard | `/` | Aggregated reads (`/admin/user-verifications`, `/admin/listings`, `/orders`) | Aligned |
| Verification review | User & Auth | `/verifications` | `/admin/user-verifications*` | Aligned |
| Listing audit | Content Audit | `/listings` | `/admin/listings*` | Aligned |
| Orders and milestones | Order System | `/orders`, `/orders/:orderId` | `/admin/orders*` | Aligned |
| Refund processing | Order / Finance | `/refunds` | `/orders/{orderId}/refund-requests`, `/admin/refund-requests/*` | Aligned |
| Settlement and payout | Finance | `/settlements` | `/admin/orders/{orderId}/settlement`, `/admin/orders/{orderId}/payouts/manual` | Aligned |
| Invoice management | Finance | `/invoices` | `/orders/{orderId}/invoice`, `/admin/orders/{orderId}/invoice` | Aligned |
| Comments moderation | Content Audit | `/comments` | `/admin/comments*` | Aligned |
| Reports | Finance | `/reports` | `/admin/reports/finance/*` | Aligned |
| RBAC and config | System settings | `/rbac`, `/config` | `/admin/rbac/*`, `/admin/config/*` | Aligned |
| Platform conversation inbox | Customer service / dispute ops | `/conversations/platform` | `/admin/conversations/platform`, `/admin/conversations/{conversationId}/agents*` | Aligned |
| Maintenance / regions / patents | Ops | `/maintenance`, `/regions`, `/patents` | `/admin/patent-maintenance/*`, `/admin/regions*`, `/admin/patents*` | Aligned |
| Patent map operations | Ops | `/patents` | `/search/patent-map/*`, `/admin/patent-map/listings/batch` | Aligned |

## 4. Removed Domains (Must Stay Removed)

The following domains were intentionally removed from active product scope and should not reappear in client/admin route maps:
- Achievement (separate channel)
- Announcement (separate channel)
- Demand / Artwork (legacy content types)

Allowed residual locations:
- Historical Prisma migrations
- Archived engineering notes documenting removals

Not allowed residual locations:
- Current client routes (`app.config.ts`)
- Current admin routes (`apps/admin-web/src/router.tsx`)
- Active OpenAPI paths used for release scope
- Active smoke scripts for P0 acceptance

## 5. Current Audit Result (2026-03-24)

- OpenAPI vs backend route diff: `OpenAPI-only=0`, `Controller-only=0`
- Route-level dist artifact check (weapp): passed
- Patent-map domain restored with single-source aggregation (`listings + regions + patents`) and no extra map table.

## 6. Verification Commands

```bash
pnpm openapi:lint
node scripts/audit-openapi-backend.mjs
node scripts/audit-coverage.mjs
node scripts/check-weapp-dist-pages.mjs
```

If any command fails, update this matrix in the same change set.
