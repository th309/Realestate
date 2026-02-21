/**
 * Score Response DTOs
 *
 * Data Transfer Objects for PropertyIQ scoring API responses.
 * Supports multiple display modes:
 * - Badge: Minimal score display (score, trend, access)
 * - Card: Full component breakdown (for expanded view)
 * - Teaser: Blurred preview with upgrade CTA (for locked scores)
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  ScoreType,
  ScoreAccess,
  UserTier,
  GeographyType,
} from '../scoring.types';

// ============================================================================
// Metric and Component Details
// ============================================================================

export class MetricDetailDto {
  @ApiProperty({ description: 'Metric name' })
  name: string;

  @ApiProperty({ description: 'Raw metric value', nullable: true })
  value: number | null;

  @ApiProperty({ description: 'Normalized score (0-100)', nullable: true })
  normalizedScore: number | null;

  @ApiProperty({ description: 'Human-readable formatted value' })
  formatted: string;

  @ApiPropertyOptional({ description: 'Target/optimal value description' })
  target?: string;

  @ApiProperty({ description: 'Whether this metric was inherited from parent geography' })
  isInherited: boolean;

  @ApiPropertyOptional({ description: 'Source geography type if inherited' })
  sourceGeographyType?: string;

  @ApiPropertyOptional({ description: 'Source geography name if inherited' })
  sourceGeographyName?: string;

  @ApiProperty({ description: 'Metric description for display' })
  description: string;

  @ApiProperty({
    description: 'Impact on score',
    enum: ['positive', 'negative', 'neutral'],
  })
  impact: 'positive' | 'negative' | 'neutral';
}

export class ComponentDetailDto {
  @ApiProperty({ description: 'Component name' })
  name: string;

  @ApiProperty({ description: 'Human-readable component label' })
  label: string;

  @ApiProperty({ description: 'Component weight (0-1)' })
  weight: number;

  @ApiProperty({ description: 'Component score (0-100)' })
  score: number;

  @ApiProperty({ description: 'Weighted contribution to total score' })
  weightedContribution: number;

  @ApiProperty({ description: 'Component description' })
  description: string;

  @ApiProperty({ type: [MetricDetailDto], description: 'Metrics that make up this component' })
  metrics: MetricDetailDto[];

  @ApiProperty({ description: 'Factors helping this component score', type: [String] })
  helpingFactors: string[];

  @ApiProperty({ description: 'Factors hurting this component score', type: [String] })
  hurtingFactors: string[];
}

// ============================================================================
// Score History
// ============================================================================

export class ScoreHistoryPointDto {
  @ApiProperty({ description: 'Period date' })
  date: string;

  @ApiProperty({ description: 'Score value', nullable: true })
  score: number | null;
}

export class ScoreHistoryDto {
  @ApiProperty({ type: [ScoreHistoryPointDto], description: 'Historical score data' })
  data: ScoreHistoryPointDto[];

  @ApiProperty({ description: 'Number of months of history' })
  months: number;

  @ApiProperty({ description: 'Trend direction', enum: ['up', 'down', 'stable'] })
  trend: 'up' | 'down' | 'stable';

  @ApiProperty({ description: 'Change from first to last period' })
  change: number;
}

// ============================================================================
// Confidence Information
// ============================================================================

export class ConfidenceDto {
  @ApiProperty({ description: 'Confidence letter grade', enum: ['A', 'B', 'C', 'F'] })
  level: 'A' | 'B' | 'C' | 'F';

  @ApiProperty({ description: 'Confidence percentage (0-100)' })
  percentage: number;

  @ApiProperty({ description: 'Number of available metrics' })
  metricsAvailable: number;

  @ApiProperty({ description: 'Total number of metrics' })
  metricsTotal: number;

  @ApiProperty({ description: 'Data freshness in days' })
  freshnessInDays: number;

  @ApiPropertyOptional({ description: 'Warning message if confidence is low' })
  warning?: string;
}

// ============================================================================
// Score Badge Response (Minimal Display)
// ============================================================================

export class ScoreBadgeResponseDto {
  @ApiProperty({ description: 'Score type', enum: ['markethealth', 'homeready', 'investoredge'] })
  type: ScoreType;

  @ApiProperty({ description: 'Score label for display' })
  label: string;

  @ApiProperty({ description: 'Score value (0-100)', nullable: true })
  score: number | null;

  @ApiProperty({ description: 'Score trend', enum: ['up', 'down', 'stable'] })
  trend: 'up' | 'down' | 'stable';

  @ApiProperty({ description: 'Trend change amount' })
  trendChange: number;

  @ApiProperty({ description: 'Access level for this user', enum: ['full', 'teaser'] })
  access: ScoreAccess;

  @ApiProperty({ description: 'Score status', enum: ['complete', 'partial', 'unavailable'] })
  status: 'complete' | 'partial' | 'unavailable';

  @ApiPropertyOptional({ description: 'Status message' })
  statusMessage?: string;

  @ApiProperty({ description: 'Period date for this score' })
  periodDate: string;
}

// ============================================================================
// Score Card Response (Full Detail)
// ============================================================================

export class ScoreCardResponseDto extends ScoreBadgeResponseDto {
  @ApiProperty({ type: [ComponentDetailDto], description: 'Component breakdown' })
  components: ComponentDetailDto[];

  @ApiProperty({ type: ConfidenceDto, description: 'Score confidence information' })
  confidence: ConfidenceDto;

  @ApiPropertyOptional({ type: ScoreHistoryDto, description: 'Historical score data' })
  history?: ScoreHistoryDto;

  @ApiProperty({ description: 'Data completeness percentage (0-100)' })
  dataCompleteness: number;

  @ApiProperty({ description: 'Number of inherited metrics' })
  inheritedMetricsCount: number;

  @ApiPropertyOptional({ description: 'Inherited metrics details' })
  inheritedMetrics?: Record<string, string>;
}

// ============================================================================
// Score Teaser Response (Locked/Upgrade CTA)
// ============================================================================

export class LockedComponentDto {
  @ApiProperty({ description: 'Component name' })
  name: string;

  @ApiProperty({ description: 'Component label' })
  label: string;

  @ApiProperty({ description: 'Component weight' })
  weight: number;

  @ApiProperty({ description: 'Blurred score indicator (e.g., "??")' })
  blurredScore: string;
}

export class UpgradeCtaDto {
  @ApiProperty({ description: 'CTA headline' })
  headline: string;

  @ApiProperty({ description: 'CTA description' })
  description: string;

  @ApiProperty({ description: 'CTA button text' })
  buttonText: string;

  @ApiProperty({ description: 'Upgrade URL' })
  upgradeUrl: string;

  @ApiProperty({ description: 'Required tier for full access', enum: ['pro', 'enterprise'] })
  requiredTier: UserTier;

  @ApiProperty({ description: 'Feature highlights', type: [String] })
  features: string[];
}

export class ScoreTeaserResponseDto extends ScoreBadgeResponseDto {
  @ApiProperty({ type: [LockedComponentDto], description: 'Locked component previews' })
  lockedComponents: LockedComponentDto[];

  @ApiProperty({ type: UpgradeCtaDto, description: 'Upgrade call to action' })
  upgradeCta: UpgradeCtaDto;

  @ApiPropertyOptional({ description: 'Teaser description' })
  teaserDescription?: string;
}

// ============================================================================
// Combined Score Response (All Three Scores)
// ============================================================================

export class AllScoresResponseDto {
  @ApiProperty({ description: 'Geography ID' })
  geographyId: string;

  @ApiProperty({ description: 'Geography type', enum: ['national', 'state', 'metro', 'county', 'city', 'zip'] })
  geographyType: GeographyType;

  @ApiProperty({ description: 'Geography name' })
  geographyName: string;

  @ApiPropertyOptional({ description: 'State code' })
  stateCode?: string;

  @ApiProperty({ description: 'Period date' })
  periodDate: string;

  @ApiProperty({ description: 'User tier', enum: ['free', 'basic', 'pro', 'enterprise'] })
  userTier: UserTier;

  @ApiProperty({ type: ScoreBadgeResponseDto, description: 'Market Health score (always full access)' })
  marketHealth: ScoreBadgeResponseDto | ScoreCardResponseDto;

  @ApiProperty({ description: 'HomeReady score (full or teaser based on tier)' })
  homeready: ScoreBadgeResponseDto | ScoreCardResponseDto | ScoreTeaserResponseDto;

  @ApiProperty({ description: 'InvestorEdge score (full or teaser based on tier)' })
  investoredge: ScoreBadgeResponseDto | ScoreCardResponseDto | ScoreTeaserResponseDto;

  @ApiProperty({ description: 'Timestamp when scores were calculated' })
  calculatedAt: string;

  @ApiProperty({ description: 'Scoring formula version' })
  calculationVersion: string;
}

// ============================================================================
// Request DTOs
// ============================================================================

export class GetScoreQueryDto {
  @ApiPropertyOptional({ description: 'Score type filter', enum: ['markethealth', 'homeready', 'investoredge'] })
  type?: ScoreType;

  @ApiPropertyOptional({ description: 'Include expanded component details', default: false })
  expanded?: boolean;

  @ApiPropertyOptional({ description: 'Number of months of history to include', default: 0 })
  historyMonths?: number;

  @ApiPropertyOptional({ description: 'Period date (defaults to latest)' })
  periodDate?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

export function getScoreLabel(type: ScoreType): string {
  switch (type) {
    case 'markethealth':
      return 'Market Health Index';
    case 'homeready':
      return 'HomeReady Score';
    case 'investoredge':
      return 'InvestorEdge Score';
    default:
      return 'Score';
  }
}

export function getComponentLabel(component: string): string {
  const labels: Record<string, string> = {
    // Market Health
    demand_strength: 'Demand Strength',
    supply_balance: 'Supply Balance',
    price_stability: 'Price Stability',
    economic_foundation: 'Economic Foundation',
    // HomeReady
    affordability: 'Affordability',
    market_timing: 'Market Timing',
    stability: 'Stability',
    growth_potential: 'Growth Potential',
    livability: 'Livability',
    // InvestorEdge
    cash_flow: 'Cash Flow',
    rent_demand: 'Rent Demand',
    appreciation: 'Appreciation',
    entry_point: 'Entry Point',
    risk: 'Risk Assessment',
  };

  return labels[component] || component;
}

export function getComponentDescription(component: string): string {
  const descriptions: Record<string, string> = {
    // Market Health
    demand_strength: 'How strong is buyer demand in this market?',
    supply_balance: 'Is the housing supply balanced with demand?',
    price_stability: 'Are prices stable or volatile?',
    economic_foundation: 'How strong is the local economy?',
    // HomeReady
    affordability: 'Can you afford to live here?',
    market_timing: 'Is it a good time to buy?',
    stability: 'Is this market stable and predictable?',
    growth_potential: 'Will property values grow?',
    livability: 'Is this a good place to live?',
    // InvestorEdge
    cash_flow: 'Can you generate positive cash flow?',
    rent_demand: 'Is there strong rental demand?',
    appreciation: 'Will property values appreciate?',
    entry_point: 'Is this a good entry price?',
    risk: 'What are the investment risks?',
  };

  return descriptions[component] || '';
}

export function formatMetricValue(
  metricName: string,
  value: number | null,
): string {
  if (value === null) return 'N/A';

  const formatters: Record<string, (v: number) => string> = {
    // Percentages
    unemployment_rate: (v) => `${v.toFixed(1)}%`,
    employment_yoy: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
    zhvi_yoy: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
    zori_yoy: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
    price_reduced_share: (v) => `${v.toFixed(1)}%`,
    population_yoy: (v) => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`,

    // Currency
    zhvi: (v) => `$${(v / 1000).toFixed(0)}K`,
    zori: (v) => `$${v.toFixed(0)}/mo`,

    // Days
    median_days_on_market: (v) => `${v.toFixed(0)} days`,

    // Ratios
    sale_to_list_ratio: (v) => `${(v * 100).toFixed(1)}%`,
    pending_ratio: (v) => v.toFixed(2),
    months_of_supply: (v) => `${v.toFixed(1)} mo`,
    grm: (v) => v.toFixed(1),
    cap_rate: (v) => `${v.toFixed(2)}%`,
    gross_yield: (v) => `${v.toFixed(2)}%`,

    // Scores
    hotness_score: (v) => v.toFixed(0),
  };

  const formatter = formatters[metricName];
  if (formatter) {
    return formatter(value);
  }

  // Default formatting based on value magnitude
  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  if (Math.abs(value) < 1) {
    return value.toFixed(2);
  }
  return value.toFixed(1);
}

export function createUpgradeCta(scoreType: ScoreType): UpgradeCtaDto {
  const headlines: Record<ScoreType, string> = {
    markethealth: 'Unlock Full Market Health Details',
    homeready: 'Unlock HomeReady Score',
    investoredge: 'Unlock InvestorEdge Score',
  };

  const descriptions: Record<ScoreType, string> = {
    markethealth: 'Get detailed market health breakdown and historical trends.',
    homeready:
      'Discover if this market is right for homebuyers with our proprietary HomeReady scoring.',
    investoredge:
      'Analyze investment potential with cash flow, appreciation, and risk metrics.',
  };

  const features: Record<ScoreType, string[]> = {
    markethealth: [
      'Component breakdown',
      '12-month history',
      'Metric-level details',
    ],
    homeready: [
      'Affordability analysis',
      'Market timing insights',
      'Growth potential forecast',
      'Stability metrics',
      'Livability scores',
    ],
    investoredge: [
      'Cash flow analysis',
      'Cap rate estimates',
      'Rent demand metrics',
      'Appreciation forecast',
      'Risk assessment',
    ],
  };

  return {
    headline: headlines[scoreType],
    description: descriptions[scoreType],
    buttonText: 'Upgrade to Pro',
    upgradeUrl: '/pricing?utm_source=score_teaser&utm_medium=cta',
    requiredTier: 'pro',
    features: features[scoreType],
  };
}
