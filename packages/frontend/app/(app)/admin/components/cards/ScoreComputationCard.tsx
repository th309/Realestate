"use client";

import { Calculator } from "lucide-react";
import { DashboardCard } from "../shared/DashboardCard";
import { useAdminTimeSeries } from "../hooks/useAdminTimeSeries";

interface ScoreSnapshot {
  timestamp: string;
  score_type: string;
  scores_validated: number;
  scores_pending: number;
  scores_failed: number;
}

interface ScoreComputationCardProps {
  refreshTrigger: number;
  onClick: () => void;
}

export function ScoreComputationCard({
  refreshTrigger,
  onClick,
}: ScoreComputationCardProps) {
  const { data, isLoading, error } = useAdminTimeSeries<ScoreSnapshot[]>(
    "score-history",
    undefined,
    { refreshTrigger },
  );

  const rows = data ?? [];
  // Aggregate latest per score_type
  const latestByType = new Map<string, ScoreSnapshot>();
  for (const row of rows) {
    const existing = latestByType.get(row.score_type);
    if (!existing || row.timestamp > existing.timestamp) {
      latestByType.set(row.score_type, row);
    }
  }
  const models = Array.from(latestByType.values());
  const totalValidated = models.reduce((s, m) => s + m.scores_validated, 0);
  const totalPending = models.reduce((s, m) => s + m.scores_pending, 0);
  const totalFailed = models.reduce((s, m) => s + m.scores_failed, 0);
  const total = totalValidated + totalPending + totalFailed;
  const completePct =
    total > 0 ? ((totalValidated / total) * 100).toFixed(0) : "\u2014";

  return (
    <DashboardCard
      title="Score Computation"
      icon={Calculator}
      badge={
        total > 0
          ? {
              text: `${completePct}% complete`,
              color:
                totalFailed > 0
                  ? "bg-red-500/10 text-red-700"
                  : "bg-green-500/10 text-green-700",
            }
          : undefined
      }
      loading={isLoading}
      error={error?.message ?? null}
      onClick={onClick}
    >
      {total > 0 ? (
        <div className="space-y-3">
          {/* Progress bar */}
          <div className="h-2 bg-surface-container-high rounded-full overflow-hidden flex">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${(totalValidated / total) * 100}%` }}
            />
            <div
              className="h-full bg-amber-400 transition-all"
              style={{ width: `${(totalPending / total) * 100}%` }}
            />
            <div
              className="h-full bg-red-500 transition-all"
              style={{ width: `${(totalFailed / total) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-on-surface-variant">
            <span className="text-green-600">{totalValidated} validated</span>
            <span className="text-amber-600">{totalPending} pending</span>
            <span className="text-red-600">{totalFailed} failed</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant">
          No computation data available
        </p>
      )}
    </DashboardCard>
  );
}
