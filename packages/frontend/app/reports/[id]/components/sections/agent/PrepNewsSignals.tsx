'use client';

import React from 'react';
import {
  Newspaper,
  TrendingUp,
  TrendingDown,
  Minus,
  Package,
  Users,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { SectionCard, AIAnalysisBlock } from '../core';
import { getMetricWithAliases } from '../../utils/metricHelpers';
import type { ReportInstance } from '../../../../types';

/**
 * Props for PrepNewsSignals section
 */
export interface PrepNewsSignalsProps {
  /** The full report data */
  report: ReportInstance;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * A news item from report data
 */
interface NewsItem {
  title: string;
  summary?: string;
  date?: string;
  source?: string;
}

/**
 * A derived market signal
 */
interface MarketSignal {
  label: string;
  status: 'improving' | 'stable' | 'declining';
  icon: LucideIcon;
  detail: string;
}

/**
 * Helper to safely get a metric value trying common aliases
 */
function getMetric(
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
 * Get news items from report data
 */
function getNewsItems(report: ReportInstance): NewsItem[] {
  const newsData =
    report.populated_data?.news ??
    (report as any).news_events;

  if (!Array.isArray(newsData)) return [];

  return newsData
    .filter(
      (item: any) => item && typeof item === 'object' && typeof item.title === 'string'
    )
    .map((item: any) => ({
      title: item.title,
      summary: item.summary || item.description || undefined,
      date: item.date || item.published_at || undefined,
      source: item.source || item.publisher || undefined,
    }));
}

/**
 * Derive market signals from metric data
 */
function deriveMarketSignals(report: ReportInstance): MarketSignal[] {
  const signals: MarketSignal[] = [];

  // Price Momentum
  const yoyChange = getMetric(report, ['home_value_yoy', 'zhvi_yoy', 'price_yoy']);
  if (yoyChange !== null) {
    let status: 'improving' | 'stable' | 'declining';
    let detail: string;

    if (yoyChange > 3) {
      status = 'improving';
      detail = `Prices rising ${yoyChange.toFixed(1)}% YoY — strong appreciation`;
    } else if (yoyChange >= -1) {
      status = 'stable';
      detail = `Prices ${yoyChange >= 0 ? 'up' : 'down'} ${Math.abs(yoyChange).toFixed(1)}% YoY — stable`;
    } else {
      status = 'declining';
      detail = `Prices down ${Math.abs(yoyChange).toFixed(1)}% YoY — correction underway`;
    }

    signals.push({
      label: 'Price Momentum',
      status,
      icon: DollarSign,
      detail,
    });
  }

  // Supply Trend
  const inventory = getMetric(report, ['for_sale_inventory', 'active_listing_count', 'active_listings']);
  const monthsOfSupply = getMetric(report, ['months_of_supply', 'supply_months']);
  if (inventory !== null || monthsOfSupply !== null) {
    let status: 'improving' | 'stable' | 'declining';
    let detail: string;

    if (monthsOfSupply !== null) {
      if (monthsOfSupply > 6) {
        status = 'improving'; // More supply = improving for buyers
        detail = `${monthsOfSupply.toFixed(1)} months of supply — buyer-friendly levels`;
      } else if (monthsOfSupply >= 3) {
        status = 'stable';
        detail = `${monthsOfSupply.toFixed(1)} months of supply — balanced inventory`;
      } else {
        status = 'declining'; // Low supply = declining for buyers
        detail = `${monthsOfSupply.toFixed(1)} months of supply — tight inventory`;
      }
    } else {
      status = 'stable';
      detail = `${inventory} active listings on market`;
    }

    signals.push({
      label: 'Supply Trend',
      status,
      icon: Package,
      detail,
    });
  }

  // Demand Indicators
  const pendingRatio = getMetric(report, ['pending_ratio', 'pending_listing_count']);
  const dom = getMetric(report, ['days_on_market', 'median_dom', 'dom']);
  if (pendingRatio !== null || dom !== null) {
    let status: 'improving' | 'stable' | 'declining';
    let detail: string;

    if (dom !== null) {
      if (dom <= 21) {
        status = 'improving';
        detail = `${Math.round(dom)} days on market — high demand, fast absorption`;
      } else if (dom <= 45) {
        status = 'stable';
        detail = `${Math.round(dom)} days on market — normal demand levels`;
      } else {
        status = 'declining';
        detail = `${Math.round(dom)} days on market — demand softening`;
      }
    } else if (pendingRatio !== null) {
      if (pendingRatio > 0.5) {
        status = 'improving';
        detail = 'High pending-to-active ratio — strong buyer activity';
      } else if (pendingRatio > 0.2) {
        status = 'stable';
        detail = 'Moderate pending-to-active ratio — steady demand';
      } else {
        status = 'declining';
        detail = 'Low pending-to-active ratio — buyers are hesitant';
      }
    } else {
      status = 'stable';
      detail = 'Demand indicators are within normal ranges';
    }

    signals.push({
      label: 'Demand Indicators',
      status,
      icon: Users,
      detail,
    });
  }

  // Seller Sentiment
  const priceCuts = getMetric(report, ['price_reduced_share', 'price_cut_pct']);
  if (priceCuts !== null) {
    let status: 'improving' | 'stable' | 'declining';
    let detail: string;

    if (priceCuts < 10) {
      status = 'improving';
      detail = `Only ${priceCuts.toFixed(0)}% with price cuts — sellers confident`;
    } else if (priceCuts < 25) {
      status = 'stable';
      detail = `${priceCuts.toFixed(0)}% with price cuts — normal adjustment`;
    } else {
      status = 'declining';
      detail = `${priceCuts.toFixed(0)}% with price cuts — sellers losing confidence`;
    }

    signals.push({
      label: 'Seller Sentiment',
      status,
      icon: DollarSign,
      detail,
    });
  }

  return signals;
}

/**
 * Get status color for a signal
 */
function getStatusColor(status: 'improving' | 'stable' | 'declining'): string {
  switch (status) {
    case 'improving':
      return 'var(--report-success)';
    case 'declining':
      return 'var(--report-error)';
    default:
      return 'var(--report-stone)';
  }
}

/**
 * Get status background color
 */
function getStatusBgColor(status: 'improving' | 'stable' | 'declining'): string {
  switch (status) {
    case 'improving':
      return 'var(--report-success-bg)';
    case 'declining':
      return 'var(--report-error-bg)';
    default:
      return 'var(--report-cream-dark)';
  }
}

/**
 * Get trend icon for a signal status
 */
function getStatusIcon(status: 'improving' | 'stable' | 'declining') {
  switch (status) {
    case 'improving':
      return <TrendingUp className="w-3 h-3" />;
    case 'declining':
      return <TrendingDown className="w-3 h-3" />;
    default:
      return <Minus className="w-3 h-3" />;
  }
}

/**
 * Format a date string for display
 */
function formatNewsDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * PrepNewsSignals - Market signals and news for agent context
 *
 * Displays either real news items from the report or, if unavailable,
 * derived market signal indicators based on metrics. Each signal has
 * an icon, label, and status pill (improving/stable/declining).
 *
 * Uses the editorial design system from report-theme.css.
 */
export function PrepNewsSignals({
  report,
  className = '',
}: PrepNewsSignalsProps): React.ReactElement {
  const newsItems = getNewsItems(report);
  const marketSignals = deriveMarketSignals(report);

  // AI narrative
  const aiNarrative =
    report.ai_narrative?.prep_signals ??
    (report.ai_narratives?.prep_signals as string | string[] | undefined);

  const hasAnyContent =
    newsItems.length > 0 || marketSignals.length > 0 || aiNarrative;

  if (!hasAnyContent) {
    return (
      <SectionCard title="Market Signals" icon={Newspaper} className={className}>
        <div
          className="flex items-center justify-center gap-3 py-8"
          style={{ color: 'var(--report-stone-light)' }}
        >
          <AlertTriangle className="w-5 h-5" />
          <span className="report-body">
            Market signal data is not available for this area.
          </span>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Market Signals" icon={Newspaper} className={className}>
      {/* News items (if available) */}
      {newsItems.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--report-space-sm)',
            marginBottom: marketSignals.length > 0 || aiNarrative
              ? 'var(--report-space-lg)'
              : 0,
          }}
        >
          {newsItems.map((item, index) => (
            <div
              key={index}
              className="rounded-[var(--report-radius-md)]"
              style={{
                padding: 'var(--report-space-md)',
                backgroundColor: 'var(--report-cream)',
                border: '1px solid rgba(27, 46, 74, 0.04)',
              }}
            >
              <p
                className="text-sm font-semibold"
                style={{
                  color: 'var(--report-navy)',
                  margin: 0,
                  marginBottom: item.summary ? 'var(--report-space-xs)' : 0,
                }}
              >
                {item.title}
              </p>
              {item.summary && (
                <p
                  className="text-sm leading-relaxed"
                  style={{
                    color: 'var(--report-stone)',
                    margin: 0,
                    marginBottom: 'var(--report-space-xs)',
                  }}
                >
                  {item.summary}
                </p>
              )}
              {(item.date || item.source) && (
                <p
                  className="text-[0.6875rem]"
                  style={{ color: 'var(--report-stone-light)', margin: 0 }}
                >
                  {item.date && formatNewsDate(item.date)}
                  {item.date && item.source && ' \u00B7 '}
                  {item.source}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Market signals (if no news or always show alongside) */}
      {marketSignals.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--report-space-sm)',
            marginBottom: aiNarrative ? 'var(--report-space-lg)' : 0,
          }}
        >
          {newsItems.length === 0 && (
            <p
              className="text-xs font-medium uppercase tracking-wide"
              style={{
                color: 'var(--report-stone-light)',
                margin: 0,
                marginBottom: 'var(--report-space-xs)',
              }}
            >
              Derived Market Signals
            </p>
          )}
          {marketSignals.map((signal, index) => {
            const SignalIcon = signal.icon;
            return (
              <div
                key={index}
                className="flex items-center gap-3 rounded-[var(--report-radius-md)]"
                style={{
                  padding: 'var(--report-space-md)',
                  backgroundColor: 'var(--report-cream)',
                  border: '1px solid rgba(27, 46, 74, 0.04)',
                }}
              >
                {/* Icon */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: getStatusBgColor(signal.status) }}
                >
                  <SignalIcon
                    className="w-4 h-4"
                    style={{ color: getStatusColor(signal.status) }}
                  />
                </div>

                {/* Label and detail */}
                <div style={{ flex: 1 }}>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: 'var(--report-navy)', margin: 0 }}
                  >
                    {signal.label}
                  </p>
                  <p
                    className="text-[0.8125rem]"
                    style={{ color: 'var(--report-stone)', margin: 0 }}
                  >
                    {signal.detail}
                  </p>
                </div>

                {/* Status pill */}
                <span
                  className="inline-flex items-center gap-1 text-[0.625rem] font-semibold uppercase tracking-wide px-2 py-1 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: getStatusBgColor(signal.status),
                    color: getStatusColor(signal.status),
                  }}
                >
                  {getStatusIcon(signal.status)}
                  {signal.status}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* AI Analysis */}
      {aiNarrative && (
        <AIAnalysisBlock
          content={
            typeof aiNarrative === 'string'
              ? aiNarrative
              : Array.isArray(aiNarrative)
              ? aiNarrative
              : String(aiNarrative)
          }
          title="Signal Analysis"
          variant="insight"
        />
      )}
    </SectionCard>
  );
}

export default PrepNewsSignals;
