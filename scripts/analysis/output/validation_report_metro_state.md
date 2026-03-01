# PropertyIQ Score Validation Report

**Generated:** 2026-03-01 13:37:55 UTC
**Data rows:** 169,990
**Benchmark:** Excess returns vs **State** median

---
## HOMEREADY Score Validation

- **Target:** excess_state_3y
- **Total observations:** 57,240
- **With target outcome:** 23,859

### 5.1 In-Sample Metrics

| Metric | Value |
|--------|-------|
| Sample size | 23,859 |
| Pearson r | 0.1722 |
| Spearman r | 0.2124 |

#### Quintile Analysis

| Quintile | Avg Score | Avg Excess Return | Count | Beat-Median Rate |
|:--------:|----------:|------------------:|------:|-----------------:|
| Q1 | 10.0 | -1.1986 | 4,772 | 32.9% |
| Q2 | 30.0 | -0.0668 | 4,783 | 45.4% |
| Q3 | 49.9 | 0.1157 | 4,764 | 51.1% |
| Q4 | 69.9 | 0.3152 | 4,783 | 54.5% |
| Q5 | 89.9 | 0.4542 | 4,757 | 58.1% |

#### Decile Spread

| Metric | Value |
|--------|------:|
| Top decile avg excess | 0.4442 |
| Bottom decile avg excess | -1.6672 |
| **Decile spread** | **2.1114** |

#### Information Coefficient (IC)

| Metric | Value |
|--------|------:|
| Mean IC | 0.2123 |
| Std IC | 0.0386 |
| IR (IC/std) | 5.5029 |
| Hit rate | 100.0% |
| Periods | 26 |

### 5.2 Out-of-Sample Metrics

| Metric | Value |
|--------|------:|
| Avg OOS quintile spread | 1.4558 |
| Avg OOS IC | 0.1589 |
| OOS IC IR | 0.0000 |
| Avg OOS hit rate | 61.1% |
| IC degradation (IS -> OOS) | 0.2516 |
| Spread degradation | 0.3105 |
| # folds | 1 |

### 5.3 Time Stability

| Year | N | Mean IC | Quintile Spread | Decile Spread | Status |
|:----:|----:|--------:|----------------:|--------------:|:------:|
| 2020 | 865 | 0.2755 | 2.0482 | 3.4531 | PASS |
| 2021 | 11,007 | 0.2271 | 1.9295 | 2.5059 | PASS |
| 2022 | 11,065 | 0.1944 | 1.3507 | 1.6384 | PASS |
| 2023 | 922 | 0.1872 | 1.5273 | 2.0891 | PASS |
| 2024 | 0 | - | - | - | skipped |
| 2025 | 0 | - | - | - | skipped |
| 2026 | 0 | - | - | - | skipped |

> All years pass stability checks.

### 5.4 Calibration Check

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 5.0 | 24.8 | 19.8 | 2,392 |
| 2 | 15.0 | 36.4 | 21.4 | 2,380 |
| 3 | 25.0 | 45.1 | 20.1 | 2,405 |
| 4 | 35.0 | 51.6 | 16.6 | 2,378 |
| 5 | 45.0 | 51.8 | 6.8 | 2,382 |
| 6 | 55.0 | 53.5 | 1.5 | 2,382 |
| 7 | 65.0 | 55.7 | 9.3 | 2,404 |
| 8 | 75.0 | 56.1 | 18.9 | 2,379 |
| 9 | 85.0 | 58.7 | 26.2 | 2,376 |
| 10 | 95.0 | 58.2 | 36.8 | 2,381 |

**Mean Absolute Deviation from diagonal:** 17.73 pp
**Well-calibrated (< 15 pp):** No

### 5.4b Post-Isotonic Calibration

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 5.0 | 24.8 | 19.8 | 2,392 |
| 2 | 15.0 | 36.4 | 21.4 | 2,380 |
| 3 | 25.0 | 45.1 | 20.1 | 2,405 |
| 4 | 35.0 | 51.6 | 16.6 | 2,378 |
| 5 | 45.0 | 51.8 | 6.8 | 2,382 |
| 6 | 55.0 | 53.5 | 1.5 | 2,382 |
| 7 | 65.0 | 55.7 | 9.3 | 2,404 |
| 8 | 75.0 | 56.1 | 18.9 | 2,379 |
| 9 | 85.0 | 58.7 | 26.2 | 2,376 |
| 10 | 95.0 | 58.2 | 36.8 | 2,381 |

**Post-calibration MAD:** 17.73 pp (was 17.73 pp)
**Well-calibrated (< 15 pp):** No

---
## INVESTOREDGE Score Validation

- **Target:** excess_total_state_3y
- **Total observations:** 57,240
- **With target outcome:** 22,508

### 5.1 In-Sample Metrics

| Metric | Value |
|--------|-------|
| Sample size | 22,508 |
| Pearson r | 0.0972 |
| Spearman r | 0.1705 |

#### Quintile Analysis

| Quintile | Avg Score | Avg Excess Return | Count | Beat-Median Rate |
|:--------:|----------:|------------------:|------:|-----------------:|
| Q1 | 10.6 | -0.7502 | 4,524 | 30.2% |
| Q2 | 31.1 | 1.2557 | 4,481 | 46.1% |
| Q3 | 51.0 | 1.7080 | 4,522 | 56.3% |
| Q4 | 70.6 | 1.5166 | 4,495 | 56.5% |
| Q5 | 90.1 | 1.0797 | 4,486 | 52.3% |

#### Decile Spread

| Metric | Value |
|--------|------:|
| Top decile avg excess | 0.6912 |
| Bottom decile avg excess | -1.6804 |
| **Decile spread** | **2.3716** |

#### Information Coefficient (IC)

| Metric | Value |
|--------|------:|
| Mean IC | 0.1682 |
| Std IC | 0.0958 |
| IR (IC/std) | 1.7563 |
| Hit rate | 92.3% |
| Periods | 26 |

### 5.2 Out-of-Sample Metrics

| Metric | Value |
|--------|------:|
| Avg OOS quintile spread | 4.6020 |
| Avg OOS IC | 0.2358 |
| OOS IC IR | 0.0000 |
| Avg OOS hit rate | 62.5% |
| IC degradation (IS -> OOS) | -0.4020 |
| Spread degradation | -0.9404 |
| # folds | 1 |

### 5.3 Time Stability

| Year | N | Mean IC | Quintile Spread | Decile Spread | Status |
|:----:|----:|--------:|----------------:|--------------:|:------:|
| 2020 | 859 | 0.2948 | 4.3814 | 5.4348 | PASS |
| 2021 | 10,094 | 0.1893 | 2.4837 | 2.6707 | PASS |
| 2022 | 10,636 | 0.1419 | 1.1448 | 1.8675 | PASS |
| 2023 | 919 | 0.1042 | 1.1553 | 2.7586 | PASS |
| 2024 | 0 | - | - | - | skipped |
| 2025 | 0 | - | - | - | skipped |
| 2026 | 0 | - | - | - | skipped |

> All years pass stability checks.

### 5.4 Calibration Check

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 5.0 | 26.0 | 21.0 | 2,260 |
| 2 | 15.0 | 34.7 | 19.7 | 2,264 |
| 3 | 25.0 | 41.8 | 16.8 | 2,251 |
| 4 | 35.0 | 52.5 | 17.5 | 2,230 |
| 5 | 45.0 | 56.2 | 11.2 | 2,265 |
| 6 | 55.0 | 58.7 | 3.7 | 2,257 |
| 7 | 65.0 | 55.6 | 9.4 | 2,252 |
| 8 | 75.0 | 59.2 | 15.8 | 2,243 |
| 9 | 85.0 | 57.3 | 27.7 | 2,241 |
| 10 | 95.0 | 51.7 | 43.3 | 2,245 |

**Mean Absolute Deviation from diagonal:** 18.61 pp
**Well-calibrated (< 15 pp):** No

### 5.4b Post-Isotonic Calibration

| Decile | Predicted Pctile | Actual Pctile | Deviation | N |
|:------:|-----------------:|--------------:|----------:|----:|
| 1 | 6.2 | 26.0 | 19.8 | 2,260 |
| 2 | 18.8 | 34.7 | 15.9 | 2,264 |
| 3 | 31.2 | 41.8 | 10.6 | 2,251 |
| 4 | 43.8 | 52.5 | 8.7 | 2,230 |
| 5 | 56.2 | 57.3 | 1.0 | 5,502 |
| 6 | 68.8 | 55.4 | 13.3 | 1,272 |
| 7 | 81.2 | 56.7 | 24.6 | 5,620 |
| 8 | 93.8 | 51.7 | 42.0 | 1,109 |

**Post-calibration MAD:** 17.00 pp (was 18.61 pp)
**Well-calibrated (< 15 pp):** No

---
## Overall Summary

| Score Type | Pearson r | Spearman r | Decile Spread | Mean IC | IC IR | Hit Rate | Calibration MAD |
|------------|----------:|-----------:|--------------:|--------:|------:|---------:|----------------:|
| homeready | 0.1722 | 0.2124 | 2.1114 | 0.2123 | 5.5029 | 100.0% | 17.73 |
| investoredge | 0.0972 | 0.1705 | 2.3716 | 0.1682 | 1.7563 | 92.3% | 18.61 |
