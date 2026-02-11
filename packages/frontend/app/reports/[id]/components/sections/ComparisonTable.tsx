'use client';

import React from 'react';
import { SectionProps } from '../types';
import { formatMetricValue, getMetricFormat } from '@/lib/data';
import { CheckCircle, AlertTriangle } from 'lucide-react';

export function ComparisonTable({ section, report }: SectionProps) {
  const metrics = section.config?.metrics || ['zhvi', 'zori', 'cap_rate', 'days_on_market'];

  const geographies = [
    { id: report.primary_geography_id, name: report.primary_geography_name },
    ...(report.comparison_geographies || []),
  ];

  const getMetricLabel = (metric: string) =>
    metric.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

  // Determine winner for each metric (higher is better for most, lower for some)
  const lowerIsBetter = ['days_on_market', 'vacancy_rate', 'unemployment_rate'];

  function getWinner(metric: string, values: (number | null)[]): number {
    const validValues = values.filter((v): v is number => v !== null);
    if (validValues.length === 0) return -1;
    if (lowerIsBetter.includes(metric)) {
      return values.indexOf(Math.min(...validValues));
    }
    return values.indexOf(Math.max(...validValues));
  }

  // Check if we have any data to display
  const hasData = report.populated_data?.current != null;

  if (!hasData) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on-surface mb-4">Comparison Table</h3>
        <div className="flex items-center justify-center gap-2 py-8 text-on-surface-variant">
          <AlertTriangle className="w-5 h-5" />
          <span>Comparison data not available</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-container rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-outline-variant">
              <th className="text-left p-4 text-on-surface font-semibold">Metric</th>
              {geographies.map((geo, index) => (
                <th key={geo.id} className={`text-center p-4 font-semibold ${index === 0 ? 'text-primary' : 'text-on-surface'}`}>
                  {geo.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric: string) => {
              const values = geographies.map((geo, index) => {
                if (index === 0) {
                  return report.populated_data?.current?.[metric] as number | null;
                }
                // For comparison geographies, would need separate data
                return report.populated_data?.comparables?.find(c => c.geography.id === geo.id)?.metrics?.[metric] ?? null;
              });
              const winner = getWinner(metric, values);

              return (
                <tr key={metric} className="border-b border-outline-variant last:border-0">
                  <td className="p-4 text-on-surface">{getMetricLabel(metric)}</td>
                  {values.map((value, index) => (
                    <td key={index} className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className={`font-medium ${index === winner ? 'text-green-600' : 'text-on-surface'}`}>
                          {value != null ? formatMetricValue(value, getMetricFormat(metric)) : '--'}
                        </span>
                        {index === winner && <CheckCircle className="w-4 h-4 text-green-600" />}
                      </div>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
