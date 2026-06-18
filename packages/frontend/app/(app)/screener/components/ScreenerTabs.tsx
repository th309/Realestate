"use client";

import React from "react";
import type { ScreenerTab } from "../lib/screener-url-state";

interface ScreenerTabsProps {
  tab: ScreenerTab;
  onChange: (tab: ScreenerTab) => void;
}

const TABS: { id: ScreenerTab; label: string }[] = [
  { id: "screener", label: "Screener" },
  { id: "movers", label: "Movers" },
];

export function ScreenerTabs({ tab, onChange }: ScreenerTabsProps) {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-full bg-surface-container p-1"
      role="tablist"
      aria-label="Screener view"
    >
      {TABS.map((t) => {
        const isActive = tab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={`
              px-5 py-2 rounded-full text-sm font-medium transition-all duration-200
              ${
                isActive
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:text-primary"
              }
            `}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
