/**
 * Monthly Digest Types
 *
 * Shared interfaces and constants used by the monthly digest
 * orchestration service and data service.
 */

export interface WatchlistMover {
  name: string;
  oldScore: number;
  newScore: number;
  direction: 'up' | 'down';
}

export interface MarketToWatch {
  name: string;
  reason: string;
}

export interface DigestTopMarket {
  name: string;
  matchScore: number;
  piqScore: number;
  change: number;
}

export interface EligibleUser {
  id: string;
  email: string;
}

export const GOAL_LABELS: Record<string, string> = {
  first_time_buyer: 'First-Time Buyer',
  relocating: 'Relocating',
  investor_rental: 'Rental Investor',
  investor_flip: 'Fix & Flip Investor',
  exploring: 'Exploring',
};

export function formatBudgetRange(
  budgetMin: number | null,
  budgetMax: number | null,
): string {
  const fmt = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
    return `$${n}`;
  };

  if (budgetMin && budgetMax) return `${fmt(budgetMin)} – ${fmt(budgetMax)}`;
  if (budgetMax) return `Up to ${fmt(budgetMax)}`;
  if (budgetMin) return `${fmt(budgetMin)}+`;
  return 'Any budget';
}
