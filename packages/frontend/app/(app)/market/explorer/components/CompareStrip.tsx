"use client";
import React from "react";

export interface PinCard {
  id: string;
  name: string;
  sub: string;
  score: number;
  scoreColor: string;
  stats: { label: string; value: string; color: string }[];
}
export interface CompareStripProps {
  pins: PinCard[];
  onUnpin: (id: string) => void;
  onClear: () => void;
}

export function CompareStrip({ pins, onUnpin, onClear }: CompareStripProps) {
  if (!pins.length) return null;
  return (
    <div
      style={{
        background: "var(--md-surface-container)",
        border: "1px solid var(--md-outline-variant)",
        borderRadius: 16,
        padding: "16px 20px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--md-on-surface)",
          }}
        >
          Compare pinned markets
        </div>
        <button
          onClick={onClear}
          style={{
            border: "none",
            background: "none",
            cursor: "pointer",
            fontSize: 12,
            color: "var(--md-on-surface-variant)",
          }}
        >
          Clear all
        </button>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {pins.map((p) => (
          <div
            key={p.id}
            style={{
              flex: 1,
              minWidth: 200,
              background: "var(--md-surface-container-low)",
              border: "1px solid var(--md-outline-variant)",
              borderRadius: 12,
              padding: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--md-on-surface)",
                  }}
                >
                  {p.name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--md-on-surface-variant)",
                  }}
                >
                  {p.sub}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Compact score pill — documented exception to CLAUDE.md §9's ScoreBadge requirement; ScoreBadge's 48px+ ring doesn't fit this card's width. */}
                <span
                  style={{
                    fontFamily: "var(--font-roboto-mono)",
                    fontSize: 22,
                    fontWeight: 700,
                    color: p.scoreColor,
                  }}
                >
                  {p.score}
                </span>
                <button
                  onClick={() => onUnpin(p.id)}
                  aria-label="Remove"
                  style={{
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    color: "var(--md-on-surface-variant)",
                    fontSize: 14,
                    padding: 2,
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {p.stats.map((s) => (
                <div
                  key={s.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: "var(--md-on-surface-variant)" }}>
                    {s.label}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-roboto-mono)",
                      fontWeight: 500,
                      color: s.color,
                    }}
                  >
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
