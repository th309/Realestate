'use client';

import React from 'react';
import { Home, TrendingUp, Clock, PiggyBank } from 'lucide-react';

import { SectionCard, MetricDisplay, AIAnalysisBlock } from '../core';
import type { MetricTrend } from '../core';
import { getMetricWithAliases } from '../../utils/metricHelpers';
import type { ReportInstance } from '../../../../types';

export interface ExecutiveSummaryProps {
  /** The full report data */
  report: ReportInstance;
}

/**
 * Metric configuration for the executive summary
 */
interface MetricConfig {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const METRICS: MetricConfig[] = [
  { id: 'zhvi', label: 'Median Home Value', icon: Home },
  { id: 'days_on_market', label: 'Days on Market', icon: Clock },
  { id: 'affordability_index', label: 'Affordability Index', icon: PiggyBank },
];

/**
 * Get score color class based on score value
 */
function getScoreColorClass(score: number): string {
  if (score >= 70) return 'text-[var(--report-success)]';
  if (score >= 50) return 'text-[var(--report-warning)]';
  return 'text-[var(--report-error)]';
}

/**
 * Get score ring stroke color based on score value
 */
function getScoreStrokeColor(score: number): string {
  if (score >= 70) return 'var(--report-success)';
  if (score >= 50) return 'var(--report-warning)';
  return 'var(--report-error)';
}

/**
 * Get score label based on score value
 */
function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Moderate';
  if (score >= 30) return 'Below Average';
  return 'Challenging';
}

/**
 * Calculate trend data from historical time series
 */
function calculateTrend(
  historicalData?: {
    data: Array<{ date: string; value: number }>;
    trend: 'up' | 'down' | 'stable';
    change_pct: number;
  }
): MetricTrend | undefined {
  if (!historicalData || !historicalData.data || historicalData.data.length < 2) {
    return undefined;
  }

  return {
    direction: historicalData.trend,
    changePct: historicalData.change_pct,
    sparklineData: historicalData.data.map((point) => point.value),
  };
}

/**
 * ExecutiveSummary - The first page of the HomeReady report for homebuyers
 *
 * Displays the HomeReady Score prominently along with key market metrics
 * and an AI-generated market summary. Uses the editorial design system
 * from report-theme.css.
 *
 * @example
 * ```tsx
 * import { ExecutiveSummary } from './homebuyer/ExecutiveSummary';
 *
 * <ExecutiveSummary report={reportData} />
 * ```
 */
export function ExecutiveSummary({
  report,
}: ExecutiveSummaryProps): React.ReactElement {
  const score = report.homeready_score;
  const marketSummary = report.ai_narrative?.market_summary;

  // Gather metrics with their values and trends
  const metricsWithData = METRICS.map((metric) => {
    const value = getMetricWithAliases(report, metric.id);
    const historicalData = report.populated_data?.historical?.[metric.id];
    const trend = calculateTrend(historicalData);

    return {
      ...metric,
      value,
      trend,
    };
  }).filter((m) => m.value !== null);

  const hasScore = score !== null && score !== undefined;
  const hasMetrics = metricsWithData.length > 0;
  const hasSummary = marketSummary && marketSummary.trim() !== '';

  // If no data at all, show a minimal message
  if (!hasScore && !hasMetrics && !hasSummary) {
    return (
      <SectionCard title="Executive Summary" icon={TrendingUp}>
        <div className="flex items-center justify-center py-12">
          <p className="report-body text-[var(--report-stone-light)]">
            Report data is being generated. Please check back shortly.
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Executive Summary" icon={TrendingUp}>
      <div className="space-y-[var(--report-space-xl)]">
        {/* HomeReady Score Section */}
        {hasScore && (
          <div className="flex flex-col md:flex-row items-center gap-[var(--report-space-xl)]">
            {/* Score Ring */}
            <div className="flex-shrink-0">
              <div className="report-score-ring" style={{ width: 160, height: 160 }}>
                <svg
                  width="160"
                  height="160"
                  viewBox="0 0 160 160"
                  role="img"
                  aria-label={`HomeReady Score: ${score} out of 100`}
                >
                  {/* Background ring */}
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    className="report-score-ring-bg"
                    strokeWidth="12"
                  />
                  {/* Progress ring */}
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    className="report-score-ring-progress"
                    stroke={getScoreStrokeColor(score)}
                    strokeWidth="12"
                    strokeDasharray={`${(score / 100) * 440} 440`}
                    strokeLinecap="round"
                  />
                </svg>
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center"
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                >
                  <span
                    className={`text-4xl font-bold ${getScoreColorClass(score)}`}
                    style={{ fontFamily: 'var(--report-font-display)' }}
                  >
                    {score}
                  </span>
                  <span className="report-label mt-1">HomeReady</span>
                </div>
              </div>
            </div>

            {/* Score Description */}
            <div className="flex-1 text-center md:text-left">
              <h3 className="report-heading-md mb-[var(--report-space-sm)]">
                {report.primary_geography_name}
              </h3>
              <p
                className={`text-lg font-semibold ${getScoreColorClass(score)} mb-[var(--report-space-sm)]`}
              >
                {getScoreLabel(score)} for Homebuyers
              </p>
              <p className="report-body">
                The HomeReady Score evaluates affordability, market stability, value
                potential, and buyer competition to help you understand how favorable
                this market is for purchasing a home.
              </p>
            </div>
          </div>
        )}

        {/* Key Metrics Grid */}
        {hasMetrics && (
          <div>
            <h4 className="report-label mb-[var(--report-space-md)]">Key Market Indicators</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[var(--report-space-md)]">
              {metricsWithData.map((metric) => (
                <MetricDisplay
                  key={metric.id}
                  metricId={metric.id}
                  value={metric.value}
                  label={metric.label}
                  trend={metric.trend}
                />
              ))}
            </div>
          </div>
        )}

        {/* AI Market Summary */}
        {hasSummary && (
          <AIAnalysisBlock
            title="Market Overview"
            content={marketSummary}
            variant="summary"
          />
        )}
      </div>
    </SectionCard>
  );
}

export default ExecutiveSummary;
