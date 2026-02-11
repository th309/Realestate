'use client';

import React from 'react';
import { SectionProps } from '../types';
import { TrendingUp, DollarSign, Shield, Clock } from 'lucide-react';

export function InvestmentVerdict({ section, report }: SectionProps) {
  const score = report.investoredge_score || 0;
  const details = report.scores_snapshot?.investoredge_details;

  const metrics = [
    { label: 'Cash Flow', value: details?.cash_flow, icon: DollarSign },
    { label: 'Appreciation', value: details?.appreciation, icon: TrendingUp },
    { label: 'Risk', value: details?.risk, icon: Shield },
    { label: 'Liquidity', value: details?.liquidity, icon: Clock },
  ];

  const getRecommendation = (s: number) => {
    if (s >= 75) return 'Strong investment opportunity with favorable fundamentals.';
    if (s >= 60) return 'Good potential with some areas to monitor.';
    if (s >= 45) return 'Mixed signals - thorough due diligence recommended.';
    return 'Challenging market conditions for investment.';
  };

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-2">Investment Analysis</h3>
      <p className="text-on-surface-variant mb-4">{getRecommendation(score)}</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const value = metric.value || 0;
          return (
            <div key={metric.label} className="text-center">
              <Icon className={`w-6 h-6 mx-auto mb-1 ${value >= 60 ? 'text-green-600' : value >= 40 ? 'text-yellow-600' : 'text-red-600'}`} />
              <p className="text-sm text-on-surface-variant">{metric.label}</p>
              <p className="text-lg font-semibold text-on-surface">{value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
