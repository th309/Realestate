/**
 * Style variants for video / thumbnail rendering.
 *
 * The DEFAULT variant centralizes the PropertyIQ brand hex values that
 * primitives previously hardcoded inline (#3949AB, #1A237E, #00C853, etc.).
 * Future variants come from operator-curated style references via the
 * Style Library admin (Tasks 2.25-2.27): the Vision-extracted palette is
 * mapped onto the same StyleVariant shape and passed via
 * `props.styleVariant` from the renderer.
 *
 * Primitives that previously hardcoded brand colors should now read from
 * the active variant via `getStyleVariant(props.styleVariant)`. That gives
 * us per-format and per-run customization without re-renders of every
 * primitive file.
 */

export interface StyleVariant {
  id: string;
  displayName: string;

  /**
   * Solid colors keyed by semantic role. Primitives reference roles, not
   * raw hex. New primitives should add to this list as needed; never
   * inline a hex.
   */
  colors: {
    /** Primary brand fill (PropertyIQ indigo). */
    primary: string;
    /** Darker primary for headings / score readouts. */
    primaryDark: string;
    /** Container / card background. */
    surface: string;
    /** Container / card text. */
    onSurface: string;
    /** Subdued surface for secondary cards. */
    surfaceContainer: string;
    /** Positive trend / good signal. */
    accentPositive: string;
    /** Negative trend / bad signal. */
    accentNegative: string;
    /** Caution / borderline signal. */
    accentWarning: string;
    /** Caption / overlay text on dark backgrounds. */
    onDark: string;
    /** Full-bleed scene background (very dark navy by default). */
    sceneBackground: string;
  };

  /**
   * Typography variants for the variant's vibe. Primitives may consult
   * these but most stick to the defaults.
   */
  typography: {
    headingFamily: string;
    bodyFamily: string;
    monoFamily: string;
  };
}

export const DEFAULT_VARIANT: StyleVariant = {
  id: "propertyiq_default",
  displayName: "PropertyIQ Indigo (default)",
  colors: {
    primary: "#3949AB",
    primaryDark: "#1A237E",
    surface: "#FAFBFF",
    onSurface: "#1A237E",
    surfaceContainer: "#E8EAF6",
    accentPositive: "#00C853",
    accentNegative: "#B3261E",
    accentWarning: "#FF8F00",
    onDark: "#FAFBFF",
    sceneBackground: "#1A1A2E",
  },
  typography: {
    headingFamily: '"Roboto", system-ui, sans-serif',
    bodyFamily: '"Roboto", system-ui, sans-serif',
    monoFamily: '"Roboto Mono", monospace',
  },
};

const REGISTRY: Record<string, StyleVariant> = {
  [DEFAULT_VARIANT.id]: DEFAULT_VARIANT,
};

/**
 * Resolve the active variant. Pass the operator-selected variant ID
 * (from `props.styleVariant`) — falls back to DEFAULT_VARIANT for any
 * unknown ID so a typo never crashes the render.
 */
export function getStyleVariant(id: string | null | undefined): StyleVariant {
  if (!id) return DEFAULT_VARIANT;
  return REGISTRY[id] ?? DEFAULT_VARIANT;
}

/**
 * Build a StyleVariant from a Style Library reference's extracted
 * palette. Uses heuristics to map the palette positions to semantic
 * roles: index 0 is primary (most prominent), index 1 is primaryDark
 * (often the deepest color), and the brightest color becomes accentPositive.
 *
 * If the palette has < 3 entries the unmapped roles fall back to
 * DEFAULT_VARIANT colors. This keeps thumbnails legible even when the
 * Vision extraction returned a sparse palette.
 */
export function variantFromPalette(args: {
  id: string;
  displayName: string;
  palette: string[];
}): StyleVariant {
  const p = args.palette.filter((c) => /^#[0-9A-Fa-f]{6}$/.test(c));
  return {
    id: args.id,
    displayName: args.displayName,
    colors: {
      primary: p[0] ?? DEFAULT_VARIANT.colors.primary,
      primaryDark:
        p.find(
          (c) =>
            c !== p[0] &&
            relativeLuminance(c) < relativeLuminance(p[0] ?? "#000000"),
        ) ??
        p[1] ??
        DEFAULT_VARIANT.colors.primaryDark,
      surface: DEFAULT_VARIANT.colors.surface,
      onSurface: DEFAULT_VARIANT.colors.onSurface,
      surfaceContainer: p[2] ?? DEFAULT_VARIANT.colors.surfaceContainer,
      accentPositive: brightest(p) ?? DEFAULT_VARIANT.colors.accentPositive,
      accentNegative: DEFAULT_VARIANT.colors.accentNegative,
      accentWarning: DEFAULT_VARIANT.colors.accentWarning,
      onDark: DEFAULT_VARIANT.colors.onDark,
      sceneBackground: darkest(p) ?? DEFAULT_VARIANT.colors.sceneBackground,
    },
    typography: DEFAULT_VARIANT.typography,
  };
}

/**
 * Register a runtime-built variant so subsequent calls to getStyleVariant
 * by id resolve to it. Used by the renderer when a run carries a
 * styleVariant.id that came from the Style Library.
 */
export function registerVariant(v: StyleVariant): void {
  REGISTRY[v.id] = v;
}

// ── Color math helpers ─────────────────────────────────────────────────────

function relativeLuminance(hex: string): number {
  const m = hex.match(/^#?([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/);
  if (!m) return 0;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function brightest(palette: string[]): string | null {
  if (palette.length === 0) return null;
  return palette.reduce((acc, c) =>
    relativeLuminance(c) > relativeLuminance(acc) ? c : acc,
  );
}

function darkest(palette: string[]): string | null {
  if (palette.length === 0) return null;
  return palette.reduce((acc, c) =>
    relativeLuminance(c) < relativeLuminance(acc) ? c : acc,
  );
}
