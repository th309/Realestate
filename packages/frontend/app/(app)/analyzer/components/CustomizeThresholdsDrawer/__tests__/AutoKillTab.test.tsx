import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BALANCED_THRESHOLDS } from "@propertyiq/analyzer-core";
import { AutoKillTab } from "../AutoKillTab";

const noErrors = {
  dscrFloor: null,
  taxInsShareOfRent: null,
  floodNoInsurance: null,
  negativeCashflowNoAck: null,
};

describe("AutoKillTab", () => {
  it("renders one row per B&H rule with switches", () => {
    render(
      <AutoKillTab
        strategy="BUY_AND_HOLD"
        thresholds={BALANCED_THRESHOLDS}
        onChange={() => {}}
        errors={noErrors}
      />,
    );
    expect(screen.getAllByRole("switch")).toHaveLength(4);
    expect(screen.getByTestId("autokill-row-dscrFloor")).toBeTruthy();
    expect(
      screen.getByTestId("autokill-row-negativeCashflowNoAck"),
    ).toBeTruthy();
  });

  it("toggle writes enabled=false into the autoKills block", () => {
    const onChange = vi.fn();
    render(
      <AutoKillTab
        strategy="BUY_AND_HOLD"
        thresholds={BALANCED_THRESHOLDS}
        onChange={onChange}
        errors={noErrors}
      />,
    );
    fireEvent.click(screen.getByRole("switch", { name: /DSCR floor/i }));
    const next = onChange.mock.calls[0][0] as {
      autoKills: { dscrFloor: { enabled: boolean } };
    };
    expect(next.autoKills.dscrFloor.enabled).toBe(false);
  });

  it("editing a numeric limit writes value (percent rows convert display→decimal)", () => {
    const onChange = vi.fn();
    render(
      <AutoKillTab
        strategy="BUY_AND_HOLD"
        thresholds={BALANCED_THRESHOLDS}
        onChange={onChange}
        errors={noErrors}
      />,
    );
    fireEvent.change(
      screen.getByLabelText("Tax + insurance share of rent limit"),
      { target: { value: "25" } },
    );
    const next = onChange.mock.calls[0][0] as {
      autoKills: { taxInsShareOfRent: { value: number } };
    };
    expect(next.autoKills.taxInsShareOfRent.value).toBeCloseTo(0.25);
  });

  it("renders a validation error under the offending row", () => {
    render(
      <AutoKillTab
        strategy="BUY_AND_HOLD"
        thresholds={BALANCED_THRESHOLDS}
        onChange={() => {}}
        errors={{ ...noErrors, dscrFloor: "Must be between 0.3 and 2" }}
      />,
    );
    expect(screen.getByTestId("autokill-error-dscrFloor").textContent).toMatch(
      /0\.3/,
    );
  });
});
