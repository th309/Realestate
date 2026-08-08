"use client";

import type { ReactNode } from "react";
import { Coins, Flame, Tag, TrendingDown, TrendingUp } from "lucide-react";
import type { ScreenerQuery } from "@/lib/data";
import { Chip } from "@/app/components/marketing";

export type PresetId =
  | "hottest"
  | "undervalued"
  | "cashflow"
  | "gainers"
  | "losers";

export interface Preset {
  id: PresetId;
  label: string;
  query: Partial<ScreenerQuery>;
  /** Sort key depends on the active window — resolved by the page, not here. */
  windowSorted?: "desc" | "asc";
}

/** Per-preset icon, matching the mockup's coloured `.ct` tile in each chip. */
const PRESET_ICON: Record<PresetId, ReactNode> = {
  hottest: <Flame className="size-3.5" />,
  undervalued: <Tag className="size-3.5" />,
  cashflow: <Coins className="size-3.5" />,
  gainers: <TrendingUp className="size-3.5" />,
  losers: <TrendingDown className="size-3.5" />,
};

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
  {
    id: "gainers",
    label: "Biggest Gainers",
    query: {},
    windowSorted: "desc",
  },
  {
    id: "losers",
    label: "Biggest Losers",
    query: {},
    windowSorted: "asc",
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
          // The shared Chip is presentational, so the button wraps it and
          // carries the semantics (aria-pressed) and the focus ring.
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelect(preset)}
            aria-pressed={isActive}
            className="rounded-full transition-transform duration-200 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Chip
              tone={isActive ? "primary" : "neutral"}
              icon={PRESET_ICON[preset.id]}
            >
              {preset.label}
            </Chip>
          </button>
        );
      })}
    </div>
  );
}
