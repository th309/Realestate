import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { SliderField } from "../SliderField";

describe("SliderField", () => {
  it("renders label and formatted value", () => {
    const { getByText } = render(
      <SliderField
        label="Down Payment"
        min={0}
        max={100}
        value={20}
        onChange={() => {}}
        format={(v) => `${v}%`}
      />,
    );
    expect(getByText("Down Payment")).toBeTruthy();
    expect(getByText("20%")).toBeTruthy();
  });

  it("change fires onChange with numeric value", () => {
    const onChange = vi.fn();
    const { container } = render(
      <SliderField
        label="X"
        min={0}
        max={100}
        value={10}
        onChange={onChange}
      />,
    );
    const range = container.querySelector(
      "input[type='range']",
    ) as HTMLInputElement;
    fireEvent.change(range, { target: { value: "55" } });
    expect(onChange).toHaveBeenCalledWith(55);
  });
});
