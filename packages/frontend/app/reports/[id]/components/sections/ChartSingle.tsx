'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { formatMetricValue, getMetricFormat } from '@/lib/data';
import type { SectionProps } from '../types';

export function ChartSingle({ section, report }: SectionProps): React.ReactElement {
  const metricId = section.config?.metric;
  const chartType = section.config?.chart_type || 'area';
  const title =
    section.config?.title ||
    metricId?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  const color = section.config?.color || '#2563eb';

  // Check for missing metric configuration
  if (!metricId) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <div className="flex items-center gap-2 text-on-surface-variant">
          <AlertTriangle className="w-5 h-5" />
          <span>Chart metric not configured</span>
        </div>
      </div>
    );
  }

  const historical = report.populated_data?.historical?.[metricId];

  // Check for missing data - historical is an object with data array, trend, change_pct
  if (!historical || !historical.data || historical.data.length === 0) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on-surface mb-4">{title}</h3>
        <div className="flex items-center justify-center gap-2 text-on-surface-variant py-8">
          <AlertTriangle className="w-5 h-5" />
          <span>Historical data not available</span>
        </div>
      </div>
    );
  }

  const format = getMetricFormat(metricId);
  const data = historical.data.map((point: { date: string; value: number }) => ({
    date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    value: point.value,
  }));

  const formatValue = (value: number): string => formatMetricValue(value, format);

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'line' ? (
            <LineChart data={data}>
              <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatValue}
              />
              <Tooltip formatter={(v: number) => formatValue(v)} />
              <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
            </LineChart>
          ) : (
            <AreaChart data={data}>
              <defs>
                <linearGradient id={`gradient-${metricId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatValue}
              />
              <Tooltip formatter={(v: number) => formatValue(v)} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                fill={`url(#gradient-${metricId})`}
                strokeWidth={2}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
