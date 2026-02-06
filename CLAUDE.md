# PropertyIQ Platform

Real estate analytics platform with React/Next.js frontend and NestJS backend.

## Architecture Rules

### Data Fetching - CRITICAL

**ALL frontend data fetching MUST go through `@/lib/data`.**

```typescript
// CORRECT - Use the data layer
import { fetchSnapshotData, fetchTimeSeriesData, useSnapshotData } from '@/lib/data';

// WRONG - Never do this outside lib/data
const response = await fetch(`${API_URL}/api/metrics/...`);
```

**Why this matters:**
- Unified error handling, caching, and retry logic
- Consistent data transformation and normalization
- Single source of truth for API contracts
- Easier to debug and maintain

**The data layer provides:**
- `fetchSnapshotData(metricId, geoLevel, options)` - Current metric values
- `fetchTimeSeriesData(metricId, geoLevel, geoId, options)` - Historical data
- `fetchScore(geoLevel, geoId, scoreType)` - PropertyIQ scores
- React hooks: `useSnapshotData`, `useTimeSeriesData`, `useScoreData`, `useDataCard`

**If an endpoint doesn't exist in lib/data:**
1. Add it to `lib/data/fetchers/`
2. Export from `lib/data/index.ts`
3. THEN use it in your component

### Files to NEVER import from
- `lib/api/client.ts` - Deprecated, will be removed
- Direct `fetch()` with `API_URL` or `NEXT_PUBLIC_API_URL`

## Project Structure

```
packages/
  frontend/           # Next.js app
    app/              # Pages and components
    lib/
      data/           # THE data layer - all API calls go here
        fetchers/     # fetch functions
        hooks/        # React hooks
        registry.ts   # Metric configurations
      format/         # Formatting utilities
  backend/            # NestJS API
    src/
      metrics/        # Metric endpoints
      scoring/        # PropertyIQ scores
      markets/        # Market data
```

## Adding New Metrics

1. Add metric config to `lib/data/registry.ts`
2. Set `supportedGeos` to specify which geography levels support it
3. Use existing fetchers - they read from registry automatically

## Common Patterns

### Metric Cards
```typescript
import { useDataCard } from '@/lib/data';

const { value, loading, error } = useDataCard(metricId, geoLevel, geoId, { state });
```

### Check Geography Support
```typescript
import { isMetricSupportedForGeo } from '@/lib/data';

if (isMetricSupportedForGeo('home_value', 'zip')) {
  // Safe to fetch
}
```
