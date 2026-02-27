/**
 * RevenueMetrics
 *
 * Three MetricCards (MRR, ARPU, LTV estimate) using the shared MetricCard component,
 * followed by a tier distribution bar chart rendered with Tailwind progress bars.
 */

'use client';

import { MetricCard } from '../shared/MetricCard';
import type { TierCount } from '@/lib/data/fetchers/admin-analytics.types';

interface RevenueMetricsProps {
  mrr: number;
  arpu: number;
  tierDistribution: TierCount[];
}

// Estimated monthly churn rate used for simplified LTV calculation
const ESTIMATED_MONTHLY_CHURN_RATE = 0.05;

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

const TIER_BAR_COLORS: Record<string, string> = {
  free: 'bg-slate-400',
  pro: 'bg-secondary',
  premium: 'bg-primary',
};

function getTierBarColor(tier: string): string {
  return TIER_BAR_COLORS[tier.toLowerCase()] ?? 'bg-outline';
}

export function RevenueMetrics({ mrr, arpu, tierDistribution }: RevenueMetricsProps) {
  const ltvEstimate =
    arpu > 0 ? arpu / ESTIMATED_MONTHLY_CHURN_RATE : 0;

  const totalUsers = tierDistribution.reduce((sum, t) => sum + t.count, 0);

  return (
    <div className="space-y-5">
      {/* KPI MetricCards */}
      <div className="grid grid-cols-3 gap-3">
        <MetricCard
          title="MRR"
          value={formatCurrency(mrr)}
        />
        <MetricCard
          title="ARPU"
          value={formatCurrency(arpu)}
        />
        <MetricCard
          title="Est. LTV"
          value={formatCurrency(ltvEstimate)}
        />
      </div>

      {/* Tier distribution bars */}
      {tierDistribution.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wide">
            Tier Distribution
          </p>
          <div className="space-y-2.5">
            {tierDistribution.map((tier) => {
              const pct =
                totalUsers > 0 ? (tier.count / totalUsers) * 100 : 0;
              return (
                <div key={tier.tier} className="space-y-1">
                  <div className="flex justify-between text-xs text-on-surface-variant">
                    <span className="capitalize font-medium">{tier.tier}</span>
                    <span className="tabular-nums">
                      {tier.count.toLocaleString()} users
                      &nbsp;&middot;&nbsp;
                      {formatCurrency(tier.revenue)}/mo
                      &nbsp;&middot;&nbsp;
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${getTierBarColor(tier.tier)}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
