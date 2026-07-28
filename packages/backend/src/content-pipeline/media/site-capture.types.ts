// packages/backend/src/content-pipeline/media/site-capture.types.ts
//
// Declarative spec for driving headless Chromium against the LIVE site and
// capturing the frames that fill a video template's media slots.

/**
 * Punch-in target for the renderer, in coordinates NORMALIZED to the captured
 * image: `x`/`y` are the top-left corner, `w`/`h` the size, each 0–1 of the
 * image's width/height. Normalized (not pixels) so the renderer stays correct
 * regardless of what resolution the frame was shot at.
 */
export interface FocusRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type CaptureStep =
  | { action: 'click'; selector: string }
  | { action: 'type'; selector: string; text: string }
  | { action: 'scroll'; selector?: string; y?: number }
  | { action: 'wait'; selector?: string; ms?: number };

export interface CaptureTarget {
  /** Path on the target site, e.g. "/analyzer". Leading slash optional. */
  route: string;
  /** Which media slot in the video template this frame fills. */
  slotId: string;
  /** Defaults to 1920x1080 — the video canvas. */
  viewport?: { width: number; height: number };
  /** Interaction choreography, run in order after the page loads. */
  steps?: CaptureStep[];
  /**
   * Selector that means "ready to shoot". Evaluated AFTER `steps`, so it can
   * gate on something the steps caused (e.g. `.recharts-line` once the
   * analyzer has actually computed and mounted its charts).
   */
  waitFor?: string;
  /**
   * Element whose bounding box becomes this slot's `focusRegion`. Lets capture
   * pre-set the renderer's punch-in target instead of an operator hand-tuning
   * pixel coordinates after the fact.
   */
  focusSelector?: string;
  /**
   * Capture the whole scrollable document instead of just the viewport.
   * Changes the captured image's coordinate space, which `focusRegion`
   * accounts for. Defaults to false — video slots want viewport-shaped frames.
   */
  fullPage?: boolean;
}

export interface CapturedFrame {
  slotId: string;
  buffer: Buffer;
  /** Actual pixel dimensions of `buffer`, read from the PNG header. */
  width: number;
  height: number;
  /** width / height — what the renderer fits into the slot. */
  sourceAspect: number;
  focusRegion?: FocusRegion;
}

export interface SiteCaptureOptions {
  /** Overrides `CAPTURE_BASE_URL`. */
  baseUrl?: string;
  /**
   * Only needed for gated routes (`/dashboard`, `/map`). `/analyzer`,
   * `/docs/mcp` and `/reports/sample` are public — capture them without this.
   */
  credentials?: { email: string; password: string };
}

/**
 * Thrown for every capture failure. Carries the route and (where relevant) the
 * selector so a failure names exactly which target and which element broke —
 * capture NEVER substitutes a blank or placeholder frame and never silently
 * skips a slot, because a missing screenshot must not reach the render as a
 * plausible-looking black rectangle.
 */
export class SiteCaptureError extends Error {
  readonly route: string;
  readonly selector?: string;

  constructor(
    message: string,
    context: { route: string; selector?: string; cause?: unknown },
  ) {
    const where = context.selector
      ? `route="${context.route}" selector="${context.selector}"`
      : `route="${context.route}"`;
    super(`${message} (${where})`);
    this.name = 'SiteCaptureError';
    this.route = context.route;
    this.selector = context.selector;
    if (context.cause !== undefined) this.cause = context.cause;
  }
}
