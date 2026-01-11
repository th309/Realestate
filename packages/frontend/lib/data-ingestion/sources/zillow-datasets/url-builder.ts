/**
 * Zillow URL Builder Utility
 */

import type { ZillowUrlOptions } from './types'

/**
 * Generate Zillow CSV download URL
 *
 * @param datasetType - e.g., 'zhvi', 'zori', 'invt_fs'
 * @param geography - 'Metro', 'State', 'County', 'City', 'ZIP', 'National'
 * @param options - Additional URL parameters
 */
export function buildZillowUrl(
  datasetType: string,
  geography: string,
  options: ZillowUrlOptions = {}
): string {
  const {
    propertyType = 'sfrcondo',
    tier,
    smoothing,
    seasonalAdjustment = false,
    frequency = 'month',
    bedroomCount,
    suffix
  } = options;

  // Build filename components
  const parts: string[] = [geography, datasetType];

  // Add property type
  if (bedroomCount) {
    parts.push(`uc_${bedroomCount}bedroom`);
  } else {
    parts.push(`uc_${propertyType}`);
  }

  // Add tier if specified
  if (tier) {
    parts.push(`tier_${tier}`);
  }

  // Add smoothing
  if (smoothing) {
    parts.push(smoothing);
  }

  // Add seasonal adjustment
  if (seasonalAdjustment) {
    parts.push('sa');
  }

  // Add frequency
  parts.push(frequency);

  // Add custom suffix if provided
  if (suffix) {
    parts.push(suffix);
  }

  const filename = parts.join('_');
  return `https://files.zillowstatic.com/research/public_csvs/${datasetType}/${filename}.csv`;
}
