"use client";

import { SlidersHorizontal, X } from "lucide-react";
import type { ScreenerQuery, MoverWindow } from "@/lib/data";
import { WINDOW_META } from "../lib/score-change";
import { PresetChips, type Preset, type PresetId } from "./PresetChips";

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
  | "overvaluedMax"
  | "changeMin"
  | "changeMax";

interface FilterField {
  label: string;
  minKey: FilterKey;
  maxKey: FilterKey;
  minPlaceholder: string;
  maxPlaceholder: string;
  step?: number;
  /** Unit, shown beside the label in mono — the mockup's `.flab span`. */
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

interface ScreenerFiltersProps {
  filters: Partial<ScreenerQuery>;
  changeWindow?: MoverWindow;
  onChange: (patch: Partial<ScreenerQuery>) => void;
  onReset: () => void;
  activePreset: PresetId | null;
  onPresetSelect: (preset: Preset) => void;
  /** Human-readable summary of what is currently narrowing the result set. */
  activeFilters?: string[];
}

function parseNumeric(raw: string): number | undefined {
  const n = parseFloat(raw);
  return isNaN(n) ? undefined : n;
}

/**
 * The screener's filter card — a full-width panel above the results, not a
 * side rail. Per the mockup: card header with a live count, the quick-screen
 * presets, then a six-up grid of min/max ranges that steps down to three and
 * two. Every field stays visible; there is no collapse, because a filter you
 * cannot see is a filter you forget is applied.
 */
export function ScreenerFilters({
  filters,
  changeWindow = "3m",
  onChange,
  onReset,
  activePreset,
  onPresetSelect,
  activeFilters = [],
}: ScreenerFiltersProps) {
  const fields: FilterField[] = [
    ...FILTER_FIELDS,
    {
      label: `Score Δ (${WINDOW_META[changeWindow].label})`,
      minKey: "changeMin",
      maxKey: "changeMax",
      minPlaceholder: "-20",
      maxPlaceholder: "20",
      step: 1,
      hint: "pts",
    },
  ];

  const activeCount = fields.reduce((n, f) => {
    const hasMin = filters[f.minKey] !== undefined;
    const hasMax = filters[f.maxKey] !== undefined;
    return n + (hasMin || hasMax ? 1 : 0);
  }, 0);

  // A field carrying a value is tinted so an applied filter is visible at a
  // glance rather than only discoverable by reading every box.
  const inputClass = (key: FilterKey) =>
    // px-2/11px, not px-2.5/12px: at six-up the widest placeholder
    // ("2,000,000") clipped a digit inside its ~95px box.
    `w-full min-w-0 rounded-lg border px-2 py-1.5 text-right font-mono text-[11px] tabular-nums
     focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary ${
       filters[key] !== undefined
         ? "border-primary bg-primary-container font-bold text-on-primary-container"
         : "border-outline-variant bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/50"
     }`;

  return (
    <section
      data-screener-filters
      className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-outline-variant px-4 py-3.5">
        <span
          aria-hidden
          className="grid size-6 place-items-center rounded-md bg-primary-container text-on-primary-container"
        >
          <SlidersHorizontal className="size-3.5" />
        </span>
        <h2 className="text-sm font-bold text-on-surface">Filters</h2>
        {activeCount > 0 && (
          <span
            aria-label={`${activeCount} active filter groups`}
            className="grid h-[17px] min-w-[17px] place-items-center rounded-full bg-primary px-1.5 font-mono text-[10px] font-bold text-on-primary"
          >
            {activeCount}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-dashed border-outline-variant px-4 py-3.5">
        <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.11em] text-on-surface-variant">
          Quick screens
        </span>
        <PresetChips activePreset={activePreset} onSelect={onPresetSelect} />
      </div>

      {/* Six-up above 1240px, three-up down to 720px, two-up below — the
          mockup's `.fgrid` breakpoints. */}
      <div className="grid grid-cols-2 gap-3.5 p-4 min-[721px]:grid-cols-3 min-[1241px]:grid-cols-6 [&>*]:min-w-0">
        {fields.map((field) => (
          <div key={field.label} className="flex min-w-0 flex-col gap-1.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[11px] font-bold text-on-surface">
                {field.label}
              </span>
              {field.hint && (
                <span className="font-mono text-[10px] text-on-surface-variant">
                  {field.hint}
                </span>
              )}
            </div>
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
                className={inputClass(field.minKey)}
              />
              <span className="flex-shrink-0 font-mono text-xs text-on-surface-variant">
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
                className={inputClass(field.maxKey)}
              />
            </div>
          </div>
        ))}
      </div>

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2.5 px-4 pb-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.11em] text-on-surface-variant">
            Active
          </span>
          {activeFilters.map((label) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary-container px-2.5 py-1 text-[11px] font-bold text-on-primary-container"
            >
              {label}
            </span>
          ))}
          <button
            type="button"
            onClick={onReset}
            className="ml-auto text-xs font-semibold text-primary underline underline-offset-[3px] transition-colors hover:text-primary/80"
          >
            <span className="inline-flex items-center gap-1">
              <X className="size-3" />
              Clear all filters
            </span>
          </button>
        </div>
      )}
    </section>
  );
}
