'use client';

import React from 'react';
import { DollarSign, TrendingUp, TrendingDown, Calendar, AlertTriangle } from 'lucide-react';

import { SectionCard, MetricDisplay, TrendSparkline, AIAnalysisBlock } from '../core';
import type { TrendDirection } from '../core';
import { getMetricWithAliases } from '../../utils/metricHelpers';
import type { ReportInstance } from '../../../../types';

/**
 * Props for PriceTrends section
 */
export interface PriceTrendsProps {
  /** The full report data */
  report: ReportInstance;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Extract historical trend data for a metric
 */
function getHistoricalTrend(
  report: ReportInstance,
  metricIds: string[]
): {
  sparklineData: number[];
  direction: TrendDirection;
  changePct: number;
  data: Array<{ date: string; value: number }>;
} | null {
  const historical = report.populated_data?.historical;
  if (!historical) return null;

  for (const metricId of metricIds) {
    const histData = historical[metricId];
    if (histData && histData.data && histData.data.length >= 2) {
      return {
        sparklineData: histData.data.map((d) => d.value),
        direction: (histData.trend || 'stable') as TrendDirection,
        changePct: histData.change_pct ?? 0,
        data: histData.data,
      };
    }
  }

  return null;
}

/**
 * Get metric value with fallback aliases
 */
function getMetricWithFallbacks(
  report: ReportInstance,
  metricIds: string[]
): number | null {
  for (const id of metricIds) {
    const value = getMetricWithAliases(report, id);
    if (value !== null) return value;
  }
  return null;
}

/**
 * Calculate multi-year appreciation from historical data
 */
function calculateHistoricalAppreciation(
  data: Array<{ date: string; value: number }>,
  years: number
): number | null {
  if (!data || data.length < 2) return null;

  // Sort data by date (oldest first)
  const sortedData = [...data].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const latestValue = sortedData[sortedData.length - 1].value;
  const latestDate = new Date(sortedData[sortedData.length - 1].date);
  const targetDate = new Date(latestDate);
  targetDate.setFullYear(targetDate.getFullYear() - years);

  // Find the closest data point to the target date
  let closestPoint = sortedData[0];
  let closestDiff = Math.abs(new Date(closestPoint.date).getTime() - targetDate.getTime());

  for (const point of sortedData) {
    const diff = Math.abs(new Date(point.date).getTime() - targetDate.getTime());
    if (diff < closestDiff) {
      closestDiff = diff;
      closestPoint = point;
    }
  }

  // Only calculate if we have data close enough to the target (within 6 months)
  const sixMonthsMs = 6 * 30 * 24 * 60 * 60 * 1000;
  if (closestDiff > sixMonthsMs) return null;

  if (closestPoint.value === 0) return null;

  // Calculate total percentage change
  const totalChange = ((latestValue - closestPoint.value) / closestPoint.value) * 100;

  return totalChange;
}

/**
 * Get price trend assessment for agent communication
 */
function getPriceTrendAssessment(
  yoyChange: number | null,
  forecast: number | null
): {
  rating: 'appreciating' | 'stable' | 'declining';
  label: string;
  description: string;
  color: string;
  agentGuidance: string;
} {
  const primaryMetric = yoyChange ?? forecast;

  if (primaryMetric === null) {
    return {
      rating: 'stable',
      label: 'Data Limited',
      description: 'Insufficient data for trend assessment',
      color: 'var(--report-stone)',
      agentGuidance: 'Recommend additional market research for pricing strategy.',
    };
  }

  if (primaryMetric >= 5) {
    return {
      rating: 'appreciating',
      label: 'Strong Appreciation',
      description: 'Prices rising faster than average',
      color: 'var(--report-success)',
      agentGuidance: 'Sellers can price confidently. Buyers should act quickly to avoid further increases.',
    };
  }
  if (primaryMetric >= 2) {
    return {
      rating: 'appreciating',
      label: 'Moderate Growth',
      description: 'Steady price increases',
      color: 'var(--report-success)',
      agentGuidance: 'Healthy appreciation supports both buyers and sellers. Standard pricing strategies apply.',
    };
  }
  if (primaryMetric >= -2) {
    return {
      rating: 'stable',
      label: 'Price Stability',
      description: 'Prices holding steady',
      color: 'var(--report-stone)',
      agentGuidance: 'Balanced conditions. Focus on property-specific value drivers.',
    };
  }
  if (primaryMetric >= -5) {
    return {
      rating: 'declining',
      label: 'Softening Prices',
      description: 'Slight price adjustments',
      color: 'var(--report-warning)',
      agentGuidance: 'Sellers may need to adjust expectations. Buyers have more negotiating power.',
    };
  }
  return {
    rating: 'declining',
    label: 'Declining Market',
    description: 'Significant price decreases',
    color: 'var(--report-error)',
    agentGuidance: 'Critical to price competitively. Buyers can negotiate aggressively.',
  };
}

/**
 * PriceTrends - Price analysis section for agents
 *
 * Displays comprehensive price trend data including:
 * - Current home values with historical trends
 * - Listing prices and price per square foot
 * - Historical appreciation (1yr, 3yr, 5yr)
 * - 12-month price forecasts
 *
 * Uses the editorial design system from report-theme.css.
 */
export function PriceTrends({
  report,
  className = '',
}: PriceTrendsProps): React.ReactElement {
  // Get home value metrics
  const homeValue = getMetricWithFallbacks(report, [
    'home_value',
    'zhvi',
    'median_home_value',
  ]);

  const listingPrice = getMetricWithFallbacks(report, [
    'listing_price',
    'median_listing_price',
    'median_list_price',
  ]);

  const pricePerSqft = getMetricWithFallbacks(report, [
    'price_per_sqft',
    'median_ppsf',
    'ppsf',
    'price_sqft',
  ]);

  // Get YoY change
  const yoyChange = getMetricWithFallbacks(report, [
    'zhvi_yoy',
    'home_value_yoy',
    'price_yoy',
    'home_price_yoy',
  ]);

  // Get forecast
  const forecast = getMetricWithFallbacks(report, [
    'zhvf_1yr_pct',
    'home_price_forecast',
    'price_forecast_1yr',
    'zhvf_1yr',
  ]);

  // Get historical trends
  const homeValueTrend = getHistoricalTrend(report, [
    'zhvi',
    'home_value',
    'median_home_value',
  ]);

  const listingPriceTrend = getHistoricalTrend(report, [
    'listing_price',
    'median_listing_price',
  ]);

  const pricePerSqftTrend = getHistoricalTrend(report, [
    'price_per_sqft',
    'median_ppsf',
    'ppsf',
  ]);

  // Calculate historical appreciation
  const oneYearAppreciation = homeValueTrend?.data
    ? calculateHistoricalAppreciation(homeValueTrend.data, 1)
    : yoyChange;
  const threeYearAppreciation = homeValueTrend?.data
    ? calculateHistoricalAppreciation(homeValueTrend.data, 3)
    : null;
  const fiveYearAppreciation = homeValueTrend?.data
    ? calculateHistoricalAppreciation(homeValueTrend.data, 5)
    : null;

  // Get price trend assessment
  const trendAssessment = getPriceTrendAssessment(yoyChange, forecast);

  // Get AI narrative
  const aiNarrative =
    report.ai_narrative?.trend_observations ||
    report.ai_narrative?.market_summary ||
    report.ai_narratives?.price_trends ||
    report.ai_narratives?.appreciation_analysis;

  // Check if we have any data
  const hasAnyData =
    homeValue !== null ||
    listingPrice !== null ||
    pricePerSqft !== null ||
    yoyChange !== null;

  if (!hasAnyData) {
    return (
      <SectionCard title="Price Trends" icon={DollarSign} className={className}>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
            style={{ backgroundColor: 'var(--report-cream-dark)' }}
          >
            <AlertTriangle
              className="w-6 h-6"
              style={{ color: 'var(--report-stone-light)' }}
            />
          </div>
          <p className="report-heading-sm mb-2" style={{ color: 'var(--report-navy)' }}>
            Price Data Unavailable
          </p>
          <p
            className="report-body-sm max-w-md"
            style={{ color: 'var(--report-stone-light)' }}
          >
            Price trend data is not available for this location.
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Price Trends" icon={DollarSign} className={className}>
      {/* Trend Assessment Banner */}
      <div
        className="rounded-[var(--report-radius-md)] p-5 mb-6"
        style={{
          backgroundColor:
            trendAssessment.rating === 'appreciating'
              ? 'var(--report-success-bg)'
              : trendAssessment.rating === 'declining'
              ? 'var(--report-warning-bg)'
              : 'var(--report-cream)',
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'white' }}
            >
              {trendAssessment.rating === 'appreciating' ? (
                <TrendingUp className="w-6 h-6" style={{ color: trendAssessment.color }} />
              ) : trendAssessment.rating === 'declining' ? (
                <TrendingDown className="w-6 h-6" style={{ color: trendAssessment.color }} />
              ) : (
                <DollarSign className="w-6 h-6" style={{ color: trendAssessment.color }} />
              )}
            </div>
            <div>
              <p
                className="text-xs font-medium uppercase tracking-wide mb-1"
                style={{ color: 'var(--report-stone-light)' }}
              >
                Price Trend
              </p>
              <p
                className="text-xl font-semibold"
                style={{ color: trendAssessment.color }}
              >
                {trendAssessment.label}
              </p>
              <p className="text-sm" style={{ color: 'var(--report-stone)' }}>
                {trendAssessment.description}
              </p>
            </div>
          </div>

          {/* Quick YoY and Forecast stats */}
          {(yoyChange !== null || forecast !== null) && (
            <div className="flex gap-6" style={{ textAlign: 'right' }}>
              {yoyChange !== null && (
                <div>
                  <p
                    className="text-xs font-medium uppercase tracking-wide mb-1"
                    style={{ color: 'var(--report-stone-light)' }}
                  >
                    Year-over-Year
                  </p>
                  <p
                    className="text-lg font-semibold"
                    style={{
                      color: yoyChange >= 0 ? 'var(--report-success)' : 'var(--report-error)',
                    }}
                  >
                    {yoyChange >= 0 ? '+' : ''}
                    {yoyChange.toFixed(1)}%
                  </p>
                </div>
              )}
              {forecast !== null && (
                <div>
                  <p
                    className="text-xs font-medium uppercase tracking-wide mb-1"
                    style={{ color: 'var(--report-stone-light)' }}
                  >
                    12-Mo Forecast
                  </p>
                  <p
                    className="text-lg font-semibold"
                    style={{
                      color: forecast >= 0 ? 'var(--report-success)' : 'var(--report-error)',
                    }}
                  >
                    {forecast >= 0 ? '+' : ''}
                    {forecast.toFixed(1)}%
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Key Price Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--report-space-md)',
          marginBottom: 'var(--report-space-lg)',
        }}
      >
        <MetricDisplay
          metricId="home_value"
          value={homeValue}
          label="Median Home Value"
          trend={
            homeValueTrend
              ? {
                  direction: homeValueTrend.direction,
                  changePct: homeValueTrend.changePct,
                  sparklineData: homeValueTrend.sparklineData,
                }
              : undefined
          }
        />

        <MetricDisplay
          metricId="listing_price"
          value={listingPrice}
          label="Median Listing Price"
          trend={
            listingPriceTrend
              ? {
                  direction: listingPriceTrend.direction,
                  changePct: listingPriceTrend.changePct,
                  sparklineData: listingPriceTrend.sparklineData,
                }
              : undefined
          }
        />

        <MetricDisplay
          metricId="price_per_sqft"
          value={pricePerSqft}
          label="Price per Sq Ft"
          trend={
            pricePerSqftTrend
              ? {
                  direction: pricePerSqftTrend.direction,
                  changePct: pricePerSqftTrend.changePct,
                  sparklineData: pricePerSqftTrend.sparklineData,
                }
              : undefined
          }
        />
      </div>

      {/* Historical Appreciation Context */}
      {(oneYearAppreciation !== null ||
        threeYearAppreciation !== null ||
        fiveYearAppreciation !== null) && (
        <div
          className="rounded-[var(--report-radius-md)] p-5 mb-6"
          style={{ backgroundColor: 'var(--report-cream)' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4" style={{ color: 'var(--report-gold)' }} />
            <h4
              className="report-heading-sm"
              style={{ color: 'var(--report-navy)', margin: 0 }}
            >
              Historical Appreciation
            </h4>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-6">
            {/* Sparkline visualization */}
            {homeValueTrend && homeValueTrend.sparklineData.length > 0 && (
              <div className="flex-1 min-w-[200px]">
                <p
                  className="text-xs font-medium uppercase tracking-wide mb-2"
                  style={{ color: 'var(--report-stone-light)' }}
                >
                  Value Trend
                </p>
                <TrendSparkline
                  data={homeValueTrend.sparklineData}
                  trend={homeValueTrend.direction}
                  changePct={homeValueTrend.changePct}
                  width={180}
                  height={48}
                />
              </div>
            )}

            {/* Historical appreciation periods */}
            <div className="flex gap-8">
              {oneYearAppreciation !== null && (
                <div className="text-center">
                  <p
                    className="text-xs font-medium uppercase tracking-wide mb-1"
                    style={{ color: 'var(--report-stone-light)' }}
                  >
                    1-Year
                  </p>
                  <p
                    className="text-xl font-semibold"
                    style={{
                      color:
                        oneYearAppreciation >= 0
                          ? 'var(--report-success)'
                          : 'var(--report-error)',
                    }}
                  >
                    {oneYearAppreciation >= 0 ? '+' : ''}
                    {oneYearAppreciation.toFixed(1)}%
                  </p>
                </div>
              )}

              {threeYearAppreciation !== null && (
                <div className="text-center">
                  <p
                    className="text-xs font-medium uppercase tracking-wide mb-1"
                    style={{ color: 'var(--report-stone-light)' }}
                  >
                    3-Year
                  </p>
                  <p
                    className="text-xl font-semibold"
                    style={{
                      color:
                        threeYearAppreciation >= 0
                          ? 'var(--report-success)'
                          : 'var(--report-error)',
                    }}
                  >
                    {threeYearAppreciation >= 0 ? '+' : ''}
                    {threeYearAppreciation.toFixed(1)}%
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: 'var(--report-stone-light)' }}
                  >
                    ~{(threeYearAppreciation / 3).toFixed(1)}%/yr
                  </p>
                </div>
              )}

              {fiveYearAppreciation !== null && (
                <div className="text-center">
                  <p
                    className="text-xs font-medium uppercase tracking-wide mb-1"
                    style={{ color: 'var(--report-stone-light)' }}
                  >
                    5-Year
                  </p>
                  <p
                    className="text-xl font-semibold"
                    style={{
                      color:
                        fiveYearAppreciation >= 0
                          ? 'var(--report-success)'
                          : 'var(--report-error)',
                    }}
                  >
                    {fiveYearAppreciation >= 0 ? '+' : ''}
                    {fiveYearAppreciation.toFixed(1)}%
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: 'var(--report-stone-light)' }}
                  >
                    ~{(fiveYearAppreciation / 5).toFixed(1)}%/yr
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Agent Guidance */}
      <div
        className="rounded-[var(--report-radius-md)] p-4 mb-6"
        style={{
          backgroundColor: 'var(--report-cream)',
          borderLeft: `4px solid ${trendAssessment.color}`,
        }}
      >
        <p
          className="text-xs font-medium uppercase tracking-wide mb-2"
          style={{ color: 'var(--report-stone-light)' }}
        >
          Agent Guidance
        </p>
        <p className="report-body" style={{ margin: 0, color: 'var(--report-navy)' }}>
          {trendAssessment.agentGuidance}
        </p>
      </div>

      {/* AI Analysis */}
      {aiNarrative && (
        <AIAnalysisBlock
          content={typeof aiNarrative === 'string' ? aiNarrative : String(aiNarrative)}
          title="Price Analysis"
          variant="insight"
        />
      )}
    </SectionCard>
  );
}

export default PriceTrends;
