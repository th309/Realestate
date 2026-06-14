"use client";

import { useMemo, useState } from "react";
import { useAdminAlerts } from "../hooks/useAdminAlerts";
import type { AdminAlert } from "../hooks/useAdminAlerts";
import { StatusDot } from "../shared/StatusDot";
import type { TimeRange } from "../hooks/useTimeRange";

interface PanelProps {
  timeRange: TimeRange;
  refreshTrigger: number;
}

type FilterKey = "all" | "open" | "in-progress";

function isFeedbackAlert(alert: AdminAlert): boolean {
  return (
    alert.severity === "info" ||
    alert.message.toLowerCase().includes("feedback")
  );
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusVariant(status: AdminAlert["status"]): "info" | "warning" | "success" {
  switch (status) {
    case "active": return "info";
    case "acknowledged": return "warning";
    case "resolved": return "success";
  }
}

export function FeedbackQueuePanel({ refreshTrigger: _refreshTrigger }: PanelProps) {
  const { alerts, isLoading, acknowledge, resolve, isAcknowledging, isResolving } =
    useAdminAlerts();
  const [filter, setFilter] = useState<FilterKey>("all");

  const feedbackAlerts = useMemo(() => {
    const fb = alerts.filter(isFeedbackAlert);
    switch (filter) {
      case "open":
        return fb.filter((a) => a.status === "active");
      case "in-progress":
        return fb.filter((a) => a.status === "acknowledged");
      default:
        return fb;
    }
  }, [alerts, filter]);

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-48 bg-surface-container rounded-xl" />
      </div>
    );
  }

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "open", label: "Open" },
    { key: "in-progress", label: "In Progress" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
              filter === f.key
                ? "bg-primary text-on-primary border-primary"
                : "bg-surface border-outline-variant text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!feedbackAlerts.length ? (
        <p className="text-sm text-on-surface-variant py-4">
          No feedback items match the current filter
        </p>
      ) : (
        <div className="space-y-2">
          {feedbackAlerts.map((alert) => (
            <div
              key={alert.id}
              className="border border-outline-variant rounded-xl p-3 space-y-2"
            >
              <div className="flex items-start gap-2">
                <StatusDot variant={statusVariant(alert.status)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-on-surface">{alert.message}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {formatTimestamp(alert.createdAt)}
                  </p>
                </div>
              </div>
              {alert.status === "active" && (
                <div className="flex gap-2 pl-5">
                  <button
                    onClick={() => acknowledge(alert.id)}
                    disabled={isAcknowledging}
                    className="text-xs px-2.5 py-1 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container disabled:opacity-50"
                  >
                    Acknowledge
                  </button>
                  <button
                    onClick={() => resolve(alert.id)}
                    disabled={isResolving}
                    className="text-xs px-2.5 py-1 rounded-lg bg-primary text-on-primary hover:opacity-90 disabled:opacity-50"
                  >
                    Resolve
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
