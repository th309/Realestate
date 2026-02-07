'use client';

/**
 * InsightsPaywall - Custom paywall for AI Market Intelligence
 *
 * Sells the combination of hard data + soft signals (news, local events)
 * that produces more nuanced market assessments.
 */

import React, { useEffect, useState } from 'react';
import { Sparkles, Newspaper, Brain, LineChart, ArrowRight } from 'lucide-react';
import { useEntitlements } from '@/lib/entitlements';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface InsightsPaywallProps {
  className?: string;
  /** Compact mode for inline use */
  compact?: boolean;
}

const VALUE_POINTS = [
  {
    icon: LineChart,
    title: 'Hard Data Analysis',
    description: '60+ metrics distilled into actionable narrative',
  },
  {
    icon: Newspaper,
    title: 'News-Aware Context',
    description: 'National and local market news factored in',
  },
  {
    icon: Brain,
    title: 'Nuanced Assessment',
    description: 'Soft signals most analysts miss, surfaced for you',
  },
];

export function InsightsPaywall({ className = '', compact = false }: InsightsPaywallProps) {
  const { trackUpgradeClick } = useEntitlements();
  const [isAuthenticated, setIsAuthenticated] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      setIsAuthenticated(!!data.session);
    });
  }, []);

  const handleClick = () => {
    trackUpgradeClick('feature', 'ai_insights');
  };

  if (compact) {
    return (
      <div className={`bg-surface-container rounded-xl p-4 border border-outline-variant ${className}`}>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-on-surface">AI Market Intelligence</span>
        </div>
        <p className="text-xs text-on-surface-variant mb-3">
          Hard data meets soft signals. Get AI analysis that factors in news, trends, and local context for deeper market understanding.
        </p>
        <Link
          href="/pricing"
          onClick={handleClick}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Unlock AI Insights <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className={`bg-surface-container rounded-2xl border border-outline-variant overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-br from-primary/5 via-surface-container to-tertiary/5 px-6 pt-6 pb-4">
        <div className="flex items-center gap-2 text-primary mb-2">
          <Sparkles className="w-5 h-5" />
          <span className="text-xs font-semibold uppercase tracking-wider">AI Market Intelligence</span>
        </div>
        <h3 className="text-xl font-medium text-on-surface mb-1">
          Beyond the Numbers
        </h3>
        <p className="text-sm text-on-surface-variant">
          Our AI doesn't just crunch numbers. It reads the market - combining
          hard data with news and local signals for analysis that captures
          what spreadsheets miss.
        </p>
      </div>

      {/* Value points */}
      <div className="px-6 py-5 space-y-4">
        {VALUE_POINTS.map(({ icon: Icon, title, description }) => (
          <div key={title} className="flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-primary/10 flex-shrink-0">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="text-sm font-medium text-on-surface">{title}</div>
              <div className="text-xs text-on-surface-variant">{description}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Example insight preview */}
      <div className="px-6 pb-4">
        <div className="bg-surface rounded-xl p-4 border border-dashed border-outline-variant/50">
          <p className="text-xs text-on-surface-variant italic leading-relaxed">
            "Austin's market shows cooling demand with inventory up 18% YoY, but recent
            tech sector expansions and favorable zoning changes signal a potential rebound
            in Q3..."
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span className="text-[10px] text-on-surface-variant font-medium">Sample AI Insight</span>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="px-6 pb-6">
        <Link
          href="/pricing"
          onClick={handleClick}
          className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-primary text-on-primary rounded-full font-medium text-sm hover:bg-primary/90 transition-colors shadow-md"
        >
          {isAuthenticated ? 'Unlock AI Market Intelligence' : 'Sign Up Free'}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
