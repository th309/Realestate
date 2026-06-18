"use client";

import React from "react";
import type { MoverWindow } from "@/lib/data";
import { MOVER_WINDOWS, WINDOW_META } from "../lib/score-change";

interface WindowSelectorProps {
  value: MoverWindow;
  onChange: (window: MoverWindow) => void;
}

export function WindowSelector({ value, onChange }: WindowSelectorProps) {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border border-outline bg-surface p-1"
      role="radiogroup"
      aria-label="Score change window"
    >
      <span className="px-2 text-xs font-medium text-on-surface-variant select-none">
        Δ
      </span>
      {MOVER_WINDOWS.map((w) => {
        const isActive = value === w;
        return (
          <button
            key={w}
            type="button"
            role="radio"
            aria-checked={isActive}
            title={WINDOW_META[w].tooltip}
            onClick={() => onChange(w)}
            className={`
              px-3 py-1 rounded-full text-sm font-medium transition-all duration-200
              ${
                isActive
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:text-primary hover:bg-primary-container/30"
              }
            `}
          >
            {WINDOW_META[w].label}
          </button>
        );
      })}
    </div>
  );
}
