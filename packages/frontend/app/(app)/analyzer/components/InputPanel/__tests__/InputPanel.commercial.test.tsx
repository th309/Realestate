import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { InputPanel } from "../InputPanel";
import { DEFAULT_ASSUMPTIONS } from "../../../lib/analyzer-assumptions";
import type { DealInput } from "@propertyiq/analyzer-core";

const baseInput: DealInput = {
  price: 1_200_000,
  rentMonthly: 11_000,
  taxAnnual: 18_000,
  insuranceAnnual: 6_000,
  hoaMonthly: 0,
  propertyClass: "commercial_mf",
  unitCount: 10,
  marketCapRatePct: 7.0,
  targetDSCR: 1.25,
  capexReserveAnnualPerUnit: 300,
  financing: {
    downPaymentPct: 0.3,
    interestRatePct: 7.5,
    termYears: 7,
    amortizationYears: 30,
    closingCostsPct: 0.03,
  },
};

describe("InputPanel — commercial MF (5+ units)", () => {
  it("shows Commercial Underwriting group when propertyClass is commercial_mf", () => {
    const { getByText } = render(
      <InputPanel
        input={baseInput}
        onChange={() => {}}
        address=""
        onAddressChange={() => {}}
        propertyType="mf"
        unitCount={10}
        propertyClass="commercial_mf"
        assumptions={DEFAULT_ASSUMPTIONS}
        onAssumptionChange={() => {}}
        onAnalysisModeChange={() => {}}
        onStrategyChange={() => {}}
      />,
    );
    // Group header + chip render
    expect(getByText("Commercial Underwriting")).toBeTruthy();
    expect(getByText("MF 5+")).toBeTruthy();
  });

  it("exposes Market cap rate, Target DSCR, Amortization, Capex reserve fields", () => {
    const { getByLabelText } = render(
      <InputPanel
        input={baseInput}
        onChange={() => {}}
        address=""
        onAddressChange={() => {}}
        propertyType="mf"
        unitCount={10}
        propertyClass="commercial_mf"
        assumptions={DEFAULT_ASSUMPTIONS}
        onAssumptionChange={() => {}}
        onAnalysisModeChange={() => {}}
        onStrategyChange={() => {}}
      />,
    );
    expect(getByLabelText(/Market cap rate/)).toBeTruthy();
    expect(getByLabelText(/Target DSCR/)).toBeTruthy();
    expect(getByLabelText(/Amortization/)).toBeTruthy();
    expect(getByLabelText(/Capex reserve/)).toBeTruthy();
  });

  it("hides Flip and BRRRR strategy groups in commercial mode", () => {
    const { queryByText } = render(
      <InputPanel
        input={baseInput}
        onChange={() => {}}
        address=""
        onAddressChange={() => {}}
        propertyType="mf"
        unitCount={10}
        propertyClass="commercial_mf"
        activeStrategy="flip"
        assumptions={DEFAULT_ASSUMPTIONS}
        onAssumptionChange={() => {}}
        onAnalysisModeChange={() => {}}
        onStrategyChange={() => {}}
      />,
    );
    // Flip carry & exit group + BRRRR refi & timeline group must NOT render
    expect(queryByText("Flip carry & exit")).toBeNull();
    expect(queryByText("BRRRR refi & timeline")).toBeNull();
  });

  it("hides the strategy chip selector and shows the commercial-only note", () => {
    const { queryByRole, getByText } = render(
      <InputPanel
        input={baseInput}
        onChange={() => {}}
        address=""
        onAddressChange={() => {}}
        propertyType="mf"
        unitCount={10}
        propertyClass="commercial_mf"
        analysisMode="focused"
        assumptions={DEFAULT_ASSUMPTIONS}
        onAssumptionChange={() => {}}
        onAnalysisModeChange={() => {}}
        onStrategyChange={() => {}}
      />,
    );
    expect(queryByRole("tablist", { name: /Investment strategy/i })).toBeNull();
    expect(
      getByText(/Commercial MF \(5\+ units\) is held long-term/i),
    ).toBeTruthy();
  });

  it("falls back to residential layout when propertyClass is sfh", () => {
    const { getByText, queryByText } = render(
      <InputPanel
        input={{ ...baseInput, propertyClass: "sfh", unitCount: 1 }}
        onChange={() => {}}
        address=""
        onAddressChange={() => {}}
        propertyType="sfh"
        unitCount={1}
        propertyClass="sfh"
        activeStrategy="flip"
        analysisMode="focused"
        arv={395_000}
        onArvChange={() => {}}
        rehabBudget={45_000}
        onRehabBudgetChange={() => {}}
        assumptions={DEFAULT_ASSUMPTIONS}
        onAssumptionChange={() => {}}
        onAnalysisModeChange={() => {}}
        onStrategyChange={() => {}}
      />,
    );
    expect(queryByText("Commercial Underwriting")).toBeNull();
    expect(getByText("Flip carry & exit")).toBeTruthy();
  });
});
