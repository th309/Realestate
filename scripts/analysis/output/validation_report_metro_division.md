# PropertyIQ Score Validation Report

**Generated:** 2026-03-01 13:37:54 UTC
**Data rows:** 169,990
**Benchmark:** Excess returns vs **Census Division** median

---
## HOMEREADY Score Validation

- **Target:** excess_div_3y
- **Total observations:** 57,240
- **With target outcome:** 23,859

### 5.1 In-Sample Metrics

| Metric | Value |
|--------|-------|
| Sample size | 23,859 |
| Pearson r | 0.2322 |
| Spearman r | 0.2694 |

#### Quintile Analysis

| Quintile | Avg Score | Avg Excess Return | Count | Beat-Median Rate |
|:--------:|----------:|------------------:|------:|-----------------:|
| Q1 | 10.0 | -1.6882 | 4,772 | 32.0% |
| Q2 | 30.0 | -0.3352 | 4,783 | 45.1% |
| Q3 | 49.9 | -0.1020 | 4,764 | 50.9% |
| Q4 | 69.9 | 0.2972 | 4,783 | 56.1% |
| Q5 | 89.9 | 0.7114 | 4,757 | 64.9% |

#### Decile Spread

| Metric | Value |
|--------|------:|
| Top decile avg excess | 0.7577 |
| Bottom decile avg excess | -2.2449 |
| **Decile spread** | **3.0026** |

#### Information Coefficient (IC)

| Metric | Value |
|--------|------:|
| Mean IC | 0.2690 |
| Std IC | 0.0677 |
| IR (IC/std) | 3.9706 |
| Hit rate | 100.0% |
| Periods | 26 |

### 5.2 Out-of-Sample Metrics

| Metric | Value |
|--------|------:|
| Avg OOS quintile spread | 1.4558 |
| Avg OOS IC | 0.1589 |
| OOS IC IR | 0.0000 |
| Avg OOS hit rate | 61.1% |
| IC degradation (IS -> OOS) | 0.4094 |
| Spread degradation | 0.5151 |
| # folds | 1 |

### 5.3 Time Stability

| Year | N | Mean IC | Quintile Spread | Decile Spread | Status |
|:----:|----:|--------:|----------------:|--------------:|:------:|
| 2020 | 865 | 0.3875 | 3.5167 | 5.1182 | PASS |
| 2021 | 11,007 | 0.2878 | 2.8470 | 3.5280 | PASS |
| 2022 | 11,065 | 0.2413 | 1.8828 | 2.3549 | PASS |
| 2023 | 922 | 0.2570 | 2.0960 | 2.8339 | PASS |
| 2024 | 0 | - | - | - | skipped |
| 2025 | 0 | - | - | - | skipped |
| 2026 | 0 | - | - | - | skipped |

> All years pass stability checks.

### 5.4 Calibration Check

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 5.0 | 21.3 | 16.3 | 2,392 |
| 2 | 15.0 | 35.7 | 20.7 | 2,380 |
| 3 | 25.0 | 44.1 | 19.1 | 2,405 |
| 4 | 35.0 | 46.8 | 11.8 | 2,378 |
| 5 | 45.0 | 49.6 | 4.6 | 2,382 |
| 6 | 55.0 | 52.7 | 2.3 | 2,382 |
| 7 | 65.0 | 53.4 | 11.6 | 2,404 |
| 8 | 75.0 | 57.4 | 17.6 | 2,379 |
| 9 | 85.0 | 62.4 | 22.6 | 2,376 |
| 10 | 95.0 | 64.7 | 30.3 | 2,381 |

**Mean Absolute Deviation from diagonal:** 15.69 pp
**Well-calibrated (< 15 pp):** No

### 5.4b Post-Isotonic Calibration

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 5.0 | 21.3 | 16.3 | 2,392 |
| 2 | 15.0 | 35.7 | 20.7 | 2,380 |
| 3 | 25.0 | 44.1 | 19.1 | 2,405 |
| 4 | 35.0 | 46.8 | 11.8 | 2,378 |
| 5 | 45.0 | 49.6 | 4.6 | 2,382 |
| 6 | 55.0 | 52.7 | 2.3 | 2,382 |
| 7 | 65.0 | 53.4 | 11.6 | 2,404 |
| 8 | 75.0 | 57.4 | 17.6 | 2,379 |
| 9 | 85.0 | 62.4 | 22.6 | 2,376 |
| 10 | 95.0 | 64.7 | 30.3 | 2,381 |

**Post-calibration MAD:** 15.69 pp (was 15.69 pp)
**Well-calibrated (< 15 pp):** No

---
## INVESTOREDGE Score Validation

- **Target:** excess_total_div_3y
- **Total observations:** 57,240
- **With target outcome:** 22,508

### 5.1 In-Sample Metrics

| Metric | Value |
|--------|-------|
| Sample size | 22,508 |
| Pearson r | 0.1373 |
| Spearman r | 0.2028 |

#### Quintile Analysis

| Quintile | Avg Score | Avg Excess Return | Count | Beat-Median Rate |
|:--------:|----------:|------------------:|------:|-----------------:|
| Q1 | 10.6 | -1.2689 | 4,524 | 30.9% |
| Q2 | 31.1 | 1.1680 | 4,481 | 46.1% |
| Q3 | 51.0 | 1.6738 | 4,522 | 56.4% |
| Q4 | 70.6 | 1.5912 | 4,495 | 58.3% |
| Q5 | 90.1 | 1.4884 | 4,486 | 56.9% |

#### Decile Spread

| Metric | Value |
|--------|------:|
| Top decile avg excess | 1.0611 |
| Bottom decile avg excess | -2.3607 |
| **Decile spread** | **3.4218** |

#### Information Coefficient (IC)

| Metric | Value |
|--------|------:|
| Mean IC | 0.2017 |
| Std IC | 0.1117 |
| IR (IC/std) | 1.8060 |
| Hit rate | 100.0% |
| Periods | 26 |

### 5.2 Out-of-Sample Metrics

| Metric | Value |
|--------|------:|
| Avg OOS quintile spread | 4.6020 |
| Avg OOS IC | 0.2358 |
| OOS IC IR | 0.0000 |
| Avg OOS hit rate | 62.5% |
| IC degradation (IS -> OOS) | -0.1691 |
| Spread degradation | -0.3449 |
| # folds | 1 |

### 5.3 Time Stability

| Year | N | Mean IC | Quintile Spread | Decile Spread | Status |
|:----:|----:|--------:|----------------:|--------------:|:------:|
| 2020 | 859 | 0.3772 | 6.3510 | 7.7596 | PASS |
| 2021 | 10,094 | 0.2501 | 3.9915 | 4.2889 | PASS |
| 2022 | 10,636 | 0.1457 | 1.5048 | 2.3399 | PASS |
| 2023 | 919 | 0.1166 | 1.4475 | 3.1350 | PASS |
| 2024 | 0 | - | - | - | skipped |
| 2025 | 0 | - | - | - | skipped |
| 2026 | 0 | - | - | - | skipped |

> All years pass stability checks.

### 5.4 Calibration Check

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 5.0 | 24.1 | 19.1 | 2,260 |
| 2 | 15.0 | 34.4 | 19.4 | 2,264 |
| 3 | 25.0 | 41.4 | 16.4 | 2,251 |
| 4 | 35.0 | 49.6 | 14.6 | 2,230 |
| 5 | 45.0 | 55.0 | 10.0 | 2,265 |
| 6 | 55.0 | 57.3 | 2.3 | 2,257 |
| 7 | 65.0 | 55.4 | 9.6 | 2,252 |
| 8 | 75.0 | 59.2 | 15.8 | 2,243 |
| 9 | 85.0 | 59.8 | 25.2 | 2,241 |
| 10 | 95.0 | 52.2 | 42.8 | 2,245 |

**Mean Absolute Deviation from diagonal:** 17.52 pp
**Well-calibrated (< 15 pp):** No

### 5.4b Post-Isotonic Calibration

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 6.2 | 24.1 | 17.9 | 2,260 |
| 2 | 18.8 | 34.4 | 15.7 | 2,264 |
| 3 | 31.2 | 41.4 | 10.1 | 2,251 |
| 4 | 43.8 | 49.6 | 5.8 | 2,230 |
| 5 | 56.2 | 56.3 | 0.0 | 5,502 |
| 6 | 68.8 | 55.4 | 13.4 | 1,272 |
| 7 | 81.2 | 58.6 | 22.6 | 5,620 |
| 8 | 93.8 | 51.3 | 42.4 | 1,109 |

**Post-calibration MAD:** 15.99 pp (was 17.52 pp)
**Well-calibrated (< 15 pp):** No

---
## Overall Summary

| Score Type | Pearson r | Spearman r | Decile Spread | Mean IC | IC IR | Hit Rate | Calibration MAD |
|------------|----------:|-----------:|--------------:|--------:|------:|---------:|----------------:|
| homeready | 0.2322 | 0.2694 | 3.0026 | 0.2690 | 3.9706 | 100.0% | 15.69 |
| investoredge | 0.1373 | 0.2028 | 3.4218 | 0.2017 | 1.8060 | 100.0% | 17.52 |
