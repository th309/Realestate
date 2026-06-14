"use client";
import { useState } from "react";
import type { StrategyKey } from "./SingleStrategyTab";

interface StrategyContent {
  key: StrategyKey;
  title: string;
  heroLabel: string;
  heroValue: string;
  full: React.ReactNode; // full content for expanded view
  summary: { label: string; value: string }[];
}

interface WinnerPlusOthersProps {
  winnerKey: StrategyKey;
  strategies: StrategyContent[]; // expected length 3
}

export function WinnerPlusOthers({
  winnerKey,
  strategies,
}: WinnerPlusOthersProps) {
  const [expanded, setExpanded] = useState<StrategyKey>(winnerKey);
  const winner = strategies.find((s) => s.key === expanded);
  const others = strategies.filter((s) => s.key !== expanded);

  return (
    <div data-winner-plus-others className="space-y-4">
      {winner && (
        <div
          data-strategy-full={winner.key}
          className="rounded-xl border-2 border-[var(--md-tertiary)] bg-surface p-5 shadow-md"
        >
          <div className="flex items-center gap-2 mb-3">
            <span
              data-winner-badge
              className="text-[10px] font-bold uppercase rounded-full bg-[var(--md-tertiary)] text-[var(--md-on-tertiary)] px-2 py-0.5"
            >
              ★ Best Play
            </span>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">
              {winner.title}
            </h4>
          </div>
          <div className="font-mono text-4xl font-bold text-on-surface mb-1">
            {winner.heroValue}
          </div>
          <div className="text-xs text-on-surface-variant mb-4">
            {winner.heroLabel}
          </div>
          <div data-strategy-content>{winner.full}</div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {others.map((s) => (
          <button
            key={s.key}
            data-strategy-summary={s.key}
            onClick={() => setExpanded(s.key)}
            className="text-left rounded-xl border border-outline-variant bg-surface-container-low p-4 hover:border-primary transition"
          >
            <h5 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
              {s.title}
            </h5>
            <div className="font-mono text-2xl font-bold text-on-surface mb-1">
              {s.heroValue}
            </div>
            <div className="text-[11px] text-on-surface-variant mb-2">
              {s.heroLabel}
            </div>
            <div className="space-y-0.5">
              {s.summary.map((stat, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-on-surface-variant">{stat.label}</span>
                  <span className="font-mono text-on-surface">
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
