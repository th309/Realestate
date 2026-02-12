'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Scale, AlertTriangle, Activity, Newspaper, ExternalLink } from 'lucide-react';

import { formatMetricValue } from '@/lib/data';
import { SectionCard, MetricDisplay, TrendSparkline, AIAnalysisBlock } from '../core';
import type { MetricTrend, TrendDirection } from '../core';
import { getMetricWithGeoFallback } from '../../utils/metricHelpers';
import {
  DAYS_ON_MARKET,
  HOTNESS_SCORE,
  PRICE_CUT_PCT,
  NORMALIZED_SCORE,
} from '../../utils/thresholds';
import type { ReportInstance } from '../../../../types';

export interface MarketConditionsProps {
  report: ReportInstance;
}

/**
 * Metric configuration for market conditions display
 */
interface MetricConfig {
  id: string;
  label: string;
  description: string;
  buyerPreference: 'lower' | 'higher' | 'neutral';
}

/**
 * Pool of homebuyer-relevant market metrics using registry IDs
 * Priority order - pick first 6 with data
 */
const MARKET_METRICS_POOL: MetricConfig[] = [
  { id: 'days_on_market', label: 'Days on Market', description: 'How fast homes sell', buyerPreference: 'higher' },
  { id: 'hotness_score', label: 'Market Hotness', description: 'Market competitiveness', buyerPreference: 'lower' },
  { id: 'for_sale_inventory', label: 'Active Listings', description: 'Available inventory', buyerPreference: 'higher' },
  { id: 'price_cut_pct', label: 'Price Cuts', description: 'Listings with reductions', buyerPreference: 'higher' },
  { id: 'new_listings', label: 'New Listings', description: 'Fresh homes on market', buyerPreference: 'higher' },
  { id: 'inventory_yoy', label: 'Inventory YoY', description: 'Year-over-year change', buyerPreference: 'higher' },
  { id: 'home_value_yoy', label: 'Price YoY', description: 'Annual price trend', buyerPreference: 'lower' },
  { id: 'sale_to_list', label: 'Sale-to-List', description: 'Negotiation room', buyerPreference: 'lower' },
  { id: 'pending_ratio', label: 'Pending Ratio', description: 'Contract activity', buyerPreference: 'lower' },
  { id: 'months_of_supply', label: 'Months Supply', description: 'Market balance', buyerPreference: 'higher' },
  { id: 'home_price_forecast', label: 'Price Forecast', description: '12-month outlook', buyerPreference: 'lower' },
  { id: 'median_income', label: 'Median Income', description: 'Local earning power', buyerPreference: 'higher' },
];

/**
 * Get metric value - checks current data then historical
 */
function getMetricValue(
  report: ReportInstance,
  metricId: string
): { value: number | null; sourceLabel: string | null } {
  // Try current data first
  const currentValue = report.populated_data?.current?.[metricId];
  if (currentValue !== undefined && currentValue !== null) {
    return { value: Number(currentValue), sourceLabel: null };
  }

  // Try historical data
  const histData = report.populated_data?.historical?.[metricId];
  if (histData && histData.data && histData.data.length > 0) {
    return { value: histData.data[histData.data.length - 1].value, sourceLabel: null };
  }

  return { value: null, sourceLabel: null };
}

/**
 * Get historical trend for a metric
 */
function getMetricTrend(
  report: ReportInstance,
  metricConfig: MetricConfig
): MetricTrend | undefined {
  const historical = report.populated_data?.historical;
  if (!historical) return undefined;

  const histData = historical[metricConfig.id];
  if (histData && histData.data && histData.data.length >= 2) {
    return {
      direction: histData.trend as TrendDirection,
      changePct: histData.change_pct,
      sparklineData: histData.data.map((d) => d.value),
    };
  }

  return undefined;
}

/**
 * Calculate buyer vs seller market indicator
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

  if (daysOnMarket !== null) {
    factorsCount++;
    if (daysOnMarket >= DAYS_ON_MARKET.BUYERS_MARKET) buyerScore += 2;
    else if (daysOnMarket >= DAYS_ON_MARKET.NEUTRAL) buyerScore += 1;
    else if (daysOnMarket <= DAYS_ON_MARKET.SELLERS_MARKET) buyerScore -= 2;
    else if (daysOnMarket <= DAYS_ON_MARKET.SLIGHT_SELLERS) buyerScore -= 1;
  }

  if (hotnessScore !== null) {
    factorsCount++;
    if (hotnessScore <= HOTNESS_SCORE.COOL) buyerScore += 2;
    else if (hotnessScore <= HOTNESS_SCORE.NEUTRAL) buyerScore += 1;
    else if (hotnessScore >= HOTNESS_SCORE.VERY_HOT) buyerScore -= 2;
    else if (hotnessScore >= HOTNESS_SCORE.WARM) buyerScore -= 1;
  }

  if (priceCutPct !== null) {
    factorsCount++;
    if (priceCutPct >= PRICE_CUT_PCT.STRONG_BUYER_LEVERAGE) buyerScore += 2;
    else if (priceCutPct >= PRICE_CUT_PCT.MODERATE_BUYER_LEVERAGE) buyerScore += 1;
    else if (priceCutPct <= PRICE_CUT_PCT.VERY_COMPETITIVE) buyerScore -= 2;
    else if (priceCutPct <= PRICE_CUT_PCT.LIMITED_LEVERAGE) buyerScore -= 1;
  }

  if (inventoryCount !== null && inventoryCount > 0) {
    factorsCount++;
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
 * MarketConditions - Comprehensive market conditions with 6 metrics and AI analysis
 */
export function MarketConditions({ report }: MarketConditionsProps): React.ReactElement {
  // Check all metrics in the pool and pick the first 6 that have data
  const allMetricsWithData = MARKET_METRICS_POOL.map((config) => {
    const { value, sourceLabel } = getMetricValue(report, config.id);
    const trend = getMetricTrend(report, config);
    return {
      ...config,
      value,
      sourceLabel,
      trend,
    };
  });

  // Filter to metrics with data, take first 6
  const metricsWithData = allMetricsWithData.filter((m) => m.value !== null).slice(0, 6);
  const hasAnyData = metricsWithData.length > 0;

  // Get specific values for market type calculation
  const daysOnMarket = getMetricValue(report, 'days_on_market').value;
  const activeListings = getMetricValue(report, 'for_sale_inventory').value;
  const hotnessScore = getMetricValue(report, 'hotness_score').value;
  const priceCutPct = getMetricValue(report, 'price_cut_pct').value;

  const marketType = calculateMarketType(daysOnMarket, activeListings, hotnessScore, priceCutPct);

  // Get AI analysis - use economic_outlook specifically (NOT market_story which is used in Executive Summary)
  const aiAnalysis =
    report.ai_narrative?.economic_outlook ||
    report.ai_narrative?.trend_observations ||
    report.ai_narratives?.market_conditions ||
    report.ai_narratives?.economic_outlook;

  // Get historical trends for sparkline display
  const domHistorical = report.populated_data?.historical?.days_on_market;
  const hotnessHistorical = report.populated_data?.historical?.hotness_score;

  // Get economic indicators with geo fallback (important for homebuyers)
  // Using registry IDs directly - no aliases needed
  const unemploymentResult = getMetricWithGeoFallback(report as any, 'unemployment_rate');
  const jobGrowthResult = getMetricWithGeoFallback(report as any, 'job_growth_yoy');
  const incomeResult = getMetricWithGeoFallback(report as any, 'median_income');
  const incomeGrowthResult = getMetricWithGeoFallback(report as any, 'income_growth_yoy');

  const hasEconomicData = unemploymentResult.value !== null ||
    jobGrowthResult.value !== null ||
    incomeResult.value !== null;

  // Get market news from realtime or populated data
  const newsItems = report.populated_data?.realtime?.news ?? report.populated_data?.news ?? [];
  const marketSentiment = report.populated_data?.realtime?.sentiment;
  const hasNews = newsItems.length > 0;

  if (!hasAnyData) {
    return (
      <SectionCard title="Market Conditions" icon={Scale}>
        <div className="flex items-center justify-center gap-3 py-8" style={{ color: 'var(--report-stone-light)' }}>
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
        className="rounded-xl p-5 mb-6"
        style={{ backgroundColor: 'var(--report-cream)' }}
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            {marketType.type === 'buyer' ? (
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'var(--report-success-bg)' }}
              >
                <TrendingDown className="w-6 h-6" style={{ color: 'var(--report-success)' }} />
              </div>
            ) : marketType.type === 'seller' ? (
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'var(--report-warning-bg)' }}
              >
                <TrendingUp className="w-6 h-6" style={{ color: 'var(--report-warning)' }} />
              </div>
            ) : (
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'var(--report-cream-dark)' }}
              >
                <Scale className="w-6 h-6" style={{ color: 'var(--report-stone)' }} />
              </div>
            )}

            <div>
              <p className="report-label mb-1">Current Market</p>
              <p
                className="text-xl font-semibold"
                style={{
                  color:
                    marketType.type === 'buyer'
                      ? 'var(--report-success)'
                      : marketType.type === 'seller'
                      ? 'var(--report-warning)'
                      : 'var(--report-navy)',
                }}
              >
                {marketType.strength.charAt(0).toUpperCase() + marketType.strength.slice(1)}{' '}
                {marketType.type.charAt(0).toUpperCase() + marketType.type.slice(1)}
                {marketType.type !== 'balanced' ? "'s Market" : ' Market'}
              </p>
            </div>
          </div>

          <p className="report-body-sm max-w-xs text-right">
            {marketType.type === 'buyer'
              ? 'Conditions favor buyers. You may have more negotiating power and time to make decisions.'
              : marketType.type === 'seller'
              ? 'Conditions favor sellers. Be prepared to act quickly and consider competitive offers.'
              : 'Market is relatively balanced between buyers and sellers.'}
          </p>
        </div>
      </div>

      {/* 6 Metric Cards Grid */}
      <div className="mb-6">
        <h4 className="report-label mb-4">Market Indicators</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {metricsWithData.map((metric) => (
            <div
              key={metric.id}
              className="rounded-lg p-3"
              style={{ backgroundColor: 'var(--report-cream)' }}
            >
              <MetricDisplay
                metricId={metric.id}
                value={metric.value}
                label={metric.label}
                trend={metric.trend}
                compact
              />
              {metric.sourceLabel && (
                <p
                  className="text-xs mt-1 px-1.5 py-0.5 rounded inline-block"
                  style={{
                    backgroundColor: 'var(--report-warning-bg)',
                    color: 'var(--report-warning)',
                  }}
                >
                  {metric.sourceLabel}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Historical Trends */}
      {(domHistorical || hotnessHistorical) && (
        <div className="mb-6">
          <h4 className="report-label mb-4">
            <Activity className="w-4 h-4 inline-block mr-2" style={{ color: 'var(--report-gold)' }} />
            6-Month Market Trends
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {domHistorical && domHistorical.data && domHistorical.data.length >= 2 && (
              <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--report-cream)' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium" style={{ color: 'var(--report-navy)' }}>
                    Days on Market
                  </p>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      domHistorical.trend === 'up'
                        ? 'bg-[var(--report-success-bg)] text-[var(--report-success)]'
                        : domHistorical.trend === 'down'
                        ? 'bg-[var(--report-warning-bg)] text-[var(--report-warning)]'
                        : 'bg-[var(--report-cream-dark)] text-[var(--report-stone)]'
                    }`}
                  >
                    {domHistorical.change_pct >= 0 ? '+' : ''}{domHistorical.change_pct.toFixed(0)}%
                  </span>
                </div>
                <TrendSparkline
                  data={domHistorical.data.map((d) => d.value)}
                  trend={domHistorical.trend}
                  changePct={domHistorical.change_pct}
                  width={180}
                  height={36}
                />
                <p className="text-xs mt-2" style={{ color: 'var(--report-stone-light)' }}>
                  {domHistorical.trend === 'up'
                    ? 'Homes staying on market longer — good for buyers'
                    : domHistorical.trend === 'down'
                    ? 'Homes selling faster — more competitive'
                    : 'Market pace holding steady'}
                </p>
              </div>
            )}

            {hotnessHistorical && hotnessHistorical.data && hotnessHistorical.data.length >= 2 && (
              <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--report-cream)' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium" style={{ color: 'var(--report-navy)' }}>
                    Market Hotness
                  </p>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      hotnessHistorical.trend === 'up'
                        ? 'bg-[var(--report-warning-bg)] text-[var(--report-warning)]'
                        : hotnessHistorical.trend === 'down'
                        ? 'bg-[var(--report-success-bg)] text-[var(--report-success)]'
                        : 'bg-[var(--report-cream-dark)] text-[var(--report-stone)]'
                    }`}
                  >
                    {hotnessHistorical.change_pct >= 0 ? '+' : ''}{hotnessHistorical.change_pct.toFixed(0)}%
                  </span>
                </div>
                <TrendSparkline
                  data={hotnessHistorical.data.map((d) => d.value)}
                  trend={hotnessHistorical.trend}
                  changePct={hotnessHistorical.change_pct}
                  width={180}
                  height={36}
                />
                <p className="text-xs mt-2" style={{ color: 'var(--report-stone-light)' }}>
                  {hotnessHistorical.trend === 'up'
                    ? 'Market heating up — increasing competition'
                    : hotnessHistorical.trend === 'down'
                    ? 'Market cooling — more opportunity for buyers'
                    : 'Competition level stable'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Economic & Employment Indicators with Geo Fallback */}
      {hasEconomicData && (
        <div className="mb-6">
          <h4 className="report-label mb-4">Economic & Employment Indicators</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {unemploymentResult.value !== null && (
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--report-cream)' }}>
                <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--report-stone-light)' }}>
                  Unemployment
                </p>
                <p className="text-lg font-semibold" style={{ color: 'var(--report-navy)' }}>
                  {formatMetricValue(unemploymentResult.value, 'percent_abs')}
                </p>
                {unemploymentResult.sourceLabel && (
                  <p className="text-xs px-1.5 py-0.5 rounded inline-block mt-1" style={{ backgroundColor: 'var(--report-warning-bg)', color: 'var(--report-warning)' }}>
                    {unemploymentResult.sourceLabel}
                  </p>
                )}
              </div>
            )}

            {jobGrowthResult.value !== null && (
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--report-cream)' }}>
                <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--report-stone-light)' }}>
                  Job Growth
                </p>
                <p className="text-lg font-semibold" style={{ color: jobGrowthResult.value >= 0 ? 'var(--report-success)' : 'var(--report-error)' }}>
                  {formatMetricValue(jobGrowthResult.value, 'percent')}
                </p>
                {jobGrowthResult.sourceLabel && (
                  <p className="text-xs px-1.5 py-0.5 rounded inline-block mt-1" style={{ backgroundColor: 'var(--report-warning-bg)', color: 'var(--report-warning)' }}>
                    {jobGrowthResult.sourceLabel}
                  </p>
                )}
              </div>
            )}

            {incomeResult.value !== null && (
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--report-cream)' }}>
                <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--report-stone-light)' }}>
                  Median Income
                </p>
                <p className="text-lg font-semibold" style={{ color: 'var(--report-navy)' }}>
                  {formatMetricValue(incomeResult.value, 'currency')}
                </p>
                {incomeResult.sourceLabel && (
                  <p className="text-xs px-1.5 py-0.5 rounded inline-block mt-1" style={{ backgroundColor: 'var(--report-warning-bg)', color: 'var(--report-warning)' }}>
                    {incomeResult.sourceLabel}
                  </p>
                )}
              </div>
            )}

            {incomeGrowthResult.value !== null && (
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--report-cream)' }}>
                <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--report-stone-light)' }}>
                  Income Growth
                </p>
                <p className="text-lg font-semibold" style={{ color: incomeGrowthResult.value >= 0 ? 'var(--report-success)' : 'var(--report-error)' }}>
                  {formatMetricValue(incomeGrowthResult.value, 'percent')}
                </p>
                {incomeGrowthResult.sourceLabel && (
                  <p className="text-xs px-1.5 py-0.5 rounded inline-block mt-1" style={{ backgroundColor: 'var(--report-warning-bg)', color: 'var(--report-warning)' }}>
                    {incomeGrowthResult.sourceLabel}
                  </p>
                )}
              </div>
            )}
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--report-stone-light)' }}>
            Economic stability affects home values and your ability to afford a home over time.
          </p>
        </div>
      )}

      {/* Market News & Events */}
      {hasNews && (
        <div className="mb-6">
          <h4 className="report-label mb-4">
            <Newspaper className="w-4 h-4 inline-block mr-2" style={{ color: 'var(--report-gold)' }} />
            Recent Market News
          </h4>

          {/* Market Sentiment if available */}
          {marketSentiment && (
            <div
              className="rounded-lg p-4 mb-4 border-l-4"
              style={{
                backgroundColor: 'var(--report-cream)',
                borderLeftColor: marketSentiment.sentiment === 'bullish'
                  ? 'var(--report-success)'
                  : marketSentiment.sentiment === 'bearish'
                  ? 'var(--report-error)'
                  : 'var(--report-gold)',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                {marketSentiment.sentiment === 'bullish' && (
                  <TrendingUp className="w-4 h-4" style={{ color: 'var(--report-success)' }} />
                )}
                {marketSentiment.sentiment === 'bearish' && (
                  <TrendingDown className="w-4 h-4" style={{ color: 'var(--report-error)' }} />
                )}
                {marketSentiment.sentiment === 'neutral' && (
                  <Scale className="w-4 h-4" style={{ color: 'var(--report-gold)' }} />
                )}
                <span
                  className="text-sm font-semibold capitalize"
                  style={{
                    color: marketSentiment.sentiment === 'bullish'
                      ? 'var(--report-success)'
                      : marketSentiment.sentiment === 'bearish'
                      ? 'var(--report-error)'
                      : 'var(--report-navy)',
                  }}
                >
                  {marketSentiment.sentiment} Market Sentiment
                </span>
                <span className="text-xs" style={{ color: 'var(--report-stone-light)' }}>
                  ({Math.round(marketSentiment.confidence * 100)}% confidence)
                </span>
              </div>
              <p className="report-body-sm">{marketSentiment.summary}</p>
              {marketSentiment.factors && marketSentiment.factors.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {marketSentiment.factors.slice(0, 4).map((factor, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: 'var(--report-cream-dark)',
                        color: 'var(--report-stone)',
                      }}
                    >
                      {factor}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* News Items */}
          <div className="space-y-3">
            {newsItems.slice(0, 4).map((news, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg"
                style={{ backgroundColor: 'var(--report-cream)' }}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: 'var(--report-cream-dark)',
                      color: 'var(--report-stone)',
                    }}
                  >
                    {news.category?.replace('_', ' ') || 'News'}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--report-stone-light)' }}>
                    {news.published_at ? new Date(news.published_at).toLocaleDateString() : ''}
                  </span>
                </div>
                <a
                  href={news.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-sm hover:underline flex items-center gap-1"
                  style={{ color: 'var(--report-navy)' }}
                >
                  {news.headline}
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
                {news.summary && (
                  <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--report-stone)' }}>
                    {news.summary}
                  </p>
                )}
                <p className="text-xs mt-1" style={{ color: 'var(--report-stone-light)' }}>
                  {news.source}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--report-stone-light)' }}>
            News reflects recent market developments that may influence your buying decision.
          </p>
        </div>
      )}

      {/* What These Metrics Mean */}
      <div
        className="rounded-lg p-4 mb-6"
        style={{ backgroundColor: 'var(--report-cream)' }}
      >
        <p className="report-label mb-3">What These Metrics Mean for Buyers</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {metricsWithData.map((metric) => (
            <div key={metric.id} className="flex items-start gap-2">
              <div
                className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                style={{
                  backgroundColor:
                    metric.buyerPreference === 'neutral'
                      ? 'var(--report-stone-light)'
                      : metric.value !== null && (
                          (metric.buyerPreference === 'higher' && metric.value > 50) ||
                          (metric.buyerPreference === 'lower' && metric.value < 50)
                        )
                      ? 'var(--report-success)'
                      : 'var(--report-warning)',
                }}
              />
              <p className="report-body-sm">
                <strong>{metric.label}:</strong> {metric.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* AI Economic Outlook - different from Market Overview in Executive Summary */}
      {aiAnalysis && (
        <AIAnalysisBlock
          content={typeof aiAnalysis === 'string' ? aiAnalysis : String(aiAnalysis)}
          title="Economic & Employment Outlook"
          variant="insight"
        />
      )}

      {/* Data-driven assessment when no AI narrative */}
      {hasAnyData && (
        <div
          className="p-5 rounded-lg border-l-4"
          style={{
            backgroundColor: 'var(--report-cream)',
            borderLeftColor: 'var(--report-gold)',
          }}
        >
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--report-navy)' }}>
            Buyer Strategy Based on Current Conditions
          </p>
          <div className="space-y-3">
            {/* Timing recommendation */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--report-stone-light)' }}>
                Timing
              </p>
              <p className="report-body-sm">
                {marketType.type === 'buyer'
                  ? 'Current conditions favor patience. You have leverage to negotiate and time to find the right property.'
                  : marketType.type === 'seller'
                  ? 'Act decisively when you find the right property. Delays may cost you in this competitive environment.'
                  : 'Balanced conditions allow for thoughtful decision-making without extreme urgency.'}
              </p>
            </div>

            {/* Negotiation strategy */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--report-stone-light)' }}>
                Negotiation
              </p>
              <p className="report-body-sm">
                {daysOnMarket && daysOnMarket > 45
                  ? `With ${Math.round(daysOnMarket)} average days on market, sellers may be more willing to negotiate on price or concessions.`
                  : daysOnMarket && daysOnMarket < 30
                  ? `Properties move quickly (${Math.round(daysOnMarket)} days average). Prepare strong initial offers close to asking price.`
                  : 'Standard negotiation tactics apply. Start with a reasonable offer based on comparable sales.'}
              </p>
            </div>

            {/* Competition assessment */}
            {hotnessScore !== null && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--report-stone-light)' }}>
                  Competition Level
                </p>
                <p className="report-body-sm">
                  {hotnessScore > 80
                    ? 'Very high competition. Consider offering above asking, waiving contingencies, or writing personal letters to sellers.'
                    : hotnessScore > 60
                    ? 'Moderate competition. Be prepared with pre-approval and quick response times.'
                    : hotnessScore > 40
                    ? 'Lower competition gives you room to be selective and negotiate terms.'
                    : 'Minimal competition. You can take time to evaluate options and negotiate favorable terms.'}
                </p>
              </div>
            )}

            {/* Inventory insight */}
            {activeListings !== null && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--report-stone-light)' }}>
                  Inventory
                </p>
                <p className="report-body-sm">
                  {activeListings} active listings currently available.
                  {activeListings > 50
                    ? ' Good selection gives you options to compare and find the best fit.'
                    : activeListings > 20
                    ? ' Moderate selection available. Act on properties that match your criteria.'
                    : ' Limited inventory means you may need to expand your search criteria or wait for new listings.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

export default MarketConditions;
