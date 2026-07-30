/**
 * ChurnRiskTable
 *
 * Displays at-risk users ordered by churn likelihood. Email addresses are
 * masked for privacy: only the first character + *** + @domain is shown.
 * Columns: Email (masked), Last Seen, Sessions, Tier, Top Features.
 */

"use client";

import { useEffect, useState } from "react";
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

/**
 * This panel exists to decide who to contact, so it shows the full address.
 *
 * It previously masked to `a***@gmail.com` — but the RPC did not return an
 * email at all, so every row rendered an em dash and the masking never ran on
 * real data. Now that the address is available, masking would leave the table
 * exactly as unusable as the UUID column it replaced: you cannot mail
 * `a***@gmail.com`.
 *
 * Safe here specifically: the route is behind AdminGuard, the query executes as
 * service_role, and the RPC excludes internal accounts. Do not reuse this
 * pattern on any non-admin surface.
 */
function mailtoHref(email: string): string {
  return `mailto:${encodeURIComponent(email)}`;
}

function formatLastSeen(dateStr: string, nowMs: number | null): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "—";
  // Pre-effect: an absolute date rather than a relative one we cannot compute.
  if (nowMs === null) return date.toISOString().slice(0, 10);
  const diffMs = nowMs - date.getTime();
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

/**
 * `nowMs` is passed in rather than read from Date.now() here.
 *
 * Calling Date.now() during render is impure: two renders of the same data can
 * disagree, and a row can silently flip category mid-session. It also made the
 * urgency colour and the label capable of disagreeing with each other, since
 * each computed its own "now".
 *
 * Colours are semantic tokens, not raw Tailwind palette (CLAUDE.md §8.2) — the
 * previous text-red-600 / text-amber-600 were fixed light-mode values that did
 * not flip for dark mode, and red-600 on the dark card surface fails contrast.
 */
function LastSeenCell({
  dateStr,
  nowMs,
}: {
  dateStr: string;
  nowMs: number | null;
}) {
  const diffDays =
    nowMs === null
      ? 0
      : Math.floor((nowMs - new Date(dateStr).getTime()) / 86400000);
  const urgency =
    diffDays > 21
      ? "text-error"
      : diffDays > 7
        ? "text-warning"
        : "text-on-surface-variant";
  return (
    <span className={`text-sm ${urgency}`}>
      {formatLastSeen(dateStr, nowMs)}
    </span>
  );
}

export function ChurnRiskTable({ users }: ChurnRiskTableProps) {
  // Read the clock in an effect, never during render.
  //
  // Date.now() in the render path is impure — two renders of the same data can
  // disagree, so a row could flip urgency category mid-session, and the label
  // and colour each computed their own "now". It is also a hydration hazard:
  // server and client render at different instants, so "3d ago" can mismatch.
  //
  // Until the effect runs, rows show the absolute date, which is always true.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    // Reading the wall clock IS synchronising with an external system — the one
    // case this rule exempts. It runs once per data change and settles
    // immediately; there is no cascade. The alternative, Date.now() during
    // render, is the impurity this replaced.
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setNowMs(Date.now());
  }, [users]);
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
                  {user.email ? (
                    <a
                      href={mailtoHref(user.email)}
                      className="text-sm font-mono text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded"
                    >
                      {user.email}
                    </a>
                  ) : (
                    // Account deleted — still a churn signal, so the row stays.
                    <span className="text-sm font-mono text-on-surface-variant">
                      account removed
                    </span>
                  )}
                </td>
                <td className="py-3 pr-4">
                  <LastSeenCell dateStr={user.lastSeen} nowMs={nowMs} />
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
