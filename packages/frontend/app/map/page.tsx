'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { api } from '@/lib/api/client';

// Import types and constants
import type { GeoLevel, ForecastHorizon, RentIndexType, RenterDemandType, HomeValues, NavItem, MetricCategory } from './types';
import { GEOJSON_SOURCES, FIPS_TO_STATE, US_STATES, STATE_CENTERS, GEO_ZOOM_LEVELS } from './types';

// Import components
import {
  HomeIcon, MapIcon, GraphIcon, ReportIcon, InfoIcon, PricingIcon,
  StarIcon, AttachMoneyIcon, ShowChartIcon, PeopleIcon, TrendingIcon,
  AnalyticsIcon, MenuIcon, SearchIcon, TableIcon,
} from './components';
import { SearchBar } from './components';
import { GeoLevelPills } from './components';
import { Legend } from './components';
import { Sidebar } from './components';

// Import hooks
import { useMapData } from './hooks';
import { useMapSearch } from './hooks';

// Import utils
import { getColorScale } from './utils';

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

  // Update map layers when data changes
  const updateMapLayers = useCallback(async () => {
    if (!map.current || !mapLoaded) return;

    if (!map.current.isStyleLoaded()) {
      map.current.once('idle', () => updateMapLayers());
      return;
    }

    // Remove existing layers and sources
    const layersToRemove = ['geo-fills', 'geo-borders', 'geo-labels'];
    layersToRemove.forEach(layerId => {
      if (map.current!.getLayer(layerId)) {
        map.current!.removeLayer(layerId);
      }
    });
    if (map.current.getSource('geo-data')) {
      map.current.removeSource('geo-data');
    }

    // Load appropriate GeoJSON
    let geojsonUrl: string | null = null;
    if (geoLevel === 'state' || geoLevel === 'national') {
      geojsonUrl = GEOJSON_SOURCES.state;
    } else if (geoLevel === 'county') {
      geojsonUrl = GEOJSON_SOURCES.county;
    } else if (geoLevel === 'metro') {
      geojsonUrl = GEOJSON_SOURCES.metro;
    } else if (geoLevel === 'zip' && selectedState) {
      geojsonUrl = `/geojson/zcta/${selectedState.toLowerCase()}.json`;
    }

    if (!geojsonUrl) return;

    try {
      const response = await fetch(geojsonUrl);
      const geojson = await response.json();

      // Add values to features based on geo level
      if (geoLevel === 'state' || geoLevel === 'national') {
        geojson.features.forEach((feature: any) => {
          const name = feature.properties.name;
          feature.properties.value = homeValues[name] || 0;
        });
      } else if (geoLevel === 'county') {
        geojson.features.forEach((feature: any) => {
          const fips = feature.id || feature.properties.id;
          feature.properties.value = homeValues[fips] || homeValues[String(parseInt(fips, 10))] || 0;
          feature.properties.id = fips;
          const stateFips = fips?.substring(0, 2);
          const stateAbbr = FIPS_TO_STATE[stateFips] || '';
          feature.properties.displayName = `${feature.properties.NAME || 'County'}, ${stateAbbr}`;
        });
      } else if (geoLevel === 'metro') {
        geojson.features.forEach((feature: any) => {
          const cbsaCode = feature.properties.CBSAFP || feature.properties.GEOID;
          feature.properties.value = homeValues[cbsaCode] || 0;
          feature.properties.id = cbsaCode;
          feature.properties.displayName = feature.properties.NAME || feature.properties.NAMELSAD || 'Metro Area';
        });
      } else if (geoLevel === 'zip') {
        geojson.features.forEach((feature: any) => {
          const zipCode = feature.properties.ZCTA5CE20 || feature.properties.GEOID20;
          feature.properties.value = homeValues[zipCode] || 0;
          feature.properties.id = zipCode;
          feature.properties.displayName = zipCode;
        });
      }

      map.current!.addSource('geo-data', { type: 'geojson', data: geojson });

      // Calculate color scale parameters
      const isForecast = selectedMetric === 'home_price_forecast';
      const isRentIndex = selectedMetric === 'rent_index';
      const isRenterDemand = selectedMetric === 'rent_for_houses';
      let minVal, maxVal;

      if (isRentIndex || isRenterDemand) {
        const values = Object.values(homeValues).filter(v => typeof v === 'number' && v > 0).sort((a, b) => a - b);
        if (values.length > 0) {
          minVal = values[0];
          const p95Index = Math.min(Math.floor(values.length * 0.95), values.length - 1);
          maxVal = values[p95Index];
        }
      }

      // Add fill layer
      map.current!.addLayer({
        id: 'geo-fills',
        type: 'fill',
        source: 'geo-data',
        paint: {
          'fill-color': getColorScale(geoLevel, isForecast, minVal, maxVal, isRenterDemand) as any,
          'fill-opacity': 0.6,
        },
      });

      // Add border layer
      map.current!.addLayer({
        id: 'geo-borders',
        type: 'line',
        source: 'geo-data',
        paint: {
          'line-color': '#ffffff',
          'line-width': geoLevel === 'zip' ? 0.3 : geoLevel === 'county' ? 0.5 : geoLevel === 'metro' ? 0.8 : 1.5,
        },
      });

      // Add labels for state level
      if (geoLevel === 'state' || geoLevel === 'national') {
        map.current!.addLayer({
          id: 'geo-labels',
          type: 'symbol',
          source: 'geo-data',
          layout: {
            'text-field': [
              'format',
              ['get', 'name'], { 'font-scale': 0.85, 'text-font': ['literal', ['DIN Pro Medium', 'Arial Unicode MS Regular']] },
              '\n', {},
              ['concat', '$', ['number-format', ['get', 'value'], { 'min-fraction-digits': 0, 'max-fraction-digits': 0 }]],
              { 'font-scale': 0.75, 'text-font': ['literal', ['DIN Pro Regular', 'Arial Unicode MS Regular']] },
            ],
            'text-size': 11,
            'text-anchor': 'center',
            'text-max-width': 8,
          },
          paint: {
            'text-color': '#1a1a2e',
            'text-halo-color': 'rgba(255, 255, 255, 0.9)',
            'text-halo-width': 1.5,
          },
        });
      }

      // Setup hover interactions
      setupHoverInteractions(isForecast, isRenterDemand);
    } catch (err) {
      console.error('Error loading GeoJSON:', err);
    }
  }, [geoLevel, homeValues, mapLoaded, selectedState, selectedMetric, forecastHorizon]);

  // Helper function to setup hover interactions
  const setupHoverInteractions = (isForecast: boolean, isRenterDemand: boolean) => {
    if (!map.current) return;

    map.current.on('mouseenter', 'geo-fills', () => {
      map.current!.getCanvas().style.cursor = 'pointer';
    });

    map.current.on('mouseleave', 'geo-fills', () => {
      map.current!.getCanvas().style.cursor = '';
      popup.current?.remove();
    });

    map.current.on('mousemove', 'geo-fills', (e) => {
      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        const name = feature.properties?.name || feature.properties?.displayName || feature.properties?.NAME || 'Unknown';
        const value = feature.properties?.value || 0;

        if (!popup.current) {
          popup.current = new mapboxgl.Popup({ closeButton: false, closeOnClick: false });
        }

        let displayValue: string;
        let valueColor = '#6750a4';

        if (isForecast) {
          if (value !== 0) {
            const sign = value > 0 ? '+' : '';
            displayValue = `${sign}${value.toFixed(1)}%`;
            valueColor = value > 0 ? '#b91c1c' : value < 0 ? '#3b82f6' : '#6b7280';
          } else {
            displayValue = 'No data';
          }
        } else if (isRenterDemand) {
          displayValue = value > 0 ? value.toFixed(0) : 'No data';
          valueColor = value >= 100 ? '#b91c1c' : '#3b82f6';
        } else {
          displayValue = value > 0
            ? value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })
            : 'No data';
        }

        const horizonLabel = forecastHorizon === '1m' ? '1-month' : forecastHorizon === '3m' ? '3-month' : '12-month';

        popup.current
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-family: 'Google Sans', Roboto, sans-serif; padding: 8px 12px;">
              <div style="font-weight: 500; font-size: 14px; color: #1a1a2e;">${name}</div>
              <div style="font-size: 20px; font-weight: 600; color: ${valueColor};">${displayValue}</div>
              ${isForecast ? `<div style="font-size: 11px; color: #6b7280;">${horizonLabel} forecast</div>` : ''}
            </div>
          `)
          .addTo(map.current!);
      }
    });
  };

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

  // Navigation items
  const navItems: NavItem[] = [
    { id: 'home', label: 'Home', icon: <HomeIcon />, href: '/' },
    { id: 'maps', label: 'Maps', icon: <MapIcon />, href: '/map' },
    { id: 'graphs', label: 'Graphs', icon: <GraphIcon />, href: '/graphs' },
    { id: 'reports', label: 'Reports', icon: <ReportIcon />, href: '/reports' },
    { id: 'about', label: 'About Us', icon: <InfoIcon />, href: '/about' },
    { id: 'pricing', label: 'Pricing', icon: <PricingIcon />, href: '/pricing' },
  ];

  // Metric categories
  const metricCategories: MetricCategory[] = [
    {
      id: 'popular', name: 'Popular Data', icon: <StarIcon />,
      metrics: [
        { id: 'home_value', name: 'Home Value' },
        { id: 'home_value_yoy', name: 'Home Value Growth (YoY)' },
        { id: 'for_sale_inventory', name: 'For Sale Inventory' },
        { id: 'home_price_forecast', name: 'Home Price Forecast', isPremium: true },
        { id: 'home_value_5yr', name: 'Home Value Growth (5-Year)', isPremium: true },
        { id: 'home_value_mom', name: 'Home Value Growth (MoM)', isPremium: true },
        { id: 'overvalued_pct', name: 'Overvalued %', isPremium: true },
        { id: 'days_on_market', name: 'Days on Market' },
        { id: 'home_sales', name: 'Home Sales', isPremium: true },
        { id: 'cap_rate', name: 'Cap Rate' },
        { id: 'long_term_growth', name: 'Long-Term Growth Score', isPremium: true, isNew: true },
      ],
    },
    {
      id: 'home_price_affordability', name: 'Home Price & Affordability', icon: <AttachMoneyIcon />,
      metrics: [
        { id: 'home_value', name: 'Home Value' },
        { id: 'home_value_yoy', name: 'Home Value Growth (YoY)' },
        { id: 'home_value_5yr', name: 'Home Value Growth (5-Year)', isPremium: true },
        { id: 'overvalued_pct', name: 'Overvalued %', isPremium: true },
        { id: 'sfh_value', name: 'Single Family Value', isPremium: true },
        { id: 'sfh_value_yoy', name: 'Single Family Value Growth (YoY)', isPremium: true },
        { id: 'condo_value', name: 'Condo Value', isPremium: true },
        { id: 'condo_value_yoy', name: 'Condo Value Growth (YoY)', isPremium: true },
      ],
    },
    {
      id: 'market_trends', name: 'Market Trends', icon: <ShowChartIcon />,
      metrics: [
        { id: 'for_sale_inventory', name: 'For Sale Inventory' },
        { id: 'inventory_yoy', name: 'Sale Inventory Growth (YoY)' },
        { id: 'inventory_surplus', name: 'Inventory Surplus/Deficit', isPremium: true },
        { id: 'home_sales', name: 'Home Sales', isPremium: true },
        { id: 'price_cut_pct', name: 'Price Cut %', isPremium: true },
        { id: 'days_on_market', name: 'Days on Market' },
      ],
    },
    {
      id: 'demographic', name: 'Demographic', icon: <PeopleIcon />,
      metrics: [
        { id: 'population', name: 'Population' },
        { id: 'median_income', name: 'Median Household Income' },
        { id: 'population_growth', name: 'Population Growth', isPremium: true },
        { id: 'income_growth', name: 'Income Growth', isPremium: true },
      ],
    },
    {
      id: 'investor_metrics', name: 'Investor Metrics', icon: <TrendingIcon />,
      metrics: [
        { id: 'rent_index', name: 'Rent Index' },
        { id: 'rent_for_houses', name: 'Renter Demand Index' },
        { id: 'cap_rate', name: 'Cap Rate', isPremium: true },
        { id: 'vacancy_rate', name: 'Vacancy Rate', isPremium: true },
      ],
    },
    {
      id: 'scores', name: 'PropertyIQ Scores', icon: <AnalyticsIcon />, isNew: true,
      metrics: [
        { id: 'home_price_forecast', name: 'Home Price Forecast', isPremium: true },
        { id: 'long_term_growth', name: 'Long-Term Growth Score', isPremium: true, isNew: true },
      ],
    },
  ];

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
          navItems={navItems}
          metricCategories={metricCategories}
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
