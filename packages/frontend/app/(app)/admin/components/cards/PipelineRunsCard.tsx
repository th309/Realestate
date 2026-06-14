"use client";

import { useState, useEffect } from "react";
import { Play } from "lucide-react";
import { fetchAPIRaw } from "@/lib/data";
import { DashboardCard } from "../shared/DashboardCard";
import { StatusDot } from "../shared/StatusDot";

interface PipelineRun {
  pipelineName: string;
  displayName?: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  recordsProcessed?: number;
  durationMs?: number;
}

interface PipelineRunsCardProps {
  refreshTrigger: number;
  onClick: () => void;
}

const STATUS_VARIANT: Record<string, "success" | "warning" | "error" | "info"> =
  {
    success: "success",
    partial: "warning",
    failed: "error",
    running: "info",
  };

function formatDuration(ms: number | undefined): string {
  if (!ms) return "\u2014";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function PipelineRunsCard({
  refreshTrigger,
  onClick,
}: PipelineRunsCardProps) {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchAPIRaw("/api/health/pipeline-runs");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const list: PipelineRun[] = Array.isArray(json)
          ? json
          : (json.pipelines ?? json.data ?? json.runs ?? []);
        if (!cancelled) setRuns(list);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  const recent = runs.slice(0, 4);
  const successCount = runs.filter((r) => r.status === "success").length;
  const failCount = runs.filter((r) => r.status === "failed").length;

  return (
    <DashboardCard
      title="Pipeline Runs"
      icon={Play}
      badge={
        runs.length > 0
          ? {
              text: `${successCount}\u2713 ${failCount}\u2717`,
              color:
                failCount > 0
                  ? "bg-red-500/10 text-red-700"
                  : "bg-green-500/10 text-green-700",
            }
          : undefined
      }
      loading={loading}
      error={error}
      onClick={onClick}
    >
      {recent.length > 0 ? (
        <ul className="space-y-1.5">
          {recent.map((run, i) => (
            <li
              key={`${run.pipelineName}-${i}`}
              className="flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2">
                <StatusDot
                  variant={STATUS_VARIANT[run.status] ?? "neutral"}
                  pulse={run.status === "running"}
                />
                <span className="text-on-surface truncate max-w-[140px]">
                  {run.displayName ?? run.pipelineName}
                </span>
              </div>
              <div className="flex items-center gap-2 text-on-surface-variant font-mono">
                <span>{formatDuration(run.durationMs)}</span>
                <span>{formatRelativeTime(run.startedAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-on-surface-variant">
          No pipeline runs recorded
        </p>
      )}
    </DashboardCard>
  );
}
