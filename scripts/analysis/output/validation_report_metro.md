# PropertyIQ Score Validation Report

**Generated:** 2026-02-13 14:05:30 UTC
**Data rows:** 84,760

---
## HOMEREADY Score Validation

- **Target:** excess_div_3y
- **Total observations:** 42,380
- **With target outcome:** 21,620

### 5.1 In-Sample Metrics

| Metric | Value |
|--------|-------|
| Sample size | 21,620 |
| Pearson r | 0.2024 |
| Spearman r | 0.2985 |

#### Quintile Analysis

| Quintile | Avg Score | Avg Excess Return | Count | Beat-Median Rate |
|:--------:|----------:|------------------:|------:|-----------------:|
| Q1 | 10.4 | -1.9197 | 4,341 | 29.6% |
| Q2 | 30.6 | -0.2933 | 4,321 | 45.4% |
| Q3 | 50.3 | 0.0170 | 4,329 | 51.4% |
| Q4 | 70.0 | 0.3877 | 4,307 | 57.5% |
| Q5 | 89.8 | 1.1535 | 4,322 | 65.2% |

#### Decile Spread

| Metric | Value |
|--------|------:|
| Top decile avg excess | 1.5626 |
| Bottom decile avg excess | -2.7876 |
| **Decile spread** | **4.3502** |

#### Information Coefficient (IC)

| Metric | Value |
|--------|------:|
| Mean IC | 0.2967 |
| Std IC | 0.0635 |
| IR (IC/std) | 4.6756 |
| Hit rate | 100.0% |
| Periods | 25 |

### 5.2 Out-of-Sample Metrics

> OOS results not available: oos_results_not_found

### 5.3 Time Stability

| Year | N | Mean IC | Quintile Spread | Decile Spread | Status |
|:----:|----:|--------:|----------------:|--------------:|:------:|
| 2020 | 865 | 0.3835 | 4.1021 | 5.1545 | PASS |
| 2021 | 10,376 | 0.3269 | 3.4367 | 4.5252 | PASS |
| 2022 | 10,379 | 0.2593 | 2.6348 | 4.0996 | PASS |
| 2023 | 0 | - | - | - | skipped |
| 2024 | 0 | - | - | - | skipped |

> All years pass stability checks.

### 5.4 Calibration Check

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 5.0 | 18.1 | 13.1 | 2,180 |
| 2 | 15.0 | 36.7 | 21.7 | 2,161 |
| 3 | 25.0 | 43.8 | 18.8 | 2,155 |
| 4 | 35.0 | 47.8 | 12.8 | 2,166 |
| 5 | 45.0 | 51.1 | 6.1 | 2,156 |
| 6 | 55.0 | 51.5 | 3.5 | 2,173 |
| 7 | 65.0 | 55.1 | 9.9 | 2,148 |
| 8 | 75.0 | 58.1 | 16.9 | 2,159 |
| 9 | 85.0 | 63.4 | 21.6 | 2,182 |
| 10 | 95.0 | 64.4 | 30.6 | 2,140 |

**Mean Absolute Deviation from diagonal:** 15.48 pp
**Well-calibrated (< 15 pp):** No

---
## INVESTOREDGE Score Validation

- **Target:** excess_total_div_3y
- **Total observations:** 42,380
- **With target outcome:** 8,933

### 5.1 In-Sample Metrics

| Metric | Value |
|--------|-------|
| Sample size | 8,933 |
| Pearson r | 0.0616 |
| Spearman r | 0.0144 |

#### Quintile Analysis

| Quintile | Avg Score | Avg Excess Return | Count | Beat-Median Rate |
|:--------:|----------:|------------------:|------:|-----------------:|
| Q1 | 37.7 | -0.3183 | 1,791 | 46.1% |
| Q2 | 60.4 | -0.0549 | 1,788 | 50.0% |
| Q3 | 73.5 | 0.1854 | 1,797 | 51.3% |
| Q4 | 84.9 | 0.3622 | 1,782 | 52.6% |
| Q5 | 95.1 | -0.1247 | 1,775 | 46.6% |

#### Decile Spread

| Metric | Value |
|--------|------:|
| Top decile avg excess | -0.0615 |
| Bottom decile avg excess | -0.6637 |
| **Decile spread** | **0.6022** |

#### Information Coefficient (IC)

| Metric | Value |
|--------|------:|
| Mean IC | 0.0176 |
| Std IC | 0.0659 |
| IR (IC/std) | 0.2663 |
| Hit rate | 64.0% |
| Periods | 25 |

### 5.2 Out-of-Sample Metrics

> OOS results not available: oos_results_not_found

### 5.3 Time Stability

| Year | N | Mean IC | Quintile Spread | Decile Spread | Status |
|:----:|----:|--------:|----------------:|--------------:|:------:|
| 2020 | 304 | 0.0982 | 1.0052 | 0.9410 | PASS |
| 2021 | 3,885 | 0.0605 | 0.4451 | 0.7033 | PASS |
| 2022 | 4,744 | -0.0321 | -0.1463 | 0.5100 | FAIL |
| 2023 | 0 | - | - | - | skipped |
| 2024 | 0 | - | - | - | skipped |

> **Warning:** Model fails in year(s): 2022

### 5.4 Calibration Check

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 5.0 | 41.6 | 36.5 | 898 |
| 2 | 15.0 | 50.8 | 35.8 | 893 |
| 3 | 25.0 | 50.7 | 25.7 | 896 |
| 4 | 35.0 | 51.6 | 16.6 | 892 |
| 5 | 45.0 | 52.3 | 7.3 | 892 |
| 6 | 55.0 | 51.8 | 3.2 | 905 |
| 7 | 65.0 | 54.2 | 10.8 | 879 |
| 8 | 75.0 | 51.3 | 23.7 | 903 |
| 9 | 85.0 | 43.2 | 41.8 | 900 |
| 10 | 95.0 | 49.1 | 45.9 | 875 |

**Mean Absolute Deviation from diagonal:** 24.72 pp
**Well-calibrated (< 15 pp):** No

---
## Overall Summary

| Score Type | Pearson r | Spearman r | Decile Spread | Mean IC | IC IR | Hit Rate | Calibration MAD |
|------------|----------:|-----------:|--------------:|--------:|------:|---------:|----------------:|
| homeready | 0.2024 | 0.2985 | 4.3502 | 0.2967 | 4.6756 | 100.0% | 15.48 |
| investoredge | 0.0616 | 0.0144 | 0.6022 | 0.0176 | 0.2663 | 64.0% | 24.72 |
