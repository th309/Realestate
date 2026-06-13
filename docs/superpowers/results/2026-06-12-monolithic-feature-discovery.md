# Monolithic Score Feature Discovery — Results

**Date:** 2026-06-12
**Spec:** `docs/superpowers/specs/2026-06-12-monolithic-score-feature-discovery-design.md`
**Code:** `scripts/analysis/monolithic-discovery/` (panels → SHAP ranking → exhaustive formula search → validation battery)

## Question

Redfin Data Center collapsed metro coverage to 93 metros and dropped/redefined 2 of the current score's 3 inputs. Find the best 3–5 features for a single monolithic formula — identical at metro, county, and ZIP, **no Redfin** — that matches the predictive power of the current formula (target: 3Y forward excess ZHVI return vs state).

## Headline result

**Two formulas beat the current score at every geography level.** Both use only Realtor.com + Zillow features with full coverage at all three levels (panel: 866 metros / 3,064 counties / 25,846 ZIPs, vintages 2016-07 → 2023-01, walk-forward, no leakage).

### Recommended: Candidate B (4 features)

```
signal = z(zhvi_yoy) + z(zhvi_mom_3m) − z(median_days_on_market) − z(price_reduced_share)
```

| Level  | New IC    | Current v4 IC (replicated, same panel) | Lift      |
| ------ | --------- | -------------------------------------- | --------- |
| Metro  | **0.273** | 0.220                                  | +24%      |
| County | **0.204** | 0.143                                  | +43%      |
| ZIP    | **0.199** | 0.083                                  | **+141%** |

### Formal worst-level winner: Candidate A (4 features)

```
signal = z(zhvi_yoy) + z(zhvi_mom_3m) + z(pending_ratio) − z(price_reduced_share)
```

| Level  | New IC    | Current v4 IC | Lift  |
| ------ | --------- | ------------- | ----- |
| Metro  | 0.232     | 0.220         | +5%   |
| County | 0.202     | 0.143         | +41%  |
| ZIP    | **0.202** | 0.083         | +144% |

**Why recommend B over A despite A's marginally higher worst-level IC (0.202 vs 0.199):**
B is dramatically stronger at metro (0.273 vs 0.232), `median_days_on_market` has better ZIP coverage than `pending_ratio` (96.5% vs 81% of target rows → more scoreable ZIPs), and DOM is continuous with the current formula's `median_dom` (easier user-facing explanation). The ZIP difference (−0.003) is noise.

## Validation battery (both candidates)

| Gate                                          | Requirement    | A                   | B                   |
| --------------------------------------------- | -------------- | ------------------- | ------------------- |
| Positive IC years                             | ≥80% per level | **100%** all levels | **100%** all levels |
| Permutation significance                      | ≥3σ            | 46–196σ             | 52–201σ             |
| Decile spread (annualized excess, top−bottom) | —              | 1.7–2.3pp           | 1.8–2.3pp           |
| Worst-level median yearly IC                  | ≥0.15          | 0.202               | 0.199               |

Year-by-year IC, Candidate B (metro / county / zip):

| Year | Metro | County | ZIP   |
| ---- | ----- | ------ | ----- |
| 2016 | 0.320 | 0.305  | 0.332 |
| 2017 | 0.300 | 0.225  | 0.264 |
| 2018 | 0.288 | 0.184  | 0.212 |
| 2019 | 0.034 | 0.024  | 0.078 |
| 2020 | 0.154 | 0.058  | 0.070 |
| 2021 | 0.336 | 0.316  | 0.211 |
| 2022 | 0.257 | 0.273  | 0.186 |
| 2023 | 0.179 | 0.163  | 0.182 |

2019–2020 is the momentum soft patch (true for the current formula too — its county 2018–2019 ICs were 0.06/0.04). No negative years anywhere.

## What the SHAP analysis showed

Walk-forward LightGBM mean |SHAP| (normalized within level, averaged across levels so each level votes equally):

1. `zhvi_yoy` (0.156) — #1 at all three levels individually; univariate IC 0.17–0.25 alone
2. `zhvi_accel` (0.107) — high SHAP but adds nothing in linear combos (captured by yoy+3m)
3. `zhvi_mom_3m` (0.095)
4. `active_listing_count_yy` (0.073)
5. `price_increased_share` (0.071)
6. `pending_ratio` (0.061)
   …then listing-price YoY, inventory YoY, DOM, and the rest.

Price momentum dominates: trailing ZHVI appreciation is by far the strongest predictor of 3-year forward excess appreciation. The demand/supply features (pending ratio, DOM, price cuts) add confirmation and damp momentum's weak years. 1,507 signed equal-weight combos (3/4/5 features from the top 12) were evaluated exhaustively; the top ~20 all share the `zhvi_yoy + zhvi_mom_3m` core.

## Key facts discovered along the way

- **The current formula was never strong below metro:** replicated v4 IC is 0.220 metro but only 0.143 county and 0.083 ZIP. Published claims (~0.23) reflect metro. The new formula's biggest win is ZIP, where most of the score inventory lives (19,880 scored ZIPs).
- **Redfin DC metro coverage is 93 metros** (vs 932 legacy) — confirmed in our own `redfin_dc_housing_market_metro`. County (3,138) and ZIP (33,362) remain full, but ZIP history starts 2019-04.
- **`calculated_metrics` is stale** — every derived column (momentum, volatility, etc.) is 0% populated over the last 12 months. All derivations in this analysis were computed fresh from raw series; production must do the same or fix that pipeline.
- **`zillow_zip.region_id` is a Zillow-internal id**; the postal code is in `region_name`. Metro joins use `cbsa_code`, county uses `fips_code`.
- **Sources for the new formula:** Zillow ZHVI (monthly, 2000+, 866/3,073/26,307 regions) and Realtor.com monthly inventory files (2016-07+, 935/3,142/34,199 regions; DOM and price_reduced_share ~96–100% populated at every level). Both already ingested monthly.

## Risks / caveats

- **Realtor.com becomes a load-bearing source** (2 of 4 features). Its `hotness_score` is already only ~half-populated; monitor the core columns (DOM, price_reduced_share) for the same erosion Redfin exhibited.
- Momentum-heavy formulas underperform at inflection points (2019). The demand confirmations mitigate but don't eliminate this; year ICs stayed positive through the 2019 trough and the 2021–22 reversal.
- Panel ends at 2023-01 vintages by construction (3Y outcomes must be observable). The formula is monthly-refreshable in production from day one.

## Next steps (not in this analysis's scope)

1. Wire Candidate B into `propertyiq-scoring-engine.ts` (swap metric list + directions; engine shape unchanged: z-scores → signal → percentile → re-center).
2. New data fetcher reading Zillow ZHVI + Realtor tables instead of legacy Redfin (3-of-4 minimum-metrics rule mirrors today's 2-of-3).
3. Re-derive zero-crossing percentiles and quintile calibration ($ claims) for the new signal.
4. Shadow-score one month alongside v4 before cutover; refresh `validation-claims.ts` from this analysis.
