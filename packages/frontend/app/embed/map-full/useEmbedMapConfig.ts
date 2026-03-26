"use client";

import { useSearchParams } from "next/navigation";
import type { GeoLevel } from "@/app/map/types";

/**
 * Typed configuration for the full interactive map embed.
 * Each flag controls visibility of a UI element, parsed from URL search params.
 */
export interface EmbedMapConfig {
  showSidebar: boolean;
  showSearch: boolean;
  showLegend: boolean;
  showScores: boolean;
  showGeoPills: boolean;
  showMetricPicker: boolean;
  showDetailPanel: boolean;
  initialMetric: string;
  initialGeoLevel: GeoLevel;
  initialCenter: [number, number];
  initialZoom: number;
  token: string;
}

/**
 * Parse a "0" or "1" URL param into a boolean.
 * Returns the provided default when the param is absent.
 */
function parseBoolParam(value: string | null, defaultValue: boolean): boolean {
  if (value === null) return defaultValue;
  return value === "1";
}

/**
 * Parse a "lng,lat" string into a [longitude, latitude] tuple.
 * Returns the provided default when the param is absent or malformed.
 */
function parseCenterParam(
  value: string | null,
  defaultCenter: [number, number],
): [number, number] {
  if (!value) return defaultCenter;

  const parts = value.split(",").map(Number);
  if (
    parts.length === 2 &&
    !Number.isNaN(parts[0]) &&
    !Number.isNaN(parts[1])
  ) {
    return [parts[0], parts[1]];
  }

  return defaultCenter;
}

const DEFAULT_CENTER: [number, number] = [-98.5, 39.8];
const DEFAULT_ZOOM = 4;
const VALID_GEO_LEVELS: GeoLevel[] = [
  "national",
  "state",
  "metro",
  "county",
  "zip",
  "city",
  "tract",
];

/**
 * Hook that reads URL search params and returns a typed embed configuration.
 *
 * Supported params:
 *   sidebar=0|1      (default 0)  — show metric sidebar
 *   search=0|1       (default 1)  — show search bar
 *   legend=0|1       (default 1)  — show color legend
 *   scores=0|1       (default 0)  — show score badges
 *   geo_pills=0|1    (default 1)  — show geography level pills
 *   metric_picker=0|1 (default 1) — show metric dropdown in toolbar
 *   detail_panel=0|1 (default 1)  — show right detail panel on click
 *   metric           (default "home_value")
 *   geo              (default "state")
 *   center           (default "-98.5,39.8")
 *   zoom             (default 4)
 *   token            — embed auth token
 */
export function useEmbedMapConfig(): EmbedMapConfig {
  const searchParams = useSearchParams();

  const geoParam = searchParams.get("geo");
  const initialGeoLevel: GeoLevel =
    geoParam && VALID_GEO_LEVELS.includes(geoParam as GeoLevel)
      ? (geoParam as GeoLevel)
      : "state";

  const zoomRaw = searchParams.get("zoom");
  const initialZoom =
    zoomRaw !== null && !Number.isNaN(Number(zoomRaw))
      ? Number(zoomRaw)
      : DEFAULT_ZOOM;

  return {
    showSidebar: parseBoolParam(searchParams.get("sidebar"), false),
    showSearch: parseBoolParam(searchParams.get("search"), true),
    showLegend: parseBoolParam(searchParams.get("legend"), true),
    showScores: parseBoolParam(searchParams.get("scores"), false),
    showGeoPills: parseBoolParam(searchParams.get("geo_pills"), true),
    showMetricPicker: parseBoolParam(searchParams.get("metric_picker"), true),
    showDetailPanel: parseBoolParam(searchParams.get("detail_panel"), true),
    initialMetric: searchParams.get("metric") ?? "home_value",
    initialGeoLevel,
    initialCenter: parseCenterParam(searchParams.get("center"), DEFAULT_CENTER),
    initialZoom,
    token: searchParams.get("token") ?? "",
  };
}
