"use client";
import React, { useRef } from "react";
import { getScoreColor } from "@/app/components/scoring/ScoreDisplay";
import { formatMetricValue } from "@/lib/data";
import { formatExplorerValue } from "../lib/explorer-math";
import { makeLogScale, niceBubbleBounds } from "../lib/explorer-scale";
import { useTickInterpolation } from "../lib/useTickInterpolation";
import type { ExplorerFormat } from "../lib/explorer-config";
import type { BubbleBlendScalars } from "../lib/explorer-view-model";

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
  /** 0-100 color scalar for the CURRENTLY selected metric (see
   * `metricColorScalars`) — not the PropertyIQ Score. */
  colorByRegion: Record<string, number | null>;
  radiusByRegion: Record<string, number | null>;
  axisLabel: string;
  format: ExplorerFormat;
  selectedId: string | null;
  pinnedIds: string[];
  /** Precomputed GLOBAL [min, max] bounds for the X (home value) and Y
   * (selected metric) axes — REQUIRED for animated playback (AnimatedHeroChart)
   * so the coordinate system stays fixed while dots move; recomputing bounds
   * fresh from just the current blended frame's xByRegion/yByRegion makes the
   * whole chart visibly rescale every tick (on top of, and easily mistaken
   * for, the dots' own motion) — exactly the "GLOBAL scales across ALL
   * frames so axes stay fixed" requirement the graphs page's D3 scatter race
   * calls out for the same reason. Omitted for the plain, non-animated
   * single-month usage, which computes its own bounds from what's visible. */
  xBounds?: [number, number];
  yBounds?: [number, number];
  /** Next month's snapshot — when present AND `playing`, drives a
   * requestAnimationFrame loop that writes interpolated cx/cy/r/fill
   * DIRECTLY onto each circle's DOM node every frame, bypassing React
   * state/re-render entirely (see `useTickInterpolation`). Verified via
   * frame-by-frame screen-recording analysis that CSS transitions do NOT
   * animate cx/cy/fill for these SVG elements at all (instant snap, zero
   * intermediate frames) — and pushing every frame through a React
   * `setState` instead forced a full reconciliation of up to 935 circles
   * per tick, whose cost made frame pacing irregular ("jerky") even though
   * the interpolated VALUES were mathematically correct. Direct DOM writes
   * mirror exactly how the graphs page's D3 scatter race animates (a timer
   * writing attributes directly, no virtual-DOM diffing). Omit for the
   * plain, non-animated single-month render. */
  next?: BubbleBlendScalars;
  playing: boolean;
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
    colorByRegion,
    radiusByRegion,
    axisLabel,
    format,
    selectedId,
    pinnedIds,
    xBounds,
    yBounds,
    next,
    playing,
    onSelect,
    onDrill,
  } = props;

  const circleRefs = useRef(new Map<string, SVGCircleElement>());
  const labelRefs = useRef(new Map<string, SVGTextElement>());

  const prices = entities
    .map((e) => xByRegion[e.id])
    .filter((v): v is number => v != null);
  const yVals = entities
    .map((e) => yByRegion[e.id])
    .filter((v): v is number => v != null);
  const hasData = prices.length > 0 && yVals.length > 0;

  // Scales are computed unconditionally (degrading to safe placeholder
  // values when there's no data) so the useTickInterpolation call below
  // stays unconditional too — Rules of Hooks forbids calling a hook after an
  // early return, so the "No data" bailout has to happen in the JSX below,
  // not as a `return` here.
  const [pMin, pMax] = xBounds ?? niceBubbleBounds(prices);
  const logX = makeLogScale(pMin, pMax);
  const x = (p: number) => mL + logX(p) * (W - mL - mR);

  let [d0, d1] =
    yBounds ?? (hasData ? [Math.min(...yVals), Math.max(...yVals)] : [0, 1]);
  const pad = (d1 - d0) * 0.1 || 1;
  d0 -= pad;
  d1 += pad;
  const y = (v: number) =>
    mT + (1 - (Math.max(d0, Math.min(d1, v)) - d0) / (d1 - d0)) * (H - mT - mB);

  const maxInv = Math.max(1, ...entities.map((e) => radiusByRegion[e.id] ?? 0));

  const radiusFor = (inv: number) =>
    Math.min(26, 7 + Math.sqrt(inv / maxInv) * 19);

  // Writes interpolated cx/cy/r/fill straight onto each circle's DOM node —
  // see the `next` prop doc for why this bypasses React state entirely.
  function applyFrame(t: number) {
    for (const e of entities) {
      const circle = circleRefs.current.get(e.id);
      if (!circle) continue;
      const px0 = xByRegion[e.id];
      const v0 = yByRegion[e.id];
      if (px0 == null || v0 == null) continue;
      const px1 = next?.xByRegion[e.id] ?? px0;
      const v1 = next?.yByRegion[e.id] ?? v0;
      const c0 = colorByRegion[e.id] ?? 50;
      const c1 = next?.colorByRegion[e.id] ?? c0;
      const rad0 = radiusByRegion[e.id] ?? 0;
      const rad1 = next?.radiusByRegion[e.id] ?? rad0;

      const px = px0 + (px1 - px0) * t;
      const v = v0 + (v1 - v0) * t;
      const cx = x(px);
      const cy = y(v);
      const r = radiusFor(rad0 + (rad1 - rad0) * t);

      circle.setAttribute("cx", String(cx));
      circle.setAttribute("cy", String(cy));
      circle.setAttribute("r", String(r));
      circle.setAttribute("fill", getScoreColor(c0 + (c1 - c0) * t, 100));

      if (e.id === selectedId) {
        const label = labelRefs.current.get(e.id);
        label?.setAttribute("x", String(cx));
        label?.setAttribute("y", String(cy - r - 8));
      }
    }
  }

  useTickInterpolation(playing && next != null && hasData, next, applyFrame);

  if (!hasData) {
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
    const colorScalar = colorByRegion[e.id] ?? 50;
    const color = getScoreColor(colorScalar, 100);
    const r = radiusFor(radiusByRegion[e.id] ?? 0);
    const sel = e.id === selectedId,
      pinned = pinnedIds.includes(e.id);
    return (
      <g key={e.id}>
        <circle
          ref={(el) => {
            if (el) circleRefs.current.set(e.id, el);
            else circleRefs.current.delete(e.id);
          }}
          data-region-id={e.id}
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
            transition: playing ? "none" : "cx 300ms ease, cy 300ms ease",
          }}
          onClick={() => onSelect(e.id)}
          onDoubleClick={() => onDrill(e.id)}
        >
          <title>{`${e.name} — ${formatExplorerValue(v, format)} · double-click to drill in`}</title>
        </circle>
        {sel && (
          <text
            ref={(el) => {
              if (el) labelRefs.current.set(e.id, el);
              else labelRefs.current.delete(e.id);
            }}
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
