'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatMetricValue } from '@/lib/data';
import { getMetricWithAliases } from '../utils/metricHelpers';
import type { SectionProps } from '../types';

export function ScenarioChart({ section, report }: SectionProps): React.ReactElement {
  const basePrice = getMetricWithAliases(report, 'zhvi');
  const holdPeriod = section.config?.hold_period || 10;

  // Check for missing base price data
  if (basePrice === null) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on-surface mb-4">Value Projection</h3>
        <div className="flex items-center justify-center gap-2 text-on-surface-variant py-8">
          <AlertTriangle className="w-5 h-5" />
          <span>Home value data not available for projections</span>
        </div>
      </div>
    );
  }

  const scenarios = [
    { name: 'Conservative', rate: 0.02, color: '#3b82f6' },
    { name: 'Moderate', rate: 0.04, color: '#22c55e' },
    { name: 'Optimistic', rate: 0.06, color: '#eab308' },
  ];

  // Generate data points
  const data = Array.from({ length: holdPeriod + 1 }, (_, year) => {
    const point: Record<string, string | number> = { year: `Year ${year}` };
    scenarios.forEach((s) => {
      point[s.name] = basePrice * Math.pow(1 + s.rate, year);
    });
    return point;
  });

  const formatPrice = (value: number): string => formatMetricValue(value, 'currency');

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4">Value Projection</h3>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="year" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              formatter={(v: number) => formatPrice(v)}
              contentStyle={{ borderRadius: '8px' }}
            />
            <Legend />
            {scenarios.map((s) => (
              <Line
                key={s.name}
                type="monotone"
                dataKey={s.name}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
