"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { CHART_TOKENS } from "./chart-tokens";

export interface LineSpec {
  dataKey: string;
  label: string;
  color: keyof typeof CHART_TOKENS;
}

export interface MultiLineChartProps {
  data: Array<Record<string, number>>;
  lines: LineSpec[];
  xKey?: string;
  height?: number;
}

export function MultiLineChart({
  data,
  lines,
  xKey = "year",
  height = 280,
}: MultiLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={data}
        margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_TOKENS.gridline} />
        <XAxis
          dataKey={xKey}
          stroke={CHART_TOKENS.neutral}
          fontFamily="Roboto Mono"
        />
        <YAxis stroke={CHART_TOKENS.neutral} fontFamily="Roboto Mono" />
        <Tooltip />
        <Legend />
        {lines.map((spec) => (
          <Line
            key={spec.dataKey}
            type="monotone"
            dataKey={spec.dataKey}
            name={spec.label}
            stroke={CHART_TOKENS[spec.color] as string}
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={true}
            animationDuration={200}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
