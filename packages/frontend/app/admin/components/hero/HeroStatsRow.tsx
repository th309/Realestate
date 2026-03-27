"use client";

import { HeroStatCard } from "./HeroStatCard";
import { useHeroStats } from "../hooks/useHeroStats";

interface HeroStatsRowProps {
  refreshTrigger: number;
}

export function HeroStatsRow({ refreshTrigger }: HeroStatsRowProps) {
  const { stats, isLoading } = useHeroStats(refreshTrigger);

  if (isLoading || !stats) {
    return (
      <div data-testid="hero-stats-row" className="flex gap-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="flex-1 min-w-0 bg-surface-container-low rounded-xl border border-outline-variant shadow-sm px-5 py-4 animate-pulse"
          >
            <div className="h-3 bg-on-surface/10 rounded w-3/4 mb-3" />
            <div className="h-8 bg-on-surface/10 rounded w-1/2 mb-2" />
            <div className="h-3 bg-on-surface/10 rounded w-2/3 mb-4" />
            <div className="h-6 bg-on-surface/10 rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  // Destructure the five backend hero stat sections with safe defaults
  const health = stats.system_health ?? { uptime_pct: 0, sparkline: [] };
  const alerts = stats.active_alerts ?? {
    count: 0,
    critical: 0,
    warning: 0,
    sparkline: [],
  };
  const freshness = stats.data_freshness ?? {
    fresh: 0,
    total: 0,
    sparkline: [],
  };
  const users = stats.total_users ?? {
    count: 0,
    new_this_week: 0,
    sparkline: [],
  };
  const scores = stats.score_health ?? { hit_rate_1y: 0, sparkline: [] };

  // System Health
  const uptimeFormatted = `${health.uptime_pct.toFixed(1)}%`;

  // Active Alerts
  const alertColor = alerts.count > 0 ? "#f59e0b" : "#22c55e";
  const alertSubtitle =
    alerts.count === 0
      ? "All systems nominal"
      : `${alerts.critical} critical, ${alerts.warning} warning`;

  // Data Freshness
  const freshnessFormatted = `${freshness.fresh}/${freshness.total}`;
  const allFresh = freshness.total > 0 && freshness.fresh >= freshness.total;
  const freshnessColor = allFresh ? "#22c55e" : "#ef4444";

  // Total Users
  const totalUsersFormatted = users.count.toLocaleString();

  // Score Health
  const scoreHealthFormatted = `${scores.hit_rate_1y.toFixed(1)}%`;

  return (
    <div data-testid="hero-stats-row" className="flex gap-4">
      <HeroStatCard
        label="System Health"
        value={uptimeFormatted}
        subtitle="30-day uptime"
        sparkline={health.sparkline}
        color="#22c55e"
      />

      <HeroStatCard
        label="Active Alerts"
        value={String(alerts.count)}
        subtitle={alertSubtitle}
        sparkline={alerts.sparkline}
        color={alertColor}
        borderAlert={alerts.count > 0}
      />

      <HeroStatCard
        label="Data Freshness"
        value={freshnessFormatted}
        subtitle={allFresh ? "All sources fresh" : "Some sources stale"}
        sparkline={freshness.sparkline}
        color={freshnessColor}
      />

      <HeroStatCard
        label="Total Users"
        value={totalUsersFormatted}
        subtitle={`+${users.new_this_week.toLocaleString()} this week`}
        sparkline={users.sparkline}
        color="#a78bfa"
      />

      <HeroStatCard
        label="Score Health"
        value={scoreHealthFormatted}
        subtitle="1-year hit rate"
        sparkline={scores.sparkline}
        color="#3b82f6"
      />
    </div>
  );
}
