"use client";

import { TrendingUp } from "lucide-react";
import { DashboardCard } from "../shared/DashboardCard";
import { SparklineChart } from "../shared/SparklineChart";
import { useAdminTimeSeries } from "../hooks/useAdminTimeSeries";

interface ScoreSnapshot {
  timestamp: string;
  score_type: string;
  correlation_1y: number | null;
  correlation_3y: number | null;
  hit_rate_1y: number | null;
  hit_rate_3y: number | null;
  top_quintile_hit_rate_1y: number | null;
  top_quintile_hit_rate_3y: number | null;
  scores_validated: number;
  scores_validated_3y: number;
  scores_pending: number;
  scores_failed: number;
}

interface ScoreHealthCardProps {
  refreshTrigger: number;
  onClick: () => void;
}

function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "\u2014";
  return `${(value * 100).toFixed(0)}%`;
}

export function ScoreHealthCard({
  refreshTrigger,
  onClick,
}: ScoreHealthCardProps) {
  const { data, isLoading, error } = useAdminTimeSeries<ScoreSnapshot[]>(
    "score-history",
    undefined,
    { refreshTrigger },
  );

  // Filter to the unified propertyiq score only and sort newest-first.
  // Backend returns DESC by timestamp already, but we defensively re-sort.
  const rows = (data ?? [])
    .filter((r) => r.score_type === "propertyiq")
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const latest = rows[0] ?? null;

  // Headline metric: 3Y top-quintile hit rate (most rigorous long-horizon signal).
  const headlinePct = formatPct(latest?.top_quintile_hit_rate_3y);

  // Sparkline: top-quintile 3Y over time, oldest-to-newest.
  const sparkline = rows
    .slice()
    .reverse()
    .map((r) => (r.top_quintile_hit_rate_3y ?? 0) * 100);

  const headlineValue = latest?.top_quintile_hit_rate_3y ?? null;
  const badgeColor =
    headlineValue == null
      ? "bg-surface-container text-on-surface-variant"
      : headlineValue >= 0.6
        ? "bg-green-500/10 text-green-700"
        : headlineValue >= 0.5
          ? "bg-amber-500/10 text-amber-700"
          : "bg-red-500/10 text-red-700";

  return (
    <DashboardCard
      title="Score Health"
      icon={TrendingUp}
      badge={
        latest
          ? { text: `${headlinePct} top-q 3Y`, color: badgeColor }
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
                3Y Top-Quintile Hit Rate
              </div>
              <div className="text-2xl font-semibold text-on-surface font-mono">
                {headlinePct}
              </div>
            </div>
            <SparklineChart
              data={sparkline.slice(-20)}
              width={80}
              height={24}
            />
          </div>
          <div className="space-y-0.5 text-xs text-on-surface-variant font-mono">
            <div>
              1Y: {formatPct(latest.hit_rate_1y)} overall /{" "}
              {formatPct(latest.top_quintile_hit_rate_1y)} top-q
            </div>
            <div>
              3Y: {formatPct(latest.hit_rate_3y)} overall /{" "}
              {formatPct(latest.top_quintile_hit_rate_3y)} top-q
            </div>
          </div>
          <div className="flex justify-between text-xs text-on-surface-variant">
            <span>{latest.scores_validated.toLocaleString()} validated 1Y</span>
            <span>
              {latest.scores_validated_3y.toLocaleString()} validated 3Y
            </span>
            <span>{latest.scores_pending.toLocaleString()} pending</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant">
          No score snapshots recorded
        </p>
      )}
    </DashboardCard>
  );
}
