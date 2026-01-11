/**
 * Census Data Import Type Definitions
 */

export interface TimeSeriesRecord {
  region_id: string
  date: string
  metric_name: string
  metric_value: number
  data_source: string
  attributes?: Record<string, any>
}

export interface CensusResponse {
  [index: number]: string[]
}

export interface CensusVariable {
  variable: string
  metric_name: string
  description: string
}

export interface ImportResult {
  success: boolean
  recordsInserted: number
  errors: any[]
  message: string
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
