'use client';

import React from 'react';
import { SectionProps } from '../types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { formatMetricValue } from '@/lib/data';

export function ChartSingle({ section, report }: SectionProps) {
  const metricId = section.config?.metric;
  const chartType = section.config?.chart_type || 'area';
  const title = section.config?.title || metricId?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  const color = section.config?.color || '#2563eb';

  const historical = report.populated_data?.historical?.[metricId] || [];

  if (historical.length === 0) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on-surface mb-4">{title}</h3>
        <p className="text-on-surface-variant text-center py-8">No historical data available</p>
      </div>
    );
  }

  const data = historical.map((point: { date: string; value: number }) => ({
    date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    value: point.value,
  }));

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'line' ? (
            <LineChart data={data}>
              <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatMetricValue(metricId, v)} />
              <Tooltip formatter={(v: number) => formatMetricValue(metricId, v)} />
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
              <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatMetricValue(metricId, v)} />
              <Tooltip formatter={(v: number) => formatMetricValue(metricId, v)} />
              <Area type="monotone" dataKey="value" stroke={color} fill={`url(#gradient-${metricId})`} strokeWidth={2} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
