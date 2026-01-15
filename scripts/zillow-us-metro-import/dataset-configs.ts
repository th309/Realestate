/**
 * Zillow US/Metro Dataset Configurations
 *
 * 42 datasets total:
 * - 6 original types × 2 levels = 12
 * - Market Heat Index (1 type × 2 levels) = 2
 * - New Construction (2 types × 2 levels) = 4
 * - Affordability (6 types × 2 levels) = 12
 * - New Listings (1 type × 2 levels) = 2
 * - List Price (1 type × 2 levels) = 2
 * - Mean Sale Price (1 type × 2 levels) = 2
 * - Sale-to-List Ratio (1 type × 2 levels) = 2
 * - Days to Close (1 type × 2 levels) = 2
 * - Total Transaction Value (1 type × 2 levels) = 2
 */

import type { DatasetConfig } from './types';
import { getBuildZillowUrl } from './db-client';

const buildZillowUrl = getBuildZillowUrl();

// Base URLs for datasets without builder support
const ZILLOW_CSV_BASE = 'https://files.zillowstatic.com/research/public_csvs';

/**
 * Create US and Metro pair for a dataset
 */
function createDatasetPair(
  idBase: string,
  datasetType: string,
  tableName: string,
  descriptionBase: string,
  url: string
): DatasetConfig[] {
  return [
    {
      id: `${idBase}-us`,
      datasetType,
      tableName,
      description: `${descriptionBase} - United States`,
      url,
      filterUS: true,
      filterMetro: false
    },
    {
      id: `${idBase}-metro`,
      datasetType,
      tableName,
      description: `${descriptionBase} - Metro Areas`,
      url,
      filterUS: false,
      filterMetro: true
    }
  ];
}

// ZHVI - Home Values
const zhviDatasets = createDatasetPair(
  'zhvi', 'zhvi', 'zillow_zhvi', 'ZHVI',
  buildZillowUrl('zhvi', 'Metro', {
    propertyType: 'sfrcondo',
    tier: '0.33_0.67',
    smoothing: 'sm',
    seasonalAdjustment: true
  })
);

// ZORI - Rentals
const zoriDatasets = createDatasetPair(
  'zori', 'zori', 'zillow_zori', 'ZORI',
  buildZillowUrl('zori', 'Metro', {
    propertyType: 'sfrcondomfr',
    smoothing: 'sm'
  })
);

// Inventory
const inventoryDatasets = createDatasetPair(
  'inventory', 'invt_fs', 'zillow_inventory', 'Inventory',
  buildZillowUrl('invt_fs', 'Metro', {
    propertyType: 'sfrcondo',
    smoothing: 'sm',
    frequency: 'month'
  })
);

// Sales Count
const salesCountDatasets = createDatasetPair(
  'sales-count', 'sales_count_now', 'zillow_sales_count', 'Sales Count',
  buildZillowUrl('sales_count_now', 'Metro', {
    propertyType: 'sfrcondo',
    frequency: 'month'
  })
);

// Sales Price
const salesPriceDatasets = createDatasetPair(
  'sales-price', 'median_sale_price', 'zillow_sales_price', 'Sales Price',
  buildZillowUrl('median_sale_price', 'Metro', {
    propertyType: 'sfrcondo',
    frequency: 'month'
  })
);

// Days to Pending
const daysPendingDatasets = createDatasetPair(
  'days-pending', 'mean_doz_pending', 'zillow_days_to_pending', 'Days to Pending',
  buildZillowUrl('mean_doz_pending', 'Metro', {
    propertyType: 'sfrcondo',
    smoothing: 'sm',
    frequency: 'month'
  })
);

// Market Heat Index - imports to zillow_metro with metric_name='market_heat'
const marketHeatDatasets = createDatasetPair(
  'market-heat-index', 'market_temp_index', 'zillow_metro', 'Market Heat Index',
  `${ZILLOW_CSV_BASE}/market_temp_index/Metro_market_temp_index_uc_sfrcondo_month.csv`
);

// New Construction Sales Count
const newConstructionSalesCountDatasets = createDatasetPair(
  'new-construction-sales-count', 'new_con_sales_count_raw', 'zillow_new_construction_sales_count', 'New Construction Sales Count',
  `${ZILLOW_CSV_BASE}/new_con_sales_count_raw/Metro_new_con_sales_count_raw_uc_sfrcondo_month.csv`
);

// New Construction Sale Price
const newConstructionSalePriceDatasets = createDatasetPair(
  'new-construction-sale-price', 'new_con_median_sale_price', 'zillow_new_construction_sale_price', 'New Construction Sale Price',
  `${ZILLOW_CSV_BASE}/new_con_median_sale_price_raw/Metro_new_con_median_sale_price_raw_uc_sfrcondo_month.csv`
);

// Affordability - Homeowner Income Needed
const affordabilityHomeownerIncomeDatasets = createDatasetPair(
  'affordability-homeowner-income', 'new_homeowner_income_needed', 'zillow_affordability', 'Homeowner Income Needed',
  `${ZILLOW_CSV_BASE}/new_homeowner_income_needed/Metro_new_homeowner_income_needed_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`
);

// Affordability - Renter Income Needed
const affordabilityRenterIncomeDatasets = createDatasetPair(
  'affordability-renter-income', 'new_renter_income_needed', 'zillow_affordability', 'Renter Income Needed',
  `${ZILLOW_CSV_BASE}/new_renter_income_needed/Metro_new_renter_income_needed_uc_sfrcondomfr_sm_sa_month.csv`
);

// Affordability - Affordable Home Price
const affordabilityHomePriceDatasets = createDatasetPair(
  'affordability-home-price', 'affordable_home_price', 'zillow_affordability', 'Affordable Home Price',
  `${ZILLOW_CSV_BASE}/affordable_home_price/Metro_affordable_home_price_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`
);

// Affordability - Years to Save
const affordabilityYearsToSaveDatasets = createDatasetPair(
  'affordability-years-to-save', 'years_to_save', 'zillow_affordability', 'Years to Save',
  `${ZILLOW_CSV_BASE}/years_to_save/Metro_years_to_save_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`
);

// Affordability - Homeowner Affordability Percent
const affordabilityHomeownerPercentDatasets = createDatasetPair(
  'affordability-homeowner-percent', 'new_homeowner_affordability', 'zillow_affordability', 'Homeowner Affordability %',
  `${ZILLOW_CSV_BASE}/new_homeowner_affordability/Metro_new_homeowner_affordability_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`
);

// Affordability - Renter Affordability Percent
const affordabilityRenterPercentDatasets = createDatasetPair(
  'affordability-renter-percent', 'new_renter_affordability', 'zillow_affordability', 'Renter Affordability %',
  `${ZILLOW_CSV_BASE}/new_renter_affordability/Metro_new_renter_affordability_uc_sfrcondomfr_sm_sa_month.csv`
);

// New Listings
const newListingsDatasets = createDatasetPair(
  'new-listings', 'new_listings', 'zillow_new_listings', 'New Listings',
  buildZillowUrl('new_listings', 'Metro', {
    propertyType: 'sfrcondo',
    smoothing: 'sm',
    frequency: 'month'
  })
);

// Median List Price
const listPriceDatasets = createDatasetPair(
  'list-price', 'median_list_price', 'zillow_list_price', 'Median List Price',
  buildZillowUrl('median_list_price', 'Metro', {
    propertyType: 'sfrcondo',
    smoothing: 'sm',
    frequency: 'month'
  })
);

// Mean Sale Price
const meanSalePriceDatasets = createDatasetPair(
  'mean-sale-price', 'mean_sale_price', 'zillow_sales_price', 'Mean Sale Price',
  buildZillowUrl('mean_sale_price', 'Metro', {
    propertyType: 'sfrcondo',
    frequency: 'month'
  })
);

// Sale-to-List Ratio
const saleToListRatioDatasets = createDatasetPair(
  'sale-to-list-ratio', 'mean_sale_to_list_ratio', 'zillow_sale_to_list_ratio', 'Sale-to-List Ratio',
  buildZillowUrl('mean_sale_to_list_ratio', 'Metro', {
    propertyType: 'sfrcondo',
    smoothing: 'sm',
    frequency: 'month'
  })
);

// Days to Close
const daysToCloseDatasets = createDatasetPair(
  'days-to-close', 'mean_doz_close', 'zillow_days_to_close', 'Days to Close',
  buildZillowUrl('mean_doz_close', 'Metro', {
    propertyType: 'sfrcondo',
    smoothing: 'sm',
    frequency: 'month'
  })
);

// Total Transaction Value
const totalTransactionValueDatasets = createDatasetPair(
  'total-transaction-value', 'total_transaction_value', 'zillow_total_transaction_value', 'Total Transaction Value',
  buildZillowUrl('total_transaction_value', 'Metro', {
    propertyType: 'sfrcondo',
    frequency: 'month'
  })
);

/**
 * All target datasets for US/Metro import
 */
export const TARGET_DATASETS: DatasetConfig[] = [
  ...zhviDatasets,
  ...zoriDatasets,
  ...inventoryDatasets,
  ...salesCountDatasets,
  ...salesPriceDatasets,
  ...daysPendingDatasets,
  ...marketHeatDatasets,
  ...newConstructionSalesCountDatasets,
  ...newConstructionSalePriceDatasets,
  ...affordabilityHomeownerIncomeDatasets,
  ...affordabilityRenterIncomeDatasets,
  ...affordabilityHomePriceDatasets,
  ...affordabilityYearsToSaveDatasets,
  ...affordabilityHomeownerPercentDatasets,
  ...affordabilityRenterPercentDatasets,
  ...newListingsDatasets,
  ...listPriceDatasets,
  ...meanSalePriceDatasets,
  ...saleToListRatioDatasets,
  ...daysToCloseDatasets,
  ...totalTransactionValueDatasets
];
