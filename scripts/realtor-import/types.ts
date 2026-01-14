/**
 * Types for Realtor.com Data Import
 */

export interface ImportResult {
  datasetId: string;
  success: boolean;
  recordsInserted: number;
  recordsUpdated: number;
  errors: number;
  errorMessage?: string;
}

export interface DownloadResult {
  success: boolean;
  csvContent?: string;
  error?: string;
}

export interface RealtorNationalRecord {
  period_date: Date;
  country: string;
  median_listing_price: number | null;
  median_listing_price_mm: number | null;
  median_listing_price_yy: number | null;
  active_listing_count: number | null;
  active_listing_count_mm: number | null;
  active_listing_count_yy: number | null;
  median_days_on_market: number | null;
  median_days_on_market_mm: number | null;
  median_days_on_market_yy: number | null;
  new_listing_count: number | null;
  new_listing_count_mm: number | null;
  new_listing_count_yy: number | null;
  price_increased_count: number | null;
  price_increased_count_mm: number | null;
  price_increased_count_yy: number | null;
  price_increased_share: number | null;
  price_increased_share_mm: number | null;
  price_increased_share_yy: number | null;
  price_reduced_count: number | null;
  price_reduced_count_mm: number | null;
  price_reduced_count_yy: number | null;
  price_reduced_share: number | null;
  price_reduced_share_mm: number | null;
  price_reduced_share_yy: number | null;
  pending_listing_count: number | null;
  pending_listing_count_mm: number | null;
  pending_listing_count_yy: number | null;
  median_listing_price_per_square_foot: number | null;
  median_listing_price_per_square_foot_mm: number | null;
  median_listing_price_per_square_foot_yy: number | null;
  median_square_feet: number | null;
  median_square_feet_mm: number | null;
  median_square_feet_yy: number | null;
  average_listing_price: number | null;
  average_listing_price_mm: number | null;
  average_listing_price_yy: number | null;
  total_listing_count: number | null;
  total_listing_count_mm: number | null;
  total_listing_count_yy: number | null;
  pending_ratio: number | null;
  pending_ratio_mm: number | null;
  pending_ratio_yy: number | null;
  quality_flag: number;
}

export interface RealtorStateRecord {
  period_date: Date;
  state_name: string;
  state_id: string;
  median_listing_price: number | null;
  median_listing_price_mm: number | null;
  median_listing_price_yy: number | null;
  active_listing_count: number | null;
  active_listing_count_mm: number | null;
  active_listing_count_yy: number | null;
  median_days_on_market: number | null;
  median_days_on_market_mm: number | null;
  median_days_on_market_yy: number | null;
  new_listing_count: number | null;
  new_listing_count_mm: number | null;
  new_listing_count_yy: number | null;
  price_increased_count: number | null;
  price_increased_count_mm: number | null;
  price_increased_count_yy: number | null;
  price_increased_share: number | null;
  price_increased_share_mm: number | null;
  price_increased_share_yy: number | null;
  price_reduced_count: number | null;
  price_reduced_count_mm: number | null;
  price_reduced_count_yy: number | null;
  price_reduced_share: number | null;
  price_reduced_share_mm: number | null;
  price_reduced_share_yy: number | null;
  pending_listing_count: number | null;
  pending_listing_count_mm: number | null;
  pending_listing_count_yy: number | null;
  median_listing_price_per_square_foot: number | null;
  median_listing_price_per_square_foot_mm: number | null;
  median_listing_price_per_square_foot_yy: number | null;
  median_square_feet: number | null;
  median_square_feet_mm: number | null;
  median_square_feet_yy: number | null;
  average_listing_price: number | null;
  average_listing_price_mm: number | null;
  average_listing_price_yy: number | null;
  total_listing_count: number | null;
  total_listing_count_mm: number | null;
  total_listing_count_yy: number | null;
  pending_ratio: number | null;
  pending_ratio_mm: number | null;
  pending_ratio_yy: number | null;
  quality_flag: number;
}

// Combined record type for Metro/County/Zip (core + hotness fields)
export interface RealtorCombinedRecord {
  period_date: Date;
  // Geography identifiers (varies by level)
  cbsa_code?: string;
  cbsa_title?: string;
  county_fips?: string;
  county_name?: string;
  postal_code?: string;
  zip_name?: string;
  // Hotness metrics
  household_rank?: number | null;
  hotness_rank?: number | null;
  hotness_rank_mm?: number | null;
  hotness_rank_yy?: number | null;
  hotness_score?: number | null;
  supply_score?: number | null;
  demand_score?: number | null;
  // Core listing price metrics
  median_listing_price: number | null;
  median_listing_price_mm: number | null;
  median_listing_price_yy: number | null;
  median_listing_price_vs_us?: number | null;
  // Active listing metrics
  active_listing_count: number | null;
  active_listing_count_mm: number | null;
  active_listing_count_yy: number | null;
  // Days on market metrics
  median_days_on_market: number | null;
  median_days_on_market_mm: number | null;
  median_days_on_market_yy: number | null;
  median_dom_vs_us?: number | null;
  // New listing metrics
  new_listing_count: number | null;
  new_listing_count_mm: number | null;
  new_listing_count_yy: number | null;
  // Price increased metrics
  price_increased_count: number | null;
  price_increased_count_mm: number | null;
  price_increased_count_yy: number | null;
  price_increased_share: number | null;
  price_increased_share_mm: number | null;
  price_increased_share_yy: number | null;
  // Price reduced metrics
  price_reduced_count: number | null;
  price_reduced_count_mm: number | null;
  price_reduced_count_yy: number | null;
  price_reduced_share: number | null;
  price_reduced_share_mm: number | null;
  price_reduced_share_yy: number | null;
  // Pending listing metrics
  pending_listing_count: number | null;
  pending_listing_count_mm: number | null;
  pending_listing_count_yy: number | null;
  // Price per square foot metrics
  median_listing_price_per_square_foot: number | null;
  median_listing_price_per_square_foot_mm: number | null;
  median_listing_price_per_square_foot_yy: number | null;
  // Square footage metrics
  median_square_feet: number | null;
  median_square_feet_mm: number | null;
  median_square_feet_yy: number | null;
  // Average listing price metrics
  average_listing_price: number | null;
  average_listing_price_mm: number | null;
  average_listing_price_yy: number | null;
  // Total listing metrics
  total_listing_count: number | null;
  total_listing_count_mm: number | null;
  total_listing_count_yy: number | null;
  // Pending ratio metrics
  pending_ratio: number | null;
  pending_ratio_mm: number | null;
  pending_ratio_yy: number | null;
  // Page view metrics (from hotness)
  page_view_count_per_property_mm?: number | null;
  page_view_count_per_property_yy?: number | null;
  page_view_count_per_property_vs_us?: number | null;
  // Quality flag
  quality_flag: number;
}

export interface RealtorDatasetConfig {
  id: string;
  downloadUrl: string;
  hotnessUrl?: string;
  historyFile?: string;
  hotnessHistoryFile?: string;
  description: string;
  tableName: string;
  geography: 'national' | 'state' | 'metro' | 'county' | 'zip';
  dataType: 'core' | 'hotness' | 'combined';
}

// Dataset configurations for Realtor.com data
export const REALTOR_DATASETS: RealtorDatasetConfig[] = [
  {
    id: 'realtor-national',
    downloadUrl: 'https://econdata.s3-us-west-2.amazonaws.com/Reports/Core/RDC_Inventory_Core_Metrics_Country.csv',
    historyFile: 'RDC_Inventory_Core_Metrics_Country_History.csv',
    description: 'National-level housing inventory and listing metrics',
    tableName: 'realtor_national',
    geography: 'national',
    dataType: 'core'
  },
  {
    id: 'realtor-state',
    downloadUrl: 'https://econdata.s3-us-west-2.amazonaws.com/Reports/Core/RDC_Inventory_Core_Metrics_State.csv',
    historyFile: 'RDC_Inventory_Core_Metrics_State_History.csv',
    description: 'State-level housing inventory and listing metrics',
    tableName: 'realtor_state',
    geography: 'state',
    dataType: 'core'
  },
  {
    id: 'realtor-metro',
    downloadUrl: 'https://econdata.s3-us-west-2.amazonaws.com/Reports/Core/RDC_Inventory_Core_Metrics_Metro.csv',
    hotnessUrl: 'https://econdata.s3-us-west-2.amazonaws.com/Reports/Hotness/RDC_Inventory_Hotness_Metrics_Metro.csv',
    historyFile: 'RDC_Inventory_Core_Metrics_Metro_History.csv',
    hotnessHistoryFile: 'RDC_Inventory_Hotness_Metrics_Metro_History.csv',
    description: 'Metro-level housing inventory, listing, and hotness metrics',
    tableName: 'realtor_metro',
    geography: 'metro',
    dataType: 'combined'
  },
  {
    id: 'realtor-county',
    downloadUrl: 'https://econdata.s3-us-west-2.amazonaws.com/Reports/Core/RDC_Inventory_Core_Metrics_County.csv',
    hotnessUrl: 'https://econdata.s3-us-west-2.amazonaws.com/Reports/Hotness/RDC_Inventory_Hotness_Metrics_County.csv',
    historyFile: 'RDC_Inventory_Core_Metrics_County_History.csv',
    hotnessHistoryFile: 'RDC_Inventory_Hotness_Metrics_County_History.csv',
    description: 'County-level housing inventory, listing, and hotness metrics',
    tableName: 'realtor_county',
    geography: 'county',
    dataType: 'combined'
  },
  {
    id: 'realtor-zip',
    downloadUrl: 'https://econdata.s3-us-west-2.amazonaws.com/Reports/Core/RDC_Inventory_Core_Metrics_Zip.csv',
    hotnessUrl: 'https://econdata.s3-us-west-2.amazonaws.com/Reports/Hotness/RDC_Inventory_Hotness_Metrics_Zip.csv',
    historyFile: 'RDC_Inventory_Core_Metrics_Zip_History.csv',
    hotnessHistoryFile: 'RDC_Inventory_Hotness_Metrics_Zip_History.csv',
    description: 'ZIP-level housing inventory, listing, and hotness metrics',
    tableName: 'realtor_zip',
    geography: 'zip',
    dataType: 'combined'
  }
];
