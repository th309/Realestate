"use client";

interface Bar {
  label: string;
  value: number;
  max: number;
  suffix?: string;
}

interface Props {
  rows: Bar[];
}

export function EmploymentBars({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p className="text-xs text-on-surface-variant">
        Sector data unavailable for this market.
      </p>
    );
  }
  return (
    <div className="space-y-1.5">
      {rows.map((r) => {
        const pct = Math.max(0, Math.min(100, (r.value / r.max) * 100));
        return (
          <div key={r.label} className="flex items-center gap-2.5 text-xs">
            <span className="w-24 truncate text-on-surface-variant">
              {r.label}
            </span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-primary-container">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-primary to-on-primary-container"
                style={{ width: `${pct}%` }}
              />
            </span>
            <span className="w-12 text-right font-mono font-medium text-on-surface">
              {r.value}
              {r.suffix ?? "%"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
