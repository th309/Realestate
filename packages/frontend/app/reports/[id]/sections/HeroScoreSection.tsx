'use client';

import React from 'react';
import { UserType } from '../../types';
import { Home, TrendingUp, DollarSign, Users, Shield, Wallet, BarChart3, Droplets } from 'lucide-react';

interface ScoreDetails {
  affordability?: number;
  stability?: number;
  value?: number;
  competition?: number;
  cash_flow?: number;
  appreciation?: number;
  risk?: number;
  liquidity?: number;
}

interface HeroScoreSectionProps {
  score: number;
  scoreType: 'HomeReady' | 'InvestorEdge';
  userType: UserType;
  details?: ScoreDetails;
  narrative?: string;
}

const HOMEREADY_COMPONENTS = [
  { key: 'affordability', label: 'Affordability', icon: DollarSign, description: 'Price-to-income ratio and mortgage burden' },
  { key: 'stability', label: 'Market Stability', icon: Shield, description: 'Price volatility and market risk' },
  { key: 'value', label: 'Value', icon: Home, description: 'Price relative to fundamentals' },
  { key: 'competition', label: 'Competition', icon: Users, description: 'Days on market and buyer competition' },
];

const INVESTOREDGE_COMPONENTS = [
  { key: 'cash_flow', label: 'Cash Flow', icon: Wallet, description: 'Rent-to-price ratio and yield potential' },
  { key: 'appreciation', label: 'Appreciation', icon: TrendingUp, description: 'Historical and projected growth' },
  { key: 'risk', label: 'Risk', icon: Shield, description: 'Volatility and market stability' },
  { key: 'liquidity', label: 'Liquidity', icon: Droplets, description: 'Days on market and exit potential' },
];

function ScoreBar({ value, label, icon: Icon, description }: {
  value: number;
  label: string;
  icon: React.ElementType;
  description: string;
}) {
  const getColor = (v: number) => {
    if (v >= 75) return 'bg-green-500';
    if (v >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-on-surface-variant" />
          <span className="font-medium text-on-surface">{label}</span>
        </div>
        <span className="text-on-surface-variant">{value}/100</span>
      </div>
      <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getColor(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <p className="text-xs text-on-surface-variant">{description}</p>
    </div>
  );
}

export function HeroScoreSection({
  score,
  scoreType,
  userType,
  details,
  narrative,
}: HeroScoreSectionProps) {
  const components = scoreType === 'InvestorEdge' ? INVESTOREDGE_COMPONENTS : HOMEREADY_COMPONENTS;

  const getScoreInterpretation = (s: number, type: 'HomeReady' | 'InvestorEdge') => {
    if (type === 'HomeReady') {
      if (s >= 80) return 'Excellent conditions for homebuyers. Strong affordability and favorable competition.';
      if (s >= 70) return 'Good market conditions. Buyers have reasonable options and negotiating power.';
      if (s >= 60) return 'Fair conditions. Some challenges but opportunities exist for patient buyers.';
      if (s >= 50) return 'Moderate market. Careful research and timing important for buyers.';
      return 'Challenging market for buyers. Consider waiting or expanding your search area.';
    } else {
      if (s >= 80) return 'Excellent investment potential. Strong cash flow and appreciation prospects.';
      if (s >= 70) return 'Good investment market. Solid fundamentals with manageable risk.';
      if (s >= 60) return 'Fair investment conditions. Requires careful deal analysis.';
      if (s >= 50) return 'Moderate opportunity. Focus on value-add strategies.';
      return 'Challenging investment market. High barrier to positive cash flow.';
    }
  };

  return (
    <section className="bg-surface-container rounded-3xl p-6 md:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-primary/10">
          <BarChart3 className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-on-surface">Score Breakdown</h2>
      </div>

      {/* Score Interpretation */}
      <div className="bg-surface rounded-2xl p-4 mb-6">
        <p className="text-on-surface leading-relaxed">
          {getScoreInterpretation(score, scoreType)}
        </p>
      </div>

      {/* Component Bars */}
      {details && (
        <div className="space-y-6">
          {components.map((comp) => {
            const value = details[comp.key as keyof ScoreDetails];
            if (value === undefined) return null;
            return (
              <ScoreBar
                key={comp.key}
                value={value}
                label={comp.label}
                icon={comp.icon}
                description={comp.description}
              />
            );
          })}
        </div>
      )}

      {/* AI Narrative */}
      {narrative && (
        <div className="mt-6 pt-6 border-t border-outline-variant">
          <h3 className="text-sm font-medium text-on-surface mb-2">AI Analysis</h3>
          <p className="text-sm text-on-surface-variant leading-relaxed">{narrative}</p>
        </div>
      )}
    </section>
  );
}
