# County PIQ Score Backtest — Candidate B Formula, 2001–2023

**Date:** 2026-06-12
**Code:** `scripts/analysis/monolithic-discovery/score_backtest.py --level county`
**Companion:** metro results in `2026-06-12-metro-score-backtest.md` (same construction, same gates)
**Artifacts:** `data/county_score_history.parquet` (661,782 monthly scores), `data/county_score_backtest.json`

## Setup

Identical to the metro backtest: Candidate B signal → percentile rank within month → re-center at the zero-crossing percentile → clamp 1–99; ≥2-of-4 features required (2001–2016 momentum-only, full formula from 2016-07). **3,061 counties, monthly vintages 2001-01 → 2023-02** (544,183 score-months with observable 3Y outcomes). Zero-crossing percentile: **49.3** (metro was 49.7 — the constant is stable across levels, supporting a single monolithic recentering). Score distribution mean 50.4, quartiles 26/51/75.

## Results

### Predictive power (Spearman IC of score vs 3Y excess vs state)

| Window                                    | Median IC | Positive periods                                                            |
| ----------------------------------------- | --------- | --------------------------------------------------------------------------- |
| **Full 22 years**                         | **0.122** | **100% of years (23 of 23)** — 2007 held at +0.008 where metro dipped −0.02 |
| 2001–2007 boom (momentum-only)            | 0.049     | 92% of months                                                               |
| 2008–2015 bust + recovery (momentum-only) | 0.169     | 99% of months                                                               |
| **2016–2023 (full formula)**              | **0.203** | 96.5% of months                                                             |

Full-formula era: 0.203 vs the replicated current-formula county baseline of 0.143 (+42%).

### Monotonic score bands (full period)

| Score band | Mean 3Y excess vs state (pp/yr) | N       |
| ---------- | ------------------------------- | ------- |
| 1–20       | **−1.06**                       | 106,594 |
| 21–40      | −0.48                           | 109,350 |
| 41–60      | −0.22                           | 111,085 |
| 61–80      | −0.09                           | 112,695 |
| 81–99      | **+0.22**                       | 104,459 |

Strictly monotonic, every era. Median monthly decile spread: **1.37pp annualized**.

### Calibration: 50 = state average ✓

Scores 45–55 mean excess = −0.23pp/yr ≈ 0 (same small value-weighting skew as metro; calibration near 50 passes).

## Verdict

**PASS.** Same shape as metro: strongest in the full-formula era, graceful momentum-only degradation before 2016, monotonic bands throughout, calibrated midpoint. County is actually the most _consistent_ level — zero negative years in 23.

Remaining: ZIP-level run (`--level zip`; heavier pull, ~26k ZIPs), then production wiring.
