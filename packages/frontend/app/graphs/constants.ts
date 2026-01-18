import { MetricOption, MetricCategory, Milestone } from './types';
import { getMetricTitle } from '@/app/map/config/metrics';

// Mock data for chart display (will be replaced with real API data)
export const MOCK_INVENTORY_DATA = [
  { year: 2015, value: 45000 },
  { year: 2016, value: 48000 },
  { year: 2017, value: 52000 },
  { year: 2018, value: 55000 },
  { year: 2019, value: 58000 },
  { year: 2020, value: 42000 },
  { year: 2021, value: 35000 },
  { year: 2022, value: 48000 },
  { year: 2023, value: 62000 },
  { year: 2024, value: 72000 },
  { year: 2025, value: 78000 },
];

export const MOCK_COMPARISON_DATA = [
  { year: 2015, value: 52000 },
  { year: 2016, value: 54000 },
  { year: 2017, value: 58000 },
  { year: 2018, value: 61000 },
  { year: 2019, value: 65000 },
  { year: 2020, value: 48000 },
  { year: 2021, value: 40000 },
  { year: 2022, value: 55000 },
  { year: 2023, value: 68000 },
  { year: 2024, value: 75000 },
  { year: 2025, value: 82000 },
];

export const NATIONAL_AVG_DATA = [
  { year: 2015, value: 48000 },
  { year: 2016, value: 50000 },
  { year: 2017, value: 54000 },
  { year: 2018, value: 57000 },
  { year: 2019, value: 60000 },
  { year: 2020, value: 44000 },
  { year: 2021, value: 36000 },
  { year: 2022, value: 50000 },
  { year: 2023, value: 64000 },
  { year: 2024, value: 73000 },
  { year: 2025, value: 79000 },
];

export const STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming',
];

// Build metric categories matching the sidebar structure
export const METRIC_CATEGORIES: MetricCategory[] = [
  {
    id: 'affordability',
    name: 'Affordability',
    metrics: [
      { id: 'listing_price', name: getMetricTitle('listing_price'), category: 'affordability' },
      { id: 'income_to_buy', name: getMetricTitle('income_to_buy'), category: 'affordability' },
      { id: 'affordable_home_price', name: getMetricTitle('affordable_home_price'), category: 'affordability' },
      { id: 'price_per_sqft', name: getMetricTitle('price_per_sqft'), category: 'affordability' },
      { id: 'years_to_save', name: getMetricTitle('years_to_save'), category: 'affordability' },
      { id: 'homeowner_affordability', name: getMetricTitle('homeowner_affordability'), category: 'affordability' },
      { id: 'home_value_yoy', name: getMetricTitle('home_value_yoy'), category: 'affordability' },
      { id: 'home_value_5yr', name: getMetricTitle('home_value_5yr'), category: 'affordability' },
    ],
  },
  {
    id: 'market_competition',
    name: 'Market Competition',
    metrics: [
      { id: 'days_on_market', name: getMetricTitle('days_on_market'), category: 'market_competition' },
      { id: 'for_sale_inventory', name: getMetricTitle('for_sale_inventory'), category: 'market_competition' },
      { id: 'inventory_yoy', name: getMetricTitle('inventory_yoy'), category: 'market_competition' },
      { id: 'pending_ratio', name: getMetricTitle('pending_ratio'), category: 'market_competition' },
      { id: 'new_listings_yoy', name: getMetricTitle('new_listings_yoy'), category: 'market_competition' },
      { id: 'hotness_score', name: getMetricTitle('hotness_score'), category: 'market_competition' },
      { id: 'market_heat', name: getMetricTitle('market_heat'), category: 'market_competition' },
      { id: 'sale_to_list', name: getMetricTitle('sale_to_list'), category: 'market_competition' },
    ],
  },
  {
    id: 'pricing_deals',
    name: 'Pricing & Deals',
    metrics: [
      { id: 'home_value_yoy', name: getMetricTitle('home_value_yoy'), category: 'pricing_deals' },
      { id: 'home_value_mom', name: getMetricTitle('home_value_mom'), category: 'pricing_deals' },
      { id: 'home_price_forecast', name: getMetricTitle('home_price_forecast'), category: 'pricing_deals' },
      { id: 'price_cut_pct', name: getMetricTitle('price_cut_pct'), category: 'pricing_deals' },
      { id: 'price_increase_pct', name: getMetricTitle('price_increase_pct'), category: 'pricing_deals' },
      { id: 'new_listings', name: getMetricTitle('new_listings'), category: 'pricing_deals' },
      { id: 'inventory_surplus', name: getMetricTitle('inventory_surplus'), category: 'pricing_deals' },
    ],
  },
  {
    id: 'cash_flow',
    name: 'Cash Flow',
    metrics: [
      { id: 'cap_rate', name: getMetricTitle('cap_rate'), category: 'cash_flow' },
      { id: 'rent_index', name: getMetricTitle('rent_index'), category: 'cash_flow' },
      { id: 'rent_for_houses', name: getMetricTitle('rent_for_houses'), category: 'cash_flow' },
      { id: 'income_to_rent', name: getMetricTitle('income_to_rent'), category: 'cash_flow' },
      { id: 'renter_affordability', name: getMetricTitle('renter_affordability'), category: 'cash_flow' },
    ],
  },
  {
    id: 'appreciation',
    name: 'Appreciation',
    metrics: [
      { id: 'home_value', name: getMetricTitle('home_value'), category: 'appreciation' },
      { id: 'home_value_yoy', name: getMetricTitle('home_value_yoy'), category: 'appreciation' },
      { id: 'home_value_5yr', name: getMetricTitle('home_value_5yr'), category: 'appreciation' },
      { id: 'home_price_forecast', name: getMetricTitle('home_price_forecast'), category: 'appreciation' },
      { id: 'overvalued_pct', name: getMetricTitle('overvalued_pct'), category: 'appreciation' },
    ],
  },
  {
    id: 'area_profile',
    name: 'Area Profile',
    metrics: [
      { id: 'population', name: getMetricTitle('population'), category: 'area_profile' },
      { id: 'population_growth', name: getMetricTitle('population_growth'), category: 'area_profile' },
      { id: 'median_income', name: getMetricTitle('median_income'), category: 'area_profile' },
      { id: 'income_growth', name: getMetricTitle('income_growth'), category: 'area_profile' },
      { id: 'median_age', name: getMetricTitle('median_age'), category: 'area_profile' },
      { id: 'homeownership_rate', name: getMetricTitle('homeownership_rate'), category: 'area_profile' },
    ],
  },
  {
    id: 'local_economy',
    name: 'Local Economy',
    metrics: [
      { id: 'unemployment_rate', name: getMetricTitle('unemployment_rate'), category: 'local_economy' },
      { id: 'job_growth', name: getMetricTitle('job_growth'), category: 'local_economy' },
      { id: 'gdp_growth', name: getMetricTitle('gdp_growth'), category: 'local_economy' },
      { id: 'cost_of_living', name: getMetricTitle('cost_of_living'), category: 'local_economy' },
    ],
  },
  {
    id: 'new_construction',
    name: 'New Construction',
    metrics: [
      { id: 'new_construction_sales', name: getMetricTitle('new_construction_sales'), category: 'new_construction' },
      { id: 'new_construction_price', name: getMetricTitle('new_construction_price'), category: 'new_construction' },
      { id: 'new_construction_ppsf', name: getMetricTitle('new_construction_ppsf'), category: 'new_construction' },
    ],
  },
];

// Flatten all metrics for dropdown display
export const ALL_METRICS: MetricOption[] = METRIC_CATEGORIES.flatMap((cat) => cat.metrics);

// Get unique metrics (some appear in multiple categories)
export const UNIQUE_METRICS: MetricOption[] = ALL_METRICS.filter(
  (metric, index, self) => index === self.findIndex((m) => m.id === metric.id)
);

// Descriptions for metrics
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

// Market milestones for chart annotations
export const MILESTONES: Milestone[] = [
  { year: 2008, label: 'Financial Crisis begins' },
  { year: 2012, label: 'Housing market recovery starts' },
  { year: 2020, label: 'COVID-19 Pandemic begins' },
  { year: 2022, label: 'Fed rate hikes begin' },
];

// Helper function to get description for a metric
export function getMetricDescription(metricId: string): string {
  return DESCRIPTIONS[metricId] || 'No description available.';
}

// Helper function to get source for a metric
export function getMetricSource(metricId: string): string {
  return SOURCES[metricId] || 'Data source not specified';
}
