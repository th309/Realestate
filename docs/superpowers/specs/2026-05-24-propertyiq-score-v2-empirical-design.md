# PropertyIQ Score V2 — Empirical From-Scratch Design

**Status:** DRAFT (design approved 2026-05-24, awaiting written review)
**Author:** Brainstorming session with troyhouston76@gmail.com
**Supersedes:** the locked-in plan from `tasks/scoring-state-relative-2026-05-23.md` (Phase B0/B0.5)

---

## 1. Problem statement

The current PropertyIQ Score uses a hardcoded three-feature signal:

```
signal = z(sold_above_list) − z(median_dom) − z(months_of_supply)
```

That formula was chosen by hand. It uses the **old Redfin tables** (which are being deprecated in favor of the new Redfin Data Center dashboards). The live engine ranks **nationally** despite docs claiming within-state, and the formula has never been re-validated against a strict statistical bar.

We start over. The new score is empirically derived: **identify the minimum set of features that, with 95% statistical confidence, predict which markets will outperform their state average over a 3-year horizon.**

## 2. What the score predicts

For each geo `g` at time `t`:

```
return_3y(g, t)        = ZHVI(g, t+36mo) / ZHVI(g, t) − 1
peer_return_3y(g, t)   = mean over peers in P(g) of return_3y(peer, t)
excess_3y(g, t)        = return_3y(g, t) − peer_return_3y(g, t)
```

Peer set `P(g)`:

- **metro / county / ZIP** → all geos of the same level within the same state (state-relative)
- **state** → all 50 states + DC (nationally-relative)

The **score** is the within-peer percentile of the model's predicted `excess_3y`, re-centered via isotonic-fit zero-crossing so that **50 = peer average**, clamped to 1–99.

> **Isotonic-fit zero-crossing:** fit an isotonic regression of predicted-percentile → realized excess return on training data; the percentile where the isotonic curve crosses zero realized excess is the zero-crossing point. The 1–99 score is constructed by two linear segments anchored at (1, zc, 99), so a market with percentile = zc receives score 50 — the data-derived "peer average" point — not the naive 50th percentile.

## 3. Scope: four independent models

| Model  | Peer set   | Score interpretation                                |
| ------ | ---------- | --------------------------------------------------- |
| Metro  | state      | 50 = state avg, 1 = worst metro in state, 99 = best |
| County | state      | same                                                |
| ZIP    | state      | same                                                |
| State  | nationwide | 50 = national avg state                             |

Each model is fit, validated, persisted, and shipped independently. They share **zero parameters**. A feature that's the #1 predictor for counties may not appear in the ZIP model.

## 4. Constraints (the bar)

### 4.1 Strict success bar (metro, county, ZIP)

A model ships only if **all four** of these bootstrap-95% lower-CI bounds clear the threshold:

| Metric                             | Bar                           | Interpretation                                                                |
| ---------------------------------- | ----------------------------- | ----------------------------------------------------------------------------- |
| OOS Spearman IC                    | ≥ 0.15                        | Score correlates with actual excess returns                                   |
| Hit-rate (score > 50 ⟺ excess > 0) | ≥ 60%                         | Beats coin-flip with margin                                                   |
| Top-vs-bottom decile spread        | ≥ 4pp                         | Score-90 markets actually outperform score-10 markets by ≥4 percentage points |
| Decile monotonicity frequency      | ≥ 95% of bootstrap iterations | The 10 score deciles produce monotonically-increasing realized excess returns |

"Better than chance" requirement: bootstrap-95% lower CI of IC > 0 AND hit-rate > 50%. Statistical significance, not just point estimate.

### 4.2 State-level relaxed bar

With n=50, the bootstrap is unstable. State model relaxes to:

| Metric                 | Bar                    |
| ---------------------- | ---------------------- |
| Point OOS IC           | ≥ 0.10                 |
| Leave-one-out hit-rate | ≥ 55%                  |
| Top-bottom spread      | ≥ 2pp                  |
| Decile monotonicity    | preferred not required |
| K (feature count)      | ≤ 6                    |

If state model fails, ship the geo levels without it and **defer** state ranking until more data or different methodology.

### 4.3 Minimum-features constraint

The model that ships is the one with the **smallest K** such that all bar conditions are met. If K=3 hits the bar, ship K=3. Forward-add stops the moment the bar is cleared.

## 5. Feature library (the candidate universe)

Computed from the live Supabase DB census, 2026-05-24.

### 5.1 Sources by geo level

| Source                                                            | Metro |   County   | ZIP | State |
| ----------------------------------------------------------------- | :---: | :--------: | :-: | :---: |
| Redfin DC housing_market                                          |   ✓   |     ✓      |  ✓  |   ✓   |
| Redfin DC price_drops                                             |   ✓   |     ✓      |  ✓  |   ✓   |
| Redfin DC contract_cancellations                                  |   ✓   |     ✓      |  ✓  |   ✓   |
| Redfin DC delistings_relistings                                   |   ✓   |     ✓      |  ✓  |   ✓   |
| Redfin DC investors                                               |   ✓   |     –      |  –  |   –   |
| Redfin DC cash_loan                                               |   ✓   |     –      |  –  |   –   |
| Redfin DC buyers_sellers                                          |   ✓   |     –      |  –  |   –   |
| Redfin DC rhpi                                                    |   ✓   |     –      |  –  |   –   |
| Redfin Migration                                                  |   ✓   |     –      |  –  |   –   |
| Realtor (hotness, supply, demand + activity)                      |   ✓   |     ✓      |  ✓  |   ✓   |
| Zillow (zhvi, zori, inventory, dom, etc.)                         |   ✓   |     ✓      |  ✓  |   ✓   |
| HUD Fair Market Rents                                             |   ✓   |     ✓      |  –  |   –   |
| Building Permits (Census BPS)                                     |   –   |     ✓      |  –  |   ✓   |
| Economic (BLS+BEA: unemployment, employment, GDP, RPP, QCEW, CES) |   ✓   | ✓ (no GDP) |  –  |   ✓   |
| Census ACS (demographics, economics, housing)                     |   ✓   |     ✓      |  ✓  |   ✓   |
| IRS county-to-county migration                                    |   –   |     ✓      |  –  |   –   |
| `calculated_metrics` derivatives (volatility, vs-history, gaps)   |   ✓   |     ✓      |  ✓  |   ✓   |

### 5.2 Explicit exclusions

| Source                                                                                                   | Reason                                                                         |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Old Redfin tables (`redfin_metro/county/zip/state/city/national`)                                        | User-specified: deprecated; including them forces another formula change later |
| Zillow ZHVF (forecast)                                                                                   | User-specified: score must be independent of Zillow's own prediction           |
| `calculated_metrics` legacy scores (`market_health_score`, `investment_score`, `long_term_growth_score`) | Outputs not inputs — circular signal                                           |
| `calculated_metrics` forward-looking columns (`zhvi_3y_change`, `zhvi_5y_change`)                        | Ambiguous direction — risk of leakage                                          |
| `zhvi_forward_returns` (helper table)                                                                    | Limited to 2020+; we compute returns from raw ZHVI for full history            |
| All operational/admin tables                                                                             | Not feature data                                                               |

### 5.3 Approximate raw candidate counts per geo level

- Metro: ~95 (richest tier; all sources)
- County: ~65 (gains permits + IRS migration + HUD FMR; loses investor/cash/buyer-seller/RHPI)
- ZIP: ~40 (no economic, no permits, no investor; gains rich Census)
- State: ~50 (no investor/cash/migration; gains permits)

## 6. Methodology

### 6.1 Target construction

```
zhvi(g, t)            = zillow_<L>.value WHERE metric_name='zhvi'
return_3y(g, t)       = zhvi(g, t+36mo) / zhvi(g, t) − 1
peer_return_3y(g, t)  = mean over peers in P(g)  [ return_3y(peer, t) ]
excess_3y(g, t)       = return_3y(g, t) − peer_return_3y(g, t)
```

Computed from raw ZHVI long tables (not `zhvi_forward_returns` — that table only covers 2020+; raw ZHVI goes back to 2000+ giving more backtest folds).

### 6.2 Feature engineering

For each raw feature `f` from §5:

- Raw value at t
- YoY transform (only where raw is a stock, not already a YoY)
- Trailing 12-month moving average (smooths Redfin noise; trailing only — centered would leak future data)
- For Census/annual sources: forward-filled to month, dropped if older than 18mo

Plus selective `calculated_metrics` ratios: rent-to-price, gross_yield, cap_rate, affordability_percentile, inventory_vs_history_pct, price_trend_deviation, zhvi_stddev_12m/36m.

### 6.3 ML-driven feature selection

The selection method is **Option B from the design discussion**: tree-as-selector, ridge-as-production.

```
1. LightGBM on the full raw library
   - 5-fold walk-forward cross-validation
   - Compute SHAP global feature importance ranking

2. Minimum-feature forward add (enforce the bar)
   selected = []
   ranked = features sorted by SHAP importance descending

   for f in ranked:
       selected.append(f)
       fit ridge on selected
       bootstrap 1000x (year-cluster resample) → CI on (IC, hit, spread, mono_freq)

       if ALL four lower-95% CI bounds clear the strict bar:
           STOP — K = len(selected)
           ship this model

       if len(selected) >= K_max:
           STOP — bar unreachable
           don't ship this geo level

   where K_max = 12 for metro/county/ZIP (strict-bar models)
         K_max =  6 for state (relaxed-bar model)

3. Production model = ridge regression on K selected features
   - Cross-validate alpha over [0.01, 0.1, 1.0, 10.0] on the inner walk-forward folds
   - Persist: feature_names, mean/stdev, ridge weights, ridge alpha, isotonic zero-crossing
   - Score = within-peer percentile of (ridge prediction), re-centered to 1-99
```

LightGBM discovers feature importance. Forward-add enforces minimum K. Ridge regression on top-K provides explainable production weights. Bootstrap-CI on year-clustered resamples gives statistical confidence.

> **Year-cluster bootstrap resampling:** rather than resampling individual (geo, period) rows with replacement (which preserves cross-sectional correlation across markets in the same period and inflates the effective sample size), we resample whole year-cohorts with replacement. Each bootstrap iteration draws K year-cohorts (with replacement) from the available training years, then refits ridge and computes OOS IC on the held-out year. This honors the true degrees of freedom (number of independent years), not the number of (geo, period) rows.

### 6.4 Validation battery (extends `scripts/analysis/county_backtest.py`)

After §6.3 has selected the K features that clear the §4 bootstrap-CI bar, we run a 9-test diagnostic battery. Tests 1-5 are gates: a model that passes §4 but fails any of tests 1-5 does not ship. Tests 6-9 are descriptive and surfaced in the validation report (signal decay and structural-break failures escalate to stakeholders before shipping but do not auto-block).

1. Decile monotonicity (mean excess return increases across deciles 1→10)
2. Year-by-year IC (≥80% positive years)
3. Walk-forward OOS validation (per-fold IC stats)
4. 5000-shuffle permutation significance test (≥3σ above null distribution)
5. Bootstrap 1000-resample CI (lower bounds clear strict bar)
6. Structural break test (IC stable across 2016/2020 splits)
7. Signal decay (linear regression of IC over time — no significant downward trend)
8. Worst-month drawdown (longest negative-IC streak ≤ 6 months)
9. Per-regime IC (pre-COVID / COVID / post-COVID / rate-hike all positive)

## 7. Data-revision policy

**V1 ships on revised data with disclosed bias.** Today's Redfin DC tables contain post-revision values; we cannot reconstruct the true point-in-time snapshots historically.

Mitigation:

- Validation report explicitly discloses look-ahead bias from Redfin revisions
- **Vintaging cron starts now** — monthly snapshots of all Redfin DC tables, stored in a single `redfin_dc_vintages` partitioned table keyed by `(dashboard, geo_level, snapshot_date, region_id, period_end)`. Partition by `snapshot_date` (monthly partitions). Storage budget: 8 dashboards × 4-5 geos × ~12k rows × 12 months ≈ 5M rows/year — well within cost envelope.
- V2 (~12 months out) re-validates on accumulated point-in-time vintages

## 8. Deliverables

1. **Per-geo-level model artifacts** in new `scoring_model_artifacts` table:
   ```
   geo_level | fit_date | formula_version | feature_names[] |
   feature_means[] | feature_stdevs[] | ridge_weights[] |
   zero_crossing | bootstrap_ic_5pct | bootstrap_hit_5pct |
   bootstrap_spread_5pct | bootstrap_mono_freq
   ```
2. **`recompute_scores.ts`** — reads active artifacts + latest source data → writes scores to `propertyiq_scores_v2` with the new `formula_version` (does NOT overwrite live in P5)
3. **Resolver refactor** in `packages/backend/src/scoring/` — load active artifact, no hardcoded formula
4. **Updated validation report** via the existing `piq-validation-report` skill: per-level feature list, bootstrap CIs, all 9 tests, decile tables
5. **Site-copy reconciliation**: `app/scores/page.tsx`, `propertyiq-score-methodology.mdx`, `llms.txt`, glossary all updated to describe the empirical methodology
6. **Vintaging cron** for monthly Redfin DC snapshots (parallel deliverable for V2 enablement)

## 9. Persistence & versioning

- Artifacts are versioned by `fit_date`. Old artifacts stay in the DB for audit + rollback.
- `propertyiq_scores_v2` gains a `formula_version` column.
- **No bulk historical re-score** — V1 ship recomputes only current-period scores. Historical rows keep their `formula_version` and stay frozen (matches the existing memory rule about Redfin revisions diverging up to 97pt on backfill).

## 10. Rollout

| Phase         | Work                                                                                                                                                                 | Gate                                         |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| P0            | Extend `county_backtest.py` harness to metro + ZIP + state                                                                                                           | Existing county IC reproduced (sanity check) |
| P1            | LightGBM+SHAP discovery on metro; bar test                                                                                                                           | Metro passes bar OR documented failure       |
| P2            | Same for county                                                                                                                                                      | Same gate                                    |
| P3            | Same for ZIP                                                                                                                                                         | Same gate                                    |
| P4            | Same for state (relaxed bar)                                                                                                                                         | Honest pass/fail                             |
| P5            | Persist artifacts; refactor resolver; **compute candidate scores into `propertyiq_scores_v2` with new `formula_version` value alongside live scores (no overwrite)** | Build + scoring tests green                  |
| P6            | Build side-by-side live-vs-candidate comparison report; stakeholder review                                                                                           | Stakeholder sign-off                         |
| P7a           | Canary: feature flag flip for internal users only                                                                                                                    | No surprises ≥ 7 days                        |
| P7b           | Flip default. Live scores now run on new formula. Old `formula_version` preserved for audit/rollback.                                                                | Score Health admin card green for 30 days    |
| P8 (parallel) | Vintaging cron live; collect 12 months of point-in-time snapshots for V2                                                                                             | V2 work begins ~12 months later              |

## 11. Explicit non-goals

- Don't change the score range (1–99) or "50 = peer average" semantic
- Don't bulk-recompute history
- Don't change `propertyiq_scores_v2` schema except adding `formula_version`
- Don't resurrect legacy score types (homeready/investoredge/markethealth)
- Don't ship a state-level model that fails its bar — document the gap and ship without it

## 12. Risks and how we mitigate them

| Risk                                                                | Mitigation                                                                                                                                                                                                 |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bar is unreachable on revised Redfin data                           | Honest "we don't ship this level" outcome; vintaging cron unlocks V2                                                                                                                                       |
| Feature drift (a feature that worked in 2018 stops working in 2024) | Validation test #7 (signal decay) gates the ship; refit on schedule                                                                                                                                        |
| Few-folds overfitting via SHAP-then-ridge                           | Bootstrap-95% CI gate is the discipline; year-clustered resampling preserves cross-sectional structure                                                                                                     |
| Score discontinuity from old → new formula                          | P5/P6/P7a parallel-write + canary + comparison report; never a silent flip                                                                                                                                 |
| Within-state n is tiny for small states (e.g., RI has 5 counties)   | Forward selection runs on the full pooled dataset; the **percentile-rank** step is what's state-relative. Small states still get scored but the percentile is computed across whatever counties they have. |
| State model fails its relaxed bar                                   | Don't ship it; document the gap. Geo levels still ship.                                                                                                                                                    |
| Look-ahead bias from revised Redfin                                 | V1 disclosure + V2 vintaged re-validation                                                                                                                                                                  |

## 13. References

- Prior work this supersedes: `tasks/scoring-state-relative-2026-05-23.md` (B0/B0.5)
- Existing analysis scaffolding: `scripts/analysis/fresh_predictor_hunt.py`, `county_backtest.py`, `within_state_prototype.py`, `anchor_walkforward.py`
- New Redfin DC migrations: `supabase/migrations/20260523*_create_redfin_dc_*` and `20260524*`
- Memory notes consulted: `redfin-rescore-history-diverges`, `propertyiq-scores-view-vs-v2`, `cbsa-alignment`
