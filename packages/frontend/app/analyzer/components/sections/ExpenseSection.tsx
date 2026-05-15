"use client";
import { SectionWrapper } from "./SectionWrapper";
import { WaterfallChart, WaterfallStep } from "../charts/WaterfallChart";
import { AIAnnotation } from "../ai/AIAnnotation";

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
  const cashflow =
    grossRentMonthly - vacancyMonthly - opexMonthly - debtServiceMonthly;
  const steps: WaterfallStep[] = [
    { label: "Gross Rent", value: grossRentMonthly, kind: "start" },
    { label: "Vacancy", value: -vacancyMonthly, kind: "subtract" },
    { label: "OpEx", value: -opexMonthly, kind: "subtract" },
    { label: "Debt", value: -debtServiceMonthly, kind: "subtract" },
    { label: "Cashflow", value: cashflow, kind: "end" },
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
      <WaterfallChart steps={steps} />
    </SectionWrapper>
  );
}
