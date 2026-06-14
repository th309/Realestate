"use client";

import type { DataPoint } from "./SignatureChartHelpers";

type AxisRecord = {
  scale?: (v: unknown) => number;
  y?: number;
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

interface ScrubOverlayProps {
  data: DataPoint[];
  activeIndex: number | null;
  color: string;
  chartProps: Record<string, unknown>;
  /** Multi-series mode: read this key off the active data point. Defaults to `y`. */
  yKey?: string;
}

/**
 * Thin dashed vertical line + solid dot at the hovered data point. Spans the
 * y-axis plot area (not the full container) so it doesn't bleed into the
 * headline or range pills above/below.
 */
export function ScrubOverlay({
  data,
  activeIndex,
  color,
  chartProps,
  yKey = "y",
}: ScrubOverlayProps) {
  if (activeIndex == null) return null;
  const point = data[activeIndex];
  if (!point) return null;
  const { xAxis, yAxis } = readScales(chartProps);
  if (!xAxis?.scale || !yAxis?.scale) return null;
  const yValue = point[yKey];
  if (typeof yValue !== "number") return null;
  const cx = xAxis.scale(point.x);
  const cy = yAxis.scale(yValue);
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  const top = yAxis.y ?? 0;
  const bottom = top + (yAxis.height ?? 0);
  return (
    <g aria-hidden style={{ pointerEvents: "none" }}>
      <line
        x1={cx}
        x2={cx}
        y1={top}
        y2={bottom}
        stroke="rgba(15, 23, 42, 0.25)"
        strokeWidth={1}
        strokeDasharray="2 3"
      />
      <circle cx={cx} cy={cy} r={4} fill={color} />
    </g>
  );
}
