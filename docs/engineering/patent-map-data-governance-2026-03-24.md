# Patent Map Data Governance (2026-03-24)

## Why
- The patent map uses `APPROVED + ACTIVE` listings as the source of truth.
- If `listing.regionCode` is missing, records are counted but cannot be mapped to a region.
- Governance must prevent new missing-region records and provide a safe backfill path.

## Enforced Rules
- `regionCode` must match 6-digit format when provided.
- Listing status transition to `ACTIVE` requires valid `regionCode`.
- Coverage applies to:
  - user submit flow (`/listings/:id/submit`)
  - admin publish flow (`/admin/listings/:id/publish`)
  - listing batch publish jobs
  - admin create/update when final status is `ACTIVE`
  - listing import validation (rows marked invalid early if `ACTIVE` without region)

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
- Step 2: apply in small batches and verify map summary changes.
- Step 3: monitor new listing submissions to confirm `ACTIVE` records no longer miss region.
