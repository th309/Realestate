'use client';

import React, { useState } from 'react';
import { Heart, Loader2 } from 'lucide-react';
import { ContextualUpgradeCTA } from '@/components/entitlements';
import { trackEvent } from '@/lib/analytics/tracker';

interface SaveMarketButtonProps {
  geographyType: string;
  geographyId: string;
  geographyName: string;
  isSaved: boolean;
  onToggle: (saved: boolean) => Promise<void>;
  watchlistCount?: number;
  watchlistLimit?: number;
  size?: 'sm' | 'md';
  className?: string;
}

export function SaveMarketButton({
  geographyType,
  geographyId,
  geographyName,
  isSaved,
  onToggle,
  watchlistCount = 0,
  watchlistLimit = 0,
  size = 'md',
  className = '',
}: SaveMarketButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showUpgradeCTA, setShowUpgradeCTA] = useState(false);

  const handleClick = async () => {
    if (loading) return;

    // If not saved and at limit, show upgrade prompt
    if (!isSaved && watchlistLimit !== -1 && watchlistCount >= watchlistLimit) {
      setShowUpgradeCTA(true);
      return;
    }

    setLoading(true);
    try {
      await onToggle(!isSaved);
      if (!isSaved) {
        trackEvent('feature.market_save', { geoType: geographyType, geoId: geographyId });
      }
    } finally {
      setLoading(false);
    }
  };

  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const buttonSize = size === 'sm' ? 'p-1.5' : 'p-2';

  return (
    <>
      <button
        onClick={handleClick}
        disabled={loading}
        className={`
          ${buttonSize} rounded-full transition-all duration-200
          ${isSaved
            ? 'text-red-500 hover:text-red-600 hover:bg-red-50'
            : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
          }
          disabled:opacity-50
          ${className}
        `}
        title={isSaved ? `Remove ${geographyName} from watchlist` : `Save ${geographyName}`}
        aria-label={isSaved ? 'Remove from watchlist' : 'Save to watchlist'}
      >
        {loading ? (
          <Loader2 className={`${iconSize} animate-spin`} />
        ) : (
          <Heart
            className={iconSize}
            fill={isSaved ? 'currentColor' : 'none'}
          />
        )}
      </button>

      {showUpgradeCTA && (
        <div className="absolute z-50 top-full right-0 mt-2 w-72">
          <ContextualUpgradeCTA
            featureSlug="watchlist_limit"
            title="Watchlist is full"
            description={`You've saved ${watchlistCount} of ${watchlistLimit} markets. Upgrade for more.`}
            ctaText="Upgrade to Pro"
          />
          <button
            onClick={() => setShowUpgradeCTA(false)}
            className="absolute top-1 right-1 p-1 text-on-surface-variant/50 hover:text-on-surface-variant"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
