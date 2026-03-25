# Patent Map Data Governance (2026-03-25 refresh)

## Why
- Patent map supports two scopes:
  - `ACTIVE_APPROVED` (default): active + approved listings.
  - `ALL`: all listings for operational analysis.
- Aggregation and region detail use one source of truth: `listings + regions + patents`.
- To reduce blind spots, map region resolution now uses:
  1. `listing.regionCode`
  2. fallback to `seller.regionCode` when listing region is empty
- `unassignedListingCount` now means both listing and seller region are unavailable.

## Current Behavior Contract
- Region aggregation level: `PROVINCE | CITY | DISTRICT`.
- Ranking sort priority:
  1. `listingCount` (desc)
  2. `patentCount` (desc)
  3. `activeRankedListingCount` (desc)
  4. `rankedListingCount` (desc)
  5. `topActiveRank` (asc when both present)
  6. `regionCode` (asc)
- No dedicated map table is introduced; map data is always derived from transactional entities.

## Enforced Rules
- `regionCode` must match 6-digit format when provided.
- Listing status transition to `ACTIVE` requires valid `regionCode`.
- Coverage applies to:
  - user submit flow (`/listings/:id/submit`)
  - admin publish flow (`/admin/listings/:id/publish`)
  - listing batch publish jobs
  - admin create/update when final status is `ACTIVE`
  - listing import validation (`ACTIVE` rows without region are rejected early)

## Backfill Script
- Script: `scripts/listing-region-backfill.mjs`
- Default mode is dry-run (no writes).
- Region source priority:
  1. seller approved verification region
  2. seller profile region
  3. patent owner approved verification region
  4. patent owner profile region
- Conflict handling:
  - if seller candidate and owner candidate both exist and differ, do not auto-write.

### Commands
```bash
# dry-run for map scope (APPROVED + ACTIVE + regionCode is null)
pnpm listing:region-backfill

# dry-run for all missing region listings
pnpm listing:region-backfill -- --scope=all

# apply updates for map scope
pnpm listing:region-backfill -- --apply

# apply updates for all missing region listings
pnpm listing:region-backfill -- --scope=all --apply
```

## Rollout Suggestion
- Step 1: run dry-run and review `conflicts` / `sampleResolvable`.
- Step 2: apply in small batches and verify `regionsWithListingsCount` and `unassignedListingCount`.
- Step 3: rerun smoke validation:
  - `scripts/api-real-smoke.ps1`
  - `scripts/check-api-smoke-openapi-coverage.mjs`
  - `scripts/check-api-smoke-quality-floor.mjs`
