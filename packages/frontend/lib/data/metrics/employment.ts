import type { MetricConfig } from "../types";

/**
 * EMPLOYMENT BY SECTOR (BLS) + QCEW (BLS Quarterly Census of Employment & Wages) metrics.
 */
export const EMPLOYMENT_METRICS: Record<string, MetricConfig> = {
  // ============================================================================
  // EMPLOYMENT BY SECTOR (BLS)
  // ============================================================================
  employment_natural_resources_mining: {
    id: "employment_natural_resources_mining",
    title: "Natural Resources & Mining Employment",
    format: "number",
    dataSource: "bls",
    apiEndpoint: "/api/metrics/employment_natural_resources_mining/{geo}",
    keyField: "auto",
    supportedGeos: ["state", "metro", "county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  employment_construction: {
    id: "employment_construction",
    title: "Construction Employment",
    format: "number",
    dataSource: "bls",
    apiEndpoint: "/api/metrics/employment_construction/{geo}",
    keyField: "auto",
    supportedGeos: ["state", "metro", "county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  employment_manufacturing: {
    id: "employment_manufacturing",
    title: "Manufacturing Employment",
    format: "number",
    dataSource: "bls",
    apiEndpoint: "/api/metrics/employment_manufacturing/{geo}",
    keyField: "auto",
    supportedGeos: ["state", "metro", "county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  employment_trade_transport_utilities: {
    id: "employment_trade_transport_utilities",
    title: "Trade, Transportation & Utilities Employment",
    format: "number",
    dataSource: "bls",
    apiEndpoint: "/api/metrics/employment_trade_transport_utilities/{geo}",
    keyField: "auto",
    supportedGeos: ["state", "metro", "county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  employment_information: {
    id: "employment_information",
    title: "Information Employment",
    format: "number",
    dataSource: "bls",
    apiEndpoint: "/api/metrics/employment_information/{geo}",
    keyField: "auto",
    supportedGeos: ["state", "metro", "county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  employment_financial_activities: {
    id: "employment_financial_activities",
    title: "Financial Activities Employment",
    format: "number",
    dataSource: "bls",
    apiEndpoint: "/api/metrics/employment_financial_activities/{geo}",
    keyField: "auto",
    supportedGeos: ["state", "metro", "county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  employment_professional_business_services: {
    id: "employment_professional_business_services",
    title: "Professional & Business Services Employment",
    format: "number",
    dataSource: "bls",
    apiEndpoint: "/api/metrics/employment_professional_business_services/{geo}",
    keyField: "auto",
    supportedGeos: ["state", "metro", "county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  employment_education_health_services: {
    id: "employment_education_health_services",
    title: "Education & Health Services Employment",
    format: "number",
    dataSource: "bls",
    apiEndpoint: "/api/metrics/employment_education_health_services/{geo}",
    keyField: "auto",
    supportedGeos: ["state", "metro", "county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  employment_leisure_hospitality: {
    id: "employment_leisure_hospitality",
    title: "Leisure & Hospitality Employment",
    format: "number",
    dataSource: "bls",
    apiEndpoint: "/api/metrics/employment_leisure_hospitality/{geo}",
    keyField: "auto",
    supportedGeos: ["state", "metro", "county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  employment_other_services: {
    id: "employment_other_services",
    title: "Other Services Employment",
    format: "number",
    dataSource: "bls",
    apiEndpoint: "/api/metrics/employment_other_services/{geo}",
    keyField: "auto",
    supportedGeos: ["state", "metro", "county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  employment_public_administration: {
    id: "employment_public_administration",
    title: "Public Administration Employment",
    format: "number",
    dataSource: "bls",
    apiEndpoint: "/api/metrics/employment_public_administration/{geo}",
    keyField: "auto",
    supportedGeos: ["state", "metro", "county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  // ============================================================================
  // QCEW (BLS Quarterly Census of Employment & Wages)
  // ============================================================================
  qcew_avg_weekly_wage: {
    id: "qcew_avg_weekly_wage",
    title: "Average Weekly Wage",
    format: "currency",
    dataSource: "bls",
    apiEndpoint: "/api/metrics/qcew_avg_weekly_wage/{geo}",
    keyField: "auto",
    supportedGeos: ["metro", "county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  qcew_total_establishments: {
    id: "qcew_total_establishments",
    title: "Total Establishments",
    format: "number",
    dataSource: "bls",
    apiEndpoint: "/api/metrics/qcew_total_establishments/{geo}",
    keyField: "auto",
    supportedGeos: ["metro", "county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },
};
