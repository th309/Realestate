'use client';

import React from 'react';
import type { ReportInstance } from '../../../types';
import { formatMetricValue, getMetricFormat } from '@/lib/data';
import { MetricTitle } from '@/app/components/MetricTitle';
import { CheckCircle, AlertTriangle } from 'lucide-react';

interface ComparisonTableProps {
  report: ReportInstance;
}

// Default metrics to compare when no config provided
const DEFAULT_METRICS = ['home_value', 'days_on_market', 'for_sale_inventory', 'hotness_score', 'median_income', 'cap_rate'];

interface Geography {
  id: string;
  name: string;
}

export function ComparisonTable({ report }: ComparisonTableProps) {
  const metrics = DEFAULT_METRICS;

  const geographies: Geography[] = [
    { id: report.primary_geography_id, name: report.primary_geography_name },
    ...(report.comparison_geographies || []),
  ];

  const getValue = (geo: Geography, metric: string): number | null => {
    if (geo.id === report.primary_geography_id) {
      // Primary geography - use current data
      const value = report.populated_data?.current?.[metric];
      return value !== undefined && value !== null ? Number(value) : null;
    } else {
      // Comparison geography - use comparisons data
      const compData = report.populated_data?.comparisons?.[geo.id];
      const value = compData?.current?.[metric];
      return value !== undefined && value !== null ? Number(value) : null;
    }
  };

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
              const values = geographies.map((geo) => getValue(geo, metric));
              const winner = getWinner(metric, values);

              return (
                <tr key={metric} className="border-b border-outline-variant last:border-0">
                  <td className="p-4 text-on-surface"><MetricTitle metricId={metric} /></td>
                  {values.map((value, index) => (
                    <td key={index} className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className={`font-medium ${index === winner ? 'text-green-600' : 'text-on-surface'}`}>
                          {value != null ? formatMetricValue(value, getMetricFormat(metric)) : '\u2014'}
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
