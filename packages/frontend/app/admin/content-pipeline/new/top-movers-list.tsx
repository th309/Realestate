// packages/frontend/app/admin/content-pipeline/new/top-movers-list.tsx
"use client";
import type { ScoreMoverItem } from "../lib/movers-api";

function formatPop(pop: number | null): string {
  if (pop == null) return "—";
  if (pop >= 1_000_000) return `${(pop / 1_000_000).toFixed(1)}M`;
  if (pop >= 1_000) return `${Math.round(pop / 1_000)}K`;
  return String(pop);
}

interface ColumnProps {
  title: string;
  arrow: "▲" | "▼";
  items: ScoreMoverItem[];
  checkedIds: Set<string>;
  onToggle: (id: string) => void;
}

function MoversColumn({
  title,
  arrow,
  items,
  checkedIds,
  onToggle,
}: ColumnProps) {
  return (
    <div className="flex-1 rounded-xl bg-surface-container-low p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-outline mb-3">
        {arrow} {title} (top {items.length})
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-outline italic">
          No qualifying markets.
        </div>
      ) : (
        <ul className="space-y-2 max-h-[60vh] overflow-y-auto">
          {items.map((m) => {
            const checked = checkedIds.has(m.id);
            const sign = m.delta > 0 ? "+" : "";
            return (
              <li
                key={m.id}
                className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors duration-200 ${
                  checked
                    ? "bg-secondary-container/40"
                    : "hover:bg-surface-container"
                }`}
                onClick={() => onToggle(m.id)}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(m.id)}
                  className="mt-1"
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="min-w-0">
                  <div className="font-semibold truncate">
                    {m.canonical_name}
                  </div>
                  <div className="text-xs text-on-surface-variant font-mono">
                    {m.current_score} ← {m.previous_score} · {sign}
                    {m.delta} · pop {formatPop(m.population)}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function TopMoversList({
  up,
  down,
  checkedIds,
  onToggle,
}: {
  up: ScoreMoverItem[];
  down: ScoreMoverItem[];
  checkedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex gap-4">
      <MoversColumn
        title="Gainers"
        arrow="▲"
        items={up}
        checkedIds={checkedIds}
        onToggle={onToggle}
      />
      <MoversColumn
        title="Losers"
        arrow="▼"
        items={down}
        checkedIds={checkedIds}
        onToggle={onToggle}
      />
    </div>
  );
}
