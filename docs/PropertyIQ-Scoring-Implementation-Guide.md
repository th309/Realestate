# PropertyIQ Scoring System Implementation Guide

## Overview

This document provides complete implementation instructions for rebuilding the PropertyIQ scoring system with three scores: **HomeReady** (homebuyers), **InvestorEdge** (investors), and **Market Health Index** (market conditions).

**Key Design Principle:** All scores must work at every geographic level (National, State, Metro, County, City, ZIP). Where data is unavailable at granular levels, inherit from parent geography.

---

## Part 1: Database Schema Updates

### 1.1 Create Geography Inheritance Lookup

This table maps each geography to its parent for data inheritance.

```sql
CREATE TABLE IF NOT EXISTS geography_inheritance (
  geography_id VARCHAR(20) PRIMARY KEY,
  geography_type VARCHAR(10) NOT NULL, -- 'zip', 'city', 'county', 'metro', 'state', 'national'
  zip_code VARCHAR(5),
  city_place_fips VARCHAR(7),
  county_fips VARCHAR(5),
  metro_cbsa VARCHAR(5),
  state_fips VARCHAR(2),
  
  -- Inheritance chain (for quick lookups)
  parent_county_fips VARCHAR(5),
  parent_metro_cbsa VARCHAR(5),
  parent_state_fips VARCHAR(2)
);

-- Index for fast inheritance lookups
CREATE INDEX idx_geo_inheritance_zip ON geography_inheritance(zip_code);
CREATE INDEX idx_geo_inheritance_county ON geography_inheritance(county_fips);
CREATE INDEX idx_geo_inheritance_metro ON geography_inheritance(metro_cbsa);
```

### 1.2 Update PropertyIQ Scores Table

```sql
-- Drop and recreate with new component structure
DROP TABLE IF EXISTS propertyiq_scores CASCADE;

CREATE TABLE propertyiq_scores (
  id SERIAL PRIMARY KEY,
  geography_id VARCHAR(20) NOT NULL,
  geography_type VARCHAR(10) NOT NULL,
  period_date DATE NOT NULL,
  
  -- HomeReady Score (0-100)
  homeready_score DECIMAL(5,2),
  homeready_affordability DECIMAL(5,2),
  homeready_market_timing DECIMAL(5,2),
  homeready_stability DECIMAL(5,2),
  homeready_growth_potential DECIMAL(5,2),
  homeready_livability DECIMAL(5,2),
  homeready_trend VARCHAR(20), -- 'improving', 'stable', 'declining'
  
  -- InvestorEdge Score (0-100)
  investoredge_score DECIMAL(5,2),
  investoredge_cash_flow DECIMAL(5,2),
  investoredge_rent_demand DECIMAL(5,2),
  investoredge_appreciation DECIMAL(5,2),
  investoredge_entry_point DECIMAL(5,2),
  investoredge_risk DECIMAL(5,2),
  investoredge_trend VARCHAR(20),
  
  -- Market Health Index (0-100)
  market_health_score DECIMAL(5,2),
  market_health_demand_strength DECIMAL(5,2),
  market_health_supply_balance DECIMAL(5,2),
  market_health_price_stability DECIMAL(5,2),
  market_health_economic_foundation DECIMAL(5,2),
  market_health_trend VARCHAR(20),
  
  -- Metadata
  data_completeness DECIMAL(5,2), -- % of metrics available vs inherited
  inherited_metrics JSONB, -- list of metrics that were inherited
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(geography_id, period_date)
);

CREATE INDEX idx_scores_geo ON propertyiq_scores(geography_id);
CREATE INDEX idx_scores_type ON propertyiq_scores(geography_type);
CREATE INDEX idx_scores_date ON propertyiq_scores(period_date);
```

### 1.3 Create Score Component Details Table

```sql
CREATE TABLE propertyiq_score_details (
  id SERIAL PRIMARY KEY,
  geography_id VARCHAR(20) NOT NULL,
  period_date DATE NOT NULL,
  score_type VARCHAR(20) NOT NULL, -- 'homeready', 'investoredge', 'market_health'
  component_name VARCHAR(50) NOT NULL,
  
  -- Raw metric values used
  raw_metrics JSONB NOT NULL,
  
  -- Normalized values (0-100)
  normalized_value DECIMAL(5,2),
  
  -- Weight applied
  weight DECIMAL(4,3),
  
  -- Contribution to final score
  weighted_contribution DECIMAL(5,2),
  
  -- Data source tracking
  data_source VARCHAR(50), -- 'direct', 'inherited_county', 'inherited_metro', etc.
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(geography_id, period_date, score_type, component_name)
);
```

---

## Part 2: Data Inheritance Logic

### 2.1 Inheritance Priority Rules

When a metric is unavailable at the current geography level, inherit from parent in this order:

| Geography Level | Inheritance Chain |
|-----------------|-------------------|
| ZIP | ZIP → County → Metro → State → National |
| City | City → County → Metro → State → National |
| County | County → Metro → State → National |
| Metro | Metro → State → National |
| State | State → National |

### 2.2 Metrics Requiring Inheritance

These metrics are NOT available at all geographic levels and MUST be inherited:

| Metric | Available At | Inherit From |
|--------|--------------|--------------|
| `unemployment_rate` | National, State, Metro, County | County for ZIP/City |
| `employment_yoy` | National, State, Metro, County | County for ZIP/City |
| `gdp_yoy` | National, State, Metro | Metro for County, ZIP, City |
| `total_permits_yoy` | National, State, Metro, County | County for ZIP/City |
| `large_multi_permits_yoy` | National, State, Metro, County | County for ZIP/City |

### 2.3 Inheritance Function (PostgreSQL)

```sql
CREATE OR REPLACE FUNCTION get_metric_with_inheritance(
  p_geography_id VARCHAR(20),
  p_metric_name VARCHAR(50),
  p_period_date DATE
) RETURNS TABLE (
  value DECIMAL,
  source_geography VARCHAR(20),
  source_type VARCHAR(20)
) AS $$
DECLARE
  v_geo_type VARCHAR(10);
  v_county_fips VARCHAR(5);
  v_metro_cbsa VARCHAR(5);
  v_state_fips VARCHAR(2);
  v_value DECIMAL;
BEGIN
  -- Get geography inheritance chain
  SELECT 
    geography_type,
    parent_county_fips,
    parent_metro_cbsa,
    parent_state_fips
  INTO v_geo_type, v_county_fips, v_metro_cbsa, v_state_fips
  FROM geography_inheritance
  WHERE geography_id = p_geography_id;
  
  -- Try direct lookup first
  SELECT cm.value INTO v_value
  FROM calculated_metrics cm
  WHERE cm.geography_id = p_geography_id
    AND cm.metric_name = p_metric_name
    AND cm.period_date = p_period_date;
  
  IF v_value IS NOT NULL THEN
    RETURN QUERY SELECT v_value, p_geography_id, v_geo_type;
    RETURN;
  END IF;
  
  -- Try county inheritance
  IF v_county_fips IS NOT NULL THEN
    SELECT cm.value INTO v_value
    FROM calculated_metrics cm
    WHERE cm.geography_id = v_county_fips
      AND cm.metric_name = p_metric_name
      AND cm.period_date = p_period_date;
    
    IF v_value IS NOT NULL THEN
      RETURN QUERY SELECT v_value, v_county_fips, 'county'::VARCHAR(20);
      RETURN;
    END IF;
  END IF;
  
  -- Try metro inheritance
  IF v_metro_cbsa IS NOT NULL THEN
    SELECT cm.value INTO v_value
    FROM calculated_metrics cm
    WHERE cm.geography_id = v_metro_cbsa
      AND cm.metric_name = p_metric_name
      AND cm.period_date = p_period_date;
    
    IF v_value IS NOT NULL THEN
      RETURN QUERY SELECT v_value, v_metro_cbsa, 'metro'::VARCHAR(20);
      RETURN;
    END IF;
  END IF;
  
  -- Try state inheritance
  IF v_state_fips IS NOT NULL THEN
    SELECT cm.value INTO v_value
    FROM calculated_metrics cm
    WHERE cm.geography_id = v_state_fips
      AND cm.metric_name = p_metric_name
      AND cm.period_date = p_period_date;
    
    IF v_value IS NOT NULL THEN
      RETURN QUERY SELECT v_value, v_state_fips, 'state'::VARCHAR(20);
      RETURN;
    END IF;
  END IF;
  
  -- Try national fallback
  SELECT cm.value INTO v_value
  FROM calculated_metrics cm
  WHERE cm.geography_id = 'national'
    AND cm.metric_name = p_metric_name
    AND cm.period_date = p_period_date;
  
  IF v_value IS NOT NULL THEN
    RETURN QUERY SELECT v_value, 'national'::VARCHAR(20), 'national'::VARCHAR(20);
    RETURN;
  END IF;
  
  -- No data found
  RETURN QUERY SELECT NULL::DECIMAL, NULL::VARCHAR(20), NULL::VARCHAR(20);
END;
$$ LANGUAGE plpgsql;
```

---

## Part 3: Score Calculation Formulas

### 3.1 Normalization Functions

All raw metrics must be normalized to 0-100 scale before weighting.

```typescript
// Standard min-max normalization
function normalizeMinMax(value: number, min: number, max: number, invert: boolean = false): number {
  const clamped = Math.max(min, Math.min(max, value));
  const normalized = ((clamped - min) / (max - min)) * 100;
  return invert ? 100 - normalized : normalized;
}

// Percentile-based normalization (preferred for most metrics)
function normalizePercentile(value: number, percentiles: number[]): number {
  // percentiles is array of [p5, p25, p50, p75, p95] values
  const [p5, p25, p50, p75, p95] = percentiles;
  
  if (value <= p5) return 5;
  if (value <= p25) return 5 + ((value - p5) / (p25 - p5)) * 20;
  if (value <= p50) return 25 + ((value - p25) / (p50 - p25)) * 25;
  if (value <= p75) return 50 + ((value - p50) / (p75 - p50)) * 25;
  if (value <= p95) return 75 + ((value - p75) / (p95 - p75)) * 20;
  return 95;
}

// For metrics where moderate values are best (e.g., ZHVI YoY)
function normalizeOptimal(value: number, optimalMin: number, optimalMax: number, extremeMin: number, extremeMax: number): number {
  if (value >= optimalMin && value <= optimalMax) return 100;
  if (value < optimalMin) {
    return Math.max(0, 100 - ((optimalMin - value) / (optimalMin - extremeMin)) * 100);
  }
  return Math.max(0, 100 - ((value - optimalMax) / (extremeMax - optimalMax)) * 100);
}
```

---

### 3.2 HomeReady Score (For Homebuyers)

**Total Weight: 100%**

#### Component 1: Affordability (30%)

| Metric | Source | Normalization | Sub-Weight |
|--------|--------|---------------|------------|
| `income_gap_ratio` | Calculated: ZHVI / median_household_income | Invert, lower is better. Range: 2-10, target < 3.5 | 40% |
| `years_to_save` | Calculated | Invert, lower is better. Range: 2-15 years | 30% |
| `rent_as_pct_of_income` | Census | Invert, lower is better. Range: 15-50% | 30% |

```typescript
function calculateAffordability(metrics: Metrics): number {
  const incomeGapScore = normalizeMinMax(metrics.income_gap_ratio, 2, 10, true);
  const yearsToSaveScore = normalizeMinMax(metrics.years_to_save, 2, 15, true);
  const rentBurdenScore = normalizeMinMax(metrics.rent_as_pct_of_income, 15, 50, true);
  
  return (incomeGapScore * 0.4) + (yearsToSaveScore * 0.3) + (rentBurdenScore * 0.3);
}
```

#### Component 2: Market Timing (25%)

| Metric | Source | Normalization | Sub-Weight |
|--------|--------|---------------|------------|
| `price_reduced_share` | Realtor.com | Higher = better for buyers. Range: 0-40% | 30% |
| `median_days_on_market` | Realtor.com | Higher = better for buyers. Range: 10-120 days | 25% |
| `months_of_supply` | Calculated | Higher = better for buyers. Range: 1-12 months | 25% |
| `pending_listing_count_yy` | Realtor.com | Lower = less competition. Range: -50% to +50% | 20% |

```typescript
function calculateMarketTiming(metrics: Metrics): number {
  const priceCutScore = normalizeMinMax(metrics.price_reduced_share, 0, 40, false);
  const domScore = normalizeMinMax(metrics.median_days_on_market, 10, 120, false);
  const supplyScore = normalizeMinMax(metrics.months_of_supply, 1, 12, false);
  const pendingScore = normalizeMinMax(metrics.pending_listing_count_yy, -50, 50, true);
  
  return (priceCutScore * 0.3) + (domScore * 0.25) + (supplyScore * 0.25) + (pendingScore * 0.2);
}
```

#### Component 3: Stability (20%)

| Metric | Source | Normalization | Sub-Weight |
|--------|--------|---------------|------------|
| `volatility_36m` | Calculated: STDDEV(ZHVI) 36mo | Invert, lower is better. Range: 0-15% | 40% |
| `active_listing_count_yy` | Realtor.com | Moderate is best. Optimal: -10% to +10% | 35% |
| `unemployment_rate` | Economic (inherited) | Invert, lower is better. Range: 2-12% | 25% |

```typescript
function calculateStability(metrics: Metrics): number {
  const volatilityScore = normalizeMinMax(metrics.volatility_36m, 0, 15, true);
  const inventoryScore = normalizeOptimal(metrics.active_listing_count_yy, -10, 10, -50, 50);
  const unemploymentScore = normalizeMinMax(metrics.unemployment_rate, 2, 12, true);
  
  return (volatilityScore * 0.4) + (inventoryScore * 0.35) + (unemploymentScore * 0.25);
}
```

#### Component 4: Growth Potential (15%)

| Metric | Source | Normalization | Sub-Weight |
|--------|--------|---------------|------------|
| `zhvi_5y_cagr` | Calculated | Higher is better. Range: -5% to +15% | 40% |
| `population_yoy` | Census | Higher is better. Range: -2% to +5% | 30% |
| `median_household_income_yoy` | Census | Higher is better. Range: -5% to +10% | 30% |

```typescript
function calculateGrowthPotential(metrics: Metrics): number {
  const appreciationScore = normalizeMinMax(metrics.zhvi_5y_cagr, -5, 15, false);
  const populationScore = normalizeMinMax(metrics.population_yoy, -2, 5, false);
  const incomeGrowthScore = normalizeMinMax(metrics.median_household_income_yoy, -5, 10, false);
  
  return (appreciationScore * 0.4) + (populationScore * 0.3) + (incomeGrowthScore * 0.3);
}
```

#### Component 5: Livability (10%)

| Metric | Source | Normalization | Sub-Weight |
|--------|--------|---------------|------------|
| `homeownership_rate` | Census | Higher is better. Range: 30-85% | 60% |
| `median_age` | Census | Moderate is best. Optimal: 30-45 | 40% |

```typescript
function calculateLivability(metrics: Metrics): number {
  const homeownershipScore = normalizeMinMax(metrics.homeownership_rate, 30, 85, false);
  const ageScore = normalizeOptimal(metrics.median_age, 30, 45, 18, 65);
  
  return (homeownershipScore * 0.6) + (ageScore * 0.4);
}
```

#### Final HomeReady Score

```typescript
function calculateHomeReadyScore(metrics: Metrics): number {
  const affordability = calculateAffordability(metrics);
  const marketTiming = calculateMarketTiming(metrics);
  const stability = calculateStability(metrics);
  const growthPotential = calculateGrowthPotential(metrics);
  const livability = calculateLivability(metrics);
  
  return (
    affordability * 0.30 +
    marketTiming * 0.25 +
    stability * 0.20 +
    growthPotential * 0.15 +
    livability * 0.10
  );
}
```

---

### 3.3 InvestorEdge Score (For Investors)

**Total Weight: 100%**

#### Component 1: Cash Flow (35%)

| Metric | Source | Normalization | Sub-Weight |
|--------|--------|---------------|------------|
| `cap_rate` | Calculated (ZORI, fallback HUD FMR) | Higher is better. Range: 2-12% | 35% |
| `grm` | Calculated: ZHVI / (ZORI × 12) | Invert, lower is better. Range: 8-30 | 25% |
| `gross_yield` | Calculated: (ZORI × 12) / ZHVI × 100 | Higher is better. Range: 3-15% | 25% |
| `rent_to_price_ratio` | Calculated: ZORI / ZHVI | Higher is better. Target ≥ 0.007 (0.7%) | 15% |

```typescript
function calculateCashFlow(metrics: Metrics): number {
  // Use HUD FMR for cap rate if ZORI unavailable
  const rent = metrics.zori ?? metrics.hud_fmr_2br;
  const capRate = (rent * 12 * 0.60) / metrics.zhvi * 100;
  
  const capRateScore = normalizeMinMax(capRate, 2, 12, false);
  const grmScore = normalizeMinMax(metrics.grm, 8, 30, true);
  const grossYieldScore = normalizeMinMax(metrics.gross_yield, 3, 15, false);
  const rentToPriceScore = normalizeMinMax(metrics.rent_to_price_ratio, 0.003, 0.012, false);
  
  return (capRateScore * 0.35) + (grmScore * 0.25) + (grossYieldScore * 0.25) + (rentToPriceScore * 0.15);
}
```

#### Component 2: Rent Demand (20%)

| Metric | Source | Normalization | Sub-Weight |
|--------|--------|---------------|------------|
| `zori_yoy` | Zillow | Higher is better. Range: -10% to +15% | 35% |
| `pending_ratio` | Realtor.com | Higher is better. Range: 0.1-0.8 | 25% |
| `median_days_on_market` | Realtor.com | Invert, lower is better. Range: 10-120 | 20% |
| `renter_share` | Census: renter_units / total_units | Context-dependent. Range: 20-70% | 20% |

```typescript
function calculateRentDemand(metrics: Metrics): number {
  const rentGrowthScore = normalizeMinMax(metrics.zori_yoy, -10, 15, false);
  const pendingRatioScore = normalizeMinMax(metrics.pending_ratio, 0.1, 0.8, false);
  const domScore = normalizeMinMax(metrics.median_days_on_market, 10, 120, true);
  const renterShareScore = normalizeMinMax(metrics.renter_share, 20, 70, false);
  
  return (rentGrowthScore * 0.35) + (pendingRatioScore * 0.25) + (domScore * 0.2) + (renterShareScore * 0.2);
}
```

#### Component 3: Appreciation (20%)

| Metric | Source | Normalization | Sub-Weight |
|--------|--------|---------------|------------|
| `zhvi_5y_cagr` | Calculated | Higher is better. Range: -5% to +15% | 40% |
| `zhvi_yoy` | Calculated | Higher is better. Range: -15% to +20% | 30% |
| `population_yoy` | Census | Higher is better. Range: -2% to +5% | 30% |

```typescript
function calculateAppreciation(metrics: Metrics): number {
  const longTermScore = normalizeMinMax(metrics.zhvi_5y_cagr, -5, 15, false);
  const shortTermScore = normalizeMinMax(metrics.zhvi_yoy, -15, 20, false);
  const populationScore = normalizeMinMax(metrics.population_yoy, -2, 5, false);
  
  return (longTermScore * 0.4) + (shortTermScore * 0.3) + (populationScore * 0.3);
}
```

#### Component 4: Entry Point (15%)

| Metric | Source | Normalization | Sub-Weight |
|--------|--------|---------------|------------|
| `overvalued_pct` | Calculated | Invert, negative is better. Range: -30% to +50% | 40% |
| `price_reduced_share` | Realtor.com | Higher = better entry. Range: 0-40% | 35% |
| `months_of_supply` | Calculated | Higher = better entry. Range: 1-12 | 25% |

```typescript
function calculateEntryPoint(metrics: Metrics): number {
  const valuationScore = normalizeMinMax(metrics.overvalued_pct, -30, 50, true);
  const priceCutScore = normalizeMinMax(metrics.price_reduced_share, 0, 40, false);
  const supplyScore = normalizeMinMax(metrics.months_of_supply, 1, 12, false);
  
  return (valuationScore * 0.4) + (priceCutScore * 0.35) + (supplyScore * 0.25);
}
```

#### Component 5: Risk (10%)

| Metric | Source | Normalization | Sub-Weight |
|--------|--------|---------------|------------|
| `volatility_36m` | Calculated | Invert, lower is better. Range: 0-15% | 35% |
| `unemployment_rate` | Economic (inherited) | Invert, lower is better. Range: 2-12% | 30% |
| `inventory_surplus_pct` | Calculated | Invert, lower is better. Range: -30% to +50% | 20% |
| `large_multi_permits_yoy` | Permits (inherited) | Invert, high = more competition. Range: -50% to +100% | 15% |

```typescript
function calculateRisk(metrics: Metrics): number {
  const volatilityScore = normalizeMinMax(metrics.volatility_36m, 0, 15, true);
  const unemploymentScore = normalizeMinMax(metrics.unemployment_rate, 2, 12, true);
  const surplusScore = normalizeMinMax(metrics.inventory_surplus_pct, -30, 50, true);
  const permitsScore = normalizeMinMax(metrics.large_multi_permits_yoy, -50, 100, true);
  
  return (volatilityScore * 0.35) + (unemploymentScore * 0.3) + (surplusScore * 0.2) + (permitsScore * 0.15);
}
```

#### Final InvestorEdge Score

```typescript
function calculateInvestorEdgeScore(metrics: Metrics): number {
  const cashFlow = calculateCashFlow(metrics);
  const rentDemand = calculateRentDemand(metrics);
  const appreciation = calculateAppreciation(metrics);
  const entryPoint = calculateEntryPoint(metrics);
  const risk = calculateRisk(metrics);
  
  return (
    cashFlow * 0.35 +
    rentDemand * 0.20 +
    appreciation * 0.20 +
    entryPoint * 0.15 +
    risk * 0.10
  );
}
```

---

### 3.4 Market Health Index

**Total Weight: 100%**

#### Component 1: Demand Strength (35%)

| Metric | Source | Normalization | Sub-Weight |
|--------|--------|---------------|------------|
| `pending_ratio` | Realtor.com | Higher is better. Range: 0.1-0.8 | 45% |
| `median_days_on_market` | Realtor.com | Invert, lower is better. Range: 10-120 | 35% |
| `hotness_score` | Realtor.com (if available) | Direct 0-100 scale | 20% |

```typescript
function calculateDemandStrength(metrics: Metrics): number {
  const pendingScore = normalizeMinMax(metrics.pending_ratio, 0.1, 0.8, false);
  const domScore = normalizeMinMax(metrics.median_days_on_market, 10, 120, true);
  
  // Hotness score is already 0-100, use directly if available
  const hotnessScore = metrics.hotness_score ?? 
    ((pendingScore + domScore) / 2); // Derive if missing
  
  return (pendingScore * 0.45) + (domScore * 0.35) + (hotnessScore * 0.2);
}
```

#### Component 2: Supply Balance (25%)

| Metric | Source | Normalization | Sub-Weight |
|--------|--------|---------------|------------|
| `months_of_supply` | Calculated | Optimal: 4-6 months (balanced market) | 40% |
| `active_listing_count_yy` | Realtor.com | Moderate is healthy. Optimal: -10% to +10% | 35% |
| `new_listing_count_yy` | Realtor.com | Moderate is healthy. Optimal: -10% to +15% | 25% |

```typescript
function calculateSupplyBalance(metrics: Metrics): number {
  // Optimal months of supply is 4-6 (balanced market)
  const supplyScore = normalizeOptimal(metrics.months_of_supply, 4, 6, 0, 12);
  const inventoryScore = normalizeOptimal(metrics.active_listing_count_yy, -10, 10, -50, 50);
  const newListingsScore = normalizeOptimal(metrics.new_listing_count_yy, -10, 15, -50, 50);
  
  return (supplyScore * 0.4) + (inventoryScore * 0.35) + (newListingsScore * 0.25);
}
```

#### Component 3: Price Stability (25%)

| Metric | Source | Normalization | Sub-Weight |
|--------|--------|---------------|------------|
| `price_reduced_share` | Realtor.com | Invert, lower is better. Range: 0-40% | 40% |
| `sale_to_list_ratio` | Zillow | Optimal near 1.0. Range: 0.85-1.10 | 35% |
| `zhvi_yoy` | Calculated | Moderate is healthy. Optimal: 2-6% | 25% |

```typescript
function calculatePriceStability(metrics: Metrics): number {
  const priceCutScore = normalizeMinMax(metrics.price_reduced_share, 0, 40, true);
  
  // Sale-to-list optimal near 1.0
  const saleToListScore = normalizeOptimal(metrics.sale_to_list_ratio, 0.97, 1.03, 0.85, 1.15);
  
  // Healthy appreciation is moderate (2-6%)
  const appreciationScore = normalizeOptimal(metrics.zhvi_yoy, 2, 6, -10, 20);
  
  return (priceCutScore * 0.4) + (saleToListScore * 0.35) + (appreciationScore * 0.25);
}
```

#### Component 4: Economic Foundation (15%)

| Metric | Source | Normalization | Sub-Weight |
|--------|--------|---------------|------------|
| `unemployment_rate` | Economic (inherited) | Invert, lower is better. Range: 2-12% | 50% |
| `employment_yoy` | Economic (inherited) | Higher is better. Range: -5% to +5% | 50% |

```typescript
function calculateEconomicFoundation(metrics: Metrics): number {
  const unemploymentScore = normalizeMinMax(metrics.unemployment_rate, 2, 12, true);
  const employmentGrowthScore = normalizeMinMax(metrics.employment_yoy, -5, 5, false);
  
  return (unemploymentScore * 0.5) + (employmentGrowthScore * 0.5);
}
```

#### Final Market Health Score

```typescript
function calculateMarketHealthScore(metrics: Metrics): number {
  const demandStrength = calculateDemandStrength(metrics);
  const supplyBalance = calculateSupplyBalance(metrics);
  const priceStability = calculatePriceStability(metrics);
  const economicFoundation = calculateEconomicFoundation(metrics);
  
  return (
    demandStrength * 0.35 +
    supplyBalance * 0.25 +
    priceStability * 0.25 +
    economicFoundation * 0.15
  );
}
```

---

## Part 4: Handling Missing Metrics

Scores must calculate gracefully when metrics are unavailable, even after inheritance attempts.

### 4.1 Missing Metric Strategy

| Strategy | When to Use | Implementation |
|----------|-------------|----------------|
| **Skip & Reweight** | Metric is optional, others in component are sufficient | Remove from calculation, redistribute weight to remaining metrics |
| **Neutral Value (50)** | Metric is important but missing would skew results | Use 50 (middle of 0-100 scale) to have no positive/negative impact |
| **Component Skip** | All metrics in a component are missing | Skip entire component, redistribute weight to other components |
| **Score Unavailable** | Too many components missing (>50% weight) | Don't calculate score, return `null` with reason |

### 4.2 Implementation

```typescript
interface MetricValue {
  value: number | null;
  source: 'direct' | 'inherited' | 'neutral' | 'skipped';
  sourceGeography?: string;
}

interface ComponentCalculation {
  name: string;
  score: number | null;
  weight: number;
  adjustedWeight: number;  // After redistribution
  metrics: {
    name: string;
    value: MetricValue;
    normalizedScore: number | null;
    weight: number;
    adjustedWeight: number;
  }[];
  status: 'calculated' | 'partial' | 'skipped';
}

interface ScoreCalculation {
  score: number | null;
  status: 'complete' | 'partial' | 'unavailable';
  completenessPercent: number;
  components: ComponentCalculation[];
  missingMetrics: string[];
  skippedComponents: string[];
  reason?: string;  // If unavailable
}

// Configuration: which metrics can be skipped vs require neutral value
const METRIC_MISSING_STRATEGY: Record<string, 'skip' | 'neutral' | 'required'> = {
  // HomeReady
  income_gap_ratio: 'required',
  years_to_save: 'skip',
  rent_as_pct_of_income: 'neutral',
  price_reduced_share: 'skip',
  median_days_on_market: 'neutral',
  months_of_supply: 'neutral',
  pending_listing_count_yy: 'skip',
  volatility_36m: 'neutral',
  active_listing_count_yy: 'skip',
  unemployment_rate: 'neutral',      // Important but often inherited
  zhvi_5y_cagr: 'neutral',
  population_yoy: 'skip',
  median_household_income_yoy: 'skip',
  homeownership_rate: 'skip',
  median_age: 'skip',
  
  // InvestorEdge
  cap_rate: 'required',
  grm: 'skip',                       // Can derive from cap_rate
  gross_yield: 'skip',
  rent_to_price_ratio: 'skip',
  zori_yoy: 'neutral',
  pending_ratio: 'neutral',
  renter_share: 'skip',
  overvalued_pct: 'neutral',
  inventory_surplus_pct: 'skip',
  large_multi_permits_yoy: 'skip',
  
  // Market Health
  hotness_score: 'skip',             // Can derive from other metrics
  new_listing_count_yy: 'skip',
  sale_to_list_ratio: 'neutral',
  employment_yoy: 'skip',
};

function calculateComponentWithMissingMetrics(
  componentConfig: ComponentConfig,
  metrics: Record<string, MetricValue>
): ComponentCalculation {
  
  const metricResults: ComponentCalculation['metrics'] = [];
  let totalAvailableWeight = 0;
  let weightedSum = 0;
  
  for (const metricConfig of componentConfig.metrics) {
    const metricValue = metrics[metricConfig.name];
    const strategy = METRIC_MISSING_STRATEGY[metricConfig.name] || 'skip';
    
    let normalizedScore: number | null = null;
    let adjustedWeight = metricConfig.weight;
    let source = metricValue?.source || 'skipped';
    
    if (metricValue?.value !== null && metricValue?.value !== undefined) {
      // Metric available - calculate normally
      normalizedScore = normalizeMetric(metricValue.value, metricConfig.normalization);
      totalAvailableWeight += metricConfig.weight;
    } else if (strategy === 'neutral') {
      // Use neutral value (50)
      normalizedScore = 50;
      source = 'neutral';
      totalAvailableWeight += metricConfig.weight;
    } else if (strategy === 'required') {
      // Required metric missing - component cannot be calculated
      return {
        name: componentConfig.name,
        score: null,
        weight: componentConfig.weight,
        adjustedWeight: 0,
        metrics: metricResults,
        status: 'skipped',
      };
    }
    // else: strategy === 'skip' - metric excluded from calculation
    
    metricResults.push({
      name: metricConfig.name,
      value: metricValue || { value: null, source: 'skipped' },
      normalizedScore,
      weight: metricConfig.weight,
      adjustedWeight: normalizedScore !== null ? metricConfig.weight : 0,
    });
  }
  
  // Reweight available metrics
  if (totalAvailableWeight > 0 && totalAvailableWeight < 1) {
    const reweightFactor = 1 / totalAvailableWeight;
    
    for (const metric of metricResults) {
      if (metric.normalizedScore !== null) {
        metric.adjustedWeight = metric.weight * reweightFactor;
        weightedSum += metric.normalizedScore * metric.adjustedWeight;
      }
    }
  } else if (totalAvailableWeight >= 1) {
    // All metrics available
    for (const metric of metricResults) {
      if (metric.normalizedScore !== null) {
        weightedSum += metric.normalizedScore * metric.weight;
      }
    }
  }
  
  const status = totalAvailableWeight === 0 ? 'skipped' :
                 totalAvailableWeight < 0.5 ? 'partial' : 'calculated';
  
  return {
    name: componentConfig.name,
    score: totalAvailableWeight > 0 ? weightedSum : null,
    weight: componentConfig.weight,
    adjustedWeight: status === 'skipped' ? 0 : componentConfig.weight,
    metrics: metricResults,
    status,
  };
}

function calculateScoreWithMissingMetrics(
  scoreType: string,
  components: ComponentCalculation[]
): ScoreCalculation {
  
  let totalAvailableWeight = 0;
  let weightedSum = 0;
  const missingMetrics: string[] = [];
  const skippedComponents: string[] = [];
  
  for (const component of components) {
    if (component.status === 'skipped') {
      skippedComponents.push(component.name);
      continue;
    }
    
    // Collect missing metrics for reporting
    for (const metric of component.metrics) {
      if (metric.value.source === 'skipped' || metric.value.source === 'neutral') {
        missingMetrics.push(metric.name);
      }
    }
    
    totalAvailableWeight += component.weight;
  }
  
  // Check if enough data to calculate
  if (totalAvailableWeight < 0.5) {
    return {
      score: null,
      status: 'unavailable',
      completenessPercent: totalAvailableWeight * 100,
      components,
      missingMetrics,
      skippedComponents,
      reason: `Insufficient data: only ${(totalAvailableWeight * 100).toFixed(0)}% of required metrics available`,
    };
  }
  
  // Reweight and calculate
  const reweightFactor = 1 / totalAvailableWeight;
  
  for (const component of components) {
    if (component.score !== null) {
      component.adjustedWeight = component.weight * reweightFactor;
      weightedSum += component.score * component.adjustedWeight;
    }
  }
  
  return {
    score: weightedSum,
    status: totalAvailableWeight >= 0.9 ? 'complete' : 'partial',
    completenessPercent: totalAvailableWeight * 100,
    components,
    missingMetrics,
    skippedComponents,
  };
}
```

### 4.3 API Response with Completeness

```typescript
interface ScoreResponse {
  // ... existing fields ...
  
  // Data completeness
  completeness: {
    percent: number;              // 0-100
    status: 'complete' | 'partial' | 'unavailable';
    missingMetrics: string[];
    skippedComponents: string[];
    reason?: string;              // If unavailable
  };
}
```

### 4.4 UI Display for Partial Scores

```
Complete Score (100% data):
┌─────────────────────────────────────────────────────────┐
│  Market Health Index                          72 / 100  │
│  ↑ +5 pts vs last month                    [Light Green]│
│  Confidence: ★★★★☆ Good (78%)                          │
└─────────────────────────────────────────────────────────┘

Partial Score (75% data):
┌─────────────────────────────────────────────────────────┐
│  Market Health Index                          72 / 100  │
│  ↑ +5 pts vs last month                    [Light Green]│
│  Confidence: ★★★★☆ Good (78%)                          │
│  ⚠️ Based on 75% of metrics (some data unavailable)    │
└─────────────────────────────────────────────────────────┘

Unavailable Score (<50% data):
┌─────────────────────────────────────────────────────────┐
│  Market Health Index                              --    │
│  ⚠️ Insufficient data for this area                    │
│  Missing: unemployment rate, days on market, ...       │
└─────────────────────────────────────────────────────────┘
```

---

## Part 5: Trend Calculation

Calculate trend by comparing current score to 3-month prior score.

```typescript
function calculateTrend(currentScore: number, priorScore: number | null): string {
  if (priorScore === null) return 'stable';
  
  const change = currentScore - priorScore;
  
  if (change >= 3) return 'improving';
  if (change <= -3) return 'declining';
  return 'stable';
}
```

---

## Part 6: Main Scoring Pipeline

### 5.1 Pipeline Flow

```
1. Fetch raw metrics for geography
2. For missing metrics, apply inheritance lookup
3. Normalize all metrics to 0-100
4. Calculate component scores
5. Apply weights and sum for final score
6. Calculate trend vs 3-month prior
7. Store in propertyiq_scores table
8. Store component details in propertyiq_score_details table
```

### 5.2 TypeScript Implementation

```typescript
interface ScoringResult {
  homeready: {
    score: number;
    components: {
      affordability: number;
      market_timing: number;
      stability: number;
      growth_potential: number;
      livability: number;
    };
    trend: string;
  };
  investoredge: {
    score: number;
    components: {
      cash_flow: number;
      rent_demand: number;
      appreciation: number;
      entry_point: number;
      risk: number;
    };
    trend: string;
  };
  market_health: {
    score: number;
    components: {
      demand_strength: number;
      supply_balance: number;
      price_stability: number;
      economic_foundation: number;
    };
    trend: string;
  };
  metadata: {
    data_completeness: number;
    inherited_metrics: string[];
  };
}

async function calculateScoresForGeography(
  geographyId: string,
  periodDate: Date
): Promise<ScoringResult> {
  
  // 1. Fetch all required metrics with inheritance
  const metrics = await fetchMetricsWithInheritance(geographyId, periodDate);
  
  // 2. Track which metrics were inherited
  const inheritedMetrics = metrics.inherited;
  const dataCompleteness = (metrics.direct.length / (metrics.direct.length + metrics.inherited.length)) * 100;
  
  // 3. Calculate HomeReady
  const homereadyAffordability = calculateAffordability(metrics);
  const homereadyMarketTiming = calculateMarketTiming(metrics);
  const homereadyStability = calculateStability(metrics);
  const homereadyGrowthPotential = calculateGrowthPotential(metrics);
  const homereadyLivability = calculateLivability(metrics);
  
  const homereadyScore = (
    homereadyAffordability * 0.30 +
    homereadyMarketTiming * 0.25 +
    homereadyStability * 0.20 +
    homereadyGrowthPotential * 0.15 +
    homereadyLivability * 0.10
  );
  
  // 4. Calculate InvestorEdge
  const investorCashFlow = calculateCashFlow(metrics);
  const investorRentDemand = calculateRentDemand(metrics);
  const investorAppreciation = calculateAppreciation(metrics);
  const investorEntryPoint = calculateEntryPoint(metrics);
  const investorRisk = calculateRisk(metrics);
  
  const investoredgeScore = (
    investorCashFlow * 0.35 +
    investorRentDemand * 0.20 +
    investorAppreciation * 0.20 +
    investorEntryPoint * 0.15 +
    investorRisk * 0.10
  );
  
  // 5. Calculate Market Health
  const healthDemand = calculateDemandStrength(metrics);
  const healthSupply = calculateSupplyBalance(metrics);
  const healthPrice = calculatePriceStability(metrics);
  const healthEconomic = calculateEconomicFoundation(metrics);
  
  const marketHealthScore = (
    healthDemand * 0.35 +
    healthSupply * 0.25 +
    healthPrice * 0.25 +
    healthEconomic * 0.15
  );
  
  // 6. Fetch 3-month prior scores for trend
  const priorScores = await fetchPriorScores(geographyId, subtractMonths(periodDate, 3));
  
  return {
    homeready: {
      score: homereadyScore,
      components: {
        affordability: homereadyAffordability,
        market_timing: homereadyMarketTiming,
        stability: homereadyStability,
        growth_potential: homereadyGrowthPotential,
        livability: homereadyLivability,
      },
      trend: calculateTrend(homereadyScore, priorScores?.homeready_score),
    },
    investoredge: {
      score: investoredgeScore,
      components: {
        cash_flow: investorCashFlow,
        rent_demand: investorRentDemand,
        appreciation: investorAppreciation,
        entry_point: investorEntryPoint,
        risk: investorRisk,
      },
      trend: calculateTrend(investoredgeScore, priorScores?.investoredge_score),
    },
    market_health: {
      score: marketHealthScore,
      components: {
        demand_strength: healthDemand,
        supply_balance: healthSupply,
        price_stability: healthPrice,
        economic_foundation: healthEconomic,
      },
      trend: calculateTrend(marketHealthScore, priorScores?.market_health_score),
    },
    metadata: {
      data_completeness: dataCompleteness,
      inherited_metrics: inheritedMetrics,
    },
  };
}
```

---

## Part 7: UI Display Modes & Access Tiers

### 5.5.1 Access Tier Model

| Score | Free Tier | Pro Tier |
|-------|-----------|----------|
| **Market Health Index** | ✅ Full access | ✅ Full access |
| **HomeReady Score** | 🔒 Teaser only | ✅ Full access |
| **InvestorEdge Score** | 🔒 Teaser only | ✅ Full access |

**Key Principle:** All scores work identically at every geographic level (ZIP, County, Metro, State). The user experience is consistent regardless of which geography they click.

```typescript
function getScoreAccess(scoreType: string, userTier: string): 'full' | 'teaser' {
  // Market Health is always free at all geographic levels
  if (scoreType === 'market_health') return 'full';
  
  // HomeReady and InvestorEdge require Pro
  if (userTier === 'pro') return 'full';
  
  return 'teaser';
}
```

### 5.5.2 Badge Mode (Compact)

For map markers, list views, comparison tables.

```typescript
interface ScoreBadgeProps {
  score: number;
  scoreType: 'homeready' | 'investoredge' | 'market_health';
  trend: 'improving' | 'stable' | 'declining';
  access: 'full' | 'teaser';
  onUpgradeClick?: () => void;
}

function ScoreBadge({ score, scoreType, trend, access, onUpgradeClick }: ScoreBadgeProps) {
  const color = getScoreColor(score);
  const label = getScoreTypeLabel(scoreType);
  const trendIcon = access === 'full' ? getTrendIcon(trend) : null;
  const showLock = access === 'teaser';
  
  return (
    <div 
      className="score-badge" 
      style={{ backgroundColor: color }}
      onClick={() => access === 'teaser' ? onUpgradeClick?.() : null}
    >
      <div className="score-header">
        <span className="score-value">{Math.round(score)}</span>
        {showLock && <span className="lock-icon">🔒</span>}
      </div>
      <span className="score-label">{label}</span>
      {trendIcon && <span className="score-trend">{trendIcon}</span>}
    </div>
  );
}
```

**Badge Layout:**
```
Free Tier:
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│     72       │  │    68  🔒    │  │    74  🔒    │
│Market Health │  │  HomeReady   │  │ InvestorEdge │
│      ↑       │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
   [Click for      [Click to         [Click to
    details]        upgrade]          upgrade]

Pro Tier:
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│     72       │  │     68       │  │     74       │
│Market Health │  │  HomeReady   │  │ InvestorEdge │
│      ↑       │  │      →       │  │      ↑       │
└──────────────┘  └──────────────┘  └──────────────┘
   [Click for      [Click for        [Click for
    details]        details]          details]
```

### 5.5.3 Card Mode (Expanded)

For detail panels when user clicks a score.

```typescript
interface ScoreCardProps {
  scoreType: 'homeready' | 'investoredge' | 'market_health';
  geographyId: string;
  geographyType: string;           // 'zip', 'county', 'metro', etc.
  userTier: 'free' | 'pro';
  showMetrics?: boolean;           // default: true
  showHistory?: boolean;           // default: true
  historyMonths?: number;          // default: 6
  defaultExpanded?: boolean;       // default: false
  onUpgradeClick?: () => void;
}

function ScoreCard({ 
  scoreType, 
  geographyId, 
  geographyType,
  userTier,
  showMetrics = true,
  showHistory = true,
  historyMonths = 6,
  defaultExpanded = false,
  onUpgradeClick 
}: ScoreCardProps) {
  const access = getScoreAccess(scoreType, userTier);
  const { data } = useScoreData(scoreType, geographyId, access === 'full', historyMonths);
  
  if (access === 'teaser') {
    return <TeaserCard scoreType={scoreType} score={data.score} onUpgradeClick={onUpgradeClick} />;
  }
  
  return <FullScoreCard data={data} showMetrics={showMetrics} showHistory={showHistory} />;
}
```

**Full Card (Market Health - Free, or Pro tier):**
```
┌─────────────────────────────────────────────────────────┐
│  Market Health Index                          72 / 100  │
│  ↑ +5 pts vs last month                    [Light Green]│
│  Denver, CO (Metro)                                     │
├─────────────────────────────────────────────────────────┤
│  Demand Strength (35%)      ██████████████████░░  85    │
│  Supply Balance (25%)       ████████████████░░░░  78    │
│  Price Stability (25%)      ██████████████░░░░░░  68    │
│  Economic Foundation (15%)  ████████████░░░░░░░░  58    │
├─────────────────────────────────────────────────────────┤
│  ▼ View Metrics                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Demand Strength:                                  │  │
│  │   • Pending Ratio: 42% (target > 30%)            │  │
│  │   • Days on Market: 38 days                      │  │
│  │   • Hotness Score: 72                            │  │
│  │ Supply Balance:                                   │  │
│  │   • Months of Supply: 4.8 (target 4-6)          │  │
│  │   • Inventory YoY: +8%                           │  │
│  │   • New Listings YoY: +5%                        │  │
│  │ Price Stability:                                  │  │
│  │   • Price Cuts: 18%                              │  │
│  │   • Sale-to-List: 98.5% (target 97-103%)        │  │
│  │   • Home Values YoY: +4.2% (target 2-6%)        │  │
│  │ Economic Foundation:                              │  │
│  │   • Unemployment: 3.8% (target < 5%)            │  │
│  │   • Job Growth YoY: +2.1%                        │  │
│  │   ⚠️ Inherited from Denver-Aurora-Lakewood MSA   │  │
│  └───────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  6-Month Trend: ▁▂▃▄▅▆ (58 → 72)                       │
└─────────────────────────────────────────────────────────┘
```

**Teaser Card (HomeReady/InvestorEdge - Free tier):**
```
┌─────────────────────────────────────────────────────────┐
│  HomeReady Score                              68 / 100  │
│  🔒 Pro Feature                                         │
├─────────────────────────────────────────────────────────┤
│  Affordability (30%)        ░░░░░░░░░░░░░░░░░░░░  ??   │
│  Market Timing (25%)        ░░░░░░░░░░░░░░░░░░░░  ??   │
│  Stability (20%)            ░░░░░░░░░░░░░░░░░░░░  ??   │
│  Growth Potential (15%)     ░░░░░░░░░░░░░░░░░░░░  ??   │
│  Livability (10%)           ░░░░░░░░░░░░░░░░░░░░  ??   │
├─────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────┐  │
│  │  🔓 Upgrade to Pro to unlock:                     │  │
│  │                                                   │  │
│  │  ✓ Full affordability analysis                   │  │
│  │  ✓ Best time to buy indicators                   │  │
│  │  ✓ Price stability & growth trends               │  │
│  │  ✓ Historical score trends                       │  │
│  │                                                   │  │
│  │  [ Upgrade to Pro - $19/month ]                  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 5.5.4 API Endpoint

```typescript
// GET /api/scores/:geographyId
// Query params:
//   type: 'homeready' | 'investoredge' | 'market_health' (required)
//   expanded: 'true' | 'false' (default: false)
//   history_months: number (default: 6, only if expanded=true)
// Headers:
//   Authorization: Bearer <token> (to determine user tier)

async function getScore(
  req: Request,
  geographyId: string,
  scoreType: string,
  expanded: boolean = false,
  historyMonths: number = 6
): Promise<ScoreResponse> {
  
  const userTier = await getUserTier(req);
  const access = getScoreAccess(scoreType, userTier);
  
  // Always fetch base score (visible to all)
  const baseScore = await db.query(`
    SELECT 
      ${scoreType}_score as score,
      ${scoreType}_trend as trend,
      geography_type,
      period_date
    FROM propertyiq_scores
    WHERE geography_id = $1
    ORDER BY period_date DESC
    LIMIT 1
  `, [geographyId]);
  
  // Calculate trend change
  const priorScore = await db.query(`
    SELECT ${scoreType}_score as score
    FROM propertyiq_scores
    WHERE geography_id = $1
      AND period_date < $2
    ORDER BY period_date DESC
    LIMIT 1
  `, [geographyId, baseScore.period_date]);
  
  const trendChange = baseScore.score - (priorScore?.score ?? baseScore.score);
  
  const response: ScoreResponse = {
    score_type: scoreType,
    geography_id: geographyId,
    geography_type: baseScore.geography_type,
    period_date: baseScore.period_date,
    score: baseScore.score,
    score_label: getScoreLabel(baseScore.score),
    score_color: getScoreColor(baseScore.score),
    trend: access === 'full' ? baseScore.trend : undefined,
    trend_change: access === 'full' ? trendChange : undefined,
    access,
  };
  
  // Add upgrade CTA for teaser access
  if (access === 'teaser') {
    response.upgrade_cta = getUpgradeCTA(scoreType);
    return response;
  }
  
  // Full access: add components and history if requested
  if (expanded) {
    response.components = await getScoreComponents(geographyId, scoreType, baseScore.period_date);
    response.history = await getScoreHistory(geographyId, scoreType, historyMonths);
  }
  
  return response;
}

function getUpgradeCTA(scoreType: string): string {
  switch (scoreType) {
    case 'homeready':
      return 'Unlock HomeReady insights: affordability analysis, best time to buy indicators, and growth trends.';
    case 'investoredge':
      return 'Unlock InvestorEdge insights: cash flow analysis, cap rates, rent demand, and risk factors.';
    default:
      return 'Upgrade to Pro for full access.';
  }
}

async function getScoreComponents(
  geographyId: string,
  scoreType: string,
  periodDate: Date
): Promise<ComponentData[]> {
  
  const details = await db.query(`
    SELECT 
      component_name,
      weight,
      normalized_value,
      raw_metrics,
      data_source
    FROM propertyiq_score_details
    WHERE geography_id = $1
      AND score_type = $2
      AND period_date = $3
    ORDER BY weight DESC
  `, [geographyId, scoreType, periodDate]);
  
  return details.map(d => ({
    name: formatComponentName(d.component_name),
    weight: d.weight,
    score: d.normalized_value,
    metrics: formatMetrics(d.raw_metrics, d.data_source),
  }));
}

async function getScoreHistory(
  geographyId: string,
  scoreType: string,
  months: number
): Promise<HistoryPoint[]> {
  
  const history = await db.query(`
    SELECT period_date, ${scoreType}_score as score
    FROM propertyiq_scores
    WHERE geography_id = $1
    ORDER BY period_date DESC
    LIMIT $2
  `, [geographyId, months]);
  
  return history.reverse(); // Return chronological order for sparkline
}
```

### 5.5.5 Metric Display Formatting

```typescript
const METRIC_FORMATS: Record<string, MetricFormat> = {
  // Market Health metrics
  pending_ratio: {
    display_name: 'Pending Ratio',
    format: (v) => `${(v * 100).toFixed(0)}%`,
    target: '> 30%',
  },
  median_days_on_market: {
    display_name: 'Days on Market',
    format: (v) => `${Math.round(v)} days`,
    target: null,
  },
  hotness_score: {
    display_name: 'Hotness Score',
    format: (v) => `${Math.round(v)}`,
    target: null,
  },
  months_of_supply: {
    display_name: 'Months of Supply',
    format: (v) => `${v.toFixed(1)}`,
    target: '4-6 (balanced)',
  },
  active_listing_count_yy: {
    display_name: 'Inventory YoY',
    format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`,
    target: '±10%',
  },
  new_listing_count_yy: {
    display_name: 'New Listings YoY',
    format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`,
    target: '-10% to +15%',
  },
  price_reduced_share: {
    display_name: 'Price Cuts',
    format: (v) => `${v.toFixed(0)}%`,
    target: '< 20%',
  },
  sale_to_list_ratio: {
    display_name: 'Sale-to-List',
    format: (v) => `${(v * 100).toFixed(1)}%`,
    target: '97-103%',
  },
  zhvi_yoy: {
    display_name: 'Home Values YoY',
    format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`,
    target: '2-6% (healthy)',
  },
  unemployment_rate: {
    display_name: 'Unemployment',
    format: (v) => `${v.toFixed(1)}%`,
    target: '< 5%',
  },
  employment_yoy: {
    display_name: 'Job Growth YoY',
    format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`,
    target: '> 0%',
  },
  
  // HomeReady metrics
  income_gap_ratio: {
    display_name: 'Income Gap Ratio',
    format: (v) => `${v.toFixed(1)}x`,
    target: '< 3.5x',
  },
  years_to_save: {
    display_name: 'Years to Save',
    format: (v) => `${v.toFixed(1)} years`,
    target: '< 5 years',
  },
  rent_as_pct_of_income: {
    display_name: 'Rent as % of Income',
    format: (v) => `${v.toFixed(0)}%`,
    target: '< 30%',
  },
  volatility_36m: {
    display_name: 'Price Volatility (3yr)',
    format: (v) => `${v.toFixed(1)}%`,
    target: '< 5%',
  },
  zhvi_5y_cagr: {
    display_name: '5-Year Appreciation',
    format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%/yr`,
    target: '> 3%/yr',
  },
  population_yoy: {
    display_name: 'Population Growth',
    format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`,
    target: '> 0%',
  },
  homeownership_rate: {
    display_name: 'Homeownership Rate',
    format: (v) => `${v.toFixed(0)}%`,
    target: '> 60%',
  },
  
  // InvestorEdge metrics
  cap_rate: {
    display_name: 'Cap Rate',
    format: (v) => `${v.toFixed(1)}%`,
    target: '> 6%',
  },
  grm: {
    display_name: 'Gross Rent Multiplier',
    format: (v) => `${v.toFixed(1)}`,
    target: '< 15',
  },
  gross_yield: {
    display_name: 'Gross Yield',
    format: (v) => `${v.toFixed(1)}%`,
    target: '> 8%',
  },
  rent_to_price_ratio: {
    display_name: 'Rent-to-Price',
    format: (v) => `${(v * 100).toFixed(2)}%`,
    target: '> 0.7% (1% rule)',
  },
  zori_yoy: {
    display_name: 'Rent Growth YoY',
    format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`,
    target: '> 2%',
  },
  renter_share: {
    display_name: 'Renter Share',
    format: (v) => `${(v * 100).toFixed(0)}%`,
    target: '> 30%',
  },
  overvalued_pct: {
    display_name: 'Overvaluation',
    format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`,
    target: '< 0% (undervalued)',
  },
  inventory_surplus_pct: {
    display_name: 'Inventory Surplus',
    format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`,
    target: '< 10%',
  },
  large_multi_permits_yoy: {
    display_name: 'MF Permits YoY',
    format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`,
    target: '< 20% (low competition)',
  },
};

function formatMetrics(rawMetrics: Record<string, number>, dataSource: string): MetricData[] {
  return Object.entries(rawMetrics).map(([name, value]) => {
    const format = METRIC_FORMATS[name] || { display_name: name, format: (v) => v.toString() };
    const inherited = dataSource !== 'direct';
    
    return {
      name,
      display_name: format.display_name,
      value,
      formatted_value: format.format(value),
      target: format.target,
      sub_weight: getSubWeight(name),
      inherited,
      source_geography: inherited ? dataSource.replace('inherited_', '') : undefined,
    };
  });
}
```

### 5.5.6 Color and Label Helpers

```typescript
function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e'; // green-500
  if (score >= 60) return '#84cc16'; // lime-500
  if (score >= 40) return '#f59e0b'; // amber-500
  if (score >= 20) return '#f97316'; // orange-500
  return '#ef4444';                   // red-500
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Neutral';
  if (score >= 20) return 'Below Average';
  return 'Poor';
}

function getTrendIcon(trend: string): string {
  switch (trend) {
    case 'improving': return '↑';
    case 'declining': return '↓';
    default: return '→';
  }
}

function getTrendColor(trend: string): string {
  switch (trend) {
    case 'improving': return '#22c55e';
    case 'declining': return '#ef4444';
    default: return '#6b7280';
  }
}

function getScoreTypeLabel(type: string): string {
  switch (type) {
    case 'homeready': return 'HomeReady';
    case 'investoredge': return 'InvestorEdge';
    case 'market_health': return 'Market Health';
    default: return type;
  }
}
```

---

## Part 8: Testing & Validation

### 6.1 Unit Tests Required

```typescript
// Test normalization functions
describe('normalizeMinMax', () => {
  it('should return 0 for min value', () => {
    expect(normalizeMinMax(2, 2, 10, false)).toBe(0);
  });
  it('should return 100 for max value', () => {
    expect(normalizeMinMax(10, 2, 10, false)).toBe(100);
  });
  it('should invert correctly', () => {
    expect(normalizeMinMax(2, 2, 10, true)).toBe(100);
  });
});

// Test score calculations
describe('HomeReady Score', () => {
  it('should weight affordability at 30%', () => {
    // Test with known inputs
  });
});

// Test inheritance
describe('Metric Inheritance', () => {
  it('should inherit unemployment from county for ZIP', () => {
    // Test ZIP lookup falls back to county
  });
});
```

### 6.2 Validation Queries

```sql
-- Check score distribution (should be roughly normal, centered around 50)
SELECT 
  geography_type,
  COUNT(*) as count,
  AVG(homeready_score) as avg_homeready,
  AVG(investoredge_score) as avg_investor,
  AVG(market_health_score) as avg_health,
  STDDEV(homeready_score) as std_homeready
FROM propertyiq_scores
WHERE period_date = (SELECT MAX(period_date) FROM propertyiq_scores)
GROUP BY geography_type;

-- Check inheritance usage
SELECT 
  geography_type,
  AVG(data_completeness) as avg_completeness,
  COUNT(*) FILTER (WHERE data_completeness < 100) as inherited_count
FROM propertyiq_scores
WHERE period_date = (SELECT MAX(period_date) FROM propertyiq_scores)
GROUP BY geography_type;

-- Spot check: high scores should correlate with good fundamentals
SELECT 
  geography_id,
  homeready_score,
  investoredge_score,
  market_health_score
FROM propertyiq_scores
WHERE period_date = (SELECT MAX(period_date) FROM propertyiq_scores)
ORDER BY homeready_score DESC
LIMIT 20;
```

---

## Part 9: Backtesting & Confidence Scoring

Backtesting validates that scores actually predict what they claim to predict. Each score gets a confidence rating based on historical correlation with real outcomes.

### 7.1 Database Schema for Backtesting

```sql
-- Historical scores for backtesting (if not already tracking)
CREATE TABLE IF NOT EXISTS propertyiq_scores_history (
  id SERIAL PRIMARY KEY,
  geography_id VARCHAR(20) NOT NULL,
  geography_type VARCHAR(10) NOT NULL,
  period_date DATE NOT NULL,
  
  homeready_score DECIMAL(5,2),
  homeready_affordability DECIMAL(5,2),
  homeready_market_timing DECIMAL(5,2),
  homeready_stability DECIMAL(5,2),
  homeready_growth_potential DECIMAL(5,2),
  homeready_livability DECIMAL(5,2),
  
  investoredge_score DECIMAL(5,2),
  investoredge_cash_flow DECIMAL(5,2),
  investoredge_rent_demand DECIMAL(5,2),
  investoredge_appreciation DECIMAL(5,2),
  investoredge_entry_point DECIMAL(5,2),
  investoredge_risk DECIMAL(5,2),
  
  market_health_score DECIMAL(5,2),
  market_health_demand_strength DECIMAL(5,2),
  market_health_supply_balance DECIMAL(5,2),
  market_health_price_stability DECIMAL(5,2),
  market_health_economic_foundation DECIMAL(5,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(geography_id, period_date)
);

CREATE INDEX idx_scores_history_geo_date ON propertyiq_scores_history(geography_id, period_date);
CREATE INDEX idx_scores_history_type_date ON propertyiq_scores_history(geography_type, period_date);

-- Outcome measurements for backtesting
CREATE TABLE propertyiq_backtest_outcomes (
  id SERIAL PRIMARY KEY,
  geography_id VARCHAR(20) NOT NULL,
  geography_type VARCHAR(10) NOT NULL,
  measurement_date DATE NOT NULL,
  
  -- Price outcomes (all horizons)
  zhvi_6m_change DECIMAL(6,3),        -- 6-month price change %
  zhvi_1y_change DECIMAL(6,3),        -- 1-year price change %
  zhvi_3y_change DECIMAL(6,3),        -- 3-year price change %
  zhvi_5y_change DECIMAL(6,3),        -- 5-year price change %
  
  -- Rent outcomes (all horizons)
  zori_6m_change DECIMAL(6,3),        -- 6-month rent change %
  zori_1y_change DECIMAL(6,3),        -- 1-year rent change %
  zori_3y_change DECIMAL(6,3),        -- 3-year rent change %
  zori_5y_change DECIMAL(6,3),        -- 5-year rent change %
  
  -- Market health outcomes (shorter horizons)
  dom_6m_change DECIMAL(6,3),         -- Days on market change
  dom_1y_change DECIMAL(6,3),
  inventory_6m_change DECIMAL(6,3),   -- Inventory change %
  inventory_1y_change DECIMAL(6,3),
  pending_ratio_6m_change DECIMAL(6,3),
  pending_ratio_1y_change DECIMAL(6,3),
  price_cut_share_6m_change DECIMAL(6,3),
  price_cut_share_1y_change DECIMAL(6,3),
  
  -- Volatility outcomes (realized over period)
  realized_volatility_6m DECIMAL(6,3),
  realized_volatility_1y DECIMAL(6,3),
  realized_volatility_3y DECIMAL(6,3),
  
  -- Cash flow outcomes
  cap_rate_6m DECIMAL(5,2),
  cap_rate_1y DECIMAL(5,2),
  cap_rate_3y DECIMAL(5,2),
  
  -- Compound annual growth rates (for multi-year)
  zhvi_3y_cagr DECIMAL(6,3),          -- 3-year CAGR
  zhvi_5y_cagr DECIMAL(6,3),          -- 5-year CAGR
  zori_3y_cagr DECIMAL(6,3),
  zori_5y_cagr DECIMAL(6,3),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(geography_id, measurement_date)
);

-- Backtest results
CREATE TABLE propertyiq_backtest_results (
  id SERIAL PRIMARY KEY,
  
  -- What was tested
  score_type VARCHAR(20) NOT NULL,        -- 'homeready', 'investoredge', 'market_health'
  component_name VARCHAR(50),             -- NULL for overall score, or specific component
  outcome_metric VARCHAR(50) NOT NULL,    -- e.g., 'zhvi_1y_change', 'zori_3y_cagr'
  geography_type VARCHAR(10) NOT NULL,    -- 'zip', 'county', 'metro', etc.
  
  -- Test parameters
  test_period_start DATE NOT NULL,
  test_period_end DATE NOT NULL,
  prediction_horizon VARCHAR(10) NOT NULL,  -- '6m', '1y', '3y', '5y'
  prediction_horizon_months INTEGER NOT NULL,  -- 6, 12, 36, 60
  
  -- Results
  sample_size INTEGER NOT NULL,
  correlation_r DECIMAL(5,4),             -- Pearson correlation (-1 to 1)
  correlation_r2 DECIMAL(5,4),            -- R-squared (0 to 1)
  mean_absolute_error DECIMAL(8,4),
  root_mean_squared_error DECIMAL(8,4),
  
  -- Directional accuracy (did we get the direction right?)
  directional_accuracy DECIMAL(5,4),      -- % of times score direction matched outcome direction
  
  -- Quintile analysis
  top_quintile_avg_outcome DECIMAL(8,4),  -- Avg outcome for top 20% scores
  bottom_quintile_avg_outcome DECIMAL(8,4), -- Avg outcome for bottom 20% scores
  quintile_spread DECIMAL(8,4),           -- Difference between top and bottom
  
  -- Calculated confidence
  confidence_score DECIMAL(5,2),          -- 0-100
  confidence_label VARCHAR(20),           -- 'High', 'Good', 'Moderate', 'Low', 'Insufficient'
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(score_type, component_name, outcome_metric, geography_type, prediction_horizon, test_period_start, test_period_end)
);

CREATE INDEX idx_backtest_results_lookup ON propertyiq_backtest_results(score_type, geography_type, prediction_horizon);

-- Current confidence scores (latest backtest results, aggregated)
CREATE TABLE propertyiq_confidence (
  id SERIAL PRIMARY KEY,
  score_type VARCHAR(20) NOT NULL,
  component_name VARCHAR(50),             -- NULL for overall score
  geography_type VARCHAR(10) NOT NULL,
  
  confidence_score DECIMAL(5,2) NOT NULL,
  confidence_label VARCHAR(20) NOT NULL,
  confidence_stars INTEGER NOT NULL,      -- 1-5
  
  -- Supporting stats
  primary_correlation_r2 DECIMAL(5,4),
  sample_size INTEGER,
  last_backtest_date DATE,
  
  -- Breakdown
  correlation_contribution DECIMAL(5,2),  -- How much correlation contributed
  sample_size_contribution DECIMAL(5,2),  -- How much sample size contributed
  recency_contribution DECIMAL(5,2),      -- How much recency contributed
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(score_type, component_name, geography_type)
);
```

### 7.2 Backtest Time Horizons

| Horizon | Code | Months | Primary Use Case |
|---------|------|--------|------------------|
| 6 months | `6m` | 6 | Market Health (short-term market conditions) |
| 1 year | `1y` | 12 | All scores (standard validation period) |
| 3 years | `3y` | 36 | HomeReady & InvestorEdge (medium-term growth) |
| 5 years | `5y` | 60 | InvestorEdge (long-term appreciation) |

**Horizon Selection by Score:**

| Score | Recommended Horizons | Rationale |
|-------|---------------------|-----------|
| Market Health | 6m, 1y | Market conditions change quickly |
| HomeReady | 6m, 1y, 3y | Homebuyers care about 1-3 year stability |
| InvestorEdge | 1y, 3y, 5y | Investors need short and long-term validation |

### 7.3 Outcome Metric Definitions

```typescript
const PREDICTION_HORIZONS = ['6m', '1y', '3y', '5y'] as const;
type PredictionHorizon = typeof PREDICTION_HORIZONS[number];

const HORIZON_MONTHS: Record<PredictionHorizon, number> = {
  '6m': 6,
  '1y': 12,
  '3y': 36,
  '5y': 60,
};

interface OutcomeConfig {
  metric: string;
  weight: number;
  description: string;
  invert?: boolean;
  optimal?: [number, number];
  min?: number;
}

const BACKTEST_OUTCOMES: Record<string, Record<PredictionHorizon, OutcomeConfig[] | null>> = {
  // HomeReady outcomes by horizon
  homeready: {
    '6m': [
      { metric: 'zhvi_6m_change', weight: 0.4, description: 'Price change next 6m' },
      { metric: 'dom_6m_change', weight: 0.3, invert: true, description: 'Market accessibility' },
      { metric: 'realized_volatility_6m', weight: 0.3, invert: true, description: 'Price stability' },
    ],
    '1y': [
      { metric: 'zhvi_1y_change', weight: 0.4, description: 'Price appreciation next 1y' },
      { metric: 'realized_volatility_1y', weight: 0.3, invert: true, description: 'Price stability' },
      { metric: 'dom_1y_change', weight: 0.3, invert: true, description: 'Market accessibility' },
    ],
    '3y': [
      { metric: 'zhvi_3y_change', weight: 0.5, description: 'Price appreciation next 3y' },
      { metric: 'zhvi_3y_cagr', weight: 0.3, description: '3-year CAGR' },
      { metric: 'realized_volatility_3y', weight: 0.2, invert: true, description: 'Long-term stability' },
    ],
    '5y': [
      { metric: 'zhvi_5y_change', weight: 0.5, description: 'Price appreciation next 5y' },
      { metric: 'zhvi_5y_cagr', weight: 0.5, description: '5-year CAGR' },
    ],
  },
  
  // InvestorEdge outcomes by horizon
  investoredge: {
    '6m': [
      { metric: 'cap_rate_6m', weight: 0.4, description: 'Cap rate held at 6m' },
      { metric: 'zori_6m_change', weight: 0.4, description: 'Rent growth 6m' },
      { metric: 'zhvi_6m_change', weight: 0.2, description: 'Price change 6m' },
    ],
    '1y': [
      { metric: 'cap_rate_1y', weight: 0.3, description: 'Cap rate held at 1y' },
      { metric: 'zori_1y_change', weight: 0.3, description: 'Rent growth 1y' },
      { metric: 'zhvi_1y_change', weight: 0.25, description: 'Appreciation 1y' },
      { metric: 'realized_volatility_1y', weight: 0.15, invert: true, description: 'Low risk' },
    ],
    '3y': [
      { metric: 'zori_3y_cagr', weight: 0.35, description: 'Rent CAGR 3y' },
      { metric: 'zhvi_3y_cagr', weight: 0.35, description: 'Price CAGR 3y' },
      { metric: 'cap_rate_3y', weight: 0.3, description: 'Cap rate at 3y' },
    ],
    '5y': [
      { metric: 'zhvi_5y_cagr', weight: 0.4, description: 'Price CAGR 5y' },
      { metric: 'zori_5y_cagr', weight: 0.4, description: 'Rent CAGR 5y' },
      { metric: 'zhvi_5y_change', weight: 0.2, description: 'Total appreciation 5y' },
    ],
  },
  
  // Market Health outcomes by horizon (shorter horizons only)
  market_health: {
    '6m': [
      { metric: 'pending_ratio_6m_change', weight: 0.3, description: 'Transaction volume held' },
      { metric: 'dom_6m_change', weight: 0.25, optimal: [-20, 20], description: 'Stable DOM' },
      { metric: 'inventory_6m_change', weight: 0.25, optimal: [-10, 10], description: 'Balanced inventory' },
      { metric: 'realized_volatility_6m', weight: 0.2, invert: true, description: 'Price stability' },
    ],
    '1y': [
      { metric: 'pending_ratio_1y_change', weight: 0.3, description: 'Transaction volume 1y' },
      { metric: 'realized_volatility_1y', weight: 0.3, invert: true, description: 'Price stability 1y' },
      { metric: 'inventory_1y_change', weight: 0.2, optimal: [-15, 15], description: 'Inventory balance' },
      { metric: 'zhvi_1y_change', weight: 0.2, optimal: [0, 10], description: 'Healthy appreciation' },
    ],
    '3y': null,  // Market Health doesn't predict 3+ years out
    '5y': null,
  },
};
```

### 7.4 Backtest Runner

```typescript
interface BacktestConfig {
  scoreType: 'homeready' | 'investoredge' | 'market_health';
  componentName?: string;           // null for overall score
  geographyType: string;
  horizon: PredictionHorizon;       // '6m', '1y', '3y', '5y'
  testPeriodStart: Date;
  testPeriodEnd: Date;
}

interface BacktestResult {
  config: BacktestConfig;
  sampleSize: number;
  correlationR: number;
  correlationR2: number;
  meanAbsoluteError: number;
  rootMeanSquaredError: number;
  directionalAccuracy: number;
  topQuintileAvgOutcome: number;
  bottomQuintileAvgOutcome: number;
  quintileSpread: number;
  confidenceScore: number;
  confidenceLabel: string;
}

async function runBacktest(config: BacktestConfig): Promise<BacktestResult> {
  const outcomes = BACKTEST_OUTCOMES[config.scoreType];
  const outcomeConfig = config.componentName 
    ? outcomes[config.componentName] 
    : outcomes.overall;
  
  // Get historical scores
  const scores = await db.query(`
    SELECT 
      geography_id,
      period_date,
      ${getScoreColumn(config.scoreType, config.componentName)} as score
    FROM propertyiq_scores_history
    WHERE geography_type = $1
      AND period_date BETWEEN $2 AND $3
      AND ${getScoreColumn(config.scoreType, config.componentName)} IS NOT NULL
  `, [config.geographyType, config.testPeriodStart, config.testPeriodEnd]);
  
  // For each score, get the corresponding outcome
  const pairs: { score: number; outcome: number }[] = [];
  
  for (const scoreRow of scores) {
    const outcomeDate = addMonths(scoreRow.period_date, outcomeConfig[0].horizon);
    
    const outcome = await db.query(`
      SELECT ${outcomeConfig.map(o => o.metric).join(', ')}
      FROM propertyiq_backtest_outcomes
      WHERE geography_id = $1
        AND measurement_date = $2
    `, [scoreRow.geography_id, outcomeDate]);
    
    if (outcome) {
      // Calculate weighted outcome
      const weightedOutcome = calculateWeightedOutcome(outcome, outcomeConfig);
      pairs.push({ score: scoreRow.score, outcome: weightedOutcome });
    }
  }
  
  // Calculate statistics
  const stats = calculateBacktestStats(pairs);
  const confidence = calculateConfidence(stats, pairs.length, config.testPeriodEnd);
  
  return {
    config,
    sampleSize: pairs.length,
    ...stats,
    confidenceScore: confidence.score,
    confidenceLabel: confidence.label,
  };
}

function calculateBacktestStats(pairs: { score: number; outcome: number }[]): BacktestStats {
  const n = pairs.length;
  if (n < 10) return null; // Insufficient data
  
  const scores = pairs.map(p => p.score);
  const outcomes = pairs.map(p => p.outcome);
  
  // Pearson correlation
  const meanScore = scores.reduce((a, b) => a + b, 0) / n;
  const meanOutcome = outcomes.reduce((a, b) => a + b, 0) / n;
  
  let numerator = 0;
  let denomScore = 0;
  let denomOutcome = 0;
  
  for (let i = 0; i < n; i++) {
    const scoreDeviation = scores[i] - meanScore;
    const outcomeDeviation = outcomes[i] - meanOutcome;
    numerator += scoreDeviation * outcomeDeviation;
    denomScore += scoreDeviation ** 2;
    denomOutcome += outcomeDeviation ** 2;
  }
  
  const correlationR = numerator / Math.sqrt(denomScore * denomOutcome);
  const correlationR2 = correlationR ** 2;
  
  // Error metrics
  const errors = pairs.map(p => {
    const predicted = (p.score / 100) * meanOutcome * 2; // Simplified prediction
    return Math.abs(p.outcome - predicted);
  });
  
  const meanAbsoluteError = errors.reduce((a, b) => a + b, 0) / n;
  const rootMeanSquaredError = Math.sqrt(errors.map(e => e ** 2).reduce((a, b) => a + b, 0) / n);
  
  // Directional accuracy
  const medianScore = scores.sort((a, b) => a - b)[Math.floor(n / 2)];
  const medianOutcome = outcomes.sort((a, b) => a - b)[Math.floor(n / 2)];
  
  let correctDirection = 0;
  for (let i = 0; i < n; i++) {
    const scoreAboveMedian = scores[i] > medianScore;
    const outcomeAboveMedian = outcomes[i] > medianOutcome;
    if (scoreAboveMedian === outcomeAboveMedian) correctDirection++;
  }
  const directionalAccuracy = correctDirection / n;
  
  // Quintile analysis
  const sorted = [...pairs].sort((a, b) => b.score - a.score);
  const quintileSize = Math.floor(n / 5);
  
  const topQuintile = sorted.slice(0, quintileSize);
  const bottomQuintile = sorted.slice(-quintileSize);
  
  const topQuintileAvgOutcome = topQuintile.reduce((a, b) => a + b.outcome, 0) / quintileSize;
  const bottomQuintileAvgOutcome = bottomQuintile.reduce((a, b) => a + b.outcome, 0) / quintileSize;
  const quintileSpread = topQuintileAvgOutcome - bottomQuintileAvgOutcome;
  
  return {
    correlationR,
    correlationR2,
    meanAbsoluteError,
    rootMeanSquaredError,
    directionalAccuracy,
    topQuintileAvgOutcome,
    bottomQuintileAvgOutcome,
    quintileSpread,
  };
}

function calculateConfidence(
  stats: BacktestStats,
  sampleSize: number,
  testEndDate: Date
): { score: number; label: string; stars: number } {
  
  // Correlation contribution (50% weight)
  // R² of 0.5+ is excellent, 0.25+ is good, 0.1+ is moderate
  const correlationScore = Math.min(100, stats.correlationR2 * 200);
  
  // Sample size contribution (30% weight)
  // 500+ is full score, scales down linearly
  const sampleSizeScore = Math.min(100, (sampleSize / 500) * 100);
  
  // Recency contribution (20% weight)
  // Full score if test ended within 3 months, decays over 12 months
  const monthsAgo = differenceInMonths(new Date(), testEndDate);
  const recencyScore = Math.max(0, 100 - (monthsAgo * 8.33));
  
  const confidence = (correlationScore * 0.5) + (sampleSizeScore * 0.3) + (recencyScore * 0.2);
  
  let label: string;
  let stars: number;
  
  if (confidence >= 85) { label = 'High'; stars = 5; }
  else if (confidence >= 70) { label = 'Good'; stars = 4; }
  else if (confidence >= 55) { label = 'Moderate'; stars = 3; }
  else if (confidence >= 40) { label = 'Low'; stars = 2; }
  else { label = 'Insufficient'; stars = 1; }
  
  return { score: confidence, label, stars };
}
```

### 7.4 Backtest Pipeline

```typescript
async function runFullBacktestPipeline(): Promise<void> {
  const geographyTypes = ['metro', 'county', 'zip'];
  const scoreTypes = ['homeready', 'investoredge', 'market_health'];
  
  // Test periods: rolling 12-month windows over past 3 years
  const testPeriods = generateTestPeriods(36, 12); // 36 months of history, 12-month windows
  
  for (const geoType of geographyTypes) {
    for (const scoreType of scoreTypes) {
      // Overall score
      for (const period of testPeriods) {
        const result = await runBacktest({
          scoreType,
          geographyType: geoType,
          testPeriodStart: period.start,
          testPeriodEnd: period.end,
        });
        
        await saveBacktestResult(result);
      }
      
      // Component-level
      const components = Object.keys(BACKTEST_OUTCOMES[scoreType]).filter(c => c !== 'overall');
      for (const component of components) {
        for (const period of testPeriods) {
          const result = await runBacktest({
            scoreType,
            componentName: component,
            geographyType: geoType,
            testPeriodStart: period.start,
            testPeriodEnd: period.end,
          });
          
          await saveBacktestResult(result);
        }
      }
    }
  }
  
  // Aggregate results into propertyiq_confidence table
  await aggregateConfidenceScores();
}

async function aggregateConfidenceScores(): Promise<void> {
  // For each score/component/geography combination, 
  // take the weighted average of recent backtest results
  await db.query(`
    INSERT INTO propertyiq_confidence (
      score_type, component_name, geography_type,
      confidence_score, confidence_label, confidence_stars,
      primary_correlation_r2, sample_size, last_backtest_date,
      correlation_contribution, sample_size_contribution, recency_contribution
    )
    SELECT 
      score_type,
      component_name,
      geography_type,
      AVG(confidence_score) as confidence_score,
      CASE 
        WHEN AVG(confidence_score) >= 85 THEN 'High'
        WHEN AVG(confidence_score) >= 70 THEN 'Good'
        WHEN AVG(confidence_score) >= 55 THEN 'Moderate'
        WHEN AVG(confidence_score) >= 40 THEN 'Low'
        ELSE 'Insufficient'
      END as confidence_label,
      CASE 
        WHEN AVG(confidence_score) >= 85 THEN 5
        WHEN AVG(confidence_score) >= 70 THEN 4
        WHEN AVG(confidence_score) >= 55 THEN 3
        WHEN AVG(confidence_score) >= 40 THEN 2
        ELSE 1
      END as confidence_stars,
      AVG(correlation_r2) as primary_correlation_r2,
      SUM(sample_size) as sample_size,
      MAX(test_period_end) as last_backtest_date,
      AVG(correlation_r2) * 50 as correlation_contribution,
      LEAST(100, SUM(sample_size) / 5) * 0.3 as sample_size_contribution,
      20 as recency_contribution -- Simplified
    FROM propertyiq_backtest_results
    WHERE created_at > NOW() - INTERVAL '6 months'
    GROUP BY score_type, component_name, geography_type
    ON CONFLICT (score_type, component_name, geography_type) 
    DO UPDATE SET
      confidence_score = EXCLUDED.confidence_score,
      confidence_label = EXCLUDED.confidence_label,
      confidence_stars = EXCLUDED.confidence_stars,
      primary_correlation_r2 = EXCLUDED.primary_correlation_r2,
      sample_size = EXCLUDED.sample_size,
      last_backtest_date = EXCLUDED.last_backtest_date,
      updated_at = NOW()
  `);
}
```

### 7.5 Scheduling Backtests

Add to GitHub workflow:

```yaml
# .github/workflows/backtest-monthly.yml
name: Monthly Backtest Pipeline

on:
  schedule:
    - cron: '0 8 1 * *'  # 1st of each month at 8 AM UTC
  workflow_dispatch:      # Allow manual trigger

jobs:
  backtest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Generate outcome measurements
        run: npm run backtest:generate-outcomes
      
      - name: Run backtest pipeline
        run: npm run backtest:run
      
      - name: Aggregate confidence scores
        run: npm run backtest:aggregate
      
      - name: Report results
        run: npm run backtest:report
```

### 7.6 API Updates for Confidence

```typescript
// Update getScore to include confidence
async function getScore(
  req: Request,
  geographyId: string,
  scoreType: string,
  expanded: boolean = false,
  historyMonths: number = 6
): Promise<ScoreResponse> {
  
  // ... existing code ...
  
  // Get geography type from the score record
  const geoType = baseScore.geography_type;
  
  // Fetch confidence for this score/geography type
  const confidence = await db.query(`
    SELECT 
      confidence_score,
      confidence_label,
      confidence_stars,
      sample_size,
      last_backtest_date
    FROM propertyiq_confidence
    WHERE score_type = $1
      AND component_name IS NULL
      AND geography_type = $2
  `, [scoreType, geoType]);
  
  response.confidence = {
    score: confidence?.confidence_score ?? 0,
    label: confidence?.confidence_label ?? 'Insufficient',
    stars: confidence?.confidence_stars ?? 1,
    sample_size: confidence?.sample_size ?? 0,
    last_backtest: confidence?.last_backtest_date?.toISOString() ?? null,
  };
  
  // If expanded, add component-level confidence
  if (expanded && response.components) {
    for (const component of response.components) {
      const componentConfidence = await db.query(`
        SELECT confidence_score, correlation_r2
        FROM propertyiq_confidence
        WHERE score_type = $1
          AND component_name = $2
          AND geography_type = $3
      `, [scoreType, component.name.toLowerCase().replace(' ', '_'), geoType]);
      
      component.confidence = {
        score: componentConfidence?.confidence_score ?? 0,
        correlation_r2: componentConfidence?.correlation_r2 ?? 0,
      };
    }
  }
  
  return response;
}
```

### 7.7 Minimum Data Requirements

For confidence scores to be meaningful:

| Geography Type | Minimum Sample Size | Minimum History |
|----------------|--------------------|-----------------| 
| Metro | 50 metros | 24 months |
| County | 200 counties | 24 months |
| ZIP | 500 ZIPs | 24 months |

If below minimums, confidence label = "Insufficient" and stars = 1.

### 7.8 Confidence Thresholds & Actions

| Confidence | Status | Action | User Display |
|------------|--------|--------|--------------|
| 70%+ | ✅ Healthy | No action needed | Show full score + confidence |
| 55-69% | ⚠️ Monitor | Flag for quarterly review, no changes yet | Show score + "Moderate confidence" |
| 40-54% | 🔶 Review Required | Analyze components, propose adjustments | Show score + "Low confidence" warning |
| < 40% | 🔴 Formula Broken | Pause score, show insufficient data, rebuild | Hide score, show "Insufficient Data" |

**Rationale:**
- **55%** = marginally better than random (50% directional accuracy is a coin flip)
- **40%** = potentially misleading users, better to show nothing than wrong information

### 7.9 Automated Alerting

```sql
-- Table to track alerts
CREATE TABLE propertyiq_confidence_alerts (
  id SERIAL PRIMARY KEY,
  score_type VARCHAR(20) NOT NULL,
  component_name VARCHAR(50),
  geography_type VARCHAR(10) NOT NULL,
  
  alert_level VARCHAR(20) NOT NULL,       -- 'monitor', 'review_required', 'broken'
  confidence_score DECIMAL(5,2) NOT NULL,
  previous_confidence DECIMAL(5,2),
  confidence_change DECIMAL(5,2),
  
  -- Diagnostic data
  correlation_r2 DECIMAL(5,4),
  directional_accuracy DECIMAL(5,4),
  quintile_spread DECIMAL(8,4),
  
  -- Status tracking
  status VARCHAR(20) DEFAULT 'open',      -- 'open', 'acknowledged', 'resolved'
  acknowledged_by VARCHAR(100),
  acknowledged_at TIMESTAMPTZ,
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_status ON propertyiq_confidence_alerts(status, alert_level);
```

```typescript
async function checkConfidenceThresholds(): Promise<ConfidenceAlert[]> {
  const alerts: ConfidenceAlert[] = [];
  
  const currentConfidence = await db.query(`
    SELECT 
      c.score_type,
      c.component_name,
      c.geography_type,
      c.confidence_score,
      c.primary_correlation_r2,
      br.directional_accuracy,
      br.quintile_spread,
      prev.confidence_score as previous_confidence
    FROM propertyiq_confidence c
    LEFT JOIN propertyiq_backtest_results br ON 
      br.score_type = c.score_type 
      AND COALESCE(br.component_name, '') = COALESCE(c.component_name, '')
      AND br.geography_type = c.geography_type
    LEFT JOIN propertyiq_confidence_history prev ON
      prev.score_type = c.score_type
      AND COALESCE(prev.component_name, '') = COALESCE(c.component_name, '')
      AND prev.geography_type = c.geography_type
  `);
  
  for (const row of currentConfidence) {
    let alertLevel: string | null = null;
    
    if (row.confidence_score < 40) {
      alertLevel = 'broken';
    } else if (row.confidence_score < 55) {
      alertLevel = 'review_required';
    } else if (row.confidence_score < 70) {
      alertLevel = 'monitor';
    }
    
    // Also alert on significant drops (>10 points)
    if (row.previous_confidence && 
        row.previous_confidence - row.confidence_score > 10) {
      alertLevel = alertLevel || 'monitor';
    }
    
    if (alertLevel) {
      alerts.push({
        scoreType: row.score_type,
        componentName: row.component_name,
        geographyType: row.geography_type,
        alertLevel,
        confidenceScore: row.confidence_score,
        previousConfidence: row.previous_confidence,
        diagnostics: {
          correlationR2: row.primary_correlation_r2,
          directionalAccuracy: row.directional_accuracy,
          quintileSpread: row.quintile_spread,
        },
      });
    }
  }
  
  return alerts;
}
```

### 7.10 Diagnostic Analysis

When confidence drops, diagnose what's failing:

```typescript
interface DiagnosticReport {
  scoreType: string;
  componentName?: string;
  
  overallHealth: {
    confidence: number;
    trend: 'improving' | 'stable' | 'declining';
  };
  
  componentBreakdown: {
    componentName: string;
    confidence: number;
    correlationR2: number;
    contribution: 'helping' | 'neutral' | 'hurting';
    recommendation: string;
  }[];
  
  metricBreakdown: {
    metricName: string;
    correlationWithOutcome: number;
    currentWeight: number;
    recommendedWeight: number;
    recommendation: string;
  }[];
}

async function generateDiagnosticReport(scoreType: string): Promise<DiagnosticReport> {
  // Component-level analysis
  const components = await db.query(`
    SELECT component_name, confidence_score, primary_correlation_r2
    FROM propertyiq_confidence
    WHERE score_type = $1 AND component_name IS NOT NULL
  `, [scoreType]);
  
  const componentBreakdown = components.map(c => ({
    componentName: c.component_name,
    confidence: c.confidence_score,
    correlationR2: c.primary_correlation_r2,
    contribution: c.confidence_score >= 70 ? 'helping' : 
                  c.confidence_score >= 55 ? 'neutral' : 'hurting',
    recommendation: getComponentRecommendation(c),
  }));
  
  // Metric-level analysis
  const metricBreakdown = await analyzeMetricCorrelations(scoreType);
  
  return { scoreType, componentBreakdown, metricBreakdown };
}

function getComponentRecommendation(component: any): string {
  if (component.confidence_score < 40) {
    return `CRITICAL: Remove or rebuild ${component.component_name}`;
  }
  if (component.confidence_score < 55) {
    return `Reduce weight or replace metrics in ${component.component_name}`;
  }
  if (component.primary_correlation_r2 < 0.1) {
    return `Low correlation - review metric selection`;
  }
  return 'No action needed';
}
```

### 7.11 Formula Version Control

Track all formula changes:

```sql
CREATE TABLE propertyiq_formula_versions (
  id SERIAL PRIMARY KEY,
  version VARCHAR(20) NOT NULL UNIQUE,    -- e.g., '2.0.0', '2.1.0'
  score_type VARCHAR(20) NOT NULL,
  
  -- Formula definition (JSON)
  formula_definition JSONB NOT NULL,
  
  -- Change metadata
  change_reason TEXT NOT NULL,
  change_type VARCHAR(20) NOT NULL,       -- 'weight_adjustment', 'metric_swap', 'component_change', 'full_rebuild'
  previous_version VARCHAR(20),
  
  -- Approval
  created_by VARCHAR(100) NOT NULL,
  approved_by VARCHAR(100),
  approved_at TIMESTAMPTZ,
  
  -- Deployment
  status VARCHAR(20) DEFAULT 'draft',     -- 'draft', 'testing', 'active', 'deprecated'
  deployed_at TIMESTAMPTZ,
  
  -- Performance tracking
  pre_change_confidence DECIMAL(5,2),
  post_change_confidence DECIMAL(5,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

```typescript
interface FormulaVersion {
  version: string;
  scoreType: string;
  formulaDefinition: {
    components: {
      name: string;
      weight: number;
      metrics: {
        name: string;
        weight: number;
        normalization: {
          type: 'minmax' | 'minmax_inverted' | 'optimal';
          params: Record<string, number>;
        };
      }[];
    }[];
  };
}

function incrementVersion(current: string, changeType: string): string {
  const [major, minor, patch] = current.split('.').map(Number);
  
  // Major: full rebuild or component structure change
  // Minor: weight adjustments or metric swaps
  // Patch: normalization range tweaks
  
  if (changeType === 'full_rebuild' || changeType === 'component_change') {
    return `${major + 1}.0.0`;
  } else if (changeType === 'weight_adjustment' || changeType === 'metric_swap') {
    return `${major}.${minor + 1}.0`;
  } else {
    return `${major}.${minor}.${patch + 1}`;
  }
}
```

### 7.12 A/B Testing Framework

Test formula changes before full deployment:

```sql
CREATE TABLE propertyiq_ab_tests (
  id SERIAL PRIMARY KEY,
  test_name VARCHAR(100) NOT NULL,
  score_type VARCHAR(20) NOT NULL,
  
  control_version VARCHAR(20) NOT NULL,   -- Current production
  treatment_version VARCHAR(20) NOT NULL, -- New formula
  
  traffic_split DECIMAL(3,2) DEFAULT 0.10, -- % using treatment
  
  status VARCHAR(20) DEFAULT 'running',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  
  -- Results
  control_confidence DECIMAL(5,2),
  treatment_confidence DECIMAL(5,2),
  statistically_significant BOOLEAN,
  p_value DECIMAL(6,5),
  winner VARCHAR(20),                      -- 'control', 'treatment', 'inconclusive'
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

```typescript
async function getFormulaForCalculation(
  scoreType: string,
  geographyId: string
): Promise<FormulaVersion> {
  
  // Check for active A/B test
  const activeTest = await db.query(`
    SELECT control_version, treatment_version, traffic_split
    FROM propertyiq_ab_tests
    WHERE score_type = $1 AND status = 'running'
  `, [scoreType]);
  
  if (activeTest) {
    // Deterministic assignment based on geography_id hash
    const hash = hashCode(geographyId);
    const useTreatment = (hash % 100) < (activeTest.traffic_split * 100);
    
    const version = useTreatment 
      ? activeTest.treatment_version 
      : activeTest.control_version;
    
    return getFormulaByVersion(scoreType, version);
  }
  
  // No A/B test, use active production version
  return getActiveFormula(scoreType);
}
```

### 7.13 Formula Adjustment Workflow

Systematic process when confidence drops:

```typescript
async function runAdjustmentWorkflow(alertId: number): Promise<void> {
  const alert = await getAlert(alertId);
  
  // 1. Run diagnostics
  const diagnosis = await generateDiagnosticReport(alert.score_type);
  
  // 2. Generate proposed changes
  const changes = generateProposedChanges(diagnosis);
  
  // 3. Create new formula version (draft)
  const newVersion = await createFormulaVersion(
    alert.score_type,
    changes,
    `Auto-adjustment: confidence dropped to ${alert.confidence_score}%`
  );
  
  // 4. Set up A/B test (unless formula is broken)
  if (alert.alert_level !== 'broken') {
    await createABTest({
      scoreType: alert.score_type,
      controlVersion: await getCurrentVersion(alert.score_type),
      treatmentVersion: newVersion.version,
      trafficSplit: 0.20,
    });
  } else {
    // For broken formulas, deploy fix immediately after review
    await flagForManualReview(newVersion);
  }
}

function generateProposedChanges(diagnosis: DiagnosticReport): FormulaChange[] {
  const changes: FormulaChange[] = [];
  
  // Reduce weight of broken components
  for (const comp of diagnosis.componentBreakdown.filter(c => c.confidence < 40)) {
    changes.push({
      type: 'adjust_weight',
      target: comp.componentName,
      newValue: 0.05, // Reduce to 5%
      reason: `Confidence ${comp.confidence}% below threshold`,
    });
  }
  
  // Reduce weight of weak components
  for (const comp of diagnosis.componentBreakdown.filter(c => c.confidence >= 40 && c.confidence < 55)) {
    changes.push({
      type: 'adjust_weight',
      target: comp.componentName,
      newValue: comp.currentWeight * 0.7, // Reduce by 30%
      reason: `Confidence ${comp.confidence}% in review range`,
    });
  }
  
  // Remove metrics with near-zero correlation
  for (const metric of diagnosis.metricBreakdown.filter(m => m.correlationWithOutcome < 0.05)) {
    changes.push({
      type: 'remove_metric',
      target: metric.metricName,
      reason: `Correlation ${metric.correlationWithOutcome} too low`,
    });
  }
  
  // Redistribute weight to strong components
  const totalReduction = calculateTotalReduction(changes);
  const strongComponents = diagnosis.componentBreakdown.filter(c => c.confidence >= 70);
  
  if (strongComponents.length > 0 && totalReduction > 0) {
    const perComponent = totalReduction / strongComponents.length;
    for (const comp of strongComponents) {
      changes.push({
        type: 'adjust_weight',
        target: comp.componentName,
        newValue: comp.currentWeight + perComponent,
        reason: 'Redistributed from underperforming components',
      });
    }
  }
  
  return changes;
}
```

### 7.14 Confidence History Tracking

```sql
CREATE TABLE propertyiq_confidence_history (
  id SERIAL PRIMARY KEY,
  score_type VARCHAR(20) NOT NULL,
  component_name VARCHAR(50),
  geography_type VARCHAR(10) NOT NULL,
  
  confidence_score DECIMAL(5,2) NOT NULL,
  correlation_r2 DECIMAL(5,4),
  formula_version VARCHAR(20),
  
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_confidence_history ON propertyiq_confidence_history(
  score_type, component_name, geography_type, recorded_at DESC
);
```

---

## Part 10: Admin Dashboard (Score Testing & Management)

A full-page admin interface for testing, visualizing, and managing PropertyIQ scores before going live.

### 10.1 Dashboard Overview

**Route:** `/admin/propertyiq-scores`

**Purpose:** Single page to test all scoring components, visualize results, run backtests, and adjust formulas.

### 10.2 Page Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PropertyIQ Score Admin Dashboard                              [Admin Only] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ GEOGRAPHY SELECTOR                                                   │   │
│  │ [Metro ▼] [Denver-Aurora-Lakewood, CO ▼]  [Search by ZIP/County...] │   │
│  │ Current: Denver-Aurora-Lakewood, CO (Metro) | Period: Jan 2026      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌───────────┬───────────┬───────────┐                                     │
│  │           │           │           │  ← SCORE BADGES (Compact View)      │
│  │    72     │    68     │    74     │                                     │
│  │  Market   │ HomeReady │ Investor  │                                     │
│  │  Health   │    🔒     │   Edge    │                                     │
│  │    ↑      │           │    ↑      │                                     │
│  └───────────┴───────────┴───────────┘                                     │
│                                                                             │
│  [Tabs: Score Cards | Backtesting | Formula Editor | Alerts | History]     │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  SCORE CARDS TAB (Default)                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Market Health Index                                     72 / 100   │   │
│  │  ↑ +5 pts vs last month                               [Light Green] │   │
│  │  Confidence: ★★★★☆ Good (78%) | Data: 92% complete                 │   │
│  │───────────────────────────────────────────────────────────────────── │   │
│  │  Demand Strength (35%)     ██████████████████░░  85                 │   │
│  │  Supply Balance (25%)      ████████████████░░░░  78                 │   │
│  │  Price Stability (25%)     ██████████████░░░░░░  68                 │   │
│  │  Economic Foundation (15%) ████████████░░░░░░░░  58  ⚠️ inherited   │   │
│  │───────────────────────────────────────────────────────────────────── │   │
│  │  [▼ Expand Metrics]                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │ Demand Strength:                                            │   │   │
│  │  │   pending_ratio: 0.42 → normalized: 85  (weight: 45%)      │   │   │
│  │  │   median_days_on_market: 38 → normalized: 82  (weight: 35%)│   │   │
│  │  │   hotness_score: 72 → normalized: 72  (weight: 20%)        │   │   │
│  │  │ ...                                                         │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │───────────────────────────────────────────────────────────────────── │   │
│  │  6-Month Trend: ▁▂▃▄▅▆ (58 → 72)                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  [Same card layout repeated for HomeReady and InvestorEdge]                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.3 Tab: Score Cards

Shows all three scores with full detail for the selected geography.

```typescript
interface ScoreCardsTabProps {
  geographyId: string;
  geographyType: string;
  periodDate: string;
}

function ScoreCardsTab({ geographyId, geographyType, periodDate }: ScoreCardsTabProps) {
  const { data: scores, loading } = useScores(geographyId, periodDate, { expanded: true });
  
  return (
    <div className="grid grid-cols-1 gap-6">
      {/* All scores shown regardless of tier - this is admin view */}
      <ScoreCard 
        scoreType="market_health" 
        data={scores.market_health}
        showMetrics={true}
        showConfidence={true}
        showRawValues={true}  // Admin-only: show raw metric values
      />
      <ScoreCard 
        scoreType="homeready" 
        data={scores.homeready}
        showMetrics={true}
        showConfidence={true}
        showRawValues={true}
      />
      <ScoreCard 
        scoreType="investoredge" 
        data={scores.investoredge}
        showMetrics={true}
        showConfidence={true}
        showRawValues={true}
      />
    </div>
  );
}
```

### 10.4 Tab: Backtesting

View and run backtests across multiple time horizons, and validate formulas against ML benchmarks.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  BACKTESTING TAB                                                            │
│                                                                             │
│  [Sub-tabs: Confidence Summary | ML Validation | Component Analysis | History]
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  CONFIDENCE SUMMARY (Default Sub-tab)                                       │
│                                                                             │
│  ┌─ Run New Backtest ─────────────────────────────────────────────────────┐ │
│  │ Score: [Market Health ▼]  Geography: [Metro ▼]                         │ │
│  │ Horizon: [6m ▼] [1y ▼] [3y ▼] [5y ▼]  ← Select multiple               │ │
│  │ Period: [2020-01-01] to [2024-12-31]                                   │ │
│  │ [ Run Backtest ]                                                       │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─ Confidence Summary by Horizon ────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  Market Health         6m      1y      3y      5y                      │ │
│  │  ─────────────────────────────────────────────────                     │ │
│  │  Metro                 78%     72%     n/a     n/a                     │ │
│  │  County                74%     68%     n/a     n/a                     │ │
│  │  ZIP                   68%     61%     n/a     n/a                     │ │
│  │                                                                        │ │
│  │  HomeReady             6m      1y      3y      5y                      │ │
│  │  ─────────────────────────────────────────────────                     │ │
│  │  Metro                 72%     75%     71%     68%                     │ │
│  │  County                68%     71%     67%     64%                     │ │
│  │  ZIP                   62%     65%     61%     58%                     │ │
│  │                                                                        │ │
│  │  InvestorEdge          6m      1y      3y      5y                      │ │
│  │  ─────────────────────────────────────────────────                     │ │
│  │  Metro                 74%     81%     78%     76%                     │ │
│  │  County                70%     77%     74%     71%                     │ │
│  │  ZIP                   64%     71%     68%     65%                     │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─ Component Breakdown: InvestorEdge @ 3y Horizon ───────────────────────┐ │
│  │                                                                        │ │
│  │  Component              Confidence  R²      Directional  Quintile     │ │
│  │  ────────────────────────────────────────────────────────────────      │ │
│  │  Cash Flow              82%         0.34    76%          +4.2%        │ │
│  │  Rent Demand            79%         0.31    74%          +3.8%        │ │
│  │  Appreciation           85%         0.38    78%          +5.1%        │ │
│  │  Entry Point            71%         0.25    69%          +2.9%        │ │
│  │  Risk                   68%         0.22    66%          +2.4%        │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.5 Tab: Backtesting → ML Validation Sub-tab

Compare your formula-based scores against ML benchmarks to identify improvement opportunities.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  BACKTESTING TAB → ML VALIDATION                                            │
│                                                                             │
│  [Sub-tabs: Confidence Summary | ML Validation | Component Analysis | History]
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  ┌─ ML Validation Settings ───────────────────────────────────────────────┐ │
│  │ Score: [HomeReady ▼]  Geography: [Metro ▼]  Horizon: [1y ▼]           │ │
│  │ Training Period: [2019-01-01] to [2023-12-31]                          │ │
│  │ Test Period: [2024-01-01] to [2024-12-31]                              │ │
│  │ ML Preset: [best_quality ▼]  Time Limit: [300] seconds                 │ │
│  │ [ Run ML Validation ]  [ Load Previous Results ▼ ]                     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─ Formula vs ML Performance ────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  HomeReady @ Metro @ 1y Horizon                     Status: ✅ Healthy │ │
│  │                                                                        │ │
│  │  ┌─────────────────┬──────────────┬──────────────┬───────────────────┐│ │
│  │  │ Metric          │ Your Formula │ AutoGluon ML │ Gap               ││ │
│  │  ├─────────────────┼──────────────┼──────────────┼───────────────────┤│ │
│  │  │ R²              │ 0.31         │ 0.34         │ +0.03 ✅ OK       ││ │
│  │  │ Directional Acc │ 71%          │ 73%          │ +2% ✅ OK         ││ │
│  │  │ MAE             │ 4.2%         │ 3.9%         │ -0.3% ✅ OK       ││ │
│  │  │ RMSE            │ 5.8%         │ 5.4%         │ -0.4% ✅ OK       ││ │
│  │  │ Top Quintile    │ +8.2%        │ +9.1%        │ +0.9% ✅ OK       ││ │
│  │  │ Bottom Quintile │ +2.1%        │ +1.8%        │ -0.3% ✅ OK       ││ │
│  │  │ Quintile Spread │ 6.1%         │ 7.3%         │ +1.2% ⚠️ Review  ││ │
│  │  └─────────────────┴──────────────┴──────────────┴───────────────────┘│ │
│  │                                                                        │ │
│  │  Gap Thresholds:                                                       │ │
│  │  ✅ OK: ML outperforms by <10% relative                               │ │
│  │  ⚠️ Review: ML outperforms by 10-25% relative                         │ │
│  │  🔴 Action Required: ML outperforms by >25% relative                  │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─ ML Feature Importance vs Your Weights ────────────────────────────────┐ │
│  │                                                                        │ │
│  │  ML Rank │ Feature              │ ML Importance │ Your Weight │ Status│ │
│  │  ────────┼──────────────────────┼───────────────┼─────────────┼───────│ │
│  │  1       │ income_gap_ratio     │ 0.23          │ 0.30 (Aff)  │ ✅    │ │
│  │  2       │ pending_ratio        │ 0.18          │ 0.25 (Mkt)  │ ✅    │ │
│  │  3       │ volatility_36m       │ 0.15          │ 0.20 (Stab) │ ✅    │ │
│  │  4       │ zhvi_5y_cagr         │ 0.12          │ 0.15 (Grw)  │ ✅    │ │
│  │  5       │ median_days_on_mkt   │ 0.09          │ 0.10 (Mkt)  │ ✅    │ │
│  │  6       │ cap_rate             │ 0.08          │ -- (None)   │ ⚠️ Missing │
│  │  7       │ zori_yoy             │ 0.06          │ -- (None)   │ ⚠️ Missing │
│  │  8       │ unemployment_rate    │ 0.05          │ 0.05 (Liv)  │ ✅    │ │
│  │  9       │ population_yoy       │ 0.03          │ 0.05 (Liv)  │ ✅    │ │
│  │  10      │ homeownership_rate   │ 0.01          │ 0.05 (Liv)  │ ⬇️ Overweight│
│  │                                                                        │ │
│  │  Legend: Component abbreviations                                       │ │
│  │  Aff=Affordability, Mkt=Market Timing, Stab=Stability,                │ │
│  │  Grw=Growth Potential, Liv=Livability                                 │ │
│  │                                                                        │ │
│  │  Insights:                                                             │ │
│  │  ⚠️ cap_rate ranked #6 by ML but not in HomeReady formula            │ │
│  │  ⚠️ zori_yoy ranked #7 by ML but not in HomeReady formula            │ │
│  │  ⬇️ homeownership_rate has low ML importance but 5% weight            │ │
│  │                                                                        │ │
│  │  [ Export Feature Analysis ] [ Suggest Weight Adjustments ]            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─ ML Suggested Weights ─────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  Based on ML feature importance, here are suggested weight changes:    │ │
│  │                                                                        │ │
│  │  Component          Current    Suggested    Change    Rationale        │ │
│  │  ─────────────────────────────────────────────────────────────────     │ │
│  │  Affordability      30%        28%          -2%       Slightly reduce  │ │
│  │  Market Timing      25%        27%          +2%       Higher ML signal │ │
│  │  Stability          20%        22%          +2%       Strong predictor │ │
│  │  Growth Potential   15%        15%          --        Well calibrated  │ │
│  │  Livability         10%        8%           -2%       Lower ML signal  │ │
│  │                                                                        │ │
│  │  Metrics to Consider Adding:                                           │ │
│  │  • cap_rate (ML importance: 0.08) → Consider for Affordability        │ │
│  │  • zori_yoy (ML importance: 0.06) → Consider for Growth Potential     │ │
│  │                                                                        │ │
│  │  [ Apply to Draft Formula ] [ Ignore Suggestions ]                     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─ Subgroup Performance Analysis ────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  How does your formula perform across different segments?              │ │
│  │                                                                        │ │
│  │  By Geography Type:                                                    │ │
│  │  ┌──────────┬────────────┬────────────┬───────────┬──────────────────┐│ │
│  │  │ Geo Type │ Formula R² │ ML R²      │ Gap       │ Sample Size      ││ │
│  │  ├──────────┼────────────┼────────────┼───────────┼──────────────────┤│ │
│  │  │ Metro    │ 0.31       │ 0.34       │ +0.03 ✅  │ 384              ││ │
│  │  │ County   │ 0.26       │ 0.31       │ +0.05 ✅  │ 1,842            ││ │
│  │  │ ZIP      │ 0.19       │ 0.28       │ +0.09 🔴  │ 12,456           ││ │
│  │  └──────────┴────────────┴────────────┴───────────┴──────────────────┘│ │
│  │                                                                        │ │
│  │  🔴 ZIP-level formula underperforms ML by 47% — consider              │ │
│  │     geography-specific weights or additional ZIP-level features       │ │
│  │                                                                        │ │
│  │  By Price Tier:                                                        │ │
│  │  ┌──────────────┬────────────┬────────────┬───────────┐               │ │
│  │  │ Price Tier   │ Formula R² │ ML R²      │ Gap       │               │ │
│  │  ├──────────────┼────────────┼────────────┼───────────┤               │ │
│  │  │ <$200K       │ 0.28       │ 0.32       │ +0.04 ✅  │               │ │
│  │  │ $200K-$500K  │ 0.33       │ 0.35       │ +0.02 ✅  │               │ │
│  │  │ $500K-$1M    │ 0.29       │ 0.34       │ +0.05 ✅  │               │ │
│  │  │ >$1M         │ 0.22       │ 0.31       │ +0.09 🔴  │               │ │
│  │  └──────────────┴────────────┴────────────┴───────────┘               │ │
│  │                                                                        │ │
│  │  🔴 High-price markets ($1M+): formula underperforms by 41%           │ │
│  │                                                                        │ │
│  │  [ Run Additional Subgroup Analysis ] [ Export Full Report ]           │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─ ML Model Details ─────────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  AutoGluon Leaderboard (Top 10):                                       │ │
│  │  ┌─────┬─────────────────────────┬──────────┬───────────┬────────────┐│ │
│  │  │Rank │ Model                   │ Score    │ Pred Time │ Fit Time   ││ │
│  │  ├─────┼─────────────────────────┼──────────┼───────────┼────────────┤│ │
│  │  │ 1   │ WeightedEnsemble_L2     │ 0.342    │ 0.45s     │ 245s       ││ │
│  │  │ 2   │ CatBoost                │ 0.338    │ 0.02s     │ 58s        ││ │
│  │  │ 3   │ LightGBM                │ 0.331    │ 0.01s     │ 12s        ││ │
│  │  │ 4   │ XGBoost                 │ 0.329    │ 0.02s     │ 34s        ││ │
│  │  │ 5   │ RandomForest            │ 0.318    │ 0.08s     │ 22s        ││ │
│  │  │ ... │ ...                     │ ...      │ ...       │ ...        ││ │
│  │  └─────┴─────────────────────────┴──────────┴───────────┴────────────┘│ │
│  │                                                                        │ │
│  │  Training Time: 312s | Test Samples: 2,847 | Features Used: 24        │ │
│  │                                                                        │ │
│  │  [ View Full Leaderboard ] [ Download Model Artifacts ]                │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.6 ML Validation Implementation

```typescript
// Types
interface MLValidationConfig {
  scoreType: 'homeready' | 'investoredge' | 'market_health';
  geographyType: string;
  horizon: PredictionHorizon;
  trainPeriodStart: string;
  trainPeriodEnd: string;
  testPeriodStart: string;
  testPeriodEnd: string;
  mlPreset: 'medium_quality' | 'best_quality' | 'high_quality';
  timeLimitSeconds: number;
}

interface MLValidationResult {
  id: string;
  config: MLValidationConfig;
  runAt: string;
  
  // Performance comparison
  formulaMetrics: {
    r2: number;
    directionalAccuracy: number;
    mae: number;
    rmse: number;
    topQuintileOutcome: number;
    bottomQuintileOutcome: number;
    quintileSpread: number;
  };
  mlMetrics: {
    r2: number;
    directionalAccuracy: number;
    mae: number;
    rmse: number;
    topQuintileOutcome: number;
    bottomQuintileOutcome: number;
    quintileSpread: number;
  };
  
  // Feature importance
  mlFeatureImportance: {
    feature: string;
    importance: number;
    currentWeight: number | null;
    component: string | null;
    status: 'aligned' | 'missing' | 'overweight' | 'underweight';
  }[];
  
  // Suggested changes
  suggestedWeights: {
    component: string;
    currentWeight: number;
    suggestedWeight: number;
    rationale: string;
  }[];
  suggestedMetrics: {
    metric: string;
    mlImportance: number;
    suggestedComponent: string;
    rationale: string;
  }[];
  
  // Subgroup analysis
  subgroupAnalysis: {
    dimension: string;
    segments: {
      name: string;
      formulaR2: number;
      mlR2: number;
      gap: number;
      sampleSize: number;
      status: 'ok' | 'review' | 'action_required';
    }[];
  }[];
  
  // AutoGluon details
  mlLeaderboard: {
    rank: number;
    model: string;
    score: number;
    predictTime: number;
    fitTime: number;
  }[];
  
  trainingTime: number;
  testSamples: number;
  featuresUsed: number;
}

// Database schema for storing ML validation results
/*
CREATE TABLE propertyiq_ml_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  score_type VARCHAR(20) NOT NULL,
  geography_type VARCHAR(10) NOT NULL,
  horizon VARCHAR(10) NOT NULL,
  
  train_period_start DATE NOT NULL,
  train_period_end DATE NOT NULL,
  test_period_start DATE NOT NULL,
  test_period_end DATE NOT NULL,
  
  ml_preset VARCHAR(20) NOT NULL,
  time_limit_seconds INTEGER NOT NULL,
  
  -- Formula metrics
  formula_r2 DECIMAL(6,4),
  formula_directional_accuracy DECIMAL(5,4),
  formula_mae DECIMAL(8,4),
  formula_rmse DECIMAL(8,4),
  formula_quintile_spread DECIMAL(8,4),
  
  -- ML metrics
  ml_r2 DECIMAL(6,4),
  ml_directional_accuracy DECIMAL(5,4),
  ml_mae DECIMAL(8,4),
  ml_rmse DECIMAL(8,4),
  ml_quintile_spread DECIMAL(8,4),
  
  -- Full results as JSON
  feature_importance JSONB,
  suggested_weights JSONB,
  suggested_metrics JSONB,
  subgroup_analysis JSONB,
  ml_leaderboard JSONB,
  
  training_time_seconds DECIMAL(8,2),
  test_samples INTEGER,
  features_used INTEGER,
  
  status VARCHAR(20) DEFAULT 'ok',  -- 'ok', 'review', 'action_required'
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ml_validations_lookup ON propertyiq_ml_validations(
  score_type, geography_type, horizon, created_at DESC
);
*/
```

### 10.7 ML Validation API Endpoints

```typescript
// POST /api/admin/ml-validation/run
// Trigger a new ML validation run
async function runMLValidation(config: MLValidationConfig): Promise<{ jobId: string }> {
  // This kicks off a background job since ML training takes time
  const jobId = await queueMLValidationJob(config);
  return { jobId };
}

// GET /api/admin/ml-validation/status/:jobId
// Check status of a running validation
async function getMLValidationStatus(jobId: string): Promise<{
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress?: number;
  result?: MLValidationResult;
  error?: string;
}> {
  return await getJobStatus(jobId);
}

// GET /api/admin/ml-validation/results
// List previous validation results
async function listMLValidations(params: {
  scoreType?: string;
  geographyType?: string;
  horizon?: string;
  limit?: number;
}): Promise<MLValidationResult[]> {
  return await db.query(`
    SELECT * FROM propertyiq_ml_validations
    WHERE ($1::text IS NULL OR score_type = $1)
      AND ($2::text IS NULL OR geography_type = $2)
      AND ($3::text IS NULL OR horizon = $3)
    ORDER BY created_at DESC
    LIMIT $4
  `, [params.scoreType, params.geographyType, params.horizon, params.limit || 20]);
}

// POST /api/admin/ml-validation/apply-suggestions/:id
// Apply ML-suggested weights to a draft formula
async function applySuggestions(
  validationId: string, 
  options: { 
    applyWeights: boolean; 
    applyMetrics: boolean;
  }
): Promise<{ draftVersion: string }> {
  const validation = await getValidation(validationId);
  
  // Create new draft formula version with suggestions applied
  const currentFormula = await getActiveFormula(validation.scoreType);
  const newFormula = applyMLSuggestions(currentFormula, validation, options);
  
  const draft = await createFormulaVersion(
    validation.scoreType,
    newFormula,
    `Applied ML suggestions from validation ${validationId}`,
    'ml_optimization'
  );
  
  return { draftVersion: draft.version };
}
```

### 10.8 ML Validation Background Job (Python)

```python
# ml_validation_job.py
# This runs as a background job, triggered by the API

import os
import json
import numpy as np
import pandas as pd
from datetime import datetime
from autogluon.tabular import TabularPredictor
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error

def run_ml_validation(config: dict) -> dict:
    """
    Run ML validation comparing formula scores against AutoGluon predictions.
    """
    
    # 1. Load data
    train_df = load_backtest_data(
        config['score_type'],
        config['geography_type'],
        config['train_period_start'],
        config['train_period_end'],
        config['horizon']
    )
    
    test_df = load_backtest_data(
        config['score_type'],
        config['geography_type'],
        config['test_period_start'],
        config['test_period_end'],
        config['horizon']
    )
    
    # 2. Define target based on horizon
    target_col = get_outcome_column(config['horizon'])  # e.g., 'zhvi_1y_change'
    
    # 3. Get feature columns (the raw metrics that go into scores)
    feature_cols = get_metrics_for_score(config['score_type'])
    
    # 4. Calculate formula-based predictions
    formula_predictions = calculate_formula_scores(
        test_df, 
        config['score_type']
    )
    
    # 5. Train AutoGluon model
    save_path = f"/tmp/autogluon/{config['score_type']}_{config['horizon']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    predictor = TabularPredictor(
        label=target_col,
        eval_metric='r2',
        path=save_path,
        verbosity=1
    )
    
    start_time = time.time()
    predictor.fit(
        train_data=train_df[feature_cols + [target_col]],
        presets=config['ml_preset'],
        time_limit=config['time_limit_seconds'],
        num_bag_folds=5,
        num_stack_levels=1
    )
    training_time = time.time() - start_time
    
    # 6. Get ML predictions
    ml_predictions = predictor.predict(test_df[feature_cols])
    
    # 7. Calculate metrics for both
    y_true = test_df[target_col].values
    
    formula_metrics = calculate_metrics(y_true, formula_predictions)
    ml_metrics = calculate_metrics(y_true, ml_predictions)
    
    # 8. Get feature importance
    fi = predictor.feature_importance(test_df[feature_cols + [target_col]], silent=True)
    feature_importance = process_feature_importance(
        fi, 
        config['score_type']
    )
    
    # 9. Run subgroup analysis
    subgroup_analysis = run_subgroup_analysis(
        test_df,
        formula_predictions,
        ml_predictions,
        y_true,
        config['geography_type']
    )
    
    # 10. Generate suggestions
    suggested_weights, suggested_metrics = generate_suggestions(
        feature_importance,
        config['score_type']
    )
    
    # 11. Get leaderboard
    lb = predictor.leaderboard(test_df[feature_cols + [target_col]], silent=True)
    ml_leaderboard = lb.head(10).to_dict(orient='records')
    
    # 12. Determine overall status
    r2_gap = ml_metrics['r2'] - formula_metrics['r2']
    relative_gap = r2_gap / max(formula_metrics['r2'], 0.01)
    
    if relative_gap > 0.25:
        status = 'action_required'
    elif relative_gap > 0.10:
        status = 'review'
    else:
        status = 'ok'
    
    # 13. Compile results
    result = {
        'config': config,
        'run_at': datetime.now().isoformat(),
        'formula_metrics': formula_metrics,
        'ml_metrics': ml_metrics,
        'feature_importance': feature_importance,
        'suggested_weights': suggested_weights,
        'suggested_metrics': suggested_metrics,
        'subgroup_analysis': subgroup_analysis,
        'ml_leaderboard': ml_leaderboard,
        'training_time': training_time,
        'test_samples': len(test_df),
        'features_used': len(feature_cols),
        'status': status
    }
    
    # 14. Save to database
    save_validation_result(result)
    
    # 15. Cleanup
    import shutil
    shutil.rmtree(save_path, ignore_errors=True)
    
    return result


def calculate_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    """Calculate all comparison metrics."""
    
    # Sort by prediction for quintile analysis
    sorted_idx = np.argsort(y_pred)[::-1]
    n = len(y_true)
    quintile_size = n // 5
    
    top_quintile_idx = sorted_idx[:quintile_size]
    bottom_quintile_idx = sorted_idx[-quintile_size:]
    
    return {
        'r2': float(r2_score(y_true, y_pred)),
        'mae': float(mean_absolute_error(y_true, y_pred)),
        'rmse': float(np.sqrt(mean_squared_error(y_true, y_pred))),
        'directional_accuracy': float(np.mean(
            (y_pred > np.median(y_pred)) == (y_true > np.median(y_true))
        )),
        'top_quintile_outcome': float(np.mean(y_true[top_quintile_idx])),
        'bottom_quintile_outcome': float(np.mean(y_true[bottom_quintile_idx])),
        'quintile_spread': float(
            np.mean(y_true[top_quintile_idx]) - np.mean(y_true[bottom_quintile_idx])
        )
    }


def process_feature_importance(fi: pd.DataFrame, score_type: str) -> list:
    """Process feature importance and compare to current weights."""
    
    current_weights = get_current_metric_weights(score_type)
    
    results = []
    for idx, row in fi.iterrows():
        feature = row['index'] if 'index' in row else idx
        importance = row['importance']
        
        current_weight = current_weights.get(feature, {}).get('weight')
        component = current_weights.get(feature, {}).get('component')
        
        # Determine status
        if current_weight is None:
            status = 'missing'
        elif importance > 0.05 and (current_weight or 0) < importance * 0.5:
            status = 'underweight'
        elif importance < 0.02 and (current_weight or 0) > 0.05:
            status = 'overweight'
        else:
            status = 'aligned'
        
        results.append({
            'feature': feature,
            'importance': float(importance),
            'current_weight': current_weight,
            'component': component,
            'status': status
        })
    
    return results


def run_subgroup_analysis(
    test_df: pd.DataFrame,
    formula_pred: np.ndarray,
    ml_pred: np.ndarray,
    y_true: np.ndarray,
    geography_type: str
) -> list:
    """Analyze performance across different subgroups."""
    
    analyses = []
    
    # By geography type (if we have multiple)
    if 'geography_type' in test_df.columns:
        geo_analysis = {'dimension': 'Geography Type', 'segments': []}
        for geo_type in test_df['geography_type'].unique():
            mask = test_df['geography_type'] == geo_type
            if mask.sum() >= 50:  # Minimum sample size
                formula_r2 = r2_score(y_true[mask], formula_pred[mask])
                ml_r2 = r2_score(y_true[mask], ml_pred[mask])
                gap = ml_r2 - formula_r2
                relative_gap = gap / max(formula_r2, 0.01)
                
                geo_analysis['segments'].append({
                    'name': geo_type,
                    'formula_r2': float(formula_r2),
                    'ml_r2': float(ml_r2),
                    'gap': float(gap),
                    'sample_size': int(mask.sum()),
                    'status': 'action_required' if relative_gap > 0.25 else 
                              'review' if relative_gap > 0.10 else 'ok'
                })
        analyses.append(geo_analysis)
    
    # By price tier
    if 'zhvi' in test_df.columns:
        price_analysis = {'dimension': 'Price Tier', 'segments': []}
        price_tiers = [
            ('< $200K', test_df['zhvi'] < 200000),
            ('$200K - $500K', (test_df['zhvi'] >= 200000) & (test_df['zhvi'] < 500000)),
            ('$500K - $1M', (test_df['zhvi'] >= 500000) & (test_df['zhvi'] < 1000000)),
            ('> $1M', test_df['zhvi'] >= 1000000)
        ]
        
        for tier_name, mask in price_tiers:
            if mask.sum() >= 50:
                formula_r2 = r2_score(y_true[mask], formula_pred[mask])
                ml_r2 = r2_score(y_true[mask], ml_pred[mask])
                gap = ml_r2 - formula_r2
                relative_gap = gap / max(formula_r2, 0.01)
                
                price_analysis['segments'].append({
                    'name': tier_name,
                    'formula_r2': float(formula_r2),
                    'ml_r2': float(ml_r2),
                    'gap': float(gap),
                    'sample_size': int(mask.sum()),
                    'status': 'action_required' if relative_gap > 0.25 else 
                              'review' if relative_gap > 0.10 else 'ok'
                })
        analyses.append(price_analysis)
    
    return analyses


def generate_suggestions(feature_importance: list, score_type: str) -> tuple:
    """Generate weight and metric suggestions based on ML analysis."""
    
    current_formula = get_current_formula(score_type)
    
    # Suggested weight changes
    suggested_weights = []
    component_importance = {}
    
    for fi in feature_importance:
        if fi['component']:
            component_importance.setdefault(fi['component'], 0)
            component_importance[fi['component']] += fi['importance']
    
    total_importance = sum(component_importance.values())
    
    for component in current_formula['components']:
        current_weight = component['weight']
        ml_suggested = component_importance.get(component['name'], 0) / total_importance
        
        # Only suggest if difference is meaningful
        diff = ml_suggested - current_weight
        if abs(diff) > 0.02:
            suggested_weights.append({
                'component': component['name'],
                'current_weight': current_weight,
                'suggested_weight': round(ml_suggested, 2),
                'rationale': 'Higher ML signal' if diff > 0 else 'Lower ML signal'
            })
    
    # Suggested new metrics
    suggested_metrics = []
    for fi in feature_importance:
        if fi['status'] == 'missing' and fi['importance'] > 0.05:
            # Suggest which component it might fit in
            suggested_component = guess_component_for_metric(fi['feature'], score_type)
            suggested_metrics.append({
                'metric': fi['feature'],
                'ml_importance': fi['importance'],
                'suggested_component': suggested_component,
                'rationale': f"Ranked #{feature_importance.index(fi)+1} by ML importance"
            })
    
    return suggested_weights, suggested_metrics
```

### 10.9 React Components for ML Validation

```typescript
// MLValidationTab.tsx
function MLValidationTab() {
  const [config, setConfig] = useState<MLValidationConfig>({
    scoreType: 'homeready',
    geographyType: 'metro',
    horizon: '1y',
    trainPeriodStart: '2019-01-01',
    trainPeriodEnd: '2023-12-31',
    testPeriodStart: '2024-01-01',
    testPeriodEnd: '2024-12-31',
    mlPreset: 'best_quality',
    timeLimitSeconds: 300,
  });
  
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<MLValidationResult | null>(null);
  const [previousResults, setPreviousResults] = useState<MLValidationResult[]>([]);
  
  // Load previous results
  useEffect(() => {
    loadPreviousResults(config.scoreType, config.geographyType, config.horizon)
      .then(setPreviousResults);
  }, [config.scoreType, config.geographyType, config.horizon]);
  
  // Poll for job status
  useEffect(() => {
    if (!jobId) return;
    
    const interval = setInterval(async () => {
      const status = await getJobStatus(jobId);
      if (status.status === 'completed') {
        setResult(status.result);
        setJobId(null);
      } else if (status.status === 'failed') {
        alert(`ML Validation failed: ${status.error}`);
        setJobId(null);
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [jobId]);
  
  const runValidation = async () => {
    const { jobId } = await fetch('/api/admin/ml-validation/run', {
      method: 'POST',
      body: JSON.stringify(config),
    }).then(r => r.json());
    
    setJobId(jobId);
  };
  
  const applySuggestions = async (applyWeights: boolean, applyMetrics: boolean) => {
    if (!result) return;
    
    const { draftVersion } = await fetch(`/api/admin/ml-validation/apply-suggestions/${result.id}`, {
      method: 'POST',
      body: JSON.stringify({ applyWeights, applyMetrics }),
    }).then(r => r.json());
    
    alert(`Created draft formula version ${draftVersion}. Go to Formula Editor to review.`);
  };
  
  return (
    <div className="space-y-6">
      <MLValidationSettings 
        config={config} 
        onChange={setConfig}
        onRun={runValidation}
        isRunning={!!jobId}
        previousResults={previousResults}
        onLoadResult={setResult}
      />
      
      {jobId && (
        <div className="p-4 bg-blue-50 rounded-lg">
          <p>⏳ ML Validation running... This may take several minutes.</p>
          <p className="text-sm text-gray-600">Job ID: {jobId}</p>
        </div>
      )}
      
      {result && (
        <>
          <FormulaVsMLComparison result={result} />
          <FeatureImportanceComparison result={result} />
          <MLSuggestedWeights 
            result={result} 
            onApply={applySuggestions}
          />
          <SubgroupAnalysis result={result} />
          <MLModelDetails result={result} />
        </>
      )}
    </div>
  );
}

// FormulaVsMLComparison.tsx
function FormulaVsMLComparison({ result }: { result: MLValidationResult }) {
  const metrics = [
    { key: 'r2', label: 'R²', format: (v: number) => v.toFixed(4) },
    { key: 'directionalAccuracy', label: 'Directional Acc', format: (v: number) => `${(v * 100).toFixed(1)}%` },
    { key: 'mae', label: 'MAE', format: (v: number) => `${v.toFixed(2)}%` },
    { key: 'rmse', label: 'RMSE', format: (v: number) => `${v.toFixed(2)}%` },
    { key: 'quintileSpread', label: 'Quintile Spread', format: (v: number) => `${v.toFixed(2)}%` },
  ];
  
  const getGapStatus = (formula: number, ml: number) => {
    const gap = ml - formula;
    const relativeGap = gap / Math.max(formula, 0.01);
    
    if (relativeGap > 0.25) return { status: 'action_required', icon: '🔴', label: 'Action Required' };
    if (relativeGap > 0.10) return { status: 'review', icon: '⚠️', label: 'Review' };
    return { status: 'ok', icon: '✅', label: 'OK' };
  };
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">
        Formula vs ML Performance
        <span className="ml-2 text-sm font-normal text-gray-500">
          {result.config.scoreType} @ {result.config.geographyType} @ {result.config.horizon}
        </span>
      </h3>
      
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Metric</th>
            <th className="text-right py-2">Your Formula</th>
            <th className="text-right py-2">AutoGluon ML</th>
            <th className="text-right py-2">Gap</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map(m => {
            const formulaVal = result.formulaMetrics[m.key];
            const mlVal = result.mlMetrics[m.key];
            const gap = mlVal - formulaVal;
            const gapStatus = getGapStatus(formulaVal, mlVal);
            
            return (
              <tr key={m.key} className="border-b">
                <td className="py-2">{m.label}</td>
                <td className="text-right py-2">{m.format(formulaVal)}</td>
                <td className="text-right py-2">{m.format(mlVal)}</td>
                <td className="text-right py-2">
                  {gap > 0 ? '+' : ''}{m.format(gap)} {gapStatus.icon}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      
      <div className="mt-4 text-sm text-gray-600">
        <p><strong>Gap Thresholds:</strong></p>
        <p>✅ OK: ML outperforms by &lt;10% relative</p>
        <p>⚠️ Review: ML outperforms by 10-25% relative</p>
        <p>🔴 Action Required: ML outperforms by &gt;25% relative</p>
      </div>
    </div>
  );
}
```

### 10.10 Automated Backtest Pipeline

Manual backtesting is impossible at scale (67,000+ geographies). Use stratified sampling with full coverage at key levels.

#### Sampling Strategy

| Geography Type | Total Count | Backtest Sample | Method | Rationale |
|----------------|-------------|-----------------|--------|-----------|
| **National** | 1 | 1 (100%) | Full | Only one, always test |
| **State** | 51 | 51 (100%) | Full | Small enough, test all |
| **Metro** | ~400 | ~400 (100%) | Full | Core product level |
| **County** | ~3,200 | 500 (16%) | Stratified | By state + population tier |
| **City** | ~30,000 | 1,000 (3%) | Stratified | By state + metro + size |
| **ZIP** | ~33,000 | 2,000 (6%) | Stratified | By metro + price tier |

**Total backtested:** ~4,000 geographies (vs 67,000+ full)  
**Time savings:** ~95%  
**Statistical validity:** 95% confidence interval ±2-3%

#### Stratified Sampling Implementation

```python
# backtest/sampling.py

from dataclasses import dataclass
from typing import List, Tuple
import pandas as pd
import numpy as np

@dataclass
class SamplingConfig:
    geography_type: str
    sample_size: int
    strata: List[Tuple[str, str]]  # (column, method: 'proportional' | 'equal' | 'oversample_low')


def create_backtest_sample(
    geography_type: str,
    sample_size: int = None,
) -> List[str]:
    """
    Create a stratified sample for backtesting.
    Returns list of geography_ids to include in backtest.
    """
    
    # Full coverage levels
    if geography_type in ['national', 'state', 'metro']:
        return get_all_geography_ids(geography_type)
    
    # Get all geographies with their attributes for stratification
    df = get_geography_attributes(geography_type)
    
    # Define sampling config by geography type
    configs = {
        'county': SamplingConfig(
            geography_type='county',
            sample_size=sample_size or 500,
            strata=[
                ('state_fips', 'proportional'),      # Proportional to county count per state
                ('population_tier', 'equal'),        # Equal across small/medium/large
                ('urban_rural', 'proportional'),     # Match actual urban/rural distribution
            ]
        ),
        'city': SamplingConfig(
            geography_type='city',
            sample_size=sample_size or 1000,
            strata=[
                ('state_fips', 'proportional'),
                ('metro_cbsa', 'proportional'),      # Ensure metro coverage
                ('population_tier', 'equal'),
            ]
        ),
        'zip': SamplingConfig(
            geography_type='zip',
            sample_size=sample_size or 2000,
            strata=[
                ('metro_cbsa', 'proportional'),      # Proportional to ZIP count per metro
                ('price_tier', 'equal'),             # Equal across price ranges
                ('data_completeness_tier', 'oversample_low'),  # Extra low-data ZIPs
            ]
        ),
    }
    
    config = configs.get(geography_type)
    if not config:
        raise ValueError(f"Unknown geography type: {geography_type}")
    
    return stratified_sample(df, config)


def stratified_sample(df: pd.DataFrame, config: SamplingConfig) -> List[str]:
    """
    Perform stratified sampling based on configuration.
    """
    
    # Add tier columns if not present
    df = add_tier_columns(df)
    
    # Build strata groups
    strata_cols = [s[0] for s in config.strata]
    df['_strata_key'] = df[strata_cols].astype(str).agg('|'.join, axis=1)
    
    # Calculate samples per stratum
    strata_counts = df['_strata_key'].value_counts()
    n_strata = len(strata_counts)
    
    # Determine allocation method
    allocation = {}
    remaining = config.sample_size
    
    for stratum, count in strata_counts.items():
        # Base allocation (proportional)
        base = int(config.sample_size * count / len(df))
        
        # Adjust based on strata methods
        for col, method in config.strata:
            if method == 'equal':
                # Equal allocation across this dimension
                unique_vals = df[col].nunique()
                base = max(base, config.sample_size // (n_strata // unique_vals))
            elif method == 'oversample_low':
                # Oversample low-data strata
                if 'low' in stratum.lower():
                    base = int(base * 1.5)
        
        allocation[stratum] = min(base, count)  # Can't sample more than available
        remaining -= allocation[stratum]
    
    # Distribute remaining samples proportionally
    if remaining > 0:
        for stratum in allocation:
            extra = int(remaining * strata_counts[stratum] / len(df))
            max_extra = strata_counts[stratum] - allocation[stratum]
            allocation[stratum] += min(extra, max_extra)
    
    # Sample from each stratum
    sampled_ids = []
    for stratum, n in allocation.items():
        stratum_df = df[df['_strata_key'] == stratum]
        if len(stratum_df) <= n:
            sampled_ids.extend(stratum_df['geography_id'].tolist())
        else:
            sampled_ids.extend(
                stratum_df.sample(n=n, random_state=42)['geography_id'].tolist()
            )
    
    return sampled_ids


def add_tier_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Add tier columns for stratification."""
    
    # Population tier
    if 'population' in df.columns:
        df['population_tier'] = pd.qcut(
            df['population'].fillna(0), 
            q=3, 
            labels=['small', 'medium', 'large']
        )
    
    # Price tier
    if 'zhvi' in df.columns:
        df['price_tier'] = pd.cut(
            df['zhvi'].fillna(df['zhvi'].median()),
            bins=[0, 200000, 500000, 1000000, float('inf')],
            labels=['under_200k', '200k_500k', '500k_1m', 'over_1m']
        )
    
    # Data completeness tier
    if 'data_completeness' in df.columns:
        df['data_completeness_tier'] = pd.cut(
            df['data_completeness'].fillna(0),
            bins=[0, 0.5, 0.8, 1.0],
            labels=['low', 'medium', 'high']
        )
    
    # Urban/rural
    if 'population_density' in df.columns:
        df['urban_rural'] = np.where(
            df['population_density'] > 1000, 'urban', 'rural'
        )
    
    return df
```

#### Automated Backtest Runner

```python
# backtest/automated_runner.py

import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Optional
import numpy as np

@dataclass
class AutomatedBacktestConfig:
    # What to test
    score_types: List[str] = field(default_factory=lambda: ['homeready', 'investoredge', 'market_health'])
    horizons: List[str] = field(default_factory=lambda: ['6m', '1y', '3y', '5y'])
    
    # Time period
    test_period_start: str = '2020-01-01'
    test_period_end: str = '2024-12-31'
    
    # Sampling config
    full_coverage_levels: List[str] = field(default_factory=lambda: ['national', 'state', 'metro'])
    county_sample_size: int = 500
    city_sample_size: int = 1000
    zip_sample_size: int = 2000
    
    # Execution config
    parallel_workers: int = 4
    batch_size: int = 100
    
    # Alert thresholds
    alert_threshold_review: float = 55.0
    alert_threshold_broken: float = 40.0


@dataclass
class BacktestRunResult:
    run_id: str
    started_at: datetime
    completed_at: Optional[datetime]
    config: AutomatedBacktestConfig
    
    # Results by score/horizon/geo_type
    results: Dict[str, Dict[str, Dict[str, dict]]]
    
    # Summary stats
    total_geographies_tested: int
    total_score_calculations: int
    duration_seconds: float
    
    # Alerts generated
    alerts: List[dict]
    
    # Overall status
    status: str  # 'healthy', 'review_needed', 'action_required'


async def run_automated_backtest(config: AutomatedBacktestConfig) -> BacktestRunResult:
    """
    Run complete automated backtest across all scores, horizons, and geographies.
    """
    
    run_id = f"backtest_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    started_at = datetime.now()
    
    results = {}
    alerts = []
    total_geos = 0
    total_calcs = 0
    
    # 1. Generate samples for each geography level
    print("Generating stratified samples...")
    samples = {}
    for geo_type in ['national', 'state', 'metro', 'county', 'city', 'zip']:
        if geo_type in config.full_coverage_levels:
            samples[geo_type] = get_all_geography_ids(geo_type)
        else:
            sample_size = getattr(config, f'{geo_type}_sample_size', 500)
            samples[geo_type] = create_backtest_sample(geo_type, sample_size)
        
        total_geos += len(samples[geo_type])
        print(f"  {geo_type}: {len(samples[geo_type])} geographies")
    
    # 2. Run backtests for each combination
    for score_type in config.score_types:
        results[score_type] = {}
        
        # Get valid horizons for this score
        valid_horizons = get_valid_horizons(score_type)
        horizons_to_test = [h for h in config.horizons if h in valid_horizons]
        
        for horizon in horizons_to_test:
            results[score_type][horizon] = {}
            
            for geo_type, geo_ids in samples.items():
                print(f"Running: {score_type} @ {horizon} @ {geo_type} ({len(geo_ids)} geos)...")
                
                # Run backtest in parallel batches
                backtest_result = await run_backtest_batch(
                    score_type=score_type,
                    horizon=horizon,
                    geography_ids=geo_ids,
                    geography_type=geo_type,
                    test_period_start=config.test_period_start,
                    test_period_end=config.test_period_end,
                    batch_size=config.batch_size,
                    parallel_workers=config.parallel_workers,
                )
                
                results[score_type][horizon][geo_type] = backtest_result
                total_calcs += backtest_result.get('sample_size', 0)
                
                # Check for alerts
                confidence = backtest_result.get('confidence', 0)
                if confidence < config.alert_threshold_broken:
                    alerts.append({
                        'level': 'broken',
                        'score_type': score_type,
                        'horizon': horizon,
                        'geography_type': geo_type,
                        'confidence': confidence,
                        'sample_size': backtest_result.get('sample_size', 0),
                    })
                elif confidence < config.alert_threshold_review:
                    alerts.append({
                        'level': 'review_required',
                        'score_type': score_type,
                        'horizon': horizon,
                        'geography_type': geo_type,
                        'confidence': confidence,
                        'sample_size': backtest_result.get('sample_size', 0),
                    })
                
                print(f"  → Confidence: {confidence:.1f}%")
    
    completed_at = datetime.now()
    duration = (completed_at - started_at).total_seconds()
    
    # Determine overall status
    if any(a['level'] == 'broken' for a in alerts):
        status = 'action_required'
    elif alerts:
        status = 'review_needed'
    else:
        status = 'healthy'
    
    result = BacktestRunResult(
        run_id=run_id,
        started_at=started_at,
        completed_at=completed_at,
        config=config,
        results=results,
        total_geographies_tested=total_geos,
        total_score_calculations=total_calcs,
        duration_seconds=duration,
        alerts=alerts,
        status=status,
    )
    
    # 3. Save results to database
    await save_backtest_run(result)
    
    # 4. Create alerts if needed
    if alerts:
        await create_confidence_alerts(alerts)
    
    # 5. Send notifications
    await send_backtest_notification(result)
    
    print(f"\nCompleted in {duration:.1f}s")
    print(f"Status: {status}")
    print(f"Alerts: {len(alerts)}")
    
    return result


async def run_backtest_batch(
    score_type: str,
    horizon: str,
    geography_ids: List[str],
    geography_type: str,
    test_period_start: str,
    test_period_end: str,
    batch_size: int = 100,
    parallel_workers: int = 4,
) -> dict:
    """
    Run backtest for a batch of geographies in parallel.
    """
    
    all_pairs = []  # (score, outcome) pairs
    
    # Process in batches
    batches = [geography_ids[i:i+batch_size] for i in range(0, len(geography_ids), batch_size)]
    
    semaphore = asyncio.Semaphore(parallel_workers)
    
    async def process_batch(batch_geo_ids):
        async with semaphore:
            return await fetch_score_outcome_pairs(
                score_type=score_type,
                horizon=horizon,
                geography_ids=batch_geo_ids,
                geography_type=geography_type,
                test_period_start=test_period_start,
                test_period_end=test_period_end,
            )
    
    # Run batches in parallel
    batch_results = await asyncio.gather(*[process_batch(b) for b in batches])
    
    for batch_pairs in batch_results:
        all_pairs.extend(batch_pairs)
    
    # Calculate statistics
    if len(all_pairs) < 50:
        return {
            'confidence': 0,
            'confidence_label': 'Insufficient',
            'confidence_stars': 1,
            'sample_size': len(all_pairs),
            'error': 'Insufficient data for backtest',
        }
    
    scores = np.array([p['score'] for p in all_pairs])
    outcomes = np.array([p['outcome'] for p in all_pairs])
    
    stats = calculate_backtest_stats(scores, outcomes)
    confidence = calculate_confidence_score(stats, len(all_pairs))
    
    return {
        'confidence': confidence['score'],
        'confidence_label': confidence['label'],
        'confidence_stars': confidence['stars'],
        'sample_size': len(all_pairs),
        'correlation_r2': stats['correlation_r2'],
        'directional_accuracy': stats['directional_accuracy'],
        'quintile_spread': stats['quintile_spread'],
        'mae': stats['mean_absolute_error'],
        'rmse': stats['root_mean_squared_error'],
        'top_quintile_outcome': stats['top_quintile_outcome'],
        'bottom_quintile_outcome': stats['bottom_quintile_outcome'],
    }


def get_valid_horizons(score_type: str) -> List[str]:
    """Get valid prediction horizons for a score type."""
    if score_type == 'market_health':
        return ['6m', '1y']  # Market Health only does short-term
    return ['6m', '1y', '3y', '5y']


# CLI entry point
if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Run automated backtest')
    parser.add_argument('--scores', type=str, default='homeready,investoredge,market_health')
    parser.add_argument('--horizons', type=str, default='6m,1y,3y,5y')
    parser.add_argument('--county-sample', type=int, default=500)
    parser.add_argument('--city-sample', type=int, default=1000)
    parser.add_argument('--zip-sample', type=int, default=2000)
    
    args = parser.parse_args()
    
    config = AutomatedBacktestConfig(
        score_types=args.scores.split(','),
        horizons=args.horizons.split(','),
        county_sample_size=args.county_sample,
        city_sample_size=args.city_sample,
        zip_sample_size=args.zip_sample,
    )
    
    asyncio.run(run_automated_backtest(config))
```

#### Database Schema for Automated Runs

```sql
-- Store automated backtest runs
CREATE TABLE propertyiq_backtest_runs (
  id VARCHAR(50) PRIMARY KEY,  -- 'backtest_20260101_020000'
  
  -- Timing
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_seconds DECIMAL(10,2),
  
  -- Config
  config JSONB NOT NULL,
  
  -- Summary
  total_geographies_tested INTEGER,
  total_score_calculations INTEGER,
  status VARCHAR(20) NOT NULL,  -- 'healthy', 'review_needed', 'action_required'
  
  -- Results (full matrix)
  results JSONB NOT NULL,
  
  -- Alerts generated
  alert_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_backtest_runs_date ON propertyiq_backtest_runs(started_at DESC);
CREATE INDEX idx_backtest_runs_status ON propertyiq_backtest_runs(status);

-- Store sample definitions for reproducibility
CREATE TABLE propertyiq_backtest_samples (
  id SERIAL PRIMARY KEY,
  run_id VARCHAR(50) REFERENCES propertyiq_backtest_runs(id),
  geography_type VARCHAR(10) NOT NULL,
  sample_size INTEGER NOT NULL,
  geography_ids TEXT[] NOT NULL,  -- Array of geography IDs in sample
  sampling_method VARCHAR(20) NOT NULL,  -- 'full', 'stratified'
  strata_config JSONB,  -- Stratification parameters used
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_backtest_samples_run ON propertyiq_backtest_samples(run_id);
```

#### GitHub Actions Workflow

```yaml
# .github/workflows/automated-backtest.yml
name: Automated Monthly Backtest

on:
  schedule:
    # Run on 1st of each month at 2 AM UTC
    - cron: '0 2 1 * *'
  workflow_dispatch:
    inputs:
      score_types:
        description: 'Scores to test (comma-separated)'
        default: 'homeready,investoredge,market_health'
        type: string
      horizons:
        description: 'Horizons to test (comma-separated)'
        default: '6m,1y,3y,5y'
        type: string
      county_sample:
        description: 'County sample size'
        default: '500'
        type: string
      zip_sample:
        description: 'ZIP sample size'
        default: '2000'
        type: string

jobs:
  backtest:
    runs-on: ubuntu-latest
    timeout-minutes: 180  # 3 hour max
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'
      
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install asyncpg aiohttp
      
      - name: Run automated backtest
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
        run: |
          python -m backtest.automated_runner \
            --scores "${{ inputs.score_types || 'homeready,investoredge,market_health' }}" \
            --horizons "${{ inputs.horizons || '6m,1y,3y,5y' }}" \
            --county-sample ${{ inputs.county_sample || '500' }} \
            --zip-sample ${{ inputs.zip_sample || '2000' }}
      
      - name: Upload results artifact
        uses: actions/upload-artifact@v4
        with:
          name: backtest-results-${{ github.run_id }}
          path: backtest_results.json
          retention-days: 90

  notify:
    needs: backtest
    runs-on: ubuntu-latest
    if: always()
    
    steps:
      - name: Send Slack notification
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
        run: |
          STATUS="${{ needs.backtest.result }}"
          if [ "$STATUS" = "success" ]; then
            EMOJI="✅"
            COLOR="good"
          else
            EMOJI="🔴"
            COLOR="danger"
          fi
          
          curl -X POST $SLACK_WEBHOOK_URL \
            -H 'Content-type: application/json' \
            -d "{
              \"attachments\": [{
                \"color\": \"$COLOR\",
                \"title\": \"$EMOJI Monthly Backtest $STATUS\",
                \"text\": \"Automated backtest completed. Check the admin dashboard for details.\",
                \"fields\": [
                  {\"title\": \"Run ID\", \"value\": \"${{ github.run_id }}\", \"short\": true},
                  {\"title\": \"Duration\", \"value\": \"~45 min\", \"short\": true}
                ]
              }]
            }"
```

#### Admin Dashboard: Automated Runs Panel

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  BACKTESTING TAB → AUTOMATED RUNS                                           │
│                                                                             │
│  [Sub-tabs: Confidence Summary | ML Validation | Automated Runs | History]  │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  ┌─ Run Automated Backtest ───────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │ Scores: [✓] HomeReady  [✓] InvestorEdge  [✓] Market Health            │ │
│  │ Horizons: [✓] 6m  [✓] 1y  [✓] 3y  [✓] 5y                              │ │
│  │                                                                        │ │
│  │ Coverage:                                                              │ │
│  │ ┌──────────────┬───────────┬─────────────┬─────────────────────────┐  │ │
│  │ │ Geography    │ Total     │ Sample Size │ Method                  │  │ │
│  │ ├──────────────┼───────────┼─────────────┼─────────────────────────┤  │ │
│  │ │ National     │ 1         │ 1 (100%)    │ Full coverage           │  │ │
│  │ │ State        │ 51        │ 51 (100%)   │ Full coverage           │  │ │
│  │ │ Metro        │ 384       │ 384 (100%)  │ Full coverage           │  │ │
│  │ │ County       │ 3,221     │ 500 (16%)   │ Stratified sample       │  │ │
│  │ │ City         │ 29,879    │ 1,000 (3%)  │ Stratified sample       │  │ │
│  │ │ ZIP          │ 33,120    │ 2,000 (6%)  │ Stratified sample       │  │ │
│  │ └──────────────┴───────────┴─────────────┴─────────────────────────┘  │ │
│  │                                                                        │ │
│  │ Total: ~3,936 geographies | Estimated time: ~45 minutes               │ │
│  │                                                                        │ │
│  │ [ Run Now ]  [ Schedule Monthly ]  [ View Sample Details ]             │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─ Recent Automated Runs ────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │ Run ID              Date        Duration  Geos     Alerts  Status      │ │
│  │ ─────────────────────────────────────────────────────────────────────  │ │
│  │ backtest_20260101   2026-01-01  47m       3,936    2       ⚠️ Review  │ │
│  │ backtest_20251201   2025-12-01  42m       3,936    0       ✅ Healthy │ │
│  │ backtest_20251101   2025-11-01  51m       3,936    1       ✅ Resolved│ │
│  │ backtest_20251001   2025-10-01  44m       3,936    0       ✅ Healthy │ │
│  │                                                                        │ │
│  │ [ View Details ] [ Compare Runs ] [ Export ]                           │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─ Latest Run: backtest_20260101 ────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │ Confidence Matrix (all scores × horizons × geo levels):                │ │
│  │                                                                        │ │
│  │ HOMEREADY            6m      1y      3y      5y                        │ │
│  │ ────────────────────────────────────────────                           │ │
│  │ National             82      84      79      75                        │ │
│  │ State                78      81      76      72                        │ │
│  │ Metro                75      78      73      69                        │ │
│  │ County               71      74      69      65                        │ │
│  │ City                 68      71      66      62                        │ │
│  │ ZIP                  62      65      60      56 ⚠️                     │ │
│  │                                                                        │ │
│  │ INVESTOREDGE         6m      1y      3y      5y                        │ │
│  │ ────────────────────────────────────────────                           │ │
│  │ National             85      88      84      81                        │ │
│  │ State                82      85      81      78                        │ │
│  │ Metro                79      82      78      75                        │ │
│  │ County               75      78      74      71                        │ │
│  │ City                 72      75      71      68                        │ │
│  │ ZIP                  68      71      67      64                        │ │
│  │                                                                        │ │
│  │ MARKET HEALTH        6m      1y                                        │ │
│  │ ────────────────────────────────                                       │ │
│  │ National             81      78                                        │ │
│  │ State                79      75                                        │ │
│  │ Metro                76      72                                        │ │
│  │ County               72      68                                        │ │
│  │ City                 69      65                                        │ │
│  │ ZIP                  64      59 ⚠️                                     │ │
│  │                                                                        │ │
│  │ ⚠️ 2 alerts: HomeReady @ ZIP @ 5y (56%), Market Health @ ZIP @ 1y (59%)│ │
│  │                                                                        │ │
│  │ [ View Full Report ] [ Download CSV ] [ View Alerts ]                  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─ Trend: Confidence Over Time ──────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  HomeReady @ Metro @ 1y                                                │ │
│  │  100% ┤                                                                │ │
│  │   80% ┤──●───●───●───●───●───●                                        │ │
│  │   60% ┤                                                                │ │
│  │   40% ┤                                                                │ │
│  │   20% ┤                                                                │ │
│  │    0% ┼─────────────────────────                                       │ │
│  │       Jul  Aug  Sep  Oct  Nov  Dec  Jan                                │ │
│  │                                                                        │ │
│  │  Stable: 76-78% over 6 months                                          │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

```typescript
// AutomatedRunsTab.tsx
interface AutomatedRunsTabProps {}

function AutomatedRunsTab({}: AutomatedRunsTabProps) {
  const [recentRuns, setRecentRuns] = useState<BacktestRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<BacktestRun | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  
  const [config, setConfig] = useState({
    scoreTypes: ['homeready', 'investoredge', 'market_health'],
    horizons: ['6m', '1y', '3y', '5y'],
    countySample: 500,
    citySample: 1000,
    zipSample: 2000,
  });
  
  useEffect(() => {
    loadRecentRuns().then(setRecentRuns);
  }, []);
  
  const runBacktest = async () => {
    setIsRunning(true);
    try {
      const { runId } = await fetch('/api/admin/backtest/automated/run', {
        method: 'POST',
        body: JSON.stringify(config),
      }).then(r => r.json());
      
      // Poll for completion
      pollForCompletion(runId);
    } catch (err) {
      alert('Failed to start backtest');
      setIsRunning(false);
    }
  };
  
  const pollForCompletion = async (runId: string) => {
    const interval = setInterval(async () => {
      const status = await fetch(`/api/admin/backtest/automated/status/${runId}`).then(r => r.json());
      
      if (status.completed) {
        clearInterval(interval);
        setIsRunning(false);
        loadRecentRuns().then(setRecentRuns);
        setSelectedRun(status.result);
      }
    }, 10000); // Check every 10 seconds
  };
  
  return (
    <div className="space-y-6">
      <AutomatedRunConfig 
        config={config}
        onChange={setConfig}
        onRun={runBacktest}
        isRunning={isRunning}
      />
      
      <RecentRunsTable 
        runs={recentRuns}
        onSelect={setSelectedRun}
      />
      
      {selectedRun && (
        <>
          <ConfidenceMatrix run={selectedRun} />
          <ConfidenceTrendChart run={selectedRun} />
          <AlertsList alerts={selectedRun.alerts} />
        </>
      )}
    </div>
  );
}
```

### 10.10 Tab: Formula Editor

View and modify score formulas, with live preview.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FORMULA EDITOR TAB                                                         │
│                                                                             │
│  ┌─ Version Control ──────────────────────────────────────────────────────┐ │
│  │ Current Active: v2.1.0  |  Draft: v2.2.0 (unsaved changes)            │ │
│  │ [ Save Draft ] [ Discard Changes ] [ View Version History ]            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  Score: [Market Health ▼]                                                   │
│                                                                             │
│  ┌─ Components ───────────────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  ┌─ Demand Strength ─────────────────────────────────────────────────┐│ │
│  │  │ Weight: [35%] ←──────●──────────────────→                         ││ │
│  │  │ Confidence: 82%  R²: 0.34                                         ││ │
│  │  │                                                                    ││ │
│  │  │ Metrics:                                                          ││ │
│  │  │ ┌──────────────────────────────────────────────────────────────┐ ││ │
│  │  │ │ pending_ratio                                                 │ ││ │
│  │  │ │ Weight: [45%] ←────●────────→                                │ ││ │
│  │  │ │ Normalization: [Standard ▼]  Min: [0.1]  Max: [0.8]         │ ││ │
│  │  │ │ Missing Strategy: [Neutral ▼]                                │ ││ │
│  │  │ │ Correlation: 0.38 ✅                                         │ ││ │
│  │  │ └──────────────────────────────────────────────────────────────┘ ││ │
│  │  │ ┌──────────────────────────────────────────────────────────────┐ ││ │
│  │  │ │ median_days_on_market                                        │ ││ │
│  │  │ │ Weight: [35%] ←──●──────────→                                │ ││ │
│  │  │ │ Normalization: [Inverted ▼]  Min: [10]  Max: [120]          │ ││ │
│  │  │ │ Missing Strategy: [Neutral ▼]                                │ ││ │
│  │  │ │ Correlation: 0.31 ✅                                         │ ││ │
│  │  │ └──────────────────────────────────────────────────────────────┘ ││ │
│  │  │ [+ Add Metric]                                                    ││ │
│  │  └────────────────────────────────────────────────────────────────────┘│ │
│  │                                                                        │ │
│  │  [Similar sections for Supply Balance, Price Stability, Economic...]  │ │
│  │                                                                        │ │
│  │  [+ Add Component]                                                     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─ Live Preview ─────────────────────────────────────────────────────────┐ │
│  │ Geography: Denver-Aurora-Lakewood, CO (Metro)                          │ │
│  │                                                                        │ │
│  │  Current Formula (v2.1.0)          Draft Formula (v2.2.0)             │ │
│  │  ┌──────────────────────┐          ┌──────────────────────┐           │ │
│  │  │  Market Health: 72   │    →     │  Market Health: 74   │           │ │
│  │  │  Demand: 85          │          │  Demand: 85          │           │ │
│  │  │  Supply: 78          │          │  Supply: 78          │           │ │
│  │  │  Price: 68           │          │  Price: 71  (+3)     │           │ │
│  │  │  Economic: 58        │          │  Economic: 61  (+3)  │           │ │
│  │  └──────────────────────┘          └──────────────────────┘           │ │
│  │                                                                        │ │
│  │  [ Test on 10 Random Geos ] [ Compare Distributions ]                  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─ Deploy ───────────────────────────────────────────────────────────────┐ │
│  │ [ Start A/B Test (20% traffic) ]  [ Deploy to Production ]             │ │
│  │ ⚠️ Warning: Production deploy requires approval                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

```typescript
interface FormulaEditorTabProps {
  initialScoreType?: string;
}

interface FormulaState {
  version: string;
  isDraft: boolean;
  components: {
    name: string;
    weight: number;
    metrics: {
      name: string;
      weight: number;
      normalization: {
        type: 'standard' | 'inverted' | 'optimal';
        min: number;
        max: number;
        optimalMin?: number;
        optimalMax?: number;
      };
      missingStrategy: 'skip' | 'neutral' | 'required';
    }[];
  }[];
}

function FormulaEditorTab({ initialScoreType }: FormulaEditorTabProps) {
  const [scoreType, setScoreType] = useState(initialScoreType || 'market_health');
  const [formula, setFormula] = useState<FormulaState | null>(null);
  const [previewGeoId, setPreviewGeoId] = useState('denver-metro');
  
  // Load current formula
  useEffect(() => {
    loadFormula(scoreType).then(setFormula);
  }, [scoreType]);
  
  const updateComponentWeight = (componentName: string, weight: number) => {
    setFormula(prev => ({
      ...prev,
      isDraft: true,
      components: prev.components.map(c => 
        c.name === componentName ? { ...c, weight } : c
      ),
    }));
  };
  
  const updateMetricWeight = (componentName: string, metricName: string, weight: number) => {
    // Similar update logic
  };
  
  const saveDraft = async () => {
    await fetch('/api/admin/formulas/draft', {
      method: 'POST',
      body: JSON.stringify({ scoreType, formula }),
    });
  };
  
  const startABTest = async () => {
    await fetch('/api/admin/ab-tests', {
      method: 'POST',
      body: JSON.stringify({
        scoreType,
        treatmentVersion: formula.version,
        trafficSplit: 0.20,
      }),
    });
  };
  
  return (
    <div className="space-y-6">
      <VersionControlBar 
        currentVersion={formula?.version}
        isDraft={formula?.isDraft}
        onSave={saveDraft}
        onDiscard={() => loadFormula(scoreType).then(setFormula)}
      />
      
      <div className="grid grid-cols-2 gap-6">
        <div>
          <ComponentEditor 
            components={formula?.components}
            onUpdateComponent={updateComponentWeight}
            onUpdateMetric={updateMetricWeight}
          />
        </div>
        <div>
          <LivePreview 
            scoreType={scoreType}
            currentFormula={/* loaded from server */}
            draftFormula={formula}
            geographyId={previewGeoId}
          />
        </div>
      </div>
      
      <DeploymentPanel 
        onStartABTest={startABTest}
        onDeploy={/* requires approval */}
      />
    </div>
  );
}
```

### 10.11 Tab: Alerts

View and manage confidence alerts.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ALERTS TAB                                                                 │
│                                                                             │
│  ┌─ Open Alerts (3) ──────────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  🔴 BROKEN: InvestorEdge @ ZIP                                        │ │
│  │     Confidence: 38% | R²: 0.08 | Since: 2026-01-10                    │ │
│  │     Component: Cash Flow (confidence: 32%)                            │ │
│  │     [ View Diagnostics ] [ Start Adjustment Workflow ] [ Acknowledge ]│ │
│  │                                                                        │ │
│  │  🔶 REVIEW: HomeReady @ County                                        │ │
│  │     Confidence: 52% | R²: 0.18 | Since: 2026-01-05                    │ │
│  │     Component: Market Timing (confidence: 45%)                        │ │
│  │     [ View Diagnostics ] [ Start Adjustment Workflow ] [ Acknowledge ]│ │
│  │                                                                        │ │
│  │  ⚠️ MONITOR: Market Health @ ZIP                                      │ │
│  │     Confidence: 62% | R²: 0.24 | Since: 2026-01-12                    │ │
│  │     Dropped 12 pts from last month                                    │ │
│  │     [ View Diagnostics ] [ Acknowledge ]                              │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─ Alert History ────────────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  Date        Alert                     Status      Resolution          │ │
│  │  ──────────────────────────────────────────────────────────            │ │
│  │  2025-12-20  Market Health @ Metro     Resolved    Formula v2.1.0     │ │
│  │  2025-11-15  InvestorEdge @ County     Resolved    Weight adjustment  │ │
│  │  ...                                                                   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.12 Tab: History

View score and confidence trends over time.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  HISTORY TAB                                                                │
│                                                                             │
│  Score: [Market Health ▼]  Geography: [Metro ▼]  Range: [Last 12 months ▼] │
│                                                                             │
│  ┌─ Score Trend ──────────────────────────────────────────────────────────┐ │
│  │  100 ┤                                                                 │ │
│  │   80 ┤            ╭──────────╮                                         │ │
│  │   60 ┤    ╭──────╯          ╰────────────────                         │ │
│  │   40 ┤───╯                                                             │ │
│  │   20 ┤                                                                 │ │
│  │    0 ┼────────────────────────────────────────────────────────────     │ │
│  │      Jan  Feb  Mar  Apr  May  Jun  Jul  Aug  Sep  Oct  Nov  Dec       │ │
│  │                                                                        │ │
│  │  ── Score   ── Confidence                                             │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─ Formula Version History ──────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  ▼ v2.1.0 (Active since 2025-12-20)                                   │ │
│  │    Change: Reduced Economic Foundation weight 20% → 15%               │ │
│  │    Reason: Low correlation with outcomes                              │ │
│  │    Result: Confidence +4%                                             │ │
│  │                                                                        │ │
│  │  ▶ v2.0.0 (2025-10-01 - 2025-12-20)                                   │ │
│  │  ▶ v1.0.0 (2025-06-01 - 2025-10-01)                                   │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.13 API Endpoints for Admin Dashboard

```typescript
// Admin API routes
const adminRoutes = {
  // Scores
  'GET /api/admin/scores/:geographyId': 'Get full score details (bypasses tier)',
  'GET /api/admin/scores/compare': 'Compare scores across geographies',
  
  // Backtesting
  'POST /api/admin/backtest/run': 'Run a new backtest',
  'GET /api/admin/backtest/results': 'Get backtest results',
  'GET /api/admin/backtest/history': 'Get backtest history',
  
  // Confidence
  'GET /api/admin/confidence/summary': 'Get confidence summary all scores',
  'GET /api/admin/confidence/:scoreType': 'Get detailed confidence breakdown',
  'GET /api/admin/confidence/history': 'Get confidence over time',
  
  // Formulas
  'GET /api/admin/formulas/:scoreType': 'Get current formula',
  'GET /api/admin/formulas/:scoreType/versions': 'Get version history',
  'POST /api/admin/formulas/draft': 'Save draft formula',
  'POST /api/admin/formulas/deploy': 'Deploy formula (requires approval)',
  'DELETE /api/admin/formulas/draft/:id': 'Discard draft',
  
  // A/B Tests
  'GET /api/admin/ab-tests': 'List A/B tests',
  'POST /api/admin/ab-tests': 'Create A/B test',
  'POST /api/admin/ab-tests/:id/stop': 'Stop A/B test',
  'GET /api/admin/ab-tests/:id/results': 'Get A/B test results',
  
  // Alerts
  'GET /api/admin/alerts': 'Get all alerts',
  'GET /api/admin/alerts/open': 'Get open alerts',
  'POST /api/admin/alerts/:id/acknowledge': 'Acknowledge alert',
  'POST /api/admin/alerts/:id/resolve': 'Resolve alert',
  
  // Preview
  'POST /api/admin/preview/score': 'Calculate score with draft formula',
  'POST /api/admin/preview/batch': 'Calculate scores for multiple geos',
};
```

### 10.14 Component Library

Reusable components for the admin dashboard:

```typescript
// Score display components
export { ScoreBadge } from './components/ScoreBadge';
export { ScoreCard } from './components/ScoreCard';
export { ScoreTrend } from './components/ScoreTrend';
export { ConfidenceStars } from './components/ConfidenceStars';
export { ComponentBar } from './components/ComponentBar';
export { MetricRow } from './components/MetricRow';

// Backtest components
export { BacktestRunner } from './components/BacktestRunner';
export { ConfidenceTable } from './components/ConfidenceTable';
export { CorrelationChart } from './components/CorrelationChart';
export { QuintileChart } from './components/QuintileChart';

// Formula editor components
export { FormulaEditor } from './components/FormulaEditor';
export { ComponentEditor } from './components/ComponentEditor';
export { MetricEditor } from './components/MetricEditor';
export { WeightSlider } from './components/WeightSlider';
export { NormalizationConfig } from './components/NormalizationConfig';
export { LivePreview } from './components/LivePreview';

// Alert components
export { AlertCard } from './components/AlertCard';
export { AlertList } from './components/AlertList';
export { DiagnosticsPanel } from './components/DiagnosticsPanel';

// History components
export { ScoreHistoryChart } from './components/ScoreHistoryChart';
export { VersionTimeline } from './components/VersionTimeline';

// Shared components
export { GeographySelector } from './components/GeographySelector';
export { DateRangePicker } from './components/DateRangePicker';
export { DataTable } from './components/DataTable';
export { TabPanel } from './components/TabPanel';
```

### 10.15 File Structure for Admin Dashboard

```
/src
  /app
    /admin
      /propertyiq-scores
        page.tsx                    # Main dashboard page
        layout.tsx                  # Admin layout wrapper
        /components
          ScoreCardsTab.tsx
          BacktestingTab.tsx
          MLValidationTab.tsx       # NEW: ML validation sub-tab
          FormulaEditorTab.tsx
          AlertsTab.tsx
          HistoryTab.tsx
  /components
    /admin
      /scores
        ScoreBadge.tsx
        ScoreCard.tsx
        ScoreTrend.tsx
        ConfidenceStars.tsx
        ComponentBar.tsx
        MetricRow.tsx
      /backtest
        BacktestRunner.tsx
        ConfidenceTable.tsx
        CorrelationChart.tsx
      /ml-validation              # NEW: ML validation components
        MLValidationSettings.tsx
        FormulaVsMLComparison.tsx
        FeatureImportanceComparison.tsx
        MLSuggestedWeights.tsx
        SubgroupAnalysis.tsx
        MLModelDetails.tsx
      /formula
        FormulaEditor.tsx
        ComponentEditor.tsx
        MetricEditor.tsx
        WeightSlider.tsx
        LivePreview.tsx
      /alerts
        AlertCard.tsx
        AlertList.tsx
        DiagnosticsPanel.tsx
      /shared
        GeographySelector.tsx
        DateRangePicker.tsx
        DataTable.tsx
  /api
    /admin
      /scores
        [geographyId]/route.ts
        compare/route.ts
      /backtest
        run/route.ts
        results/route.ts
      /ml-validation              # NEW: ML validation endpoints
        run/route.ts
        status/[jobId]/route.ts
        results/route.ts
        apply-suggestions/[id]/route.ts
      /confidence
        summary/route.ts
        [scoreType]/route.ts
      /formulas
        [scoreType]/route.ts
        draft/route.ts
        deploy/route.ts
      /ab-tests
        route.ts
        [id]/route.ts
      /alerts
        route.ts
        [id]/route.ts
  /jobs                           # NEW: Background job handlers
    ml_validation_job.py          # AutoGluon ML validation
    requirements.txt              # Python dependencies
```

### 10.16 Python Dependencies for ML Validation

```txt
# /src/jobs/requirements.txt
autogluon==1.2.0
scikit-learn>=1.3
pandas>=2.0
numpy>=1.24
psycopg2-binary>=2.9
python-dotenv>=1.0
```

### 10.17 Running ML Validation Jobs

The ML validation runs as a background job since AutoGluon training can take several minutes. Options for job execution:

**Option 1: Serverless Function (Recommended for light usage)**
- AWS Lambda with container image (for AutoGluon dependencies)
- Google Cloud Run
- Vercel Edge Functions with Python runtime

**Option 2: Background Worker (Recommended for heavy usage)**
- Redis + Bull queue with Python worker
- AWS SQS + Lambda
- Google Cloud Tasks

**Option 3: Simple API Route (Development only)**
```typescript
// /api/admin/ml-validation/run/route.ts
// NOT recommended for production - blocks the request
import { spawn } from 'child_process';

export async function POST(req: Request) {
  const config = await req.json();
  
  // Spawn Python process
  const result = await new Promise((resolve, reject) => {
    const process = spawn('python', [
      '/src/jobs/ml_validation_job.py',
      JSON.stringify(config)
    ]);
    
    let output = '';
    process.stdout.on('data', (data) => output += data);
    process.on('close', (code) => {
      if (code === 0) resolve(JSON.parse(output));
      else reject(new Error(`Process exited with code ${code}`));
    });
  });
  
  return Response.json(result);
}
```

**Recommended Architecture:**
```
┌─────────────┐     ┌─────────────┐     ┌─────────────────────┐
│   Next.js   │────▶│   Redis     │────▶│   Python Worker     │
│   API       │     │   Queue     │     │   (AutoGluon)       │
└─────────────┘     └─────────────┘     └─────────────────────┘
       │                                          │
       │                                          ▼
       │                                 ┌─────────────────────┐
       └────────────────────────────────▶│   PostgreSQL        │
                                         │   (Results)         │
                                         └─────────────────────┘
```

---

## Part 11: File Structure

---

## Part 11: File Structure

```
/src
  /scoring
    /lib
      normalization.ts          # Normalization functions
      inheritance.ts            # Geography inheritance logic
      metrics-fetcher.ts        # Fetch metrics with fallbacks
      missing-metrics.ts        # Handle missing metrics gracefully
      confidence.ts             # Confidence calculation helpers
    /scores
      homeready.ts              # HomeReady calculation
      investoredge.ts           # InvestorEdge calculation
      market-health.ts          # Market Health calculation
      types.ts                  # Shared types
    /pipeline
      scoring-pipeline.ts       # Main orchestration
      batch-processor.ts        # Process all geographies
    /backtest
      outcome-generator.ts      # Generate outcome measurements
      backtest-runner.ts        # Run backtests
      stats-calculator.ts       # Statistical calculations
      confidence-aggregator.ts  # Aggregate confidence scores
    index.ts                    # Exports
  /app
    /admin
      /propertyiq-scores
        page.tsx                # Main admin dashboard
        layout.tsx              # Admin layout
        /components             # Tab components
  /components
    /scores                     # Public score components
      ScoreBadge.tsx
      ScoreCard.tsx
      TeaserCard.tsx
    /admin                      # Admin-only components
      /scores
      /backtest
      /formula
      /alerts
  /api
    /scores
      [geographyId]/route.ts    # GET /api/scores/:geographyId
    /admin
      /scores/route.ts
      /backtest/route.ts
      /formulas/route.ts
      /ab-tests/route.ts
      /alerts/route.ts
  /db
    /migrations
      001_geography_inheritance.sql
      002_propertyiq_scores_v2.sql
      003_score_details.sql
      004_backtest_outcomes.sql
      005_backtest_results.sql
      006_confidence.sql
      007_formula_versions.sql
      008_ab_tests.sql
      009_alerts.sql
    /queries
      get-metrics.sql
      upsert-scores.sql
      get-confidence.sql
/tests
  /scoring
    normalization.test.ts
    homeready.test.ts
    investoredge.test.ts
    market-health.test.ts
    inheritance.test.ts
    missing-metrics.test.ts
  /backtest
    stats-calculator.test.ts
    confidence.test.ts
```

---

## Part 12: Deployment Checklist

1. [ ] Run database migrations (including backtest tables)
2. [ ] Populate `geography_inheritance` table
3. [ ] Backfill `metric_percentiles` table with historical distributions
4. [ ] Deploy scoring functions
5. [ ] Run full scoring pipeline for all geographies
6. [ ] Generate historical outcome measurements
7. [ ] Run initial backtest pipeline
8. [ ] Validate score distributions
9. [ ] Validate confidence scores
10. [ ] Update frontend to use new component names + confidence display
11. [ ] Update API endpoints to return new structure with confidence
12. [ ] Update GitHub workflow `post-import-refresh.yml` to call new pipeline
13. [ ] Add monthly backtest workflow

---

## Part 13: Complete Metric Reference

### Metrics Used (All Levels)

| Metric | Source Table | Column |
|--------|--------------|--------|
| `zhvi` | zillow_* | value WHERE metric_name='zhvi' |
| `zori` | zillow_* | value WHERE metric_name='zori' |
| `zhvi_yoy` | calculated_metrics | zhvi_yoy |
| `zori_yoy` | calculated_metrics | zori_yoy |
| `zhvi_5y_cagr` | calculated_metrics | zhvi_5y_cagr |
| `volatility_36m` | calculated_metrics | volatility_36m |
| `median_days_on_market` | realtor_* | median_days_on_market |
| `active_listing_count_yy` | realtor_* | active_listing_count_yy |
| `new_listing_count_yy` | realtor_* | new_listing_count_yy |
| `pending_listing_count_yy` | realtor_* | pending_listing_count_yy |
| `pending_ratio` | realtor_* | pending_ratio |
| `price_reduced_share` | realtor_* | price_reduced_share |
| `hotness_score` | realtor_* | hotness_score |
| `sale_to_list_ratio` | zillow_* | mean_ratio |
| `median_household_income` | census_* | median_household_income |
| `income_yoy` | census_* | income_yoy |
| `population_yoy` | census_* | population_yoy |
| `homeownership_rate` | census_* | homeownership_rate |
| `median_age` | census_* | median_age |
| `renter_occupied_units` | census_* | renter_occupied_units |
| `total_housing_units` | census_* | total_housing_units |
| `rent_as_pct_of_income` | census_* | rent_as_pct_of_income |
| `income_gap_ratio` | calculated_metrics | income_gap_ratio |
| `years_to_save` | calculated_metrics | years_to_save |
| `months_of_supply` | calculated_metrics | months_of_supply |
| `overvalued_pct` | calculated_metrics | overvalued_pct |
| `inventory_surplus_pct` | calculated_metrics | inventory_surplus_pct |
| `cap_rate` | calculated_metrics | cap_rate |
| `grm` | calculated_metrics | grm |
| `gross_yield` | calculated_metrics | gross_yield |
| `rent_to_price_ratio` | calculated_metrics | rent_to_price_ratio |

### Metrics Requiring Inheritance

| Metric | Source Table | Available Levels |
|--------|--------------|------------------|
| `unemployment_rate` | economic_* | National, State, Metro, County |
| `employment_yoy` | economic_* | National, State, Metro, County |
| `large_multi_permits_yoy` | permits_* | National, State, Metro, County |
| `hud_fmr_2br` | hud_fmr | County only |

---

*End of Implementation Guide*
