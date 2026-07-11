/**
 * Confidence pill tonal colors by data-quality level. A/B are healthy (accent
 * green), C is a notable-gaps warning (amber), F is insufficient (error red) —
 * matching CLAUDE.md §9 confidence semantics. Semantic tokens keep dark mode
 * correct.
 *
 * Single source of truth for the gauge composition's confidence pill — shared
 * by `ScoreGaugeWidget` (client-fetched, market pages) and the forecast hero
 * (server-rendered, `app/(public)/forecast/[slug]/page.tsx`) so both share one
 * visual vocabulary instead of two diverged copies. Kept in a plain module
 * (no "use client") so the server-rendered forecast hero can call it directly
 * without crossing a client-component boundary.
 */
export function confidencePillClass(level: string): string {
  switch (level?.toLowerCase()) {
    case "a":
    case "b":
      return "bg-tertiary-container text-on-tertiary-container";
    case "c":
      return "bg-warning-container text-on-warning-container";
    default:
      return "bg-error-container text-on-error-container";
  }
}
