"use client";

import { Section } from "./Section";
import { ForecastChart } from "../charts/ForecastChart";

interface Props {
  historic: number[];
  forecast: number[];
  ciLow: number[];
  ciHigh: number[];
  projectedPrice: string;
  projectedRange: string;
  projectedChange: string;
  limitedData: boolean;
  num?: string;
}

export function Forecast(p: Props) {
  const num = p.num ?? "04";
  if (p.limitedData) {
    return (
      <Section num={num} title="Forward forecast">
        <p className="text-sm text-on-surface-variant">
          Forecast unavailable for this market.
        </p>
      </Section>
    );
  }

  return (
    <Section
      num={num}
      tone="feature"
      title="Forward forecast · next 12 months"
      subtitle="Zillow's home-value forecast with a modeled 80% interval derived from this market's own historical volatility."
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[2fr_1fr]">
        <ForecastChart
          historic={p.historic}
          forecast={p.forecast}
          ciLow={p.ciLow}
          ciHigh={p.ciHigh}
          endpointLabel={p.projectedPrice}
        />
        <div className="space-y-3">
          <ForecastCard
            label="12-month projected price"
            value={p.projectedPrice}
            meta={p.projectedRange}
          />
          <ForecastCard
            label="Projected change"
            value={p.projectedChange}
            meta="Zillow home-value forecast"
          />
        </div>
      </div>
    </Section>
  );
}

function ForecastCard({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
        {label}
      </p>
      <p className="mt-1 font-mono text-lg font-semibold text-on-surface">
        {value}
      </p>
      <p className="mt-0.5 text-[11.5px] text-on-surface-variant">{meta}</p>
    </div>
  );
}
