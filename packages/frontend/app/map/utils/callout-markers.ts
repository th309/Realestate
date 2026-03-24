/**
 * Callout marker management for small state labels.
 * Creates, updates, and removes HTML mapboxgl.Marker elements
 * with color-matched pill backgrounds positioned over the Atlantic.
 */
import mapboxgl from "mapbox-gl";
import type { MetricFormat } from "./metricUtils";
import { formatCompactValue } from "./value-format-expressions";
import type { CalloutPosition } from "./label-layout";

/**
 * Marker store type — managed via useRef in the hook, passed into these functions.
 * This avoids module-level singletons that can leak across React mount/unmount cycles.
 */
export type MarkerStore = Map<string, mapboxgl.Marker>;

/**
 * Create the HTML element for a callout pill marker.
 */
function createPillElement(
  name: string,
  value: number,
  fillColor: string,
  metricFormat: MetricFormat,
): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = `
    background: ${fillColor};
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 6px;
    padding: 3px 8px;
    pointer-events: none;
    white-space: nowrap;
    line-height: 1.3;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    transition: opacity 0.3s ease;
  `;

  const nameSpan = document.createElement("div");
  nameSpan.style.cssText =
    "color: white; font-size: 10px; font-weight: 600; font-family: Roboto, sans-serif;";
  nameSpan.textContent = name;

  const valueSpan = document.createElement("div");
  valueSpan.style.cssText =
    "color: rgba(255, 255, 255, 0.85); font-size: 9px; font-family: Roboto, sans-serif;";
  valueSpan.textContent = formatCompactValue(value, metricFormat);

  el.appendChild(nameSpan);
  el.appendChild(valueSpan);

  return el;
}

/**
 * Sync callout markers with the current set of callout positions.
 * Creates new markers, updates existing ones, and removes stale ones.
 */
export function syncCalloutMarkers(
  markers: MarkerStore,
  map: mapboxgl.Map,
  callouts: CalloutPosition[],
  metricFormat: MetricFormat,
): void {
  const newNames = new Set(callouts.map((c) => c.name));

  // Remove markers for states that no longer need callouts
  for (const [name, marker] of markers) {
    if (!newNames.has(name)) {
      marker.remove();
      markers.delete(name);
    }
  }

  // Create or update markers — always recreate since Mapbox Marker has no setElement
  for (const callout of callouts) {
    const existing = markers.get(callout.name);
    if (existing) existing.remove();

    const el = createPillElement(
      callout.name,
      callout.value,
      callout.fillColor,
      metricFormat,
    );
    const marker = new mapboxgl.Marker({ element: el, anchor: "left" })
      .setLngLat(callout.calloutLngLat)
      .addTo(map);
    markers.set(callout.name, marker);
  }
}

/**
 * Update opacity of all callout markers based on screen-space ratio.
 * Markers fade in/out in the 0.8-1.0 ratio range.
 */
export function updateCalloutOpacity(
  markers: MarkerStore,
  features: { name: string; screenSpaceRatio: number }[],
): void {
  for (const feature of features) {
    const marker = markers.get(feature.name);
    if (!marker) continue;

    const el = marker.getElement();
    if (feature.screenSpaceRatio > 1.0) {
      el.style.opacity = "1";
      el.style.display = "";
    } else if (feature.screenSpaceRatio >= 0.8) {
      const opacity = (feature.screenSpaceRatio - 0.8) / 0.2;
      el.style.opacity = String(opacity);
      el.style.display = "";
    } else {
      el.style.opacity = "0";
      el.style.display = "none";
    }
  }
}

/**
 * Remove all callout markers from the map.
 * Call during layer cleanup or geo level change.
 */
export function removeAllCalloutMarkers(markers: MarkerStore): void {
  for (const [, marker] of markers) {
    marker.remove();
  }
  markers.clear();
}
