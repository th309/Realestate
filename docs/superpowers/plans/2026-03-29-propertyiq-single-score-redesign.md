# PropertyIQ Single Score Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 3 scores (HomeReady, InvestorEdge, MarketHealth) with a single PropertyIQ Score across the entire platform — backend engine, frontend components, all pages.

**Architecture:** Additive-then-subtractive migration. Add v4 engine and `'propertyiq'` score type alongside v3, calculate new scores, migrate frontend one page at a time, then remove old code and data. Site never breaks because old paths work until new paths are verified.

**Tech Stack:** NestJS (backend), Next.js 16 + React 19 (frontend), Supabase (DB), Jest (backend tests), Vitest (frontend tests)

**Spec:** `docs/superpowers/specs/2026-03-29-propertyiq-single-score-redesign.md`

**Critical constraints:**

- **Verify after every task:** `npm run build` + relevant tests + render check before proceeding
- **Live data only:** All testing against real Supabase DB, no mocks
- **Never break the site:** Add new code before removing old; every intermediate state must be deployable

---

## Phase 1: Backend — New v4 Scoring Engine

### Task 1: Add PropertyIQ score type to type system

**Files:**

- Modify: `packages/backend/src/scoring/formula-weights.ts`
- Modify: `packages/backend/src/scoring/scoring.types.ts`

The goal is to ADD `'propertyiq'` to the `ScoreType` union without removing old types. This is the foundation — everything else builds on this.

- [ ] **Step 1: Extend ScoreType union**

In `packages/backend/src/scoring/formula-weights.ts`, change:

```typescript
// OLD
export type ScoreType = "homeready" | "investoredge" | "markethealth";

// NEW
export type ScoreType =
  | "homeready"
  | "investoredge"
  | "markethealth"
  | "propertyiq";
```

- [ ] **Step 2: Add v4 formula definition**

In `packages/backend/src/scoring/formula-weights.ts`, add after the existing `FORMULA_WEIGHTS` constant:

```typescript
/**
 * v4 Demand Signal formula — 3 Redfin metrics.
 * signal = z(sold_above_list) - z(median_dom) - z(months_of_supply)
 * Then percentile-ranked and re-centered at the zero-crossing (55.6 for metro).
 */
export const V4_FORMULA_METRICS = [
  "sold_above_list",
  "median_dom",
  "months_of_supply",
] as const;

export const V4_METRIC_DIRECTIONS: Record<string, 1 | -1> = {
  sold_above_list: 1, // higher = hotter
  median_dom: -1, // lower = hotter
  months_of_supply: -1, // lower = hotter
};

/**
 * Zero-crossing percentile by geography level.
 * This is the percentile rank where excess return vs state = 0.
 * Determined from isotonic regression in recentered_score.py.
 */
export const V4_ZERO_CROSSING: Record<GeographyLevel, number> = {
  metro: 55.6,
  county: 62.4,
  zip: 55.6, // same as metro per validation report
};

export const V4_FORMULA_VERSION = "v4.0-demand-signal";
```

- [ ] **Step 3: Add v4 calibration data**

In `packages/backend/src/scoring/formula-weights.ts`, add:

```typescript
export const V4_CALIBRATION: CalibrationEntry[] = [
  { quintile: 1, scoreRange: [1, 20], label: "Bottom", avgExcessReturn: -3.34 },
  {
    quintile: 2,
    scoreRange: [21, 40],
    label: "Below Avg",
    avgExcessReturn: -1.2,
  },
  {
    quintile: 3,
    scoreRange: [41, 60],
    label: "Average",
    avgExcessReturn: -0.15,
  },
  {
    quintile: 4,
    scoreRange: [61, 80],
    label: "Above Avg",
    avgExcessReturn: +1.17,
  },
  { quintile: 5, scoreRange: [81, 99], label: "Top", avgExcessReturn: +3.05 },
];
```

- [ ] **Step 4: Add `'propertyiq'` to SCORE_CALIBRATION**

Add to existing `SCORE_CALIBRATION` record:

```typescript
// Add alongside existing homeready/investoredge/markethealth entries
SCORE_CALIBRATION["propertyiq"] = V4_CALIBRATION;
```

- [ ] **Step 5: Build and verify**

```bash
cd packages/backend && npm run build
```

Expected: Build succeeds. No tests should break because we only added, didn't modify existing code.

```bash
cd packages/backend && npm test -- --passWithNoTests
```

Expected: All existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/scoring/formula-weights.ts packages/backend/src/scoring/scoring.types.ts
git commit -m "feat(scoring): add propertyiq score type and v4 formula definition"
```

---

### Task 2: Implement v4 scoring engine

**Files:**

- Create: `packages/backend/src/scoring/v4-scoring-engine.ts`
- Modify: `packages/backend/src/scoring/scoring-data-fetcher.ts`

Create a NEW engine file for v4 alongside the existing v3 engine. This avoids touching the v3 code path at all.

- [ ] **Step 1: Create the v4 engine module**

Create `packages/backend/src/scoring/v4-scoring-engine.ts`:

```typescript
/**
 * v4 Demand Signal scoring engine.
 *
 * Formula: signal = z(sold_above_list) - z(median_dom) - z(months_of_supply)
 * Scoring: percentile rank → re-center at zero-crossing → score 1-99
 *
 * Reference implementation: scripts/analysis/recentered_score.py
 */
import {
  GeographyLevel,
  V4_FORMULA_METRICS,
  V4_METRIC_DIRECTIONS,
  V4_ZERO_CROSSING,
  V4_FORMULA_VERSION,
  CONFIDENCE_LEVELS,
  scoreToGrade,
  getConfidenceLevel,
} from "./formula-weights";
import type {
  LocationMetrics,
  SingleScoreResult,
  ConfidenceLevel,
} from "./scoring.types";

export interface V4ScoreResult {
  locationId: string;
  locationName: string;
  score: number;
  grade: string;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  signal: number;
  percentileRank: number;
  medianPrice: number | null;
  inputMetrics: {
    sold_above_list: number | null;
    median_dom: number | null;
    months_of_supply: number | null;
  };
}

/**
 * Calculate z-scores for the 3 v4 metrics across all locations.
 * Cross-sectional: mean and std computed from the full location set for each metric.
 */
function calculateV4ZScores(
  locations: LocationMetrics[],
): Map<string, Record<string, number>> {
  const zScores = new Map<string, Record<string, number>>();

  for (const metric of V4_FORMULA_METRICS) {
    const values: number[] = [];
    const locationValues: Array<{ id: string; value: number }> = [];

    for (const loc of locations) {
      const val = loc[metric];
      if (val !== null && val !== undefined && !isNaN(Number(val))) {
        values.push(Number(val));
        locationValues.push({ id: loc.location_id, value: Number(val) });
      }
    }

    if (values.length < 2) continue;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    const std = Math.sqrt(variance);

    if (std === 0) continue;

    for (const { id, value } of locationValues) {
      if (!zScores.has(id)) zScores.set(id, {});
      zScores.get(id)![metric] = (value - mean) / std;
    }
  }

  return zScores;
}

/**
 * Compute signal = z(sold_above_list) - z(median_dom) - z(months_of_supply)
 */
function computeSignal(zScoreMap: Record<string, number>): number | null {
  let signal = 0;
  let hasAll = true;

  for (const metric of V4_FORMULA_METRICS) {
    const z = zScoreMap[metric];
    if (z === undefined) {
      hasAll = false;
      break;
    }
    signal += V4_METRIC_DIRECTIONS[metric] * z;
  }

  return hasAll ? signal : null;
}

/**
 * Percentile rank with average-rank tie handling.
 * Returns values 0-100.
 */
function percentileRank(
  values: Array<{ id: string; value: number }>,
): Map<string, number> {
  const sorted = [...values].sort((a, b) => a.value - b.value);
  const n = sorted.length;
  const ranks = new Map<string, number>();

  let i = 0;
  while (i < n) {
    let j = i;
    while (j < n && sorted[j].value === sorted[i].value) j++;

    const avgRank = (i + j - 1) / 2;
    const pctRank = n > 1 ? (100 * avgRank) / (n - 1) : 50;

    for (let k = i; k < j; k++) {
      ranks.set(sorted[k].id, pctRank);
    }
    i = j;
  }

  return ranks;
}

/**
 * Re-center percentile rank so that the zero-crossing maps to score 50.
 *
 * Below zero-crossing: raw [0, zeroCrossing] → score [1, 50]
 * Above zero-crossing: raw [zeroCrossing, 100] → score [50, 99]
 */
function recenterScore(pctRank: number, zeroCrossing: number): number {
  let score: number;

  if (pctRank <= zeroCrossing) {
    // Below state average
    score = 1 + (49 * pctRank) / zeroCrossing;
  } else {
    // Above state average
    score = 50 + (49 * (pctRank - zeroCrossing)) / (100 - zeroCrossing);
  }

  return Math.max(1, Math.min(99, Math.round(score)));
}

/**
 * Calculate confidence for a v4 score.
 * Based on: Redfin data completeness + freshness.
 */
function calculateV4Confidence(location: LocationMetrics): {
  confidence: number;
  level: ConfidenceLevel;
} {
  let metricsPresent = 0;
  for (const metric of V4_FORMULA_METRICS) {
    if (location[metric] !== null && location[metric] !== undefined) {
      metricsPresent++;
    }
  }

  // Simple model: 3/3 metrics = high confidence, fewer = lower
  const completeness = metricsPresent / V4_FORMULA_METRICS.length;

  // Base confidence from completeness (0-100)
  const confidence = Math.round(completeness * 100);

  return {
    confidence,
    level: getConfidenceLevel(confidence),
  };
}

/**
 * Main v4 scoring function.
 * Takes all locations for a geography level and returns PropertyIQ scores.
 */
export function calculateV4Scores(
  locations: LocationMetrics[],
  geography: GeographyLevel,
): V4ScoreResult[] {
  // Step 1: Z-scores
  const zScores = calculateV4ZScores(locations);

  // Step 2: Compute signals
  const signals: Array<{ id: string; value: number; loc: LocationMetrics }> =
    [];

  for (const loc of locations) {
    const locZ = zScores.get(loc.location_id);
    if (!locZ) continue;

    const signal = computeSignal(locZ);
    if (signal === null) continue;

    signals.push({ id: loc.location_id, value: signal, loc });
  }

  if (signals.length === 0) return [];

  // Step 3: Percentile rank
  const pctRanks = percentileRank(signals);

  // Step 4: Re-center and build results
  const zeroCrossing = V4_ZERO_CROSSING[geography];
  const results: V4ScoreResult[] = [];

  for (const { id, value: signal, loc } of signals) {
    const pctRank = pctRanks.get(id)!;
    const score = recenterScore(pctRank, zeroCrossing);
    const grade = scoreToGrade(score);
    const { confidence, level: confidenceLevel } = calculateV4Confidence(loc);

    results.push({
      locationId: id,
      locationName: loc.location_name as string,
      score,
      grade,
      confidence,
      confidenceLevel,
      signal,
      percentileRank: pctRank,
      medianPrice:
        loc.median_price !== undefined ? Number(loc.median_price) : null,
      inputMetrics: {
        sold_above_list:
          loc.sold_above_list != null ? Number(loc.sold_above_list) : null,
        median_dom: loc.median_dom != null ? Number(loc.median_dom) : null,
        months_of_supply:
          loc.months_of_supply != null ? Number(loc.months_of_supply) : null,
      },
    });
  }

  return results;
}

export { V4_FORMULA_VERSION };
```

- [ ] **Step 2: Add v4 data fetch helper**

In `packages/backend/src/scoring/scoring-data-fetcher.ts`, add a new exported function that fetches ONLY the 3 Redfin metrics needed for v4 (does not replace existing `fetchAllMetrics`):

```typescript
import { V4_FORMULA_METRICS } from "./formula-weights";
import {
  getRedfinTable,
  getRedfinIdColumn,
  getRedfinNameColumn,
} from "./scoring-data-helpers";

/**
 * Fetch only the 3 Redfin metrics needed for v4 PropertyIQ scoring.
 * Much lighter than fetchAllMetrics which pulls from 6+ tables.
 */
export async function fetchV4Metrics(
  supabase: SupabaseClient,
  geography: GeographyLevel,
  periodDate: string,
): Promise<LocationMetrics[]> {
  const table = getRedfinTable(geography);
  const idCol = getRedfinIdColumn(geography);
  const nameCol = getRedfinNameColumn(geography);

  const selectCols = [
    `${idCol} as location_id`,
    `${nameCol} as location_name`,
    ...V4_FORMULA_METRICS,
    "median_sale_price as median_price",
  ].join(", ");

  const { data, error } = await supabase
    .from(table)
    .select(selectCols)
    .eq("period_end", periodDate)
    .not(V4_FORMULA_METRICS[0], "is", null);

  if (error) throw new Error(`fetchV4Metrics failed: ${error.message}`);

  return (data || []).map((row) => ({
    location_id: String(row.location_id),
    location_name: String(row.location_name),
    sold_above_list: row.sold_above_list,
    median_dom: row.median_dom,
    months_of_supply: row.months_of_supply,
    median_price: row.median_price,
  }));
}
```

- [ ] **Step 3: Build and verify**

```bash
cd packages/backend && npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/scoring/v4-scoring-engine.ts packages/backend/src/scoring/scoring-data-fetcher.ts
git commit -m "feat(scoring): implement v4 demand signal scoring engine"
```

---

### Task 3: Wire v4 engine into scoring service

**Files:**

- Modify: `packages/backend/src/scoring/scoring.service.ts`
- Modify: `packages/backend/src/scoring/scoring-persistence.ts`
- Modify: `packages/backend/src/scoring/scoring.controller.ts`

Add a new method to the service that calculates v4 scores. This runs alongside v3 — the `/api/scores/calculate/:geography` endpoint gets a `?version=v4` query param.

- [ ] **Step 1: Add v4 calculation method to ScoringService**

In `packages/backend/src/scoring/scoring.service.ts`, add a new method:

```typescript
import { calculateV4Scores, V4ScoreResult, V4_FORMULA_VERSION } from './v4-scoring-engine';
import { fetchV4Metrics } from './scoring-data-fetcher';
import { getLatestRedfinDate } from './scoring-data-fetcher';

async calculateV4Scores(
  geography: GeographyLevel,
  periodDate?: string,
): Promise<{ calculated: number; errors: number; scoreDate: string }> {
  // Get latest Redfin date if not specified
  const scoreDate = periodDate || await getLatestRedfinDate(this.supabase, geography);
  if (!scoreDate) throw new Error(`No Redfin data found for ${geography}`);

  // Fetch only v4 metrics (3 Redfin columns)
  const locations = await fetchV4Metrics(this.supabase, geography, scoreDate);
  if (locations.length === 0) {
    return { calculated: 0, errors: 0, scoreDate };
  }

  // Calculate scores
  const results = calculateV4Scores(locations, geography);

  // Persist as score_type='propertyiq'
  const rows = results.map(r => ({
    geography,
    location_id: r.locationId,
    location_name: r.locationName,
    score_type: 'propertyiq' as const,
    score: r.score,
    grade: r.grade,
    confidence: r.confidence,
    confidence_level: r.confidenceLevel,
    median_price: r.medianPrice,
    score_date: scoreDate,
    created_at: new Date().toISOString(),
    z_scores: JSON.stringify(r.inputMetrics),
    formula_version: V4_FORMULA_VERSION,
  }));

  await upsertScoresWithRetry(this.supabase, rows);

  return { calculated: results.length, errors: 0, scoreDate };
}
```

- [ ] **Step 2: Add v4 endpoint to controller**

In `packages/backend/src/scoring/scoring.controller.ts`, add a new endpoint:

```typescript
// POST /api/scores/calculate-v4/:geography
@Post('calculate-v4/:geography')
async calculateV4Scores(
  @Param('geography') geography: GeographyLevel,
  @Query('period_date') periodDate?: string,
): Promise<{ calculated: number; errors: number; scoreDate: string }> {
  if (!['metro', 'county', 'zip'].includes(geography)) {
    throw new BadRequestException(`Invalid geography: ${geography}`);
  }
  return this.scoringService.calculateV4Scores(geography, periodDate);
}
```

- [ ] **Step 3: Update score query to accept 'propertyiq'**

In `packages/backend/src/scoring/scoring.controller.ts`, find `validateScoreType()` and add `'propertyiq'` to the valid types array:

```typescript
// Find the validation logic and add 'propertyiq'
const validTypes: ScoreType[] = [
  "homeready",
  "investoredge",
  "markethealth",
  "propertyiq",
];
```

- [ ] **Step 4: Build and verify**

```bash
cd packages/backend && npm run build && npm test -- --passWithNoTests
```

Expected: Build succeeds, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/scoring/scoring.service.ts packages/backend/src/scoring/scoring-persistence.ts packages/backend/src/scoring/scoring.controller.ts
git commit -m "feat(scoring): wire v4 engine into scoring service with calculate-v4 endpoint"
```

---

### Task 4: Calculate v4 scores for all geographies

**This is a data task — run the new endpoint against live Supabase.**

- [ ] **Step 1: Start the backend locally**

```bash
cd packages/backend && npm run start:dev
```

- [ ] **Step 2: Calculate metro scores**

```bash
curl -X POST http://localhost:3001/api/scores/calculate-v4/metro
```

Expected: `{ "calculated": ~746, "errors": 0, "scoreDate": "..." }`

- [ ] **Step 3: Calculate county scores**

```bash
curl -X POST http://localhost:3001/api/scores/calculate-v4/county
```

Expected: `{ "calculated": ~2983, "errors": 0, "scoreDate": "..." }`

- [ ] **Step 4: Calculate ZIP scores**

```bash
curl -X POST http://localhost:3001/api/scores/calculate-v4/zip
```

Expected: `{ "calculated": ~19880, "errors": 0, "scoreDate": "..." }`

- [ ] **Step 5: Verify scores exist in database**

```bash
curl "http://localhost:3001/api/scores?geography=metro&location_id=12420&score_type=propertyiq"
```

Expected: Returns a score object with `score_type: 'propertyiq'`, score 1-99, grade.

- [ ] **Step 6: Spot-check a known market**

Pick Austin (CBSA 12420) or Tampa (CBSA 45300) and compare the v4 score to the Python validation output to confirm they match.

- [ ] **Step 7: Commit (no code changes, but document the run)**

```bash
git commit --allow-empty -m "chore(scoring): v4 scores calculated for all geographies (metro/county/zip)"
```

---

## Phase 2: Frontend Type System & Data Layer

### Task 5: Add 'propertyiq' to frontend type system

**Files:**

- Modify: `packages/frontend/app/map/hooks/score-data.types.ts`
- Modify: `packages/frontend/lib/data/types.ts`
- Modify: `packages/frontend/lib/data/fetchers/scores.ts`
- Modify: `packages/frontend/lib/data/fetchers/scoring.ts`
- Modify: `packages/frontend/lib/data/hooks/useScoreData.ts`

Add `'propertyiq'` to all frontend ScoreType definitions WITHOUT removing old types.

- [ ] **Step 1: Update score-data.types.ts**

In `packages/frontend/app/map/hooks/score-data.types.ts`:

```typescript
// Add 'propertyiq' to the union
export type ScoreType =
  | "market_health"
  | "homeready"
  | "investoredge"
  | "propertyiq";
```

Add `propertyiq` key to `AllScoresResponse`:

```typescript
export interface AllScoresResponse {
  // ... existing fields ...
  propertyiq?: ScoreBadgeData | ScoreCardData | ScoreTeaserData;
  // Keep existing: marketHealth, homeready, investoredge
}
```

- [ ] **Step 2: Update lib/data/types.ts**

```typescript
export type ScoreType =
  | "homeready"
  | "investoredge"
  | "markethealth"
  | "propertyiq";
```

Add `propertyiq` to `ScoreResponse.scores`:

```typescript
export interface ScoreResponse {
  // ... existing fields ...
  scores: {
    homeready: SingleScoreResult;
    investoredge: SingleScoreResult;
    markethealth: SingleScoreResult;
    propertyiq?: SingleScoreResult; // Optional during transition
  };
}
```

- [ ] **Step 3: Update fetcher types**

In `packages/frontend/lib/data/fetchers/scores.ts`:

```typescript
export type TopMarketsScoreType =
  | "homeready"
  | "investoredge"
  | "markethealth"
  | "propertyiq";
```

In `packages/frontend/lib/data/fetchers/scoring.ts`:

```typescript
export type ValidationScoreType =
  | "homeready"
  | "investoredge"
  | "markethealth"
  | "propertyiq";
```

- [ ] **Step 4: Update useScoreData hook**

In `packages/frontend/lib/data/hooks/useScoreData.ts`, add `propertyiq` handling to the result:

```typescript
// In the return object, add:
propertyiq: data?.scores?.propertyiq ?? null,
```

And update the `ScoreGatingInfo` record type:

```typescript
gating: Record<ScoreType, ScoreGatingInfo>;
// This now includes 'propertyiq' since ScoreType was expanded
```

- [ ] **Step 5: Build and verify**

```bash
cd packages/frontend && npm run build
```

Expected: Build succeeds. TypeScript may show some warnings about exhaustive switches — note them but don't fix yet (they'll be addressed when we migrate each component).

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/app/map/hooks/score-data.types.ts packages/frontend/lib/data/types.ts packages/frontend/lib/data/fetchers/scores.ts packages/frontend/lib/data/fetchers/scoring.ts packages/frontend/lib/data/hooks/useScoreData.ts
git commit -m "feat(frontend): add propertyiq score type to frontend type system"
```

---

### Task 6: Update validation claims for v4

**Files:**

- Modify: `packages/frontend/lib/data/validation-claims.ts`

- [ ] **Step 1: Add v4 claims constants**

Read the current file, then add the v4 constants alongside existing ones (don't remove old ones yet):

```typescript
/** v4 Demand Signal Validation Claims — single PropertyIQ Score */
export const V4_CLAIMS = {
  /** Q5 vs Q1 dollar gap, 3Y, metro (median home $245,361) */
  metroGap3Y: 18_100,
  /** Q5 vs Q1 dollar gap, 1Y, metro */
  metroGap1Y: 9_199,
  /** 3Y quintile spread (percentage points) */
  alpha3Y_pp: 7.83,
  /** 1Y quintile spread (percentage points) */
  alpha1Y_pp: 2.9,
  /** % of years Q5 beat Q1 (1Y) */
  yearHitRate1Y: 100,
  /** % of years Q5 beat Q1 (3Y) */
  yearHitRate3Y: 100,
  /** OOS Information Coefficient */
  ic1Y: 0.24,
  ic3Y: 0.23,
  /** Information Ratio */
  ir1Y: 3.65,
  ir3Y: 6.56,
  /** Coverage */
  metrosValidated: 746,
  countiesValidated: 2_983,
  zipsValidated: 19_880,
  totalObservations: 3_177_707,
  backtestYears: 13,
  /** Median home value used for dollar calculations */
  medianHomeValue: 245_361,
  /** Score 80+ 3Y excess vs state */
  topQuintile3YExcess: 1.87,
  /** Score 20 3Y excess vs state */
  bottomQuintile3YExcess: -3.34,
} as const;
```

- [ ] **Step 2: Add a v4 homepage claims function**

```typescript
export function getV4HomepageClaims() {
  return {
    dollarGap: `$${V4_CLAIMS.metroGap3Y.toLocaleString()}`,
    dollarGapRaw: V4_CLAIMS.metroGap3Y,
    alphaPp: `${V4_CLAIMS.alpha3Y_pp}pp`,
    yearHitRate: `${V4_CLAIMS.yearHitRate1Y}%`,
    metrosValidated: V4_CLAIMS.metrosValidated,
    backtestYears: V4_CLAIMS.backtestYears,
    totalMarkets:
      V4_CLAIMS.metrosValidated +
      V4_CLAIMS.countiesValidated +
      V4_CLAIMS.zipsValidated,
  };
}
```

- [ ] **Step 3: Build and verify**

```bash
cd packages/frontend && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/lib/data/validation-claims.ts
git commit -m "feat(frontend): add v4 validation claims for PropertyIQ Score"
```

---

## Phase 3: Frontend Scoring Components

### Task 7: Update ScoreBadge to support PropertyIQ

**Files:**

- Modify: `packages/frontend/app/components/scoring/ScoreBadge.tsx`
- Modify: `packages/frontend/app/components/scoring/index.ts`

- [ ] **Step 1: Read ScoreBadge.tsx fully to understand current structure**

- [ ] **Step 2: Add 'propertyiq' to the local ScoreType and color functions**

In `ScoreBadge.tsx`, update `getTypeColor()`:

```typescript
function getTypeColor(type: ScoreType): string {
  // PropertyIQ uses indigo for all score types going forward
  if (type === "propertyiq") return "bg-indigo-50 border-indigo-200";
  // Legacy types (kept for backward compat)
  switch (type) {
    case "market_health":
      return "bg-blue-50 border-blue-200";
    case "homeready":
      return "bg-indigo-50 border-indigo-200";
    case "investoredge":
      return "bg-emerald-50 border-emerald-200";
    default:
      return "bg-indigo-50 border-indigo-200";
  }
}
```

Update `getTypeLabelColor()` similarly with `'propertyiq'` returning `'text-indigo-700'`.

Update the local `ScoreType` to include `'propertyiq'`:

```typescript
export type ScoreType =
  | "market_health"
  | "homeready"
  | "investoredge"
  | "propertyiq";
```

- [ ] **Step 3: Build and verify**

```bash
cd packages/frontend && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/components/scoring/ScoreBadge.tsx packages/frontend/app/components/scoring/index.ts
git commit -m "feat(scoring): add propertyiq support to ScoreBadge component"
```

---

### Task 8: Update ScoreWidget to support PropertyIQ

**Files:**

- Modify: `packages/frontend/app/components/scoring/ScoreWidget.tsx`

- [ ] **Step 1: Read ScoreWidget.tsx fully**

- [ ] **Step 2: Add 'propertyiq' to the scoreType → response key mapping**

Find the `scoreData` useMemo that maps `scoreType` to the response key. Add:

```typescript
case 'propertyiq':
  return data?.propertyiq ?? data?.scores?.propertyiq ?? null;
```

- [ ] **Step 3: Build and verify**

```bash
cd packages/frontend && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/components/scoring/ScoreWidget.tsx
git commit -m "feat(scoring): add propertyiq support to ScoreWidget"
```

---

### Task 9: Update ScoreCard with v4 input metrics breakdown

**Files:**

- Modify: `packages/frontend/app/components/scoring/ScoreCard.tsx`

This is the biggest component change — replace the old ComponentBar breakdown with the 3 Redfin metrics + derived context. Do this as an additive change: when `type === 'propertyiq'`, render the new breakdown; otherwise render the old one.

- [ ] **Step 1: Read ScoreCard.tsx fully**

- [ ] **Step 2: Add InputMetrics sub-component**

Add inside ScoreCard.tsx (or as a separate file if ScoreCard is already large):

```typescript
interface InputMetricRowProps {
  name: string;
  value: string;
  percentile?: number;
}

function InputMetricRow({ name, value, percentile }: InputMetricRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-outline-variant/20 last:border-b-0">
      <span className="text-sm text-on-surface-variant">{name}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium font-mono text-on-surface">{value}</span>
        {percentile !== undefined && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container">
            {percentile}th
          </span>
        )}
      </div>
    </div>
  );
}

function AlphaSummaryLine({ score }: { score: number }) {
  // Find the calibration entry for this score
  const entry = V4_CALIBRATION.find(
    e => score >= e.scoreRange[0] && score <= e.scoreRange[1]
  );
  if (!entry) return null;

  const sign = entry.avgExcessReturn >= 0 ? '+' : '';
  return (
    <div className="mt-3 px-3 py-2 rounded-lg bg-primary-container/40 text-sm font-medium text-on-primary-container">
      Score {score} → historically {sign}{entry.avgExcessReturn.toFixed(1)}% vs state avg over 3Y
    </div>
  );
}
```

- [ ] **Step 3: Conditionally render new vs old breakdown**

In the ScoreCard render body, wrap the ComponentBar section:

```typescript
{type === 'propertyiq' && inputMetrics ? (
  <div className="mt-4">
    <div className="text-xs font-medium uppercase tracking-wide text-on-surface-variant mb-2">
      Input Metrics
    </div>
    {inputMetrics.map(m => (
      <InputMetricRow key={m.name} name={m.name} value={m.value} percentile={m.percentile} />
    ))}
    <AlphaSummaryLine score={score} />
  </div>
) : (
  // Existing ComponentBar rendering for legacy score types
  components && components.length > 0 && (
    // ... existing component breakdown code ...
  )
)}
```

- [ ] **Step 4: Build and verify**

```bash
cd packages/frontend && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/app/components/scoring/ScoreCard.tsx
git commit -m "feat(scoring): add v4 input metrics breakdown to ScoreCard for propertyiq type"
```

---

### Task 10: Update metric registry for PropertyIQ

**Files:**

- Modify: `packages/frontend/lib/data/registry.ts`
- Modify: `packages/frontend/lib/data/definitions.ts`

- [ ] **Step 1: Add propertyiq_score metric to registry**

In `packages/frontend/lib/data/registry.ts`, add alongside existing score metrics:

```typescript
propertyiq_score: {
  id: 'propertyiq_score',
  title: 'PropertyIQ Score',
  format: 'number',
  dataSource: 'propertyiq',
  apiEndpoint: '/api/scores/{geo}/{location_id}',
  keyField: 'auto',
  supportedGeos: ['metro', 'county', 'zip'],
  valueField: 'propertyiq_score',
  rangeType: 'full',
  hasTimeSeries: true,
  favorableDirection: 'higher',
},
```

- [ ] **Step 2: Add definition**

In `packages/frontend/lib/data/definitions.ts`, add:

```typescript
propertyiq_score: {
  title: 'PropertyIQ Score',
  description: 'Predicts market performance vs state average using 3 Redfin demand indicators. Score 50 = state average, higher = outperformance.',
  source: 'PropertyIQ v4 (Redfin)',
  unit: 'score (1-99)',
},
```

- [ ] **Step 3: Update isScoreMetric helper**

Find the `isScoreMetric()` function and add `'propertyiq_score'` to the check:

```typescript
export function isScoreMetric(metricId: string): boolean {
  return [
    "homeready_score",
    "investoredge_score",
    "market_health_score",
    "propertyiq_score",
  ].includes(metricId);
}
```

- [ ] **Step 4: Build and verify**

```bash
cd packages/frontend && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/lib/data/registry.ts packages/frontend/lib/data/definitions.ts
git commit -m "feat(frontend): add propertyiq_score to metric registry and definitions"
```

---

## Phase 4: Page-by-Page Migration

### Task 11: Rewrite Homepage Hero

**Files:**

- Modify: `packages/frontend/app/components/home/HeroSection.tsx`
- Modify: `packages/frontend/app/components/home/FeaturesSection.tsx`
- Modify: `packages/frontend/app/components/home/FeatureCarousel.tsx`
- Modify: `packages/frontend/app/components/home/ValuePropsSection.tsx`
- Modify: `packages/frontend/app/components/home/JsonLd.tsx`

Build both hero variants. The user liked the dark indigo gradient mockup with stat cards from the brainstorming visual companion.

- [ ] **Step 1: Read all 5 homepage component files**

- [ ] **Step 2: Create HeroVariantA component**

In `HeroSection.tsx`, create a new component for Variant A ("Lead with Proof"):

```typescript
import { getV4HomepageClaims } from '@/lib/data/validation-claims';

const HERO_VARIANT: 'A' | 'B' = 'A'; // Toggle for future A/B test

function HeroVariantA() {
  const claims = getV4HomepageClaims();
  return (
    // Dark indigo gradient background (matching brainstorm mockup)
    // Headline: "Know which markets will outperform."
    // Subheadline: "Our score predicted the winners in 100% of years tested — across 746 metros over 13 years."
    // 3 stat cards: +$18,100, 100%, 7.83pp
    // Search bar + CTAs below
  );
}
```

**Design spec for Variant A** (matching the mockup):

- Background: `linear-gradient(135deg, #1A237E 0%, #3949AB 100%)`
- Stat cards: `bg-white/10 rounded-xl p-5 text-center`
- Values: `text-[28px] font-bold text-[#00C853] font-mono`
- Labels: `text-xs text-[#C5CAE9]`

- [ ] **Step 3: Create HeroVariantB component**

```typescript
function HeroVariantB() {
  // Headline: "The wrong market costs you $18,100 in 3 years."
  // Side-by-side: Score 80+ vs Score 20
  // Same dark indigo gradient
}
```

- [ ] **Step 4: Wire up variant selection**

```typescript
export function HeroSection() {
  return HERO_VARIANT === 'A' ? <HeroVariantA /> : <HeroVariantB />;
}
```

- [ ] **Step 5: Update FeaturesSection.tsx**

Change "Market & Investment Scores" → "PropertyIQ Score". Remove HomeReady/InvestorEdge descriptions. Single score description referencing 3 Redfin metrics.

- [ ] **Step 6: Update FeatureCarousel.tsx**

Change floating accent card from "HomeReady" → "PropertyIQ".

- [ ] **Step 7: Update ValuePropsSection.tsx**

Replace all 3-score references. Update stat claims to use `getV4HomepageClaims()`. Replace $13.3K and 5.55pp with v4 numbers.

- [ ] **Step 8: Update JsonLd.tsx**

Replace `featureList` entries: remove "HomeReady Score for homebuyers" and "InvestorEdge Score for real estate investors." Add "PropertyIQ Score — predicts market performance with 100% year hit rate."

- [ ] **Step 9: Build and verify**

```bash
cd packages/frontend && npm run build
```

Then start dev server and visually check the homepage:

```bash
cd packages/frontend && npm run dev
```

Open `http://localhost:3000` — verify the hero renders with the new messaging and stat cards. No broken images, no console errors.

- [ ] **Step 10: Commit**

```bash
git add packages/frontend/app/components/home/
git commit -m "feat(homepage): rewrite hero with v4 validation stats and dual A/B variants"
```

---

### Task 12: Rewrite Scores Page

**Files:**

- Rewrite: `packages/frontend/app/scores/page.tsx`
- Modify: `packages/frontend/app/scores/layout.tsx`
- Create: `packages/frontend/app/scores/decile-data.ts`
- Modify: `packages/frontend/app/scores/ScoresContentSections.tsx`
- Modify: `packages/frontend/app/scores/ScoresFaqSection.tsx`

- [ ] **Step 1: Create decile data file**

Create `packages/frontend/app/scores/decile-data.ts` with the decile tables from the v4 validation report:

```typescript
export interface DecileRow {
  score: number;
  meanExcess: number;
  medianExcess: number;
  stdDev: number;
  pBeatState: number;
  n: number;
}

export const METRO_DECILE_1Y: DecileRow[] = [
  {
    score: 10,
    meanExcess: -2.11,
    medianExcess: -1.66,
    stdDev: 5.6,
    pBeatState: 34.0,
    n: 13048,
  },
  {
    score: 20,
    meanExcess: -1.26,
    medianExcess: -1.08,
    stdDev: 5.0,
    pBeatState: 38.8,
    n: 13826,
  },
  {
    score: 30,
    meanExcess: -0.84,
    medianExcess: -0.73,
    stdDev: 4.7,
    pBeatState: 41.7,
    n: 13816,
  },
  {
    score: 40,
    meanExcess: -0.47,
    medianExcess: -0.36,
    stdDev: 4.5,
    pBeatState: 46.0,
    n: 13823,
  },
  {
    score: 50,
    meanExcess: -0.15,
    medianExcess: -0.09,
    stdDev: 4.5,
    pBeatState: 49.0,
    n: 13676,
  },
  {
    score: 60,
    meanExcess: 0.07,
    medianExcess: 0.07,
    stdDev: 4.3,
    pBeatState: 51.0,
    n: 11037,
  },
  {
    score: 70,
    meanExcess: 0.23,
    medianExcess: 0.28,
    stdDev: 4.3,
    pBeatState: 53.9,
    n: 11030,
  },
  {
    score: 80,
    meanExcess: 0.53,
    medianExcess: 0.48,
    stdDev: 4.3,
    pBeatState: 56.0,
    n: 11027,
  },
  {
    score: 90,
    meanExcess: 1.03,
    medianExcess: 0.79,
    stdDev: 4.5,
    pBeatState: 59.9,
    n: 11033,
  },
  {
    score: 100,
    meanExcess: 1.64,
    medianExcess: 1.32,
    stdDev: 4.4,
    pBeatState: 66.1,
    n: 9461,
  },
];

export const METRO_DECILE_3Y: DecileRow[] = [
  {
    score: 10,
    meanExcess: -5.66,
    medianExcess: -4.81,
    stdDev: 13.1,
    pBeatState: 32.3,
    n: 10948,
  },
  {
    score: 20,
    meanExcess: -3.34,
    medianExcess: -2.64,
    stdDev: 12.8,
    pBeatState: 39.2,
    n: 11601,
  },
  {
    score: 30,
    meanExcess: -2.04,
    medianExcess: -1.76,
    stdDev: 11.8,
    pBeatState: 42.4,
    n: 11594,
  },
  {
    score: 40,
    meanExcess: -1.2,
    medianExcess: -1.11,
    stdDev: 11.5,
    pBeatState: 45.3,
    n: 11604,
  },
  {
    score: 50,
    meanExcess: -0.28,
    medianExcess: -0.35,
    stdDev: 11.2,
    pBeatState: 48.4,
    n: 11479,
  },
  {
    score: 60,
    meanExcess: 0.31,
    medianExcess: 0.26,
    stdDev: 10.9,
    pBeatState: 51.2,
    n: 9267,
  },
  {
    score: 70,
    meanExcess: 1.17,
    medianExcess: 1.01,
    stdDev: 10.6,
    pBeatState: 55.4,
    n: 9251,
  },
  {
    score: 80,
    meanExcess: 1.87,
    medianExcess: 1.44,
    stdDev: 11.3,
    pBeatState: 56.4,
    n: 9249,
  },
  {
    score: 90,
    meanExcess: 3.05,
    medianExcess: 2.06,
    stdDev: 11.7,
    pBeatState: 59.3,
    n: 9257,
  },
  {
    score: 100,
    meanExcess: 4.28,
    medianExcess: 3.12,
    stdDev: 11.8,
    pBeatState: 63.7,
    n: 7943,
  },
];
```

- [ ] **Step 2: Rewrite scores/page.tsx**

Replace the current 3-card grid page with:

1. Hero: "The PropertyIQ Score" with stat pills
2. Decile tables (1Y and 3Y)
3. How It Works (3 steps: Redfin Metrics → Z-Score → Percentile)
4. Dollar Impact (Q5 vs Q1 gap)
5. Updated FAQ

Read the current file first, then rewrite preserving the metadata structure.

- [ ] **Step 3: Update layout.tsx metadata**

Remove "HomeReady, InvestorEdge, and MarketHealth" from description. Replace with "PropertyIQ Score — predicts market performance across 23,000+ locations."

- [ ] **Step 4: Update ScoresContentSections.tsx**

Rewrite `HowToUseScoresSection` for single score. Rewrite `MethodologyOverviewSection` for 3-metric z-score approach.

- [ ] **Step 5: Update ScoresFaqSection.tsx**

Remove FAQ about "difference between HomeReady and InvestorEdge." Update all other FAQs for single score. Add "Why only 3 metrics?" FAQ.

- [ ] **Step 6: Build and verify**

```bash
cd packages/frontend && npm run build
```

Visual check: `http://localhost:3000/scores` — verify new page renders with decile tables and single score messaging.

- [ ] **Step 7: Commit**

```bash
git add packages/frontend/app/scores/
git commit -m "feat(scores): rewrite scores page for single PropertyIQ Score with v4 validation data"
```

---

### Task 13: Simplify Reports Page

**Files:**

- Modify: `packages/frontend/app/reports/page.tsx`
- Modify: `packages/frontend/app/reports/types.ts` (if exists)

- [ ] **Step 1: Read reports/page.tsx fully**

- [ ] **Step 2: Remove the homebuyer/investor toggle**

Find and remove:

- The `ReportCard` two-card selection component
- The `selectedType` state
- The conditional rendering based on `isHomebuyer`
- The `?rtype=homebuyer|investor` URL param handling

Replace the entry point with a direct flow to market selection. Change `template_slug` to always be `"propertyiq"`. Change `user_type` to `"universal"`.

- [ ] **Step 3: Update report type badge**

Change the report history list to show a single indigo "PropertyIQ" badge instead of conditional homebuyer/investor coloring.

- [ ] **Step 4: Build and verify**

```bash
cd packages/frontend && npm run build
```

Visual check: `http://localhost:3000/reports` — verify the page loads directly into market selection (no toggle), generates a report with template_slug "propertyiq".

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/app/reports/
git commit -m "feat(reports): remove homebuyer/investor toggle, use single PropertyIQ report type"
```

---

### Task 14: Update map sidebar score display

**Files:**

- Modify: `packages/frontend/app/map/components/sidebar-components/SidebarScoreCard.tsx`
- Modify: `packages/frontend/app/map/components/RightDetailPanel/RightDetailPanel.tsx`
- Modify: `packages/frontend/app/map/components/RightDetailPanel/ScoreGaugeCard.tsx`
- Modify: `packages/frontend/app/map/components/RightDetailPanel/SideScoreCard.tsx`

- [ ] **Step 1: Read all 4 files**

- [ ] **Step 2: Update SidebarScoreCard**

Remove the 3-score carousel (SCORE_ORDER, SCORE_CONFIG, prev/next buttons). Replace with single PropertyIQ Score card. Change props from `marketHealthScore`/`homereadyScore`/`investoredgeScore` to a single `score` prop.

- [ ] **Step 3: Update RightDetailPanel**

Change the 3 separate score props to a single score value. Read `data.propertyiq` (or `data.scores.propertyiq`) directly.

- [ ] **Step 4: Update ScoreGaugeCard and SideScoreCard**

Replace 3-type config objects with single "PropertyIQ Score" label.

- [ ] **Step 5: Build and verify**

```bash
cd packages/frontend && npm run build
```

Visual check: Open map, click a metro → verify single "PropertyIQ Score" shows in sidebar and detail panel.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/app/map/components/
git commit -m "feat(map): display single PropertyIQ Score in sidebar and detail panel"
```

---

### Task 15: Update graphs page score references

**Files:**

- Modify: `packages/frontend/app/graphs/components/HeroComparison/ScoreShowdown.tsx`
- Modify: `packages/frontend/app/graphs/components/HeroComparison/HeroComparison.tsx`
- Modify: `packages/frontend/app/graphs/components/HeroComparison/PriorityBreakdown.tsx`
- Modify: any other graph files with score type references

- [ ] **Step 1: Search for all score type references in graphs/**

```bash
grep -r "homeready\|investoredge\|market_health\|HomeReady\|InvestorEdge\|MarketHealth" packages/frontend/app/graphs/
```

- [ ] **Step 2: Update each file**

Change all `scoreLabel` conditionals to `'PropertyIQ'`. Change `homeready_score` metric references to `propertyiq_score`. Update any score type dropdowns/selectors.

- [ ] **Step 3: Build and verify**

```bash
cd packages/frontend && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/graphs/
git commit -m "feat(graphs): update all score references to PropertyIQ"
```

---

### Task 16: Update embed and dashboard score references

**Files:**

- Modify: `packages/frontend/app/embed/score/[geoLevel]/[geoId]/EmbedScoreWidget.tsx`
- Modify: `packages/frontend/app/embed/score/[geoLevel]/[geoId]/page.tsx`
- Modify: `packages/frontend/app/dashboard/` (score references)
- Modify: `packages/frontend/app/admin/` (add propertyiq as default, keep legacy types)

- [ ] **Step 1: Update embed components**

Add `propertyiq: "PropertyIQ"` to `SCORE_TYPE_LABELS`. Make it the default scoreType.

- [ ] **Step 2: Update dashboard**

Change top markets default to `score_type='propertyiq'`.

- [ ] **Step 3: Update admin panels**

Add `'propertyiq'` as the default option in score type dropdowns. Keep legacy types accessible for historical data.

- [ ] **Step 4: Build and verify**

```bash
cd packages/frontend && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/app/embed/ packages/frontend/app/dashboard/ packages/frontend/app/admin/
git commit -m "feat(frontend): update embed, dashboard, and admin for PropertyIQ score type"
```

---

## Phase 5: Backend Service Migration

### Task 17: Update backend services to use PropertyIQ

**Files:**

- Modify: `packages/backend/src/insights/insight-context-builder.ts`
- Modify: `packages/backend/src/insights/insight-prompts.ts`
- Modify: `packages/backend/src/insights/blog-prompts.ts`
- Modify: `packages/backend/src/analytics-chat/quinn-system-prompt.ts`
- Modify: `packages/backend/src/reports/report-ai-prompt-builders.ts`
- Modify: `packages/backend/src/reports/prompts-v2/comparison-sections.ts`
- Modify: `packages/backend/src/email/monthly-digest-data.service.ts`
- Modify: `packages/backend/src/alerts/threshold-alert.service.ts`
- Modify: `packages/backend/src/alerts/threshold-alert-data.service.ts`
- Modify: `packages/backend/src/platform-api/v1/scores.controller.ts`
- Modify: `packages/backend/src/platform-api/v1/rankings.controller.ts`
- Modify: `packages/backend/src/admin-metrics/services/`

This is a broad search-and-replace task. Each file needs its score type references updated.

- [ ] **Step 1: Search for all homeready/investoredge/markethealth references in backend**

```bash
grep -rn "homeready\|investoredge\|markethealth\|market_health\|HomeReady\|InvestorEdge\|MarketHealth" packages/backend/src/ --include="*.ts" | grep -v "__tests__" | grep -v "node_modules"
```

- [ ] **Step 2: Update insights services**

In `insight-context-builder.ts`: collapse 3-score extraction to single `propertyiq` key.
In `insight-prompts.ts`: replace 3-score template with single PropertyIQ Score reference.
In `blog-prompts.ts`: rewrite "Top Markets for Homebuyers/Investors" to "Top PropertyIQ Markets".

- [ ] **Step 3: Update analytics chat**

In `quinn-system-prompt.ts`: full rewrite of score routing section. Remove user-type-to-score-type mapping. All queries use `propertyiq_score`.

- [ ] **Step 4: Update reports prompts**

In `report-ai-prompt-builders.ts`: remove `heroScore` conditional.
In `comparison-sections.ts`: replace `{{homeready_score}}`, `{{investoredge_score}}` with `{{propertyiq_score}}`.

- [ ] **Step 5: Update email/alerts/platform-api**

In `monthly-digest-data.service.ts`: change `.eq('score_type', 'homeready')` to `.eq('score_type', 'propertyiq')`.
In alerts: change score columns.
In platform-api controllers: change `VALID_SCORE_TYPES` to `['propertyiq']` with backward-compat aliases.

- [ ] **Step 6: Build and verify**

```bash
cd packages/backend && npm run build && npm test -- --passWithNoTests
```

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/
git commit -m "feat(backend): migrate all services from 3-score types to single propertyiq"
```

---

## Phase 6: Cleanup

### Task 18: Remove v3 score type references from frontend

**Files:** Multiple across packages/frontend/

Now that all pages use PropertyIQ, remove the old types from unions and simplify conditional rendering.

- [ ] **Step 1: Narrow ScoreType unions**

In `packages/frontend/app/map/hooks/score-data.types.ts`:

```typescript
export type ScoreType = "propertyiq";
/** @deprecated For backward compat with cached data */
export type LegacyScoreType = "market_health" | "homeready" | "investoredge";
```

In `packages/frontend/lib/data/types.ts`:

```typescript
export type ScoreType = "propertyiq";
```

- [ ] **Step 2: Remove type-conditional rendering**

In each scoring component, remove the `switch` statements on old types. ScoreBadge: always returns indigo. ScoreCard: always renders v4 breakdown.

- [ ] **Step 3: Remove old metric registry entries**

In `packages/frontend/lib/data/registry.ts`, remove `homeready_score`, `investoredge_score`, `market_health_score` entries. Keep only `propertyiq_score`.

- [ ] **Step 4: Remove old validation claims**

In `packages/frontend/lib/data/validation-claims.ts`, remove `OOS_QUINTILE_SPREAD`, `OOS_IC`, `OOS_HIT_RATE`, `getHomepageClaims()`. Keep only v4 constants.

- [ ] **Step 5: Build and verify — this is the critical check**

```bash
cd packages/frontend && npm run build
```

Fix any TypeScript errors from narrowed types. Each error shows a callsite that still references old types — update it.

Visual check: browse homepage, /scores, /reports, /map → all should show PropertyIQ Score only. No "HomeReady", "InvestorEdge", or "MarketHealth" text visible anywhere.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/
git commit -m "refactor(frontend): remove all v3 score type references, narrow to propertyiq only"
```

---

### Task 19: Remove v3 scoring engine from backend

**Files:**

- Modify: `packages/backend/src/scoring/scoring.service.ts` — remove v3 `calculateAllScores` or redirect it to v4
- Modify: `packages/backend/src/scoring/scoring-engine.ts` — can be gutted (v4-scoring-engine.ts replaces it)
- Modify: `packages/backend/src/scoring/formula-weights.ts` — remove old `FORMULA_WEIGHTS`, `COMPONENT_GROUPS`
- Delete: `packages/backend/src/scoring/market-health.service.ts`
- Delete: `packages/backend/src/scoring/scoring-supplementary-fetchers.ts` (v4 doesn't need Census/Economic/FRED fetches)
- Modify: `packages/backend/src/scoring/scoring.controller.ts` — merge `calculate-v4` into `calculate`, remove old logic

- [ ] **Step 1: Redirect the main calculate endpoint to v4**

In `scoring.controller.ts`, change `POST /api/scores/calculate/:geography` to call `calculateV4Scores` instead of the old method. Remove the temporary `calculate-v4` endpoint.

- [ ] **Step 2: Remove old v3 formula weights**

In `formula-weights.ts`, remove the old `FORMULA_WEIGHTS` record (metro/county/zip × homeready/investoredge/markethealth), `COMPONENT_GROUPS`, and `MODEL_CORRELATIONS`. Keep `ScoreType = 'propertyiq'`, grade thresholds, confidence levels, and v4 constants.

- [ ] **Step 3: Delete market-health.service.ts**

```bash
git rm packages/backend/src/scoring/market-health.service.ts
```

- [ ] **Step 4: Delete scoring-supplementary-fetchers.ts**

```bash
git rm packages/backend/src/scoring/scoring-supplementary-fetchers.ts
```

- [ ] **Step 5: Update scoring.module.ts**

Remove deleted services from the module's `providers` array.

- [ ] **Step 6: Build and verify**

```bash
cd packages/backend && npm run build && npm test -- --passWithNoTests
```

- [ ] **Step 7: Commit**

```bash
git add -A packages/backend/src/scoring/
git commit -m "refactor(scoring): remove v3 engine, formula weights, and supplementary fetchers"
```

---

### Task 20: Delete legacy scripts and docs

**Files:** See spec Section 5.1 for complete list.

- [ ] **Step 1: Delete legacy scoring scripts**

```bash
git rm scripts/calculate-10-zips.js
git rm scripts/calculate-all-zip-scores.js
git rm scripts/calculations/score-formula-weights.ts
git rm scripts/calculations/score-zscore-engine.ts
git rm scripts/calculations/score-data-fetcher.ts
git rm scripts/calculate-excess-returns.ts
git rm scripts/analysis/diagnose_scores.py
git rm scripts/analysis/DIAGNOSTIC_REPORT.md
git rm -f scripts/analysis/output/diagnostic_report_*.json
git rm -rf scripts/analysis/scoring_pipeline/
git rm scripts/analysis/run_scoring_pipeline.py
git rm -f scripts/backfill-zip-pre2020-outcomes.py
git rm -f scripts/build-training-join.py
git rm -f scripts/build-zip-backtest-parquet.py
git rm -f scripts/validate-v3-scoring-live.ts
git rm -f scripts/test-backtest-comprehensive.ts
git rm -f scripts/test-austin-scores.ts
```

- [ ] **Step 2: Delete old report sections**

```bash
git rm -rf packages/frontend/app/reports/\[id\]/components/sections/homebuyer/
git rm -rf packages/frontend/app/reports/\[id\]/components/sections/investor/
```

- [ ] **Step 3: Delete old docs/plans**

```bash
git rm -f docs/plans/2026-02-15-scores-section-design.md
git rm -f docs/plans/2026-03-01-scoring-optimizer-plan.md
git rm -f docs/plans/2026-03-01-scoring-optimizer-python-package-design.md
git rm -f docs/plans/2026-03-07-v3-calibration-and-ci-validation.md
git rm -f docs/BACKTEST-VALIDATION-REPORT.md
```

- [ ] **Step 4: Build both packages to ensure nothing depended on deleted files**

```bash
cd packages/backend && npm run build
cd packages/frontend && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: delete v3 scoring scripts, legacy report sections, and outdated plans"
```

---

### Task 21: Delete old v3 scores from database

**This is the point of no return. Take a backup first.**

- [ ] **Step 1: Verify v4 scores exist for all geos**

```bash
curl "http://localhost:3001/api/scores/all/metro?types=propertyiq&limit=1"
curl "http://localhost:3001/api/scores/all/county?types=propertyiq&limit=1"
curl "http://localhost:3001/api/scores/all/zip?types=propertyiq&limit=1"
```

All should return data.

- [ ] **Step 2: Count old rows (for safety)**

Run in Supabase SQL editor or via backend:

```sql
SELECT score_type, COUNT(*) FROM propertyiq_scores GROUP BY score_type;
```

Expected: `propertyiq` has ~23,609 rows. Old types have their counts.

- [ ] **Step 3: Delete old score rows**

```sql
DELETE FROM propertyiq_scores WHERE score_type IN ('homeready', 'investoredge', 'markethealth');
```

- [ ] **Step 4: Verify only propertyiq remains**

```sql
SELECT score_type, COUNT(*) FROM propertyiq_scores GROUP BY score_type;
```

Expected: Only `propertyiq` rows.

- [ ] **Step 5: Full site verification**

Browse every major page:

- Homepage → v4 stats display correctly
- /scores → decile tables render
- /reports → report generates with propertyiq template
- /map → click a metro, score shows in sidebar
- /markets → rankings use propertyiq scores
- /graphs → score comparisons work
- /admin/propertyiq-scores → admin panel shows propertyiq data

- [ ] **Step 6: Commit**

```bash
git commit --allow-empty -m "chore(db): deleted v3 score rows (homeready, investoredge, markethealth) from propertyiq_scores"
```

---

### Task 22: Update CLAUDE.md and project documentation

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: Update Section 9 (Score & Confidence Display)**

Remove all references to HomeReady, InvestorEdge, MarketHealth. Update the score components documentation to describe the single PropertyIQ Score with v4 formula. Update ScoreCard to describe the new InputMetrics breakdown instead of ComponentBar.

- [ ] **Step 2: Update score type references throughout CLAUDE.md**

Search and replace throughout the document. Update the data flow diagrams, the common patterns, and the score display section.

- [ ] **Step 3: Build final verification**

```bash
cd packages/backend && npm run build && npm test -- --passWithNoTests
cd packages/frontend && npm run build
```

- [ ] **Step 4: Final commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for single PropertyIQ Score (v4 demand signal)"
```

---

## Verification Checklist (Run After All Tasks)

After all 22 tasks are complete, run this comprehensive verification:

- [ ] **Backend build:** `cd packages/backend && npm run build` → passes
- [ ] **Backend tests:** `cd packages/backend && npm test` → passes
- [ ] **Frontend build:** `cd packages/frontend && npm run build` → passes
- [ ] **Frontend tests:** `cd packages/frontend && npm run test:unit` → passes
- [ ] **No old references:** `grep -r "HomeReady\|InvestorEdge\|MarketHealth" packages/frontend/app/ packages/backend/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".git"` → empty (except maybe comments or backward-compat aliases in admin)
- [ ] **Homepage:** Hero shows v4 stats, no 3-score references
- [ ] **Scores page:** Single PropertyIQ Score with decile tables
- [ ] **Reports:** No toggle, generates with propertyiq template
- [ ] **Map:** Single score in sidebar and detail panel
- [ ] **API:** `curl http://localhost:3001/api/scores?geography=metro&location_id=12420` returns propertyiq score
