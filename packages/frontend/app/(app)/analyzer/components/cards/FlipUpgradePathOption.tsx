"use client";

/**
 * Single F&F upgrade-path lever card. Sibling to UpgradePathOption (B&H-only)
 * but with F&F-native icons + value formatting.
 *
 *   purchasePrice   ↓ negotiate down       (TrendingDown)
 *   arv             ↑ better comps/staging (TrendingUp)
 *   rehabCost       ↓ value engineer       (Hammer)
 *   holdMonths      shorten schedule       (Clock)
 *   financingRate   ↓ better rate          (Percent)
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
  FlipUpgradeLever,
  FlipUpgradeOption,
} from "@propertyiq/analyzer-core";
import { getGradeColor } from "../../lib/grade-colors";

interface FlipUpgradePathOptionProps {
  option: FlipUpgradeOption;
  index: number;
  onApply: () => void;
}

const LEVER_ICON: Record<FlipUpgradeLever, LucideIcon> = {
  purchasePrice: TrendingDown,
  arv: TrendingUp,
  rehabCost: Hammer,
  holdMonths: Clock,
  financingRate: Percent,
};

const FEASIBILITY_STYLE: Record<
  FlipUpgradeOption["feasibility"],
  { fg: string; bg: string; label: string }
> = {
  easy: { fg: "#00C853", bg: "rgba(0,200,83,0.08)", label: "Easy" },
  moderate: { fg: "#FFB300", bg: "rgba(255,179,0,0.08)", label: "Moderate" },
  hard: { fg: "#FB8C00", bg: "rgba(251,140,0,0.08)", label: "Hard" },
};

/**
 * Format a lever's raw value for the "From X to Y" line. Different units per
 * lever — dollars for prices, months for hold, percent for rate.
 */
function formatLeverValue(lever: FlipUpgradeLever, value: number): string {
  if (lever === "holdMonths") return `${value.toFixed(0)} mo`;
  if (lever === "financingRate") return `${value.toFixed(2)}%`;
  // purchasePrice / arv / rehabCost — dollars
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function FlipUpgradePathOption({
  option,
  index,
  onApply,
}: FlipUpgradePathOptionProps) {
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
            style={{
              color: feasibility.fg,
              background: feasibility.bg,
            }}
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
