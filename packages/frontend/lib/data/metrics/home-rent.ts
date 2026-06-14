import type { MetricConfig } from "../types";

/**
 * HOME VALUES + RENT metrics.
 */
export const HOME_RENT_METRICS: Record<string, MetricConfig> = {
  // ============================================================================
  // HOME VALUES
  // ============================================================================
  home_value: {
    id: "home_value",
    title: "Home Value",
    format: "currency",
    dataSource: "zillow",
    apiEndpoint: "/api/zillow/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "city", "zip"],
    favorableDirection: "higher",
  },

  home_price_forecast: {
    id: "home_price_forecast",
    title: "Home Price Forecast",
    format: "percent",
    dataSource: "zillow",
    apiEndpoint: "/api/zillow/forecast/{geo}",
    keyField: "auto",
    supportedGeos: ["metro", "zip"],
    favorableDirection: "higher",
  },

  home_value_yoy: {
    id: "home_value_yoy",
    title: "Home Value YoY",
    format: "percent",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/home-value-yoy/{geo}",
    keyField: "auto",
    supportedGeos: ["state", "metro", "county", "zip"],
    asPercent: true,
    favorableDirection: "higher",
  },

  home_value_mom: {
    id: "home_value_mom",
    title: "Home Value MoM",
    format: "percent",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/home-value-mom/{geo}",
    keyField: "auto",
    supportedGeos: ["state", "metro", "county", "zip"],
    asPercent: true,
    favorableDirection: "higher",
  },

  home_value_5yr: {
    id: "home_value_5yr",
    title: "5-Year Growth",
    format: "percent",
    dataSource: "realtor",
    apiEndpoint: "/api/metrics/home-value-5yr/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    valueField: "cagr_5yr",
    favorableDirection: "higher",
  },

  home_value_3yr: {
    id: "home_value_3yr",
    title: "3-Year Growth",
    format: "percent",
    dataSource: "realtor",
    apiEndpoint: "/api/metrics/home-value-3yr/{geo}",
    keyField: "auto",
    supportedGeos: ["metro"],
    valueField: "zhvi_3y_cagr",
    favorableDirection: "higher",
  },

  // ============================================================================
  // RENT
  // ============================================================================
  rent_yoy: {
    id: "rent_yoy",
    title: "Rent YoY",
    format: "percent",
    dataSource: "realtor",
    apiEndpoint: "/api/metrics/rent-yoy/{geo}",
    keyField: "auto",
    supportedGeos: ["metro"],
    valueField: "zori_yoy",
    favorableDirection: "higher",
  },

  rent_5yr: {
    id: "rent_5yr",
    title: "Rent 5-Year Growth",
    format: "percent",
    dataSource: "realtor",
    apiEndpoint: "/api/metrics/rent-5yr/{geo}",
    keyField: "auto",
    supportedGeos: ["metro"],
    valueField: "zori_5y_cagr",
    favorableDirection: "higher",
  },

  rent_index: {
    id: "rent_index",
    title: "Rent Index",
    format: "currency",
    dataSource: "zillow",
    apiEndpoint: "/api/zillow/rent/{geo}",
    keyField: "auto",
    supportedGeos: ["metro", "county", "zip"],
    favorableDirection: "higher",
  },

  rent_for_houses: {
    id: "rent_for_houses",
    title: "Renter Demand Index",
    format: "index",
    dataSource: "zillow",
    apiEndpoint: "/api/zillow/demand/{geo}",
    keyField: "auto",
    supportedGeos: ["metro"],
    favorableDirection: "higher",
  },
};
