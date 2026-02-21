/**
 * Priority-weighted market comparison logic.
 *
 * Extracted from ReportsService to keep pure functions (no DB access)
 * in their own module. Used by the report generation flow to determine
 * which market "wins" given user-selected priorities.
 */

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** Priority score breakdown for a single priority */
export interface PriorityScore {
  priority: string;
  weight: number;
  winnerId: string;
  winnerName: string;
  keyMetric: string;
  winnerValue: number | null;
  loserValue: number | null;
  reason: string;
}

/** Result of priority-weighted winner calculation */
export interface PriorityWeightedResult {
  winnerId: string;
  winnerName: string;
  totalScore: number;
  priorityScores: PriorityScore[];
  reasons: string[];
}

/** Market metrics for AI context - matches template placeholders */
export interface MarketMetrics {
  // Price metrics (Zillow)
  zhvi?: number;
  zhvi_yoy?: number;
  zhvi_3y_cagr?: number;
  zhvi_5y_cagr?: number;
  zhvf_1yr_pct?: number; // 1-year forecast

  // Rent metrics (Zillow)
  zori?: number;
  zori_yoy?: number;
  zori_5y_cagr?: number;
  zordi?: number; // Rental demand index

  // Market activity (Realtor)
  market_heat_index?: number; // alias for hotness_score
  hotness_score?: number;
  demand_score?: number;
  supply_score?: number;
  days_to_pending?: number;
  days_on_market?: number;
  for_sale_inventory?: number;
  active_listing_count?: number;
  inventory_yoy?: number;
  new_listings?: number;
  pending_ratio?: number;
  price_reduced_share?: number;
  price_cut_pct?: number;
  sale_to_list_ratio?: number;
  months_of_supply?: number;
  median_listing_price?: number;
  median_listing_price_yoy?: number;

  // Investment metrics (Calculated)
  cap_rate?: number;
  cap_rate_proxy?: number;
  gross_yield?: number;
  gross_rent_multiplier?: number;
  grm?: number;
  rent_to_price_ratio?: number;
  overvalued_pct?: number;
  affordability_index?: number;
  affordability_ratio?: number;
  affordability_gap?: number;
  income_needed_to_buy?: number;
  income_percentile_to_buy?: number;
  rent_to_income_ratio?: number;

  // Census/Economic data
  median_household_income?: number;
  median_income?: number;
  population?: number;
  population_growth_yoy?: number;
  population_yoy?: number;
  unemployment_rate?: number;
  job_growth_yoy?: number;
  income_growth_yoy?: number;
  net_migration?: number;
  median_age?: number;
  homeownership_rate?: number;
  remote_work_pct?: number;

  // Historical comparisons
  zhvi_vs_2007_peak?: number;
  zhvi_vs_2012_trough?: number;
  zhvi_vs_pre_covid?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a number as currency for display (e.g. $499,000) */
function formatCurrency(value: number | undefined): string {
  if (value === undefined || value === null) return 'N/A';
  return '$' + Math.round(value).toLocaleString();
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Priority to metric mappings for each user type
 */
export const PRIORITY_METRICS: Record<string, string[]> = {
  // Homebuyer priorities
  affordability: [
    'affordability_index',
    'median_income',
    'median_listing_price',
  ],
  appreciation: ['zhvi_yoy', 'zhvf_1yr_pct', 'zhvi_5y_cagr'],
  job_market: ['job_growth_yoy', 'unemployment_rate'],
  market_timing: ['days_on_market', 'months_of_supply', 'price_cut_pct'],
  lifestyle: ['population', 'median_age', 'population_growth_yoy'],

  // Investor priorities
  cash_flow: ['cap_rate', 'gross_yield', 'rent_to_price_ratio'],
  tenant_demand: ['zori_yoy', 'zordi', 'demand_score'],
  entry_price: ['median_listing_price', 'overvalued_pct'],
  stability: ['months_of_supply', 'inventory_yoy', 'zhvi_yoy'],
};

/**
 * Metrics where lower values are better
 */
export const LOWER_IS_BETTER: Set<string> = new Set([
  'unemployment_rate',
  'days_on_market',
  'months_of_supply',
  'price_cut_pct',
  'median_listing_price',
  'overvalued_pct',
]);

// ---------------------------------------------------------------------------
// Public Functions
// ---------------------------------------------------------------------------

/** Shape of a single market passed into the comparison function */
export interface MarketInput {
  geography: { id: string; name: string };
  metrics: MarketMetrics;
  scores?: any;
}

/**
 * Calculate the priority-weighted winner between markets.
 *
 * @param primaryMarket - Primary market data with geography and metrics
 * @param comparisonMarkets - Comparison market data
 * @param priorities - User's priorities (up to 3)
 * @param _userType - homebuyer or investor (reserved for future use)
 * @returns Winner information with reasons, or null if inputs are insufficient
 */
export function calculatePriorityWeightedWinner(
  primaryMarket: MarketInput,
  comparisonMarkets: MarketInput[],
  priorities: string[],
  _userType: 'homebuyer' | 'investor',
): PriorityWeightedResult | null {
  if (!priorities || priorities.length === 0 || comparisonMarkets.length === 0) {
    return null;
  }

  // Combine all markets for comparison
  const allMarkets = [primaryMarket, ...comparisonMarkets];

  // Weight by position: 1st priority = 3pts, 2nd = 2pts, 3rd = 1pt
  const weights = [3, 2, 1];

  // Track scores for each market
  const marketScores: Map<string, number> = new Map();
  const priorityResults: PriorityScore[] = [];

  // Initialize scores
  for (const market of allMarkets) {
    marketScores.set(market.geography.id, 0);
  }

  // Score each priority
  for (let i = 0; i < Math.min(priorities.length, 3); i++) {
    const priority = priorities[i];
    const weight = weights[i];
    const metricsForPriority = PRIORITY_METRICS[priority] || [];

    if (metricsForPriority.length === 0) {
      continue;
    }

    // Find the best market for this priority
    let bestMarket = allMarkets[0];
    let bestScore = -Infinity;
    let keyMetric = metricsForPriority[0];
    let bestValue: number | null = null;

    for (const market of allMarkets) {
      let priorityScore = 0;
      let validMetrics = 0;

      for (const metric of metricsForPriority) {
        const value = market.metrics[metric as keyof MarketMetrics];
        if (value != null && typeof value === 'number') {
          // Normalize: lower is better metrics get inverted
          const normalizedValue = LOWER_IS_BETTER.has(metric)
            ? -value
            : value;
          priorityScore += normalizedValue;
          validMetrics++;
        }
      }

      // Average the score if we have valid metrics
      const avgScore = validMetrics > 0 ? priorityScore / validMetrics : 0;

      if (avgScore > bestScore) {
        bestScore = avgScore;
        bestMarket = market;
        // Find the primary metric value for display
        for (const m of metricsForPriority) {
          const v = market.metrics[m as keyof MarketMetrics];
          if (v != null) {
            keyMetric = m;
            bestValue = v as number;
            break;
          }
        }
      }
    }

    // Award points to the best market
    const currentScore = marketScores.get(bestMarket.geography.id) || 0;
    marketScores.set(bestMarket.geography.id, currentScore + weight);

    // Find the "loser" value for comparison
    let loserValue: number | null = null;
    for (const market of allMarkets) {
      if (market.geography.id !== bestMarket.geography.id) {
        const v = market.metrics[keyMetric as keyof MarketMetrics];
        if (v != null) {
          loserValue = v as number;
          break;
        }
      }
    }

    // Generate reason text
    const reason = generatePriorityReason(
      priority,
      keyMetric,
      bestValue,
      loserValue,
      bestMarket.geography.name,
    );

    priorityResults.push({
      priority,
      weight,
      winnerId: bestMarket.geography.id,
      winnerName: bestMarket.geography.name,
      keyMetric,
      winnerValue: bestValue,
      loserValue,
      reason,
    });
  }

  // Find overall winner
  let winnerId = allMarkets[0].geography.id;
  let winnerName = allMarkets[0].geography.name;
  let maxScore = 0;

  for (const [marketId, score] of marketScores) {
    if (score > maxScore) {
      maxScore = score;
      winnerId = marketId;
      const market = allMarkets.find((m) => m.geography.id === marketId);
      winnerName = market?.geography.name || marketId;
    }
  }

  // Generate top 3 reasons
  const reasons = priorityResults
    .filter((r) => r.winnerId === winnerId)
    .slice(0, 3)
    .map((r) => r.reason);

  return {
    winnerId,
    winnerName,
    totalScore: maxScore,
    priorityScores: priorityResults,
    reasons,
  };
}

/**
 * Generate a human-readable reason for why a market won on a priority
 */
export function generatePriorityReason(
  priority: string,
  metric: string,
  winnerValue: number | null,
  loserValue: number | null,
  winnerName: string,
): string {
  const priorityLabels: Record<string, string> = {
    affordability: 'Affordability',
    appreciation: 'Appreciation Potential',
    job_market: 'Job Market Strength',
    market_timing: 'Market Timing',
    lifestyle: 'Lifestyle Factors',
    cash_flow: 'Cash Flow',
    tenant_demand: 'Tenant Demand',
    entry_price: 'Entry Price',
    stability: 'Market Stability',
  };

  const metricDescriptions: Record<string, string> = {
    affordability_index: 'better affordability ratio',
    median_income: 'higher household incomes',
    median_listing_price: 'lower median prices',
    zhvi_yoy: 'stronger year-over-year appreciation',
    zhvf_1yr_pct: 'better appreciation forecast',
    zhvi_5y_cagr: 'stronger 5-year appreciation history',
    job_growth_yoy: 'stronger job growth',
    unemployment_rate: 'lower unemployment',
    days_on_market: 'faster-selling market',
    months_of_supply: 'tighter inventory',
    price_cut_pct: 'fewer price cuts',
    cap_rate: 'higher cap rate',
    gross_yield: 'better gross yield',
    rent_to_price_ratio: 'better rent-to-price ratio',
    zori_yoy: 'stronger rent growth',
    zordi: 'higher rental demand',
    demand_score: 'stronger buyer demand',
    overvalued_pct: 'less overvalued relative to fundamentals',
    inventory_yoy: 'healthier inventory levels',
    population: 'larger population base',
    median_age: 'favorable demographics',
    population_growth_yoy: 'stronger population growth',
  };

  const priorityLabel = priorityLabels[priority] || priority;
  const metricDesc = metricDescriptions[metric] || metric;

  if (winnerValue == null) {
    return `${winnerName} wins on ${priorityLabel}`;
  }

  // Format the value based on the metric type
  let formattedWinner = String(winnerValue);
  let formattedLoser = loserValue != null ? String(loserValue) : 'N/A';

  if (
    metric.includes('rate') ||
    metric.includes('pct') ||
    metric.includes('yoy') ||
    metric.includes('cagr')
  ) {
    formattedWinner = `${winnerValue.toFixed(1)}%`;
    formattedLoser =
      loserValue != null ? `${loserValue.toFixed(1)}%` : 'N/A';
  } else if (metric.includes('price') || metric.includes('income')) {
    formattedWinner = formatCurrency(winnerValue);
    formattedLoser =
      loserValue != null ? formatCurrency(loserValue) : 'N/A';
  } else if (metric === 'days_on_market' || metric === 'months_of_supply') {
    formattedWinner = `${Math.round(winnerValue)} days`;
    formattedLoser =
      loserValue != null ? `${Math.round(loserValue)} days` : 'N/A';
  }

  return `${winnerName} leads on ${priorityLabel} with ${metricDesc} (${formattedWinner} vs ${formattedLoser})`;
}
