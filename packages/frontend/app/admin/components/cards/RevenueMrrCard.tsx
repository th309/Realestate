"use client";

import { DollarSign } from "lucide-react";
import { DashboardCard } from "../shared/DashboardCard";
import { SparklineChart } from "../shared/SparklineChart";
import { useAdminTimeSeries } from "../hooks/useAdminTimeSeries";

interface UserSnapshot {
  timestamp: string;
  total_users: number;
  paywall_views: number;
  conversions: number;
  mrr_cents: number;
}

interface RevenueMrrCardProps {
  refreshTrigger: number;
  onClick: () => void;
}

function formatMRR(cents: number): string {
  if (cents === 0) return "$0";
  if (cents < 100_000) return `$${(cents / 100).toLocaleString()}`;
  return `$${(cents / 100_000).toFixed(1)}K`;
}

export function RevenueMrrCard({
  refreshTrigger,
  onClick,
}: RevenueMrrCardProps) {
  const { data, isLoading, error } = useAdminTimeSeries<UserSnapshot[]>(
    "user-history",
    undefined,
    { refreshTrigger },
  );

  const rows = data ?? [];
  const latest = rows.length > 0 ? rows[rows.length - 1] : null;
  const mrrSparkline = rows.map((r) => r.mrr_cents);

  // MoM change
  const prevMonth = rows.length >= 30 ? rows[rows.length - 30] : null;
  const momChange =
    latest && prevMonth && prevMonth.mrr_cents > 0
      ? (
          ((latest.mrr_cents - prevMonth.mrr_cents) / prevMonth.mrr_cents) *
          100
        ).toFixed(1)
      : null;

  const conversionRate =
    latest && latest.paywall_views > 0
      ? ((latest.conversions / latest.paywall_views) * 100).toFixed(1)
      : "0.0";

  return (
    <DashboardCard
      title="Revenue / MRR"
      icon={DollarSign}
      badge={
        momChange
          ? {
              text: `${Number(momChange) >= 0 ? "+" : ""}${momChange}% MoM`,
              color:
                Number(momChange) >= 0
                  ? "bg-green-500/10 text-green-700"
                  : "bg-red-500/10 text-red-700",
            }
          : undefined
      }
      loading={isLoading}
      error={error?.message ?? null}
      onClick={onClick}
    >
      {latest ? (
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs text-on-surface-variant">
                Monthly Recurring Revenue
              </div>
              <div className="text-lg font-semibold text-on-surface font-mono">
                {formatMRR(latest.mrr_cents)}
              </div>
            </div>
            <SparklineChart
              data={mrrSparkline.slice(-20)}
              width={80}
              height={24}
            />
          </div>
          <div className="flex justify-between text-xs text-on-surface-variant">
            <span>{latest.paywall_views} paywall views</span>
            <span>{latest.conversions} conversions</span>
            <span>{conversionRate}% CVR</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant">
          No revenue data available
        </p>
      )}
    </DashboardCard>
  );
}
