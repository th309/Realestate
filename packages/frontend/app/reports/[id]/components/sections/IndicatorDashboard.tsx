'use client';

import React from 'react';
import { SectionProps } from '../types';
import { formatMetricValue } from '@/lib/data';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';

export function IndicatorDashboard({ section, report }: SectionProps) {
  const indicators = section.config?.indicators || [
    'hotness_score', 'days_on_market', 'inventory_yoy', 'price_reduced_share'
  ];

  const getIndicatorConfig = (id: string) => {
    const configs: Record<string, { label: string; goodDirection: 'up' | 'down' | 'neutral' }> = {
      hotness_score: { label: 'Market Heat', goodDirection: 'up' },
      days_on_market: { label: 'Days on Market', goodDirection: 'down' },
      inventory_yoy: { label: 'Inventory Change', goodDirection: 'neutral' },
      price_reduced_share: { label: 'Price Cuts', goodDirection: 'down' },
      sale_to_list_ratio: { label: 'Sale/List Ratio', goodDirection: 'up' },
      pending_ratio: { label: 'Pending Ratio', goodDirection: 'up' },
    };
    return configs[id] || { label: id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), goodDirection: 'neutral' };
  };

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

          // Determine status based on value ranges (simplified)
          const getStatus = () => {
            if (value == null) return 'neutral';
            if (indicatorId === 'hotness_score') return value > 70 ? 'hot' : value > 40 ? 'warm' : 'cold';
            if (indicatorId === 'days_on_market') return value < 30 ? 'hot' : value < 60 ? 'warm' : 'cold';
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
                {value != null ? formatMetricValue(indicatorId, value) : '--'}
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
