# ZIP County Inheritance for v2.0 Scoring

## Problem

v2.0 ZIP scoring produces degenerate distributions because 55% of ZIPs lack `demand_score` and `hotness_score` (Realtor.com data). These metrics carry heavy weight in ZIP formulas (e.g., `demand_score` = 45.8% of HomeReady ZIP). When missing, the `MissingMetricsService` skips them and redistributes weight, collapsing formulas to 2-3 metrics.

## Solution

Backfill missing ZIP-level `demand_score` and `hotness_score` from the parent county's Realtor data. ZIPs without these metrics are low-activity areas where the county-level demand signal is a reasonable proxy.

## Design

### Approach: Bulk Inheritance in the Scoring Pipeline

Add a new step to `fetchAllMetrics()` in `scoring.service.ts` when `geography === 'zip'`. After the existing Realtor data fetch, backfill missing metrics from parent counties.

### Data Flow

```
Existing:
  1. Fetch all ZIP Realtor data → locationsMap
  2. Fetch ZIP census data
  3. Fetch calculated metrics
  4. Return locations

New (ZIP only):
  1. Fetch all ZIP Realtor data → locationsMap
  2. Identify ZIPs missing demand_score or hotness_score
  3. Bulk-fetch ZIP→county mappings from geography_inheritance
  4. Bulk-fetch county Realtor data for parent counties
  5. Backfill missing ZIP values from parent county, mark as inherited
  6. Fetch ZIP census data
  7. Fetch calculated metrics
  8. Return locations
```

Metro and county scoring are untouched.

### Implementation

**New field in `LocationMetrics` (`scoring.types.ts`):**

```typescript
inheritedMetrics?: string[];  // e.g. ['demand_score', 'hotness_score']
```

**New private method in `ScoringService`:**

```typescript
private async backfillFromCounty(
  locationsMap: Map<string, LocationMetrics>,
  periodDate: string,
  metricsToInherit: string[],  // ['demand_score', 'hotness_score']
): Promise<void>
```

Steps:
1. Scan `locationsMap` for ZIPs where any of `metricsToInherit` are null → collect their IDs
2. Bulk query `geography_inheritance` for those ZIP IDs → get `parent_county_fips`
3. Collect unique county FIPS codes
4. Bulk query `realtor_county` for those counties at `periodDate` → get metric values
5. For each missing ZIP metric, copy parent county's value and push metric name to `inheritedMetrics`

**Confidence discount:**

When `location.inheritedMetrics?.length > 0`, reduce data completeness factor by 5 percentage points per inherited metric (e.g., 2 inherited metrics = 90% completeness).

### What stays the same

- Formula weights unchanged
- Z-score calculation unchanged (inherited values treated equally)
- `MissingMetricsService` unchanged (handles metrics still null after inheritance)
- `InheritanceService` untouched
- Metro and county scoring untouched

### Edge Cases

- **ZIP has no `geography_inheritance` entry** — skip, fall through to MissingMetricsService
- **Parent county also missing the metric** — stays null, handled by existing skip strategy
- **ZIP already has the metric** — no backfill, no confidence discount
- **ZIP has one metric but not the other** — only backfill the missing one

### Testing

- Unit test `backfillFromCounty` with mocked Supabase: backfill happens for missing metrics, doesn't overwrite existing, tracks inherited metrics
- Unit test confidence discount: inherited metrics reduce completeness factor
- Post-deployment: re-score ZIPs, verify uniform distribution (mean ~50, std ~28.9), monotonic quintile ordering preserved

### Validation

- Run quintile performance check (same as v2.0 deployment report)
- Confirm monotonic ordering preserved
- Compare distribution: mean ~50, std ~28.9 (uniform)
