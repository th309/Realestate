"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { CHART_TOKENS } from "./chart-tokens";

export interface Benchmark {
  value: number;
  label: string;
  color: keyof typeof CHART_TOKENS;
}

export interface BarByYearChartProps {
  data: Array<{ year: number; value: number }>;
  benchmarks?: Benchmark[];
  color?: keyof typeof CHART_TOKENS;
  xKey?: string;
  yKey?: string;
  height?: number;
}

export function BarByYearChart({
  data,
  benchmarks = [],
  color = "primary",
  xKey = "year",
  yKey = "value",
  height = 280,
}: BarByYearChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
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
        <Bar dataKey={yKey} fill={CHART_TOKENS[color] as string} />
        {benchmarks.map((b, i) => (
          <ReferenceLine
            key={i}
            y={b.value}
            stroke={CHART_TOKENS[b.color] as string}
            strokeDasharray="4 4"
            label={{ value: b.label, position: "right", fontSize: 10 }}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
