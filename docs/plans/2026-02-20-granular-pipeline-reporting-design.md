# Granular Pipeline Reporting Design

**Date:** 2026-02-20
**Status:** Approved
**Goal:** Make data pipeline runs report per-metric detail instead of source-level summaries only.

## Problem

The Pipeline Runs tab on `/admin/data` currently reports at the source level: "Zillow: success, 15,000 records." Zillow alone has ~20 different metrics (ZHVI, ZORI, ZORDI, inventory, price cuts, etc.) across multiple geographies. When something fails or data goes stale, there's no way to see which specific metric is affected without manually querying the database.

## Design

### Approach: Summary rows with click-to-expand drill-down

Pipeline runs keep their current summary row (pipeline name, status, total records, duration). Clicking a row expands it to reveal per-metric detail rows showing exactly what happened for each metric x geography combination.

Per-metric data is logged by import scripts to a new `data_ingestion_details` table at import time (not computed on-the-fly).

### Data Model

New table: `data_ingestion_details`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid (PK) | Primary key |
| `run_id` | uuid (FK) | References `data_ingestion_log.id` |
| `metric_name` | text | e.g. `zhvi`, `zori`, `inventory` |
| `geography` | text | `state`, `metro`, `county`, `zip` |
| `status` | text | `success`, `failed`, `skipped` |
| `records_inserted` | int | New rows written this run |
| `records_failed` | int | Rows that errored |
| `records_delta` | int | Net change vs previous run for same metric+geo |
| `periods_added` | text[] | New date periods ingested (e.g. `["2025-12"]`) |
| `latest_data_date` | date | Most recent `period_date` after this run |
| `freshness_days` | int | Days between `latest_data_date` and run time |
| `coverage_pct` | numeric | % of expected regions with data |
| `coverage_delta` | numeric | Change in coverage vs previous run |
| `duration_ms` | int | Time for this metric's import |
| `error_message` | text | Error details if failed |
| `created_at` | timestamptz | When logged (default: now()) |

### Import Script Changes

The import scripts (`import-all-zillow-datasets.ts`, `ingest-all-zillow-clean.ts`) will:

1. Create a parent `data_ingestion_log` row at run start (already happens).
2. For each metric x geography combo processed, insert a `data_ingestion_details` row with counts, timing, and status.
3. After each metric completes, query the target table to compute `latest_data_date` and `coverage_pct`.
4. Compute `records_delta` and `coverage_delta` by comparing to the most recent previous detail row for the same metric + geography.

### Backend Endpoint

`GET /api/health/pipeline-runs/:runId/details`

Returns the per-metric breakdown for a specific pipeline run:

```typescript
{
  runId: string;
  pipelineName: string;
  details: {
    metricName: string;
    geography: string;
    status: 'success' | 'failed' | 'skipped';
    recordsInserted: number;
    recordsFailed: number;
    recordsDelta: number;
    periodsAdded: string[];
    latestDataDate: string | null;
    freshnessDays: number;
    coveragePct: number;
    coverageDelta: number;
    durationMs: number;
    errorMessage: string | null;
  }[];
  summary: {
    totalMetrics: number;
    succeeded: number;
    failed: number;
    skipped: number;
  };
}
```

### Frontend Changes (Pipeline Runs Tab)

**Summary row** (unchanged layout):
- Pipeline name, started time, duration, total records, status badge

**Expanded detail table** (new, shown on click):

| Column | Content | Visual Treatment |
|--------|---------|-----------------|
| Metric | Display name (e.g. "ZHVI (Home Value)") | Bold text |
| Geography | Badge: `state`, `metro`, `county`, `zip` | Colored chip |
| Status | success/failed/skipped | Green/red/gray badge |
| Records | Count with +/- delta | `881 (+3)` or `0` |
| Latest Date | Formatted date | `Dec 2025` |
| Freshness | Days since latest data | Green <=36d, amber <=60d, red >60d |
| Coverage | % with delta arrow | `98.2% (+0.1)` |

**Sorting:** Failed rows at top, then by metric name.
**Error display:** Failed rows show error message in a collapsible sub-row.

### Freshness Thresholds

| Data Frequency | Fresh | Aging | Stale |
|---------------|-------|-------|-------|
| Monthly | <=36 days | 37-60 days | >60 days |
| Annual | <=400 days | 401-450 days | >450 days |

### Files Affected

**Database:**
- New migration: `create_data_ingestion_details_table`

**Backend:**
- `packages/backend/src/health/health.controller.ts` — new endpoint
- `packages/backend/src/health/health.service.ts` — query logic

**Import scripts:**
- `scripts/import-all-zillow-datasets.ts` — add per-metric logging
- `scripts/ingest-all-zillow-clean.ts` — add per-metric logging

**Frontend:**
- `packages/frontend/app/admin/data/page.tsx` — expand/collapse UI in Pipeline Runs tab
- New component: `PipelineRunDetails.tsx` — the detail table
