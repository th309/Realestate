"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { CHART_TOKENS } from "./chart-tokens";

export interface BarSpec {
  dataKey: string;
  label: string;
  color: keyof typeof CHART_TOKENS;
}

export interface StackedBarYearChartProps {
  data: Array<Record<string, number>>;
  bars: BarSpec[];
  xKey?: string;
  height?: number;
}

export function StackedBarYearChart({
  data,
  bars,
  xKey = "year",
  height = 280,
}: StackedBarYearChartProps) {
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
        <Legend />
        {bars.map((spec) => (
          <Bar
            key={spec.dataKey}
            dataKey={spec.dataKey}
            name={spec.label}
            stackId="a"
            fill={CHART_TOKENS[spec.color] as string}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
