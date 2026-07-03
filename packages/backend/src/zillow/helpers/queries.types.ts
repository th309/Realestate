/**
 * Query Helper Types
 * Shared type definitions for Zillow long-format query helpers.
 */

export type GeographyType =
  | 'national'
  | 'state'
  | 'metro'
  | 'county'
  | 'city'
  | 'zip';
export type MetricName =
  | 'zhvi'
  | 'zhvi_yoy'
  | 'zori'
  | 'zori_sfr'
  | 'zori_mfr'
  | 'zori_yoy'
  | 'inventory'
  | 'inventory_yoy'
  | 'dom'
  | 'sale_price'
  | 'list_price'
  | 'new_listings'
  | 'pending_sales'
  | 'sale_to_list'
  | 'price_cuts'
  | 'zhvf_1m'
  | 'zhvf_3m'
  | 'zhvf_12m'
  | 'market_heat'
  | 'homeowner_income'
  | 'zordi'
  | 'zordi_sfr'
  | 'zordi_mfr';

export interface ZillowQueryOptions {
  geography: GeographyType;
  metric: MetricName;
  date?: string;
  regionIds?: number[];
  startDate?: string;
  endDate?: string;
}
