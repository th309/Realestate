'use client';

import React, { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, Briefcase, Clock, Heart, Users, Shield } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MyMarket } from '../../hooks/useMyMarkets';
import { TemplateType } from '../../hooks/useGraphsState';

interface PriorityBreakdownProps {
  primaryMarket: MyMarket;
  comparisonMarket: MyMarket;
  template: TemplateType;
  userType: 'homebuyer' | 'investor';
}

interface PriorityResult {
  id: string;
  label: string;
  icon: LucideIcon;
  winnerId: string;
  winnerName: string;
  metric: string;
  primaryValue: number | null;
  comparisonValue: number | null;
  detail: string;
}

/**
 * PriorityBreakdown - Shows why the winner won based on template priorities
 */
export function PriorityBreakdown({
  primaryMarket,
  comparisonMarket,
  template,
  userType,
}: PriorityBreakdownProps) {
  const [priorities, setPriorities] = useState<PriorityResult[]>([]);
  const [loading, setLoading] = useState(true);

  // Get winner from scores
  const primaryScore = primaryMarket.score ?? 0;
  const comparisonScore = comparisonMarket.score ?? 0;
  const winnerId = primaryScore >= comparisonScore ? primaryMarket.id : comparisonMarket.id;
  const winnerName = primaryScore >= comparisonScore ? primaryMarket.name : comparisonMarket.name;

  useEffect(() => {
    // Simulate fetching priority data based on template
    // In production, this would call the API to get actual metric comparisons
    async function loadPriorities() {
      setLoading(true);

      // Get priorities for this template
      const templatePriorities = TEMPLATE_PRIORITIES[template];

      // Simulate metric comparison results
      const results: PriorityResult[] = templatePriorities.map((p, index) => {
        // Simulate which market wins each priority
        // In production, this comes from actual metric data
        const primaryWins = Math.random() > 0.3 || index === 0; // Primary usually wins first priority for demo

        return {
          ...p,
          winnerId: primaryWins ? primaryMarket.id : comparisonMarket.id,
          winnerName: primaryWins ? primaryMarket.name : comparisonMarket.name,
          primaryValue: Math.round(Math.random() * 10 + 2),
          comparisonValue: Math.round(Math.random() * 10 + 2),
          detail: p.detailTemplate
            .replace('{primaryValue}', (Math.random() * 5 + 3).toFixed(1))
            .replace('{comparisonValue}', (Math.random() * 5 + 4).toFixed(1)),
        };
      });

      setPriorities(results);
      setLoading(false);
    }

    loadPriorities();
  }, [primaryMarket.id, comparisonMarket.id, template]);

  if (loading) {
    return (
      <div className="bg-surface-container rounded-2xl p-6 mb-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-surface-container-high rounded w-48" />
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-surface-container-high rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-container rounded-2xl p-6 mb-6">
      <h3 className="text-base font-medium text-on-surface mb-4">
        Why {winnerName} Wins For You
      </h3>

      <div className="space-y-3">
        {priorities.map((priority, index) => {
          const Icon = priority.icon;
          const isOverallWinner = priority.winnerId === winnerId;

          return (
            <div
              key={priority.id}
              className="flex items-center gap-4 p-4 bg-surface-container-lowest rounded-xl"
            >
              {/* Priority Number */}
              <div
                className={`
                  w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0
                  ${isOverallWinner
                    ? 'bg-primary text-on-primary'
                    : 'bg-tertiary text-on-tertiary'
                  }
                `}
              >
                {index + 1}
              </div>

              {/* Icon */}
              <div
                className={`
                  p-2 rounded-lg shrink-0
                  ${isOverallWinner
                    ? 'bg-primary-container text-on-primary-container'
                    : 'bg-tertiary-container text-on-tertiary-container'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${isOverallWinner ? 'text-primary' : 'text-tertiary'}`}>
                  {isOverallWinner ? `Better ${priority.label}` : `${priority.winnerName} Edges on ${priority.label}`}
                </p>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {priority.detail}
                </p>
              </div>

              {/* Winner Chip */}
              <span
                className={`
                  text-xs font-medium px-3 py-1 rounded-full shrink-0
                  ${isOverallWinner
                    ? 'bg-primary-container text-on-primary-container'
                    : 'bg-tertiary-container text-on-tertiary-container'
                  }
                `}
              >
                {priority.winnerName.split(',')[0]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Template priority configurations
interface TemplatePriority {
  id: string;
  label: string;
  icon: LucideIcon;
  metric: string;
  detailTemplate: string;
}

const TEMPLATE_PRIORITIES: Record<TemplateType, TemplatePriority[]> = {
  affordability: [
    { id: 'affordability', label: 'Affordability', icon: DollarSign, metric: 'affordability_ratio', detailTemplate: 'Price-to-income ratio {primaryValue} vs {comparisonValue}' },
    { id: 'appreciation', label: 'Appreciation', icon: TrendingUp, metric: 'zhvi_5y_cagr', detailTemplate: '5-year CAGR {primaryValue}% vs {comparisonValue}%' },
    { id: 'job_market', label: 'Job Market', icon: Briefcase, metric: 'job_growth_yoy', detailTemplate: 'Employment growth {primaryValue}% vs {comparisonValue}%' },
  ],
  investment: [
    { id: 'cash_flow', label: 'Cash Flow', icon: DollarSign, metric: 'rent_to_price_ratio', detailTemplate: 'Rent yield {primaryValue}% vs {comparisonValue}%' },
    { id: 'appreciation', label: 'Appreciation', icon: TrendingUp, metric: 'zhvi_5y_cagr', detailTemplate: '5-year CAGR {primaryValue}% vs {comparisonValue}%' },
    { id: 'tenant_demand', label: 'Tenant Demand', icon: Users, metric: 'zordi', detailTemplate: 'Rental demand index {primaryValue} vs {comparisonValue}' },
  ],
  momentum: [
    { id: 'market_timing', label: 'Market Timing', icon: Clock, metric: 'days_to_pending', detailTemplate: 'Days on market {primaryValue} vs {comparisonValue}' },
    { id: 'inventory', label: 'Inventory', icon: TrendingUp, metric: 'inventory_yoy', detailTemplate: 'Inventory change {primaryValue}% vs {comparisonValue}%' },
    { id: 'price_growth', label: 'Price Growth', icon: DollarSign, metric: 'zhvi_yoy', detailTemplate: '1-year growth {primaryValue}% vs {comparisonValue}%' },
  ],
  cashflow: [
    { id: 'yield', label: 'Rent Yield', icon: DollarSign, metric: 'rent_to_price_ratio', detailTemplate: 'Gross yield {primaryValue}% vs {comparisonValue}%' },
    { id: 'entry_price', label: 'Entry Price', icon: DollarSign, metric: 'zhvi', detailTemplate: 'Median price ${primaryValue}K vs ${comparisonValue}K' },
    { id: 'stability', label: 'Stability', icon: Shield, metric: 'volatility', detailTemplate: 'Price volatility {primaryValue}% vs {comparisonValue}%' },
  ],
  custom: [
    { id: 'overall', label: 'Overall Score', icon: TrendingUp, metric: 'homeready_score', detailTemplate: 'Score {primaryValue} vs {comparisonValue}' },
    { id: 'affordability', label: 'Affordability', icon: DollarSign, metric: 'affordability_ratio', detailTemplate: 'Affordability index {primaryValue} vs {comparisonValue}' },
    { id: 'growth', label: 'Growth', icon: TrendingUp, metric: 'zhvi_yoy', detailTemplate: 'YoY growth {primaryValue}% vs {comparisonValue}%' },
  ],
};

export default PriorityBreakdown;
