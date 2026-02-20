/**
 * Realtor.com source adapter configuration.
 *
 * Defines download URLs, local history file paths, table names, conflict keys,
 * and the ImportSourceConfig builder for national + state geographies.
 *
 * Column mapping functions and merge logic live in `realtor-column-maps.ts`.
 */

import type { ImportSourceConfig } from '../../lib';
import { mapNationalRow, mapStateRow } from './realtor-column-maps';

// Re-export column maps and merge utilities so the entry point can import from one place
export {
  mapNationalRow,
  mapStateRow,
  mapMetroCoreRow,
  mapCountyCoreRow,
  mapZipCoreRow,
  buildHotnessMap,
  mergeCoreAndHotness,
} from './realtor-column-maps';

// ---------------------------------------------------------------------------
// Download URLs (from Realtor.com S3 bucket)
// ---------------------------------------------------------------------------

const S3_BASE = 'https://econdata.s3-us-west-2.amazonaws.com/Reports';

export const REALTOR_URLS = {
  national: {
    core: `${S3_BASE}/Core/RDC_Inventory_Core_Metrics_Country.csv`,
  },
  state: {
    core: `${S3_BASE}/Core/RDC_Inventory_Core_Metrics_State.csv`,
  },
  metro: {
    core: `${S3_BASE}/Core/RDC_Inventory_Core_Metrics_Metro.csv`,
    hotness: `${S3_BASE}/Hotness/RDC_Inventory_Hotness_Metrics_Metro.csv`,
  },
  county: {
    core: `${S3_BASE}/Core/RDC_Inventory_Core_Metrics_County.csv`,
    hotness: `${S3_BASE}/Hotness/RDC_Inventory_Hotness_Metrics_County.csv`,
  },
  zip: {
    core: `${S3_BASE}/Core/RDC_Inventory_Core_Metrics_Zip.csv`,
    hotness: `${S3_BASE}/Hotness/RDC_Inventory_Hotness_Metrics_Zip.csv`,
  },
} as const;

// ---------------------------------------------------------------------------
// Local history file paths (relative to project data/ directory)
// ---------------------------------------------------------------------------

export const REALTOR_HISTORY_FILES = {
  national: { core: 'realtor/RDC_Inventory_Core_Metrics_Country_History.csv' },
  state: { core: 'realtor/RDC_Inventory_Core_Metrics_State_History.csv' },
  metro: {
    core: 'realtor/RDC_Inventory_Core_Metrics_Metro_History.csv',
    hotness: 'realtor/RDC_Inventory_Hotness_Metrics_Metro_History.csv',
  },
  county: {
    core: 'realtor/RDC_Inventory_Core_Metrics_County_History.csv',
    hotness: 'realtor/RDC_Inventory_Hotness_Metrics_County_History.csv',
  },
  zip: {
    core: 'realtor/RDC_Inventory_Core_Metrics_Zip_History.csv',
    hotness: 'realtor/RDC_Inventory_Hotness_Metrics_Zip_History.csv',
  },
} as const;

// ---------------------------------------------------------------------------
// Table names and conflict keys per geography
// ---------------------------------------------------------------------------

export const REALTOR_TABLES: Record<string, { tableName: string; conflictKeys: string[] }> = {
  national: { tableName: 'realtor_national', conflictKeys: ['period_date'] },
  state: { tableName: 'realtor_state', conflictKeys: ['period_date', 'state_id'] },
  metro: { tableName: 'realtor_metro', conflictKeys: ['period_date', 'cbsa_code'] },
  county: { tableName: 'realtor_county', conflictKeys: ['period_date', 'county_fips'] },
  zip: { tableName: 'realtor_zip', conflictKeys: ['period_date', 'postal_code'] },
};

// ---------------------------------------------------------------------------
// ImportSourceConfig for national + state (no hotness merge needed)
// ---------------------------------------------------------------------------

/**
 * Build an ImportSourceConfig for national and state geographies.
 * These have only core data (no hotness CSV) and can use runSourceImport() directly.
 */
export function buildNationalStateConfig(useHistory: boolean): ImportSourceConfig {
  return {
    source: 'realtor',
    fileFormat: 'csv',
    batchSize: 5000,
    geographies: [
      {
        id: 'national',
        ...REALTOR_TABLES.national,
        downloadUrl: REALTOR_URLS.national.core,
        localPath: useHistory ? REALTOR_HISTORY_FILES.national.core : undefined,
        columnMap: mapNationalRow,
        datasetId: 'realtor-national',
      },
      {
        id: 'state',
        ...REALTOR_TABLES.state,
        downloadUrl: REALTOR_URLS.state.core,
        localPath: useHistory ? REALTOR_HISTORY_FILES.state.core : undefined,
        columnMap: mapStateRow,
        datasetId: 'realtor-state',
      },
    ],
  };
}
