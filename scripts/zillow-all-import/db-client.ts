/**
 * Database client for Zillow All Datasets Import
 *
 * Updated to use new long-format tables:
 * - zillow_state
 * - zillow_metro
 * - zillow_county
 * - zillow_zip
 */

import { join } from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
// Load environment variables from multiple possible locations
config({ path: join(__dirname, '../../.env.local') });
config({ path: join(__dirname, '../../packages/frontend/.env.local') });
config({ path: join(__dirname, '../../packages/backend/.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

/**
 * Create Supabase client for Zillow import
 */
export function createZillowImportClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
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
 * Determine which table to use based on geography
 * New schema uses geography-based tables instead of metric-based tables
 */
export function getTableForGeography(geography: string): string {
  const geoLower = geography.toLowerCase();

  if (geoLower === 'state') return 'zillow_state';
  if (geoLower === 'metro' || geoLower === 'msa') return 'zillow_metro';
  if (geoLower === 'county') return 'zillow_county';
  if (geoLower === 'city') return 'zillow_city';
  if (geoLower === 'zip') return 'zillow_zip';
  if (geoLower === 'united states' || geoLower === 'us') return 'zillow_metro';

  // Default to metro
  return 'zillow_metro';
}

/**
 * Legacy function - maps dataset type to metric name
 * Kept for backwards compatibility during transition
 */
export function getTableName(datasetType: string): string {
  // Now we return the metric name instead of table name
  // This is for backwards compatibility - the new schema uses geography-based tables
  const metricMap: Record<string, string> = {
    // Home Values
    'zhvi': 'zhvi',

    // Forecasts
    'zhvf_growth': 'zhvf',

    // Rentals
    'zori': 'zori',
    'zordi': 'zordi',

    // For-Sale Listings
    'invt_fs': 'inventory',
    'new_listings': 'new_listings',
    'new_pending': 'pending_sales',
    'mlp': 'list_price',

    // Sales
    'sales_count_now': 'sales_count',
    'median_sale_price': 'sale_price',
    'median_sale_price_now': 'sale_price',
    'median_sale_to_list': 'sale_to_list',

    // Days on Market
    'mean_doz_pending': 'dom',
    'median_days_to_close': 'dom',

    // Price Cuts
    'perc_listings_price_cut': 'price_cuts',
    'med_listings_price_cut_amt': 'price_cuts',
    'med_listings_price_cut_perc': 'price_cuts',

    // Market Heat
    'market_temp_index': 'market_heat',

    // New Construction
    'new_con_sales_count_raw': 'new_con_sales',
    'new_con_median_sale_price': 'new_con_price',
    'new_con_median_sale_price_raw': 'new_con_price',
    'new_con_median_sale_price_per_sqft': 'new_con_price_sqft',

    // Affordability
    'new_homeowner_income_needed': 'homeowner_income',
    'new_renter_income_needed': 'renter_income',
    'affordable_home_price': 'affordable_price',
    'affordable_price': 'affordable_price',
    'years_to_save': 'years_to_save',
    'new_homeowner_affordability': 'homeowner_afford',
    'new_renter_affordability': 'renter_afford'
  };

  return metricMap[datasetType] || datasetType;
}

/**
 * Map dataset type to standardized metric name for new schema
 */
export function getMetricName(datasetType: string): string {
  return getTableName(datasetType);
}

/**
 * Get conflict columns for upsert
 * New schema uses (region_id, period_date, metric_name)
 */
export function getConflictColumns(_tableName: string): string {
  return 'region_id,period_date,metric_name';
}
