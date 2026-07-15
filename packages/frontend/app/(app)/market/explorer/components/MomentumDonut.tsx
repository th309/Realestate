"use client";
import React from "react";

export interface MomentumDonutProps {
  scores: number[];
  unitPlural: string;
}

export function MomentumDonut({ scores, unitPlural }: MomentumDonutProps) {
  const rising = scores.filter((s) => s >= 60).length;
  const cooling = scores.filter((s) => s < 40).length;
  const steady = scores.length - rising - cooling;
  const total = scores.length || 1;
  const R = 52,
    C = 2 * Math.PI * R;
  const segs: [number, string][] = [
    [rising, "var(--md-tertiary)"],
    [steady, "var(--md-warning)"],
    [cooling, "var(--md-error)"],
  ];
  let off = 0;
  const legend = [
    { label: "Rising (60+)", color: "var(--md-tertiary)", count: rising },
    { label: "Steady (40–59)", color: "var(--md-warning)", count: steady },
    { label: "Cooling (<40)", color: "var(--md-error)", count: cooling },
  ];
  return (
    <div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--md-on-surface)",
          marginBottom: 6,
        }}
      >
        Momentum mix · {scores.length} {unitPlural}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg viewBox="0 0 140 140" width={132} height={132}>
          {segs.map(([n, c], i) => {
            const frac = n / total;
            const dash = Math.max(0, frac * C - 2);
            const el = (
              <circle
                key={i}
                cx={70}
                cy={70}
                r={R}
                fill="none"
                stroke={c}
                strokeWidth={16}
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={-off * C + C / 4}
                style={{
                  transition: "stroke-dasharray .6s, stroke-dashoffset .6s",
                }}
              />
            );
            off += frac;
            return el;
          })}
          <text
            x={70}
            y={66}
            textAnchor="middle"
            fontSize={26}
            fontWeight={700}
            fontFamily="var(--font-roboto-mono)"
            fill="var(--md-on-surface)"
          >
            {rising}
          </text>
          <text
            x={70}
            y={84}
            textAnchor="middle"
            fontSize={10}
            fill="var(--md-on-surface-variant)"
          >
            rising
          </text>
        </svg>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 5,
          marginTop: 8,
        }}
      >
        {legend.map((d) => (
          <div
            key={d.label}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 12,
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                color: "var(--md-on-surface-variant)",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: d.color,
                }}
              />
              {d.label}
            </span>
            <span
              style={{
                fontFamily: "var(--font-roboto-mono)",
                fontWeight: 600,
                color: "var(--md-on-surface)",
              }}
            >
              {d.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
