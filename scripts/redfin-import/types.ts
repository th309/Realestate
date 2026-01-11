/**
 * Types for Redfin TSV import
 */

export interface MetricColumn {
  name: string
  index: number
  isMoM: boolean
  isYoY: boolean
  baseMetric: string
}

export interface ParsedRow {
  periodBegin: string
  periodEnd: string
  region: string
  regionType: string
  city?: string
  state?: string
  stateCode?: string
  propertyType?: string
  metrics: Record<string, {
    value: number | null
    mom?: number | null
    yoy?: number | null
  }>
}

export interface RedfinMetricsRecord {
  geoid: string
  metric_date: string
  median_sale_price?: number
  median_list_price?: number
  median_ppsf?: number
  homes_sold?: number
  new_listings?: number
  inventory?: number
  months_of_supply?: number
  median_days_on_market?: number
  average_sale_to_list?: number
  compete_score?: number
  bidding_war_percentage?: number
  price_drops_percentage?: number
  median_sale_price_yoy?: number
  homes_sold_yoy?: number
  data_freshness?: string
  // Internal fields for processing
  _regionName?: string
  _regionType?: string
  _stateCode?: string
  _city?: string
  [key: string]: any
}

export interface ImportOptions {
  limitRows?: number
  chunkSize?: number
}
