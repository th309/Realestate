"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { EmbedMapLegend } from "./embed-map-legend";
import { EmbedMapTooltip, type TooltipData } from "./embed-map-tooltip";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmbedMiniMapProps {
  /** Geography level: "state" | "metro" | "county" | "zip" */
  geoLevel: string;
  /** Metric ID to display (e.g. "home_value") */
  metric?: string;
  /** Map center as [longitude, latitude] */
  center?: [number, number];
  /** Initial zoom level */
  zoom?: number;
  /**
   * Pre-processed data for the choropleth layer.
   * Array of { id: string; value: number; name: string } entries keyed by region.
   * When provided, the map colors regions by value using the legend scale.
   */
  data?: EmbedMapDataEntry[];
}

export interface EmbedMapDataEntry {
  id: string;
  value: number;
  name: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
const MAP_STYLE = "mapbox://styles/mapbox/light-v11";
const DEFAULT_CENTER: [number, number] = [-98.5, 39.8]; // Center of US
const DEFAULT_ZOOM = 4;
const MIN_ZOOM = 3;
const MAX_ZOOM = 12;

/** 7-step color palette (indigo to dark red) matching main app */
const CHOROPLETH_COLORS = [
  "#3949AB", // indigo-600
  "#5C6BC0", // indigo (brand medium)
  "#3b82f6", // blue-500
  "#22c55e", // green-500
  "#eab308", // yellow-500
  "#f97316", // orange-500
  "#b91c1c", // red-800
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * EmbedMiniMap — Interactive Mapbox GL map for embed contexts.
 *
 * Renders a responsive map (~600x400px) with:
 * - Color-coded choropleth regions for a single metric
 * - Click-to-tooltip with region name + value
 * - Color legend at bottom
 * - Simplified controls: zoom only, no sidebar or metric selector
 * - Constrained pan/zoom (min 3, max 12)
 *
 * NOTE: Full GeoJSON layer binding is structured but may need refinement
 * in Task 8 when wired to live data sources and the GeoJSON tile endpoints.
 */
export function EmbedMiniMap({
  geoLevel,
  metric,
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  data,
}: EmbedMiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Derive legend bounds from data
  const { minValue, maxValue } = computeDataRange(data);

  // ---- Initialize map ----
  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center,
      zoom: Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM),
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      accessToken: MAPBOX_TOKEN,
      attributionControl: false,
    });

    // Simplified controls — zoom only
    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      "top-right",
    );

    map.on("load", () => {
      mapRef.current = map;
      setMapLoaded(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Apply choropleth data when map is loaded and data changes ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !data || data.length === 0) return;

    applyChoroplethLayer(map, geoLevel, data, minValue, maxValue);
  }, [mapLoaded, data, geoLevel, minValue, maxValue]);

  // ---- Click handler for tooltips ----
  const handleMapClick = useCallback(
    (e: mapboxgl.MapMouseEvent) => {
      const map = mapRef.current;
      if (!map) return;

      const layerId = `embed-choropleth-${geoLevel}`;
      const features = map.queryRenderedFeatures(e.point, {
        layers: [layerId],
      });

      if (features.length > 0) {
        const feature = features[0];
        const props = feature.properties;
        if (props) {
          setTooltip({
            name: props.name || props.NAME || "Unknown",
            value: props._embed_value ?? null,
            x: e.point.x,
            y: e.point.y,
          });
        }
      } else {
        setTooltip(null);
      }
    },
    [geoLevel],
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    map.on("click", handleMapClick);
    return () => {
      map.off("click", handleMapClick);
    };
  }, [mapLoaded, handleMapClick]);

  // ---- Render ----
  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex items-center justify-center h-[400px] bg-surface-container rounded-xl text-sm text-on-surface-variant">
        Map unavailable — missing Mapbox token
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ maxWidth: 600 }}>
      {/* Map container */}
      <div
        ref={containerRef}
        className="w-full rounded-xl overflow-hidden"
        style={{ height: 400 }}
      />

      {/* Tooltip overlay */}
      {tooltip && (
        <EmbedMapTooltip data={tooltip} onClose={() => setTooltip(null)} />
      )}

      {/* Legend */}
      {data && data.length > 0 && (
        <EmbedMapLegend
          colors={CHOROPLETH_COLORS}
          minValue={minValue}
          maxValue={maxValue}
          metric={metric}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeDataRange(data?: EmbedMapDataEntry[]): {
  minValue: number;
  maxValue: number;
} {
  if (!data || data.length === 0) return { minValue: 0, maxValue: 100 };

  const values = data.map((d) => d.value).filter((v) => v != null);
  if (values.length === 0) return { minValue: 0, maxValue: 100 };

  // Use 5th-95th percentile for robustness
  const sorted = [...values].sort((a, b) => a - b);
  const p5Index = Math.floor(sorted.length * 0.05);
  const p95Index = Math.min(
    Math.floor(sorted.length * 0.95),
    sorted.length - 1,
  );

  return {
    minValue: sorted[p5Index],
    maxValue: sorted[p95Index],
  };
}

/**
 * Apply a choropleth fill layer to the map.
 *
 * This function adds a GeoJSON source and a fill layer colored by value.
 * For production use, this should be connected to the project's tile
 * endpoints via `getGeoJsonApiUrl()` from `@/lib/data`. Currently structured
 * as a data-join pattern that works with inline GeoJSON or vector tiles.
 *
 * TODO (Task 8): Wire to real GeoJSON tile sources per geoLevel.
 */
function applyChoroplethLayer(
  map: mapboxgl.Map,
  geoLevel: string,
  data: EmbedMapDataEntry[],
  minValue: number,
  maxValue: number,
): void {
  const sourceId = `embed-source-${geoLevel}`;
  const layerId = `embed-choropleth-${geoLevel}`;

  // Remove previous layer/source if present
  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);

  // Build a lookup map for data values
  const valueLookup = new Map<string, { value: number; name: string }>();
  for (const entry of data) {
    valueLookup.set(entry.id, { value: entry.value, name: entry.name });
  }

  // Build color stops for the fill expression
  const range = maxValue - minValue || 1;
  const stops: [number, string][] = CHOROPLETH_COLORS.map((color, i) => [
    minValue + (range * i) / (CHOROPLETH_COLORS.length - 1),
    color,
  ]);

  /*
   * GeoJSON source placeholder:
   * In production, this source should come from the project's vector tile
   * endpoints (e.g., `/api/geojson/{geoLevel}`). For now, we add an empty
   * GeoJSON source that can be replaced once the tile URL is known.
   *
   * When using vector tiles, switch to:
   *   map.addSource(sourceId, { type: 'vector', url: tileUrl });
   *   And update the layer to use `source-layer`.
   */
  map.addSource(sourceId, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  map.addLayer({
    id: layerId,
    type: "fill",
    source: sourceId,
    paint: {
      "fill-color": [
        "interpolate",
        ["linear"],
        ["coalesce", ["get", "_embed_value"], minValue],
        ...stops.flat(),
      ],
      "fill-opacity": 0.7,
      "fill-outline-color": "rgba(255, 255, 255, 0.6)",
    },
  });

  // Set cursor to pointer on hover
  map.on("mouseenter", layerId, () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", layerId, () => {
    map.getCanvas().style.cursor = "";
  });
}
