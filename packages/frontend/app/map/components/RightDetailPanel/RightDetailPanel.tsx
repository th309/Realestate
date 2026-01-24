/**
 * RightDetailPanel Component
 *
 * Analysis view panel that slides in from the right when a region is clicked.
 * Layout:
 * - Switchable Score Gauge (Main)
 * - Dynamic Side Score Cards (Secondary scores)
 * - Insight Carousel (AI insights)
 * - Market Factors grid (Real-time data with sparklines)
 */

'use client';

import { useEffect, useState, useMemo } from 'react';
import { X, TrendingUp, TrendingDown } from 'lucide-react';
import type { ViewMode, SelectedGeography, GeoLevel } from '../../types';
import { timeSeriesApi } from '@/lib/api/client';
import { formatValue, getMetricFormat } from '../../utils/metricUtils';
import { useScoreData, type ScoreType } from '../../hooks/useScoreData';
import { ScoreGaugeCard } from './ScoreGaugeCard';
import { SideScoreCard } from './SideScoreCard';
import { InsightCarousel } from './InsightCarousel';
import { TrendSparkline } from './TrendSparkline';
import { MetricSelectorModal } from './MetricSelectorModal';

interface RightDetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  viewMode: ViewMode;
  geography: SelectedGeography | null;
  geoLevel: GeoLevel;
}

interface MarketFactor {
  id: string;
  label: string;
  metricId: string;
}

// Default market factors - Risk Level removed per user request
const DEFAULT_MARKET_FACTORS: MarketFactor[] = [
  { id: 'appreciation', label: 'Appreciation', metricId: 'home_value_yoy' },
  { id: 'yield', label: 'Yield Potential', metricId: 'cap_rate' },
  { id: 'demand', label: 'Demand', metricId: 'pending_ratio' },
  { id: 'inventory', label: 'Inventory Change', metricId: 'inventory_yoy' },
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
}: RightDetailPanelProps) {
  const [selectedScoreType, setSelectedScoreType] = useState<ScoreType>(
    viewMode === 'investor' ? 'investoredge' : 'homeready'
  );

  const { data: scoreData, loading: scoresLoading } = useScoreData(
    geoLevel as any,
    geography?.id ?? null,
    { expanded: true }
  );

  const [metricData, setMetricData] = useState<Record<string, { value: number | null; trend: number | null; sparklineData: number[] }>>({});
  const [marketFactors, setMarketFactors] = useState<MarketFactor[]>(loadMarketFactors);
  const [factorsLoading, setFactorsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  // Fetch real-time metric data for factors (current value only, sparklines come from hook)
  useEffect(() => {
    if (!geography || !isOpen) return;

    async function fetchMetrics() {
      setFactorsLoading(true);
      const ids = [...new Set(marketFactors.map(f => f.metricId))];
      const results: Record<string, { value: number | null; trend: number | null; sparklineData: number[] }> = {};

      const now = new Date();
      const endDate = now.toISOString().split('T')[0];
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      const startDate = threeMonthsAgo.toISOString().split('T')[0];

      await Promise.all(ids.map(async (id) => {
        try {
          const res = await timeSeriesApi.getTimeSeries(id, geoLevel, geography!.id, startDate, endDate);
          if (res.success && res.data.length > 0) {
            // Sort by date ascending for sparkline (oldest first)
            const sortedAsc = [...res.data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const sparklineData = sortedAsc.map(d => d.value);

            // Get current and previous for trend calculation
            const current = sortedAsc[sortedAsc.length - 1].value;
            const first = sortedAsc[0].value;
            const trend = first !== 0 ? ((current - first) / Math.abs(first)) * 100 : null;

            results[id] = { value: current, trend, sparklineData };
          } else {
            results[id] = { value: null, trend: null, sparklineData: [] };
          }
        } catch {
          results[id] = { value: null, trend: null, sparklineData: [] };
        }
      }));

      setMetricData(results);
      setFactorsLoading(false);
    }

    fetchMetrics();
  }, [geography, geoLevel, isOpen, marketFactors]);

  // Handle saving market factors from modal
  const handleSaveFactors = (factors: MarketFactor[]) => {
    setMarketFactors(factors);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(factors));
    }
  };

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
          <div
            className="bg-surface-container-low rounded-2xl p-4 border border-outline-variant"
            onDoubleClick={() => setIsModalOpen(true)}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-bold text-on-surface">Market Factors</h4>
                <p className="text-[10px] text-on-surface-variant mt-0.5">Key elements influencing the score</p>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="text-[9px] text-on-surface-variant bg-surface-container px-2 py-1 rounded hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                Double click to edit
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {marketFactors.map((factor) => {
                const data = metricData[factor.metricId];
                const hasSparkline = data?.sparklineData && data.sparklineData.length >= 2;
                const trendDirection = data?.trend != null
                  ? (data.trend > 0.5 ? 'up' : data.trend < -0.5 ? 'down' : 'stable')
                  : 'stable';

                return (
                  <div key={factor.id} className="bg-surface rounded-xl p-3 border border-outline-variant flex items-center gap-2">
                    {/* Sparkline or trend icon */}
                    <div className="w-12 h-8 flex items-center justify-center flex-shrink-0">
                      {hasSparkline ? (
                        <TrendSparkline
                          data={data.sparklineData}
                          width={48}
                          height={20}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/5">
                          {trendDirection === 'up' ? (
                            <TrendingUp className="w-4 h-4 text-green-600" />
                          ) : trendDirection === 'down' ? (
                            <TrendingDown className="w-4 h-4 text-red-500" />
                          ) : (
                            <TrendingUp className="w-4 h-4 text-on-surface-variant" />
                          )}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
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

      {/* Metric Selector Modal */}
      <MetricSelectorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentFactors={marketFactors}
        onSave={handleSaveFactors}
        maxSelections={4}
      />
    </>
  );
}
