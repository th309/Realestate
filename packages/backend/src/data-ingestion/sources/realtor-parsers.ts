/**
 * Realtor.com CSV parsers and field mappers.
 *
 * Extracted from RealtorService to keep the service file under the 300-line
 * limit. Pure functions — no Supabase, no logging, no side effects.
 */

import { parse } from 'csv-parse/sync';
import { normalizeZipKey } from '../../common/zip';
import type {
  RealtorNationalRecord,
  RealtorStateRecord,
  RealtorCombinedRecord,
} from '../types/realtor.types';

function parseYYYYMM(yyyymm: string): Date {
  const year = parseInt(yyyymm.substring(0, 4));
  const month = parseInt(yyyymm.substring(4, 6));
  return new Date(year, month - 1, 1);
}

function parseNumeric(value: string | undefined): number | null {
  if (!value || value === '' || value === 'null' || value === 'undefined')
    return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

function parseInteger(value: string | undefined): number | null {
  const num = parseNumeric(value);
  return num !== null ? Math.round(num) : null;
}

function mapCommonFields(row: any) {
  return {
    period_date: parseYYYYMM(row.month_date_yyyymm),
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
    median_listing_price_per_square_foot: parseNumeric(
      row.median_listing_price_per_square_foot,
    ),
    median_listing_price_per_square_foot_mm: parseNumeric(
      row.median_listing_price_per_square_foot_mm,
    ),
    median_listing_price_per_square_foot_yy: parseNumeric(
      row.median_listing_price_per_square_foot_yy,
    ),
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
    quality_flag: parseInteger(row.quality_flag) || 0,
  };
}

function mapNationalRecord(row: any): RealtorNationalRecord {
  return {
    period_date: parseYYYYMM(row.month_date_yyyymm),
    country: row.country || 'United States',
    ...(mapCommonFields(row) as any),
  };
}

function mapStateRecord(row: any): RealtorStateRecord {
  return {
    period_date: parseYYYYMM(row.month_date_yyyymm),
    state_name: row.state,
    state_id: row.state_id,
    ...(mapCommonFields(row) as any),
  };
}

function parseCsvRows(csvContent: string): any[] {
  return parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

export function parseNationalCSV(csvContent: string): RealtorNationalRecord[] {
  return parseCsvRows(csvContent).map(mapNationalRecord);
}

export function parseStateCSV(csvContent: string): RealtorStateRecord[] {
  return parseCsvRows(csvContent).map(mapStateRecord);
}

export function parseMetroCoreCSV(csvContent: string): RealtorCombinedRecord[] {
  return parseCsvRows(csvContent).map((row: any) => ({
    ...mapCommonFields(row),
    cbsa_code: row.cbsa_code,
    cbsa_title: row.cbsa_title,
    household_rank: parseInteger(row.HouseholdRank),
  }));
}

export function parseCountyCoreCSV(
  csvContent: string,
): RealtorCombinedRecord[] {
  return parseCsvRows(csvContent).map((row: any) => ({
    ...mapCommonFields(row),
    county_fips: row.county_fips,
    county_name: row.county_name,
  }));
}

export function parseZipCoreCSV(csvContent: string): RealtorCombinedRecord[] {
  return parseCsvRows(csvContent).map((row: any) => ({
    ...mapCommonFields(row),
    postal_code: row.postal_code
      ? normalizeZipKey(String(row.postal_code))
      : row.postal_code,
    zip_name: row.zip_name,
  }));
}

export function parseHotnessData(
  csvContent: string,
  geography: string,
): Map<string, Partial<RealtorCombinedRecord>> {
  const records = parseCsvRows(csvContent);
  const map = new Map<string, Partial<RealtorCombinedRecord>>();

  for (const row of records) {
    let id = '';
    if (geography === 'metro') id = row.cbsa_code;
    else if (geography === 'county') id = row.county_fips;
    else if (geography === 'zip')
      id = row.postal_code
        ? normalizeZipKey(String(row.postal_code))
        : row.postal_code;

    if (!id) continue;

    const key = `${row.month_date_yyyymm}_${id}`;

    map.set(key, {
      household_rank:
        parseInteger(row.hh_rank) || parseInteger(row.household_rank),
      hotness_rank: parseInteger(row.hotness_rank),
      hotness_rank_mm: parseNumeric(row.hotness_rank_mm),
      hotness_rank_yy: parseNumeric(row.hotness_rank_yy),
      hotness_score: parseNumeric(row.hotness_score),
      supply_score: parseNumeric(row.supply_score),
      demand_score: parseNumeric(row.demand_score),
      median_dom_vs_us: parseNumeric(row.median_dom_vs_us),
      median_listing_price_vs_us: parseNumeric(row.median_listing_price_vs_us),
      page_view_count_per_property_mm: parseNumeric(
        row.page_view_count_per_property_mm,
      ),
      page_view_count_per_property_yy: parseNumeric(
        row.page_view_count_per_property_yy,
      ),
      page_view_count_per_property_vs_us: parseNumeric(
        row.page_view_count_per_property_vs_us,
      ),
    });
  }
  return map;
}

export function mergeHotnessData(
  coreRecords: RealtorCombinedRecord[],
  hotnessMap: Map<string, Partial<RealtorCombinedRecord>>,
  idField: keyof RealtorCombinedRecord,
): RealtorCombinedRecord[] {
  return coreRecords.map((record) => {
    const date = record.period_date;
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const dateStr = `${year}${month.toString().padStart(2, '0')}`;
    const id = record[idField] as string;
    const key = `${dateStr}_${id}`;

    const hotness = hotnessMap.get(key);
    return hotness ? { ...record, ...hotness } : record;
  });
}
