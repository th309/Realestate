"use client";
import { motion, useReducedMotion } from "framer-motion";
import { CHART_TOKENS } from "./chart-tokens";

export interface BrrrrPhase {
  id: "buy" | "rehab" | "lease" | "season" | "refi" | "stabilized";
  label: string;
  monthStart: number;
  monthEnd: number | null;
}

export interface BrrrrTimelineChartProps {
  phases: BrrrrPhase[];
  animated?: boolean;
  width?: number;
  height?: number;
}

export function BrrrrTimelineChart({
  phases,
  animated = true,
  width = 600,
  height = 100,
}: BrrrrTimelineChartProps) {
  const reduced = useReducedMotion();
  const shouldAnimate = animated && !reduced;
  const padding = 30;
  const innerW = width - 2 * padding;
  const stepX = innerW / Math.max(1, phases.length - 1);
  const cy = height / 2;
  const r = 12;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height }}>
      <line
        x1={padding}
        y1={cy}
        x2={width - padding}
        y2={cy}
        stroke={CHART_TOKENS.gridline as string}
        strokeWidth={2}
      />
      {phases.map((phase, i) => {
        const cx = padding + i * stepX;
        return (
          <g key={phase.id} data-brrrr-phase={phase.id}>
            <motion.circle
              cx={cx}
              cy={cy}
              r={r}
              fill={CHART_TOKENS.primary as string}
              initial={shouldAnimate ? { opacity: 0, scale: 0.6 } : false}
              animate={
                shouldAnimate
                  ? { opacity: 1, scale: 1 }
                  : { opacity: 1, scale: 1 }
              }
              transition={{ delay: shouldAnimate ? i * 0.1 : 0, duration: 0.3 }}
            />
            <text
              x={cx}
              y={cy + r + 16}
              textAnchor="middle"
              fontSize={11}
              fontFamily="Roboto"
              fill={CHART_TOKENS.neutral as string}
            >
              {phase.label}
            </text>
            <text
              x={cx}
              y={cy - r - 6}
              textAnchor="middle"
              fontSize={9}
              fontFamily="Roboto Mono"
              fill={CHART_TOKENS.neutral as string}
            >
              m{phase.monthStart}
              {phase.monthEnd != null && phase.monthEnd !== phase.monthStart
                ? `–${phase.monthEnd}`
                : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
