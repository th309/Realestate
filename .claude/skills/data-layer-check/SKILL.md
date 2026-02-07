---
name: data-layer-check
description: Enforces PropertyIQ data layer architecture rules
user-invocable: false
---

# Data Layer Architecture Rules

**CRITICAL**: ALL frontend data fetching MUST go through `@/lib/data`.

## The Rule

```typescript
// CORRECT - Use the data layer
import { fetchSnapshotData, useSnapshotData, useDataCard } from '@/lib/data';

// WRONG - Never do this outside lib/data/fetchers/
const response = await fetch(`${API_URL}/api/...`);
```

## Available Functions

| Function | Purpose |
|----------|---------|
| `fetchSnapshotData(metricId, geoLevel, options)` | Current metric values |
| `fetchTimeSeriesData(metricId, geoLevel, geoId, options)` | Historical data |
| `fetchScore(geoLevel, geoId)` | PropertyIQ scores |
| `fetchMarketStats()` | Market statistics |

## Available Hooks

| Hook | Purpose |
|------|---------|
| `useSnapshotData` | Fetch current value with React Query |
| `useTimeSeriesData` | Fetch time series with React Query |
| `useDataCard` | Combined snapshot + trend for metric cards |
| `useDataCardBatch` | Multiple metrics at once |

## If Endpoint Doesn't Exist

1. Add fetcher to `lib/data/fetchers/`
2. Export from `lib/data/index.ts`
3. THEN use in component

## Geography ID Formats

Data is keyed by these fields - search must return matching IDs:

| Geo Level | Key Field | Example |
|-----------|-----------|---------|
| state | region_name | "California" |
| metro | cbsa_code | "35620" |
| county | county_fips | "06001" |
| zip | postal_code | "90210" |

## Files to NEVER Import

- `lib/api/client.ts` - Deprecated
- Direct `fetch()` with `API_URL` outside lib/data
