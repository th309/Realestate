/**
 * Database client for Zillow All Datasets Import
 */

import { join } from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: join(__dirname, '../../web/.env.local') });

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
    'zhvi': 'zillow_zhvi',
    'zori': 'zillow_zori',
    'invt_fs': 'zillow_inventory',
    'sales_count_now': 'zillow_sales_count',
    'median_sale_price': 'zillow_sales_price',
    'mean_doz_pending': 'zillow_days_to_pending'
  };

  return tableMap[datasetType] || 'market_time_series';
}

/**
 * Get conflict columns for upsert based on table
 */
export function getConflictColumns(tableName: string): string {
  if (tableName === 'zillow_zhvi') {
    return 'region_id,date,property_type,tier';
  } else if (['zillow_zori', 'zillow_inventory', 'zillow_sales_count', 'zillow_sales_price', 'zillow_days_to_pending'].includes(tableName)) {
    return 'region_id,date,property_type';
  }
  return 'region_id,date,metric_name,data_source,attributes';
}
