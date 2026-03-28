"use client";

import React, { useState, useCallback } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Trash2,
  Target,
  BarChart3,
  Map,
  Globe,
  TrendingUp,
  FileText,
} from "lucide-react";
import type { EmbedTokenListItem, EmbedConfig } from "@/lib/data";
import { WIDGET_TYPE_LABELS } from "./embed-builder-types";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  score: Target,
  metric_card: BarChart3,
  map: Map,
  map_full: Globe,
  chart: TrendingUp,
  report: FileText,
};

function formatRelativeDate(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString();
}

interface ExistingEmbedsProps {
  embeds: EmbedTokenListItem[];
  orgSlug: string;
  onRevoke: (id: string) => void;
}

export function ExistingEmbeds({
  embeds,
  onRevoke,
}: ExistingEmbedsProps) {
  const activeEmbeds = embeds.filter((e) => e.is_active);
  const [expanded, setExpanded] = useState(activeEmbeds.length > 0);

  return (
    <div id="existing-embeds" className="mt-8">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-on-surface hover:text-primary transition-colors"
      >
        {expanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
        <h3 className="text-base font-medium">
          Your Existing Embeds ({activeEmbeds.length})
        </h3>
      </button>

      {expanded && (
        <div className="mt-4">
          {embeds.length === 0 ? (
            <p className="text-sm text-on-surface-variant py-4">
              No embeds yet. Use the builder above to create your first one!
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {embeds.map((embed) => (
                <EmbedCard
                  key={embed.id}
                  embed={embed}
                  onRevoke={onRevoke}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmbedCard({
  embed,
  onRevoke,
}: {
  embed: EmbedTokenListItem;
  onRevoke: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const config = embed.embed_config as EmbedConfig | null | undefined;
  const widgetType = config?.widgetType || embed.widget_types[0] || "score";
  const Icon = ICON_MAP[widgetType] || Target;
  const origin = embed.allowed_origins[0] || "";
  const originDomain = (() => {
    try {
      return new URL(origin).hostname;
    } catch {
      return origin;
    }
  })();

  const handleCopy = useCallback(async () => {
    if (!config?.snippet) return;
    try {
      await navigator.clipboard.writeText(config.snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [config]);

  const handleRevoke = useCallback(() => {
    onRevoke(embed.id);
    setConfirmRevoke(false);
  }, [embed.id, onRevoke]);

  return (
    <div
      className={`rounded-xl border p-4 space-y-3 ${
        embed.is_active
          ? "border-outline-variant bg-surface"
          : "border-outline-variant/50 bg-surface/50 opacity-60"
      }`}
    >
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-on-surface truncate">
            {embed.name}
          </div>
          <div className="text-xs text-on-surface-variant">
            {formatRelativeDate(embed.created_at)}
          </div>
        </div>
      </div>

      {originDomain && (
        <div className="text-xs text-on-surface-variant truncate">
          {originDomain}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <div
          className={`w-2 h-2 rounded-full ${
            embed.is_active ? "bg-green-500" : "bg-on-surface-variant/40"
          }`}
        />
        <span className="text-xs text-on-surface-variant">
          {embed.is_active ? "Active" : "Revoked"}
        </span>
      </div>

      {embed.is_active && (
        <div className="flex items-center gap-2 pt-1">
          {config?.snippet && (
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Code
                </>
              )}
            </button>
          )}
          <div className="flex-1" />
          {confirmRevoke ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setConfirmRevoke(false)}
                className="text-xs text-on-surface-variant hover:text-on-surface px-2 py-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRevoke}
                className="text-xs text-red-500 hover:text-red-400 font-medium px-2 py-1"
              >
                Confirm
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmRevoke(true)}
              className="text-on-surface-variant/60 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
