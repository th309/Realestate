'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Scale, AlertTriangle } from 'lucide-react';

import { SectionCard, MetricDisplay, TrendSparkline, AIAnalysisBlock } from '../core';
import type { MetricTrend, TrendDirection } from '../core';
import { getMetricWithAliases } from '../../utils/metricHelpers';
import type { ReportInstance } from '../../../../types';

/**
 * Props for MarketConditions section
 */
interface MarketConditionsProps {
  report: ReportInstance;
}

/**
 * Metric configuration for display and interpretation
 */
interface MetricConfig {
  id: string;
  aliases: string[];
  label: string;
  description: string;
  /** For buyers: is lower or higher better? */
  buyerPreference: 'lower' | 'higher' | 'neutral';
}

/**
 * Market condition metrics configuration
 */
const MARKET_METRICS: MetricConfig[] = [
  {
    id: 'days_on_market',
    aliases: ['median_dom', 'dom'],
    label: 'Days on Market',
    description: 'How fast homes sell',
    buyerPreference: 'higher', // More days = more time to decide
  },
  {
    id: 'active_listing_count',
    aliases: ['for_sale_inventory', 'inventory', 'listing_count'],
    label: 'Active Listings',
    description: 'Available inventory',
    buyerPreference: 'higher', // More inventory = more choices
  },
  {
    id: 'hotness_score',
    aliases: ['market_hotness', 'heat_index'],
    label: 'Market Hotness',
    description: 'Market competitiveness',
    buyerPreference: 'lower', // Lower = less competition
  },
  {
    id: 'price_cut_pct',
    aliases: ['price_reduced_share', 'price_reduction_pct'],
    label: 'Price Cuts',
    description: 'Negotiation leverage',
    buyerPreference: 'higher', // More cuts = more negotiation power
  },
];

/**
 * Get a metric value trying the primary ID and aliases
 */
function getMetricValueWithAliases(
  report: ReportInstance,
  metricConfig: MetricConfig
): number | null {
  // Try primary ID first
  const primaryValue = getMetricWithAliases(report, metricConfig.id);
  if (primaryValue !== null) return primaryValue;

  // Try aliases
  for (const alias of metricConfig.aliases) {
    const aliasValue = getMetricWithAliases(report, alias);
    if (aliasValue !== null) return aliasValue;
  }

  return null;
}

/**
 * Get historical trend data for a metric
 */
function getMetricTrend(
  report: ReportInstance,
  metricConfig: MetricConfig
): MetricTrend | undefined {
  const historical = report.populated_data?.historical;
  if (!historical) return undefined;

  // Try primary ID and aliases
  const idsToTry = [metricConfig.id, ...metricConfig.aliases];

  for (const id of idsToTry) {
    const histData = historical[id];
    if (histData && histData.data && histData.data.length >= 2) {
      return {
        direction: histData.trend as TrendDirection,
        changePct: histData.change_pct,
        sparklineData: histData.data.map((d) => d.value),
      };
    }
  }

  return undefined;
}

/**
 * Calculate buyer vs seller market indicator based on metrics
 */
function calculateMarketType(
  daysOnMarket: number | null,
  inventoryCount: number | null,
  hotnessScore: number | null,
  priceCutPct: number | null
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
    if (daysOnMarket >= 60) buyerScore += 2;
    else if (daysOnMarket >= 40) buyerScore += 1;
    else if (daysOnMarket <= 20) buyerScore -= 2;
    else if (daysOnMarket <= 30) buyerScore -= 1;
  }

  // Hotness score: lower favors buyers
  if (hotnessScore !== null) {
    factorsCount++;
    if (hotnessScore <= 30) buyerScore += 2;
    else if (hotnessScore <= 50) buyerScore += 1;
    else if (hotnessScore >= 80) buyerScore -= 2;
    else if (hotnessScore >= 65) buyerScore -= 1;
  }

  // Price cut percentage: higher favors buyers
  if (priceCutPct !== null) {
    factorsCount++;
    if (priceCutPct >= 30) buyerScore += 2;
    else if (priceCutPct >= 20) buyerScore += 1;
    else if (priceCutPct <= 5) buyerScore -= 2;
    else if (priceCutPct <= 10) buyerScore -= 1;
  }

  // Inventory: higher relative to historical favors buyers
  // (simplified - just check if any inventory data exists)
  if (inventoryCount !== null && inventoryCount > 0) {
    factorsCount++;
    // Without historical context, we use absolute thresholds
    // These would typically be adjusted per market size
  }

  if (factorsCount === 0) {
    return { type: 'balanced', strength: 'moderate', score: 0 };
  }

  const normalizedScore = buyerScore / factorsCount;

  let type: 'buyer' | 'seller' | 'balanced';
  let strength: 'strong' | 'moderate' | 'slight';

  if (normalizedScore >= 1.5) {
    type = 'buyer';
    strength = 'strong';
  } else if (normalizedScore >= 0.75) {
    type = 'buyer';
    strength = 'moderate';
  } else if (normalizedScore >= 0.25) {
    type = 'buyer';
    strength = 'slight';
  } else if (normalizedScore <= -1.5) {
    type = 'seller';
    strength = 'strong';
  } else if (normalizedScore <= -0.75) {
    type = 'seller';
    strength = 'moderate';
  } else if (normalizedScore <= -0.25) {
    type = 'seller';
    strength = 'slight';
  } else {
    type = 'balanced';
    strength = 'moderate';
  }

  return { type, strength, score: normalizedScore };
}

/**
 * MarketConditions - Shows current market conditions for homebuyers
 *
 * Displays key market metrics that help buyers understand:
 * - How fast homes are selling
 * - How much inventory is available
 * - How competitive the market is
 * - How much negotiation leverage they may have
 *
 * Includes a buyer vs seller market indicator and AI analysis.
 */
export function MarketConditions({ report }: MarketConditionsProps): React.ReactElement {
  // Extract metric values
  const daysOnMarket = getMetricValueWithAliases(report, MARKET_METRICS[0]);
  const activeListings = getMetricValueWithAliases(report, MARKET_METRICS[1]);
  const hotnessScore = getMetricValueWithAliases(report, MARKET_METRICS[2]);
  const priceCutPct = getMetricValueWithAliases(report, MARKET_METRICS[3]);

  // Check if we have any data
  const hasAnyData =
    daysOnMarket !== null ||
    activeListings !== null ||
    hotnessScore !== null ||
    priceCutPct !== null;

  // Calculate market type
  const marketType = calculateMarketType(daysOnMarket, activeListings, hotnessScore, priceCutPct);

  // Get AI analysis
  const aiAnalysis =
    report.ai_narrative?.trend_observations ||
    report.ai_narrative?.market_summary ||
    report.ai_narratives?.market_conditions ||
    report.ai_narratives?.trend_observations;

  // If no data available, show unavailable state
  if (!hasAnyData) {
    return (
      <SectionCard title="Market Conditions" icon={Scale}>
        <div
          className="flex items-center justify-center gap-3 py-8"
          style={{ color: 'var(--report-stone-light)' }}
        >
          <AlertTriangle className="w-5 h-5" />
          <span className="report-body">Market condition data is not available for this area.</span>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Market Conditions" icon={Scale}>
      {/* Market Type Indicator */}
      <div
        className="report-card-subtle"
        style={{
          padding: 'var(--report-space-lg)',
          marginBottom: 'var(--report-space-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--report-space-md)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--report-space-md)' }}>
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

          <div>
            <p
              className="report-label"
              style={{ marginBottom: 'var(--report-space-xs)' }}
            >
              Current Market
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

        <div
          style={{
            textAlign: 'right',
            maxWidth: '280px',
          }}
        >
          <p className="report-body-sm" style={{ margin: 0 }}>
            {marketType.type === 'buyer'
              ? 'Conditions favor buyers. You may have more negotiating power and time to make decisions.'
              : marketType.type === 'seller'
              ? 'Conditions favor sellers. Be prepared to act quickly and consider competitive offers.'
              : 'Market is relatively balanced between buyers and sellers.'}
          </p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--report-space-md)',
          marginBottom: 'var(--report-space-lg)',
        }}
      >
        {/* Days on Market */}
        <MetricDisplay
          metricId="days_on_market"
          value={daysOnMarket}
          label="Days on Market"
          trend={getMetricTrend(report, MARKET_METRICS[0])}
        />

        {/* Active Listings */}
        <MetricDisplay
          metricId="active_listing_count"
          value={activeListings}
          label="Active Listings"
          trend={getMetricTrend(report, MARKET_METRICS[1])}
        />

        {/* Market Hotness */}
        <MetricDisplay
          metricId="hotness_score"
          value={hotnessScore}
          label="Market Hotness"
          trend={getMetricTrend(report, MARKET_METRICS[2])}
        />

        {/* Price Cuts */}
        <MetricDisplay
          metricId="price_cut_pct"
          value={priceCutPct}
          label="Price Cuts"
          trend={getMetricTrend(report, MARKET_METRICS[3])}
        />
      </div>

      {/* Metric Explanations */}
      <div
        className="report-card-subtle"
        style={{
          padding: 'var(--report-space-md)',
          marginBottom: 'var(--report-space-lg)',
        }}
      >
        <p
          className="report-label"
          style={{ marginBottom: 'var(--report-space-sm)' }}
        >
          What These Metrics Mean for Buyers
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 'var(--report-space-sm)',
          }}
        >
          {MARKET_METRICS.map((metric) => {
            const value = getMetricValueWithAliases(report, metric);
            if (value === null) return null;

            const isFavorable =
              (metric.buyerPreference === 'higher' && value > 50) ||
              (metric.buyerPreference === 'lower' && value < 50);

            return (
              <div
                key={metric.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--report-space-sm)',
                }}
              >
                <div
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    marginTop: '6px',
                    flexShrink: 0,
                    backgroundColor:
                      metric.buyerPreference === 'neutral'
                        ? 'var(--report-stone-light)'
                        : isFavorable
                        ? 'var(--report-success)'
                        : 'var(--report-warning)',
                  }}
                />
                <p className="report-body-sm" style={{ margin: 0 }}>
                  <strong>{metric.label}:</strong> {metric.description}
                </p>
              </div>
            );
          })}
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

export default MarketConditions;
