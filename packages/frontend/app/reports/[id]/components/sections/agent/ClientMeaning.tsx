'use client';

import React, { useMemo } from 'react';
import { Lightbulb } from 'lucide-react';

import { SectionCard, VerdictBadge, AIAnalysisBlock, RecommendationSlot } from '../core';
import type { VerdictType } from '../core';
import { getMetricValueWithAliases } from '../../utils/metricHelpers';
import type { ReportInstance } from '../../../../types';

export interface ClientMeaningProps {
  /** The full report data */
  report: ReportInstance;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Determine verdict based on MarketHealth score.
 */
function getVerdict(score: number | null): {
  type: VerdictType;
  label: string;
} {
  if (score === null) {
    return { type: 'cautious', label: 'Market data is limited' };
  }
  if (score >= 70) {
    return { type: 'positive', label: 'Good conditions for buyers' };
  }
  if (score >= 50) {
    return { type: 'cautious', label: 'Market requires careful timing' };
  }
  return { type: 'wait', label: 'Consider waiting for better conditions' };
}

/**
 * Build data-driven bullet points for actionable advice.
 */
function buildActionItems(
  daysOnMarket: number | null,
  yoyChange: number | null,
  inventory: number | null,
  priceReducedShare: number | null
): Array<{ icon: string; text: string }> {
  const items: Array<{ icon: string; text: string }> = [];

  // DOM-based advice
  if (daysOnMarket !== null) {
    if (daysOnMarket <= 21) {
      items.push({
        icon: '\u23F1', // stopwatch
        text: `Homes are selling in ${Math.round(daysOnMarket)} days \u2014 be prepared to act quickly and have your financing ready.`,
      });
    } else if (daysOnMarket <= 45) {
      items.push({
        icon: '\u23F1',
        text: `Homes typically sell in about ${Math.round(daysOnMarket)} days \u2014 you have a reasonable window to make thoughtful decisions.`,
      });
    } else {
      items.push({
        icon: '\u23F1',
        text: `Homes are taking ${Math.round(daysOnMarket)} days to sell \u2014 take your time and explore your options without rushing.`,
      });
    }
  }

  // Price trend advice
  if (yoyChange !== null) {
    if (yoyChange >= 3) {
      items.push({
        icon: '\uD83D\uDCC8', // chart increasing
        text: `Prices are rising (${yoyChange.toFixed(1)}% this year) \u2014 buying sooner could save you money as values continue to grow.`,
      });
    } else if (yoyChange <= -3) {
      items.push({
        icon: '\uD83D\uDCC9', // chart decreasing
        text: `Prices have come down ${Math.abs(yoyChange).toFixed(1)}% \u2014 this may be a good opportunity to find value, but watch for further changes.`,
      });
    } else {
      items.push({
        icon: '\uD83D\uDCC8',
        text: `Prices are relatively stable (${yoyChange >= 0 ? '+' : ''}${yoyChange.toFixed(1)}%) \u2014 you can focus on finding the right home without worrying about rapid price shifts.`,
      });
    }
  }

  // Inventory advice
  if (inventory !== null) {
    if (inventory <= 300) {
      items.push({
        icon: '\uD83C\uDFE0', // house
        text: `Only ${inventory.toLocaleString()} homes available \u2014 options are limited, so be ready to move when you find a good match.`,
      });
    } else if (inventory <= 1000) {
      items.push({
        icon: '\uD83C\uDFE0',
        text: `${inventory.toLocaleString()} homes currently for sale \u2014 a reasonable selection to choose from.`,
      });
    } else {
      items.push({
        icon: '\uD83C\uDFE0',
        text: `${inventory.toLocaleString()} homes available \u2014 plenty of choices, giving you leverage to find the perfect fit.`,
      });
    }
  }

  // Price cuts advice
  if (priceReducedShare !== null) {
    const pct = priceReducedShare > 1 ? priceReducedShare : priceReducedShare * 100;
    if (pct >= 25) {
      items.push({
        icon: '\uD83D\uDCB0', // money bag
        text: `${pct.toFixed(0)}% of sellers are reducing their prices \u2014 there is room to negotiate, so don't be afraid to make offers below asking.`,
      });
    } else if (pct >= 10) {
      items.push({
        icon: '\uD83D\uDCB0',
        text: `${pct.toFixed(0)}% of listings have had price reductions \u2014 some negotiation leverage exists, especially on homes that have been on the market longer.`,
      });
    } else {
      items.push({
        icon: '\uD83D\uDCB0',
        text: `Only ${pct.toFixed(0)}% of sellers have cut prices \u2014 the market is competitive, so come in with strong offers.`,
      });
    }
  }

  return items;
}

/**
 * ClientMeaning - Actionable takeaway section for the client
 *
 * Displays a verdict badge, data-driven advice bullet points,
 * AI narrative, and a recommendation slot. Written in plain language
 * to help clients understand what market conditions mean for them.
 */
export function ClientMeaning({
  report,
  className = '',
}: ClientMeaningProps): React.ReactElement {
  // Get MarketHealth score
  const score =
    (report.scores_snapshot as any)?.markethealth_score ??
    (report as any).markethealth_score ??
    null;

  // Extract metrics
  const daysOnMarket = getMetricValueWithAliases(report, 'days_on_market', [
    'median_dom',
    'dom',
    'median_days_on_market',
  ]);

  const yoyChange = getMetricValueWithAliases(report, 'home_value_yoy', [
    'zhvi_yoy',
    'price_yoy',
    'home_price_yoy',
  ]);

  const inventory = getMetricValueWithAliases(report, 'for_sale_inventory', [
    'active_listing_count',
    'inventory',
    'listing_count',
    'active_listings',
  ]);

  const priceReducedShare = getMetricValueWithAliases(report, 'price_reduced_share', [
    'price_reduced_pct',
    'price_reduced',
    'pct_price_reduced',
  ]);

  // Calculate verdict
  const verdict = getVerdict(score);

  // Build action items
  const actionItems = useMemo(
    () => buildActionItems(daysOnMarket, yoyChange, inventory, priceReducedShare),
    [daysOnMarket, yoyChange, inventory, priceReducedShare]
  );

  // Get AI narrative
  const aiNarrative =
    report.ai_narrative?.client_meaning ??
    (report.ai_narratives?.client_meaning as string | undefined);

  return (
    <SectionCard title="What This Means For You" icon={Lightbulb} className={className}>
      {/* Verdict Badge */}
      <div style={{ marginBottom: 'var(--report-space-lg)' }}>
        <VerdictBadge verdict={verdict.type} label={verdict.label} />
      </div>

      {/* Actionable Advice Bullets */}
      {actionItems.length > 0 && (
        <div
          className="space-y-3"
          style={{ marginBottom: 'var(--report-space-lg)' }}
        >
          {actionItems.map((item, index) => (
            <div
              key={index}
              className="flex items-start gap-3"
              style={{
                padding: 'var(--report-space-sm) var(--report-space-md)',
                backgroundColor: 'var(--report-cream)',
                borderRadius: 'var(--report-radius-md)',
                border: '1px solid rgba(27, 46, 74, 0.04)',
              }}
            >
              <span
                className="text-base leading-none flex-shrink-0 mt-0.5"
                aria-hidden="true"
              >
                {item.icon}
              </span>
              <p
                className="text-[0.875rem] leading-relaxed"
                style={{
                  fontFamily: 'var(--report-font-body)',
                  color: 'var(--report-navy)',
                  margin: 0,
                }}
              >
                {item.text}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* AI Narrative */}
      {aiNarrative && (
        <div style={{ marginBottom: 'var(--report-space-lg)' }}>
          <AIAnalysisBlock
            content={typeof aiNarrative === 'string' ? aiNarrative : String(aiNarrative)}
            title="Our Analysis"
            variant="recommendation"
          />
        </div>
      )}

      {/* Recommendation Slot */}
      <RecommendationSlot contextType="client_advice" report={report} />
    </SectionCard>
  );
}

export default ClientMeaning;
