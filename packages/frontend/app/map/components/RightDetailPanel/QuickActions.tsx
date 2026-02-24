'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Heart, ExternalLink, FileText, Loader2, Lock } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useEntitlements } from '@/lib/entitlements';
import { PaywallCard } from '@/components/entitlements/PaywallCard';
import { useWatchlist } from '@/components/analytics-assistant/persistence/useWatchlist';
import type { SelectedGeography, GeoLevel } from '../../types';

interface QuickActionsProps {
  geography: SelectedGeography;
  geoLevel: GeoLevel;
}

export function QuickActions({ geography, geoLevel }: QuickActionsProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { isInWatchlist, addToWatchlist, removeFromWatchlist, items, error } = useWatchlist({
    userId: user?.id ?? '',
    autoLoad: !!user?.id,
  });
  const [toggling, setToggling] = useState(false);

  const isSaved = isInWatchlist(geoLevel, geography.id);

  const handleToggleWatchlist = async () => {
    if (!user?.id || toggling) return;
    setToggling(true);
    try {
      if (isSaved) {
        const item = items.find(
          (i) => i.geography_type === geoLevel && i.geography_id === geography.id,
        );
        if (item) await removeFromWatchlist(item.id);
      } else {
        await addToWatchlist(geoLevel, geography.id, geography.name);
      }
    } finally {
      setToggling(false);
    }
  };

  const handleViewMarket = () => {
    const params = new URLSearchParams({ type: geoLevel });
    if (geography.stateAbbr) params.set('state', geography.stateAbbr);
    router.push(`/market/${geography.id}?${params.toString()}`);
  };

  const { getAccess } = useEntitlements();
  const watchlistAccess = getAccess('feature', 'watchlist_limit');
  const isWatchlistLocked = watchlistAccess.level === 'none';
  const reportAccess = getAccess('feature', 'reports');
  const isReportLocked = reportAccess.level === 'none';
  const [showPaywall, setShowPaywall] = useState<'watchlist' | 'reports' | null>(null);

  const handleGenerateReport = () => {
    try {
      localStorage.setItem(
        'propertyiq-report-prefill',
        JSON.stringify({
          id: geography.id,
          name: geography.name,
          type: geoLevel,
          state: geography.stateAbbr,
        }),
      );
    } catch { /* ignore */ }

    if (reportAccess.level === 'full') {
      router.push('/reports');
    } else {
      router.push('/reports/sample');
    }
  };

  const btnBase =
    'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors';

  const disabled = !user?.id || toggling;

  return (
    <div>
      <div className="flex gap-2">
        {isWatchlistLocked ? (
          <button
            onClick={() => setShowPaywall('watchlist')}
            className={`${btnBase} text-on-surface-variant/60 bg-surface-container border border-outline-variant hover:bg-surface-container-high`}
            title="Upgrade to Pro to favorite markets"
          >
            <Lock className="w-3.5 h-3.5" />
            Favorite
          </button>
        ) : (
          <button
            onClick={handleToggleWatchlist}
            disabled={disabled}
            className={`${btnBase} ${isSaved
                ? 'bg-primary/10 text-primary border border-primary/30'
                : 'bg-surface-container text-on-surface border border-outline-variant hover:bg-surface-container-high'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            title={!user?.id ? 'Sign in to favorite markets' : isSaved ? 'Remove from favorites' : 'Add to favorites'}
          >
            {toggling
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-primary' : ''}`} />
            }
            {toggling ? 'Saving...' : isSaved ? 'Favorited' : 'Favorite'}
          </button>
        )}

        <button
          onClick={handleViewMarket}
          className={`${btnBase} bg-surface-container text-on-surface border border-outline-variant hover:bg-surface-container-high`}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Details
        </button>

        {isReportLocked ? (
          <button
            onClick={() => setShowPaywall('reports')}
            className={`${btnBase} text-on-surface-variant/60 bg-surface-container border border-outline-variant hover:bg-surface-container-high`}
            title="Upgrade to Pro to generate reports"
          >
            <Lock className="w-3.5 h-3.5" />
            Report
          </button>
        ) : (
          <button
            onClick={handleGenerateReport}
            className={`${btnBase} bg-surface-container text-on-surface border border-outline-variant hover:bg-surface-container-high`}
          >
            <FileText className="w-3.5 h-3.5" />
            Report
          </button>
        )}
      </div>

      {error && !isWatchlistLocked && (
        <p className="text-[10px] text-red-500 mt-1 px-1">{error}</p>
      )}

      {showPaywall && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/40"
          onClick={() => setShowPaywall(null)}
        >
          <div className="max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <PaywallCard
              type="feature"
              id={showPaywall === 'watchlist' ? 'watchlist_limit' : 'reports'}
              title={showPaywall === 'watchlist' ? 'Unlock Favorites' : 'Unlock Reports'}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
