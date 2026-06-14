'use client';

import React, { useMemo } from 'react';
import { Activity } from 'lucide-react';

import { formatMetricValue } from '@/lib/data';
import { SectionCard, AIAnalysisBlock } from '../core';
import { getMetricValueWithAliases } from '../../utils/metricHelpers';
import type { ReportInstance } from '../../../../types';
import {
  calculateMarketBalance,
  getCompetitionLevel,
  getSpeedInterpretation,
  getFlexibilityInterpretation,
  MarketBalanceBar,
  CompetitionCard,
  StatConditionCard,
} from './ConditionCard';

export interface ClientMarketConditionsProps {
  /** The full report data */
  report: ReportInstance;
  /** Optional additional CSS classes */
  className?: string;
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
      <MarketBalanceBar marketBalance={marketBalance} balanceLabel={balanceLabel} />

      {/* Condition Cards Grid */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-[var(--report-space-sm)]"
        style={{ marginBottom: aiNarrative ? 'var(--report-space-lg)' : 0 }}
      >
        {/* Competition Level */}
        <CompetitionCard competition={competition} />

        {/* Inventory */}
        <StatConditionCard
          label="Inventory"
          value={
            inventory !== null
              ? `${formatMetricValue(inventory, 'number')} homes`
              : '\u2014'
          }
          description={
            inventory !== null
              ? 'Currently listed for sale in this area'
              : 'Inventory data not available'
          }
        />

        {/* Speed */}
        <StatConditionCard
          label="Speed"
          value={
            daysOnMarket !== null
              ? `${Math.round(daysOnMarket)} days`
              : '\u2014'
          }
          description={getSpeedInterpretation(daysOnMarket)}
        />

        {/* Seller Flexibility */}
        <StatConditionCard
          label="Seller Flexibility"
          value={
            priceReducedShare !== null
              ? `${(priceReducedShare > 1 ? priceReducedShare : priceReducedShare * 100).toFixed(0)}%`
              : '\u2014'
          }
          description={
            priceReducedShare !== null
              ? `of listings with price reductions \u2014 ${getFlexibilityInterpretation(priceReducedShare)}`
              : 'Price reduction data not available'
          }
        />
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
