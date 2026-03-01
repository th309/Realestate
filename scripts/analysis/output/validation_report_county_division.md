# PropertyIQ Score Validation Report

**Generated:** 2026-03-01 19:00:08 UTC
**Data rows:** 563,443
**Benchmark:** Excess returns vs **Census Division** median

---
## HOMEREADY Score Validation

- **Target:** excess_div_3y
- **Total observations:** 188,461
- **With target outcome:** 76,316

### 5.1 In-Sample Metrics

| Metric | Value |
|--------|-------|
| Sample size | 76,316 |
| Pearson r | 0.1323 |
| Spearman r | 0.2438 |

#### Quintile Analysis

| Quintile | Avg Score | Avg Excess Return | Count | Beat-Median Rate |
|:--------:|----------:|------------------:|------:|-----------------:|
| Q1 | 10.3 | -1.7014 | 15,270 | 35.3% |
| Q2 | 30.8 | -0.8404 | 15,302 | 43.0% |
| Q3 | 50.6 | -0.1747 | 15,274 | 50.4% |
| Q4 | 69.5 | 0.1384 | 15,273 | 56.4% |
| Q5 | 89.8 | 0.5248 | 15,197 | 64.6% |

#### Decile Spread

| Metric | Value |
|--------|------:|
| Top decile avg excess | 0.5733 |
| Bottom decile avg excess | -2.1247 |
| **Decile spread** | **2.6980** |

#### Information Coefficient (IC)

| Metric | Value |
|--------|------:|
| Mean IC | 0.2327 |
| Std IC | 0.0651 |
| IR (IC/std) | 3.5762 |
| Hit rate | 100.0% |
| Periods | 26 |

### 5.2 Out-of-Sample Metrics

| Metric | Value |
|--------|------:|
| Avg OOS quintile spread | 1.4311 |
| Avg OOS IC | 0.1360 |
| OOS IC IR | 1.8893 |
| Avg OOS hit rate | 58.6% |
| IC degradation (IS -> OOS) | 0.4157 |
| Spread degradation | 0.4696 |
| # folds | 2 |

### 5.3 Time Stability

| Year | N | Mean IC | Quintile Spread | Decile Spread | Status |
|:----:|----:|--------:|----------------:|--------------:|:------:|
| 2020 | 967 | 0.0610 | 0.6802 | 1.0841 | PASS |
| 2021 | 35,044 | 0.2614 | 2.6116 | 3.1495 | PASS |
| 2022 | 37,206 | 0.2227 | 1.9355 | 2.4835 | PASS |
| 2023 | 3,099 | 0.1790 | 1.7919 | 1.9580 | PASS |
| 2024 | 0 | - | - | - | skipped |
| 2025 | 0 | - | - | - | skipped |
| 2026 | 0 | - | - | - | skipped |

> All years pass stability checks.

### 5.4 Calibration Check

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 5.0 | 23.4 | 18.4 | 7,678 |
| 2 | 15.0 | 35.9 | 20.9 | 7,592 |
| 3 | 25.0 | 40.7 | 15.7 | 7,669 |
| 4 | 35.0 | 44.3 | 9.3 | 7,633 |
| 5 | 45.0 | 48.3 | 3.3 | 7,608 |
| 6 | 55.0 | 52.4 | 2.6 | 7,666 |
| 7 | 65.0 | 54.1 | 10.9 | 7,626 |
| 8 | 75.0 | 56.4 | 18.6 | 7,647 |
| 9 | 85.0 | 60.0 | 25.0 | 7,589 |
| 10 | 95.0 | 62.4 | 32.6 | 7,608 |

**Mean Absolute Deviation from diagonal:** 15.73 pp
**Well-calibrated (< 15 pp):** No

### 5.4b Post-Isotonic Calibration

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 5.0 | 23.4 | 18.4 | 7,678 |
| 2 | 15.0 | 35.9 | 20.9 | 7,592 |
| 3 | 25.0 | 40.7 | 15.7 | 7,669 |
| 4 | 35.0 | 44.3 | 9.3 | 7,633 |
| 5 | 45.0 | 48.3 | 3.3 | 7,608 |
| 6 | 55.0 | 52.4 | 2.6 | 7,748 |
| 7 | 65.0 | 54.1 | 10.9 | 7,544 |
| 8 | 75.0 | 56.4 | 18.6 | 7,647 |
| 9 | 85.0 | 60.0 | 25.0 | 7,589 |
| 10 | 95.0 | 62.4 | 32.6 | 7,608 |

**Post-calibration MAD:** 15.73 pp (was 15.73 pp)
**Well-calibrated (< 15 pp):** No

---
## INVESTOREDGE Score Validation

- **Target:** excess_total_div_3y
- **Total observations:** 188,456
- **With target outcome:** 76,311

### 5.1 In-Sample Metrics

| Metric | Value |
|--------|-------|
| Sample size | 76,311 |
| Pearson r | 0.0000 |
| Spearman r | 0.2435 |

#### Quintile Analysis

| Quintile | Avg Score | Avg Excess Return | Count | Beat-Median Rate |
|:--------:|----------:|------------------:|------:|-----------------:|
| Q1 | 10.3 | -1.6744 | 15,272 | 35.6% |
| Q2 | 30.8 | -0.7555 | 15,261 | 43.3% |
| Q3 | 50.5 | -0.3149 | 15,305 | 49.2% |
| Q4 | 69.5 | 0.1463 | 15,280 | 56.4% |
| Q5 | 89.8 | 0.5493 | 15,193 | 65.1% |

#### Decile Spread

| Metric | Value |
|--------|------:|
| Top decile avg excess | 0.6332 |
| Bottom decile avg excess | -2.0525 |
| **Decile spread** | **2.6857** |

#### Information Coefficient (IC)

| Metric | Value |
|--------|------:|
| Mean IC | 0.2330 |
| Std IC | 0.0657 |
| IR (IC/std) | 3.5453 |
| Hit rate | 100.0% |
| Periods | 26 |

### 5.2 Out-of-Sample Metrics

| Metric | Value |
|--------|------:|
| Avg OOS quintile spread | 1.4976 |
| Avg OOS IC | 0.1319 |
| OOS IC IR | 2.2411 |
| Avg OOS hit rate | 57.9% |
| IC degradation (IS -> OOS) | 0.4341 |
| Spread degradation | 0.4424 |
| # folds | 2 |

### 5.3 Time Stability

| Year | N | Mean IC | Quintile Spread | Decile Spread | Status |
|:----:|----:|--------:|----------------:|--------------:|:------:|
| 2020 | 967 | 0.0719 | 0.7425 | 1.3569 | PASS |
| 2021 | 35,039 | 0.2638 | 2.6660 | 3.1966 | PASS |
| 2022 | 37,206 | 0.2209 | 1.8956 | 2.2662 | PASS |
| 2023 | 3,099 | 0.1691 | 1.5623 | 1.9739 | PASS |
| 2024 | 0 | - | - | - | skipped |
| 2025 | 0 | - | - | - | skipped |
| 2026 | 0 | - | - | - | skipped |

> All years pass stability checks.

### 5.4 Calibration Check

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 5.0 | 24.9 | 19.9 | 7,677 |
| 2 | 15.0 | 35.8 | 20.8 | 7,595 |
| 3 | 25.0 | 41.2 | 16.2 | 7,670 |
| 4 | 35.0 | 44.7 | 9.7 | 7,591 |
| 5 | 45.0 | 48.2 | 3.2 | 7,627 |
| 6 | 55.0 | 50.3 | 4.7 | 7,678 |
| 7 | 65.0 | 53.8 | 11.2 | 7,654 |
| 8 | 75.0 | 56.6 | 18.4 | 7,626 |
| 9 | 85.0 | 59.6 | 25.4 | 7,588 |
| 10 | 95.0 | 64.1 | 30.9 | 7,605 |

**Mean Absolute Deviation from diagonal:** 16.04 pp
**Well-calibrated (< 15 pp):** No

### 5.4b Post-Isotonic Calibration

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 5.0 | 24.9 | 19.9 | 7,677 |
| 2 | 15.0 | 35.8 | 20.8 | 7,595 |
| 3 | 25.0 | 41.2 | 16.2 | 7,670 |
| 4 | 35.0 | 44.7 | 9.7 | 7,591 |
| 5 | 45.0 | 48.2 | 3.2 | 7,627 |
| 6 | 55.0 | 50.3 | 4.7 | 7,678 |
| 7 | 65.0 | 53.8 | 11.2 | 8,190 |
| 8 | 75.0 | 56.9 | 18.1 | 7,090 |
| 9 | 85.0 | 59.6 | 25.4 | 7,588 |
| 10 | 95.0 | 64.1 | 30.9 | 7,605 |

**Post-calibration MAD:** 16.02 pp (was 16.04 pp)
**Well-calibrated (< 15 pp):** No

---
## Overall Summary

| Score Type | Pearson r | Spearman r | Decile Spread | Mean IC | IC IR | Hit Rate | Calibration MAD |
|------------|----------:|-----------:|--------------:|--------:|------:|---------:|----------------:|
| homeready | 0.1323 | 0.2438 | 2.6980 | 0.2327 | 3.5762 | 100.0% | 15.73 |
| investoredge | 0.0000 | 0.2435 | 2.6857 | 0.2330 | 3.5453 | 100.0% | 16.04 |
