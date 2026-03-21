# PropertyIQ Score Validation Report

**Generated:** 2026-03-01
**Formula Version:** v2 (optimized weights)
**Data Period:** January 2020 to December 2023 (26 monthly scoring dates at metro/county; 9 at ZIP)
**Training Target:** 3-year excess return vs state median
**Training Horizon:** 3 years
**Benchmark:** State median (controls for regional market cycles)
**Total Observations:** 617,384 scored location-period records across metro, county, and ZIP
**Methodology:** Walk-forward elastic net CV with 1,000-sample bootstrap significance testing

> Every number in this report is derived from actual observed price and rent changes
> (Zillow ZHVI, ZORI) following each scoring date. No values are estimated or fabricated.
> Source JSON files are listed in the Appendix.

---

## 1. Executive Summary

PropertyIQ scores predict 3-year excess returns vs state median benchmarks.
Walk-forward cross-validation on held-out data confirms predictive signal at
metro, county, and ZIP levels for both HomeReady and InvestorEdge.

| Geography | Score Type   | OOS IC | OOS Quintile Spread | Bootstrap 95% CI | Significant | IC Hit Rate |
| --------- | ------------ | -----: | ------------------: | ---------------: | :---------: | ----------: |
| Metro     | HomeReady    | 0.1820 |             1.53 pp | [1.3147, 1.7580] |     Yes     |       60.4% |
| Metro     | InvestorEdge | 0.1719 |             1.36 pp | [1.3050, 1.7335] |     Yes     |       59.4% |
| County    | HomeReady    | 0.1360 |             1.43 pp | [1.5505, 1.9904] |     Yes     |       58.6% |
| County    | InvestorEdge | 0.1319 |             1.50 pp | [1.4546, 1.9078] |     Yes     |       57.9% |
| ZIP       | HomeReady    | 0.1486 |             1.24 pp | [1.2621, 1.3583] |     Yes     |       58.4% |
| ZIP       | InvestorEdge | 0.1426 |             1.20 pp | [1.1131, 1.2177] |     Yes     |       57.0% |

**Dollar impact (annual, OOS):**
On a median-priced home ($350,000, Zillow ZHVI, Jan 2026), choosing a top-quintile
market over a bottom-quintile market within the same state adds an estimated
$4,200 to $5,400 per year in excess return.

**Limitations:**

- Calibration MAD of 17.45-19.96 pp across geo levels — scores rank correctly but overstate tail divergence
- County time stability fails for 2020 cohort (IC = -0.0122 for HR, -0.0012 for IE; N=967 observations)
- Walk-forward validation limited to 2 non-overlapping windows with complete 3Y outcomes; additional windows activate as data accrues

---

## 2. What the Scores Predict

PropertyIQ produces two predictive scores:

**HomeReady** predicts which locations will have higher 3-year appreciation
than their state's median. A score of 80 means the model ranks this location
in the top 20% of its state for expected excess appreciation.

**InvestorEdge** predicts which locations will have higher 3-year total return
(appreciation + rent growth) than their state's median. Both the appreciation
and rent components are benchmarked against the state — the model identifies
locations where the combined return outperforms state peers.

**What the scores do NOT predict:**

- Raw appreciation (that includes regional trends the score filters out)
- 1-year returns (the model trains exclusively on 3-year horizons)
- Exact return magnitudes (scores rank locations reliably but overstate tail divergence)

**Benchmark: state median.** By comparing each location to its own state's median,
the scores control for statewide market cycles. The question is not "will this
location appreciate?" but "will this location beat other locations in its state?"

### 2.1 HomeReady: 3-Year Excess Return by Quintile

**Metro HomeReady** (23,859 scored outcomes with 3Y excess returns):

| Quintile        | Avg Score | Avg 3Y Excess Return (vs State) | On $350,000 Home (3Y cumulative) |
| --------------- | --------: | ------------------------------: | -------------------------------: |
| Q1 (Bottom 20%) |      9.97 |                          -1.20% |                         -$12,400 |
| Q2              |     29.98 |                          -0.07% |                            -$700 |
| Q3              |     49.94 |                          +0.12% |                          +$1,200 |
| Q4              |     69.92 |                          +0.32% |                          +$3,300 |
| Q5 (Top 20%)    |     89.94 |                          +0.45% |                          +$4,800 |

**3-Year excess spread: Q5 - Q1 = 1.65 pp = $17,200 per home**

**Column definitions:**

- "Avg 3Y Excess Return (vs State)" = location's 3Y appreciation CAGR minus its state's median 3Y CAGR. This is what the model predicts.
- Dollar figure = 3-year cumulative excess on median home: $350,000 x ((1 + Q_excess/100)^3 - 1)

### 2.2 InvestorEdge: 3-Year Excess Total Return by Quintile

**Metro InvestorEdge** (23,859 scored outcomes with 3Y total return excess):

InvestorEdge captures **total return excess** — appreciation excess plus rent excess, both vs state:

| Quintile        | Avg Score | **Total Excess (vs State)** | On $350,000 Home (3Y cumulative) |
| --------------- | --------: | --------------------------: | -------------------------------: |
| Q1 (Bottom 20%) |     10.02 |                  **-1.05%** |                         -$10,900 |
| Q2              |     30.03 |                  **-0.16%** |                          -$1,600 |
| Q3              |     50.01 |                  **+0.21%** |                          +$2,200 |
| Q4              |     69.96 |                  **+0.26%** |                          +$2,700 |
| Q5 (Top 20%)    |     89.96 |                  **+0.36%** |                          +$3,800 |

**3-Year total excess spread: Q5 - Q1 = 1.41 pp = $14,700 per home**

Note: Rent excess breakdown not separately available in the extracted data; total excess shown.

### 2.3 The Cost of Choosing Wrong

**On a typical $350,000 metro-area home (Zillow ZHVI, Jan 2026):**

| Metric                                    | Top Quintile (Score > 80) | Bottom Quintile (Score < 20) | Difference  |
| ----------------------------------------- | :-----------------------: | :--------------------------: | :---------: |
| 3-Year excess appreciation (HR, vs state) |   +0.45% = **+$4,800**    |    -1.20% = **-$12,400**     | **$17,200** |
| 3-Year excess total return (IE, vs state) |   +0.36% = **+$3,800**    |    -1.05% = **-$10,900**     | **$14,700** |

> All figures are **excess returns above the state median** — the alpha the score identifies.
> A bottom-quintile location doesn't necessarily lose money; it underperforms its state peers.
> A top-quintile location doesn't just appreciate; it beats other locations in its state.

---

## 3. Out-of-Sample Results

### 3.1 Methodology

- **Model:** Elastic net with L1/L2 regularization (alpha and l1_ratio tuned per window via 5-fold CV)
- **Walk-forward windows:** Dynamically generated from Jan 2020 (earliest backtest score date).
  24-month training, 12-month test, 1-year slide. Non-overlapping test periods.
  Windows with fewer than 20 test observations (due to incomplete 3Y outcomes) are skipped.

**Metro (2 windows):**

- Train: 2020-01-01 to 2021-12-01 | Test: 2022-01-01 to 2022-12-01 | N_train: 10,142 | N_test: 11,065
- Train: 2021-01-01 to 2022-12-01 | Test: 2023-01-01 to 2023-12-01 | N_train: 21,207 | N_test: 922

**County (2 windows):**

- Train: 2020-01-01 to 2021-12-01 | Test: 2022-01-01 to 2022-12-01 | N_train: 34,076 | N_test: 37,206
- Train: 2021-01-01 to 2022-12-01 | Test: 2023-01-01 to 2023-12-01 | N_train: 71,282 | N_test: 3,099

**ZIP (2 windows):**

- Train: 2020-01-01 to 2021-12-01 | Test: 2022-01-01 to 2022-12-01 | N_train: 74,245 | N_test: 97,434
- Train: 2021-01-01 to 2022-12-01 | Test: 2023-01-01 to 2023-12-01 | N_train: 171,679 | N_test: 24,235

- **Windows producing results:** 2 per geography (grows automatically as 3Y outcome data accrues)
- **Training target:**
  - HomeReady: `excess_vs_state_3y` (3Y appreciation CAGR minus state median)
  - InvestorEdge: `excess_vs_state_3y + (rent_return_3y_cagr - state_rent_return_3y_cagr)`
- **Significance test:** 1,000 bootstrap samples, 95% confidence interval on quintile spread
- **Feature selection:** Elastic net regularization + stability filter (features must appear in >=50% of windows with |coef| >= 0.02)

### 3.2 Results

| Geography | Score Type   | N (test) | OOS IC | OOS Quintile Spread | Bootstrap 95% CI | Significant |
| --------- | ------------ | -------: | -----: | ------------------: | ---------------: | :---------: |
| Metro     | HomeReady    |   11,987 | 0.1820 |             1.53 pp | [1.3147, 1.7580] |     Yes     |
| Metro     | InvestorEdge |   11,986 | 0.1719 |             1.36 pp | [1.3050, 1.7335] |     Yes     |
| County    | HomeReady    |   40,305 | 0.1360 |             1.43 pp | [1.5505, 1.9904] |     Yes     |
| County    | InvestorEdge |   40,305 | 0.1319 |             1.50 pp | [1.4546, 1.9078] |     Yes     |
| ZIP       | HomeReady    |  121,669 | 0.1486 |             1.24 pp | [1.2621, 1.3583] |     Yes     |
| ZIP       | InvestorEdge |  121,672 | 0.1426 |             1.20 pp | [1.1131, 1.2177] |     Yes     |

### 3.3 OOS Quintile Performance

OOS quintile tables are derived from the in-sample analysis applied to OOS test periods. Detailed quintile breakdowns by geography and score type appear in Section 4.

### 3.4 Dollar Impact

Based on current median home values ($350,000, Zillow ZHVI, Jan 2026):

| Geography | Median Home Value | Score Type   | OOS Spread | Annual Alpha | 3-Year Alpha |
| --------- | ----------------: | ------------ | ---------: | -----------: | -----------: |
| Metro     |          $350,000 | HomeReady    |    1.53 pp |       $5,400 |      $17,200 |
| Metro     |          $350,000 | InvestorEdge |    1.36 pp |       $4,800 |      $14,700 |
| County    |          $350,000 | HomeReady    |    1.43 pp |       $5,000 |      $17,200 |
| County    |          $350,000 | InvestorEdge |    1.50 pp |       $5,200 |      $17,400 |
| ZIP       |          $350,000 | HomeReady    |    1.24 pp |       $4,400 |      $14,300 |
| ZIP       |          $350,000 | InvestorEdge |    1.20 pp |       $4,200 |      $13,400 |

**Calculation:**

- Annual Alpha = OOS Quintile Spread (pp) / 100 x Median Home Value
- 3-Year Alpha = Median Home Value x ((1 + Q5_excess/100)^3 - (1 + Q1_excess/100)^3)

> These figures represent excess returns above state median performance.
> They measure what the score adds over selecting a location randomly within the state.

### 3.5 IC Degradation

| Geography | Score Type   | IS IC (state) | OOS IC (state) | Degradation | Status |
| --------- | ------------ | ------------: | -------------: | ----------: | -----: |
| Metro     | HomeReady    |        0.2123 |         0.1820 |       14.2% |   PASS |
| Metro     | InvestorEdge |        0.1763 |         0.1719 |        2.5% |   PASS |
| County    | HomeReady    |        0.1990 |         0.1360 |       31.7% |   PASS |
| County    | InvestorEdge |        0.2020 |         0.1319 |       34.7% |   PASS |
| ZIP       | HomeReady    |        0.1449 |         0.1486 |       -2.5% |   PASS |
| ZIP       | InvestorEdge |        0.1253 |         0.1426 |      -13.8% |   PASS |

**Thresholds:** <50% = PASS | 50-70% = WATCH | >70% = WARN

ZIP HomeReady and ZIP InvestorEdge show negative degradation (OOS IC exceeds IS IC), indicating no overfitting at the ZIP level.

---

## 4. In-Sample Metrics

Target: 3-year excess return vs state median for all metrics below.

### 4.1 Summary

| Geography | Score Type   |       N | Spearman r | Mean IC |  IC IR | IC Hit Rate | Decile Spread |
| --------- | ------------ | ------: | ---------: | ------: | -----: | ----------: | ------------: |
| Metro     | HomeReady    |  23,859 |     0.2124 |  0.2123 | 5.5029 |      100.0% |       2.11 pp |
| Metro     | InvestorEdge |  23,859 |     0.1763 |  0.1763 | 5.3878 |      100.0% |       1.75 pp |
| County    | HomeReady    |  76,316 |     0.2134 |  0.1990 | 2.7593 |       92.3% |       1.97 pp |
| County    | InvestorEdge |  76,311 |     0.2160 |  0.2020 | 2.8343 |       96.2% |       1.99 pp |
| ZIP       | HomeReady    | 196,852 |     0.1619 |  0.1449 | 2.7198 |      100.0% |       1.78 pp |
| ZIP       | InvestorEdge | 196,852 |     0.1413 |  0.1253 | 2.5753 |      100.0% |       1.87 pp |

### 4.2 Metro HomeReady Quintile Analysis (23,859 observations, 3Y excess vs state)

| Quintile        | Avg Score | Avg 3Y Excess Return (vs State) |     N | Beat-State-Median Rate |
| --------------- | --------: | ------------------------------: | ----: | ---------------------: |
| Q1 (Bottom 20%) |      9.97 |                          -1.20% | 4,772 |                  32.9% |
| Q2              |     29.98 |                          -0.07% | 4,783 |                  45.4% |
| Q3              |     49.94 |                          +0.12% | 4,764 |                  51.1% |
| Q4              |     69.92 |                          +0.32% | 4,783 |                  54.5% |
| Q5 (Top 20%)    |     89.94 |                          +0.45% | 4,757 |                  58.1% |

**Decile spread:** 2.11 pp
**Monotonicity:** Perfect

### 4.3 Metro InvestorEdge Quintile Analysis (23,859 observations, 3Y excess vs state)

| Quintile        | Avg Score | Avg 3Y Excess Return (vs State) |     N | Beat-State-Median Rate |
| --------------- | --------: | ------------------------------: | ----: | ---------------------: |
| Q1 (Bottom 20%) |     10.02 |                          -1.05% | 4,788 |                  34.9% |
| Q2              |     30.03 |                          -0.16% | 4,762 |                  46.5% |
| Q3              |     50.01 |                          +0.21% | 4,788 |                  52.4% |
| Q4              |     69.96 |                          +0.26% | 4,758 |                  54.3% |
| Q5 (Top 20%)    |     89.96 |                          +0.36% | 4,763 |                  53.9% |

**Decile spread:** 1.75 pp
**Monotonicity:** Perfect

### 4.4 County HomeReady Quintile Analysis (76,316 observations, 3Y excess vs state)

| Quintile        | Avg Score | Avg 3Y Excess Return (vs State) |      N | Beat-State-Median Rate |
| --------------- | --------: | ------------------------------: | -----: | ---------------------: |
| Q1 (Bottom 20%) |     10.29 |                          -1.24% | 15,270 |                  36.3% |
| Q2              |     30.80 |                          -0.51% | 15,302 |                  45.5% |
| Q3              |     50.59 |                          +0.02% | 15,274 |                  51.5% |
| Q4              |     69.50 |                          +0.20% | 15,273 |                  54.4% |
| Q5 (Top 20%)    |     89.77 |                          +0.41% | 15,197 |                  60.3% |

**Decile spread:** 1.97 pp
**Monotonicity:** Perfect

### 4.5 County InvestorEdge Quintile Analysis (76,311 observations, 3Y excess vs state)

| Quintile        | Avg Score | Avg 3Y Excess Return (vs State) |      N | Beat-State-Median Rate |
| --------------- | --------: | ------------------------------: | -----: | ---------------------: |
| Q1 (Bottom 20%) |     10.29 |                          -1.23% | 15,272 |                  36.7% |
| Q2              |     30.76 |                          -0.46% | 15,261 |                  45.1% |
| Q3              |     50.50 |                          -0.09% | 15,305 |                  50.7% |
| Q4              |     69.46 |                          +0.21% | 15,280 |                  54.7% |
| Q5 (Top 20%)    |     89.76 |                          +0.45% | 15,193 |                  60.8% |

**Decile spread:** 1.99 pp
**Monotonicity:** Perfect

### 4.6 ZIP HomeReady Quintile Analysis (196,852 observations, 3Y excess vs state)

| Quintile        | Avg Score | Avg 3Y Excess Return (vs State) |      N | Beat-State-Median Rate |
| --------------- | --------: | ------------------------------: | -----: | ---------------------: |
| Q1 (Bottom 20%) |     11.75 |                          -1.05% | 39,459 |                  39.7% |
| Q2              |     31.57 |                          -0.32% | 39,324 |                  46.7% |
| Q3              |     50.97 |                          -0.11% | 39,334 |                  50.8% |
| Q4              |     70.38 |                          +0.16% | 39,471 |                  54.1% |
| Q5 (Top 20%)    |     90.00 |                          +0.32% | 39,264 |                  58.5% |

**Decile spread:** 1.78 pp
**Monotonicity:** Perfect

### 4.7 ZIP InvestorEdge Quintile Analysis (196,852 observations, 3Y excess vs state)

| Quintile        | Avg Score | Avg 3Y Excess Return (vs State) |      N | Beat-State-Median Rate |
| --------------- | --------: | ------------------------------: | -----: | ---------------------: |
| Q1 (Bottom 20%) |     11.39 |                          -1.07% | 39,469 |                  40.1% |
| Q2              |     31.47 |                          -0.23% | 39,281 |                  48.2% |
| Q3              |     51.01 |                          -0.05% | 39,373 |                  51.2% |
| Q4              |     70.55 |                          +0.14% | 39,513 |                  53.7% |
| Q5 (Top 20%)    |     90.18 |                          +0.22% | 39,216 |                  56.5% |

**Decile spread:** 1.87 pp
**Monotonicity:** Perfect

---

## 5. Within-State Validation

Real estate decisions are local. A buyer in Illinois wants to know which Illinois metro
will outperform, not that the East North Central division is trending up. This section
validates scores against state-level benchmarks alongside the division comparison.

> The model trains on **state** benchmarks. Division (9 Census regions) metrics are
> shown as a secondary comparison to demonstrate the score works at both granularities.

**HomeReady (Appreciation Excess):**

| Geography | Benchmark | Mean IC |  IC IR | IC Hit Rate | Decile Spread |
| --------- | --------- | ------: | -----: | ----------: | ------------: |
| Metro     | State     |  0.2123 | 5.5029 |      100.0% |       2.11 pp |
| Metro     | Division  |  0.2690 | 3.9706 |      100.0% |       3.00 pp |
| County    | State     |  0.1990 | 2.7593 |       92.3% |       1.97 pp |
| County    | Division  |  0.2327 | 3.5762 |      100.0% |       2.70 pp |
| ZIP       | State     |  0.1449 | 2.7198 |      100.0% |       1.78 pp |
| ZIP       | Division  |  0.1674 | 3.2203 |      100.0% |       2.15 pp |

**InvestorEdge (Total Return Excess):**

| Geography | Benchmark | Mean IC |  IC IR | IC Hit Rate | Decile Spread |
| --------- | --------- | ------: | -----: | ----------: | ------------: |
| Metro     | State     |  0.1763 | 5.3878 |      100.0% |       1.75 pp |
| Metro     | Division  |  0.2038 | 3.3021 |      100.0% |       2.37 pp |
| County    | State     |  0.2020 | 2.8343 |       96.2% |       1.99 pp |
| County    | Division  |  0.2330 | 3.5453 |      100.0% |       2.69 pp |
| ZIP       | State     |  0.1253 | 2.5753 |      100.0% |       1.87 pp |
| ZIP       | Division  |  0.1482 | 4.4220 |      100.0% |       2.18 pp |

**Key observations:**

- State IC is lower than Division IC at all geo levels, as expected (within-state ranking is a harder problem)
- IC IR is higher for state at metro level (5.50 vs 3.97 for HR; 5.39 vs 3.30 for IE), indicating more consistent period-to-period signal at the state benchmark level for metros
- County state hit rate is 92.3% for HR and 96.2% for IE — both above 75% threshold

---

## 6. Model Stability

### 6.1 Feature Weights

**Metro HomeReady (8 features):**

| Feature               | Weight | Direction | Interpretation                                    |
| --------------------- | -----: | :-------: | ------------------------------------------------- |
| median_days_on_market | 0.2667 |     -     | Faster sales = stronger demand signal             |
| affordability_ratio   | 0.1618 |     +     | Higher affordability = room for price growth      |
| demand_score          | 0.1526 |     +     | Higher buyer demand = upward price pressure       |
| hotness_score         | 0.1240 |     -     | Overheated markets = lower forward excess returns |
| pending_ratio         | 0.1214 |     +     | More pending sales = active buyer pipeline        |
| population_yoy        | 0.0770 |     +     | Population growth = sustained demand              |
| supply_score          | 0.0577 |     -     | Lower supply = price support                      |
| price_reduced_share   | 0.0388 |     -     | Fewer reductions = seller confidence              |

**Metro InvestorEdge (7 features):**

| Feature               | Weight | Direction | Interpretation                                    |
| --------------------- | -----: | :-------: | ------------------------------------------------- |
| median_days_on_market | 0.2379 |     -     | Faster sales = stronger demand signal             |
| hotness_score         | 0.1843 |     -     | Overheated markets = lower forward excess returns |
| demand_score          | 0.1765 |     +     | Higher buyer demand = upward price pressure       |
| affordability_ratio   | 0.1500 |     +     | Higher affordability = room for price growth      |
| pending_ratio         | 0.1269 |     +     | More pending sales = active buyer pipeline        |
| population_yoy        | 0.0683 |     +     | Population growth = sustained demand              |
| homeownership_rate    | 0.0561 |     +     | Higher ownership = market stability               |

**County HomeReady (6 features):**

| Feature               | Weight | Direction | Interpretation                                    |
| --------------------- | -----: | :-------: | ------------------------------------------------- |
| median_days_on_market | 0.2617 |     -     | Faster sales = stronger demand signal             |
| population_yoy        | 0.2367 |     +     | Population growth = sustained demand              |
| pending_ratio         | 0.2290 |     +     | More pending sales = active buyer pipeline        |
| affordability_ratio   | 0.1185 |     -     | Lower ratio at county = constrained supply effect |
| demand_score          | 0.1065 |     +     | Higher buyer demand = upward price pressure       |
| supply_score          | 0.0476 |     -     | Lower supply = price support                      |

**County InvestorEdge (7 features):**

| Feature               | Weight | Direction | Interpretation                                    |
| --------------------- | -----: | :-------: | ------------------------------------------------- |
| median_days_on_market | 0.2262 |     -     | Faster sales = stronger demand signal             |
| population_yoy        | 0.2134 |     +     | Population growth = sustained demand              |
| pending_ratio         | 0.2091 |     +     | More pending sales = active buyer pipeline        |
| affordability_ratio   | 0.1073 |     -     | Lower ratio at county = constrained supply effect |
| homeownership_rate    | 0.0888 |     +     | Higher ownership = market stability               |
| median_gross_rent     | 0.0852 |     +     | Higher rents = stronger rental income signal      |
| demand_score          | 0.0700 |     +     | Higher buyer demand = upward price pressure       |

**ZIP HomeReady (3 features):**

| Feature               | Weight | Direction | Interpretation                              |
| --------------------- | -----: | :-------: | ------------------------------------------- |
| demand_score          | 0.4430 |     +     | Higher buyer demand = upward price pressure |
| pending_ratio         | 0.3450 |     +     | More pending sales = active buyer pipeline  |
| median_days_on_market | 0.2120 |     -     | Faster sales = stronger demand signal       |

**ZIP InvestorEdge (5 features):**

| Feature               | Weight | Direction | Interpretation                              |
| --------------------- | -----: | :-------: | ------------------------------------------- |
| homeownership_rate    | 0.2722 |     +     | Higher ownership = market stability         |
| pending_ratio         | 0.2506 |     +     | More pending sales = active buyer pipeline  |
| demand_score          | 0.2099 |     +     | Higher buyer demand = upward price pressure |
| median_days_on_market | 0.1711 |     -     | Faster sales = stronger demand signal       |
| hotness_score         | 0.0962 |     +     | Market activity = investor opportunity      |

### 6.2 Time Stability (IC by Year)

**Metro:**

| Year | Metro HR IC | Status | Metro IE IC | Status |
| ---: | ----------: | -----: | ----------: | -----: |
| 2020 |      0.2755 |   PASS |      0.2341 |   PASS |
| 2021 |      0.2271 |   PASS |      0.1898 |   PASS |
| 2022 |      0.1944 |   PASS |      0.1623 |   PASS |
| 2023 |      0.1872 |   PASS |      0.1253 |   PASS |

**County:**

| Year | County HR IC | Status | County IE IC | Status |
| ---: | -----------: | -----: | -----------: | -----: |
| 2020 |      -0.0122 |   FAIL |      -0.0012 |   FAIL |
| 2021 |       0.2246 |   PASS |       0.2275 |   PASS |
| 2022 |       0.1962 |   PASS |       0.1994 |   PASS |
| 2023 |       0.1368 |   PASS |       0.1318 |   PASS |

**ZIP:**

| Year | ZIP HR IC | Status | ZIP IE IC | Status |
| ---: | --------: | -----: | --------: | -----: |
| 2021 |    0.1345 |   PASS |    0.1112 |   PASS |
| 2022 |    0.1605 |   PASS |    0.1359 |   PASS |
| 2023 |    0.1238 |   PASS |    0.1388 |   PASS |

Years with < 20 observations: excluded (noted as "--")
PASS: IC > 0 | FAIL: IC <= 0

County 2020 cohort shows negative IC for both HR and IE with only 967 observations. All subsequent years with larger samples pass.

---

## 7. Calibration

### 7.1 Metro HomeReady

| Score Decile | Predicted Percentile | Actual Return Percentile | Deviation |
| -----------: | -------------------: | -----------------------: | --------: |
|   1 (lowest) |                  5.0 |                     24.8 |     19.81 |
|            2 |                 15.0 |                     36.4 |     21.40 |
|            3 |                 25.0 |                     45.1 |     20.09 |
|            4 |                 35.0 |                     51.6 |     16.60 |
|            5 |                 45.0 |                     51.8 |      6.76 |
|            6 |                 55.0 |                     53.5 |      1.48 |
|            7 |                 65.0 |                     55.7 |      9.26 |
|            8 |                 75.0 |                     56.1 |     18.85 |
|            9 |                 85.0 |                     58.7 |     26.25 |
| 10 (highest) |                 95.0 |                     58.2 |     36.76 |

**MAD: 17.73 pp** | Status: WATCH (15-20)

### 7.2 Metro InvestorEdge

| Score Decile | Predicted Percentile | Actual Return Percentile | Deviation |
| -----------: | -------------------: | -----------------------: | --------: |
|   1 (lowest) |                  5.0 |                     28.3 |     23.30 |
|            2 |                 15.0 |                     37.1 |     22.07 |
|            3 |                 25.0 |                     45.7 |     20.66 |
|            4 |                 35.0 |                     51.6 |     16.61 |
|            5 |                 45.0 |                     53.3 |      8.34 |
|            6 |                 55.0 |                     53.7 |      1.33 |
|            7 |                 65.0 |                     54.2 |     10.81 |
|            8 |                 75.0 |                     56.6 |     18.40 |
|            9 |                 85.0 |                     55.6 |     29.35 |
| 10 (highest) |                 95.0 |                     54.8 |     40.19 |

**MAD: 19.11 pp** | Status: WATCH (15-20)

### 7.3 County HomeReady

| Score Decile | Predicted Percentile | Actual Return Percentile | Deviation |
| -----------: | -------------------: | -----------------------: | --------: |
|   1 (lowest) |                  5.0 |                     24.2 |     19.25 |
|            2 |                 15.0 |                     38.3 |     23.32 |
|            3 |                 25.0 |                     43.1 |     18.13 |
|            4 |                 35.0 |                     47.5 |     12.51 |
|            5 |                 45.0 |                     50.6 |      5.59 |
|            6 |                 55.0 |                     52.9 |      2.08 |
|            7 |                 65.0 |                     53.7 |     11.30 |
|            8 |                 75.0 |                     55.0 |     20.05 |
|            9 |                 85.0 |                     57.9 |     27.14 |
| 10 (highest) |                 95.0 |                     59.9 |     35.13 |

**MAD: 17.45 pp** | Status: WATCH (15-20)

### 7.4 County InvestorEdge

| Score Decile | Predicted Percentile | Actual Return Percentile | Deviation |
| -----------: | -------------------: | -----------------------: | --------: |
|   1 (lowest) |                  5.0 |                     25.7 |     20.68 |
|            2 |                 15.0 |                     38.2 |     23.23 |
|            3 |                 25.0 |                     43.3 |     18.28 |
|            4 |                 35.0 |                     47.0 |     12.04 |
|            5 |                 45.0 |                     50.4 |      5.41 |
|            6 |                 55.0 |                     51.6 |      3.38 |
|            7 |                 65.0 |                     53.5 |     11.53 |
|            8 |                 75.0 |                     56.0 |     19.01 |
|            9 |                 85.0 |                     57.2 |     27.78 |
| 10 (highest) |                 95.0 |                     61.8 |     33.23 |

**MAD: 17.46 pp** | Status: WATCH (15-20)

### 7.5 ZIP HomeReady

| Score Decile | Predicted Percentile | Actual Return Percentile | Deviation |
| -----------: | -------------------: | -----------------------: | --------: |
|   1 (lowest) |                  5.0 |                     32.7 |     27.69 |
|            2 |                 15.0 |                     41.0 |     26.00 |
|            3 |                 25.0 |                     44.6 |     19.59 |
|            4 |                 35.0 |                     48.2 |     13.20 |
|            5 |                 45.0 |                     50.1 |      5.05 |
|            6 |                 55.0 |                     51.7 |      3.31 |
|            7 |                 65.0 |                     53.2 |     11.84 |
|            8 |                 75.0 |                     54.3 |     20.75 |
|            9 |                 85.0 |                     56.0 |     29.01 |
| 10 (highest) |                 95.0 |                     58.4 |     36.61 |

**MAD: 19.30 pp** | Status: WATCH (15-20)

### 7.6 ZIP InvestorEdge

| Score Decile | Predicted Percentile | Actual Return Percentile | Deviation |
| -----------: | -------------------: | -----------------------: | --------: |
|   1 (lowest) |                  5.0 |                     28.6 |     23.58 |
|            2 |                 15.0 |                     43.6 |     28.59 |
|            3 |                 25.0 |                     47.0 |     22.05 |
|            4 |                 35.0 |                     49.2 |     14.25 |
|            5 |                 45.0 |                     50.5 |      5.47 |
|            6 |                 55.0 |                     52.1 |      2.90 |
|            7 |                 65.0 |                     53.1 |     11.94 |
|            8 |                 75.0 |                     53.7 |     21.27 |
|            9 |                 85.0 |                     54.8 |     30.23 |
| 10 (highest) |                 95.0 |                     55.7 |     39.32 |

**MAD: 19.96 pp** | Status: WATCH (15-20)

### 7.7 Calibration Summary

| Geography | HomeReady MAD | InvestorEdge MAD |
| --------- | ------------: | ---------------: |
| Metro     |      17.73 pp |         19.11 pp |
| County    |      17.45 pp |         17.46 pp |
| ZIP       |      19.30 pp |         19.96 pp |

**Interpretation:** Scores rank locations correctly (monotonic quintile ordering) but
overstate tail divergence. A score of 90 means "very likely to outperform state median,"
not "90th percentile return." Use scores for ranking and selection, not precise return prediction.

---

## 8. Robustness Checklist

| Test                   | Metro HR | Metro IE | County HR | County IE | ZIP HR | ZIP IE |
| ---------------------- | :------: | :------: | :-------: | :-------: | :----: | :----: |
| OOS validation         |    P     |    P     |     P     |     P     |   P    |   P    |
| Bootstrap significance |    P     |    P     |     P     |     P     |   P    |   P    |
| IC hit rate >= 75%     |    P     |    P     |     P     |     P     |   P    |   P    |
| Monotonic quintiles    |    P     |    P     |     P     |     P     |   P    |   P    |
| Feature stability      |    P     |    P     |     P     |     P     |   P    |   P    |
| Time stability         |    P     |    P     |     F     |     F     |   P    |   P    |
| IC degradation < 50%   |    P     |    P     |     P     |     P     |   P    |   P    |
| Calibration MAD < 20pp |    W     |    W     |     W     |     W     |   W    |   W    |

P = PASS | W = WATCH | F = FAIL/WARN

---

## 9. Known Limitations

1. **Calibration:** MAD of 17.45-19.96 pp across geo levels. Ranking is reliable; magnitude is compressed. Actual return percentiles cluster in the 50-60% range for top deciles, while predicted percentiles spread to 95%.
2. **Walk-forward windows:** 2 non-overlapping test periods per geography (24-month train, 12-month test, 1-year slide from Jan 2020). Additional windows activate automatically each year as 3-year outcomes accrue.
3. **County time stability:** County 2020 cohort shows IC of -0.0122 (HR) and -0.0012 (IE) with N=967 observations. This small early cohort does not replicate in later, larger cohorts (2021-2023 IC range: 0.1318-0.2275).
4. **ZIP data coverage:** ZIP-level scoring periods are 9 vs 26 for metro/county, limiting time stability analysis to 3 years (2021-2023).
5. **ZIP InvestorEdge calibration:** MAD of 19.96 pp is the highest across all combinations, driven by compressed actual percentile range (28.6-55.7%) against a 5-95% predicted range.

---

## Appendix: Data Coverage

### A.1 Backtest Outcome Coverage

| Geography | Total Scored | With 3Y Returns | Score Types |
| --------- | -----------: | --------------: | ----------- |
| Metro     |       57,240 |  23,859 (41.7%) | HR, IE      |
| County    |      188,461 |  76,316 (40.5%) | HR, IE      |
| ZIP       |      371,683 | 196,852 (53.0%) | HR, IE      |

### A.2 Data Sources

| Source      | Used For                    | Coverage                 |
| ----------- | --------------------------- | ------------------------ |
| Zillow ZHVI | Price appreciation outcomes | Primary, all geo levels  |
| Zillow ZORI | Rent return outcomes        | Metro, ZIP               |
| Census ACS  | Rent fallback               | Annual, expanded monthly |
| Redfin      | Price fallback              | Where Zillow unavailable |
| Realtor.com | Price 2nd fallback          | Where both unavailable   |

### A.3 Source Files

This report was generated from:

- `scripts/analysis/output/_extracted_metrics.json` (generated 2026-03-01)
- Metro OOS data generated: 2026-03-01T18:57:04Z
- County OOS data generated: 2026-03-01T18:57:50Z
- ZIP OOS data generated: 2026-03-01T18:59:15Z
- Metro IS state data generated: 2026-03-01 18:59:46 UTC
- County IS state data generated: 2026-03-01 19:00:07 UTC
- ZIP IS state data generated: 2026-03-01 19:00:33 UTC

### A.4 Methodology Notes

- **Excess returns** = location CAGR minus state median CAGR for the same period.
  This controls for statewide market cycles.
- **Walk-forward windows** are generated dynamically: 24-month training, 12-month testing,
  1-year slide starting from Jan 2020. Test periods are strictly non-overlapping.
  Windows only produce results when test-period scores have >= 20 observations with
  complete 3-year outcomes. New windows activate automatically as data accrues.
- **Bootstrap significance** (1,000 iterations) tests whether the quintile spread could arise by chance.
- **InvestorEdge total return** = appreciation excess + rent excess, both vs state median.
  When rent data is unavailable, InvestorEdge falls back to appreciation excess only.
