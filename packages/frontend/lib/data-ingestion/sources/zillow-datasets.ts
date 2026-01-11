/**
 * Zillow Dataset Configuration
 *
 * Comprehensive list of available Zillow Research Data CSV downloads.
 * URLs are constructed based on known patterns from zillow.com/research/data/
 *
 * Data is updated monthly on the 16th of each month.
 *
 * Refactored to use modular components from ./zillow-datasets/
 */

// Re-export all types and functions for backward compatibility
export type { ZillowDatasetConfig, ZillowUrlOptions } from './zillow-datasets/types'
export { buildZillowUrl } from './zillow-datasets/url-builder'
export { ZILLOW_DATASETS } from './zillow-datasets/config'
export {
  getDatasetsByCategory,
  getDatasetsByGeography,
  getDatasetsByType,
  getDatasetById,
  getCategories,
  getGeographies,
  getDatasetTypes
} from './zillow-datasets/helpers'
