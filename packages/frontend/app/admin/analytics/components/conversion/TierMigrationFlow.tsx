/**
 * TierMigrationFlow
 *
 * CSS/Tailwind visualization of tier upgrade and downgrade flows.
 * Shows tier boxes (Free → Pro → Premium) with arrow counts between them.
 * Net upgrade/downgrade totals displayed below each arrow.
 */

"use client";

import type { TierFlow } from "@/lib/data/fetchers/admin-analytics.types";

interface TierMigrationFlowProps {
  tierMigration: TierFlow[];
}

const TIER_ORDER = ["free", "pro", "premium"] as const;
type Tier = (typeof TIER_ORDER)[number];

const TIER_STYLES: Record<Tier, string> = {
  free: "bg-surface-container border-outline-variant text-on-surface",
  pro: "bg-secondary-container border-secondary text-on-secondary-container",
  premium: "bg-primary-container border-primary text-on-primary-container",
};

const TIER_LABELS: Record<Tier, string> = {
  free: "Free",
  pro: "Pro",
  premium: "Premium",
};

function getFlow(
  tierMigration: TierFlow[],
  from: Tier,
  to: Tier,
): number {
  return (
    tierMigration.find(
      (f) => f.fromTier.toLowerCase() === from && f.toTier.toLowerCase() === to,
    )?.count ?? 0
  );
}

function ArrowBlock({
  upgradeCount,
  downgradeCount,
}: {
  upgradeCount: number;
  downgradeCount: number;
}) {
  const netUpgrade = upgradeCount - downgradeCount;
  return (
    <div className="flex flex-col items-center gap-1 px-2">
      {/* Upgrade arrow */}
      <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
        <span>&rarr;</span>
        <span>{upgradeCount.toLocaleString()}</span>
      </div>
      {/* Downgrade arrow */}
      <div className="flex items-center gap-1 text-xs text-red-500 font-medium">
        <span>&larr;</span>
        <span>{downgradeCount.toLocaleString()}</span>
      </div>
      {/* Net badge */}
      <span
        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
          netUpgrade >= 0
            ? "bg-green-100 text-green-700"
            : "bg-red-100 text-red-700"
        }`}
      >
        {netUpgrade >= 0 ? "+" : ""}
        {netUpgrade.toLocaleString()}
      </span>
    </div>
  );
}

export function TierMigrationFlow({ tierMigration }: TierMigrationFlowProps) {
  if (!tierMigration || tierMigration.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-on-surface-variant">
        No tier migration data available
      </div>
    );
  }

  const freeToProUpgrades = getFlow(tierMigration, "free", "pro");
  const proToFreeDowngrades = getFlow(tierMigration, "pro", "free");
  const proToPremiumUpgrades = getFlow(tierMigration, "pro", "premium");
  const premiumToProDowngrades = getFlow(tierMigration, "premium", "pro");

  const totalUpgrades = tierMigration
    .filter((f) => TIER_ORDER.indexOf(f.toTier.toLowerCase() as Tier) > TIER_ORDER.indexOf(f.fromTier.toLowerCase() as Tier))
    .reduce((sum, f) => sum + f.count, 0);

  const totalDowngrades = tierMigration
    .filter((f) => TIER_ORDER.indexOf(f.toTier.toLowerCase() as Tier) < TIER_ORDER.indexOf(f.fromTier.toLowerCase() as Tier))
    .reduce((sum, f) => sum + f.count, 0);

  return (
    <div className="space-y-6">
      {/* Tier boxes with arrows */}
      <div className="flex items-center justify-center gap-1 flex-wrap">
        {(["free", "pro", "premium"] as Tier[]).map((tier, idx) => (
          <div key={tier} className="flex items-center">
            <div
              className={`border rounded-xl px-5 py-4 text-center min-w-[90px] ${TIER_STYLES[tier]}`}
            >
              <div className="text-xs font-semibold uppercase tracking-wide opacity-70">
                {TIER_LABELS[tier]}
              </div>
            </div>
            {idx < 2 && (
              <ArrowBlock
                upgradeCount={idx === 0 ? freeToProUpgrades : proToPremiumUpgrades}
                downgradeCount={idx === 0 ? proToFreeDowngrades : premiumToProDowngrades}
              />
            )}
          </div>
        ))}
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 px-4 py-3 text-center">
          <div className="text-xl font-bold text-green-700">
            +{totalUpgrades.toLocaleString()}
          </div>
          <div className="text-xs text-green-600 font-medium mt-0.5">Total Upgrades</div>
        </div>
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-center">
          <div className="text-xl font-bold text-red-600">
            -{totalDowngrades.toLocaleString()}
          </div>
          <div className="text-xs text-red-500 font-medium mt-0.5">Total Downgrades</div>
        </div>
      </div>
    </div>
  );
}
