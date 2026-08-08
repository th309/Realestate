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
  // Drives the filled portion of the track — WebKit can't paint a lower track
  // on its own, so the fill comes from a gradient stop at this position.
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;

  return (
    <div data-slider-field className="flex flex-col gap-[7px]">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[10px] font-bold uppercase tracking-[0.11em] text-piq-muted">
          {label}
        </label>
        <span
          data-slider-readout
          className="font-mono text-[13px] font-semibold tabular-nums text-piq-ink"
        >
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
        className="piq-range"
        style={{ "--piq-range-pct": `${pct}%` } as React.CSSProperties}
      />
    </div>
  );
}
