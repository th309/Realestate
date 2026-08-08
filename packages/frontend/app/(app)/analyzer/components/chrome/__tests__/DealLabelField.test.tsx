import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DealLabelField } from "../DealLabelField";

// NOTE: `@testing-library/user-event` is NOT a dependency of this repo — only
// `@testing-library/jest-dom` and `@testing-library/react` are installed. Use
// `fireEvent`, which is the established idiom here (see SaveButton.test.tsx).

describe("DealLabelField", () => {
  it("falls back to the address when the deal is unnamed", () => {
    render(
      <DealLabelField label={null} fallback="123 Main St" onChange={vi.fn()} />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.getByRole("textbox")).toHaveAttribute(
      "placeholder",
      "123 Main St",
    );
  });

  it("shows the saved label when present", () => {
    render(
      <DealLabelField
        label="Duplex deal"
        fallback="123 Main St"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("Duplex deal");
  });

  it("reports edits so autosave can pick them up", () => {
    const onChange = vi.fn();
    render(
      <DealLabelField label="" fallback="123 Main St" onChange={onChange} />,
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Flip" },
    });
    expect(onChange).toHaveBeenLastCalledWith("Flip");
  });

  it("caps the label at the DTO limit of 120 characters", () => {
    render(<DealLabelField label="" fallback="x" onChange={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveAttribute("maxLength", "120");
  });
});
