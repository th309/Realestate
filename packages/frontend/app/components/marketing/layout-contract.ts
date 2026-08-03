/**
 * The single source of layout truth for every marketing surface.
 *
 * Before this file, the marketing pages used six container widths, two gutter
 * conventions split by route group, twelve per-section rhythms on the homepage
 * alone, and five H1 scales. Pages import from here rather than writing
 * spacing or heading utilities inline.
 */

/** Standard content column. The only permitted marketing container width. */
export const CONTAINER = "mx-auto w-full max-w-6xl px-6 lg:px-8";

/** Narrow column for running prose — blog bodies, legal copy. */
export const PROSE = "mx-auto w-full max-w-3xl px-6 lg:px-8";

export const RHYTHM = {
  standard: "py-20 lg:py-28",
  tight: "py-12 lg:py-16",
} as const;
export type Rhythm = keyof typeof RHYTHM;

/**
 * Sections alternate between exactly two surfaces. This replaces the page-wide
 * gradient, which prevented any section from owning a surface.
 */
export const SURFACE = {
  a: "bg-surface",
  b: "bg-surface-container-low",
} as const;
export type Surface = keyof typeof SURFACE;

export const HEADING = {
  /** Landing heroes only. */
  hero: "text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]",
  /** Every non-hero page title. */
  page: "text-3xl md:text-4xl font-bold tracking-tight",
  section: "text-2xl md:text-3xl font-bold tracking-tight",
  card: "text-lg md:text-xl font-semibold tracking-tight",
} as const;
export type HeadingLevel = keyof typeof HEADING;
