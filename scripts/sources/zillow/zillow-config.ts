/**
 * Zillow source adapter configuration.
 *
 * Maps Zillow geography levels to their target tables and conflict keys.
 * Unlike Realtor (which uses the standard columnMap per-row pattern),
 * Zillow requires wide-to-long transposition handled in import-zillow.ts.
 *
 * This file provides the table/conflict-key mapping and re-exports
 * transformer and dataset utilities for the entry point.
 */

import type { ZillowGeography } from './zillow-dataset-configs';

// Re-export everything the entry point needs from a single import
export { ALL_ZILLOW_DATASETS, getDatasetsByGeography, getDatasetsByMetric } from './zillow-dataset-configs';
export type { ZillowDatasetConfig, ZillowGeography } from './zillow-dataset-configs';
export { transposeAllRows } from './zillow-csv-transformer';

// ---------------------------------------------------------------------------
// Table configuration per geography level
// ---------------------------------------------------------------------------

export interface ZillowTableConfig {
  tableName: string;
  conflictKeys: string[];
}

/** Target table and upsert conflict keys for each Zillow geography level. */
export const ZILLOW_TABLES: Record<ZillowGeography, ZillowTableConfig> = {
  state: {
    tableName: 'zillow_state',
    conflictKeys: ['region_id', 'period_date', 'metric_name'],
  },
  metro: {
    tableName: 'zillow_metro',
    conflictKeys: ['region_id', 'period_date', 'metric_name'],
  },
  county: {
    tableName: 'zillow_county',
    conflictKeys: ['region_id', 'period_date', 'metric_name'],
  },
  zip: {
    tableName: 'zillow_zip',
    conflictKeys: ['region_id', 'period_date', 'metric_name'],
  },
};

/**
 * Get the target table name for a geography level.
 */
export function getZillowTableName(geography: ZillowGeography): string {
  return ZILLOW_TABLES[geography].tableName;
}

/**
 * Get the upsert conflict keys for a geography level.
 */
export function getZillowConflictKeys(geography: ZillowGeography): string[] {
  return ZILLOW_TABLES[geography].conflictKeys;
}
