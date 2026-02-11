export const ZILLOW_URLS: Record<string, string> = {
    // ZHVI (Home Value Index) - Metro only in this config
    zhvi: 'https://files.zillowstatic.com/research/public_csvs/zhvi/Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',

    // ZORI (Observed Rent Index) - Metro, County, ZIP
    zori: 'https://files.zillowstatic.com/research/public_csvs/zori/Metro_zori_uc_sfrcondomfr_sm_sa_month.csv',
    zori_county: 'https://files.zillowstatic.com/research/public_csvs/zori/County_zori_uc_sfrcondomfr_sm_sa_month.csv',
    zori_zip: 'https://files.zillowstatic.com/research/public_csvs/zori/Zip_zori_uc_sfrcondomfr_sm_sa_month.csv',

    // ZORDI (Observed Rent Demand Index) - Metro only (Zillow doesn't provide county/zip)
    zordi: 'https://files.zillowstatic.com/research/public_csvs/zordi/Metro_zordi_uc_sfrcondomfr_month.csv',

    // Market indicators
    inventory: 'https://files.zillowstatic.com/research/public_csvs/invt_fs/Metro_invt_fs_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    daysOnMarket: 'https://files.zillowstatic.com/research/public_csvs/dom/Metro_dom_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    priceCuts: 'https://files.zillowstatic.com/research/public_csvs/price_cuts/Metro_price_cuts_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',

    // New Construction
    new_con_median_price: 'https://files.zillowstatic.com/research/public_csvs/new_con_median_sale_price/Metro_new_con_median_sale_price_uc_sfrcondo_month.csv',
    new_con_median_price_per_sqft: 'https://files.zillowstatic.com/research/public_csvs/new_con_median_sale_price_per_sqft/Metro_new_con_median_sale_price_per_sqft_uc_sfrcondo_month.csv',
};
