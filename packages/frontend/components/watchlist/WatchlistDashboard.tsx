'use client';

import React from 'react';
import { MapPin, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface WatchlistItem {
  id: string;
  geography_type: string;
  geography_id: string;
  geography_name?: string;
  added_at: string;
  score_at_add?: number;
}

interface WatchlistDashboardProps {
  items: WatchlistItem[];
  isLoading: boolean;
  className?: string;
}

function MarketCard({ item }: { item: WatchlistItem }) {
  const geoLabel = item.geography_type === 'metro' ? 'Metro'
    : item.geography_type === 'county' ? 'County'
    : item.geography_type === 'zip' ? 'ZIP'
    : item.geography_type;

  return (
    <Link
      href={`/map?geo=${item.geography_type}&id=${item.geography_id}`}
      className="block bg-surface-container-low rounded-xl border border-outline-variant p-4 hover:bg-surface-container hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2 min-w-0">
          <MapPin className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-on-surface truncate">
              {item.geography_name || item.geography_id}
            </p>
            <p className="text-xs text-on-surface-variant">{geoLabel}</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-on-surface-variant/50 group-hover:text-on-surface-variant flex-shrink-0" />
      </div>

      {item.score_at_add != null && (
        <div className="mt-3 flex items-center gap-2">
          <div className="text-lg font-semibold text-on-surface">{item.score_at_add}</div>
          <span className="text-xs text-on-surface-variant">score at save</span>
        </div>
      )}

      <p className="text-[10px] text-on-surface-variant/60 mt-2">
        Saved {new Date(item.added_at).toLocaleDateString()}
      </p>
    </Link>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-surface-container-low rounded-xl border border-outline-variant p-4 animate-pulse">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-surface-container-highest" />
            <div className="h-4 w-32 rounded bg-surface-container-highest" />
          </div>
          <div className="mt-3 h-6 w-12 rounded bg-surface-container-highest" />
          <div className="mt-2 h-3 w-20 rounded bg-surface-container-highest" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-8">
      <MapPin className="w-8 h-8 text-on-surface-variant/30 mx-auto mb-3" />
      <p className="text-sm font-medium text-on-surface">No saved markets yet</p>
      <p className="text-xs text-on-surface-variant mt-1">
        Search for a market and tap the heart icon to save it here.
      </p>
      <Link
        href="/map"
        className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
      >
        Explore Markets
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

export function WatchlistDashboard({ items, isLoading, className = '' }: WatchlistDashboardProps) {
  if (isLoading) return <LoadingSkeleton />;
  if (items.length === 0) return <EmptyState />;

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 ${className}`}>
      {items.map((item) => (
        <MarketCard key={item.id} item={item} />
      ))}
    </div>
  );
}
