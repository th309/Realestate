'use client';

import React from 'react';
import { SectionProps } from '../types';
import { Trophy, TrendingUp, DollarSign, Home, Briefcase, AlertTriangle } from 'lucide-react';

interface CategoryWinner {
  id: string;
  label: string;
  icon: typeof DollarSign;
  winner: string | null;
}

export function WinnerBadges({ section, report }: SectionProps) {
  const comparables = report.populated_data?.comparables;
  const hasComparisonData = comparables && comparables.length > 0;

  // Get category winners from comparison data or score details
  const scoreDetails = report.user_type === 'investor'
    ? report.scores_snapshot?.investoredge_details
    : report.scores_snapshot?.homeready_details;

  function getCategoryWinner(categoryId: string): string | null {
    if (!hasComparisonData) return null;

    // Map category to relevant metric for comparison
    const categoryMetrics: Record<string, string> = {
      affordability: 'affordability_score',
      appreciation: 'appreciation_score',
      cash_flow: 'cash_flow_score',
      stability: 'stability_score',
    };

    const metricKey = categoryMetrics[categoryId];
    if (!metricKey) return null;

    // Find the geography with highest score for this category
    // Use type assertion to access dynamic property
    const detailsObj = scoreDetails as Record<string, number | undefined> | undefined;
    const primaryScore = detailsObj?.[metricKey];
    let bestGeo = report.primary_geography_name;
    let bestScore = primaryScore ?? 0;

    for (const comp of comparables || []) {
      const compScore = comp.metrics?.[metricKey] as number | undefined;
      if (compScore !== undefined && compScore > bestScore) {
        bestScore = compScore;
        bestGeo = comp.geography.name;
      }
    }

    return bestGeo;
  }

  const categories: CategoryWinner[] = [
    { id: 'affordability', label: 'Affordability', icon: DollarSign, winner: getCategoryWinner('affordability') },
    { id: 'appreciation', label: 'Appreciation', icon: TrendingUp, winner: getCategoryWinner('appreciation') },
    { id: 'cash_flow', label: 'Cash Flow', icon: Briefcase, winner: getCategoryWinner('cash_flow') },
    { id: 'stability', label: 'Stability', icon: Home, winner: getCategoryWinner('stability') },
  ];

  const hasAnyWinners = categories.some(cat => cat.winner !== null);

  if (!hasAnyWinners) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          Category Winners
        </h3>
        <div className="flex items-center justify-center gap-2 py-8 text-on-surface-variant">
          <AlertTriangle className="w-5 h-5" />
          <span>Comparison data not available</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
        <Trophy className="w-5 h-5 text-amber-500" />
        Category Winners
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <div key={cat.id} className="bg-surface rounded-xl p-4 text-center">
              <Icon className="w-6 h-6 mx-auto mb-2 text-primary" />
              <p className="text-sm text-on-surface-variant mb-1">{cat.label}</p>
              <p className="font-semibold text-on-surface text-sm truncate">
                {cat.winner ?? '--'}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
