import type { MetricConfig } from "../types";

/**
 * LISTING PRICE + MARKET HEAT SCORES (Realtor Hotness) metrics.
 */
export const LISTING_SCORES_METRICS: Record<string, MetricConfig> = {
  // ============================================================================
  // LISTING PRICE
  // ============================================================================
  listing_price: {
    id: "listing_price",
    title: "Listing Price",
    format: "currency",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/listing-price/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    favorableDirection: "higher",
  },

  price_per_sqft: {
    id: "price_per_sqft",
    title: "Price Per Sq Ft",
    format: "currency",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/price-per-sqft/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    favorableDirection: "higher",
  },

  price_increase_pct: {
    id: "price_increase_pct",
    title: "Price Increase %",
    format: "percent_abs",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/price-increased/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    asPercent: true,
    favorableDirection: "higher",
  },

  new_listings_yoy: {
    id: "new_listings_yoy",
    title: "New Listings YoY",
    format: "percent",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/new-listings-yoy/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    asPercent: true,
    favorableDirection: "higher",
  },

  // ============================================================================
  // MARKET HEAT SCORES (Realtor Hotness)
  // ============================================================================
  hotness_score: {
    id: "hotness_score",
    title: "Hotness Score",
    format: "index",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/hotness/{geo}",
    keyField: "auto",
    supportedGeos: ["metro", "county", "zip"],
    rangeType: "full",
    favorableDirection: "higher",
    coverageNote:
      "Realtor.com ranks only higher-volume markets, so greyed areas show no Hotness data.",
  },

  supply_score: {
    id: "supply_score",
    title: "Supply Score",
    format: "index",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/supply-score/{geo}",
    keyField: "auto",
    supportedGeos: ["metro", "county", "zip"],
    rangeType: "full",
    favorableDirection: "lower",
    coverageNote:
      "Realtor.com ranks only higher-volume markets, so greyed areas show no Supply data.",
  },

  demand_score: {
    id: "demand_score",
    title: "Demand Score",
    format: "index",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/demand-score/{geo}",
    keyField: "auto",
    supportedGeos: ["metro", "county", "zip"],
    rangeType: "full",
    favorableDirection: "higher",
    coverageNote:
      "Realtor.com ranks only higher-volume markets, so greyed areas show no Demand data.",
  },
};
