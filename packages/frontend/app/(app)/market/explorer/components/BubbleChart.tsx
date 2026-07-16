"use client";
import React from "react";
import { getScoreColor } from "@/app/components/scoring/ScoreDisplay";
import { formatMetricValue } from "@/lib/data";
import {
  makeLogScale,
  niceBubbleBounds,
  formatExplorerValue,
} from "../lib/explorer-math";
import type { ExplorerFormat } from "../lib/explorer-config";

interface BubbleEntity {
  id: string;
  name: string;
  state: string;
  nearby?: boolean;
}
export interface BubbleChartProps {
  entities: BubbleEntity[];
  xByRegion: Record<string, number | null>;
  yByRegion: Record<string, number | null>;
  scoreByRegion: Record<string, number | null>;
  radiusByRegion: Record<string, number | null>;
  axisLabel: string;
  format: ExplorerFormat;
  selectedId: string | null;
  pinnedIds: string[];
  onSelect: (id: string) => void;
  onDrill: (id: string) => void;
}

const W = 1000,
  H = 540,
  mL = 58,
  mR = 24,
  mT = 26,
  mB = 46;

export function BubbleChart(props: BubbleChartProps) {
  const {
    entities,
    xByRegion,
    yByRegion,
    scoreByRegion,
    radiusByRegion,
    axisLabel,
    format,
    selectedId,
    pinnedIds,
    onSelect,
    onDrill,
  } = props;

  const prices = entities
    .map((e) => xByRegion[e.id])
    .filter((v): v is number => v != null);
  const yVals = entities
    .map((e) => yByRegion[e.id])
    .filter((v): v is number => v != null);
  if (!prices.length || !yVals.length) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: "center",
          color: "var(--md-on-surface-variant)",
        }}
      >
        No data for this scope.
      </div>
    );
  }
  const [pMin, pMax] = niceBubbleBounds(prices);
  const logX = makeLogScale(pMin, pMax);
  const x = (p: number) => mL + logX(p) * (W - mL - mR);

  let d0 = Math.min(...yVals),
    d1 = Math.max(...yVals);
  const pad = (d1 - d0) * 0.1 || 1;
  d0 -= pad;
  d1 += pad;
  const y = (v: number) =>
    mT + (1 - (Math.max(d0, Math.min(d1, v)) - d0) / (d1 - d0)) * (H - mT - mB);

  const maxInv = Math.max(1, ...entities.map((e) => radiusByRegion[e.id] ?? 0));
  const grid: React.ReactNode[] = [];
  for (let i = 0; i <= 4; i++) {
    const v = d0 + ((d1 - d0) * i) / 4,
      yy = y(v);
    grid.push(
      <line
        key={`g${i}`}
        x1={mL}
        x2={W - mR}
        y1={yy}
        y2={yy}
        stroke="var(--md-outline-variant)"
        strokeOpacity={0.45}
        strokeDasharray="3 5"
      />,
    );
    grid.push(
      <text
        key={`gl${i}`}
        x={mL - 10}
        y={yy + 4}
        textAnchor="end"
        fontSize={11}
        fontFamily="var(--font-roboto-mono)"
        fill="var(--md-on-surface-variant)"
      >
        {formatExplorerValue(v, format)}
      </text>,
    );
  }
  if (d0 < 0 && d1 > 0)
    grid.push(
      <line
        key="zero"
        x1={mL}
        x2={W - mR}
        y1={y(0)}
        y2={y(0)}
        stroke="var(--md-outline)"
        strokeOpacity={0.6}
      />,
    );
  for (let i = 0; i <= 4; i++) {
    const p = Math.exp(
      Math.log(pMin) + (Math.log(pMax) - Math.log(pMin)) * (i / 4),
    );
    grid.push(
      <text
        key={`x${i}`}
        x={x(p)}
        y={H - 16}
        textAnchor="middle"
        fontSize={11}
        fontFamily="var(--font-roboto-mono)"
        fill="var(--md-on-surface-variant)"
      >
        {formatMetricValue(p, "currency")}
      </text>,
    );
  }

  // Draw selected last so it sits on top.
  const ordered = [...entities].sort(
    (a, b) => (a.id === selectedId ? 1 : 0) - (b.id === selectedId ? 1 : 0),
  );
  const bubbles = ordered.map((e) => {
    const px = xByRegion[e.id],
      v = yByRegion[e.id];
    if (px == null || v == null) return null;
    const s = scoreByRegion[e.id] ?? 50;
    const color = getScoreColor(s, 100);
    const r = Math.min(
      26,
      7 + Math.sqrt((radiusByRegion[e.id] ?? 0) / maxInv) * 19,
    );
    const sel = e.id === selectedId,
      pinned = pinnedIds.includes(e.id);
    return (
      <g key={e.id}>
        <circle
          cx={x(px)}
          cy={y(v)}
          r={r}
          fill={color}
          fillOpacity={sel ? 0.92 : e.nearby ? 0.38 : 0.68}
          stroke={
            sel
              ? "var(--md-on-surface)"
              : pinned
                ? "var(--md-on-surface-variant)"
                : color
          }
          strokeWidth={sel ? 2.5 : pinned ? 1.8 : 1}
          strokeDasharray={(pinned || e.nearby) && !sel ? "4 3" : "none"}
          style={{
            cursor: "pointer",
            transition:
              "cx .7s cubic-bezier(.4,0,.2,1), cy .7s cubic-bezier(.4,0,.2,1)",
          }}
          onClick={() => onSelect(e.id)}
          onDoubleClick={() => onDrill(e.id)}
        >
          <title>{`${e.name} — ${formatExplorerValue(v, format)} · double-click to drill in`}</title>
        </circle>
        {sel && (
          <text
            x={x(px)}
            y={y(v) - r - 8}
            textAnchor="middle"
            fontSize={13}
            fontWeight={600}
            fill="var(--md-on-surface)"
            pointerEvents="none"
          >
            {e.name}
          </text>
        )}
      </g>
    );
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      {grid}
      <text
        x={(mL + W - mR) / 2}
        y={H - 1}
        textAnchor="middle"
        fontSize={10.5}
        fill="var(--md-on-surface-variant)"
      >
        Median home value (log scale) →
      </text>
      <text
        x={14}
        y={(mT + H - mB) / 2}
        textAnchor="middle"
        fontSize={10.5}
        fill="var(--md-on-surface-variant)"
        transform={`rotate(-90 14 ${(mT + H - mB) / 2})`}
      >
        {axisLabel}
      </text>
      {bubbles}
    </svg>
  );
}
