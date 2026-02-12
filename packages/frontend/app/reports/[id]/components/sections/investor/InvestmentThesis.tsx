'use client';

import React from 'react';
import { TrendingUp, DollarSign, Percent, BarChart3 } from 'lucide-react';

import { SectionCard, MetricDisplay, AIAnalysisBlock } from '../core';
import type { MetricTrend } from '../core';
import { getMetricWithAliases } from '../../utils/metricHelpers';
import type { ReportInstance } from '../../../../types';

export interface InvestmentThesisProps {
  /** The full report data */
  report: ReportInstance;
}

/**
 * Metric configuration for investment thesis section
 */
interface MetricConfig {
  id: string;
  aliases: string[];
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const METRICS: MetricConfig[] = [
  {
    id: 'cap_rate',
    aliases: [],
    label: 'Cap Rate',
    icon: Percent,
  },
  {
    id: 'gross_yield',
    aliases: ['rent_to_price_ratio'],
    label: 'Gross Yield',
    icon: DollarSign,
  },
  {
    id: 'appreciation_rate',
    aliases: ['zhvi_yoy', 'home_value_yoy'],
    label: 'Appreciation Rate',
    icon: BarChart3,
  },
];

/**
 * Extended metric aliases for investment-specific lookups
 */
const INVESTMENT_METRIC_ALIASES: Record<string, string[]> = {
  cap_rate: ['cap_rate', 'capitalization_rate'],
  gross_yield: ['gross_yield', 'rent_to_price_ratio', 'rental_yield'],
  appreciation_rate: ['appreciation_rate', 'zhvi_yoy', 'home_value_yoy', 'price_growth_yoy'],
};

/**
 * Get a metric value with investment-specific alias fallbacks
 */
function getInvestmentMetric(
  report: ReportInstance,
  metricId: string
): number | null {
  // Try primary metric ID via standard helper
  const primaryValue = getMetricWithAliases(report, metricId);
  if (primaryValue !== null) {
    return primaryValue;
  }

  // Try investment-specific aliases
  const aliases = INVESTMENT_METRIC_ALIASES[metricId] || [];
  for (const alias of aliases) {
    const value = report.populated_data?.current?.[alias];
    if (value !== undefined && value !== null) {
      return Number(value);
    }
  }

  return null;
}

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
  if (score >= 80) return 'Strong Investment';
  if (score >= 70) return 'Good Opportunity';
  if (score >= 50) return 'Moderate Potential';
  if (score >= 30) return 'Higher Risk';
  return 'Challenging Market';
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
 * InvestmentThesis - The opening section of the InvestorEdge report
 *
 * Displays the InvestorEdge Score prominently along with key investment metrics
 * (cap rate, gross yield, appreciation rate) and an AI-generated investment
 * thesis. Uses the editorial design system from report-theme.css.
 *
 * @example
 * ```tsx
 * import { InvestmentThesis } from './investor/InvestmentThesis';
 *
 * <InvestmentThesis report={reportData} />
 * ```
 */
export function InvestmentThesis({
  report,
}: InvestmentThesisProps): React.ReactElement {
  const score = report.investoredge_score;
  // Score context may be stored in extended score data
  const scoreData = report.populated_data?.scores?.investoredge;
  const scoreContext = (scoreData as { context?: string } | undefined)?.context;
  const investmentAnalysis = report.ai_narrative?.investment_analysis;

  // Gather metrics with their values and trends
  const metricsWithData = METRICS.map((metric) => {
    const value = getInvestmentMetric(report, metric.id);

    // Try multiple keys for historical data
    let historicalData = report.populated_data?.historical?.[metric.id];
    if (!historicalData) {
      const aliases = INVESTMENT_METRIC_ALIASES[metric.id] || [];
      for (const alias of aliases) {
        historicalData = report.populated_data?.historical?.[alias];
        if (historicalData) break;
      }
    }

    const trend = calculateTrend(historicalData);

    return {
      ...metric,
      value,
      trend,
    };
  }).filter((m) => m.value !== null);

  const hasScore = score !== null && score !== undefined;
  const hasMetrics = metricsWithData.length > 0;
  const hasAnalysis = investmentAnalysis && investmentAnalysis.trim() !== '';

  // If no data at all, show a minimal message
  if (!hasScore && !hasMetrics && !hasAnalysis) {
    return (
      <SectionCard title="Investment Thesis" icon={TrendingUp}>
        <div className="flex items-center justify-center py-12">
          <p className="report-body text-[var(--report-stone-light)]">
            Report data is being generated. Please check back shortly.
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Investment Thesis" icon={TrendingUp}>
      <div className="space-y-[var(--report-space-xl)]">
        {/* InvestorEdge Score Section */}
        {hasScore && (
          <div className="flex flex-col md:flex-row items-center gap-[var(--report-space-xl)]">
            {/* Score Ring */}
            <div className="flex-shrink-0">
              <div className="report-score-ring" style={{ width: 160, height: 160 }}>
                <svg width="160" height="160" viewBox="0 0 160 160">
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
                  <span className="report-label mt-1">InvestorEdge</span>
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
                {getScoreLabel(score)}
              </p>
              <p className="report-body">
                {scoreContext ||
                  'The InvestorEdge Score evaluates cash flow potential, appreciation outlook, risk factors, and market liquidity to help you assess the investment viability of this market.'}
              </p>
            </div>
          </div>
        )}

        {/* Key Investment Metrics Grid */}
        {hasMetrics && (
          <div>
            <h4 className="report-label mb-[var(--report-space-md)]">Key Investment Metrics</h4>
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

        {/* AI Investment Analysis */}
        {hasAnalysis && (
          <AIAnalysisBlock
            title="Investment Analysis"
            content={investmentAnalysis}
            variant="insight"
          />
        )}
      </div>
    </SectionCard>
  );
}

export default InvestmentThesis;
