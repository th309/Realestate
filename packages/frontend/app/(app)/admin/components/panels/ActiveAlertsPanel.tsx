"use client";

import { useState } from "react";
import type { TimeRange } from "../hooks/useTimeRange";
import {
  useAdminAlerts,
  type AlertStatus,
  type AlertSeverity,
} from "../hooks/useAdminAlerts";
import { StatusDot } from "../shared/StatusDot";

interface PanelProps {
  timeRange: TimeRange;
  refreshTrigger: number;
}

type FilterKey = "all" | AlertStatus;

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "resolved", label: "Resolved" },
];

const SEVERITY_VARIANT: Record<AlertSeverity, "error" | "warning" | "info"> = {
  critical: "error",
  warning: "warning",
  info: "info",
};

function formatAlertTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ActiveAlertsPanel({
  refreshTrigger: _refreshTrigger,
}: PanelProps) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const statusFilter = filter === "all" ? undefined : filter;
  const { alerts, isLoading, acknowledge, resolve } =
    useAdminAlerts(statusFilter);

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-48 bg-surface-container rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setFilter(opt.key)}
            className={`px-3 py-1 text-sm rounded-full transition-colors ${
              filter === opt.key
                ? "bg-primary text-on-primary"
                : "bg-surface-container text-on-surface hover:bg-surface-container-high"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {alerts.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No alerts found</p>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const isUnresolved = alert.status !== "resolved";
            return (
              <div
                key={alert.id}
                className="border border-outline-variant rounded-xl p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <StatusDot
                      variant={SEVERITY_VARIANT[alert.severity]}
                      pulse={
                        alert.status === "active" &&
                        alert.severity === "critical"
                      }
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-on-surface">
                        {alert.title}
                      </span>
                      <span className="text-xs text-on-surface-variant">
                        {alert.status}
                      </span>
                    </div>
                    <p className="text-sm text-on-surface-variant mt-1">
                      {alert.message}
                    </p>
                    {alert.metadata?.source != null ? (
                      <p className="text-xs text-on-surface-variant mt-1">
                        Source: {String(alert.metadata.source)}
                      </p>
                    ) : null}
                    <p className="text-xs text-on-surface-variant mt-1">
                      {formatAlertTime(alert.createdAt)}
                    </p>
                  </div>
                  {isUnresolved && (
                    <div className="flex gap-2 shrink-0">
                      {alert.status === "active" && (
                        <button
                          onClick={() => acknowledge(alert.id)}
                          className="px-3 py-1 text-xs rounded-full bg-surface-container hover:bg-surface-container-high transition-colors"
                        >
                          Acknowledge
                        </button>
                      )}
                      <button
                        onClick={() => resolve(alert.id)}
                        className="px-3 py-1 text-xs rounded-full bg-green-500/10 hover:bg-green-500/20 text-green-700 transition-colors"
                      >
                        Resolve
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
