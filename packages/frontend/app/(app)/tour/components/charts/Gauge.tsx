"use client";

interface Props {
  title: string;
  value: string;
  meta: string;
  markerPercent: number;
  scale: [string, string, string];
}

export function Gauge({ title, value, meta, markerPercent, scale }: Props) {
  const left = `${Math.max(0, Math.min(100, markerPercent))}%`;
  return (
    <div className="rounded-2xl bg-surface-container p-5 text-center">
      <p className="text-sm font-semibold text-on-surface">{title}</p>
      <p className="mt-3 font-mono text-[38px] font-semibold text-on-primary-container">
        {value}
      </p>
      <p className="text-xs text-on-surface-variant">{meta}</p>
      <div
        className="relative my-4 h-3 rounded-full"
        style={{
          background:
            "linear-gradient(to right, var(--md-error), var(--md-warning), var(--md-tertiary))",
        }}
      >
        <span
          className="absolute -top-1 h-5 w-1 -translate-x-1/2 rounded-sm bg-on-surface"
          style={{ left }}
          aria-hidden="true"
        />
      </div>
      <div className="flex justify-between text-[10px] text-on-surface-variant">
        <span>{scale[0]}</span>
        <span>{scale[1]}</span>
        <span>{scale[2]}</span>
      </div>
    </div>
  );
}
