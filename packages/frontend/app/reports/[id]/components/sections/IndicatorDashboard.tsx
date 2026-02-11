'use client';

import React from 'react';
import { SectionProps } from '../types';
import { formatMetricValue, getMetricFormat } from '@/lib/data';
import { Activity, AlertTriangle } from 'lucide-react';

export function IndicatorDashboard({ section, report }: SectionProps): React.ReactElement {
  const indicators = section.config?.indicators || [
    'hotness_score', 'days_on_market', 'inventory_yoy', 'price_reduced_share'
  ];

  const getIndicatorConfig = (id: string): { label: string; goodDirection: 'up' | 'down' | 'neutral' } => {
    const configs: Record<string, { label: string; goodDirection: 'up' | 'down' | 'neutral' }> = {
      hotness_score: { label: 'Market Heat', goodDirection: 'up' },
      days_on_market: { label: 'Days on Market', goodDirection: 'down' },
      inventory_yoy: { label: 'Inventory Change', goodDirection: 'neutral' },
      price_reduced_share: { label: 'Price Cuts', goodDirection: 'down' },
      sale_to_list_ratio: { label: 'Sale/List Ratio', goodDirection: 'up' },
      pending_ratio: { label: 'Pending Ratio', goodDirection: 'up' },
    };
    return configs[id] || {
      label: id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      goodDirection: 'neutral'
    };
  };

  // Check if we have any data
  const indicatorsWithData = indicators.filter((id: string) => {
    const value = report.populated_data?.current?.[id];
    return value !== null && value !== undefined;
  });

  if (indicatorsWithData.length === 0) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Market Indicators
        </h3>
        <div className="flex items-center justify-center gap-2 text-on-surface-variant py-8">
          <AlertTriangle className="w-5 h-5" />
          <span>Market indicator data not available</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
        <Activity className="w-5 h-5 text-primary" />
        Market Indicators
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {indicators.map((indicatorId: string) => {
          const value = report.populated_data?.current?.[indicatorId];
          const config = getIndicatorConfig(indicatorId);
          const format = getMetricFormat(indicatorId);

          // Determine status based on value ranges
          const getStatus = (): 'hot' | 'warm' | 'cold' | 'neutral' => {
            if (value === null || value === undefined) return 'neutral';
            if (indicatorId === 'hotness_score') {
              if (value > 70) return 'hot';
              if (value > 40) return 'warm';
              return 'cold';
            }
            if (indicatorId === 'days_on_market') {
              if (value < 30) return 'hot';
              if (value < 60) return 'warm';
              return 'cold';
            }
            return 'neutral';
          };

          const status = getStatus();
          const statusColors = {
            hot: 'bg-red-100 text-red-700',
            warm: 'bg-yellow-100 text-yellow-700',
            cold: 'bg-blue-100 text-blue-700',
            neutral: 'bg-gray-100 text-gray-700',
          };

          return (
            <div key={indicatorId} className="bg-surface rounded-xl p-4">
              <p className="text-sm text-on-surface-variant mb-1">{config.label}</p>
              <p className="text-2xl font-bold text-on-surface mb-2">
                {value !== null && value !== undefined
                  ? formatMetricValue(value, format)
                  : '—'}
              </p>
              <span className={`text-xs px-2 py-1 rounded-full ${statusColors[status]}`}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
