"use client";

/**
 * TrajectoryChart — multi-series SVG line chart (Phase 04 Task 2).
 *
 * Auto-scales y-axis to the min/max across all series, draws three dashed
 * gridlines at 25/50/75% of height, and renders a legend below the chart.
 *
 * Color tokens: callers should pass M3 semantic colors as CSS-variable
 * strings (e.g. `var(--md-primary)`, `var(--md-tertiary)`), NOT raw hex
 * values. Gridlines use `var(--md-outline-variant)` from globals.css.
 */
interface Series {
  label: string;
  values: number[];
  color: string;
}

interface Props {
  series: Series[];
  height?: number;
}

export function TrajectoryChart({ series, height = 140 }: Props) {
  if (series.length === 0 || series[0].values.length === 0) {
    return (
      <p className="text-xs text-on-surface-variant">
        Limited data — chart unavailable.
      </p>
    );
  }

  const all = series.flatMap((s) => s.values);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = Math.max(1, max - min);
  const w = 800;

  const points = (s: Series) =>
    s.values
      .map((v, i) => {
        // For a single point, place it at the left edge to avoid divide-by-zero.
        const denom = s.values.length > 1 ? s.values.length - 1 : 1;
        const x = (i / denom) * (w - 40) + 20;
        const y = height - 10 - ((v - min) / span) * (height - 30);
        return `${x},${y}`;
      })
      .join(" ");

  return (
    <div className="rounded-2xl bg-surface-container px-6 py-5">
      <svg
        viewBox={`0 0 ${w} ${height}`}
        preserveAspectRatio="none"
        className="h-[140px] w-full"
      >
        {[0.25, 0.5, 0.75].map((g) => (
          <line
            key={g}
            x1={0}
            x2={w}
            y1={height * g}
            y2={height * g}
            stroke="var(--md-outline-variant)"
            strokeDasharray="3,3"
            strokeWidth={0.5}
          />
        ))}
        {series.map((s) => (
          <polyline
            key={s.label}
            points={points(s)}
            fill="none"
            stroke={s.color}
            strokeWidth={2.5}
          />
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-on-surface-variant">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: s.color }}
            />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
