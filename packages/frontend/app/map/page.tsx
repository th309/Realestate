'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Import types and constants
import type { GeoLevel, ForecastHorizon, RentIndexType, RenterDemandType } from './types';
import { STATE_CENTERS, GEO_ZOOM_LEVELS } from './types';

// Import components
import { MenuIcon, TableIcon } from './components';
import { SearchBar, GeoLevelPills, Legend, Sidebar } from './components';

// Import hooks
import { useMapData, useMapSearch, useMapLayers } from './hooks';

// Import config
import { NAV_ITEMS, METRIC_CATEGORIES } from './config';

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
  const isResizing = useRef(false);
  const pathname = usePathname();

  // Use extracted hooks
  const { homeValues, dataLoading, fetchHomeValues } = useMapData();
  const {
    searchQuery, searchResults, searchLoading, showSearchResults, searchRef,
    handleSearch, handleSelectSearchResult, setShowSearchResults
  } = useMapSearch(map, setGeoLevel, setSelectedState);
  const { updateMapLayers } = useMapLayers({
    map, popup, geoLevel, selectedState, selectedMetric, forecastHorizon, homeValues, mapLoaded
  });

  // Auto-switch geo level for restricted metrics
  useEffect(() => {
    const isRentIndexMode = selectedMetric === 'rent_index';
    const isRenterDemandMode = selectedMetric === 'rent_for_houses';

    if (isRentIndexMode && ['national', 'state'].includes(geoLevel)) {
      setGeoLevel('metro');
    }
    if (isRenterDemandMode && geoLevel !== 'metro') {
      setGeoLevel('metro');
    }
  }, [selectedMetric, geoLevel]);

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

  // Reload data when geo level, selected state, metric, or forecast horizon changes
  useEffect(() => {
    if (mapLoaded) {
      if (geoLevel === 'zip') {
        if (selectedState) {
          fetchHomeValues(geoLevel, selectedState, selectedMetric, forecastHorizon, rentIndexType, renterDemandType);
        }
      } else {
        fetchHomeValues(geoLevel, undefined, selectedMetric, forecastHorizon, rentIndexType, renterDemandType);
      }
    }
  }, [geoLevel, selectedState, selectedMetric, forecastHorizon, rentIndexType, renterDemandType, fetchHomeValues, mapLoaded]);

  // Update layers when homeValues or geoLevel changes
  useEffect(() => {
    if (mapLoaded && Object.keys(homeValues).length > 0) {
      updateMapLayers();
    }
  }, [homeValues, geoLevel, mapLoaded, updateMapLayers]);

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

  // Adjust zoom for different geo levels
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    if (geoLevel === 'zip' && selectedState && STATE_CENTERS[selectedState]) {
      const center = STATE_CENTERS[selectedState];
      map.current.flyTo({ center: [center.lng, center.lat], zoom: center.zoom, duration: 800 });
      return;
    }

    map.current.flyTo({ center: [-96, 37.8], zoom: GEO_ZOOM_LEVELS[geoLevel], duration: 500 });
  }, [geoLevel, selectedState, mapLoaded]);

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const recordCount = Object.keys(homeValues).length;

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: '#f7f2fa', fontFamily: "'Google Sans', Roboto, sans-serif" }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <MenuIcon />
          </button>
          <h1 className="text-xl font-medium text-gray-900">PropertyIQ</h1>
        </div>

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

        <GeoLevelPills
          geoLevel={geoLevel}
          selectedMetric={selectedMetric}
          selectedState={selectedState}
          onGeoLevelChange={setGeoLevel}
          onStateChange={setSelectedState}
        />
      </header>

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          pathname={pathname}
          navItems={NAV_ITEMS}
          metricCategories={METRIC_CATEGORIES}
          expandedCategories={expandedCategories}
          selectedMetric={selectedMetric}
          geoLevel={geoLevel}
          forecastHorizon={forecastHorizon}
          rentIndexType={rentIndexType}
          renterDemandType={renterDemandType}
          recordCount={recordCount}
          selectedState={selectedState}
          sidebarWidth={sidebarWidth}
          onToggleCategory={toggleCategory}
          onSelectMetric={setSelectedMetric}
          onGeoLevelChange={setGeoLevel}
          onForecastHorizonChange={setForecastHorizon}
          onRentIndexTypeChange={setRentIndexType}
          onRenterDemandTypeChange={setRenterDemandType}
          onMouseDown={handleMouseDown}
        />

        {/* Map */}
        <main className="flex-1 relative" style={{ minHeight: '100%' }}>
          {mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-50 z-10">
              <p className="text-red-600 font-medium">{mapError}</p>
            </div>
          )}
          {dataLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 z-10">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
                <p className="text-gray-600">Loading {geoLevel} data...</p>
              </div>
            </div>
          )}
          <div ref={mapContainer} className="absolute inset-0" style={{ width: '100%', height: '100%' }} />

          <Legend
            selectedMetric={selectedMetric}
            forecastHorizon={forecastHorizon}
            geoLevel={geoLevel}
            homeValues={homeValues}
          />

          <button className="absolute bottom-6 right-6 bg-white shadow-lg rounded-2xl px-5 py-3 flex items-center gap-3 hover:shadow-xl transition-shadow z-10 border border-gray-200">
            <TableIcon />
            <span className="font-medium text-gray-800">Table View</span>
          </button>
        </main>
      </div>
    </div>
  );
}
