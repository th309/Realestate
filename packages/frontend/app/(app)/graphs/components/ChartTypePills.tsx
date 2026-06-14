'use client';

import React from 'react';
import { TrendingUp, ScatterChart, BarChart3, Radar, AlignLeft } from 'lucide-react';
import type { ChartType } from '../hooks/useGraphsState';

interface ChartTypePillsProps {
  activeType: ChartType;
  onChange: (type: ChartType) => void;
  /** Render as 2-col grid (sidebar) vs horizontal row (mobile) */
  vertical?: boolean;
}

const CHART_TYPES: { type: ChartType; icon: React.ElementType; label: string }[] = [
  { type: 'timeseries', icon: TrendingUp, label: 'Timeline' },
  { type: 'scatter', icon: ScatterChart, label: 'Scatter' },
  { type: 'waterfall', icon: BarChart3, label: 'Waterfall' },
  { type: 'radar', icon: Radar, label: 'Radar' },
  { type: 'bar', icon: AlignLeft, label: 'Rankings' },
];

export function ChartTypePills({ activeType, onChange, vertical = false }: ChartTypePillsProps) {
  if (vertical) {
    return (
      <div className="grid grid-cols-2 gap-1">
        {CHART_TYPES.map(({ type, icon: Icon, label }) => {
          const isActive = activeType === type;
          return (
            <button
              key={type}
              onClick={() => onChange(type)}
              className={`
                flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-lg text-[10px] font-medium
                transition-all duration-150
                ${isActive
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }
              `}
            >
              <Icon className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {CHART_TYPES.map(({ type, icon: Icon, label }) => {
        const isActive = activeType === type;
        return (
          <button
            key={type}
            onClick={() => onChange(type)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium
              transition-all duration-200
              ${isActive
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }
            `}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default ChartTypePills;
