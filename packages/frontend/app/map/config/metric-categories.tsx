/**
 * Metric Categories Configuration
 */

import type { MetricCategory } from '../types';
import {
  StarIcon, AttachMoneyIcon, ShowChartIcon, PeopleIcon,
  TrendingIcon, AnalyticsIcon
} from '../components';

export const METRIC_CATEGORIES: MetricCategory[] = [
  {
    id: 'popular', name: 'Popular Data', icon: <StarIcon />,
    metrics: [
      { id: 'home_value', name: 'Home Value' },
      { id: 'home_value_yoy', name: 'Home Value Growth (YoY)' },
      { id: 'for_sale_inventory', name: 'For Sale Inventory' },
      { id: 'home_price_forecast', name: 'Home Price Forecast', isPremium: true },
      { id: 'home_value_5yr', name: 'Home Value Growth (5-Year)', isPremium: true },
      { id: 'home_value_mom', name: 'Home Value Growth (MoM)', isPremium: true },
      { id: 'overvalued_pct', name: 'Overvalued %', isPremium: true },
      { id: 'days_on_market', name: 'Days on Market' },
      { id: 'home_sales', name: 'Home Sales', isPremium: true },
      { id: 'cap_rate', name: 'Cap Rate' },
      { id: 'long_term_growth', name: 'Long-Term Growth Score', isPremium: true, isNew: true },
    ],
  },
  {
    id: 'home_price_affordability', name: 'Home Price & Affordability', icon: <AttachMoneyIcon />,
    metrics: [
      { id: 'home_value', name: 'Home Value' },
      { id: 'home_value_yoy', name: 'Home Value Growth (YoY)' },
      { id: 'home_value_5yr', name: 'Home Value Growth (5-Year)', isPremium: true },
      { id: 'overvalued_pct', name: 'Overvalued %', isPremium: true },
      { id: 'sfh_value', name: 'Single Family Value', isPremium: true },
      { id: 'sfh_value_yoy', name: 'Single Family Value Growth (YoY)', isPremium: true },
      { id: 'condo_value', name: 'Condo Value', isPremium: true },
      { id: 'condo_value_yoy', name: 'Condo Value Growth (YoY)', isPremium: true },
    ],
  },
  {
    id: 'market_trends', name: 'Market Trends', icon: <ShowChartIcon />,
    metrics: [
      { id: 'for_sale_inventory', name: 'For Sale Inventory' },
      { id: 'inventory_yoy', name: 'Sale Inventory Growth (YoY)' },
      { id: 'inventory_surplus', name: 'Inventory Surplus/Deficit', isPremium: true },
      { id: 'home_sales', name: 'Home Sales', isPremium: true },
      { id: 'price_cut_pct', name: 'Price Cut %', isPremium: true },
      { id: 'days_on_market', name: 'Days on Market' },
    ],
  },
  {
    id: 'demographic', name: 'Demographic', icon: <PeopleIcon />,
    metrics: [
      { id: 'population', name: 'Population' },
      { id: 'median_income', name: 'Median Household Income' },
      { id: 'population_growth', name: 'Population Growth', isPremium: true },
      { id: 'income_growth', name: 'Income Growth', isPremium: true },
    ],
  },
  {
    id: 'investor_metrics', name: 'Investor Metrics', icon: <TrendingIcon />,
    metrics: [
      { id: 'rent_index', name: 'Rent Index' },
      { id: 'rent_for_houses', name: 'Renter Demand Index' },
      { id: 'cap_rate', name: 'Cap Rate', isPremium: true },
      { id: 'vacancy_rate', name: 'Vacancy Rate', isPremium: true },
    ],
  },
  {
    id: 'scores', name: 'PropertyIQ Scores', icon: <AnalyticsIcon />, isNew: true,
    metrics: [
      { id: 'home_price_forecast', name: 'Home Price Forecast', isPremium: true },
      { id: 'long_term_growth', name: 'Long-Term Growth Score', isPremium: true, isNew: true },
    ],
  },
];
