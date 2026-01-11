'use client';

import Link from 'next/link';
import type { GeoLevel, ForecastHorizon, RentIndexType, RenterDemandType, NavItem, MetricCategory, ViewMode } from '../types';
import { DataSummary, MetricCategoryItem, ViewToggle } from './sidebar-components';

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
  viewMode: ViewMode;
  onToggleCategory: (id: string) => void;
  onSelectMetric: (id: string) => void;
  onGeoLevelChange: (level: GeoLevel) => void;
  onForecastHorizonChange: (horizon: ForecastHorizon) => void;
  onRentIndexTypeChange: (type: RentIndexType) => void;
  onRenterDemandTypeChange: (type: RenterDemandType) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onViewModeChange: (mode: ViewMode) => void;
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
  viewMode,
  onToggleCategory,
  onSelectMetric,
  onGeoLevelChange,
  onForecastHorizonChange,
  onRentIndexTypeChange,
  onRenterDemandTypeChange,
  onMouseDown,
  onViewModeChange,
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

        {/* View Mode Toggle */}
        <ViewToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />

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
