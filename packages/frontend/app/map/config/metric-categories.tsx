/**
 * Metric Categories Configuration
 *
 * Categories are organized by view mode (homebuyer/investor) with some shared categories.
 * Market Trends has nested sub-sections for Supply, Velocity, and Pricing Dynamics.
 */

import type { MetricCategory, ViewMode } from '../types';
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
  { id: 'home_value', name: 'Home Value' },
  { id: 'home_value_yoy', name: 'Home Value Growth (YoY)' },
  { id: 'home_price_forecast', name: 'Home Price Forecast', isPremium: true },
  { id: 'for_sale_inventory', name: 'For Sale Inventory' },
  { id: 'days_on_market', name: 'Days on Market' },
  { id: 'overvalued_pct', name: 'Overvalued %', isPremium: true },
];

// Popular Data metrics for Investor view
const INVESTOR_POPULAR_METRICS = [
  { id: 'cap_rate', name: 'Cap Rate' },
  { id: 'rent_index', name: 'Rent Index' },
  { id: 'rent_for_houses', name: 'Renter Demand Index' },
  { id: 'home_value_yoy', name: 'Home Value Growth (YoY)' },
  { id: 'vacancy_rate', name: 'Vacancy Rate', isPremium: true },
  { id: 'long_term_growth', name: 'Long-Term Growth Score', isPremium: true, isNew: true },
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
      { id: 'home_value', name: 'Home Value' },
      { id: 'home_value_yoy', name: 'Home Value Growth (YoY)' },
      { id: 'home_value_5yr', name: 'Home Value Growth (5-Year)', isPremium: true },
      { id: 'home_value_mom', name: 'Home Value Growth (MoM)', isPremium: true },
      { id: 'overvalued_pct', name: 'Overvalued %', isPremium: true },
      { id: 'sfh_value', name: 'Single Family Value', isPremium: true },
      { id: 'sfh_value_yoy', name: 'Single Family Value Growth (YoY)', isPremium: true },
      { id: 'condo_value', name: 'Condo Value', isPremium: true },
      { id: 'condo_value_yoy', name: 'Condo Value Growth (YoY)', isPremium: true },
      { id: 'income_to_buy', name: 'Income Needed to Buy', isNew: true },
      { id: 'affordable_home_price', name: 'Affordable Home Price', isNew: true },
      { id: 'years_to_save', name: 'Years to Save (Down Payment)', isPremium: true, isNew: true },
      { id: 'homeowner_affordability', name: 'Homeowner Affordability %', isPremium: true, isNew: true },
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
          { id: 'for_sale_inventory', name: 'For Sale Inventory' },
          { id: 'inventory_yoy', name: 'Inventory Growth (YoY)' },
          { id: 'inventory_surplus', name: 'Inventory Surplus/Deficit', isPremium: true },
          { id: 'new_listings', name: 'New Listings', isPremium: true },
          { id: 'pending_listings', name: 'Pending Listings', isPremium: true },
        ],
      },
      {
        id: 'velocity',
        name: 'Velocity',
        metrics: [
          { id: 'days_on_market', name: 'Days on Market' },
          { id: 'days_to_close', name: 'Days to Close', isNew: true },
          { id: 'home_sales', name: 'Home Sales', isPremium: true },
          { id: 'sales_yoy', name: 'Sales Growth (YoY)', isPremium: true },
          { id: 'sale_to_list', name: 'Sale-to-List Ratio', isPremium: true },
        ],
      },
      {
        id: 'pricing_dynamics',
        name: 'Pricing Dynamics',
        metrics: [
          { id: 'price_cut_pct', name: 'Price Cut %', isPremium: true },
          { id: 'price_cut_amount', name: 'Median Price Cut ($)', isPremium: true, isNew: true },
          { id: 'list_price', name: 'Median List Price', isPremium: true },
          { id: 'sale_price', name: 'Median Sale Price', isPremium: true },
          { id: 'price_per_sqft', name: 'Price per Sq Ft', isPremium: true },
        ],
      },
      {
        id: 'new_construction',
        name: 'New Construction',
        metrics: [
          { id: 'new_construction_sales', name: 'New Construction Sales', isNew: true },
          { id: 'new_construction_price', name: 'New Construction Price', isNew: true },
          { id: 'new_construction_ppsf', name: 'New Construction $/Sq Ft', isPremium: true, isNew: true },
        ],
      },
    ],
  },
  {
    id: 'demographic',
    name: 'Demographic',
    icon: <PeopleIcon />,
    metrics: [
      { id: 'population', name: 'Population' },
      { id: 'population_growth', name: 'Population Growth', isPremium: true },
      { id: 'median_income', name: 'Median Household Income' },
      { id: 'income_growth', name: 'Income Growth', isPremium: true },
      { id: 'median_age', name: 'Median Age', isPremium: true },
      { id: 'homeownership_rate', name: 'Homeownership Rate', isPremium: true },
    ],
  },
  {
    id: 'economic_context',
    name: 'Economic Context',
    icon: <EconomicIcon />,
    metrics: [
      { id: 'unemployment_rate', name: 'Unemployment Rate' },
      { id: 'job_growth', name: 'Job Growth', isPremium: true },
      { id: 'gdp_growth', name: 'GDP Growth', isPremium: true },
      { id: 'cost_of_living', name: 'Cost of Living Index', isPremium: true },
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
      { id: 'rent_index', name: 'Rent Index' },
      { id: 'rent_for_houses', name: 'Renter Demand Index' },
      { id: 'cap_rate', name: 'Cap Rate', isPremium: true },
      { id: 'gross_yield', name: 'Gross Yield', isPremium: true },
      { id: 'vacancy_rate', name: 'Vacancy Rate', isPremium: true },
      { id: 'rent_growth', name: 'Rent Growth (YoY)', isPremium: true },
      { id: 'rent_to_price', name: 'Rent-to-Price Ratio', isPremium: true },
      { id: 'income_to_rent', name: 'Income Needed to Rent', isNew: true },
      { id: 'renter_affordability', name: 'Renter Affordability %', isPremium: true, isNew: true },
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
    { id: 'home_price_forecast', name: 'Home Price Forecast', isPremium: true },
    { id: 'long_term_growth', name: 'Long-Term Growth Score', isPremium: true, isNew: true },
    { id: 'market_health', name: 'Market Health Score', isPremium: true, isNew: true },
    { id: 'investment_score', name: 'Investment Score', isPremium: true, isNew: true },
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
