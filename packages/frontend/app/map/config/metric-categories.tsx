/**
 * Metric Categories Configuration
 *
 * Categories organize metrics into UI groups for the sidebar.
 * Metric properties (name, format, dataSource) come from the central METRICS config.
 * This file only defines:
 * - Category structure (which metrics go where)
 * - UI flags (isPremium, isNew)
 *
 * Data Source Strategy (Realtor-first):
 * - Realtor: Primary source for listings, inventory, DOM, price dynamics (best coverage)
 * - Zillow: Specialty data - rent, forecasts, affordability, new construction
 * - Calculated: Derived metrics using formulas from base data
 */

import type { MetricCategory, ViewMode, Metric } from '../types';
import { getMetricConfig } from './metrics';
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

/**
 * Create a metric entry from the central config.
 * Only specify isPremium/isNew here - name and dataSource come from METRICS.
 */
function metric(id: string, flags?: { isPremium?: boolean; isNew?: boolean }): Metric {
  const config = getMetricConfig(id);
  return {
    id,
    name: config?.title || id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    dataSource: config?.dataSource,
    isPremium: flags?.isPremium,
    isNew: flags?.isNew,
  };
}

// Popular Data metrics for Homebuyer/Renter view
const HOMEBUYER_POPULAR_METRICS: Metric[] = [
  metric('home_value'),
  metric('home_value_yoy'),
  metric('home_price_forecast', { isPremium: true }),
  metric('for_sale_inventory'),
  metric('days_on_market'),
  metric('market_heat'),
  metric('homeready_score', { isPremium: true, isNew: true }),
];

// Popular Data metrics for Investor view
const INVESTOR_POPULAR_METRICS: Metric[] = [
  metric('cap_rate'),
  metric('rent_index'),
  metric('rent_for_houses'),
  metric('home_value_yoy'),
  metric('vacancy_rate', { isPremium: true }),
  metric('market_heat'),
  metric('investoredge_score', { isPremium: true, isNew: true }),
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
      metric('home_value'),
      metric('home_value_yoy'),
      metric('home_value_5yr', { isPremium: true }),
      metric('home_value_mom', { isPremium: true }),
      metric('income_to_buy', { isNew: true }),
      metric('income_to_rent', { isNew: true }),
      metric('affordable_home_price', { isNew: true }),
      metric('years_to_save', { isPremium: true, isNew: true }),
      metric('homeowner_affordability', { isPremium: true, isNew: true }),
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
          metric('for_sale_inventory'),
          metric('inventory_yoy'),
          metric('inventory_surplus', { isPremium: true }),
          metric('new_listings', { isPremium: true }),
          metric('pending_listings', { isPremium: true }),
        ],
      },
      {
        id: 'velocity',
        name: 'Velocity',
        metrics: [
          metric('days_on_market'),
          metric('days_to_close', { isNew: true }),
          metric('home_sales'),
          metric('home_sales_yoy', { isPremium: true }),
          metric('pending_ratio'),
        ],
      },
      {
        id: 'pricing_dynamics',
        name: 'Pricing Dynamics',
        metrics: [
          metric('price_cut_pct', { isPremium: true }),
          metric('price_cut_amount', { isPremium: true, isNew: true }),
          metric('list_price', { isPremium: true }),
          metric('sale_price', { isPremium: true }),
          metric('price_per_sqft', { isPremium: true }),
        ],
      },
      {
        id: 'new_construction',
        name: 'New Construction',
        metrics: [
          metric('new_construction_sales', { isNew: true }),
          metric('new_construction_price', { isNew: true }),
          metric('new_construction_ppsf', { isPremium: true, isNew: true }),
        ],
      },
    ],
  },
  {
    id: 'demographic',
    name: 'Demographic',
    icon: <PeopleIcon />,
    metrics: [
      metric('population'),
      metric('population_growth', { isPremium: true }),
      metric('median_income'),
      metric('income_growth', { isPremium: true }),
      metric('median_age', { isPremium: true }),
      metric('homeownership_rate', { isPremium: true }),
    ],
  },
  {
    id: 'economic_context',
    name: 'Economic Context',
    icon: <EconomicIcon />,
    metrics: [
      metric('unemployment_rate'),
      metric('job_growth', { isPremium: true }),
      metric('gdp_growth', { isPremium: true }),
      metric('cost_of_living', { isPremium: true }),
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
      metric('rent_index'),
      metric('rent_for_houses'),
      metric('cap_rate', { isPremium: true }),
      metric('gross_yield', { isPremium: true }),
      metric('vacancy_rate', { isPremium: true }),
      metric('rent_growth', { isPremium: true }),
      metric('rent_to_price', { isPremium: true }),
      metric('income_to_rent', { isNew: true }),
      metric('renter_affordability', { isPremium: true, isNew: true }),
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
    metric('homeready_score', { isPremium: true, isNew: true }),
    metric('investoredge_score', { isPremium: true, isNew: true }),
    metric('home_price_forecast', { isPremium: true }),
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
