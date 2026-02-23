'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Heart, Check, ChevronDown, FileText, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import type { GraphsState } from '../hooks/useGraphsState';

interface SaveGraphButtonProps {
  graphState: GraphsState;
  onSaveTemplate: () => void;
}

export function SaveGraphButton({ graphState, onSaveTemplate }: SaveGraphButtonProps) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const marketsToFavorite = graphState.markets.filter((m) => m.id && m.name);
  const hasMarkets = marketsToFavorite.length > 0;

  const handleFavorite = useCallback(async () => {
    if (!user?.id || saving || !hasMarkets) return;

    setSaving(true);
    try {
      const results = await Promise.all(
        marketsToFavorite.map(async (market) => {
          const response = await fetch('/api/analytics/persistence/watchlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              geography_type: market.type,
              geography_id: market.id,
              geography_name: market.name,
            }),
          });
          const data = await response.json();
          return data.success;
        })
      );

      if (results.some(Boolean)) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      // Silent fail — button reverts to default state
    } finally {
      setSaving(false);
    }
  }, [user?.id, saving, hasMarkets, marketsToFavorite]);

  const disabled = !user || saving || !hasMarkets;
  const title = !user
    ? 'Sign in to favorite markets'
    : !hasMarkets
      ? 'Select a market first'
      : 'Favorite selected markets';

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center">
        {/* Main favorite button */}
        <button
          type="button"
          onClick={handleFavorite}
          disabled={disabled}
          className={`
            flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-l-xl text-xs font-medium
            transition-all duration-150
            ${disabled
              ? 'text-on-surface-variant/50 cursor-not-allowed'
              : 'text-on-surface-variant hover:bg-surface-container-high'
            }
          `}
          title={title}
        >
          {saving
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : saved
              ? <Check className="w-3.5 h-3.5" style={{ color: '#16a34a' }} />
              : <Heart className="w-3.5 h-3.5" />
          }
          <span>{saved ? 'Favorited!' : 'Favorite'}</span>
        </button>

        {/* Dropdown toggle */}
        {user && (
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="px-1 py-1.5 rounded-r-xl text-on-surface-variant hover:bg-surface-container-high transition-all duration-150"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Dropdown menu */}
      {dropdownOpen && (
        <div className="absolute top-full right-0 mt-1 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/20 py-1 z-50 min-w-[160px]">
          <button
            type="button"
            onClick={() => {
              setDropdownOpen(false);
              onSaveTemplate();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            Save as Template
          </button>
        </div>
      )}
    </div>
  );
}

export default SaveGraphButton;
