/**
 * Zillow Dataset Helper Functions
 */

import type { ZillowDatasetConfig } from './types'
import { ZILLOW_DATASETS } from './config'

/**
 * Filter datasets by category
 */
export function getDatasetsByCategory(category: string): ZillowDatasetConfig[] {
  return ZILLOW_DATASETS.filter(d => d.category === category);
}

/**
 * Filter datasets by geography
 */
export function getDatasetsByGeography(geography: string): ZillowDatasetConfig[] {
  return ZILLOW_DATASETS.filter(d => d.geography === geography);
}

/**
 * Filter datasets by type
 */
export function getDatasetsByType(datasetType: string): ZillowDatasetConfig[] {
  return ZILLOW_DATASETS.filter(d => d.datasetType === datasetType);
}

/**
 * Get a dataset by ID
 */
export function getDatasetById(id: string): ZillowDatasetConfig | undefined {
  return ZILLOW_DATASETS.find(d => d.id === id);
}

/**
 * Get all available categories
 */
export function getCategories(): string[] {
  return Array.from(new Set(ZILLOW_DATASETS.map(d => d.category)));
}

/**
 * Get all available geographies
 */
export function getGeographies(): string[] {
  return Array.from(new Set(ZILLOW_DATASETS.map(d => d.geography)));
}

/**
 * Get all available dataset types
 */
export function getDatasetTypes(): string[] {
  return Array.from(new Set(ZILLOW_DATASETS.map(d => d.datasetType)));
}
