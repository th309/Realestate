/**
 * RevenueMetrics
 *
 * MRR, ARPU, paid-subscriber count and the current paid-tier breakdown.
 *
 * Every figure comes from `revenueMetrics` — user_profiles joined to
 * subscription_tiers (queryRevenueMetrics in the backend), which counts only
 * profiles with an active `pro` or `enterprise` subscription. Two deliberate
 * choices:
 *
 * - There is no LTV card. The previous one divided ARPU by a hardcoded 5%
 *   monthly churn constant. Churn has never been measured here, so the number
 *   was invented, not derived, and it sat next to two real ones.
 * - ARPU renders an em dash with no paid subscribers. It is MRR divided by the
 *   paid-subscriber count, and 0/0 is undefined, not zero.
 *
 * These are current-state figures: the backend query applies no date filter,
 * so they do not move with the dashboard's date range.
 */

"use client";

import { MetricCard } from "../shared/MetricCard";
import type { TierCount } from "@/lib/data/fetchers/admin-analytics.types";

interface RevenueMetricsProps {
  mrr: number;
  /**
   * null when nobody is billed. 0/0 is undefined, and "$0 average revenue per
   * user" asserts a measurement that was never taken — unlike MRR $0, which is
   * a true statement when the subscriber count is also 0.
   */
  arpu: number | null;
  /** Billed but payment failing — a SUBSET of MRR, not additional to it. */
  dunningCount?: number;
  tierDistribution: TierCount[];
}

const EM_DASH = "—";

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

/** Only paid tiers reach this component; free profiles are excluded upstream. */
const TIER_BAR_COLORS: Record<string, string> = {
  pro: "bg-primary",
  enterprise: "bg-secondary",
};

function getTierBarColor(tier: string): string {
  return TIER_BAR_COLORS[tier.toLowerCase()] ?? "bg-outline";
}

export function RevenueMetrics({
  mrr,
  arpu,
  tierDistribution,
  dunningCount,
}: RevenueMetricsProps) {
  const paidSubscribers = tierDistribution.reduce((sum, t) => sum + t.count, 0);
  const hasPaidSubscribers = paidSubscribers > 0;

  return (
    <div className="space-y-5">
      {/* KPI MetricCards */}
      <div className="grid grid-cols-3 gap-3">
        <MetricCard title="MRR" value={formatCurrency(mrr)} />
        <MetricCard
          title="ARPU"
          value={
            // Typed null rather than relying on hasPaidSubscribers happening to
            // be derived from the same tierDistribution that empties arpu — an
            // implicit invariant the type system was not enforcing.
            arpu === null ? EM_DASH : formatCurrency(arpu)
          }
        />
        <MetricCard
          title="Paid subscribers"
          value={paidSubscribers.toLocaleString()}
        />
      </div>

      {/* Paid tier distribution bars */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wide">
          Paid tier distribution
        </p>

        {hasPaidSubscribers ? (
          <div className="space-y-2.5">
            {tierDistribution.map((tier) => {
              const pct = (tier.count / paidSubscribers) * 100;
              return (
                <div key={tier.tier} className="space-y-1">
                  <div className="flex justify-between text-xs text-on-surface-variant">
                    <span className="capitalize font-medium">{tier.tier}</span>
                    <span className="tabular-nums">
                      {tier.count.toLocaleString()} subscribers
                      &nbsp;&middot;&nbsp;
                      {formatCurrency(tier.revenue)}/mo &nbsp;&middot;&nbsp;
                      {pct.toFixed(1)}% of paid
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
        ) : (
          <p className="text-sm text-on-surface-variant">
            No active paid subscriptions.
          </p>
        )}
      </div>

      {dunningCount !== undefined && dunningCount > 0 && (
        // Counted INSIDE mrr, because the subscription is still live — so this
        // is a warning about collectability, not a number to add or subtract.
        <p className="text-xs text-warning">
          {dunningCount} of these {dunningCount === 1 ? "is" : "are"} failing
          payment (past due or unpaid). Their revenue is included in MRR above
          but has not been collected.
        </p>
      )}

      <p className="text-xs text-on-surface-variant">
        Current subscription state from user profiles &mdash; active pro and
        enterprise plans only, not scoped to the selected date range.
      </p>
    </div>
  );
}
