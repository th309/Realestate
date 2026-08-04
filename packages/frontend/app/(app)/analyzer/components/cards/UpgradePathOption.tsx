"use client";

import { motion } from "framer-motion";
import {
  Percent,
  TrendingDown,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type {
  UpgradeLever,
  UpgradePathOption as UpgradePathOptionType,
} from "@propertyiq/analyzer-core";
import { getGradeColor } from "../../lib/grade-colors";

interface UpgradePathOptionProps {
  option: UpgradePathOptionType;
  index: number;
  onApply: () => void;
}

const LEVER_ICON: Record<UpgradeLever, LucideIcon> = {
  purchasePrice: TrendingDown,
  monthlyRent: TrendingUp,
  downPayment: Wallet,
  interestRate: Percent,
};

/**
 * Semantic tokens, not literals — these were #00C853 / #FFB300 / #FB8C00 with
 * rgba() tints, which stayed fixed in dark mode. Mirrors the mockup's `.diff`
 * scheme: green for the easy lever, red for the hard one.
 */
const FEASIBILITY_STYLE: Record<
  UpgradePathOptionType["feasibility"],
  { fg: string; label: string }
> = {
  easy: { fg: "var(--md-tertiary)", label: "Easy" },
  moderate: { fg: "var(--md-warning)", label: "Moderate" },
  hard: { fg: "var(--md-error)", label: "Hard" },
};

/** Whole-dollar / percent formatter for the "from X to Y" line. Lever-aware. */
function formatLeverValue(lever: UpgradeLever, value: number): string {
  if (lever === "interestRate") return `${value.toFixed(2)}%`;
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
  return lever === "monthlyRent" ? `${formatted}/mo` : formatted;
}

export function UpgradePathOption({
  option,
  index,
  onApply,
}: UpgradePathOptionProps) {
  const Icon = LEVER_ICON[option.lever];
  const feasibility = FEASIBILITY_STYLE[option.feasibility];
  const unlocksColor = getGradeColor(option.unlocksGrade);

  return (
    <motion.div
      data-upgrade-option
      data-lever={option.lever}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      // Mockup `.lvbox`: a two-column grid — icon tile, then text — with the
      // apply button spanning the full width beneath. Keeping the button on
      // the same row squeezed the text to ~150px at half width, wrapping
      // titles to three lines and making this column tower over the grading
      // table it now sits beside.
      className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 rounded-xl border border-outline-variant bg-surface-container-low p-3 shadow-sm"
    >
      <div
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-[10px]"
        style={{
          background: `color-mix(in srgb, ${unlocksColor.fg} 12%, transparent)`,
          color: unlocksColor.fg,
        }}
      >
        <Icon size={16} strokeWidth={2} />
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h4
            data-upgrade-option-label
            className="text-[13px] font-bold leading-tight text-on-surface"
          >
            {option.label}
          </h4>
          <span
            data-upgrade-option-feasibility
            aria-label={`Feasibility: ${option.feasibility}`}
            className="rounded-full px-[7px] py-0.5 text-[9px] font-extrabold uppercase tracking-[0.06em]"
            style={{
              color: feasibility.fg,
              background: `color-mix(in srgb, ${feasibility.fg} 12%, transparent)`,
            }}
          >
            {feasibility.label}
          </span>
        </div>
        <p
          data-upgrade-option-body
          className="mt-0.5 font-mono text-xs tabular-nums text-on-surface-variant"
        >
          From {formatLeverValue(option.lever, option.currentValue)} to{" "}
          {formatLeverValue(option.lever, option.targetValue)}{" "}
          <span
            data-upgrade-option-delta
            className="font-semibold"
            style={{ color: unlocksColor.fg }}
          >
            ({option.formattedDelta})
          </span>
        </p>
      </div>

      <button
        type="button"
        data-upgrade-apply
        onClick={onApply}
        className="col-span-2 rounded-[9px] border border-primary bg-surface px-3 py-2 text-xs font-bold text-primary transition-colors duration-200 hover:bg-primary-container/40"
      >
        Apply to inputs
      </button>
    </motion.div>
  );
}
