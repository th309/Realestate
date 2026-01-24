'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Search, Check } from 'lucide-react';
import { METRICS } from '../../config/metrics';
import { getMetricCategories } from '../../config/metric-categories';

interface MarketFactor {
  id: string;
  label: string;
  metricId: string;
}

interface MetricSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFactors: MarketFactor[];
  onSave: (factors: MarketFactor[]) => void;
  maxSelections?: number;
}

/**
 * Get all unique metric IDs from the sidebar categories.
 * This ensures only metrics with data support are selectable.
 */
function getSelectableMetrics(): { id: string; label: string }[] {
  const seen = new Set<string>();
  const metrics: { id: string; label: string }[] = [];

  // Get metrics from both homebuyer and investor views
  const allCategories = [
    ...getMetricCategories('homebuyer'),
    ...getMetricCategories('investor'),
  ];

  for (const category of allCategories) {
    if (category.isDivider || !category.metrics) continue;
    for (const metric of category.metrics) {
      if (!seen.has(metric.id)) {
        seen.add(metric.id);
        metrics.push({
          id: metric.id,
          label: metric.name,
        });
      }
    }
  }

  return metrics;
}

export function MetricSelectorModal({
  isOpen,
  onClose,
  currentFactors,
  onSave,
  maxSelections = 4,
}: MetricSelectorModalProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Get all selectable metrics from sidebar categories
  const selectableMetrics = useMemo(() => getSelectableMetrics(), []);
  const metricLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const m of selectableMetrics) {
      labels[m.id] = m.label;
    }
    return labels;
  }, [selectableMetrics]);

  // Initialize selected from current factors
  useEffect(() => {
    if (isOpen) {
      setSelected(currentFactors.map(f => f.metricId));
      setSearchQuery('');
    }
  }, [isOpen, currentFactors]);

  const filteredMetrics = selectableMetrics.filter((metric) => {
    return metric.label.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleToggle = (metricId: string) => {
    setSelected(prev => {
      if (prev.includes(metricId)) {
        return prev.filter(id => id !== metricId);
      }
      if (prev.length >= maxSelections) {
        // Replace the first selected item
        return [...prev.slice(1), metricId];
      }
      return [...prev, metricId];
    });
  };

  const handleSave = () => {
    const factors: MarketFactor[] = selected.map((metricId, index) => ({
      id: `factor_${index}`,
      label: metricLabels[metricId] || metricId,
      metricId,
    }));
    onSave(factors);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-surface rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-outline-variant">
          <h3 className="text-lg font-bold text-on-surface">Select Market Factors</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-surface-container transition-colors"
          >
            <X className="w-5 h-5 text-on-surface-variant" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-outline-variant">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
            <input
              type="text"
              placeholder="Search metrics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-surface-container rounded-lg border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <p className="text-xs text-on-surface-variant mt-2">
            Select up to {maxSelections} metrics. Selected: {selected.length}/{maxSelections}
          </p>
        </div>

        {/* Metric List */}
        <div className="max-h-[300px] overflow-y-auto p-2">
          {filteredMetrics.map((metric) => {
            const isSelected = selected.includes(metric.id);
            const config = METRICS[metric.id];

            return (
              <button
                key={metric.id}
                onClick={() => handleToggle(metric.id)}
                className={`
                  w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors
                  ${isSelected
                    ? 'bg-primary/10 border border-primary/30'
                    : 'hover:bg-surface-container border border-transparent'
                  }
                `}
              >
                <div
                  className={`
                    w-5 h-5 rounded flex items-center justify-center flex-shrink-0
                    ${isSelected
                      ? 'bg-primary text-white'
                      : 'border-2 border-outline-variant'
                    }
                  `}
                >
                  {isSelected && <Check className="w-3 h-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-on-surface truncate">{metric.label}</p>
                  {config?.dataSource && (
                    <p className="text-[10px] text-on-surface-variant capitalize">
                      Source: {config.dataSource}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-outline-variant">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={selected.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Selection
          </button>
        </div>
      </div>
    </div>
  );
}
