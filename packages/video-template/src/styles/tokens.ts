/**
 * PropertyIQ brand tokens — the ONLY place hex values, border weights,
 * fill opacities, and font stacks may be defined in the video package.
 *
 * Compositions never inline a hex. They import from here (directly or via
 * `constants.ts` COLORS / `style-variants.ts` variants, both of which are
 * derived from these values). This mirrors the web app's semantic-token
 * rule (CLAUDE.md §8.2) at the type level: adding a color means adding it
 * here, where the brand mapping is reviewable in one diff.
 */

// ── Palette ─────────────────────────────────────────────────────────────────
export const PALETTE = {
  /** Primary brand indigo — neutral data, buttons, the dial. */
  indigo: "#3949AB",
  /** Headings on light, deep fills on dark. */
  indigoDark: "#1A237E",
  /** Secondary elements, icons, accents that must read on the dark stage. */
  indigoMedium: "#5C6BC0",
  /** Hover/emphasis tint; premium numerals on the dark stage. */
  indigoLight: "#C5CAE9",
  /** Muted label text on the dark stage. */
  indigoMuted: "#9FA8DA",
  /** Card/container tint (M3 primary container). */
  container: "#E8EAF6",
  /** Positive metrics, growth, upward momentum. */
  positive: "#00C853",
  /** Negative metrics, decline. Video/dataviz value (matches --piq-red). */
  negative: "#E53935",
  /** Caution / borderline. Video/dataviz value (matches --piq-amber). */
  warning: "#FFB300",
  /** Light page surface (rarely used on the dark stage). */
  surface: "#FAFBFF",
  /** Full-bleed dark stage every composition plays on. */
  stage: "#1A1A2E",
  /** Deeper vignette edge behind the stage; panel shadows. */
  stageDeep: "#08081A",
} as const;

export type PaletteColor = keyof typeof PALETTE;

// ── Rules ───────────────────────────────────────────────────────────────────
/** Border weight for cards, pills, rings — 1.75px everywhere, no exceptions. */
export const BORDER_WIDTH = 1.75;

/** Fill opacity for tinted backgrounds/highlights — 8%, no exceptions. */
export const FILL_OPACITY = 0.08;

// ── Typography ──────────────────────────────────────────────────────────────
export const FONTS = {
  /** All UI text (Roboto 300–700 per brand spec). */
  body: '"Roboto", "Segoe UI", system-ui, sans-serif',
  /** Display headings — same family, heavier weights + tighter tracking. */
  display: '"Roboto", "Segoe UI", system-ui, sans-serif',
  /** Numbers, scores, metrics. Always with tabular figures. */
  mono: '"Roboto Mono", "Consolas", monospace',
} as const;

/** Spread into the style of ANY numeric display so digits never jitter. */
export const NUMERIC = { fontVariantNumeric: "tabular-nums" } as const;

// ── Helpers ─────────────────────────────────────────────────────────────────
/** Hex → rgba() at the given alpha. */
export function withAlpha(hex: string, alpha: number): string {
  const m = hex.match(/^#?([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/);
  if (!m) return hex;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16));
  return `rgba(${r},${g},${b},${alpha})`;
}

/** The 8% brand fill of a palette color — card/segment/highlight backgrounds. */
export function brandFill(hex: string): string {
  return withAlpha(hex, FILL_OPACITY);
}

/** The 1.75px brand border in a palette color (pass alpha to soften). */
export function brandBorder(hex: string, alpha = 1): string {
  return `${BORDER_WIDTH}px solid ${alpha === 1 ? hex : withAlpha(hex, alpha)}`;
}

// ── Chart rules (Robinhood-style spec, shared with the web app) ────────────
export const CHART = {
  /** Never render gridlines; a single dashed baseline is the only guide. */
  gridlines: false,
  /** Line weight for plotted series. */
  strokeWidth: 5,
  /** Endpoint glow dot radius; pulses after draw-in completes. */
  endpointRadius: 9,
} as const;
