"use client";

import React from "react";
import type { ScreenerGeoLevel } from "@/lib/data";

interface GeoSegmentedControlProps {
  value: ScreenerGeoLevel;
  onChange: (geo: ScreenerGeoLevel) => void;
}

const SEGMENTS: { value: ScreenerGeoLevel; label: string }[] = [
  { value: "metro", label: "Metro" },
  { value: "county", label: "County" },
  { value: "zip", label: "ZIP" },
];

export function GeoSegmentedControl({
  value,
  onChange,
}: GeoSegmentedControlProps) {
  return (
    <div
      role="group"
      aria-label="Geography level"
      className="inline-flex items-center gap-1 p-1 bg-surface-container rounded-full"
    >
      {SEGMENTS.map((seg) => {
        const isActive = value === seg.value;
        return (
          <button
            key={seg.value}
            type="button"
            onClick={() => onChange(seg.value)}
            aria-pressed={isActive}
            className={`
              px-5 py-2 rounded-full text-sm font-medium transition-all duration-200
              ${
                isActive
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }
            `}
          >
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}
