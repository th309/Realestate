"use client";
import { arc as d3arc } from "d3-shape";
import { CHART_TOKENS } from "./chart-tokens";

export interface ScoreBreakdown {
  label: string;
  weight: number; // 0..1
  color: keyof typeof CHART_TOKENS;
}

export interface ScoreRingChartProps {
  score: number;
  max?: number;
  breakdown?: ScoreBreakdown[];
  size?: number;
  label?: string;
}

export function ScoreRingChart({
  score,
  max = 100,
  breakdown = [],
  size = 200,
  label,
}: ScoreRingChartProps) {
  const radius = size / 2;
  const innerR = radius * 0.65;
  const outerR = radius * 0.92;

  // Background ring
  const bgArc = d3arc<unknown>()
    .innerRadius(innerR)
    .outerRadius(outerR)
    .startAngle(0)
    .endAngle(Math.PI * 2)({} as any) as string;

  // Score arc
  const t = Math.min(1, Math.max(0, score / max));
  const scoreArc = d3arc<unknown>()
    .innerRadius(innerR)
    .outerRadius(outerR)
    .startAngle(0)
    .endAngle(t * Math.PI * 2)
    .cornerRadius(3)({} as any) as string;

  // Breakdown arcs (outer ring at radius * 0.96..1.0)
  let cursor = 0;
  const breakdownArcs = breakdown.map((b) => {
    const start = cursor * Math.PI * 2;
    cursor += b.weight;
    const end = cursor * Math.PI * 2;
    const path = d3arc<unknown>()
      .innerRadius(radius * 0.96)
      .outerRadius(radius * 1.0)
      .startAngle(start)
      .endAngle(end)({} as any) as string;
    return { path, color: b.color, label: b.label };
  });

  return (
    <svg
      viewBox={`-${radius} -${radius} ${size} ${size}`}
      style={{ width: size, height: size }}
    >
      <path data-score-bg d={bgArc} fill={CHART_TOKENS.gridline as string} />
      <path
        data-score-value
        d={scoreArc}
        fill={CHART_TOKENS.primary as string}
      />
      {breakdownArcs.map((b, i) => (
        <path
          key={i}
          data-score-breakdown
          d={b.path}
          fill={CHART_TOKENS[b.color] as string}
        >
          <title>{b.label}</title>
        </path>
      ))}
      <text
        x={0}
        y={radius * 0.08}
        textAnchor="middle"
        fontSize={radius * 0.5}
        fontFamily="Roboto Mono"
        fontWeight={700}
        fill={CHART_TOKENS.neutral as string}
      >
        {Math.round(score)}
      </text>
      {label && (
        <text
          x={0}
          y={radius * 0.4}
          textAnchor="middle"
          fontSize={radius * 0.14}
          fontFamily="Roboto"
          fill={CHART_TOKENS.neutral as string}
        >
          {label}
        </text>
      )}
    </svg>
  );
}
