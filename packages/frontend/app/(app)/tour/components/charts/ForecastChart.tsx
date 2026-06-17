"use client";

import { useId } from "react";

interface Props {
  historic: number[]; // past 12 months
  forecast: number[]; // next 12 months (median projection)
  ciLow: number[]; // lower bound (same length as forecast)
  ciHigh: number[]; // upper bound (same length as forecast)
  /** Optional crisp end-of-forecast value label (e.g. "$466K"). */
  endpointLabel?: string;
}

export function ForecastChart({
  historic,
  forecast,
  ciLow,
  ciHigh,
  endpointLabel,
}: Props) {
  const rawId = useId();
  const coneId = `cone-${rawId.replace(/:/g, "")}`;

  if (historic.length === 0 && forecast.length === 0) {
    return (
      <p className="text-xs text-on-surface-variant">Forecast unavailable.</p>
    );
  }

  const all = [...historic, ...forecast, ...ciLow, ...ciHigh];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = Math.max(1, max - min);
  const w = 800;
  const h = 170;
  const padTop = 16;
  const padBot = 14;
  const totalPts = Math.max(2, historic.length + forecast.length);
  const xAt = (i: number) => (i / (totalPts - 1)) * (w - 40) + 20;
  const yAt = (v: number) =>
    h - padBot - ((v - min) / span) * (h - padTop - padBot);

  const histPath = historic.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ");
  const fcPath = forecast
    .map((v, i) => `${xAt(historic.length + i)},${yAt(v)}`)
    .join(" ");

  // CI polygon: walk ciHigh forward, then ciLow backward (closes the band).
  const ciPolygon = [
    ...ciHigh.map((v, i) => `${xAt(historic.length + i)},${yAt(v)}`),
    ...ciLow.map((_, i) => {
      const idx = ciLow.length - 1 - i;
      return `${xAt(historic.length + idx)},${yAt(ciLow[idx])}`;
    }),
  ].join(" ");

  const nowX = xAt(Math.max(0, historic.length - 0.5));
  const nowPct = (nowX / w) * 100;

  const lastFc = forecast.length > 0 ? forecast[forecast.length - 1] : null;
  const endX = xAt(totalPts - 1);
  const endY = lastFc != null ? yAt(lastFc) : 0;

  return (
    <div className="relative rounded-2xl border border-outline-variant/40 bg-surface-container px-5 py-4 shadow-sm">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="h-[170px] w-full"
      >
        <defs>
          <linearGradient id={coneId} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--md-primary)"
              stopOpacity="0.28"
            />
            <stop
              offset="100%"
              stopColor="var(--md-primary)"
              stopOpacity="0.06"
            />
          </linearGradient>
        </defs>
        {/* faint shading over the forecast (future) region */}
        <rect
          x={nowX}
          y={0}
          width={w - nowX}
          height={h}
          fill="var(--md-primary)"
          opacity={0.04}
        />
        {ciPolygon && <polygon points={ciPolygon} fill={`url(#${coneId})`} />}
        {histPath && (
          <polyline
            points={histPath}
            fill="none"
            stroke="var(--md-primary)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {fcPath && (
          <polyline
            points={fcPath}
            fill="none"
            stroke="var(--md-primary)"
            strokeWidth={3}
            strokeDasharray="6,5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <line
          x1={nowX}
          x2={nowX}
          y1={0}
          y2={h}
          stroke="var(--md-warning)"
          strokeWidth={1.25}
          strokeDasharray="3,3"
          vectorEffect="non-scaling-stroke"
        />
        {lastFc != null && (
          <circle
            cx={endX}
            cy={endY}
            r={4.5}
            fill="var(--md-primary)"
            stroke="var(--md-surface-container)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      {/* Crisp HTML overlays (SVG text would stretch with preserveAspectRatio=none) */}
      <span
        className="pointer-events-none absolute top-3 -translate-x-1/2 rounded-full bg-warning/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-on-warning-container"
        style={{ left: `${nowPct}%` }}
      >
        NOW
      </span>
      {endpointLabel && lastFc != null && (
        <span className="pointer-events-none absolute right-3 top-3 rounded-md bg-primary px-2 py-0.5 font-mono text-[11px] font-semibold text-on-primary">
          {endpointLabel}
        </span>
      )}
    </div>
  );
}
