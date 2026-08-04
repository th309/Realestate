"use client";
import { ReactNode } from "react";
import { Nudge, NudgeLevel } from "./Nudge";

interface NumFieldProps {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  step?: number;
  prefix?: string;
  suffix?: string;
  badge?: ReactNode;
  nudge?: { level: NudgeLevel; text: string } | null;
  placeholder?: string;
  ariaLabel?: string;
  /** Display value with thousands separators. Default true. */
  groupThousands?: boolean;
}

function formatDisplay(value: number | null, group: boolean): string {
  if (value == null) return "";
  if (!group) return String(value);
  if (Number.isInteger(value)) return value.toLocaleString("en-US");
  const [whole, decimal] = String(value).split(".");
  const wholeNum = Number(whole);
  return Number.isFinite(wholeNum)
    ? `${wholeNum.toLocaleString("en-US")}.${decimal}`
    : String(value);
}

export function NumField({
  label,
  value,
  onChange,
  step = 1,
  prefix,
  suffix,
  badge,
  nudge,
  placeholder,
  ariaLabel,
  groupThousands = true,
}: NumFieldProps) {
  return (
    <div data-num-field className="flex min-w-0 flex-col gap-1">
      {/* Label row holds only the label, per the mockup's `.fld .top`. The
          source badge sits below the input alongside the confidence rating
          (the mockup's `.conf` row) — sharing this row with the label made
          "Monthly Rent" truncate inside the 344px column's two-up cells. */}
      <div className="flex min-w-0 items-center gap-2">
        <label className="truncate text-[10px] font-bold uppercase tracking-[0.09em] text-on-surface-variant">
          {label}
        </label>
      </div>
      <div className="flex items-center rounded-lg border border-outline-variant bg-surface-container-low focus-within:border-primary">
        {prefix && (
          <span className="pl-3 text-on-surface-variant text-sm">{prefix}</span>
        )}
        <input
          type="text"
          inputMode={step >= 1 ? "numeric" : "decimal"}
          aria-label={ariaLabel ?? label}
          value={formatDisplay(value, groupThousands)}
          placeholder={placeholder}
          onChange={(e) => {
            const raw = e.currentTarget.value;
            const cleaned = raw.replace(/[^\d.-]/g, "");
            if (cleaned === "" || cleaned === "-" || cleaned === ".") {
              return onChange(null);
            }
            const n = Number(cleaned);
            if (Number.isFinite(n)) onChange(n);
          }}
          // min-w-0 is load-bearing: a bare <input> has a browser-intrinsic
          // width of ~20 characters, and a flex item defaults to
          // min-width:auto, so without this the field refuses to shrink into
          // the two-up grid's ~200px cell and overflows the panel.
          className="min-w-0 flex-1 bg-transparent px-3 py-2 font-mono text-sm text-on-surface focus:outline-none"
        />
        {suffix && (
          <span className="pr-3 text-on-surface-variant text-sm">{suffix}</span>
        )}
      </div>
      {badge}
      {nudge && <Nudge level={nudge.level} text={nudge.text} />}
    </div>
  );
}
