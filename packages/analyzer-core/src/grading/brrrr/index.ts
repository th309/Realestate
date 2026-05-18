/**
 * BRRRR strategy barrel. Public surface re-exported by `../index.ts`.
 */
export { gradeBrrrrDeal } from "./grade";
export { BRRRR_DEFAULTS } from "./thresholds";
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
