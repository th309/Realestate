/**
 * Normalized metric column names per Redfin Data Center dashboard.
 *
 * These are the snake_case columns (output of normalizeColumnName) that each
 * dashboard's CSVs carry, shared across every geo level of that dashboard.
 * The migration for each redfin_dc_* table must define exactly these columns
 * plus STD_META_COLUMNS (and any target.textDims). Kept separate from
 * redfin-dc-config.ts to keep that file under the size limit.
 */

export const PRICE_DROPS_COLUMNS = [
  "price_drops",
  "price_drops_mom",
  "price_drops_yoy",
  "average_size_of_price_drop",
  "average_size_of_price_drop_mom",
  "average_size_of_price_drop_yoy",
  "percent_active_with_price_drops",
  "percent_active_with_price_drops_mom",
  "percent_active_with_price_drops_yoy",
];

export const CONTRACT_CANCELLATIONS_COLUMNS = [
  "home_purchase_cancellations",
  "home_purchase_cancellations_mom",
  "home_purchase_cancellations_yoy",
  "percent_of_pending_sales",
  "percent_of_pending_sales_mom",
  "percent_of_pending_sales_yoy",
];

export const DELISTINGS_RELISTINGS_COLUMNS = [
  "total_delistings",
  "total_delistings_mom",
  "total_delistings_yoy",
  "total_relistings",
  "total_relistings_mom",
  "total_relistings_yoy",
  "share_of_listings_delisted",
  "share_of_listings_delisted_mom",
  "share_of_listings_delisted_yoy",
  "share_of_listings_relisted",
  "share_of_listings_relisted_mom",
  "share_of_listings_relisted_yoy",
];

export const HOUSING_MARKET_COLUMNS = [
  "homes_sold",
  "homes_sold_mom",
  "homes_sold_yoy",
  "median_sale_price",
  "median_sale_price_mom",
  "median_sale_price_yoy",
  "median_days_on_market",
  "median_days_on_market_mom",
  "median_days_on_market_yoy",
  "average_sale_to_list_ratio",
  "average_sale_to_list_ratio_mom",
  "average_sale_to_list_ratio_yoy",
  "share_sold_above_original_list",
  "share_sold_above_original_list_mom",
  "share_sold_above_original_list_yoy",
  "new_listings",
  "new_listings_mom",
  "new_listings_yoy",
  "active_listings",
  "active_listings_mom",
  "active_listings_yoy",
  "pending_sales",
  "pending_sales_mom",
  "pending_sales_yoy",
];

/** Union across by_metro (first 3) and by_category (all 4). */
export const INVESTORS_COLUMNS = [
  "investor_home_purchases",
  "investor_home_purchases_yoy",
  "investor_market_share",
  "share_of_investor_home_purchases",
];

export const CASH_LOAN_COLUMNS = [
  "percent_all_cash",
  "percent_all_cash_yoy",
  "median_down_payment",
  "median_down_payment_yoy",
  "median_down_payment_pct",
  "median_down_payment_pct_yoy",
  "percent_fha_loan",
  "percent_fha_loan_yoy",
  "percent_va_loan",
  "percent_va_loan_yoy",
  "percent_conventional_loan",
  "percent_conventional_loan_yoy",
  "percent_conventional_conforming_loan",
  "percent_conventional_conforming_loan_yoy",
  "percent_conventional_jumbo_loan",
  "percent_conventional_jumbo_loan_yoy",
];

export const BUYERS_SELLERS_COLUMNS = [
  "buyers",
  "buyers_yoy",
  "sellers",
  "sellers_yoy",
  "buyer_seller_ratio",
  "buyer_seller_ratio_yoy",
  "seller_buyer_difference",
  "seller_buyer_difference_yoy",
];

export const RHPI_COLUMNS = [
  "redfin_home_price_index",
  "redfin_home_price_index_mom",
  "redfin_home_price_index_yoy",
];
