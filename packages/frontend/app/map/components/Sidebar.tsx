'use client';

import Link from 'next/link';
import type { GeoLevel, ForecastHorizon, RentIndexType, RenterDemandType, NavItem, MetricCategory, ViewMode, SelectedGeography } from '../types';
import { MetricCategoryItem, ViewToggle, SidebarScoreCard, TrendDirection } from './sidebar-components';
import { GeoLevelPills } from './GeoLevelPills';

interface ScoreInfo {
  score?: number;
  trend?: number; // Change from 3 months ago
  access: 'full' | 'teaser';
  gated?: boolean;
  tierRequired?: string;
}

interface ScoreData {
  marketHealth?: ScoreInfo;
  homeready?: ScoreInfo;
  investoredge?: ScoreInfo;
  isLoading?: boolean;
}

interface SidebarProps {
  pathname: string;
  navItems: NavItem[];
  metricCategories: MetricCategory[];
  expandedCategories: string[];
  selectedMetric: string;
  geoLevel: GeoLevel;
  selectedState: string;
  forecastHorizon: ForecastHorizon;
  rentIndexType: RentIndexType;
  renterDemandType: RenterDemandType;
  sidebarWidth: number;
  viewMode: ViewMode;
  mobileMenuOpen: boolean;
  scoreData?: ScoreData;
  onToggleCategory: (id: string) => void;
  onSelectMetric: (id: string) => void;
  onGeoLevelChange: (level: GeoLevel) => void;
  onStateChange: (state: string) => void;
  onForecastHorizonChange: (horizon: ForecastHorizon) => void;
  onRentIndexTypeChange: (type: RentIndexType) => void;
  onRenterDemandTypeChange: (type: RenterDemandType) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onCloseMobileMenu: () => void;
  onScoreCardClick?: () => void;
}

export function Sidebar({
  pathname,
  navItems,
  metricCategories,
  expandedCategories,
  selectedMetric,
  geoLevel,
  selectedState,
  forecastHorizon,
  rentIndexType,
  renterDemandType,
  sidebarWidth,
  viewMode,
  mobileMenuOpen,
  scoreData,
  onToggleCategory,
  onSelectMetric,
  onGeoLevelChange,
  onStateChange,
  onForecastHorizonChange,
  onRentIndexTypeChange,
  onRenterDemandTypeChange,
  onMouseDown,
  onViewModeChange,
  onCloseMobileMenu,
  onScoreCardClick,
}: SidebarProps) {
  return (
    <aside
      className={`
        flex bg-surface-container-low elevation-2 rounded-r-2xl
        fixed md:relative inset-y-0 left-0 z-50 md:z-auto
        transform transition-transform duration-400
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}
      style={{ transitionTimingFunction: 'var(--ease-standard, cubic-bezier(0.2, 0, 0, 1))' }}
    >
      {/* M3 Navigation Rail */}
      <div className="w-16 md:w-20 border-r border-outline-variant flex flex-col items-center py-4 gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onCloseMobileMenu}
              className={`w-14 md:w-16 py-2 md:py-3 rounded-2xl flex flex-col items-center gap-1 transition-all duration-200 ${isActive ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container'
                }`}
            >
              <span className={isActive ? 'text-on-primary-container' : 'text-on-surface-variant'}>
                {item.icon}
              </span>
              <span className="text-[10px] md:text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Metric Panel - fixed 256px on mobile, dynamic sidebarWidth on desktop via CSS variable */}
      <div
        className="sidebar-panel overflow-y-auto p-3 md:p-4"
        style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}
      >
        {/* Mobile header with close button */}
        <div className="flex items-center justify-between mb-4 md:mb-4">
          <h2 className="text-base md:text-lg font-medium text-on-surface">Market Trends</h2>
          <button
            onClick={onCloseMobileMenu}
            className="md:hidden p-1.5 hover:bg-surface-container rounded-full transition-colors duration-200"
            aria-label="Close menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Mobile-only: Geo Level Pills */}
        <div className="md:hidden mb-4 pb-4 border-b border-outline-variant">
          <p className="text-xs text-on-surface-variant mb-2 font-medium uppercase tracking-wide">Geographic Level</p>
          <GeoLevelPills
            geoLevel={geoLevel}
            selectedMetric={selectedMetric}
            selectedState={selectedState}
            onGeoLevelChange={onGeoLevelChange}
            onStateChange={onStateChange}
            isMobile={true}
          />
        </div>

        {/* View Mode Toggle */}
        <ViewToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />

        {/* Score Card - carousel with all three scores */}
        <SidebarScoreCard
          marketHealthScore={scoreData?.marketHealth}
          homereadyScore={scoreData?.homeready}
          investoredgeScore={scoreData?.investoredge}
          isLoading={scoreData?.isLoading}
          onClick={onScoreCardClick}
          onUpgradeClick={() => window.location.href = '/pricing'}
        />

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
        <div className="mt-4 pt-4 border-t border-outline-variant">
          <a href="#" className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors duration-200">
            Explore Data Points
            <svg xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 -960 960 960" width="16" fill="currentColor">
              <path d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z" />
            </svg>
          </a>
        </div>
      </div>

      {/* Resize handle - hidden on mobile */}
      <div
        onMouseDown={onMouseDown}
        className="hidden md:block w-1 hover:w-1.5 bg-transparent hover:bg-primary/30 cursor-col-resize transition-all duration-200 flex-shrink-0 group"
        title="Drag to resize sidebar"
      >
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-0.5 h-8 bg-outline-variant group-hover:bg-primary rounded-full transition-colors duration-200" />
        </div>
      </div>
    </aside>
  );
}
