/**
 * Redfin Data Center Module
 * 
 * Re-exports all public APIs for backward compatibility.
 * Import from this index to use the Redfin data ingestion functionality.
 * 
 * NOTE: The main import functions (importRedfinData, importRedfinDataFromFile, 
 * importAllRedfinData) remain in the original redfin.ts file due to their complexity.
 * This module provides the modular components that the main importer uses.
 */

// Types
export type {
    MarketRecord,
    TimeSeriesRecord,
    RedfinDataset,
    DiscoveredDataset,
    ImportResult,
    ImportAllResult,
    ProgressCallback
} from './types'

// Constants
export {
    REDFIN_DATA_CENTER_URL,
    REDFIN_DATASET_CATEGORIES,
    REDFIN_DATASETS
} from './constants'

// Utilities
export {
    mapRedfinRegionToRegionId,
    createMarketFromRedfinData,
    getRegionCacheKey,
    cleanUtf16CsvData,
    parseCsvLine
} from './utils'

// Discovery
export { discoverRedfinDatasets } from './discovery'

// Downloader
export { downloadRedfinCSV } from './downloader'

// Main importer functions are exported from the original redfin.ts file
// Consumers should import those directly from '@/lib/data-ingestion/sources/redfin'
// which will resolve to redfin.ts (the file) not this directory
