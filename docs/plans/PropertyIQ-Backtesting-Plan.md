# PropertyIQ Score Backtesting Plan

## Objective
Validate PropertyIQ scores by comparing **past predictions to actual market performance**:
- If InvestorEdge was HIGH 12 months ago → did that market **outperform its benchmark**?
- If InvestorEdge was LOW 12 months ago → did that market **underperform its benchmark**?
- Same for HomeReady scores and homebuyer conditions

**Key Question:** Do high scores predict **benchmark-beating** performance?

**Why Benchmarking Matters:**
Raw returns are meaningless without context. If the US market rose 18%, a 15% return actually **underperformed**.
- OLD (Naive): "Did high scores have positive returns?"
- NEW (Benchmark-Adjusted): "Did high scores **beat their benchmarks**?"

## Score-Specific Outcome Definitions

Each score type predicts different outcomes:

| Score | What It Predicts | Primary Outcome Metric | Secondary Metrics |
|-------|------------------|------------------------|-------------------|
| **InvestorEdge** | Good investor returns | ZHVI appreciation | Rent growth (ZORI), Yield stability |
| **HomeReady** | Favorable buyer conditions | Price stability (low volatility) | Affordability trend, DOM stability |
| **Market Health** | Overall market strength | Balanced appreciation | Inventory levels, DOM trends |

### InvestorEdge Validation
- High score → Should see **above-median appreciation + positive rent growth**
- Metric: `(future_zhvi - past_zhvi) / past_zhvi`

### HomeReady Validation
- High score → Should see **stable prices, improving affordability**
- Metric: Price volatility (std dev of monthly changes), Affordability index trend

### Market Health Validation
- High score → Should see **healthy appreciation without overheating**
- Metric: Appreciation within 3-8% annual range, stable inventory

## Benchmark Methodology

### Three Benchmark Levels
Each geography gets **three benchmarks** for comprehensive evaluation:

| Benchmark | Definition | Use Case |
|-----------|------------|----------|
| **National** | US-wide average for that metric | Cross-country investment comparison |
| **Regional** | Parent geography average (ZIP→Metro, County→State) | Local market selection |
| **Peer Group** | Similar geographies (price tier + density + region) | Apples-to-apples comparison |

### Peer Group Definition (720 groups)
Peer groups cluster similar geographies for fair comparison:

| Dimension | Tiers | Values |
|-----------|-------|--------|
| **Price Tier** | 5 | <$150K, $150-300K, $300-500K, $500K-1M, >$1M |
| **Population Density** | 3 | Rural (<500/sq mi), Suburban (500-3000), Urban (>3000) |
| **Region** | 4 | Northeast, Midwest, South, West |
| **Metro Size** | 4 | Small (<250K), Medium (250K-1M), Large (1-5M), Major (>5M) |
| **Growth Trend** | 3 | Declining, Stable, Growing (5yr population change) |

**Peer Group ID Format:** `3-U-MW-X-G` = $300-500K, Urban, Midwest, Major metro, Growing

### Benchmark Weights by Score Type
Different scores emphasize different benchmarks:

| Score | National | Regional | Peer | Primary Rationale |
|-------|----------|----------|------|-------------------|
| **HomeReady** | 20% | **50%** | 30% | Homebuyers compare within their target region |
| **InvestorEdge** | 20% | 30% | **50%** | Investors compare similar investment profiles |
| **Market Health** | **50%** | 30% | 20% | Market health is relative to overall US conditions |

### Excess Return Calculation
```
excess_return_vs_national = raw_appreciation - national_avg
excess_return_vs_regional = raw_appreciation - metro_avg
excess_return_vs_peer = raw_appreciation - peer_median
```

**Example: ZIP 60601 (Chicago Loop) - 1yr outcomes**
```
National avg: +5.2%
Regional (Chicago Metro) avg: +4.8%
Peer Group (Urban, $400-600K, Midwest, Major) median: +5.5%
ZIP 60601 actual: +7.1%

Excess Returns:
  vs National: +1.9%  ✓ outperformed
  vs Regional: +2.3%  ✓ outperformed
  vs Peer: +1.6%      ✓ outperformed
```

## Current State
- **~3.6M historical scores** already calculated in `propertyiq_scores_history` (July 2016 - Nov 2025)
- **Zillow ZHVI/ZORI data** available (2000-2025) for calculating actual appreciation
- **Census ACS data** available for peer group assignment (population, income, density)
- **Need to**:
  1. Assign peer groups to all geographies
  2. Calculate benchmark averages for each period
  3. Calculate excess returns (raw - benchmark)
  4. Run analysis on excess returns instead of raw returns

## Backtest Windows (Test Different Market Conditions)

| Window | Score Date | Tests | Available Horizons |
|--------|------------|-------|-------------------|
| Pre-COVID | Jan 2018 | Normal market | 1y, 3y, 5y ✓ |
| COVID Entry | Jan 2020 | Major disruption | 1y, 3y, 5y ✓ |
| Post-COVID Boom | Jan 2021 | Rapid appreciation | 1y, 3y ✓ |
| Rate Hike | Jan 2022 | Market correction | 1y, 3y ✓ |
| Recent | Jan 2024 | Current conditions | 1y ✓ |

## Data Available for Backtesting

| Horizon | Score Date | Outcome Date | Feasibility |
|---------|------------|--------------|-------------|
| 1 year  | 2024-11    | 2025-11      | Full data available |
| 3 years | 2022-11    | 2025-11      | Full data available |
| 5 years | 2020-11    | 2025-11      | Full data available |
| 10 years| 2015-11    | 2025-11      | Limited (scores start 2016-07) |

## Implementation Plan

### Phase 1: Schema Extensions ✓ DONE
Add columns for longer horizons (already completed):
```sql
ALTER TABLE propertyiq_scores_history
ADD COLUMN actual_appreciation_36m NUMERIC(6,3),
ADD COLUMN actual_appreciation_60m NUMERIC(6,3),
ADD COLUMN actual_appreciation_120m NUMERIC(6,3);
```

### Phase 2: Peer Group Assignment (NEW)
Script: `scripts/assign-peer-groups.ts`

**Schema addition:**
```sql
-- Add peer group columns to history table
ALTER TABLE propertyiq_scores_history
ADD COLUMN peer_group_id VARCHAR(20),
ADD COLUMN parent_geography_id VARCHAR(20);

-- Create peer group lookup table
CREATE TABLE backtest_peer_groups (
  peer_group_id VARCHAR(20) PRIMARY KEY,
  price_tier INTEGER,       -- 1-5
  density_tier VARCHAR(1),  -- R/S/U
  region VARCHAR(2),        -- NE/MW/SO/WE
  metro_size VARCHAR(1),    -- S/M/L/X
  growth_trend VARCHAR(1),  -- D/S/G
  description TEXT
);
```

**Peer group assignment logic:**
```typescript
function assignPeerGroup(geo: Geography): string {
  const priceTier = geo.zhvi < 150000 ? '1' :
                    geo.zhvi < 300000 ? '2' :
                    geo.zhvi < 500000 ? '3' :
                    geo.zhvi < 1000000 ? '4' : '5';

  const density = geo.pop_density < 500 ? 'R' :
                  geo.pop_density < 3000 ? 'S' : 'U';

  const region = ['09','23','25','33','44','50','34','36','42'].includes(geo.state_fips) ? 'NE' :
                 ['17','18','19','20','26','27','29','31','38','39','46','55'].includes(geo.state_fips) ? 'MW' :
                 ['01','05','10','11','12','13','21','22','24','28','37','40','45','47','48','51','54'].includes(geo.state_fips) ? 'SO' : 'WE';

  const metroSize = geo.metro_pop < 250000 ? 'S' :
                    geo.metro_pop < 1000000 ? 'M' :
                    geo.metro_pop < 5000000 ? 'L' : 'X';

  const growth = geo.pop_5y_change < -0.02 ? 'D' :
                 geo.pop_5y_change > 0.05 ? 'G' : 'S';

  return `${priceTier}-${density}-${region}-${metroSize}-${growth}`;
}
```

### Phase 3: Benchmark Calculation (NEW)
Script: `scripts/calculate-benchmarks.ts`

**Schema:**
```sql
-- National benchmarks (one per period/horizon)
CREATE TABLE backtest_benchmarks (
  score_date DATE NOT NULL,
  horizon VARCHAR(5) NOT NULL,  -- '12m', '36m', '60m'
  geography_type VARCHAR(10) NOT NULL,
  national_avg_appreciation NUMERIC(8,5),
  national_median_appreciation NUMERIC(8,5),
  sample_count INTEGER,
  PRIMARY KEY (score_date, horizon, geography_type)
);

-- Regional benchmarks (per parent geography)
CREATE TABLE backtest_regional_benchmarks (
  score_date DATE NOT NULL,
  horizon VARCHAR(5) NOT NULL,
  parent_geography_id VARCHAR(20) NOT NULL,
  avg_appreciation NUMERIC(8,5),
  median_appreciation NUMERIC(8,5),
  child_count INTEGER,
  PRIMARY KEY (score_date, horizon, parent_geography_id)
);

-- Peer benchmarks (per peer group)
CREATE TABLE backtest_peer_benchmarks (
  score_date DATE NOT NULL,
  horizon VARCHAR(5) NOT NULL,
  peer_group_id VARCHAR(20) NOT NULL,
  median_appreciation NUMERIC(8,5),
  p25_appreciation NUMERIC(8,5),
  p75_appreciation NUMERIC(8,5),
  peer_count INTEGER,
  PRIMARY KEY (score_date, horizon, peer_group_id)
);
```

### Phase 4: Excess Return Calculation (NEW)
Script: `scripts/calculate-excess-returns.ts`

**Add columns to history table:**
```sql
ALTER TABLE propertyiq_scores_history
ADD COLUMN excess_return_vs_national_12m NUMERIC(8,5),
ADD COLUMN excess_return_vs_regional_12m NUMERIC(8,5),
ADD COLUMN excess_return_vs_peer_12m NUMERIC(8,5),
ADD COLUMN excess_return_vs_national_36m NUMERIC(8,5),
ADD COLUMN excess_return_vs_regional_36m NUMERIC(8,5),
ADD COLUMN excess_return_vs_peer_36m NUMERIC(8,5);
```

**Calculation:**
```typescript
excess_return_vs_national = actual_appreciation - national_avg
excess_return_vs_regional = actual_appreciation - regional_avg
excess_return_vs_peer = actual_appreciation - peer_median
```

### Phase 5: Raw Outcome Population ✓ IN PROGRESS
Script: `scripts/populate-backtest-outcomes.ts`

**Example - InvestorEdge Backtest (1 year):**
```
Score Date: Jan 2024
Geography: Austin TX Metro (CBSA 12420)
InvestorEdge Score: 72 (high - predicted good investor returns)

Actual Outcome:
- ZHVI Jan 2024: $450,000
- ZHVI Jan 2025: $485,000
- Actual Appreciation: +7.8%

Verdict: Score of 72 predicted high performance → 7.8% return ✓
```

**Logic:**
1. For each historical score record:
   - Get `geography_id`, `geography_type`, `period_date` (the prediction date)
   - Lookup ZHVI at `period_date` (starting value)
   - Lookup ZHVI at `period_date + 12/36/60/120 months` (ending value)
   - Calculate what ACTUALLY happened: `(future_zhvi - past_zhvi) / past_zhvi`
   - Store this actual outcome alongside the score that predicted it

**Join mapping (Zillow tables use long format with metric_name):**
```sql
-- State: geography_id = zillow_state.state_code WHERE metric_name = 'zhvi'
-- Metro: geography_id = zillow_metro.cbsa_code WHERE metric_name = 'zhvi'
-- County: geography_id = zillow_county.fips_code WHERE metric_name = 'zhvi'
-- ZIP: geography_id = zillow_zip.region_name WHERE metric_name = 'zhvi'
```

**Note:** Zillow ZORI (rent data) available for HomeReady validation:
```sql
WHERE metric_name = 'zori'  -- Zillow Observed Rent Index
```

### Phase 6: Benchmark-Adjusted Analysis (UPDATED)
Script: `scripts/run-backtest-analysis.ts`

**Key Change:** All analysis now uses **excess returns** instead of raw returns.

**For each timeframe (1yr, 3yr, 5yr):**

1. **Correlation Analysis (Benchmark-Adjusted)**
   - Pearson correlation: score vs **excess return** (not raw appreciation)
   - Spearman rank correlation: score ranking vs excess return ranking

2. **Quintile Analysis (Benchmark-Adjusted)**
   - Split geographies into 5 groups by score
   - Compare average **excess return** by quintile
   - **Key validation:**
     - Top quintile should have **positive** excess (beat benchmark)
     - Bottom quintile should have **negative** excess (trailed benchmark)

3. **Directional Accuracy (Benchmark-Adjusted)**
   - What % of "high score" (>median) geographies had **positive excess return**?
   - What % of "low score" (<median) geographies had **negative excess return**?
   - OLD: Did high scores have positive returns?
   - NEW: Did high scores **beat their benchmarks**?

4. **Weighted Score Analysis**
   - Apply benchmark weights by score type:
     - HomeReady: 20% national, 50% regional, 30% peer
     - InvestorEdge: 20% national, 30% regional, 50% peer
     - Market Health: 50% national, 30% regional, 20% peer
   - Calculate weighted excess return for each score type

### Phase 7: Generate Backtest Report

**The key validation (BENCHMARK-ADJUSTED):**
- **Top Quintile**: Highest scores → should have **positive excess returns** (beat benchmark)
- **Bottom Quintile**: Lowest scores → should have **negative excess returns** (trailed benchmark)
- **Quintile Spread**: Difference in excess returns between top and bottom

**Output format (Updated):**
```
═══════════════════════════════════════════════════════════════════════════════
  PROPERTYIQ BACKTEST REPORT - Benchmark-Adjusted Analysis
═══════════════════════════════════════════════════════════════════════════════

INVESTOREDGE SCORE - Did high scores beat their benchmarks?
───────────────────────────────────────────────────────────────────────────────
                        │ Top 20%   │ Bottom 20% │ Spread  │ Top Beat? │ Bot Trail?
Horizon  │ Benchmark    │ Excess    │ Excess     │         │           │
─────────┼──────────────┼───────────┼────────────┼─────────┼───────────┼───────────
1 year   │ National     │  +3.1%    │   -2.4%    │  5.5%   │    ✓      │    ✓
1 year   │ Regional     │  +2.8%    │   -1.9%    │  4.7%   │    ✓      │    ✓
1 year   │ Peer Group   │  +2.2%    │   -1.5%    │  3.7%   │    ✓      │    ✓
1 year   │ WEIGHTED     │  +2.4%    │   -1.7%    │  4.1%   │    ✓      │    ✓
─────────┼──────────────┼───────────┼────────────┼─────────┼───────────┼───────────
3 years  │ WEIGHTED     │  +8.2%    │   -5.3%    │ 13.5%   │    ✓      │    ✓
5 years  │ WEIGHTED     │ +14.1%    │   -8.7%    │ 22.8%   │    ✓      │    ✓

Interpretation:
✓ VALIDATED: High InvestorEdge scores beat their benchmarks by 2-14%
✓ VALIDATED: Low InvestorEdge scores trailed their benchmarks by 2-9%
Confidence Grade: A (Strong predictive power)
```

**Benchmark-Adjusted Success Criteria:**
| Metric | Old (Raw) | New (Benchmark-Adjusted) |
|--------|-----------|--------------------------|
| Directional Accuracy | High score → positive return | High score → **positive excess** |
| Quintile Spread | Top return - Bottom return | Top excess - Bottom excess |
| R² | Correlation with return | Correlation with **excess return** |

## Files to Create/Modify

### Phase 1-5 (Raw Outcomes) - IN PROGRESS
1. ✅ `scripts/migrations/046-add-backtest-horizon-columns.sql` - Add outcome columns
2. ✅ `scripts/populate-backtest-outcomes.ts` - Populate raw appreciation from Zillow
3. ✅ `scripts/run-backtest-analysis.ts` - Analysis script (needs benchmark update)

### Phase 2-4 (Benchmarking) - NEW
4. **NEW**: `scripts/migrations/047-add-benchmark-tables.sql`
   - Create `backtest_peer_groups` table
   - Create `backtest_benchmarks` table (national)
   - Create `backtest_regional_benchmarks` table
   - Create `backtest_peer_benchmarks` table
   - Add `peer_group_id`, `parent_geography_id` to history table
   - Add excess return columns to history table

5. **NEW**: `scripts/assign-peer-groups.ts`
   - Assign peer_group_id to each geography based on 5 dimensions
   - Requires: ZHVI (price tier), population density, state FIPS (region), metro population, 5yr pop change

6. **NEW**: `scripts/calculate-benchmarks.ts`
   - Calculate national avg appreciation per period/horizon
   - Calculate regional (metro) avg appreciation per period/horizon
   - Calculate peer group median appreciation per period/horizon

7. **NEW**: `scripts/calculate-excess-returns.ts`
   - For each history record: excess = raw - benchmark
   - Calculate for all 3 benchmark types

8. **MODIFY**: `scripts/run-backtest-analysis.ts`
   - Update to use excess returns instead of raw returns
   - Add weighted analysis by score type
   - Add benchmark-specific reporting

## Confidence Scoring Methodology

Each score type receives a **Confidence Grade** based on backtest performance:

| Metric | Weight | Description |
|--------|--------|-------------|
| **R² (Coefficient of Determination)** | 30% | How much variance in outcomes is explained by score |
| **Directional Accuracy** | 30% | % of times score correctly predicted above/below median |
| **Quintile Spread** | 25% | Difference between Q5 (top) and Q1 (bottom) outcomes |
| **Consistency Across Windows** | 15% | Similar performance in different market conditions |

### Confidence Thresholds
| Grade | Combined Score | Interpretation |
|-------|---------------|----------------|
| **A** | ≥ 0.75 | Strong predictive power - highlight to users |
| **B** | 0.60 - 0.74 | Good predictive power - reliable for decisions |
| **C** | 0.45 - 0.59 | Moderate predictive power - use with caution |
| **D** | 0.30 - 0.44 | Weak predictive power - needs improvement |
| **F** | < 0.30 | Poor predictive power - do not use |

## Stratified Sampling (for large datasets)

Given ~3.6M historical scores, use stratified sampling for analysis:
- Sample by geography type (state/metro/county/zip)
- Sample by score quintile (ensure all score ranges represented)
- Sample by time period (ensure all market conditions represented)
- Target: 100,000 records per analysis run

## Verification

### Success Criteria (Benchmark-Adjusted)
| Metric | Minimum Threshold | Target | Description |
|--------|-------------------|--------|-------------|
| R² (Excess Returns) | > 0.05 | > 0.15 | % variance explained by score |
| Directional Accuracy (Excess) | > 55% | > 65% | High score → positive excess |
| Quintile Spread (Excess) | > 2% (1yr) | > 4% (1yr) | Top excess - Bottom excess |
| Top Quintile Excess | > 0% | > +2% | Must beat benchmark |
| Bottom Quintile Excess | < 0% | < -2% | Must trail benchmark |
| P-value | < 0.05 | < 0.01 | Statistical significance |
| Benchmark Consistency | > 60% | > 80% | Similar across all 3 benchmarks |

### Validation Steps
1. **Raw Outcomes**: Populate raw appreciation and verify counts
2. **Peer Groups**: Assign peer groups and verify distribution (~720 groups, min 10 per group)
3. **Benchmarks**: Calculate all 3 benchmark types for each period
4. **Excess Returns**: Calculate and verify distribution (should be ~normal, centered near 0)
5. **Quintile Validation**:
   - Top quintile should have **positive** weighted excess return
   - Bottom quintile should have **negative** weighted excess return
6. **Market Window Check**: Results consistent across Pre-COVID, COVID, Boom, Rate Hike periods
7. **Benchmark Comparison**: Results similar across national, regional, peer benchmarks
8. **Spot Checks**: Manually verify Austin TX, LA County, Beverly Hills ZIP
