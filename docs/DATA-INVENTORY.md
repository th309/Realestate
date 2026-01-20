# REI Platform Data Inventory

Complete inventory of all data available in the database, including sources, update schedules, frontend connections, and definitions.

---

## Table of Contents
1. [Zillow Data](#1-zillow-data)
2. [Realtor.com Data](#2-realtorcom-data)
3. [Redfin Rental Data](#3-redfin-rental-data)
4. [Census Data](#4-census-data)
5. [Economic Data](#5-economic-data)
6. [Building Permits Data](#6-building-permits-data)
7. [Calculated Metrics](#7-calculated-metrics)
8. [PropertyIQ Scores](#8-propertyiq-scores)
9. [Geographic Reference Data](#9-geographic-reference-data)
10. [GitHub Automation Schedule](#10-github-automation-schedule)

---

## 1. ZILLOW DATA

**Source:** Zillow Research Data (https://zillow.com/research/data/)
**Update Interval:** Monthly (published 15th-16th of each month)
**GitHub Auto-Update:** ✅ Yes - `zillow-monthly-import.yml` runs on 18th of each month at 6:00 AM UTC

### Tables

| Table | Connected Card | Metric | Definition |
|-------|----------------|--------|------------|
| `zillow_state` | ChartSection, MetricCard | ZHVI, ZORI, Inventory, DOM | State-level Zillow metrics in long format (metric_name, value) |
| `zillow_metro` | ChartSection, MetricCard, BenchmarkPanel | ZHVI, ZORI, Inventory, DOM | Metro/CBSA-level Zillow metrics |
| `zillow_county` | ChartSection, MetricCard | ZHVI, ZORI, Inventory, DOM | County-level Zillow metrics (by FIPS code) |
| `zillow_zip` | ChartSection, MetricCard, RightDetailPanel | ZHVI, ZORI, Inventory, DOM | ZIP code-level Zillow metrics |
| `zillow_city` | ChartSection, MetricCard | ZHVI, ZORI, Inventory, DOM | City-level Zillow metrics |

### Metrics

| Metric Name | Card Display | Source Column | Definition |
|-------------|--------------|---------------|------------|
| **ZHVI (Zillow Home Value Index)** | MetricCard "Median Home Value" | `value` where metric_name='zhvi' | Smoothed, seasonally adjusted measure of typical home value. Uses repeat-sales methodology to track same-property value changes over time. |
| **ZORI (Zillow Observed Rent Index)** | MetricCard "Median Rent" | `value` where metric_name='zori' | Smoothed measure of typical observed market rent across the region. Calculated from listed rental prices. |
| **ZHVF (Zillow Home Value Forecast)** | ChartSection forecast overlay | `forecast_1m`, `forecast_3m`, `forecast_12m` | Zillow's proprietary forecast of expected home value change. Expressed as % change from current value. |
| **ZORDI (Renter Demand Index)** | ScoreCards "InvestorEdge" component | `value` where metric_name='zordi' | Index measuring relative renter demand. Higher values = stronger rental market demand. Not a dollar amount. |
| **Inventory** | MetricCard "Active Listings" | `value` where metric_name='inventory' | Count of unique properties listed for sale during the month. |
| **New Listings** | MetricCard, BenchmarkPanel | `value` where metric_name='new_listings' | Count of new listings added to market during the month. |
| **Pending Listings** | MetricCard, BenchmarkPanel | `value` where metric_name='pending_listings' | Count of listings that went under contract during the month. |
| **Days on Market** | MetricCard "Days on Market" | `value` where metric_name='dom' | Median number of days from listing to pending status. |
| **List Price** | MetricCard | `value` where metric_name='list_price' | Median listing price of active for-sale inventory. |
| **Sale Price** | MetricCard | `value` where metric_name='sale_price' | Median final sale price of closed transactions. |
| **Sale-to-List Ratio** | MetricCard | `mean_ratio`, `median_ratio` | Sale price ÷ List price. Values >1 indicate homes selling above asking. |
| **Price Cuts** | MetricCard, BenchmarkPanel | `share_with_price_cut` | Percentage of listings with a price reduction during the month. |
| **Market Heat Index** | ScoreCards component | `heat_index` | 0-100 scale measuring market activity/competitiveness. |
| **ZHVI YoY** | ChartSection, MetricCard trend | Calculated | Year-over-year % change: ((current - 12mo_ago) / 12mo_ago) × 100 |
| **ZORI YoY** | ChartSection, MetricCard trend | Calculated | Year-over-year % change in rent index |

---

## 2. REALTOR.COM DATA

**Source:** Realtor.com Economics Research (https://econdata.s3-us-west-2.amazonaws.com/Reports/Core/)
**Update Interval:** Monthly (published ~15th of each month)
**GitHub Auto-Update:** ✅ Yes - `realtor-monthly-import.yml` runs on 15th of each month at 6:00 AM UTC

### Tables

| Table | Connected Card | Geographic Level | Key Identifier |
|-------|----------------|------------------|----------------|
| `realtor_national` | BenchmarkPanel baseline | National | `country` |
| `realtor_state` | MetricCard, BenchmarkPanel | State | `state_id` |
| `realtor_metro` | MetricCard, BenchmarkPanel, ScoreCards | Metro/CBSA | `cbsa_code` |
| `realtor_county` | MetricCard, BenchmarkPanel | County | `county_fips` |
| `realtor_zip` | MetricCard, RightDetailPanel | ZIP Code | `postal_code` |

### Metrics

| Metric Name | Card Display | Column | Definition |
|-------------|--------------|--------|------------|
| **Median Listing Price** | MetricCard "Home Value" | `median_listing_price` | Median active listing price for the month. |
| **Median Listing Price YoY** | MetricCard trend arrow | `median_listing_price_yy` | Year-over-year % change in median listing price. |
| **Median Listing Price MoM** | MetricCard | `median_listing_price_mm` | Month-over-month % change in median listing price. |
| **Active Listing Count** | MetricCard "Inventory" | `active_listing_count` | Total count of active for-sale listings at month end. |
| **Active Listing Count YoY** | MetricCard trend, BenchmarkPanel | `active_listing_count_yy` | Year-over-year % change in inventory. Positive = growing inventory. |
| **Median Days on Market** | MetricCard "Days on Market" | `median_days_on_market` | Median days from listing to pending/sold. |
| **New Listing Count** | MetricCard, BenchmarkPanel | `new_listing_count` | Count of new listings added during the month. |
| **New Listing Count YoY** | BenchmarkPanel | `new_listing_count_yy` | Year-over-year % change in new listings. |
| **Pending Listing Count** | MetricCard, BenchmarkPanel "Home Sales" | `pending_listing_count` | Count of listings that went under contract. Proxy for sales activity. |
| **Pending Listing Count YoY** | MetricCard trend | `pending_listing_count_yy` | Year-over-year % change in pending listings. |
| **Price Reduced Share** | MetricCard, BenchmarkPanel | `price_reduced_share` | % of listings with a price reduction. Higher = weaker seller's market. |
| **Price Increased Share** | MetricCard | `price_increased_share` | % of listings with a price increase. |
| **Median Price Per SqFt** | MetricCard | `median_listing_price_per_square_foot` | Median listing price divided by square footage. |
| **Pending Ratio** | BenchmarkPanel | `pending_ratio` | Pending listings ÷ Active listings. Higher = faster-moving market. |
| **Hotness Score** | ScoreCards "Market Health" | `hotness_score` | 0-100 composite score of market demand/supply balance. (Metro/County/ZIP only) |
| **Supply Score** | ScoreCards component | `supply_score` | 0-100 score measuring listing supply relative to demand. |
| **Demand Score** | ScoreCards component | `demand_score` | 0-100 score measuring buyer demand (views, saves, clicks). |
| **Hotness Rank** | MetricCard | `hotness_rank` | National rank by hotness score (1 = hottest market). |
| **Months of Supply** | BenchmarkPanel | Calculated | Active Listings ÷ Pending Listings. <4 = seller's market, >6 = buyer's market. |

---

## 3. REDFIN RENTAL DATA

**Source:** Redfin Data Center - Rental Market Data (https://www.redfin.com/news/data-center/rental-market-data/)
**Update Interval:** Monthly
**GitHub Auto-Update:** ❌ No scheduled workflow (manual import via scripts)

### Tables

| Table | Connected Card | Geographic Level | Key Identifier |
|-------|----------------|------------------|----------------|
| `redfin_rental_national` | BenchmarkPanel baseline | National | N/A |
| `redfin_rental_state` | MetricCard | State | `state_code` |
| `redfin_rental_metro` | MetricCard | Metro/CBSA | `cbsa_code` |
| `redfin_rental_county` | MetricCard | County | `fips_code` |
| `redfin_rental_city` | MetricCard | City | `city_name`, `state_code` |
| `redfin_rental_zip` | MetricCard | ZIP Code | `zip_code` |

### Metrics

| Metric Name | Card Display | Column | Definition |
|-------------|--------------|--------|------------|
| **Median Asking Rent** | MetricCard "Asking Rent" | `median_asking_rent` | Median monthly asking rent for rental listings. |
| **Median Asking Rent YoY** | MetricCard trend | `median_asking_rent_yoy` | Year-over-year % change in asking rent. |
| **Median Asking Rent PSF** | MetricCard | `median_asking_rent_psf` | Median asking rent per square foot. |
| **Bedroom 0-1 Share** | N/A | `bedroom_0_1_share` | % of rental listings that are studio or 1-bedroom. |
| **Bedroom 2 Share** | N/A | `bedroom_2_share` | % of rental listings that are 2-bedroom. |
| **Bedroom 3+ Share** | N/A | `bedroom_3_plus_share` | % of rental listings that are 3+ bedroom. |

---

## 4. CENSUS DATA

**Source:** U.S. Census Bureau - American Community Survey 5-Year Estimates
**Update Interval:** Annual (released December for prior year data)
**GitHub Auto-Update:** ✅ Yes - `economic-monthly-import.yml` runs on 20th of each month at 6:00 AM UTC

### Tables

| Table | Connected Card | Geographic Level | Key Identifier |
|-------|----------------|------------------|----------------|
| `census_national` | StatsSection | National | `year` |
| `census_state` | MetricCard | State | `state_fips` |
| `census_metro` | MetricCard, ScoreCards | Metro/CBSA | `cbsa_code` |
| `census_county` | MetricCard, ScoreCards | County | `fips_code` |
| `census_city` | MetricCard | City/Place | `place_fips` |
| `census_zip` | MetricCard, RightDetailPanel | ZIP/ZCTA | `zcta` |

### Metrics

| Metric Name | Card Display | Column | Definition |
|-------------|--------------|--------|------------|
| **Total Population** | MetricCard "Population" | `total_population` | Total resident population count. |
| **Population YoY** | MetricCard trend | `population_yoy` | Year-over-year % change in population. Calculated from consecutive ACS years. |
| **Median Age** | MetricCard | `median_age` | Median age of population in years. |
| **Median Household Income** | MetricCard "Median Income", ScoreCards affordability | `median_household_income` | Median annual household income in dollars. |
| **Income YoY** | MetricCard trend | `income_yoy` | Year-over-year % change in median household income. |
| **Per Capita Income** | MetricCard | `per_capita_income` | Total income ÷ Total population. |
| **Total Housing Units** | MetricCard | `total_housing_units` | Count of all housing units (occupied + vacant). |
| **Owner Occupied Units** | MetricCard | `owner_occupied_units` | Count of owner-occupied housing units. |
| **Renter Occupied Units** | MetricCard | `renter_occupied_units` | Count of renter-occupied housing units. |
| **Homeownership Rate** | MetricCard "Homeownership" | `homeownership_rate` | Owner-occupied ÷ Total occupied units × 100. |
| **Median Home Value** | ScoreCards affordability | `median_home_value` | Median value of owner-occupied housing units (self-reported). |
| **Median Gross Rent** | ScoreCards, MetricCard | `median_gross_rent` | Median monthly rent including utilities. |
| **Rent as % of Income** | ScoreCards affordability | `rent_as_pct_of_income` | Median gross rent ÷ Median household income × 12 × 100. >30% = rent-burdened. |

---

## 5. ECONOMIC DATA

**Sources:**
- FRED (Federal Reserve Economic Data) - Monthly unemployment
- BLS (Bureau of Labor Statistics) - QCEW employment data
- BEA (Bureau of Economic Analysis) - GDP, Regional Price Parities

**Update Intervals:**
- Unemployment: Monthly (1 month lag)
- QCEW Employment: Quarterly (6 month lag)
- GDP: Quarterly/Annual
- RPP: Annual

**GitHub Auto-Update:** ✅ Yes - `economic-monthly-import.yml` runs on 20th of each month at 6:00 AM UTC

### Tables

| Table | Connected Card | Geographic Level | Key Identifier |
|-------|----------------|------------------|----------------|
| `economic_national` | BenchmarkPanel baseline | National | `period_date` |
| `economic_state` | MetricCard, ScoreCards | State | `state_fips` |
| `economic_metro` | MetricCard, ScoreCards | Metro/CBSA | `cbsa_code` |
| `economic_county` | MetricCard | County | `fips_code` |

### Metrics

| Metric Name | Card Display | Column | Source | Definition |
|-------------|--------------|--------|--------|------------|
| **Unemployment Rate** | MetricCard "Unemployment" | `unemployment_rate` | FRED/BLS | % of labor force that is unemployed and seeking work. |
| **Unemployment Rate YoY** | MetricCard trend | `unemployment_rate_yoy` | Calculated | Year-over-year change in percentage points. |
| **Total Nonfarm Employment** | MetricCard "Jobs" | `total_nonfarm_employment` | BLS QCEW | Total count of nonfarm payroll jobs. |
| **Employment YoY** | MetricCard "Job Growth" | `employment_yoy` | Calculated | Year-over-year % change in employment. |
| **GDP (Millions)** | MetricCard | `gdp_millions` | BEA | Gross Domestic Product in millions of dollars. State/Metro level. |
| **Real GDP (Millions)** | MetricCard | `real_gdp_millions` | BEA | Inflation-adjusted GDP in millions of chained dollars. |
| **GDP YoY** | MetricCard trend | `gdp_yoy` | Calculated | Year-over-year % change in real GDP. |
| **RPP All Items** | MetricCard "Cost of Living" | `rpp_all_items` | BEA | Regional Price Parity. US average = 100. >100 = more expensive than average. |
| **RPP Housing** | ScoreCards affordability | `rpp_housing` | BEA | Regional Price Parity for housing costs. US = 100. |
| **RPP Goods** | MetricCard | `rpp_goods` | BEA | Regional Price Parity for goods. US = 100. |
| **RPP Utilities** | MetricCard | `rpp_utilities` | BEA | Regional Price Parity for utilities. US = 100. |

---

## 6. BUILDING PERMITS DATA

**Source:** U.S. Census Bureau Building Permits Survey (BPS) (https://www2.census.gov/econ/bps/)
**Update Interval:** Monthly (1-2 month lag)
**GitHub Auto-Update:** ✅ Yes - `permits-monthly-import.yml` runs on 22nd of each month at 6:00 AM UTC

### Tables

| Table | Connected Card | Geographic Level | Key Identifier |
|-------|----------------|------------------|----------------|
| `permits_state` | MetricCard, ChartSection | State | `state_fips` |
| `permits_metro` | MetricCard, ChartSection | Metro/CBSA | `cbsa_code` |
| `permits_county` | MetricCard, ChartSection | County | `fips_code` |

### Metrics

| Metric Name | Card Display | Column | Definition |
|-------------|--------------|--------|------------|
| **SF Buildings** | MetricCard | `sf_buildings` | Count of single-family building permits issued. |
| **SF Units** | MetricCard "SF Permits" | `sf_units` | Count of single-family housing units permitted. (1 unit per building) |
| **SF Value** | MetricCard | `sf_value` | Total construction value of SF permits in dollars. |
| **Duplex Buildings** | N/A | `duplex_buildings` | Count of 2-unit building permits issued. |
| **Duplex Units** | N/A | `duplex_units` | Count of duplex housing units permitted. |
| **Duplex Value** | N/A | `duplex_value` | Total construction value of duplex permits in dollars. |
| **Small Multi Buildings** | N/A | `small_multi_buildings` | Count of 3-4 unit building permits issued. |
| **Small Multi Units** | N/A | `small_multi_units` | Count of 3-4 unit housing units permitted. |
| **Small Multi Value** | N/A | `small_multi_value` | Total construction value of 3-4 unit permits in dollars. |
| **Large Multi Buildings** | MetricCard | `large_multi_buildings` | Count of 5+ unit building permits issued. |
| **Large Multi Units** | MetricCard "MF Permits" | `large_multi_units` | Count of 5+ unit housing units permitted. |
| **Large Multi Value** | N/A | `large_multi_value` | Total construction value of 5+ unit permits in dollars. |
| **Total Buildings** | MetricCard | `total_buildings` | Sum of all building permits across all unit types. |
| **Total Units** | MetricCard "Total Permits" | `total_units` | Sum of all housing units permitted. |
| **Total Value** | MetricCard | `total_value` | Sum of all construction value in dollars. |
| **SF Units YoY** | MetricCard trend | `sf_units_yoy` | Year-over-year % change in SF units permitted. |
| **Total Units YoY** | MetricCard trend | `total_units_yoy` | Year-over-year % change in total units permitted. |
| **Value Per Unit** | MetricCard | Calculated | `total_value / total_units`. Average construction cost per unit. Rounded to whole dollars. |
| **SF/MF Ratio** | MetricCard | Calculated | `sf_units / (duplex_units + small_multi_units + large_multi_units)`. Higher = more SF-focused market. |

---

## 7. HUD FAIR MARKET RENT DATA

**Source:** HUD User - Fair Market Rents (https://www.huduser.gov/portal/datasets/fmr.html)
**Update Interval:** Annual (published September/October for next fiscal year)
**GitHub Auto-Update:** ✅ Yes - `hud-fmr-annual-import.yml` runs on October 15th at 6:00 AM UTC

### Table: `hud_fmr`

| Column | Type | Definition |
|--------|------|------------|
| `year` | INTEGER | Fiscal year (e.g., 2025 for FY2025) |
| `fips_code` | VARCHAR(5) | 5-digit county FIPS code |
| `county_name` | VARCHAR | County name |
| `state_fips` | VARCHAR(2) | 2-digit state FIPS |
| `state_name` | VARCHAR | State name |
| `metro_code` | VARCHAR | CBSA code if in metro area |
| `metro_name` | VARCHAR | Metro area name if applicable |
| `fmr_0br` | INTEGER | Fair Market Rent for 0-bedroom (studio) |
| `fmr_1br` | INTEGER | Fair Market Rent for 1-bedroom |
| `fmr_2br` | INTEGER | Fair Market Rent for 2-bedroom (most commonly used) |
| `fmr_3br` | INTEGER | Fair Market Rent for 3-bedroom |
| `fmr_4br` | INTEGER | Fair Market Rent for 4-bedroom |

### Usage

HUD FMR provides **100% county coverage** for rent data, unlike ZORI which only covers major metros. Used as secondary rent source for cap rate calculations when ZORI is unavailable.

**Priority order for rent data:**
1. ZORI (Zillow Observed Rent Index) - most current
2. HUD FMR (Fair Market Rent) - best coverage
3. Census Median Gross Rent - fallback

---

## 8. CALCULATED METRICS

**Source:** Derived from primary data tables (Zillow, Realtor, Census, HUD FMR)
**Update Interval:** Automatically refreshed after each data import
**GitHub Auto-Update:** ✅ Yes - `post-import-refresh.yml` runs on 25th of each month AND after each data import

### Table: `calculated_metrics`

| Metric Name | Card Display | Formula | Definition |
|-------------|--------------|---------|------------|
| **GRM (Gross Rent Multiplier)** | MetricCard "GRM", ScoreCards | `ZHVI / (ZORI × 12)` | Years of rent to equal property value. Lower = better cash flow potential. Typical range: 10-25. |
| **Annual Rent-Price Ratio** | ScoreCards | `(ZORI × 12) / ZHVI` | Annual rent as % of property value. Higher = better yield. Inverse of GRM. |
| **Cap Rate Proxy** | MetricCard "Cap Rate", ScoreCards | `(ZORI × 12 × 0.60) / ZHVI × 100` | Estimated cap rate assuming 60% NOI (40% expense ratio). Higher = better cash flow. |
| **Cap Rate (Calculated)** | MetricCard "Cap Rate" | `(ZORI × 12 × 0.60) / median_listing_price × 100` | Cap rate using listing price instead of ZHVI. More accurate for purchase decisions. |
| **Gross Yield** | MetricCard "Gross Yield" | `(ZORI × 12) / median_listing_price × 100` | Annual rent ÷ Price × 100. Does not account for expenses. |
| **Rent-to-Price Ratio** | ScoreCards | `ZORI / median_listing_price` | Monthly rent ÷ Price. Rule of 1%: ratio ≥0.01 suggests positive cash flow. |
| **Price-Rent Ratio** | MetricCard | `ZHVI / ZORI` | Monthly: home value ÷ monthly rent. Higher = more expensive to buy vs rent. |
| **ZHVI YoY Change** | ChartSection, MetricCard trend | `((current - 12mo_ago) / 12mo_ago) × 100` | Year-over-year % change in home values. |
| **ZORI YoY Change** | ChartSection, MetricCard trend | `((current - 12mo_ago) / 12mo_ago) × 100` | Year-over-year % change in rents. |
| **Inventory YoY Change** | BenchmarkPanel | `((current - 12mo_ago) / 12mo_ago) × 100` | Year-over-year % change in active listings. |
| **ZHVI 3Y Change** | MetricCard | `((current - 36mo_ago) / 36mo_ago) × 100` | 3-year cumulative % change in home values. |
| **ZHVI 5Y Change** | MetricCard | `((current - 60mo_ago) / 60mo_ago) × 100` | 5-year cumulative % change in home values. |
| **ZHVI 3Y CAGR** | MetricCard "3Y Growth" | `((current / 36mo_ago)^(1/3) - 1) × 100` | 3-year compound annual growth rate. |
| **ZHVI 5Y CAGR** | MetricCard "5Y Growth" | `((current / 60mo_ago)^(1/5) - 1) × 100` | 5-year compound annual growth rate. |
| **90-Day Momentum** | ScoreCards | Various | Short-term price/rent/inventory changes over 90 days. |
| **Volatility (12M StdDev)** | ScoreCards risk | `STDDEV(ZHVI) over 12 months` | Standard deviation of monthly values. Higher = more volatile market. |
| **Volatility (36M StdDev)** | ScoreCards risk | `STDDEV(ZHVI) over 36 months` | 3-year standard deviation for longer-term volatility. |
| **Income Gap Ratio** | ScoreCards affordability | `ZHVI / median_household_income` | Home price ÷ Income. >3.5 suggests affordability stress. |
| **Months of Supply** | BenchmarkPanel, ScoreCards | `active_listing_count / pending_listing_count` | Months to sell current inventory at current pace. <4 = seller's market, >6 = buyer's market. |
| **Absorption Rate** | ScoreCards | `pending_listing_count / active_listing_count` | % of inventory going under contract monthly. Higher = faster market. |
| **Overvalued %** | MetricCard "Overvalued" | `((ZHVI / median_income) - 3.5) / 3.5 × 100` | % deviation from 3.5x price-to-income benchmark. Positive = overvalued. |
| **Income to Buy** | MetricCard "Income Needed" | `(ZHVI × 0.28) / 12 / 0.28` or from table | Annual income needed to afford median home (28% DTI). |
| **Affordable Home Price** | MetricCard | `median_household_income × 3.5` | Max home price affordable at 3.5x income. |
| **Years to Save** | MetricCard "Years to Save" | `(median_price × 0.20) / (median_income × 0.10)` | Years to save 20% down payment assuming 10% savings rate. |
| **Inventory Surplus %** | MetricCard | `((current_inventory - historical_avg) / historical_avg) × 100` | Current inventory vs historical average. Positive = surplus. |
| **Market Health Score** | ScoreCards (0-100) | Composite | Weighted combination of supply/demand, price stability, market activity. |
| **Investment Score** | ScoreCards (0-100) | Composite | Weighted combination of cash flow, appreciation, liquidity, risk. |
| **Long-Term Growth Score** | ScoreCards (0-100) | Composite | Weighted combination of 5Y CAGR, population growth, income growth. |

---

## 9. PROPERTYIQ SCORES

**Source:** Proprietary scoring algorithm using all data sources
**Update Interval:** Automatically refreshed after each data import
**GitHub Auto-Update:** ✅ Yes - `post-import-refresh.yml` runs scoring pipeline after calculated metrics refresh

### Tables

| Table | Purpose |
|-------|---------|
| `propertyiq_scores` | Current HomeReady and InvestorEdge scores for all geographies |
| `propertyiq_score_details` | Breakdown of score components |
| `propertyiq_scores_history` | Historical scores for backtesting |
| `propertyiq_rankings` | National and state rankings |
| `metric_percentiles` | Pre-computed percentile distributions |
| `calculated_metrics` | Market Health Index and other calculated scores (market_health_score, investment_score, long_term_growth_score) |

### HomeReady Score (For Homebuyers)

| Component | Weight | Card Display | Metrics Used | Definition |
|-----------|--------|--------------|--------------|------------|
| **HomeReady Score** | 100% | ScoreCards main score | All below | 0-100 composite score for homebuyer attractiveness. Higher = better time to buy. |
| **Affordability** | ~25% | ScoreCards indicator | median_income, ZHVI, rent_pct_income | How affordable is the market relative to incomes? |
| **Stability** | ~20% | ScoreCards indicator | price_volatility, inventory_stability | How stable are prices and inventory? |
| **Value** | ~20% | ScoreCards indicator | ZHVI_vs_history, price_to_income | Is the market fairly valued? |
| **Livability** | ~15% | ScoreCards indicator | employment, population_growth, age_demographics | Quality of life factors. |
| **Momentum** | ~20% | ScoreCards indicator | ZHVI_yoy, inventory_yoy, DOM_change | Market direction and speed. |
| **Trend** | N/A | ScoreCards trend arrow | 3-month score change | 'improving', 'stable', or 'declining' |

### InvestorEdge Score (For Investors)

| Component | Weight | Card Display | Metrics Used | Definition |
|-----------|--------|--------------|--------------|------------|
| **InvestorEdge Score** | 100% | ScoreCards main score | All below | 0-100 composite score for investment attractiveness. Higher = better investment opportunity. |
| **Cash Flow** | ~25% | ScoreCards indicator | cap_rate, GRM, rent_to_price | Potential for positive monthly cash flow. |
| **Growth** | ~25% | ScoreCards indicator | ZHVI_5y_cagr, population_growth, job_growth | Long-term appreciation potential. |
| **Demand** | ~20% | ScoreCards indicator | ZORDI, pending_ratio, DOM | Tenant/buyer demand strength. |
| **Entry Point** | ~15% | ScoreCards indicator | overvalued_pct, price_vs_history | Is it a good time to buy? |
| **Risk** | ~15% | ScoreCards indicator | volatility, inventory_surplus, economic_diversity | Downside risk factors. Lower is better for this component. |
| **Trend** | N/A | ScoreCards trend arrow | 3-month score change | 'improving', 'stable', or 'declining' |

### Market Health Index (Market Conditions)

**Table:** `calculated_metrics` (column: `market_health_score`)

| Component | Weight | Card Display | Metrics Used | Definition |
|-----------|--------|--------------|--------------|------------|
| **Market Health Index** | 100% | ScoreCards main score (Orange) | All below | 0-100 composite score measuring overall market health. Higher = healthier market conditions. |
| **Days on Market** | ~25% | ScoreCards "Supply/Demand" | `median_days_on_market` | Lower DOM = stronger demand. Formula: `100 - (DOM / 90) × 100`. National avg is 40-60 days. |
| **Inventory YoY** | ~25% | ScoreCards indicator | `active_listing_count_yy` | Moderate change (-20% to +20%) is healthy. Formula: `50 + (inventoryYoY × 2.5)`. |
| **Price Cut Share** | ~25% | ScoreCards "Price Stability" | `price_reduced_share` | Lower is better. Typical range 0-30%. Formula: `100 - (priceCutShare / 30) × 100`. |
| **Pending Ratio** | ~25% | ScoreCards "Market Activity" | `pending_ratio` | Higher = faster-moving market. Pending listings ÷ Active listings. |

**Calculation:**
```
Market Health Score = Base(50) + Σ(component_score - 50) / factors
```
Each component adds or subtracts from the base score of 50, then normalized to 0-100.

### Score Interpretation

| Score Range | Interpretation | Color |
|-------------|----------------|-------|
| 80-100 | Excellent opportunity | Green |
| 60-79 | Good opportunity | Light Green |
| 40-59 | Neutral/Average | Amber |
| 20-39 | Below average | Orange |
| 0-19 | Poor opportunity | Red |

---

## 10. GEOGRAPHIC REFERENCE DATA

### Tables

| Table | Source | Purpose |
|-------|--------|---------|
| `geographies` | Multiple | Unified geography reference with all identifiers |
| `tiger_national` | Census TIGER/Line | National boundary GeoJSON |
| `metric_definitions` | Internal | Metric metadata and score weights |

### Geography Identifiers

| Level | Primary Key | Alternate Keys |
|-------|-------------|----------------|
| National | `geography_id = 'national'` | N/A |
| State | `state_fips` (2-digit) | `state_code` (2-letter), `zillow_state_region_id` |
| Metro | `cbsa_code` (5-digit) | `zillow_metro_region_id`, `cbsa_name` |
| County | `fips_code` (5-digit) | `state_fips` + `county_fips`, `zillow_county_region_id` |
| City | `place_fips` (7-digit) | `city_name` + `state_code` |
| ZIP | `zcta` (5-digit) | `zip_code`, `zillow_region_id` |

---

## 11. GITHUB AUTOMATION SCHEDULE

### Scheduled Workflows

| Workflow | Schedule | Data Sources | Tables Updated |
|----------|----------|--------------|----------------|
| `realtor-monthly-import.yml` | 15th of month, 6:00 AM UTC | Realtor.com S3 | `realtor_national`, `realtor_state`, `realtor_metro`, `realtor_county`, `realtor_zip` |
| `zillow-monthly-import.yml` | 18th of month, 6:00 AM UTC | Zillow Research | `zillow_state`, `zillow_metro`, `zillow_county`, `zillow_zip` |
| `economic-monthly-import.yml` | 20th of month, 6:00 AM UTC | Census ACS, BEA, FRED, BLS | `census_*`, `economic_*` |
| `permits-monthly-import.yml` | 22nd of month, 6:00 AM UTC | Census BPS | `permits_state`, `permits_county` |
| `post-import-refresh.yml` | 25th of month + after each import | Derived | `calculated_metrics`, `propertyiq_scores`, `propertyiq_rankings` |
| `hud-fmr-annual-import.yml` | October 15th, 6:00 AM UTC | HUD User | `hud_fmr` |

### Automated Pipeline (Triggered by Data Imports)

Each data import workflow automatically triggers the `post-import-refresh.yml` workflow on success, which:

1. **Refreshes Calculated Metrics** - cap_rate, gross_yield, GRM, overvalued%, 5yr growth, income_to_buy
2. **Runs PropertyIQ Scoring Pipeline** - HomeReady Score, InvestorEdge Score, Market Health Index
3. **Updates Rankings** - National and state-level rankings

### Manual Import Scripts (Not Scheduled)

| Script | Data Source | Tables Updated |
|--------|-------------|----------------|
| `import-redfin-tsv-files.ts` | Redfin Data Center | `redfin_rental_*` |

### Data Freshness Timeline

```
Monthly Timeline:
├─ 15th: Realtor.com import → triggers post-import refresh
├─ 18th: Zillow import → triggers post-import refresh
├─ 20th: Economic data import → triggers post-import refresh
├─ 22nd: Building permits import → triggers post-import refresh
├─ 25th: Scheduled post-import refresh (backup/catchall)
├─ Variable: Redfin rental (manual import)
└─ Annual (Oct 15): HUD FMR import → triggers post-import refresh

Annual Timeline:
├─ October 15th: HUD FMR data (new fiscal year)
└─ December: Census ACS 5-year estimates (via economic import)
```

---

## Summary Statistics

| Category | Table Count | Metrics | GitHub Scheduled |
|----------|-------------|---------|------------------|
| Zillow | 5 | 20+ | ✅ |
| Realtor.com | 5 | 25+ | ✅ |
| Redfin Rental | 6 | 6 | ❌ |
| Census | 6 | 15+ | ✅ |
| Economic | 4 | 10+ | ✅ |
| Building Permits | 3 | 15+ | ✅ |
| HUD FMR | 1 | 5 | ✅ (annual) |
| Calculated Metrics | 1 | 30+ | ✅ (auto-triggered) |
| PropertyIQ Scores | 5 | 17 | ✅ (auto-triggered) |
| Geographic Reference | 3 | N/A | N/A |
| **TOTAL** | **39** | **140+** | 6 workflows |

---

*Last updated: January 2026*
