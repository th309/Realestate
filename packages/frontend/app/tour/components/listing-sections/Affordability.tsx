"use client";

import { Section } from "./Section";
import { Gauge } from "../charts/Gauge";

interface Props {
  affordabilityIndex: number;
  affordabilityMeta: string;
  affordabilityMarker: number;
  rentVsBuyYears: number;
  rentVsBuyMeta: string;
  rentVsBuyMarker: number;
  limitedData: boolean;
}

export function Affordability(p: Props) {
  if (p.limitedData) {
    return (
      <Section num="07" title="Affordability snapshot">
        <p className="text-sm text-on-surface-variant">
          Affordability data unavailable.
        </p>
      </Section>
    );
  }
  return (
    <Section
      num="07"
      title="Affordability snapshot"
      subtitle="How affordable is this market for the typical buyer at today's rates?"
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Gauge
          title="Affordability index"
          value={String(p.affordabilityIndex)}
          meta={p.affordabilityMeta}
          markerPercent={p.affordabilityMarker}
          scale={["Unaffordable", "Stretched", "Affordable"]}
        />
        <Gauge
          title="Rent-vs-buy break-even"
          value={`${p.rentVsBuyYears.toFixed(1)} yrs`}
          meta={p.rentVsBuyMeta}
          markerPercent={p.rentVsBuyMarker}
          scale={["2 yrs", "5 yrs", "10+ yrs"]}
        />
      </div>
    </Section>
  );
}
