"use client";
import { extent, max as d3max } from "d3-array";
import { scaleLinear } from "d3-scale";
import { area as d3area, curveBasis } from "d3-shape";
import { CHART_TOKENS } from "./chart-tokens";

export interface DistributionViolinChartProps {
  values: number[];
  yourValue: number;
  width?: number;
  height?: number;
}

function epanechnikov(bandwidth: number) {
  return (x: number) =>
    Math.abs((x /= bandwidth)) <= 1 ? (0.75 * (1 - x * x)) / bandwidth : 0;
}
function kde(kernel: (x: number) => number, thresholds: number[]) {
  return (samples: number[]) =>
    thresholds.map(
      (t) =>
        [
          t,
          samples.reduce((acc, v) => acc + kernel(t - v), 0) / samples.length,
        ] as [number, number],
    );
}

export function DistributionViolinChart({
  values,
  yourValue,
  width = 500,
  height = 160,
}: DistributionViolinChartProps) {
  const padding = 24;

  // Empty-data guard: with no comp population the KDE divides by zero and
  // emits NaN path coordinates. Render a placeholder instead.
  if (!values || values.length === 0 || !Number.isFinite(yourValue)) {
    return (
      <div
        data-violin-empty
        className="h-[160px] flex items-center justify-center text-xs text-on-surface-variant border border-dashed border-outline-variant rounded-lg"
      >
        No comp distribution yet — fetch from RentCast to populate.
      </div>
    );
  }

  const [minV = 0, maxV = 1] = extent(values);
  const domain = [Math.min(minV, yourValue), Math.max(maxV, yourValue)];
  const x = scaleLinear()
    .domain(domain)
    .range([padding, width - padding]);

  const ticks: number[] = [];
  const step = (domain[1] - domain[0]) / 60 || 1;
  for (let v = domain[0]; v <= domain[1]; v += step) ticks.push(v);

  const bandwidth = step * 5;
  const density = kde(epanechnikov(bandwidth), ticks)(values);
  const maxDensity = d3max(density, (d) => d[1]) || 1;
  const cy = height / 2;
  const yScale = scaleLinear()
    .domain([0, maxDensity])
    .range([0, height / 3]);

  const upper =
    d3area<[number, number]>()
      .x((d) => x(d[0]))
      .y0(cy)
      .y1((d) => cy - yScale(d[1]))
      .curve(curveBasis)(density) || "";
  const lower =
    d3area<[number, number]>()
      .x((d) => x(d[0]))
      .y0(cy)
      .y1((d) => cy + yScale(d[1]))
      .curve(curveBasis)(density) || "";

  const yourX = x(yourValue);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height }}>
      <path
        data-violin-shape
        d={upper}
        fill={CHART_TOKENS.primary as string}
        fillOpacity={0.2}
      />
      <path
        data-violin-shape
        d={lower}
        fill={CHART_TOKENS.primary as string}
        fillOpacity={0.2}
      />
      <line
        data-your-value
        x1={yourX}
        y1={padding / 2}
        x2={yourX}
        y2={height - padding / 2}
        stroke={CHART_TOKENS.caution as string}
        strokeWidth={2.5}
      />
      <text
        x={yourX}
        y={padding / 2 - 4}
        textAnchor="middle"
        fontSize={10}
        fontFamily="Roboto Mono"
        fill={CHART_TOKENS.neutral as string}
      >
        you
      </text>
    </svg>
  );
}
