"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import {
  fetchReportFollowUp,
  dismissReportAlert,
  type ReportFollowUpData,
  type MarketChange,
  type FollowUpAlert,
} from "@/lib/data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MarketUpdateBannerProps {
  /** Report ID to fetch follow-up data for */
  reportId: string;
  /** Report creation date (ISO string) */
  reportCreatedAt: string;
  /** Minimum days since report creation to show the banner */
  minDaysOld?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysSince(dateStr: string): number {
  const created = new Date(dateStr);
  const now = new Date();
  return Math.floor(
    (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24),
  );
}

function formatChangePct(pct: number): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function ChangeIndicator({ change }: { change: MarketChange }) {
  const isUp = change.changePct > 0;
  const Icon = isUp ? TrendingUp : TrendingDown;
  const colorClass = isUp
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-rose-600 dark:text-rose-400";

  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className={`w-4 h-4 ${colorClass}`} />
      <span className="font-medium">{change.metric}</span>
      <span className={colorClass}>{formatChangePct(change.changePct)}</span>
    </div>
  );
}

function AlertItem({
  alert,
  onDismiss,
}: {
  alert: FollowUpAlert;
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-rose-50 dark:bg-rose-900/20 p-3 text-sm">
      <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-rose-700 dark:text-rose-300">
          {alert.metric_name}
        </p>
        {alert.rationale && (
          <p className="text-rose-600/80 dark:text-rose-400/80 mt-0.5 text-xs">
            {alert.rationale}
          </p>
        )}
      </div>
      <button
        onClick={() => onDismiss(alert.id)}
        className="text-rose-400 hover:text-rose-600 p-0.5"
        aria-label="Dismiss alert"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * MarketUpdateBanner — In-app banner for post-delivery report engagement.
 *
 * Shows when a report is 30+ days old and has market changes or triggered alerts.
 * Displays key metric changes, triggered alerts, and an expandable AI summary.
 *
 * M3 design: tertiary container with rounded-xl shape.
 */
export function MarketUpdateBanner({
  reportId,
  reportCreatedAt,
  minDaysOld = 30,
}: MarketUpdateBannerProps): React.ReactElement | null {
  const [followUp, setFollowUp] = useState<ReportFollowUpData | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  const daysOld = daysSince(reportCreatedAt);
  const shouldShow = daysOld >= minDaysOld;

  useEffect(() => {
    if (!shouldShow) {
      setLoading(false);
      return;
    }

    fetchReportFollowUp(reportId)
      .then(setFollowUp)
      .catch(() => setFollowUp(null))
      .finally(() => setLoading(false));
  }, [reportId, shouldShow]);

  const handleDismissAlert = useCallback(
    async (alertId: string) => {
      await dismissReportAlert(reportId, alertId).catch(() => {});
      setFollowUp((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          alerts: prev.alerts.filter((a) => a.id !== alertId),
        };
      });
    },
    [reportId],
  );

  if (loading || dismissed || !shouldShow || !followUp) return null;

  const triggeredAlerts = followUp.alerts.filter(
    (a) => a.status === "triggered",
  );
  const hasChanges = followUp.marketChanges.length > 0;
  const hasAlerts = triggeredAlerts.length > 0;

  if (!hasChanges && !hasAlerts) return null;

  const topChanges = followUp.marketChanges.slice(0, 3);

  return (
    <div className="bg-tertiary-container text-on-tertiary-container rounded-xl p-4 mb-6 shadow-sm">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tertiary text-on-tertiary px-3 py-1 text-xs font-medium tracking-wide shrink-0">
            Market Update
          </span>
          <span className="text-sm opacity-80">
            {daysOld} days since report
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 text-sm font-medium hover:opacity-80 transition-opacity"
          >
            {expanded ? "Hide details" : "View full update"}
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="text-on-tertiary-container/60 hover:text-on-tertiary-container p-1"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Compact changes summary */}
      {hasChanges && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3">
          {topChanges.map((change) => (
            <ChangeIndicator key={change.metric} change={change} />
          ))}
        </div>
      )}

      {/* Triggered alerts (always visible when present) */}
      {hasAlerts && (
        <div className="mt-3 space-y-2">
          {triggeredAlerts.map((alert) => (
            <AlertItem
              key={alert.id}
              alert={alert}
              onDismiss={handleDismissAlert}
            />
          ))}
        </div>
      )}

      {/* Expanded section: full AI summary */}
      {expanded && (
        <div className="mt-4 pt-3 border-t border-on-tertiary-container/10">
          {followUp.summary ? (
            <p className="text-sm leading-relaxed">{followUp.summary}</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium">All Market Changes</p>
              {followUp.marketChanges.map((change) => (
                <ChangeIndicator key={change.metric} change={change} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
