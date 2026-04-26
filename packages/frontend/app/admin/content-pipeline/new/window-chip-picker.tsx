// packages/frontend/app/admin/content-pipeline/new/window-chip-picker.tsx
"use client";
import type { ScoreMoverWindowDays } from "../lib/movers-api";

const WINDOWS: { days: ScoreMoverWindowDays; label: string }[] = [
  { days: 30, label: "1mo" },
  { days: 90, label: "90d" },
  { days: 180, label: "6mo" },
  { days: 365, label: "12mo" },
];

export function WindowChipPicker({
  value,
  onChange,
}: {
  value: ScoreMoverWindowDays;
  onChange: (v: ScoreMoverWindowDays) => void;
}) {
  return (
    <div
      className="inline-flex rounded-full bg-surface-container-low p-1"
      role="radiogroup"
      aria-label="Time window"
    >
      {WINDOWS.map((w) => {
        const active = value === w.days;
        return (
          <button
            key={w.days}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(w.days)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200 ${
              active
                ? "bg-primary text-on-primary"
                : "text-on-surface hover:bg-surface-container"
            }`}
          >
            {w.label}
          </button>
        );
      })}
    </div>
  );
}
