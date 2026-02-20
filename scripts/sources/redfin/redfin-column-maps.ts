/**
 * Column mapping logic for Redfin TSV files.
 *
 * Redfin TSV files have a wide-format header with columns like:
 *   PERIOD_BEGIN, PERIOD_END, REGION, REGION_TYPE, STATE_CODE, ...,
 *   MEDIAN_SALE_PRICE, MEDIAN_SALE_PRICE_MOM, MEDIAN_SALE_PRICE_YOY,
 *   HOMES_SOLD, HOMES_SOLD_MOM, HOMES_SOLD_YOY, ...
 *
 * This module handles:
 * 1. Auto-detecting metric columns from headers (skipping metadata columns)
 * 2. Extracting base values, MoM, and YoY for each metric
 * 3. Mapping to the redfin_metrics wide-format DB columns
 *
 * Unlike Zillow/Realtor adapters which use a simple row -> record ColumnMapFn,
 * Redfin requires header-dependent dynamic column discovery because the exact
 * set of metric columns varies between geography levels and file versions.
 */

import { parseNumeric } from '../../lib';
import {
  REDFIN_METADATA_COLUMNS,
  REDFIN_METRIC_TO_DB_COLUMN,
  REDFIN_YOY_COLUMNS,
} from './redfin-config';

// ---------------------------------------------------------------------------
// Types for parsed TSV structure
// ---------------------------------------------------------------------------

/** A discovered metric column in the TSV header. */
export interface RedfinMetricColumn {
  /** Normalized metric name (lowercase, underscored). */
  normalizedName: string;
  /** Column index in the TSV row. */
  columnIndex: number;
  /** Whether this is a _MOM suffix column. */
  isMomColumn: boolean;
  /** Whether this is a _YOY suffix column. */
  isYoyColumn: boolean;
}

/** Metadata extracted from a single TSV data row before geoid resolution. */
export interface RedfinParsedRowMetadata {
  periodEnd: string;
  regionName: string;
  regionType: string;
  stateCode: string | undefined;
  city: string | undefined;
}

/** A fully parsed record ready for geoid assignment and DB upsert. */
export interface RedfinMappedRecord {
  metadata: RedfinParsedRowMetadata;
  dbRecord: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Header analysis: discover metric columns from the TSV header row
// ---------------------------------------------------------------------------

/**
 * Analyze TSV headers to discover which columns contain metric values.
 * Returns an array of metric column descriptors.
 */
export function discoverMetricColumns(headers: string[]): RedfinMetricColumn[] {
  const columns: RedfinMetricColumn[] = [];

  for (let index = 0; index < headers.length; index++) {
    const rawHeader = headers[index].trim().replace(/^"|"$/g, '');

    if (REDFIN_METADATA_COLUMNS.has(rawHeader)) continue;

    let baseName = rawHeader;
    let isMom = false;
    let isYoy = false;

    if (rawHeader.endsWith('_MOM')) {
      baseName = rawHeader.slice(0, -4);
      isMom = true;
    } else if (rawHeader.endsWith('_YOY')) {
      baseName = rawHeader.slice(0, -4);
      isYoy = true;
    }

    const normalizedName = baseName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    columns.push({
      normalizedName,
      columnIndex: index,
      isMomColumn: isMom,
      isYoyColumn: isYoy,
    });
  }

  return columns;
}

/**
 * Count unique base metrics (excluding MoM/YoY variants) from discovered columns.
 */
export function countBaseMetrics(columns: RedfinMetricColumn[]): number {
  const baseNames = new Set(columns.filter(c => !c.isMomColumn && !c.isYoyColumn).map(c => c.normalizedName));
  return baseNames.size;
}

// ---------------------------------------------------------------------------
// Row mapping: TSV values -> database record
// ---------------------------------------------------------------------------

/**
 * Find the header index for a column name (case-insensitive).
 */
function findHeaderIndex(headers: string[], columnName: string): number {
  return headers.findIndex(h => h.trim().replace(/^"|"$/g, '') === columnName);
}

/**
 * Clean a raw TSV cell value: strip quotes and trim whitespace.
 */
function cleanCellValue(value: string | undefined): string {
  if (!value) return '';
  return value.trim().replace(/^"|"$/g, '');
}

/**
 * Map a single TSV data row to a RedfinMappedRecord.
 *
 * Extracts metadata (region, date) and all recognized metric values.
 * Returns null if the row has no valid metrics or missing required fields.
 */
export function mapTsvRowToRecord(
  rowValues: string[],
  headers: string[],
  metricColumns: RedfinMetricColumn[],
): RedfinMappedRecord | null {
  const periodEndIdx = findHeaderIndex(headers, 'PERIOD_END');
  const periodBeginIdx = findHeaderIndex(headers, 'PERIOD_BEGIN');
  const regionIdx = findHeaderIndex(headers, 'REGION');
  const regionTypeIdx = findHeaderIndex(headers, 'REGION_TYPE');
  const stateCodeIdx = findHeaderIndex(headers, 'STATE_CODE');
  const cityIdx = findHeaderIndex(headers, 'CITY');

  const periodEnd = cleanCellValue(rowValues[periodEndIdx]);
  const periodBegin = cleanCellValue(rowValues[periodBeginIdx]);
  const metricDate = periodEnd || periodBegin;
  if (!metricDate) return null;

  const regionName = cleanCellValue(rowValues[regionIdx]);
  const regionType = cleanCellValue(rowValues[regionTypeIdx]).toLowerCase();
  if (!regionName || !regionType) return null;

  const stateCode = stateCodeIdx >= 0 ? cleanCellValue(rowValues[stateCodeIdx]) || undefined : undefined;
  const city = cityIdx >= 0 ? cleanCellValue(rowValues[cityIdx]) || undefined : undefined;

  // Build the database record with metric values
  const dbRecord: Record<string, unknown> = {
    metric_date: metricDate,
  };

  let hasAnyMetric = false;

  // Extract base metric values
  for (const col of metricColumns) {
    if (col.isMomColumn || col.isYoyColumn) continue;

    const dbColumnName = REDFIN_METRIC_TO_DB_COLUMN[col.normalizedName];
    if (!dbColumnName) continue;

    const rawValue = cleanCellValue(rowValues[col.columnIndex]);
    const numericValue = parseNumeric(rawValue);
    if (numericValue !== null) {
      dbRecord[dbColumnName] = numericValue;
      hasAnyMetric = true;
    }
  }

  // Extract YoY values for metrics that have companion YoY columns
  for (const col of metricColumns) {
    if (!col.isYoyColumn) continue;

    const dbColumnName = REDFIN_METRIC_TO_DB_COLUMN[col.normalizedName];
    if (!dbColumnName) continue;

    const yoyDbColumn = REDFIN_YOY_COLUMNS[dbColumnName];
    if (!yoyDbColumn) continue;

    const rawValue = cleanCellValue(rowValues[col.columnIndex]);
    const numericValue = parseNumeric(rawValue);
    if (numericValue !== null) {
      dbRecord[yoyDbColumn] = numericValue;
    }
  }

  if (!hasAnyMetric) return null;

  return {
    metadata: {
      periodEnd: metricDate,
      regionName,
      regionType,
      stateCode,
      city,
    },
    dbRecord,
  };
}
