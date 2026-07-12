import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BALANCED_THRESHOLDS } from "@propertyiq/analyzer-core";
import { ThresholdsTab } from "../ThresholdsTab";
import { WeightsTab } from "../WeightsTab";
import { AssumptionsTab } from "../AssumptionsTab";
import { rowsForStrategy } from "../preset-helpers";

const BH_ROWS = rowsForStrategy("BUY_AND_HOLD");

describe("ThresholdsTab", () => {
  it("renders all five metric rows", () => {
    render(
      <ThresholdsTab
        rows={BH_ROWS}
        thresholds={BALANCED_THRESHOLDS}
        preset={BALANCED_THRESHOLDS}
        onChange={() => {}}
        errors={{}}
      />,
    );
    expect(screen.getByTestId("threshold-row-cashOnCash")).toBeInTheDocument();
    expect(screen.getByTestId("threshold-row-dscr")).toBeInTheDocument();
    expect(
      screen.getByTestId("threshold-row-cashFlowPerDoor"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("threshold-row-capRate")).toBeInTheDocument();
    expect(
      screen.getByTestId("threshold-row-breakEvenOccupancy"),
    ).toBeInTheDocument();
  });

  it("displays cashOnCash A in percent form", () => {
    render(
      <ThresholdsTab
        rows={BH_ROWS}
        thresholds={BALANCED_THRESHOLDS}
        preset={BALANCED_THRESHOLDS}
        onChange={() => {}}
        errors={{}}
      />,
    );
    const input = screen.getByLabelText(
      "Cash-on-Cash grade A",
    ) as HTMLInputElement;
    // 0.12 → 12
    expect(input.value).toBe("12");
  });

  it("fires onChange with decimal-shaped values when input edited", () => {
    const onChange = vi.fn();
    render(
      <ThresholdsTab
        rows={BH_ROWS}
        thresholds={BALANCED_THRESHOLDS}
        preset={BALANCED_THRESHOLDS}
        onChange={onChange}
        errors={{}}
      />,
    );
    const input = screen.getByLabelText("Cash-on-Cash grade A");
    fireEvent.change(input, { target: { value: "15" } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].cashOnCash.A).toBeCloseTo(0.15, 5);
  });

  it("per-row Reset restores that row from preset", () => {
    const onChange = vi.fn();
    const edited = {
      ...BALANCED_THRESHOLDS,
      capRate: {
        ...BALANCED_THRESHOLDS.capRate,
        A: 0.99,
      },
    };
    render(
      <ThresholdsTab
        rows={BH_ROWS}
        thresholds={edited}
        preset={BALANCED_THRESHOLDS}
        onChange={onChange}
        errors={{}}
      />,
    );
    fireEvent.click(screen.getByLabelText("Reset Cap Rate to defaults"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].capRate).toEqual(
      BALANCED_THRESHOLDS.capRate,
    );
  });

  it("shows inline error when errors prop has a value for that row", () => {
    render(
      <ThresholdsTab
        rows={BH_ROWS}
        thresholds={BALANCED_THRESHOLDS}
        preset={BALANCED_THRESHOLDS}
        onChange={() => {}}
        errors={{ cashOnCash: "Values must decrease: A > B > C > D" }}
      />,
    );
    expect(screen.getByTestId("threshold-error-cashOnCash")).toHaveTextContent(
      /decrease/,
    );
  });
});

describe("WeightsTab", () => {
  it("renders sum indicator with green pill when valid", () => {
    render(
      <WeightsTab
        rows={BH_ROWS}
        weights={BALANCED_THRESHOLDS.weights}
        onChange={() => {}}
        sum={100}
        isValid
      />,
    );
    const pill = screen.getByTestId("weights-sum-indicator");
    expect(pill).toHaveTextContent(/Sum/);
    expect(pill).toHaveTextContent("100.00");
    expect(pill).toHaveTextContent("✓");
  });

  it("renders red pill with delta hint when invalid", () => {
    render(
      <WeightsTab
        rows={BH_ROWS}
        weights={BALANCED_THRESHOLDS.weights}
        onChange={() => {}}
        sum={95}
        isValid={false}
      />,
    );
    const pill = screen.getByTestId("weights-sum-indicator");
    expect(pill).toHaveTextContent("95.00");
    expect(pill).toHaveTextContent("need +5");
  });

  it("fires onChange with parsed numeric value", () => {
    const onChange = vi.fn();
    render(
      <WeightsTab
        rows={BH_ROWS}
        weights={BALANCED_THRESHOLDS.weights}
        onChange={onChange}
        sum={100}
        isValid
      />,
    );
    const input = screen.getByLabelText("Cash-on-Cash weight");
    fireEvent.change(input, { target: { value: "30" } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].cashOnCash).toBe(30);
  });
});

describe("AssumptionsTab", () => {
  const baseDefaults = {
    vacancyPct: 0.05,
    maintenancePct: 0.05,
    capexPct: 0.05,
    pmPct: 0.08,
    rentGrowthPct: 0.03,
    appreciationPct: 0.03,
    holdYears: 10,
    closingCostsPct: 0.03,
  };
  const noErrors = {
    vacancyPct: null,
    maintenancePct: null,
    capexPct: null,
    pmPct: null,
    rentGrowthPct: null,
    appreciationPct: null,
    holdYears: null,
    closingCostsPct: null,
    marginalTaxRatePct: null,
    landValueSharePct: null,
    expenseGrowthPct: null,
  };

  it("renders inputs reflecting percent-shaped storage as integer %", () => {
    render(
      <AssumptionsTab
        defaults={baseDefaults}
        onChange={() => {}}
        errors={noErrors}
      />,
    );
    const vacancy = screen.getByLabelText("Vacancy") as HTMLInputElement;
    // 0.05 → 5
    expect(vacancy.value).toBe("5");
    const hold = screen.getByLabelText("Hold Period") as HTMLInputElement;
    expect(hold.value).toBe("10");
  });

  it("fires onChange with decimal-shaped value after percent edit", () => {
    const onChange = vi.fn();
    render(
      <AssumptionsTab
        defaults={baseDefaults}
        onChange={onChange}
        errors={noErrors}
      />,
    );
    fireEvent.change(screen.getByLabelText("Vacancy"), {
      target: { value: "8" },
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].vacancyPct).toBeCloseTo(0.08, 5);
  });

  it("fires onChange with integer holdYears", () => {
    const onChange = vi.fn();
    render(
      <AssumptionsTab
        defaults={baseDefaults}
        onChange={onChange}
        errors={noErrors}
      />,
    );
    fireEvent.change(screen.getByLabelText("Hold Period"), {
      target: { value: "7" },
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].holdYears).toBe(7);
  });

  it("shows inline error when errors prop has a message for a field", () => {
    render(
      <AssumptionsTab
        defaults={baseDefaults}
        onChange={() => {}}
        errors={{ ...noErrors, vacancyPct: "Must be between 0% and 100%" }}
      />,
    );
    expect(screen.getByTestId("assumption-error-vacancyPct")).toHaveTextContent(
      /between/,
    );
  });
});
