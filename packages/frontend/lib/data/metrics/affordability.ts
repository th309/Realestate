import type { MetricConfig } from "../types";

/**
 * AFFORDABILITY metrics.
 */
export const AFFORDABILITY_METRICS: Record<string, MetricConfig> = {
  homeowner_affordability: {
    id: "homeowner_affordability",
    title: "Homeowner Affordability %",
    format: "percent_abs",
    dataSource: "zillow",
    apiEndpoint: "/api/zillow/affordability/{geo}",
    keyField: "auto",
    supportedGeos: ["metro"],
    valueField: "homeowner_affordability_percent",
    favorableDirection: "higher",
  },

  renter_affordability: {
    id: "renter_affordability",
    title: "Renter Affordability %",
    format: "percent_abs",
    dataSource: "zillow",
    apiEndpoint: "/api/zillow/affordability/{geo}",
    keyField: "auto",
    supportedGeos: ["metro"],
    valueField: "renter_affordability_percent",
    favorableDirection: "higher",
  },

  years_to_save: {
    id: "years_to_save",
    title: "Years to Save",
    format: "number",
    dataSource: "calculated",
    apiEndpoint: "/api/metrics/years-to-save/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    valueField: "years_to_save",
    hasTimeSeries: true,
    favorableDirection: "lower",
  },

  income_to_buy: {
    id: "income_to_buy",
    title: "Income to Buy",
    format: "currency",
    dataSource: "calculated",
    apiEndpoint: "/api/metrics/income-to-buy/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    valueField: "income_to_buy",
    hasTimeSeries: true,
    favorableDirection: "lower",
  },

  income_to_rent: {
    id: "income_to_rent",
    title: "Income to Rent",
    format: "currency",
    dataSource: "zillow",
    apiEndpoint: "/api/zillow/affordability/{geo}",
    keyField: "auto",
    supportedGeos: ["metro"],
    valueField: "renter_income_needed",
    favorableDirection: "lower",
  },

  affordable_home_price: {
    id: "affordable_home_price",
    title: "Affordable Home Price",
    format: "currency",
    dataSource: "calculated",
    apiEndpoint: "/api/metrics/affordable-home-price/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    valueField: "affordable_home_price",
    hasTimeSeries: true,
    favorableDirection: "higher",
  },
};
