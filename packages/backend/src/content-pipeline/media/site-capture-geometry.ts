// packages/backend/src/content-pipeline/media/site-capture-geometry.ts
//
// Pure geometry for site capture: turning a browser-measured element box into
// a normalized focusRegion, and reading a PNG's true pixel dimensions.
// Kept free of Puppeteer so the coordinate math is directly unit-testable.

import type { FocusRegion } from './site-capture.types';

/**
 * Raw measurement taken inside the page. `rect` is exactly what
 * `getBoundingClientRect()` returns — VIEWPORT-relative CSS pixels, already
 * net of scroll — which is why the scroll offsets are carried separately.
 */
export interface FocusMeasurement {
  rect: { x: number; y: number; width: number; height: number };
  scrollX: number;
  scrollY: number;
  viewportWidth: number;
  viewportHeight: number;
  documentWidth: number;
  documentHeight: number;
}

export interface FocusRegionResult {
  region: FocusRegion;
  /** True when the element ran past the frame edge and was cropped to fit. */
  clipped: boolean;
}

/**
 * Smallest region the renderer will accept.
 *
 * Mirrors `FocusRegionSchema` in `packages/video-template/src/media/media-slot.ts`,
 * which bounds `w`/`h` at `min(0.01)`. Rejecting a sliver here means a bad
 * punch-in target fails during capture, naming the route and selector, instead
 * of surfacing as a Zod error deep inside the render with no such context.
 */
const MIN_FOCUS_EXTENT = 0.01;

/**
 * Convert a measured element box into coordinates normalized to the CAPTURED
 * IMAGE (not to the viewport, and not to the document unless that is what was
 * shot).
 *
 * The image's origin is what makes this subtle:
 *  - viewport screenshot  → origin IS the viewport, so `getBoundingClientRect()`
 *    is already in the image's coordinate space. Adding scroll here would be
 *    the classic bug: it double-counts and pushes the region off-frame.
 *  - full-page screenshot → origin is the DOCUMENT, so scroll must be added
 *    back in to undo the viewport-relative offset, and the divisor is the full
 *    document size rather than the viewport size.
 *
 * The box is then intersected with the frame, so an element hanging off the
 * edge yields the visible part (the only part the renderer can punch into)
 * rather than out-of-range coordinates. Returns `null` when the element lies
 * entirely outside the frame, or when what remains is below MIN_FOCUS_EXTENT —
 * the caller treats either as a hard failure, since a punch-in target that is
 * not in the shot (or is too small to punch into) is not a usable focus region.
 */
export function computeFocusRegion(
  measurement: FocusMeasurement,
  fullPage: boolean,
): FocusRegionResult | null {
  const frameWidth = fullPage
    ? measurement.documentWidth
    : measurement.viewportWidth;
  const frameHeight = fullPage
    ? measurement.documentHeight
    : measurement.viewportHeight;

  if (!(frameWidth > 0) || !(frameHeight > 0)) return null;

  const left = fullPage
    ? measurement.rect.x + measurement.scrollX
    : measurement.rect.x;
  const top = fullPage
    ? measurement.rect.y + measurement.scrollY
    : measurement.rect.y;
  const right = left + measurement.rect.width;
  const bottom = top + measurement.rect.height;

  const clippedLeft = Math.max(0, left);
  const clippedTop = Math.max(0, top);
  const clippedRight = Math.min(frameWidth, right);
  const clippedBottom = Math.min(frameHeight, bottom);

  if (clippedRight <= clippedLeft || clippedBottom <= clippedTop) return null;

  const w = (clippedRight - clippedLeft) / frameWidth;
  const h = (clippedBottom - clippedTop) / frameHeight;
  if (w < MIN_FOCUS_EXTENT || h < MIN_FOCUS_EXTENT) return null;

  return {
    region: {
      x: clippedLeft / frameWidth,
      y: clippedTop / frameHeight,
      w,
      h,
    },
    clipped:
      clippedLeft !== left ||
      clippedTop !== top ||
      clippedRight !== right ||
      clippedBottom !== bottom,
  };
}
