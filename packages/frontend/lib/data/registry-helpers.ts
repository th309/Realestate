/**
 * REGISTRY HELPER FUNCTIONS
 *
 * Utility functions for working with the metric registry.
 */

import type { GeoLevel, MetricConfig, MetricFormat, DataSource } from './types';
import { METRICS, DATA_DATES, METRO_ONLY_METRICS, GEO_ZOOM_LEVELS } from './registry';
export type { MetricDefinition } from './definitions';
export { METRIC_DEFINITIONS, getMetricDefinition, getDataSourceAnchor } from './definitions';

/**
 * Get metric configuration by ID
 */
export function getMetricConfig(metricId: string): MetricConfig | undefined {
  return METRICS[metricId];
}

/**
 * Get the key field for a given geography level
 */
export function getKeyFieldForGeo(geoLevel: GeoLevel): string {
  switch (geoLevel) {
    case 'state':
    case 'national':
      return 'region_name';
    case 'metro':
      return 'cbsa_code';
    case 'county':
      return 'county_fips';
    case 'zip':
      return 'postal_code';
    case 'city':
      return 'place_fips';
    default:
      return 'region_id';
  }
}

/**
 * Get the geo path segment for API URLs
 */
export function getGeoPathSegment(geoLevel: GeoLevel): string {
  switch (geoLevel) {
    case 'national':
      return 'national';
    case 'state':
      return 'states';
    case 'metro':
      return 'metros';
    case 'county':
      return 'counties';
    case 'zip':
      return 'zips';
    case 'city':
      return 'cities';
    default:
      return 'metros';
  }
}

/**
 * Check if a metric supports a given geography level
 */
export function isMetricSupportedForGeo(metricId: string, geoLevel: GeoLevel): boolean {
  const config = METRICS[metricId];
  if (!config) return false;

  // Check if metric is metro-only
  if (METRO_ONLY_METRICS.has(metricId)) {
    return geoLevel === 'metro';
  }

  // National level uses state data
  if (geoLevel === 'national') {
    return config.supportedGeos.includes('state');
  }

  return config.supportedGeos.includes(geoLevel);
}

/**
 * Get metric format
 */
export function getMetricFormat(metricId: string): MetricFormat {
  return METRICS[metricId]?.format || 'currency';
}

/**
 * Get metric title
 */
export function getMetricTitle(metricId: string, forecastHorizon?: string): string {
  const config = METRICS[metricId];
  if (!config) {
    return metricId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  return config.title;
}

/**
 * Get the "as of" date for a metric
 */
export function getMetricDataDate(metricId: string): string {
  const config = METRICS[metricId];
  if (!config) return DATA_DATES.zillow;

  return DATA_DATES[config.dataSource];
}

/**
 * Format data date for display in tooltips
 * Converts '2025-11-30' to 'Nov 2025' or '2024' to '2024'
 */
export function formatDataDateForDisplay(dateStr: string): string {
  if (!dateStr) return '';

  // Handle annual data (just a year like '2024')
  if (/^\d{4}$/.test(dateStr)) {
    return dateStr;
  }

  try {
    const date = new Date(dateStr + 'T00:00:00');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${month} ${year}`;
  } catch {
    return dateStr;
  }
}

/**
 * Get the default zoom level for a geography type
 */
export function getDefaultZoom(geoLevel: GeoLevel): number {
  return GEO_ZOOM_LEVELS[geoLevel] ?? 4;
}

/**
 * Get all metric IDs
 */
export function getAllMetricIds(): string[] {
  return Object.keys(METRICS);
}

/**
 * Get metrics for a specific data source
 */
export function getMetricsByDataSource(dataSource: string): MetricConfig[] {
  return Object.values(METRICS).filter(m => m.dataSource === dataSource);
}

/**
 * Get metrics supported at a specific geo level
 */
export function getMetricsForGeoLevel(geoLevel: GeoLevel): MetricConfig[] {
  return Object.values(METRICS).filter(m => isMetricSupportedForGeo(m.id, geoLevel));
}
