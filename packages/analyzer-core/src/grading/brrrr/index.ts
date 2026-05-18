/**
 * BRRRR strategy barrel. Public surface re-exported by `../index.ts`.
 */
export { gradeBrrrrDeal } from "./grade";
export {
  BRRRR_AGGRESSIVE,
  BRRRR_BALANCED,
  BRRRR_CONSERVATIVE,
  BRRRR_DEFAULTS,
  BRRRR_PRESETS,
} from "./thresholds";
export { computeBrrrrUpgradePath } from "./upgrade-path";
export type {
  BrrrrUpgradeLever,
  BrrrrUpgradeOption,
  BrrrrUpgradePathResult,
} from "./upgrade-path-helpers";
export type {
  BrrrrContext,
  BrrrrGradingInput,
  BrrrrInitialFinancingType,
  BrrrrThresholds,
} from "./types";
