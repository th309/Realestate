-- ============================================================================
-- Unified Analysis View for PropertyIQ Analytics Assistant
-- ============================================================================
-- This view joins all raw data sources by geography and period into a single
-- analysis-ready table that can be cached to Parquet for fast Claude queries.
--
-- Includes:
-- - Zillow metrics (ZHVI, ZORI, inventory, price cuts, etc.)
-- - Realtor metrics (median price, DOM, hotness, inventory)
-- - Census demographics (population, income, homeownership)
-- - Economic indicators (unemployment, employment, GDP)
-- - Calculated metrics (GRM, cap rate, rent ratios)
-- - PropertyIQ scores (current and historical)
-- - Actual outcomes (for backtesting)
-- ============================================================================

-- Drop existing view if exists
DROP MATERIALIZED VIEW IF EXISTS mv_unified_analysis CASCADE;

-- ============================================================================
-- METRO LEVEL UNIFIED VIEW
-- ============================================================================
CREATE MATERIALIZED VIEW mv_unified_analysis AS

-- METRO data
SELECT 
    g.geography_id,
    'metro' as geography_type,
    g.name as geography_name,
    g.state_code,
    g.cbsa_code,
    COALESCE(z.period_date, r.period_date, e.period_date) as period_date,
    
    -- Zillow metrics (pivoted from metric_name)
    MAX(CASE WHEN z.metric_name = 'zhvi' THEN z.value END) as zhvi,
    MAX(CASE WHEN z.metric_name = 'zhvi_yoy' THEN z.value END) as zhvi_yoy,
    MAX(CASE WHEN z.metric_name = 'zori' THEN z.value END) as zori,
    MAX(CASE WHEN z.metric_name = 'zori_yoy' THEN z.value END) as zori_yoy,
    MAX(CASE WHEN z.metric_name = 'zhvi_mom' THEN z.value END) as zhvi_mom,
    MAX(CASE WHEN z.metric_name = 'zori_mom' THEN z.value END) as zori_mom,
    MAX(CASE WHEN z.metric_name = 'market_heat_index' THEN z.value END) as zillow_market_heat,
    MAX(CASE WHEN z.metric_name = 'inventory_raw' THEN z.value END) as zillow_inventory,
    MAX(CASE WHEN z.metric_name = 'new_listings' THEN z.value END) as zillow_new_listings,
    MAX(CASE WHEN z.metric_name = 'price_cuts' THEN z.value END) as zillow_price_cuts,
    MAX(CASE WHEN z.metric_name = 'days_to_pending' THEN z.value END) as zillow_days_to_pending,
    
    -- Realtor metrics
    r.median_listing_price as realtor_median_price,
    r.median_listing_price_yy as realtor_price_yoy,
    r.median_days_on_market as realtor_dom,
    r.median_days_on_market_yy as realtor_dom_yoy,
    r.active_listing_count as realtor_active_listings,
    r.new_listing_count as realtor_new_listings,
    r.price_reduced_count as realtor_price_reduced,
    r.price_reduced_share as realtor_price_reduced_pct,
    r.pending_listing_count as realtor_pending,
    r.pending_ratio as realtor_pending_ratio,
    r.hotness_score as realtor_hotness,
    r.supply_score as realtor_supply_score,
    r.demand_score as realtor_demand_score,
    r.median_listing_price_per_square_foot as realtor_price_per_sqft,
    
    -- Economic metrics
    e.unemployment_rate,
    e.unemployment_rate_yoy,
    e.total_nonfarm_employment as total_employment,
    e.employment_yoy,
    e.gdp_millions,
    e.gdp_yoy,
    e.rpp_all_items as regional_price_parity,
    e.rpp_housing as rpp_housing,
    
    -- Census metrics (most recent year)
    c.total_population,
    c.population_yoy,
    c.median_household_income,
    c.income_yoy,
    c.median_home_value as census_home_value,
    c.median_gross_rent as census_rent,
    c.homeownership_rate,
    c.rent_as_pct_of_income as rent_burden,
    
    -- Calculated metrics
    cm.grm,
    cm.rent_price_ratio,
    cm.cap_rate_proxy,
    cm.price_rent_ratio,
    cm.zhvi_yoy_change as calc_zhvi_yoy,
    cm.zhvi_3y_change,
    cm.zhvi_5y_change,
    cm.zhvi_90d_change as zhvi_momentum,
    cm.zori_90d_change as zori_momentum,
    cm.zhvi_stddev_12m as price_volatility_12m,
    cm.months_of_supply,
    cm.income_gap_ratio as affordability_gap,
    
    -- PropertyIQ scores
    ps.homeready_score,
    ps.homeready_affordability,
    ps.homeready_stability,
    ps.homeready_value,
    ps.homeready_livability,
    ps.homeready_momentum,
    ps.investoredge_score,
    ps.investoredge_cashflow,
    ps.investoredge_growth,
    ps.investoredge_demand,
    ps.investoredge_entrypoint,
    ps.investoredge_risk,
    ps.confidence_level,
    
    -- Historical outcomes (for backtesting)
    psh.actual_appreciation_12m,
    psh.actual_appreciation_36m,
    psh.actual_appreciation_60m
    
FROM geographies g

-- Zillow data
LEFT JOIN zillow_metro z ON z.region_id = g.zillow_region_id 
    AND z.period_date = (
        SELECT MAX(period_date) FROM zillow_metro 
        WHERE region_id = g.zillow_region_id
    )

-- Realtor data
LEFT JOIN realtor_metro r ON r.cbsa_code = g.cbsa_code
    AND r.period_date = (
        SELECT MAX(period_date) FROM realtor_metro 
        WHERE cbsa_code = g.cbsa_code
    )

-- Economic data
LEFT JOIN economic_metro e ON e.cbsa_code = g.cbsa_code
    AND e.period_date = (
        SELECT MAX(period_date) FROM economic_metro 
        WHERE cbsa_code = g.cbsa_code
    )

-- Census data (most recent year)
LEFT JOIN census_metro c ON c.cbsa_code = g.cbsa_code
    AND c.year = (SELECT MAX(year) FROM census_metro WHERE cbsa_code = g.cbsa_code)

-- Calculated metrics
LEFT JOIN calculated_metrics cm ON cm.geography_id = g.geography_id
    AND cm.period_date = (
        SELECT MAX(period_date) FROM calculated_metrics 
        WHERE geography_id = g.geography_id
    )

-- Current scores
LEFT JOIN propertyiq_scores ps ON ps.geography_id = g.geography_id
    AND ps.period_date = (
        SELECT MAX(period_date) FROM propertyiq_scores 
        WHERE geography_id = g.geography_id
    )

-- Historical scores with outcomes
LEFT JOIN propertyiq_scores_history psh ON psh.geography_id = g.geography_id
    AND psh.period_date = (
        SELECT MAX(period_date) FROM propertyiq_scores_history 
        WHERE geography_id = g.geography_id
    )

WHERE g.geography_type = 'metro'

GROUP BY 
    g.geography_id, g.name, g.state_code, g.cbsa_code,
    z.period_date, r.period_date, e.period_date,
    r.median_listing_price, r.median_listing_price_yy, r.median_days_on_market,
    r.median_days_on_market_yy, r.active_listing_count, r.new_listing_count,
    r.price_reduced_count, r.price_reduced_share, r.pending_listing_count,
    r.pending_ratio, r.hotness_score, r.supply_score, r.demand_score,
    r.median_listing_price_per_square_foot,
    e.unemployment_rate, e.unemployment_rate_yoy, e.total_nonfarm_employment,
    e.employment_yoy, e.gdp_millions, e.gdp_yoy, e.rpp_all_items, e.rpp_housing,
    c.total_population, c.population_yoy, c.median_household_income, c.income_yoy,
    c.median_home_value, c.median_gross_rent, c.homeownership_rate, c.rent_as_pct_of_income,
    cm.grm, cm.rent_price_ratio, cm.cap_rate_proxy, cm.price_rent_ratio,
    cm.zhvi_yoy_change, cm.zhvi_3y_change, cm.zhvi_5y_change, cm.zhvi_90d_change,
    cm.zori_90d_change, cm.zhvi_stddev_12m, cm.months_of_supply, cm.income_gap_ratio,
    ps.homeready_score, ps.homeready_affordability, ps.homeready_stability,
    ps.homeready_value, ps.homeready_livability, ps.homeready_momentum,
    ps.investoredge_score, ps.investoredge_cashflow, ps.investoredge_growth,
    ps.investoredge_demand, ps.investoredge_entrypoint, ps.investoredge_risk,
    ps.confidence_level,
    psh.actual_appreciation_12m, psh.actual_appreciation_36m, psh.actual_appreciation_60m

UNION ALL

-- COUNTY data (similar structure)
SELECT 
    g.geography_id,
    'county' as geography_type,
    g.name as geography_name,
    g.state_code,
    g.fips_code as cbsa_code,
    COALESCE(z.period_date, r.period_date, e.period_date) as period_date,
    
    -- Zillow metrics
    MAX(CASE WHEN z.metric_name = 'zhvi' THEN z.value END) as zhvi,
    MAX(CASE WHEN z.metric_name = 'zhvi_yoy' THEN z.value END) as zhvi_yoy,
    MAX(CASE WHEN z.metric_name = 'zori' THEN z.value END) as zori,
    MAX(CASE WHEN z.metric_name = 'zori_yoy' THEN z.value END) as zori_yoy,
    MAX(CASE WHEN z.metric_name = 'zhvi_mom' THEN z.value END) as zhvi_mom,
    MAX(CASE WHEN z.metric_name = 'zori_mom' THEN z.value END) as zori_mom,
    MAX(CASE WHEN z.metric_name = 'market_heat_index' THEN z.value END) as zillow_market_heat,
    MAX(CASE WHEN z.metric_name = 'inventory_raw' THEN z.value END) as zillow_inventory,
    MAX(CASE WHEN z.metric_name = 'new_listings' THEN z.value END) as zillow_new_listings,
    MAX(CASE WHEN z.metric_name = 'price_cuts' THEN z.value END) as zillow_price_cuts,
    MAX(CASE WHEN z.metric_name = 'days_to_pending' THEN z.value END) as zillow_days_to_pending,
    
    -- Realtor metrics
    r.median_listing_price,
    r.median_listing_price_yy,
    r.median_days_on_market,
    r.median_days_on_market_yy,
    r.active_listing_count,
    r.new_listing_count,
    r.price_reduced_count,
    r.price_reduced_share,
    r.pending_listing_count,
    r.pending_ratio,
    r.hotness_score,
    r.supply_score,
    r.demand_score,
    r.median_listing_price_per_square_foot,
    
    -- Economic metrics
    e.unemployment_rate,
    e.unemployment_rate_yoy,
    e.total_nonfarm_employment,
    e.employment_yoy,
    e.gdp_millions,
    e.gdp_yoy,
    e.rpp_all_items,
    e.rpp_housing,
    
    -- Census metrics
    c.total_population,
    c.population_yoy,
    c.median_household_income,
    c.income_yoy,
    c.median_home_value,
    c.median_gross_rent,
    c.homeownership_rate,
    c.rent_as_pct_of_income,
    
    -- Calculated metrics
    cm.grm,
    cm.rent_price_ratio,
    cm.cap_rate_proxy,
    cm.price_rent_ratio,
    cm.zhvi_yoy_change,
    cm.zhvi_3y_change,
    cm.zhvi_5y_change,
    cm.zhvi_90d_change,
    cm.zori_90d_change,
    cm.zhvi_stddev_12m,
    cm.months_of_supply,
    cm.income_gap_ratio,
    
    -- PropertyIQ scores
    ps.homeready_score,
    ps.homeready_affordability,
    ps.homeready_stability,
    ps.homeready_value,
    ps.homeready_livability,
    ps.homeready_momentum,
    ps.investoredge_score,
    ps.investoredge_cashflow,
    ps.investoredge_growth,
    ps.investoredge_demand,
    ps.investoredge_entrypoint,
    ps.investoredge_risk,
    ps.confidence_level,
    
    -- Historical outcomes
    psh.actual_appreciation_12m,
    psh.actual_appreciation_36m,
    psh.actual_appreciation_60m
    
FROM geographies g
LEFT JOIN zillow_county z ON z.fips_code = g.fips_code
LEFT JOIN realtor_county r ON r.county_fips = g.fips_code
LEFT JOIN economic_county e ON e.county_fips = g.fips_code
LEFT JOIN census_county c ON c.county_fips = g.fips_code
LEFT JOIN calculated_metrics cm ON cm.geography_id = g.geography_id
LEFT JOIN propertyiq_scores ps ON ps.geography_id = g.geography_id
LEFT JOIN propertyiq_scores_history psh ON psh.geography_id = g.geography_id
WHERE g.geography_type = 'county'
GROUP BY 
    g.geography_id, g.name, g.state_code, g.fips_code,
    z.period_date, r.period_date, e.period_date,
    r.median_listing_price, r.median_listing_price_yy, r.median_days_on_market,
    r.median_days_on_market_yy, r.active_listing_count, r.new_listing_count,
    r.price_reduced_count, r.price_reduced_share, r.pending_listing_count,
    r.pending_ratio, r.hotness_score, r.supply_score, r.demand_score,
    r.median_listing_price_per_square_foot,
    e.unemployment_rate, e.unemployment_rate_yoy, e.total_nonfarm_employment,
    e.employment_yoy, e.gdp_millions, e.gdp_yoy, e.rpp_all_items, e.rpp_housing,
    c.total_population, c.population_yoy, c.median_household_income, c.income_yoy,
    c.median_home_value, c.median_gross_rent, c.homeownership_rate, c.rent_as_pct_of_income,
    cm.grm, cm.rent_price_ratio, cm.cap_rate_proxy, cm.price_rent_ratio,
    cm.zhvi_yoy_change, cm.zhvi_3y_change, cm.zhvi_5y_change, cm.zhvi_90d_change,
    cm.zori_90d_change, cm.zhvi_stddev_12m, cm.months_of_supply, cm.income_gap_ratio,
    ps.homeready_score, ps.homeready_affordability, ps.homeready_stability,
    ps.homeready_value, ps.homeready_livability, ps.homeready_momentum,
    ps.investoredge_score, ps.investoredge_cashflow, ps.investoredge_growth,
    ps.investoredge_demand, ps.investoredge_entrypoint, ps.investoredge_risk,
    ps.confidence_level,
    psh.actual_appreciation_12m, psh.actual_appreciation_36m, psh.actual_appreciation_60m;

-- Create indexes for fast lookups
CREATE INDEX idx_unified_analysis_geo ON mv_unified_analysis(geography_type, geography_id);
CREATE INDEX idx_unified_analysis_state ON mv_unified_analysis(state_code);
CREATE INDEX idx_unified_analysis_period ON mv_unified_analysis(period_date);
CREATE INDEX idx_unified_analysis_scores ON mv_unified_analysis(homeready_score, investoredge_score);

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_unified_analysis()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW mv_unified_analysis;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON mv_unified_analysis TO authenticated;
GRANT SELECT ON mv_unified_analysis TO service_role;
