/**
 * Redfin Data Center - Type Definitions
 */

export interface MarketRecord {
    region_id: string
    region_name: string
    region_type: string
    state_name?: string
    state_code?: string
    metro_name?: string
}

export interface TimeSeriesRecord {
    region_id: string
    date: string
    metric_name: string
    metric_value: number
    data_source: string
    attributes?: Record<string, any>
}

export interface RedfinDataset {
    description: string
    category: string
    keywords: string[]
}

export interface DiscoveredDataset {
    name: string
    description: string
    url: string
    category: string
}

export interface ImportResult {
    success: boolean
    message: string
    details: {
        marketsCreated: number
        timeSeriesInserted: number
        errors: number
        skippedRows?: number
        sourceFile?: string
    }
}

export interface ImportAllResult {
    success: boolean
    message: string
    details: {
        datasetsProcessed: number
        datasetsSuccessful: number
        totalMarketsCreated: number
        totalTimeSeriesInserted: number
        totalErrors: number
        results: Array<{
            dataset: string
            success: boolean
            marketsCreated: number
            timeSeriesInserted: number
            errors: number
        }>
    }
}

export type ProgressCallback = (
    message: string,
    progress?: { current: number; total: number; percent: number }
) => void
