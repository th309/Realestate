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

/** How far east (in degrees) to offset callout labels from the easternmost NE state. */
const CALLOUT_LNG_OFFSET = 2;

/**
 * Contiguous US bounding box — excludes Alaska, Hawaii, and territories
 * (Guam at +145°E, American Samoa at -170°W, etc.)
 */
const CONUS_LNG_MIN = -130;
const CONUS_LNG_MAX = -60;
const CONUS_LAT_MIN = 24;
const CONUS_LAT_MAX = 50;

/** Minimum latitude gap between stacked callout labels (degrees). */
const CALLOUT_LAT_GAP = 0.7;

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
 * Compute callout positions for states that need leader lines.
 * Positions are stacked vertically off the east coast, sorted north to south.
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

  // Sort north to south (highest latitude first)
  needsCallout.sort((a, b) => b.polylabel[1] - a.polylabel[1]);

  // Find the easternmost bbox edge among all callout states for the column position
  const maxEastLng = Math.max(...needsCallout.map((f) => f.bbox[2]));
  const calloutLng = maxEastLng + CALLOUT_LNG_OFFSET;

  // Stack callouts vertically starting from the northernmost state's latitude
  const startLat = needsCallout[0].polylabel[1] + 0.5;

  return needsCallout.map((feature, index) => ({
    name: feature.name,
    value: feature.value,
    fillColor: feature.fillColor,
    anchorLngLat: feature.polylabel,
    calloutLngLat: [calloutLng, startLat - index * CALLOUT_LAT_GAP] as [
      number,
      number,
    ],
  }));
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
