# PIQ V2 Discovery — Paused: RFDC Backfill Required

**Date:** 2026-05-24
**Status:** Plan A execution paused at Task 4.5 (panel dump). Resuming requires RFDC historical backfill.

## What we discovered

The new Redfin Data Center tables (`redfin_dc_*`) were created on 2026-05-23 (commit `04a58aab`) but have **only the latest 3 monthly snapshots** ingested so far:

| Table                                    | Rows | Earliest   | Latest     | Distinct regions |
| ---------------------------------------- | ---: | ---------- | ---------- | ---------------: |
| `redfin_dc_housing_market_metro`         |  300 | 2026-02-28 | 2026-04-30 |               93 |
| `redfin_dc_price_drops_metro`            |  300 | 2026-02-28 | 2026-04-30 |               93 |
| `redfin_dc_contract_cancellations_metro` |  300 | 2026-02-28 | 2026-04-30 |               93 |
| `redfin_dc_delistings_relistings_metro`  |  300 | 2026-02-28 | 2026-04-30 |               93 |

3 months of history at 93 metros cannot support a 3-year forward-return predictive model. The V2 redesign requires multi-year history per feature.

## Sources that ARE historically ready (per metro-level census)

| Source                     |    Rows | Earliest | Latest  | Distinct regions |
| -------------------------- | ------: | -------- | ------- | ---------------: |
| `zillow_metro` (ZHVI long) | 162,519 | 2010-01  | 2026-04 |             ~850 |
| `realtor_metro`            | 109,190 | 2016-07  | 2026-04 |              935 |
| `economic_metro` (BLS/BEA) |  61,074 | 2000-01  | 2026-03 |              410 |
| `census_metro` (ACS)       |  13,177 | annual   | 2024    |             ~960 |

These four sources together provide a working V1 feature universe — but the user's explicit goal was to use the NEW Redfin DC dashboards as the primary signal source.

## What's already shipped on `develop`

All 8 DB-agnostic code modules complete and tested:

| File                                    | Commit     |
| --------------------------------------- | ---------- |
| `scripts/analysis/v2/db.py`             | `7c771dd5` |
| `scripts/analysis/v2/peer_cascade.py`   | `bc12c646` |
| `scripts/analysis/v2/target_builder.py` | `a828fb2c` |
| `scripts/analysis/v2/feature_loader.py` | `90e9ce5a` |
| `scripts/analysis/v2/feature_ranker.py` | `6d8ecd32` |
| `scripts/analysis/v2/forward_add.py`    | `3226b0a6` |
| `scripts/analysis/v2/validation.py`     | `4f93a391` |
| `scripts/analysis/v2/discover.py`       | `1f7f7778` |

Pilot metro Parquet dump (commit `745b30a8`) is in `scripts/analysis/v2/data/` — usable today for non-RFDC discovery if we ever want to validate the pipeline against the working sources.

## What needs to happen before V1 can ship

### Prerequisite: backfill RFDC historical data

The ingestion infrastructure exists at `scripts/redfin-dc/` (commits `8e15ad49`, `a9fd01b4`, `32a9c760`). It needs to be run against historical Redfin Data Center exports.

**Target coverage:** 2017-01-01 to current month, all 8 dashboards (housing_market, price_drops, contract_cancellations, delistings_relistings, investors, cash_loan, buyers_sellers, rhpi), all supported geos per dashboard (see spec §5.1).

**Volume estimate:** ~9 years × 12 months × ~750 metros = ~80,000 rows per dashboard at metro level (×5 for other geos with full RFDC support). Order of ~5M rows total across all dashboards/geos for full backfill.

### Resume Plan A after backfill

Once the historical RFDC data is in:

1. Re-run the dump coordinator (Task 4.5 — already written, just re-execute with RFDC included)
2. Continue with original task sequence: Task 4 (P0 sanity) → Task 6 (threshold sweep) → Tasks 9-12 (discovery) → Task 13 (summary) → Task 14 (Plan B handoff)

All the code is ready. Only data depth is missing.

## Decision the user made

> "pause. backfill as much of the new data as possible"

This is the right call. Shipping V1 on a feature universe that **excludes** the new RFDC tables would defeat the purpose of the redesign and require swapping in RFDC features later — exactly the "formula change in the future" the user wanted to avoid.

## Status reflected in project memory

`~/.claude/.../memory/project_piq-score-v2.md` will be updated with the paused state and RFDC backfill prerequisite.
