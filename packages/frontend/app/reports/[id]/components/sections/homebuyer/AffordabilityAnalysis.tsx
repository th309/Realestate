'use client';

import React from 'react';
import { Home, DollarSign, TrendingUp, AlertTriangle, Calculator } from 'lucide-react';

import { formatMetricValue } from '@/lib/data';
import { SectionCard, MetricDisplay, AIAnalysisBlock, TrendSparkline } from '../core';
import type { TrendDirection, MetricTrend } from '../core';
import { getMetricWithGeoFallback } from '../../utils/metricHelpers';
import type { ReportInstance } from '../../../../types';

/**
 * Metric configuration for affordability display
 */
interface MetricConfig {
  id: string;
  label: string;
  description: string;
}

/**
 * Pool of affordability-relevant metrics using registry IDs
 * Priority order - pick first 6 with data
 */
const AFFORDABILITY_METRICS_POOL: MetricConfig[] = [
  { id: 'home_value', label: 'Median Home Value', description: 'Typical home price in the area' },
  { id: 'median_income', label: 'Median Income', description: 'Local household earning power' },
  { id: 'affordability_index', label: 'Affordability Index', description: 'Market affordability score' },
  { id: 'price_to_income', label: 'Price-to-Income', description: 'Home price vs. income ratio' },
  { id: 'home_value_yoy', label: 'Price Change YoY', description: 'Annual price appreciation' },
  { id: 'income_growth_yoy', label: 'Income Growth YoY', description: 'Annual income growth' },
  { id: 'mortgage_rate', label: 'Mortgage Rate', description: 'Current avg. mortgage rate' },
  { id: 'monthly_payment', label: 'Est. Monthly Payment', description: 'Typical mortgage payment' },
  { id: 'rent_vs_own', label: 'Rent vs. Own', description: 'Comparison of costs' },
  { id: 'median_rent', label: 'Median Rent', description: 'Typical rental cost' },
  { id: 'home_price_forecast', label: 'Price Forecast', description: '12-month price outlook' },
  { id: 'cost_of_living_index', label: 'Cost of Living', description: 'Area cost index' },
];

export interface AffordabilityAnalysisProps {
  /** The full report data */
  report: ReportInstance;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Determine affordability status based on price-to-income ratio
 */
function getAffordabilityStatus(priceToIncomeRatio: number): {
  label: string;
  description: string;
  color: string;
  bgClass: string;
} {
  if (priceToIncomeRatio <= 3) {
    return {
      label: 'Highly Affordable',
      description: 'Home prices are well within reach for median earners',
      color: 'var(--report-success)',
      bgClass: 'bg-[var(--report-success-bg)]',
    };
  }
  if (priceToIncomeRatio <= 4) {
    return {
      label: 'Affordable',
      description: 'Home prices align with traditional lending guidelines',
      color: 'var(--report-success)',
      bgClass: 'bg-[var(--report-success-bg)]',
    };
  }
  if (priceToIncomeRatio <= 5) {
    return {
      label: 'Moderately Affordable',
      description: 'Some stretching may be needed for median earners',
      color: 'var(--report-warning)',
      bgClass: 'bg-[var(--report-warning-bg)]',
    };
  }
  if (priceToIncomeRatio <= 7) {
    return {
      label: 'Challenging',
      description: 'Significant affordability challenges for most buyers',
      color: 'var(--report-warning)',
      bgClass: 'bg-[var(--report-warning-bg)]',
    };
  }
  return {
    label: 'Severely Unaffordable',
    description: 'Prices significantly exceed median earning potential',
    color: 'var(--report-error)',
    bgClass: 'bg-[var(--report-error-bg)]',
  };
}

/**
 * Extract historical trend data for a metric
 */
function getHistoricalTrend(
  report: ReportInstance,
  metricId: string
): { sparklineData: number[]; direction: TrendDirection; changePct: number } | null {
  const historical = report.populated_data?.historical?.[metricId];
  if (!historical || !historical.data || historical.data.length < 2) {
    return null;
  }

  const sparklineData = historical.data.map((d) => d.value);
  const direction: TrendDirection = historical.trend || 'stable';
  const changePct = historical.change_pct ?? 0;

  return { sparklineData, direction, changePct };
}

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
 * Get trend data for a metric from the pool
 */
function getPoolMetricTrend(
  report: ReportInstance,
  metricId: string
): MetricTrend | undefined {
  const historical = report.populated_data?.historical;
  if (!historical) return undefined;

  const histData = historical[metricId];
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
 * AffordabilityAnalysis - HomeReady report section analyzing housing affordability
 *
 * This section helps homebuyers understand if they can afford homes in this market
 * by comparing home values to local income levels and showing the affordability gap.
 *
 * Uses the editorial design system from report-theme.css.
 */
export function AffordabilityAnalysis({
  report,
  className = '',
}: AffordabilityAnalysisProps): React.ReactElement {
  // Check all metrics in the pool and pick the first 6 that have data
  const allMetricsWithData = AFFORDABILITY_METRICS_POOL.map((config) => {
    const { value, sourceLabel } = getMetricValue(report, config.id);
    const trend = getPoolMetricTrend(report, config.id);
    return {
      ...config,
      value,
      sourceLabel,
      trend,
    };
  });

  // Filter to metrics with data, take first 6
  const metricsWithData = allMetricsWithData.filter((m) => m.value !== null).slice(0, 6);

  // Get key metrics with geo fallback (try zip → county → state → national)
  const homeValueResult = getMetricWithGeoFallback(
    report as any,
    'zhvi',
    ['median_listing_price', 'home_value']
  );
  const homeValue = homeValueResult.value;

  const incomeResult = getMetricWithGeoFallback(
    report as any,
    'median_income',
    ['median_household_income', 'hh_income', 'household_income']
  );
  // If still no income, use US national median as reference ($75,000 as of 2024)
  const US_NATIONAL_MEDIAN_INCOME = 75000;
  const medianIncome = incomeResult.value ?? US_NATIONAL_MEDIAN_INCOME;

  // Get historical trends if available (try multiple metric IDs)
  const homeValueTrend = getHistoricalTrend(report, 'zhvi') ??
    getHistoricalTrend(report, 'home_value') ??
    getHistoricalTrend(report, 'median_listing_price');
  const incomeTrend = getHistoricalTrend(report, 'median_household_income') ??
    getHistoricalTrend(report, 'median_income');

  // Try to get additional trends - affordability index or price-to-income
  const affordabilityTrend = getHistoricalTrend(report, 'affordability_index') ??
    getHistoricalTrend(report, 'price_to_income');
  const priceMomTrend = getHistoricalTrend(report, 'home_value_mom') ??
    getHistoricalTrend(report, 'median_listing_price_mom');

  // Get AI narrative if available
  const aiNarrative = report.ai_narrative?.affordability_analysis;

  // Check if we have any data to show
  const hasPoolMetrics = metricsWithData.length > 0;

  // Handle case where no home value data is available and no pool metrics
  if (!homeValue && !hasPoolMetrics) {
    return (
      <SectionCard
        title="Affordability Analysis"
        icon={Calculator}
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
            Affordability Data Unavailable
          </p>
          <p
            className="report-body-sm max-w-md"
            style={{ color: 'var(--report-stone-light)' }}
          >
            Home value and income data are not available for this location.
            This may be due to limited data coverage in this area.
          </p>
        </div>
      </SectionCard>
    );
  }

  // Calculate affordability metrics
  const priceToIncomeRatio = homeValue && medianIncome ? homeValue / medianIncome : null;
  const affordablePrice = medianIncome ? medianIncome * 4 : null; // Standard 4x income rule
  const affordabilityGap = homeValue && affordablePrice ? homeValue - affordablePrice : null;
  const gapPercentage = affordablePrice && affordabilityGap
    ? (affordabilityGap / affordablePrice) * 100
    : null;
  const isAffordable = affordabilityGap !== null && affordabilityGap <= 0;

  const status = priceToIncomeRatio ? getAffordabilityStatus(priceToIncomeRatio) : null;

  // Calculate progress bar width for affordability visualization
  const affordabilityBarWidth = homeValue && affordablePrice
    ? Math.min(100, (affordablePrice / homeValue) * 100)
    : 0;

  return (
    <SectionCard
      title="Affordability Analysis"
      icon={Calculator}
      className={className}
    >
      {/* Status Banner */}
      {status && (
        <div
          className={`${status.bgClass} rounded-[var(--report-radius-md)] p-4 mb-6`}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'white' }}
            >
              {isAffordable ? (
                <Home className="w-5 h-5" style={{ color: status.color }} />
              ) : (
                <AlertTriangle className="w-5 h-5" style={{ color: status.color }} />
              )}
            </div>
            <div>
              <p
                className="font-semibold text-base"
                style={{ color: status.color }}
              >
                {status.label}
              </p>
              <p
                className="text-sm"
                style={{ color: 'var(--report-stone)' }}
              >
                {status.description}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Key Affordability Metrics Grid - Pool-based (up to 6 metrics) */}
      {hasPoolMetrics && (
        <div className="mb-6">
          <h4 className="report-label mb-4">Key Affordability Indicators</h4>
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
          {/* Metric descriptions */}
          <div
            className="mt-4 p-3 rounded-lg"
            style={{ backgroundColor: 'var(--report-cream)' }}
          >
            <p className="report-label mb-2">What These Metrics Mean</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {metricsWithData.map((metric) => (
                <div key={metric.id} className="flex items-start gap-2">
                  <div
                    className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{ backgroundColor: 'var(--report-gold)' }}
                  />
                  <p className="report-body-sm">
                    <strong>{metric.label}:</strong> {metric.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Price-to-Income Ratio Card (calculated, shown when pool doesn't include it) */}
      {priceToIncomeRatio !== null && !metricsWithData.some((m) => m.id === 'price_to_income') && (
        <div className="mb-6">
          <div
            className="rounded-lg p-4 inline-block"
            style={{ backgroundColor: 'var(--report-cream)' }}
          >
            <p className="report-label mb-1">Price-to-Income Ratio</p>
            <p className="report-metric-value">{priceToIncomeRatio.toFixed(1)}x</p>
            <p
              className="text-xs mt-1"
              style={{ color: 'var(--report-stone-light)' }}
            >
              {priceToIncomeRatio <= 4 ? 'Within traditional limits' : 'Above 4x guideline'}
            </p>
          </div>
        </div>
      )}

      {/* Affordability Gap Visualization */}
      {homeValue && affordablePrice && (
        <AffordabilityGapChart
          homeValue={homeValue}
          medianIncome={medianIncome}
          affordablePrice={affordablePrice}
          userIncome={(report as any).user_inputs?.household_income ?? (report as any).user_inputs?.annual_income}
          isAffordable={isAffordable}
        />
      )}

      {/* Historical Trends Section */}
      {(homeValueTrend || incomeTrend || affordabilityTrend || priceMomTrend) && (
        <div className="mb-6">
          <h4
            className="report-heading-sm mb-3"
            style={{ color: 'var(--report-navy)' }}
          >
            <TrendingUp
              className="w-4 h-4 inline-block mr-2"
              style={{ color: 'var(--report-gold)' }}
            />
            Historical Trends
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {homeValueTrend && (
              <div
                className="p-4 rounded-[var(--report-radius-md)]"
                style={{ backgroundColor: 'var(--report-cream)' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <p
                    className="text-xs font-medium uppercase tracking-wide"
                    style={{ color: 'var(--report-stone-light)' }}
                  >
                    Home Value Trend
                  </p>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      homeValueTrend.direction === 'up'
                        ? 'bg-[var(--report-warning-bg)] text-[var(--report-warning)]'
                        : homeValueTrend.direction === 'down'
                        ? 'bg-[var(--report-success-bg)] text-[var(--report-success)]'
                        : 'bg-[var(--report-cream-dark)] text-[var(--report-stone)]'
                    }`}
                  >
                    {homeValueTrend.changePct >= 0 ? '+' : ''}{homeValueTrend.changePct.toFixed(1)}%
                  </span>
                </div>
                <TrendSparkline
                  data={homeValueTrend.sparklineData}
                  trend={homeValueTrend.direction}
                  changePct={homeValueTrend.changePct}
                  width={150}
                  height={36}
                />
                <p className="text-xs mt-2" style={{ color: 'var(--report-stone-light)' }}>
                  {homeValueTrend.direction === 'up'
                    ? 'Rising prices may reduce buying power'
                    : homeValueTrend.direction === 'down'
                    ? 'Falling prices may improve affordability'
                    : 'Prices holding steady'}
                </p>
              </div>
            )}
            {incomeTrend && (
              <div
                className="p-4 rounded-[var(--report-radius-md)]"
                style={{ backgroundColor: 'var(--report-cream)' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <p
                    className="text-xs font-medium uppercase tracking-wide"
                    style={{ color: 'var(--report-stone-light)' }}
                  >
                    Income Trend
                  </p>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      incomeTrend.direction === 'up'
                        ? 'bg-[var(--report-success-bg)] text-[var(--report-success)]'
                        : incomeTrend.direction === 'down'
                        ? 'bg-[var(--report-error-bg)] text-[var(--report-error)]'
                        : 'bg-[var(--report-cream-dark)] text-[var(--report-stone)]'
                    }`}
                  >
                    {incomeTrend.changePct >= 0 ? '+' : ''}{incomeTrend.changePct.toFixed(1)}%
                  </span>
                </div>
                <TrendSparkline
                  data={incomeTrend.sparklineData}
                  trend={incomeTrend.direction}
                  changePct={incomeTrend.changePct}
                  width={150}
                  height={36}
                />
                <p className="text-xs mt-2" style={{ color: 'var(--report-stone-light)' }}>
                  {incomeTrend.direction === 'up'
                    ? 'Rising incomes improve buying power'
                    : incomeTrend.direction === 'down'
                    ? 'Falling incomes reduce buying power'
                    : 'Incomes holding steady'}
                </p>
              </div>
            )}
            {affordabilityTrend && (
              <div
                className="p-4 rounded-[var(--report-radius-md)]"
                style={{ backgroundColor: 'var(--report-cream)' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <p
                    className="text-xs font-medium uppercase tracking-wide"
                    style={{ color: 'var(--report-stone-light)' }}
                  >
                    Affordability Index
                  </p>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      affordabilityTrend.direction === 'up'
                        ? 'bg-[var(--report-success-bg)] text-[var(--report-success)]'
                        : affordabilityTrend.direction === 'down'
                        ? 'bg-[var(--report-warning-bg)] text-[var(--report-warning)]'
                        : 'bg-[var(--report-cream-dark)] text-[var(--report-stone)]'
                    }`}
                  >
                    {affordabilityTrend.changePct >= 0 ? '+' : ''}{affordabilityTrend.changePct.toFixed(1)}%
                  </span>
                </div>
                <TrendSparkline
                  data={affordabilityTrend.sparklineData}
                  trend={affordabilityTrend.direction}
                  changePct={affordabilityTrend.changePct}
                  width={150}
                  height={36}
                />
                <p className="text-xs mt-2" style={{ color: 'var(--report-stone-light)' }}>
                  {affordabilityTrend.direction === 'up'
                    ? 'Market becoming more affordable'
                    : affordabilityTrend.direction === 'down'
                    ? 'Market becoming less affordable'
                    : 'Affordability holding steady'}
                </p>
              </div>
            )}
            {priceMomTrend && !incomeTrend && (
              <div
                className="p-4 rounded-[var(--report-radius-md)]"
                style={{ backgroundColor: 'var(--report-cream)' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <p
                    className="text-xs font-medium uppercase tracking-wide"
                    style={{ color: 'var(--report-stone-light)' }}
                  >
                    Monthly Price Change
                  </p>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      priceMomTrend.direction === 'up'
                        ? 'bg-[var(--report-warning-bg)] text-[var(--report-warning)]'
                        : priceMomTrend.direction === 'down'
                        ? 'bg-[var(--report-success-bg)] text-[var(--report-success)]'
                        : 'bg-[var(--report-cream-dark)] text-[var(--report-stone)]'
                    }`}
                  >
                    {priceMomTrend.changePct >= 0 ? '+' : ''}{priceMomTrend.changePct.toFixed(1)}%
                  </span>
                </div>
                <TrendSparkline
                  data={priceMomTrend.sparklineData}
                  trend={priceMomTrend.direction}
                  changePct={priceMomTrend.changePct}
                  width={150}
                  height={36}
                />
                <p className="text-xs mt-2" style={{ color: 'var(--report-stone-light)' }}>
                  {priceMomTrend.direction === 'up'
                    ? 'Prices accelerating month-over-month'
                    : priceMomTrend.direction === 'down'
                    ? 'Price growth slowing down'
                    : 'Price momentum stable'}
                </p>
              </div>
            )}
          </div>
          {homeValueTrend && incomeTrend && (
            <p
              className="text-xs mt-3"
              style={{ color: 'var(--report-stone-light)' }}
            >
              {homeValueTrend.changePct > incomeTrend.changePct
                ? 'Home prices are rising faster than incomes, potentially reducing affordability over time.'
                : homeValueTrend.changePct < incomeTrend.changePct
                  ? 'Incomes are growing faster than home prices, which may improve affordability.'
                  : 'Home prices and incomes are growing at similar rates.'}
            </p>
          )}
        </div>
      )}

      {/* AI Analysis Block */}
      {aiNarrative && (
        <AIAnalysisBlock
          title="Market Insight"
          content={aiNarrative}
          variant="insight"
        />
      )}

    </SectionCard>
  );
}

/**
 * AffordabilityGapChart - Visual comparison of home price vs. what's affordable
 *
 * Centers on median home price, then shows horizontal bars comparing
 * what's affordable at the area median income, and optionally the user's income.
 */
function AffordabilityGapChart({
  homeValue,
  medianIncome,
  affordablePrice,
  userIncome,
  isAffordable,
}: {
  homeValue: number;
  medianIncome: number;
  affordablePrice: number;
  userIncome?: number;
  isAffordable: boolean;
}) {
  const userAffordablePrice = userIncome ? userIncome * 4 : null;

  // Scale: everything relative to the largest value
  const maxValue = Math.max(
    homeValue,
    affordablePrice,
    userAffordablePrice ?? 0
  );

  const barPct = (val: number) => Math.max(8, (val / maxValue) * 100);

  const medianGap = homeValue - affordablePrice;
  const medianGapPct = affordablePrice > 0 ? (medianGap / affordablePrice) * 100 : 0;
  const userGap = userAffordablePrice ? homeValue - userAffordablePrice : null;
  const userGapPct = userAffordablePrice && userAffordablePrice > 0
    ? ((userGap ?? 0) / userAffordablePrice) * 100
    : null;

  return (
    <div
      className="rounded-[var(--report-radius-md)] p-5 mb-6"
      style={{ backgroundColor: 'var(--report-cream)' }}
    >
      <h4
        className="report-heading-sm mb-5"
        style={{ color: 'var(--report-navy)' }}
      >
        The Affordability Gap
      </h4>

      <div className="space-y-5">
        {/* Median Home Price - the anchor */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <Home className="w-4 h-4" style={{ color: 'var(--report-navy)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--report-navy)' }}>
                Median Home Price
              </span>
            </div>
            <span
              className="text-lg font-bold tabular-nums"
              style={{ color: 'var(--report-navy)', fontFamily: 'var(--report-font-display)' }}
            >
              {formatMetricValue(homeValue, 'currency')}
            </span>
          </div>
          <div
            className="h-4 rounded-full"
            style={{
              width: `${barPct(homeValue)}%`,
              backgroundColor: 'var(--report-navy)',
            }}
          />
        </div>

        {/* Affordable at Median Income */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" style={{ color: isAffordable ? 'var(--report-success)' : 'var(--report-warning)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--report-stone)' }}>
                Affordable at Area Median Income
              </span>
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ backgroundColor: 'var(--report-cream-dark)', color: 'var(--report-stone-light)' }}
              >
                {formatMetricValue(medianIncome, 'currency')}/yr
              </span>
            </div>
            <span
              className="text-lg font-bold tabular-nums"
              style={{ color: isAffordable ? 'var(--report-success)' : 'var(--report-stone)' }}
            >
              {formatMetricValue(affordablePrice, 'currency')}
            </span>
          </div>
          <div className="relative">
            <div
              className="h-4 rounded-full"
              style={{
                width: `${barPct(affordablePrice)}%`,
                backgroundColor: isAffordable ? 'var(--report-success)' : 'var(--report-warning)',
              }}
            />
          </div>
          {medianGap > 0 && (
            <p className="text-xs mt-1.5" style={{ color: 'var(--report-warning)' }}>
              {formatMetricValue(medianGap, 'currency')} short ({medianGapPct.toFixed(0)}% gap)
            </p>
          )}
          {medianGap <= 0 && (
            <p className="text-xs mt-1.5" style={{ color: 'var(--report-success)' }}>
              Within budget by {formatMetricValue(Math.abs(medianGap), 'currency')}
            </p>
          )}
        </div>

        {/* User's Income (if provided) */}
        {userAffordablePrice !== null && userIncome && (
          <>
            <div
              className="border-t my-1"
              style={{ borderColor: 'var(--report-cream-dark)' }}
            />
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" style={{ color: (userGap ?? 0) <= 0 ? 'var(--report-success)' : 'var(--report-navy)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--report-navy)' }}>
                    Affordable at Your Income
                  </span>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: 'var(--report-navy)', color: 'white' }}
                  >
                    {formatMetricValue(userIncome, 'currency')}/yr
                  </span>
                </div>
                <span
                  className="text-lg font-bold tabular-nums"
                  style={{
                    color: (userGap ?? 0) <= 0 ? 'var(--report-success)' : 'var(--report-navy)',
                    fontFamily: 'var(--report-font-display)',
                  }}
                >
                  {formatMetricValue(userAffordablePrice, 'currency')}
                </span>
              </div>
              <div
                className="h-4 rounded-full"
                style={{
                  width: `${barPct(userAffordablePrice)}%`,
                  backgroundColor: (userGap ?? 0) <= 0 ? 'var(--report-success)' : 'var(--report-navy)',
                  opacity: 0.8,
                }}
              />
              {userGap !== null && userGap > 0 && (
                <p className="text-xs mt-1.5" style={{ color: 'var(--report-warning)' }}>
                  {formatMetricValue(userGap, 'currency')} short ({userGapPct?.toFixed(0)}% gap)
                </p>
              )}
              {userGap !== null && userGap <= 0 && (
                <p className="text-xs mt-1.5" style={{ color: 'var(--report-success)' }}>
                  Within your budget by {formatMetricValue(Math.abs(userGap), 'currency')}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footnote */}
      <p
        className="text-xs mt-5 text-center"
        style={{ color: 'var(--report-stone-light)' }}
      >
        Based on the guideline that home prices should not exceed 4x annual household income
      </p>
    </div>
  );
}

export default AffordabilityAnalysis;
