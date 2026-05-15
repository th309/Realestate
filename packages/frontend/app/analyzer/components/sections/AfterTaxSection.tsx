"use client";
import { SectionWrapper } from "./SectionWrapper";
import { StackedBarYearChart } from "../charts/StackedBarYearChart";
import { AIAnnotation } from "../ai/AIAnnotation";
import type { AfterTaxResult } from "@propertyiq/analyzer-core";

interface AfterTaxSectionProps {
  afterTax: AfterTaxResult;
  aiText?: string | null;
  aiIsStale?: boolean;
  onRefreshAi?: () => void;
}

export function AfterTaxSection({
  afterTax,
  aiText,
  aiIsStale,
  onRefreshAi,
}: AfterTaxSectionProps) {
  const data = afterTax.yearly.map((y) => ({
    year: y.year,
    preTax: Math.max(0, y.preTaxCashflow),
    depBenefit: y.depreciationDeduction * 0.24, // visualize at 24% marginal
    intBenefit: y.interestDeduction * 0.24,
  }));

  return (
    <SectionWrapper
      id="after_tax"
      title="After-Tax Cashflow"
      onRefresh={onRefreshAi}
      aiAnnotation={
        <AIAnnotation
          text={aiText}
          isStale={aiIsStale}
          onRefresh={onRefreshAi}
        />
      }
    >
      <StackedBarYearChart
        data={data}
        bars={[
          { dataKey: "preTax", label: "Pre-Tax", color: "primary" },
          {
            dataKey: "depBenefit",
            label: "Depreciation Shield",
            color: "positive",
          },
          { dataKey: "intBenefit", label: "Interest Shield", color: "caution" },
        ]}
      />
    </SectionWrapper>
  );
}
