'use client';

import React from 'react';
import { Home, TrendingUp, Clock, PiggyBank, DollarSign, Activity, BarChart3, Sparkles } from 'lucide-react';

import { formatMetricValue } from '@/lib/data';
import { SectionCard, MetricDisplay, TrendSparkline } from '../core';
import type { MetricTrend } from '../core';
import { getMetricWithAliases, getMetricTrend, getScoreContext } from '../../utils/metricHelpers';
import { getScoreStrokeColor, getScoreLabel, getScoreGrade } from '../../utils/scoreHelpers';
import type { ReportInstance } from '../../../../types';

export interface ExecutiveSummaryProps {
  report: ReportInstance;
}

interface MetricConfig {
  id: string;
  aliases: string[];
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

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

export function ExecutiveSummary({ report }: ExecutiveSummaryProps): React.ReactElement {
  const score = report.homeready_score;
  const marketSummary = report.ai_narrative?.market_summary || report.ai_narrative?.market_story;

  const scoreContext = getScoreContext(report as any, 'homeready');

  const metricsWithData = METRICS_POOL.map((metric) => {
    let value = report.populated_data?.current?.[metric.id] ?? null;
    if (value !== null) value = Number(value);

    if (value === null) {
      const histData = report.populated_data?.historical?.[metric.id];
      if (histData && histData.data && histData.data.length > 0) {
        value = histData.data[histData.data.length - 1].value;
      }
    }

    const historicalData = report.populated_data?.historical?.[metric.id];
    const trend = calculateTrend(historicalData);

    return { ...metric, value, trend };
  }).filter((m) => m.value !== null).slice(0, 6);

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

  // Split AI summary into paragraphs for better rendering
  const summaryParagraphs = hasSummary
    ? (marketSummary as string).split(/\n\n|\n/).filter(p => p.trim())
    : [];

  return (
    <SectionCard title="Executive Summary" icon={TrendingUp}>
      <div className="space-y-[var(--report-space-xl)]">

        {/* HERO: Score + AI Analysis side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-[var(--report-space-lg)]">

          {/* Score Ring - compact, left column */}
          {hasScore && (
            <div className="flex flex-col items-center text-center lg:pt-2">
              <div className="relative" style={{ width: 140, height: 140 }}>
                <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label={`HomeReady Score: ${score} out of 100`}>
                  <circle cx="70" cy="70" r="60" fill="none" stroke="var(--report-cream-dark)" strokeWidth="10" />
                  <circle
                    cx="70" cy="70" r="60" fill="none"
                    stroke={getScoreStrokeColor(score)} strokeWidth="10"
                    strokeDasharray={`${(score / 100) * 377} 377`}
                    strokeLinecap="round"
                    style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span
                    className={`text-3xl font-bold ${getScoreColorClass(score)}`}
                    style={{ fontFamily: 'var(--report-font-display)' }}
                  >
                    {score}
                  </span>
                  <span className="report-label mt-0.5 text-[10px]">HomeReady</span>
                </div>
              </div>
              <span
                className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: score >= 70 ? 'var(--report-success-bg)' : score >= 50 ? 'var(--report-warning-bg)' : 'var(--report-error-bg)',
                  color: getScoreStrokeColor(score),
                }}
              >
                {getScoreGrade(score)} · {getScoreLabel(score)}
              </span>
            </div>
          )}

          {/* AI Analysis - the hero content */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <h3
                className="text-xl font-semibold"
                style={{ color: 'var(--report-navy)', fontFamily: 'var(--report-font-display)' }}
              >
                {report.primary_geography_name}
              </h3>
              {hasSummary && (
                <span
                  className="flex items-center gap-1 text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--report-cream-dark)', color: 'var(--report-stone-light)' }}
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  AI
                </span>
              )}
            </div>

            {hasSummary ? (
              <div className="space-y-3">
                {summaryParagraphs.map((paragraph, i) => (
                  <p
                    key={i}
                    className="text-[0.9375rem] leading-[1.7]"
                    style={{ color: i === 0 ? 'var(--report-navy)' : 'var(--report-stone)' }}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            ) : (
              <p className="report-body">
                {scoreContext?.interpretation ||
                  'The HomeReady Score evaluates affordability, market stability, value potential, and buyer competition to help you understand how favorable this market is for purchasing a home.'}
              </p>
            )}

            {/* Context cards inline under the narrative */}
            {scoreContext && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                {scoreContext.percentileText && (
                  <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--report-cream)' }}>
                    <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--report-stone-light)' }}>
                      Peer Comparison
                    </p>
                    <p className="text-sm font-medium" style={{ color: 'var(--report-navy)' }}>
                      {scoreContext.percentileText}
                    </p>
                  </div>
                )}
                {scoreContext.dollarImpact && (
                  <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--report-success-bg)' }}>
                    <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--report-stone-light)' }}>
                      Dollar Impact
                    </p>
                    <p className="text-sm font-medium" style={{ color: 'var(--report-success)' }}>
                      {scoreContext.dollarImpact}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Key Market Indicators */}
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

        {/* Historical Trends */}
        {(zhviTrend || domTrend) && (
          <div>
            <h4 className="report-label mb-[var(--report-space-md)]">6-Month Trends</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {zhviTrend && zhviTrend.data && zhviTrend.data.length >= 2 && (
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--report-cream)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium" style={{ color: 'var(--report-navy)' }}>Home Values</p>
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
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--report-cream)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium" style={{ color: 'var(--report-navy)' }}>Days on Market</p>
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
      </div>
    </SectionCard>
  );
}

export default ExecutiveSummary;
