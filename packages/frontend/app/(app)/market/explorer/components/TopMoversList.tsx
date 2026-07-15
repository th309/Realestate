"use client";
import React from "react";
import type { ScopeRegion } from "@/lib/data/fetchers/market-explorer";
import { scoreChip } from "../lib/explorer-math";

export interface Mover {
  region: ScopeRegion;
  delta: number;
  score: number;
}

export interface TopMoversListProps {
  movers: Mover[];
  onSelect: (id: string) => void;
}

export function TopMoversList({ movers, onSelect }: TopMoversListProps) {
  const handleRowKeyDown = (id: string, e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(id);
    }
  };

  return (
    <div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--md-on-surface)",
          marginBottom: 10,
        }}
      >
        Top movers · 3-mo Δ score
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {movers.map(({ region, delta, score }) => {
          const chip = scoreChip(score);
          const col = delta >= 0 ? "var(--md-tertiary)" : "var(--md-error)";
          return (
            <div
              key={region.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(region.id)}
              onKeyDown={(e) => handleRowKeyDown(region.id, e)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "7px 4px",
                cursor: "pointer",
                borderRadius: 8,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: col,
                  width: 14,
                  textAlign: "center",
                }}
              >
                {delta >= 0 ? "▲" : "▼"}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 500,
                    color: "var(--md-on-surface)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {region.name}
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: "var(--md-on-surface-variant)",
                  }}
                >
                  {region.state}
                </div>
              </div>
              <span
                style={{
                  fontFamily: "var(--font-roboto-mono)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: col,
                }}
              >
                {(delta >= 0 ? "+" : "") + delta.toFixed(1)}
              </span>
              {/* Compact score pill — documented exception to CLAUDE.md §9's ScoreBadge requirement; ScoreBadge's ring doesn't fit this row's compact width. */}
              <span
                style={{
                  fontFamily: "var(--font-roboto-mono)",
                  fontSize: 11.5,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: chip.bg,
                  color: chip.color,
                }}
              >
                {score}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
