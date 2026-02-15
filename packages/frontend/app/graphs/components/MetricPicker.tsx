'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { getMetricTitle, getMetricsForGeoLevel, isMetricSupportedForGeo, metricHasTimeSeries } from '@/lib/data';
import type { GeoLevel } from '@/lib/data';

interface MetricPickerProps {
  value: string;
  onChange: (metricId: string) => void;
  geoLevel: GeoLevel;
  /** Expand to fill parent width (for sidebar use) */
  fullWidth?: boolean;
}

// Curated metric groups for the dropdown
const METRIC_GROUPS: { label: string; metrics: string[] }[] = [
  {
    label: 'Home Values',
    metrics: ['home_value', 'home_value_yoy', 'home_value_mom', 'home_price_forecast'],
  },
  {
    label: 'Listing & Sales',
    metrics: ['listing_price', 'price_per_sqft', 'days_on_market', 'price_cut_pct', 'sale_to_list'],
  },
  {
    label: 'Market Activity',
    metrics: ['for_sale_inventory', 'inventory_yoy', 'new_listings', 'new_listings_yoy', 'pending_listings', 'home_sales'],
  },
  {
    label: 'Rent',
    metrics: ['rent_index', 'rent_for_houses'],
  },
  {
    label: 'Investor',
    metrics: ['cap_rate', 'gross_yield', 'grm', 'rent_to_price_ratio'],
  },
  {
    label: 'Affordability',
    metrics: ['homeowner_affordability', 'renter_affordability', 'years_to_save', 'income_to_buy'],
  },
  {
    label: 'Economy',
    metrics: ['unemployment_rate', 'job_growth', 'median_income', 'population_growth'],
  },
  {
    label: 'Construction',
    metrics: ['total_permits', 'sf_permits', 'mf_permits', 'permits_yoy'],
  },
];

export function MetricPicker({ value, onChange, geoLevel, fullWidth = false }: MetricPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const title = getMetricTitle(value);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm
          transition-colors duration-150
          ${fullWidth ? 'w-full justify-between' : ''}
          ${open
            ? 'bg-primary-container text-on-primary-container'
            : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
          }
        `}
      >
        <span className={`font-medium truncate ${fullWidth ? '' : 'max-w-[180px]'}`}>{title}</span>
        <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-surface-container-lowest rounded-2xl shadow-lg border border-outline-variant/30 overflow-hidden z-50">
          <div className="max-h-80 overflow-y-auto py-2">
            {METRIC_GROUPS.map(group => {
              const availableMetrics = group.metrics.filter(
                m => isMetricSupportedForGeo(m, geoLevel) && metricHasTimeSeries(m)
              );
              if (availableMetrics.length === 0) return null;

              return (
                <div key={group.label}>
                  <div className="px-4 py-1.5 text-[10px] font-semibold text-on-surface-variant uppercase tracking-widest">
                    {group.label}
                  </div>
                  {availableMetrics.map(metricId => {
                    const isSelected = metricId === value;
                    return (
                      <button
                        key={metricId}
                        onClick={() => {
                          onChange(metricId);
                          setOpen(false);
                        }}
                        className={`
                          w-full flex items-center gap-2 px-4 py-2 text-sm text-left
                          transition-colors duration-100
                          ${isSelected
                            ? 'bg-primary-container/50 text-on-primary-container'
                            : 'text-on-surface hover:bg-surface-container'
                          }
                        `}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                        <span className={isSelected ? 'font-medium' : ''}>
                          {getMetricTitle(metricId)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default MetricPicker;
