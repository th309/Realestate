/**
 * Top-level type barrel for the grading module. Re-exports cross-strategy
 * primitives from `./shared/types` and strategy-specific types from each
 * strategy subdir. Direct deep imports into shared/ or buy-and-hold/ are also
 * fine — this file exists so consumers can `import type { ... } from
 * '.../grading'` without knowing the internal layout.
 */

// Cross-strategy primitives
export { LETTER_LABEL, LETTER_RANK } from "./shared/types";
export type {
  AdvisoryResult,
  AutoKillFlag,
  DealGradingResult,
  Letter,
  MetricResult,
  MetricThreshold,
  Strategy,
  UserThresholdsGeneric,
} from "./shared/types";

// Buy-and-hold strategy-specific types
export type {
  GradingContext,
  UpgradeLever,
  UpgradePathOption,
  UpgradePathResult,
  UserThresholds,
} from "./buy-and-hold/types";

// Fix-and-flip strategy-specific types
export type {
  FixAndFlipContext,
  FixAndFlipInput,
  FixAndFlipThresholds,
} from "./fix-and-flip/types";
