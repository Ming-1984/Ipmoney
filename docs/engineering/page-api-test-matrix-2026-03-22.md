# Page-API-Test Matrix (2026-03-22)

> Scope: client + admin-web pages; excludes real login/payment integrations.
> Data sources: `.tmp/ui-render-smoke-2026-03-22.json`, `.tmp/ui-http-smoke-2026-03-22.json`, `.tmp/ui-dom-smoke-2026-03-22.json`, `docs/engineering/traceability-matrix.md`.

## Snapshot
- UI render smoke (full): 64/64 pass.
- Coverage split: client 44/44, admin 20/20.
- UI HTTP smoke: 21/64 pages have route-level HTTP checks (root-focused).
- DOM assertion automation: 64/64 pages (64/64 in current DOM smoke run).
- E2E automation: 0/64 (planned in B03).

## Matrix
| Page | Area | Route | API Domain | HTTP Smoke | Render Smoke | DOM Assert | E2E | Manual | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| admin-alerts | admin | /alerts | admin/alerts | Y | Y | Y | N | pending | admin-web |
| admin-audit-logs | admin | /audit-logs | admin/audit-logs | Y | Y | Y | N | pending | admin-web |
| admin-cases | admin | /cases | admin/misc | Y | Y | Y | N | pending | admin-web |
| admin-comments | admin | /comments | admin/comments | Y | Y | Y | N | pending | admin-web |
| admin-config | admin | /config | admin/config | Y | Y | Y | N | pending | admin-web |
| admin-dashboard | admin | / | admin/dashboard | Y | Y | Y | N | pending | admin-web |
| admin-invoices | admin | /invoices | admin/invoices | Y | Y | Y | N | pending | admin-web |
| admin-listings | admin | /listings | admin/listings-audit | Y | Y | Y | N | pending | admin-web |
| admin-login | admin | /login | demo-auth-boundary | Y | Y | Y | N | pending | admin-web |
| admin-maintenance | admin | /maintenance | admin/patent-maintenance | Y | Y | Y | N | pending | admin-web |
| admin-order-detail | admin | /orders/e9032d03-9b23-40ba-84a3-ac681f21c41b | admin/orders | Y | Y | Y | N | pending | admin-web |
| admin-orders | admin | /orders | admin/orders | Y | Y | Y | N | pending | admin-web |
| admin-patents | admin | /patents | admin/patents | Y | Y | Y | N | pending | admin-web |
| admin-rbac | admin | /rbac | admin/rbac | Y | Y | Y | N | pending | admin-web |
| admin-refunds | admin | /refunds | admin/refunds | Y | Y | Y | N | pending | admin-web |
| admin-regions | admin | /regions | admin/regions | Y | Y | Y | N | pending | admin-web |
| admin-reports | admin | /reports | admin/reports | Y | Y | Y | N | pending | admin-web |
| admin-settlements | admin | /settlements | admin/settlements | Y | Y | Y | N | pending | admin-web |
| admin-tech-managers | admin | /tech-managers | admin/tech-managers | Y | Y | Y | N | pending | admin-web |
| admin-verifications | admin | /verifications | admin/verifications | Y | Y | Y | N | pending | admin-web |
| client-about | client | /subpackages/about/index | static/config (no critical API write) | N | Y | Y | N | pending | client |
| client-address-edit | client | /subpackages/addresses/edit/index | client/misc | N | Y | Y | N | pending | client |
| client-addresses | client | /subpackages/addresses/index | orders/payment/address/invoice | N | Y | Y | N | pending | client |
| client-chat | client | /subpackages/messages/chat/index?conversationId=127a267b-d5f8-4b39-acf8-855dff7258b0 | conversations + notifications | N | Y | Y | N | pending | client |
| client-contracts | client | /subpackages/contracts/index | orders/payment/address/invoice | N | Y | Y | N | pending | client |
| client-deposit-pay | client | /subpackages/checkout/deposit-pay/index?listingId=7a490e63-8173-41e7-b4f0-0d0bb5ce7d20 | client/misc | N | Y | Y | N | pending | client |
| client-deposit-success | client | /subpackages/checkout/deposit-success/index?orderId=e9032d03-9b23-40ba-84a3-ac681f21c41b | client/misc | N | Y | Y | N | pending | client |
| client-favorites | client | /subpackages/favorites/index | favorites | N | Y | Y | N | pending | client |
| client-final-pay | client | /subpackages/checkout/final-pay/index?orderId=e9032d03-9b23-40ba-84a3-ac681f21c41b | client/misc | N | Y | Y | N | pending | client |
| client-final-success | client | /subpackages/checkout/final-success/index?orderId=e9032d03-9b23-40ba-84a3-ac681f21c41b | client/misc | N | Y | Y | N | pending | client |
| client-home | client | /pages/home/index | public discovery/search | Y | Y | Y | N | pending | client |
| client-inventors | client | /subpackages/inventors/index | public discovery/search | N | Y | Y | N | pending | client |
| client-invoices | client | /subpackages/invoices/index | orders/payment/address/invoice | N | Y | Y | N | pending | client |
| client-ipc-picker | client | /subpackages/ipc-picker/index | static/config (no critical API write) | N | Y | Y | N | pending | client |
| client-legal-privacy | client | /subpackages/legal/privacy/index | static/config (no critical API write) | N | Y | Y | N | pending | client |
| client-legal-privacy-guide | client | /subpackages/legal/privacy-guide/index | static/config (no critical API write) | N | Y | Y | N | pending | client |
| client-legal-terms | client | /subpackages/legal/terms/index | static/config (no critical API write) | N | Y | Y | N | pending | client |
| client-listing-detail | client | /subpackages/listing/detail/index?listingId=7a490e63-8173-41e7-b4f0-0d0bb5ce7d20 | public discovery/search | N | Y | Y | N | pending | client |
| client-login | client | /subpackages/login/index | auth/me/verification | N | Y | Y | N | pending | client |
| client-me | client | /pages/me/index | auth/me/verification | N | Y | Y | N | pending | client |
| client-messages | client | /pages/messages/index | conversations + notifications | N | Y | Y | N | pending | client |
| client-my-listings | client | /subpackages/my-listings/index | public discovery/search | N | Y | Y | N | pending | client |
| client-notification-detail | client | /subpackages/notifications/detail/index?id=f15de7ac-b89d-45a5-9a26-5296caef82a4 | client/misc | N | Y | Y | N | pending | client |
| client-notifications | client | /subpackages/notifications/index | conversations + notifications | N | Y | Y | N | pending | client |
| client-onboarding-choose-identity | client | /subpackages/onboarding/choose-identity/index | auth/me/verification | N | Y | Y | N | pending | client |
| client-onboarding-verification-form | client | /subpackages/onboarding/verification-form/index | auth/me/verification | N | Y | Y | N | pending | client |
| client-order-detail | client | /subpackages/orders/detail/index?orderId=e9032d03-9b23-40ba-84a3-ac681f21c41b | client/misc | N | Y | Y | N | pending | client |
| client-orders | client | /subpackages/orders/index | orders/payment/address/invoice | N | Y | Y | N | pending | client |
| client-organization-detail | client | /subpackages/organizations/detail/index?orgUserId=c5b6438a-f3a7-4590-a484-0f2a2991c613 | client/misc | N | Y | Y | N | pending | client |
| client-organizations | client | /subpackages/organizations/index | public discovery/search | N | Y | Y | N | pending | client |
| client-patent-detail | client | /subpackages/patent/detail/index?patentId=965f9831-2c44-48e8-8b7a-cd7ab40ff7ec | public discovery/search | N | Y | Y | N | pending | client |
| client-profile-edit | client | /subpackages/profile/edit/index | auth/me/verification | N | Y | Y | N | pending | client |
| client-publish-entry | client | /pages/publish/index | my-content create/update/submit | N | Y | Y | N | pending | client |
| client-publish-patent | client | /subpackages/publish/patent/index | my-content create/update/submit | N | Y | Y | N | pending | client |
| client-region-picker | client | /subpackages/region-picker/index | static/config (no critical API write) | N | Y | Y | N | pending | client |
| client-search | client | /subpackages/search/index | public discovery/search | N | Y | Y | N | pending | client |
| client-settings-notifications | client | /subpackages/settings/notifications/index | auth/me/verification | N | Y | Y | N | pending | client |
| client-support | client | /subpackages/support/index | static/config (no critical API write) | N | Y | Y | N | pending | client |
| client-support-contact | client | /subpackages/support/contact/index | static/config (no critical API write) | N | Y | Y | N | pending | client |
| client-support-faq | client | /subpackages/support/faq/index | static/config (no critical API write) | N | Y | Y | N | pending | client |
| client-support-faq-detail | client | /subpackages/support/faq/detail/index?id=faq-1 | static/config (no critical API write) | N | Y | Y | N | pending | client |
| client-tech-manager-detail | client | /subpackages/tech-managers/detail/index?techManagerId=c05d27bc-c739-47ad-91f7-53ccf8517a4e | client/misc | N | Y | Y | N | pending | client |
| client-tech-managers | client | /pages/tech-managers/index | public discovery/search | N | Y | Y | N | pending | client |
| client-trade-rules | client | /subpackages/trade-rules/index | static/config (no critical API write) | N | Y | Y | N | pending | client |

## Notes
- API domain mapping is a first-pass taxonomy for risk grouping; endpoint-level mapping remains in `docs/engineering/traceability-matrix.md`.
- Pages marked `HTTP Smoke=N` still have render evidence from screenshot artifacts under `docs/demo/rendered/ui-smoke-2026-03-05/`.
- DOM smoke is running in `full-batch2` and currently covers 64/64 pages; full page coverage is achieved for this baseline.
