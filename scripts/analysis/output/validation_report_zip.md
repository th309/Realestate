# PropertyIQ Score Validation Report

**Generated:** 2026-02-13 14:07:59 UTC
**Data rows:** 736,702

---
## HOMEREADY Score Validation

- **Target:** excess_div_3y
- **Total observations:** 368,351
- **With target outcome:** 194,385

### 5.1 In-Sample Metrics

| Metric | Value |
|--------|-------|
| Sample size | 194,385 |
| Pearson r | 0.2031 |
| Spearman r | 0.1904 |

#### Quintile Analysis

| Quintile | Avg Score | Avg Excess Return | Count | Beat-Median Rate |
|:--------:|----------:|------------------:|------:|-----------------:|
| Q1 | 11.9 | -1.3940 | 38,955 | 38.5% |
| Q2 | 31.8 | -0.5638 | 38,943 | 45.7% |
| Q3 | 51.2 | -0.2138 | 38,927 | 50.0% |
| Q4 | 70.5 | 0.0366 | 38,873 | 54.4% |
| Q5 | 90.1 | 0.4140 | 38,687 | 61.5% |

#### Decile Spread

| Metric | Value |
|--------|------:|
| Top decile avg excess | 0.5531 |
| Bottom decile avg excess | -1.7176 |
| **Decile spread** | **2.2707** |

#### Information Coefficient (IC)

| Metric | Value |
|--------|------:|
| Mean IC | 0.1731 |
| Std IC | 0.0592 |
| IR (IC/std) | 2.9244 |
| Hit rate | 100.0% |
| Periods | 9 |

### 5.2 Out-of-Sample Metrics

> OOS results not available: oos_results_not_found

### 5.3 Time Stability

| Year | N | Mean IC | Quintile Spread | Decile Spread | Status |
|:----:|----:|--------:|----------------:|--------------:|:------:|
| 2021 | 72,716 | 0.1716 | 2.1914 | 2.7159 | PASS |
| 2022 | 97,435 | 0.1782 | 1.6220 | 2.0927 | PASS |
| 2023 | 24,234 | 0.1591 | 1.3911 | 1.6615 | PASS |
| 2024 | 0 | - | - | - | skipped |

> All years pass stability checks.

### 5.4 Calibration Check

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 5.0 | 33.1 | 28.1 | 19,629 |
| 2 | 15.0 | 39.6 | 24.6 | 19,326 |
| 3 | 25.0 | 43.8 | 18.8 | 19,362 |
| 4 | 35.0 | 47.3 | 12.3 | 19,581 |
| 5 | 45.0 | 49.2 | 4.2 | 19,422 |
| 6 | 55.0 | 50.8 | 4.2 | 19,505 |
| 7 | 65.0 | 53.1 | 11.9 | 19,289 |
| 8 | 75.0 | 54.9 | 20.1 | 19,584 |
| 9 | 85.0 | 57.5 | 27.5 | 19,343 |
| 10 | 95.0 | 61.5 | 33.5 | 19,344 |

**Mean Absolute Deviation from diagonal:** 18.53 pp
**Well-calibrated (< 15 pp):** No

---
## INVESTOREDGE Score Validation

- **Target:** excess_total_div_3y
- **Total observations:** 368,351
- **With target outcome:** 0

### 5.1 In-Sample Metrics
> Skipped: insufficient_data (n=0)

### 5.2 Out-of-Sample Metrics

> OOS results not available: oos_results_not_found

### 5.3 Time Stability

| Year | N | Mean IC | Quintile Spread | Decile Spread | Status |
|:----:|----:|--------:|----------------:|--------------:|:------:|
| 2021 | 0 | - | - | - | skipped |
| 2022 | 0 | - | - | - | skipped |
| 2023 | 0 | - | - | - | skipped |
| 2024 | 0 | - | - | - | skipped |

> All years pass stability checks.

### 5.4 Calibration Check

> Skipped: insufficient_data

---
## Overall Summary

| Score Type | Pearson r | Spearman r | Decile Spread | Mean IC | IC IR | Hit Rate | Calibration MAD |
|------------|----------:|-----------:|--------------:|--------:|------:|---------:|----------------:|
| homeready | 0.2031 | 0.1904 | 2.2707 | 0.1731 | 2.9244 | 100.0% | 18.53 |
| investoredge | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
