'use client';

import React from 'react';
import { Home, TrendingUp, Clock, PiggyBank, DollarSign, Activity, BarChart3 } from 'lucide-react';

import { formatMetricValue } from '@/lib/data';
import { SectionCard, MetricDisplay, AIAnalysisBlock, TrendSparkline } from '../core';
import type { MetricTrend } from '../core';
import { getMetricWithAliases, getMetricTrend, getScoreContext } from '../../utils/metricHelpers';
import type { ReportInstance } from '../../../../types';

export interface ExecutiveSummaryProps {
  report: ReportInstance;
}

/**
 * Metric configuration for the executive summary
 */
interface MetricConfig {
  id: string;
  aliases: string[];
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * Pool of homebuyer-relevant metrics for executive summary
 * We'll pick the first 6 that have data for this geography
 */
/**
 * Metrics pool using registry IDs directly - no aliases needed
 * Priority order: most commonly available first
 */
const METRICS_POOL: MetricConfig[] = [
  { id: 'home_value', aliases: [], label: 'Median Home Value', icon: Home },
  { id: 'days_on_market', aliases: [], label: 'Days on Market', icon: Clock },
  { id: 'hotness_score', aliases: [], label: 'Market Hotness', icon: Activity },
  { id: 'for_sale_inventory', aliases: [], label: 'Active Listings', icon: BarChart3 },
  { id: 'new_listings', aliases: [], label: 'New Listings', icon: BarChart3 },
  { id: 'price_cut_pct', aliases: [], label: 'Price Cuts', icon: DollarSign },
  { id: 'median_income', aliases: [], label: 'Median Income', icon: DollarSign },
  { id: 'home_value_yoy', aliases: [], label: 'Price YoY', icon: TrendingUp },
  { id: 'inventory_yoy', aliases: [], label: 'Inventory YoY', icon: BarChart3 },
  { id: 'home_price_forecast', aliases: [], label: 'Price Forecast', icon: TrendingUp },
  { id: 'sale_to_list', aliases: [], label: 'Sale-to-List', icon: Activity },
  { id: 'affordability_index', aliases: [], label: 'Affordability', icon: PiggyBank },
];

function getScoreColorClass(score: number): string {
  if (score >= 70) return 'text-[var(--report-success)]';
  if (score >= 50) return 'text-[var(--report-warning)]';
  return 'text-[var(--report-error)]';
}

function getScoreStrokeColor(score: number): string {
  if (score >= 70) return 'var(--report-success)';
  if (score >= 50) return 'var(--report-warning)';
  return 'var(--report-error)';
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Moderate';
  if (score >= 30) return 'Below Average';
  return 'Challenging';
}

function getScoreGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C+';
  if (score >= 50) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

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
 * ExecutiveSummary - Comprehensive overview for HomeReady report
 *
 * Displays:
 * - HomeReady Score with grade and contextualization
 * - Score interpretation (what it means, dollar impact, peer comparison)
 * - 3-6 key market indicators with trends
 * - AI-generated market summary
 */
export function ExecutiveSummary({ report }: ExecutiveSummaryProps): React.ReactElement {
  const score = report.homeready_score;
  const marketSummary = report.ai_narrative?.market_summary || report.ai_narrative?.market_story;

  // Get score context for in-depth interpretation
  const scoreContext = getScoreContext(report as any, 'homeready');

  // Gather metrics - check all in pool, pick first 6 with data
  const metricsWithData = METRICS_POOL.map((metric) => {
    // Get value from current data or historical
    let value = report.populated_data?.current?.[metric.id] ?? null;
    if (value !== null) value = Number(value);

    // Try historical data if no current value
    if (value === null) {
      const histData = report.populated_data?.historical?.[metric.id];
      if (histData && histData.data && histData.data.length > 0) {
        value = histData.data[histData.data.length - 1].value;
      }
    }

    const historicalData = report.populated_data?.historical?.[metric.id];
    const trend = calculateTrend(historicalData);

    return {
      ...metric,
      value,
      trend,
    };
  }).filter((m) => m.value !== null).slice(0, 6);

  // Get historical trends for sparklines section
  // Check both zhvi and home_value keys for compatibility
  const zhviTrend = report.populated_data?.historical?.zhvi ??
    report.populated_data?.historical?.home_value;
  const domTrend = report.populated_data?.historical?.days_on_market;

  const hasScore = score !== null && score !== undefined;
  const hasMetrics = metricsWithData.length > 0;
  const hasSummary = marketSummary && marketSummary.trim() !== '';

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
        {/* HomeReady Score Section with Context */}
        {hasScore && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-[var(--report-space-lg)]">
            {/* Score Ring and Label */}
            <div className="flex flex-col items-center text-center">
              <div className="relative" style={{ width: 160, height: 160 }}>
                <svg
                  width="160"
                  height="160"
                  viewBox="0 0 160 160"
                  role="img"
                  aria-label={`HomeReady Score: ${score} out of 100`}
                >
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    fill="none"
                    stroke="var(--report-cream-dark)"
                    strokeWidth="12"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    fill="none"
                    stroke={getScoreStrokeColor(score)}
                    strokeWidth="12"
                    strokeDasharray={`${(score / 100) * 440} 440`}
                    strokeLinecap="round"
                    style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span
                    className={`text-4xl font-bold ${getScoreColorClass(score)}`}
                    style={{ fontFamily: 'var(--report-font-display)' }}
                  >
                    {score}
                  </span>
                  <span className="report-label mt-1">HomeReady</span>
                </div>
              </div>

              <div className="mt-4">
                <span
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
                  style={{
                    backgroundColor: score >= 70 ? 'var(--report-success-bg)' : score >= 50 ? 'var(--report-warning-bg)' : 'var(--report-error-bg)',
                    color: getScoreStrokeColor(score),
                  }}
                >
                  Grade: {getScoreGrade(score)} • {getScoreLabel(score)}
                </span>
              </div>
            </div>

            {/* Score Interpretation */}
            <div className="lg:col-span-2 space-y-4">
              <div>
                <h3 className="report-heading-md mb-2">{report.primary_geography_name}</h3>
                <p className="report-body">
                  {scoreContext?.interpretation ||
                    `The HomeReady Score evaluates affordability, market stability, value potential, and buyer competition to help you understand how favorable this market is for purchasing a home.`}
                </p>
              </div>

              {/* Score Context Cards */}
              {scoreContext && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {scoreContext.percentileText && (
                    <div
                      className="p-3 rounded-lg"
                      style={{ backgroundColor: 'var(--report-cream)' }}
                    >
                      <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--report-stone-light)' }}>
                        Peer Comparison
                      </p>
                      <p className="text-sm font-medium" style={{ color: 'var(--report-navy)' }}>
                        {scoreContext.percentileText}
                      </p>
                    </div>
                  )}

                  {scoreContext.dollarImpact && (
                    <div
                      className="p-3 rounded-lg"
                      style={{ backgroundColor: 'var(--report-success-bg)' }}
                    >
                      <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--report-stone-light)' }}>
                        Dollar Impact
                      </p>
                      <p className="text-sm font-medium" style={{ color: 'var(--report-success)' }}>
                        {scoreContext.dollarImpact}
                      </p>
                    </div>
                  )}

                  {scoreContext.comparison && (
                    <div
                      className="p-3 rounded-lg sm:col-span-2"
                      style={{ backgroundColor: 'var(--report-cream)' }}
                    >
                      <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--report-stone-light)' }}>
                        Market Position
                      </p>
                      <p className="text-sm font-medium" style={{ color: 'var(--report-navy)' }}>
                        {scoreContext.comparison}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Key Market Indicators - Show up to 6 */}
        {hasMetrics && (
          <div>
            <h4 className="report-label mb-[var(--report-space-md)]">Key Market Indicators</h4>
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

        {/* Historical Trends Section - Show 2 sparklines */}
        {(zhviTrend || domTrend) && (
          <div>
            <h4 className="report-label mb-[var(--report-space-md)]">6-Month Trends</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {zhviTrend && zhviTrend.data && zhviTrend.data.length >= 2 && (
                <div
                  className="p-4 rounded-lg"
                  style={{ backgroundColor: 'var(--report-cream)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium" style={{ color: 'var(--report-navy)' }}>
                      Home Values
                    </p>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        zhviTrend.trend === 'up'
                          ? 'bg-[var(--report-success-bg)] text-[var(--report-success)]'
                          : zhviTrend.trend === 'down'
                          ? 'bg-[var(--report-error-bg)] text-[var(--report-error)]'
                          : 'bg-[var(--report-cream-dark)] text-[var(--report-stone)]'
                      }`}
                    >
                      {zhviTrend.change_pct >= 0 ? '+' : ''}{zhviTrend.change_pct.toFixed(1)}%
                    </span>
                  </div>
                  <TrendSparkline
                    data={zhviTrend.data.map(d => d.value)}
                    trend={zhviTrend.trend}
                    changePct={zhviTrend.change_pct}
                    width={200}
                    height={40}
                  />
                  <div className="flex justify-between mt-2 text-xs" style={{ color: 'var(--report-stone-light)' }}>
                    <span>{formatMetricValue(zhviTrend.data[0].value, 'currency')}</span>
                    <span>{formatMetricValue(zhviTrend.data[zhviTrend.data.length - 1].value, 'currency')}</span>
                  </div>
                </div>
              )}

              {domTrend && domTrend.data && domTrend.data.length >= 2 && (
                <div
                  className="p-4 rounded-lg"
                  style={{ backgroundColor: 'var(--report-cream)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium" style={{ color: 'var(--report-navy)' }}>
                      Days on Market
                    </p>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        domTrend.trend === 'up'
                          ? 'bg-[var(--report-warning-bg)] text-[var(--report-warning)]'
                          : domTrend.trend === 'down'
                          ? 'bg-[var(--report-success-bg)] text-[var(--report-success)]'
                          : 'bg-[var(--report-cream-dark)] text-[var(--report-stone)]'
                      }`}
                    >
                      {domTrend.change_pct >= 0 ? '+' : ''}{domTrend.change_pct.toFixed(0)}%
                    </span>
                  </div>
                  <TrendSparkline
                    data={domTrend.data.map(d => d.value)}
                    trend={domTrend.trend}
                    changePct={domTrend.change_pct}
                    width={200}
                    height={40}
                  />
                  <div className="flex justify-between mt-2 text-xs" style={{ color: 'var(--report-stone-light)' }}>
                    <span>{Math.round(domTrend.data[0].value)} days</span>
                    <span>{Math.round(domTrend.data[domTrend.data.length - 1].value)} days</span>
                  </div>
                </div>
              )}
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
