'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { fetchScore, type GeoLevel, type ScoreResponse, getMetricConfig } from '@/lib/data';
import { M3Card } from './M3Card';
import { Loader2, TrendingUp, TrendingDown, Minus, Settings } from 'lucide-react';
import { useScoreCardMetrics } from '../hooks/useScoreCardMetrics';
import { ScoreDisplay } from '@/app/components/scoring/ScoreDisplay';
import { MetricSelector } from '@/app/map/components/MetricSelector';
import { useEntitlements } from '@/lib/entitlements';
import { ScorePaywall } from '@/components/entitlements';
import { MetricTitle } from '@/app/components/MetricTitle';

interface ScoreCardsProps {
  geoLevel: GeoLevel;
  selectedArea: string;
  isAdmin?: boolean;
}

interface TrendData {
  currentValue: number | null;
  previousValue: number | null;
  changePercent: number | null;
  direction: 'up' | 'down' | 'flat' | null;
}

interface SubScoreDisplayProps {
  label: string;
  formattedValue: string;
  trend: TrendData;
  loading?: boolean;
  metricId?: string;
}

const SubScoreDisplay: React.FC<SubScoreDisplayProps> = ({ label, formattedValue, trend, loading, metricId }) => {
  const getTrendIcon = () => {
    if (trend.direction === 'up') return <TrendingUp className="w-3 h-3" />;
    if (trend.direction === 'down') return <TrendingDown className="w-3 h-3" />;
    if (trend.direction === 'flat') return <Minus className="w-3 h-3" />;
    return null;
  };

  const getTrendColor = () => {
    if (trend.direction === 'up') return 'text-green-600';
    if (trend.direction === 'down') return 'text-red-500';
    return 'text-on-surface-variant';
  };

  const getTrendLabel = () => {
    if (trend.changePercent === null) return null;
    const sign = trend.changePercent > 0 ? '+' : '';
    return `${sign}${trend.changePercent.toFixed(1)}%`;
  };

  return (
    <div className="flex flex-col items-center flex-1 min-w-0">
      <span className="text-[11px] text-on-surface-variant mb-1 truncate max-w-full" title={label}>
        {metricId ? <MetricTitle metricId={metricId} /> : label}
      </span>
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-on-surface-variant" />
      ) : (
        <>
          <span className="text-sm font-semibold text-on-surface">{formattedValue}</span>
          {trend.direction && (
            <div className={`flex items-center gap-0.5 mt-0.5 ${getTrendColor()}`}>
              {getTrendIcon()}
              <span className="text-[10px] font-medium">{getTrendLabel()}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};


interface MetricIndicator {
  metricId: string;
  label: string;
  formattedValue: string;
  trend: TrendData;
}

interface ScoreCardProps {
  title: string;
  value: number;
  confidence: string;
  maxValue?: number;
  indicators: MetricIndicator[];
  loading?: boolean;
  metricsLoading?: boolean;
  isAdmin?: boolean;
  selectedMetricIds: string[];
  onMetricsChange?: (metricIds: string[]) => void;
  geoLevel: GeoLevel;
}

const ScoreCard: React.FC<ScoreCardProps> = ({
  title,
  value,
  confidence,
  maxValue = 100,
  indicators,
  loading = false,
  metricsLoading = false,
  isAdmin = false,
  selectedMetricIds,
  onMetricsChange,
  geoLevel,
}) => {
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = (metricIds: string[]) => {
    setIsEditing(false);
    onMetricsChange?.(metricIds);
  };

  return (
    <M3Card variant="elevated" size="sm" className="flex-1 relative">
      {isEditing && (
        <MetricSelector
          selectedMetrics={selectedMetricIds}
          onSave={handleSave}
          onCancel={() => setIsEditing(false)}
          maxSelections={3}
          geoLevel={geoLevel}
          className="absolute top-0 left-0 right-0 z-10 max-h-[400px]"
        />
      )}

      <div className="flex items-start gap-4">
        <div className="flex flex-col items-center">
          {loading ? (
            <div className="w-[100px] h-[100px] flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-on-surface-variant animate-spin" />
            </div>
          ) : (
            <ScoreDisplay
              value={value}
              maxValue={maxValue}
              size={100}
              strokeWidth={6}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-sm font-semibold text-on-surface truncate">
              {title}
            </h4>
            {!loading && isAdmin && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
                title="Configure displayed metrics"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {!loading && (
            <div className="text-[10px] text-on-surface-variant mb-2">
              Confidence: <span className="font-medium">{confidence}</span>
            </div>
          )}

          {!loading && (
            <div className="flex items-start justify-between gap-2">
              {indicators.map((ind) => (
                <SubScoreDisplay
                  key={ind.metricId}
                  label={ind.label}
                  metricId={ind.metricId}
                  formattedValue={ind.formattedValue}
                  trend={ind.trend}
                  loading={metricsLoading}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </M3Card>
  );
};

// Default metric selections
const DEFAULT_HOMEREADY_METRICS = ['listing_price', 'days_on_market', 'for_sale_inventory'];
const DEFAULT_INVESTOREDGE_METRICS = ['cap_rate', 'rent_index', 'pending_ratio'];
const DEFAULT_MARKETHEALTH_METRICS = ['hotness_score', 'inventory_yoy', 'new_listings_yoy'];

const STORAGE_KEY = 'scorecard-metric-selections';

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

  // Sort by date descending (most recent first)
  const sorted = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const currentValue = sorted[0].value;

  // Find value from approximately 3 months ago
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  // Find the closest data point to 3 months ago
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

  // If no previous value found, use the oldest available
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

export const ScoreCards: React.FC<ScoreCardsProps> = ({
  geoLevel,
  selectedArea,
  isAdmin = false,
}) => {
  const { canAccess } = useEntitlements();
  const canViewHomeready = canAccess('metric', 'homeready_score');
  const canViewInvestoredge = canAccess('metric', 'investoredge_score');
  const canViewMarketHealth = canAccess('metric', 'market_health_score');
  const canViewAnyScore = canViewHomeready || canViewInvestoredge || canViewMarketHealth;
  const [scores, setScores] = useState<ScoreResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [metricSelections, setMetricSelections] = useState<MetricSelections>(loadMetricSelections);

  // Use the new data binding hooks for metric data (replaces manual fetch)
  const homereadyMetrics = useScoreCardMetrics({
    metricIds: metricSelections.homeready,
    geoLevel,
    regionId: selectedArea,
  });
  const investoredgeMetrics = useScoreCardMetrics({
    metricIds: metricSelections.investoredge,
    geoLevel,
    regionId: selectedArea,
  });
  const markethealthMetrics = useScoreCardMetrics({
    metricIds: metricSelections.markethealth,
    geoLevel,
    regionId: selectedArea,
  });

  // Per-score loading: each card only waits for its own metrics
  const homereadyMetricsLoading = homereadyMetrics.loading;
  const investoredgeMetricsLoading = investoredgeMetrics.loading;
  const markethealthMetricsLoading = markethealthMetrics.loading;

  // Fetch scores
  useEffect(() => {
    let isMounted = true;

    if (!selectedArea || geoLevel === 'state' || geoLevel === 'national') {
      setScores(null);
      setLoading(false);
      return;
    }

    async function fetchScores() {
      try {
        setLoading(true);
        const response = await fetchScore(geoLevel, selectedArea);
        if (isMounted) {
          setScores(response);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch scores:', err);
        if (isMounted) setLoading(false);
      }
    }

    fetchScores();
    return () => { isMounted = false; };
  }, [geoLevel, selectedArea]);

  // getIndicatorsForMetrics now just returns the indicators from the hook
  // The hook handles all data fetching, formatting, and trend calculation
  const getIndicatorsForMetrics = useCallback((scoreType: 'homeready' | 'investoredge' | 'markethealth'): MetricIndicator[] => {
    const metricsData = {
      homeready: homereadyMetrics,
      investoredge: investoredgeMetrics,
      markethealth: markethealthMetrics,
    }[scoreType];

    return metricsData.indicators.map(ind => ({
      metricId: ind.metricId,
      label: ind.label,
      formattedValue: ind.formattedValue,
      trend: ind.trend,
    }));
  }, [homereadyMetrics, investoredgeMetrics, markethealthMetrics]);

  // Handlers for metric selection changes
  const handleMetricsChange = useCallback((scoreType: keyof MetricSelections) => (metricIds: string[]) => {
    const newSelections = { ...metricSelections, [scoreType]: metricIds };
    setMetricSelections(newSelections);
    saveMetricSelections(newSelections);
  }, [metricSelections]);

  // Score values
  const homereadyScore = scores?.scores?.homeready?.score ?? 0;
  const investoredgeScore = scores?.scores?.investoredge?.score ?? 0;
  const marketHealthScore = scores?.scores?.markethealth?.score ?? 0;
  const confidenceLabel = scores?.scores?.homeready?.confidence_level ?? 'MEDIUM';

  const scoresUnavailable = geoLevel === 'state' || geoLevel === 'national';

  if (!canViewAnyScore) {
    return (
      <div className="flex flex-col gap-3">
        <ScorePaywall />
      </div>
    );
  }

  if (scoresUnavailable) {
    return (
      <div className="flex flex-col gap-3">
        <M3Card className="p-6 text-center">
          <div className="text-sm font-medium text-on-surface-variant mb-1">Scores Unavailable</div>
          <p className="text-xs text-on-surface-variant/70">
            Scores are available at the metro, county, and zip level where they are most predictive. Select a more specific geography to see scores.
          </p>
        </M3Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {canViewHomeready && (
        <ScoreCard
          title="HomeReady Score"
          value={homereadyScore}
          confidence={confidenceLabel}
          indicators={getIndicatorsForMetrics('homeready')}
          loading={loading}
          metricsLoading={homereadyMetricsLoading}
          isAdmin={isAdmin}
          selectedMetricIds={metricSelections.homeready}
          onMetricsChange={handleMetricsChange('homeready')}
          geoLevel={geoLevel}
        />
      )}
      {canViewInvestoredge && (
        <ScoreCard
          title="InvestorEdge Score"
          value={investoredgeScore}
          confidence={confidenceLabel}
          indicators={getIndicatorsForMetrics('investoredge')}
          loading={loading}
          metricsLoading={investoredgeMetricsLoading}
          isAdmin={isAdmin}
          selectedMetricIds={metricSelections.investoredge}
          onMetricsChange={handleMetricsChange('investoredge')}
          geoLevel={geoLevel}
        />
      )}
      {canViewMarketHealth && (
        <ScoreCard
          title="Market Health Index"
          value={marketHealthScore}
          confidence={confidenceLabel}
          indicators={getIndicatorsForMetrics('markethealth')}
          loading={loading}
          metricsLoading={markethealthMetricsLoading}
          isAdmin={isAdmin}
          selectedMetricIds={metricSelections.markethealth}
          onMetricsChange={handleMetricsChange('markethealth')}
          geoLevel={geoLevel}
        />
      )}
    </div>
  );
};
