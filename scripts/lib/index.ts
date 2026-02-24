/**
 * Public API barrel for the shared data import framework.
 *
 * Source adapters should import from '../lib' directly rather than
 * referencing individual module files.
 *
 * Usage:
 *   import { getSupabaseClient, batchUpsert, runSourceImport } from '../lib';
 *   import type { ImportSourceConfig, GeographyConfig } from '../lib';
 */

export { getSupabaseClient, getBackendApiUrl } from './db-client';

export {
  parseNumeric,
  parseInteger,
  parseYearMonth,
  normalizeZipCode,
  normalizeFipsCode,
  parsePercent,
} from './parse-helpers';

export { loadDataFile, downloadFromUrl } from './csv-loader';

export { batchUpsert } from './batch-upsert';

export { runSourceImport } from './import-runner';

export type {
  FileFormat,
  ColumnMapFn,
  GeographyConfig,
  ImportSourceConfig,
  ImportGeographyResult,
  ImportSourceResult,
  BatchUpsertOptions,
  BatchUpsertResult,
  DataFileLoadOptions,
  DataFileLoadResult,
} from './types';
