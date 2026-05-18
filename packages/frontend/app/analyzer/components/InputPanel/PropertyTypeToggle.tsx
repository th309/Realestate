"use client";

/**
 * SFH/MF toggle + unit-count field for the input panel. When MF is selected
 * the unit count drives propertyClass classification (small_mf for 2-4
 * units, commercial_mf for 5+), which downstream controls which input
 * groups and strategy options the rest of InputPanel shows.
 *
 * Extracted from InputPanel to keep that file under the §1.3 400-line
 * hard limit. Pure presentation — InputPanel owns the state.
 */

import type { PropertyClass } from "@propertyiq/analyzer-core";
import { NumField } from "./NumField";

type PropertyType = "sfh" | "mf";

interface PropertyTypeToggleProps {
  propertyType: PropertyType;
  setPropertyType: (t: PropertyType) => void;
  unitCount: number | null;
  setUnitCount: (n: number | null) => void;
  propertyClass: PropertyClass;
}

export function PropertyTypeToggle({
  propertyType,
  setPropertyType,
  unitCount,
  setUnitCount,
  propertyClass,
}: PropertyTypeToggleProps) {
  return (
    <div data-property-type-toggle>
      <label className="text-xs uppercase font-semibold text-on-surface-variant block mb-1">
        Property Type
      </label>
      <div className="inline-flex rounded-full overflow-hidden border border-outline-variant">
        {(["sfh", "mf"] as const).map((t) => {
          const isActive = t === propertyType;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setPropertyType(t)}
              aria-pressed={isActive}
              className="px-4 py-1 text-xs font-semibold transition-colors"
              style={{
                background: isActive ? "var(--md-primary)" : "transparent",
                color: isActive
                  ? "var(--md-on-primary)"
                  : "var(--md-on-surface-variant)",
                letterSpacing: "0.04em",
              }}
            >
              {t === "sfh" ? "SFH" : "MF"}
            </button>
          );
        })}
      </div>
      {propertyType === "mf" && (
        <>
          <div className="mt-3">
            <NumField
              label="# of units"
              value={unitCount}
              onChange={setUnitCount}
              placeholder="2"
            />
          </div>
          <div className="mt-2 text-[10px] text-on-surface-variant leading-snug">
            {propertyClass === "commercial_mf"
              ? "5+ units → commercial underwriting (DSCR-sized loan, cap-rate valuation, balloon term)."
              : propertyClass === "small_mf"
                ? "2–4 units → residential underwriting (HUD/FHA conventions, same loan products as SFH)."
                : "Enter unit count to determine underwriting class."}
          </div>
        </>
      )}
    </div>
  );
}
