'use client';

import React from 'react';
import {
  Trophy,
  DollarSign,
  TrendingUp,
  Briefcase,
  Clock,
  Heart,
  BarChart3,
  Users,
  Shield,
  type LucideIcon
} from 'lucide-react';
import { SectionProps } from '../../types';
import { SectionCard } from '../core/SectionCard';

interface PriorityResult {
  priority: string;
  weight: number;
  winnerId: string;
  winnerName: string;
  keyMetric: string;
  winnerValue: number | null;
  loserValue: number | null;
  reason: string;
}

const PRIORITY_ICONS: Record<string, LucideIcon> = {
  affordability: DollarSign,
  appreciation: TrendingUp,
  job_market: Briefcase,
  market_timing: Clock,
  lifestyle: Heart,
  cash_flow: TrendingUp,
  tenant_demand: Users,
  entry_price: DollarSign,
  stability: Shield,
};

const PRIORITY_LABELS: Record<string, string> = {
  affordability: 'Affordability',
  appreciation: 'Appreciation',
  job_market: 'Job Market',
  market_timing: 'Market Timing',
  lifestyle: 'Lifestyle',
  cash_flow: 'Cash Flow',
  tenant_demand: 'Tenant Demand',
  entry_price: 'Entry Price',
  stability: 'Stability',
};

/**
 * WhyWinnerWon - Shows 3 reasons why the winner won based on user priorities
 *
 * Part 1B of the redesigned comparison report.
 * Displays priority-by-priority breakdown with real metric comparisons.
 */
export function WhyWinnerWon({ section, report }: SectionProps) {
  const priorities = report.user_inputs?.priorities as string[] || [];

  // Get priority results from backend
  const priorityWeightedWinner = report.populated_data?.priority_weighted_winner as {
    winnerId: string;
    winnerName: string;
    totalScore: number;
    priorityScores: PriorityResult[];
  } | undefined;

  const priorityScores = priorityWeightedWinner?.priorityScores || [];
  const overallWinnerName = priorityWeightedWinner?.winnerName;

  if (priorities.length === 0 || priorityScores.length === 0) {
    return (
      <SectionCard title="Why The Winner Won" icon={Trophy}>
        <p className="text-on-surface-variant text-center py-8">
          Select your priorities to see why one market wins for you.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title={`Why ${overallWinnerName || 'The Winner'} Wins For You`} icon={Trophy}>
      <div className="space-y-4">
        {priorityScores.slice(0, 3).map((result, index) => {
          const Icon = PRIORITY_ICONS[result.priority] || TrendingUp;
          const label = PRIORITY_LABELS[result.priority] || result.priority;
          const isOverallWinner = result.winnerName === overallWinnerName;

          return (
            <div
              key={result.priority}
              className={`
                p-5 rounded-xl border transition-all
                ${isOverallWinner
                  ? 'bg-primary/5 border-primary/20'
                  : 'bg-surface-container border-outline-variant'
                }
              `}
            >
              <div className="flex items-start gap-4">
                {/* Priority Number */}
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center shrink-0
                  ${isOverallWinner
                    ? 'bg-primary text-on-primary'
                    : 'bg-tertiary text-on-tertiary'
                  }
                  text-sm font-bold
                `}>
                  {index + 1}
                </div>

                {/* Icon */}
                <div className={`
                  p-2 rounded-lg shrink-0
                  ${isOverallWinner
                    ? 'bg-primary/10 text-primary'
                    : 'bg-tertiary/10 text-tertiary'
                  }
                `}>
                  <Icon className="w-5 h-5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={`font-semibold ${isOverallWinner ? 'text-primary' : 'text-tertiary'}`}>
                      {isOverallWinner ? `Better ${label}` : `${result.winnerName} Edges on ${label}`}
                    </h4>
                    <span className="text-xs text-on-surface-variant">
                      (Your #{index + 1} Priority)
                    </span>
                  </div>

                  <p className="text-sm text-on-surface leading-relaxed">
                    {result.reason || generateFallbackReason(result, label)}
                  </p>

                  {/* Metric Comparison Mini-Chart */}
                  {result.winnerValue !== null && result.loserValue !== null && (
                    <div className="mt-3 flex items-center gap-4 text-xs">
                      <div className={`flex items-center gap-1 ${isOverallWinner ? 'text-primary font-semibold' : 'text-on-surface-variant'}`}>
                        <span className="w-2 h-2 rounded-full bg-current" />
                        {result.winnerName}: {formatMetricValue(result.winnerValue, result.keyMetric)}
                      </div>
                      <div className="text-on-surface-variant">
                        vs {formatMetricValue(result.loserValue, result.keyMetric)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Note */}
      <div className="mt-6 p-4 bg-surface-container-high rounded-lg">
        <p className="text-sm text-on-surface-variant text-center">
          Winner determined by weighted scoring: 1st priority = 3 pts, 2nd = 2 pts, 3rd = 1 pt
        </p>
      </div>
    </SectionCard>
  );
}

function generateFallbackReason(result: PriorityResult, label: string): string {
  if (result.winnerValue === null || result.loserValue === null) {
    return `${result.winnerName} performs better on ${label.toLowerCase()} metrics.`;
  }

  const diff = result.winnerValue - result.loserValue;
  const pctDiff = result.loserValue !== 0 ? Math.abs((diff / result.loserValue) * 100) : 0;

  return `${result.winnerName} scores ${pctDiff.toFixed(0)}% ${diff > 0 ? 'higher' : 'better'} on key ${label.toLowerCase()} metrics.`;
}

function formatMetricValue(value: number, metricKey: string): string {
  // Format based on metric type
  const currencyMetrics = ['median_home_price', 'median_rent', 'median_income'];
  const percentMetrics = ['appreciation', 'cap_rate', 'yield', 'growth'];
  const indexMetrics = ['affordability_index', 'score'];

  if (currencyMetrics.some(m => metricKey.includes(m))) {
    return value >= 1000
      ? `$${(value / 1000).toFixed(0)}K`
      : `$${value.toFixed(0)}`;
  }

  if (percentMetrics.some(m => metricKey.includes(m))) {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  }

  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }

  return value.toFixed(1);
}

export default WhyWinnerWon;
