import type { MetricConfig } from "../types";

/**
 * MARKET ACTIVITY + MARKET HEAT & HEALTH metrics.
 */
export const MARKET_ACTIVITY_METRICS: Record<string, MetricConfig> = {
  // ============================================================================
  // MARKET ACTIVITY
  // ============================================================================
  for_sale_inventory: {
    id: "for_sale_inventory",
    title: "Inventory",
    format: "number",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/inventory/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    favorableDirection: "lower",
  },

  inventory_yoy: {
    id: "inventory_yoy",
    title: "Inventory YoY",
    format: "percent",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/inventory-yoy/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    asPercent: true,
    favorableDirection: "lower",
  },

  new_listings: {
    id: "new_listings",
    title: "New Listings",
    format: "number",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/new-listings/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    favorableDirection: "higher",
  },

  pending_listings: {
    id: "pending_listings",
    title: "Pending Listings",
    format: "number",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/pending-listings/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    favorableDirection: "higher",
  },

  home_sales: {
    id: "home_sales",
    title: "Home Sales",
    format: "number",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/home-sales/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    favorableDirection: "higher",
  },

  home_sales_yoy: {
    id: "home_sales_yoy",
    title: "Home Sales YoY",
    format: "percent",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/home-sales-yoy/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    asPercent: true,
    favorableDirection: "higher",
  },

  pending_ratio: {
    id: "pending_ratio",
    title: "Pending Ratio",
    format: "percent_abs",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/pending-ratio/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    favorableDirection: "higher",
  },

  days_on_market: {
    id: "days_on_market",
    title: "Days on Market",
    format: "days",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/dom/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    favorableDirection: "lower",
  },

  // ============================================================================
  // MARKET HEAT & HEALTH
  // ============================================================================
  market_heat: {
    id: "market_heat",
    title: "Market Heat Index",
    format: "index",
    dataSource: "zillow",
    apiEndpoint: "/api/zillow/market-heat/{geo}",
    keyField: "auto",
    supportedGeos: ["metro"],
    rangeType: "full",
    favorableDirection: "higher",
  },

  price_cut_pct: {
    id: "price_cut_pct",
    title: "Price Cut %",
    format: "percent_abs",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/price-reduced/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    asPercent: true,
    favorableDirection: "lower",
  },

  sale_to_list: {
    id: "sale_to_list",
    title: "Sale-to-List Ratio",
    format: "percent_abs",
    dataSource: "zillow",
    apiEndpoint: "/api/zillow/sale-to-list/{geo}",
    keyField: "auto",
    supportedGeos: ["metro"],
    asPercent: true,
    favorableDirection: "higher",
  },
};
