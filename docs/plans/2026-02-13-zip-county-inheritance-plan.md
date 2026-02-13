# ZIP County Inheritance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Backfill missing ZIP-level `demand_score` and `hotness_score` from parent county Realtor data so v2.0 ZIP scoring produces a healthy distribution.

**Architecture:** Add a `backfillFromCounty()` method to `ScoringService` that bulk-fetches ZIP→county mappings and county Realtor data, then fills missing ZIP metrics. Called within the existing `fetchAllMetrics()` pipeline when `geography === 'zip'`. Confidence score is slightly reduced for inherited metrics.

**Tech Stack:** NestJS, Supabase (PostgREST), Jest

---

### Task 1: Write Failing Test for backfillFromCounty

**Files:**
- Create: `packages/backend/src/scoring/__tests__/unit/backfill-from-county.spec.ts`

**Step 1: Write the test file**

```typescript
/**
 * Tests for ZIP county inheritance backfill logic.
 * Verifies that missing demand_score/hotness_score are inherited from parent county.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ScoringService } from '../../scoring.service';
import { NormalizationService } from '../../normalization.service';
import { InheritanceService } from '../../inheritance.service';
import { MarketHealthService } from '../../market-health.service';
import { SUPABASE_CLIENT } from '../../../supabase/supabase.service';
import { LocationMetrics } from '../../scoring.types';

// Helper to build a mock Supabase chain that returns different data per table
function createMockSupabase(tableResponses: Record<string, any[]>) {
  const mock: any = {};
  let currentTable = '';

  mock.from = jest.fn((table: string) => {
    currentTable = table;
    return mock;
  });
  mock.select = jest.fn().mockReturnValue(mock);
  mock.eq = jest.fn().mockReturnValue(mock);
  mock.in = jest.fn().mockReturnValue(mock);
  mock.order = jest.fn().mockReturnValue(mock);
  mock.range = jest.fn().mockImplementation(() => {
    const data = tableResponses[currentTable] || [];
    return Promise.resolve({ data, error: null });
  });
  mock.limit = jest.fn().mockReturnValue(mock);
  mock.single = jest.fn().mockResolvedValue({ data: null });
  mock.upsert = jest.fn().mockResolvedValue({ error: null });
  mock.delete = jest.fn().mockReturnValue(mock);
  mock.insert = jest.fn().mockResolvedValue({ error: null });

  return mock;
}

describe('backfillFromCounty', () => {
  it('should backfill missing demand_score from parent county', async () => {
    const mockSupabase = createMockSupabase({
      geography_inheritance: [
        { geography_id: '90210', geography_type: 'zip', parent_county_fips: '06037' },
      ],
      realtor_county: [
        { county_fips: '06037', demand_score: 72, hotness_score: 65 },
      ],
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoringService,
        NormalizationService,
        InheritanceService,
        MarketHealthService,
        { provide: SUPABASE_CLIENT, useValue: mockSupabase },
      ],
    }).compile();

    const service = module.get<ScoringService>(ScoringService);
    const locationsMap = new Map<string, LocationMetrics>();
    locationsMap.set('90210', {
      location_id: '90210',
      location_name: 'Beverly Hills',
      demand_score: undefined,  // missing
      hotness_score: undefined, // missing
      pending_ratio: 0.5,
      median_days_on_market: 30,
    });

    // Access private method via bracket notation
    await (service as any).backfillFromCounty(
      locationsMap,
      '2025-12-01',
      ['demand_score', 'hotness_score'],
    );

    const location = locationsMap.get('90210')!;
    expect(location.demand_score).toBe(72);
    expect(location.hotness_score).toBe(65);
    expect(location._inherited).toContain('demand_score');
    expect(location._inherited).toContain('hotness_score');
  });

  it('should NOT overwrite existing metric values', async () => {
    const mockSupabase = createMockSupabase({
      geography_inheritance: [
        { geography_id: '90210', geography_type: 'zip', parent_county_fips: '06037' },
      ],
      realtor_county: [
        { county_fips: '06037', demand_score: 72, hotness_score: 65 },
      ],
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoringService,
        NormalizationService,
        InheritanceService,
        MarketHealthService,
        { provide: SUPABASE_CLIENT, useValue: mockSupabase },
      ],
    }).compile();

    const service = module.get<ScoringService>(ScoringService);
    const locationsMap = new Map<string, LocationMetrics>();
    locationsMap.set('90210', {
      location_id: '90210',
      location_name: 'Beverly Hills',
      demand_score: 88,         // already has value
      hotness_score: undefined,  // missing
      pending_ratio: 0.5,
      median_days_on_market: 30,
    });

    await (service as any).backfillFromCounty(
      locationsMap,
      '2025-12-01',
      ['demand_score', 'hotness_score'],
    );

    const location = locationsMap.get('90210')!;
    expect(location.demand_score).toBe(88);  // unchanged
    expect(location.hotness_score).toBe(65); // inherited
    expect(location._inherited).not.toContain('demand_score');
    expect(location._inherited).toContain('hotness_score');
  });

  it('should handle ZIP with no geography_inheritance entry', async () => {
    const mockSupabase = createMockSupabase({
      geography_inheritance: [],  // no mapping found
      realtor_county: [],
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoringService,
        NormalizationService,
        InheritanceService,
        MarketHealthService,
        { provide: SUPABASE_CLIENT, useValue: mockSupabase },
      ],
    }).compile();

    const service = module.get<ScoringService>(ScoringService);
    const locationsMap = new Map<string, LocationMetrics>();
    locationsMap.set('99999', {
      location_id: '99999',
      location_name: 'Unknown ZIP',
      demand_score: undefined,
      hotness_score: undefined,
    });

    await (service as any).backfillFromCounty(
      locationsMap,
      '2025-12-01',
      ['demand_score', 'hotness_score'],
    );

    const location = locationsMap.get('99999')!;
    expect(location.demand_score).toBeUndefined();
    expect(location.hotness_score).toBeUndefined();
    expect(location._inherited).toBeUndefined();
  });

  it('should handle parent county also missing the metric', async () => {
    const mockSupabase = createMockSupabase({
      geography_inheritance: [
        { geography_id: '99998', geography_type: 'zip', parent_county_fips: '99001' },
      ],
      realtor_county: [
        { county_fips: '99001', demand_score: null, hotness_score: null },
      ],
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoringService,
        NormalizationService,
        InheritanceService,
        MarketHealthService,
        { provide: SUPABASE_CLIENT, useValue: mockSupabase },
      ],
    }).compile();

    const service = module.get<ScoringService>(ScoringService);
    const locationsMap = new Map<string, LocationMetrics>();
    locationsMap.set('99998', {
      location_id: '99998',
      location_name: 'Rural ZIP',
      demand_score: undefined,
      hotness_score: undefined,
    });

    await (service as any).backfillFromCounty(
      locationsMap,
      '2025-12-01',
      ['demand_score', 'hotness_score'],
    );

    const location = locationsMap.get('99998')!;
    expect(location.demand_score).toBeUndefined();
    expect(location.hotness_score).toBeUndefined();
    expect(location._inherited).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest packages/backend/src/scoring/__tests__/unit/backfill-from-county.spec.ts --no-coverage`
Expected: FAIL — `backfillFromCounty` is not a function

**Step 3: Commit**

```bash
git add packages/backend/src/scoring/__tests__/unit/backfill-from-county.spec.ts
git commit -m "test: add failing tests for ZIP county inheritance backfill"
```

---

### Task 2: Implement backfillFromCounty

**Files:**
- Modify: `packages/backend/src/scoring/scoring.service.ts`

**Step 1: Add the backfillFromCounty method**

Add this private method to `ScoringService`, after the `fetchCalculatedMetrics` method (around line 1050-ish, in the "Private: Data Fetching" section):

```typescript
/**
 * Backfill missing ZIP metrics from parent county Realtor data.
 * For ZIPs missing demand_score/hotness_score, looks up the parent county
 * via geography_inheritance and copies the county's values.
 */
private async backfillFromCounty(
  locationsMap: Map<string, LocationMetrics>,
  periodDate: string,
  metricsToInherit: string[],
): Promise<void> {
  // 1. Find ZIPs missing any of the metrics
  const missingZips: string[] = [];
  for (const [zipId, location] of locationsMap) {
    for (const metric of metricsToInherit) {
      if ((location as any)[metric] == null) {
        missingZips.push(zipId);
        break;
      }
    }
  }

  if (missingZips.length === 0) return;

  // 2. Bulk-fetch ZIP→county mappings
  const zipToCounty = new Map<string, string>();
  const pageSize = 1000;
  for (let i = 0; i < missingZips.length; i += pageSize) {
    const batch = missingZips.slice(i, i + pageSize);
    const { data, error } = await this.supabase
      .from('geography_inheritance')
      .select('geography_id, parent_county_fips')
      .in('geography_id', batch);

    if (error) {
      console.warn(`Failed to fetch geography_inheritance: ${error.message}`);
      return;
    }
    if (data) {
      for (const row of data) {
        if (row.parent_county_fips) {
          zipToCounty.set(row.geography_id, row.parent_county_fips);
        }
      }
    }
  }

  if (zipToCounty.size === 0) return;

  // 3. Get unique county FIPS codes and fetch their Realtor data
  const uniqueCounties = [...new Set(zipToCounty.values())];
  const countyMetrics = new Map<string, Record<string, number | null>>();

  for (let i = 0; i < uniqueCounties.length; i += pageSize) {
    const batch = uniqueCounties.slice(i, i + pageSize);
    const selectCols = ['county_fips', ...metricsToInherit].join(', ');
    const { data, error } = await this.supabase
      .from('realtor_county')
      .select(selectCols)
      .eq('period_date', periodDate)
      .in('county_fips', batch);

    if (error) {
      console.warn(`Failed to fetch county Realtor data: ${error.message}`);
      return;
    }
    if (data) {
      for (const row of data) {
        const values: Record<string, number | null> = {};
        for (const metric of metricsToInherit) {
          values[metric] = row[metric] ?? null;
        }
        countyMetrics.set(row.county_fips, values);
      }
    }
  }

  // 4. Backfill missing ZIP values from parent county
  for (const [zipId, countyFips] of zipToCounty) {
    const location = locationsMap.get(zipId);
    const county = countyMetrics.get(countyFips);
    if (!location || !county) continue;

    for (const metric of metricsToInherit) {
      if ((location as any)[metric] == null && county[metric] != null) {
        (location as any)[metric] = county[metric];
        if (!location._inherited) location._inherited = [];
        location._inherited.push(metric);
      }
    }
  }
}
```

**Step 2: Run the tests**

Run: `npx jest packages/backend/src/scoring/__tests__/unit/backfill-from-county.spec.ts --no-coverage`
Expected: All 4 tests PASS

**Step 3: Commit**

```bash
git add packages/backend/src/scoring/scoring.service.ts
git commit -m "feat: add backfillFromCounty for ZIP county inheritance"
```

---

### Task 3: Wire backfillFromCounty into fetchAllMetrics

**Files:**
- Modify: `packages/backend/src/scoring/scoring.service.ts:887-893`

**Step 1: Add the backfill call**

In `fetchAllMetrics()`, change the ZIP branch (lines 891-892) from:

```typescript
    } else if (geography === 'zip') {
      await this.fetchZipCensusData(locationsMap, periodDate);
    }
```

to:

```typescript
    } else if (geography === 'zip') {
      await this.backfillFromCounty(locationsMap, periodDate, ['demand_score', 'hotness_score']);
      await this.fetchZipCensusData(locationsMap, periodDate);
    }
```

**Step 2: Run existing tests to verify no regressions**

Run: `npx jest packages/backend/src/scoring/__tests__/unit/scoring.service.spec.ts --no-coverage`
Expected: PASS (existing tests unchanged — they mock Supabase and don't test fetchAllMetrics directly)

**Step 3: Commit**

```bash
git add packages/backend/src/scoring/scoring.service.ts
git commit -m "feat: wire ZIP county inheritance into scoring pipeline"
```

---

### Task 4: Add Confidence Discount for Inherited Metrics

**Files:**
- Modify: `packages/backend/src/scoring/scoring.service.ts:1333-1337`

**Step 1: Write a failing test**

Add to `backfill-from-county.spec.ts`:

```typescript
describe('confidence discount for inherited metrics', () => {
  it('should reduce completeness by 5pp per inherited metric', async () => {
    const mockSupabase = createMockSupabase({});
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoringService,
        NormalizationService,
        InheritanceService,
        MarketHealthService,
        { provide: SUPABASE_CLIENT, useValue: mockSupabase },
      ],
    }).compile();

    const service = module.get<ScoringService>(ScoringService);

    // Location with 2 inherited metrics
    const location: LocationMetrics = {
      location_id: '90210',
      location_name: 'Beverly Hills',
      demand_score: 72,
      hotness_score: 65,
      median_days_on_market: 30,
      pending_ratio: 0.5,
      affordability_ratio: 1.2,
      _inherited: ['demand_score', 'hotness_score'],
    };

    // HomeReady ZIP formula has 4 metrics: demand_score, median_days_on_market, pending_ratio, affordability_ratio
    const result = (service as any).calculateConfidence(location, 'zip', 'homeready');

    // All 4 metrics present = 100% base completeness
    // 2 inherited metrics = -10pp = 90% completeness
    // Factor 1 = 90 * 0.30 = 27
    // Factor 2 = min(0.15 * 125, 100) = 18.75 * 0.40 = 7.5
    // Factor 3 = 100 * 0.15 = 15
    // Factor 4 = 80 * 0.15 = 12 (has hotness_score)
    // Total = 61.5
    expect(result.confidence).toBeLessThan(65); // Would be ~64.5 without discount
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest packages/backend/src/scoring/__tests__/unit/backfill-from-county.spec.ts --no-coverage -t "confidence discount"`
Expected: FAIL — confidence is higher than expected (no discount applied yet)

**Step 3: Modify calculateConfidence**

In `calculateConfidence()` (line 1333-1337), change:

```typescript
    // Factor 1: Data Completeness (30%)
    const availableMetrics = metricNames.filter(
      m => (location as any)[m] !== null && (location as any)[m] !== undefined,
    ).length;
    const completeness = (availableMetrics / metricNames.length) * 100;
```

to:

```typescript
    // Factor 1: Data Completeness (30%)
    const availableMetrics = metricNames.filter(
      m => (location as any)[m] !== null && (location as any)[m] !== undefined,
    ).length;
    let completeness = (availableMetrics / metricNames.length) * 100;

    // Discount for inherited metrics (5pp per inherited metric)
    const inheritedCount = location._inherited
      ? location._inherited.filter(m => metricNames.includes(m)).length
      : 0;
    completeness = Math.max(0, completeness - inheritedCount * 5);
```

**Step 4: Run tests**

Run: `npx jest packages/backend/src/scoring/__tests__/unit/backfill-from-county.spec.ts --no-coverage`
Expected: All tests PASS

**Step 5: Run full scoring test suite for regressions**

Run: `npx jest packages/backend/src/scoring/__tests__/ --no-coverage`
Expected: All PASS

**Step 6: Commit**

```bash
git add packages/backend/src/scoring/scoring.service.ts packages/backend/src/scoring/__tests__/unit/backfill-from-county.spec.ts
git commit -m "feat: add confidence discount for inherited ZIP metrics"
```

---

### Task 5: Add demand_score to Missing Metrics Strategies

**Files:**
- Modify: `packages/backend/src/scoring/missing-metrics.service.ts`

**Step 1: Verify demand_score is not in METRIC_MISSING_STRATEGIES**

Check: `demand_score` is missing from the `METRIC_MISSING_STRATEGIES` map (it defaults to `'skip'` via the fallback on line 145). Add it explicitly for clarity:

After line 47 (`hotness_score: 'skip',`), add:

```typescript
  demand_score: 'skip',
```

This is a documentation-only change — behavior is the same since missing keys already default to `'skip'`. But it makes the strategy explicit alongside `hotness_score`.

**Step 2: Run missing metrics tests**

Run: `npx jest packages/backend/src/scoring/__tests__/unit/missing-metrics.service.spec.ts --no-coverage`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/backend/src/scoring/missing-metrics.service.ts
git commit -m "chore: make demand_score skip strategy explicit in METRIC_MISSING_STRATEGIES"
```

---

### Task 6: Post-Deployment Validation

This task is manual — run after deploying to verify the fix works.

**Step 1: Re-score ZIPs for 2025-12-01**

Trigger a ZIP re-scoring via the scoring endpoint or admin tool for `periodDate=2025-12-01`.

**Step 2: Check distribution**

Query the scores table to verify:
- Mean score ~50 (was degenerate before)
- Std dev ~28.9 (uniform distribution)
- No cluster of scores at a single value

```sql
SELECT
  score_type,
  COUNT(*) as n,
  ROUND(AVG(score)::numeric, 1) as mean,
  ROUND(STDDEV(score)::numeric, 1) as stddev,
  MIN(score) as min,
  MAX(score) as max
FROM propertyiq_scores
WHERE geography_type = 'zip'
  AND score_date = '2025-12-01'
GROUP BY score_type;
```

**Step 3: Check quintile monotonicity**

Run the same quintile performance check from the v2.0 deployment report. Verify Q1 < Q2 < Q3 < Q4 < Q5 for excess returns.

**Step 4: Check inheritance coverage**

```sql
-- How many ZIPs got inherited metrics?
SELECT COUNT(*) as total_zips,
  COUNT(*) FILTER (WHERE inherited_metrics IS NOT NULL) as inherited_count
FROM propertyiq_scores
WHERE geography_type = 'zip'
  AND score_date = '2025-12-01';
```

Expected: ~55% of ZIPs should have inherited metrics.
