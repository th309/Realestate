'use client';

import React from 'react';
import { TrendingUp, DollarSign, Percent, BarChart3, Home, Clock, Calculator } from 'lucide-react';

import { SectionCard, MetricDisplay, AIAnalysisBlock } from '../core';
import {
  getMetricValueWithAliases,
  getMetricTrend,
} from '../../utils/metricHelpers';
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

/**
 * Pool of investment-relevant metrics for the thesis section
 * We pick the first 6 that have data for this geography
 * Priority order: most important investment metrics first
 */
const METRICS_POOL: MetricConfig[] = [
  {
    id: 'cap_rate',
    aliases: ['capitalization_rate'],
    label: 'Cap Rate',
    icon: Percent,
  },
  {
    id: 'gross_yield',
    aliases: ['rent_to_price_ratio', 'rental_yield'],
    label: 'Gross Yield',
    icon: DollarSign,
  },
  {
    id: 'cash_on_cash',
    aliases: ['cash_on_cash_return', 'coc_return'],
    label: 'Cash-on-Cash',
    icon: Calculator,
  },
  {
    id: 'appreciation_rate',
    aliases: ['zhvi_yoy', 'home_value_yoy', 'price_growth_yoy'],
    label: 'Appreciation',
    icon: TrendingUp,
  },
  {
    id: 'grm',
    aliases: ['gross_rent_multiplier'],
    label: 'Gross Rent Multiplier',
    icon: BarChart3,
  },
  {
    id: 'rent_to_price',
    aliases: ['rent_to_price_ratio', 'price_to_rent'],
    label: 'Rent-to-Price',
    icon: Percent,
  },
  {
    id: 'home_value',
    aliases: ['zhvi', 'median_home_value'],
    label: 'Median Home Value',
    icon: Home,
  },
  {
    id: 'median_rent',
    aliases: ['zori', 'median_rental_price'],
    label: 'Median Rent',
    icon: DollarSign,
  },
  {
    id: 'days_on_market',
    aliases: ['dom', 'average_dom'],
    label: 'Days on Market',
    icon: Clock,
  },
  {
    id: 'vacancy_rate',
    aliases: ['rental_vacancy_rate'],
    label: 'Vacancy Rate',
    icon: Home,
  },
  {
    id: 'home_price_forecast',
    aliases: ['price_forecast', 'zhvf'],
    label: 'Price Forecast',
    icon: TrendingUp,
  },
  {
    id: 'rent_growth_yoy',
    aliases: ['zori_yoy', 'rental_growth'],
    label: 'Rent Growth YoY',
    icon: BarChart3,
  },
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
  if (score >= 80) return 'Strong Investment';
  if (score >= 70) return 'Good Opportunity';
  if (score >= 50) return 'Moderate Potential';
  if (score >= 30) return 'Higher Risk';
  return 'Challenging Market';
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

  // Gather metrics with their values and trends using shared helpers
  // Pick the first 6 metrics from the pool that have data
  const metricsWithData = METRICS_POOL.map((metric) => {
    const value = getMetricValueWithAliases(report, metric.id, metric.aliases);
    const trend = getMetricTrend(report, metric.id, metric.aliases);

    return {
      ...metric,
      value,
      trend,
    };
  })
    .filter((m) => m.value !== null)
    .slice(0, 6);

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
                <svg
                  width="160"
                  height="160"
                  viewBox="0 0 160 160"
                  role="img"
                  aria-label={`InvestorEdge Score: ${score} out of 100`}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-[var(--report-space-sm)]">
              {metricsWithData.map((metric) => (
                <MetricDisplay
                  key={metric.id}
                  metricId={metric.id}
                  value={metric.value}
                  label={metric.label}
                  trend={metric.trend}
                  compact
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
