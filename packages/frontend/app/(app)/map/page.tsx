"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import type { GeoLevel, SearchResult, MapData } from "./types";

import { Sidebar, RightDetailPanel, MapContextMenu } from "./components";
import { MapToolbar } from "./MapToolbar";
import { MapCanvas } from "./MapCanvas";

import { useMapData, useMapSearch, useMapLayers } from "./hooks";
import { useScoreData } from "./hooks/useScoreData";
import { useViewModePreference } from "./hooks/useViewModePreference";
import { useSidebarLayout } from "./hooks/useSidebarLayout";
import { useMapViewParams } from "./hooks/useMapViewParams";
import { useMapInstance } from "./hooks/useMapInstance";
import { useMapSelection } from "./hooks/useMapSelection";
import { useSidebarScoreData } from "./hooks/useSidebarScoreData";
import { useMapCamera } from "./hooks/useMapCamera";
import { useMapDeepLinkNav } from "./hooks/useMapDeepLinkNav";

import { NAV_ITEMS, MAPBOX_ACCESS_TOKEN } from "./config";
import { useEntitlements } from "@/lib/entitlements";
import {
  usePreferences,
  useTopMarketMatches,
  useMarketMatch,
} from "@/lib/data";
import { trackEvent } from "@/lib/analytics/tracker";

mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

export default function MapPage() {
  return (
    <Suspense fallback={<div className="h-screen w-full bg-surface" />}>
      <MapPageInner />
    </Suspense>
  );
}

function MapPageInner() {
  const pathname = usePathname();

  const { isMetricGated } = useEntitlements();

  const { viewMode, handleViewModeChange } = useViewModePreference();

  const {
    geoLevel,
    setGeoLevel,
    selectedState,
    setSelectedState,
    selectedMetric,
    setSelectedMetric,
    forecastHorizon,
    setForecastHorizon,
    rentIndexType,
    setRentIndexType,
    renterDemandType,
    setRenterDemandType,
    expandedCategories,
    toggleCategory,
    metricCategories,
  } = useMapViewParams({ viewMode, isMetricGated });

  const {
    sidebarWidth,
    sidebarCollapsed,
    handleToggleSidebarCollapsed,
    handleMouseDown,
  } = useSidebarLayout();

  const { mapContainer, map, popup, mapLoaded, mapError } =
    useMapInstance(geoLevel);

  const {
    selectedGeography,
    setSelectedGeography,
    rightPanelOpen,
    setRightPanelOpen,
    contextMenu,
    setContextMenu,
    handleFeatureClick,
    handleFeatureContextMenu,
  } = useMapSelection();

  const [highlightedFeature, setHighlightedFeature] =
    useState<SearchResult | null>(null);
  const [showTableView, setShowTableView] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Market Match toggle state
  const [scoreViewMode, setScoreViewMode] =
    useState<Parameters<typeof MapToolbar>[0]["scoreViewMode"]>("piq");
  const { preferences } = usePreferences();
  const quizCompleted = !!preferences?.quiz_completed_at;

  // Fetch match scores for choropleth when "Your Match" is active
  const { matches: topMatches, isLoading: matchesLoading } =
    useTopMarketMatches({
      geoLevel,
      limit: 500,
      enabled: scoreViewMode === "match" && quizCompleted,
    });

  // Fetch single region match for right panel
  const { match: selectedMatch } = useMarketMatch({
    geoLevel,
    regionId: selectedGeography?.id ?? null,
    enabled: scoreViewMode === "match" && quizCompleted,
  });

  const { mapData, dataLoading, fetchMapData } = useMapData();

  // Convert match scores to MapData for choropleth overlay
  const matchMapData = useMemo<MapData>(() => {
    if (scoreViewMode !== "match" || topMatches.length === 0) return {};
    const data: MapData = {};
    for (const m of topMatches) {
      data[m.regionId] = m.matchScore;
    }
    return data;
  }, [scoreViewMode, topMatches]);

  // Use match data or metric data for map layers depending on toggle
  const activeMapData = scoreViewMode === "match" ? matchMapData : mapData;
  const effectiveDataLoading =
    scoreViewMode === "match" ? matchesLoading : dataLoading;

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
    accessToken: mapboxgl.accessToken || "",
    geoLevel,
    onHighlightFeature: setHighlightedFeature,
  });

  // When in match mode, override metric to "index" style (0-100 score)
  const effectiveMetric =
    scoreViewMode === "match" ? "propertyiq_score" : selectedMetric;

  useMapLayers({
    map,
    popup,
    geoLevel,
    selectedState,
    selectedMetric: effectiveMetric,
    forecastHorizon,
    mapData: activeMapData,
    mapLoaded,
    dataLoading: effectiveDataLoading,
    highlightedFeature,
    onFeatureClick: handleFeatureClick,
    onFeatureContextMenu: handleFeatureContextMenu,
  });

  // Single fetch through data binding layer: scores with 3-month trend for sidebar + right panel
  const { data: scoreResponse, loading: scoresLoading } = useScoreData(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    geoLevel as any,
    selectedGeography?.id ?? null,
    { expanded: true, historyMonths: 3 },
  );

  const sidebarScoreData = useSidebarScoreData(scoreResponse, scoresLoading);

  // Handler to change geo level and clear state filter for levels that don't need it
  const handleGeoLevelChange = useCallback(
    (level: GeoLevel) => {
      setGeoLevel(level);
      setSelectedGeography(null);
      setRightPanelOpen(false);
      // Clear state filter when switching to levels that don't require it
      // (only city, zip, tract need state filtering)
      if (!["city", "zip", "tract"].includes(level)) {
        setSelectedState("");
      }
    },
    [setGeoLevel, setSelectedState, setSelectedGeography, setRightPanelOpen],
  );

  const handleSelectMetric = useCallback(
    (id: string) => {
      trackEvent("feature.map_filter", { metric_id: id, geo_level: geoLevel });
      setSelectedMetric(id);
    },
    [geoLevel, setSelectedMetric],
  );

  // Deep-link navigation (/map?geo=...&id=...)
  useMapDeepLinkNav({
    mapRef: map,
    mapLoaded,
    onFeatureClick: handleFeatureClick,
    onSelectSearchResult: handleSelectSearchResult,
  });

  // Camera: zoom on geo/state change + close context menu on map move
  useMapCamera({
    mapRef: map,
    mapLoaded,
    geoLevel,
    selectedState,
    searchNavigatedRef,
    setContextMenu,
  });

  // Fetch data immediately on mount and when parameters change (don't wait for map)
  useEffect(() => {
    // City, ZIP, and Tract levels require a state selection
    const requiresState = ["city", "zip", "tract"].includes(geoLevel);
    if (requiresState) {
      if (selectedState) {
        fetchMapData(
          geoLevel,
          selectedState,
          selectedMetric,
          forecastHorizon,
          rentIndexType,
          renterDemandType,
        );
      }
    } else {
      fetchMapData(
        geoLevel,
        undefined,
        selectedMetric,
        forecastHorizon,
        rentIndexType,
        renterDemandType,
      );
    }
  }, [
    geoLevel,
    selectedState,
    selectedMetric,
    forecastHorizon,
    rentIndexType,
    renterDemandType,
    fetchMapData,
  ]);

  return (
    <div
      className="absolute inset-0 flex flex-col bg-surface overflow-hidden"
      style={{
        fontFamily: "var(--font-roboto), 'Roboto', system-ui, sans-serif",
      }}
    >
      <MapToolbar
        searchRef={searchRef}
        searchQuery={searchQuery}
        searchResults={searchResults}
        searchLoading={searchLoading}
        showSearchResults={showSearchResults}
        onSearch={handleSearch}
        onSelectSearchResult={handleSelectSearchResult}
        onShowSearchResults={setShowSearchResults}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        geoLevel={geoLevel}
        selectedMetric={selectedMetric}
        selectedState={selectedState}
        onGeoLevelChange={handleGeoLevelChange}
        onStateChange={setSelectedState}
        quizCompleted={quizCompleted}
        scoreViewMode={scoreViewMode}
        onScoreViewModeChange={setScoreViewMode}
      />

      <div className="flex-1 flex h-0 overflow-hidden relative">
        {/* M3 Scrim - Mobile overlay backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-on-surface/40 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        <div data-tour="metric-sidebar" className="min-h-0 overflow-hidden">
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
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebarCollapsed={handleToggleSidebarCollapsed}
            onToggleCategory={toggleCategory}
            onSelectMetric={handleSelectMetric}
            onGeoLevelChange={handleGeoLevelChange}
            onStateChange={setSelectedState}
            onForecastHorizonChange={setForecastHorizon}
            onRentIndexTypeChange={setRentIndexType}
            onRenterDemandTypeChange={setRenterDemandType}
            onMouseDown={handleMouseDown}
            onViewModeChange={handleViewModeChange}
            onCloseMobileMenu={() => setMobileMenuOpen(false)}
            scoreData={sidebarScoreData}
            onScoreCardClick={() =>
              selectedGeography && setRightPanelOpen(true)
            }
          />
        </div>

        {/* Map */}
        <MapCanvas
          mapContainer={mapContainer}
          mapError={mapError}
          effectiveDataLoading={effectiveDataLoading}
          effectiveMetric={effectiveMetric}
          selectedMetric={selectedMetric}
          forecastHorizon={forecastHorizon}
          geoLevel={geoLevel}
          activeMapData={activeMapData}
          mapData={mapData}
          scoreViewMode={scoreViewMode}
          showTableView={showTableView}
          onShowTableView={setShowTableView}
        />

        {/* Right-click context menu */}
        {contextMenu && (
          <MapContextMenu
            geography={contextMenu.geography}
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
          />
        )}

        {/* Right Detail Panel - shows when a region is clicked */}
        <RightDetailPanel
          isOpen={rightPanelOpen}
          onClose={() => {
            setRightPanelOpen(false);
            setSelectedGeography(null);
          }}
          geography={selectedGeography}
          geoLevel={geoLevel}
          matchScore={
            selectedMatch
              ? {
                  matchScore: selectedMatch.matchScore,
                  budgetMatch: selectedMatch.budgetMatch,
                }
              : null
          }
        />
      </div>
    </div>
  );
}
