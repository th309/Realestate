/**
 * Types for Census and Economic Data Import
 */

// ============================================================================
// CENSUS RECORD TYPES
// ============================================================================

export interface CensusNationalRecord {
  year: number;
  total_population: number | null;
  population_yoy: number | null;
  median_age: number | null;
  median_household_income: number | null;
  income_yoy: number | null;
  per_capita_income: number | null;
  total_housing_units: number | null;
  owner_occupied_units: number | null;
  renter_occupied_units: number | null;
  homeownership_rate: number | null;
  median_home_value: number | null;
  median_gross_rent: number | null;
  rent_as_pct_of_income: number | null;
  total_employment: number | null;
  total_establishments: number | null;
  annual_payroll: number | null;
}

export interface CensusStateRecord extends CensusNationalRecord {
  state_fips: string;
  state_name: string | null;
  state_abbrev: string | null;
}

export interface CensusMetroRecord extends CensusNationalRecord {
  cbsa_code: string;
  cbsa_title: string | null;
  state_fips: string | null;
}

export interface CensusCountyRecord extends CensusNationalRecord {
  fips_code: string;
  county_name: string | null;
  state_fips: string | null;
  state_name: string | null;
}

export interface CensusCityRecord {
  year: number;
  place_fips: string;
  place_name: string | null;
  state_fips: string | null;
  state_name: string | null;
  total_population: number | null;
  population_yoy: number | null;
  median_age: number | null;
  median_household_income: number | null;
  income_yoy: number | null;
  per_capita_income: number | null;
  total_housing_units: number | null;
  owner_occupied_units: number | null;
  renter_occupied_units: number | null;
  homeownership_rate: number | null;
  median_home_value: number | null;
  median_gross_rent: number | null;
  rent_as_pct_of_income: number | null;
}

export interface CensusZipRecord {
  year: number;
  zcta: string;
  state_fips: string | null;
  state_name: string | null;
  total_population: number | null;
  population_yoy: number | null;
  median_age: number | null;
  median_household_income: number | null;
  income_yoy: number | null;
  per_capita_income: number | null;
  total_housing_units: number | null;
  owner_occupied_units: number | null;
  renter_occupied_units: number | null;
  homeownership_rate: number | null;
  median_home_value: number | null;
  median_gross_rent: number | null;
  rent_as_pct_of_income: number | null;
  total_employment: number | null;
  total_establishments: number | null;
  annual_payroll: number | null;
}

// ============================================================================
// ECONOMIC RECORD TYPES
// ============================================================================

export interface EconomicNationalRecord {
  period_date: Date;
  unemployment_rate: number | null;
  unemployment_rate_yoy: number | null;
  total_nonfarm_employment: number | null;
  employment_yoy: number | null;
  gdp_millions: number | null;
  real_gdp_millions: number | null;
  gdp_yoy: number | null;
}

export interface EconomicStateRecord extends EconomicNationalRecord {
  state_fips: string;
  state_name: string | null;
  state_abbrev: string | null;
  rpp_all_items: number | null;
  rpp_goods: number | null;
  rpp_housing: number | null;
  rpp_utilities: number | null;
  rpp_other_services: number | null;
}

export interface EconomicMetroRecord extends EconomicNationalRecord {
  cbsa_code: string;
  cbsa_title: string | null;
  state_fips: string | null;
  rpp_all_items: number | null;
  rpp_goods: number | null;
  rpp_housing: number | null;
  rpp_utilities: number | null;
  rpp_other_services: number | null;
}

export interface EconomicCountyRecord extends EconomicNationalRecord {
  fips_code: string;
  county_name: string | null;
  state_fips: string | null;
  state_name: string | null;
}

// ============================================================================
// IMPORT RESULT TYPE
// ============================================================================

export interface ImportResult {
  datasetId: string;
  success: boolean;
  recordsInserted: number;
  recordsUpdated: number;
  errors: number;
}

// ============================================================================
// STATE MAPPINGS
// ============================================================================

export const STATE_FIPS_TO_ABBREV: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA',
  '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL',
  '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN',
  '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME',
  '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS',
  '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
  '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
  '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT',
  '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI',
  '56': 'WY', '72': 'PR'
};

export const STATE_ABBREV_TO_FIPS: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_FIPS_TO_ABBREV).map(([k, v]) => [v, k])
);

export const STATE_FIPS_TO_NAME: Record<string, string> = {
  '01': 'Alabama', '02': 'Alaska', '04': 'Arizona', '05': 'Arkansas', '06': 'California',
  '08': 'Colorado', '09': 'Connecticut', '10': 'Delaware', '11': 'District of Columbia', '12': 'Florida',
  '13': 'Georgia', '15': 'Hawaii', '16': 'Idaho', '17': 'Illinois', '18': 'Indiana',
  '19': 'Iowa', '20': 'Kansas', '21': 'Kentucky', '22': 'Louisiana', '23': 'Maine',
  '24': 'Maryland', '25': 'Massachusetts', '26': 'Michigan', '27': 'Minnesota', '28': 'Mississippi',
  '29': 'Missouri', '30': 'Montana', '31': 'Nebraska', '32': 'Nevada', '33': 'New Hampshire',
  '34': 'New Jersey', '35': 'New Mexico', '36': 'New York', '37': 'North Carolina', '38': 'North Dakota',
  '39': 'Ohio', '40': 'Oklahoma', '41': 'Oregon', '42': 'Pennsylvania', '44': 'Rhode Island',
  '45': 'South Carolina', '46': 'South Dakota', '47': 'Tennessee', '48': 'Texas', '49': 'Utah',
  '50': 'Vermont', '51': 'Virginia', '53': 'Washington', '54': 'West Virginia', '55': 'Wisconsin',
  '56': 'Wyoming', '72': 'Puerto Rico'
};
