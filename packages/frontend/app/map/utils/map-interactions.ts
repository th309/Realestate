/**
 * Map interaction handlers: hover popups, click events, and right-click context menus.
 * Extracted from useMapLayers to keep the hook focused on orchestration.
 */
import mapboxgl from "mapbox-gl";
import type { GeoLevel, ForecastHorizon, SelectedGeography } from "../types";
import { FIPS_TO_STATE } from "../types";
import { formatTooltipValue } from "./metricUtils";

/**
 * Extract state abbreviation from feature properties and geography context.
 * Shared by both left-click and right-click handlers.
 */
function extractStateAbbr(
  props: Record<string, any>,
  id: string,
  name: string,
  geoLevel: GeoLevel,
): string {
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
  return stateAbbr;
}

/**
 * Extract geography ID from GeoJSON feature properties.
 * Handles enriched properties and raw GeoJSON properties as fallbacks.
 */
function extractFeatureId(
  props: Record<string, any>,
  featureId: string | number | undefined,
): string {
  const id =
    props.id ||
    props.CBSAFP || // Metro CBSA code
    props.GEOID || // Census GEOID (works for counties, zips, tracts)
    props.GEOID20 || // ZIP ZCTA GEOID
    props.ZCTA5CE20 || // ZIP ZCTA code
    featureId ||
    "";
  return String(id);
}

/**
 * Setup hover popups, click events, and right-click context menu on map features.
 */
export function setupInteractions(
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

    const id = extractFeatureId(props, feature.id as string | undefined);
    const name = props.name || props.displayName || props.NAME || "Unknown";
    const value = props.value ?? null;
    const stateAbbr = extractStateAbbr(props, id, name, geoLevel);

    onFeatureClick({
      id,
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

    const id = extractFeatureId(props, feature.id as string | undefined);
    const name = props.name || props.displayName || props.NAME || "Unknown";
    const value = props.value ?? null;
    const stateAbbr = extractStateAbbr(props, id, name, geoLevel);

    onFeatureContextMenu({
      geography: { id, name, geoLevel, value, stateAbbr },
      x: e.originalEvent.clientX,
      y: e.originalEvent.clientY,
    });
  });
}
