'use client';

import React from 'react';
import { Newspaper } from 'lucide-react';

import { SectionCard } from '../core';
import { formatMetricValue } from '@/lib/data';
import { getMetricWithAliases } from '../../utils/metricHelpers';
import type { ReportInstance, NewsItem } from '../../../../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MarketPulseProps {
  /** The full report data */
  report: ReportInstance;
  /** Optional additional CSS classes */
  className?: string;
}

type SentimentLabel = 'bullish' | 'neutral' | 'bearish';

interface SentimentData {
  overall: SentimentLabel;
  confidence?: number;
  bullish_count?: number;
  bearish_count?: number;
  summary?: string;
  factors?: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalise the sentiment data which may live at different paths in populated_data.
 */
function getSentiment(report: ReportInstance): SentimentData | null {
  // Try signal_summary (task spec path)
  const signalSummary = (report.populated_data?.realtime as any)?.signal_summary;
  if (signalSummary && typeof signalSummary === 'object') {
    return {
      overall: signalSummary.overall ?? signalSummary.sentiment ?? 'neutral',
      confidence: signalSummary.confidence,
      bullish_count: signalSummary.bullish_count,
      bearish_count: signalSummary.bearish_count,
      summary: signalSummary.summary,
      factors: signalSummary.factors,
    };
  }

  // Try sentiment (typed path in PopulatedReportData)
  const sentiment = report.populated_data?.realtime?.sentiment;
  if (sentiment && typeof sentiment === 'object') {
    return {
      overall: sentiment.sentiment ?? 'neutral',
      confidence: sentiment.confidence,
      summary: sentiment.summary,
      factors: sentiment.factors,
    };
  }

  return null;
}

/**
 * Get news items from realtime or top-level populated data.
 */
function getNewsItems(report: ReportInstance): NewsItem[] {
  const realtimeNews = report.populated_data?.realtime?.news;
  if (Array.isArray(realtimeNews) && realtimeNews.length > 0) return realtimeNews;

  const topLevelNews = report.populated_data?.news;
  if (Array.isArray(topLevelNews) && topLevelNews.length > 0) return topLevelNews;

  return [];
}

/**
 * Get economic indicator metrics from census / current data.
 */
interface EconomicIndicator {
  label: string;
  value: string;
}

function getEconomicIndicators(report: ReportInstance): EconomicIndicator[] {
  const indicators: EconomicIndicator[] = [];

  // Realtime indicators (object with arbitrary keys)
  const rtIndicators = report.populated_data?.realtime?.indicators;
  if (rtIndicators && typeof rtIndicators === 'object') {
    for (const [key, val] of Object.entries(rtIndicators)) {
      if (val !== null && val !== undefined) {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        indicators.push({ label, value: String(val) });
      }
    }
    if (indicators.length > 0) return indicators.slice(0, 6);
  }

  // Census / current data fallbacks
  const medianIncome = getMetricWithAliases(report as any, 'median_household_income');
  if (medianIncome !== null) {
    indicators.push({
      label: 'Median Income',
      value: formatMetricValue(medianIncome, 'currency'),
    });
  }

  const unemployment = getMetricWithAliases(report as any, 'unemployment_rate');
  if (unemployment !== null) {
    indicators.push({
      label: 'Unemployment',
      value: formatMetricValue(unemployment, 'percent'),
    });
  }

  const jobGrowth = getMetricWithAliases(report as any, 'job_growth_yoy');
  if (jobGrowth !== null) {
    indicators.push({
      label: 'Job Growth',
      value: formatMetricValue(jobGrowth, 'percent'),
    });
  }

  const popGrowth = getMetricWithAliases(report as any, 'population_growth_yoy');
  if (popGrowth !== null) {
    indicators.push({
      label: 'Population Growth',
      value: formatMetricValue(popGrowth, 'percent'),
    });
  }

  const incomeGrowth = getMetricWithAliases(report as any, 'income_growth_yoy');
  if (incomeGrowth !== null) {
    indicators.push({
      label: 'Income Growth',
      value: formatMetricValue(incomeGrowth, 'percent'),
    });
  }

  return indicators;
}

/**
 * Sentiment colour / emoji helpers.
 */
function sentimentColor(s: SentimentLabel): string {
  switch (s) {
    case 'bullish':
      return 'var(--report-success)';
    case 'bearish':
      return 'var(--report-error)';
    default:
      return 'var(--report-warning)';
  }
}

function sentimentBgColor(s: SentimentLabel): string {
  switch (s) {
    case 'bullish':
      return 'var(--report-success-bg)';
    case 'bearish':
      return 'var(--report-error-bg)';
    default:
      return 'var(--report-warning-bg)';
  }
}

function sentimentDot(s: SentimentLabel): string {
  switch (s) {
    case 'bullish':
      return '\u{1F7E2}'; // green circle
    case 'bearish':
      return '\u{1F534}'; // red circle
    default:
      return '\u{1F7E1}'; // yellow circle
  }
}

function sentimentLabel(s: SentimentLabel): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SentimentGauge({ sentiment }: { sentiment: SentimentData }) {
  const confidence = sentiment.confidence ?? 50;
  const fillWidth = Math.min(Math.max(confidence, 5), 100);

  return (
    <div
      className="rounded-[var(--report-radius-md)] p-[var(--report-space-lg)]"
      style={{
        backgroundColor: sentimentBgColor(sentiment.overall),
        border: '1px solid rgba(27, 46, 74, 0.06)',
      }}
    >
      <p
        className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] mb-[var(--report-space-sm)]"
        style={{ color: 'var(--report-stone-light)' }}
      >
        Market Sentiment
      </p>

      <div className="flex items-center gap-3 mb-[var(--report-space-sm)]">
        <span className="text-lg" aria-hidden="true">
          {sentimentDot(sentiment.overall)}
        </span>
        <span
          className="text-base font-semibold"
          style={{
            color: sentimentColor(sentiment.overall),
            fontFamily: 'var(--report-font-display)',
          }}
        >
          {sentimentLabel(sentiment.overall)}
        </span>
        {sentiment.confidence !== undefined && (
          <span
            className="text-xs font-medium ml-auto tabular-nums"
            style={{ color: 'var(--report-stone)' }}
          >
            {Math.round(confidence)}% Confidence
          </span>
        )}
      </div>

      {/* Confidence bar */}
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ backgroundColor: 'rgba(27, 46, 74, 0.08)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${fillWidth}%`,
            backgroundColor: sentimentColor(sentiment.overall),
          }}
        />
      </div>

      {sentiment.summary && (
        <p
          className="text-sm leading-relaxed mt-[var(--report-space-md)]"
          style={{ color: 'var(--report-stone)' }}
        >
          {sentiment.summary}
        </p>
      )}
    </div>
  );
}

function NewsList({ items }: { items: NewsItem[] }) {
  // Truncate to 5 items
  const displayed = items.slice(0, 5);

  return (
    <div
      className="rounded-[var(--report-radius-md)] p-[var(--report-space-lg)]"
      style={{
        backgroundColor: 'white',
        border: '1px solid rgba(27, 46, 74, 0.06)',
      }}
    >
      <p
        className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] mb-[var(--report-space-md)]"
        style={{ color: 'var(--report-stone-light)' }}
      >
        Recent News
      </p>

      <ul className="space-y-[var(--report-space-sm)]" role="list">
        {displayed.map((news, idx) => (
          <li
            key={idx}
            className="flex items-start gap-2"
          >
            <span
              className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: 'var(--report-navy-light)' }}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p
                className="text-sm leading-snug"
                style={{ color: 'var(--report-navy)' }}
              >
                {news.headline}
              </p>
              {news.source && (
                <p
                  className="text-xs mt-0.5"
                  style={{ color: 'var(--report-stone-light)' }}
                >
                  {news.source}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EconomicIndicators({ indicators }: { indicators: EconomicIndicator[] }) {
  return (
    <div
      className="rounded-[var(--report-radius-md)] p-[var(--report-space-lg)]"
      style={{
        backgroundColor: 'var(--report-cream)',
        border: '1px solid rgba(27, 46, 74, 0.06)',
      }}
    >
      <p
        className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] mb-[var(--report-space-md)]"
        style={{ color: 'var(--report-stone-light)' }}
      >
        Economic Indicators
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-[var(--report-space-lg)] gap-y-[var(--report-space-md)]">
        {indicators.map((ind) => (
          <div key={ind.label}>
            <p
              className="text-xs mb-0.5"
              style={{ color: 'var(--report-stone-light)' }}
            >
              {ind.label}
            </p>
            <p
              className="text-sm font-semibold tabular-nums"
              style={{
                color: 'var(--report-navy)',
                fontFamily: 'var(--report-font-display)',
              }}
            >
              {ind.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * MarketPulse - Appendix-style market intelligence section
 *
 * Shared across all report types (homebuyer, investor, etc.). Shows market
 * sentiment, recent news headlines, and economic indicators.
 *
 * Self-hiding: returns null when there is nothing meaningful to display.
 *
 * Uses the editorial design system from report-theme.css.
 */
export function MarketPulse({
  report,
  className = '',
}: MarketPulseProps): React.ReactElement | null {
  const sentiment = getSentiment(report);
  const newsItems = getNewsItems(report);
  const economicIndicators = getEconomicIndicators(report);

  // Self-hide when we have nothing to show
  if (!sentiment && newsItems.length === 0 && economicIndicators.length === 0) {
    return null;
  }

  return (
    <SectionCard title="Market Pulse" icon={Newspaper} className={className}>
      <div className="space-y-[var(--report-space-lg)]">
        {/* Sentiment gauge */}
        {sentiment && <SentimentGauge sentiment={sentiment} />}

        {/* News */}
        {newsItems.length > 0 && <NewsList items={newsItems} />}

        {/* Economic indicators */}
        {economicIndicators.length > 0 && (
          <EconomicIndicators indicators={economicIndicators} />
        )}
      </div>
    </SectionCard>
  );
}

export default MarketPulse;
