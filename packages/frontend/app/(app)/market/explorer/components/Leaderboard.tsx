"use client";
import React from "react";
import { Sparkline } from "./Sparkline";

export interface LeaderboardRow {
  id: string;
  rank: string;
  name: string;
  sub: string;
  valueLabel: string;
  valueColor: string;
  score: number;
  scoreBg: string;
  scoreColor: string;
  spark: (number | null)[];
  markerIndex: number;
}
export interface LeaderboardProps {
  title: string;
  monthLabel: string;
  rows: LeaderboardRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function Leaderboard({
  title,
  monthLabel,
  rows,
  selectedId,
  onSelect,
}: LeaderboardProps) {
  const handleRowKeyDown = (id: string, e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(id);
    }
  };

  return (
    <div
      style={{
        background: "var(--md-surface-container)",
        border: "1px solid var(--md-outline-variant)",
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid var(--md-outline-variant)",
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--md-on-surface)",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 11.5,
            fontFamily: "var(--font-roboto-mono)",
            color: "var(--md-on-surface-variant)",
          }}
        >
          {monthLabel}
        </div>
      </div>
      <div>
        {rows.map((r) => (
          <div
            key={r.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(r.id)}
            onKeyDown={(e) => handleRowKeyDown(r.id, e)}
            style={{
              display: "grid",
              gridTemplateColumns: "40px minmax(0,1fr) 96px 92px 76px",
              gap: 14,
              alignItems: "center",
              padding: "11px 20px",
              cursor: "pointer",
              borderBottom:
                "1px solid color-mix(in srgb, var(--md-outline-variant) 55%, transparent)",
              background:
                selectedId === r.id
                  ? "color-mix(in srgb, var(--md-primary) 8%, transparent)"
                  : "transparent",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-roboto-mono)",
                fontSize: 13,
                color: "var(--md-on-surface-variant)",
              }}
            >
              {r.rank}
            </span>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: "var(--md-on-surface)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {r.name}
              </div>
              <div
                style={{ fontSize: 11, color: "var(--md-on-surface-variant)" }}
              >
                {r.sub}
              </div>
            </div>
            <span>
              <Sparkline
                series={r.spark}
                width={92}
                height={26}
                color={r.valueColor}
                markerIndex={r.markerIndex}
              />
            </span>
            <span
              style={{
                fontFamily: "var(--font-roboto-mono)",
                fontSize: 13,
                fontWeight: 600,
                color: r.valueColor,
                textAlign: "right",
              }}
            >
              {r.valueLabel}
            </span>
            {/* Compact score pill — documented exception to CLAUDE.md §9's ScoreBadge requirement; ScoreBadge's ring doesn't fit this row's 76px column. */}
            <span
              style={{
                justifySelf: "end",
                fontFamily: "var(--font-roboto-mono)",
                fontSize: 12,
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: 999,
                background: r.scoreBg,
                color: r.scoreColor,
              }}
            >
              {r.score}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
