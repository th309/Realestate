"use client";

/**
 * PresetSelector — segmented control at the top of the drawer offering
 * Conservative / Balanced / Aggressive presets for the active strategy.
 *
 * When the user has hand-edited thresholds (no preset match), shows a
 * "Custom" badge. Clicking a preset while in Custom state triggers the
 * parent's overwrite-confirm flow (PresetConfirmModal).
 */

import type { GradingPresetName } from "@propertyiq/analyzer-core";

export interface PresetOption {
  name: GradingPresetName;
  label: string;
  hint: string;
}

export const PRESET_OPTIONS: PresetOption[] = [
  {
    name: "conservative",
    label: "Conservative",
    hint: "Stricter bar. Risk-averse, prioritizes safety margin and cushion.",
  },
  {
    name: "balanced",
    label: "Balanced",
    hint: "Standard investor benchmarks. The default rubric for most deals.",
  },
  {
    name: "aggressive",
    label: "Aggressive",
    hint: "Looser bar. Velocity or appreciation plays where cash flow is secondary.",
  },
];

interface PresetSelectorProps {
  activePreset: GradingPresetName | null;
  isCustom: boolean;
  onSelect: (preset: GradingPresetName) => void;
}

export function PresetSelector({
  activePreset,
  isCustom,
  onSelect,
}: PresetSelectorProps) {
  return (
    <div
      data-testid="preset-selector"
      className="px-5 py-3 border-b-[1.75px] border-outline-variant flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-on-surface-variant">
          Risk profile
        </span>
        {isCustom && (
          <span
            data-testid="preset-custom-badge"
            className="text-[10px] uppercase tracking-wider text-[var(--md-tertiary)]"
          >
            Custom
          </span>
        )}
      </div>
      <div
        role="radiogroup"
        aria-label="Grading risk profile"
        className="inline-flex rounded-full bg-surface-container p-1 border border-outline-variant w-full"
      >
        {PRESET_OPTIONS.map((opt) => {
          const isActive = activePreset === opt.name;
          return (
            <button
              key={opt.name}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={opt.label}
              title={opt.hint}
              onClick={() => onSelect(opt.name)}
              data-testid={`preset-option-${opt.name}`}
              className={
                "flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors " +
                (isActive
                  ? "bg-[var(--md-primary)] text-[var(--md-on-primary)]"
                  : "text-on-surface-variant hover:text-on-surface")
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface PresetConfirmModalProps {
  target: GradingPresetName;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PresetConfirmModal({
  target,
  onConfirm,
  onCancel,
}: PresetConfirmModalProps) {
  const label = PRESET_OPTIONS.find((o) => o.name === target)?.label ?? target;
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="preset-confirm-title"
      data-testid="preset-confirm-modal"
      className="absolute inset-0 z-10 flex items-center justify-center bg-on-surface/40 px-5"
    >
      <div className="bg-surface-container-high rounded-[28px] shadow-lg p-5 max-w-[360px] w-full flex flex-col gap-4">
        <h3
          id="preset-confirm-title"
          className="text-base font-medium text-on-surface"
        >
          Switch to {label}?
        </h3>
        <p className="text-sm text-on-surface-variant">
          You&apos;ve made custom edits. Switching presets will replace them
          with {label.toLowerCase()} defaults. This can&apos;t be undone after
          you save.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-full hover:bg-surface-container"
          >
            Keep custom
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium rounded-full bg-[var(--md-primary)] text-[var(--md-on-primary)] hover:opacity-90"
          >
            Apply {label}
          </button>
        </div>
      </div>
    </div>
  );
}
