/**
 * Census Variable Mappings
 *
 * Maps Census Bureau variable codes to database columns
 */

import type { CensusVariable } from './types';

/**
 * Census variable mappings for ACS5 data
 */
export const CENSUS_VARIABLES: CensusVariable[] = [
  // DEMOGRAPHICS
  { code: 'B01001_001E', description: 'Total Population', table: 'demographics', column: 'total_population' },
  { code: 'B01002_001E', description: 'Median Age', table: 'demographics', column: 'median_age' },
  { code: 'B11001_001E', description: 'Total Households', table: 'demographics', column: 'total_households' },
  { code: 'B25010_001E', description: 'Average Household Size', table: 'demographics', column: 'avg_household_size' },

  // Age Distribution (percentages calculated from counts)
  { code: 'B01001_003E', description: 'Male Under 5', table: 'demographics', column: '_male_under_5' },
  { code: 'B01001_027E', description: 'Female Under 5', table: 'demographics', column: '_female_under_5' },
  { code: 'B01001_007E', description: 'Male 18-34', table: 'demographics', column: '_male_18_34' },
  { code: 'B01001_031E', description: 'Female 18-34', table: 'demographics', column: '_female_18_34' },
  { code: 'B01001_011E', description: 'Male 35-54', table: 'demographics', column: '_male_35_54' },
  { code: 'B01001_035E', description: 'Female 35-54', table: 'demographics', column: '_female_35_54' },
  { code: 'B01001_020E', description: 'Male 65+', table: 'demographics', column: '_male_65_plus' },
  { code: 'B01001_044E', description: 'Female 65+', table: 'demographics', column: '_female_65_plus' },

  // Education
  { code: 'B15003_022E', description: "Bachelor's Degree", table: 'demographics', column: '_bachelors_count' },
  { code: 'B15003_023E', description: "Master's Degree", table: 'demographics', column: '_masters_count' },
  { code: 'B15003_024E', description: 'Professional Degree', table: 'demographics', column: '_professional_count' },
  { code: 'B15003_025E', description: 'Doctorate Degree', table: 'demographics', column: '_doctorate_count' },

  // ECONOMICS
  { code: 'B19013_001E', description: 'Median Household Income', table: 'economics', column: 'median_household_income' },
  { code: 'B19301_001E', description: 'Per Capita Income', table: 'economics', column: 'per_capita_income' },
  { code: 'B17001_002E', description: 'Population Below Poverty', table: 'economics', column: '_poverty_count' },
  { code: 'B23025_005E', description: 'Unemployed Population', table: 'economics', column: '_unemployed_count' },
  { code: 'B23025_003E', description: 'Labor Force', table: 'economics', column: '_labor_force' },
  { code: 'B19083_001E', description: 'Gini Index', table: 'economics', column: 'gini_index' },

  // HOUSING
  { code: 'B25001_001E', description: 'Total Housing Units', table: 'housing', column: 'total_housing_units' },
  { code: 'B25002_002E', description: 'Occupied Housing Units', table: 'housing', column: 'occupied_units' },
  { code: 'B25003_002E', description: 'Owner Occupied', table: 'housing', column: '_owner_occupied' },
  { code: 'B25077_001E', description: 'Median Home Value', table: 'housing', column: 'median_home_value' },
  { code: 'B25064_001E', description: 'Median Gross Rent', table: 'housing', column: 'median_gross_rent' },
  { code: 'B25035_001E', description: 'Median Year Built', table: 'housing', column: 'median_year_built' }
];

/**
 * Get all variable codes
 */
export function getVariableCodes(): string[] {
  return CENSUS_VARIABLES.map(v => v.code);
}
