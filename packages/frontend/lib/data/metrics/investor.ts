import type { MetricConfig } from "../types";

/**
 * INVESTOR METRICS.
 */
export const INVESTOR_METRICS: Record<string, MetricConfig> = {
  cap_rate: {
    id: "cap_rate",
    title: "Cap Rate",
    format: "percent_abs",
    dataSource: "calculated",
    apiEndpoint: "/api/metrics/cap-rate/{geo}",
    keyField: "auto",
    supportedGeos: ["metro", "county", "zip"],
    valueField: "cap_rate",
    hasTimeSeries: true,
    favorableDirection: "higher",
  },

  gross_yield: {
    id: "gross_yield",
    title: "Gross Yield",
    format: "percent_abs",
    dataSource: "calculated",
    apiEndpoint: "/api/metrics/gross-yield/{geo}",
    keyField: "auto",
    supportedGeos: ["metro", "county", "zip"],
    valueField: "gross_yield",
    hasTimeSeries: true,
    favorableDirection: "higher",
  },

  grm: {
    id: "grm",
    title: "Gross Rent Multiplier",
    format: "number",
    dataSource: "calculated",
    apiEndpoint: "/api/metrics/grm/{geo}",
    keyField: "auto",
    supportedGeos: ["metro", "county", "zip"],
    valueField: "grm",
    hasTimeSeries: true,
    favorableDirection: "lower",
  },

  rent_to_price_ratio: {
    id: "rent_to_price_ratio",
    title: "Rent-to-Price Ratio",
    format: "percent_abs",
    dataSource: "calculated",
    apiEndpoint: "/api/metrics/rent-to-price/{geo}",
    keyField: "auto",
    supportedGeos: ["metro", "county", "zip"],
    valueField: "rent_to_price_ratio",
    asPercent: true,
    hasTimeSeries: true,
    favorableDirection: "higher",
  },

  investment_score: {
    id: "investment_score",
    title: "Investment Score",
    format: "number",
    dataSource: "calculated",
    apiEndpoint: "/api/metrics/investment-score/{geo}",
    keyField: "auto",
    supportedGeos: ["metro", "county", "zip"],
    valueField: "investment_score",
    hasTimeSeries: true,
    favorableDirection: "higher",
  },

  long_term_growth_score: {
    id: "long_term_growth_score",
    title: "Long-Term Growth Score",
    format: "number",
    dataSource: "calculated",
    apiEndpoint: "/api/metrics/long-term-growth/{geo}",
    keyField: "auto",
    supportedGeos: ["metro", "county", "zip"],
    valueField: "long_term_growth_score",
    hasTimeSeries: true,
    favorableDirection: "higher",
  },

  overvalued_pct: {
    id: "overvalued_pct",
    title: "Overvalued %",
    format: "percent",
    dataSource: "calculated",
    apiEndpoint: "/api/metrics/overvalued/{geo}",
    keyField: "auto",
    // County/zip overvalued is now pre-calculated in calculated_metrics
    // (latest period only); metro keeps its on-the-fly fallback.
    supportedGeos: ["metro", "county", "zip"],
    valueField: "overvalued_pct",
    hasTimeSeries: true,
    favorableDirection: "lower",
  },

  months_of_supply: {
    id: "months_of_supply",
    title: "Months of Supply",
    // 1-decimal display ("4.2"); dynamic min→p95 color scale (no fixed range).
    format: "index_1dec",
    dataSource: "calculated",
    apiEndpoint: "/api/metrics/months-of-supply/{geo}",
    keyField: "auto",
    supportedGeos: ["metro", "county", "zip"],
    valueField: "months_of_supply",
    // MOS is stamped on the latest period only (Realtor active/pending proxy),
    // so there is no historical series to chart.
    hasTimeSeries: false,
    favorableDirection: "lower",
  },

  inventory_surplus: {
    id: "inventory_surplus",
    title: "Inventory Surplus/Deficit",
    format: "percent",
    dataSource: "calculated",
    apiEndpoint: "/api/metrics/inventory-surplus/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    valueField: "inventory_surplus",
    hasTimeSeries: true,
    favorableDirection: "lower",
  },
};
