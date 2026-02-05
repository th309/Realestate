'use client';

import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronUp } from 'lucide-react';
import { TrendIndicator } from './TrendIndicator';

interface ComparisonMetric {
  id: string;
  label: string;
  format?: 'currency' | 'percent' | 'number' | 'days';
  inverted?: boolean; // Is lower better?
  category?: string;
}

interface ComparisonData {
  [regionId: string]: {
    name: string;
    values: { [metricId: string]: number | null };
    trends?: { [metricId: string]: number };
  };
}

interface ComparisonTableProps {
  metrics: ComparisonMetric[];
  data: ComparisonData;
  baselineId?: string;
  highlightBest?: boolean;
  collapsibleCategories?: boolean;
  showTrends?: boolean;
  className?: string;
}

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
};

export const ComparisonTable: React.FC<ComparisonTableProps> = ({
  metrics,
  data,
  baselineId,
  highlightBest = true,
  collapsibleCategories = false,
  showTrends = true,
  className = '',
}) => {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set()
  );

  const regions = Object.keys(data);
  const regionNames = regions.map((id) => ({ id, name: data[id].name }));

  // Group metrics by category
  const metricsByCategory = useMemo(() => {
    const groups: { [category: string]: ComparisonMetric[] } = {};
    metrics.forEach((metric) => {
      const cat = metric.category || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(metric);
    });
    return groups;
  }, [metrics]);

  // Format value based on type
  const formatValue = (value: number | null, format?: string): string => {
    if (value === null || value === undefined) return '—';

    switch (format) {
      case 'currency':
        return value >= 1000000
          ? `$${(value / 1000000).toFixed(2)}M`
          : value >= 1000
          ? `$${(value / 1000).toFixed(0)}K`
          : `$${value.toLocaleString()}`;
      case 'percent':
        return `${value.toFixed(1)}%`;
      case 'days':
        return `${Math.round(value)} days`;
      case 'number':
      default:
        return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
    }
  };

  // Find best value for a metric
  const getBestValue = (metricId: string, inverted: boolean): number | null => {
    const values = regions
      .map((r) => data[r].values[metricId])
      .filter((v): v is number => v !== null);
    if (values.length === 0) return null;
    return inverted ? Math.min(...values) : Math.max(...values);
  };

  // Sort handler
  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return prev.direction === 'asc'
          ? { key, direction: 'desc' }
          : prev.direction === 'desc'
          ? null
          : { key, direction: 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  // Toggle category collapse
  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Sorted regions
  const sortedRegions = useMemo(() => {
    if (!sortConfig) return regionNames;

    return [...regionNames].sort((a, b) => {
      const aValue = data[a.id].values[sortConfig.key];
      const bValue = data[b.id].values[sortConfig.key];

      if (aValue === null) return 1;
      if (bValue === null) return -1;

      const diff = aValue - bValue;
      return sortConfig.direction === 'asc' ? diff : -diff;
    });
  }, [regionNames, sortConfig, data]);

  const renderSortIcon = (key: string) => {
    if (sortConfig?.key !== key) {
      return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    }
    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="w-3 h-3" />
    ) : (
      <ArrowDown className="w-3 h-3" />
    );
  };

  return (
    <div
      className={`
        bg-surface-container-low rounded-2xl elevation-1 overflow-hidden
        ${className}
      `}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-outline-variant">
              <th className="sticky left-0 z-10 bg-surface-container-low px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                Metric
              </th>
              {sortedRegions.map((region) => (
                <th
                  key={region.id}
                  className={`
                    px-4 py-3 text-right text-xs font-medium uppercase tracking-wider
                    ${region.id === baselineId
                      ? 'text-primary bg-primary-container/20'
                      : 'text-on-surface-variant'
                    }
                  `}
                >
                  <div className="flex items-center justify-end gap-1">
                    {region.name}
                    {region.id === baselineId && (
                      <span className="text-[9px] bg-primary-container text-on-primary-container px-1.5 py-0.5 rounded-full">
                        BASE
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(metricsByCategory).map(([category, categoryMetrics]) => (
              <React.Fragment key={category}>
                {/* Category header */}
                {collapsibleCategories && Object.keys(metricsByCategory).length > 1 && (
                  <tr
                    className="bg-surface-container cursor-pointer hover:bg-surface-container-high transition-colors"
                    onClick={() => toggleCategory(category)}
                  >
                    <td
                      colSpan={sortedRegions.length + 1}
                      className="px-4 py-2 text-xs font-medium text-on-surface-variant uppercase tracking-wider"
                    >
                      <div className="flex items-center gap-2">
                        {collapsedCategories.has(category) ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronUp className="w-4 h-4" />
                        )}
                        {category}
                      </div>
                    </td>
                  </tr>
                )}

                {/* Metrics rows */}
                {!collapsedCategories.has(category) &&
                  categoryMetrics.map((metric, idx) => {
                    const bestValue = highlightBest
                      ? getBestValue(metric.id, metric.inverted || false)
                      : null;

                    return (
                      <tr
                        key={metric.id}
                        className={`
                          border-b border-outline-variant/50 last:border-b-0
                          hover:bg-surface-container/50 transition-colors
                        `}
                      >
                        <td className="sticky left-0 z-10 bg-surface-container-low px-4 py-3">
                          <button
                            onClick={() => handleSort(metric.id)}
                            className="flex items-center gap-2 text-sm text-on-surface hover:text-primary transition-colors"
                          >
                            {metric.label}
                            {renderSortIcon(metric.id)}
                          </button>
                        </td>
                        {sortedRegions.map((region) => {
                          const value = data[region.id].values[metric.id];
                          const trend = data[region.id].trends?.[metric.id];
                          const isBest = highlightBest && value === bestValue && value !== null;

                          return (
                            <td
                              key={region.id}
                              className={`
                                px-4 py-3 text-right
                                ${region.id === baselineId ? 'bg-primary-container/10' : ''}
                              `}
                            >
                              <div className="flex flex-col items-end gap-0.5">
                                <span
                                  className={`
                                    text-sm font-medium
                                    ${isBest ? 'text-primary font-semibold' : 'text-on-surface'}
                                  `}
                                >
                                  {formatValue(value, metric.format)}
                                  {isBest && (
                                    <span className="ml-1 text-[9px] text-primary">★</span>
                                  )}
                                </span>
                                {showTrends && trend !== undefined && (
                                  <TrendIndicator
                                    value={trend}
                                    size="sm"
                                    inverted={metric.inverted}
                                    showValue={true}
                                    showIcon={false}
                                  />
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Mini comparison row for quick comparisons
interface MiniComparisonProps {
  label: string;
  values: Array<{
    name: string;
    value: number | string;
    trend?: number;
    isHighlighted?: boolean;
  }>;
  format?: 'currency' | 'percent' | 'number';
  className?: string;
}

export const MiniComparison: React.FC<MiniComparisonProps> = ({
  label,
  values,
  format,
  className = '',
}) => {
  const formatValue = (val: number | string) => {
    if (typeof val === 'string') return val;
    switch (format) {
      case 'currency':
        return `$${val.toLocaleString()}`;
      case 'percent':
        return `${val.toFixed(1)}%`;
      default:
        return val.toLocaleString();
    }
  };

  return (
    <div className={`py-2 ${className}`}>
      <div className="text-xs text-on-surface-variant mb-1">{label}</div>
      <div className="flex items-center gap-4">
        {values.map((item, idx) => (
          <div
            key={idx}
            className={`
              flex-1 text-center py-2 rounded-lg
              ${item.isHighlighted
                ? 'bg-primary-container/30'
                : 'bg-surface-container'
              }
            `}
          >
            <div className="text-[10px] text-on-surface-variant mb-0.5">
              {item.name}
            </div>
            <div
              className={`
                text-sm font-medium
                ${item.isHighlighted ? 'text-primary' : 'text-on-surface'}
              `}
            >
              {formatValue(item.value)}
            </div>
            {item.trend !== undefined && (
              <TrendIndicator value={item.trend} size="sm" showIcon={false} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
