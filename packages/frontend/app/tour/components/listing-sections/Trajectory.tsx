"use client";

import { Section } from "./Section";
import { TrajectoryChart } from "../charts/TrajectoryChart";

interface Props {
  marketName: string;
  parentMetroName: string;
  stateName: string;
  marketSeries: number[];
  parentSeries: number[];
  stateSeries: number[];
  marketYoy: number;
  parentYoy: number;
  stateYoy: number;
  limitedData: boolean;
}

function formatYoy(yoy: number) {
  return `${yoy >= 0 ? "+" : ""}${yoy.toFixed(1)}%`;
}

export function Trajectory({
  marketName,
  parentMetroName,
  stateName,
  marketSeries,
  parentSeries,
  stateSeries,
  marketYoy,
  parentYoy,
  stateYoy,
  limitedData,
}: Props) {
  if (limitedData) {
    return (
      <Section num="03" title="12-month trajectory">
        <p className="text-sm text-on-surface-variant">
          Trajectory unavailable for this market.
        </p>
      </Section>
    );
  }

  return (
    <Section
      num="03"
      title="12-month trajectory"
      subtitle="How prices, demand, and supply have moved over the past year."
    >
      <p className="mb-3 text-[13px] font-semibold text-on-surface">
        Median home value · indexed (start = 100)
      </p>
      <TrajectoryChart
        series={[
          {
            label: `${marketName} (${formatYoy(marketYoy)})`,
            values: marketSeries,
            color: "var(--md-primary)",
          },
          {
            label: `${parentMetroName} (${formatYoy(parentYoy)})`,
            values: parentSeries,
            color: "var(--md-secondary)",
          },
          {
            label: `${stateName} (${formatYoy(stateYoy)})`,
            values: stateSeries,
            color: "var(--md-on-surface-variant)",
          },
        ]}
      />
    </Section>
  );
}
