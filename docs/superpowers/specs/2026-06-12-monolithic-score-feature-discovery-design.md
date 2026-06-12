# Monolithic Score Feature Discovery (Redfin-Free) — Design

**Date:** 2026-06-12
**Status:** Approved (user, this session)
**Driver:** Redfin Data Center collapsed metro coverage to ~93 metros (legacy: 932) and dropped/redefined 2 of the 3 current score inputs (`months_of_supply` gone, `sold_above_list` → `share_sold_above_original_list`). The current PropertyIQ formula cannot survive the migration at metro level.

## Goal

Find the best **3–5 features** for a **single monolithic formula, identical across metro/county/ZIP**, using **no Redfin data**, that matches or beats the current score's predictive power (3Y out-of-sample Spearman IC ≈ 0.23 vs 3-year forward excess return).

Formula shape stays exactly what the engine computes today — signed sum of cross-sectional z-scores:

```
signal = ±z(f1) ± z(f2) ± z(f3) [± z(f4) ± z(f5)]
→ percentile rank within geo level → re-center → clamp 1–99
```

Equal signed weights (user: weighting is not a concern; equal weights are robust OOS and keep the engine change to metric names + directions only).

## Constraints (user-set, hard)

1. **No Redfin** anywhere in the formula.
2. **Full coverage at all three geo levels** (~900 metros, ~3.1k counties, ~26k+ ZIPs) — a feature missing at any level is disqualified.
3. **Same features, same directions at every level.**
4. Target: **3Y forward excess return vs state** (same yardstick as today's validation).

## Verified data foundation (2026-06-12, live DB)

| Source                                          | Metro                  | County | ZIP                | History                                     | Notes                                                                                                                                                               |
| ----------------------------------------------- | ---------------------- | ------ | ------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Realtor.com (`realtor_metro/county/zip`)        | 935                    | 3,142  | 34,199             | 2016-07+                                    | DOM & `price_reduced_share` ~100% populated all levels; `pending_ratio` 85–100%; pre-computed `_mm`/`_yy` columns; `hotness_score` only 32–51% populated → excluded |
| Zillow (`zillow_metro/county/zip`, long format) | 876                    | 3,073  | 26,307             | ZHVI 2000+; inventory/new_listings 2018-03+ | `market_heat`, `price_cuts`, `sale_to_list`, `pending_sales` are metro-only → excluded; `dom` ZIP coverage 5,661 → excluded                                         |
| `zhvi_forward_returns`                          | 866                    | 3,073  | 26,307 + 51 states | 2000+                                       | `return_3y_ann` per (level, location, month) — target source                                                                                                        |
| `score_geo_state_map`                           | 865                    | 3,073  | 26,307             | —                                           | (geography, location_id) → state_code; matches target universe exactly                                                                                              |
| `calculated_metrics`                            | —                      | —      | —                  | —                                           | **STALE: derived columns 0% populated last 12 months.** Not used; derivations computed fresh                                                                        |
| Census ACS                                      | annual only, 2010–2023 |        |                    |                                             | excluded from formula candidates (annual lag incompatible with monthly cross-sectional z-scores)                                                                    |
| Redfin DC                                       | 93 metros ❌           | 3,138  | 33,362 (2019+)     |                                             | excluded per constraint #1                                                                                                                                          |

## Candidate feature pool (~18, all full-coverage at all 3 levels)

**Realtor (level + momentum):** `median_days_on_market`, `median_days_on_market_yy`, `price_reduced_share`, `price_reduced_share_yy`, `price_increased_share`, `pending_ratio`, `pending_ratio_yy`, `active_listing_count_yy`, `new_listing_count_yy`, `total_listing_count_yy`, `median_listing_price_yy`
**Zillow raw + fresh derivations:** `zhvi_yoy` (12m % change), `zhvi_mom_3m` (3m % change), `inventory_yoy`, `new_listings_yoy`, `zhvi_accel` (12m change minus prior-year 12m change)

Inverse-coverage features (DOM↓, supply↑ = cold) get their natural sign; directions are free parameters in the search (SHAP determines empirically).

## Pipeline (4 stages, `scripts/analysis/monolithic-discovery/`)

1. **`build_panels.py`** — one parquet per geo level: rows = (location_id, month), columns = candidates + `excess_3y` = `return_3y_ann` − state `return_3y_ann` (join via `score_geo_state_map`). Z-score every feature cross-sectionally within (level, month). Vintages: 2016-07 → 2023-02 (3Y outcome must be observable).
2. **`shap_ranking.py`** — LightGBM per level, walk-forward by vintage year (train ≤ year N, test N+1), mean |SHAP| per feature per level. Output: ranked importance table (the "SHAP-type analysis").
3. **`formula_search.py`** — top ~12 cross-level features by SHAP; enumerate all signed 3/4/5-feature equal-weight combos (~800); score each by walk-forward Spearman IC per year per level. Winner = max **worst-level** median IC (prevents metro dominating while ZIP degrades).
4. **`validate_winner.py`** — for the winning formula: year-by-year IC table per level (gate: ≥80% positive years), permutation test (≥3σ above shuffled-target null), decile spread, and baseline comparison vs current v4 score IC computed from `propertyiq_backtest_outcomes` (`score_value` vs `excess_vs_state_3y`) on overlapping vintages.

Reuses `scripts/analysis/v2/db.py` engine factory. Outputs land in `docs/superpowers/results/2026-06-12-monolithic-feature-discovery.md`.

## Ship criteria

- Worst-level median walk-forward IC ≥ **0.15**, and pooled IC comparable to current ≈ 0.23.
- ≥80% positive IC years at every level; permutation ≥3σ.
- If no combo passes at all 3 levels, report the best per-level results and the gap — do **not** silently relax to per-level formulas (that's a user decision).

## Out of scope

- Production engine changes, backfills, frontend copy (separate plan after results land).
- Per-geo-level formulas, fitted weights, 1Y-horizon variant (revisit only if monolithic fails gates).
- The 2026-05-24 V2 cascade plan stays paused; this analysis supersedes its P1 metro discovery for the immediate Redfin problem.
