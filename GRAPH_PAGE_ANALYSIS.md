# Graph Page Analysis

**Target URL:** https://propertyiq.vercel.app/graphs

**Analysis Date:** Per BUILD_GRAPH_TESTING_SKILL.md instructions.

---

## Chart Implementation

- **Library:** Recharts
- **Component Path:** `packages/frontend/app/graphs/components/ChartSection.tsx`
- **Chart Types:** AreaChart, LineChart, BarChart; ComposedChart when baseline is enabled (to mix Area/Bar with Line for baseline).
- **Imports:** `AreaChart`, `Area`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ResponsiveContainer`, `ReferenceLine`, `Line`, `BarChart`, `Bar`, `LineChart`, `Legend`, `ComposedChart` from `recharts`.
- **Props:** `chartData: Record<string, unknown>[]`, `selectedArea`, `selectedAreaId`, `comparison`, `baseline`, `metric`, `timeFrame`, `setTimeFrame`, `chartType`, `setChartType`, `showMilestones`, `setShowMilestones`, `showForecast`, `setShowForecast`, `visibleSeries`, `toggleSeries`.
- **Data Shape:** Each chart point is `{ date: string; [key: string]: number | boolean | string | undefined }`. Primary series key = `selectedAreaId`; comparison key = `comparison.area`; baseline key = `baseline_${baseline.area.replace(/\s+/g, '_')}`.

---

## Data Flow

### 1. Data Source

- **API Endpoint:** `GET /api/timeseries/:metric/:geoLevel/:regionId?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
- **Frontend Client:** `packages/frontend/lib/api/client.ts` — `timeSeriesApi.getTimeSeries(metric, geoLevel, regionId, startDate, endDate)`.
- **Backend:** `packages/backend/src/timeseries/timeseries.controller.ts` → `TimeSeriesService.getTimeSeries()`.
- **Database:** Supabase; table and column come from `TimeSeriesService.getMetricMapping(metricId)` and `getTableName(source, geoLevel)`. Tables are Realtor, Zillow, Census, etc., per metric mapping.

### 2. Query Parameters

| Parameter      | Values / Format |
|----------------|------------------|
| Geography Type | `national` \| `state` \| `metro` \| `county` \| `city` \| `zip` (from `GeoLevel`) |
| Geography ID   | State: full name or 2-letter code (e.g. `Florida`, `FL`). Metro: `regionId` from search (e.g. `12420` for Austin). County: FIPS. Zip: 5-digit code. City: numeric `id` from API. |
| Time Period    | `1Y`, `3Y`, `5Y`, `10Y`, `Max`. Converted to `startDate`/`endDate` in `useChartData` (e.g. 1Y = last 12 months; Max = from 2000). |
| Metric (Data Type) | Metric IDs from `packages/frontend/app/map/config/metrics.ts` and graph `constants.ts` (e.g. `listing_price`, `home_value`, `days_on_market`, `for_sale_inventory`). Not PropertyIQ score types. |
| Comparison     | `comparison.enabled`, `comparison.area` — same geo level, second region. |
| Baseline       | `baseline.enabled`, `baseline.level` (`national` \| `state`), `baseline.area` (e.g. "United States", state name). |

### 3. Data Schema

**API response (`TimeSeriesResponse`):**

```typescript
interface TimeSeriesDataPoint {
  date: string;  // YYYY-MM-DD or year for census
  value: number;
}

interface TimeSeriesResponse {
  success: boolean;
  metric: string;
  geoLevel: string;
  regionId: string;
  count: number;
  data: TimeSeriesDataPoint[];
  historyMonths?: number;
  current?: number | null;
  prior?: number | null;
  trend_change?: number;
  history?: TimeSeriesHistoryResult;
}
```

**Chart format (`useChartData` output):**

```typescript
interface ChartDataItem {
  date: string;
  [key: string]: number | boolean | string | undefined;  // selectedAreaId, comparison.area, baseline_* keys
}
```

Transform in `useChartData`: `primaryResponse.data.map(point => ({ date: point.date, [selectedArea]: Number(point.value) || 0 }))`. Comparison and baseline are merged into the same array by date.

---

## Search / Filter Functionality

- **Search Component:** `packages/frontend/app/graphs/components/FilterHeader.tsx` uses `SearchBar` from `@/app/map/components` and `useGraphSearch(geoLevel)` from `app/graphs/hooks/useGraphSearch.ts`.
- **Search Type:** Autocomplete-style search bar; results shown in dropdown. For **state** and **national**, no search — dropdowns only (`M3Select` with `primaryOptions` / `baselineOptions`).
- **When Search Is Shown:** `showSearch = ['metro','county','city','zip'].includes(geoLevel)`.
- **Searchable Fields:**
  - **Metro:** `loadAllMetros()` → `/markets/metros` or fallback list; search on `name`, `fullName`; returns `SearchResult` with `value = metro.regionId.toString()`.
  - **County:** `loadAllCounties()` → `/markets/counties`; search on name, state; `value = county.fips`.
  - **ZIP:** `loadAllZips()` → `/markets/zips`; search on code, name; `value = zip.code`.
  - **City:** `loadAllCities()` → `/markets/cities`; search on name, state; `value = city.id.toString()`.
  - **State:** `US_STATES` from `@/app/map/types`; search on name/abbrev; `value = state.abbrev`.
- **Filter Options:**
  - Geography level: `GEO_LEVEL_OPTIONS` (National, State, Metro, County, City, ZIP).
  - Primary area: dropdown for national/state; search for metro/county/city/zip.
  - Compare: toggle + “Compare To” dropdown (same level, excludes primary).
  - Baseline: toggle + “Base Level” (National/State) + “Base Area” dropdown.
  - Metric: `MetricSelector` with `metricOptions` from `useAllMetricOptions(geoLevel)`.
- **Search Result Format:** `SearchResult` from `@/app/map/types`: `{ id, name, subtitle?, value?, type, center?, state? }`. On select, `setSelectedArea(result.name)`, `setSelectedAreaId(result.value ?? result.name)`.

---

## Comparison / Baseline Features

- **Comparison:** Same geo level as primary; second area (e.g. “Texas” vs “Florida”). Fetched in `useChartData` via second `timeSeriesApi.getTimeSeries(..., comparison.area, ...)` and merged by date.
- **Baseline:** National or state only (`BASELINE_GEO_LEVELS`). `extractRegionId(baseline.area, baseline.level)` maps display name to API regionId (e.g. “United States”, state name/abbrev). Fetched and merged under key `baseline_${baseline.area.replace(/\s+/g, '_')}`.
- **Implementation:** Both are optional; when enabled, extra series are drawn (Area/Line/Bar) with distinct colors; legend and series toggles support primary, comparison, baseline.

---

## Data Validation / Schema

- **Types:** `app/graphs/types.ts` — `ComparisonConfig`, `Milestone`, `MetricOption`, `MetricCategory`. GeoLevel and metric config from `@/app/map/config/metrics`.
- **Validation:** No Zod/Yup in graph-specific code. Backend uses NestJS params; frontend assumes `TimeSeriesResponse` and numeric values (e.g. `Number(point.value) || 0`).
- **Valid Ranges:** Metric-dependent (currency, percent, days, etc.). PropertyIQ scores (ScoreCards) are 0–100; graph metrics use map `MetricConfig.format` (currency, percent, etc.) — no single 0–100 rule for all graph series.
- **Required vs Optional:** `date` and at least one value key required for a point. Empty or failed API yields `[]` and possibly `error` in `useChartData`.

---

## Known Issues (from user / BUILD doc)

1. **Data connections not working** — e.g. wrong regionId/geoLevel or backend table missing for metric/geo.
2. **Search function not returning expected formats** — `SearchResult.value` must match what timeseries API expects (e.g. metro = CBSA/regionId, state = abbrev or name, county = FIPS).
3. **Empty graphs showing** — No dedicated “No data” empty state in `ChartSection`; empty `chartData` still renders an empty Recharts container.
4. **Need to compare to baseline** — Baseline and comparison are implemented; failures can be due to `extractRegionId` or wrong baseline level/area for API.

---

## Performance Targets

- **Load time:** &lt; 2 seconds (goal).
- **Console errors:** Zero required.
- **Empty state:** Chart has no explicit empty-state UI when `chartData.length === 0`; only Y-domain becomes `['auto','auto']`.

---

## Key File Reference

| Concern           | File(s) |
|-------------------|---------|
| Page entry        | `packages/frontend/app/graphs/page.tsx` |
| Dashboard / layout | `packages/frontend/app/graphs/Dashboard.tsx` |
| Chart UI          | `packages/frontend/app/graphs/components/ChartSection.tsx` |
| Chart data hook   | `packages/frontend/app/graphs/hooks/useChartData.ts` |
| Filters / search  | `packages/frontend/app/graphs/components/FilterHeader.tsx` |
| Search logic      | `packages/frontend/app/graphs/hooks/useGraphSearch.ts` |
| State / options   | `packages/frontend/app/graphs/hooks/useDashboardState.ts` |
| Metric list       | `packages/frontend/app/graphs/constants.ts` |
| Time series API   | `packages/frontend/lib/api/client.ts` (`timeSeriesApi`) |
| Backend TS        | `packages/backend/src/timeseries/timeseries.controller.ts`, `timeseries.service.ts` |
| Metrics config    | `packages/frontend/app/map/config/metrics.ts` |
| Map/search types  | `packages/frontend/app/map/types.ts` (`SearchResult`, `GeoLevel`) |
