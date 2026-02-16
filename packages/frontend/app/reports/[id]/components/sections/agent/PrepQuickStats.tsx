'use client';

import React from 'react';
import { BarChart3, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

import { SectionCard, ComponentScoreBadge } from '../core';
import { getMetricWithAliases, getMetricTrend } from '../../utils/metricHelpers';
import { formatMetricValue } from '@/lib/data';
import type { MetricFormat, ComponentStatus } from '@/lib/data';
import type { ReportInstance } from '../../../../types';

/**
 * Props for PrepQuickStats section
 */
export interface PrepQuickStatsProps {
  /** The full report data */
  report: ReportInstance;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Stat configuration for the dashboard
 */
interface StatConfig {
  metricId: string;
  label: string;
  format: MetricFormat;
}

/**
 * All stats to display in the quick dashboard
 */
const STAT_CONFIGS: StatConfig[] = [
  { metricId: 'zhvi', label: 'Median Price', format: 'currency' },
  { metricId: 'price_per_sqft', label: 'Price/Sqft', format: 'currency' },
  { metricId: 'home_value_yoy', label: 'YoY Change', format: 'percent' },
  { metricId: 'days_on_market', label: 'DOM', format: 'days' },
  { metricId: 'for_sale_inventory', label: 'Active Listings', format: 'number' },
  { metricId: 'pending_ratio', label: 'Pending Sales', format: 'percent' },
  { metricId: 'hotness_score', label: 'Hotness Score', format: 'number' },
  { metricId: 'price_reduced_share', label: 'Price Cuts', format: 'percent' },
  { metricId: 'median_income', label: 'Median Income', format: 'currency' },
  { metricId: 'cap_rate', label: 'Cap Rate', format: 'percent' },
];

/**
 * Derive ComponentStatus from a numeric score
 */
function getStatusFromScore(score: number): ComponentStatus {
  if (score >= 80) return 'excellent';
  if (score >= 65) return 'strong';
  if (score >= 45) return 'moderate';
  if (score >= 30) return 'watch';
  return 'concern';
}

/**
 * Get the trend arrow and color for a metric
 */
function getTrendDisplay(direction: 'up' | 'down' | 'stable'): {
  arrow: React.ReactNode;
  color: string;
} {
  switch (direction) {
    case 'up':
      return {
        arrow: <TrendingUp className="w-3 h-3" />,
        color: 'var(--report-success)',
      };
    case 'down':
      return {
        arrow: <TrendingDown className="w-3 h-3" />,
        color: 'var(--report-error)',
      };
    default:
      return {
        arrow: <Minus className="w-3 h-3" />,
        color: 'var(--report-stone)',
      };
  }
}

/**
 * PrepQuickStats - Dense stat dashboard for agent quick reference
 *
 * Displays a compact overview of key market metrics including:
 * - MarketHealth score badge
 * - 3-column grid of 8-10 stat cards with values and trend arrows
 * - Median price, price/sqft, YoY change, DOM, inventory, and more
 *
 * Uses the editorial design system from report-theme.css.
 */
export function PrepQuickStats({
  report,
  className = '',
}: PrepQuickStatsProps): React.ReactElement {
  // Get MarketHealth score and components
  const marketHealthScore =
    (report.scores_snapshot as any)?.markethealth_score ?? null;
  const marketHealthComponents =
    (report.scores_snapshot as any)?.markethealth_components ?? [];

  // Build stat data from configs
  const stats = STAT_CONFIGS.map((config) => {
    const value = getMetricWithAliases(report, config.metricId);
    const trend = getMetricTrend(report, config.metricId);
    return { ...config, value, trend };
  }).filter((stat) => stat.value !== null);

  const hasAnyData = stats.length > 0 || marketHealthScore !== null;

  if (!hasAnyData) {
    return (
      <SectionCard title="Quick Stats Dashboard" icon={BarChart3} className={className}>
        <div
          className="flex items-center justify-center gap-3 py-8"
          style={{ color: 'var(--report-stone-light)' }}
        >
          <AlertTriangle className="w-5 h-5" />
          <span className="report-body">Quick stats data is not available for this area.</span>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Quick Stats Dashboard" icon={BarChart3} className={className}>
      {/* MarketHealth Score Badge */}
      {marketHealthScore !== null && (
        <div
          style={{
            marginBottom: 'var(--report-space-md)',
            paddingBottom: 'var(--report-space-md)',
            borderBottom: '1px solid rgba(27, 46, 74, 0.06)',
          }}
        >
          <ComponentScoreBadge
            component="markethealth"
            score={Math.round(marketHealthScore)}
            label="Market Health"
            status={getStatusFromScore(marketHealthScore)}
          />
        </div>
      )}

      {/* Dense 3-column stat grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 'var(--report-space-xs)',
        }}
      >
        {stats.map((stat) => {
          const trendData = stat.trend
            ? getTrendDisplay(stat.trend.direction)
            : null;

          return (
            <div
              key={stat.metricId}
              className="rounded-[var(--report-radius-sm)]"
              style={{
                padding: 'var(--report-space-sm)',
                backgroundColor: 'var(--report-cream)',
                border: '1px solid rgba(27, 46, 74, 0.04)',
              }}
            >
              {/* Label */}
              <p
                className="text-[0.625rem] font-medium uppercase tracking-[0.04em]"
                style={{
                  color: 'var(--report-stone-light)',
                  margin: 0,
                  marginBottom: '2px',
                  lineHeight: 1.2,
                }}
              >
                {stat.label}
              </p>

              {/* Value + Trend */}
              <div className="flex items-center gap-1">
                <p
                  className="text-base font-semibold tracking-tight"
                  style={{
                    fontFamily: 'var(--report-font-display)',
                    color: 'var(--report-navy)',
                    margin: 0,
                    lineHeight: 1.3,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {formatMetricValue(stat.value!, stat.format)}
                </p>

                {trendData && (
                  <span
                    className="flex items-center"
                    style={{ color: trendData.color }}
                    aria-label={`Trend: ${stat.trend!.direction}`}
                  >
                    {trendData.arrow}
                  </span>
                )}
              </div>

              {/* Trend change percentage */}
              {stat.trend && (
                <p
                  className="text-[0.625rem] font-medium"
                  style={{
                    color:
                      stat.trend.direction === 'up'
                        ? 'var(--report-success)'
                        : stat.trend.direction === 'down'
                        ? 'var(--report-error)'
                        : 'var(--report-stone)',
                    margin: 0,
                  }}
                >
                  {stat.trend.changePct >= 0 ? '+' : ''}
                  {stat.trend.changePct.toFixed(1)}%
                </p>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

export default PrepQuickStats;
