"use client";
import { StrategyChips } from "../Hero/StrategyChips";
import type { Strategy } from "../../lib/strategy-tile-mappers";
import type { PropertyClass } from "@propertyiq/analyzer-core";

export type AnalysisMode = "focused" | "compare";

interface StrategyControlsProps {
  mode: AnalysisMode;
  onModeChange: (m: AnalysisMode) => void;
  activeStrategy: Strategy;
  onStrategyChange: (s: Strategy) => void;
  propertyClass?: PropertyClass;
}

const MODE_OPTIONS: Array<{
  value: AnalysisMode;
  label: string;
  hint: string;
}> = [
  {
    value: "focused",
    label: "I know my strategy",
    hint: "We'll show only the inputs that strategy needs.",
  },
  {
    value: "compare",
    label: "Help me decide",
    hint: "Enter everything — we'll rank strategies by profit.",
  },
];

/**
 * Top-of-panel mode picker. Drives two things at once:
 *   1. Which inputs are visible in InputPanel (compare → all fields)
 *   2. Which strategy gets the hero KPI tiles (focused → user's pick; compare → best play)
 *
 * The strategy chips only show in focused mode — in compare mode, the user
 * hasn't picked, so StrategyCompare below the hero IS the picker.
 */
export function StrategyControls({
  mode,
  onModeChange,
  activeStrategy,
  onStrategyChange,
  propertyClass,
}: StrategyControlsProps) {
  // Commercial MF only supports buy & hold — flipping 50 units doesn't happen,
  // and BRRRR's residential refi mechanics don't apply. Hide the chips entirely
  // and show a small note instead.
  const isCommercial = propertyClass === "commercial_mf";
  const hint = MODE_OPTIONS.find((o) => o.value === mode)?.hint;
  return (
    <div data-strategy-controls className="space-y-2">
      <label className="text-xs uppercase font-semibold text-on-surface-variant block">
        Investment Strategy
      </label>
      <div
        role="tablist"
        aria-label="Analysis mode"
        className="inline-flex rounded-full overflow-hidden border border-outline-variant w-full"
      >
        {MODE_OPTIONS.map((opt) => {
          const isActive = opt.value === mode;
          return (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onModeChange(opt.value)}
              className="flex-1 px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{
                background: isActive ? "var(--md-primary)" : "transparent",
                color: isActive
                  ? "var(--md-on-primary)"
                  : "var(--md-on-surface-variant)",
                letterSpacing: "0.02em",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {hint && (
        <div className="text-[10px] text-on-surface-variant leading-snug">
          {hint}
        </div>
      )}

      {mode === "focused" && !isCommercial && (
        <div className="pt-1">
          {/* Chips are self-labeling (Buy & Hold / Fix & Flip / BRRRR) so the
              redundant "Strategy" sub-label was dropped — it sat directly
              under the "Investment Strategy" header above. */}
          <StrategyChips active={activeStrategy} onChange={onStrategyChange} />
        </div>
      )}
      {mode === "focused" && isCommercial && (
        <div className="pt-1 text-[10px] text-on-surface-variant leading-snug">
          Commercial MF (5+ units) is held long-term — flip and BRRRR don't
          apply.
        </div>
      )}
    </div>
  );
}
