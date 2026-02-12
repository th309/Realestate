'use client';

import React, { useMemo } from 'react';
import { Activity, TrendingUp, TrendingDown, Scale, AlertTriangle } from 'lucide-react';

import { SectionCard, MetricDisplay, AIAnalysisBlock } from '../core';
import {
  getMetricValueWithAliases,
  getMetricTrend,
} from '../../utils/metricHelpers';
import {
  DAYS_ON_MARKET,
  HOTNESS_SCORE,
  SALE_TO_LIST_RATIO,
  NORMALIZED_SCORE,
} from '../../utils/thresholds';
import type { ReportInstance } from '../../../../types';

/**
 * Props for MarketPulse section
 */
export interface MarketPulseProps {
  /** The full report data */
  report: ReportInstance;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Metric configuration for market pulse display
 */
interface MetricConfig {
  id: string;
  aliases: string[];
  label: string;
}

/**
 * Market pulse metrics configuration
 */
const PULSE_METRICS: MetricConfig[] = [
  {
    id: 'days_on_market',
    aliases: ['median_dom', 'dom', 'median_days_on_market'],
    label: 'Days on Market',
  },
  {
    id: 'active_listing_count',
    aliases: ['for_sale_inventory', 'inventory', 'listing_count', 'active_listings'],
    label: 'Active Listings',
  },
  {
    id: 'hotness_score',
    aliases: ['market_hotness', 'heat_index', 'market_heat'],
    label: 'Hotness Score',
  },
  {
    id: 'sale_to_list_ratio',
    aliases: ['sale_to_list', 'sp_to_lp', 'sale_price_to_list_price'],
    label: 'Sale-to-List Ratio',
  },
];

/**
 * Calculate market type (buyer vs seller) based on key metrics
 */
function calculateMarketType(
  daysOnMarket: number | null,
  hotnessScore: number | null,
  saleToListRatio: number | null
): {
  type: 'buyer' | 'seller' | 'balanced';
  strength: 'strong' | 'moderate' | 'slight';
  score: number;
} {
  let buyerScore = 0;
  let factorsCount = 0;

  // Days on market: higher favors buyers
  if (daysOnMarket !== null) {
    factorsCount++;
    if (daysOnMarket >= DAYS_ON_MARKET.BUYERS_MARKET) buyerScore += 2;
    else if (daysOnMarket >= DAYS_ON_MARKET.NEUTRAL) buyerScore += 1;
    else if (daysOnMarket <= DAYS_ON_MARKET.SELLERS_MARKET) buyerScore -= 2;
    else if (daysOnMarket <= DAYS_ON_MARKET.SLIGHT_SELLERS) buyerScore -= 1;
  }

  // Hotness score: lower favors buyers
  if (hotnessScore !== null) {
    factorsCount++;
    if (hotnessScore <= HOTNESS_SCORE.COOL) buyerScore += 2;
    else if (hotnessScore <= HOTNESS_SCORE.NEUTRAL) buyerScore += 1;
    else if (hotnessScore >= HOTNESS_SCORE.VERY_HOT) buyerScore -= 2;
    else if (hotnessScore >= HOTNESS_SCORE.WARM) buyerScore -= 1;
  }

  // Sale-to-list ratio: lower favors buyers (more negotiation room)
  if (saleToListRatio !== null) {
    factorsCount++;
    // Assuming ratio is expressed as decimal (0.98 = 98%)
    const ratioPercent = saleToListRatio > 2 ? saleToListRatio : saleToListRatio * 100;
    if (ratioPercent <= SALE_TO_LIST_RATIO.SIGNIFICANT_DISCOUNT) buyerScore += 2;
    else if (ratioPercent <= SALE_TO_LIST_RATIO.SLIGHT_DISCOUNT) buyerScore += 1;
    else if (ratioPercent >= SALE_TO_LIST_RATIO.ABOVE_LIST_STRONG) buyerScore -= 2;
    else if (ratioPercent >= SALE_TO_LIST_RATIO.AT_OR_ABOVE_LIST) buyerScore -= 1;
  }

  if (factorsCount === 0) {
    return { type: 'balanced', strength: 'moderate', score: 0 };
  }

  const normalizedScore = buyerScore / factorsCount;

  let type: 'buyer' | 'seller' | 'balanced';
  let strength: 'strong' | 'moderate' | 'slight';

  if (normalizedScore >= NORMALIZED_SCORE.STRONG) {
    type = 'buyer';
    strength = 'strong';
  } else if (normalizedScore >= NORMALIZED_SCORE.MODERATE) {
    type = 'buyer';
    strength = 'moderate';
  } else if (normalizedScore >= NORMALIZED_SCORE.SLIGHT) {
    type = 'buyer';
    strength = 'slight';
  } else if (normalizedScore <= -NORMALIZED_SCORE.STRONG) {
    type = 'seller';
    strength = 'strong';
  } else if (normalizedScore <= -NORMALIZED_SCORE.MODERATE) {
    type = 'seller';
    strength = 'moderate';
  } else if (normalizedScore <= -NORMALIZED_SCORE.SLIGHT) {
    type = 'seller';
    strength = 'slight';
  } else {
    type = 'balanced';
    strength = 'moderate';
  }

  return { type, strength, score: normalizedScore };
}

/**
 * Get market tempo description based on days on market and hotness
 */
function getMarketTempo(
  daysOnMarket: number | null,
  hotnessScore: number | null
): {
  tempo: 'fast' | 'moderate' | 'slow';
  label: string;
  description: string;
} {
  // Prioritize days on market for tempo assessment
  if (daysOnMarket !== null) {
    if (daysOnMarket <= DAYS_ON_MARKET.FAST_TEMPO) {
      return {
        tempo: 'fast',
        label: 'Fast-Moving Market',
        description: 'Homes are selling quickly. Buyers need to act fast.',
      };
    }
    if (daysOnMarket <= DAYS_ON_MARKET.MODERATE_TEMPO) {
      return {
        tempo: 'moderate',
        label: 'Moderate Pace',
        description: 'Average market velocity with reasonable decision time.',
      };
    }
    return {
      tempo: 'slow',
      label: 'Slower Market',
      description: 'Homes taking longer to sell. More room for negotiation.',
    };
  }

  // Fall back to hotness score
  if (hotnessScore !== null) {
    if (hotnessScore >= HOTNESS_SCORE.HOT) {
      return {
        tempo: 'fast',
        label: 'Hot Market',
        description: 'High demand and quick sales expected.',
      };
    }
    if (hotnessScore >= HOTNESS_SCORE.ACTIVE) {
      return {
        tempo: 'moderate',
        label: 'Active Market',
        description: 'Balanced activity with steady transactions.',
      };
    }
    return {
      tempo: 'slow',
      label: 'Cool Market',
      description: 'Lower activity levels and longer listing times.',
    };
  }

  return {
    tempo: 'moderate',
    label: 'Market Tempo Unknown',
    description: 'Insufficient data to assess market speed.',
  };
}

/**
 * MarketPulse - Quick market overview for agents
 *
 * Displays key market health indicators including:
 * - Days on market and active listings
 * - Market hotness score and sale-to-list ratio
 * - Buyer vs Seller market indicator
 * - Market tempo assessment
 *
 * Uses the editorial design system from report-theme.css.
 */
export function MarketPulse({
  report,
  className = '',
}: MarketPulseProps): React.ReactElement {
  // Extract metric values using shared helpers
  const daysOnMarket = getMetricValueWithAliases(
    report,
    PULSE_METRICS[0].id,
    PULSE_METRICS[0].aliases
  );
  const activeListings = getMetricValueWithAliases(
    report,
    PULSE_METRICS[1].id,
    PULSE_METRICS[1].aliases
  );
  const hotnessScore = getMetricValueWithAliases(
    report,
    PULSE_METRICS[2].id,
    PULSE_METRICS[2].aliases
  );
  const saleToListRatio = getMetricValueWithAliases(
    report,
    PULSE_METRICS[3].id,
    PULSE_METRICS[3].aliases
  );

  // Check if we have any data
  const hasAnyData =
    daysOnMarket !== null ||
    activeListings !== null ||
    hotnessScore !== null ||
    saleToListRatio !== null;

  // Calculate market type and tempo (memoized to avoid expensive recalculations)
  const marketType = useMemo(
    () => calculateMarketType(daysOnMarket, hotnessScore, saleToListRatio),
    [daysOnMarket, hotnessScore, saleToListRatio]
  );
  const marketTempo = useMemo(
    () => getMarketTempo(daysOnMarket, hotnessScore),
    [daysOnMarket, hotnessScore]
  );

  // Get AI analysis
  const aiAnalysis =
    report.ai_narrative?.market_summary ||
    report.ai_narrative?.trend_observations ||
    report.ai_narratives?.market_pulse ||
    report.ai_narratives?.market_conditions;

  // If no data available, show unavailable state
  if (!hasAnyData) {
    return (
      <SectionCard title="Market Pulse" icon={Activity} className={className}>
        <div
          className="flex items-center justify-center gap-3 py-8"
          style={{ color: 'var(--report-stone-light)' }}
        >
          <AlertTriangle className="w-5 h-5" />
          <span className="report-body">Market pulse data is not available for this area.</span>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Market Pulse" icon={Activity} className={className}>
      {/* Market Type and Tempo Indicators */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
        style={{ marginBottom: 'var(--report-space-lg)' }}
      >
        {/* Buyer vs Seller Market Indicator */}
        <div
          className="report-card-subtle"
          style={{
            padding: 'var(--report-space-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--report-space-md)',
          }}
        >
          {marketType.type === 'buyer' ? (
            <div
              style={{
                width: '3rem',
                height: '3rem',
                borderRadius: 'var(--report-radius-md)',
                backgroundColor: 'var(--report-success-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TrendingDown
                className="w-6 h-6"
                style={{ color: 'var(--report-success)' }}
                aria-hidden="true"
              />
            </div>
          ) : marketType.type === 'seller' ? (
            <div
              style={{
                width: '3rem',
                height: '3rem',
                borderRadius: 'var(--report-radius-md)',
                backgroundColor: 'var(--report-warning-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TrendingUp
                className="w-6 h-6"
                style={{ color: 'var(--report-warning)' }}
                aria-hidden="true"
              />
            </div>
          ) : (
            <div
              style={{
                width: '3rem',
                height: '3rem',
                borderRadius: 'var(--report-radius-md)',
                backgroundColor: 'var(--report-cream)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Scale
                className="w-6 h-6"
                style={{ color: 'var(--report-stone)' }}
                aria-hidden="true"
              />
            </div>
          )}

          <div style={{ flex: 1 }}>
            <p
              className="report-label"
              style={{ marginBottom: 'var(--report-space-xs)' }}
            >
              Market Conditions
            </p>
            <p
              className="report-heading-sm"
              style={{
                color:
                  marketType.type === 'buyer'
                    ? 'var(--report-success)'
                    : marketType.type === 'seller'
                    ? 'var(--report-warning)'
                    : 'var(--report-navy)',
                margin: 0,
              }}
            >
              {marketType.strength.charAt(0).toUpperCase() + marketType.strength.slice(1)}{' '}
              {marketType.type.charAt(0).toUpperCase() + marketType.type.slice(1)}
              {marketType.type !== 'balanced' ? "'s Market" : ' Market'}
            </p>
          </div>
        </div>

        {/* Market Tempo Indicator */}
        <div
          className="report-card-subtle"
          style={{
            padding: 'var(--report-space-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--report-space-md)',
          }}
        >
          <div
            style={{
              width: '3rem',
              height: '3rem',
              borderRadius: 'var(--report-radius-md)',
              backgroundColor:
                marketTempo.tempo === 'fast'
                  ? 'var(--report-warning-bg)'
                  : marketTempo.tempo === 'slow'
                  ? 'var(--report-success-bg)'
                  : 'var(--report-cream)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Activity
              className="w-6 h-6"
              style={{
                color:
                  marketTempo.tempo === 'fast'
                    ? 'var(--report-warning)'
                    : marketTempo.tempo === 'slow'
                    ? 'var(--report-success)'
                    : 'var(--report-stone)',
              }}
              aria-hidden="true"
            />
          </div>

          <div style={{ flex: 1 }}>
            <p
              className="report-label"
              style={{ marginBottom: 'var(--report-space-xs)' }}
            >
              Market Tempo
            </p>
            <p
              className="report-heading-sm"
              style={{
                color:
                  marketTempo.tempo === 'fast'
                    ? 'var(--report-warning)'
                    : marketTempo.tempo === 'slow'
                    ? 'var(--report-success)'
                    : 'var(--report-navy)',
                margin: 0,
              }}
            >
              {marketTempo.label}
            </p>
            <p
              className="report-body-sm"
              style={{ margin: 0, marginTop: 'var(--report-space-xs)' }}
            >
              {marketTempo.description}
            </p>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 'var(--report-space-md)',
          marginBottom: 'var(--report-space-lg)',
        }}
      >
        <MetricDisplay
          metricId="days_on_market"
          value={daysOnMarket}
          label="Days on Market"
          trend={getMetricTrend(report, PULSE_METRICS[0].id, PULSE_METRICS[0].aliases)}
        />

        <MetricDisplay
          metricId="active_listing_count"
          value={activeListings}
          label="Active Listings"
          trend={getMetricTrend(report, PULSE_METRICS[1].id, PULSE_METRICS[1].aliases)}
        />

        <MetricDisplay
          metricId="hotness_score"
          value={hotnessScore}
          label="Hotness Score"
          trend={getMetricTrend(report, PULSE_METRICS[2].id, PULSE_METRICS[2].aliases)}
        />

        <MetricDisplay
          metricId="sale_to_list_ratio"
          value={saleToListRatio}
          label="Sale-to-List Ratio"
          trend={getMetricTrend(report, PULSE_METRICS[3].id, PULSE_METRICS[3].aliases)}
        />
      </div>

      {/* Agent Tips */}
      <div
        className="report-card-subtle"
        style={{
          padding: 'var(--report-space-md)',
          marginBottom: aiAnalysis ? 'var(--report-space-lg)' : 0,
        }}
      >
        <p
          className="report-label"
          style={{ marginBottom: 'var(--report-space-sm)' }}
        >
          Agent Quick Tips
        </p>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--report-space-sm)',
          }}
        >
          {marketType.type === 'buyer' && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--report-space-sm)' }}>
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  marginTop: '6px',
                  flexShrink: 0,
                  backgroundColor: 'var(--report-success)',
                }}
              />
              <p className="report-body-sm" style={{ margin: 0 }}>
                <strong>For buyers:</strong> Emphasize negotiation opportunities and reduced competition.
              </p>
            </div>
          )}
          {marketType.type === 'seller' && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--report-space-sm)' }}>
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  marginTop: '6px',
                  flexShrink: 0,
                  backgroundColor: 'var(--report-warning)',
                }}
              />
              <p className="report-body-sm" style={{ margin: 0 }}>
                <strong>For sellers:</strong> Highlight strong demand and potential for multiple offers.
              </p>
            </div>
          )}
          {marketTempo.tempo === 'fast' && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--report-space-sm)' }}>
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  marginTop: '6px',
                  flexShrink: 0,
                  backgroundColor: 'var(--report-warning)',
                }}
              />
              <p className="report-body-sm" style={{ margin: 0 }}>
                Prepare clients for quick decision-making. Pre-approval is essential.
              </p>
            </div>
          )}
          {marketTempo.tempo === 'slow' && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--report-space-sm)' }}>
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  marginTop: '6px',
                  flexShrink: 0,
                  backgroundColor: 'var(--report-success)',
                }}
              />
              <p className="report-body-sm" style={{ margin: 0 }}>
                More time for due diligence and inspection negotiations.
              </p>
            </div>
          )}
          {saleToListRatio !== null && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--report-space-sm)' }}>
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  marginTop: '6px',
                  flexShrink: 0,
                  backgroundColor: 'var(--report-stone-light)',
                }}
              />
              <p className="report-body-sm" style={{ margin: 0 }}>
                {(() => {
                  const ratioPercent = saleToListRatio > 2 ? saleToListRatio : saleToListRatio * 100;
                  if (ratioPercent >= SALE_TO_LIST_RATIO.AT_OR_ABOVE_LIST) {
                    return 'Homes selling at or above list price. Price competitively for sellers.';
                  }
                  return `Average ${(100 - ratioPercent).toFixed(1)}% discount from list. Factor into pricing strategy.`;
                })()}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* AI Analysis */}
      {aiAnalysis && (
        <AIAnalysisBlock
          content={typeof aiAnalysis === 'string' ? aiAnalysis : String(aiAnalysis)}
          title="Market Analysis"
          variant="insight"
        />
      )}
    </SectionCard>
  );
}

export default MarketPulse;
