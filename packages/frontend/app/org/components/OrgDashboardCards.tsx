"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Users,
  FileText,
  ScrollText,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { useOrg } from "../hooks/useOrg";
import {
  fetchOrgMembers,
  fetchOrgAuditLog,
  fetchOrgReportStats,
} from "@/lib/data";
import type { AuditLogEntry, OrgReportStats } from "@/lib/data";
import { SeatUsageBar } from "./SeatUsageBar";

function formatRelativeTime(dateString: string): string {
  try {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 30) return `${diffDay}d ago`;
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

/** Friendly label for audit action codes */
function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    member_invited: "Invited member",
    member_removed: "Removed member",
    role_changed: "Changed role",
    billing_updated: "Updated billing",
    settings_updated: "Updated settings",
    org_created: "Created organization",
  };
  return labels[action] ?? action.replace(/_/g, " ");
}

/**
 * Dashboard stat cards for the org admin page.
 * Shows member count with seat usage, report stats with trend, and recent activity.
 */
export function OrgDashboardCards() {
  const { org } = useOrg();
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [reportStats, setReportStats] = useState<OrgReportStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    try {
      const [membersRes, reportsRes, auditRes] = await Promise.all([
        fetchOrgMembers(org.slug),
        fetchOrgReportStats(org.slug),
        fetchOrgAuditLog(org.slug, { limit: 5 }),
      ]);
      setMemberCount(membersRes.total);
      setReportStats(reportsRes);
      setRecentActivity(auditRes.entries);
    } catch {
      // Silently degrade — cards show "—" for missing data
    } finally {
      setLoading(false);
    }
  }, [org]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const cardClass =
    "bg-surface-container-low rounded-xl shadow-sm p-6 flex flex-col";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Members card */}
      <div className={cardClass}>
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-medium text-on-surface-variant tracking-wide">
            MEMBERS
          </h3>
        </div>
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin text-on-surface-variant" />
        ) : (
          <>
            <p className="text-3xl font-semibold text-on-surface mb-3">
              {memberCount ?? "—"}
            </p>
            <SeatUsageBar
              used={memberCount ?? 0}
              total={org?.seat_count ?? 0}
            />
          </>
        )}
      </div>

      {/* Reports card */}
      <div className={cardClass}>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-medium text-on-surface-variant tracking-wide">
            REPORTS THIS MONTH
          </h3>
        </div>
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin text-on-surface-variant" />
        ) : !reportStats ? (
          <p className="text-3xl font-semibold text-on-surface">—</p>
        ) : (
          <>
            <div className="flex items-baseline gap-2 mb-3">
              <p className="text-3xl font-semibold text-on-surface">
                {reportStats.count}
              </p>
              <ReportTrendBadge
                current={reportStats.count}
                previous={reportStats.previousCount}
              />
            </div>

            {/* Per-member breakdown (top 3) */}
            {reportStats.byMember.length > 0 && (
              <ul className="space-y-1 mb-3">
                {reportStats.byMember.slice(0, 3).map((member) => (
                  <li
                    key={member.userId}
                    className="flex items-center justify-between text-xs text-on-surface-variant"
                  >
                    <span className="truncate mr-2">{member.name}</span>
                    <span className="font-medium text-on-surface">
                      {member.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* Usage progress bar (only when plan has a limit) */}
            {reportStats.limit > 0 && (
              <ReportUsageBar
                used={reportStats.count}
                limit={reportStats.limit}
              />
            )}
          </>
        )}
      </div>

      {/* Recent activity card */}
      <div className={`${cardClass} md:col-span-2 lg:col-span-1`}>
        <div className="flex items-center gap-2 mb-4">
          <ScrollText className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-medium text-on-surface-variant tracking-wide">
            RECENT ACTIVITY
          </h3>
        </div>
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin text-on-surface-variant" />
        ) : recentActivity.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No recent activity.</p>
        ) : (
          <ul className="space-y-2.5 text-sm">
            {recentActivity.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-on-surface truncate">
                    {actionLabel(entry.action)}
                  </p>
                  <p className="text-xs text-on-surface-variant truncate">
                    {entry.actor_email}
                  </p>
                </div>
                <span className="text-xs text-on-surface-variant whitespace-nowrap ml-2">
                  {formatRelativeTime(entry.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Month-over-month trend badge comparing current vs previous report count. */
function ReportTrendBadge({
  current,
  previous,
}: {
  current: number;
  previous: number;
}) {
  // Hide trend entirely for the first month (no prior data to compare)
  if (previous === 0) return null;

  const diff = current - previous;

  if (diff > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-sm font-medium text-green-600">
        <TrendingUp className="w-4 h-4" />+{diff}
      </span>
    );
  }

  if (diff < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-sm font-medium text-red-600">
        <TrendingDown className="w-4 h-4" />
        {diff}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5 text-sm font-medium text-on-surface-variant">
      <Minus className="w-4 h-4" />0
    </span>
  );
}

/** Progress bar showing report usage against the plan limit. */
function ReportUsageBar({ used, limit }: { used: number; limit: number }) {
  const percentage = Math.min((used / limit) * 100, 100);

  const fillColor =
    percentage > 95
      ? "bg-red-500"
      : percentage >= 80
        ? "bg-amber-500"
        : "bg-primary";

  return (
    <div className="space-y-1.5 mt-auto">
      <div className="h-2 w-full rounded-full bg-surface-container">
        <div
          className={`h-full rounded-full transition-all duration-300 ${fillColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-on-surface-variant">
        {used} of {limit} reports used
      </p>
    </div>
  );
}
