"use client";

import React, { useState } from "react";
import { Trash2, Globe, Code, ChevronDown, ChevronUp } from "lucide-react";
import type { EmbedTokenListItem } from "@/lib/data";
import { EmbedCodeSnippet } from "./EmbedCodeSnippet";

interface EmbedTokenCardProps {
  token: EmbedTokenListItem;
  baseUrl: string;
  onRevoke: (id: string) => void;
}

const WIDGET_TYPE_LABELS: Record<string, string> = {
  score: "Score Ring",
  "metric-card": "Metric Card",
  map: "Interactive Map",
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
 * Card displaying a single embed token with its settings,
 * a collapsible code snippet section, and a revoke button.
 */
export function EmbedTokenCard({
  token,
  baseUrl,
  onRevoke,
}: EmbedTokenCardProps) {
  const [showCode, setShowCode] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  return (
    <div className="bg-surface-container-low rounded-xl shadow-sm border border-outline-variant/50">
      <div className="p-5">
        {/* Header row: name + revoke */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-base font-medium text-on-surface truncate">
              {token.name}
            </h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Created {formatRelativeDate(token.created_at)}
            </p>
          </div>

          {!confirmRevoke ? (
            <button
              onClick={() => setConfirmRevoke(true)}
              className="shrink-0 rounded-full p-2 text-on-surface-variant hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 transition-colors"
              aria-label={`Revoke token ${token.name}`}
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
                onClick={() => onRevoke(token.id)}
                className="rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 transition-colors"
              >
                Confirm Revoke
              </button>
            </div>
          )}
        </div>

        {/* Origins */}
        <div className="mt-3 flex items-start gap-2">
          <Globe className="w-3.5 h-3.5 text-on-surface-variant mt-0.5 shrink-0" />
          <div className="flex flex-wrap gap-1.5">
            {token.allowed_origins.map((origin) => (
              <span
                key={origin}
                className="rounded-lg border border-outline-variant bg-surface px-2 py-0.5 text-xs text-on-surface-variant"
              >
                {origin}
              </span>
            ))}
          </div>
        </div>

        {/* Widget types */}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {token.widget_types.map((widgetType) => (
            <span
              key={widgetType}
              className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
            >
              {WIDGET_TYPE_LABELS[widgetType] ?? widgetType}
            </span>
          ))}
        </div>

        {/* Toggle code */}
        <button
          onClick={() => setShowCode(!showCode)}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          <Code className="w-3.5 h-3.5" />
          {showCode ? "Hide Code" : "Show Code"}
          {showCode ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </button>
      </div>

      {/* Collapsible code snippet */}
      {showCode && (
        <div className="border-t border-outline-variant/50 p-5 pt-4">
          <EmbedCodeSnippet token={token.id} baseUrl={baseUrl} />
        </div>
      )}
    </div>
  );
}
