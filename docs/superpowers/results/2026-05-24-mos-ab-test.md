# A/B Test: legacy MoS vs computed MoS (active/sold) on v4 PropertyIQ score

**Date:** 2026-05-24
**Geo level:** metro
**Joined panel:** 14,404 rows (81 metros, 2012-01-31 to 2026-03-31)
**Hold constant:** sold_above_list, median_dom (legacy source)
**Swap:** months_of_supply
- A (current prod): `redfin_metro.months_of_supply`
- B (new RFDC): `rfdc_housing_market_metro.active_listings / homes_sold`

## Raw MoS comparison (input level)

- Spearman corr: **0.8716**
- Pearson corr: 0.6013
- Mean (legacy):   3.816
- Mean (computed): 4.557
- Mean abs diff:   1.344 months
- Median abs diff: 1.151 months

## Score-level comparison

- Spearman corr(score_A, score_B): **0.9740**
- Pearson corr: 0.9754
- Mean |Δscore|: **3.83** points
- Median |Δscore|: 2.00
- 90th pct |Δscore|: 9.00
- Max |Δscore|: 74.00
- % |Δscore| > 5: **19.8%**
- % |Δscore| > 10: 8.1%
- % |Δscore| > 20: 1.9%

## Predictive validity (IC vs 3-yr excess return)

- N obs with 3y forward: 9,651
- Score A (legacy MoS):   IC = **+0.3484**  hit = 0.589
- Score B (computed MoS): IC = **+0.3490**  hit = 0.595
- Δ IC (B − A): **+0.0006**

### Per-year IC

|       year |         n |    ic_A |    ic_B |   delta |
|-----------:|----------:|--------:|--------:|--------:|
| +2012.0000 | +700.0000 | +0.2909 | +0.2820 | -0.0089 |
| +2013.0000 | +735.0000 | +0.3337 | +0.3294 | -0.0042 |
| +2014.0000 | +791.0000 | +0.3137 | +0.2948 | -0.0189 |
| +2015.0000 | +877.0000 | +0.2746 | +0.2782 | +0.0036 |
| +2016.0000 | +908.0000 | +0.4311 | +0.4269 | -0.0043 |
| +2017.0000 | +904.0000 | +0.5228 | +0.5148 | -0.0080 |
| +2018.0000 | +910.0000 | +0.4779 | +0.4879 | +0.0100 |
| +2019.0000 | +910.0000 | +0.4481 | +0.4626 | +0.0144 |
| +2020.0000 | +875.0000 | +0.2443 | +0.2450 | +0.0007 |
| +2021.0000 | +875.0000 | +0.2826 | +0.2884 | +0.0058 |
| +2022.0000 | +874.0000 | +0.2930 | +0.2904 | -0.0026 |
| +2023.0000 | +292.0000 | +0.2680 | +0.2475 | -0.0205 |

## Top 20 divergences (by |Δscore|)

|   region_id | period_date         |   score_A |   score_B |   score_diff |
|------------:|:--------------------|----------:|----------:|-------------:|
|       10500 | 2025-11-30 00:00:00 |         2 |        76 |           74 |
|       23240 | 2012-09-30 00:00:00 |         2 |        61 |           59 |
|       47920 | 2013-11-30 00:00:00 |         9 |        67 |           58 |
|       33060 | 2021-09-30 00:00:00 |        77 |        21 |          -56 |
|       23240 | 2012-07-31 00:00:00 |         2 |        56 |           54 |
|       10500 | 2025-10-31 00:00:00 |         2 |        55 |           53 |
|       10500 | 2014-04-30 00:00:00 |        17 |        70 |           53 |
|       10500 | 2026-02-28 00:00:00 |        13 |        66 |           53 |
|       10500 | 2024-07-31 00:00:00 |         2 |        55 |           53 |
|       10500 | 2024-12-31 00:00:00 |        13 |        65 |           52 |
|       10500 | 2018-02-28 00:00:00 |        24 |        75 |           51 |
|       23240 | 2012-02-29 00:00:00 |         6 |        56 |           50 |
|       29780 | 2018-01-31 00:00:00 |         7 |        56 |           49 |
|       23240 | 2012-10-31 00:00:00 |         2 |        50 |           48 |
|       47920 | 2012-12-31 00:00:00 |        21 |        69 |           48 |
|       10500 | 2025-01-31 00:00:00 |        17 |        65 |           48 |
|       33060 | 2016-12-31 00:00:00 |        60 |        12 |          -48 |
|       47920 | 2013-02-28 00:00:00 |        12 |        59 |           47 |
|       33060 | 2025-04-30 00:00:00 |        58 |        12 |          -46 |
|       38860 | 2015-08-31 00:00:00 |        17 |        61 |           44 |

## Verdict

**ACCEPTABLE SWAP.** IC change is within noise. Individual scores shift modestly. Worth disclosing in a release note but not a methodology change.
