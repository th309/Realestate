# PropertyIQ Score Validation Report

**Generated:** 2026-03-01 18:59:47 UTC
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
| Avg OOS quintile spread | 1.5320 |
| Avg OOS IC | 0.1820 |
| OOS IC IR | 4.3441 |
| Avg OOS hit rate | 60.4% |
| IC degradation (IS -> OOS) | 0.3233 |
| Spread degradation | 0.4898 |
| # folds | 2 |

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
- **With target outcome:** 23,859

### 5.1 In-Sample Metrics

| Metric | Value |
|--------|-------|
| Sample size | 23,859 |
| Pearson r | 0.0000 |
| Spearman r | 0.2042 |

#### Quintile Analysis

| Quintile | Avg Score | Avg Excess Return | Count | Beat-Median Rate |
|:--------:|----------:|------------------:|------:|-----------------:|
| Q1 | 10.0 | -1.4999 | 4,788 | 34.5% |
| Q2 | 30.0 | -0.2903 | 4,762 | 48.0% |
| Q3 | 50.0 | 0.0811 | 4,788 | 52.9% |
| Q4 | 70.0 | 0.1535 | 4,758 | 54.2% |
| Q5 | 90.0 | 0.4456 | 4,763 | 59.4% |

#### Decile Spread

| Metric | Value |
|--------|------:|
| Top decile avg excess | 0.4181 |
| Bottom decile avg excess | -1.9483 |
| **Decile spread** | **2.3665** |

#### Information Coefficient (IC)

| Metric | Value |
|--------|------:|
| Mean IC | 0.2038 |
| Std IC | 0.0617 |
| IR (IC/std) | 3.3021 |
| Hit rate | 100.0% |
| Periods | 26 |

### 5.2 Out-of-Sample Metrics

| Metric | Value |
|--------|------:|
| Avg OOS quintile spread | 1.3631 |
| Avg OOS IC | 0.1719 |
| OOS IC IR | 4.7316 |
| Avg OOS hit rate | 59.4% |
| IC degradation (IS -> OOS) | 0.1566 |
| Spread degradation | 0.4240 |
| # folds | 2 |

### 5.3 Time Stability

| Year | N | Mean IC | Quintile Spread | Decile Spread | Status |
|:----:|----:|--------:|----------------:|--------------:|:------:|
| 2020 | 865 | 0.3287 | 3.6484 | 4.9317 | PASS |
| 2021 | 11,008 | 0.2303 | 2.4657 | 2.8473 | PASS |
| 2022 | 11,064 | 0.1713 | 1.3580 | 1.7790 | PASS |
| 2023 | 922 | 0.1511 | 1.1357 | 1.3740 | PASS |
| 2024 | 0 | - | - | - | skipped |
| 2025 | 0 | - | - | - | skipped |
| 2026 | 0 | - | - | - | skipped |

> All years pass stability checks.

### 5.4 Calibration Check

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 5.0 | 23.3 | 18.3 | 2,390 |
| 2 | 15.0 | 36.2 | 21.2 | 2,398 |
| 3 | 25.0 | 46.0 | 21.0 | 2,381 |
| 4 | 35.0 | 50.2 | 15.2 | 2,381 |
| 5 | 45.0 | 53.6 | 8.6 | 2,403 |
| 6 | 55.0 | 51.3 | 3.7 | 2,385 |
| 7 | 65.0 | 51.6 | 13.4 | 2,381 |
| 8 | 75.0 | 56.1 | 18.9 | 2,377 |
| 9 | 85.0 | 60.0 | 25.0 | 2,394 |
| 10 | 95.0 | 58.4 | 36.6 | 2,369 |

**Mean Absolute Deviation from diagonal:** 18.21 pp
**Well-calibrated (< 15 pp):** No

### 5.4b Post-Isotonic Calibration

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 6.2 | 23.3 | 17.1 | 2,390 |
| 2 | 18.8 | 36.2 | 17.5 | 2,398 |
| 3 | 31.2 | 46.0 | 14.7 | 2,381 |
| 4 | 43.8 | 50.2 | 6.5 | 2,381 |
| 5 | 56.2 | 52.7 | 3.6 | 6,006 |
| 6 | 68.8 | 50.2 | 18.5 | 1,163 |
| 7 | 81.2 | 57.5 | 23.8 | 5,973 |
| 8 | 93.8 | 63.1 | 30.6 | 1,167 |

**Post-calibration MAD:** 16.53 pp (was 18.21 pp)
**Well-calibrated (< 15 pp):** No

---
## Overall Summary

| Score Type | Pearson r | Spearman r | Decile Spread | Mean IC | IC IR | Hit Rate | Calibration MAD |
|------------|----------:|-----------:|--------------:|--------:|------:|---------:|----------------:|
| homeready | 0.2322 | 0.2694 | 3.0026 | 0.2690 | 3.9706 | 100.0% | 15.69 |
| investoredge | 0.0000 | 0.2042 | 2.3665 | 0.2038 | 3.3021 | 100.0% | 18.21 |
