# PropertyIQ Score Productionized — Results

**Date:** 2026-06-13
**Plan:** `docs/superpowers/plans/2026-06-12-piq-score-production-wiring.md`
**Branch:** `develop` (committed, NOT deployed — deploy is the user's call)

## What shipped

The Redfin-free momentum+flow formula is now the live PropertyIQ score, and history is backfilled as far as the data allows.

- **Formula** `signal = z(zhvi_yoy) + z(zhvi_mom_3m) − z(median_days_on_market) − z(price_reduced_share)` → percentile → re-center at 50 → clamp 1–99. No version numbers (`PROPERTYIQ_FORMULA_VERSION`, the `-v4` route, and the engine version export all deleted).
- **Engine** made metric-generic; **fetcher** rewritten to read Zillow ZHVI momentum + Realtor DOM/price-cuts (union coverage, ≥2-of-4 rule). Commits `7dff1ce8`, `b9427c23`, `e8e10177`.
- **Backfill** loaded into `propertyiq_scores_v2` (`score_type='propertyiq'`), 2001-01 → 2026-04-30:

| Level  | Rows      | Regions | Latest-month confidence (A/B/C) |
| ------ | --------- | ------- | ------------------------------- |
| metro  | 222,420   | 935     | 865 / 0 / 71                    |
| county | 673,772   | 3,151   | 3,046 / 1 / 87                  |
| zip    | 6,556,176 | 34,127  | 25,157 / 107 / 3,949            |

Old 2.42M rows snapshotted to `backup_piq_scores_propertyiq_20260612` before replacement. Pipeline is **unfrozen** — April 2026 scores are live (was frozen at March).

- **Frontend** (commit `341976c3`): score breakdown waterfall, FAQ copy, and `validation-claims.ts` refreshed from the backtest artifacts.

## Validation

- **Shadow-compare gate** (`packages/backend/src/scripts/shadow-compare-scores.ts --date=2026-04-30`): the production TS scorer reproduces the Python backfill **100% exact** at metro (935), county (3,134), and zip (29,213). Confidence agreement 100%.
- **E2E (real browser, prod data):** `/markets/rochester-ny` renders "Score: 99 out of 100" — the new backfilled value flows end-to-end through the live read path.

## Bugs found & fixed along the way

1. **`zillow_metro.cbsa_code` corruption** (the big one). Ingest left `cbsa_code` NULL on new months, and two unrelated cities shared one CBSA (Helena MT/AR, Atlantic City/Ocean City). The latter made metro scores non-deterministic (z-score std pollution re-weighting all metros). Fixed by re-deriving `cbsa_code` from `zillow_metro_crosswalk` with title-matching (migration `20260613140100`). See memory `reference_zillow_metro_cbsa_crosswalk_bug`.
2. **Zip fetch statement-timeout.** OFFSET pagination re-sorted 26k rows per page → exceeded the PostgREST role timeout. Fixed with a partial covering index `idx_zillow_zip_zhvi_period_region` (migration `20260613140000`, index-only scan 22ms) plus sequential fetches.
3. **Supabase disk pressure** — the full backfill briefly filled the 34 GB disk; resolved by VACUUM reclaiming dead-tuple space. Worth monitoring headroom.

## Open follow-ups (not done; flagged to user)

- **Deploy** backend + frontend (user controls pushes/deploys).
- **Ingestion root cause:** the Zillow metro ingest must apply the crosswalk, or defect #1 recurs every month. Migration only corrects existing data.
- **Stale SEO copy:** programmatic market pages (e.g. `/markets/rochester-ny`) still describe the retired HomeReady/InvestorEdge/MarketHealth 3-score system and old claim numbers in prose. Needs a content pass.
- **Pre-2016 momentum-only history** is published with C confidence — confirm that's desired vs. starting public history at 2016-07.
