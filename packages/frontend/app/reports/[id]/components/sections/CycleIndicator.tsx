'use client';

import React from 'react';
import { SectionProps } from '../types';
import { TrendingUp, TrendingDown, Activity, AlertTriangle } from 'lucide-react';

interface CyclePhase {
  id: string;
  label: string;
  color: string;
  icon: typeof TrendingUp;
  description: string;
}

const CYCLE_PHASES: CyclePhase[] = [
  { id: 'early_recovery', label: 'Early Recovery', color: 'bg-green-500', icon: TrendingUp, description: 'Market bottoming, opportunities emerging' },
  { id: 'expansion', label: 'Expansion', color: 'bg-blue-500', icon: TrendingUp, description: 'Strong growth, high demand' },
  { id: 'hyper_supply', label: 'Hyper Supply', color: 'bg-yellow-500', icon: AlertTriangle, description: 'Oversupply building, slowing growth' },
  { id: 'recession', label: 'Recession', color: 'bg-red-500', icon: TrendingDown, description: 'Declining values, buyer\'s market' },
];

export function CycleIndicator({ section, report }: SectionProps): React.ReactElement {
  const cycleData = report.populated_data?.cycle;
  const currentPhase = cycleData?.position;

  // Check if cycle data is available
  if (!currentPhase) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Market Cycle Position
        </h3>
        <div className="flex items-center justify-center gap-2 text-on-surface-variant py-8">
          <AlertTriangle className="w-5 h-5" />
          <span>Market cycle data not available</span>
        </div>
      </div>
    );
  }

  const currentIndex = CYCLE_PHASES.findIndex(p => p.id === currentPhase);
  const phase = currentIndex >= 0 ? CYCLE_PHASES[currentIndex] : null;

  if (!phase) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Market Cycle Position
        </h3>
        <div className="flex items-center justify-center gap-2 text-on-surface-variant py-8">
          <AlertTriangle className="w-5 h-5" />
          <span>Unknown market cycle phase: {currentPhase}</span>
        </div>
      </div>
    );
  }

  const Icon = phase.icon;

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
        <Activity className="w-5 h-5 text-primary" />
        Market Cycle Position
      </h3>

      {/* Current Phase */}
      <div className={`p-4 rounded-xl mb-6 ${phase.color}/20`}>
        <div className="flex items-center justify-center gap-3">
          <Icon className={`w-8 h-8 ${phase.color.replace('bg-', 'text-')}`} />
          <div>
            <p className="text-xl font-bold text-on-surface">{phase.label}</p>
            <p className="text-sm text-on-surface-variant">{phase.description}</p>
          </div>
        </div>
      </div>

      {/* Cycle Visualization */}
      <div className="flex justify-between items-center">
        {CYCLE_PHASES.map((p, index) => (
          <div key={p.id} className="flex-1 relative">
            <div className={`h-2 ${p.color} ${index === 0 ? 'rounded-l-full' : ''} ${index === CYCLE_PHASES.length - 1 ? 'rounded-r-full' : ''}`} />
            {p.id === currentPhase && (
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-on-surface rounded-full shadow" />
            )}
            <p className="text-xs text-on-surface-variant text-center mt-2">{p.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
