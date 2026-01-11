/**
 * FRED Data Importer
 */

import type { ImportStats, FREDGeography, FREDSeries } from './types';
import { getSeriesForGeography, FIELD_TO_SUFFIX } from './series-config';
import { fetchFREDSeries } from './api-client';
import { parseValue } from './parsers';
import { batchUpsertSQL, ensureGeographicUnitExists, getGeographicUnits } from './sql-helpers';
import { STATE_FIPS_TO_ABBREV, getFipsFromAbbreviation } from './state-mappings';

const BATCH_SIZE = 100;

/**
 * Import FRED data for a given year and geography
 */
export async function importFREDData(
  year: number,
  geography: FREDGeography
): Promise<ImportStats> {
  const startTime = Date.now();
  const stats: ImportStats = {
    geography,
    year,
    totalRecords: 0,
    seriesProcessed: 0,
    errors: [],
    duration: 0
  };

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Importing FRED ${year} Data - ${geography.toUpperCase()}`);
  console.log('='.repeat(60));

  try {
    const relevantSeries = getSeriesForGeography(geography);

    if (relevantSeries.length === 0) {
      console.log(`   ⚠️  No FRED series configured for ${geography}`);
      return stats;
    }

    // Get geographic units
    let geoUnits: Array<{ geoid: string;[key: string]: any }> = [];
    let geoids: string[] = [];

    if (geography !== 'national') {
      geoUnits = await getGeographicUnits(geography as 'state' | 'county' | 'msa');
      geoids = geoUnits.map(u => u.geoid);
      console.log(`   Found ${geoids.length} ${geography} units`);
    } else {
      geoids = ['US'];
      geoUnits = [{ geoid: 'US' }];
      await ensureGeographicUnitExists('US', 'state', 'United States');
      console.log(`   Ensured 'US' geographic unit exists`);
    }

    const observationStart = `${year}-01-01`;
    const observationEnd = `${year}-12-31`;

    // Process each series
    for (const series of relevantSeries) {
      try {
        await processSeries(series, geography, geoUnits, geoids, observationStart, observationEnd, stats);
        stats.seriesProcessed++;
      } catch (err: any) {
        const seriesIdStr = typeof series.seriesId === 'string' ? series.seriesId : 'dynamic';
        stats.errors.push(`${seriesIdStr}: ${err.message}`);
        console.warn(`   ⚠️  Error processing series: ${err.message}`);
      }
    }

    stats.duration = Date.now() - startTime;
    printImportSummary(stats);

  } catch (error: any) {
    stats.errors.push(`Fatal error: ${error.message}`);
    console.error('\n❌ Import failed:', error.message);
  }

  return stats;
}

/**
 * Process a single FRED series
 */
async function processSeries(
  series: FREDSeries,
  geography: FREDGeography,
  geoUnits: Array<{ geoid: string;[key: string]: any }>,
  geoids: string[],
  observationStart: string,
  observationEnd: string,
  stats: ImportStats
): Promise<void> {
  const seriesIdStr = typeof series.seriesId === 'string' ? series.seriesId : 'dynamic';
  console.log(`   Processing ${seriesIdStr} (${series.description})...`);

  const seriesIds = getSeriesIds(series, geography, geoUnits, geoids);

  if (seriesIds.length === 0) {
    console.warn(`     ⚠️  No series IDs found for ${series.field}`);
    return;
  }

  // Get GEOID to series ID mapping for reverse lookup
  const geoidToSeriesId = buildGeoidToSeriesIdMap(series, geoUnits, geoids);

  for (const seriesId of seriesIds) {
    try {
      const observations = await fetchFREDSeries(seriesId, observationStart, observationEnd);

      if (observations.length === 0) {
        console.log(`     No data for ${seriesId}`);
        continue;
      }

      const records = buildRecords(observations, series, seriesId, geography, geoidToSeriesId);

      if (records.length > 0) {
        await insertRecords(records, seriesId, stats);
        console.log(`     ✅ Imported ${records.length} observations for ${seriesId}`);
      }
    } catch (err: any) {
      stats.errors.push(`${seriesId}: ${err.message}`);
      console.warn(`     ⚠️  Error processing ${seriesId}: ${err.message}`);
    }
  }
}

/**
 * Get series IDs for a geography
 */
function getSeriesIds(
  series: FREDSeries,
  geography: FREDGeography,
  geoUnits: Array<{ geoid: string;[key: string]: any }>,
  geoids: string[]
): string[] {
  if (geography === 'national') {
    if (typeof series.seriesId === 'string') {
      return [series.seriesId];
    }
    const id = series.seriesId('US');
    return id ? [id] : [];
  }

  // Check for FRED series IDs in normalization tables
  const seriesIds: string[] = [];

  for (const unit of geoUnits) {
    let seriesId: string | null = null;

    // Check various column names
    const possibleColumnNames = [
      `fred_${series.field}_series_id`,
      `fred_${series.field}`,
      'fred_series_id',
      'series_id'
    ];

    for (const colName of possibleColumnNames) {
      if (unit[colName]) {
        seriesId = unit[colName];
        break;
      }
    }

    // For states, construct from abbreviation
    if (!seriesId && geography === 'state' && unit.state_abbreviation) {
      const suffix = FIELD_TO_SUFFIX[series.field];
      if (suffix) {
        seriesId = `${unit.state_abbreviation}${suffix}`;
      }
    }

    if (seriesId && !seriesIds.includes(seriesId)) {
      seriesIds.push(seriesId);
    }
  }

  // Fallback: try function-based generation
  if (seriesIds.length === 0 && geography === 'state' && typeof series.seriesId === 'function') {
    return geoids
      .map(geoid => series.seriesId(geoid))
      .filter((id): id is string => id !== null);
  }

  return seriesIds;
}

/**
 * Build GEOID to series ID mapping
 */
function buildGeoidToSeriesIdMap(
  series: FREDSeries,
  geoUnits: Array<{ geoid: string;[key: string]: any }>,
  geoids: string[]
): Map<string, string> {
  const map = new Map<string, string>();

  for (const unit of geoUnits) {
    let seriesId: string | null = null;

    const possibleColumnNames = [
      `fred_${series.field}_series_id`,
      `fred_${series.field}`,
      'fred_series_id',
      'series_id'
    ];

    for (const colName of possibleColumnNames) {
      if (unit[colName]) {
        seriesId = unit[colName];
        break;
      }
    }

    if (!seriesId && unit.state_abbreviation) {
      const suffix = FIELD_TO_SUFFIX[series.field];
      if (suffix) {
        seriesId = `${unit.state_abbreviation}${suffix}`;
      }
    }

    if (seriesId) {
      map.set(unit.geoid, seriesId);
    }
  }

  return map;
}

/**
 * Build database records from observations
 */
function buildRecords(
  observations: any[],
  series: FREDSeries,
  seriesId: string,
  geography: FREDGeography,
  geoidToSeriesId: Map<string, string>
): any[] {
  const records: any[] = [];

  for (const obs of observations) {
    const rawValue = parseValue(obs.value);
    if (rawValue === null) continue;

    const value = series.transform ? series.transform(rawValue) : rawValue;

    // Determine GEOID
    let geoid = 'US';
    if (geography === 'national') {
      geoid = 'US';
    } else {
      // Reverse lookup from series ID
      for (const [gid, sid] of geoidToSeriesId.entries()) {
        if (sid === seriesId) {
          geoid = gid;
          break;
        }
      }

      // Fallback: extract from series ID for states
      if (geoid === 'US' && geography === 'state') {
        const stateAbbrev = seriesId.substring(0, 2);
        const fips = getFipsFromAbbreviation(stateAbbrev);
        if (fips) geoid = fips;
      }
    }

    records.push({
      geoid,
      series_id: seriesId,
      metric_date: obs.date,
      [series.field]: value,
      data_vintage: obs.date,
      created_at: new Date().toISOString()
    });
  }

  return records;
}

/**
 * Insert records in batches
 */
async function insertRecords(
  records: any[],
  seriesId: string,
  stats: ImportStats
): Promise<void> {
  const tableName = 'fred_economic_data';

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const result = await batchUpsertSQL(tableName, batch, 'geoid,series_id,metric_date');

    if (result.error) {
      stats.errors.push(`${seriesId} batch ${Math.floor(i / BATCH_SIZE)}: ${result.error}`);
    } else {
      stats.totalRecords += result.inserted;
    }
  }
}

/**
 * Print import summary
 */
function printImportSummary(stats: ImportStats): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 IMPORT COMPLETE');
  console.log('='.repeat(60));
  console.log(`Geography: ${stats.geography}`);
  console.log(`Year: ${stats.year}`);
  console.log(`Series Processed: ${stats.seriesProcessed}`);
  console.log(`Total Records: ${stats.totalRecords.toLocaleString()}`);
  console.log(`Errors: ${stats.errors.length}`);
  console.log(`Duration: ${(stats.duration / 1000).toFixed(2)}s`);
  console.log('='.repeat(60));

  if (stats.errors.length > 0) {
    console.log('\n⚠️  Errors encountered:');
    stats.errors.slice(0, 10).forEach(err => console.log(`   - ${err}`));
    if (stats.errors.length > 10) {
      console.log(`   ... and ${stats.errors.length - 10} more`);
    }
  }
}

/**
 * Print overall summary for multiple imports
 */
export function printOverallSummary(allStats: ImportStats[]): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 OVERALL SUMMARY');
  console.log('='.repeat(60));

  const totalRecords = allStats.reduce((sum, s) => sum + s.totalRecords, 0);
  const totalDuration = allStats.reduce((sum, s) => sum + s.duration, 0);
  const totalErrors = allStats.reduce((sum, s) => sum + s.errors.length, 0);

  console.log(`Total Records: ${totalRecords.toLocaleString()}`);
  console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`Total Errors: ${totalErrors}`);
  console.log('='.repeat(60));
}
