# Granular Pipeline Reporting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add per-metric drill-down to pipeline runs so each Zillow import shows exactly which metrics succeeded/failed with freshness and coverage data.

**Architecture:** New `data_ingestion_details` Supabase table stores per-metric rows linked to parent runs. Import scripts write detail rows during execution. New backend endpoint serves them. Frontend adds expand/collapse to the existing Pipeline Runs tab.

**Tech Stack:** Supabase (migration), NestJS (endpoint), Next.js/React (UI), existing import scripts (TypeScript/Node)

---

### Task 1: Create `data_ingestion_details` table migration

**Files:**
- Create: Supabase migration via `apply_migration`

**Step 1: Apply the migration**

```sql
CREATE TABLE IF NOT EXISTS data_ingestion_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  metric_name text NOT NULL,
  geography text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  records_inserted int DEFAULT 0,
  records_failed int DEFAULT 0,
  records_delta int DEFAULT 0,
  periods_added text[] DEFAULT '{}',
  latest_data_date date,
  freshness_days int,
  coverage_pct numeric(5,2),
  coverage_delta numeric(5,2),
  duration_ms int,
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ingestion_details_run_id ON data_ingestion_details(run_id);
CREATE INDEX idx_ingestion_details_metric_geo ON data_ingestion_details(metric_name, geography);
```

**Step 2: Verify migration applied**

Query: `SELECT column_name FROM information_schema.columns WHERE table_name = 'data_ingestion_details' ORDER BY ordinal_position;`

Expected: All 16 columns listed.

**Step 3: Commit**

```
feat(db): create data_ingestion_details table for per-metric pipeline reporting
```

---

### Task 2: Backend endpoint for pipeline run details

**Files:**
- Modify: `packages/backend/src/health/pipeline-runs.service.ts` — add `getRunDetails()` method
- Modify: `packages/backend/src/health/health.controller.ts` — add `GET /api/health/pipeline-runs/:runId/details` endpoint

**Step 1: Add the `RunDetail` interface and `getRunDetails` method to `pipeline-runs.service.ts`**

Add after the existing `PipelineRunsResponse` interface (~line 32):

```typescript
export interface RunDetail {
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
}

export interface RunDetailsResponse {
  runId: string;
  pipelineName: string;
  details: RunDetail[];
  summary: {
    totalMetrics: number;
    succeeded: number;
    failed: number;
    skipped: number;
  };
}
```

Add method to the service class:

```typescript
async getRunDetails(runId: string): Promise<RunDetailsResponse> {
  const client = this.supabaseService.getClient();

  // Get parent run for pipeline name
  const { data: run } = await client
    .from('data_ingestion_log')
    .select('source')
    .eq('id', runId)
    .single();

  // Get detail rows
  const { data, error } = await client
    .from('data_ingestion_details')
    .select('*')
    .eq('run_id', runId)
    .order('status', { ascending: true })  // failed first
    .order('metric_name', { ascending: true })
    .order('geography', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch run details: ${error.message}`);
  }

  const details: RunDetail[] = (data || []).map((row) => ({
    metricName: row.metric_name,
    geography: row.geography,
    status: row.status,
    recordsInserted: row.records_inserted || 0,
    recordsFailed: row.records_failed || 0,
    recordsDelta: row.records_delta || 0,
    periodsAdded: row.periods_added || [],
    latestDataDate: row.latest_data_date,
    freshnessDays: row.freshness_days || 0,
    coveragePct: parseFloat(row.coverage_pct) || 0,
    coverageDelta: parseFloat(row.coverage_delta) || 0,
    durationMs: row.duration_ms || 0,
    errorMessage: row.error_message,
  }));

  return {
    runId,
    pipelineName: run?.source || 'unknown',
    details,
    summary: {
      totalMetrics: details.length,
      succeeded: details.filter((d) => d.status === 'success').length,
      failed: details.filter((d) => d.status === 'failed').length,
      skipped: details.filter((d) => d.status === 'skipped').length,
    },
  };
}
```

**Step 2: Add the endpoint to `health.controller.ts`**

Add after the existing `getPipelineRuns` endpoint (~line 80):

```typescript
@Get('pipeline-runs/:runId/details')
async getPipelineRunDetails(@Param('runId') runId: string) {
  return this.pipelineRuns.getRunDetails(runId);
}
```

Add `Param` to the `@nestjs/common` import at the top of the file.

**Step 3: Build and verify endpoint resolves**

Run: `cd packages/backend && npx nest build`
Expected: No errors.

Test: `curl http://localhost:3001/api/health/pipeline-runs/nonexistent/details`
Expected: Empty details array (not a 500).

**Step 4: Commit**

```
feat(api): add pipeline-runs/:runId/details endpoint for per-metric breakdown
```

---

### Task 3: Add per-metric logging to `ingest-all-zillow-clean.ts`

This is the primary import script. It processes datasets and needs to write a `data_ingestion_details` row after each metric x geography completes.

**Files:**
- Modify: `scripts/ingest-all-zillow-clean.ts`

**Step 1: Add a helper function to log detail rows**

Add near the top of the file, after imports:

```typescript
async function logIngestionDetail(
  supabase: SupabaseClient,
  runId: string,
  metricName: string,
  geography: string,
  status: 'success' | 'failed' | 'skipped',
  recordsInserted: number,
  recordsFailed: number,
  durationMs: number,
  errorMessage?: string,
) {
  // Get freshness and coverage from the target table
  const tableName = `zillow_${geography}`;
  let latestDataDate: string | null = null;
  let freshnessDays = 0;
  let coveragePct = 0;
  let recordsDelta = 0;
  let coverageDelta = 0;
  let periodsAdded: string[] = [];

  if (status === 'success') {
    // Get latest date for this metric in this table
    const { data: latestRow } = await supabase
      .from(tableName)
      .select('period_date')
      .eq('metric_name', metricName)
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    if (latestRow) {
      latestDataDate = latestRow.period_date;
      freshnessDays = Math.floor(
        (Date.now() - new Date(latestRow.period_date).getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    // Get unique region count for coverage
    const { count: regionCount } = await supabase
      .from(tableName)
      .select('region_id', { count: 'exact', head: true })
      .eq('metric_name', metricName)
      .eq('period_date', latestDataDate || '');

    // Expected regions by geography
    const expectedRegions: Record<string, number> = {
      state: 51, metro: 900, county: 3200, city: 20000, zip: 28000,
    };
    coveragePct = expectedRegions[geography]
      ? Math.min(100, ((regionCount || 0) / expectedRegions[geography]) * 100)
      : 0;

    // Compare to previous run for deltas
    const { data: prevDetail } = await supabase
      .from('data_ingestion_details')
      .select('records_inserted, coverage_pct')
      .eq('metric_name', metricName)
      .eq('geography', geography)
      .eq('status', 'success')
      .neq('run_id', runId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (prevDetail) {
      recordsDelta = recordsInserted - (prevDetail.records_inserted || 0);
      coverageDelta = coveragePct - (parseFloat(prevDetail.coverage_pct) || 0);
    }
  }

  await supabase.from('data_ingestion_details').insert({
    run_id: runId,
    metric_name: metricName,
    geography,
    status,
    records_inserted: recordsInserted,
    records_failed: recordsFailed,
    records_delta: recordsDelta,
    periods_added: periodsAdded,
    latest_data_date: latestDataDate,
    freshness_days: freshnessDays,
    coverage_pct: coveragePct,
    coverage_delta: coverageDelta,
    duration_ms: durationMs,
    error_message: errorMessage || null,
  });
}
```

**Step 2: Create a parent `data_ingestion_log` row at the start of the main function**

In the main function, before the dataset loop begins, insert:

```typescript
const { data: logRow } = await supabase
  .from('data_ingestion_log')
  .insert({
    source: 'zillow',
    status: 'running',
    started_at: new Date().toISOString(),
  })
  .select('id')
  .single();

const runId = logRow?.id;
```

**Step 3: After each dataset completes (success or fail), call `logIngestionDetail`**

Inside `processDataset()`, after the import succeeds or catches an error, call:

```typescript
await logIngestionDetail(
  supabase,
  runId,
  datasetMetricName,  // e.g. 'zhvi', 'zori', 'inventory'
  datasetGeography,   // e.g. 'state', 'metro', 'county', 'zip'
  success ? 'success' : 'failed',
  recordsInserted,
  recordsFailed,
  durationMs,
  errorMessage,
);
```

**Step 4: At the end of the main function, update the parent log row**

```typescript
await supabase
  .from('data_ingestion_log')
  .update({
    status: allSucceeded ? 'success' : 'partial',
    completed_at: new Date().toISOString(),
    records_success: totalInserted,
    records_error: totalFailed,
    duration_ms: Date.now() - startTime,
  })
  .eq('id', runId);
```

**Step 5: Commit**

```
feat(scripts): add per-metric detail logging to Zillow import script
```

---

### Task 4: Add per-metric logging to `import-all-zillow-datasets.ts`

Same pattern as Task 3 but for the other import script.

**Files:**
- Modify: `scripts/import-all-zillow-datasets.ts`

**Step 1: Import and reuse the `logIngestionDetail` helper**

Extract `logIngestionDetail` from Task 3 into a shared utility file:

**Create:** `scripts/utils/log-ingestion-detail.ts`

Move the `logIngestionDetail` function there and export it. Import from both scripts.

**Step 2: Add parent log row creation and per-dataset detail logging**

Follow the same pattern as Task 3 Steps 2-4.

**Step 3: Commit**

```
feat(scripts): add per-metric detail logging to batch Zillow import script
```

---

### Task 5: Frontend — `PipelineRunDetails` component

**Files:**
- Create: `packages/frontend/app/admin/data/components/PipelineRunDetails.tsx`

**Step 1: Create the detail table component**

```typescript
'use client';

import { useState, useEffect } from 'react';

interface RunDetail {
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
}

interface RunDetailsResponse {
  runId: string;
  pipelineName: string;
  details: RunDetail[];
  summary: {
    totalMetrics: number;
    succeeded: number;
    failed: number;
    skipped: number;
  };
}

// Metric display names for human readability
const METRIC_DISPLAY_NAMES: Record<string, string> = {
  zhvi: 'ZHVI (Home Value)',
  zori: 'ZORI (Rent Index)',
  zordi: 'ZORDI (Rent Demand)',
  zhvf: 'ZHVF (Forecast)',
  inventory: 'For-Sale Inventory',
  new_listings: 'New Listings',
  pending_listings: 'Pending Listings',
  median_list_price: 'Median List Price',
  median_sale_price: 'Median Sale Price',
  sale_to_list: 'Sale-to-List Ratio',
  days_to_pending: 'Days to Pending',
  days_to_close: 'Days to Close',
  price_cuts: 'Price Cuts',
  market_heat: 'Market Heat Index',
  new_con_median_price: 'New Construction Price',
  new_con_price_per_sqft: 'New Construction $/SqFt',
  sales_count: 'Sales Count',
  dom: 'Days on Market',
};

const GEO_BADGE_COLORS: Record<string, string> = {
  state: 'bg-blue-100 text-blue-700',
  metro: 'bg-purple-100 text-purple-700',
  county: 'bg-amber-100 text-amber-700',
  city: 'bg-teal-100 text-teal-700',
  zip: 'bg-rose-100 text-rose-700',
};

function getFreshnessColor(days: number): string {
  if (days <= 36) return 'text-emerald-600';
  if (days <= 60) return 'text-amber-600';
  return 'text-rose-600';
}

function formatDelta(value: number): string {
  if (value === 0) return '';
  return value > 0 ? `+${value}` : `${value}`;
}

export function PipelineRunDetails({ runId }: { runId: string }) {
  const [data, setData] = useState<RunDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    fetch(`${apiUrl}/api/health/pipeline-runs/${runId}/details`)
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [runId]);

  if (loading) {
    return <div className="p-4 text-sm text-on-surface-variant animate-pulse">Loading details...</div>;
  }

  if (!data || data.details.length === 0) {
    return <div className="p-4 text-sm text-on-surface-variant">No per-metric details recorded for this run.</div>;
  }

  return (
    <div className="border-t border-outline-variant bg-surface-container-low/50">
      {/* Summary chips */}
      <div className="flex gap-3 px-4 py-2 text-xs">
        <span className="text-on-surface-variant">{data.summary.totalMetrics} metrics</span>
        {data.summary.succeeded > 0 && (
          <span className="text-emerald-600">{data.summary.succeeded} succeeded</span>
        )}
        {data.summary.failed > 0 && (
          <span className="text-rose-600">{data.summary.failed} failed</span>
        )}
        {data.summary.skipped > 0 && (
          <span className="text-on-surface-variant">{data.summary.skipped} skipped</span>
        )}
      </div>

      {/* Detail table */}
      <table className="w-full text-xs">
        <thead>
          <tr className="border-t border-outline-variant text-on-surface-variant">
            <th className="text-left px-4 py-1.5 font-medium">Metric</th>
            <th className="text-left px-2 py-1.5 font-medium">Geo</th>
            <th className="text-center px-2 py-1.5 font-medium">Status</th>
            <th className="text-right px-2 py-1.5 font-medium">Records</th>
            <th className="text-right px-2 py-1.5 font-medium">Latest</th>
            <th className="text-right px-2 py-1.5 font-medium">Fresh</th>
            <th className="text-right px-4 py-1.5 font-medium">Coverage</th>
          </tr>
        </thead>
        <tbody>
          {data.details.map((detail, i) => (
            <tr
              key={`${detail.metricName}-${detail.geography}`}
              className={`border-t border-outline-variant/50 ${
                detail.status === 'failed' ? 'bg-rose-50' : ''
              }`}
            >
              <td className="px-4 py-1.5 font-medium text-on-surface">
                {METRIC_DISPLAY_NAMES[detail.metricName] || detail.metricName}
              </td>
              <td className="px-2 py-1.5">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  GEO_BADGE_COLORS[detail.geography] || 'bg-gray-100 text-gray-700'
                }`}>
                  {detail.geography}
                </span>
              </td>
              <td className="px-2 py-1.5 text-center">
                {detail.status === 'success' && <span className="text-emerald-600">OK</span>}
                {detail.status === 'failed' && <span className="text-rose-600">FAIL</span>}
                {detail.status === 'skipped' && <span className="text-on-surface-variant">SKIP</span>}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {detail.recordsInserted.toLocaleString()}
                {detail.recordsDelta !== 0 && (
                  <span className={detail.recordsDelta > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {' '}{formatDelta(detail.recordsDelta)}
                  </span>
                )}
              </td>
              <td className="px-2 py-1.5 text-right">
                {detail.latestDataDate
                  ? new Date(detail.latestDataDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                  : '—'}
              </td>
              <td className={`px-2 py-1.5 text-right ${getFreshnessColor(detail.freshnessDays)}`}>
                {detail.latestDataDate ? `${detail.freshnessDays}d` : '—'}
              </td>
              <td className="px-4 py-1.5 text-right tabular-nums">
                {detail.coveragePct > 0 ? `${detail.coveragePct.toFixed(1)}%` : '—'}
                {detail.coverageDelta !== 0 && (
                  <span className={detail.coverageDelta > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {' '}{formatDelta(parseFloat(detail.coverageDelta.toFixed(1)))}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Step 2: Commit**

```
feat(admin): add PipelineRunDetails component for per-metric drill-down
```

---

### Task 6: Wire up expand/collapse in PipelineRunsTab

**Files:**
- Modify: `packages/frontend/app/admin/data/components/PipelineRunsTab.tsx`

**Step 1: Add expand state and toggle to each pipeline run row**

Add state at the top of the component:

```typescript
const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
```

Import PipelineRunDetails:

```typescript
import { PipelineRunDetails } from './PipelineRunDetails';
```

**Step 2: Make the existing `<tr>` rows clickable**

Wrap each `<tr>` to toggle expansion. Add a chevron icon in the first cell. After each `</tr>`, conditionally render the detail row:

```typescript
<tr
  key={run.id}
  onClick={() => setExpandedRunId(expandedRunId === run.id ? null : run.id)}
  className="cursor-pointer hover:bg-surface-container-low transition-colors"
>
  <td className="...">
    <span className={`inline-block transition-transform ${expandedRunId === run.id ? 'rotate-90' : ''}`}>
      ▶
    </span>
    {' '}{run.displayName}
  </td>
  {/* ... rest of existing cells unchanged */}
</tr>
{expandedRunId === run.id && (
  <tr>
    <td colSpan={5} className="p-0">
      <PipelineRunDetails runId={run.id} />
    </td>
  </tr>
)}
```

**Step 3: Verify in browser**

Navigate to `http://localhost:3000/admin/data`, Pipeline Runs tab. Click a run row. Should show "No per-metric details recorded for this run." (until imports are run with the updated scripts).

**Step 4: Commit**

```
feat(admin): wire up expand/collapse drill-down for pipeline run details
```

---

### Task 7: Build and verify end-to-end

**Step 1: Rebuild backend**

```bash
cd packages/backend && npx nest build
```

**Step 2: Verify frontend compiles**

```bash
cd packages/frontend && npx next build
```

Or verify in dev mode — no type errors on the admin data page.

**Step 3: Manual smoke test**

1. Open `/admin/data` Pipeline Runs tab
2. Click a run row — should expand with "No per-metric details" message
3. Run a Zillow import script — verify `data_ingestion_details` rows appear in Supabase
4. Refresh Pipeline Runs tab — click the new run, verify per-metric breakdown renders

**Step 4: Commit**

```
chore: verify end-to-end pipeline reporting flow
```
