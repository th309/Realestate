/**
 * Metric Definitions
 * Contains descriptions, formulas, and data sources for all metrics
 */

export interface MetricDefinition {
  id: string;
  name: string;
  description: string;
  formula?: string;
  dataSource: string;
  updateFrequency: string;
  notes?: string;
}

export const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  // Home Values
  home_value: {
    id: 'home_value',
    name: 'Median Home Value',
    description: 'The median listing price of homes currently for sale in the market. This represents the middle point of all active listing prices, providing a representative view of typical home values.',
    dataSource: 'Realtor.com',
    updateFrequency: 'Monthly',
    notes: 'Based on active listings, not sold prices',
  },
  home_value_yoy: {
    id: 'home_value_yoy',
    name: 'Home Value Growth (YoY)',
    description: 'Year-over-year percentage change in median home value. Positive values indicate price appreciation, negative values indicate depreciation.',
    formula: '((Current Median - Prior Year Median) / Prior Year Median) × 100',
    dataSource: 'Realtor.com',
    updateFrequency: 'Monthly',
  },
  home_value_mom: {
    id: 'home_value_mom',
    name: 'Home Value Growth (MoM)',
    description: 'Month-over-month percentage change in median home value. Shows short-term price momentum.',
    formula: '((Current Median - Prior Month Median) / Prior Month Median) × 100',
    dataSource: 'Realtor.com',
    updateFrequency: 'Monthly',
  },
  home_price_forecast: {
    id: 'home_price_forecast',
    name: 'Home Price Forecast',
    description: 'Predicted percentage change in home prices over the selected forecast horizon (1, 3, or 12 months). Based on Zillow\'s proprietary forecasting model.',
    formula: 'Machine learning model incorporating historical trends, economic indicators, and market conditions',
    dataSource: 'Zillow ZHVF',
    updateFrequency: 'Monthly',
    notes: 'Forecasts are estimates and actual results may vary',
  },

  // Market Activity
  for_sale_inventory: {
    id: 'for_sale_inventory',
    name: 'For Sale Inventory',
    description: 'Total count of active residential listings currently on the market. Higher inventory generally indicates a buyer\'s market, while lower inventory suggests a seller\'s market.',
    dataSource: 'Realtor.com',
    updateFrequency: 'Monthly',
  },
  inventory_yoy: {
    id: 'inventory_yoy',
    name: 'Inventory Growth (YoY)',
    description: 'Year-over-year percentage change in for-sale inventory. Positive values mean more homes are available compared to last year.',
    formula: '((Current Inventory - Prior Year Inventory) / Prior Year Inventory) × 100',
    dataSource: 'Realtor.com',
    updateFrequency: 'Monthly',
  },
  days_on_market: {
    id: 'days_on_market',
    name: 'Days on Market',
    description: 'Median number of days a listing remains on the market before going under contract. Lower values indicate a faster-moving, more competitive market.',
    dataSource: 'Realtor.com',
    updateFrequency: 'Monthly',
  },
  new_listings: {
    id: 'new_listings',
    name: 'New Listings',
    description: 'Number of homes newly listed for sale during the reporting period. Indicates the flow of new inventory entering the market.',
    dataSource: 'Realtor.com',
    updateFrequency: 'Monthly',
  },
  pending_listings: {
    id: 'pending_listings',
    name: 'Pending Listings',
    description: 'Number of listings currently under contract but not yet closed. Indicates near-term sales activity.',
    dataSource: 'Realtor.com',
    updateFrequency: 'Monthly',
  },
  price_cut_pct: {
    id: 'price_cut_pct',
    name: 'Price Reduced %',
    description: 'Percentage of active listings that have had at least one price reduction. Higher percentages may indicate sellers overpricing or weakening demand.',
    formula: '(Listings with Price Cuts / Total Active Listings) × 100',
    dataSource: 'Realtor.com',
    updateFrequency: 'Monthly',
  },
  price_per_sqft: {
    id: 'price_per_sqft',
    name: 'Price per Sq Ft',
    description: 'Median listing price per square foot. Useful for comparing value across different home sizes and normalizing price comparisons.',
    formula: 'Median(Listing Price / Square Footage)',
    dataSource: 'Realtor.com',
    updateFrequency: 'Monthly',
  },

  // Rental Market
  rent_index: {
    id: 'rent_index',
    name: 'Rent Index',
    description: 'Zillow Observed Rent Index (ZORI) - A smoothed measure of typical observed market rent across a given region. Can be filtered by property type (All, Single Family, Multi-Family).',
    formula: 'Repeat-rent index methodology that controls for changes in rental mix over time',
    dataSource: 'Zillow ZORI',
    updateFrequency: 'Monthly',
  },
  rent_yoy: {
    id: 'rent_yoy',
    name: 'Rent Growth (YoY)',
    description: 'Year-over-year percentage change in the Zillow Rent Index. Shows annual rent appreciation or decline.',
    formula: '((Current ZORI - Prior Year ZORI) / Prior Year ZORI) × 100',
    dataSource: 'Zillow ZORI',
    updateFrequency: 'Monthly',
  },
  rent_for_houses: {
    id: 'rent_for_houses',
    name: 'Renter Demand',
    description: 'Measure of rental demand based on lease activity and rental market velocity. Higher values indicate stronger renter demand.',
    dataSource: 'Zillow',
    updateFrequency: 'Monthly',
  },

  // Investment Metrics
  cap_rate: {
    id: 'cap_rate',
    name: 'Cap Rate',
    description: 'Capitalization rate representing the expected rate of return on a real estate investment property. Calculated as the ratio of net operating income to property value.',
    formula: '(Annual Gross Rent × (1 - Expense Ratio)) / Property Value × 100',
    dataSource: 'Calculated',
    updateFrequency: 'Monthly',
    notes: 'Assumes standard expense ratio; actual returns may vary based on specific property conditions',
  },
  gross_yield: {
    id: 'gross_yield',
    name: 'Gross Yield',
    description: 'Annual rental income as a percentage of property value before expenses. Provides a quick comparison of rental return potential.',
    formula: '(Annual Rent / Property Value) × 100',
    dataSource: 'Calculated',
    updateFrequency: 'Monthly',
  },
  price_to_rent: {
    id: 'price_to_rent',
    name: 'Price-to-Rent Ratio',
    description: 'Ratio comparing home prices to annual rent costs. Higher ratios favor renting, lower ratios favor buying. Typically ranges from 10-25 in most markets.',
    formula: 'Median Home Price / (Monthly Rent × 12)',
    dataSource: 'Calculated',
    updateFrequency: 'Monthly',
    notes: 'Ratios above 20 generally favor renting; below 15 favor buying',
  },

  // Affordability
  affordability_index: {
    id: 'affordability_index',
    name: 'Affordability Index',
    description: 'Measures the ability of a typical household to afford a median-priced home. An index of 100 means a median-income household has exactly enough income to qualify.',
    formula: '(Median Household Income / Required Income for Median Home) × 100',
    dataSource: 'Calculated from Census + Realtor.com',
    updateFrequency: 'Annual (income) / Monthly (home prices)',
    notes: 'Based on standard 28% debt-to-income ratio and prevailing mortgage rates',
  },

  // Demographics
  population: {
    id: 'population',
    name: 'Population',
    description: 'Total population count for the geographic area based on Census Bureau estimates.',
    dataSource: 'U.S. Census Bureau',
    updateFrequency: 'Annual',
  },
  population_growth: {
    id: 'population_growth',
    name: 'Population Growth',
    description: 'Year-over-year percentage change in population. Indicates demographic trends and potential housing demand shifts.',
    formula: '((Current Population - Prior Year Population) / Prior Year Population) × 100',
    dataSource: 'U.S. Census Bureau',
    updateFrequency: 'Annual',
  },
  median_income: {
    id: 'median_income',
    name: 'Median Household Income',
    description: 'The middle income level where half of households earn more and half earn less. Key indicator of local purchasing power.',
    dataSource: 'U.S. Census Bureau ACS',
    updateFrequency: 'Annual',
  },

  // Supply/Demand
  months_supply: {
    id: 'months_supply',
    name: 'Months of Supply',
    description: 'Number of months it would take to sell all current inventory at the current sales pace. Less than 4 months indicates a seller\'s market; more than 6 months indicates a buyer\'s market.',
    formula: 'Active Listings / Monthly Closed Sales',
    dataSource: 'Calculated',
    updateFrequency: 'Monthly',
    notes: '4-6 months is generally considered a balanced market',
  },
  pending_ratio: {
    id: 'pending_ratio',
    name: 'Pending Ratio',
    description: 'Ratio of pending sales to active listings. Higher ratios indicate stronger demand relative to supply.',
    formula: 'Pending Listings / Active Listings',
    dataSource: 'Realtor.com',
    updateFrequency: 'Monthly',
  },
};

/**
 * Get metric definition by ID
 * Returns undefined if metric not found
 */
export function getMetricDefinition(metricId: string): MetricDefinition | undefined {
  return METRIC_DEFINITIONS[metricId];
}
