/**
 * PropertyIQ Scoring Types
 *
 * Type definitions for the dual scoring system:
 * - HomeReady: For homebuyers and renters
 * - InvestorEdge: For real estate investors
 */

// ============================================================================
// Core Types
// ============================================================================

export type GeographyType = 'state' | 'metro' | 'county' | 'zip';

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
  affordability: number;  // Can I afford to live here?
  stability: number;      // Is this market stable?
  value: number;          // Am I getting good value?
  livability: number;     // Is this a good place to live?
  momentum: number;       // Is the market trending favorably?
}

export const HOMEREADY_WEIGHTS: HomeReadyComponents = {
  affordability: 0.30,
  stability: 0.25,
  value: 0.20,
  livability: 0.15,
  momentum: 0.10,
};

// Metrics that contribute to each HomeReady component
export const HOMEREADY_COMPONENT_METRICS: Record<keyof HomeReadyComponents, string[]> = {
  affordability: ['zhvi', 'zori', 'zori_yoy', 'median_income', 'mortgage_rate_30y'],
  stability: ['inventory', 'inventory_yoy', 'months_supply', 'zhvi_volatility', 'vacancy_rate', 'homeownership_rate'],
  value: ['sale_price', 'sale_price_yoy', 'sale_to_list', 'price_cuts', 'grm'],
  livability: ['population', 'population_growth', 'unemployment_rate'],
  momentum: ['zhvi_yoy', 'zhvi_mom', 'dom', 'pending_sales'],
};

// ============================================================================
// InvestorEdge Score Components
// ============================================================================

export interface InvestorEdgeComponents {
  cashflow: number;    // Can I generate positive cash flow?
  growth: number;      // Will property values appreciate?
  demand: number;      // Is there strong rental/buyer demand?
  entrypoint: number;  // Is this a good entry price?
  risk: number;        // What are the risks?
}

export const INVESTOREDGE_WEIGHTS: InvestorEdgeComponents = {
  cashflow: 0.30,
  growth: 0.25,
  demand: 0.20,
  entrypoint: 0.15,
  risk: 0.10,
};

// Metrics that contribute to each InvestorEdge component
export const INVESTOREDGE_COMPONENT_METRICS: Record<keyof InvestorEdgeComponents, string[]> = {
  cashflow: ['zori', 'zori_yoy', 'grm', 'rent_yield', 'cap_rate_proxy'],
  growth: ['zhvi_yoy', 'sale_price_yoy', 'zhvi_3y_cagr', 'zhvi_5y_cagr', 'gdp_growth', 'zhvi_mom'],
  demand: ['inventory', 'inventory_yoy', 'dom', 'new_listings', 'pending_sales', 'sale_to_list', 'population_growth', 'months_supply'],
  entrypoint: ['zhvi', 'sale_price', 'list_price', 'price_cuts'],
  risk: ['zhvi_volatility', 'vacancy_rate', 'unemployment_rate'],
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

  // HomeReady Score (0-100)
  homereadyScore: number;
  homereadyComponents: Record<keyof HomeReadyComponents, ComponentScore>;
  homereadyTrend: 'up' | 'down' | 'stable';
  homereadyTrendChange: number;

  // InvestorEdge Score (0-100)
  investoredgeScore: number;
  investoredgeComponents: Record<keyof InvestorEdgeComponents, ComponentScore>;
  investoredgeTrend: 'up' | 'down' | 'stable';
  investoredgeTrendChange: number;

  // Confidence
  confidenceLevel: 'high' | 'medium' | 'low';
  metricsAvailable: number;
  metricsTotal: number;
  dataFreshnessDays: number;

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
  grm: number | null;              // Gross Rent Multiplier (ZHVI / annual ZORI)
  rentPriceRatio: number | null;   // Annual rent / home price
  capRateProxy: number | null;     // Estimated cap rate (rent yield - expenses)
  priceRentRatio: number | null;   // Home price / annual rent

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

export type MetricDirection = 'higher_better' | 'lower_better' | 'moderate_better' | 'neutral';
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
  zhvi: 'lower_better',           // For affordability
  grm: 'lower_better',            // Lower GRM = better cash flow
  dom: 'lower_better',            // Faster sales
  price_cuts: 'lower_better',
  unemployment_rate: 'lower_better',
  vacancy_rate: 'lower_better',
  zhvi_volatility: 'lower_better',
  inventory_yoy: 'lower_better',  // Rising inventory often negative
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
  { name: 'zhvi', direction: 'lower_better', weight: 0.30, nullStrategy: 'penalize', description: 'Home Value Index' },
  { name: 'zori', direction: 'lower_better', weight: 0.25, nullStrategy: 'penalize', description: 'Rent Index' },
  { name: 'homeowner_income', direction: 'lower_better', weight: 0.20, nullStrategy: 'neutral', description: 'Income needed to buy' },
  { name: 'renter_income', direction: 'lower_better', weight: 0.15, nullStrategy: 'neutral', description: 'Income needed to rent' },
  { name: 'affordable_price', direction: 'higher_better', weight: 0.10, nullStrategy: 'skip', description: 'Affordable home price' },
];

// HomeReady: Stability Component (25%)
export const HOMEREADY_STABILITY_METRICS: MetricDefinition[] = [
  { name: 'zhvi_volatility', direction: 'lower_better', weight: 0.25, nullStrategy: 'neutral', description: 'Price volatility' },
  { name: 'inventory', direction: 'moderate_better', weight: 0.20, nullStrategy: 'neutral', description: 'Available inventory' },
  { name: 'months_supply', direction: 'moderate_better', weight: 0.20, nullStrategy: 'neutral', description: 'Months of supply' },
  { name: 'dom', direction: 'moderate_better', weight: 0.20, nullStrategy: 'neutral', description: 'Days on market' },
  { name: 'price_cuts', direction: 'lower_better', weight: 0.15, nullStrategy: 'skip', description: 'Price cut frequency' },
];

// HomeReady: Value Component (20%)
export const HOMEREADY_VALUE_METRICS: MetricDefinition[] = [
  { name: 'sale_to_list', direction: 'lower_better', weight: 0.30, nullStrategy: 'neutral', description: 'Sale-to-list ratio' },
  { name: 'grm', direction: 'lower_better', weight: 0.25, nullStrategy: 'neutral', description: 'Gross rent multiplier' },
  { name: 'price_cuts', direction: 'higher_better', weight: 0.25, nullStrategy: 'skip', description: 'Price cuts = negotiation opportunity' },
  { name: 'zhvi_yoy', direction: 'lower_better', weight: 0.20, nullStrategy: 'neutral', description: 'Price appreciation (lower = better entry)' },
];

// HomeReady: Livability Component (15%)
export const HOMEREADY_LIVABILITY_METRICS: MetricDefinition[] = [
  { name: 'population_growth', direction: 'higher_better', weight: 0.35, nullStrategy: 'neutral', description: 'Population growth rate' },
  { name: 'unemployment_rate', direction: 'lower_better', weight: 0.35, nullStrategy: 'neutral', description: 'Unemployment rate' },
  { name: 'median_income', direction: 'higher_better', weight: 0.30, nullStrategy: 'skip', description: 'Median household income' },
];

// HomeReady: Momentum Component (10%)
export const HOMEREADY_MOMENTUM_METRICS: MetricDefinition[] = [
  { name: 'zhvi_yoy', direction: 'lower_better', weight: 0.30, nullStrategy: 'penalize', description: 'Price appreciation slowing' },
  { name: 'zori_yoy', direction: 'lower_better', weight: 0.25, nullStrategy: 'neutral', description: 'Rent growth slowing' },
  { name: 'inventory_yoy', direction: 'higher_better', weight: 0.25, nullStrategy: 'neutral', description: 'Inventory increasing' },
  { name: 'dom_yoy', direction: 'higher_better', weight: 0.20, nullStrategy: 'skip', description: 'Days on market increasing' },
];

// InvestorEdge: Cashflow Component (30%)
export const INVESTOREDGE_CASHFLOW_METRICS: MetricDefinition[] = [
  { name: 'cap_rate_proxy', direction: 'higher_better', weight: 0.30, nullStrategy: 'penalize', description: 'Estimated cap rate' },
  { name: 'rent_yield', direction: 'higher_better', weight: 0.25, nullStrategy: 'penalize', description: 'Gross rent yield' },
  { name: 'grm', direction: 'lower_better', weight: 0.25, nullStrategy: 'penalize', description: 'Gross rent multiplier' },
  { name: 'zori', direction: 'higher_better', weight: 0.20, nullStrategy: 'neutral', description: 'Rent index' },
];

// InvestorEdge: Growth Component (25%)
export const INVESTOREDGE_GROWTH_METRICS: MetricDefinition[] = [
  { name: 'zhvi_yoy', direction: 'higher_better', weight: 0.35, nullStrategy: 'penalize', description: 'YoY appreciation' },
  { name: 'zhvi_3y_cagr', direction: 'higher_better', weight: 0.25, nullStrategy: 'neutral', description: '3-year CAGR' },
  { name: 'zhvi_5y_cagr', direction: 'higher_better', weight: 0.20, nullStrategy: 'skip', description: '5-year CAGR' },
  { name: 'population_growth', direction: 'higher_better', weight: 0.20, nullStrategy: 'neutral', description: 'Population growth' },
];

// InvestorEdge: Demand Component (20%)
export const INVESTOREDGE_DEMAND_METRICS: MetricDefinition[] = [
  { name: 'dom', direction: 'lower_better', weight: 0.25, nullStrategy: 'neutral', description: 'Days on market' },
  { name: 'sale_to_list', direction: 'higher_better', weight: 0.25, nullStrategy: 'neutral', description: 'Sale-to-list ratio' },
  { name: 'inventory_yoy', direction: 'lower_better', weight: 0.20, nullStrategy: 'neutral', description: 'Inventory change' },
  { name: 'pending_sales', direction: 'higher_better', weight: 0.15, nullStrategy: 'skip', description: 'Pending sales' },
  { name: 'new_listings', direction: 'lower_better', weight: 0.15, nullStrategy: 'skip', description: 'New listings' },
];

// InvestorEdge: Entrypoint Component (15%)
export const INVESTOREDGE_ENTRYPOINT_METRICS: MetricDefinition[] = [
  { name: 'zhvi', direction: 'lower_better', weight: 0.35, nullStrategy: 'penalize', description: 'Home price level' },
  { name: 'price_cuts', direction: 'higher_better', weight: 0.30, nullStrategy: 'neutral', description: 'Price cut opportunity' },
  { name: 'months_supply', direction: 'higher_better', weight: 0.20, nullStrategy: 'neutral', description: 'Months of supply' },
  { name: 'dom', direction: 'higher_better', weight: 0.15, nullStrategy: 'skip', description: 'Days on market' },
];

// InvestorEdge: Risk Component (10%)
export const INVESTOREDGE_RISK_METRICS: MetricDefinition[] = [
  { name: 'zhvi_volatility', direction: 'lower_better', weight: 0.35, nullStrategy: 'penalize', description: 'Price volatility' },
  { name: 'vacancy_rate', direction: 'lower_better', weight: 0.25, nullStrategy: 'neutral', description: 'Vacancy rate' },
  { name: 'unemployment_rate', direction: 'lower_better', weight: 0.25, nullStrategy: 'neutral', description: 'Unemployment rate' },
  { name: 'inventory_volatility', direction: 'lower_better', weight: 0.15, nullStrategy: 'skip', description: 'Inventory volatility' },
];

// All HomeReady metrics organized by component
export const HOMEREADY_DETAILED_METRICS: Record<keyof HomeReadyComponents, MetricDefinition[]> = {
  affordability: HOMEREADY_AFFORDABILITY_METRICS,
  stability: HOMEREADY_STABILITY_METRICS,
  value: HOMEREADY_VALUE_METRICS,
  livability: HOMEREADY_LIVABILITY_METRICS,
  momentum: HOMEREADY_MOMENTUM_METRICS,
};

// All InvestorEdge metrics organized by component
export const INVESTOREDGE_DETAILED_METRICS: Record<keyof InvestorEdgeComponents, MetricDefinition[]> = {
  cashflow: INVESTOREDGE_CASHFLOW_METRICS,
  growth: INVESTOREDGE_GROWTH_METRICS,
  demand: INVESTOREDGE_DEMAND_METRICS,
  entrypoint: INVESTOREDGE_ENTRYPOINT_METRICS,
  risk: INVESTOREDGE_RISK_METRICS,
};

// ============================================================================
// Scoring Constants
// ============================================================================

export const SCORING_CONSTANTS = {
  // Trend calculation period (months)
  TREND_MONTHS: 6,

  // Trend threshold for classification (points)
  TREND_THRESHOLD: 2,

  // Confidence thresholds
  HIGH_CONFIDENCE_METRICS_PCT: 0.90,
  HIGH_CONFIDENCE_FRESHNESS_DAYS: 60,
  MEDIUM_CONFIDENCE_METRICS_PCT: 0.70,
  MEDIUM_CONFIDENCE_FRESHNESS_DAYS: 120,

  // Score clamping
  MIN_SCORE: 0,
  MAX_SCORE: 100,

  // Percentile interpolation
  PERCENTILE_BUCKETS: [10, 20, 30, 40, 50, 60, 70, 80, 90],

  // Moderate value target percentile (for moderate_better direction)
  MODERATE_TARGET_PERCENTILE: 50,
};
