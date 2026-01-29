---
name: Graph Page Testing
description: A comprehensive skill to test, analyze, and fix the PropertyIQ graphs page.
---

# Graph Page Testing Skill

This skill provides tools and workflows to ensure the PropertyIQ graphs page (`/graphs`) is functioning correctly, aligned with the map data sources, and presenting accurate data.

## Capabilities

1.  **Alignment Verification**: Checks if the graphs page uses the same metric definitions and order as the map sidebar.
2.  **Data Fetching Validation**: Tests the backend API endpoints for time-series data to ensure availability and correct format.
3.  **Component Analysis**: Reviews React components for correct state management and rendering logic.

## Resources

- **Test Script**: `scripts/run-tests.ts` - Runs a suite of API tests against the local backend.
- **Reference Configs**:
    - `packages/frontend/app/map/config/metrics.ts`
    - `packages/frontend/app/map/config/metric-categories.tsx`

## Usage

### 1. Run Data Tests

To verify that the backend is serving the correct time-series data for the graph metrics:

```bash
npx tsx .agent/skills/graph_page_testing/scripts/run-tests.ts
```

### 2. Verify Metric Alignment

The graphs page should use the centralized metric configuration. check:
- `packages/frontend/app/graphs/constants.ts` should import from `app/map/config/...`
- `packages/frontend/app/graphs/hooks/useDashboardState.ts` should use `useAllMetricOptions`

## Troubleshooting

- **"No data returned (empty array)"**: This typically means the local database does not have data for the requested region/metric. Ensure data ingestion has been run.
- **"HTTP 404/500"**: Check the backend logs. Mismatch in `timeseries.service.ts` mapping or missing table.

## Maintenance

 When adding new metrics to `metric-categories.tsx`, they automatically propagate to the graphs page. No manual update to `graphs/constants.ts` is required as it now dynamically imports the ordered list.
