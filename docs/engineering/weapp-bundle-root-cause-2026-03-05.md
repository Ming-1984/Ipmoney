# WeApp Bundle Root Cause Report (2026-03-05)

## Scope
- Build target: `apps/client` WeApp (`pnpm -C apps/client build:weapp`)
- Out of scope: real login/payment integrations

## Symptom
- Previous build output had severe wxss bloat:
  - `app-origin.wxss`: 2,690,716 bytes
  - `pages/home/index.wxss`: 2,586,679 bytes
  - `pages/me/index.wxss`: 1,271,348 bytes
  - `subpackages/login/index.wxss`: 1,266,653 bytes

## Root cause
- Large GIF assets were referenced via CSS background URLs in shared/app-level styles:
  - `apps/client/src/app.scss`
  - `apps/client/src/pages/home/index.scss`
  - `apps/client/src/pages/me/index.scss`
  - `apps/client/src/subpackages/login/index.scss`
- During WeApp build, those GIF assets were embedded into wxss content, causing repeated multi-hundred-KB payload inflation across multiple page styles.
- The primary offending assets:
  - `apps/client/src/assets/brand/logo.optim2.gif` (~947 KB)
  - `apps/client/src/assets/home/promo-certificate.optim3.gif` (~981 KB)

## Fix applied
- Replaced heavy GIF background references with lightweight PNG assets:
  - `logo.optim2.gif` -> `logo.png`
  - `promo-certificate.optim3.gif` -> `promo-certificate.png`
- Added hard budget gate script:
  - `scripts/check-weapp-bundle-budget.mjs`
  - integrated into `scripts/verify.ps1`
  - integrated into `.github/workflows/ci.yml`

## Current result
- Rebuilt WeApp after fix:
  - `app-origin.wxss`: 286,492 bytes
  - `pages/home/index.wxss`: 118,115 bytes
  - `pages/me/index.wxss`: 69,236 bytes
  - `subpackages/login/index.wxss`: 64,541 bytes
- All key files now pass the current hard budget (`app-origin` < 500 KB; key pages < 200 KB).

## Remaining work
- Keep animation assets out of global/shared style paths.
- Prefer component-level `<Image>` rendering for heavy media over CSS background embedding.
- Continue trend tracking in `docs/engineering/test-report.md`.
