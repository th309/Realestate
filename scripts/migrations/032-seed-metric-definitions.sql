-- Migration 032: Seed Metric Definitions
-- Defines all metrics with their scoring component mappings

BEGIN;

-- ============================================================================
-- ZILLOW METRICS
-- ============================================================================

INSERT INTO metric_definitions (metric_name, display_name, short_name, description, category, subcategory, format, precision, prefix, suffix, direction, source, source_table, update_frequency, available_geo_types, homeready_component, homeready_weight, investoredge_component, investoredge_weight) VALUES

-- ZHVI (Home Values)
('zhvi', 'Zillow Home Value Index', 'ZHVI', 'Typical home value for the region based on Zillow''s proprietary AVM', 'home_values', 'price', 'currency', 0, '$', NULL, 'neutral', 'zillow', 'zillow_*', 'monthly', ARRAY['state', 'metro', 'county', 'zip'], 'affordability', 0.20, 'entrypoint', 0.25),

('zhvi_yoy', 'ZHVI Year-over-Year Change', 'ZHVI YoY', 'Annual percentage change in home values', 'home_values', 'change', 'percent', 2, NULL, '%', 'up_good', 'zillow', 'calculated_metrics', 'monthly', ARRAY['state', 'metro', 'county', 'zip'], 'momentum', 0.15, 'growth', 0.30),

('zhvi_mom', 'ZHVI Month-over-Month Change', 'ZHVI MoM', 'Monthly percentage change in home values', 'home_values', 'change', 'percent', 2, NULL, '%', 'up_good', 'zillow', 'calculated_metrics', 'monthly', ARRAY['state', 'metro', 'county', 'zip'], 'momentum', 0.05, 'growth', 0.05),

-- ZORI (Rental Values)
('zori', 'Zillow Observed Rent Index', 'ZORI', 'Typical monthly rent for the region', 'rental', 'price', 'currency', 0, '$', '/mo', 'neutral', 'zillow', 'zillow_*', 'monthly', ARRAY['state', 'metro', 'county', 'zip'], 'affordability', 0.15, 'cashflow', 0.30),

('zori_yoy', 'ZORI Year-over-Year Change', 'ZORI YoY', 'Annual percentage change in rents', 'rental', 'change', 'percent', 2, NULL, '%', 'down_good', 'zillow', 'calculated_metrics', 'monthly', ARRAY['state', 'metro', 'county', 'zip'], 'affordability', 0.10, 'cashflow', 0.10),

-- Inventory
('inventory', 'For Sale Inventory', 'Inventory', 'Number of homes available for sale', 'market_activity', 'supply', 'number', 0, NULL, ' homes', 'neutral', 'zillow', 'zillow_*', 'monthly', ARRAY['state', 'metro', 'county', 'zip'], 'stability', 0.10, 'demand', 0.10),

('inventory_yoy', 'Inventory Year-over-Year Change', 'Inv YoY', 'Annual percentage change in for-sale inventory', 'market_activity', 'change', 'percent', 2, NULL, '%', 'up_bad', 'zillow', 'calculated_metrics', 'monthly', ARRAY['state', 'metro', 'county', 'zip'], 'stability', 0.05, 'demand', 0.10),

-- Days on Market
('dom', 'Days on Market', 'DOM', 'Median days listings spend on market before going pending', 'market_activity', 'pace', 'number', 0, NULL, ' days', 'down_good', 'zillow', 'zillow_*', 'monthly', ARRAY['state', 'metro', 'county', 'zip'], 'momentum', 0.10, 'demand', 0.15),

-- Sale Prices
('sale_price', 'Median Sale Price', 'Sale Price', 'Median sale price of homes sold', 'home_values', 'price', 'currency', 0, '$', NULL, 'neutral', 'zillow', 'zillow_*', 'monthly', ARRAY['state', 'metro', 'county', 'zip'], 'value', 0.10, 'entrypoint', 0.10),

('sale_price_yoy', 'Sale Price Year-over-Year Change', 'Sale YoY', 'Annual percentage change in median sale price', 'home_values', 'change', 'percent', 2, NULL, '%', 'up_good', 'zillow', 'calculated_metrics', 'monthly', ARRAY['state', 'metro', 'county', 'zip'], 'value', 0.05, 'growth', 0.05),

-- List Prices
('list_price', 'Median List Price', 'List Price', 'Median asking price of homes for sale', 'home_values', 'price', 'currency', 0, '$', NULL, 'neutral', 'zillow', 'zillow_*', 'monthly', ARRAY['state', 'metro', 'county', 'zip'], NULL, NULL, 'entrypoint', 0.05),

-- Sale to List
('sale_to_list', 'Sale-to-List Ratio', 'S/L Ratio', 'Average ratio of sale price to list price', 'market_activity', 'ratio', 'percent', 2, NULL, '%', 'neutral', 'zillow', 'zillow_*', 'monthly', ARRAY['state', 'metro', 'county', 'zip'], 'value', 0.05, 'demand', 0.05),

-- New Listings
('new_listings', 'New Listings', 'New List', 'Number of new listings added to market', 'market_activity', 'supply', 'number', 0, NULL, ' homes', 'neutral', 'zillow', 'zillow_*', 'monthly', ARRAY['state', 'metro', 'county', 'zip'], 'stability', 0.05, 'demand', 0.05),

-- Pending Sales
('pending_sales', 'Pending Sales', 'Pending', 'Number of homes that went pending', 'market_activity', 'demand', 'number', 0, NULL, ' homes', 'up_good', 'zillow', 'zillow_*', 'monthly', ARRAY['state', 'metro', 'county', 'zip'], 'momentum', 0.05, 'demand', 0.05),

-- Price Cuts
('price_cuts', 'Price Cut Share', 'Price Cuts', 'Percentage of listings with price reductions', 'market_activity', 'ratio', 'percent', 2, NULL, '%', 'down_good', 'zillow', 'zillow_*', 'monthly', ARRAY['state', 'metro', 'county', 'zip'], 'value', 0.05, 'entrypoint', 0.05)

ON CONFLICT (metric_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  short_name = EXCLUDED.short_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  subcategory = EXCLUDED.subcategory,
  format = EXCLUDED.format,
  precision = EXCLUDED.precision,
  prefix = EXCLUDED.prefix,
  suffix = EXCLUDED.suffix,
  direction = EXCLUDED.direction,
  source = EXCLUDED.source,
  source_table = EXCLUDED.source_table,
  update_frequency = EXCLUDED.update_frequency,
  available_geo_types = EXCLUDED.available_geo_types,
  homeready_component = EXCLUDED.homeready_component,
  homeready_weight = EXCLUDED.homeready_weight,
  investoredge_component = EXCLUDED.investoredge_component,
  investoredge_weight = EXCLUDED.investoredge_weight,
  updated_at = NOW();

-- ============================================================================
-- CALCULATED METRICS
-- ============================================================================

INSERT INTO metric_definitions (metric_name, display_name, short_name, description, category, subcategory, format, precision, prefix, suffix, direction, source, source_table, update_frequency, available_geo_types, homeready_component, homeready_weight, investoredge_component, investoredge_weight) VALUES

-- Derived ratios
('grm', 'Gross Rent Multiplier', 'GRM', 'Years of rent to equal home price (ZHVI / annual ZORI)', 'investment', 'ratio', 'number', 1, NULL, 'x', 'down_good', 'calculated', 'calculated_metrics', 'monthly', ARRAY['state', 'metro', 'county', 'zip'], 'value', 0.10, 'cashflow', 0.15),

('rent_yield', 'Gross Rent Yield', 'Rent Yield', 'Annual rent as percentage of home price', 'investment', 'ratio', 'percent', 2, NULL, '%', 'up_good', 'calculated', 'calculated_metrics', 'monthly', ARRAY['state', 'metro', 'county', 'zip'], NULL, NULL, 'cashflow', 0.15),

('cap_rate_proxy', 'Cap Rate Proxy', 'Cap Rate', 'Estimated cap rate based on rent yield minus expenses', 'investment', 'ratio', 'percent', 2, NULL, '%', 'up_good', 'calculated', 'calculated_metrics', 'monthly', ARRAY['state', 'metro', 'county', 'zip'], NULL, NULL, 'cashflow', 0.10),

('months_supply', 'Months of Supply', 'MoS', 'Inventory divided by monthly sales pace', 'market_activity', 'ratio', 'number', 1, NULL, ' months', 'neutral', 'calculated', 'calculated_metrics', 'monthly', ARRAY['state', 'metro', 'county', 'zip'], 'stability', 0.10, 'demand', 0.05),

-- Volatility
('zhvi_volatility', 'Price Volatility (12mo)', 'Volatility', 'Standard deviation of monthly price changes over 12 months', 'risk', 'volatility', 'percent', 2, NULL, '%', 'down_good', 'calculated', 'calculated_metrics', 'monthly', ARRAY['state', 'metro', 'county', 'zip'], 'stability', 0.10, 'risk', 0.20),

-- Multi-year appreciation
('zhvi_3y_cagr', '3-Year Price CAGR', '3Y CAGR', 'Compound annual growth rate over 3 years', 'home_values', 'change', 'percent', 2, NULL, '%', 'up_good', 'calculated', 'calculated_metrics', 'monthly', ARRAY['state', 'metro', 'county', 'zip'], NULL, NULL, 'growth', 0.10),

('zhvi_5y_cagr', '5-Year Price CAGR', '5Y CAGR', 'Compound annual growth rate over 5 years', 'home_values', 'change', 'percent', 2, NULL, '%', 'up_good', 'calculated', 'calculated_metrics', 'monthly', ARRAY['state', 'metro', 'county', 'zip'], NULL, NULL, 'growth', 0.10)

ON CONFLICT (metric_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  short_name = EXCLUDED.short_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  subcategory = EXCLUDED.subcategory,
  format = EXCLUDED.format,
  precision = EXCLUDED.precision,
  prefix = EXCLUDED.prefix,
  suffix = EXCLUDED.suffix,
  direction = EXCLUDED.direction,
  source = EXCLUDED.source,
  source_table = EXCLUDED.source_table,
  update_frequency = EXCLUDED.update_frequency,
  available_geo_types = EXCLUDED.available_geo_types,
  homeready_component = EXCLUDED.homeready_component,
  homeready_weight = EXCLUDED.homeready_weight,
  investoredge_component = EXCLUDED.investoredge_component,
  investoredge_weight = EXCLUDED.investoredge_weight,
  updated_at = NOW();

-- ============================================================================
-- CENSUS METRICS (for future)
-- ============================================================================

INSERT INTO metric_definitions (metric_name, display_name, short_name, description, category, subcategory, format, precision, prefix, suffix, direction, source, source_table, update_frequency, available_geo_types, homeready_component, homeready_weight, investoredge_component, investoredge_weight) VALUES

('median_income', 'Median Household Income', 'Med Income', 'Median annual household income', 'demographics', 'income', 'currency', 0, '$', NULL, 'up_good', 'census', 'census_data', 'yearly', ARRAY['state', 'metro', 'county', 'zip'], 'affordability', 0.10, NULL, NULL),

('population', 'Population', 'Pop', 'Total population', 'demographics', 'population', 'number', 0, NULL, NULL, 'neutral', 'census', 'census_data', 'yearly', ARRAY['state', 'metro', 'county', 'zip'], 'livability', 0.05, NULL, NULL),

('population_growth', 'Population Growth', 'Pop Growth', 'Annual population growth rate', 'demographics', 'change', 'percent', 2, NULL, '%', 'up_good', 'census', 'census_data', 'yearly', ARRAY['state', 'metro', 'county', 'zip'], 'livability', 0.05, 'demand', 0.05),

('unemployment_rate', 'Unemployment Rate', 'Unemp', 'Percentage of labor force unemployed', 'economics', 'employment', 'percent', 1, NULL, '%', 'down_good', 'census', 'census_data', 'yearly', ARRAY['state', 'metro', 'county'], 'livability', 0.05, 'risk', 0.05),

('homeownership_rate', 'Homeownership Rate', 'Own Rate', 'Percentage of owner-occupied housing', 'housing', 'tenure', 'percent', 1, NULL, '%', 'neutral', 'census', 'census_data', 'yearly', ARRAY['state', 'metro', 'county', 'zip'], 'stability', 0.05, NULL, NULL),

('vacancy_rate', 'Vacancy Rate', 'Vacancy', 'Percentage of housing units vacant', 'housing', 'occupancy', 'percent', 1, NULL, '%', 'down_good', 'census', 'census_data', 'yearly', ARRAY['state', 'metro', 'county', 'zip'], 'stability', 0.05, 'risk', 0.05)

ON CONFLICT (metric_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  short_name = EXCLUDED.short_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  subcategory = EXCLUDED.subcategory,
  format = EXCLUDED.format,
  precision = EXCLUDED.precision,
  prefix = EXCLUDED.prefix,
  suffix = EXCLUDED.suffix,
  direction = EXCLUDED.direction,
  source = EXCLUDED.source,
  source_table = EXCLUDED.source_table,
  update_frequency = EXCLUDED.update_frequency,
  available_geo_types = EXCLUDED.available_geo_types,
  homeready_component = EXCLUDED.homeready_component,
  homeready_weight = EXCLUDED.homeready_weight,
  investoredge_component = EXCLUDED.investoredge_component,
  investoredge_weight = EXCLUDED.investoredge_weight,
  updated_at = NOW();

-- ============================================================================
-- FRED METRICS (for future)
-- ============================================================================

INSERT INTO metric_definitions (metric_name, display_name, short_name, description, category, subcategory, format, precision, prefix, suffix, direction, source, source_table, update_frequency, available_geo_types, homeready_component, homeready_weight, investoredge_component, investoredge_weight) VALUES

('mortgage_rate_30y', '30-Year Mortgage Rate', '30Y Rate', 'Average 30-year fixed mortgage rate', 'economics', 'rates', 'percent', 2, NULL, '%', 'down_good', 'fred', 'fred_data', 'weekly', ARRAY['national'], 'affordability', 0.10, NULL, NULL),

('gdp_growth', 'GDP Growth Rate', 'GDP Growth', 'Real GDP growth rate', 'economics', 'growth', 'percent', 2, NULL, '%', 'up_good', 'fred', 'fred_data', 'quarterly', ARRAY['national', 'state', 'metro'], NULL, NULL, 'growth', 0.05),

('cpi', 'Consumer Price Index', 'CPI', 'Consumer price index for all urban consumers', 'economics', 'inflation', 'number', 1, NULL, NULL, 'neutral', 'fred', 'fred_data', 'monthly', ARRAY['national', 'metro'], NULL, NULL, NULL, NULL),

('building_permits', 'Building Permits', 'Permits', 'Number of new residential building permits issued', 'construction', 'supply', 'number', 0, NULL, NULL, 'neutral', 'fred', 'fred_data', 'monthly', ARRAY['national', 'state', 'metro'], NULL, NULL, 'demand', 0.05)

ON CONFLICT (metric_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  short_name = EXCLUDED.short_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  subcategory = EXCLUDED.subcategory,
  format = EXCLUDED.format,
  precision = EXCLUDED.precision,
  prefix = EXCLUDED.prefix,
  suffix = EXCLUDED.suffix,
  direction = EXCLUDED.direction,
  source = EXCLUDED.source,
  source_table = EXCLUDED.source_table,
  update_frequency = EXCLUDED.update_frequency,
  available_geo_types = EXCLUDED.available_geo_types,
  homeready_component = EXCLUDED.homeready_component,
  homeready_weight = EXCLUDED.homeready_weight,
  investoredge_component = EXCLUDED.investoredge_component,
  investoredge_weight = EXCLUDED.investoredge_weight,
  updated_at = NOW();

COMMIT;

-- ============================================================================
-- Verification
-- ============================================================================

SELECT
  source,
  category,
  COUNT(*) as metrics,
  COUNT(homeready_component) as homeready_metrics,
  COUNT(investoredge_component) as investoredge_metrics
FROM metric_definitions
GROUP BY source, category
ORDER BY source, category;
