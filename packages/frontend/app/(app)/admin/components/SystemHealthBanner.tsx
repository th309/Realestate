"use client";

import React from "react";
import type { SystemStatus, HealthSummary } from "./hooks/useSystemHealth";

interface SystemHealthBannerProps {
  status: SystemStatus;
  summary: HealthSummary | null;
  lastRefresh: Date;
  onRefresh: () => void;
}

const STATUS_CONFIG: Record<
  SystemStatus,
  { dot: string; banner: string; label: string }
> = {
  healthy: {
    dot: "bg-green-500",
    banner: "bg-green-500/10 text-green-700 border-green-500/20",
    label: "All Systems Operational",
  },
  degraded: {
    dot: "bg-amber-500",
    banner: "bg-amber-500/10 text-amber-700 border-amber-500/20",
    label: "Some Issues Detected",
  },
  error: {
    dot: "bg-red-500",
    banner: "bg-red-500/10 text-red-700 border-red-500/20",
    label: "System Issues",
  },
  loading: {
    dot: "bg-gray-400 animate-pulse",
    banner: "bg-surface-container border-outline-variant",
    label: "Checking...",
  },
};

function formatTimeSinceRefresh(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return "just now";
  if (diffMins === 1) return "1 min ago";
  return `${diffMins} mins ago`;
}

export function SystemHealthBanner({
  status,
  summary,
  lastRefresh,
  onRefresh,
}: SystemHealthBannerProps) {
  const { dot, banner, label } = STATUS_CONFIG[status];
  const isLoading = status === "loading";

  return (
    <div
      className={`mx-6 rounded-xl border py-2.5 px-4 flex items-center justify-between ${banner}`}
    >
      {/* Left: status dot + label + summary */}
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
        <span className="text-sm font-medium">{label}</span>
        {summary && !isLoading && (
          <span className="text-sm opacity-75 ml-1">
            — {summary.available}/{summary.total} sources available,{" "}
            {summary.fresh}/{summary.total} data fresh
          </span>
        )}
        {isLoading && (
          <span className="h-3 w-48 rounded bg-on-surface/10 animate-pulse" />
        )}
      </div>

      {/* Right: last checked + refresh */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs opacity-60">
          {formatTimeSinceRefresh(lastRefresh)}
        </span>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="text-xs font-medium hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
