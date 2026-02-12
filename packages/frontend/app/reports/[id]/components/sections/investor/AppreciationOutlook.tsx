'use client';

import React from 'react';
import { TrendingUp, AlertTriangle, Calendar, Target } from 'lucide-react';

import { SectionCard, MetricDisplay, TrendSparkline, AIAnalysisBlock } from '../core';
import type { MetricTrend, TrendDirection } from '../core';
import type { ReportInstance } from '../../../../types';

/**
 * Metric configuration for appreciation metrics display
 */
interface AppreciationMetricConfig {
  id: string;
  label: string;
  aliases?: string[];
}

/**
 * Pool of appreciation-related metrics
 * Priority order - pick first 6 with data
 */
const APPRECIATION_METRICS_POOL: AppreciationMetricConfig[] = [
  { id: 'home_value', label: 'Median Home Value', aliases: ['zhvi', 'median_listing_price'] },
  { id: 'home_value_yoy', label: 'YoY Appreciation', aliases: ['zhvi_yoy', 'home_price_yoy'] },
  { id: 'home_price_forecast', label: '12-Month Forecast', aliases: ['zhvf_1yr_pct', 'price_forecast_1yr'] },
  { id: 'overvalued_pct', label: 'Overvalued %', aliases: ['valuation_premium'] },
  { id: 'appreciation_3yr', label: '3-Year Appreciation', aliases: ['total_appreciation_3yr'] },
  { id: 'appreciation_5yr', label: '5-Year Appreciation', aliases: ['total_appreciation_5yr'] },
  { id: 'price_per_sqft', label: 'Price per Sq Ft', aliases: ['median_price_sqft'] },
  { id: 'median_sale_price', label: 'Median Sale Price', aliases: ['sold_price'] },
  { id: 'list_price', label: 'Median List Price', aliases: ['median_listing_price'] },
  { id: 'sale_to_list', label: 'Sale-to-List Ratio', aliases: ['sale_to_list_ratio'] },
  { id: 'months_of_supply', label: 'Months of Supply', aliases: ['inventory_months'] },
  { id: 'home_value_mom', label: 'MoM Change', aliases: ['zhvi_mom', 'price_mom'] },
];

/**
 * Get metric value from pool config - checks current data then historical
 */
function getMetricFromPool(
  report: ReportInstance,
  config: AppreciationMetricConfig
): number | null {
  // Try primary ID first
  const ids = [config.id, ...(config.aliases ?? [])];

  for (const id of ids) {
    // Try current data
    const currentValue = report.populated_data?.current?.[id];
    if (currentValue !== undefined && currentValue !== null) {
      return Number(currentValue);
    }

    // Try historical data (latest value)
    const histData = report.populated_data?.historical?.[id];
    if (histData && histData.data && histData.data.length > 0) {
      return histData.data[histData.data.length - 1].value;
    }
  }

  return null;
}

/**
 * Get historical trend for a metric from pool config
 */
function getMetricTrendFromPool(
  report: ReportInstance,
  config: AppreciationMetricConfig
): MetricTrend | undefined {
  const historical = report.populated_data?.historical;
  if (!historical) return undefined;

  const ids = [config.id, ...(config.aliases ?? [])];

  for (const id of ids) {
    const histData = historical[id];
    if (histData?.data && histData.data.length >= 2) {
      return {
        direction: histData.trend as TrendDirection,
        changePct: histData.change_pct,
        sparklineData: histData.data.map((d: { value: number }) => d.value),
      };
    }
  }

  return undefined;
}

/**
 * Props for AppreciationOutlook section
 */
export interface AppreciationOutlookProps {
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
  metricId: string
): { sparklineData: number[]; direction: TrendDirection; changePct: number; data: Array<{ date: string; value: number }> } | null {
  const historical = report.populated_data?.historical?.[metricId];
  if (!historical || !historical.data || historical.data.length < 2) {
    return null;
  }

  const sparklineData = historical.data.map((d) => d.value);
  const direction: TrendDirection = historical.trend || 'stable';
  const changePct = historical.change_pct ?? 0;

  return { sparklineData, direction, changePct, data: historical.data };
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
 * Get appreciation outlook rating based on forecast and YoY
 */
function getAppreciationOutlook(
  yoyAppreciation: number | null,
  forecast: number | null
): {
  rating: 'strong' | 'moderate' | 'weak' | 'declining';
  label: string;
  description: string;
  color: string;
} {
  const primaryMetric = forecast ?? yoyAppreciation;

  if (primaryMetric === null) {
    return {
      rating: 'moderate',
      label: 'Unknown',
      description: 'Insufficient data to assess appreciation outlook',
      color: 'var(--report-stone)',
    };
  }

  if (primaryMetric >= 8) {
    return {
      rating: 'strong',
      label: 'Strong Growth',
      description: 'Significant capital appreciation potential',
      color: 'var(--report-success)',
    };
  }
  if (primaryMetric >= 4) {
    return {
      rating: 'moderate',
      label: 'Moderate Growth',
      description: 'Steady appreciation above inflation',
      color: 'var(--report-success)',
    };
  }
  if (primaryMetric >= 0) {
    return {
      rating: 'weak',
      label: 'Slow Growth',
      description: 'Appreciation may lag inflation',
      color: 'var(--report-warning)',
    };
  }
  return {
    rating: 'declining',
    label: 'Declining Values',
    description: 'Market showing depreciation risk',
    color: 'var(--report-error)',
  };
}

/**
 * Get valuation risk assessment based on overvalued percentage
 */
function getValuationRisk(
  overvaluedPct: number | null
): {
  level: 'low' | 'moderate' | 'elevated' | 'high';
  label: string;
  description: string;
  color: string;
} {
  if (overvaluedPct === null) {
    return {
      level: 'moderate',
      label: 'Unknown',
      description: 'Valuation data unavailable',
      color: 'var(--report-stone)',
    };
  }

  if (overvaluedPct <= -5) {
    return {
      level: 'low',
      label: 'Undervalued',
      description: 'Potential for value recovery',
      color: 'var(--report-success)',
    };
  }
  if (overvaluedPct <= 5) {
    return {
      level: 'low',
      label: 'Fair Value',
      description: 'Prices aligned with fundamentals',
      color: 'var(--report-success)',
    };
  }
  if (overvaluedPct <= 15) {
    return {
      level: 'moderate',
      label: 'Slightly Overvalued',
      description: 'Minor premium to fair value',
      color: 'var(--report-warning)',
    };
  }
  if (overvaluedPct <= 25) {
    return {
      level: 'elevated',
      label: 'Overvalued',
      description: 'Correction risk present',
      color: 'var(--report-warning)',
    };
  }
  return {
    level: 'high',
    label: 'Highly Overvalued',
    description: 'Significant downside risk',
    color: 'var(--report-error)',
  };
}

/**
 * AppreciationOutlook - InvestorEdge report section analyzing appreciation potential
 *
 * This section helps investors understand capital gains potential by analyzing:
 * - Current home values and historical appreciation
 * - Year-over-year appreciation rates
 * - 12-month price forecasts
 * - Valuation risk indicators
 * - Historical appreciation context (3-year, 5-year)
 *
 * Uses the editorial design system from report-theme.css.
 */
export function AppreciationOutlook({
  report,
  className = '',
}: AppreciationOutlookProps): React.ReactElement {
  // Check all metrics in the pool and pick the first 6 that have data
  const allMetricsWithData = APPRECIATION_METRICS_POOL.map((config) => {
    const value = getMetricFromPool(report, config);
    const trend = getMetricTrendFromPool(report, config);
    return {
      ...config,
      value,
      trend,
    };
  });

  // Filter to metrics with data, take first 6
  const metricsWithData = allMetricsWithData.filter((m) => m.value !== null).slice(0, 6);
  const hasAnyData = metricsWithData.length > 0;

  // Get specific values for outlook calculations (using pool helper)
  const homeValueConfig = APPRECIATION_METRICS_POOL.find((c) => c.id === 'home_value');
  const yoyConfig = APPRECIATION_METRICS_POOL.find((c) => c.id === 'home_value_yoy');
  const forecastConfig = APPRECIATION_METRICS_POOL.find((c) => c.id === 'home_price_forecast');
  const overvaluedConfig = APPRECIATION_METRICS_POOL.find((c) => c.id === 'overvalued_pct');

  const homeValue = homeValueConfig ? getMetricFromPool(report, homeValueConfig) : null;
  const yoyAppreciation = yoyConfig ? getMetricFromPool(report, yoyConfig) : null;
  const forecast = forecastConfig ? getMetricFromPool(report, forecastConfig) : null;
  const overvaluedPct = overvaluedConfig ? getMetricFromPool(report, overvaluedConfig) : null;

  // Get historical trend for home values (ZHVI)
  const zhviTrend =
    getHistoricalTrend(report, 'zhvi') ??
    getHistoricalTrend(report, 'home_value');

  // Calculate historical appreciation context
  const threeYearAppreciation = zhviTrend?.data
    ? calculateHistoricalAppreciation(zhviTrend.data, 3)
    : null;
  const fiveYearAppreciation = zhviTrend?.data
    ? calculateHistoricalAppreciation(zhviTrend.data, 5)
    : null;

  // Get outlook and valuation assessments
  const outlook = getAppreciationOutlook(yoyAppreciation, forecast);
  const valuationRisk = getValuationRisk(overvaluedPct);

  // Get AI narrative
  const aiNarrative =
    report.ai_narrative?.investment_analysis ??
    report.ai_narrative?.appreciation_outlook ??
    report.ai_narratives?.appreciation_analysis ??
    report.ai_narratives?.investment_outlook;

  // Handle case where no data is available
  if (!hasAnyData) {
    return (
      <SectionCard
        title="Appreciation Outlook"
        icon={TrendingUp}
        className={className}
      >
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
          <p
            className="report-heading-sm mb-2"
            style={{ color: 'var(--report-navy)' }}
          >
            Appreciation Data Unavailable
          </p>
          <p
            className="report-body-sm max-w-md"
            style={{ color: 'var(--report-stone-light)' }}
          >
            Home value and appreciation data are not available for this location.
            This may be due to limited data coverage in this area.
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Appreciation Outlook"
      icon={TrendingUp}
      className={className}
    >
      {/* Outlook Summary Banner */}
      <div
        className="rounded-[var(--report-radius-md)] p-5 mb-6"
        style={{
          backgroundColor:
            outlook.rating === 'strong' || outlook.rating === 'moderate'
              ? 'var(--report-success-bg)'
              : outlook.rating === 'weak'
              ? 'var(--report-warning-bg)'
              : 'var(--report-error-bg)',
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'white' }}
            >
              <Target
                className="w-6 h-6"
                style={{ color: outlook.color }}
              />
            </div>
            <div>
              <p
                className="text-xs font-medium uppercase tracking-wide mb-1"
                style={{ color: 'var(--report-stone-light)' }}
              >
                Appreciation Outlook
              </p>
              <p
                className="text-xl font-semibold"
                style={{ color: outlook.color }}
              >
                {outlook.label}
              </p>
              <p
                className="text-sm"
                style={{ color: 'var(--report-stone)' }}
              >
                {outlook.description}
              </p>
            </div>
          </div>

          {/* Quick stats */}
          {(yoyAppreciation !== null || forecast !== null) && (
            <div
              className="flex gap-6"
              style={{ textAlign: 'right' }}
            >
              {yoyAppreciation !== null && (
                <div>
                  <p
                    className="text-xs font-medium uppercase tracking-wide mb-1"
                    style={{ color: 'var(--report-stone-light)' }}
                  >
                    Current YoY
                  </p>
                  <p
                    className="text-lg font-semibold"
                    style={{
                      color:
                        yoyAppreciation >= 0
                          ? 'var(--report-success)'
                          : 'var(--report-error)',
                    }}
                  >
                    {yoyAppreciation >= 0 ? '+' : ''}
                    {yoyAppreciation.toFixed(1)}%
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
                      color:
                        forecast >= 0
                          ? 'var(--report-success)'
                          : 'var(--report-error)',
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

      {/* Key Metrics Grid - Shows first 6 metrics with data */}
      <div className="mb-6">
        <h4 className="report-label mb-4">Appreciation Metrics</h4>
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
            </div>
          ))}
        </div>
      </div>

      {/* Historical Appreciation Visualization */}
      {zhviTrend && zhviTrend.sparklineData.length > 0 && (
        <div
          className="rounded-[var(--report-radius-md)] p-5 mb-6"
          style={{ backgroundColor: 'var(--report-cream)' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Calendar
              className="w-4 h-4"
              style={{ color: 'var(--report-gold)' }}
            />
            <h4
              className="report-heading-sm"
              style={{ color: 'var(--report-navy)', margin: 0 }}
            >
              Historical Appreciation
            </h4>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-6">
            {/* Sparkline */}
            <div className="flex-1 min-w-[200px]">
              <p
                className="text-xs font-medium uppercase tracking-wide mb-2"
                style={{ color: 'var(--report-stone-light)' }}
              >
                Home Value Trend
              </p>
              <TrendSparkline
                data={zhviTrend.sparklineData}
                trend={zhviTrend.direction}
                changePct={zhviTrend.changePct}
                width={160}
                height={40}
              />
            </div>

            {/* Historical Context */}
            <div className="flex gap-8">
              {threeYearAppreciation !== null && (
                <div className="text-center">
                  <p
                    className="text-xs font-medium uppercase tracking-wide mb-1"
                    style={{ color: 'var(--report-stone-light)' }}
                  >
                    3-Year Total
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
                    5-Year Total
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

      {/* Valuation Risk Indicator */}
      {overvaluedPct !== null && (
        <div
          className="rounded-[var(--report-radius-md)] p-5 mb-6 border-l-4"
          style={{
            backgroundColor: 'var(--report-cream)',
            borderLeftColor: valuationRisk.color,
          }}
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p
                className="text-xs font-medium uppercase tracking-wide mb-1"
                style={{ color: 'var(--report-stone-light)' }}
              >
                Valuation Risk
              </p>
              <p
                className="font-semibold text-lg"
                style={{ color: valuationRisk.color }}
              >
                {valuationRisk.label}
              </p>
              <p
                className="text-sm"
                style={{ color: 'var(--report-stone)' }}
              >
                {valuationRisk.description}
              </p>
            </div>
            <div
              className="text-right"
            >
              <p
                className="text-xs font-medium uppercase tracking-wide mb-1"
                style={{ color: 'var(--report-stone-light)' }}
              >
                Premium/Discount
              </p>
              <p
                className="text-2xl font-bold"
                style={{ color: valuationRisk.color }}
              >
                {overvaluedPct >= 0 ? '+' : ''}
                {overvaluedPct.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Investor Context */}
      <div
        className="rounded-[var(--report-radius-md)] p-4 mb-6"
        style={{
          backgroundColor: 'var(--report-cream)',
          border: '1px solid rgba(27,46,74,0.06)',
        }}
      >
        <p
          className="text-xs font-medium uppercase tracking-wide mb-3"
          style={{ color: 'var(--report-stone-light)' }}
        >
          What This Means for Investors
        </p>
        <div className="space-y-2">
          {yoyAppreciation !== null && (
            <div className="flex items-start gap-2">
              <div
                className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                style={{
                  backgroundColor:
                    yoyAppreciation >= 4
                      ? 'var(--report-success)'
                      : yoyAppreciation >= 0
                      ? 'var(--report-warning)'
                      : 'var(--report-error)',
                }}
              />
              <p
                className="text-sm"
                style={{ color: 'var(--report-stone)' }}
              >
                {yoyAppreciation >= 8
                  ? 'Strong current appreciation suggests high investor interest and potential for continued gains.'
                  : yoyAppreciation >= 4
                  ? 'Moderate appreciation indicates steady market with reasonable growth expectations.'
                  : yoyAppreciation >= 0
                  ? 'Slow appreciation may mean limited near-term capital gains; focus on cash flow.'
                  : 'Declining values present entry opportunities but carry timing risk.'}
              </p>
            </div>
          )}

          {forecast !== null && forecast !== yoyAppreciation && (
            <div className="flex items-start gap-2">
              <div
                className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                style={{
                  backgroundColor:
                    forecast >= 4
                      ? 'var(--report-success)'
                      : forecast >= 0
                      ? 'var(--report-warning)'
                      : 'var(--report-error)',
                }}
              />
              <p
                className="text-sm"
                style={{ color: 'var(--report-stone)' }}
              >
                {forecast > (yoyAppreciation ?? 0)
                  ? 'Forecasts suggest accelerating appreciation - potential for above-market returns.'
                  : forecast < (yoyAppreciation ?? 0)
                  ? 'Forecasts suggest decelerating appreciation - consider shorter hold periods.'
                  : 'Stable appreciation expected to continue at current pace.'}
              </p>
            </div>
          )}

          {overvaluedPct !== null && (
            <div className="flex items-start gap-2">
              <div
                className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                style={{
                  backgroundColor: valuationRisk.color,
                }}
              />
              <p
                className="text-sm"
                style={{ color: 'var(--report-stone)' }}
              >
                {overvaluedPct <= -5
                  ? 'Undervalued market suggests potential for value appreciation as prices normalize.'
                  : overvaluedPct <= 5
                  ? 'Fair valuation reduces downside risk and supports sustainable appreciation.'
                  : overvaluedPct <= 15
                  ? 'Slight overvaluation may limit upside; negotiate aggressively on purchase price.'
                  : 'Significant overvaluation increases correction risk - ensure strong cash flow fundamentals.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* AI Analysis Block */}
      {aiNarrative && (
        <AIAnalysisBlock
          title="Appreciation Analysis"
          content={typeof aiNarrative === 'string' ? aiNarrative : String(aiNarrative)}
          variant="insight"
        />
      )}
    </SectionCard>
  );
}

export default AppreciationOutlook;
