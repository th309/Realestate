'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatMetricValue, getMetricFormat } from '@/lib/data';
import type { SectionProps } from '../types';

const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea'];

export function ComparisonChartGrid({ section, report }: SectionProps): React.ReactElement {
  const metrics = section.config?.metrics;
  const columns = section.config?.columns || 2;

  // Check for missing metrics configuration
  if (!metrics || metrics.length === 0) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <div className="flex items-center gap-2 text-on-surface-variant">
          <AlertTriangle className="w-5 h-5" />
          <span>No metrics configured for comparison chart</span>
        </div>
      </div>
    );
  }

  const geographies = [
    { id: report.primary_geography_id, name: report.primary_geography_name },
    ...(report.comparison_geographies || []).map((g) => ({ id: g.id, name: g.name })),
  ];

  return (
    <div className={`grid grid-cols-1 md:grid-cols-${columns} gap-4`}>
      {metrics.map((metricId: string) => {
        const title = metricId
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c: string) => c.toUpperCase());
        const primaryData = report.populated_data?.historical?.[metricId];
        const format = getMetricFormat(metricId);

        // Check for missing historical data
        if (!primaryData || primaryData.length === 0) {
          return (
            <div key={metricId} className="bg-surface-container rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-on-surface mb-4">{title}</h3>
              <div className="flex items-center justify-center gap-2 text-on-surface-variant py-8">
                <AlertTriangle className="w-5 h-5" />
                <span>Historical data not available</span>
              </div>
            </div>
          );
        }

        // Merge data from all geographies
        const mergedData = primaryData.map((point: { date: string; value: number }) => {
          const entry: Record<string, string | number> = {
            date: new Date(point.date).toLocaleDateString('en-US', {
              month: 'short',
              year: '2-digit',
            }),
          };
          entry[report.primary_geography_name] = point.value;
          return entry;
        });

        const formatValue = (value: number): string => formatMetricValue(value, format);

        return (
          <div key={metricId} className="bg-surface-container rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-on-surface mb-4">{title}</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mergedData}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatValue}
                  />
                  <Tooltip formatter={(v: number) => formatValue(v)} />
                  <Legend />
                  {geographies.map((geo, index) => (
                    <Line
                      key={geo.id}
                      type="monotone"
                      dataKey={geo.name}
                      stroke={COLORS[index % COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}
