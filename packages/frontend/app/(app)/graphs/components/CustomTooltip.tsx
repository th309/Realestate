'use client';

import React from 'react';
import { History } from 'lucide-react';
import { MILESTONES } from '../constants';

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color?: string;
  fill?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string | number;
}

export const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const dateLabel = typeof label === 'string' ? label : '';
  const year = dateLabel ? new Date(dateLabel).getFullYear() : (typeof label === 'number' ? label : 0);
  const milestone = MILESTONES.find((m) => m.year === year);

  return (
    <div className="bg-surface-container-high p-3 md:p-4 border border-outline-variant elevation-2 rounded-2xl md:rounded-3xl min-w-[200px] md:min-w-[240px] animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between mb-2 md:mb-3 pb-2 border-b border-outline-variant">
        <p className="text-[9px] md:text-[10px] font-medium text-on-surface-variant uppercase tracking-[0.2em]">
          {`Period: ${dateLabel || label}`}
        </p>
      </div>

      <div className="space-y-2 md:space-y-3">
        {payload.map((entry, index) => (
          <div key={index} className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full shadow-sm"
                  style={{
                    backgroundColor: entry.color || entry.fill,
                    border: '2px solid white',
                  }}
                />
                <span className="text-[10px] md:text-xs font-medium text-on-surface truncate max-w-[100px] md:max-w-none">
                  {entry.name}
                </span>
              </div>
              <span className="text-xs md:text-sm font-medium text-on-surface">
                {entry.value.toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {milestone && (
        <div className="mt-3 md:mt-4 p-2 md:p-3 bg-tertiary-container border border-tertiary-container rounded-xl md:rounded-2xl">
          <div className="flex items-center gap-2 text-on-tertiary-container mb-1">
            <History className="w-2.5 h-2.5 md:w-3 md:h-3" />
            <span className="text-[9px] md:text-[10px] font-medium uppercase tracking-tight">
              Market Milestone
            </span>
          </div>
          <p className="text-[10px] md:text-[11px] font-medium text-on-tertiary-container leading-tight">
            {milestone.label}
          </p>
        </div>
      )}
    </div>
  );
};
