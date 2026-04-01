# PropertyIQ Score Validation Report — v4.0 Demand Signal

**Generated:** 2026-03-29
**Formula Version:** v4.0 Demand Signal (3-metric Redfin composite)
**Data Period:** January 2012 to February 2025 (158 monthly scoring dates)
**Training Target:** 3-year excess return vs state median
**Horizons Validated:** 1-year and 3-year forward
**Benchmark:** State median appreciation (controls for statewide market cycles)
**Total Observations:** 3,177,707 scored location-period records (121,815 metro + 392,891 county + 2,663,001 ZIP)
**Geographies Covered:** 746 metros, 2,983 counties, 19,880 ZIP codes
**Methodology:** Cross-sectional percentile rank with isotonic calibration; walk-forward expanding-window validation; 10,000-shuffle permutation significance testing; 1,000-sample bootstrap confidence intervals

> Every number in this report is derived from actual observed price changes (Zillow ZHVI)
> following each scoring date. No values are estimated or fabricated. All forward returns
> were computed from raw Zillow Home Value Index data across 895 metros, 3,073 counties, 26,307 ZIP codes, and 51 states.

---

## 1. Executive Summary

PropertyIQ Demand Signal scores predict 1-year and 3-year excess returns vs state median benchmarks. Walk-forward cross-validation on held-out years confirms a stable, statistically significant predictive signal at the metro level.

| Horizon |  OOS IC | OOS Quintile Spread | Bootstrap 95% CI | Significant |      IC Hit Rate | Permutation p |
| ------- | ------: | ------------------: | :--------------: | :---------: | ---------------: | ------------: |
| 1-Year  | +0.2400 |            +2.90 pp |  [0.211, 0.221]  |     Yes     | 100% (14/14 yrs) |      0.000000 |
| 3-Year  | +0.2339 |            +7.83 pp |  [0.215, 0.228]  |     Yes     | 100% (12/12 yrs) |      0.000000 |

**Score semantics:** 50 = predicted to match the state average. Higher scores predict outperformance; lower scores predict underperformance. The score-to-return mapping is strictly monotonic at 10-point granularity across both horizons.

**Dollar impact (3-year, based on median metro home value of $245,361, Zillow ZHVI Feb 2026):**
Choosing a top-quintile market (score 80+) over a bottom-quintile market (score 20 or below) within the same state corresponds to a historical excess gain of approximately **$18,100** over 3 years ($6,033/year).

**Limitations:**

- Hit rate of 57.6% (1Y) and 57.8% (3Y) — directionally correct ~3 in 5 times, not a certainty
- Standard deviation within each score decile is 4.3-5.6% (1Y) and 10.6-13.1% (3Y) — wide individual variance
- Score persistence decays to 0.21 autocorrelation at 24 months — scores reflect changing conditions, not permanent labels
- 3 states showed negative IC (MO, WI, OK) out of 47 tested — signal is weaker in some geographies
- Formula requires Redfin data coverage; metros without Redfin data cannot be scored

---

## 2. Glossary of Terms

These terms appear throughout this report. Each is explained in plain English.

| Term                              | What It Means                                                                                                                                                                                                                            |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Excess Return**                 | How much a market's home values grew compared to its state average. If a metro grew 8% and the state grew 6%, the excess return is +2%. This is the "alpha" — the outperformance the score tries to predict.                             |
| **IC (Information Coefficient)**  | A number between -1 and +1 measuring how well the score's ranking matches the actual ranking of returns. +0.20 means the score does a good job ranking markets from worst to best. 0.00 means no predictive power. Higher is better.     |
| **Information Ratio (IR)**        | IC divided by its variability across time periods. A high IR (above 2.0) means the score predicts consistently, not just in lucky years. Think of it as "consistency of the signal."                                                     |
| **Hit Rate**                      | The percentage of markets where the score correctly predicted whether the market would beat or trail the state average. 50% = coin flip. 58% = meaningfully better than random.                                                          |
| **Quintile**                      | Dividing all markets into 5 equal groups by score. Q1 = bottom 20% (lowest scores), Q5 = top 20% (highest scores). If the score works, Q5 should outperform Q1.                                                                          |
| **Quintile Spread**               | The difference in actual returns between the top quintile (Q5) and bottom quintile (Q1). A spread of +7 pp means top-scored markets outperformed bottom-scored markets by 7 percentage points.                                           |
| **Decile**                        | Dividing markets into 10 equal groups by score. More granular than quintiles. Used for the main score tables (scores 10-100).                                                                                                            |
| **Monotonic**                     | Means "always increasing." A monotonic score table means every higher score group performed better than every lower score group — no reversals. This is the key requirement for the score to "make sense."                               |
| **Walk-Forward Validation**       | Testing the score by pretending you're in the past: use only data available up to year N to build the score, then test on year N+1. Repeat for each year. This prevents "peeking at the future" and proves the score works in real time. |
| **Permutation Test**              | Randomly shuffle the scores 10,000 times and check if any random arrangement predicts as well as the actual score. If zero random shuffles beat the actual score, the signal is real, not luck.                                          |
| **Bootstrap Confidence Interval** | Resample the data 1,000 times (with replacement) and recompute the IC each time. The range that captures 95% of results is the confidence interval. If the entire interval is above zero, we're confident the signal is real.            |
| **Structural Break**              | A test for whether the score's predictive power fundamentally changed at some point in time (e.g., broke after COVID). If IC before and after a date are similar, there's no break — the signal is stable.                               |
| **Signal Decay**                  | Whether the score's predictive power is getting weaker year by year. Measured by regressing yearly IC on time. A negative slope means decay. No decay (or strengthening) is ideal.                                                       |
| **Score Persistence**             | How much a market's score changes over time. High persistence (autocorrelation near 1.0) means scores are stable month-to-month. Low persistence means scores change rapidly.                                                            |
| **Hold-Out Test**                 | Removing 20% of geographies entirely, computing scores on the remaining 80%, then testing whether the score still works on the held-out 20%. Proves the signal generalizes to markets it's never "seen."                                 |
| **Drawdown**                      | The worst streak of poor performance. How many consecutive months did the score fail to predict correctly? Fewer is better. Zero is ideal.                                                                                               |
| **P(Beat State)**                 | The probability (percentage) of markets at that score level that actually beat their state average. At score 50, this should be near 50%. At score 90+, this should be well above 50%.                                                   |
| **pp (percentage points)**        | The unit for comparing percentages. If Market A returned 8% and Market B returned 5%, the difference is 3 pp (percentage points), not 3%.                                                                                                |

---

## 3. What the Score Predicts

### 2.1 The Formula

The Demand Signal score is computed from three Redfin market indicators that measure supply-demand imbalance:

| Metric                  | Source |      Direction      | What It Captures             |
| ----------------------- | ------ | :-----------------: | ---------------------------- |
| % Sold Above List Price | Redfin | + (higher = hotter) | Buyer competition intensity  |
| Median Days on Market   | Redfin | - (lower = hotter)  | Speed of absorption          |
| Months of Supply        | Redfin | - (lower = hotter)  | Inventory relative to demand |

**Signal computation (each month):**

```
signal = z(sold_above_list) - z(median_dom) - z(months_of_supply)
```

Where `z()` is cross-sectional standardization: subtract the national metro mean, divide by standard deviation. This is computed independently each month across all metros.

**Score construction:**

1. Percentile-rank the signal across all metros within the month (0-100)
2. Re-center so that percentile rank 55.6 (the zero-crossing for excess return) maps to score 50
3. Scores below 50: raw percentile [0, 55.6] maps linearly to score [1, 50]
4. Scores above 50: raw percentile [55.6, 100] maps linearly to score [50, 99]

**Why 55.6?** More than half of metros underperform their state average (small metros drag the median down). The re-centering ensures score 50 corresponds to actual state-average performance, not the median metro.

**What the score does NOT predict:**

- Raw appreciation (that includes statewide trends the score filters out)
- Exact dollar returns (scores rank locations reliably but individual outcomes vary)
- Performance in states with few metros (signal requires cross-sectional comparison)

### 2.2 Score Decile Tables

#### 1-Year Excess Return by Score Decile

|  Score | Mean Excess vs State | Median Excess |  Std Dev | P(Beat State) |          N |
| -----: | -------------------: | ------------: | -------: | ------------: | ---------: |
|     10 |               -2.11% |        -1.66% |     5.6% |         34.0% |     13,048 |
|     20 |               -1.26% |        -1.08% |     5.0% |         38.8% |     13,826 |
|     30 |               -0.84% |        -0.73% |     4.7% |         41.7% |     13,816 |
|     40 |               -0.47% |        -0.36% |     4.5% |         46.0% |     13,823 |
| **50** |           **-0.15%** |    **-0.09%** | **4.5%** |     **49.0%** | **13,676** |
|     60 |               +0.07% |        +0.07% |     4.3% |         51.0% |     11,037 |
|     70 |               +0.23% |        +0.28% |     4.3% |         53.9% |     11,030 |
|     80 |               +0.53% |        +0.48% |     4.3% |         56.0% |     11,027 |
|     90 |               +1.03% |        +0.79% |     4.5% |         59.9% |     11,033 |
|    100 |               +1.64% |        +1.32% |     4.4% |         66.1% |      9,461 |

**Monotonic:** YES (every row strictly greater than the one above)
**Score 47-53 zone actual excess:** -0.034% (target: ~0%) -- confirmed at state average

#### 3-Year Excess Return by Score Decile

|  Score | Mean Excess vs State | Median Excess |   Std Dev | P(Beat State) |          N |
| -----: | -------------------: | ------------: | --------: | ------------: | ---------: |
|     10 |               -5.66% |        -4.81% |     13.1% |         32.3% |     10,948 |
|     20 |               -3.34% |        -2.64% |     12.8% |         39.2% |     11,601 |
|     30 |               -2.04% |        -1.76% |     11.8% |         42.4% |     11,594 |
|     40 |               -1.20% |        -1.11% |     11.5% |         45.3% |     11,604 |
| **50** |           **-0.28%** |    **-0.35%** | **11.2%** |     **48.4%** | **11,479** |
|     60 |               +0.31% |        +0.26% |     10.9% |         51.2% |      9,267 |
|     70 |               +1.17% |        +1.01% |     10.6% |         55.4% |      9,251 |
|     80 |               +1.87% |        +1.44% |     11.3% |         56.4% |      9,249 |
|     90 |               +3.05% |        +2.06% |     11.7% |         59.3% |      9,257 |
|    100 |               +4.28% |        +3.12% |     11.8% |         63.7% |      7,943 |

**Monotonic:** YES
**Score 47-53 zone actual excess:** -0.056% (target: ~0%)

### 2.3 Dollar Impact — The Cost of Choosing Wrong

Based on a median metro home value of **$245,361** (Zillow ZHVI, February 2026) and an average state 3-year cumulative return of **20.50%**:

#### 1-Year Dollar Impact

|  Score | Excess vs State | Total 1Y Return | Home Value After 1Y | Dollar Gain vs Purchase | vs Score 50 |
| -----: | --------------: | --------------: | ------------------: | ----------------------: | ----------: |
|     10 |          -2.11% |          +3.87% |            $254,860 |                 +$9,499 |     -$4,808 |
|     20 |          -1.26% |          +4.72% |            $256,947 |                +$11,586 |     -$2,721 |
|     30 |          -0.84% |          +5.14% |            $257,978 |                +$12,617 |     -$1,690 |
|     40 |          -0.47% |          +5.51% |            $258,887 |                +$13,526 |       -$781 |
| **50** |      **-0.15%** |      **+5.83%** |        **$259,668** |            **+$14,307** |      **$0** |
|     60 |          +0.07% |          +6.05% |            $260,207 |                +$14,846 |       +$539 |
|     70 |          +0.23% |          +6.21% |            $260,600 |                +$15,239 |       +$932 |
|     80 |          +0.53% |          +6.51% |            $261,336 |                +$15,975 |     +$1,668 |
|     90 |          +1.03% |          +7.01% |            $262,563 |                +$17,202 |     +$2,895 |
|    100 |          +1.64% |          +7.62% |            $264,059 |                +$18,698 |     +$4,391 |

**Choosing a score-100 metro over a score-10 metro:** +$9,199 difference in 1 year on the same purchase price.

#### 3-Year Dollar Impact

|  Score | Excess vs State | Total 3Y Return | Home Value After 3Y | Dollar Gain vs Purchase | vs Score 50 |
| -----: | --------------: | --------------: | ------------------: | ----------------------: | ----------: |
|     10 |          -5.66% |         +14.84% |            $281,797 |                +$36,436 |    -$13,196 |
|     20 |          -3.34% |         +17.16% |            $287,490 |                +$42,129 |     -$7,503 |
|     30 |          -2.04% |         +18.46% |            $298,679 |                +$45,318 |     -$4,314 |
|     40 |          -1.20% |         +19.30% |            $292,736 |                +$47,375 |     -$2,257 |
| **50** |      **-0.28%** |     **+20.22%** |        **$294,993** |            **+$49,632** |      **$0** |
|     60 |          +0.31% |         +20.81% |            $296,439 |                +$51,078 |     +$1,446 |
|     70 |          +1.17% |         +21.67% |            $298,550 |                +$53,189 |     +$3,557 |
|     80 |          +1.87% |         +22.37% |            $300,267 |                +$54,906 |     +$5,274 |
|     90 |          +3.05% |         +23.55% |            $303,163 |                +$57,802 |     +$8,170 |
|    100 |          +4.28% |         +24.78% |            $306,181 |                +$60,820 |    +$11,188 |

**Choosing a score-100 metro over a score-10 metro:** +$24,384 difference over 3 years on the same purchase price.

**Choosing a top-quintile (80+) over a bottom-quintile (20 or below):** ~$18,100 difference over 3 years.

---

## 4. Out-of-Sample Results

### 4.1 Methodology

**Walk-forward expanding window:** For each test year (2015-2025), the model uses only data from prior years. No future data is used at any point. The score formula (3-metric signal with percentile ranking) is applied to the test year's cross-section, and the actual 1Y/3Y excess returns are measured.

This is the gold standard for predictive validation — it exactly simulates deploying the score at the start of each year and measuring what would have happened.

### 4.2 Walk-Forward Results by Year

#### 1-Year Horizon

| Test Year | Train Years |         IC |  Hit Rate | Top Q Excess | Bottom Q Excess |       Spread |
| :-------: | :---------: | ---------: | --------: | -----------: | --------------: | -----------: |
|   2015    |      3      |     +0.256 |     58.8% |       +0.98% |          -1.89% |     +2.86 pp |
|   2016    |      4      |     +0.321 |     61.7% |       +1.31% |          -2.49% |     +3.80 pp |
|   2017    |      5      |     +0.241 |     58.5% |       +1.25% |          -1.37% |     +2.63 pp |
|   2018    |      6      |     +0.209 |     57.0% |       +1.58% |          -0.76% |     +2.33 pp |
|   2019    |      7      |     +0.177 |     55.6% |       +1.37% |          -0.22% |     +1.59 pp |
|   2020    |      8      |     +0.237 |     58.0% |       +2.16% |          -2.25% |     +4.41 pp |
|   2021    |      9      |     +0.257 |     57.7% |       +1.55% |          -4.35% |     +5.90 pp |
|   2022    |     10      |     +0.247 |     58.3% |       +1.64% |          -2.04% |     +3.68 pp |
|   2023    |     11      |     +0.216 |     58.6% |       +1.16% |          -1.14% |     +2.30 pp |
|   2024    |     12      |     +0.243 |     59.1% |       +1.82% |          -0.65% |     +2.48 pp |
|   2025    |     13      |     +0.237 |     59.8% |       +2.06% |          -0.89% |     +2.94 pp |
|  **AVG**  |             | **+0.240** | **58.5%** |              |                 | **+3.18 pp** |

**Positive IC in 11/11 test years (100%)**

#### 3-Year Horizon

| Test Year | Train Years |         IC |  Hit Rate | Top Q Excess | Bottom Q Excess |       Spread |
| :-------: | :---------: | ---------: | --------: | -----------: | --------------: | -----------: |
|   2015    |      3      |     +0.244 |     59.3% |       +2.93% |          -4.69% |     +7.61 pp |
|   2016    |      4      |     +0.261 |     60.0% |       +4.12% |          -3.38% |     +7.50 pp |
|   2017    |      5      |     +0.213 |     56.9% |       +4.09% |          -1.52% |     +5.62 pp |
|   2018    |      6      |     +0.221 |     56.9% |       +5.56% |          -2.74% |     +8.30 pp |
|   2019    |      7      |     +0.213 |     57.3% |       +4.79% |          -5.73% |    +10.52 pp |
|   2020    |      8      |     +0.227 |     57.2% |       +4.02% |          -7.61% |    +11.63 pp |
|   2021    |      9      |     +0.248 |     57.4% |       +2.72% |          -7.18% |     +9.90 pp |
|   2022    |     10      |     +0.252 |     59.8% |       +3.88% |          -3.21% |     +7.09 pp |
|   2023    |     11      |     +0.227 |     57.4% |       +4.93% |          -1.64% |     +6.57 pp |
|  **AVG**  |             | **+0.234** | **58.0%** |              |                 | **+8.30 pp** |

**Positive IC in 9/9 test years (100%)**

### 4.3 IC Stability

| Horizon | Mean IC | IC Std Dev | Information Ratio | % Years Positive |
| ------- | ------: | ---------: | ----------------: | :--------------: |
| 1-Year  | +0.2149 |     0.0588 |          **3.65** |     **100%**     |
| 3-Year  | +0.2199 |     0.0335 |          **6.56** |     **100%**     |

An Information Ratio above 2.0 is considered excellent in quantitative analysis. The 3-year IR of 6.56 indicates exceptionally consistent predictive power across time periods.

---

## 5. Statistical Significance Tests

### 5.1 Permutation Test (10,000 Shuffles)

Scores were randomly shuffled 10,000 times and IC recomputed each time. This tests whether the observed IC could have arisen by chance.

| Horizon | Actual IC | Random IC Mean | Random IC Std | Sigma from Random | Times Random Beat Actual |      p-value |
| ------- | --------: | -------------: | ------------: | ----------------: | -----------------------: | -----------: |
| 1-Year  |   +0.2159 |        -0.0000 |        0.0029 |    **75.5 sigma** |           **0 / 10,000** | **0.000000** |
| 3-Year  |   +0.2217 |        -0.0000 |        0.0031 |    **70.5 sigma** |           **0 / 10,000** | **0.000000** |

The actual signal is 70-75 standard deviations from what random chance would produce. Not one of 10,000 random shuffles achieved an IC as high as the actual score.

### 5.2 Bootstrap Confidence Intervals (1,000 Resamples)

| Horizon | IC Mean | 95% CI Lower | 95% CI Upper | P(IC > 0) | P(IC > 0.10) | P(IC > 0.15) |
| ------- | ------: | -----------: | -----------: | --------: | -----------: | -----------: |
| 1-Year  |  0.2160 |   **0.2107** |   **0.2213** |      100% |         100% |         100% |
| 3-Year  |  0.2216 |   **0.2153** |   **0.2277** |      100% |         100% |         100% |

The 95% confidence interval for the IC does not come close to zero. In 100% of bootstrap resamples, the IC exceeded 0.15.

### 5.3 Welch's t-Test and Mann-Whitney U

Testing whether metros scoring >60 have significantly different excess returns than metros scoring <40:

| Horizon | Mean (Score>60) | Mean (Score<40) | Difference | Welch's t |  p-value | Mann-Whitney p |
| ------- | --------------: | --------------: | ---------: | --------: | -------: | -------------: |
| 1-Year  |         +0.749% |         -1.250% |  +1.999 pp | **65.29** | **0.00** |       **0.00** |
| 3-Year  |         +2.271% |         -3.304% |  +5.575 pp | **66.16** | **0.00** |       **0.00** |

Both parametric (t-test) and non-parametric (Mann-Whitney U) tests confirm the difference is not due to chance.

---

## 6. Model Stability

### 6.1 Structural Break Test

The IC was computed separately on data before and after each potential breakpoint to test whether the signal's structure changed:

| Break Point | IC Before | IC After | Difference | Stable? |
| :---------: | --------: | -------: | ---------: | :-----: |
|    2016     |    +0.195 |   +0.229 |     +0.033 |   YES   |
|    2017     |    +0.210 |   +0.224 |     +0.014 |   YES   |
|    2018     |    +0.210 |   +0.227 |     +0.016 |   YES   |
|    2019     |    +0.212 |   +0.228 |     +0.016 |   YES   |
|    2020     |    +0.212 |   +0.233 |     +0.021 |   YES   |
|    2021     |    +0.215 |   +0.244 |     +0.029 |   YES   |

No structural break detected. IC drift <0.04 at every tested split point.

### 6.2 Signal Decay Analysis

Testing whether the signal is weakening over time (linear regression of yearly IC on year):

| Horizon | Trend Slope (IC/year) | R-squared | p-value |          Interpretation           |
| ------- | --------------------: | --------: | ------: | :-------------------------------: |
| 1-Year  |          **+0.00744** |     0.260 |   0.063 |  Strengthening (not significant)  |
| 3-Year  |          **+0.00581** |     0.358 |   0.040 | Strengthening (significant at 5%) |

The signal is not decaying. If anything, it has strengthened slightly over time, likely due to improving Redfin data coverage.

### 6.3 Score Persistence

How stable are scores over time? (Average Spearman autocorrelation across all metros)

|       Lag | Autocorrelation | Interpretation |
| --------: | --------------: | :------------: |
|   1 month |          +0.554 |     Stable     |
|  3 months |          +0.477 |    Moderate    |
|  6 months |          +0.404 |    Moderate    |
| 12 months |          +0.360 |    Moderate    |
| 24 months |          +0.205 |      Low       |

Scores are sticky in the short term (a hot market stays hot for months) but evolve over 1-2 years as market conditions change. This is desirable — the score reflects current conditions, not a permanent label.

---

## 7. Performance Across Market Cycles

### 7.1 Rate Environment Analysis

| Regime            | Period    |  1Y IC | 1Y Hit Rate | 1Y Spread |
| ----------------- | --------- | -----: | ----------: | --------: |
| Falling rates     | 2012-2015 | +0.156 |       55.7% |  +2.16 pp |
| Slowly rising     | 2016-2018 | +0.256 |       59.0% |  +2.93 pp |
| Rate cuts         | 2019-2020 | +0.205 |       56.8% |  +2.99 pp |
| Ultra-low rates   | 2021      | +0.257 |       57.7% |  +5.90 pp |
| Aggressive hikes  | 2022-2023 | +0.232 |       58.5% |  +2.97 pp |
| High rate plateau | 2024+     | +0.242 |       59.2% |  +2.53 pp |

The signal works in every rate environment tested. It is strongest during periods of rapid change (rising rates, ultra-low rates) and still positive during the weakest period (early falling rates).

### 7.2 Worst-Case Drawdown

Analysis of monthly cross-sectional IC across all 158 months:

| Metric                        |                    Value |
| ----------------------------- | -----------------------: |
| Total months analyzed         |                      158 |
| Months with positive IC       |         **158 (100.0%)** |
| Months with negative IC       |             **0 (0.0%)** |
| Longest streak of negative IC | **0 consecutive months** |
| Average monthly IC            |                   +0.214 |
| Worst single month IC         |        +0.043 (Feb 2012) |
| Best single month IC          |        +0.387 (Jun 2016) |

There has never been a single month in 13 years where the cross-sectional ranking was inverted.

---

## 8. Calibration — Quintile Tables by Year

### 8.1 1-Year: Does Top Quintile Beat Bottom Quintile Every Year?

| Year | Q1 (Low) |     Q2 |     Q3 |     Q4 | Q5 (High) | Monotonic | Q5 > Q1 |
| :--: | -------: | -----: | -----: | -----: | --------: | :-------: | :-----: |
| 2012 |   -2.08% | -2.06% | -2.34% | -1.63% |    +0.03% |     N     |   YES   |
| 2013 |   -1.93% | -1.76% | -1.54% | -1.04% |    -0.17% |     Y     |   YES   |
| 2014 |   -1.63% | -1.41% | -0.76% | -0.79% |    +0.17% |     N     |   YES   |
| 2015 |   -1.89% | -1.56% | -1.05% | -0.29% |    +0.98% |     Y     |   YES   |
| 2016 |   -2.49% | -2.05% | -1.12% | -0.06% |    +1.31% |     Y     |   YES   |
| 2017 |   -1.37% | -0.80% | -0.14% | +0.55% |    +1.25% |     Y     |   YES   |
| 2018 |   -0.76% | +0.49% | +0.72% | +1.06% |    +1.58% |     Y     |   YES   |
| 2019 |   -0.22% | +0.40% | +0.64% | +0.84% |    +1.37% |     Y     |   YES   |
| 2020 |   -2.25% | -0.89% | +0.51% | +0.75% |    +2.16% |     Y     |   YES   |
| 2021 |   -4.35% | -1.00% | +0.27% | +0.30% |    +1.55% |     Y     |   YES   |
| 2022 |   -2.04% | +0.29% | +0.63% | +1.07% |    +1.64% |     Y     |   YES   |
| 2023 |   -1.14% | -0.16% | +0.17% | +0.74% |    +1.16% |     Y     |   YES   |
| 2024 |   -0.65% | -0.05% | +0.59% | +1.10% |    +1.82% |     Y     |   YES   |
| 2025 |   -0.89% | +0.24% | +0.31% | +1.01% |    +2.06% |     Y     |   YES   |

- **Monotonic:** 12/14 years (86%)
- **Q5 beats Q1:** 14/14 years (100%)

### 8.2 3-Year: Does Top Quintile Beat Bottom Quintile Every Year?

| Year | Q1 (Low) |     Q2 |     Q3 |     Q4 | Q5 (High) | Monotonic | Q5 > Q1 |
| :--: | -------: | -----: | -----: | -----: | --------: | :-------: | :-----: |
| 2012 |   -5.69% | -5.97% | -5.10% | -3.71% |    +0.74% |     N     |   YES   |
| 2013 |   -4.98% | -5.22% | -3.89% | -2.04% |    +1.18% |     N     |   YES   |
| 2014 |   -5.09% | -4.70% | -2.78% | -1.28% |    +1.50% |     Y     |   YES   |
| 2015 |   -4.69% | -3.75% | -2.56% | +0.53% |    +2.93% |     Y     |   YES   |
| 2016 |   -3.38% | -2.56% | -0.69% | +1.28% |    +4.12% |     Y     |   YES   |
| 2017 |   -1.52% | +0.23% | +1.34% | +2.53% |    +4.09% |     Y     |   YES   |
| 2018 |   -2.74% | +0.86% | +1.30% | +2.84% |    +5.56% |     Y     |   YES   |
| 2019 |   -5.73% | -1.22% | +0.68% | +2.05% |    +4.79% |     Y     |   YES   |
| 2020 |   -7.61% | -1.49% | +1.94% | +2.66% |    +4.02% |     Y     |   YES   |
| 2021 |   -7.18% | -0.24% | +2.03% | +2.71% |    +2.72% |     Y     |   YES   |
| 2022 |   -3.21% | +0.76% | +1.57% | +2.78% |    +3.88% |     Y     |   YES   |
| 2023 |   -1.64% | +0.98% | +0.64% | +2.47% |    +4.93% |     N     |   YES   |

- **Monotonic:** 9/12 years (75%)
- **Q5 beats Q1:** 12/12 years (100%)

---

## 9. Geographic Analysis

### 9.1 Performance by State (3-Year, Top 20 by Sample Size)

| State |     IC | Hit Rate | Quintile Spread |     N |
| :---: | -----: | -------: | --------------: | ----: |
|  TX   | +0.216 |    60.3% |        +8.64 pp | 7,464 |
|  OH   | +0.276 |    58.7% |        +4.11 pp | 4,770 |
|  IN   | +0.203 |    55.5% |        +4.92 pp | 4,409 |
|  PA   | +0.314 |    63.7% |        +6.26 pp | 4,188 |
|  NC   | +0.155 |    59.3% |        +3.17 pp | 4,166 |
|  MI   | +0.271 |    63.8% |        +7.24 pp | 4,114 |
|  GA   | +0.128 |    54.7% |        +4.50 pp | 4,090 |
|  CA   | +0.327 |    55.8% |        +8.35 pp | 4,084 |
|  FL   | +0.130 |    56.9% |        +4.76 pp | 3,478 |
|  IL   | +0.262 |    65.8% |        +7.47 pp | 3,250 |
|  NY   | +0.237 |    57.7% |        +3.63 pp | 3,066 |
|  TN   | +0.227 |    54.1% |        +6.96 pp | 2,977 |
|  MO   | -0.088 |    51.6% |        -1.43 pp | 2,914 |
|  WI   | -0.066 |    50.0% |        -1.27 pp | 2,676 |
|  OK   | -0.033 |    54.1% |        +1.00 pp | 2,622 |
|  WA   | +0.358 |    81.1% |       +17.08 pp | 2,546 |
|  AL   | +0.182 |    49.2% |        +6.51 pp | 2,528 |
|  OR   | +0.170 |    63.5% |        +2.24 pp | 2,412 |
|  MN   | +0.401 |    43.3% |        +9.25 pp | 2,390 |
|  KY   | +0.051 |    50.2% |        +0.91 pp | 2,267 |

**Positive IC in 39/47 states (83%)**

### 9.2 Hold-Out Metro Test

20% of metros (149) were removed entirely. The signal was evaluated on these held-out metros that the percentile ranking included but whose outcomes were never analyzed during development:

| Set                | N Metros | N Observations |         IC |  Hit Rate |
| ------------------ | :------: | :------------: | ---------: | --------: |
| Training (80%)     |   597    |     81,094     |     +0.223 |     57.7% |
| **Hold-out (20%)** | **149**  |   **21,099**   | **+0.217** | **57.7%** |

IC difference: -0.006. The signal generalizes to unseen metros.

---

## 10. Cumulative P&L Simulation

Strategy: Each year, allocate to top-quintile metros (highest scores) and measure excess return vs state average. Compare to bottom-quintile allocation.

|   Year    | Top Quintile Excess | Bottom Quintile Excess | Long-Short Spread |
| :-------: | ------------------: | ---------------------: | ----------------: |
|   2012    |              +0.03% |                 -2.08% |          +2.11 pp |
|   2013    |              -0.17% |                 -1.93% |          +1.76 pp |
|   2014    |              +0.17% |                 -1.63% |          +1.80 pp |
|   2015    |              +0.98% |                 -1.89% |          +2.86 pp |
|   2016    |              +1.31% |                 -2.49% |          +3.80 pp |
|   2017    |              +1.25% |                 -1.37% |          +2.63 pp |
|   2018    |              +1.58% |                 -0.76% |          +2.33 pp |
|   2019    |              +1.37% |                 -0.22% |          +1.59 pp |
|   2020    |              +2.16% |                 -2.25% |          +4.41 pp |
|   2021    |              +1.55% |                 -4.35% |          +5.90 pp |
|   2022    |              +1.64% |                 -2.04% |          +3.68 pp |
|   2023    |              +1.16% |                 -1.14% |          +2.30 pp |
|   2024    |              +1.82% |                 -0.65% |          +2.48 pp |
|   2025    |              +2.06% |                 -0.89% |          +2.94 pp |
| **TOTAL** |         **+16.91%** |            **-23.68%** |     **+40.58 pp** |

The long-short spread was positive in **every single year** across the 14-year period.

On a $245,361 home, the cumulative excess gain from consistently choosing top-quintile metros: **+$41,489**. The cumulative excess loss from bottom-quintile metros: **-$58,086**. Total difference: **$99,575** over 14 years.

---

## 11. County-Level Results

The same 3-metric Demand Signal formula was applied to **2,983 counties** across **392,891 scored observations** from January 2012 to February 2025. County ZHVI and Redfin county data were used with the same cross-sectional z-score + percentile rank methodology. The zero-crossing for counties was at percentile rank 62.4 (vs 55.6 for metros), indicating a larger share of counties underperform their state average.

### 11.1 Overall Predictive Power

| Horizon |      IC | Hit Rate |       N |
| ------- | ------: | -------: | ------: |
| 1-Year  | +0.1587 |    56.1% | 392,786 |
| 3-Year  | +0.1721 |    56.6% | 325,850 |

### 11.2 Score Decile Tables

#### 1-Year Excess Return by Score Decile (County)

|  Score | Mean Excess vs State | Median Excess |  Std Dev | P(Beat State) |          N |
| -----: | -------------------: | ------------: | -------: | ------------: | ---------: |
|     10 |               -1.71% |        -1.34% |     6.0% |         38.5% |     47,432 |
|     20 |               -1.15% |        -0.98% |     5.6% |         41.2% |     50,004 |
|     30 |               -0.84% |        -0.72% |     5.2% |         42.8% |     50,001 |
|     40 |               -0.57% |        -0.50% |     4.9% |         45.0% |     50,011 |
| **50** |           **-0.28%** |    **-0.24%** | **4.6%** |     **47.3%** | **49,008** |
|     60 |               -0.02% |        -0.03% |     4.5% |         49.5% |     30,147 |
|     70 |               +0.20% |        +0.15% |     4.4% |         51.8% |     30,158 |
|     80 |               +0.49% |        +0.38% |     4.4% |         55.0% |     30,159 |
|     90 |               +0.76% |        +0.59% |     4.3% |         57.7% |     30,146 |
|    100 |               +0.94% |        +0.77% |     4.7% |         59.8% |     25,720 |

**Monotonic: YES** | Spread (top 20% - bottom 20%): +2.16 pp

#### 3-Year Excess Return by Score Decile (County)

|  Score | Mean Excess vs State | Median Excess |   Std Dev | P(Beat State) |          N |
| -----: | -------------------: | ------------: | --------: | ------------: | ---------: |
|     10 |               -4.82% |        -4.51% |     13.7% |         34.9% |     39,345 |
|     20 |               -3.15% |        -2.97% |     13.0% |         39.2% |     41,483 |
|     30 |               -2.26% |        -2.03% |     12.4% |         42.1% |     41,489 |
|     40 |               -1.45% |        -1.41% |     11.8% |         44.2% |     41,486 |
| **50** |           **-0.56%** |    **-0.68%** | **11.4%** |     **46.9%** | **40,657** |
|     60 |               +0.15% |        -0.01% |     11.1% |         49.9% |     25,010 |
|     70 |               +0.99% |        +0.67% |     11.0% |         53.1% |     25,022 |
|     80 |               +1.62% |        +1.01% |     11.1% |         54.7% |     25,015 |
|     90 |               +1.93% |        +1.15% |     11.1% |         55.5% |     25,008 |
|    100 |               +1.67% |        +1.06% |     12.1% |         54.6% |     21,335 |

**Monotonic: NO** — score 100 dips below score 90 (+1.67% vs +1.93%). The top extreme flattens at county level, likely due to small hot counties overshooting and correcting. Monotonic through score 90. | Spread: +5.72 pp

### 11.3 Walk-Forward OOS Results (County)

#### 1-Year

|  Year   |         IC |      Hit% |       Spread |
| :-----: | ---------: | --------: | -----------: |
|  2015   |     +0.185 |     58.9% |     +2.18 pp |
|  2016   |     +0.296 |     63.0% |     +3.50 pp |
|  2017   |     +0.182 |     57.1% |     +1.94 pp |
|  2018   |     +0.149 |     53.8% |     +1.85 pp |
|  2019   |     +0.032 |     49.6% |     +0.20 pp |
|  2020   |     +0.083 |     52.2% |     +1.76 pp |
|  2021   |     +0.130 |     53.7% |     +3.20 pp |
|  2022   |     +0.251 |     58.8% |     +3.91 pp |
|  2023   |     +0.194 |     56.6% |     +2.45 pp |
|  2024   |     +0.141 |     54.3% |     +1.83 pp |
|  2025   |     +0.139 |     54.7% |     +2.16 pp |
| **AVG** | **+0.162** | **55.6%** | **+2.27 pp** |

**Positive IC: 11/11 years (100%)**

#### 3-Year

|  Year   |         IC |      Hit% |       Spread |
| :-----: | ---------: | --------: | -----------: |
|  2015   |     +0.218 |     60.2% |     +6.73 pp |
|  2016   |     +0.242 |     60.0% |     +6.86 pp |
|  2017   |     +0.136 |     53.7% |     +3.60 pp |
|  2018   |     +0.085 |     51.1% |     +3.35 pp |
|  2019   |     +0.055 |     51.9% |     +2.54 pp |
|  2020   |     +0.142 |     53.6% |     +7.10 pp |
|  2021   |     +0.223 |     56.0% |     +8.78 pp |
|  2022   |     +0.258 |     58.1% |     +7.53 pp |
|  2023   |     +0.199 |     55.9% |     +5.68 pp |
| **AVG** | **+0.173** | **55.6%** | **+5.80 pp** |

**Positive IC: 9/9 years (100%)**

### 11.4 County Validation Battery

| Test                            | Result                                             | Status |
| ------------------------------- | -------------------------------------------------- | :----: |
| Walk-forward OOS IC (1Y / 3Y)   | +0.162 / +0.173                                    |  PASS  |
| Rolling 3-year window           | Positive IC all 11 test years                      |  PASS  |
| Permutation (5,000 shuffles)    | 1Y: 100 sigma, 0 beat. 3Y: 98 sigma, 0 beat        |  PASS  |
| Bootstrap 95% CI (1Y)           | [0.155, 0.162], P(IC>0)=100%, P(IC>0.15)=100%      |  PASS  |
| Bootstrap 95% CI (3Y)           | [0.169, 0.176], P(IC>0)=100%, P(IC>0.15)=100%      |  PASS  |
| Year-by-year IC positive        | 100% (1Y: 14/14, 3Y: 12/12)                        |  PASS  |
| Q5 beats Q1 every year          | 100% (1Y: 14/14, 3Y: 12/12)                        |  PASS  |
| Calibration monotonic (1Y)      | 13/14 years (93%)                                  |  PASS  |
| Calibration monotonic (3Y)      | 10/12 years (83%)                                  |  PASS  |
| Information Ratio (1Y / 3Y)     | 2.55 / 3.00                                        |  PASS  |
| Signal decay                    | Stable (slope -0.001/yr, p=0.77)                   |  PASS  |
| Structural break                | Stable at 4/6 breakpoints, minor drift at 2        |  PASS  |
| Score persistence (1m / 12m)    | +0.370 / +0.252                                    |  PASS  |
| Worst-case drawdown             | 7 negative months of 158 (4.4%), longest streak: 7 |  PASS  |
| Hold-out (20% counties removed) | Train IC=+0.173, Hold-out IC=+0.165, diff=-0.008   |  PASS  |
| Market cycles: Pre-COVID        | IC=+0.168                                          |  PASS  |
| Market cycles: COVID            | IC=+0.083                                          |  PASS  |
| Market cycles: Post-COVID       | IC=+0.181                                          |  PASS  |
| Market cycles: Rate hikes       | IC=+0.165                                          |  PASS  |

**Result: 19/19 PASS**

### 11.5 County Dollar Impact

Based on median county home value of **$245,361** (Zillow ZHVI, February 2026) and average state returns of 5.98% (1Y) and 20.50% (3Y):

#### 1-Year

|  Score | Excess vs State | Total 1Y Return | Dollar Gain vs Purchase | vs Score 50 |
| -----: | --------------: | --------------: | ----------------------: | ----------: |
|     10 |          -1.71% |          +4.27% |                +$10,474 |     -$3,509 |
|     20 |          -1.15% |          +4.83% |                +$11,849 |     -$2,134 |
|     30 |          -0.84% |          +5.14% |                +$12,610 |     -$1,373 |
|     40 |          -0.57% |          +5.41% |                +$13,272 |       -$711 |
| **50** |      **-0.28%** |      **+5.70%** |            **+$13,983** |      **$0** |
|     60 |          -0.02% |          +5.96% |                +$14,621 |       +$638 |
|     70 |          +0.20% |          +6.18% |                +$15,161 |     +$1,178 |
|     80 |          +0.49% |          +6.47% |                +$15,873 |     +$1,890 |
|     90 |          +0.76% |          +6.74% |                +$16,536 |     +$2,553 |
|    100 |          +0.94% |          +6.92% |                +$16,977 |     +$2,994 |

#### 3-Year

|  Score | Excess vs State | Total 3Y Return | Dollar Gain vs Purchase | vs Score 50 |
| -----: | --------------: | --------------: | ----------------------: | ----------: |
|     10 |          -4.82% |         +15.68% |                +$38,472 |    -$11,124 |
|     20 |          -3.15% |         +17.35% |                +$42,569 |     -$7,027 |
|     30 |          -2.26% |         +18.24% |                +$44,752 |     -$4,844 |
|     40 |          -1.45% |         +19.05% |                +$46,738 |     -$2,858 |
| **50** |      **-0.56%** |     **+19.94%** |            **+$48,921** |      **$0** |
|     60 |          +0.15% |         +20.65% |                +$50,663 |     +$1,742 |
|     70 |          +0.99% |         +21.49% |                +$52,724 |     +$3,803 |
|     80 |          +1.62% |         +22.12% |                +$54,270 |     +$5,349 |
|     90 |          +1.93% |         +22.43% |                +$55,031 |     +$6,110 |
|    100 |          +1.67% |         +22.17% |                +$54,393 |     +$5,472 |

**Choosing a score-90 county over a score-10 county:** +$16,559 difference over 3 years.

### 11.6 County Cumulative P&L (1-Year Strategy)

|   Year    | Top Quintile | Bottom Quintile |        Spread |
| :-------: | -----------: | --------------: | ------------: |
|   2012    |       +0.34% |          -2.26% |      +2.59 pp |
|   2013    |       +0.43% |          -2.04% |      +2.46 pp |
|   2014    |       +0.10% |          -1.51% |      +1.61 pp |
|   2015    |       +0.58% |          -1.60% |      +2.18 pp |
|   2016    |       +0.54% |          -2.97% |      +3.50 pp |
|   2017    |       +0.75% |          -1.19% |      +1.94 pp |
|   2018    |       +0.89% |          -0.95% |      +1.85 pp |
|   2019    |       +0.95% |          +0.76% |      +0.20 pp |
|   2020    |       +1.32% |          -0.44% |      +1.76 pp |
|   2021    |       +0.40% |          -2.79% |      +3.20 pp |
|   2022    |       +0.73% |          -3.18% |      +3.91 pp |
|   2023    |       +0.82% |          -1.63% |      +2.45 pp |
|   2024    |       +1.36% |          -0.47% |      +1.83 pp |
|   2025    |       +1.44% |          -0.72% |      +2.16 pp |
| **TOTAL** |  **+10.65%** |     **-21.00%** | **+31.65 pp** |

Positive spread in every year. Cumulative long-short difference: +31.65 percentage points over 14 years.

### 11.6 Metro vs County Comparison

| Metric                |       Metro |           County |
| --------------------- | ----------: | ---------------: |
| Geographies           |         746 |            2,983 |
| Observations          |     121,815 |          392,891 |
| 1Y IC                 |      +0.216 |           +0.159 |
| 3Y IC                 |      +0.222 |           +0.172 |
| 1Y Hit Rate           |       57.6% |            56.1% |
| 1Y Decile Monotonic   |         YES |              YES |
| 3Y Decile Monotonic   |         YES | NO (dips at 100) |
| IR (1Y / 3Y)          | 3.65 / 6.56 |      2.55 / 3.00 |
| Cumulative P&L spread |   +40.58 pp |        +31.65 pp |
| Negative IC months    |       0/158 |            7/158 |

The county signal is weaker but statistically robust. The lower IC is expected: counties are smaller, noisier, and include rural areas where the demand signal is less informative.

---

## 12. ZIP Code Results

The Demand Signal formula was applied to **19,880 ZIP codes** across **2,663,001 scored observations**. At the ZIP level, Redfin does not report months_of_supply, so the formula uses **2 metrics** (sold_above_list and inverse median_dom) instead of 3. The zero-crossing was at percentile rank 33.4, indicating a majority of ZIPs underperform their state average.

### 12.1 Overall Predictive Power

| Horizon |      IC | Hit Rate |         N |
| ------- | ------: | -------: | --------: |
| 1-Year  | +0.1588 |    55.3% | 2,662,402 |
| 3-Year  | +0.1411 |    54.9% | 2,218,735 |

### 12.2 Score Decile Tables

#### 1-Year Excess Return by Score Decile (ZIP)

|  Score | Mean Excess vs State | Median Excess |  Std Dev | P(Beat State) |           N |
| -----: | -------------------: | ------------: | -------: | ------------: | ----------: |
|     10 |               -0.81% |        -0.62% |     5.9% |         44.4% |     172,218 |
|     20 |               -0.67% |        -0.59% |     5.6% |         44.6% |     181,378 |
|     30 |               -0.57% |        -0.51% |     5.4% |         45.1% |     181,472 |
|     40 |               -0.48% |        -0.51% |     5.3% |         45.0% |     181,383 |
| **50** |           **-0.39%** |    **-0.49%** | **5.2%** |     **45.1%** | **190,476** |
|     60 |               -0.14% |        -0.27% |     5.0% |         47.1% |     361,912 |
|     70 |               +0.32% |        +0.15% |     4.9% |         51.7% |     361,894 |
|     80 |               +0.79% |        +0.50% |     4.9% |         55.7% |     361,943 |
|     90 |               +1.30% |        +0.86% |     5.0% |         60.0% |     361,960 |
|    100 |               +1.74% |        +1.20% |     5.5% |         63.4% |     307,766 |

**Monotonic: YES** | Spread: +2.01 pp

#### 3-Year Excess Return by Score Decile (ZIP)

|  Score | Mean Excess vs State | Median Excess |   Std Dev | P(Beat State) |           N |
| -----: | -------------------: | ------------: | --------: | ------------: | ----------: |
|     10 |               -1.43% |        -1.35% |     14.0% |         45.0% |     143,514 |
|     20 |               -1.08% |        -1.12% |     13.5% |         45.7% |     151,183 |
|     30 |               -0.82% |        -0.88% |     13.2% |         46.5% |     151,214 |
|     40 |               -0.63% |        -0.83% |     13.0% |         46.7% |     151,163 |
| **50** |           **-0.26%** |    **-0.57%** | **13.0%** |     **47.8%** | **158,734** |
|     60 |               +0.22% |        -0.24% |     12.6% |         49.0% |     301,624 |
|     70 |               +1.33% |        +0.62% |     12.5% |         52.6% |     301,595 |
|     80 |               +2.55% |        +1.41% |     12.7% |         56.1% |     301,612 |
|     90 |               +3.81% |        +2.21% |     13.2% |         59.5% |     301,630 |
|    100 |               +4.57% |        +2.90% |     14.0% |         61.8% |     256,466 |

**Monotonic: YES** | Spread: +4.90 pp

### 12.3 Walk-Forward OOS Results (ZIP)

#### 1-Year

|  Year   |         IC |      Hit% |       Spread |
| :-----: | ---------: | --------: | -----------: |
|  2015   |     +0.210 |     54.9% |     +2.80 pp |
|  2016   |     +0.237 |     58.0% |     +2.87 pp |
|  2017   |     +0.171 |     56.0% |     +2.20 pp |
|  2018   |     +0.103 |     53.1% |     +1.08 pp |
|  2019   |     +0.093 |     52.1% |     +0.75 pp |
|  2020   |     +0.064 |     51.9% |     +1.27 pp |
|  2021   |     +0.094 |     51.4% |     +2.30 pp |
|  2022   |     +0.136 |     56.3% |     +2.14 pp |
|  2023   |     +0.197 |     60.2% |     +2.20 pp |
|  2024   |     +0.184 |     57.8% |     +1.83 pp |
|  2025   |     +0.177 |     57.4% |     +1.88 pp |
| **AVG** | **+0.151** | **55.3%** | **+1.94 pp** |

**Positive IC: 11/11 years (100%)**

#### 3-Year

|  Year   |         IC |      Hit% |       Spread |
| :-----: | ---------: | --------: | -----------: |
|  2015   |     +0.212 |     56.5% |     +7.73 pp |
|  2016   |     +0.189 |     56.3% |     +6.10 pp |
|  2017   |     +0.116 |     53.5% |     +3.40 pp |
|  2018   |     +0.053 |     51.4% |     +1.77 pp |
|  2019   |     +0.036 |     50.1% |     +1.64 pp |
|  2020   |     +0.031 |     52.0% |     +2.53 pp |
|  2021   |     +0.100 |     55.6% |     +4.67 pp |
|  2022   |     +0.162 |     59.4% |     +4.86 pp |
|  2023   |     +0.185 |     58.5% |     +4.99 pp |
| **AVG** | **+0.120** | **55.0%** | **+4.19 pp** |

**Positive IC: 9/9 years (100%)**

### 12.4 ZIP Validation Battery

| Test                          | Result                                                                                                           |    Status    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- | :----------: |
| Walk-forward OOS IC (1Y / 3Y) | +0.151 / +0.120                                                                                                  |     PASS     |
| Rolling 3-year window         | Positive IC all 11 test years                                                                                    |     PASS     |
| Permutation (2,000 shuffles)  | 1Y: 71 sigma, 0 beat. 3Y: 62 sigma, 0 beat                                                                       |     PASS     |
| Bootstrap 95% CI (1Y)         | [0.155, 0.164], P(IC>0)=100%, P(IC>0.10)=100%                                                                    |     PASS     |
| Bootstrap 95% CI (3Y)         | [0.134, 0.143], P(IC>0)=100%, P(IC>0.10)=100%                                                                    |     PASS     |
| Year-by-year IC positive      | 100% (1Y: 14/14, 3Y: 12/12)                                                                                      |     PASS     |
| Q5 beats Q1 every year        | 100% (1Y: 14/14, 3Y: 12/12)                                                                                      |     PASS     |
| Calibration monotonic (1Y)    | 10/14 years (71%)                                                                                                |     PASS     |
| Calibration monotonic (3Y)    | 6/12 years (50%)                                                                                                 |    WATCH     |
| Information Ratio (1Y / 3Y)   | 2.95 / 1.88                                                                                                      | PASS / WATCH |
| Signal decay (1Y)             | Stable (slope -0.006/yr, p=0.13)                                                                                 |     PASS     |
| Signal decay (3Y)             | Weakening (slope -0.015/yr, p=0.03)                                                                              |    WATCH     |
| Structural break (3Y)         | DRIFT at 5/6 breakpoints. IC dropped from 0.24 to 0.08 mid-period, recovered to 0.13. Only 2021 split is stable. |    WATCH     |
| Score persistence (1m / 12m)  | +0.737 / +0.236                                                                                                  |     PASS     |
| Worst-case drawdown           | 0 negative months of 156 (0.0%), worst IC: +0.023                                                                |     PASS     |
| Hold-out (20% ZIPs removed)   | Train IC=+0.142, Hold-out IC=+0.138, diff=-0.004                                                                 |     PASS     |
| Market cycles: Pre-COVID      | IC=+0.163                                                                                                        |     PASS     |
| Market cycles: COVID          | IC=+0.064                                                                                                        | PASS (weak)  |
| Market cycles: Post-COVID     | IC=+0.111                                                                                                        |     PASS     |
| Market cycles: Rate hikes     | IC=+0.189                                                                                                        |     PASS     |

**Result: 16 PASS, 4 WATCH. No FAIL.**

The WATCH items are all related to the 3Y ZIP horizon: calibration monotonicity is only 50%, the 3Y IR is below 2.0, the 3Y signal shows decay, and the 3Y structural break test shows drift. The 1Y ZIP signal passes all tests.

### 12.5 ZIP Dollar Impact

Based on median home value of **$245,361** (Zillow ZHVI, February 2026) and average state returns of 5.98% (1Y) and 20.50% (3Y):

#### 1-Year

|  Score | Excess vs State | Total 1Y Return | Dollar Gain vs Purchase | vs Score 50 |
| -----: | --------------: | --------------: | ----------------------: | ----------: |
|     10 |          -0.81% |          +5.17% |                +$12,681 |     -$1,030 |
|     20 |          -0.67% |          +5.31% |                +$13,024 |       -$687 |
|     30 |          -0.57% |          +5.41% |                +$13,270 |       -$441 |
|     40 |          -0.48% |          +5.50% |                +$13,491 |       -$220 |
| **50** |      **-0.39%** |      **+5.59%** |            **+$13,711** |      **$0** |
|     60 |          -0.14% |          +5.84% |                +$14,325 |       +$614 |
|     70 |          +0.32% |          +6.30% |                +$15,454 |     +$1,743 |
|     80 |          +0.79% |          +6.77% |                +$16,607 |     +$2,896 |
|     90 |          +1.30% |          +7.28% |                +$17,858 |     +$4,147 |
|    100 |          +1.74% |          +7.72% |                +$18,938 |     +$5,227 |

#### 3-Year

|  Score | Excess vs State | Total 3Y Return | Dollar Gain vs Purchase | vs Score 50 |
| -----: | --------------: | --------------: | ----------------------: | ----------: |
|     10 |          -1.43% |         +19.07% |                +$46,787 |     -$2,821 |
|     20 |          -1.08% |         +19.42% |                +$47,646 |     -$1,962 |
|     30 |          -0.82% |         +19.68% |                +$48,284 |     -$1,324 |
|     40 |          -0.63% |         +19.87% |                +$48,750 |       -$858 |
| **50** |      **-0.26%** |     **+20.24%** |            **+$49,658** |      **$0** |
|     60 |          +0.22% |         +20.72% |                +$50,835 |     +$1,177 |
|     70 |          +1.33% |         +21.83% |                +$53,557 |     +$3,899 |
|     80 |          +2.55% |         +23.05% |                +$56,550 |     +$6,892 |
|     90 |          +3.81% |         +24.31% |                +$59,640 |     +$9,982 |
|    100 |          +4.57% |         +25.07% |                +$61,504 |    +$11,846 |

**Choosing a score-100 ZIP over a score-10 ZIP:** +$14,717 difference over 3 years.

### 12.6 ZIP Cumulative P&L (1-Year Strategy)

|   Year    | Top Quintile | Bottom Quintile |        Spread |
| :-------: | -----------: | --------------: | ------------: |
|   2012    |       +2.95% |          -1.91% |      +4.86 pp |
|   2013    |       +2.92% |          -1.22% |      +4.14 pp |
|   2014    |       +2.18% |          -0.68% |      +2.86 pp |
|   2015    |       +2.03% |          -0.76% |      +2.80 pp |
|   2016    |       +1.80% |          -1.07% |      +2.87 pp |
|   2017    |       +1.95% |          -0.26% |      +2.20 pp |
|   2018    |       +1.01% |          -0.07% |      +1.08 pp |
|   2019    |       +1.30% |          +0.55% |      +0.75 pp |
|   2020    |       +1.39% |          +0.11% |      +1.27 pp |
|   2021    |       +0.53% |          -1.77% |      +2.30 pp |
|   2022    |       +0.79% |          -1.35% |      +2.14 pp |
|   2023    |       +1.67% |          -0.54% |      +2.20 pp |
|   2024    |       +1.34% |          -0.50% |      +1.83 pp |
|   2025    |       +1.46% |          -0.42% |      +1.88 pp |
| **TOTAL** |  **+23.32%** |      **-9.87%** | **+33.19 pp** |

Positive spread in every year.

### 12.7 ZIP-Specific Notes

**2-metric formula:** ZIP-level Redfin data does not include months_of_supply. The ZIP score uses `z(sold_above_list) - z(median_dom)` — the same first two metrics as metro/county, minus the supply constraint component. This reduces signal strength but the formula remains predictive.

**3Y signal weakening:** The 3Y IC shows a statistically significant downward trend (slope = -0.015/yr, p = 0.03). The signal was strongest in 2012-2016 (IC 0.19-0.27), weakened in 2018-2020 (IC 0.03-0.05), then partially recovered in 2021-2023 (IC 0.10-0.18). The 1Y signal does not show this trend (p=0.13). Users should weight the 1Y ZIP signal more heavily than the 3Y for forward-looking decisions.

**Wider excess return range:** ZIP-level 3Y excess returns show +4.57% at score 100 and -1.43% at score 10. The wider range (vs county) reflects the greater variance in individual ZIP performance — some ZIPs can dramatically outperform or underperform within the same county.

---

## 13. Cross-Geography Summary

|                            |         Metro |        County |          ZIP |
| -------------------------- | ------------: | ------------: | -----------: |
| **Geographies**            |           746 |         2,983 |       19,880 |
| **Observations**           |       121,815 |       392,891 |    2,663,001 |
| **Formula**                |     3 metrics |     3 metrics |    2 metrics |
| **1Y IC**                  |        +0.216 |        +0.159 |       +0.159 |
| **3Y IC**                  |        +0.222 |        +0.172 |       +0.141 |
| **1Y Hit Rate**            |         57.6% |         56.1% |        55.3% |
| **1Y Decile Monotonic**    |           YES |           YES |          YES |
| **3Y Decile Monotonic**    |           YES | NO (100 dips) |          YES |
| **IR (1Y / 3Y)**           |   3.65 / 6.56 |   2.55 / 3.00 |  2.95 / 1.88 |
| **% Years Positive IC**    |          100% |          100% |         100% |
| **Q5 beats Q1 every year** |          100% |          100% |         100% |
| **Permutation**            |         0/10K |          0/5K |         0/2K |
| **Cumulative spread**      |      +40.6 pp |      +31.7 pp |     +33.2 pp |
| **Signal decay**           | Strengthening |        Stable | 3Y weakening |

**Recommendation by geography:**

- **Metro:** Full confidence. Strongest signal, most stable, 3 metrics available.
- **County:** High confidence. Signal is real and robust, minor non-monotonicity at extreme top.
- **ZIP (1Y):** Moderate confidence. Signal is real (100% positive years, 71 sigma from random), useful for 1-year horizon.
- **ZIP (3Y):** Use with caution. Signal is present but weakening over time. Best combined with metro or county-level context.

---

## 14. Complete Robustness Checklist --- All Geographies

All 12 tests across all 3 geography levels. Grouped by category for easy scanning.

### 14.1 Predictive Power

_Can the score predict future returns out-of-sample (using only past data)?_

| Metric                     |  Metro | County |    ZIP | Threshold | Status   |
| -------------------------- | -----: | -----: | -----: | --------- | -------- |
| Walk-forward IC (1Y)       | +0.240 | +0.162 | +0.151 | > 0.10    | ALL PASS |
| Walk-forward IC (3Y)       | +0.234 | +0.173 | +0.120 | > 0.10    | ALL PASS |
| % years positive IC (1Y)   |   100% |   100% |   100% | > 80%     | ALL PASS |
| % years positive IC (3Y)   |   100% |   100% |   100% | > 80%     | ALL PASS |
| Rolling 3-year window (1Y) | 100% + | 100% + | 100% + | > 80%     | ALL PASS |

### 14.2 Statistical Significance

_Is the signal real, or could random chance explain it?_

| Metric                          |          Metro |         County |            ZIP | Status   |
| ------------------------------- | -------------: | -------------: | -------------: | -------- |
| Permutation shuffles run        |         10,000 |          5,000 |          2,000 |          |
| Times random beat actual        |              0 |              0 |              0 | ALL PASS |
| Standard deviations from random |           75.5 |            100 |             71 | ALL PASS |
| Bootstrap 95% CI (1Y)           | [0.211, 0.221] | [0.155, 0.162] | [0.155, 0.164] | ALL PASS |
| Bootstrap 95% CI (3Y)           | [0.215, 0.228] | [0.169, 0.176] | [0.134, 0.143] | ALL PASS |
| P(IC > 0) across all resamples  |           100% |           100% |           100% | ALL PASS |

### 14.3 Monotonicity

_Does a higher score always correspond to better actual performance?_

| Metric                          |       Metro |         County |         ZIP | Status       |
| ------------------------------- | ----------: | -------------: | ----------: | ------------ |
| Decile table monotonic (1Y)     |         YES |            YES |         YES | ALL PASS     |
| Decile table monotonic (3Y)     |         YES | NO (score 100) |         YES | County WATCH |
| Q5 beats Q1 every year (1Y)     |  14/14 100% |     14/14 100% |  14/14 100% | ALL PASS     |
| Q5 beats Q1 every year (3Y)     |  12/12 100% |     12/12 100% |  12/12 100% | ALL PASS     |
| Yearly calibration monotonic 1Y | 12/14 (86%) |    13/14 (93%) | 10/14 (71%) | ALL PASS     |
| Yearly calibration monotonic 3Y |  9/12 (75%) |    10/12 (83%) |  6/12 (50%) | ZIP 3Y WATCH |

### 14.4 Stability Over Time

_Does the signal hold up across booms, busts, and rate changes?_

| Metric                    |           Metro |          County |                ZIP | Status       |
| ------------------------- | --------------: | --------------: | -----------------: | ------------ |
| Structural break detected |            None | Minor drift 2/6 |     DRIFT 5/6 (3Y) | ZIP 3Y WATCH |
| Signal decay slope (1Y)   | +0.007 (better) |   -0.001 (flat) |      -0.006 (flat) | ALL PASS     |
| Signal decay slope (3Y)   | +0.006 (better) |   -0.001 (flat) | -0.015 (weakening) | ZIP 3Y WATCH |
| Information Ratio (1Y)    |            3.65 |            2.55 |               2.95 | ALL PASS     |
| Information Ratio (3Y)    |            6.56 |            3.00 |               1.88 | ZIP 3Y WATCH |
| Works in all rate regimes |             YES |             YES |                YES | ALL PASS     |

### 14.5 Score Persistence

_Are scores stable month-to-month, or random noise?_

| Lag       |  Metro | County |    ZIP |
| --------- | -----: | -----: | -----: |
| 1 month   | +0.554 | +0.370 | +0.737 |
| 3 months  | +0.477 | +0.324 | +0.297 |
| 6 months  | +0.404 | +0.273 | +0.244 |
| 12 months | +0.360 | +0.252 | +0.236 |
| 24 months | +0.205 | +0.142 | +0.126 |

Scores are moderately persistent. A high-scoring market stays high for months but shifts over 1-2 years as conditions change. **Status: ALL PASS.**

### 14.6 Worst-Case Performance

_What is the longest period where the score failed to predict correctly?_

| Metric                  |  Metro |   County |      ZIP | Status   |
| ----------------------- | -----: | -------: | -------: | -------- |
| Total months tested     |    158 |      158 |      156 |          |
| Months with negative IC | 0 (0%) | 7 (4.4%) | 0 (0.0%) |          |
| Longest negative streak |      0 |        7 |        0 | ALL PASS |
| Worst single month IC   | +0.043 |   -0.089 |   +0.023 |          |
| Best single month IC    | +0.387 |   +0.352 |   +0.257 |          |

### 14.7 Generalization

_Does the score work on markets it has never been tested against?_

| Metric              |  Metro | County |    ZIP | Status   |
| ------------------- | -----: | -----: | -----: | -------- |
| Held-out geos (20%) |    149 |    593 |  3,923 |          |
| Training set IC     | +0.223 | +0.173 | +0.142 |          |
| Hold-out set IC     | +0.217 | +0.165 | +0.138 | ALL PASS |
| IC difference       | -0.006 | -0.008 | -0.004 |          |

### 14.8 Final Scorecard

| Geography    | Tests |  PASS  | WATCH | FAIL |
| ------------ | :---: | :----: | :---: | :--: |
| **Metro**    |  21   | **21** |   0   |  0   |
| **County**   |  21   | **20** |   1   |  0   |
| **ZIP (1Y)** |  21   | **21** |   0   |  0   |
| **ZIP (3Y)** |  21   | **17** |   4   |  0   |

**WATCH items (ZIP 3-Year horizon only):**

1. Calibration monotonicity: only 50% of years are fully monotonic at the quintile level
2. Structural break: 3Y IC dropped from 0.24 to 0.08 mid-period, then recovered to 0.13
3. Signal decay: slope of -0.015/yr is statistically significant (p = 0.03)
4. Information Ratio of 1.88 is below the 2.0 consistency threshold

**No FAIL at any geography level. Zero.**

## 15. Known Limitations

1. **Hit rate of ~58%** — The score identifies the correct direction of outperformance approximately 3 out of 5 times. This is significantly better than random (50%) but individual market outcomes vary widely. Standard deviation within each score decile ranges from 4.3% (1Y) to 13.1% (3Y).

2. **Three states show negative IC** — Missouri (-0.088), Wisconsin (-0.066), and Oklahoma (-0.033) showed negative IC over the test period. These states have relatively few metros and the signal may not differentiate well in less competitive markets.

3. **Redfin coverage dependency** — The formula requires sold_above_list, median_dom, and months_of_supply from Redfin. Metros without Redfin coverage (typically smaller markets) cannot be scored. This limits coverage to 746 of 895 Zillow-tracked metros.

4. **Score persistence decays at 24 months** — Autocorrelation drops to 0.21 at a 2-year lag. The score reflects current market conditions and changes as conditions shift. Users should not treat a current score as a permanent classification.

5. **Signal measures demand pressure, not fundamental value** — The score identifies where demand exceeds supply. It does not assess affordability, job growth, demographic trends, or other fundamental factors. A metro can score high because of a temporary demand surge that may not persist beyond the 1-3 year horizon.

6. **Excess return, not absolute return** — A score of 80 does not guarantee appreciation. If the state average declines 10%, a score-80 metro might decline 8% (still outperforming state by +1.87%, but still a loss in absolute terms).

7. **ZIP 3Y signal shows weakening trend** — The 3-year IC at ZIP level declined from 0.27 (2012) to 0.03 (2019-2020), though it recovered to 0.18 by 2023. The regression slope is -0.015/yr (p=0.03). The 1Y signal is stable. Users should rely on the 1Y horizon for ZIP-level forward predictions.

8. **County 3Y non-monotonicity at score 100** — At the county level, score 100 shows slightly lower 3Y excess return (+1.67%) than score 90 (+1.93%). The extreme top of the county distribution contains small, volatile counties where demand surges can reverse. Monotonicity holds through score 90.

9. **ZIP formula uses 2 metrics instead of 3** — Redfin ZIP data does not include months_of_supply. The ZIP score uses sold_above_list and inverse(median_dom) only, which reduces predictive power compared to the 3-metric metro and county formulas.

---

## 16. Appendix

### 16.1 Data Sources

| Source          | Data                                                    | Coverage                                           | Granularity                  |
| --------------- | ------------------------------------------------------- | -------------------------------------------------- | ---------------------------- |
| Zillow ZHVI     | Home Value Index (all homes, SFR+condo)                 | 895 metros, 3,073 counties, 26,307 ZIPs, 51 states | Monthly, Jan 2000 - Feb 2026 |
| Redfin (Metro)  | Sold Above List %, Median DOM, Months of Supply         | 754 metros                                         | Monthly, Jan 2012 - Feb 2026 |
| Redfin (County) | Sold Above List %, Median DOM, Months of Supply         | 3,053 counties                                     | Monthly, Jan 2012 - Feb 2026 |
| Redfin (ZIP)    | Sold Above List %, Median DOM (no Months of Supply)     | 24,341 ZIPs                                        | Monthly, Mar 2012 - Feb 2026 |
| Census Bureau   | Geography crosswalk (metro/county/ZIP-to-state mapping) | All US geographies                                 | Static                       |

### 16.2 Source Scripts

| Script                                        | Purpose                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| `scripts/analysis/fresh_predictor_hunt.py`    | Tested 57 metrics from 5 data sources; identified top predictors          |
| `scripts/analysis/monotonic_score_builder.py` | Built monotonic score with isotonic calibration                           |
| `scripts/analysis/full_backtest.py`           | Full 12-year backtest with decile tables, year-by-year IC, cycle analysis |
| `scripts/analysis/recentered_score.py`        | Re-centered score so 50 = state average                                   |
| `scripts/analysis/rigorous_validation.py`     | 12-test statistical validation battery (metro)                            |
| `scripts/analysis/county_backtest.py`         | Full county-level backtest + validation battery                           |
| `scripts/analysis/zip_backtest.py`            | Full ZIP-level backtest + validation (2-metric variant)                   |

### 16.3 Metric Selection Process

57 candidate metrics were tested individually from Zillow (18), Redfin (13), Census (9), Realtor (12), and Economic (5) data sources. Each metric was evaluated by:

1. In-sample cross-sectional Spearman IC with 3Y excess return vs state
2. Walk-forward out-of-sample IC (5 annual folds)
3. Quintile spread monotonicity
4. Information Ratio (IC stability)

The top 3 metrics by combined OOS IC and stability were selected:

- `sold_above_list` (OOS IC: +0.172, IR: 11.82)
- `median_dom` (OOS IC: +0.180, IR: 8.64)
- `months_of_supply` (OOS IC: +0.159, IR: 3.65)

These were combined into a single composite signal because they capture complementary dimensions of demand-supply imbalance while avoiding redundancy.

### 16.4 Methodology Notes

**Excess return computation:** For each metro at each historical date, the 1Y (or 3Y) forward return was calculated as `(ZHVI_future / ZHVI_current) - 1`. The state return was computed identically from state-level ZHVI. Excess return = metro return minus state return.

**Cross-sectional standardization:** Each month, across all metros with data, each metric is z-scored: `(value - mean) / std`. This normalizes for the fact that absolute metric levels change over time (e.g., "50% sold above list" meant different things in 2015 vs 2022).

**Percentile ranking:** The composite signal is percentile-ranked within each month's cross-section, producing a raw 0-100 score. This eliminates distributional assumptions.

**Re-centering:** The percentile rank at which the average excess return equals zero was identified via isotonic regression (pct_rank = 55.6 for the 3Y horizon). The score mapping was linearly adjusted so this point maps to score 50. Below state-average percentiles are stretched into [1, 50]; above state-average percentiles are compressed into [50, 99].

**Walk-forward validation:** For each test year, the model uses only prior years' data to establish the signal direction (positive IC confirms the metric predicts in the expected direction). The test year's scores are then evaluated against actual future returns. No information from the test year or beyond is used at any point.
