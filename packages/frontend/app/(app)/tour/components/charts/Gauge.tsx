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
    <div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-5 text-center shadow-sm">
      <p className="text-sm font-semibold text-on-surface">{title}</p>
      <p className="mt-3 font-mono text-[40px] font-semibold leading-none text-on-primary-container">
        {value}
      </p>
      <p className="mt-1 text-xs text-on-surface-variant">{meta}</p>
      <div className="relative mb-5 mt-6">
        {/* pointer marker riding the track */}
        <span
          className="absolute -top-3 z-10 -translate-x-1/2"
          style={{ left }}
          aria-hidden="true"
        >
          <span className="block h-2.5 w-2.5 rotate-45 rounded-[2px] border-2 border-surface-container bg-on-surface shadow-sm" />
        </span>
        <div
          className="h-3.5 rounded-full shadow-inner"
          style={{
            background:
              "linear-gradient(to right, var(--md-error), var(--md-warning), var(--md-tertiary))",
          }}
        />
        <span
          className="absolute top-0 h-3.5 w-0.5 -translate-x-1/2 bg-on-surface/80"
          style={{ left }}
          aria-hidden="true"
        />
      </div>
      <div className="flex justify-between text-[10px] font-medium text-on-surface-variant">
        <span>{scale[0]}</span>
        <span>{scale[1]}</span>
        <span>{scale[2]}</span>
      </div>
    </div>
  );
}
