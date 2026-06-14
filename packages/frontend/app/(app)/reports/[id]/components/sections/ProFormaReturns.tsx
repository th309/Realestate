'use client';

import React from 'react';
import { SectionProps } from '../types';
import { AlertTriangle, TrendingUp, Percent, PiggyBank } from 'lucide-react';

export function ProFormaReturns({ section, report }: SectionProps) {
  const proforma = report.populated_data?.pro_forma;
  const returns = proforma?.returns;

  if (!returns) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Investment Returns
        </h3>
        <div className="flex flex-col items-center justify-center py-8 text-on-surface-variant">
          <AlertTriangle className="w-8 h-8 mb-2 text-outline" />
          <p>Returns data not available</p>
        </div>
      </div>
    );
  }

  const metrics = [
    {
      label: 'Cash-on-Cash Return',
      value: returns.cash_on_cash,
      icon: PiggyBank,
      description: 'Annual cash flow / cash invested',
      benchmark: 8,
    },
    {
      label: 'Cap Rate',
      value: returns.cap_rate,
      icon: Percent,
      description: 'NOI / purchase price',
      benchmark: 5,
    },
    {
      label: 'Total Return',
      value: returns.total_return_with_appreciation,
      icon: TrendingUp,
      description: 'Including appreciation',
      benchmark: 12,
    },
  ];

  const getStatusColor = (value: number, benchmark: number) => {
    if (value >= benchmark * 1.2) return 'text-green-600 bg-green-100';
    if (value >= benchmark) return 'text-green-500 bg-green-50';
    if (value >= benchmark * 0.7) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" />
        Investment Returns
      </h3>

      <div className="grid md:grid-cols-3 gap-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const colors = getStatusColor(metric.value, metric.benchmark);

          return (
            <div key={metric.label} className={`p-4 rounded-xl ${colors.split(' ')[1]}`}>
              <Icon className={`w-6 h-6 mb-2 ${colors.split(' ')[0]}`} />
              <p className="text-sm text-on-surface-variant mb-1">{metric.label}</p>
              <p className={`text-2xl font-bold ${colors.split(' ')[0]}`}>
                {metric.value.toFixed(1)}%
              </p>
              <p className="text-xs text-on-surface-variant mt-1">{metric.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
