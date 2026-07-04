# Realtor supply_score as a Months-of-Supply Substitute — Results

**Date run:** 2026-06-12
**Script:** `scripts/analysis/test_supply_score_zip.py`
**Question:** Can Realtor.com's `supply_score` (0–100 index) substitute for Redfin `months_of_supply` as the third PropertyIQ score input at ZIP level, where Redfin MoS coverage is thin and legacy Redfin deprecation looms?

## Verdict: NO — do not add Realtor supply_score to the PIQ signal

Adding z-scored Realtor `supply_score` to the 2-metric signal (sold-above-list + inverted DOM) **reduces** predictive power at both horizons. The 2-metric signal is the better fallback when Redfin MoS is unavailable.

## Method

- Metro cross-check: Spearman correlation of Realtor `supply_score` vs Redfin `months_of_supply` (All Residential), 2018+, to establish direction.
- ZIP test: IC (Spearman) of signal vs 1Y/3Y ZIP excess return over state (ZHVI), on the matched subset where ALL THREE metrics exist (same-sample comparison, n ≈ 988K obs 1Y / 745K obs 3Y).
- Signals: `2m = z(SAL) − z(DOM)`; `3m = z(SAL) − z(DOM) + z(supply_score)` (sign set by metro direction check).

## Results

**Metro cross-check (27,801 matched rows):**
Spearman = **−0.4911** (p≈0). Direction: higher supply_score = tighter market. Only a moderate correlation — supply_score is a noisy proxy for MoS, not a measurement of it.

**Same-sample IC comparison (ZIP):**

| Horizon          | 2-metric IC | 3-metric IC | Delta   |
| ---------------- | ----------- | ----------- | ------- |
| 1Y (987,888 obs) | **+0.1719** | +0.1592     | −0.0126 |
| 3Y (744,541 obs) | **+0.0894** | +0.0770     | −0.0124 |

**Year-by-year (1Y):** 3-metric loses in 7 of 9 years (2017–2020, 2023–2025); only 2021–2022 show a small gain (+0.016, +0.003). Same pattern at 3Y (loses 5 of 7 years).

## Coverage notes

- Realtor ZIP supply_score: 1,296,993 rows across **18,777 ZIPs** (2016+) — coverage is good; quality is the problem.
- Joining Realtor onto the Redfin-covered panel halves it (2.02M → 988K obs), i.e. supply_score also doesn't cover ~half the Redfin SAL/DOM panel rows.

## Implications for PIQ scoring

1. Where Redfin MoS is missing, **drop to the 2-metric signal** rather than substituting Realtor supply_score.
2. The production MoS fallback chain (`fallback-registry/calculated.ts`: legacy redfin → calculated_metrics from Redfin DC `active/sold`) remains the only MoS path. The Redfin DC computed fallback covers only ~93 metros.
3. If legacy Redfin MoS is ever fully deprecated, metros outside the DC top-~93 should be scored 2-metric, not back-filled with Realtor data.

## Caveats

- supply_score's sign was fit on the same panel (direction from metro check) — favourable to the 3-metric variant, and it still lost.
- IC measured against ZHVI excess return over state; consistent with PIQ V2 Plan A methodology.
- Redfin revises history; reruns will not reproduce these numbers exactly (see lessons on re-scoring).
