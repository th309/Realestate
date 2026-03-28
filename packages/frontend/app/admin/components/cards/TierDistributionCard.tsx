"use client";

import { PieChart } from "lucide-react";
import { DashboardCard } from "../shared/DashboardCard";
import { useAdminTimeSeries } from "../hooks/useAdminTimeSeries";

interface UserSnapshot {
  timestamp: string;
  tier_free: number;
  tier_starter: number;
  tier_pro: number;
  tier_enterprise: number;
}

interface TierDistributionCardProps {
  refreshTrigger: number;
  onClick: () => void;
}

const TIER_CONFIG = [
  { key: "tier_free", label: "Free", color: "bg-zinc-400" },
  { key: "tier_starter", label: "Starter", color: "bg-blue-500" },
  { key: "tier_pro", label: "Pro", color: "bg-indigo-500" },
  { key: "tier_enterprise", label: "Enterprise", color: "bg-amber-500" },
] as const;

export function TierDistributionCard({
  refreshTrigger,
  onClick,
}: TierDistributionCardProps) {
  const { data, isLoading, error } = useAdminTimeSeries<UserSnapshot[]>(
    "user-history",
    undefined,
    { refreshTrigger },
  );

  const rows = data ?? [];
  const latest = rows.length > 0 ? rows[rows.length - 1] : null;
  const total = latest
    ? latest.tier_free +
      latest.tier_starter +
      latest.tier_pro +
      latest.tier_enterprise
    : 0;
  const paidCount = latest
    ? latest.tier_starter + latest.tier_pro + latest.tier_enterprise
    : 0;

  return (
    <DashboardCard
      title="Tier Distribution"
      icon={PieChart}
      badge={
        total > 0
          ? {
              text: `${((paidCount / total) * 100).toFixed(0)}% paid`,
              color: "bg-indigo-500/10 text-indigo-700",
            }
          : undefined
      }
      loading={isLoading}
      error={error?.message ?? null}
      onClick={onClick}
    >
      {latest && total > 0 ? (
        <div className="space-y-3">
          {/* Stacked bar */}
          <div className="h-3 rounded-full overflow-hidden flex">
            {TIER_CONFIG.map(({ key, color }) => {
              const count = latest[key as keyof UserSnapshot] as number;
              const pct = (count / total) * 100;
              return pct > 0 ? (
                <div
                  key={key}
                  className={`h-full ${color} transition-all`}
                  style={{ width: `${pct}%` }}
                />
              ) : null;
            })}
          </div>
          {/* Legend */}
          <div className="grid grid-cols-2 gap-1">
            {TIER_CONFIG.map(({ key, label, color }) => {
              const count = latest[key as keyof UserSnapshot] as number;
              return (
                <div key={key} className="flex items-center gap-1.5 text-xs">
                  <span className={`w-2 h-2 rounded-full ${color} shrink-0`} />
                  <span className="text-on-surface-variant">{label}</span>
                  <span className="text-on-surface font-mono ml-auto">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant">
          No tier data available
        </p>
      )}
    </DashboardCard>
  );
}
