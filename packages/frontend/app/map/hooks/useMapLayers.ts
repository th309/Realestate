/**
 * Map Layers Hook
 */

import { useCallback, useRef, useEffect } from "react";
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
  calculatePolylabel,
  getGeometryBbox,
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
  type LabelFeature,
  type MarkerStore,
} from "../utils";
import { useMetricFreshness } from "@/lib/data/hooks";

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

    try {
      // Use retry logic for county and zip (large datasets that can timeout on cold cache)
      const useRetry = geoLevel === "county" || geoLevel === "zip";
      const response = useRetry
        ? await fetchWithRetry(geojsonUrl, 3, 1000)
        : await fetch(geojsonUrl);

      if (updateId !== updateIdRef.current) return;

      const geojson = await response.json();

      if (updateId !== updateIdRef.current) return;

      // Add values to features
      addValuesToFeatures(geojson, geoLevel, mapData);

      // Remove source again right before adding (handles race condition)
      removeAllManagedLayers(map.current!);

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
      // Clear layers if state is required but not selected
      if (map.current) {
        removeAllManagedLayers(map.current);
      }
      return;
    }

    updateMapLayers();
  }, [geoLevel, selectedState, mapLoaded, dataLoading, updateMapLayers]);

  // Effect for instant highlight update without full re-fetch if level/state didn't change
  useEffect(() => {
    if (!map.current || !mapLoaded || !map.current.getLayer("geo-highlight"))
      return;

    // Build highlight filter inline — same logic as map-layer-config
    const filter = buildHighlightFilter(highlightedFeature, geoLevel);
    map.current.setFilter("geo-highlight", filter);
  }, [highlightedFeature, geoLevel, mapLoaded]);

  return { updateMapLayers };
}

/**
 * Build highlight filter for instant highlight updates (without full layer rebuild).
 * Mirrors the logic in map-layer-config.ts calculateHighlightFilter.
 */
function buildHighlightFilter(
  highlightedFeature: SearchResult | null | undefined,
  geoLevel: GeoLevel,
): any[] {
  if (!highlightedFeature) return ["==", ["get", "id"], "___none___"];

  const searchName = highlightedFeature.name;
  const searchId = highlightedFeature.id.replace(/.*?\./, ""); // Strip Mapbox prefix

  if (geoLevel === "metro") {
    return [
      "any",
      ["==", ["get", "name"], searchName],
      ["in", searchName, ["get", "name"]],
      ["==", ["get", "id"], searchName],
    ];
  } else if (geoLevel === "zip") {
    return ["==", ["get", "id"], searchName];
  } else {
    return [
      "any",
      ["==", ["get", "name"], searchName],
      ["==", ["get", "id"], searchName],
      ["==", ["get", "id"], searchId],
      ["in", searchName, ["get", "displayName"]],
    ];
  }
}

/**
 * Create point features at the polylabel of each polygon feature for labeling.
 * Stores bbox and polylabel coordinates as properties for screen-space calculations.
 */
function createLabelPoints(geojson: any, geoLevel: GeoLevel): any {
  if (geoLevel === "national") {
    const firstFeature = geojson.features[0];
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [-98.5795, 39.8283] },
          properties: firstFeature
            ? { ...firstFeature.properties }
            : { name: "United States", value: 0 },
        },
      ],
    };
  }

  const labelFeatures = geojson.features
    .map((feature: any) => {
      const centroid = calculatePolylabel(feature.geometry);
      if (!centroid) return null;

      const bbox = getGeometryBbox(feature.geometry);

      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: centroid },
        properties: {
          ...feature.properties,
          polylabelLng: centroid[0],
          polylabelLat: centroid[1],
          bboxMinLng: bbox ? bbox[0] : centroid[0],
          bboxMinLat: bbox ? bbox[1] : centroid[1],
          bboxMaxLng: bbox ? bbox[2] : centroid[0],
          bboxMaxLat: bbox ? bbox[3] : centroid[1],
        },
      };
    })
    .filter(Boolean);

  return { type: "FeatureCollection", features: labelFeatures };
}
