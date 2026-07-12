/**
 * Auto-kill rule configuration — the user-tunable layer over the strategy
 * engines' automatic disqualification checks.
 *
 * Every rule resolves as:
 *   enabled = config.enabled ?? true
 *   value   = config.value ?? <per-request context override> ?? DEFAULT
 *
 * Absent or partial config is behavior-identical to the pre-config engine.
 * Rule KEYS here are stable API surface (persisted in user_thresholds JSONB);
 * rule CODES (DSCR_BELOW_1, ...) in the grade helpers never change either.
 */

export interface AutoKillRuleConfig {
  /** Rule runs unless explicitly disabled. */
  enabled?: boolean;
  /** Numeric limit for rules that have one; ignored for toggle-only rules. */
  value?: number;
}

export interface BuyAndHoldAutoKillConfig {
  dscrFloor?: AutoKillRuleConfig;
  taxInsShareOfRent?: AutoKillRuleConfig;
  floodNoInsurance?: AutoKillRuleConfig;
  negativeCashflowNoAck?: AutoKillRuleConfig;
}

export interface FixAndFlipAutoKillConfig {
  projectLoss?: AutoKillRuleConfig;
  minNetProfit?: AutoKillRuleConfig;
  rehabContingency?: AutoKillRuleConfig;
  extremeHold?: AutoKillRuleConfig;
}

export interface BrrrrAutoKillConfig {
  refiDscrFloor?: AutoKillRuleConfig;
  negativePostRefiCashflow?: AutoKillRuleConfig;
  rehabContingency?: AutoKillRuleConfig;
  maxCashLeft?: AutoKillRuleConfig;
}

/** Default numeric limits — MUST mirror the engines' historical literals. */
export const AUTOKILL_DEFAULTS = {
  BUY_AND_HOLD: {
    dscrFloor: 1.0,
    taxInsShareOfRent: 0.4,
  },
  FIX_AND_FLIP: {
    minNetProfit: 10_000,
    rehabContingency: 0.1,
    extremeHold: 2,
  },
  BRRRR: {
    refiDscrFloor: 1.0,
    rehabContingency: 0.1,
    maxCashLeft: 10_000,
  },
} as const;

export function ruleEnabled(cfg: AutoKillRuleConfig | undefined): boolean {
  return cfg?.enabled ?? true;
}

export function ruleValue(
  cfg: AutoKillRuleConfig | undefined,
  fallback: number,
): number {
  return cfg?.value ?? fallback;
}
