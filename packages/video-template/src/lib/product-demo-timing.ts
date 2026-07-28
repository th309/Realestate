/**
 * Beat math for the product demo.
 *
 * The two ratios share one authored spine but not one running time — a 25s
 * vertical and a 75s horizontal are different edits of the same material.
 * The manifest carries each format's beat budget in seconds; this turns it
 * into frames for however many features were actually authored.
 *
 * Pure — no React, no Remotion — so the arithmetic is testable without
 * rendering a frame.
 */
import type { BeatBudget } from "../formats/manifest-types";

export interface ProductDemoBeat {
  from: number;
  duration: number;
}

export interface ProductDemoBeats {
  hook: ProductDemoBeat;
  features: ProductDemoBeat[];
  cta: ProductDemoBeat;
  totalFrames: number;
}

export function buildProductDemoBeats(
  featureCount: number,
  beats: BeatBudget,
  fps = 30,
  /** An avatar hook runs as long as its clip, not the budgeted guess. */
  hookOverrideFrames?: number,
): ProductDemoBeats {
  const sec = (s: number) => Math.max(1, Math.round(s * fps));

  const hookDuration = hookOverrideFrames ?? sec(beats.hookSec);
  const featureDuration = sec(beats.perItemSec);
  const ctaDuration = sec(beats.ctaSec);

  const features: ProductDemoBeat[] = [];
  let cursor = hookDuration;
  for (let i = 0; i < Math.max(1, featureCount); i++) {
    features.push({ from: cursor, duration: featureDuration });
    cursor += featureDuration;
  }

  return {
    hook: { from: 0, duration: hookDuration },
    features,
    cta: { from: cursor, duration: ctaDuration },
    totalFrames: cursor + ctaDuration,
  };
}

/**
 * Callouts a given format shows per feature.
 *
 * A phone frame cannot hold three labels and stay readable, so the vertical
 * cut takes only the first. Same authored copy, less of it on screen —
 * which is what keeps "one script, both ratios" honest instead of shipping
 * an unreadable vertical.
 */
export function calloutsForFormat(
  callouts: readonly string[],
  isVertical: boolean,
): string[] {
  return isVertical ? callouts.slice(0, 1) : callouts.slice(0, 3);
}

/** Default anchor for the Nth callout when the author didn't place it. */
export function defaultCalloutAnchor(
  index: number,
  isVertical: boolean,
): { x: number; y: number } {
  // Stack down the left on horizontal; down the centre on vertical, where
  // the safe zone already squeezes the usable width.
  return isVertical
    ? { x: 0.18, y: 0.3 + index * 0.1 }
    : { x: 0.12, y: 0.28 + index * 0.12 };
}
