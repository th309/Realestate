'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { api, ScoreResponse } from '@/lib/api/client';
import { GeoLevel, getMetricConfig } from '@/app/map/config/metrics';
import { getMetricCategories } from '@/app/map/config/metric-categories';
import { formatValue, getMetricFormat } from '@/app/map/utils/metricUtils';
import { M3Card } from './M3Card';
import { Loader2, TrendingUp, TrendingDown, Minus, Settings, Check, X } from 'lucide-react';

interface ScoreCardsProps {
  geoLevel: GeoLevel;
  selectedArea: string;
  isAdmin?: boolean;
}

interface CircularProgressProps {
  value: number;
  maxValue?: number;
  size?: number;
  strokeWidth?: number;
  backgroundColor?: string;
}

// Calculate color on a gradient from red (0) to green (100)
const getScoreColor = (value: number, maxValue: number = 100): string => {
  const percentage = Math.min(Math.max(value / maxValue, 0), 1);
  const hue = percentage * 120;
  return `hsl(${hue}, 70%, 45%)`;
};

// Get letter grade from score
const getLetterGrade = (score: number): string => {
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B-';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  if (score >= 70) return 'C-';
  if (score >= 67) return 'D+';
  if (score >= 63) return 'D';
  if (score >= 60) return 'D-';
  return 'F';
};

// Get grade badge color
const getGradeColor = (grade: string): { bg: string; text: string } => {
  const letter = grade.charAt(0);
  switch (letter) {
    case 'A': return { bg: 'bg-green-500', text: 'text-white' };
    case 'B': return { bg: 'bg-emerald-500', text: 'text-white' };
    case 'C': return { bg: 'bg-yellow-500', text: 'text-white' };
    case 'D': return { bg: 'bg-orange-500', text: 'text-white' };
    default: return { bg: 'bg-red-500', text: 'text-white' };
  }
};

// Get score label
const getScoreLabel = (score: number): string => {
  if (score >= 90) return 'EXCELLENT';
  if (score >= 80) return 'GREAT';
  if (score >= 70) return 'GOOD';
  if (score >= 60) return 'FAIR';
  if (score >= 50) return 'AVERAGE';
  if (score >= 40) return 'BELOW AVG';
  if (score >= 20) return 'POOR';
  return 'VERY POOR';
};

const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  maxValue = 100,
  size = 100,
  strokeWidth = 6,
  backgroundColor = '#e5e7eb',
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min(value / maxValue, 1);
  const strokeDashoffset = circumference - percentage * circumference;
  const strokeColor = getScoreColor(value, maxValue);
  const grade = getLetterGrade(value);
  const gradeColors = getGradeColor(grade);
  const label = getScoreLabel(value);

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={backgroundColor} strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={strokeColor} strokeWidth={strokeWidth}
          strokeLinecap="round" strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-on-surface leading-none">
          {Math.round(value)}
        </span>
        <span className={`mt-1 px-1.5 py-0.5 text-[9px] font-bold rounded ${gradeColors.bg} ${gradeColors.text}`}>
          {grade}
        </span>
        <span className="mt-0.5 text-[8px] text-on-surface-variant uppercase tracking-wider">
          {label}
        </span>
      </div>
    </div>
  );
};

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
}

const SubScoreDisplay: React.FC<SubScoreDisplayProps> = ({ label, formattedValue, trend, loading }) => {
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
        {label}
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

// Available metrics for selection
interface AvailableMetric {
  id: string;
  name: string;
  category: string;
}

function getAvailableMetrics(): AvailableMetric[] {
  const categories = [
    ...getMetricCategories('homebuyer'),
    ...getMetricCategories('investor'),
  ];

  const seen = new Set<string>();
  const metrics: AvailableMetric[] = [];

  for (const cat of categories) {
    if (cat.isDivider || !cat.metrics) continue;
    for (const m of cat.metrics) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        metrics.push({ id: m.id, name: m.name, category: cat.name });
      }
    }
  }

  return metrics.sort((a, b) => a.name.localeCompare(b.name));
}

interface MetricSelectorProps {
  selectedMetrics: string[];
  onSave: (metrics: string[]) => void;
  onCancel: () => void;
  maxSelections?: number;
}

const MetricSelector: React.FC<MetricSelectorProps> = ({
  selectedMetrics,
  onSave,
  onCancel,
  maxSelections = 3,
}) => {
  const [selected, setSelected] = useState<string[]>(selectedMetrics);
  const availableMetrics = getAvailableMetrics();

  const groupedMetrics = availableMetrics.reduce((acc, m) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {} as Record<string, AvailableMetric[]>);

  const toggleMetric = (metricId: string) => {
    if (selected.includes(metricId)) {
      setSelected(selected.filter(id => id !== metricId));
    } else if (selected.length < maxSelections) {
      setSelected([...selected, metricId]);
    }
  };

  return (
    <div className="absolute top-0 left-0 right-0 bg-surface-container-high border border-outline-variant rounded-xl shadow-lg z-10 p-3 max-h-[300px] overflow-y-auto">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-on-surface">
          Select up to {maxSelections} metrics ({selected.length}/{maxSelections})
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => onSave(selected)}
            className="p-1 rounded-full hover:bg-surface-container text-green-600 transition-colors"
            title="Save"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={onCancel}
            className="p-1 rounded-full hover:bg-surface-container text-red-500 transition-colors"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {Object.entries(groupedMetrics).map(([category, metrics]) => (
          <div key={category}>
            <div className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wide mb-1">
              {category}
            </div>
            <div className="flex flex-wrap gap-1">
              {metrics.map(m => (
                <button
                  key={m.id}
                  onClick={() => toggleMetric(m.id)}
                  disabled={!selected.includes(m.id) && selected.length >= maxSelections}
                  className={`px-2 py-0.5 text-[10px] rounded-full border transition-colors ${
                    selected.includes(m.id)
                      ? 'bg-primary text-on-primary border-primary'
                      : 'bg-surface border-outline-variant text-on-surface hover:bg-surface-container disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
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
        />
      )}

      <div className="flex items-start gap-4">
        <div className="flex flex-col items-center">
          {loading ? (
            <div className="w-[100px] h-[100px] flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-on-surface-variant animate-spin" />
            </div>
          ) : (
            <CircularProgress
              value={value}
              maxValue={maxValue}
              size={100}
              strokeWidth={6}
              backgroundColor="#e5e7eb"
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
const DEFAULT_HOMEREADY_METRICS = ['home_value_yoy', 'days_on_market', 'for_sale_inventory'];
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
  const [scores, setScores] = useState<ScoreResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricSelections, setMetricSelections] = useState<MetricSelections>(loadMetricSelections);
  const [metricData, setMetricData] = useState<Record<string, TrendData>>({});

  // Fetch scores
  useEffect(() => {
    let isMounted = true;

    async function fetchScores() {
      try {
        setLoading(true);
        const response = await api.getScore(geoLevel, selectedArea);
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

  // Fetch time series data for selected metrics to compute trends
  useEffect(() => {
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

      // Calculate date range: last 4 months of data to ensure we have 3 months of history
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 4);
      const startDateStr = startDate.toISOString().split('T')[0];

      // Fetch each metric's time series in parallel
      await Promise.all(
        uniqueMetricIds.map(async (metricId) => {
          try {
            const response = await api.getTimeSeries(
              metricId,
              geoLevel,
              selectedArea,
              startDateStr,
              endDate
            );

            if (response.success && response.data.length > 0) {
              trends[metricId] = calculateTrend(response.data);
            } else {
              trends[metricId] = { currentValue: null, previousValue: null, changePercent: null, direction: null };
            }
          } catch (err) {
            console.error(`Failed to fetch time series for ${metricId}:`, err);
            trends[metricId] = { currentValue: null, previousValue: null, changePercent: null, direction: null };
          }
        })
      );

      if (isMounted) {
        setMetricData(trends);
        setMetricsLoading(false);
      }
    }

    if (selectedArea) {
      fetchMetricTrends();
    }

    return () => { isMounted = false; };
  }, [geoLevel, selectedArea, metricSelections]);

  // Convert metric IDs to indicators with formatted values and trends
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

  // Score values
  const homereadyScore = scores?.homereadyScore ?? 0;
  const investoredgeScore = scores?.investoredgeScore ?? 0;
  const marketHealthScore = scores?.components?.homeready?.marketHealth ?? 0;
  const confidence = scores?.confidenceLevel ?? 'medium';
  const confidenceLabel = confidence === 'high' ? 'HIGH' : confidence === 'low' ? 'LOW' : 'MEDIUM';

  return (
    <div className="flex flex-col gap-3">
      <ScoreCard
        title="HomeReady Score"
        value={homereadyScore}
        confidence={confidenceLabel}
        indicators={getIndicatorsForMetrics(metricSelections.homeready)}
        loading={loading}
        metricsLoading={metricsLoading}
        isAdmin={isAdmin}
        selectedMetricIds={metricSelections.homeready}
        onMetricsChange={handleMetricsChange('homeready')}
      />
      <ScoreCard
        title="InvestorEdge Score"
        value={investoredgeScore}
        confidence={confidenceLabel}
        indicators={getIndicatorsForMetrics(metricSelections.investoredge)}
        loading={loading}
        metricsLoading={metricsLoading}
        isAdmin={isAdmin}
        selectedMetricIds={metricSelections.investoredge}
        onMetricsChange={handleMetricsChange('investoredge')}
      />
      <ScoreCard
        title="Market Health Index"
        value={marketHealthScore}
        confidence={confidenceLabel}
        indicators={getIndicatorsForMetrics(metricSelections.markethealth)}
        loading={loading}
        metricsLoading={metricsLoading}
        isAdmin={isAdmin}
        selectedMetricIds={metricSelections.markethealth}
        onMetricsChange={handleMetricsChange('markethealth')}
      />
    </div>
  );
};
