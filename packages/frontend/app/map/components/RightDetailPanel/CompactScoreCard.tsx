/**
 * CompactScoreCard Component
 *
 * Horizontal score card matching the graphs page design with:
 * - Circular progress gauge with grade badge
 * - Title and confidence indicator
 * - 3 admin-editable sub-score metrics with trends
 *
 * Material Design 3 compliant.
 */

'use client';

import { useState, useCallback, memo } from 'react';
import { Settings, Check, X, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { getMetricCategories } from '../../config/metric-categories';
import { getMetricConfig, type GeoLevel } from '../../config/metrics';
import { formatValue, getMetricFormat } from '../../utils/metricUtils';
import type { ViewMode } from '../../types';

// Calculate color on a gradient from red (0) to green (100) using HSL
function getScoreColor(value: number, maxValue: number = 100): string {
  const percentage = Math.min(Math.max(value / maxValue, 0), 1);
  const hue = percentage * 120;
  return `hsl(${hue}, 70%, 45%)`;
}

// Get letter grade from score
function getLetterGrade(score: number): string {
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
}

// Get grade badge color
function getGradeColor(grade: string): { bg: string; text: string } {
  const letter = grade.charAt(0);
  switch (letter) {
    case 'A': return { bg: 'bg-green-500', text: 'text-white' };
    case 'B': return { bg: 'bg-emerald-500', text: 'text-white' };
    case 'C': return { bg: 'bg-yellow-500', text: 'text-white' };
    case 'D': return { bg: 'bg-orange-500', text: 'text-white' };
    default: return { bg: 'bg-red-500', text: 'text-white' };
  }
}

// Get score label
function getScoreLabel(score: number): string {
  if (score >= 90) return 'EXCELLENT';
  if (score >= 80) return 'GREAT';
  if (score >= 70) return 'GOOD';
  if (score >= 60) return 'FAIR';
  if (score >= 50) return 'AVERAGE';
  if (score >= 40) return 'BELOW AVG';
  if (score >= 20) return 'POOR';
  return 'VERY POOR';
}

interface CircularProgressProps {
  value: number;
  maxValue?: number;
  size?: number;
  strokeWidth?: number;
}

const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  maxValue = 100,
  size = 80,
  strokeWidth = 5,
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
          fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth}
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
        <span className="text-xl font-bold text-on-surface leading-none">
          {Math.round(value)}
        </span>
        <span className={`mt-0.5 px-1.5 py-0.5 text-[8px] font-bold rounded ${gradeColors.bg} ${gradeColors.text}`}>
          {grade}
        </span>
        <span className="mt-0.5 text-[7px] text-on-surface-variant uppercase tracking-wider">
          {label}
        </span>
      </div>
    </div>
  );
};

export interface TrendData {
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
    if (trend.direction === 'up') return <TrendingUp className="w-2.5 h-2.5" />;
    if (trend.direction === 'down') return <TrendingDown className="w-2.5 h-2.5" />;
    if (trend.direction === 'flat') return <Minus className="w-2.5 h-2.5" />;
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
      <span className="text-[9px] text-on-surface-variant mb-0.5 truncate max-w-full" title={label}>
        {label}
      </span>
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin text-on-surface-variant" />
      ) : (
        <>
          <span className="text-xs font-semibold text-on-surface">{formattedValue}</span>
          {trend.direction && (
            <div className={`flex items-center gap-0.5 ${getTrendColor()}`}>
              {getTrendIcon()}
              <span className="text-[8px] font-medium">{getTrendLabel()}</span>
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

function getAvailableMetrics(viewMode: ViewMode): AvailableMetric[] {
  const categories = getMetricCategories(viewMode);
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
  viewMode: ViewMode;
  maxSelections?: number;
}

const MetricSelector: React.FC<MetricSelectorProps> = ({
  selectedMetrics,
  onSave,
  onCancel,
  viewMode,
  maxSelections = 3,
}) => {
  const [selected, setSelected] = useState<string[]>(selectedMetrics);
  const availableMetrics = getAvailableMetrics(viewMode);

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
    <div className="absolute top-0 left-0 right-0 bg-surface-container-high border border-outline-variant rounded-lg shadow-lg z-20 p-2 max-h-[200px] overflow-y-auto">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-medium text-on-surface">
          Select {maxSelections} metrics ({selected.length}/{maxSelections})
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => onSave(selected)}
            className="p-0.5 rounded-full hover:bg-surface-container text-green-600 transition-colors"
            title="Save"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onCancel}
            className="p-0.5 rounded-full hover:bg-surface-container text-red-500 transition-colors"
            title="Cancel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        {Object.entries(groupedMetrics).map(([category, metrics]) => (
          <div key={category}>
            <div className="text-[8px] font-medium text-on-surface-variant uppercase tracking-wide mb-0.5">
              {category}
            </div>
            <div className="flex flex-wrap gap-1">
              {metrics.map(m => (
                <button
                  key={m.id}
                  onClick={() => toggleMetric(m.id)}
                  disabled={!selected.includes(m.id) && selected.length >= maxSelections}
                  className={`px-1.5 py-0.5 text-[9px] rounded-full border transition-colors ${
                    selected.includes(m.id)
                      ? 'bg-primary text-on-primary border-primary'
                      : 'bg-surface border-outline-variant text-on-surface hover:bg-surface-container disabled:opacity-50'
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

export interface MetricIndicator {
  metricId: string;
  label: string;
  formattedValue: string;
  trend: TrendData;
}

export interface CompactScoreCardProps {
  title: string;
  score: number | null;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  indicators: MetricIndicator[];
  loading?: boolean;
  metricsLoading?: boolean;
  isAdmin?: boolean;
  selectedMetricIds: string[];
  viewMode: ViewMode;
  onMetricsChange?: (metricIds: string[]) => void;
}

export const CompactScoreCard = memo(function CompactScoreCard({
  title,
  score,
  confidence = 'MEDIUM',
  indicators,
  loading = false,
  metricsLoading = false,
  isAdmin = false,
  selectedMetricIds,
  viewMode,
  onMetricsChange,
}: CompactScoreCardProps) {
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = useCallback((metricIds: string[]) => {
    setIsEditing(false);
    onMetricsChange?.(metricIds);
  }, [onMetricsChange]);

  if (loading) {
    return (
      <div className="bg-surface-container-low rounded-lg border border-outline-variant p-3 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-[80px] h-[80px] rounded-full bg-surface-container-highest" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-24 bg-surface-container-highest rounded" />
            <div className="h-3 w-16 bg-surface-container-highest rounded" />
            <div className="flex gap-4 mt-2">
              <div className="h-8 flex-1 bg-surface-container-highest rounded" />
              <div className="h-8 flex-1 bg-surface-container-highest rounded" />
              <div className="h-8 flex-1 bg-surface-container-highest rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-low rounded-lg border border-outline-variant p-3 relative">
      {isEditing && (
        <MetricSelector
          selectedMetrics={selectedMetricIds}
          onSave={handleSave}
          onCancel={() => setIsEditing(false)}
          viewMode={viewMode}
          maxSelections={3}
        />
      )}

      <div className="flex items-center gap-3">
        {score !== null ? (
          <CircularProgress value={score} size={80} strokeWidth={5} />
        ) : (
          <div className="w-[80px] h-[80px] rounded-full bg-surface-container-highest flex items-center justify-center">
            <span className="text-on-surface-variant text-sm">--</span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <h4 className="text-sm font-semibold text-on-surface truncate">
              {title}
            </h4>
            {isAdmin && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
                title="Configure displayed metrics"
              >
                <Settings className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="text-[9px] text-on-surface-variant mb-2">
            Confidence: <span className="font-medium">{confidence}</span>
          </div>

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
        </div>
      </div>
    </div>
  );
});

export default CompactScoreCard;
