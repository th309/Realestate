"use client";

import { Users } from "lucide-react";
import { DashboardCard } from "../shared/DashboardCard";
import { SparklineChart } from "../shared/SparklineChart";
import { useAdminTimeSeries } from "../hooks/useAdminTimeSeries";

interface UserSnapshot {
  timestamp: string;
  total_users: number;
  new_signups: number;
  active_trials: number;
  expiring_soon: number;
  tier_free: number;
  tier_starter: number;
  tier_pro: number;
  tier_enterprise: number;
}

interface UsersGrowthCardProps {
  refreshTrigger: number;
  onClick: () => void;
}

export function UsersGrowthCard({
  refreshTrigger,
  onClick,
}: UsersGrowthCardProps) {
  const { data, isLoading, error } = useAdminTimeSeries<UserSnapshot[]>(
    "user-history",
    undefined,
    { refreshTrigger },
  );

  const rows = data ?? [];
  const latest = rows.length > 0 ? rows[rows.length - 1] : null;
  const userSparkline = rows.map((r) => r.total_users);

  // Calculate week-over-week new signups
  const recentSignups = rows
    .slice(-7)
    .reduce((sum, r) => sum + r.new_signups, 0);

  return (
    <DashboardCard
      title="Users & Growth"
      icon={Users}
      badge={
        latest
          ? {
              text: `+${recentSignups} this week`,
              color:
                recentSignups > 0
                  ? "bg-green-500/10 text-green-700"
                  : "bg-surface-container text-on-surface-variant",
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
              <div className="text-xs text-on-surface-variant">Total Users</div>
              <div className="text-lg font-semibold text-on-surface font-mono">
                {latest.total_users.toLocaleString()}
              </div>
            </div>
            <SparklineChart
              data={userSparkline.slice(-20)}
              width={80}
              height={24}
            />
          </div>
          <div className="flex justify-between text-xs text-on-surface-variant">
            <span>{latest.active_trials} trials</span>
            <span>{latest.expiring_soon} expiring</span>
            <span>+{latest.new_signups} today</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant">
          No user data available
        </p>
      )}
    </DashboardCard>
  );
}
