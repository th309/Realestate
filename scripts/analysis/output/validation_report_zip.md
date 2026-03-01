# PropertyIQ Score Validation Report

**Generated:** 2026-03-01 16:11:24 UTC
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

> OOS results not available: oos_results_not_found

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
- **With target outcome:** 196,852

### 5.1 In-Sample Metrics

| Metric | Value |
|--------|-------|
| Sample size | 196,852 |
| Pearson r | 0.0000 |
| Spearman r | 0.1413 |

#### Quintile Analysis

| Quintile | Avg Score | Avg Excess Return | Count | Beat-Median Rate |
|:--------:|----------:|------------------:|------:|-----------------:|
| Q1 | 11.4 | -1.0707 | 39,469 | 40.1% |
| Q2 | 31.5 | -0.2324 | 39,281 | 48.2% |
| Q3 | 51.0 | -0.0452 | 39,373 | 51.2% |
| Q4 | 70.5 | 0.1391 | 39,513 | 53.7% |
| Q5 | 90.2 | 0.2154 | 39,216 | 56.5% |

#### Decile Spread

| Metric | Value |
|--------|------:|
| Top decile avg excess | 0.2823 |
| Bottom decile avg excess | -1.5916 |
| **Decile spread** | **1.8739** |

#### Information Coefficient (IC)

| Metric | Value |
|--------|------:|
| Mean IC | 0.1253 |
| Std IC | 0.0486 |
| IR (IC/std) | 2.5753 |
| Hit rate | 100.0% |
| Periods | 9 |

### 5.2 Out-of-Sample Metrics

> OOS results not available: oos_results_not_found

### 5.3 Time Stability

| Year | N | Mean IC | Quintile Spread | Decile Spread | Status |
|:----:|----:|--------:|----------------:|--------------:|:------:|
| 2021 | 75,180 | 0.1112 | 1.4625 | 2.1238 | PASS |
| 2022 | 97,437 | 0.1359 | 1.1859 | 1.7531 | PASS |
| 2023 | 24,235 | 0.1388 | 1.1604 | 1.6145 | PASS |
| 2024 | 0 | - | - | - | skipped |

> All years pass stability checks.

### 5.4 Calibration Check

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 5.0 | 28.6 | 23.6 | 19,812 |
| 2 | 15.0 | 43.6 | 28.6 | 19,657 |
| 3 | 25.0 | 47.0 | 22.1 | 19,776 |
| 4 | 35.0 | 49.2 | 14.2 | 19,505 |
| 5 | 45.0 | 50.5 | 5.5 | 19,789 |
| 6 | 55.0 | 52.1 | 2.9 | 19,584 |
| 7 | 65.0 | 53.1 | 11.9 | 19,733 |
| 8 | 75.0 | 53.7 | 21.3 | 19,780 |
| 9 | 85.0 | 54.8 | 30.2 | 19,591 |
| 10 | 95.0 | 55.7 | 39.3 | 19,625 |

**Mean Absolute Deviation from diagonal:** 19.96 pp
**Well-calibrated (< 15 pp):** No

---
## Overall Summary

| Score Type | Pearson r | Spearman r | Decile Spread | Mean IC | IC IR | Hit Rate | Calibration MAD |
|------------|----------:|-----------:|--------------:|--------:|------:|---------:|----------------:|
| homeready | 0.0851 | 0.1619 | 1.7780 | 0.1449 | 2.7198 | 100.0% | 19.30 |
| investoredge | 0.0000 | 0.1413 | 1.8739 | 0.1253 | 2.5753 | 100.0% | 19.96 |
