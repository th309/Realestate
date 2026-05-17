export { gradeDeal } from "./grade";
export { computeUpgradePath } from "./upgrade-path";
export {
  AGGRESSIVE_THRESHOLDS,
  BALANCED_THRESHOLDS,
  BUY_AND_HOLD_DEFAULTS,
  CONSERVATIVE_THRESHOLDS,
  GRADING_PRESET_META,
  GRADING_PRESETS,
  getPresetThresholds,
} from "./thresholds";
export type { GradingPresetMeta, GradingPresetName } from "./thresholds";
export { gradeMetric, letterFromGpa, marketAdjustment } from "./aggregate";
export type {
  AdvisoryResult,
  AutoKillFlag,
  DealGradingResult,
  GradingContext,
  Letter,
  MetricResult,
  MetricThreshold,
  Strategy,
  UpgradeLever,
  UpgradePathOption,
  UpgradePathResult,
  UserThresholds,
} from "./types";
