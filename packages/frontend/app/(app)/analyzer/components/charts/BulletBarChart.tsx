"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { CHART_TOKENS } from "./chart-tokens";

export interface BulletDatum {
  label: string;
  value: number;
}
export interface BenchmarkZone {
  from: number;
  to: number;
  color: keyof typeof CHART_TOKENS;
}

export interface BulletBarChartProps {
  data: BulletDatum[];
  benchmarkZones?: BenchmarkZone[];
  height?: number;
}

export function BulletBarChart({
  data,
  benchmarkZones = [],
  height = 280,
}: BulletBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 10, right: 30, left: 60, bottom: 10 }}
      >
        <XAxis
          type="number"
          stroke={CHART_TOKENS.neutral}
          fontFamily="Roboto Mono"
        />
        <YAxis
          dataKey="label"
          type="category"
          stroke={CHART_TOKENS.neutral}
          fontFamily="Roboto"
          width={100}
        />
        <Tooltip />
        {benchmarkZones.map((z, i) => (
          <ReferenceArea
            key={i}
            x1={z.from}
            x2={z.to}
            fill={CHART_TOKENS[z.color] as string}
            fillOpacity={0.18}
            ifOverflow="visible"
          />
        ))}
        <Bar
          dataKey="value"
          fill={CHART_TOKENS.primary as string}
          barSize={18}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
