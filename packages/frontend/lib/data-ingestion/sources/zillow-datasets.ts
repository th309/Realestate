/**
 * Zillow Dataset Configuration
 *
 * Defines all Zillow datasets available for import, including
 * download URLs, metric types, and geography levels.
 *
 * URL pattern: https://files.zillowstatic.com/research/public_csvs/{type}/{Geo}_{type}_{suffix}.csv
 */

export interface DatasetConfig {
  id: string;
  downloadUrl: string;
  description: string;
  datasetType: string;
  geography: string;
}

const BASE = 'https://files.zillowstatic.com/research/public_csvs';

export const ZILLOW_DATASETS: DatasetConfig[] = [
  // ── ZHVI (Home Value Index) ──────────────────────────────────────────
  {
    id: 'zhvi-state',
    downloadUrl: `${BASE}/zhvi/State_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`,
    description: 'ZHVI (Home Value Index) - State',
    datasetType: 'zhvi',
    geography: 'state',
  },
  {
    id: 'zhvi-metro',
    downloadUrl: `${BASE}/zhvi/Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`,
    description: 'ZHVI (Home Value Index) - Metro',
    datasetType: 'zhvi',
    geography: 'metro',
  },
  {
    id: 'zhvi-county',
    downloadUrl: `${BASE}/zhvi/County_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`,
    description: 'ZHVI (Home Value Index) - County',
    datasetType: 'zhvi',
    geography: 'county',
  },
  {
    id: 'zhvi-zip',
    downloadUrl: `${BASE}/zhvi/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`,
    description: 'ZHVI (Home Value Index) - ZIP',
    datasetType: 'zhvi',
    geography: 'zip',
  },

  // ── ZORI (Observed Rent Index) ───────────────────────────────────────
  // Note: Zillow does not publish state-level ZORI data
  {
    id: 'zori-metro',
    downloadUrl: `${BASE}/zori/Metro_zori_uc_sfrcondomfr_sm_sa_month.csv`,
    description: 'ZORI (Rent Index) - Metro',
    datasetType: 'zori',
    geography: 'metro',
  },
  {
    id: 'zori-county',
    downloadUrl: `${BASE}/zori/County_zori_uc_sfrcondomfr_sm_sa_month.csv`,
    description: 'ZORI (Rent Index) - County',
    datasetType: 'zori',
    geography: 'county',
  },
  {
    id: 'zori-zip',
    downloadUrl: `${BASE}/zori/Zip_zori_uc_sfrcondomfr_sm_sa_month.csv`,
    description: 'ZORI (Rent Index) - ZIP',
    datasetType: 'zori',
    geography: 'zip',
  },

  // ── ZORDI (Observed Rent Demand Index) ───────────────────────────────
  {
    id: 'zordi-metro',
    downloadUrl: `${BASE}/zordi/Metro_zordi_uc_sfrcondomfr_month.csv`,
    description: 'ZORDI (Rent Demand) - Metro',
    datasetType: 'zordi',
    geography: 'metro',
  },

  // ── Inventory (For-Sale) ─────────────────────────────────────────────
  // Note: Zillow does not publish state-level inventory data
  {
    id: 'inventory-metro',
    downloadUrl: `${BASE}/invt_fs/Metro_invt_fs_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`,
    description: 'For-Sale Inventory - Metro',
    datasetType: 'invt_fs',
    geography: 'metro',
  },
  {
    id: 'inventory-county',
    downloadUrl: `${BASE}/invt_fs/County_invt_fs_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`,
    description: 'For-Sale Inventory - County',
    datasetType: 'invt_fs',
    geography: 'county',
  },

  // ── Days on Market ───────────────────────────────────────────────────
  {
    id: 'dom-metro',
    downloadUrl: `${BASE}/mean_doz_pending/Metro_mean_doz_pending_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`,
    description: 'Days on Market - Metro',
    datasetType: 'mean_doz_pending',
    geography: 'metro',
  },

  // ── Price Cuts ───────────────────────────────────────────────────────
  {
    id: 'price-cuts-metro',
    downloadUrl: `${BASE}/perc_listings_price_cut/Metro_perc_listings_price_cut_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`,
    description: 'Price Cuts (%) - Metro',
    datasetType: 'perc_listings_price_cut',
    geography: 'metro',
  },

  // ── Market Heat Index ────────────────────────────────────────────────
  {
    id: 'market-heat-metro',
    downloadUrl: `${BASE}/market_temp_index/Metro_market_temp_index_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`,
    description: 'Market Heat Index - Metro',
    datasetType: 'market_temp_index',
    geography: 'metro',
  },

  // ── New Construction ─────────────────────────────────────────────────
  {
    id: 'new-con-price-metro',
    downloadUrl: `${BASE}/new_con_median_sale_price/Metro_new_con_median_sale_price_uc_sfrcondo_month.csv`,
    description: 'New Construction Median Price - Metro',
    datasetType: 'new_con_median_sale_price',
    geography: 'metro',
  },
  {
    id: 'new-con-price-sqft-metro',
    downloadUrl: `${BASE}/new_con_median_sale_price_per_sqft/Metro_new_con_median_sale_price_per_sqft_uc_sfrcondo_month.csv`,
    description: 'New Construction Price/SqFt - Metro',
    datasetType: 'new_con_median_sale_price_per_sqft',
    geography: 'metro',
  },

  // ── Sales Count ──────────────────────────────────────────────────────
  // Note: Zillow does not publish state-level sales count data
  {
    id: 'sales-count-metro',
    downloadUrl: `${BASE}/sales_count_now/Metro_sales_count_now_uc_sfrcondo_tier_0.33_0.67_month.csv`,
    description: 'Sales Count - Metro',
    datasetType: 'sales_count_now',
    geography: 'metro',
  },

  // ── Sale-to-List Ratio ───────────────────────────────────────────────
  {
    id: 'sale-to-list-metro',
    downloadUrl: `${BASE}/median_sale_to_list/Metro_median_sale_to_list_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`,
    description: 'Sale-to-List Ratio - Metro',
    datasetType: 'median_sale_to_list',
    geography: 'metro',
  },

  // ── New Listings ─────────────────────────────────────────────────────
  // Note: Zillow does not publish state-level new listings data
  {
    id: 'new-listings-metro',
    downloadUrl: `${BASE}/new_listings/Metro_new_listings_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`,
    description: 'New Listings - Metro',
    datasetType: 'new_listings',
    geography: 'metro',
  },
];
