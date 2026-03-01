# PropertyIQ Score Validation Report

**Generated:** 2026-03-01 18:59:46 UTC
**Data rows:** 169,990
**Benchmark:** Excess returns vs **State** median

---
## HOMEREADY Score Validation

- **Target:** excess_state_3y
- **Total observations:** 57,240
- **With target outcome:** 23,859

### 5.1 In-Sample Metrics

| Metric | Value |
|--------|-------|
| Sample size | 23,859 |
| Pearson r | 0.1722 |
| Spearman r | 0.2124 |

#### Quintile Analysis

| Quintile | Avg Score | Avg Excess Return | Count | Beat-Median Rate |
|:--------:|----------:|------------------:|------:|-----------------:|
| Q1 | 10.0 | -1.1986 | 4,772 | 32.9% |
| Q2 | 30.0 | -0.0668 | 4,783 | 45.4% |
| Q3 | 49.9 | 0.1157 | 4,764 | 51.1% |
| Q4 | 69.9 | 0.3152 | 4,783 | 54.5% |
| Q5 | 89.9 | 0.4542 | 4,757 | 58.1% |

#### Decile Spread

| Metric | Value |
|--------|------:|
| Top decile avg excess | 0.4442 |
| Bottom decile avg excess | -1.6672 |
| **Decile spread** | **2.1114** |

#### Information Coefficient (IC)

| Metric | Value |
|--------|------:|
| Mean IC | 0.2123 |
| Std IC | 0.0386 |
| IR (IC/std) | 5.5029 |
| Hit rate | 100.0% |
| Periods | 26 |

### 5.2 Out-of-Sample Metrics

| Metric | Value |
|--------|------:|
| Avg OOS quintile spread | 1.5320 |
| Avg OOS IC | 0.1820 |
| OOS IC IR | 4.3441 |
| Avg OOS hit rate | 60.4% |
| IC degradation (IS -> OOS) | 0.1425 |
| Spread degradation | 0.2744 |
| # folds | 2 |

### 5.3 Time Stability

| Year | N | Mean IC | Quintile Spread | Decile Spread | Status |
|:----:|----:|--------:|----------------:|--------------:|:------:|
| 2020 | 865 | 0.2755 | 2.0482 | 3.4531 | PASS |
| 2021 | 11,007 | 0.2271 | 1.9295 | 2.5059 | PASS |
| 2022 | 11,065 | 0.1944 | 1.3507 | 1.6384 | PASS |
| 2023 | 922 | 0.1872 | 1.5273 | 2.0891 | PASS |
| 2024 | 0 | - | - | - | skipped |
| 2025 | 0 | - | - | - | skipped |
| 2026 | 0 | - | - | - | skipped |

> All years pass stability checks.

### 5.4 Calibration Check

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 5.0 | 24.8 | 19.8 | 2,392 |
| 2 | 15.0 | 36.4 | 21.4 | 2,380 |
| 3 | 25.0 | 45.1 | 20.1 | 2,405 |
| 4 | 35.0 | 51.6 | 16.6 | 2,378 |
| 5 | 45.0 | 51.8 | 6.8 | 2,382 |
| 6 | 55.0 | 53.5 | 1.5 | 2,382 |
| 7 | 65.0 | 55.7 | 9.3 | 2,404 |
| 8 | 75.0 | 56.1 | 18.9 | 2,379 |
| 9 | 85.0 | 58.7 | 26.2 | 2,376 |
| 10 | 95.0 | 58.2 | 36.8 | 2,381 |

**Mean Absolute Deviation from diagonal:** 17.73 pp
**Well-calibrated (< 15 pp):** No

### 5.4b Post-Isotonic Calibration

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 5.0 | 24.8 | 19.8 | 2,392 |
| 2 | 15.0 | 36.4 | 21.4 | 2,380 |
| 3 | 25.0 | 45.1 | 20.1 | 2,405 |
| 4 | 35.0 | 51.6 | 16.6 | 2,378 |
| 5 | 45.0 | 51.8 | 6.8 | 2,382 |
| 6 | 55.0 | 53.5 | 1.5 | 2,382 |
| 7 | 65.0 | 55.7 | 9.3 | 2,404 |
| 8 | 75.0 | 56.1 | 18.9 | 2,379 |
| 9 | 85.0 | 58.7 | 26.2 | 2,376 |
| 10 | 95.0 | 58.2 | 36.8 | 2,381 |

**Post-calibration MAD:** 17.73 pp (was 17.73 pp)
**Well-calibrated (< 15 pp):** No

---
## INVESTOREDGE Score Validation

- **Target:** excess_total_state_3y
- **Total observations:** 57,240
- **With target outcome:** 23,859

### 5.1 In-Sample Metrics

| Metric | Value |
|--------|-------|
| Sample size | 23,859 |
| Pearson r | 0.0000 |
| Spearman r | 0.1763 |

#### Quintile Analysis

| Quintile | Avg Score | Avg Excess Return | Count | Beat-Median Rate |
|:--------:|----------:|------------------:|------:|-----------------:|
| Q1 | 10.0 | -1.0458 | 4,788 | 34.9% |
| Q2 | 30.0 | -0.1563 | 4,762 | 46.5% |
| Q3 | 50.0 | 0.2050 | 4,788 | 52.4% |
| Q4 | 70.0 | 0.2592 | 4,758 | 54.3% |
| Q5 | 90.0 | 0.3612 | 4,763 | 53.9% |

#### Decile Spread

| Metric | Value |
|--------|------:|
| Top decile avg excess | 0.3797 |
| Bottom decile avg excess | -1.3720 |
| **Decile spread** | **1.7518** |

#### Information Coefficient (IC)

| Metric | Value |
|--------|------:|
| Mean IC | 0.1763 |
| Std IC | 0.0327 |
| IR (IC/std) | 5.3878 |
| Hit rate | 100.0% |
| Periods | 26 |

### 5.2 Out-of-Sample Metrics

| Metric | Value |
|--------|------:|
| Avg OOS quintile spread | 1.3631 |
| Avg OOS IC | 0.1719 |
| OOS IC IR | 4.7316 |
| Avg OOS hit rate | 59.4% |
| IC degradation (IS -> OOS) | 0.0250 |
| Spread degradation | 0.2219 |
| # folds | 2 |

### 5.3 Time Stability

| Year | N | Mean IC | Quintile Spread | Decile Spread | Status |
|:----:|----:|--------:|----------------:|--------------:|:------:|
| 2020 | 865 | 0.2341 | 2.3443 | 3.4183 | PASS |
| 2021 | 11,008 | 0.1898 | 1.6618 | 1.9854 | PASS |
| 2022 | 11,064 | 0.1623 | 1.1181 | 1.4441 | PASS |
| 2023 | 922 | 0.1253 | 0.9297 | 1.0333 | PASS |
| 2024 | 0 | - | - | - | skipped |
| 2025 | 0 | - | - | - | skipped |
| 2026 | 0 | - | - | - | skipped |

> All years pass stability checks.

### 5.4 Calibration Check

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 5.0 | 28.3 | 23.3 | 2,390 |
| 2 | 15.0 | 37.1 | 22.1 | 2,398 |
| 3 | 25.0 | 45.7 | 20.7 | 2,381 |
| 4 | 35.0 | 51.6 | 16.6 | 2,381 |
| 5 | 45.0 | 53.3 | 8.3 | 2,403 |
| 6 | 55.0 | 53.7 | 1.3 | 2,385 |
| 7 | 65.0 | 54.2 | 10.8 | 2,381 |
| 8 | 75.0 | 56.6 | 18.4 | 2,377 |
| 9 | 85.0 | 55.6 | 29.4 | 2,394 |
| 10 | 95.0 | 54.8 | 40.2 | 2,369 |

**Mean Absolute Deviation from diagonal:** 19.11 pp
**Well-calibrated (< 15 pp):** No

### 5.4b Post-Isotonic Calibration

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 6.2 | 28.3 | 22.1 | 2,390 |
| 2 | 18.8 | 37.1 | 18.3 | 2,398 |
| 3 | 31.2 | 45.7 | 14.4 | 2,381 |
| 4 | 43.8 | 51.6 | 7.9 | 2,381 |
| 5 | 56.2 | 53.9 | 2.4 | 6,006 |
| 6 | 68.8 | 53.2 | 15.5 | 1,163 |
| 7 | 81.2 | 55.6 | 25.7 | 5,973 |
| 8 | 93.8 | 56.7 | 37.1 | 1,167 |

**Post-calibration MAD:** 17.91 pp (was 19.11 pp)
**Well-calibrated (< 15 pp):** No

---
## Overall Summary

| Score Type | Pearson r | Spearman r | Decile Spread | Mean IC | IC IR | Hit Rate | Calibration MAD |
|------------|----------:|-----------:|--------------:|--------:|------:|---------:|----------------:|
| homeready | 0.1722 | 0.2124 | 2.1114 | 0.2123 | 5.5029 | 100.0% | 17.73 |
| investoredge | 0.0000 | 0.1763 | 1.7518 | 0.1763 | 5.3878 | 100.0% | 19.11 |
