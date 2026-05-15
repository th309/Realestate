"use client";

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { CHART_TOKENS } from "./chart-tokens";

export interface ComposedSensitivityChartProps {
  data: Array<{
    year: number;
    value: number;
    bandLow: number;
    bandHigh: number;
  }>;
  referenceLine?: { value: number; label: string };
  height?: number;
}

export function ComposedSensitivityChart({
  data,
  referenceLine,
  height = 280,
}: ComposedSensitivityChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart
        data={data}
        margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_TOKENS.gridline} />
        <XAxis
          dataKey="year"
          stroke={CHART_TOKENS.neutral}
          fontFamily="Roboto Mono"
        />
        <YAxis stroke={CHART_TOKENS.neutral} fontFamily="Roboto Mono" />
        <Tooltip />
        <Area
          type="monotone"
          dataKey={(d: { bandLow: number; bandHigh: number }) => [
            d.bandLow,
            d.bandHigh,
          ]}
          stroke="none"
          fill={CHART_TOKENS.primary as string}
          fillOpacity={0.18}
          name="Confidence Band"
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={CHART_TOKENS.primary as string}
          strokeWidth={2.5}
          dot={false}
          isAnimationActive={false}
        />
        {referenceLine && (
          <ReferenceLine
            y={referenceLine.value}
            stroke={CHART_TOKENS.caution as string}
            strokeDasharray="4 4"
            label={{
              value: referenceLine.label,
              position: "right",
              fontSize: 10,
            }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
