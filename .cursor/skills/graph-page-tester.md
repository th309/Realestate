# Graph Page Testing Skill

## Purpose

Autonomously test and fix the PropertyIQ graphs page at **https://propertyiq.vercel.app/graphs**. Validate data loading, chart rendering, search/filters, comparison/baseline, and performance.

## Self-Modification

**This skill can change itself when it is not getting the results it needs.** If test coverage is too narrow, the suite misses failures, the workflow (batch size, wait time, force-restart steps) is wrong, or instructions are unclear or outdated, **edit this skill file** (`.cursor/skills/graph-page-tester.md`) to:

- Add or adjust test cases, API URLs, or failure classifications.
- Update the batch-fix workflow (e.g. batch size, commit/push, force-restart, wait time).
- Clarify or expand auto-fix steps, known issues, or success criteria.
- Align with changes in the app (e.g. new metrics, geos, or endpoints).

After updating the skill, continue the iterative process using the revised instructions. Do not assume the skill is fixed; update it when results are unsatisfactory.

## Iterative Behavior (Batches of 20, Commit, Force Restart, Wait)

**The skill is iterative and batches fixes.** Most fixes require a frontend or backend restart (Vercel/Railway). Rebuilds take ~5 minutes, so:

1. **Run the suite** — Execute tests and collect all failures (classify each: `no_data`, `wrong_format`, `search_empty`, etc.).
2. **Group in batches of 20** — Collect up to 20 fixes per batch (by root cause and affected file). Do not exceed 20 fixes per batch.
3. **Apply the batch** — Make all fixes for that batch in one pass. Do not fix one failure, push, then the next.
4. **Commit and push** — Commit all changes for the batch and push to trigger deploys.
5. **Force restart** — Add a trivial change to both frontend and backend so Vercel and Railway rebuild:
   - **Frontend:** e.g. add or tweak a comment in `packages/frontend/` (e.g. `app/graphs/page.tsx` or `package.json` description) so Vercel detects a change.
   - **Backend:** e.g. add or tweak a comment in `packages/backend/` (e.g. `src/main.ts` or `package.json` description) so Railway detects a change.
   Include these trivial changes in the same commit as the batch, then push.
6. **Wait ~5 minutes** — Rebuilds take about 5 minutes. Wait before re-running tests.
7. **Continue** — Re-run the test suite, collect new failures, form the next batch of up to 20, fix → commit & push (with trivial frontend/backend bumps) → wait ~5 min → repeat. Report at the end.

## When to Use

Trigger when the user says:

- "test graphs page"
- "fix graphs"
- "validate graph data"
- "check graphs are working"
- "run graph tests"

---

## Graph Page Context

**Source:** See `GRAPH_PAGE_ANALYSIS.md` in the repo root for full details. Summary:

### Chart Implementation

- **Library:** Recharts (`AreaChart`, `LineChart`, `BarChart`, `ComposedChart`, `ResponsiveContainer`, etc.)
- **Component:** `packages/frontend/app/graphs/components/ChartSection.tsx`
- **Chart types:** Area, Line, Bar (user-selectable). Baseline renders as a Line over Area/Bar.
- **Data shape:** `{ date: string; [key: string]: number | boolean | string | undefined }[]`. Keys: `selectedAreaId`, `comparison.area`, `baseline_${baseline.area.replace(/\s+/g, '_')}`.

### Data Flow

- **API:** `GET /api/timeseries/:metric/:geoLevel/:regionId?startDate=&endDate=`
- **Client:** `packages/frontend/lib/api/client.ts` → `timeSeriesApi.getTimeSeries(metric, geoLevel, regionId, startDate, endDate)`
- **Hook:** `packages/frontend/app/graphs/hooks/useChartData.ts` — builds `startDate`/`endDate` from `timeFrame` (`1Y`|`3Y`|`5Y`|`10Y`|`Max`), fetches primary + optional comparison + baseline, merges by date
- **Backend:** `packages/backend/src/timeseries/timeseries.controller.ts` → `TimeSeriesService.getTimeSeries()` → Supabase

### Query Parameters

| Parameter       | Values / format |
|----------------|------------------|
| Geography type | `national` \| `state` \| `metro` \| `county` \| `city` \| `zip` |
| Geography ID   | State: name or abbrev (e.g. Florida, FL). Metro: `regionId` from search. County: FIPS. Zip: 5-digit. City: numeric id. |
| Time period    | `1Y`, `3Y`, `5Y`, `10Y`, `Max` → converted to date range in `useChartData` |
| Metric (data)  | Metric IDs from `packages/frontend/app/map/config/metrics.ts` (e.g. `listing_price`, `home_value`, `days_on_market`, `for_sale_inventory`) |
| Comparison     | Same geo level; second area. Fetched and merged in `useChartData`. |
| Baseline       | National or State only; `extractRegionId(baseline.area, baseline.level)` used for API. |

### Search / Filter

- **Search:** `app/graphs/hooks/useGraphSearch.ts`; used in `FilterHeader` for metro/county/city/zip. State/national use dropdowns only.
- **Search result shape:** `SearchResult` from `@/app/map/types`: `{ id, name, subtitle?, value?, type, center?, state? }`. On select: `selectedArea = result.name`, `selectedAreaId = result.value ?? result.name`.
- **Metric options:** `useAllMetricOptions(geoLevel)` → metric list filtered by geography; chosen via `MetricSelector` in FilterHeader.

### Known Issues

1. Data connections not working (wrong regionId/geoLevel or missing backend mapping).
2. Search returning formats that don’t match what the timeseries API expects (e.g. metro must send regionId, state abbrev/name).
3. Empty graphs: no dedicated empty-state UI in `ChartSection` when `chartData.length === 0`.
4. Baseline comparison failing due to `extractRegionId` or wrong level/area.

---

## Testing Strategy

### Phase 1: Data Layer Testing

1. **API / backend**
   - Call `GET /api/timeseries/:metric/:geoLevel/:regionId` with sample params (e.g. `listing_price`, `state`, `Florida`, 1Y range).
   - Confirm response shape: `{ success, data: { date, value }[] }`, non-empty for common geos.
   - Check date range matches requested `startDate`/`endDate`.
   - For metro, use a known `regionId` from search (e.g. Austin → value from `/markets/metros` or useGraphSearch).

2. **Transformation**
   - In `useChartData`, ensure `primaryResponse.data` is mapped to `{ date, [selectedArea]: value }` and comparison/baseline merge correctly.
   - Confirm numeric handling: `Number(point.value) || 0`.
   - Validate baseline key: `baseline_${baseline.area.replace(/\s+/g, '_')}`.

3. **Edge data**
   - Geography with no data → API returns `[]`; chart receives `[]`.
   - Invalid metric/geo → backend returns empty or error; frontend should not throw and should avoid blank charts without explanation.

### Phase 2: Component Testing

1. **ChartSection**
   - Render with sample `chartData` (e.g. 12 points). Check Recharts receive `data`, `dataKey="date"`, and value keys.
   - Empty data: `chartData.length === 0` → Y domain `['auto','auto']`; currently no EmptyState component.
   - Responsive: `isMobile = window.innerWidth < 768` affects margins and tick interval.

2. **Search (useGraphSearch + FilterHeader)**
   - Metro: query "Austin" → results include Austin-Round Rock-Georgetown; each result has `id`, `name`, `value`, `type`.
   - County: query "Cook" → results like "Cook, IL" with `value` = FIPS.
   - State: dropdown only; no search. ZIP/City: search by code/name.
   - No results: `handleSearch('xyznonexistent')` → `searchResults = []`, no throw.

3. **Filters**
   - Change geo level → primary/baseline options update (`getOptionsForLevel`, `BASELINE_GEO_LEVELS`).
   - Change metric → `useChartData` refetches via `metric` dep.
   - Change time frame → `timeFrame` in `useChartData` drives date range.
   - Comparison/baseline toggles → extra series fetched and merged when enabled.

### Phase 3: Integration Testing

1. **Basic flow:** Select State "Florida" → Metric "Listing Price" → Time "1Y". Expect chart with Florida series, load &lt; 2s, no console errors.
2. **Search flow:** Geo Metro → type "Austin" → pick "Austin-Round Rock-Georgetown, TX" → expect chart for that metro’s `regionId`.
3. **Comparison flow:** Enable "Compare" → pick second state → expect two series and legend.
4. **Baseline flow:** Enable "Baseline" → Level National, Area "United States" → expect baseline series and legend.
5. **Time flow:** Switch 1Y → 5Y → 10Y → Max; expect date range and point count to change appropriately.

### Phase 4: Performance

- Measure time from first request (or page load) to chart paint. Target &lt; 2s.
- If slow: inspect `useChartData` (single primary + optional comparison/baseline), backend query, and React/recharts render.

### Phase 5: Error Detection

- **Empty graph:** No data or failed request → `useChartData` sets `data = []`, possibly `error`. Chart still mounts with empty data. Detect by `data.length === 0` and missing EmptyState.
- **Search “not working”:** Results not in `SearchResult` shape, or `value` wrong for API (e.g. metro sending name instead of regionId). Check `useGraphSearch` output and `handleSelectResult` in FilterHeader.
- **Wrong data:** Stale or wrong regionId/geoLevel. Check deps in `useChartData` and that `selectedAreaId`/comparison/baseline are passed correctly to the API.

---

## Test Case Template

Use this shape for each test (implement in TS when building a test runner):

```typescript
interface GraphTestCase {
  name: string;
  description: string;

  setup: {
    geography: { type: 'national' | 'state' | 'metro' | 'county' | 'city' | 'zip'; id: string; name: string };
    metric: string;           // e.g. 'listing_price', 'home_value'
    timeFrame: '1Y' | '3Y' | '5Y' | '10Y' | 'Max';
    comparison?: { enabled: boolean; area?: string };
    baseline?: { enabled: boolean; level?: 'national' | 'state'; area?: string };
  };

  expectations: {
    dataPresent: boolean;
    minDataPoints?: number;
    loadTimeMsMax?: number;
    noConsoleErrors: boolean;
    renderSuccessful: boolean;
  };

  // When implementing runner:
  // validate(result: GraphTestResult): { passed: boolean; issues: string[]; fixes: string[] }
}
```

---

## Comprehensive Test Suite

Concrete cases aligned to the codebase (metrics from `constants.ts` / `metrics.ts`, geos from `useDashboardState` / `useGraphSearch`).

### Geography (8)

1. **State Florida, listing_price, Max** — geoLevel=state, regionId=Florida (or FL), metric=listing_price, timeFrame=Max.
2. **State Texas, listing_price, 5Y** — state, Texas/TX, listing_price, 5Y.
3. **State California, home_value, 3Y** — state, California/CA, home_value, 3Y.
4. **State New York, days_on_market, 1Y** — state, New York/NY, days_on_market, 1Y.
5. **Metro Austin, listing_price, 5Y** — metro, regionId for Austin-Round Rock-Georgetown (from search), listing_price, 5Y.
6. **Metro Phoenix, home_value, 3Y** — metro, Phoenix-Mesa-Chandler regionId, home_value, 3Y.
7. **County Travis (TX), listing_price, 5Y** — county, FIPS for Travis TX, listing_price, 5Y (if supported).
8. **ZIP 78701, listing_price, 1Y** — zip, 78701, listing_price, 1Y (if supported).

### Time (4)

9. **Florida listing_price 1Y** — state Florida, listing_price, 1Y.
10. **Florida listing_price 3Y** — state Florida, listing_price, 3Y.
11. **Florida listing_price 10Y** — state Florida, listing_price, 10Y.
12. **Florida listing_price Max** — state Florida, listing_price, Max.

### Metric / data type (4)

13. **Florida home_value Max** — state Florida, home_value, Max.
14. **Florida days_on_market Max** — state Florida, days_on_market, Max.
15. **Florida for_sale_inventory Max** — state Florida, for_sale_inventory, Max.
16. **Florida cap_rate Max** — state Florida, cap_rate, Max (if metric exists and is supported for state).

### Comparison & baseline (3)

17. **Compare Florida vs Texas** — state, primary Florida, comparison enabled, area Texas; expect two series.
18. **Baseline National** — state Florida, baseline enabled, level national, area United States; expect baseline series.
19. **Baseline State** — metro Austin, baseline enabled, level state, area Texas; expect baseline series.

### Search (3)

20. **Search "Austin" (metro)** — geoLevel metro, search "Austin"; expect results with Austin-Round Rock-Georgetown; select and load chart.
21. **Search "Cook" (county)** — geoLevel county, search "Cook"; expect results like Cook, IL; `value` = FIPS.
22. **Search no results** — geoLevel metro, search "xyznonexistent123"; expect empty list, no crash.

### Edge cases (5)

23. **Geography with no data** — e.g. very small county or unsupported metric/geo; expect empty or error, and no uncaught exception.
24. **Rapid filter changes** — switch metric then time then geo quickly; expect no race-condition crashes and final state correct.
25. **Mobile viewport** — simulate width &lt; 768; chart still renders, no horizontal overflow.
26. **Empty primary selection** — e.g. metro chosen but no area selected yet; guard against requesting with empty regionId if possible.
27. **Baseline invalid area** — baseline enabled but area not in baselineOptions; ensure UI or API doesn’t break (current code resets to first option when baselineOptions change).

---

## Auto-Fix Capabilities

Apply these when the corresponding failure is detected.

### Fix 1: Empty graph – add empty state in ChartSection

**File:** `packages/frontend/app/graphs/components/ChartSection.tsx`

**Problem:** When `chartData.length === 0`, the chart area is blank with no message.

**Change:** Before rendering the Recharts container, branch on empty data and render a clear empty state.

```tsx
// Add near top of chart container, before <ResponsiveContainer>:
if (!chartData || chartData.length === 0) {
  return (
    <div className="flex flex-col items-center justify-center h-[400px] md:h-[550px] text-center px-4">
      <p className="text-on-surface-variant font-medium">No data available for this selection.</p>
      <p className="text-sm text-on-surface-variant mt-1">Try a different location, metric, or time range.</p>
    </div>
  );
}
```

(Exact placement and class names should match the rest of `ChartSection` and M3.)

### Fix 2: Search result format / value for API

**File:** `packages/frontend/app/graphs/hooks/useGraphSearch.ts`

**Problem:** Search returns items whose `value` or `id` doesn’t match what the timeseries API expects (e.g. metro needs regionId, state abbrev).

**Change:** Ensure every branch that builds `SearchResult` sets:
- `value` = the identifier sent to the API (regionId for metro, FIPS for county, state abbrev for state, zip code, city id).
- `id` = stable string (e.g. `metro-${regionId}`, `county-${fips}`).
- `name` = display label.

`handleSelectResult` in FilterHeader already does `setSelectedAreaId(result.value ?? result.name)`; the fix is in the search hook so `result.value` is always the API-facing id.

### Fix 3: useChartData – handle empty/error and avoid passing bad data to chart

**File:** `packages/frontend/app/graphs/hooks/useChartData.ts`

**Problem:** Request fails or returns empty; chart still gets `[]` but UI doesn’t explain why.

**Change:** Keep returning `{ data, loading, error }`. In `Dashboard` or `ChartSection`, when `error` is set, show a small inline error message (e.g. “Could not load data for this selection.”). Optionally, when `!loading && !error && data.length === 0`, show the same empty-state message as in Fix 1 so behavior is consistent.

### Fix 4: Baseline regionId extraction

**File:** `packages/frontend/app/graphs/hooks/useChartData.ts` — `extractRegionId(baseline.area, baseline.level)`

**Problem:** National/state baseline sends a display name the backend doesn’t recognize.

**Change:** For `level === 'national'`, map "United States" (and common variants) to the id your backend expects. For state, use full name or 2-letter abbrev consistently; backend `normalizeStateRegionId` already supports both. Ensure `baseline.area` passed into `extractRegionId` matches the option values from `baselineOptions` (e.g. "United States" for national, state name or abbrev for state).

### Fix 5: Chart props / console errors from Recharts

**File:** `packages/frontend/app/graphs/components/ChartSection.tsx`

**Problem:** Recharts warns or errors due to missing/incorrect props (e.g. `dataKey`, `margin`, container size).

**Change:** Ensure every chart usage has:
- `data={chartData}` (or filtered copy).
- `margin={chartMargin}` (already defined).
- All `Area`/`Line`/`Bar` use valid `dataKey` from the same data (e.g. `selectedAreaId`, `comparison.area`, baseline key).
- `ResponsiveContainer` has `width="100%"` and `height="100%"` and is inside a div with defined height.

If you introduce an EmptyState, keep it outside the ResponsiveContainer so Recharts is only mounted when `chartData.length > 0`.

---

## Execution Workflow (Iterative)

### Batch-fix loop: Run → Collect failures → Batch of 20 → Fix → Commit & push → Force restart → Wait 5 min → Verify → Repeat

1. **Run tests** (script: `npx tsx scripts/graph-test/run-tests.ts`, or expanded suite).
   - Hit timeseries API and search APIs (`/markets/metros`, `/markets/counties`, `/markets/zips`, `/markets/cities`) for combinations.
   - Output: `✓ name (duration, points)` or `✗ name — reason`.

2. **Collect & classify failures** — For each failure: type (`no_data` | `wrong_format` | `render_error` | `timeout` | `console_error` | `search_empty` | `search_wrong_value`), root cause, affected file(s), and which Fix (1–5) applies.

3. **Group in batches of 20** — Take up to 20 fixes per batch (cluster by file/cause as needed). Do not exceed 20 per batch.
4. **Apply the batch** — Make all fixes for that batch. Do not fix one failure, push, then the next.

5. **Commit and push** — Commit all changes for the batch and push to trigger Vercel (frontend) and Railway (backend) deploys.

6. **Force restart** — Add a trivial change so both platforms rebuild: frontend (`packages/frontend/`, e.g. `app/graphs/page.tsx` or `package.json`), backend (`packages/backend/`, e.g. `src/main.ts` or `package.json`). Include in the same commit and push.

7. **Wait ~5 minutes** — Rebuilds take about 5 minutes. Wait before re-running the test suite.

8. **Verify** — Re-run the suite. If failures remain, collect → next batch of up to 20 → fix → commit & push (with trivial frontend/backend bumps) → wait ~5 min → repeat.

9. **Report** when done — total/passed/failed, fixes applied (file + one-line), remaining issues, performance.

---

## Success Criteria

A passing run should satisfy:

- ≥95% of runnable tests passing (excluding known “no data in DB” cases).
- All priority geographies used in the suite (e.g. Florida, Texas, Austin metro) load when data exists.
- Search returns `SearchResult` with correct `value` for metro/county/state/zip/city.
- Comparison and baseline flows add the expected series and show in legend.
- Page load to chart render &lt; 2s when backend and network are normal.
- Zero console errors on default and test flows.
- Chart usable on mobile width (no overflow, readable).

---

## Monitoring & Maintenance

- Add `scripts/graph-test/run-tests.ts` (or equivalent) and run it in CI or on a schedule.
- Alert if pass rate drops below 90% or new console errors appear on /graphs.
- When adding metrics or geos, add matching test cases and keep GRAPH_PAGE_ANALYSIS.md and this skill in sync.
- **If the skill is not getting the results it needs:** Update this skill file (e.g. test list, workflow, or fixes) and re-run; the skill is allowed to modify itself to improve outcomes.

---

## Usage

When the user says **“test graphs page”** (or equivalent):

1. **Run** the test suite (e.g. `npx tsx scripts/graph-test/run-tests.ts`). Use `GRAPH_TEST_API_URL` for Railway when frontend is on Vercel.
2. **Collect** all failures; **group in batches of 20** (by affected file and fix type). Do not exceed 20 fixes per batch.
3. **Apply the batch** — Make all fixes, then **commit and push**.
4. **Force restart** — Add a trivial change to **frontend** (`packages/frontend/`) and **backend** (`packages/backend/`) so Vercel and Railway rebuild; include in the same commit and push.
5. **Wait ~5 minutes** — Rebuilds take about 5 minutes. Wait, then re-run the test suite.
6. **Repeat** (collect → batch of 20 → fix → commit & push → trivial frontend/backend bump → wait ~5 min → re-run) until the suite passes or remaining failures are documented.
7. **Report** at the end: total/passed/failed, fixes applied, remaining issues, performance.

The skill uses **batches of 20 fixes**, then **commit & push**, **trivial frontend+backend changes to force restart**, and **wait ~5 minutes** before continuing. If results are unsatisfactory, **the skill may update this file** (`.cursor/skills/graph-page-tester.md`) and continue with the revised instructions.
