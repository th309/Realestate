"use client";

import { Section } from "./Section";
import { TrajectoryChart } from "../charts/TrajectoryChart";

interface TrajectorySeries {
  label: string;
  /** values indexed so the first point = 100 */
  values: number[];
  /** % change across the window */
  yoy: number;
}

interface Props {
  series: TrajectorySeries[];
  limitedData: boolean;
  num?: string;
}

const SERIES_COLORS = [
  "var(--md-primary)",
  "var(--md-secondary)",
  "var(--md-on-surface-variant)",
];

function formatYoy(yoy: number) {
  return `${yoy >= 0 ? "+" : ""}${yoy.toFixed(1)}%`;
}

export function Trajectory({ series, limitedData, num = "03" }: Props) {
  if (limitedData || series.length === 0) {
    return (
      <Section num={num} title="12-month trajectory">
        <p className="text-sm text-on-surface-variant">
          Trajectory unavailable for this market.
        </p>
      </Section>
    );
  }

  return (
    <Section
      num={num}
      title="12-month trajectory"
      subtitle="How home values have moved over the past year, indexed against the market's broader benchmarks."
    >
      <p className="mb-3 text-[13px] font-semibold text-on-surface">
        Median home value · indexed (start = 100)
      </p>
      <TrajectoryChart
        series={series.map((s, i) => ({
          label: `${s.label} (${formatYoy(s.yoy)})`,
          values: s.values,
          color: SERIES_COLORS[i % SERIES_COLORS.length],
        }))}
      />
    </Section>
  );
}
