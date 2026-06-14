"use client";
import { CHART_TOKENS } from "./chart-tokens";

export interface TornadoFactor {
  name: string;
  irrAtMinus10pct: number;
  irrAtPlus10pct: number;
  impactMagnitude: number;
}

export interface TornadoChartProps {
  factors: TornadoFactor[];
  baseIRR: number;
  height?: number;
  width?: number;
}

export function TornadoChart({
  factors,
  baseIRR,
  height = 320,
  width = 600,
}: TornadoChartProps) {
  const sorted = [...factors].sort(
    (a, b) => b.impactMagnitude - a.impactMagnitude,
  );
  const labelColW = 100;
  const padding = 16;
  const rowH = (height - 2 * padding) / Math.max(1, sorted.length);
  const barH = Math.min(28, rowH * 0.7);

  const allValues = sorted.flatMap((f) => [
    f.irrAtMinus10pct - baseIRR,
    f.irrAtPlus10pct - baseIRR,
  ]);
  const maxAbs = Math.max(0.01, ...allValues.map(Math.abs));
  const chartW = width - labelColW - padding * 2;
  const center = labelColW + padding + chartW / 2;
  const scaleX = chartW / 2 / maxAbs;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height }}>
      <line
        x1={center}
        x2={center}
        y1={padding}
        y2={height - padding}
        stroke={CHART_TOKENS.neutral as string}
        strokeDasharray="3 3"
      />
      {sorted.map((f, i) => {
        const y = padding + i * rowH + (rowH - barH) / 2;
        const minDelta = f.irrAtMinus10pct - baseIRR;
        const plusDelta = f.irrAtPlus10pct - baseIRR;
        const x1 = center + Math.min(minDelta, plusDelta) * scaleX;
        const w = Math.abs(plusDelta - minDelta) * scaleX;
        return (
          <g key={f.name} data-tornado-row={f.name}>
            <text
              x={labelColW + padding - 6}
              y={y + barH / 2 + 4}
              textAnchor="end"
              fontSize={12}
              fontFamily="Roboto"
              fill={CHART_TOKENS.neutral as string}
            >
              {f.name}
            </text>
            <rect
              x={x1}
              y={y}
              width={Math.max(2, w)}
              height={barH}
              rx={3}
              fill={CHART_TOKENS.primary as string}
              fillOpacity={0.7}
            />
          </g>
        );
      })}
    </svg>
  );
}
