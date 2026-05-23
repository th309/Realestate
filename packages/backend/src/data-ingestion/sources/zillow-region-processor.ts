/**
 * Per-region processing for the Zillow importer.
 *
 * One Zillow CSV row = one region with date-columns. This function:
 *  1. Pre-upserts the market row (so the FK on the time-series table is satisfied).
 *  2. Filters date columns by the incremental cutoff (skips multi-year history).
 *  3. Validates each value's range and transposes wide-to-long.
 *  4. Batch-upserts into the geo-specific zillow_* table.
 *
 * Extracted from ZillowService to keep the service file under the 300-line
 * limit and make per-region logic independently testable.
 */

import type { Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { batchUpsertWithRetry, validateMetricValue } from '../base';
import { normalizeZipKey } from '../../common/zip';

interface MarketRecord {
  region_id: string;
  region_name: string;
  region_type: string;
  state_name?: string;
  state_code?: string;
  size_rank?: number;
}

export interface RegionProcessResult {
  marketsCreated: number;
  timeSeriesInserted: number;
  errors: number;
  validationErrors: number;
  errorDetails: Array<{ region: string; error: string }>;
}

/**
 * Map Zillow region_type to its destination time-series table.
 * Unsupported types return null (caller skips them with a warning).
 */
function tableForRegionType(regionType: string): string | null {
  switch (regionType) {
    case 'state':
      return 'zillow_state';
    case 'msa':
      return 'zillow_metro';
    case 'county':
      return 'zillow_county';
    case 'zip':
      return 'zillow_zip';
    case 'city':
      return 'zillow_city';
    default:
      return null;
  }
}

export async function processZillowRegion(
  supabase: SupabaseClient,
  logger: Logger,
  record: Record<string, any>,
  index: number,
  totalRegions: number,
  normalizedMetricName: string,
  dateCutoff: string | null,
): Promise<RegionProcessResult> {
  const result: RegionProcessResult = {
    marketsCreated: 0,
    timeSeriesInserted: 0,
    errors: 0,
    validationErrors: 0,
    errorDetails: [],
  };

  try {
    const regionId = record.RegionID;
    const regionType = record.RegionType === 'msa' ? 'msa' : record.RegionType;
    const regionName =
      regionType === 'zip' || regionType === 'Zip'
        ? normalizeZipKey(record.RegionName || '')
        : record.RegionName || '';
    const stateName = record.StateName || null;
    const sizeRank = record.SizeRank ? parseInt(record.SizeRank) : null;

    if (!regionId || !regionName) {
      logger.warn(`Skipping row ${index}: missing RegionID or RegionName`);
      return result;
    }

    if ((index + 1) % 10 === 0) {
      logger.debug(
        `Processing region ${index + 1}/${totalRegions}: ${regionName}`,
      );
    }

    const marketData: MarketRecord = {
      region_id: regionId,
      region_name: regionName,
      region_type: regionType,
      state_name: stateName || undefined,
      state_code: stateName
        ? stateName.substring(0, 2).toUpperCase()
        : undefined,
      size_rank: sizeRank || undefined,
    };

    const { error: marketError } = await supabase
      .from('markets')
      .upsert(marketData, {
        onConflict: 'region_id',
        ignoreDuplicates: false,
      });

    if (marketError) {
      logger.error(
        `Error upserting market ${regionId}: ${marketError.message}`,
      );
      result.errors++;
      return result;
    }
    result.marketsCreated++;

    const tableName = tableForRegionType(regionType);
    if (!tableName) {
      logger.warn(`Skipping unsupported region type: ${regionType}`);
      return result;
    }

    // Filter date columns by cutoff, then transpose wide-to-long.
    // String comparison works because YYYY-MM-DD sorts lexically.
    const dateColumns = Object.keys(record).filter(
      (key) =>
        /^\d{4}-\d{2}-\d{2}$/.test(key) && (!dateCutoff || key >= dateCutoff),
    );

    const recordsToInsert: Array<Record<string, unknown>> = [];
    for (const dateCol of dateColumns) {
      const value = parseFloat(record[dateCol]);
      if (isNaN(value) || value === 0) continue;

      if (!validateMetricValue('zillow', normalizedMetricName, value)) {
        logger.warn(
          `Out-of-range value for ${normalizedMetricName} [${regionId}/${dateCol}]: ${value}`,
        );
        result.validationErrors++;
        continue;
      }

      recordsToInsert.push({
        region_id: regionId,
        region_name: regionName,
        period_date: dateCol,
        metric_name: normalizedMetricName,
        value,
      });
    }

    if (recordsToInsert.length === 0) return result;

    const upsertResult = await batchUpsertWithRetry(supabase, recordsToInsert, {
      tableName,
      onConflict: 'region_id,period_date,metric_name',
      batchSize: 100,
    });

    result.timeSeriesInserted += upsertResult.inserted;
    if (upsertResult.failed > 0) {
      result.errors += upsertResult.errors.length;
      for (const errMessage of upsertResult.errors) {
        logger.error(
          `Error upserting batch to ${tableName} for ${regionId}: ${errMessage}`,
        );
        result.errorDetails.push({ region: regionId, error: errMessage });
      }
    }
  } catch (error: any) {
    logger.error(`Error processing region ${index}: ${error.message}`);
    result.errors++;
  }

  return result;
}
