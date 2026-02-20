# Unified Data Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate 50+ duplicated import scripts into a shared framework with thin source adapters, automate the pipeline to run twice monthly (1st and 15th), and fix the admin/data monitoring page.

**Architecture:** Shared import framework in `scripts/lib/` (db-client, batch-upsert, parse-helpers, csv-loader, import-runner) with per-source config+adapter in `scripts/sources/`. GitHub Actions hybrid orchestration with status reporting to NestJS backend. Each source verified with live data before old scripts are deleted.

**Tech Stack:** TypeScript, Supabase SDK, `csv-parse`, `axios`, NestJS, GitHub Actions, `@octokit/rest`

**Design Doc:** `docs/plans/2026-02-20-unified-data-pipeline-design.md`

---

## Task 0: Build Shared Import Framework (`scripts/lib/`)

This is the foundation. All source adapters depend on it.

**Files to create:**
- `scripts/lib/types.ts`
- `scripts/lib/db-client.ts`
- `scripts/lib/parse-helpers.ts`
- `scripts/lib/csv-loader.ts`
- `scripts/lib/batch-upsert.ts`
- `scripts/lib/import-runner.ts`

### Step 1: Create `scripts/lib/types.ts`

Shared types for the entire import framework.

```typescript
import { SupabaseClient } from '@supabase/supabase-js';

export type FileFormat = 'csv' | 'tsv' | 'xlsx';

export interface GeographyConfig {
  id: string;                    // 'realtor-metro'
  tableName: string;             // 'realtor_metro'
  conflictKeys: string[];        // ['period_date', 'cbsa_code']
  downloadUrl?: string | (() => Promise<string>);
  localPath?: string | (() => string);
  fileFormat?: FileFormat;       // defaults to parent source config
  columnMap: (row: Record<string, string>) => Record<string, unknown> | null;
  // Return null to skip a row (e.g., invalid data)
}

export interface ImportSourceConfig {
  source: string;                // 'realtor', 'zillow', etc. — matches ingestion-logger source
  fileFormat: FileFormat;        // default format for all geographies
  batchSize?: number;            // default 500
  geographies: GeographyConfig[];
  postImportHooks?: ('calculated_metrics' | 'scoring')[];
}

export interface ImportGeographyResult {
  geographyId: string;
  tableName: string;
  status: 'success' | 'failed' | 'partial';
  recordsProcessed: number;
  recordsInserted: number;
  recordsFailed: number;
  latestPeriodDate: string | null;
  durationMs: number;
  errors: string[];
}

export interface ImportSourceResult {
  source: string;
  status: 'success' | 'failed' | 'partial';
  geographies: ImportGeographyResult[];
  totalRecordsProcessed: number;
  totalRecordsInserted: number;
  totalRecordsFailed: number;
  totalDurationMs: number;
}

export interface BatchUpsertOptions {
  tableName: string;
  conflictKeys: string[];
  batchSize: number;
  supabase: SupabaseClient;
  onProgress?: (inserted: number, failed: number, total: number) => void;
}

export interface BatchUpsertResult {
  inserted: number;
  failed: number;
  errors: string[];
}
```

### Step 2: Create `scripts/lib/db-client.ts`

Single Supabase client factory replacing 7 copies + 168 inline instantiations.

```typescript
import { join } from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load from all possible locations (order matters — later overrides earlier)
config({ path: join(__dirname, '../../.env.local') });
config({ path: join(__dirname, '../../.env') });
config({ path: join(__dirname, '../../packages/frontend/.env.local') });
config({ path: join(__dirname, '../../packages/backend/.env') });

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  cachedClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' },
  });

  return cachedClient;
}

export function getBackendApiUrl(): string {
  return process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
}
```

### Step 3: Create `scripts/lib/parse-helpers.ts`

Consolidates `parseNumeric`, `parseInteger`, `parseDate`, region ID normalizers from 7+ files.

```typescript
/**
 * Parse a string value to a number, returning null for invalid/empty values.
 */
export function parseNumeric(value: string | undefined | null): number | null {
  if (value === undefined || value === null || value === '' || value === 'null' || value === 'NA') return null;
  const cleaned = String(value).replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Parse a string value to an integer, returning null for invalid/empty values.
 */
export function parseInteger(value: string | undefined | null): number | null {
  if (value === undefined || value === null || value === '' || value === 'null' || value === 'NA') return null;
  const cleaned = String(value).replace(/,/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

/**
 * Parse a YYYYMM string into a YYYY-MM-DD date string (first of month).
 */
export function parseYearMonth(yyyymm: string): string | null {
  if (!yyyymm || yyyymm.length < 6) return null;
  const year = yyyymm.substring(0, 4);
  const month = yyyymm.substring(4, 6);
  return `${year}-${month}-01`;
}

/**
 * Normalize a ZIP code to 5-digit string with leading zeros.
 */
export function normalizeZipCode(zip: string | number | undefined | null): string | null {
  if (zip === undefined || zip === null || zip === '') return null;
  return String(zip).padStart(5, '0');
}

/**
 * Normalize a FIPS code to the expected length (2 for state, 5 for county).
 */
export function normalizeFipsCode(fips: string | number | undefined | null, length: number = 5): string | null {
  if (fips === undefined || fips === null || fips === '') return null;
  return String(fips).padStart(length, '0');
}

/**
 * Parse a percentage string like "5.2%" to 5.2, or already numeric values.
 */
export function parsePercent(value: string | undefined | null): number | null {
  if (value === undefined || value === null || value === '' || value === 'null') return null;
  const cleaned = String(value).replace(/%/g, '').replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}
```

### Step 4: Create `scripts/lib/csv-loader.ts`

Unified file loader supporting CSV, TSV, XLSX from URLs or local paths.

```typescript
import axios from 'axios';
import { readFileSync, existsSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { join } from 'path';
import { FileFormat } from './types';

const DATA_DIR = join(__dirname, '../../data');

export interface LoadResult {
  rows: Record<string, string>[];
  rowCount: number;
  source: 'url' | 'file';
}

/**
 * Download content from a URL with timeout and size limits.
 */
export async function downloadFromUrl(url: string): Promise<string> {
  const response = await axios.get(url, {
    timeout: 120_000,
    maxContentLength: 500 * 1024 * 1024,
    responseType: 'text',
    headers: { 'User-Agent': 'PropertyIQ-DataPipeline/1.0' },
  });
  return response.data;
}

/**
 * Load and parse a data file from a URL or local path.
 */
export async function loadDataFile(options: {
  url?: string | (() => Promise<string>);
  localPath?: string | (() => string);
  format: FileFormat;
  delimiter?: string;
}): Promise<LoadResult> {
  const { format } = options;
  let content: string;
  let source: 'url' | 'file';

  // Resolve dynamic paths/urls
  const url = typeof options.url === 'function' ? await options.url() : options.url;
  const localPath = typeof options.localPath === 'function' ? options.localPath() : options.localPath;

  // Try local file first, then URL
  if (localPath) {
    const fullPath = localPath.startsWith('/') || localPath.includes(':')
      ? localPath
      : join(DATA_DIR, localPath);
    if (!existsSync(fullPath)) {
      throw new Error(`Local file not found: ${fullPath}`);
    }
    content = readFileSync(fullPath, 'utf-8');
    source = 'file';
  } else if (url) {
    content = await downloadFromUrl(url);
    source = 'url';
  } else {
    throw new Error('Either url or localPath must be provided');
  }

  if (format === 'xlsx') {
    // Dynamic import for xlsx to avoid requiring it in all scripts
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(content, { type: 'string' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
    return { rows, rowCount: rows.length, source };
  }

  const delimiter = options.delimiter || (format === 'tsv' ? '\t' : ',');
  const rows = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter,
    relax_column_count: true,
  }) as Record<string, string>[];

  return { rows, rowCount: rows.length, source };
}
```

### Step 5: Create `scripts/lib/batch-upsert.ts`

Batch upsert with exponential backoff retry (adopting Redfin's pattern). Replaces 56 inline copies.

```typescript
import { SupabaseClient } from '@supabase/supabase-js';
import { BatchUpsertOptions, BatchUpsertResult } from './types';

const MAX_RETRIES = 3;
const BATCH_PAUSE_MS = 200;

function isConnectionError(message: string): boolean {
  const patterns = ['fetch', 'network', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'socket'];
  return patterns.some((p) => message.toLowerCase().includes(p));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Upsert records in batches with retry logic and progress reporting.
 */
export async function batchUpsert(
  records: Record<string, unknown>[],
  options: BatchUpsertOptions
): Promise<BatchUpsertResult> {
  const { tableName, conflictKeys, batchSize, supabase, onProgress } = options;
  const conflictString = conflictKeys.join(',');
  let totalInserted = 0;
  let totalFailed = 0;
  const errors: string[] = [];
  const totalBatches = Math.ceil(records.length / batchSize);

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    let success = false;

    for (let retry = 0; retry < MAX_RETRIES; retry++) {
      const { error } = await supabase
        .from(tableName)
        .upsert(batch, { onConflict: conflictString, ignoreDuplicates: false });

      if (!error) {
        totalInserted += batch.length;
        success = true;
        break;
      }

      if (isConnectionError(error.message) && retry < MAX_RETRIES - 1) {
        const backoffMs = Math.pow(2, retry + 1) * 1000;
        console.warn(`  Batch ${batchNum}/${totalBatches}: connection error, retrying in ${backoffMs}ms...`);
        await sleep(backoffMs);
        continue;
      }

      // Non-retryable error or final retry
      totalFailed += batch.length;
      const errorMsg = `Batch ${batchNum}: ${error.message}`;
      errors.push(errorMsg);
      console.error(`  ${errorMsg}`);
      break;
    }

    // Progress reporting (every 10th batch + first + last)
    if (batchNum === 1 || batchNum === totalBatches || batchNum % 10 === 0) {
      console.log(`  Progress: ${batchNum}/${totalBatches} batches (${totalInserted} inserted, ${totalFailed} failed)`);
    }

    onProgress?.(totalInserted, totalFailed, records.length);

    // Brief pause between batches to avoid overwhelming the DB
    if (i + batchSize < records.length) {
      await sleep(BATCH_PAUSE_MS);
    }
  }

  return { inserted: totalInserted, failed: totalFailed, errors };
}
```

### Step 6: Create `scripts/lib/import-runner.ts`

The orchestrator. Each source adapter calls `runSourceImport(config)` and everything else is handled.

```typescript
import { getSupabaseClient, getBackendApiUrl } from './db-client';
import { loadDataFile } from './csv-loader';
import { batchUpsert } from './batch-upsert';
import { createIngestionLogger } from '../utils/ingestion-logger';
import {
  ImportSourceConfig,
  ImportSourceResult,
  ImportGeographyResult,
  GeographyConfig,
} from './types';

async function reportStatusToBackend(source: string, result: ImportGeographyResult): Promise<void> {
  const backendUrl = getBackendApiUrl();
  const pipelineApiKey = process.env.PIPELINE_API_KEY;
  if (!pipelineApiKey) {
    console.warn('  PIPELINE_API_KEY not set — skipping status report to backend');
    return;
  }

  try {
    await fetch(`${backendUrl}/api/health/pipeline-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pipelineApiKey}`,
      },
      body: JSON.stringify({
        source,
        geographyId: result.geographyId,
        tableName: result.tableName,
        status: result.status,
        recordsProcessed: result.recordsProcessed,
        recordsInserted: result.recordsInserted,
        recordsFailed: result.recordsFailed,
        latestPeriodDate: result.latestPeriodDate,
        durationMs: result.durationMs,
        errors: result.errors,
      }),
    });
  } catch (err) {
    console.warn(`  Failed to report status to backend: ${(err as Error).message}`);
  }
}

async function importGeography(
  geo: GeographyConfig,
  sourceConfig: ImportSourceConfig,
): Promise<ImportGeographyResult> {
  const supabase = getSupabaseClient();
  const startTime = Date.now();
  const logger = createIngestionLogger(supabase, {
    source: sourceConfig.source as any,
    tableName: geo.tableName,
    datasetId: geo.id,
  });

  try {
    console.log(`\n--- Importing ${geo.id} into ${geo.tableName} ---`);

    // Load data
    const { rows, rowCount, source: loadSource } = await loadDataFile({
      url: geo.downloadUrl,
      localPath: geo.localPath,
      format: geo.fileFormat || sourceConfig.fileFormat,
    });
    console.log(`  Loaded ${rowCount} rows from ${loadSource}`);

    // Map columns (filter out null returns = skipped rows)
    const mapped = rows
      .map(geo.columnMap)
      .filter((r): r is Record<string, unknown> => r !== null);
    console.log(`  Mapped ${mapped.length} valid records (${rowCount - mapped.length} skipped)`);

    if (mapped.length === 0) {
      await logger.start(0);
      await logger.complete({ recordsProcessed: 0, recordsSuccess: 0, recordsError: 0, errors: ['No valid records after column mapping'] });
      return {
        geographyId: geo.id,
        tableName: geo.tableName,
        status: 'failed',
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsFailed: 0,
        latestPeriodDate: null,
        durationMs: Date.now() - startTime,
        errors: ['No valid records after column mapping'],
      };
    }

    await logger.start(mapped.length);

    // Batch upsert
    const { inserted, failed, errors } = await batchUpsert(mapped, {
      tableName: geo.tableName,
      conflictKeys: geo.conflictKeys,
      batchSize: sourceConfig.batchSize || 500,
      supabase,
      onProgress: (ins, fail) => logger.updateProgress(ins, fail),
    });

    // Determine latest period_date from mapped records
    let latestPeriodDate: string | null = null;
    for (const record of mapped) {
      const pd = record.period_date as string;
      if (pd && (!latestPeriodDate || pd > latestPeriodDate)) {
        latestPeriodDate = pd;
      }
    }

    const status = failed === 0 ? 'success' : inserted === 0 ? 'failed' : 'partial';
    await logger.complete({
      recordsProcessed: mapped.length,
      recordsSuccess: inserted,
      recordsError: failed,
      errors,
    });

    const durationMs = Date.now() - startTime;
    console.log(`  Done: ${inserted} inserted, ${failed} failed in ${(durationMs / 1000).toFixed(1)}s`);

    return {
      geographyId: geo.id,
      tableName: geo.tableName,
      status,
      recordsProcessed: mapped.length,
      recordsInserted: inserted,
      recordsFailed: failed,
      latestPeriodDate,
      durationMs,
      errors,
    };
  } catch (error) {
    const msg = (error as Error).message;
    await logger.fail(msg);
    console.error(`  FAILED: ${msg}`);
    return {
      geographyId: geo.id,
      tableName: geo.tableName,
      status: 'failed',
      recordsProcessed: 0,
      recordsInserted: 0,
      recordsFailed: 0,
      latestPeriodDate: null,
      durationMs: Date.now() - startTime,
      errors: [msg],
    };
  }
}

/**
 * Run a full source import: iterate geographies, upsert, log, report.
 */
export async function runSourceImport(config: ImportSourceConfig): Promise<ImportSourceResult> {
  const overallStart = Date.now();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`DATA PIPELINE: ${config.source.toUpperCase()}`);
  console.log(`Geographies: ${config.geographies.map((g) => g.id).join(', ')}`);
  console.log(`${'='.repeat(60)}`);

  const results: ImportGeographyResult[] = [];

  for (const geo of config.geographies) {
    const result = await importGeography(geo, config);
    results.push(result);
    await reportStatusToBackend(config.source, result);
  }

  const totalProcessed = results.reduce((sum, r) => sum + r.recordsProcessed, 0);
  const totalInserted = results.reduce((sum, r) => sum + r.recordsInserted, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.recordsFailed, 0);
  const anyFailed = results.some((r) => r.status === 'failed');
  const allFailed = results.every((r) => r.status === 'failed');
  const overallStatus = allFailed ? 'failed' : anyFailed ? 'partial' : 'success';

  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`IMPORT SUMMARY: ${config.source.toUpperCase()}`);
  console.log(`Status: ${overallStatus.toUpperCase()}`);
  for (const r of results) {
    const icon = r.status === 'success' ? '[OK]' : r.status === 'partial' ? '[!!]' : '[FAIL]';
    console.log(`  ${icon} ${r.geographyId}: ${r.recordsInserted} inserted, ${r.recordsFailed} failed`);
  }
  console.log(`Total: ${totalInserted} inserted, ${totalFailed} failed`);
  console.log(`Duration: ${((Date.now() - overallStart) / 1000).toFixed(1)}s`);
  console.log(`${'='.repeat(60)}\n`);

  return {
    source: config.source,
    status: overallStatus,
    geographies: results,
    totalRecordsProcessed: totalProcessed,
    totalRecordsInserted: totalInserted,
    totalRecordsFailed: totalFailed,
    totalDurationMs: Date.now() - overallStart,
  };
}
```

### Step 7: Run the framework tests

Run: `npx tsx scripts/lib/db-client.ts` (should not crash — just initializes)

Verify: Import resolves and `getSupabaseClient()` returns a valid client.

### Step 8: Commit

```bash
git add scripts/lib/
git commit -m "feat: add shared import framework (db-client, batch-upsert, csv-loader, import-runner)"
```

---

## Task 1: Migrate Realtor Source

Realtor is the simplest source with the cleanest existing module. Best first test case.

**Files to create:**
- `scripts/sources/realtor/realtor-config.ts`
- `scripts/sources/realtor/import-realtor.ts`

**Files to read first (understand existing column mappings):**
- `scripts/realtor-import/csv-processor.ts` — column mappings per geography
- `scripts/realtor-import/types.ts` — `REALTOR_DATASETS` array with download URLs
- `scripts/import-realtor-metro.ts` — existing entry point pattern
- `scripts/import-realtor-national.ts`, `scripts/import-realtor-state.ts`, `scripts/import-realtor-county.ts`, `scripts/import-realtor-zip.ts`

### Step 1: Create `scripts/sources/realtor/realtor-config.ts`

Extract the download URLs from `scripts/realtor-import/types.ts` (`REALTOR_DATASETS` array) and column mappings from `scripts/realtor-import/csv-processor.ts` (the `parseNationalCSV`, `parseStateCoreCSV`, `parseMetroCoreCSV`, etc. functions).

The config file must:
- Define one `GeographyConfig` per level (national, state, metro, county, zip)
- Each `columnMap` function maps the raw CSV columns to the DB record format
- Use `parseNumeric`, `parseInteger` from `scripts/lib/parse-helpers.ts`
- Use the same download URLs from `REALTOR_DATASETS` in `scripts/realtor-import/types.ts`
- Handle both core and hotness data files (metro/county/zip have separate hotness CSVs that need to be merged)

**Note on Realtor hotness data:** Metro, county, and zip levels have two CSVs — core + hotness — that get merged. The adapter will need to load both and merge them before column mapping. This is the one piece of source-specific logic beyond basic column mapping. Handle this by having the geography's `columnMap` expect the already-merged record, and do the merge in the entry point before passing to the framework.

Target: Under 200 lines.

### Step 2: Create `scripts/sources/realtor/import-realtor.ts`

Entry point that:
1. Imports `runSourceImport` from `scripts/lib/import-runner`
2. Imports the config from `./realtor-config`
3. For geographies with hotness data (metro, county, zip): downloads both CSVs, merges them, then passes merged data through the framework
4. Calls `runSourceImport(realtorConfig)`
5. Handles CLI args (e.g., `--geography metro` to run a single level)

Target: Under 150 lines.

### Step 3: Run with live data

Run: `npx tsx scripts/sources/realtor/import-realtor.ts`

Verify all 8 checks from the verification protocol:
1. Downloads from Realtor S3 successfully (or loads from `data/realtor/` files)
2. Row counts match old script output (compare with a query: `SELECT COUNT(*) FROM realtor_metro`)
3. Spot-check 5 records in the DB for correct values
4. `SELECT MAX(period_date) FROM realtor_metro` matches latest available data
5. Run `npx tsx scripts/calculations/calculated-metrics-runner.ts` (or existing `populate-calculated-metrics.ts` until Task 7 is done)
6. Check PIQ scores didn't break: `SELECT * FROM propertyiq_scores WHERE geography_type = 'metro' LIMIT 5`
7. Check `data_ingestion_log` for the new run entry
8. Run the import again — should produce same results with no errors

### Step 4: Commit

```bash
git add scripts/sources/realtor/
git commit -m "feat: add Realtor source adapter using shared import framework"
```

### Step 5: Delete old Realtor scripts

Only after verification passes:
- `scripts/import-realtor-national.ts`
- `scripts/import-realtor-state.ts`
- `scripts/import-realtor-metro.ts`
- `scripts/import-realtor-county.ts`
- `scripts/import-realtor-zip.ts`
- `scripts/realtor-import/` (entire directory)

```bash
git add -u
git commit -m "refactor: remove legacy Realtor import scripts (replaced by scripts/sources/realtor/)"
```

---

## Task 2: Migrate Zillow Source

Zillow is the largest and most complex source — 4 separate import sub-systems, 14+ top-level scripts.

**Files to create:**
- `scripts/sources/zillow/zillow-config.ts`
- `scripts/sources/zillow/import-zillow.ts`

**Files to read first:**
- `scripts/zillow-all-import/csv-processor.ts` — the most recent/complete column mapping
- `scripts/zillow-all-import/types.ts` — dataset type definitions
- `scripts/download-zillow-data.ts` — download URLs and CSV file list
- `scripts/import-all-zillow-datasets.ts` — orchestration pattern
- `scripts/zillow-import/base-importer.ts` — alternative column mapping approach
- `scripts/zillow-us-metro-import/dataset-configs.ts` — dataset configurations

### Step 1: Create `scripts/sources/zillow/zillow-config.ts`

This is the most complex config because Zillow has many datasets per geography level:
- ZHVI (home values) — state, metro, county, zip
- ZORI (rent index) — state, metro, county, zip
- Inventory metrics — various levels
- Sale price, affordability, market heat index — various levels

**Key decisions:**
- Each dataset+geography combination can be a separate `GeographyConfig` entry, OR datasets for the same geography can be handled in a single `columnMap` that processes multiple CSV files
- Recommend: Group by geography. Each geography config loads all Zillow CSVs for that level and maps them all. This matches the existing `import-all-zillow-datasets.ts` pattern.

Extract download URLs from `scripts/download-zillow-data.ts`. These are static S3 URLs from `files.zillowstatic.com`.

Target: Under 250 lines (may need to split column mappings into a helper file `zillow-column-mappings.ts` if it exceeds the limit).

### Step 2: Create `scripts/sources/zillow/import-zillow.ts`

Entry point. Zillow's unique complexity:
- Multiple CSV files per geography level (ZHVI, ZORI, inventory, etc.)
- Each CSV has a different column structure (wide format with date columns vs. long format)
- Some CSVs need to be transposed from wide to long format

Handle this in the entry point by:
1. Downloading all CSVs for the geography
2. Parsing and transposing wide-format CSVs to long-format records
3. Passing the unified records through the framework

Target: Under 200 lines. If wide-to-long transposing logic is needed, extract to `zillow-csv-transformer.ts`.

### Step 3: Run with live data

Run: `npx tsx scripts/sources/zillow/import-zillow.ts`

Same 8-check verification as Task 1, but for all 4 geography levels. Pay special attention to:
- ZHVI values matching (most critical metric)
- ZORI values matching
- Market heat index values

### Step 4: Commit and delete old scripts

Delete after verification:
- `scripts/import-all-zillow-datasets.ts`
- `scripts/import-zillow-from-file.ts`
- `scripts/import-zillow-zhvf.ts`
- `scripts/import-zillow-zordi.ts`
- `scripts/import-zillow-state-zhvi.ts`
- `scripts/import-missing-zillow-datasets.ts`
- `scripts/import-zordi-sfr-mfr.ts`
- `scripts/import-zori-sfr-mfr.ts`
- `scripts/import-affordability-datasets.ts`
- `scripts/import-metro-datasets.ts`
- `scripts/ingest-all-zillow-clean.ts`
- `scripts/ingest-remaining-zillow.ts`
- `scripts/download-zillow-data.ts`
- `scripts/zillow-all-import/` (entire directory)
- `scripts/zillow-import/` (entire directory)
- `scripts/zillow-us-metro-import/` (entire directory)

**Keep:** `scripts/discover-zillow-datasets.ts` (utility, not part of the import pipeline)

---

## Task 3: Migrate Census/Economic Source

**Files to create:**
- `scripts/sources/census-economic/census-config.ts`
- `scripts/sources/census-economic/economic-config.ts`
- `scripts/sources/census-economic/import-census-economic.ts`

**Files to read first:**
- `scripts/census-economic-import/api-clients.ts` — API client for Census, BEA, FRED, BLS
- `scripts/census-economic-import/csv-processor.ts` — column mappings
- `scripts/census-economic-import/types.ts` — type definitions
- `scripts/import-census-data.ts` — Census entry point
- `scripts/import-economic-data.ts` — Economic entry point
- `scripts/importers/census-import/` — modular Census importer
- `scripts/importers/fred-import/` — modular FRED importer

### Step 1: Create configs and entry point

Census/Economic is unique because it fetches from **APIs** (Census Bureau, BEA, FRED, BLS) rather than downloading CSV files. The `csv-loader.ts` won't be used directly. Instead:
- The config's `downloadUrl` can be a function that calls the API and returns CSV-formatted content
- OR the entry point handles API fetching and passes records directly to `batchUpsert`

Recommend: Keep the API client logic (from `scripts/census-economic-import/api-clients.ts`) but consolidate it into the source adapter. The entry point calls the APIs, transforms responses, then uses `batchUpsert` directly.

**Important:** `api-clients.ts` is 1044 lines and must be split. Break it into:
- `scripts/sources/census-economic/census-api-client.ts` (~200 lines)
- `scripts/sources/census-economic/bea-api-client.ts` (~150 lines)
- `scripts/sources/census-economic/fred-api-client.ts` (~150 lines)
- `scripts/sources/census-economic/bls-api-client.ts` (~150 lines)

### Step 2: Run with live data, verify, commit, delete old scripts

Delete after verification:
- `scripts/download-census-economic-data.ts`
- `scripts/import-census-data.ts`
- `scripts/import-economic-data.ts`
- `scripts/combine-economic-data.ts`
- `scripts/census-economic-import/` (entire directory)
- `scripts/importers/census-import/` (entire directory)
- `scripts/importers/fred-import/` (entire directory)

---

## Task 4: Migrate Building Permits Source

**Files to create:**
- `scripts/sources/building-permits/permits-config.ts`
- `scripts/sources/building-permits/import-permits.ts`

**Files to read first:**
- `scripts/download-building-permits.ts` (460 lines — download + parse)
- `scripts/import-building-permits.ts` (402 lines — import + upsert)

### Step 1: Create config and entry point

Building Permits fetches from Census Bureau BPS API. Similar to Census/Economic — API-based, not CSV file download. The adapter needs to call the API, parse the response, and map to DB records.

Extract the API call + column mapping logic from the existing scripts. The download and import scripts together are ~860 lines. The adapter should be ~150 lines (config) + ~100 lines (entry point).

### Step 2: Run with live data, verify, commit, delete old scripts

Delete after verification:
- `scripts/download-building-permits.ts`
- `scripts/import-building-permits.ts`
- `scripts/backfill-permits-total-units.ts` (one-time backfill, no longer needed)

---

## Task 5: Migrate HUD FMR Source

**Files to create:**
- `scripts/sources/hud-fmr/hud-fmr-config.ts`
- `scripts/sources/hud-fmr/import-hud-fmr.ts`

**Files to read first:**
- `scripts/download-hud-fmr.ts` (135 lines)
- `scripts/import-hud-fmr.ts` (251 lines)

### Step 1: Create config and entry point

HUD FMR is the simplest source — annual data, single Excel file download, single table. This should be the shortest adapter (~80 lines total).

### Step 2: Run with live data, verify, commit, delete old scripts

Delete after verification:
- `scripts/download-hud-fmr.ts`
- `scripts/import-hud-fmr.ts`

---

## Task 6: Migrate Redfin Source

**Files to create:**
- `scripts/sources/redfin/redfin-config.ts`
- `scripts/sources/redfin/import-redfin.ts`

**Files to read first:**
- `scripts/redfin-import/parser.ts` — TSV parsing
- `scripts/redfin-import/data-transformer.ts` — column transformation
- `scripts/redfin-import/geoid-lookup.ts` — geography ID mapping
- `scripts/redfin-import/db-client.ts` — retry logic (already adopted into framework)
- `scripts/import-redfin-tsv-files.ts` — entry point
- `scripts/download-and-import-redfin-s3.ts` — alternative entry point

### Step 1: Create config and entry point

Redfin uses TSV files and has a unique GeoID lookup table for mapping Redfin region IDs to standard FIPS/CBSA codes. This lookup logic needs to be preserved in the adapter.

### Step 2: Run with live data, verify, commit, delete old scripts

Delete after verification:
- `scripts/import-redfin-tsv-files.ts`
- `scripts/download-and-import-redfin-s3.ts`
- `scripts/download-redfin-s3-files.ts`
- `scripts/redfin-import/` (entire directory)
- `scripts/redfin-rental-import/` (entire directory, if exists)

---

## Task 7: Split Oversized Calculation Files

**Files to create:**
- `scripts/calculations/calculated-metrics-runner.ts`
- `scripts/calculations/investment-metrics.ts`
- `scripts/calculations/valuation-metrics.ts`
- `scripts/calculations/affordability-metrics.ts`
- `scripts/calculations/metric-calculation-helpers.ts`

**Files to read first:**
- `scripts/populate-calculated-metrics.ts` (885 lines) — the main calculation script
- `scripts/utils/refresh-calculated-metrics.ts` (1151 lines) — post-import refresh

### Step 1: Analyze logical sections of `populate-calculated-metrics.ts`

Read the full file and identify the natural split points:
- Investment metric calculations (cap_rate, gross_yield, rent_to_price, grm)
- Valuation metric calculations (overvalued_pct, 5yr_growth)
- Affordability metric calculations (income_to_buy, affordable_home_price, years_to_save)
- Shared helpers (data bounds checking, batch execution, null handling)

### Step 2: Create the split files

Each file must be under 200 lines (target) / 300 lines (hard limit).

`calculated-metrics-runner.ts` is the new entry point:
```typescript
import { runInvestmentMetrics } from './investment-metrics';
import { runValuationMetrics } from './valuation-metrics';
import { runAffordabilityMetrics } from './affordability-metrics';
import { getSupabaseClient } from '../lib/db-client';

async function main() {
  const supabase = getSupabaseClient();
  console.log('Running calculated metrics...');

  await runInvestmentMetrics(supabase);
  await runValuationMetrics(supabase);
  await runAffordabilityMetrics(supabase);

  console.log('All calculated metrics complete.');
}

main().catch((err) => { console.error(err); process.exit(1); });
```

### Step 3: Run and verify

Run: `npx tsx scripts/calculations/calculated-metrics-runner.ts`

Verify: Calculated metrics in DB match what the old script produced. Spot-check:
- `SELECT * FROM calculated_metrics WHERE metric_name = 'cap_rate' LIMIT 5`
- `SELECT * FROM calculated_metrics WHERE metric_name = 'overvalued_pct' LIMIT 5`
- `SELECT * FROM calculated_metrics WHERE metric_name = 'income_to_buy' LIMIT 5`

### Step 4: Commit, delete old files

Delete after verification:
- `scripts/populate-calculated-metrics.ts`
- `scripts/utils/refresh-calculated-metrics.ts`

Update any references in other scripts or workflows to point to the new runner.

### Step 5: Trim `calculate-all-scores.ts`

Read `scripts/calculate-all-scores.ts` (648 lines). It should already delegate to `packages/backend/src/scoring/` for the actual math. Trim it to a thin runner (under 300 lines) by extracting any inline logic to the backend scoring module or to helper files.

---

## Task 8: Unified GitHub Actions Workflow

**Files to create:**
- `.github/workflows/data-pipeline-cycle.yml`

**Files to delete (after new workflow is verified):**
- `.github/workflows/zillow-monthly-import.yml`
- `.github/workflows/realtor-monthly-import.yml`
- `.github/workflows/economic-monthly-import.yml`
- `.github/workflows/permits-monthly-import.yml`
- `.github/workflows/post-import-refresh.yml`

**Files to keep:**
- `.github/workflows/automated-backtest.yml` (separate concern)
- `.github/workflows/hud-fmr-annual-import.yml` (HUD is included in cycle, but keep this as backup for annual-only runs)

### Step 1: Read existing workflows

Read all 5 existing workflow files to understand:
- Environment setup (Node version, env vars from GitHub Secrets)
- Timeout settings
- Failure notification patterns
- Artifact upload patterns

### Step 2: Create the unified workflow

```yaml
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

env:
  NODE_VERSION: '20'

jobs:
  import-sources:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    strategy:
      matrix:
        source: [zillow, realtor, census-economic, building-permits, hud-fmr, redfin]
      fail-fast: false
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      - run: npm ci --workspace=scripts  # or appropriate install command
      - name: Run import
        if: >
          github.event.inputs.sources == 'all' ||
          github.event.inputs.sources == '' ||
          contains(github.event.inputs.sources, matrix.source)
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          PIPELINE_API_KEY: ${{ secrets.PIPELINE_API_KEY }}
          BACKEND_API_URL: ${{ secrets.BACKEND_API_URL }}
          # Source-specific API keys
          CENSUS_API_KEY: ${{ secrets.CENSUS_API_KEY }}
          FRED_API_KEY: ${{ secrets.FRED_API_KEY }}
          BLS_API_KEY: ${{ secrets.BLS_API_KEY }}
          HUD_API_KEY: ${{ secrets.HUD_API_KEY }}
        run: npx tsx scripts/sources/${{ matrix.source }}/import-*.ts
      - name: Upload logs on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: import-logs-${{ matrix.source }}
          path: logs/
          retention-days: 30

  calculated-metrics:
    needs: import-sources
    if: always()
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      - run: npm ci --workspace=scripts
      - name: Run calculated metrics
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          PIPELINE_API_KEY: ${{ secrets.PIPELINE_API_KEY }}
          BACKEND_API_URL: ${{ secrets.BACKEND_API_URL }}
        run: npx tsx scripts/calculations/calculated-metrics-runner.ts

  scoring:
    needs: calculated-metrics
    runs-on: ubuntu-latest
    timeout-minutes: 120
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      - run: npm ci --workspace=scripts
      - name: Run scoring pipeline
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          PIPELINE_API_KEY: ${{ secrets.PIPELINE_API_KEY }}
          BACKEND_API_URL: ${{ secrets.BACKEND_API_URL }}
        run: npx tsx scripts/calculate-all-scores.ts

  notify-on-failure:
    needs: [import-sources, calculated-metrics, scoring]
    if: failure()
    runs-on: ubuntu-latest
    steps:
      - name: Create GitHub Issue
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `Data Pipeline Failure - ${new Date().toISOString().split('T')[0]}`,
              body: `The data pipeline cycle failed. Check [workflow run](${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}).`,
              labels: ['data-pipeline', 'automated']
            });
```

### Step 3: Test with `workflow_dispatch`

Trigger a manual run from GitHub Actions UI with `sources: realtor` (smallest source) to verify the workflow works end-to-end.

### Step 4: Commit and delete old workflows

```bash
git add .github/workflows/data-pipeline-cycle.yml
git rm .github/workflows/zillow-monthly-import.yml
git rm .github/workflows/realtor-monthly-import.yml
git rm .github/workflows/economic-monthly-import.yml
git rm .github/workflows/permits-monthly-import.yml
git rm .github/workflows/post-import-refresh.yml
git commit -m "feat: unified data pipeline workflow (1st and 15th), replace 5 separate workflows"
```

---

## Task 9: Fix Monitoring — Status Reporting + Manual Triggers

**Files to modify:**
- `packages/backend/src/health/pipeline-runs.service.ts:106-113` — implement `triggerPipeline()`
- `packages/backend/src/health/health.controller.ts` — add POST endpoint for pipeline status

**Files to read first:**
- `packages/backend/src/health/health.controller.ts` — current endpoint structure
- `packages/backend/src/health/pipeline-runs.service.ts` — current service (full file already read above)

### Step 1: Add pipeline status POST endpoint

The `import-runner.ts` already POSTs to `/api/health/pipeline-status`. The backend needs to accept this and write to `data_ingestion_log`.

Add to `health.controller.ts`:
```typescript
@Post('pipeline-status')
@UseGuards(PipelineApiKeyGuard)
async reportPipelineStatus(@Body() status: PipelineStatusDto) {
  return this.pipelineRunsService.recordPipelineStatus(status);
}
```

Create `PipelineStatusDto` with class-validator decorations.

Add `recordPipelineStatus()` to `pipeline-runs.service.ts` — upserts into `data_ingestion_log`.

### Step 2: Implement `triggerPipeline()` with GitHub Actions dispatch

Replace the TODO stub in `pipeline-runs.service.ts:106-113`:

```typescript
async triggerPipeline(pipelineName: string): Promise<{ success: boolean; message: string }> {
  const githubToken = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO; // 'owner/repo'
  if (!githubToken || !repo) {
    return { success: false, message: 'GitHub token or repo not configured' };
  }

  const [owner, repoName] = repo.split('/');
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/actions/workflows/data-pipeline-cycle.yml/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: { sources: pipelineName },
      }),
    }
  );

  if (response.ok || response.status === 204) {
    return { success: true, message: `Pipeline ${pipelineName} triggered` };
  }

  return { success: false, message: `GitHub API error: ${response.status}` };
}
```

### Step 3: Create `PipelineApiKeyGuard`

Simple guard that checks the `Authorization: Bearer {PIPELINE_API_KEY}` header against `process.env.PIPELINE_API_KEY`. This protects the status reporting endpoint.

### Step 4: Test the monitoring page

1. Run a source import manually: `npx tsx scripts/sources/realtor/import-realtor.ts`
2. Check admin/data page — Pipeline Runs tab should show the new run
3. Click a manual trigger button — should dispatch a GitHub Actions workflow
4. Verify the dispatched workflow appears in GitHub Actions

### Step 5: Commit

```bash
git add packages/backend/src/health/ packages/backend/src/common/
git commit -m "feat: pipeline status reporting endpoint + GitHub Actions trigger for manual runs"
```

---

## Task Summary

| Task | Description | Dependencies | Est. Complexity |
|------|-------------|--------------|-----------------|
| **0** | Build shared import framework (`scripts/lib/`) | None | Medium |
| **1** | Migrate Realtor source + verify with live data | Task 0 | Low |
| **2** | Migrate Zillow source + verify with live data | Task 0 | High (most complex) |
| **3** | Migrate Census/Economic source + verify | Task 0 | Medium-High (API-based) |
| **4** | Migrate Building Permits source + verify | Task 0 | Low-Medium |
| **5** | Migrate HUD FMR source + verify | Task 0 | Low (simplest) |
| **6** | Migrate Redfin source + verify | Task 0 | Medium (GeoID lookup) |
| **7** | Split oversized calculation files | Tasks 1-6 | Medium |
| **8** | Unified GitHub Actions workflow | Task 7 | Low |
| **9** | Fix monitoring: status reporting + manual triggers | Task 8 | Low-Medium |

**Parallelization:** Tasks 1-6 can be built in parallel (one agent per source) after Task 0 completes. They must be **verified sequentially** against live data. Tasks 7-9 are sequential.

**Environment variables needed (new):**
- `PIPELINE_API_KEY` — shared secret between GitHub Actions and backend for status reporting
- `GITHUB_TOKEN` — for the backend to dispatch GitHub Actions workflows (already available in Actions, needs to be set in Railway for admin page triggers)
- `GITHUB_REPO` — `owner/repo` string for GitHub API calls
