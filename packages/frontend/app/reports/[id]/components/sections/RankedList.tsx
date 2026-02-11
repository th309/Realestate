'use client';

import React from 'react';
import { SectionProps } from '../types';
import { formatMetricValue } from '@/lib/data';
import { Medal, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export function RankedList({ section, report }: SectionProps) {
  const title = section.config?.title || 'Rankings';
  const items = section.config?.items || [];
  const metric = section.config?.metric;
  const showRank = section.config?.show_rank !== false;
  const showTrend = section.config?.show_trend !== false;

  // If no items provided, try to build from comparables
  let displayItems = items;
  if (displayItems.length === 0 && report.populated_data?.comparables && metric) {
    displayItems = report.populated_data.comparables
      .map(c => ({
        name: c.geography.name,
        value: c.metrics?.[metric],
        trend: c.metrics?.[`${metric}_yoy`],
      }))
      .filter(i => i.value != null)
      .sort((a, b) => (b.value as number) - (a.value as number));
  }

  const getMedalColor = (rank: number) => {
    if (rank === 1) return 'text-amber-500';
    if (rank === 2) return 'text-gray-400';
    if (rank === 3) return 'text-amber-700';
    return 'text-on-surface-variant';
  };

  const TrendIcon = ({ trend }: { trend?: number }) => {
    if (!trend) return <Minus className="w-4 h-4 text-gray-400" />;
    if (trend > 0) return <TrendingUp className="w-4 h-4 text-green-600" />;
    return <TrendingDown className="w-4 h-4 text-red-600" />;
  };

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4">{title}</h3>

      <div className="space-y-2">
        {displayItems.map((item: any, index: number) => (
          <div key={item.name || index} className="flex items-center gap-3 p-3 bg-surface rounded-xl">
            {showRank && (
              <div className="w-8 text-center">
                {index < 3 ? (
                  <Medal className={`w-5 h-5 mx-auto ${getMedalColor(index + 1)}`} />
                ) : (
                  <span className="text-on-surface-variant font-medium">{index + 1}</span>
                )}
              </div>
            )}
            <div className="flex-1">
              <span className="font-medium text-on-surface">{item.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-on-surface">
                {formatMetricValue(metric, item.value)}
              </span>
              {showTrend && <TrendIcon trend={item.trend} />}
            </div>
          </div>
        ))}
      </div>

      {displayItems.length === 0 && (
        <p className="text-on-surface-variant text-center py-4">No ranking data available</p>
      )}
    </div>
  );
}
