/**
 * Parse Redfin TSV data into database-ready records.
 * Filters to non-seasonally-adjusted data and maps geography identifiers
 * based on the geo level being imported.
 *
 * Supports two modes:
 *   - Sync: parseTsv(string) for small files held in memory
 *   - Streaming: parseTsvStream(readable) for large files via async iteration
 *
 * Note: Redfin TSV headers are UPPERCASE (e.g., MEDIAN_SALE_PRICE, STATE_CODE).
 * The parser reads UPPERCASE keys from the TSV and writes lowercase keys for the DB.
 */

import { parse } from 'csv-parse/sync';
import { parse as parseAsync } from 'csv-parse';
import type { Readable } from 'stream';
import type { RedfinTsvRow, RedfinSalesRecord, RedfinGeoLevel } from './types';
import { METRIC_COLUMNS } from './types';

/**
 * Parse a raw string value into a number, handling Redfin's empty/NA conventions.
 * Strips currency symbols, commas, percent signs, and surrounding quotes.
 */
function parseNumber(val: string): number | null {
  if (!val || val === '' || val === '-' || val === 'NA' || val === 'NaN') return null;
  const clean = val.replace(/[$,%"]/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

/** Strip surrounding quotes from a TSV value */
function unquote(val: string | undefined | null): string | null {
  if (!val) return null;
  return val.replace(/^"|"$/g, '').trim() || null;
}

/** Normalize Redfin ZIP region strings like "Zip Code: 02129" to "02129". */
function normalizeZipCode(val: string | undefined | null): string | null {
  const text = unquote(val);
  if (!text) return null;

  const prefixedMatch = text.match(/Zip\s+Code:\s*([0-9]{5})(?:-[0-9]{4})?$/i);
  if (prefixedMatch) return prefixedMatch[1];

  const plainMatch = text.match(/^([0-9]{5})(?:-[0-9]{4})?$/);
  if (plainMatch) return plainMatch[1];

  return text;
}

/**
 * State abbreviation to FIPS code mapping.
 * Used to populate state_fips at import time.
 */
const STATE_FIPS: Record<string, string> = {
  AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09',
  DE: '10', DC: '11', FL: '12', GA: '13', HI: '15', ID: '16', IL: '17',
  IN: '18', IA: '19', KS: '20', KY: '21', LA: '22', ME: '23', MD: '24',
  MA: '25', MI: '26', MN: '27', MS: '28', MO: '29', MT: '30', NE: '31',
  NV: '32', NH: '33', NJ: '34', NM: '35', NY: '36', NC: '37', ND: '38',
  OH: '39', OK: '40', OR: '41', PA: '42', RI: '44', SC: '45', SD: '46',
  TN: '47', TX: '48', UT: '49', VT: '50', VA: '51', WA: '53', WV: '54',
  WI: '55', WY: '56', AS: '60', GU: '66', MP: '69', PR: '72', VI: '78',
};

/** Convert a raw TSV row into a database record */
function rowToRecord(row: RedfinTsvRow, geoLevel: RedfinGeoLevel): RedfinSalesRecord | null {
  // Filter out seasonally adjusted data
  const sa = unquote(row.IS_SEASONALLY_ADJUSTED);
  if (sa === 'true' || sa === 'TRUE') return null;
  if (!row.PERIOD_END) return null;

  const tableId = parseNumber(row.TABLE_ID);
  const stateCode = unquote(row.STATE_CODE);
  const parentMetroCode = unquote(row.PARENT_METRO_REGION_METRO_CODE);

  const record: RedfinSalesRecord = {
    period_begin: unquote(row.PERIOD_BEGIN) || '',
    period_end: unquote(row.PERIOD_END) || '',
    property_type: unquote(row.PROPERTY_TYPE) || 'All Residential',
    parent_metro_region: unquote(row.PARENT_METRO_REGION),
    parent_metro_region_metro_code: parentMetroCode,
    last_updated: unquote(row.LAST_UPDATED),
    redfin_table_id: tableId ? Math.round(tableId) : null,
  };

  // Parse all 14 metrics + mom + yoy
  for (const metric of METRIC_COLUMNS) {
    const upper = metric.toUpperCase();
    (record as any)[metric] = parseNumber((row as any)[upper]);
    (record as any)[`${metric}_mom`] = parseNumber((row as any)[`${upper}_MOM`]);
    (record as any)[`${metric}_yoy`] = parseNumber((row as any)[`${upper}_YOY`]);
  }

  // Set geography identifiers based on level
  switch (geoLevel) {
    case 'national':
      break;
    case 'state':
      record.state_code = stateCode;
      record.state_name = unquote(row.STATE);
      record.state_fips = stateCode ? (STATE_FIPS[stateCode] || null) : null;
      break;
    case 'metro':
      record.region_name = unquote(row.REGION);
      record.cbsa_code = tableId ? String(Math.round(tableId)) : parentMetroCode;
      break;
    case 'county':
      record.county_name = unquote(row.REGION);
      record.state_code = stateCode;
      break;
    case 'city':
      record.city_name = unquote(row.CITY) || unquote(row.REGION)?.split(',')[0]?.trim() || null;
      record.state_code = stateCode;
      break;
    case 'zip':
      record.zip_code = normalizeZipCode(row.REGION);
      record.state_code = stateCode;
      break;
    case 'neighborhood':
      record.neighborhood_name = unquote(row.REGION);
      record.city = unquote(row.CITY);
      record.state_code = stateCode;
      break;
  }

  return record;
}

/**
 * Parse a Redfin TSV string (in-memory) and return records for DB insertion.
 * Used for small files (national, state, metro).
 */
export function parseTsv(tsv: string, geoLevel: RedfinGeoLevel): RedfinSalesRecord[] {
  const records: RedfinTsvRow[] = parse(tsv, {
    columns: true,
    skip_empty_lines: true,
    delimiter: '\t',
    trim: true,
    relax_column_count: true,
    relax_quotes: true,
  });

  console.log(`    Parsed ${records.length} raw rows`);

  const dbRecords: RedfinSalesRecord[] = [];
  for (const row of records) {
    const record = rowToRecord(row, geoLevel);
    if (record) dbRecords.push(record);
  }

  console.log(`    After filtering non-adjusted: ${dbRecords.length} rows`);
  return dbRecords;
}

/**
 * Parse a Redfin TSV stream and yield batches of records for DB insertion.
 * Used for large files (county, city, zip, neighborhood) that don't fit in memory as a string.
 *
 * Yields arrays of BATCH_SIZE records at a time so the caller can upsert incrementally
 * without holding the entire dataset in memory.
 */
export async function* parseTsvStream(
  stream: Readable,
  geoLevel: RedfinGeoLevel,
  batchSize: number,
): AsyncGenerator<{ batch: RedfinSalesRecord[]; rawCount: number; filteredCount: number }> {
  const parser = stream.pipe(parseAsync({
    columns: true,
    skip_empty_lines: true,
    delimiter: '\t',
    trim: true,
    relax_column_count: true,
    relax_quotes: true,
  }));

  let batch: RedfinSalesRecord[] = [];
  let rawCount = 0;
  let filteredCount = 0;
  const progressEvery = geoLevel === 'zip' ? 100_000 : 500_000;

  for await (const row of parser) {
    rawCount++;
    const record = rowToRecord(row as RedfinTsvRow, geoLevel);
    if (record) {
      filteredCount++;
      batch.push(record);

      if (batch.length >= batchSize) {
        yield { batch, rawCount, filteredCount };
        batch = [];
      }
    }

    // Log progress every 500K raw rows
    if (rawCount % progressEvery === 0) {
      console.log(`    Parsed ${rawCount.toLocaleString()} raw rows so far (${filteredCount.toLocaleString()} kept)...`);
    }
  }

  // Yield remaining records
  if (batch.length > 0) {
    yield { batch, rawCount, filteredCount };
  }
}
