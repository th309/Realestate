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

// Score type — imported from the single source of truth in formula-weights.ts
import type { ScoreType, AnyScoreType } from '../scoring/formula-weights';
export type { ScoreType, AnyScoreType };

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
  scoreType: AnyScoreType,
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
  const dollar_impact = getDollarImpact(
    score,
    scoreType,
    geoData?.median_price,
  );

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
export function getScoreInterpretation(
  score: number,
  scoreType: AnyScoreType,
): string {
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
    propertyiq: {
      exceptional:
        'Exceptionally strong demand signal — top quintile markets historically return +3% above benchmark',
      excellent: 'Excellent demand signal with strong buyer competition',
      'very good': 'Very strong demand indicators across key metrics',
      good: 'Good demand signal suggesting above-average market activity',
      'above average': 'Above average demand — moderate buyer competition',
      moderate: 'Moderate demand signal — market performing near benchmark',
      'below average': 'Below average demand — softer buyer activity',
      poor: 'Weak demand signal — limited buyer competition',
      'very poor':
        'Very weak demand — bottom quintile markets historically underperform by -3%',
    },
  };

  const entry =
    interpretations[scoreType as ScoreType] ?? interpretations['propertyiq'];
  return entry[rangeLabel] || 'Score data available';
}

/**
 * Generate percentile comparison text
 */
export function getPercentileText(
  score: number,
  scoreType: AnyScoreType,
  geoData?: {
    geography_type?: 'metro' | 'county' | 'zip';
    percentile?: number;
    total_markets?: number;
  },
): string {
  // If we have actual percentile data, use it
  if (geoData?.percentile !== undefined) {
    const position = geoData.percentile;
    if (position <= 10)
      return `Top 10% of ${getGeoLabel(geoData.geography_type)}s`;
    if (position <= 25)
      return `Top 25% of ${getGeoLabel(geoData.geography_type)}s`;
    if (position <= 50)
      return `Top half of ${getGeoLabel(geoData.geography_type)}s`;
    if (position <= 75)
      return `Bottom half of ${getGeoLabel(geoData.geography_type)}s`;
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
    case 'metro':
      return 'metro area';
    case 'county':
      return 'county';
    case 'zip':
      return 'ZIP code';
    default:
      return 'market';
  }
}

/**
 * Generate practical dollar impact text based on score type
 */
export function getDollarImpact(
  score: number,
  scoreType: AnyScoreType,
  medianPrice?: number,
): string | undefined {
  // Don't generate dollar impact if no price data
  if (!medianPrice) return undefined;

  // Calculate appreciation/return estimates based on score
  // These are rough estimates based on historical data patterns
  switch (scoreType) {
    case 'propertyiq': {
      // PropertyIQ demand signal correlates with excess returns vs state benchmark
      // Top quintile (80+): +3% annualized excess return; bottom quintile (<20): -3%
      let excessReturn: number;
      if (score >= 80) {
        excessReturn = 1.17 + ((score - 80) / 19) * (3.05 - 1.17); // +1.17% to +3.05%
      } else if (score >= 60) {
        excessReturn = -0.15 + ((score - 60) / 20) * (1.17 - -0.15); // -0.15% to +1.17%
      } else if (score >= 40) {
        excessReturn = -1.2 + ((score - 40) / 20) * (-0.15 - -1.2); // -1.2% to -0.15%
      } else {
        excessReturn = -3.34 + ((score - 1) / 19) * (-1.2 - -3.34); // -3.34% to -1.2%
      }

      const threeYearGain =
        medianPrice * (Math.pow(1 + excessReturn / 100, 3) - 1);

      if (Math.abs(threeYearGain) > 1000) {
        const direction = threeYearGain > 0 ? 'above' : 'below';
        return `Markets with this score have historically returned ~${formatCurrency(Math.abs(Math.round(threeYearGain)))} ${direction} the state benchmark over 3 years (${excessReturn.toFixed(1)}% excess annually)`;
      }
      return `Market performing near state benchmark (${excessReturn.toFixed(1)}% excess return expected)`;
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
  geoData?: {
    geography_type?: 'metro' | 'county' | 'zip';
    total_markets?: number;
  },
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
    propertyiq?: { score: number; grade: string };
  },
  geoData?: {
    geography_type?: 'metro' | 'county' | 'zip';
    median_price?: number;
  },
): Record<ScoreType, ScoreContext | null> {
  const contexts: Record<ScoreType, ScoreContext | null> = {
    propertyiq: null,
  };

  if (scores.propertyiq) {
    contexts.propertyiq = generateScoreContext(
      scores.propertyiq.score,
      'propertyiq',
      geoData,
    );
  }

  return contexts;
}
