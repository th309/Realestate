/**
 * PropertyIQ Brand Constants
 * Timing values are in frames at 30fps.
 */

export const FPS = 30;

// ── Brand colors ────────────────────────────────────────────────────────────
export const COLORS = {
  bg: "#0f172a",
  bgCard: "#1e293b",
  bgCardAlt: "#243146",
  text: "#f8fafc",
  textMuted: "#94a3b8",
  textDim: "#475569",
  accent: "#3b82f6",
  accentGlow: "rgba(59,130,246,0.25)",

  // Score tier colors (match ticket spec)
  tierRed: "#ef4444",
  tierYellow: "#eab308",
  tierGreen: "#22c55e",
  tierBlue: "#3b82f6",

  // Trend arrows
  trendUp: "#22c55e",
  trendDown: "#ef4444",
  trendStable: "#94a3b8",
} as const;

// ── Score tier helpers ───────────────────────────────────────────────────────
export function scoreTierColor(score: number): string {
  if (score >= 90) return COLORS.tierBlue;
  if (score >= 70) return COLORS.tierGreen;
  if (score >= 40) return COLORS.tierYellow;
  return COLORS.tierRed;
}

export function scoreTierLabel(score: number): string {
  if (score >= 90) return "EXCELLENT";
  if (score >= 80) return "GREAT";
  if (score >= 70) return "GOOD";
  if (score >= 60) return "FAIR";
  if (score >= 50) return "AVERAGE";
  if (score >= 40) return "BELOW AVG";
  if (score >= 20) return "POOR";
  return "VERY POOR";
}

// ── Scene timing (frames at 30fps) ──────────────────────────────────────────
export const TIMING = {
  intro: { start: 0, duration: 60 },           // 0-2s   intro card
  scoreReveal: { start: 60, duration: 210 },    // 2-9s   animated counter
  trendChart: { start: 270, duration: 240 },    // 9-17s  trend sparkline
  statCards: { start: 510, duration: 270 },     // 17-26s stat cards
  comparison: { start: 780, duration: 300 },    // 26-36s comparison (skipped in single mode)
  outro: { start: 1080, duration: 210 },        // 36-43s CTA outro (single mode)
  outroComparison: { start: 1080, duration: 210 },
} as const;

// Total duration (frames) — Series sums scene durations
// single: 60+210+240+270+210 = 990 (~33s)
// comparison: 60+210+240+270+300+210 = 1290 (~43s)
export const TOTAL_DURATION_SINGLE = 990;
export const TOTAL_DURATION_COMPARISON = 1290;

// ── Layout ───────────────────────────────────────────────────────────────────
export const LANDSCAPE = { width: 1920, height: 1080 };
export const VERTICAL = { width: 1080, height: 1920 };
