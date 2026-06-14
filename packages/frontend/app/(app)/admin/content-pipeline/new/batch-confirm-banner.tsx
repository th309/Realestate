"use client";
import { useState } from "react";
import { FORMAT_META } from "../lib/format-previews";
import type { BatchMarket } from "../lib/batch-runs-api";

const PER_RENDER_COST_USD = 0.1;

export function BatchConfirmBanner({
  format,
  markets,
  onChangeScope,
}: {
  format: string;
  markets: BatchMarket[];
  onChangeScope: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = FORMAT_META[format];
  const count = markets.length;
  const cost = (count * PER_RENDER_COST_USD).toFixed(2);
  const queueMin = Math.max(1, Math.round((count * 20) / 60));

  const visibleNames = expanded ? markets : markets.slice(0, 5);

  return (
    <div className="space-y-3 mb-6">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          Batch: {count} markets · {meta.displayName}
        </h1>
        <button
          type="button"
          onClick={onChangeScope}
          className="text-sm text-primary hover:underline whitespace-nowrap"
        >
          ← change scope
        </button>
      </div>

      <div className="rounded-xl bg-surface-container-low p-4 text-sm">
        <ul className="space-y-1">
          {visibleNames.map((m) => (
            <li key={m.id} className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wide text-on-surface-variant font-mono">
                {m.geography}
              </span>
              <span className="font-mono">{m.id}</span>
            </li>
          ))}
        </ul>
        {count > 5 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 text-xs text-primary hover:underline"
          >
            {expanded ? "Show less" : `…and ${count - 5} more (expand)`}
          </button>
        )}
      </div>

      <div className="text-xs text-on-surface-variant font-mono">
        ≈ ${cost} · {count} renders · ~{queueMin} min queue
      </div>
    </div>
  );
}
