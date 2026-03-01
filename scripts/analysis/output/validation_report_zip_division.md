# PropertyIQ Score Validation Report

**Generated:** 2026-03-01 19:00:37 UTC
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
| Avg OOS quintile spread | 1.2432 |
| Avg OOS IC | 0.1486 |
| OOS IC IR | 6.3740 |
| Avg OOS hit rate | 58.4% |
| IC degradation (IS -> OOS) | 0.1126 |
| Spread degradation | 0.4215 |
| # folds | 2 |

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
- **With target outcome:** 196,852

### 5.1 In-Sample Metrics

| Metric | Value |
|--------|-------|
| Sample size | 196,852 |
| Pearson r | 0.0000 |
| Spearman r | 0.1570 |

#### Quintile Analysis

| Quintile | Avg Score | Avg Excess Return | Count | Beat-Median Rate |
|:--------:|----------:|------------------:|------:|-----------------:|
| Q1 | 11.4 | -1.2588 | 39,469 | 39.6% |
| Q2 | 31.5 | -0.3733 | 39,281 | 47.3% |
| Q3 | 51.0 | -0.1356 | 39,373 | 51.0% |
| Q4 | 70.5 | 0.0952 | 39,513 | 53.7% |
| Q5 | 90.2 | 0.2846 | 39,216 | 58.4% |

#### Decile Spread

| Metric | Value |
|--------|------:|
| Top decile avg excess | 0.3961 |
| Bottom decile avg excess | -1.7869 |
| **Decile spread** | **2.1830** |

#### Information Coefficient (IC)

| Metric | Value |
|--------|------:|
| Mean IC | 0.1482 |
| Std IC | 0.0335 |
| IR (IC/std) | 4.4220 |
| Hit rate | 100.0% |
| Periods | 9 |

### 5.2 Out-of-Sample Metrics

| Metric | Value |
|--------|------:|
| Avg OOS quintile spread | 1.1967 |
| Avg OOS IC | 0.1426 |
| OOS IC IR | 10.8099 |
| Avg OOS hit rate | 57.0% |
| IC degradation (IS -> OOS) | 0.0379 |
| Spread degradation | 0.4518 |
| # folds | 2 |

### 5.3 Time Stability

| Year | N | Mean IC | Quintile Spread | Decile Spread | Status |
|:----:|----:|--------:|----------------:|--------------:|:------:|
| 2021 | 75,180 | 0.1477 | 1.8315 | 2.5577 | PASS |
| 2022 | 97,437 | 0.1459 | 1.3602 | 1.9628 | PASS |
| 2023 | 24,235 | 0.1600 | 1.4115 | 1.9155 | PASS |
| 2024 | 0 | - | - | - | skipped |

> All years pass stability checks.

### 5.4 Calibration Check

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 5.0 | 29.8 | 24.8 | 19,812 |
| 2 | 15.0 | 43.2 | 28.2 | 19,657 |
| 3 | 25.0 | 46.0 | 20.9 | 19,776 |
| 4 | 35.0 | 48.1 | 13.1 | 19,505 |
| 5 | 45.0 | 50.3 | 5.3 | 19,789 |
| 6 | 55.0 | 51.6 | 3.4 | 19,584 |
| 7 | 65.0 | 52.6 | 12.4 | 19,733 |
| 8 | 75.0 | 54.3 | 20.7 | 19,780 |
| 9 | 85.0 | 55.6 | 29.4 | 19,591 |
| 10 | 95.0 | 57.9 | 37.1 | 19,625 |

**Mean Absolute Deviation from diagonal:** 19.52 pp
**Well-calibrated (< 15 pp):** No

---
## Overall Summary

| Score Type | Pearson r | Spearman r | Decile Spread | Mean IC | IC IR | Hit Rate | Calibration MAD |
|------------|----------:|-----------:|--------------:|--------:|------:|---------:|----------------:|
| homeready | 0.1022 | 0.1837 | 2.1490 | 0.1674 | 3.2203 | 100.0% | 18.60 |
| investoredge | 0.0000 | 0.1570 | 2.1830 | 0.1482 | 4.4220 | 100.0% | 19.52 |
