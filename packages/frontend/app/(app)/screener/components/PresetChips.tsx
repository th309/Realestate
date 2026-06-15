"use client";

import React from "react";
import type { ScreenerQuery } from "@/lib/data";

export type PresetId = "hottest" | "undervalued" | "cashflow";

export interface Preset {
  id: PresetId;
  label: string;
  query: Partial<ScreenerQuery>;
}

export const PRESETS: Preset[] = [
  {
    id: "hottest",
    label: "Hottest Markets",
    query: {
      sortBy: "score",
      sortOrder: "desc",
    },
  },
  {
    id: "undervalued",
    label: "Undervalued + High Score",
    query: {
      scoreMin: 70,
      overvaluedMax: 0,
      sortBy: "overvalued_pct",
      sortOrder: "asc",
    },
  },
  {
    id: "cashflow",
    label: "Cash-Flow",
    query: {
      capRateMin: 6,
      sortBy: "cap_rate",
      sortOrder: "desc",
    },
  },
];

interface PresetChipsProps {
  activePreset: PresetId | null;
  onSelect: (preset: Preset) => void;
}

export function PresetChips({ activePreset, onSelect }: PresetChipsProps) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label="Market presets"
    >
      {PRESETS.map((preset) => {
        const isActive = activePreset === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelect(preset)}
            aria-pressed={isActive}
            className={`
              px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200
              ${
                isActive
                  ? "bg-primary text-on-primary border-primary shadow-sm"
                  : "bg-surface text-on-surface-variant border-outline hover:border-primary hover:text-primary hover:bg-primary-container/30"
              }
            `}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
