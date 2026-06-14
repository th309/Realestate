"use client";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { CHART_TOKENS } from "./chart-tokens";

export interface AreaSpec {
  dataKey: string;
  label: string;
  color: keyof typeof CHART_TOKENS;
}

export interface StackedAreaChartProps {
  data: Array<Record<string, number>>;
  areas: AreaSpec[];
  xKey?: string;
  height?: number;
}

export function StackedAreaChart({
  data,
  areas,
  xKey = "year",
  height = 280,
}: StackedAreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
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
        {areas.map((spec) => (
          <Area
            key={spec.dataKey}
            type="monotone"
            dataKey={spec.dataKey}
            name={spec.label}
            stroke={CHART_TOKENS[spec.color] as string}
            fill={CHART_TOKENS[spec.color] as string}
            fillOpacity={0.6}
            stackId="a"
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
