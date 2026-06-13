# ZIP PIQ Score Backtest — Candidate B Formula, 2001–2023

**Date:** 2026-06-12
**Code:** `scripts/analysis/monolithic-discovery/score_backtest.py --level zip`
**Companions:** `2026-06-12-metro-score-backtest.md`, `2026-06-12-county-score-backtest.md`
**Artifacts:** `data/zip_score_history.parquet` (6,089,735 monthly scores), `data/zip_score_backtest.json`

## Setup

Identical construction to metro/county: Candidate B signal → percentile rank within month → re-center at zero-crossing → clamp 1–99; ≥2-of-4 features (momentum-only before 2016-07). **25,783 ZIPs, monthly vintages 2001-01 → 2023-02**, 4,980,978 score-months with observable 3Y outcomes. Zero-crossing percentile **50.3** (metro 49.7, county 49.3 — one constant ≈50 works at every level). Score distribution mean 49.9, quartiles 25/50/74.

## Results

### Predictive power (Spearman IC of score vs 3Y excess vs state)

| Window                                    | Median IC | Positive periods                                  |
| ----------------------------------------- | --------- | ------------------------------------------------- |
| **Full 22 years**                         | **0.185** | **100% of years AND 100% of months in every era** |
| 2001–2007 boom (momentum-only)            | 0.088     | 100% of months                                    |
| 2008–2015 bust + recovery (momentum-only) | 0.200     | 100% of months                                    |
| **2016–2023 (full formula)**              | **0.190** | 100% of months                                    |

Full-formula era 0.190 vs the replicated current-formula ZIP baseline of 0.083 — **2.3×**.

### Monotonic score bands (full period)

| Score band | Mean 3Y excess vs state (pp/yr) | N         |
| ---------- | ------------------------------- | --------- |
| 1–20       | **−0.73**                       | 996,230   |
| 21–40      | −0.25                           | 1,021,564 |
| 41–60      | +0.01                           | 1,016,092 |
| 61–80      | +0.31                           | 1,011,231 |
| 81–99      | **+0.88**                       | 935,861   |

Strictly monotonic in every era. Median monthly decile spread: **2.15pp annualized** — the widest of the three levels.

### Calibration: 50 = state average ✓ (essentially exact)

Scores 45–55 mean excess = **+0.006pp/yr** — the huge ZIP cross-section washes out the value-weighting skew seen at metro/county. The 41–60 band mean is +0.01pp. Score 50 means "performs like the state," literally.

## Verdict

**PASS — strongest level.** ZIP is where the current formula was weakest (replicated IC 0.083) and where this formula delivers its largest absolute and relative improvement, its widest spread (Q5−Q1 = 1.61pp/yr; deciles 2.15pp), perfect sign consistency over 22 years, and exact midpoint calibration.

## Three-level summary (full-formula era, 2016–2023)

| Level          | New score IC | Current v4 IC | Positive months | Decile spread | Calibration @50 |
| -------------- | ------------ | ------------- | --------------- | ------------- | --------------- |
| Metro (865)    | 0.264        | 0.220         | 95%             | 1.68pp        | −0.20pp         |
| County (3,061) | 0.203        | 0.143         | 96.5%           | 1.37pp        | −0.23pp         |
| ZIP (25,783)   | 0.190        | 0.083         | **100%**        | **2.15pp**    | **+0.01pp**     |

One formula, one construction, one ~50 zero-crossing constant — validated end-to-end at all three levels. The discovery + backtest phase is complete; remaining work is production wiring (engine metric swap, Zillow+Realtor fetcher, claims refresh, shadow month).
