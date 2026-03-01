# Validation Report Template

This is the exact structure the validation report must follow. Sections must appear in this order. Do not add, remove, or reorder sections. Replace `{placeholder}` values with data from the JSON output files.

For each placeholder, the source is noted in a comment. If the source file or field does not exist, write "N/A" — never fabricate a value.

---

## Header

```markdown
# PropertyIQ Score Validation Report

**Generated:** {YYYY-MM-DD}
**Formula Version:** {from optimized_weights.json → formula_version}
**Data Period:** {earliest score_date} to {latest score_date} ({N} monthly scoring dates)
**Training Target:** 3-year excess return vs state median
**Training Horizon:** 3 years
**Benchmark:** State median (controls for regional market cycles)
**Total Observations:** {N} scored location-period records across metro, county, and ZIP
**Methodology:** Walk-forward elastic net CV with {N}-sample bootstrap significance testing

> Every number in this report is derived from actual observed price and rent changes
> (Zillow ZHVI, ZORI) following each scoring date. No values are estimated or fabricated.
> Source JSON files are listed in the Appendix.
```

---

## Section 1: Executive Summary

Maximum 20 lines. No marketing language. No superlatives.

**Required elements:**
1. One sentence stating what the scores predict (3Y excess returns vs state)
2. The OOS results table (all geo × score combos)
3. Dollar impact range (from excess spreads only)
4. Limitations list (max 5, each citing a specific number)

```markdown
## 1. Executive Summary

PropertyIQ scores predict 3-year excess returns vs state median benchmarks.
Walk-forward cross-validation on held-out data confirms predictive signal at
metro and county levels for both HomeReady and InvestorEdge.

| Geography | Score Type   | OOS IC | OOS Quintile Spread | Bootstrap 95% CI   | Significant | IC Hit Rate |
| --------- | ------------ | -----: | ------------------: | -----------------: | :---------: | ----------: |
| Metro     | HomeReady    | {val}  | {val} pp            | [{lo}, {hi}]       | {Yes/No}    | {val}%      |
| Metro     | InvestorEdge | {val}  | {val} pp            | [{lo}, {hi}]       | {Yes/No}    | {val}%      |
| County    | HomeReady    | {val}  | {val} pp            | [{lo}, {hi}]       | {Yes/No}    | {val}%      |
| County    | InvestorEdge | {val}  | {val} pp            | [{lo}, {hi}]       | {Yes/No}    | {val}%      |
| ZIP       | HomeReady    | {val}  | {val} pp            | [{lo}, {hi}]       | {Yes/No}    | {val}%      |
| ZIP       | InvestorEdge | {val}  | {val} pp            | [{lo}, {hi}]       | {Yes/No}    | {val}%      |

**Source:** optimized_weights*.json → summary.avg_test_ic, summary.avg_test_quintile_spread,
summary.bootstrap_ci, summary.bootstrap_significant, summary.avg_test_hit_rate

**Dollar impact (3-year, OOS):**
On a median-priced home (${median_home}, Zillow ZHVI {month/year}), choosing a top-quintile
market over a bottom-quintile market within the same state adds an estimated
${min_dollar} to ${max_dollar} per year in excess return.

**Source:** OOS quintile spread (pp) / 100 × median home value. Cite Zillow date.

**Limitations:**
- {limitation with specific number, e.g., "Calibration MAD of X pp — scores rank correctly but overstate tail divergence"}
- {limitation}
- {limitation}
```

---

## Section 2: What the Scores Predict

Brief, precise explanation. No marketing.

```markdown
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
```

### 2.1 HomeReady: 3-Year Excess Return Quintiles

Shows how metro HomeReady scores sort locations by actual 3-year excess appreciation vs state.

```markdown
### 2.1 HomeReady: 3-Year Excess Return by Quintile

**Metro HomeReady** ({n_with_target} scored outcomes with 3Y excess returns):

| Quintile        | Avg Score | Avg 3Y Excess Return (vs State) | Avg 3Y CAGR | On ${median_home} Home (3Y cumulative) |
| --------------- | --------: | ------------------------------: | ----------: | -------------------------------------: |
| Q1 (Bottom 20%) | {val}     | {val}%                          | {val}%      | ${val}                                 |
| Q2              | {val}     | {val}%                          | {val}%      | ${val}                                 |
| Q3              | {val}     | {val}%                          | {val}%      | ${val}                                 |
| Q4              | {val}     | {val}%                          | {val}%      | ${val}                                 |
| Q5 (Top 20%)    | {val}     | {val}%                          | {val}%      | ${val}                                 |

**3-Year excess spread: Q5 − Q1 = {val} pp = ${val} per home**

**Source:** validation_results_state.json → HomeReady insample.quintile_table
Dollar conversion: excess return × median home value (Zillow ZHVI, {month/year})

**Column definitions:**
- "Avg 3Y Excess Return (vs State)" = location's 3Y appreciation CAGR minus its state's median 3Y CAGR. This is what the model predicts.
- "Avg 3Y CAGR" = raw appreciation (shown for context only — includes state baseline).
- Dollar figure = 3-year cumulative excess on median home: median_home × ((1 + Q_excess/100)³ − 1)
```

### 2.2 InvestorEdge: 3-Year Excess Total Return Quintiles

```markdown
### 2.2 InvestorEdge: 3-Year Excess Total Return by Quintile

**Metro InvestorEdge** ({n_with_target} scored outcomes with 3Y total return excess):

InvestorEdge captures **total return excess** — appreciation excess plus rent excess, both vs state:

| Quintile        | Avg Score | Appreciation Excess (vs State) | Rent Excess (vs State) | **Total Excess (vs State)** | On ${median_home} Home (3Y cumulative) |
| --------------- | --------: | -----------------------------: | ---------------------: | --------------------------: | -------------------------------------: |
| Q1 (Bottom 20%) | {val}     | {val}%                         | {val}%                 | **{val}%**                  | ${val}                                 |
| Q2              | {val}     | {val}%                         | {val}%                 | **{val}%**                  | ${val}                                 |
| Q3              | {val}     | {val}%                         | {val}%                 | **{val}%**                  | ${val}                                 |
| Q4              | {val}     | {val}%                         | {val}%                 | **{val}%**                  | ${val}                                 |
| Q5 (Top 20%)    | {val}     | {val}%                         | {val}%                 | **{val}%**                  | ${val}                                 |

**3-Year total excess spread: Q5 − Q1 = {val} pp = ${val} per home**

**Source:** validation_results_state.json → InvestorEdge insample.quintile_table
Note: If rent excess breakdown not available in JSON, show total excess only.
```

### 2.3 The Cost of Choosing Wrong

```markdown
### 2.3 The Cost of Choosing Wrong

**On a typical ${median_home} metro-area home (Zillow ZHVI, {month/year}):**

| Metric                                     | Top Quintile (Score > 80) | Bottom Quintile (Score < 20) | Difference  |
| ------------------------------------------ | :-----------------------: | :--------------------------: | :---------: |
| 3-Year excess appreciation (HR, vs state)  | {val}% = **${val}**       | {val}% = **${val}**          | **${val}**  |
| 3-Year excess total return (IE, vs state)  | {val}% = **${val}**       | {val}% = **${val}**          | **${val}**  |
| 3-Year cumulative excess (HR)              | **${val}**                | **${val}**                   | **${val}**  |
| 3-Year cumulative excess (IE)              | **${val}**                | **${val}**                   | **${val}**  |

**Source:** Q5 and Q1 rows from Sections 2.1 and 2.2 above.
Dollar values: median_home × ((1 + excess/100)³ − 1)

> All figures are **excess returns above the state median** — the alpha the score identifies.
> A bottom-quintile location doesn't necessarily lose money; it underperforms its state peers.
> A top-quintile location doesn't just appreciate; it beats other locations in its state.
```

**CRITICAL:** Every value in these tables must be 3Y excess return (vs state). No 1Y figures. No raw returns as headlines. The "Avg 3Y CAGR" column in 2.1 is contextual only and must be clearly labeled as raw/baseline.

---

## Section 3: Out-of-Sample Results (Walk-Forward CV)

The most important section. Only numbers from optimized_weights JSON.

### 3.1 Methodology

```markdown
## 3. Out-of-Sample Results

### 3.1 Methodology

- **Model:** Elastic net with L1/L2 regularization (alpha and l1_ratio tuned per window via 5-fold CV)
- **Walk-forward windows:** Dynamically generated from Jan 2020 (earliest backtest score date).
  24-month training, 12-month test, 1-year slide. Non-overlapping test periods.
  Windows with fewer than 20 test observations (due to incomplete 3Y outcomes) are skipped.
{for each window in optimized_weights.json → window_results:}
  - Train: {train_period} | Test: {test_period} | N_train: {n_train} | N_test: {n_test}
- **Windows producing results:** {n_windows} (grows automatically as 3Y outcome data accrues)
- **Training target:**
  - HomeReady: `excess_vs_state_3y` (3Y appreciation CAGR minus state median)
  - InvestorEdge: `excess_vs_state_3y + (rent_return_3y_cagr - state_rent_return_3y_cagr)`
- **Significance test:** {N} bootstrap samples, 95% confidence interval on quintile spread
- **Feature selection:** Elastic net regularization + stability filter (features must appear in ≥50% of windows with |coef| ≥ 0.02)
```

### 3.2 OOS Results Table

```markdown
### 3.2 Results

| Geography | Score Type   | N (test) | OOS IC | OOS Quintile Spread | Bootstrap 95% CI | Significant |
| --------- | ------------ | -------: | -----: | ------------------: | ---------------: | :---------: |
| Metro     | HomeReady    | {val}    | {val}  | {val} pp            | [{lo}, {hi}]     | {Yes/No}    |
| ...       | ...          | ...      | ...    | ...                 | ...              | ...         |

**Source:** optimized_weights*.json → summary fields
```

### 3.3 OOS Quintile Tables

One table per significant geo × score type combination.

```markdown
### 3.3 OOS Quintile Performance

**Metro HomeReady** ({n_test} test observations):

| Quintile        | Avg Score | Avg 3Y Excess Return (vs State) | N     | Beat-State-Median Rate |
| --------------- | --------: | ------------------------------: | ----: | ---------------------: |
| Q1 (Bottom 20%) | {val}     | {val}%                          | {val} | {val}%                 |
| Q2              | {val}     | {val}%                          | {val} | {val}%                 |
| Q3              | {val}     | {val}%                          | {val} | {val}%                 |
| Q4              | {val}     | {val}%                          | {val} | {val}%                 |
| Q5 (Top 20%)    | {val}     | {val}%                          | {val} | {val}%                 |

**Source:** optimized_weights.json → window_results → test_quintile_table (averaged if multiple windows)
```

**CRITICAL:** Column header must say "Excess Return (vs State)" — never "Return" or "Raw Return."

### 3.4 Dollar Impact

```markdown
### 3.4 Dollar Impact

Based on current median home values (Zillow ZHVI, {month year}):

| Geography | Median Home Value | Score Type   | OOS Spread | Annual Alpha | 3-Year Alpha |
| --------- | ----------------: | ------------ | ---------: | -----------: | -----------: |
| Metro     | ${val}            | HomeReady    | {val} pp   | ${val}       | ${val}       |
| Metro     | ${val}            | InvestorEdge | {val} pp   | ${val}       | ${val}       |
| ...       | ...               | ...          | ...        | ...          | ...          |

**Calculation:**
- Annual Alpha = OOS Quintile Spread (pp) / 100 × Median Home Value
- 3-Year Alpha = Median Home Value × ((1 + Q5_excess/100)³ − (1 + Q1_excess/100)³)

> These figures represent excess returns above state median performance.
> They measure what the score adds over selecting a location randomly within the state.
```

### 3.5 IC Degradation

```markdown
### 3.5 IC Degradation

| Geography | Score Type   | IS IC (state) | OOS IC (state) | Degradation | Status |
| --------- | ------------ | ------------: | -------------: | ----------: | -----: |
| Metro     | HomeReady    | {val}         | {val}          | {val}%      | {PASS/WATCH/WARN} |
| ...       | ...          | ...           | ...            | ...         | ...    |

**Source:** IS IC from validation_results_state.json → insample.mean_ic
           OOS IC from optimized_weights*.json → summary.avg_test_ic

**Thresholds:** <50% = PASS | 50-70% = WATCH | >70% = WARN
```

---

## Section 4: In-Sample Metrics

```markdown
## 4. In-Sample Metrics

Target: 3-year excess return vs state median for all metrics below.

### 4.1 Summary

| Geography | Score Type   | N      | Spearman r | Mean IC | IC IR | IC Hit Rate | Decile Spread |
| --------- | ------------ | -----: | ---------: | ------: | ----: | ----------: | ------------: |
| Metro     | HomeReady    | {val}  | {val}      | {val}   | {val} | {val}%      | {val} pp      |
| ...       | ...          | ...    | ...        | ...     | ...   | ...         | ...           |

**Source:** validation_results_state.json → insample fields
```

### 4.2+ Quintile Tables

One subsection per geo × score type. Use this format:

```markdown
### 4.{N} {Geo} {ScoreType} Quintile Analysis ({n_with_target} observations, 3Y excess vs state)

| Quintile        | Avg Score | Avg 3Y Excess Return (vs State) | N     | Beat-State-Median Rate |
| --------------- | --------: | ------------------------------: | ----: | ---------------------: |
| Q1 (Bottom 20%) | {val}     | {val}%                          | {val} | {val}%                 |
| ...             | ...       | ...                             | ...   | ...                    |

**Decile spread:** {val} pp
**Monotonicity:** {Perfect / 1 swap at Q{X}-Q{Y} / FAIL}

**Source:** validation_results_state.json → insample.quintile_table
```

---

## Section 5: Within-State Validation

Required. This section compares state vs division benchmark performance to show that scores work for within-state comparisons — the actual use case for most users.

```markdown
## 5. Within-State Validation

Real estate decisions are local. A buyer in Illinois wants to know which Illinois metro
will outperform, not that the East North Central division is trending up. This section
validates scores against state-level benchmarks alongside the division comparison.

> The model trains on **state** benchmarks. Division (9 Census regions) metrics are
> shown as a secondary comparison to demonstrate the score works at both granularities.

**HomeReady (Appreciation Excess):**

| Geography | Benchmark | Mean IC | IC IR | IC Hit Rate | Decile Spread |
| --------- | --------- | ------: | ----: | ----------: | ------------: |
| Metro     | State     | {val}   | {val} | {val}%      | {val} pp      |
| Metro     | Division  | {val}   | {val} | {val}%      | {val} pp      |
| County    | State     | {val}   | {val} | {val}%      | {val} pp      |
| County    | Division  | {val}   | {val} | {val}%      | {val} pp      |
| ZIP       | State     | {val}   | {val} | {val}%      | {val} pp      |
| ZIP       | Division  | {val}   | {val} | {val}%      | {val} pp      |

**InvestorEdge:**

| Geography | Benchmark | Mean IC | IC IR | IC Hit Rate | Decile Spread |
| --------- | --------- | ------: | ----: | ----------: | ------------: |
{same structure}

**Source:** validation_results_state.json and validation_results_division.json → insample fields

**Key observations:**
- State IC is expected to be lower than Division IC (within-state ranking is a harder problem)
- IC IR may be higher for state (within-state signal can be more consistent period-to-period)
- Note any geo × score combinations where state hit rate drops below 75%
```

---

## Section 6: Model Stability

### 6.1 Feature Weights

```markdown
## 6. Model Stability

### 6.1 Feature Weights

**{Geo} {ScoreType} ({N} features):**

| Feature | Weight | Direction | Interpretation |
| ------- | -----: | :-------: | -------------- |
| {name}  | {val}  | {+/-}     | {brief}        |
| ...     | ...    | ...       | ...            |

**Source:** optimized_weights*.json → stable_features
```

Provide a brief, factual interpretation for each feature (e.g., "Faster sales = stronger demand signal"). Do not editorialize.

### 6.2 Time Stability

```markdown
### 6.2 Time Stability (IC by Year)

| Year | {Geo} HR IC | Status | {Geo} IE IC | Status |
| ---: | ----------: | -----: | ----------: | -----: |
| {yr} | {val}       | {PASS/FAIL} | {val}  | {PASS/FAIL} |
| ...  | ...         | ...    | ...         | ...    |

Years with < 20 observations: excluded (noted as "—")
PASS: IC > 0 | FAIL: IC ≤ 0

**Source:** validation_results_state.json → time_stability.ic_by_year
```

---

## Section 7: Calibration

```markdown
## 7. Calibration

### 7.{N} {Geo} {ScoreType}

| Score Decile | Predicted Percentile | Actual Return Percentile | Deviation |
| -----------: | -------------------: | -----------------------: | --------: |
| 1 (lowest)   | {val}                | {val}                    | {val}     |
| ...          | ...                  | ...                      | ...       |
| 10 (highest) | {val}                | {val}                    | {val}     |

**MAD: {val} pp** | Status: {PASS (<15) / WATCH (15-20) / WARN (>20)}

**Source:** validation_results_state.json → calibration.decile_calibration

### 7.{N} Calibration Summary

| Geography | HomeReady MAD | InvestorEdge MAD |
| --------- | ------------: | ---------------: |
| Metro     | {val} pp      | {val} pp         |
| ...       | ...           | ...              |

**Interpretation:** Scores rank locations correctly (monotonic quintile ordering) but
overstate tail divergence. A score of 90 means "very likely to outperform state median,"
not "90th percentile return." Use scores for ranking and selection, not precise return prediction.
```

This interpretation paragraph must appear in every report. It is not optional.

---

## Section 8: Robustness Checklist

```markdown
## 8. Robustness Checklist

| Test                   | Metro HR | Metro IE | County HR | County IE | ZIP HR | ZIP IE |
| ---------------------- | :------: | :------: | :-------: | :-------: | :----: | :----: |
| OOS validation         | {P/F/W}  | {P/F/W}  | {P/F/W}   | {P/F/W}   | {P/F/W}| {P/F/W}|
| Bootstrap significance | {P/F}    | {P/F}    | {P/F}     | {P/F}     | {P/F}  | {P/F}  |
| IC hit rate ≥ 75%      | {P/F}    | {P/F}    | {P/F}     | {P/F}     | {P/F}  | {P/F}  |
| Monotonic quintiles    | {P/F}    | {P/F}    | {P/F}     | {P/F}     | {P/F}  | {P/F}  |
| Feature stability      | {P/F}    | {P/F}    | {P/F}     | {P/F}     | {P/F}  | {P/F}  |
| Time stability         | {P/F}    | {P/F}    | {P/F}     | {P/F}     | {P/F}  | {P/F}  |
| IC degradation < 50%   | {P/W/F}  | {P/W/F}  | {P/W/F}   | {P/W/F}   | {P/W/F}| {P/W/F}|
| Calibration MAD < 20pp | {P/W/F}  | {P/W/F}  | {P/W/F}   | {P/W/F}   | {P/W/F}| {P/W/F}|

P = PASS | W = WATCH | F = FAIL/WARN

**Source:** Derived from all preceding sections. Each cell must be traceable to a specific metric above.
```

---

## Section 9: Known Limitations

```markdown
## 9. Known Limitations

{Numbered list. Each item cites a specific metric from the report.}

1. **Calibration:** MAD of {val}-{val} pp across geo levels. Ranking is reliable; magnitude is compressed.
2. **Walk-forward windows:** {N} fold(s) with non-overlapping test periods (dynamically generated: 24-month train, 12-month test, 1-year slide from Jan 2020). Additional windows activate automatically each year as 3-year outcomes accrue.
3. **{Any geo × score with degradation > 50%}:** {val}% IC degradation. Monitor for further deterioration.
4. **{Any geo × score with weak OOS}:** OOS IC of {val}. {Explanation, e.g., sparse rent data}.
5. **{Any other limitation from robustness checklist}**
```

Only include limitations that are supported by specific numbers in the report. Do not include generic disclaimers.

---

## Appendix

```markdown
## Appendix: Data Coverage

### A.1 Backtest Outcome Coverage

| Geography | Total Scored | With 3Y Returns | With Rent Returns | Score Types |
| --------- | -----------: | --------------: | ----------------: | ----------- |
| Metro     | {val}        | {val} ({pct}%)  | {val} ({pct}%)    | HR, IE, MH  |
| County    | {val}        | {val} ({pct}%)  | {val} ({pct}%)    | HR, IE, MH  |
| ZIP       | {val}        | {val} ({pct}%)  | {val} ({pct}%)    | HR, IE, MH  |

### A.2 Data Sources

| Source       | Used For                    | Coverage                |
| ------------ | --------------------------- | ----------------------- |
| Zillow ZHVI  | Price appreciation outcomes | Primary, all geo levels |
| Zillow ZORI  | Rent return outcomes        | Metro ({pct}%), ZIP ({pct}%), County (sparse) |
| Census ACS   | Rent fallback               | Annual, expanded monthly |
| Redfin       | Price fallback              | Where Zillow unavailable |
| Realtor.com  | Price 2nd fallback          | Where both unavailable  |

### A.3 Source Files

This report was generated from:
- `scripts/analysis/output/validation_results_state.json` (generated {datetime})
- `scripts/analysis/output/optimized_weights.json` (generated {datetime})
- `scripts/analysis/output/optimized_weights_county.json` (generated {datetime})
- `scripts/analysis/output/optimized_weights_zip.json` (generated {datetime})

### A.4 Methodology Notes

- **Excess returns** = location CAGR minus state median CAGR for the same period.
  This controls for statewide market cycles.
- **Walk-forward windows** are generated dynamically: 24-month training, 12-month testing,
  1-year slide starting from Jan 2020. Test periods are strictly non-overlapping.
  Windows only produce results when test-period scores have ≥ 20 observations with
  complete 3-year outcomes. New windows activate automatically as data accrues.
- **Bootstrap significance** (1,000 iterations) tests whether the quintile spread could arise by chance.
- **InvestorEdge total return** = appreciation excess + rent excess, both vs state median.
  When rent data is unavailable, InvestorEdge falls back to appreciation excess only.
```

---

## Supplementary Section (Optional, Only If Explicitly Requested)

If the user specifically requests 1Y return analysis, it may be included ONLY as a supplementary section AFTER the appendix, with this exact header and disclaimer:

```markdown
## Supplementary: 1-Year Observed Returns (NOT a Prediction Target)

> **IMPORTANT:** The PropertyIQ model does not train on or predict 1-year returns.
> The following data shows how model-ranked quintiles happened to perform over 1-year
> horizons. These figures are observational, not validated predictions. Do not cite
> 1Y returns as evidence of model accuracy.

{1Y tables here, clearly labeled as observational}
```

This section must NEVER appear in the main report body. It must NEVER be cited in the executive summary or dollar impact calculations.
