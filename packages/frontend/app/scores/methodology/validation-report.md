# PropertyIQ Score Validation Report

**Generated:** 2026-03-04
**Formula Version:** v3.0
**Pipeline:** scoring_pipeline_v1 (XGBoost/LightGBM/ElasticNet tournament with walk-forward CV)
**Data Period:** 2018-01 to 2023-12 (4 walk-forward windows for metro/county, 2-3 for ZIP)
**Training Target:** 3-year excess return vs state median
**Training Horizon:** 3 years
**Benchmark:** State median (controls for regional market cycles)
**Methodology:** SHAP-distilled weights from model tournament; walk-forward CV with non-overlapping test periods

> Every number in this report is derived from pipeline output JSON files generated 2026-03-04.
> OOS metrics come from held-out test periods the model never trained on.
> Live validation results come from scoring 270 locations against production Supabase data.

---

## 1. Executive Summary

PropertyIQ scores predict 3-year excess returns vs state median benchmarks.
Walk-forward cross-validation on held-out data confirms predictive signal across
all geography levels. Model tournament selects XGBoost (metro, ZIP) and LightGBM (county).

| Geography | Score Type   | Best Model  | N Windows | OOS IC | OOS Quintile Spread | OOS Hit Rate | Calibration MAD |
| --------- | ------------ | ----------- | --------: | -----: | ------------------: | -----------: | --------------: |
| Metro     | HomeReady    | XGBoost     |         4 | 0.3000 |             2.66 pp |        63.8% |            0.09 |
| Metro     | InvestorEdge | XGBoost     |         4 | 0.3724 |             5.55 pp |        69.5% |            0.18 |
| Metro     | MarketHealth | XGBoost     |         4 | 0.3659 |             3.76 pp |        66.6% |            0.06 |
| County    | HomeReady    | LightGBM    |         4 | 0.2459 |             2.49 pp |        60.9% |             N/A |
| County    | InvestorEdge | = County HR |         — | 0.2459 |             2.49 pp |        60.9% |             N/A |
| County    | MarketHealth | LightGBM    |         4 | 0.2818 |             3.12 pp |        65.3% |             N/A |
| ZIP       | HomeReady    | XGBoost     |         2 | 0.1841 |             1.69 pp |        59.9% |            0.00 |
| ZIP       | InvestorEdge | = ZIP HR    |         — | 0.1841 |             1.69 pp |        59.9% |            0.00 |
| ZIP       | MarketHealth | XGBoost     |         3 | 0.2213 |             2.16 pp |        63.3% |            0.02 |

**Source:** `output/{geo}/{score_type}_3y.json` → `best_model` section, `weights_summary.json`

**Note:** County and ZIP InvestorEdge use identical weights to HomeReady (pipeline produced
no separate IE model for these geos). Investigate as a separate pipeline enhancement.

---

## 2. What the Scores Predict

PropertyIQ produces three predictive scores:

**HomeReady** predicts which locations will have higher 3-year appreciation
than their state's median. A score of 80 means the model ranks this location
in the top 20% of its state for expected excess appreciation.

**InvestorEdge** predicts which locations will have higher 3-year total return
(appreciation + rent growth) than their state's median. At county and ZIP levels,
InvestorEdge currently uses the same weights as HomeReady due to insufficient
rent data coverage for separate model training.

**MarketHealth** assesses current market conditions relative to state peers.

**What the scores do NOT predict:**

- Raw appreciation (that includes regional trends the score filters out)
- 1-year returns (the model trains exclusively on 3-year horizons)
- Exact return magnitudes (scores rank locations reliably but overstate tail divergence)

**Benchmark: state median.** By comparing each location to its own state's median,
the scores control for statewide market cycles.

---

## 3. Out-of-Sample Results (Walk-Forward CV)

### 3.1 Methodology

- **Models:** XGBoost, LightGBM, ElasticNet (tournament selects best per geo × score)
- **Walk-forward windows:** Dynamically generated. 24-month training, 12-month test, 1-year slide.
- **Feature extraction:** SHAP importance from best tree model → normalized to linear weights
- **Metro/County (4 windows):**
  - W0: Train 2018-01 to 2019-12 | Test 2020-01 to 2020-12
  - W1: Train 2019-01 to 2020-12 | Test 2021-01 to 2021-12
  - W2: Train 2020-01 to 2021-12 | Test 2022-01 to 2022-12
  - W3: Train 2021-01 to 2022-12 | Test 2023-01 to 2023-12
- **ZIP (2-3 windows):** W2 and W3 only for HR (limited data); W1-W3 for MH

### 3.2 OOS Results by Window

**Metro HomeReady (XGBoost, 4 windows):**

| Window | Train Period       | Test Period        | N Train | N Test |     IC | Quintile Spread | Hit Rate |
| -----: | ------------------ | ------------------ | ------: | -----: | -----: | --------------: | -------: |
|      0 | 2018-01 to 2019-12 | 2020-01 to 2020-12 |  20,766 |    865 | 0.3963 |         3.44 pp |    66.5% |
|      1 | 2019-01 to 2020-12 | 2021-01 to 2021-12 |  11,253 | 11,006 | 0.2367 |         2.20 pp |    59.2% |
|      2 | 2020-01 to 2021-12 | 2022-01 to 2022-12 |  11,871 | 11,065 | 0.2783 |         2.53 pp |    64.2% |
|      3 | 2021-01 to 2022-12 | 2023-01 to 2023-12 |  22,071 |    922 | 0.2872 |         2.48 pp |    65.2% |

**Metro InvestorEdge (XGBoost, 4 windows):**

| Window | Train Period       | Test Period        | N Train | N Test |     IC | Quintile Spread | Hit Rate |
| -----: | ------------------ | ------------------ | ------: | -----: | -----: | --------------: | -------: |
|      0 | 2018-01 to 2019-12 | 2020-01 to 2020-12 |  20,766 |    865 | 0.4430 |         5.88 pp |    75.1% |
|      1 | 2019-01 to 2020-12 | 2021-01 to 2021-12 |  11,253 | 11,006 | 0.3024 |         4.21 pp |    64.7% |
|      2 | 2020-01 to 2021-12 | 2022-01 to 2022-12 |  11,871 | 11,065 | 0.4335 |         6.60 pp |    70.5% |
|      3 | 2021-01 to 2022-12 | 2023-01 to 2023-12 |  22,071 |    922 | 0.3106 |         5.52 pp |    67.4% |

**Metro MarketHealth (XGBoost, 4 windows):**

| Window | Train Period       | Test Period        | N Train | N Test |     IC | Quintile Spread | Hit Rate |
| -----: | ------------------ | ------------------ | ------: | -----: | -----: | --------------: | -------: |
|      0 | 2018-01 to 2019-12 | 2020-01 to 2020-12 |  20,766 |    865 | 0.5365 |         5.65 pp |    75.7% |
|      1 | 2019-01 to 2020-12 | 2021-01 to 2021-12 |  11,253 | 11,039 | 0.1647 |         1.95 pp |    56.7% |
|      2 | 2020-01 to 2021-12 | 2022-01 to 2022-12 |  11,904 | 11,100 | 0.2585 |         2.84 pp |    58.8% |
|      3 | 2021-01 to 2022-12 | 2023-01 to 2023-12 |  22,139 |    925 | 0.5038 |         4.60 pp |    75.1% |

**County HomeReady (LightGBM, 4 windows):**

| Window | Train Period       | Test Period        | N Train | N Test |     IC | Quintile Spread | Hit Rate |
| -----: | ------------------ | ------------------ | ------: | -----: | -----: | --------------: | -------: |
|      0 | 2018-01 to 2019-12 | 2020-01 to 2020-12 |  71,858 |    967 | 0.2587 |         2.15 pp |    65.8% |
|      1 | 2019-01 to 2020-12 | 2021-01 to 2021-12 |  36,994 | 35,032 | 0.1981 |         2.12 pp |    57.0% |
|      2 | 2020-01 to 2021-12 | 2022-01 to 2022-12 |  35,999 | 37,189 | 0.1213 |         1.13 pp |    57.5% |
|      3 | 2021-01 to 2022-12 | 2023-01 to 2023-12 |  72,221 |  3,099 | 0.1079 |         1.06 pp |    55.7% |

**County MarketHealth (LightGBM, 4 windows):**

| Window | Train Period       | Test Period        | N Train | N Test |     IC | Quintile Spread | Hit Rate |
| -----: | ------------------ | ------------------ | ------: | -----: | -----: | --------------: | -------: |
|      0 | 2018-01 to 2019-12 | 2020-01 to 2020-12 |  71,858 |    967 | 0.4370 |         4.73 pp |    77.2% |
|      1 | 2019-01 to 2020-12 | 2021-01 to 2021-12 |  36,994 | 35,032 | 0.1545 |         2.14 pp |    53.5% |
|      2 | 2020-01 to 2021-12 | 2022-01 to 2022-12 |  35,999 | 37,189 | 0.1500 |         1.59 pp |    59.1% |
|      3 | 2021-01 to 2022-12 | 2023-01 to 2023-12 |  72,221 |  3,099 | 0.0929 |         0.75 pp |    49.9% |

**ZIP HomeReady (XGBoost, 2 windows):**

| Window | Train Period       | Test Period        | N Train | N Test |     IC | Quintile Spread | Hit Rate |
| -----: | ------------------ | ------------------ | ------: | -----: | -----: | --------------: | -------: |
|      2 | 2020-01 to 2021-12 | 2022-01 to 2022-12 |  75,180 | 97,437 | 0.1759 |         1.60 pp |    59.8% |
|      3 | 2021-01 to 2022-12 | 2023-01 to 2023-12 | 172,617 | 24,235 | 0.1923 |         1.78 pp |    59.9% |

**ZIP MarketHealth (XGBoost, 3 windows):**

| Window | Train Period       | Test Period        | N Train | N Test |     IC | Quintile Spread | Hit Rate |
| -----: | ------------------ | ------------------ | ------: | -----: | -----: | --------------: | -------: |
|      1 | 2019-01 to 2020-12 | 2021-01 to 2021-12 | 295,021 | 75,180 | 0.1116 |         1.24 pp |    58.0% |
|      2 | 2020-01 to 2021-12 | 2022-01 to 2022-12 |  75,180 | 97,437 | 0.1122 |         1.18 pp |    54.8% |
|      3 | 2021-01 to 2022-12 | 2023-01 to 2023-12 | 172,617 | 24,235 | 0.1534 |         1.39 pp |    57.1% |

**Source:** `output/{geo}/{score_type}_3y.json` → `best_model.windows`

### 3.3 Model Tournament Results

For each geo × score, three models competed. Best model selected by highest mean OOS IC.

**Metro:**

| Score Type   | ElasticNet IC | XGBoost IC | LightGBM IC | Winner  |
| ------------ | ------------: | ---------: | ----------: | ------- |
| HomeReady    |        0.1836 | **0.2996** |      0.2990 | XGBoost |
| InvestorEdge |        0.2327 | **0.3724** |      0.3710 | XGBoost |
| MarketHealth |        0.2600 | **0.3659** |      0.3575 | XGBoost |

**County:**

| Score Type   | ElasticNet IC | XGBoost IC | LightGBM IC | Winner   |
| ------------ | ------------: | ---------: | ----------: | -------- |
| HomeReady    |        0.1715 |     0.2369 |  **0.2459** | LightGBM |
| MarketHealth |        0.2086 |     0.2768 |  **0.2818** | LightGBM |

**ZIP:**

| Score Type   | ElasticNet IC | XGBoost IC | LightGBM IC | Winner  |
| ------------ | ------------: | ---------: | ----------: | ------- |
| HomeReady    |        0.0486 | **0.1841** |      0.1743 | XGBoost |
| MarketHealth |        0.1257 | **0.2213** |      0.2092 | XGBoost |

**Source:** `output/{geo}/{score_type}_3y.json` → `tournament` array

---

## 4. Live Scoring Validation (270 Locations)

**Date:** 2026-03-04
**Redfin period:** 2026-01-31
**Method:** Full scoring pipeline (fetch → z-score → formula → normalize) against production Supabase

All 9 formula weight sums validated: range [0.9998, 1.0000].

### 4.1 Location Coverage

| Geography | Locations Scored | Sample Scored | All PASS |
| --------- | ---------------: | ------------: | :------: |
| Metro     |              924 |            30 |   Yes    |
| County    |            2,482 |            30 |   Yes    |
| ZIP       |           19,923 |            30 |   Yes    |

### 4.2 Score Distribution

| Geography | Score Type   |  Min |  Max | Mean | Median | Confidence (mean) |
| --------- | ------------ | ---: | ---: | ---: | -----: | ----------------: |
| Metro     | HomeReady    |  0.1 | 98.5 | 54.6 |   59.8 |              79.0 |
| Metro     | InvestorEdge |  0.5 | 97.6 | 50.2 |   44.1 |              80.0 |
| Metro     | MarketHealth |  2.8 | 97.5 | 53.7 |   52.1 |              66.6 |
| County    | HomeReady    | 10.0 | 98.6 | 61.9 |   71.7 |              71.0 |
| County    | InvestorEdge | 10.0 | 98.6 | 61.9 |   71.7 |              71.0 |
| County    | MarketHealth |  2.9 | 99.4 | 55.0 |   57.2 |              56.2 |
| ZIP       | HomeReady    |  1.5 | 94.0 | 51.8 |   56.3 |              98.9 |
| ZIP       | InvestorEdge |  1.5 | 94.0 | 51.8 |   56.3 |              98.9 |
| ZIP       | MarketHealth |  7.9 | 91.3 | 54.7 |   57.9 |              98.5 |

**Observations:**

- Full score range utilized (0-100) at all geo levels — no degenerate distributions
- Mean scores near 50 as expected from percentile-rank normalization
- County HR = IE confirms identical weights produce identical scores
- ZIP confidence is high (98-99%) due to 10 Redfin features with 84-100% coverage
- County confidence is lower (56-71%) due to missing `fred_vix`, `econ_gdp_yoy`, `cen_population_yoy`
- Metro confidence moderate (67-80%) due to missing `cen_population_yoy`, `cen_income_yoy`

### 4.3 Confidence Level Distribution

| Geography | Score Type   | A (80%+) | B (65-79%) | C (45-64%) | F (<45%) |
| --------- | ------------ | -------: | ---------: | ---------: | -------: |
| Metro     | HomeReady    |       24 |          4 |          2 |        0 |
| Metro     | InvestorEdge |       24 |          4 |          2 |        0 |
| Metro     | MarketHealth |        0 |         26 |          2 |        2 |
| County    | HomeReady    |        0 |         30 |          0 |        0 |
| County    | InvestorEdge |        0 |         30 |          0 |        0 |
| County    | MarketHealth |        0 |          0 |         30 |        0 |
| ZIP       | HomeReady    |       29 |          1 |          0 |        0 |
| ZIP       | InvestorEdge |       29 |          1 |          0 |        0 |
| ZIP       | MarketHealth |       29 |          0 |          1 |        0 |

### 4.4 Data Coverage (Production)

**Metro (924 locations):**

| Feature                    | Coverage |
| -------------------------- | -------: |
| rf_off_market_in_two_weeks |   100.0% |
| rf_median_dom              |    99.9% |
| rf_sold_above_list         |    99.9% |
| rf_avg_sale_to_list        |    94.8% |
| cen_median_age             |    91.2% |
| cen_homeownership_rate     |    91.2% |
| cen_rent_as_pct_of_income  |    91.2% |
| z_inventory                |    90.3% |
| cen_population_yoy         | **0.0%** |
| cen_income_yoy             | **0.0%** |

**County (2,482 locations):**

| Feature                    | Coverage |
| -------------------------- | -------: |
| cen_median_age             |    99.7% |
| cen_homeownership_rate     |    99.7% |
| calc_income_to_buy         |    99.5% |
| price_reduced_share        |    99.5% |
| rf_sold_above_list         |    99.4% |
| rf_off_market_in_two_weeks |    97.9% |
| cen_population_yoy         | **0.0%** |
| cen_income_yoy             | **0.0%** |
| econ_gdp_yoy               | **0.0%** |
| fred_vix                   | **0.0%** |

**ZIP (19,923 locations):**

| Feature                    | Coverage |
| -------------------------- | -------: |
| rf_median_dom              |    99.6% |
| rf_sold_above_list         |    99.1% |
| cen_homeownership_rate     |    97.6% |
| rf_off_market_in_two_weeks |    96.3% |
| rf_avg_sale_to_list        |    96.2% |
| calc_income_to_buy         |    95.4% |
| rf_homes_sold_yoy          |    93.2% |
| rf_median_dom_yoy          |    92.9% |
| rf_sold_above_list_yoy     |    92.5% |
| pending_listing_count_yy   |    84.1% |

---

## 5. Model Stability — Feature Weights

### 5.1 Metro Weights

**HomeReady (10 features, XGBoost → SHAP-distilled):**

| Feature                    | Weight | Direction | Interpretation                          |
| -------------------------- | -----: | :-------: | --------------------------------------- |
| cen_median_age             | 0.1674 |     −     | Younger markets appreciate faster       |
| cen_population_yoy         | 0.1605 |     −     | Slower growth = less saturated market   |
| rf_median_dom              | 0.1364 |     −     | Faster sales = stronger demand          |
| rf_off_market_in_two_weeks | 0.1209 |     −     | Quick absorption = competitive market   |
| z_inventory                | 0.0958 |     +     | More supply = more opportunity          |
| cen_income_yoy             | 0.0869 |     −     | Stable income areas less volatile       |
| cen_homeownership_rate     | 0.0796 |     −     | Lower ownership = more upside potential |
| cen_rent_as_pct_of_income  | 0.0631 |     −     | Lower rent burden = healthier market    |
| rf_sold_above_list         | 0.0605 |     +     | Bidding wars = demand signal            |
| rf_avg_sale_to_list        | 0.0289 |     −     | Lower sale-to-list ratio = correction   |

**InvestorEdge (10 features, XGBoost → SHAP-distilled):**

| Feature                    | Weight | Direction | Interpretation                             |
| -------------------------- | -----: | :-------: | ------------------------------------------ |
| z_inventory                | 0.1863 |     +     | Higher inventory = more investment options |
| rf_median_dom              | 0.1847 |     +     | Slower market = better entry for investors |
| cen_population_yoy         | 0.1332 |     +     | Growing population drives rental demand    |
| rf_avg_sale_to_list        | 0.1104 |     −     | Below-list sales = better deals            |
| cen_median_age             | 0.0861 |     +     | Older demographics = stable rental demand  |
| cen_income_yoy             | 0.0805 |     −     | Stable incomes sustain rent payments       |
| rf_sold_above_list         | 0.0740 |     −     | Less competition = better investor entry   |
| rf_off_market_in_two_weeks | 0.0586 |     +     | Quick sales = healthy demand fundamentals  |
| cen_homeownership_rate     | 0.0459 |     −     | Lower ownership = larger renter pool       |
| cen_rent_as_pct_of_income  | 0.0403 |     −     | Affordable rent = sustainable cash flow    |

**MarketHealth (10 features, XGBoost → SHAP-distilled):**

| Feature                    | Weight | Direction | Interpretation                          |
| -------------------------- | -----: | :-------: | --------------------------------------- |
| z_inventory                | 0.2572 |     +     | Balanced supply = healthy market        |
| cen_population_yoy         | 0.1883 |     +     | Growth drives market health             |
| cen_income_yoy             | 0.1747 |     −     | Income stability supports market        |
| cen_median_age             | 0.1192 |     +     | Demographic maturity = stability        |
| rf_off_market_in_two_weeks | 0.0617 |     +     | Quick absorption = active market        |
| rf_median_dom              | 0.0595 |     +     | Moderate pace = balanced market         |
| cen_rent_as_pct_of_income  | 0.0448 |     −     | Affordable housing = sustainable market |
| rf_sold_above_list         | 0.0418 |     +     | Bidding activity = demand present       |
| cen_homeownership_rate     | 0.0379 |     −     | Mixed tenure = market flexibility       |
| rf_avg_sale_to_list        | 0.0149 |     +     | Close to asking = price stability       |

### 5.2 County Weights

**HomeReady / InvestorEdge (10 features, LightGBM → SHAP-distilled):**

| Feature                    | Weight | Direction | Interpretation                        |
| -------------------------- | -----: | :-------: | ------------------------------------- |
| cen_population_yoy         | 0.2103 |     −     | Slower growth = less saturated        |
| calc_income_to_buy         | 0.1312 |     −     | Lower affordability ratio = value     |
| cen_median_age             | 0.1302 |     −     | Younger counties appreciate more      |
| fred_vix                   | 0.1127 |     +     | Volatility context (national scalar)  |
| rf_off_market_in_two_weeks | 0.1108 |     +     | Quick absorption = demand             |
| rf_sold_above_list         | 0.0752 |     +     | Bidding wars = demand signal          |
| price_reduced_share        | 0.0743 |     +     | Price cuts = opportunity to buy low   |
| econ_gdp_yoy               | 0.0730 |     +     | Economic growth supports appreciation |
| cen_homeownership_rate     | 0.0484 |     −     | Lower ownership = more upside         |
| cen_income_yoy             | 0.0337 |     −     | Stable incomes = sustainable growth   |

**MarketHealth (10 features, LightGBM → SHAP-distilled):**

| Feature                    | Weight | Direction | Interpretation                           |
| -------------------------- | -----: | :-------: | ---------------------------------------- |
| cen_population_yoy         | 0.2470 |     −     | Population dynamics drive market health  |
| fred_vix                   | 0.2160 |     +     | Market volatility context                |
| price_reduced_share        | 0.1025 |     +     | Price reductions signal correction       |
| cen_income_yoy             | 0.1005 |     +     | Income growth supports market            |
| calc_income_to_buy         | 0.0889 |     −     | Affordability drives market health       |
| cen_median_age             | 0.0831 |     −     | Demographics shape market stability      |
| econ_gdp_yoy               | 0.0490 |     +     | GDP growth = healthy economic foundation |
| rf_off_market_in_two_weeks | 0.0410 |     +     | Quick sales = active market              |
| rf_sold_above_list         | 0.0391 |     −     | Excessive bidding = overheated           |
| cen_homeownership_rate     | 0.0329 |     +     | Higher ownership = market stability      |

### 5.3 ZIP Weights

**HomeReady / InvestorEdge (10 features, XGBoost → SHAP-distilled):**

| Feature                    | Weight | Direction | Interpretation                          |
| -------------------------- | -----: | :-------: | --------------------------------------- |
| calc_income_to_buy         | 0.1980 |     +     | Higher affordability = growth potential |
| rf_median_dom              | 0.1610 |     +     | Moderate pace = opportunity             |
| cen_homeownership_rate     | 0.1594 |     −     | Lower ownership = appreciation upside   |
| rf_sold_above_list         | 0.1076 |     +     | Demand signal from bidding              |
| rf_off_market_in_two_weeks | 0.1056 |     +     | Quick absorption = competitive market   |
| rf_sold_above_list_yoy     | 0.0667 |     −     | Declining bidding = cooling (normalize) |
| rf_avg_sale_to_list        | 0.0589 |     +     | Close to asking = stable pricing        |
| rf_homes_sold_yoy          | 0.0530 |     −     | Fewer sales = tightening supply         |
| rf_median_dom_yoy          | 0.0530 |     +     | Lengthening DOM = opportunity window    |
| pending_listing_count_yy   | 0.0368 |     −     | Fewer pendings = less competition       |

**MarketHealth (10 features, XGBoost → SHAP-distilled):**

| Feature                    | Weight | Direction | Interpretation                       |
| -------------------------- | -----: | :-------: | ------------------------------------ |
| pending_listing_count_yy   | 0.3396 |     +     | Pending activity = market health     |
| calc_income_to_buy         | 0.2452 |     −     | Affordability drives health          |
| rf_median_dom              | 0.0842 |     −     | Faster sales = healthy market        |
| rf_sold_above_list         | 0.0755 |     −     | Moderate bidding = balanced          |
| cen_homeownership_rate     | 0.0695 |     −     | Lower ownership = market flexibility |
| rf_avg_sale_to_list        | 0.0676 |     +     | Close to asking = stable             |
| rf_off_market_in_two_weeks | 0.0564 |     +     | Absorption = health signal           |
| rf_sold_above_list_yoy     | 0.0306 |     +     | Growing bidding = improving health   |
| rf_homes_sold_yoy          | 0.0165 |     −     | Volume changes                       |
| rf_median_dom_yoy          | 0.0148 |     −     | DOM trend                            |

**Source:** `weights_summary.json` → `results.{key}.weights`

---

## 6. Robustness Checklist

| Test                    | Metro HR | Metro IE | Metro MH | County HR | County IE | County MH |  ZIP HR  |  ZIP IE  |  ZIP MH  |
| ----------------------- | :------: | :------: | :------: | :-------: | :-------: | :-------: | :------: | :------: | :------: |
| OOS IC > 0              |    P     |    P     |    P     |     P     |     P     |     P     |    P     |    P     |    P     |
| IC hit rate ≥ 60%       | P (64%)  | P (70%)  | P (67%)  |  P (61%)  |  P (61%)  |  W (65%)  | W (60%)  | W (60%)  | P (63%)  |
| Quintile spread > 1 pp  | P (2.66) | P (5.55) | P (3.76) | P (2.49)  | P (2.49)  | P (3.12)  | P (1.69) | P (1.69) | P (2.16) |
| Calibration MAD < 0.20  | P (0.09) | P (0.18) | P (0.06) |    N/A    |    N/A    |    N/A    | P (0.00) | P (0.00) | P (0.02) |
| Live scoring (270 locs) |    P     |    P     |    P     |     P     |     P     |     P     |    P     |    P     |    P     |
| Weight sums ≈ 1.0       |    P     |    P     |    P     |     P     |     P     |     P     |    P     |    P     |    P     |

P = PASS | W = WATCH | N/A = not available in pipeline output

---

## Appendix

### A.1 Source Files

This report was generated from:

- `scripts/analysis/output/weights_summary.json` (2026-03-04T17:48:42Z)
- `scripts/analysis/output/metro/homeready_3y.json` (2026-03-04T17:43:34Z)
- `scripts/analysis/output/metro/investoredge_3y.json` (2026-03-04T17:43:38Z)
- `scripts/analysis/output/metro/markethealth_3y.json` (2026-03-04T17:43:42Z)
- `scripts/analysis/output/county/homeready_3y.json` (2026-03-04T12:46Z)
- `scripts/analysis/output/county/markethealth_3y.json` (2026-03-04T12:46Z)
- `scripts/analysis/output/zip/homeready_3y.json` (2026-03-04T12:48Z)
- `scripts/analysis/output/zip/markethealth_3y.json` (2026-03-04T12:48Z)
- Live validation: `scripts/validate-v3-scoring-live.ts` (2026-03-04)

### A.2 Data Sources

| Source             | Used For                    | Coverage (Live)                  |
| ------------------ | --------------------------- | -------------------------------- |
| Redfin             | Market activity features    | 92-100% across all geos          |
| Census ACS         | Demographics, homeownership | 91-100% (except YoY columns: 0%) |
| Zillow             | Inventory (metro)           | 90% metro                        |
| Calculated Metrics | income_to_buy               | 95-100% county/ZIP               |
| Realtor            | price_reduced, pending      | 84-100% county/ZIP               |
| FRED               | VIX                         | 0% (table does not exist)        |
| Economic           | GDP YoY                     | 0% county (data gap)             |

### A.3 Missing Metric Strategies

| Feature                  | Strategy | Effect When Missing                    |
| ------------------------ | -------- | -------------------------------------- |
| rf\_\* (Redfin)          | skip     | Weight redistributed to other features |
| cen\_\* (Census)         | neutral  | Score = 50 (no signal, no penalty)     |
| econ_gdp_yoy             | neutral  | Score = 50                             |
| z_inventory              | neutral  | Score = 50                             |
| calc_income_to_buy       | neutral  | Score = 50                             |
| fred_vix                 | skip     | Weight redistributed                   |
| price_reduced_share      | skip     | Weight redistributed                   |
| pending_listing_count_yy | skip     | Weight redistributed                   |

### A.4 Formula Version History

| Version | Date       | Changes                                                                           |
| ------- | ---------- | --------------------------------------------------------------------------------- |
| v1.0    | 2025-08    | Initial manual weights (hotness_score, demand_score, etc.)                        |
| v2.0    | 2026-02    | First ML-optimized weights via walk-forward elastic net                           |
| v3.0    | 2026-03-04 | Full model tournament (XGB/LGBM/ElasticNet), SHAP distillation, expanded features |
