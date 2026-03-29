/**
 * Leader line and dot layer management for small state callouts.
 * Extracted from map-layer-config.ts to keep files under size limits.
 */
import mapboxgl from "mapbox-gl";

/** All layer IDs managed by the map, in render order (bottom to top). */
export const MANAGED_LAYER_IDS = [
  "geo-fills",
  "geo-borders",
  "geo-highlight",
  "state-borders-overlay",
  "leader-lines",
  "leader-dots",
  "geo-labels",
] as const;

/** All source IDs managed by the map. */
export const MANAGED_SOURCE_IDS = [
  "geo-data",
  "geo-labels-data",
  "leader-line-data",
] as const;

/**
 * Remove all managed layers and sources from the map.
 * Safe to call even if layers/sources don't exist.
 */
export function removeAllManagedLayers(map: mapboxgl.Map): void {
  for (const layerId of MANAGED_LAYER_IDS) {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
  }
  for (const sourceId of MANAGED_SOURCE_IDS) {
    if (map.getSource(sourceId)) map.removeSource(sourceId);
  }
}

/**
 * Add leader line and dot layers for small state callouts.
 * Call AFTER addMapLayers() so these render above borders but below labels.
 */
export function addLeaderLineLayers(map: mapboxgl.Map, lineGeojson: any): void {
  const beforeLayer = map.getLayer("geo-labels") ? "geo-labels" : undefined;

  // Source for leader lines
  if (map.getSource("leader-line-data")) {
    (map.getSource("leader-line-data") as mapboxgl.GeoJSONSource).setData(
      lineGeojson,
    );
  } else {
    map.addSource("leader-line-data", { type: "geojson", data: lineGeojson });
  }

  // Leader lines (dashed)
  if (!map.getLayer("leader-lines")) {
    map.addLayer(
      {
        id: "leader-lines",
        type: "line",
        source: "leader-line-data",
        paint: {
          "line-color": "rgba(255, 255, 255, 0.6)",
          "line-width": 1,
          "line-dasharray": [3, 2],
        },
        layout: {
          "line-cap": "round",
        },
      },
      beforeLayer,
    );
  }

  // Anchor dots — circle layers always render (no collision detection needed).
  // Opacity fades based on screenSpaceRatio.
  if (!map.getLayer("leader-dots")) {
    map.addLayer(
      {
        id: "leader-dots",
        type: "circle",
        source: "geo-labels-data",
        filter: [">=", ["get", "screenSpaceRatio"], 0.8],
        paint: {
          "circle-radius": 3,
          "circle-color": "rgba(255, 255, 255, 0.6)",
          "circle-stroke-width": 0,
          "circle-opacity": [
            "interpolate",
            ["linear"],
            ["get", "screenSpaceRatio"],
            0.8,
            0,
            1.0,
            1,
          ],
        },
      },
      beforeLayer,
    );
  }
}
