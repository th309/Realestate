/**
 * RightDetailPanel Component
 *
 * Collapsible panel that slides in from the right when a region is clicked.
 * Redesigned with minimalist gauge layout showing:
 * - Large circular score gauge with confidence badge
 * - Contextual data cards (pricing, inventory, insight)
 * - Market factors breakdown grid
 * - PropertyIQ Scores section
 *
 * Mobile: Full-screen overlay
 * Desktop: Side panel overlay
 *
 * Material Design 3 compliant.
 */

'use client';

import { useEffect, useCallback } from 'react';
import type { ViewMode, SelectedGeography, GeoLevel } from '../../types';
import { CloseIcon } from '../Icons';
import { MarketScoreCard } from './MarketScoreCard';
import { ContextualDataCards, type PricingData, type InventoryData, type InsightData } from './ContextualDataCards';
import { MarketFactorsGrid, type MarketFactor } from './MarketFactorsGrid';
import { ScoresSection } from './ScoresSection';
import type { TrendDirection } from '../sidebar-components/TrendArrow';
import type { GeographyType } from '../../hooks/useScoreData';

interface RightDetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  viewMode: ViewMode;
  geography: SelectedGeography | null;
  geoLevel: GeoLevel;
  // Score data
  score?: number;
  scoreTrend?: {
    direction: TrendDirection;
    value: string;
  };
  confidence?: 'A' | 'B' | 'C' | 'D';
  scoreInterpretation?: string;
  // Contextual data
  pricing?: PricingData;
  inventory?: InventoryData;
  insight?: InsightData;
  // Market factors
  marketFactors?: MarketFactor[];
  isLoading?: boolean;
  // Actions
  onViewMethodology?: () => void;
  onViewFullReport?: () => void;
  onMarketFactorsChange?: (factors: MarketFactor[]) => void;
}

export function RightDetailPanel({
  isOpen,
  onClose,
  viewMode,
  geography,
  geoLevel,
  score,
  scoreTrend,
  confidence,
  scoreInterpretation,
  pricing,
  inventory,
  insight,
  marketFactors = [],
  isLoading = false,
  onViewMethodology,
  onViewFullReport,
  onMarketFactorsChange,
}: RightDetailPanelProps) {
  const scoreName = viewMode === 'homebuyer' ? 'HomeReady Score' : 'InvestorEdge Score';

  // Handle escape key to close panel
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) {
      onClose();
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Get score interpretation based on score value
  const getDefaultInterpretation = (score: number): string => {
    const isHomebuyer = viewMode === 'homebuyer';
    if (score >= 80) {
      return isHomebuyer
        ? 'Excellent market conditions for buyers. Strong fundamentals with favorable pricing dynamics.'
        : 'High investment potential based on historical performance and current market momentum.';
    }
    if (score >= 60) {
      return isHomebuyer
        ? 'Good market conditions with solid fundamentals. Opportunities available for prepared buyers.'
        : 'Good investment opportunity with moderate risk and favorable returns outlook.';
    }
    if (score >= 40) {
      return isHomebuyer
        ? 'Fair market conditions. Careful analysis recommended before making decisions.'
        : 'Moderate investment potential. Consider market timing and local factors.';
    }
    if (score >= 20) {
      return isHomebuyer
        ? 'Challenging market conditions. Patience and strategic timing advised.'
        : 'Higher risk profile. Thorough due diligence recommended before investing.';
    }
    return isHomebuyer
      ? 'Difficult market conditions. Consider alternative markets or timing.'
      : 'Caution advised. Market fundamentals require careful evaluation.';
  };

  if (!isOpen || !geography) return null;

  const displayInterpretation = scoreInterpretation || (score !== undefined ? getDefaultInterpretation(score) : undefined);

  return (
    <>
      {/* Backdrop - mobile full screen, desktop semi-transparent */}
      <div
        className="fixed inset-0 bg-on-surface/40 z-40 sm:bg-transparent sm:pointer-events-none"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={`
          fixed z-50 bg-surface elevation-3 overflow-y-auto
          inset-0 sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[420px]
          transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
        role="dialog"
        aria-modal="true"
        aria-label={`${geography.name} market details`}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-surface border-b border-outline-variant px-4 py-3 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-on-surface truncate">
              {geography.name}
            </h2>
            <p className="text-xs text-on-surface-variant">
              {geoLevel.charAt(0).toUpperCase() + geoLevel.slice(1)} Level
              {geography.stateAbbr && ` · ${geography.stateAbbr}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surface-container transition-colors duration-200 flex-shrink-0"
            aria-label="Close panel"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Main Score Card */}
          <MarketScoreCard
            score={score ?? null}
            scoreName={scoreName}
            scoreInterpretation={displayInterpretation}
            trend={scoreTrend}
            confidence={confidence}
            isLoading={isLoading}
            onViewMethodology={onViewMethodology}
          />

          {/* Contextual Data Cards */}
          <ContextualDataCards
            pricing={pricing}
            inventory={inventory}
            insight={insight}
            isLoading={isLoading}
          />

          {/* Market Factors Grid */}
          <MarketFactorsGrid
            factors={marketFactors}
            title="Market Factors"
            description="Key elements influencing the score"
            isLoading={isLoading}
            viewMode={viewMode}
            onFactorsChange={onMarketFactorsChange}
          />

          {/* PropertyIQ Scores Section */}
          <ScoresSection
            geographyType={geoLevel as GeographyType}
            geographyId={geography.id}
            className="pt-4 border-t border-outline-variant"
          />

          {/* Action Button */}
          {onViewFullReport && (
            <div className="pt-4">
              <button
                onClick={onViewFullReport}
                className="w-full py-3 px-4 bg-primary text-on-primary rounded-full font-medium hover:bg-primary/90 transition-colors duration-200"
              >
                View Full Market Report
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
