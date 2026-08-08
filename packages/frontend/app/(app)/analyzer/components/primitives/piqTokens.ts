/**
 * PropertyIQ analyzer palette tokens.
 *
 * These are the TS surface over the `--piq-*` CSS variables defined at :root
 * in app/globals.css, which in turn come from the approved analyzer mockup at
 * docs/superpowers/mockups/2026-08-02/piq-analyzer-mockup.html. Use anywhere a
 * string colour is accepted (SVG fill/stroke, Recharts props, inline styles);
 * prefer the Tailwind utilities (`bg-piq-surface`, `text-piq-ink`) in markup.
 *
 *   <div style={{ color: piq.ink }} />
 *   <Line stroke={piq.green} />
 *
 * Do not import M3 tokens (--md-*) into analyzer components — the piq palette
 * is intentionally distinct, and mixing the two is what put lavender hairlines
 * and navy headings on a spec that asks for near-black on indigo-grey.
 */
export const piq = {
  /* Neutrals */
  canvas: "var(--piq-canvas)",
  surface: "var(--piq-surface)",
  surfaceDark: "var(--piq-surface-dark)",
  soft: "var(--piq-soft)",
  border: "var(--piq-border)",

  /* Text ramp — ink for headings and figures, body for prose, muted for labels */
  textPrimary: "var(--piq-text-primary)",
  textBody: "var(--piq-text-body)",
  textMuted: "var(--piq-text-muted)",
  /** Alias of textPrimary, matching the mockup's `--ink`. */
  ink: "var(--piq-text-primary)",

  /* Accents. Each pairs with a `-soft` container fill. */
  indigo: "var(--piq-indigo)",
  onIndigo: "var(--piq-on-indigo)",
  indigoDark: "var(--piq-indigo-dark)",
  indigoSoft: "var(--piq-indigo-soft)",
  green: "var(--piq-green)",
  /** Saturated fill green — bars and rings only, never text. */
  greenBright: "var(--piq-green-bright)",
  greenSoft: "var(--piq-green-soft)",
  red: "var(--piq-red)",
  redSoft: "var(--piq-red-soft)",
  amber: "var(--piq-amber)",
  amberSoft: "var(--piq-amber-soft)",
  orange: "var(--piq-orange)",
  violet: "var(--piq-violet)",
  violetSoft: "var(--piq-violet-soft)",
  teal: "var(--piq-teal)",
  tealSoft: "var(--piq-teal-soft)",

  /* Card elevation */
  shadow: "var(--piq-shadow)",
} as const;

export type PiqColorKey = keyof typeof piq;
