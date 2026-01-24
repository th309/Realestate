'use client';

import { useState, useEffect } from 'react';
import { X, Search, Check } from 'lucide-react';
import { METRICS, type MetricConfig } from '../../config/metrics';

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

// Metrics that can be selected for Market Factors display
// Excludes Risk Level and other non-applicable metrics
const SELECTABLE_METRICS: string[] = [
  'home_value_yoy',
  'home_value_5yr',
  'home_price_forecast',
  'cap_rate',
  'rent_index',
  'days_on_market',
  'for_sale_inventory',
  'inventory_yoy',
  'pending_ratio',
  'new_listings_yoy',
  'hotness_score',
  'price_cut_pct',
  'listing_price',
  'price_per_sqft',
  'population_growth',
  'median_income',
  'unemployment_rate',
  'job_growth',
];

// Human-readable labels for metrics
const METRIC_LABELS: Record<string, string> = {
  home_value_yoy: 'Appreciation',
  home_value_5yr: '5-Year Growth',
  home_price_forecast: 'Price Forecast',
  cap_rate: 'Yield Potential',
  rent_index: 'Rent Index',
  days_on_market: 'Days on Market',
  for_sale_inventory: 'Inventory',
  inventory_yoy: 'Inventory Change',
  pending_ratio: 'Demand',
  new_listings_yoy: 'New Listings Change',
  hotness_score: 'Market Heat',
  price_cut_pct: 'Price Cuts',
  listing_price: 'Median Price',
  price_per_sqft: 'Price/Sq Ft',
  population_growth: 'Population Growth',
  median_income: 'Median Income',
  unemployment_rate: 'Unemployment',
  job_growth: 'Job Growth',
};

export function MetricSelectorModal({
  isOpen,
  onClose,
  currentFactors,
  onSave,
  maxSelections = 4,
}: MetricSelectorModalProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Initialize selected from current factors
  useEffect(() => {
    if (isOpen) {
      setSelected(currentFactors.map(f => f.metricId));
      setSearchQuery('');
    }
  }, [isOpen, currentFactors]);

  const filteredMetrics = SELECTABLE_METRICS.filter((metricId) => {
    const label = METRIC_LABELS[metricId] || metricId;
    return label.toLowerCase().includes(searchQuery.toLowerCase());
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
      label: METRIC_LABELS[metricId] || metricId,
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
          {filteredMetrics.map((metricId) => {
            const isSelected = selected.includes(metricId);
            const label = METRIC_LABELS[metricId] || metricId;
            const config = METRICS[metricId];

            return (
              <button
                key={metricId}
                onClick={() => handleToggle(metricId)}
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
                  <p className="text-sm font-medium text-on-surface truncate">{label}</p>
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
