/**
 * Map Layers Hook
 */

import { useCallback, useRef, useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import type {
  GeoLevel,
  ForecastHorizon,
  MapData,
  SelectedGeography,
  SearchResult,
} from "../types";
import {
  getMetricFormat,
  calculateValueRange,
  computeScreenSpaceRatios,
  computeCalloutPositions,
  buildLeaderLineGeojson,
  syncCalloutMarkers,
  updateCalloutOpacity,
  removeAllCalloutMarkers,
  removeAllManagedLayers,
  addMapLayers,
  addLeaderLineLayers,
  computeFillColor,
  setupInteractions,
  addValuesToFeatures,
  fetchWithRetry,
  getGeojsonUrl,
  calculateHighlightFilter,
  createLabelPoints,
  type LabelFeature,
  type MarkerStore,
} from "../utils";
import { useMetricFreshness } from "@/lib/data/hooks";
import { fetchZipDisplayNames } from "@/lib/data";

interface UseMapLayersProps {
  map: React.MutableRefObject<mapboxgl.Map | null>;
  popup: React.MutableRefObject<mapboxgl.Popup | null>;
  geoLevel: GeoLevel;
  selectedState: string;
  selectedMetric: string;
  forecastHorizon: ForecastHorizon;
  mapData: MapData;
  mapLoaded: boolean;
  dataLoading?: boolean;
  highlightedFeature?: SearchResult | null;
  onFeatureClick?: (geography: SelectedGeography | null) => void;
  onFeatureContextMenu?: (info: {
    geography: SelectedGeography;
    x: number;
    y: number;
  }) => void;
  geoDataRef: import("react").MutableRefObject<
    import("geojson").FeatureCollection | null
  >;
}

export function useMapLayers({
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
  onFeatureClick,
  onFeatureContextMenu,
  geoDataRef,
}: UseMapLayersProps) {
  const { formattedDate: selectedMetricFreshnessDate } = useMetricFreshness(
    selectedMetric,
    geoLevel,
  );
  // Store current geoLevel in ref for click handler
  const geoLevelRef = useRef(geoLevel);
  const updateIdRef = useRef(0);
  const zoomHandlerRef = useRef<(() => void) | null>(null);
  const markersRef = useRef<MarkerStore>(new Map());
  // Set when the boundary (GeoJSON) fetch fails outright, so the caller can
  // render an honest failure state instead of silently showing an empty map.
  const [boundaryError, setBoundaryError] = useState(false);

  useEffect(() => {
    geoLevelRef.current = geoLevel;
  }, [geoLevel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (zoomHandlerRef.current && map.current) {
        map.current.off("zoomend", zoomHandlerRef.current);
      }
      removeAllCalloutMarkers(markersRef.current);
    };
  }, []);

  const updateMapLayers = useCallback(async () => {
    const updateId = ++updateIdRef.current;

    if (!map.current || !mapLoaded) return;

    if (!map.current.isStyleLoaded()) {
      map.current.once("idle", () => {
        if (updateId === updateIdRef.current) updateMapLayers();
      });
      return;
    }

    // Clean up zoom handler and callout markers from previous render
    if (zoomHandlerRef.current && map.current) {
      map.current.off("zoomend", zoomHandlerRef.current);
      zoomHandlerRef.current = null;
    }
    removeAllCalloutMarkers(markersRef.current);

    // Remove existing layers and sources
    removeAllManagedLayers(map.current);

    // Get GeoJSON URL
    const geojsonUrl = getGeojsonUrl(geoLevel, selectedState);
    if (!geojsonUrl) return;

    // Fresh attempt — clear any error from a previous failed load.
    setBoundaryError(false);

    try {
      // Use retry logic for county and zip (large datasets that can timeout on cold cache)
      const useRetry = geoLevel === "county" || geoLevel === "zip";
      const geojsonPromise = useRetry
        ? fetchWithRetry(geojsonUrl, 3, 1000)
        : fetch(geojsonUrl);

      // Fetch zip display names in parallel (city, state labels from geographies table)
      const zipNamesPromise =
        geoLevel === "zip" && selectedState
          ? fetchZipDisplayNames(selectedState).catch(() => undefined)
          : Promise.resolve(undefined);

      const [response, zipNameLookup] = await Promise.all([
        geojsonPromise,
        zipNamesPromise,
      ]);

      if (updateId !== updateIdRef.current) return;

      const geojson = await response.json();

      if (updateId !== updateIdRef.current) return;

      // Add values to features
      addValuesToFeatures(geojson, geoLevel, mapData, zipNameLookup);

      // Remove source again right before adding (handles race condition)
      removeAllManagedLayers(map.current!);

      // Store the loaded FeatureCollection for consumers (e.g. cinematic zoom hook)
      geoDataRef.current = geojson as import("geojson").FeatureCollection;

      // Add source
      map.current!.addSource("geo-data", { type: "geojson", data: geojson });

      // Create label points for state/national (single centered label per geography)
      const labelPointsGeojson =
        geoLevel === "state" || geoLevel === "national"
          ? createLabelPoints(geojson, geoLevel)
          : undefined;

      // Determine metric format for display - uses shared utility for consistency with legend
      const metricFormat = getMetricFormat(selectedMetric);
      const { min: minVal, max: maxVal } = calculateValueRange(
        mapData,
        metricFormat,
        selectedMetric,
        geoLevel,
      );

      // Add layers - uses same min/max as legend for consistent colors
      addMapLayers({
        map: map.current!,
        geoLevel,
        metricFormat,
        minVal,
        maxVal,
        labelPointsGeojson,
        highlightedFeature,
      });

      // Leader lines + callout labels for small states at state level
      if (geoLevel === "state" && labelPointsGeojson) {
        // Build LabelFeature array from the label points
        const labelFeatures: LabelFeature[] = labelPointsGeojson.features.map(
          (f: any) => ({
            name: f.properties.name,
            value: f.properties.value,
            polylabel: [
              f.properties.polylabelLng,
              f.properties.polylabelLat,
            ] as [number, number],
            bbox: [
              f.properties.bboxMinLng,
              f.properties.bboxMinLat,
              f.properties.bboxMaxLng,
              f.properties.bboxMaxLat,
            ] as [number, number, number, number],
            screenSpaceRatio: 0,
            fillColor: "",
          }),
        );

        // Compute fill colors for each state (matching geo-fills)
        for (const lf of labelFeatures) {
          lf.fillColor = computeFillColor(lf.value, minVal, maxVal);
        }

        // Function to update labels on zoom
        const updateLabelsForZoom = () => {
          if (!map.current) return;

          computeScreenSpaceRatios(labelFeatures, map.current);

          const source = map.current.getSource("geo-labels-data") as
            | mapboxgl.GeoJSONSource
            | undefined;
          if (source) {
            const updatedData = {
              ...labelPointsGeojson,
              features: labelPointsGeojson.features.map(
                (f: any, i: number) => ({
                  ...f,
                  properties: {
                    ...f.properties,
                    screenSpaceRatio: labelFeatures[i]?.screenSpaceRatio ?? 0,
                  },
                }),
              ),
            };
            source.setData(updatedData);
          }

          const callouts = computeCalloutPositions(labelFeatures, map.current);
          const lineGeojson = buildLeaderLineGeojson(callouts);

          addLeaderLineLayers(map.current, lineGeojson);
          syncCalloutMarkers(
            markersRef.current,
            map.current,
            callouts,
            metricFormat,
          );
          updateCalloutOpacity(markersRef.current, labelFeatures);
        };

        updateLabelsForZoom();
        map.current!.on("zoomend", updateLabelsForZoom);
        zoomHandlerRef.current = updateLabelsForZoom;
      }

      // Setup hover and click interactions
      setupInteractions(
        map.current!,
        popup,
        metricFormat,
        forecastHorizon,
        geoLevelRef,
        selectedMetricFreshnessDate,
        onFeatureClick,
        onFeatureContextMenu,
      );
    } catch (err) {
      console.error("Error loading GeoJSON:", err);
      // Stale request (superseded by a newer geoLevel/state change) — don't
      // surface an error for a fetch nobody's waiting on anymore.
      if (updateId === updateIdRef.current) setBoundaryError(true);
    }
  }, [
    geoLevel,
    mapData,
    mapLoaded,
    selectedState,
    selectedMetric,
    selectedMetricFreshnessDate,
    forecastHorizon,
    map,
    popup,
    highlightedFeature,
    onFeatureClick,
    onFeatureContextMenu,
  ]);

  // Effect to trigger logic when core dependencies change
  useEffect(() => {
    if (!mapLoaded) return;

    // Skip painting while data is still loading — prevents rendering GeoJSON
    // with stale data from the previous geoLevel (which shows no colors).
    // The effect will re-fire when dataLoading becomes false.
    if (dataLoading) return;

    const requiresState = ["city", "zip", "tract"].includes(geoLevel);
    if (requiresState && !selectedState) {
      // Clear layers if state is required but not selected — this is an
      // intentional empty state, not a failure, so clear any stale error.
      if (map.current) {
        removeAllManagedLayers(map.current);
      }
      setBoundaryError(false);
      return;
    }

    updateMapLayers();
  }, [geoLevel, selectedState, mapLoaded, dataLoading, updateMapLayers]);

  // Effect for instant highlight update without full re-fetch if level/state didn't change
  useEffect(() => {
    if (!map.current || !mapLoaded || !map.current.getLayer("geo-highlight"))
      return;

    // No search result selected — filter matches nothing, same as
    // addMapLayers' initial (unhighlighted) state.
    const filter = highlightedFeature
      ? calculateHighlightFilter(highlightedFeature, geoLevel)
      : ["==", ["get", "id"], "___none___"];
    map.current.setFilter("geo-highlight", filter);
  }, [highlightedFeature, geoLevel, mapLoaded]);

  return { updateMapLayers, boundaryError };
}
