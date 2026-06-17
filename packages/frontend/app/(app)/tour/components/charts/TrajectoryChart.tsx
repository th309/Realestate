"use client";

import { useId } from "react";

/**
 * TrajectoryChart — multi-series indexed line chart with a gradient area fill
 * under the lead series, end-point markers, and a legend. Pure SVG.
 *
 * Color tokens: callers pass M3 semantic colors as CSS-variable strings
 * (e.g. `var(--md-primary)`), NOT raw hex. Gridlines use `--md-outline-variant`.
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

export function TrajectoryChart({ series, height = 170 }: Props) {
  const rawId = useId();
  const gradId = `traj-${rawId.replace(/:/g, "")}`;

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
  const padX = 22;
  const padTop = 18;
  const padBot = 16;
  const baseline = height - padBot;

  const coords = (s: Series) =>
    s.values.map((v, i) => {
      const denom = s.values.length > 1 ? s.values.length - 1 : 1;
      const x = (i / denom) * (w - padX * 2) + padX;
      const y =
        height - padBot - ((v - min) / span) * (height - padTop - padBot);
      return { x, y };
    });

  const lead = coords(series[0]);
  const areaPath =
    `M${lead[0].x.toFixed(1)},${baseline} ` +
    lead.map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") +
    ` L${lead[lead.length - 1].x.toFixed(1)},${baseline} Z`;

  return (
    <div className="rounded-2xl border border-outline-variant/40 bg-surface-container px-6 py-5 shadow-sm">
      <svg
        viewBox={`0 0 ${w} ${height}`}
        preserveAspectRatio="none"
        className="h-[170px] w-full"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={series[0].color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={series[0].color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => (
          <line
            key={g}
            x1={0}
            x2={w}
            y1={height * g}
            y2={height * g}
            stroke="var(--md-outline-variant)"
            strokeDasharray="2,5"
            strokeWidth={0.75}
          />
        ))}
        <path d={areaPath} fill={`url(#${gradId})`} />
        {series.map((s, idx) => {
          const pts = coords(s);
          const isLead = idx === 0;
          const last = pts[pts.length - 1];
          return (
            <g key={s.label}>
              <polyline
                points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke={s.color}
                strokeWidth={isLead ? 3 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                opacity={isLead ? 1 : 0.65}
              />
              <circle
                cx={last.x}
                cy={last.y}
                r={isLead ? 4 : 3}
                fill={s.color}
                stroke="var(--md-surface-container)"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}
      </svg>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-on-surface-variant">
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
