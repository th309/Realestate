/**
 * Auto-Kill tab metadata + validation — mirrors the engine's rule inventory
 * (analyzer-core shared/autokill-config.ts) and the backend DTO bounds
 * (auto-kill-config.dto.ts). Keys are the persisted JSONB keys; do not rename.
 *
 * Bounds: DSCR 0.3-2.0 · shares 0.05-1.0 · dollars 0-500 000 · multiplier 1-10
 */
import {
  AUTOKILL_DEFAULTS,
  type AutoKillRuleConfig,
  type Strategy,
} from "@propertyiq/analyzer-core";

export interface AutoKillRowMeta {
  key: string;
  label: string;
  description: string;
  /** null = toggle-only rule (no numeric limit). */
  unit: "ratio" | "percent" | "dollars" | "multiplier" | null;
  defaultValue: number | null;
  min?: number;
  max?: number;
}

const BH_ROWS: AutoKillRowMeta[] = [
  {
    key: "dscrFloor",
    label: "DSCR floor",
    description: "Kills the deal when DSCR falls below this value.",
    unit: "ratio",
    defaultValue: AUTOKILL_DEFAULTS.BUY_AND_HOLD.dscrFloor,
    min: 0.3,
    max: 2,
  },
  {
    key: "taxInsShareOfRent",
    label: "Tax + insurance share of rent",
    description:
      "Kills when taxes + insurance exceed this share of gross annual rent.",
    unit: "percent",
    defaultValue: AUTOKILL_DEFAULTS.BUY_AND_HOLD.taxInsShareOfRent,
    min: 0.05,
    max: 1,
  },
  {
    key: "floodNoInsurance",
    label: "Flood zone without insurance",
    description:
      "Kills when the property sits in flood zone AE/VE/A with no flood insurance quoted.",
    unit: null,
    defaultValue: null,
  },
  {
    key: "negativeCashflowNoAck",
    label: "Negative cash flow",
    description:
      "Kills on negative pretax cash flow unless you accept the deal as an appreciation play.",
    unit: null,
    defaultValue: null,
  },
];

const FF_ROWS: AutoKillRowMeta[] = [
  {
    key: "projectLoss",
    label: "Projected loss",
    description: "Kills any flip whose exit doesn't cover total project costs.",
    unit: null,
    defaultValue: null,
  },
  {
    key: "minNetProfit",
    label: "Minimum net profit",
    description: "Kills when projected profit lands below this floor.",
    unit: "dollars",
    defaultValue: AUTOKILL_DEFAULTS.FIX_AND_FLIP.minNetProfit,
    min: 0,
    max: 500_000,
  },
  {
    key: "rehabContingency",
    label: "Rehab contingency floor",
    description:
      "Kills estimate-based rehabs whose contingency sits below this share.",
    unit: "percent",
    defaultValue: AUTOKILL_DEFAULTS.FIX_AND_FLIP.rehabContingency,
    min: 0.05,
    max: 1,
  },
  {
    key: "extremeHold",
    label: "Extreme hold (× market DOM)",
    description:
      "Kills when the planned hold exceeds this multiple of market days-on-market.",
    unit: "multiplier",
    defaultValue: AUTOKILL_DEFAULTS.FIX_AND_FLIP.extremeHold,
    min: 1,
    max: 10,
  },
];

const BRRRR_ROWS: AutoKillRowMeta[] = [
  {
    key: "refiDscrFloor",
    label: "Post-refi DSCR floor",
    description: "Kills when post-refi DSCR falls below this value.",
    unit: "ratio",
    defaultValue: AUTOKILL_DEFAULTS.BRRRR.refiDscrFloor,
    min: 0.3,
    max: 2,
  },
  {
    key: "negativePostRefiCashflow",
    label: "Negative post-refi cash flow",
    description: "Kills when the post-refi hold bleeds cash monthly.",
    unit: null,
    defaultValue: null,
  },
  {
    key: "rehabContingency",
    label: "Rehab contingency floor",
    description:
      "Kills estimate-based rehabs whose contingency sits below this share.",
    unit: "percent",
    defaultValue: AUTOKILL_DEFAULTS.BRRRR.rehabContingency,
    min: 0.05,
    max: 1,
  },
  {
    key: "maxCashLeft",
    label: "Max cash left in deal",
    description: "Kills when cash trapped after the refi exceeds this amount.",
    unit: "dollars",
    defaultValue: AUTOKILL_DEFAULTS.BRRRR.maxCashLeft,
    min: 0,
    max: 500_000,
  },
];

const ROWS_BY_STRATEGY: Record<Strategy, AutoKillRowMeta[]> = {
  BUY_AND_HOLD: BH_ROWS,
  FIX_AND_FLIP: FF_ROWS,
  BRRRR: BRRRR_ROWS,
};

export function autoKillRowsForStrategy(strategy: Strategy): AutoKillRowMeta[] {
  return ROWS_BY_STRATEGY[strategy] ?? BH_ROWS;
}

/** Extract the autoKills block from an opaque thresholds object. */
export function getAutoKillConfig(
  thresholds: object | null,
): Record<string, AutoKillRuleConfig> {
  const block = (thresholds as { autoKills?: unknown } | null)?.autoKills;
  return block && typeof block === "object"
    ? (block as Record<string, AutoKillRuleConfig>)
    : {};
}

const fmtBound = (row: AutoKillRowMeta, v: number): string =>
  row.unit === "percent" ? `${Math.round(v * 100)}%` : String(v);

export function validateAutoKills(
  strategy: Strategy,
  config: Record<string, AutoKillRuleConfig> | undefined,
): Record<string, string | null> {
  const errors: Record<string, string | null> = {};
  for (const row of autoKillRowsForStrategy(strategy)) {
    const value = config?.[row.key]?.value;
    if (
      row.unit != null &&
      value != null &&
      (value < (row.min ?? -Infinity) || value > (row.max ?? Infinity))
    ) {
      errors[row.key] =
        `Must be between ${fmtBound(row, row.min ?? 0)} and ${fmtBound(row, row.max ?? 0)}`;
    } else {
      errors[row.key] = null;
    }
  }
  return errors;
}

export function hasAnyAutoKillError(
  errors: Record<string, string | null>,
): boolean {
  return Object.values(errors).some((e) => e != null);
}
