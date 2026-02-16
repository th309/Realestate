'use client';

/**
 * ScorePaywall - Custom paywall for PropertyIQ Scores
 *
 * Sells the predictive value of scores with concrete data points
 * about excess returns and market prediction accuracy.
 */

import React, { useEffect, useState } from 'react';
import { TrendingUp, Target, BarChart3, ArrowRight } from 'lucide-react';
import { useEntitlements } from '@/lib/entitlements';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface ScorePaywallProps {
  className?: string;
  /** Compact mode for inline/sidebar use */
  compact?: boolean;
}

const STATS = [
  {
    icon: TrendingUp,
    stat: '12%',
    label: 'Higher returns in markets scoring 80+',
  },
  {
    icon: Target,
    stat: '7 of 10',
    label: 'Top-performing markets predicted correctly',
  },
  {
    icon: BarChart3,
    stat: '3 Scores',
    label: 'HomeReady, InvestorEdge, Market Health',
  },
];

export function ScorePaywall({ className = '', compact = false }: ScorePaywallProps) {
  const { trackUpgradeClick, simulatedAuth } = useEntitlements();
  const [isAuthenticated, setIsAuthenticated] = useState(true);

  useEffect(() => {
    if (simulatedAuth !== null) {
      setIsAuthenticated(simulatedAuth);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      setIsAuthenticated(!!data.session);
    });
  }, [simulatedAuth]);

  const handleClick = () => {
    trackUpgradeClick('feature', 'scores');
  };

  if (compact) {
    return (
      <div className={`bg-surface-container rounded-xl p-4 border border-outline-variant ${className}`}>
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-on-surface">Predictive Scores</span>
        </div>
        <p className="text-xs text-on-surface-variant mb-3">
          Top-scoring markets outperform their regional benchmarks. Unlock scores that predict excess returns.
        </p>
        <Link
          href="/pricing#scores"
          onClick={handleClick}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Unlock Scores <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <Link
          href="/scores/methodology"
          className="inline-flex items-center gap-1 text-xs text-on-surface-variant hover:text-primary transition-colors mt-1"
        >
          See the proof behind our scores
        </Link>
      </div>
    );
  }

  return (
    <div className={`bg-surface-container rounded-2xl border border-outline-variant overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 to-tertiary/10 px-6 pt-6 pb-4">
        <div className="flex items-center gap-2 text-primary mb-2">
          <Target className="w-5 h-5" />
          <span className="text-xs font-semibold uppercase tracking-wider">PropertyIQ Scores</span>
        </div>
        <h3 className="text-xl font-medium text-on-surface mb-1">
          The Predictive Edge
        </h3>
        <p className="text-sm text-on-surface-variant">
          Go beyond raw data. Our proprietary scores predict market performance
          so you invest with confidence, not guesswork.
        </p>
      </div>

      {/* Stats */}
      <div className="px-6 py-5 space-y-4">
        {STATS.map(({ icon: Icon, stat, label }) => (
          <div key={label} className="flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-primary/10 flex-shrink-0">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <div>
              <span className="text-sm font-semibold text-on-surface">{stat}</span>
              <span className="text-sm text-on-surface-variant ml-1">{label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Comparison bar */}
      <div className="px-6 pb-4">
        <div className="bg-surface rounded-xl p-4 border border-outline-variant/50">
          <div className="text-xs font-medium text-on-surface-variant mb-3">
            3-Year Excess Returns vs Benchmark
          </div>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-on-surface-variant">Score 80+</span>
                <span className="font-semibold text-green-600">+34%</span>
              </div>
              <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: '85%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-on-surface-variant">Score &lt;40</span>
                <span className="font-semibold text-red-500">+8%</span>
              </div>
              <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                <div className="h-full bg-red-400 rounded-full" style={{ width: '20%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="px-6 pb-6 space-y-2">
        <Link
          href="/pricing#scores"
          onClick={handleClick}
          className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-primary text-on-primary rounded-full font-medium text-sm hover:bg-primary/90 transition-colors shadow-md"
        >
          {isAuthenticated ? 'Unlock Predictive Scores' : 'Sign Up Free'}
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/scores/methodology"
          className="flex items-center justify-center gap-1 text-sm text-primary hover:underline transition-colors"
        >
          See the proof behind our scores
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
