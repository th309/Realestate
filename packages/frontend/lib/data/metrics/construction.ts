import type { MetricConfig } from "../types";

/**
 * NEW CONSTRUCTION + BUILDING PERMITS (Census Bureau BPS) metrics.
 */
export const CONSTRUCTION_METRICS: Record<string, MetricConfig> = {
  // ============================================================================
  // NEW CONSTRUCTION
  // ============================================================================
  new_construction_sales: {
    id: "new_construction_sales",
    title: "New Construction Sales",
    format: "number",
    dataSource: "zillow",
    apiEndpoint: "/api/zillow/new-construction/{geo}",
    keyField: "auto",
    supportedGeos: ["metro"],
    valueField: "sales_count",
    favorableDirection: "higher",
  },

  new_construction_price: {
    id: "new_construction_price",
    title: "New Construction Price",
    format: "currency",
    dataSource: "zillow",
    apiEndpoint: "/api/zillow/new-construction/{geo}",
    keyField: "auto",
    supportedGeos: ["metro"],
    valueField: "median_sale_price",
    favorableDirection: "higher",
  },

  new_construction_ppsf: {
    id: "new_construction_ppsf",
    title: "New Construction $/SqFt",
    format: "currency",
    dataSource: "zillow",
    apiEndpoint: "/api/zillow/new-construction/{geo}",
    keyField: "auto",
    supportedGeos: ["metro"],
    valueField: "price_per_sqft",
    favorableDirection: "higher",
  },

  // ============================================================================
  // BUILDING PERMITS (Census Bureau BPS)
  // ============================================================================
  sf_permits: {
    id: "sf_permits",
    title: "SF Permits",
    format: "number",
    dataSource: "census",
    apiEndpoint: "/api/permits/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "county"],
    valueField: "sf_units",
    scaleMin: 0,
    scaleMax: 200,
    scaleForGeos: ["county"],
    favorableDirection: "higher",
  },

  mf_permits: {
    id: "mf_permits",
    title: "MF Permits",
    format: "number",
    dataSource: "census",
    apiEndpoint: "/api/permits/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "county"],
    valueField: "large_multi_units",
    scaleMin: 0,
    scaleMax: 200,
    scaleForGeos: ["county"],
    favorableDirection: "higher",
  },

  total_permits: {
    id: "total_permits",
    title: "Total Permits",
    format: "number",
    dataSource: "census",
    apiEndpoint: "/api/permits/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "county"],
    valueField: "total_units",
    scaleMin: 0,
    scaleMax: 200,
    scaleForGeos: ["county"],
    favorableDirection: "higher",
  },

  permits_yoy: {
    id: "permits_yoy",
    title: "Permits YoY",
    format: "percent",
    dataSource: "census",
    apiEndpoint: "/api/permits/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "county"],
    valueField: "total_units_yoy",
    favorableDirection: "higher",
  },

  sf_mf_ratio: {
    id: "sf_mf_ratio",
    title: "SF/MF Ratio",
    format: "percent_abs",
    dataSource: "census",
    apiEndpoint: "/api/permits/sf-ratio/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "county"],
    valueField: "sf_ratio",
    includeNullValues: true,
    favorableDirection: "neutral",
  },

  permit_value_per_unit: {
    id: "permit_value_per_unit",
    title: "Permit Value/Unit",
    format: "currency",
    dataSource: "census",
    apiEndpoint: "/api/permits/value-per-unit/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "county"],
    valueField: "value_per_unit",
    favorableDirection: "higher",
  },
};
