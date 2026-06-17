"use client";

import { Section } from "./Section";
import { Gauge } from "../charts/Gauge";

interface Props {
  affordabilityIndex: number;
  affordabilityMeta: string;
  affordabilityMarker: number;
  priceToRent: number;
  priceToRentMeta: string;
  priceToRentMarker: number;
  hasPriceToRent: boolean;
  limitedData: boolean;
  num?: string;
}

export function Affordability(p: Props) {
  const num = p.num ?? "07";
  if (p.limitedData) {
    return (
      <Section num={num} title="Affordability snapshot">
        <p className="text-sm text-on-surface-variant">
          Affordability data unavailable.
        </p>
      </Section>
    );
  }
  return (
    <Section
      num={num}
      title="Affordability snapshot"
      subtitle="How affordable is this market for a typical buyer, and how does buying compare with renting?"
    >
      <div
        className={`grid grid-cols-1 gap-5 ${
          p.hasPriceToRent ? "md:grid-cols-2" : ""
        }`}
      >
        <Gauge
          title="Affordability index"
          value={String(p.affordabilityIndex)}
          meta={p.affordabilityMeta}
          markerPercent={p.affordabilityMarker}
          scale={["Unaffordable", "Stretched", "Affordable"]}
        />
        {p.hasPriceToRent && (
          <Gauge
            title="Price-to-rent ratio"
            value={`${p.priceToRent.toFixed(1)}×`}
            meta={p.priceToRentMeta}
            markerPercent={p.priceToRentMarker}
            scale={["Buy (<15)", "Balanced", "Rent (21+)"]}
          />
        )}
      </div>
    </Section>
  );
}
