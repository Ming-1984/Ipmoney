# Patent Maintenance Chain Audit (2026-03-23)

## Scope

- Full-chain audit for maintenance operation from mini-program to admin backoffice.
- Focus on production workflow closure: order lifecycle, conversation continuity, API/docs/type sync, and executable tests.

## External Baseline (Best Practice)

- Use explicit lifecycle states for each maintenance order, not free-text stage changes.
- Keep payment/execution/receipt/reconcile/close as auditable, state-guarded transitions.
- Keep one continuous conversation thread bound to the maintenance business object to avoid fragmented support history.
- Separate owner-facing "my data" APIs and admin operation APIs with strict permission boundaries.

## Implemented in This Refactor

### 1) Backend Domain and Workflow

- Added full maintenance order domain model and event log.
- Added Prisma migration to register `ConversationContentType.MAINTENANCE` at database level.
- Added strict lifecycle operations:
  - `quote`
  - `payment-confirm`
  - `execution`
  - `receipt`
  - `reconcile`
  - `close`
  - `cancel`
- Added owner-side APIs:
  - list/create/get orders
  - list order events
- Added maintenance conversation entry:
  - `POST /patent-maintenance/orders/{orderId}/conversations`
- Added maintenance conversation type into unified conversation domain (`MAINTENANCE`).

### 2) Admin Backoffice

- Rebuilt maintenance page into three unified tabs:
  - Schedules
  - Tasks
  - Orders
- Added order lifecycle action dialogs and timeline viewer.
- Added filter-first UX for all three tabs.

### 3) Mini-Program

- Rebuilt maintenance page as workflow-first UX:
  - Schedules / Tasks / Orders tabs
  - Summary cards
  - Schedule -> create order action
  - Order-bound support conversation entry
  - Order timeline display
- This enforces continuous communication on the order object instead of one-off support submissions.

### 4) OpenAPI and API Types

- Added maintenance order paths (admin + me) and schemas.
- Added maintenance conversation path and `ConversationContentType.MAINTENANCE`.
- Added explicit platform conversation channel filter `MAINTENANCE`.
- Added owner maintenance order query filter `orderId` for deep-link and contextual entry.
- Regenerated shared API types from OpenAPI.

## API Coverage Added

- Admin:
  - `GET /admin/patent-maintenance/orders`
  - `POST /admin/patent-maintenance/orders`
  - `GET /admin/patent-maintenance/orders/{orderId}`
  - `GET /admin/patent-maintenance/orders/{orderId}/events`
  - `POST /admin/patent-maintenance/orders/{orderId}/quote`
  - `POST /admin/patent-maintenance/orders/{orderId}/payment-confirm`
  - `POST /admin/patent-maintenance/orders/{orderId}/execution`
  - `POST /admin/patent-maintenance/orders/{orderId}/receipt`
  - `POST /admin/patent-maintenance/orders/{orderId}/reconcile`
  - `POST /admin/patent-maintenance/orders/{orderId}/close`
  - `POST /admin/patent-maintenance/orders/{orderId}/cancel`
- Owner:
  - `GET /me/patent-maintenance/orders`
  - `POST /me/patent-maintenance/orders`
  - `GET /me/patent-maintenance/orders/{orderId}`
  - `GET /me/patent-maintenance/orders/{orderId}/events`
- Conversation:
  - `POST /patent-maintenance/orders/{orderId}/conversations`

## Verification (Executed)

- API type and tests:
  - `pnpm -C apps/api typecheck` (passed)
  - `pnpm -C apps/api test -- test/patent-maintenance.filters.spec.ts test/patent-maintenance.write-flow.spec.ts test/patent-maintenance.orders.spec.ts test/patent-maintenance.me.controller.spec.ts test/patent-maintenance.me.spec.ts test/conversations.controller.spec.ts test/conversations.filters.spec.ts test/conversations.write-flow.spec.ts` (passed)
- OpenAPI and generated types:
  - `pnpm openapi:lint` (passed)
  - `pnpm openapi:types` (passed)
- Admin web:
  - `pnpm -C apps/admin-web typecheck` (passed)
- Mini-program:
  - `pnpm -C apps/client typecheck` (passed)
  - `pnpm -C apps/client build:weapp` (passed)

## Current Conclusion

The maintenance chain is now implemented as an order-centered, auditable lifecycle with unified support conversation entry and synced API documentation/types.

## Remaining Production Alignment (Non-code)

- Complete production payment credential provisioning and callback validation in real environment.
- Complete smoke run with real WeChat MP login + payment callback + maintenance order conversation in production-like deployment.
