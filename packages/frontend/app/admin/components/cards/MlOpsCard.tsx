"use client";

import { Brain } from "lucide-react";
import { DashboardCard } from "../shared/DashboardCard";
import { StatusDot } from "../shared/StatusDot";
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

interface MlOpsCardProps {
  refreshTrigger: number;
  onClick: () => void;
}

export function MlOpsCard({ refreshTrigger, onClick }: MlOpsCardProps) {
  const { data, isLoading, error } = useAdminTimeSeries<ScoreSnapshot[]>(
    "score-history",
    undefined,
    { refreshTrigger },
  );

  const rows = data ?? [];
  // Group by score_type to show per-model status
  const latestByType = new Map<string, ScoreSnapshot>();
  for (const row of rows) {
    const existing = latestByType.get(row.score_type);
    if (!existing || row.timestamp > existing.timestamp) {
      latestByType.set(row.score_type, row);
    }
  }
  const models = Array.from(latestByType.values());
  const allHealthy = models.every((m) => m.scores_failed === 0);

  return (
    <DashboardCard
      title="ML Ops"
      icon={Brain}
      badge={{
        text: allHealthy
          ? "Healthy"
          : `${models.filter((m) => m.scores_failed > 0).length} issues`,
        color: allHealthy
          ? "bg-green-500/10 text-green-700"
          : "bg-amber-500/10 text-amber-700",
      }}
      loading={isLoading}
      error={error?.message ?? null}
      onClick={onClick}
    >
      {models.length > 0 ? (
        <ul className="space-y-1.5">
          {models.slice(0, 5).map((model) => (
            <li
              key={model.score_type}
              className="flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2">
                <StatusDot
                  variant={model.scores_failed === 0 ? "success" : "warning"}
                  size="sm"
                />
                <span className="text-on-surface capitalize">
                  {model.score_type.replace(/_/g, " ")}
                </span>
              </div>
              <span className="font-mono text-on-surface-variant">
                {(model.correlation_1y * 100).toFixed(0)}% corr
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-on-surface-variant">
          No model data available
        </p>
      )}
    </DashboardCard>
  );
}
