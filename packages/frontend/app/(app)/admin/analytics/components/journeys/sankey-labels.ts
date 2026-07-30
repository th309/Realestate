/**
 * Label sizing for the Navigation Flows Sankey.
 *
 * Split out of sankey-layout.ts, which crossed the 300-line hard limit
 * (CLAUDE.md 1.3). These are the two places the diagram has to decide how much
 * of a page path it can actually show; the layout module owns the geometry.
 */

/** Approximate advance width of one character at the 10px mono label size. */
const MONO_CHAR_WIDTH = 5.8;

/**
 * Horizontal gutter reserved for labels on each side of the diagram.
 *
 * Proportional so the ribbons keep the middle of a wide panel, floored so the
 * labels do not vanish on a phone and capped so they cannot crowd out the
 * diagram itself.
 */
export function labelGutterFor(width: number): number {
  return Math.max(64, Math.min(150, width * 0.22));
}

/** How many characters fit in a gutter, leaving a small breathing margin. */
export function labelCharBudget(gutter: number): number {
  return Math.max(6, Math.floor((gutter - 10) / MONO_CHAR_WIDTH));
}

/**
 * Middle-truncate a path: `/markets/metro/austin-tx` → `/markets/…ustin-tx`.
 *
 * The tail of a URL is what distinguishes it, so trailing truncation collapses
 * every long path under a shared prefix to the same visible string — three
 * different rows all reading `/markets/metro/aust…`. The full path is always
 * available on hover and focus.
 */
export function truncateMiddle(value: string, maxChars: number): string {
  if (value.length <= maxChars || maxChars < 6) return value;
  const head = Math.ceil((maxChars - 1) / 2);
  const tail = Math.floor((maxChars - 1) / 2);
  return `${value.slice(0, head)}…${value.slice(value.length - tail)}`;
}
