"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  ScrollText,
  Users,
  Shield,
  CreditCard,
  Settings,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useOrg } from "../../../hooks/useOrg";
import { fetchOrgAuditLog } from "@/lib/data";
import type { AuditLogEntry } from "@/lib/data";

/** Map action codes to icons and labels */
function actionDisplay(action: string): {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
} {
  const map: Record<
    string,
    { icon: React.ComponentType<{ className?: string }>; label: string }
  > = {
    member_invited: { icon: Users, label: "Member invited" },
    member_removed: { icon: Users, label: "Member removed" },
    role_changed: { icon: Shield, label: "Role changed" },
    billing_updated: { icon: CreditCard, label: "Billing updated" },
    seats_updated: { icon: CreditCard, label: "Seats updated" },
    settings_updated: { icon: Settings, label: "Settings updated" },
    org_created: { icon: ScrollText, label: "Organization created" },
  };

  if (map[action]) return map[action];

  return {
    icon: ScrollText,
    label: action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  };
}

function formatTimestamp(dateString: string): string {
  try {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

/** Derive a human-readable target description from the entry details */
function targetDescription(entry: AuditLogEntry): string {
  if (entry.details?.target_email) {
    return String(entry.details.target_email);
  }
  if (entry.target_id) {
    return entry.target_id;
  }
  return "—";
}

const PAGE_SIZE = 20;

/**
 * Audit log page for enterprise admin.
 * Shows paginated audit entries with action icon, actor, target, timestamp.
 */
export default function OrgAdminAudit() {
  const { org } = useOrg();

  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [actionFilter, setActionFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const loadInitial = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchOrgAuditLog(org.slug, {
        limit: PAGE_SIZE,
        ...(actionFilter && { action_prefix: actionFilter }),
        ...(fromDate && { from: fromDate }),
        ...(toDate && { to: toDate }),
      });
      setEntries(res.entries);
      setNextCursor(res.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, [org, actionFilter, fromDate, toDate]);

  // Reset entries and cursor when filters change, then reload
  useEffect(() => {
    setEntries([]);
    setNextCursor(null);
    void loadInitial();
  }, [loadInitial]);

  const loadMore = useCallback(async () => {
    if (!org || !nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await fetchOrgAuditLog(org.slug, {
        cursor: nextCursor,
        limit: PAGE_SIZE,
        ...(actionFilter && { action_prefix: actionFilter }),
        ...(fromDate && { from: fromDate }),
        ...(toDate && { to: toDate }),
      });
      setEntries((prev) => [...prev, ...res.entries]);
      setNextCursor(res.nextCursor);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load more entries",
      );
    } finally {
      setLoadingMore(false);
    }
  }, [org, nextCursor, actionFilter, fromDate, toDate]);

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-on-surface">Audit Log</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Activity history for your organization
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-sm"
        >
          <option value="">All Actions</option>
          <option value="member">Member Events</option>
          <option value="billing,seats">Billing</option>
          <option value="org">Settings</option>
          <option value="api_key">API Keys</option>
          <option value="embed_token">Embeds</option>
          <option value="branding,logo">Branding</option>
        </select>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-sm"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-sm"
        />
        {(actionFilter || fromDate || toDate) && (
          <button
            onClick={() => {
              setActionFilter("");
              setFromDate("");
              setToDate("");
            }}
            className="text-xs text-primary hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-on-surface-variant" />
        </div>
      ) : error && entries.length === 0 ? (
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-6 text-center">
          <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-on-surface-variant">{error}</p>
          <button
            onClick={() => void loadInitial()}
            className="mt-3 rounded-full bg-primary px-5 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-8 text-center">
          <ScrollText className="w-8 h-8 text-on-surface-variant mx-auto mb-2" />
          <p className="text-on-surface-variant">No audit entries yet.</p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="rounded-xl border border-outline-variant overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant">
                  <th className="text-left px-4 py-3 font-medium text-on-surface-variant">
                    Action
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-on-surface-variant">
                    Actor
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-on-surface-variant hidden sm:table-cell">
                    Target
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-on-surface-variant hidden md:table-cell">
                    Timestamp
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {entries.map((entry) => {
                  const display = actionDisplay(entry.action);
                  const Icon = display.icon;
                  return (
                    <tr
                      key={entry.id}
                      className="bg-surface hover:bg-surface-container/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-on-surface-variant shrink-0" />
                          <span className="text-on-surface">
                            {display.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {entry.actor_id || "System"}
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant hidden sm:table-cell">
                        {targetDescription(entry)}
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant hidden md:table-cell whitespace-nowrap">
                        {formatTimestamp(entry.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Inline error */}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-3">
              {error}
            </p>
          )}

          {/* Load more */}
          {nextCursor && (
            <div className="mt-4 text-center">
              <button
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="rounded-full border border-outline-variant px-6 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50"
              >
                {loadingMore ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                  </span>
                ) : (
                  "Load More"
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
