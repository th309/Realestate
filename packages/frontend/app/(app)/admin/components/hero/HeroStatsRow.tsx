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
  const scores = stats.score_health ?? { hit_rate_1y: null, sparkline: [] };

  // System Health
  const uptimeFormatted = `${(health.uptime_pct ?? 0).toFixed(1)}%`;

  // Active Alerts
  const alertCount = alerts.count ?? 0;
  const alertColor = alertCount > 0 ? "#f59e0b" : "#22c55e";
  const alertSubtitle =
    alertCount === 0
      ? "All systems nominal"
      : `${alerts.critical ?? 0} critical, ${alerts.warning ?? 0} warning`;

  // Data Freshness
  const freshnessFormatted = `${freshness.fresh ?? 0}/${freshness.total ?? 0}`;
  const allFresh =
    (freshness.total ?? 0) > 0 &&
    (freshness.fresh ?? 0) >= (freshness.total ?? 0);
  const freshnessColor = allFresh ? "#22c55e" : "#ef4444";

  // Total Users
  const totalUsersFormatted = (users.count ?? 0).toLocaleString();

  // Score Health — hit_rate_1y is stored as a fraction (0..1), display as %.
  const scoreHealthFormatted =
    scores.hit_rate_1y == null
      ? "—"
      : `${(scores.hit_rate_1y * 100).toFixed(0)}%`;

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
        value={String(alertCount)}
        subtitle={alertSubtitle}
        sparkline={alerts.sparkline}
        color={alertColor}
        borderAlert={alertCount > 0}
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
        subtitle={`+${(users.new_this_week ?? 0).toLocaleString()} this week`}
        sparkline={users.sparkline}
        color="#7986CB"
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
