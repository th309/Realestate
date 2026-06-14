/**
 * MarketConditionBadge Component
 *
 * Displays a badge indicating the current market condition:
 * - Buyer's Market (emerald) - favorable for buyers
 * - Seller's Market (rose) - favorable for sellers
 * - Balanced Market (amber) - neutral conditions
 */

import { HomeIcon, FireIcon, BalanceIcon } from '../Icons';

export type MarketCondition = 'buyers' | 'sellers' | 'balanced';

interface MarketConditionBadgeProps {
  condition: MarketCondition;
  size?: 'sm' | 'md';
}

const CONDITION_CONFIG: Record<MarketCondition, {
  label: string;
  bgColor: string;
  textColor: string;
  Icon: React.FC;
}> = {
  buyers: {
    label: "Buyer's Market",
    bgColor: 'bg-emerald-100',
    textColor: 'text-emerald-700',
    Icon: HomeIcon,
  },
  sellers: {
    label: "Seller's Market",
    bgColor: 'bg-rose-100',
    textColor: 'text-rose-700',
    Icon: FireIcon,
  },
  balanced: {
    label: 'Balanced Market',
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-700',
    Icon: BalanceIcon,
  },
};

export function MarketConditionBadge({ condition, size = 'sm' }: MarketConditionBadgeProps) {
  const config = CONDITION_CONFIG[condition];
  const { label, bgColor, textColor, Icon } = config;

  const sizeClasses = size === 'sm'
    ? 'px-2 py-1 text-xs gap-1'
    : 'px-3 py-1.5 text-sm gap-1.5';

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${bgColor} ${textColor} ${sizeClasses}`}>
      <span className="w-4 h-4">
        <Icon />
      </span>
      {label}
    </span>
  );
}

/**
 * Determine market condition based on key metrics
 *
 * Logic based on standard real estate market indicators:
 * - Months of Supply > 6 OR (DOM > 45 AND Inventory YoY > 10%) = Buyer's Market
 * - Months of Supply < 3 OR (DOM < 21 AND Inventory YoY < -5%) = Seller's Market
 * - Otherwise = Balanced Market
 */
export function getMarketCondition(
  monthsOfSupply?: number,
  daysOnMarket?: number,
  inventoryYoy?: number
): MarketCondition {
  // If we have months of supply, use it as primary indicator
  if (monthsOfSupply !== undefined) {
    if (monthsOfSupply > 6) return 'buyers';
    if (monthsOfSupply < 3) return 'sellers';
  }

  // Fall back to DOM + inventory trends
  if (daysOnMarket !== undefined && inventoryYoy !== undefined) {
    if (daysOnMarket > 45 && inventoryYoy > 10) return 'buyers';
    if (daysOnMarket < 21 && inventoryYoy < -5) return 'sellers';
  }

  // Individual strong signals
  if (daysOnMarket !== undefined) {
    if (daysOnMarket > 60) return 'buyers';
    if (daysOnMarket < 14) return 'sellers';
  }

  return 'balanced';
}
