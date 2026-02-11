'use client';

import React from 'react';
import { SectionProps } from '../types';
import { formatMetricValue } from '@/lib/data';
import { PiggyBank, Calendar, Target } from 'lucide-react';

export function SavingsCalculator({ section, report }: SectionProps) {
  const medianPrice = report.populated_data?.current?.zhvi as number || 400000;
  const downPaymentPct = section.config?.down_payment_pct || 20;
  const monthlyIncome = (report.populated_data?.current?.median_household_income as number || 75000) / 12;
  const savingsRate = section.config?.savings_rate || 0.20; // 20% of income

  const downPayment = medianPrice * (downPaymentPct / 100);
  const monthlySavings = monthlyIncome * savingsRate;
  const monthsToSave = Math.ceil(downPayment / monthlySavings);
  const yearsToSave = Math.floor(monthsToSave / 12);
  const remainingMonths = monthsToSave % 12;

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
        <PiggyBank className="w-5 h-5 text-primary" />
        Down Payment Savings
      </h3>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-surface rounded-xl p-4 text-center">
          <Target className="w-6 h-6 mx-auto mb-2 text-primary" />
          <p className="text-sm text-on-surface-variant">Down Payment</p>
          <p className="text-lg font-bold text-on-surface">{formatMetricValue('price', downPayment)}</p>
          <p className="text-xs text-on-surface-variant">{downPaymentPct}% of price</p>
        </div>
        <div className="bg-surface rounded-xl p-4 text-center">
          <PiggyBank className="w-6 h-6 mx-auto mb-2 text-green-600" />
          <p className="text-sm text-on-surface-variant">Monthly Savings</p>
          <p className="text-lg font-bold text-on-surface">{formatMetricValue('price', monthlySavings)}</p>
          <p className="text-xs text-on-surface-variant">{(savingsRate * 100).toFixed(0)}% of income</p>
        </div>
        <div className="bg-surface rounded-xl p-4 text-center">
          <Calendar className="w-6 h-6 mx-auto mb-2 text-amber-600" />
          <p className="text-sm text-on-surface-variant">Time to Goal</p>
          <p className="text-lg font-bold text-on-surface">
            {yearsToSave > 0 ? `${yearsToSave}y ` : ''}{remainingMonths}m
          </p>
          <p className="text-xs text-on-surface-variant">{monthsToSave} months total</p>
        </div>
      </div>

      <p className="text-sm text-on-surface-variant text-center">
        Based on {formatMetricValue('price', medianPrice)} median home price
      </p>
    </div>
  );
}
