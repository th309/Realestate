# Unified Data Pipeline Design

**Date:** 2026-02-20
**Status:** Approved
**Scope:** Script consolidation, twice-monthly automation, monitoring fix

---

## Problem Statement

The current data ingestion pipeline has three problems:

1. **Massive duplication:** 50+ import scripts share identical boilerplate (Supabase client creation duplicated 7 times + 168 inline copies, batch upsert duplicated 56 times, parse helpers duplicated 7 times). 34 files exceed the 300-line hard limit.
2. **Schedule rigidity:** Sources run on fixed calendar days (15th, 18th, 20th, 22nd, 25th) once per month. If a run fails or a source publishes on a different day, data goes stale until next month.
3. **Broken observability:** The admin/data monitoring page exists but pipeline runs don't report status to it, so there's no way to tell if data is genuinely stale or if an import silently failed.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Schedule | 1st and 15th of each month | Simple, predictable. 15th catches most monthly releases, 1st catches late-month publications. |
| Dedup strategy | Always re-import, rely on upserts | Existing upsert keys (region_id, metric_name, period_date) prevent duplicates. Simpler than checking freshness. |
| Recalculations | After every cycle | Calculated metrics + PIQ scores run after both the 1st and 15th. End-of-month value is what matters. |
| Orchestration | Hybrid | GitHub Actions for scheduling, backend for observability, admin UI for manual triggers. |
| Refactor scope | Full unified framework | Extract all duplicated logic into `scripts/lib/`, convert each source to thin config + adapter. |
| Old scripts | Delete after live verification | Once a source is migrated and verified end-to-end with live data, old scripts are removed. |
| Monitoring | Fix as part of this effort | Pipeline reports status to backend; admin/data page reflects real pipeline state. |

---

## Architecture

### Shared Import Framework (`scripts/lib/`)

All duplicated logic extracted into 6 shared modules:

```
scripts/lib/
  db-client.ts              # Single Supabase client factory (replaces 7 copies + 168 inline)
  batch-upsert.ts           # Upsert with exponential backoff retry + progress logging (replaces 56 copies)
  parse-helpers.ts          # parseNumeric, parseInteger, parseDate, normalizeZipCode, normalizeFipsCode
  csv-loader.ts             # Load CSV/TSV/XLSX from URL or local file path
  import-runner.ts          # Orchestrator: init DB → start logger → download → parse → upsert → report status → summary
  types.ts                  # ImportSourceConfig, ImportResult, GeographyConfig, etc.
```

**`import-runner.ts` contract:**

```typescript
interface ImportSourceConfig {
  id: string;                                  // 'realtor-metro'
  source: string;                              // 'realtor'
  tableName: string;                           // 'realtor_metro'
  conflictKeys: string[];                      // ['period_date', 'cbsa_code']
  fileFormat: 'csv' | 'tsv' | 'xlsx';
  downloadUrl?: string | (() => Promise<string>);
  localPath?: string | (() => string);
  columnMap: (row: Record<string, string>) => Record<string, unknown>;
  batchSize?: number;                          // default 500
  postImportHooks?: ('calculated_metrics' | 'scoring')[];
}

interface ImportResult {
  source: string;
  tableName: string;
  status: 'success' | 'failed' | 'partial';
  recordsProcessed: number;
  recordsInserted: number;
  recordsFailed: number;
  latestPeriodDate: string | null;
  durationSeconds: number;
  errors: string[];
}
```

The runner handles:
- Supabase client creation (via `db-client.ts`)
- Ingestion logger setup (using existing `scripts/utils/ingestion-logger.ts`)
- File download/loading (via `csv-loader.ts`)
- Row parsing via the source's `columnMap` function
- Batch upsert with retry (via `batch-upsert.ts`)
- POST status to backend monitoring API (`/api/pipelines/{sourceId}/status`)
- Summary output to console
- Post-import hook triggers (calculated metrics, scoring)

### Source Adapters (`scripts/sources/`)

Each source becomes a folder with a config file and entry point:

```
scripts/sources/
  zillow/
    zillow-config.ts              # Download URLs, column mappings per geography, metric definitions
    import-zillow.ts              # Entry point: imports all Zillow geographies (state, metro, county, zip)
  realtor/
    realtor-config.ts             # S3 URLs, column mappings per geography
    import-realtor.ts             # Entry point: imports all Realtor geographies
  census-economic/
    census-config.ts              # Census ACS API endpoints, variable mappings
    economic-config.ts            # BLS/FRED/BEA API endpoints, series mappings
    import-census-economic.ts     # Entry point: downloads from APIs, imports both census + economic
  building-permits/
    permits-config.ts             # Census Bureau BPS config, column mappings
    import-permits.ts             # Entry point
  hud-fmr/
    hud-fmr-config.ts             # HUD API config, bedroom count mappings
    import-hud-fmr.ts             # Entry point
  redfin/
    redfin-config.ts              # S3 bucket config, TSV column mappings
    import-redfin.ts              # Entry point
```

**What varies per source (the adapter's job):**
- Download URL or API endpoint
- File format (CSV, TSV, XLSX)
- Column name mapping (raw → DB schema)
- Region ID extraction and normalization
- Conflict keys for upsert

**What the framework handles (identical for all sources):**
- Supabase client creation
- Ingestion logging
- File download and parsing
- Batch upsert with retry
- Progress reporting
- Status reporting to monitoring API
- Error handling and summary output

### Calculation Pipeline Split

The oversized calculation files get split into focused modules:

```
scripts/calculations/
  calculated-metrics-runner.ts        # Orchestrator: runs all calculation types (~100 lines)
  investment-metrics.ts               # cap_rate, gross_yield, rent_to_price, grm (~150 lines)
  valuation-metrics.ts                # overvalued_pct, 5yr_growth (~150 lines)
  affordability-metrics.ts            # income_to_buy, affordable_home_price, years_to_save (~150 lines)
  metric-calculation-helpers.ts       # Shared math: data bounds, null checks, batch logic (~100 lines)
```

This replaces:
- `populate-calculated-metrics.ts` (885 lines)
- `utils/refresh-calculated-metrics.ts` (1151 lines)

The scoring pipeline (`calculate-all-scores.ts`, 648 lines) is already backed by the modular `packages/backend/src/scoring/` engine. It gets trimmed to a thin runner that calls the backend scoring service, bringing it under 300 lines.

---

## Scheduling

### Unified GitHub Actions Workflow

Replace the 5 separate workflow files with 1:

```yaml
# .github/workflows/data-pipeline-cycle.yml
name: Data Pipeline Cycle

on:
  schedule:
    - cron: '0 6 1 * *'      # 1st of every month at 6 AM UTC
    - cron: '0 6 15 * *'     # 15th of every month at 6 AM UTC
  workflow_dispatch:
    inputs:
      sources:
        description: 'Comma-separated sources to run, or "all"'
        default: 'all'
        type: string

jobs:
  import-sources:
    strategy:
      matrix:
        source: [zillow, realtor, census-economic, building-permits, hud-fmr, redfin]
      fail-fast: false            # Don't stop other sources if one fails
    steps:
      - npx tsx scripts/sources/${{ matrix.source }}/import-*.ts
      # Status POST to backend happens inside import-runner.ts automatically

  calculated-metrics:
    needs: import-sources
    if: always()                  # Run even if some sources failed
    steps:
      - npx tsx scripts/calculations/calculated-metrics-runner.ts

  scoring:
    needs: calculated-metrics
    steps:
      - npx tsx scripts/calculate-all-scores.ts
```

**Workflows deleted after migration:**
- `zillow-monthly-import.yml`
- `realtor-monthly-import.yml`
- `economic-monthly-import.yml`
- `building-permits-monthly-import.yml`
- `post-import-refresh.yml`

**Workflow retained (separate concern):**
- `automated-backtest.yml` (monthly on 1st — validates scoring model)

---

## Monitoring Fix

### Part A: Pipeline Status Reporting

Built into `import-runner.ts` — every import automatically POSTs its result to the backend:

```
POST /api/pipelines/{sourceId}/status
Authorization: Bearer {PIPELINE_API_KEY}
Body: {
  status: 'success' | 'failed' | 'partial',
  recordsProcessed: number,
  recordsInserted: number,
  recordsFailed: number,
  latestPeriodDate: string,
  durationSeconds: number,
  errors: string[]
}
```

This writes to the pipeline runs table that the admin/data page already reads from.

### Part B: Manual Trigger from Admin Page

The admin/data page already has trigger buttons. The backend endpoint dispatches a GitHub Actions workflow run:

```
POST /api/pipelines/{source}/trigger
→ GitHub API: POST /repos/{owner}/{repo}/actions/workflows/data-pipeline-cycle.yml/dispatches
  body: { ref: 'main', inputs: { sources: '{source}' } }
```

### Part C: Data Freshness

The monitoring page's Data Cards tab already queries the DB for latest `period_date` per metric. Once the pipeline is actually running and reporting, this will be accurate. The fix is upstream (pipeline works + reports), not in the page itself.

---

## Verification Protocol

For each source migration, **all 8 checks must pass** before deleting old scripts:

| # | Check | Method |
|---|-------|--------|
| 1 | **Download** | New adapter successfully downloads/loads data from the source |
| 2 | **Parse** | Row count matches old script output (within 1%) |
| 3 | **Ingest** | Records upserted into correct table with correct column values |
| 4 | **Freshness** | `period_date` in DB matches latest available data from source |
| 5 | **Calculated metrics** | Derived metrics (cap_rate, overvalued_pct, etc.) recalculate correctly |
| 6 | **PIQ scores** | Scores update and fall within expected range |
| 7 | **Monitoring** | Pipeline run appears on admin/data page with correct status |
| 8 | **Idempotency** | Running the same import twice produces no errors and no duplicates |

---

## Execution Phases

| Phase | Description | Depends On |
|-------|-------------|------------|
| **0** | Build shared framework (`scripts/lib/` — 6 files) | Nothing |
| **1** | Migrate Realtor source (simplest, good test case) + verify | Phase 0 |
| **2** | Migrate Zillow source (largest, most complex) + verify | Phase 0 |
| **3** | Migrate Census/Economic source + verify | Phase 0 |
| **4** | Migrate Building Permits source + verify | Phase 0 |
| **5** | Migrate HUD FMR source + verify | Phase 0 |
| **6** | Migrate Redfin source + verify | Phase 0 |
| **7** | Split oversized calculation files into `scripts/calculations/` | Phases 1-6 |
| **8** | Unified GitHub Actions workflow (replace 5 files with 1) | Phase 7 |
| **9** | Fix monitoring: status reporting + manual triggers | Phase 8 |

Phases 1-6 can be built in parallel (one agent per source), but verified sequentially (one at a time against live data).

---

## Impact

| Metric | Before | After |
|--------|--------|-------|
| Import-related code | ~15,000 lines across 50+ files | ~1,500 lines across ~20 files |
| Files over 300-line limit | 34 | 0 |
| Duplicate `db-client.ts` files | 7 | 1 |
| Duplicate upsert implementations | 56 | 1 |
| GitHub Actions workflow files | 5 | 1 |
| Import schedule | Once monthly (15th-25th) | Twice monthly (1st and 15th) |
| Pipeline observability | Broken | Working (auto-reports to admin/data) |
| Manual trigger | GitHub Actions UI only | Admin/data page buttons |
| Code reduction | — | ~90% |
