import type { MetricConfig } from "../types";

/**
 * IRS COUNTY-TO-COUNTY MIGRATION + REDFIN MIGRATION metrics.
 */
export const MIGRATION_METRICS: Record<string, MetricConfig> = {
  // ============================================================================
  // IRS COUNTY-TO-COUNTY MIGRATION
  // ============================================================================
  irs_migration_in_returns: {
    id: "irs_migration_in_returns",
    title: "IRS Migration In (Returns)",
    format: "number",
    dataSource: "irs",
    apiEndpoint: "/api/metrics/irs_migration_in_returns/{geo}",
    keyField: "auto",
    supportedGeos: ["county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  irs_migration_out_returns: {
    id: "irs_migration_out_returns",
    title: "IRS Migration Out (Returns)",
    format: "number",
    dataSource: "irs",
    apiEndpoint: "/api/metrics/irs_migration_out_returns/{geo}",
    keyField: "auto",
    supportedGeos: ["county"],
    rangeType: "dynamic",
    favorableDirection: "lower",
  },

  irs_migration_net_returns: {
    id: "irs_migration_net_returns",
    title: "IRS Net Migration (Returns)",
    format: "number",
    dataSource: "irs",
    apiEndpoint: "/api/metrics/irs_migration_net_returns/{geo}",
    keyField: "auto",
    supportedGeos: ["county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  irs_migration_in_avg_agi: {
    id: "irs_migration_in_avg_agi",
    title: "IRS Inbound Migration Avg AGI",
    format: "currency",
    dataSource: "irs",
    apiEndpoint: "/api/metrics/irs_migration_in_avg_agi/{geo}",
    keyField: "auto",
    supportedGeos: ["county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  irs_migration_out_avg_agi: {
    id: "irs_migration_out_avg_agi",
    title: "IRS Outbound Migration Avg AGI",
    format: "currency",
    dataSource: "irs",
    apiEndpoint: "/api/metrics/irs_migration_out_avg_agi/{geo}",
    keyField: "auto",
    supportedGeos: ["county"],
    rangeType: "dynamic",
    favorableDirection: "neutral",
  },

  irs_migration_in_exemptions: {
    id: "irs_migration_in_exemptions",
    title: "IRS Migration In (Exemptions)",
    format: "number",
    dataSource: "irs",
    apiEndpoint: "/api/metrics/irs_migration_in_exemptions/{geo}",
    keyField: "auto",
    supportedGeos: ["county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  irs_migration_out_exemptions: {
    id: "irs_migration_out_exemptions",
    title: "IRS Migration Out (Exemptions)",
    format: "number",
    dataSource: "irs",
    apiEndpoint: "/api/metrics/irs_migration_out_exemptions/{geo}",
    keyField: "auto",
    supportedGeos: ["county"],
    rangeType: "dynamic",
    favorableDirection: "lower",
  },

  // ============================================================================
  // REDFIN MIGRATION
  // ============================================================================
  redfin_migration_net_inflow: {
    id: "redfin_migration_net_inflow",
    title: "Redfin Net Inflow",
    format: "number",
    dataSource: "redfin_migration",
    apiEndpoint: "/api/metrics/redfin_migration_net_inflow/{geo}",
    keyField: "auto",
    supportedGeos: ["metro"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  redfin_migration_inflow_share: {
    id: "redfin_migration_inflow_share",
    title: "Redfin Inflow Share",
    format: "percent",
    dataSource: "redfin_migration",
    apiEndpoint: "/api/metrics/redfin_migration_inflow_share/{geo}",
    keyField: "auto",
    supportedGeos: ["metro"],
    rangeType: "full",
    favorableDirection: "higher",
  },
};
