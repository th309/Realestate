"use client";
import { arc as d3arc } from "d3-shape";
import { CHART_TOKENS } from "./chart-tokens";

export interface GaugeThreshold {
  at: number;
  color: keyof typeof CHART_TOKENS;
}

export interface GaugeChartProps {
  value: number;
  min: number;
  max: number;
  variant?: "radial" | "horizontal";
  thresholds?: GaugeThreshold[];
  size?: number;
  label?: string;
}

export function GaugeChart({
  value,
  min,
  max,
  variant = "radial",
  thresholds = [],
  size = 200,
  label,
}: GaugeChartProps) {
  if (variant === "horizontal")
    return horizontal(value, min, max, thresholds, size, label);
  return radial(value, min, max, thresholds, size, label);
}

function radial(
  value: number,
  min: number,
  max: number,
  thresholds: GaugeThreshold[],
  size: number,
  label?: string,
) {
  const radius = size / 2;
  const startAngle = -Math.PI / 2;
  const endAngle = Math.PI / 2; // half-circle gauge
  const t = Math.min(1, Math.max(0, (value - min) / (max - min || 1)));
  const valueAngle = startAngle + t * (endAngle - startAngle);

  const trackArc = d3arc<unknown>()
    .innerRadius(radius * 0.65)
    .outerRadius(radius * 0.92)
    .startAngle(startAngle)
    .endAngle(endAngle)({} as any) as string;

  const valueArc = d3arc<unknown>()
    .innerRadius(radius * 0.65)
    .outerRadius(radius * 0.92)
    .startAngle(startAngle)
    .endAngle(valueAngle)({} as any) as string;

  // pick color from thresholds (highest threshold <= t)
  const sorted = [...thresholds].sort((a, b) => a.at - b.at);
  let color: keyof typeof CHART_TOKENS = "primary";
  for (const th of sorted) if (t >= th.at) color = th.color;

  return (
    <svg
      viewBox={`-${radius} -${radius} ${size} ${size}`}
      style={{ width: size, height: size / 2 + 20 }}
    >
      <path
        data-gauge-track
        d={trackArc}
        fill={CHART_TOKENS.gridline as string}
      />
      <path
        data-gauge-value
        d={valueArc}
        fill={CHART_TOKENS[color] as string}
      />
      <text
        x="0"
        y="-10"
        textAnchor="middle"
        fontSize={radius * 0.35}
        fontFamily="Roboto Mono"
        fontWeight={700}
        fill={CHART_TOKENS.neutral as string}
      >
        {Math.round(value)}
      </text>
      {label && (
        <text
          x="0"
          y={radius * 0.18}
          textAnchor="middle"
          fontSize={radius * 0.13}
          fontFamily="Roboto"
          fill={CHART_TOKENS.neutral as string}
        >
          {label}
        </text>
      )}
    </svg>
  );
}

function horizontal(
  value: number,
  min: number,
  max: number,
  thresholds: GaugeThreshold[],
  size: number,
  label?: string,
) {
  const w = size,
    h = 28;
  const t = Math.min(1, Math.max(0, (value - min) / (max - min || 1)));
  const fillW = t * w;
  const sorted = [...thresholds].sort((a, b) => a.at - b.at);
  let color: keyof typeof CHART_TOKENS = "primary";
  for (const th of sorted) if (t >= th.at) color = th.color;

  return (
    <svg viewBox={`0 0 ${w} ${h + 24}`} style={{ width: w, height: h + 24 }}>
      <rect
        data-gauge-track
        x={0}
        y={0}
        width={w}
        height={h}
        rx={h / 2}
        fill={CHART_TOKENS.gridline as string}
      />
      <rect
        data-gauge-value
        x={0}
        y={0}
        width={fillW}
        height={h}
        rx={h / 2}
        fill={CHART_TOKENS[color] as string}
      />
      {label && (
        <text
          x={0}
          y={h + 16}
          fontSize={11}
          fontFamily="Roboto"
          fill={CHART_TOKENS.neutral as string}
        >
          {label} {Math.round(value)}
        </text>
      )}
    </svg>
  );
}
