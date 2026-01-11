/**
 * Census Data Importer
 */

import type { ImportStats, CensusGeography } from './types';
import { getVariableCodes } from './variables';
import { fetchCensusData, getGeoIdFromRecord } from './api-client';
import { processDemographicsRecord, processEconomicsRecord, processHousingRecord, ultraCleanRecord } from './processors';
import { batchUpsertSQL, createMarketEntries, createGeoUnitEntries } from './sql-helpers';
import { MAX_INTEGER } from './types';

const BATCH_SIZE = 100;

/**
 * Import Census data for a given year and geography
 */
export async function importCensusData(year: number, geography: CensusGeography): Promise<ImportStats> {
  const startTime = Date.now();
  const stats: ImportStats = {
    geography,
    year,
    totalRecords: 0,
    demographics: 0,
    economics: 0,
    housing: 0,
    errors: [],
    duration: 0
  };

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Importing Census ${year} Data - ${geography.toUpperCase()}`);
  console.log('='.repeat(60));

  try {
    const variableCodes = getVariableCodes();
    const records = await fetchCensusData(year, geography, variableCodes);
    stats.totalRecords = records.length;

    console.log(`✅ Fetched ${records.length.toLocaleString()} records from Census API`);

    // Create market and geographic unit entries
    console.log(`   Ensuring market entries exist for ${records.length} ${geography} records...`);

    const getGeoId = (record: any) => getGeoIdFromRecord(record, geography);

    const marketResult = await createMarketEntries(records, geography, getGeoId);
    if (marketResult.error) {
      console.log(`   ⚠️  Warning: Could not create market entries: ${marketResult.error}`);
    } else {
      console.log(`   ✅ Created/updated market entries`);
    }

    const geoResult = await createGeoUnitEntries(records, geography, getGeoId);
    if (geoResult.error) {
      console.log(`   ⚠️  Warning: Could not create geographic_units entries: ${geoResult.error}`);
    } else {
      console.log(`   ✅ Created/updated geographic_units entries`);
    }

    // Process and insert in batches
    const demographicsBatch: any[] = [];
    const economicsBatch: any[] = [];
    const housingBatch: any[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const geoid = getGeoIdFromRecord(record, geography);

      try {
        demographicsBatch.push(processDemographicsRecord(record, geoid, year));
        economicsBatch.push(processEconomicsRecord(record, geoid, year));
        housingBatch.push(processHousingRecord(record, geoid, year));

        if ((i + 1) % BATCH_SIZE === 0 || i === records.length - 1) {
          // Process demographics
          const demoStats = await insertDemographicsBatch(demographicsBatch, stats, i);
          stats.demographics += demoStats.inserted;
          if (demoStats.error) stats.errors.push(demoStats.error);

          // Process economics
          const econResult = await batchUpsertSQL('census_economics', economicsBatch, 'geoid,vintage_year');
          if (econResult.error) {
            stats.errors.push(`Economics batch ${Math.floor(i / BATCH_SIZE)}: ${econResult.error}`);
          } else {
            stats.economics += econResult.inserted;
          }

          // Process housing
          const houseResult = await batchUpsertSQL('census_housing', housingBatch, 'geoid,vintage_year');
          if (houseResult.error) {
            stats.errors.push(`Housing batch ${Math.floor(i / BATCH_SIZE)}: ${houseResult.error}`);
          } else {
            stats.housing += houseResult.inserted;
          }

          console.log(`   Processed ${i + 1}/${records.length} records...`);

          demographicsBatch.length = 0;
          economicsBatch.length = 0;
          housingBatch.length = 0;
        }
      } catch (err: any) {
        stats.errors.push(`Record ${geoid}: ${err.message}`);
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
 * Insert demographics batch with retry logic
 */
async function insertDemographicsBatch(
  batch: any[],
  stats: ImportStats,
  batchIndex: number
): Promise<{ inserted: number; error?: string }> {
  const cleanBatch = batch.map(ultraCleanRecord);

  const result = await batchUpsertSQL('census_demographics', cleanBatch, 'geoid,vintage_year');

  if (result.error && (result.error.includes('overflow') || result.error.includes('numeric'))) {
    // Try individual inserts
    let successCount = 0;
    for (const record of cleanBatch) {
      const singleResult = await batchUpsertSQL('census_demographics', [record], 'geoid,vintage_year');

      if (singleResult.error && singleResult.error.includes('overflow')) {
        // Try with minimal fields
        const minimalRecord = {
          geoid: record.geoid,
          vintage_year: record.vintage_year,
          survey_type: record.survey_type,
          created_at: record.created_at,
          total_population: record.total_population ? Math.min(MAX_INTEGER, Math.max(0, Math.round(record.total_population))) : null
        };

        const minResult = await batchUpsertSQL('census_demographics', [minimalRecord], 'geoid,vintage_year');
        if (!minResult.error) successCount++;
      } else if (!singleResult.error) {
        successCount++;
      }
    }

    return {
      inserted: successCount,
      error: successCount < cleanBatch.length
        ? `Demographics batch ${Math.floor(batchIndex / BATCH_SIZE)}: ${cleanBatch.length - successCount} records skipped`
        : undefined
    };
  }

  return result;
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
  console.log(`Total Records: ${stats.totalRecords.toLocaleString()}`);
  console.log(`Demographics: ${stats.demographics.toLocaleString()}`);
  console.log(`Economics: ${stats.economics.toLocaleString()}`);
  console.log(`Housing: ${stats.housing.toLocaleString()}`);
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
