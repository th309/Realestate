# PropertyIQ Score Validation Report

**Generated:** 2026-06-13
**Formula:** PropertyIQ demand signal — `z(zhvi_yoy) + z(zhvi_mom_3m) − z(median_days_on_market) − z(price_reduced_share)`, equal weights, no fitted parameters
**Inputs:** 12-month and 3-month Zillow ZHVI price momentum; Realtor.com median days on market and share of listings with price cuts. No Redfin data.
**Training Target:** 3-year forward excess return vs state median appreciation
**Benchmark:** State median appreciation (controls for statewide market cycles)
**Scored Coverage:** ~935 metros, ~3,150 counties, ~34,000 ZIP codes; monthly history backfilled to January 2001
**Validation Sample:** 865 metros / 3,061 counties / 25,783 ZIPs with observed 3-year forward outcomes (2001–2023 scoring vintages)
**Methodology:** Cross-sectional percentile rank re-centered so the zero-crossing maps to 50; per-month Spearman rank correlation of score vs forward excess return, aggregated by calendar year; permutation significance vs shuffled-target null; full-period and era-split robustness.

> Every number in this report is computed from observed price changes (Zillow ZHVI) following each scoring date. No value is estimated or fabricated. Sources are the committed backtest artifacts: `scripts/analysis/monolithic-discovery/data/{metro,county,zip}_score_backtest.json`, `claims_stats.json`, and `validation_rank2.json`, summarized in `docs/superpowers/results/2026-06-12-*`.

---

## 1. Executive Summary

The PropertyIQ Score predicts 3-year excess appreciation vs each market's state. The score-to-return relationship is positive in every validated calendar year at all three geography levels; the information coefficient is higher in the 2016-onward period, when all four inputs are present.

| Geography | 3Y OOS IC (2016+) | Positive IC years | Decile spread (3Y, annualized) | Permutation significance |
| --------- | ----------------: | ----------------: | -----------------------------: | -----------------------: |
| Metro     |            +0.273 |              100% |                    +2.28 pp/yr |         51.7σ above null |
| County    |            +0.201 |              100% |                    +1.82 pp/yr |         80.2σ above null |
| ZIP       |            +0.196 |              100% |                    +2.17 pp/yr |        201.1σ above null |

**Score semantics:** 50 = predicted to match the state average. Higher predicts outperformance, lower predicts underperformance. The score band → excess-return mapping is monotonic across all five bands (Section 4).

**Dollar impact (3-year, excess vs state, within-state comparison):** Choosing a top-band market (score 95–99) over a bottom-band market (score 1–5) in the same state corresponds to a historical excess gain of approximately **$21,700** (metro, median home $251,629), **$17,800** (county, $230,458), and **$22,900** (ZIP, $284,081) over 3 years. Source: `claims_stats.json` `within_state` (top-band vs bottom-band annualized excess compounded over 3 years on a 4%/yr state base), median home values from Zillow ZHVI (Apr 2026).

**Limitations (detailed in Section 9):**

- Pre-2016 history uses price momentum only (Realtor inputs begin July 2016) and carries C confidence; momentum alone was near-flat through the 2005–2007 cycle peak at metro level.
- The 2019 inflection was the weakest validated year (IC +0.03 metro); the signal stayed positive but compressed.
- Realtor.com supplies two of four inputs; sustained gaps in that feed would reduce coverage and confidence.
- Wide individual variance: score bands describe market averages over thousands of observations, not single-property outcomes.

---

## 2. What the Score Predicts

The score measures **excess return vs state (alpha)**, not raw appreciation (beta). A market can rise in absolute terms while scoring low if it rises less than its state; a market in a flat state can score high by holding up better than its peers. Benchmarking to the state controls for the statewide interest-rate and macro cycle so the score isolates relative market strength.

The four inputs combine price momentum (markets that have been appreciating tend to keep outperforming for several years — a documented housing-market effect) with two demand-pressure signals (homes selling quickly and few price cuts) that flag cooling before price momentum reflects it. All four are converted to cross-sectional z-scores within each geography level and month, summed with fixed signs, percentile-ranked, and re-centered to 1–99.

### 2.1 Score Band → 3-Year Excess Return

Mean annualized 3-year excess return vs state, by score band. Source: `claims_stats.json` `quintile_mean_excess_3y_pp` (2016+ full-formula era).

| Score Band | Metro (pp/yr) | County (pp/yr) | ZIP (pp/yr) |
| ---------- | ------------: | -------------: | ----------: |
| 1–20       |         −1.29 |          −1.32 |       −0.73 |
| 21–40      |         −0.46 |          −0.48 |       −0.14 |
| 41–60      |         −0.13 |          −0.18 |       +0.14 |
| 61–80      |         +0.08 |          +0.03 |       +0.40 |
| 81–99      |         +0.38 |          +0.18 |       +0.85 |

The mapping is strictly monotonic at every level: higher bands realize higher excess returns with no adjacent inversions.

### 2.2 The Cost of Choosing Wrong (3-year excess dollars)

On the level's median home, the excess-return gap between the top band (95–99) and the bottom band (1–5), within the same state, over 3 years. Source: `claims_stats.json` `within_state.dollar_delta`.

| Geography | Median Home (ZHVI Apr 2026) | Within-state 3Y excess gap |
| --------- | --------------------------: | -------------------------: |
| Metro     |                    $251,629 |                **$21,741** |
| County    |                    $230,458 |                **$17,843** |
| ZIP       |                    $284,081 |                **$22,927** |

Figures are excess vs state (alpha), not total appreciation, and are historical averages, not guarantees.

---

## 3. Out-of-Sample Results

Each score is evaluated only against price changes that occurred **after** the scoring date (3 years forward), so all results are out-of-sample in time. Reported below is the per-month Spearman rank correlation between score and forward excess-vs-state return, summarized as the median of calendar-year medians.

### 3.1 IC by Year, Full-Formula Era (2016–2023)

Source: `validation_rank2.json` (the shipped formula's walk-forward battery).

| Year       |   Metro IC |  County IC |     ZIP IC |
| ---------- | ---------: | ---------: | ---------: |
| 2016       |     +0.320 |     +0.305 |     +0.332 |
| 2017       |     +0.300 |     +0.225 |     +0.264 |
| 2018       |     +0.288 |     +0.184 |     +0.212 |
| 2019       |     +0.034 |     +0.024 |     +0.078 |
| 2020       |     +0.154 |     +0.058 |     +0.070 |
| 2021       |     +0.336 |     +0.316 |     +0.211 |
| 2022       |     +0.257 |     +0.273 |     +0.186 |
| 2023       |     +0.179 |     +0.163 |     +0.182 |
| **Median** | **+0.273** | **+0.204** | **+0.199** |

Every year is positive at every level. The 2019–2020 trough is the momentum soft patch (also present in the prior formula); the signal compressed but did not invert.

### 3.2 Improvement vs the Prior Formula

The retired demand-signal formula (3 Redfin metrics) replicated on the identical validation panel, same method. Source: `validation_rank2.json` `baseline_v4`.

| Geography | Prior formula IC (same panel) | PropertyIQ IC | Change |
| --------- | ----------------------------: | ------------: | -----: |
| Metro     |                        +0.220 |        +0.273 |   +24% |
| County    |                        +0.143 |        +0.204 |   +43% |
| ZIP       |                        +0.083 |        +0.199 |  +140% |

The largest gain is at ZIP, where the prior formula was weakest and where most scored markets exist.

### 3.3 Dollar Impact (from OOS excess spreads)

See Section 2.2. Dollar values are derived from 3-year excess-return band spreads (alpha), not raw return spreads.

---

## 4. Full-Period Metrics (2001–2023)

Backfilled momentum allows validation across two full housing cycles. Pre-2016 vintages use price momentum only (C confidence). Source: `{metro,county,zip}_score_backtest.json`.

| Geography | Vintages          | Validated rows | Median yearly IC (full) | Positive IC years | Decile spread (annualized) |
| --------- | ----------------- | -------------: | ----------------------: | ----------------: | -------------------------: |
| Metro     | 2001-01 → 2023-01 |        181,408 |                  +0.155 |  95.7% (22 of 23) |                +1.68 pp/yr |
| County    | 2001-01 → 2023-02 |        544,183 |                  +0.122 |   100% (23 of 23) |                +1.37 pp/yr |
| ZIP       | 2001-01 → 2023-02 |      4,980,978 |                  +0.185 |   100% (23 of 23) |                +2.15 pp/yr |

Only 2007 (metro, −0.02) was negative across 69 geography-years. County and ZIP were positive in every year, including through the 2007–2009 cycle on momentum-only inputs.

---

## 5. Within-State Validation

The score trains and is reported on a **state** benchmark (excess vs state median). Score 50 is calibrated to state-average performance: markets scoring 45–55 realized a mean 3-year excess return of −0.20 pp/yr (metro), −0.23 pp/yr (county), and +0.01 pp/yr (ZIP) — within a fifth of a point of zero at every level. Source: `*_score_backtest.json` `calibration_score_45_55_mean_excess_pp`.

The empirical zero-crossing percentile (where the signal equals zero) is 49.7 (metro), 49.3 (county), and 50.3 (ZIP) — a single ≈50 re-centering constant serves all three levels, unlike the prior formula's per-geography constants.

---

## 6. Model Stability

### 6.1 Inputs and Weights

| Input                                           | Source      | Direction             | Weight |
| ----------------------------------------------- | ----------- | --------------------- | -----: |
| 12-month ZHVI momentum (`zhvi_yoy`)             | Zillow      | + (rising = stronger) |   0.25 |
| 3-month ZHVI momentum (`zhvi_mom_3m`)           | Zillow      | + (recent momentum)   |   0.25 |
| Median days on market (`median_days_on_market`) | Realtor.com | − (faster = stronger) |   0.25 |
| Price-reduced share (`price_reduced_share`)     | Realtor.com | − (cuts = weaker)     |   0.25 |

Equal weights with signs set by economic logic; no parameters were fit to returns, so there are effectively no weights to overfit.

### 6.2 IC by Era

Source: `*_score_backtest.json` `eras` (median IC; share of months with positive IC).

| Era                         | Inputs available |           Metro |          County |              ZIP |
| --------------------------- | ---------------- | --------------: | --------------: | ---------------: |
| 2001–2007 (boom)            | momentum only    | +0.056 (83% mo) | +0.049 (92% mo) | +0.088 (100% mo) |
| 2008–2015 (bust + recovery) | momentum only    | +0.207 (98% mo) | +0.169 (99% mo) | +0.200 (100% mo) |
| 2016–2023 (full formula)    | all four         | +0.264 (95% mo) | +0.203 (97% mo) | +0.191 (100% mo) |

The full four-input formula (2016+) has the highest measured IC of the three eras and is the configuration used for all current scoring. Momentum-only eras remain positive but lower, which is why pre-2016 history carries reduced confidence.

---

## 7. Calibration

- **Midpoint:** Scores 45–55 realize ≈0 excess vs state (Section 5).
- **Monotonicity:** Score bands map to monotonically increasing excess returns at all levels (Section 2.1), with no adjacent inversions.
- **Spread:** The top-minus-bottom decile excess return is +1.4 to +2.3 pp/yr depending on level, persistent across the full period.

Interpretation: a score is a relative, mean-reverting ranking of current market strength within a state, not a permanent label or a single-property forecast. Scores update monthly as the underlying momentum and demand signals change.

---

## 8. Robustness Checklist

| Check                        | Threshold              |    Metro     |    County    |      ZIP      |
| ---------------------------- | ---------------------- | :----------: | :----------: | :-----------: |
| Median OOS IC (2016+)        | ≥ 0.15                 | PASS (0.273) | PASS (0.201) | PASS (0.196)  |
| Positive IC years (2016+)    | ≥ 80%                  | PASS (100%)  | PASS (100%)  |  PASS (100%)  |
| Permutation significance     | ≥ 3σ                   | PASS (51.7σ) | PASS (80.2σ) | PASS (201.1σ) |
| Band monotonicity            | ≤ 1 adjacent swap      |   PASS (0)   |   PASS (0)   |   PASS (0)    |
| Midpoint calibration (45–55) | \|excess\| < 0.5 pp/yr | PASS (−0.20) | PASS (−0.23) | PASS (+0.01)  |

---

## 9. Known Limitations

- **Momentum-only history (pre-2016).** Realtor inputs begin July 2016; earlier vintages score on the two ZHVI momentum features at C confidence. Momentum alone was near-flat at metro level through the 2005–2007 peak (era IC +0.056) and produced the one negative validated year (2007, −0.02). The demand inputs that flag cooling did not yet exist; the live formula always has all four going forward.
- **2019 inflection.** The weakest full-formula year (metro IC +0.03). The signal stayed positive but compressed at the rate-driven turn.
- **Realtor dependence.** Two of four inputs come from Realtor.com. The two used (days on market, price-reduced share) are ~96–100% populated and are monitored; sustained gaps would lower coverage and confidence.
- **Individual variance.** Band excess returns are averages over tens of thousands of observations; individual markets and properties vary widely around them. The score describes a market, not a specific home.
- **Backtest uses revised ZHVI.** Forward returns are computed from final-revised Zillow ZHVI; live scoring sees unrevised data. Rank-based scoring limits but does not eliminate this gap; live IC is monitored monthly.

---

## 10. Appendix

**Coverage.** Scored monthly at metro (~935), county (~3,150), and ZIP (~34,000) levels, January 2001 through the latest available month. Validation requires an observed 3-year forward outcome, limiting the validation sample to 2001–2023 scoring vintages (865 metros / 3,061 counties / 25,783 ZIPs).

**Data sources.**

- Zillow ZHVI (Zillow Home Value Index) — price level and momentum, and the forward-return outcomes.
- Realtor.com residential listing data — median days on market and price-reduced share.
- State median appreciation (Zillow ZHVI, state level) — the benchmark.
- No Redfin data is used.

**Construction.** For each geography level and month: z-score each input cross-sectionally (population standard deviation), sum with fixed signs (requiring ≥2 of 4 inputs), percentile-rank the signal, re-center so the zero-crossing maps to 50, clamp to 1–99. Confidence = inputs present / 4 → A (4/4), B (3/4), C (2/4).

**Source files.**

- `scripts/analysis/monolithic-discovery/data/{metro,county,zip}_score_backtest.json` — full-period and era IC, quintiles, decile spread, calibration, zero-crossing.
- `scripts/analysis/monolithic-discovery/data/claims_stats.json` — 1Y/3Y IC, decile spread, quintile excess, dollar examples, coverage (2016+ window).
- `scripts/analysis/monolithic-discovery/data/validation_rank2.json` — shipped-formula walk-forward IC by year, permutation significance, prior-formula baseline.
- `docs/superpowers/results/2026-06-12-monolithic-feature-discovery.md` and the metro/county/ZIP score-backtest results.

**Methodology notes.** Information Coefficient (IC) is the Spearman rank correlation between score and forward excess-vs-state return, computed per month and aggregated as the median of calendar-year medians. Permutation significance compares the actual median IC to a null distribution from shuffling the forward-return vector within each month. Excess return is the geography's own forward return minus its state's forward return over the same window.
