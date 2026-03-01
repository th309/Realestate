# PropertyIQ Score Validation Report

**Generated:** 2026-03-01 19:00:07 UTC
**Data rows:** 563,443
**Benchmark:** Excess returns vs **State** median

---
## HOMEREADY Score Validation

- **Target:** excess_state_3y
- **Total observations:** 188,461
- **With target outcome:** 76,316

### 5.1 In-Sample Metrics

| Metric | Value |
|--------|-------|
| Sample size | 76,316 |
| Pearson r | 0.1008 |
| Spearman r | 0.2134 |

#### Quintile Analysis

| Quintile | Avg Score | Avg Excess Return | Count | Beat-Median Rate |
|:--------:|----------:|------------------:|------:|-----------------:|
| Q1 | 10.3 | -1.2414 | 15,270 | 36.3% |
| Q2 | 30.8 | -0.5079 | 15,302 | 45.5% |
| Q3 | 50.6 | 0.0180 | 15,274 | 51.5% |
| Q4 | 69.5 | 0.1951 | 15,273 | 54.4% |
| Q5 | 89.8 | 0.4129 | 15,197 | 60.3% |

#### Decile Spread

| Metric | Value |
|--------|------:|
| Top decile avg excess | 0.4156 |
| Bottom decile avg excess | -1.5578 |
| **Decile spread** | **1.9734** |

#### Information Coefficient (IC)

| Metric | Value |
|--------|------:|
| Mean IC | 0.1990 |
| Std IC | 0.0721 |
| IR (IC/std) | 2.7593 |
| Hit rate | 92.3% |
| Periods | 26 |

### 5.2 Out-of-Sample Metrics

| Metric | Value |
|--------|------:|
| Avg OOS quintile spread | 1.4311 |
| Avg OOS IC | 0.1360 |
| OOS IC IR | 1.8893 |
| Avg OOS hit rate | 58.6% |
| IC degradation (IS -> OOS) | 0.3168 |
| Spread degradation | 0.2748 |
| # folds | 2 |

### 5.3 Time Stability

| Year | N | Mean IC | Quintile Spread | Decile Spread | Status |
|:----:|----:|--------:|----------------:|--------------:|:------:|
| 2020 | 967 | -0.0122 | 0.2083 | 0.5631 | FAIL |
| 2021 | 35,044 | 0.2246 | 1.8894 | 2.2726 | PASS |
| 2022 | 37,206 | 0.1962 | 1.4961 | 1.8805 | PASS |
| 2023 | 3,099 | 0.1368 | 1.3036 | 1.4760 | PASS |
| 2024 | 0 | - | - | - | skipped |
| 2025 | 0 | - | - | - | skipped |
| 2026 | 0 | - | - | - | skipped |

> **Warning:** Model fails in year(s): 2020

### 5.4 Calibration Check

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 5.0 | 24.2 | 19.2 | 7,678 |
| 2 | 15.0 | 38.3 | 23.3 | 7,592 |
| 3 | 25.0 | 43.1 | 18.1 | 7,669 |
| 4 | 35.0 | 47.5 | 12.5 | 7,633 |
| 5 | 45.0 | 50.6 | 5.6 | 7,608 |
| 6 | 55.0 | 52.9 | 2.1 | 7,666 |
| 7 | 65.0 | 53.7 | 11.3 | 7,626 |
| 8 | 75.0 | 55.0 | 20.1 | 7,647 |
| 9 | 85.0 | 57.9 | 27.1 | 7,589 |
| 10 | 95.0 | 59.9 | 35.1 | 7,608 |

**Mean Absolute Deviation from diagonal:** 17.45 pp
**Well-calibrated (< 15 pp):** No

### 5.4b Post-Isotonic Calibration

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 5.0 | 24.2 | 19.2 | 7,678 |
| 2 | 15.0 | 38.3 | 23.3 | 7,592 |
| 3 | 25.0 | 43.1 | 18.1 | 7,669 |
| 4 | 35.0 | 47.5 | 12.5 | 7,633 |
| 5 | 45.0 | 50.6 | 5.6 | 7,608 |
| 6 | 55.0 | 52.9 | 2.1 | 7,748 |
| 7 | 65.0 | 53.8 | 11.2 | 7,544 |
| 8 | 75.0 | 55.0 | 20.1 | 7,647 |
| 9 | 85.0 | 57.9 | 27.1 | 7,589 |
| 10 | 95.0 | 59.9 | 35.1 | 7,608 |

**Post-calibration MAD:** 17.45 pp (was 17.45 pp)
**Well-calibrated (< 15 pp):** No

---
## INVESTOREDGE Score Validation

- **Target:** excess_total_state_3y
- **Total observations:** 188,456
- **With target outcome:** 76,311

### 5.1 In-Sample Metrics

| Metric | Value |
|--------|-------|
| Sample size | 76,311 |
| Pearson r | 0.0000 |
| Spearman r | 0.2160 |

#### Quintile Analysis

| Quintile | Avg Score | Avg Excess Return | Count | Beat-Median Rate |
|:--------:|----------:|------------------:|------:|-----------------:|
| Q1 | 10.3 | -1.2277 | 15,272 | 36.7% |
| Q2 | 30.8 | -0.4610 | 15,261 | 45.1% |
| Q3 | 50.5 | -0.0897 | 15,305 | 50.7% |
| Q4 | 69.5 | 0.2138 | 15,280 | 54.7% |
| Q5 | 89.8 | 0.4455 | 15,193 | 60.8% |

#### Decile Spread

| Metric | Value |
|--------|------:|
| Top decile avg excess | 0.4813 |
| Bottom decile avg excess | -1.5092 |
| **Decile spread** | **1.9905** |

#### Information Coefficient (IC)

| Metric | Value |
|--------|------:|
| Mean IC | 0.2020 |
| Std IC | 0.0713 |
| IR (IC/std) | 2.8343 |
| Hit rate | 96.2% |
| Periods | 26 |

### 5.2 Out-of-Sample Metrics

| Metric | Value |
|--------|------:|
| Avg OOS quintile spread | 1.4976 |
| Avg OOS IC | 0.1319 |
| OOS IC IR | 2.2411 |
| Avg OOS hit rate | 57.9% |
| IC degradation (IS -> OOS) | 0.3473 |
| Spread degradation | 0.2476 |
| # folds | 2 |

### 5.3 Time Stability

| Year | N | Mean IC | Quintile Spread | Decile Spread | Status |
|:----:|----:|--------:|----------------:|--------------:|:------:|
| 2020 | 967 | -0.0012 | 0.2543 | 0.7803 | FAIL |
| 2021 | 35,039 | 0.2275 | 1.9686 | 2.3538 | PASS |
| 2022 | 37,206 | 0.1994 | 1.4693 | 1.6882 | PASS |
| 2023 | 3,099 | 0.1318 | 1.1276 | 1.4459 | PASS |
| 2024 | 0 | - | - | - | skipped |
| 2025 | 0 | - | - | - | skipped |
| 2026 | 0 | - | - | - | skipped |

> **Warning:** Model fails in year(s): 2020

### 5.4 Calibration Check

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 5.0 | 25.7 | 20.7 | 7,677 |
| 2 | 15.0 | 38.2 | 23.2 | 7,595 |
| 3 | 25.0 | 43.3 | 18.3 | 7,670 |
| 4 | 35.0 | 47.0 | 12.0 | 7,591 |
| 5 | 45.0 | 50.4 | 5.4 | 7,627 |
| 6 | 55.0 | 51.6 | 3.4 | 7,678 |
| 7 | 65.0 | 53.5 | 11.5 | 7,654 |
| 8 | 75.0 | 56.0 | 19.0 | 7,626 |
| 9 | 85.0 | 57.2 | 27.8 | 7,588 |
| 10 | 95.0 | 61.8 | 33.2 | 7,605 |

**Mean Absolute Deviation from diagonal:** 17.46 pp
**Well-calibrated (< 15 pp):** No

### 5.4b Post-Isotonic Calibration

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 5.0 | 25.7 | 20.7 | 7,677 |
| 2 | 15.0 | 38.2 | 23.2 | 7,595 |
| 3 | 25.0 | 43.3 | 18.3 | 7,670 |
| 4 | 35.0 | 47.0 | 12.0 | 7,591 |
| 5 | 45.0 | 50.4 | 5.4 | 7,627 |
| 6 | 55.0 | 51.6 | 3.4 | 7,678 |
| 7 | 65.0 | 53.3 | 11.7 | 8,190 |
| 8 | 75.0 | 56.3 | 18.7 | 7,090 |
| 9 | 85.0 | 57.2 | 27.8 | 7,588 |
| 10 | 95.0 | 61.8 | 33.2 | 7,605 |

**Post-calibration MAD:** 17.44 pp (was 17.46 pp)
**Well-calibrated (< 15 pp):** No

---
## Overall Summary

| Score Type | Pearson r | Spearman r | Decile Spread | Mean IC | IC IR | Hit Rate | Calibration MAD |
|------------|----------:|-----------:|--------------:|--------:|------:|---------:|----------------:|
| homeready | 0.1008 | 0.2134 | 1.9734 | 0.1990 | 2.7593 | 92.3% | 17.45 |
| investoredge | 0.0000 | 0.2160 | 1.9905 | 0.2020 | 2.8343 | 96.2% | 17.46 |
