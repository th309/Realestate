/**
 * Import Zillow Data - US/National and Metro Level Only
 * 
 * Imports only US/National and Metro level data for:
 * - zillow_zhvi (Home Values)
 * - zillow_zori (Rentals)
 * - zillow_inventory (For-Sale Inventory)
 * - zillow_sales_count (Sales Count)
 * - zillow_sales_price (Median Sale Price)
 * - zillow_days_to_pending (Days to Pending)
 * 
 * Usage:
 *   npx tsx scripts/import-zillow-us-metro-only.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { parse as parseSync } from 'csv-parse/sync';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: join(__dirname, '../web/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Import dataset configuration
let buildZillowUrl: any;
try {
  const zillowDatasets = require('../web/lib/data-ingestion/sources/zillow-datasets');
  buildZillowUrl = zillowDatasets.buildZillowUrl;
} catch (error) {
  console.error('❌ Could not import zillow-datasets');
  process.exit(1);
}

interface DatasetConfig {
  id: string;
  datasetType: string;
  tableName: string;
  description: string;
  url: string;
  filterUS: boolean; // If true, filter for US only (region_id = 102001)
  filterMetro: boolean; // If true, filter for metro only (region_type = 'msa')
}

/**
 * Define the datasets we want (US + Metro for each type)
 * 
 * 6 original types × 2 levels = 12
 * + Market Heat Index (1 type × 2 levels) = 2
 * + New Construction (2 types × 2 levels) = 4
 * + Affordability (6 types × 2 levels) = 12
 * + New Listings (1 type × 2 levels) = 2
 * + List Price (1 type × 2 levels) = 2
 * + Mean Sale Price (1 type × 2 levels) = 2
 * + Sale-to-List Ratio (1 type × 2 levels) = 2
 * + Days to Close (1 type × 2 levels) = 2
 * + Total Transaction Value (1 type × 2 levels) = 2
 * Total: 42 datasets
 */
const TARGET_DATASETS: DatasetConfig[] = [
  // ZHVI - Home Values
  {
    id: 'zhvi-us',
    datasetType: 'zhvi',
    tableName: 'zillow_zhvi',
    description: 'ZHVI - United States',
    url: buildZillowUrl('zhvi', 'Metro', {
      propertyType: 'sfrcondo',
      tier: '0.33_0.67',
      smoothing: 'sm',
      seasonalAdjustment: true
    }),
    filterUS: true,
    filterMetro: false
  },
  {
    id: 'zhvi-metro',
    datasetType: 'zhvi',
    tableName: 'zillow_zhvi',
    description: 'ZHVI - Metro Areas',
    url: buildZillowUrl('zhvi', 'Metro', {
      propertyType: 'sfrcondo',
      tier: '0.33_0.67',
      smoothing: 'sm',
      seasonalAdjustment: true
    }),
    filterUS: false,
    filterMetro: true
  },
  
  // ZORI - Rentals
  {
    id: 'zori-us',
    datasetType: 'zori',
    tableName: 'zillow_zori',
    description: 'ZORI - United States',
    url: buildZillowUrl('zori', 'Metro', {
      propertyType: 'sfrcondomfr',
      smoothing: 'sm'
    }),
    filterUS: true,
    filterMetro: false
  },
  {
    id: 'zori-metro',
    datasetType: 'zori',
    tableName: 'zillow_zori',
    description: 'ZORI - Metro Areas',
    url: buildZillowUrl('zori', 'Metro', {
      propertyType: 'sfrcondomfr',
      smoothing: 'sm'
    }),
    filterUS: false,
    filterMetro: true
  },
  
  // Inventory
  {
    id: 'inventory-us',
    datasetType: 'invt_fs',
    tableName: 'zillow_inventory',
    description: 'Inventory - United States',
    url: buildZillowUrl('invt_fs', 'Metro', {
      propertyType: 'sfrcondo',
      smoothing: 'sm',
      frequency: 'month'
    }),
    filterUS: true,
    filterMetro: false
  },
  {
    id: 'inventory-metro',
    datasetType: 'invt_fs',
    tableName: 'zillow_inventory',
    description: 'Inventory - Metro Areas',
    url: buildZillowUrl('invt_fs', 'Metro', {
      propertyType: 'sfrcondo',
      smoothing: 'sm',
      frequency: 'month'
    }),
    filterUS: false,
    filterMetro: true
  },
  
  // Sales Count
  {
    id: 'sales-count-us',
    datasetType: 'sales_count_now',
    tableName: 'zillow_sales_count',
    description: 'Sales Count - United States',
    url: buildZillowUrl('sales_count_now', 'Metro', {
      propertyType: 'sfrcondo',
      frequency: 'month'
    }),
    filterUS: true,
    filterMetro: false
  },
  {
    id: 'sales-count-metro',
    datasetType: 'sales_count_now',
    tableName: 'zillow_sales_count',
    description: 'Sales Count - Metro Areas',
    url: buildZillowUrl('sales_count_now', 'Metro', {
      propertyType: 'sfrcondo',
      frequency: 'month'
    }),
    filterUS: false,
    filterMetro: true
  },
  
  // Sales Price
  {
    id: 'sales-price-us',
    datasetType: 'median_sale_price',
    tableName: 'zillow_sales_price',
    description: 'Sales Price - United States',
    url: buildZillowUrl('median_sale_price', 'Metro', {
      propertyType: 'sfrcondo',
      frequency: 'month'
    }),
    filterUS: true,
    filterMetro: false
  },
  {
    id: 'sales-price-metro',
    datasetType: 'median_sale_price',
    tableName: 'zillow_sales_price',
    description: 'Sales Price - Metro Areas',
    url: buildZillowUrl('median_sale_price', 'Metro', {
      propertyType: 'sfrcondo',
      frequency: 'month'
    }),
    filterUS: false,
    filterMetro: true
  },
  
  // Days to Pending
  {
    id: 'days-pending-us',
    datasetType: 'mean_doz_pending',
    tableName: 'zillow_days_to_pending',
    description: 'Days to Pending - United States',
    url: buildZillowUrl('mean_doz_pending', 'Metro', {
      propertyType: 'sfrcondo',
      smoothing: 'sm',
      frequency: 'month'
    }),
    filterUS: true,
    filterMetro: false
  },
  {
    id: 'days-pending-metro',
    datasetType: 'mean_doz_pending',
    tableName: 'zillow_days_to_pending',
    description: 'Days to Pending - Metro Areas',
    url: buildZillowUrl('mean_doz_pending', 'Metro', {
      propertyType: 'sfrcondo',
      smoothing: 'sm',
      frequency: 'month'
    }),
    filterUS: false,
    filterMetro: true
  },
  
  // Market Heat Index
  {
    id: 'market-heat-index-us',
    datasetType: 'market_temp_index',
    tableName: 'zillow_market_heat_index',
    description: 'Market Heat Index - United States',
    url: 'https://files.zillowstatic.com/research/public_csvs/market_temp_index/Metro_market_temp_index_uc_sfrcondo_month.csv',
    filterUS: true,
    filterMetro: false
  },
  {
    id: 'market-heat-index-metro',
    datasetType: 'market_temp_index',
    tableName: 'zillow_market_heat_index',
    description: 'Market Heat Index - Metro Areas',
    url: 'https://files.zillowstatic.com/research/public_csvs/market_temp_index/Metro_market_temp_index_uc_sfrcondo_month.csv',
    filterUS: false,
    filterMetro: true
  },
  
  // New Construction Sales Count
  {
    id: 'new-construction-sales-count-us',
    datasetType: 'new_con_sales_count_raw',
    tableName: 'zillow_new_construction_sales_count',
    description: 'New Construction Sales Count - United States',
    url: 'https://files.zillowstatic.com/research/public_csvs/new_con_sales_count_raw/Metro_new_con_sales_count_raw_uc_sfrcondo_month.csv',
    filterUS: true,
    filterMetro: false
  },
  {
    id: 'new-construction-sales-count-metro',
    datasetType: 'new_con_sales_count_raw',
    tableName: 'zillow_new_construction_sales_count',
    description: 'New Construction Sales Count - Metro Areas',
    url: 'https://files.zillowstatic.com/research/public_csvs/new_con_sales_count_raw/Metro_new_con_sales_count_raw_uc_sfrcondo_month.csv',
    filterUS: false,
    filterMetro: true
  },
  
  // New Construction Sale Price
  {
    id: 'new-construction-sale-price-us',
    datasetType: 'new_con_median_sale_price',
    tableName: 'zillow_new_construction_sale_price',
    description: 'New Construction Sale Price - United States',
    url: 'https://files.zillowstatic.com/research/public_csvs/new_con_median_sale_price_raw/Metro_new_con_median_sale_price_raw_uc_sfrcondo_month.csv',
    filterUS: true,
    filterMetro: false
  },
  {
    id: 'new-construction-sale-price-metro',
    datasetType: 'new_con_median_sale_price',
    tableName: 'zillow_new_construction_sale_price',
    description: 'New Construction Sale Price - Metro Areas',
    url: 'https://files.zillowstatic.com/research/public_csvs/new_con_median_sale_price_raw/Metro_new_con_median_sale_price_raw_uc_sfrcondo_month.csv',
    filterUS: false,
    filterMetro: true
  },
  
  // Affordability - Homeowner Income Needed
  {
    id: 'affordability-homeowner-income-us',
    datasetType: 'new_homeowner_income_needed',
    tableName: 'zillow_affordability',
    description: 'Homeowner Income Needed - United States',
    url: 'https://files.zillowstatic.com/research/public_csvs/new_homeowner_income_needed/Metro_new_homeowner_income_needed_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    filterUS: true,
    filterMetro: false
  },
  {
    id: 'affordability-homeowner-income-metro',
    datasetType: 'new_homeowner_income_needed',
    tableName: 'zillow_affordability',
    description: 'Homeowner Income Needed - Metro Areas',
    url: 'https://files.zillowstatic.com/research/public_csvs/new_homeowner_income_needed/Metro_new_homeowner_income_needed_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    filterUS: false,
    filterMetro: true
  },
  
  // Affordability - Renter Income Needed
  {
    id: 'affordability-renter-income-us',
    datasetType: 'new_renter_income_needed',
    tableName: 'zillow_affordability',
    description: 'Renter Income Needed - United States',
    url: 'https://files.zillowstatic.com/research/public_csvs/new_renter_income_needed/Metro_new_renter_income_needed_uc_sfrcondomfr_sm_sa_month.csv',
    filterUS: true,
    filterMetro: false
  },
  {
    id: 'affordability-renter-income-metro',
    datasetType: 'new_renter_income_needed',
    tableName: 'zillow_affordability',
    description: 'Renter Income Needed - Metro Areas',
    url: 'https://files.zillowstatic.com/research/public_csvs/new_renter_income_needed/Metro_new_renter_income_needed_uc_sfrcondomfr_sm_sa_month.csv',
    filterUS: false,
    filterMetro: true
  },
  
  // Affordability - Affordable Home Price
  {
    id: 'affordability-home-price-us',
    datasetType: 'affordable_home_price',
    tableName: 'zillow_affordability',
    description: 'Affordable Home Price - United States',
    url: 'https://files.zillowstatic.com/research/public_csvs/affordable_home_price/Metro_affordable_home_price_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    filterUS: true,
    filterMetro: false
  },
  {
    id: 'affordability-home-price-metro',
    datasetType: 'affordable_home_price',
    tableName: 'zillow_affordability',
    description: 'Affordable Home Price - Metro Areas',
    url: 'https://files.zillowstatic.com/research/public_csvs/affordable_home_price/Metro_affordable_home_price_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    filterUS: false,
    filterMetro: true
  },
  
  // Affordability - Years to Save
  {
    id: 'affordability-years-to-save-us',
    datasetType: 'years_to_save',
    tableName: 'zillow_affordability',
    description: 'Years to Save - United States',
    url: 'https://files.zillowstatic.com/research/public_csvs/years_to_save/Metro_years_to_save_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    filterUS: true,
    filterMetro: false
  },
  {
    id: 'affordability-years-to-save-metro',
    datasetType: 'years_to_save',
    tableName: 'zillow_affordability',
    description: 'Years to Save - Metro Areas',
    url: 'https://files.zillowstatic.com/research/public_csvs/years_to_save/Metro_years_to_save_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    filterUS: false,
    filterMetro: true
  },
  
  // Affordability - Homeowner Affordability Percent
  {
    id: 'affordability-homeowner-percent-us',
    datasetType: 'new_homeowner_affordability',
    tableName: 'zillow_affordability',
    description: 'Homeowner Affordability % - United States',
    url: 'https://files.zillowstatic.com/research/public_csvs/new_homeowner_affordability/Metro_new_homeowner_affordability_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    filterUS: true,
    filterMetro: false
  },
  {
    id: 'affordability-homeowner-percent-metro',
    datasetType: 'new_homeowner_affordability',
    tableName: 'zillow_affordability',
    description: 'Homeowner Affordability % - Metro Areas',
    url: 'https://files.zillowstatic.com/research/public_csvs/new_homeowner_affordability/Metro_new_homeowner_affordability_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    filterUS: false,
    filterMetro: true
  },
  
  // Affordability - Renter Affordability Percent
  {
    id: 'affordability-renter-percent-us',
    datasetType: 'new_renter_affordability',
    tableName: 'zillow_affordability',
    description: 'Renter Affordability % - United States',
    url: 'https://files.zillowstatic.com/research/public_csvs/new_renter_affordability/Metro_new_renter_affordability_uc_sfrcondomfr_sm_sa_month.csv',
    filterUS: true,
    filterMetro: false
  },
  {
    id: 'affordability-renter-percent-metro',
    datasetType: 'new_renter_affordability',
    tableName: 'zillow_affordability',
    description: 'Renter Affordability % - Metro Areas',
    url: 'https://files.zillowstatic.com/research/public_csvs/new_renter_affordability/Metro_new_renter_affordability_uc_sfrcondomfr_sm_sa_month.csv',
    filterUS: false,
    filterMetro: true
  },
  
  // New Listings
  {
    id: 'new-listings-us',
    datasetType: 'new_listings',
    tableName: 'zillow_new_listings',
    description: 'New Listings - United States',
    url: buildZillowUrl('new_listings', 'Metro', {
      propertyType: 'sfrcondo',
      smoothing: 'sm',
      frequency: 'month'
    }),
    filterUS: true,
    filterMetro: false
  },
  {
    id: 'new-listings-metro',
    datasetType: 'new_listings',
    tableName: 'zillow_new_listings',
    description: 'New Listings - Metro Areas',
    url: buildZillowUrl('new_listings', 'Metro', {
      propertyType: 'sfrcondo',
      smoothing: 'sm',
      frequency: 'month'
    }),
    filterUS: false,
    filterMetro: true
  },
  
  // Median List Price
  {
    id: 'list-price-us',
    datasetType: 'median_list_price',
    tableName: 'zillow_list_price',
    description: 'Median List Price - United States',
    url: buildZillowUrl('median_list_price', 'Metro', {
      propertyType: 'sfrcondo',
      smoothing: 'sm',
      frequency: 'month'
    }),
    filterUS: true,
    filterMetro: false
  },
  {
    id: 'list-price-metro',
    datasetType: 'median_list_price',
    tableName: 'zillow_list_price',
    description: 'Median List Price - Metro Areas',
    url: buildZillowUrl('median_list_price', 'Metro', {
      propertyType: 'sfrcondo',
      smoothing: 'sm',
      frequency: 'month'
    }),
    filterUS: false,
    filterMetro: true
  },
  
  // Mean Sale Price (add to existing sales_price table)
  {
    id: 'mean-sale-price-us',
    datasetType: 'mean_sale_price',
    tableName: 'zillow_sales_price',
    description: 'Mean Sale Price - United States',
    url: buildZillowUrl('mean_sale_price', 'Metro', {
      propertyType: 'sfrcondo',
      frequency: 'month'
    }),
    filterUS: true,
    filterMetro: false
  },
  {
    id: 'mean-sale-price-metro',
    datasetType: 'mean_sale_price',
    tableName: 'zillow_sales_price',
    description: 'Mean Sale Price - Metro Areas',
    url: buildZillowUrl('mean_sale_price', 'Metro', {
      propertyType: 'sfrcondo',
      frequency: 'month'
    }),
    filterUS: false,
    filterMetro: true
  },
  
  // Sale-to-List Ratio
  {
    id: 'sale-to-list-ratio-us',
    datasetType: 'mean_sale_to_list_ratio',
    tableName: 'zillow_sale_to_list_ratio',
    description: 'Sale-to-List Ratio - United States',
    url: buildZillowUrl('mean_sale_to_list_ratio', 'Metro', {
      propertyType: 'sfrcondo',
      smoothing: 'sm',
      frequency: 'month'
    }),
    filterUS: true,
    filterMetro: false
  },
  {
    id: 'sale-to-list-ratio-metro',
    datasetType: 'mean_sale_to_list_ratio',
    tableName: 'zillow_sale_to_list_ratio',
    description: 'Sale-to-List Ratio - Metro Areas',
    url: buildZillowUrl('mean_sale_to_list_ratio', 'Metro', {
      propertyType: 'sfrcondo',
      smoothing: 'sm',
      frequency: 'month'
    }),
    filterUS: false,
    filterMetro: true
  },
  
  // Days to Close
  {
    id: 'days-to-close-us',
    datasetType: 'mean_doz_close',
    tableName: 'zillow_days_to_close',
    description: 'Days to Close - United States',
    url: buildZillowUrl('mean_doz_close', 'Metro', {
      propertyType: 'sfrcondo',
      smoothing: 'sm',
      frequency: 'month'
    }),
    filterUS: true,
    filterMetro: false
  },
  {
    id: 'days-to-close-metro',
    datasetType: 'mean_doz_close',
    tableName: 'zillow_days_to_close',
    description: 'Days to Close - Metro Areas',
    url: buildZillowUrl('mean_doz_close', 'Metro', {
      propertyType: 'sfrcondo',
      smoothing: 'sm',
      frequency: 'month'
    }),
    filterUS: false,
    filterMetro: true
  },
  
  // Total Transaction Value
  {
    id: 'total-transaction-value-us',
    datasetType: 'total_transaction_value',
    tableName: 'zillow_total_transaction_value',
    description: 'Total Transaction Value - United States',
    url: buildZillowUrl('total_transaction_value', 'Metro', {
      propertyType: 'sfrcondo',
      frequency: 'month'
    }),
    filterUS: true,
    filterMetro: false
  },
  {
    id: 'total-transaction-value-metro',
    datasetType: 'total_transaction_value',
    tableName: 'zillow_total_transaction_value',
    description: 'Total Transaction Value - Metro Areas',
    url: buildZillowUrl('total_transaction_value', 'Metro', {
      propertyType: 'sfrcondo',
      frequency: 'month'
    }),
    filterUS: false,
    filterMetro: true
  }
];

/**
 * Download dataset
 */
async function downloadDataset(url: string): Promise<{ success: boolean; csvContent?: string; error?: string }> {
  try {
    const response = await axios.get(url, {
      timeout: 120000,
      maxContentLength: 200 * 1024 * 1024,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    return { success: true, csvContent: response.data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Determine which table to use and build record structure
 */
function buildRecord(
  regionId: string,
  date: string,
  value: number,
  datasetType: string,
  tableName: string,
  propertyType: string,
  geography: string,
  tier?: string
): any {
  const record: any = {
    region_id: regionId,
    date: date,
    property_type: propertyType,
    geography: geography
  };
  
  if (tableName === 'zillow_zhvi') {
    record.value = value;
    if (tier) record.tier = tier;
  } else if (tableName === 'zillow_zori') {
    record.value = value;
  } else if (tableName === 'zillow_inventory') {
    record.inventory_count = Math.round(value);
  } else if (tableName === 'zillow_sales_count') {
    record.sales_count = Math.round(value);
  } else if (tableName === 'zillow_sales_price') {
    if (datasetType === 'mean_sale_price') {
      record.mean_price = value;
    } else {
      record.median_price = value;
    }
  } else if (tableName === 'zillow_days_to_pending') {
    record.days = value;
  } else if (tableName === 'zillow_market_heat_index') {
    record.heat_index = value;
  } else if (tableName === 'zillow_new_construction_sales_count') {
    record.sales_count = Math.round(value);
  } else if (tableName === 'zillow_new_construction_sale_price') {
    record.median_price = value;
  } else if (tableName === 'zillow_affordability') {
    // Map different affordability metrics to appropriate columns
    if (datasetType === 'new_homeowner_income_needed') {
      record.homeowner_income_needed = value;
      record.down_payment_percent = 20.0;
    } else if (datasetType === 'new_renter_income_needed') {
      record.renter_income_needed = value;
    } else if (datasetType === 'affordable_home_price') {
      record.affordable_home_price = value;
      record.down_payment_percent = 20.0;
    } else if (datasetType === 'years_to_save') {
      record.years_to_save = value;
      record.down_payment_percent = 20.0;
    } else if (datasetType === 'new_homeowner_affordability') {
      record.homeowner_affordability_percent = value;
      record.down_payment_percent = 20.0;
    } else if (datasetType === 'new_renter_affordability') {
      record.renter_affordability_percent = value;
    }
  } else if (tableName === 'zillow_new_listings') {
    record.new_listings_count = Math.round(value);
  } else if (tableName === 'zillow_list_price') {
    record.median_list_price = value;
  } else if (tableName === 'zillow_sale_to_list_ratio') {
    record.mean_ratio = value;
  } else if (tableName === 'zillow_days_to_close') {
    record.mean_days = value;
  } else if (tableName === 'zillow_total_transaction_value') {
    record.total_value = value;
  }
  
  return record;
}

/**
 * Get conflict columns for upsert
 */
function getConflictColumns(tableName: string, datasetType?: string): string {
  if (tableName === 'zillow_zhvi') {
    return 'region_id,date,property_type,tier';
  } else if (tableName === 'zillow_affordability') {
    return 'region_id,date,property_type,down_payment_percent';
  } else if (tableName === 'zillow_sales_price' && datasetType === 'mean_sale_price') {
    // For mean sale price, we need to distinguish from median
    return 'region_id,date,property_type';
  } else {
    return 'region_id,date,property_type';
  }
}

/**
 * Import dataset
 */
async function importDataset(config: DatasetConfig): Promise<{ marketsCreated: number; recordsInserted: number; errors: number }> {
  console.log(`\n📊 Processing: ${config.description}`);
  console.log(`   Table: ${config.tableName}`);
  console.log(`   Filter: ${config.filterUS ? 'US Only' : config.filterMetro ? 'Metro Only' : 'All'}`);
  
  // Download
  console.log(`  📥 Downloading...`);
  const downloadResult = await downloadDataset(config.url);
  if (!downloadResult.success) {
    console.error(`  ❌ Download failed: ${downloadResult.error}`);
    return { marketsCreated: 0, recordsInserted: 0, errors: 1 };
  }
  
  const sizeKB = (downloadResult.csvContent!.length / 1024).toFixed(1);
  console.log(`  ✅ Downloaded ${sizeKB} KB`);
  
  // Parse CSV
  const records: any[] = parseSync(downloadResult.csvContent!, {
    columns: true,
    skip_empty_lines: true
  });
  
  console.log(`  📋 Parsed ${records.length} total rows`);
  
  // Filter records
  let filteredRecords = records;
  if (config.filterUS) {
    // Filter for United States (region_id = 102001 or region_type = 'country')
    filteredRecords = records.filter(r => 
      r.RegionID === '102001' || 
      r.RegionType === 'country' || 
      r.RegionName === 'United States'
    );
    console.log(`  🔍 Filtered to ${filteredRecords.length} US/National rows`);
  } else if (config.filterMetro) {
    // Filter for metro areas only (exclude US)
    filteredRecords = records.filter(r => 
      r.RegionType === 'msa' && 
      r.RegionID !== '102001' &&
      r.RegionName !== 'United States'
    );
    console.log(`  🔍 Filtered to ${filteredRecords.length} Metro rows`);
  }
  
  let marketsCreated = 0;
  let recordsInserted = 0;
  let errors = 0;
  
  // Process each record
  for (const record of filteredRecords) {
    try {
      const regionId = record.RegionID;
      const regionName = record.RegionName;
      const regionType = record.RegionType === 'msa' ? 'msa' : 
                        record.RegionType === 'country' ? 'country' : 
                        record.RegionType;
      const stateName = record.StateName || null;
      const sizeRank = record.SizeRank ? parseInt(record.SizeRank) : null;
      
      if (!regionId || !regionName) {
        continue;
      }
      
      // Upsert market
      const marketData = {
        region_id: regionId,
        region_name: regionName,
        region_type: regionType,
        state_name: stateName || undefined,
        state_code: stateName ? stateName.substring(0, 2).toUpperCase() : undefined,
        size_rank: sizeRank || undefined
      };
      
      const { error: marketError } = await supabase
        .from('markets')
        .upsert(marketData, { onConflict: 'region_id' });
      
      if (marketError) {
        errors++;
        continue;
      }
      
      marketsCreated++;
      
      // Extract time series data
      const dateColumns = Object.keys(record).filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key));
      const timeSeriesData: any[] = [];
      
      // Determine property type based on dataset
      let propertyType = 'sfrcondo';
      if (config.datasetType === 'zori' || 
          config.datasetType === 'new_renter_income_needed' || 
          config.datasetType === 'new_renter_affordability') {
        propertyType = 'sfrcondomfr';
      }
      
      const geography = config.filterUS ? 'United States' : 'Metro';
      const tier = (config.datasetType === 'zhvi' || 
                   config.datasetType === 'new_homeowner_income_needed' ||
                   config.datasetType === 'affordable_home_price' ||
                   config.datasetType === 'years_to_save' ||
                   config.datasetType === 'new_homeowner_affordability') ? '0.33_0.67' : undefined;
      
      for (const dateCol of dateColumns) {
        const value = parseFloat(record[dateCol]);
        if (!isNaN(value) && value !== null && value !== 0) {
          timeSeriesData.push(buildRecord(
            regionId,
            dateCol,
            value,
            config.datasetType,
            config.tableName,
            propertyType,
            geography,
            tier
          ));
        }
      }
      
      // Insert in batches
      if (timeSeriesData.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < timeSeriesData.length; i += batchSize) {
          const batch = timeSeriesData.slice(i, i + batchSize);
          const conflictColumns = getConflictColumns(config.tableName, config.datasetType);
          
          const { error: tsError } = await supabase
            .from(config.tableName)
            .upsert(batch, { onConflict: conflictColumns });
          
          if (tsError) {
            errors++;
          } else {
            recordsInserted += batch.length;
          }
        }
      }
      
    } catch (error: any) {
      errors++;
    }
  }
  
  console.log(`  ✅ Imported: ${marketsCreated} markets, ${recordsInserted} time series records`);
  if (errors > 0) {
    console.log(`  ⚠️  Errors: ${errors}`);
  }
  
  return { marketsCreated, recordsInserted, errors };
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Importing Zillow Data - US/National and Metro Level Only');
  console.log('='.repeat(60));
  console.log(`Total datasets: ${TARGET_DATASETS.length} (6 types × 2 levels)\n`);
  
  const results: Array<{ config: DatasetConfig; marketsCreated: number; recordsInserted: number; errors: number }> = [];
  
  for (const [index, dataset] of TARGET_DATASETS.entries()) {
    console.log(`\n[${index + 1}/${TARGET_DATASETS.length}]`);
    
    try {
      const result = await importDataset(dataset);
      results.push({ config: dataset, ...result });
      
      // Delay between datasets
      if (index < TARGET_DATASETS.length - 1) {
        console.log('  ⏳ Waiting 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error: any) {
      console.error(`  ❌ Fatal error: ${error.message}`);
      results.push({
        config: dataset,
        marketsCreated: 0,
        recordsInserted: 0,
        errors: 1
      });
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.errors === 0);
  const failed = results.filter(r => r.errors > 0);
  
  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  
  let totalMarkets = 0;
  let totalRecords = 0;
  
  results.forEach(r => {
    totalMarkets += r.marketsCreated;
    totalRecords += r.recordsInserted;
  });
  
  console.log(`📊 Total markets created/updated: ${totalMarkets}`);
  console.log(`📊 Total time series records: ${totalRecords.toLocaleString()}`);
  
  // Summary by table
  console.log('\n📋 Summary by Table:');
  const byTable = new Map<string, number>();
  results.forEach(r => {
    const current = byTable.get(r.config.tableName) || 0;
    byTable.set(r.config.tableName, current + r.recordsInserted);
  });
  
  Array.from(byTable.entries()).forEach(([table, count]) => {
    console.log(`  ${table}: ${count.toLocaleString()} records`);
  });
  
  if (failed.length > 0) {
    console.log('\n❌ Failed datasets:');
    failed.forEach(r => {
      console.log(`  - ${r.config.description}: ${r.errors} errors`);
    });
  }
  
  console.log('\n✅ Process complete!');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

