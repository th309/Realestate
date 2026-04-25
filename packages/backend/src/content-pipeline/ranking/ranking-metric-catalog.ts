/**
 * Ranking Metric Catalog
 *
 * Per-metric configuration for the ranking resolver: which source table to
 * query, which columns hold ID / name / state / value / date, how to filter
 * long-format tables (Zillow), and how many days before a row is stale.
 *
 * Add a new entry here when a new metric becomes ranking-eligible.
 */

import { MetricFormat } from './format-value';

export interface RankingMetricConfig {
  label: string;
  unit: string;
  format: MetricFormat;
  /** Days after which a data row is considered stale and excluded */
  stalenessDays: number;
  /** Source table for metro-level queries (county/zip derived by suffix swap) */
  sourceTable: string;
  /** Column that holds the region ID in the source table */
  idColumn: string;
  /** Column that holds the region name (null → fall back to idColumn) */
  nameColumn: string | null;
  /** Column that holds the state abbreviation (null → not available) */
  stateColumn: string | null;
  /** Column that holds the metric value */
  valueColumn: string;
  /** For long-format tables (zillow_*): filter metric_name to this value */
  metricNameFilter: string | null;
  /** Column for the record date */
  dateColumn: string;
}

export const RANKING_METRIC_CATALOG: Record<string, RankingMetricConfig> = {
  home_value: {
    label: 'Home Value',
    unit: 'USD',
    format: 'currency',
    stalenessDays: 60,
    sourceTable: 'zillow_metro',
    idColumn: 'cbsa_code',
    nameColumn: 'region_name',
    stateColumn: 'state_name',
    valueColumn: 'value',
    metricNameFilter: 'zhvi',
    dateColumn: 'period_date',
  },
  listing_price: {
    label: 'Median Listing Price',
    unit: 'USD',
    format: 'currency',
    stalenessDays: 45,
    sourceTable: 'realtor_metro',
    idColumn: 'cbsa_code',
    nameColumn: 'cbsa_name',
    stateColumn: null,
    valueColumn: 'median_listing_price',
    metricNameFilter: null,
    dateColumn: 'period_date',
  },
  median_dom: {
    label: 'Median Days on Market',
    unit: 'days',
    format: 'days',
    stalenessDays: 45,
    sourceTable: 'redfin_metro',
    idColumn: 'cbsa_code',
    nameColumn: 'region_name',
    stateColumn: 'state',
    valueColumn: 'median_dom',
    metricNameFilter: null,
    dateColumn: 'period_date',
  },
  months_of_supply: {
    label: 'Months of Supply',
    unit: 'months',
    format: 'number',
    stalenessDays: 45,
    sourceTable: 'redfin_metro',
    idColumn: 'cbsa_code',
    nameColumn: 'region_name',
    stateColumn: 'state',
    valueColumn: 'months_of_supply',
    metricNameFilter: null,
    dateColumn: 'period_date',
  },
  pct_sold_above_list: {
    label: '% Sold Above List',
    unit: '%',
    format: 'percent_abs',
    stalenessDays: 45,
    sourceTable: 'redfin_metro',
    idColumn: 'cbsa_code',
    nameColumn: 'region_name',
    stateColumn: 'state',
    valueColumn: 'pct_sold_above_list',
    metricNameFilter: null,
    dateColumn: 'period_date',
  },
  home_value_yoy: {
    label: 'Home Value (YoY %)',
    unit: '%',
    format: 'percent',
    stalenessDays: 60,
    sourceTable: 'zillow_metro',
    idColumn: 'cbsa_code',
    nameColumn: 'region_name',
    stateColumn: 'state_name',
    valueColumn: 'value',
    metricNameFilter: 'zhvi_yoy',
    dateColumn: 'period_date',
  },
};
