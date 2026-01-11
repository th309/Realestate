'use client';

import Link from 'next/link';
import { ChevronDownIcon, PremiumIcon, InfoSmallIcon } from './Icons';
import type { GeoLevel, ForecastHorizon, RentIndexType, RenterDemandType, NavItem, MetricCategory } from '../types';

interface SidebarProps {
  pathname: string;
  navItems: NavItem[];
  metricCategories: MetricCategory[];
  expandedCategories: string[];
  selectedMetric: string;
  geoLevel: GeoLevel;
  forecastHorizon: ForecastHorizon;
  rentIndexType: RentIndexType;
  renterDemandType: RenterDemandType;
  recordCount: number;
  selectedState: string;
  sidebarWidth: number;
  onToggleCategory: (id: string) => void;
  onSelectMetric: (id: string) => void;
  onGeoLevelChange: (level: GeoLevel) => void;
  onForecastHorizonChange: (horizon: ForecastHorizon) => void;
  onRentIndexTypeChange: (type: RentIndexType) => void;
  onRenterDemandTypeChange: (type: RenterDemandType) => void;
  onMouseDown: (e: React.MouseEvent) => void;
}

export function Sidebar({
  pathname,
  navItems,
  metricCategories,
  expandedCategories,
  selectedMetric,
  geoLevel,
  forecastHorizon,
  rentIndexType,
  renterDemandType,
  recordCount,
  selectedState,
  sidebarWidth,
  onToggleCategory,
  onSelectMetric,
  onGeoLevelChange,
  onForecastHorizonChange,
  onRentIndexTypeChange,
  onRenterDemandTypeChange,
  onMouseDown,
}: SidebarProps) {
  return (
    <aside className="flex bg-white shadow-lg">
      {/* Navigation Rail */}
      <div className="w-20 border-r border-gray-200 flex flex-col items-center py-4 gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`w-16 py-3 rounded-2xl flex flex-col items-center gap-1 transition-all ${
                isActive ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className={isActive ? 'text-purple-700' : 'text-gray-600'}>
                {item.icon}
              </span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Metric Panel */}
      <div className="overflow-y-auto p-4" style={{ width: sidebarWidth }}>
        <h2 className="text-lg font-medium text-gray-900 mb-4">Market Trends</h2>

        {/* Data summary */}
        <DataSummary
          recordCount={recordCount}
          geoLevel={geoLevel}
          selectedState={selectedState}
        />

        {/* Search box */}
        <div className="mb-4">
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 -960 960 960" width="16" fill="currentColor">
                <path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search data points"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Metric Categories */}
        <div className="space-y-1">
          {metricCategories.map((category) => (
            <MetricCategoryItem
              key={category.id}
              category={category}
              isExpanded={expandedCategories.includes(category.id)}
              selectedMetric={selectedMetric}
              geoLevel={geoLevel}
              forecastHorizon={forecastHorizon}
              rentIndexType={rentIndexType}
              renterDemandType={renterDemandType}
              onToggle={() => onToggleCategory(category.id)}
              onSelectMetric={onSelectMetric}
              onGeoLevelChange={onGeoLevelChange}
              onForecastHorizonChange={onForecastHorizonChange}
              onRentIndexTypeChange={onRentIndexTypeChange}
              onRenterDemandTypeChange={onRenterDemandTypeChange}
            />
          ))}
        </div>

        {/* Explore link */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <a href="#" className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1">
            Explore Data Points
            <svg xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 -960 960 960" width="16" fill="currentColor">
              <path d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z" />
            </svg>
          </a>
        </div>
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={onMouseDown}
        className="w-1 hover:w-1.5 bg-transparent hover:bg-purple-300 cursor-col-resize transition-all flex-shrink-0 group"
        title="Drag to resize sidebar"
      >
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-0.5 h-8 bg-gray-300 group-hover:bg-purple-500 rounded-full transition-colors" />
        </div>
      </div>
    </aside>
  );
}

// Sub-components

function DataSummary({
  recordCount,
  geoLevel,
  selectedState,
}: {
  recordCount: number;
  geoLevel: GeoLevel;
  selectedState: string;
}) {
  const areaLabel = geoLevel === 'state' ? 'states'
    : geoLevel === 'metro' ? 'metros'
    : geoLevel === 'county' ? 'counties'
    : geoLevel === 'zip' ? 'ZIP codes'
    : 'areas';

  return (
    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
      <div className="text-sm text-gray-600">
        Showing <span className="font-medium text-gray-900">{recordCount.toLocaleString()}</span> {areaLabel}
      </div>
      {geoLevel === 'county' && (
        <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
          ~58% of US counties have Zillow home value data. Rural counties with limited housing transactions may show "No data."
        </div>
      )}
      {geoLevel === 'zip' && !selectedState && (
        <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-amber-600">
          Select a state to view ZIP code data
        </div>
      )}
    </div>
  );
}

function MetricCategoryItem({
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
}: {
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
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-2 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-gray-600 flex-shrink-0">{category.icon}</span>
          <span className="font-medium text-xs text-gray-800 truncate">{category.name}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {category.isNew && <span className="text-[10px] text-rose-500 font-medium">New</span>}
          <span className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
            <ChevronDownIcon />
          </span>
        </div>
      </button>

      {isExpanded && category.metrics && (
        <div className="ml-6 mt-1 mb-2 space-y-0.5">
          {category.metrics.map((metric) => (
            <MetricItem
              key={metric.id}
              metric={metric}
              isSelected={selectedMetric === metric.id}
              geoLevel={geoLevel}
              forecastHorizon={forecastHorizon}
              rentIndexType={rentIndexType}
              renterDemandType={renterDemandType}
              onSelect={() => {
                onSelectMetric(metric.id);
                if (metric.id === 'home_price_forecast' && !['metro', 'zip'].includes(geoLevel)) {
                  onGeoLevelChange('metro');
                }
              }}
              onForecastHorizonChange={onForecastHorizonChange}
              onRentIndexTypeChange={onRentIndexTypeChange}
              onRenterDemandTypeChange={onRenterDemandTypeChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MetricItem({
  metric,
  isSelected,
  geoLevel,
  forecastHorizon,
  rentIndexType,
  renterDemandType,
  onSelect,
  onForecastHorizonChange,
  onRentIndexTypeChange,
  onRenterDemandTypeChange,
}: {
  metric: { id: string; name: string; isPremium?: boolean; isNew?: boolean };
  isSelected: boolean;
  geoLevel: GeoLevel;
  forecastHorizon: ForecastHorizon;
  rentIndexType: RentIndexType;
  renterDemandType: RenterDemandType;
  onSelect: () => void;
  onForecastHorizonChange: (horizon: ForecastHorizon) => void;
  onRentIndexTypeChange: (type: RentIndexType) => void;
  onRenterDemandTypeChange: (type: RenterDemandType) => void;
}) {
  return (
    <div>
      <button
        onClick={onSelect}
        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors ${
          isSelected ? 'bg-purple-100 text-purple-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
        }`}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="truncate">{metric.name}</span>
          {metric.isNew && <span className="text-[10px] text-rose-500 font-medium flex-shrink-0">New</span>}
        </span>
        <span className="flex items-center gap-0.5 flex-shrink-0 ml-1">
          {metric.isPremium && <PremiumIcon />}
          <InfoSmallIcon />
        </span>
      </button>

      {/* Forecast Horizon Selector */}
      {metric.id === 'home_price_forecast' && isSelected && (
        <ForecastHorizonSelector
          value={forecastHorizon}
          onChange={onForecastHorizonChange}
        />
      )}

      {/* Rent Index Type Selector */}
      {metric.id === 'rent_index' && isSelected && (
        <PropertyTypeSelector
          value={rentIndexType}
          geoLevel={geoLevel}
          colorScheme="purple"
          onChange={onRentIndexTypeChange}
        />
      )}

      {/* Renter Demand Type Selector */}
      {metric.id === 'rent_for_houses' && isSelected && (
        <PropertyTypeSelector
          value={renterDemandType}
          geoLevel={geoLevel}
          colorScheme="green"
          onChange={onRenterDemandTypeChange}
        />
      )}
    </div>
  );
}

function ForecastHorizonSelector({
  value,
  onChange,
}: {
  value: ForecastHorizon;
  onChange: (horizon: ForecastHorizon) => void;
}) {
  const options = [
    { value: '1m' as const, label: '1M' },
    { value: '3m' as const, label: '3M' },
    { value: '12m' as const, label: '12M' },
  ];

  return (
    <div className="mt-1 ml-2 p-2 bg-purple-50 rounded-lg border border-purple-200">
      <div className="text-[10px] font-medium text-purple-800 mb-1.5">Forecast Horizon</div>
      <div className="flex gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={(e) => {
              e.stopPropagation();
              onChange(option.value);
            }}
            className={`flex-1 px-2 py-1 text-[10px] font-medium rounded transition-all ${
              value === option.value
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-white text-purple-700 border border-purple-300 hover:bg-purple-100'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PropertyTypeSelector({
  value,
  geoLevel,
  colorScheme,
  onChange,
}: {
  value: RentIndexType | RenterDemandType;
  geoLevel: GeoLevel;
  colorScheme: 'purple' | 'green';
  onChange: (type: any) => void;
}) {
  const options = [
    { value: 'all', label: 'All Homes' },
    { value: 'sfr', label: 'Single Family' },
    { value: 'mfr', label: 'Multi-Family' },
  ];

  const colors = colorScheme === 'purple' ? {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-800',
    active: 'bg-purple-600',
    inactive: 'text-purple-700 border-purple-300 hover:bg-purple-100',
  } : {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-800',
    active: 'bg-green-600',
    inactive: 'text-green-700 border-green-300 hover:bg-green-100',
  };

  return (
    <div className={`mt-1 ml-2 p-2 ${colors.bg} rounded-lg border ${colors.border}`}>
      <div className={`text-[10px] font-medium ${colors.text} mb-1.5`}>Property Type</div>
      <div className="flex gap-1">
        {options.map((option) => {
          const isDisabled = (option.value === 'sfr' || option.value === 'mfr') && (geoLevel === 'county' || geoLevel === 'zip');

          return (
            <button
              key={option.value}
              onClick={(e) => {
                e.stopPropagation();
                if (!isDisabled) onChange(option.value);
              }}
              disabled={isDisabled}
              title={isDisabled ? "Not available for County/Zip level" : ""}
              className={`flex-1 px-2 py-1 text-[10px] font-medium rounded transition-all ${
                isDisabled
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                  : value === option.value
                    ? `${colors.active} text-white shadow-sm`
                    : `bg-white ${colors.inactive}`
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
