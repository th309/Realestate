/**
 * Public surface of the grading module. Cross-strategy primitives come from
 * `./shared`, strategy engines from `./buy-and-hold` and `./fix-and-flip`,
 * and the (currently B&H-only) upgrade-path engine from `./upgrade-path`.
 */

// Cross-strategy aggregate utilities and types
export {
  clampGpa,
  gpaPoints,
  gradeMetric,
  letterFromGpa,
  marketAdjustment,
} from "./shared/aggregate";
export {
  breakEvenOccupancy,
  capRate,
  cashFlowPerDoorMonthly,
  dscr,
  monthlyHoldingCosts,
  monthlyLoanInterest,
  monthlyPI,
  noiAnnual,
  operatingExpensesAnnual,
} from "./shared/calculations";
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

// Buy-and-hold strategy
export { gradeBuyAndHoldDeal } from "./buy-and-hold/grade";
export {
  AGGRESSIVE_THRESHOLDS,
  BALANCED_THRESHOLDS,
  BUY_AND_HOLD_DEFAULTS,
  CONSERVATIVE_THRESHOLDS,
  GRADING_PRESET_META,
  GRADING_PRESETS,
  getPresetThresholds,
} from "./buy-and-hold/thresholds";
export type {
  GradingPresetMeta,
  GradingPresetName,
} from "./buy-and-hold/thresholds";
export type {
  GradingContext,
  UpgradeLever,
  UpgradePathOption,
  UpgradePathResult,
  UserThresholds,
} from "./buy-and-hold/types";

// Fix-and-flip strategy
export { gradeFixAndFlipDeal } from "./fix-and-flip/grade";
export { FIX_AND_FLIP_DEFAULTS } from "./fix-and-flip/thresholds";
export { computeFlipUpgradePath } from "./fix-and-flip/upgrade-path";
export type {
  FixAndFlipContext,
  FixAndFlipInput,
  FixAndFlipThresholds,
} from "./fix-and-flip/types";
export type {
  FlipUpgradeLever,
  FlipUpgradeOption,
  FlipUpgradePathResult,
} from "./fix-and-flip/upgrade-path-helpers";

// BRRRR strategy
export { gradeBrrrrDeal } from "./brrrr/grade";
export { BRRRR_DEFAULTS } from "./brrrr/thresholds";
export { computeBrrrrUpgradePath } from "./brrrr/upgrade-path";
export type {
  BrrrrContext,
  BrrrrGradingInput,
  BrrrrInitialFinancingType,
  BrrrrThresholds,
} from "./brrrr/types";
export type {
  BrrrrUpgradeLever,
  BrrrrUpgradeOption,
  BrrrrUpgradePathResult,
} from "./brrrr/upgrade-path-helpers";

// Upgrade-path engine — B&H is at the top level (legacy location).
// F&F upgrade-path lives in ./fix-and-flip/upgrade-path.ts (computeFlipUpgradePath).
// BRRRR upgrade-path lives in ./brrrr/upgrade-path.ts (computeBrrrrUpgradePath).
export { computeUpgradePath } from "./upgrade-path";
