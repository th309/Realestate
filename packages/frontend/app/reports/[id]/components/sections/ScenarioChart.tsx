'use client';

import React from 'react';
import { SectionProps } from '../types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatMetricValue } from '@/lib/data';

export function ScenarioChart({ section, report }: SectionProps) {
  const basePrice = report.populated_data?.current?.zhvi as number || 400000;
  const holdPeriod = section.config?.hold_period || 10;

  const scenarios = [
    { name: 'Conservative', rate: 0.02, color: '#3b82f6' },
    { name: 'Moderate', rate: 0.04, color: '#22c55e' },
    { name: 'Optimistic', rate: 0.06, color: '#eab308' },
  ];

  // Generate data points
  const data = Array.from({ length: holdPeriod + 1 }, (_, year) => {
    const point: Record<string, any> = { year: `Year ${year}` };
    scenarios.forEach(s => {
      point[s.name] = basePrice * Math.pow(1 + s.rate, year);
    });
    return point;
  });

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
              formatter={(v: number) => formatMetricValue('price', v)}
              contentStyle={{ borderRadius: '8px' }}
            />
            <Legend />
            {scenarios.map(s => (
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
