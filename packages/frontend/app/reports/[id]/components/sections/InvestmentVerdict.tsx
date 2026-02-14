'use client';

import { AlertTriangle, TrendingUp, DollarSign, Shield, Clock } from 'lucide-react';

import type { SectionProps } from '../types';

interface MetricDisplay {
  label: string;
  value: number;
  icon: typeof DollarSign;
}

function getRecommendation(score: number): string {
  if (score >= 75) return 'Strong investment opportunity with favorable fundamentals.';
  if (score >= 60) return 'Good potential with some areas to monitor.';
  if (score >= 45) return 'Mixed signals - thorough due diligence recommended.';
  return 'Challenging market conditions for investment.';
}

function getValueColor(value: number): string {
  if (value >= 60) return 'text-green-600';
  if (value >= 40) return 'text-yellow-600';
  return 'text-red-600';
}

export function InvestmentVerdict({ section, report }: SectionProps): React.ReactElement {
  const score = report.investoredge_score;
  const details = report.scores_snapshot?.investoredge_details;

  if (score === null || score === undefined) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on-surface mb-4">Investment Analysis</h3>
        <div className="flex items-center justify-center gap-2 py-8 text-on-surface-variant">
          <AlertTriangle className="w-5 h-5" />
          <p>Score not available for this location</p>
        </div>
      </div>
    );
  }

  const metrics: MetricDisplay[] = [
    { label: 'Cash Flow', value: details?.cash_flow ?? 0, icon: DollarSign },
    { label: 'Appreciation', value: details?.appreciation ?? 0, icon: TrendingUp },
    { label: 'Risk', value: details?.risk ?? 0, icon: Shield },
    { label: 'Liquidity', value: details?.liquidity ?? 0, icon: Clock },
  ];

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-2">Investment Analysis</h3>
      <p className="text-on-surface-variant mb-4">{getRecommendation(score)}</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="text-center">
              <Icon className={`w-6 h-6 mx-auto mb-1 ${getValueColor(metric.value)}`} />
              <p className="text-sm text-on-surface-variant">{metric.label}</p>
              <p className="text-lg font-semibold text-on-surface">{metric.value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
