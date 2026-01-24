/**
 * RightDetailPanel Component
 *
 * Wider panel that slides in from the right when a region is clicked.
 * Compact design with:
 * - Main score card (HomeReady/InvestorEdge) with admin-editable sub-metrics
 * - Market Health score card with admin-editable sub-metrics
 * - All content fits without scrolling
 *
 * Mobile: Full-screen overlay
 * Desktop: Side panel overlay (520px wide)
 *
 * Material Design 3 compliant.
 */

'use client';

import { useEffect, useCallback, useState } from 'react';
import type { ViewMode, SelectedGeography, GeoLevel } from '../../types';
import { CloseIcon } from '../Icons';
import { CompactScoreCard, type MetricIndicator, type TrendData } from './CompactScoreCard';
import { api } from '@/lib/api/client';
import { getMetricConfig } from '../../config/metrics';
import { formatValue, getMetricFormat } from '../../utils/metricUtils';

interface RightDetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  viewMode: ViewMode;
  geography: SelectedGeography | null;
  geoLevel: GeoLevel;
  isAdmin?: boolean;
  isLoading?: boolean;
}

// Default metric selections for each score type
const DEFAULT_HOMEREADY_METRICS = ['home_value_yoy', 'days_on_market', 'for_sale_inventory'];
const DEFAULT_INVESTOREDGE_METRICS = ['cap_rate', 'rent_index', 'pending_ratio'];
const DEFAULT_MARKETHEALTH_METRICS = ['hotness_score', 'inventory_yoy', 'new_listings_yoy'];

const STORAGE_KEY = 'rightpanel-metric-selections';

interface MetricSelections {
  homeready: string[];
  investoredge: string[];
  markethealth: string[];
}

function loadMetricSelections(): MetricSelections {
  if (typeof window === 'undefined') {
    return {
      homeready: DEFAULT_HOMEREADY_METRICS,
      investoredge: DEFAULT_INVESTOREDGE_METRICS,
      markethealth: DEFAULT_MARKETHEALTH_METRICS,
    };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to load metric selections:', e);
  }

  return {
    homeready: DEFAULT_HOMEREADY_METRICS,
    investoredge: DEFAULT_INVESTOREDGE_METRICS,
    markethealth: DEFAULT_MARKETHEALTH_METRICS,
  };
}

function saveMetricSelections(selections: MetricSelections) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selections));
  } catch (e) {
    console.error('Failed to save metric selections:', e);
  }
}

// Calculate trend from time series data
function calculateTrend(data: { date: string; value: number }[]): TrendData {
  if (!data || data.length < 2) {
    return { currentValue: data?.[0]?.value ?? null, previousValue: null, changePercent: null, direction: null };
  }

  const sorted = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const currentValue = sorted[0].value;

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  let previousValue: number | null = null;
  let closestDiff = Infinity;

  for (const point of sorted) {
    const pointDate = new Date(point.date);
    const diff = Math.abs(pointDate.getTime() - threeMonthsAgo.getTime());
    if (diff < closestDiff && pointDate < new Date(sorted[0].date)) {
      closestDiff = diff;
      previousValue = point.value;
    }
  }

  if (previousValue === null && sorted.length > 1) {
    previousValue = sorted[sorted.length - 1].value;
  }

  if (previousValue === null || previousValue === 0) {
    return { currentValue, previousValue, changePercent: null, direction: null };
  }

  const changePercent = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;

  let direction: 'up' | 'down' | 'flat';
  if (Math.abs(changePercent) < 1) {
    direction = 'flat';
  } else if (changePercent > 0) {
    direction = 'up';
  } else {
    direction = 'down';
  }

  return { currentValue, previousValue, changePercent, direction };
}

export function RightDetailPanel({
  isOpen,
  onClose,
  viewMode,
  geography,
  geoLevel,
  isAdmin = false,
  isLoading = false,
}: RightDetailPanelProps) {
  const [scores, setScores] = useState<{
    homeready: number | null;
    investoredge: number | null;
    marketHealth: number | null;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  }>({ homeready: null, investoredge: null, marketHealth: null, confidence: 'MEDIUM' });
  const [scoresLoading, setScoresLoading] = useState(false);
  const [metricSelections, setMetricSelections] = useState<MetricSelections>(loadMetricSelections);
  const [metricData, setMetricData] = useState<Record<string, TrendData>>({});
  const [metricsLoading, setMetricsLoading] = useState(false);

  const scoreName = viewMode === 'homebuyer' ? 'HomeReady Score' : 'InvestorEdge Score';
  const mainScore = viewMode === 'homebuyer' ? scores.homeready : scores.investoredge;
  const mainMetricKey = viewMode === 'homebuyer' ? 'homeready' : 'investoredge';

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

  // Fetch scores when geography changes
  useEffect(() => {
    if (!geography || !isOpen) return;

    let isMounted = true;

    async function fetchScores() {
      setScoresLoading(true);
      try {
        const response = await api.getScore(geoLevel, geography.id);
        if (isMounted) {
          const conf = response.confidenceLevel === 'high' ? 'HIGH' : response.confidenceLevel === 'low' ? 'LOW' : 'MEDIUM';
          setScores({
            homeready: response.homereadyScore ?? null,
            investoredge: response.investoredgeScore ?? null,
            marketHealth: response.components?.homeready?.marketHealth ?? null,
            confidence: conf,
          });
        }
      } catch (err) {
        console.error('Failed to fetch scores:', err);
        if (isMounted) {
          setScores({ homeready: null, investoredge: null, marketHealth: null, confidence: 'MEDIUM' });
        }
      } finally {
        if (isMounted) setScoresLoading(false);
      }
    }

    fetchScores();
    return () => { isMounted = false; };
  }, [geography, geoLevel, isOpen]);

  // Fetch metric trends
  useEffect(() => {
    if (!geography || !isOpen) return;

    let isMounted = true;

    async function fetchMetricTrends() {
      const allMetricIds = [
        ...metricSelections.homeready,
        ...metricSelections.investoredge,
        ...metricSelections.markethealth,
      ];
      const uniqueMetricIds = [...new Set(allMetricIds)];

      setMetricsLoading(true);
      const trends: Record<string, TrendData> = {};

      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 4);
      const startDateStr = startDate.toISOString().split('T')[0];

      await Promise.all(
        uniqueMetricIds.map(async (metricId) => {
          try {
            const response = await api.getTimeSeries(
              metricId,
              geoLevel,
              geography.id,
              startDateStr,
              endDate
            );

            if (response.success && response.data.length > 0) {
              trends[metricId] = calculateTrend(response.data);
            } else {
              trends[metricId] = { currentValue: null, previousValue: null, changePercent: null, direction: null };
            }
          } catch (err) {
            trends[metricId] = { currentValue: null, previousValue: null, changePercent: null, direction: null };
          }
        })
      );

      if (isMounted) {
        setMetricData(trends);
        setMetricsLoading(false);
      }
    }

    fetchMetricTrends();
    return () => { isMounted = false; };
  }, [geography, geoLevel, isOpen, metricSelections]);

  // Convert metric IDs to indicators
  const getIndicatorsForMetrics = useCallback((metricIds: string[]): MetricIndicator[] => {
    return metricIds.map(id => {
      const config = getMetricConfig(id);
      const label = config?.title || id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const trend = metricData[id] || { currentValue: null, previousValue: null, changePercent: null, direction: null };

      let formattedValue = '--';
      if (trend.currentValue !== null) {
        const format = getMetricFormat(id);
        formattedValue = formatValue(trend.currentValue, format);
      }

      return { metricId: id, label, formattedValue, trend };
    });
  }, [metricData]);

  // Handlers for metric selection changes
  const handleMetricsChange = useCallback((scoreType: keyof MetricSelections) => (metricIds: string[]) => {
    const newSelections = { ...metricSelections, [scoreType]: metricIds };
    setMetricSelections(newSelections);
    saveMetricSelections(newSelections);
  }, [metricSelections]);

  if (!isOpen || !geography) return null;

  const loading = isLoading || scoresLoading;

  return (
    <>
      {/* Backdrop - mobile full screen, desktop semi-transparent */}
      <div
        className="fixed inset-0 bg-on-surface/40 z-40 sm:bg-transparent sm:pointer-events-none"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel - wider for compact horizontal cards */}
      <div
        className={`
          fixed z-50 bg-surface elevation-3
          inset-0 sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[520px]
          transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
        role="dialog"
        aria-modal="true"
        aria-label={`${geography.name} market details`}
      >
        {/* Header */}
        <div className="bg-surface border-b border-outline-variant px-4 py-3 flex items-center justify-between">
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

        {/* Content - compact, no scrolling needed */}
        <div className="p-4 space-y-3">
          {/* Main Score Card (HomeReady or InvestorEdge) */}
          <CompactScoreCard
            title={scoreName}
            score={mainScore}
            confidence={scores.confidence}
            indicators={getIndicatorsForMetrics(metricSelections[mainMetricKey])}
            loading={loading}
            metricsLoading={metricsLoading}
            isAdmin={isAdmin}
            selectedMetricIds={metricSelections[mainMetricKey]}
            viewMode={viewMode}
            onMetricsChange={handleMetricsChange(mainMetricKey)}
          />

          {/* Market Health Score Card */}
          <CompactScoreCard
            title="Market Health Index"
            score={scores.marketHealth}
            confidence={scores.confidence}
            indicators={getIndicatorsForMetrics(metricSelections.markethealth)}
            loading={loading}
            metricsLoading={metricsLoading}
            isAdmin={isAdmin}
            selectedMetricIds={metricSelections.markethealth}
            viewMode={viewMode}
            onMetricsChange={handleMetricsChange('markethealth')}
          />
        </div>
      </div>
    </>
  );
}
