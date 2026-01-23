/**
 * MarketFactorsGrid Component
 *
 * Displays detailed breakdown of market factors influencing the score.
 * Supports edit mode where users can select different metrics from the sidebar categories.
 *
 * Each factor shows an icon, label, and value with appropriate formatting.
 * Follows the same editable pattern as the graphs page ScoreCards.
 *
 * Material Design 3 compliant.
 */

'use client';

import { memo, useState, useEffect, useCallback } from 'react';
import type { ViewMode, Metric } from '../../types';
import { getMetricCategories } from '../../config/metric-categories';

export interface MarketFactor {
  id: string;
  label: string;
  value: string;
  metricId?: string; // ID of the selected metric
  score?: number; // 0-100
  level?: 'high' | 'medium' | 'low';
  icon: 'trending_up' | 'query_stats' | 'verified' | 'groups' | 'home' | 'percent' | 'payments' | 'inventory';
}

interface MarketFactorCardProps {
  factor: MarketFactor;
  isEditing: boolean;
  availableMetrics: Metric[];
  onMetricChange: (factorId: string, metricId: string) => void;
}

// Icon components
function TrendingUpIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

function QueryStatsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function VerifiedIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function GroupsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function PercentIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
    </svg>
  );
}

function PaymentsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function InventoryIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function getIcon(iconType: MarketFactor['icon']) {
  switch (iconType) {
    case 'trending_up':
      return <TrendingUpIcon />;
    case 'query_stats':
      return <QueryStatsIcon />;
    case 'verified':
      return <VerifiedIcon />;
    case 'groups':
      return <GroupsIcon />;
    case 'home':
      return <HomeIcon />;
    case 'percent':
      return <PercentIcon />;
    case 'payments':
      return <PaymentsIcon />;
    case 'inventory':
      return <InventoryIcon />;
    default:
      return <QueryStatsIcon />;
  }
}

/**
 * Individual market factor card with optional edit mode
 */
function MarketFactorCard({ factor, isEditing, availableMetrics, onMetricChange }: MarketFactorCardProps) {
  return (
    <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant shadow-sm flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary flex-shrink-0">
        {getIcon(factor.icon)}
      </div>
      <div className="min-w-0 flex-1">
        {isEditing ? (
          <select
            value={factor.metricId || factor.id}
            onChange={(e) => onMetricChange(factor.id, e.target.value)}
            className="w-full text-[11px] font-medium bg-surface-container border border-outline-variant rounded-md px-2 py-1.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary truncate"
          >
            {availableMetrics.map((metric) => (
              <option key={metric.id} value={metric.id}>
                {metric.name}
              </option>
            ))}
          </select>
        ) : (
          <>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide truncate">
              {factor.label}
            </p>
            <p className="text-sm font-bold text-on-surface truncate">
              {factor.value}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

interface MarketFactorsGridProps {
  factors: MarketFactor[];
  title?: string;
  description?: string;
  isLoading?: boolean;
  viewMode?: ViewMode;
  onFactorsChange?: (factors: MarketFactor[]) => void;
}

/**
 * Loading skeleton for market factors
 */
function FactorsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="p-3 bg-surface-container-low rounded-xl border border-outline-variant animate-pulse flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex-shrink-0" />
          <div className="flex-1">
            <div className="h-2.5 w-16 bg-surface-container-highest rounded mb-1.5" />
            <div className="h-4 w-20 bg-surface-container-highest rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export const MarketFactorsGrid = memo(function MarketFactorsGrid({
  factors,
  title = 'Market Factors',
  description,
  isLoading = false,
  viewMode = 'homebuyer',
  onFactorsChange,
}: MarketFactorsGridProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedFactors, setEditedFactors] = useState(factors);

  // Get available metrics from categories based on view mode
  const availableMetrics = useCallback((): Metric[] => {
    const categories = getMetricCategories(viewMode);
    const metrics: Metric[] = [];
    categories.forEach((category) => {
      if (category.metrics) {
        metrics.push(...category.metrics);
      }
    });
    return metrics;
  }, [viewMode]);

  // Reset edited factors when original factors change
  useEffect(() => {
    setEditedFactors(factors);
  }, [factors]);

  const handleMetricChange = useCallback((factorId: string, metricId: string) => {
    const metrics = availableMetrics();
    const selectedMetric = metrics.find((m) => m.id === metricId);
    if (!selectedMetric) return;

    setEditedFactors((prev) =>
      prev.map((f) =>
        f.id === factorId
          ? { ...f, metricId, label: selectedMetric.name }
          : f
      )
    );
  }, [availableMetrics]);

  const handleSave = useCallback(() => {
    setIsEditing(false);
    onFactorsChange?.(editedFactors);
  }, [editedFactors, onFactorsChange]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditedFactors(factors);
  }, [factors]);

  if (isLoading) {
    return (
      <section className="pt-4 border-t border-outline-variant">
        <div className="mb-3">
          <h5 className="text-base font-bold text-on-surface">{title}</h5>
          {description && (
            <p className="text-xs text-on-surface-variant mt-0.5">{description}</p>
          )}
        </div>
        <FactorsSkeleton />
      </section>
    );
  }

  if (factors.length === 0) {
    return null;
  }

  const metrics = availableMetrics();

  return (
    <section className="pt-4 border-t border-outline-variant">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h5 className="text-base font-bold text-on-surface">{title}</h5>
          {description && (
            <p className="text-xs text-on-surface-variant mt-0.5">{description}</p>
          )}
        </div>
        {onFactorsChange && (
          <div className="flex items-center gap-1">
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  className="p-1.5 rounded-full hover:bg-surface-container-high text-green-600 transition-colors"
                  title="Save"
                >
                  <CheckIcon />
                </button>
                <button
                  onClick={handleCancel}
                  className="p-1.5 rounded-full hover:bg-surface-container-high text-red-500 transition-colors"
                  title="Cancel"
                >
                  <XIcon />
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="p-1.5 rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
                title="Edit factors"
              >
                <PencilIcon />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {editedFactors.map((factor) => (
          <MarketFactorCard
            key={factor.id}
            factor={factor}
            isEditing={isEditing}
            availableMetrics={metrics}
            onMetricChange={handleMetricChange}
          />
        ))}
      </div>
    </section>
  );
});

export default MarketFactorsGrid;
