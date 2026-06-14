'use client';

import React from 'react';
import { SectionProps } from '../types';
import { formatMetricValue } from '@/lib/data';
import { getMetricWithAliases } from '../utils/metricHelpers';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { AlertTriangle } from 'lucide-react';

const COLORS = ['#2563eb', '#16a34a', '#eab308', '#dc2626', '#9333ea'];

export function BudgetBreakdown({
  section,
  report,
}: SectionProps): React.ReactElement {
  const medianPrice =
    getMetricWithAliases(report, 'zhvi') ??
    getMetricWithAliases(report, 'median_listing_price');

  const annualIncome =
    report.user_inputs?.annual_income ??
    getMetricWithAliases(report, 'median_household_income');

  if (!medianPrice || !annualIncome) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on-surface mb-4">
          Monthly Budget Breakdown
        </h3>
        <div className="flex items-center justify-center gap-2 py-8 text-on-surface-variant">
          <AlertTriangle className="w-5 h-5" />
          <p>Data not available for this location</p>
        </div>
      </div>
    );
  }

  const monthlyIncome = annualIncome / 12;
  const monthlyMortgage =
    (medianPrice * 0.8 * 0.065) / 12 + (medianPrice * 0.01) / 12;
  const housingRatio = monthlyMortgage / monthlyIncome;

  const data = [
    { name: 'Housing', value: Math.round(monthlyMortgage), pct: housingRatio },
    { name: 'Other Expenses', value: Math.round(monthlyIncome * 0.35) },
    { name: 'Savings', value: Math.round(monthlyIncome * 0.15) },
    {
      name: 'Discretionary',
      value: Math.round(monthlyIncome - monthlyMortgage - monthlyIncome * 0.5),
    },
  ];

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4">
        Monthly Budget Breakdown
      </h3>

      <div className="flex flex-col md:flex-row items-center gap-6">
        <div className="w-48 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex-1 space-y-3">
          {data.map((item, index) => (
            <div key={item.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[index] }}
                />
                <span className="text-on-surface">{item.name}</span>
              </div>
              <span className="font-semibold text-on-surface">
                {formatMetricValue(item.value, 'currency')}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div
        className={`mt-4 p-3 rounded-xl ${housingRatio > 0.28 ? 'bg-red-100' : 'bg-green-100'}`}
      >
        <p
          className={`text-center text-sm ${housingRatio > 0.28 ? 'text-red-700' : 'text-green-700'}`}
        >
          Housing: {(housingRatio * 100).toFixed(0)}% of income
          {housingRatio > 0.28
            ? ' (above recommended 28%)'
            : ' (within recommended 28%)'}
        </p>
      </div>
    </div>
  );
}
