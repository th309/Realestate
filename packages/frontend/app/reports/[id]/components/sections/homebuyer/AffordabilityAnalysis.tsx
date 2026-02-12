'use client';

import React from 'react';
import { Home, DollarSign, TrendingUp, AlertTriangle, Calculator } from 'lucide-react';

import { formatMetricValue } from '@/lib/data';
import { SectionCard, MetricDisplay, AIAnalysisBlock, TrendSparkline } from '../core';
import type { TrendDirection } from '../core';
import { getMetricWithAliases } from '../../utils/metricHelpers';
import type { ReportInstance } from '../../../../types';

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
  // Get key metrics with alias fallbacks
  const homeValue =
    getMetricWithAliases(report, 'zhvi') ??
    getMetricWithAliases(report, 'median_listing_price') ??
    getMetricWithAliases(report, 'home_value');

  const medianIncome =
    getMetricWithAliases(report, 'median_household_income') ??
    getMetricWithAliases(report, 'median_income');

  const affordabilityIndex = getMetricWithAliases(report, 'affordability_index');

  // Get historical trends if available
  const homeValueTrend = getHistoricalTrend(report, 'zhvi') ??
    getHistoricalTrend(report, 'home_value');
  const incomeTrend = getHistoricalTrend(report, 'median_household_income') ??
    getHistoricalTrend(report, 'median_income');

  // Get AI narrative if available
  const aiNarrative = report.ai_narrative?.affordability_analysis;

  // Handle case where no core data is available
  if (!homeValue && !medianIncome) {
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

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <MetricDisplay
          metricId="home_value"
          value={homeValue}
          label="Median Home Value"
          trend={homeValueTrend ? {
            direction: homeValueTrend.direction,
            changePct: homeValueTrend.changePct,
            sparklineData: homeValueTrend.sparklineData,
          } : undefined}
        />

        <MetricDisplay
          metricId="median_household_income"
          value={medianIncome}
          label="Median Household Income"
          trend={incomeTrend ? {
            direction: incomeTrend.direction,
            changePct: incomeTrend.changePct,
            sparklineData: incomeTrend.sparklineData,
          } : undefined}
        />

        {/* Price-to-Income Ratio or Affordability Index */}
        {affordabilityIndex !== null ? (
          <MetricDisplay
            metricId="affordability_index"
            value={affordabilityIndex}
            label="Affordability Index"
          />
        ) : (
          <div className="report-metric-card">
            <p className="report-metric-label">Price-to-Income Ratio</p>
            {priceToIncomeRatio !== null ? (
              <>
                <p className="report-metric-value">{priceToIncomeRatio.toFixed(1)}x</p>
                <p
                  className="text-xs mt-1"
                  style={{ color: 'var(--report-stone-light)' }}
                >
                  {priceToIncomeRatio <= 4 ? 'Within traditional limits' : 'Above 4x guideline'}
                </p>
              </>
            ) : (
              <p className="report-metric-value" style={{ opacity: 0.4 }}>
                &mdash;
              </p>
            )}
          </div>
        )}
      </div>

      {/* Affordability Gap Visualization */}
      {homeValue && affordablePrice && (
        <div
          className="rounded-[var(--report-radius-md)] p-5 mb-6"
          style={{ backgroundColor: 'var(--report-cream)' }}
        >
          <h4
            className="report-heading-sm mb-4"
            style={{ color: 'var(--report-navy)' }}
          >
            The Affordability Gap
          </h4>

          <div className="flex items-center justify-between mb-4">
            {/* Affordable Price */}
            <div className="text-center">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2"
                style={{ backgroundColor: 'var(--report-success-bg)' }}
              >
                <DollarSign
                  className="w-5 h-5"
                  style={{ color: 'var(--report-success)' }}
                />
              </div>
              <p
                className="text-xs font-medium uppercase tracking-wide mb-1"
                style={{ color: 'var(--report-stone-light)' }}
              >
                Affordable at 4x Income
              </p>
              <p
                className="text-xl font-semibold"
                style={{ color: 'var(--report-success)' }}
              >
                {formatMetricValue(affordablePrice, 'currency')}
              </p>
            </div>

            {/* Gap Bar */}
            <div className="flex-1 mx-6">
              <div
                className="h-3 rounded-full overflow-hidden"
                style={{ backgroundColor: 'var(--report-cream-dark)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${affordabilityBarWidth}%`,
                    backgroundColor: isAffordable
                      ? 'var(--report-success)'
                      : 'var(--report-error)',
                  }}
                />
              </div>
              {affordabilityGap !== null && !isAffordable && (
                <div className="flex justify-center mt-2">
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: 'var(--report-error-bg)',
                      color: 'var(--report-error)',
                    }}
                  >
                    Gap: {formatMetricValue(affordabilityGap, 'currency')}
                    {gapPercentage !== null && ` (${gapPercentage.toFixed(0)}% above)`}
                  </span>
                </div>
              )}
              {isAffordable && (
                <div className="flex justify-center mt-2">
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: 'var(--report-success-bg)',
                      color: 'var(--report-success)',
                    }}
                  >
                    Market is affordable
                  </span>
                </div>
              )}
            </div>

            {/* Median Price */}
            <div className="text-center">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2"
                style={{ backgroundColor: 'var(--report-cream-dark)' }}
              >
                <Home
                  className="w-5 h-5"
                  style={{ color: 'var(--report-navy)' }}
                />
              </div>
              <p
                className="text-xs font-medium uppercase tracking-wide mb-1"
                style={{ color: 'var(--report-stone-light)' }}
              >
                Median Home Price
              </p>
              <p
                className="text-xl font-semibold"
                style={{ color: 'var(--report-navy)' }}
              >
                {formatMetricValue(homeValue, 'currency')}
              </p>
            </div>
          </div>

          {/* Context about the 4x rule */}
          <p
            className="text-xs text-center"
            style={{ color: 'var(--report-stone-light)' }}
          >
            Based on the traditional guideline that home prices should not exceed 4x annual household income
          </p>
        </div>
      )}

      {/* Historical Trends Section */}
      {(homeValueTrend || incomeTrend) && (
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
                <p
                  className="text-xs font-medium uppercase tracking-wide mb-2"
                  style={{ color: 'var(--report-stone-light)' }}
                >
                  Home Value Trend
                </p>
                <TrendSparkline
                  data={homeValueTrend.sparklineData}
                  trend={homeValueTrend.direction}
                  changePct={homeValueTrend.changePct}
                  width={120}
                  height={32}
                />
              </div>
            )}
            {incomeTrend && (
              <div
                className="p-4 rounded-[var(--report-radius-md)]"
                style={{ backgroundColor: 'var(--report-cream)' }}
              >
                <p
                  className="text-xs font-medium uppercase tracking-wide mb-2"
                  style={{ color: 'var(--report-stone-light)' }}
                >
                  Income Trend
                </p>
                <TrendSparkline
                  data={incomeTrend.sparklineData}
                  trend={incomeTrend.direction}
                  changePct={incomeTrend.changePct}
                  width={120}
                  height={32}
                />
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

      {/* Key Takeaway for Homebuyers */}
      {homeValue && medianIncome && !aiNarrative && (
        <div
          className="mt-4 p-4 rounded-[var(--report-radius-md)] border-l-4"
          style={{
            backgroundColor: 'var(--report-cream)',
            borderLeftColor: 'var(--report-gold)',
          }}
        >
          <p
            className="text-sm font-medium mb-1"
            style={{ color: 'var(--report-navy)' }}
          >
            What This Means For You
          </p>
          <p
            className="text-sm"
            style={{ color: 'var(--report-stone)' }}
          >
            {isAffordable
              ? `At ${priceToIncomeRatio?.toFixed(1)}x the median income, this market offers good affordability for homebuyers. A household earning the median income could reasonably afford the typical home.`
              : `At ${priceToIncomeRatio?.toFixed(1)}x the median income, homebuyers may need to save more for a down payment, consider homes below the median price, or look at nearby more affordable areas.`}
          </p>
        </div>
      )}
    </SectionCard>
  );
}

export default AffordabilityAnalysis;
