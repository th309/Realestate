import type { UserThresholds } from "./types";

export type GradingPresetName = "conservative" | "balanced" | "aggressive";

const SHARED_WEIGHTS: UserThresholds["weights"] = {
  cashOnCash: 25,
  dscr: 25,
  cashFlowPerDoor: 20,
  capRate: 15,
  breakEvenOccupancy: 15,
};

export const CONSERVATIVE_THRESHOLDS: UserThresholds = {
  cashOnCash: {
    A: 0.14,
    B: 0.12,
    C: 0.1,
    D: 0.08,
    direction: "higher_is_better",
  },
  dscr: {
    A: 1.5,
    B: 1.4,
    C: 1.3,
    D: 1.25,
    direction: "higher_is_better",
  },
  cashFlowPerDoor: {
    A: 500,
    B: 400,
    C: 300,
    D: 200,
    direction: "higher_is_better",
  },
  capRate: {
    A: 0.09,
    B: 0.08,
    C: 0.07,
    D: 0.06,
    direction: "higher_is_better",
  },
  breakEvenOccupancy: {
    A: 0.7,
    B: 0.75,
    C: 0.8,
    D: 0.85,
    direction: "lower_is_better",
  },
  weights: SHARED_WEIGHTS,
};

export const BALANCED_THRESHOLDS: UserThresholds = {
  cashOnCash: {
    A: 0.12,
    B: 0.1,
    C: 0.08,
    D: 0.06,
    direction: "higher_is_better",
  },
  dscr: {
    A: 1.4,
    B: 1.3,
    C: 1.2,
    D: 1.15,
    direction: "higher_is_better",
  },
  cashFlowPerDoor: {
    A: 400,
    B: 300,
    C: 200,
    D: 100,
    direction: "higher_is_better",
  },
  capRate: {
    A: 0.08,
    B: 0.07,
    C: 0.06,
    D: 0.05,
    direction: "higher_is_better",
  },
  breakEvenOccupancy: {
    A: 0.75,
    B: 0.8,
    C: 0.85,
    D: 0.9,
    direction: "lower_is_better",
  },
  weights: SHARED_WEIGHTS,
};

export const AGGRESSIVE_THRESHOLDS: UserThresholds = {
  cashOnCash: {
    A: 0.1,
    B: 0.08,
    C: 0.06,
    D: 0.04,
    direction: "higher_is_better",
  },
  dscr: {
    A: 1.3,
    B: 1.2,
    C: 1.15,
    D: 1.1,
    direction: "higher_is_better",
  },
  cashFlowPerDoor: {
    A: 300,
    B: 200,
    C: 100,
    D: 50,
    direction: "higher_is_better",
  },
  capRate: {
    A: 0.07,
    B: 0.06,
    C: 0.05,
    D: 0.04,
    direction: "higher_is_better",
  },
  breakEvenOccupancy: {
    A: 0.8,
    B: 0.85,
    C: 0.9,
    D: 0.95,
    direction: "lower_is_better",
  },
  weights: SHARED_WEIGHTS,
};

export const GRADING_PRESETS: Record<GradingPresetName, UserThresholds> = {
  conservative: CONSERVATIVE_THRESHOLDS,
  balanced: BALANCED_THRESHOLDS,
  aggressive: AGGRESSIVE_THRESHOLDS,
};

export interface GradingPresetMeta {
  name: GradingPresetName;
  label: string;
  description: string;
  shortSummary: string;
}

export const GRADING_PRESET_META: Record<GradingPresetName, GradingPresetMeta> =
  {
    conservative: {
      name: "conservative",
      label: "Conservative",
      description:
        "Stricter benchmarks for risk-averse buy-and-hold. Prioritizes safety margin and debt coverage.",
      shortSummary: "CoC 12%+ · DSCR 1.40+ · Cap rate 8%+ · CF $400/mo+",
    },
    balanced: {
      name: "balanced",
      label: "Balanced",
      description:
        "Standard investor benchmarks. The default rubric for most buy-and-hold deals.",
      shortSummary: "CoC 10%+ · DSCR 1.30+ · Cap rate 7%+ · CF $300/mo+",
    },
    aggressive: {
      name: "aggressive",
      label: "Aggressive",
      description:
        "Looser benchmarks for appreciation-led plays or strong-growth markets where cash flow is secondary.",
      shortSummary: "CoC 8%+ · DSCR 1.20+ · Cap rate 6%+ · CF $200/mo+",
    },
  };

/**
 * Default rubric for buy-and-hold grading — aliased to BALANCED_THRESHOLDS.
 * Consumers that want explicit per-preset behavior should reference
 * GRADING_PRESETS or BALANCED_THRESHOLDS directly.
 */
export const BUY_AND_HOLD_DEFAULTS: UserThresholds = BALANCED_THRESHOLDS;

export function getPresetThresholds(name: GradingPresetName): UserThresholds {
  return GRADING_PRESETS[name];
}
