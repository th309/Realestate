"use client";

import { useState } from "react";
import { useRatePair, type ShadowPair } from "@/lib/data/fetchers/ai-shadow";

function formatCost(usd: number | null): string {
  if (usd == null) return "—";
  return `$${usd.toFixed(4)}`;
}

function formatMs(ms: number | null): string {
  if (ms == null) return "—";
  return `${ms.toLocaleString()}ms`;
}

export function ShadowPairCard({ pair }: { pair: ShadowPair }) {
  const rate = useRatePair();
  const [note, setNote] = useState(pair.reviewer_note ?? "");

  const onRate = (preferred: "primary" | "shadow" | "tie") => {
    rate.mutate({ id: pair.id, preferred, reviewer_note: note || undefined });
  };

  return (
    <div className="rounded-xl bg-surface-container-low p-5 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <div>
          <span className="font-mono text-sm font-semibold text-primary">
            {pair.purpose}
          </span>
          <span className="ml-3 text-xs text-on-surface-variant">
            {new Date(pair.created_at).toLocaleString()}
          </span>
        </div>
        {pair.preferred && (
          <span className="rounded-full bg-primary-container px-3 py-1 text-xs">
            Rated: {pair.preferred}
          </span>
        )}
      </div>

      {pair.input_preview && (
        <div className="mb-4 rounded-lg bg-surface p-3 font-mono text-xs text-on-surface-variant">
          {pair.input_preview.slice(0, 300)}
          {pair.input_preview.length > 300 && "…"}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-outline p-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-on-surface-variant">
            Primary
          </div>
          <div className="mb-3 text-sm font-medium">
            {pair.primary_provider} · {pair.primary_model}
          </div>
          <div className="mb-3 flex gap-4 text-xs text-on-surface-variant">
            <span>{formatCost(pair.primary_cost_usd)}</span>
            <span>{formatMs(pair.primary_duration_ms)}</span>
          </div>
          <div className="whitespace-pre-wrap text-sm">
            {pair.primary_output}
          </div>
        </div>

        <div className="rounded-lg border border-outline p-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-on-surface-variant">
            Shadow
          </div>
          <div className="mb-3 text-sm font-medium">
            {pair.shadow_provider} · {pair.shadow_model}
          </div>
          <div className="mb-3 flex gap-4 text-xs text-on-surface-variant">
            <span>{formatCost(pair.shadow_cost_usd)}</span>
            <span>{formatMs(pair.shadow_duration_ms)}</span>
          </div>
          {pair.shadow_error ? (
            <div className="text-sm text-error">Error: {pair.shadow_error}</div>
          ) : (
            <div className="whitespace-pre-wrap text-sm">
              {pair.shadow_output}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => onRate("primary")}
          disabled={rate.isPending}
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-50"
        >
          👍 Primary
        </button>
        <button
          onClick={() => onRate("tie")}
          disabled={rate.isPending}
          className="rounded-full border border-outline px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Tie
        </button>
        <button
          onClick={() => onRate("shadow")}
          disabled={rate.isPending}
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-50"
        >
          👍 Shadow
        </button>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note…"
          className="flex-1 rounded-lg border border-outline px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}
