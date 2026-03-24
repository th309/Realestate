"use client";

import React, { useState } from "react";
import { Trash2, Clock, Zap } from "lucide-react";
import type { ApiKeyListItem } from "@/lib/data/fetchers/org-api-keys";

interface ApiKeyCardProps {
  apiKey: ApiKeyListItem;
  onRevoke: (id: string) => void;
}

/** Color mapping for scope categories. */
function getScopeColor(scope: string): string {
  if (scope.endsWith(":write")) {
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
  }
  return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
}

/** Human-readable scope labels. */
const SCOPE_LABELS: Record<string, string> = {
  "scores:read": "Scores (read)",
  "metrics:read": "Metrics (read)",
  "rankings:read": "Rankings (read)",
  "reports:read": "Reports (read)",
  "reports:write": "Reports (write)",
  "watchlist:read": "Watchlist (read)",
  "watchlist:write": "Watchlist (write)",
};

function formatRelativeDate(dateString: string): string {
  const now = Date.now();
  const created = new Date(dateString).getTime();
  const diffSeconds = Math.floor((now - created) / 1000);

  if (diffSeconds < 60) return "just now";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${Math.floor(diffMonths / 12)}y ago`;
}

/**
 * Card displaying a single API key with its prefix, scopes, rate limit,
 * last usage timestamp, and a revoke button with confirmation.
 */
export function ApiKeyCard({ apiKey, onRevoke }: ApiKeyCardProps) {
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  return (
    <div className="bg-surface-container-low rounded-xl shadow-sm border border-outline-variant/50">
      <div className="p-5">
        {/* Header row: name + key prefix + revoke */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-base font-medium text-on-surface truncate">
              {apiKey.name}
            </h3>
            <p className="font-mono text-xs text-on-surface-variant mt-0.5">
              {apiKey.key_prefix}...
            </p>
          </div>

          {!confirmRevoke ? (
            <button
              onClick={() => setConfirmRevoke(true)}
              className="shrink-0 rounded-full p-2 text-on-surface-variant hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 transition-colors"
              aria-label={`Revoke API key ${apiKey.name}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setConfirmRevoke(false)}
                className="rounded-full px-3 py-1 text-xs font-medium text-on-surface-variant hover:bg-surface-container-high transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => onRevoke(apiKey.id)}
                className="rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 transition-colors"
              >
                Confirm Revoke
              </button>
            </div>
          )}
        </div>

        {/* Scopes */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {apiKey.scopes.map((scope) => (
            <span
              key={scope}
              className={`rounded-lg px-2 py-0.5 text-xs font-medium ${getScopeColor(scope)}`}
            >
              {SCOPE_LABELS[scope] ?? scope}
            </span>
          ))}
        </div>

        {/* Metadata row: rate limit + last used + created */}
        <div className="mt-3 flex items-center gap-4 text-xs text-on-surface-variant">
          <span className="inline-flex items-center gap-1">
            <Zap className="w-3 h-3" />
            {apiKey.rate_limit_rpm} RPM
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {apiKey.last_used_at
              ? `Used ${formatRelativeDate(apiKey.last_used_at)}`
              : "Never used"}
          </span>
          <span>Created {formatRelativeDate(apiKey.created_at)}</span>
        </div>
      </div>
    </div>
  );
}
