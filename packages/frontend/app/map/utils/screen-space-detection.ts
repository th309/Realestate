/**
 * Screen-space detection for state label positioning.
 * Determines which states need callout labels by checking:
 * 1. Whether the label fits inside the state's screen width
 * 2. Whether the label collides with neighboring state labels
 */
import mapboxgl from "mapbox-gl";
import type { LabelFeature } from "./label-layout";

/** Approximate character width in pixels at font size 15 (Roboto Medium). */
const CHAR_WIDTH_PX = 6.5;

/** Font size for state labels. */
const LABEL_FONT_SIZE = 15;

/** Estimated label height in pixels (name line + value line). */
const LABEL_HEIGHT_PX = 32;

/**
 * Contiguous US bounding box — excludes Alaska, Hawaii, and territories.
 */
const CONUS_LNG_MIN = -130;
const CONUS_LNG_MAX = -60;
const CONUS_LAT_MIN = 24;
const CONUS_LAT_MAX = 50;

interface LabelRect {
  cx: number;
  cy: number;
  hw: number;
  hh: number;
  stateWidthPx: number;
}

/**
 * Compute the screen-space ratio for each label feature.
 * Two passes:
 * 1. Check if the label fits inside its own state (ratio > 1.0 = doesn't fit)
 * 2. Check if the label collides with any other state's label — if so, the
 *    smaller state gets pushed to a callout (ratio set > 1.0)
 *
 * This ensures every state is EITHER centered on the map OR shown as a callout.
 */
export function computeScreenSpaceRatios(
  features: LabelFeature[],
  map: mapboxgl.Map,
): void {
  const rects: (LabelRect | null)[] = [];

  // Pass 1: compute screen-space ratio and label rectangles
  for (const feature of features) {
    const [lng, lat] = feature.polylabel;
    if (
      lng < CONUS_LNG_MIN ||
      lng > CONUS_LNG_MAX ||
      lat < CONUS_LAT_MIN ||
      lat > CONUS_LAT_MAX
    ) {
      feature.screenSpaceRatio = 0;
      rects.push(null);
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

    // Store label rectangle in screen pixels for collision detection
    const centerPx = map.project(feature.polylabel);
    rects.push({
      cx: centerPx.x,
      cy: centerPx.y,
      hw: labelWidthPx / 2,
      hh: LABEL_HEIGHT_PX / 2,
      stateWidthPx,
    });
  }

  // Pass 2: detect label-label collisions among states that currently
  // have centered labels (ratio <= 1.0). If two labels overlap, the
  // one with less screen space gets pushed to a callout.
  for (let i = 0; i < features.length; i++) {
    if (features[i].screenSpaceRatio > 1.0 || !rects[i]) continue;

    for (let j = i + 1; j < features.length; j++) {
      if (features[j].screenSpaceRatio > 1.0 || !rects[j]) continue;

      const a = rects[i]!;
      const b = rects[j]!;

      // AABB overlap test
      if (
        Math.abs(a.cx - b.cx) < a.hw + b.hw &&
        Math.abs(a.cy - b.cy) < a.hh + b.hh
      ) {
        // Collision: push the smaller state to callout
        if (a.stateWidthPx <= b.stateWidthPx) {
          features[i].screenSpaceRatio = 1.01;
        } else {
          features[j].screenSpaceRatio = 1.01;
        }
      }
    }
  }
}
