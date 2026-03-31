"use client";

import { useState } from "react";
import { Trash2, Clock } from "lucide-react";
import type { UserApiKeyListItem } from "@/lib/data";
import { AVAILABLE_SCOPES } from "./scopes";

interface PersonalApiKeyCardProps {
  apiKey: UserApiKeyListItem;
  onRevoke: (id: string) => void;
}

function formatRelativeDate(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffSeconds = Math.floor((now - then) / 1000);

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
 * Card displaying a single personal API key: name, prefix, scopes,
 * creation date, last-used timestamp, and a two-step revoke action.
 */
export function PersonalApiKeyCard({
  apiKey,
  onRevoke,
}: PersonalApiKeyCardProps) {
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  return (
    <div className="bg-surface-container-low rounded-xl shadow-sm border border-outline-variant/50">
      <div className="p-5">
        {/* Header: name + prefix + revoke */}
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
              aria-label={`Revoke API key "${apiKey.name}"`}
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

        {/* Scope chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {apiKey.scopes.map((scope) => (
            <span
              key={scope}
              className="rounded-lg px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
            >
              {AVAILABLE_SCOPES.find((s) => s.value === scope)?.label ?? scope}
            </span>
          ))}
        </div>

        {/* Metadata: created + last used */}
        <div className="mt-3 flex items-center gap-4 text-xs text-on-surface-variant">
          <span>Created {formatRelativeDate(apiKey.created_at)}</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {apiKey.last_used_at ? (
              `Used ${formatRelativeDate(apiKey.last_used_at)}`
            ) : (
              <a
                href="/docs/api#getting-started"
                className="text-primary hover:underline"
              >
                Never used — See quickstart
              </a>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
