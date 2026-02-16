'use client';

import React, { useMemo } from 'react';
import { Activity } from 'lucide-react';

import { formatMetricValue } from '@/lib/data';
import { SectionCard, AIAnalysisBlock } from '../core';
import { getMetricValueWithAliases } from '../../utils/metricHelpers';
import type { ReportInstance } from '../../../../types';

export interface ClientMarketConditionsProps {
  /** The full report data */
  report: ReportInstance;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Calculate a market balance score (0-100) where:
 * 0 = strong buyer's market, 50 = balanced, 100 = strong seller's market.
 */
function calculateMarketBalance(
  daysOnMarket: number | null,
  inventory: number | null,
  pendingRatio: number | null
): number {
  let score = 50; // default balanced
  let factors = 0;
  let total = 0;

  // Days on market: < 14 = strong seller, > 60 = strong buyer
  if (daysOnMarket !== null) {
    factors++;
    if (daysOnMarket <= 14) total += 90;
    else if (daysOnMarket <= 21) total += 75;
    else if (daysOnMarket <= 30) total += 60;
    else if (daysOnMarket <= 45) total += 50;
    else if (daysOnMarket <= 60) total += 35;
    else if (daysOnMarket <= 90) total += 20;
    else total += 10;
  }

  // Inventory: lower = seller advantage
  if (inventory !== null) {
    factors++;
    if (inventory <= 200) total += 85;
    else if (inventory <= 500) total += 70;
    else if (inventory <= 1000) total += 55;
    else if (inventory <= 2000) total += 45;
    else if (inventory <= 5000) total += 30;
    else total += 15;
  }

  // Pending ratio: higher = seller advantage (more homes under contract)
  if (pendingRatio !== null) {
    factors++;
    const ratio = pendingRatio > 1 ? pendingRatio / 100 : pendingRatio;
    if (ratio >= 0.7) total += 85;
    else if (ratio >= 0.5) total += 70;
    else if (ratio >= 0.3) total += 50;
    else if (ratio >= 0.15) total += 35;
    else total += 15;
  }

  if (factors > 0) {
    score = Math.round(total / factors);
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Get competition level label and color from hotness score.
 */
function getCompetitionLevel(hotnessScore: number | null): {
  level: 'High' | 'Medium' | 'Low';
  color: string;
  bgColor: string;
  description: string;
} {
  if (hotnessScore === null) {
    return {
      level: 'Medium',
      color: 'var(--report-stone)',
      bgColor: 'var(--report-cream-dark)',
      description: 'Data not available',
    };
  }

  if (hotnessScore >= 70) {
    return {
      level: 'High',
      color: 'var(--report-error)',
      bgColor: 'var(--report-error-bg)',
      description: 'Expect multiple offers and fast sales',
    };
  }
  if (hotnessScore >= 40) {
    return {
      level: 'Medium',
      color: 'var(--report-warning)',
      bgColor: 'var(--report-warning-bg)',
      description: 'Moderate buyer competition',
    };
  }
  return {
    level: 'Low',
    color: 'var(--report-success)',
    bgColor: 'var(--report-success-bg)',
    description: 'Less competition among buyers',
  };
}

/**
 * Get speed interpretation from days on market.
 */
function getSpeedInterpretation(dom: number | null): string {
  if (dom === null) return 'Data not available';
  if (dom <= 14) return 'Homes sell very quickly';
  if (dom <= 30) return 'Homes sell at a brisk pace';
  if (dom <= 45) return 'Average selling speed';
  if (dom <= 60) return 'Homes take longer to sell';
  return 'Slow market — plenty of time to decide';
}

/**
 * Get seller flexibility interpretation from price reduced share.
 */
function getFlexibilityInterpretation(priceReducedShare: number | null): string {
  if (priceReducedShare === null) return 'Data not available';
  const pct = priceReducedShare > 1 ? priceReducedShare : priceReducedShare * 100;
  if (pct >= 30) return 'Many sellers open to negotiation';
  if (pct >= 15) return 'Some sellers are flexible on price';
  return 'Sellers holding firm on prices';
}

/**
 * ClientMarketConditions - Consumer-friendly market conditions section
 *
 * Displays a visual market balance indicator, key condition cards
 * (competition, inventory, speed, seller flexibility), and an optional
 * AI-generated narrative. Designed for homebuyer clients.
 */
export function ClientMarketConditions({
  report,
  className = '',
}: ClientMarketConditionsProps): React.ReactElement {
  // Extract metric values
  const daysOnMarket = getMetricValueWithAliases(report, 'days_on_market', [
    'median_dom',
    'dom',
    'median_days_on_market',
  ]);

  const inventory = getMetricValueWithAliases(report, 'for_sale_inventory', [
    'active_listing_count',
    'inventory',
    'listing_count',
    'active_listings',
  ]);

  const pendingRatio = getMetricValueWithAliases(report, 'pending_ratio', [
    'pending_to_active_ratio',
    'pending_listing_ratio',
  ]);

  const hotnessScore = getMetricValueWithAliases(report, 'hotness_score', [
    'market_hotness',
    'heat_index',
    'market_heat',
  ]);

  const priceReducedShare = getMetricValueWithAliases(report, 'price_reduced_share', [
    'price_reduced_pct',
    'price_reduced',
    'pct_price_reduced',
  ]);

  // Calculate market balance
  const marketBalance = useMemo(
    () => calculateMarketBalance(daysOnMarket, inventory, pendingRatio),
    [daysOnMarket, inventory, pendingRatio]
  );

  // Get competition level
  const competition = getCompetitionLevel(hotnessScore);

  // Get AI narrative
  const aiNarrative =
    report.ai_narrative?.client_conditions ??
    (report.ai_narratives?.client_conditions as string | undefined);

  // Balance bar label
  const balanceLabel =
    marketBalance >= 65
      ? 'Favors Sellers'
      : marketBalance <= 35
      ? 'Favors Buyers'
      : 'Balanced Market';

  return (
    <SectionCard title="Market Conditions" icon={Activity} className={className}>
      {/* Market Balance Indicator */}
      <div
        className="rounded-[var(--report-radius-md)] p-[var(--report-space-md)]"
        style={{
          backgroundColor: 'var(--report-cream)',
          border: '1px solid rgba(27, 46, 74, 0.04)',
          marginBottom: 'var(--report-space-lg)',
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <p
            className="text-[0.6875rem] font-medium uppercase tracking-[0.04em]"
            style={{ color: 'var(--report-stone-light)' }}
          >
            Market Balance
          </p>
          <p
            className="text-sm font-semibold"
            style={{
              fontFamily: 'var(--report-font-display)',
              color: 'var(--report-navy)',
            }}
          >
            {balanceLabel}
          </p>
        </div>

        {/* Horizontal bar */}
        <div className="relative">
          <div className="flex items-center justify-between mb-1">
            <span
              className="text-[0.625rem] font-medium"
              style={{ color: 'var(--report-success)' }}
            >
              Buyer Advantage
            </span>
            <span
              className="text-[0.625rem] font-medium"
              style={{ color: 'var(--report-warning)' }}
            >
              Seller Advantage
            </span>
          </div>

          <div
            className="relative h-3 rounded-full overflow-hidden"
            style={{
              background: 'linear-gradient(to right, var(--report-success-bg), var(--report-cream-dark), var(--report-warning-bg))',
              border: '1px solid rgba(27, 46, 74, 0.08)',
            }}
          >
            {/* Position indicator dot */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full shadow-sm"
              style={{
                left: `calc(${marketBalance}% - 8px)`,
                backgroundColor: 'var(--report-navy)',
                border: '2px solid white',
                transition: 'left 0.3s ease',
              }}
              role="img"
              aria-label={`Market balance indicator at ${marketBalance}%`}
            />
          </div>
        </div>
      </div>

      {/* Condition Cards Grid */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-[var(--report-space-sm)]"
        style={{ marginBottom: aiNarrative ? 'var(--report-space-lg)' : 0 }}
      >
        {/* Competition Level */}
        <div
          className="rounded-[var(--report-radius-md)] p-[var(--report-space-md)]"
          style={{
            backgroundColor: competition.bgColor,
            border: '1px solid rgba(27, 46, 74, 0.04)',
          }}
        >
          <p
            className="text-[0.6875rem] font-medium uppercase tracking-[0.04em] mb-1"
            style={{ color: 'var(--report-stone-light)' }}
          >
            Competition Level
          </p>
          <p
            className="text-lg font-semibold mb-1"
            style={{
              fontFamily: 'var(--report-font-display)',
              color: competition.color,
            }}
          >
            {competition.level}
          </p>
          <p
            className="text-xs leading-relaxed"
            style={{ color: 'var(--report-stone)' }}
          >
            {competition.description}
          </p>
        </div>

        {/* Inventory */}
        <div
          className="rounded-[var(--report-radius-md)] p-[var(--report-space-md)]"
          style={{
            backgroundColor: 'var(--report-cream)',
            border: '1px solid rgba(27, 46, 74, 0.04)',
          }}
        >
          <p
            className="text-[0.6875rem] font-medium uppercase tracking-[0.04em] mb-1"
            style={{ color: 'var(--report-stone-light)' }}
          >
            Inventory
          </p>
          <p
            className="text-lg font-semibold mb-1"
            style={{
              fontFamily: 'var(--report-font-display)',
              color: 'var(--report-navy)',
            }}
          >
            {inventory !== null
              ? `${formatMetricValue(inventory, 'number')} homes`
              : '\u2014'}
          </p>
          <p
            className="text-xs leading-relaxed"
            style={{ color: 'var(--report-stone)' }}
          >
            {inventory !== null
              ? 'Currently listed for sale in this area'
              : 'Inventory data not available'}
          </p>
        </div>

        {/* Speed */}
        <div
          className="rounded-[var(--report-radius-md)] p-[var(--report-space-md)]"
          style={{
            backgroundColor: 'var(--report-cream)',
            border: '1px solid rgba(27, 46, 74, 0.04)',
          }}
        >
          <p
            className="text-[0.6875rem] font-medium uppercase tracking-[0.04em] mb-1"
            style={{ color: 'var(--report-stone-light)' }}
          >
            Speed
          </p>
          <p
            className="text-lg font-semibold mb-1"
            style={{
              fontFamily: 'var(--report-font-display)',
              color: 'var(--report-navy)',
            }}
          >
            {daysOnMarket !== null
              ? `${Math.round(daysOnMarket)} days`
              : '\u2014'}
          </p>
          <p
            className="text-xs leading-relaxed"
            style={{ color: 'var(--report-stone)' }}
          >
            {getSpeedInterpretation(daysOnMarket)}
          </p>
        </div>

        {/* Seller Flexibility */}
        <div
          className="rounded-[var(--report-radius-md)] p-[var(--report-space-md)]"
          style={{
            backgroundColor: 'var(--report-cream)',
            border: '1px solid rgba(27, 46, 74, 0.04)',
          }}
        >
          <p
            className="text-[0.6875rem] font-medium uppercase tracking-[0.04em] mb-1"
            style={{ color: 'var(--report-stone-light)' }}
          >
            Seller Flexibility
          </p>
          <p
            className="text-lg font-semibold mb-1"
            style={{
              fontFamily: 'var(--report-font-display)',
              color: 'var(--report-navy)',
            }}
          >
            {priceReducedShare !== null
              ? `${(priceReducedShare > 1 ? priceReducedShare : priceReducedShare * 100).toFixed(0)}%`
              : '\u2014'}
          </p>
          <p
            className="text-xs leading-relaxed"
            style={{ color: 'var(--report-stone)' }}
          >
            {priceReducedShare !== null
              ? `of listings with price reductions \u2014 ${getFlexibilityInterpretation(priceReducedShare)}`
              : 'Price reduction data not available'}
          </p>
        </div>
      </div>

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

export default ClientMarketConditions;
