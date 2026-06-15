"use client";

import React from "react";
import { US_STATES } from "@/app/map/types";

interface StateSelectProps {
  value: string; // "" = all states
  onChange: (value: string) => void;
}

/**
 * M3 state filter for the screener. Empty value = all states. Mirrors the
 * Top Markets state select (US_STATES from @/app/map/types) but styled to match
 * the screener's rounded-full control row.
 */
export function StateSelect({ value, onChange }: StateSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Filter by state"
      className="
        px-4 py-2 text-sm rounded-full cursor-pointer
        border border-outline bg-surface-container-lowest text-on-surface
        focus:outline-none focus:ring-2 focus:ring-primary/40
        hover:border-primary transition-colors
      "
    >
      <option value="">All states</option>
      {US_STATES.map((s) => (
        <option key={s.abbrev} value={s.abbrev}>
          {s.abbrev}
        </option>
      ))}
    </select>
  );
}
