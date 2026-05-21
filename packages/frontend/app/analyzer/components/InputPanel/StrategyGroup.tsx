"use client";
import type { ReactNode } from "react";

/**
 * Visible group for strategy-specific inputs. Header + chip make it explicit
 * that these fields belong to the current strategy and disappear if the user
 * switches strategies — no hunting in an expander.
 */
export function StrategyGroup({
  label,
  chip,
  children,
}: {
  label: string;
  chip: string;
  children: ReactNode;
}) {
  return (
    <div className="pt-3 border-t border-outline-variant">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider"
          style={{
            background: "var(--md-primary-container)",
            color: "var(--md-on-primary-container)",
          }}
        >
          {chip}
        </span>
        <span className="text-xs uppercase font-semibold text-on-surface-variant">
          {label}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}
