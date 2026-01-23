'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { api, ScoreResponse } from '@/lib/api/client';
import { GeoLevel, getMetricConfig } from '@/app/map/config/metrics';
import { getMetricCategories } from '@/app/map/config/metric-categories';
import { M3Card } from './M3Card';
import { Loader2, ArrowUp, ArrowDown, ArrowRight, Settings, Check, X } from 'lucide-react';

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
  // Map 0-100 to hue 0-120 (red to green in HSL)
  const hue = percentage * 120;
  // Use saturation 70% and lightness 45% for vibrant but not too bright colors
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

// Get grade badge color (5-point scale: A=green to F=red)
const getGradeColor = (grade: string): { bg: string; text: string } => {
  const letter = grade.charAt(0);
  switch (letter) {
    case 'A':
      return { bg: 'bg-green-500', text: 'text-white' };
    case 'B':
      return { bg: 'bg-emerald-500', text: 'text-white' };
    case 'C':
      return { bg: 'bg-yellow-500', text: 'text-white' };
    case 'D':
      return { bg: 'bg-orange-500', text: 'text-white' };
    case 'F':
    default:
      return { bg: 'bg-red-500', text: 'text-white' };
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
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {/* Center content: score, grade badge, label */}
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

interface SubScoreDisplayProps {
  label: string;
  value: number;
}

const SubScoreDisplay: React.FC<SubScoreDisplayProps> = ({ label, value }) => {
  const getTrendIcon = (val: number) => {
    if (val >= 55) return <ArrowUp className="w-3 h-3" />;
    if (val <= 45) return <ArrowDown className="w-3 h-3" />;
    return <ArrowRight className="w-3 h-3" />;
  };

  const getTrendColor = (val: number) => {
    if (val >= 55) return 'text-green-600';
    if (val <= 45) return 'text-red-500';
    return 'text-on-surface-variant';
  };

  return (
    <div className="flex flex-col items-center flex-1 min-w-0">
      <span className="text-[11px] text-on-surface-variant mb-1 truncate max-w-full" title={label}>
        {label}
      </span>
      <div className={`flex items-center gap-0.5 ${getTrendColor(value)}`}>
        <span className="text-sm font-semibold">{Math.round(value)}</span>
        {getTrendIcon(value)}
      </div>
    </div>
  );
};

// Available metrics for selection (flattened from categories)
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
        metrics.push({
          id: m.id,
          name: m.name,
          category: cat.name,
        });
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

  // Group by category
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

interface ScoreCardProps {
  title: string;
  value: number;
  maxValue?: number;
  indicators: { label: string; value: number; metricId?: string }[];
  loading?: boolean;
  isAdmin?: boolean;
  selectedMetricIds: string[];
  onMetricsChange?: (metricIds: string[]) => void;
}

const ScoreCard: React.FC<ScoreCardProps> = ({
  title,
  value,
  maxValue = 100,
  indicators,
  loading = false,
  isAdmin = false,
  selectedMetricIds,
  onMetricsChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = (metricIds: string[]) => {
    setIsEditing(false);
    onMetricsChange?.(metricIds);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  return (
    <M3Card variant="elevated" size="sm" className="flex-1 relative">
      {isEditing && (
        <MetricSelector
          selectedMetrics={selectedMetricIds}
          onSave={handleSave}
          onCancel={handleCancel}
          maxSelections={3}
        />
      )}

      <div className="flex items-start gap-4">
        {/* Left: Circular Progress with score, grade, and label inside */}
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

        {/* Right: Title and Sub-scores */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3">
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
            <div className="flex items-center justify-between gap-2">
              {indicators.map((ind, idx) => (
                <SubScoreDisplay
                  key={ind.metricId || idx}
                  label={ind.label}
                  value={ind.value}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </M3Card>
  );
};

// Default metric selections for each score type
const DEFAULT_HOMEREADY_METRICS = ['home_value_yoy', 'days_on_market', 'for_sale_inventory'];
const DEFAULT_INVESTOREDGE_METRICS = ['cap_rate', 'rent_index', 'pending_ratio'];
const DEFAULT_MARKETHEALTH_METRICS = ['hotness_score', 'inventory_yoy', 'new_listings_yoy'];

// Storage key for persisting metric selections
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
    if (stored) {
      return JSON.parse(stored);
    }
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

export const ScoreCards: React.FC<ScoreCardsProps> = ({
  geoLevel,
  selectedArea,
  isAdmin = false,
}) => {
  const [scores, setScores] = useState<ScoreResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metricSelections, setMetricSelections] = useState<MetricSelections>(loadMetricSelections);

  useEffect(() => {
    let isMounted = true;

    async function fetchScores() {
      try {
        setLoading(true);
        setError(null);

        const response = await api.getScore(geoLevel, selectedArea);

        if (isMounted) {
          setScores(response);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch scores:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch scores');
          setLoading(false);
        }
      }
    }

    fetchScores();

    return () => {
      isMounted = false;
    };
  }, [geoLevel, selectedArea]);

  // Convert metric IDs to display indicators with values
  const getIndicatorsForMetrics = useCallback((metricIds: string[]): { label: string; value: number; metricId: string }[] => {
    return metricIds.map(id => {
      const config = getMetricConfig(id);
      const label = config?.title || id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

      // Get value from scores components or use placeholder
      // In a real implementation, you'd fetch actual metric values
      let value = 50; // Default placeholder

      // Map some known metrics to score components
      if (scores?.components) {
        const componentMap: Record<string, number | undefined> = {
          'affordability': scores.components.homeready?.affordability,
          'home_value_yoy': scores.components.homeready?.valueGrowth,
          'for_sale_inventory': scores.components.homeready?.inventoryHealth,
          'cap_rate': scores.components.investoredge?.cashFlow,
          'rent_index': scores.components.investoredge?.appreciation,
          'pending_ratio': scores.components.investoredge?.marketLiquidity,
          'hotness_score': scores.components.investoredge?.demandRisk,
          'days_on_market': scores.components.homeready?.marketHealth,
        };

        if (componentMap[id] !== undefined) {
          value = componentMap[id] ?? 50;
        }
      }

      return { label, value, metricId: id };
    });
  }, [scores]);

  // Handlers for metric selection changes
  const handleHomereadyMetricsChange = useCallback((metricIds: string[]) => {
    const newSelections = { ...metricSelections, homeready: metricIds };
    setMetricSelections(newSelections);
    saveMetricSelections(newSelections);
  }, [metricSelections]);

  const handleInvestoredgeMetricsChange = useCallback((metricIds: string[]) => {
    const newSelections = { ...metricSelections, investoredge: metricIds };
    setMetricSelections(newSelections);
    saveMetricSelections(newSelections);
  }, [metricSelections]);

  const handleMarketHealthMetricsChange = useCallback((metricIds: string[]) => {
    const newSelections = { ...metricSelections, markethealth: metricIds };
    setMetricSelections(newSelections);
    saveMetricSelections(newSelections);
  }, [metricSelections]);

  // Default values when loading or error
  const homereadyScore = scores?.homereadyScore ?? 0;
  const investoredgeScore = scores?.investoredgeScore ?? 0;
  const marketHealthIndex = scores?.components?.homeready?.marketHealth ?? 0;

  // Get indicators based on selected metrics
  const homereadyIndicators = getIndicatorsForMetrics(metricSelections.homeready);
  const investoredgeIndicators = getIndicatorsForMetrics(metricSelections.investoredge);
  const marketHealthIndicators = getIndicatorsForMetrics(metricSelections.markethealth);

  return (
    <div className="flex flex-col gap-3">
      <ScoreCard
        title="HomeReady Score"
        value={homereadyScore}
        indicators={homereadyIndicators}
        loading={loading}
        isAdmin={isAdmin}
        selectedMetricIds={metricSelections.homeready}
        onMetricsChange={handleHomereadyMetricsChange}
      />
      <ScoreCard
        title="InvestorEdge Score"
        value={investoredgeScore}
        indicators={investoredgeIndicators}
        loading={loading}
        isAdmin={isAdmin}
        selectedMetricIds={metricSelections.investoredge}
        onMetricsChange={handleInvestoredgeMetricsChange}
      />
      <ScoreCard
        title="Market Health Index"
        value={marketHealthIndex}
        indicators={marketHealthIndicators}
        loading={loading}
        isAdmin={isAdmin}
        selectedMetricIds={metricSelections.markethealth}
        onMetricsChange={handleMarketHealthMetricsChange}
      />
    </div>
  );
};
