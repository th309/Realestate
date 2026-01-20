/**
 * PropertyIQ Scoring Types
 *
 * Type definitions for the triple scoring system:
 * - HomeReady: For homebuyers and renters
 * - InvestorEdge: For real estate investors
 * - Market Health Index: Overall market condition (free tier)
 */

// ============================================================================
// Core Types
// ============================================================================

export type GeographyType = 'national' | 'state' | 'metro' | 'county' | 'city' | 'zip';

export interface MetricValue {
  value: number | null;
  date: string;
  source: string;
}

export interface MetricData {
  [metricName: string]: MetricValue;
}

// ============================================================================
// HomeReady Score Components
// ============================================================================

export interface HomeReadyComponents {
  affordability: number; // Can I afford to live here? (30%)
  market_timing: number; // Is it a good time to buy? (25%)
  stability: number; // Is this market stable? (20%)
  growth_potential: number; // Will value grow? (15%)
  livability: number; // Is this a good place to live? (10%)
}

export const HOMEREADY_WEIGHTS: HomeReadyComponents = {
  affordability: 0.3,
  market_timing: 0.25,
  stability: 0.2,
  growth_potential: 0.15,
  livability: 0.1,
};

// Legacy alias for backwards compatibility
export type HomeReadyComponentsLegacy = {
  affordability: number;
  stability: number;
  value: number; // now market_timing
  livability: number;
  momentum: number; // now growth_potential
};

// Metrics that contribute to each HomeReady component
export const HOMEREADY_COMPONENT_METRICS: Record<
  keyof HomeReadyComponents,
  string[]
> = {
  affordability: [
    'income_gap_ratio',
    'years_to_save',
    'rent_as_pct_of_income',
    'zhvi',
    'zori',
  ],
  market_timing: [
    'price_reduced_share',
    'median_days_on_market',
    'months_of_supply',
    'pending_listing_count_yy',
  ],
  stability: [
    'volatility_36m',
    'active_listing_count_yy',
    'unemployment_rate',
  ],
  growth_potential: [
    'zhvi_5y_cagr',
    'population_yoy',
    'median_household_income_yoy',
  ],
  livability: [
    'homeownership_rate',
    'median_age',
    'unemployment_rate',
  ],
};

// ============================================================================
// InvestorEdge Score Components
// ============================================================================

export interface InvestorEdgeComponents {
  cash_flow: number; // Can I generate positive cash flow? (35%)
  rent_demand: number; // Is there strong rental demand? (20%)
  appreciation: number; // Will property values appreciate? (20%)
  entry_point: number; // Is this a good entry price? (15%)
  risk: number; // What are the risks? (10%)
}

export const INVESTOREDGE_WEIGHTS: InvestorEdgeComponents = {
  cash_flow: 0.35,
  rent_demand: 0.2,
  appreciation: 0.2,
  entry_point: 0.15,
  risk: 0.1,
};

// Legacy alias for backwards compatibility
export type InvestorEdgeComponentsLegacy = {
  cashflow: number; // now cash_flow
  growth: number; // now appreciation
  demand: number; // now rent_demand
  entrypoint: number; // now entry_point
  risk: number;
};

// Metrics that contribute to each InvestorEdge component
export const INVESTOREDGE_COMPONENT_METRICS: Record<
  keyof InvestorEdgeComponents,
  string[]
> = {
  cash_flow: ['cap_rate', 'grm', 'gross_yield', 'rent_to_price_ratio'],
  rent_demand: [
    'zori_yoy',
    'pending_ratio',
    'median_days_on_market',
    'renter_share',
  ],
  appreciation: ['zhvi_5y_cagr', 'zhvi_yoy', 'population_yoy'],
  entry_point: ['overvalued_pct', 'price_reduced_share', 'months_of_supply'],
  risk: [
    'volatility_36m',
    'unemployment_rate',
    'inventory_surplus_pct',
    'large_multi_permits_yoy',
  ],
};

// ============================================================================
// Market Health Index Components (FREE TIER)
// ============================================================================

export interface MarketHealthComponents {
  demand_strength: number; // How strong is buyer demand? (35%)
  supply_balance: number; // Is supply balanced? (25%)
  price_stability: number; // Are prices stable? (25%)
  economic_foundation: number; // Is the economy strong? (15%)
}

export const MARKET_HEALTH_WEIGHTS: MarketHealthComponents = {
  demand_strength: 0.35,
  supply_balance: 0.25,
  price_stability: 0.25,
  economic_foundation: 0.15,
};

// Metrics that contribute to each Market Health component
export const MARKET_HEALTH_COMPONENT_METRICS: Record<
  keyof MarketHealthComponents,
  string[]
> = {
  demand_strength: ['pending_ratio', 'median_days_on_market', 'hotness_score'],
  supply_balance: [
    'months_of_supply',
    'active_listing_count_yy',
    'new_listing_count_yy',
  ],
  price_stability: ['price_reduced_share', 'sale_to_list_ratio', 'zhvi_yoy'],
  economic_foundation: ['unemployment_rate', 'employment_yoy'],
};

// ============================================================================
// Score Results
// ============================================================================

export interface ComponentScore {
  score: number;
  weight: number;
  weightedContribution: number;
  metricsUsed: string[];
  helpingFactors: string[];
  hurtingFactors: string[];
}

export interface PropertyIQScore {
  geographyId: string;
  geographyType: GeographyType;
  geographyName: string;
  stateCode: string | null;
  periodDate: string;

  // Market Health Index (0-100) - FREE TIER
  marketHealthScore: number | null;
  marketHealthComponents: Record<keyof MarketHealthComponents, ComponentScore> | null;
  marketHealthTrend: 'up' | 'down' | 'stable';
  marketHealthTrendChange: number;

  // HomeReady Score (0-100) - PRO TIER
  homereadyScore: number;
  homereadyComponents: Record<keyof HomeReadyComponents, ComponentScore>;
  homereadyTrend: 'up' | 'down' | 'stable';
  homereadyTrendChange: number;

  // InvestorEdge Score (0-100) - PRO TIER
  investoredgeScore: number;
  investoredgeComponents: Record<keyof InvestorEdgeComponents, ComponentScore>;
  investoredgeTrend: 'up' | 'down' | 'stable';
  investoredgeTrendChange: number;

  // Confidence
  confidenceLevel: 'high' | 'medium' | 'low';
  metricsAvailable: number;
  metricsTotal: number;
  dataFreshnessDays: number;

  // Data completeness tracking
  dataCompleteness: number; // 0-100 percentage
  inheritedMetrics: Record<string, string>; // metric_name -> source_geography_type

  calculatedAt: string;
  calculationVersion: string;
}

// ============================================================================
// Calculated Metrics
// ============================================================================

export interface CalculatedMetrics {
  geographyId: string;
  geographyType: GeographyType;
  periodDate: string;

  // Derived from ZHVI/ZORI
  grm: number | null; // Gross Rent Multiplier (ZHVI / annual ZORI)
  rentPriceRatio: number | null; // Annual rent / home price
  capRateProxy: number | null; // Estimated cap rate (rent yield - expenses)
  priceRentRatio: number | null; // Home price / annual rent

  // YoY changes
  zhviYoyChange: number | null;
  zoriYoyChange: number | null;
  inventoryYoyChange: number | null;

  // Multi-year changes
  zhvi3yChange: number | null;
  zhvi5yChange: number | null;

  // 90-day momentum
  zhvi90dChange: number | null;
  zori90dChange: number | null;
  inventory90dChange: number | null;
  dom90dChange: number | null;

  // Volatility
  zhviStddev12m: number | null;
  zhviStddev36m: number | null;
  zoriStddev12m: number | null;
  inventoryStddev12m: number | null;
  domStddev12m: number | null;

  // Risk indicators
  monthsOfSupply: number | null;
}

// ============================================================================
// Percentile Data
// ============================================================================

export interface MetricPercentiles {
  metricName: string;
  geographyType: GeographyType;
  periodDate: string;
  p10: number;
  p20: number;
  p30: number;
  p40: number;
  p50: number;
  p60: number;
  p70: number;
  p80: number;
  p90: number;
  min: number;
  max: number;
  count: number;
  mean: number;
  stddev: number;
}

// ============================================================================
// Metric Direction (for scoring)
// ============================================================================

export type MetricDirection =
  | 'higher_better'
  | 'lower_better'
  | 'moderate_better'
  | 'neutral';
export type NullStrategy = 'skip' | 'neutral' | 'penalize';

export interface MetricDefinition {
  name: string;
  direction: MetricDirection;
  weight: number;
  nullStrategy: NullStrategy;
  description?: string;
}

// Legacy compatibility
export const METRIC_DIRECTIONS: Record<string, MetricDirection> = {
  // Higher is better
  zhvi_yoy: 'higher_better',
  zori: 'higher_better',
  rent_yield: 'higher_better',
  cap_rate_proxy: 'higher_better',
  population_growth: 'higher_better',
  pending_sales: 'higher_better',
  sale_to_list: 'higher_better',
  homeownership_rate: 'higher_better',

  // Lower is better
  zhvi: 'lower_better', // For affordability
  grm: 'lower_better', // Lower GRM = better cash flow
  dom: 'lower_better', // Faster sales
  price_cuts: 'lower_better',
  unemployment_rate: 'lower_better',
  vacancy_rate: 'lower_better',
  zhvi_volatility: 'lower_better',
  inventory_yoy: 'lower_better', // Rising inventory often negative
  months_supply: 'moderate_better',

  // Neutral (context-dependent)
  inventory: 'neutral',
  sale_price: 'neutral',
  list_price: 'neutral',
  median_income: 'neutral',
};

// ============================================================================
// Detailed Metric Definitions by Component
// ============================================================================

// HomeReady: Affordability Component (30%)
export const HOMEREADY_AFFORDABILITY_METRICS: MetricDefinition[] = [
  {
    name: 'zhvi',
    direction: 'lower_better',
    weight: 0.3,
    nullStrategy: 'penalize',
    description: 'Home Value Index',
  },
  {
    name: 'zori',
    direction: 'lower_better',
    weight: 0.25,
    nullStrategy: 'penalize',
    description: 'Rent Index',
  },
  {
    name: 'homeowner_income',
    direction: 'lower_better',
    weight: 0.2,
    nullStrategy: 'neutral',
    description: 'Income needed to buy',
  },
  {
    name: 'renter_income',
    direction: 'lower_better',
    weight: 0.15,
    nullStrategy: 'neutral',
    description: 'Income needed to rent',
  },
  {
    name: 'affordable_price',
    direction: 'higher_better',
    weight: 0.1,
    nullStrategy: 'skip',
    description: 'Affordable home price',
  },
];

// HomeReady: Stability Component (25%)
export const HOMEREADY_STABILITY_METRICS: MetricDefinition[] = [
  {
    name: 'zhvi_volatility',
    direction: 'lower_better',
    weight: 0.25,
    nullStrategy: 'neutral',
    description: 'Price volatility',
  },
  {
    name: 'inventory',
    direction: 'moderate_better',
    weight: 0.2,
    nullStrategy: 'neutral',
    description: 'Available inventory',
  },
  {
    name: 'months_supply',
    direction: 'moderate_better',
    weight: 0.2,
    nullStrategy: 'neutral',
    description: 'Months of supply',
  },
  {
    name: 'dom',
    direction: 'moderate_better',
    weight: 0.2,
    nullStrategy: 'neutral',
    description: 'Days on market',
  },
  {
    name: 'price_cuts',
    direction: 'lower_better',
    weight: 0.15,
    nullStrategy: 'skip',
    description: 'Price cut frequency',
  },
];

// HomeReady: Value Component (20%)
export const HOMEREADY_VALUE_METRICS: MetricDefinition[] = [
  {
    name: 'sale_to_list',
    direction: 'lower_better',
    weight: 0.3,
    nullStrategy: 'neutral',
    description: 'Sale-to-list ratio',
  },
  {
    name: 'grm',
    direction: 'lower_better',
    weight: 0.25,
    nullStrategy: 'neutral',
    description: 'Gross rent multiplier',
  },
  {
    name: 'price_cuts',
    direction: 'higher_better',
    weight: 0.25,
    nullStrategy: 'skip',
    description: 'Price cuts = negotiation opportunity',
  },
  {
    name: 'zhvi_yoy',
    direction: 'lower_better',
    weight: 0.2,
    nullStrategy: 'neutral',
    description: 'Price appreciation (lower = better entry)',
  },
];

// HomeReady: Livability Component (15%)
export const HOMEREADY_LIVABILITY_METRICS: MetricDefinition[] = [
  {
    name: 'population_growth',
    direction: 'higher_better',
    weight: 0.35,
    nullStrategy: 'neutral',
    description: 'Population growth rate',
  },
  {
    name: 'unemployment_rate',
    direction: 'lower_better',
    weight: 0.35,
    nullStrategy: 'neutral',
    description: 'Unemployment rate',
  },
  {
    name: 'median_income',
    direction: 'higher_better',
    weight: 0.3,
    nullStrategy: 'skip',
    description: 'Median household income',
  },
];

// HomeReady: Momentum Component (10%)
export const HOMEREADY_MOMENTUM_METRICS: MetricDefinition[] = [
  {
    name: 'zhvi_yoy',
    direction: 'lower_better',
    weight: 0.3,
    nullStrategy: 'penalize',
    description: 'Price appreciation slowing',
  },
  {
    name: 'zori_yoy',
    direction: 'lower_better',
    weight: 0.25,
    nullStrategy: 'neutral',
    description: 'Rent growth slowing',
  },
  {
    name: 'inventory_yoy',
    direction: 'higher_better',
    weight: 0.25,
    nullStrategy: 'neutral',
    description: 'Inventory increasing',
  },
  {
    name: 'dom_yoy',
    direction: 'higher_better',
    weight: 0.2,
    nullStrategy: 'skip',
    description: 'Days on market increasing',
  },
];

// InvestorEdge: Cashflow Component (30%)
export const INVESTOREDGE_CASHFLOW_METRICS: MetricDefinition[] = [
  {
    name: 'cap_rate_proxy',
    direction: 'higher_better',
    weight: 0.3,
    nullStrategy: 'penalize',
    description: 'Estimated cap rate',
  },
  {
    name: 'rent_yield',
    direction: 'higher_better',
    weight: 0.25,
    nullStrategy: 'penalize',
    description: 'Gross rent yield',
  },
  {
    name: 'grm',
    direction: 'lower_better',
    weight: 0.25,
    nullStrategy: 'penalize',
    description: 'Gross rent multiplier',
  },
  {
    name: 'zori',
    direction: 'higher_better',
    weight: 0.2,
    nullStrategy: 'neutral',
    description: 'Rent index',
  },
];

// InvestorEdge: Growth Component (25%)
export const INVESTOREDGE_GROWTH_METRICS: MetricDefinition[] = [
  {
    name: 'zhvi_yoy',
    direction: 'higher_better',
    weight: 0.35,
    nullStrategy: 'penalize',
    description: 'YoY appreciation',
  },
  {
    name: 'zhvi_3y_cagr',
    direction: 'higher_better',
    weight: 0.25,
    nullStrategy: 'neutral',
    description: '3-year CAGR',
  },
  {
    name: 'zhvi_5y_cagr',
    direction: 'higher_better',
    weight: 0.2,
    nullStrategy: 'skip',
    description: '5-year CAGR',
  },
  {
    name: 'population_growth',
    direction: 'higher_better',
    weight: 0.2,
    nullStrategy: 'neutral',
    description: 'Population growth',
  },
];

// InvestorEdge: Demand Component (20%)
export const INVESTOREDGE_DEMAND_METRICS: MetricDefinition[] = [
  {
    name: 'dom',
    direction: 'lower_better',
    weight: 0.25,
    nullStrategy: 'neutral',
    description: 'Days on market',
  },
  {
    name: 'sale_to_list',
    direction: 'higher_better',
    weight: 0.25,
    nullStrategy: 'neutral',
    description: 'Sale-to-list ratio',
  },
  {
    name: 'inventory_yoy',
    direction: 'lower_better',
    weight: 0.2,
    nullStrategy: 'neutral',
    description: 'Inventory change',
  },
  {
    name: 'pending_sales',
    direction: 'higher_better',
    weight: 0.15,
    nullStrategy: 'skip',
    description: 'Pending sales',
  },
  {
    name: 'new_listings',
    direction: 'lower_better',
    weight: 0.15,
    nullStrategy: 'skip',
    description: 'New listings',
  },
];

// InvestorEdge: Entrypoint Component (15%)
export const INVESTOREDGE_ENTRYPOINT_METRICS: MetricDefinition[] = [
  {
    name: 'zhvi',
    direction: 'lower_better',
    weight: 0.35,
    nullStrategy: 'penalize',
    description: 'Home price level',
  },
  {
    name: 'price_cuts',
    direction: 'higher_better',
    weight: 0.3,
    nullStrategy: 'neutral',
    description: 'Price cut opportunity',
  },
  {
    name: 'months_supply',
    direction: 'higher_better',
    weight: 0.2,
    nullStrategy: 'neutral',
    description: 'Months of supply',
  },
  {
    name: 'dom',
    direction: 'higher_better',
    weight: 0.15,
    nullStrategy: 'skip',
    description: 'Days on market',
  },
];

// InvestorEdge: Risk Component (10%)
export const INVESTOREDGE_RISK_METRICS: MetricDefinition[] = [
  {
    name: 'zhvi_volatility',
    direction: 'lower_better',
    weight: 0.35,
    nullStrategy: 'penalize',
    description: 'Price volatility',
  },
  {
    name: 'vacancy_rate',
    direction: 'lower_better',
    weight: 0.25,
    nullStrategy: 'neutral',
    description: 'Vacancy rate',
  },
  {
    name: 'unemployment_rate',
    direction: 'lower_better',
    weight: 0.25,
    nullStrategy: 'neutral',
    description: 'Unemployment rate',
  },
  {
    name: 'inventory_volatility',
    direction: 'lower_better',
    weight: 0.15,
    nullStrategy: 'skip',
    description: 'Inventory volatility',
  },
];

// ============================================================================
// NEW: Market Health Detailed Metrics
// ============================================================================

// Market Health: Demand Strength Component (35%)
export const MARKET_HEALTH_DEMAND_STRENGTH_METRICS: MetricDefinition[] = [
  {
    name: 'pending_ratio',
    direction: 'higher_better',
    weight: 0.45,
    nullStrategy: 'neutral',
    description: 'Pending sales ratio',
  },
  {
    name: 'median_days_on_market',
    direction: 'lower_better',
    weight: 0.35,
    nullStrategy: 'neutral',
    description: 'Median days on market',
  },
  {
    name: 'hotness_score',
    direction: 'higher_better',
    weight: 0.2,
    nullStrategy: 'skip',
    description: 'Market hotness score',
  },
];

// Market Health: Supply Balance Component (25%)
export const MARKET_HEALTH_SUPPLY_BALANCE_METRICS: MetricDefinition[] = [
  {
    name: 'months_of_supply',
    direction: 'moderate_better',
    weight: 0.4,
    nullStrategy: 'neutral',
    description: 'Months of supply (optimal: 4-6)',
  },
  {
    name: 'active_listing_count_yy',
    direction: 'moderate_better',
    weight: 0.35,
    nullStrategy: 'neutral',
    description: 'Active listing YoY change',
  },
  {
    name: 'new_listing_count_yy',
    direction: 'moderate_better',
    weight: 0.25,
    nullStrategy: 'skip',
    description: 'New listing YoY change',
  },
];

// Market Health: Price Stability Component (25%)
export const MARKET_HEALTH_PRICE_STABILITY_METRICS: MetricDefinition[] = [
  {
    name: 'price_reduced_share',
    direction: 'lower_better',
    weight: 0.4,
    nullStrategy: 'neutral',
    description: 'Share of listings with price cuts',
  },
  {
    name: 'sale_to_list_ratio',
    direction: 'moderate_better',
    weight: 0.35,
    nullStrategy: 'neutral',
    description: 'Sale-to-list ratio (optimal: 0.97-1.03)',
  },
  {
    name: 'zhvi_yoy',
    direction: 'moderate_better',
    weight: 0.25,
    nullStrategy: 'neutral',
    description: 'ZHVI YoY (optimal: 2-6%)',
  },
];

// Market Health: Economic Foundation Component (15%)
export const MARKET_HEALTH_ECONOMIC_FOUNDATION_METRICS: MetricDefinition[] = [
  {
    name: 'unemployment_rate',
    direction: 'lower_better',
    weight: 0.5,
    nullStrategy: 'neutral',
    description: 'Unemployment rate',
  },
  {
    name: 'employment_yoy',
    direction: 'higher_better',
    weight: 0.5,
    nullStrategy: 'skip',
    description: 'Employment YoY growth',
  },
];

// All Market Health metrics organized by component
export const MARKET_HEALTH_DETAILED_METRICS: Record<
  keyof MarketHealthComponents,
  MetricDefinition[]
> = {
  demand_strength: MARKET_HEALTH_DEMAND_STRENGTH_METRICS,
  supply_balance: MARKET_HEALTH_SUPPLY_BALANCE_METRICS,
  price_stability: MARKET_HEALTH_PRICE_STABILITY_METRICS,
  economic_foundation: MARKET_HEALTH_ECONOMIC_FOUNDATION_METRICS,
};

// ============================================================================
// NEW: HomeReady Detailed Metrics (Updated Component Names)
// ============================================================================

// HomeReady: Market Timing Component (25%) - formerly "value"
export const HOMEREADY_MARKET_TIMING_METRICS: MetricDefinition[] = [
  {
    name: 'price_reduced_share',
    direction: 'higher_better',
    weight: 0.35,
    nullStrategy: 'neutral',
    description: 'Price cuts = buying opportunity',
  },
  {
    name: 'median_days_on_market',
    direction: 'higher_better',
    weight: 0.25,
    nullStrategy: 'neutral',
    description: 'DOM = negotiation leverage',
  },
  {
    name: 'months_of_supply',
    direction: 'higher_better',
    weight: 0.25,
    nullStrategy: 'neutral',
    description: 'Supply = buyer power',
  },
  {
    name: 'pending_listing_count_yy',
    direction: 'lower_better',
    weight: 0.15,
    nullStrategy: 'skip',
    description: 'Pending YoY (lower = less competition)',
  },
];

// HomeReady: Growth Potential Component (15%) - formerly "momentum"
export const HOMEREADY_GROWTH_POTENTIAL_METRICS: MetricDefinition[] = [
  {
    name: 'zhvi_5y_cagr',
    direction: 'higher_better',
    weight: 0.45,
    nullStrategy: 'neutral',
    description: '5-year price CAGR',
  },
  {
    name: 'population_yoy',
    direction: 'higher_better',
    weight: 0.3,
    nullStrategy: 'skip',
    description: 'Population growth',
  },
  {
    name: 'median_household_income_yoy',
    direction: 'higher_better',
    weight: 0.25,
    nullStrategy: 'skip',
    description: 'Income growth',
  },
];

// All HomeReady metrics organized by component (UPDATED)
export const HOMEREADY_DETAILED_METRICS: Record<
  keyof HomeReadyComponents,
  MetricDefinition[]
> = {
  affordability: HOMEREADY_AFFORDABILITY_METRICS,
  market_timing: HOMEREADY_MARKET_TIMING_METRICS,
  stability: HOMEREADY_STABILITY_METRICS,
  growth_potential: HOMEREADY_GROWTH_POTENTIAL_METRICS,
  livability: HOMEREADY_LIVABILITY_METRICS,
};

// ============================================================================
// NEW: InvestorEdge Detailed Metrics (Updated Component Names)
// ============================================================================

// InvestorEdge: Cash Flow Component (35%) - formerly "cashflow"
export const INVESTOREDGE_CASH_FLOW_METRICS: MetricDefinition[] = [
  {
    name: 'cap_rate',
    direction: 'higher_better',
    weight: 0.35,
    nullStrategy: 'penalize',
    description: 'Cap rate',
  },
  {
    name: 'grm',
    direction: 'lower_better',
    weight: 0.25,
    nullStrategy: 'penalize',
    description: 'Gross rent multiplier',
  },
  {
    name: 'gross_yield',
    direction: 'higher_better',
    weight: 0.25,
    nullStrategy: 'neutral',
    description: 'Gross rent yield',
  },
  {
    name: 'rent_to_price_ratio',
    direction: 'higher_better',
    weight: 0.15,
    nullStrategy: 'neutral',
    description: 'Monthly rent / price ratio',
  },
];

// InvestorEdge: Rent Demand Component (20%) - formerly "demand"
export const INVESTOREDGE_RENT_DEMAND_METRICS: MetricDefinition[] = [
  {
    name: 'zori_yoy',
    direction: 'higher_better',
    weight: 0.35,
    nullStrategy: 'neutral',
    description: 'Rent growth YoY',
  },
  {
    name: 'pending_ratio',
    direction: 'higher_better',
    weight: 0.25,
    nullStrategy: 'neutral',
    description: 'Pending sales ratio',
  },
  {
    name: 'median_days_on_market',
    direction: 'lower_better',
    weight: 0.2,
    nullStrategy: 'neutral',
    description: 'Days on market',
  },
  {
    name: 'renter_share',
    direction: 'higher_better',
    weight: 0.2,
    nullStrategy: 'skip',
    description: 'Renter household share',
  },
];

// InvestorEdge: Appreciation Component (20%) - formerly "growth"
export const INVESTOREDGE_APPRECIATION_METRICS: MetricDefinition[] = [
  {
    name: 'zhvi_5y_cagr',
    direction: 'higher_better',
    weight: 0.4,
    nullStrategy: 'neutral',
    description: '5-year price CAGR',
  },
  {
    name: 'zhvi_yoy',
    direction: 'higher_better',
    weight: 0.3,
    nullStrategy: 'neutral',
    description: 'Price appreciation YoY',
  },
  {
    name: 'population_yoy',
    direction: 'higher_better',
    weight: 0.3,
    nullStrategy: 'skip',
    description: 'Population growth',
  },
];

// InvestorEdge: Entry Point Component (15%) - formerly "entrypoint"
export const INVESTOREDGE_ENTRY_POINT_METRICS: MetricDefinition[] = [
  {
    name: 'overvalued_pct',
    direction: 'lower_better',
    weight: 0.4,
    nullStrategy: 'neutral',
    description: 'Overvalued percentage (negative = undervalued)',
  },
  {
    name: 'price_reduced_share',
    direction: 'higher_better',
    weight: 0.35,
    nullStrategy: 'neutral',
    description: 'Price cut opportunity',
  },
  {
    name: 'months_of_supply',
    direction: 'higher_better',
    weight: 0.25,
    nullStrategy: 'neutral',
    description: 'Months of supply',
  },
];

// InvestorEdge: Risk Component (10%) - updated metrics
export const INVESTOREDGE_RISK_METRICS_NEW: MetricDefinition[] = [
  {
    name: 'volatility_36m',
    direction: 'lower_better',
    weight: 0.35,
    nullStrategy: 'neutral',
    description: '36-month price volatility',
  },
  {
    name: 'unemployment_rate',
    direction: 'lower_better',
    weight: 0.3,
    nullStrategy: 'neutral',
    description: 'Unemployment rate',
  },
  {
    name: 'inventory_surplus_pct',
    direction: 'lower_better',
    weight: 0.2,
    nullStrategy: 'skip',
    description: 'Inventory surplus percentage',
  },
  {
    name: 'large_multi_permits_yoy',
    direction: 'lower_better',
    weight: 0.15,
    nullStrategy: 'skip',
    description: 'Large multifamily permits YoY (competition risk)',
  },
];

// All InvestorEdge metrics organized by component (UPDATED)
export const INVESTOREDGE_DETAILED_METRICS: Record<
  keyof InvestorEdgeComponents,
  MetricDefinition[]
> = {
  cash_flow: INVESTOREDGE_CASH_FLOW_METRICS,
  rent_demand: INVESTOREDGE_RENT_DEMAND_METRICS,
  appreciation: INVESTOREDGE_APPRECIATION_METRICS,
  entry_point: INVESTOREDGE_ENTRY_POINT_METRICS,
  risk: INVESTOREDGE_RISK_METRICS_NEW,
};

// ============================================================================
// Scoring Constants
// ============================================================================

export const SCORING_CONSTANTS = {
  // Trend calculation period (months) - changed from 6 to 3
  TREND_MONTHS: 3,

  // Trend threshold for classification (points)
  TREND_THRESHOLD: 2,

  // Confidence thresholds
  HIGH_CONFIDENCE_METRICS_PCT: 0.9,
  HIGH_CONFIDENCE_FRESHNESS_DAYS: 60,
  MEDIUM_CONFIDENCE_METRICS_PCT: 0.7,
  MEDIUM_CONFIDENCE_FRESHNESS_DAYS: 120,

  // Score clamping
  MIN_SCORE: 0,
  MAX_SCORE: 100,

  // Percentile interpolation
  PERCENTILE_BUCKETS: [10, 20, 30, 40, 50, 60, 70, 80, 90],

  // Moderate value target percentile (for moderate_better direction)
  MODERATE_TARGET_PERCENTILE: 50,

  // Data completeness thresholds
  SCORE_AVAILABLE_MIN_COMPLETENESS: 50, // Score unavailable if <50% metrics
  PARTIAL_SCORE_THRESHOLD: 100, // Show "partial" note if <100%
};

// ============================================================================
// Access Control Types
// ============================================================================

export type UserTier = 'free' | 'basic' | 'pro' | 'enterprise';
export type ScoreType = 'market_health' | 'homeready' | 'investoredge';
export type ScoreAccess = 'full' | 'teaser';

export interface ScoreAccessConfig {
  scoreType: ScoreType;
  requiredTier: UserTier[];
}

export const SCORE_ACCESS_CONFIG: Record<ScoreType, UserTier[]> = {
  market_health: ['free', 'basic', 'pro', 'enterprise'], // Available to all
  homeready: ['pro', 'enterprise'], // Pro+ only
  investoredge: ['pro', 'enterprise'], // Pro+ only
};
