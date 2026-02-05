'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Check, X } from 'lucide-react';
import { useAllMetricOptions } from '@/app/map/hooks/useMetricOptions';
import type { GeoLevel } from '@/lib/data';

// Available metrics for selection
interface AvailableMetric {
  id: string;
  name: string;
  category: string;
  disabled?: boolean;
}

// Map metric IDs to UI categories (must match metric-categories.tsx)
function getMetricCategory(metricId: string): string {
  // Affordability metrics
  if (['affordable_home_price', 'home_value_yoy', 'home_value_5yr', 'income_to_buy', 'listing_price', 'price_per_sqft', 'years_to_save'].includes(metricId)) {
    return 'AFFORDABILITY';
  }
  // Cash Flow metrics (Investor)
  if (['cap_rate', 'rent_index', 'rent_for_houses'].includes(metricId)) {
    return 'CASH FLOW';
  }
  // Local Economy metrics
  if (['cost_of_living', 'gdp_growth', 'job_growth', 'unemployment_rate'].includes(metricId)) {
    return 'LOCAL ECONOMY';
  }
  // Market Competition metrics
  if (['days_on_market', 'hotness_score', 'for_sale_inventory', 'inventory_yoy', 'new_listings_yoy', 'pending_ratio', 'sale_to_list', 'home_value_mom', 'price_cut_pct', 'price_increase_pct', 'new_listings', 'inventory_surplus'].includes(metricId)) {
    return 'MARKET COMPETITION';
  }
  // Appreciation metrics (Investor)
  if (['home_value', 'overvalued_pct'].includes(metricId)) {
    return 'APPRECIATION';
  }
  // Area Profile metrics
  if (['population', 'population_growth', 'median_income', 'income_growth', 'median_age', 'homeownership_rate'].includes(metricId)) {
    return 'AREA PROFILE';
  }
  // New Construction metrics
  if (['sf_permits', 'mf_permits', 'total_permits', 'permits_yoy', 'sf_mf_ratio', 'permit_value_per_unit', 'new_construction_sales', 'new_construction_price', 'new_construction_ppsf'].includes(metricId)) {
    return 'NEW CONSTRUCTION';
  }
  // PropertyIQ Scores
  if (['homeready_score', 'investoredge_score', 'market_health_score'].includes(metricId)) {
    return 'PROPERTYIQ SCORES';
  }
  return 'OTHER';
}

export interface MetricSelectorProps {
  selectedMetrics: string[];
  onSave: (metrics: string[]) => void;
  onCancel: () => void;
  maxSelections?: number;
  className?: string;
  geoLevel?: GeoLevel; // Optional geo level to filter available metrics
}

export const MetricSelector: React.FC<MetricSelectorProps> = ({
  selectedMetrics,
  onSave,
  onCancel,
  maxSelections = 3,
  className = '',
  geoLevel,
}) => {
  const [selected, setSelected] = useState<string[]>(selectedMetrics);
  
  // Use data binding layer to get available metrics
  const { options: metricOptions, loading } = useAllMetricOptions(geoLevel);
  
  // Transform metric options to AvailableMetric format with UI categories
  const availableMetrics = useMemo((): AvailableMetric[] => {
    return metricOptions.map(opt => ({
      id: opt.value,
      name: opt.label,
      category: getMetricCategory(opt.value),
      disabled: opt.disabled,
    }));
  }, [metricOptions]);

  // Initialize selected from props
  useEffect(() => {
    setSelected(selectedMetrics);
  }, [selectedMetrics]);

  // Group metrics by the 4 categories
  const groupedMetrics = useMemo(() => {
    return availableMetrics.reduce((acc, m) => {
      if (!acc[m.category]) acc[m.category] = [];
      acc[m.category].push(m);
      return acc;
    }, {} as Record<string, AvailableMetric[]>);
  }, [availableMetrics]);

  // Define category order (matches sidebar structure)
  const categoryOrder = [
    'AFFORDABILITY', 'MARKET COMPETITION', 'CASH FLOW', 'APPRECIATION',
    'AREA PROFILE', 'LOCAL ECONOMY', 'NEW CONSTRUCTION', 'PROPERTYIQ SCORES', 'OTHER'
  ];

  const toggleMetric = (metricId: string) => {
    const metric = availableMetrics.find(m => m.id === metricId);
    setSelected(prev => {
      if (prev.includes(metricId)) {
        // Always allow deselecting (even if metric is unavailable/greyed out)
        return prev.filter(id => id !== metricId);
      }
      if (metric?.disabled) return prev; // Don't allow selecting unavailable metrics
      if (prev.length < maxSelections) {
        return [...prev, metricId];
      }
      // At max: replace oldest selection with the new one (no need to deselect first)
      return [...prev.slice(1), metricId];
    });
  };

  return (
    <div className={`bg-surface-container-high border border-outline-variant rounded-xl shadow-lg p-4 overflow-y-auto ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-on-surface">
          Select up to {maxSelections} metrics ({selected.length}/{maxSelections})
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => onSave(selected)}
            disabled={selected.length === 0}
            className="p-1.5 rounded-full hover:bg-green-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Confirm"
          >
            <Check className="w-5 h-5 text-green-600" />
          </button>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-full hover:bg-red-500/20 transition-colors"
            title="Cancel"
          >
            <X className="w-5 h-5 text-red-600" />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {categoryOrder.map((category) => {
          const metrics = groupedMetrics[category] || [];
          if (metrics.length === 0) return null;
          
          return (
            <div key={category}>
              <div className="text-xs font-semibold text-on-surface-variant uppercase mb-2">
                {category}
              </div>
              <div className="flex flex-wrap gap-2">
                {metrics.map(m => {
                  const isSelected = selected.includes(m.id);
                  // Only grey out when metric is unavailable; at max, unselected metrics are still clickable (swap-in)
                  const isDisabled = m.disabled && !isSelected;
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleMetric(m.id)}
                      disabled={isDisabled}
                      className={`
                        px-4 py-2 rounded-full text-sm font-medium transition-all
                        ${isSelected
                          ? 'bg-primary text-white shadow-md'
                          : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high border border-outline-variant'
                        }
                        ${isDisabled
                          ? 'opacity-50 cursor-not-allowed'
                          : 'cursor-pointer'
                        }
                      `}
                    >
                      {m.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
