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
  GEOJSON_SOURCES,
  FIPS_TO_STATE,
  STATE_NAME_TO_FIPS,
  getValueFromEntry,
  getDateFromEntry,
} from "../types";
import {
  getMetricFormat,
  calculateValueRange,
  formatTooltipValue,
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
  type LabelFeature,
  type MarkerStore,
} from "../utils";
import { useMetricFreshness } from "@/lib/data/hooks";
import { normalizeZipKey } from "@/lib/format/zip";
import { getGeoJsonApiUrl } from "@/lib/data";

/**
 * Fetch with retry logic for large GeoJSON endpoints (county, zip)
 * These can timeout on cold cache, so retry up to 3 times with backoff
 */
async function fetchWithRetry(
  url: string,
  maxRetries: number = 3,
  baseDelayMs: number = 1000,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);

      // Retry on 500 errors (cold cache timeout)
      if (response.status >= 500) {
        lastError = new Error(`Server error: ${response.status}`);
        if (attempt < maxRetries) {
          const delay = baseDelayMs * attempt; // Linear backoff: 1s, 2s, 3s
          console.warn(
            `GeoJSON fetch failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw lastError;
      }

      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < maxRetries) {
        const delay = baseDelayMs * attempt;
        console.warn(
          `GeoJSON fetch error (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`,
          err,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  throw lastError || new Error("Fetch failed after retries");
}

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

          const callouts = computeCalloutPositions(labelFeatures);
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

function getGeojsonUrl(
  geoLevel: GeoLevel,
  selectedState: string,
): string | null {
  // Prefer static files (served from /public, no backend or DB hit)
  // This bypasses the DB entirely and leverages Next.js edge caching.
  if (geoLevel === "national") return "/geojson/national.json";
  if (geoLevel === "state") return "/geojson/states.json";
  if (geoLevel === "metro") return "/geojson/metros.json";
  if (geoLevel === "county" && !selectedState) return "/geojson/counties.json";

  // These layers remain on the backend API (cached 24h in-memory)
  // because generating a nationwide static file for every single zip code/city is too large.
  if (geoLevel === "county" && selectedState) {
    return getGeoJsonApiUrl(
      `${GEOJSON_SOURCES.county}/${selectedState.toUpperCase()}`,
    );
  } else if (geoLevel === "city" && selectedState) {
    return getGeoJsonApiUrl(
      `${GEOJSON_SOURCES.city}/${selectedState.toUpperCase()}`,
    );
  } else if (geoLevel === "zip" && selectedState) {
    return getGeoJsonApiUrl(
      `${GEOJSON_SOURCES.zip}/${selectedState.toUpperCase()}`,
    );
  } else if (geoLevel === "tract" && selectedState) {
    console.warn("Tract data not available");
    return null;
  }
  return null;
}

function addValuesToFeatures(
  geojson: any,
  geoLevel: GeoLevel,
  mapData: MapData,
): void {
  if (geoLevel === "national") {
    // National geojson has NAME: "United States", GEOID: "US"
    geojson.features.forEach((feature: any) => {
      const name =
        feature.properties.NAME || feature.properties.name || "United States";
      // Try multiple keys: "United States", "US", name
      const entry = mapData["United States"] ?? mapData["US"] ?? mapData[name];
      feature.properties.value = getValueFromEntry(entry) || 0;
      feature.properties.dataDate = getDateFromEntry(entry);
      feature.properties.id = feature.properties.GEOID || "US";
      feature.properties.displayName = name;
      // Normalize property names for consistent tooltip display
      feature.properties.name = name;
    });
  } else if (geoLevel === "state") {
    geojson.features.forEach((feature: any) => {
      const name = feature.properties.name;
      const entry = mapData[name];
      feature.properties.value = getValueFromEntry(entry) || 0;
      feature.properties.dataDate = getDateFromEntry(entry);
      // Set state ID (FIPS code) for benchmark lookups
      // Try multiple sources: STATEFP property, name-to-FIPS lookup, feature.id
      const stateFips =
        feature.properties.STATEFP || STATE_NAME_TO_FIPS[name] || feature.id;
      feature.properties.id = stateFips;
      // Also set stateAbbr from FIPS for states
      feature.properties.stateAbbr = FIPS_TO_STATE[stateFips] || "";
    });
  } else if (geoLevel === "county") {
    let countyWithData = 0;
    geojson.features.forEach((feature: any) => {
      const fips = feature.id || feature.properties.id;
      const entry = mapData[fips] ?? mapData[String(parseInt(fips, 10))];
      feature.properties.value = getValueFromEntry(entry);
      feature.properties.dataDate = getDateFromEntry(entry);
      feature.properties.id = fips;
      if (getValueFromEntry(entry) != null) countyWithData++;
      const stateFips = fips?.substring(0, 2);
      const stateAbbr = FIPS_TO_STATE[stateFips] || "";
      feature.properties.displayName = `${feature.properties.NAME || "County"}, ${stateAbbr}`;
    });
    // One-off coverage check: compare to PropertyIQ "County coverage" log (score keys vs features)
    console.log(
      `[Map] County layer: ${geojson.features.length} features, ${Object.keys(mapData).length} data keys, ${countyWithData} features with value`,
    );
  } else if (geoLevel === "metro") {
    geojson.features.forEach((feature: any) => {
      const cbsaCode = feature.properties.CBSAFP || feature.properties.GEOID;
      const entry = mapData[cbsaCode];
      feature.properties.value = getValueFromEntry(entry);
      feature.properties.dataDate = getDateFromEntry(entry);
      feature.properties.id = cbsaCode;
      feature.properties.displayName =
        feature.properties.NAME || feature.properties.NAMELSAD || "Metro Area";
      feature.properties.name =
        feature.properties.NAME || feature.properties.NAMELSAD;
    });
  } else if (geoLevel === "city") {
    geojson.features.forEach((feature: any) => {
      // TIGER Place files use GEOID (state FIPS + place FIPS) and NAME
      // Zillow city data uses region_name (city name) as the key
      const placeId = feature.properties.GEOID || feature.properties.PLACEFP;
      const placeName =
        feature.properties.NAME ||
        feature.properties.NAMELSAD ||
        "Unknown City";
      const stateFips = feature.properties.STATEFP;
      const stateAbbr = FIPS_TO_STATE[stateFips] || "";
      // Try matching by name first (Zillow data), then by GEOID
      const entry = mapData[placeName] ?? mapData[placeId];
      feature.properties.value = getValueFromEntry(entry);
      feature.properties.dataDate = getDateFromEntry(entry);
      feature.properties.id = placeId;
      feature.properties.displayName = stateAbbr
        ? `${placeName}, ${stateAbbr}`
        : placeName;
      feature.properties.name = placeName;
    });
  } else if (geoLevel === "zip") {
    geojson.features.forEach((feature: any) => {
      const zipCode =
        feature.properties.ZCTA5CE20 || feature.properties.GEOID20;
      const key = zipCode ? normalizeZipKey(zipCode) : "";
      const entry = key ? mapData[key] : undefined;
      feature.properties.value = getValueFromEntry(entry);
      feature.properties.dataDate = getDateFromEntry(entry);
      feature.properties.id = zipCode;
      feature.properties.displayName = zipCode;
    });
  } else if (geoLevel === "tract") {
    geojson.features.forEach((feature: any) => {
      // TIGER Tract files use GEOID (state FIPS + county FIPS + tract code)
      const tractId = feature.properties.GEOID || feature.properties.TRACTCE;
      const tractName =
        feature.properties.NAMELSAD ||
        feature.properties.NAME ||
        `Tract ${tractId}`;
      const stateFips = feature.properties.STATEFP;
      const countyFips = feature.properties.COUNTYFP;
      const stateAbbr = FIPS_TO_STATE[stateFips] || "";
      const entry = mapData[tractId];
      feature.properties.value = getValueFromEntry(entry);
      feature.properties.dataDate = getDateFromEntry(entry);
      feature.properties.id = tractId;
      feature.properties.displayName = `${tractName}${stateAbbr ? `, ${stateAbbr}` : ""}`;
      feature.properties.countyFips = stateFips + countyFips;
    });
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

function setupInteractions(
  map: mapboxgl.Map,
  popup: React.MutableRefObject<mapboxgl.Popup | null>,
  metricFormat: string,
  forecastHorizon: ForecastHorizon,
  geoLevelRef: React.MutableRefObject<GeoLevel>,
  selectedMetricFreshnessDate: string,
  onFeatureClick?: (geography: SelectedGeography | null) => void,
  onFeatureContextMenu?: (info: {
    geography: SelectedGeography;
    x: number;
    y: number;
  }) => void,
): void {
  map.on("mouseenter", "geo-fills", () => {
    map.getCanvas().style.cursor = "pointer";
  });

  map.on("mouseleave", "geo-fills", () => {
    map.getCanvas().style.cursor = "";
    popup.current?.remove();
  });

  map.on("mousemove", "geo-fills", (e) => {
    if (e.features && e.features.length > 0) {
      const feature = e.features[0];
      const name =
        feature.properties?.name ||
        feature.properties?.displayName ||
        feature.properties?.NAME ||
        "Unknown";
      // Use null to indicate "no data" - don't convert 0 to null since 0 is a valid forecast value
      const value = feature.properties?.value ?? null;

      if (!popup.current) {
        popup.current = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
        });
      }

      // Use centralized formatting functions
      const { displayValue, valueColor } = formatTooltipValue(
        value,
        metricFormat,
      );

      const asOfText = selectedMetricFreshnessDate
        ? `as of ${selectedMetricFreshnessDate}`
        : "";

      // M3-compliant tooltip styling using CSS custom properties
      popup.current
        .setLngLat(e.lngLat)
        .setHTML(
          `
          <div style="
            font-family: 'Google Sans', Roboto, sans-serif;
            padding: 12px 16px;
            background: var(--md-surface-container-low, #f7f2fa);
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
          ">
            <div style="font-weight: 500; font-size: 14px; color: var(--md-on-surface, #1d1b20); line-height: 20px;">${name}</div>
            <div style="font-size: 22px; font-weight: 600; color: ${valueColor}; margin: 4px 0;">${displayValue}</div>
            ${asOfText ? `<div style="font-size: 11px; color: var(--md-outline, #79747e); margin-top: 4px;">${asOfText}</div>` : ""}
          </div>
        `,
        )
        .addTo(map);
    }
  });

  // Click handler for benchmark comparison
  map.on("click", "geo-fills", (e) => {
    if (!onFeatureClick || !e.features || e.features.length === 0) return;

    const feature = e.features[0];
    const props = feature.properties || {};
    const geoLevel = geoLevelRef.current;

    // Extract geography ID from GeoJSON properties.
    // The enrichment step sets props.id, but we also handle raw GeoJSON
    // properties (CBSAFP for metros, GEOID for counties/zips, etc.)
    // to be resilient against race conditions or stale features.
    const id =
      props.id ||
      props.CBSAFP || // Metro CBSA code
      props.GEOID || // Census GEOID (works for counties, zips, tracts)
      props.GEOID20 || // ZIP ZCTA GEOID
      props.ZCTA5CE20 || // ZIP ZCTA code
      feature.id ||
      "";

    // Extract display name — prefer enriched name, fall back to raw GeoJSON
    const name = props.name || props.displayName || props.NAME || "Unknown";
    const value = props.value ?? null;

    // Get state abbreviation if available.
    // For metros, CBSA codes do NOT start with state FIPS, so id.substring(0, 2)
    // gives a wrong result. Instead, extract the state from the metro name
    // (e.g., "Phoenix-Mesa-Chandler, AZ" → "AZ").
    let stateAbbr = props.stateAbbr || "";
    if (!stateAbbr && props.STATEFP) {
      stateAbbr = FIPS_TO_STATE[props.STATEFP] || "";
    }
    if (
      !stateAbbr &&
      geoLevel !== "metro" &&
      typeof id === "string" &&
      id.length >= 2
    ) {
      stateAbbr = FIPS_TO_STATE[id.substring(0, 2)] || "";
    }
    if (!stateAbbr && name) {
      // Extract state abbreviation from name like "Phoenix-Mesa, AZ" or "Name, NY-NJ-PA"
      const commaMatch = name.match(/,\s*([A-Z]{2})(?:[- ]|$)/);
      if (commaMatch) stateAbbr = commaMatch[1];
    }

    onFeatureClick({
      id: String(id),
      name,
      geoLevel,
      value,
      stateAbbr,
    });
  });

  // Click outside of features to deselect
  map.on("click", (e) => {
    if (!onFeatureClick) return;

    const features = map.queryRenderedFeatures(e.point, {
      layers: ["geo-fills"],
    });
    if (features.length === 0) {
      onFeatureClick(null);
    }
  });

  // Right-click context menu on features
  map.on("contextmenu", "geo-fills", (e) => {
    if (!onFeatureContextMenu || !e.features || e.features.length === 0) return;
    e.preventDefault();

    const feature = e.features[0];
    const props = feature.properties || {};
    const geoLevel = geoLevelRef.current;

    const id =
      props.id ||
      props.CBSAFP ||
      props.GEOID ||
      props.GEOID20 ||
      props.ZCTA5CE20 ||
      feature.id ||
      "";

    const name = props.name || props.displayName || props.NAME || "Unknown";
    const value = props.value ?? null;

    // Same state abbreviation logic as left-click handler above
    let stateAbbr = props.stateAbbr || "";
    if (!stateAbbr && props.STATEFP) {
      stateAbbr = FIPS_TO_STATE[props.STATEFP] || "";
    }
    if (
      !stateAbbr &&
      geoLevel !== "metro" &&
      typeof id === "string" &&
      id.length >= 2
    ) {
      stateAbbr = FIPS_TO_STATE[id.substring(0, 2)] || "";
    }
    if (!stateAbbr && name) {
      const commaMatch = name.match(/,\s*([A-Z]{2})(?:[- ]|$)/);
      if (commaMatch) stateAbbr = commaMatch[1];
    }

    onFeatureContextMenu({
      geography: { id: String(id), name, geoLevel, value, stateAbbr },
      x: e.originalEvent.clientX,
      y: e.originalEvent.clientY,
    });
  });
}
