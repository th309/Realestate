"use client";

import { useCallback, useEffect, useState } from "react";
import type { TimeRange } from "../hooks/useTimeRange";
import { fetchAPIRaw } from "@/lib/data";
import { StatusDot } from "../shared/StatusDot";

interface PanelProps {
  timeRange: TimeRange;
  refreshTrigger: number;
}

interface PipelineRun {
  pipeline_name: string;
  display_name?: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  records_processed?: number;
  records_failed?: number;
  duration_ms?: number;
}

type DotVariant = "success" | "warning" | "error" | "info" | "neutral";

const STATUS_MAP: Record<string, DotVariant> = {
  success: "success",
  partial: "warning",
  failed: "error",
  running: "info",
};

function formatDuration(ms?: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PipelineRunsPanel({ refreshTrigger }: PanelProps) {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRuns = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchAPIRaw("/api/health/pipeline-runs");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRuns(Array.isArray(data) ? data : (data.runs ?? []));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns, refreshTrigger]);

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-48 bg-surface-container rounded-xl" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-500">Error: {error}</p>;
  }

  if (!runs.length) {
    return (
      <p className="text-sm text-on-surface-variant">No data recorded yet</p>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-on-surface mb-3">
        Pipeline Run History
      </h3>
      <div className="border border-outline-variant rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-container">
            <tr>
              <th className="text-left px-3 py-2 text-on-surface-variant font-medium">
                Pipeline
              </th>
              <th className="text-center px-3 py-2 text-on-surface-variant font-medium">
                Status
              </th>
              <th className="text-right px-3 py-2 text-on-surface-variant font-medium">
                Duration
              </th>
              <th className="text-right px-3 py-2 text-on-surface-variant font-medium">
                Records
              </th>
              <th className="text-right px-3 py-2 text-on-surface-variant font-medium">
                Time
              </th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run, i) => {
              const variant: DotVariant = STATUS_MAP[run.status] ?? "neutral";
              const pulse = run.status === "running";
              return (
                <tr
                  key={`${run.pipeline_name}-${i}`}
                  className="border-t border-outline-variant"
                >
                  <td className="px-3 py-2">
                    {run.display_name ?? run.pipeline_name}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <StatusDot variant={variant} pulse={pulse} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatDuration(run.duration_ms)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {run.records_processed ?? "—"}
                    {run.records_failed ? (
                      <span className="text-red-500 ml-1">
                        ({run.records_failed} err)
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    {formatTime(run.started_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
