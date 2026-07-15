"use client";
import React from "react";

export interface SparklineProps {
  series: (number | null)[];
  width?: number;
  height?: number;
  color?: string;
  markerIndex?: number | null;
}

export function Sparkline({
  series,
  width = 92,
  height = 26,
  color = "var(--md-primary)",
  markerIndex = null,
}: SparklineProps) {
  const vals = series.filter((v): v is number => v != null);
  if (vals.length < 2) return <svg width={width} height={height} />;
  const mn = Math.min(...vals),
    mx = Math.max(...vals),
    sp = mx - mn || 1;
  const n = series.length - 1;
  const xy = (v: number, i: number): [number, number] => [
    (i / n) * width,
    height - 3 - ((v - mn) / sp) * (height - 6),
  ];
  const d = series
    .map((v, i) => (v == null ? null : xy(v, i)))
    .filter((p): p is [number, number] => p != null)
    .map((p, idx) => `${idx ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join("");
  const m =
    markerIndex != null && series[markerIndex] != null
      ? xy(series[markerIndex] as number, markerIndex)
      : null;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block" }}
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      {m && <circle cx={m[0]} cy={m[1]} r={2.6} fill={color} />}
    </svg>
  );
}
