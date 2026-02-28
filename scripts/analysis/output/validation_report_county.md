# PropertyIQ Score Validation Report

**Generated:** 2026-02-28 14:25:49 UTC
**Data rows:** 563,443

---
## HOMEREADY Score Validation

- **Target:** excess_div_3y
- **Total observations:** 188,461
- **With target outcome:** 184,060

### 5.1 In-Sample Metrics

| Metric | Value |
|--------|-------|
| Sample size | 184,060 |
| Pearson r | 0.2227 |
| Spearman r | 0.2008 |

#### Quintile Analysis

| Quintile | Avg Score | Avg Excess Return | Count | Beat-Median Rate |
|:--------:|----------:|------------------:|------:|-----------------:|
| Q1 | 10.8 | -1.2887 | 36,816 | 39.3% |
| Q2 | 31.0 | -0.5819 | 36,939 | 45.1% |
| Q3 | 50.7 | -0.2155 | 36,827 | 49.4% |
| Q4 | 69.9 | 0.0483 | 36,729 | 54.0% |
| Q5 | 89.8 | 0.3791 | 36,749 | 61.9% |

#### Decile Spread

| Metric | Value |
|--------|------:|
| Top decile avg excess | 0.4571 |
| Bottom decile avg excess | -1.6067 |
| **Decile spread** | **2.0639** |

#### Information Coefficient (IC)

| Metric | Value |
|--------|------:|
| Mean IC | 0.1900 |
| Std IC | 0.0874 |
| IR (IC/std) | 2.1723 |
| Hit rate | 96.8% |
| Periods | 62 |

### 5.2 Out-of-Sample Metrics

| Metric | Value |
|--------|------:|
| Avg OOS quintile spread | 1.2480 |
| Avg OOS IC | 0.1372 |
| OOS IC IR | 2.4778 |
| Avg OOS hit rate | 55.3% |
| IC degradation (IS -> OOS) | 0.2778 |
| Spread degradation | 0.3953 |
| # folds | 4 |

### 5.3 Time Stability

| Year | N | Mean IC | Quintile Spread | Decile Spread | Status |
|:----:|----:|--------:|----------------:|--------------:|:------:|
| 2020 | 967 | 0.0553 | 0.6664 | 1.0858 | PASS |
| 2021 | 33,957 | 0.2926 | 3.2177 | 3.9136 | PASS |
| 2022 | 36,358 | 0.2418 | 2.4022 | 3.0893 | PASS |
| 2023 | 36,493 | 0.1926 | 1.6541 | 2.0536 | PASS |
| 2024 | 36,616 | 0.1539 | 0.9493 | 1.1372 | PASS |
| 2025 | 36,618 | 0.0985 | 0.4305 | 0.5172 | PASS |
| 2026 | 3,051 | -0.0313 | -0.0031 | 0.0090 | FAIL |

> **Warning:** Model fails in year(s): 2026

### 5.4 Calibration Check

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 5.0 | 30.9 | 25.9 | 18,428 |
| 2 | 15.0 | 40.0 | 25.0 | 18,388 |
| 3 | 25.0 | 43.1 | 18.1 | 18,557 |
| 4 | 35.0 | 45.8 | 10.8 | 18,382 |
| 5 | 45.0 | 47.9 | 2.9 | 18,320 |
| 6 | 55.0 | 50.8 | 4.2 | 18,507 |
| 7 | 65.0 | 52.4 | 12.6 | 18,376 |
| 8 | 75.0 | 54.7 | 20.3 | 18,353 |
| 9 | 85.0 | 57.8 | 27.2 | 18,430 |
| 10 | 95.0 | 61.6 | 33.4 | 18,319 |

**Mean Absolute Deviation from diagonal:** 18.05 pp
**Well-calibrated (< 15 pp):** No

---
## INVESTOREDGE Score Validation

- **Target:** excess_div_3y
- **Total observations:** 188,456
- **With target outcome:** 184,060

### 5.1 In-Sample Metrics

| Metric | Value |
|--------|-------|
| Sample size | 184,060 |
| Pearson r | 0.2194 |
| Spearman r | 0.2022 |

#### Quintile Analysis

| Quintile | Avg Score | Avg Excess Return | Count | Beat-Median Rate |
|:--------:|----------:|------------------:|------:|-----------------:|
| Q1 | 10.8 | -1.2440 | 36,902 | 39.4% |
| Q2 | 30.9 | -0.5887 | 36,815 | 44.9% |
| Q3 | 50.6 | -0.2623 | 36,859 | 48.9% |
| Q4 | 69.8 | 0.0448 | 36,815 | 54.1% |
| Q5 | 89.7 | 0.3935 | 36,669 | 62.3% |

#### Decile Spread

| Metric | Value |
|--------|------:|
| Top decile avg excess | 0.4978 |
| Bottom decile avg excess | -1.5290 |
| **Decile spread** | **2.0269** |

#### Information Coefficient (IC)

| Metric | Value |
|--------|------:|
| Mean IC | 0.1925 |
| Std IC | 0.0851 |
| IR (IC/std) | 2.2632 |
| Hit rate | 98.4% |
| Periods | 62 |

### 5.2 Out-of-Sample Metrics

| Metric | Value |
|--------|------:|
| Avg OOS quintile spread | 1.2482 |
| Avg OOS IC | 0.1372 |
| OOS IC IR | 2.4782 |
| Avg OOS hit rate | 55.3% |
| IC degradation (IS -> OOS) | 0.2872 |
| Spread degradation | 0.3842 |
| # folds | 4 |

### 5.3 Time Stability

| Year | N | Mean IC | Quintile Spread | Decile Spread | Status |
|:----:|----:|--------:|----------------:|--------------:|:------:|
| 2020 | 967 | 0.0663 | 0.7433 | 1.3449 | PASS |
| 2021 | 33,957 | 0.2946 | 3.2334 | 4.0081 | PASS |
| 2022 | 36,358 | 0.2419 | 2.3533 | 2.9840 | PASS |
| 2023 | 36,493 | 0.1873 | 1.5540 | 1.9569 | PASS |
| 2024 | 36,616 | 0.1626 | 0.9402 | 1.1143 | PASS |
| 2025 | 36,618 | 0.1039 | 0.4230 | 0.5159 | PASS |
| 2026 | 3,051 | -0.0145 | 0.0017 | 0.0137 | FAIL |

> **Warning:** Model fails in year(s): 2026

### 5.4 Calibration Check

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 5.0 | 32.0 | 27.0 | 18,507 |
| 2 | 15.0 | 40.1 | 25.1 | 18,395 |
| 3 | 25.0 | 43.0 | 18.0 | 18,397 |
| 4 | 35.0 | 45.5 | 10.5 | 18,418 |
| 5 | 45.0 | 48.0 | 3.0 | 18,316 |
| 6 | 55.0 | 49.9 | 5.1 | 18,543 |
| 7 | 65.0 | 52.6 | 12.4 | 18,304 |
| 8 | 75.0 | 54.9 | 20.1 | 18,511 |
| 9 | 85.0 | 57.9 | 27.1 | 18,415 |
| 10 | 95.0 | 62.6 | 32.5 | 18,254 |

**Mean Absolute Deviation from diagonal:** 18.09 pp
**Well-calibrated (< 15 pp):** No

---
## Overall Summary

| Score Type | Pearson r | Spearman r | Decile Spread | Mean IC | IC IR | Hit Rate | Calibration MAD |
|------------|----------:|-----------:|--------------:|--------:|------:|---------:|----------------:|
| homeready | 0.2227 | 0.2008 | 2.0639 | 0.1900 | 2.1723 | 96.8% | 18.05 |
| investoredge | 0.2194 | 0.2022 | 2.0269 | 0.1925 | 2.2632 | 98.4% | 18.09 |
