"use client";

export type TimeRangeKey =
  | "1h"
  | "24h"
  | "7d"
  | "30d"
  | "90d"
  | "6m"
  | "1y"
  | "custom";

interface TimeRangeOption {
  key: TimeRangeKey;
  label: string;
}

const TIME_RANGE_OPTIONS: TimeRangeOption[] = [
  { key: "1h", label: "1h" },
  { key: "24h", label: "24h" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
  { key: "6m", label: "6m" },
  { key: "1y", label: "1y" },
  { key: "custom", label: "Custom" },
];

interface TimeRangeSelectorProps {
  value: TimeRangeKey;
  onChange: (key: TimeRangeKey) => void;
}

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="flex items-center bg-surface-container rounded-full p-0.5 gap-0.5">
      {TIME_RANGE_OPTIONS.map((option) => {
        const isActive = option.key === value;
        return (
          <button
            key={option.key}
            onClick={() => onChange(option.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors duration-200 ${
              isActive
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
