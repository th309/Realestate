import type { MetricConfig } from "../types";

/**
 * AREA PROFILE (Census) + LOCAL ECONOMY (FRED/BEA) + PROPERTYIQ SCORES metrics.
 */
export const DEMOGRAPHICS_METRICS: Record<string, MetricConfig> = {
  // ============================================================================
  // AREA PROFILE (Census)
  // ============================================================================
  population: {
    id: "population",
    title: "Population",
    format: "number",
    dataSource: "census",
    apiEndpoint: "/api/census/population/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "city", "zip"],
    favorableDirection: "higher",
  },

  population_growth: {
    id: "population_growth",
    title: "Population Growth",
    format: "percent",
    dataSource: "census",
    apiEndpoint: "/api/census/population-growth/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "city", "zip"],
    favorableDirection: "higher",
  },

  median_income: {
    id: "median_income",
    title: "Median Income",
    format: "currency",
    dataSource: "census",
    apiEndpoint: "/api/census/median-income/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "city", "zip"],
    favorableDirection: "higher",
  },

  income_growth: {
    id: "income_growth",
    title: "Income Growth",
    format: "percent",
    dataSource: "census",
    apiEndpoint: "/api/census/income-growth/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "city", "zip"],
    favorableDirection: "higher",
  },

  median_age: {
    id: "median_age",
    title: "Median Age",
    format: "number",
    dataSource: "census",
    apiEndpoint: "/api/census/median-age/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "city", "zip"],
    favorableDirection: "neutral",
  },

  homeownership_rate: {
    id: "homeownership_rate",
    title: "Homeownership Rate",
    format: "percent_abs",
    dataSource: "census",
    apiEndpoint: "/api/census/homeownership-rate/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "city", "zip"],
    favorableDirection: "higher",
  },

  // ============================================================================
  // LOCAL ECONOMY (FRED/BEA)
  // ============================================================================
  unemployment_rate: {
    id: "unemployment_rate",
    title: "Unemployment Rate",
    format: "percent_abs",
    dataSource: "fred",
    apiEndpoint: "/api/economic/unemployment/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county"],
    favorableDirection: "lower",
  },

  job_growth: {
    id: "job_growth",
    title: "Job Growth",
    format: "percent",
    dataSource: "fred",
    apiEndpoint: "/api/economic/job-growth/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county"],
    favorableDirection: "higher",
  },

  gdp_growth: {
    id: "gdp_growth",
    title: "GDP Growth",
    format: "percent",
    dataSource: "fred",
    apiEndpoint: "/api/economic/gdp-growth/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county"],
    favorableDirection: "higher",
  },

  cost_of_living: {
    id: "cost_of_living",
    title: "Cost of Living",
    format: "index_1dec",
    dataSource: "fred",
    apiEndpoint: "/api/economic/cost-of-living/{geo}",
    keyField: "auto",
    supportedGeos: ["state", "metro"],
    rangeType: "full",
    favorableDirection: "lower",
  },

  // ============================================================================
  // PROPERTYIQ SCORES
  // ============================================================================
  propertyiq_score: {
    id: "propertyiq_score",
    title: "PropertyIQ Score",
    format: "index",
    dataSource: "propertyiq",
    apiEndpoint: "/api/scores/{geo}/{location_id}",
    keyField: "auto",
    supportedGeos: ["metro", "county", "zip"],
    valueField: "propertyiq_score",
    rangeType: "full",
    hasTimeSeries: true,
    favorableDirection: "higher",
  },
};
