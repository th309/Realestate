/**
 * Zillow URL Pattern Generation
 */

import type { ZillowDataset, DatasetPattern } from './types';
import { ZILLOW_FILES_BASE } from './types';

/**
 * Known URL patterns based on Zillow data page structure
 */
export const KNOWN_PATTERNS: Record<string, DatasetPattern> = {
  'HOME VALUES': {
    dataset: 'zhvi',
    geographies: ['Metro', 'State', 'County', 'City', 'ZIP', 'Neighborhood'],
    types: [
      { suffix: 'uc_sfrcondo_tier_0.33_0.67_sm_sa_month', name: 'ZHVI All Homes (SFR, Condo/Co-op) Time Series, Smoothed, Seasonally Adjusted($)' },
      { suffix: 'uc_sfrcondo_tier_0.33_0.67_month', name: 'ZHVI All Homes (SFR, Condo/Co-op) Time Series, Raw, Mid-Tier ($)' },
      { suffix: 'uc_sfrcondo_tier_0.67_0.95_month', name: 'ZHVI All Homes- Top Tier Time Series ($)' },
      { suffix: 'uc_sfrcondo_tier_0.05_0.33_month', name: 'ZHVI All Homes- Bottom Tier Time Series ($)' },
      { suffix: 'uc_sfr_month', name: 'ZHVI Single-Family Homes Time Series ($)' },
      { suffix: 'uc_condo_month', name: 'ZHVI Condo/Co-op Time Series ($)' },
      { suffix: 'uc_1bedroom_month', name: 'ZHVI 1-Bedroom Time Series ($)' },
      { suffix: 'uc_2bedroom_month', name: 'ZHVI 2-Bedroom Time Series ($)' },
      { suffix: 'uc_3bedroom_month', name: 'ZHVI 3-Bedroom Time Series ($)' },
      { suffix: 'uc_4bedroom_month', name: 'ZHVI 4-Bedroom Time Series ($)' },
      { suffix: 'uc_5bedroom_month', name: 'ZHVI 5+ Bedroom Time Series ($)' }
    ]
  },
  'HOME VALUES FORECASTS': {
    dataset: 'zhvf_growth',
    geographies: ['Metro', 'ZIP'],
    types: [
      { suffix: 'uc_sfrcondo_tier_0.33_0.67_sm_sa_month', name: 'ZHVF (Forecast), All Homes (SFR, Condo/Co-op), Smoothed, Seasonally Adjusted, Mid-Tier (MoM%, QoQ%, YoY%)' },
      { suffix: 'uc_sfrcondo_tier_0.33_0.67_month', name: 'ZHVF (Forecast), All Homes (SFR, Condo/Co-op), Raw, Mid-Tier (MoM%, QoQ%, YoY%)' }
    ]
  },
  'RENTALS': {
    dataset: 'zori',
    geographies: ['Metro', 'ZIP', 'County', 'City'],
    types: [
      { suffix: 'uc_sfrcondomfr_sm_month', name: 'ZORI (Smoothed): All Homes Plus Multifamily Time Series ($)' },
      { suffix: 'uc_sfrcondomfr_sm_sa_month', name: 'ZORI (Smoothed, Seasonally Adjusted): All Homes Plus Multifamily Time Series ($)' },
      { suffix: 'uc_sfr_sm_month', name: 'ZORI (Smoothed): Single Family Residence Time Series ($)' },
      { suffix: 'uc_sfr_sm_sa_month', name: 'ZORI (Smoothed, Seasonally Adjusted): Single Family Residence Time Series ($)' },
      { suffix: 'uc_mfr_sm_month', name: 'ZORI (Smoothed): Multi Family Residence Time Series ($)' },
      { suffix: 'uc_mfr_sm_sa_month', name: 'ZORI (Smoothed, Seasonally Adjusted): Multi Family Residence Time Series ($)' }
    ]
  },
  'FOR-SALE LISTINGS': {
    dataset: 'invt_fs',
    geographies: ['Metro'],
    types: [
      { suffix: 'uc_sfrcondo_sm_month', name: 'For-Sale Inventory (Smooth, All Homes, Monthly)' },
      { suffix: 'uc_sfrcondo_sm_week', name: 'For-Sale Inventory (Smooth, All Homes, Weekly)' },
      { suffix: 'uc_sfr_sm_month', name: 'For-Sale Inventory (Smooth, SFR Only, Monthly)' },
      { suffix: 'uc_sfr_sm_week', name: 'For-Sale Inventory (Smooth, SFR Only, Weekly)' }
    ]
  },
  'SALES': {
    dataset: 'sales_count_now',
    geographies: ['Metro'],
    types: [
      { suffix: 'uc_sfrcondo_month', name: 'Sales Count (Nowcast, All Homes, Monthly)' }
    ]
  }
};

/**
 * Generate URL patterns based on known Zillow dataset structure
 */
export function generateKnownUrlPatterns(): ZillowDataset[] {
  console.log('\n📋 Generating known URL patterns...');

  const datasets: ZillowDataset[] = [];

  Object.entries(KNOWN_PATTERNS).forEach(([category, config]) => {
    config.geographies.forEach(geo => {
      config.types.forEach(type => {
        const filename = `${geo}_${config.dataset}_${type.suffix}`;
        const url = `${ZILLOW_FILES_BASE}/${config.dataset}/${filename}.csv`;

        datasets.push({
          category,
          dataType: type.name,
          geography: geo,
          downloadUrl: url,
          description: `${config.dataset} - ${geo} - ${type.name}`
        });
      });
    });
  });

  console.log(`✅ Generated ${datasets.length} URL patterns`);

  return datasets;
}

/**
 * Build a Zillow CSV URL from components
 */
export function buildZillowCsvUrl(dataset: string, geography: string, suffix: string): string {
  const filename = `${geography}_${dataset}_${suffix}`;
  return `${ZILLOW_FILES_BASE}/${dataset}/${filename}.csv`;
}
