# PropertyIQ Score Validation Report

**Generated:** 2026-02-28 14:25:35 UTC
**Data rows:** 169,990

---
## HOMEREADY Score Validation

- **Target:** excess_div_3y
- **Total observations:** 57,240
- **With target outcome:** 53,930

### 5.1 In-Sample Metrics

| Metric | Value |
|--------|-------|
| Sample size | 53,930 |
| Pearson r | 0.2298 |
| Spearman r | 0.2648 |

#### Quintile Analysis

| Quintile | Avg Score | Avg Excess Return | Count | Beat-Median Rate |
|:--------:|----------:|------------------:|------:|-----------------:|
| Q1 | 10.3 | -1.2759 | 10,805 | 34.3% |
| Q2 | 30.4 | -0.4507 | 10,775 | 44.5% |
| Q3 | 50.2 | -0.2010 | 10,801 | 49.6% |
| Q4 | 70.0 | 0.1230 | 10,802 | 54.3% |
| Q5 | 89.9 | 0.5297 | 10,747 | 66.4% |

#### Decile Spread

| Metric | Value |
|--------|------:|
| Top decile avg excess | 0.6411 |
| Bottom decile avg excess | -1.7151 |
| **Decile spread** | **2.3562** |

#### Information Coefficient (IC)

| Metric | Value |
|--------|------:|
| Mean IC | 0.2643 |
| Std IC | 0.0677 |
| IR (IC/std) | 3.9057 |
| Hit rate | 100.0% |
| Periods | 62 |

### 5.2 Out-of-Sample Metrics

| Metric | Value |
|--------|------:|
| Avg OOS quintile spread | 1.1890 |
| Avg OOS IC | 0.1513 |
| OOS IC IR | 9.4043 |
| Avg OOS hit rate | 61.0% |
| IC degradation (IS -> OOS) | 0.4277 |
| Spread degradation | 0.4954 |
| # folds | 4 |

### 5.3 Time Stability

| Year | N | Mean IC | Quintile Spread | Decile Spread | Status |
|:----:|----:|--------:|----------------:|--------------:|:------:|
| 2020 | 865 | 0.3835 | 4.1021 | 5.1545 | PASS |
| 2021 | 10,435 | 0.3395 | 3.2950 | 4.2546 | PASS |
| 2022 | 10,440 | 0.2889 | 2.3978 | 3.0892 | PASS |
| 2023 | 10,440 | 0.2737 | 1.7153 | 2.3675 | PASS |
| 2024 | 10,440 | 0.2383 | 1.1019 | 1.4727 | PASS |
| 2025 | 10,440 | 0.1840 | 0.4693 | 0.6174 | PASS |
| 2026 | 870 | 0.1102 | 0.0207 | 0.0672 | PASS |

> All years pass stability checks.

### 5.4 Calibration Check

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 5.0 | 26.2 | 21.2 | 5,432 |
| 2 | 15.0 | 38.8 | 23.8 | 5,373 |
| 3 | 25.0 | 42.3 | 17.3 | 5,393 |
| 4 | 35.0 | 46.8 | 11.8 | 5,382 |
| 5 | 45.0 | 48.1 | 3.0 | 5,391 |
| 6 | 55.0 | 52.0 | 3.0 | 5,410 |
| 7 | 65.0 | 52.0 | 13.0 | 5,425 |
| 8 | 75.0 | 55.4 | 19.6 | 5,377 |
| 9 | 85.0 | 61.7 | 23.3 | 5,401 |
| 10 | 95.0 | 66.4 | 28.6 | 5,346 |

**Mean Absolute Deviation from diagonal:** 16.46 pp
**Well-calibrated (< 15 pp):** No

---
## INVESTOREDGE Score Validation

- **Target:** excess_div_3y
- **Total observations:** 57,240
- **With target outcome:** 53,930

### 5.1 In-Sample Metrics

| Metric | Value |
|--------|-------|
| Sample size | 53,930 |
| Pearson r | 0.1770 |
| Spearman r | 0.2035 |

#### Quintile Analysis

| Quintile | Avg Score | Avg Excess Return | Count | Beat-Median Rate |
|:--------:|----------:|------------------:|------:|-----------------:|
| Q1 | 10.5 | -1.1628 | 10,817 | 36.2% |
| Q2 | 30.7 | -0.3235 | 10,756 | 46.6% |
| Q3 | 50.4 | -0.0779 | 10,797 | 51.8% |
| Q4 | 70.2 | 0.0071 | 10,814 | 51.7% |
| Q5 | 90.1 | 0.3006 | 10,746 | 62.7% |

#### Decile Spread

| Metric | Value |
|--------|------:|
| Top decile avg excess | 0.3390 |
| Bottom decile avg excess | -1.5820 |
| **Decile spread** | **1.9210** |

#### Information Coefficient (IC)

| Metric | Value |
|--------|------:|
| Mean IC | 0.2081 |
| Std IC | 0.0588 |
| IR (IC/std) | 3.5411 |
| Hit rate | 100.0% |
| Periods | 62 |

### 5.2 Out-of-Sample Metrics

| Metric | Value |
|--------|------:|
| Avg OOS quintile spread | 1.3357 |
| Avg OOS IC | 0.1850 |
| OOS IC IR | 6.1860 |
| Avg OOS hit rate | 63.2% |
| IC degradation (IS -> OOS) | 0.1108 |
| Spread degradation | 0.3047 |
| # folds | 4 |

### 5.3 Time Stability

| Year | N | Mean IC | Quintile Spread | Decile Spread | Status |
|:----:|----:|--------:|----------------:|--------------:|:------:|
| 2020 | 865 | 0.3237 | 3.5158 | 4.8822 | PASS |
| 2021 | 10,435 | 0.2744 | 2.8299 | 3.5260 | PASS |
| 2022 | 10,440 | 0.2076 | 1.7654 | 2.3092 | PASS |
| 2023 | 10,440 | 0.1548 | 1.1445 | 1.6365 | PASS |
| 2024 | 10,440 | 0.2292 | 1.1120 | 1.4961 | PASS |
| 2025 | 10,440 | 0.1745 | 0.4415 | 0.6142 | PASS |
| 2026 | 870 | 0.0937 | 0.0193 | 0.0670 | PASS |

> All years pass stability checks.

### 5.4 Calibration Check

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 5.0 | 28.5 | 23.5 | 5,436 |
| 2 | 15.0 | 40.6 | 25.6 | 5,381 |
| 3 | 25.0 | 45.0 | 20.0 | 5,392 |
| 4 | 35.0 | 47.9 | 12.9 | 5,364 |
| 5 | 45.0 | 52.0 | 7.0 | 5,418 |
| 6 | 55.0 | 51.2 | 3.8 | 5,379 |
| 7 | 65.0 | 50.2 | 14.8 | 5,431 |
| 8 | 75.0 | 53.9 | 21.1 | 5,383 |
| 9 | 85.0 | 59.6 | 25.4 | 5,397 |
| 10 | 95.0 | 62.3 | 32.7 | 5,349 |

**Mean Absolute Deviation from diagonal:** 18.68 pp
**Well-calibrated (< 15 pp):** No

---
## Overall Summary

| Score Type | Pearson r | Spearman r | Decile Spread | Mean IC | IC IR | Hit Rate | Calibration MAD |
|------------|----------:|-----------:|--------------:|--------:|------:|---------:|----------------:|
| homeready | 0.2298 | 0.2648 | 2.3562 | 0.2643 | 3.9057 | 100.0% | 16.46 |
| investoredge | 0.1770 | 0.2035 | 1.9210 | 0.2081 | 3.5411 | 100.0% | 18.68 |
