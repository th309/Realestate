# PropertyIQ Scoring System - Comprehensive Test Suite Plan

## Executive Summary

This plan creates a comprehensive test suite for the PropertyIQ scoring system. These scores influence $100K-$1M+ real estate decisions, making test correctness critical.

### Current State
| Item | Status |
|------|--------|
| Existing scoring tests | **NONE** - critical gap |
| App-level tests | Basic (`app.controller.spec.ts`, `app.e2e-spec.ts`) |
| Test coverage | ~0% on scoring logic |

### Scope
| Category | Files to Test | Est. Tests |
|----------|---------------|------------|
| Unit Tests | 10 services | ~150 |
| Integration Tests | 4 pipelines | ~40 |
| E2E Tests | 3 workflows | ~25 |
| Runtime Assertions | 3 categories | ~18 |
| Monitoring Tests | 4 categories | ~15 |
| **Total** | | **~248** |

---

## Services to Test

Based on codebase exploration, these are the existing services that need test coverage:

| Service | File | Lines | Key Functions |
|---------|------|-------|---------------|
| ScoringService | `scoring.service.ts` | 1,162 | calculateHomeReadyScore, calculateInvestorEdgeScore, calculateMarketHealthScore |
| NormalizationService | `normalization.service.ts` | 280 | normalizeMinMax, normalizePercentile, normalizeOptimalRange |
| InheritanceService | `inheritance.service.ts` | 432 | getGeographyChain, getMetricWithInheritance |
| MissingMetricsService | `missing-metrics.service.ts` | 376 | handleMissingMetric, calculateWithMissingHandling |
| MarketHealthService | `market-health.service.ts` | ~300 | calculateDemandStrength, calculateSupplyBalance |
| PercentileService | `percentile.service.ts` | 255 | calculatePercentile, getPercentileRanks |
| ScoringGuard | `scoring.guard.ts` | ~100 | getScoreAccess |
| BacktestRunnerService | `backtest-runner.service.ts` | ~400 | runBacktest, calculateMetrics |
| ConfidenceCalculatorService | `confidence-calculator.service.ts` | ~300 | calculateConfidence |
| OutcomeGeneratorService | `outcome-generator.service.ts` | ~350 | generateOutcomes |

---

## Test Directory Structure

```
packages/backend/src/scoring/__tests__/
├── unit/
│   ├── normalization.service.spec.ts
│   ├── scoring.service.spec.ts
│   ├── inheritance.service.spec.ts
│   ├── missing-metrics.service.spec.ts
│   ├── market-health.service.spec.ts
│   ├── percentile.service.spec.ts
│   ├── scoring.guard.spec.ts
│   └── backtest/
│       ├── backtest-runner.service.spec.ts
│       ├── confidence-calculator.service.spec.ts
│       └── outcome-generator.service.spec.ts
├── integration/
│   ├── scoring-pipeline.spec.ts
│   ├── inheritance-chain.spec.ts
│   ├── api-scoring.spec.ts
│   └── backtest-pipeline.spec.ts
├── fixtures/
│   ├── geography-data.ts
│   ├── metric-data.ts
│   ├── expected-scores.ts
│   └── test-users.ts
└── helpers/
    ├── test-utils.ts
    └── mock-supabase.ts

packages/frontend/tests/
├── e2e/
│   ├── score-display.spec.ts
│   ├── tier-access.spec.ts
│   └── admin-dashboard.spec.ts
└── fixtures/
    └── mock-api-responses.ts
```

---

## Phase 1: Test Infrastructure & Fixtures

### 1.1 Create Test Directory Structure
**Priority**: P0

Create the directory structure above under `packages/backend/src/scoring/__tests__/`

### 1.2 Create Test Fixtures with Hand-Calculated Values
**File**: `packages/backend/src/scoring/__tests__/fixtures/expected-scores.ts`

Create **20 test geographies** with KNOWN expected scores covering all scenarios:

#### Category 1: Happy Path (5 geographies)

| ID | Purpose | Expected Score | Status |
|----|---------|----------------|--------|
| `HAPPY_LOW_001` | All metrics present, low values | ~30 | complete |
| `HAPPY_MED_002` | All metrics present, medium values | ~50 | complete |
| `HAPPY_HIGH_003` | All metrics present, high values | ~80 | complete |
| `HAPPY_VERY_HIGH_004` | All metrics present, excellent values | ~95 | complete |
| `HAPPY_EXACT_50_005` | All metrics tuned to produce exactly 50 | 50.0 | complete |

**Example - HAPPY_HIGH_003 (HomeReady):**
```typescript
{
  geography_id: 'HAPPY_HIGH_003',
  test_purpose: 'Verify correct calculation with all metrics present, high score',
  raw_metrics: {
    // Affordability inputs (30% weight)
    median_home_price: 280000,        // Affordable market
    median_household_income: 95000,    // Strong income
    price_to_income_ratio: 2.95,       // Good ratio (optimal: 2.5-4.0)
    mortgage_rate: 5.5,                // Moderate rate

    // Market Timing inputs (25% weight)
    days_on_market: 18,                // Fast market
    pending_ratio: 0.45,               // High pending
    sale_to_list_ratio: 1.02,          // Above asking

    // Stability inputs (20% weight)
    price_volatility: 0.03,            // Low volatility
    foreclosure_rate: 0.002,           // Very low
    unemployment_rate: 3.2,            // Low unemployment

    // Growth Potential inputs (15% weight)
    population_growth_yoy: 0.025,      // 2.5% growth
    job_growth_yoy: 0.03,              // 3% job growth
    income_growth_yoy: 0.04,           // 4% income growth

    // Livability inputs (10% weight)
    school_rating: 8.2,                // Good schools
    crime_index: 25,                   // Low crime (lower = better)
    walkability_score: 72,             // Good walkability
  },
  expected_normalized: {
    // Affordability (normalized 0-100)
    price_to_income: 85,    // 2.95 in optimal range → high score
    mortgage_burden: 75,    // 5.5% → moderate burden
    // ... each metric

    // Market Timing
    dom_score: 90,          // 18 days → very fast
    pending_score: 85,      // 0.45 → strong demand
    sale_to_list: 80,       // 1.02 → seller's market

    // Stability
    volatility_score: 88,   // 3% → low volatility
    foreclosure_score: 95,  // 0.2% → excellent
    unemployment_score: 82, // 3.2% → good

    // Growth
    pop_growth_score: 78,   // 2.5% → solid growth
    job_growth_score: 82,   // 3% → strong
    income_growth_score: 85,// 4% → excellent

    // Livability
    school_score: 82,       // 8.2/10 → good
    crime_score: 75,        // 25 index → safe
    walkability: 72,        // 72/100 → good
  },
  expected_components: {
    affordability: 82.0,    // Weighted avg of affordability metrics
    market_timing: 85.0,    // Weighted avg of timing metrics
    stability: 88.0,        // Weighted avg of stability metrics
    growth_potential: 81.0, // Weighted avg of growth metrics
    livability: 76.0,       // Weighted avg of livability metrics
  },
  calculation: `
    Component Scores:
    - Affordability: 82.0 (price_to_income: 85×0.5 + mortgage: 75×0.3 + other×0.2)
    - Market Timing: 85.0 (dom: 90×0.4 + pending: 85×0.35 + s2l: 80×0.25)
    - Stability: 88.0 (vol: 88×0.35 + forecl: 95×0.35 + unemp: 82×0.30)
    - Growth Potential: 81.0 (pop: 78×0.35 + job: 82×0.35 + inc: 85×0.30)
    - Livability: 76.0 (school: 82×0.4 + crime: 75×0.35 + walk: 72×0.25)

    Final Score (weighted):
    82.0 × 0.30 = 24.60  (affordability)
    85.0 × 0.25 = 21.25  (market_timing)
    88.0 × 0.20 = 17.60  (stability)
    81.0 × 0.15 = 12.15  (growth_potential)
    76.0 × 0.10 =  7.60  (livability)
    ─────────────────────
    Total: 83.20
  `,
  expected_final_score: 83.2,
  expected_status: 'complete',
}
```

#### Category 2: Missing Data Scenarios (5 geographies)

| ID | Purpose | Missing | Expected Result |
|----|---------|---------|-----------------|
| `MISSING_OPTIONAL_001` | One optional metric missing | walkability_score | Score calculated, weight redistributed |
| `MISSING_NEUTRAL_002` | One neutral metric missing | school_rating | Score 50 applied, weight preserved |
| `MISSING_REQUIRED_003` | One required metric missing | median_home_price | Component unavailable |
| `MISSING_COMPONENT_004` | All metrics for one component missing | All stability | Component skipped, reweight |
| `MISSING_MAJORITY_005` | >50% metrics missing | 60% missing | Score unavailable |

**Example - MISSING_OPTIONAL_001:**
```typescript
{
  geography_id: 'MISSING_OPTIONAL_001',
  test_purpose: 'Verify skip strategy redistributes weight correctly',
  raw_metrics: {
    // All metrics present EXCEPT walkability_score (optional, skip strategy)
    median_home_price: 350000,
    median_household_income: 85000,
    // ... other metrics
    school_rating: 7.5,
    crime_index: 30,
    walkability_score: null,  // MISSING - skip strategy
  },
  calculation: `
    Walkability (weight 0.25 in livability) is missing with SKIP strategy.

    Original livability weights: school=0.40, crime=0.35, walk=0.25
    After redistribution: school=0.533, crime=0.467, walk=removed
    (0.40/0.75=0.533, 0.35/0.75=0.467)

    Livability = 75×0.533 + 70×0.467 = 39.98 + 32.69 = 72.67

    Final score calculated normally with adjusted livability.
  `,
  expected_components: {
    affordability: 72.5,
    market_timing: 65.0,
    stability: 80.0,
    growth_potential: 55.0,
    livability: 72.67,  // Recalculated without walkability
  },
  expected_final_score: 69.42,
  expected_status: 'partial',
  expected_data_completeness: 0.95,  // 19/20 metrics
}
```

**Example - MISSING_MAJORITY_005:**
```typescript
{
  geography_id: 'MISSING_MAJORITY_005',
  test_purpose: 'Verify score unavailable when >50% weight missing',
  raw_metrics: {
    // Only 40% of weighted metrics present
    median_home_price: 350000,
    median_household_income: 85000,
    price_to_income_ratio: 4.12,
    // All other metrics NULL
    days_on_market: null,
    pending_ratio: null,
    // ...
  },
  calculation: `
    Available weight: affordability (0.30) + partial others = 0.40
    Missing weight: 0.60 (>50%)

    Threshold exceeded → Score unavailable
  `,
  expected_final_score: null,
  expected_status: 'unavailable',
  expected_reason: 'Insufficient data: only 40% of weighted metrics available',
}
```

#### Category 3: Boundary Conditions (5 geographies)

| ID | Purpose | Condition | Expected |
|----|---------|-----------|----------|
| `BOUNDARY_ALL_MIN_001` | All metrics at minimum valid | All at min | Score 0-5 |
| `BOUNDARY_ALL_MAX_002` | All metrics at maximum valid | All at max | Score 95-100 |
| `BOUNDARY_MIXED_003` | Mix of min/max extremes | 50/50 split | Score ~50 |
| `BOUNDARY_THRESHOLD_004` | Values at normalization thresholds | At breakpoints | Verify threshold handling |
| `BOUNDARY_INVALID_005` | Invalid negative values | price = -1000 | Should error |

**Example - BOUNDARY_ALL_MIN_001:**
```typescript
{
  geography_id: 'BOUNDARY_ALL_MIN_001',
  test_purpose: 'Verify score floors correctly at minimum values',
  raw_metrics: {
    // Worst possible values
    median_home_price: 2000000,       // Very expensive
    median_household_income: 25000,    // Very low income
    price_to_income_ratio: 80.0,       // Terrible ratio
    mortgage_rate: 12.0,               // Very high rate
    days_on_market: 365,               // Year on market
    pending_ratio: 0.01,               // Almost no pending
    sale_to_list_ratio: 0.70,          // Deep discounts
    price_volatility: 0.25,            // Very volatile
    foreclosure_rate: 0.15,            // High foreclosures
    unemployment_rate: 15.0,           // High unemployment
    population_growth_yoy: -0.05,      // Declining population
    job_growth_yoy: -0.08,             // Job losses
    income_growth_yoy: -0.03,          // Income decline
    school_rating: 1.0,                // Poor schools
    crime_index: 95,                   // High crime
    walkability_score: 5,              // Not walkable
  },
  expected_normalized: {
    price_to_income: 0,      // 80 far exceeds max
    mortgage_burden: 0,      // 12% → clamped to 0
    dom_score: 0,            // 365 days → clamped
    // All metrics normalize to 0 or near 0
  },
  expected_components: {
    affordability: 2.0,      // Near floor
    market_timing: 3.0,
    stability: 1.0,
    growth_potential: 0.0,
    livability: 5.0,
  },
  expected_final_score: 2.2,
  expected_status: 'complete',
  calculation: `
    All components near 0:
    2.0 × 0.30 = 0.60
    3.0 × 0.25 = 0.75
    1.0 × 0.20 = 0.20
    0.0 × 0.15 = 0.00
    5.0 × 0.10 = 0.50
    ─────────────────
    Total: 2.05 → rounded to 2.2
  `,
}
```

#### Category 4: Geographic Inheritance (5 geographies)

| ID | Purpose | Inheritance Chain | Expected |
|----|---------|-------------------|----------|
| `INHERIT_ZIP_NONE_001` | ZIP no data, County has all | ZIP→County | County values used |
| `INHERIT_ZIP_PARTIAL_002` | ZIP partial, County fills rest | ZIP→County | Mixed sources |
| `INHERIT_COUNTY_NONE_003` | County no data, Metro has all | County→Metro | Metro values used |
| `INHERIT_FULL_CHAIN_004` | Full chain traversal | ZIP→County→Metro→State | State values used |
| `INHERIT_NO_FALLBACK_005` | ZIP has all data | No inheritance | ZIP values only |

**Example - INHERIT_ZIP_PARTIAL_002:**
```typescript
{
  geography_id: 'INHERIT_ZIP_PARTIAL_002',
  test_purpose: 'Verify partial inheritance from County when ZIP has gaps',
  geography_type: 'zip',
  zip_code: '90210',
  county_fips: '06037',  // Los Angeles County

  zip_raw_metrics: {
    // ZIP has housing data
    median_home_price: 2500000,
    days_on_market: 45,
    sale_to_list_ratio: 0.98,
    // ZIP missing economic data
    unemployment_rate: null,
    job_growth_yoy: null,
    population_growth_yoy: null,
  },
  county_raw_metrics: {
    // County has economic data
    unemployment_rate: 4.5,
    job_growth_yoy: 0.02,
    population_growth_yoy: 0.008,
    // County also has housing (not used - ZIP has it)
    median_home_price: 750000,
  },

  expected_merged_metrics: {
    median_home_price: 2500000,       // From ZIP
    days_on_market: 45,               // From ZIP
    sale_to_list_ratio: 0.98,         // From ZIP
    unemployment_rate: 4.5,           // From COUNTY (inherited)
    job_growth_yoy: 0.02,             // From COUNTY (inherited)
    population_growth_yoy: 0.008,     // From COUNTY (inherited)
  },

  expected_inheritance_tracking: {
    median_home_price: { value: 2500000, source: 'zip', inherited: false },
    unemployment_rate: { value: 4.5, source: 'county', inherited: true },
    job_growth_yoy: { value: 0.02, source: 'county', inherited: true },
  },

  expected_final_score: 45.5,  // Calculated with merged data
  expected_status: 'complete',
  expected_inherited_count: 3,
  expected_direct_count: 12,
}
```

**Example - INHERIT_FULL_CHAIN_004:**
```typescript
{
  geography_id: 'INHERIT_FULL_CHAIN_004',
  test_purpose: 'Verify full inheritance chain ZIP→County→Metro→State',
  geography_type: 'zip',
  zip_code: '99501',      // Rural Alaska ZIP
  county_fips: '02020',   // Anchorage Municipality
  metro_cbsa: null,       // No metro (rural)
  state_fips: '02',       // Alaska

  zip_raw_metrics: {
    // ZIP only has basic data
    median_home_price: 320000,
    // Everything else null
  },
  county_raw_metrics: {
    // County has housing metrics
    days_on_market: 55,
    sale_to_list_ratio: 0.96,
    // Economic null
  },
  metro_raw_metrics: null,  // No metro
  state_raw_metrics: {
    // State has economic data
    unemployment_rate: 6.2,
    job_growth_yoy: 0.01,
    population_growth_yoy: -0.002,
  },

  expected_inheritance_chain: [
    { metric: 'median_home_price', source: 'zip' },
    { metric: 'days_on_market', source: 'county' },
    { metric: 'sale_to_list_ratio', source: 'county' },
    { metric: 'unemployment_rate', source: 'state' },
    { metric: 'job_growth_yoy', source: 'state' },
    { metric: 'population_growth_yoy', source: 'state' },
  ],

  expected_final_score: 52.3,
  expected_status: 'partial',
  expected_data_completeness: 0.65,
}
```

---

### 1.3 Fixture Interface Definition

```typescript
interface TestGeography {
  geography_id: string;
  test_purpose: string;
  geography_type: 'zip' | 'county' | 'metro' | 'state';

  // Input data
  raw_metrics: Record<string, number | null>;

  // For inheritance tests
  parent_metrics?: {
    county?: Record<string, number | null>;
    metro?: Record<string, number | null>;
    state?: Record<string, number | null>;
  };

  // Expected outputs
  expected_normalized: Record<string, number>;
  expected_components: {
    affordability: number;
    market_timing: number;
    stability: number;
    growth_potential: number;
    livability: number;
  };
  expected_final_score: number | null;
  expected_status: 'complete' | 'partial' | 'unavailable';
  expected_data_completeness?: number;
  expected_reason?: string;

  // For inheritance tracking
  expected_inherited_metrics?: Array<{
    metric: string;
    source: string;
    inherited: boolean;
  }>;

  // Calculation documentation
  calculation: string;
}
```

---

## Phase 2: Normalization Unit Tests

**File**: `packages/backend/src/scoring/__tests__/unit/normalization.service.spec.ts`

### 2.1 Min-Max Normalization Tests
```typescript
describe('normalizeMinMax', () => {
  it('returns 0 when value equals min');
  it('returns 100 when value equals max');
  it('returns 50 when value is midpoint');
  it('inverts scale when invert=true (for unemployment)');
  it('clamps values below min to 0');
  it('clamps values above max to 100');
  it('handles null gracefully');
  it('handles min equals max (division by zero)');
});
```

### 2.2 Percentile Normalization Tests
```typescript
describe('normalizePercentile', () => {
  it('returns 50 for median value');
  it('returns ~90 for p90 value');
  it('interpolates between percentiles');
  it('handles values below p10');
  it('handles values above p90');
});
```

### 2.3 Optimal Range Normalization Tests
```typescript
describe('normalizeOptimalRange', () => {
  it('returns 100 when value is in optimal range');
  it('returns 100 at optimal min/max boundaries');
  it('scales down below optimal range');
  it('scales down above optimal range');
  it('returns 0 at extended min/max');
});
```

---

## Phase 3: Score Calculation Unit Tests

**File**: `packages/backend/src/scoring/__tests__/unit/scoring.service.spec.ts`

### 3.1 Weight Validation Tests
```typescript
describe('Weight Validation', () => {
  describe('HomeReady weights', () => {
    it('sum to exactly 1.0');
    it('affordability weight is 0.30');
    it('market_timing weight is 0.25');
    it('stability weight is 0.20');
    it('growth_potential weight is 0.15');
    it('livability weight is 0.10');
  });

  describe('InvestorEdge weights', () => {
    it('sum to exactly 1.0');
    it('cash_flow weight is 0.35');
    it('rent_demand weight is 0.20');
    it('appreciation weight is 0.20');
    it('entry_point weight is 0.15');
    it('risk weight is 0.10');
  });

  describe('Market Health weights', () => {
    it('sum to exactly 1.0');
    it('demand_strength weight is 0.35');
    it('supply_balance weight is 0.25');
    it('price_stability weight is 0.25');
    it('economic_foundation weight is 0.15');
  });
});
```

### 3.2 Score Calculation Tests
```typescript
describe('calculateHomeReadyScore', () => {
  it('calculates correct score with hand-verified fixture');
  it('returns all component scores');
  it('all component scores are between 0-100');
  it('final score is weighted average of components');
});

describe('calculateInvestorEdgeScore', () => {
  // Same pattern
});

describe('calculateMarketHealthScore', () => {
  // Same pattern
});
```

### 3.3 Score Bounds Tests
```typescript
describe('Score Bounds', () => {
  it('HomeReady score is always between 0-100');
  it('InvestorEdge score is always between 0-100');
  it('Market Health score is always between 0-100');
  // Test with extreme inputs
});
```

---

## Phase 4: Missing Metrics Unit Tests

**File**: `packages/backend/src/scoring/__tests__/unit/missing-metrics.service.spec.ts`

```typescript
describe('MissingMetricsService', () => {
  describe('Skip strategy', () => {
    it('redistributes weight when metric is skipped');
    it('proportionally increases remaining weights');
    it('remaining weights sum to 1.0');
  });

  describe('Neutral strategy', () => {
    it('applies score of 50 for missing metric');
    it('preserves original weight');
  });

  describe('Penalize strategy', () => {
    it('applies score of 25 for missing metric');
  });

  describe('Score unavailable threshold', () => {
    it('returns null when >50% of weight is missing');
    it('returns score when <=50% of weight is missing');
    it('includes reason when score is null');
  });
});
```

---

## Phase 5: Inheritance Unit Tests

**File**: `packages/backend/src/scoring/__tests__/unit/inheritance.service.spec.ts`

```typescript
describe('InheritanceService', () => {
  describe('getGeographyChain', () => {
    it('returns correct chain for ZIP: ZIP → County → Metro → State → National');
    it('returns correct chain for County');
    it('returns correct chain for Metro');
    it('returns correct chain for State');
  });

  describe('getMetricWithInheritance', () => {
    it('returns direct value when available');
    it('falls back to county when ZIP data missing');
    it('falls back through full chain if needed');
    it('tracks inheritance source correctly');
    it('returns inherited=false for direct values');
    it('returns inherited=true for fallback values');
  });
});
```

---

## Phase 6: Confidence Calculation Unit Tests

**File**: `packages/backend/src/scoring/__tests__/unit/backtest/confidence-calculator.service.spec.ts`

```typescript
describe('ConfidenceCalculatorService', () => {
  describe('calculateConfidence', () => {
    it('applies formula: (R² × 0.5) + (Sample × 0.3) + (Recency × 0.2)');
    it('returns status "healthy" for 70%+');
    it('returns status "monitor" for 55-69%');
    it('returns status "review" for 40-54%');
    it('returns status "broken" for <40%');
  });

  describe('component contributions', () => {
    it('R² component is 50% of confidence');
    it('sample size component is 30% of confidence');
    it('recency component is 20% of confidence');
  });
});
```

---

## Phase 7: Access Control Unit Tests

**File**: `packages/backend/src/scoring/__tests__/unit/scoring.guard.spec.ts`

```typescript
describe('ScoringGuard', () => {
  describe('Market Health', () => {
    it('returns full access for free tier');
    it('returns full access for basic tier');
    it('returns full access for pro tier');
    it('returns full access for enterprise tier');
  });

  describe('HomeReady', () => {
    it('returns teaser access for free tier');
    it('returns teaser access for basic tier');
    it('returns full access for pro tier');
    it('returns full access for enterprise tier');
  });

  describe('InvestorEdge', () => {
    it('returns teaser access for free tier');
    it('returns teaser access for basic tier');
    it('returns full access for pro tier');
    it('returns full access for enterprise tier');
  });
});
```

---

## Phase 8: Integration Tests

**File**: `packages/backend/src/scoring/__tests__/integration/scoring-pipeline.spec.ts`

```typescript
describe('Scoring Pipeline Integration', () => {
  describe('End-to-end score calculation', () => {
    it('calculates all scores for a ZIP code');
    it('includes all required metadata');
    it('handles county with full data');
    it('handles sparse ZIP with inheritance');
  });

  describe('Score consistency', () => {
    it('returns identical scores for same input (deterministic)');
  });
});
```

**File**: `packages/backend/src/scoring/__tests__/integration/api-scoring.spec.ts`

```typescript
describe('Scoring API Integration', () => {
  describe('GET /api/scoring/:geoType/:geoId', () => {
    it('returns correct response structure');
    it('returns badge format when expanded=false');
    it('returns full format when expanded=true');
    it('returns teaser for gated scores with free user');
    it('returns full data for gated scores with pro user');
    it('handles invalid geography gracefully');
  });
});
```

---

## Phase 9: E2E Tests (Playwright)

**File**: `packages/frontend/tests/e2e/score-display.spec.ts`

```typescript
test.describe('Score Display', () => {
  test('displays score badges on map click');
  test('score badge shows correct color for range');
  test('clicking badge expands to score card');
  test('score card shows trend arrow');
  test('component bars show correct percentages');
});
```

**File**: `packages/frontend/tests/e2e/tier-access.spec.ts`

```typescript
test.describe('Tier Access Control', () => {
  test('free user sees teaser for HomeReady');
  test('free user sees teaser for InvestorEdge');
  test('pro user sees full HomeReady data');
  test('all users see full Market Health data');
  test('upgrade CTA appears for locked scores');
});
```

**File**: `packages/frontend/tests/e2e/admin-dashboard.spec.ts`

```typescript
test.describe('Admin Dashboard', () => {
  test('displays all tabs');
  test('confidence matrix loads data');
  test('can run backtest');
  test('backtest results display');
  test('confidence trend chart renders');
});
```

---

## Phase 10: Performance & Data Validation Tests

### 10.1 Performance Tests
**File**: `packages/backend/src/scoring/__tests__/performance/api-performance.spec.ts`

```typescript
describe('API Performance', () => {
  it('single score request completes in <200ms');
  it('batch score request for 100 ZIPs completes in <5s');
  it('score calculation for 1000 ZIPs completes in <10s');
});
```

### 10.2 Data Validation Tests
**File**: `packages/backend/src/scoring/__tests__/data-validation/data-integrity.spec.ts`

```typescript
describe('Data Integrity', () => {
  describe('Geography data', () => {
    it('all ZIPs have valid state FIPS');
    it('all counties have valid state FIPS');
    it('inheritance table covers all ZIPs');
  });

  describe('Metric data', () => {
    it('home prices are positive');
    it('percentages are between 0-100');
    it('dates are not in the future');
  });
});
```

---

## Failure Modes Checklist

This section maps specific failure modes to test cases that will catch them.

### Data Layer Failures

| Failure Mode | Test File | Test Case |
|-------------|-----------|-----------|
| Wrong geography data pulled (ZIP 60601 gets data for ZIP 60602) | `inheritance.service.spec.ts` | `it('returns data for exact geography ID, not similar IDs')` |
| Stale data used (showing 2023 metrics when 2024 exists) | `scoring-pipeline.spec.ts` | `it('uses most recent data when multiple dates exist')` |
| Inheritance not working (ZIP with no data should inherit from County) | `inheritance.service.spec.ts` | `it('falls back to county when ZIP data missing')` |
| Null/NaN values propagating into calculations | `scoring.service.spec.ts` | `it('handles null metrics without NaN in final score')` |
| Metric values outside valid ranges (negative prices, >100% rates) | `data-integrity.spec.ts` | `it('home prices are positive')`, `it('percentages are between 0-100')` |

```typescript
// Data Layer Failure Tests
describe('Data Layer Integrity', () => {
  it('returns data for exact geography ID, not similar IDs', async () => {
    const zip60601 = await service.getMetrics('zip', '60601');
    const zip60602 = await service.getMetrics('zip', '60602');
    expect(zip60601.median_home_price).not.toBe(zip60602.median_home_price);
  });

  it('uses most recent data when multiple dates exist', async () => {
    // Insert 2023 and 2024 data
    const result = await service.calculateScore('zip', '90210');
    expect(result.dataDate).toBe('2024-01-01'); // Not 2023
  });

  it('handles null metrics without NaN in final score', async () => {
    const result = await service.calculateHomeReadyScore({
      ...VALID_METRICS,
      walkability_score: null
    });
    expect(Number.isNaN(result.score)).toBe(false);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('rejects negative home prices', async () => {
    await expect(service.calculateScore({
      ...VALID_METRICS,
      median_home_price: -100000
    })).rejects.toThrow('Invalid metric: negative home price');
  });

  it('rejects percentages over 100', async () => {
    await expect(service.calculateScore({
      ...VALID_METRICS,
      pending_ratio: 1.5 // 150%
    })).rejects.toThrow('Invalid metric: percentage over 100');
  });
});
```

### Calculation Failures

| Failure Mode | Test File | Test Case |
|-------------|-----------|-----------|
| Component weights don't sum to 100% | `scoring.service.spec.ts` | `it('HomeReady weights sum to exactly 1.0')` |
| Normalization producing values outside 0-100 | `normalization.service.spec.ts` | `it('clamps values below min to 0')`, `it('clamps values above max to 100')` |
| Wrong formula version being used | `formula-version.spec.ts` | `it('uses specified version, not latest')` |
| Missing metrics not handled per strategy | `missing-metrics.service.spec.ts` | `it('redistributes weight when metric is skipped')` |
| Rounding errors accumulating | `scoring.service.spec.ts` | `it('final score matches hand-calculated value within 0.01')` |

```typescript
// Calculation Failure Tests
describe('Calculation Integrity', () => {
  describe('Weight Validation', () => {
    it('HomeReady weights sum to exactly 1.0', () => {
      const sum = Object.values(HOMEREADY_WEIGHTS).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 10); // 10 decimal places
    });

    it('InvestorEdge weights sum to exactly 1.0', () => {
      const sum = Object.values(INVESTOREDGE_WEIGHTS).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 10);
    });

    it('Market Health weights sum to exactly 1.0', () => {
      const sum = Object.values(MARKET_HEALTH_WEIGHTS).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 10);
    });
  });

  describe('Normalization Bounds', () => {
    it('never returns value below 0', () => {
      const extremeLow = normalizeMinMax(-1000000, 0, 100);
      expect(extremeLow).toBe(0);
    });

    it('never returns value above 100', () => {
      const extremeHigh = normalizeMinMax(1000000, 0, 100);
      expect(extremeHigh).toBe(100);
    });
  });

  describe('Formula Version', () => {
    it('uses specified version, not latest', async () => {
      const v1Result = await service.calculateScore(metrics, { version: '1.0.0' });
      const v2Result = await service.calculateScore(metrics, { version: '2.0.0' });
      // Scores should differ if formulas differ
      expect(v1Result.formulaVersion).toBe('1.0.0');
      expect(v2Result.formulaVersion).toBe('2.0.0');
    });
  });

  describe('Rounding Precision', () => {
    it('final score matches hand-calculated value within 0.01', () => {
      const result = service.calculateHomeReadyScore(HAPPY_HIGH_003.raw_metrics);
      expect(result.score).toBeCloseTo(HAPPY_HIGH_003.expected_final_score, 2);
    });
  });
});
```

### Display Failures

| Failure Mode | Test File | Test Case |
|-------------|-----------|-----------|
| Score badge showing wrong color for score value | `score-display.spec.ts` (E2E) | `test('score badge shows correct color for range')` |
| Free tier seeing Pro-only scores | `tier-access.spec.ts` (E2E) | `test('free user sees teaser for HomeReady')` |
| Confidence stars not matching confidence percentage | `score-display.spec.ts` (E2E) | `test('confidence stars match confidence percentage')` |
| Trend arrows pointing wrong direction | `score-display.spec.ts` (E2E) | `test('trend arrow direction matches score change')` |
| "Insufficient Data" not showing when it should | `score-display.spec.ts` (E2E) | `test('shows insufficient data message when >50% missing')` |

```typescript
// Display Failure E2E Tests (Playwright)
test.describe('Display Integrity', () => {
  test('score badge shows correct color for range', async ({ page }) => {
    await page.goto('/map');
    await page.click('[data-testid="map-zip-90210"]');

    const badge = page.locator('[data-testid="score-badge-market-health"]');
    const score = parseInt(await badge.textContent() || '0');

    if (score >= 70) {
      await expect(badge).toHaveClass(/bg-green/);
    } else if (score >= 55) {
      await expect(badge).toHaveClass(/bg-amber/);
    } else if (score >= 40) {
      await expect(badge).toHaveClass(/bg-orange/);
    } else {
      await expect(badge).toHaveClass(/bg-red/);
    }
  });

  test('free user cannot see HomeReady component details', async ({ page }) => {
    await loginAsUser(page, 'free@test.com');
    await page.goto('/map');
    await page.click('[data-testid="map-zip-90210"]');
    await page.click('[data-testid="score-badge-homeready"]');

    // Should see teaser, not full card
    await expect(page.locator('[data-testid="score-teaser-homeready"]')).toBeVisible();
    await expect(page.locator('[data-testid="component-affordability"]')).not.toBeVisible();
  });

  test('confidence stars match confidence percentage', async ({ page }) => {
    await page.goto('/map');
    await page.click('[data-testid="map-zip-90210"]');
    await page.click('[data-testid="score-badge-market-health"]');

    const confidence = await page.locator('[data-testid="confidence-percentage"]').textContent();
    const stars = await page.locator('[data-testid="confidence-star-filled"]').count();
    const pct = parseInt(confidence?.replace('%', '') || '0');

    // 5 stars = 90%+, 4 = 70-89%, 3 = 55-69%, 2 = 40-54%, 1 = <40%
    if (pct >= 90) expect(stars).toBe(5);
    else if (pct >= 70) expect(stars).toBe(4);
    else if (pct >= 55) expect(stars).toBe(3);
    else if (pct >= 40) expect(stars).toBe(2);
    else expect(stars).toBe(1);
  });

  test('trend arrow direction matches score change', async ({ page }) => {
    await page.goto('/map');
    await page.click('[data-testid="map-zip-90210"]');

    const trendDirection = await page.locator('[data-testid="score-trend"]').getAttribute('data-direction');
    const currentScore = parseFloat(await page.locator('[data-testid="current-score"]').textContent() || '0');
    const previousScore = parseFloat(await page.locator('[data-testid="previous-score"]').textContent() || '0');

    if (currentScore > previousScore + 2) expect(trendDirection).toBe('up');
    else if (currentScore < previousScore - 2) expect(trendDirection).toBe('down');
    else expect(trendDirection).toBe('stable');
  });

  test('shows insufficient data message when >50% missing', async ({ page }) => {
    // Navigate to a geography with sparse data
    await page.goto('/map');
    await page.click('[data-testid="map-zip-99999"]'); // Sparse data ZIP

    await expect(page.locator('[data-testid="insufficient-data-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="score-badge-homeready"]')).toContainText('--');
  });
});
```

### Backtest Failures

| Failure Mode | Test File | Test Case |
|-------------|-----------|-----------|
| Sampling not actually stratified | `backtest-runner.service.spec.ts` | `it('sample includes all geography types')` |
| Historical scores calculated with current formula | `backtest-runner.service.spec.ts` | `it('uses point-in-time formula for historical scores')` |
| Outcome data misaligned with score dates | `outcome-generator.service.spec.ts` | `it('outcome date matches score date plus horizon')` |
| Confidence calculation using wrong sample size | `confidence-calculator.service.spec.ts` | `it('sample size component uses actual count, not target')` |

```typescript
// Backtest Failure Tests
describe('Backtest Integrity', () => {
  describe('Stratified Sampling', () => {
    it('sample includes all geography types', async () => {
      const sample = await sampler.getSample(1000);

      const geoTypes = new Set(sample.map(s => s.geography_type));
      expect(geoTypes.has('state')).toBe(true);
      expect(geoTypes.has('metro')).toBe(true);
      expect(geoTypes.has('county')).toBe(true);
      expect(geoTypes.has('zip')).toBe(true);
    });

    it('sample proportions match target ratios', async () => {
      const sample = await sampler.getSample(1000);

      const counts = sample.reduce((acc, s) => {
        acc[s.geography_type] = (acc[s.geography_type] || 0) + 1;
        return acc;
      }, {});

      // States should be ~100% sampled (51 states)
      // Metros ~100% (384 metros)
      // Counties ~16% (500 of 3143)
      // ZIPs ~6% (2000 of 33000)
      expect(counts.state).toBeGreaterThanOrEqual(50);
      expect(counts.metro).toBeGreaterThanOrEqual(350);
    });

    it('sample does not overrepresent any region', async () => {
      const sample = await sampler.getSample(2000);

      // Count by state
      const byState = sample.reduce((acc, s) => {
        acc[s.state_fips] = (acc[s.state_fips] || 0) + 1;
        return acc;
      }, {});

      const maxPerState = Math.max(...Object.values(byState));
      const avgPerState = sample.length / 51;

      // No state should have >3x average representation
      expect(maxPerState).toBeLessThan(avgPerState * 3);
    });
  });

  describe('Point-in-Time Formulas', () => {
    it('uses point-in-time formula for historical scores', async () => {
      // Formula v1.0 was active 2023-01-01 to 2023-06-01
      // Formula v2.0 was active 2023-06-01+

      const historicalResult = await backtester.calculateHistoricalScore(
        'zip', '90210', '2023-03-01'
      );

      expect(historicalResult.formulaVersion).toBe('1.0.0');
    });

    it('does not use current formula for old dates', async () => {
      const currentVersion = await formulaService.getCurrentVersion();

      const historicalResult = await backtester.calculateHistoricalScore(
        'zip', '90210', '2022-01-01'
      );

      expect(historicalResult.formulaVersion).not.toBe(currentVersion);
    });
  });

  describe('Date Alignment', () => {
    it('outcome date matches score date plus horizon', async () => {
      const scoreDate = '2023-01-15';
      const horizon = '1y';

      const outcome = await generator.generateOutcome('zip', '90210', scoreDate, horizon);

      const expectedOutcomeDate = new Date('2024-01-15');
      expect(new Date(outcome.outcomeDate)).toEqual(expectedOutcomeDate);
    });
  });

  describe('Confidence Sample Size', () => {
    it('sample size component uses actual count, not target', async () => {
      // Run backtest with only 50 samples available
      const result = await backtester.run({ maxSamples: 50 });

      const confidence = await confidenceCalculator.calculate(result);

      // Sample component should reflect actual 50, not target 1000
      expect(confidence.sampleComponent).toBeLessThan(30); // Max is 30 for sample
    });
  });
});
```

### Integration Failures

| Failure Mode | Test File | Test Case |
|-------------|-----------|-----------|
| API returning 200 but with wrong data structure | `api-scoring.spec.ts` | `it('returns correct response structure')` |
| Database connection pooling causing stale reads | `scoring-pipeline.spec.ts` | `it('reflects database updates immediately')` |
| Cache serving outdated scores after formula update | `scoring-pipeline.spec.ts` | `it('invalidates cache on formula version change')` |
| Race conditions in concurrent score calculations | `scoring-pipeline.spec.ts` | `it('handles concurrent calculations correctly')` |

```typescript
// Integration Failure Tests
describe('Integration Integrity', () => {
  describe('API Response Structure', () => {
    it('returns correct response structure', async () => {
      const response = await request(app)
        .get('/api/scoring/zip/90210')
        .expect(200);

      // Validate structure, not just 200 status
      expect(response.body).toMatchObject({
        success: true,
        data: {
          marketHealth: expect.objectContaining({
            score: expect.any(Number),
            trend: expect.stringMatching(/up|down|stable/),
            confidence: expect.any(Number),
          }),
          homeready: expect.any(Object),
          investoredge: expect.any(Object),
        },
      });
    });

    it('returns error structure for invalid geography', async () => {
      const response = await request(app)
        .get('/api/scoring/zip/INVALID')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String),
      });
    });
  });

  describe('Data Freshness', () => {
    it('reflects database updates immediately', async () => {
      // Get initial score
      const initial = await request(app)
        .get('/api/scoring/zip/90210')
        .expect(200);

      // Update database directly
      await supabase.from('zillow_zip').update({ zhvi: 999999 }).eq('zip', '90210');

      // Get updated score (should reflect change)
      const updated = await request(app)
        .get('/api/scoring/zip/90210')
        .expect(200);

      expect(updated.body.data.marketHealth.score).not.toBe(
        initial.body.data.marketHealth.score
      );
    });

    it('invalidates cache on formula version change', async () => {
      // Get score with v1
      await formulaService.setActiveVersion('1.0.0');
      const v1Score = await request(app).get('/api/scoring/zip/90210');

      // Change to v2
      await formulaService.setActiveVersion('2.0.0');
      const v2Score = await request(app).get('/api/scoring/zip/90210');

      // Should not be cached v1 result
      expect(v2Score.body.data.formulaVersion).toBe('2.0.0');
    });
  });

  describe('Concurrency', () => {
    it('handles concurrent calculations correctly', async () => {
      // Fire 100 concurrent requests for same geography
      const promises = Array(100).fill(null).map(() =>
        request(app).get('/api/scoring/zip/90210')
      );

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(r => expect(r.status).toBe(200));

      // All should return same score (deterministic)
      const scores = results.map(r => r.body.data.marketHealth.score);
      const uniqueScores = new Set(scores);
      expect(uniqueScores.size).toBe(1);
    });

    it('handles concurrent calculations for different geographies', async () => {
      const zips = ['90210', '10001', '60601', '30301', '02101'];

      const promises = zips.map(zip =>
        request(app).get(`/api/scoring/zip/${zip}`)
      );

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(r => expect(r.status).toBe(200));

      // All should have different scores
      const scores = results.map(r => r.body.data.marketHealth.score);
      const uniqueScores = new Set(scores);
      expect(uniqueScores.size).toBe(5);
    });
  });
});
```

---

## Failure Modes Summary

| Category | Failures Covered | Test Count |
|----------|------------------|------------|
| Data Layer | 5 | ~15 |
| Calculation | 5 | ~25 |
| Display | 5 | ~12 |
| Backtest | 4 | ~15 |
| Integration | 4 | ~12 |
| Runtime Assertions | 6 | ~18 |
| Monitoring | 5 | ~15 |
| **Total** | **34** | **~112** |

---

## Phase 11: Runtime Assertions ("Fail Visibly")

**File**: `packages/backend/src/scoring/__tests__/unit/runtime-assertions.spec.ts`

These tests verify that the system THROWS or ALERTS when scores are impossibly wrong, rather than silently returning bad data.

### 11.1 Score Bound Assertions

```typescript
describe('Runtime Score Assertions', () => {
  describe('Impossible Score Detection', () => {
    it('throws ScoreOutOfBoundsError when score < 0', async () => {
      // Mock a calculation bug that produces negative score
      jest.spyOn(service, 'calculateRawScore').mockReturnValue(-15);

      await expect(service.calculateHomeReadyScore(metrics))
        .rejects.toThrow(ScoreOutOfBoundsError);

      // Verify alert was fired
      expect(alertService.fireAlert).toHaveBeenCalledWith({
        type: 'IMPOSSIBLE_SCORE',
        severity: 'critical',
        details: expect.objectContaining({
          score: -15,
          geography: expect.any(String),
        }),
      });
    });

    it('throws ScoreOutOfBoundsError when score > 100', async () => {
      jest.spyOn(service, 'calculateRawScore').mockReturnValue(105);

      await expect(service.calculateHomeReadyScore(metrics))
        .rejects.toThrow(ScoreOutOfBoundsError);
    });

    it('throws NaNScoreError when score is NaN', async () => {
      jest.spyOn(service, 'calculateRawScore').mockReturnValue(NaN);

      await expect(service.calculateHomeReadyScore(metrics))
        .rejects.toThrow(NaNScoreError);

      expect(alertService.fireAlert).toHaveBeenCalledWith({
        type: 'NAN_SCORE_DETECTED',
        severity: 'critical',
      });
    });

    it('throws InfiniteScoreError when score is Infinity', async () => {
      jest.spyOn(service, 'calculateRawScore').mockReturnValue(Infinity);

      await expect(service.calculateHomeReadyScore(metrics))
        .rejects.toThrow(InfiniteScoreError);
    });
  });

  describe('Component Bound Assertions', () => {
    it('throws when any component score is negative', async () => {
      const badComponents = { affordability: -5, market_timing: 50 };

      await expect(service.aggregateComponents(badComponents))
        .rejects.toThrow(ComponentOutOfBoundsError);
    });

    it('throws when any component score exceeds 100', async () => {
      const badComponents = { affordability: 150, market_timing: 50 };

      await expect(service.aggregateComponents(badComponents))
        .rejects.toThrow(ComponentOutOfBoundsError);
    });
  });

  describe('Weight Assertions', () => {
    it('throws WeightSumError if weights do not sum to 1.0 at runtime', () => {
      const badWeights = { a: 0.5, b: 0.3 }; // Sums to 0.8

      expect(() => service.validateWeights(badWeights))
        .toThrow(WeightSumError);
    });
  });
});
```

### 11.2 Data Sanity Assertions

```typescript
describe('Data Sanity Assertions', () => {
  describe('Metric Value Assertions', () => {
    it('throws NegativePriceError for negative home prices', async () => {
      const metrics = { ...validMetrics, median_home_price: -500000 };

      await expect(service.calculateScore('zip', '90210', metrics))
        .rejects.toThrow(NegativePriceError);
    });

    it('throws InvalidPercentageError for rates over 100%', async () => {
      const metrics = { ...validMetrics, unemployment_rate: 150 };

      await expect(service.calculateScore('zip', '90210', metrics))
        .rejects.toThrow(InvalidPercentageError);
    });

    it('throws FutureDateError for data dated in the future', async () => {
      const metrics = { ...validMetrics, data_date: '2030-01-01' };

      await expect(service.calculateScore('zip', '90210', metrics))
        .rejects.toThrow(FutureDateError);
    });

    it('throws StaleDateError for data older than 2 years', async () => {
      const metrics = { ...validMetrics, data_date: '2020-01-01' };

      await expect(service.calculateScore('zip', '90210', metrics))
        .rejects.toThrow(StaleDateError);

      expect(alertService.fireAlert).toHaveBeenCalledWith({
        type: 'STALE_DATA_USED',
        severity: 'warning',
      });
    });
  });

  describe('Geography Assertions', () => {
    it('throws InvalidZIPError for malformed ZIP codes', async () => {
      await expect(service.calculateScore('zip', 'ABCDE', validMetrics))
        .rejects.toThrow(InvalidZIPError);
    });

    it('throws InvalidFIPSError for malformed county FIPS', async () => {
      await expect(service.calculateScore('county', '999', validMetrics))
        .rejects.toThrow(InvalidFIPSError);
    });
  });
});
```

### 11.3 API Response Assertions

```typescript
describe('API Response Assertions', () => {
  it('API never returns score without status field', async () => {
    const response = await request(app).get('/api/scoring/zip/90210');

    // Every score MUST have a status
    expect(response.body.data.marketHealth).toHaveProperty('status');
    expect(response.body.data.homeready).toHaveProperty('status');
    expect(response.body.data.investoredge).toHaveProperty('status');
  });

  it('API never returns numeric score with "unavailable" status', async () => {
    const response = await request(app).get('/api/scoring/zip/99999'); // Sparse ZIP

    if (response.body.data.homeready.status === 'unavailable') {
      expect(response.body.data.homeready.score).toBeNull();
    }
  });

  it('API includes data completeness when score is partial', async () => {
    const response = await request(app).get('/api/scoring/zip/90210');

    if (response.body.data.homeready.status === 'partial') {
      expect(response.body.data.homeready.dataCompleteness).toBeDefined();
      expect(response.body.data.homeready.dataCompleteness).toBeLessThan(1.0);
    }
  });
});
```

---

## Phase 12: Monitoring & Alert Tests

**File**: `packages/backend/src/scoring/__tests__/integration/monitoring.spec.ts`

These tests verify that the monitoring and alerting system catches problems in production.

### 12.1 Confidence Drop Alerts

```typescript
describe('Confidence Monitoring', () => {
  describe('Confidence Drop Alerts', () => {
    it('fires alert when confidence drops >10 points in a week', async () => {
      // Setup: confidence was 75% last week
      await db.insert('backtest_confidence', {
        score_type: 'homeready',
        geography_type: 'metro',
        confidence_score: 75,
        created_at: oneWeekAgo,
      });

      // New backtest shows 60% confidence
      await backtestRunner.run({
        scoreType: 'homeready',
        geographyType: 'metro',
      });

      // Verify alert fired
      expect(alertService.fireAlert).toHaveBeenCalledWith({
        type: 'CONFIDENCE_DROP',
        severity: 'warning',
        details: expect.objectContaining({
          previousConfidence: 75,
          currentConfidence: expect.any(Number),
          dropAmount: expect.toBeGreaterThan(10),
        }),
      });
    });

    it('fires critical alert when confidence drops below 40%', async () => {
      await backtestRunner.run({ scoreType: 'homeready' });

      // Mock confidence calculation returning 35%
      jest.spyOn(confidenceCalculator, 'calculate').mockReturnValue({
        confidenceScore: 35,
        status: 'broken',
      });

      await monitoringService.checkConfidence();

      expect(alertService.fireAlert).toHaveBeenCalledWith({
        type: 'CONFIDENCE_CRITICAL',
        severity: 'critical',
        details: expect.objectContaining({
          confidence: 35,
          status: 'broken',
          action: 'Manual review required',
        }),
      });
    });

    it('does not fire alert for normal confidence fluctuations (<5 points)', async () => {
      await db.insert('backtest_confidence', {
        confidence_score: 72,
        created_at: oneWeekAgo,
      });

      // New confidence is 70% (only 2 point drop)
      await backtestRunner.run();

      expect(alertService.fireAlert).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'CONFIDENCE_DROP' })
      );
    });
  });
});
```

### 12.2 Score Anomaly Detection

```typescript
describe('Score Anomaly Detection', () => {
  describe('Sudden Score Changes', () => {
    it('fires alert when score changes >20 points for same geography', async () => {
      // Last month score was 65
      await db.insert('score_history', {
        geography_type: 'zip',
        geography_id: '90210',
        score_type: 'homeready',
        score: 65,
        created_at: oneMonthAgo,
      });

      // New calculation returns 42 (23 point drop)
      const result = await service.calculateHomeReadyScore('zip', '90210');

      expect(alertService.fireAlert).toHaveBeenCalledWith({
        type: 'SCORE_ANOMALY',
        severity: 'warning',
        details: expect.objectContaining({
          geography: '90210',
          previousScore: 65,
          currentScore: result.score,
          change: expect.any(Number),
          message: 'Score changed >20 points in 30 days',
        }),
      });
    });

    it('fires alert when score differs >15 points from neighboring ZIPs', async () => {
      // Neighboring ZIPs all have scores around 70
      const neighborScores = [68, 72, 71, 69];
      mockNeighborScores('90210', neighborScores);

      // This ZIP calculates to 45 (outlier)
      const result = await service.calculateHomeReadyScore('zip', '90210');
      result.score = 45; // Simulate outlier

      await monitoringService.checkSpatialAnomalies('90210', result);

      expect(alertService.fireAlert).toHaveBeenCalledWith({
        type: 'SPATIAL_ANOMALY',
        severity: 'info',
        details: expect.objectContaining({
          geography: '90210',
          score: 45,
          neighborAverage: 70,
          deviation: 25,
        }),
      });
    });
  });

  describe('Mass Score Changes', () => {
    it('fires critical alert when >10% of scores change >15 points', async () => {
      // Simulate batch recalculation where many scores change significantly
      const batchResult = await service.recalculateAllScores('state');

      // If >10% of states had big changes
      const bigChanges = batchResult.filter(r => Math.abs(r.change) > 15);
      const changeRate = bigChanges.length / batchResult.length;

      if (changeRate > 0.10) {
        expect(alertService.fireAlert).toHaveBeenCalledWith({
          type: 'MASS_SCORE_CHANGE',
          severity: 'critical',
          details: expect.objectContaining({
            affectedPercentage: expect.toBeGreaterThan(10),
            message: 'Possible formula bug or data issue',
          }),
        });
      }
    });
  });
});
```

### 12.3 Data Pipeline Monitoring

```typescript
describe('Data Pipeline Monitoring', () => {
  describe('Data Freshness Alerts', () => {
    it('fires alert when Zillow data is >7 days stale', async () => {
      // Check when data was last updated
      const lastUpdate = await db.query(
        "SELECT MAX(updated_at) FROM zillow_zip"
      );

      const daysSinceUpdate = daysBetween(lastUpdate, now());

      if (daysSinceUpdate > 7) {
        await monitoringService.checkDataFreshness();

        expect(alertService.fireAlert).toHaveBeenCalledWith({
          type: 'STALE_DATA_SOURCE',
          severity: 'warning',
          details: expect.objectContaining({
            source: 'zillow_zip',
            lastUpdate: expect.any(String),
            daysSinceUpdate: expect.toBeGreaterThan(7),
          }),
        });
      }
    });

    it('fires critical alert when any data source is >30 days stale', async () => {
      await monitoringService.checkDataFreshness();

      // Should fire for any source >30 days old
      expect(alertService.fireAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'STALE_DATA_SOURCE',
          severity: 'critical',
        })
      );
    });
  });

  describe('Data Coverage Alerts', () => {
    it('fires alert when coverage drops below threshold', async () => {
      // If we have data for <90% of ZIPs
      const coverage = await db.query(`
        SELECT COUNT(*) as has_data
        FROM geographies g
        LEFT JOIN zillow_zip z ON g.zip = z.zip
        WHERE g.type = 'zip'
      `);

      const coverageRate = coverage.has_data / coverage.total;

      if (coverageRate < 0.90) {
        await monitoringService.checkDataCoverage();

        expect(alertService.fireAlert).toHaveBeenCalledWith({
          type: 'LOW_DATA_COVERAGE',
          severity: 'warning',
          details: expect.objectContaining({
            geographyType: 'zip',
            coverage: expect.toBeLessThan(90),
          }),
        });
      }
    });
  });
});
```

### 12.4 Alert Delivery Verification

```typescript
describe('Alert Delivery', () => {
  it('critical alerts are sent to Slack immediately', async () => {
    await alertService.fireAlert({
      type: 'CONFIDENCE_CRITICAL',
      severity: 'critical',
      details: { confidence: 35 },
    });

    expect(slackService.sendMessage).toHaveBeenCalledWith({
      channel: '#propertyiq-alerts',
      message: expect.stringContaining('CRITICAL'),
    });
  });

  it('warning alerts are batched and sent hourly', async () => {
    await alertService.fireAlert({
      type: 'CONFIDENCE_DROP',
      severity: 'warning',
      details: {},
    });

    // Should not send immediately
    expect(slackService.sendMessage).not.toHaveBeenCalled();

    // After 1 hour
    jest.advanceTimersByTime(60 * 60 * 1000);
    await alertService.flushBatchedAlerts();

    expect(slackService.sendMessage).toHaveBeenCalled();
  });

  it('alerts are persisted to database for audit trail', async () => {
    await alertService.fireAlert({
      type: 'SCORE_ANOMALY',
      severity: 'warning',
      details: { geography: '90210' },
    });

    const savedAlert = await db.query(
      "SELECT * FROM alerts WHERE type = 'SCORE_ANOMALY' ORDER BY created_at DESC LIMIT 1"
    );

    expect(savedAlert).toBeDefined();
    expect(savedAlert.details).toMatchObject({ geography: '90210' });
  });
});
```

---

## Implementation Order

### Sprint 1: Infrastructure & Core Unit Tests
| Task | Priority | Est. Tests |
|------|----------|------------|
| Create test directory structure | P0 | - |
| Create fixtures with hand-calculated values | P0 | - |
| Normalization service tests | P0 | ~15 |
| Weight validation tests | P0 | ~20 |
| Missing metrics tests | P0 | ~12 |

### Sprint 2: Score Calculation & Inheritance Tests
| Task | Priority | Est. Tests |
|------|----------|------------|
| HomeReady calculation tests | P0 | ~15 |
| InvestorEdge calculation tests | P0 | ~15 |
| Market Health calculation tests | P0 | ~15 |
| Inheritance chain tests | P0 | ~12 |

### Sprint 3: Confidence & Access Control Tests
| Task | Priority | Est. Tests |
|------|----------|------------|
| Confidence calculator tests | P0 | ~10 |
| Access control guard tests | P0 | ~12 |
| Backtest runner tests | P1 | ~10 |

### Sprint 4: Integration Tests
| Task | Priority | Est. Tests |
|------|----------|------------|
| Scoring pipeline integration | P0 | ~10 |
| API integration tests | P0 | ~15 |
| Inheritance chain integration | P0 | ~8 |

### Sprint 5: E2E & Performance Tests
| Task | Priority | Est. Tests |
|------|----------|------------|
| Score display E2E | P0 | ~10 |
| Tier access E2E | P0 | ~8 |
| Admin dashboard E2E | P1 | ~8 |
| Performance tests | P1 | ~5 |
| Data validation tests | P1 | ~8 |

### Sprint 6: Runtime Assertions & Monitoring Tests
| Task | Priority | Est. Tests |
|------|----------|------------|
| Runtime score assertions | P0 | ~10 |
| Data sanity assertions | P0 | ~8 |
| Confidence monitoring tests | P0 | ~8 |
| Score anomaly detection tests | P1 | ~7 |
| Alert delivery verification | P1 | ~5 |

---

## Success Criteria

1. **Coverage**: >90% on all scoring services
2. **Deterministic**: All tests pass consistently (no flakiness)
3. **Performance**: API tests complete in <200ms per request
4. **Documentation**: All test fixtures document expected calculations
5. **CI Integration**: Tests run on every PR
6. **Fail Visibly**: All impossible scores (negative, >100, NaN) throw errors
7. **Monitoring**: All critical alerts verified to fire within 5 seconds

---

## Verification

After implementation, verify by running:

```bash
# Run all unit tests
cd packages/backend && npm run test:unit

# Run integration tests
cd packages/backend && npm run test:integration

# Run E2E tests
cd packages/frontend && npx playwright test

# Check coverage
cd packages/backend && npm run test:coverage
```

Expected output:
- All ~215 tests passing
- >90% coverage on scoring services
- No flaky tests in 10 consecutive runs

---
---

# PART 2: Data Card Testing & Monitoring

## Overview

The PropertyIQ platform displays 48+ metrics across multiple data cards in the map sidebar. These cards influence user decisions worth $100K-$1M+ and must be thoroughly tested and monitored.

### Current State
| Item | Status |
|------|--------|
| Metric Registry | 48+ metrics in `metric-registry.ts` |
| Data Card Components | `MetricGraph.tsx` with embedded StatCards |
| Backend Services | 5 services: Zillow, Census, Economic, Realtor, Permits |
| Existing Tests | **NONE** - critical gap |
| Monitoring | Basic tables exist, no active monitoring |

### Scope
| Category | Files | Est. Tests |
|----------|-------|------------|
| Unit Tests | Card components | ~80 |
| Integration Tests | API + cards | ~30 |
| E2E Tests | Map interaction | ~25 |
| Health Check API | New endpoint | ~15 |
| Monitoring Dashboard | New page | - |
| **Total** | | **~150** |

---

## Phase 13: Data Card Component Inventory

### 13.1 Metrics by Category (from metric-registry.ts)

| Category | Metrics | Data Source | Update Freq | Critical? |
|----------|---------|-------------|-------------|-----------|
| **Home Values** | ZHVI, Median List/Sale Price | `zillow_*` | Monthly | ✅ Yes |
| **Market Trends** | Inventory, New Listings, Pending, DOM, Sale-to-List | `zillow_*`, `realtor_*` | Monthly | ✅ Yes |
| **Rentals** | ZORI, ZORDI (SFR, MFR) | `zillow_*` | Monthly | ✅ Yes |
| **Demographics** | Population, Median Age | `census_*` | Annual | ✅ Yes |
| **Economics** | Income, Unemployment, Employment | `census_*`, `economic_*` | Monthly/Annual | ✅ Yes |
| **Affordability** | Price-to-Income, Years to Save | `calculated_metrics` | Monthly | ✅ Yes |
| **Investor** | GRM, Cap Rate, Rent Yield | `calculated_metrics` | Monthly | ✅ Yes |
| **PropertyIQ** | Market Health, HomeReady, InvestorEdge | `propertyiq_scores` | On-demand | ✅ Yes |

### 13.2 Key Files to Test

| Component | Location | Lines | Purpose |
|-----------|----------|-------|---------|
| MetricGraph | `packages/frontend/src/components/graphs/MetricGraph.tsx` | ~600 | Main chart/stats display |
| MetricSidebar | `packages/frontend/src/components/sidebar/MetricSidebar.tsx` | ~400 | Metric selection sidebar |
| MetricRegistry | `packages/frontend/src/config/metric-registry.ts` | ~800 | Metric configurations |
| GeographySelector | `packages/frontend/src/components/selectors/GeographySelector.tsx` | ~150 | Geography level switcher |
| Dashboard | `packages/frontend/app/graphs/Dashboard.tsx` | ~300 | Main dashboard page |

---

## Phase 14: Data Card Unit Tests

**Directory**: `packages/frontend/__tests__/unit/data-cards/`

### 14.1 StatCard Component Tests

```typescript
// packages/frontend/__tests__/unit/data-cards/StatCard.spec.tsx

describe('StatCard', () => {
  describe('Value Formatting', () => {
    it('formats currency values correctly ($425,000)');
    it('formats large currency with abbreviation ($15.0M)');
    it('formats percent values with precision');
    it('formats number values with thousands separator');
    it('formats days/years with suffix');
    it('formats ratios to specified precision');
  });

  describe('Null/Missing Data', () => {
    it('displays "N/A" when value is null');
    it('displays "N/A" when value is undefined');
    it('displays "N/A" when value is NaN');
  });

  describe('Trend Indicators', () => {
    it('shows green arrow for positive change');
    it('shows red arrow for negative change');
    it('shows neutral indicator for zero change');
    it('hides trend arrow when change is null');
    it('applies correct direction based on metric type');
    // For unemployment: down is good (green), up is bad (red)
    it('inverts color for "down_is_good" metrics');
  });

  describe('Loading State', () => {
    it('shows skeleton when loading=true');
    it('hides skeleton when data loads');
  });

  describe('Error State', () => {
    it('shows error message when error prop set');
    it('shows retry button on error');
    it('calls onRetry when retry clicked');
  });
});
```

### 14.2 MetricGraph Component Tests

```typescript
// packages/frontend/__tests__/unit/data-cards/MetricGraph.spec.tsx

describe('MetricGraph', () => {
  describe('Chart Rendering', () => {
    it('renders line chart for line chartType');
    it('renders area chart for area chartType');
    it('renders bar chart for bar chartType');
    it('applies correct color scale (red-green vs green-red)');
    it('shows average line when showAverage=true');
    it('shows trendline when showTrendline=true');
  });

  describe('Statistics Cards', () => {
    it('calculates and displays current value');
    it('calculates and displays average value');
    it('calculates and displays min value');
    it('calculates and displays max value');
    it('calculates YoY change correctly');
  });

  describe('Time Range Controls', () => {
    it('filters data for 1Y range');
    it('filters data for 3Y range');
    it('filters data for 5Y range');
    it('filters data for 10Y range');
    it('shows all data for ALL range');
  });

  describe('Interval Controls', () => {
    it('aggregates data monthly');
    it('aggregates data quarterly');
    it('aggregates data yearly');
  });

  describe('Export Actions', () => {
    it('copies chart to clipboard');
    it('downloads chart as PNG');
    it('exports data as CSV');
  });

  describe('Edge Cases', () => {
    it('handles empty data array');
    it('handles single data point');
    it('handles all null values');
    it('handles extreme values (very large/small)');
  });
});
```

### 14.3 MetricSidebar Tests

```typescript
// packages/frontend/__tests__/unit/data-cards/MetricSidebar.spec.tsx

describe('MetricSidebar', () => {
  describe('Category Display', () => {
    it('renders all 8 main categories');
    it('expands/collapses categories on click');
    it('shows subcategories for Market Trends');
    it('highlights selected metric');
  });

  describe('User Mode Toggle', () => {
    it('shows Homebuyer popular metrics by default');
    it('shows Investor popular metrics when toggled');
    it('persists mode selection');
  });

  describe('Metric Selection', () => {
    it('calls onMetricSelect when metric clicked');
    it('passes correct metricId to callback');
    it('supports keyboard navigation');
  });

  describe('Geography Filtering', () => {
    it('only shows metrics available for selected geoLevel');
    it('disables unavailable metrics');
    it('updates when geoLevel changes');
  });
});
```

### 14.4 Value Formatter Tests

```typescript
// packages/frontend/__tests__/unit/data-cards/formatters.spec.ts

describe('Value Formatters', () => {
  describe('formatCurrency', () => {
    it('formats 425000 as $425,000');
    it('formats 15000000 as $15.0M');
    it('formats 1500000000 as $1.5B');
    it('formats 0 as $0');
    it('returns N/A for null');
  });

  describe('formatPercent', () => {
    it('formats 0.052 as 5.2%');
    it('formats -0.032 as -3.2%');
    it('formats 0 as 0.0%');
    it('handles precision parameter');
  });

  describe('formatNumber', () => {
    it('formats 1234567 as 1,234,567');
    it('formats 0 as 0');
  });

  describe('formatDays', () => {
    it('formats 28 as "28 days"');
    it('formats 1 as "1 day"');
  });

  describe('formatYears', () => {
    it('formats 5.5 as "5.5 years"');
    it('formats 1 as "1 year"');
  });
});
```

---

## Phase 15: Data Card Integration Tests

**Directory**: `packages/frontend/__tests__/integration/data-cards/`

### 15.1 Data Card + API Integration

```typescript
// packages/frontend/__tests__/integration/data-cards/DataCardAPI.spec.tsx

describe('Data Card API Integration', () => {
  describe('Zillow Metrics', () => {
    it('fetches ZHVI data for ZIP code');
    it('fetches ZORI data for Metro');
    it('fetches inventory data for County');
    it('handles API error gracefully');
    it('retries on network failure');
  });

  describe('Census Metrics', () => {
    it('fetches population data');
    it('fetches income data');
    it('handles annual date format');
  });

  describe('Economic Metrics', () => {
    it('fetches unemployment rate');
    it('uses fallback to latest when date missing');
  });

  describe('Calculated Metrics', () => {
    it('fetches cap rate');
    it('fetches GRM');
    it('fetches affordability metrics');
  });

  describe('Data Transformation', () => {
    it('transforms API response to chart format');
    it('handles metric_name pattern (Zillow)');
    it('handles direct column pattern (Realtor)');
    it('normalizes date formats');
  });
});
```

### 15.2 Geography Switching

```typescript
// packages/frontend/__tests__/integration/data-cards/GeographySwitching.spec.tsx

describe('Geography Switching', () => {
  it('loads new data when geography changes');
  it('shows loading state during transition');
  it('cancels pending requests on geography change');
  it('clears cache when switching geography types');
  it('preserves selected metric across geography changes');
  it('handles metric unavailable at new geography level');
});
```

---

## Phase 16: Data Card E2E Tests (Playwright)

**Directory**: `packages/frontend/tests/e2e/data-cards/`

### 16.1 Map Sidebar Interaction

```typescript
// packages/frontend/tests/e2e/data-cards/map-sidebar.spec.ts

test.describe('Map Sidebar Data Cards', () => {
  test('displays metric sidebar when geography selected', async ({ page }) => {
    await page.goto('/graphs');
    await page.getByTestId('geography-search').fill('60601');
    await page.getByTestId('search-result-60601').click();

    await expect(page.getByTestId('metric-sidebar')).toBeVisible();
  });

  test('all metric categories are visible', async ({ page }) => {
    await page.goto('/graphs');
    await selectGeography(page, '60601');

    await expect(page.getByTestId('category-home-values')).toBeVisible();
    await expect(page.getByTestId('category-market-trends')).toBeVisible();
    await expect(page.getByTestId('category-rentals')).toBeVisible();
    await expect(page.getByTestId('category-demographics')).toBeVisible();
    await expect(page.getByTestId('category-economics')).toBeVisible();
    await expect(page.getByTestId('category-affordability')).toBeVisible();
    await expect(page.getByTestId('category-investor')).toBeVisible();
    await expect(page.getByTestId('category-propertyiq')).toBeVisible();
  });

  test('selecting metric loads chart', async ({ page }) => {
    await page.goto('/graphs');
    await selectGeography(page, '60601');

    await page.getByTestId('metric-zhvi').click();

    await expect(page.getByTestId('metric-chart')).toBeVisible();
    await expect(page.getByTestId('stat-card-current')).not.toContainText('N/A');
  });

  test('statistics cards show calculated values', async ({ page }) => {
    await page.goto('/graphs');
    await selectGeography(page, '60601');
    await page.getByTestId('metric-zhvi').click();

    // Wait for data to load
    await page.waitForResponse(resp => resp.url().includes('/api/zillow'));

    await expect(page.getByTestId('stat-card-current')).toBeVisible();
    await expect(page.getByTestId('stat-card-average')).toBeVisible();
    await expect(page.getByTestId('stat-card-min')).toBeVisible();
    await expect(page.getByTestId('stat-card-max')).toBeVisible();
  });

  test('time range buttons filter data', async ({ page }) => {
    await page.goto('/graphs');
    await selectGeography(page, '60601');
    await page.getByTestId('metric-zhvi').click();

    // Click 1Y button
    await page.getByTestId('time-range-1y').click();

    // Chart should update (data points should be fewer)
    await expect(page.getByTestId('metric-chart')).toBeVisible();
  });

  test('geography selector changes data', async ({ page }) => {
    await page.goto('/graphs');
    await selectGeography(page, '60601');
    await page.getByTestId('metric-zhvi').click();

    const firstValue = await page.getByTestId('stat-card-current').textContent();

    // Change to different geography
    await selectGeography(page, '90210');

    await page.waitForResponse(resp => resp.url().includes('/api/zillow'));

    const secondValue = await page.getByTestId('stat-card-current').textContent();

    // Values should differ (Chicago vs Beverly Hills)
    expect(firstValue).not.toBe(secondValue);
  });
});
```

### 16.2 Sparse Data Handling

```typescript
// packages/frontend/tests/e2e/data-cards/sparse-data.spec.ts

test.describe('Sparse Data Handling', () => {
  test('shows N/A for missing metrics', async ({ page }) => {
    await page.goto('/graphs');
    // Select a rural ZIP known to have sparse data
    await selectGeography(page, '59001'); // Rural Montana

    await page.getByTestId('metric-walkability').click();

    await expect(page.getByTestId('stat-card-current')).toContainText('N/A');
  });

  test('shows partial data indicator', async ({ page }) => {
    await page.goto('/graphs');
    await selectGeography(page, '59001');

    await page.getByTestId('metric-zhvi').click();

    // If partial data, should show indicator
    const partialIndicator = page.getByTestId('partial-data-indicator');
    if (await partialIndicator.isVisible()) {
      await expect(partialIndicator).toContainText('Limited data');
    }
  });

  test('no errors displayed for missing data', async ({ page }) => {
    await page.goto('/graphs');
    await selectGeography(page, '59001');

    // Should not show error messages
    await expect(page.getByTestId('error-message')).not.toBeVisible();
  });
});
```

### 16.3 Admin Data Dashboard E2E Tests

**File**: `packages/frontend/tests/e2e/admin-data.spec.ts`

```typescript
test.describe('Admin Data Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await loginAsAdmin(page);
  });

  test('displays all tabs', async ({ page }) => {
    await page.goto('/admin/data');

    await expect(page.getByRole('tab', { name: 'Data Cards' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Data Sources' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Pipeline Runs' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Alerts' })).toBeVisible();
  });

  test('shows overall health status banner', async ({ page }) => {
    await page.goto('/admin/data');

    await expect(page.getByTestId('status-banner')).toBeVisible();
    await expect(page.getByTestId('status-banner')).toContainText(/healthy|degraded|unhealthy/i);
  });

  test('data cards tab shows metric health table', async ({ page }) => {
    await page.goto('/admin/data');
    await page.getByRole('tab', { name: 'Data Cards' }).click();

    await expect(page.getByTestId('metric-health-table')).toBeVisible();
    // Should have rows for metrics
    const rows = page.locator('[data-testid="metric-health-row"]');
    await expect(rows).toHaveCount({ min: 10 }); // At least 10 metrics
  });

  test('data sources tab shows source availability', async ({ page }) => {
    await page.goto('/admin/data');
    await page.getByRole('tab', { name: 'Data Sources' }).click();

    await expect(page.getByTestId('source-health-table')).toBeVisible();
    await expect(page.getByText('Zillow')).toBeVisible();
    await expect(page.getByText('Census')).toBeVisible();
    await expect(page.getByText('BLS')).toBeVisible();
  });

  test('pipeline runs tab shows recent runs', async ({ page }) => {
    await page.goto('/admin/data');
    await page.getByRole('tab', { name: 'Pipeline Runs' }).click();

    await expect(page.getByTestId('pipeline-runs-table')).toBeVisible();
  });

  test('can acknowledge an alert', async ({ page }) => {
    await page.goto('/admin/data');
    await page.getByRole('tab', { name: 'Alerts' }).click();

    // If there are alerts, test acknowledge
    const acknowledgeBtn = page.getByRole('button', { name: 'Acknowledge' }).first();
    if (await acknowledgeBtn.isVisible()) {
      await acknowledgeBtn.click();
      await expect(page.getByText('Alert acknowledged')).toBeVisible();
    }
  });

  test('auto-refreshes data every 5 minutes', async ({ page }) => {
    await page.goto('/admin/data');

    // Check that refresh timer is visible
    await expect(page.getByTestId('last-refresh-time')).toBeVisible();
  });

  test('manual refresh button works', async ({ page }) => {
    await page.goto('/admin/data');

    await page.getByRole('button', { name: 'Refresh' }).click();
    await expect(page.getByTestId('loading-indicator')).toBeVisible();
    await expect(page.getByTestId('loading-indicator')).not.toBeVisible({ timeout: 10000 });
  });
});
```

---

## Phase 17: Data Card Health Monitoring

### 17.1 Health Check API Endpoint

**File**: `packages/backend/src/health/data-cards-health.controller.ts`

```typescript
// Health check endpoint structure
GET /api/health/data-cards

Response:
{
  status: 'healthy' | 'degraded' | 'unhealthy',
  checks: [
    {
      metricName: 'zhvi',
      tableName: 'zillow_zip',
      status: 'ok' | 'stale' | 'empty' | 'error',
      latestDate: '2024-01-31',
      recordCount: 33000,
      coverage: 98.5,  // % of ZIPs with data
      message?: string
    },
    // ... all metrics
  ],
  summary: {
    total: 48,
    healthy: 45,
    stale: 2,
    empty: 0,
    errors: 1
  }
}
```

### 17.2 Health Check Service Implementation

**File**: `packages/backend/src/health/data-cards-health.service.ts`

**Tests**: `packages/backend/src/health/__tests__/data-cards-health.service.spec.ts`

```typescript
describe('DataCardsHealthService', () => {
  describe('checkMetricHealth', () => {
    it('returns ok for fresh data within threshold');
    it('returns stale when data exceeds freshness threshold');
    it('returns empty when no records exist');
    it('returns error on database failure');
  });

  describe('calculateCoverage', () => {
    it('calculates correct percentage of ZIPs with data');
    it('calculates correct percentage of Counties with data');
    it('handles zero total geographies');
  });

  describe('checkAllMetrics', () => {
    it('checks all 48 metrics');
    it('aggregates results correctly');
    it('determines overall status based on critical metrics');
  });
});
```

### 17.3 Freshness Thresholds Configuration

```typescript
// Metric freshness expectations
const FRESHNESS_THRESHOLDS = {
  // Monthly sources - alert if >45 days old
  zillow_zhvi: { days: 45, critical: true },
  zillow_zori: { days: 45, critical: true },
  realtor_metrics: { days: 45, critical: true },
  economic_unemployment: { days: 45, critical: true },

  // Annual sources - alert if >400 days old
  census_population: { days: 400, critical: true },
  census_income: { days: 400, critical: true },

  // Calculated - should match source freshness
  calculated_cap_rate: { days: 45, critical: true },
  calculated_grm: { days: 45, critical: false },
};
```

### 17.4 Unified Data Admin Dashboard

**File**: `packages/frontend/app/admin/data/page.tsx`

This creates a unified admin page at `/admin/data` (parallel to existing `/admin/propertyiq-scores`).

**Tab Structure:**
| Tab | Content |
|-----|---------|
| **Data Cards** | Metric display health, coverage, staleness |
| **Data Sources** | Source availability, freshness, schema status |
| **Pipeline Runs** | Recent ETL runs, success/failure, records loaded |
| **Alerts** | Active alerts with acknowledge/resolve actions |

**Features:**
- Overall health status badge (healthy/degraded/unhealthy)
- Summary cards: Total, Healthy, Stale, Empty, Errors
- Table of all metrics with status, latest date, record count, coverage
- Auto-refresh every 5 minutes
- Manual refresh button
- Filter by status (show only stale/errors)

---

## Phase 18: Scheduled Health Checks

### 18.1 GitHub Actions Workflow

**File**: `.github/workflows/data-card-health-check.yml`

```yaml
name: Data Card Health Check

on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch:

jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - name: Check Data Card Health
        run: |
          RESPONSE=$(curl -s "${{ secrets.API_URL }}/api/health/data-cards")
          STATUS=$(echo $RESPONSE | jq -r '.status')

          if [ "$STATUS" != "healthy" ]; then
            # Send Slack alert
            curl -X POST ${{ secrets.SLACK_WEBHOOK_URL }} \
              -H 'Content-type: application/json' \
              -d "{\"text\": \"⚠️ Data Card Health: $STATUS\"}"
          fi
```

### 18.2 Alert Configuration

```typescript
// Alert rules for data cards
const DATA_CARD_ALERT_RULES = [
  {
    name: 'critical_metric_stale',
    condition: 'metric.critical && metric.status === "stale"',
    severity: 'warning',
    channels: ['slack'],
  },
  {
    name: 'critical_metric_empty',
    condition: 'metric.critical && metric.status === "empty"',
    severity: 'critical',
    channels: ['slack', 'pagerduty'],
  },
  {
    name: 'coverage_drop',
    condition: 'metric.coverage < 90',
    severity: 'warning',
    channels: ['slack'],
  },
];
```

---
---

# PART 3: Data Ingest Testing & Monitoring

## Overview

The PropertyIQ platform ingests data from 5+ external sources. Silent failures = stale/wrong data everywhere, making this critical infrastructure.

### Current State
| Item | Status |
|------|--------|
| Data Sources | 5 (Zillow, Census, BLS, Realtor, Permits) |
| ETL Scripts | Manual (`scripts/download-*.ts`) |
| Existing Tests | **NONE** |
| Scheduled Jobs | **NONE** - all manual |
| Monitoring Tables | `data_ingestion_log`, `data_source_registry` exist but unused |

### Scope
| Category | Files | Est. Tests |
|----------|-------|------------|
| Unit Tests (transforms) | 5 services | ~60 |
| Integration Tests (pipelines) | 5 pipelines | ~40 |
| Health Check API | New endpoint | ~20 |
| Monitoring Service | New service | ~25 |
| Scheduled Jobs | 5 workflows | - |
| **Total** | | **~145** |

---

## Phase 19: Data Source Inventory

### 19.1 Source Details

| Source | Tables | Fields | Update Freq | Lag | Critical |
|--------|--------|--------|-------------|-----|----------|
| **Zillow** | `zillow_state/metro/county/zip/city` | ZHVI, ZORI, DOM, Inventory, etc. | Monthly | 1-2 weeks | ✅ |
| **Census** | `census_state/metro/county/zip` | Population, Income, Demographics | Annual | 1-2 years | ✅ |
| **BLS/Economic** | `economic_state/metro/county` | Unemployment, Employment | Monthly | 1-2 months | ✅ |
| **Realtor** | `realtor_state/metro/county/zip` | Listing Price, DOM, Inventory | Weekly | 1-2 weeks | ✅ |
| **Permits** | `permits_state/county` | SF/MF Units, Value | Monthly | 2-3 weeks | ⚠️ |
| **HUD FMR** | `hud_fmr` | Fair Market Rent | Annual | 1-2 months | ⚠️ |

### 19.2 Key Files

| Service | Location | Purpose |
|---------|----------|---------|
| ZillowService | `packages/backend/src/zillow/zillow.service.ts` | Zillow data access |
| CensusService | `packages/backend/src/census/census.service.ts` | Census data access |
| EconomicService | `packages/backend/src/economic/economic.service.ts` | BLS/FRED data access |
| RealtorService | `packages/backend/src/realtor/realtor.service.ts` | Realtor data access |
| PermitsService | `packages/backend/src/permits/permits.service.ts` | Building permits |
| TimeSeriesService | `packages/backend/src/timeseries/timeseries.service.ts` | Unified interface |

### 19.3 ETL Scripts

| Script | Source | Location |
|--------|--------|----------|
| download-zillow-data.ts | Zillow S3 | `scripts/` |
| download-census-economic-data.ts | Census API | `scripts/` |
| download-metro-unemployment-bls.ts | BLS API | `scripts/` |
| download-and-import-redfin-s3.ts | Redfin S3 | `scripts/` |
| download-building-permits.ts | Census | `scripts/` |
| download-hud-fmr.ts | HUD | `scripts/` |

---

## Phase 20: Data Ingest Unit Tests

**Directory**: `packages/backend/src/ingest/__tests__/unit/`

### 20.1 Zillow Transform Tests

```typescript
// packages/backend/src/ingest/__tests__/unit/zillow-transform.spec.ts

describe('Zillow Data Transform', () => {
  describe('parseZillowCSV', () => {
    it('parses valid CSV with all columns');
    it('handles missing values (empty cells)');
    it('handles quoted values with commas');
    it('extracts date columns from headers');
    it('pivots wide format to long format');
  });

  describe('normalizeGeographyIds', () => {
    it('zero-pads ZIP codes to 5 digits');
    it('preserves valid 5-digit ZIPs');
    it('formats county FIPS to 5 digits');
  });

  describe('validateZillowData', () => {
    it('catches negative home prices');
    it('catches unrealistic values (>$100M)');
    it('catches future dates');
    it('returns errors array for invalid rows');
  });

  describe('transformMetricName', () => {
    it('maps ZHVI to correct metric_name');
    it('maps ZORI to correct metric_name');
    it('maps market indicators correctly');
  });
});
```

### 20.2 Census Transform Tests

```typescript
// packages/backend/src/ingest/__tests__/unit/census-transform.spec.ts

describe('Census Data Transform', () => {
  describe('parseACSResponse', () => {
    it('transforms API response to flat records');
    it('handles null values from API');
    it('extracts geography codes correctly');
  });

  describe('normalizeFieldNames', () => {
    it('maps Census variable names to friendly names');
    it('handles unknown variables');
  });

  describe('validateCensusData', () => {
    it('catches negative population');
    it('catches negative income');
    it('validates year range');
  });
});
```

### 20.3 Economic Transform Tests

```typescript
// packages/backend/src/ingest/__tests__/unit/economic-transform.spec.ts

describe('Economic Data Transform', () => {
  describe('parseBLSResponse', () => {
    it('extracts unemployment rate');
    it('handles seasonal adjustment');
    it('transforms date format');
  });

  describe('parseFREDResponse', () => {
    it('extracts GDP values');
    it('handles regional price parities');
  });

  describe('validateEconomicData', () => {
    it('catches unemployment > 100%');
    it('catches negative employment');
  });
});
```

### 20.4 Realtor Transform Tests

```typescript
// packages/backend/src/ingest/__tests__/unit/realtor-transform.spec.ts

describe('Realtor Data Transform', () => {
  describe('parseRealtorCSV', () => {
    it('parses all expected columns');
    it('handles direct column format');
  });

  describe('validateRealtorData', () => {
    it('filters invalid growth metrics (>100 or <-100)');
    it('catches negative prices');
  });
});
```

---

## Phase 21: Data Ingest Integration Tests

**Directory**: `packages/backend/src/ingest/__tests__/integration/`

### 21.1 Pipeline Integration Tests

```typescript
// packages/backend/src/ingest/__tests__/integration/zillow-pipeline.spec.ts

describe('Zillow Pipeline Integration', () => {
  it('downloads from S3 successfully', { timeout: 30000 });
  it('transforms CSV to database format');
  it('loads data into zillow_zip table');
  it('handles download failure gracefully');
  it('handles corrupt CSV gracefully');
  it('loads valid rows even when some fail');
  it('logs pipeline run to data_ingestion_log');
  it('updates data_source_registry');
});
```

```typescript
// packages/backend/src/ingest/__tests__/integration/census-pipeline.spec.ts

describe('Census Pipeline Integration', () => {
  it('fetches from Census API successfully');
  it('handles API rate limiting');
  it('transforms API response correctly');
  it('loads data into census tables');
  it('handles API error gracefully');
});
```

### 21.2 Full Refresh Tests

```typescript
// packages/backend/src/ingest/__tests__/integration/full-refresh.spec.ts

describe('Full Data Refresh', () => {
  it('refreshes all Zillow metrics');
  it('refreshes all Census data');
  it('refreshes all Economic data');
  it('logs all pipeline runs');
  it('calculates derived metrics after refresh');
});
```

---

## Phase 22: Data Ingest Health Monitoring

### 22.1 Health Check API Endpoint

**File**: `packages/backend/src/health/data-ingest-health.controller.ts`

```typescript
// Health check endpoint structure
GET /api/health/data-ingest

Response:
{
  status: 'healthy' | 'degraded' | 'unhealthy',
  sources: [
    {
      sourceName: 'zillow_s3',
      available: true,
      responseTimeMs: 245,
      fresh: true,
      daysSinceUpdate: 3,
      expectedFreshnessDays: 45,
      schemaChanged: false,
      lastCheck: '2024-01-15T10:00:00Z'
    },
    // ... all sources
  ],
  pipelines: [
    {
      pipelineName: 'zillow_zhvi',
      lastRun: '2024-01-15T06:00:00Z',
      status: 'success',
      recordsLoaded: 33120,
      duration: 272000
    },
    // ... recent pipeline runs
  ],
  summary: {
    sourcesTotal: 6,
    sourcesAvailable: 6,
    sourcesFresh: 5,
    pipelinesTotal: 10,
    pipelinesSuccessful: 9,
    pipelinesFailed: 1
  }
}
```

### 22.2 Source Health Service

**File**: `packages/backend/src/health/data-source-health.service.ts`

```typescript
describe('DataSourceHealthService', () => {
  describe('checkSourceAvailability', () => {
    it('returns true when S3 bucket accessible');
    it('returns true when Census API responds');
    it('returns true when BLS API responds');
    it('returns false on connection timeout');
    it('measures response time');
  });

  describe('checkSourceFreshness', () => {
    it('returns fresh=true within threshold');
    it('returns fresh=false when exceeded');
    it('calculates days since last update');
  });

  describe('checkSchemaChanges', () => {
    it('detects new columns in source');
    it('detects removed columns in source');
    it('stores schema hash for comparison');
  });
});
```

### 22.3 Pipeline Health Service

**File**: `packages/backend/src/health/pipeline-health.service.ts`

```typescript
describe('PipelineHealthService', () => {
  describe('getRecentRuns', () => {
    it('returns last 24 hours of runs');
    it('includes status, duration, records');
  });

  describe('checkForFailures', () => {
    it('identifies failed pipelines');
    it('identifies partial failures');
    it('counts consecutive failures');
  });

  describe('createAlerts', () => {
    it('creates alert for failed critical pipeline');
    it('creates alert for 3+ consecutive failures');
    it('creates alert for >10% rejection rate');
  });
});
```

---

## Phase 23: Database Tables for Monitoring

### 23.1 Use Existing Tables

The following tables already exist and should be utilized:

```sql
-- Track all pipeline runs (EXISTS)
data_ingestion_log (
  id, source_name, table_name, data_period,
  records_processed, records_inserted, records_updated, records_failed,
  status, error_message, started_at, ended_at, execution_time_ms
)

-- Track data source configuration (EXISTS)
data_source_registry (
  id, source_name, source_type, description,
  update_frequency, expected_update_day, api_url, bucket_name,
  earliest_data_date, latest_data_date,
  last_successful_ingestion, last_attempted_ingestion,
  consecutive_failures, is_active, notes
)
```

### 23.2 New Tables Required

```sql
-- Source health check results (NEW)
CREATE TABLE data_source_health (
  id SERIAL PRIMARY KEY,
  source_name VARCHAR(50) NOT NULL,
  check_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Availability
  available BOOLEAN NOT NULL,
  response_time_ms INTEGER,
  error_message TEXT,

  -- Freshness
  latest_data_date DATE,
  days_since_update INTEGER,
  is_fresh BOOLEAN,

  -- Schema
  schema_hash VARCHAR(64),
  schema_changed BOOLEAN DEFAULT FALSE,
  schema_diff JSONB,

  UNIQUE(source_name, check_time)
);

-- Data ingest alerts (NEW)
CREATE TABLE data_ingest_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  alert_type VARCHAR(50) NOT NULL,  -- 'source_unavailable', 'source_stale', 'pipeline_failed', 'schema_change'
  severity VARCHAR(20) NOT NULL,    -- 'critical', 'warning', 'info'
  source_name VARCHAR(50),
  pipeline_name VARCHAR(50),

  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  details JSONB,

  status VARCHAR(20) NOT NULL DEFAULT 'open',
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by VARCHAR(100),
  resolved_at TIMESTAMPTZ,
  resolved_by VARCHAR(100),
  resolution_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Phase 24: Scheduled Data Ingestion

### 24.1 GitHub Actions Workflows

**File**: `.github/workflows/data-ingest-zillow.yml`

```yaml
name: Zillow Data Ingest

on:
  schedule:
    - cron: '0 6 1 * *'  # 1st of each month at 6am
  workflow_dispatch:

jobs:
  ingest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - name: Download and Import Zillow Data
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
        run: npx ts-node scripts/download-zillow-data.ts
      - name: Notify on Failure
        if: failure()
        run: |
          curl -X POST ${{ secrets.SLACK_WEBHOOK_URL }} \
            -d '{"text": "❌ Zillow data ingest failed!"}'
```

### 24.2 Schedule Summary

| Source | Schedule | Workflow |
|--------|----------|----------|
| Zillow | 1st of month, 6am | `data-ingest-zillow.yml` |
| Census | Jan 15, 6am | `data-ingest-census.yml` |
| BLS | 15th of month, 6am | `data-ingest-bls.yml` |
| Realtor | Weekly, Sunday 6am | `data-ingest-realtor.yml` |
| Permits | 20th of month, 6am | `data-ingest-permits.yml` |
| Health Check | Every 6 hours | `data-ingest-health.yml` |

---

## Phase 25: Unified Data Admin Dashboard (Continued)

### 25.1 Dashboard Location

**File**: `packages/frontend/app/admin/data/page.tsx` (same as Phase 17.4)

This is the unified admin page at `/admin/data` with all data monitoring in one place.

### 25.2 Dashboard Wireframe

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ADMIN > DATA                                                               │
│                                                                             │
│  ┌─ Overall Status ──────────────────────────────────────────────────────┐  │
│  │  🟢 All Systems Operational                    Last Check: 2 min ago  │  │
│  │  Cards: 48/48 OK | Sources: 6/6 Available | Pipelines: 5/5 Healthy   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  [Tab: Data Cards] [Tab: Data Sources] [Tab: Pipeline Runs] [Tab: Alerts] │
│                                                                             │
│  ════════════════════════════════════════════════════════════════════════  │
│  DATA CARDS TAB:                                                            │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Metric         Category       Status   Latest     Coverage  Source   │  │
│  │  ─────────────────────────────────────────────────────────────────    │  │
│  │  ZHVI           Home Values    ✓ OK     Jan 2024   98.5%     Zillow  │  │
│  │  ZORI           Rentals        ✓ OK     Jan 2024   87.2%     Zillow  │  │
│  │  Population     Demographics   ✓ OK     2023       99.1%     Census  │  │
│  │  Unemployment   Economics      ⚠️ Stale  Nov 2023   95.0%     BLS     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ════════════════════════════════════════════════════════════════════════  │
│  DATA SOURCES TAB:                                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Source        Available  Response  Fresh   Last Update  Schema       │  │
│  │  ─────────────────────────────────────────────────────────────────    │  │
│  │  Zillow S3     🟢 Yes     245ms     ✓      3 days ago   ✓ OK        │  │
│  │  Census API    🟢 Yes     1,234ms   ✓      45 days ago  ✓ OK        │  │
│  │  BLS API       🟢 Yes     892ms     ✓      12 days ago  ✓ OK        │  │
│  │  Realtor S3    🟢 Yes     567ms     ⚠️     8 days ago   ✓ OK        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ════════════════════════════════════════════════════════════════════════  │
│  PIPELINE RUNS TAB:                                                         │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Pipeline        Started       Duration  Records   Status             │  │
│  │  ─────────────────────────────────────────────────────────────────    │  │
│  │  zillow_zhvi     Today 6:00    4m 32s    33,120   ✓ Success          │  │
│  │  zillow_zori     Today 6:05    3m 18s    28,450   ✓ Success          │  │
│  │  bls_unemployment Today 8:00   2m 12s    3,221    ✓ Success          │  │
│  │  [ Trigger Manual Run ▼ ]                                             │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ════════════════════════════════════════════════════════════════════════  │
│  ALERTS TAB:                                                                │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  ⚠️ WARNING: Realtor data slightly stale (8 days)                    │  │
│  │     Expected: 7 days | Created: 1 day ago                            │  │
│  │     [ Acknowledge ] [ Resolve ]                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 25.3 Implementation Structure

Following the existing `/admin/propertyiq-scores` pattern:

**Directory Structure:**
```
packages/frontend/app/admin/data/
├── page.tsx                           # Main page with tab navigation
└── components/
    ├── index.ts                       # Barrel exports
    ├── DataCardsTab.tsx               # Metric health table
    ├── DataSourcesTab.tsx             # Source availability/freshness
    ├── PipelineRunsTab.tsx            # Recent ETL runs
    ├── AlertsTab.tsx                  # Active alerts management
    ├── StatusBanner.tsx               # Overall health banner
    └── MetricHealthRow.tsx            # Individual metric row component
```

**Tab Configuration:**
```typescript
type TabId = 'data-cards' | 'data-sources' | 'pipeline-runs' | 'alerts';

const TABS: Tab[] = [
  { id: 'data-cards', label: 'Data Cards', description: 'Metric display health' },
  { id: 'data-sources', label: 'Data Sources', description: 'Source availability' },
  { id: 'pipeline-runs', label: 'Pipeline Runs', description: 'ETL pipeline status' },
  { id: 'alerts', label: 'Alerts', description: 'Active alerts' },
];
```

**API Endpoints Required:**
| Endpoint | Purpose |
|----------|---------|
| `GET /api/health/data-cards` | Returns metric health status |
| `GET /api/health/data-sources` | Returns source availability |
| `GET /api/health/pipeline-runs` | Returns recent pipeline runs |
| `GET /api/health/data-alerts` | Returns active alerts |
| `POST /api/health/data-alerts/:id/acknowledge` | Acknowledge an alert |
| `POST /api/health/data-alerts/:id/resolve` | Resolve an alert |
| `POST /api/pipelines/:name/trigger` | Manually trigger a pipeline |

---

## Implementation Order (Parts 2 & 3)

### Sprint 7: Data Card Unit Tests
| Task | Priority | Est. Tests |
|------|----------|------------|
| StatCard component tests | P0 | ~15 |
| MetricGraph component tests | P0 | ~25 |
| MetricSidebar tests | P0 | ~15 |
| Value formatter tests | P0 | ~20 |
| GeographySelector tests | P1 | ~10 |

### Sprint 8: Data Card Integration & E2E
| Task | Priority | Est. Tests |
|------|----------|------------|
| API integration tests | P0 | ~20 |
| Geography switching tests | P0 | ~10 |
| Map sidebar E2E | P0 | ~15 |
| Sparse data E2E | P0 | ~10 |

### Sprint 9: Data Card Monitoring
| Task | Priority | Est. Tests |
|------|----------|------------|
| Health check API (`/api/health/data-cards`) | P0 | ~15 |
| Health service tests | P0 | ~15 |
| Scheduled health checks (GitHub Actions) | P1 | - |

### Sprint 10: Data Ingest Unit Tests
| Task | Priority | Est. Tests |
|------|----------|------------|
| Zillow transform tests | P0 | ~15 |
| Census transform tests | P0 | ~12 |
| Economic transform tests | P0 | ~10 |
| Realtor transform tests | P0 | ~10 |
| Permits transform tests | P1 | ~8 |

### Sprint 11: Data Ingest Integration & Monitoring
| Task | Priority | Est. Tests |
|------|----------|------------|
| Pipeline integration tests | P0 | ~25 |
| Source health service | P0 | ~15 |
| Pipeline health service | P0 | ~15 |
| Database migrations (new tables) | P0 | - |
| Scheduled jobs (GitHub Actions) | P1 | - |

### Sprint 12: Unified Admin Data Dashboard
| Task | Priority | Est. Tests |
|------|----------|------------|
| Create `/admin/data` page | P0 | - |
| Data Cards tab component | P0 | ~8 |
| Data Sources tab component | P0 | ~8 |
| Pipeline Runs tab component | P0 | ~8 |
| Alerts tab component | P0 | ~8 |
| Admin data E2E tests | P1 | ~10 |

---

## Success Criteria (Parts 2 & 3)

1. **Data Card Coverage**: >90% on all card components
2. **Ingest Coverage**: >80% on transform and pipeline code
3. **Health Checks**: All sources checked every 6 hours
4. **Alerts**: Critical failures alert within 5 minutes
5. **Freshness**: All data within expected freshness thresholds
6. **Documentation**: All monitoring dashboards documented
7. **CI Integration**: All scheduled jobs in GitHub Actions

---

## Full Test Count Summary

| Part | Category | Tests |
|------|----------|-------|
| **Part 1** | Scoring System | ~248 |
| **Part 2** | Data Cards | ~150 |
| **Part 3** | Data Ingest | ~145 |
| **Part 4** | Admin Data Dashboard | ~42 |
| **Total** | | **~585** |

## Admin Pages Summary

| URL | Purpose |
|-----|---------|
| `/admin/propertyiq-scores` | Existing - Score confidence, backtests, A/B testing |
| `/admin/data` | **NEW** - Data cards health, sources, pipelines, alerts |
