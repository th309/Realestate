'use client';

import React from 'react';
import { TrendingUp, ChevronRight, MapPin } from 'lucide-react';
import Link from 'next/link';
import { ContextualUpgradeCTA } from '@/components/entitlements';
import type { MarketRecommendation } from '@/lib/data';

interface MarketsToWatchProps {
  recommendations: MarketRecommendation[];
  isLoading: boolean;
  hasAccess: boolean;
  className?: string;
}

function RecommendationCard({ market }: { market: MarketRecommendation }) {
  return (
    <Link
      href={`/map?geo=${market.geography_type}&id=${market.geography_id}`}
      className="flex-shrink-0 w-56 bg-surface-container-low rounded-xl border border-outline-variant p-4 hover:bg-surface-container hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between mb-2">
        <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
        <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant/40 group-hover:text-on-surface-variant" />
      </div>
      <p className="text-sm font-medium text-on-surface line-clamp-2 mb-2">
        {market.geography_name}
      </p>
      <div className="flex items-center gap-2 mb-2">
        <div className="text-lg font-bold text-on-surface">{market.score}</div>
        <span className="text-[10px] text-on-surface-variant">score</span>
      </div>
      <p className="text-[10px] text-on-surface-variant line-clamp-2">{market.reason}</p>
    </Link>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="flex-shrink-0 w-56 rounded-xl bg-surface-container-low border border-outline-variant p-4 animate-pulse">
          <div className="w-4 h-4 rounded-full bg-surface-container-highest mb-2" />
          <div className="h-4 w-32 rounded bg-surface-container-highest mb-2" />
          <div className="h-6 w-12 rounded bg-surface-container-highest mb-2" />
          <div className="h-3 w-full rounded bg-surface-container-highest" />
        </div>
      ))}
    </div>
  );
}

export function MarketsToWatch({ recommendations, isLoading, hasAccess, className = '' }: MarketsToWatchProps) {
  if (!hasAccess) {
    return (
      <ContextualUpgradeCTA
        featureSlug="recommendations"
        title="Markets to Watch"
        description="Get personalized market recommendations based on your saved markets and preferences."
        ctaText="Unlock with Pro"
        className={className}
      />
    );
  }

  if (isLoading) return <LoadingSkeleton />;

  if (recommendations.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <TrendingUp className="w-8 h-8 text-on-surface-variant/30 mx-auto mb-3" />
        <p className="text-sm font-medium text-on-surface">No recommendations yet</p>
        <p className="text-xs text-on-surface-variant mt-1">
          Save some markets to your watchlist and we&apos;ll find similar ones for you.
        </p>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 overflow-x-auto pb-2 scrollbar-thin ${className}`}>
      {recommendations.map(market => (
        <RecommendationCard key={`${market.geography_type}-${market.geography_id}`} market={market} />
      ))}
    </div>
  );
}
