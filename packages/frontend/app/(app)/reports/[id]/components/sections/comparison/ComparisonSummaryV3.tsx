"use client";

import { Trophy } from "lucide-react";
import { type MarketBundle, shortMarketName } from "./marketBundles";

/**
 * ComparisonSummaryV3 — a compact at-a-glance scoreboard (one chip per market:
 * name + live PropertyIQ score + grade, winner flagged). Deliberately NOT a wall
 * of metrics — the written synthesis below it does the actual summarizing. This
 * just lets the reader see who leads in one glance.
 */
export function ComparisonSummaryV3({ markets }: { markets: MarketBundle[] }) {
  const scored = markets.filter((m) => m.score != null);
  const top = scored.length
    ? Math.max(...scored.map((m) => m.score as number))
    : null;

  return (
    <div className="mb-8 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
      {markets.map((m) => {
        const isWinner = top != null && m.score === top;
        return (
          <div
            key={m.id}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
              isWinner
                ? "border-primary bg-primary/5"
                : "border-outline-variant bg-surface-container"
            }`}
          >
            {isWinner && <Trophy className="h-4 w-4 shrink-0 text-primary" />}
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-on-surface">
                {shortMarketName(m.name)}
              </p>
              <p className="text-[11px] text-on-surface-variant">
                PropertyIQ {m.score != null ? Math.round(m.score) : "—"}
                {m.grade ? ` · ${m.grade}` : ""}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
