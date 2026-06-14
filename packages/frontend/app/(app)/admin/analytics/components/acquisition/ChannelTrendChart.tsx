/**
 * ChannelTrendChart
 *
 * Multi-line LineChart with one line per acquisition channel
 * (direct, organic, utm, email, referral, social).
 * Annotations from the backend are rendered as vertical ReferenceLine markers.
 */

"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type {
  AnalyticsTimeSeriesPoint,
  Annotation,
} from "@/lib/data/fetchers/admin-analytics.types";

interface ChannelTrendEntry {
  channel: string;
  data: AnalyticsTimeSeriesPoint[];
}

interface ChannelTrendChartProps {
  channelTrend: ChannelTrendEntry[];
  annotations?: Annotation[];
}

const CHANNEL_COLORS: Record<string, string> = {
  direct: "#3949AB",
  organic: "#22c55e",
  utm: "#3b82f6",
  email: "#f59e0b",
  referral: "#ec4899",
  social: "#14b8a6",
};

function getChannelColor(channel: string): string {
  return CHANNEL_COLORS[channel.toLowerCase()] ?? "#94a3b8";
}

function formatAxisDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function buildMergedSeries(
  channelTrend: ChannelTrendEntry[],
): Record<string, string | number>[] {
  const dateMap = new Map<string, Record<string, string | number>>();

  for (const { channel, data } of channelTrend) {
    for (const { date, value } of data) {
      if (!dateMap.has(date)) dateMap.set(date, { date });
      dateMap.get(date)![channel] = value;
    }
  }

  return Array.from(dateMap.values()).sort((a, b) =>
    String(a.date).localeCompare(String(b.date)),
  );
}

export function ChannelTrendChart({
  channelTrend,
  annotations = [],
}: ChannelTrendChartProps) {
  if (!channelTrend || channelTrend.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-on-surface-variant">
        No channel trend data available
      </div>
    );
  }

  const mergedData = buildMergedSeries(channelTrend);
  const channels = channelTrend.map((c) => c.channel);

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart
        data={mergedData}
        margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--color-outline-variant)"
          opacity={0.4}
        />
        <XAxis
          dataKey="date"
          tickFormatter={formatAxisDate}
          tick={{ fontSize: 11, fill: "var(--color-on-surface-variant)" }}
          tickLine={false}
          axisLine={false}
          minTickGap={40}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--color-on-surface-variant)" }}
          tickLine={false}
          axisLine={false}
          width={36}
        />
        <Tooltip
          labelFormatter={(label) => formatAxisDate(String(label))}
          contentStyle={{
            backgroundColor: "var(--color-surface-container-high)",
            border: "1px solid var(--color-outline-variant)",
            borderRadius: "8px",
            fontSize: "12px",
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
          iconType="circle"
          iconSize={8}
        />

        {annotations.map((ann) => (
          <ReferenceLine
            key={ann.id}
            x={ann.annotationDate}
            stroke="var(--color-outline)"
            strokeDasharray="4 2"
            label={{
              value: ann.label,
              position: "top",
              fontSize: 10,
              fill: "var(--color-on-surface-variant)",
            }}
          />
        ))}

        {channels.map((channel) => (
          <Line
            key={channel}
            type="monotone"
            dataKey={channel}
            name={channel.charAt(0).toUpperCase() + channel.slice(1)}
            stroke={getChannelColor(channel)}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
