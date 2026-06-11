# A/B Test (county): legacy MoS vs computed MoS

**Date:** 2026-05-24
**Geo level:** county
**Zero-crossing:** 62.4 (v4 default for this geo)
**Joined panel:** 444,479 rows (3,039 countys)
**Date range:** 2012-01-31 to 2026-03-31
**Hold constant:** sold_above_list, median_dom (legacy source)
**Swap:** months_of_supply
- A (current prod): `redfin_county.months_of_supply`
- B (new RFDC): `redfin_dc_housing_market_county.active_listings / homes_sold`

## Raw MoS comparison

- Spearman: **0.9870**
- Pearson: 0.9872
- Mean (legacy): 6.117
- Mean (computed): 7.299
- Mean abs diff: 1.234

## Score-level

- Spearman(A, B): **0.9976**
- Mean |Δscore|: **0.91**
- Median: 1.00
- 90th pct: 2.00
- Max: 89
- % |Δ| > 5: **1.4%**
- % |Δ| > 10: 0.3%
- % |Δ| > 20: 0.1%

## Predictive validity (IC vs 3y excess return)

- N with forward: 329,525
- Score A (legacy MoS):   IC = **+0.1677**  hit = 0.564
- Score B (computed MoS): IC = **+0.1666**  hit = 0.564
- Δ IC (B − A): **-0.0011**
- Δ hit:        **-0.0002**

### Per-year IC

|       year |           n |    ic_A |    ic_B |   delta |
|-----------:|------------:|--------:|--------:|--------:|
| +2012.0000 | +20429.0000 | +0.1815 | +0.1822 | +0.0007 |
| +2013.0000 | +22448.0000 | +0.2050 | +0.2054 | +0.0004 |
| +2014.0000 | +25153.0000 | +0.2028 | +0.2037 | +0.0009 |
| +2015.0000 | +26938.0000 | +0.2188 | +0.2179 | -0.0009 |
| +2016.0000 | +30368.0000 | +0.2408 | +0.2391 | -0.0017 |
| +2017.0000 | +31229.0000 | +0.1365 | +0.1345 | -0.0020 |
| +2018.0000 | +31641.0000 | +0.0829 | +0.0809 | -0.0020 |
| +2019.0000 | +31999.0000 | +0.0509 | +0.0506 | -0.0003 |
| +2020.0000 | +32439.0000 | +0.1384 | +0.1379 | -0.0005 |
| +2021.0000 | +32822.0000 | +0.2208 | +0.2185 | -0.0023 |
| +2022.0000 | +33093.0000 | +0.2555 | +0.2523 | -0.0032 |
| +2023.0000 | +10966.0000 | +0.1946 | +0.1922 | -0.0025 |

## Verdict

**SAFE TO SWAP.** Score-level Spearman > 0.99, mean |Δ| < 3, ΔIC ≈ 0.
