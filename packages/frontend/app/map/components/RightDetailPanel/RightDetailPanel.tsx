/**
 * RightDetailPanel Component
 *
 * Collapsible panel that slides in from the right when a region is clicked.
 * Shows detailed market analysis including:
 * - Score ring with overall score
 * - Market condition badge
 * - Summary text
 * - 4 key metric cards
 * - Action buttons
 *
 * Mobile: Full-screen overlay
 * Desktop: Side panel overlay
 */

'use client';

import { useEffect, useCallback } from 'react';
import type { ViewMode, SelectedGeography, GeoLevel } from '../../types';
import { CloseIcon, LockIcon } from '../Icons';
import { ScoreRing } from './ScoreRing';
import { MetricCard, MetricCardGrid } from './MetricCard';
import { MarketConditionBadge, MarketCondition, TrendArrow, TrendDirection } from '../sidebar-components';

interface MetricData {
  value: string;
  label: string;
  percentile?: number;
  trend?: {
    direction: TrendDirection;
    value: string;
    comparison: string;
  };
  invertColors?: boolean;
}

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
  marketCondition?: MarketCondition;
  summaryText?: string;
  // Metric data (4 cards)
  metrics?: MetricData[];
  isLoading?: boolean;
  // Actions
  onViewFullReport?: () => void;
  onCompareMarkets?: () => void;
}

export function RightDetailPanel({
  isOpen,
  onClose,
  viewMode,
  geography,
  geoLevel,
  score,
  scoreTrend,
  marketCondition = 'balanced',
  summaryText,
  metrics = [],
  isLoading = false,
  onViewFullReport,
  onCompareMarkets,
}: RightDetailPanelProps) {
  const scoreName = viewMode === 'homebuyer' ? 'HomeReady' : 'InvestorEdge';
  const themeColor = viewMode === 'homebuyer' ? 'purple' : 'emerald';

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

  // Get score interpretation text
  const getScoreInterpretation = (score: number): string => {
    const isHomebuyer = viewMode === 'homebuyer';
    if (score >= 80) return isHomebuyer ? 'Excellent Time to Buy' : 'Strong Investment';
    if (score >= 60) return isHomebuyer ? 'Good Time to Buy' : 'Good Opportunity';
    if (score >= 40) return isHomebuyer ? 'Fair Conditions' : 'Moderate Potential';
    if (score >= 20) return isHomebuyer ? 'Challenging Market' : 'Higher Risk';
    return isHomebuyer ? 'Difficult Conditions' : 'Caution Advised';
  };

  if (!isOpen || !geography) return null;

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
          inset-0 sm:inset-y-0 sm:left-auto sm:right-0 sm:w-96
          transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
        role="dialog"
        aria-modal="true"
        aria-label={`${geography.name} market details`}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-2 rounded-full hover:bg-surface-container transition-colors duration-200 z-10"
          aria-label="Close panel"
        >
          <CloseIcon />
        </button>

        {/* Content */}
        <div className="p-4 pt-12 sm:pt-4">
          {/* Header with Score */}
          <div className="flex items-start gap-4 mb-4">
            {/* Score Ring */}
            <div className="flex-shrink-0">
              {isLoading ? (
                <div className="w-20 h-20 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              ) : score !== undefined ? (
                <ScoreRing score={score} size="md" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-surface-container-highest flex items-center justify-center">
                  <span className="text-2xl text-on-surface-variant">--</span>
                </div>
              )}
            </div>

            {/* Geography Name & Score Details */}
            <div className="flex-1 min-w-0 pt-1">
              <h2 className="text-lg font-semibold text-on-surface truncate">
                {geography.name}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-on-surface-variant">{scoreName} Score</span>
                {score !== undefined && scoreTrend && (
                  <TrendArrow direction={scoreTrend.direction} value={scoreTrend.value} />
                )}
              </div>
              {score !== undefined && (
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {getScoreInterpretation(score)}
                </p>
              )}
            </div>
          </div>

          {/* Market Condition Badge */}
          <div className="mb-4">
            <MarketConditionBadge condition={marketCondition} size="md" />
          </div>

          {/* Summary Text */}
          {summaryText && (
            <p className="text-sm text-on-surface-variant leading-relaxed mb-4 p-3 bg-surface-container rounded-xl">
              {summaryText}
            </p>
          )}

          {/* Metric Cards */}
          {metrics.length > 0 && (
            <MetricCardGrid>
              {metrics.map((metric, index) => (
                <MetricCard
                  key={index}
                  value={metric.value}
                  label={metric.label}
                  percentile={metric.percentile}
                  trend={metric.trend}
                  color={themeColor}
                  invertColors={metric.invertColors}
                />
              ))}
            </MetricCardGrid>
          )}

          {/* Loading placeholder for metrics */}
          {isLoading && metrics.length === 0 && (
            <MetricCardGrid>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-surface-container rounded-xl p-3 animate-pulse">
                  <div className="h-5 bg-surface-container-highest rounded w-16 mb-2" />
                  <div className="h-3 bg-surface-container-highest rounded w-24 mb-2" />
                  <div className="h-1 bg-surface-container-highest rounded w-full" />
                </div>
              ))}
            </MetricCardGrid>
          )}

          {/* Action Buttons */}
          <div className="mt-6 space-y-2">
            <button
              onClick={onViewFullReport}
              className="w-full py-3 px-4 bg-primary text-on-primary rounded-full font-medium hover:bg-primary/90 transition-colors duration-200"
            >
              View Full Report
            </button>

            <button
              onClick={onCompareMarkets}
              disabled
              className="w-full py-3 px-4 bg-surface-container text-on-surface-variant rounded-full font-medium flex items-center justify-center gap-2 opacity-60 cursor-not-allowed"
            >
              <span>Compare Markets</span>
              <span className="inline-flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-semibold">
                <LockIcon />
                PRO
              </span>
            </button>
          </div>

          {/* Geography Info */}
          <div className="mt-6 pt-4 border-t border-outline-variant">
            <p className="text-xs text-on-surface-variant">
              {geoLevel.charAt(0).toUpperCase() + geoLevel.slice(1)} Level
              {geography.stateAbbr && ` - ${geography.stateAbbr}`}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
