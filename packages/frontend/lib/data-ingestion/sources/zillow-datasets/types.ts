/**
 * Zillow Dataset Type Definitions
 */

export interface ZillowDatasetConfig {
  id: string;
  category: string;
  dataType: string;
  geography: string;
  downloadUrl: string;
  description: string;
  datasetType: string; // zhvi, zori, invt_fs, etc.
  propertyType?: string; // sfrcondo, sfr, condo, etc.
  tier?: string; // top, middle, bottom
  smoothing?: string; // sm (smoothed), raw
  seasonalAdjustment?: boolean; // sa = seasonally adjusted
  frequency?: string; // month, week
}

export interface ZillowUrlOptions {
  propertyType?: string; // 'sfrcondo', 'sfr', 'condo', 'mfr'
  tier?: string; // '0.33_0.67' (middle), '0.67_0.95' (top), '0.05_0.33' (bottom)
  smoothing?: 'sm' | 'raw';
  seasonalAdjustment?: boolean; // adds 'sa' suffix
  frequency?: 'month' | 'week';
  bedroomCount?: number; // 1-5 for bedroom-specific data
  suffix?: string; // custom suffix for special cases
}
