/**
 * CSV processing for Realtor.com data imports
 */

import { parse } from 'csv-parse/sync';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RealtorNationalRecord, RealtorStateRecord, RealtorCombinedRecord, ImportResult } from './types';

/**
 * Parse YYYYMM date format to Date object
 */
function parseYYYYMM(yyyymm: string): Date {
  const year = parseInt(yyyymm.substring(0, 4));
  const month = parseInt(yyyymm.substring(4, 6));
  // Use the 1st of the month
  return new Date(year, month - 1, 1);
}

/**
 * Parse a numeric value, returning null for empty/invalid values
 */
function parseNumeric(value: string | undefined): number | null {
  if (!value || value === '' || value === 'null' || value === 'undefined') {
    return null;
  }
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

/**
 * Parse an integer value, returning null for empty/invalid values
 */
function parseInteger(value: string | undefined): number | null {
  const num = parseNumeric(value);
  return num !== null ? Math.round(num) : null;
}

/**
 * Parse CSV content for national data
 */
export function parseNationalCSV(csvContent: string): RealtorNationalRecord[] {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  return records.map((row: any) => ({
    period_date: parseYYYYMM(row.month_date_yyyymm),
    country: row.country || 'United States',
    median_listing_price: parseNumeric(row.median_listing_price),
    median_listing_price_mm: parseNumeric(row.median_listing_price_mm),
    median_listing_price_yy: parseNumeric(row.median_listing_price_yy),
    active_listing_count: parseInteger(row.active_listing_count),
    active_listing_count_mm: parseNumeric(row.active_listing_count_mm),
    active_listing_count_yy: parseNumeric(row.active_listing_count_yy),
    median_days_on_market: parseInteger(row.median_days_on_market),
    median_days_on_market_mm: parseNumeric(row.median_days_on_market_mm),
    median_days_on_market_yy: parseNumeric(row.median_days_on_market_yy),
    new_listing_count: parseInteger(row.new_listing_count),
    new_listing_count_mm: parseNumeric(row.new_listing_count_mm),
    new_listing_count_yy: parseNumeric(row.new_listing_count_yy),
    price_increased_count: parseInteger(row.price_increased_count),
    price_increased_count_mm: parseNumeric(row.price_increased_count_mm),
    price_increased_count_yy: parseNumeric(row.price_increased_count_yy),
    price_increased_share: parseNumeric(row.price_increased_share),
    price_increased_share_mm: parseNumeric(row.price_increased_share_mm),
    price_increased_share_yy: parseNumeric(row.price_increased_share_yy),
    price_reduced_count: parseInteger(row.price_reduced_count),
    price_reduced_count_mm: parseNumeric(row.price_reduced_count_mm),
    price_reduced_count_yy: parseNumeric(row.price_reduced_count_yy),
    price_reduced_share: parseNumeric(row.price_reduced_share),
    price_reduced_share_mm: parseNumeric(row.price_reduced_share_mm),
    price_reduced_share_yy: parseNumeric(row.price_reduced_share_yy),
    pending_listing_count: parseInteger(row.pending_listing_count),
    pending_listing_count_mm: parseNumeric(row.pending_listing_count_mm),
    pending_listing_count_yy: parseNumeric(row.pending_listing_count_yy),
    median_listing_price_per_square_foot: parseNumeric(row.median_listing_price_per_square_foot),
    median_listing_price_per_square_foot_mm: parseNumeric(row.median_listing_price_per_square_foot_mm),
    median_listing_price_per_square_foot_yy: parseNumeric(row.median_listing_price_per_square_foot_yy),
    median_square_feet: parseInteger(row.median_square_feet),
    median_square_feet_mm: parseNumeric(row.median_square_feet_mm),
    median_square_feet_yy: parseNumeric(row.median_square_feet_yy),
    average_listing_price: parseNumeric(row.average_listing_price),
    average_listing_price_mm: parseNumeric(row.average_listing_price_mm),
    average_listing_price_yy: parseNumeric(row.average_listing_price_yy),
    total_listing_count: parseInteger(row.total_listing_count),
    total_listing_count_mm: parseNumeric(row.total_listing_count_mm),
    total_listing_count_yy: parseNumeric(row.total_listing_count_yy),
    pending_ratio: parseNumeric(row.pending_ratio),
    pending_ratio_mm: parseNumeric(row.pending_ratio_mm),
    pending_ratio_yy: parseNumeric(row.pending_ratio_yy),
    quality_flag: parseInteger(row.quality_flag) || 0
  }));
}

/**
 * Import national records to database
 */
export async function importNationalRecords(
  supabase: SupabaseClient,
  records: RealtorNationalRecord[],
  batchSize: number = 100
): Promise<ImportResult> {
  let recordsInserted = 0;
  let recordsUpdated = 0;
  let errors = 0;

  console.log(`  🔄 Importing ${records.length} records...`);

  // Process in batches
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    // Format dates for Supabase
    const formattedBatch = batch.map(record => ({
      ...record,
      period_date: record.period_date.toISOString().split('T')[0]
    }));

    const { error, data } = await supabase
      .from('realtor_national')
      .upsert(formattedBatch, {
        onConflict: 'period_date',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error(`  ❌ Batch error: ${error.message}`);
      errors += batch.length;
    } else {
      recordsInserted += data?.length || 0;
    }

    // Progress update every 500 records
    if ((i + batchSize) % 500 === 0 || i + batchSize >= records.length) {
      console.log(`  📊 Progress: ${Math.min(i + batchSize, records.length)}/${records.length} records`);
    }
  }

  return {
    datasetId: 'realtor-national',
    success: errors === 0,
    recordsInserted,
    recordsUpdated,
    errors
  };
}

/**
 * Parse CSV content for state data
 */
export function parseStateCSV(csvContent: string): RealtorStateRecord[] {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  return records.map((row: any) => ({
    period_date: parseYYYYMM(row.month_date_yyyymm),
    state_name: row.state,
    state_id: row.state_id,
    median_listing_price: parseNumeric(row.median_listing_price),
    median_listing_price_mm: parseNumeric(row.median_listing_price_mm),
    median_listing_price_yy: parseNumeric(row.median_listing_price_yy),
    active_listing_count: parseInteger(row.active_listing_count),
    active_listing_count_mm: parseNumeric(row.active_listing_count_mm),
    active_listing_count_yy: parseNumeric(row.active_listing_count_yy),
    median_days_on_market: parseInteger(row.median_days_on_market),
    median_days_on_market_mm: parseNumeric(row.median_days_on_market_mm),
    median_days_on_market_yy: parseNumeric(row.median_days_on_market_yy),
    new_listing_count: parseInteger(row.new_listing_count),
    new_listing_count_mm: parseNumeric(row.new_listing_count_mm),
    new_listing_count_yy: parseNumeric(row.new_listing_count_yy),
    price_increased_count: parseInteger(row.price_increased_count),
    price_increased_count_mm: parseNumeric(row.price_increased_count_mm),
    price_increased_count_yy: parseNumeric(row.price_increased_count_yy),
    price_increased_share: parseNumeric(row.price_increased_share),
    price_increased_share_mm: parseNumeric(row.price_increased_share_mm),
    price_increased_share_yy: parseNumeric(row.price_increased_share_yy),
    price_reduced_count: parseInteger(row.price_reduced_count),
    price_reduced_count_mm: parseNumeric(row.price_reduced_count_mm),
    price_reduced_count_yy: parseNumeric(row.price_reduced_count_yy),
    price_reduced_share: parseNumeric(row.price_reduced_share),
    price_reduced_share_mm: parseNumeric(row.price_reduced_share_mm),
    price_reduced_share_yy: parseNumeric(row.price_reduced_share_yy),
    pending_listing_count: parseInteger(row.pending_listing_count),
    pending_listing_count_mm: parseNumeric(row.pending_listing_count_mm),
    pending_listing_count_yy: parseNumeric(row.pending_listing_count_yy),
    median_listing_price_per_square_foot: parseNumeric(row.median_listing_price_per_square_foot),
    median_listing_price_per_square_foot_mm: parseNumeric(row.median_listing_price_per_square_foot_mm),
    median_listing_price_per_square_foot_yy: parseNumeric(row.median_listing_price_per_square_foot_yy),
    median_square_feet: parseInteger(row.median_square_feet),
    median_square_feet_mm: parseNumeric(row.median_square_feet_mm),
    median_square_feet_yy: parseNumeric(row.median_square_feet_yy),
    average_listing_price: parseNumeric(row.average_listing_price),
    average_listing_price_mm: parseNumeric(row.average_listing_price_mm),
    average_listing_price_yy: parseNumeric(row.average_listing_price_yy),
    total_listing_count: parseInteger(row.total_listing_count),
    total_listing_count_mm: parseNumeric(row.total_listing_count_mm),
    total_listing_count_yy: parseNumeric(row.total_listing_count_yy),
    pending_ratio: parseNumeric(row.pending_ratio),
    pending_ratio_mm: parseNumeric(row.pending_ratio_mm),
    pending_ratio_yy: parseNumeric(row.pending_ratio_yy),
    quality_flag: parseInteger(row.quality_flag) || 0
  }));
}

/**
 * Import state records to database
 */
export async function importStateRecords(
  supabase: SupabaseClient,
  records: RealtorStateRecord[],
  batchSize: number = 100
): Promise<ImportResult> {
  let recordsInserted = 0;
  let recordsUpdated = 0;
  let errors = 0;

  console.log(`  🔄 Importing ${records.length} records...`);

  // Process in batches
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    // Format dates for Supabase
    const formattedBatch = batch.map(record => ({
      ...record,
      period_date: record.period_date.toISOString().split('T')[0]
    }));

    const { error, data } = await supabase
      .from('realtor_state')
      .upsert(formattedBatch, {
        onConflict: 'period_date,state_id',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error(`  ❌ Batch error: ${error.message}`);
      errors += batch.length;
    } else {
      recordsInserted += data?.length || 0;
    }

    // Progress update every 1000 records
    if ((i + batchSize) % 1000 === 0 || i + batchSize >= records.length) {
      console.log(`  📊 Progress: ${Math.min(i + batchSize, records.length)}/${records.length} records`);
    }
  }

  return {
    datasetId: 'realtor-state',
    success: errors === 0,
    recordsInserted,
    recordsUpdated,
    errors
  };
}

// ============================================================================
// METRO PARSING AND IMPORT
// ============================================================================

/**
 * Parse CSV content for metro core data
 */
export function parseMetroCoreCSV(csvContent: string): RealtorCombinedRecord[] {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  return records.map((row: any) => ({
    period_date: parseYYYYMM(row.month_date_yyyymm),
    cbsa_code: row.cbsa_code,
    cbsa_title: row.cbsa_title,
    household_rank: parseInteger(row.HouseholdRank),
    median_listing_price: parseNumeric(row.median_listing_price),
    median_listing_price_mm: parseNumeric(row.median_listing_price_mm),
    median_listing_price_yy: parseNumeric(row.median_listing_price_yy),
    active_listing_count: parseInteger(row.active_listing_count),
    active_listing_count_mm: parseNumeric(row.active_listing_count_mm),
    active_listing_count_yy: parseNumeric(row.active_listing_count_yy),
    median_days_on_market: parseInteger(row.median_days_on_market),
    median_days_on_market_mm: parseNumeric(row.median_days_on_market_mm),
    median_days_on_market_yy: parseNumeric(row.median_days_on_market_yy),
    new_listing_count: parseInteger(row.new_listing_count),
    new_listing_count_mm: parseNumeric(row.new_listing_count_mm),
    new_listing_count_yy: parseNumeric(row.new_listing_count_yy),
    price_increased_count: parseInteger(row.price_increased_count),
    price_increased_count_mm: parseNumeric(row.price_increased_count_mm),
    price_increased_count_yy: parseNumeric(row.price_increased_count_yy),
    price_increased_share: parseNumeric(row.price_increased_share),
    price_increased_share_mm: parseNumeric(row.price_increased_share_mm),
    price_increased_share_yy: parseNumeric(row.price_increased_share_yy),
    price_reduced_count: parseInteger(row.price_reduced_count),
    price_reduced_count_mm: parseNumeric(row.price_reduced_count_mm),
    price_reduced_count_yy: parseNumeric(row.price_reduced_count_yy),
    price_reduced_share: parseNumeric(row.price_reduced_share),
    price_reduced_share_mm: parseNumeric(row.price_reduced_share_mm),
    price_reduced_share_yy: parseNumeric(row.price_reduced_share_yy),
    pending_listing_count: parseInteger(row.pending_listing_count),
    pending_listing_count_mm: parseNumeric(row.pending_listing_count_mm),
    pending_listing_count_yy: parseNumeric(row.pending_listing_count_yy),
    median_listing_price_per_square_foot: parseNumeric(row.median_listing_price_per_square_foot),
    median_listing_price_per_square_foot_mm: parseNumeric(row.median_listing_price_per_square_foot_mm),
    median_listing_price_per_square_foot_yy: parseNumeric(row.median_listing_price_per_square_foot_yy),
    median_square_feet: parseInteger(row.median_square_feet),
    median_square_feet_mm: parseNumeric(row.median_square_feet_mm),
    median_square_feet_yy: parseNumeric(row.median_square_feet_yy),
    average_listing_price: parseNumeric(row.average_listing_price),
    average_listing_price_mm: parseNumeric(row.average_listing_price_mm),
    average_listing_price_yy: parseNumeric(row.average_listing_price_yy),
    total_listing_count: parseInteger(row.total_listing_count),
    total_listing_count_mm: parseNumeric(row.total_listing_count_mm),
    total_listing_count_yy: parseNumeric(row.total_listing_count_yy),
    pending_ratio: parseNumeric(row.pending_ratio),
    pending_ratio_mm: parseNumeric(row.pending_ratio_mm),
    pending_ratio_yy: parseNumeric(row.pending_ratio_yy),
    quality_flag: parseInteger(row.quality_flag) || 0
  }));
}

/**
 * Parse CSV content for metro hotness data
 */
export function parseMetroHotnessCSV(csvContent: string): Map<string, Partial<RealtorCombinedRecord>> {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  const hotnessMap = new Map<string, Partial<RealtorCombinedRecord>>();

  for (const row of records) {
    const key = `${row.month_date_yyyymm}_${row.cbsa_code}`;
    hotnessMap.set(key, {
      hotness_rank: parseInteger(row.hotness_rank),
      hotness_rank_mm: parseNumeric(row.hotness_rank_mm),
      hotness_rank_yy: parseNumeric(row.hotness_rank_yy),
      hotness_score: parseNumeric(row.hotness_score),
      supply_score: parseNumeric(row.supply_score),
      demand_score: parseNumeric(row.demand_score),
      median_dom_vs_us: parseNumeric(row.median_dom_vs_us),
      median_listing_price_vs_us: parseNumeric(row.median_listing_price_vs_us),
      page_view_count_per_property_mm: parseNumeric(row.page_view_count_per_property_mm),
      page_view_count_per_property_yy: parseNumeric(row.page_view_count_per_property_yy),
      page_view_count_per_property_vs_us: parseNumeric(row.page_view_count_per_property_vs_us)
    });
  }

  return hotnessMap;
}

/**
 * Merge core and hotness data for metro
 */
export function mergeMetroData(
  coreRecords: RealtorCombinedRecord[],
  hotnessMap: Map<string, Partial<RealtorCombinedRecord>>
): RealtorCombinedRecord[] {
  return coreRecords.map(record => {
    const dateStr = record.period_date.getFullYear().toString() +
      (record.period_date.getMonth() + 1).toString().padStart(2, '0');
    const key = `${dateStr}_${record.cbsa_code}`;
    const hotness = hotnessMap.get(key);

    if (hotness) {
      return { ...record, ...hotness };
    }
    return record;
  });
}

/**
 * Import metro records to database
 */
export async function importMetroRecords(
  supabase: SupabaseClient,
  records: RealtorCombinedRecord[],
  batchSize: number = 100
): Promise<ImportResult> {
  let recordsInserted = 0;
  let errors = 0;

  console.log(`  🔄 Importing ${records.length} records...`);

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    const formattedBatch = batch.map(record => ({
      ...record,
      period_date: record.period_date.toISOString().split('T')[0]
    }));

    const { error, data } = await supabase
      .from('realtor_metro')
      .upsert(formattedBatch, {
        onConflict: 'period_date,cbsa_code',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error(`  ❌ Batch error: ${error.message}`);
      errors += batch.length;
    } else {
      recordsInserted += data?.length || 0;
    }

    if ((i + batchSize) % 5000 === 0 || i + batchSize >= records.length) {
      console.log(`  📊 Progress: ${Math.min(i + batchSize, records.length)}/${records.length} records`);
    }
  }

  return {
    datasetId: 'realtor-metro',
    success: errors === 0,
    recordsInserted,
    recordsUpdated: 0,
    errors
  };
}

// ============================================================================
// COUNTY PARSING AND IMPORT
// ============================================================================

/**
 * Parse CSV content for county core data
 */
export function parseCountyCoreCSV(csvContent: string): RealtorCombinedRecord[] {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  return records.map((row: any) => ({
    period_date: parseYYYYMM(row.month_date_yyyymm),
    county_fips: row.county_fips,
    county_name: row.county_name,
    median_listing_price: parseNumeric(row.median_listing_price),
    median_listing_price_mm: parseNumeric(row.median_listing_price_mm),
    median_listing_price_yy: parseNumeric(row.median_listing_price_yy),
    active_listing_count: parseInteger(row.active_listing_count),
    active_listing_count_mm: parseNumeric(row.active_listing_count_mm),
    active_listing_count_yy: parseNumeric(row.active_listing_count_yy),
    median_days_on_market: parseInteger(row.median_days_on_market),
    median_days_on_market_mm: parseNumeric(row.median_days_on_market_mm),
    median_days_on_market_yy: parseNumeric(row.median_days_on_market_yy),
    new_listing_count: parseInteger(row.new_listing_count),
    new_listing_count_mm: parseNumeric(row.new_listing_count_mm),
    new_listing_count_yy: parseNumeric(row.new_listing_count_yy),
    price_increased_count: parseInteger(row.price_increased_count),
    price_increased_count_mm: parseNumeric(row.price_increased_count_mm),
    price_increased_count_yy: parseNumeric(row.price_increased_count_yy),
    price_increased_share: parseNumeric(row.price_increased_share),
    price_increased_share_mm: parseNumeric(row.price_increased_share_mm),
    price_increased_share_yy: parseNumeric(row.price_increased_share_yy),
    price_reduced_count: parseInteger(row.price_reduced_count),
    price_reduced_count_mm: parseNumeric(row.price_reduced_count_mm),
    price_reduced_count_yy: parseNumeric(row.price_reduced_count_yy),
    price_reduced_share: parseNumeric(row.price_reduced_share),
    price_reduced_share_mm: parseNumeric(row.price_reduced_share_mm),
    price_reduced_share_yy: parseNumeric(row.price_reduced_share_yy),
    pending_listing_count: parseInteger(row.pending_listing_count),
    pending_listing_count_mm: parseNumeric(row.pending_listing_count_mm),
    pending_listing_count_yy: parseNumeric(row.pending_listing_count_yy),
    median_listing_price_per_square_foot: parseNumeric(row.median_listing_price_per_square_foot),
    median_listing_price_per_square_foot_mm: parseNumeric(row.median_listing_price_per_square_foot_mm),
    median_listing_price_per_square_foot_yy: parseNumeric(row.median_listing_price_per_square_foot_yy),
    median_square_feet: parseInteger(row.median_square_feet),
    median_square_feet_mm: parseNumeric(row.median_square_feet_mm),
    median_square_feet_yy: parseNumeric(row.median_square_feet_yy),
    average_listing_price: parseNumeric(row.average_listing_price),
    average_listing_price_mm: parseNumeric(row.average_listing_price_mm),
    average_listing_price_yy: parseNumeric(row.average_listing_price_yy),
    total_listing_count: parseInteger(row.total_listing_count),
    total_listing_count_mm: parseNumeric(row.total_listing_count_mm),
    total_listing_count_yy: parseNumeric(row.total_listing_count_yy),
    pending_ratio: parseNumeric(row.pending_ratio),
    pending_ratio_mm: parseNumeric(row.pending_ratio_mm),
    pending_ratio_yy: parseNumeric(row.pending_ratio_yy),
    quality_flag: parseInteger(row.quality_flag) || 0
  }));
}

/**
 * Parse CSV content for county hotness data
 */
export function parseCountyHotnessCSV(csvContent: string): Map<string, Partial<RealtorCombinedRecord>> {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  const hotnessMap = new Map<string, Partial<RealtorCombinedRecord>>();

  for (const row of records) {
    const key = `${row.month_date_yyyymm}_${row.county_fips}`;
    hotnessMap.set(key, {
      cbsa_code: row.cbsa_code,
      cbsa_title: row.cbsa_title,
      household_rank: parseInteger(row.hh_rank),
      hotness_rank: parseInteger(row.hotness_rank),
      hotness_rank_mm: parseNumeric(row.hotness_rank_mm),
      hotness_rank_yy: parseNumeric(row.hotness_rank_yy),
      hotness_score: parseNumeric(row.hotness_score),
      supply_score: parseNumeric(row.supply_score),
      demand_score: parseNumeric(row.demand_score),
      median_dom_vs_us: parseNumeric(row.median_dom_vs_us),
      median_listing_price_vs_us: parseNumeric(row.median_listing_price_vs_us),
      page_view_count_per_property_mm: parseNumeric(row.page_view_count_per_property_mm),
      page_view_count_per_property_yy: parseNumeric(row.page_view_count_per_property_yy),
      page_view_count_per_property_vs_us: parseNumeric(row.page_view_count_per_property_vs_us)
    });
  }

  return hotnessMap;
}

/**
 * Merge core and hotness data for county
 */
export function mergeCountyData(
  coreRecords: RealtorCombinedRecord[],
  hotnessMap: Map<string, Partial<RealtorCombinedRecord>>
): RealtorCombinedRecord[] {
  return coreRecords.map(record => {
    const dateStr = record.period_date.getFullYear().toString() +
      (record.period_date.getMonth() + 1).toString().padStart(2, '0');
    const key = `${dateStr}_${record.county_fips}`;
    const hotness = hotnessMap.get(key);

    if (hotness) {
      return { ...record, ...hotness };
    }
    return record;
  });
}

/**
 * Import county records to database
 */
export async function importCountyRecords(
  supabase: SupabaseClient,
  records: RealtorCombinedRecord[],
  batchSize: number = 100
): Promise<ImportResult> {
  let recordsInserted = 0;
  let errors = 0;

  console.log(`  🔄 Importing ${records.length} records...`);

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    const formattedBatch = batch.map(record => ({
      ...record,
      period_date: record.period_date.toISOString().split('T')[0]
    }));

    const { error, data } = await supabase
      .from('realtor_county')
      .upsert(formattedBatch, {
        onConflict: 'period_date,county_fips',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error(`  ❌ Batch error: ${error.message}`);
      errors += batch.length;
    } else {
      recordsInserted += data?.length || 0;
    }

    if ((i + batchSize) % 10000 === 0 || i + batchSize >= records.length) {
      console.log(`  📊 Progress: ${Math.min(i + batchSize, records.length)}/${records.length} records`);
    }
  }

  return {
    datasetId: 'realtor-county',
    success: errors === 0,
    recordsInserted,
    recordsUpdated: 0,
    errors
  };
}

// ============================================================================
// ZIP PARSING AND IMPORT
// ============================================================================

/**
 * Parse CSV content for zip core data
 */
export function parseZipCoreCSV(csvContent: string): RealtorCombinedRecord[] {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  return records.map((row: any) => ({
    period_date: parseYYYYMM(row.month_date_yyyymm),
    postal_code: row.postal_code,
    zip_name: row.zip_name,
    median_listing_price: parseNumeric(row.median_listing_price),
    median_listing_price_mm: parseNumeric(row.median_listing_price_mm),
    median_listing_price_yy: parseNumeric(row.median_listing_price_yy),
    active_listing_count: parseInteger(row.active_listing_count),
    active_listing_count_mm: parseNumeric(row.active_listing_count_mm),
    active_listing_count_yy: parseNumeric(row.active_listing_count_yy),
    median_days_on_market: parseInteger(row.median_days_on_market),
    median_days_on_market_mm: parseNumeric(row.median_days_on_market_mm),
    median_days_on_market_yy: parseNumeric(row.median_days_on_market_yy),
    new_listing_count: parseInteger(row.new_listing_count),
    new_listing_count_mm: parseNumeric(row.new_listing_count_mm),
    new_listing_count_yy: parseNumeric(row.new_listing_count_yy),
    price_increased_count: parseInteger(row.price_increased_count),
    price_increased_count_mm: parseNumeric(row.price_increased_count_mm),
    price_increased_count_yy: parseNumeric(row.price_increased_count_yy),
    price_increased_share: parseNumeric(row.price_increased_share),
    price_increased_share_mm: parseNumeric(row.price_increased_share_mm),
    price_increased_share_yy: parseNumeric(row.price_increased_share_yy),
    price_reduced_count: parseInteger(row.price_reduced_count),
    price_reduced_count_mm: parseNumeric(row.price_reduced_count_mm),
    price_reduced_count_yy: parseNumeric(row.price_reduced_count_yy),
    price_reduced_share: parseNumeric(row.price_reduced_share),
    price_reduced_share_mm: parseNumeric(row.price_reduced_share_mm),
    price_reduced_share_yy: parseNumeric(row.price_reduced_share_yy),
    pending_listing_count: parseInteger(row.pending_listing_count),
    pending_listing_count_mm: parseNumeric(row.pending_listing_count_mm),
    pending_listing_count_yy: parseNumeric(row.pending_listing_count_yy),
    median_listing_price_per_square_foot: parseNumeric(row.median_listing_price_per_square_foot),
    median_listing_price_per_square_foot_mm: parseNumeric(row.median_listing_price_per_square_foot_mm),
    median_listing_price_per_square_foot_yy: parseNumeric(row.median_listing_price_per_square_foot_yy),
    median_square_feet: parseInteger(row.median_square_feet),
    median_square_feet_mm: parseNumeric(row.median_square_feet_mm),
    median_square_feet_yy: parseNumeric(row.median_square_feet_yy),
    average_listing_price: parseNumeric(row.average_listing_price),
    average_listing_price_mm: parseNumeric(row.average_listing_price_mm),
    average_listing_price_yy: parseNumeric(row.average_listing_price_yy),
    total_listing_count: parseInteger(row.total_listing_count),
    total_listing_count_mm: parseNumeric(row.total_listing_count_mm),
    total_listing_count_yy: parseNumeric(row.total_listing_count_yy),
    pending_ratio: parseNumeric(row.pending_ratio),
    pending_ratio_mm: parseNumeric(row.pending_ratio_mm),
    pending_ratio_yy: parseNumeric(row.pending_ratio_yy),
    quality_flag: parseInteger(row.quality_flag) || 0
  }));
}

/**
 * Parse CSV content for zip hotness data
 */
export function parseZipHotnessCSV(csvContent: string): Map<string, Partial<RealtorCombinedRecord>> {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  const hotnessMap = new Map<string, Partial<RealtorCombinedRecord>>();

  for (const row of records) {
    const key = `${row.month_date_yyyymm}_${row.postal_code}`;
    hotnessMap.set(key, {
      household_rank: parseInteger(row.hh_rank),
      hotness_rank: parseInteger(row.hotness_rank),
      hotness_rank_mm: parseNumeric(row.hotness_rank_mm),
      hotness_rank_yy: parseNumeric(row.hotness_rank_yy),
      hotness_score: parseNumeric(row.hotness_score),
      supply_score: parseNumeric(row.supply_score),
      demand_score: parseNumeric(row.demand_score),
      median_dom_vs_us: parseNumeric(row.median_dom_vs_us),
      median_listing_price_vs_us: parseNumeric(row.median_listing_price_vs_us),
      page_view_count_per_property_mm: parseNumeric(row.page_view_count_per_property_mm),
      page_view_count_per_property_yy: parseNumeric(row.page_view_count_per_property_yy),
      page_view_count_per_property_vs_us: parseNumeric(row.page_view_count_per_property_vs_us)
    });
  }

  return hotnessMap;
}

/**
 * Merge core and hotness data for zip
 */
export function mergeZipData(
  coreRecords: RealtorCombinedRecord[],
  hotnessMap: Map<string, Partial<RealtorCombinedRecord>>
): RealtorCombinedRecord[] {
  return coreRecords.map(record => {
    const dateStr = record.period_date.getFullYear().toString() +
      (record.period_date.getMonth() + 1).toString().padStart(2, '0');
    const key = `${dateStr}_${record.postal_code}`;
    const hotness = hotnessMap.get(key);

    if (hotness) {
      return { ...record, ...hotness };
    }
    return record;
  });
}

/**
 * Import zip records to database
 */
export async function importZipRecords(
  supabase: SupabaseClient,
  records: RealtorCombinedRecord[],
  batchSize: number = 100
): Promise<ImportResult> {
  let recordsInserted = 0;
  let errors = 0;

  console.log(`  🔄 Importing ${records.length} records...`);

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    const formattedBatch = batch.map(record => ({
      ...record,
      period_date: record.period_date.toISOString().split('T')[0]
    }));

    const { error, data } = await supabase
      .from('realtor_zip')
      .upsert(formattedBatch, {
        onConflict: 'period_date,postal_code',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error(`  ❌ Batch error: ${error.message}`);
      errors += batch.length;
    } else {
      recordsInserted += data?.length || 0;
    }

    if ((i + batchSize) % 50000 === 0 || i + batchSize >= records.length) {
      console.log(`  📊 Progress: ${Math.min(i + batchSize, records.length)}/${records.length} records`);
    }
  }

  return {
    datasetId: 'realtor-zip',
    success: errors === 0,
    recordsInserted,
    recordsUpdated: 0,
    errors
  };
}
