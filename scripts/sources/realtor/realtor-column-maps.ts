/**
 * Column mapping functions for Realtor.com CSV data.
 *
 * Maps raw CSV rows from core listing data and hotness data into
 * database-ready records. Handles all 5 geography levels:
 * national, state, metro (core), county (core), zip (core).
 *
 * Also provides hotness field extraction and core+hotness merge logic
 * for metro/county/zip levels that require combining two CSV sources.
 */

import {
  parseNumeric,
  parseInteger,
  parseYearMonth,
  normalizeZipCode,
} from '../../lib';
import type { ColumnMapFn } from '../../lib';

// ---------------------------------------------------------------------------
// Shared: core listing metrics common to ALL geography levels
// ---------------------------------------------------------------------------

/** Map the core listing metrics shared across all Realtor.com CSVs. */
function mapCoreListingColumns(row: Record<string, string>): Record<string, unknown> {
  return {
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
    quality_flag: parseInteger(row.quality_flag) ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Per-geography column map functions (core data)
// ---------------------------------------------------------------------------

export const mapNationalRow: ColumnMapFn = (row) => {
  const periodDate = parseYearMonth(row.month_date_yyyymm);
  if (!periodDate) return null;

  return {
    period_date: periodDate,
    country: row.country || 'United States',
    ...mapCoreListingColumns(row),
  };
};

export const mapStateRow: ColumnMapFn = (row) => {
  const periodDate = parseYearMonth(row.month_date_yyyymm);
  if (!periodDate || !row.state_id) return null;

  return {
    period_date: periodDate,
    state_name: row.state,
    state_id: row.state_id,
    ...mapCoreListingColumns(row),
  };
};

export const mapMetroCoreRow: ColumnMapFn = (row) => {
  const periodDate = parseYearMonth(row.month_date_yyyymm);
  if (!periodDate || !row.cbsa_code) return null;

  return {
    period_date: periodDate,
    cbsa_code: row.cbsa_code,
    cbsa_title: row.cbsa_title,
    household_rank: parseInteger(row.HouseholdRank),
    ...mapCoreListingColumns(row),
  };
};

export const mapCountyCoreRow: ColumnMapFn = (row) => {
  const periodDate = parseYearMonth(row.month_date_yyyymm);
  if (!periodDate || !row.county_fips) return null;

  return {
    period_date: periodDate,
    county_fips: row.county_fips,
    county_name: row.county_name,
    ...mapCoreListingColumns(row),
  };
};

export const mapZipCoreRow: ColumnMapFn = (row) => {
  const periodDate = parseYearMonth(row.month_date_yyyymm);
  const postalCode = row.postal_code ? normalizeZipCode(row.postal_code) : null;
  if (!periodDate || !postalCode) return null;

  return {
    period_date: periodDate,
    postal_code: postalCode,
    zip_name: row.zip_name,
    ...mapCoreListingColumns(row),
  };
};

// ---------------------------------------------------------------------------
// Hotness column mapping (metro/county/zip share the same hotness fields)
// ---------------------------------------------------------------------------

/** Extract hotness fields from a hotness CSV row. */
function mapHotnessFields(row: Record<string, string>): Record<string, unknown> {
  return {
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
    page_view_count_per_property_vs_us: parseNumeric(row.page_view_count_per_property_vs_us),
  };
}

/** Extra hotness fields only present in county/zip hotness CSVs (`hh_rank`, parent metro). */
function mapCountyZipHotnessExtras(row: Record<string, string>): Record<string, unknown> {
  return {
    household_rank: parseInteger(row.hh_rank),
    ...(row.cbsa_code ? { cbsa_code: row.cbsa_code } : {}),
    ...(row.cbsa_title ? { cbsa_title: row.cbsa_title } : {}),
  };
}

// ---------------------------------------------------------------------------
// Merge logic: build a Map from hotness rows, then merge onto core records
// ---------------------------------------------------------------------------

/**
 * Build a lookup map from raw hotness CSV rows, keyed by `{yyyymm}_{regionId}`.
 *
 * @param hotnessRows - Raw rows from the hotness CSV file.
 * @param regionKeyField - CSV column name for the region identifier (cbsa_code, county_fips, postal_code).
 * @param includeExtras - Whether to include county/zip-specific fields (hh_rank, parent metro).
 */
export function buildHotnessMap(
  hotnessRows: Record<string, string>[],
  regionKeyField: string,
  includeExtras: boolean,
): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();

  for (const row of hotnessRows) {
    let regionId = row[regionKeyField];
    if (regionKeyField === 'postal_code' && regionId) {
      regionId = normalizeZipCode(regionId) ?? regionId;
    }
    const key = `${row.month_date_yyyymm}_${regionId}`;
    const fields = {
      ...mapHotnessFields(row),
      ...(includeExtras ? mapCountyZipHotnessExtras(row) : {}),
    };
    map.set(key, fields);
  }

  return map;
}

/**
 * Merge hotness data into already-mapped core records.
 *
 * Reconstructs the YYYYMM key from the core record's `period_date` (YYYY-MM-01 string)
 * and the region ID field, then looks up and spreads hotness fields from the map.
 */
export function mergeCoreAndHotness(
  coreRecords: Record<string, unknown>[],
  hotnessMap: Map<string, Record<string, unknown>>,
  regionKeyField: string,
): Record<string, unknown>[] {
  return coreRecords.map((record) => {
    const dateStr = record.period_date as string;
    const yyyymm = dateStr.replace(/-/g, '').substring(0, 6);
    const regionId = record[regionKeyField] as string;
    const key = `${yyyymm}_${regionId}`;
    const hotness = hotnessMap.get(key);

    return hotness ? { ...record, ...hotness } : record;
  });
}
