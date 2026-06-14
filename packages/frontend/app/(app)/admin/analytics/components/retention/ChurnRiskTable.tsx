/**
 * ChurnRiskTable
 *
 * Displays at-risk users ordered by churn likelihood. Email addresses are
 * masked for privacy: only the first character + *** + @domain is shown.
 * Columns: Email (masked), Last Seen, Sessions, Tier, Top Features.
 */

"use client";

import { AlertTriangle } from "lucide-react";

interface ChurnRiskUser {
  userId: string;
  email?: string;
  lastSeen: string;
  sessionCount: number;
  tier: string | null;
  topFeatures: string[];
}

interface ChurnRiskTableProps {
  users: ChurnRiskUser[];
}

function maskEmail(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex < 1) return "***@hidden";
  const firstChar = email[0];
  const domain = email.slice(atIndex);
  return `${firstChar}***${domain}`;
}

function formatLastSeen(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function TierBadge({ tier }: { tier: string | null }) {
  const colorMap: Record<string, string> = {
    free: "bg-surface-container-high text-on-surface-variant",
    pro: "bg-blue-100 text-blue-700",
    enterprise: "bg-amber-100 text-amber-700",
    trial: "bg-indigo-100 text-indigo-700",
  };
  const normalized = tier?.toLowerCase() || "free";
  const color =
    colorMap[normalized] ?? "bg-surface-container-high text-on-surface-variant";
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${color}`}
    >
      {normalized}
    </span>
  );
}

function LastSeenCell({ dateStr }: { dateStr: string }) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  const urgency =
    diffDays > 21
      ? "text-red-600"
      : diffDays > 7
        ? "text-amber-600"
        : "text-on-surface-variant";
  return (
    <span className={`text-sm ${urgency}`}>{formatLastSeen(dateStr)}</span>
  );
}

export function ChurnRiskTable({ users }: ChurnRiskTableProps) {
  if (users.length === 0) {
    return (
      <div className="bg-surface-container rounded-xl p-6">
        <h3 className="text-base font-medium text-on-surface mb-4">
          Churn Risk Users
        </h3>
        <div className="flex items-center justify-center h-24 text-on-surface-variant text-sm">
          No at-risk users detected in this period.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-container rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <h3 className="text-base font-medium text-on-surface">
            Churn Risk Users
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
            {users.length}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-outline-variant">
              <th className="pb-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                Email
              </th>
              <th className="pb-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                Last Seen
              </th>
              <th className="pb-3 text-right text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                Sessions
              </th>
              <th className="pb-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider pl-4">
                Tier
              </th>
              <th className="pb-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                Top Features
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.userId}
                className="border-b border-outline-variant last:border-0 hover:bg-surface-container-high/50 transition-colors"
              >
                <td className="py-3 pr-4">
                  <span className="text-sm font-mono text-on-surface">
                    {user.email ? maskEmail(user.email) : "—"}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <LastSeenCell dateStr={user.lastSeen} />
                </td>
                <td className="py-3 pr-4 text-right">
                  <span className="text-sm text-on-surface-variant">
                    {user.sessionCount.toLocaleString()}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <TierBadge tier={user.tier} />
                </td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-1">
                    {user.topFeatures.slice(0, 3).map((feature) => (
                      <span
                        key={feature}
                        className="text-xs px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant"
                      >
                        {feature}
                      </span>
                    ))}
                    {user.topFeatures.length > 3 && (
                      <span className="text-xs text-on-surface-variant">
                        +{user.topFeatures.length - 3}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
