# Metro PIQ Score Backtest — Candidate B Formula, 2001–2023

**Date:** 2026-06-12
**Code:** `scripts/analysis/monolithic-discovery/score_backtest.py --level metro`
**Inputs:** discovered formula from `2026-06-12-monolithic-feature-discovery.md`
**Artifacts:** `data/metro_score_history.parquet` (213,206 monthly scores), `data/metro_score_backtest.json`

## What was tested

Full production-style score construction — not just raw signal rank:

```
signal = z(zhvi_yoy) + z(zhvi_mom_3m) − z(median_days_on_market) − z(price_reduced_share)
→ percentile rank within month → re-center at zero-crossing percentile → clamp 1–99
```

- **865 metros**, monthly, **2001-01 → 2023-01** (22 years of scoreable vintages with observable 3Y outcomes).
- ≥2-of-4 features required (mirrors the engine's 2-of-3 rule). Realtor features begin 2016-07, so **2001–2016 scores are momentum-only** — these would carry C confidence in production.
- **Zero-crossing percentile = 49.7** (v4's was 55.6): the new signal is nearly symmetric, so score 50 ≈ the 50th percentile. Score distribution: mean 50.2, quartiles 26/50/75 — well spread, no clumping.
- Outcome: 3Y forward annualized ZHVI return minus the metro's state return.

## Results

### Predictive power (Spearman IC of score vs 3Y excess, median of yearly medians)

| Window                                    | Median IC | Positive periods                                       |
| ----------------------------------------- | --------- | ------------------------------------------------------ |
| **Full 22 years (2001–2023)**             | **0.155** | 95.7% of years (22 of 23; only 2007 negative at −0.02) |
| 2001–2007 boom (momentum-only)            | 0.056     | 83% of months                                          |
| 2008–2015 bust + recovery (momentum-only) | 0.207     | 98% of months                                          |
| **2016–2023 (full 4-feature formula)**    | **0.264** | 95% of months                                          |

The score transformation preserved the signal's power: full-formula era IC 0.264 vs the raw signal's 0.273.

### Score levels mean what they claim (monotonic quintiles, full period)

| Score band | Mean 3Y excess vs state (pp/yr) | N      |
| ---------- | ------------------------------- | ------ |
| 1–20       | **−1.09**                       | 35,838 |
| 21–40      | −0.50                           | 36,787 |
| 41–60      | −0.19                           | 36,985 |
| 61–80      | −0.08                           | 37,184 |
| 81–99      | **+0.28**                       | 34,614 |

Strictly monotonic over 22 years. Median monthly decile spread (top vs bottom): **1.68pp annualized**. In the full-formula era the band means are −1.29 / −0.46 / −0.13 / +0.08 / +0.38.

### Calibration: 50 = state average ✓

Mean excess for scores 45–55 = **−0.20pp/yr ≈ 0**. (Band means skew slightly negative overall because state ZHVI is value-weighted toward large metros, so the median metro slightly underperforms its state; the calibration near 50 is the relevant check and it passes.)

## Honest weak spot

**2001–2007, momentum-only, IC 0.056 and 2007 was the single negative year (−0.02).** Pure price momentum failed to anticipate the 2007 inflection — the exact regime where the Realtor demand features (DOM rising, price cuts spiking) would have helped, and they didn't exist yet. Two mitigations: (a) production always has all 4 features going forward; (b) the full-formula era includes the 2019 soft patch and the 2021–22 reversal and stayed positive through both.

## Verdict

**PASS.** The Candidate B score, constructed exactly like the production engine, is indicative of 3Y excess performance vs state at metro level: IC 0.264 in the era where all features exist (vs 0.220 for the replicated current formula), monotonic score bands across 22 years, 50 calibrated to state-average, and graceful degradation in the momentum-only backfill era.

Suggested production claims source (when wired): full-formula era only — IC 0.26, decile spread ~1.7pp/yr, quintile table above.

## Next

- Same backtest at county and ZIP (formula already validated at signal level there; score-construction check pending).
- Decide whether to publish pre-2016 momentum-only history (C confidence) or start score history at 2016-07.
- Wire into `propertyiq-scoring-engine.ts` + new fetcher; re-derive `validation-claims.ts` from `metro_score_backtest.json`.
