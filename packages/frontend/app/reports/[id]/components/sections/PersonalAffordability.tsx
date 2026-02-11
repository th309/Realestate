'use client';

import React from 'react';
import { SectionProps } from '../types';
import { formatMetricValue } from '@/lib/data';
import { User, Home, Percent } from 'lucide-react';

export function PersonalAffordability({ section, report }: SectionProps) {
  const userIncome = report.user_inputs?.annual_income || report.populated_data?.current?.median_household_income as number || 75000;
  const userDownPayment = report.user_inputs?.down_payment || 0;
  const medianPrice = report.populated_data?.current?.zhvi as number || 400000;

  // Calculate affordability
  const maxAffordable = userIncome * 4 + userDownPayment; // Rough rule
  const affordabilityRatio = maxAffordable / medianPrice;
  const canAfford = affordabilityRatio >= 1;

  const getAffordabilityLabel = (ratio: number) => {
    if (ratio >= 1.2) return { label: 'Comfortably Affordable', color: 'text-green-600', bg: 'bg-green-100' };
    if (ratio >= 1) return { label: 'Affordable', color: 'text-green-600', bg: 'bg-green-50' };
    if (ratio >= 0.8) return { label: 'Stretch Budget', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    return { label: 'Above Budget', color: 'text-red-600', bg: 'bg-red-50' };
  };

  const status = getAffordabilityLabel(affordabilityRatio);

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
        <User className="w-5 h-5 text-primary" />
        Your Affordability
      </h3>

      <div className={`p-4 rounded-xl mb-4 ${status.bg}`}>
        <p className={`text-center font-semibold text-lg ${status.color}`}>{status.label}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface rounded-xl p-4">
          <p className="text-sm text-on-surface-variant mb-1">Your Budget</p>
          <p className="text-xl font-bold text-on-surface">{formatMetricValue('price', maxAffordable)}</p>
        </div>
        <div className="bg-surface rounded-xl p-4">
          <p className="text-sm text-on-surface-variant mb-1">Median Price</p>
          <p className="text-xl font-bold text-on-surface">{formatMetricValue('price', medianPrice)}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        <Percent className="w-4 h-4 text-on-surface-variant" />
        <span className="text-on-surface-variant">
          {canAfford ? 'You can afford ' : 'You can afford '}
          <span className="font-semibold text-on-surface">{(affordabilityRatio * 100).toFixed(0)}%</span>
          {' of median-priced homes'}
        </span>
      </div>
    </div>
  );
}
