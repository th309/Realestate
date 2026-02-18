'use client';

import React, { useEffect } from 'react';
import { Lock, ChevronRight } from 'lucide-react';
import { useEntitlements } from '@/lib/entitlements';
import Link from 'next/link';

type ScoreType = 'homeready' | 'investoredge' | 'markethealth';

interface ScoreBreakdownGateProps {
  scoreType: ScoreType;
  componentCount?: number;
  className?: string;
}

const SCORE_LABELS: Record<ScoreType, string> = {
  homeready: 'HomeReady',
  investoredge: 'InvestorEdge',
  markethealth: 'Market Health',
};

const SCORE_DESCRIPTIONS: Record<ScoreType, string> = {
  homeready: 'See what drives this score — affordability, market timing, and livability factors.',
  investoredge: 'See what drives this score — cash flow potential, appreciation trends, and risk analysis.',
  markethealth: 'See the full breakdown of supply, demand, and pricing dynamics.',
};

export function ScoreBreakdownGate({
  scoreType,
  componentCount = 5,
  className = '',
}: ScoreBreakdownGateProps) {
  const { trackPaywallView, trackUpgradeClick } = useEntitlements();

  useEffect(() => {
    trackPaywallView('feature', `score_breakdown_${scoreType}`);
  }, [scoreType, trackPaywallView]);

  return (
    <div
      className={`
        bg-surface-container-low rounded-xl border border-outline-variant p-5
        ${className}
      `}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Lock className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-on-surface">
            {SCORE_LABELS[scoreType]} Breakdown
          </h4>
          <p className="text-xs text-on-surface-variant mt-0.5">
            This score is driven by {componentCount} factors
          </p>
        </div>
      </div>

      {/* Teaser placeholder bars */}
      <div className="mt-4 space-y-2">
        {Array.from({ length: Math.min(componentCount, 4) }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-surface-container-highest" />
            <div className="w-8 h-2 rounded-full bg-surface-container-highest" />
          </div>
        ))}
      </div>

      <p className="text-sm text-on-surface-variant mt-4">
        {SCORE_DESCRIPTIONS[scoreType]}
      </p>

      <Link
        href="/pricing"
        onClick={() => trackUpgradeClick('feature', `score_breakdown_${scoreType}`)}
        className="
          mt-3 inline-flex items-center gap-1
          text-sm font-medium text-primary
          hover:text-primary/80 transition-colors
        "
      >
        Unlock with Pro
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
