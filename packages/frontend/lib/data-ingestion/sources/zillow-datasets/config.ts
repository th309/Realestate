/**
 * Zillow Dataset Configuration
 *
 * Pre-configured Zillow datasets based on available data from zillow.com/research/data/
 * Data is updated monthly on the 16th of each month.
 */

import type { ZillowDatasetConfig } from './types'
import { buildZillowUrl } from './url-builder'

/**
 * Pre-configured Zillow datasets
 */
export const ZILLOW_DATASETS: ZillowDatasetConfig[] = [
  // HOME VALUES - ZHVI
  {
    id: 'zhvi-metro-all-homes-sm-sa',
    category: 'HOME VALUES',
    dataType: 'ZHVI All Homes (SFR, Condo/Co-op) Time Series, Smoothed, Seasonally Adjusted($)',
    geography: 'Metro',
    datasetType: 'zhvi',
    propertyType: 'sfrcondo',
    tier: '0.33_0.67',
    smoothing: 'sm',
    seasonalAdjustment: true,
    frequency: 'month',
    downloadUrl: buildZillowUrl('zhvi', 'Metro', {
      propertyType: 'sfrcondo',
      tier: '0.33_0.67',
      smoothing: 'sm',
      seasonalAdjustment: true
    }),
    description: 'Zillow Home Value Index - Metro areas, all homes, smoothed, seasonally adjusted'
  },
  {
    id: 'zhvi-state-all-homes-sm-sa',
    category: 'HOME VALUES',
    dataType: 'ZHVI All Homes (SFR, Condo/Co-op) Time Series, Smoothed, Seasonally Adjusted($)',
    geography: 'State',
    datasetType: 'zhvi',
    propertyType: 'sfrcondo',
    tier: '0.33_0.67',
    smoothing: 'sm',
    seasonalAdjustment: true,
    frequency: 'month',
    downloadUrl: buildZillowUrl('zhvi', 'State', {
      propertyType: 'sfrcondo',
      tier: '0.33_0.67',
      smoothing: 'sm',
      seasonalAdjustment: true
    }),
    description: 'Zillow Home Value Index - States, all homes, smoothed, seasonally adjusted'
  },
  {
    id: 'zhvi-county-all-homes-sm-sa',
    category: 'HOME VALUES',
    dataType: 'ZHVI All Homes (SFR, Condo/Co-op) Time Series, Smoothed, Seasonally Adjusted($)',
    geography: 'County',
    datasetType: 'zhvi',
    propertyType: 'sfrcondo',
    tier: '0.33_0.67',
    smoothing: 'sm',
    seasonalAdjustment: true,
    frequency: 'month',
    downloadUrl: buildZillowUrl('zhvi', 'County', {
      propertyType: 'sfrcondo',
      tier: '0.33_0.67',
      smoothing: 'sm',
      seasonalAdjustment: true
    }),
    description: 'Zillow Home Value Index - Counties, all homes, smoothed, seasonally adjusted'
  },
  {
    id: 'zhvi-city-all-homes-sm-sa',
    category: 'HOME VALUES',
    dataType: 'ZHVI All Homes (SFR, Condo/Co-op) Time Series, Smoothed, Seasonally Adjusted($)',
    geography: 'City',
    datasetType: 'zhvi',
    propertyType: 'sfrcondo',
    tier: '0.33_0.67',
    smoothing: 'sm',
    seasonalAdjustment: true,
    frequency: 'month',
    downloadUrl: buildZillowUrl('zhvi', 'City', {
      propertyType: 'sfrcondo',
      tier: '0.33_0.67',
      smoothing: 'sm',
      seasonalAdjustment: true
    }),
    description: 'Zillow Home Value Index - Cities, all homes, smoothed, seasonally adjusted'
  },
  {
    id: 'zhvi-zip-all-homes-sm-sa',
    category: 'HOME VALUES',
    dataType: 'ZHVI All Homes (SFR, Condo/Co-op) Time Series, Smoothed, Seasonally Adjusted($)',
    geography: 'ZIP',
    datasetType: 'zhvi',
    propertyType: 'sfrcondo',
    tier: '0.33_0.67',
    smoothing: 'sm',
    seasonalAdjustment: true,
    frequency: 'month',
    downloadUrl: buildZillowUrl('zhvi', 'Zip', {
      propertyType: 'sfrcondo',
      tier: '0.33_0.67',
      smoothing: 'sm',
      seasonalAdjustment: true
    }),
    description: 'Zillow Home Value Index - ZIP codes, all homes, smoothed, seasonally adjusted'
  },

  // HOME VALUES - ZHVI (US/National)
  {
    id: 'zhvi-us-all-homes-sm-sa',
    category: 'HOME VALUES',
    dataType: 'ZHVI All Homes (SFR, Condo/Co-op) Time Series, Smoothed, Seasonally Adjusted($)',
    geography: 'United States',
    datasetType: 'zhvi',
    propertyType: 'sfrcondo',
    tier: '0.33_0.67',
    smoothing: 'sm',
    seasonalAdjustment: true,
    frequency: 'month',
    downloadUrl: buildZillowUrl('zhvi', 'Metro', {
      propertyType: 'sfrcondo',
      tier: '0.33_0.67',
      smoothing: 'sm',
      seasonalAdjustment: true
    }),
    description: 'Zillow Home Value Index - United States (from Metro file), all homes, smoothed, seasonally adjusted'
  },

  // RENTALS - ZORI
  {
    id: 'zori-us-all-homes-sm',
    category: 'RENTALS',
    dataType: 'ZORI (Smoothed): All Homes Plus Multifamily Time Series ($)',
    geography: 'United States',
    datasetType: 'zori',
    propertyType: 'sfrcondomfr',
    smoothing: 'sm',
    frequency: 'month',
    downloadUrl: buildZillowUrl('zori', 'Metro', {
      propertyType: 'sfrcondomfr',
      smoothing: 'sm'
    }),
    description: 'Zillow Observed Rent Index - United States (from Metro file), all homes plus multifamily, smoothed'
  },
  {
    id: 'zori-metro-all-homes-sm',
    category: 'RENTALS',
    dataType: 'ZORI (Smoothed): All Homes Plus Multifamily Time Series ($)',
    geography: 'Metro',
    datasetType: 'zori',
    propertyType: 'sfrcondomfr',
    smoothing: 'sm',
    frequency: 'month',
    downloadUrl: buildZillowUrl('zori', 'Metro', {
      propertyType: 'sfrcondomfr',
      smoothing: 'sm'
    }),
    description: 'Zillow Observed Rent Index - Metro areas, all homes plus multifamily, smoothed'
  },
  {
    id: 'zori-metro-all-homes-sm-sa',
    category: 'RENTALS',
    dataType: 'ZORI (Smoothed, Seasonally Adjusted): All Homes Plus Multifamily Time Series ($)',
    geography: 'Metro',
    datasetType: 'zori',
    propertyType: 'sfrcondomfr',
    smoothing: 'sm',
    seasonalAdjustment: true,
    frequency: 'month',
    downloadUrl: buildZillowUrl('zori', 'Metro', {
      propertyType: 'sfrcondomfr',
      smoothing: 'sm',
      seasonalAdjustment: true
    }),
    description: 'Zillow Observed Rent Index - Metro areas, all homes plus multifamily, smoothed, seasonally adjusted'
  },
  {
    id: 'zori-county-all-homes-sm',
    category: 'RENTALS',
    dataType: 'ZORI (Smoothed): All Homes Plus Multifamily Time Series ($)',
    geography: 'County',
    datasetType: 'zori',
    propertyType: 'sfrcondomfr',
    smoothing: 'sm',
    frequency: 'month',
    downloadUrl: buildZillowUrl('zori', 'County', {
      propertyType: 'sfrcondomfr',
      smoothing: 'sm'
    }),
    description: 'Zillow Observed Rent Index - Counties, all homes plus multifamily, smoothed'
  },
  {
    id: 'zori-city-all-homes-sm',
    category: 'RENTALS',
    dataType: 'ZORI (Smoothed): All Homes Plus Multifamily Time Series ($)',
    geography: 'City',
    datasetType: 'zori',
    propertyType: 'sfrcondomfr',
    smoothing: 'sm',
    frequency: 'month',
    downloadUrl: buildZillowUrl('zori', 'City', {
      propertyType: 'sfrcondomfr',
      smoothing: 'sm'
    }),
    description: 'Zillow Observed Rent Index - Cities, all homes plus multifamily, smoothed'
  },

  // FOR-SALE LISTINGS - Inventory
  {
    id: 'inventory-metro-all-homes-sm-month',
    category: 'FOR-SALE LISTINGS',
    dataType: 'For-Sale Inventory (Smooth, All Homes, Monthly)',
    geography: 'Metro',
    datasetType: 'invt_fs',
    propertyType: 'sfrcondo',
    smoothing: 'sm',
    frequency: 'month',
    downloadUrl: buildZillowUrl('invt_fs', 'Metro', {
      propertyType: 'sfrcondo',
      smoothing: 'sm',
      frequency: 'month'
    }),
    description: 'For-Sale Inventory - Metro areas, all homes, smoothed, monthly'
  },
  {
    id: 'inventory-metro-all-homes-sm-week',
    category: 'FOR-SALE LISTINGS',
    dataType: 'For-Sale Inventory (Smooth, All Homes, Weekly)',
    geography: 'Metro',
    datasetType: 'invt_fs',
    propertyType: 'sfrcondo',
    smoothing: 'sm',
    frequency: 'week',
    downloadUrl: buildZillowUrl('invt_fs', 'Metro', {
      propertyType: 'sfrcondo',
      smoothing: 'sm',
      frequency: 'week'
    }),
    description: 'For-Sale Inventory - Metro areas, all homes, smoothed, weekly'
  },

  // SALES
  {
    id: 'sales-count-metro-nowcast',
    category: 'SALES',
    dataType: 'Sales Count (Nowcast, All Homes, Monthly)',
    geography: 'Metro',
    datasetType: 'sales_count_now',
    propertyType: 'sfrcondo',
    frequency: 'month',
    downloadUrl: buildZillowUrl('sales_count_now', 'Metro', {
      propertyType: 'sfrcondo',
      frequency: 'month'
    }),
    description: 'Sales Count Nowcast - Metro areas, all homes, monthly'
  },
  {
    id: 'sales-price-median-metro-nowcast',
    category: 'SALES',
    dataType: 'Median Sale Price (Nowcast, All Homes, Monthly)',
    geography: 'Metro',
    datasetType: 'median_sale_price',
    propertyType: 'sfrcondo',
    frequency: 'month',
    downloadUrl: buildZillowUrl('median_sale_price', 'Metro', {
      propertyType: 'sfrcondo',
      frequency: 'month'
    }),
    description: 'Median Sale Price Nowcast - Metro areas, all homes, monthly'
  },

  // DAYS ON MARKET
  {
    id: 'days-pending-metro-sm-month',
    category: 'DAYS ON MARKET AND PRICE CUTS',
    dataType: 'Mean Days to Pending (Smooth, All Homes, Monthly)',
    geography: 'Metro',
    datasetType: 'mean_doz_pending',
    propertyType: 'sfrcondo',
    smoothing: 'sm',
    frequency: 'month',
    downloadUrl: buildZillowUrl('mean_doz_pending', 'Metro', {
      propertyType: 'sfrcondo',
      smoothing: 'sm',
      frequency: 'month'
    }),
    description: 'Mean Days to Pending - Metro areas, all homes, smoothed, monthly'
  },

  // MARKET HEAT INDEX
  {
    id: 'market-heat-index-metro',
    category: 'MARKET HEAT INDEX',
    dataType: 'Market Heat Index (All Homes, Monthly)',
    geography: 'Metro',
    datasetType: 'market_temp_index',
    propertyType: 'sfrcondo',
    frequency: 'month',
    downloadUrl: 'https://files.zillowstatic.com/research/public_csvs/market_temp_index/Metro_market_temp_index_uc_sfrcondo_month.csv',
    description: 'Market Heat Index - Metro areas, all homes, monthly'
  },

  // NEW CONSTRUCTION
  {
    id: 'new-construction-sales-count-metro',
    category: 'NEW CONSTRUCTION',
    dataType: 'New Construction Sales Count (Raw, All Homes, Monthly)',
    geography: 'Metro',
    datasetType: 'new_con_sales_count_raw',
    propertyType: 'sfrcondo',
    frequency: 'month',
    downloadUrl: 'https://files.zillowstatic.com/research/public_csvs/new_con_sales_count_raw/Metro_new_con_sales_count_raw_uc_sfrcondo_month.csv',
    description: 'New Construction Sales Count - Metro areas, all homes, monthly'
  },
  {
    id: 'new-construction-sale-price-metro',
    category: 'NEW CONSTRUCTION',
    dataType: 'New Construction Median Sale Price (Raw, All Homes, Monthly)',
    geography: 'Metro',
    datasetType: 'new_con_median_sale_price',
    propertyType: 'sfrcondo',
    frequency: 'month',
    downloadUrl: 'https://files.zillowstatic.com/research/public_csvs/new_con_median_sale_price_raw/Metro_new_con_median_sale_price_raw_uc_sfrcondo_month.csv',
    description: 'New Construction Median Sale Price - Metro areas, all homes, monthly'
  },

  // AFFORDABILITY
  {
    id: 'affordability-homeowner-income-metro',
    category: 'AFFORDABILITY',
    dataType: 'New Homeowner Income Needed: 20% down, All Homes, Smoothed & Seasonally Adjusted Time Series',
    geography: 'Metro',
    datasetType: 'new_homeowner_income_needed',
    propertyType: 'sfrcondo',
    tier: '0.33_0.67',
    smoothing: 'sm',
    seasonalAdjustment: true,
    frequency: 'month',
    downloadUrl: 'https://files.zillowstatic.com/research/public_csvs/new_homeowner_income_needed/Metro_new_homeowner_income_needed_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    description: 'New Homeowner Income Needed - Metro areas, 20% down, all homes, smoothed, seasonally adjusted'
  },
  {
    id: 'affordability-renter-income-metro',
    category: 'AFFORDABILITY',
    dataType: 'New Renter Income Needed: All Homes, Smoothed & Seasonally Adjusted Time Series',
    geography: 'Metro',
    datasetType: 'new_renter_income_needed',
    propertyType: 'sfrcondomfr',
    smoothing: 'sm',
    seasonalAdjustment: true,
    frequency: 'month',
    downloadUrl: 'https://files.zillowstatic.com/research/public_csvs/new_renter_income_needed/Metro_new_renter_income_needed_uc_sfrcondomfr_sm_sa_month.csv',
    description: 'New Renter Income Needed - Metro areas, all homes, smoothed, seasonally adjusted'
  },
  {
    id: 'affordability-home-price-metro',
    category: 'AFFORDABILITY',
    dataType: 'Affordable Home Price: 20% down, All Homes, Smoothed & Seasonally Adjusted Time Series',
    geography: 'Metro',
    datasetType: 'affordable_home_price',
    propertyType: 'sfrcondo',
    tier: '0.33_0.67',
    smoothing: 'sm',
    seasonalAdjustment: true,
    frequency: 'month',
    downloadUrl: 'https://files.zillowstatic.com/research/public_csvs/affordable_home_price/Metro_affordable_home_price_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    description: 'Affordable Home Price - Metro areas, 20% down, all homes, smoothed, seasonally adjusted'
  },
  {
    id: 'affordability-years-to-save-metro',
    category: 'AFFORDABILITY',
    dataType: 'Years to Save: 20% down, All Homes, Smoothed & Seasonally Adjusted Time Series',
    geography: 'Metro',
    datasetType: 'years_to_save',
    propertyType: 'sfrcondo',
    tier: '0.33_0.67',
    smoothing: 'sm',
    seasonalAdjustment: true,
    frequency: 'month',
    downloadUrl: 'https://files.zillowstatic.com/research/public_csvs/years_to_save/Metro_years_to_save_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    description: 'Years to Save - Metro areas, 20% down, all homes, smoothed, seasonally adjusted'
  },
  {
    id: 'affordability-homeowner-percent-metro',
    category: 'AFFORDABILITY',
    dataType: 'New Homeowner Affordability: 20% down, All Homes, Smoothed & Seasonally Adjusted Time Series',
    geography: 'Metro',
    datasetType: 'new_homeowner_affordability',
    propertyType: 'sfrcondo',
    tier: '0.33_0.67',
    smoothing: 'sm',
    seasonalAdjustment: true,
    frequency: 'month',
    downloadUrl: 'https://files.zillowstatic.com/research/public_csvs/new_homeowner_affordability/Metro_new_homeowner_affordability_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    description: 'New Homeowner Affordability - Metro areas, 20% down, all homes, smoothed, seasonally adjusted'
  },
  {
    id: 'affordability-renter-percent-metro',
    category: 'AFFORDABILITY',
    dataType: 'New Renter Affordability: All Homes, Smoothed & Seasonally Adjusted Time Series',
    geography: 'Metro',
    datasetType: 'new_renter_affordability',
    propertyType: 'sfrcondomfr',
    smoothing: 'sm',
    seasonalAdjustment: true,
    frequency: 'month',
    downloadUrl: 'https://files.zillowstatic.com/research/public_csvs/new_renter_affordability/Metro_new_renter_affordability_uc_sfrcondomfr_sm_sa_month.csv',
    description: 'New Renter Affordability - Metro areas, all homes, smoothed, seasonally adjusted'
  }
];
