# Data Table & Card Mapping Implementation Plan

## Executive Summary

This plan provides a comprehensive mapping of Zillow and Realtor data tables to the PropertyIQ card system, along with implementation strategies for calculated metrics. The goal is to ensure each card displays the most appropriate and accurate data source.

---

## Part 1: Data Tables Inventory

### 1.1 Zillow Tables (Long-Format Schema)

The primary Zillow data is stored in geography-specific long-format tables:

| Table | Geographic Level | Key Fields |
|-------|-----------------|------------|
| `zillow_state` | State | region_id, period_date, metric_name, value |
| `zillow_metro` | Metro (CBSA) | region_id, period_date, metric_name, value |
| `zillow_county` | County (FIPS) | region_id, period_date, metric_name, value |
| `zillow_zip` | ZIP Code | region_id, period_date, metric_name, value |
| `zillow_city` | City | region_id, period_date, metric_name, value |

**Available Metrics in Long-Format Tables:**

| metric_name | Description | Unit |
|-------------|-------------|------|
| `zhvi` | Zillow Home Value Index | USD |
| `zhvi_yoy` | Home Value Year-over-Year Change | % |
| `zori` | Zillow Observed Rent Index | USD/month |
| `zori_yoy` | Rent Year-over-Year Change | % |
| `inventory` | For-Sale Inventory Count | Count |
| `inventory_yoy` | Inventory Year-over-Year Change | % |
| `dom` | Days on Market | Days |
| `sale_price` | Median Sale Price | USD |
| `list_price` | Median List Price | USD |
| `new_listings` | New Listings Count | Count |
| `pending_sales` | Pending Listings Count | Count |
| `sale_to_list` | Sale-to-List Ratio | Ratio (0-1+) |
| `price_cuts` | Share of Listings with Price Cut | % |

### 1.2 Zillow Specialty Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `zillow_zhvf` | Home Value Forecasts | region_id, date, forecast_1m, forecast_3m, forecast_12m, geography |
| `zillow_zordi` | Renter Demand Index | region_id, date, value (0-200+ scale), property_type |
| `zillow_affordability` | Affordability Metrics | homeowner_income_needed, renter_income_needed, affordable_home_price, years_to_save, homeowner_affordability_percent, renter_affordability_percent |
| `zillow_new_construction_sales_count` | New Construction Volume | sales_count |
| `zillow_new_construction_sale_price` | New Construction Pricing | median_price, mean_price, price_per_sqft |
| `zillow_metro_crosswalk` | Zillow-to-CBSA Mapping | zillow_region_id, cbsa_code, cbsa_title |

### 1.3 Realtor Tables

All Realtor tables share a common schema with geography-specific identifiers:

| Table | Geographic Key | Unique Features |
|-------|---------------|-----------------|
| `realtor_national` | country | US aggregate |
| `realtor_state` | state_id (2-letter) | State-level with _mm/_yy |
| `realtor_metro` | cbsa_code | Hotness scores, supply/demand |
| `realtor_county` | county_fips | Full hotness metrics |
| `realtor_zip` | postal_code | ZIP-level with all metrics |

**Common Realtor Columns (all tables):**

| Column | Description |
|--------|-------------|
| `median_listing_price` | Median active listing price |
| `median_listing_price_mm` | Month-over-month change |
| `median_listing_price_yy` | Year-over-year change |
| `active_listing_count` | Current active listings |
| `new_listing_count` | New listings this period |
| `median_days_on_market` | Median DOM |
| `pending_listing_count` | Pending sales count |
| `price_reduced_count` | Listings with price reduction |
| `price_reduced_share` | % of listings with price cut |
| `median_listing_price_per_square_foot` | Price per sqft |
| `pending_ratio` | Pending / Active ratio |

**Metro/County/ZIP Exclusive Columns:**

| Column | Description |
|--------|-------------|
| `hotness_rank` | Market heat ranking (1 = hottest) |
| `hotness_score` | Composite heat score |
| `supply_score` | Supply-side score |
| `demand_score` | Demand-side score |
| `median_dom_vs_us` | DOM relative to national |
| `median_listing_price_vs_us` | Price relative to national |

---

## Part 2: Card Inventory

### 2.1 Homebuyer/Renter Popular Metrics

| Card ID | Display Name | User Segment |
|---------|-------------|--------------|
| `home_value` | Home Value | Homebuyer |
| `home_value_yoy` | Home Value Growth (YoY) | Homebuyer |
| `home_price_forecast` | Home Price Forecast | Homebuyer (Premium) |
| `for_sale_inventory` | For Sale Inventory | Homebuyer |
| `days_on_market` | Days on Market | Homebuyer |
| `overvalued_pct` | Overvalued % | Homebuyer (Premium) |

### 2.2 Investor Popular Metrics

| Card ID | Display Name | User Segment |
|---------|-------------|--------------|
| `cap_rate` | Cap Rate | Investor |
| `rent_index` | Rent Index | Investor |
| `rent_for_houses` | Renter Demand Index | Investor |
| `home_value_yoy` | Home Value Growth (YoY) | Investor |
| `vacancy_rate` | Vacancy Rate | Investor (Premium) |
| `long_term_growth` | Long-Term Growth Score | Investor (Premium) |

### 2.3 Home Price & Affordability Category

| Card ID | Display Name | Status |
|---------|-------------|--------|
| `home_value` | Home Value | Active |
| `home_value_yoy` | Home Value Growth (YoY) | Active |
| `home_value_5yr` | Home Value Growth (5-Year) | Premium |
| `home_value_mom` | Home Value Growth (MoM) | Premium |
| `overvalued_pct` | Overvalued % | Premium |
| `sfh_value` | Single Family Value | Premium |
| `sfh_value_yoy` | Single Family Value Growth (YoY) | Premium |
| `condo_value` | Condo Value | Premium |
| `condo_value_yoy` | Condo Value Growth (YoY) | Premium |
| `income_to_buy` | Income Needed to Buy | New |
| `affordable_home_price` | Affordable Home Price | New |
| `years_to_save` | Years to Save (Down Payment) | Premium, New |
| `homeowner_affordability` | Homeowner Affordability % | Premium, New |

### 2.4 Market Trends - Supply

| Card ID | Display Name | Status |
|---------|-------------|--------|
| `for_sale_inventory` | For Sale Inventory | Active |
| `inventory_yoy` | Inventory Growth (YoY) | Active |
| `inventory_surplus` | Inventory Surplus/Deficit | Premium |
| `new_listings` | New Listings | Premium |
| `pending_listings` | Pending Listings | Premium |

### 2.5 Market Trends - Velocity

| Card ID | Display Name | Status |
|---------|-------------|--------|
| `days_on_market` | Days on Market | Active |
| `days_to_close` | Days to Close | New |
| `home_sales` | Home Sales | Premium |
| `sales_yoy` | Sales Growth (YoY) | Premium |
| `sale_to_list` | Sale-to-List Ratio | Premium |

### 2.6 Market Trends - Pricing Dynamics

| Card ID | Display Name | Status |
|---------|-------------|--------|
| `price_cut_pct` | Price Cut % | Premium |
| `price_cut_amount` | Median Price Cut ($) | Premium, New |
| `list_price` | Median List Price | Premium |
| `sale_price` | Median Sale Price | Premium |
| `price_per_sqft` | Price per Sq Ft | Premium |

### 2.7 Market Trends - New Construction

| Card ID | Display Name | Status |
|---------|-------------|--------|
| `new_construction_sales` | New Construction Sales | New |
| `new_construction_price` | New Construction Price | New |
| `new_construction_ppsf` | New Construction $/Sq Ft | Premium, New |

### 2.8 Investor Metrics Category

| Card ID | Display Name | Status |
|---------|-------------|--------|
| `rent_index` | Rent Index | Active |
| `rent_for_houses` | Renter Demand Index | Active |
| `cap_rate` | Cap Rate | Premium |
| `gross_yield` | Gross Yield | Premium |
| `vacancy_rate` | Vacancy Rate | Premium |
| `rent_growth` | Rent Growth (YoY) | Premium |
| `rent_to_price` | Rent-to-Price Ratio | Premium |
| `income_to_rent` | Income Needed to Rent | New |
| `renter_affordability` | Renter Affordability % | Premium, New |

### 2.9 PropertyIQ Scores (Premium)

| Card ID | Display Name | Status |
|---------|-------------|--------|
| `home_price_forecast` | Home Price Forecast | Premium |
| `long_term_growth` | Long-Term Growth Score | Premium, New |
| `market_health` | Market Health Score | Premium, New |
| `investment_score` | Investment Score | Premium, New |

---

## Part 3: Card-to-Data Mapping

### 3.1 Home Price & Affordability Mappings

| Card ID | Primary Source | Column/Metric | Fallback Source | Notes |
|---------|---------------|---------------|-----------------|-------|
| `home_value` | `zillow_[geo]` | `metric_name='zhvi'` | `realtor_[geo].median_listing_price` | ZHVI is gold standard |
| `home_value_yoy` | `zillow_[geo]` | `metric_name='zhvi_yoy'` | Calculate from ZHVI series | Pre-calculated preferred |
| `home_value_5yr` | `zillow_[geo]` | `metric_name='zhvi'` | - | **Calculated**: 60-month CAGR |
| `home_value_mom` | `zillow_[geo]` | `metric_name='zhvi'` | - | **Calculated**: 1-month delta |
| `overvalued_pct` | **Calculated** | ZHVI / median_income | - | Requires Census income |
| `sfh_value` | `zillow_[geo]` | `zhvi` + `property_type='SFR'` | - | Requires SFR data import |
| `sfh_value_yoy` | `zillow_[geo]` | SFR ZHVI YoY | - | Derived from SFR ZHVI |
| `condo_value` | `zillow_[geo]` | `zhvi` + `property_type='condo'` | - | Requires condo data import |
| `condo_value_yoy` | `zillow_[geo]` | Condo ZHVI YoY | - | Derived from condo ZHVI |
| `income_to_buy` | `zillow_affordability` | `homeowner_income_needed` | **Calculated** | See formula below |
| `affordable_home_price` | `zillow_affordability` | `affordable_home_price` | **Calculated** | Based on median income |
| `years_to_save` | `zillow_affordability` | `years_to_save` | **Calculated** | 20% down payment |
| `homeowner_affordability` | `zillow_affordability` | `homeowner_affordability_percent` | - | % who can afford |

### 3.2 Market Trends - Supply Mappings

| Card ID | Primary Source | Column/Metric | Fallback Source | Notes |
|---------|---------------|---------------|-----------------|-------|
| `for_sale_inventory` | `realtor_[geo]` | `active_listing_count` | `zillow_[geo]` → `inventory` | Realtor more current |
| `inventory_yoy` | `realtor_[geo]` | `active_listing_count_yy` | `zillow_[geo]` → `inventory_yoy` | Pre-calculated |
| `inventory_surplus` | **Calculated** | Current vs 5-year avg | - | Historical comparison |
| `new_listings` | `realtor_[geo]` | `new_listing_count` | `zillow_[geo]` → `new_listings` | Either source works |
| `pending_listings` | `realtor_[geo]` | `pending_listing_count` | `zillow_[geo]` → `pending_sales` | Either source works |

### 3.3 Market Trends - Velocity Mappings

| Card ID | Primary Source | Column/Metric | Fallback Source | Notes |
|---------|---------------|---------------|-----------------|-------|
| `days_on_market` | `realtor_[geo]` | `median_days_on_market` | `zillow_[geo]` → `dom` | Realtor preferred |
| `days_to_close` | `zillow_[geo]` | `metric_name='dom'` (close variant) | - | Pending to close time |
| `home_sales` | `zillow_[geo]` | Sales count metric | - | Need to import |
| `sales_yoy` | **Calculated** | Sales count YoY | - | From time series |
| `sale_to_list` | `zillow_[geo]` | `metric_name='sale_to_list'` | - | Ratio (typically 0.95-1.05) |

### 3.4 Market Trends - Pricing Dynamics Mappings

| Card ID | Primary Source | Column/Metric | Fallback Source | Notes |
|---------|---------------|---------------|-----------------|-------|
| `price_cut_pct` | `realtor_[geo]` | `price_reduced_share` | `zillow_[geo]` → `price_cuts` | % with reduction |
| `price_cut_amount` | `zillow_price_cut_amt` | `value` | - | Dollar amount |
| `list_price` | `realtor_[geo]` | `median_listing_price` | `zillow_[geo]` → `list_price` | Active listings |
| `sale_price` | `zillow_[geo]` | `metric_name='sale_price'` | - | Closed transactions |
| `price_per_sqft` | `realtor_[geo]` | `median_listing_price_per_square_foot` | - | Listing price/sqft |

### 3.5 Market Trends - New Construction Mappings

| Card ID | Primary Source | Column/Metric | Fallback Source | Notes |
|---------|---------------|---------------|-----------------|-------|
| `new_construction_sales` | `zillow_new_construction_sales_count` | `sales_count` | - | Zillow exclusive |
| `new_construction_price` | `zillow_new_construction_sale_price` | `median_price` | - | Zillow exclusive |
| `new_construction_ppsf` | `zillow_new_construction_sale_price` | `price_per_sqft` | - | Zillow exclusive |

### 3.6 Investor Metrics Mappings

| Card ID | Primary Source | Column/Metric | Fallback Source | Notes |
|---------|---------------|---------------|-----------------|-------|
| `rent_index` | `zillow_[geo]` | `metric_name='zori'` | - | ZORI is standard |
| `rent_for_houses` | `zillow_zordi` | `value` | - | 0-200+ index scale |
| `cap_rate` | **Calculated** | `(ZORI × 12 × 0.6) / ZHVI` | - | NOI / Price |
| `gross_yield` | **Calculated** | `(ZORI × 12) / ZHVI × 100` | - | Annual rent / Price |
| `vacancy_rate` | **Census ACS** | `B25002_003E / B25002_001E` | - | Not in Zillow/Realtor |
| `rent_growth` | `zillow_[geo]` | `metric_name='zori_yoy'` | - | YoY rent change |
| `rent_to_price` | **Calculated** | `ZORI / ZHVI` | - | Monthly ratio |
| `income_to_rent` | `zillow_affordability` | `renter_income_needed` | **Calculated** | 30% income rule |
| `renter_affordability` | `zillow_affordability` | `renter_affordability_percent` | - | % who can afford |

### 3.7 PropertyIQ Scores Mappings

| Card ID | Primary Source | Column/Metric | Calculation Method |
|---------|---------------|---------------|-------------------|
| `home_price_forecast` | `zillow_zhvf` | `forecast_1m`, `forecast_3m`, `forecast_12m` | Direct from Zillow |
| `long_term_growth` | **Calculated** | Composite score | Population growth + income growth + ZHVI trends |
| `market_health` | **Calculated** | Composite score | DOM + inventory + sale-to-list + price cuts |
| `investment_score` | **Calculated** | Composite score | Cap rate + rent growth + vacancy + appreciation |

---

## Part 4: Calculated Metrics Implementation

### 4.1 New Database Table

Create `calculated_metrics` table to store pre-computed values:

```sql
-- Migration: 043-create-calculated-metrics.sql

BEGIN;

CREATE TABLE calculated_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id INTEGER NOT NULL,
  geography_type VARCHAR(20) NOT NULL,
  period_date DATE NOT NULL,

  -- Investment Metrics
  cap_rate DECIMAL(10, 4),
  gross_yield DECIMAL(10, 4),
  rent_to_price_ratio DECIMAL(10, 6),
  grm DECIMAL(10, 2),

  -- Affordability Metrics
  income_to_buy DECIMAL(12, 2),
  income_to_rent DECIMAL(12, 2),
  years_to_save DECIMAL(6, 2),
  overvalued_pct DECIMAL(8, 4),
  homeowner_affordability_pct DECIMAL(6, 2),
  renter_affordability_pct DECIMAL(6, 2),

  -- Market Health Metrics
  months_of_supply DECIMAL(6, 2),
  inventory_surplus_pct DECIMAL(8, 4),
  absorption_rate DECIMAL(8, 4),

  -- Growth Metrics
  home_value_5yr_cagr DECIMAL(8, 4),
  home_value_mom DECIMAL(8, 4),
  rent_5yr_cagr DECIMAL(8, 4),

  -- Composite Scores (0-100)
  market_health_score DECIMAL(5, 2),
  investment_score DECIMAL(5, 2),
  long_term_growth_score DECIMAL(5, 2),

  -- Metadata
  calculation_version VARCHAR(20) DEFAULT '1.0.0',
  inputs_used JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(region_id, geography_type, period_date)
);

CREATE INDEX idx_calc_metrics_geo_date ON calculated_metrics(geography_type, period_date DESC);
CREATE INDEX idx_calc_metrics_region ON calculated_metrics(region_id, geography_type);

ALTER TABLE calculated_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read calculated_metrics" ON calculated_metrics FOR SELECT USING (true);
GRANT SELECT ON calculated_metrics TO authenticated, anon;
GRANT ALL ON calculated_metrics TO service_role;

COMMIT;
```

### 4.2 Calculation Formulas

#### Investment Metrics

| Metric | Formula | Parameters |
|--------|---------|------------|
| **Cap Rate** | `(ZORI × 12 × (1 - expense_ratio)) / ZHVI × 100` | expense_ratio = 0.40 |
| **Gross Yield** | `(ZORI × 12) / ZHVI × 100` | - |
| **Rent-to-Price** | `ZORI / ZHVI` | Monthly ratio |
| **GRM** | `ZHVI / (ZORI × 12)` | Gross Rent Multiplier |

#### Affordability Metrics

| Metric | Formula | Parameters |
|--------|---------|------------|
| **Income to Buy** | `monthly_payment / 0.28 × 12` | 28% DTI rule |
| **Monthly Payment** | `P&I + taxes + insurance` | See detailed formula |
| **Income to Rent** | `(ZORI / 0.30) × 12` | 30% income rule |
| **Years to Save** | `(ZHVI × down_pct) / (income × savings_rate)` | down_pct=0.20, savings_rate=0.10 |
| **Overvalued %** | `((ZHVI / median_income) - historical_ratio) / historical_ratio × 100` | historical_ratio=3.5 |

#### Market Health Metrics

| Metric | Formula | Parameters |
|--------|---------|------------|
| **Months of Supply** | `inventory / monthly_sales` | - |
| **Inventory Surplus** | `(current - avg_5yr) / avg_5yr × 100` | Historical comparison |
| **Absorption Rate** | `monthly_sales / inventory × 100` | Inverse of months supply |

#### Growth Metrics

| Metric | Formula | Parameters |
|--------|---------|------------|
| **5-Year CAGR** | `(current / value_5yr_ago)^(1/5) - 1) × 100` | Compound annual growth |
| **MoM Change** | `(current - previous) / previous × 100` | 1-month delta |

#### Composite Scores

**Market Health Score (0-100):**
```
Components (equal weight):
- DOM Score: 100 - ((dom - 30) / 60 × 100), clamped 0-100
- Sale-to-List Score: (sale_to_list - 0.9) / 0.1 × 100, clamped 0-100
- Price Cut Score: 100 - (price_cut_share / 0.4 × 100), clamped 0-100

Final = average of available components
```

**Investment Score (0-100):**
```
Components (weighted):
- Cap Rate (35%): (cap_rate - 2) / 6 × 100
- Rent Growth (25%): (rent_yoy + 5) / 15 × 100
- Vacancy (20%): 100 - (vacancy - 2) / 10 × 100
- Appreciation (20%): (zhvi_yoy + 5) / 20 × 100

Final = weighted average, normalized
```

**Long-Term Growth Score (0-100):**
```
Components (weighted):
- Recent Appreciation (30%): (zhvi_yoy + 10) / 25 × 100
- 5-Year CAGR (40%): (cagr_5yr + 5) / 15 × 100
- Population Growth (30%): (pop_growth + 2) / 5 × 100

Final = weighted average, normalized
```

### 4.3 Service Implementation

Create new service at `packages/backend/src/metrics/`:

```
packages/backend/src/metrics/
├── metrics.module.ts
├── calculated-metrics.service.ts    # Formula implementations
├── batch-calculator.service.ts      # Batch processing
├── metrics.controller.ts            # API endpoints
└── metrics.types.ts                 # Type definitions
```

**Key Methods:**

```typescript
// calculated-metrics.service.ts
class CalculatedMetricsService {
  calculateCapRate(zhvi: number, zori: number, expenseRatio?: number): number | null
  calculateGrossYield(zhvi: number, zori: number): number | null
  calculateRentToPriceRatio(zhvi: number, zori: number): number | null
  calculateIncomeNeededToBuy(zhvi: number, mortgageRate?: number): number | null
  calculateIncomeNeededToRent(zori: number): number | null
  calculateYearsToSave(zhvi: number, medianIncome: number): number | null
  calculateOvervaluedPct(zhvi: number, medianIncome: number): number | null
  calculateMonthsOfSupply(inventory: number, monthlySales: number): number | null
  calculateInventorySurplus(current: number, historicalAvg: number): number | null
  calculate5YearCagr(current: number, fiveYearsAgo: number): number | null
}

// batch-calculator.service.ts
class BatchCalculatorService {
  calculateForGeography(geoType: string, periodDate: string): Promise<Result>
  calculateForRegion(regionId: number, geoType: string, periodDate: string): Promise<void>
}
```

### 4.4 Database View for Simple Calculations

For real-time simple calculations without storage:

```sql
CREATE OR REPLACE VIEW v_investment_metrics AS
WITH pivoted AS (
  SELECT
    region_id,
    period_date,
    MAX(CASE WHEN metric_name = 'zhvi' THEN value END) as zhvi,
    MAX(CASE WHEN metric_name = 'zori' THEN value END) as zori
  FROM zillow_metro
  GROUP BY region_id, period_date
)
SELECT
  region_id,
  period_date,
  zhvi,
  zori,
  CASE WHEN zhvi > 0 AND zori > 0
    THEN ((zori * 12 * 0.6) / zhvi) * 100
  END as cap_rate,
  CASE WHEN zhvi > 0 AND zori > 0
    THEN ((zori * 12) / zhvi) * 100
  END as gross_yield,
  CASE WHEN zhvi > 0
    THEN zori / zhvi
  END as rent_to_price_ratio
FROM pivoted
WHERE zhvi IS NOT NULL;
```

### 4.5 Execution Schedule

```typescript
// Cron job: Run monthly after data imports
@Cron('0 6 1 * *') // 6 AM on 1st of each month
async runMonthlyCalculations() {
  for (const geoType of ['state', 'metro', 'county', 'zip']) {
    await this.batchCalculator.calculateForGeography(geoType, latestDate);
  }
}
```

---

## Part 5: Data Source Selection Guide

### 5.1 When to Use Zillow

| Use Case | Reason |
|----------|--------|
| Home values (ZHVI) | Gold standard for valuation |
| Rent values (ZORI) | Comprehensive rent tracking |
| Forecasts (ZHVF) | Only source for predictions |
| Renter demand (ZORDI) | Unique demand indicator |
| Sale prices | Actual transaction data |
| New construction | Exclusive metrics |
| Historical analysis | Deep time series |

### 5.2 When to Use Realtor

| Use Case | Reason |
|----------|--------|
| Active inventory | More current listing counts |
| Days on market | Comprehensive DOM coverage |
| Price reductions | Detailed with _mm/_yy changes |
| Listing prices | Current asking prices |
| Market hotness | Unique scores (metro level) |
| Supply/demand scores | Realtor exclusive |

### 5.3 When to Use Census

| Use Case | Data Source |
|----------|-------------|
| Vacancy rate | ACS B25002 |
| Median income | ACS B19013 |
| Population | ACS B01003 |
| Homeownership rate | ACS B25003 |

---

## Part 6: Implementation Checklist

### Phase 1: Database Setup
- [ ] Create migration 043 for `calculated_metrics` table
- [ ] Create database view `v_investment_metrics`
- [ ] Run migration in dev environment
- [ ] Verify table and view creation

### Phase 2: Backend Services
- [ ] Create `metrics.module.ts`
- [ ] Implement `CalculatedMetricsService` with all formulas
- [ ] Implement `BatchCalculatorService` for batch processing
- [ ] Add unit tests for calculation formulas
- [ ] Create `metrics.controller.ts` with API endpoints

### Phase 3: Data Integration
- [ ] Verify Census data access for income/vacancy
- [ ] Implement Census-to-Zillow geography crosswalk
- [ ] Test historical data queries for CAGR calculations
- [ ] Validate formula outputs against known values

### Phase 4: Batch Processing
- [ ] Implement cron job for monthly calculations
- [ ] Add logging and error handling
- [ ] Test batch processing on subset of data
- [ ] Run full batch calculation

### Phase 5: Frontend Integration
- [ ] Update metric API calls to use new endpoints
- [ ] Add fallback logic for missing calculated values
- [ ] Update card components to display new metrics
- [ ] Test all cards with real data

### Phase 6: Monitoring & Validation
- [ ] Add calculation audit logging
- [ ] Create data quality checks
- [ ] Set up alerts for calculation failures
- [ ] Document calculation methodology

---

## Part 7: API Endpoint Design

### New Endpoints

```
GET /api/metrics/calculated/:geoType/:regionId
  → Returns all calculated metrics for a region

GET /api/metrics/calculated/:geoType/:regionId/:metric
  → Returns specific calculated metric

GET /api/metrics/scores/:geoType/:regionId
  → Returns composite scores (market_health, investment, long_term_growth)

POST /api/metrics/calculate/:geoType
  → Triggers batch calculation for geography type (admin only)
```

### Response Format

```typescript
interface CalculatedMetricsResponse {
  regionId: number;
  geographyType: string;
  periodDate: string;
  metrics: {
    cap_rate: number | null;
    gross_yield: number | null;
    rent_to_price_ratio: number | null;
    income_to_buy: number | null;
    income_to_rent: number | null;
    years_to_save: number | null;
    overvalued_pct: number | null;
    months_of_supply: number | null;
    inventory_surplus_pct: number | null;
    home_value_5yr_cagr: number | null;
    market_health_score: number | null;
    investment_score: number | null;
    long_term_growth_score: number | null;
  };
  metadata: {
    calculatedAt: string;
    version: string;
    inputsAvailable: string[];
  };
}
```

---

## Appendix A: Complete Card-to-Source Quick Reference

| Card ID | Source Type | Table/View | Column |
|---------|-------------|------------|--------|
| `home_value` | Direct | `zillow_[geo]` | `zhvi` |
| `home_value_yoy` | Direct | `zillow_[geo]` | `zhvi_yoy` |
| `home_value_5yr` | Calculated | `calculated_metrics` | `home_value_5yr_cagr` |
| `home_value_mom` | Calculated | `calculated_metrics` | `home_value_mom` |
| `overvalued_pct` | Calculated | `calculated_metrics` | `overvalued_pct` |
| `sfh_value` | Direct | `zillow_[geo]` | `zhvi` (SFR filter) |
| `condo_value` | Direct | `zillow_[geo]` | `zhvi` (condo filter) |
| `income_to_buy` | Calculated | `calculated_metrics` | `income_to_buy` |
| `affordable_home_price` | Direct | `zillow_affordability` | `affordable_home_price` |
| `years_to_save` | Calculated | `calculated_metrics` | `years_to_save` |
| `homeowner_affordability` | Direct | `zillow_affordability` | `homeowner_affordability_percent` |
| `for_sale_inventory` | Direct | `realtor_[geo]` | `active_listing_count` |
| `inventory_yoy` | Direct | `realtor_[geo]` | `active_listing_count_yy` |
| `inventory_surplus` | Calculated | `calculated_metrics` | `inventory_surplus_pct` |
| `new_listings` | Direct | `realtor_[geo]` | `new_listing_count` |
| `pending_listings` | Direct | `realtor_[geo]` | `pending_listing_count` |
| `days_on_market` | Direct | `realtor_[geo]` | `median_days_on_market` |
| `days_to_close` | Direct | `zillow_[geo]` | `dom` |
| `home_sales` | Direct | `zillow_[geo]` | sales count |
| `sales_yoy` | Calculated | Time series | YoY delta |
| `sale_to_list` | Direct | `zillow_[geo]` | `sale_to_list` |
| `price_cut_pct` | Direct | `realtor_[geo]` | `price_reduced_share` |
| `price_cut_amount` | Direct | `zillow_price_cut_amt` | `value` |
| `list_price` | Direct | `realtor_[geo]` | `median_listing_price` |
| `sale_price` | Direct | `zillow_[geo]` | `sale_price` |
| `price_per_sqft` | Direct | `realtor_[geo]` | `median_listing_price_per_square_foot` |
| `new_construction_sales` | Direct | `zillow_new_construction_sales_count` | `sales_count` |
| `new_construction_price` | Direct | `zillow_new_construction_sale_price` | `median_price` |
| `new_construction_ppsf` | Direct | `zillow_new_construction_sale_price` | `price_per_sqft` |
| `rent_index` | Direct | `zillow_[geo]` | `zori` |
| `rent_for_houses` | Direct | `zillow_zordi` | `value` |
| `cap_rate` | Calculated | `calculated_metrics` | `cap_rate` |
| `gross_yield` | Calculated | `calculated_metrics` | `gross_yield` |
| `vacancy_rate` | External | Census ACS | `B25002` |
| `rent_growth` | Direct | `zillow_[geo]` | `zori_yoy` |
| `rent_to_price` | Calculated | `calculated_metrics` | `rent_to_price_ratio` |
| `income_to_rent` | Calculated | `calculated_metrics` | `income_to_rent` |
| `renter_affordability` | Direct | `zillow_affordability` | `renter_affordability_percent` |
| `home_price_forecast` | Direct | `zillow_zhvf` | `forecast_*` |
| `long_term_growth` | Calculated | `calculated_metrics` | `long_term_growth_score` |
| `market_health` | Calculated | `calculated_metrics` | `market_health_score` |
| `investment_score` | Calculated | `calculated_metrics` | `investment_score` |
