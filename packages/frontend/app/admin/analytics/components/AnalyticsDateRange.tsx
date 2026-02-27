/**
 * Analytics Date Range Selector
 *
 * Row of preset day-range buttons (7d, 30d, 90d) plus a Custom option
 * that reveals date pickers. Uses M3 filter chip styling.
 */

"use client";

import { useState } from "react";

const PRESETS = [
  { label: "7d", value: 7 },
  { label: "30d", value: 30 },
  { label: "90d", value: 90 },
] as const;

interface AnalyticsDateRangeProps {
  days: number;
  onDaysChange: (days: number) => void;
  customRange: { start: string; end: string } | null;
  onCustomRangeChange: (range: { start: string; end: string } | null) => void;
}

export function AnalyticsDateRange({
  days,
  onDaysChange,
  customRange,
  onCustomRangeChange,
}: AnalyticsDateRangeProps) {
  const [showCustom, setShowCustom] = useState(customRange !== null);

  const handlePresetClick = (presetDays: number) => {
    setShowCustom(false);
    onCustomRangeChange(null);
    onDaysChange(presetDays);
  };

  const handleCustomToggle = () => {
    if (showCustom) {
      setShowCustom(false);
      onCustomRangeChange(null);
    } else {
      setShowCustom(true);
      const end = new Date().toISOString().slice(0, 10);
      const start = new Date(Date.now() - days * 86400000)
        .toISOString()
        .slice(0, 10);
      onCustomRangeChange({ start, end });
    }
  };

  const isPresetActive = (presetDays: number) =>
    !customRange && days === presetDays;

  return (
    <div className="flex items-center gap-2">
      {PRESETS.map(({ label, value }) => (
        <button
          key={value}
          onClick={() => handlePresetClick(value)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
            isPresetActive(value)
              ? "bg-secondary-container text-on-secondary-container border-transparent"
              : "bg-surface text-on-surface-variant border-outline-variant hover:bg-surface-container"
          }`}
        >
          {label}
        </button>
      ))}

      <button
        onClick={handleCustomToggle}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
          showCustom
            ? "bg-secondary-container text-on-secondary-container border-transparent"
            : "bg-surface text-on-surface-variant border-outline-variant hover:bg-surface-container"
        }`}
      >
        Custom
      </button>

      {showCustom && customRange && (
        <div className="flex items-center gap-2 ml-1">
          <input
            type="date"
            value={customRange.start}
            onChange={(e) =>
              onCustomRangeChange({ ...customRange, start: e.target.value })
            }
            className="px-2 py-1 rounded-lg text-sm border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary"
          />
          <span className="text-xs text-on-surface-variant">to</span>
          <input
            type="date"
            value={customRange.end}
            onChange={(e) =>
              onCustomRangeChange({ ...customRange, end: e.target.value })
            }
            className="px-2 py-1 rounded-lg text-sm border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary"
          />
        </div>
      )}
    </div>
  );
}
