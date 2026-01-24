'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Import types and constants
import type { GeoLevel, ForecastHorizon, RentIndexType, RenterDemandType, ViewMode, SelectedGeography } from './types';
import { STATE_CENTERS, GEO_ZOOM_LEVELS } from './types';

// Import components
import { MenuIcon, TableIcon } from './components';
import { SearchBar, GeoLevelPills, Legend, Sidebar, DataTableModal, RightDetailPanel } from './components';

// Import hooks
import { useMapData, useMapSearch, useMapLayers } from './hooks';
import { useScoreData } from './hooks/useScoreData';

// Import config
import { NAV_ITEMS, getMetricCategories, isMetricSupportedForGeo, getMetricConfig } from './config';

const VIEW_MODE_STORAGE_KEY = 'propertyiq-view-mode';

mapboxgl.accessToken = 'pk.eyJ1IjoidHJveWhvdXN0b24iLCJhIjoiY21hZzFzaXJjMGEzcDJqcHByb29xM2lndSJ9.sataRzk3HaLNolfOnIc7Jw';

export default function MapPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const popup = useRef<mapboxgl.Popup | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [geoLevel, setGeoLevel] = useState<GeoLevel>('state');
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedMetric, setSelectedMetric] = useState('home_value');
  const [forecastHorizon, setForecastHorizon] = useState<ForecastHorizon>('12m');
  const [rentIndexType, setRentIndexType] = useState<RentIndexType>('all');
  const [renterDemandType, setRenterDemandType] = useState<RenterDemandType>('all');
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['popular']);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [viewMode, setViewMode] = useState<ViewMode>('homebuyer');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedGeography, setSelectedGeography] = useState<SelectedGeography | null>(null);
  const [showTableView, setShowTableView] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const isResizing = useRef(false);
  const pathname = usePathname();

  // Load view mode from localStorage on mount
  useEffect(() => {
    const savedViewMode = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (savedViewMode === 'homebuyer' || savedViewMode === 'investor') {
      setViewMode(savedViewMode);
    }
  }, []);

  // Handler to update view mode and persist to localStorage
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  }, []);

  // Compute metric categories based on view mode
  const metricCategories = useMemo(() => getMetricCategories(viewMode), [viewMode]);

  // Use extracted hooks
  const { mapData, dataLoading, fetchMapData } = useMapData();
  const {
    searchQuery, searchResults, searchLoading, showSearchResults, searchRef, searchNavigatedRef,
    handleSearch, handleSelectSearchResult, setShowSearchResults
  } = useMapSearch({ mapRef: map, onGeoLevelChange: setGeoLevel, onStateChange: setSelectedState });
  // Handle feature click - open right panel with geography details
  const handleFeatureClick = useCallback((geography: SelectedGeography | null) => {
    setSelectedGeography(geography);
    if (geography) {
      setRightPanelOpen(true);
    }
  }, []);

  const { updateMapLayers } = useMapLayers({
    map, popup, geoLevel, selectedState, selectedMetric, forecastHorizon, mapData, mapLoaded,
    onFeatureClick: handleFeatureClick
  });

  // Fetch score data for the selected geography to display in sidebars
  const { data: scoreResponse, loading: scoresLoading } = useScoreData(
    geoLevel as any,
    selectedGeography?.id ?? null,
    { expanded: false }
  );

  // Map score response to sidebar format
  const sidebarScoreData = useMemo(() => {
    if (!scoreResponse) return undefined;

    const type = viewMode === 'investor' ? 'investoredge' : 'homeready';
    const scoreObj = scoreResponse[type as keyof typeof scoreResponse];

    if (typeof scoreObj === 'object' && scoreObj !== null && 'score' in scoreObj) {
      return {
        score: (scoreObj as any).score ?? undefined,
        scoreTrend: (scoreObj as any).trend ? {
          direction: (scoreObj as any).trend,
          value: `${(scoreObj as any).trendChange >= 0 ? '+' : ''}${(scoreObj as any).trendChange?.toFixed(1) ?? '0.0'}%`
        } : undefined,
        isLoading: scoresLoading,
        summaryText: (scoreObj as any).statusMessage
      };
    }
    return undefined;
  }, [scoreResponse, viewMode, scoresLoading]);

  // Auto-switch geo level when metric doesn't support current level
  // Uses central config as single source of truth for metric/geo compatibility
  useEffect(() => {
    // Check if current geoLevel is supported for the selected metric
    if (!isMetricSupportedForGeo(selectedMetric, geoLevel)) {
      // Get the first supported geo level from the metric's config
      const config = getMetricConfig(selectedMetric);
      const supportedGeos = config?.supportedGeos;
      if (supportedGeos && supportedGeos.length > 0) {
        // Auto-switch to the first supported geo (usually the broadest available)
        setGeoLevel(supportedGeos[0] as GeoLevel);
      }
    }
  }, [selectedMetric, geoLevel]);

  // Handler to change geo level and clear state filter for levels that don't need it
  const handleGeoLevelChange = useCallback((level: GeoLevel) => {
    setGeoLevel(level);
    // Clear state filter when switching to levels that don't require it
    // (only city, zip, tract need state filtering)
    if (!['city', 'zip', 'tract'].includes(level)) {
      setSelectedState('');
    }
  }, []);

  // Sidebar resize handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = e.clientX - 80;
      setSidebarWidth(Math.min(Math.max(newWidth, 200), 500));
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Fetch data immediately on mount and when parameters change (don't wait for map)
  useEffect(() => {
    // City, ZIP, and Tract levels require a state selection
    const requiresState = ['city', 'zip', 'tract'].includes(geoLevel);
    if (requiresState) {
      if (selectedState) {
        fetchMapData(geoLevel, selectedState, selectedMetric, forecastHorizon, rentIndexType, renterDemandType);
      }
    } else {
      fetchMapData(geoLevel, undefined, selectedMetric, forecastHorizon, rentIndexType, renterDemandType);
    }
  }, [geoLevel, selectedState, selectedMetric, forecastHorizon, rentIndexType, renterDemandType, fetchMapData]);

  // Update layers when mapData or geoLevel changes
  // Always update when geoLevel changes to ensure correct geographic shapes are shown
  useEffect(() => {
    if (!mapLoaded) return;

    // Some levels require state selection before we can show anything
    const requiresState = ['city', 'zip', 'tract'].includes(geoLevel);
    if (requiresState && !selectedState) return;

    // Always update layers when geoLevel changes - shapes should update immediately
    // Data coloring will show "no data" until mapData loads
    updateMapLayers();
  }, [mapData, geoLevel, selectedState, mapLoaded, updateMapLayers]);

  // Handle Mapbox resize when right panel opens/closes
  useEffect(() => {
    if (!map.current) return;

    // Trigger a resize after a small delay to allow for animations
    const timer = setTimeout(() => {
      map.current?.resize();
    }, 350);

    return () => clearTimeout(timer);
  }, [rightPanelOpen]);

  // Initialize map
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-96, 37.8],
      zoom: 3.5,
      projection: 'mercator',
    });

    map.current.on('load', () => setMapLoaded(true));
    map.current.on('error', (e) => {
      console.error('Map error:', e);
      setMapError('Map failed to load');
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Adjust zoom for different geo levels (skip if search already handled navigation)
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Skip if search just navigated (it already set the zoom via fitBounds)
    if (searchNavigatedRef.current) {
      searchNavigatedRef.current = false;
      return;
    }

    // City, ZIP, and Tract levels zoom to the selected state
    const requiresState = ['city', 'zip', 'tract'].includes(geoLevel);
    if (requiresState && selectedState && STATE_CENTERS[selectedState]) {
      const center = STATE_CENTERS[selectedState];
      map.current.flyTo({ center: [center.lng, center.lat], zoom: center.zoom, duration: 800 });
      return;
    }

    map.current.flyTo({ center: [-96, 37.8], zoom: GEO_ZOOM_LEVELS[geoLevel], duration: 500 });
  }, [geoLevel, selectedState, mapLoaded, searchNavigatedRef]);

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  return (
    <div className="flex flex-col bg-surface" style={{ fontFamily: "var(--font-roboto), 'Roboto', system-ui, sans-serif", height: 'calc(100dvh - 64px - 44px)' }}>
      {/* M3 Top App Bar */}
      {/* Map Controls Toolbar */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-3 z-20 shadow-sm">
        <div className="max-w-[1920px] mx-auto flex flex-col md:flex-row items-center gap-4">

          {/* Top Row (Desktop) or Only Row (Mobile) */}
          <div className="flex items-center gap-4 w-full md:w-auto flex-1">
            {/* Sidebar Toggle */}
            <button
              className="p-2.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 rounded-full transition-all duration-200 active:scale-95 flex-shrink-0"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle sidebar"
            >
              <MenuIcon />
            </button>

            {/* Search Bar - Flexible Width */}
            <div className="flex-1 max-w-xl">
              <SearchBar
                searchRef={searchRef}
                searchQuery={searchQuery}
                searchResults={searchResults}
                searchLoading={searchLoading}
                showSearchResults={showSearchResults}
                onSearch={handleSearch}
                onSelectResult={handleSelectSearchResult}
                onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
              />
            </div>
          </div>

          {/* Desktop Geo Pills */}
          <div className="hidden md:block flex-shrink-0">
            <GeoLevelPills
              geoLevel={geoLevel}
              selectedMetric={selectedMetric}
              selectedState={selectedState}
              onGeoLevelChange={handleGeoLevelChange}
              onStateChange={setSelectedState}
            />
          </div>

          {/* Mobile Geo Pills (Stacked) */}
          <div className="md:hidden w-full overflow-x-auto pb-1">
            <div className="flex justify-center min-w-max px-2">
              <GeoLevelPills
                geoLevel={geoLevel}
                selectedMetric={selectedMetric}
                selectedState={selectedState}
                onGeoLevelChange={handleGeoLevelChange}
                onStateChange={setSelectedState}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* M3 Scrim - Mobile overlay backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-on-surface/40 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        <Sidebar
          pathname={pathname}
          navItems={NAV_ITEMS}
          metricCategories={metricCategories}
          expandedCategories={expandedCategories}
          selectedMetric={selectedMetric}
          geoLevel={geoLevel}
          selectedState={selectedState}
          forecastHorizon={forecastHorizon}
          rentIndexType={rentIndexType}
          renterDemandType={renterDemandType}
          sidebarWidth={sidebarWidth}
          viewMode={viewMode}
          mobileMenuOpen={mobileMenuOpen}
          onToggleCategory={toggleCategory}
          onSelectMetric={setSelectedMetric}
          onGeoLevelChange={handleGeoLevelChange}
          onStateChange={setSelectedState}
          onForecastHorizonChange={setForecastHorizon}
          onRentIndexTypeChange={setRentIndexType}
          onRenterDemandTypeChange={setRenterDemandType}
          onMouseDown={handleMouseDown}
          onViewModeChange={handleViewModeChange}
          onCloseMobileMenu={() => setMobileMenuOpen(false)}
          scoreData={sidebarScoreData}
          onScoreCardClick={() => selectedGeography && setRightPanelOpen(true)}
        />

        {/* Map */}
        <main className="flex-1 relative" style={{ minHeight: '100%' }}>
          {mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-error-container z-10">
              <p className="text-on-error-container font-medium">{mapError}</p>
            </div>
          )}
          {dataLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface/80 z-10">
              <div className="flex flex-col items-center gap-3">
                {/* M3 Circular Progress Indicator */}
                <div className="w-8 h-8 border-4 border-primary-container border-t-primary rounded-full animate-spin"></div>
                <p className="text-on-surface-variant">Loading {geoLevel} data...</p>
              </div>
            </div>
          )}
          <div ref={mapContainer} className="absolute inset-0" style={{ width: '100%', height: '100%' }} />

          <Legend
            selectedMetric={selectedMetric}
            forecastHorizon={forecastHorizon}
            geoLevel={geoLevel}
            mapData={mapData}
          />

          {/* M3 Extended FAB */}
          <button
            onClick={() => setShowTableView(true)}
            className="absolute bottom-16 right-3 md:bottom-20 md:right-6 bg-primary-container elevation-3 rounded-2xl px-3 md:px-5 py-2 md:py-3 flex items-center gap-2 md:gap-3 hover:elevation-4 transition-all duration-200 z-10 text-on-primary-container"
          >
            <TableIcon />
            <span className="hidden sm:inline font-medium">Table View</span>
          </button>

          {/* Data Table Modal */}
          <DataTableModal
            isOpen={showTableView}
            onClose={() => setShowTableView(false)}
            mapData={mapData}
            selectedMetric={selectedMetric}
            geoLevel={geoLevel}
            forecastHorizon={forecastHorizon}
          />
        </main>

        {/* Right Detail Panel - shows when a region is clicked */}
        <RightDetailPanel
          isOpen={rightPanelOpen}
          onClose={() => {
            setRightPanelOpen(false);
            setSelectedGeography(null);
          }}
          viewMode={viewMode}
          geography={selectedGeography}
          geoLevel={geoLevel}
          isAdmin={true} // TODO: Replace with actual admin check
        />
      </div>
    </div>
  );
}
