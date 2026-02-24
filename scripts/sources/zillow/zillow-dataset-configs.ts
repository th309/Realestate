/**
 * Zillow dataset definitions: URLs, metric names, and geography levels.
 *
 * Each entry defines one downloadable CSV file from Zillow's public research data.
 * A single CSV covers one metric for one geography level (state, metro, county, zip).
 * All CSVs use Zillow's WIDE format: date columns as headers, one row per region.
 *
 * The `metricName` field maps to the `metric_name` column in the DB.
 * The `datasetType` is the Zillow-internal identifier used in URLs.
 */

// Base URL for all Zillow public research CSV files
const CSV_BASE = 'https://files.zillowstatic.com/research/public_csvs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ZillowGeography = 'state' | 'metro' | 'county' | 'zip';

export interface ZillowDatasetConfig {
  /** Unique identifier for this dataset (used in logging). */
  id: string;
  /** Zillow dataset type slug (used in URL path). */
  datasetType: string;
  /** Standardized metric name stored in the DB `metric_name` column. */
  metricName: string;
  /** Geography level. */
  geography: ZillowGeography;
  /** Full download URL. */
  url: string;
  /** Human-readable description for logging. */
  description: string;
  /**
   * When true, zero values are treated as real data and inserted.
   * When false (default), zero values are skipped because Zillow uses zero
   * to represent missing data in inventory, sales count, and similar datasets.
   * Only set to true for metrics where zero is a meaningful value (e.g. market_heat).
   */
  allowZeroValues?: boolean;
}

// ---------------------------------------------------------------------------
// URL builders
// ---------------------------------------------------------------------------

/** Geography prefix in Zillow CSV filenames. */
const GEO_PREFIX: Record<ZillowGeography, string> = {
  state: 'State',
  metro: 'Metro',
  county: 'County',
  zip: 'Zip',
};

/**
 * Build a standard Zillow CSV download URL.
 * Most Zillow datasets follow a consistent naming convention.
 */
function buildUrl(
  datasetType: string,
  geography: ZillowGeography,
  filename: string,
): string {
  return `${CSV_BASE}/${datasetType}/${GEO_PREFIX[geography]}_${filename}.csv`;
}

/**
 * Create dataset configs for all 4 geography levels for a given metric.
 * Pass a custom `geos` array to limit to specific levels.
 */
function createMultiGeoDatasets(
  idBase: string,
  datasetType: string,
  metricName: string,
  filename: string,
  description: string,
  geos: ZillowGeography[] = ['state', 'metro', 'county', 'zip'],
): ZillowDatasetConfig[] {
  return geos.map((geo) => ({
    id: `${idBase}-${geo}`,
    datasetType,
    metricName,
    geography: geo,
    url: buildUrl(datasetType, geo, filename),
    description: `${description} (${geo})`,
  }));
}

// ---------------------------------------------------------------------------
// Dataset definitions (grouped by category)
// ---------------------------------------------------------------------------

// Home Values (ZHVI) - Typical home value, smoothed, seasonally adjusted
const zhviDatasets = createMultiGeoDatasets(
  'zhvi', 'zhvi', 'zhvi',
  'zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month',
  'ZHVI All Homes (SFR+Condo), Middle Tier',
);

// Rentals (ZORI) - Observed rent index, smoothed
// Zillow publishes ZORI for metro, county, and zip only (not state)
const zoriDatasets = createMultiGeoDatasets(
  'zori', 'zori', 'zori',
  'zori_uc_sfrcondomfr_sm_sa_month',
  'ZORI All Homes (SFR+Condo+MFR)',
  ['metro', 'county', 'zip'],
);

// For-Sale Inventory
const inventoryDatasets = createMultiGeoDatasets(
  'inventory', 'invt_fs', 'inventory',
  'invt_fs_uc_sfrcondo_sm_month',
  'For-Sale Inventory (SFR+Condo)',
);

// New Listings
const newListingsDatasets = createMultiGeoDatasets(
  'new-listings', 'new_listings', 'new_listings',
  'new_listings_uc_sfrcondo_sm_month',
  'New Listings (SFR+Condo)',
);

// Sales Count — Zillow only publishes at metro level
const salesCountDatasets = createMultiGeoDatasets(
  'sales-count', 'sales_count_now', 'sales_count',
  'sales_count_now_uc_sfrcondo_month',
  'Sales Count (SFR+Condo)',
  ['metro'],
);

// Median Sale Price
const medianSalePriceDatasets = createMultiGeoDatasets(
  'median-sale-price', 'median_sale_price', 'sale_price',
  'median_sale_price_uc_sfrcondo_month',
  'Median Sale Price (SFR+Condo)',
);

// Days to Pending (Mean Days on Zillow to Pending)
const daysToPendingDatasets = createMultiGeoDatasets(
  'days-to-pending', 'mean_doz_pending', 'dom',
  'mean_doz_pending_uc_sfrcondo_sm_month',
  'Mean Days to Pending (SFR+Condo)',
);

// Market Heat Index (metro only -- state/county/zip do not have this metric)
// allowZeroValues: true because the market heat index legitimately equals zero
// for a perfectly balanced market, unlike inventory/sales where zero means no data.
const marketHeatDatasets = createMultiGeoDatasets(
  'market-heat', 'market_temp_index', 'market_heat',
  'market_temp_index_uc_sfrcondo_month',
  'Market Heat Index (SFR+Condo)',
  ['metro'],
).map((d) => ({ ...d, allowZeroValues: true }));

// New Construction - Sales Count
const newConSalesDatasets = createMultiGeoDatasets(
  'new-con-sales', 'new_con_sales_count_raw', 'new_con_sales',
  'new_con_sales_count_raw_uc_sfrcondo_month',
  'New Construction Sales Count',
  ['metro'],
);

// New Construction - Median Sale Price
const newConPriceDatasets = createMultiGeoDatasets(
  'new-con-price', 'new_con_median_sale_price_raw', 'new_con_price',
  'new_con_median_sale_price_raw_uc_sfrcondo_month',
  'New Construction Median Sale Price',
  ['metro'],
);

// Affordability - Homeowner Income Needed
const homeownerIncomeDatasets = createMultiGeoDatasets(
  'homeowner-income', 'new_homeowner_income_needed', 'homeowner_income',
  'new_homeowner_income_needed_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month',
  'Homeowner Income Needed (20% down)',
  ['metro'],
);

// Affordability - Renter Income Needed
const renterIncomeDatasets = createMultiGeoDatasets(
  'renter-income', 'new_renter_income_needed', 'renter_income',
  'new_renter_income_needed_uc_sfrcondomfr_sm_sa_month',
  'Renter Income Needed',
  ['metro'],
);

// Affordability - Affordable Home Price
const affordablePriceDatasets = createMultiGeoDatasets(
  'affordable-price', 'affordable_home_price', 'affordable_price',
  'affordable_home_price_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month',
  'Affordable Home Price (20% down)',
  ['metro'],
);

// Affordability - Years to Save
const yearsToSaveDatasets = createMultiGeoDatasets(
  'years-to-save', 'years_to_save', 'years_to_save',
  'years_to_save_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month',
  'Years to Save for Down Payment',
  ['metro'],
);

// Affordability - Homeowner Affordability Percent
const homeownerAffordDatasets = createMultiGeoDatasets(
  'homeowner-afford', 'new_homeowner_affordability', 'homeowner_afford',
  'new_homeowner_affordability_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month',
  'Homeowner Affordability %',
  ['metro'],
);

// Affordability - Renter Affordability Percent
const renterAffordDatasets = createMultiGeoDatasets(
  'renter-afford', 'new_renter_affordability', 'renter_afford',
  'new_renter_affordability_uc_sfrcondomfr_sm_sa_month',
  'Renter Affordability %',
  ['metro'],
);

// Median List Price
const listPriceDatasets = createMultiGeoDatasets(
  'list-price', 'median_list_price', 'list_price',
  'median_list_price_uc_sfrcondo_sm_month',
  'Median List Price (SFR+Condo)',
  ['metro'],
);

// Mean Sale Price
const meanSalePriceDatasets = createMultiGeoDatasets(
  'mean-sale-price', 'mean_sale_price', 'mean_sale_price',
  'mean_sale_price_uc_sfrcondo_month',
  'Mean Sale Price (SFR+Condo)',
  ['metro'],
);

// Sale-to-List Ratio
const saleToListDatasets = createMultiGeoDatasets(
  'sale-to-list', 'mean_sale_to_list_ratio', 'sale_to_list',
  'mean_sale_to_list_ratio_uc_sfrcondo_sm_month',
  'Mean Sale-to-List Ratio (SFR+Condo)',
  ['metro'],
);

// Days to Close
const daysToCloseDatasets = createMultiGeoDatasets(
  'days-to-close', 'mean_doz_close', 'days_to_close',
  'mean_doz_close_uc_sfrcondo_sm_month',
  'Mean Days to Close (SFR+Condo)',
  ['metro'],
);

// Total Transaction Value
const totalTransactionDatasets = createMultiGeoDatasets(
  'total-transaction', 'total_transaction_value', 'total_transaction_value',
  'total_transaction_value_uc_sfrcondo_month',
  'Total Transaction Value (SFR+Condo)',
  ['metro'],
);

// ---------------------------------------------------------------------------
// Complete dataset list
// ---------------------------------------------------------------------------

export const ALL_ZILLOW_DATASETS: ZillowDatasetConfig[] = [
  // Core metrics (all 4 geographies)
  ...zhviDatasets,
  ...zoriDatasets,
  ...inventoryDatasets,
  ...newListingsDatasets,
  ...salesCountDatasets,
  ...medianSalePriceDatasets,
  ...daysToPendingDatasets,
  // Metro-only metrics
  ...marketHeatDatasets,
  ...newConSalesDatasets,
  ...newConPriceDatasets,
  ...homeownerIncomeDatasets,
  ...renterIncomeDatasets,
  ...affordablePriceDatasets,
  ...yearsToSaveDatasets,
  ...homeownerAffordDatasets,
  ...renterAffordDatasets,
  ...listPriceDatasets,
  ...meanSalePriceDatasets,
  ...saleToListDatasets,
  ...daysToCloseDatasets,
  ...totalTransactionDatasets,
];

/**
 * Filter datasets by geography level.
 */
export function getDatasetsByGeography(geography: ZillowGeography): ZillowDatasetConfig[] {
  return ALL_ZILLOW_DATASETS.filter((d) => d.geography === geography);
}

/**
 * Filter datasets by metric name.
 */
export function getDatasetsByMetric(metricName: string): ZillowDatasetConfig[] {
  return ALL_ZILLOW_DATASETS.filter((d) => d.metricName === metricName);
}
