/**
 * Shared types for the unified data import framework.
 *
 * Used by all source adapters (Zillow, Realtor, Census, BLS/FRED, HUD, Permits, Redfin)
 * and the import-runner orchestrator.
 */

import { IngestionSource } from '../utils/ingestion-logger';

/** Supported input file formats for data imports. */
export type FileFormat = 'csv' | 'tsv' | 'xlsx';

/**
 * Column mapping function: transforms a raw CSV/TSV/XLSX row into a database record.
 * Return null to skip the row (e.g., invalid data, filtered out).
 */
export type ColumnMapFn = (row: Record<string, string>) => Record<string, unknown> | null;

/**
 * Per-geography configuration within an import source.
 * Each geography (state, metro, county, zip) has its own table, conflict keys, and data source.
 */
export interface GeographyConfig {
  /** Human-readable geography identifier (e.g., 'state', 'metro', 'county', 'zip'). */
  id: string;
  /** Target Supabase table name (e.g., 'zillow_state', 'realtor_metro'). */
  tableName: string;
  /** Columns that form the upsert conflict key (e.g., ['region_id', 'period_date', 'metric_name']). */
  conflictKeys: string[];
  /** Remote URL to download the data file from. */
  downloadUrl?: string;
  /** Local file path relative to the project `data/` directory. */
  localPath?: string;
  /** Function that maps a raw row to a database record. Return null to skip the row. */
  columnMap: ColumnMapFn;
  /** Optional dataset identifier for ingestion logging (e.g., 'zhvi', 'zori'). */
  datasetId?: string;
  /** Optional metric name for ingestion logging. */
  metricName?: string;
}

/**
 * Top-level configuration for a data import source.
 * Each source (Zillow, Realtor, etc.) defines one of these.
 */
export interface ImportSourceConfig {
  /** Source identifier matching IngestionSource type (e.g., 'zillow', 'realtor'). */
  source: IngestionSource;
  /** Input file format. Defaults to 'csv'. */
  fileFormat: FileFormat;
  /** Number of records per upsert batch. Defaults to 5000. */
  batchSize: number;
  /** Geography-level configurations to iterate over. */
  geographies: GeographyConfig[];
  /** Optional hooks to run after all geographies complete (e.g., refresh materialized views). */
  postImportHooks?: Array<() => Promise<void>>;
}

/** Result of importing a single geography level. */
export interface ImportGeographyResult {
  /** Geography identifier (matches GeographyConfig.id). */
  geographyId: string;
  /** Target table name. */
  tableName: string;
  /** Overall status for this geography. */
  status: 'success' | 'partial' | 'failed' | 'skipped';
  /** Number of records successfully upserted. */
  recordsInserted: number;
  /** Number of records that failed to upsert. */
  recordsFailed: number;
  /** Total rows loaded from the data file. */
  totalRowsLoaded: number;
  /** Number of rows skipped by the column mapping function (returned null). */
  rowsSkippedByMapping: number;
  /** Most recent period_date found in the mapped records. */
  latestPeriodDate: string | null;
  /** Error messages collected during import. */
  errors: string[];
  /** Duration of this geography import in milliseconds. */
  durationMs: number;
}

/** Aggregated result across all geographies for a source import. */
export interface ImportSourceResult {
  /** Source identifier. */
  source: IngestionSource;
  /** Per-geography results. */
  geographies: ImportGeographyResult[];
  /** Overall status (success only if all geographies succeeded). */
  overallStatus: 'success' | 'partial' | 'failed';
  /** Total records inserted across all geographies. */
  totalInserted: number;
  /** Total records failed across all geographies. */
  totalFailed: number;
  /** Total duration in milliseconds. */
  totalDurationMs: number;
}

/** Options for the batch upsert operation. */
export interface BatchUpsertOptions {
  /** Supabase table name. */
  tableName: string;
  /** Conflict key columns for upsert (e.g., ['region_id', 'period_date', 'metric_name']). */
  conflictKeys: string[];
  /** Number of records per batch. Defaults to 5000. */
  batchSize?: number;
  /** Callback invoked after each batch with cumulative counts. */
  onProgress?: (inserted: number, failed: number) => void;
}

/** Result returned by the batch upsert operation. */
export interface BatchUpsertResult {
  /** Total records successfully upserted. */
  inserted: number;
  /** Total records that failed. */
  failed: number;
  /** Error messages from failed batches. */
  errors: string[];
}

/** Options for loading a data file (CSV/TSV/XLSX). */
export interface DataFileLoadOptions {
  /** Remote URL to download from. */
  url?: string;
  /** Local file path relative to the project `data/` directory. */
  localPath?: string;
  /** File format. Defaults to 'csv'. */
  format?: FileFormat;
  /** Custom delimiter (only for CSV/TSV). Inferred from format if not set. */
  delimiter?: string;
}

/** Result of loading and parsing a data file. */
export interface DataFileLoadResult {
  /** Parsed rows as string key-value records. */
  rows: Record<string, string>[];
  /** Total number of rows parsed. */
  rowCount: number;
  /** Whether data came from a local file or a remote URL. */
  source: 'url' | 'file';
}
