# A/B Test (zip): 2-metric baseline vs 3-metric with computed MoS

**Date:** 2026-05-24
**Geo level:** zip
**Zero-crossing:** 33.4 (v4 default for this geo)
**Joined panel:** 1,614,110 rows (23,826 zips)
**Date range:** 2019-06-30 to 2026-03-31

**Test type:** ADDITION (not swap). Legacy `redfin_zip.months_of_supply` is 100% NULL — Redfin does not publish MoS at the ZIP level. The v4 prod formula at ZIP is therefore a 2-metric signal `z(SAL) - z(DOM)`. The new RFDC data unlocks the option to compute MoS via `active_listings / homes_sold`, allowing a 3-metric formula at ZIP for the first time.

- **A (current v4 prod ZIP):** `signal = z(SAL) - z(DOM)`
- **B (new with RFDC MoS):** `signal = z(SAL) - z(DOM) - z(computed_MoS)`

## Score-level comparison

| Metric              | Value           |
| ------------------- | --------------- |
| Spearman corr(A, B) | **0.9364**      |
| Mean \|Δscore\|     | **6.86 points** |
| Median \|Δscore\|   | 4.00            |
| Max \|Δscore\|      | 98              |
| % rows \|Δ\| > 5    | **39.2%**       |
| % rows \|Δ\| > 10   | 20.6%           |
| % rows \|Δ\| > 20   | 7.3%            |

## Predictive validity (IC vs 3-yr excess return)

N with 3y forward: 343,415

| Variant                |                               IC | Hit rate |
| ---------------------- | -------------------------------: | -------: |
| A (2-metric baseline)  |                      **+0.0310** |    0.514 |
| B (3-metric, adds MoS) |                      **+0.0574** |    0.519 |
| Δ                      | **+0.0264** (~85% relative lift) |   +0.005 |

### Per-year IC (partial — full table truncated by script crash on report write)

| year |       n |    ic_A |    ic_B |   delta |
| ---: | ------: | ------: | ------: | ------: |
| 2019 | 126,767 | +0.0319 | +0.0452 | +0.0134 |
| 2020 | 216,648 | +0.0298 | +0.0641 | +0.0343 |

Per-year lift is consistent in the years observed.

## Verdict

**Upgrade.** Adding computed MoS to the ZIP formula provides a **material lift** in predictive power — ΔIC of +0.0264 nearly doubles the IC at this geo level (where the 2-metric baseline is weak at +0.031). Hit rate also nudges up (+0.5pp).

**User-visible impact:** ~40% of ZIPs will see their score shift by more than 5 points. 7% will shift by more than 20 points. This is the biggest user-facing change of any geo level — communicate clearly when rolling out.

## Comparison across all 3 geo levels

| Geo            | Test type                   | Score Spearman | Mean \|Δ\| |         ΔIC | Verdict                     |
| -------------- | --------------------------- | -------------: | ---------: | ----------: | --------------------------- |
| Metro (92)     | swap legacy → computed MoS  |          0.974 |       3.83 |     +0.0006 | Safe swap, equivalent       |
| County (3,039) | swap legacy → computed MoS  |          0.998 |       0.91 |     -0.0011 | Safe swap, equivalent       |
| ZIP (23,826)   | add computed MoS (3rd term) |          0.936 |       6.86 | **+0.0264** | **Upgrade — material lift** |
