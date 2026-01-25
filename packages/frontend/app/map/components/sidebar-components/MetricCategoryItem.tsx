'use client';

import { useState } from 'react';
import { ChevronDownIcon } from '../Icons';
import type { GeoLevel, ForecastHorizon, RentIndexType, RenterDemandType, MetricCategory, SubSection } from '../../types';
import { MetricItem } from './MetricItem';

interface MetricCategoryItemProps {
  category: MetricCategory;
  isExpanded: boolean;
  selectedMetric: string;
  geoLevel: GeoLevel;
  forecastHorizon: ForecastHorizon;
  rentIndexType: RentIndexType;
  renterDemandType: RenterDemandType;
  onToggle: () => void;
  onSelectMetric: (id: string) => void;
  onGeoLevelChange: (level: GeoLevel) => void;
  onForecastHorizonChange: (horizon: ForecastHorizon) => void;
  onRentIndexTypeChange: (type: RentIndexType) => void;
  onRenterDemandTypeChange: (type: RenterDemandType) => void;
}

export function MetricCategoryItem({
  category,
  isExpanded,
  selectedMetric,
  geoLevel,
  forecastHorizon,
  rentIndexType,
  renterDemandType,
  onToggle,
  onSelectMetric,
  onGeoLevelChange,
  onForecastHorizonChange,
  onRentIndexTypeChange,
  onRenterDemandTypeChange,
}: MetricCategoryItemProps) {
  // Handle divider categories - render a simple horizontal line
  if (category.isDivider) {
    return (
      <div className="my-3 border-t border-outline-variant" />
    );
  }
  // Track which sub-sections are expanded
  const [expandedSubSections, setExpandedSubSections] = useState<string[]>([]);

  const toggleSubSection = (subSectionId: string) => {
    setExpandedSubSections(prev =>
      prev.includes(subSectionId)
        ? prev.filter(id => id !== subSectionId)
        : [...prev, subSectionId]
    );
  };

  const handleSelectMetric = (metricId: string) => {
    onSelectMetric(metricId);
  };

  const renderMetric = (metric: { id: string; name: string; isPremium?: boolean; isNew?: boolean }) => (
    <MetricItem
      key={metric.id}
      metric={metric}
      isSelected={selectedMetric === metric.id}
      geoLevel={geoLevel}
      forecastHorizon={forecastHorizon}
      rentIndexType={rentIndexType}
      renterDemandType={renterDemandType}
      onSelect={() => handleSelectMetric(metric.id)}
      onForecastHorizonChange={onForecastHorizonChange}
      onRentIndexTypeChange={onRentIndexTypeChange}
      onRenterDemandTypeChange={onRenterDemandTypeChange}
    />
  );

  const renderSubSection = (subSection: SubSection) => {
    const isSubExpanded = expandedSubSections.includes(subSection.id);

    return (
      <div key={subSection.id} className="mt-1">
        <button
          onClick={() => toggleSubSection(subSection.id)}
          className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-surface-container rounded-lg transition-colors duration-200"
        >
          <span className="text-xs font-medium text-on-surface">{subSection.name}</span>
          <span className={`transition-transform duration-200 text-on-surface-variant ${isSubExpanded ? 'rotate-180' : ''}`}>
            <ChevronDownIcon />
          </span>
        </button>
        {isSubExpanded && (
          <div className="ml-3 mt-0.5 space-y-0.5 border-l border-outline-variant pl-2">
            {subSection.metrics.map(renderMetric)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-2 hover:bg-surface-container rounded-lg transition-colors duration-200"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-on-surface-variant flex-shrink-0">{category.icon}</span>
          <div className="min-w-0 flex-1">
            <span className="font-medium text-xs text-on-surface truncate block">{category.name}</span>
            {category.subtext && (
              <span className="text-[10px] text-on-surface-variant truncate block leading-tight">
                {category.subtext}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {category.isNew && <span className="text-[10px] text-rose-500 font-medium">New</span>}
          <span className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
            <ChevronDownIcon />
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="ml-6 mt-1 mb-2">
          {/* Render direct metrics if any */}
          {category.metrics && category.metrics.length > 0 && (
            <div className="space-y-0.5">
              {category.metrics.map(renderMetric)}
            </div>
          )}

          {/* Render sub-sections if any */}
          {category.subSections && category.subSections.length > 0 && (
            <div className="space-y-0.5">
              {category.subSections.map(renderSubSection)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
