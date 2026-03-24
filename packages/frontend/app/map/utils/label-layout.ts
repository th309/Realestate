/**
 * Label layout engine for state map labels.
 * Computes screen-space ratios, callout positions, and leader line geometries.
 */
import mapboxgl from "mapbox-gl";

/** Approximate character width in pixels at font size 15 (Roboto Medium).
 * Mapbox renders text at ~6.5px per character at size 15 with Roboto.
 * The label also uses variable-anchor which shifts labels to fit. */
const CHAR_WIDTH_PX = 6.5;

/** Font size for state labels. */
const LABEL_FONT_SIZE = 15;

/** Offset distance (degrees) from state bbox edge to callout label. */
const CALLOUT_OFFSET = 2;

/** Minimum gap between callout pills (degrees) to prevent overlap. */
const MIN_CALLOUT_GAP_LAT = 1.2;
const MIN_CALLOUT_GAP_LNG = 2.5;

/**
 * Contiguous US bounding box — excludes Alaska, Hawaii, and territories
 * (Guam at +145°E, American Samoa at -170°W, etc.)
 */
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
 * Compute the screen-space ratio for each label feature.
 * ratio = estimated label pixel width / state pixel width on screen.
 * ratio > 1.0 means the label doesn't fit inside the state.
 */
export function computeScreenSpaceRatios(
  features: LabelFeature[],
  map: mapboxgl.Map,
): void {
  for (const feature of features) {
    // Skip non-contiguous states/territories (their projections are unreliable)
    const [lng, lat] = feature.polylabel;
    if (
      lng < CONUS_LNG_MIN ||
      lng > CONUS_LNG_MAX ||
      lat < CONUS_LAT_MIN ||
      lat > CONUS_LAT_MAX
    ) {
      feature.screenSpaceRatio = 0; // Never gets callout
      continue;
    }

    const [minLng, , maxLng] = feature.bbox;

    // Project bbox corners to screen pixels
    const leftPx = map.project([minLng, feature.polylabel[1]]);
    const rightPx = map.project([maxLng, feature.polylabel[1]]);
    const stateWidthPx = Math.abs(rightPx.x - leftPx.x);

    // Estimate label width: name is the longest line
    const labelText = feature.name;
    const labelWidthPx =
      labelText.length * CHAR_WIDTH_PX * (LABEL_FONT_SIZE / 15);

    feature.screenSpaceRatio =
      stateWidthPx > 0 ? labelWidthPx / stateWidthPx : 999;
  }
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
  preventCrossingsAndOverlaps(callouts);

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
function preventCrossingsAndOverlaps(callouts: CalloutPosition[]): void {
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

  // Fix east group: stack vertically, matching anchor latitude order
  if (eastGroup.length > 0) {
    // Sort by anchor latitude descending (northernmost anchor first)
    eastGroup.sort((a, b) => b.anchorLngLat[1] - a.anchorLngLat[1]);

    // Use a shared longitude: the rightmost callout lng in the group
    const sharedLng = Math.max(...eastGroup.map((c) => c.calloutLngLat[0]));

    // Center the stack around the group's mean anchor latitude
    const meanAnchorLat =
      eastGroup.reduce((sum, c) => sum + c.anchorLngLat[1], 0) /
      eastGroup.length;
    const totalHeight = (eastGroup.length - 1) * MIN_CALLOUT_GAP_LAT;
    const topLat = meanAnchorLat + totalHeight / 2;

    for (let i = 0; i < eastGroup.length; i++) {
      eastGroup[i].calloutLngLat = [
        sharedLng,
        topLat - i * MIN_CALLOUT_GAP_LAT,
      ];
    }
  }

  // Fix south group: stack horizontally, matching anchor longitude order
  if (southGroup.length > 0) {
    southGroup.sort((a, b) => a.anchorLngLat[0] - b.anchorLngLat[0]);

    const sharedLat = Math.min(...southGroup.map((c) => c.calloutLngLat[1]));
    const meanAnchorLng =
      southGroup.reduce((sum, c) => sum + c.anchorLngLat[0], 0) /
      southGroup.length;
    const totalWidth = (southGroup.length - 1) * MIN_CALLOUT_GAP_LNG;
    const leftLng = meanAnchorLng - totalWidth / 2;

    for (let i = 0; i < southGroup.length; i++) {
      southGroup[i].calloutLngLat = [
        leftLng + i * MIN_CALLOUT_GAP_LNG,
        sharedLat,
      ];
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
