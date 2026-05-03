"use client";

interface Props {
  historic: number[]; // past 12 months
  forecast: number[]; // next 12 months (median projection)
  ciLow: number[]; // lower bound (same length as forecast)
  ciHigh: number[]; // upper bound (same length as forecast)
}

export function ForecastChart({ historic, forecast, ciLow, ciHigh }: Props) {
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
  const h = 140;
  const totalPts = Math.max(2, historic.length + forecast.length);
  const xAt = (i: number) => (i / (totalPts - 1)) * (w - 40) + 20;
  const yAt = (v: number) => h - 10 - ((v - min) / span) * (h - 30);

  const histPath = historic.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ");
  const fcPath = forecast
    .map((v, i) => `${xAt(historic.length + i)},${yAt(v)}`)
    .join(" ");

  // CI polygon: walk ciHigh forward, then ciLow backward (closes the band)
  const ciPolygon = [
    ...ciHigh.map((v, i) => `${xAt(historic.length + i)},${yAt(v)}`),
    ...ciLow.map((_, i) => {
      const idx = ciLow.length - 1 - i;
      return `${xAt(historic.length + idx)},${yAt(ciLow[idx])}`;
    }),
  ].join(" ");

  const nowX = xAt(Math.max(0, historic.length - 0.5));

  return (
    <div className="rounded-2xl bg-surface-container px-5 py-4">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="h-[140px] w-full"
      >
        {ciPolygon && (
          <polygon points={ciPolygon} fill="var(--md-primary)" opacity={0.15} />
        )}
        {histPath && (
          <polyline
            points={histPath}
            fill="none"
            stroke="var(--md-primary)"
            strokeWidth={2.5}
          />
        )}
        {fcPath && (
          <polyline
            points={fcPath}
            fill="none"
            stroke="var(--md-primary)"
            strokeWidth={2.5}
            strokeDasharray="5,4"
          />
        )}
        <line
          x1={nowX}
          x2={nowX}
          y1={0}
          y2={h}
          stroke="var(--md-warning)"
          strokeWidth={1}
          strokeDasharray="3,3"
        />
        <text
          x={nowX + 4}
          y={14}
          fill="var(--md-warning)"
          fontSize="10"
          fontFamily="Roboto Mono"
        >
          NOW
        </text>
      </svg>
    </div>
  );
}
