/**
 * Platform safe zones — the regions of the frame the host app covers with
 * its own chrome.
 *
 * On vertical short-form the platform paints its UI ON TOP of the video:
 * TikTok stacks the caption, username and music ticker across the bottom
 * and a rail of action buttons up the right edge; Reels and Shorts do the
 * same with slightly smaller footprints. Anything drawn under that chrome
 * is simply not readable, so captions and callouts must stay inside these
 * insets even though the pixels technically exist.
 *
 * Values are the union of the three platforms (i.e. the most conservative
 * of each edge), expressed as a fraction of the frame so they hold at any
 * resolution. Horizontal keeps a modest margin for the player's own
 * progress bar and title overlay.
 */

export interface SafeZoneInsets {
  /** Fraction of height reserved at the top. */
  top: number;
  /** Fraction of height reserved at the bottom. */
  bottom: number;
  /** Fraction of width reserved on the left. */
  left: number;
  /** Fraction of width reserved on the right. */
  right: number;
}

/**
 * 9:16. Bottom is the expensive one — TikTok's caption block plus music
 * ticker runs deep, and Reels' is close behind. Right covers the action
 * rail (like, comment, share, sound).
 */
export const VERTICAL_SAFE_ZONE: SafeZoneInsets = {
  top: 0.06,
  bottom: 0.22,
  left: 0.05,
  right: 0.14,
};

/** 16:9. Only the player's own controls/title overlay to clear. */
export const HORIZONTAL_SAFE_ZONE: SafeZoneInsets = {
  top: 0.05,
  bottom: 0.1,
  left: 0.05,
  right: 0.05,
};

export function safeZoneFor(isVertical: boolean): SafeZoneInsets {
  return isVertical ? VERTICAL_SAFE_ZONE : HORIZONTAL_SAFE_ZONE;
}

/**
 * Resolve the fractional insets to pixels for a given frame size — what
 * layout code actually positions against.
 */
export function safeZonePx(
  insets: SafeZoneInsets,
  width: number,
  height: number,
): { top: number; bottom: number; left: number; right: number } {
  return {
    top: Math.round(insets.top * height),
    bottom: Math.round(insets.bottom * height),
    left: Math.round(insets.left * width),
    right: Math.round(insets.right * width),
  };
}
