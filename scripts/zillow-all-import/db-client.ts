/**
 * Database client for Zillow All Datasets Import
 */

import { join } from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables from multiple possible locations
config({ path: join(__dirname, '../../.env.local') });
config({ path: join(__dirname, '../../packages/frontend/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

/**
 * Create Supabase client for Zillow import
 */
export function createZillowImportClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/**
 * Determine which table to use based on dataset type
 */
export function getTableName(datasetType: string): string {
  const tableMap: Record<string, string> = {
    // Home Values
    'zhvi': 'zillow_zhvi',

    // Forecasts
    'zhvf_growth': 'zillow_zhvf',

    // Rentals
    'zori': 'zillow_zori',
    'zordi': 'zillow_zordi',

    // For-Sale Listings
    'invt_fs': 'zillow_inventory',
    'new_listings': 'zillow_new_listings',
    'new_pending': 'zillow_pending_listings',
    'mlp': 'zillow_median_list_price',

    // Sales
    'sales_count_now': 'zillow_sales_count',
    'median_sale_price': 'zillow_sales_price',
    'median_sale_price_now': 'zillow_sales_price',
    'median_sale_to_list': 'zillow_sale_to_list',

    // Days on Market
    'mean_doz_pending': 'zillow_days_to_pending',
    'median_days_to_close': 'zillow_days_to_close',

    // Price Cuts
    'perc_listings_price_cut': 'zillow_price_cut_share',
    'med_listings_price_cut_amt': 'zillow_price_cut_amt',
    'med_listings_price_cut_perc': 'zillow_price_cut_pct',

    // Market Heat
    'market_temp_index': 'zillow_market_heat_index',

    // New Construction
    'new_con_sales_count_raw': 'zillow_new_construction_sales_count',
    'new_con_median_sale_price': 'zillow_new_construction_sale_price',
    'new_con_median_sale_price_raw': 'zillow_new_construction_sale_price',
    'new_con_median_sale_price_per_sqft': 'zillow_new_construction_sale_price',

    // Affordability
    'new_homeowner_income_needed': 'zillow_affordability',
    'new_renter_income_needed': 'zillow_affordability',
    'affordable_home_price': 'zillow_affordability',
    'affordable_price': 'zillow_affordability',
    'years_to_save': 'zillow_affordability',
    'new_homeowner_affordability': 'zillow_affordability',
    'new_renter_affordability': 'zillow_affordability'
  };

  return tableMap[datasetType] || 'market_time_series';
}

/**
 * Get conflict columns for upsert based on table
 */
export function getConflictColumns(tableName: string): string {
  if (tableName === 'zillow_zhvi') {
    return 'region_id,date,property_type,tier';
  }

  if (tableName === 'zillow_zhvf') {
    return 'region_id,date,geography';
  }

  if (tableName === 'zillow_zordi') {
    return 'region_id,date,property_type,geography';
  }

  if (tableName === 'zillow_affordability') {
    return 'region_id,date,property_type,down_payment_percent';
  }

  // Tables that use region_id, date, property_type, geography (new migration 026 tables)
  const tablesWithGeography = [
    'zillow_new_listings',
    'zillow_pending_listings',
    'zillow_median_list_price',
    'zillow_sale_to_list',
    'zillow_days_to_close',
    'zillow_price_cut_share',
    'zillow_price_cut_amt',
    'zillow_price_cut_pct'
  ];

  if (tablesWithGeography.includes(tableName)) {
    return 'region_id,date,property_type,geography';
  }

  // Tables that use region_id, date, property_type (older tables)
  const standardTables = [
    'zillow_zori',
    'zillow_inventory',
    'zillow_sales_count',
    'zillow_sales_price',
    'zillow_days_to_pending',
    'zillow_market_heat_index',
    'zillow_new_construction_sales_count',
    'zillow_new_construction_sale_price'
  ];

  if (standardTables.includes(tableName)) {
    return 'region_id,date,property_type';
  }

  return 'region_id,date,metric_name,data_source,attributes';
}
