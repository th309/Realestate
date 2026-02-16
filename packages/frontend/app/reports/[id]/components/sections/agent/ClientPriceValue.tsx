'use client';

import React from 'react';
import { DollarSign } from 'lucide-react';

import { formatMetricValue } from '@/lib/data';
import { SectionCard, MetricsRow, AIAnalysisBlock } from '../core';
import type { MetricItem } from '../core';
import {
  getMetricWithAliases,
  getMetricValueWithAliases,
  getMetricTrend,
} from '../../utils/metricHelpers';
import type { ReportInstance } from '../../../../types';

export interface ClientPriceValueProps {
  /** The full report data */
  report: ReportInstance;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Build an interpretation paragraph from price/DOM data.
 * Uses plain language suitable for a homebuyer client.
 */
function buildInterpretation(
  yoyChange: number | null,
  daysOnMarket: number | null
): string | null {
  const parts: string[] = [];

  if (yoyChange !== null) {
    if (yoyChange > 0) {
      parts.push(
        `Home values have increased ${Math.abs(yoyChange).toFixed(1)}% over the past year, meaning sellers are generally in a strong position.`
      );
    } else if (yoyChange < 0) {
      parts.push(
        `Home values have decreased ${Math.abs(yoyChange).toFixed(1)}% over the past year, which may present opportunities for buyers to negotiate.`
      );
    } else {
      parts.push(
        'Home values have held steady over the past year, indicating a balanced pricing environment.'
      );
    }
  }

  if (daysOnMarket !== null) {
    if (daysOnMarket <= 21) {
      parts.push(
        `Homes are selling quickly\u2014typically within ${Math.round(daysOnMarket)} days\u2014so you may need to act fast when you find the right one.`
      );
    } else if (daysOnMarket <= 45) {
      parts.push(
        `The average home sells in about ${Math.round(daysOnMarket)} days, giving you a reasonable window to make decisions.`
      );
    } else {
      parts.push(
        `Homes are taking an average of ${Math.round(daysOnMarket)} days to sell, which means less pressure and more time to evaluate your options.`
      );
    }
  }

  return parts.length > 0 ? parts.join(' ') : null;
}

/**
 * ClientPriceValue - Consumer-friendly price and value metrics section
 *
 * Displays median home price, YoY change, price per sq ft, and days on market
 * with plain-language interpretations. Designed for homebuyer clients.
 */
export function ClientPriceValue({
  report,
  className = '',
}: ClientPriceValueProps): React.ReactElement {
  // Extract metric values
  const homePrice = getMetricValueWithAliases(report, 'zhvi', [
    'home_value',
    'median_listing_price',
    'median_home_value',
  ]);

  const yoyChange = getMetricValueWithAliases(report, 'home_value_yoy', [
    'zhvi_yoy',
    'price_yoy',
    'home_price_yoy',
  ]);

  const pricePerSqft = getMetricValueWithAliases(report, 'price_per_sqft', [
    'median_ppsf',
    'ppsf',
    'price_sqft',
  ]);

  const daysOnMarket = getMetricValueWithAliases(report, 'days_on_market', [
    'median_dom',
    'dom',
    'median_days_on_market',
  ]);

  // Get trend for YoY
  const yoyTrend = getMetricTrend(report, 'home_value_yoy', [
    'zhvi_yoy',
    'price_yoy',
  ]);

  // Build metrics array
  const metrics: MetricItem[] = [
    {
      label: 'Median Home Price',
      value: homePrice,
      format: 'currency',
    },
    {
      label: 'Price Change (YoY)',
      value: yoyChange,
      format: 'percent',
      trend: yoyTrend
        ? { direction: yoyTrend.direction, changePct: yoyTrend.changePct }
        : yoyChange !== null
        ? {
            direction: yoyChange > 0 ? 'up' : yoyChange < 0 ? 'down' : 'stable',
            changePct: yoyChange,
          }
        : undefined,
    },
    {
      label: 'Price per Sq Ft',
      value: pricePerSqft,
      format: 'currency',
    },
    {
      label: 'Days on Market',
      value: daysOnMarket,
      format: 'days',
    },
  ];

  // Build interpretation
  const interpretation = buildInterpretation(yoyChange, daysOnMarket);

  // Get AI narrative
  const aiNarrative =
    report.ai_narrative?.client_price ??
    (report.ai_narratives?.client_price as string | undefined);

  return (
    <SectionCard title="Price & Value" icon={DollarSign} className={className}>
      {/* Metrics Row */}
      <MetricsRow
        metrics={metrics}
        className="mb-[var(--report-space-lg)]"
      />

      {/* Plain Language Interpretation */}
      {interpretation && (
        <div
          className="rounded-[var(--report-radius-md)] p-[var(--report-space-md)]"
          style={{
            backgroundColor: 'var(--report-cream)',
            border: '1px solid rgba(27, 46, 74, 0.04)',
            marginBottom: aiNarrative ? 'var(--report-space-lg)' : 0,
          }}
        >
          <p
            className="text-[0.9375rem] leading-relaxed"
            style={{
              fontFamily: 'var(--report-font-body)',
              color: 'var(--report-navy)',
              margin: 0,
            }}
          >
            {interpretation}
          </p>
        </div>
      )}

      {/* AI Narrative */}
      {aiNarrative && (
        <AIAnalysisBlock
          content={typeof aiNarrative === 'string' ? aiNarrative : String(aiNarrative)}
          variant="summary"
        />
      )}
    </SectionCard>
  );
}

export default ClientPriceValue;
