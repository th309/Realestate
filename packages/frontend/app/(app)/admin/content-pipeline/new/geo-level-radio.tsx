// packages/frontend/app/admin/content-pipeline/new/geo-level-radio.tsx
"use client";
import type { ScoreMoverGeo } from "../lib/movers-api";

const LEVELS: { value: ScoreMoverGeo; label: string }[] = [
  { value: "metro", label: "Metro" },
  { value: "county", label: "County" },
  { value: "zip", label: "ZIP" },
];

export function GeoLevelRadio({
  value,
  onChange,
}: {
  value: ScoreMoverGeo;
  onChange: (v: ScoreMoverGeo) => void;
}) {
  return (
    <div
      className="inline-flex gap-2"
      role="radiogroup"
      aria-label="Geography level"
    >
      {LEVELS.map((l) => {
        const active = value === l.value;
        return (
          <label
            key={l.value}
            className={`px-4 py-1.5 rounded-full border text-sm font-semibold cursor-pointer transition-colors duration-200 ${
              active
                ? "bg-secondary-container text-on-secondary-container border-transparent"
                : "bg-surface text-on-surface border-outline hover:bg-surface-container-low"
            }`}
          >
            <input
              type="radio"
              className="sr-only"
              checked={active}
              onChange={() => onChange(l.value)}
            />
            {l.label}
          </label>
        );
      })}
    </div>
  );
}
