/**
 * Shared Constants
 *
 * Centralized numeric constants used across map components.
 * Avoids hardcoding magic numbers in multiple places.
 */

// ============================================================================
// CURRENCY FORMATTING
// ============================================================================

/**
 * Thresholds for currency abbreviation (M = millions, K = thousands)
 */
export const CURRENCY_SCALES = {
  MILLION: 1_000_000,
  THOUSAND: 1_000,
} as const;

// ============================================================================
// PERCENTILE CALCULATIONS
// ============================================================================

/**
 * Percentile bounds for color scale calculations.
 * Used to exclude outliers when determining value ranges.
 */
export const PERCENTILE_BOUNDS = {
  MIN: 0.05,  // 5th percentile
  MAX: 0.95,  // 95th percentile
} as const;

// ============================================================================
// DEFAULT VALUE RANGES
// ============================================================================

/**
 * Default min/max ranges by metric format.
 * Used when no data is available to calculate actual ranges.
 */
export const DEFAULT_VALUE_RANGES = {
  percent: { min: -5, max: 10 },
  percent_abs: { min: 0, max: 100 },
  days: { min: 0, max: 90 },
  number: { min: 0, max: 10000 },
  index: { min: 0, max: 100 },
  index_1dec: { min: 0, max: 100 },
  currency: { min: 100000, max: 800000 },
} as const;

// ============================================================================
// ANIMATION DURATIONS (ms)
// ============================================================================

/**
 * Animation timing constants following M3 motion guidelines
 */
export const ANIMATION_DURATIONS = {
  SHORT: 200,   // Icons, selection
  MEDIUM: 400,  // Sheets, dialogs
  LONG: 600,    // Page transitions
  MAP_FLY: 1000, // Map camera transitions
} as const;

// ============================================================================
// MAP DEFAULTS
// ============================================================================

/**
 * Default padding for map bounds
 */
export const MAP_PADDING = {
  FLY_TO: 50,
} as const;
