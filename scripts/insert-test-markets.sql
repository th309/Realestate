-- Insert 10 test markets for development
-- These are real markets we'll use for testing before loading all 120,000+

-- Insert test markets into geo_data
INSERT INTO geo_data (geo_code, geo_name, state_code, geo_type, bounds) VALUES
-- States
('US-CA', 'California', 'CA', 'state', '{"north": 42.0095, "south": 32.5288, "east": -114.1315, "west": -124.4096}'),
('US-TX', 'Texas', 'TX', 'state', '{"north": 36.5007, "south": 25.8371, "east": -93.5083, "west": -106.6456}'),

-- Metros
('US-MSA-31080', 'Los Angeles-Long Beach-Anaheim, CA', 'CA', 'metro', '{"north": 34.8233, "south": 33.3487, "east": -117.6464, "west": -118.6682}'),
('US-MSA-26420', 'Houston-The Woodlands-Sugar Land, TX', 'TX', 'metro', '{"north": 30.3072, "south": 29.4241, "east": -94.9777, "west": -95.8099}'),
('US-MSA-12420', 'Austin-Round Rock, TX', 'TX', 'metro', '{"north": 30.5169, "south": 30.0987, "east": -97.5625, "west": -98.1039}'),
('US-MSA-19100', 'Dallas-Fort Worth-Arlington, TX', 'TX', 'metro', '{"north": 33.3475, "south": 32.6171, "east": -96.4636, "west": -97.5144}'),
('US-MSA-14460', 'Boston-Cambridge-Newton, MA-NH', 'MA', 'metro', '{"north": 42.8864, "south": 42.0629, "east": -70.6109, "west": -71.1912}'),

-- Cities
('US-CITY-06037', 'Los Angeles, CA', 'CA', 'city', '{"north": 34.3373, "south": 33.7037, "east": -118.1553, "west": -118.6682}'),
('US-CITY-48201', 'Houston, TX', 'TX', 'city', '{"north": 30.1104, "south": 29.5213, "east": -95.0908, "west": -95.8099}'),

-- Zip Code
('US-ZIP-78701', 'Austin, TX 78701', 'TX', 'zipcode', '{"north": 30.2747, "south": 30.2682, "east": -97.7392, "west": -97.7476}')
ON CONFLICT (geo_code) DO NOTHING;

-- Insert sample time series data for one market (Austin metro) - last 6 months
INSERT INTO time_series_data (geo_code, date, home_value, home_value_growth_rate, days_on_market, total_active_inventory, rent_for_apartments, rent_for_houses, population, median_household_income, mortgage_rate_30yr, data_source) VALUES
('US-MSA-12420', '2024-06-01', 450000, 5.2, 28, 3500, 1800, 2200, 2300000, 85000, 6.75, 'test'),
('US-MSA-12420', '2024-07-01', 455000, 5.5, 26, 3400, 1820, 2220, 2310000, 85200, 6.80, 'test'),
('US-MSA-12420', '2024-08-01', 460000, 5.8, 25, 3300, 1840, 2240, 2320000, 85400, 6.85, 'test'),
('US-MSA-12420', '2024-09-01', 465000, 6.0, 24, 3200, 1860, 2260, 2330000, 85600, 6.90, 'test'),
('US-MSA-12420', '2024-10-01', 470000, 6.2, 23, 3100, 1880, 2280, 2340000, 85800, 6.95, 'test'),
('US-MSA-12420', '2024-11-01', 475000, 6.5, 22, 3000, 1900, 2300, 2350000, 86000, 7.00, 'test')
ON CONFLICT (geo_code, date) DO NOTHING;

-- Insert sample scores for Austin metro
INSERT INTO current_scores (
  geo_code,
  calculated_date,
  home_price_momentum_score,
  recent_appreciation_score,
  days_on_market_score,
  mortgage_rates_score,
  inventory_levels_score,
  price_cuts_score,
  long_term_appreciation_percentile,
  poverty_rate_percentile,
  median_household_income_percentile,
  demographic_growth_percentile,
  overvaluation_percentile,
  value_income_ratio_percentile,
  wealth_income_percentile,
  cap_rate_percentile,
  rent_percentile,
  home_buyer_score,
  investor_score
) VALUES (
  'US-MSA-12420',
  CURRENT_DATE,
  75.5,  -- Strong momentum
  80.0,  -- High appreciation
  72.0,  -- Good days on market
  45.0,  -- Higher mortgage rates
  78.0,  -- Low inventory
  70.0,  -- Few price cuts
  85.0,  -- High long-term appreciation
  60.0,  -- Moderate poverty
  75.0,  -- Good income
  90.0,  -- Strong growth
  50.0,  -- Fair valuation
  65.0,  -- Reasonable value/income
  70.0,  -- Good wealth
  68.0,  -- Decent cap rate
  72.0,  -- Good rent
  68.5,  -- Home buyer score (average of 6 components)
  72.0   -- Investor score (average of 9 components)
) ON CONFLICT (geo_code) DO UPDATE SET
  calculated_date = EXCLUDED.calculated_date,
  home_price_momentum_score = EXCLUDED.home_price_momentum_score,
  recent_appreciation_score = EXCLUDED.recent_appreciation_score,
  days_on_market_score = EXCLUDED.days_on_market_score,
  mortgage_rates_score = EXCLUDED.mortgage_rates_score,
  inventory_levels_score = EXCLUDED.inventory_levels_score,
  price_cuts_score = EXCLUDED.price_cuts_score,
  long_term_appreciation_percentile = EXCLUDED.long_term_appreciation_percentile,
  poverty_rate_percentile = EXCLUDED.poverty_rate_percentile,
  median_household_income_percentile = EXCLUDED.median_household_income_percentile,
  demographic_growth_percentile = EXCLUDED.demographic_growth_percentile,
  overvaluation_percentile = EXCLUDED.overvaluation_percentile,
  value_income_ratio_percentile = EXCLUDED.value_income_ratio_percentile,
  wealth_income_percentile = EXCLUDED.wealth_income_percentile,
  cap_rate_percentile = EXCLUDED.cap_rate_percentile,
  rent_percentile = EXCLUDED.rent_percentile,
  home_buyer_score = EXCLUDED.home_buyer_score,
  investor_score = EXCLUDED.investor_score,
  updated_at = NOW();

-- Verify the inserts
SELECT 
  'geo_data' as table_name,
  COUNT(*) as count,
  COUNT(DISTINCT geo_type) as types
FROM geo_data
UNION ALL
SELECT 
  'time_series_data' as table_name,
  COUNT(*) as count,
  COUNT(DISTINCT geo_code) as types
FROM time_series_data
UNION ALL
SELECT 
  'current_scores' as table_name,
  COUNT(*) as count,
  COUNT(DISTINCT geo_code) as types
FROM current_scores;

