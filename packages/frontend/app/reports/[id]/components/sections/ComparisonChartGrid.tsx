'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatMetricValue, getMetricFormat } from '@/lib/data';
import type { ReportInstance } from '../../../types';

const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea'];

// Default metrics to chart when comparing geographies
const DEFAULT_CHART_METRICS = ['home_value', 'days_on_market', 'for_sale_inventory', 'hotness_score'];

interface ComparisonChartGridProps {
  report: ReportInstance;
}

export function ComparisonChartGrid({ report }: ComparisonChartGridProps): React.ReactElement {
  const metrics = DEFAULT_CHART_METRICS;
  const columns = 2;

  // Build geographies list from primary and populated comparison data
  const comparisonData = report.populated_data?.comparisons;
  const geographies = [
    { id: report.primary_geography_id, name: report.primary_geography_name },
    ...(comparisonData
      ? Object.entries(comparisonData).map(([geoId, comp]) => ({
          id: geoId,
          name: comp.geography.name,
        }))
      : []),
  ];

  // Filter metrics to only those with data
  const metricsWithData = metrics.filter((metricId) => {
    const primaryData = report.populated_data?.historical?.[metricId];
    return primaryData && primaryData.data && primaryData.data.length > 0;
  });

  if (metricsWithData.length === 0) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <div className="flex items-center gap-2 text-on-surface-variant">
          <AlertTriangle className="w-5 h-5" />
          <span>No historical data available for comparison charts</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-${columns} gap-4`}>
      {metricsWithData.map((metricId: string) => {
        const title = metricId
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c: string) => c.toUpperCase());
        const primaryData = report.populated_data?.historical?.[metricId];
        const format = getMetricFormat(metricId);

        // Check for missing historical data - primaryData is an object with data array
        if (!primaryData || !primaryData.data || primaryData.data.length === 0) {
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

        // Collect all unique dates from primary and comparison geographies
        const allDates = new Set<string>();
        if (primaryData?.data) {
          primaryData.data.forEach((d: { date: string }) => allDates.add(d.date));
        }
        if (comparisonData) {
          Object.values(comparisonData).forEach((comp) => {
            const histData = comp.historical?.[metricId]?.data;
            if (histData) {
              histData.forEach((d) => allDates.add(d.date));
            }
          });
        }

        // Build merged data with values from all geographies
        const mergedData = Array.from(allDates)
          .sort()
          .map((date) => {
            const entry: Record<string, string | number | undefined> = {
              date: new Date(date).toLocaleDateString('en-US', {
                month: 'short',
                year: '2-digit',
              }),
            };

            // Add primary geography value
            const primaryPoint = primaryData?.data?.find(
              (d: { date: string; value: number }) => d.date === date
            );
            entry[report.primary_geography_name] = primaryPoint?.value;

            // Add comparison geography values
            if (comparisonData) {
              Object.entries(comparisonData).forEach(([, comp]) => {
                const compPoint = comp.historical?.[metricId]?.data?.find(
                  (d) => d.date === date
                );
                entry[comp.geography.name] = compPoint?.value;
              });
            }

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
