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
import { ScoreDisplay } from '@/app/components/scoring/ScoreDisplay';
import { MetricTitle } from '@/app/components/MetricTitle';
import { InheritedBadge } from '@/app/components/scoring/InheritedBadge';
import type { ViewMode } from '../../types';

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
  metricId?: string;
  source?: string | null;
  sourceGeoId?: string | null;
  sourceGeoLevel?: 'metro' | 'county' | 'zip' | 'state' | 'national' | null;
  isInherited?: boolean;
  isFallback?: boolean;
}

const SubScoreDisplay: React.FC<SubScoreDisplayProps> = ({
  label,
  formattedValue,
  trend,
  loading,
  metricId,
  source,
  sourceGeoId,
  sourceGeoLevel,
  isInherited,
  isFallback,
}) => {
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

  const inheritedLevel =
    isInherited && sourceGeoLevel && ['county', 'metro', 'state', 'national'].includes(sourceGeoLevel)
      ? (sourceGeoLevel as 'county' | 'metro' | 'state' | 'national')
      : null;
  const sourceLabel = source
    ? source.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  return (
    <div className="flex flex-col items-center flex-1 min-w-0">
      <span className="text-[9px] text-on-surface-variant mb-0.5 truncate max-w-full" title={label}>
        {metricId ? (
          <MetricTitle
            metricId={metricId}
            resolvedMetric={{
              source: source ?? null,
              sourceGeoLevel: sourceGeoLevel ?? null,
              sourceGeoId: sourceGeoId ?? null,
              isInherited: !!isInherited,
              isFallback: !!isFallback,
            }}
          />
        ) : label}
      </span>
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin text-on-surface-variant" />
      ) : (
        <>
          <span className="text-xs font-semibold text-on-surface">{formattedValue}</span>
          {(isFallback || inheritedLevel) && (
            <div className="flex items-center gap-1 mt-0.5">
              {isFallback && (
                <span
                  className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-1 py-0.5 text-[8px] font-medium text-amber-700"
                  title={sourceLabel ? `Resolved from fallback source: ${sourceLabel}` : 'Resolved from fallback source'}
                >
                  Fallback
                </span>
              )}
              {inheritedLevel && <InheritedBadge sourceType={inheritedLevel} />}
            </div>
          )}
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
  source: string | null;
  sourceGeoId: string | null;
  sourceGeoLevel: 'metro' | 'county' | 'zip' | 'state' | 'national' | null;
  isInherited: boolean;
  isFallback: boolean;
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
          <ScoreDisplay value={score} size={80} strokeWidth={5} />
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
                metricId={ind.metricId}
                formattedValue={ind.formattedValue}
                source={ind.source}
                sourceGeoId={ind.sourceGeoId}
                sourceGeoLevel={ind.sourceGeoLevel}
                isInherited={ind.isInherited}
                isFallback={ind.isFallback}
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
