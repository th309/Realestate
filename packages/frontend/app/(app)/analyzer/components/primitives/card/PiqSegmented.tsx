"use client";

import { LABEL_CLASS } from "./card-tones";

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
}

interface PiqSegmentedProps<T extends string | number> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Leading micro-label — "Sensitivity for", "View at". */
  label?: string;
  /** Stretch segments to fill the track. Off by default (content-width). */
  equalWidth?: boolean;
  ariaLabel: string;
}

/**
 * The spec's `.seg` — a recessed canvas track with the selected option raised
 * on a white chip in indigo.
 *
 * One control for every "pick one of these" row on the page. These were
 * written separately per section and had drifted into four different looks:
 * a solid indigo pill here, an outlined pill there, a range selector tinted
 * with whatever colour its chart's series happened to be. A selector is
 * chrome; it should look the same everywhere and never imply that one option
 * is "good" by borrowing a semantic colour.
 *
 * The raised-chip treatment also survives a narrow column better than filled
 * pills, which is what the two-up rows made obvious — four solid navy pills at
 * half width read as four separate buttons rather than one control.
 */
export function PiqSegmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  equalWidth = false,
  ariaLabel,
}: PiqSegmentedProps<T>) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {label && <span className={`${LABEL_CLASS} flex-none`}>{label}</span>}
      {/* The track wraps rather than clipping. Segments are named after the
          metric they select ("Monthly cash flow"), and at half width four of
          those don't fit on one line — truncating them to "Month…" / "Cash-…"
          makes the control unreadable, which is worse than a second row. */}
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex min-w-0 flex-1 flex-wrap gap-[3px] rounded-[9px] bg-piq-canvas p-[3px]"
      >
        {options.map((o) => {
          const isActive = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(o.value)}
              className={`whitespace-nowrap rounded-[7px] px-2.5 py-[7px] text-[12.5px] font-semibold transition-colors duration-200 ${
                equalWidth ? "flex-1" : ""
              } ${
                isActive
                  ? "bg-piq-surface text-piq-indigo shadow-piq"
                  : "bg-transparent text-piq-body hover:text-piq-ink"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
