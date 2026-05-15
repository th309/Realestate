"use client";
import { SectionWrapper } from "./SectionWrapper";
import { MultiLineChart } from "../charts/MultiLineChart";
import { BulletBarChart } from "../charts/BulletBarChart";
import { AIAnnotation } from "../ai/AIAnnotation";
import type { ProjectionResult } from "@propertyiq/analyzer-core";

interface ProjectionSectionProps {
  projection: ProjectionResult;
  aiText?: string | null;
  aiIsStale?: boolean;
  onRefreshAi?: () => void;
}

export function ProjectionSection({
  projection,
  aiText,
  aiIsStale,
  onRefreshAi,
}: ProjectionSectionProps) {
  const lineData = projection.yearly.map((y) => ({
    year: y.year,
    cumulativeEquity: y.cumulativeEquity,
    cumulativeCashflow: y.cumulativeCashflow,
  }));

  const horizonData = [
    { label: "Y1", value: projection.horizons.y1.irr },
    { label: "Y3", value: projection.horizons.y3.irr },
    { label: "Y5", value: projection.horizons.y5.irr },
    { label: "Y10", value: projection.horizons.y10.irr },
    { label: "Y20", value: projection.horizons.y20.irr },
    { label: "Y30", value: projection.horizons.y30.irr },
  ];

  return (
    <SectionWrapper
      id="projection"
      title="30-Year Wealth Projection"
      onRefresh={onRefreshAi}
      aiAnnotation={
        <AIAnnotation
          text={aiText}
          isStale={aiIsStale}
          onRefresh={onRefreshAi}
        />
      }
    >
      <MultiLineChart
        data={lineData}
        lines={[
          {
            dataKey: "cumulativeEquity",
            label: "Cumulative Equity",
            color: "primary",
          },
          {
            dataKey: "cumulativeCashflow",
            label: "Cumulative Cashflow",
            color: "positive",
          },
        ]}
      />
      <BulletBarChart
        data={horizonData}
        benchmarkZones={[
          { from: 0, to: 0.07, color: "negative" },
          { from: 0.07, to: 0.12, color: "caution" },
          { from: 0.12, to: 0.3, color: "positive" },
        ]}
      />
    </SectionWrapper>
  );
}
