import React from 'react';

import { formatMetricValue } from '@/lib/data';

// ---------------------------------------------------------------------------
// Calculation helpers
// ---------------------------------------------------------------------------

/**
 * Calculate a market balance score (0-100) where:
 * 0 = strong buyer's market, 50 = balanced, 100 = strong seller's market.
 */
export function calculateMarketBalance(
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
export function getCompetitionLevel(hotnessScore: number | null): {
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
export function getSpeedInterpretation(dom: number | null): string {
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
export function getFlexibilityInterpretation(priceReducedShare: number | null): string {
  if (priceReducedShare === null) return 'Data not available';
  const pct = priceReducedShare > 1 ? priceReducedShare : priceReducedShare * 100;
  if (pct >= 30) return 'Many sellers open to negotiation';
  if (pct >= 15) return 'Some sellers are flexible on price';
  return 'Sellers holding firm on prices';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Market Balance bar indicator
 */
export function MarketBalanceBar({
  marketBalance,
  balanceLabel,
}: {
  marketBalance: number;
  balanceLabel: string;
}) {
  return (
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
  );
}

/**
 * Competition Level condition card
 */
export function CompetitionCard({
  competition,
}: {
  competition: ReturnType<typeof getCompetitionLevel>;
}) {
  return (
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
  );
}

/**
 * Generic stat condition card (Inventory, Speed, Seller Flexibility)
 */
export function StatConditionCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
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
        {label}
      </p>
      <p
        className="text-lg font-semibold mb-1"
        style={{
          fontFamily: 'var(--report-font-display)',
          color: 'var(--report-navy)',
        }}
      >
        {value}
      </p>
      <p
        className="text-xs leading-relaxed"
        style={{ color: 'var(--report-stone)' }}
      >
        {description}
      </p>
    </div>
  );
}
