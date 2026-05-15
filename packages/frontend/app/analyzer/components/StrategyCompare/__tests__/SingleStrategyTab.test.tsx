import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { SingleStrategyTab } from "../SingleStrategyTab";

const slots = {
  buyAndHold: <div data-test="bah">BAH content</div>,
  flip: <div data-test="flip">Flip content</div>,
  brrrr: <div data-test="brrrr">BRRRR content</div>,
};

describe("SingleStrategyTab", () => {
  it("renders default (buyAndHold) slot", () => {
    const { getByText, queryByText } = render(<SingleStrategyTab {...slots} />);
    expect(getByText("BAH content")).toBeTruthy();
    expect(queryByText("Flip content")).toBeFalsy();
  });

  it("clicking flip tab swaps body", () => {
    const { getByText, queryByText, container } = render(
      <SingleStrategyTab {...slots} />,
    );
    fireEvent.click(container.querySelector("[data-tab='flip']")!);
    expect(getByText("Flip content")).toBeTruthy();
    expect(queryByText("BAH content")).toBeFalsy();
  });

  it("onChange fires with active key", () => {
    const onChange = vi.fn();
    const { container } = render(
      <SingleStrategyTab {...slots} onChange={onChange} />,
    );
    fireEvent.click(container.querySelector("[data-tab='brrrr']")!);
    expect(onChange).toHaveBeenCalledWith("brrrr");
  });

  it("aria-selected reflects active tab", () => {
    const { container } = render(<SingleStrategyTab {...slots} />);
    expect(
      container
        .querySelector("[data-tab='buyAndHold']")
        ?.getAttribute("aria-selected"),
    ).toBe("true");
    fireEvent.click(container.querySelector("[data-tab='flip']")!);
    expect(
      container
        .querySelector("[data-tab='flip']")
        ?.getAttribute("aria-selected"),
    ).toBe("true");
    expect(
      container
        .querySelector("[data-tab='buyAndHold']")
        ?.getAttribute("aria-selected"),
    ).toBe("false");
  });
});
