'use client';

import React from 'react';
import { SectionProps } from '../types';
import { formatMetricValue } from '@/lib/data';
import { PiggyBank, Calendar, Target, AlertTriangle } from 'lucide-react';
import { getMetricWithAliases } from '../utils/metricHelpers';

export function SavingsCalculator({ section, report }: SectionProps) {
  // Try to get median price (zhvi or median_listing_price)
  const medianPrice = getMetricWithAliases(report, 'zhvi')
    ?? getMetricWithAliases(report, 'median_listing_price');

  // Try to get median income
  const medianIncome = getMetricWithAliases(report, 'median_household_income');

  // Check if user provided income
  const userIncome = report.user_inputs?.household_income as number | undefined;
  const monthlyIncome = userIncome ? userIncome / 12 : (medianIncome ? medianIncome / 12 : null);

  // If we don't have price data, show unavailable message
  if (!medianPrice) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
          <PiggyBank className="w-5 h-5 text-primary" />
          Down Payment Savings
        </h3>
        <div className="flex items-center justify-center gap-2 py-8 text-on-surface-variant">
          <AlertTriangle className="w-5 h-5" />
          <p>Home price data not available for this location</p>
        </div>
      </div>
    );
  }

  // If we don't have income data, show limited calculator
  if (!monthlyIncome) {
    const downPaymentPct = section.config?.down_payment_pct || 20;
    const downPayment = medianPrice * (downPaymentPct / 100);

    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
          <PiggyBank className="w-5 h-5 text-primary" />
          Down Payment Target
        </h3>
        <div className="bg-surface rounded-xl p-4 text-center">
          <Target className="w-6 h-6 mx-auto mb-2 text-primary" />
          <p className="text-sm text-on-surface-variant">Down Payment ({downPaymentPct}%)</p>
          <p className="text-2xl font-bold text-on-surface">{formatMetricValue(downPayment, 'currency')}</p>
          <p className="text-xs text-on-surface-variant mt-2">
            Based on {formatMetricValue(medianPrice, 'currency')} median price
          </p>
        </div>
        <p className="text-sm text-on-surface-variant text-center mt-4">
          Enter your income in report settings for personalized timeline
        </p>
      </div>
    );
  }

  const downPaymentPct = section.config?.down_payment_pct || 20;
  const savingsRate = section.config?.savings_rate || 0.20;

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
          <p className="text-lg font-bold text-on-surface">{formatMetricValue(downPayment, 'currency')}</p>
          <p className="text-xs text-on-surface-variant">{downPaymentPct}% of price</p>
        </div>
        <div className="bg-surface rounded-xl p-4 text-center">
          <PiggyBank className="w-6 h-6 mx-auto mb-2 text-green-600" />
          <p className="text-sm text-on-surface-variant">Monthly Savings</p>
          <p className="text-lg font-bold text-on-surface">{formatMetricValue(monthlySavings, 'currency')}</p>
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
        Based on {formatMetricValue(medianPrice, 'currency')} median home price
        {userIncome ? '' : ' and median area income'}
      </p>
    </div>
  );
}
