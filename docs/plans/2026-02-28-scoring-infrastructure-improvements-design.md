> **ARCHIVED:** This document describes the legacy 3-score system (HomeReady, InvestorEdge, MarketHealth) which was replaced by a single PropertyIQ Score in March 2026. See `docs/superpowers/specs/2026-03-29-propertyiq-single-score-redesign.md` for the current system.

# Scoring Infrastructure Improvements Design

**Date:** 2026-02-28
**Scope:** Three sequential improvements to the scoring/backtest pipeline

---

## Overview

Three improvements executed in dependency order:

1. **Cache preloader expansion** — Bulk-load Redfin, Realtor, and ZORI data into memory
2. **ZORI rent data wiring** — Fix outcome pipeline to use existing ZORI data + ACS fallback
3. **Isotonic calibration** — Compress score range to reduce MAD below 15 pp

## Current State

- `OutcomeCacheService` bulk-loads only Zillow ZHVI; Redfin/Realtor/ZORI hit DB per-query
- Outcome pipeline ignores ZORI data in DB (only 0.4% of outcomes have rent data despite hundreds of metros having ZORI coverage)
- Calibration MAD: HomeReady 16.46 pp, InvestorEdge 18.68 pp (target: <15 pp)
- Scores rank correctly (monotonic ordering, positive IC) but overstate tail divergence

---

## Task 1: Cache Preloader Expansion

### Problem

`OutcomeCacheService.preloadHistoricalData()` only loads `metric_name = 'zhvi'` from `zillow_*` tables. Redfin and Realtor fallback sources query the DB individually on cache miss, adding per-query latency during batch outcome population.

### Design

**Extend `OutcomeCacheService` with three new capabilities:**

#### A. ZORI preloading (same tables, different metric_name)

Modify `preloadHistoricalData()` to also query `metric_name = 'zori'` from the same `zillow_*` tables. Store ZORI values in the existing `HistoricalDataPoint.zori` field alongside ZHVI. This uses the same keyset pagination — just widens the `metric_name` filter from `= 'zhvi'` to `IN ('zhvi', 'zori')`, then routes values to the correct field based on metric name.

**Cache key stays the same:** `geoType:geoId:date` — the `HistoricalDataPoint` at that key gains a populated `zori` field.

#### B. Redfin preloading

New method `preloadRedfinData(geographyType)`:

- Keyset pagination over `redfin_[metro|county|zip]` (state not supported)
- Filter: `property_type = 'All Residential'`
- Cache structure: new `redfinCache` Map with key `geoType:geoId:date`
- Value: `{ date, price: median_sale_price }`
- Build `redfinDateIndex` for binary search

#### C. Realtor preloading

New method `preloadRealtorData(geographyType)`:

- Keyset pagination over `realtor_[metro|county|zip]` (state not supported)
- Cache structure: new `realtorCache` Map with key `geoType:geoId:date`
- Value: `{ date, price: median_listing_price }`
- Build `realtorDateIndex` for binary search

#### D. Update data source fallback chain

`OutcomeDataSourceService.getHistoricalData()` changes from:

```
Zillow cache → Redfin DB query → Realtor DB query
```

To:

```
Zillow cache (ZHVI + ZORI) → Redfin cache → Realtor cache → DB query (rare)
```

#### E. Update populate-outcomes.ts

Call all preloads at startup:

```typescript
await cache.preloadHistoricalData(geographyType); // Now loads ZHVI + ZORI
await cache.preloadRedfinData(geographyType);
await cache.preloadRealtorData(geographyType);
await cache.preloadBenchmarkData(); // Already loads ZHVI + ZORI benchmarks
```

### Files

| File                             | Change                                                                        |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `outcome-cache.service.ts`       | Widen ZHVI query to include ZORI; add Redfin/Realtor caches + preload methods |
| `outcome-data-source.service.ts` | Update fallback chain to check Redfin/Realtor caches before DB                |
| `populate-outcomes.ts`           | Call new preload methods at startup                                           |

---

## Task 2: ZORI Rent Data Wiring + ACS Fallback

### Problem

ZORI data exists in `zillow_[metro|county|zip]` for hundreds of metros plus county/zip coverage. But the outcome pipeline returns `zori: undefined` because:

1. The cache preloader filters to `metric_name = 'zhvi'` only (fixed in Task 1)
2. `getHistoricalData()` never populates the `zori` field
3. No ACS fallback for smaller metros where Zillow doesn't publish ZORI

### Rent Data Availability

| Geo Level | Primary Source                  | Fallback                     |
| --------- | ------------------------------- | ---------------------------- |
| Metro     | ZORI (hundreds of major metros) | Census ACS median gross rent |
| County    | ZORI                            | Census ACS median gross rent |
| ZIP       | ZORI                            | Census ACS median gross rent |

Zillow ignores smaller metros — ACS covers the gap.

### Design

#### A. Populate ZORI from cache (mostly handled by Task 1)

After Task 1, `preloadHistoricalData()` loads both ZHVI and ZORI into `HistoricalDataPoint`. The `getHistoricalData()` method already returns `HistoricalDataPoint` — it now naturally includes `zori` values.

#### B. ACS fallback for rent data

When ZORI is missing (smaller metros, sparse county/zip), fall back to Census ACS:

New method `getAcsRentData(geographyType, geographyId, date)` in `OutcomeDataSourceService`:

- Query `census_[metro|county|zip]` table for `metric_name = 'median_gross_rent'`
- Return value to populate `zori` field on `HistoricalDataPoint`
- Only called when ZORI is null after cache lookup

Update `getHistoricalData()`:

```
1. Check Zillow cache → get ZHVI + ZORI
2. If ZORI is null → try ACS rent data
3. If ZHVI is null → fallback to Redfin/Realtor cache (existing chain)
```

#### C. Verify outcome generator uses rent data

`OutcomeGeneratorService` and `OutcomeBenchmarkService` already have logic to calculate `rentChange`, `rentCagr`, `rentReturn1y`, `rentReturn3yCagr` — they just need non-null `zori` values to activate. No changes expected here, but verify after wiring.

### Files

| File                             | Change                                                  |
| -------------------------------- | ------------------------------------------------------- |
| `outcome-data-source.service.ts` | Add ACS rent fallback; ensure `zori` field is populated |
| `outcome-generator.types.ts`     | Add ACS table route helper if needed                    |

### Validation

After Tasks 1+2, re-run `populate-outcomes.ts` and check:

- ZORI coverage jumps from 0.4% to expected range (50%+ of metro outcomes)
- Rent return fields (`rentCagr`, `rentReturn1y`, etc.) populate in outcomes
- InvestorEdge can be validated against total-return target

---

## Task 3: Isotonic Calibration

### Problem

Scores rank markets correctly but MAD exceeds 15 pp target:

- HomeReady: 16.46 pp
- InvestorEdge: 18.68 pp

Tail divergence pattern: predicted 95th percentile → actual 66th percentile returns.

### Design: Python Trains → JSON Lookup → TypeScript Applies

#### A. Python training script

New: `scripts/analysis/train_calibration.py`

1. Load backtest outcomes from `propertyiq_backtest_outcomes`
2. For each `(score_type, geo_level)` combination:
   - Compute predicted percentile (score / 100) and actual return percentile rank
   - Bin into ventiles (20 bins) for smoother curve
   - Fit `sklearn.isotonic.IsotonicRegression(y_min=0, y_max=100, increasing=True)`
   - Map predicted percentile → actual return percentile
3. Export `scripts/analysis/output/calibration_tables.json`:
   ```json
   {
     "homeready_metro": [
       {"raw": 2.5, "calibrated": 24.1},
       {"raw": 7.5, "calibrated": 28.3},
       ...20 points...
     ],
     "investoredge_metro": [...],
     "homeready_county": [...],
     "investoredge_county": [...]
   }
   ```
4. Copy to `packages/backend/src/scoring/calibration/calibration-tables.json`
5. Log before/after MAD for each combination

#### B. TypeScript calibration service

New: `packages/backend/src/scoring/calibration/calibration.service.ts`

```typescript
@Injectable()
export class CalibrationService {
  private tables: Map<string, CalibrationPoint[]>;

  onModuleInit() {
    // Load calibration-tables.json
  }

  calibrate(rawScore: number, scoreType: string, geoLevel: string): number {
    const key = `${scoreType}_${geoLevel}`;
    const table = this.tables.get(key);
    if (!table) return rawScore; // Identity fallback
    return piecewiseLinearInterpolate(table, rawScore);
  }
}
```

Piecewise linear interpolation between lookup points — monotonic by construction.

#### C. Integration point

In `scoring-engine.ts`, after `normalizeScores()` produces 0-100 percentile ranks:

```typescript
const normalized = normalizeScores(rawScores);
const calibrated = normalized.map((s) => ({
  ...s,
  score: calibrationService.calibrate(s.score, scoreType, geoLevel),
}));
```

#### D. Validation

Update `validate_scores.py`:

1. After running standard calibration check, also run with isotonic-adjusted scores
2. Report before/after MAD comparison
3. Target: MAD < 15 pp for both HomeReady and InvestorEdge

### Files

| File                                                                    | Change                                 |
| ----------------------------------------------------------------------- | -------------------------------------- |
| New: `scripts/analysis/train_calibration.py`                            | Isotonic training + export             |
| New: `packages/backend/src/scoring/calibration/calibration.service.ts`  | Load tables + interpolate              |
| New: `packages/backend/src/scoring/calibration/calibration-tables.json` | Generated lookup tables                |
| `scoring-engine.ts`                                                     | Call `calibrate()` after normalization |
| `scoring.module.ts`                                                     | Register `CalibrationService`          |
| `validate_scores.py`                                                    | Add post-calibration MAD check         |

---

## Execution Order & Dependencies

```
Task 1: Cache Preloader Expansion
  ├── Extends cache to load ZHVI + ZORI + Redfin + Realtor
  └── Updates fallback chain to check all caches
         ↓
Task 2: ZORI Rent Wiring + ACS Fallback
  ├── Adds ACS rent fallback for missing ZORI
  ├── Verifies rent returns populate in outcomes
  └── Re-runs outcome population + validates ZORI coverage
         ↓
Task 3: Isotonic Calibration
  ├── Trains on improved outcome data (with rent returns)
  ├── Exports calibration tables
  ├── Integrates into scoring engine
  └── Validates MAD < 15 pp
```

## Success Criteria

1. **Task 1:** All data sources preloaded; outcome population runs with zero per-query DB fallbacks for Redfin/Realtor
2. **Task 2:** ZORI coverage in outcomes jumps to 50%+ for metro; rent return fields populated; ACS fills remaining gaps
3. **Task 3:** Calibration MAD < 15 pp for both HomeReady and InvestorEdge at metro level
