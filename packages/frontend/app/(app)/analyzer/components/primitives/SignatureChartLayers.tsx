"use client";

import type { DataPoint, HeadlineFormat } from "./SignatureChartHelpers";
import { compactValue } from "./SignatureChartHelpers";

type AxisRecord = {
  scale?: (v: unknown) => number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

function readScales(chartProps: Record<string, unknown>): {
  xAxis: AxisRecord | undefined;
  yAxis: AxisRecord | undefined;
} {
  const xAxisMap = (chartProps.xAxisMap ?? {}) as Record<string, AxisRecord>;
  const yAxisMap = (chartProps.yAxisMap ?? {}) as Record<string, AxisRecord>;
  return {
    xAxis: Object.values(xAxisMap)[0],
    yAxis: Object.values(yAxisMap)[0],
  };
}

interface GlowEndpointProps {
  data: DataPoint[];
  color: string;
  surface: string;
  chartProps: Record<string, unknown>;
  /** Multi-series mode: read this key off the last data point. Defaults to `y`. */
  yKey?: string;
}

/**
 * Pulsing dot at the last data point. Two SVG circles: an outer halo that
 * animates r 4→16 and opacity 0.5→0 over 2s, and a solid inner dot stroked with
 * the surface color so it stays crisp against any background.
 */
export function GlowEndpoint({
  data,
  color,
  surface,
  chartProps,
  yKey = "y",
}: GlowEndpointProps) {
  const { xAxis, yAxis } = readScales(chartProps);
  if (!xAxis?.scale || !yAxis?.scale || data.length === 0) return null;
  const last = data[data.length - 1];
  const yValue = last[yKey];
  if (typeof yValue !== "number") return null;
  const cx = xAxis.scale(last.x);
  const cy = yAxis.scale(yValue);
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  return (
    <g aria-hidden style={{ pointerEvents: "none" }}>
      <circle cx={cx} cy={cy} r={4} fill={color} opacity={0.4}>
        <animate
          attributeName="r"
          from="4"
          to="16"
          dur="2s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          from="0.5"
          to="0"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill={color}
        stroke={surface}
        strokeWidth={2}
      />
    </g>
  );
}

interface ScrubSeries {
  key: string;
  color: string;
}

interface MultiScrubOverlayProps {
  data: DataPoint[];
  activeIndex: number | null;
  series: ScrubSeries[];
  format: HeadlineFormat;
  surface: string;
  chartProps: Record<string, unknown>;
}

/** Small color-matched value chip drawn next to a scrub dot. */
function LabelPill({
  x,
  y,
  text,
  color,
  surface,
  anchor,
}: {
  x: number;
  y: number;
  text: string;
  color: string;
  surface: string;
  anchor: "start" | "end";
}) {
  const padX = 5;
  const height = 15;
  // Estimate width from glyph count (11px tabular ≈ 6.6px/char) since SVG can't
  // measure text synchronously. Slightly generous so the chip never clips.
  const width = text.length * 6.6 + padX * 2;
  const rectX = anchor === "end" ? x - width : x;
  const textX = anchor === "end" ? x - padX : x + padX;
  return (
    <g>
      <rect
        x={rectX}
        y={y - height / 2}
        width={width}
        height={height}
        rx={4}
        fill={surface}
        opacity={0.92}
        stroke={color}
        strokeOpacity={0.25}
      />
      <text
        x={textX}
        y={y}
        dominantBaseline="central"
        textAnchor={anchor}
        fontSize={11}
        fontWeight={600}
        fill={color}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {text}
      </text>
    </g>
  );
}

/**
 * Multi-series scrub: one dashed vertical guide plus a color-matched dot AND a
 * value chip on EVERY series line at the hovered x. Dots sit at each line's true
 * y; only the chips are de-collided (pushed apart by a min gap, then clamped
 * into the plot) and side-flipped to the left near the right edge so they never
 * collide with the y-axis. A faint leader links each dot to its (possibly
 * displaced) chip. Renders nothing until the user actually scrubs.
 */
export function MultiScrubOverlay({
  data,
  activeIndex,
  series,
  format,
  surface,
  chartProps,
}: MultiScrubOverlayProps) {
  if (activeIndex == null) return null;
  const point = data[activeIndex];
  if (!point) return null;
  const { xAxis, yAxis } = readScales(chartProps);
  if (!xAxis?.scale || !yAxis?.scale) return null;
  const cx = xAxis.scale(point.x);
  if (!Number.isFinite(cx)) return null;

  const top = yAxis.y ?? 0;
  const bottom = top + (yAxis.height ?? 0);
  const plotLeft = xAxis.x ?? 0;
  const plotRight = plotLeft + (xAxis.width ?? 0);

  type Item = { color: string; cy: number; text: string; labelY: number };
  const items: Item[] = [];
  for (const s of series) {
    const v = point[s.key];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const cy = yAxis.scale(v);
    if (!Number.isFinite(cy)) continue;
    items.push({
      color: s.color,
      cy,
      text: compactValue(v, format),
      labelY: cy,
    });
  }
  if (items.length === 0) return null;

  // De-collide chips top-to-bottom, then clamp the stack inside the plot.
  const MIN_GAP = 16;
  const stacked = [...items].sort((a, b) => a.cy - b.cy);
  let prev = -Infinity;
  for (const it of stacked) {
    it.labelY = Math.max(it.cy, prev + MIN_GAP);
    prev = it.labelY;
  }
  const overflow = stacked[stacked.length - 1].labelY - (bottom - 8);
  if (overflow > 0) for (const it of stacked) it.labelY -= overflow;
  const underflow = top + 8 - stacked[0].labelY;
  if (underflow > 0) for (const it of stacked) it.labelY += underflow;

  // Flip chips to the left of the guide when it sits near the right edge.
  const placeLeft = cx > plotRight - 80;
  const labelX = placeLeft ? cx - 10 : cx + 10;
  const anchor: "start" | "end" = placeLeft ? "end" : "start";

  return (
    <g aria-hidden style={{ pointerEvents: "none" }}>
      <line
        x1={cx}
        x2={cx}
        y1={top}
        y2={bottom}
        stroke="rgba(15, 23, 42, 0.22)"
        strokeWidth={1}
        strokeDasharray="2 3"
      />
      {items.map((it, i) => (
        <line
          key={`leader-${i}`}
          x1={cx}
          y1={it.cy}
          x2={labelX}
          y2={it.labelY}
          stroke={it.color}
          strokeOpacity={0.35}
          strokeWidth={1}
        />
      ))}
      {items.map((it, i) => (
        <LabelPill
          key={`chip-${i}`}
          x={labelX}
          y={it.labelY}
          text={it.text}
          color={it.color}
          surface={surface}
          anchor={anchor}
        />
      ))}
      {items.map((it, i) => (
        <circle
          key={`dot-${i}`}
          cx={cx}
          cy={it.cy}
          r={4}
          fill={it.color}
          stroke={surface}
          strokeWidth={2}
        />
      ))}
    </g>
  );
}
