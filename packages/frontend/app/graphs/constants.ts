import { MetricOption, MetricCategory, Milestone } from './types';
import { getMetricTitle, METRICS } from '@/lib/data';
import { getAllOrderedMetricIds } from '@/app/map/config/metric-categories';

// Mock data for chart display (placeholder)
export const MOCK_INVENTORY_DATA = [
  { year: 2015, value: 45000 }, { year: 2016, value: 48000 }, { year: 2017, value: 52000 },
  { year: 2018, value: 55000 }, { year: 2019, value: 58000 }, { year: 2020, value: 42000 },
  { year: 2021, value: 35000 }, { year: 2022, value: 48000 }, { year: 2023, value: 62000 },
  { year: 2024, value: 72000 }, { year: 2025, value: 78000 },
];

export const MOCK_COMPARISON_DATA = [
  { year: 2015, value: 52000 }, { year: 2016, value: 54000 }, { year: 2017, value: 58000 },
  { year: 2018, value: 61000 }, { year: 2019, value: 65000 }, { year: 2020, value: 48000 },
  { year: 2021, value: 40000 }, { year: 2022, value: 55000 }, { year: 2023, value: 68000 },
  { year: 2024, value: 75000 }, { year: 2025, value: 82000 },
];

export const NATIONAL_AVG_DATA = [
  { year: 2015, value: 48000 }, { year: 2016, value: 50000 }, { year: 2017, value: 54000 },
  { year: 2018, value: 57000 }, { year: 2019, value: 60000 }, { year: 2020, value: 44000 },
  { year: 2021, value: 36000 }, { year: 2022, value: 50000 }, { year: 2023, value: 64000 },
  { year: 2024, value: 79000 }, { year: 2025, value: 79000 },
];

export const STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia',
  'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts',
  'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island',
  'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming',
];

// 1. Get Master Order from Map Page Sidebar configuration (Single Source of Truth)
// We rely on getAllOrderedMetricIds from metric-categories.tsx
const ORDERED_IDS = getAllOrderedMetricIds();

// 2. Construct the comprehensive list
const buildMetricList = (): MetricOption[] => {
  const seenIds = new Set<string>();
  const options: MetricOption[] = [];

  // Helper to add metric
  const addMetric = (id: string, isFromOrder = false) => {
    // Check if valid in METRICS or is a known ID we want even if missing (handled gracefully by titles)
    // We only add if it's in METRICS or explicitly in our ordered list (though if missing in METRICS, title lookup falls back)
    if (seenIds.has(id)) return;
    seenIds.add(id);

    const title = getMetricTitle(id);

    options.push({
      id,
      name: title,
      category: 'general',
    });
  };

  // Add ordered metrics
  ORDERED_IDS.forEach(id => addMetric(id, true));

  // Add remaining metrics from METRICS config
  const allMetricKeys = Object.keys(METRICS);
  const remaining = allMetricKeys.filter(id => !seenIds.has(id));
  remaining.sort(); // Alphabetical sort for remainder
  remaining.forEach(id => addMetric(id));

  return options;
};

export const ALL_METRICS: MetricOption[] = buildMetricList();

// Keep UNIQUE_METRICS as alias for ALL_METRICS since we de-duped already
export const UNIQUE_METRICS = ALL_METRICS;

// Legacy support if needed, though we primarily use ALL_METRICS now
export const METRIC_CATEGORIES: MetricCategory[] = [
  {
    id: 'all_metrics',
    name: 'All Metrics',
    metrics: ALL_METRICS
  }
];

// Descriptions for metrics (Legacy/Helper)
// TODO: Migrate these descriptions to central config or derived from tooltips
export const DESCRIPTIONS: Record<string, string> = {
  // Affordability
  listing_price: 'Median listing price of homes currently on the market.',
  income_to_buy: 'Annual income required to afford a home at median price.',
  affordable_home_price: 'Home price affordable with median household income.',
  price_per_sqft: 'Median price per square foot for listed properties.',
  years_to_save: 'Years to save for a 20% down payment at median income.',
  homeowner_affordability: 'Percentage of income needed for homeownership costs.',
  home_value_yoy: 'Year-over-year change in home values.',
  home_value_5yr: '5-year compound annual growth rate of home values.',
  home_value_mom: 'Month-over-month change in home values.',

  // Market Competition
  days_on_market: 'Median days listings remain on market before sale.',
  for_sale_inventory: 'Total number of active listings on the market.',
  inventory_yoy: 'Year-over-year change in available inventory.',
  pending_ratio: 'Ratio of pending to active listings (higher = more competitive).',
  new_listings_yoy: 'Year-over-year change in new listings.',
  hotness_score: 'Realtor.com market hotness score (demand vs supply).',
  market_heat: 'Zillow market heat index measuring competition.',
  sale_to_list: 'Ratio of sale price to list price.',

  // Pricing & Deals
  home_price_forecast: 'Predicted home value change over next 12 months.',
  price_cut_pct: 'Percentage of listings with price reductions.',
  price_increase_pct: 'Percentage of listings with price increases.',
  new_listings: 'Number of new listings added in the period.',
  inventory_surplus: 'Inventory surplus or deficit vs balanced market.',

  // Cash Flow / Investor
  cap_rate: 'Capitalization rate (annual rent / property value).',
  rent_index: 'Zillow Observed Rent Index (ZORI) for the area.',
  rent_for_houses: 'Renter demand index for single-family homes.',
  income_to_rent: 'Annual income required to afford median rent.',
  renter_affordability: 'Percentage of income needed for rent costs.',

  // Appreciation
  home_value: 'Zillow Home Value Index (ZHVI) for typical homes.',
  overvalued_pct: 'How much home values exceed fundamental value.',

  // Area Profile
  population: 'Total population in the area.',
  population_growth: 'Annual population growth rate.',
  median_income: 'Median household income.',
  income_growth: 'Annual income growth rate.',
  median_age: 'Median age of residents.',
  homeownership_rate: 'Percentage of owner-occupied housing units.',

  // Local Economy
  unemployment_rate: 'Current unemployment rate.',
  job_growth: 'Year-over-year job growth rate.',
  gdp_growth: 'Gross domestic product growth rate.',
  cost_of_living: 'Regional price parity (100 = national average).',

  // New Construction
  new_construction_sales: 'Number of new construction home sales.',
  new_construction_price: 'Median price of new construction homes.',
  new_construction_ppsf: 'Price per square foot for new construction.',
};

// Market milestones for chart annotations
export const MILESTONES: Milestone[] = [
  { year: 2008, label: 'Financial Crisis begins' },
  { year: 2012, label: 'Housing market recovery starts' },
  { year: 2020, label: 'COVID-19 Pandemic begins' },
  { year: 2022, label: 'Fed rate hikes begin' },
];

// Data sources for metrics
export const SOURCES: Record<string, string> = {
  // Realtor.com metrics
  listing_price: 'Realtor.com Market Data',
  price_per_sqft: 'Realtor.com Market Data',
  days_on_market: 'Realtor.com Market Data',
  for_sale_inventory: 'Realtor.com Market Data',
  inventory_yoy: 'Realtor.com Market Data',
  pending_ratio: 'Realtor.com Market Data',
  new_listings: 'Realtor.com Market Data',
  new_listings_yoy: 'Realtor.com Market Data',
  hotness_score: 'Realtor.com Hotness Index',
  price_cut_pct: 'Realtor.com Market Data',
  price_increase_pct: 'Realtor.com Market Data',
  home_value_yoy: 'Realtor.com Market Data',
  home_value_mom: 'Realtor.com Market Data',
  home_sales: 'Realtor.com Market Data',
  home_sales_yoy: 'Realtor.com Market Data',
  pending_listings: 'Realtor.com Market Data',
  demand_score: 'Realtor.com Market Data',
  supply_score: 'Realtor.com Market Data',

  // Zillow metrics
  home_value: 'Zillow Home Value Index (ZHVI)',
  home_value_5yr: 'Zillow Home Value Index (ZHVI)',
  home_price_forecast: 'Zillow Home Price Forecast',
  rent_index: 'Zillow Observed Rent Index (ZORI)',
  rent_for_houses: 'Zillow Renter Demand Index',
  market_heat: 'Zillow Market Heat Index',
  sale_to_list: 'Zillow Market Data',
  income_to_buy: 'Zillow Affordability Data',
  income_to_rent: 'Zillow Affordability Data',
  affordable_home_price: 'Zillow Affordability Data',
  years_to_save: 'Zillow Affordability Data',
  homeowner_affordability: 'Zillow Affordability Data',
  renter_affordability: 'Zillow Affordability Data',
  new_construction_sales: 'Zillow New Construction Data',
  new_construction_price: 'Zillow New Construction Data',
  new_construction_ppsf: 'Zillow New Construction Data',

  // Calculated metrics
  cap_rate: 'Calculated (Rent / Value)',
  overvalued_pct: 'Calculated (Value vs Fundamentals)',
  inventory_surplus: 'Calculated (Inventory vs Balanced)',

  // Census metrics
  population: 'U.S. Census Bureau ACS',
  population_growth: 'U.S. Census Bureau ACS',
  median_income: 'U.S. Census Bureau ACS',
  income_growth: 'U.S. Census Bureau ACS',
  median_age: 'U.S. Census Bureau ACS',
  homeownership_rate: 'U.S. Census Bureau ACS',

  // Economic metrics
  unemployment_rate: 'Bureau of Labor Statistics',
  job_growth: 'Bureau of Labor Statistics',
  gdp_growth: 'Bureau of Economic Analysis',
  cost_of_living: 'Bureau of Economic Analysis RPP',
};

// ── CENSUS DIVISION & REGION MAPPING ──
// Uses the 9 Census Divisions for granular comparisons, grouped under 4 Census Regions.
// Source: U.S. Census Bureau — Census Regions and Divisions of the United States

export type CensusDivision =
  | 'New England'
  | 'Middle Atlantic'
  | 'East North Central'
  | 'West North Central'
  | 'South Atlantic'
  | 'East South Central'
  | 'West South Central'
  | 'Mountain'
  | 'Pacific';

export type CensusRegion = 'Northeast' | 'Midwest' | 'South' | 'West';

export const STATE_TO_CENSUS_DIVISION: Record<string, CensusDivision> = {
  // Division 1: New England (Region: Northeast)
  CT: 'New England', ME: 'New England', MA: 'New England', NH: 'New England', RI: 'New England', VT: 'New England',
  // Division 2: Middle Atlantic (Region: Northeast)
  NJ: 'Middle Atlantic', NY: 'Middle Atlantic', PA: 'Middle Atlantic',
  // Division 3: East North Central (Region: Midwest)
  IL: 'East North Central', IN: 'East North Central', MI: 'East North Central', OH: 'East North Central', WI: 'East North Central',
  // Division 4: West North Central (Region: Midwest)
  IA: 'West North Central', KS: 'West North Central', MN: 'West North Central', MO: 'West North Central',
  NE: 'West North Central', ND: 'West North Central', SD: 'West North Central',
  // Division 5: South Atlantic (Region: South)
  DE: 'South Atlantic', DC: 'South Atlantic', FL: 'South Atlantic', GA: 'South Atlantic', MD: 'South Atlantic',
  NC: 'South Atlantic', SC: 'South Atlantic', VA: 'South Atlantic', WV: 'South Atlantic',
  // Division 6: East South Central (Region: South)
  AL: 'East South Central', KY: 'East South Central', MS: 'East South Central', TN: 'East South Central',
  // Division 7: West South Central (Region: South)
  AR: 'West South Central', LA: 'West South Central', OK: 'West South Central', TX: 'West South Central',
  // Division 8: Mountain (Region: West)
  AZ: 'Mountain', CO: 'Mountain', ID: 'Mountain', MT: 'Mountain', NV: 'Mountain', NM: 'Mountain', UT: 'Mountain', WY: 'Mountain',
  // Division 9: Pacific (Region: West)
  AK: 'Pacific', CA: 'Pacific', HI: 'Pacific', OR: 'Pacific', WA: 'Pacific',
};

export const DIVISION_TO_REGION: Record<CensusDivision, CensusRegion> = {
  'New England': 'Northeast',
  'Middle Atlantic': 'Northeast',
  'East North Central': 'Midwest',
  'West North Central': 'Midwest',
  'South Atlantic': 'South',
  'East South Central': 'South',
  'West South Central': 'South',
  'Mountain': 'West',
  'Pacific': 'West',
};

/** Legacy alias — maps state to its 4-region Census Region */
export const STATE_TO_CENSUS_REGION: Record<string, CensusRegion> = Object.fromEntries(
  Object.entries(STATE_TO_CENSUS_DIVISION).map(([st, div]) => [st, DIVISION_TO_REGION[div]])
);

/** Get all state abbreviations in the same Census Division */
export function getDivisionStates(stateAbbr: string): string[] {
  const division = STATE_TO_CENSUS_DIVISION[stateAbbr];
  if (!division) return [stateAbbr];
  return Object.entries(STATE_TO_CENSUS_DIVISION)
    .filter(([, d]) => d === division)
    .map(([s]) => s);
}

/** @deprecated Use getDivisionStates — kept for any legacy callers */
export function getRegionStates(stateAbbr: string): string[] {
  return getDivisionStates(stateAbbr);
}

// ── STATE PARSING HELPERS ──

/**
 * Extract the PRIMARY state abbreviation from a geography name.
 * Returns only the first state listed.
 *   "Chicago-Naperville-Elgin, IL-IN" → "IL"
 *   "Washington-Arlington-Alexandria, DC-VA-MD-WV" → "DC"
 *   "Cook County, IL" → "IL"
 */
export function parseStateFromName(name: string): string | null {
  const match = name.match(/,\s*([A-Z]{2})(?:\s*-\s*[A-Z]{2})*\s*$/);
  return match ? match[1] : null;
}

/**
 * Extract ALL state abbreviations from a geography name.
 * Multi-state metros return all states they span.
 *   "Chicago-Naperville-Elgin, IL-IN" → ["IL", "IN"]
 *   "Washington-Arlington-Alexandria, DC-VA-MD-WV" → ["DC", "VA", "MD", "WV"]
 *   "Cook County, IL" → ["IL"]
 */
export function parseAllStatesFromName(name: string): string[] {
  const match = name.match(/,\s*((?:[A-Z]{2})(?:\s*-\s*[A-Z]{2})*)\s*$/);
  if (!match) return [];
  return match[1].split(/\s*-\s*/);
}

/**
 * Build the set of allowed states for scope-based filtering.
 * For multi-state metros (e.g., DC-VA-MD-WV), state scope includes
 * ALL states the metro spans so it can be meaningfully compared.
 *
 * "region" scope uses Census Divisions (9 divisions, e.g. South Atlantic)
 * rather than the broad 4-region grouping — giving more meaningful comparisons.
 */
export function getAllowedStates(
  primaryName: string | undefined,
  primaryState: string | undefined,
  scope: 'state' | 'region' | 'national',
): Set<string> | null {
  if (scope === 'national' || !primaryState) return null;

  if (scope === 'state') {
    // For multi-state metros, include all states they span
    const states = primaryName ? parseAllStatesFromName(primaryName) : [];
    if (states.length > 1) {
      return new Set(states);
    }
    return new Set([primaryState]);
  }

  if (scope === 'region') {
    // Include all states in the same Census Division, plus any extra
    // states from a multi-state metro that might cross division boundaries
    const divisionStates = new Set(getDivisionStates(primaryState));
    if (primaryName) {
      for (const st of parseAllStatesFromName(primaryName)) {
        divisionStates.add(st);
      }
    }
    return divisionStates;
  }

  return null;
}

/**
 * Check if a geography name belongs to any of the allowed states.
 * For multi-state metros, passes if ANY of their states is allowed.
 */
export function matchesAllowedStates(name: string, allowedStates: Set<string>): boolean {
  const states = parseAllStatesFromName(name);
  if (states.length === 0) return false;
  return states.some((st) => allowedStates.has(st));
}

/**
 * Build the benchmark label for the current scope.
 */
export function getScopeBenchmarkLabel(
  primaryName: string | undefined,
  primaryState: string | undefined,
  scope: 'state' | 'region' | 'national',
): string {
  if (scope === 'national' || !primaryState) return 'National Median';

  if (scope === 'state') {
    const states = primaryName ? parseAllStatesFromName(primaryName) : [];
    if (states.length > 1) {
      return `${states.join('/')} Median`;
    }
    return `${primaryState} Median`;
  }

  if (scope === 'region') {
    const division = STATE_TO_CENSUS_DIVISION[primaryState];
    return division ? `${division} Median` : 'Regional Median';
  }

  return 'National Median';
}

// Helper function to get source for a metric
export function getMetricSource(metricId: string): string {
  return SOURCES[metricId] || 'Data source not specified';
}

// Helper function to get description for a metric
export function getMetricDescription(metricId: string): string {
  return DESCRIPTIONS[metricId] || METRICS[metricId]?.title || 'No description available.';
}
