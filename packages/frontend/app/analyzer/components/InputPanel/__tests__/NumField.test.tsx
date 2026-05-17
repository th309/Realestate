import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { NumField } from "../NumField";
import { RentCastBadge } from "../RentCastBadge";

describe("NumField", () => {
  it("renders label and current value with thousands separators", () => {
    const { getByLabelText } = render(
      <NumField label="Price" value={240000} onChange={() => {}} />,
    );
    const input = getByLabelText("Price") as HTMLInputElement;
    expect(input.value).toBe("240,000");
  });

  it("typing fires onChange with parsed number (commas accepted, stripped)", () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <NumField label="Rent" value={null} onChange={onChange} />,
    );
    fireEvent.change(getByLabelText("Rent"), { target: { value: "2,850" } });
    expect(onChange).toHaveBeenCalledWith(2850);
  });

  it("groupThousands=false renders unformatted value", () => {
    const { getByLabelText } = render(
      <NumField
        label="Price"
        value={240000}
        onChange={() => {}}
        groupThousands={false}
      />,
    );
    expect((getByLabelText("Price") as HTMLInputElement).value).toBe("240000");
  });

  it("clearing input fires onChange(null)", () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <NumField label="X" value={100} onChange={onChange} />,
    );
    fireEvent.change(getByLabelText("X"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("renders RentCastBadge in badge slot", () => {
    const { container } = render(
      <NumField
        label="Rent"
        value={null}
        onChange={() => {}}
        badge={<RentCastBadge state="fresh" />}
      />,
    );
    expect(container.querySelector("[data-rentcast-badge]")).toBeTruthy();
  });

  it("renders Nudge when provided", () => {
    const { container } = render(
      <NumField
        label="Rent"
        value={null}
        onChange={() => {}}
        nudge={{ level: "warn", text: "very low" }}
      />,
    );
    expect(container.querySelector("[data-nudge]")?.textContent).toBe(
      "very low",
    );
  });

  it("prefix and suffix render", () => {
    const { getByText } = render(
      <NumField
        label="Price"
        value={null}
        onChange={() => {}}
        prefix="$"
        suffix="USD"
      />,
    );
    expect(getByText("$")).toBeTruthy();
    expect(getByText("USD")).toBeTruthy();
  });
});
