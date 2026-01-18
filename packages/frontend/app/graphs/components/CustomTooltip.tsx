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

  const milestone = MILESTONES.find((m) => m.year === label);

  return (
    <div className="bg-[#f7faf7] p-3 md:p-4 border border-[#dee5dd] shadow-[0_12px_32px_rgba(0,0,0,0.15)] rounded-[20px] md:rounded-[24px] min-w-[200px] md:min-w-[240px] animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between mb-2 md:mb-3 pb-2 border-b border-[#dee5dd]">
        <p className="text-[9px] md:text-[10px] font-black text-[#414941] uppercase tracking-[0.2em]">
          {`Period: ${label}`}
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
                <span className="text-[10px] md:text-xs font-bold text-[#1a1c1a] truncate max-w-[100px] md:max-w-none">
                  {entry.name}
                </span>
              </div>
              <span className="text-xs md:text-sm font-black text-[#1a1c1a]">
                {entry.value.toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {milestone && (
        <div className="mt-3 md:mt-4 p-2 md:p-3 bg-amber-50 border border-amber-100 rounded-lg md:rounded-xl">
          <div className="flex items-center gap-2 text-amber-800 mb-1">
            <History className="w-2.5 h-2.5 md:w-3 md:h-3" />
            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-tighter">
              Market Milestone
            </span>
          </div>
          <p className="text-[10px] md:text-[11px] font-bold text-amber-900 leading-tight">
            {milestone.label}
          </p>
        </div>
      )}
    </div>
  );
};
