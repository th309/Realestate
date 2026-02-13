# PropertyIQ Score Diagnostic Report - All Geographies
## Generated: 2026-02-12

---

## Executive Summary

**Metro HomeReady is the only well-functioning score.** All other geography/score-type combinations have critical issues that need to be addressed before the scores provide meaningful predictive value.

### Critical Findings

| Issue | Severity | Geography | Impact |
|-------|----------|-----------|--------|
| ZIP HomeReady = InvestorEdge (identical formulas) | **CRITICAL** | ZIP | 736K rows of useless InvestorEdge data |
| County missing calculated metrics | **HIGH** | County | `affordability_ratio`, `rent_price_ratio` null at scoring time |
| ZIP scoring skips census/economic data | **HIGH** | ZIP | No investor-relevant metrics available |
| Metro InvestorEdge weak/inverted signal | **MEDIUM** | Metro | IC improving over time but still weak |

---

## 1. Information Coefficient (IC) Analysis

### 3-Year Excess Return IC (Spearman Rank Correlation)

| Geography | Score Type | Mean IC | IC Std | IC IR | Hit Rate | Assessment |
|-----------|-----------|---------|--------|-------|----------|------------|
| **Metro** | HomeReady | **0.2036** | 0.028 | 7.26 | 100% | STRONG |
| **Metro** | InvestorEdge | 0.0355 | 0.055 | 0.65 | 72% | WEAK |
| **County** | HomeReady | 0.0296 | 0.026 | 1.15 | 80.8% | WEAK |
| **County** | InvestorEdge | 0.0390 | 0.027 | 1.47 | 88.5% | WEAK |
| **ZIP** | HomeReady | 0.1197 | 0.024 | 5.00 | 100% | MODERATE |
| **ZIP** | InvestorEdge | 0.1197 | 0.024 | 5.00 | 100% | IDENTICAL TO HR |

**Target**: Mean IC > 0.10, IC IR > 0.5

### 1-Year Excess Return IC

| Geography | Score Type | Mean IC | IC Std | IC IR | Hit Rate | Assessment |
|-----------|-----------|---------|--------|-------|----------|------------|
| **Metro** | HomeReady | **0.2036** | 0.036 | 5.64 | 100% | STRONG |
| **Metro** | InvestorEdge | 0.0831 | 0.105 | 0.79 | 71.4% | WEAK |
| **County** | HomeReady | 0.0319 | 0.026 | 1.21 | 89.8% | WEAK |
| **County** | InvestorEdge | 0.0380 | 0.027 | 1.42 | 95.9% | WEAK |
| **ZIP** | HomeReady | 0.0925 | 0.041 | 2.26 | 100% | MODERATE |
| **ZIP** | InvestorEdge | 0.0925 | 0.041 | 2.26 | 100% | IDENTICAL TO HR |

---

## 2. Quintile Spread Analysis

### 3-Year Excess Return by Score Quintile

**Metro HomeReady** (MONOTONIC)
| Quintile | Avg Score | Avg Excess 3Y | Median Excess 3Y |
|----------|-----------|---------------|-------------------|
| Q1 (Low) | 17.2 | -0.468 | -0.293 |
| Q2 | 29.9 | -0.118 | -0.064 |
| Q3 | 38.1 | 0.002 | 0.039 |
| Q4 | 46.5 | 0.087 | 0.133 |
| Q5 (High) | 60.5 | **0.499** | 0.285 |
| **Spread** | | **0.97pp** | **0.58pp** |

**Metro InvestorEdge** (INVERTED - Q5 UNDERPERFORMS)
| Quintile | Avg Score | Avg Excess 3Y | Median Excess 3Y |
|----------|-----------|---------------|-------------------|
| Q1 (Low) | 19.5 | -0.009 | -0.012 |
| Q5 (High) | 77.2 | **-0.425** | -0.196 |
| **Spread** | | **-0.42pp INVERTED** | |

**County HomeReady** (FLAT)
| Quintile | Avg Score | Avg Excess 3Y | Median Excess 3Y |
|----------|-----------|---------------|-------------------|
| Q1 | 38.5 | -0.025 | -0.019 |
| Q5 | 77.2 | 0.049 | 0.035 |
| **Spread** | | **0.07pp** (too narrow) | |

**ZIP HomeReady** (WEAKLY MONOTONIC)
| Quintile | Avg Score | Avg Excess 3Y | Median Excess 3Y |
|----------|-----------|---------------|-------------------|
| Q1 | 3.6 | -0.752 | -0.022 |
| Q2 | 6.5 | -0.290 | -0.010 |
| Q3 | 8.9 | -0.096 | -0.001 |
| Q4 | 11.6 | -0.055 | 0.005 |
| Q5 | 17.6 | 0.050 | 0.013 |
| **Spread** | | **0.80pp** | **0.04pp** |

> **Note**: ZIP scores range 3-18 (out of 100) due to old min-max normalization compression.

### 1-Year Excess Return by Score Quintile

**Metro HomeReady 1Y** (MONOTONIC by median)
| Quintile | Median Excess 1Y |
|----------|-------------------|
| Q1 | -0.550 |
| Q2 | -0.254 |
| Q3 | -0.040 |
| Q4 | +0.193 |
| Q5 | **+0.647** |
| **Spread** | **1.20pp** |

**ZIP HomeReady 1Y** (MONOTONIC)
| Quintile | Median Excess 1Y |
|----------|-------------------|
| Q1 | -0.249 |
| Q2 | -0.092 |
| Q3 | 0.000 |
| Q4 | +0.062 |
| Q5 | **+0.099** |
| **Spread** | **0.35pp** |

---

## 3. Time Stability (IC by Year)

### 3-Year Excess IC by Year

| Year | Metro HR | Metro IE | County HR | County IE | ZIP HR | ZIP IE |
|------|----------|----------|-----------|-----------|--------|--------|
| 2020 | 0.1525 | -0.0409 | -0.0124 | -0.0009 | - | - |
| 2021 | 0.1792 | 0.0091 | 0.0240 | 0.0313 | 0.1108 | 0.1108 |
| 2022 | 0.1558 | 0.0756 | 0.0139 | 0.0185 | 0.0905 | 0.0905 |
| 2023 | - | - | -0.0037 | 0.0028 | 0.1198 | 0.1198 |

### 1-Year Excess IC by Year

| Year | Metro HR | Metro IE | County HR | County IE | ZIP HR | ZIP IE |
|------|----------|----------|-----------|-----------|--------|--------|
| 2020 | 0.1205 | -0.0049 | -0.0352 | -0.0225 | - | - |
| 2021 | 0.1619 | -0.0223 | 0.0256 | 0.0317 | 0.0566 | 0.0566 |
| 2022 | 0.1626 | 0.0497 | 0.0226 | 0.0267 | 0.0838 | 0.0838 |
| 2023 | 0.1805 | 0.0713 | 0.0094 | 0.0122 | 0.1199 | 0.1199 |
| 2024 | **0.2271** | **0.2064** | 0.0246 | 0.0248 | 0.0738 | 0.0738 |

**Key observations:**
- Metro HomeReady: Stable and strengthening over time (0.12 -> 0.23)
- Metro InvestorEdge: Dramatically improving (was negative, now 0.21 in 2024)
- County: Consistently weak across all years (~0.02)
- ZIP HomeReady: Moderate and stable (~0.06-0.12)
- ZIP InvestorEdge: Identical to HomeReady (confirms bug)

---

## 4. Root Cause Analysis

### Issue 1: ZIP HomeReady = InvestorEdge (CRITICAL)

**Location**: `formula-weights.ts` lines 105-127

Both ZIP score types use identical formulas:
```
hotness_score: 0.534, demand_score: 0.184, pending_ratio: 0.165,
active_listing_count_yy: 0.101, price_reduced_count_yy: 0.016
```

The comment on line 114 says: "Same as HomeReady for ZIP level" - this was an intentional placeholder, not an accidental bug.

**Root cause**: No investor-relevant metrics (rent, affordability) were available at ZIP scoring time because:
- `scoring.service.ts` line 885: `if (geography === 'metro' || geography === 'county')` skips census/economic data fetch for ZIP
- `fetchCalculatedMetrics()` (line 977) is defined but never called for any geography

**Data available but unused**:
- `census_zip`: 33,971 ZCTAs, has `median_gross_rent`, `homeownership_rate`, `median_home_value`, `median_household_income`, `population_yoy` (2011-2023)
- `zillow_zip` ZORI: 7,343 ZIPs with rent data (2015-2025)
- `realtor_zip`: Has `supply_score`, `price_reduced_share`, `median_days_on_market` (unused in formula)

### Issue 2: County Missing Calculated Metrics (HIGH)

**Location**: `scoring.service.ts` lines 884-888, 977-997

County formula expects `affordability_ratio` (weight 0.132 HR / 0.094 IE) and `rent_price_ratio` (weight 0.091 HR / **0.402 IE**), but `fetchCalculatedMetrics()` is never called.

When these metrics are null, the scoring engine treats them as 0, which:
- Removes 22% of HomeReady signal (affordability_ratio + rent_price_ratio weights)
- Removes **50% of InvestorEdge signal** (rent_price_ratio alone is 0.402)
- Explains why county HomeReady (IC=0.03) and InvestorEdge (IC=0.04) are nearly identical

### Issue 3: Metro InvestorEdge Signal (MEDIUM)

Metro InvestorEdge has improving IC (from -0.04 in 2020 to +0.21 in 2024) but 3Y backtest is dragged down by early poor performance. The inverted quintile spread on 3Y excess suggests the formula's direction weights may be wrong for the 2020-2022 regime (pandemic housing boom).

Specific concerns:
- `median_gross_rent` direction=-1: Penalizes high-rent markets, but high rents = high cash flow for investors
- `population_yoy` direction=-1: Counterintuitive
- The strong 2024 IC (0.2064) suggests the formula may work well going forward

### Issue 4: Score Compression at ZIP Level

ZIP scores range 3-18 (out of 100). This is because:
- Old min-max normalization was dominated by a few extreme outlier ZIPs
- The percentile rank normalization (already implemented) will fix this on re-score
- But backtest data still reflects old compressed scores

### Score Correlation Between HomeReady and InvestorEdge

| Geography | Correlation | Interpretation |
|-----------|-------------|----------------|
| Metro | 0.616 | Properly differentiated |
| County | 0.989 | Nearly identical (missing metrics) |
| ZIP | **1.000** | Perfectly identical (same formula) |

---

## 5. Data Availability for Formula Improvement

### ZIP Level - Available Metrics Not Currently Used

| Source | Metric | Coverage | Investor Relevance |
|--------|--------|----------|-------------------|
| census_zip | median_gross_rent | 432K rows, 34K ZIPs | HIGH - rent income |
| census_zip | homeownership_rate | 424K rows | HIGH - rental demand |
| census_zip | median_home_value | 432K rows | HIGH - affordability |
| census_zip | median_household_income | 432K rows | HIGH - affordability |
| census_zip | population_yoy | 393K rows | MEDIUM - growth |
| census_zip | rent_as_pct_of_income | 432K rows | HIGH - rent burden |
| zillow_zip | zori | 408K rows, 7.3K ZIPs | HIGH - but low coverage |
| realtor_zip | supply_score | Full coverage | MEDIUM |
| realtor_zip | price_reduced_share | Full coverage | MEDIUM |
| realtor_zip | median_days_on_market | Full coverage | MEDIUM |

**Computed metrics possible**:
- `affordability_ratio` = median_home_value / median_household_income
- `rent_price_ratio` = (median_gross_rent * 12) / median_home_value

---

## 6. Recommended Action Plan

### Fix 1: Enable census/economic data fetch for ZIP (scoring.service.ts)
- Extend the `if (geography === 'metro' || geography === 'county')` condition to include ZIP
- Add ZIP-specific census data fetch using `census_zip.zcta` join
- Call `fetchCalculatedMetrics()` for all geographies

### Fix 2: Create differentiated ZIP InvestorEdge formula (formula-weights.ts)
Using census_zip data, add investor-relevant metrics:
- `rent_price_ratio` (computed from census_zip median_gross_rent / median_home_value)
- `homeownership_rate` (lower = more rental demand)
- `affordability_ratio` (computed)
- Keep realtor metrics for market activity signal

### Fix 3: Fix county calculated metrics (scoring.service.ts)
- Call `fetchCalculatedMetrics()` after census/economic data fetch
- This will populate `affordability_ratio` and `rent_price_ratio` for county scoring
- Expected to significantly improve county InvestorEdge IC

### Fix 4: Re-score all geographies
- With fixes 1-3 applied + percentile rank normalization
- Re-run backtest to populate new outcomes
- Re-validate all IC and quintile metrics

### Fix 5: Weight optimization (Phase 3)
- After fixes 1-4, run optimization with empirical data
- Use walk-forward CV to find optimal weights per geo level
- Target: IC > 0.10, quintile spread > 1.5pp for all combinations

---

## 7. Row Counts

| Geography | Score Type | Total Rows | With 1Y Excess | With 3Y Excess |
|-----------|-----------|------------|----------------|----------------|
| Metro | HomeReady | 42,380 | 42,379 | 21,619 |
| Metro | InvestorEdge | 42,380 | 42,379 | 21,619 |
| County | HomeReady | 144,384 | 144,381 | 74,308 |
| County | InvestorEdge | 144,384 | 144,381 | 74,308 |
| ZIP | HomeReady | 368,351 | 368,346 | 194,385 |
| ZIP | InvestorEdge | 368,351 | 368,346 | 194,385 |
| **Total** | | **1,110,230** | | |

---

## 8. Walk-Forward Validation (Out-of-Sample)

The existing scores in `propertyiq_scores` were computed at each score_date using only data available at that time. This makes the backtest naturally walk-forward: scores computed at time T predict outcomes measured at T+1Y or T+3Y.

### Train/Test Split: Pre-2023 (Train) vs 2023+ (Test)

**1-Year Excess Return IC:**

| Geography | Score Type | Train IC | Train IR | Test IC | Test IR | Test Hit% | Degradation |
|-----------|-----------|----------|----------|---------|---------|-----------|-------------|
| **Metro** | HomeReady | 0.1965 | 5.06 | **0.2111** | 6.57 | 100% | **NONE (improved)** |
| **Metro** | InvestorEdge | 0.0114 | 0.21 | **0.1578** | 1.73 | 100% | **NONE (improved)** |
| **County** | HomeReady | 0.0382 | 1.17 | 0.0254 | 1.58 | 91.7% | Slight |
| **County** | InvestorEdge | 0.0467 | 1.43 | 0.0290 | 1.94 | 95.8% | Slight |
| **ZIP** | HomeReady | 0.0892 | 1.80 | **0.0957** | 2.89 | 100% | **NONE (improved)** |
| **ZIP** | InvestorEdge | 0.0892 | 1.80 | 0.0957 | 2.89 | 100% | Identical to HR |

**Key finding: No overfitting detected.** Metro HomeReady, Metro InvestorEdge, and ZIP HomeReady all show BETTER performance in the test period than the training period. This indicates genuine predictive signal.

### OOS Quintile Spread (Test Period 2023+ Only, 1Y Excess)

**Metro HomeReady OOS** (PERFECTLY MONOTONIC)
| Quintile | Avg Score | Median Excess 1Y |
|----------|-----------|-------------------|
| Q1 (Low) | 13.2 | **-0.693** |
| Q2 | 25.1 | -0.176 |
| Q3 | 34.0 | -0.057 |
| Q4 | 43.0 | +0.181 |
| Q5 (High) | 59.0 | **+0.532** |
| **OOS Spread** | | **1.22pp** |

**Metro InvestorEdge OOS** (DIRECTIONAL)
| Quintile | Avg Score | Median Excess 1Y |
|----------|-----------|-------------------|
| Q1 (Low) | 13.5 | -0.524 |
| Q5 (High) | 81.5 | +0.301 |
| **OOS Spread** | | **0.82pp** (improved vs full sample) |

**ZIP HomeReady OOS** (MONOTONIC)
| Quintile | Avg Score | Median Excess 1Y |
|----------|-----------|-------------------|
| Q1 (Low) | 5.1 | -0.375 |
| Q2 | 8.1 | -0.068 |
| Q3 | 10.5 | 0.000 |
| Q4 | 13.3 | +0.074 |
| Q5 (High) | 19.8 | +0.066 |
| **OOS Spread** | | **0.44pp** |

---

## 9. Geographic Cross-Validation (Metro Level)

Held out states AL-GA (10 states, ~173 metros) as test set. Trained on remaining ~692 metros.

| Score Type | Train IC | Train IR | Test IC | Test IR | Test Hit% |
|-----------|----------|----------|---------|---------|-----------|
| **HomeReady** | 0.1771 | 6.69 | **0.3094** | 2.29 | **100%** |
| **InvestorEdge** | 0.0673 | 0.95 | **0.1518** | 0.79 | 71.4% |

**Key finding: The formula generalizes extremely well geographically.** HomeReady IC on held-out states (0.31) is nearly double the training set IC (0.18). This confirms the signal is not an artifact of specific geographic patterns.

---

## 10. Fixes Applied (This Session)

### Fix 1: `fetchCalculatedMetrics()` now called for all geographies
- **File**: `scoring.service.ts`
- Previously defined but never called. Now called after census/economic data fetch.
- Fixed column name mapping: DB `rent_to_price_ratio` -> `LocationMetrics.rent_price_ratio`
- Handles end-of-month date alignment (tries exact match, falls back to end-of-previous-month)
- Computes `affordability_ratio` from `median_price / (median_gross_rent * 12)`

### Fix 2: ZIP census data now fetched via `fetchZipCensusData()`
- **File**: `scoring.service.ts`
- New method queries `census_zip` table (99.4% coverage vs realtor_zip)
- Provides `population_yoy`, `median_gross_rent`, `homeownership_rate` for ZIP scoring

### Fix 3: Differentiated ZIP InvestorEdge formula
- **File**: `formula-weights.ts`
- Old: Identical to HomeReady (same 5 metrics)
- New: 7 metrics with investor focus:
  - `rent_price_ratio` (0.300, direction=+1)
  - `hotness_score` (0.250, direction=+1)
  - `affordability_ratio` (0.150, direction=-1)
  - `homeownership_rate` (0.100, direction=-1)
  - `demand_score` (0.100, direction=+1)
  - `pending_ratio` (0.060, direction=+1)
  - `population_yoy` (0.040, direction=+1)

---

## 11. Remaining Work

1. **Re-score all geographies** with fixed formulas + percentile rank normalization
2. **Re-run backtest** to populate new outcomes with new scores
3. **Weight optimization** (Phase 3): Walk-forward CV to find optimal weights per geo level
4. **County formula needs investigation**: IC ~0.03 even in-sample suggests the formula may need more fundamental changes, not just adding missing metrics
5. **Metro InvestorEdge direction analysis**: Some metric directions may be wrong (median_gross_rent direction=-1 penalizes high-rent markets)
