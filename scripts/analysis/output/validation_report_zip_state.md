# PropertyIQ Score Validation Report

**Generated:** 2026-03-01 13:38:44 UTC
**Data rows:** 770,286
**Benchmark:** Excess returns vs **State** median

---
## HOMEREADY Score Validation

- **Target:** excess_state_3y
- **Total observations:** 371,683
- **With target outcome:** 196,852

### 5.1 In-Sample Metrics

| Metric | Value |
|--------|-------|
| Sample size | 196,852 |
| Pearson r | 0.0851 |
| Spearman r | 0.1619 |

#### Quintile Analysis

| Quintile | Avg Score | Avg Excess Return | Count | Beat-Median Rate |
|:--------:|----------:|------------------:|------:|-----------------:|
| Q1 | 11.8 | -1.0494 | 39,459 | 39.7% |
| Q2 | 31.6 | -0.3234 | 39,324 | 46.7% |
| Q3 | 51.0 | -0.1061 | 39,334 | 50.8% |
| Q4 | 70.4 | 0.1608 | 39,471 | 54.1% |
| Q5 | 90.0 | 0.3241 | 39,264 | 58.5% |

#### Decile Spread

| Metric | Value |
|--------|------:|
| Top decile avg excess | 0.3764 |
| Bottom decile avg excess | -1.4016 |
| **Decile spread** | **1.7780** |

#### Information Coefficient (IC)

| Metric | Value |
|--------|------:|
| Mean IC | 0.1449 |
| Std IC | 0.0533 |
| IR (IC/std) | 2.7198 |
| Hit rate | 100.0% |
| Periods | 9 |

### 5.2 Out-of-Sample Metrics

| Metric | Value |
|--------|------:|
| Avg OOS quintile spread | 1.1598 |
| Avg OOS IC | 0.1377 |
| OOS IC IR | 0.0000 |
| Avg OOS hit rate | 58.3% |
| IC degradation (IS -> OOS) | 0.0498 |
| Spread degradation | 0.3477 |
| # folds | 1 |

### 5.3 Time Stability

| Year | N | Mean IC | Quintile Spread | Decile Spread | Status |
|:----:|----:|--------:|----------------:|--------------:|:------:|
| 2021 | 75,180 | 0.1345 | 1.5017 | 1.9152 | PASS |
| 2022 | 97,437 | 0.1605 | 1.3540 | 1.7969 | PASS |
| 2023 | 24,235 | 0.1238 | 1.0504 | 1.2468 | PASS |
| 2024 | 0 | - | - | - | skipped |

> All years pass stability checks.

### 5.4 Calibration Check

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 5.0 | 32.7 | 27.7 | 19,709 |
| 2 | 15.0 | 41.0 | 26.0 | 19,750 |
| 3 | 25.0 | 44.6 | 19.6 | 19,781 |
| 4 | 35.0 | 48.2 | 13.2 | 19,543 |
| 5 | 45.0 | 50.1 | 5.0 | 19,659 |
| 6 | 55.0 | 51.7 | 3.3 | 19,675 |
| 7 | 65.0 | 53.2 | 11.8 | 19,717 |
| 8 | 75.0 | 54.3 | 20.8 | 19,754 |
| 9 | 85.0 | 56.0 | 29.0 | 19,730 |
| 10 | 95.0 | 58.4 | 36.6 | 19,534 |

**Mean Absolute Deviation from diagonal:** 19.30 pp
**Well-calibrated (< 15 pp):** No

---
## INVESTOREDGE Score Validation

- **Target:** excess_total_state_3y
- **Total observations:** 371,683
- **With target outcome:** 58,665

### 5.1 In-Sample Metrics

| Metric | Value |
|--------|-------|
| Sample size | 58,665 |
| Pearson r | 0.0818 |
| Spearman r | 0.1481 |

#### Quintile Analysis

| Quintile | Avg Score | Avg Excess Return | Count | Beat-Median Rate |
|:--------:|----------:|------------------:|------:|-----------------:|
| Q1 | 9.3 | -0.6223 | 11,770 | 37.3% |
| Q2 | 27.6 | 1.0307 | 11,706 | 50.0% |
| Q3 | 48.2 | 1.3974 | 11,752 | 52.3% |
| Q4 | 70.3 | 1.8403 | 11,747 | 55.0% |
| Q5 | 90.4 | 1.7545 | 11,690 | 54.7% |

#### Decile Spread

| Metric | Value |
|--------|------:|
| Top decile avg excess | 1.6990 |
| Bottom decile avg excess | -1.8096 |
| **Decile spread** | **3.5086** |

#### Information Coefficient (IC)

| Metric | Value |
|--------|------:|
| Mean IC | 0.2033 |
| Std IC | 0.1084 |
| IR (IC/std) | 1.8751 |
| Hit rate | 100.0% |
| Periods | 8 |

### 5.2 Out-of-Sample Metrics

| Metric | Value |
|--------|------:|
| Avg OOS quintile spread | 0.2470 |
| Avg OOS IC | 0.0168 |
| OOS IC IR | 0.0000 |
| Avg OOS hit rate | 49.6% |
| IC degradation (IS -> OOS) | 0.9174 |
| Spread degradation | 0.9296 |
| # folds | 1 |

### 5.3 Time Stability

| Year | N | Mean IC | Quintile Spread | Decile Spread | Status |
|:----:|----:|--------:|----------------:|--------------:|:------:|
| 2021 | 33,753 | 0.2357 | 2.3197 | 3.0651 | PASS |
| 2022 | 24,912 | 0.1708 | 2.6509 | 4.1598 | PASS |
| 2023 | 0 | - | - | - | skipped |
| 2024 | 0 | - | - | - | skipped |

> All years pass stability checks.

### 5.4 Calibration Check

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 5.0 | 23.8 | 18.8 | 5,885 |
| 2 | 15.0 | 43.2 | 28.2 | 5,885 |
| 3 | 25.0 | 48.6 | 23.6 | 5,848 |
| 4 | 35.0 | 51.4 | 16.4 | 5,858 |
| 5 | 45.0 | 52.6 | 7.6 | 5,875 |
| 6 | 55.0 | 52.0 | 3.0 | 5,877 |
| 7 | 65.0 | 54.7 | 10.3 | 5,867 |
| 8 | 75.0 | 55.0 | 20.0 | 5,880 |
| 9 | 85.0 | 55.4 | 29.6 | 5,824 |
| 10 | 95.0 | 53.6 | 41.4 | 5,866 |

**Mean Absolute Deviation from diagonal:** 19.89 pp
**Well-calibrated (< 15 pp):** No

---
## Overall Summary

| Score Type | Pearson r | Spearman r | Decile Spread | Mean IC | IC IR | Hit Rate | Calibration MAD |
|------------|----------:|-----------:|--------------:|--------:|------:|---------:|----------------:|
| homeready | 0.0851 | 0.1619 | 1.7780 | 0.1449 | 2.7198 | 100.0% | 19.30 |
| investoredge | 0.0818 | 0.1481 | 3.5086 | 0.2033 | 1.8751 | 100.0% | 19.89 |
