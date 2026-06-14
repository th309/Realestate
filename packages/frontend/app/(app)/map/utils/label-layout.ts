/**
 * Label layout engine for state map labels.
 * Callout positioning, leader line geometry, and crossing prevention.
 * Screen-space detection is in screen-space-detection.ts.
 */
import mapboxgl from "mapbox-gl";

/** Offset distance (degrees) from state bbox edge to callout label. */
const CALLOUT_OFFSET = 2;

/** Minimum gap between callout pills in screen pixels. */
const MIN_CALLOUT_GAP_PX = 35;

/** Reference latitude for computing degrees-per-pixel (mid-US). */
const REF_LAT = 40;

/** Contiguous US bounding box — used to filter out territories. */
const CONUS_LNG_MIN = -130;
const CONUS_LNG_MAX = -60;
const CONUS_LAT_MIN = 24;
const CONUS_LAT_MAX = 50;

/** Fade range: leader lines start fading at this ratio and are gone by 0.8. */
export const FADE_THRESHOLD_START = 0.8;

export interface LabelFeature {
  name: string;
  value: number;
  polylabel: [number, number];
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  screenSpaceRatio: number;
  fillColor: string;
}

export interface CalloutPosition {
  name: string;
  value: number;
  fillColor: string;
  anchorLngLat: [number, number]; // polylabel point on the state
  calloutLngLat: [number, number]; // offset position for the callout label
}

/**
 * Determine the best offset direction for a state's callout label.
 * Places callouts in the nearest open water/space:
 * - NE states (east of -77°, north of 38°) → offset EAST (Atlantic)
 * - Gulf states (south of 35°, between -92° and -80°) → offset SOUTH (Gulf of Mexico)
 * - Southeast coastal (east of -82°, south of 37°) → offset EAST (Atlantic)
 * - Other states → offset EAST by default
 */
function getCalloutOffset(feature: LabelFeature): [number, number] {
  const [lng, lat] = feature.polylabel;
  const [, minLat, maxLng, maxLat] = feature.bbox;

  // Gulf states: Mississippi, Louisiana area — offset south toward Gulf
  if (lat < 35 && lng < -88 && lng > -95) {
    return [0, -(maxLat - minLat) / 2 - CALLOUT_OFFSET];
  }

  // Southeast states not on coast (Alabama) — offset south
  if (lat < 35 && lng >= -88 && lng < -82) {
    return [0, -(maxLat - minLat) / 2 - CALLOUT_OFFSET];
  }

  // Default: offset east from the state's eastern edge
  return [maxLng - lng + CALLOUT_OFFSET, 0];
}

/**
 * Compute callout positions for states that need leader lines.
 * Each callout is placed near its own state in the nearest open direction,
 * then adjusted to prevent overlaps.
 */
export function computeCalloutPositions(
  features: LabelFeature[],
  map: mapboxgl.Map,
): CalloutPosition[] {
  // Filter to contiguous US states that need callouts (exclude AK, HI, territories)
  const needsCallout = features.filter(
    (f) =>
      f.screenSpaceRatio > 1.0 &&
      f.polylabel[0] >= CONUS_LNG_MIN &&
      f.polylabel[0] <= CONUS_LNG_MAX &&
      f.polylabel[1] >= CONUS_LAT_MIN &&
      f.polylabel[1] <= CONUS_LAT_MAX,
  );

  if (needsCallout.length === 0) return [];

  // Step 1: Compute initial callout position per state
  const callouts: CalloutPosition[] = needsCallout.map((feature) => {
    const offset = getCalloutOffset(feature);
    return {
      name: feature.name,
      value: feature.value,
      fillColor: feature.fillColor,
      anchorLngLat: feature.polylabel,
      calloutLngLat: [
        feature.polylabel[0] + offset[0],
        feature.polylabel[1] + offset[1],
      ] as [number, number],
    };
  });

  // Step 2: Prevent leader line crossings and pill overlaps.
  // Group callouts by offset direction, then within each group
  // ensure callout latitude order matches anchor latitude order.
  preventCrossingsAndOverlaps(callouts, map);

  return callouts;
}

/**
 * Prevent leader line crossings by enforcing a rule:
 * within each directional group (east-offset vs south-offset),
 * the callout latitude order must match the anchor latitude order.
 * This guarantees no lines cross within a group.
 *
 * Algorithm:
 * 1. Separate callouts into groups by offset direction
 * 2. Within each group, sort by anchor latitude (north → south)
 * 3. Compute a shared callout longitude (rightmost east-offset value)
 * 4. Stack callout latitudes top-to-bottom with minimum gap
 * 5. Center the stack around the group's mean anchor latitude
 */
function preventCrossingsAndOverlaps(
  callouts: CalloutPosition[],
  map: mapboxgl.Map,
): void {
  // Compute dynamic gap in degrees based on current zoom.
  // At low zoom (zoomed out), degrees/pixel is large → bigger gap in degrees.
  // At high zoom (zoomed in), degrees/pixel is small → smaller gap.
  const p1 = map.project([0, REF_LAT]);
  const p2 = map.project([0, REF_LAT + 1]);
  const pxPerDegLat = Math.abs(p2.y - p1.y);
  const minGapLat = pxPerDegLat > 0 ? MIN_CALLOUT_GAP_PX / pxPerDegLat : 1.2;
  const minGapLng = minGapLat * 2;
  // Classify: east-offset = callout is east of anchor, south-offset = callout is south
  const eastGroup: CalloutPosition[] = [];
  const southGroup: CalloutPosition[] = [];

  for (const c of callouts) {
    const dLng = c.calloutLngLat[0] - c.anchorLngLat[0];
    const dLat = c.calloutLngLat[1] - c.anchorLngLat[1];

    if (Math.abs(dLng) > Math.abs(dLat)) {
      eastGroup.push(c);
    } else {
      southGroup.push(c);
    }
  }

  // Fix east group: stack vertically, matching anchor latitude order.
  // Each callout stays near its own state's latitude but is nudged to
  // maintain north-to-south order with minimum spacing, preventing
  // leader line crossings.
  if (eastGroup.length > 0) {
    // Sort by anchor latitude descending (northernmost anchor first)
    eastGroup.sort((a, b) => b.anchorLngLat[1] - a.anchorLngLat[1]);

    // Use a shared longitude: the rightmost callout lng in the group
    const sharedLng = Math.max(...eastGroup.map((c) => c.calloutLngLat[0]));

    // Cap the top of the stack: no callout should be above ~42.5°N
    // (Massachusetts latitude). States like Vermont and NH are further
    // north but their callouts should stay in the Atlantic, not Canada.
    const MAX_CALLOUT_LAT = 42.5;

    // Start each callout at its own anchor latitude (capped), then enforce
    // minimum gap from top to bottom. This keeps callouts near their
    // states while preventing overlap and crossings.
    const latitudes: number[] = [];
    for (let i = 0; i < eastGroup.length; i++) {
      let targetLat = Math.min(eastGroup[i].anchorLngLat[1], MAX_CALLOUT_LAT);

      // Enforce minimum gap below previous callout
      if (i > 0) {
        const maxAllowed = latitudes[i - 1] - minGapLat;
        targetLat = Math.min(targetLat, maxAllowed);
      }

      latitudes.push(targetLat);
      eastGroup[i].calloutLngLat = [sharedLng, targetLat];
    }
  }

  // Fix south group: stack horizontally, matching anchor longitude order
  if (southGroup.length > 0) {
    southGroup.sort((a, b) => a.anchorLngLat[0] - b.anchorLngLat[0]);

    const sharedLat = Math.min(...southGroup.map((c) => c.calloutLngLat[1]));
    const meanAnchorLng =
      southGroup.reduce((sum, c) => sum + c.anchorLngLat[0], 0) /
      southGroup.length;
    const totalWidth = (southGroup.length - 1) * minGapLng;
    const leftLng = meanAnchorLng - totalWidth / 2;

    for (let i = 0; i < southGroup.length; i++) {
      southGroup[i].calloutLngLat = [leftLng + i * minGapLng, sharedLat];
    }
  }
}

/**
 * Build a GeoJSON FeatureCollection of LineString features for leader lines.
 * Each line connects a state's polylabel point to its callout position.
 */
export function buildLeaderLineGeojson(callouts: CalloutPosition[]): any {
  return {
    type: "FeatureCollection",
    features: callouts.map((c) => ({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [c.anchorLngLat, c.calloutLngLat],
      },
      properties: { name: c.name },
    })),
  };
}
