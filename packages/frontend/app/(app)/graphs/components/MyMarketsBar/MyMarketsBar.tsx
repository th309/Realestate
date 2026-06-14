'use client';

import React, { useState } from 'react';
import { Plus, X, MapPin } from 'lucide-react';
import { MyMarket } from '../../hooks/useMyMarkets';

interface MyMarketsBarProps {
  markets: MyMarket[];
  selectedMarkets: MyMarket[];
  onSelectMarket: (market: MyMarket) => void;
  onAddMarket: () => void;
  loading?: boolean;
}

/**
 * MyMarketsBar - Top zone showing user's saved markets with scores
 * Click chips to toggle comparison selection (max 2)
 */
export function MyMarketsBar({
  markets,
  selectedMarkets,
  onSelectMarket,
  onAddMarket,
  loading = false,
}: MyMarketsBarProps) {
  const isSelected = (marketId: string) =>
    selectedMarkets.some(m => m.id === marketId);

  return (
    <div className="bg-surface-container rounded-2xl p-4 mb-6">
      <div className="flex items-center gap-4">
        {/* Label */}
        <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider whitespace-nowrap">
          My Markets
        </span>

        {/* Market Chips */}
        <div className="flex gap-2 flex-wrap flex-1">
          {loading ? (
            // Skeleton loading
            <>
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className="h-10 w-32 bg-surface-container-high rounded-full animate-pulse"
                />
              ))}
            </>
          ) : markets.length === 0 ? (
            <span className="text-sm text-on-surface-variant">
              No markets saved yet. Add your first market to compare.
            </span>
          ) : (
            markets.map(market => (
              <MarketChip
                key={market.id}
                market={market}
                isSelected={isSelected(market.id)}
                onClick={() => onSelectMarket(market)}
              />
            ))
          )}

          {/* Add Market Button */}
          <button
            onClick={onAddMarket}
            className="flex items-center gap-1.5 px-4 py-2 border-2 border-dashed border-outline-variant rounded-full text-sm font-medium text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Market
          </button>
        </div>
      </div>

      {/* Selection hint */}
      {selectedMarkets.length === 1 && (
        <p className="text-xs text-on-surface-variant mt-3 ml-20">
          Select another market to compare
        </p>
      )}
    </div>
  );
}

interface MarketChipProps {
  market: MyMarket;
  isSelected: boolean;
  onClick: () => void;
}

function MarketChip({ market, isSelected, onClick }: MarketChipProps) {
  const scoreColor = getScoreColor(market.score);

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
        transition-all duration-200
        ${isSelected
          ? 'bg-primary text-on-primary'
          : 'bg-surface-container-lowest border border-outline-variant text-on-surface hover:bg-primary-container hover:border-primary'
        }
      `}
    >
      {/* Market Name */}
      <span>{market.name}</span>

      {/* Score Badge */}
      {market.score !== null && (
        <span
          className={`
            text-xs font-bold px-2 py-0.5 rounded-full
            ${isSelected
              ? 'bg-white/20'
              : `${scoreColor.bg} ${scoreColor.text}`
            }
          `}
        >
          {Math.round(market.score)}
        </span>
      )}

      {/* Trend indicator */}
      {market.trend && !isSelected && (
        <span className={`text-xs ${market.trend === 'up' ? 'text-green-600' : market.trend === 'down' ? 'text-red-500' : 'text-on-surface-variant'}`}>
          {market.trend === 'up' ? '↑' : market.trend === 'down' ? '↓' : '→'}
        </span>
      )}
    </button>
  );
}

function getScoreColor(score: number | null): { bg: string; text: string } {
  if (score === null) return { bg: 'bg-surface-container-high', text: 'text-on-surface-variant' };
  if (score >= 80) return { bg: 'bg-green-100', text: 'text-green-700' };
  if (score >= 60) return { bg: 'bg-primary-container', text: 'text-on-primary-container' };
  if (score >= 40) return { bg: 'bg-yellow-100', text: 'text-yellow-700' };
  return { bg: 'bg-red-100', text: 'text-red-700' };
}

export default MyMarketsBar;
