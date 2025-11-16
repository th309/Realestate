// Database Types for PropertyIQ Edge Functions
// Auto-generated types based on PostgreSQL schema

export interface SpatialUpload {
  id: string;
  upload_name: string;
  file_type: 'geojson' | 'csv' | 'shapefile' | 'kml' | 'gpx';
  files: Record<string, any>;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at?: string;
  updated_at?: string;
}

export interface SpatialStaging {
  id?: string;
  upload_id: string;
  geometry_wgs84: any; // PostGIS geometry type
  properties: Record<string, any>;
  extracted_name?: string;
  created_at?: string;
}

export interface StagingData {
  id?: string;
  source_id: string;
  raw_data: Record<string, any>;
  normalization_results?: NormalizationResult;
  created_at?: string;
  updated_at?: string;
}

export interface NormalizationResult {
  geoid: string;
  confidence: number;
  match_type: string;
  metadata?: Record<string, any>;
}

export interface SubscriberReport {
  id?: string;
  user_id: string;
  report_name: string;
  report_type: string;
  full_data: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface MasterMarketIntelligence {
  geoid: string;
  geography_name: string;
  state_code: string;
  county_name?: string;
  cbsa_code?: string;
  cbsa_name?: string;
  population?: number;
  households?: number;
  median_income?: number;
  median_home_value?: number;
  median_rent?: number;
  unemployment_rate?: number;
  poverty_rate?: number;
  college_educated_pct?: number;
  owner_occupied_pct?: number;
  renter_occupied_pct?: number;
  vacancy_rate?: number;
  median_age?: number;
  population_growth_1yr?: number;
  population_growth_5yr?: number;
  home_value_growth_1yr?: number;
  home_value_growth_5yr?: number;
  rent_growth_1yr?: number;
  rent_growth_5yr?: number;
  employment_growth_1yr?: number;
  employment_growth_5yr?: number;
  data_freshness?: string;
  last_updated?: string;
}

export interface ProcessUploadRequest {
  file_id: string;
  file_type: 'geojson' | 'csv' | 'shapefile';
  options?: {
    encoding?: string;
    delimiter?: string;
    headers?: boolean;
  };
}

export interface ProcessUploadResponse {
  success: boolean;
  processed_count: number;
  errors?: string[];
  upload_id?: string;
}

export interface NormalizeLocationRequest {
  locations: Array<{
    id: string;
    text: string;
    state?: string;
  }>;
}

export interface NormalizeLocationResponse {
  results: Array<{
    id: string;
    geoid: string;
    confidence: number;
    match_type: string;
    error?: string;
  }>;
}

export interface GenerateReportRequest {
  report_type: 'market_analysis' | 'comparative' | 'trend' | 'custom';
  geoids: string[];
  options: {
    include_demographics?: boolean;
    include_housing?: boolean;
    include_economics?: boolean;
    include_trends?: boolean;
    time_period?: string;
    format?: 'json' | 'pdf' | 'excel';
  };
}

export interface GenerateReportResponse {
  report_id: string;
  preview: {
    title: string;
    summary: string;
    key_metrics: Record<string, any>;
  };
  download_url?: string;
}
