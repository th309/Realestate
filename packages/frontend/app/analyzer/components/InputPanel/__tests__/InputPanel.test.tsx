import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { InputPanel } from "../InputPanel";
import type { DealInput } from "@propertyiq/analyzer-core";

const baseInput: DealInput = {
  price: 240000,
  rentMonthly: 2850,
  taxAnnual: 3800,
  insuranceAnnual: 1200,
  hoaMonthly: 0,
  financing: {
    downPaymentPct: 0.2,
    interestRatePct: 7.1,
    termYears: 30,
    closingCostsPct: 0.03,
  },
};

describe("InputPanel", () => {
  it("renders all 4 number fields + 3 sliders + address + fetch button", () => {
    const { container } = render(
      <InputPanel
        input={baseInput}
        onChange={() => {}}
        address=""
        onAddressChange={() => {}}
      />,
    );
    expect(
      container.querySelectorAll("[data-num-field]").length,
    ).toBeGreaterThanOrEqual(4);
    expect(container.querySelectorAll("[data-slider-field]").length).toBe(3);
    expect(container.querySelector("[data-address-input]")).toBeTruthy();
    expect(
      container.querySelector("[data-fetch-property-button]"),
    ).toBeTruthy();
  });

  it("typing in address fires onAddressChange", () => {
    const onAddressChange = vi.fn();
    const { container } = render(
      <InputPanel
        input={baseInput}
        onChange={() => {}}
        address=""
        onAddressChange={onAddressChange}
      />,
    );
    fireEvent.change(
      container.querySelector("[data-address-input]") as HTMLInputElement,
      {
        target: { value: "123 Main St" },
      },
    );
    expect(onAddressChange).toHaveBeenCalledWith("123 Main St");
  });

  it("changing a NumField fires onChange with patched input", () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <InputPanel
        input={baseInput}
        onChange={onChange}
        address=""
        onAddressChange={() => {}}
      />,
    );
    fireEvent.change(getByLabelText("Price"), { target: { value: "260000" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ price: 260000 }),
    );
  });

  it("ARV field renders when arv prop provided and strategy is not buyAndHold", () => {
    const { getByLabelText } = render(
      <InputPanel
        input={baseInput}
        arv={300000}
        onArvChange={() => {}}
        onChange={() => {}}
        address=""
        onAddressChange={() => {}}
        activeStrategy="flip"
      />,
    );
    expect(getByLabelText(/ARV/)).toBeTruthy();
  });
});
