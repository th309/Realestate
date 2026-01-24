/**
 * Shared Data Ingestion Types
 * Duplicated from frontend to avoid shared package complexity during migration.
 */

// --- General ---

export interface ImportResult {
    success: boolean
    message: string
    details?: any
    recordsInserted?: number
    errors?: any[]
}

export interface TimeSeriesRecord {
    region_id: string
    date: string
    metric_name: string
    metric_value: number
    data_source: string
    attributes?: Record<string, any>
}

// --- Census ---

export interface CensusVariable {
    variable: string
    metric_name: string
    description: string
}

export type CensusGeoLevel = 'state' | 'metropolitan statistical area/micropolitan statistical area' | 'place' | 'zip code tabulation area'

export const CENSUS_API_BASE = 'https://api.census.gov/data'

export const CENSUS_VARIABLES: Record<string, CensusVariable> = {
    population: {
        variable: 'B01001_001E',
        metric_name: 'population',
        description: 'Total Population'
    },
    median_household_income: {
        variable: 'B19013_001E',
        metric_name: 'median_household_income',
        description: 'Median Household Income'
    },
    poverty_population: {
        variable: 'B17001_002E',
        metric_name: 'poverty_population',
        description: 'Population Below Poverty Level'
    },
    median_gross_rent: {
        variable: 'B25064_001E',
        metric_name: 'median_gross_rent',
        description: 'Median Gross Rent'
    }
}

// --- Redfin ---

export interface RedfinMarketRecord {
    region_id: string
    region_name: string
    region_type: string
    state_name?: string
    state_code?: string
    metro_name?: string
}

export interface RedfinDataset {
    description: string
    category: string
    keywords: string[]
}

export interface RedfinImportResult {
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

// --- Zillow ---

export interface ZillowDatasetConfig {
    id: string;
    category: string;
    dataType: string;
    geography: string;
    downloadUrl: string;
    description: string;
    datasetType: string;
    propertyType?: string;
    tier?: string;
    smoothing?: string;
    seasonalAdjustment?: boolean;
    frequency?: string;
}
export * from './realtor.types';
