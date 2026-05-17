"use client";
import { SectionWrapper } from "./SectionWrapper";
import { AIAnnotation } from "../ai/AIAnnotation";
import { DirectionalBars } from "../primitives/DirectionalBars";
import type { BarItem } from "../primitives/DirectionalBars";
import { MetricBlock } from "../primitives/MetricBlock";

interface ExpenseSectionProps {
  grossRentMonthly: number;
  vacancyMonthly: number;
  opexMonthly: number; // taxes + insurance + maintenance + management + HOA
  debtServiceMonthly: number;
  aiText?: string | null;
  aiIsStale?: boolean;
  onRefreshAi?: () => void;
}

export function ExpenseSection({
  grossRentMonthly,
  vacancyMonthly,
  opexMonthly,
  debtServiceMonthly,
  aiText,
  aiIsStale,
  onRefreshAi,
}: ExpenseSectionProps) {
  const monthlyCashFlow =
    grossRentMonthly - vacancyMonthly - opexMonthly - debtServiceMonthly;

  const data: BarItem[] = [
    { label: "Gross Rent", value: grossRentMonthly, type: "income" },
    { label: "Vacancy", value: -vacancyMonthly, type: "expense" },
    { label: "OpEx", value: -opexMonthly, type: "expense" },
    { label: "Debt Service", value: -debtServiceMonthly, type: "expense" },
    { label: "Cash Flow", value: monthlyCashFlow, type: "result" },
  ];

  return (
    <SectionWrapper
      id="expense_waterfall"
      title="Where the Rent Goes"
      onRefresh={onRefreshAi}
      aiAnnotation={
        <AIAnnotation
          text={aiText}
          isStale={aiIsStale}
          onRefresh={onRefreshAi}
        />
      }
    >
      <MetricBlock
        label="Monthly cash flow"
        value={monthlyCashFlow}
        format="currency"
        size="lg"
        variant="directional"
      />
      <DirectionalBars data={data} layout="waterfall" currency showConnectors />
    </SectionWrapper>
  );
}
