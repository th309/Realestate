"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ScreenerQuery } from "@/lib/data";

type FilterKey =
  | "scoreMin"
  | "scoreMax"
  | "medianPriceMin"
  | "medianPriceMax"
  | "capRateMin"
  | "capRateMax"
  | "monthsOfSupplyMin"
  | "monthsOfSupplyMax"
  | "overvaluedMin"
  | "overvaluedMax";

interface FilterField {
  label: string;
  minKey: FilterKey;
  maxKey: FilterKey;
  minPlaceholder: string;
  maxPlaceholder: string;
  step?: number;
  hint?: string;
}

const FILTER_FIELDS: FilterField[] = [
  {
    label: "PIQ Score",
    minKey: "scoreMin",
    maxKey: "scoreMax",
    minPlaceholder: "0",
    maxPlaceholder: "99",
    step: 1,
    hint: "0 – 99",
  },
  {
    label: "Median Price",
    minKey: "medianPriceMin",
    maxKey: "medianPriceMax",
    minPlaceholder: "100,000",
    maxPlaceholder: "2,000,000",
    step: 10000,
    hint: "$",
  },
  {
    label: "Cap Rate",
    minKey: "capRateMin",
    maxKey: "capRateMax",
    minPlaceholder: "0",
    maxPlaceholder: "20",
    step: 0.5,
    hint: "%",
  },
  {
    label: "Months of Supply",
    minKey: "monthsOfSupplyMin",
    maxKey: "monthsOfSupplyMax",
    minPlaceholder: "0",
    maxPlaceholder: "12",
    step: 0.5,
    hint: "mo",
  },
  {
    label: "Overvalued %",
    minKey: "overvaluedMin",
    maxKey: "overvaluedMax",
    minPlaceholder: "-50",
    maxPlaceholder: "100",
    step: 1,
    hint: "%",
  },
];

interface FilterRailProps {
  filters: Partial<ScreenerQuery>;
  onChange: (patch: Partial<ScreenerQuery>) => void;
  onReset: () => void;
}

function parseNumeric(raw: string): number | undefined {
  const n = parseFloat(raw);
  return isNaN(n) ? undefined : n;
}

export function FilterRail({ filters, onChange, onReset }: FilterRailProps) {
  const [expanded, setExpanded] = useState(false);

  const activeCount = FILTER_FIELDS.reduce((n, f) => {
    const hasMin = filters[f.minKey] !== undefined;
    const hasMax = filters[f.maxKey] !== undefined;
    return n + (hasMin || hasMax ? 1 : 0);
  }, 0);

  return (
    <div className="bg-surface-container-low rounded-xl border border-outline-variant shadow-sm overflow-hidden">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-surface-container transition-colors"
        aria-expanded={expanded}
      >
        <span className="text-sm font-medium text-on-surface flex items-center gap-2">
          Filters
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-on-primary text-xs font-bold">
              {activeCount}
            </span>
          )}
        </span>
        <span className="text-on-surface-variant">
          {expanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </span>
      </button>

      {/* Filter fields */}
      {expanded && (
        <div className="px-5 pb-5 pt-2 border-t border-outline-variant">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mt-3">
            {FILTER_FIELDS.map((field) => (
              <div key={field.label} className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-on-surface-variant">
                  {field.label}
                  {field.hint && (
                    <span className="ml-1 text-on-surface-variant/60">
                      ({field.hint})
                    </span>
                  )}
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step={field.step}
                    placeholder={field.minPlaceholder}
                    value={
                      filters[field.minKey] !== undefined
                        ? String(filters[field.minKey])
                        : ""
                    }
                    onChange={(e) =>
                      onChange({ [field.minKey]: parseNumeric(e.target.value) })
                    }
                    aria-label={`${field.label} minimum`}
                    className="
                      w-full min-w-0 px-2.5 py-1.5 text-sm rounded-lg border border-outline-variant
                      bg-surface text-on-surface placeholder:text-on-surface-variant/50
                      focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary
                      font-[family-name:var(--font-roboto-mono)]
                    "
                  />
                  <span className="text-on-surface-variant text-xs flex-shrink-0">
                    –
                  </span>
                  <input
                    type="number"
                    step={field.step}
                    placeholder={field.maxPlaceholder}
                    value={
                      filters[field.maxKey] !== undefined
                        ? String(filters[field.maxKey])
                        : ""
                    }
                    onChange={(e) =>
                      onChange({ [field.maxKey]: parseNumeric(e.target.value) })
                    }
                    aria-label={`${field.label} maximum`}
                    className="
                      w-full min-w-0 px-2.5 py-1.5 text-sm rounded-lg border border-outline-variant
                      bg-surface text-on-surface placeholder:text-on-surface-variant/50
                      focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary
                      font-[family-name:var(--font-roboto-mono)]
                    "
                  />
                </div>
              </div>
            ))}
          </div>

          {activeCount > 0 && (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onReset}
                className="text-xs text-on-surface-variant hover:text-primary underline underline-offset-2 transition-colors"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
