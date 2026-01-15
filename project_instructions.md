# REI Platform - Project Instructions

## Overview

Real estate investment platform with interactive maps displaying various metrics across different geography levels (state, metro, county, city, zip).

## Architecture

### Frontend: Next.js App Router
- `/packages/frontend/app/map/` - Main map application

### Backend: NestJS
- `/packages/backend/src/` - API services

### Database: Supabase (PostgreSQL)
- Long-format tables: `zillow_state`, `zillow_metro`, `zillow_county`, `zillow_zip`
- Each table has: `region_id`, `region_name`, `period_date`, `metric_name`, `value`

---

## Central Metric Configuration

**IMPORTANT: All metric properties are defined in ONE place.**

### Single Source of Truth: `config/metrics.ts`

```typescript
// packages/frontend/app/map/config/metrics.ts
export const METRICS: Record<string, MetricConfig> = {
  market_heat: {
    id: 'market_heat',
    title: 'Market Heat Index',      // Display name everywhere
    format: 'index',                  // How to format values
    dataSource: 'zillow',            // Data provider badge
    apiEndpoint: '/api/zillow/market-heat/{geo}',
    keyField: 'auto',                // How to match to GeoJSON
    supportedGeos: ['metro'],        // Which geo levels have data
    rangeType: 'full',               // Color scale calculation
  },
  // ... all other metrics
};
```

### What Each File Does

| File | Purpose | Gets from METRICS |
|------|---------|-------------------|
| `config/metrics.ts` | **THE source of truth** | N/A - defines everything |
| `config/metric-categories.tsx` | Sidebar category organization | `title`, `dataSource` |
| `config/fetchMetricData.ts` | Unified API fetching | `apiEndpoint`, `keyField`, `asPercent` |
| `utils/metricUtils.ts` | Formatting & color scale | `format`, `rangeType` |
| `components/Legend.tsx` | Map legend display | via `getMetricFormat()`, `getMetricTitle()` |
| `hooks/useMapLayers.ts` | Map rendering | via `calculateValueRange()` |

### Adding a New Metric

1. **Add to `config/metrics.ts`:**
```typescript
new_metric: {
  id: 'new_metric',
  title: 'New Metric Name',
  format: 'currency',  // currency | percent | percent_abs | number | index | days
  dataSource: 'zillow', // zillow | realtor | calculated | census | fred
  apiEndpoint: '/api/zillow/new-metric/{geo}',
  keyField: 'auto',
  supportedGeos: ['state', 'metro', 'county'],
},
```

2. **Add to category in `config/metric-categories.tsx`:**
```typescript
metric('new_metric', { isPremium: true, isNew: true }),
```

3. **Ensure backend endpoint exists** - that's it!

---

## Data Flow

### How Data Gets to the Map

1. **User selects metric** → `selectedMetric` state
2. **useMapData hook** fetches from API → returns `HomeValues`
3. **HomeValues format:** `Record<string, { value: number; date?: string }>`
4. **useMapLayers** applies to GeoJSON features
5. **Legend** and **Map** both call `calculateValueRange(homeValues, metricFormat, metricId)`
6. **Same min/max** → consistent colors between legend and map

### Key Types

```typescript
// HomeValues can be simple numbers OR objects with dates
type HomeValueEntry = number | { value: number; date?: string };
type HomeValues = Record<string, HomeValueEntry>;

// Helpers to extract values
getValueFromEntry(entry) → number | null
getDateFromEntry(entry) → string | undefined
```

---

## Color Scale

### How It Works

1. `calculateValueRange()` computes min/max from actual data
2. `getColorScale(min, max)` creates Mapbox interpolation expression
3. Both Legend and Map use the SAME min/max values

### Color Palette (7 colors, violet to red)
```typescript
const COLOR_SCALE = [
  '#7c3aed', // Violet (lowest)
  '#3b82f6', // Blue
  '#22c55e', // Green
  '#eab308', // Yellow
  '#f97316', // Orange
  '#ef4444', // Red
  '#b91c1c', // Dark red (highest)
];
```

### Range Calculation by Format

| Format | Range Calculation |
|--------|-------------------|
| `percent` | 5th to 95th percentile |
| `percent_abs` | 5th to 95th percentile (positive values) |
| `currency`, `number`, `days` | min to 95th percentile |
| `index` with `rangeType: 'full'` | actual min to max |

---

## Tooltips & "As Of" Dates

All tooltips show "as of [Month Year]" when data includes dates:

```typescript
// Centralized formatting
const { displayValue, valueColor } = formatTooltipValue(value, metricFormat);
const asOfText = formatAsOfDate(dataDate); // "as of Nov 2025"
```

---

## Backend Query Pattern

### Latest-Per-Region Queries

The backend uses `queryLatestPerRegion()` to get each region's most recent data:

```typescript
// Returns latest available data for each region (not a single global date)
const data = await queryMarketIndicatorLatest(supabase, table, geography);
// Each row includes: region_id, value, date (period_date)
```

This ensures regions with data through different dates all show their latest values.

---

## File Structure

```
packages/frontend/app/map/
├── config/
│   ├── metrics.ts           # SINGLE SOURCE OF TRUTH
│   ├── metric-categories.tsx # Sidebar organization
│   ├── fetchMetricData.ts   # Unified API fetching
│   └── index.ts             # Barrel exports
├── utils/
│   ├── metricUtils.ts       # Formatting, range calculation
│   ├── colorScale.ts        # Mapbox color expressions
│   └── index.ts
├── hooks/
│   ├── useMapLayers.ts      # Map rendering logic
│   └── useMapData.ts        # Data fetching
├── components/
│   ├── Legend.tsx           # Map legend
│   └── ...
└── types.ts                 # TypeScript types
```

---

## Common Patterns

### Fetching Metric Data

```typescript
import { fetchMetricData } from '../config';

const data = await fetchMetricData('market_heat', 'metro');
// Returns: { [cbsaCode]: { value: number, date?: string } }
```

### Getting Metric Info

```typescript
import { getMetricConfig, getMetricFormat, getMetricTitle } from '../config';

const config = getMetricConfig('market_heat');
const format = getMetricFormat('market_heat'); // 'index'
const title = getMetricTitle('market_heat');   // 'Market Heat Index'
```

### Checking Geo Support

```typescript
import { isMetricSupportedForGeo } from '../config';

if (isMetricSupportedForGeo('market_heat', 'metro')) {
  // Metric is available for this geography
}
```

---

## Don't

- Don't duplicate metric names/formats in multiple files
- Don't hardcode color scale breakpoints (use dynamic min/max)
- Don't create separate API methods for each metric (use `fetchMetricData`)
- Don't format values manually (use `formatValue()` or `formatTooltipValue()`)
