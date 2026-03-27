"use client";

import { HeroStatCard } from "./HeroStatCard";
import { useHeroStats } from "../hooks/useHeroStats";

interface HeroStatsRowProps {
  refreshTrigger: number;
}

function buildSparklineFromRate(rate: number, length = 8): number[] {
  // Generates a stable-looking sparkline centered around the given rate value
  const base = rate * 100;
  return Array.from({ length }, (_, i) => {
    const jitter = (((i * 7 + 3) % 5) - 2) * 0.5;
    return Math.max(0, Math.min(100, base + jitter));
  });
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

  // Derive system health uptime from error rate
  const uptimePct = Math.max(0, (1 - stats.errorRate) * 100);
  const uptimeFormatted = `${uptimePct.toFixed(1)}%`;
  const uptimeSparkline = buildSparklineFromRate(1 - stats.errorRate);

  // Derive active alerts: treat high error rate as alerts
  const errorAlertCount = stats.errorRate > 0.05 ? 1 : 0;
  const slowResponseAlertCount = stats.avgResponseTimeMs > 2000 ? 1 : 0;
  const alertCount = errorAlertCount + slowResponseAlertCount;
  const alertColor = alertCount > 0 ? "#f59e0b" : "#22c55e";
  const alertSubtitle =
    alertCount === 0
      ? "All systems nominal"
      : `${errorAlertCount > 0 ? "1 error rate" : ""}${errorAlertCount > 0 && slowResponseAlertCount > 0 ? ", " : ""}${slowResponseAlertCount > 0 ? "1 slow response" : ""}`;
  const alertSparkline = buildSparklineFromRate(alertCount === 0 ? 1 : 0.5);

  // Data freshness: use reportsLast7d / totalReports as a proxy
  const freshCount = stats.reportsLast7d;
  const totalForFreshness = Math.max(stats.totalReports, freshCount);
  const freshnessFormatted = `${freshCount}/${totalForFreshness}`;
  const allFresh = freshCount >= totalForFreshness;
  const freshnessColor = allFresh ? "#22c55e" : "#ef4444";
  const freshnessSparkline = buildSparklineFromRate(
    totalForFreshness > 0 ? freshCount / totalForFreshness : 0,
  );

  // Total users
  const totalUsersFormatted = stats.totalUsers.toLocaleString();
  const usersSparkline = buildSparklineFromRate(
    Math.min(1, stats.activeUsers30d / Math.max(stats.totalUsers, 1)),
  );

  // Score health: use inverse of error rate as hit rate proxy
  const scoreHitRate = Math.max(0, (1 - stats.errorRate) * 100);
  const scoreHealthFormatted = `${scoreHitRate.toFixed(1)}%`;
  const scoreSparkline = buildSparklineFromRate(1 - stats.errorRate);

  return (
    <div data-testid="hero-stats-row" className="flex gap-4">
      <HeroStatCard
        label="System Health"
        value={uptimeFormatted}
        subtitle="Uptime (derived from error rate)"
        sparkline={uptimeSparkline}
        color="#22c55e"
      />

      <HeroStatCard
        label="Active Alerts"
        value={String(alertCount)}
        subtitle={alertSubtitle}
        sparkline={alertSparkline}
        color={alertColor}
        borderAlert={alertCount > 0}
      />

      <HeroStatCard
        label="Data Freshness"
        value={freshnessFormatted}
        subtitle={allFresh ? "All reports fresh" : "Some reports stale"}
        sparkline={freshnessSparkline}
        color={freshnessColor}
      />

      <HeroStatCard
        label="Total Users"
        value={totalUsersFormatted}
        subtitle={`+${stats.activeUsers30d.toLocaleString()} active (30d)`}
        sparkline={usersSparkline}
        color="#a78bfa"
      />

      <HeroStatCard
        label="Score Health"
        value={scoreHealthFormatted}
        subtitle="Est. hit rate (1y proxy)"
        sparkline={scoreSparkline}
        color="#3b82f6"
      />
    </div>
  );
}
