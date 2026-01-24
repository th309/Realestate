/**
 * RightDetailPanel Component
 *
 * Analysis view panel that slides in from the right when a region is clicked.
 * Layout:
 * - Switchable Score Gauge (Main)
 * - Dynamic Side Score Cards (Secondary scores)
 * - Insight Carousel (AI insights)
 * - Market Factors grid (Real-time data)
 */

'use client';

import { useEffect, useCallback, useState, useMemo } from 'react';
import { X, TrendingUp } from 'lucide-react';
import type { ViewMode, SelectedGeography, GeoLevel } from '../../types';
import { api, timeSeriesApi } from '@/lib/api/client';
import { getMetricCategories } from '../../config/metric-categories';
import { formatValue, getMetricFormat } from '../../utils/metricUtils';
import { useScoreData, type ScoreType } from '../../hooks/useScoreData';
import { ScoreGaugeCard } from './ScoreGaugeCard';
import { SideScoreCard } from './SideScoreCard';
import { InsightCarousel } from './InsightCarousel';

interface RightDetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  viewMode: ViewMode;
  geography: SelectedGeography | null;
  geoLevel: GeoLevel;
  isAdmin?: boolean;
}

interface MarketFactor {
  id: string;
  label: string;
  metricId: string;
}

const DEFAULT_MARKET_FACTORS: MarketFactor[] = [
  { id: 'appreciation', label: 'Appreciation', metricId: 'home_value_yoy' },
  { id: 'yield', label: 'Yield Potential', metricId: 'cap_rate' },
  { id: 'risk', label: 'Risk Level', metricId: 'price_volatility' },
  { id: 'demand', label: 'Demand', metricId: 'pending_ratio' },
];

const STORAGE_KEY = 'rightpanel-market-factors';

function loadMarketFactors(): MarketFactor[] {
  if (typeof window === 'undefined') return DEFAULT_MARKET_FACTORS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_MARKET_FACTORS;
  } catch {
    return DEFAULT_MARKET_FACTORS;
  }
}

export function RightDetailPanel({
  isOpen,
  onClose,
  viewMode,
  geography,
  geoLevel,
  isAdmin = false,
}: RightDetailPanelProps) {
  const [selectedScoreType, setSelectedScoreType] = useState<ScoreType>(
    viewMode === 'investor' ? 'investoredge' : 'homeready'
  );

  const { data: scoreData, loading: scoresLoading } = useScoreData(
    geoLevel as any,
    geography?.id ?? null,
    { expanded: true }
  );

  const [metricData, setMetricData] = useState<Record<string, { value: number | null; trend: number | null }>>({});
  const [marketFactors] = useState<MarketFactor[]>(loadMarketFactors);
  const [factorsLoading, setFactorsLoading] = useState(false);

  // Sync selected score with viewMode when it changes externally
  useEffect(() => {
    setSelectedScoreType(viewMode === 'investor' ? 'investoredge' : 'homeready');
  }, [viewMode]);

  // Determine which scores go where
  const scoreLayout = useMemo(() => {
    const types: ScoreType[] = ['investoredge', 'homeready', 'market_health'];
    const otherTypes = types.filter(t => t !== selectedScoreType);

    // Logic: Top right should always be investoredge or homeready if possible
    let side1 = otherTypes[0];
    let side2 = otherTypes[1];

    if (side2 === 'investoredge' || side2 === 'homeready') {
      [side1, side2] = [side2, side1];
    }

    return { main: selectedScoreType, side1, side2 };
  }, [selectedScoreType]);

  // Fetch real-time metric data for factors
  useEffect(() => {
    if (!geography || !isOpen) return;

    async function fetchMetrics() {
      setFactorsLoading(true);
      const metricIds = [...new Set(marketFactors.map(f => f.metricId))];
      const results: Record<string, { value: number | null; trend: number | null }> = {};

      const now = new Date();
      const endDate = now.toISOString().split('T')[0];
      const startDate = new Date(now.setMonth(now.getMonth() - 6)).toISOString().split('T')[0];

      await Promise.all(metricIds.map(async (id) => {
        try {
          const res = await timeSeriesApi.getTimeSeries(id, geoLevel, geography!.id, startDate, endDate);
          if (res.success && res.data.length > 0) {
            const sorted = [...res.data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            const current = sorted[0].value;
            const prev = sorted.length > 1 ? sorted[1].value : null;
            const trend = prev ? ((current - prev) / Math.abs(prev)) * 100 : null;
            results[id] = { value: current, trend };
          }
        } catch {
          results[id] = { value: null, trend: null };
        }
      }));

      setMetricData(results);
      setFactorsLoading(false);
    }

    fetchMetrics();
  }, [geography, geoLevel, isOpen, marketFactors]);

  const getScoreValue = (type: ScoreType) => {
    if (!scoreData) return null;
    const key = type === 'market_health' ? 'marketHealth' : type;
    const scoreObj = scoreData[key as keyof typeof scoreData];
    if (typeof scoreObj === 'object' && scoreObj !== null && 'score' in scoreObj) {
      return (scoreObj as any).score as number ?? null;
    }
    return null;
  };

  const getScoreTrend = (type: ScoreType) => {
    if (!scoreData) return null;
    const key = type === 'market_health' ? 'marketHealth' : type;
    const scoreObj = scoreData[key as keyof typeof scoreData];
    if (typeof scoreObj === 'object' && scoreObj !== null && 'trendChange' in scoreObj) {
      return (scoreObj as any).trendChange as number ?? null;
    }
    return null;
  };

  const getConfidenceLevel = (type: ScoreType): 'high' | 'medium' | 'low' | 'insufficient' => {
    if (!scoreData) return 'medium';
    const key = type === 'market_health' ? 'marketHealth' : type;
    const scoreObj = scoreData[key as keyof typeof scoreData];
    if (typeof scoreObj === 'object' && scoreObj !== null && 'confidence' in scoreObj) {
      const conf = (scoreObj as any).confidence;
      if (conf && typeof conf.level === 'string') {
        return conf.level as 'high' | 'medium' | 'low' | 'insufficient';
      }
    }
    return 'medium';
  };

  const formatMetricValue = (metricId: string, value: number | null | undefined) => {
    if (value === null || value === undefined) return '--';
    return formatValue(value, getMetricFormat(metricId));
  };

  if (!isOpen || !geography) return null;

  return (
    <>
      {/* M3 Scrim - Mobile overlay backdrop only */}
      <div
        className="fixed inset-0 bg-on-surface/40 z-40 md:hidden transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`
          flex flex-col bg-surface elevation-1 z-50
          fixed inset-y-0 right-0 w-full sm:w-[580px]
          md:relative md:inset-auto md:z-20 md:elevation-0 md:border-l md:border-outline-variant
          transform transition-all duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full md:hidden'}
        `}
      >
        {/* Header */}
        <div className="bg-surface border-b border-outline-variant px-4 py-3 flex items-center justify-between sticky top-0 z-10">
          <div>
            <p className="text-[9px] font-medium text-primary uppercase tracking-widest mb-0.5">Analysis View</p>
            <h2 className="text-lg font-bold text-on-surface">{geography.name}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-surface-container transition-colors">
            <X className="w-5 h-5 text-on-surface-variant" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto overflow-x-hidden">
          {/* Main Scoring Section */}
          <div className="flex gap-3 items-stretch h-[360px]">
            <ScoreGaugeCard
              type={scoreLayout.main}
              score={getScoreValue(scoreLayout.main)}
              confidenceLevel={getConfidenceLevel(scoreLayout.main)}
              trend={getScoreTrend(scoreLayout.main)}
              loading={scoresLoading}
            />

            <div className="w-[230px] flex flex-col gap-3">
              <SideScoreCard
                type={scoreLayout.side1}
                score={getScoreValue(scoreLayout.side1)}
                trend={getScoreTrend(scoreLayout.side1)}
                onClick={() => setSelectedScoreType(scoreLayout.side1)}
                className="flex-1"
              />
              <SideScoreCard
                type={scoreLayout.side2}
                score={getScoreValue(scoreLayout.side2)}
                trend={getScoreTrend(scoreLayout.side2)}
                onClick={() => setSelectedScoreType(scoreLayout.side2)}
                className="flex-1"
              />

              <InsightCarousel
                geographyName={geography.name}
                investorScore={getScoreValue('investoredge')}
                homeReadyScore={getScoreValue('homeready')}
                marketHealthScore={getScoreValue('market_health')}
                viewMode={viewMode === 'investor' ? 'investor' : 'homebuyer'}
                className="flex-[2]"
              />
            </div>
          </div>

          {/* Market Factors Section */}
          <div className="bg-surface-container-low rounded-2xl p-4 border border-outline-variant">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-bold text-on-surface">Market Factors</h4>
                <p className="text-[10px] text-on-surface-variant mt-0.5">Key elements influencing the score</p>
              </div>
              {isAdmin && (
                <span className="text-[9px] text-on-surface-variant bg-surface-container px-2 py-1 rounded">
                  Double click to edit
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {marketFactors.map((factor) => {
                const data = metricData[factor.metricId];
                return (
                  <div key={factor.id} className="bg-surface rounded-xl p-3 border border-outline-variant flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/5`}>
                      <TrendingUp className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[9px] font-medium text-on-surface-variant uppercase tracking-wide block truncate">
                        {factor.label}
                      </span>
                      <p className="text-xs font-bold text-on-surface mt-0.5 truncate">
                        {factorsLoading ? '...' : formatMetricValue(factor.metricId, data?.value)}
                        {data?.trend != null && typeof data.trend === 'number' && (
                          <span className={`text-[9px] font-normal ml-1 ${data.trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {data.trend >= 0 ? '+' : ''}{data.trend.toFixed(0)}%
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
