/**
 * Mapbox GL layer and source configuration.
 * Extracted from useMapLayers to keep the hook focused on orchestration.
 */
import mapboxgl from "mapbox-gl";
import type { GeoLevel, SearchResult } from "../types";
import type { MetricFormat } from "./metricUtils";
import { getColorScale } from "./colorScale";
import { COLOR_SCALE } from "./metricUtils";
import { buildValueFormatExpression } from "./value-format-expressions";

/** Border line width by geo level. */
function getBorderWidth(geoLevel: GeoLevel): number {
  switch (geoLevel) {
    case "tract":
      return 0.2;
    case "zip":
      return 0.3;
    case "city":
      return 0.4;
    case "county":
      return 0.5;
    case "metro":
      return 0.8;
    default:
      return 1.5;
  }
}

/** Build highlight filter for searched geography. */
function calculateHighlightFilter(
  feature: SearchResult,
  geoLevel: GeoLevel,
): any {
  const searchName = feature.name;
  const searchId = feature.id.replace(/.*?\./, "");

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
 * Compute the fill color for a given value using the same step function as geo-fills.
 * JS-side mirror of the Mapbox getColorScale() expression — keep in sync.
 */
export function computeFillColor(
  value: number,
  min: number,
  max: number,
): string {
  if (value == null || min === max) return COLOR_SCALE[3];
  const range = max - min;
  const step = range / 7;
  const index = Math.min(6, Math.max(0, Math.floor((value - min) / step)));
  return COLOR_SCALE[index];
}

export interface AddMapLayersOptions {
  map: mapboxgl.Map;
  geoLevel: GeoLevel;
  metricFormat: MetricFormat;
  minVal: number;
  maxVal: number;
  labelPointsGeojson?: any;
  highlightedFeature?: SearchResult | null;
}

/**
 * Add all map layers (fills, borders, highlight, labels) to the map.
 * Assumes sources 'geo-data' and optionally 'geo-labels-data' are already added.
 */
export function addMapLayers(opts: AddMapLayersOptions): void {
  const {
    map,
    geoLevel,
    metricFormat,
    minVal,
    maxVal,
    labelPointsGeojson,
    highlightedFeature,
  } = opts;

  // Fill layer
  map.addLayer({
    id: "geo-fills",
    type: "fill",
    source: "geo-data",
    paint: {
      "fill-color": getColorScale(minVal, maxVal) as any,
      "fill-opacity": 0.6,
    },
  });

  // Border layer
  const lineWidth = getBorderWidth(geoLevel);
  map.addLayer({
    id: "geo-borders",
    type: "line",
    source: "geo-data",
    paint: {
      "line-color": "#ffffff",
      "line-width": lineWidth,
      "line-opacity": 0.8,
    },
    layout: {
      "line-join": "round",
      "line-cap": "round",
    },
  });

  // Highlight layer
  if (highlightedFeature) {
    const filter = calculateHighlightFilter(highlightedFeature, geoLevel);
    map.addLayer({
      id: "geo-highlight",
      type: "line",
      source: "geo-data",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#3949AB",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5,
          lineWidth * 3,
          10,
          lineWidth * 6,
          15,
          lineWidth * 12,
        ],
        "line-opacity": 1,
        "line-blur": 0.4,
      },
      filter,
    });
  }

  // Label layers for state and national
  if ((geoLevel === "state" || geoLevel === "national") && labelPointsGeojson) {
    map.addSource("geo-labels-data", {
      type: "geojson",
      data: labelPointsGeojson,
    });

    const valueFormat = buildValueFormatExpression(metricFormat);

    map.addLayer({
      id: "geo-labels",
      type: "symbol",
      source: "geo-labels-data",
      layout: {
        "text-field": [
          "format",
          ["get", "name"],
          {
            "font-scale": 0.9,
            "text-font": [
              "literal",
              ["Roboto Medium", "DIN Pro Medium", "Arial Unicode MS Bold"],
            ],
          },
          "\n",
          {},
          valueFormat,
          {
            "font-scale": 0.8,
            "text-font": [
              "literal",
              ["Roboto Regular", "DIN Pro Regular", "Arial Unicode MS Regular"],
            ],
          },
        ],
        "text-size": 15,
        // Fixed center anchor — polylabel + bbox center computes the visual center,
        // so we don't need variable-anchor collision avoidance (which shifts labels
        // away from the intended position, e.g. California drifting to LA).
        // allow-overlap: true — all centered labels always show. The white halo
        // makes minor overlaps readable. Only states where the label physically
        // can't fit (ratio > 1.0) get callout leader lines instead.
        "text-anchor": "center",
        "text-allow-overlap": true,
        "text-ignore-placement": true,
        "text-max-width": 8,
        "text-letter-spacing": 0.02,
      },
      paint: {
        "text-color": "#1d1b20",
        "text-halo-color": "rgba(255, 255, 255, 0.95)",
        "text-halo-width": 2,
      },
      filter:
        geoLevel === "state"
          ? [
              "any",
              ["!", ["has", "screenSpaceRatio"]],
              ["<=", ["get", "screenSpaceRatio"], 1.0],
            ]
          : undefined,
    });
  }
}
