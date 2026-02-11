'use client';

import React from 'react';
import { SectionProps } from '../types';
import { formatMetricValue } from '@/lib/data';
import { Calendar, Flag, Star } from 'lucide-react';

export function SavingsTimeline({ section, report }: SectionProps) {
  const medianPrice = report.populated_data?.current?.zhvi as number || 400000;
  const downPayment20 = medianPrice * 0.20;
  const downPayment10 = medianPrice * 0.10;
  const downPayment5 = medianPrice * 0.05;

  const monthlyIncome = (report.populated_data?.current?.median_household_income as number || 75000) / 12;
  const monthlySavings = monthlyIncome * 0.20;

  const milestones = [
    { pct: 5, amount: downPayment5, months: Math.ceil(downPayment5 / monthlySavings), label: '5% Down (FHA)' },
    { pct: 10, amount: downPayment10, months: Math.ceil(downPayment10 / monthlySavings), label: '10% Down' },
    { pct: 20, amount: downPayment20, months: Math.ceil(downPayment20 / monthlySavings), label: '20% Down (No PMI)' },
  ];

  const formatTime = (months: number) => {
    const years = Math.floor(months / 12);
    const m = months % 12;
    if (years === 0) return `${m} months`;
    if (m === 0) return `${years} year${years > 1 ? 's' : ''}`;
    return `${years}y ${m}m`;
  };

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-primary" />
        Savings Timeline
      </h3>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-outline-variant" />

        <div className="space-y-6">
          {milestones.map((milestone, index) => (
            <div key={milestone.pct} className="flex items-start gap-4 relative">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 ${
                index === milestones.length - 1 ? 'bg-primary' : 'bg-surface-container-high'
              }`}>
                {index === milestones.length - 1 ? (
                  <Star className="w-4 h-4 text-on-primary" />
                ) : (
                  <Flag className="w-4 h-4 text-on-surface-variant" />
                )}
              </div>
              <div className="flex-1 bg-surface rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-semibold text-on-surface">{milestone.label}</span>
                  <span className="text-primary font-bold">{formatTime(milestone.months)}</span>
                </div>
                <p className="text-sm text-on-surface-variant">
                  Save {formatMetricValue('price', milestone.amount)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-4 text-sm text-on-surface-variant text-center">
        Based on {formatMetricValue('price', monthlySavings)}/month savings (20% of median income)
      </p>
    </div>
  );
}
