"use client";

import { TrendingUp } from "lucide-react";
import { DashboardCard } from "../shared/DashboardCard";
import { SparklineChart } from "../shared/SparklineChart";
import { useAdminTimeSeries } from "../hooks/useAdminTimeSeries";

interface ScoreSnapshot {
  timestamp: string;
  score_type: string;
  correlation_1y: number;
  hit_rate_1y: number;
  scores_validated: number;
  scores_pending: number;
  scores_failed: number;
}

interface ScoreHealthCardProps {
  refreshTrigger: number;
  onClick: () => void;
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

  const rows = data ?? [];
  const latest = rows.length > 0 ? rows[rows.length - 1] : null;
  const hitRateSparkline = rows.map((r) => r.hit_rate_1y * 100);

  const hitRatePct = latest ? (latest.hit_rate_1y * 100).toFixed(1) : "\u2014";
  const correlationPct = latest
    ? (latest.correlation_1y * 100).toFixed(1)
    : "\u2014";

  const badgeColor = latest
    ? latest.hit_rate_1y >= 0.7
      ? "bg-green-500/10 text-green-700"
      : latest.hit_rate_1y >= 0.5
        ? "bg-amber-500/10 text-amber-700"
        : "bg-red-500/10 text-red-700"
    : "bg-surface-container text-on-surface-variant";

  return (
    <DashboardCard
      title="Score Health"
      icon={TrendingUp}
      badge={
        latest ? { text: `${hitRatePct}% hit`, color: badgeColor } : undefined
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
                1Y Hit Rate / Correlation
              </div>
              <div className="text-lg font-semibold text-on-surface font-mono">
                {hitRatePct}%
                <span className="text-xs text-on-surface-variant font-normal">
                  {" "}
                  /{" "}
                </span>
                {correlationPct}%
              </div>
            </div>
            <SparklineChart
              data={hitRateSparkline.slice(-20)}
              width={80}
              height={24}
            />
          </div>
          <div className="flex justify-between text-xs text-on-surface-variant">
            <span>{latest.scores_validated} validated</span>
            <span>{latest.scores_pending} pending</span>
            <span>{latest.scores_failed} failed</span>
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
