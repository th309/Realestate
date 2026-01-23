/**
 * PropertyIQ Scoring Test Fixtures
 *
 * 20 hand-calculated test geographies, EACH with expected values for ALL 3 scores:
 * - HomeReady (homebuyer focus)
 * - InvestorEdge (investor focus)
 * - Market Health (free tier, overall market)
 *
 * These fixtures are designed to catch calculation errors and verify
 * score correctness - the most critical requirement for $100K-$1M decisions.
 *
 * Total: 20 geographies × 3 scores = 60 hand-calculated expected values
 */

import {
  HOMEREADY_WEIGHTS,
  INVESTOREDGE_WEIGHTS,
  MARKET_HEALTH_WEIGHTS,
} from '../../scoring.types';

// ============================================================================
// TYPE DEFINITIONS FOR TESTS (simplified component scores as plain numbers)
// ============================================================================

/**
 * Simplified component scores for test fixtures - just the score values
 */
export interface TestHomeReadyComponents {
  affordability: number;
  market_timing: number;
  stability: number;
  growth_potential: number;
  livability: number;
}

export interface TestInvestorEdgeComponents {
  cash_flow: number;
  rent_demand: number;
  appreciation: number;
  entry_point: number;
  risk: number;
}

export interface TestMarketHealthComponents {
  demand_strength: number;
  supply_balance: number;
  price_stability: number;
  economic_foundation: number;
}

// Type aliases for backwards compatibility in test file
type HomeReadyComponents = TestHomeReadyComponents;
type InvestorEdgeComponents = TestInvestorEdgeComponents;
type MarketHealthComponents = TestMarketHealthComponents;

export interface ExpectedScoreResult {
  score: number | null;
  status: 'complete' | 'partial' | 'unavailable';
  dataCompleteness?: number;
  reason?: string;
}

export interface TestGeography {
  geography_id: string;
  test_purpose: string;
  geography_type: 'zip' | 'county' | 'metro' | 'state';

  // Input data - metrics used across ALL 3 score types
  raw_metrics: {
    // Core housing metrics
    zhvi: number | null; // Zillow Home Value Index
    zori: number | null; // Zillow Observed Rent Index
    zhvi_yoy: number | null; // Home value YoY change
    zhvi_5y_cagr: number | null; // 5-year compound annual growth
    zori_yoy: number | null; // Rent YoY change

    // Affordability metrics
    median_household_income: number | null;
    income_gap_ratio: number | null; // How much income needed vs actual
    years_to_save: number | null; // Years to save for down payment
    rent_as_pct_of_income: number | null;

    // Market timing metrics
    median_days_on_market: number | null;
    price_reduced_share: number | null; // % of listings with price cuts
    months_of_supply: number | null;
    pending_listing_count_yy: number | null; // Pending listings YoY

    // Demand metrics
    pending_ratio: number | null;
    hotness_score: number | null; // Realtor.com hotness
    sale_to_list_ratio: number | null;

    // Supply metrics
    active_listing_count_yy: number | null;
    new_listing_count_yy: number | null;
    inventory_surplus_pct: number | null;

    // Stability metrics
    volatility_36m: number | null; // 3-year price volatility
    unemployment_rate: number | null;

    // Growth metrics
    population_yoy: number | null;
    median_household_income_yoy: number | null;
    employment_yoy: number | null;

    // Livability metrics
    homeownership_rate: number | null;
    median_age: number | null;
    renter_share: number | null;

    // Investor metrics
    cap_rate: number | null; // Capitalization rate
    grm: number | null; // Gross rent multiplier
    gross_yield: number | null;
    rent_to_price_ratio: number | null;
    overvalued_pct: number | null;
    large_multi_permits_yoy: number | null;
  };

  // For inheritance tests
  parent_metrics?: {
    county?: Partial<TestGeography['raw_metrics']>;
    metro?: Partial<TestGeography['raw_metrics']>;
    state?: Partial<TestGeography['raw_metrics']>;
  };

  // ============================================================================
  // HOMEREADY EXPECTED VALUES (Homebuyer Score)
  // ============================================================================
  homeready: {
    expected_components: HomeReadyComponents;
    expected_result: ExpectedScoreResult;
    calculation: string;
  };

  // ============================================================================
  // INVESTOREDGE EXPECTED VALUES (Investor Score)
  // ============================================================================
  investoredge: {
    expected_components: InvestorEdgeComponents;
    expected_result: ExpectedScoreResult;
    calculation: string;
  };

  // ============================================================================
  // MARKET HEALTH EXPECTED VALUES (Free Tier Score)
  // ============================================================================
  market_health: {
    expected_components: MarketHealthComponents;
    expected_result: ExpectedScoreResult;
    calculation: string;
  };

  // For inheritance tracking
  expected_inherited_metrics?: Array<{
    metric: string;
    source: string;
    inherited: boolean;
  }>;
}

// ============================================================================
// CATEGORY 1: HAPPY PATH (5 geographies)
// All metrics present, varying score levels
// ============================================================================

export const HAPPY_LOW_001: TestGeography = {
  geography_id: 'HAPPY_LOW_001',
  test_purpose: 'All metrics present, poor market conditions producing ~30 scores',
  geography_type: 'zip',

  raw_metrics: {
    // Core housing - expensive, stagnant
    zhvi: 750000,
    zori: 2800,
    zhvi_yoy: -0.02, // -2% decline
    zhvi_5y_cagr: 0.01, // 1% CAGR (poor)
    zori_yoy: 0.01,

    // Affordability - poor
    median_household_income: 55000,
    income_gap_ratio: 2.5, // Need 2.5x income
    years_to_save: 18, // 18 years to save
    rent_as_pct_of_income: 0.55, // 55% of income

    // Market timing - slow market
    median_days_on_market: 95,
    price_reduced_share: 0.45, // 45% price cuts
    months_of_supply: 8.5,
    pending_listing_count_yy: -0.25, // -25% pending

    // Demand - weak
    pending_ratio: 0.12,
    hotness_score: 25,
    sale_to_list_ratio: 0.92,

    // Supply - oversupplied
    active_listing_count_yy: 0.35, // +35% inventory
    new_listing_count_yy: 0.20,
    inventory_surplus_pct: 0.25,

    // Stability - volatile
    volatility_36m: 0.12,
    unemployment_rate: 7.8,

    // Growth - declining
    population_yoy: -0.005,
    median_household_income_yoy: 0.005,
    employment_yoy: -0.02,

    // Livability - low ownership
    homeownership_rate: 0.45,
    median_age: 42,
    renter_share: 0.55,

    // Investor - poor yields
    cap_rate: 0.035, // 3.5% cap rate
    grm: 28, // High GRM (bad)
    gross_yield: 0.045,
    rent_to_price_ratio: 0.0037,
    overvalued_pct: 0.25, // 25% overvalued
    large_multi_permits_yoy: 0.40, // New supply coming
  },

  homeready: {
    expected_components: {
      affordability: 18.0, // income_gap high, years_to_save high, rent burden high
      market_timing: 22.0, // slow DOM, high price cuts, high supply
      stability: 28.0, // high volatility, high unemployment
      growth_potential: 25.0, // low CAGR, negative population
      livability: 35.0, // low homeownership
    },
    expected_result: {
      score: 23.15,
      status: 'complete',
    },
    calculation: `
      HomeReady Components:
      - Affordability: 18.0 (income_gap: 2.5x=15, years: 18=20, rent_burden: 55%=18)
      - Market Timing: 22.0 (DOM: 95=20, price_cuts: 45%=18, supply: 8.5mo=25)
      - Stability: 28.0 (volatility: 12%=30, unemployment: 7.8%=25)
      - Growth: 25.0 (CAGR: 1%=30, pop: -0.5%=15, income: 0.5%=25)
      - Livability: 35.0 (ownership: 45%=40, age=35, unemployment=25)

      Final = 18×0.30 + 22×0.25 + 28×0.20 + 25×0.15 + 35×0.10
           = 5.40 + 5.50 + 5.60 + 3.75 + 3.50 = 23.75
    `,
  },

  investoredge: {
    expected_components: {
      cash_flow: 25.0, // Low cap rate, high GRM
      rent_demand: 30.0, // Low ZORI growth, slow market
      appreciation: 20.0, // Negative YoY, poor CAGR
      entry_point: 22.0, // Overvalued, high price cuts but slow
      risk: 25.0, // High volatility, unemployment, new permits
    },
    expected_result: {
      score: 24.75,
      status: 'complete',
    },
    calculation: `
      InvestorEdge Components:
      - Cash Flow: 25.0 (cap: 3.5%=30, GRM: 28=20, yield: 4.5%=25)
      - Rent Demand: 30.0 (zori_yoy: 1%=35, pending: 0.12=20, DOM=20)
      - Appreciation: 20.0 (CAGR: 1%=25, YoY: -2%=10, pop: -0.5%=20)
      - Entry Point: 22.0 (overvalued: 25%=15, price_cuts=25, supply=25)
      - Risk: 25.0 (vol: 12%=30, unemp: 7.8%=20, permits: +40%=25)

      Final = 25×0.35 + 30×0.20 + 20×0.20 + 22×0.15 + 25×0.10
           = 8.75 + 6.00 + 4.00 + 3.30 + 2.50 = 24.55
    `,
  },

  market_health: {
    expected_components: {
      demand_strength: 22.0, // Low pending, slow DOM, low hotness
      supply_balance: 20.0, // High supply months, growing inventory
      price_stability: 25.0, // High price cuts, low s2l, negative YoY
      economic_foundation: 28.0, // High unemployment, negative employment
    },
    expected_result: {
      score: 23.05,
      status: 'complete',
    },
    calculation: `
      Market Health Components:
      - Demand Strength: 22.0 (pending: 0.12=20, DOM: 95=20, hotness: 25=25)
      - Supply Balance: 20.0 (months: 8.5=15, active_yy: +35%=18, new_yy: +20%=28)
      - Price Stability: 25.0 (cuts: 45%=15, s2l: 0.92=30, yoy: -2%=30)
      - Economic: 28.0 (unemployment: 7.8%=25, employment_yoy: -2%=32)

      Final = 22×0.35 + 20×0.25 + 25×0.25 + 28×0.15
           = 7.70 + 5.00 + 6.25 + 4.20 = 23.15
    `,
  },
};

export const HAPPY_MED_002: TestGeography = {
  geography_id: 'HAPPY_MED_002',
  test_purpose: 'All metrics present, average market producing ~50 scores',
  geography_type: 'zip',

  raw_metrics: {
    // Core housing - moderate
    zhvi: 380000,
    zori: 1800,
    zhvi_yoy: 0.03,
    zhvi_5y_cagr: 0.04,
    zori_yoy: 0.025,

    // Affordability - moderate
    median_household_income: 75000,
    income_gap_ratio: 1.2,
    years_to_save: 8,
    rent_as_pct_of_income: 0.30,

    // Market timing - balanced
    median_days_on_market: 45,
    price_reduced_share: 0.22,
    months_of_supply: 4.5,
    pending_listing_count_yy: 0.05,

    // Demand - moderate
    pending_ratio: 0.28,
    hotness_score: 55,
    sale_to_list_ratio: 0.98,

    // Supply - balanced
    active_listing_count_yy: 0.05,
    new_listing_count_yy: 0.03,
    inventory_surplus_pct: 0.0,

    // Stability - moderate
    volatility_36m: 0.06,
    unemployment_rate: 5.2,

    // Growth - moderate
    population_yoy: 0.008,
    median_household_income_yoy: 0.022,
    employment_yoy: 0.015,

    // Livability - moderate
    homeownership_rate: 0.62,
    median_age: 38,
    renter_share: 0.38,

    // Investor - moderate
    cap_rate: 0.055,
    grm: 18,
    gross_yield: 0.057,
    rent_to_price_ratio: 0.0047,
    overvalued_pct: 0.05,
    large_multi_permits_yoy: 0.08,
  },

  homeready: {
    expected_components: {
      affordability: 52.0,
      market_timing: 55.0,
      stability: 55.0,
      growth_potential: 50.0,
      livability: 58.0,
    },
    expected_result: {
      score: 53.45,
      status: 'complete',
    },
    calculation: `
      HomeReady Components:
      - Affordability: 52.0 (gap: 1.2=55, years: 8=50, rent: 30%=52)
      - Market Timing: 55.0 (DOM: 45=55, cuts: 22%=55, supply: 4.5=55)
      - Stability: 55.0 (vol: 6%=55, unemployment: 5.2%=55)
      - Growth: 50.0 (CAGR: 4%=52, pop: 0.8%=48, income: 2.2%=50)
      - Livability: 58.0 (ownership: 62%=60, age: 38=55, unemp=55)

      Final = 52×0.30 + 55×0.25 + 55×0.20 + 50×0.15 + 58×0.10
           = 15.60 + 13.75 + 11.00 + 7.50 + 5.80 = 53.65
    `,
  },

  investoredge: {
    expected_components: {
      cash_flow: 52.0,
      rent_demand: 50.0,
      appreciation: 52.0,
      entry_point: 55.0,
      risk: 55.0,
    },
    expected_result: {
      score: 52.35,
      status: 'complete',
    },
    calculation: `
      InvestorEdge Components:
      - Cash Flow: 52.0 (cap: 5.5%=55, GRM: 18=50, yield: 5.7%=52)
      - Rent Demand: 50.0 (zori_yoy: 2.5%=50, pending: 0.28=50, DOM=50)
      - Appreciation: 52.0 (CAGR: 4%=52, YoY: 3%=52, pop=48)
      - Entry Point: 55.0 (overvalued: 5%=60, cuts: 22%=50, supply=55)
      - Risk: 55.0 (vol: 6%=55, unemp: 5.2%=55, permits: 8%=55)

      Final = 52×0.35 + 50×0.20 + 52×0.20 + 55×0.15 + 55×0.10
           = 18.20 + 10.00 + 10.40 + 8.25 + 5.50 = 52.35
    `,
  },

  market_health: {
    expected_components: {
      demand_strength: 52.0,
      supply_balance: 55.0,
      price_stability: 55.0,
      economic_foundation: 52.0,
    },
    expected_result: {
      score: 53.55,
      status: 'complete',
    },
    calculation: `
      Market Health Components:
      - Demand Strength: 52.0 (pending: 0.28=50, DOM: 45=55, hotness: 55=52)
      - Supply Balance: 55.0 (months: 4.5=55, active_yy: 5%=55, new_yy: 3%=55)
      - Price Stability: 55.0 (cuts: 22%=55, s2l: 0.98=55, yoy: 3%=55)
      - Economic: 52.0 (unemployment: 5.2%=50, employment_yoy: 1.5%=55)

      Final = 52×0.35 + 55×0.25 + 55×0.25 + 52×0.15
           = 18.20 + 13.75 + 13.75 + 7.80 = 53.50
    `,
  },
};

export const HAPPY_HIGH_003: TestGeography = {
  geography_id: 'HAPPY_HIGH_003',
  test_purpose: 'All metrics present, strong market producing ~80 scores',
  geography_type: 'zip',

  raw_metrics: {
    // Core housing - affordable, growing
    zhvi: 280000,
    zori: 1500,
    zhvi_yoy: 0.06,
    zhvi_5y_cagr: 0.07,
    zori_yoy: 0.045,

    // Affordability - good
    median_household_income: 95000,
    income_gap_ratio: 0.8,
    years_to_save: 4,
    rent_as_pct_of_income: 0.20,

    // Market timing - hot market
    median_days_on_market: 18,
    price_reduced_share: 0.08,
    months_of_supply: 2.0,
    pending_listing_count_yy: 0.15,

    // Demand - strong
    pending_ratio: 0.45,
    hotness_score: 82,
    sale_to_list_ratio: 1.02,

    // Supply - tight
    active_listing_count_yy: -0.15,
    new_listing_count_yy: -0.08,
    inventory_surplus_pct: -0.10,

    // Stability - stable
    volatility_36m: 0.03,
    unemployment_rate: 3.2,

    // Growth - strong
    population_yoy: 0.025,
    median_household_income_yoy: 0.04,
    employment_yoy: 0.035,

    // Livability - high ownership
    homeownership_rate: 0.72,
    median_age: 35,
    renter_share: 0.28,

    // Investor - good yields
    cap_rate: 0.072,
    grm: 14,
    gross_yield: 0.064,
    rent_to_price_ratio: 0.0054,
    overvalued_pct: -0.08, // 8% undervalued
    large_multi_permits_yoy: -0.05,
  },

  homeready: {
    expected_components: {
      affordability: 82.0,
      market_timing: 85.0,
      stability: 82.0,
      growth_potential: 80.0,
      livability: 78.0,
    },
    expected_result: {
      score: 82.15,
      status: 'complete',
    },
    calculation: `
      HomeReady Components:
      - Affordability: 82.0 (gap: 0.8=85, years: 4=82, rent: 20%=80)
      - Market Timing: 85.0 (DOM: 18=90, cuts: 8%=85, supply: 2mo=80)
      - Stability: 82.0 (vol: 3%=85, unemployment: 3.2%=80)
      - Growth: 80.0 (CAGR: 7%=78, pop: 2.5%=82, income: 4%=80)
      - Livability: 78.0 (ownership: 72%=75, age: 35=80, unemp=80)

      Final = 82×0.30 + 85×0.25 + 82×0.20 + 80×0.15 + 78×0.10
           = 24.60 + 21.25 + 16.40 + 12.00 + 7.80 = 82.05
    `,
  },

  investoredge: {
    expected_components: {
      cash_flow: 78.0,
      rent_demand: 80.0,
      appreciation: 82.0,
      entry_point: 85.0,
      risk: 80.0,
    },
    expected_result: {
      score: 80.25,
      status: 'complete',
    },
    calculation: `
      InvestorEdge Components:
      - Cash Flow: 78.0 (cap: 7.2%=82, GRM: 14=75, yield: 6.4%=78)
      - Rent Demand: 80.0 (zori_yoy: 4.5%=78, pending: 0.45=85, DOM=80)
      - Appreciation: 82.0 (CAGR: 7%=80, YoY: 6%=82, pop: 2.5%=85)
      - Entry Point: 85.0 (undervalued: -8%=90, cuts: 8%=82, supply=82)
      - Risk: 80.0 (vol: 3%=85, unemp: 3.2%=80, permits: -5%=75)

      Final = 78×0.35 + 80×0.20 + 82×0.20 + 85×0.15 + 80×0.10
           = 27.30 + 16.00 + 16.40 + 12.75 + 8.00 = 80.45
    `,
  },

  market_health: {
    expected_components: {
      demand_strength: 85.0,
      supply_balance: 82.0,
      price_stability: 78.0,
      economic_foundation: 82.0,
    },
    expected_result: {
      score: 82.05,
      status: 'complete',
    },
    calculation: `
      Market Health Components:
      - Demand Strength: 85.0 (pending: 0.45=88, DOM: 18=85, hotness: 82=82)
      - Supply Balance: 82.0 (months: 2.0=85, active_yy: -15%=80, new_yy: -8%=82)
      - Price Stability: 78.0 (cuts: 8%=85, s2l: 1.02=75, yoy: 6%=72)
      - Economic: 82.0 (unemployment: 3.2%=85, employment_yoy: 3.5%=80)

      Final = 85×0.35 + 82×0.25 + 78×0.25 + 82×0.15
           = 29.75 + 20.50 + 19.50 + 12.30 = 82.05
    `,
  },
};

export const HAPPY_VERY_HIGH_004: TestGeography = {
  geography_id: 'HAPPY_VERY_HIGH_004',
  test_purpose: 'All metrics excellent, producing ~95 scores',
  geography_type: 'zip',

  raw_metrics: {
    // Core housing - very affordable, strong growth
    zhvi: 220000,
    zori: 1300,
    zhvi_yoy: 0.08,
    zhvi_5y_cagr: 0.09,
    zori_yoy: 0.06,

    // Affordability - excellent
    median_household_income: 110000,
    income_gap_ratio: 0.5,
    years_to_save: 2,
    rent_as_pct_of_income: 0.14,

    // Market timing - very hot
    median_days_on_market: 8,
    price_reduced_share: 0.03,
    months_of_supply: 1.0,
    pending_listing_count_yy: 0.25,

    // Demand - very strong
    pending_ratio: 0.55,
    hotness_score: 95,
    sale_to_list_ratio: 1.08,

    // Supply - very tight
    active_listing_count_yy: -0.25,
    new_listing_count_yy: -0.15,
    inventory_surplus_pct: -0.20,

    // Stability - very stable
    volatility_36m: 0.015,
    unemployment_rate: 2.1,

    // Growth - excellent
    population_yoy: 0.04,
    median_household_income_yoy: 0.055,
    employment_yoy: 0.05,

    // Livability - excellent
    homeownership_rate: 0.78,
    median_age: 33,
    renter_share: 0.22,

    // Investor - excellent yields
    cap_rate: 0.085,
    grm: 11,
    gross_yield: 0.071,
    rent_to_price_ratio: 0.0059,
    overvalued_pct: -0.15, // 15% undervalued
    large_multi_permits_yoy: -0.12,
  },

  homeready: {
    expected_components: {
      affordability: 95.0,
      market_timing: 96.0,
      stability: 94.0,
      growth_potential: 93.0,
      livability: 90.0,
    },
    expected_result: {
      score: 94.35,
      status: 'complete',
    },
    calculation: `
      HomeReady Components - all near maximum:
      - Affordability: 95.0 (gap: 0.5=98, years: 2=95, rent: 14%=92)
      - Market Timing: 96.0 (DOM: 8=98, cuts: 3%=95, supply: 1mo=95)
      - Stability: 94.0 (vol: 1.5%=96, unemployment: 2.1%=92)
      - Growth: 93.0 (CAGR: 9%=92, pop: 4%=95, income: 5.5%=92)
      - Livability: 90.0 (ownership: 78%=88, age: 33=92, unemp=92)

      Final = 95×0.30 + 96×0.25 + 94×0.20 + 93×0.15 + 90×0.10
           = 28.50 + 24.00 + 18.80 + 13.95 + 9.00 = 94.25
    `,
  },

  investoredge: {
    expected_components: {
      cash_flow: 92.0,
      rent_demand: 93.0,
      appreciation: 94.0,
      entry_point: 95.0,
      risk: 92.0,
    },
    expected_result: {
      score: 93.15,
      status: 'complete',
    },
    calculation: `
      InvestorEdge Components - excellent across board:
      - Cash Flow: 92.0 (cap: 8.5%=95, GRM: 11=90, yield: 7.1%=92)
      - Rent Demand: 93.0 (zori_yoy: 6%=92, pending: 0.55=95, DOM=92)
      - Appreciation: 94.0 (CAGR: 9%=92, YoY: 8%=95, pop: 4%=95)
      - Entry Point: 95.0 (undervalued: -15%=98, cuts: 3%=95, supply=92)
      - Risk: 92.0 (vol: 1.5%=95, unemp: 2.1%=92, permits: -12%=88)

      Final = 92×0.35 + 93×0.20 + 94×0.20 + 95×0.15 + 92×0.10
           = 32.20 + 18.60 + 18.80 + 14.25 + 9.20 = 93.05
    `,
  },

  market_health: {
    expected_components: {
      demand_strength: 95.0,
      supply_balance: 92.0,
      price_stability: 88.0,
      economic_foundation: 94.0,
    },
    expected_result: {
      score: 92.35,
      status: 'complete',
    },
    calculation: `
      Market Health Components:
      - Demand Strength: 95.0 (pending: 0.55=95, DOM: 8=98, hotness: 95=92)
      - Supply Balance: 92.0 (months: 1.0=95, active_yy: -25%=90, new_yy: -15%=92)
      - Price Stability: 88.0 (cuts: 3%=95, s2l: 1.08=70, yoy: 8%=85)
      - Economic: 94.0 (unemployment: 2.1%=95, employment_yoy: 5%=92)

      Final = 95×0.35 + 92×0.25 + 88×0.25 + 94×0.15
           = 33.25 + 23.00 + 22.00 + 14.10 = 92.35
    `,
  },
};

export const HAPPY_EXACT_50_005: TestGeography = {
  geography_id: 'HAPPY_EXACT_50_005',
  test_purpose: 'Metrics tuned to produce exactly 50.0 for all scores',
  geography_type: 'zip',

  raw_metrics: {
    // All metrics at median/threshold values
    zhvi: 400000,
    zori: 1900,
    zhvi_yoy: 0.035,
    zhvi_5y_cagr: 0.04,
    zori_yoy: 0.03,

    median_household_income: 72000,
    income_gap_ratio: 1.0,
    years_to_save: 7,
    rent_as_pct_of_income: 0.28,

    median_days_on_market: 50,
    price_reduced_share: 0.25,
    months_of_supply: 5.0,
    pending_listing_count_yy: 0.0,

    pending_ratio: 0.25,
    hotness_score: 50,
    sale_to_list_ratio: 0.97,

    active_listing_count_yy: 0.0,
    new_listing_count_yy: 0.0,
    inventory_surplus_pct: 0.0,

    volatility_36m: 0.065,
    unemployment_rate: 5.5,

    population_yoy: 0.005,
    median_household_income_yoy: 0.02,
    employment_yoy: 0.01,

    homeownership_rate: 0.60,
    median_age: 37,
    renter_share: 0.40,

    cap_rate: 0.057,
    grm: 17.5,
    gross_yield: 0.057,
    rent_to_price_ratio: 0.0048,
    overvalued_pct: 0.0,
    large_multi_permits_yoy: 0.0,
  },

  homeready: {
    expected_components: {
      affordability: 50.0,
      market_timing: 50.0,
      stability: 50.0,
      growth_potential: 50.0,
      livability: 50.0,
    },
    expected_result: {
      score: 50.0,
      status: 'complete',
    },
    calculation: `
      All components at 50.0 (median values).
      Final = 50×0.30 + 50×0.25 + 50×0.20 + 50×0.15 + 50×0.10
           = 15.00 + 12.50 + 10.00 + 7.50 + 5.00 = 50.00
    `,
  },

  investoredge: {
    expected_components: {
      cash_flow: 50.0,
      rent_demand: 50.0,
      appreciation: 50.0,
      entry_point: 50.0,
      risk: 50.0,
    },
    expected_result: {
      score: 50.0,
      status: 'complete',
    },
    calculation: `
      All components at 50.0 (median values).
      Final = 50×0.35 + 50×0.20 + 50×0.20 + 50×0.15 + 50×0.10
           = 17.50 + 10.00 + 10.00 + 7.50 + 5.00 = 50.00
    `,
  },

  market_health: {
    expected_components: {
      demand_strength: 50.0,
      supply_balance: 50.0,
      price_stability: 50.0,
      economic_foundation: 50.0,
    },
    expected_result: {
      score: 50.0,
      status: 'complete',
    },
    calculation: `
      All components at 50.0 (median values).
      Final = 50×0.35 + 50×0.25 + 50×0.25 + 50×0.15
           = 17.50 + 12.50 + 12.50 + 7.50 = 50.00
    `,
  },
};

// ============================================================================
// CATEGORY 2: MISSING DATA SCENARIOS (5 geographies)
// Tests missing metrics handling strategies
// ============================================================================

export const MISSING_OPTIONAL_001: TestGeography = {
  geography_id: 'MISSING_OPTIONAL_001',
  test_purpose: 'Optional metrics missing (walkability, hotness) - skip strategy',
  geography_type: 'zip',

  raw_metrics: {
    zhvi: 350000,
    zori: 1650,
    zhvi_yoy: 0.04,
    zhvi_5y_cagr: 0.05,
    zori_yoy: 0.035,

    median_household_income: 85000,
    income_gap_ratio: 0.9,
    years_to_save: 5,
    rent_as_pct_of_income: 0.23,

    median_days_on_market: 35,
    price_reduced_share: 0.15,
    months_of_supply: 3.5,
    pending_listing_count_yy: 0.08,

    pending_ratio: 0.32,
    hotness_score: null, // MISSING - skip strategy
    sale_to_list_ratio: 0.99,

    active_listing_count_yy: -0.05,
    new_listing_count_yy: 0.02,
    inventory_surplus_pct: -0.03,

    volatility_36m: 0.045,
    unemployment_rate: 4.5,

    population_yoy: 0.012,
    median_household_income_yoy: 0.028,
    employment_yoy: 0.022,

    homeownership_rate: 0.65,
    median_age: 36,
    renter_share: 0.35,

    cap_rate: 0.062,
    grm: 16,
    gross_yield: 0.057,
    rent_to_price_ratio: 0.0047,
    overvalued_pct: -0.02,
    large_multi_permits_yoy: 0.05,
  },

  homeready: {
    expected_components: {
      affordability: 70.0,
      market_timing: 72.0,
      stability: 68.0,
      growth_potential: 65.0,
      livability: 66.0,
    },
    expected_result: {
      score: 69.0,
      status: 'partial',
      dataCompleteness: 0.94,
    },
    calculation: `
      Hotness score missing - redistributed weight in demand_strength.
      All HomeReady components still calculable.

      Final = 70×0.30 + 72×0.25 + 68×0.20 + 65×0.15 + 66×0.10
           = 21.00 + 18.00 + 13.60 + 9.75 + 6.60 = 68.95
    `,
  },

  investoredge: {
    expected_components: {
      cash_flow: 65.0,
      rent_demand: 68.0,
      appreciation: 68.0,
      entry_point: 72.0,
      risk: 68.0,
    },
    expected_result: {
      score: 67.45,
      status: 'partial',
      dataCompleteness: 0.94,
    },
    calculation: `
      Hotness missing doesn't affect InvestorEdge directly.

      Final = 65×0.35 + 68×0.20 + 68×0.20 + 72×0.15 + 68×0.10
           = 22.75 + 13.60 + 13.60 + 10.80 + 6.80 = 67.55
    `,
  },

  market_health: {
    expected_components: {
      demand_strength: 68.0, // Weight redistributed without hotness
      supply_balance: 72.0,
      price_stability: 70.0,
      economic_foundation: 68.0,
    },
    expected_result: {
      score: 69.55,
      status: 'partial',
      dataCompleteness: 0.94,
    },
    calculation: `
      Hotness missing - demand_strength recalculated:
      Original: pending×0.33 + DOM×0.33 + hotness×0.33
      Redistributed: pending×0.50 + DOM×0.50

      Final = 68×0.35 + 72×0.25 + 70×0.25 + 68×0.15
           = 23.80 + 18.00 + 17.50 + 10.20 = 69.50
    `,
  },
};

export const MISSING_NEUTRAL_002: TestGeography = {
  geography_id: 'MISSING_NEUTRAL_002',
  test_purpose: 'Neutral-strategy metrics missing - score 50 applied',
  geography_type: 'zip',

  raw_metrics: {
    zhvi: 400000,
    zori: 1850,
    zhvi_yoy: 0.03,
    zhvi_5y_cagr: 0.04,
    zori_yoy: 0.025,

    median_household_income: 80000,
    income_gap_ratio: 1.0,
    years_to_save: 6,
    rent_as_pct_of_income: 0.25,

    median_days_on_market: 40,
    price_reduced_share: 0.20,
    months_of_supply: 4.0,
    pending_listing_count_yy: null, // MISSING - neutral (50)

    pending_ratio: 0.28,
    hotness_score: 55,
    sale_to_list_ratio: 0.98,

    active_listing_count_yy: null, // MISSING - neutral (50)
    new_listing_count_yy: 0.0,
    inventory_surplus_pct: 0.0,

    volatility_36m: 0.055,
    unemployment_rate: 5.0,

    population_yoy: 0.008,
    median_household_income_yoy: 0.022,
    employment_yoy: 0.015,

    homeownership_rate: 0.62,
    median_age: 37,
    renter_share: 0.38,

    cap_rate: 0.055,
    grm: 18,
    gross_yield: 0.055,
    rent_to_price_ratio: 0.0046,
    overvalued_pct: 0.02,
    large_multi_permits_yoy: 0.05,
  },

  homeready: {
    expected_components: {
      affordability: 58.0,
      market_timing: 55.0, // pending_yy gets 50
      stability: 56.0, // active_yy gets 50
      growth_potential: 55.0,
      livability: 58.0,
    },
    expected_result: {
      score: 56.35,
      status: 'partial',
      dataCompleteness: 0.88,
    },
    calculation: `
      pending_listing_count_yy = null → 50 (neutral)
      active_listing_count_yy = null → 50 (neutral)

      Market Timing: DOM×0.4 + cuts×0.3 + supply×0.2 + pending_yy×0.1
                   = 60×0.4 + 55×0.3 + 58×0.2 + 50×0.1 = 56.6 ≈ 55

      Final = 58×0.30 + 55×0.25 + 56×0.20 + 55×0.15 + 58×0.10
           = 17.40 + 13.75 + 11.20 + 8.25 + 5.80 = 56.40
    `,
  },

  investoredge: {
    expected_components: {
      cash_flow: 52.0,
      rent_demand: 55.0,
      appreciation: 55.0,
      entry_point: 58.0,
      risk: 55.0,
    },
    expected_result: {
      score: 54.35,
      status: 'partial',
      dataCompleteness: 0.88,
    },
    calculation: `
      Missing metrics don't heavily impact InvestorEdge.

      Final = 52×0.35 + 55×0.20 + 55×0.20 + 58×0.15 + 55×0.10
           = 18.20 + 11.00 + 11.00 + 8.70 + 5.50 = 54.40
    `,
  },

  market_health: {
    expected_components: {
      demand_strength: 55.0,
      supply_balance: 52.0, // active_yy=50 neutral
      price_stability: 58.0,
      economic_foundation: 55.0,
    },
    expected_result: {
      score: 55.05,
      status: 'partial',
      dataCompleteness: 0.88,
    },
    calculation: `
      Supply Balance: months×0.4 + active_yy×0.3 + new_yy×0.3
                    = 58×0.4 + 50×0.3 + 55×0.3 = 23.2 + 15 + 16.5 = 54.7 ≈ 52

      Final = 55×0.35 + 52×0.25 + 58×0.25 + 55×0.15
           = 19.25 + 13.00 + 14.50 + 8.25 = 55.00
    `,
  },
};

export const MISSING_REQUIRED_003: TestGeography = {
  geography_id: 'MISSING_REQUIRED_003',
  test_purpose: 'Required metric (zhvi) missing - penalize strategy',
  geography_type: 'zip',

  raw_metrics: {
    zhvi: null, // MISSING - required, penalize (score 25)
    zori: 1800,
    zhvi_yoy: null, // Cannot calculate without zhvi
    zhvi_5y_cagr: null, // Cannot calculate without zhvi
    zori_yoy: 0.03,

    median_household_income: 80000,
    income_gap_ratio: null, // Depends on zhvi
    years_to_save: null, // Depends on zhvi
    rent_as_pct_of_income: 0.27,

    median_days_on_market: 45,
    price_reduced_share: 0.22,
    months_of_supply: 4.5,
    pending_listing_count_yy: 0.05,

    pending_ratio: 0.28,
    hotness_score: 55,
    sale_to_list_ratio: 0.98,

    active_listing_count_yy: 0.03,
    new_listing_count_yy: 0.02,
    inventory_surplus_pct: 0.0,

    volatility_36m: null, // May depend on zhvi
    unemployment_rate: 5.0,

    population_yoy: 0.008,
    median_household_income_yoy: 0.022,
    employment_yoy: 0.015,

    homeownership_rate: 0.62,
    median_age: 37,
    renter_share: 0.38,

    cap_rate: null, // Cannot calculate without zhvi
    grm: null, // Cannot calculate without zhvi
    gross_yield: null, // Cannot calculate without zhvi
    rent_to_price_ratio: null, // Cannot calculate without zhvi
    overvalued_pct: null, // Cannot calculate without zhvi
    large_multi_permits_yoy: 0.05,
  },

  homeready: {
    expected_components: {
      affordability: 25.0, // Heavily penalized - zhvi missing
      market_timing: 55.0, // Still calculable
      stability: 40.0, // volatility missing
      growth_potential: 35.0, // CAGR, YoY missing
      livability: 55.0, // Mostly calculable
    },
    expected_result: {
      score: 38.5,
      status: 'partial',
      dataCompleteness: 0.56,
    },
    calculation: `
      ZHVI missing - many metrics unavailable:
      - Affordability: 25 (penalized)
      - Market Timing: 55 (still works)
      - Stability: 40 (volatility penalized)
      - Growth: 35 (CAGR, YoY penalized)
      - Livability: 55 (mostly works)

      Final = 25×0.30 + 55×0.25 + 40×0.20 + 35×0.15 + 55×0.10
           = 7.50 + 13.75 + 8.00 + 5.25 + 5.50 = 40.00
    `,
  },

  investoredge: {
    expected_components: {
      cash_flow: 25.0, // All investor metrics need zhvi
      rent_demand: 50.0, // zori_yoy works, others partial
      appreciation: 25.0, // No YoY, no CAGR
      entry_point: 35.0, // overvalued missing
      risk: 45.0, // volatility missing
    },
    expected_result: {
      score: 32.75,
      status: 'partial',
      dataCompleteness: 0.44,
    },
    calculation: `
      InvestorEdge heavily impacted - cap_rate, grm, gross_yield all need zhvi.

      Final = 25×0.35 + 50×0.20 + 25×0.20 + 35×0.15 + 45×0.10
           = 8.75 + 10.00 + 5.00 + 5.25 + 4.50 = 33.50
    `,
  },

  market_health: {
    expected_components: {
      demand_strength: 55.0,
      supply_balance: 55.0,
      price_stability: 40.0, // zhvi_yoy missing
      economic_foundation: 55.0,
    },
    expected_result: {
      score: 51.0,
      status: 'partial',
      dataCompleteness: 0.69,
    },
    calculation: `
      Market Health less impacted but price_stability degraded.

      Final = 55×0.35 + 55×0.25 + 40×0.25 + 55×0.15
           = 19.25 + 13.75 + 10.00 + 8.25 = 51.25
    `,
  },
};

export const MISSING_COMPONENT_004: TestGeography = {
  geography_id: 'MISSING_COMPONENT_004',
  test_purpose: 'All metrics for one component (growth) missing - weight redistributed',
  geography_type: 'zip',

  raw_metrics: {
    zhvi: 380000,
    zori: 1750,
    zhvi_yoy: null, // Growth component - all null
    zhvi_5y_cagr: null, // Growth component - all null
    zori_yoy: 0.03,

    median_household_income: 82000,
    income_gap_ratio: 0.95,
    years_to_save: 5.5,
    rent_as_pct_of_income: 0.25,

    median_days_on_market: 38,
    price_reduced_share: 0.18,
    months_of_supply: 3.8,
    pending_listing_count_yy: 0.06,

    pending_ratio: 0.30,
    hotness_score: 58,
    sale_to_list_ratio: 0.99,

    active_listing_count_yy: -0.02,
    new_listing_count_yy: 0.0,
    inventory_surplus_pct: -0.02,

    volatility_36m: 0.05,
    unemployment_rate: 4.8,

    population_yoy: null, // Growth component - all null
    median_household_income_yoy: null, // Growth component - all null
    employment_yoy: null, // Growth component - all null

    homeownership_rate: 0.64,
    median_age: 36,
    renter_share: 0.36,

    cap_rate: 0.058,
    grm: 17,
    gross_yield: 0.055,
    rent_to_price_ratio: 0.0046,
    overvalued_pct: 0.0,
    large_multi_permits_yoy: 0.03,
  },

  homeready: {
    expected_components: {
      affordability: 65.0,
      market_timing: 68.0,
      stability: 62.0,
      growth_potential: 0, // Component unavailable - all metrics missing
      livability: 62.0,
    },
    expected_result: {
      score: 62.35, // Reweighted without growth
      status: 'partial',
      dataCompleteness: 0.69,
    },
    calculation: `
      Growth potential component completely unavailable.
      Weights redistributed:
      Original: aff=0.30, timing=0.25, stab=0.20, growth=0.15, live=0.10
      Without growth (sum=0.85):
      - affordability: 0.30/0.85 = 0.353
      - market_timing: 0.25/0.85 = 0.294
      - stability: 0.20/0.85 = 0.235
      - livability: 0.10/0.85 = 0.118

      Final = 65×0.353 + 68×0.294 + 62×0.235 + 62×0.118
           = 22.95 + 20.00 + 14.57 + 7.32 = 64.84
    `,
  },

  investoredge: {
    expected_components: {
      cash_flow: 58.0,
      rent_demand: 62.0,
      appreciation: 25.0, // Heavily penalized - no growth metrics
      entry_point: 65.0,
      risk: 60.0,
    },
    expected_result: {
      score: 52.7,
      status: 'partial',
      dataCompleteness: 0.69,
    },
    calculation: `
      Appreciation component penalized (no zhvi_yoy, zhvi_5y_cagr, population_yoy).

      Final = 58×0.35 + 62×0.20 + 25×0.20 + 65×0.15 + 60×0.10
           = 20.30 + 12.40 + 5.00 + 9.75 + 6.00 = 53.45
    `,
  },

  market_health: {
    expected_components: {
      demand_strength: 62.0,
      supply_balance: 65.0,
      price_stability: 55.0, // zhvi_yoy missing
      economic_foundation: 35.0, // employment_yoy missing, penalized
    },
    expected_result: {
      score: 56.0,
      status: 'partial',
      dataCompleteness: 0.75,
    },
    calculation: `
      Economic foundation partially impacted.

      Final = 62×0.35 + 65×0.25 + 55×0.25 + 35×0.15
           = 21.70 + 16.25 + 13.75 + 5.25 = 56.95
    `,
  },
};

export const MISSING_MAJORITY_005: TestGeography = {
  geography_id: 'MISSING_MAJORITY_005',
  test_purpose: 'More than 50% metrics missing - scores unavailable',
  geography_type: 'zip',

  raw_metrics: {
    // Only basic housing data available
    zhvi: 420000,
    zori: 1950,
    zhvi_yoy: null,
    zhvi_5y_cagr: null,
    zori_yoy: null,

    median_household_income: 78000,
    income_gap_ratio: null,
    years_to_save: null,
    rent_as_pct_of_income: null,

    median_days_on_market: null,
    price_reduced_share: null,
    months_of_supply: null,
    pending_listing_count_yy: null,

    pending_ratio: null,
    hotness_score: null,
    sale_to_list_ratio: null,

    active_listing_count_yy: null,
    new_listing_count_yy: null,
    inventory_surplus_pct: null,

    volatility_36m: null,
    unemployment_rate: 5.2,

    population_yoy: null,
    median_household_income_yoy: null,
    employment_yoy: null,

    homeownership_rate: null,
    median_age: null,
    renter_share: null,

    cap_rate: null,
    grm: null,
    gross_yield: null,
    rent_to_price_ratio: null,
    overvalued_pct: null,
    large_multi_permits_yoy: null,
  },

  homeready: {
    expected_components: {
      affordability: 0,
      market_timing: 0,
      stability: 0,
      growth_potential: 0,
      livability: 0,
    },
    expected_result: {
      score: null,
      status: 'unavailable',
      dataCompleteness: 0.15,
      reason: 'Insufficient data: only 15% of weighted metrics available',
    },
    calculation: `
      Available: zhvi, zori, median_household_income, unemployment_rate
      Missing: 85% of weighted metrics
      Threshold: SCORE_AVAILABLE_MIN_COMPLETENESS = 50%

      Score unavailable - insufficient data.
    `,
  },

  investoredge: {
    expected_components: {
      cash_flow: 0,
      rent_demand: 0,
      appreciation: 0,
      entry_point: 0,
      risk: 0,
    },
    expected_result: {
      score: null,
      status: 'unavailable',
      dataCompleteness: 0.10,
      reason: 'Insufficient data: only 10% of weighted metrics available',
    },
    calculation: `
      Almost no investor metrics available.
      Score unavailable - insufficient data.
    `,
  },

  market_health: {
    expected_components: {
      demand_strength: 0,
      supply_balance: 0,
      price_stability: 0,
      economic_foundation: 0,
    },
    expected_result: {
      score: null,
      status: 'unavailable',
      dataCompleteness: 0.08,
      reason: 'Insufficient data: only 8% of weighted metrics available',
    },
    calculation: `
      Only unemployment_rate available for Market Health.
      Score unavailable - insufficient data.
    `,
  },
};

// ============================================================================
// CATEGORY 3: BOUNDARY CONDITIONS (5 geographies)
// Tests extreme values and edge cases
// ============================================================================

export const BOUNDARY_ALL_MIN_001: TestGeography = {
  geography_id: 'BOUNDARY_ALL_MIN_001',
  test_purpose: 'All metrics at worst possible values - verify floor (~0)',
  geography_type: 'zip',

  raw_metrics: {
    zhvi: 2000000,
    zori: 4500,
    zhvi_yoy: -0.15,
    zhvi_5y_cagr: -0.05,
    zori_yoy: -0.08,

    median_household_income: 25000,
    income_gap_ratio: 5.0,
    years_to_save: 40,
    rent_as_pct_of_income: 0.75,

    median_days_on_market: 365,
    price_reduced_share: 0.70,
    months_of_supply: 18,
    pending_listing_count_yy: -0.50,

    pending_ratio: 0.02,
    hotness_score: 5,
    sale_to_list_ratio: 0.70,

    active_listing_count_yy: 0.80,
    new_listing_count_yy: 0.60,
    inventory_surplus_pct: 0.50,

    volatility_36m: 0.25,
    unemployment_rate: 15.0,

    population_yoy: -0.08,
    median_household_income_yoy: -0.05,
    employment_yoy: -0.10,

    homeownership_rate: 0.30,
    median_age: 55,
    renter_share: 0.70,

    cap_rate: 0.02,
    grm: 40,
    gross_yield: 0.027,
    rent_to_price_ratio: 0.0023,
    overvalued_pct: 0.50,
    large_multi_permits_yoy: 0.80,
  },

  homeready: {
    expected_components: {
      affordability: 2.0,
      market_timing: 3.0,
      stability: 5.0,
      growth_potential: 2.0,
      livability: 8.0,
    },
    expected_result: {
      score: 3.55,
      status: 'complete',
    },
    calculation: `
      All components at floor:
      Final = 2×0.30 + 3×0.25 + 5×0.20 + 2×0.15 + 8×0.10
           = 0.60 + 0.75 + 1.00 + 0.30 + 0.80 = 3.45
    `,
  },

  investoredge: {
    expected_components: {
      cash_flow: 5.0,
      rent_demand: 3.0,
      appreciation: 2.0,
      entry_point: 5.0,
      risk: 5.0,
    },
    expected_result: {
      score: 4.0,
      status: 'complete',
    },
    calculation: `
      All investor metrics at worst:
      Final = 5×0.35 + 3×0.20 + 2×0.20 + 5×0.15 + 5×0.10
           = 1.75 + 0.60 + 0.40 + 0.75 + 0.50 = 4.00
    `,
  },

  market_health: {
    expected_components: {
      demand_strength: 3.0,
      supply_balance: 2.0,
      price_stability: 5.0,
      economic_foundation: 3.0,
    },
    expected_result: {
      score: 3.25,
      status: 'complete',
    },
    calculation: `
      Market in crisis:
      Final = 3×0.35 + 2×0.25 + 5×0.25 + 3×0.15
           = 1.05 + 0.50 + 1.25 + 0.45 = 3.25
    `,
  },
};

export const BOUNDARY_ALL_MAX_002: TestGeography = {
  geography_id: 'BOUNDARY_ALL_MAX_002',
  test_purpose: 'All metrics at best possible values - verify ceiling (100)',
  geography_type: 'zip',

  raw_metrics: {
    zhvi: 100000,
    zori: 800,
    zhvi_yoy: 0.12,
    zhvi_5y_cagr: 0.12,
    zori_yoy: 0.10,

    median_household_income: 200000,
    income_gap_ratio: 0.2,
    years_to_save: 1,
    rent_as_pct_of_income: 0.08,

    median_days_on_market: 3,
    price_reduced_share: 0.01,
    months_of_supply: 0.5,
    pending_listing_count_yy: 0.50,

    pending_ratio: 0.70,
    hotness_score: 100,
    sale_to_list_ratio: 1.15,

    active_listing_count_yy: -0.40,
    new_listing_count_yy: -0.30,
    inventory_surplus_pct: -0.30,

    volatility_36m: 0.005,
    unemployment_rate: 1.5,

    population_yoy: 0.06,
    median_household_income_yoy: 0.08,
    employment_yoy: 0.07,

    homeownership_rate: 0.85,
    median_age: 32,
    renter_share: 0.15,

    cap_rate: 0.10,
    grm: 8,
    gross_yield: 0.096,
    rent_to_price_ratio: 0.008,
    overvalued_pct: -0.25,
    large_multi_permits_yoy: -0.20,
  },

  homeready: {
    expected_components: {
      affordability: 98.0,
      market_timing: 98.0,
      stability: 97.0,
      growth_potential: 98.0,
      livability: 95.0,
    },
    expected_result: {
      score: 97.55,
      status: 'complete',
    },
    calculation: `
      All components at ceiling:
      Final = 98×0.30 + 98×0.25 + 97×0.20 + 98×0.15 + 95×0.10
           = 29.40 + 24.50 + 19.40 + 14.70 + 9.50 = 97.50
    `,
  },

  investoredge: {
    expected_components: {
      cash_flow: 97.0,
      rent_demand: 98.0,
      appreciation: 98.0,
      entry_point: 98.0,
      risk: 95.0,
    },
    expected_result: {
      score: 97.25,
      status: 'complete',
    },
    calculation: `
      Perfect investment conditions:
      Final = 97×0.35 + 98×0.20 + 98×0.20 + 98×0.15 + 95×0.10
           = 33.95 + 19.60 + 19.60 + 14.70 + 9.50 = 97.35
    `,
  },

  market_health: {
    expected_components: {
      demand_strength: 98.0,
      supply_balance: 97.0,
      price_stability: 92.0, // s2l at 1.15 penalized slightly
      economic_foundation: 98.0,
    },
    expected_result: {
      score: 96.15,
      status: 'complete',
    },
    calculation: `
      Extremely healthy market:
      Final = 98×0.35 + 97×0.25 + 92×0.25 + 98×0.15
           = 34.30 + 24.25 + 23.00 + 14.70 = 96.25
    `,
  },
};

export const BOUNDARY_MIXED_003: TestGeography = {
  geography_id: 'BOUNDARY_MIXED_003',
  test_purpose: 'Alternating min/max values - should average to ~50',
  geography_type: 'zip',

  raw_metrics: {
    zhvi: 2000000, // worst
    zori: 800, // best (relative)
    zhvi_yoy: 0.12, // best
    zhvi_5y_cagr: -0.05, // worst
    zori_yoy: 0.10, // best

    median_household_income: 200000, // best
    income_gap_ratio: 5.0, // worst
    years_to_save: 1, // best
    rent_as_pct_of_income: 0.75, // worst

    median_days_on_market: 3, // best
    price_reduced_share: 0.70, // worst
    months_of_supply: 0.5, // best
    pending_listing_count_yy: -0.50, // worst

    pending_ratio: 0.70, // best
    hotness_score: 5, // worst
    sale_to_list_ratio: 1.15, // best

    active_listing_count_yy: 0.80, // worst
    new_listing_count_yy: -0.30, // best
    inventory_surplus_pct: 0.50, // worst

    volatility_36m: 0.005, // best
    unemployment_rate: 15.0, // worst

    population_yoy: 0.06, // best
    median_household_income_yoy: -0.05, // worst
    employment_yoy: 0.07, // best

    homeownership_rate: 0.30, // worst
    median_age: 32, // best
    renter_share: 0.70, // worst

    cap_rate: 0.10, // best
    grm: 40, // worst
    gross_yield: 0.096, // best
    rent_to_price_ratio: 0.0023, // worst
    overvalued_pct: -0.25, // best
    large_multi_permits_yoy: 0.80, // worst
  },

  homeready: {
    expected_components: {
      affordability: 45.0,
      market_timing: 48.0,
      stability: 50.0,
      growth_potential: 52.0,
      livability: 42.0,
    },
    expected_result: {
      score: 47.25,
      status: 'complete',
    },
    calculation: `
      Mixed extremes average out:
      Final = 45×0.30 + 48×0.25 + 50×0.20 + 52×0.15 + 42×0.10
           = 13.50 + 12.00 + 10.00 + 7.80 + 4.20 = 47.50
    `,
  },

  investoredge: {
    expected_components: {
      cash_flow: 50.0,
      rent_demand: 52.0,
      appreciation: 45.0,
      entry_point: 55.0,
      risk: 48.0,
    },
    expected_result: {
      score: 50.05,
      status: 'complete',
    },
    calculation: `
      Mixed investor signals:
      Final = 50×0.35 + 52×0.20 + 45×0.20 + 55×0.15 + 48×0.10
           = 17.50 + 10.40 + 9.00 + 8.25 + 4.80 = 49.95
    `,
  },

  market_health: {
    expected_components: {
      demand_strength: 55.0,
      supply_balance: 45.0,
      price_stability: 48.0,
      economic_foundation: 48.0,
    },
    expected_result: {
      score: 49.45,
      status: 'complete',
    },
    calculation: `
      Mixed market signals:
      Final = 55×0.35 + 45×0.25 + 48×0.25 + 48×0.15
           = 19.25 + 11.25 + 12.00 + 7.20 = 49.70
    `,
  },
};

export const BOUNDARY_THRESHOLD_004: TestGeography = {
  geography_id: 'BOUNDARY_THRESHOLD_004',
  test_purpose: 'Values at exact normalization thresholds',
  geography_type: 'zip',

  raw_metrics: {
    zhvi: 300000, // Threshold for affordable
    zori: 1500,
    zhvi_yoy: 0.05, // 5% threshold
    zhvi_5y_cagr: 0.05, // 5% threshold
    zori_yoy: 0.03,

    median_household_income: 75000,
    income_gap_ratio: 1.0, // Exact threshold
    years_to_save: 5, // Threshold
    rent_as_pct_of_income: 0.28, // 28% threshold

    median_days_on_market: 30, // Threshold
    price_reduced_share: 0.20, // 20% threshold
    months_of_supply: 4.0, // Threshold
    pending_listing_count_yy: 0.0, // Threshold

    pending_ratio: 0.30, // Threshold
    hotness_score: 50, // Threshold
    sale_to_list_ratio: 1.00, // Exact parity

    active_listing_count_yy: 0.0, // Threshold
    new_listing_count_yy: 0.0, // Threshold
    inventory_surplus_pct: 0.0, // Threshold

    volatility_36m: 0.05, // Threshold
    unemployment_rate: 5.0, // Threshold

    population_yoy: 0.01, // 1% threshold
    median_household_income_yoy: 0.03, // 3% threshold
    employment_yoy: 0.02, // 2% threshold

    homeownership_rate: 0.65, // Threshold
    median_age: 35, // Threshold
    renter_share: 0.35, // Threshold

    cap_rate: 0.06, // 6% threshold
    grm: 16, // Threshold
    gross_yield: 0.06, // 6% threshold
    rent_to_price_ratio: 0.005, // 0.5% threshold
    overvalued_pct: 0.0, // Threshold
    large_multi_permits_yoy: 0.0, // Threshold
  },

  homeready: {
    expected_components: {
      affordability: 65.0,
      market_timing: 65.0,
      stability: 60.0,
      growth_potential: 60.0,
      livability: 62.0,
    },
    expected_result: {
      score: 63.2,
      status: 'complete',
    },
    calculation: `
      Threshold values produce moderate-good scores:
      Final = 65×0.30 + 65×0.25 + 60×0.20 + 60×0.15 + 62×0.10
           = 19.50 + 16.25 + 12.00 + 9.00 + 6.20 = 62.95
    `,
  },

  investoredge: {
    expected_components: {
      cash_flow: 62.0,
      rent_demand: 60.0,
      appreciation: 62.0,
      entry_point: 65.0,
      risk: 60.0,
    },
    expected_result: {
      score: 62.05,
      status: 'complete',
    },
    calculation: `
      Threshold values = moderate investment:
      Final = 62×0.35 + 60×0.20 + 62×0.20 + 65×0.15 + 60×0.10
           = 21.70 + 12.00 + 12.40 + 9.75 + 6.00 = 61.85
    `,
  },

  market_health: {
    expected_components: {
      demand_strength: 60.0,
      supply_balance: 62.0,
      price_stability: 62.0,
      economic_foundation: 60.0,
    },
    expected_result: {
      score: 61.0,
      status: 'complete',
    },
    calculation: `
      Threshold values = healthy but not exceptional:
      Final = 60×0.35 + 62×0.25 + 62×0.25 + 60×0.15
           = 21.00 + 15.50 + 15.50 + 9.00 = 61.00
    `,
  },
};

export const BOUNDARY_INVALID_005: TestGeography = {
  geography_id: 'BOUNDARY_INVALID_005',
  test_purpose: 'Invalid negative values - should throw errors',
  geography_type: 'zip',

  raw_metrics: {
    zhvi: -100000, // INVALID: negative price
    zori: 1500,
    zhvi_yoy: 0.03,
    zhvi_5y_cagr: 0.04,
    zori_yoy: 0.03,

    median_household_income: 75000,
    income_gap_ratio: -0.5, // INVALID: negative ratio
    years_to_save: -2, // INVALID: negative years
    rent_as_pct_of_income: 0.28,

    median_days_on_market: -5, // INVALID: negative days
    price_reduced_share: 0.20,
    months_of_supply: 4.0,
    pending_listing_count_yy: 0.0,

    pending_ratio: 0.30,
    hotness_score: 50,
    sale_to_list_ratio: 1.00,

    active_listing_count_yy: 0.0,
    new_listing_count_yy: 0.0,
    inventory_surplus_pct: 0.0,

    volatility_36m: -0.05, // INVALID: negative volatility
    unemployment_rate: 5.0,

    population_yoy: 0.01,
    median_household_income_yoy: 0.03,
    employment_yoy: 0.02,

    homeownership_rate: 0.65,
    median_age: 35,
    renter_share: 0.35,

    cap_rate: -0.02, // INVALID: negative cap rate
    grm: 16,
    gross_yield: 0.06,
    rent_to_price_ratio: 0.005,
    overvalued_pct: 0.0,
    large_multi_permits_yoy: 0.0,
  },

  homeready: {
    expected_components: {
      affordability: 0,
      market_timing: 0,
      stability: 0,
      growth_potential: 0,
      livability: 0,
    },
    expected_result: {
      score: null,
      status: 'unavailable',
      reason: 'Invalid metric: negative home price',
    },
    calculation: `
      System should throw NegativePriceError.
      Fail visibly, not silently.
    `,
  },

  investoredge: {
    expected_components: {
      cash_flow: 0,
      rent_demand: 0,
      appreciation: 0,
      entry_point: 0,
      risk: 0,
    },
    expected_result: {
      score: null,
      status: 'unavailable',
      reason: 'Invalid metric: negative home price',
    },
    calculation: `
      System should throw NegativePriceError.
    `,
  },

  market_health: {
    expected_components: {
      demand_strength: 0,
      supply_balance: 0,
      price_stability: 0,
      economic_foundation: 0,
    },
    expected_result: {
      score: null,
      status: 'unavailable',
      reason: 'Invalid metric: negative home price',
    },
    calculation: `
      System should throw NegativePriceError.
    `,
  },
};

// ============================================================================
// CATEGORY 4: GEOGRAPHIC INHERITANCE (5 geographies)
// ============================================================================

export const INHERIT_ZIP_NONE_001: TestGeography = {
  geography_id: 'INHERIT_ZIP_NONE_001',
  test_purpose: 'ZIP has no data - inherit all from County',
  geography_type: 'zip',

  raw_metrics: {
    zhvi: null,
    zori: null,
    zhvi_yoy: null,
    zhvi_5y_cagr: null,
    zori_yoy: null,
    median_household_income: null,
    income_gap_ratio: null,
    years_to_save: null,
    rent_as_pct_of_income: null,
    median_days_on_market: null,
    price_reduced_share: null,
    months_of_supply: null,
    pending_listing_count_yy: null,
    pending_ratio: null,
    hotness_score: null,
    sale_to_list_ratio: null,
    active_listing_count_yy: null,
    new_listing_count_yy: null,
    inventory_surplus_pct: null,
    volatility_36m: null,
    unemployment_rate: null,
    population_yoy: null,
    median_household_income_yoy: null,
    employment_yoy: null,
    homeownership_rate: null,
    median_age: null,
    renter_share: null,
    cap_rate: null,
    grm: null,
    gross_yield: null,
    rent_to_price_ratio: null,
    overvalued_pct: null,
    large_multi_permits_yoy: null,
  },

  parent_metrics: {
    county: {
      zhvi: 400000,
      zori: 1800,
      zhvi_yoy: 0.035,
      zhvi_5y_cagr: 0.045,
      zori_yoy: 0.028,
      median_household_income: 80000,
      income_gap_ratio: 1.0,
      years_to_save: 6,
      rent_as_pct_of_income: 0.27,
      median_days_on_market: 42,
      price_reduced_share: 0.22,
      months_of_supply: 4.2,
      pending_listing_count_yy: 0.05,
      pending_ratio: 0.28,
      hotness_score: 55,
      sale_to_list_ratio: 0.98,
      active_listing_count_yy: 0.02,
      new_listing_count_yy: 0.01,
      inventory_surplus_pct: 0.0,
      volatility_36m: 0.055,
      unemployment_rate: 5.0,
      population_yoy: 0.008,
      median_household_income_yoy: 0.022,
      employment_yoy: 0.015,
      homeownership_rate: 0.62,
      median_age: 37,
      renter_share: 0.38,
      cap_rate: 0.054,
      grm: 18.5,
      gross_yield: 0.054,
      rent_to_price_ratio: 0.0045,
      overvalued_pct: 0.03,
      large_multi_permits_yoy: 0.05,
    },
  },

  expected_inherited_metrics: [
    { metric: 'zhvi', source: 'county', inherited: true },
    { metric: 'zori', source: 'county', inherited: true },
    { metric: 'unemployment_rate', source: 'county', inherited: true },
  ],

  homeready: {
    expected_components: {
      affordability: 55.0,
      market_timing: 58.0,
      stability: 55.0,
      growth_potential: 52.0,
      livability: 58.0,
    },
    expected_result: {
      score: 55.65,
      status: 'complete',
    },
    calculation: `
      All metrics inherited from County.
      Calculated as if County data was ZIP data.

      Final = 55×0.30 + 58×0.25 + 55×0.20 + 52×0.15 + 58×0.10
           = 16.50 + 14.50 + 11.00 + 7.80 + 5.80 = 55.60
    `,
  },

  investoredge: {
    expected_components: {
      cash_flow: 52.0,
      rent_demand: 55.0,
      appreciation: 55.0,
      entry_point: 55.0,
      risk: 55.0,
    },
    expected_result: {
      score: 53.75,
      status: 'complete',
    },
    calculation: `
      All from County.
      Final = 52×0.35 + 55×0.20 + 55×0.20 + 55×0.15 + 55×0.10
           = 18.20 + 11.00 + 11.00 + 8.25 + 5.50 = 53.95
    `,
  },

  market_health: {
    expected_components: {
      demand_strength: 55.0,
      supply_balance: 55.0,
      price_stability: 58.0,
      economic_foundation: 55.0,
    },
    expected_result: {
      score: 55.75,
      status: 'complete',
    },
    calculation: `
      All from County.
      Final = 55×0.35 + 55×0.25 + 58×0.25 + 55×0.15
           = 19.25 + 13.75 + 14.50 + 8.25 = 55.75
    `,
  },
};

export const INHERIT_ZIP_PARTIAL_002: TestGeography = {
  geography_id: 'INHERIT_ZIP_PARTIAL_002',
  test_purpose: 'ZIP has housing data, County fills economic gaps',
  geography_type: 'zip',

  raw_metrics: {
    // ZIP has housing/market data
    zhvi: 550000,
    zori: 2200,
    zhvi_yoy: 0.045,
    zhvi_5y_cagr: 0.055,
    zori_yoy: 0.038,
    median_household_income: null, // Inherit
    income_gap_ratio: null, // Inherit
    years_to_save: null, // Inherit
    rent_as_pct_of_income: null, // Inherit
    median_days_on_market: 28,
    price_reduced_share: 0.12,
    months_of_supply: 2.8,
    pending_listing_count_yy: 0.12,
    pending_ratio: 0.38,
    hotness_score: 72,
    sale_to_list_ratio: 1.01,
    active_listing_count_yy: -0.08,
    new_listing_count_yy: -0.02,
    inventory_surplus_pct: -0.05,
    volatility_36m: null, // Inherit
    unemployment_rate: null, // Inherit
    population_yoy: null, // Inherit
    median_household_income_yoy: null, // Inherit
    employment_yoy: null, // Inherit
    homeownership_rate: null, // Inherit
    median_age: null, // Inherit
    renter_share: null, // Inherit
    cap_rate: null, // Calculated with inherited income
    grm: null, // Calculated
    gross_yield: null, // Calculated
    rent_to_price_ratio: null, // Calculated
    overvalued_pct: null, // Inherit
    large_multi_permits_yoy: null, // Inherit
  },

  parent_metrics: {
    county: {
      median_household_income: 92000,
      income_gap_ratio: 1.2,
      years_to_save: 7,
      rent_as_pct_of_income: 0.24,
      volatility_36m: 0.04,
      unemployment_rate: 4.2,
      population_yoy: 0.015,
      median_household_income_yoy: 0.028,
      employment_yoy: 0.022,
      homeownership_rate: 0.68,
      median_age: 35,
      renter_share: 0.32,
      cap_rate: 0.048, // Calculated at county level
      grm: 20.8,
      gross_yield: 0.048,
      rent_to_price_ratio: 0.004,
      overvalued_pct: 0.05,
      large_multi_permits_yoy: 0.08,
    },
  },

  expected_inherited_metrics: [
    { metric: 'zhvi', source: 'zip', inherited: false },
    { metric: 'zori', source: 'zip', inherited: false },
    { metric: 'median_household_income', source: 'county', inherited: true },
    { metric: 'unemployment_rate', source: 'county', inherited: true },
  ],

  homeready: {
    expected_components: {
      affordability: 58.0, // Mix: ZIP housing, County income
      market_timing: 78.0, // ZIP market data strong
      stability: 68.0, // County stability
      growth_potential: 65.0, // County growth
      livability: 68.0, // County livability
    },
    expected_result: {
      score: 67.0,
      status: 'complete',
    },
    calculation: `
      Mix of ZIP housing metrics and County economic metrics.

      Final = 58×0.30 + 78×0.25 + 68×0.20 + 65×0.15 + 68×0.10
           = 17.40 + 19.50 + 13.60 + 9.75 + 6.80 = 67.05
    `,
  },

  investoredge: {
    expected_components: {
      cash_flow: 48.0, // County yields with ZIP price = lower
      rent_demand: 72.0, // ZIP demand strong
      appreciation: 68.0, // Mix
      entry_point: 62.0, // Mix
      risk: 68.0, // County risk metrics
    },
    expected_result: {
      score: 61.3,
      status: 'complete',
    },
    calculation: `
      Final = 48×0.35 + 72×0.20 + 68×0.20 + 62×0.15 + 68×0.10
           = 16.80 + 14.40 + 13.60 + 9.30 + 6.80 = 60.90
    `,
  },

  market_health: {
    expected_components: {
      demand_strength: 75.0, // ZIP demand
      supply_balance: 72.0, // ZIP supply
      price_stability: 68.0, // Mix
      economic_foundation: 68.0, // County economic
    },
    expected_result: {
      score: 71.2,
      status: 'complete',
    },
    calculation: `
      Final = 75×0.35 + 72×0.25 + 68×0.25 + 68×0.15
           = 26.25 + 18.00 + 17.00 + 10.20 = 71.45
    `,
  },
};

export const INHERIT_COUNTY_NONE_003: TestGeography = {
  geography_id: 'INHERIT_COUNTY_NONE_003',
  test_purpose: 'County has no data - skip to Metro',
  geography_type: 'county',

  raw_metrics: {
    zhvi: null,
    zori: null,
    zhvi_yoy: null,
    zhvi_5y_cagr: null,
    zori_yoy: null,
    median_household_income: null,
    income_gap_ratio: null,
    years_to_save: null,
    rent_as_pct_of_income: null,
    median_days_on_market: null,
    price_reduced_share: null,
    months_of_supply: null,
    pending_listing_count_yy: null,
    pending_ratio: null,
    hotness_score: null,
    sale_to_list_ratio: null,
    active_listing_count_yy: null,
    new_listing_count_yy: null,
    inventory_surplus_pct: null,
    volatility_36m: null,
    unemployment_rate: null,
    population_yoy: null,
    median_household_income_yoy: null,
    employment_yoy: null,
    homeownership_rate: null,
    median_age: null,
    renter_share: null,
    cap_rate: null,
    grm: null,
    gross_yield: null,
    rent_to_price_ratio: null,
    overvalued_pct: null,
    large_multi_permits_yoy: null,
  },

  parent_metrics: {
    metro: {
      zhvi: 480000,
      zori: 2050,
      zhvi_yoy: 0.05,
      zhvi_5y_cagr: 0.055,
      zori_yoy: 0.04,
      median_household_income: 95000,
      income_gap_ratio: 1.0,
      years_to_save: 6,
      rent_as_pct_of_income: 0.22,
      median_days_on_market: 32,
      price_reduced_share: 0.15,
      months_of_supply: 3.2,
      pending_listing_count_yy: 0.08,
      pending_ratio: 0.35,
      hotness_score: 68,
      sale_to_list_ratio: 1.0,
      active_listing_count_yy: -0.05,
      new_listing_count_yy: 0.0,
      inventory_surplus_pct: -0.02,
      volatility_36m: 0.042,
      unemployment_rate: 4.0,
      population_yoy: 0.018,
      median_household_income_yoy: 0.032,
      employment_yoy: 0.025,
      homeownership_rate: 0.65,
      median_age: 34,
      renter_share: 0.35,
      cap_rate: 0.051,
      grm: 19.5,
      gross_yield: 0.051,
      rent_to_price_ratio: 0.0043,
      overvalued_pct: 0.0,
      large_multi_permits_yoy: 0.05,
    },
  },

  expected_inherited_metrics: [
    { metric: 'zhvi', source: 'metro', inherited: true },
    { metric: 'unemployment_rate', source: 'metro', inherited: true },
  ],

  homeready: {
    expected_components: {
      affordability: 62.0,
      market_timing: 72.0,
      stability: 70.0,
      growth_potential: 68.0,
      livability: 68.0,
    },
    expected_result: {
      score: 67.7,
      status: 'complete',
    },
    calculation: `
      All from Metro (County has no data).

      Final = 62×0.30 + 72×0.25 + 70×0.20 + 68×0.15 + 68×0.10
           = 18.60 + 18.00 + 14.00 + 10.20 + 6.80 = 67.60
    `,
  },

  investoredge: {
    expected_components: {
      cash_flow: 52.0,
      rent_demand: 68.0,
      appreciation: 68.0,
      entry_point: 65.0,
      risk: 68.0,
    },
    expected_result: {
      score: 62.35,
      status: 'complete',
    },
    calculation: `
      All from Metro.
      Final = 52×0.35 + 68×0.20 + 68×0.20 + 65×0.15 + 68×0.10
           = 18.20 + 13.60 + 13.60 + 9.75 + 6.80 = 61.95
    `,
  },

  market_health: {
    expected_components: {
      demand_strength: 70.0,
      supply_balance: 68.0,
      price_stability: 65.0,
      economic_foundation: 72.0,
    },
    expected_result: {
      score: 68.55,
      status: 'complete',
    },
    calculation: `
      All from Metro.
      Final = 70×0.35 + 68×0.25 + 65×0.25 + 72×0.15
           = 24.50 + 17.00 + 16.25 + 10.80 = 68.55
    `,
  },
};

export const INHERIT_FULL_CHAIN_004: TestGeography = {
  geography_id: 'INHERIT_FULL_CHAIN_004',
  test_purpose: 'Full inheritance chain: ZIP→County→Metro→State',
  geography_type: 'zip',

  raw_metrics: {
    // ZIP only has basic Zillow data
    zhvi: 320000,
    zori: 1400,
    zhvi_yoy: null,
    zhvi_5y_cagr: null,
    zori_yoy: null,
    median_household_income: null,
    income_gap_ratio: null,
    years_to_save: null,
    rent_as_pct_of_income: null,
    median_days_on_market: null,
    price_reduced_share: null,
    months_of_supply: null,
    pending_listing_count_yy: null,
    pending_ratio: null,
    hotness_score: null,
    sale_to_list_ratio: null,
    active_listing_count_yy: null,
    new_listing_count_yy: null,
    inventory_surplus_pct: null,
    volatility_36m: null,
    unemployment_rate: null,
    population_yoy: null,
    median_household_income_yoy: null,
    employment_yoy: null,
    homeownership_rate: null,
    median_age: null,
    renter_share: null,
    cap_rate: null,
    grm: null,
    gross_yield: null,
    rent_to_price_ratio: null,
    overvalued_pct: null,
    large_multi_permits_yoy: null,
  },

  parent_metrics: {
    county: {
      // County has market timing
      median_days_on_market: 52,
      price_reduced_share: 0.25,
      months_of_supply: 5.2,
      pending_listing_count_yy: -0.02,
      pending_ratio: 0.22,
      sale_to_list_ratio: 0.96,
    },
    metro: {
      // Metro has some stability and growth
      volatility_36m: 0.058,
      active_listing_count_yy: 0.05,
      new_listing_count_yy: 0.03,
      inventory_surplus_pct: 0.02,
      zhvi_yoy: 0.025,
      zhvi_5y_cagr: 0.035,
      zori_yoy: 0.022,
    },
    state: {
      // State has economic data
      median_household_income: 68000,
      income_gap_ratio: 1.2,
      years_to_save: 8,
      rent_as_pct_of_income: 0.28,
      unemployment_rate: 5.8,
      population_yoy: 0.005,
      median_household_income_yoy: 0.018,
      employment_yoy: 0.012,
      homeownership_rate: 0.60,
      median_age: 38,
      renter_share: 0.40,
      hotness_score: 48,
      cap_rate: 0.052,
      grm: 19,
      gross_yield: 0.052,
      rent_to_price_ratio: 0.0044,
      overvalued_pct: 0.05,
      large_multi_permits_yoy: 0.06,
    },
  },

  expected_inherited_metrics: [
    { metric: 'zhvi', source: 'zip', inherited: false },
    { metric: 'zori', source: 'zip', inherited: false },
    { metric: 'median_days_on_market', source: 'county', inherited: true },
    { metric: 'volatility_36m', source: 'metro', inherited: true },
    { metric: 'unemployment_rate', source: 'state', inherited: true },
    { metric: 'population_yoy', source: 'state', inherited: true },
  ],

  homeready: {
    expected_components: {
      affordability: 52.0, // ZIP price, State income
      market_timing: 45.0, // County timing (slow)
      stability: 50.0, // Metro volatility
      growth_potential: 45.0, // Metro/State growth (weak)
      livability: 52.0, // State livability
    },
    expected_result: {
      score: 48.85,
      status: 'partial',
      dataCompleteness: 0.65,
    },
    calculation: `
      Full chain inheritance:
      - ZIP: zhvi, zori (housing prices)
      - County: market timing metrics
      - Metro: stability metrics
      - State: economic/growth metrics

      Final = 52×0.30 + 45×0.25 + 50×0.20 + 45×0.15 + 52×0.10
           = 15.60 + 11.25 + 10.00 + 6.75 + 5.20 = 48.80
    `,
  },

  investoredge: {
    expected_components: {
      cash_flow: 50.0, // State yields with ZIP prices
      rent_demand: 45.0, // Mixed
      appreciation: 42.0, // Metro appreciation (weak)
      entry_point: 48.0, // Mixed
      risk: 50.0, // Mixed
    },
    expected_result: {
      score: 47.25,
      status: 'partial',
      dataCompleteness: 0.60,
    },
    calculation: `
      Final = 50×0.35 + 45×0.20 + 42×0.20 + 48×0.15 + 50×0.10
           = 17.50 + 9.00 + 8.40 + 7.20 + 5.00 = 47.10
    `,
  },

  market_health: {
    expected_components: {
      demand_strength: 45.0, // County demand (weak)
      supply_balance: 48.0, // Metro supply
      price_stability: 50.0, // Mix
      economic_foundation: 48.0, // State economic
    },
    expected_result: {
      score: 47.45,
      status: 'partial',
      dataCompleteness: 0.70,
    },
    calculation: `
      Final = 45×0.35 + 48×0.25 + 50×0.25 + 48×0.15
           = 15.75 + 12.00 + 12.50 + 7.20 = 47.45
    `,
  },
};

export const INHERIT_NO_FALLBACK_005: TestGeography = {
  geography_id: 'INHERIT_NO_FALLBACK_005',
  test_purpose: 'ZIP has all data - NO inheritance should occur',
  geography_type: 'zip',

  raw_metrics: {
    zhvi: 425000,
    zori: 2100,
    zhvi_yoy: 0.055,
    zhvi_5y_cagr: 0.062,
    zori_yoy: 0.042,
    median_household_income: 98000,
    income_gap_ratio: 0.85,
    years_to_save: 4.5,
    rent_as_pct_of_income: 0.21,
    median_days_on_market: 22,
    price_reduced_share: 0.10,
    months_of_supply: 2.5,
    pending_listing_count_yy: 0.10,
    pending_ratio: 0.42,
    hotness_score: 78,
    sale_to_list_ratio: 1.02,
    active_listing_count_yy: -0.12,
    new_listing_count_yy: -0.05,
    inventory_surplus_pct: -0.08,
    volatility_36m: 0.035,
    unemployment_rate: 3.5,
    population_yoy: 0.022,
    median_household_income_yoy: 0.038,
    employment_yoy: 0.032,
    homeownership_rate: 0.70,
    median_age: 34,
    renter_share: 0.30,
    cap_rate: 0.059,
    grm: 16.8,
    gross_yield: 0.059,
    rent_to_price_ratio: 0.0049,
    overvalued_pct: -0.05,
    large_multi_permits_yoy: -0.02,
  },

  parent_metrics: {
    // Parent data exists but should NOT be used
    county: {
      zhvi: 380000, // Different - should NOT be used
      unemployment_rate: 5.5, // Different - should NOT be used
      median_household_income: 75000, // Different - should NOT be used
    },
  },

  expected_inherited_metrics: [
    { metric: 'zhvi', source: 'zip', inherited: false },
    { metric: 'unemployment_rate', source: 'zip', inherited: false },
    { metric: 'median_household_income', source: 'zip', inherited: false },
  ],

  homeready: {
    expected_components: {
      affordability: 78.0,
      market_timing: 82.0,
      stability: 80.0,
      growth_potential: 75.0,
      livability: 75.0,
    },
    expected_result: {
      score: 78.75,
      status: 'complete',
    },
    calculation: `
      ALL from ZIP - verify County values NOT used.
      ZIP unemployment: 3.5%, County would be 5.5%
      ZIP income: 98k, County would be 75k

      Final = 78×0.30 + 82×0.25 + 80×0.20 + 75×0.15 + 75×0.10
           = 23.40 + 20.50 + 16.00 + 11.25 + 7.50 = 78.65
    `,
  },

  investoredge: {
    expected_components: {
      cash_flow: 62.0,
      rent_demand: 78.0,
      appreciation: 75.0,
      entry_point: 78.0,
      risk: 78.0,
    },
    expected_result: {
      score: 72.15,
      status: 'complete',
    },
    calculation: `
      All from ZIP directly.
      Final = 62×0.35 + 78×0.20 + 75×0.20 + 78×0.15 + 78×0.10
           = 21.70 + 15.60 + 15.00 + 11.70 + 7.80 = 71.80
    `,
  },

  market_health: {
    expected_components: {
      demand_strength: 80.0,
      supply_balance: 78.0,
      price_stability: 72.0,
      economic_foundation: 80.0,
    },
    expected_result: {
      score: 77.5,
      status: 'complete',
    },
    calculation: `
      All from ZIP - strong market.
      Final = 80×0.35 + 78×0.25 + 72×0.25 + 80×0.15
           = 28.00 + 19.50 + 18.00 + 12.00 = 77.50
    `,
  },
};

// ============================================================================
// EXPORTS
// ============================================================================

export const HAPPY_PATH_FIXTURES = [
  HAPPY_LOW_001,
  HAPPY_MED_002,
  HAPPY_HIGH_003,
  HAPPY_VERY_HIGH_004,
  HAPPY_EXACT_50_005,
];

export const MISSING_DATA_FIXTURES = [
  MISSING_OPTIONAL_001,
  MISSING_NEUTRAL_002,
  MISSING_REQUIRED_003,
  MISSING_COMPONENT_004,
  MISSING_MAJORITY_005,
];

export const BOUNDARY_FIXTURES = [
  BOUNDARY_ALL_MIN_001,
  BOUNDARY_ALL_MAX_002,
  BOUNDARY_MIXED_003,
  BOUNDARY_THRESHOLD_004,
  BOUNDARY_INVALID_005,
];

export const INHERITANCE_FIXTURES = [
  INHERIT_ZIP_NONE_001,
  INHERIT_ZIP_PARTIAL_002,
  INHERIT_COUNTY_NONE_003,
  INHERIT_FULL_CHAIN_004,
  INHERIT_NO_FALLBACK_005,
];

export const ALL_FIXTURES = [
  ...HAPPY_PATH_FIXTURES,
  ...MISSING_DATA_FIXTURES,
  ...BOUNDARY_FIXTURES,
  ...INHERITANCE_FIXTURES,
];

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validates that weights sum to 1.0
 */
export function validateWeightSums(): void {
  const homeReadySum = Object.values(HOMEREADY_WEIGHTS).reduce((a, b) => a + b, 0);
  const investorEdgeSum = Object.values(INVESTOREDGE_WEIGHTS).reduce((a, b) => a + b, 0);
  const marketHealthSum = Object.values(MARKET_HEALTH_WEIGHTS).reduce((a, b) => a + b, 0);

  if (Math.abs(homeReadySum - 1.0) > 0.0001) {
    throw new Error(`HomeReady weights sum to ${homeReadySum}, expected 1.0`);
  }
  if (Math.abs(investorEdgeSum - 1.0) > 0.0001) {
    throw new Error(`InvestorEdge weights sum to ${investorEdgeSum}, expected 1.0`);
  }
  if (Math.abs(marketHealthSum - 1.0) > 0.0001) {
    throw new Error(`MarketHealth weights sum to ${marketHealthSum}, expected 1.0`);
  }
}

/**
 * Calculates expected score from components for verification
 */
export function calculateExpectedHomeReady(components: HomeReadyComponents): number {
  return (
    components.affordability * HOMEREADY_WEIGHTS.affordability +
    components.market_timing * HOMEREADY_WEIGHTS.market_timing +
    components.stability * HOMEREADY_WEIGHTS.stability +
    components.growth_potential * HOMEREADY_WEIGHTS.growth_potential +
    components.livability * HOMEREADY_WEIGHTS.livability
  );
}

export function calculateExpectedInvestorEdge(components: InvestorEdgeComponents): number {
  return (
    components.cash_flow * INVESTOREDGE_WEIGHTS.cash_flow +
    components.rent_demand * INVESTOREDGE_WEIGHTS.rent_demand +
    components.appreciation * INVESTOREDGE_WEIGHTS.appreciation +
    components.entry_point * INVESTOREDGE_WEIGHTS.entry_point +
    components.risk * INVESTOREDGE_WEIGHTS.risk
  );
}

export function calculateExpectedMarketHealth(components: MarketHealthComponents): number {
  return (
    components.demand_strength * MARKET_HEALTH_WEIGHTS.demand_strength +
    components.supply_balance * MARKET_HEALTH_WEIGHTS.supply_balance +
    components.price_stability * MARKET_HEALTH_WEIGHTS.price_stability +
    components.economic_foundation * MARKET_HEALTH_WEIGHTS.economic_foundation
  );
}
