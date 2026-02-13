# PropertyIQ Score Validation Report

**Generated:** 2026-02-13 14:06:07 UTC
**Data rows:** 288,768

---
## HOMEREADY Score Validation

- **Target:** excess_div_3y
- **Total observations:** 144,384
- **With target outcome:** 74,308

### 5.1 In-Sample Metrics

| Metric | Value |
|--------|-------|
| Sample size | 74,308 |
| Pearson r | 0.2993 |
| Spearman r | 0.2708 |

#### Quintile Analysis

| Quintile | Avg Score | Avg Excess Return | Count | Beat-Median Rate |
|:--------:|----------:|------------------:|------:|-----------------:|
| Q1 | 11.1 | -2.2812 | 14,890 | 32.2% |
| Q2 | 31.7 | -0.8296 | 14,864 | 43.8% |
| Q3 | 51.1 | -0.1298 | 14,839 | 52.6% |
| Q4 | 69.7 | 0.2063 | 14,908 | 57.9% |
| Q5 | 89.7 | 0.5535 | 14,807 | 63.2% |

#### Decile Spread

| Metric | Value |
|--------|------:|
| Top decile avg excess | 0.6066 |
| Bottom decile avg excess | -2.8804 |
| **Decile spread** | **3.4870** |

#### Information Coefficient (IC)

| Metric | Value |
|--------|------:|
| Mean IC | 0.2588 |
| Std IC | 0.0728 |
| IR (IC/std) | 3.5544 |
| Hit rate | 100.0% |
| Periods | 26 |

### 5.2 Out-of-Sample Metrics

> OOS results not available: oos_results_not_found

### 5.3 Time Stability

| Year | N | Mean IC | Quintile Spread | Decile Spread | Status |
|:----:|----:|--------:|----------------:|--------------:|:------:|
| 2020 | 967 | 0.0553 | 0.6664 | 1.0858 | PASS |
| 2021 | 33,952 | 0.2923 | 3.2146 | 3.9085 | PASS |
| 2022 | 36,356 | 0.2448 | 2.5742 | 3.2289 | PASS |
| 2023 | 3,033 | 0.2273 | 2.1708 | 2.2624 | PASS |
| 2024 | 0 | - | - | - | skipped |

> All years pass stability checks.

### 5.4 Calibration Check

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 5.0 | 20.3 | 15.3 | 7,461 |
| 2 | 15.0 | 32.7 | 17.7 | 7,429 |
| 3 | 25.0 | 40.2 | 15.2 | 7,466 |
| 4 | 35.0 | 46.1 | 11.1 | 7,398 |
| 5 | 45.0 | 50.7 | 5.7 | 7,404 |
| 6 | 55.0 | 54.3 | 0.7 | 7,435 |
| 7 | 65.0 | 55.9 | 9.1 | 7,482 |
| 8 | 75.0 | 56.7 | 18.3 | 7,426 |
| 9 | 85.0 | 60.5 | 24.4 | 7,409 |
| 10 | 95.0 | 60.7 | 34.3 | 7,398 |

**Mean Absolute Deviation from diagonal:** 15.19 pp
**Well-calibrated (< 15 pp):** No

---
## INVESTOREDGE Score Validation

- **Target:** excess_total_div_3y
- **Total observations:** 144,384
- **With target outcome:** 0

### 5.1 In-Sample Metrics
> Skipped: insufficient_data (n=0)

### 5.2 Out-of-Sample Metrics

> OOS results not available: oos_results_not_found

### 5.3 Time Stability

| Year | N | Mean IC | Quintile Spread | Decile Spread | Status |
|:----:|----:|--------:|----------------:|--------------:|:------:|
| 2020 | 0 | - | - | - | skipped |
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
| homeready | 0.2993 | 0.2708 | 3.4870 | 0.2588 | 3.5544 | 100.0% | 15.19 |
| investoredge | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
