/**
 * PropertyIQ analyzer palette tokens — Robinhood-grade polish layer.
 *
 * These are the TS surface over the `--piq-*` CSS variables defined at :root
 * in app/globals.css. Use as inline styles or anywhere a string color is
 * accepted (SVG fill/stroke, Recharts color props, framer-motion).
 *
 *   <div style={{ color: piq.textPrimary }} />
 *   <Line stroke={piq.green} />
 *
 * Do not import M3 tokens (--md-*) into analyzer primitives — the piq palette
 * is intentionally distinct (slate text, sharper accent hues).
 */
export const piq = {
  indigo: "var(--piq-indigo)",
  indigoDark: "var(--piq-indigo-dark)",
  green: "var(--piq-green)",
  red: "var(--piq-red)",
  amber: "var(--piq-amber)",
  teal: "var(--piq-teal)",
  orange: "var(--piq-orange)",
  surface: "var(--piq-surface)",
  surfaceDark: "var(--piq-surface-dark)",
  canvas: "var(--piq-canvas)",
  textPrimary: "var(--piq-text-primary)",
  textMuted: "var(--piq-text-muted)",
  border: "var(--piq-border)",
} as const;

export type PiqColorKey = keyof typeof piq;
