"use client";

interface SliderFieldProps {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}

export function SliderField({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  format = (v) => String(v),
}: SliderFieldProps) {
  return (
    <div data-slider-field className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-xs uppercase font-semibold text-on-surface-variant">
          {label}
        </label>
        <span data-slider-readout className="font-mono text-sm text-on-surface">
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
        className="w-full accent-[var(--md-primary)]"
      />
    </div>
  );
}
