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
}: NumFieldProps) {
  return (
    <div data-num-field className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-xs uppercase font-semibold text-on-surface-variant">
          {label}
        </label>
        {badge}
      </div>
      <div className="flex items-center rounded-lg border border-outline-variant bg-surface-container-low focus-within:border-primary">
        {prefix && (
          <span className="pl-3 text-on-surface-variant text-sm">{prefix}</span>
        )}
        <input
          type="number"
          inputMode={step >= 1 ? "numeric" : "decimal"}
          step={step}
          aria-label={ariaLabel ?? label}
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(e) => {
            const raw = e.currentTarget.value;
            if (raw === "") return onChange(null);
            const n = Number(raw);
            if (Number.isFinite(n)) onChange(n);
          }}
          className="flex-1 bg-transparent px-3 py-2 font-mono text-sm text-on-surface focus:outline-none"
        />
        {suffix && (
          <span className="pr-3 text-on-surface-variant text-sm">{suffix}</span>
        )}
      </div>
      {nudge && <Nudge level={nudge.level} text={nudge.text} />}
    </div>
  );
}
