export type Comp = {
  id: string;
  pricePerSqft: number;
  address?: string;
};

export type CompsHover =
  | { kind: "bar"; index: number }
  | { kind: "subject" }
  | null;

export function ordinal(n: number): string {
  const v = Math.abs(n) % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (v % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/**
 * Path data for a rectangle with only the top two corners rounded. Bar extends
 * upward from (x, baselineY) to height `h`. Same point/command count as
 * `collapsedTopRoundedPath` so SMIL can morph between them smoothly.
 */
export function topRoundedPath(
  x: number,
  baselineY: number,
  w: number,
  h: number,
  r: number,
): string {
  const radius = Math.max(0, Math.min(r, w / 2, h));
  const top = baselineY - h;
  return [
    `M ${x},${baselineY}`,
    `L ${x},${top + radius}`,
    `Q ${x},${top} ${x + radius},${top}`,
    `L ${x + w - radius},${top}`,
    `Q ${x + w},${top} ${x + w},${top + radius}`,
    `L ${x + w},${baselineY}`,
    "Z",
  ].join(" ");
}

/**
 * Path data for a rectangle with only the bottom two corners rounded. Bar
 * extends downward from (x, baselineY) to (x+w, baselineY+h). Same
 * point/command sequence as `topRoundedPath` and `collapsedTopRoundedPath` so
 * SMIL can morph between all three.
 */
export function bottomRoundedPath(
  x: number,
  baselineY: number,
  w: number,
  h: number,
  r: number,
): string {
  const radius = Math.max(0, Math.min(r, w / 2, h));
  const bottom = baselineY + h;
  return [
    `M ${x},${baselineY}`,
    `L ${x},${bottom - radius}`,
    `Q ${x},${bottom} ${x + radius},${bottom}`,
    `L ${x + w - radius},${bottom}`,
    `Q ${x + w},${bottom} ${x + w},${bottom - radius}`,
    `L ${x + w},${baselineY}`,
    "Z",
  ].join(" ");
}

/** Same path shape as `topRoundedPath` but collapsed to the baseline. */
export function collapsedTopRoundedPath(
  x: number,
  baselineY: number,
  w: number,
): string {
  return [
    `M ${x},${baselineY}`,
    `L ${x},${baselineY}`,
    `Q ${x},${baselineY} ${x},${baselineY}`,
    `L ${x + w},${baselineY}`,
    `Q ${x + w},${baselineY} ${x + w},${baselineY}`,
    `L ${x + w},${baselineY}`,
    "Z",
  ].join(" ");
}

export function computePercentile(comps: Comp[], subject: number): number {
  if (comps.length === 0) return 0;
  const countAtOrBelow = comps.filter((c) => c.pricePerSqft <= subject).length;
  return Math.round((countAtOrBelow / comps.length) * 100);
}

export function formatPriceSqft(value: number): string {
  return `$${Math.round(value)}`;
}
