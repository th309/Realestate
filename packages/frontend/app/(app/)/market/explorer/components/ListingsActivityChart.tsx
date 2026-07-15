"use client";
import React from "react";

export interface ListingsActivityChartProps {
  title: string;
  newListings: (number | null)[];
  pending: (number | null)[];
  months: string[];
  monthIndex: number;
}

const Wv = 440,
  Hv = 190,
  mB = 22,
  mT = 8;

export function ListingsActivityChart({
  title,
  newListings,
  pending,
  months,
  monthIndex,
}: ListingsActivityChartProps) {
  const end = Math.min(monthIndex, newListings.length - 1);
  const start = Math.max(0, end - 11);
  const idx: number[] = [];
  for (let t = start; t <= end; t++) idx.push(t);
  const max = Math.max(1, ...idx.map((t) => newListings[t] ?? 0)) * 1.1;
  const bw = (Wv - 16) / (idx.length || 1);
  const monthShort = (iso: string) =>
    new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleString("en-US", {
      month: "short",
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--md-on-surface)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: "flex",
            gap: 12,
            fontSize: 11,
            color: "var(--md-on-surface-variant)",
            flex: "none",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 3,
                background: "var(--md-primary)",
              }}
            />
            New listings
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 3,
                background: "var(--md-tertiary)",
              }}
            />
            Pending
          </span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${Wv} ${Hv}`}
        preserveAspectRatio="none"
        width="100%"
        style={{ display: "block", height: Hv }}
      >
        <line
          x1={6}
          x2={Wv - 6}
          y1={Hv - mB}
          y2={Hv - mB}
          stroke="var(--md-outline-variant)"
        />
        {idx.map((t, i) => {
          const x0 = 8 + i * bw,
            cur = t === monthIndex;
          const h1 = ((newListings[t] ?? 0) / max) * (Hv - mB - mT);
          const h2 = ((pending[t] ?? 0) / max) * (Hv - mB - mT);
          return (
            <g key={t}>
              <rect
                x={x0 + bw * 0.14}
                width={bw * 0.32}
                y={Hv - mB - h1}
                height={h1}
                rx={3}
                fill="var(--md-primary)"
                fillOpacity={cur ? 1 : 0.55}
              />
              <rect
                x={x0 + bw * 0.52}
                width={bw * 0.32}
                y={Hv - mB - h2}
                height={h2}
                rx={3}
                fill="var(--md-tertiary)"
                fillOpacity={cur ? 1 : 0.55}
              />
              {(i % 2 === 0 || idx.length <= 8) && (
                <text
                  x={x0 + bw / 2}
                  y={Hv - 7}
                  textAnchor="middle"
                  fontSize={9.5}
                  fontFamily="var(--font-roboto-mono)"
                  fill={
                    cur ? "var(--md-primary)" : "var(--md-on-surface-variant)"
                  }
                  fontWeight={cur ? 700 : 400}
                >
                  {monthShort(months[t] ?? "")}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
