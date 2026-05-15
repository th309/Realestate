"use client";
import { SectionWrapper } from "./SectionWrapper";
import { TornadoChart } from "../charts/TornadoChart";
import { ComposedSensitivityChart } from "../charts/ComposedSensitivityChart";
import { AIAnnotation } from "../ai/AIAnnotation";
import type { SensitivityResult } from "@propertyiq/analyzer-core";

interface SensitivitySectionProps {
  sensitivity: SensitivityResult;
  irrBandByYear: Array<{
    year: number;
    value: number;
    bandLow: number;
    bandHigh: number;
  }>;
  aiText?: string | null;
  aiIsStale?: boolean;
  onRefreshAi?: () => void;
}

export function SensitivitySection({
  sensitivity,
  irrBandByYear,
  aiText,
  aiIsStale,
  onRefreshAi,
}: SensitivitySectionProps) {
  return (
    <SectionWrapper
      id="sensitivity"
      title="Sensitivity & Confidence"
      onRefresh={onRefreshAi}
      aiAnnotation={
        <AIAnnotation
          text={aiText}
          isStale={aiIsStale}
          onRefresh={onRefreshAi}
        />
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TornadoChart
          factors={sensitivity.factors}
          baseIRR={sensitivity.baseIRR}
        />
        <ComposedSensitivityChart
          data={irrBandByYear}
          referenceLine={{ value: sensitivity.baseIRR, label: "Base IRR" }}
        />
      </div>
    </SectionWrapper>
  );
}
