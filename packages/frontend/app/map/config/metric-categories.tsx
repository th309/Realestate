/**
 * Metric Categories Configuration
 *
 * Categories are organized by view mode (homebuyer/investor) with some shared categories.
 * Market Trends has nested sub-sections for Supply, Velocity, and Pricing Dynamics.
 *
 * Data Source Strategy (Realtor-first):
 * - Realtor: Primary source for listings, inventory, DOM, price dynamics (best coverage)
 * - Zillow: Specialty data - rent, forecasts, affordability, new construction
 * - Calculated: Derived metrics using formulas from base data
 */

import type { MetricCategory, ViewMode, DataSource } from '../types';
import {
  StarIcon, AttachMoneyIcon, ShowChartIcon, PeopleIcon,
  TrendingIcon, AnalyticsIcon
} from '../components';

// Icon for Economic Context
const EconomicIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor">
    <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm40-80h80v-280h-80v280Zm160 0h80v-400h-80v400Zm160 0h80v-160h-80v160Z" />
  </svg>
);

// Popular Data metrics for Homebuyer/Renter view
const HOMEBUYER_POPULAR_METRICS = [
  { id: 'home_value', name: 'Home Value', dataSource: 'realtor' as DataSource },
  { id: 'home_value_yoy', name: 'Home Value Growth (YoY)', dataSource: 'realtor' as DataSource },
  { id: 'home_price_forecast', name: 'Home Price Forecast', isPremium: true, dataSource: 'zillow' as DataSource },
  { id: 'for_sale_inventory', name: 'For Sale Inventory', dataSource: 'realtor' as DataSource },
  { id: 'days_on_market', name: 'Days on Market', dataSource: 'realtor' as DataSource },
  { id: 'overvalued_pct', name: 'Overvalued %', isPremium: true, dataSource: 'zillow' as DataSource },
];

// Popular Data metrics for Investor view
const INVESTOR_POPULAR_METRICS = [
  { id: 'cap_rate', name: 'Cap Rate', dataSource: 'calculated' as DataSource },
  { id: 'rent_index', name: 'Rent Index', dataSource: 'zillow' as DataSource },
  { id: 'rent_for_houses', name: 'Renter Demand Index', dataSource: 'zillow' as DataSource },
  { id: 'home_value_yoy', name: 'Home Value Growth (YoY)', dataSource: 'realtor' as DataSource },
  { id: 'vacancy_rate', name: 'Vacancy Rate', isPremium: true, dataSource: 'census' as DataSource },
  { id: 'long_term_growth', name: 'Long-Term Growth Score', isPremium: true, isNew: true, dataSource: 'calculated' as DataSource },
];

// Helper to get Popular Data category based on view mode
export function getPopularDataCategory(viewMode: ViewMode): MetricCategory {
  return {
    id: 'popular',
    name: 'Popular Data',
    icon: <StarIcon />,
    metrics: viewMode === 'homebuyer' ? HOMEBUYER_POPULAR_METRICS : INVESTOR_POPULAR_METRICS,
  };
}

// Shared categories (available in both views)
export const SHARED_CATEGORIES: MetricCategory[] = [
  {
    id: 'home_price_affordability',
    name: 'Home Price & Affordability',
    icon: <AttachMoneyIcon />,
    metrics: [
      { id: 'home_value', name: 'Home Value', dataSource: 'realtor' as DataSource },
      { id: 'home_value_yoy', name: 'Home Value Growth (YoY)', dataSource: 'realtor' as DataSource },
      { id: 'home_value_5yr', name: 'Home Value Growth (5-Year)', isPremium: true, dataSource: 'calculated' as DataSource },
      { id: 'home_value_mom', name: 'Home Value Growth (MoM)', isPremium: true, dataSource: 'realtor' as DataSource },
      { id: 'overvalued_pct', name: 'Overvalued %', isPremium: true, dataSource: 'zillow' as DataSource },
      { id: 'income_to_buy', name: 'Income Needed to Buy', isNew: true, dataSource: 'zillow' as DataSource },
      { id: 'affordable_home_price', name: 'Affordable Home Price', isNew: true, dataSource: 'zillow' as DataSource },
      { id: 'years_to_save', name: 'Years to Save (Down Payment)', isPremium: true, isNew: true, dataSource: 'zillow' as DataSource },
      { id: 'homeowner_affordability', name: 'Homeowner Affordability %', isPremium: true, isNew: true, dataSource: 'zillow' as DataSource },
    ],
  },
  {
    id: 'market_trends',
    name: 'Market Trends',
    icon: <ShowChartIcon />,
    subSections: [
      {
        id: 'supply',
        name: 'Supply',
        metrics: [
          { id: 'for_sale_inventory', name: 'For Sale Inventory', dataSource: 'realtor' as DataSource },
          { id: 'inventory_yoy', name: 'Inventory Growth (YoY)', dataSource: 'realtor' as DataSource },
          { id: 'inventory_surplus', name: 'Inventory Surplus/Deficit', isPremium: true, dataSource: 'calculated' as DataSource },
          { id: 'new_listings', name: 'New Listings', isPremium: true, dataSource: 'realtor' as DataSource },
          { id: 'pending_listings', name: 'Pending Listings', isPremium: true, dataSource: 'realtor' as DataSource },
        ],
      },
      {
        id: 'velocity',
        name: 'Velocity',
        metrics: [
          { id: 'days_on_market', name: 'Days on Market', dataSource: 'realtor' as DataSource },
          { id: 'days_to_close', name: 'Days to Close', isNew: true, dataSource: 'zillow' as DataSource },
          { id: 'home_sales', name: 'Home Sales', isPremium: true, dataSource: 'zillow' as DataSource },
          { id: 'sales_yoy', name: 'Sales Growth (YoY)', isPremium: true, dataSource: 'zillow' as DataSource },
          { id: 'sale_to_list', name: 'Sale-to-List Ratio', isPremium: true, dataSource: 'zillow' as DataSource },
        ],
      },
      {
        id: 'pricing_dynamics',
        name: 'Pricing Dynamics',
        metrics: [
          { id: 'price_cut_pct', name: 'Price Cut %', isPremium: true, dataSource: 'realtor' as DataSource },
          { id: 'price_cut_amount', name: 'Median Price Cut ($)', isPremium: true, isNew: true, dataSource: 'zillow' as DataSource },
          { id: 'list_price', name: 'Median List Price', isPremium: true, dataSource: 'realtor' as DataSource },
          { id: 'sale_price', name: 'Median Sale Price', isPremium: true, dataSource: 'zillow' as DataSource },
          { id: 'price_per_sqft', name: 'Price per Sq Ft', isPremium: true, dataSource: 'realtor' as DataSource },
        ],
      },
      {
        id: 'new_construction',
        name: 'New Construction',
        metrics: [
          { id: 'new_construction_sales', name: 'New Construction Sales', isNew: true, dataSource: 'zillow' as DataSource },
          { id: 'new_construction_price', name: 'New Construction Price', isNew: true, dataSource: 'zillow' as DataSource },
          { id: 'new_construction_ppsf', name: 'New Construction $/Sq Ft', isPremium: true, isNew: true, dataSource: 'zillow' as DataSource },
        ],
      },
    ],
  },
  {
    id: 'demographic',
    name: 'Demographic',
    icon: <PeopleIcon />,
    metrics: [
      { id: 'population', name: 'Population', dataSource: 'census' as DataSource },
      { id: 'population_growth', name: 'Population Growth', isPremium: true, dataSource: 'census' as DataSource },
      { id: 'median_income', name: 'Median Household Income', dataSource: 'census' as DataSource },
      { id: 'income_growth', name: 'Income Growth', isPremium: true, dataSource: 'census' as DataSource },
      { id: 'median_age', name: 'Median Age', isPremium: true, dataSource: 'census' as DataSource },
      { id: 'homeownership_rate', name: 'Homeownership Rate', isPremium: true, dataSource: 'census' as DataSource },
    ],
  },
  {
    id: 'economic_context',
    name: 'Economic Context',
    icon: <EconomicIcon />,
    metrics: [
      { id: 'unemployment_rate', name: 'Unemployment Rate', dataSource: 'fred' as DataSource },
      { id: 'job_growth', name: 'Job Growth', isPremium: true, dataSource: 'fred' as DataSource },
      { id: 'gdp_growth', name: 'GDP Growth', isPremium: true, dataSource: 'fred' as DataSource },
      { id: 'cost_of_living', name: 'Cost of Living Index', isPremium: true, dataSource: 'census' as DataSource },
    ],
  },
];

// Investor-specific categories
export const INVESTOR_CATEGORIES: MetricCategory[] = [
  {
    id: 'investor_metrics',
    name: 'Investor Metrics',
    icon: <TrendingIcon />,
    viewMode: 'investor',
    metrics: [
      { id: 'rent_index', name: 'Rent Index', dataSource: 'zillow' as DataSource },
      { id: 'rent_for_houses', name: 'Renter Demand Index', dataSource: 'zillow' as DataSource },
      { id: 'cap_rate', name: 'Cap Rate', isPremium: true, dataSource: 'calculated' as DataSource },
      { id: 'gross_yield', name: 'Gross Yield', isPremium: true, dataSource: 'calculated' as DataSource },
      { id: 'vacancy_rate', name: 'Vacancy Rate', isPremium: true, dataSource: 'census' as DataSource },
      { id: 'rent_growth', name: 'Rent Growth (YoY)', isPremium: true, dataSource: 'zillow' as DataSource },
      { id: 'rent_to_price', name: 'Rent-to-Price Ratio', isPremium: true, dataSource: 'calculated' as DataSource },
      { id: 'income_to_rent', name: 'Income Needed to Rent', isNew: true, dataSource: 'zillow' as DataSource },
      { id: 'renter_affordability', name: 'Renter Affordability %', isPremium: true, isNew: true, dataSource: 'zillow' as DataSource },
    ],
  },
];

// PropertyIQ Scores (premium feature)
export const SCORES_CATEGORY: MetricCategory = {
  id: 'scores',
  name: 'PropertyIQ Scores',
  icon: <AnalyticsIcon />,
  isNew: true,
  metrics: [
    { id: 'home_price_forecast', name: 'Home Price Forecast', isPremium: true, dataSource: 'zillow' as DataSource },
    { id: 'long_term_growth', name: 'Long-Term Growth Score', isPremium: true, isNew: true, dataSource: 'calculated' as DataSource },
    { id: 'market_health', name: 'Market Health Score', isPremium: true, isNew: true, dataSource: 'zillow' as DataSource },
    { id: 'investment_score', name: 'Investment Score', isPremium: true, isNew: true, dataSource: 'calculated' as DataSource },
  ],
};

// Get all categories for a given view mode
export function getMetricCategories(viewMode: ViewMode): MetricCategory[] {
  const categories: MetricCategory[] = [
    getPopularDataCategory(viewMode),
    ...SHARED_CATEGORIES,
  ];

  // Add investor-specific categories for investor view
  if (viewMode === 'investor') {
    categories.push(...INVESTOR_CATEGORIES);
  }

  // Always add PropertyIQ Scores at the end
  categories.push(SCORES_CATEGORY);

  return categories;
}

// Legacy export for backwards compatibility
export const METRIC_CATEGORIES: MetricCategory[] = getMetricCategories('homebuyer');
