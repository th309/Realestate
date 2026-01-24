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

import { useEffect, useState, useMemo } from 'react';
import { X, TrendingUp } from 'lucide-react';
import type { ViewMode, SelectedGeography, GeoLevel } from '../../types';
import { getMetricConfig, getMetricFormat, SCORE_COMPONENTS } from '../../config/metrics';
import { formatValue } from '../../utils/metricUtils';
import { useDataCardBatch, DataCardResult } from '../../hooks/useDataCard';
import { ScoreGaugeCard } from './ScoreGaugeCard';
import { SideScoreCard } from './SideScoreCard';
import { InsightCarousel } from './InsightCarousel';
import type { ScoreType } from '../../hooks/useScoreData';

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

  const [marketFactors] = useState<MarketFactor[]>(loadMarketFactors);
  const regionId = geography?.id || '';

  // 1. Fetch all 3 scores for the panel with 3-month trend/history
  const scoreResults = useDataCardBatch(
    ['homeready', 'investoredge', 'markethealth'],
    geoLevel,
    regionId,
    true // showTrend = true fetches historical data
  );

  // 2. Fetch components for the SELECTED score
  const selectedComponents = useMemo(() => {
    const key = selectedScoreType === 'market_health' ? 'market_health' : selectedScoreType;
    return SCORE_COMPONENTS[key] || [];
  }, [selectedScoreType]);

  const componentResults = useDataCardBatch(
    selectedComponents,
    geoLevel,
    regionId,
    true
  );

  // 3. Fetch default market factors
  const factorIds = useMemo(() => marketFactors.map(f => f.metricId), [marketFactors]);
  const factorResults = useDataCardBatch(
    factorIds,
    geoLevel,
    regionId,
    true
  );

  // Transform scores for easier access
  const scores = useMemo(() => {
    return {
      homeready: scoreResults['homeready'],
      investoredge: scoreResults['investoredge'],
      market_health: scoreResults['markethealth'],
    };
  }, [scoreResults]);

  // Transform indicators for ScoreGaugeCard
  const indicators = useMemo(() => {
    return selectedComponents.map(id => {
      const res = componentResults[id];
      const config = getMetricConfig(id);
      return {
        metricId: id,
        label: config?.title || id,
        formattedValue: res?.formattedValue || '--',
        trend: {
          direction: res?.trend?.direction || null,
          label: res?.trend?.label || null,
        },
        history: res?.trendHistory || [],
      };
    });
  }, [selectedComponents, componentResults]);

  // Sync selected score with viewMode when it changes externally
  useEffect(() => {
    setSelectedScoreType(viewMode === 'investor' ? 'investoredge' : 'homeready');
  }, [viewMode]);

  // Determine which scores go where
  const scoreLayout = useMemo(() => {
    const types: ScoreType[] = ['investoredge', 'homeready', 'market_health'];
    const otherTypes = types.filter(t => t !== selectedScoreType);

    // Side 1 (Top) and Side 2 (Bottom) placement logic
    let side1 = otherTypes[0];
    let side2 = otherTypes[1];

    if (side2 === 'investoredge' || side2 === 'homeready') {
      [side1, side2] = [side2, side1];
    }

    return { main: selectedScoreType, side1, side2 };
  }, [selectedScoreType]);

  const getScoreData = (type: ScoreType) => scores[type];
  const getScoreValue = (type: ScoreType) => scores[type]?.value ?? null;
  const getScoreTrend = (type: ScoreType) => scores[type]?.trend ?? null;
  const getScoreHistory = (type: ScoreType) => scores[type]?.trendHistory ?? [];

  const scoresLoading = Object.values(scoreResults).some(r => r.loading);
  const factorsLoading = Object.values(factorResults).some(r => r.loading);

  if (!isOpen || !geography) return null;

  return (
    <>
      {/* Scrim - Mobile only */}
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
          <div className="flex flex-col lg:flex-row gap-3 items-stretch">
            <div className="flex-1">
              <ScoreGaugeCard
                type={scoreLayout.main}
                score={getScoreValue(scoreLayout.main)}
                trend={getScoreTrend(scoreLayout.main)}
                history={getScoreHistory(scoreLayout.main)}
                indicators={indicators}
                loading={scoresLoading}
              />
            </div>

            <div className="w-full lg:w-[230px] flex flex-col gap-3">
              <SideScoreCard
                type={scoreLayout.side1}
                score={getScoreValue(scoreLayout.side1)}
                trend={getScoreTrend(scoreLayout.side1)?.changePercent}
                history={getScoreHistory(scoreLayout.side1)}
                onClick={() => setSelectedScoreType(scoreLayout.side1)}
                isActive={selectedScoreType === scoreLayout.side1}
                loading={scoresLoading}
                className="flex-1"
              />
              <SideScoreCard
                type={scoreLayout.side2}
                score={getScoreValue(scoreLayout.side2)}
                trend={getScoreTrend(scoreLayout.side2)?.changePercent}
                history={getScoreHistory(scoreLayout.side2)}
                onClick={() => setSelectedScoreType(scoreLayout.side2)}
                isActive={selectedScoreType === scoreLayout.side2}
                loading={scoresLoading}
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
            </div>

            <div className="grid grid-cols-2 gap-2">
              {marketFactors.map((factor) => {
                const res = factorResults[factor.metricId];
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
                        {factorsLoading ? '...' : res?.formattedValue || '--'}
                        {res?.trend?.changePercent != null && (
                          <span className={`text-[9px] font-normal ml-1 ${res.trend.direction === 'up' ? 'text-green-600' : 'text-red-500'}`}>
                            {res.trend.label}
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
