# Page-API-Test Matrix (2026-03-05)

> Scope: client + admin-web pages; excludes real login/payment integrations.
> Data sources: `.tmp/ui-render-smoke-2026-03-05.json`, `.tmp/ui-http-smoke-2026-03-05.json`, `.tmp/ui-dom-smoke-2026-03-05.json`, `docs/engineering/traceability-matrix.md`.

## Snapshot
- UI render smoke (full): 83/83 pass.
- Coverage split: client 58/58, admin 25/25.
- UI HTTP smoke: 7/83 pages have route-level HTTP checks (root-focused).
- DOM assertion automation: 11/83 pages (11/11 in current DOM smoke run).
- E2E automation: 0/83 (planned in B03).

## Matrix
| Page | Area | Route | API Domain | HTTP Smoke | Render Smoke | DOM Assert | E2E | Manual | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| admin-achievements | admin | /achievements | admin/achievements-audit | N | Y | N | N | pending | admin-web |
| admin-alerts | admin | /alerts | admin/alerts | N | Y | N | N | pending | admin-web |
| admin-announcements | admin | /announcements | admin/announcements | N | Y | N | N | pending | admin-web |
| admin-artworks | admin | /artworks | admin/artworks-audit | N | Y | N | N | pending | admin-web |
| admin-audit-logs | admin | /audit-logs | admin/audit-logs | N | Y | N | N | pending | admin-web |
| admin-cases | admin | /cases | admin/misc | N | Y | N | N | pending | admin-web |
| admin-comments | admin | /comments | admin/comments | N | Y | N | N | pending | admin-web |
| admin-config | admin | /config | admin/config | Y | Y | Y | N | pending | admin-web |
| admin-dashboard | admin | / | admin/dashboard | Y | Y | Y | N | pending | admin-web |
| admin-demands | admin | /demands | admin/demands-audit | N | Y | N | N | pending | admin-web |
| admin-invoices | admin | /invoices | admin/invoices | N | Y | N | N | pending | admin-web |
| admin-listings | admin | /listings | admin/listings-audit | N | Y | N | N | pending | admin-web |
| admin-login | admin | /login | demo-auth-boundary | Y | Y | Y | N | pending | admin-web |
| admin-maintenance | admin | /maintenance | admin/patent-maintenance | N | Y | N | N | pending | admin-web |
| admin-order-detail | admin | /orders/e9032d03-9b23-40ba-84a3-ac681f21c41b | admin/orders | N | Y | N | N | pending | admin-web |
| admin-orders | admin | /orders | admin/orders | Y | Y | Y | N | pending | admin-web |
| admin-patent-map | admin | /patent-map | admin/patent-map | Y | Y | N | N | pending | admin-web |
| admin-patents | admin | /patents | admin/patents | N | Y | N | N | pending | admin-web |
| admin-rbac | admin | /rbac | admin/rbac | N | Y | N | N | pending | admin-web |
| admin-refunds | admin | /refunds | admin/refunds | N | Y | N | N | pending | admin-web |
| admin-regions | admin | /regions | admin/regions | N | Y | N | N | pending | admin-web |
| admin-reports | admin | /reports | admin/reports | N | Y | N | N | pending | admin-web |
| admin-settlements | admin | /settlements | admin/settlements | N | Y | N | N | pending | admin-web |
| admin-tech-managers | admin | /tech-managers | admin/tech-managers | N | Y | N | N | pending | admin-web |
| admin-verifications | admin | /verifications | admin/verifications | Y | Y | Y | N | pending | admin-web |
| client-about | client | /pages/about/index | static/config (no critical API write) | N | Y | N | N | pending | client |
| client-achievement-detail | client | /pages/achievement/detail/index?achievementId=2a9ee2ee-9ab8-4335-b568-e9d9ef57f2f7 | public achievement detail + conversation | N | Y | N | N | pending | client |
| client-address-edit | client | /pages/addresses/edit/index | client/misc | N | Y | N | N | pending | client |
| client-addresses | client | /pages/addresses/index | orders/payment/address/invoice | N | Y | N | N | pending | client |
| client-announcement-detail | client | /pages/announcements/detail/index?id=d9b6adf1-0276-4af5-8bd0-5fcb8c20053c | client/misc | N | Y | N | N | pending | client |
| client-announcements | client | /pages/announcements/index | public announcements | N | Y | N | N | pending | client |
| client-artwork-detail | client | /pages/artwork/detail/index?artworkId=7f8e9f72-98f4-4f4a-8d11-44f38fcf3d51 | public artwork detail + conversation | N | Y | N | N | pending | client |
| client-chat | client | /pages/messages/chat/index?conversationId=127a267b-d5f8-4b39-acf8-855dff7258b0 | conversations + notifications | N | Y | N | N | pending | client |
| client-cluster-picker | client | /pages/cluster-picker/index | static/config (no critical API write) | N | Y | N | N | pending | client |
| client-contracts | client | /pages/contracts/index | orders/payment/address/invoice | N | Y | N | N | pending | client |
| client-demand-detail | client | /pages/demand/detail/index?demandId=8f278f0a-6ccf-45ce-a664-f5eaf39a9be4 | public demand detail + conversation | N | Y | N | N | pending | client |
| client-deposit-pay | client | /pages/checkout/deposit-pay/index?listingId=7a490e63-8173-41e7-b4f0-0d0bb5ce7d20 | client/misc | N | Y | N | N | pending | client |
| client-deposit-success | client | /pages/checkout/deposit-success/index?orderId=e9032d03-9b23-40ba-84a3-ac681f21c41b | client/misc | N | Y | N | N | pending | client |
| client-favorites | client | /pages/favorites/index | favorites | N | Y | N | N | pending | client |
| client-final-pay | client | /pages/checkout/final-pay/index?orderId=e9032d03-9b23-40ba-84a3-ac681f21c41b | client/misc | N | Y | N | N | pending | client |
| client-final-success | client | /pages/checkout/final-success/index?orderId=e9032d03-9b23-40ba-84a3-ac681f21c41b | client/misc | N | Y | N | N | pending | client |
| client-home | client | /pages/home/index | public discovery/search | Y | Y | Y | N | pending | client |
| client-inventors | client | /pages/inventors/index | public discovery/search | N | Y | N | N | pending | client |
| client-invoices | client | /pages/invoices/index | orders/payment/address/invoice | N | Y | N | N | pending | client |
| client-ipc-picker | client | /pages/ipc-picker/index | static/config (no critical API write) | N | Y | N | N | pending | client |
| client-legal-privacy | client | /pages/legal/privacy/index | static/config (no critical API write) | N | Y | N | N | pending | client |
| client-legal-privacy-guide | client | /pages/legal/privacy-guide/index | static/config (no critical API write) | N | Y | N | N | pending | client |
| client-legal-terms | client | /pages/legal/terms/index | static/config (no critical API write) | N | Y | N | N | pending | client |
| client-listing-detail | client | /pages/listing/detail/index?listingId=7a490e63-8173-41e7-b4f0-0d0bb5ce7d20 | public discovery/search | N | Y | Y | N | pending | client |
| client-login | client | /pages/login/index | auth/me/verification | N | Y | N | N | pending | client |
| client-me | client | /pages/me/index | auth/me/verification | N | Y | Y | N | pending | client |
| client-messages | client | /pages/messages/index | conversations + notifications | N | Y | N | N | pending | client |
| client-my-achievements | client | /pages/my-achievements/index | my-content create/update/submit | N | Y | N | N | pending | client |
| client-my-artworks | client | /pages/my-artworks/index | my-content create/update/submit | N | Y | N | N | pending | client |
| client-my-demands | client | /pages/my-demands/index | my-content create/update/submit | N | Y | N | N | pending | client |
| client-my-listings | client | /pages/my-listings/index | public discovery/search | N | Y | N | N | pending | client |
| client-notification-detail | client | /pages/notifications/detail/index?id=f15de7ac-b89d-45a5-9a26-5296caef82a4 | client/misc | N | Y | N | N | pending | client |
| client-notifications | client | /pages/notifications/index | conversations + notifications | N | Y | N | N | pending | client |
| client-onboarding-choose-identity | client | /pages/onboarding/choose-identity/index | auth/me/verification | N | Y | N | N | pending | client |
| client-onboarding-verification-form | client | /pages/onboarding/verification-form/index | auth/me/verification | N | Y | N | N | pending | client |
| client-order-detail | client | /pages/orders/detail/index?orderId=e9032d03-9b23-40ba-84a3-ac681f21c41b | client/misc | N | Y | N | N | pending | client |
| client-orders | client | /pages/orders/index | orders/payment/address/invoice | N | Y | Y | N | pending | client |
| client-organization-detail | client | /pages/organizations/detail/index?orgUserId=c5b6438a-f3a7-4590-a484-0f2a2991c613 | client/misc | N | Y | N | N | pending | client |
| client-organizations | client | /pages/organizations/index | public discovery/search | N | Y | N | N | pending | client |
| client-patent-detail | client | /pages/patent/detail/index?patentId=965f9831-2c44-48e8-8b7a-cd7ab40ff7ec | public discovery/search | N | Y | N | N | pending | client |
| client-patent-map | client | /pages/patent-map/index | patent-map + regions | N | Y | N | N | pending | client |
| client-patent-map-region-detail | client | /pages/patent-map/region-detail/index?regionCode=110000&year=2025 | patent-map + regions | N | Y | N | N | pending | client |
| client-profile-edit | client | /pages/profile/edit/index | auth/me/verification | N | Y | N | N | pending | client |
| client-publish-achievement | client | /pages/publish/achievement/index | my-content create/update/submit | N | Y | N | N | pending | client |
| client-publish-artwork | client | /pages/publish/artwork/index | my-content create/update/submit | N | Y | N | N | pending | client |
| client-publish-demand | client | /pages/publish/demand/index | my-content create/update/submit | N | Y | N | N | pending | client |
| client-publish-entry | client | /pages/publish/index | my-content create/update/submit | N | Y | N | N | pending | client |
| client-publish-patent | client | /pages/publish/patent/index | my-content create/update/submit | N | Y | Y | N | pending | client |
| client-region-picker | client | /pages/region-picker/index | static/config (no critical API write) | N | Y | N | N | pending | client |
| client-search | client | /pages/search/index | public discovery/search | N | Y | Y | N | pending | client |
| client-settings-notifications | client | /pages/settings/notifications/index | auth/me/verification | N | Y | N | N | pending | client |
| client-support | client | /pages/support/index | static/config (no critical API write) | N | Y | N | N | pending | client |
| client-support-contact | client | /pages/support/contact/index | static/config (no critical API write) | N | Y | N | N | pending | client |
| client-support-faq | client | /pages/support/faq/index | static/config (no critical API write) | N | Y | N | N | pending | client |
| client-support-faq-detail | client | /pages/support/faq/detail/index?id=faq-1 | static/config (no critical API write) | N | Y | N | N | pending | client |
| client-tech-manager-detail | client | /pages/tech-managers/detail/index?techManagerId=c05d27bc-c739-47ad-91f7-53ccf8517a4e | client/misc | N | Y | N | N | pending | client |
| client-tech-managers | client | /pages/tech-managers/index | public discovery/search | N | Y | N | N | pending | client |
| client-trade-rules | client | /pages/trade-rules/index | static/config (no critical API write) | N | Y | N | N | pending | client |

## Notes
- API domain mapping is a first-pass taxonomy for risk grouping; endpoint-level mapping remains in `docs/engineering/traceability-matrix.md`.
- Pages marked `HTTP Smoke=N` still have render evidence from screenshot artifacts under `docs/demo/rendered/ui-smoke-2026-03-05/`.
- DOM smoke currently tracks a core subset; next step is extending assertions from core to full 83-page scope.
