'use client';

import React from 'react';
import { TemplateType } from '../../hooks/useGraphsState';

interface MetricExplorerProps {
  activeMetric: string;
  onMetricChange: (metric: string) => void;
  template: TemplateType;
}

interface MetricCategory {
  label: string;
  metrics: { id: string; label: string }[];
}

/**
 * MetricExplorer - Categorized metric chips for exploration
 */
export function MetricExplorer({
  activeMetric,
  onMetricChange,
  template,
}: MetricExplorerProps) {
  const categories = getMetricCategories(template);

  return (
    <div className="bg-surface-container-lowest rounded-[20px] p-5 shadow-sm">
      <h3 className="text-sm font-medium text-on-surface mb-4">Compare Metrics</h3>

      <div className="space-y-4">
        {categories.map(category => (
          <div key={category.label}>
            <p className="text-[11px] font-medium text-on-surface-variant uppercase tracking-wide mb-2">
              {category.label}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {category.metrics.map(metric => (
                <button
                  key={metric.id}
                  onClick={() => onMetricChange(metric.id)}
                  className={`
                    px-3 py-1.5 rounded-full text-xs font-medium transition-all
                    ${activeMetric === metric.id
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container border border-outline-variant text-on-surface hover:border-primary hover:text-primary'
                    }
                  `}
                >
                  {metric.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getMetricCategories(template: TemplateType): MetricCategory[] {
  // Base categories available for all templates
  const baseCategories: MetricCategory[] = [
    {
      label: 'Affordability',
      metrics: [
        { id: 'affordability_ratio', label: 'Price/Income' },
        { id: 'zhvi', label: 'Median Price' },
        { id: 'rent_to_income', label: 'Rent/Income' },
      ],
    },
    {
      label: 'Growth',
      metrics: [
        { id: 'zhvi_yoy', label: '1Y Apprec.' },
        { id: 'zhvi_5y_cagr', label: '5Y CAGR' },
        { id: 'for_sale_inventory', label: 'Inventory' },
      ],
    },
  ];

  // Template-specific categories
  const templateCategories: Record<TemplateType, MetricCategory[]> = {
    affordability: baseCategories,
    investment: [
      {
        label: 'Returns',
        metrics: [
          { id: 'cap_rate', label: 'Cap Rate' },
          { id: 'rent_to_price', label: 'Rent Yield' },
          { id: 'grm', label: 'GRM' },
        ],
      },
      {
        label: 'Appreciation',
        metrics: [
          { id: 'zhvi_5y_cagr', label: '5Y CAGR' },
          { id: 'zhvf_1yr', label: 'Forecast' },
        ],
      },
    ],
    momentum: [
      {
        label: 'Market Speed',
        metrics: [
          { id: 'days_to_pending', label: 'Days on Market' },
          { id: 'pending_ratio', label: 'Pending Ratio' },
          { id: 'sale_to_list', label: 'Sale/List' },
        ],
      },
      {
        label: 'Supply',
        metrics: [
          { id: 'inventory_yoy', label: 'Inventory Chg' },
          { id: 'months_of_supply', label: 'Months Supply' },
        ],
      },
    ],
    cashflow: [
      {
        label: 'Cash Flow',
        metrics: [
          { id: 'rent_to_price', label: 'Rent Yield' },
          { id: 'zori', label: 'Median Rent' },
          { id: 'vacancy', label: 'Vacancy' },
        ],
      },
      {
        label: 'Entry',
        metrics: [
          { id: 'zhvi', label: 'Median Price' },
          { id: 'price_per_sqft', label: '$/SqFt' },
        ],
      },
    ],
    custom: baseCategories,
  };

  return templateCategories[template] || baseCategories;
}

export default MetricExplorer;
