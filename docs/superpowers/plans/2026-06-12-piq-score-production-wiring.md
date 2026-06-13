# PIQ Score Production Wiring + Full Backfill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Redfin-based PIQ formula with the validated Zillow+Realtor formula in the production scoring engine, and backfill the full score history (2001 → present) for metro, county, and ZIP.

**Architecture:** The TS engine's shape is unchanged (z-scores → signal → percentile → re-center → 1–99). We swap the metric config in `formula-weights.ts`, rewrite the data fetcher to read Zillow ZHVI momentum + Realtor DOM/price-cuts, and make the engine metric-name-generic. History is backfilled by a Python generator that replicates the TS engine **bit-for-bit** (population std, average-rank percentiles, zero-crossing 50, same rounding), loaded via `psql \copy`. A shadow-compare gate proves TS and Python produce identical scores for the same month before we call it done.

**Tech Stack:** NestJS backend (`packages/backend/src/scoring/`), Python 3.12 + pandas (`scripts/analysis/monolithic-discovery/`), Supabase Postgres via psql, Jest.

**Decisions locked by the user:**

- NO version numbers anywhere (no "v5"; `score_type` stays `'propertyiq'`; remove `-v4` route and `PROPERTYIQ_FORMULA_VERSION`).
- Backfill as far back as possible: 2001-01 (momentum-only before 2016-07, ≥2-of-4 rule, C confidence).
- The new formula (validated 2026-06-12): `signal = z(zhvi_yoy) + z(zhvi_mom_3m) − z(median_days_on_market) − z(price_reduced_share)`, zero-crossing **50.0 at all levels**.

**Verified facts the plan relies on (do not re-derive):**

- Write target: `propertyiq_scores_v2`; unique constraint `(geography, location_id, score_type, score_date)` named `unique_normalized_score`; `id` has a sequence default; `created_at` defaults to `now()`; no triggers. `propertyiq_scores` is a passthrough view.
- `score_date` convention: **month-end** dates (e.g. `2026-03-31`). `toEndOfMonth()` exists in `scoring-data-helpers.ts:121`.
- `z_scores` JSONB stores **raw input values** keyed by metric name (today: `{"sold_above_list":…,"median_dom":…,"months_of_supply":…}`).
- Engine z-score uses **population std (ddof=0)** — `propertyiq-scoring-engine.ts:66-72`. Python must match (pandas default is ddof=1 — must override).
- ID join keys: zillow_metro→`cbsa_code`, zillow_county→`fips_code`, zillow_zip→`lpad(region_name,5,'0')` (its `region_id` is Zillow-internal); realtor: `cbsa_code`/`county_fips`/`postal_code` (all 5-char padded).
- Name conventions in existing rows: metro `"Rochester, NY metro area"` (new writes strip the suffix — keep stripping), county `"Amelia County, VA"`, zip = the postal code string.
- `return_1y`/`return_3y_ann` columns are 0% populated — write NULL.
- Coverage after swap: metro ~876 Zillow ∪ 935 Realtor (vs 926 today), county ~3,150 (vs 2,818), zip ~34,000 (vs 19,411). Realtor-only regions score on 2 features at C confidence.
- Scoring trigger: admin `POST /api/scores/calculate/:geography` (`scoring.controller.ts:282`); no cron.
- Latest data: zillow zhvi 2026-04-30; realtor 2026-04-01 → latest scorable month 2026-04-30 (currently frozen at 2026-03-31 — this plan unfreezes it).

**File map:**

| File                                                                       | Action           | Responsibility                                                                |
| -------------------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------- |
| `scripts/analysis/monolithic-discovery/backfill_generate.py`               | Create           | Generate backfill CSVs replicating the TS engine exactly                      |
| `scripts/analysis/monolithic-discovery/claims_stats.py`                    | Create           | Compute 1Y+3Y claim stats from backfilled scores for validation-claims.ts     |
| `packages/backend/src/scoring/formula-weights.ts`                          | Modify (649–705) | New metric list/directions/zero-crossing/calibration; delete version constant |
| `packages/backend/src/scoring/propertyiq-scoring-engine.ts`                | Modify           | Generic metric access + inputMetrics; delete FORMULA_VERSION export           |
| `packages/backend/src/scoring/propertyiq-data-fetcher.ts`                  | Rewrite          | Zillow momentum + Realtor fetch; `getLatestScorableDate()`                    |
| `packages/backend/src/scoring/scoring.service.ts`                          | Modify (95–141)  | Use new date helper; updated comments                                         |
| `packages/backend/src/scoring/scoring.controller.ts`                       | Modify (316–342) | Delete `/calculate-v4/:geography` route                                       |
| `packages/backend/src/scoring/__tests__/propertyiq-scoring-engine.spec.ts` | Modify/Create    | Engine unit tests with new metrics                                            |
| `packages/frontend/app/graphs/constants/scoreFormulas.ts`                  | Modify (54–62)   | Populate 4-metric formula for waterfall                                       |
| `packages/frontend/app/scores/ScoresFaqSection.tsx`                        | Modify           | "three input metrics" → four; new metric names                                |
| `packages/frontend/lib/data/validation-claims.ts`                          | Modify           | Refresh all IC/spread/coverage claims from artifacts                          |

**Execution order matters:** Tasks 1–3 (backfill data path) are independent of Tasks 4–8 (TS wiring) — they can run in parallel streams, but Task 9 (load) must precede Task 10 (shadow-compare), which needs Tasks 4–8 done.

---

### Task 1: Python backfill generator

**Files:**

- Create: `scripts/analysis/monolithic-discovery/backfill_generate.py`

The generator must replicate the TS engine exactly: population std (ddof=0), average-rank percentile (pandas `rank(method='average', pct=True)` matches the engine), zero-crossing 50.0, `Math.round` + clamp(1,99), ≥2-of-4 features. Outer-join Zillow+Realtor so Realtor-only regions are scored (C confidence).

- [ ] **Step 1: Write the generator**

```python
"""Generate the full PIQ score backfill (2001 -> present) as CSVs for \\copy.

Replicates packages/backend/src/scoring/propertyiq-scoring-engine.ts exactly:
  - z-scores with POPULATION std (ddof=0), skipped when <2 valid or std=0
  - signal = +z(zhvi_yoy) +z(zhvi_mom_3m) -z(median_days_on_market)
             -z(price_reduced_share), requiring >=2 of 4 features
  - percentile rank: average-rank method (pandas rank(pct=True)*100)
  - recenter: piecewise [0,50]->[1,50], [50,100]->[50,99]; round; clamp 1..99
  - confidence = round(n_features/4*100) -> letter via 80/65/45 thresholds
  - grade from GRADE_THRESHOLDS (A+ 97+, A 93+, A- 90+, B+ 87+, B 83+, B- 80+,
    C+ 77+, C 73+, C- 70+, D+ 67+, D 63+, D- 60+, F below)

Output: data/backfill_{level}.csv with columns matching propertyiq_scores_v2
(id and created_at omitted - DB defaults).

Usage:
    python backfill_generate.py --level metro
    python backfill_generate.py --level all
"""

import argparse
import csv
import json
from pathlib import Path

import numpy as np
import pandas as pd

from db import get_engine

DATA_DIR = Path(__file__).parent / "data"
ZERO_CROSSING = 50.0
MIN_FEATURES = 2
MIN_CROSS_SECTION = 30
FEATURES = ["zhvi_yoy", "zhvi_mom_3m", "median_days_on_market", "price_reduced_share"]
SIGNS = np.array([1, 1, -1, -1])

GRADE_STEPS = [
    (97, "A+"), (93, "A"), (90, "A-"), (87, "B+"), (83, "B"), (80, "B-"),
    (77, "C+"), (73, "C"), (70, "C-"), (67, "D+"), (63, "D"), (60, "D-"),
]

LEVELS = {
    "metro": dict(ztab="zillow_metro", zid="cbsa_code",
                  rtab="realtor_metro", rid="cbsa_code", rname="cbsa_title"),
    "county": dict(ztab="zillow_county", zid="fips_code",
                   rtab="realtor_county", rid="county_fips", rname="county_name"),
    "zip": dict(ztab="zillow_zip", zid="lpad(region_name, 5, '0')",
                rtab="realtor_zip", rid="postal_code", rname="zip_name"),
}


def grade_for(score: int) -> str:
    for floor, grade in GRADE_STEPS:
        if score >= floor:
            return grade
    return "F"


def confidence_letter(conf: int) -> str:
    if conf >= 80:
        return "A"
    if conf >= 65:
        return "B"
    if conf >= 45:
        return "C"
    return "F"


def load_zillow(engine, level):
    cfg = LEVELS[level]
    name_cols = {
        "metro": ", region_name AS zname, state_code",
        "county": ", region_name AS zname, state_code",
        "zip": ", region_name AS zname, state_code",
    }[level]
    df = pd.read_sql(
        f"""SELECT {cfg['zid']} AS location_id, period_date, value{name_cols}
            FROM {cfg['ztab']}
            WHERE metric_name='zhvi' AND {cfg['zid']} IS NOT NULL""",
        engine,
    )
    df["month"] = pd.to_datetime(df["period_date"]).dt.to_period("M")
    mat = df.pivot_table(index="month", columns="location_id", values="value",
                         aggfunc="last").sort_index()
    feats = pd.concat(
        {
            "zhvi_yoy": mat.pct_change(12, fill_method=None).stack(),
            "zhvi_mom_3m": mat.pct_change(3, fill_method=None).stack(),
            "zhvi": mat.stack(),
        },
        axis=1,
    ).reset_index()
    feats.columns = ["month", "location_id", "zhvi_yoy", "zhvi_mom_3m", "zhvi"]

    # Display-name map per the production convention.
    names = df.sort_values("period_date").drop_duplicates("location_id", keep="last")
    if level == "metro":
        name_map = dict(zip(names["location_id"], names["zname"]))
    elif level == "county":
        name_map = {
            r.location_id: f"{r.zname}, {r.state_code}"
            for r in names.itertuples()
        }
    else:
        name_map = dict(zip(names["location_id"], names["location_id"]))
    return feats, name_map


def load_realtor(engine, level):
    cfg = LEVELS[level]
    df = pd.read_sql(
        f"""SELECT {cfg['rid']} AS location_id, period_date,
                   median_days_on_market, price_reduced_share,
                   {cfg['rname']} AS rname
            FROM {cfg['rtab']}""",
        engine,
    )
    df["month"] = pd.to_datetime(df["period_date"]).dt.to_period("M")
    df = df.drop_duplicates(subset=["location_id", "month"], keep="last")

    names = df.sort_values("month").drop_duplicates("location_id", keep="last")
    if level == "metro":
        name_map = dict(zip(names["location_id"], names["rname"]))
    elif level == "county":
        # realtor county_name is lowercase "autauga, al" -> "Autauga County, AL"
        def fmt(n):
            try:
                base, st = n.rsplit(",", 1)
                return f"{base.strip().title()} County, {st.strip().upper()}"
            except (ValueError, AttributeError):
                return n
        name_map = {r.location_id: fmt(r.rname) for r in names.itertuples()}
    else:
        name_map = dict(zip(names["location_id"], names["location_id"]))
    return df[["location_id", "month", "median_days_on_market",
               "price_reduced_share"]], name_map


def compute(level, engine):
    zfeats, znames = load_zillow(engine, level)
    rfeats, rnames = load_realtor(engine, level)
    panel = zfeats.merge(rfeats, on=["location_id", "month"], how="outer")
    panel = panel[panel["month"] >= pd.Period("2001-01")]

    # Cross-sectional z-scores, POPULATION std (ddof=0), matching the engine.
    grouped = panel.groupby("month")
    zcols = []
    for col in FEATURES:
        mean = grouped[col].transform("mean")
        std = grouped[col].transform(lambda s: s.std(ddof=0))
        n = grouped[col].transform("count")
        z = (panel[col] - mean) / std
        z[(n < MIN_CROSS_SECTION) | (std == 0)] = np.nan
        zcols.append(f"z_{col}")
        panel[f"z_{col}"] = z

    zmat = panel[zcols].to_numpy()
    panel["n_features"] = np.isfinite(zmat).sum(axis=1)
    panel["signal"] = np.nansum(zmat * SIGNS, axis=1)
    panel = panel[panel["n_features"] >= MIN_FEATURES].copy()

    panel["pct_rank"] = (
        panel.groupby("month")["signal"].rank(method="average", pct=True) * 100
    )
    pct = panel["pct_rank"].to_numpy()
    raw = np.where(
        pct <= ZERO_CROSSING,
        1 + (pct / ZERO_CROSSING) * 49,
        50 + (pct - ZERO_CROSSING) / (100 - ZERO_CROSSING) * 49,
    )
    # np.round uses banker's rounding; Math.round rounds half UP. Match TS:
    panel["score"] = np.clip(np.floor(raw + 0.5), 1, 99).astype(int)

    panel["confidence"] = (panel["n_features"] / len(FEATURES) * 100).round().astype(int)
    panel["confidence_level"] = panel["confidence"].map(confidence_letter)
    panel["grade"] = panel["score"].map(grade_for)
    panel["location_name"] = panel["location_id"].map(
        lambda i: znames.get(i) or rnames.get(i) or i
    )
    panel["median_price"] = panel["zhvi"].round(2)
    panel["score_date"] = panel["month"].dt.to_timestamp("M").dt.date  # month-end

    def zjson(row):
        def val(c, nd):
            v = row[c]
            return None if pd.isna(v) else round(float(v), nd)
        return json.dumps({
            "zhvi_yoy": val("zhvi_yoy", 6),
            "zhvi_mom_3m": val("zhvi_mom_3m", 6),
            "median_days_on_market": val("median_days_on_market", 1),
            "price_reduced_share": val("price_reduced_share", 6),
        })
    panel["z_scores"] = panel.apply(zjson, axis=1)
    panel["geography"] = level
    panel["score_type"] = "propertyiq"

    out_cols = ["geography", "location_id", "location_name", "score_type",
                "score", "grade", "confidence", "confidence_level",
                "median_price", "score_date", "z_scores"]
    out = DATA_DIR / f"backfill_{level}.csv"
    panel[out_cols].to_csv(out, index=False, quoting=csv.QUOTE_MINIMAL)
    print(f"[{level}] wrote {out}: rows={len(panel):,} "
          f"regions={panel['location_id'].nunique():,} "
          f"months={panel['month'].nunique()} "
          f"latest={panel['score_date'].max()} "
          f"score_mean={panel['score'].mean():.1f}")
    return len(panel)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--level", choices=[*LEVELS, "all"], required=True)
    args = parser.parse_args()
    engine = get_engine()
    for lvl in (list(LEVELS) if args.level == "all" else [args.level]):
        compute(lvl, engine)
```

- [ ] **Step 2: Run for metro and sanity-check**

Run: `cd scripts/analysis/monolithic-discovery && python backfill_generate.py --level metro`
Expected: `rows≈230,000` (outer join adds Realtor-only metros vs the 213k analysis panel), `regions≈940`, `latest=2026-04-30`, `score_mean≈50`.

- [ ] **Step 3: Spot-verify three known values against the analysis parquet**

```python
# quick check: scores correlate ~1.0 with the analysis history for overlapping cells
import pandas as pd
new = pd.read_csv("data/backfill_metro.csv", parse_dates=["score_date"])
old = pd.read_parquet("data/metro_score_history.parquet")
old["score_date"] = old["month"] + pd.offsets.MonthEnd(0)
m = new.merge(old, on=["location_id", "score_date"], suffixes=("_new", "_old"))
print(len(m), (m.score_new - m.score_old).abs().describe())
```

Expected: mean |diff| < 1.5 (differences come only from ddof and zc 49.7→50.0); correlation > 0.999. If mean |diff| > 3, STOP — a replication bug exists.

- [ ] **Step 4: Run county and zip**

Run: `python backfill_generate.py --level county && python backfill_generate.py --level zip`
Expected: county rows ≈ 700k, zip rows ≈ 7M (zip CSV ≈ 1 GB; takes several minutes).

- [ ] **Step 5: Commit the generator**

```bash
git add scripts/analysis/monolithic-discovery/backfill_generate.py
git commit -m "feat(scoring): backfill generator replicating production engine for the new formula"
```

---

### Task 2: Snapshot + load the backfill into propertyiq_scores_v2

**Files:** none (psql against prod DB; connection string from `packages/backend/.env` `SUPABASE_DB_URL`)

- [ ] **Step 1: Snapshot existing propertyiq rows**

```sql
CREATE TABLE backup_piq_scores_propertyiq_20260612 AS
  SELECT * FROM propertyiq_scores_v2 WHERE score_type = 'propertyiq';
-- verify: SELECT count(*) FROM backup_piq_scores_propertyiq_20260612;  -- expect 2,423,756
```

- [ ] **Step 2: Delete old propertyiq rows** (batched to avoid statement timeout)

```sql
-- repeat until 0 rows affected:
DELETE FROM propertyiq_scores_v2
WHERE id IN (SELECT id FROM propertyiq_scores_v2
             WHERE score_type='propertyiq' LIMIT 500000);
```

- [ ] **Step 3: Load CSVs**

```bash
psql "$DBURL" -c "\copy propertyiq_scores_v2 (geography, location_id, location_name, score_type, score, grade, confidence, confidence_level, median_price, score_date, z_scores) FROM 'data/backfill_metro.csv' WITH (FORMAT csv, HEADER true)"
# repeat for backfill_county.csv and backfill_zip.csv
```

- [ ] **Step 4: Verify**

```sql
SELECT geography, count(*), count(DISTINCT location_id), min(score_date), max(score_date),
       round(avg(score),1)
FROM propertyiq_scores_v2 WHERE score_type='propertyiq' GROUP BY 1;
-- expect: metro ~230k rows/~940 regions, county ~700k/~3150, zip ~7M/~34000;
-- min 2001-01-31 (metro/county) ; max = 2026-04-30 for ALL THREE; avg score ≈ 50
SELECT score, grade, confidence, confidence_level, z_scores
FROM propertyiq_scores_v2
WHERE score_type='propertyiq' AND geography='metro' AND score_date='2026-04-30'
ORDER BY score DESC LIMIT 5;  -- eyeball: A+ grades, 4-key z_scores JSON
ANALYZE propertyiq_scores_v2;
```

- [ ] **Step 5: Verify the frontend still renders scores (backfill-only state)**

Open `https://propertyiq.up.railway.app` scores page or local dev `/scores` — score widgets must render (reads are view-based and shape-compatible). Per the live-data rule: real browser, real page, no mocks.

---

### Task 3: Claims statistics artifact

**Files:**

- Create: `scripts/analysis/monolithic-discovery/claims_stats.py`

- [ ] **Step 1: Write + run a script that emits every number validation-claims.ts needs**

```python
"""Compute 1Y and 3Y claim stats for validation-claims.ts from the backfill CSVs
joined to zhvi_forward_returns (excess vs state). Emits data/claims_stats.json:
per level: median yearly IC (1y, 3y), decile spread pp (1y, 3y), quintile mean
excess (3y), hit rate (% positive years), coverage counts, score-99-vs-1 dollar
deltas on the level's median ZHVI.
"""
# Implementation mirrors evaluate() in score_backtest.py with two horizons:
# join return_1y AND return_3y_ann, excess vs state via score_geo_state_map,
# restrict to 2016+ (full-formula era — the production claims window),
# and additionally compute:
#   appreciation_99 = mean (1+return_3y_ann)^3-1 where score==99
#   appreciation_1  = same for score==1
#   dollar_examples on median ZHVI per level (metro 251629, county 230458, zip 284081)
```

(Full evaluate() logic already exists in `score_backtest.py` — import and reuse `monthly_ic_series`-style grouping; do not duplicate math.)

Run: `python claims_stats.py`
Expected: `data/claims_stats.json` with all fields non-null for all 3 levels.

- [ ] **Step 2: Commit**

```bash
git add scripts/analysis/monolithic-discovery/claims_stats.py
git commit -m "feat(scoring): claims statistics artifact for validation-claims refresh"
```

---

### Task 4: formula-weights.ts — new metric config

**Files:**

- Modify: `packages/backend/src/scoring/formula-weights.ts:649-705`

- [ ] **Step 1: Replace the v4 block (lines 649–705) with:**

```typescript
// ============================================================================
// PropertyIQ Demand Signal Formula (Zillow + Realtor.com)
// ============================================================================

/**
 * PropertyIQ formula — price momentum + market-flow confirmation.
 * signal = z(zhvi_yoy) + z(zhvi_mom_3m) - z(median_days_on_market)
 *          - z(price_reduced_share)
 * Discovered + validated 2026-06-12 (docs/superpowers/results/
 * 2026-06-12-monolithic-feature-discovery.md and the three score backtests).
 */
export const PROPERTYIQ_FORMULA_METRICS = [
  "zhvi_yoy",
  "zhvi_mom_3m",
  "median_days_on_market",
  "price_reduced_share",
] as const;

export const PROPERTYIQ_METRIC_DIRECTIONS: Record<string, 1 | -1> = {
  zhvi_yoy: 1, // rising values = hotter
  zhvi_mom_3m: 1, // recent momentum = hotter
  median_days_on_market: -1, // fast sales = hotter
  price_reduced_share: -1, // price cuts = colder
};

/**
 * Zero-crossing percentile: where signal = 0 maps to score 50.
 * The new signal is symmetric — one constant for every geography level
 * (empirical: metro 49.7, county 49.3, zip 50.3; backtests 2026-06-12).
 */
export const PROPERTYIQ_ZERO_CROSSING: Record<GeographyLevel, number> = {
  metro: 50.0,
  county: 50.0,
  zip: 50.0,
};

/**
 * Calibration: mean 3Y-forward ANNUALIZED excess return vs state by score band,
 * full-formula era (2016-2023), averaged across metro/county/zip backtests.
 */
export const PROPERTYIQ_CALIBRATION: CalibrationEntry[] = [
  { quintile: 1, scoreRange: [1, 20], label: "Bottom", avgExcessReturn: -1.11 },
  {
    quintile: 2,
    scoreRange: [21, 40],
    label: "Below Avg",
    avgExcessReturn: -0.36,
  },
  {
    quintile: 3,
    scoreRange: [41, 60],
    label: "Average",
    avgExcessReturn: -0.06,
  },
  {
    quintile: 4,
    scoreRange: [61, 80],
    label: "Above Avg",
    avgExcessReturn: +0.17,
  },
  { quintile: 5, scoreRange: [81, 99], label: "Top", avgExcessReturn: +0.47 },
];
```

Note: `PROPERTYIQ_FORMULA_VERSION` is **deleted** (no version numbers). The next task fixes its one consumer.

- [ ] **Step 2: Find every consumer of the deleted constant and the old metric names**

Run: `cd packages/backend && grep -rn "PROPERTYIQ_FORMULA_VERSION\|FORMULA_VERSION" src/ && grep -rn "sold_above_list\|months_of_supply" src/scoring/`
Expected consumers to fix in Tasks 5–7: `propertyiq-scoring-engine.ts` (import + re-export), possibly `scoring.controller.ts` logs. Old metric names must remain ONLY in `scoring-data-fetcher.ts` (v3 legacy file, untouched) and comments slated for update.

- [ ] **Step 3: Compile check**

Run: `cd packages/backend && npx tsc --noEmit`
Expected: errors ONLY in `propertyiq-scoring-engine.ts` (fixed next task). Anything else → fix before proceeding.

- [ ] **Step 4: Commit** (engine fix lands in the next commit; commit here only if the tree compiles — otherwise commit Tasks 4+5 together)

---

### Task 5: Engine — generic metric access

**Files:**

- Modify: `packages/backend/src/scoring/propertyiq-scoring-engine.ts`
- Test: `packages/backend/src/scoring/__tests__/propertyiq-scoring-engine.spec.ts`

- [ ] **Step 1: Replace `getMetricValue` (lines 48–63) with the dynamic-key version**

```typescript
/** Extract the raw value for a formula metric from a LocationMetrics record.
 *  All four metrics are set as dynamic keys by fetchPropertyIqMetrics. */
function getMetricValue(loc: LocationMetrics, metric: string): number | null {
  return (loc as Record<string, any>)[metric] ?? null;
}
```

- [ ] **Step 2: Make `inputMetrics` generic**

In `PropertyIqScoreResult` (lines 37–41) replace the 3-key interface with:

```typescript
inputMetrics: Record<string, number | null>;
```

In the result construction (lines 266–270) replace the hardcoded object with:

```typescript
      inputMetrics: Object.fromEntries(
        PROPERTYIQ_FORMULA_METRICS.map((m) => [m, getMetricValue(loc, m)]),
      ),
```

- [ ] **Step 3: Remove version branding**

Delete line 278 (`export const FORMULA_VERSION = PROPERTYIQ_FORMULA_VERSION;`) and the `PROPERTYIQ_FORMULA_VERSION` import (line 17). Update the file-top docblock (lines 1–10) and step comments (190–196, 210–211) to describe the new 4-metric formula — no "v4" wording.

- [ ] **Step 4: Update/write engine unit tests**

Check for an existing spec: `ls packages/backend/src/scoring/__tests__/`. Update (or create) `propertyiq-scoring-engine.spec.ts` with a hand-computable fixture:

```typescript
import { calculatePropertyIqScores } from "../propertyiq-scoring-engine";
import type { LocationMetrics } from "../scoring.types";

function loc(id: string, m: Record<string, number | null>): LocationMetrics {
  return { location_id: id, location_name: id, ...m } as any;
}

describe("calculatePropertyIqScores with the momentum+flow formula", () => {
  it("scores hot market above cold market, 50-centered", () => {
    // 5 locations, symmetric values: middle location must land at score 50.
    const locations = [
      loc("hot", {
        zhvi_yoy: 0.1,
        zhvi_mom_3m: 0.03,
        median_days_on_market: 20,
        price_reduced_share: 0.05,
      }),
      loc("warm", {
        zhvi_yoy: 0.07,
        zhvi_mom_3m: 0.02,
        median_days_on_market: 30,
        price_reduced_share: 0.1,
      }),
      loc("mid", {
        zhvi_yoy: 0.05,
        zhvi_mom_3m: 0.01,
        median_days_on_market: 40,
        price_reduced_share: 0.15,
      }),
      loc("cool", {
        zhvi_yoy: 0.03,
        zhvi_mom_3m: 0.0,
        median_days_on_market: 50,
        price_reduced_share: 0.2,
      }),
      loc("cold", {
        zhvi_yoy: 0.0,
        zhvi_mom_3m: -0.01,
        median_days_on_market: 60,
        price_reduced_share: 0.25,
      }),
    ];
    const results = calculatePropertyIqScores(locations, "metro");
    const byId = Object.fromEntries(results.map((r) => [r.locationId, r]));
    expect(results).toHaveLength(5);
    expect(byId.hot.score).toBeGreaterThan(byId.cold.score);
    expect(byId.mid.score).toBe(50); // median of 5 → pct 50 → zero-crossing 50 → score 50
    expect(byId.hot.confidence).toBe(100); // 4/4
    expect(byId.hot.confidenceLevel).toBe("A");
    expect(byId.hot.inputMetrics.zhvi_yoy).toBe(0.1);
  });

  it("scores with 2 of 4 features at C confidence (momentum-only)", () => {
    const locations = [
      loc("a", {
        zhvi_yoy: 0.1,
        zhvi_mom_3m: 0.03,
        median_days_on_market: null,
        price_reduced_share: null,
      }),
      loc("b", {
        zhvi_yoy: 0.05,
        zhvi_mom_3m: 0.01,
        median_days_on_market: null,
        price_reduced_share: null,
      }),
      loc("c", {
        zhvi_yoy: 0.0,
        zhvi_mom_3m: -0.01,
        median_days_on_market: null,
        price_reduced_share: null,
      }),
    ];
    const results = calculatePropertyIqScores(locations, "zip");
    expect(results).toHaveLength(3);
    expect(results[0].confidence).toBe(50); // 2/4
    expect(results[0].confidenceLevel).toBe("C");
  });

  it("skips locations with fewer than 2 features", () => {
    const locations = [
      loc("a", {
        zhvi_yoy: 0.1,
        zhvi_mom_3m: 0.03,
        median_days_on_market: 20,
        price_reduced_share: 0.05,
      }),
      loc("b", {
        zhvi_yoy: 0.05,
        zhvi_mom_3m: 0.01,
        median_days_on_market: 30,
        price_reduced_share: 0.1,
      }),
      loc("only-one", {
        zhvi_yoy: 0.02,
        zhvi_mom_3m: null,
        median_days_on_market: null,
        price_reduced_share: null,
      }),
    ];
    const results = calculatePropertyIqScores(locations, "metro");
    expect(results.map((r) => r.locationId)).not.toContain("only-one");
  });
});
```

- [ ] **Step 5: Run the tests**

Run: `cd packages/backend && npx jest src/scoring/__tests__/propertyiq-scoring-engine.spec.ts`
Expected: PASS (3 tests). If `mid.score` ≠ 50, the zero-crossing change didn't land — check Task 4.

- [ ] **Step 6: Commit Tasks 4+5 together**

```bash
git add packages/backend/src/scoring/formula-weights.ts packages/backend/src/scoring/propertyiq-scoring-engine.ts packages/backend/src/scoring/__tests__/propertyiq-scoring-engine.spec.ts
git commit -m "feat(scoring): swap PIQ formula to momentum+flow metrics, zero-crossing 50, generic engine"
```

---

### Task 6: Data fetcher rewrite

**Files:**

- Rewrite: `packages/backend/src/scoring/propertyiq-data-fetcher.ts`

- [ ] **Step 1: Replace the entire file**

```typescript
/**
 * PropertyIQ Scoring Data Fetcher
 *
 * Fetches the 4 formula inputs:
 *   - zhvi_yoy, zhvi_mom_3m   — derived from Zillow ZHVI (16-month window)
 *   - median_days_on_market, price_reduced_share — Realtor.com monthly
 *
 * Regions are the UNION of Zillow and Realtor coverage; the engine scores
 * any region with >=2 features (Realtor-only regions get C confidence).
 * median_price is the region's current ZHVI.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { GeographyLevel } from "./formula-weights";
import { LocationMetrics } from "./scoring.types";
import { PAGE_SIZE, toEndOfMonth } from "./scoring-data-helpers";

const ZILLOW_TABLES: Record<GeographyLevel, { table: string; idCol: string }> =
  {
    metro: { table: "zillow_metro", idCol: "cbsa_code" },
    county: { table: "zillow_county", idCol: "fips_code" },
    zip: { table: "zillow_zip", idCol: "region_name" }, // postal code lives in region_name
  };

const REALTOR_TABLES: Record<
  GeographyLevel,
  { table: string; idCol: string; nameCol: string }
> = {
  metro: { table: "realtor_metro", idCol: "cbsa_code", nameCol: "cbsa_title" },
  county: {
    table: "realtor_county",
    idCol: "county_fips",
    nameCol: "county_name",
  },
  zip: { table: "realtor_zip", idCol: "postal_code", nameCol: "zip_name" },
};

const pad5 = (v: string) => String(v).padStart(5, "0");

function monthsBack(monthEnd: string, n: number): string {
  const [y, m] = monthEnd.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 - n, 1));
  return toEndOfMonth(
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`,
  );
}

async function pageAll(
  supabase: SupabaseClient,
  build: (from: number, to: number) => any,
): Promise<Record<string, any>[]> {
  const rows: Record<string, any>[] = [];
  let page = 0;
  while (true) {
    const from = page * PAGE_SIZE;
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`scoring fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    page += 1;
  }
  return rows;
}

/** Latest month-end scorable: min(latest zillow zhvi, latest realtor) for the geo. */
export async function getLatestScorableDate(
  supabase: SupabaseClient,
  geography: GeographyLevel,
): Promise<string | null> {
  const z = ZILLOW_TABLES[geography];
  const r = REALTOR_TABLES[geography];
  const [{ data: zd }, { data: rd }] = await Promise.all([
    supabase
      .from(z.table)
      .select("period_date")
      .eq("metric_name", "zhvi")
      .order("period_date", { ascending: false })
      .limit(1),
    supabase
      .from(r.table)
      .select("period_date")
      .order("period_date", { ascending: false })
      .limit(1),
  ]);
  const zDate = zd?.[0]?.period_date;
  const rDate = rd?.[0]?.period_date;
  if (!zDate && !rDate) return null;
  // Compare by month; score the earlier of the two so all 4 inputs exist.
  const months = [zDate, rDate]
    .filter(Boolean)
    .map((d: string) => d.slice(0, 7))
    .sort();
  return toEndOfMonth(`${months[0]}-01`);
}

/** ZHVI rows for one month-end date, keyed by location id. */
async function fetchZhviAt(
  supabase: SupabaseClient,
  geography: GeographyLevel,
  monthEnd: string,
): Promise<Map<string, number>> {
  const z = ZILLOW_TABLES[geography];
  const rows = await pageAll(supabase, (from, to) =>
    supabase
      .from(z.table)
      .select(`${z.idCol}, value`)
      .eq("metric_name", "zhvi")
      .eq("period_date", monthEnd)
      .not(z.idCol, "is", null)
      .order(z.idCol, { ascending: true })
      .range(from, to),
  );
  const map = new Map<string, number>();
  for (const row of rows) {
    const id = geography === "zip" ? pad5(row[z.idCol]) : String(row[z.idCol]);
    if (row.value != null) map.set(id, Number(row.value));
  }
  return map;
}

/** Zillow display names (metro "City, ST"; county "X County, ST"; zip = id). */
async function fetchZillowNames(
  supabase: SupabaseClient,
  geography: GeographyLevel,
  monthEnd: string,
): Promise<Map<string, string>> {
  const z = ZILLOW_TABLES[geography];
  const names = new Map<string, string>();
  if (geography === "zip") return names; // zip display name is the postal code
  const rows = await pageAll(supabase, (from, to) =>
    supabase
      .from(z.table)
      .select(`${z.idCol}, region_name, state_code`)
      .eq("metric_name", "zhvi")
      .eq("period_date", monthEnd)
      .not(z.idCol, "is", null)
      .order(z.idCol, { ascending: true })
      .range(from, to),
  );
  for (const row of rows) {
    const id = String(row[z.idCol]);
    names.set(
      id,
      geography === "county"
        ? `${row.region_name}, ${row.state_code}`
        : String(row.region_name),
    );
  }
  return names;
}

/** Realtor DOM + price_reduced_share for the month containing monthEnd. */
async function fetchRealtorAt(
  supabase: SupabaseClient,
  geography: GeographyLevel,
  monthEnd: string,
): Promise<
  Map<string, { dom: number | null; prs: number | null; name: string }>
> {
  const r = REALTOR_TABLES[geography];
  const monthStart = `${monthEnd.slice(0, 7)}-01`;
  const rows = await pageAll(supabase, (from, to) =>
    supabase
      .from(r.table)
      .select(
        `${r.idCol}, median_days_on_market, price_reduced_share, ${r.nameCol}`,
      )
      .eq("period_date", monthStart)
      .order(r.idCol, { ascending: true })
      .range(from, to),
  );
  const map = new Map<
    string,
    { dom: number | null; prs: number | null; name: string }
  >();
  for (const row of rows) {
    map.set(String(row[r.idCol]), {
      dom:
        row.median_days_on_market != null
          ? Number(row.median_days_on_market)
          : null,
      prs:
        row.price_reduced_share != null
          ? Number(row.price_reduced_share)
          : null,
      name: String(row[r.nameCol] ?? row[r.idCol]),
    });
  }
  return map;
}

/**
 * Fetch the 4 PropertyIQ formula inputs for every region at a geography level.
 * periodDate may be any day in the target month; normalized to month-end.
 */
export async function fetchPropertyIqMetrics(
  supabase: SupabaseClient,
  geography: GeographyLevel,
  periodDate: string,
): Promise<LocationMetrics[]> {
  const monthEnd = toEndOfMonth(periodDate);
  const [zhviNow, zhvi3m, zhvi12m, names, realtor] = await Promise.all([
    fetchZhviAt(supabase, geography, monthEnd),
    fetchZhviAt(supabase, geography, monthsBack(monthEnd, 3)),
    fetchZhviAt(supabase, geography, monthsBack(monthEnd, 12)),
    fetchZillowNames(supabase, geography, monthEnd),
    fetchRealtorAt(supabase, geography, monthEnd),
  ]);

  const allIds = new Set<string>([...zhviNow.keys(), ...realtor.keys()]);
  const results: LocationMetrics[] = [];

  for (const id of allIds) {
    const now = zhviNow.get(id);
    const prev3 = zhvi3m.get(id);
    const prev12 = zhvi12m.get(id);
    const rl = realtor.get(id);

    const loc: Record<string, any> = {
      location_id: id,
      location_name: (names.get(id) ?? rl?.name ?? id).replace(
        /\s+metro area$/i,
        "",
      ),
      median_price: now ?? undefined,
      zhvi_yoy:
        now != null && prev12 != null && prev12 !== 0 ? now / prev12 - 1 : null,
      zhvi_mom_3m:
        now != null && prev3 != null && prev3 !== 0 ? now / prev3 - 1 : null,
      median_days_on_market: rl?.dom ?? null,
      price_reduced_share: rl?.prs ?? null,
    };
    results.push(loc as LocationMetrics);
  }

  return results;
}
```

- [ ] **Step 2: Fix the service's date helper import**

In `scoring.service.ts` (around lines 99–104): replace `getLatestRedfinDate(this.supabase, geography)` with `getLatestScorableDate(this.supabase, geography)`; import it from `./propertyiq-data-fetcher` (remove the `getLatestRedfinDate` import if now unused). Update the method docblock (lines 91–94) to name the 4 new metrics, and the error message `'No Redfin data found for …'` → `'No scorable Zillow/Realtor data found for …'`.

- [ ] **Step 3: Find broken imports of deleted exports**

Run: `cd packages/backend && grep -rn "fetchCalculatedMosMap\|mergeMosFallback\|getLatestRedfinDate" src/`
`fetchCalculatedMosMap`/`mergeMosFallback` are deleted — fix or delete any importer (likely only tests). `getLatestRedfinDate` stays in `scoring-data-fetcher.ts` (v3 file) but must no longer be imported by `scoring.service.ts`.

- [ ] **Step 4: Compile + run all scoring tests**

Run: `cd packages/backend && npx tsc --noEmit && npx jest src/scoring`
Expected: clean compile; tests pass (after deleting/updating any test of the removed MoS fallback helpers).

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/scoring/
git commit -m "feat(scoring): fetch PIQ inputs from Zillow momentum + Realtor flow metrics"
```

---

### Task 7: Controller cleanup (no version numbers)

**Files:**

- Modify: `packages/backend/src/scoring/scoring.controller.ts:316-342`

- [ ] **Step 1: Delete the `POST /calculate-v4/:geography` route entirely** (the plain `/calculate/:geography` at line 282 stays and already delegates to the same service method). Check nothing references it: `grep -rn "calculate-v4" packages/ scripts/ docs/ --include="*.ts" --include="*.tsx"`. Update any hits to use `/calculate/:geography`.

- [ ] **Step 2: Compile + commit**

```bash
cd packages/backend && npx tsc --noEmit
git add packages/backend/src/scoring/scoring.controller.ts
git commit -m "refactor(scoring): drop version-numbered calculate route"
```

---

### Task 8: Frontend updates

**Files:**

- Modify: `packages/frontend/app/graphs/constants/scoreFormulas.ts:54-62`
- Modify: `packages/frontend/app/scores/ScoresFaqSection.tsx` ("all three input metrics" passage)
- Modify: `packages/frontend/lib/data/validation-claims.ts:16-52`

- [ ] **Step 1: Populate SCORE_FORMULAS** (waterfall breakdown — same 4 components at every level)

```typescript
const PROPERTYIQ_FORMULA: ScoreFormula = {
  zhvi_yoy: { label: "12-Month Price Momentum", weight: 0.25, direction: 1 },
  zhvi_mom_3m: { label: "3-Month Price Momentum", weight: 0.25, direction: 1 },
  median_days_on_market: {
    label: "Days on Market",
    weight: 0.25,
    direction: -1,
  },
  price_reduced_share: {
    label: "Price Cut Share",
    weight: 0.25,
    direction: -1,
  },
};

export const SCORE_FORMULAS: Record<string, GeographyFormulas> = {
  metro: { propertyiq: PROPERTYIQ_FORMULA },
  county: { propertyiq: PROPERTYIQ_FORMULA },
  zip: { propertyiq: PROPERTYIQ_FORMULA },
};
```

(Adapt field shape to the existing `ScoreFormula` type — read the type first; if it expects plain weights `Record<string, number>`, use `{ zhvi_yoy: 0.25, … }` and put labels where the waterfall expects them. Verify against `useWaterfallData.ts:503-545` consumption.)

- [ ] **Step 2: FAQ copy** — replace the "all three input metrics" passage with the four-metric description, using the plain-English names from `docs/superpowers/results/2026-06-12-piq-score-defense-and-explainer.md` §1 (price growth past year / price growth last 3 months / days on market / price cuts). Mention confidence letters reflect how many of the four inputs are available.

- [ ] **Step 3: validation-claims.ts** — replace each constant with the matching field from `scripts/analysis/monolithic-discovery/data/claims_stats.json` (Task 3 artifact). Mapping: 3Y OOS IC ← `levels.metro.ic_3y_median_yearly`, 1Y IC ← `ic_1y_median_yearly`, decile/quintile spreads ← `spread_*`, coverage counts ← `n_regions` per level, dollar examples ← `dollar_examples`. Update the comment header to cite the 2026-06-12 backtest artifacts as the source of truth. Grep consumers (`grep -rn "validation-claims" packages/frontend/`) and confirm displayed labels still match semantics (annualized vs cumulative — claims file must say which).

- [ ] **Step 4: Build + render check**

Run: `cd packages/frontend && npm run build`
Expected: clean build. Then on local dev or prod: open a metro page score widget AND the score breakdown (Pro user) — four components render with the new labels; FAQ shows new text.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/app/graphs/constants/scoreFormulas.ts packages/frontend/app/scores/ScoresFaqSection.tsx packages/frontend/lib/data/validation-claims.ts
git commit -m "feat(scoring): frontend formula breakdown, FAQ, and validation claims for the new PIQ formula"
```

---

### Task 9: Shadow-compare gate (TS engine vs Python backfill)

**Files:** none (runtime verification on real DB)

- [ ] **Step 1: Run the TS scorer for the latest month at each geography**

With the local backend running against prod DB (or via the deployed admin API):

```bash
curl -X POST "$API/api/scores/calculate/metro?period_date=2026-04-30" -H "Authorization: Bearer $ADMIN_TOKEN"
curl -X POST "$API/api/scores/calculate/county?period_date=2026-04-30" -H "Authorization: Bearer $ADMIN_TOKEN"
curl -X POST "$API/api/scores/calculate/zip?period_date=2026-04-30" -H "Authorization: Bearer $ADMIN_TOKEN"
```

Expected response per call: `{ calculated: <≈ region count>, errors: 0, scoreDate: "2026-04-30" }`. This UPSERTS over the backfilled 2026-04-30 rows — which is exactly the comparison we want.

- [ ] **Step 2: Compare in SQL** (backup table has nothing for this month; compare upserted rows against the backfill CSV reloaded into a temp table)

```sql
CREATE TEMP TABLE backfill_apr AS SELECT * FROM propertyiq_scores_v2 WHERE false;
-- \copy backfill_apr (geography, location_id, location_name, score_type, score, grade, confidence, confidence_level, median_price, score_date, z_scores) FROM 'data/backfill_metro.csv' CSV HEADER
-- (filter to 2026-04-30 after load, repeat for county/zip or pre-filter the CSVs)
SELECT b.geography,
       count(*) AS n,
       count(*) FILTER (WHERE abs(p.score - b.score) <= 1) AS within_1,
       round(100.0 * count(*) FILTER (WHERE abs(p.score - b.score) <= 1) / count(*), 2) AS pct_within_1
FROM backfill_apr b
JOIN propertyiq_scores_v2 p
  ON p.geography=b.geography AND p.location_id=b.location_id
 AND p.score_type='propertyiq' AND p.score_date=b.score_date
WHERE b.score_date='2026-04-30'
GROUP BY 1;
```

**Gate: `pct_within_1 >= 99` for every geography.** If it fails, diff a few rows' `z_scores` JSON between the two sources — mismatches are almost always (a) ddof, (b) rounding mode, (c) realtor month alignment, or (d) zip padding. Fix the side that deviates from the engine, regenerate, reload, re-run. Do NOT proceed until the gate passes.

- [ ] **Step 3: E2E render check (live data rule)**

Open the app in a real browser: a metro page, a county page, a ZIP page. Verify: score renders, grade/confidence shown, score history chart includes pre-2016 history, breakdown shows 4 components. Check an April-2026 score exists (pipeline unfrozen).

- [ ] **Step 4: Full test suite + builds**

Run: `cd packages/backend && npm test && npm run build && cd ../frontend && npm run build`
Expected: all green.

---

### Task 10: Documentation + memory

- [ ] **Step 1:** Update `CLAUDE.md` §9 (score formula description: new 4 metrics, zero-crossing 50, confidence = inputs/4, coverage counts) — keep it version-free.
- [ ] **Step 2:** Append a "Productionized 2026-06-12" note to `docs/superpowers/results/2026-06-12-monolithic-feature-discovery.md` next-steps section, marking items done.
- [ ] **Step 3:** Update memory file `project_score-pipeline-frozen-march-2026.md`: pipeline UNFROZEN (April 2026 scores live), formula swapped, backfill to 2001 loaded, backup table name.
- [ ] **Step 4: Final commit**

```bash
git add CLAUDE.md docs/
git commit -m "docs(scoring): document the productionized PIQ formula and unfrozen pipeline"
```

---

## Self-review notes

- **Spec coverage:** user asked for (a) wiring → Tasks 4–8; (b) max backfill per geo → Tasks 1–2 (2001+, outer-join coverage); (c) no version numbers → Tasks 4 (constant deleted), 5 (export deleted), 7 (route deleted).
- **Type consistency:** `getLatestScorableDate` defined in Task 6 Step 1, consumed in Task 6 Step 2. `PROPERTYIQ_FORMULA_METRICS` new values (Task 4) consumed generically by engine (Task 5) and set as dynamic keys by fetcher (Task 6) — key names match exactly (`zhvi_yoy`, `zhvi_mom_3m`, `median_days_on_market`, `price_reduced_share`).
- **Known judgment calls baked in:** calibration table uses 3-level average of full-formula-era annualized values; median_price semantics change from Redfin median sale price → ZHVI (documented in CLAUDE.md update); metro display names lose the " metro area" suffix (the current fetcher already strips it on new writes).
