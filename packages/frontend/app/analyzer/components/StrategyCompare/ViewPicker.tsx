"use client";
import { useState, useEffect } from "react";

export type StrategyView = "grid3" | "tabs" | "winner";

const OPTIONS: Array<{ value: StrategyView; label: string }> = [
  { value: "grid3", label: "3-up grid" },
  { value: "tabs", label: "Single tab" },
  { value: "winner", label: "Winner + others" },
];

const STORAGE_KEY = "analyzer.strategyView";

interface ViewPickerProps {
  value?: StrategyView;
  onChange?: (v: StrategyView) => void;
}

export function ViewPicker({ value, onChange }: ViewPickerProps) {
  const [internal, setInternal] = useState<StrategyView>(() => {
    if (typeof window === "undefined") return "grid3";
    return (
      (localStorage.getItem(STORAGE_KEY) as StrategyView | null) ?? "grid3"
    );
  });
  const current = value ?? internal;

  useEffect(() => {
    if (typeof window !== "undefined")
      localStorage.setItem(STORAGE_KEY, current);
  }, [current]);

  return (
    <div
      data-view-picker
      className="inline-flex rounded-full bg-surface-container-low p-1"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          data-view-option={opt.value}
          onClick={() => {
            setInternal(opt.value);
            onChange?.(opt.value);
          }}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
            current === opt.value
              ? "bg-primary text-on-primary"
              : "text-on-surface-variant hover:bg-surface-container"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
