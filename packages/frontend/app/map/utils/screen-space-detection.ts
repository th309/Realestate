/**
 * Screen-space detection for state label positioning.
 * Determines which states need callout labels by checking whether
 * the label text fits inside the state's screen-pixel width.
 */
import mapboxgl from "mapbox-gl";
import type { LabelFeature } from "./label-layout";

/** Approximate character width in pixels at font size 15 (Roboto Medium). */
const CHAR_WIDTH_PX = 6.5;

/** Font size for state labels. */
const LABEL_FONT_SIZE = 15;

/** Contiguous US bounding box — excludes Alaska, Hawaii, and territories. */
const CONUS_LNG_MIN = -130;
const CONUS_LNG_MAX = -60;
const CONUS_LAT_MIN = 24;
const CONUS_LAT_MAX = 50;

/**
 * Compute the screen-space ratio for each label feature.
 * ratio = estimated label pixel width / state pixel width on screen.
 * ratio > 1.0 means the label doesn't fit inside the state → needs callout.
 *
 * States that CAN fit their label get centered labels with text-allow-overlap: true
 * (the white halo makes minor overlaps readable). Only states where the label
 * physically cannot fit get pushed to callout leader lines.
 */
export function computeScreenSpaceRatios(
  features: LabelFeature[],
  map: mapboxgl.Map,
): void {
  for (const feature of features) {
    const [lng, lat] = feature.polylabel;
    if (
      lng < CONUS_LNG_MIN ||
      lng > CONUS_LNG_MAX ||
      lat < CONUS_LAT_MIN ||
      lat > CONUS_LAT_MAX
    ) {
      feature.screenSpaceRatio = 0;
      continue;
    }

    const [minLng, , maxLng] = feature.bbox;
    const leftPx = map.project([minLng, feature.polylabel[1]]);
    const rightPx = map.project([maxLng, feature.polylabel[1]]);
    const stateWidthPx = Math.abs(rightPx.x - leftPx.x);

    const labelWidthPx =
      feature.name.length * CHAR_WIDTH_PX * (LABEL_FONT_SIZE / 15);

    feature.screenSpaceRatio =
      stateWidthPx > 0 ? labelWidthPx / stateWidthPx : 999;
  }
}
