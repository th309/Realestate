'use client';

import React from 'react';
import { SectionProps } from '../types';
import { Trophy, TrendingUp, DollarSign, Home, Briefcase } from 'lucide-react';

export function WinnerBadges({ section, report }: SectionProps) {
  const categories = [
    { id: 'affordability', label: 'Affordability', icon: DollarSign },
    { id: 'appreciation', label: 'Appreciation', icon: TrendingUp },
    { id: 'cash_flow', label: 'Cash Flow', icon: Briefcase },
    { id: 'stability', label: 'Stability', icon: Home },
  ];

  // For now, primary geography wins (would need comparison data)
  const winner = report.primary_geography_name;

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
              <p className="font-semibold text-on-surface text-sm truncate">{winner}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
