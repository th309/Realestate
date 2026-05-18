"use client";

/**
 * Single BRRRR upgrade-path lever card. Sibling to FlipUpgradePathOption.
 *
 *   purchasePrice         ↓ negotiate down          (TrendingDown)
 *   arv                   ↑ better comps/finishes   (TrendingUp)
 *   rehabCost             ↓ value engineer          (Hammer)
 *   refiLtvPct            ↑ higher-LTV lender       (TrendingUp)
 *   monthlyRent           ↑ push post-refi rent     (TrendingUp)
 *   holdMonthsBeforeRefi  shorten season            (Clock)
 *   refiRate              ↓ lock lower refi rate    (Percent)
 */
import { motion } from "framer-motion";
import {
  Clock,
  Hammer,
  Percent,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type {
  BrrrrUpgradeLever,
  BrrrrUpgradeOption,
} from "@propertyiq/analyzer-core";
import { getGradeColor } from "../../lib/grade-colors";

interface BrrrrUpgradePathOptionProps {
  option: BrrrrUpgradeOption;
  index: number;
  onApply: () => void;
}

const LEVER_ICON: Record<BrrrrUpgradeLever, LucideIcon> = {
  purchasePrice: TrendingDown,
  arv: TrendingUp,
  rehabCost: Hammer,
  refiLtvPct: TrendingUp,
  monthlyRent: TrendingUp,
  holdMonthsBeforeRefi: Clock,
  refiRate: Percent,
};

const FEASIBILITY_STYLE: Record<
  BrrrrUpgradeOption["feasibility"],
  { fg: string; bg: string; label: string }
> = {
  easy: { fg: "#00C853", bg: "rgba(0,200,83,0.08)", label: "Easy" },
  moderate: { fg: "#FFB300", bg: "rgba(255,179,0,0.08)", label: "Moderate" },
  hard: { fg: "#FB8C00", bg: "rgba(251,140,0,0.08)", label: "Hard" },
};

/** Format a raw lever value for the "From X to Y" line. Units vary by lever. */
function formatLeverValue(lever: BrrrrUpgradeLever, value: number): string {
  if (lever === "holdMonthsBeforeRefi") return `${value.toFixed(0)} mo`;
  if (lever === "refiRate") return `${value.toFixed(2)}%`;
  if (lever === "refiLtvPct") return `${(value * 100).toFixed(1)}%`;
  // Dollar-valued levers (purchasePrice / arv / rehabCost / monthlyRent).
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function BrrrrUpgradePathOption({
  option,
  index,
  onApply,
}: BrrrrUpgradePathOptionProps) {
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
      className="flex items-center gap-4 rounded-xl border border-outline-variant bg-surface p-4 shadow-sm"
    >
      <div
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{ background: unlocksColor.bg, color: unlocksColor.fg }}
      >
        <Icon size={20} strokeWidth={2} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4
            data-upgrade-option-label
            className="text-base font-semibold leading-tight text-on-surface"
          >
            {option.label}
          </h4>
          <span
            data-upgrade-option-feasibility
            aria-label={`Feasibility: ${option.feasibility}`}
            className="rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums"
            style={{ color: feasibility.fg, background: feasibility.bg }}
          >
            {feasibility.label}
          </span>
        </div>
        <p
          data-upgrade-option-body
          className="mt-1 text-sm tabular-nums text-on-surface-variant"
          style={{ fontFamily: "var(--font-roboto-mono)" }}
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
        className="shrink-0 rounded-full border border-outline px-4 py-2 text-sm font-medium text-primary transition-colors duration-200 hover:bg-primary-container/40"
      >
        Apply to inputs
      </button>
    </motion.div>
  );
}
