"use client";
import React, { useEffect } from "react";

export interface TimelineScrubberProps {
  min: number;
  max: number;
  value: number;
  playing: boolean;
  onTogglePlay: () => void;
  onScrub: (v: number) => void;
  onAdvance: (v: number) => void;
  onStop: () => void;
  rangeOptions: {
    months: number;
    label: string;
    active: boolean;
    onClick: () => void;
  }[];
  startLabel: string;
  midLabel: string;
  endLabel: string;
  monthLabel: string;
}

export function TimelineScrubber(props: TimelineScrubberProps) {
  const {
    min,
    max,
    value,
    playing,
    onTogglePlay,
    onScrub,
    onAdvance,
    onStop,
    rangeOptions,
    startLabel,
    midLabel,
    endLabel,
    monthLabel,
  } = props;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      if (value >= max) onStop();
      else onAdvance(value + 1);
    }, 380);
    return () => clearInterval(id);
  }, [playing, value, max, onAdvance, onStop]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          padding: "0 20px",
        }}
      >
        <div
          style={{
            display: "flex",
            background: "var(--md-surface-container-high)",
            borderRadius: 999,
            padding: 2,
            gap: 2,
          }}
        >
          {rangeOptions.map((r) => (
            <button
              key={r.months}
              onClick={r.onClick}
              style={{
                border: "none",
                cursor: "pointer",
                padding: "4px 12px",
                borderRadius: 999,
                fontSize: 11.5,
                fontWeight: 600,
                fontFamily: "var(--font-roboto-mono)",
                background: r.active
                  ? "var(--md-surface-container-lowest)"
                  : "transparent",
                color: r.active
                  ? "var(--md-primary)"
                  : "var(--md-on-surface-variant)",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "12px 20px 16px",
          borderTop: "1px solid var(--md-outline-variant)",
          marginTop: 8,
        }}
      >
        <button
          onClick={onTogglePlay}
          aria-label={playing ? "Pause timeline" : "Play timeline"}
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
            background: "var(--md-primary)",
            color: "var(--md-on-primary)",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "none",
          }}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <div
          style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}
        >
          <input
            type="range"
            min={min}
            max={max}
            step={1}
            value={value}
            onChange={(e) => onScrub(Number(e.target.value))}
            style={{ width: "100%" }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 10.5,
              fontFamily: "var(--font-roboto-mono)",
              color: "var(--md-on-surface-variant)",
            }}
          >
            <span>{startLabel}</span>
            <span>{midLabel}</span>
            <span>{endLabel}</span>
          </div>
        </div>
        <div
          style={{
            fontFamily: "var(--font-roboto-mono)",
            fontSize: 15,
            fontWeight: 700,
            color: "var(--md-primary)",
            minWidth: 76,
            textAlign: "right",
          }}
        >
          {monthLabel}
        </div>
      </div>
    </div>
  );
}
