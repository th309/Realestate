import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { FetchPropertyDataButton } from "../FetchPropertyDataButton";

describe("FetchPropertyDataButton", () => {
  it("disabled when not Pro", () => {
    const { container } = render(
      <FetchPropertyDataButton address="123 Main" isPro={false} />,
    );
    const btn = container.querySelector(
      "[data-fetch-property-button]",
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toMatch(/Pro feature/);
  });

  it("disabled when address empty even if Pro", () => {
    const { container } = render(
      <FetchPropertyDataButton address="   " isPro={true} />,
    );
    expect(
      (
        container.querySelector(
          "[data-fetch-property-button]",
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("enabled when Pro + address present; click fires onClick", () => {
    const onClick = vi.fn();
    const { container } = render(
      <FetchPropertyDataButton
        address="123 Main"
        isPro={true}
        onClick={onClick}
      />,
    );
    const btn = container.querySelector(
      "[data-fetch-property-button]",
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalled();
  });

  it("isPending shows 'Fetching…' label and disables", () => {
    const { container } = render(
      <FetchPropertyDataButton
        address="123 Main"
        isPro={true}
        isPending={true}
      />,
    );
    const btn = container.querySelector(
      "[data-fetch-property-button]",
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toMatch(/Fetching/);
  });
});
