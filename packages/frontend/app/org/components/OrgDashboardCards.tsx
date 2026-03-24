"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Users, FileText, ScrollText, Loader2 } from "lucide-react";
import { useOrg } from "../hooks/useOrg";
import { fetchOrgMembers, fetchOrgAuditLog } from "@/lib/data";
import type { AuditLogEntry } from "@/lib/data";
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
 * Shows member count with seat usage, a reports placeholder, and recent activity.
 */
export function OrgDashboardCards() {
  const { org } = useOrg();
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [recentActivity, setRecentActivity] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    try {
      const [membersRes, auditRes] = await Promise.all([
        fetchOrgMembers(org.slug),
        fetchOrgAuditLog(org.slug, { limit: 5 }),
      ]);
      setMemberCount(membersRes.total);
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

      {/* Reports card (placeholder) */}
      <div className={cardClass}>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-medium text-on-surface-variant tracking-wide">
            REPORTS THIS MONTH
          </h3>
        </div>
        <p className="text-3xl font-semibold text-on-surface mb-1">—</p>
        <p className="text-xs text-on-surface-variant mt-auto">
          Report analytics coming soon
        </p>
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
