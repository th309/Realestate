/**
 * Drill-Down Chips
 *
 * Shows active drill-down filters as removable M3 input chips.
 * Each chip has an X button. Includes a "Clear all" action.
 */

"use client";

import { X } from "lucide-react";

interface DrillDownChipsProps {
  filters: Record<string, string>;
  onRemove: (key: string) => void;
  onClearAll: () => void;
}

function formatChipLabel(key: string, value: string): string {
  const formattedKey = key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return `${formattedKey}: ${value}`;
}

export function DrillDownChips({
  filters,
  onRemove,
  onClearAll,
}: DrillDownChipsProps) {
  const entries = Object.entries(filters);

  if (entries.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mr-1">
        Drill-down
      </span>

      {entries.map(([key, value]) => (
        <span
          key={key}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm bg-tertiary-container text-on-tertiary-container border border-transparent"
        >
          {formatChipLabel(key, value)}
          <button
            onClick={() => onRemove(key)}
            aria-label={`Remove ${key} filter`}
            className="p-0.5 rounded-full hover:bg-on-tertiary-container/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </span>
      ))}

      {entries.length > 1 && (
        <button
          onClick={onClearAll}
          className="text-xs text-primary hover:underline font-medium ml-1"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
