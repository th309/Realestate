/**
 * Score Contextualization Utilities
 *
 * Pure functions for generating human-readable interpretations of PropertyIQ scores.
 * These have no database access or service dependencies - they transform numeric
 * scores into descriptive text, percentile comparisons, dollar-impact estimates,
 * and cross-market comparisons.
 *
 * Extracted from ReportsService to allow reuse across the backend (e.g. API
 * response enrichment, PDF generation, email digests) without instantiating
 * the full reports module.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Score contextualization - provides human-readable interpretation of scores
 */
export interface ScoreContext {
  /** Human-readable interpretation (e.g., "Excellent buying conditions") */
  interpretation: string;
  /** Percentile comparison text (e.g., "Top 15% of metros in your price range") */
  percentile_text: string;
  /** Practical dollar impact (e.g., "Historically, homes in similar markets appreciated...") */
  dollar_impact?: string;
  /** Comparison to other areas (e.g., "Better than 85% of comparable areas") */
  comparison?: string;
}

/**
 * Score type definitions for contextualization
 */
export type ScoreType = 'homeready' | 'investoredge' | 'markethealth';

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/**
 * Format number for display
 */
export function formatNumber(value: number | undefined, decimals = 0): string {
  if (value === undefined || value === null) return 'N/A';
  if (decimals === 0) return Math.round(value).toLocaleString();
  return value.toFixed(decimals);
}

/**
 * Format currency for display
 */
export function formatCurrency(value: number | undefined): string {
  if (value === undefined || value === null) return 'N/A';
  return '$' + Math.round(value).toLocaleString();
}

/**
 * Format percentage for display
 */
export function formatPercent(value: number | undefined, decimals = 1): string {
  if (value === undefined || value === null) return 'N/A';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Format priority name for display
 */
export function formatPriorityName(priority: string): string {
  const names: Record<string, string> = {
    affordability: 'Affordability',
    appreciation: 'Appreciation',
    job_market: 'Job Market',
    market_timing: 'Market Timing',
    lifestyle: 'Lifestyle',
    cash_flow: 'Cash Flow',
    tenant_demand: 'Tenant Demand',
    entry_price: 'Entry Price',
    stability: 'Stability',
  };
  return names[priority] || priority;
}

// ---------------------------------------------------------------------------
// Score Contextualization
// ---------------------------------------------------------------------------

/**
 * Generate human-readable context for a score
 *
 * @param score - The numeric score (0-100)
 * @param scoreType - The type of score (homeready, investoredge, markethealth)
 * @param geoData - Optional geography data for enhanced context
 * @returns ScoreContext with interpretation and comparison text
 */
export function generateScoreContext(
  score: number,
  scoreType: ScoreType,
  geoData?: {
    geography_type?: 'metro' | 'county' | 'zip';
    median_price?: number;
    percentile?: number;
    total_markets?: number;
  },
): ScoreContext {
  // Get base interpretation based on score range
  const interpretation = getScoreInterpretation(score, scoreType);

  // Generate percentile text
  const percentile_text = getPercentileText(score, scoreType, geoData);

  // Generate dollar impact based on score type and value
  const dollar_impact = getDollarImpact(score, scoreType, geoData?.median_price);

  // Generate comparison text
  const comparison = getComparisonText(score, geoData);

  return {
    interpretation,
    percentile_text,
    dollar_impact,
    comparison,
  };
}

/**
 * Get human-readable interpretation based on score range
 */
export function getScoreInterpretation(score: number, scoreType: ScoreType): string {
  // Score range labels based on GRADE_THRESHOLDS
  const getRangeLabel = (score: number): string => {
    if (score >= 93) return 'exceptional';
    if (score >= 87) return 'excellent';
    if (score >= 80) return 'very good';
    if (score >= 73) return 'good';
    if (score >= 67) return 'above average';
    if (score >= 60) return 'moderate';
    if (score >= 50) return 'below average';
    if (score >= 40) return 'poor';
    return 'very poor';
  };

  const rangeLabel = getRangeLabel(score);

  // Score-type specific interpretations
  const interpretations: Record<ScoreType, Record<string, string>> = {
    homeready: {
      exceptional: 'Exceptional buying conditions with strong appreciation potential',
      excellent: 'Excellent market for homebuyers with favorable long-term outlook',
      'very good': 'Very good buying opportunity with solid fundamentals',
      good: 'Good conditions for buyers seeking stable markets',
      'above average': 'Above average market with reasonable buying conditions',
      moderate: 'Moderate conditions - consider timing and specific neighborhoods',
      'below average': 'Below average conditions - buyer caution advised',
      poor: 'Poor buying conditions - significant headwinds present',
      'very poor': 'Very challenging market for homebuyers',
    },
    investoredge: {
      exceptional: 'Exceptional investment opportunity with strong returns expected',
      excellent: 'Excellent rental market with high yield potential',
      'very good': 'Very good investment fundamentals and cash flow potential',
      good: 'Good investment conditions with reasonable returns',
      'above average': 'Above average returns likely compared to most markets',
      moderate: 'Moderate investment potential - selective opportunities exist',
      'below average': 'Below average returns expected - careful analysis needed',
      poor: 'Poor investment conditions - limited upside potential',
      'very poor': 'Very challenging for real estate investment',
    },
    markethealth: {
      exceptional: 'Exceptionally strong market with high demand and activity',
      excellent: 'Excellent market health with robust buyer competition',
      'very good': 'Very healthy market conditions with strong momentum',
      good: 'Good market dynamics with balanced supply and demand',
      'above average': 'Above average market activity and conditions',
      moderate: 'Moderate market conditions - neither hot nor cold',
      'below average': 'Below average market activity - slower conditions',
      poor: 'Poor market health - low demand and slow activity',
      'very poor': 'Very weak market conditions with significant oversupply',
    },
  };

  return interpretations[scoreType][rangeLabel] || 'Score data available';
}

/**
 * Generate percentile comparison text
 */
export function getPercentileText(
  score: number,
  scoreType: ScoreType,
  geoData?: { geography_type?: 'metro' | 'county' | 'zip'; percentile?: number; total_markets?: number },
): string {
  // If we have actual percentile data, use it
  if (geoData?.percentile !== undefined) {
    const position = geoData.percentile;
    if (position <= 10) return `Top 10% of ${getGeoLabel(geoData.geography_type)}s`;
    if (position <= 25) return `Top 25% of ${getGeoLabel(geoData.geography_type)}s`;
    if (position <= 50) return `Top half of ${getGeoLabel(geoData.geography_type)}s`;
    if (position <= 75) return `Bottom half of ${getGeoLabel(geoData.geography_type)}s`;
    return `Bottom 25% of ${getGeoLabel(geoData.geography_type)}s`;
  }

  // Scores are normalized 0-100 across all markets, so score roughly maps to percentile
  const geoLabel = getGeoLabel(geoData?.geography_type);

  if (score >= 90) {
    return `Top 10% of ${geoLabel}s nationwide`;
  } else if (score >= 80) {
    return `Top 20% of ${geoLabel}s nationwide`;
  } else if (score >= 70) {
    return `Top 30% of ${geoLabel}s nationwide`;
  } else if (score >= 60) {
    return `Above average among ${geoLabel}s`;
  } else if (score >= 50) {
    return `Average compared to other ${geoLabel}s`;
  } else if (score >= 40) {
    return `Below average among ${geoLabel}s`;
  } else {
    return `Bottom 40% of ${geoLabel}s nationwide`;
  }
}

/**
 * Get geography label for display
 */
export function getGeoLabel(geoType?: 'metro' | 'county' | 'zip'): string {
  switch (geoType) {
    case 'metro': return 'metro area';
    case 'county': return 'county';
    case 'zip': return 'ZIP code';
    default: return 'market';
  }
}

/**
 * Generate practical dollar impact text based on score type
 */
export function getDollarImpact(
  score: number,
  scoreType: ScoreType,
  medianPrice?: number,
): string | undefined {
  // Don't generate dollar impact if no price data
  if (!medianPrice) return undefined;

  // Calculate appreciation/return estimates based on score
  // These are rough estimates based on historical data patterns
  switch (scoreType) {
    case 'homeready': {
      // HomeReady predicts 3-year appreciation
      // High scores (80+) historically correlate with ~5-8% annual appreciation
      // Low scores (40-) correlate with 0-2% annual appreciation
      let annualAppreciation: number;
      if (score >= 80) {
        annualAppreciation = 5 + ((score - 80) / 20) * 3; // 5-8%
      } else if (score >= 60) {
        annualAppreciation = 3 + ((score - 60) / 20) * 2; // 3-5%
      } else if (score >= 40) {
        annualAppreciation = 1 + ((score - 40) / 20) * 2; // 1-3%
      } else {
        annualAppreciation = Math.max(0, (score / 40) * 1); // 0-1%
      }

      const threeYearGain = medianPrice * (Math.pow(1 + annualAppreciation / 100, 3) - 1);

      if (threeYearGain > 1000) {
        return `Homes in similar markets have historically appreciated ~${formatCurrency(Math.round(threeYearGain))} over 3 years (${annualAppreciation.toFixed(1)}% annually)`;
      }
      return `Limited appreciation expected (~${annualAppreciation.toFixed(1)}% annually) based on current market conditions`;
    }

    case 'investoredge': {
      // InvestorEdge predicts total return (appreciation + yield)
      // High scores suggest ~8-12% total annual return
      // Low scores suggest 2-5% total annual return
      let totalReturn: number;
      if (score >= 80) {
        totalReturn = 8 + ((score - 80) / 20) * 4; // 8-12%
      } else if (score >= 60) {
        totalReturn = 5 + ((score - 60) / 20) * 3; // 5-8%
      } else if (score >= 40) {
        totalReturn = 3 + ((score - 40) / 20) * 2; // 3-5%
      } else {
        totalReturn = 2 + (score / 40) * 1; // 2-3%
      }

      const annualReturn = medianPrice * (totalReturn / 100);

      if (annualReturn > 5000) {
        return `Expected annual return potential of ~${formatCurrency(annualReturn)} (${totalReturn.toFixed(1)}% yield + appreciation)`;
      }
      return undefined;
    }

    case 'markethealth': {
      // MarketHealth is about current conditions, not returns
      // Focus on liquidity and time-to-sell implications
      if (score >= 80) {
        return 'Properties typically sell within 2-3 weeks at or above asking price';
      } else if (score >= 60) {
        return 'Properties typically sell within 30-45 days near asking price';
      } else if (score >= 40) {
        return 'Properties may take 60-90 days to sell, often with price negotiations';
      } else {
        return 'Extended time on market common; significant negotiation expected';
      }
    }

    default:
      return undefined;
  }
}

/**
 * Generate comparison text based on score and geography
 */
export function getComparisonText(
  score: number,
  geoData?: { geography_type?: 'metro' | 'county' | 'zip'; total_markets?: number },
): string | undefined {
  // Calculate approximate percentile from score
  // Scores are normalized 0-100, so a score of 75 means roughly better than 75% of markets
  const betterThanPercent = Math.round(score);

  if (score >= 80) {
    return `Better than ${betterThanPercent}% of comparable areas`;
  } else if (score >= 60) {
    return `Outperforming ${betterThanPercent}% of similar markets`;
  } else if (score >= 40) {
    return `Performing similar to average markets`;
  } else {
    return `Underperforming compared to ${100 - betterThanPercent}% of markets`;
  }
}

/**
 * Generate score contexts for all score types in a report.
 * Returns a map of score type to context.
 */
export function generateAllScoreContexts(
  scores: {
    homeready?: { score: number; grade: string };
    investoredge?: { score: number; grade: string };
    markethealth?: { score: number; grade: string };
  },
  geoData?: {
    geography_type?: 'metro' | 'county' | 'zip';
    median_price?: number;
  },
): Record<ScoreType, ScoreContext | null> {
  const contexts: Record<ScoreType, ScoreContext | null> = {
    homeready: null,
    investoredge: null,
    markethealth: null,
  };

  if (scores.homeready) {
    contexts.homeready = generateScoreContext(
      scores.homeready.score,
      'homeready',
      geoData,
    );
  }

  if (scores.investoredge) {
    contexts.investoredge = generateScoreContext(
      scores.investoredge.score,
      'investoredge',
      geoData,
    );
  }

  if (scores.markethealth) {
    contexts.markethealth = generateScoreContext(
      scores.markethealth.score,
      'markethealth',
      geoData,
    );
  }

  return contexts;
}
