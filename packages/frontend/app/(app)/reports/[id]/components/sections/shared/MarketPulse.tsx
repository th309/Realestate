'use client';

import React from 'react';
import { Newspaper } from 'lucide-react';

import { SectionCard } from '../core';
import { formatMetricValue } from '@/lib/data';
import { getMetricWithAliases } from '../../utils/metricHelpers';
import type { ReportInstance, NewsItem } from '../../../../types';
import type { SentimentData, EconomicIndicator } from './PulseMetricCard';
import { SentimentGauge, NewsList, EconomicIndicators } from './PulseMetricCard';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MarketPulseProps {
  /** The full report data */
  report: ReportInstance;
  /** Optional additional CSS classes */
  className?: string;
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
 * Keywords in news-scouted indicator names that overlap with Realtor/Zillow
 * authoritative data. These should NOT be displayed from news since the
 * report already shows the real values from our database, and news may
 * reference different geographies or time periods.
 */
const REALTOR_ZILLOW_INDICATOR_KEYWORDS = [
  'median home', 'median sale', 'home sale price', 'listing price',
  'days on market', 'dom', 'inventory', 'homes listed', 'active listing',
  'home value', 'median price', 'sale price',
];

function isRealtorZillowIndicator(name: string): boolean {
  const lower = name.toLowerCase();
  return REALTOR_ZILLOW_INDICATOR_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Get economic indicator metrics from census / current data,
 * supplemented by news-scouted indicators that don't overlap with
 * authoritative Realtor/Zillow data.
 */
function getEconomicIndicators(report: ReportInstance): EconomicIndicator[] {
  const indicators: EconomicIndicator[] = [];

  // 1. Census / current data (authoritative)
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

  // 2. Supplement with news-scouted indicators, but ONLY those that don't
  //    overlap with Realtor/Zillow authoritative metrics (which are already
  //    displayed in dedicated report sections like Market Timing, Affordability, etc.)
  const rtIndicators = report.populated_data?.realtime?.indicators;
  if (Array.isArray(rtIndicators) && rtIndicators.length > 0) {
    for (const ind of rtIndicators) {
      if (ind && typeof ind === 'object' && ind.indicator_name && !isRealtorZillowIndicator(ind.indicator_name)) {
        indicators.push({
          label: ind.indicator_name,
          value: ind.current_value ?? '—',
        });
      }
    }
  }

  return indicators.slice(0, 6);
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
