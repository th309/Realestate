"use client";

import { useMemo } from "react";
import { CHART_TOKENS, CHART_HEIGHTS } from "./chart-tokens";

export interface WaterfallStep {
  label: string;
  value: number;
  kind: "start" | "subtract" | "add" | "end";
}

export interface WaterfallChartProps {
  steps: WaterfallStep[];
  height?: number;
  width?: number;
}

export function WaterfallChart({
  steps,
  height = CHART_HEIGHTS.desktop,
  width = 800,
}: WaterfallChartProps) {
  const layout = useMemo(
    () => computeLayout(steps, width, height),
    [steps, width, height],
  );
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height }}>
      {layout.map((step, i) => (
        <g key={i}>
          <rect
            data-waterfall-bar
            x={step.x}
            y={step.y}
            width={step.barWidth}
            height={step.barHeight}
            rx={3}
            fill={
              step.kind === "start" || step.kind === "end"
                ? (CHART_TOKENS.primary as string)
                : step.value < 0
                  ? (CHART_TOKENS.negative as string)
                  : (CHART_TOKENS.positive as string)
            }
            fillOpacity={step.kind === "start" || step.kind === "end" ? 1 : 0.6}
          />
          <text
            x={step.x + step.barWidth / 2}
            y={step.y - 6}
            textAnchor="middle"
            fontSize={12}
            fontFamily="Roboto Mono"
            fill={CHART_TOKENS.neutral as string}
          >
            {step.value > 0
              ? `+$${Math.round(step.value)}`
              : `−$${Math.round(Math.abs(step.value))}`}
          </text>
          <text
            x={step.x + step.barWidth / 2}
            y={height - 8}
            textAnchor="middle"
            fontSize={10}
            fontFamily="Roboto"
            fill={CHART_TOKENS.neutral as string}
          >
            {step.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function computeLayout(steps: WaterfallStep[], width: number, height: number) {
  const padding = 30;
  const barW = Math.min(60, (width - 2 * padding) / steps.length - 8);
  const maxVal = Math.max(...steps.map((s) => Math.abs(s.value)));
  const scaleY = (height - 2 * padding) / maxVal;
  let runningTotal = 0;
  return steps.map((step, i) => {
    const x = padding + i * (barW + 8);
    let y: number, barHeight: number;
    if (step.kind === "start") {
      runningTotal = step.value;
      barHeight = step.value * scaleY;
      y = height - padding - barHeight;
    } else if (step.kind === "end") {
      barHeight = step.value * scaleY;
      y = height - padding - barHeight;
      runningTotal = step.value;
    } else {
      const prevTop = height - padding - runningTotal * scaleY;
      barHeight = Math.abs(step.value) * scaleY;
      y = step.value < 0 ? prevTop : prevTop - barHeight;
      runningTotal += step.value;
    }
    return { ...step, x, y, barWidth: barW, barHeight };
  });
}
