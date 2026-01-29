# Graph Page Analysis & Data Binding Refactor

## Objective
Align the PropertyIQ graphs page (`/graphs`) with the map sidebar data sources and configuration to eliminate confusion and ensure data consistency.

## Findings

### 1. Hardcoded Configuration
The file `packages/frontend/app/graphs/constants.ts` contained a hardcoded list of `ORDERED_IDS` and duplicate definitions for `ALL_METRICS`. This caused the graphs page to potentially show metrics in a different order or include metrics not present in the main application configuration.

### 2. Metric Categories Divergence
The source of truth for metric ordering and categorization is `packages/frontend/app/map/config/metric-categories.tsx`. This file defines the `Homebuyer` and `Investor` detailed categories used in the map sidebar.

### 3. Data Service Alignment
The map page uses `useMetricData` which fetches current values. The graphs page uses `useChartData` which fetches time-series history via `timeSeriesApi`. Both ultimately rely on the same backend service (`timeseries.service.ts` logic for mapping). The alignment issue was primarily in the **list of available metrics** and their **definitions** (titles, sources), rather than the data fetching path itself (which is necessarily different for history vs snapshot).

## Actions Taken

### 1. Centralized Metric Ordering
Updated `packages/frontend/app/map/config/metric-categories.tsx` to export a new helper function `getAllOrderedMetricIds()`. This function dynamically generates a flat list of all metrics based on the centralized `MetricCategory` definitions.

### 2. Refactored Constants
Completely rewrote `packages/frontend/app/graphs/constants.ts`. It now:
- Imports `getAllOrderedMetricIds` from the central config.
- Imports `METRICS` and `getMetricTitle` from `app/map/config/metrics`.
- Dynamically builds the `ALL_METRICS` list using these sources.
- Dynamically determines "Premium" status by traversing the central categories.

### 3. Updated Hooks
Verified that `packages/frontend/app/graphs/hooks/useDashboardState.ts` uses `useAllMetricOptions`, which now also leverages `getAllOrderedMetricIds`. This ensures the dropdowns on the graphs page match the sidebar exactly.

### 4. Created Testing Skill
Established a reusable testing skill at `.agent/skills/graph_page_testing/`.
- **Instruction**: `SKILL.md` defines how to test the graph page.
- **Script**: `scripts/run-tests.ts` validates the API endpoints for the metrics to ensure data availability.

## Verification

Run the test script to verify data availability for the aligned metrics:
```bash
npx tsx .agent/skills/graph_page_testing/scripts/run-tests.ts
```

*Note: Current tests may fail with "No data returned" if the local database has not been fully populated via the ingestion pipeline.*
