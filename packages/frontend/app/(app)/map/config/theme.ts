/**
 * Theme Colors Configuration
 *
 * Centralized color definitions for benchmark and comparison views.
 * Uses M3 semantic color naming conventions.
 */

// ============================================================================
// VIEW MODE COLORS
// ============================================================================

/**
 * Primary colors for homebuyer vs investor views
 */
export const VIEW_MODE_COLORS = {
  homebuyer: {
    primary: '#f97316',      // Orange-500
    primaryDark: '#ea580c',  // Orange-600 (for gradients)
  },
  investor: {
    primary: '#10b981',      // Emerald-500
    primaryDark: '#059669',  // Emerald-600 (for gradients)
  },
} as const;

// ============================================================================
// BENCHMARK COMPARISON COLORS
// ============================================================================

/**
 * Colors for benchmark comparison indicators
 */
export const BENCHMARK_COLORS = {
  /** Green - beats both benchmarks */
  excellent: '#10b981',  // Emerald-500
  /** Yellow/Amber - beats one benchmark */
  moderate: '#fbbf24',   // Amber-400
  /** Red - beats neither benchmark */
  poor: '#ef4444',       // Red-500
  /** Emerald for positive indicators */
  positive: '#10b981',   // Emerald-500
  /** Rose for negative indicators */
  negative: '#ef4444',   // Red-500 (matches rose-500)
} as const;

// ============================================================================
// GRADIENT BACKGROUNDS
// ============================================================================

/**
 * Gradient backgrounds for benchmark bars (lowerIsBetter determines direction)
 */
export const BENCHMARK_GRADIENTS = {
  /** Good → Bad (for lowerIsBetter=true metrics) */
  lowerIsBetter: `linear-gradient(to right, rgba(16, 185, 129, 0.3), rgba(251, 191, 36, 0.3), rgba(239, 68, 68, 0.3))`,
  /** Bad → Good (for lowerIsBetter=false metrics) */
  higherIsBetter: `linear-gradient(to right, rgba(239, 68, 68, 0.3), rgba(251, 191, 36, 0.3), rgba(16, 185, 129, 0.3))`,
} as const;

/**
 * Get the appropriate gradient for a metric based on lowerIsBetter flag
 */
export function getBenchmarkGradient(lowerIsBetter: boolean): string {
  return lowerIsBetter
    ? BENCHMARK_GRADIENTS.lowerIsBetter
    : BENCHMARK_GRADIENTS.higherIsBetter;
}

/**
 * Get comparison status color based on performance
 */
export function getComparisonColor(beatState: boolean, beatNational: boolean): string {
  if (beatState && beatNational) return BENCHMARK_COLORS.excellent;
  if (beatState || beatNational) return BENCHMARK_COLORS.moderate;
  return BENCHMARK_COLORS.poor;
}
