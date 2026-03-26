"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import type {
  GeoLevel,
  ForecastHorizon,
  SelectedGeography,
  SearchResult,
  MapData,
} from "@/app/map/types";
import { STATE_CENTERS, GEO_ZOOM_LEVELS } from "@/app/map/types";

import {
  SearchWidget,
  GeoLevelPills,
  Legend,
  Sidebar,
  RightDetailPanel,
} from "@/app/map/components";
import { useMapData, useMapSearch, useMapLayers } from "@/app/map/hooks";

import {
  NAV_ITEMS,
  getMetricCategories,
  isMetricSupportedForGeo,
  getMetricConfig,
  MAPBOX_ACCESS_TOKEN,
} from "@/app/map/config";

import { useEmbedMapConfig } from "./useEmbedMapConfig";
import { EmbedMapToolbar } from "./EmbedMapToolbar";

mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

export default function EmbedMapFullPage() {
  return (
    <Suspense fallback={<div className="h-screen w-full bg-surface" />}>
      <EmbedMapFullInner />
    </Suspense>
  );
}

function EmbedMapFullInner() {
  const config = useEmbedMapConfig();

  // -----------------------------------------------------------------------
  // Refs
  // -----------------------------------------------------------------------
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const popup = useRef<mapboxgl.Popup | null>(null);

  // -----------------------------------------------------------------------
  // Core state — seeded from embed config (URL params)
  // -----------------------------------------------------------------------
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [geoLevel, setGeoLevel] = useState<GeoLevel>(config.initialGeoLevel);
  const [selectedState, setSelectedState] = useState("");
  const [selectedMetric, setSelectedMetric] = useState(config.initialMetric);
  const [forecastHorizon] = useState<ForecastHorizon>("12m");

  // Sidebar state (only relevant when sidebar is enabled)
  const [expandedCategories, setExpandedCategories] = useState<string[]>([
    "popular",
  ]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [selectedGeography, setSelectedGeography] =
    useState<SelectedGeography | null>(null);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [highlightedFeature, setHighlightedFeature] =
    useState<SearchResult | null>(null);

  const metricCategories = getMetricCategories("homebuyer");

  // -----------------------------------------------------------------------
  // Data hooks
  // -----------------------------------------------------------------------
  const { mapData, dataLoading, fetchMapData } = useMapData();

  const {
    searchQuery,
    searchResults,
    searchLoading,
    showSearchResults,
    searchRef,
    searchNavigatedRef,
    handleSearch,
    handleSelectSearchResult,
    setShowSearchResults,
  } = useMapSearch({
    mapRef: map,
    onGeoLevelChange: setGeoLevel,
    onStateChange: setSelectedState,
    geoLevel,
    onHighlightFeature: setHighlightedFeature,
  });

  // -----------------------------------------------------------------------
  // Feature click handler — opens the right detail panel
  // -----------------------------------------------------------------------
  const handleFeatureClick = useCallback(
    (geography: SelectedGeography | null) => {
      setSelectedGeography(geography);
      if (geography && config.showDetailPanel) {
        setRightPanelOpen(true);
      }
    },
    [config.showDetailPanel],
  );

  // -----------------------------------------------------------------------
  // Map layers hook
  // -----------------------------------------------------------------------
  const { updateMapLayers } = useMapLayers({
    map,
    popup,
    geoLevel,
    selectedState,
    selectedMetric,
    forecastHorizon,
    mapData,
    mapLoaded,
    dataLoading,
    highlightedFeature,
    onFeatureClick: handleFeatureClick,
  });

  // -----------------------------------------------------------------------
  // Geo-level handler
  // -----------------------------------------------------------------------
  const handleGeoLevelChange = useCallback((level: GeoLevel) => {
    setGeoLevel(level);
    if (!["city", "zip", "tract"].includes(level)) {
      setSelectedState("");
    }
  }, []);

  // -----------------------------------------------------------------------
  // Auto-switch geo level if metric doesn't support it
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!isMetricSupportedForGeo(selectedMetric, geoLevel)) {
      const metricConfig = getMetricConfig(selectedMetric);
      const supportedGeos = metricConfig?.supportedGeos;
      if (supportedGeos && supportedGeos.length > 0) {
        setGeoLevel(supportedGeos[0] as GeoLevel);
      }
    }
  }, [selectedMetric, geoLevel]);

  // -----------------------------------------------------------------------
  // Data fetching — fires when parameters change
  // -----------------------------------------------------------------------
  useEffect(() => {
    const requiresState = ["city", "zip", "tract"].includes(geoLevel);
    if (requiresState) {
      if (selectedState) {
        fetchMapData(geoLevel, selectedState, selectedMetric, forecastHorizon);
      }
    } else {
      fetchMapData(geoLevel, undefined, selectedMetric, forecastHorizon);
    }
  }, [geoLevel, selectedState, selectedMetric, forecastHorizon, fetchMapData]);

  // -----------------------------------------------------------------------
  // Resize map when panels toggle
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!map.current) return;
    const timer = setTimeout(() => map.current?.resize(), 350);
    return () => clearTimeout(timer);
  }, [rightPanelOpen, sidebarCollapsed]);

  // -----------------------------------------------------------------------
  // Initialize Mapbox GL — matches main map page pattern
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: config.initialCenter,
      zoom: config.initialZoom,
      projection: "mercator",
    });

    map.current.on("load", () => setMapLoaded(true));
    map.current.on(
      "error",
      (
        e: mapboxgl.ErrorEvent & {
          error?: { message?: string; status?: number };
        },
      ) => {
        const msg = e.error?.message || "Unknown map error";
        if (!map.current?.loaded()) {
          console.error("[EmbedMap] fatal load error:", msg);
          setMapError("Map failed to load");
        } else {
          console.warn("[EmbedMap] non-fatal error:", msg);
        }
      },
    );

    const ro = new ResizeObserver(() => map.current?.resize());
    ro.observe(mapContainer.current);

    return () => {
      ro.disconnect();
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // -----------------------------------------------------------------------
  // Zoom adjustment when geo level changes
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    if (
      searchNavigatedRef.current > 0 &&
      Date.now() - searchNavigatedRef.current < 3000
    ) {
      return;
    }

    const requiresState = ["city", "zip", "tract"].includes(geoLevel);
    if (requiresState && selectedState && STATE_CENTERS[selectedState]) {
      const center = STATE_CENTERS[selectedState];
      map.current.flyTo({
        center: [center.lng, center.lat],
        zoom: center.zoom,
        duration: 800,
      });
      return;
    }

    map.current.flyTo({
      center: config.initialCenter,
      zoom: GEO_ZOOM_LEVELS[geoLevel],
      duration: 500,
    });
  }, [geoLevel, selectedState]);

  // -----------------------------------------------------------------------
  // Sidebar helpers
  // -----------------------------------------------------------------------
  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="flex h-screen w-full bg-surface overflow-hidden">
      {/* Optional sidebar */}
      {config.showSidebar && (
        <Sidebar
          pathname="/embed/map-full"
          navItems={NAV_ITEMS}
          metricCategories={metricCategories}
          expandedCategories={expandedCategories}
          selectedMetric={selectedMetric}
          geoLevel={geoLevel}
          selectedState={selectedState}
          forecastHorizon={forecastHorizon}
          rentIndexType="all"
          renterDemandType="all"
          sidebarWidth={240}
          viewMode="homebuyer"
          mobileMenuOpen={false}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebarCollapsed={() => setSidebarCollapsed((p) => !p)}
          onToggleCategory={toggleCategory}
          onSelectMetric={setSelectedMetric}
          onGeoLevelChange={handleGeoLevelChange}
          onStateChange={setSelectedState}
          onForecastHorizonChange={() => {}}
          onRentIndexTypeChange={() => {}}
          onRenterDemandTypeChange={() => {}}
          onMouseDown={() => {}}
          onViewModeChange={() => {}}
          onCloseMobileMenu={() => {}}
        />
      )}

      {/* Main map column */}
      <div className="flex-1 flex flex-col relative min-w-0">
        <EmbedMapToolbar
          config={config}
          geoLevel={geoLevel}
          selectedMetric={selectedMetric}
          selectedState={selectedState}
          onMetricChange={setSelectedMetric}
          onGeoLevelChange={handleGeoLevelChange}
          onStateChange={setSelectedState}
          searchProps={{
            searchRef,
            searchQuery,
            searchResults,
            searchLoading,
            showSearchResults,
            onSearch: handleSearch,
            onSelectResult: handleSelectSearchResult,
            onFocus: () =>
              searchResults.length > 0 && setShowSearchResults(true),
          }}
        />

        {/* Map area */}
        <div className="flex-1 relative min-h-0">
          {mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-error-container z-10">
              <p className="text-on-error-container font-medium">{mapError}</p>
            </div>
          )}

          {dataLoading && (
            <div className="absolute inset-0 z-10 animate-pulse bg-surface/80 p-4 flex flex-col">
              <div className="flex-1 bg-surface-container-high rounded-xl" />
              <div className="mt-3 h-10 w-64 bg-surface-container-high rounded-xl" />
            </div>
          )}

          <div
            ref={mapContainer}
            className="absolute inset-0"
            style={{ width: "100%", height: "100%" }}
          />

          {config.showLegend && (
            <Legend
              selectedMetric={selectedMetric}
              forecastHorizon={forecastHorizon}
              geoLevel={geoLevel}
              mapData={mapData}
            />
          )}
        </div>
      </div>

      {/* Right detail panel — conditionally rendered on region click */}
      {config.showDetailPanel && (
        <RightDetailPanel
          isOpen={rightPanelOpen}
          onClose={() => {
            setRightPanelOpen(false);
            setSelectedGeography(null);
          }}
          viewMode="homebuyer"
          geography={selectedGeography}
          geoLevel={geoLevel}
        />
      )}
    </div>
  );
}
