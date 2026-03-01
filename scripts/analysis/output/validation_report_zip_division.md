# PropertyIQ Score Validation Report

**Generated:** 2026-03-01 13:38:43 UTC
**Data rows:** 770,286
**Benchmark:** Excess returns vs **Census Division** median

---
## HOMEREADY Score Validation

- **Target:** excess_div_3y
- **Total observations:** 371,683
- **With target outcome:** 196,852

### 5.1 In-Sample Metrics

| Metric | Value |
|--------|-------|
| Sample size | 196,852 |
| Pearson r | 0.1022 |
| Spearman r | 0.1837 |

#### Quintile Analysis

| Quintile | Avg Score | Avg Excess Return | Count | Beat-Median Rate |
|:--------:|----------:|------------------:|------:|-----------------:|
| Q1 | 11.8 | -1.2576 | 39,459 | 38.9% |
| Q2 | 31.6 | -0.4773 | 39,324 | 45.7% |
| Q3 | 51.0 | -0.2152 | 39,334 | 50.2% |
| Q4 | 70.4 | 0.1306 | 39,471 | 54.4% |
| Q5 | 90.0 | 0.4314 | 39,264 | 60.8% |

#### Decile Spread

| Metric | Value |
|--------|------:|
| Top decile avg excess | 0.5589 |
| Bottom decile avg excess | -1.5902 |
| **Decile spread** | **2.1490** |

#### Information Coefficient (IC)

| Metric | Value |
|--------|------:|
| Mean IC | 0.1674 |
| Std IC | 0.0520 |
| IR (IC/std) | 3.2203 |
| Hit rate | 100.0% |
| Periods | 9 |

### 5.2 Out-of-Sample Metrics

| Metric | Value |
|--------|------:|
| Avg OOS quintile spread | 1.1598 |
| Avg OOS IC | 0.1377 |
| OOS IC IR | 0.0000 |
| Avg OOS hit rate | 58.3% |
| IC degradation (IS -> OOS) | 0.1775 |
| Spread degradation | 0.4603 |
| # folds | 1 |

### 5.3 Time Stability

| Year | N | Mean IC | Quintile Spread | Decile Spread | Status |
|:----:|----:|--------:|----------------:|--------------:|:------:|
| 2021 | 75,180 | 0.1659 | 1.9621 | 2.4673 | PASS |
| 2022 | 97,437 | 0.1734 | 1.5673 | 2.0418 | PASS |
| 2023 | 24,235 | 0.1494 | 1.3150 | 1.5718 | PASS |
| 2024 | 0 | - | - | - | skipped |

> All years pass stability checks.

### 5.4 Calibration Check

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 5.0 | 32.9 | 27.9 | 19,709 |
| 2 | 15.0 | 40.0 | 24.9 | 19,750 |
| 3 | 25.0 | 43.7 | 18.7 | 19,781 |
| 4 | 35.0 | 47.3 | 12.3 | 19,543 |
| 5 | 45.0 | 49.3 | 4.3 | 19,659 |
| 6 | 55.0 | 51.0 | 4.0 | 19,675 |
| 7 | 65.0 | 53.4 | 11.6 | 19,717 |
| 8 | 75.0 | 54.8 | 20.2 | 19,754 |
| 9 | 85.0 | 56.8 | 28.2 | 19,730 |
| 10 | 95.0 | 61.2 | 33.8 | 19,534 |

**Mean Absolute Deviation from diagonal:** 18.60 pp
**Well-calibrated (< 15 pp):** No

---
## INVESTOREDGE Score Validation

- **Target:** excess_total_div_3y
- **Total observations:** 371,683
- **With target outcome:** 58,665

### 5.1 In-Sample Metrics

| Metric | Value |
|--------|-------|
| Sample size | 58,665 |
| Pearson r | 0.1139 |
| Spearman r | 0.1902 |

#### Quintile Analysis

| Quintile | Avg Score | Avg Excess Return | Count | Beat-Median Rate |
|:--------:|----------:|------------------:|------:|-----------------:|
| Q1 | 9.3 | -1.1258 | 11,770 | 35.7% |
| Q2 | 27.6 | 0.7382 | 11,706 | 48.1% |
| Q3 | 48.2 | 1.3070 | 11,752 | 51.7% |
| Q4 | 70.3 | 1.9851 | 11,747 | 55.9% |
| Q5 | 90.4 | 2.2224 | 11,690 | 58.5% |

#### Decile Spread

| Metric | Value |
|--------|------:|
| Top decile avg excess | 2.2838 |
| Bottom decile avg excess | -2.4159 |
| **Decile spread** | **4.6997** |

#### Information Coefficient (IC)

| Metric | Value |
|--------|------:|
| Mean IC | 0.2470 |
| Std IC | 0.1205 |
| IR (IC/std) | 2.0488 |
| Hit rate | 100.0% |
| Periods | 8 |

### 5.2 Out-of-Sample Metrics

| Metric | Value |
|--------|------:|
| Avg OOS quintile spread | 0.2470 |
| Avg OOS IC | 0.0168 |
| OOS IC IR | 0.0000 |
| Avg OOS hit rate | 49.6% |
| IC degradation (IS -> OOS) | 0.9320 |
| Spread degradation | 0.9474 |
| # folds | 1 |

### 5.3 Time Stability

| Year | N | Mean IC | Quintile Spread | Decile Spread | Status |
|:----:|----:|--------:|----------------:|--------------:|:------:|
| 2021 | 33,753 | 0.3004 | 3.5091 | 4.4341 | PASS |
| 2022 | 24,912 | 0.1935 | 3.3355 | 5.0979 | PASS |
| 2023 | 0 | - | - | - | skipped |
| 2024 | 0 | - | - | - | skipped |

> All years pass stability checks.

### 5.4 Calibration Check

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 5.0 | 23.0 | 18.0 | 5,885 |
| 2 | 15.0 | 42.1 | 27.1 | 5,885 |
| 3 | 25.0 | 46.6 | 21.6 | 5,848 |
| 4 | 35.0 | 49.6 | 14.6 | 5,858 |
| 5 | 45.0 | 51.5 | 6.5 | 5,875 |
| 6 | 55.0 | 51.8 | 3.2 | 5,877 |
| 7 | 65.0 | 54.8 | 10.2 | 5,867 |
| 8 | 75.0 | 55.9 | 19.1 | 5,880 |
| 9 | 85.0 | 57.5 | 27.5 | 5,824 |
| 10 | 95.0 | 57.6 | 37.4 | 5,866 |

**Mean Absolute Deviation from diagonal:** 18.53 pp
**Well-calibrated (< 15 pp):** No

---
## Overall Summary

| Score Type | Pearson r | Spearman r | Decile Spread | Mean IC | IC IR | Hit Rate | Calibration MAD |
|------------|----------:|-----------:|--------------:|--------:|------:|---------:|----------------:|
| homeready | 0.1022 | 0.1837 | 2.1490 | 0.1674 | 3.2203 | 100.0% | 18.60 |
| investoredge | 0.1139 | 0.1902 | 4.6997 | 0.2470 | 2.0488 | 100.0% | 18.53 |
