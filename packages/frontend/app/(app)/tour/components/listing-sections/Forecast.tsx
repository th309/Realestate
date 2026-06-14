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
  projectedRent: string;
  projectedRentChange: string;
  riskFactor: string;
  limitedData: boolean;
}

export function Forecast(p: Props) {
  if (p.limitedData) {
    return (
      <Section num="04" title="Forward forecast">
        <p className="text-sm text-on-surface-variant">Forecast unavailable.</p>
      </Section>
    );
  }

  return (
    <Section
      num="04"
      title="Forward forecast · next 6-12 months"
      subtitle="PropertyIQ's modeled outlook with 80% confidence interval."
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[2fr_1fr]">
        <ForecastChart
          historic={p.historic}
          forecast={p.forecast}
          ciLow={p.ciLow}
          ciHigh={p.ciHigh}
        />
        <div className="space-y-3">
          <ForecastCard
            label="12-month projected price"
            value={p.projectedPrice}
            meta={p.projectedRange}
          />
          <ForecastCard
            label="12-month projected rent"
            value={p.projectedRent}
            meta={p.projectedRentChange}
          />
          <ForecastCard
            label="Risk factor"
            value="Mortgage rates"
            meta={p.riskFactor}
            risk
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
  risk,
}: {
  label: string;
  value: string;
  meta: string;
  risk?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-surface-container-lowest p-4 ${
        risk
          ? "border-l-4 border-l-warning border-outline-variant"
          : "border-outline-variant"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
        {label}
      </p>
      <p className="mt-1 font-mono text-base font-semibold text-on-surface">
        {value}
      </p>
      <p className="mt-0.5 text-[11.5px] text-on-surface-variant">{meta}</p>
    </div>
  );
}
