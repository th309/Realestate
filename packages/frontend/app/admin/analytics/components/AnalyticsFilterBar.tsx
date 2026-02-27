/**
 * Analytics Filter Bar
 *
 * Three dropdown filters: Tier, Device, Source.
 * Uses M3 filter chip pattern with outlined styling.
 */

"use client";

import { ChevronDown } from "lucide-react";
import type { AnalyticsFilters } from "@/lib/data/fetchers/admin-analytics.types";

interface FilterOption {
  label: string;
  value: string;
}

const TIER_OPTIONS: FilterOption[] = [
  { label: "All Tiers", value: "" },
  { label: "Anonymous", value: "anonymous" },
  { label: "Free", value: "free" },
  { label: "Pro", value: "pro" },
  { label: "Premium", value: "premium" },
];

const DEVICE_OPTIONS: FilterOption[] = [
  { label: "All Devices", value: "" },
  { label: "Desktop", value: "desktop" },
  { label: "Mobile", value: "mobile" },
  { label: "Tablet", value: "tablet" },
];

const SOURCE_OPTIONS: FilterOption[] = [
  { label: "All Sources", value: "" },
  { label: "Direct", value: "direct" },
  { label: "Organic", value: "organic" },
  { label: "UTM", value: "utm" },
  { label: "Email", value: "email" },
];

interface AnalyticsFilterBarProps {
  filters: AnalyticsFilters;
  onChange: (filters: AnalyticsFilters) => void;
}

function FilterChipSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const isActive = value !== "";

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={`appearance-none pl-3 pr-8 py-1.5 rounded-lg text-sm font-medium border cursor-pointer transition-colors focus:outline-none focus:border-primary ${
          isActive
            ? "bg-secondary-container text-on-secondary-container border-transparent"
            : "bg-surface text-on-surface-variant border-outline-variant hover:bg-surface-container"
        }`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-on-surface-variant" />
    </div>
  );
}

export function AnalyticsFilterBar({
  filters,
  onChange,
}: AnalyticsFilterBarProps) {
  const handleFilterChange = (key: keyof AnalyticsFilters, value: string) => {
    const updated = { ...filters };
    if (value === "") {
      delete updated[key];
    } else {
      updated[key] = value;
    }
    onChange(updated);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mr-1">
        Filters
      </span>
      <FilterChipSelect
        label="Tier filter"
        options={TIER_OPTIONS}
        value={filters.tier ?? ""}
        onChange={(v) => handleFilterChange("tier", v)}
      />
      <FilterChipSelect
        label="Device filter"
        options={DEVICE_OPTIONS}
        value={filters.device ?? ""}
        onChange={(v) => handleFilterChange("device", v)}
      />
      <FilterChipSelect
        label="Source filter"
        options={SOURCE_OPTIONS}
        value={filters.source ?? ""}
        onChange={(v) => handleFilterChange("source", v)}
      />
    </div>
  );
}
